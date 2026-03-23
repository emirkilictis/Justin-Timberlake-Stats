// --- 1. AYARLAR VE MAPPING ---
let jtData = null;
const ARTIST_RATIO = 1.65; 
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

    // Kworb'un tepesindeki GERÇEK TOPLAMI çek (17.2B)
    const tables = doc.querySelectorAll('table');
    if (tables.length > 0) {
        const totalCell = tables[0].querySelectorAll('td')[1];
        if (totalCell) stats.TotalSpotify = parseInt(totalCell.textContent.replace(/,/g, ''), 10);
    }

    let assignedToAlbums = 0;
    const rows = doc.querySelectorAll('table.addpos tbody tr');
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
            let title = cols[0].textContent.trim();
            let val = parseInt(cols[1].textContent.replace(/,/g, ''), 10);
            
            for (let key in songToAlbumMap) {
                if (title.includes(key)) {
                    // Güvenlik kontrolü ile ekle
                    if (stats[songToAlbumMap[key]] !== undefined) {
                        stats[songToAlbumMap[key]] += val;
                        assignedToAlbums += val;
                    }
                    break;
                }
            }
        }
    });

    stats.Orphan = stats.TotalSpotify - assignedToAlbums;
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

async function fetchAllData() {
    try {
        const response = await fetch('data.json');
        jtData = await response.json();

        const kworbRes = await fetch(MY_DYNAMIC_API);
        const htmlText = await kworbRes.text();
        const liveStats = smartParseKworb(htmlText);

        // İŞTE ÇÖZÜM: Hardcode yerine otomatik ve dinamik dağıtım!
        Object.keys(liveStats).forEach(key => {
            // Total ve Orphan hariç tüm albümleri otomatik eşle
            if (key !== "TotalSpotify" && key !== "Orphan" && jtData.albums[key]) {
                jtData.albums[key].streams.spotify = liveStats[key];
            }
        });

        // Orphan özel durumu
        if (jtData.albums["Orphan"]) {
            jtData.albums["Orphan"].streams.spotify = liveStats.Orphan;
        }

        // Tüm albümlerin YouTube verilerini paralel çek
        if (YOUTUBE_API_KEY) {
            await Promise.all(Object.keys(jtData.albums).map(async id => {
                const ids = jtData.albums[id].streams.youtubeVideoIds;
                if (ids && ids.length > 0) {
                    jtData.albums[id].streams.youtube = await fetchRealYouTubeViews(ids);
                }
            }));
        }

        updateCareerOverview(liveStats);
        console.log("DİNAMİK GÜNCELLEME TAMAMLANDI! EITIW aktif.");

    } catch (e) {
        console.error("Hata:", e);
        const errBanner = document.getElementById('api-error-banner');
        if (errBanner) errBanner.style.display = 'block';
    }
}

