/**
 * validate-certs.js
 * ─────────────────────────────────────────────────────────────
 * Sertifika verisinin vault.json'a girmeden ÖNCE denetlenmesi.
 *
 * İki mod var:
 *
 *   node scripts/validate-certs.js <dosya.csv>
 *       Dışarıdan gelen sertifika CSV'sini denetler. Asıl amaç: çıplak
 *       ünite sayısı kabul etmemek. Bir sertifika ünitesi tek bir olgu
 *       değil, iki bağımsız olgunun çarpımıdır — (a) ödülün seviyesi ve
 *       tarihi, (b) o seviyenin O TARİHTE, o format ve repertuar sınıfı
 *       için ne demek olduğu. İkisi ayrı kolonda durmazsa yanlış eşik
 *       kullanıldığı görünmez hale gelir.
 *
 *   node scripts/validate-certs.js --vault
 *       data/vault.json'ı vault.js'in gerçek parse mantığına karşı
 *       denetler. Sessizce 0 sayılan satırları yakalar.
 *
 * Çıkış kodu: hata varsa 1, yoksa 0. CI'da kullanılabilir.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Sözlükler ────────────────────────────────────────────────

// Satış-tipi metrikler ünite toplamına girer. streams ve
// revenue_local_currency GİRMEZ — Danimarka stream eşiği ve Polonya PLN
// gelir eşiği satış ünitesine çevrilemez.
const SALES_METRICS = new Set([
    'sales_equivalent', 'paid_downloads', 'physical_units',
    'physical album units', 'physical album sales', 'paid downloads',
    'single sales equivalents', 'raw_units'
]);
const NON_SALES_METRICS = new Set([
    'streams', 'revenue_local_currency'
]);

const REQUIRED_COLUMNS = [
    'country', 'type', 'title', 'level', 'threshold_at_award',
    'metric', 'counted_sales_download_units', 'status'
];

// Ödülün varlığı ile o tarihteki eşik İKİ AYRI kanıttır ve ayrı
// kaynaklardan gelir. Tek "source" kolonu ikisini birbirine karıştırır:
// sicil kaydı doğru olsa bile eşik yanlış rafta aranmış olabilir ve bu
// tek kolonda görünmez. Yeni dosyalar award_source + threshold_source
// kullanmalı; tek "source" geriye dönük kabul edilir ama uyarı verir.
const SOURCE_COLUMNS = ['award_source', 'threshold_source'];

// ── CSV okuma (tırnaklı alanları destekler, bağımlılık yok) ──

function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch !== '\r') field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const header = rows.shift().map(h => h.trim());
    return rows
        .filter(r => r.some(c => c.trim() !== ''))
        .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ── Seviye ayrıştırma ────────────────────────────────────────

/** "2x Platinum" → {multiplier: 2, level: "Platinum"} */
function parseLevel(raw) {
    const m = raw.match(/^(\d+)\s*[x×]\s*(.+)$/i);
    if (m) return { multiplier: parseInt(m[1], 10), level: m[2].trim() };
    return { multiplier: 1, level: raw.trim() };
}

/** "Gold 20,000" / "international album Diamond 200,000" → 20000 / 200000 */
function thresholdValue(raw) {
    const m = raw.match(/([\d.,]+)\s*$/);
    if (!m) return null;
    const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
}

// ── CSV denetimi ─────────────────────────────────────────────

