// ── Kworb'un JT sayfasında OLMAYAN kredili parçalar ──
//
// 2026-11-19: JT'nin Kworb sayfası (244 satır, 19.22B) ile Spotify'ın kendisi
// (SpotifyStreams dashboard'u, 262 satır, 19.66B) arasında, bizim zaten
// eklediğimiz 4 Minutes / Not a Bad Thing Radio Edit çıkınca ~197M fark kaldı.
// Hepsi JT'nin Spotify'da kredili olduğu parçalar; Kworb bunları JT sayfasına
// hiç yazmıyor:
//   · The Lonely Island (Motherlover, Dick In A Box, 3-Way) ve Jimmy Fallon —
//     Kworb'da yalnızca o sanatçıların sayfasında, o sayfalar da aylarca eski
//     (Lonely Island 2026-10-13, Fallon 2026-04-07).
//   · TROLLS Holiday özel albümü — Kworb'un HİÇBİR sayfasında yok.
//   · Küçük feat'ler, remix'ler, instrumental'lar.
// Bu yüzden kaynak Kworb değil, site sahibinin kendi SpotifyStreams
// dashboard'u (/api/dashboard-tracks üzerinden; CORS vermiyor).
//
// Sayılan parçalar Spotify ID'siyle tek tek yazılı — dashboard'daki farkı
// körlemesine almıyoruz. Bilerek ALINMAYANLAR:
//   · "Mirrors (Live)"   — The Hipster Orchestra'nın cover'ı, JT kredide yok.
//   · "The Book of Love" — yalnızca The Shadowboxers kredili.
//   · "Release - Album Version (Edited)" — Kworb'da var (1.37M); dashboard
//     10.18M / günlük 0 gösteriyor, şüpheli.
//
// Dedupe JT'nin CANLI listesiyle farktan yapılıyor (four-minutes.js /
// collab-streams.js ile aynı mantık): Kworb yarın Motherlover'ı JT sayfasına
// eklerse satır kendiliğinden elenir. Anahtar missingKey — normalizeKworbTitle
// DEĞİL, çünkü o "&" → "and" çevirip ayrı track'leri tek anahtara indiriyor.
//
// "(Oh No) What You Got" bir derleme yayını (Totally Hip Hop); JT'nin Justified
// satırıyla aynı başlığı taşıdığı için dedupe onu "zaten var" sanmasın diye
// başlığın sonuna derleme adı eklendi.

const MISSING_TRACKS = {
    // Yedek değerler dashboard'un 2026-11-17 kaydı; daily = 7 günlük ortalama.
    asOf: '2026-11-17',
    tracks: [
        // The Lonely Island / Jimmy Fallon
        { id: '2zpQ30BpR6teeCeivQoo5p', title: 'Motherlover', total: 89_165_858, daily: 8_818 },
        { id: '60VtX59NsRINDnObbDtH7G', title: 'Dick In A Box', total: 36_468_588, daily: 5_456 },
        { id: '61hCBuiPWwrrnZfYsyTBGg', title: '3-Way (The Golden Rule)', total: 26_093_737, daily: 3_167 },
        { id: '1CtvmX33OzZakoFD2eEQPz', title: 'History of Rap (feat. Justin Timberlake)', total: 2_114_903, daily: 104 },
        // TROLLS Holiday (2017 TV özel albümü) — Kworb'da hiç yok
        { id: '6VjGPadARCQTjvpEGXbIOY', title: 'Love Train', total: 11_703_689, daily: 3_882 },
        { id: '3hsyh6h2KU3VNFYPHBUXlm', title: 'Holiday', total: 9_858_177, daily: 3_178 },
        { id: '7KInKDzsPxcWY4PYrjNyRr', title: 'Friend Medley', total: 5_515_265, daily: 1_560 },
        { id: '66LTNuQSnUtPGxvZdv1Num', title: 'The Holla-Day For You', total: 4_691_066, daily: 2_128 },
        { id: '6GFAI795uiBVoAdvAtWo5J', title: 'Double-Down Speed Round', total: 4_280_100, daily: 1_193 },
        // Feat'ler ve diğer sürümler
        { id: '1FaU6P6WJF8irbZ1MXo9ky', title: 'Pose - Main Version - Explicit', total: 1_404_097, daily: 0 },
        { id: '0zUiT5fQoAPy3BAL6FOAGZ', title: 'Fascinated', total: 1_024_666, daily: 308 },
        { id: '4ks7wJSUcjcL5TZ0NZHsvT', title: "Ain't No Doubt About It", total: 815_649, daily: 557 },
        { id: '55lBmP1LE4HQWszRYaY6tl', title: 'Tunnel Vision - Radio Edit', total: 748_233, daily: 0 },
        { id: '1yGFj2Npn2pPSLwCjtgYLL', title: 'The Nature (feat. Justin Timberlake)', total: 688_265, daily: 80 },
        { id: '4Mmrd7l1g6328lGl7xVyPI', title: 'Family - Demo', total: 604_017, daily: 166 },
        { id: '6qDv1AiJZSrsTPtd4ojcpf', title: 'Role Model', total: 423_637, daily: 81 },
        { id: '3on7ZkKu4XzLAzcF8Earwn', title: "I'm Lovin' It (Instrumental)", total: 79_228, daily: 17 },
        { id: '61FWdZEfFAEj5fQ3Xor6Pr', title: 'Follow My Lead (feat. Esmee Denters)', total: 75_212, daily: 17 },
        { id: '6PnNlEycLXqA5H7SI5mLD1', title: 'Until The End Of Time (with Beyoncé) - Johnny Vicious & DJ Escape Radio Remix', total: 66_630, daily: 9 },
        { id: '4687z8lGebHY9z6NPIO9Qb', title: 'Until The End Of Time (with Beyoncé) - Jason Nevins Radio Mix', total: 60_308, daily: 8 },
        { id: '2Da48wtQPX4lP1jJx98cls', title: 'Until The End Of Time (with Beyoncé) - Ralphi Rosario Soul Radio Mix', total: 38_256, daily: 7 },
        { id: '48qYqOhCiX7oKXsx7qfufu', title: '(Oh No) What You Got - Totally Hip Hop', total: 29_575, daily: 1 },
        { id: '6nkeFdgQjzkuu3V99aySYq', title: 'Release - Instrumental', total: 27_937, daily: 8 },
        { id: '6xyMx7uyqjrkPxhXNYo3Gg', title: 'Who Was That?', total: 2_401, daily: 0 }
    ]
};

