// Vercel Serverless Function — Kworb sayfası proxy'si
//
// Neden var: JT'nin Kworb sanatçı sayfası "4 Minutes"ın yalnızca bir sürümünü
// listeliyor ("feat. Justin Timberlake & Timbaland", Hard Candy). Aynı kaydın
// başka bir yayınına ait ikinci track'i ve üç remix/live sürümü SADECE Madonna'nın
// sayfasında görünüyor — toplamda 116M+ stream. kworb.net CORS başlığı vermediği
// için tarayıcıdan doğrudan okunamıyor, o yüzden sunucudan çekiyoruz.
//
// Kullanım:  /api/kworb?artist=<spotify_artist_id>&q=4%20minutes
//   q verilirse yalnızca başlığı eşleşen satırlar döner (yanıt küçük kalsın diye).
//   q yoksa sayfadaki tüm track satırları döner.
//
// Yalnızca izin listesindeki sanatçı sayfaları çekilebilir: bu fonksiyon
// istediğin her URL'i getiren açık bir proxy'ye dönüşmesin.

const ALLOWED_ARTISTS = {
    '6tbjWDEIzxoDsBA1FuhfPW': 'Madonna',
    '31TPClRtHm23RisEBtV3X7': 'Justin Timberlake',
    // JT'nin sayfasında hiç görünmeyen ortak kayıtlar (bkz. collab-streams.js):
    // Where Is The Love? / Give It To Me / Rehab.
    '1yxSLGMDHlW21z4YXirZDS': 'Black Eyed Peas',
    '5Y5TRrQiqgUO4S36tzjIRZ': 'Timbaland',
    '5pKCCKE2ajJHZ9KAiaK11H': 'Rihanna'
};

function parseSongRows(html) {
    const rows = [];
    // Kworb tablosu: <tr><td>başlık</td><td>toplam</td><td>günlük</td></tr>
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRe.exec(html)) !== null) {
        const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
            .map(c => c[1]
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
                .trim());
        if (cells.length < 3) continue;
        const total = parseInt(cells[1].replace(/,/g, ''), 10);
        const daily = parseInt(cells[2].replace(/,/g, ''), 10);
        if (!cells[0] || !Number.isFinite(total)) continue;
        rows.push({ title: cells[0], total, daily: Number.isFinite(daily) ? daily : 0 });
    }
    return rows;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const artist = String(req.query.artist || '');
    const q = String(req.query.q || '').toLowerCase().trim();

    if (!ALLOWED_ARTISTS[artist]) {
        res.status(400).json({ error: 'Unknown artist id.', allowed: Object.keys(ALLOWED_ARTISTS) });
        return;
    }

    try {
        const url = `https://kworb.net/spotify/artist/${artist}_songs.html`;
        const upstream = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TimberlakeAnalytics/1.0)' }
        });
        if (!upstream.ok) {
            res.status(502).json({ error: `Kworb responded ${upstream.status}` });
            return;
        }
        const html = await upstream.text();
        let tracks = parseSongRows(html);
        if (q) tracks = tracks.filter(t => t.title.toLowerCase().includes(q));

        // Kworb günde bir kez güncelleniyor; bir saatlik edge cache fazlasıyla yeter.
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
        res.status(200).json({
            artist: ALLOWED_ARTISTS[artist],
            source: url,
            fetched_at: new Date().toISOString(),
            count: tracks.length,
            tracks
        });
    } catch (e) {
        console.error('Kworb proxy error:', e);
        res.status(500).json({ error: e.message });
    }
};
