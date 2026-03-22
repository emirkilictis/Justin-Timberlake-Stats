// --- 1. AYARLAR VE MAPPING ---
let MY_DYNAMIC_API = typeof CONFIG !== 'undefined' ? CONFIG.MY_DYNAMIC_API : "";

const songToAlbumMap = {
    // --- JUSTIFIED ---
    "Like I Love You": "Justified", "Cry Me a River": "Justified", "Rock Your Body": "Justified", "Señorita": "Justified", 
    "Last Night": "Justified", "Take It From Here": "Justified", "Still On My Brain": "Justified", "Take Me Now": "Justified", "Right For Me": "Justified", "Nothin' Else": "Justified", "Never Again": "Justified",

    // --- FUTURESEX/LOVESOUNDS ---
    "SexyBack": "FutureSex/LoveSounds", "My Love": "FutureSex/LoveSounds", "What Goes Around": "FutureSex/LoveSounds", "Summer Love": "FutureSex/LoveSounds", "Until The End Of Time": "FutureSex/LoveSounds", "LoveStoned": "FutureSex/LoveSounds",
    "Chop Me Up": "FutureSex/LoveSounds", "FutureSex": "FutureSex/LoveSounds", "Losing My Way": "FutureSex/LoveSounds", "Sexy Ladies": "FutureSex/LoveSounds", "Boutique In Heaven": "FutureSex/LoveSounds",

    // --- THE 20/20 EXPERIENCE (PART 1 & 2) ---
    "Mirrors": "The 20/20 Experience", "Suit & Tie": "The 20/20 Experience", "Not a Bad Thing": "The 20/20 Experience", "TKO": "The 20/20 Experience", "Drink You Away": "The 20/20 Experience",
    "Pusher Love Girl": "The 20/20 Experience", "Tunnel Vision": "The 20/20 Experience", "Take Back the Night": "The 20/20 Experience", "Murder": "The 20/20 Experience", "Strawberry Bubblegum": "The 20/20 Experience", "Don't Hold the Wall": "The 20/20 Experience", "Let the Groove Get In": "The 20/20 Experience", "Blue Ocean Floor": "The 20/20 Experience", "Amnesia": "The 20/20 Experience", "True Blood": "The 20/20 Experience", "Only When I Walk Away": "The 20/20 Experience", "Cabaret": "The 20/20 Experience", "You Got It On": "The 20/20 Experience", "Gimme What I Don't Know": "The 20/20 Experience", "Dress On": "The 20/20 Experience", "That Girl": "The 20/20 Experience", "Spaceship Coupe": "The 20/20 Experience",

    // --- MAN OF THE WOODS ---
    "Say Something": "Man of the Woods", "Filthy": "Man of the Woods", "Man of the Woods": "Man of the Woods",
    "Supplies": "Man of the Woods", "Morning Light": "Man of the Woods", "Higher Higher": "Man of the Woods", "Midnight Summer Jam": "Man of the Woods", "Sauce": "Man of the Woods", "Wave": "Man of the Woods", "Montana": "Man of the Woods", "Flannel": "Man of the Woods", "Young Man": "Man of the Woods", "Breeze Off the Pond": "Man of the Woods", "The Hard Stuff": "Man of the Woods", "Hers (interlude)": "Man of the Woods", "Livin' Off the Land": "Man of the Woods",

    // YENİ: EITIW ERASI EKLENDİ
    
    // YENİ: EITIW ERASI EKLENDİ
    "Memphis": "Everything I Thought It Was",
    "Selfish": "Everything I Thought It Was",
    "No Angels": "Everything I Thought It Was",
    "Drown": "Everything I Thought It Was",
    "F**kin' Up The Disco": "Everything I Thought It Was",
    "Play": "Everything I Thought It Was",
    "Technicolor": "Everything I Thought It Was",
    "Sanctified": "Everything I Thought It Was",
    "Liar": "Everything I Thought It Was",
    "Imagination": "Everything I Thought It Was",
    "What Lovers Do": "Everything I Thought It Was",
    "My Favorite Drug": "Everything I Thought It Was",
    "Flame": "Everything I Thought It Was",
    "Infinity Sex": "Everything I Thought It Was",
    "Love & War": "Everything I Thought It Was",
    "Alone": "Everything I Thought It Was",
    "Conditions": "Everything I Thought It Was",
    "Paradise" : "Everything I Thought It Was",

    // --- ORPHAN / FEATURES ---
    "CAN'T STOP THE FEELING!": "Orphan / Features", "4 Minutes": "Orphan / Features", "Give It To Me": "Orphan / Features", "Ayo Technology": "Orphan / Features", "Holy Grail": "Orphan / Features", "Dead And Gone": "Orphan / Features", "Love Never Felt So Good": "Orphan / Features", "Carry Out": "Orphan / Features"
};

