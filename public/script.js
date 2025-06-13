document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM yüklendi. Güncel Script.js çalışıyor.');

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const htmlElement = document.documentElement;
    const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let currentTheme = localStorage.getItem('bsTheme') || (osPrefersDark ? 'dark' : 'dark');
    if (!localStorage.getItem('bsTheme') && htmlElement.getAttribute('data-bs-theme') === 'dark') {
        currentTheme = 'dark';
    }
    function applyTheme(theme) {
        htmlElement.setAttribute('data-bs-theme', theme);
        const navbar = document.querySelector('.custom-navbar');
        if (navbar) navbar.setAttribute('data-bs-theme', theme);
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = theme === 'dark' ?
                '<i class="bi bi-brightness-high-fill"></i><span class="d-none d-md-inline ms-1"></span>' :
                '<i class="bi bi-moon-stars-fill"></i><span class="d-none d-md-inline ms-1"></span>';
            themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç');
        }
    }
    applyTheme(currentTheme);
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            let newTheme = htmlElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('bsTheme', newTheme);
        });
    }

    const timestampElement = document.getElementById('current-timestamp');
    function updateTimestamp() {
        if (timestampElement) {
            const now = new Date();
            const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'shortOffset'};
            let dateString = now.toLocaleDateString('tr-TR', optionsDate);
            let timeString = now.toLocaleTimeString('tr-TR', optionsTime);
            const tzOffset = -now.getTimezoneOffset();
            const offsetHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
            const offsetMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
            const offsetSign = tzOffset >= 0 ? '+' : '-';
            timeString = timeString.replace(/GMT[+-]\d+(:?\d{2})?/, `GMT${offsetSign}${offsetHours}:${offsetMinutes}`);
            timestampElement.textContent = `${dateString} ⋅ ${timeString}`;
        }
    }
    if (timestampElement) { updateTimestamp(); setInterval(updateTimestamp, 1000); }

    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    // Günlük sözü yükle
    updateDailyQuoteAnimated();
    // Her 1 saatte bir sözü değiştir
    quoteChangeInterval = setInterval(updateDailyQuoteAnimated, 30000); // 1 saat = 3600000 milisaniye

    if (document.getElementById('discord-profile-card')) {
        fetchDiscordUserInfo();
        setInterval(fetchDiscordUserInfo, 30000);
    }
    if (document.getElementById('spotify-direct-card')) {
        fetchCurrentSpotifyTrack();
        setInterval(fetchCurrentSpotifyTrack, 10000);
    }
    if (document.getElementById('spotify-favorite-track-card')) {
        fetchSpotifyFavoriteTrack();
    }
    if (document.getElementById('github-projects-grid')) {
        fetchGitHubProjects();
    }

    const discordUserQueryForm = document.getElementById('discordUserQueryForm');
    if (discordUserQueryForm) {
        discordUserQueryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const query = document.getElementById('discordUserIdInput').value.trim();
            if (query) {
                await queryDiscordUser(query);
            } else {
                alert('Lütfen bir Discord Kullanıcı ID\'si veya Kullanıcı Adı girin.');
            }
        });
    }

    if (document.getElementById('youtube-channel-card')) {
        fetchYouTubeChannelInfo();
        setInterval(fetchYouTubeChannelInfo, 60 * 60 * 1000);
    }
});

let spotifyProgressInterval = null;
let spotifyCurrentProgressMs = 0;
let spotifyTotalDurationMs = 0;
let spotifyLastPlayedAt = null;

let lastKnownSpotifyIdentifier = null;

let favoriteAudioPlayer = new Audio();

const dailyQuotes = [
    { text: "Dün öğren, bugün yaşa, yarın umut et.", author: "Anonim" },
    { text: "İnsanlar her şeyi kaybettikten sonra özgür olurlar.", author: "Chuck Palahniuk" },
     { text: "Herkes dünyayı değiştirmeyi düşünür, ama kimse kendini değiştirmeyi düşünmez.", author: "Tolstoy" },
    { text: "İnsanların çoğu, özgürlüğü değil, alışkanlıkları sever.", author: "Goethe" },
    { text: "İyileşme,acıyı hissetmeye cesaret ettiğimizde başlar.", author: "Anonim" }

];


