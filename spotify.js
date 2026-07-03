// spotify.js — Frontend Spotify module
// All requests go through /api/spotify (Vercel serverless) to avoid CORS.

const SpotifyAPI = (() => {
    const BASE = '/api/spotify';

    return {
        /** Artist info — monthly_listeners (scraped from open.spotify.com) */
        getArtist: () =>
            fetch(`${BASE}?action=artist`).then(r => {
                if (!r.ok) throw new Error(`Spotify artist: ${r.status}`);
                return r.json();
            }),
    };
})();
