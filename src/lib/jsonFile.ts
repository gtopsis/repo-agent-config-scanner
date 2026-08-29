import { safeGetFile, readText } from './fsWalk.js';
import type { ScanItem } from '../types.js';

export type JsonReadResult<T> = { json: T; text: string; parseError: false } | { text: string; parseError: true };

/** Reads and JSON.parses a file, without throwing — every scanner that reads a JSON
 * config file needs this exact "missing file → skip, invalid JSON → fallback item"
 * shape, so this is the one place that owns it. Returns `null` if the file doesn't
 * exist at all (caller should just skip), or a discriminated result if it does. */
export async function readJsonSafe<T = Record<string, unknown>>(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<JsonReadResult<T> | null> {
  const file = await safeGetFile(dir, fileName);
  if (!file) return null;
  const text = await readText(file);
  try {
    return { json: JSON.parse(text) as T, text, parseError: false };
  } catch (e) {
    return { text, parseError: true };
  }
}

/** The standard "couldn't parse this JSON file" placeholder item, shown with the raw
 * text so the user can see what's actually wrong with it. */
export function jsonParseErrorItem(name: string, path: string, text: string): ScanItem {
  return { name, path, description: 'Could not parse JSON', preview: text || '' };
}

/** Pure-text variant of the same "parse, don't throw" concern, for call sites that
 * already have file text in hand (e.g. from a multi-file `walkFiles` loop) rather
 * than a directory + filename to look up. */
export function parseJsonOrNull<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    return null;
  }
}
