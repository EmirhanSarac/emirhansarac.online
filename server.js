import express from 'express';
import https from 'https'; 
import fs from 'fs'; 
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';
import axios from 'axios';
import querystring from 'querystring';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

let discordClientReady = false;
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});
discordClient.on('error', (error) => console.error('Discord Client Hatası:', error));
discordClient.on('warn', (warn) => console.warn('Discord Client Uyarısı:', warn));

let spotifyAccessToken = null;
let tokenExpiresAt = 0;
const cache = new Map();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
let SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const YOUR_STEAM_ID64 = process.env.STEAM_ID64;
const githubUsername = process.env.GITHUB_USERNAME;
const githubToken = process.env.GITHUB_TOKEN;

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

const discordUserId = process.env.DISCORD_ID;
const serverId = process.env.SERVER_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN; 

async function refreshSpotifyToken() {
    if (!SPOTIFY_REFRESH_TOKEN) throw new Error('Spotify Refresh Token eksik. Lütfen .env dosyasını kontrol edin.');
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: SPOTIFY_REFRESH_TOKEN,
        }), {
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        spotifyAccessToken = response.data.access_token;
        tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
        console.log('Spotify access token başarıyla yenilendi.');
        return spotifyAccessToken;
    } catch (error) {
        console.error('Spotify token yenileme hatası:', error.response ? JSON.stringify(error.response.data) : error.message);
        spotifyAccessToken = null;
        tokenExpiresAt = 0;
        if (error.response && (error.response.data.error === 'invalid_grant' || error.response.data.error_description?.includes('invalid refresh token'))) {
            console.error("GEÇERSİZ SPOTIFY REFRESH TOKEN! Lütfen .env dosyasındaki SPOTIFY_REFRESH_TOKEN'ı güncelleyin veya kaldırın.");
            SPOTIFY_REFRESH_TOKEN = null;
        }
        throw new Error('Spotify token yenilenemedi.');
    }
}

async function getValidSpotifyToken() {
    if (!spotifyAccessToken || Date.now() >= tokenExpiresAt - (300 * 1000)) {
        console.log('Spotify access token süresi doldu veya yok, yenileniyor...');
        try {
            await refreshSpotifyToken();
        } catch (error) {
            return null;
        }
    }
    return spotifyAccessToken;
}

app.use(express.static(path.join(__dirname, 'public')));

let lastKnownSpotifyPlayingState = null; 