function validateCSV(file) {
    const rows = parseCSV(fs.readFileSync(file, 'utf8'));
    const errors = [], warnings = [];
    const seen = new Map();

    const missingCols = REQUIRED_COLUMNS.filter(c => !(c in (rows[0] || {})));
    if (missingCols.length) {
        errors.push(`Eksik kolon(lar): ${missingCols.join(', ')}`);
        return { rows, errors, warnings };
    }

    // Kaynak kolonları: ayrık şema mı, eski tek-kolon mu?
    const hasSplitSources = SOURCE_COLUMNS.every(c => c in rows[0]);
    const hasLegacySource = 'source' in rows[0];
    if (!hasSplitSources && !hasLegacySource) {
        errors.push(`Kaynak kolonu yok: ${SOURCE_COLUMNS.join(' + ')} (veya eski "source")`);
        return { rows, errors, warnings };
    }
    if (!hasSplitSources) {
        warnings.push(`Dosya tek "source" kolonu kullanıyor. Ödül kaydı ile tarihsel ` +
            `eşik ayrı kanıtlardır — yeni dosyalarda ${SOURCE_COLUMNS.join(' ve ')} ayrı olmalı.`);
    }

    rows.forEach((r, i) => {
        const at = `satır ${i + 2} [${r.country} · ${r.title} · ${r.level}]`;
        const metric = r.metric;
        const counted = r.counted_sales_download_units;
        const hasCounted = counted !== '';
        const countedNum = hasCounted ? Number(counted) : null;

        // 1. Metrik sözlükte mi
        if (!SALES_METRICS.has(metric) && !NON_SALES_METRICS.has(metric)) {
            errors.push(`${at}: bilinmeyen metric "${metric}"`);
        }

        // 2. Stream / gelir metriği ünite taşıyamaz
        if (NON_SALES_METRICS.has(metric) && hasCounted) {
            errors.push(`${at}: metric "${metric}" satış birimi değil — ` +
                `counted_sales_download_units boş olmalı (yazılan: ${counted})`);
        }

        // 3. Satış metriği ünite taşımak zorunda
        if (SALES_METRICS.has(metric) && !hasCounted) {
            errors.push(`${at}: satış metriği ama counted_sales_download_units boş`);
        }

        // 4. Eşik yazılmış mı
        if (!r.threshold_at_award) {
            errors.push(`${at}: threshold_at_award boş — hangi eşiğin kullanıldığı ` +
                `görünmeden ünite doğrulanamaz`);
        }

        // 5. counted == eşik × çarpan mı
        if (SALES_METRICS.has(metric) && hasCounted && r.threshold_at_award) {
            const { multiplier } = parseLevel(r.level);
            const thr = thresholdValue(r.threshold_at_award);
            if (thr !== null) {
                const expected = thr * multiplier;
                if (countedNum !== expected) {
                    const why = r.official_reported_value
                        ? ` (official_reported_value dolu: "${r.official_reported_value}" — ` +
                          `gerçek satış rakamı counted'a değil oraya yazılmalı)`
                        : '';
                    errors.push(`${at}: counted ${countedNum.toLocaleString()} != ` +
                        `eşik ${thr.toLocaleString()} × ${multiplier} = ${expected.toLocaleString()}${why}`);
                }
            } else {
                warnings.push(`${at}: threshold_at_award "${r.threshold_at_award}" ` +
                    `içinden sayı okunamadı, çapraz kontrol atlandı`);
            }
        }

        // 6. Tarih
        if (!(r.certification_date_or_period || '').trim()) {
            warnings.push(`${at}: sertifika tarihi yok — eşik doğrulaması elle yapılmalı`);
        }

        // 7. Kaynaklar — ödül ve eşik ayrı ayrı gerekçelendirilmeli
        if (hasSplitSources) {
            SOURCE_COLUMNS.forEach(col => {
                if (!(r[col] || '').trim()) errors.push(`${at}: ${col} boş`);
            });
            if (r.award_source && r.award_source === r.threshold_source) {
                warnings.push(`${at}: ödül ve eşik aynı kaynağı gösteriyor — ` +
                    `tek kanıt iki olguyu birden desteklemiş oluyor, teyide değer`);
            }
        } else if (!(r.source || '').trim()) {
            errors.push(`${at}: source boş`);
        }

        // 8. Durum
        if (!/^confirmed/.test(r.status || '')) {
            warnings.push(`${at}: status "${r.status}" — teyitli değil, işlemeden önce bak`);
        }

        // 9. Mükerrer
        const key = [r.country, r.type, r.title].join('|').toLowerCase();
        if (seen.has(key)) {
            errors.push(`${at}: aynı ülke+eser ${seen.get(key)}. satırda da var`);
        } else seen.set(key, i + 2);
    });

    return { rows, errors, warnings };
}

// ── vault.json denetimi ──────────────────────────────────────

/** vault.js'ten gerçek hesap fonksiyonlarını çeker — yeniden yazmaz ki sapma olmasın */
function loadVaultEngine() {
    const src = fs.readFileSync(path.join(ROOT, 'vault.js'), 'utf8');
    const grab = (re, name) => {
        const m = src.match(re);
        if (!m) throw new Error(`vault.js içinden ${name} çıkarılamadı`);
        return m[0];
    };
    const parts = [
        grab(/const CERT_MAPPINGS[\s\S]*?\n};/, 'CERT_MAPPINGS'),
        grab(/function parseCertString[\s\S]*?\n}/, 'parseCertString'),
        grab(/const SALES_METRICS[\s\S]*?\n\]\);/, 'SALES_METRICS'),
        grab(/function resolveCert[\s\S]*?\n}/, 'resolveCert'),
        grab(/function certUnits[\s\S]*?\n}/, 'certUnits')
    ];
    return new Function(parts.join('\n') +
        '\nreturn { CERT_MAPPINGS, SALES_METRICS, parseCertString, resolveCert, certUnits };')();
}

