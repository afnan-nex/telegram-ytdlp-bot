import dotenv from 'dotenv';
dotenv.config();

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('FATAL: BOT_TOKEN environment variable is required.');
}

const parseAllowedUsers = (envVal) => {
  if (!envVal) return [];
  return envVal
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => !isNaN(n));
};

export const config = {
  botToken: botToken || '',
  port: parseInt(process.env.PORT || '8080', 10),
  allowedUsers: parseAllowedUsers(process.env.ALLOWED_USERS || process.env.ALLOWED_USER_IDS || ''),
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '1', 10),
  downloadDir: process.env.DOWNLOAD_DIR || './downloads',
};
