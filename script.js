// --- 1. AYARLAR VE MAPPING ---
let jtData = null;
const ARTIST_RATIO = 1.82;
// script.js en üst kısım
let YOUTUBE_API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.YOUTUBE_API_KEY : "";
let MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";

// songToAlbumMap: song-map.js'ten geliyor (SONG_TO_ALBUM_MAP)
const songToAlbumMap = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};

// --- 2. MOTORLAR ---

// --- 2b. FIRESTORE YARDIMCILARI ---

function waitForFirestore(timeoutMs = 5000) {
    return new Promise(resolve => {
        if (typeof window.getLatestSnapshot === 'function') { resolve(true); return; }
        const timer = setTimeout(() => resolve(false), timeoutMs);
        window.addEventListener('firestore-ready', () => { clearTimeout(timer); resolve(true); }, { once: true });
    });
}

function getTodayUTC() {
    return new Date().toISOString().split('T')[0];
}

// Kworb'da JT credit'i kalkan track'leri Firestore bugün snapshot'ından merge et.
// JT'nin kworb sayfasında sadece "&" versiyonları var (504M + 0.7M Bob Sinclar);
// Madonna sayfasında "and" yazılan 4 versiyon JT total'ında YOK, onları ekleyeceğiz:
//   "4 Minutes (feat. Justin Timberlake and Timbaland)"          ~98M
//   "...and Timbaland) - Live"                                    ~1.9M
//   "...and Timbaland) - Peter Saves New York Edit"               ~1.5M
//   "...and Timbaland) - Junkie XL Remix Edit"                    ~1.0M
// "&" versiyonlarını filtre dışı bırakıyoruz (zaten JT total'ında).
function is4MinTrack(title) {
    const lc = title.toLowerCase();
    return lc.includes('4 minutes') &&
           lc.includes('justin timberlake') &&
           lc.includes('and timbaland'); // "&" versiyonu "& Timbaland" içerir, eşleşmez
}

function isRadioEditTrack(title) {
    const lc = title.toLowerCase();
    return lc.includes('not a bad thing') && lc.includes('radio edit');
}

// Fallback: Firestore'da bulamazsa son bilinen baseline + tahmini günlük büyüme.
const FALLBACK_4MIN = {
    baselineDate: '2026-04-23',
    baselineTotal: 102_400_000, // 4 versiyon toplamı (97.9M + 1.9M + 1.5M + 1.0M)
    dailyGrowth: 120_000
};

const FALLBACK_RADIO_EDIT = {
    baselineDate: '2026-05-24',
    baselineTotal: 118_417_347,
    dailyGrowth: 1_500
};

function getEstimated4MinTotal() {
    const days = Math.max(0, Math.round(
        (Date.now() - new Date(FALLBACK_4MIN.baselineDate + 'T00:00:00Z').getTime()) / 86400000
    ));
    return FALLBACK_4MIN.baselineTotal + days * FALLBACK_4MIN.dailyGrowth;
}

function getEstimatedRadioEditTotal() {
    const days = Math.max(0, Math.round(
        (Date.now() - new Date(FALLBACK_RADIO_EDIT.baselineDate + 'T00:00:00Z').getTime()) / 86400000
    ));
    return FALLBACK_RADIO_EDIT.baselineTotal + days * FALLBACK_RADIO_EDIT.dailyGrowth;
}

