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

const TARGET_FILES = ['index.html', 'about.html', 'vault.html'];

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
    await page.goto(`${SITE_URL}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });

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
    await page.goto(`${SITE_URL}/vault.html`, { waitUntil: 'networkidle2', timeout: 60000 });

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

async function main() {
    console.log(`Canlı site okunuyor: ${SITE_URL}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let easM, certsM;
    try {
        [easM, certsM] = await Promise.all([getLiveEAS(browser), getLiveCerts(browser)]);
    } finally {
        await browser.close();
    }

    console.log(`Canlı EAS: ${easM}M · Canlı certified+eligible: ${certsM}M`);

    if (!easM || !certsM || easM < 10 || certsM < 10) {
        console.error('Okunan değerler mantıksız görünüyor (çok küçük). Dosyalar güncellenmeyecek.');
        process.exit(1);
    }

    const values = { EAS_M: easM, CERTS_M: certsM };
    let anyChanged = false;

    for (const fname of TARGET_FILES) {
        const filePath = path.join(REPO_ROOT, fname);
        const original = fs.readFileSync(filePath, 'utf-8');
        const { content, changed } = applyMarkers(original, values);
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
