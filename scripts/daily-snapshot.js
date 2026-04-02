/**
 * daily-snapshot.js
 * ─────────────────────────────────────────────────────────────
 * GitHub Actions tarafından her gece 00:05 UTC'de çalıştırılır.
 * Kworb proxy API'den canlı veri çeker, Firestore'a kaydeder.
 *
 * Gerekli env değişkenleri (GitHub Secrets):
 *   FIREBASE_SERVICE_ACCOUNT  → Firebase Admin SDK JSON (stringify edilmiş)
 *   KWORB_PROXY_URL           → Aynı proxy URL (config.js'teki MY_DYNAMIC_API)
 * ─────────────────────────────────────────────────────────────
 */

const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const admin = require('firebase-admin');

// ── Firebase Admin Başlatma ────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Şarkı → Albüm Mapping (streams.js ile birebir aynı) ────────
// song-map.js ile senkron — tek kaynak: song-map.js
// Node.js ortamı için kopya (browser'da SONG_TO_ALBUM_MAP global'dan gelir)
const songToAlbumMap = {
    // JUSTIFIED
    "Like I Love You": "Justified", "Cry Me a River": "Justified", "Rock Your Body": "Justified",
    "Señorita": "Justified", "Last Night": "Justified", "Take It From Here": "Justified",
    "Still On My Brain": "Justified", "Take Me Now": "Justified", "Right For Me": "Justified",
    "Nothin' Else": "Justified", "Never Again": "Justified",
    // FUTURESEX/LOVESOUNDS
    "Boutique In Heaven": "FutureSex/LoveSounds", "LoveStoned": "FutureSex/LoveSounds",
    "I Think She Knows": "FutureSex/LoveSounds",
    "Losing My Way": "FutureSex/LoveSounds", "What Goes Around": "FutureSex/LoveSounds",
    "Comes Around": "FutureSex/LoveSounds",
    "Until The End Of Time": "FutureSex/LoveSounds", "Chop Me Up": "FutureSex/LoveSounds",
    "Summer Love": "FutureSex/LoveSounds", "Sexy Ladies": "FutureSex/LoveSounds",
    "Damn Girl": "FutureSex/LoveSounds", "FutureSex": "FutureSex/LoveSounds",
    "SexyBack": "FutureSex/LoveSounds", "My Love": "FutureSex/LoveSounds",
    "All Over Again": "FutureSex/LoveSounds", "Pose": "FutureSex/LoveSounds",
    "Another Song": "FutureSex/LoveSounds", "Set The Mood": "FutureSex/LoveSounds",
    // THE 20/20 EXPERIENCE
    // THE 20/20 EXPERIENCE — Part 1
    "Strawberry Bubblegum": "The 20/20 Experience", "Spaceship Coupe": "The 20/20 Experience",
    "Pusher Love Girl": "The 20/20 Experience", "Don't Hold the Wall": "The 20/20 Experience",
    "Let the Groove Get In": "The 20/20 Experience", "Suit & Tie": "The 20/20 Experience",
    "That Girl": "The 20/20 Experience", "Mirrors": "The 20/20 Experience",
    "Tunnel Vision": "The 20/20 Experience", "Body Count": "The 20/20 Experience",
    "Dress On": "The 20/20 Experience", "Blue Ocean Floor": "The 20/20 Experience",
    // THE 20/20 EXPERIENCE – 2 of 2
    "Take Back the Night": "The 20/20 Experience \u2013 2 of 2",
    "Only When I Walk Away": "The 20/20 Experience \u2013 2 of 2",
    "Gimme What I Don't Know": "The 20/20 Experience \u2013 2 of 2",
    "Not a Bad Thing": "The 20/20 Experience \u2013 2 of 2",
    "Drink You Away": "The 20/20 Experience \u2013 2 of 2",
    "True Blood": "The 20/20 Experience \u2013 2 of 2",
    "You Got It On": "The 20/20 Experience \u2013 2 of 2",
    "Amnesia": "The 20/20 Experience \u2013 2 of 2",
    "Cabaret": "The 20/20 Experience \u2013 2 of 2",
    "Murder": "The 20/20 Experience \u2013 2 of 2",
    "TKO": "The 20/20 Experience \u2013 2 of 2",
    "Blindness": "The 20/20 Experience \u2013 2 of 2",
    "Electric Lady": "The 20/20 Experience \u2013 2 of 2",
    // MAN OF THE WOODS
    "Midnight Summer Jam": "Man of the Woods", "Breeze Off the Pond": "Man of the Woods",
    "Hers (interlude)": "Man of the Woods", "Livin' Off the Land": "Man of the Woods",
    "Higher Higher": "Man of the Woods", "Morning Light": "Man of the Woods",
    "Say Something": "Man of the Woods", "The Hard Stuff": "Man of the Woods",
    "Man of the Woods": "Man of the Woods", "Young Man": "Man of the Woods",
    "Supplies": "Man of the Woods", "Montana": "Man of the Woods",
    "Flannel": "Man of the Woods", "Filthy": "Man of the Woods",
    "Sauce": "Man of the Woods", "Wave": "Man of the Woods",
    // EVERYTHING I THOUGHT IT WAS
    "F**kin' Up The Disco": "Everything I Thought It Was", "What Lovers Do": "Everything I Thought It Was",
    "My Favorite Drug": "Everything I Thought It Was", "Infinity Sex": "Everything I Thought It Was",
    "Technicolor": "Everything I Thought It Was", "Love & War": "Everything I Thought It Was",
    "Conditions": "Everything I Thought It Was", "Sanctified": "Everything I Thought It Was",
    "Imagination": "Everything I Thought It Was", "No Angels": "Everything I Thought It Was",
    "Paradise": "Everything I Thought It Was", "Selfish": "Everything I Thought It Was",
    "Memphis": "Everything I Thought It Was", "Flame": "Everything I Thought It Was",
    "Alone": "Everything I Thought It Was", "Drown": "Everything I Thought It Was",
    "Liar": "Everything I Thought It Was", "Play": "Everything I Thought It Was",
    // Orphan: map'te YOK — residual olarak hesaplanır
};

