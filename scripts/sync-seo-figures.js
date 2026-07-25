/**
 * sync-seo-figures.js
 * ─────────────────────────────────────────────────────────────
 * EAS ve certified-units rakamları statik SEO metnine (index.html,
 * about.html, vault.html) gömülü — ama kaynak veri (Spotify/YouTube
 * stream'leri) her gün büyüdüğü için bu sayılar sürekli eskiyor.
 *
 * Bu script vault.js / script.js'teki 800+ satırlık hesaplama mantığını
 * Node'da TEKRAR YAZMAZ (senkronizasyon bozulma riski). Onun yerine
 * canlı production sitesini gerçek bir tarayıcıda (Puppeteer) açar,
 * client-side JS'in zaten hesapladığı sonucu DOM'dan okur, ve o gerçek
 * değeri kaynak HTML dosyalarındaki <!--AUTO:X-->...<!--/AUTO:X-->
 * marker'larının İÇİNE yazar. Cümle yapısına dokunmaz.
 *
 * GitHub Actions tarafından her gece çalıştırılır (daily-snapshot.yml).
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SITE_URL = process.env.SITE_URL || 'https://justin-timberlake-stats.vercel.app';
const REPO_ROOT = path.join(__dirname, '..');

const TARGET_FILES = ['index.html', 'about.html', 'vault.html', 'llms.txt'];

// NOT: page.goto'da 'networkidle2' KULLANMA. Sayfalarda Firestore'un açık kalan
// bağlantısı var, ağ hiçbir zaman boşa düşmüyor → her gece 60sn timeout ile job
// düşüyordu (2026-07-03'ten 07-25'e kadar tek bir başarılı çalışma yok).
// 'domcontentloaded' + aşağıdaki waitForText zaten doğru bekleme stratejisi:
// ihtiyacımız olan DEĞERİN oluşmasını bekliyoruz, ağın susmasını değil.
async function waitForText(page, selector, isReady, timeoutMs = 45000) {
    await page.waitForFunction(
        (sel, readyFnStr) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const readyFn = new Function('text', `return (${readyFnStr})(text)`);
            return readyFn(el.textContent.trim());
        },
        { timeout: timeoutMs },
        selector,
        isReady.toString()
    );
    return page.$eval(selector, el => el.textContent.trim());
}

async function getLiveEAS(browser) {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // script.js: aiEasEl.textContent = (careerTotalEAS / 1e6).toFixed(2) + 'M'
    const text = await waitForText(
        page,
        '#ai-eas-value',
        (t) => /^\d+(\.\d+)?M$/.test(t)
    );
    await page.close();

    const millions = parseFloat(text.replace('M', ''));
    return Math.round(millions * 10) / 10; // en yakın 0.1M'e yuvarla
}

async function getLiveCerts(browser) {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/vault.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // vault.js: odometer.innerHTML = grandTotal.toLocaleString('en-US')
    const text = await waitForText(
        page,
        '#grand-total-odometer',
        (t) => /^[\d,]+$/.test(t)
    );
    await page.close();

    const units = parseInt(text.replace(/,/g, ''), 10);
    return Math.round(units / 1_000_000); // en yakın milyona yuvarla
}

// Kworb başlıklarını düzyazıya uygun hale getir:
//   "SexyBack (feat. Timbaland)"                      → "SexyBack"
//   "What Goes Around.../...Comes Around (Interlude)"  → "What Goes Around...Comes Around"
//   "* Love Sex Magic (feat. Justin Timberlake)"       → "Love Sex Magic"
// Kworb bazı başlıkları TAMAMEN BÜYÜK harf yazıyor; sitenin geri kalanı normal
// yazımı kullanıyor. Bilinen istisnaları burada eşliyoruz (anahtar: küçük harf).
const TITLE_ALIASES = {
    "can't stop the feeling!": "Can't Stop the Feeling!",
    "sexyback": "SexyBack",
    "tko": "TKO"
};

function prettyTrackTitle(raw) {
    let t = String(raw || '').replace(/^\s*\*\s*/, '').trim();
    t = t.replace(/\s*[\(\[](?:feat\.|with|from)[^)\]]*[\)\]]/gi, '');
    t = t.replace(/\s*\(Interlude\)\s*$/i, '');
    t = t.replace(/\.\.\.\/\.\.\./g, '...');
    t = t.trim();
    return TITLE_ALIASES[t.toLowerCase()] || t;
}