let currentQuoteIndex = -1;
let quoteChangeInterval;

function updateDailyQuoteAnimated() {
    const quoteElement = document.getElementById('daily-quote');
    if (!quoteElement) return;

    quoteElement.classList.add('hide-quote');
    quoteElement.classList.remove('show-quote');

    setTimeout(() => {
        currentQuoteIndex = (currentQuoteIndex + 1) % dailyQuotes.length;
        const currentQuote = dailyQuotes[currentQuoteIndex]; // Obje olarak al
        
        quoteElement.innerHTML = `"${currentQuote.text}"` + 
                                 (currentQuote.author ? `<span class="quote-author">– ${currentQuote.author}</span>` : '');

        quoteElement.classList.remove('hide-quote');
        quoteElement.classList.add('show-quote');
    }, 1000); 
}

function setCardContent(cardElementId, htmlContent, isError = false) {
    const cardElement = document.getElementById(cardElementId);
    if (cardElement) {
        cardElement.innerHTML = htmlContent;
        requestAnimationFrame(() => { cardElement.classList.add('loaded'); });
    }
}

function showInitialLoading(cardElementId, message = "Yükleniyor...") {
    const cardElement = document.getElementById(cardElementId);
    if (cardElement) {
        cardElement.classList.remove('loaded');
        cardElement.innerHTML = `<div class="loading-placeholder d-flex align-items-center justify-content-center w-100 h-100">
                                    <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                                    <span>${message}</span>
                                 </div>`;
    }
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function timeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const seconds = Math.floor((now - past) / 1000);

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} gün önce`;
    } else if (hours > 0) {
        return `${hours} saat önce`;
    } else if (minutes > 0) {
        return `${minutes} dakika önce`;
    } else if (seconds >= 0) {
        return `az önce`;
    }
    return '';
}

function getDiscordBadgeIcon(flag) {
    switch (flag) {
        case 'Staff': return '<i class="bi bi-discord-fill discord-badge" title="Discord Personeli"></i>';
        case 'Partner': return '<img src="https://discord.com/assets/c03565f1a58c148293774af73b88939c.svg" class="discord-badge" title="Discord Partner Geliştirici">';
        case 'HypeSquadOnlineHouse1':
        case 'HypeSquadOnlineHouse2':
        case 'HypeSquadOnlineHouse3':
            return '<img src="https://cdn3.emoji.gg/emojis/92509-cyan-hypesquad.png" class="discord-badge" title="HypeSquad Üyesi">';
        case 'BugHunterLevel1': return '<img src="https://discord.com/assets/a894769b39891041c2c3131c9a0937a4.svg" class="discord-badge" title="Hata Avcısı (Seviye 1)">';
        case 'BugHunterLevel2': return '<img src="https://discord.com/assets/406085e68351582e0573e0423c93bc14.svg" class="discord-badge" title="Hata Avcısı (Seviye 2)">';
        case 'PremiumEarlySupporter': return '<img src="https://discord.com/assets/597c50a1b55940733a1e204bb387e07a.svg" class="discord-badge" title="Erken Nitro Destekçisi">';
        case 'TeamPseudoUser': return '<i class="bi bi-people-fill discord-badge" title="Takım Üyesi"></i>';
        case 'VerifiedBot': return '<img src="https://discord.com/assets/6f63450e1817454d658c426e2524a350.svg" class="discord-badge" title="Onaylı Bot">';
        case 'VerifiedDeveloper': return '<img src="https://cdn3.emoji.gg/emojis/1564-badge-developer.png" class="discord-badge" title="Erken Onaylı Bot Geliştiricisi">';
        case 'CertifiedModerator': return '<img src="https://discord.com/assets/f45a0b4d4554d32bb5840d510f848529.svg" class="discord-badge" title="Discord Sertifikalı Moderatör">';
        case 'ActiveDeveloper': return `<img src="https://cdn3.emoji.gg/emojis/5288-activedeveloperbadge.png" class="discord-badge" title="Aktif Geliştirici">`;
        default: return '';
    }
}

function formatActivity(activity) {
    if (!activity) return '';

    let activityText = '';
    let activityIcon = '';

    switch (activity.type) {
        case 0:
            activityIcon = '<i class="bi bi-controller me-1"></i>';
            activityText = `Oynuyor: <strong>${activity.name}</strong>`;
            if (activity.details) activityText += `<br><small>${activity.details}</small>`;
            break;
        case 1:
            activityIcon = '<i class="bi bi-youtube me-1"></i>';
            activityText = `Yayın Akışı: <strong>${activity.name}</strong>`;
            if (activity.state) activityText += `<br><small>(${activity.state})</small>`;
            break;
        case 2:
            activityIcon = '<i class="bi bi-spotify me-1"></i>';
            activityText = `Dinliyor: <strong>${activity.details}</strong> by <strong>${activity.state}</strong>`;
            break;
        case 3:
            activityIcon = '<i class="bi bi-tv me-1"></i>';
            activityText = `İzliyor: <strong>${activity.name}</strong>`;
            break;
        case 4:
            return '';
        case 5:
            activityIcon = '<i class="bi bi-award me-1"></i>';
            activityText = `Yarışıyor: <strong>${activity.name}</strong>`;
            if (activity.details) activityText += `<br><small>${activity.details}</small>`;
            break;
        default:
            return '';
    }
    return `<div class="details text-muted mt-1">${activityIcon}${activityText}</div>`;
}


async function fetchDiscordUserInfo() {
    const cardId = 'discord-profile-card';
    const cardElement = document.getElementById(cardId);
    
    if (cardElement && (cardElement.children.length === 0 || cardElement.querySelector('.loading-placeholder'))) {
        showInitialLoading(cardId, "Discord durumu alınıyor...");
    }

    try {
        const response = await fetch('/api/discord-user-info');
        if (!response.ok) throw new Error(`Sunucu: ${response.status}`);
        const data = await response.json();
        let contentHTML = '';
        if (data.success) {
            const statusClasses = { online: 'online', idle: 'idle', dnd: 'dnd', offline: 'offline' };
            const displayName = data.serverNickname || data.globalName || data.displayName || data.username;
            const secondaryLineText = data.customStatus || `@${data.username}`;

            let badgesHtml = '';
            if (data.publicFlags && Array.isArray(data.publicFlags)) {
                badgesHtml = data.publicFlags.map(flag => getDiscordBadgeIcon(flag)).join('');
            }

            let activityHtml = '';
            if (data.activities && Array.isArray(data.activities)) {
                const mainActivity = data.activities.find(act => act.type !== 4);
                activityHtml = formatActivity(mainActivity);
            }

            contentHTML = `
                <div class="card-content-wrapper">
                    <div class="avatar-container me-2 flex-shrink-0">
                        <img src="${data.avatarURL}" alt="${displayName}" class="profile-avatar">
                        <span class="status-dot ${statusClasses[data.status]}"></span>
                    </div>
                    <div class="info flex-grow-1 overflow-hidden">
                        <div class="name fw-semibold truncate-text" title="${displayName}">
                            <i class="bi bi-discord me-1" style="color:#5865F2; font-size: 0.9em; vertical-align: -0.05em;"></i>${displayName}
                            <span class="discord-badges-container ms-1">${badgesHtml}</span> </div>
                        <div class="details text-muted truncate-text" title="${secondaryLineText}">
                            ${secondaryLineText}
                        </div>
                        ${activityHtml}
                    </div>
                </div>`;
        } else {
            contentHTML = `<p class="text-danger m-0 small">${data.message || 'Discord bilgileri yüklenemedi.'}</p>`;
        }
        setCardContent(cardId, contentHTML, !data.success);
    } catch (error) {
        console.error('Discord bilgileri çekilirken hata:', error);
        if (cardElement) setCardContent(cardId, `<p class="text-danger m-0 small">Discord bilgileri alınamadı.</p>`, true);
    }
}

async function fetchCurrentSpotifyTrack() {
    const cardId = 'spotify-direct-card';
    const cardElement = document.getElementById(cardId);

    if (favoriteAudioPlayer && !favoriteAudioPlayer.paused) {
        console.log('🎶 Favori şarkı çalıyor, Spotify "Şu An Dinliyor" güncellemesi atlanıyor.');
        if (cardElement) {
            requestAnimationFrame(() => { cardElement.classList.add('loaded'); });
        }
        return;
    }

    if (cardElement && (cardElement.children.length === 0 || cardElement.querySelector('.loading-placeholder'))) {
        showInitialLoading(cardId, "Spotify aktivitesi alınıyor...");
    }

    try {
        const response = await fetch(`/api/spotify-now-playing?_cb=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`Sunucu: ${response.status}`);
        const data = await response.json();

        const newIdentifier = data.isPlaying ?
                             `${data.song}-${data.artist}` :
                             (data.song && data.artist && data.lastPlayedAt ? `${data.song}-${data.artist}-${data.lastPlayedAt}` : null);

        let shouldUpdateCard = false;

        if (lastKnownSpotifyIdentifier !== newIdentifier) {
            shouldUpdateCard = true;
            console.log('🎶 Spotify: Yeni durum tespit edildi (ID değişti). Güncelleniyor...');
        } else if (data.isPlaying) {
            spotifyCurrentProgressMs = data.progress_ms;
            spotifyTotalDurationMs = data.duration_ms;
            updateSpotifyProgressBar();
            if (cardElement) {
                requestAnimationFrame(() => { cardElement.classList.add('loaded'); });
            }
            return;
        } else {
            if (cardElement) {
                requestAnimationFrame(() => { cardElement.classList.add('loaded'); });
            }
            return;
        }

        if (shouldUpdateCard) {
            lastKnownSpotifyIdentifier = newIdentifier;

            if (spotifyProgressInterval) {
                clearInterval(spotifyProgressInterval);
                spotifyProgressInterval = null;
            }
        }


        let contentHTML = '';
        if (data.success && data.isPlaying && data.song) {
            if (typeof data.duration_ms !== 'number' || isNaN(data.duration_ms) || data.duration_ms <= 0 ||
                typeof data.progress_ms !== 'number' || isNaN(data.progress_ms)) {
                console.warn('Spotify API\'den geçerli süre veya ilerleme verisi gelmedi. Çubuğu gösterme.');
                contentHTML = `
                    <div class="card-content-wrapper">
                        ${data.albumArtUrl ? `<img src="${data.albumArtUrl}" alt="${data.album || 'Albüm'}" class="spotify-album-art me-2 flex-shrink-0">` : '<div class="spotify-album-art-placeholder me-2 flex-shrink-0">🎶</div>'}
                        <div class="info flex-grow-1 overflow-hidden">
                            <div class="name fw-semibold truncate-text" title="${data.song} - ${data.artist}">
                                <i class="bi bi-spotify me-1" style="color:#1DB954; font-size: 0.9em; vertical-align: -0.05em;"></i>
                                <a href="${data.trackUrl}" target="_blank" rel="noopener noreferrer">${data.song} - ${data.artist}</a>
                            </div>
                            <div class="details text-muted truncate-text">
                                dinliyor (ilerleme bilgisi yok)
                            </div>
                        </div>
                    </div>
                `;
                setCardContent(cardId, contentHTML);
                return;
            }

            spotifyCurrentProgressMs = data.progress_ms;
            spotifyTotalDurationMs = data.duration_ms;
            spotifyLastPlayedAt = null;

            contentHTML = `
                <div class="card-content-wrapper">
                    ${data.albumArtUrl ? `<img src="${data.albumArtUrl}" alt="${data.album || 'Albüm'}" class="spotify-album-art me-2 flex-shrink-0">` : '<div class="spotify-album-art-placeholder me-2 flex-shrink-0">🎶</div>'}
                    <div class="info flex-grow-1 overflow-hidden">
                        <div class="name fw-semibold truncate-text" title="${data.song} - ${data.artist}">
                            <i class="bi bi-spotify me-1" style="color:#1DB954; font-size: 0.9em; vertical-align: -0.05em;"></i>
                            <a href="${data.trackUrl}" target="_blank" rel="noopener noreferrer">${data.song} - ${data.artist}</a>
                        </div>
                        <div class="details text-muted truncate-text">
                            dinliyor
                        </div>
                    </div>
                </div>
                <div class="spotify-progress-container w-100">
                    <div class="spotify-progress-bar-bg">
                        <div class="spotify-progress-bar-fg" style="width: 0%;"></div>
                    </div>
                    <div class="spotify-time-info d-flex justify-content-between">
                        <span class="spotify-current-time">0:00</span>
                        <span class="spotify-total-time">${formatTime(spotifyTotalDurationMs)}</span>
                    </div>
                </div>
            `;
            setCardContent(cardId, contentHTML);

            updateSpotifyProgressBar();
            spotifyProgressInterval = setInterval(updateSpotifyProgressBar, 1000);

        } else if (data.success && !data.isPlaying && data.song && data.lastPlayedAt) {
            spotifyCurrentProgressMs = data.duration_ms;
            spotifyTotalDurationMs = data.duration_ms;
            spotifyLastPlayedAt = data.lastPlayedAt;

            contentHTML = `
                <div class="card-content-wrapper">
                    ${data.albumArtUrl ? `<img src="${data.albumArtUrl}" alt="${data.album || 'Albüm'}" class="spotify-album-art me-2 flex-shrink-0">` : '<div class="spotify-album-art-placeholder me-2 flex-shrink-0">🎶</div>'}
                    <div class="info flex-grow-1 overflow-hidden">
                        <div class="name fw-semibold truncate-text" title="${data.song} - ${data.artist}">
                            <i class="bi bi-spotify me-1" style="color:#1DB954; font-size: 0.9em; vertical-align: -0.05em;"></i>
                            <a href="${data.trackUrl}" target="_blank" rel="noopener noreferrer">${data.song} - ${data.artist}</a>
                        </div>
                        <div class="details text-muted truncate-text">
                            ${timeAgo(spotifyLastPlayedAt)} dinledi
                        </div>
                    </div>
                </div>
            `;
            setCardContent(cardId, contentHTML);

        } else {
            contentHTML = `
                <div class="d-flex align-items-center w-100 h-100 justify-content-center">
                    <p class="text-muted m-0">${data.message || 'Şu anda Spotify\'da bir şey dinlemiyor.'}</p>
                </div>
            `;
            setCardContent(cardId, contentHTML, !data.success);
        }

        if (cardElement) {
             requestAnimationFrame(() => { cardElement.classList.add('loaded'); });
        }


    } catch (error) {
        console.error('Spotify verileri çekilirken hata:', error);
        if (spotifyProgressInterval) {
            clearInterval(spotifyProgressInterval);
            spotifyProgressInterval = null;
        }
        setCardContent(cardId, `<p class="text-danger m-0 small">Spotify bilgileri alınamadı.</p>`, true);
        if (cardElement) {
             requestAnimationFrame(() => { cardElement.classList.add('loaded'); });
        }
    }
}

