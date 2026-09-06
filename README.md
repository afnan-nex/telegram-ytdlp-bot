# Telegram Media Downloader Bot

An ultra-lightweight, high-performance Node.js Telegram bot powered by [`grammY`](https://grammy.dev), [`yt-dlp`](https://github.com/yt-dlp/yt-dlp), and `FFmpeg`.

Designed specifically for personal cloud deployments (e.g. Render Free Tier with 512 MB RAM) with **zero database dependencies**, **concurrency queue management**, and **immediate file auto-cleanup**.

---

## Features

- **Universal Platform Support:** Downloads video/audio from YouTube, Instagram (Reels, Posts), TikTok (no watermark), X / Twitter, Reddit, Pinterest, Facebook, Threads, SoundCloud, and 1000+ other sites supported by `yt-dlp`.
- **Database-Less (Stateless):** 100% database-free architecture with zero configuration or external database setups.
- **Immediate Disk Cleanup:** Files and temporary folders are deleted instantly from the server after upload to keep disk usage near zero.
- **Memory-Safe Queue:** Processes downloads through a serialized queue to prevent CPU and RAM overload on micro cloud instances.
- **Render Ready:** Includes a built-in HTTP health check server running on `PORT` for instant 24/7 web service compatibility.
- **Audio Extraction:** Supports `/audio <url>` or `#audio` hashtags to download MP3 audio directly.
- **Access Control:** Optional `ALLOWED_USERS` whitelist to restrict usage strictly to your personal Telegram account.

---

## Environment Variables

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `BOT_TOKEN` | **Yes** | — | Telegram Bot API token from [@BotFather](https://t.me/BotFather) |
| `PORT` | No | `8080` | Port for the HTTP health check server (Render automatically sets this) |
| `ALLOWED_USERS` | No | `""` | Comma-separated list of Telegram User IDs allowed to use the bot |
| `MAX_FILE_SIZE_MB` | No | `50` | Maximum file size in MB (Telegram standard limit is 50MB) |
| `MAX_CONCURRENT_DOWNLOADS` | No | `1` | Maximum parallel downloads (keep at `1` for 512MB RAM) |

---

## Deployment on Render

1. Create a **New Web Service** on [Render Dashboard](https://dashboard.render.com/).
2. Connect your GitHub repository (`telegram-ytdlp-bot`).
3. Select **Docker** as the Runtime.
4. Under **Environment**, add:
   - `BOT_TOKEN`: `your-telegram-bot-token`
   - `ALLOWED_USERS`: *(Optional)* `your-telegram-user-id`
5. Click **Create Web Service**.

---

## Local Development

```bash
# Clone repository
git clone https://github.com/afnan-nex/telegram-ytdlp-bot.git
cd telegram-ytdlp-bot

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run bot in watch mode
npm run dev
```

---

## License

[MIT](LICENSE) © [afnan-nex](https://github.com/afnan-nex)
