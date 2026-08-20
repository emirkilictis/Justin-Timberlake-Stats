// ── JT'nin Kworb sayfasında HİÇ görünmeyen ortak kayıtlar ──
//
// Kworb bir şarkıyı yalnızca "asıl" sanatçının sayfasında listeliyor. JT'nin
// katkısı krediye yazılmamışsa (Where Is The Love?) ya da kayıt başka birinin
// single'ıysa (Give It To Me, Rehab) satır JT'nin sayfasında yok. Sonuç:
// vault bu üç şarkıyı SIFIR Spotify stream'iyle hesaplıyordu — yani on yıllık
// dinlenme sanki hiç olmamış gibi, geriye sadece pure sales kalıyordu.
//
// Bunun ne kadar ciddi olduğu RIAA ödülüyle ölçülebiliyordu: ödül "o tarihte
// en az şu kadar ünite vardı" dediği için, modelin gördüğü stream ödülün
// dayattığının altına düşünce eksik veri kanıtlanmış oluyor. Üçü de düşüyordu.
//
// 4 Minutes'la aynı hata sınıfı (bkz. four-minutes.js), ama farkı var: orada
// şarkı JT'nin sayfasında VARDI, yalnızca bazı sürümleri eksikti. Burada satır
// hiç yok, o yüzden anahtarı biz açıyoruz.
//
// KAPSAM — yalnızca vault. streams.html'in kariyer toplamı JT'nin KREDİLİ
// Spotify kataloğunu sayıyor; Where Is The Love? kredide Black Eyed Peas'in.
// İkisi farklı soru: vault "JT bu kayda katıldı mı, ünitesi ne" diye soruyor,
// streams "JT'nin kataloğu ne kadar dinlendi" diye. Bu modül yalnızca ilkine
// cevap veriyor ve kariyer toplamına dokunmuyor.
//
// liveStreams.albums'a da EKLENMİYOR: Orphan'ın albüm toplamı büyürse, kendi
// YouTube ID'si olmayan tek şarkı olan "Hair Up" albüm payı üzerinden video
// tahmini yaptığı için sessizce küçülürdü. Bu şarkıların üçünün de kendi YT
// ID'si var, albüm yoluna ihtiyaçları yok.

const COLLAB_TRACKS = [
    {
        vaultTitle: 'Where Is The Love',
        artist: 'Black Eyed Peas',
        artistId: '1yxSLGMDHlW21z4YXirZDS',
        q: 'where is the love',
        // Kworb'da sayılan satırlar. Denetlenebilir olsun diye tek tek yazılı.
        counted: ['Where Is The Love?'],
        skipped: {
            'Where Is the Love - Live at Live 8, Benjamin Franklin Parkway': 'ayrı bir canlı performans',
            'Where Is The Love? - Instrumental': 'vokal yok, JT duyulmuyor'
        },
        fallback: { asOf: '2026-08-20', total: 1_469_885_604, daily: 684_076 }
    },
    {
        vaultTitle: 'Give It To Me',
        artist: 'Timbaland',
        artistId: '5Y5TRrQiqgUO4S36tzjIRZ',
        q: 'give it to me',
        // Üç satır da aynı başlık, ayrı Spotify track ID'leri — Shock Value'nun
        // farklı yayınları. Aynı kaydın sürümleri toplanıyor; getTrackSpotify
        // JT'nin kendi şarkılarında da (Suit & Tie + Radio Edit) böyle yapıyor.
        counted: ['Give It To Me'],
        skipped: {
            'Give It To Me - Sped Up Remix': 'türev sürüm',
            'Give It To Me 2025': 'ayrı bir 2025 kaydı, JT katılımı doğrulanmadı',
            'Give It To Me - Instrumental': 'vokal yok',
            'Give It To Me (Laugh At Em) - Remix': 'ayrı remix, JT katılımı doğrulanmadı'
        },
        // daily 0: Timbaland'ın Kworb sayfasında günlük kolonu bozuk
        // (Promiscuous'a 9.9M/gün yazıyor — toplamı 2.08B olan bir kayıt için
        // imkânsız). Uydurma büyüme eklemektense yedek son gerçek okumada
        // sabit kalsın; /api/kworb ayağa kalkınca zaten canlı değer geliyor.
        fallback: { asOf: '2026-08-20', total: 1_139_684_035, daily: 0 }
    },
    {
        vaultTitle: 'Rehab',
        artist: 'Rihanna',
        artistId: '5pKCCKE2ajJHZ9KAiaK11H',
        q: 'rehab',
        counted: ['Rehab'],
        skipped: {
            'Rehab - Timbaland Remix': 'ayrı remix, JT katılımı doğrulanmadı',
            'Rehab - Instrumental': 'vokal yok'
        },
        fallback: { asOf: '2026-08-20', total: 337_653_716, daily: 177_183 }
    }
];

// Dedupe anahtarı. normalizeKworbTitle'dan farkı: "&" → "and" çevirmez.
// O çeviri ayrı track'leri tek anahtara indirdiği için karşılaştırmada
// kullanılamaz — four-minutes.js'teki fourMinKey ile aynı gerekçe.
function collabKey(title) {
    return String(title || '')
        .toLowerCase()
        .replace(/^\s*\*\s*/, '')   // baştaki "* " feature işareti
        .replace(/\s+/g, ' ')
        .trim();
}

function collabFallback(entry) {
    const base = new Date(entry.fallback.asOf + 'T00:00:00Z').getTime();
    const days = Math.max(0, Math.round((Date.now() - base) / 86400000));
    return entry.fallback.total + days * (entry.fallback.daily || 0);
}

// jtTitles: JT'nin canlı Kworb listesindeki ham başlıklar.
// Döner: [{ vaultTitle, total, live, counted:[{title,total}] }]
async function fetchCollabStreams(jtTitles = []) {
    const seen = new Set(jtTitles.map(collabKey));
    const out = [];

    for (const entry of COLLAB_TRACKS) {
        let rows = null;
        try {
            const res = await fetch(
                `/api/kworb?artist=${entry.artistId}&q=${encodeURIComponent(entry.q)}`
            );
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.tracks) && data.tracks.length) rows = data.tracks;
            }
        } catch (e) {
            // Sessiz: yedeğe düşeceğiz.
        }

        if (!rows) {
            out.push({
                vaultTitle: entry.vaultTitle, total: collabFallback(entry),
                live: false, counted: []
            });
            continue;
        }

        const wanted = new Set(entry.counted.map(collabKey));
        const known = new Set([...wanted, ...Object.keys(entry.skipped).map(collabKey)]);
        const taken = [];
        let total = 0;

        for (const r of rows) {
            const k = collabKey(r.title);
            if (!known.has(k)) {
                // Kworb yeni bir sürüm eklemiş. Sessizce saymıyoruz — önce
                // JT'nin o kayıtta gerçekten olup olmadığına bakılmalı.
                console.warn(`[collab] tanınmayan sürüm, sayılmadı: "${r.title}" (${entry.artist})`);
                continue;
            }
            if (!wanted.has(k)) continue;
            // JT'nin kendi sayfasında zaten varsa çift sayma. Kworb yarın bu
            // satırı JT'ye eklerse burası kendiliğinden devre dışı kalır.
            if (seen.has(k)) continue;
            total += r.total;
            taken.push({ title: r.title, total: r.total });
        }

        out.push({ vaultTitle: entry.vaultTitle, total, live: true, counted: taken });
    }

    return out;
}
