// --- 1. AYARLAR VE MAPPING ---
let MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";

// songToAlbumMap: song-map.js'ten geliyor (SONG_TO_ALBUM_MAP)
const songToAlbumMap = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};

const albumMetData = {
    "Justified": { year: 2002 },
    "FutureSex/LoveSounds": { year: 2006 },
    "The 20/20 Experience": { year: 2013 },
    "The 20/20 Experience \u2013 2 of 2": { year: 2013 },
    "Man of the Woods": { year: 2018 },
    "Everything I Thought It Was": { year: 2024 },
    "Orphan": { year: "Various" }
};

// ── YTD Baseline — yıl değişince sadece bu objeyi güncelle ────
const CURRENT_YEAR = new Date().getFullYear();
const YTD_BASELINE_DATE = `${CURRENT_YEAR}-01-01`;
const YTD_2026_BASELINE = {
    date: YTD_BASELINE_DATE,
    career_total: 16_687_312_167,
    tracks: {
        "CAN'T STOP THE FEELING! (from":  1_997_165_198,
        "FEELING! - Film Version":           136_996_989,
        "True Colors - Film Version":        108_384_944,
        "True Colors":                       209_699_774,
        "Mirrors":                         1_404_622_163,
        "SexyBack":                        1_283_973_094,
        "Rock Your Body":                    949_485_070,
        "Cry Me a River":                    743_635_610,
        "My Love":                           667_235_675,
        "Say Something":                     562_371_672,
        "What Goes Around":                  550_091_404,
        "Give It To Me":                     471_587_284,
        "4 Minutes":                         469_728_383,
        "Love Never Felt So Good":           436_341_531,
        "Ayo Technology":                    388_645_139,
        "Holy Grail":                        378_980_701,
        "Dead And Gone":                     315_775_819,
        "Suit & Tie":                        287_653_213,
        "Summer Love":                       276_004_796,
        "Señorita":                          238_919_223,
        "Carry Out":                         235_999_425,
        "The Other Side":                    189_469_777,
        "Signs":                             168_780_778,
        "Stay With Me":                      159_831_181,
        "Selfish":                           152_257_794,
        "Like I Love You":                   130_249_781,
        "Filthy":                            126_475_446,
        "Better Place":                      121_159_121,
    }
};

// ── Modül Durumu (Sort + Cached Data) ─────────────────────────
let _tracksData   = [];   // { title, total, daily, real7d, real7dEst, real30d, real30dEst, ytd }
let _albumsData   = [];   // { id, year, total, daily, real7d, pctDaily }
let _jtTotalDaily = 0;
let trackSort = { col: 'total', asc: false };
let albumSort = { col: 'total', asc: false };
let _trackSearchQuery = '';

window._trackSearch = function(val) {
    _trackSearchQuery = val.trim().toLowerCase();
    renderTracksTable();
};

const eraColors = {
    "Justified": "#5dade2", "FutureSex/LoveSounds": "#e74c3c",
    "The 20/20 Experience": "#fce98a", "The 20/20 Experience \u2013 2 of 2": "#c0962e",
    "Man of the Woods": "#ca6f1e",
    "Everything I Thought It Was": "#f39c12", "Orphan": "#bdc3c7"
};

const albumCovers = {
    "Justified": "assets/justified.jpg", "FutureSex/LoveSounds": "assets/fsls.jpg",
    "The 20/20 Experience": "assets/the20.jpg", "The 20/20 Experience \u2013 2 of 2": "assets/the20pt2.jpg",
    "Man of the Woods": "assets/motw.jpg",
    "Everything I Thought It Was": "assets/eitiw.jpg", "Orphan": null
};

// --- 2. YARDIMCI FONKSİYONLAR ---

function getTrackYTDBaseline(liveTitle) {
    const lower = liveTitle.toLowerCase();
    for (const key in YTD_2026_BASELINE.tracks) {
        if (lower.includes(key.toLowerCase())) {
            return YTD_2026_BASELINE.tracks[key];
        }
    }
    return null;
}

function fmtNum(n) {
    if (window.innerWidth >= 768) return n.toLocaleString('en-US');
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)         return Math.round(n / 1_000) + 'K';
    return String(n);
}
function fmtDelta(n) { return '+' + fmtNum(n); }

function getYTDDaysElapsed() {
    const start = new Date(`${CURRENT_YEAR}-01-01T00:00:00Z`);
    const now   = new Date();
    return Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24)));
}

function formatCompact(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)         return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
}

