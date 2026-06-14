// api/youtube.js — YouTube views proxy to bypass client-side referer restrictions
const fs = require('fs');
const path = require('path');

let YOUTUBE_API_KEY = "";
try {
    const configPath = path.join(__dirname, '..', 'config.js');
    if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const match = content.match(/YOUTUBE_API_KEY\s*:\s*["']([^"']+)["']/);
        if (match) {
            YOUTUBE_API_KEY = match[1];
        }
    }
} catch (e) {
    console.error('Failed to parse config.js in serverless:', e);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Parse URL parameters
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const idsParam = url.searchParams.get('ids');

    if (!idsParam) {
        return res.status ? res.status(400).json({ error: 'Missing ids parameter' }) : res.writeHead(400).end(JSON.stringify({ error: 'Missing ids parameter' }));
    }

    const ids = idsParam.split(',').filter(id => id.trim().length > 0);
    if (ids.length === 0) {
        return res.status ? res.json({ views: 0 }) : res.end(JSON.stringify({ views: 0 }));
    }

    if (!YOUTUBE_API_KEY) {
        return res.status ? res.status(500).json({ error: 'YOUTUBE_API_KEY not configured on server' }) : res.writeHead(500).end(JSON.stringify({ error: 'YOUTUBE_API_KEY not configured on server' }));
    }

    let totalViews = 0;
    const chunkSize = 45; // YouTube limits to 50 IDs per request
    try {
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`;
            const apiRes = await fetch(apiUrl, {
                headers: {
                    'Referer': 'https://justin-timberlake-stats.vercel.app/'
                }
            });
            const data = await apiRes.json();
            if (data.items) {
                totalViews += data.items.reduce((sum, item) => sum + (parseInt(item.statistics.viewCount) || 0), 0);
            } else if (data.error) {
                console.error('YouTube API error:', data.error);
                if (res.status) {
                    return res.status(500).json({ error: data.error.message });
                } else {
                    res.writeHead(500);
                    return res.end(JSON.stringify({ error: data.error.message }));
                }
            }
        }
        if (res.status) {
            return res.json({ views: totalViews });
        } else {
            return res.end(JSON.stringify({ views: totalViews }));
        }
    } catch (e) {
        if (res.status) {
            return res.status(500).json({ error: e.message });
        } else {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: e.message }));
        }
    }
};
