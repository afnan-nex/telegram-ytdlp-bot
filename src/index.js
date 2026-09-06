import { Bot, InputFile } from 'grammy';
import { config } from './config.js';
import { startHealthServer } from './server.js';
import { startPeriodicCleaner, cleanupFolder } from './cleaner.js';
import { TaskQueue } from './queue.js';
import { downloadMedia } from './downloader.js';

if (!config.botToken) {
  console.error('[Bot] FATAL: BOT_TOKEN is missing. Please set the BOT_TOKEN environment variable.');
  process.exit(1);
}

// Start HTTP health server for Render
startHealthServer(config.port);

// Start background janitor
startPeriodicCleaner(config.downloadDir);

// Initialize concurrency queue (default 1 to prevent OOM on Render 512MB RAM)
const queue = new TaskQueue(config.maxConcurrentDownloads);

// Create Telegram Bot instance
const botOptions = {};
if (config.botApiUrl) {
  botOptions.client = {
    apiRoot: config.botApiUrl,
  };
  console.log(`[Bot] Using custom Bot API URL: ${config.botApiUrl}`);
}
const bot = new Bot(config.botToken, botOptions);

// Security middleware for personal use (optional whitelist)
bot.use(async (ctx, next) => {
  if (config.allowedUsers.length > 0) {
    const userId = ctx.from?.id;
    if (!userId || !config.allowedUsers.includes(userId)) {
      console.warn(`[Auth] Blocked unauthorized request from User ID: ${userId}`);
      if (ctx.message) {
        await ctx.reply('⛔ <b>Access Denied:</b> This is a private bot instance.', { parse_mode: 'HTML' });
      }
      return;
    }
  }
  return next();
});

// /start and /help commands
bot.command(['start', 'help'], async (ctx) => {
  const welcomeText =
    `👋 <b>Welcome to Media Downloader Bot!</b>\n\n` +
    `🚀 <b>How to use:</b>\n` +
    `• Send any supported media link (YouTube, Instagram, TikTok, X/Twitter, Reddit, Pinterest, etc.)\n` +
    `• To download <b>Audio only (MP3)</b>: Send <code>/audio &lt;url&gt;</code> or include <code>#audio</code> with your link.\n\n` +
    `⚡ <i>Lightweight, database-less, and fast with instant disk cleanup.</i>`;
  await ctx.reply(welcomeText, { parse_mode: 'HTML' });
});

// /ping command
bot.command('ping', async (ctx) => {
  const start = Date.now();
  const msg = await ctx.reply('🏓 Pong...');
  const latency = Date.now() - start;
  await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `🏓 <b>Pong!</b> Latency: <code>${latency}ms</code>`, {
    parse_mode: 'HTML',
  });
});

// /audio command
bot.command('audio', async (ctx) => {
  const text = ctx.match?.trim();
  const url = extractUrl(text);
  if (!url) {
    return ctx.reply('⚠️ Please provide a valid URL after /audio.\nExample: <code>/audio https://youtube.com/watch?v=...</code>', {
      parse_mode: 'HTML',
    });
  }
  await processDownload(ctx, url, { audioOnly: true });
});

// Text message URL listener
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  // Ignore commands handled above
  if (text.startsWith('/')) return;

  const url = extractUrl(text);
  if (!url) return;

  const audioOnly = text.includes('#audio') || text.includes('#mp3');
  await processDownload(ctx, url, { audioOnly });
});

/**
 * Extracts the first HTTP(S) URL from a string.
 * @param {string} text
 * @returns {string|null}
 */
function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/**
 * Handles queueing, downloading, sending, and cleaning up a media request.
 * @param {import('grammy').Context} ctx
 * @param {string} url
 * @param {object} options
 */
async function processDownload(ctx, url, options = {}) {
  let statusMsg;
  try {
    statusMsg = await ctx.reply(`⏳ <b>Queued:</b> Waiting for download slot...`, {
      parse_mode: 'HTML',
      reply_parameters: { message_id: ctx.message?.message_id || ctx.msgId },
    });
  } catch (err) {
    console.error('[Bot] Failed to send initial status message:', err.message);
  }

  // Enqueue task to prevent memory saturation
  await queue.add(async () => {
    let downloadResult = null;
    try {
      if (statusMsg) {
        await ctx.api
          .editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            `⚡ <b>Downloading:</b> Fetching media via yt-dlp...`,
            { parse_mode: 'HTML' }
          )
          .catch(() => {});
      }

      downloadResult = await downloadMedia(url, options);

      if (statusMsg) {
        await ctx.api
          .editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            `📤 <b>Uploading:</b> Sending to Telegram...`,
            { parse_mode: 'HTML' }
          )
          .catch(() => {});
      }

      const inputFile = new InputFile(downloadResult.filePath, downloadResult.fileName);
      const titleCaption = `🎬 <b>${escapeHtml(downloadResult.title)}</b>\n🔗 <a href="${url}">Source Link</a>`;

      if (downloadResult.isAudio) {
        await ctx.replyWithAudio(inputFile, {
          title: downloadResult.title,
          duration: downloadResult.duration,
          caption: titleCaption,
          parse_mode: 'HTML',
          reply_parameters: { message_id: ctx.message?.message_id || ctx.msgId },
        });
      } else {
        const videoOptions = {
          caption: titleCaption,
          parse_mode: 'HTML',
          supports_streaming: true,
          width: downloadResult.width,
          height: downloadResult.height,
          duration: downloadResult.duration,
          reply_parameters: { message_id: ctx.message?.message_id || ctx.msgId },
        };

        if (downloadResult.thumbnailPath) {
          videoOptions.thumbnail = new InputFile(downloadResult.thumbnailPath);
        }

        try {
          await ctx.replyWithVideo(inputFile, videoOptions);
        } catch (videoErr) {
          console.warn('[Bot] replyWithVideo failed, falling back to replyWithDocument:', videoErr.message);
          await ctx.replyWithDocument(inputFile, {
            caption: titleCaption,
            parse_mode: 'HTML',
            reply_parameters: { message_id: ctx.message?.message_id || ctx.msgId },
          });
        }
      }

      // Delete status message on success
      if (statusMsg) {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      }
    } catch (err) {
      console.error(`[Bot] Error downloading ${url}:`, err.message);
      const errorText = `❌ <b>Download Failed:</b>\n<code>${escapeHtml(err.message)}</code>`;
      if (statusMsg) {
        await ctx.api
          .editMessageText(ctx.chat.id, statusMsg.message_id, errorText, { parse_mode: 'HTML' })
          .catch(() => ctx.reply(errorText, { parse_mode: 'HTML' }));
      } else {
        await ctx.reply(errorText, { parse_mode: 'HTML' }).catch(() => {});
      }
    } finally {
      // Auto-delete temporary folder and downloaded file immediately
      if (downloadResult?.dirPath) {
        await cleanupFolder(downloadResult.dirPath);
      }
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Global error handler
bot.catch((err) => {
  console.error(`[Bot Error] Unhandled error in bot event handler:`, err.error || err);
});

// Start Telegram bot polling
bot.start({
  drop_pending_updates: true,
  onStart: (botInfo) => {
    console.log(`[Bot] Successfully started @${botInfo.username}`);
  },
});

// Graceful shutdown
const shutdown = () => {
  console.log('[App] Shutting down gracefully...');
  bot.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