function animateValue(obj, start, end, duration, prefix = "") {
    if (!obj || isNaN(end)) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = prefix + current.toLocaleString('en-US');
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function getTrueDailyAverage(dailyStreams) {
    const today = new Date().getDay();
    const dataDay = today === 0 ? 6 : today - 1;
    const dayWeights = { 0: 0.85, 1: 0.90, 2: 0.95, 3: 1.00, 4: 1.05, 5: 1.15, 6: 1.10 };
    return dailyStreams / dayWeights[dataDay];
}

function getUTCDateString(daysAgo = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

function waitForFirestore(timeoutMs = 6000) {
    return new Promise(resolve => {
        if (typeof window.getHistoricalSnapshot === 'function') { resolve(true); return; }
        const timer = setTimeout(() => resolve(false), timeoutMs);
        window.addEventListener('firestore-ready', () => {
            clearTimeout(timer);
            resolve(true);
        }, { once: true });
    });
}

function getTrackFromSnapshot(trackTitle, snapshot) {
    if (!snapshot || !snapshot.tracks) return null;
    return snapshot.tracks[trackTitle] || null;
}

function getAlbumFromSnapshot(albumName, snapshot) {
    if (!snapshot || !snapshot.albums) return null;
    return snapshot.albums[albumName] || null;
}

// ── Milestone Hesaplayıcı ──────────────────────────────────────
function calculateImprovedMilestone(track, snap7, snap30) {
    const hist7       = getTrackFromSnapshot(track.title, snap7);
    const hist30      = getTrackFromSnapshot(track.title, snap30);
    const ytdBaseline = getTrackYTDBaseline(track.title);
    const ytdDays     = getYTDDaysElapsed();

    let projectedDaily, confidence;

    if (hist7 && hist30 && track.total > hist7.total && track.total > hist30.total) {
        const realWeeklyAvg  = (track.total - hist7.total)  / 7;
        const realMonthlyAvg = (track.total - hist30.total) / 30;
        if (ytdBaseline && track.total > ytdBaseline && ytdDays > 30) {
            const ytdAvg = (track.total - ytdBaseline) / ytdDays;
            projectedDaily = realWeeklyAvg * 0.5 + realMonthlyAvg * 0.3 + ytdAvg * 0.2;
        } else {
            projectedDaily = realWeeklyAvg * 0.6 + realMonthlyAvg * 0.4;
        }
        confidence = "high";
    } else if (hist7 && track.total > hist7.total) {
        projectedDaily = (track.total - hist7.total) / 7;
        confidence = "medium";
    } else if (ytdBaseline && track.total > ytdBaseline) {
        projectedDaily = (track.total - ytdBaseline) / ytdDays;
        confidence = "medium";
    } else {
        projectedDaily = getTrueDailyAverage(track.daily);
        confidence = "low";
    }

    let nextMilestone;
    if (track.total >= 1000000000) {
        nextMilestone = Math.ceil(track.total / 1000000000) * 1000000000;
        if (nextMilestone === track.total) nextMilestone += 1000000000;
    } else {
        nextMilestone = Math.ceil(track.total / 500000000) * 500000000;
        if (nextMilestone === track.total) nextMilestone += 500000000;
    }

    const remaining = nextMilestone - track.total;
    const daysLeft  = projectedDaily > 0 ? Math.ceil(remaining / projectedDaily) : null;

    return { target: nextMilestone, remaining, daysLeft, confidence, projectedDaily };
}

// --- 3. AKILLI PARSER ---
function analyzeKworbData(htmlInput) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlInput, 'text/html');
    const rows = doc.querySelectorAll('table.addpos tbody tr');

    let stats = {
        TotalSpotify: 0,
        TotalDaily: 0,
        "Justified": { total: 0, daily: 0 },
        "FutureSex/LoveSounds": { total: 0, daily: 0 },
        "The 20/20 Experience": { total: 0, daily: 0 },
        "The 20/20 Experience \u2013 2 of 2": { total: 0, daily: 0 },
        "Man of the Woods": { total: 0, daily: 0 },
        "Everything I Thought It Was": { total: 0, daily: 0 },
        "Orphan": { total: 0, daily: 0 },
        tracks: []
    };

    const tables = doc.querySelectorAll('table');
    if (tables.length > 0) {
        const tds = tables[0].querySelectorAll('td');
        if (tds[1]) stats.TotalSpotify = parseInt(tds[1].textContent.replace(/,/g, ''), 10) || 0;
        if (tds[6]) stats.TotalDaily   = parseInt(tds[6].textContent.replace(/,/g, ''), 10) || 0;
    }

    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 3) {
            let title = cols[0].textContent.trim();
            let lowerTitle = title.toLowerCase();
            let valTotal = parseInt(cols[1].textContent.replace(/,/g, ''), 10) || 0;
            let valDaily = parseInt(cols[2].textContent.replace(/,/g, ''), 10) || 0;

            stats.tracks.push({ title, total: valTotal, daily: valDaily });

            let matched = false;
            for (let key in songToAlbumMap) {
                if (lowerTitle.includes(key.toLowerCase())) {
                    let albName = songToAlbumMap[key];
                    if (stats[albName]) {
                        stats[albName].total += valTotal;
                        stats[albName].daily += valDaily;
                    }
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                stats["Orphan"].total += valTotal;
                stats["Orphan"].daily += valDaily;
            }
        }
    });

    return stats;
}

// --- 4. TABLE RENDERERS ---

