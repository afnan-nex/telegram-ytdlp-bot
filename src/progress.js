import { Transform } from 'stream';

/**
 * Creates a visual ASCII progress bar.
 * @param {number} percent (0-100)
 * @param {number} length
 * @returns {string}
 */
export function formatProgressBar(percent, length = 12) {
  const p = Math.min(Math.max(percent || 0, 0), 100);
  const filled = Math.round((p / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Formats byte numbers into human readable strings.
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Throttled status message reporter to avoid Telegram rate limits.
 */
export class ProgressReporter {
  constructor(ctx, statusMsg, intervalMs = 2000) {
    this.ctx = ctx;
    this.statusMsg = statusMsg;
    this.intervalMs = intervalMs;
    this.lastEditTime = 0;
    this.lastText = '';
    this.timeoutId = null;
    this.isFinished = false;
  }

  async update(text, force = false) {
    if (this.isFinished || !this.statusMsg || text === this.lastText) return;
    const now = Date.now();

    if (force || now - this.lastEditTime >= this.intervalMs) {
      this.lastEditTime = now;
      this.lastText = text;
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      try {
        await this.ctx.api.editMessageText(
          this.ctx.chat.id,
          this.statusMsg.message_id,
          text,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        // Silently ignore minor telegram rate limit / unchanged message errors
      }
    } else if (!this.timeoutId) {
      const delay = Math.max(this.intervalMs - (now - this.lastEditTime), 200);
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        this.update(text, true);
      }, delay);
    }
  }

  finish() {
    this.isFinished = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Creates a readable stream transform that monitors upload progress in real-time.
 * @param {number} totalBytes
 * @param {(progress: { uploadedBytes: number, totalBytes: number, percent: number, speedBytesPerSec: number }) => void} onProgress
 * @returns {Transform}
 */
export function createProgressStream(totalBytes, onProgress) {
  let uploadedBytes = 0;
  const startTime = Date.now();

  return new Transform({
    transform(chunk, encoding, callback) {
      uploadedBytes += chunk.length;
      const percent = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speedBytesPerSec = elapsedSec > 0 ? uploadedBytes / elapsedSec : 0;

      if (onProgress) {
        onProgress({
          uploadedBytes,
          totalBytes,
          percent: Math.min(percent, 100),
          speedBytesPerSec,
        });
      }

      callback(null, chunk);
    },
  });
}
