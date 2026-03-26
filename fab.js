(function () {
    const DEFAULT_COLOR = '#d4a853';

    const ERAS = [
        { id: "default",                     color: DEFAULT_COLOR, cover: "assets/jt-hero.jpg", short: "JT"    },
        { id: "Justified",                   color: "#5dade2",     cover: "assets/justified.jpg", short: "JUS" },
        { id: "FutureSex/LoveSounds",        color: "#e74c3c",     cover: "assets/fsls-deluxe.jpg", short: "FSLS" },
        { id: "The 20/20 Experience",        color: "#b8912e",     cover: "assets/the20.jpg",     short: "20/20"},
        { id: "Man of the Woods",            color: "#e67e22",     cover: "assets/motw.jpg",      short: "MOTW" },
        { id: "Everything I Thought It Was", color: "#ca510f",     cover: "assets/eitiw.jpg",     short: "EITIW"},
        { id: "Orphan",                      color: "#bdc3c7",     cover: null,                   short: "ORP"  },
    ];

    let isOpen = false;

    // ── FAB Inject ──────────────────────────────────────────────────
    function injectFAB() {
        const itemsHTML = ERAS.map(era => {
            const bg = era.cover ? `url('${era.cover}')` : 'linear-gradient(135deg,#111,#222)';
            const isDefault = era.id === 'default';
            return `
                <div class="fab-era-item${isDefault ? ' fab-default' : ''}"
                     data-album="${era.id}" data-color="${era.color}"
                     style="background-image:${bg};background-size:cover;background-position:center;"
                     title="${isDefault ? 'Default Theme' : era.id}">
                    <div class="fab-era-label">${isDefault ? '★' : era.short}</div>
                </div>`;
        }).join('');

        const fabEl = document.createElement('div');
        fabEl.id = 'era-fab';
        fabEl.innerHTML = `
            <div id="era-fab-menu">${itemsHTML}</div>
            <button id="era-fab-btn" aria-label="Change Era">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
            </button>`;

        document.body.appendChild(fabEl);

        const css = document.createElement('style');
        css.textContent = `
            #era-fab {
                position: fixed; bottom: 24px; right: 24px;
                z-index: 9999; display: flex; flex-direction: column;
                align-items: center; gap: 10px; pointer-events: none;
            }
            #era-fab-menu {
                display: flex; flex-direction: column-reverse;
                align-items: center; gap: 8px;
            }
            #era-fab-btn {
                pointer-events: all;
                width: 54px; height: 54px; border-radius: 50%;
                background: #d4a853; border: none; cursor: pointer;
                color: #111; display: flex; align-items: center; justify-content: center;
                box-shadow: none;
                transition: transform 0.3s ease, background 0.4s, box-shadow 0.4s;
                flex-shrink: 0;
            }
            #era-fab-btn:hover { transform: scale(1.08); }
            #era-fab-btn.open  { transform: rotate(45deg) scale(1.08); }

            .fab-era-item {
                pointer-events: all;
                width: 46px; height: 46px; border-radius: 50%;
                cursor: pointer;
                border: 2px solid rgba(255,255,255,0.15);
                position: relative; overflow: hidden;
                transform: translateY(12px) scale(0);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(.34,1.56,.64,1),
                            opacity 0.25s ease,
                            border-color 0.2s,
                            box-shadow 0.2s;
            }
            .fab-default {
                border: 2px solid rgba(212,168,83,0.5) !important;
            }
            .fab-era-item.visible {
                transform: translateY(0) scale(1);
                opacity: 1;
            }
            .fab-era-item:hover {
                border-color: rgba(255,255,255,0.8) !important;
                transform: translateY(0) scale(1.12) !important;
            }
            .fab-era-label {
                position: absolute; inset: 0;
                display: flex; align-items: center; justify-content: center;
                font-family: 'Space Grotesk', sans-serif;
                font-size: 0.48rem; font-weight: 700;
                color: transparent; background: transparent;
                text-transform: uppercase; letter-spacing: 0.05em;
                transition: all 0.2s;
            }
            .fab-era-item:hover .fab-era-label {
                color: rgba(255,255,255,0.95);
                background: rgba(0,0,0,0.6);
            }
            .fab-default .fab-era-label { font-size: 0.8rem; }

            @media (max-width: 768px) {
                #era-fab { bottom: 16px; right: 16px; gap: 7px; }
                #era-fab-btn { width: 46px; height: 46px; }
                .fab-era-item { width: 38px; height: 38px; }
            }
        `;
        document.head.appendChild(css);

        document.querySelectorAll('.fab-era-item').forEach(item => {
            item.style.setProperty('--fab-c', item.dataset.color);
        });

        document.getElementById('era-fab-btn').addEventListener('click', e => {
            e.stopPropagation();
            isOpen ? closeFAB() : openFAB();
        });

        document.querySelectorAll('.fab-era-item').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                const album = item.dataset.album;
                closeFAB();
                window.applyEraTheme(album);
                if (album === 'default') {
                    if (typeof window.resetToCareer === 'function') window.resetToCareer();
                } else if (typeof window.playAlbum === 'function') {
                    window.playAlbum(album);
                }
            });
        });

        document.addEventListener('click', () => { if (isOpen) closeFAB(); });
    }

    function openFAB() {
        isOpen = true;
        document.getElementById('era-fab').style.pointerEvents = 'all';
        document.getElementById('era-fab-btn').classList.add('open');
        document.querySelectorAll('.fab-era-item').forEach((item, i) => {
            setTimeout(() => item.classList.add('visible'), i * 40);
        });
    }

    function closeFAB() {
        isOpen = false;
        document.getElementById('era-fab-btn').classList.remove('open');
        document.querySelectorAll('.fab-era-item').forEach(item => item.classList.remove('visible'));
    }

    // ── applyEraTheme ────────────────────────────────────────────────
    window.applyEraTheme = function (albumName) {
        const era = ERAS.find(e => e.id === albumName) || ERAS[0];
        const c = era.color;
        const isDefault = era.id === 'default';

        // CSS değişkenleri
        document.documentElement.style.setProperty('--accent-bronze', c);
        document.documentElement.style.setProperty('--accent-gold', c);

        document.body.style.background = '#0a0a0f';
        document.body.style.backgroundAttachment = '';

        // FAB buton rengi
        const btn = document.getElementById('era-fab-btn');
        if (btn) {
            btn.style.background = c;
            btn.style.boxShadow = 'none';
            btn.style.color = '#111';
        }

        // Hero arkaplanı (index.html)
        const heroBg = document.querySelector('.hero-bg');
        const heroVideo = document.querySelector('.hero video');
        if (heroBg) {
            const img = isDefault ? "url('assets/jt-horizontal.png')" : `url('${era.cover || "assets/jt-horizontal.png"}')`;
            heroBg.style.backgroundImage =
                `linear-gradient(to right, rgba(10,10,15,0.6) 30%, rgba(10,10,15,0.25) 100%),
                 linear-gradient(to bottom, transparent 60%, #0a0a0f 100%), ${img}`;
            const isFSLS = era.id === 'FutureSex/LoveSounds';
            heroBg.style.backgroundSize = isFSLS ? 'contain' : 'cover';
            heroBg.style.backgroundPosition = isFSLS ? 'center center' : 'center 30%';
            heroBg.style.backgroundColor = isFSLS ? '#0a0a0f' : '';
        }
        if (heroVideo) {
            heroVideo.style.transition = 'opacity 0.6s ease';
            heroVideo.style.opacity = isDefault ? '0.55' : '0';
        }

        // Dynamic style tag
        let st = document.getElementById('era-theme-style');
        if (!st) {
            st = document.createElement('style');
            st.id = 'era-theme-style';
            document.head.appendChild(st);
        }

        st.textContent = `
            /* ── NAV ── */
            .logo { color: ${c} !important; }
            .nav-links a:hover, .nav-links a.active { color: ${c} !important; }
            nav a[style*="color"] { color: ${c} !important; }

            /* ── HERO (index) ── */
            .hero-subtitle { color: ${c} !important; }
            .hero-title span:nth-child(2) { -webkit-text-stroke: 2px ${c} !important; color: transparent !important; }
            .hero-year { color: ${c} !important; opacity: 0.5; }
            .scroll-line { background: ${c} !important; }
            .section-title::before { color: ${c} !important; }

            @media (max-width: 768px) {
                .hero-bg {
                    background-position: ${albumName === 'FutureSex/LoveSounds' ? '80% center' : 'center 20%'} !important;
                }
            }

            /* ── INDEX — CSPC Dashboard ── */
            #eas-total, .stat-value, .cspc-title { color: ${c} !important; }
            .cspc-header { border-left: 4px solid ${c} !important; padding-left: 15px; }
            .cell-era-total { color: ${c} !important; }
            .grand-total-row { background: ${c}15 !important; border-top: 2px solid ${c} !important; }
            .label-figure { color: ${c} !important; }
            .analytics-row h2 { color: ${c} !important; }
            .album-card:hover { box-shadow: none !important; }

            /* ── BUTONLAR ── */
            .era-btn { background: rgba(10,10,15,0.95) !important; color: ${c} !important; border: 1px solid ${c} !important; }
            .era-btn:hover { background: ${c} !important; color: #111 !important; }

            /* ── GUESTBOOK (index) ── */
            .guestbook { border-top-color: ${c}28 !important; }
            .guestbook h2 { color: ${c} !important; }
            #guest-name, #guest-msg { border-color: ${c}44 !important; }
            #guest-name:focus, #guest-msg:focus { border-color: ${c} !important; }
            #visitor-count { color: ${c} !important; }
            .comment-card { border-left-color: ${c} !important; }
            .comment-author { color: ${c} !important; }

            /* ── TIMELINE (index) ── */
            .timeline-dot { color: ${c} !important; background: ${c} !important; }
            .timeline-year { color: ${c} !important; }
            .timeline-line { background: ${c}40 !important; }

            /* ══════════════════════════════════════
               TOURS.HTML — Kapsamlı tema
               ══════════════════════════════════════ */
            .hero-card {
                border-color: ${c}30 !important;
            }
            .hero-card::before { background: ${c} !important; }
            .hero-sub { color: ${c} !important; }
            .tour-type { color: ${c} !important; }
            .tour-row { border-bottom-color: ${c}18 !important; }
            .tour-row:hover { background: ${c}0a !important; }
            .stat-title { color: ${c}80 !important; }
            .tour-grid > div:last-child { border-bottom: none; }
            #lifetime-tickets, #lifetime-shows { color: ${c} !important; }

            /* Tours h2 başlıkları */
            .analytics-container h2 { color: ${c} !important; }

            /* ══════════════════════════════════════
               STREAMS.HTML — Kapsamlı tema
               ══════════════════════════════════════ */
            /* Hero cards */
            .hero-value { color: ${c} !important; }
            .hero-card { border-color: ${c}25 !important; }

            /* Growth/stat cards */
            .growth-card { border-color: ${c}20 !important; border-left: 3px solid ${c} !important; }

            /* Song table */
            .song-table th { color: ${c} !important; }
            .song-table tr:hover td { background: ${c}08 !important; }

            /* Milestone cards */
            .milestone-card { border-left-color: ${c} !important; border-color: ${c}20 !important; }

            /* Confidence badges */
            .confidence-medium { background: ${c}25 !important; color: ${c} !important; }
            .confidence-high { background: rgba(74,222,128,0.15); color: #4ade80; }

            /* Streams section headings */
            .analytics-container > div > h2,
            .analytics-container > div > div > h2 { color: ${c} !important; }

            /* Tab/filter butonlar varsa */
            [data-tab].active, .tab-active { color: ${c} !important; border-color: ${c} !important; }

            /* Chart accent wrapper */
            .chart-wrapper { border-color: ${c}20 !important; }

             /* Streams leaderboard album adı */
            .leaderboard-album { color: ${c} !important; }

            /* ══════════════════════════════════════
               AWARDS.HTML — Kapsamlı tema
               ══════════════════════════════════════ */
            .awards-header h1 span { color: ${c} !important; }
            .hero-card { border-color: ${c}25 !important; }
            .hero-card::before { background: ${c} !important; }
            .hero-value, .card-value { color: ${c} !important; }
            .filter-btn.active { 
                background: ${c} !important; 
                border-color: ${c} !important; 
                box-shadow: 0 0 20px ${c}40 !important; 
                color: #000 !important; 
            }
            .award-dot { 
                background: ${c} !important; 
                box-shadow: 0 0 15px ${c} !important; 
            }
            .award-year-badge { color: ${c} !important; background: ${c}15 !important; }
            .awards-footer h2 span { color: ${c} !important; }
            
            /* Background takeover */
            .hero-bg {
                background-image: linear-gradient(to right, rgba(10,10,15,0.6) 30%, rgba(10,10,15,0.25) 100%),
                                  linear-gradient(to bottom, transparent 60%, #0a0a0f 100%),
                                  url('${era.cover || "assets/jt-hero.jpg"}') !important;
            }
        `;

        document.dispatchEvent(new CustomEvent('eraChanged', { detail: { album: albumName, color: c } }));

    };

    // ── Active nav link ──────────────────────────────────────────────
    function setActiveNav() {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-links a').forEach(a => {
            const href = a.getAttribute('href') || '';
            const match =
                (page === 'index.html' && (href === 'index.html' || href.startsWith('#'))) ||
                (page !== 'index.html' && href === page);
            if (match) a.classList.add('active');
        });
    }

    // ── EAS tablo loading state ──────────────────────────────────────
    function injectLoadingStyles() {
        const s = document.createElement('style');
        s.textContent = `
            /* Active nav */
            .nav-links a.active {
                color: var(--accent-bronze, #d4a853) !important;
                font-weight: 700;
            }
            /* Grand Total base (inline stilsiz çalışır) */
            .grand-total-row {
                background: rgba(212,168,83,0.08);
                border-top: 2px solid #d4a853;
            }
            /* EAS tablo loading */
            .eas-loading-row td {
                padding: 40px 12px;
                text-align: center;
                color: rgba(255,255,255,0.2);
                font-family: 'Space Grotesk', sans-serif;
                font-size: 0.8rem;
                letter-spacing: 0.1em;
                text-transform: uppercase;
            }
            @keyframes eas-pulse {
                0%, 100% { opacity: 0.2; }
                50% { opacity: 0.5; }
            }
            .eas-loading-row td { animation: eas-pulse 1.4s ease infinite; }
        `;
        document.head.appendChild(s);
    }

    function injectEASLoading() {
        const tbody = document.getElementById('eas-table-body');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'eas-loading-row';
        tr.innerHTML = '<td colspan="6">Loading data...</td>';
        tbody.appendChild(tr);
    }

    function restoreEra() {
        // Default tema her zaman yüklenir — localStorage persist yok
    }

    // ── JT Head Features ─────────────────────────────
    function injectJTLoader() {
        if (document.getElementById('jt-global-loader')) return;
        const loader = document.createElement('div');
        loader.id = 'jt-global-loader';
        loader.innerHTML = `
            <img src="assets/jt-head.png" alt="Loading JT" id="jt-loader-img"/>
            <div id="jt-loader-text">SYNCING LIVE DATA</div>
        `;
        document.documentElement.appendChild(loader);

        const css = document.createElement('style');
        css.textContent = `
            #jt-global-loader {
                position: fixed; inset: 0; /* width/height yerine inset her telefonda hatasız çalışır */
                background: #0a0a0f; z-index: 100000;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #jt-loader-img {
                width: 100px; height: auto;
                animation: jtPulseSpin 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                filter: drop-shadow(0 0 25px rgba(212,168,83,0.5));
            }
            #jt-loader-text {
                margin-top: 25px; color: #d4a853; font-family: 'Space Grotesk', sans-serif;
                font-size: 0.9rem; font-weight: 700; letter-spacing: 3px;
                text-align: center; padding: 0 20px;
                animation: pulseText 1.5s infinite;
            }
            @keyframes jtPulseSpin {
                0% { transform: rotateY(0deg) scale(1); }
                50% { transform: rotateY(180deg) scale(1.15); filter: drop-shadow(0 0 40px rgba(212,168,83,0.8)); }
                100% { transform: rotateY(360deg) scale(1); }
            }
            @keyframes pulseText {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }

            /* ── Scroll To Top (JT Head) ── */
            #jt-scroll-top {
                position: fixed; bottom: -120px; left: 50%; transform: translateX(-50%); width: 65px; height: auto;
                cursor: pointer; z-index: 9998;
                transition: bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                filter: drop-shadow(0 5px 15px rgba(0,0,0,0.6));
            }
            #jt-scroll-top img {
                width: 100%; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #jt-scroll-top:hover img {
                transform: scale(1.25) rotate(-8deg);
            }
            #jt-scroll-top.visible {
                bottom: 0px;
            }
            @media (max-width: 768px) {
                #jt-scroll-top { width: 55px; }
            }
        `;
        document.head.appendChild(css);

        let isHidden = false;
        function hideLoader() {
            if (isHidden || !document.getElementById('jt-global-loader')) return;
            isHidden = true;
            loader.style.opacity = '0';
            loader.style.transform = 'scale(1.05)';
            setTimeout(() => loader.remove(), 600);
        }
        
        window.addEventListener('load', () => setTimeout(hideLoader, 800));
        document.addEventListener('dataReady', () => setTimeout(hideLoader, 300));
        setTimeout(hideLoader, 3500); 
    }

    function injectJTScrollTop() {
        const stt = document.createElement('div');
        stt.id = 'jt-scroll-top';
        stt.innerHTML = `<img src="assets/jt-head.png" alt="Scroll to Top" />`;
        document.body.appendChild(stt);

        window.addEventListener('scroll', () => {
             if (window.scrollY > 400) {
                 stt.classList.add('visible');
             } else {
                 stt.classList.remove('visible');
             }
        });
        stt.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    injectJTLoader();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectFAB();
            injectLoadingStyles();
            setActiveNav();
            injectEASLoading();
            restoreEra();
            injectJTScrollTop();
        });
    } else {
        injectFAB();
        injectLoadingStyles();
        setActiveNav();
        injectEASLoading();
        restoreEra();
        injectJTScrollTop();
    }
})();
