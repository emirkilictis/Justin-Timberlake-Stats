// --- 1. AYARLAR VE MAPPING ---
let MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";

const songToAlbumMap = {
    // --- JUSTIFIED ---
    "Like I Love You": "Justified", "Cry Me a River": "Justified", "Rock Your Body": "Justified", "Señorita": "Justified",
    "Last Night": "Justified", "Take It From Here": "Justified", "Still On My Brain": "Justified", "Take Me Now": "Justified", "Right For Me": "Justified", "Nothin' Else": "Justified", "Never Again": "Justified",

    // --- FUTURESEX/LOVESOUNDS ---
    "SexyBack": "FutureSex/LoveSounds", "My Love": "FutureSex/LoveSounds", "What Goes Around": "FutureSex/LoveSounds", "Summer Love": "FutureSex/LoveSounds", "Until The End Of Time": "FutureSex/LoveSounds", "LoveStoned": "FutureSex/LoveSounds",
    "Chop Me Up": "FutureSex/LoveSounds", "FutureSex": "FutureSex/LoveSounds", "Losing My Way": "FutureSex/LoveSounds", "Sexy Ladies": "FutureSex/LoveSounds", "Boutique In Heaven": "FutureSex/LoveSounds",

    // --- THE 20/20 EXPERIENCE (PART 1 & 2) ---
    "Mirrors": "The 20/20 Experience", "Suit & Tie": "The 20/20 Experience", "Not a Bad Thing": "The 20/20 Experience", "TKO": "The 20/20 Experience", "Drink You Away": "The 20/20 Experience",
    "Pusher Love Girl": "The 20/20 Experience", "Tunnel Vision": "The 20/20 Experience", "Take Back the Night": "The 20/20 Experience", "Murder": "The 20/20 Experience", "Strawberry Bubblegum": "The 20/20 Experience", "Don't Hold the Wall": "The 20/20 Experience", "Let the Groove Get In": "The 20/20 Experience", "Blue Ocean Floor": "The 20/20 Experience", "Amnesia": "The 20/20 Experience", "True Blood": "The 20/20 Experience", "Only When I Walk Away": "The 20/20 Experience", "Cabaret": "The 20/20 Experience", "You Got It On": "The 20/20 Experience", "Gimme What I Don't Know": "The 20/20 Experience", "Dress On": "The 20/20 Experience", "That Girl": "The 20/20 Experience", "Spaceship Coupe": "The 20/20 Experience",

    // --- MAN OF THE WOODS ---
    "Say Something": "Man of the Woods", "Filthy": "Man of the Woods", "Man of the Woods": "Man of the Woods",
    "Supplies": "Man of the Woods", "Morning Light": "Man of the Woods", "Higher Higher": "Man of the Woods", "Midnight Summer Jam": "Man of the Woods", "Sauce": "Man of the Woods", "Wave": "Man of the Woods", "Montana": "Man of the Woods", "Flannel": "Man of the Woods", "Young Man": "Man of the Woods", "Breeze Off the Pond": "Man of the Woods", "The Hard Stuff": "Man of the Woods", "Hers (interlude)": "Man of the Woods", "Livin' Off the Land": "Man of the Woods",

    // --- EITIW ---
    "Memphis": "Everything I Thought It Was", "Selfish": "Everything I Thought It Was", "No Angels": "Everything I Thought It Was", "Drown": "Everything I Thought It Was",
    "F**kin' Up The Disco": "Everything I Thought It Was", "Play": "Everything I Thought It Was", "Technicolor": "Everything I Thought It Was", "Sanctified": "Everything I Thought It Was",
    "Liar": "Everything I Thought It Was", "Imagination": "Everything I Thought It Was", "What Lovers Do": "Everything I Thought It Was", "My Favorite Drug": "Everything I Thought It Was",
    "Flame": "Everything I Thought It Was", "Infinity Sex": "Everything I Thought It Was", "Love & War": "Everything I Thought It Was", "Alone": "Everything I Thought It Was",
    "Conditions": "Everything I Thought It Was", "Paradise" : "Everything I Thought It Was",

    // --- ORPHAN / FEATURES ---
    "CAN'T STOP THE FEELING!": "Orphan / Features", "4 Minutes": "Orphan / Features", "Give It To Me": "Orphan / Features", "Ayo Technology": "Orphan / Features", "Holy Grail": "Orphan / Features", "Dead And Gone": "Orphan / Features", "Love Never Felt So Good": "Orphan / Features", "Carry Out": "Orphan / Features"
};

