// album.js — Dynamic album detail page

const MY_API          = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API  : '';
const YT_API_KEY      = typeof CONFIG !== 'undefined' ? CONFIG.YOUTUBE_API_KEY : '';

async function fetchYouTubeViews(ids) {
    if (!ids || ids.length === 0) return 0;
    try {
        const res  = await fetch(`/api/youtube?ids=${ids.join(',')}`);
        const data = await res.json();
        return data.views || 0;
    } catch { return 0; }
}

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
    },
    "Orphan": {
        year: "Various", color: "#bdc3c7",
        cover: null,
        label: "Features / OST"
    }
};

// SONG_MAP: song-map.js'ten geliyor
const SONG_MAP = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};

const CURRENT_YEAR = new Date().getFullYear();
const YTD_BASELINE_DATE = `${CURRENT_YEAR}-01-01`;
const YTD_2026_BASELINE = {
    date: YTD_BASELINE_DATE,
    career_total: 16_804_299_514,
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
        "Love Sex Magic (feat. Justin Timberlake)": 93_373_624,
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
        "Not A Bad Thing - Radio Edit":      116_987_347
    }
};

function getTrackYTDBaseline(liveTitle) {
    // Hem canlı başlık hem anahtarlar aynı normalizasyondan geçmeli ("* " prefix'i,
    // "&" → "and"); aksi halde "Suit & Tie" gibi anahtarlar hiç tutmuyor.
    const lower = normalizeKworbTitle(liveTitle);
    for (const key in YTD_2026_BASELINE.tracks) {
        if (normalizeKworbTitle(key) === lower) {
            return YTD_2026_BASELINE.tracks[key];
        }
    }
    const keys = Object.keys(YTD_2026_BASELINE.tracks).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        const keyLower = normalizeKworbTitle(key);
        if (lower.includes(keyLower)) {
            if (keyLower === '4 minutes' && lower !== '4 minutes') {
                continue;
            }
            if (keyLower === 'love sex magic (feat. justin timberlake)' && lower !== 'love sex magic (feat. justin timberlake)') {
                continue;
            }
            return YTD_2026_BASELINE.tracks[key];
        }
    }
    return null;
}

function getTrueDailyAverage(dailyStreams) {
    const today = new Date().getDay();
    const dataDay = today === 0 ? 6 : today - 1;
    const dayWeights = { 0: 0.85, 1: 0.90, 2: 0.95, 3: 1.00, 4: 1.05, 5: 1.15, 6: 1.10 };
    return dailyStreams / dayWeights[dataDay];
}

function getYTDDaysElapsed() {
    const start = new Date(`${CURRENT_YEAR}-01-01T00:00:00Z`);
    const now   = new Date();
    return Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24)));
}

function getTrackFromSnapshot(trackTitle, snapshot) {
    if (!snapshot || !snapshot.tracks) return null;
    return snapshot.tracks[trackTitle] || null;
}