const allAlbums = [
    "Justified", "FutureSex/LoveSounds", "The 20/20 Experience",
    "The 20/20 Experience \u2013 2 of 2",
    "Man of the Woods", "Everything I Thought It Was", "Orphan"
];

// ── HTML Parser ─────────────────────────────────────────────────
function analyzeKworbData(htmlInput) {
    const root = parse(htmlInput, { lowerCaseTagName: false, comment: false, blockTextElements: { script: false, style: false } });

    // table.addpos yoksa tüm tablolardaki tr'leri dene (Kworb bazen farklı class kullanır)
    let rows = root.querySelectorAll('table.addpos tbody tr');
    if (rows.length === 0) {
        rows = root.querySelectorAll('table tbody tr');
        console.log(`⚠️  table.addpos bulunamadı, tüm tbody tr'leri kullanılıyor: ${rows.length} adet`);
    }

    const allTables = root.querySelectorAll('table');
    console.log(`   Tablo sayısı: ${allTables.length}, Satır sayısı: ${rows.length}`);
    if (allTables.length > 0) {
        console.log(`   İlk tablo ilk satır: ${allTables[0].querySelector('tr') ? allTables[0].querySelector('tr').textContent.substring(0,100).replace(/\s+/g,' ') : 'YOK'}`);
    }

    let stats = {
        TotalSpotify: 0,
        "Justified": { total: 0, daily: 0 },
        "FutureSex/LoveSounds": { total: 0, daily: 0 },
        "The 20/20 Experience": { total: 0, daily: 0 },
        "The 20/20 Experience \u2013 2 of 2": { total: 0, daily: 0 },
        "Man of the Woods": { total: 0, daily: 0 },
        "Everything I Thought It Was": { total: 0, daily: 0 },
        "Orphan": { total: 0, daily: 0 },
        tracks: []
    };

    // Career total: ilk tablonun ikinci td'si
    if (allTables.length > 0) {
        const tds = allTables[0].querySelectorAll('td');
        if (tds[1]) stats.TotalSpotify = parseInt(tds[1].textContent.replace(/,/g, ''), 10) || 0;
        console.log(`   İlk tablo td sayısı: ${tds.length}, td[1] text: "${tds[1] ? tds[1].textContent.trim().substring(0,30) : 'YOK'}"`);
    }

    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 3) {
            const title = cols[0].textContent.trim();
            const lowerTitle = title.toLowerCase();
            const valTotal = parseInt(cols[1].textContent.replace(/,/g, ''), 10) || 0;
            const valDaily = parseInt(cols[2].textContent.replace(/,/g, ''), 10) || 0;

            stats.tracks.push({ title, total: valTotal, daily: valDaily });

            let matched = false;
            for (const key in songToAlbumMap) {
                if (lowerTitle.includes(key.toLowerCase())) {
                    const albName = songToAlbumMap[key];
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

// ── UTC Tarih String Üretici ────────────────────────────────────
function getTodayUTC() {
    return new Date().toISOString().split('T')[0]; // "2025-03-22"
}

// ── Ana Fonksiyon ───────────────────────────────────────────────
async function fetchAndSnapshot() {
    // Sunucu tarafında CORS yok — direkt Kworb URL kullan.
    // KWORB_PROXY_URL tarayıcı için (CORS bypass), sunucu için KWORB_DIRECT_URL gerekli.
    const targetUrl = process.env.KWORB_DIRECT_URL || process.env.KWORB_PROXY_URL;
    if (!targetUrl) throw new Error("KWORB_DIRECT_URL veya KWORB_PROXY_URL env değişkeni eksik!");

    console.log(`[${new Date().toISOString()}] Kworb'dan veri çekiliyor...`);
    console.log(`URL: ${targetUrl.substring(0, 60)}...`);

    const res = await fetch(targetUrl, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const html = await res.text();

    console.log(`HTML alındı: ${html.length} karakter`);
    console.log(`İlk 500 char: ${html.substring(0, 500).replace(/\s+/g, ' ')}`);
    console.log("HTML parse ediliyor...");
    const stats = analyzeKworbData(html);

    // Track listesi boşsa gerçek bir parse hatası var — HTML'i logla
    if (stats.tracks.length === 0) {
        console.error("Parse başarısız! HTML dump (ilk 1000 char):");
        console.error(html.substring(0, 1000).replace(/\s+/g, ' '));
        throw new Error("Parse başarısız: Track listesi boş. Üstteki HTML dump'a bak.");
    }

    // TotalSpotify ilk tablodan alınamazsa track toplamından hesapla (fallback)
    if (stats.TotalSpotify === 0) {
        stats.TotalSpotify = stats.tracks.reduce((sum, t) => sum + t.total, 0);
        console.warn(`⚠️  TotalSpotify tablodan okunamadı — ${stats.tracks.length} track'in toplamı kullanıldı: ${stats.TotalSpotify.toLocaleString('en-US')}`);
    }

    // Tracks'i map'e çevir (Firestore'da verimli okuma için)
    const tracksMap = {};
    stats.tracks.forEach(t => {
        tracksMap[t.title] = { total: t.total, daily: t.daily };
    });

    // Albums map
    const albumsMap = {};
    allAlbums.forEach(name => {
        albumsMap[name] = {
            total: stats[name].total,
            daily: stats[name].daily
        };
    });

    // Günlük toplam daily hesapla
    const careerDaily = allAlbums.reduce((sum, name) => sum + stats[name].daily, 0);

    const docData = {
        date: getTodayUTC(),
        recorded_at: admin.firestore.Timestamp.now(),
        career_total: stats.TotalSpotify,
        career_daily: careerDaily,
        albums: albumsMap,
        tracks: tracksMap
    };

    const docId = getTodayUTC();
    await db.collection('daily_snapshots').doc(docId).set(docData);

    console.log(`✅ Snapshot kaydedildi: daily_snapshots/${docId}`);
    console.log(`   Career Total : ${stats.TotalSpotify.toLocaleString('en-US')}`);
    console.log(`   Career Daily : ${careerDaily.toLocaleString('en-US')}`);
    console.log(`   Track sayısı : ${stats.tracks.length}`);
}

// ── Çalıştır ───────────────────────────────────────────────────
fetchAndSnapshot()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("HATA:", err.message);
        process.exit(1);
    });
