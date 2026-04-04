// --- 1. AYARLAR VE MAPPING ---
let jtData = null;
const ARTIST_RATIO = 1.82;
// script.js en üst kısım
let YOUTUBE_API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.YOUTUBE_API_KEY : "";
let MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";

// songToAlbumMap: song-map.js'ten geliyor (SONG_TO_ALBUM_MAP)
const songToAlbumMap = typeof SONG_TO_ALBUM_MAP !== 'undefined' ? SONG_TO_ALBUM_MAP : {};

// --- 2. MOTORLAR ---

// --- 3. AKILLI PARSER ---
function smartParseKworb(input) {
    let stats = {
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

async function fetchAllData() {
    try {
        // data.json'u her zaman çek (local, hızlı)
        const dataRes = await fetch('data.json');
        jtData = await dataRes.json();

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

        if (cachedKworb) {
            // Cache varsa anında render et
            applyKworbStats(cachedKworb);
            updateCareerOverview(cachedKworb);
            document.dispatchEvent(new Event('dataReady'));
            // Arka planda yenile (sessizce)
            fetch(MY_DYNAMIC_API).then(r => r.text()).then(html => {
                const fresh = smartParseKworb(html);
                try { localStorage.setItem('jt_kworb_cache', JSON.stringify({ ts: Date.now(), data: fresh })); } catch (_) {}
                applyKworbStats(fresh);
                updateCareerOverview(fresh);
            }).catch(() => {});
        } else {
            // Cache yok, API'yi bekle
            const kworbRes = await fetch(MY_DYNAMIC_API);
            const htmlText = await kworbRes.text();
            const liveStats = smartParseKworb(htmlText);
            try { localStorage.setItem('jt_kworb_cache', JSON.stringify({ ts: Date.now(), data: liveStats })); } catch (_) {}
            applyKworbStats(liveStats);
            updateCareerOverview(liveStats);
            document.dispatchEvent(new Event('dataReady'));
        }

        console.log("DİNAMİK GÜNCELLEME TAMAMLANDI! EITIW aktif.");

        // Arka planda YouTube'u çek, gelince EAS'ı güncelle
        if (YOUTUBE_API_KEY) {
            const liveStats = cachedKworb || (() => { try { return JSON.parse(localStorage.getItem('jt_kworb_cache') || '{}').data || {}; } catch(_) { return {}; } })();
            Promise.all(Object.keys(jtData.albums).map(async id => {
                const ids = jtData.albums[id].streams.youtubeVideoIds;
                if (ids && ids.length > 0) {
                    const live = await fetchRealYouTubeViews(ids);
                    if (live > 0) jtData.albums[id].streams.youtube = live;
                }
            })).then(() => {
                updateCareerOverview(liveStats);
                console.log("YouTube verileri güncellendi.");
            }).catch(() => {});
        }

    } catch (e) {
        console.error("Hata:", e);
        const errBanner = document.getElementById('api-error-banner');
        if (errBanner) errBanner.style.display = 'block';
    }
}

// --- GLOBAL TABLO DEĞİŞKENLERİ ---
let easTableData = [];
let currentEasSort = { key: 'total', asc: false };
let careerSnapshot = { totalEAS: 0, totalSpotify: 0, bestEra: { name: '', eas: 0 } };

window.resetToCareer = function () {
    const s = careerSnapshot;
    if (!s.totalEAS) return;
    const title = document.querySelector('.cspc-title');
    if (title) title.textContent = 'Career Totals';
    animateValue(document.getElementById('eas-total'), 0, s.totalEAS, 600);
    animateValue(document.getElementById('spotify-total'), 0, s.totalSpotify, 600);
    const bestEraNameEl = document.getElementById('best-era-name');
    const bestEraValEl = document.getElementById('best-era-val');
    if (bestEraNameEl) bestEraNameEl.textContent = s.bestEra.name;
    if (bestEraValEl) bestEraValEl.textContent = (s.bestEra.eas / 1_000_000).toFixed(2) + 'M EAS';
    const btn = document.getElementById('deep-analytics-btn');
    if (btn) btn.href = 'streams.html';
};

function updateCareerOverview(liveStats) {
    let careerTotalEAS = 0;
    let bestEra = { name: "", eas: 0 };
    easTableData = []; // Tablo verisini her güncellemede sıfırla

    Object.keys(jtData.albums).forEach(id => {
        const albumData = jtData.albums[id];
        const stats = calculateRealCSPC(albumData);
        careerTotalEAS += stats.totalEAS;

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

    careerSnapshot = { totalEAS: careerTotalEAS, totalSpotify: liveStats.TotalSpotify, bestEra };

    // AI crawler için statik veri bölümünü güncelle
    const aiEasEl = document.getElementById('ai-eas-value');
    if (aiEasEl) aiEasEl.textContent = (careerTotalEAS / 1_000_000).toFixed(2) + 'M';

    animateValue(document.getElementById('eas-total'), 0, careerTotalEAS, 600);
    animateValue(document.getElementById('spotify-total'), 0, liveStats.TotalSpotify, 600);

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

    // YouTube Güncelleme (Video ID varsa)
    if (albumData.streams.youtubeVideoIds) {
        albumData.streams.youtube = await fetchRealYouTubeViews(albumData.streams.youtubeVideoIds);
    }

    const stats = calculateRealCSPC(albumData);

    document.querySelector('.cspc-title').textContent = albumName + " Era";
    animateValue(document.getElementById('eas-total'), 0, stats.totalEAS, 1000);
    animateValue(document.getElementById('spotify-total'), 0, stats.spotifyStreams, 1000);

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
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.items.reduce((sum, item) => sum + parseInt(item.statistics.viewCount), 0);
    } catch (e) { return 0; }
}

function animateValue(obj, start, end, duration) {
    if (!obj || isNaN(end)) return; // NaN kontrolü
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);

        if (end >= 1000000000 && obj.id === 'spotify-total') {
            obj.innerHTML = (current / 1000000000).toFixed(2) + 'B';
        } else {
            obj.innerHTML = current.toLocaleString('en-US');
        }
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
    if (window.innerWidth >= 768) return n.toLocaleString('en-US');
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return Math.round(n / 1_000) + 'K';
    return String(n);
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