function calculateImprovedMilestone(track, snap7, snap30) {
    const hist7       = getTrackFromSnapshot(track.title, snap7);
    const hist30      = getTrackFromSnapshot(track.title, snap30);
    const ytdBaseline = getTrackYTDBaseline(track.title);
    const ytdDays     = getYTDDaysElapsed();

    let projectedDaily, confidence;
    const dailyEst = getTrueDailyAverage(track.daily || 0);

    let realWeeklyAvg = null;
    if (hist7 && track.total > hist7.total) {
        let delta = track.total - hist7.total;
        const expected = dailyEst * 7;
        const cap = Math.max(2_000_000, expected * 3);
        if (delta > cap) {
            delta = expected;
        }
        realWeeklyAvg = delta / 7;
    }

    let realMonthlyAvg = null;
    if (hist30 && track.total > hist30.total) {
        let delta = track.total - hist30.total;
        const expected = dailyEst * 30;
        const cap = Math.max(5_000_000, expected * 3);
        if (delta > cap) {
            delta = expected;
        }
        realMonthlyAvg = delta / 30;
    }

    let ytdAvg = null;
    if (ytdBaseline && track.total > ytdBaseline) {
        let delta = track.total - ytdBaseline;
        const expected = dailyEst * ytdDays;
        const cap = Math.max(10_000_000, expected * 3);
        if (delta > cap) {
            delta = expected;
        }
        ytdAvg = delta / ytdDays;
    }

    if (realWeeklyAvg !== null && realMonthlyAvg !== null) {
        if (ytdAvg !== null && ytdDays > 30) {
            projectedDaily = realWeeklyAvg * 0.5 + realMonthlyAvg * 0.3 + ytdAvg * 0.2;
        } else {
            projectedDaily = realWeeklyAvg * 0.6 + realMonthlyAvg * 0.4;
        }
        confidence = "high";
    } else if (realWeeklyAvg !== null) {
        projectedDaily = realWeeklyAvg;
        confidence = "medium";
    } else if (ytdAvg !== null) {
        projectedDaily = ytdAvg;
        confidence = "medium";
    } else {
        projectedDaily = dailyEst;
        confidence = "low";
    }

    if (projectedDaily <= 0 && track.daily > 0) {
        projectedDaily = dailyEst;
    }

    let nextMilestone;
    if (track.total >= 1000000000) {
        nextMilestone = Math.ceil(track.total / 100000000) * 100000000;
        if (nextMilestone === track.total) nextMilestone += 100000000;
    } else if (track.total >= 100000000) {
        nextMilestone = Math.ceil(track.total / 100000000) * 100000000;
        if (nextMilestone === track.total) nextMilestone += 100000000;
    } else if (track.total >= 10000000) {
        nextMilestone = Math.ceil(track.total / 10000000) * 10000000;
        if (nextMilestone === track.total) nextMilestone += 10000000;
    } else {
        nextMilestone = Math.ceil(track.total / 1000000) * 1000000;
        if (nextMilestone === track.total) nextMilestone += 1000000;
    }

    const remaining = nextMilestone - track.total;
    const daysLeft  = projectedDaily > 0 ? Math.ceil(remaining / projectedDaily) : null;

    return { target: nextMilestone, remaining, daysLeft, confidence, projectedDaily };
}

function formatCompact(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000)         return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return Number(n || 0).toLocaleString('en-US');
}