function renderTracksTable() {
    const tbody = document.getElementById('streams-table-body');
    if (!tbody) return;

    const sorted = [..._tracksData].sort((a, b) => {
        const dir = trackSort.asc ? 1 : -1;
        switch (trackSort.col) {
            case 'title':  return dir * a.title.localeCompare(b.title);
            case 'total':  return dir * (a.total - b.total);
            case 'daily':  return dir * (a.daily - b.daily);
            case 'real7d': return dir * ((a.real7d  ?? -Infinity) - (b.real7d  ?? -Infinity));
            case 'real30d':return dir * ((a.real30d ?? -Infinity) - (b.real30d ?? -Infinity));
            case 'ytd':    return dir * ((a.ytd     ?? -Infinity) - (b.ytd     ?? -Infinity));
            default: return 0;
        }
    });

    const filtered = _trackSearchQuery
        ? sorted.filter(t => t.title.toLowerCase().includes(_trackSearchQuery))
        : sorted.slice(0, 15);

    const countEl = document.getElementById('track-count');
    if (countEl) {
        if (_trackSearchQuery) {
            countEl.textContent = `${filtered.length} of ${_tracksData.length} tracks`;
        } else {
            countEl.textContent = `Top 15 of ${_tracksData.length} tracks — search to explore all`;
        }
    }

    tbody.innerHTML = '';
    filtered.forEach(track => {
        let real7Cell, real30Cell, ytdCell;

        if (track.real7d !== null && !track.real7dEst) {
            real7Cell = `<td class="positive-trend">${fmtDelta(track.real7d)}</td>`;
        } else if (track.real7d !== null && track.real7dEst) {
            real7Cell = `<td style="color:#d4a853;font-style:italic;" title="Estimated">~${fmtNum(track.real7d)}</td>`;
        } else {
            real7Cell = `<td style="color:#555;">—</td>`;
        }

        if (track.real30d !== null && !track.real30dEst) {
            real30Cell = `<td class="positive-trend">${fmtDelta(track.real30d)}</td>`;
        } else if (track.real30d !== null && track.real30dEst) {
            real30Cell = `<td style="color:#d4a853;font-style:italic;" title="Estimated">~${fmtNum(track.real30d)}</td>`;
        } else {
            real30Cell = `<td style="color:#555;">—</td>`;
        }

        if (track.ytd !== null) {
            ytdCell = `<td style="color:#a78bfa;font-weight:600;">${fmtDelta(track.ytd)}</td>`;
        } else {
            ytdCell = `<td style="color:#555;">—</td>`;
        }

        const tr = document.createElement('tr');
        
        let displayTitle = track.title;
        if (displayTitle.toUpperCase().includes("CAN'T STOP THE FEELING!") && !displayTitle.toUpperCase().includes("FILM VERSION")) {
            displayTitle = "CAN'T STOP THE FEELING!";
        }

        tr.innerHTML = `
            <td>${displayTitle}</td>
            <td>${fmtNum(track.total)}</td>
            <td class="positive-trend">${fmtDelta(track.daily)}</td>
            ${real7Cell}${real30Cell}${ytdCell}
        `;
        tbody.appendChild(tr);
    });

    // Sort indicator güncelle
    const table = document.getElementById('tracks-table');
    if (table) {
        table.querySelectorAll('thead th[data-sort-col]').forEach(th => {
            const col = th.dataset.sortCol;
            const label = th.dataset.label;
            if (col === trackSort.col) {
                th.textContent = label + (trackSort.asc ? ' ▲' : ' ▼');
                th.style.color = '#fff';
            } else {
                th.textContent = label;
                th.style.color = '';
            }
        });
    }
}