app.get('/api/spotify-now-playing', async (req, res) => {
    const cacheKey = 'spotify-now-playing';

    const token = await getValidSpotifyToken();
    if (!token) {
        return res.status(503).json({ success: false, message: 'Spotify API token sorunu. Refresh token\'ınızı kontrol edin.' });
    }

    try {
        const nowPlayingResponse = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let jsonDataForClient;
        if (nowPlayingResponse.status === 200 && nowPlayingResponse.data?.is_playing && nowPlayingResponse.data.item) {
            const track = nowPlayingResponse.data.item;
            jsonDataForClient = {
                success: true,
                isPlaying: true,
                song: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                album: track.album.name,
                albumArtUrl: track.album.images?.[0]?.url || null,
                trackUrl: track.external_urls.spotify,
                duration_ms: track.duration_ms,
                progress_ms: nowPlayingResponse.data.progress_ms,
                lastPlayedAt: null
            };
            // Yalnızca durum değiştiyse logla veya önemli bilgi ver
            if (lastKnownSpotifyPlayingState !== 'playing' || lastKnownSpotifyPlayingState !== `${track.name}-${track.artist}`) {
                console.log(`Spotify: Şu an çalıyor: ${track.name} - ${track.artist}`);
                lastKnownSpotifyPlayingState = 'playing'; // Daha spesifik bir ID de kullanabilirsin
            }
        } else {
            // Şu an çalmıyorsa, en son çalınanı kontrol et
            const recentlyPlayedResponse = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (recentlyPlayedResponse.status === 200 && recentlyPlayedResponse.data?.items?.[0]) {
                const item = recentlyPlayedResponse.data.items[0];
                const track = item.track;
                jsonDataForClient = {
                    success: true,
                    isPlaying: false,
                    song: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    album: track.album.name,
                    albumArtUrl: track.album.images?.[0]?.url || null,
                    trackUrl: track.external_urls.spotify,
                    duration_ms: track.duration_ms,
                    progress_ms: track.duration_ms, // Son çalınan için ilerleme tam süre olsun
                    lastPlayedAt: item.played_at
                };
                if (lastKnownSpotifyPlayingState !== 'recently_played' || lastKnownSpotifyPlayingState !== `${track.name}-${track.artist}-${item.played_at}`) {
                    console.log(`Spotify: En son çalınan: ${track.name} - ${track.artist} (${new Date(item.played_at).toLocaleTimeString()})`);
                    lastKnownSpotifyPlayingState = 'recently_played'; // Daha spesifik bir ID de kullanabilirsin
                }
            } else {
                jsonDataForClient = { success: true, isPlaying: false, message: 'Şu anda Spotify\'da bir şey dinlemiyor veya son çalınan bulunamadı.' };
                if (lastKnownSpotifyPlayingState !== 'idle') {
                    console.log('Spotify: Şu an aktif bir dinleme yok.');
                    lastKnownSpotifyPlayingState = 'idle';
                }
            }
        }

        res.json(jsonDataForClient);
    } catch (error) {
        console.error('/api/spotify-now-playing genel hata yakalandı:');
        if (error.response) {
            console.error('API Yanıt Durumu:', error.response.status);
            console.error('API Yanıt Verisi:', JSON.stringify(error.response.data, null, 2));
            if (error.response.status === 401) {
                spotifyAccessToken = null;
                tokenExpiresAt = 0;
                return res.status(401).json({ success: false, message: 'Spotify API yetkilendirme hatası. Lütfen tokenınızı yenileyin veya .env dosyasını kontrol edin.' });
            } else if (error.response.status === 429) {
                return res.status(429).json({ success: false, message: 'Spotify API istek limiti aşıldı. Lütfen bir süre sonra tekrar deneyin.' });
            } else if (error.response.status === 403) {
                 return res.status(403).json({ success: false, message: 'Spotify API erişim reddedildi. İzinleri kontrol edin.' });
            } else if (error.response.status === 404) {
                 return res.status(404).json({ success: false, message: 'Spotify API endpointi bulunamadı veya geçersiz istek.' });
            }
        } else if (error.request) {
            console.error('API İsteği Yapılamadı (Ağ Hatası?):', error.request);
        } else {
            console.error('Hata Mesajı:', error.message);
        }
        res.status(500).json({ success: false, message: 'Spotify verisi alınırken sunucuda hata oluştu.' });
    }
});


app.get('/api/github-repos', async (req, res) => {
    if (!githubUsername) {
        return res.status(500).json({ success: false, message: 'GitHub kullanıcı adı eksik. Lütfen .env dosyasını veya server.js\'yi kontrol edin.' });
    }

    const cacheKey = `github-repos-${githubUsername}`;
    const cacheDuration = 60 * 60 * 1000;

    if (cache.has(cacheKey) && cache.get(cacheKey).expiry > Date.now()) {
        console.log('GitHub depo verisi önbellekten sunuldu.');
        return res.json(cache.get(cacheKey).data);
    }

    try {
        const headers = { 'Accept': 'application/vnd.github.v3+json' };
        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
        }

        const reposResponse = await axios.get(`https://api.github.com/users/${githubUsername}/repos?sort=pushed&direction=desc&per_page=9`, { headers });

        if (reposResponse.status === 200 && reposResponse.data) {
            const repos = reposResponse.data
                .filter(repo => !repo.fork && !repo.archived)
                .map(repo => ({
                    name: repo.name,
                    description: repo.description,
                    html_url: repo.html_url,
                    language: repo.language,
                    stars: repo.stargazers_count,
                    forks: repo.forks_count,
                    pushed_at: repo.pushed_at
                }));

            const responseData = { success: true, repos: repos };
            cache.set(cacheKey, { data: responseData, expiry: Date.now() + cacheDuration });
            console.log('GitHub depo verisi API\'den çekildi ve önbelleğe alındı.');
            res.json(responseData);
        } else {
            res.status(reposResponse.status).json({ success: false, message: 'GitHub depoları alınamadı.' });
        }
    } catch (error) {
        console.error('/api/github-repos hatası:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ success: false, message: 'GitHub depoları alınırken sunucuda hata oluştu.' });
    }
});


