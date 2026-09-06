import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

/**
 * Probes video file to extract width, height, and duration.
 * @param {string} filePath
 * @returns {Promise<{ width?: number, height?: number, duration?: number, codec?: string }>}
 */
export async function getVideoMetadata(filePath) {
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration,codec_name',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath,
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const json = JSON.parse(stdout);
          const stream = json.streams?.[0] || {};
          const format = json.format || {};
          const width = stream.width ? parseInt(stream.width, 10) : undefined;
          const height = stream.height ? parseInt(stream.height, 10) : undefined;
          const duration = Math.round(parseFloat(stream.duration || format.duration || 0)) || undefined;
          const codec = stream.codec_name || undefined;
          return resolve({ width, height, duration, codec });
        } catch {}
      }
      resolve({});
    });

    proc.on('error', () => {
      resolve({});
    });
  });
}

/**
 * Generates a thumbnail image from the video.
 * @param {string} videoPath
 * @param {string} thumbnailPath
 * @returns {Promise<boolean>}
 */
export async function generateThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve) => {
    const args = [
      '-ss', '00:00:01',
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      thumbnailPath,
    ];

    const proc = spawn('ffmpeg', args);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/**
 * Downloads media from URL and returns file details with full Telegram compatibility and progress tracking.
 * @param {string} url - Target media URL
 * @param {object} options - Options { audioOnly: boolean, onProgress: (data: any) => void }
 * @returns {Promise<{ filePath: string, fileName: string, title: string, uploader: string, duration?: number, width?: number, height?: number, thumbnailPath?: string, fileSizeBytes: number, isAudio: boolean, dirPath: string }>}
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
    '--newline',
    '--max-filesize', `${config.maxFileSizeMB}M`,
    '-o', outputTemplate,
  ];

  if (isAudio) {
    args.push(
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0'
    );
  } else {
    // 1. Prioritize H.264 (AVC) and AAC audio so Telegram mobile/desktop players decode video properly
    // 2. Transcode incompatible codecs (VP9/AV1/HEVC) to H.264 MP4 with yuv420p and +faststart
    args.push(
      '-S', 'vcodec:h264,fps,res,acodec:m4a',
      '-f', `bestvideo[vcodec^=avc1][filesize<?${config.maxFileSizeMB}M]+bestaudio[acodec^=mp4a]/bestvideo[ext=mp4][filesize<?${config.maxFileSizeMB}M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<?${config.maxFileSizeMB}M]/best[filesize<?${config.maxFileSizeMB}M]/best`,
      '--merge-output-format', 'mp4',
      '--recode-video', 'mp4',
      '--postprocessor-args', 'Merger+ffmpeg:-movflags +faststart',
      '--postprocessor-args', 'VideoConvertor:-c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -c:a aac -movflags +faststart'
    );
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    console.log(`[Downloader] Spawning yt-dlp for: ${url} (audioOnly=${isAudio})`);
    const proc = spawn('yt-dlp', args);

    let stderr = '';
    const downloadRegex = /\[download\]\s+([\d\.]+)%\s+of\s+~?\s*([\d\.]+\w+)(?:\s+at\s+([\d\.]+\w+\/s))?(?:\s+ETA\s+([\d:]+))?/;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(downloadRegex);
        if (match && options.onProgress) {
          options.onProgress({
            phase: 'downloading',
            percent: parseFloat(match[1]),
            totalStr: match[2],
            speedStr: match[3] || '',
            etaStr: match[4] || '',
          });
        } else if ((line.includes('[Merger]') || line.includes('[VideoConvertor]') || line.includes('[ExtractAudio]')) && options.onProgress) {
          options.onProgress({
            phase: 'processing',
            percent: 100,
          });
        }
      }
    });

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
        const mediaFile = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.endsWith('.jpg') && !f.endsWith('.png'));
        if (!mediaFile) {
          return reject(new Error('Media file not found after download completed.'));
        }

        const filePath = path.join(dirPath, mediaFile);
        const stats = await fs.stat(filePath);

        if (stats.size > config.maxFileSizeMB * 1024 * 1024) {
          return reject(new Error(`File size (${(stats.size / 1024 / 1024).toFixed(1)} MB) exceeds Telegram's ${config.maxFileSizeMB} MB limit.`));
        }

        const title = path.parse(mediaFile).name;

        let width;
        let height;
        let duration;
        let thumbnailPath;

        if (!isAudio) {
          const meta = await getVideoMetadata(filePath);
          width = meta.width;
          height = meta.height;
          duration = meta.duration;

          const thumbFile = path.join(dirPath, 'thumb.jpg');
          const thumbCreated = await generateThumbnail(filePath, thumbFile);
          if (thumbCreated) {
            thumbnailPath = thumbFile;
          }
        }

        resolve({
          filePath,
          fileName: mediaFile,
          title,
          uploader: '',
          duration,
          width,
          height,
          thumbnailPath,
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