function renderAlbumsTable() {
    const tbody = document.getElementById('album-table-body');
    if (!tbody) return;

    const sorted = [..._albumsData].sort((a, b) => {
        const dir = albumSort.asc ? 1 : -1;
        switch (albumSort.col) {
            case 'name': return dir * a.id.localeCompare(b.id);
            case 'year': {
                const ya = isNaN(Number(a.year)) ? 9999 : Number(a.year);
                const yb = isNaN(Number(b.year)) ? 9999 : Number(b.year);
                return dir * (ya - yb);
            }
            case 'total':  return dir * (a.total - b.total);
            case 'daily':  return dir * (a.daily - b.daily);
            case 'real7d': return dir * ((a.real7d ?? -Infinity) - (b.real7d ?? -Infinity));
            case 'pct':    return dir * (a.pctDaily - b.pctDaily);
            default: return 0;
        }
    });

    tbody.innerHTML = '';
    sorted.forEach(album => {
        if (album.id === 'Orphan') return; // Leaderboard'da gösterme, pie chart'ta kalır

        const barColor  = eraColors[album.id] || "#d4a853";
        const imgSrc    = albumCovers[album.id];
        const thumbHTML = imgSrc
            ? `<img src="${imgSrc}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;">`
            : `<div style="width:40px;height:40px;border-radius:4px;background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);flex-shrink:0;"></div>`;

        let weekly7Cell;
        if (album.real7d !== null) {
            weekly7Cell = `<td class="positive-trend" style="vertical-align:middle;">${fmtDelta(album.real7d)}</td>`;
        } else {
            weekly7Cell = `<td style="vertical-align:middle;color:#555;">—</td>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display:flex;align-items:center;gap:12px;">
                    ${thumbHTML}
                    <div>
                        <div style="font-weight:700;color:#fff;">${album.id}</div>
                        <div style="width:100%;height:4px;background:rgba(255,255,255,0.05);margin-top:8px;border-radius:2px;overflow:hidden;">
                            <div style="width:${album.pctDaily}%;height:100%;background:${barColor};box-shadow:0 0 10px ${barColor};border-radius:2px;transition:width 1.5s ease-out;"></div>
                        </div>
                    </div>
                </div>
            </td>
            <td style="vertical-align:middle;">${album.year}</td>
            <td style="vertical-align:middle;">${fmtNum(album.total)}</td>
            <td class="positive-trend" style="vertical-align:middle;">${fmtDelta(album.daily)}</td>
            ${weekly7Cell}
            <td style="vertical-align:middle;color:${barColor};font-weight:700;">${album.pctDaily.toFixed(1)}%</td>
        `;
        tbody.appendChild(tr);
    });

    // Sort indicator güncelle
    const table = document.getElementById('album-leaderboard-table');
    if (table) {
        table.querySelectorAll('thead th[data-sort-col]').forEach(th => {
            const col = th.dataset.sortCol;
            const label = th.dataset.label;
            if (col === albumSort.col) {
                th.textContent = label + (albumSort.asc ? ' ▲' : ' ▼');
                th.style.color = '#fff';
            } else {
                th.textContent = label;
                th.style.color = '';
            }
        });
    }
}

// ── Sort Click Handler Bağlayıcı ──────────────────────────────
function attachSortHandlers() {
    // Tracks tablosu
    const tracksTable = document.getElementById('tracks-table');
    if (tracksTable) {
        tracksTable.querySelectorAll('thead th[data-sort-col]').forEach(th => {
            th.style.cursor = 'pointer';
            th.title = 'Sıralamak için tıkla';
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (trackSort.col === col) {
                    trackSort.asc = !trackSort.asc;
                } else {
                    trackSort.col = col;
                    trackSort.asc = false;
                }
                renderTracksTable();
            });
        });
    }

    // Albums tablosu
    const albumsTable = document.getElementById('album-leaderboard-table');
    if (albumsTable) {
        albumsTable.querySelectorAll('thead th[data-sort-col]').forEach(th => {
            th.style.cursor = 'pointer';
            th.title = 'Sıralamak için tıkla';
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (albumSort.col === col) {
                    albumSort.asc = !albumSort.asc;
                } else {
                    albumSort.col = col;
                    albumSort.asc = false;
                }
                renderAlbumsTable();
            });
        });
    }
}

// --- 5. TREND CHART ---

let trendChartInst = null;

function buildTrendChart(snapshots, liveTotal) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    // Veri noktaları: YTD baseline + Firestore snapshots + bugün (canlı)
    const points = [];

    // Firestore snapshot'ları filtrele ve sırala
    snapshots.forEach(s => {
        if (s && s.career_total && s.date) {
            points.push({ date: s.date, value: s.career_total });
        }
    });

    // Kronolojik sırala, bugünü sona ekle
    points.sort((a, b) => a.date.localeCompare(b.date));
    points.push({ date: getUTCDateString(0) + ' (live)', value: liveTotal });

    // Eğer Firestore'da hiç veri yoksa sadece YTD baseline + bugünü göster
    if (points.length < 2) {
        points.unshift({ date: YTD_2026_BASELINE.date, value: YTD_2026_BASELINE.career_total });
    }

    const noDataMsg = document.getElementById('trend-no-data');

    if (points.length < 2) {
        if (noDataMsg) noDataMsg.style.display = 'block';
        canvas.style.display = 'none';
        return;
    }
    if (noDataMsg) noDataMsg.style.display = 'none';
    canvas.style.display = 'block';

    const labels = points.map(p => p.date);
    const values = points.map(p => p.value);

    // Renk gradyanı
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0,   'rgba(212,168,83,0.35)');
    gradient.addColorStop(1,   'rgba(212,168,83,0.00)');

    const accentColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-bronze').trim() || '#d4a853';

    if (trendChartInst) trendChartInst.destroy();
    trendChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Career Total Streams',
                data: values,
                borderColor: accentColor,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: points.length <= 5 ? 5 : 3,
                pointBackgroundColor: accentColor,
                pointBorderColor: '#050505',
                pointBorderWidth: 2,
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(5,5,5,0.9)',
                    borderColor: accentColor + '66',
                    borderWidth: 1,
                    titleColor: accentColor,
                    bodyColor: '#fff',
                    callbacks: {
                        label: ctx => ' ' + ctx.parsed.y.toLocaleString('en-US') + ' streams'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#666',
                        font: { family: "'Space Grotesk', sans-serif", size: 10 },
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 10
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                },
                y: {
                    ticks: {
                        color: '#666',
                        font: { family: "'Space Grotesk', sans-serif", size: 10 },
                        callback: v => (v / 1_000_000_000).toFixed(2) + 'B'
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                }
            }
        }
    });
}