async function mergeExtraTracks(liveStats) {
    const ok = await waitForFirestore(3000);
    let total4Min = 0;
    let totalRadioEdit = 0;

    // Kworb'un JT sayfasında bu track'ler ZATEN varsa (credit geri geldiyse) tekrar
    // eklemek career total'i şişirir. Başlıkları normalize ederek kontrol et —
    // Kworb feature'ları "* " ile prefixliyor.
    const liveNorm = new Set((liveStats.trackTitles || []).map(normalizeKworbTitle));
    const alreadyHas4Min = [...liveNorm].some(is4MinTrack);
    const alreadyHasRadio = [...liveNorm].some(isRadioEditTrack);

    if (ok && typeof window.getLatestSnapshot === 'function') {
        const snap = await window.getLatestSnapshot();
        if (snap && snap.tracks) {
            let temp4Min = 0;
            let tempRadio = 0;
            const seen = new Set();
            for (const [title, vals] of Object.entries(snap.tracks)) {
                const norm = normalizeKworbTitle(title);
                if (seen.has(norm)) continue;   // snapshot içi mükerrer kayıtlar
                seen.add(norm);
                if (is4MinTrack(norm)) {
                    temp4Min += Number(vals.total) || 0;
                }
                if (isRadioEditTrack(norm)) {
                    tempRadio += Number(vals.total) || 0;
                }
            }
            total4Min = temp4Min;
            totalRadioEdit = tempRadio;
        }
    }

    const fromFirestore4Min = total4Min > 0;
    const fromFirestoreRadio = totalRadioEdit > 0;
    if (total4Min <= 0) total4Min = getEstimated4MinTotal();
    if (totalRadioEdit <= 0) totalRadioEdit = getEstimatedRadioEditTotal();

    if (alreadyHas4Min) total4Min = 0;
    if (alreadyHasRadio) totalRadioEdit = 0;
    if (total4Min === 0 && totalRadioEdit === 0) return;

    liveStats.TotalSpotify += (total4Min + totalRadioEdit);
    liveStats['Orphan'] += total4Min;
    // Note: in script.js, Part 2 is merged into "The 20/20 Experience"
    liveStats['The 20/20 Experience'] += totalRadioEdit;
    console.log(`[mergeExtraTracks] +${total4Min.toLocaleString('en-US')} 4Min (${fromFirestore4Min ? 'firestore' : 'fallback'}), +${totalRadioEdit.toLocaleString('en-US')} RadioEdit (${fromFirestoreRadio ? 'firestore' : 'fallback'}) → TotalSpotify: ${liveStats.TotalSpotify.toLocaleString('en-US')}`);
}

// --- 3. AKILLI PARSER ---
function smartParseKworb(input) {
    let stats = {
        trackTitles: [],   // mergeExtraTracks'in mükerrer enjeksiyon yapmaması için
        TotalSpotify: 0,
        "Justified": 0,
        "FutureSex/LoveSounds": 0,
        "The 20/20 Experience": 0,
        "Man of the Woods": 0,
        "Everything I Thought It Was": 0, // KASAMIZ BURADA
        "Orphan": 0
    };

    if (!input) return stats;
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, 'text/html');

    // Kworb'un tepesindeki GERÇEK TOPLAMI çek 
    const tables = doc.querySelectorAll('table');
    if (tables.length > 0) {
        const totalCell = tables[0].querySelectorAll('td')[1];
        if (totalCell) stats.TotalSpotify = parseInt(totalCell.textContent.replace(/,/g, ''), 10);
    }

    let assignedToRealAlbums = 0;
    const rows = doc.querySelectorAll('table.addpos tbody tr');
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 3) {
            let title = cols[0].textContent.trim();
            let val = parseInt(cols[1].textContent.replace(/,/g, ''), 10) || 0;

            if (!title) return;

            stats.trackTitles.push(title);
            let lowerTitle = title.toLowerCase();

            for (let key in songToAlbumMap) {
                if (lowerTitle.includes(key.toLowerCase())) {
                    let target = songToAlbumMap[key];
                    // Part 2'yi Part 1 era'sına dahil et
                    if (target === "The 20/20 Experience \u2013 2 of 2") target = "The 20/20 Experience";
                    if (stats[target] !== undefined) {
                        stats[target] += val;
                        if (target !== "Orphan") assignedToRealAlbums += val;
                    }
                    break;
                }
            }
        }
    });

    stats.Orphan = stats.TotalSpotify - assignedToRealAlbums;
    return stats;
}