const albumMetData = {
    "Justified": { year: 2002 },
    "FutureSex/LoveSounds": { year: 2006 },
    "The 20/20 Experience": { year: 2013 },
    "Man of the Woods": { year: 2018 },
    "Everything I Thought It Was": { year: 2024 },
    "Orphan / Features": { year: "Various" }
};

// ── 2026 YTD Baseline (Kaynak: Wayback Machine / Kworb 2026-01-01) ────────────
// Bu veriler değişmez — yılın ilk günkü anlık snapshot.
// ÖNEMLİ: Çakışma önlemek için daha özgün (uzun) anahtarlar önce gelmeli!
const YTD_2026_BASELINE = {
    date: "2026-01-01",
    career_total: 16_687_312_167,
    tracks: {
        // Film versiyonları ÖNCE — "includes" eşleşmesinde kısa anahtar galip gelmessin
        "CAN'T STOP THE FEELING! (from":  1_997_165_198, // DreamWorks main version
        "FEELING! - Film Version":           136_996_989, // CAN'T STOP THE FEELING! - Film Version
        "True Colors - Film Version":        108_384_944, // "True Colors" key'inden önce gelmeli
        // Regular tracks
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

/** YTD baseline'dan bir şarkının başlangıç değerini döner (partial match). */
function getTrackYTDBaseline(liveTitle) {
    const lower = liveTitle.toLowerCase();
    for (const key in YTD_2026_BASELINE.tracks) {
        if (lower.includes(key.toLowerCase())) {
            return YTD_2026_BASELINE.tracks[key];
        }
    }
    return null;
}

/**
 * Büyük sayıları mobilde B/M/K formatında kısa gösterir.
 * Desktop'ta tam sayı (1,283,973,094), mobilde "1.28B" gibi.
 */
function fmtNum(n) {
    if (window.innerWidth >= 768) return n.toLocaleString('en-US');
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)         return Math.round(n / 1_000) + 'K';
    return String(n);
}
function fmtDelta(n) { return '+' + fmtNum(n); }

/** 2026-01-01'den bugüne kaç gün geçti. */
function getYTDDaysElapsed() {
    const start = new Date('2026-01-01T00:00:00Z');
    const now   = new Date();
    return Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24)));
}

// --- 2. YARDIMCI FONKSİYONLAR ---

function animateValue(obj, start, end, duration, prefix = "") {
    if (!obj || isNaN(end)) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);

        if (end >= 1000000000 && obj.id === 'jt-total-career') {
            obj.innerHTML = prefix + (current / 1000000000).toFixed(2) + 'B';
        } else {
            obj.innerHTML = prefix + current.toLocaleString('en-US');
        }
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

// ── Tarih Yardımcıları ─────────────────────────────────────────────────────────

/**
 * N gün öncenin UTC tarihini YYYY-MM-DD formatında döner.
 */
function getUTCDateString(daysAgo = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().split('T')[0];
}


// ── Firestore Hazır Olmasını Bekle ─────────────────────────────────────────────

/**
 * Firebase module scriptinin 'firestore-ready' event'ini göndermesini bekler.
 * Zaten hazırsa hemen resolve olur. 6 saniyede timeout → false döner.
 */
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

// ── Snapshot'tan Tek Bir Tarih için Veri Çekici ────────────────────────────────

/**
 * Snapshot objesinden bir şarkının geçmiş verisini döner.
 * Snapshot null ise ya da şarkı bulunamıyorsa null döner.
 */
function getTrackFromSnapshot(trackTitle, snapshot) {
    if (!snapshot || !snapshot.tracks) return null;
    return snapshot.tracks[trackTitle] || null;
}

/**
 * Snapshot'tan bir albümün geçmiş verisini döner.
 */
function getAlbumFromSnapshot(albumName, snapshot) {
    if (!snapshot || !snapshot.albums) return null;
    return snapshot.albums[albumName] || null;
}

// ── Geliştirilmiş Milestone Hesaplayıcı ───────────────────────────────────────

/**
 * 7d + 30d + YTD (statik baseline) üç veri noktasıyla ağırlıklı projeksiyon.
 * confidence: "high" | "medium" | "low"
 */