// Era değişince chart renklerini güncelle
document.addEventListener('eraChanged', () => {
    if (!trendChartInst) return;
    const c = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-bronze').trim() || '#d4a853';
    const ds = trendChartInst.data.datasets[0];
    ds.borderColor = c;
    ds.pointBackgroundColor = c;
    // Gradient yerine solid fill (gradient canvas'a bağlı, renk değişince yeniden oluşturmak gerekir)
    ds.backgroundColor = c + '33';
    trendChartInst.options.plugins.tooltip.borderColor = c + '66';
    trendChartInst.options.plugins.tooltip.titleColor  = c;
    trendChartInst.update('none');
});

// --- 6. ANA YÜKLEYİCİ ---

async function initStreamsDashboard() {
    try {
        // ── ADIM A: Canlı veriyi çek ─────────────────────────────────
        const res = await fetch(MY_DYNAMIC_API);
        const html = await res.text();
        const liveStats = analyzeKworbData(html);

        const jtTotalCareer  = document.getElementById('jt-total-career');
        const jtDailyCareer  = document.getElementById('jt-daily-career');
        const radarGrid      = document.getElementById('milestone-radar');

        const allAlbums = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "The 20/20 Experience \u2013 2 of 2", "Man of the Woods", "Everything I Thought It Was", "Orphan"];

        // TOP SECTION — canlı rakamlar
        _jtTotalDaily = liveStats.TotalDaily || 0;

        animateValue(jtTotalCareer, 0, liveStats.TotalSpotify, 2000);
        animateValue(jtDailyCareer, 0, _jtTotalDaily, 2000, "+");

        // ── ADIM B: Firestore — snap7, snap30 ve trend verileri ──────
        const firestoreOk = await waitForFirestore();
        let snap7  = null;
        let snap30 = null;
        let trendSnapshots = [];

        if (firestoreOk) {
            // snap7 + snap30 + son 30 günün snapshot'larını paralel çek
            const trendDays = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30 gün öncesi
            const [s7, s30, ...trendResults] = await Promise.all([
                window.getHistoricalSnapshot(getUTCDateString(7)),
                window.getHistoricalSnapshot(getUTCDateString(30)),
                ...trendDays.map(d => window.getHistoricalSnapshot(getUTCDateString(d)))
            ]);
            snap7  = s7;
            snap30 = s30;
            trendSnapshots = trendResults.filter(Boolean);
        }

        // ── ADIM C: Büyüme kartları ───────────────────────────────────
        function setGrowthCard(valueId, statusId, snapshot, label, days) {
            const valueEl  = document.getElementById(valueId);
            const statusEl = document.getElementById(statusId);
            if (!valueEl) return;

            const dailyEst = Math.round(_jtTotalDaily * days);
            const maxReasonable = _jtTotalDaily * days * 2;

            if (snapshot && snapshot.career_total) {
                const delta = liveStats.TotalSpotify - snapshot.career_total;
                if (delta > 0 && delta <= maxReasonable) {
                    // Snapshot delta makul — gerçek veriyi göster
                    valueEl.textContent = '+' + delta.toLocaleString('en-US');
                    valueEl.classList.remove('loading');
                    if (statusEl) { statusEl.textContent = 'Snapshot: ' + snapshot.date; statusEl.classList.add('ok'); }
                } else {
                    // Snapshot delta tutarsız — daily rate'ten hesapla
                    valueEl.textContent = '+' + dailyEst.toLocaleString('en-US');
                    valueEl.classList.remove('loading');
                    valueEl.style.color = '#d4a853';
                    if (statusEl) { statusEl.textContent = `Based on ${_jtTotalDaily.toLocaleString('en-US')}/day avg`; statusEl.classList.add('ok'); }
                }
            } else {
                // Snapshot yok — daily rate'ten hesapla
                valueEl.textContent = '+' + dailyEst.toLocaleString('en-US');
                valueEl.classList.remove('loading');
                valueEl.style.color = '#d4a853';
                if (statusEl) { statusEl.textContent = `Based on ${_jtTotalDaily.toLocaleString('en-US')}/day avg`; statusEl.classList.add('ok'); }
            }
        }

        setGrowthCard('jt-weekly-growth',  'snap7-status',  snap7,  '7d',  7);
        setGrowthCard('jt-monthly-growth', 'snap30-status', snap30, '30d', 30);

        // YTD: statik baseline
        const ytdEl     = document.getElementById('jt-ytd-growth');
        const ytdStatus = document.getElementById('snapytd-status');
        const ytdDelta  = liveStats.TotalSpotify - YTD_2026_BASELINE.career_total;
        const ytdDays   = getYTDDaysElapsed();
        if (ytdEl) { ytdEl.textContent = '+' + ytdDelta.toLocaleString('en-US'); ytdEl.classList.remove('loading'); }
        if (ytdStatus) {
            ytdStatus.textContent = `Since Jan 1 · ${ytdDays} days · ~${Math.round(ytdDelta / ytdDays).toLocaleString()}/day avg`;
            ytdStatus.classList.add('ok');
        }

        // ── ADIM D: Album verisi oluştur ──────────────────────────────
        _albumsData = allAlbums.map(id => {
            const album = liveStats[id];
            const pctDaily = _jtTotalDaily > 0 ? (album.daily / _jtTotalDaily) * 100 : 0;
            const hist7Album = getAlbumFromSnapshot(id, snap7);
            const real7d = (hist7Album && album.total > hist7Album.total)
                ? album.total - hist7Album.total
                : null;
            return {
                id,
                year: albumMetData[id].year,
                total: album.total,
                daily: album.daily,
                real7d,
                pctDaily
            };
        });
        renderAlbumsTable();

        // ── ADIM E: Track verisi oluştur ──────────────────────────────
        _tracksData = liveStats.tracks.map(track => {
            const hist7Track  = getTrackFromSnapshot(track.title, snap7);
            const hist30Track = getTrackFromSnapshot(track.title, snap30);
            const ytdBaseline = getTrackYTDBaseline(track.title);

            let real7d = null, real7dEst = false;
            if (hist7Track && track.total > hist7Track.total) {
                real7d = track.total - hist7Track.total;
            } else {
                real7d = Math.floor(getTrueDailyAverage(track.daily) * 7);
                real7dEst = true;
            }

            let real30d = null, real30dEst = false;
            if (hist30Track && track.total > hist30Track.total) {
                real30d = track.total - hist30Track.total;
            } else {
                real30d = Math.floor(getTrueDailyAverage(track.daily) * 30);
                real30dEst = true;
            }

            const ytd = (ytdBaseline && track.total > ytdBaseline)
                ? track.total - ytdBaseline
                : null;

            return { title: track.title, total: track.total, daily: track.daily, real7d, real7dEst, real30d, real30dEst, ytd };
        });
        renderTracksTable();

        // ── ADIM F: Sort handler'larını bağla ─────────────────────────
        attachSortHandlers();

        // ── ADIM G: Milestone Radar ───────────────────────────────────
        if (radarGrid) {
            radarGrid.innerHTML = '';
            const confidenceNote = document.getElementById('milestone-confidence-note');
            let highCount = 0;

            liveStats.tracks.slice(0, 10).forEach(track => {
                if (track.daily <= 10000) return;
                const milestone = calculateImprovedMilestone(track, snap7, snap30);
                if (milestone.confidence === 'high') highCount++;

                const targetText = milestone.target >= 1000000000
                    ? (milestone.target / 1000000000) + "B"
                    : (milestone.target / 1000000) + "M";
                const daysDisplay = milestone.daysLeft !== null ? milestone.daysLeft.toLocaleString() + ' Days' : 'N/A';

                let etaText = '';
                if (milestone.daysLeft !== null) {
                    const etaDate = new Date();
                    etaDate.setDate(etaDate.getDate() + milestone.daysLeft);
                    etaText = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }

                const confidenceBadge = `<span class="confidence-badge confidence-${milestone.confidence}">${milestone.confidence}</span>`;
                const card = document.createElement('div');
                card.className = "milestone-card";
                
                let displayTitle = track.title;
                if (displayTitle.toUpperCase().includes("CAN'T STOP THE FEELING!") && !displayTitle.toUpperCase().includes("FILM VERSION")) {
                    displayTitle = "CAN'T STOP THE FEELING!";
                }

                card.innerHTML = `
                    <div style="font-size:0.8rem;color:#888;text-transform:uppercase;margin-bottom:6px;">Countdown to ${targetText} ${confidenceBadge}</div>
                    <div style="font-size:1.2rem;font-weight:700;margin:10px 0;">${displayTitle}</div>
                    <div style="font-size:2rem;color:#d4a853;">${daysDisplay}</div>
                    <div style="font-size:0.85rem;color:#aaa;margin-top:5px;">
                        Needs ${(milestone.remaining / 1000000).toFixed(1)}M more
                        ${etaText ? `· ETA: <span style="color:#fff;">${etaText}</span>` : ''}
                    </div>
                    <div style="font-size:0.75rem;color:#555;margin-top:4px;">~${Math.round(milestone.projectedDaily).toLocaleString()} streams/day projected</div>
                `;
                radarGrid.appendChild(card);
            });

            if (confidenceNote) {
                if (snap7 && snap30) {
                    confidenceNote.textContent = `${highCount} of 10 tracks have high-confidence predictions (real 7d + 30d data).`;
                    confidenceNote.style.color = '#4ade80';
                } else {
                    confidenceNote.textContent = 'Estimated only — historical snapshots will populate after first script run.';
                }
            }
        }

        // ── ADIM H: Doughnut Chart ────────────────────────────────────
        const doughnutCanvas = document.getElementById('albumShareChart');
        if (doughnutCanvas) {
            const ctx = doughnutCanvas.getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "20/20 Pt. 2", "Man of the Woods", "EITIW", "Orphan"],
                    datasets: [{
                        data: allAlbums.map(id => liveStats[id].total),
                        backgroundColor: allAlbums.map(id => eraColors[id]),
                        borderColor: '#050505',
                        borderWidth: 2,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: window.innerWidth < 768 ? 'bottom' : 'right',
                            labels: {
                                color: '#fff',
                                font: { family: "'Space Grotesk', sans-serif", size: 11 },
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label.length > 20 && window.innerWidth < 768) label = label.substring(0, 17) + '...';
                                    if (label) label += ': ';
                                    if (context.raw !== null) label += new Intl.NumberFormat('en-US').format(context.raw);
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }

        // ── ADIM I: Trend Line Chart ──────────────────────────────────
        buildTrendChart(trendSnapshots, liveStats.TotalSpotify);

    } catch (e) {
        console.error("Dashboard yüklenemedi:", e);
        const radarGrid = document.getElementById('milestone-radar');
        if (radarGrid) radarGrid.innerHTML = "Failed to load dynamic data. Check console.";
    }
}