function calculateRealCSPC(album) {
    const singlesEAS = (album.physicalSinglesEAS || 0) + (album.digitalSinglesEAS || 0);
    const spotify = album.streams.spotify || 0;
    const youtube = album.streams.youtube || 0;
    const audioEAS = (spotify * ARTIST_RATIO) / 1166;
    const videoEAS = youtube / 6750;

    return {
        totalEAS: Math.floor((album.pureSales || 0) + singlesEAS + audioEAS + videoEAS),
        spotifyStreams: spotify
    };
}

// --- 3. VERİ YÜKLEME VE DASHBOARD ---

const KWORB_CACHE_TTL = 60 * 60 * 1000; // 1 saat

function applyKworbStats(liveStats) {
    Object.keys(liveStats).forEach(key => {
        if (key !== "TotalSpotify" && key !== "Orphan" && jtData.albums[key]) {
            jtData.albums[key].streams.spotify = liveStats[key];
        }
    });
    if (jtData.albums["Orphan"]) {
        jtData.albums["Orphan"].streams.spotify = liveStats.Orphan;
    }
}

// vault.json'daki song-level YT ID'lerini album bazli birlestir.
// Diger chat flagship videolari (Mirrors, Cry Me a River, SexyBack vs.)
// vault.json'a tasidi; data.json album-level listeleri eksik kaliyor.
let _vaultYtCache = null;
async function loadVaultSongYtIds() {
    if (_vaultYtCache) return _vaultYtCache;
    try {
        const res = await fetch('data/vault.json');
        const v = await res.json();
        const map = {};  // albumName -> Set<videoId>
        for (const s of (v.songs || [])) {
            const ids = (s.streams && s.streams.youtubeVideoIds) || s.youtubeVideoIds;
            if (!ids || !ids.length) continue;
            let alb = s.album_id || 'Orphan';
            if (alb === 'The 20/20 Experience – 2 of 2') alb = 'The 20/20 Experience';
            if (!map[alb]) map[alb] = new Set();
            for (const id of ids) map[alb].add(id);
        }
        _vaultYtCache = map;
        return map;
    } catch (e) {
        console.warn('vault.json YT id load failed:', e);
        _vaultYtCache = {};
        return _vaultYtCache;
    }
}

function getCombinedYtIds(albumName, albumData) {
    const albumIds = (albumData.streams && albumData.streams.youtubeVideoIds) || [];
    const vaultIds = (_vaultYtCache && _vaultYtCache[albumName]) || new Set();
    const combined = new Set(albumIds);
    vaultIds.forEach(id => combined.add(id));
    return Array.from(combined);
}