const albumMetData = {
    "Justified": { year: 2002 },
    "FutureSex/LoveSounds": { year: 2006 },
    "The 20/20 Experience": { year: 2013 },
    "Man of the Woods": { year: 2018 },
    "Everything I Thought It Was": { year: 2024 }, 
    "Orphan / Features": { year: "Various" }
};

// --// --- 2. YARDIMCI FONKSİYONLAR ---

function animateValue(obj, start, end, duration, prefix = "") {
    if (!obj || isNaN(end)) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        
        if (end >= 1000000000 && obj.id === 'jt-total-career') {
            obj.innerHTML = prefix + (current / 1000000000).toFixed(2) + 'B';
        } else {
            obj.innerHTML = prefix + current.toLocaleString('en-US');
        }
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function getTrueDailyAverage(dailyStreams) {
    const today = new Date().getDay();
    const dataDay = today === 0 ? 6 : today - 1; 
    const dayWeights = { 0: 0.85, 1: 0.90, 2: 0.95, 3: 1.00, 4: 1.05, 5: 1.15, 6: 1.10 };
    return dailyStreams / dayWeights[dataDay];
}

function calculateMilestone(track, trueDailyAverage) {
    let nextMilestone;
    if (track.total >= 1000000000) {
        nextMilestone = Math.ceil(track.total / 1000000000) * 1000000000;
        if (nextMilestone === track.total) nextMilestone += 1000000000;
    } else {
        nextMilestone = Math.ceil(track.total / 500000000) * 500000000;
        if (nextMilestone === track.total) nextMilestone += 500000000;
    }
    let remaining = nextMilestone - track.total;
    let daysLeft = trueDailyAverage > 0 ? Math.ceil(remaining / trueDailyAverage) : "N/A";
    return { target: nextMilestone, remaining: remaining, daysLeft: daysLeft };
}

// --- 3. AKILLI PARSER ---

function analyzeKworbData(htmlInput) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlInput, 'text/html');
    const rows = doc.querySelectorAll('table.addpos tbody tr');
    
    let stats = { 
        TotalSpotify: 0,
        "Justified": { total: 0, daily: 0 },
        "FutureSex/LoveSounds": { total: 0, daily: 0 },
        "The 20/20 Experience": { total: 0, daily: 0 },
        "Man of the Woods": { total: 0, daily: 0 },
        "Everything I Thought It Was": { total: 0, daily: 0 }, 
        "Orphan / Features": { total: 0, daily: 0 },
        tracks: []
    };

    const tables = doc.querySelectorAll('table');
    if (tables.length > 0) {
        const totalCell = tables[0].querySelectorAll('td')[1];
        if (totalCell) stats.TotalSpotify = parseInt(totalCell.textContent.replace(/,/g, ''), 10) || 0;
    }

    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 3) {
            let title = cols[0].textContent.trim(); 
            let lowerTitle = title.toLowerCase(); 
            let valTotal = parseInt(cols[1].textContent.replace(/,/g, ''), 10) || 0;
            let valDaily = parseInt(cols[2].textContent.replace(/,/g, ''), 10) || 0;
            
            stats.tracks.push({ title, total: valTotal, daily: valDaily });

            let matched = false;
            for (let key in songToAlbumMap) {
                if (lowerTitle.includes(key.toLowerCase())) {
                    let albName = songToAlbumMap[key];
                    if (stats[albName]) {
                        stats[albName].total += valTotal;
                        stats[albName].daily += valDaily;
                    }
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                stats["Orphan / Features"].total += valTotal;
                stats["Orphan / Features"].daily += valDaily;
            }
        }
    });

    return stats;
}

