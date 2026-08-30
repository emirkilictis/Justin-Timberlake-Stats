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
            'Where Is the Love - Live at Live 8, Benjamin Franklin Parkway, Philadelphia, 2nd July 2005': 'ayrı bir canlı performans',
            'Where Is The Love? - Instrumental': 'vokal yok, JT duyulmuyor'
        },
        fallback: { asOf: '2026-08-31', total: 1_478_781_014, daily: 808_674 }
    },
    {
        vaultTitle: 'Give It To Me',
        artist: 'Timbaland',
        artistId: '5Y5TRrQiqgUO4S36tzjIRZ',
        q: 'give it to me',
        // Aynı başlıklı satırlar toplanıyor — getTrackSpotify JT'nin kendi
        // şarkılarında da (Suit & Tie + Radio Edit) böyle yapıyor.
        //
        // 2026-08-20'de üç satır vardı: 569.3M / 541.6M / 28.8M. Büyük olanın
        // günlük kolonu 7.3M/gün gösteriyordu — 569M'lik bir kayıt için
        // imkânsız. 08-31'de Kworb o satırı tamamen sildi; diğer ikisi normal
        // büyümesini sürdürdü (541.6M→545.4M, 28.8M→29.0M). Yani kaybolan bir
        // kayıt değil, Kworb'un temizlediği hayalet bir giriş. Yedek o yüzden
        // 1.14B'den 574M'ye çekildi: API düşerse eski değer 565M hayalet
        // stream enjekte ederdi.
        counted: ['Give It To Me'],
        skipped: {
            'Give It To Me - Sped Up Remix': 'türev sürüm',
            'Give It To Me 2025': 'ayrı bir 2025 kaydı, JT katılımı doğrulanmadı',
            'Give It To Me - Instrumental': 'vokal yok',
            'Give It To Me (Laugh At Em) - Remix': 'ayrı remix, JT katılımı doğrulanmadı'
        },
        // daily, Kworb'un günlük kolonundan DEĞİL, iki gerçek okuma arasındaki
        // farktan ölçüldü (08-20 → 08-31, 11 gün). O sayfanın günlük kolonuna
        // güvenilmiyor: Promiscuous'a 9.9M/gün yazıyor, toplamı 2.08B olan bir
        // kayıt için imkânsız.
        fallback: { asOf: '2026-08-31', total: 574_423_976, daily: 366_349 }
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
        fallback: { asOf: '2026-08-31', total: 339_804_162, daily: 195_495 }
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
        let matched = 0;   // beklenen başlığa uyan satır sayısı (dedupe dahil)

        for (const r of rows) {
            const k = collabKey(r.title);
            if (!known.has(k)) {
                // Kworb yeni bir sürüm eklemiş. Sessizce saymıyoruz — önce
                // JT'nin o kayıtta gerçekten olup olmadığına bakılmalı.
                console.warn(`[collab] tanınmayan sürüm, sayılmadı: "${r.title}" (${entry.artist})`);
                continue;
            }
            if (!wanted.has(k)) continue;
            matched++;
            // JT'nin kendi sayfasında zaten varsa çift sayma. Kworb yarın bu
            // satırı JT'ye eklerse burası kendiliğinden devre dışı kalır.
            if (seen.has(k)) continue;
            total += r.total;
            taken.push({ title: r.title, total: r.total });
        }

        // Beklenen başlık sayfadan tamamen kaybolduysa bunu görmek istiyoruz:
        // şarkı sessizce sıfır stream'e düşer ve vault yine sadece pure sales
        // hesaplar — yani düzelttiğimiz bug'ın aynısı geri gelir.
        // NOT: aynı başlık altındaki satırlardan BİRİNİN kaybolması buradan
        // görünmez (2026-08-20'de Give It To Me'de olan buydu); istemcide
        // karşılaştıracak geçmiş yok, o durum toplamın düşmesiyle belli olur.
        if (matched === 0) {
            console.warn(
                `[collab] "${entry.vaultTitle}" ${entry.artist} sayfasında bulunamadı ` +
                `(${rows.length} satır tarandı). Kworb başlığı değiştirmiş olabilir.`
            );
        }

        out.push({ vaultTitle: entry.vaultTitle, total, live: true, counted: taken });
    }

    return out;
}
