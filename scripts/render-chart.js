/**
 * render-chart.js
 * ─────────────────────────────────────────────────────────────
 * Aylık rapor sayfasındaki #chart bloğunu paylaşılabilir bir PNG'ye
 * çevirir (Reddit / X post'ları için). Grafiği ayrıca çizmiyoruz —
 * kaynak HER ZAMAN rapor sayfasının kendisi, böylece görsel ile
 * sayfadaki rakamlar birbirinden ayrışamıyor.
 *
 * Kullanım:
 *   node render-chart.js ../reports/2026-07.html ../assets/reports/2026-07-era-chart.png
 *   node render-chart.js <html> <png> [selector]
 * ─────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

async function main() {
    const htmlPath = path.resolve(process.argv[2] || '../reports/2026-07.html');
    const outPath  = path.resolve(process.argv[3] || '../assets/reports/2026-07-era-chart.png');
    const selector = process.argv[4] || '#chart';

    if (!fs.existsSync(htmlPath)) throw new Error(`Bulunamadı: ${htmlPath}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        // deviceScaleFactor 2 → retina keskinliğinde, Reddit'te bulanıklaşmıyor
        await page.setViewport({ width: 1100, height: 1000, deviceScaleFactor: 2 });
        await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Web font'lar ve albüm kapakları yerleşsin
        await page.evaluateHandle('document.fonts.ready');
        await page.waitForFunction(
            () => [...document.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0),
            { timeout: 15000 }
        );
        await new Promise(r => setTimeout(r, 400));

        const el = await page.$(selector);
        if (!el) throw new Error(`Selector bulunamadı: ${selector}`);
        await el.screenshot({ path: outPath });

        const { size } = fs.statSync(outPath);
        console.log(`✅ ${path.relative(process.cwd(), outPath)} — ${(size / 1024).toFixed(0)} KB`);
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error('render-chart hatası:', err.message);
    process.exit(1);
});