function validateVault() {
    const { CERT_MAPPINGS, SALES_METRICS, resolveCert, certUnits } = loadVaultEngine();
    const vault = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vault.json'), 'utf8'));
    const errors = [], warnings = [];
    let checked = 0, objectForm = 0, nonSales = 0;

    const walk = (items, type) => items.forEach(item => {
        const certs = item.official_certifications || {};
        const dates = item.certification_dates || {};

        for (const [country, value] of Object.entries(certs)) {
            if (!value || value === 'None') continue;
            checked++;
            const at = `${type} "${item.title}" · ${country}`;

            // Eski biçim: virgüllü ham sayı sessizce 0 olur
            if (typeof value === 'string' && /^[\d.,]+$/.test(value)) {
                errors.push(`${at}: "${value}" ham sayı gibi yazılmış — ` +
                    `"NNNN units" formatı gerekiyor, aksi halde 0 sayılır`);
                continue;
            }

            const awards = resolveCert(value, country, type, item.id);
            if (typeof value !== 'string') objectForm++;

            awards.forEach(a => {
                if (!a.level) {
                    errors.push(`${at}: ödül nesnesinde "level" yok`);
                }
                if (!SALES_METRICS.has(a.metric)) {
                    nonSales++;
                    if (typeof a.units !== 'number') {
                        errors.push(`${at}: metric "${a.metric}" için units sayı olmalı`);
                    }
                    // Satış dışı ödül toplama girmemeli — motorun bunu yaptığını burada teyit et
                    return;
                }
                if (a.units === 0) {
                    const known = !!CERT_MAPPINGS[country];
                    errors.push(`${at}: "${a.level}" → 0 ünite. ` + (known
                        ? `"${country}" eşik tablosunda var ama bu seviye tanınmıyor`
                        : `"${country}" CERT_MAPPINGS'te yok — isimli seviye yerine "NNNN units" yaz`));
                }
            });

            // Obje biçiminde certified_at varken certification_dates'te de olması mükerrer
            if (typeof value === 'object' && !Array.isArray(value)
                && value.certified_at && dates[country]) {
                warnings.push(`${at}: tarih hem ödül nesnesinde hem certification_dates'te var`);
            }
        }

        // Öksüz tarih: karşılığında sertifika olmayan tarih
        for (const country of Object.keys(dates)) {
            const v = certs[country];
            if (!v || v === 'None') {
                errors.push(`${type} "${item.title}" · ${country}: certification_dates var ama sertifika yok`);
            }
        }
    });

    walk(vault.songs || [], 'song');
    walk(vault.albums || [], 'album');

    if (nonSales) {
        warnings.push(`${nonSales} ödül satış dışı metrikte (stream / gelir) — ` +
            `ünite toplamına katılmadı, bu beklenen davranış`);
    }
    return { checked, objectForm, errors, warnings };
}

// ── Çalıştırma ───────────────────────────────────────────────

function report(title, { errors, warnings }, okLine) {
    console.log(`\n${title}`);
    console.log('─'.repeat(title.length));
    warnings.forEach(w => console.log(`  UYARI  ${w}`));
    errors.forEach(e => console.log(`  HATA   ${e}`));
    if (!errors.length && !warnings.length) console.log(`  ${okLine}`);
    else console.log(`\n  ${errors.length} hata, ${warnings.length} uyarı`);
    return errors.length;
}

function main() {
    const arg = process.argv[2];
    if (!arg) {
        console.log('Kullanım:\n  node scripts/validate-certs.js <dosya.csv>\n' +
                    '  node scripts/validate-certs.js --vault');
        process.exit(2);
    }

    let failed = 0;
    if (arg === '--vault') {
        const res = validateVault();
        failed = report(`vault.json — ${res.checked} sertifika satırı (${res.objectForm} obje biçiminde)`, res, "Hepsi sayılıyor.");
    } else {
        if (!fs.existsSync(arg)) { console.error(`Dosya yok: ${arg}`); process.exit(2); }
        const res = validateCSV(arg);
        failed = report(`${path.basename(arg)} — ${res.rows.length} satır`, res, 'Temiz.');
    }
    process.exit(failed ? 1 : 0);
}

main();
