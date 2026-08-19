// ── "4 Minutes" — JT'nin Kworb sayfasında görünmeyen sürümler ──
//
// Kworb'un JT sanatçı sayfası bu kaydın yalnızca Hard Candy sürümünü listeliyor.
// Aynı şarkının ikinci bir yayını (112M+) ve üç remix/live sürümü SADECE Madonna'nın
// sayfasında duruyor. Bunlar ayrı Spotify track'leri; "yeniden adlandırma" değil.
//
// 2026-08-14'te "&" → "and" normalizasyonu eklenince iki BAŞLIK tek anahtara indi ve
// vault/album sayfaları "şarkı zaten var" sanıp eksik sürümleri hiç eklemedi; streams
// ham başlığa baktığı için sentetik bir baseline ekledi. Üç sayfa üç farklı rakam
// gösteriyordu. Artık üçü de burayı çağırıyor.
//
// Hangi satırın "eksik" olduğu başlık yazımından (& / and) DEĞİL, JT'nin canlı
// listesiyle farktan belirleniyor: Kworb yarın bu sürümü JT sayfasına eklerse satır
// kendiliğinden elenir ve çift sayım olmaz.

const FOUR_MIN = {
    madonnaArtistId: '6tbjWDEIzxoDsBA1FuhfPW',
    // /api/kworb erişilemezse (yerel statik sunucu, fonksiyon hatası) kullanılan yedek.
    // Kworb'dan 2026-08-20'de okunan gerçek değerler; sentetik tahmin değil.
    fallback: {
        asOf: '2026-08-20',
        tracks: [
            { title: '4 Minutes (feat. Justin Timberlake and Timbaland)', total: 112_094_532, daily: 210_920 },
            { title: '4 Minutes (feat. Justin Timberlake and Timbaland) - Live', total: 1_942_299, daily: 400 },
            { title: '4 Minutes (feat. Justin Timberlake and Timbaland) - Peter Saves New York Edit', total: 1_574_915, daily: 342 },
            { title: '4 Minutes (feat. Justin Timberlake and Timbaland) - Junkie XL Remix Edit', total: 1_030_241, daily: 199 }
        ]
    }
};

// Dedupe için başlık anahtarı. normalizeKworbTitle'dan farkı: "&" → "and" çevirmez.
// O çeviri iki AYRI track'i tek anahtara indirdiği için burada kullanılamaz.
function fourMinKey(title) {
    return String(title || '')
        .toLowerCase()
        .replace(/^\s*\*\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function fourMinFallback() {
    const base = new Date(FOUR_MIN.fallback.asOf + 'T00:00:00Z').getTime();
    const days = Math.max(0, Math.round((Date.now() - base) / 86400000));
    return FOUR_MIN.fallback.tracks.map(t => ({
        title: t.title,
        total: t.total + days * t.daily,
        daily: t.daily
    }));
}

// jtTitles: JT'nin canlı Kworb listesindeki ham başlıklar.
// Döner: { tracks: [{title,total,daily}], total, daily, live }
async function fetchFourMinutesExtras(jtTitles = []) {
    const seen = new Set(jtTitles.map(fourMinKey));
    let tracks = null;
    let live = false;

    try {
        const res = await fetch(`/api/kworb?artist=${FOUR_MIN.madonnaArtistId}&q=${encodeURIComponent('4 minutes')}`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.tracks) && data.tracks.length) {
                tracks = data.tracks;
                live = true;
            }
        }
    } catch (e) {
        // Sessiz: yedeğe düşeceğiz.
    }

    if (!tracks) tracks = fourMinFallback();

    // JT sayfasında zaten olan sürümleri at — çift sayım buradan çıkardı.
    const extras = tracks.filter(t => !seen.has(fourMinKey(t.title)));

    return {
        tracks: extras,
        total: extras.reduce((a, t) => a + t.total, 0),
        daily: extras.reduce((a, t) => a + (t.daily || 0), 0),
        live
    };
}