// --- 7. SHARE CARD ---

const RANDOM_PICS = [
    'assets/random%20pics/IMG_7431.JPG', 'assets/random%20pics/IMG_7432.JPG',
    'assets/random%20pics/IMG_7433.JPG', 'assets/random%20pics/IMG_7435.JPG',
    'assets/random%20pics/IMG_7436.JPG', 'assets/random%20pics/IMG_7437.JPG',
    'assets/random%20pics/IMG_7438.JPG', 'assets/random%20pics/IMG_7439.JPG',
    'assets/random%20pics/IMG_7440.JPG', 'assets/random%20pics/IMG_7441.JPG',
    'assets/random%20pics/IMG_7442.JPG', 'assets/random%20pics/IMG_7443.JPG',
];

// Canlı veriden share card'ı doldur ve göster
window.generateShareCard = function() {
    const btn = document.getElementById('generate-card-btn');
    const wrapper = document.getElementById('share-card-wrapper');

    if (!_tracksData.length) {
        btn.textContent = 'Loading data...';
        setTimeout(() => { btn.textContent = 'Generate Card'; }, 2000);
        return;
    }

    const dailyEl = document.getElementById('jt-daily-career');
    document.getElementById('sc-daily').textContent = dailyEl ? dailyEl.textContent : '—';

    // Top Daily Track — o gün en yüksek daily stream'e sahip şarkı
    const topDaily = [..._tracksData].sort((a, b) => b.daily - a.daily)[0];
    if (topDaily) {
        let displayTopTitle = topDaily.title;
        if (displayTopTitle.toUpperCase().includes("CAN'T STOP THE FEELING!") && !displayTopTitle.toUpperCase().includes("FILM VERSION")) {
            displayTopTitle = "CAN'T STOP THE FEELING!";
        }
        document.getElementById('sc-top-track').textContent = displayTopTitle;
        document.getElementById('sc-top-track-total').textContent = '+' + topDaily.daily.toLocaleString('en-US');
    }

    // Tarih
    document.getElementById('sc-date').textContent = new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });

    // Rastgele fotoğraf — arka plan olarak göster
    const randomPic = RANDOM_PICS[Math.floor(Math.random() * RANDOM_PICS.length)];
    const scImg = document.getElementById('sc-photo');
    const scOverlay = document.getElementById('sc-overlay');
    const scHeaderGap = document.getElementById('sc-header-gap');
    if (scImg) {
        scImg.src = randomPic;
        scImg.style.display = 'block';
        if (scOverlay) scOverlay.style.display = 'block';
        // Fotoğraf varsa üst boşluğu artır (resmin görünmesi için)
        if (scHeaderGap) scHeaderGap.style.marginBottom = '130px';
    }

    wrapper.style.display = 'block';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.downloadCard = function() {
    const card = document.getElementById('share-card');
    if (!card || typeof html2canvas === 'undefined') return;

    html2canvas(card, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        useCORS: true,
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'jt-stats-' + new Date().toISOString().split('T')[0] + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

window.tweetStats = function() {
    const totalEl = document.getElementById('jt-total-career');
    const dailyEl = document.getElementById('jt-daily-career');
    const topDaily = [..._tracksData].sort((a, b) => b.daily - a.daily)[0];
    const ytdEl = document.getElementById('jt-ytd-growth');

    const total = totalEl ? totalEl.textContent : '?';
    const daily = dailyEl ? dailyEl.textContent : '?';
    const track = topDaily ? `${topDaily.title} (+${topDaily.daily.toLocaleString('en-US')})` : '';
    const ytd = ytdEl ? ytdEl.textContent : '';

    const text = `Justin Timberlake Spotify Stats 🎵\n\n` +
        `🌍 Total: ${total}\n` +
        `📈 Today: ${daily}\n` +
        `🔥 Top Daily: ${track}\n` +
        `📅 ${CURRENT_YEAR} YTD: ${ytd}\n\n` +
        `#JustinTimberlake #Spotify`;

    window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(text), '_blank');
};

// --- 8. SPOTIFY DATA ---

async function loadSpotifyArtistData() {
    const monthlyEl   = document.getElementById('jt-spotify-monthly');
    const followersEl = document.getElementById('jt-spotify-followers');
    const popularityEl= document.getElementById('jt-spotify-popularity');
    const statusEl    = document.getElementById('jt-spotify-status');

    if (typeof SpotifyAPI === 'undefined') return;

    try {
        const artist = await SpotifyAPI.getArtist();

        const monthly    = artist.monthly_listeners;
        const followers  = artist.followers?.total ?? 0;
        const popularity = artist.popularity ?? 0;

        if (monthly && monthlyEl)   monthlyEl.textContent = formatCompact(monthly);
        else if (monthlyEl)         monthlyEl.textContent = '—';

        if (followersEl)  followersEl.textContent = followers.toLocaleString('en-US');
        if (popularityEl) popularityEl.textContent = popularity;
        if (statusEl)     statusEl.textContent = '● Live';
    } catch (e) {
        console.warn('Spotify artist fetch failed:', e.message);
        const monthlyEl = document.getElementById('jt-spotify-monthly');
        if (monthlyEl) monthlyEl.textContent = '—';
        if (statusEl)  statusEl.textContent = 'unavailable';
    }
}

// ── Country Top Tracks ────────────────────────────────────────
const _countryCache = {};
let   _activeMarket = 'US';

async function loadCountryTracks(market) {
    market = market.toUpperCase().slice(0, 2);
    if (!/^[A-Z]{2}$/.test(market)) return;
    _activeMarket = market;

    // Update tab highlights
    document.querySelectorAll('.ctry-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.market === market);
    });

    const container = document.getElementById('country-tracks-body');
    if (!container) return;

    // Show cached instantly if available
    if (_countryCache[market]) {
        renderCountryTracks(_countryCache[market], container);
        return;
    }

    container.innerHTML = '<div style="text-align:center;color:#333;padding:28px;font-size:0.82rem;">Loading ' + market + '...</div>';

    try {
        const data   = await SpotifyAPI.getTopTracks(market);
        const tracks = data.tracks ?? [];
        // Sort by popularity descending
        tracks.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        _countryCache[market] = tracks;
        if (_activeMarket === market) renderCountryTracks(tracks, container);
    } catch (e) {
        if (_activeMarket === market) {
            container.innerHTML = '<div style="text-align:center;color:#555;padding:28px;font-size:0.82rem;">Failed to load ' + market + ' data.</div>';
        }
    }
}

