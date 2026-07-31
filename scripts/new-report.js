/**
 * new-report.js
 * ─────────────────────────────────────────────────────────────
 * Yeni bir aylık rapor sayfası üretir: reports/YYYY-MM.html
 *
 * Rakamları CANLI siteden okur (Puppeteer), şablona basar, sitemap ve
 * llms.txt'e ekler. Rapor sayfaları TARİHLİ ANLIK GÖRÜNTÜ olduğu için
 * üretildikten sonra DEĞİŞMEZ — nightly sync onlara dokunmaz.
 *
 * Neden var: tarihli, sabit permalink'li içerik, güncellik ima eden
 * sorularda modellerin belirgin şekilde tercih ettiği şey. Ayrıca
 * insanlara link verebilecekleri somut bir sayfa oluşturuyor.
 *
 * Kullanım:
 *   node new-report.js            → içinde bulunduğumuz ay
 *   node new-report.js 2026-08    → belirli ay
 *
 * ÖNEMLİ: Gelecek tarihli rapor üretmez. Ayın 1'inde çalıştır.
 * ─────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const SITE_URL = process.env.SITE_URL || 'https://justin-timberlake-stats.vercel.app';
const REPO_ROOT = path.join(__dirname, '..');
const ARTIST_RATIO = 1.82;

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const ERA_META = [
    { id: 'Justified',                       cover: 'justified.jpg', year: 2002 },
    { id: 'FutureSex/LoveSounds',            cover: 'fsls.jpg',      year: 2006 },
    { id: 'The 20/20 Experience',            cover: 'the20.jpg',     year: 2013, label: '2013 · both parts' },
    { id: 'Man of the Woods',                cover: 'motw.jpg',      year: 2018 },
    { id: 'Everything I Thought It Was',     cover: 'eitiw.jpg',     year: 2024 },
    { id: 'Orphan',                          cover: null,            year: null, display: 'Non-album singles & features', label: '2002–2026' }
];

function fmtB(n) { return (n / 1e9).toFixed(2) + 'B'; }
function fmtM(n) { return (n / 1e6).toFixed(1) + 'M'; }
function fmtBig(n) { return n >= 1e9 ? fmtB(n) : fmtM(n); }
function fmtEAS(n) { return (n / 1e6).toFixed(2) + 'M'; }

async function readLive() {
    const browser = await puppeteer.launch({
        headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage();

        // ── Ana sayfa: EAS tablosu + per-album stream verileri ──
        await page.goto(`${SITE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(
            () => {
                const el = document.getElementById('ai-eas-value');
                return el && /^\d+(\.\d+)?M$/.test(el.textContent.trim());
            },
            { timeout: 60000 }
        );
        await new Promise(r => setTimeout(r, 2500));

        const home = await page.evaluate(() => {
            const rows = [...document.querySelectorAll('#eas-table-body tr')].map(tr =>
                [...tr.querySelectorAll('td')].map(td => td.textContent.trim().replace(/\s+/g, ' '))
            );
            const albums = {};
            if (typeof jtData !== 'undefined' && jtData.albums) {
                for (const k in jtData.albums) {
                    albums[k] = {
                        spotify: jtData.albums[k].streams.spotify || 0,
                        youtube: jtData.albums[k].streams.youtube || 0,
                        pure: jtData.albums[k].pureSales || 0
                    };
                }
            }
            const num = id => {
                const el = document.getElementById(id);
                return el ? parseInt(el.textContent.replace(/[^\d]/g, ''), 10) || 0 : 0;
            };
            return { rows, albums, youtubeHeadline: num('youtube-total'), easTotal: num('eas-total') };
        });

        // ── Streams sayfası: kariyer toplamı, günlük, projeksiyon ──
        await page.goto(`${SITE_URL}/streams.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(
            () => {
                const el = document.getElementById('jt-total-career');
                return el && /^[\d,]+$/.test(el.textContent.trim()) &&
                       parseInt(el.textContent.replace(/,/g, ''), 10) > 15e9;
            },
            { timeout: 60000 }
        );
        await new Promise(r => setTimeout(r, 3000));

        const streams = await page.evaluate(() => {
            const t = id => (document.getElementById(id) || {}).textContent || '';
            const num = id => parseInt((t(id) || '').replace(/[^\d]/g, ''), 10) || 0;
            const tracks = [...document.querySelectorAll('#streams-table-body tr')]
                .slice(0, 3)
                .map(tr => {
                    const td = tr.querySelectorAll('td');
                    return { title: td[0] ? td[0].textContent.trim() : '',
                             total: td[1] ? parseInt(td[1].textContent.replace(/[^\d]/g, ''), 10) || 0 : 0 };
                });
            return {
                careerTotal: num('jt-total-career'),
                dailyTotal:  num('jt-daily-career'),
                eoy:   t('eoy-total').trim(),
                rate:  num('eoy-daily-rate'),
                month: num('jt-monthly-growth'),
                tracks
            };
        });

        // ── Vault: certified + eligible toplamı ──
        await page.goto(`${SITE_URL}/vault.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(
            () => {
                const el = document.getElementById('grand-total-odometer');
                return el && /^[\d,]+$/.test(el.textContent.trim());
            },
            { timeout: 60000 }
        );
        const certs = await page.$eval('#grand-total-odometer',
            el => parseInt(el.textContent.replace(/,/g, ''), 10) || 0);

        await page.close();
        return { ...home, ...streams, certs };
    } finally {
        await browser.close();
    }
}

function buildEraRows(live) {
    const rows = [];
    for (const meta of ERA_META) {
        const a = live.albums[meta.id];
        if (!a) continue;
        rows.push({
            name: meta.display || meta.id,
            label: meta.label || String(meta.year),
            cover: meta.cover,
            spotify: a.spotify,
            youtube: a.youtube,
            aod: Math.round(a.spotify * ARTIST_RATIO)
        });
    }
    // Orphan (albüm dışı) kalanı: kariyer toplamı − stüdyo albümleri
    const studioSum = rows.filter(r => r.cover).reduce((s, r) => s + r.spotify, 0);
    const orphan = rows.find(r => !r.cover);
    if (orphan && live.careerTotal > studioSum) {
        orphan.spotify = live.careerTotal - studioSum;
        orphan.aod = Math.round(orphan.spotify * ARTIST_RATIO);
    }
    return rows;
}

function renderChartRows(rows, maxVal) {
    return rows.map(r => {
        const pct = (r.spotify / maxVal * 100).toFixed(1);
        const cover = r.cover
            ? `<img class="cover" src="../assets/${r.cover}" alt="${r.name} cover">`
            : `<div class="cover ph" title="Non-album">★</div>`;
        return `    <div class="row">
      ${cover}
      <div class="barwrap">
        <div class="barlabel"><div class="name">${r.name} <span>· ${r.label}</span></div><div class="num">${fmtBig(r.spotify)}</div></div>
        <div class="track"><div class="fill${r.cover ? '' : ' alt'}" style="width:${pct}%"></div></div>
        <div class="daily">${fmtBig(r.aod)} AOD streams · ${fmtBig(r.youtube)} YouTube views</div>
      </div>
    </div>`;
    }).join('\n\n');
}

function renderTableRows(rows, careerTotal) {
    return rows.map(r =>
        `      <tr><td>${r.name}</td><td>${r.label}</td>` +
        `<td class="n">${r.spotify.toLocaleString('en-US')}</td>` +
        `<td class="n">${r.aod.toLocaleString('en-US')}</td>` +
        `<td class="n">${r.youtube.toLocaleString('en-US')}</td>` +
        `<td class="n">${(r.spotify / careerTotal * 100).toFixed(1)}%</td></tr>`
    ).join('\n');
}

function template(o) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="author" content="Emir">
<link rel="icon" type="image/jpeg" href="../assets/jt-hero.jpg">
<title>Justin Timberlake Streaming Report — ${o.monthName} ${o.year} | Timberlake Analytics</title>
<meta name="description" content="Justin Timberlake's Spotify catalogue reached ${fmtB(o.careerTotal)} streams as of ${o.dateHuman}. Era-by-era breakdown, AOD conversion, YouTube views and year-end projection.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${SITE_URL}/reports/${o.slug}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Timberlake Analytics">
<meta property="og:title" content="Justin Timberlake Streaming Report — ${o.monthName} ${o.year}">
<meta property="og:description" content="${fmtB(o.careerTotal)} Spotify streams, era-by-era, as of ${o.dateHuman}.">
<meta property="og:url" content="${SITE_URL}/reports/${o.slug}.html">
<meta property="og:image" content="${SITE_URL}/assets/jt-horizontal.png">
<meta name="twitter:card" content="summary_large_image">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "${SITE_URL}/"},
        {"@type": "ListItem", "position": 2, "name": "Reports", "item": "${SITE_URL}/reports/${o.slug}.html"}
      ]
    },
    {
      "@type": "Report",
      "headline": "Justin Timberlake Streaming Report — ${o.monthName} ${o.year}",
      "datePublished": "${o.dateIso}",
      "dateModified": "${o.dateIso}",
      "inLanguage": "en",
      "url": "${SITE_URL}/reports/${o.slug}.html",
      "author": {"@type": "Person", "name": "Emir", "url": "${SITE_URL}/about.html#author"},
      "publisher": {"@type": "Organization", "name": "Timberlake Analytics", "url": "${SITE_URL}/"},
      "about": {"@type": "MusicGroup", "name": "Justin Timberlake"},
      "description": "As of ${o.dateHuman}, Justin Timberlake's Spotify catalogue has accumulated ${o.careerTotal.toLocaleString('en-US')} streams, growing at approximately ${fmtM(o.rate)} per day. Career equivalent album sales stand at approximately ${fmtEAS(o.easTotal)}, and total certified plus streaming-eligible units at approximately ${Math.round(o.certs / 1e6)} million."
    }
  ]
}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Grotesk:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#0a0a0a; --fg:#f5f5f5; --dim:rgba(255,255,255,0.45); --accent:#d4a853; --line:rgba(255,255,255,0.08); }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:'Space Grotesk',system-ui,sans-serif; line-height:1.6; }
  .wrap { max-width:920px; margin:0 auto; padding:48px 24px 80px; }
  .eyebrow { font-size:0.72rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--accent); margin-bottom:14px; }
  h1 { font-family:'Playfair Display',serif; font-size:clamp(2rem,5vw,3.2rem); line-height:1.1; margin:0 0 14px; }
  .dateline { color:var(--dim); font-size:0.9rem; border-bottom:1px solid var(--line); padding-bottom:24px; margin-bottom:36px; }
  .dateline strong { color:var(--fg); font-weight:500; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px; margin-bottom:44px; }
  .kpi { border:1px solid var(--line); border-radius:12px; padding:18px 20px; background:rgba(255,255,255,0.02); }
  .kpi .label { font-size:0.68rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--dim); margin-bottom:8px; }
  .kpi .value { font-family:'Playfair Display',serif; font-size:1.85rem; color:var(--accent); line-height:1; }
  .kpi .sub { font-size:0.78rem; color:var(--dim); margin-top:7px; }
  h2 { font-family:'Playfair Display',serif; font-size:1.5rem; margin:48px 0 6px; }
  .h2sub { color:var(--dim); font-size:0.88rem; margin:0 0 26px; }
  .chart { border:1px solid var(--line); border-radius:14px; padding:26px 24px 20px; background:linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0)); }
  .chart-head { display:flex; justify-content:space-between; align-items:baseline; gap:16px; flex-wrap:wrap; margin-bottom:22px; }
  .chart-title { font-family:'Playfair Display',serif; font-size:1.25rem; }
  .chart-meta { font-size:0.74rem; color:var(--dim); letter-spacing:0.06em; }
  .row { display:grid; grid-template-columns:52px 1fr; gap:14px; align-items:center; margin-bottom:15px; }
  .cover { width:52px; height:52px; border-radius:7px; object-fit:cover; border:1px solid rgba(255,255,255,0.14); display:block; }
  .cover.ph { display:flex; align-items:center; justify-content:center; font-size:1.4rem; background:rgba(212,168,83,0.12); color:var(--accent); }
  .barwrap { min-width:0; }
  .barlabel { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:6px; }
  .name { font-size:0.9rem; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .name span { color:var(--dim); font-weight:300; font-size:0.8rem; }
  .num { font-size:0.9rem; color:var(--accent); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .track { height:11px; border-radius:6px; background:rgba(255,255,255,0.06); overflow:hidden; }
  .fill { height:100%; border-radius:6px; background:linear-gradient(90deg,#8a6a2a,#d4a853); }
  .fill.alt { background:linear-gradient(90deg,#3a3a3a,#8f8f8f); }
  .daily { font-size:0.72rem; color:var(--dim); margin-top:5px; }
  .chart-foot { border-top:1px solid var(--line); margin-top:20px; padding-top:14px; font-size:0.72rem; color:var(--dim); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  th,td { text-align:left; padding:11px 10px; border-bottom:1px solid var(--line); }
  th { font-size:0.68rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--dim); font-weight:500; }
  td.n { text-align:right; font-variant-numeric:tabular-nums; }
  .scroll { overflow-x:auto; }
  p { color:rgba(255,255,255,0.72); }
  a { color:var(--accent); }
  .note { font-size:0.84rem; color:var(--dim); border-left:2px solid var(--accent); padding-left:14px; margin:26px 0; }
  footer { border-top:1px solid var(--line); margin-top:56px; padding-top:24px; font-size:0.78rem; color:var(--dim); }
</style>
</head>
<body>
<div class="wrap">

  <div class="eyebrow">Monthly Report · ${o.monthName} ${o.year}</div>
  <h1>Justin Timberlake Streaming Report</h1>
  <p class="dateline">
    Data as of <strong>${o.dateHuman}</strong> · Compiled by
    <a href="../about.html#author">Emir</a> for Timberlake Analytics ·
    Source: live Spotify counts via Kworb, YouTube Data API v3
  </p>

  <div class="kpis">
    <div class="kpi">
      <div class="label">Career Spotify streams</div>
      <div class="value">${fmtB(o.careerTotal)}</div>
      <div class="sub">${o.careerTotal.toLocaleString('en-US')}</div>
    </div>
    <div class="kpi">
      <div class="label">Current daily rate</div>
      <div class="value">${fmtM(o.dailyTotal)}</div>
      <div class="sub">+${fmtBig(o.month)} in the last 30 days</div>
    </div>
    <div class="kpi">
      <div class="label">Equivalent album sales</div>
      <div class="value">${fmtEAS(o.easTotal)}</div>
      <div class="sub">Chartmasters CSPC method</div>
    </div>
    <div class="kpi">
      <div class="label">Certified + eligible units</div>
      <div class="value">${Math.round(o.certs / 1e6)}M</div>
      <div class="sub">60+ certifying bodies</div>
    </div>
  </div>

  <h2>Where the ${fmtB(o.careerTotal)} sits</h2>
  <p class="h2sub">Spotify streams by era, with the AOD conversion and YouTube views behind each one.</p>

  <div class="chart" id="chart">
    <div class="chart-head">
      <div class="chart-title">Justin Timberlake — Spotify streams by era</div>
      <div class="chart-meta">${o.dateHuman.toUpperCase()} · TIMBERLAKE ANALYTICS</div>
    </div>

${o.chartRows}

    <div class="chart-foot">
      <div>Bars scaled to the largest group. Total catalogue: ${o.careerTotal.toLocaleString('en-US')}.</div>
      <div>justin-timberlake-stats.vercel.app</div>
    </div>
  </div>

  <h2>Era detail</h2>
  <p class="h2sub">Raw Spotify streams, the AOD figure they convert to (×${ARTIST_RATIO}), and YouTube views. As of ${o.dateHuman}.</p>
  <div class="scroll">
  <table>
    <thead>
      <tr><th>Era</th><th>Year</th><th class="n">Spotify streams</th><th class="n">AOD streams</th><th class="n">YouTube views</th><th class="n">Share</th></tr>
    </thead>
    <tbody>
${o.tableRows}
    </tbody>
  </table>
  </div>
  <div class="note">
    Per-era YouTube figures overlap slightly where a video is credited to more than
    one era; the deduplicated career total is ${fmtB(o.youtubeHeadline)} views.
  </div>

  <h2>Year-end projection</h2>
  <p class="h2sub">Weighted blend of the 7-day, 30-day and year-to-date rates.</p>
  <p>
    The catalogue is running at roughly <strong>${fmtM(o.rate)} streams per day</strong> on the
    blended rate. On that trajectory it finishes ${o.year} at approximately
    <strong>${o.eoy}</strong>.
  </p>

  <h2>Method, in one paragraph</h2>
  <p>
    Stream totals are read live from Kworb's Spotify pages and reconciled nightly against a
    Firestore snapshot, which is what makes the daily and 30-day deltas possible. Raw Spotify
    counts are multiplied by an artist ratio of ${ARTIST_RATIO} to give total audio-on-demand
    (AOD) streams before conversion. Equivalent album sales use the Chartmasters CSPC rates
    (1,166 AOD streams or 6,750 YouTube views to one album equivalent). Certified units combine
    awards from RIAA, BPI, ARIA, BVMI and 60+ other bodies with US units currently eligible for
    certification under live streaming data. Full formulas and sources are on the
    <a href="../about.html">methodology page</a>.
  </p>

  <footer>
    Timberlake Analytics — independent music analytics by Emir.
    Not affiliated with Justin Timberlake or RCA Records.<br>
    Live figures: <a href="../index.html">career overview</a> ·
    <a href="../streams.html">streaming tracker</a> ·
    <a href="../vault.html">certification vault</a>
  </footer>

</div>
</body>
</html>
`;
}

function addToSitemap(slug) {
    const p = path.join(REPO_ROOT, 'sitemap.xml');
    let xml = fs.readFileSync(p, 'utf-8');
    const loc = `${SITE_URL}/reports/${slug}.html`;
    if (xml.includes(loc)) { console.log('sitemap: zaten var'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const entry = `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    xml = xml.replace('</urlset>', entry + '</urlset>');
    fs.writeFileSync(p, xml, 'utf-8');
    console.log('sitemap: eklendi');
}

function addToLlms(o) {
    const p = path.join(REPO_ROOT, 'llms.txt');
    let txt = fs.readFileSync(p, 'utf-8');
    const url = `${SITE_URL}/reports/${o.slug}.html`;
    if (txt.includes(url)) { console.log('llms.txt: zaten var'); return; }
    const entry = `- [${o.monthName} ${o.year} streaming report](${url})
  (published ${o.dateHuman}): ${o.careerTotal.toLocaleString('en-US')} Spotify streams,
  +${fmtM(o.rate)}/day. Career EAS ${fmtEAS(o.easTotal)}, certified + eligible ${Math.round(o.certs / 1e6)}M.
`;
    // "## Dated monthly reports" bölümünün sonuna ekle (en yeni en üstte)
    const marker = /(## Dated monthly reports\n\n[\s\S]*?\n\n)(- \[)/;
    if (marker.test(txt)) {
        txt = txt.replace(marker, (_, head, li) => head + entry + li);
    } else {
        console.warn('llms.txt: rapor bölümü bulunamadı, atlandı');
        return;
    }
    fs.writeFileSync(p, txt, 'utf-8');
    console.log('llms.txt: eklendi');
}

async function main() {
    const arg = process.argv[2];
    const now = new Date();

    let year, monthIdx;
    if (arg) {
        const m = arg.match(/^(\d{4})-(\d{2})$/);
        if (!m) throw new Error('Ay formatı YYYY-MM olmalı, örn: 2026-08');
        year = Number(m[1]); monthIdx = Number(m[2]) - 1;
    } else {
        year = now.getFullYear(); monthIdx = now.getMonth();
    }

    // Gelecek tarihli rapor üretmeyi reddet — tarih uydurmak olur.
    const firstOfMonth = new Date(Date.UTC(year, monthIdx, 1));
    if (firstOfMonth > now) {
        throw new Error(
            `${year}-${String(monthIdx + 1).padStart(2, '0')} henüz başlamadı. ` +
            `Rapor sayfaları tarihli anlık görüntü; ileri tarihli üretilemez.`
        );
    }

    const slug = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const outPath = path.join(REPO_ROOT, 'reports', `${slug}.html`);
    if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
        throw new Error(`${slug}.html zaten var. Üzerine yazmak için --force ekle.`);
    }

    console.log(`Canlı veriler okunuyor: ${SITE_URL}`);
    const live = await readLive();

    if (!live.careerTotal || live.careerTotal < 15e9 || !live.easTotal || !live.certs) {
        throw new Error(`Okunan değerler mantıksız: career=${live.careerTotal}, eas=${live.easTotal}, certs=${live.certs}`);
    }

    const rows = buildEraRows(live);
    const maxVal = Math.max(...rows.map(r => r.spotify));

    const o = {
        slug, year,
        monthName: MONTHS[monthIdx],
        dateIso: now.toISOString().slice(0, 10),
        dateHuman: `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
        careerTotal: live.careerTotal,
        dailyTotal: live.dailyTotal,
        month: live.month,
        rate: live.rate,
        eoy: live.eoy,
        easTotal: live.easTotal,
        certs: live.certs,
        youtubeHeadline: live.youtubeHeadline,
        chartRows: renderChartRows(rows, maxVal),
        tableRows: renderTableRows(rows, live.careerTotal)
    };

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, template(o), 'utf-8');
    console.log(`✅ reports/${slug}.html yazıldı`);

    addToSitemap(slug);
    addToLlms(o);

    console.log(`\nSıradaki adımlar:`);
    console.log(`  1) node render-chart.js ../reports/${slug}.html ../assets/reports/${slug}-era-chart.png "#chart"`);
    console.log(`  2) git add -A && git commit && git push`);
    console.log(`  3) node indexnow-ping.js /reports/${slug}.html`);
}

main().catch(err => {
    console.error('new-report hatası:', err.message);
    process.exit(1);
});
