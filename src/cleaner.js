import fs from 'fs/promises';
import path from 'path';

/**
 * Safely removes a directory and all of its contents.
 * @param {string} dirPath - Absolute or relative path to directory.
 */
export async function cleanupFolder(dirPath) {
  if (!dirPath) return;
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log(`[Cleaner] Successfully removed temporary directory: ${dirPath}`);
  } catch (err) {
    console.warn(`[Cleaner] Failed to remove directory ${dirPath}:`, err.message);
  }
}

/**
 * Starts a background janitor job to prune any stale download folders older than maxAgeMs.
 * @param {string} baseDir - The downloads root directory.
 * @param {number} intervalMs - How often to run the cleanup job (default 15 mins).
 * @param {number} maxAgeMs - Maximum age before a folder is deleted (default 30 mins).
 */
export function startPeriodicCleaner(baseDir = './downloads', intervalMs = 15 * 60 * 1000, maxAgeMs = 30 * 60 * 1000) {
  const runCleanup = async () => {
    try {
      await fs.mkdir(baseDir, { recursive: true });
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        const fullPath = path.join(baseDir, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            await fs.rm(fullPath, { recursive: true, force: true });
            console.log(`[Cleaner] Pruned stale file/directory: ${fullPath}`);
          }
        } catch {
          // Ignore individual stat errors
        }
      }
    } catch (err) {
      console.warn('[Cleaner] Periodic cleanup warning:', err.message);
    }
  };

  // Run initial cleanup
  runCleanup();

  // Recurring interval
  const timer = setInterval(runCleanup, intervalMs);
  timer.unref();
}
