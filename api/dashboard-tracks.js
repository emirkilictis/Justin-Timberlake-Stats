// Vercel Serverless Function — SpotifyStreams dashboard proxy'si
//
// Neden var: Kworb JT'nin kredili kataloğunun bir kısmını hiçbir sayfada
// tutmuyor (TROLLS Holiday), bir kısmını da yalnızca aylarca güncellenmeyen
// sayfalarda tutuyor (The Lonely Island: 2026-10, Jimmy Fallon: 2026-04).
// 2026-11-19'da JT'nin Kworb sayfası ile Spotify'ın kendisi arasında ~197M
// fark vardı. Site sahibinin kendi projesi olan SpotifyStreams dashboard'u
// Spotify'ın playcount'unu her gün kendisi okuyor; eksikleri oradan alıyoruz.
// Hangi parçaların alınacağı missing-tracks.js'teki açık listede — bu fonksiyon
// yalnızca JT'nin tablosunu küçültüp iletiyor.
//
// Render free plan uykuya geçiyor; ilk istek 30-60 sn sürebilir. Zaman aşımında
// 502 dönüyoruz ve istemci missing-tracks.js'teki yedek değerlere düşüyor.
// stale-while-revalidate sayesinde çoğu ziyaretçi uyanma beklemesini hiç görmez.
//
// Kullanım:  /api/dashboard-tracks
// Parametre almaz, URL sabit: açık bir proxy değil.

const UPSTREAM = 'https://spotify-streams-dashboard.onrender.com/api/songs?artist=31TPClRtHm23RisEBtV3X7';
const TIMEOUT_MS = 12000;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const upstream = await fetch(UPSTREAM, {
            signal: ctrl.signal,
            headers: { 'User-Agent': 'TimberlakeAnalytics/1.0', 'Accept': 'application/json' }
        });
        if (!upstream.ok) {
            res.setHeader('Cache-Control', 'no-store');
            res.status(502).json({ error: `Dashboard responded ${upstream.status}` });
            return;
        }
        const rows = await upstream.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            res.setHeader('Cache-Control', 'no-store');
            res.status(502).json({ error: 'Dashboard returned no tracks' });
            return;
        }
        const tracks = rows.map(r => ({
            id: r.id,
            title: r.title,
            total: Number(r.cumulative) || 0,
            daily: Number(r.daily_avg_7d) || Number(r.daily_gain) || 0,
            recorded: r.recorded_date ? String(r.recorded_date).slice(0, 10) : null
        }));

        // Dashboard günde bir kez yazıyor. 1 saat taze, sonra 1 gün boyunca
        // eskiyi verip arkada yeniliyoruz — Render'ın uyanma süresi gizlenir.
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        res.status(200).json({
            source: UPSTREAM,
            fetched_at: new Date().toISOString(),
            count: tracks.length,
            tracks
        });
    } catch (e) {
        res.setHeader('Cache-Control', 'no-store');
        const msg = e.name === 'AbortError' ? `Dashboard timed out after ${TIMEOUT_MS}ms` : e.message;
        console.error('Dashboard proxy error:', msg);
        res.status(502).json({ error: msg });
    } finally {
        clearTimeout(timer);
    }
};
