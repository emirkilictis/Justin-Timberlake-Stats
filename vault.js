// ── 1. CONFIGURATION & MAPPING TABLES ──
const MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";
const YOUTUBE_API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.YOUTUBE_API_KEY : "";
const ARTIST_RATIO = 1.82; // Global AOD Multiplier for Spotify Streams (Updated for Catalog Hits)
const US_SHARE = 0.35;  // US Share (Updated for Global Artists)

const CERT_MAPPINGS = {
    "USA": { "Gold": 500000, "Platinum": 1000000, "Diamond": 10000000 },
    "UK": { 
        "album": { "Silver": 60000, "Gold": 100000, "Platinum": 300000 },
        "song": { "Silver": 200000, "Gold": 400000, "Platinum": 600000 }
    },
    "Brazil": {
        "album": { "Gold": 20000, "Platinum": 40000, "Diamond": 160000 },
        "song":  { "Gold": 30000, "Platinum": 60000, "Diamond": 250000 }
    },
    "Germany": { 
        "album": { "Gold": 100000, "Platinum": 200000, "Diamond": 750000 },
        "song": { "Gold": 200000, "Platinum": 400000, "Diamond": 1000000 }
    }, 
    "Australia": { "Gold": 35000, "Platinum": 70000, "Diamond": 500000 },
    "Canada": { "Gold": 40000, "Platinum": 80000, "Diamond": 800000 },
    "Mexico": { "Gold": 30000, "Platinum": 60000, "Diamond": 300000 },
    "New Zealand": {
        "album": { "Gold": 7500,  "Platinum": 15000, "Diamond": 100000 },
        "song":  { "Gold": 15000, "Platinum": 30000, "Diamond": 300000 }
    },
    "Denmark": { 
        "album": { "Gold": 10000, "Platinum": 20000, "Diamond": 200000 },
        "song": { "Gold": 45000, "Platinum": 90000, "Diamond": 450000 }
    },
    "Poland": { "Gold": 10000, "Platinum": 20000, "Diamond": 100000 },
    "Spain": {
        "album": { "Gold": 30000, "Platinum": 60000, "Diamond": 600000 },
        "song":  { "Gold": 20000, "Platinum": 40000, "Diamond": 400000 }
    },
    "Italy": { "Gold": 25000, "Platinum": 50000, "Diamond": 500000 },
    "France": { "Gold": 100000, "Platinum": 200000, "Diamond": 600000 },
    "Netherlands": { "Gold": 40000, "Platinum": 80000, "Diamond": 200000 },
    "Switzerland": { "Gold": 15000, "Platinum": 30000, "Diamond": 100000 },
    "Sweden": {
        "album": { "Gold": 30000, "Platinum": 60000, "Diamond": 150000 },
        "song":  { "Gold": 20000, "Platinum": 40000, "Diamond": 400000 }
    },
    "Japan": { "Gold": 100000, "Platinum": 250000, "Diamond": 1000000 },
    "Belgium": {
        "album": { "Gold": 15000, "Platinum": 30000, "Diamond": 150000 },
        "song":  { "Gold": 10000, "Platinum": 20000, "Diamond": 200000 }
    },
    "Austria": {
        "album": { "Gold": 15000, "Platinum": 30000 },
        "song":  { "Gold": 15000, "Platinum": 30000 }
    },
    "Portugal": {
        "album": { "Gold": 7500, "Platinum": 15000 },
        "song":  { "Gold": 5000, "Platinum": 10000 }
    },
    "World": { "Silver": 500000, "Gold": 1000000, "Platinum": 2000000, "Diamond": 10000000 },
    
};

const COUNTRIES = ["USA", "UK", "Brazil", "Germany", "Australia", "Canada", "Mexico", "Other"];

const ALBUM_COLORS = {
    "Justified": "#5dade2", "FutureSex/LoveSounds": "#e74c3c", "The 20/20 Experience": "#d4a853",
    "The 20/20 Experience – 2 of 2": "#c0962e",
    "Man of the Woods": "#e67e22", "Everything I Thought It Was": "#ca510f", "Orphan": "#bdc3c7"
};

const ALBUM_COVERS = {
    "Justified": "assets/justified.jpg", "FutureSex/LoveSounds": "assets/fsls.jpg", 
    "The 20/20 Experience": "assets/the20.jpg", "The 20/20 Experience – 2 of 2": "assets/the20pt2.jpg",
    "Man of the Woods": "assets/motw.jpg",
    "Everything I Thought It Was": "assets/eitiw.jpg", "Orphan": null
};

// Data States
let vaultData = { songs: [], albums: [] };
let jtData = null; // For base data.json including youtubeVideoIds and Orphan
let liveStreams = { TotalSpotify: 0, tracks: {}, albums: {}, songs: {}, titles: {} };
let computedData = { songs: [], albums: [], nonSingles: [] };

let sortState = {
    albums: { col: 'global', asc: false },
    songs: { col: 'global', asc: false },
    nonSingles: { col: 'usLive', asc: false }
};

// ── 2. DATA FETCHING ──

async function fetchVaultData() {
    try {
        const [res, jtRes] = await Promise.all([
            fetch('data/vault.json'),
            fetch('data.json')
        ]);
        if (res.ok) vaultData = await res.json();
        if (jtRes.ok) jtData = await jtRes.json();
    } catch (e) {
        console.error("Failed to fetch vault or base data:", e);
    }
}

