/**
 * update-sitemap.js
 * ─────────────────────────────────────────────────────────────
 * sitemap.xml'deki her URL'e doğru bir <lastmod> yazar.
 *
 * NEDEN: Google <changefreq> ve <priority> etiketlerini AÇIKÇA yok sayıyor;
 * dikkate aldığı tek tazelik sinyali <lastmod>. lastmod'suz bir sitemap,
 * "bu sayfa değişti, gel tekrar tara" demenin en doğrudan yolunu boşa
 * harcıyor demektir. (Request indexing günlük ~10 URL ile sınırlı ve elle
 * tetikleniyor — ölçeklenen yol burası değil.)
 *
 * Tarih kaynağı:
 *   - Dosyada commit'lenmemiş değişiklik varsa → bugün (nightly sync bu
 *     script'ten hemen önce çalışıyor, yani "bugün değişti" doğru bilgi).
 *   - Yoksa → dosyanın son commit tarihi (git log).
 *
 * ÖNEMLİ: lastmod'u yalan söylemek (her gün hepsini bugün yapmak) Google'ın
 * sinyale güvenini tamamen kaybettiriyor. Bu yüzden gerçekten değişmeyen
 * dosyaların tarihine dokunmuyoruz.
 *
 * Kullanım: node update-sitemap.js
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const SITEMAP = path.join(REPO_ROOT, 'sitemap.xml');
const SITE_ORIGIN = 'https://justin-timberlake-stats.vercel.app';

// URL yolu → repodaki dosya. Kök URL index.html'e denk geliyor.
function urlToFile(loc) {
    let rel = loc.replace(SITE_ORIGIN, '').replace(/^\//, '');
    if (rel === '' || rel === '/') rel = 'index.html';
    return rel;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function gitLastModified(relPath) {
    try {
        // Commit'lenmemiş değişiklik varsa bugün değişmiş sayılır.
        const dirty = execSync(`git status --porcelain -- "${relPath}"`, {
            cwd: REPO_ROOT, encoding: 'utf-8'
        }).trim();
        if (dirty) return today();

        const out = execSync(`git log -1 --format=%cs -- "${relPath}"`, {
            cwd: REPO_ROOT, encoding: 'utf-8'
        }).trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
    } catch (err) {
        return null;
    }
}

function main() {
    let xml = fs.readFileSync(SITEMAP, 'utf-8');
    const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
    let updated = 0, skipped = 0;

    for (const block of blocks) {
        const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
        if (!locMatch) continue;

        const relPath = urlToFile(locMatch[1].trim());
        const filePath = path.join(REPO_ROOT, relPath);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Sitemap'te var ama dosya yok, atlanıyor: ${relPath}`);
            skipped++;
            continue;
        }

        const date = gitLastModified(relPath);
        if (!date) { skipped++; continue; }

        let newBlock;
        if (/<lastmod>/.test(block)) {
            newBlock = block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${date}</lastmod>`);
        } else {
            // <loc>'un hemen ardına ekle — sitemap şemasında sıra: loc, lastmod, changefreq, priority
            newBlock = block.replace(
                /(<loc>[^<]+<\/loc>)/,
                `$1\n    <lastmod>${date}</lastmod>`
            );
        }

        if (newBlock !== block) {
            xml = xml.replace(block, newBlock);
            updated++;
        }
        console.log(`  ${date}  ${relPath}`);
    }

    fs.writeFileSync(SITEMAP, xml, 'utf-8');
    console.log(`\n✅ sitemap.xml: ${updated} URL güncellendi, ${skipped} atlandı.`);
}

main();
