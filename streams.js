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
    const lower = liveTitle.toLowerCase().trim();
    // Try exact match first
    for (const key in YTD_2026_BASELINE.tracks) {
        if (key.toLowerCase().trim() === lower) {
            return YTD_2026_BASELINE.tracks[key];
        }
    }
    // Try fuzzy match, checking longer keys first to ensure specific matches win
    const keys = Object.keys(YTD_2026_BASELINE.tracks).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        const keyLower = key.toLowerCase().trim();
        if (lower.includes(keyLower)) {
            // Special rule for '4 minutes'
            if (keyLower === '4 minutes' && lower !== '4 minutes') {
                continue;
            }
            return YTD_2026_BASELINE.tracks[key];
        }
    }
    return null;
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString('en-US');
}
function fmtDelta(n) { return '+' + fmtNum(n); }

function getYTDDaysElapsed() {
    const start = new Date(`${CURRENT_YEAR}-01-01T00:00:00Z`);
    const now   = new Date();
    return Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24)));
}

// Sadece monthly listeners icin kompakt format ("53.8M" gibi)
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

// Bir track snapshot'ta YOKKEN büyümesini tahmin ederken kullanılan günlük tavan.
// Hiçbir JT parçası gerçekte günde ~600k'yı geçmez (CSTF ~541k). Bu tavan, Neon/Kworb'dan
// gelen tek seferlik zehirli `daily` değerlerinin (çok günlük boşluk, count düzeltmesi,
// estimate↔gerçek geçişi) yıl sonu projeksiyonunu milyarlara fırlatmasını engeller.
const MAX_TRACK_DAILY_EST = 1_000_000;

function getCleanSnapshotDelta(liveStats, snapshot, days) {
    if (!snapshot) return null;
    let cleanDelta = 0;
    
    if (snapshot.tracks && Object.keys(snapshot.tracks).length > 0) {
        liveStats.tracks.forEach(track => {
            const trackTitleLower = track.title.toLowerCase().trim();
            let snapTrack = snapshot.tracks[track.title];
            if (!snapTrack) {
                const foundKey = Object.keys(snapshot.tracks).find(k => k.toLowerCase().trim() === trackTitleLower);
                if (foundKey) {
                    snapTrack = snapshot.tracks[foundKey];
                }
            }
            
            if (snapTrack && typeof snapTrack.total === 'number') {
                let trackDelta = track.total - snapTrack.total;
                if (trackDelta < 0) trackDelta = 0;

                const dailyEst = getTrueDailyAverage(track.daily || 0);
                const expectedGrowth = dailyEst * days;
                const maxReasonable = Math.max(2_000_000 * (days / 7), expectedGrowth * 3);

                if (trackDelta > maxReasonable) {
                    console.warn(`[Snapshot Anomaly] Track: "${track.title}", Delta: ${trackDelta}, Max Reasonable: ${maxReasonable}. Estimating growth: ${expectedGrowth}`);
                    trackDelta = expectedGrowth;
                }
                cleanDelta += Math.round(trackDelta);
            } else {
                // If it is NOT in the snapshot, estimate its growth to avoid 118M jumps
                const dailyEst = Math.min(getTrueDailyAverage(track.daily || 0), MAX_TRACK_DAILY_EST);
                cleanDelta += Math.max(0, Math.round(dailyEst * days));
            }
        });
        return cleanDelta;
    }
    
    // Fallback: If snapshot has no track data, use career total delta, but cap it to something reasonable
    const rawDelta = liveStats.TotalSpotify - (snapshot.career_total || 0);
    const maxReasonable = (liveStats.TotalDaily || 3000000) * days * 2;
    if (rawDelta > 0 && rawDelta <= maxReasonable) {
        return rawDelta;
    }
    return Math.round((liveStats.TotalDaily || 3000000) * days);
}