function formatMilestone(target, daysLeft) {
    const targetText = target >= 1_000_000_000
        ? (target / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
        : (target / 1_000_000).toFixed(0) + 'M';
    
    if (daysLeft === null || isNaN(daysLeft) || daysLeft <= 0) {
        return `<span style="color:#555;">N/A</span>`;
    }
    
    let timeText;
    if (daysLeft > 365) {
        const yrs = (daysLeft / 365).toFixed(1);
        timeText = `in ${yrs}y`;
    } else {
        timeText = `in ${daysLeft}d`;
    }
    return `<span style="font-weight:600;color:#d4a853;">${targetText}</span> <span style="font-size:0.75rem;color:#aaa;">(${timeText})</span>`;
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

    // 20/20 Part 1 sayfasında Part 2 şarkıları da göster
    const targetAlbums = albumId === "The 20/20 Experience"
        ? ["The 20/20 Experience", "The 20/20 Experience \u2013 2 of 2"]
        : [albumId];

    allTracks.forEach((track, idx) => {
        if (usedIndices.has(idx)) return;
        const lower = track.title.toLowerCase();
        for (const key of Object.keys(SONG_MAP)) {
            if (lower.includes(key.toLowerCase())) {
                if (targetAlbums.includes(SONG_MAP[key])) {
                    usedIndices.add(idx);
                    result.push(track);
                }
                break;
            }
        }
    });

    return result.sort((a, b) => b.total - a.total);
}

// ── Number formatter — yuvarlama yok, tam sayi ─────────────────
function fmt(n) {
    if (!n || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US');
}

// vault.json'dan ilgili albüme ait song-level YT ID'lerini topla
async function getCombinedYtIds(albumId, albumData) {
    const albumIds = albumData?.streams?.youtubeVideoIds || [];
    const combined = new Set(albumIds);
    try {
        const v = await (await fetch('data/vault.json')).json();
        for (const s of (v.songs || [])) {
            const ids = (s.streams && s.streams.youtubeVideoIds) || s.youtubeVideoIds;
            if (!ids || !ids.length) continue;
            let alb = s.album_id || 'Orphan';
            if (alb === 'The 20/20 Experience – 2 of 2') alb = 'The 20/20 Experience';
            if (alb === albumId) ids.forEach(id => combined.add(id));
        }
    } catch (e) { console.warn('vault yt id load failed', e); }
    return Array.from(combined);
}

// ── Render ────────────────────────────────────────────────────
function render(albumId, albumData, tracks, snap7, snap30) {
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

    // Calculate Album Projections based on its tracks
    const albumEoyProjected = tracks.reduce((sum, t) => {
        const milestone = calculateImprovedMilestone(t, snap7, snap30);
        const daysLeft = Math.max(0, Math.ceil((new Date(CURRENT_YEAR, 11, 31, 23, 59, 59) - new Date()) / 86400000));
        return sum + (t.total + milestone.projectedDaily * daysLeft);
    }, 0);
    const albumProjectedDaily = tracks.reduce((sum, t) => {
        const milestone = calculateImprovedMilestone(t, snap7, snap30);
        return sum + milestone.projectedDaily;
    }, 0);

    let nextMilestone;
    if (spotifyStreams >= 1000000000) {
        nextMilestone = Math.ceil(spotifyStreams / 500000000) * 500000000;
        if (nextMilestone === spotifyStreams) nextMilestone += 500000000;
    } else {
        nextMilestone = Math.ceil(spotifyStreams / 100000000) * 100000000;
        if (nextMilestone === spotifyStreams) nextMilestone += 100000000;
    }
    const remaining = nextMilestone - spotifyStreams;
    const daysToMilestone = albumProjectedDaily > 0 ? Math.ceil(remaining / albumProjectedDaily) : null;

    let milestoneSub;
    if (daysToMilestone !== null && daysToMilestone > 0) {
        if (daysToMilestone > 365) {
            milestoneSub = `in ${(daysToMilestone / 365).toFixed(1)}y (${remaining.toLocaleString('en-US')} needed)`;
        } else {
            milestoneSub = `in ${daysToMilestone} days (${remaining.toLocaleString('en-US')} needed)`;
        }
    } else {
        milestoneSub = 'N/A';
    }

    const stats = [
        { label: 'Pure Sales',        value: fmt(albumData.pureSales), sub: 'album units' },
        { label: 'Physical Singles',  value: fmt(physSales),           sub: `≈ ${fmt(physEAS)} EAS` },
        { label: 'Download Singles',  value: fmt(dlSales),             sub: `≈ ${fmt(dlEAS)} EAS` },
        { label: 'Spotify Streams',   value: fmt(spotifyStreams),       sub: 'album total' },
        { label: 'Audio EAS',         value: fmt(audioEAS),            sub: 'from streams' },
        { label: 'Total EAS',         value: fmt(totalEAS),            sub: 'equivalent album sales' },
        { label: 'Spotify EOY 2026 Proj.', value: `~${formatCompact(albumEoyProjected)}`, sub: `~${formatCompact(albumProjectedDaily)}/day projected` },
        { label: 'Next Spotify Milestone', value: formatCompact(nextMilestone), sub: milestoneSub }
    ];

    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = stats.map(s => `
        <div class="stat-card">
             <div class="stat-label">${s.label}</div>
             <div class="stat-value">${s.value}</div>
             <div class="stat-sub">${s.sub}</div>
        </div>
    `).join('');

    // Tracks — kworb-style basit tablo, bar yok, tam sayilar
    const tbody = document.getElementById('track-tbody');
    if (tracks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:rgba(255,255,255,0.3);padding:40px;text-align:center;">No track data available</td></tr>`;
    } else {
        tbody.innerHTML = tracks.map((t, i) => {
            let displayTitle = t.title;
            if (displayTitle.toUpperCase().includes("CAN'T STOP THE FEELING!") && !displayTitle.toUpperCase().includes("FILM VERSION")) {
                displayTitle = "CAN'T STOP THE FEELING!";
            }
            const milestone = calculateImprovedMilestone(t, snap7, snap30);
            const now = new Date();
            const yearEnd = new Date(CURRENT_YEAR, 11, 31, 23, 59, 59);
            const daysLeft = Math.max(0, Math.ceil((yearEnd - now) / 86400000));
            const eoyProjected = t.total + milestone.projectedDaily * daysLeft;

            const eoyCell = `<td style="color:#d4a853;font-weight:600;text-align:right;">~${formatCompact(eoyProjected)}</td>`;
            const milestoneCell = `<td style="text-align:right;">${formatMilestone(milestone.target, milestone.daysLeft)}</td>`;

            return `
            <tr>
                <td class="track-rank">${i + 1}</td>
                <td class="track-name" title="${displayTitle.replace(/"/g, '&quot;')}">${displayTitle}</td>
                <td class="track-total" style="text-align:right;">${fmt(t.total)}</td>
                <td class="track-daily" style="text-align:right;">${t.daily > 0 ? '+' + t.daily.toLocaleString('en-US') : '—'}</td>
                ${eoyCell}
                ${milestoneCell}
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

            // Merge extra tracks fallback
            const hasRadioEdit = all.some(t => t.title.toLowerCase().includes('not a bad thing') && t.title.toLowerCase().includes('radio edit'));
            if (!hasRadioEdit) {
                const baselineDate = '2026-05-24';
                const baselineTotal = 118_417_347;
                const dailyGrowth = 10_000;
                const days = Math.max(0, Math.round(
                    (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
                ));
                const radioStreams = baselineTotal + days * dailyGrowth;
                all.push({
                    title: 'Not A Bad Thing - Radio Edit',
                    total: radioStreams,
                    daily: dailyGrowth
                });
            }

            // normalizeKworbTitle "&" → "and" çevirdiği için Kworb'un hem
            // "and Timbaland" hem "& Timbaland" adlandırması burada yakalanır.
            const has4Min = all.some(t => {
                const n = normalizeKworbTitle(t.title);
                return n.includes('4 minutes') && n.includes('justin timberlake') && n.includes('and timbaland');
            });
            if (!has4Min) {
                const baselineDate = '2026-04-23';
                const baselineTotal = 102_400_000;
                const dailyGrowth = 120_000;
                const days = Math.max(0, Math.round(
                    (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
                ));
                const fourMinStreams = baselineTotal + days * dailyGrowth;
                all.push({
                    title: '4 Minutes (feat. Justin Timberlake and Timbaland)',
                    total: fourMinStreams,
                    daily: dailyGrowth
                });
            }

            const hasLSM = all.some(t => t.title.toLowerCase().includes('love sex magic'));
            if (!hasLSM) {
                const baselineDate = '2026-06-30';
                const baselineTotal = 96_685_624;
                const dailyGrowth = 17_965;
                const days = Math.max(0, Math.round(
                    (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
                ));
                const lsmStreams = baselineTotal + days * dailyGrowth;
                all.push({
                    title: 'Love Sex Magic (feat. Justin Timberlake)',
                    total: lsmStreams,
                    daily: dailyGrowth
                });
            }

            tracks     = getAlbumTracks(all, albumId);
        }

        // Live YouTube — data.json album-level + vault.json song-level birlestirilmis
        const ytIds = await getCombinedYtIds(albumId, albumData);
        if (ytIds.length > 0) {
            const liveYT = await fetchYouTubeViews(ytIds);
            if (liveYT > 0) {
                if (!albumData.streams) albumData.streams = {};
                albumData.streams.youtube = liveYT;
            }
        }

        // Firestore - snap7 & snap30
        const firestoreOk = await waitForFirestore();
        let snap7 = null;
        let snap30 = null;
        if (firestoreOk) {
            const [s7, s30] = await Promise.all([
                window.getHistoricalSnapshot(getUTCDateString(7)),
                window.getHistoricalSnapshot(getUTCDateString(30))
            ]);
            snap7 = s7;
            snap30 = s30;
        }

        render(albumId, albumData, tracks, snap7, snap30);
    } catch (e) {
        console.error(e);
        document.getElementById('loading').textContent = 'Failed to load data.';
    }
}

document.addEventListener('DOMContentLoaded', init);