function calculateImprovedMilestone(track, snap7, snap30) {
    const hist7       = getTrackFromSnapshot(track.title, snap7);
    const hist30      = getTrackFromSnapshot(track.title, snap30);
    const ytdBaseline = getTrackYTDBaseline(track.title);
    const ytdDays     = getYTDDaysElapsed();

    let projectedDaily;
    let confidence;

    if (hist7 && hist30 && track.total > hist7.total && track.total > hist30.total) {
        const realWeeklyAvg  = (track.total - hist7.total)  / 7;
        const realMonthlyAvg = (track.total - hist30.total) / 30;

        if (ytdBaseline && track.total > ytdBaseline && ytdDays > 30) {
            // 3 nokta: son 7g %50 + son 30g %30 + YTD %20
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
        // Sadece YTD verisi var (Firestore henüz boş)
        projectedDaily = (track.total - ytdBaseline) / ytdDays;
        confidence = "medium";
    } else {
        projectedDaily = getTrueDailyAverage(track.daily);
        confidence = "low";
    }

    // Sonraki milestone hesapla
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
        "Justified": { total: 0, daily: 0 },
        "FutureSex/LoveSounds": { total: 0, daily: 0 },
        "The 20/20 Experience": { total: 0, daily: 0 },
        "Man of the Woods": { total: 0, daily: 0 },
        "Everything I Thought It Was": { total: 0, daily: 0 },
        "Orphan / Features": { total: 0, daily: 0 },
        tracks: []
    };

    const tables = doc.querySelectorAll('table');
    if (tables.length > 0) {
        const totalCell = tables[0].querySelectorAll('td')[1];
        if (totalCell) stats.TotalSpotify = parseInt(totalCell.textContent.replace(/,/g, ''), 10) || 0;
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
                stats["Orphan / Features"].total += valTotal;
                stats["Orphan / Features"].daily += valDaily;
            }
        }
    });

    return stats;
}

// --- 4. ANA YÜKLEYİCİ VE UI GÜNCELLEME ---