async function fetchAllData() {
    try {
        // Cache kontrol: 1 saatten tazeyse hemen göster
        let cachedKworb = null;
        try {
            const raw = localStorage.getItem('jt_kworb_cache');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.ts < KWORB_CACHE_TTL) {
                    cachedKworb = parsed.data;
                }
            }
        } catch (_) {}

        // data.json + vault.json + (cache yoksa) Kworb'u PARALEL başlat — sıralı beklemek yerine.
        const dataPromise  = fetch('data.json').then(r => r.json());
        const vaultPromise = loadVaultSongYtIds();
        const kworbPromise = cachedKworb ? null : fetch(MY_DYNAMIC_API).then(r => r.text());

        // data.json + vault.json paralel bekle
        jtData = await dataPromise;
        await vaultPromise;

        // mergedStats: YouTube güncelleme callback'i için doğru (merge edilmiş) stats'ı tutar
        let mergedStats = null;

        if (cachedKworb) {
            // Cache varsa anında render et (extra track'leri merge et)
            await mergeExtraTracks(cachedKworb);
            applyKworbStats(cachedKworb);
            updateCareerOverview(cachedKworb);
            document.dispatchEvent(new Event('dataReady'));
            mergedStats = cachedKworb;
            // Arka planda yenile (sessizce)
            fetch(MY_DYNAMIC_API).then(r => r.text()).then(async html => {
                const fresh = smartParseKworb(html);
                try { localStorage.setItem('jt_kworb_cache', JSON.stringify({ ts: Date.now(), data: fresh })); } catch (_) {}
                await mergeExtraTracks(fresh);
                applyKworbStats(fresh);
                updateCareerOverview(fresh);
                mergedStats = fresh;
            }).catch(() => {});
        } else {
            // Cache yok — paralel başlatılan Kworb fetch'ini bekle
            const htmlText = await kworbPromise;
            const liveStats = smartParseKworb(htmlText);
            try { localStorage.setItem('jt_kworb_cache', JSON.stringify({ ts: Date.now(), data: liveStats })); } catch (_) {}
            await mergeExtraTracks(liveStats);
            applyKworbStats(liveStats);
            updateCareerOverview(liveStats);
            document.dispatchEvent(new Event('dataReady'));
            mergedStats = liveStats;
        }

        console.log("DİNAMİK GÜNCELLEME TAMAMLANDI! EITIW aktif.");

        // Arka planda YouTube'u çek, gelince EAS'ı güncelle
        // mergedStats kullan — localStorage'daki değil, 96M extra track'i içeren doğru stats
        //
        // İKİ AYRI HESAP:
        //  (1) Per-album: her albümün streams.youtube'u (EAS/CSPC hesabı için gerekli).
        //  (2) Headline toplam: TÜM video ID'lerinin GLOBAL DEDUPLICATED tek çekimi.
        //      Per-album toplamı, aynı video birden fazla albümde geçince MÜKERRER sayıp
        //      ~1B şişiriyordu (streams.html ile uyuşmuyordu). Global unique set bunu çözer.
        Promise.all([
            // (1) per-album
            Promise.all(Object.keys(jtData.albums).map(async albumName => {
                const ids = getCombinedYtIds(albumName, jtData.albums[albumName]);
                if (ids.length > 0) {
                    const live = await fetchRealYouTubeViews(ids);
                    if (live > 0) jtData.albums[albumName].streams.youtube = live;
                    console.log(`[YT] ${albumName}: ${ids.length} videos → ${live.toLocaleString('en-US')} views`);
                }
            })),
            // (2) global deduplicated headline toplamı
            (async () => {
                const globalIds = new Set();
                Object.keys(jtData.albums).forEach(albumName => {
                    getCombinedYtIds(albumName, jtData.albums[albumName]).forEach(id => globalIds.add(id));
                });
                if (globalIds.size > 0) {
                    const total = await fetchRealYouTubeViews([...globalIds]);
                    if (total > 0) jtData._youtubeTotalDedup = total;
                    console.log(`[YT headline] ${globalIds.size} unique videos → ${total.toLocaleString('en-US')} views`);
                }
            })()
        ]).then(() => {
            if (mergedStats) updateCareerOverview(mergedStats);
            console.log("YouTube verileri güncellendi.");
        }).catch(() => {});

    } catch (e) {
        console.error("Hata:", e);
        const errBanner = document.getElementById('api-error-banner');
        if (errBanner) errBanner.style.display = 'block';
    }
}

// --- GLOBAL TABLO DEĞİŞKENLERİ ---
let easTableData = [];
let currentEasSort = { key: 'total', asc: false };
let careerSnapshot = { totalEAS: 0, totalSpotify: 0, totalAOD: 0, totalYoutube: 0, bestEra: { name: '', eas: 0 } };

window.resetToCareer = function () {
    const s = careerSnapshot;
    if (!s.totalEAS) return;
    const title = document.querySelector('.cspc-title');
    if (title) title.textContent = 'Career Totals';
    animateValue(document.getElementById('eas-total'), 0, s.totalEAS, 600);
    animateValue(document.getElementById('spotify-total'), 0, s.totalSpotify, 600);
    animateValue(document.getElementById('aod-total'), 0, s.totalAOD, 600);
    animateValue(document.getElementById('youtube-total'), 0, s.totalYoutube, 600);
    const bestEraNameEl = document.getElementById('best-era-name');
    const bestEraValEl = document.getElementById('best-era-val');
    if (bestEraNameEl) bestEraNameEl.textContent = s.bestEra.name;
    if (bestEraValEl) bestEraValEl.textContent = s.bestEra.eas.toLocaleString('en-US') + ' EAS';
    const btn = document.getElementById('deep-analytics-btn');
    if (btn) btn.href = 'streams.html';
};