// Dedupe anahtarı — fourMinKey / collabKey ile aynı: "* " atılır, "&" korunur.
function missingKey(title) {
    return String(title || '')
        .toLowerCase()
        .replace(/^\s*\*\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function missingFallbackTrack(entry, asOf) {
    const base = new Date(asOf + 'T00:00:00Z').getTime();
    const days = Math.max(0, Math.round((Date.now() - base) / 86400000));
    return { title: entry.title, total: entry.total + days * entry.daily, daily: entry.daily };
}

// dashRows: [{id, title, total, daily}] ya da null (dashboard'a ulaşılamadı).
// Dashboard'da ID bulunamazsa o parça yedek değerle sayılır ve uyarı düşer.
function resolveMissingTracks(dashRows, jtTitles = []) {
    const seen = new Set(jtTitles.map(missingKey));
    const byId = new Map((dashRows || []).map(r => [r.id, r]));
    const tracks = [];
    let fromFallback = 0;

    for (const entry of MISSING_TRACKS.tracks) {
        // Kworb satırı JT sayfasına geri eklediyse çift sayma.
        if (seen.has(missingKey(entry.title))) continue;

        const row = byId.get(entry.id);
        if (row && Number(row.total) > 0) {
            tracks.push({ title: entry.title, total: Number(row.total), daily: Number(row.daily) || 0 });
        } else {
            if (dashRows) console.warn(`[missing-tracks] dashboard'da ID yok, yedek kullanıldı: "${entry.title}" (${entry.id})`);
            fromFallback++;
            tracks.push(missingFallbackTrack(entry, MISSING_TRACKS.asOf));
        }
    }

    return {
        tracks,
        total: tracks.reduce((a, t) => a + t.total, 0),
        daily: tracks.reduce((a, t) => a + (t.daily || 0), 0),
        live: !!dashRows && fromFallback === 0
    };
}

// Tarayıcı: jtTitles = JT'nin canlı (ve varsa snapshot'la birleşmiş) listesindeki
// HAM başlıklar. Döner: { tracks: [{title,total,daily}], total, daily, live }
async function fetchMissingTracks(jtTitles = []) {
    let rows = null;
    try {
        const res = await fetch('/api/dashboard-tracks');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.tracks) && data.tracks.length) rows = data.tracks;
        }
    } catch (e) {
        // Sessiz: yedeğe düşeceğiz.
    }
    return resolveMissingTracks(rows, jtTitles);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MISSING_TRACKS, missingKey, resolveMissingTracks };
}
