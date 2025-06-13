# Discord Kişisel Web Sitesi

Bu proje, modern web teknolojilerini (Node.js, Express.js) kullanarak kişisel markamı, projelerimi ve çeşitli platformlardaki (Discord, Spotify, GitHub, YouTube) dinamik varlığımı sergileyen bir web sitesidir.

## Özellikler

* **Canlı Durum Takibi**: Discord'daki çevrimiçi durumunuzu ve Spotify'da o an dinlediğiniz şarkıyı anlık olarak görüntüleyin.
* **GitHub Projeleri**: En son kodlama çalışmalarımı ve açık kaynak katkılarımı keşfedin.
* **YouTube Kanalım**: YouTube kanalımın istatistiklerine ve en yeni videolarıma kolayca ulaşın.
* **Duyarlı Tasarım**: Mobil uyumlu ve modern bir kullanıcı arayüzü.
* **Tema Değiştirme**: Koyu ve açık tema arasında geçiş yapabilme özelliği.

## Kurulum

Projeyi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin:

1.  **Depoyu Klonlayın:**
    ```bash
    git clone [https://github.com/EmirhanSarac/emirhansarac.online](https://github.com/EmirhanSarac/emirhansarac.online.git)
    cd emirhansarac.online
    ```

2.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

3.  **Ortam Değişkenlerini Ayarlayın:**
    Proje kök dizininde `.env` adında bir dosya oluşturun ve aşağıdaki bilgileri ekleyin. Bu bilgileri kendi değerlerinizle doldurmanız gerekmektedir.

    ```env
    PORT=3000
    DISCORD_BOT_TOKEN=SENIN_DISCORD_BOT_TOKENIN
    DISCORD_USER_ID=SENIN_DISCORD_KULLANICI_IDIN
    GUILD_ID=SUNUCU_IDIN # Botun bulunduğu sunucu ID'si (Discord kullanıcı sorgulama için)
    SPOTIFY_CLIENT_ID=SENIN_SPOTIFY_CLIENT_ID
    SPOTIFY_CLIENT_SECRET=SENIN_SPOTIFY_CLIENT_SECRET
    SPOTIFY_REDIRECT_URI=http://localhost:3000/spotify-callback # Veya yayınladığınız sitenizin URL'si
    SPOTIFY_REFRESH_TOKEN=SENIN_SPOTIFY_REFRESH_TOKEN
    GITHUB_USERNAME=SENIN_GITHUB_KULLANICI_ADIN
    GITHUB_TOKEN=SENIN_GITHUB_TOKEN # (İsteğe bağlı, limitler için önerilir)
    GOOGLE_API_KEY=SENIN_GOOGLE_API_KEY
    YOUR_YOUTUBE_CHANNEL_ID=SENIN_YOUTUBE_KANAL_ID
    ```

    **API Anahtarları Nasıl Alınır:**

    * **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications) adresinden yeni bir bot oluşturarak token'ı alabilirsiniz. Botunuza gerekli izinleri (GatewayIntentBits.Guilds, GuildMembers, GuildPresences) verdiğinizden emin olun.
    * **Spotify API Bilgileri**: [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications) adresinden bir uygulama oluşturarak Client ID ve Client Secret alabilirsiniz. `SPOTIFY_REDIRECT_URI`'yi dashboard'da belirlediğinizle eşleştirmelisiniz. İlk `SPOTIFY_REFRESH_TOKEN`'ı almak için sitenizin `/spotify-login` rotasını ziyaret etmeniz gerekebilir (bu rota `server.js`'de tanımlı değil, ancak Spotify yetkilendirme akışını başlatmak için bir başlangıç noktası olacaktır).
    * **GitHub Token**: Kişisel erişim token'ı oluşturmak için [GitHub Personal Access Tokens](https://github.com/settings/tokens) sayfasını ziyaret edin. Depo bilgilerini okumak için `public_repo` veya `repo` izinlerini vermeniz gerekebilir.
    * **Google (YouTube) API Anahtarı**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) adresinden bir API anahtarı oluşturun ve YouTube Data API v3'ü etkinleştirin.

4.  **Uygulamayı Başlatın:**
    ```bash
    npm start
    ```
    Sunucu `http://localhost:3000` adresinde (veya `.env` dosyasında belirttiğiniz portta) başlayacaktır.

## İletişim

* **Discord**: [Codare Development](https://discord.gg/codare)