// --- 4. ANA YÜKLEYİCİ VE UI GÜNCELLEME ---

async function initStreamsDashboard() {
    try {
        const res = await fetch(MY_DYNAMIC_API);
        const html = await res.text();
        const liveStats = analyzeKworbData(html);

        const jtTotalCareer = document.getElementById('jt-total-career');
        const jtDailyCareer = document.getElementById('jt-daily-career');
        const albumTableBody = document.getElementById('album-table-body');
        const streamsTableBody = document.getElementById('streams-table-body');
        const radarGrid = document.getElementById('milestone-radar');

        let allAlbums = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "Man of the Woods", "Everything I Thought It Was", "Orphan / Features"];
        
        if(albumTableBody) albumTableBody.innerHTML = "";
        if(streamsTableBody) streamsTableBody.innerHTML = "";
        if(radarGrid) radarGrid.innerHTML = "";

        // TOP SECTION
        let jtTotalDaily = 0;
        allAlbums.forEach(id => { jtTotalDaily += liveStats[id].daily; });
        
        animateValue(jtTotalCareer, 0, liveStats.TotalSpotify, 2000);
        animateValue(jtDailyCareer, 0, jtTotalDaily, 2000, "+"); 

        const eraColors = {
            "Justified": "#5dade2", 
            "FutureSex/LoveSounds": "#e74c3c", 
            "The 20/20 Experience": "#fce98a", 
            "Man of the Woods": "#ca6f1e", 
            "Everything I Thought It Was": "#f39c12", 
            "Orphan / Features": "#bdc3c7" 
        };

        // MIDDLE SECTION: ALBUM LEADERBOARD
        const albumCoversSt = {
            "Justified": "assets/justified.jpg",
            "FutureSex/LoveSounds": "assets/fsls.jpg",
            "The 20/20 Experience": "assets/the20.jpg",
            "Man of the Woods": "assets/motw.jpg",
            "Everything I Thought It Was": "assets/eitiw.jpg",
            "Orphan / Features": null
        };

        if(albumTableBody) {
            allAlbums.forEach(id => {
                let album = liveStats[id];
                let dailyPerc = jtTotalDaily > 0 ? (album.daily / jtTotalDaily) * 100 : 0;
                let barColor = eraColors[id] || "#d4a853";
                const imgSrc = albumCoversSt[id];
                const thumbHTML = imgSrc
                    ? `<img src="${imgSrc}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;">`
                    : `<div style="width:40px;height:40px;border-radius:4px;background:repeating-radial-gradient(#050505 0,#050505 2px,#111 3px,#111 4px);flex-shrink:0;"></div>`;

                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="display:flex;align-items:center;gap:12px;">
                            ${thumbHTML}
                            <div>
                                <div style="font-weight: 700; color: #fff;">${id}</div>
                                <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); margin-top: 8px; border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${dailyPerc}%; height: 100%; background: ${barColor}; box-shadow: 0 0 10px ${barColor}; border-radius: 2px; transition: width 1.5s ease-out;"></div>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">${albumMetData[id].year}</td>
                    <td style="vertical-align: middle;">${album.total.toLocaleString()}</td>
                    <td class="positive-trend" style="vertical-align: middle;">+${album.daily.toLocaleString()}</td>
                    <td style="vertical-align: middle; color: ${barColor}; font-weight: 700;">${dailyPerc.toFixed(1)}%</td>
                `;
                albumTableBody.appendChild(tr);
            });
        }

        // THIRD SECTION: TOP TRACKS
        if(streamsTableBody) {
            liveStats.tracks.slice(0, 15).forEach(track => {
                let trueDailyAvg = getTrueDailyAverage(track.daily);
                let weeklyEst = Math.floor(trueDailyAvg * 7); 
                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${track.title}</td>
                    <td>${track.total.toLocaleString()}</td>
                    <td class="positive-trend">+${track.daily.toLocaleString()}</td>
                    <td style="color: #d4a853; font-weight: 500;">${weeklyEst.toLocaleString()}</td>
                `;
                streamsTableBody.appendChild(tr);
            });
        }

        // BOTTOM SECTION: MILESTONE RADAR
        if(radarGrid) {
            liveStats.tracks.slice(0, 10).forEach(track => {
                if (track.daily > 10000) {
                    let trueDailyAvg = getTrueDailyAverage(track.daily);
                    let milestone = calculateMilestone(track, trueDailyAvg);
                    
                    let targetText = milestone.target >= 1000000000 
                                    ? (milestone.target / 1000000000) + "B" 
                                    : (milestone.target / 1000000) + "M";

                    let card = document.createElement('div');
                    card.className = "milestone-card";
                    card.innerHTML = `
                        <div style="font-size: 0.8rem; color: #888; text-transform: uppercase;">Countdown to ${targetText}</div>
                        <div style="font-size: 1.2rem; font-weight: 700; margin: 10px 0;">${track.title}</div>
                        <div style="font-size: 2rem; color: #d4a853;">${milestone.daysLeft.toLocaleString()} Days</div>
                        <div style="font-size: 0.9rem; color: #aaa; margin-top: 5px;">Needs ${(milestone.remaining / 1000000).toFixed(1)}M more streams</div>
                    `;
                    radarGrid.appendChild(card);
                }
            });
        }

        // --- CHART.JS GRAFİK MOTORU ---
        const canvasElement = document.getElementById('albumShareChart');
        if(canvasElement) {
            const ctx = canvasElement.getContext('2d');
            
            const chartLabels = ["Justified", "FutureSex/LoveSounds", "The 20/20 Experience", "Man of the Woods", "EITIW", "Orphan / Features"];
            const chartData = [
                liveStats["Justified"].total,
                liveStats["FutureSex/LoveSounds"].total,
                liveStats["The 20/20 Experience"].total,
                liveStats["Man of the Woods"].total,
                liveStats["Everything I Thought It Was"].total,
                liveStats["Orphan / Features"].total
            ];
            
            const chartColors = ['#5dade2', '#e74c3c', '#fce98a', '#ca6f1e', '#f39c12', '#bdc3c7'];

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: chartData,
                        backgroundColor: chartColors,
                        borderColor: '#050505',
                        borderWidth: 2,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, 
                    plugins: {
                        legend: {
                            position: window.innerWidth < 768 ? 'bottom' : 'right',
                            labels: {
                                color: '#fff',
                                font: {
                                    family: "'Space Grotesk', sans-serif",
                                    size: 11 
                                },
                                padding: 15 
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label.length > 20 && window.innerWidth < 768) {
                                        label = label.substring(0, 17) + '...'; 
                                    }
                                    if (label) { label += ': '; }
                                    // İŞTE NAN HATASINI ÇÖZEN KISIM (context.raw KULLANILDI)
                                    if (context.raw !== null && context.raw !== undefined) {
                                        label += new Intl.NumberFormat('en-US').format(context.raw);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }

    } catch (e) {
        console.error("Dashboard yüklenemedi:", e);
        const radarGrid = document.getElementById('milestone-radar');
        if(radarGrid) {
            radarGrid.innerHTML = "Failed to load dynamic data. Check console.";
        }
    }
}

document.addEventListener('DOMContentLoaded', initStreamsDashboard);