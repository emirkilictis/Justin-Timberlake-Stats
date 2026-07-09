# Case Study: How I Built a Real-Time Music Analytics Platform for Justin Timberlake's Catalog

**Target length:** ~1,500 words (5-7 min read)
**Where to post:**
  1. Medium (under your own name, no publication needed to start)
  2. Dev.to (republish with canonical URL pointing to Medium)
  3. LinkedIn Article (republish; gives you LinkedIn reach)
  4. Hacker News (Show HN: I tracked one artist's entire catalog with live data) — only post once it's polished

**Goal:** When a recruiter Googles "Emir Kilic", this case study should appear in the first 5 results. It's also the link you put in cold emails.

---

## Suggested structure

### 1. Hook (~150 words)
Open with a concrete, surprising number. Examples to pick from:

- "Justin Timberlake's catalog generated approximately 8 million Spotify streams yesterday. I know because my website recomputed it from live data three minutes ago."
- "Most music industry data you read in articles is between 6 and 18 months old. I got tired of that, so I built a site that recomputes Justin Timberlake's entire career numbers on every page load."

Then in one sentence: what the site is, who you are, and what this post will cover.

> *Writing tip: don't start with "I'm a fan of Justin Timberlake." Start with the data problem. The fan part comes later as flavor.*

---

### 2. The problem (~200 words)

What's wrong with how music catalog data exists today:

- Wikipedia album sales figures: often years out of date, debated in talk pages
- RIAA's database: only US, only what labels submit (labels often delay submissions)
- Chartmasters: excellent methodology but annual updates only
- Spotify for Artists / Luminate / Chartmetric: paywalled, not accessible to fans, researchers, or journalists

The gap: no live-data, methodology-transparent, public source for catalog-level analytics on a single artist.

End with a one-line thesis: *I picked one artist with a long catalog (22 years, 6 studio albums, 17B+ Spotify streams) and built what I wished existed.*

---

### 3. What I built (~250 words)

Quick tour with **one screenshot per section**:

- **Live streaming dashboard** — daily streams, weekly/monthly growth, year-end projection
- **Certification vault** — per-song, per-country, sortable across 60+ certifying bodies
- **EAS calculator** — Chartmasters CSPC methodology, recomputed on every load
- **Per-album deep dive** — track-level breakdowns
- **Trend chart** — 30-day rolling history from nightly Firestore snapshots

Link to the live site under each screenshot. Don't dump every page — pick the 3-4 that look most impressive in screenshots.

---

### 4. Architecture (~250 words)

This is the section that proves you know what you're doing. Include the ASCII diagram from the README (or a real diagram made in Excalidraw / tldraw). Walk through:

- **Data sources** — Kworb scrape, YouTube API v3, Spotify Web API (via your own /api proxy because Spotify needs OAuth), Firestore for time-series
- **Compute layer** — vanilla JS analytics engine, no framework
- **Persistence** — GitHub Actions cron at 00:05 UTC writes nightly snapshots to Firestore
- **Hosting** — Vercel static + 1 serverless function

Why vanilla JS, no framework? Be honest: you wanted to ship fast and keep it readable, and the analytics logic was where the complexity belonged, not the rendering.

---

### 5. The hard parts (~400 words — the most important section)

This is what recruiters and interviewers actually want to read. Pick 3-4 problems that surprised you. Concrete suggestions from your codebase:

**A. RIAA quantization and the 300k problem.** Pure album sales of 3.3M for *Suit & Tie* should be 3.3M RIAA units, right? No — RIAA rounds *down* to the nearest million for certification awards. So 3.3M becomes 3.0M certified. Then live Spotify streams add an extra ~1.2M units across the year and the song crosses the 4M threshold mid-year. Implementing this "live re-certification" logic was harder than expected.

**B. Track title fuzzy matching across four data sources.** Spotify says `"Señorita"`, YouTube says `"Senorita"`, Kworb says `"Senõrita"`, RIAA's database says `"Senorita - Single Version"`. Built a lowercase substring matcher with a per-track override map. Took two evenings to debug all the edge cases (`"4 Minutes - feat. Madonna and Timbaland"` is the worst offender).

**C. Pre-2016 vs post-2016 streaming share.** Older catalog (Justified, FSLS) skews more international in modern streaming because Gen Z discovered them on TikTok in countries where physical sales were never strong. So the US share of streams for those eras is ~0.27, while post-2016 releases are ~0.35. This isn't documented anywhere — I figured it out by reconciling label-reported numbers against my live counts. Hardcoded by era as a constant, with comments explaining the empirical derivation.

**D. Performance on a data-heavy first paint.** Initial load was waiting for Kworb (1-2s) → then Firestore init (up to 6s) → then 33 sequential Firestore reads. Rewrote with `Promise.all` to run Kworb fetch and Firestore init in parallel, cut Firestore reads from 33 to 13 sparse sample points (no visible change in the chart), and lazy-loaded html2canvas (~1MB) until first click. Took the dashboard from ~7s to ~2-3s.

> *Writing tip: every one of these should have a code snippet (3-8 lines, with the function name visible). Don't dump entire files. Link to the file on GitHub for readers who want more.*

---

### 6. What I learned (~150 words)

Be honest and specific. Examples:

- Music industry data is messier than tech data because there are no canonical IDs across providers
- Vanilla JS scales further than people think — 1,200 lines of analytics code in `streams.js` is still readable
- Caching matters more than clever algorithms when your data source is an HTML scrape
- Schema.org JSON-LD has more SEO impact than meta tags in the AI-Overview era

---

### 7. What's next (~100 words)

Keep it short. Mention 1-2 concrete next things you're thinking about:

- Extending the methodology to one other artist to validate the engine generalizes
- Adding a public API so other fan researchers can query the data
- Open-sourcing the certifications database

Closing line: invitation to connect — your X handle, your email, your LinkedIn.

---

## Writing checklist before publishing

- [ ] Has a strong opening sentence with a concrete number
- [ ] Mentions specific company / product names you're targeting indirectly (Chartmetric, Soundcharts, Luminate, Spotify) so those companies appear in your post's keyword density
- [ ] Every section has at least one screenshot OR code snippet
- [ ] You've named the technologies (Vercel, Firestore, GitHub Actions, vanilla JS) explicitly so they show up in keyword searches
- [ ] You've linked to your GitHub repo at least 3 times
- [ ] You've linked to the live site at least 3 times
- [ ] Bio at the bottom: "Emir Kilic is an independent music data analyst. He's looking for [internship / role] at [music data / data analytics] companies. Reach out at [contact]."
- [ ] Tags on Medium: `music`, `data-analytics`, `data-engineering`, `javascript`, `case-study`, `portfolio`
- [ ] Cross-post canonical URL set correctly on Dev.to and LinkedIn

---

## Tone notes

- Don't be self-deprecating ("just a fan project", "nothing special")
- Don't oversell ("revolutionary platform"). Recruiters can smell it
- Do be specific. Numbers, formulas, gotchas, decisions you made
- Do credit prior art (Chartmasters CSPC) — shows you read the field
- Avoid emojis in section headers (cleaner for technical writing)

Aim for the tone of [Dan Luu](https://danluu.com/) or [Julia Evans](https://jvns.ca/) — informed, specific, no fluff. Not corporate, not bro-y.