// --- GLOBAL TABLO DEĞİŞKENLERİ ---
let easTableData = [];
let currentEasSort = { key: 'total', asc: false };

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
        const dlEAS   = albumData.digitalSinglesEAS  || 0;
        const physSingles = Math.round(physEAS * (10 / 3));   // EAS → orjinal adet
        const dlSingles   = Math.round(dlEAS   * (20 / 3));   // EAS → orjinal adet
        const singlesEAS  = physEAS + dlEAS;
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

    animateValue(document.getElementById('eas-total'), 0, careerTotalEAS, 600);
    animateValue(document.getElementById('spotify-total'), 0, liveStats.TotalSpotify, 600);

    const bestEraNameEl = document.getElementById('best-era-name');
    const bestEraValEl  = document.getElementById('best-era-val');
    if (bestEraNameEl) bestEraNameEl.textContent = bestEra.name;
    if (bestEraValEl)  bestEraValEl.textContent  = (bestEra.eas / 1_000_000).toFixed(2) + 'M EAS';

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
            const navEl     = document.querySelector('nav');
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
    } catch(e) { return 0; }
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
    "Justified":                   "#5dade2",
    "FutureSex/LoveSounds":        "#e74c3c",
    "The 20/20 Experience":        "#d4a853",
    "Man of the Woods":            "#e67e22",
    "Everything I Thought It Was": "#ca510f",
    "Orphan":                      "#bdc3c7"
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
    const themes = {
        "Justified":                  { color: "#5dade2", glow: "rgba(93,173,226,0.15)",  cover: "assets/justified.jpg" },
        "FutureSex/LoveSounds":       { color: "#e74c3c", glow: "rgba(231,76,60,0.15)",   cover: "assets/fsls.jpg" },
        "The 20/20 Experience":       { color: "#d4a853", glow: "rgba(212,168,83,0.15)",  cover: "assets/the20.jpg" },
        "Man of the Woods":           { color: "#e67e22", glow: "rgba(230,126,34,0.15)",  cover: "assets/motw.jpg" },
        "Everything I Thought It Was":{ color: "#ca510f", glow: "rgba(225,86,22,0.15)",   cover: "assets/eitiw.jpg" },
        "Orphan":                     { color: "#bdc3c7", glow: "rgba(189,195,199,0.15)", cover: null }
    };

    const t = themes[albumName] || themes["The 20/20 Experience"];
    const c = t.color;

    // 1. CSS değişkeni
    document.documentElement.style.setProperty('--accent-bronze', c);
    document.documentElement.style.setProperty('--accent-gold', c);

    // 2. Body arka plan glow
    const glowColor = t.color + '55';
    document.body.style.background = `radial-gradient(ellipse 120% 60% at 50% 0%, ${glowColor} 0%, #0a0a0f 65%)`;
    document.body.style.backgroundAttachment = "fixed";

    // 3. Hero arkaplan → albüm kapağı
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) {
        const imgUrl = t.cover ? `url('${t.cover}')` : "url('assets/jt-hero.jpg')";
        heroBg.style.transition = 'opacity 0.6s ease';
        heroBg.style.backgroundImage = `linear-gradient(to right, rgba(10,10,15,0.88) 30%, rgba(10,10,15,0.45) 100%), linear-gradient(to bottom, transparent 60%, #0a0a0f 100%), ${imgUrl}`;
        heroBg.style.backgroundSize = 'cover';
        heroBg.style.backgroundPosition = 'center 20%';
    }

    // 4. Dynamic style tag — tüm sayfa
    let styleTag = document.getElementById('era-dynamic-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'era-dynamic-style';
        document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
        * { transition: color 0.4s ease, border-color 0.4s ease, background-color 0.4s ease; }

        /* Nav */
        .logo { color: ${c} !important; text-shadow: 0 0 20px ${c}40; }
        .nav-links a:hover, .nav-links a.active { color: ${c} !important; }

        /* Hero */
        .hero-subtitle { color: ${c} !important; }
        .hero-title span:nth-child(2) { -webkit-text-stroke: 2px ${c} !important; color: transparent !important; }
        .hero-year { color: ${c} !important; opacity: 0.6; }
        .scroll-line { background: ${c} !important; }

        /* Section başlıkları */
        .section-title { color: #fff !important; }
        .section-title::before { color: ${c} !important; }

        /* CSPC dashboard */
        #eas-total, .stat-value, .cspc-title { color: ${c} !important; }
        .cspc-header { border-left: 4px solid ${c} !important; padding-left: 15px; }
        .stat-label { color: rgba(255,255,255,0.4) !important; }

        /* CSPC tablo */
        .analytics-row h2 { color: ${c} !important; }
        th[onclick]:hover { color: #fff !important; }

        /* Albüm kartları — kendi renkleriyle hover */
        .album-card:hover { border-color: var(--card-color) !important; box-shadow: 0 10px 40px var(--card-color) !important; }

        /* Butonlar */
        .era-btn {
            display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 8px;
            font-family: 'Space Grotesk', sans-serif; font-weight: 700;
            background: rgba(10,10,15,0.95); color: ${c} !important; border: 1px solid ${c};
            transition: all 0.3s ease; cursor: pointer;
        }
        .era-btn:hover { background: ${c} !important; color: #111 !important; box-shadow: 0 0 25px ${c}; }

        /* Official Label figures */
        .label-figure { color: ${c} !important; }

        /* CSPC Total EAS kolonu + Grand Total */
        .cell-era-total { color: ${c} !important; }
        .grand-total-row { background: ${c}18 !important; border-top-color: ${c} !important; }

        /* Guestbook bölümü */
        .guestbook { border-top-color: ${c}33 !important; }
        .guestbook h2 { color: ${c} !important; }
        #guest-name, #guest-msg { border-color: ${c}55 !important; }
        #guest-name:focus, #guest-msg:focus { border-color: ${c} !important; box-shadow: 0 0 10px ${c}33; }
        #visitor-count { color: ${c} !important; }
        .comment-card { border-left-color: ${c} !important; }
        .comment-author { color: ${c} !important; }

        /* Timeline & diğer bölümler */
        .timeline-dot, .timeline-year { color: ${c} !important; }
        .timeline-line { background: ${c}44 !important; }
    `;
}

// --- 6. EAS TABLO MOTORU VE SIRALAMA ALGORİTMASI ---

const albumCovers = {
    "Justified": "assets/justified.jpg",
    "FutureSex/LoveSounds": "assets/fsls.jpg",
    "The 20/20 Experience": "assets/the20.jpg",
    "Man of the Woods": "assets/motw.jpg",
    "Everything I Thought It Was": "assets/eitiw.jpg",
    "Orphan": null
};

function albumThumbHTML(name) {
    const src = albumCovers[name];
    if (src) {
        return `<img src="${src}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;display:block;">`;
    }
    return `<div style="width:40px;height:40px;border-radius:4px;background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);flex-shrink:0;"></div>`;
}

function fmtNum(n) {
    if (window.innerWidth >= 768) return n.toLocaleString('en-US');
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)         return Math.round(n / 1_000) + 'K';
    return String(n);
}

function renderEasTable() {
    const tbody = document.getElementById('eas-table-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    let grandPure = 0, grandPhys = 0, grandDl = 0, grandSingles = 0, grandAudio = 0, grandTotal = 0;

    easTableData.forEach(row => {
        grandPure    += row.pure;
        grandPhys    += row.physSingles;
        grandDl      += row.dlSingles;
        grandSingles += row.singles;
        grandAudio   += row.audio;
        grandTotal   += row.total;

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
                <div style="font-size:0.7rem;color:#aaa;margin-top:2px;">≈ ${fmtNum(row.physSingles > 0 ? Math.round(row.physSingles * 3/10) : 0)} EAS</div>
            </td>
            <td style="${TD}">
                ${fmtNum(row.dlSingles)}
                <div style="font-size:0.7rem;color:#aaa;margin-top:2px;">≈ ${fmtNum(row.dlSingles > 0 ? Math.round(row.dlSingles * 1.5/10) : 0)} EAS</div>
            </td>
            <td style="${TD}; color: #4ade80;">+${fmtNum(row.audio)}</td>
            <td class="cell-era-total" style="${TD}; color: #d4a853; font-weight: 700;">${fmtNum(row.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    let footerTr = document.createElement('tr');
    footerTr.className = 'grand-total-row';
    footerTr.style.background = "rgba(212, 168, 83, 0.1)";
    footerTr.style.borderTop = "2px solid #d4a853";
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

window.sortEasTable = function(key) {
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