function updateSpotifyProgressBar() {
    const progressBarFg = document.querySelector('#spotify-direct-card .spotify-progress-bar-fg');
    const currentTimeSpan = document.querySelector('#spotify-direct-card .spotify-current-time');
    const totalTimeSpan = document.querySelector('#spotify-direct-card .spotify-total-time');

    if (progressBarFg && currentTimeSpan && totalTimeSpan && spotifyTotalDurationMs > 0) {
        spotifyCurrentProgressMs += 1000;

        if (spotifyCurrentProgressMs >= spotifyTotalDurationMs + 5000) {
            clearInterval(spotifyProgressInterval);
            spotifyProgressInterval = null;
            fetchCurrentSpotifyTrack();
            return;
        }

        const progressPercentage = (spotifyCurrentProgressMs / spotifyTotalDurationMs) * 100;
        progressBarFg.style.width = `${progressPercentage}%`;
        currentTimeSpan.textContent = formatTime(spotifyCurrentProgressMs);

    } else {
        if (spotifyProgressInterval) {
            clearInterval(spotifyProgressInterval);
            spotifyProgressInterval = null;
        }
    }
}

async function fetchGitHubProjects() {
    const projectsGrid = document.getElementById('github-projects-grid');
    if (!projectsGrid) { return; }

    projectsGrid.innerHTML = `
        <div class="col-12 text-center">
            <div class="loading-placeholder py-4 d-flex flex-column align-items-center">
                <div class="spinner-border text-secondary spinner-border-sm mb-2" role="status" aria-hidden="true"></div>
                <span>GitHub projeleri yükleniyor...</span>
            </div>
        </div>`;
    try {
        const response = await fetch('/api/github-repos');
        if (!response.ok) throw new Error(`Sunucu: ${response.status}`);
        const data = await response.json();
        if (data.success && data.repos && data.repos.length > 0) {
            projectsGrid.innerHTML = '';
            data.repos.forEach(repo => {
                let langBadgeClass = 'bg-secondary bg-opacity-10 text-secondary-emphasis';
                if (repo.language) {
                    const langLower = repo.language.toLowerCase();
                    if (langLower === 'javascript') langBadgeClass = 'bg-warning bg-opacity-10 text-warning-emphasis';
                    else if (langLower === 'python') langBadgeClass = 'bg-primary bg-opacity-10 text-primary-emphasis';
                    else if (langLower === 'html') langBadgeClass = 'bg-danger bg-opacity-10 text-danger-emphasis';
                    else if (langLower === 'css') langBadgeClass = 'bg-info bg-opacity-10 text-info-emphasis';
                }
                const repoCard = `
                    <div class="col d-flex align-items-stretch">
                        <div class="card h-100 project-card">
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title fw-bold mb-2 fs-6">
                                    <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="stretched-link">
                                        ${repo.name}
                                    </a>
                               </h5>
                                <p class="card-text small text-muted flex-grow-1 mb-3">${repo.description || 'Açıklama yok.'}</p>
                                <div class="project-badges-container mt-auto d-flex justify-content-between align-items-center pt-2">
                                    <div>
                                        ${repo.language ? `<span class="badge rounded-pill ${langBadgeClass} fw-medium me-2 py-1 px-2">${repo.language}</span>` : ''}
                                    </div>
                                    <div class="text-nowrap">
                                        <span class="badge bg-light text-dark me-1 py-1 px-2"><i class="bi bi-star-fill text-warning"></i> ${repo.stars}</span>
                                        <span class="badge bg-light text-dark py-1 px-2"><i class="bi bi-share-fill text-info"></i> ${repo.forks}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer text-muted small">
                                Son Güncelleme: ${new Date(repo.pushed_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                    </div>`;
                projectsGrid.insertAdjacentHTML('beforeend', repoCard);
            });
        } else if (data.repos && data.repos.length === 0) {
            projectsGrid.innerHTML = '<p class="text-muted col-12 text-center">Gösterilecek GitHub deposu bulunamadı.</p>';
        } else {
            projectsGrid.innerHTML = `<p class="text-danger col-12 text-center">Projeler yüklenemedi: ${data.message || 'Bilinmeyen hata.'}</p>`;
        }
    } catch (error) {
        console.error('GitHub projeleri çekilirken hata:', error);
        projectsGrid.innerHTML = `<p class="text-danger col-12 text-center">Projeler alınırken bir bağlantı hatası oluştu.</p>`;
    }
}

