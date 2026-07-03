// Vercel Serverless Function — JT Spotify stream verisi (Kworb proxy'sinin yerine)
//
// Neon Postgres'teki `daily_streams_canonical` view'inden (SpotifyStreams scraper'ı
// dolduruyor) Justin Timberlake'in canonical track'lerini, her birinin EN SON kümülatif
// stream sayısı + normalize edilmiş günlük artışıyla birlikte döndürür.
//
// View hijyeni (SpotifyStreams migration'ları):
//   006 — re-release'leri canonical_id altında MAX ile birleştirir (çift sayım yok)
//   007 — çok-günlük boşlukları gün-farkına böler (şişme yok)
//   009 — running-max ile negatif/dalgalanmayı engeller
//
// Era-mapping (Neon ham Spotify albüm adı → sitenin 7 era'sı) BİLEREK burada yapılmıyor;
// client tarafında song-map.js tek kaynak olarak kalsın diye ham `title` + `album` döner.
//
// Gerekli env: DATABASE_URL (Neon connection string) — Vercel dashboard'dan eklenmeli.

const { neon } = require('@neondatabase/serverless');

const JT_ARTIST_URI = 'spotify:artist:31TPClRtHm23RisEBtV3X7';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (!process.env.DATABASE_URL) {
        res.status(500).json({ error: 'DATABASE_URL env değişkeni tanımlı değil.' });
        return;
    }

    try {
        const sql = neon(process.env.DATABASE_URL);

        // Her canonical track için en son kayıt (DISTINCT ON ... ORDER BY recorded_date DESC).
        const rows = await sql`
            WITH latest AS (
                SELECT DISTINCT ON (dsc.canonical_id)
                       dsc.canonical_id,
                       dsc.cumulative,
                       dsc.daily_gain,
                       dsc.recorded_date
                FROM daily_streams_canonical dsc
                ORDER BY dsc.canonical_id, dsc.recorded_date DESC
            )
            SELECT sc.title,
                   al.title  AS album,
                   sc.album_id,
                   latest.cumulative,
                   latest.daily_gain,
                   latest.recorded_date,
                   sc.is_solo,
                   sc.is_featured,
                   latest.canonical_id
            FROM latest
            JOIN songs sc       ON sc.id = latest.canonical_id
            LEFT JOIN albums al ON al.id = sc.album_id
            WHERE sc.primary_artist = ${JT_ARTIST_URI}
            ORDER BY latest.cumulative DESC
        `;

        let asOf = null;
        const tracks = rows.map(r => {
            const date = typeof r.recorded_date === 'string'
                ? r.recorded_date.slice(0, 10)
                : new Date(r.recorded_date).toISOString().slice(0, 10);
            if (!asOf || date > asOf) asOf = date;
            return {
                canonicalId: r.canonical_id,
                title: r.title,
                album: r.album,
                albumId: r.album_id,
                total: Number(r.cumulative) || 0,
                daily: Math.max(0, Number(r.daily_gain) || 0), // NULL/negatif guard
                isSolo: r.is_solo,
                isFeatured: r.is_featured,
            };
        });

        // Tekilleştirme: canonical-linking boşlukları yüzünden bazı şarkılar aynı BAŞLIKLA
        // birden çok canonical_id altında dönebiliyor (örn. albüm + single release). Aynı
        // başlığı en yüksek cumulative ile tek satıra indir (006 view'inin MAX mantığıyla
        // tutarlı) → çift satır + çift-sayım engellenir.
        const byTitle = new Map();
        for (const t of tracks) {
            const key = (t.title || '').toLowerCase().trim();
            const existing = byTitle.get(key);
            if (!existing || t.total > existing.total) byTitle.set(key, t);
        }
        const dedupedTracks = [...byTitle.values()].sort((a, b) => b.total - a.total);

        const totalSpotify = dedupedTracks.reduce((s, t) => s + t.total, 0);
        const totalDaily   = dedupedTracks.reduce((s, t) => s + t.daily, 0);

        // 6 saat CDN cache; arkada yenilenirken bayat veriyi servis et.
        res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
        res.status(200).json({
            asOf,
            stale: asOf ? (Date.now() - new Date(asOf + 'T00:00:00Z').getTime()) > 3 * 86400000 : true,
            totalSpotify,
            totalDaily,
            count: dedupedTracks.length,
            tracks: dedupedTracks,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
