// Caches the last scan's plain-JSON results (unlike the directory handle, these are
// ordinary serializable data) so the app has something to show immediately on reload,
// before permission to re-read the live folder has been re-confirmed.

import type { ScanResult } from '../types.js';

const STORAGE_KEY = 'agentic-config-visualizer:lastScan';

export interface CachedScan {
  folderName: string;
  results: ScanResult[];
}

export function saveScanCache(folderName: string, results: ScanResult[]): void {
  try {
    const payload: CachedScan = { folderName, results };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // Storage full/unavailable (e.g. private browsing) — non-fatal, just skip caching.
  }
}

export function loadScanCache(): CachedScan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedScan) : null;
  } catch (e) {
    return null;
  }
}