async function fetchLiveStreams() {
    if (!MY_DYNAMIC_API) return;
    try {
        const res = await fetch(MY_DYNAMIC_API);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const rows = doc.querySelectorAll('table.addpos tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 3) {
                let title = cols[0].textContent.trim();
                let val = parseInt(cols[1].textContent.replace(/,/g, ''), 10) || 0;
                if (!title) return;
                let lowerTitle = title.toLowerCase();

                // Track mapping
                liveStreams.tracks[lowerTitle] = val;
                liveStreams.titles[lowerTitle] = title;

                // Album grouping logic
                const map = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};
                for (let key in map) {
                    if (lowerTitle.includes(key.toLowerCase())) {
                        let album = map[key];
                        liveStreams.albums[album] = (liveStreams.albums[album] || 0) + val;
                        break;
                    }
                }
            }
        });

        // Merge extra tracks fallback
        const radioTitle = 'Not A Bad Thing - Radio Edit';
        const radioLower = radioTitle.toLowerCase();
        if (!liveStreams.tracks[radioLower]) {
            const baselineDate = '2026-05-24';
            const baselineTotal = 118_417_347;
            const dailyGrowth = 1_500;
            const days = Math.max(0, Math.round(
                (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
            ));
            const radioStreams = baselineTotal + days * dailyGrowth;
            liveStreams.tracks[radioLower] = radioStreams;
            liveStreams.titles[radioLower] = radioTitle;
            
            const albumName = "The 20/20 Experience – 2 of 2";
            liveStreams.albums[albumName] = (liveStreams.albums[albumName] || 0) + radioStreams;
        }

        const fourMinTitle = '4 Minutes (feat. Justin Timberlake and Timbaland)';
        const fourMinLower = fourMinTitle.toLowerCase();
        if (!liveStreams.tracks[fourMinLower]) {
            const baselineDate = '2026-04-23';
            const baselineTotal = 102_400_000;
            const dailyGrowth = 120_000;
            const days = Math.max(0, Math.round(
                (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
            ));
            const fourMinStreams = baselineTotal + days * dailyGrowth;
            liveStreams.tracks[fourMinLower] = fourMinStreams;
            liveStreams.titles[fourMinLower] = fourMinTitle;
            
            const albumName = "Orphan";
            liveStreams.albums[albumName] = (liveStreams.albums[albumName] || 0) + fourMinStreams;
        }

        const loveSexMagicTitle = 'Love Sex Magic (feat. Justin Timberlake)';
        const loveSexMagicLower = loveSexMagicTitle.toLowerCase();
        if (!liveStreams.tracks[loveSexMagicLower]) {
            const baselineDate = '2026-06-30';
            const baselineTotal = 96_685_624;
            const dailyGrowth = 17_965;
            const days = Math.max(0, Math.round(
                (Date.now() - new Date(baselineDate + 'T00:00:00Z').getTime()) / 86400000
            ));
            const lsmStreams = baselineTotal + days * dailyGrowth;
            liveStreams.tracks[loveSexMagicLower] = lsmStreams;
            
            const albumName = "Orphan";
            liveStreams.albums[albumName] = (liveStreams.albums[albumName] || 0) + lsmStreams;
        }
    } catch (e) {
        console.error("Failed to fetch Kworb live streams:", e);
    }
}

function getTrackSpotify(title) {
    const tLower = title.toLowerCase();
    let sum = 0;
    let found = false;
    for (let k in liveStreams.tracks) {
        if (k.includes(tLower) || tLower.includes(k)) {
            sum += liveStreams.tracks[k];
            found = true;
        }
    }
    return found ? sum : 0;
}

// Sertifikaya SAYILMAYAN video ID'leri. Bunlar Total YouTube gösteriminde (script.js,
// streams.js) sayılmaya devam eder; sadece RIAA ünite hesabından (calculateUSALive)
// çıkarılır. RIAA single/album sertifikası şarkının resmi audio/video on-demand
// stream'lerini sayar; canlı performans, behind-the-scenes, making-of, "first listen",
// trailer/teaser, fan videoları bu kapsamda DEĞİL.
const CERT_EXCLUDED_VIDEO_IDS = new Set([
    "-WCnpZruNoo", // Mirrors (Live on SNL)
    "0umrvtA_pNc", // Suit & Tie (Live on SNL)
    "1Iw340-lV64", // Say Something (Live From Jimmy Fallon)
    "2HBJpnMKSm4", // Supplies (Live From Jimmy Fallon)
    "2z2NsE8ZfEs", // Making Of SexyBack
    "4WITkm-FFKo", // Better Days (2021 Inauguration Performance)
    "4onPsBIPUbY", // Rock Your Body & CSTF (Eurovision 2016 live)
    "6sixT068YsQ", // Man of the Woods (Behind The Album)
    "7bDFD_WcU9I", // Say Something / Midnight Summer Jam (Live BRITs 2018)
    "DJ7lTFQAOz0", // Filthy (Super Bowl LII Halftime Performance)
    "DSCZC4DKQwM", // CSTF (Anna Kendrick First Listen)
    "Z5Ylu4tRgk8", // Filthy (Behind The Song)
    "OB4VMLgKkV8", // CSTF (Kunal Nayyar First Listen)
    "JbxAmx7sAyE", // What Goes Around (Official Trailer)
    "U1ePoiXxJPE", // CSTF (James Corden First Listen)
    "bVU-MmJZFFA", // MAN OF THE WOODS (Behind The Album)
    "dmk0u5j4cxk", // CSTF (Official Video Teaser)
    "eAeteudJ5g0", // Not A Bad Thing (Fan Video)
    "jZkaxAjOH6o", // CSTF (Ron Funches First Listen)
    "oGLzeAC3ssU", // The Man of the Woods (Behind The Tour)
    "p5RobDomh5U", // CSTF (First Listen)
    "saqEIocK0xc", // CSTF (Icona Pop First Listen)
    "tMkwQFlAhMA", // Say Something (First Take)
    "v6xUgawDQB0", // Pepsi Super Bowl LII Halftime Show (Live)
    "Ii7aOjjJAxw", // *NSYNC scene from Trolls Band Together (film klibi)
    "F0B7HDiY-10", // IVE - After LIKE (JT ile alakasız, yanlış maplenmiş)
]);

