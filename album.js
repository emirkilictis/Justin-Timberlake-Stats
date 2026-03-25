// album.js — Dynamic album detail page

const MY_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : '';

const ALBUM_META = {
    "Justified": {
        year: 2002, color: "#5dade2",
        cover: "assets/justified.jpg",
        label: "Jive Records"
    },
    "FutureSex/LoveSounds": {
        year: 2006, color: "#e74c3c",
        cover: "assets/fsls.jpg",
        label: "Jive Records"
    },
    "The 20/20 Experience": {
        year: 2013, color: "#d4a853",
        cover: "assets/the20.jpg",
        label: "RCA Records"
    },
    "Man of the Woods": {
        year: 2018, color: "#e67e22",
        cover: "assets/motw.jpg",
        label: "RCA Records"
    },
    "Everything I Thought It Was": {
        year: 2024, color: "#ca510f",
        cover: "assets/eitiw.jpg",
        label: "RCA Records"
    }
};

// SONG_MAP: song-map.js'ten geliyor
const SONG_MAP = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};

// ── Kworb HTML Parser ─────────────────────────────────────────
function parseKworb(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tracks = [];
    const seen = new Set();

    let rows = doc.querySelectorAll('table.addpos tbody tr');
    if (rows.length === 0) rows = doc.querySelectorAll('table tbody tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 3) {
            const title = cols[0].textContent.trim();
            const total = parseInt(cols[1].textContent.replace(/,/g, ''), 10) || 0;
            const daily = parseInt(cols[2].textContent.replace(/,/g, ''), 10) || 0;
            if (title && !seen.has(title)) {
                seen.add(title);
                tracks.push({ title, total, daily });
            }
        }
    });
    return tracks;
}

// Filter kaldırıldı, tüm remiksler ve versiyonlar EAS'e dahil edilecek
// ── Match track → album ───────────────────────────────────────
function getAlbumTracks(allTracks, albumId) {
    const result = [];
    const usedIndices = new Set();

    allTracks.forEach((track, idx) => {
        if (usedIndices.has(idx)) return;
        const lower = track.title.toLowerCase();
        for (const key of Object.keys(SONG_MAP)) {
            if (lower.includes(key.toLowerCase())) {
                if (SONG_MAP[key] === albumId) {
                    usedIndices.add(idx);
                    result.push(track);
                }
                break;
            }
        }
    });

    return result.sort((a, b) => b.total - a.total);
}

// ── Number formatter ─────────────────────────────────────────
function fmt(n) {
    if (!n || isNaN(n)) return '—';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)         return Math.round(n / 1_000) + 'K';
    return n.toLocaleString('en-US');
}

// ── Render ────────────────────────────────────────────────────
function render(albumId, albumData, tracks) {
    const meta  = ALBUM_META[albumId];
    const color = meta.color;
    const ARTIST_RATIO = 1.82;

    // Apply era color CSS var
    document.documentElement.style.setProperty('--era-color', color);
    document.body.style.background =
        `radial-gradient(ellipse at 50% 0%, ${color}18 0%, #0a0a0a 55%)`;

    // Hero
    document.title = `JT | ${albumId}`;
    document.getElementById('hero-bg').style.backgroundImage = `url('${meta.cover}')`;
    document.getElementById('hero-cover').src = meta.cover;
    document.getElementById('hero-title').textContent = albumId;
    document.getElementById('hero-year').textContent =
        `${meta.year}  ·  ${meta.label}  ·  ${tracks.length} tracks on Spotify`;

    // Stats
    const physEAS  = albumData.physicalSinglesEAS || 0;
    const dlEAS    = albumData.digitalSinglesEAS  || 0;
    const physSales = Math.round(physEAS * 10 / 3);
    const dlSales   = Math.round(dlEAS   * 20 / 3);
    const spotifyStreams = tracks.reduce((s, t) => s + t.total, 0);
    const audioEAS = Math.floor((spotifyStreams * ARTIST_RATIO) / 1166);
    const videoEAS = Math.floor((albumData.streams?.youtube || 0) / 6750);
    const totalEAS = (albumData.pureSales || 0) + physEAS + dlEAS + audioEAS + videoEAS;

    const stats = [
        { label: 'Pure Sales',        value: fmt(albumData.pureSales), sub: 'album units' },
        { label: 'Physical Singles',  value: fmt(physSales),           sub: `≈ ${fmt(physEAS)} EAS` },
        { label: 'Download Singles',  value: fmt(dlSales),             sub: `≈ ${fmt(dlEAS)} EAS` },
        { label: 'Spotify Streams',   value: fmt(spotifyStreams),       sub: 'album total' },
        { label: 'Audio EAS',         value: fmt(audioEAS),            sub: 'from streams' },
        { label: 'Total EAS',         value: fmt(totalEAS),            sub: 'equivalent album sales' }
    ];

    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = stats.map(s => `
        <div class="stat-card">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value">${s.value}</div>
            <div class="stat-sub">${s.sub}</div>
        </div>
    `).join('');

    // Tracks
    const tbody = document.getElementById('track-tbody');
    if (tracks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:rgba(255,255,255,0.3);padding:40px;text-align:center;">No track data available</td></tr>`;
    } else {
        const maxTotal = tracks[0].total;
        tbody.innerHTML = tracks.map((t, i) => {
            let displayTitle = t.title;
            if (displayTitle.toUpperCase().includes("CAN'T STOP THE FEELING!") && !displayTitle.toUpperCase().includes("FILM VERSION")) {
                displayTitle = "CAN'T STOP THE FEELING!";
            }
            return `
            <tr>
                <td class="track-rank">${i + 1}</td>
                <td class="track-name">${displayTitle}</td>
                <td class="track-total">${fmt(t.total)}</td>
                <td class="track-daily">${t.daily > 0 ? '+' + t.daily.toLocaleString('en-US') : '—'}</td>
                <td class="track-bar-cell">
                    <div class="track-bar-bg">
                        <div class="track-bar-fill" style="width:${Math.round((t.total / maxTotal) * 100)}%"></div>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    document.getElementById('track-status').textContent =
        tracks.length > 0
            ? `${tracks.length} tracks · Live Kworb data`
            : 'Track data unavailable';

    document.getElementById('loading').style.display = 'none';
    document.getElementById('album-content').style.display = 'block';
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
    const params  = new URLSearchParams(window.location.search);
    const albumId = params.get('id');

    if (!albumId || !ALBUM_META[albumId]) {
        document.getElementById('loading').textContent = 'Album not found.';
        return;
    }

    try {
        const [dataRes, kworbRes] = await Promise.all([
            fetch('data.json'),
            MY_API ? fetch(MY_API) : Promise.resolve(null)
        ]);

        const data      = await dataRes.json();
        const albumData = data.albums[albumId] || {};

        let tracks = [];
        if (kworbRes && kworbRes.ok) {
            const html = await kworbRes.text();
            const all  = parseKworb(html);
            tracks     = getAlbumTracks(all, albumId);
        }

        render(albumId, albumData, tracks);
    } catch (e) {
        console.error(e);
        document.getElementById('loading').textContent = 'Failed to load data.';
    }
}

document.addEventListener('DOMContentLoaded', init);