// Hem kariyer toplamını hem de en çok dinlenen parçaları TEK sayfa ziyaretinde okur.
async function getLiveStreamData(browser) {
    const page = await browser.newPage();
    await page.goto(`${SITE_URL}/streams.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // streams.js: animateValue(...) sayacı 0'dan yukarı sayıyor — önce makul bir
    // eşiği geçmesini bekle, sonra animasyon bitsin diye biraz daha bekleyip oku.
    await waitForText(
        page,
        '#jt-total-career',
        (t) => /^[\d,]+$/.test(t) && parseInt(t.replace(/,/g, ''), 10) > 15_000_000_000
    );
    await new Promise(r => setTimeout(r, 3000));

    const text = await page.$eval('#jt-total-career', el => el.textContent.trim());

    // Track tablosu toplamına göre azalan sıralı geliyor; ilk N'i alıyoruz.
    const topTracks = await page.$$eval('#streams-table-body tr', rows =>
        rows.slice(0, 12).map(tr => {
            const td = tr.querySelectorAll('td');
            return {
                title: td[0] ? td[0].textContent.trim() : '',
                total: td[1] ? parseInt(td[1].textContent.replace(/[^\d]/g, ''), 10) || 0 : 0
            };
        })
    );
    await page.close();

    const streams = parseInt(text.replace(/,/g, ''), 10);
    return {
        // "over X billion" iddiası hep doğru kalsın diye AŞAĞI yuvarla (18.56B → 18.5)
        spotifyB: Math.floor(streams / 1e8) / 10,
        topTracks: topTracks
            .filter(t => t.title && t.total > 0)
            .map(t => ({ title: prettyTrackTitle(t.title), total: t.total }))
            .slice(0, 7)
    };
}

// <!--AUTO_BLOCK:NAME--> ... <!--/AUTO_BLOCK:NAME--> arasını komple yeniden yazar.
// Tek tek değer yerine LİSTE üreten alanlar için (HTML yorumu sayfada görünmez).
function applyBlock(content, name, html) {
    const re = new RegExp(`(<!--AUTO_BLOCK:${name}-->)[\\s\\S]*?(<!--\\/AUTO_BLOCK:${name}-->)`, 'g');
    if (!re.test(content)) return { content, changed: false };
    const updated = content.replace(
        new RegExp(`(<!--AUTO_BLOCK:${name}-->)[\\s\\S]*?(<!--\\/AUTO_BLOCK:${name}-->)`, 'g'),
        (_, open, close) => `${open}\n${html}\n  ${close}`
    );
    return { content: updated, changed: updated !== content };
}

function renderTopSongsHtml(tracks) {
    return '  <ul>\n' + tracks
        .map(t => `    <li>${t.title} — ${t.total.toLocaleString('en-US')} Spotify streams</li>`)
        .join('\n') + '\n  </ul>';
}

function applyMarkers(content, values) {
    let changed = false;
    for (const [name, value] of Object.entries(values)) {
        const re = new RegExp(`(<!--AUTO:${name}-->)([^<]*)(<!--\\/AUTO:${name}-->)`, 'g');
        const before = content;
        content = content.replace(re, (_, open, _old, close) => `${open}${value}${close}`);
        if (content !== before) changed = true;
    }
    return { content, changed };
}

// JSON-LD içinde HTML yorumu KULLANILAMAZ — <!--AUTO:X--> yazarsak schema parser'ı
// (Google, AI crawler'lar) marker'ı metnin bir parçası olarak okur. Bu yüzden ld+json
// blokları düz sayı tutar ve buradaki çapa ifadelerle güncellenir.
const LD_JSON_RULES = [
    { name: 'CERTS_M',   re: /(reach approximately )(\d+(?:\.\d+)?)( million)/g },
    { name: 'CERTS_M',   re: /(has approximately )(\d+(?:\.\d+)?)( million certified)/g },
    { name: 'CERTS_M',   re: /(certified (?:\+ streaming-eligible )?units \(~)(\d+(?:\.\d+)?)(M solo\))/g },
    { name: 'EAS_M',     re: /(discography is approximately )(\d+(?:\.\d+)?)( million)/g },
    { name: 'EAS_M',     re: /(Timberlake Analytics currently calculates approximately )(\d+(?:\.\d+)?)( million)/g },
    { name: 'SPOTIFY_B', re: /(over )(\d+(?:\.\d+)?)( billion(?: total)? Spotify streams)/g }
];

// llms.txt text/plain olarak servis ediliyor — orada da HTML yorumu KULLANILAMAZ.
// HTML'de görünmeyen <!--AUTO:X--> düz metin dosyasında crawler'a birebir görünür
// ("~<!--AUTO:CERTS_M-->195<!--/AUTO:CERTS_M--> million"). Aynı çapa mantığı.
const PLAIN_TEXT_RULES = [
    { name: 'CERTS_M',   re: /(streaming-eligible units: ~)(\d+(?:\.\d+)?)( million)/g },
    { name: 'EAS_M',     re: /(Equivalent Album Sales \(EAS\): ~)(\d+(?:\.\d+)?)( million)/g },
    { name: 'SPOTIFY_B', re: /(Total Spotify streams: over )(\d+(?:\.\d+)?)( billion)/g }
];

function applyRules(text, values, rules) {
    let out = text;
    for (const rule of rules) {
        const value = values[rule.name];
        if (value === undefined) continue;
        out = out.replace(rule.re, (_, pre, _old, post) => `${pre}${value}${post}`);
    }
    return out;
}

function applyLdJson(content, values) {
    let changed = false;
    const updated = content.replace(
        /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g,
        (full, open, block, close) => {
            const blk = applyRules(block, values, LD_JSON_RULES);
            if (blk !== block) changed = true;
            return open + blk + close;
        }
    );
    return { content: updated, changed };
}

function applyPlainText(content, values) {
    const updated = applyRules(content, values, PLAIN_TEXT_RULES);
    return { content: updated, changed: updated !== content };
}

// llms.txt'te HTML yorumu kullanılamaz (crawler'a görünür) — "- Most-streamed:"
// satırını başlığına çapalayıp komple yeniden yazıyoruz. Satır sarma korunuyor.
function applyMostStreamedLine(content, tracks) {
    const names = tracks.slice(0, 5).map(t => t.title);
    // 74 karakterde sar, devam satırlarını iki boşlukla girintile
    const lines = [];
    let cur = '- Most-streamed:';
    names.forEach((n, i) => {
        const piece = ' ' + n + (i < names.length - 1 ? ',' : '.');
        if ((cur + piece).length > 74) { lines.push(cur); cur = '  ' + piece.trimStart(); }
        else { cur += piece; }
    });
    lines.push(cur);
    const replacement = lines.join('\n');

    const re = /^- Most-streamed:[\s\S]*?(?=\n\n|\n## )/m;
    if (!re.test(content)) return { content, changed: false };
    const updated = content.replace(re, replacement);
    return { content: updated, changed: updated !== content };
}

async function main() {
    console.log(`Canlı site okunuyor: ${SITE_URL}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let easM, certsM, streamData;
    try {
        [easM, certsM, streamData] = await Promise.all([
            getLiveEAS(browser),
            getLiveCerts(browser),
            getLiveStreamData(browser)
        ]);
    } finally {
        await browser.close();
    }

    const spotifyB = streamData.spotifyB;
    const topTracks = streamData.topTracks;

    console.log(`Canlı EAS: ${easM}M · Canlı certified+eligible: ${certsM}M · Spotify: ${spotifyB}B`);
    console.log(`En çok dinlenen ${topTracks.length} parça okundu:`);
    topTracks.forEach(t => console.log(`   ${t.total.toLocaleString('en-US').padStart(15)}  ${t.title}`));

    if (!easM || !certsM || easM < 10 || certsM < 10 || !spotifyB || spotifyB < 15) {
        console.error('Okunan değerler mantıksız görünüyor (çok küçük). Dosyalar güncellenmeyecek.');
        process.exit(1);
    }
    // Track listesi boş/eksik geldiyse mevcut listeyi SİLME — bloğu olduğu gibi bırak.
    if (topTracks.length < 5) {
        console.warn(`⚠️  Sadece ${topTracks.length} parça okunabildi — TOP_SONGS bloğuna dokunulmayacak.`);
    }

    const values = { EAS_M: easM, CERTS_M: certsM, SPOTIFY_B: spotifyB };
    let anyChanged = false;

    for (const fname of TARGET_FILES) {
        const filePath = path.join(REPO_ROOT, fname);
        const original = fs.readFileSync(filePath, 'utf-8');
        const isPlainText = fname.endsWith('.txt');
        // .txt dosyalarında marker kullanılmıyor (crawler'a görünürler) — çapa kuralları.
        const first = isPlainText
            ? applyPlainText(original, values)
            : applyMarkers(original, values);
        const second = isPlainText
            ? { content: first.content, changed: false }
            : applyLdJson(first.content, values);

        // Liste blokları — sadece güvenilir veri geldiyse yaz.
        let third = { content: second.content, changed: false };
        if (topTracks.length >= 5) {
            third = isPlainText
                ? applyMostStreamedLine(second.content, topTracks)
                : applyBlock(second.content, 'TOP_SONGS', renderTopSongsHtml(topTracks));
        }

        const content = third.content;
        const changed = first.changed || second.changed || third.changed;
        if (changed) {
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`${fname}: güncellendi`);
            anyChanged = true;
        } else {
            console.log(`${fname}: değişiklik yok`);
        }
    }

    // GitHub Actions'ın sonraki adımı (commit) için çıktı flag'i
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${anyChanged}\n`);
    }
}

main().catch(err => {
    console.error('sync-seo-figures başarısız:', err);
    process.exit(1);
});