function updateCareerOverview(liveStats) {
    let careerTotalEAS = 0;
    let bestEra = { name: "", eas: 0 };
    let totalYoutube = 0;
    let totalAOD = Math.round(liveStats.TotalSpotify * ARTIST_RATIO);
    easTableData = []; // Tablo verisini her güncellemede sıfırla

    Object.keys(jtData.albums).forEach(id => {
        const albumData = jtData.albums[id];
        const stats = calculateRealCSPC(albumData);
        careerTotalEAS += stats.totalEAS;
        totalYoutube += (albumData.streams.youtube || 0);

        if (stats.totalEAS > bestEra.eas) {
            bestEra = { name: id, eas: stats.totalEAS };
        }

        // TABLO İÇİN GERÇEK VERİLERİ (data.json'dan) HAZIRLA
        const pure = albumData.pureSales || 0;
        const physEAS = albumData.physicalSinglesEAS || 0;
        const dlEAS = albumData.digitalSinglesEAS || 0;
        const physSingles = Math.round(physEAS * (10 / 3));   // EAS → orjinal adet
        const dlSingles = Math.round(dlEAS * (20 / 3));   // EAS → orjinal adet
        const singlesEAS = physEAS + dlEAS;
        const audio = Math.floor(((albumData.streams.spotify || 0) * ARTIST_RATIO) / 1166);

        easTableData.push({
            album: id,
            pure: pure,
            physSingles: physSingles,
            dlSingles: dlSingles,
            singles: singlesEAS,
            audio: audio,
            total: stats.totalEAS,
            year: albumData.year
        });
    });

    // 20/20 → "The 20/20 Experience (Complete Experience)"
    const pt1 = easTableData.find(r => r.album === "The 20/20 Experience");
    if (pt1) pt1.album = "The 20/20 Experience (Complete Experience)";
    if (bestEra.name === "The 20/20 Experience \u2013 2 of 2") bestEra.name = "The 20/20 Experience (Complete Experience)";
    if (bestEra.name === "The 20/20 Experience") bestEra.name = "The 20/20 Experience (Complete Experience)";

    // Headline YouTube: global deduplicated değer varsa onu kullan (per-album toplamı
    // mükerrer video ID'lerini saydığı için şişik olabiliyor; streams.html ile tutarlılık).
    const headlineYoutube = (jtData._youtubeTotalDedup && jtData._youtubeTotalDedup > 0)
        ? jtData._youtubeTotalDedup
        : totalYoutube;

    careerSnapshot = { totalEAS: careerTotalEAS, totalSpotify: liveStats.TotalSpotify, totalAOD, totalYoutube: headlineYoutube, bestEra };

    // AI crawler için statik veri bölümünü güncelle
    const aiEasEl = document.getElementById('ai-eas-value');
    if (aiEasEl) aiEasEl.textContent = (careerTotalEAS / 1_000_000).toFixed(2) + 'M';

    animateValue(document.getElementById('eas-total'), 0, careerTotalEAS, 600);
    animateValue(document.getElementById('spotify-total'), 0, liveStats.TotalSpotify, 600);
    animateValue(document.getElementById('aod-total'), 0, totalAOD, 600);
    animateValue(document.getElementById('youtube-total'), 0, headlineYoutube, 600);

    const bestEraNameEl = document.getElementById('best-era-name');
    const bestEraValEl = document.getElementById('best-era-val');
    if (bestEraNameEl) bestEraNameEl.textContent = bestEra.name;
    if (bestEraValEl) bestEraValEl.textContent = (bestEra.eas / 1_000_000).toFixed(2) + 'M EAS';

    // Eğer sayfada tablo varsa, hemen 'Total'a göre sıralayıp ekrana bas
    if (document.getElementById('eas-table-body')) {
        sortEasTable('total');
    }

    currentEasSort.asc = true;
    sortEasTable('album');
}