function getCleanYTDDelta(liveStats) {
    let cleanDelta = 0;
    const ytdDays = getYTDDaysElapsed();
    
    liveStats.tracks.forEach(track => {
        const baseline = getTrackYTDBaseline(track.title);
        if (baseline !== null) {
            let trackDelta = track.total - baseline;
            if (trackDelta < 0) trackDelta = 0;

            const dailyEst = getTrueDailyAverage(track.daily || 0);
            const expectedGrowth = dailyEst * ytdDays;
            const maxReasonable = Math.max(5_000_000 * (ytdDays / 7), expectedGrowth * 3);

            if (trackDelta > maxReasonable) {
                console.warn(`[YTD Anomaly] Track: "${track.title}", Delta: ${trackDelta}, Max Reasonable: ${maxReasonable}. Estimating YTD growth: ${expectedGrowth}`);
                trackDelta = expectedGrowth;
            }
            cleanDelta += Math.round(trackDelta);
        } else {
            // Track was not in the baseline.
            // If it is a new release in CURRENT_YEAR, we assume it had 0 streams on Jan 1.
            let isNewRelease = false;
            const lowerTitle = track.title.toLowerCase();
            for (let key in songToAlbumMap) {
                if (lowerTitle.includes(key.toLowerCase())) {
                    const albName = songToAlbumMap[key];
                    if (albumMetData[albName] && albumMetData[albName].year === CURRENT_YEAR) {
                        isNewRelease = true;
                    }
                    break;
                }
            }
            if (isNewRelease) {
                cleanDelta += track.total;
            } else {
                // Otherwise, it's an old song newly tracked, so we estimate its YTD growth
                const dailyEst = Math.min(getTrueDailyAverage(track.daily || 0), MAX_TRACK_DAILY_EST);
                cleanDelta += Math.max(0, Math.round(dailyEst * ytdDays));
            }
        }
    });
    return cleanDelta;
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

// ── Year-End 2026 Projection ───────────────────────────────────
function renderEOYProjection(liveStats, snap7, snap30) {
    const totalEl   = document.getElementById('eoy-total');
    if (!totalEl) return;

    const addNoteEl   = document.getElementById('eoy-add-note');
    const ytdEl       = document.getElementById('eoy-ytd');
    const ytdSubEl    = document.getElementById('eoy-ytd-sub');
    const dailyEl     = document.getElementById('eoy-daily-rate');
    const confEl      = document.getElementById('eoy-confidence');
    const confNoteEl  = document.getElementById('eoy-conf-note');
    const pctLabel    = document.getElementById('eoy-pct-label');
    const daysLeftEl  = document.getElementById('eoy-days-left');
    const progressBar = document.getElementById('eoy-progress-bar');

    const careerTotal = liveStats.TotalSpotify;
    const ytdDays     = getYTDDaysElapsed();
    const ytdDelta    = getCleanYTDDelta(liveStats);

    // Year progress
    const now      = new Date();
    const yearEnd  = new Date(CURRENT_YEAR, 11, 31, 23, 59, 59);
    const yearStart= new Date(CURRENT_YEAR, 0, 1);
    const totalYearDays = Math.ceil((yearEnd - yearStart) / 86400000);
    const daysLeft = Math.max(0, Math.ceil((yearEnd - now) / 86400000));
    const yearPct  = ((totalYearDays - daysLeft) / totalYearDays * 100);

    // Compute weighted projected daily rate
    const ytdAvg    = ytdDays > 0 ? ytdDelta / ytdDays : 0;
    const cleanWeeklyDelta = getCleanSnapshotDelta(liveStats, snap7, 7);
    const cleanMonthlyDelta = getCleanSnapshotDelta(liveStats, snap30, 30);
    const weeklyAvg  = cleanWeeklyDelta !== null ? cleanWeeklyDelta / 7 : null;
    const monthlyAvg = cleanMonthlyDelta !== null ? cleanMonthlyDelta / 30 : null;

    let projectedDaily, confidence, confNote;
    if (ytdAvg > 0 && monthlyAvg !== null && weeklyAvg !== null) {
        projectedDaily = ytdAvg * 0.5 + monthlyAvg * 0.4 + weeklyAvg * 0.1;
        confidence = "high";
        confNote = "YTD + 30d + 7d";
    } else if (ytdAvg > 0 && monthlyAvg !== null) {
        projectedDaily = ytdAvg * 0.6 + monthlyAvg * 0.4;
        confidence = "medium";
        confNote = "YTD + 30d";
    } else if (ytdAvg > 0) {
        projectedDaily = ytdAvg;
        confidence = "low";
        confNote = "YTD only";
    } else {
        projectedDaily = liveStats.TotalDaily || 0;
        confidence = "low";
        confNote = "Live daily fallback";
    }

    // Project EOY total
    const projectedAdd = projectedDaily * daysLeft;
    const projectedEOY = careerTotal + projectedAdd;
    const projectedYearTotal = ytdDelta + projectedAdd;

    // Format helpers
    const fmtB = n => (n / 1e9).toFixed(2) + 'B';
    const fmtM = n => (n / 1e6).toFixed(1) + 'M';
    const fmtBig = n => n >= 1e9 ? fmtB(n) : fmtM(n);

    // Render
    totalEl.textContent = fmtB(projectedEOY);
    if (addNoteEl) addNoteEl.innerHTML =
        `+${fmtBig(projectedAdd)} expected in next ${daysLeft.toLocaleString()} days · ` +
        `<span style="color:rgba(255,255,255,0.4);">${fmtBig(projectedYearTotal)} total in 2026</span>`;
    if (ytdEl) ytdEl.textContent = fmtBig(projectedYearTotal);
    if (ytdSubEl) ytdSubEl.textContent =
        `${fmtBig(ytdDelta)} earned · +${fmtBig(projectedAdd)} projected`;
    if (dailyEl) dailyEl.textContent = '+' + Math.round(projectedDaily).toLocaleString();

    if (confEl) {
        confEl.textContent = confidence;
        confEl.style.color = confidence === 'high'   ? '#4ade80'
                            : confidence === 'medium' ? '#d4a853'
                            : '#888';
    }
    if (confNoteEl) confNoteEl.textContent = confNote;

    if (pctLabel) pctLabel.textContent = `${yearPct.toFixed(1)}% of ${CURRENT_YEAR} elapsed`;
    if (daysLeftEl) daysLeftEl.textContent = `${daysLeft.toLocaleString()} days remaining`;
    if (progressBar) {
        // Trigger animation
        setTimeout(() => { progressBar.style.width = yearPct + '%'; }, 100);
    }
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
            case 'eoy':    return dir * (a.eoyProjected - b.eoyProjected);
            case 'milestone': {
                const da = a.milestone.daysLeft === null ? Infinity : a.milestone.daysLeft;
                const db = b.milestone.daysLeft === null ? Infinity : b.milestone.daysLeft;
                return dir * (da - db);
            }
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

        const eoyCell = `<td style="color:#d4a853;font-weight:600;">~${formatCompact(track.eoyProjected)}</td>`;
        const milestoneCell = `<td>${formatMilestone(track.milestone.target, track.milestone.daysLeft)}</td>`;

        const tr = document.createElement('tr');
        
        let displayTitle = track.title;
        if (displayTitle.toUpperCase().includes("CAN'T STOP THE FEELING!") && !displayTitle.toUpperCase().includes("FILM VERSION")) {
            displayTitle = "CAN'T STOP THE FEELING!";
        }

        tr.innerHTML = `
            <td>${displayTitle}</td>
            <td>${fmtNum(track.total)}</td>
            <td class="positive-trend">${fmtDelta(track.daily)}</td>
            ${real7Cell}${real30Cell}${ytdCell}${eoyCell}${milestoneCell}
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
            case 'eoy':    return dir * (a.eoyProjected - b.eoyProjected);
            case 'milestone': {
                const da = a.daysToMilestone === null ? Infinity : a.daysToMilestone;
                const db = b.daysToMilestone === null ? Infinity : b.daysToMilestone;
                return dir * (da - db);
            }
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
            weekly7Cell = `<td style="vertical-align:middle;color:#555;">—</td>
            `;
        }

        const eoyCell = `<td style="color:#d4a853;font-weight:600;vertical-align:middle;">~${formatCompact(album.eoyProjected)}</td>`;
        const milestoneCell = `<td style="vertical-align:middle;">${formatMilestone(album.nextMilestone, album.daysToMilestone)}</td>`;

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
            <td style="vertical-align:middle;text-align:center;">${album.year}</td>
            <td style="vertical-align:middle;">${fmtNum(album.total)}</td>
            <td class="positive-trend" style="vertical-align:middle;">${fmtDelta(album.daily)}</td>
            ${weekly7Cell}
            <td style="vertical-align:middle;color:${barColor};font-weight:700;">${album.pctDaily.toFixed(1)}%</td>
            ${eoyCell}
            ${milestoneCell}
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

        // ── ADIM B: Firestore — snap7, snap30 ve trend verileri ──────
        const firestoreOk = await waitForFirestore();
        let snap7  = null;
        let snap30 = null;
        let snapToday = null;
        let trendSnapshots = [];

        if (firestoreOk) {
            // snap7 + snap30 + bugün + son 30 günün snapshot'larını paralel çek
            const trendDays = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30 gün öncesi
            const [s7, s30, sToday, ...trendResults] = await Promise.all([
                window.getHistoricalSnapshot(getUTCDateString(7)),
                window.getHistoricalSnapshot(getUTCDateString(30)),
                window.getHistoricalSnapshot(getUTCDateString(0)),
                ...trendDays.map(d => window.getHistoricalSnapshot(getUTCDateString(d)))
            ]);
            snap7  = s7;
            snap30 = s30;
            snapToday = sToday;
            trendSnapshots = trendResults.filter(Boolean);
        }

        // Kworb'da JT credit'i kalkan track'leri Firestore'dan merge et.
        // daily-snapshot.js Madonna gibi diger artist sayfalarindan cekip yaziyor;
        // canli parser (analyzeKworbData) JT'nin sayfasina bakiyor, onlari goremez.
        const liveTitles = new Set(liveStats.tracks.map(t => t.title.toLowerCase()));
        let has4Min = false;
        let hasRadioEdit = false;
        if (snapToday && snapToday.tracks) {
            for (const [title, vals] of Object.entries(snapToday.tracks)) {
                if (liveTitles.has(title.toLowerCase())) continue;
                const total = Number(vals.total) || 0;
                const daily = Number(vals.daily) || 0;
                liveStats.tracks.push({ title, total, daily });
                liveStats.TotalSpotify += total;
                liveStats.TotalDaily   += daily;
                const lc = title.toLowerCase();
                if (lc.includes('4 minutes') && lc.includes('and timbaland')) {
                    has4Min = true;
                }
                if (lc.includes('not a bad thing') && lc.includes('radio edit')) {
                    hasRadioEdit = true;
                }
                let matched = false;
                for (const key in songToAlbumMap) {
                    if (title.toLowerCase().includes(key.toLowerCase())) {
                        const albName = songToAlbumMap[key];
                        if (liveStats[albName]) {
                            liveStats[albName].total += total;
                            liveStats[albName].daily += daily;
                        }
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    liveStats['Orphan'].total += total;
                    liveStats['Orphan'].daily += daily;
                }
            }
        }
        // Canlı + snapshot birleştikten sonra KESİN kontrol: track herhangi bir kaynaktan
        // (canlı Kworb ya da Firestore snapshot) geldiyse fallback enjeksiyonuna gerek yok.
        // Yukarıdaki döngü liveTitles'taki track'lerde `continue` ettiği için bu bayrakları
        // kaçırıyordu → track canlı/snapshot'ta varken fallback ikinci kez ~118M enjekte
        // edip career total'i ve projeksiyonu bozuyordu. Tüm merge edilmiş listeyi tarıyoruz.
        has4Min      = liveStats.tracks.some(t => { const lc = t.title.toLowerCase(); return lc.includes('4 minutes') && lc.includes('and timbaland'); });
        hasRadioEdit = liveStats.tracks.some(t => { const lc = t.title.toLowerCase(); return lc.includes('not a bad thing') && lc.includes('radio edit'); });

        // Fallback: Firestore'da "4 Minutes ... and Timbaland" varyantlari yoksa
        if (!has4Min) {
            const baselineDate = '2026-04-23';
            const baselineTotal = 102_400_000;  // 97.9M + 1.9M + 1.5M + 1.0M
            const dailyGrowth = 120_000;
            const days = Math.max(0, Math.round(
                (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
            ));
            const fbTotal = baselineTotal + days * dailyGrowth;
            liveStats.tracks.push({
                title: '4 Minutes (feat. Justin Timberlake and Timbaland)',
                total: fbTotal,
                daily: dailyGrowth
            });
            liveStats.TotalSpotify += fbTotal;
            liveStats.TotalDaily   += dailyGrowth;
            liveStats['Orphan'].total += fbTotal;
            liveStats['Orphan'].daily += dailyGrowth;
            console.log(`[streams.js fallback] +${fbTotal.toLocaleString('en-US')} for 4 Minutes (no Firestore data)`);
        }

        // Fallback: Firestore'da "Not A Bad Thing - Radio Edit" varyantlari yoksa
        if (!hasRadioEdit) {
            const baselineDate = '2026-05-24';
            const baselineTotal = 118_417_347;
            const dailyGrowth = 1_500;
            const days = Math.max(0, Math.round(
                (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
            ));
            const fbTotal = baselineTotal + days * dailyGrowth;
            liveStats.tracks.push({
                title: 'Not A Bad Thing - Radio Edit',
                total: fbTotal,
                daily: dailyGrowth
            });
            liveStats.TotalSpotify += fbTotal;
            liveStats.TotalDaily   += dailyGrowth;
            
            const albName = "The 20/20 Experience \u2013 2 of 2";
            if (liveStats[albName]) {
                liveStats[albName].total += fbTotal;
                liveStats[albName].daily += dailyGrowth;
            } else {
                liveStats['Orphan'].total += fbTotal;
                liveStats['Orphan'].daily += dailyGrowth;
            }
            console.log(`[streams.js fallback] +${fbTotal.toLocaleString('en-US')} for Not A Bad Thing - Radio Edit (no Firestore data)`);
        }

        // TOP SECTION — animasyonu artik dogru deger ile baslat (extra track'ler merge edildi)
        _jtTotalDaily = liveStats.TotalDaily || 0;
        animateValue(jtTotalCareer, 0, liveStats.TotalSpotify, 2000);
        animateValue(jtDailyCareer, 0, _jtTotalDaily, 2000, "+");

        // ── ADIM C: Büyüme kartları ───────────────────────────────────
        function setGrowthCard(valueId, statusId, snapshot, label, days) {
            const valueEl  = document.getElementById(valueId);
            const statusEl = document.getElementById(statusId);
            if (!valueEl) return;

            const dailyEst = Math.round(_jtTotalDaily * days);
            const cleanDelta = getCleanSnapshotDelta(liveStats, snapshot, days);

            if (cleanDelta !== null) {
                valueEl.textContent = '+' + cleanDelta.toLocaleString('en-US');
                valueEl.classList.remove('loading');
                if (statusEl) { statusEl.textContent = 'Snapshot: ' + snapshot.date; statusEl.classList.add('ok'); }
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
        const ytdDelta  = getCleanYTDDelta(liveStats);
        const ytdDays   = getYTDDaysElapsed();
        if (ytdEl) { ytdEl.textContent = '+' + ytdDelta.toLocaleString('en-US'); ytdEl.classList.remove('loading'); }
        if (ytdStatus) {
            ytdStatus.textContent = `Since Jan 1 · ${ytdDays} days · ~${Math.round(ytdDelta / ytdDays).toLocaleString()}/day avg`;
            ytdStatus.classList.add('ok');
        }

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

            const milestone = calculateImprovedMilestone(track, snap7, snap30);
            const now = new Date();
            const yearEnd = new Date(CURRENT_YEAR, 11, 31, 23, 59, 59);
            const daysLeft = Math.max(0, Math.ceil((yearEnd - now) / 86400000));
            const eoyProjected = track.total + milestone.projectedDaily * daysLeft;

            return { 
                title: track.title, 
                total: track.total, 
                daily: track.daily, 
                real7d, 
                real7dEst, 
                real30d, 
                real30dEst, 
                ytd, 
                eoyProjected, 
                milestone 
            };
        });
        renderTracksTable();

        // ── ADIM D: Album verisi oluştur ──────────────────────────────
        _albumsData = allAlbums.map(id => {
            const album = liveStats[id];
            const pctDaily = _jtTotalDaily > 0 ? (album.daily / _jtTotalDaily) * 100 : 0;
            const hist7Album = getAlbumFromSnapshot(id, snap7);
            const real7d = (hist7Album && album.total > hist7Album.total)
                ? album.total - hist7Album.total
                : null;

            // Find all tracks belonging to this album
            const albumTracks = _tracksData.filter(t => {
                const lowerTitle = t.title.toLowerCase();
                for (const key in songToAlbumMap) {
                    if (lowerTitle.includes(key.toLowerCase())) {
                        return songToAlbumMap[key] === id;
                    }
                }
                return id === 'Orphan'; // fallback to orphan if no other album matched
            });

            // Sum up track projections
            const eoyProjected = albumTracks.reduce((sum, t) => sum + t.eoyProjected, 0);
            const albumProjectedDaily = albumTracks.reduce((sum, t) => sum + t.milestone.projectedDaily, 0);

            // Calculate milestone target and days left
            let nextMilestone;
            if (album.total >= 1000000000) {
                nextMilestone = Math.ceil(album.total / 500000000) * 500000000;
                if (nextMilestone === album.total) nextMilestone += 500000000;
            } else {
                nextMilestone = Math.ceil(album.total / 100000000) * 100000000;
                if (nextMilestone === album.total) nextMilestone += 100000000;
            }
            const remaining = nextMilestone - album.total;
            const daysToMilestone = albumProjectedDaily > 0 ? Math.ceil(remaining / albumProjectedDaily) : null;

            return {
                id,
                year: albumMetData[id].year,
                total: album.total,
                daily: album.daily,
                real7d,
                pctDaily,
                eoyProjected,
                albumProjectedDaily,
                nextMilestone,
                daysToMilestone
            };
        });
        renderAlbumsTable();

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

        // ── ADIM G2: Year-End 2026 Projection ────────────────────────
        renderEOYProjection(liveStats, snap7, snap30);

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

        // ── ADIM I: AOD + YouTube hero cards ─────────────────────────
        const ARTIST_RATIO = 1.82;
        const totalAOD = Math.round(liveStats.TotalSpotify * ARTIST_RATIO);
        const aodEl = document.getElementById('jt-total-aod');
        if (aodEl) aodEl.textContent = (totalAOD / 1e9).toFixed(2) + 'B';

        // YouTube — data.json album-level + vault.json song-level ID'lerini BİRLEŞTİR, /api/youtube'a gönder.
        // ÖNEMLİ: Homepage (script.js getCombinedYtIds) ikisini de birleştiriyor; aynı toplamı
        // vermesi için burada da vault.json song-level ID'lerini dahil ediyoruz (yoksa ~1B fark çıkıyor).
        // Non-blocking: dashboard render'ını bekletmesin, gelince hero card'ı güncellesin.
        (async () => {
            try {
                const [dataJson, vaultJson] = await Promise.all([
                    fetch('data.json').then(r => r.json()),
                    fetch('data/vault.json').then(r => r.json()).catch(() => ({ songs: [] }))
                ]);
                const allIds = new Set();
                for (const alb of Object.values(dataJson.albums)) {
                    const ids = (alb.streams && alb.streams.youtubeVideoIds) || [];
                    ids.forEach(id => allIds.add(id));
                }
                for (const s of (vaultJson.songs || [])) {
                    const ids = (s.streams && s.streams.youtubeVideoIds) || s.youtubeVideoIds || [];
                    ids.forEach(id => allIds.add(id));
                }
                if (allIds.size > 0) {
                    const ytRes = await fetch(`/api/youtube?ids=${[...allIds].join(',')}`);
                    const ytData = await ytRes.json();
                    const ytTotal = ytData.views || 0;
                    const ytEl = document.getElementById('jt-total-youtube');
                    if (ytEl) ytEl.textContent = (ytTotal / 1e9).toFixed(2) + 'B';
                }
            } catch (e) {
                console.warn('[streams.js] YouTube views fetch failed:', e.message);
            }
        })();

        // ── ADIM J: Trend Line Chart ──────────────────────────────────
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

    const careerEl = document.getElementById('jt-total-career');
    document.getElementById('sc-career').textContent = careerEl ? careerEl.textContent : '—';

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
    const statusEl    = document.getElementById('jt-spotify-status');

    if (typeof SpotifyAPI === 'undefined') return;

    try {
        const artist = await SpotifyAPI.getArtist();
        const monthly = artist.monthly_listeners;

        if (monthly && monthlyEl) {
            monthlyEl.textContent = formatCompact(monthly);
            if (statusEl) statusEl.textContent = '● Live';
        } else {
            if (monthlyEl) monthlyEl.textContent = '—';
            if (statusEl)  statusEl.textContent = 'unavailable';
        }
    } catch (e) {
        console.warn('Spotify artist fetch failed:', e.message);
        if (monthlyEl) monthlyEl.textContent = '—';
        if (statusEl)  statusEl.textContent = 'unavailable';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initStreamsDashboard();
    loadSpotifyArtistData();
});