let _cachedYouTubeChannelInfo = null; // Global variable to cache YouTube data

// Topluluk Bilgileri Verisi
const communityData = {
    codare: {
        name: "Codare Development",
        logo: "images/favicon.png",
        description: "Eylül 2018'den bu yana Türkiye'nin en aktif ve destekleyici yazılım ve kodlama topluluklarından biri olarak, geliştiricileri bir araya getiriyoruz. Discord platformumuz üzerinden bilgi alışverişinde bulunabilir, projelerinizi sergileyebilir ve karşılaştığınız zorluklar için hızlıca yardım alabilirsiniz. Her seviyeden katılımcıya açık olan topluluğumuz, sürekli öğrenmeyi ve birlikte gelişmeyi teşvik eder.",
        links: [
            { name: "Discord Sunucusu", url: "https://discord.gg/codare", icon: "bi-discord" },
            { name: "Web Sitesi", url: "https://codare.fun", icon: "bi bi-globe" },
        ],
        stats: "10.000+ Üye, Özel kodlar, Etkinlikler"
    },
    youtube: { 
        name: "YouTube Kanalım", 
        logo: "https://yt3.ggpht.com/LzJcFrz3lpHRCyzH2jdp6tVerZM8_2hwkv0ylS_6n3D5ONRfMJzilZSz0BzLtR3cDThfHlqe=s600-c-k-c0x00ffffff-no-rj-rp-mo", 
        description: "Youtube kanalıma hoş geldiniz!", 
        links: [ 
            { name: "Youtube Kanalım", url: "https://www.youtube.com/@EmirhanSarac", icon: "bi-youtube" } 
        ],
        stats: "Yükleniyor..." 
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // ... (mevcut DOMContentLoaded kodlarınız) ...

    const communityDetailModalElement = document.getElementById('communityDetailModal');
    if (communityDetailModalElement) {
        communityDetailModalElement.addEventListener('show.bs.modal', async function (event) {
            const button = event.relatedTarget;
            const communityId = button.getAttribute('data-id');

            const data = communityData[communityId]; // This 'data' variable is the static one from communityData object.
            const modalLogo = document.getElementById('modalCommunityLogo');
            const modalName = document.getElementById('modalCommunityName');
            const modalDescription = document.getElementById('modalCommunityDescription');
            const modalStats = document.getElementById('modalCommunityStats');
            const linksContainer = document.getElementById('modalCommunityLinks');
            
            linksContainer.innerHTML = ''; 

            if (communityId === 'youtube') {
                modalLogo.src = 'images/loading.gif'; 
                modalLogo.alt = 'Yükleniyor...';
                modalName.textContent = 'Yükleniyor...';
                modalDescription.textContent = 'Merhaba! Ben Emir, 7 yıldır YouTube da aktif olarak içerik üretiyorum ve Discord üzerine videolar çekiyorum. Kanalımda, Discordun derinliklerine inen, ipuçları ve rehberler sunan içerikler bulabilirsiniz. Teknoloji, yazılım ve oyun dünyasında yapılan yenilikleri takip ediyor, izleyicilerime en güncel ve yararlı bilgileri aktarmaya çalışıyorum.';
                modalStats.textContent = 'Yükleniyor...';

                let youtubeData;
                if (_cachedYouTubeChannelInfo) { // Önbellekte veri varsa kullan
                    youtubeData = _cachedYouTubeChannelInfo;
                    console.log('YouTube kanal bilgisi önbellekten kullanıldı (modal).');
                } else { // Yoksa API'den çek
                    try {
                        const response = await fetch('/api/youtube-channel-info');
                        if (!response.ok) throw new Error(`Sunucu: ${response.status}`);
                        youtubeData = await response.json();
                        if (youtubeData.success) {
                            _cachedYouTubeChannelInfo = youtubeData; // Veriyi önbelleğe al
                            console.log('YouTube kanal bilgisi API\'den çekildi ve önbelleğe alındı (modal).');
                        } else {
                            throw new Error(youtubeData.message || 'YouTube kanal bilgisi alınamadı.');
                        }
                    } catch (error) {
                        console.error('YouTube kanal bilgisi çekilirken hata (modal):', error);
                        modalLogo.src = communityData.youtube.logo; // Hata durumunda varsayılan logoyu göster
                        modalName.textContent = communityData.youtube.name;
                        modalDescription.textContent = 'YouTube kanal bilgileri yüklenemedi. Lütfen daha sonra tekrar deneyin.';
                        modalStats.textContent = 'Hata oluştu.';
                        
                        // Hata durumunda da statik linkleri göstermeyi dene
                        communityData.youtube.links.forEach(link => { // Statik linkleri kullanıyoruz
                            const linkElement = document.createElement('a');
                            linkElement.href = link.url;
                            linkElement.target = "_blank";
                            linkElement.rel = "noopener noreferrer";
                            linkElement.classList.add('btn', 'btn-primary'); 
                            if (link.icon) {
                                linkElement.innerHTML = `<i class="bi ${link.icon} me-2"></i>${link.name}`;
                            } else {
                                linkElement.textContent = link.name;
                            }
                            linksContainer.appendChild(linkElement);
                        });
                        return; // Hata durumunda çıkış
                    }
                }

                // API'den başarıyla gelen verileri ve statik linkleri kullan
                if (youtubeData.success) {
                    modalLogo.src = youtubeData.profilePictureUrl;
                    modalLogo.alt = youtubeData.channelName + " Logosu";
                    modalName.textContent = youtubeData.channelName;
                    modalStats.textContent = `Abone: ${youtubeData.formattedSubscriberCount} | Video Sayısı: ${youtubeData.videoCount.toLocaleString('tr-TR')} | Toplam İzlenme: ${youtubeData.viewCount.toLocaleString('tr-TR')}`;

                    // Burada STATİK olarak tanımladığınız 'links' array'ini kullanıyoruz.
                    communityData.youtube.links.forEach(link => { //
                        const linkElement = document.createElement('a');
                        linkElement.href = link.url;
                        linkElement.target = "_blank";
                        linkElement.rel = "noopener noreferrer";
                        linkElement.classList.add('btn', 'btn-danger'); 
                        if (link.icon) {
                            linkElement.innerHTML = `<i class="bi ${link.icon} me-2"></i>${link.name}`;
                        } else {
                            linkElement.textContent = link.name;
                        }
                        linksContainer.appendChild(linkElement);
                    });
                }
            } else if (data) { 
                modalLogo.src = data.logo;
                modalLogo.alt = data.name + " Logosu";
                modalName.textContent = data.name;
                modalDescription.textContent = data.description;
                modalStats.textContent = data.stats;

                data.links.forEach(link => {
                    const linkElement = document.createElement('a');
                    linkElement.href = link.url;
                    linkElement.target = "_blank";
                    linkElement.rel = "noopener noreferrer";
                    linkElement.classList.add('btn', 'btn-primary'); 
                    if (link.icon) {
                        linkElement.innerHTML = `<i class="bi ${link.icon} me-2"></i>${link.name}`;
                    } else {
                        linkElement.textContent = link.name;
                    }
                    linksContainer.appendChild(linkElement);
                });
            }
        });
    }
});

