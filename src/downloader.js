import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

/**
 * Extracts metadata for a given URL without downloading the file.
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function extractMetadata(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      url,
    ];

    const proc = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp metadata extraction failed with code ${code}`));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp metadata JSON: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Downloads media from URL and returns file details.
 * @param {string} url - Target media URL
 * @param {object} options - Options { audioOnly: boolean }
 * @returns {Promise<{ filePath: string, fileName: string, title: string, uploader: string, duration: number, fileSizeBytes: number, isAudio: boolean, dirPath: string, width?: number, height?: number }>}
 */
export async function downloadMedia(url, options = {}) {
  const isAudio = Boolean(options.audioOnly);
  const downloadId = crypto.randomUUID();
  const dirPath = path.resolve(config.downloadDir, downloadId);

  await fs.mkdir(dirPath, { recursive: true });

  const outputTemplate = path.join(dirPath, '%(title).180B.%(ext)s');

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--max-filesize', `${config.maxFileSizeMB}M`,
    '-o', outputTemplate,
  ];

  if (isAudio) {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    // Prefer best MP4 video + audio under file size limit, fallback to best MP4, then best
    args.push(
      '-f',
      `bestvideo[ext=mp4][filesize<?${config.maxFileSizeMB}M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<?${config.maxFileSizeMB}M]/best[filesize<?${config.maxFileSizeMB}M]/best`,
      '--merge-output-format', 'mp4'
    );
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    console.log(`[Downloader] Spawning yt-dlp for: ${url} (audioOnly=${isAudio})`);
    const proc = spawn('yt-dlp', args);

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Download failed with exit code ${code}`));
      }

      try {
        const files = await fs.readdir(dirPath);
        if (!files || files.length === 0) {
          return reject(new Error('No media file was produced by yt-dlp.'));
        }

        // Find the main media file (ignoring any leftover .part, .temp files)
        const mediaFile = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
        if (!mediaFile) {
          return reject(new Error('Media file not found after download completed.'));
        }

        const filePath = path.join(dirPath, mediaFile);
        const stats = await fs.stat(filePath);

        if (stats.size > config.maxFileSizeMB * 1024 * 1024) {
          return reject(new Error(`File size (${(stats.size / 1024 / 1024).toFixed(1)} MB) exceeds Telegram's ${config.maxFileSizeMB} MB limit.`));
        }

        const title = path.parse(mediaFile).name;

        resolve({
          filePath,
          fileName: mediaFile,
          title,
          uploader: '',
          duration: 0,
          fileSizeBytes: stats.size,
          isAudio,
          dirPath,
        });
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to execute yt-dlp: ${err.message}`));
    });
  });
}
