/**
 * indexnow-ping.js
 * ─────────────────────────────────────────────────────────────
 * IndexNow, "bu sayfa değişti" bildirimi için açık bir protokol.
 * Bing, Yandex, Seznam ve Naver aynı endpoint'i paylaşıyor — bir kez
 * ping atınca hepsi haberdar oluyor. ChatGPT'nin web araması Bing
 * indeksini kullandığı için burası doğrudan AI görünürlüğünü etkiliyor.
 * (Google IndexNow'ı desteklemiyor; orası için Search Console → sitemap.)
 *
 * Doğrulama: anahtarın {SITE}/{KEY}.txt adresinde, içeriği anahtarın
 * kendisi olacak şekilde yayınlanmış olması yeterli. Ayrıca hesap gerekmez.
 *
 * Kullanım:
 *   node indexnow-ping.js https://site/a.html https://site/b.html
 *   node indexnow-ping.js            → varsayılan sayfa listesi
 *
 * PROTOKOL KURALI: sadece GERÇEKTEN değişen URL'leri gönder. Her gece
 * değişmemiş sayfaları göndermek spam sayılır ve site cezalandırılabilir.
 * ─────────────────────────────────────────────────────────────
 */

const SITE = process.env.SITE_URL || 'https://justin-timberlake-stats.vercel.app';
const KEY = process.env.INDEXNOW_KEY || '772138ccac09b346bc7a213acd7d9447';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const DEFAULT_PAGES = ['/', '/streams.html', '/vault.html', '/about.html'];

function toAbsolute(u) {
    if (/^https?:\/\//i.test(u)) return u;
    return SITE.replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u);
}

async function main() {
    const args = process.argv.slice(2).filter(Boolean);
    const urlList = [...new Set((args.length ? args : DEFAULT_PAGES).map(toAbsolute))];

    if (urlList.length === 0) {
        console.log('Gönderilecek URL yok, atlanıyor.');
        return;
    }
    if (urlList.length > 10000) {
        throw new Error('IndexNow tek seferde en fazla 10.000 URL kabul ediyor.');
    }

    const host = new URL(SITE).host;
    const body = {
        host,
        key: KEY,
        keyLocation: `${SITE.replace(/\/$/, '')}/${KEY}.txt`,
        urlList
    };

    console.log(`IndexNow → ${urlList.length} URL:`);
    urlList.forEach(u => console.log('  ' + u));

    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
    });

    const text = await res.text().catch(() => '');

    // 200 = kabul edildi, 202 = kabul edildi ama anahtar doğrulaması beklemede.
    if (res.status === 200 || res.status === 202) {
        console.log(`✅ IndexNow ${res.status} — bildirim iletildi.`);
        return;
    }

    // 400 hatalı format, 403 anahtar doğrulanamadı, 422 host/url uyuşmuyor, 429 çok fazla istek
    console.error(`❌ IndexNow ${res.status}: ${text.slice(0, 300)}`);
    if (res.status === 403) {
        console.error(`   Anahtar dosyası erişilebilir mi? → ${body.keyLocation}`);
    }
    // Indeksleme bildirimi başarısız olsa da deploy'u bozmayalım.
    process.exitCode = 0;
}

main().catch(err => {
    console.error('indexnow-ping hatası:', err.message);
    process.exitCode = 0;
});