async function initStreamsDashboard() {
    try {
        // ── ADIM A: Canlı veriyi çek ────────────────────────────────────────
        const res = await fetch(MY_DYNAMIC_API);
        const html = await res.text();
        const liveStats = analyzeKworbData(html);

        const jtTotalCareer  = document.getElementById('jt-total-career');
        const jtDailyCareer  = document.getElementById('jt-daily-career');
        const albumTableBody = document.getElementById('album-table-body');
        const streamsTableBody = document.getElementById('streams-table-body');
        const radarGrid      = document.getElementById('milestone-radar');

        let allAlbums = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "Man of the Woods", "Everything I Thought It Was", "Orphan / Features"];

        if(albumTableBody)   albumTableBody.innerHTML   = "";
        if(streamsTableBody) streamsTableBody.innerHTML = "";
        if(radarGrid)        radarGrid.innerHTML        = "";

        // TOP SECTION — canlı rakamlar
        let jtTotalDaily = 0;
        allAlbums.forEach(id => { jtTotalDaily += liveStats[id].daily; });

        animateValue(jtTotalCareer, 0, liveStats.TotalSpotify, 2000);
        animateValue(jtDailyCareer, 0, jtTotalDaily, 2000, "+");

        // ── ADIM B: Firestore hazır olmasını bekle, geçmiş snapshot'ları çek ───
        const firestoreOk = await waitForFirestore();
        let snap7  = null;
        let snap30 = null;

        if (firestoreOk) {
            [snap7, snap30] = await Promise.all([
                window.getHistoricalSnapshot(getUTCDateString(7)),
                window.getHistoricalSnapshot(getUTCDateString(30))
            ]);
        }

        // ── ADIM C: Büyüme kartlarını güncelle ──────────────────────────────
        function setGrowthCard(valueId, statusId, snapshot, label) {
            const valueEl  = document.getElementById(valueId);
            const statusEl = document.getElementById(statusId);
            if (!valueEl) return;

            if (snapshot && snapshot.career_total) {
                const delta = liveStats.TotalSpotify - snapshot.career_total;
                if (delta > 0) {
                    valueEl.textContent = '+' + delta.toLocaleString('en-US');
                    valueEl.classList.remove('loading');
                    if (statusEl) {
                        statusEl.textContent = 'Snapshot: ' + snapshot.date;
                        statusEl.classList.add('ok');
                    }
                } else {
                    valueEl.textContent = 'Snapshot older than live';
                    if (statusEl) statusEl.textContent = 'Data sync pending';
                }
            } else {
                valueEl.textContent = 'No ' + label + ' snapshot yet';
                if (statusEl) statusEl.textContent = 'Run the first snapshot to populate';
            }
        }

        setGrowthCard('jt-weekly-growth',  'snap7-status',  snap7,  '7d');
        setGrowthCard('jt-monthly-growth', 'snap30-status', snap30, '30d');

        // YTD: statik 2026/01/01 baseline kullan — Firestore'a gerek yok
        const ytdEl     = document.getElementById('jt-ytd-growth');
        const ytdStatus = document.getElementById('snapytd-status');
        const ytdDelta  = liveStats.TotalSpotify - YTD_2026_BASELINE.career_total;
        const ytdDays   = getYTDDaysElapsed();
        if (ytdEl) {
            ytdEl.textContent = '+' + ytdDelta.toLocaleString('en-US');
            ytdEl.classList.remove('loading');
        }
        if (ytdStatus) {
            ytdStatus.textContent = `Since Jan 1 · ${ytdDays} days · ~${Math.round(ytdDelta / ytdDays).toLocaleString()}/day avg`;
            ytdStatus.classList.add('ok');
        }

        // ── ADIM D: Era renkleri ─────────────────────────────────────────────
        const eraColors = {
            "Justified": "#5dade2", "FutureSex/LoveSounds": "#e74c3c",
            "The 20/20 Experience": "#fce98a", "Man of the Woods": "#ca6f1e",
            "Everything I Thought It Was": "#f39c12", "Orphan / Features": "#bdc3c7"
        };

        // ── ADIM E: Album Leaderboard (+ 7-Day ▲ kolonu) ────────────────────
        const albumCoversSt = {
            "Justified": "assets/justified.jpg", "FutureSex/LoveSounds": "assets/fsls.jpg",
            "The 20/20 Experience": "assets/the20.jpg", "Man of the Woods": "assets/motw.jpg",
            "Everything I Thought It Was": "assets/eitiw.jpg", "Orphan / Features": null
        };

        if(albumTableBody) {
            allAlbums.forEach(id => {
                const album = liveStats[id];
                const dailyPerc = jtTotalDaily > 0 ? (album.daily / jtTotalDaily) * 100 : 0;
                const barColor  = eraColors[id] || "#d4a853";
                const imgSrc    = albumCoversSt[id];
                const thumbHTML = imgSrc
                    ? `<img src="${imgSrc}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;">`
                    : `<div style="width:40px;height:40px;border-radius:4px;background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);flex-shrink:0;"></div>`;

                // Albüm için 7 günlük gerçek büyüme
                const hist7Album = getAlbumFromSnapshot(id, snap7);
                let weekly7Cell;
                if (hist7Album && album.total > hist7Album.total) {
                    const delta7 = album.total - hist7Album.total;
                    weekly7Cell = `<td class="positive-trend" style="vertical-align:middle;">${fmtDelta(delta7)}</td>`;
                } else {
                    weekly7Cell = `<td style="vertical-align:middle;color:#555;">—</td>`;
                }

                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="display:flex;align-items:center;gap:12px;">
                            ${thumbHTML}
                            <div>
                                <div style="font-weight: 700; color: #fff;">${id}</div>
                                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); margin-top: 8px; border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${dailyPerc}%; height: 100%; background: ${barColor}; box-shadow: 0 0 10px ${barColor}; border-radius: 2px; transition: width 1.5s ease-out;"></div>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">${albumMetData[id].year}</td>
                    <td style="vertical-align: middle;">${fmtNum(album.total)}</td>
                    <td class="positive-trend" style="vertical-align: middle;">${fmtDelta(album.daily)}</td>
                    ${weekly7Cell}
                    <td style="vertical-align: middle; color: ${barColor}; font-weight: 700;">${dailyPerc.toFixed(1)}%</td>
                `;
                albumTableBody.appendChild(tr);
            });
        }

        // ── ADIM F: Top Tracks (gerçek 7d ve 30d delta) ──────────────────────
        if(streamsTableBody) {
            liveStats.tracks.slice(0, 15).forEach(track => {
                const hist7Track  = getTrackFromSnapshot(track.title, snap7);
                const hist30Track = getTrackFromSnapshot(track.title, snap30);
                const ytdBaseline = getTrackYTDBaseline(track.title);

                let real7Cell, real30Cell, ytdCell;

                if (hist7Track && track.total > hist7Track.total) {
                    const d7 = track.total - hist7Track.total;
                    real7Cell = `<td class="positive-trend">${fmtDelta(d7)}</td>`;
                } else {
                    const est7 = Math.floor(getTrueDailyAverage(track.daily) * 7);
                    real7Cell = `<td style="color:#d4a853;font-style:italic;" title="Estimated">~${fmtNum(est7)}</td>`;
                }

                if (hist30Track && track.total > hist30Track.total) {
                    const d30 = track.total - hist30Track.total;
                    real30Cell = `<td class="positive-trend">${fmtDelta(d30)}</td>`;
                } else {
                    const est30 = Math.floor(getTrueDailyAverage(track.daily) * 30);
                    real30Cell = `<td style="color:#d4a853;font-style:italic;" title="Estimated">~${fmtNum(est30)}</td>`;
                }

                if (ytdBaseline && track.total > ytdBaseline) {
                    const dYTD = track.total - ytdBaseline;
                    ytdCell = `<td style="color:#a78bfa;font-weight:600;">${fmtDelta(dYTD)}</td>`;
                } else {
                    ytdCell = `<td style="color:#555;">—</td>`;
                }

                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${track.title}</td>
                    <td>${fmtNum(track.total)}</td>
                    <td class="positive-trend">${fmtDelta(track.daily)}</td>
                    ${real7Cell}
                    ${real30Cell}
                    ${ytdCell}
                `;
                streamsTableBody.appendChild(tr);
            });
        }

        // ── ADIM G: Milestone Radar (geliştirilmiş predictor) ────────────────
        if(radarGrid) {
            // Kaç tane "high confidence" tahmin var, göster
            const confidenceNote = document.getElementById('milestone-confidence-note');
            let highCount = 0;

            liveStats.tracks.slice(0, 10).forEach(track => {
                if (track.daily <= 10000) return;

                const milestone = calculateImprovedMilestone(track, snap7, snap30);
                if (milestone.confidence === 'high') highCount++;

                const targetText = milestone.target >= 1000000000
                    ? (milestone.target / 1000000000) + "B"
                    : (milestone.target / 1000000) + "M";

                const daysDisplay = milestone.daysLeft !== null
                    ? milestone.daysLeft.toLocaleString() + ' Days'
                    : 'N/A';

                // Beklenen tarih hesapla
                let etaText = '';
                if (milestone.daysLeft !== null) {
                    const etaDate = new Date();
                    etaDate.setDate(etaDate.getDate() + milestone.daysLeft);
                    etaText = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }

                const confidenceBadge = `<span class="confidence-badge confidence-${milestone.confidence}">${milestone.confidence}</span>`;

                let card = document.createElement('div');
                card.className = "milestone-card";
                card.innerHTML = `
                    <div style="font-size: 0.8rem; color: #888; text-transform: uppercase; margin-bottom: 6px;">
                        Countdown to ${targetText} ${confidenceBadge}
                    </div>
                    <div style="font-size: 1.2rem; font-weight: 700; margin: 10px 0;">${track.title}</div>
                    <div style="font-size: 2rem; color: #d4a853;">${daysDisplay}</div>
                    <div style="font-size: 0.85rem; color: #aaa; margin-top: 5px;">
                        Needs ${(milestone.remaining / 1000000).toFixed(1)}M more
                        ${etaText ? `· ETA: <span style="color:#fff;">${etaText}</span>` : ''}
                    </div>
                    <div style="font-size: 0.75rem; color: #555; margin-top: 4px;">
                        ~${Math.round(milestone.projectedDaily).toLocaleString()} streams/day projected
                    </div>
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

        // ── ADIM H: Chart.js Grafik ───────────────────────────────────────────
        const canvasElement = document.getElementById('albumShareChart');
        if(canvasElement) {
            const ctx = canvasElement.getContext('2d');

            const chartLabels = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "Man of the Woods", "EITIW", "Orphan / Features"];
            const chartData = [
                liveStats["Justified"].total,
                liveStats["FutureSex/LoveSounds"].total,
                liveStats["The 20/20 Experience"].total,
                liveStats["Man of the Woods"].total,
                liveStats["Everything I Thought It Was"].total,
                liveStats["Orphan / Features"].total
            ];

            const chartColors = ['#5dade2', '#e74c3c', '#fce98a', '#ca6f1e', '#f39c12', '#bdc3c7'];

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: chartColors,
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
                                    if (context.raw !== null && context.raw !== undefined) {
                                        label += new Intl.NumberFormat('en-US').format(context.raw);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }

    } catch (e) {
        console.error("Dashboard yüklenemedi:", e);
        const radarGrid = document.getElementById('milestone-radar');
        if(radarGrid) radarGrid.innerHTML = "Failed to load dynamic data. Check console.";
    }
}

document.addEventListener('DOMContentLoaded', initStreamsDashboard);