function renderCountryTracks(tracks, container) {
    if (!tracks.length) {
        container.innerHTML = '<div style="text-align:center;color:#555;padding:28px;">No data for this market.</div>';
        return;
    }

    container.innerHTML = tracks.map((t, i) => {
        const popularity = t.popularity ?? 0;
        const pctText    = popularity + '%';
        const barWidth   = popularity + '%';
        const barColor   = popularity >= 80 ? '#1DB954' : popularity >= 60 ? '#d4a853' : '#555';
        const mins  = Math.floor((t.duration_ms || 0) / 60000);
        const secs  = String(Math.floor(((t.duration_ms || 0) % 60000) / 1000)).padStart(2, '0');
        const cover = t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || '';
        const explicit = t.explicit ? '<span style="font-size:0.58rem;background:rgba(255,255,255,0.08);color:#888;padding:1px 4px;border-radius:3px;margin-left:6px;">E</span>' : '';

        return `
        <div class="country-track-row">
            <div style="width:22px;text-align:right;font-size:0.75rem;color:#444;flex-shrink:0;">${i + 1}</div>
            ${cover ? `<img src="${cover}" width="36" height="36" style="border-radius:4px;flex-shrink:0;" alt="" loading="lazy">` : '<div style="width:36px;height:36px;background:rgba(255,255,255,0.04);border-radius:4px;flex-shrink:0;"></div>'}
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.82rem;color:rgba(255,255,255,0.8);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.name}${explicit}</div>
                <div style="font-size:0.68rem;color:#444;margin-top:2px;">${t.album?.name ?? ''}</div>
            </div>
            <div style="width:130px;flex-shrink:0;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:0.65rem;color:#3a3a3a;">Popularity</span>
                    <span style="font-size:0.72rem;font-weight:700;color:${barColor};">${pctText}</span>
                </div>
                <div style="height:3px;background:rgba(255,255,255,0.05);border-radius:2px;">
                    <div style="height:3px;width:${barWidth};background:${barColor};border-radius:2px;transition:width 0.3s;"></div>
                </div>
            </div>
            <div style="width:38px;text-align:right;font-size:0.75rem;color:#444;flex-shrink:0;">${mins}:${secs}</div>
        </div>`;
    }).join('');
}

function attachCountryTabHandlers() {
    // Tab buttons
    document.getElementById('country-tabs')?.addEventListener('click', e => {
        const btn = e.target.closest('.ctry-btn');
        if (btn) loadCountryTracks(btn.dataset.market);
    });

    // Country search input
    const searchInput = document.getElementById('country-search');
    if (searchInput) {
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const code = searchInput.value.trim().toUpperCase();
                if (/^[A-Z]{2}$/.test(code)) {
                    loadCountryTracks(code);
                    searchInput.value = '';
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initStreamsDashboard();
    loadSpotifyArtistData();
    attachCountryTabHandlers();
    if (typeof SpotifyAPI !== 'undefined') loadCountryTracks('US');
});