app.get('/spotify-callback', async (req, res) => {
    const code = req.query.code || null;
    if (!code) {
        return res.status(400).send('Authorization code (kod) alınamadı.');
    }
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
        return res.status(500).send('Sunucu yapılandırma hatası: Spotify ayarları eksik.');
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
        }), {
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;

        console.log("SPOTIFY CALLBACK BAŞARILI! REFRESH TOKEN'I .env DOSYASINA KAYDEDİN.");
        console.log("Refresh Token (UZUN ÖMÜRLÜ, BUNU KAYDEDİN!):", refresh_token);
        if (refresh_token) {
            SPOTIFY_REFRESH_TOKEN = refresh_token;
        }

        spotifyAccessToken = access_token;
        tokenExpiresAt = Date.now() + (expires_in * 1000);

        res.send(`<h2>Yetkilendirme Başarılı!</h2><p><strong>Refresh Token: ${refresh_token}</strong></p><p>Bu token'ı kopyalayıp <code>.env</code> dosyanızdaki <code>SPOTIFY_REFRESH_TOKEN</code> alanına yapıştırın ve sunucuyu yeniden başlatın.</p><p><a href="/">Ana Sayfaya Dön</a></p>`);
    } catch (error) {
        console.error('Spotify callback hatası:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).send('Spotify token alınırken hata. Logları kontrol edin.');
    }
});


app.get('/api/discord-user-query', async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ success: false, message: 'Sorgulanacak Discord Kullanıcı ID\'si veya Kullanıcı Adı sağlanmadı.' });
    }

    if (!DISCORD_BOT_TOKEN || !discordClientReady) {
        return res.status(503).json({ success: false, message: 'Discord botu aktif değil veya hazır değil.' });
    }
    if (!serverId) {
        return res.status(500).json({ success: false, message: 'Discord Sunucu ID\'si eksik. Lütfen .env dosyasını kontrol edin.' });
    }

    const cacheKey = `discord-user-query-${query.toLowerCase()}`;
    const cacheDuration = 20 * 1000;

    if (cache.has(cacheKey) && cache.get(cacheKey).expiry > Date.now()) {
        console.log(`Discord kullanıcı bilgisi (Sorgu: ${query}) önbellekten sunuldu.`);
        return res.json(cache.get(cacheKey).data);
    }

    let targetUser = null;
    let targetMember = null;
    let errorMessage = '';

    try {
        const guild = discordClient.guilds.cache.get(serverId);
        if (!guild) {
            console.warn(`Discord Sunucu ID'si ${serverId} bulunamadı veya bot bu sunucuya erişemiyor.`);
            throw new Error(`Bot belirtilen sunucuya (${serverId}) erişemiyor.`);
        }

        const isId = /^\d{17,19}$/.test(query);

        if (isId) {
            try {
                targetUser = await discordClient.users.fetch(query, { force: true });
                if (targetUser) {
                    targetMember = await guild.members.fetch({ user: targetUser.id, force: true }).catch(() => null);
                }
            } catch (idError) {
                console.log(`ID ${query} ile kullanıcı bulunamadı, kullanıcı adı araması denenecek.`);
            }
        }

        if (!targetUser) {
            try {
                const members = await guild.members.fetch({ query: query, limit: 100 });
                targetMember = members.find(
                    member => member.user.username.toLowerCase() === query.toLowerCase() ||
                              member.user.globalName?.toLowerCase() === query.toLowerCase() ||
                              member.nickname?.toLowerCase() === query.toLowerCase()
                );
                if (targetMember) {
                    targetUser = targetMember.user;
                }
            } catch (nameError) {
                errorMessage = `Kullanıcı "${query}" sunucuda bulunamadı veya botun erişimi yok.`;
                console.error(`Kullanıcı adı ile arama hatası: ${nameError.message}`);
            }
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, message: errorMessage || `Kullanıcı "${query}" bulunamadı. Lütfen geçerli bir ID veya sunucuda bulunan bir kullanıcı adı girin.` });
        }


        let status = 'offline';
        let serverNickname = null;
        let customStatus = null;
        let activities = [];

        if (targetMember) {
            status = targetMember.presence?.status || 'offline';
            serverNickname = targetMember.nickname;
            if (targetMember.presence && targetMember.presence.activities) {
                activities = targetMember.presence.activities.map(activity => ({
                    type: activity.type,
                    name: activity.name,
                    details: activity.details,
                    state: activity.state,
                    url: activity.url
                }));
                const custom = targetMember.presence.activities.find(act => act.type === ActivityType.Custom && act.state);
                if (custom) customStatus = custom.state;
            }
        } else {
            console.log(`Kullanıcı ${query} sunucuda ${serverId} bulunamadı. Sadece global bilgiler gösteriliyor.`);
            status = 'offline';
        }

        const userPublicFlags = targetUser.flags ? targetUser.flags.toArray() : [];

        const responseData = {
            success: true,
            username: targetUser.username,
            globalName: targetUser.globalName,
            displayName: targetUser.displayName,
            serverNickname: serverNickname,
                     avatarURL: 'https://i.hizliresim.com/nhd61mh.jpg',

            status: status,
            customStatus: customStatus,
            publicFlags: userPublicFlags,
            activities: activities
        };
        cache.set(cacheKey, { data: responseData, expiry: Date.now() + cacheDuration });
        console.log(`Discord kullanıcı bilgisi (Sorgu: ${query}) API'den çekildi ve önbelleğe alındı.`);
        res.json(responseData);
    } catch (error) {
        console.error(` /api/discord-user-query genel hata yakalandı (Sorgu: ${query}):`, error);
        res.status(500).json({
            success: false,
            message: `Discord kullanıcı bilgileri alınamadı: ${error.message}`
        });
    }
});