function filterCertVideoIds(ids) {
    return (ids || []).filter(id => !CERT_EXCLUDED_VIDEO_IDS.has(id));
}

async function fetchRealYouTubeViews(ids) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) {
            console.warn('[YouTube API error]', data.error.code, data.error.message, 'ids:', ids);
            return 0;
        }
        if (!data.items || data.items.length === 0) {
            console.warn('[YouTube API] no items returned for ids:', ids);
            return 0;
        }
        if (data.items.length < ids.length) {
            const returned = new Set(data.items.map(i => i.id));
            const missing = ids.filter(id => !returned.has(id));
            console.warn('[YouTube API] missing/private video IDs:', missing);
        }
        return data.items.reduce((sum, item) => sum + parseInt(item.statistics.viewCount || 0), 0);
    } catch (e) {
        console.warn('[YouTube API] fetch failed:', e.message, 'ids:', ids);
        return 0;
    }
}

// ── 3. CALCULATION ENGINE ──

function parseCertString(certStr, country, itemType = 'song', itemId = '') {
    if (!certStr || certStr === "None") return 0;
    
    let mapping = CERT_MAPPINGS[country];
    if (!mapping) return 0;

    // Generic threshold selection for countries with album/song distinction
    if (mapping.album && mapping.song) {
        mapping = mapping[itemType] || mapping['song'];
    }

    // Canada Legacy Rule: Justified & FSLS use older 50k/100k thresholds
    if (country === 'Canada' && (itemId === 'Justified' || itemId === 'FutureSex/LoveSounds')) {
        mapping = { "Gold": 50000, "Platinum": 100000, "Diamond": 1000000 };
    }

    // Support for combined certifications (e.g., "Platinum + Gold")
    const parts = certStr.split('+').map(p => p.trim());
    let totalUnits = 0;

    parts.forEach(part => {
        // Support for raw units (e.g., "100000 units" or "330k units")
        const unitMatch = part.match(/^([\d\.]+)k?\s*units?$/i);
        if (unitMatch) {
            let val = parseFloat(unitMatch[1]);
            if (part.toLowerCase().includes('k')) val *= 1000;
            totalUnits += val;
            return;
        }

        let multiplier = 1;
        let type = part;

        const match = part.match(/^(\d+)x\s+(.+)$/i);
        if (match) {
            multiplier = parseInt(match[1]);
            type = match[2];
        }
        
        // Ensure type is capitalized correctly for mapping lookup
        type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

        if (mapping[type]) {
            totalUnits += (mapping[type] * multiplier);
        }
    });

    return totalUnits;
}

function calculateUSALive(item, type = 'song') {
    const pureSalesUS = item.pure_sales_us || 0;
    
    // Era-based US Share adjustment (Pre-2016 catalog vs Newer)
    let effectiveUSShare = US_SHARE;
    const era = type === 'song' ? item.album_id : item.id;
    const pre2016Eras = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "The 20/20 Experience – 2 of 2"];
    const post2016Orphans = ["Stay With Me", "Better Place", "The Other Side", "True Colors", "Soulmate"];

    if (pre2016Eras.includes(era) || (era === "Orphan" && !post2016Orphans.includes(item.title))) {
        effectiveUSShare = 0.27;
    }

    if (type === 'song') {
        const globalSpot = getTrackSpotify(item.title);
        const usAudio = (globalSpot * ARTIST_RATIO) * effectiveUSShare; 
        
        let usVideo = 0;
        if (liveStreams.songs[item.id]) {
            // Per-song YouTube views (used for orphan tracks and any song with direct YT data)
            usVideo = liveStreams.songs[item.id] * effectiveUSShare;
        } else if (item.album_id && jtData && jtData.albums[item.album_id]) {
            const albumData = jtData.albums[item.album_id];
            const albumSpot = liveStreams.albums[item.album_id] || 0;
            if (albumData.streams && albumData.streams.youtube && albumSpot > 0) {
                const spotShare = albumSpot > 0 ? globalSpot / albumSpot : 0;
                const ytGlobalTrack = albumData.streams.youtube * spotShare;
                usVideo = ytGlobalTrack * effectiveUSShare;
            }
        }
        
        // RIAA Song Formula: (Total US Streams / 150) + Pure Sales
        const totalUSStreams = usAudio + usVideo;
        return Math.floor((totalUSStreams / 150) + pureSalesUS);
    } else {
        const globalSpot = liveStreams.albums[item.id] || 0;
        const usAudio = (globalSpot * ARTIST_RATIO) * effectiveUSShare;
        
        let ytViews = 0;
        if (jtData && jtData.albums[item.id] && jtData.albums[item.id].streams) {
            ytViews = jtData.albums[item.id].streams.youtube || 0;
        }
        const usVideo = ytViews * effectiveUSShare;
        
        // RIAA Album Formula: (Total US Streams / 1500) + Pure Sales + (Track Sales / 10)
        const sea = (usAudio + usVideo) / 1500;
        
        let albumTrackSales = 0;
        vaultData.songs.forEach(s => {
            if (s.album_id === item.id) albumTrackSales += (s.pure_sales_us || 0);
        });
        const tea = albumTrackSales / 10;
        
        return Math.floor(pureSalesUS + sea + tea);
    }
}

