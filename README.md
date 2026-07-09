# Timberlake Analytics

> Real-time music analytics platform tracking Justin Timberlake's entire solo catalog — Spotify streams, certifications, equivalent album sales, and box office, recomputed on every page load.

**Live site:** [justin-timberlake-stats.vercel.app](https://justin-timberlake-stats.vercel.app)
**Maintainer:** Emir Kilic ([@emoycukv3](https://x.com/emoycukv3))

---

## What this is

Most public music data sources publish annual snapshots or static estimates. Timberlake Analytics recomputes every number on each page load by combining live data from four sources:

- **Spotify** (via Kworb HTML scrape proxy) — career, daily, per-track streams
- **YouTube Data API v3** — real view counts for every video in the catalog
- **Spotify Web API** (via custom serverless proxy) — artist metadata, top tracks, monthly listeners
- **Firestore** — nightly snapshots for 7-day / 30-day / YTD trend analysis (GitHub Actions cron)

On top of the live data, a custom analytics engine computes:

- **Equivalent Album Sales (EAS)** using the Chartmasters CSPC methodology (1,166 streams ≈ 1 album, with artist-ratio adjustment of 1.82)
- **RIAA streaming-eligible units** quantized to certification thresholds (Gold / Platinum / Diamond)
- **Global certified units** across 60+ certifying bodies (RIAA, BPI, ARIA, Music Canada, IFPI, etc.) with per-country thresholds and legacy-era overrides
- **Year-end stream projection** using a weighted blend of weekly / monthly / YTD growth rates
- **Milestone ETA forecasting** per track using historical 7d/30d snapshots

---

## Why I built it

I'm a music data analyst and a longtime Justin Timberlake catalog researcher. No public source tracks JT's streaming, certifications, and equivalent album sales in one place using live data — most aggregators rely on yearly snapshots or estimates. I built this to:

1. Have one place where every metric stays current automatically.
2. Make the methodology fully reproducible — every formula is documented openly on the [About page](https://justin-timberlake-stats.vercel.app/about.html).
3. Show that catalog-level analytics for a single artist is a real, ongoing engineering problem — not just "scrape Spotify once."

---

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Kworb HTML │    │ YouTube API  │    │  Spotify API │
│   scrape    │    │     v3       │    │  (OAuth via  │
│   (proxy)   │    │              │    │  /api proxy) │
└──────┬──────┘    └──────┬───────┘    └──────┬───────┘
       │                  │                   │
       └──────────┬───────┴───────────────────┘
                  │
         ┌────────▼──────────┐
         │   Vanilla JS      │     ┌──────────────────┐
         │   analytics       │◄────┤  Firestore       │
         │   engine          │     │  (snapshots,     │
         │   (EAS, RIAA,     │     │  GitHub Actions  │
         │   60+ countries)  │     │  cron)           │
         └────────┬──────────┘     └──────────────────┘
                  │
         ┌────────▼──────────┐
         │   Static pages    │
         │   (Vercel)        │
         └───────────────────┘
```

**Stack:** Vanilla HTML/CSS/JS · Tailwind CDN · Vercel (static + 1 serverless function) · Firebase Firestore · GitHub Actions · Chart.js

No framework. No build step. Every file is human-readable and editable.

---

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Hero + career EAS odometer |
| `streams.html` | Live Spotify dashboard — career total, daily rate, 7d/30d/YTD growth, per-track table, year-end projection, milestone radar |
| `vault.html` | Global certification database — every song and album across 60+ countries with sortable tables and live US streaming-eligible units |
| `album.html` | Per-album deep dive with track-level EAS breakdown |
| `analytics.html`, `charts.html` | Trend charts and historical analysis |
| `awards.html`, `tours.html` | Grammys, box office grosses |
| `games.html` | Two interactive games: Album Crush (match-3) and Timbertrix (era selector) |
| `about.html` | Full methodology — every formula, every data source, every edge case explained |

---

## Interesting engineering bits

A few problems that turned out to be harder than they look:

- **Track title fuzzy matching** — Spotify, YouTube, RIAA, and Kworb all spell the same song differently (`"Senorita"` vs `"Señorita"` vs `"Senõrita"`). Resolved via lowercase substring matching with a per-track override map.
- **RIAA quantization** — official certifications round *down* to the nearest million (3.3M pure sales → 3.0M certified Platinum count). Live streaming additions can re-cross thresholds; the calculator handles both regimes.
- **Pre-2016 era streaming share** — Justified, FSLS, and 20/20 era tracks have a US share of ~0.27 in their streams (older catalog tilts more international), while post-2016 releases use the modern 0.35. Hardcoded by era.
- **Streaming-only certifications** — Denmark, Germany, and others use streaming-equivalent thresholds that differ from physical thresholds. Stored as `"NNNN units"` raw counts in the data layer instead of normalized cert strings.
- **NSYNC scope** — every figure is solo-only by default. NSYNC inclusion is mentioned in SEO copy but not blended into calculations (different rights, different label).
- **Year-end stream projection** — weighted blend of weekly (35%), monthly (45%), and YTD (20%) growth rates, recomputed live with sparse Firestore reads (10 key points instead of 30 daily) for performance.

---

## Performance

- First load: parallel `Promise.all` for Kworb fetch + Firestore init
- `html2canvas` (~1MB, used only for "Generate Card") is lazy-loaded on first click
- Firestore reads cut from 33 → 13 sparse key points without losing chart fidelity
- All scripts deferred; fonts loaded with `media="print" onload` swap

---

## Local development

```bash
# 1. Clone
git clone https://github.com/emirkilictis/Justin-Timberlake-Stats.git
cd Justin-Timberlake-Stats

# 2. Add API keys
cp config.example.js config.js
# edit config.js with your Kworb proxy URL, YouTube API key, Firebase config

# 3. Serve locally (any static server)
python3 -m http.server 8000
# open http://localhost:8000
```

For the daily snapshot script (run via GitHub Actions in production):

```bash
cd scripts
npm install
FIREBASE_SERVICE_ACCOUNT='...' KWORB_PROXY_URL='...' node daily-snapshot.js
```

---

## Methodology

The [About page](https://justin-timberlake-stats.vercel.app/about.html) documents every formula, threshold, and data source in detail. Highlights:

- **EAS formula:** `pureSales + (singles ÷ 10) + (audioStreams × 1.82 ÷ 1166) + (videoViews ÷ 6750)`
- **RIAA live eligibility:** `floor((usStreams ÷ 150) + pureSalesUS)`
- **Country certifications:** per-country Gold / Platinum / Diamond thresholds, with album/song distinction for UK, Brazil, Germany, NZ, Denmark, Spain, Sweden, Belgium, Austria, Portugal; Canada legacy 50k/100k overrides for *Justified* and *FutureSex/LoveSounds*

---

## Disclaimer

Independent music analytics project. Not affiliated with Justin Timberlake, RCA Records, Sony Music Entertainment, or any associated management. All data is sourced from public records and third-party APIs.

---

## License

Code: MIT. Data files (`data/vault.json`, `data.json`) are compiled from public sources and provided for personal / research use.

---

## Contact

- X: [@emoycukv3](https://x.com/emoycukv3)
- TikTok: [@emirtimber](https://www.tiktok.com/@emirtimber)
- Site: [justin-timberlake-stats.vercel.app](https://justin-timberlake-stats.vercel.app)
