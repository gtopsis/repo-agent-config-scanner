import { safeGetDirectory } from './fsWalk.js';
import { scanFrontmatterFiles } from './scanFrontmatterFiles.js';
import type { FrontmatterScanOptions } from './scanFrontmatterFiles.js';
import type { ScanItem, ScanSection } from '../types.js';

/** Appends a section only if it actually has items — the single condition every
 * scanner repeats after building each section's item list, so call sites read as
 * one line instead of a 3-line `if (items.length) sections.push(...)` block. */
export function pushSection(sections: ScanSection[], key: string, label: string, items: ScanItem[]): void {
  if (items.length) sections.push({ key, label, items });
}

/** Same as `pushSection`, but prepends — for sections like "Project Instructions"
 * that should always lead the list regardless of scan order. */
export function unshiftSection(sections: ScanSection[], key: string, label: string, items: ScanItem[]): void {
  if (items.length) sections.unshift({ key, label, items });
}

/** The other half of the repeated pair: `safeGetDirectory` a named subfolder, then
 * `scanFrontmatterFiles` it if present, otherwise `[]`. Combines the "does this
 * subfolder exist" guard with the scan call so callers only supply what's
 * distinctive (the subfolder name, its display basePath, and file-parsing options). */
export async function scanFrontmatterSection(
  parentDir: FileSystemDirectoryHandle,
  subfolder: string,
  basePath: string,
  options: FrontmatterScanOptions,
): Promise<ScanItem[]> {
  const dir = await safeGetDirectory(parentDir, subfolder);
  if (!dir) return [];
  return scanFrontmatterFiles(dir, basePath, options);
}