function getRiaalEligibility(units) {
    let platCount = Math.floor(units / 1000000);
    if (units >= 10000000) return { label: `${Math.floor(units/10000000)}x Diamond`, isDiamond: true, platCount };
    if (units >= 1000000)  return { label: `${platCount}x Platinum`, isDiamond: false, platCount };
    if (units >= 500000)   return { label: "Gold", isDiamond: false, platCount: 0 };
    return { label: "None", isDiamond: false, platCount: 0 };
}

function quantizeRIAAUnits(units) {
    if (units < 500000) return 0;
    if (units < 1000000) return 500000;
    return Math.floor(units / 1000000) * 1000000;
}

function getBadgeHTML(certStr, _isLive = false, isDiamondActive = false, platCount = 0) {
    if (!certStr || certStr === "None" || certStr === "") return `<span class="badge badge-none">—</span>`;
    
    let cls = "badge-platinum";
    let lower = certStr.toLowerCase();
    let emoji = "💿";
    
    if (lower.includes("diamond"))       { cls = "badge-diamond";   emoji = "💎"; }
    else if (lower.includes("platinum")) { cls = "badge-platinum";  emoji = "💿"; }
    else if (lower.includes("gold"))     { cls = "badge-gold";      emoji = "📀"; }
    else if (lower.includes("silver"))   { cls = "badge-silver";    emoji = "🥈"; }

    let glow = (cls === "badge-diamond" || isDiamondActive) ? "diamond-glow" : "";
    
    let html = `<span class="badge ${cls} ${glow}">${certStr} ${emoji}</span>`;
    
    // Show platinum equivalent below diamond if not exactly 10x
    if (lower.includes("diamond") && platCount > 0 && platCount !== 10) {
        html += `<div class="text-[10px] text-gray-400 mt-1">${platCount}x Platinum 💿</div>`;
    }
    
    return html;
}

// ── 4. RENDER ENGINE ──

function computeAllData() {
    // Albums
    computedData.albums = vaultData.albums.map(a => {
        const rawUsLive = calculateUSALive(a, 'album');
        let officialSum = 0;
        let certTotal = 0;
        let cMap = {};
        
        // Manual 7 + Dynamic World Calculation
        const MAIN_7 = ["USA", "UK", "Brazil", "Germany", "Australia", "Canada", "Mexico"];
        
        // Use higher of live eligibility or official certification for USA
        const officialUSA = parseCertString((a.official_certifications || {})['USA'], 'USA', 'album', a.id);
        const usaMax = Math.max(rawUsLive, officialUSA);
        const usaFinal = quantizeRIAAUnits(usaMax);

        cMap['USA'] = usaFinal;
        certTotal += usaFinal;

        // Process Other Major Countries
        MAIN_7.filter(c => c !== 'USA').forEach(c => {
            let val = parseCertString((a.official_certifications || {})[c], c, 'album', a.id);
            cMap[c] = val;
            certTotal += val;
            officialSum += val;
        });

        // Other (Aggregation of ALL other markets)
        let otherVal = 0;
        for (let market in (a.official_certifications || {})) {
            if (!MAIN_7.includes(market) && market !== 'Other' && market !== 'World') {
                otherVal += parseCertString(a.official_certifications[market], market, 'album', a.id);
            }
        }
        // Add manual World/Other if it exists
        if (a.official_certifications.World) otherVal += parseCertString(a.official_certifications.World, 'World', 'album', a.id);
        if (a.official_certifications.Other) otherVal += parseCertString(a.official_certifications.Other, 'Other', 'album', a.id);
        
        cMap['Other'] = otherVal;
        certTotal += otherVal;
        officialSum += otherVal;

        return { ...a, usLive: usaFinal, global: usaFinal + officialSum, certTotal, cMap };
    }).filter(a => a.global > 0 && a.id !== "Orphan");

    // Songs
    computedData.songs = vaultData.songs.map(s => {
        const rawUsLive = calculateUSALive(s, 'song');
        let officialSum = 0;
        let certTotal = 0;
        let cMap = {};
        
        const MAIN_7 = ["USA", "UK", "Brazil", "Germany", "Australia", "Canada", "Mexico"];

        const officialUSA = parseCertString((s.official_certifications || {})['USA'], 'USA', 'song', s.id);
        const usaMax = Math.max(rawUsLive, officialUSA);
        const usaFinal = quantizeRIAAUnits(usaMax);

        cMap['USA'] = usaFinal;
        certTotal += usaFinal;

        MAIN_7.filter(c => c !== 'USA').forEach(c => {
            let val = parseCertString((s.official_certifications || {})[c], c, 'song', s.id);
            cMap[c] = val;
            certTotal += val;
            officialSum += val;
        });

        // Other (Aggregation)
        let otherVal = 0;
        for (let market in (s.official_certifications || {})) {
            if (!MAIN_7.includes(market) && market !== 'Other' && market !== 'World') {
                otherVal += parseCertString(s.official_certifications[market], market, 'song', s.id);
            }
        }
        if (s.official_certifications.World) otherVal += parseCertString(s.official_certifications.World, 'World', 'song', s.id);
        if (s.official_certifications.Other) otherVal += parseCertString(s.official_certifications.Other, 'Other', 'song', s.id);

        cMap['Other'] = otherVal;
        certTotal += otherVal;
        officialSum += otherVal;

        return { ...s, usLive: usaFinal, global: usaFinal + officialSum, certTotal, cMap };
    }).filter(s => s.global > 0);

    computeNonSingles();
}