// --- 4. UI ETKİLEŞİMLERİ ---

async function playAlbum(albumName) {
    const albumData = jtData.albums[albumName];
    if (!albumData) return;

    // YouTube Güncelleme (data.json + vault.json song-level birlesik)
    const ytIds = getCombinedYtIds(albumName, albumData);
    if (ytIds.length > 0) {
        albumData.streams.youtube = await fetchRealYouTubeViews(ytIds);
    }

    const stats = calculateRealCSPC(albumData);

    document.querySelector('.cspc-title').textContent = albumName + " Era";
    animateValue(document.getElementById('eas-total'), 0, stats.totalEAS, 1000);
    animateValue(document.getElementById('spotify-total'), 0, stats.spotifyStreams, 1000);
    animateValue(document.getElementById('aod-total'), 0, Math.round(stats.spotifyStreams * ARTIST_RATIO), 1000);
    animateValue(document.getElementById('youtube-total'), 0, albumData.streams.youtube || 0, 1000);

    // "View Deep Analytics" butonunu seçili albüme yönlendir
    const btn = document.getElementById('deep-analytics-btn');
    if (btn) btn.href = 'album.html?id=' + encodeURIComponent(albumName);

    updateEraTheme(albumName); // Tema motorunu ateşler

    // ==========================================
    // 📱 MOBİL UX: OTOMATİK PANEL KAYDIRMA MOTORU
    // ==========================================
    if (window.innerWidth < 768) {
        const dashboardPanel = document.querySelector('.cspc-dashboard');
        if (dashboardPanel) {
            const navEl = document.querySelector('nav');
            const navHeight = navEl ? navEl.offsetHeight + 10 : 150; // dinamik nav yüksekliği
            const panelPosition = dashboardPanel.getBoundingClientRect().top + window.scrollY - navHeight;

            // Jilet gibi yumuşak kaydırma
            window.scrollTo({
                top: panelPosition,
                behavior: 'smooth'
            });
        }
    }
}

// YouTube API
async function fetchRealYouTubeViews(ids) {
    const url = `/api/youtube?ids=${ids.join(',')}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.views || 0;
    } catch (e) { return 0; }
}

function animateValue(obj, start, end, duration) {
    if (!obj || isNaN(end)) return; // NaN kontrolü
    // Arka plan sekmesinde requestAnimationFrame tetiklenmiyor → sayaç 0'da donuyordu.
    if (typeof document !== 'undefined' && document.hidden) {
        obj.innerHTML = Math.floor(end).toLocaleString('en-US');
        return;
    }
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

const ALBUM_COLORS = {
    "Justified": "#5dade2",
    "FutureSex/LoveSounds": "#e74c3c",
    "The 20/20 Experience": "#d4a853",
    "Man of the Woods": "#e67e22",
    "Everything I Thought It Was": "#ca510f",
    "Orphan": "#bdc3c7"
};

function initCardThemes() {
    document.querySelectorAll('.album-card[data-album]').forEach(card => {
        const color = ALBUM_COLORS[card.dataset.album];
        if (!color) return;
        card.style.setProperty('--card-color', color);
        card.querySelectorAll('.album-year, .album-name').forEach(el => {
            el.style.color = color;
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initCardThemes();
    fetchAllData();
});

// --- 5. DİNAMİK ERA TEMASI (FULL TAKEOVER MOTORU) ---
function updateEraTheme(albumName) {
    if (typeof window.applyEraTheme === 'function') {
        window.applyEraTheme(albumName);
    }
}

// --- 6. EAS TABLO MOTORU VE SIRALAMA ALGORİTMASI ---

const albumCovers = {
    "Justified": "assets/justified.jpg",
    "FutureSex/LoveSounds": "assets/fsls.jpg",
    "The 20/20 Experience": "assets/the20.jpg",
    "The 20/20 Experience (Complete Experience)": "assets/the20.jpg",
    "Man of the Woods": "assets/motw.jpg",
    "Everything I Thought It Was": "assets/eitiw.jpg",
    "Orphan": null
};

function albumThumbHTML(name) {
    const src = albumCovers[name];
    if (src) {
        return `<img src="${src}" alt="${name} album cover" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;display:block;">`;
    }
    return `<div style="width:40px;height:40px;border-radius:4px;background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);flex-shrink:0;"></div>`;
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString('en-US');
}

