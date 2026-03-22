// --- 1. AYARLAR VE MAPPING ---
let jtData = null; 
const ARTIST_RATIO = 1.65; 
// script.js en üst kısım
let YOUTUBE_API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.YOUTUBE_API_KEY : "";
let MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";

const songToAlbumMap = {
    // --- JUSTIFIED (2002) ---
    "Like I Love You": "Justified",
    "Cry Me a River": "Justified",
    "Rock Your Body": "Justified",
    "Señorita": "Justified",
    "Last Night": "Justified",
    "Take It From Here": "Justified",
    "Still On My Brain": "Justified",
    "(And She Said) Take Me Now": "Justified",
    "Right For Me": "Justified",
    "Nothin' Else": "Justified",
    "Never Again": "Justified",
    "Like I Love You - Basement Jaxx Vocal Mix": "Justified",
    "Rock Your Body - Paul Oakenfold Mix": "Justified",
    "Señorita - Radio Edit": "Justified",

    // --- FUTURESEX / LOVESOUNDS (2006) ---
    "SexyBack (feat. Timbaland)": "FutureSex/LoveSounds",
    "My Love (feat. T.I.)": "FutureSex/LoveSounds",
    "What Goes Around.../...Comes Around (Interlude)": "FutureSex/LoveSounds",
    "Summer Love": "FutureSex/LoveSounds",
    "Until The End Of Time (with Beyoncé)": "FutureSex/LoveSounds",
    "LoveStoned / I Think She Knows Interlude": "FutureSex/LoveSounds",
    "Chop Me Up (feat. Timbaland & Three-6 Mafia)": "FutureSex/LoveSounds",
    "FutureSex / LoveSound": "FutureSex/LoveSounds",
    "Losing My Way": "FutureSex/LoveSounds",
    "Sexy Ladies": "FutureSex/LoveSounds",
    "Boutique In Heaven": "FutureSex/LoveSounds",
    "What Goes Around...Comes Around - Radio Edit": "FutureSex/LoveSounds",
    "LoveStoned / I Think She Knows - Radio Edit": "FutureSex/LoveSounds",
    "SexyBack (feat. Timbaland) - Linus Loves Remix (Edit)": "FutureSex/LoveSounds",

    // --- THE 20/20 EXPERIENCE (Pt 1 & 2) ---
    "Mirrors": "The 20/20 Experience",
    "Suit & Tie (feat. JAY-Z)": "The 20/20 Experience",
    "Not a Bad Thing": "The 20/20 Experience",
    "TKO": "The 20/20 Experience",
    "Drink You Away": "The 20/20 Experience",
    "Pusher Love Girl": "The 20/20 Experience",
    "Tunnel Vision": "The 20/20 Experience",
    "Take Back the Night": "The 20/20 Experience",
    "Murder (feat. JAY-Z)": "The 20/20 Experience",
    "Strawberry Bubblegum": "The 20/20 Experience",
    "Don't Hold the Wall": "The 20/20 Experience",
    "Let the Groove Get In": "The 20/20 Experience",
    "Blue Ocean Floor": "The 20/20 Experience",
    "Amnesia": "The 20/20 Experience",
    "True Blood": "The 20/20 Experience",
    "Only When I Walk Away": "The 20/20 Experience",
    "Cabaret (feat. Drake)": "The 20/20 Experience",
    "You Got It On": "The 20/20 Experience",
    "Gimme What I Don't Know (I Want)": "The 20/20 Experience",
    "Dress On": "The 20/20 Experience",
    "That Girl": "The 20/20 Experience",
    "Spaceship Coupe": "The 20/20 Experience",
    "TKO (Black Friday Remix) (feat. J. Cole, A$AP Rocky & Pusha T)": "The 20/20 Experience",
    "Mirrors - Radio Edit": "The 20/20 Experience",

    // --- MAN OF THE WOODS (2018) ---
    "Say Something (feat. Chris Stapleton)": "Man of the Woods",
    "Filthy": "Man of the Woods",
    "Man of the Woods": "Man of the Woods",
    "Supplies": "Man of the Woods",
    "Morning Light (feat. Alicia Keys)": "Man of the Woods",
    "Higher Higher": "Man of the Woods",
    "Midnight Summer Jam": "Man of the Woods",
    "Sauce": "Man of the Woods",
    "Wave": "Man of the Woods",
    "Montana": "Man of the Woods",
    "Flannel": "Man of the Woods",
    "Young Man": "Man of the Woods",
    "Breeze Off the Pond": "Man of the Woods",
    "The Hard Stuff": "Man of the Woods",
    "Hers (interlude)": "Man of the Woods",
    "Livin' Off the Land": "Man of the Woods",

    // YENİ: EITIW ERASI EKLENDİ
    "Memphis": "Everything I Thought It Was",
    "Selfish": "Everything I Thought It Was",
    "No Angels": "Everything I Thought It Was",
    "Drown": "Everything I Thought It Was",
    "F**kin' Up The Disco": "Everything I Thought It Was",
    "Play": "Everything I Thought It Was",
    "Technicolor": "Everything I Thought It Was",
    "Sanctified": "Everything I Thought It Was",
    "Liar": "Everything I Thought It Was",
    "Imagination": "Everything I Thought It Was",
    "What Lovers Do": "Everything I Thought It Was",
    "My Favorite Drug": "Everything I Thought It Was",
    "Flame": "Everything I Thought It Was",
    "Infinity Sex": "Everything I Thought It Was",
    "Love & War": "Everything I Thought It Was",
    "Alone": "Everything I Thought It Was",
    "Conditions": "Everything I Thought It Was",
    "Paradise" : "Everything I Thought It Was",

    // --- ORPHAN / FEATURES / NEW (EITIW) ---
    "CAN'T STOP THE FEELING! (from DreamWorks Animation's \"TROLLS\")": "Orphan / Features",
    "Give It To Me": "Orphan / Features",
    "4 Minutes (feat. Justin Timberlake & Timbaland)": "Orphan / Features",
    "Love Never Felt So Good": "Orphan / Features",
    "Ayo Technology": "Orphan / Features",
    "Holy Grail": "Orphan / Features",
    "Dead And Gone": "Orphan / Features",
    "Carry Out (Featuring Justin Timberlake)": "Orphan / Features",
    "True Colors": "Orphan / Features",
    "The Other Side (from Trolls World Tour)": "Orphan / Features",
    "Signs": "Orphan / Features",
    "Stay With Me (with Justin Timberlake, Halsey, & Pharrell)": "Orphan / Features",
    "Better Place (From TROLLS Band Together)": "Orphan / Features",
    "Love Sex Magic (feat. Justin Timberlake)": "Orphan / Features",
    "Motherlover": "Orphan / Features",
    "Bounce - Album Version (Edited)": "Orphan / Features",
    "Sin Fin": "Orphan / Features",
    "SoulMate": "Orphan / Features",
    "Keep Going Up (with Nelly Furtado & Justin Timberlake)": "Orphan / Features",
    "I'm Lovin' It": "Orphan / Features",
    "ICU (with Justin Timberlake) - Remix": "Orphan / Features",
    };

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
        if (jtData.albums["Orphan / Features"]) {
            jtData.albums["Orphan / Features"].streams.spotify = liveStats.Orphan;
        }

        updateCareerOverview(liveStats);
        console.log("DİNAMİK GÜNCELLEME TAMAMLANDI! EITIW aktif.");

    } catch (e) { console.error("Hata:", e); }
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
        const singles = (albumData.physicalSinglesEAS || 0) + (albumData.digitalSinglesEAS || 0);
        const audio = Math.floor(((albumData.streams.spotify || 0) * ARTIST_RATIO) / 1166);

        // --- updateCareerOverview içindeki döngüye ekle ---
        easTableData.push({
            album: id,
            pure: pure,
            singles: singles,
            audio: audio,
            total: stats.totalEAS,
            year: albumData.year // data.json'dan yılı alıyoruz
        });
    });

    animateValue(document.getElementById('eas-total'), 0, careerTotalEAS, 2000);
    animateValue(document.getElementById('spotify-total'), 0, liveStats.TotalSpotify, 2000);

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

    updateEraTheme(albumName); // Tema motorunu ateşler

    // ==========================================
    // 📱 MOBİL UX: OTOMATİK PANEL KAYDIRMA MOTORU
    // ==========================================
    if (window.innerWidth < 768) {
        // Hedefimiz verilerin güncellendiği sağ panel
        const dashboardPanel = document.querySelector('.cspc-dashboard'); 
        if (dashboardPanel) {
            const navHeight = 140; // Sabit navbar'ın yüksekliğini hesaba katıyoruz ki yazının üstüne binmesin
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

document.addEventListener('DOMContentLoaded', fetchAllData);

// --- 5. DİNAMİK ERA TEMASI (FULL TAKEOVER MOTORU) ---
function updateEraTheme(albumName) {
    // Albümlerin ruhuna uygun renk paletleri ve arka plan parlamaları (Glow)
    const themes = {
        "Justified": { color: "#5dade2", bg: "rgba(93, 173, 226, 1)" }, 
        "FutureSex/LoveSounds": { color: "#e74c3c", bg: "rgba(231, 76, 60, 1)" }, 
        "The 20/20 Experience": { color: "#d4a853", bg: "rgba(212, 168, 83, 1)" }, 
        "Man of the Woods": { color: "#e67e22", bg: "rgba(230, 126, 34, 1)" }, 
        "Everything I Thought It Was": { color: "#ca510f", bg: "rgb(225, 86, 22)" }, 
        "Orphan / Features": { color: "#bdc3c7", bg: "rgba(189, 195, 199, 1)" } 
    };
    
    let t = themes[albumName] || themes["The 20/20 Experience"];
    
    // 1. TÜM SİTENİN VURGU RENGİNİ DEĞİŞTİR (Menüler, Linkler, İkonlar)
    document.documentElement.style.setProperty('--accent-bronze', t.color);
    
    // 2. ARKA PLANI O DÖNEMİN RENGİYLE YIKA (Radial Glow Efekti)
    document.body.style.background = `radial-gradient(circle at 50% 50%, ${t.bg} 0%, #0a0a0f 80%)`;
    document.body.style.backgroundAttachment = "fixed"; // Scroll yaparken renk sabit kalsın

    // 3. SPESİFİK ELEMENTLERİ PATLAT
    let styleTag = document.getElementById('era-dynamic-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'era-dynamic-style';
        document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
        /* Rakamlar ve Başlıklar */
        #eas-total, .stat-value, .cspc-title { color: ${t.color} !important; transition: color 0.5s ease; }
        .cspc-header { border-left: 4px solid ${t.color}; padding-left: 15px; transition: border-color 0.5s ease; }
        
        /* Albüm Kartlarına Glow Efekti (Üzerine gelince dönemin renginde parlar) */
        .album-card:hover { border-color: ${t.color}; box-shadow: 0 10px 40px ${t.bg}; }
        
        /* Dinamik Buton Tasarımı */
        /* Dinamik Buton Tasarımı - YAZI GÖRÜNÜRLÜĞÜ ÇÖZÜLDÜ */
        .era-btn {
            display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 8px;
            font-family: 'Space Grotesk', sans-serif; font-weight: 700;
            transition: all 0.3s ease; cursor: pointer;
            /* Arka planı koyu siyah yapıyoruz ki arkadaki sis yazıyı yutmasın */
            background: rgba(10, 10, 15, 0.95); 
            color: ${t.color} !important; /* Yazı rengi dönemin rengi (Örn: Mavi) */
            border: 1px solid ${t.color};
        }
        .era-btn:hover { 
            background: ${t.color}; /* Üzerine gelince dönemin rengiyle dolar */
            color: #111 !important; /* Üzerine gelince yazı simsiyah olur, net okunur */
            box-shadow: 0 0 25px ${t.color}; 
        }
        /* Scroll Çizgisi */
        .scroll-line { background: ${t.color}; }
    `;
}

// --- 6. EAS TABLO MOTORU VE SIRALAMA ALGORİTMASI ---

const albumCovers = {
    "Justified": "assets/justified.jpg",
    "FutureSex/LoveSounds": "assets/fsls.jpg",
    "The 20/20 Experience": "assets/the20.jpg",
    "Man of the Woods": "assets/motw.jpg",
    "Everything I Thought It Was": "assets/eitiw.jpg",
    "Orphan / Features": null
};

function albumThumbHTML(name) {
    const src = albumCovers[name];
    if (src) {
        return `<img src="${src}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;display:block;">`;
    }
    return `<div style="width:40px;height:40px;border-radius:4px;background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);flex-shrink:0;"></div>`;
}

function renderEasTable() {
    const tbody = document.getElementById('eas-table-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    let grandPure = 0, grandSingles = 0, grandAudio = 0, grandTotal = 0;

    easTableData.forEach(row => {
        grandPure += row.pure;
        grandSingles += row.singles;
        grandAudio += row.audio;
        grandTotal += row.total;

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02);">
                <div style="display:flex;align-items:center;gap:12px;">
                    ${albumThumbHTML(row.album)}
                    <span style="font-weight:700;color:#fff;">${row.album}</span>
                </div>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02);">${row.pure.toLocaleString()}</td>
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02);">${row.singles.toLocaleString()}</td>
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02); color: #5dade2;">+${row.audio.toLocaleString()}</td>
            <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.02); color: #d4a853; font-weight: 700;">${row.total.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });

    // EN ALT TOPLAM SATIRI (Grand Total)
    let footerTr = document.createElement('tr');
    footerTr.style.background = "rgba(212, 168, 83, 0.1)";
    footerTr.style.borderTop = "2px solid #d4a853";
    footerTr.innerHTML = `
        <td style="padding: 20px 0; font-weight: 900; color: #d4a853; text-transform: uppercase;">Grand Total</td>
        <td style="padding: 20px 0; font-weight: 700; color: #fff;">${grandPure.toLocaleString()}</td>
        <td style="padding: 20px 0; font-weight: 700; color: #fff;">${grandSingles.toLocaleString()}</td>
        <td style="padding: 20px 0; font-weight: 700; color: #5dade2;">+${grandAudio.toLocaleString()}</td>
        <td style="padding: 20px 0; font-weight: 900; color: #d4a853; font-size: 1.2rem;">${grandTotal.toLocaleString()}</td>
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
            // true ise 2002 -> 2024, false ise 2024 -> 2002
            return currentEasSort.asc ? a.year - b.year : b.year - a.year;
        }
        
        let valA = a[key];
        let valB = b[key];
        return currentEasSort.asc ? valA - valB : valB - valA;
    });

    renderEasTable();
};