// Kworb canlı tablosunda olup vault.json'da OLMAYAN parçalar (album cuts,
// alternatif versiyonlar, eski feature'lar). Bunlar için de RIAA eligible
// hesabı yapılır: track'in toplam AOD (audio-on-demand) stream'i × artist
// ratio × dönem bazlı US payı → audio units. Albümün sertifikaya sayılan
// YouTube video ID'lerinden toplam görüntüleme varsa (jtData.albums[id]
// .streams.youtube), track'in albüm içindeki audio payıyla orantılı bir
// video-view tahmini eklenir — calculateUSALive'ın per-song YT ID'si
// olmayan track'ler için kullandığı aynı yöntem. Pure sales 0 kabul edilir
// (vault.json'da resmi kayıt yok). Grand total'a DAHİL EDİLMEZ, sadece en
// çok stream alan ilk 10 track gösterilir.
function computeNonSingles() {
    const MIN_STREAMS = 5_000_000;
    const TOP_N = 10;
    const vaultTitlesLower = vaultData.songs.map(s => s.title.toLowerCase());
    const pre2016Eras = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "The 20/20 Experience – 2 of 2"];
    const post2016Orphans = ["Stay With Me", "Better Place", "The Other Side", "True Colors", "Soulmate"];
    const map = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};

    const out = [];
    for (const k in liveStreams.tracks) {
        const streams = liveStreams.tracks[k];
        if (streams < MIN_STREAMS) continue;
        // vault'taki single'larla eşleşenler zaten getTrackSpotify tarafından
        // tüketiliyor — aynı fuzzy mantıkla ele
        if (vaultTitlesLower.some(t => k.includes(t) || t.includes(k))) continue;

        let albumId = "Orphan";
        for (const key in map) {
            if (k.includes(key.toLowerCase())) { albumId = map[key]; break; }
        }

        // Kworb feature'ları "* " önekiyle işaretler — görüntüde temizle
        const displayTitle = (liveStreams.titles[k] || k).replace(/^\*\s*/, '');
        let share = US_SHARE;
        if (pre2016Eras.includes(albumId) ||
            (albumId === "Orphan" && !post2016Orphans.some(o => k.includes(o.toLowerCase())))) {
            share = 0.27;
        }

        const usAudio = streams * ARTIST_RATIO * share;

        // YouTube views (varsa) — albümün sertifika videolarından toplam
        // görüntüleme, track'in albüm audio payıyla orantılı dağıtılır.
        let usVideo = 0;
        const albumData = jtData && jtData.albums && jtData.albums[albumId];
        const albumSpot = liveStreams.albums[albumId] || 0;
        if (albumData && albumData.streams && albumData.streams.youtube && albumSpot > 0) {
            const spotShare = streams / albumSpot;
            const ytTrackShare = albumData.streams.youtube * spotShare;
            usVideo = ytTrackShare * share;
        }

        const usLive = Math.floor((usAudio + usVideo) / 150);
        out.push({ title: displayTitle, album_id: albumId, streams, usLive });
    }
    out.sort((a, b) => b.usLive - a.usLive);
    computedData.nonSingles = out.slice(0, TOP_N);
}