async function fetchYouTubeChannelInfo() {
    const cardId = 'youtube-channel-card';
    const cardElement = document.getElementById(cardId);

    if (cardElement && (cardElement.children.length === 0 || cardElement.querySelector('.loading-placeholder'))) {
        showInitialLoading(cardId, "YouTube kanal bilgileri alınıyor...");
    }

    try {
        const response = await fetch('/api/youtube-channel-info');
        if (!response.ok) throw new Error(`Sunucu: ${response.status}`);
        const data = await response.json();

        let contentHTML = '';
        if (data.success) {
            _cachedYouTubeChannelInfo = data; // Cache the data
            contentHTML = `
                <div class="card-content-wrapper">
                    ${data.profilePictureUrl ? `<img src="${data.profilePictureUrl}" alt="${data.channelName}" class="profile-avatar me-2 flex-shrink-0" style="width: 48px; height: 48px; border-radius: 50%;">` : '<div class="spotify-album-art-placeholder me-2 flex-shrink-0">▶️</div>'}
                    <div class="info flex-grow-1 overflow-hidden">
                        <div class="name fw-semibold truncate-text" title="${data.channelName}">
                            <i class="bi bi-youtube me-1" style="color:#FF0000; font-size: 0.9em; vertical-align: -0.05em;"></i>
                            <a href="${data.channelUrl}" target="_blank" rel="noopener noreferrer">${data.channelName}</a>
                        </div>
                        <div class="details text-muted truncate-text" title="${data.formattedSubscriberCount} abone">
                            Abone: ${data.formattedSubscriberCount}
                        </div>
                        <div class="details text-muted truncate-text">
                            Video Sayısı: ${data.videoCount.toLocaleString('tr-TR')}
                        </div>
                                                <div class="details text-muted truncate-text">
                            Toplam İzlenme: ${data.viewCount.toLocaleString('tr-TR')}
                    </div>
                </div>
            `;
        } else {
            contentHTML = `<p class="text-danger m-0 small">${data.message || 'YouTube kanal bilgileri yüklenemedi.'}</p>`;
        }
        setCardContent(cardId, contentHTML, !data.success);

    } catch (error) {
        console.error('YouTube kanal bilgisi çekilirken hata:', error);
        if (cardElement) setCardContent(cardId, `<p class="text-danger m-0 small">YouTube bilgileri alınamadı.</p>`, true);
    }
}