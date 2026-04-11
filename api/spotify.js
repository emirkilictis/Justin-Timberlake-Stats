// Vercel Serverless Function — Spotify proxy
// Handles CORS, token exchange, monthly listeners scraping, and Web API requests.

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
    // Try multiple approaches in parallel — Spotify changes their page frequently
    const results = await Promise.allSettled([
        scrapeOpenPage(),
        scrapePartnerAPI()
    ]);

    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) return r.value;
    }
    return null;
}

async function scrapeOpenPage() {
    // Try multiple URL patterns — Spotify redirects differently by region
    const urls = [
        `https://open.spotify.com/artist/${ARTIST_ID}`,
        `https://open.spotify.com/intl-en/artist/${ARTIST_ID}`,
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Site':  'none',
                    'Sec-Fetch-Mode':  'navigate',
                },
                redirect: 'follow',
            });
            const html = await res.text();

            // Method 1: initialState base64 blob (camelCase ID)
            const initMatch = html.match(/<script id="initialState"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/s);
            if (initMatch) {
                try {
                    const decoded = Buffer.from(initMatch[1].trim(), 'base64').toString('utf-8');
                    const mlMatch = decoded.match(/monthlyListeners["\s:]+(\d{3,})/);
                    if (mlMatch) return parseInt(mlMatch[1]);
                } catch (_) { /* continue */ }
            }

            // Method 2: direct JSON field anywhere in page
            const m1 = html.match(/"monthlyListeners"\s*:\s*(\d+)/);
            if (m1) return parseInt(m1[1]);

            // Method 3: plain-text pattern
            const m2 = html.match(/([\d,]+)\s*monthly\s*listeners/i);
            if (m2) return parseInt(m2[1].replace(/,/g, ''));
        } catch (_) { /* try next URL */ }
    }

    return null;
}

async function scrapePartnerAPI() {
    // Spotify's internal partner API — get a web token first, then query
    try {
        const tokenRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'App-Platform': 'WebPlayer',
            }
        });
        if (!tokenRes.ok) return null;
        const { accessToken } = await tokenRes.json();
        if (!accessToken) return null;

        const artistRes = await fetch(
            `https://api-partner.spotify.com/pathfinder/v1/query?operationName=queryArtistOverview&variables=%7B%22uri%22%3A%22spotify%3Aartist%3A${ARTIST_ID}%22%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22da986392124383571d4e3cc1c6c0d033a8bccbeffc5e6b44b14e5ce89d03bba0%22%7D%7D`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'App-Platform': 'WebPlayer',
                }
            }
        );
        if (!artistRes.ok) return null;
        const data = await artistRes.json();
        const ml = data?.data?.artistUnion?.stats?.monthlyListeners;
        if (ml) return parseInt(ml);
    } catch (_) { /* silently fail */ }
    return null;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { action, market } = req.query;

    try {
        if (action === 'artist') {
            // Cache for 5 minutes on Vercel edge
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
                res.status(artistRes.status).json({ error: `Spotify artist API: ${artistRes.status}`, detail: err });
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

        } else if (action === 'debug-ml') {
            // Temporary debug endpoint — remove after fixing
            const url = `https://open.spotify.com/artist/${ARTIST_ID}`;
            const pageRes = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept': 'text/html',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Mode': 'navigate',
                },
                redirect: 'follow',
            });
            const html = await pageRes.text();
            const hasInitialState = /<script id="initialState"/.test(html);
            const scriptTags = (html.match(/<script[^>]*id="[^"]*"[^>]*>/g) || []);
            let decodedSnippet = null;
            if (hasInitialState) {
                const m = html.match(/<script id="initialState"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/s);
                if (m) {
                    const decoded = Buffer.from(m[1].trim(), 'base64').toString('utf-8');
                    const idx = decoded.toLowerCase().indexOf('monthlylistener');
                    decodedSnippet = idx >= 0 ? decoded.slice(Math.max(0, idx - 30), idx + 80) : 'monthlyListeners NOT in decoded blob';
                }
            }

            res.status(200).json({
                pageStatus: pageRes.status,
                pageSize: html.length,
                hasInitialState,
                scriptTags,
                decodedSnippet,
            });

        } else {
            res.status(400).json({ error: 'Unknown action. Use: artist | top-tracks' });
        }
    } catch (e) {
        console.error('Spotify proxy error:', e);
        res.status(500).json({ error: e.message });
    }
}