function animateValue(obj, start, end, duration) {
    if (!obj || isNaN(end)) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = current.toLocaleString('en-US');
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

window.sortVault = function(type, col, forceAsc) {
    let state = sortState[type];
    if (forceAsc !== undefined) {
        state.col = col;
        state.asc = forceAsc;
    } else if (state.col === col) {
        state.asc = !state.asc;
    } else {
        state.col = col;
        state.asc = false;
    }
    
    let arr = computedData[type];
    arr.sort((a,b) => {
        let valA, valB;
        if (col === 'title') { valA = a.title; valB = b.title; return state.asc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
        if (col === 'album') { valA = a.album_id || ''; valB = b.album_id || ''; return state.asc ? valA.localeCompare(valB) : valB.localeCompare(valA); }
        if (col === 'global') { valA = a.global; valB = b.global; }
        else if (col === 'certTotal') { valA = a.certTotal; valB = b.certTotal; }
        else if (col === 'streams') { valA = a.streams || 0; valB = b.streams || 0; }
        else if (col === 'USA' || col === 'usLive') { valA = a.usLive; valB = b.usLive; }
        else { valA = a.cMap[col] || 0; valB = b.cMap[col] || 0; }
        return state.asc ? valA - valB : valB - valA;
    });

    renderTables();
};

function renderNonSingles() {
    const tbody = document.getElementById('nonsingles-tbody');
    if (!tbody) return;
    const countEl = document.getElementById('nonsingles-count');
    const arr = computedData.nonSingles;
    if (countEl) countEl.textContent = `${arr.length} tracks`;

    if (!arr.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#555;padding:24px;">Live stream data unavailable — non-single eligibility needs the Kworb feed.</td></tr>';
        return;
    }

    tbody.innerHTML = arr.map(t => {
        const elig = getRiaalEligibility(t.usLive);
        // Sonraki eşik: Gold 500k → Platinum 1M → Nx Platinum (1M adım)
        const next = t.usLive < 500000 ? 500000
                   : t.usLive < 1000000 ? 1000000
                   : (Math.floor(t.usLive / 1000000) + 1) * 1000000;
        const nextLabel = next === 500000 ? 'Gold'
                        : next === 1000000 ? 'Platinum'
                        : `${next / 1000000}x Platinum`;
        const pct = Math.min(100, Math.round(t.usLive / next * 100));
        const color = ALBUM_COLORS[t.album_id] || '#bdc3c7';

        return `
            <tr>
                <td>
                    <div class="title-inner">
                        <div class="font-bold text-[14px] text-white title-text">${t.title}</div>
                        <div class="text-[10px] uppercase tracking-widest title-text" style="color:${color}99">${t.album_id}</div>
                    </div>
                </td>
                <td class="text-right" style="font-variant-numeric:tabular-nums;color:rgba(255,255,255,0.6);">${t.streams.toLocaleString()}</td>
                <td class="col-total text-right">${t.usLive.toLocaleString()}</td>
                <td class="text-center">${getBadgeHTML(elig.label, false, elig.isDiamond, elig.platCount)}</td>
                <td style="min-width:130px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.62rem;color:#666;margin-bottom:3px;font-family:'Space Grotesk',sans-serif;">
                        <span>${pct}%</span><span>→ ${nextLabel}</span>
                    </div>
                    <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;"></div>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function renderTables() {
    let grandTotal = 0;
    
    // Helper: build footer row with per-country totals
    function buildFooterRow(dataArr, label) {
        let totalCert = 0, totalGlobal = 0;
        let countryTotals = {};
        COUNTRIES.forEach(c => countryTotals[c] = 0);
        
        dataArr.forEach(item => {
            totalCert += item.certTotal || 0;
            totalGlobal += item.global || 0;
            COUNTRIES.forEach(c => { countryTotals[c] += item.cMap[c] || 0; });
        });
        
        // USA gets special treatment (wider cell for official + live)
        let usaCell = `<td class="text-center" style="font-weight:700;color:var(--accent-color);border-top:1px solid rgba(255,255,255,0.1);">${countryTotals.USA ? countryTotals.USA.toLocaleString() : '—'}</td>`;
        let otherCells = COUNTRIES.filter(c => c !== 'USA').map(c => {
            let val = countryTotals[c];
            return `<td class="text-center" style="font-weight:700;color:var(--accent-color);border-top:1px solid rgba(255,255,255,0.1);">${val ? val.toLocaleString() : '—'}</td>`;
        }).join('');
        
        return `<tr style="background:rgba(255,255,255,0.03);">
            <td style="font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:var(--accent-color);padding:16px;border-top:1px solid rgba(255,255,255,0.1);">${label}</td>
            <td class="col-total text-right" style="border-top:1px solid rgba(255,255,255,0.1);">${totalCert ? totalCert.toLocaleString() : '—'}</td>
            ${usaCell}${otherCells}
        </tr>`;
    }
    
    // Albums
    const albumTbody = document.getElementById('albums-tbody');
    albumTbody.innerHTML = '';
    computedData.albums.forEach(a => {
        grandTotal += a.global;
        let usLiveObj = getRiaalEligibility(a.usLive);
        let cover = ALBUM_COVERS[a.id];
        let thumb = cover ? `<img src="${cover}" class="w-10 h-10 object-cover rounded shadow-md mr-4 shrink-0 border border-white/10">` 
                          : `<div class="w-10 h-10 rounded shadow-md mr-4 shrink-0" style="background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);"></div>`;

        let tr = `
            <tr>
                <td>
                    <div class="flex items-center">
                        ${thumb}
                        <div class="title-inner">
                            <div class="font-playfair font-bold text-lg text-white title-text">${a.title}</div>
                        </div>
                    </div>
                </td>
                <td class="col-total text-right">${a.certTotal ? a.certTotal.toLocaleString() : '—'}</td>
                <td class="text-center">
                    ${getBadgeHTML(usLiveObj.label, false, usLiveObj.isDiamond, usLiveObj.platCount)}
                </td>
                <td class="text-center">${getBadgeHTML(a.official_certifications?.UK)}</td>
                <td class="text-center">${getBadgeHTML(a.official_certifications?.Brazil)}</td>
                <td class="text-center">${getBadgeHTML(a.official_certifications?.Germany)}</td>
                <td class="text-center">${getBadgeHTML(a.official_certifications?.Australia)}</td>
                <td class="text-center">${getBadgeHTML(a.official_certifications?.Canada)}</td>
                <td class="text-center">${getBadgeHTML(a.official_certifications?.Mexico)}</td>
                <td class="text-center" style="font-weight:700;color:var(--accent-color)">${a.cMap.Other > 0 ? a.cMap.Other.toLocaleString() : 'None'}</td>
            </tr>
        `;
        albumTbody.innerHTML += tr;
    });
    albumTbody.innerHTML += buildFooterRow(computedData.albums, 'Albums Total');

    // Songs
    const songsTbody = document.getElementById('songs-tbody');
    songsTbody.innerHTML = '';
    computedData.songs.forEach(s => {
        grandTotal += s.global;
        let usLiveObj = getRiaalEligibility(s.usLive);
        let color = ALBUM_COLORS[s.album_id] || "#bdc3c7";
        
        let tr = `
            <tr>
                <td>
                    <div class="title-inner">
                        <div class="font-bold text-[15px] text-white title-text">${s.title}</div>
                        <div class="text-[10px] uppercase tracking-widest title-text" style="color: ${color}99">${s.album_id}</div>
                    </div>
                </td>
                <td class="col-total text-right">${s.certTotal ? s.certTotal.toLocaleString() : '—'}</td>
                <td class="text-center">
                    ${getBadgeHTML(usLiveObj.label, false, usLiveObj.isDiamond, usLiveObj.platCount)}
                </td>
                <td class="text-center">${getBadgeHTML(s.official_certifications?.UK)}</td>
                <td class="text-center">${getBadgeHTML(s.official_certifications?.Brazil)}</td>
                <td class="text-center">${getBadgeHTML(s.official_certifications?.Germany)}</td>
                <td class="text-center">${getBadgeHTML(s.official_certifications?.Australia)}</td>
                <td class="text-center">${getBadgeHTML(s.official_certifications?.Canada)}</td>
                <td class="text-center">${getBadgeHTML(s.official_certifications?.Mexico)}</td>
                <td class="text-center" style="font-weight:700;color:var(--accent-color)">${s.cMap.Other > 0 ? s.cMap.Other.toLocaleString() : 'None'}</td>
            </tr>
        `;
        songsTbody.innerHTML += tr;
    });
    songsTbody.innerHTML += buildFooterRow(computedData.songs, 'Singles Total');

    renderNonSingles();

    // Country Summary Table
    const summaryTbody = document.getElementById('country-summary-tbody');
    if (summaryTbody) {
        let albumCountry = {}, songCountry = {};
        COUNTRIES.forEach(c => { albumCountry[c] = 0; songCountry[c] = 0; });
        computedData.albums.forEach(a => COUNTRIES.forEach(c => albumCountry[c] += a.cMap[c] || 0));
        computedData.songs.forEach(s => COUNTRIES.forEach(c => songCountry[c] += s.cMap[c] || 0));
        
        const COUNTRY_LABELS = { 
            "USA": "🇺🇸 United States", "UK": "🇬🇧 United Kingdom", "Brazil": "🇧🇷 Brazil", 
            "Germany": "🇩🇪 Germany", "Australia": "🇦🇺 Australia", "Canada": "🇨🇦 Canada", 
            "Mexico": "🇲🇽 Mexico", "Other": "🌍 Other Markets"
        };
        let grandAlbums = 0, grandSingles = 0;
        
        summaryTbody.innerHTML = COUNTRIES.map(c => {
            let a = albumCountry[c], s = songCountry[c], t = a + s;
            grandAlbums += a; grandSingles += s;
            return `<tr>
                <td class="font-bold">${COUNTRY_LABELS[c] || c}</td>
                <td class="text-center">${a ? a.toLocaleString() : '—'}</td>
                <td class="text-center">${s ? s.toLocaleString() : '—'}</td>
                <td class="text-right font-bold" style="color:var(--accent-color)">${t ? t.toLocaleString() : '—'}</td>
            </tr>`;
        }).join('');
        
        // Grand total row
        summaryTbody.innerHTML += `<tr style="background:rgba(255,255,255,0.03);border-top:1px solid rgba(255,255,255,0.1);">
            <td style="font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:var(--accent-color);padding:16px;">Grand Total</td>
            <td class="text-center" style="font-weight:700;color:var(--accent-color)">${grandAlbums.toLocaleString()}</td>
            <td class="text-center" style="font-weight:700;color:var(--accent-color)">${grandSingles.toLocaleString()}</td>
            <td class="text-right" style="font-weight:900;color:var(--accent-color);font-size:1.1em">${(grandAlbums + grandSingles).toLocaleString()}</td>
        </tr>`;
    }

    const odometer = document.getElementById('grand-total-odometer');
    let currentVal = parseInt(odometer.innerText.replace(/,/g, '')) || 0;
    animateValue(odometer, currentVal, grandTotal, 1000);

    renderEraSummary();
}

function renderEraSummary() {
    const container = document.getElementById('era-summary-grid');
    if (!container) return;

    const ERA_ORDER = [
        { id: "Justified",                                  label: "Justified" },
        { id: "FutureSex/LoveSounds",                       label: "FutureSex/LoveSounds" },
        { id: "The 20/20 Experience",                       label: "The 20/20 Experience (Complete Experience)", merged: "The 20/20 Experience – 2 of 2" },
        { id: "Man of the Woods",                           label: "Man of the Woods" },
        { id: "Everything I Thought It Was",                label: "Everything I Thought It Was" }
    ];

    container.innerHTML = ERA_ORDER.map(era => {
        const eraId   = era.id;
        const eraLabel = era.label;

        const albumIds = era.merged ? [eraId, era.merged] : [eraId];

        // All album cert units (summed if merged)
        const albumUnits = albumIds.reduce((sum, aid) => {
            const a = computedData.albums.find(x => x.id === aid);
            return sum + (a ? (a.certTotal || 0) : 0);
        }, 0);

        // All singles for this era (both album_ids if merged)
        const eraSongs = computedData.songs.filter(s => albumIds.includes(s.album_id));

        const singlesUnits = eraSongs.reduce((sum, s) => sum + (s.certTotal || 0), 0);
        const totalUnits   = albumUnits + singlesUnits;
        const singlesCount = eraSongs.length;

        const color = ALBUM_COLORS[eraId] || '#d4a853';
        const cover = ALBUM_COVERS[eraId];
        const albumPct   = totalUnits > 0 ? Math.round(albumUnits / totalUnits * 100) : 0;
        const singlesPct = 100 - albumPct;

        const thumb = cover
            ? `<img src="${cover}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;">`
            : `<div style="width:44px;height:44px;border-radius:6px;background:rgba(255,255,255,0.05);flex-shrink:0;"></div>`;

        return `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-top:3px solid ${color};border-radius:12px;padding:20px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                ${thumb}
                <div>
                    <div style="font-family:'Playfair Display',serif;font-weight:700;color:#fff;font-size:0.95rem;line-height:1.2;">${eraLabel}</div>
                    <div style="font-size:0.68rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">${singlesCount} single${singlesCount !== 1 ? 's' : ''} tracked</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                <div>
                    <div style="font-size:0.68rem;color:#666;text-transform:uppercase;letter-spacing:0.08em;">Album</div>
                    <div style="font-size:1rem;font-weight:700;color:#fff;font-family:'Space Grotesk',sans-serif;margin-top:2px;">${albumUnits ? albumUnits.toLocaleString() : '—'}</div>
                </div>
                <div>
                    <div style="font-size:0.68rem;color:#666;text-transform:uppercase;letter-spacing:0.08em;">Singles</div>
                    <div style="font-size:1rem;font-weight:700;color:#fff;font-family:'Space Grotesk',sans-serif;margin-top:2px;">${singlesUnits ? singlesUnits.toLocaleString() : '—'}</div>
                </div>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-bottom:10px;">
                <div style="font-size:0.68rem;color:#666;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Era Total</div>
                <div class="era-total" style="font-size:1.5rem;font-weight:900;color:${color};font-family:'Space Grotesk',sans-serif;">${totalUnits ? totalUnits.toLocaleString() : '—'}</div>
            </div>
            <div style="height:5px;border-radius:3px;background:rgba(255,255,255,0.07);overflow:hidden;display:flex;">
                <div style="height:100%;width:${albumPct}%;background:${color};"></div>
                <div style="height:100%;width:${singlesPct}%;background:rgba(255,255,255,0.18);"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:0.63rem;color:#555;font-family:'Space Grotesk',sans-serif;">
                <span>Album ${albumPct}%</span>
                <span>Singles ${singlesPct}%</span>
            </div>
        </div>`;
    }).join('');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    // Only fetch and render ONCE we have all the data. (Promise.all)
    const odometer = document.getElementById('grand-total-odometer');
    odometer.innerHTML = '<span class="text-2xl animate-pulse">Loading Live Data...</span>';
    
    await Promise.all([fetchVaultData(), fetchLiveStreams()]);
    
    if (YOUTUBE_API_KEY && jtData) {
        // Fetch album-level YouTube views — SADECE sertifikaya sayılan videolar.
        // (Total YouTube gösterimi script.js/streams.js'te tam listeyle hesaplanır.)
        await Promise.all(Object.keys(jtData.albums).map(async id => {
            const ids = filterCertVideoIds(jtData.albums[id].streams.youtubeVideoIds);
            if (ids.length > 0) {
                const live = await fetchRealYouTubeViews(ids);
                if (live > 0) jtData.albums[id].streams.youtube = live;
            }
        }));
        // Fetch per-song YouTube views (e.g. orphan tracks with individual video IDs)
        await Promise.all(vaultData.songs.map(async song => {
            const rawIds = (song.streams && song.streams.youtubeVideoIds) || song.youtubeVideoIds;
            const ids = filterCertVideoIds(rawIds);
            if (ids.length > 0) {
                const live = await fetchRealYouTubeViews(ids);
                if (live > 0) liveStreams.songs[song.id] = live;
            }
        }));
    }
    
    computeAllData();
    
    // Default sort: en çoktan en aza
    sortVault('albums', 'global', false);
    sortVault('songs', 'global', false);
    
    document.addEventListener('eraChanged', (_e) => {
        if (typeof window.currentEra !== 'undefined' && ALBUM_COLORS[window.currentEra]) {
            document.documentElement.style.setProperty('--accent-color', ALBUM_COLORS[window.currentEra]);
        }
    });

    if (typeof window.currentEra !== 'undefined' && ALBUM_COLORS[window.currentEra]) {
        document.documentElement.style.setProperty('--accent-color', ALBUM_COLORS[window.currentEra]);
    }
});
