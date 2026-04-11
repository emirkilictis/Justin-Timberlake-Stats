// Vercel Serverless Function — Spotify proxy
// Handles token exchange, monthly listeners extraction, and Web API requests.

const CLIENT_ID     = '7b662fc2913a4597905633ea6a350b42';
const CLIENT_SECRET = '4761ac8b9e4d4e159a430075c998410d';
const ARTIST_ID     = '31TPClRtHm23RisEBtV3X7';

let _cachedToken  = null;
let _tokenExpiry  = 0;

async function getToken() {
    if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${creds}`,
            'Content-Type':  'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
    const data = await res.json();
    _cachedToken = data.access_token;
    _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return _cachedToken;
}

async function getMonthlyListeners() {
    // Spotify blocks initialState from cloud IPs but always serves LD+JSON for SEO.
    // The LD+JSON description field contains "X monthly listeners".
    try {
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
            // Parse "49.4M" or "1,234,567" or "49,423,399"
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
    } catch (e) {
        console.error('Monthly listeners scrape failed:', e.message);
        return null;
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { action, market } = req.query;

    try {
        if (action === 'artist') {
            res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

            const token = await getToken();
            const [artistRes, monthlyListeners] = await Promise.all([
                fetch(`https://api.spotify.com/v1/artists/${ARTIST_ID}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                getMonthlyListeners()
            ]);

            if (!artistRes.ok) {
                const err = await artistRes.text();
                res.status(artistRes.status).json({ error: `Spotify API: ${artistRes.status}`, detail: err });
                return;
            }
            const artist = await artistRes.json();
            res.status(200).json({ ...artist, monthly_listeners: monthlyListeners });

        } else if (action === 'top-tracks') {
            const m = (market || 'US').toUpperCase().slice(0, 2);
            res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');

            const token = await getToken();
            const data  = await fetch(
                `https://api.spotify.com/v1/artists/${ARTIST_ID}/top-tracks?market=${m}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            ).then(r => r.json());

            res.status(200).json(data);

        } else {
            res.status(400).json({ error: 'Unknown action. Use: artist | top-tracks' });
        }
    } catch (e) {
        console.error('Spotify proxy error:', e);
        res.status(500).json({ error: e.message });
    }
}
