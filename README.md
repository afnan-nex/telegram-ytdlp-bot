# 🎬 Telegram Media Downloader Bot

An ultra-lightweight, high-performance Telegram bot for downloading videos, reels, shorts, and audio from 1000+ platforms (YouTube, Instagram, TikTok, X/Twitter, Facebook, Reddit, Pinterest, Threads, and more).

Built with **Node.js**, [**grammY**](https://grammy.dev), [**yt-dlp**](https://github.com/yt-dlp/yt-dlp), and **FFmpeg**.

Designed for zero-maintenance personal deployments on **Render Free Tier (512 MB RAM)**, **VPS**, or **Local Machines** with **zero database requirements**, **memory-safe queueing**, and **instant disk auto-cleanup**.

---

## 🌟 Key Features

- **Universal Platform Support:** Downloads from YouTube, Instagram (Reels, Stories, Posts), TikTok (no watermark), X (Twitter), Facebook, Reddit, Pinterest, SoundCloud, and 1000+ other sites supported by `yt-dlp`.
- **100% Database-Free (Stateless):** Runs instantly without PostgreSQL, MySQL, Redis, or SQLite.
- **Immediate Disk Auto-Cleanup:** Downloaded files and temporary working folders are deleted immediately after being sent to Telegram, keeping server storage usage near 0 MB.
- **H.264 / Telegram Stream Compatibility:** Automatically optimizes video codec (`H.264`), audio codec (`AAC`), pixel format (`yuv420p`), and moves index flags (`+faststart`) to prevent the common "black screen / audio only" playback bug on iOS, Android, and Desktop.
- **Render Free Tier Ready:** Built-in HTTP health check server on `PORT` for 24/7 web service keep-alive and strict 1-by-1 concurrency queueing to prevent Out-Of-Memory (OOM) crashes on 512 MB RAM containers.
- **Audio Extraction:** Send `/audio <url>` or include `#audio` in the caption to download MP3 audio directly.
- **Access Whitelist:** Optional `ALLOWED_USERS` security feature to restrict bot access strictly to your personal Telegram User ID.
- **Local Bot API Ready:** Supports custom `BOT_API_URL` to unlock **up to 2000 MB (2 GB)** file uploads when paired with a local Telegram Bot API server.

---

## 📋 Prerequisites

Before setting up the bot, you will need:

1. **A Telegram Bot Token:**
   - Open Telegram and message [@BotFather](https://t.me/BotFather).
   - Send `/newbot`, choose a name and username for your bot.
   - Copy the HTTP API token provided (e.g., `123456789:ABC-DEF1234ghIkl-zyx57W2P0s`).

2. **Your Telegram User ID (Optional, for private whitelist):**
   - Message [@userinfobot](https://t.me/userinfobot) or [@raw_data_bot](https://t.me/raw_data_bot) to get your numeric ID (e.g. `123456789`).

---

## 🚀 Setup & Deployment Guide

Choose the deployment method that fits your setup:

### Option 1: Deploy to Render (Free Tier - Recommended)

1. **Fork or Push** this repository to your GitHub account.
2. Log into the **[Render Dashboard](https://dashboard.render.com/)**.
3. Click **New +** → **Web Service**.
4. Connect your GitHub repository (`telegram-ytdlp-bot`).
5. Configure the service:
   - **Name:** `telegram-ytdlp-bot` (or any name)
   - **Runtime:** `Docker`
   - **Instance Type:** `Free` (512 MB RAM)
6. Scroll to **Environment Variables** and add:
   - `BOT_TOKEN` = `your_telegram_bot_token_here`
   - `ALLOWED_USERS` = *(Optional)* `your_telegram_user_id` *(e.g. `123456789`)*
7. Click **Create Web Service**. Render will automatically build the container and start your bot.

---

### Option 2: Run with Docker / Docker Compose (VPS or Local)

#### Using Docker CLI:
```bash
# Build the Docker image
docker build -t telegram-ytdlp-bot .

# Run the container in background
docker run -d \
  --name telegram-bot \
  --restart unless-stopped \
  -e BOT_TOKEN="your_bot_token_here" \
  -e ALLOWED_USERS="your_user_id_here" \
  -p 8080:8080 \
  telegram-ytdlp-bot
```

#### Using Docker Compose:
Create a `docker-compose.yml` file:
```yaml
services:
  telegram-bot:
    build: .
    container_name: telegram-ytdlp-bot
    restart: unless-stopped
    environment:
      - BOT_TOKEN=your_bot_token_here
      - ALLOWED_USERS=your_user_id_here
      - PORT=8080
      - MAX_FILE_SIZE_MB=50
    ports:
      - "8080:8080"
```
Run:
```bash
docker compose up -d
```

---

### Option 3: Run Bare-Metal / Locally with Node.js

#### 1. Install System Dependencies
Ensure you have **Node.js (v20+)**, **FFmpeg**, **Python 3**, and **yt-dlp** installed on your system:

- **Ubuntu / Debian:**
  ```bash
  sudo apt update
  sudo apt install -y nodejs npm ffmpeg python3 curl
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  ```

- **Arch Linux:**
  ```bash
  sudo pacman -S nodejs npm ffmpeg yt-dlp python
  ```

- **macOS (Homebrew):**
  ```bash
  brew install node ffmpeg yt-dlp
  ```

#### 2. Install & Configure the Bot
```bash
# Clone the repository
git clone https://github.com/afnan-nex/telegram-ytdlp-bot.git
cd telegram-ytdlp-bot

# Install npm dependencies
npm install

# Create environment configuration
cp .env.example .env
```

Edit `.env` and insert your `BOT_TOKEN`:
```env
BOT_TOKEN=123456789:ABC-DEF1234ghIkl-zyx57W2P0s
ALLOWED_USERS=123456789
```

#### 3. Start the Bot
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev

# Or with PM2 (process manager)
npx pm2 start src/index.js --name "telegram-ytdlp-bot"
```

---

### Option 4: Enable 2 GB Large Uploads (Local Bot API Server)

By default, the standard Telegram Bot API restricts bot uploads to **50 MB**. To upload files up to **2000 MB (2 GB)**:

1. Obtain your `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from [my.telegram.org](https://my.telegram.org).
2. Run the official Telegram Bot API server (e.g. via Docker):
   ```bash
   docker run -d \
     --name telegram-bot-api \
     --restart unless-stopped \
     -p 8081:8081 \
     -e TELEGRAM_API_ID="your_api_id" \
     -e TELEGRAM_API_HASH="your_api_hash" \
     -v telegram-bot-api-data:/var/lib/telegram-bot-api \
     aiogram/telegram-bot-api:latest \
     --local
   ```
3. In your bot configuration (`.env` or Docker env), set:
   ```env
   BOT_API_URL=http://localhost:8081
   MAX_FILE_SIZE_MB=2000
   ```
4. Restart the bot. It will now support sending media files up to 2 GB!

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `BOT_TOKEN` | **Yes** | — | Telegram Bot API token from [@BotFather](https://t.me/BotFather) |
| `PORT` | No | `8080` | Port for the HTTP health check server (Render automatically sets this) |
| `ALLOWED_USERS` | No | `""` | Comma-separated list of Telegram User IDs allowed to use the bot |
| `BOT_API_URL` | No | `""` | Custom or Local Telegram Bot API Server URL (e.g. `http://localhost:8081`) |
| `MAX_FILE_SIZE_MB` | No | `50` | Maximum file size in MB (set to `2000` if using Local Bot API) |
| `MAX_CONCURRENT_DOWNLOADS` | No | `1` | Max parallel downloads (keep at `1` for 512MB RAM micro-containers) |
| `DOWNLOAD_DIR` | No | `./downloads` | Directory used for temporary download buffers before instant deletion |

---

## 💬 Usage & Bot Commands

- **Download Video:** Send any supported media URL directly to the bot.
  ```text
  https://www.youtube.com/watch?v=dQw4w9WgXcQ
  https://www.instagram.com/reel/C8...
  https://www.tiktok.com/@user/video/...
  https://x.com/user/status/...
  ```
- **Download MP3 Audio Only:**
  ```text
  /audio https://www.youtube.com/watch?v=dQw4w9WgXcQ
  ```
  *(Or append `#audio` or `#mp3` anywhere in your message)*
- **Ping / Health Check:**
  ```text
  /ping
  ```
- **Help Message:**
  ```text
  /start or /help
  ```

---

## 🛠️ Troubleshooting & FAQs

#### Q: The video plays as a black screen with audio on Facebook / Instagram.
**A:** This is caused by unsupported video codecs (VP9/AV1) or non-standard pixel formats. This repository has automated H.264 format sorting and `yuv420p` + `+faststart` recoding enabled by default to prevent this issue.

#### Q: The download fails with "File size exceeds 50 MB limit".
**A:** Standard Telegram Bot API limits bot uploads to 50 MB. To download larger videos up to 2 GB, set up a Local Bot API server as explained in **Option 4** above.

#### Q: The bot stops responding or crashes on Render Free Tier.
**A:** Ensure `MAX_CONCURRENT_DOWNLOADS` is set to `1` so concurrent downloads do not exceed Render's 512 MB memory limit.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © [afnan-nex](https://github.com/afnan-nex).
