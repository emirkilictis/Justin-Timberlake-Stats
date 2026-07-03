// Vercel Serverless Function — Spotify proxy
// Scrapes monthly listeners from open.spotify.com (no API key required).

const ARTIST_ID = '31TPClRtHm23RisEBtV3X7';

async function getMonthlyListeners() {
    // Spotify blocks initialState from cloud IPs but always serves LD+JSON for SEO.
    // The LD+JSON description field contains "X monthly listeners".
    const res = await fetch(`https://open.spotify.com/artist/${ARTIST_ID}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept':     'text/html',
        }
    });
    const html = await res.text();

    // Primary: LD+JSON description — "Artist · 49.4M monthly listeners."
    const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (ldMatch) {
        const ld = JSON.parse(ldMatch[1]);
        const desc = ld.description || '';
        const mlText = desc.match(/([\d,.]+)\s*([MBK])?\s*monthly\s*listeners/i);
        if (mlText) {
            let num = parseFloat(mlText[1].replace(/,/g, ''));
            const suffix = (mlText[2] || '').toUpperCase();
            if (suffix === 'B') num *= 1_000_000_000;
            else if (suffix === 'M') num *= 1_000_000;
            else if (suffix === 'K') num *= 1_000;
            return Math.round(num);
        }
    }

    // Fallback: initialState blob (works from some IPs)
    const initMatch = html.match(/<script id="initialState"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/s);
    if (initMatch) {
        const decoded = Buffer.from(initMatch[1].trim(), 'base64').toString('utf-8');
        const mlMatch = decoded.match(/monthlyListeners["\s:]+(\d{3,})/);
        if (mlMatch) return parseInt(mlMatch[1]);
    }

    return null;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { action } = req.query;

    try {
        if (action === 'artist') {
            res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
            const monthly_listeners = await getMonthlyListeners();
            res.status(200).json({ monthly_listeners });
        } else {
            res.status(400).json({ error: 'Unknown action. Use: artist' });
        }
    } catch (e) {
        console.error('Spotify proxy error:', e);
        res.status(500).json({ error: e.message });
    }
}