function renderEasTable() {
    const tbody = document.getElementById('eas-table-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    let grandPure = 0, grandPhys = 0, grandDl = 0, grandSingles = 0, grandAudio = 0, grandTotal = 0;

    easTableData.forEach(row => {
        grandPure += row.pure;
        grandPhys += row.physSingles;
        grandDl += row.dlSingles;
        grandSingles += row.singles;
        grandAudio += row.audio;
        grandTotal += row.total;

        const TD = `padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02);`;
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="${TD} white-space:nowrap;">
                <div style="display:flex;align-items:center;gap:12px;">
                    ${albumThumbHTML(row.album)}
                    <span style="font-weight:700;color:#fff;">${row.album}</span>
                </div>
            </td>
            <td style="${TD}">${fmtNum(row.pure)}</td>
            <td style="${TD}">
                ${fmtNum(row.physSingles)}
                <div style="font-size:0.7rem;color:#aaa;margin-top:2px;">≈ ${fmtNum(row.physSingles > 0 ? Math.round(row.physSingles * 3 / 10) : 0)} EAS</div>
            </td>
            <td style="${TD}">
                ${fmtNum(row.dlSingles)}
                <div style="font-size:0.7rem;color:#aaa;margin-top:2px;">≈ ${fmtNum(row.dlSingles > 0 ? Math.round(row.dlSingles * 1.5 / 10) : 0)} EAS</div>
            </td>
            <td style="${TD}; color: #4ade80;">+${fmtNum(row.audio)}</td>
            <td class="cell-era-total" style="${TD}; color: #d4a853; font-weight: 700;">${fmtNum(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    let footerTr = document.createElement('tr');
    footerTr.className = 'grand-total-row';
    footerTr.innerHTML = `
        <td class="cell-era-total" style="padding: 20px 0; font-weight: 900; color: #d4a853; text-transform: uppercase; white-space:nowrap;">Grand Total</td>
        <td style="padding: 20px 0; font-weight: 700; color: #fff;">${fmtNum(grandPure)}</td>
        <td style="padding: 20px 0; font-weight: 700; color: #fff;">${fmtNum(grandPhys)}</td>
        <td style="padding: 20px 0; font-weight: 700; color: #fff;">${fmtNum(grandDl)}</td>
        <td style="padding: 20px 0; font-weight: 700; color: #4ade80;">+${fmtNum(grandAudio)}</td>
        <td class="cell-era-total" style="padding: 20px 0; font-weight: 900; color: #d4a853; font-size: 1.2rem;">${fmtNum(grandTotal)}</td>
    `;
    tbody.appendChild(footerTr);
}

window.sortEasTable = function (key) {
    if (currentEasSort.key === key) {
        currentEasSort.asc = !currentEasSort.asc;
    } else {
        currentEasSort.key = key;
        // Eğer 'album' (yıl) seçildiyse varsayılan olarak eskiden yeniye (true) başla
        // Diğer rakamsal verilerde (pure, total vb.) büyükten küçüğe (false) başla
        currentEasSort.asc = (key === 'album');
    }

    easTableData.sort((a, b) => {
        if (key === 'album') {
            // "Various" gibi string year'ları en sona gönder
            const ya = isNaN(Number(a.year)) ? 9999 : Number(a.year);
            const yb = isNaN(Number(b.year)) ? 9999 : Number(b.year);
            return currentEasSort.asc ? ya - yb : yb - ya;
        }

        let valA = a[key];
        let valB = b[key];
        return currentEasSort.asc ? valA - valB : valB - valA;
    });

    renderEasTable();
};

// Klavye erişilebilirliği: album kartları için Enter/Space
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.album-card');
    if (!card) return;
    e.preventDefault();
    card.click();
});