app.get('/api/youtube-channel-info', async (req, res) => {
    if (!GOOGLE_API_KEY || !YOUR_YOUTUBE_CHANNEL_ID) {
        return res.status(500).json({ success: false, message: 'YouTube API anahtarı veya Kanal ID\'si eksik. Lütfen .env dosyasını kontrol edin.' });
    }

    const cacheKey = 'youtube-channel-stats';
    const cacheDuration = 60 * 60 * 1000; // 1 saat önbellek

    if (cache.has(cacheKey) && cache.get(cacheKey).expiry > Date.now()) {
        console.log('YouTube kanal bilgisi önbellekten sunuldu.');
        return res.json(cache.get(cacheKey).data);
    }

    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
            params: {
                part: 'snippet,statistics',
                id: YOUR_YOUTUBE_CHANNEL_ID,
                key: GOOGLE_API_KEY
            }
        });

        const channelData = response.data.items[0];

        if (!channelData) {
            return res.status(404).json({ success: false, message: 'YouTube kanal bilgisi bulunamadı.' });
        }

        const stats = channelData.statistics;
        const snippet = channelData.snippet;

        const subscriberCount = parseInt(stats.subscriberCount, 10);
        const viewCount = parseInt(stats.viewCount, 10);
        const videoCount = parseInt(stats.videoCount, 10);

        const responseData = {
            success: true,
            channelName: snippet.title,
            channelDescription: snippet.description,
            profilePictureUrl: snippet.thumbnails.high.url, // Yüksek çözünürlüklü profil resmi
            subscriberCount: subscriberCount,
            viewCount: viewCount,
            videoCount: videoCount,
            formattedSubscriberCount: new Intl.NumberFormat('tr-TR', { notation: 'compact', compactDisplay: 'short' }).format(subscriberCount),
            channelUrl: `https://www.youtube.com/channel/${YOUR_YOUTUBE_CHANNEL_ID}`
        };

        cache.set(cacheKey, { data: responseData, expiry: Date.now() + cacheDuration });
        console.log('YouTube kanal bilgisi API\'den çekildi ve önbelleğe alındı.');
        res.json(responseData);

    } catch (error) {
        console.error('/api/youtube-channel-info hatası:', error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({
            success: false,
            message: 'YouTube kanal bilgileri alınamadı.'
        });
    }
});



app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/projeler', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'projeler.html'));
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});




function startExpressServer() {
        console.warn("SSL sertifika dosyaları bulunamadığından HTTPS sunucu başlatılamadı."); // Bu uyarı mesajı kalabilir
        app.listen(PORT, () => {
            console.log(`Web sunucusu HTTP olarak http://localhost:${PORT} adresinde çalışıyor.`);
            if (DISCORD_BOT_TOKEN && discordClientReady) {
                console.log('Discord Botu da aktif.');
            } else if (DISCORD_BOT_TOKEN && !discordClientReady) {
                console.log('Discord botu başlatılıyor/bağlanamadı.');
            }
        }).on('error', (err) => {
            console.error('HTTP sunucu başlatma hatası:', err);
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} zaten kullanılıyor. Lütfen başka bir port deneyin veya mevcut uygulamayı kapatın.`);
            }
            process.exit(1);
        });
    // }
}

if (DISCORD_BOT_TOKEN) {
    discordClient.once('ready', () => {
        console.log(`Discord botu ${discordClient.user.tag} olarak bağlandı!`);
        discordClientReady = true;
    });
    discordClient.login(DISCORD_BOT_TOKEN).catch(err => {
        console.error('Discord bota giriş yapılamadı! Token\'ı kontrol edin:', err);
    });
} else {
    console.log("Discord bot token bulunamadı, bot başlatılmayacak.");
}

startExpressServer();