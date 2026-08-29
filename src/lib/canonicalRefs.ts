import { safeGetDirectory, safeGetFile, readText } from './fsWalk.js';
import type { CanonicalRef, ScanItem, ScanSection } from '../types.js';

// Matches a backtick-quoted relative path pointing into .agents/ and ending in .md,
// e.g. `../../../.agents/workflows/add-analytics-events.md`.
const REF_PATTERN = /`((?:\.\.\/)*\.agents\/[^`\n]+\.md)`/g;

function resolveRelativePath(fromItemPath: string, relative: string): string {
  const parts = [...fromItemPath.split('/').slice(0, -1), ...relative.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

async function getFileAtPath(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemFileHandle | null> {
  const segments = path.split('/');
  const fileName = segments.pop();
  if (!fileName) return null;

  let dir: FileSystemDirectoryHandle = root;
  for (const seg of segments) {
    const next = await safeGetDirectory(dir, seg);
    if (!next) return null;
    dir = next;
  }
  return safeGetFile(dir, fileName);
}

/** Scans an item's markdown body for `.agents/...md` references, resolves each path
 * relative to the item's own location, and reads the referenced file's content so it
 * can be shown inline as a distinct "canonical source" panel. Mutates `item` in place. */
export async function resolveCanonicalRefs(root: FileSystemDirectoryHandle, item: ScanItem): Promise<void> {
  if (!item.preview) return;
  const relativePaths = [...item.preview.matchAll(REF_PATTERN)]
    .map((m) => m[1])
    .filter((p): p is string => !!p);
  if (!relativePaths.length) return;

  const refs: CanonicalRef[] = [];
  for (const relative of relativePaths) {
    const path = resolveRelativePath(item.path, relative);
    const file = await getFileAtPath(root, path);
    refs.push({ path, raw: relative, content: file ? await readText(file) : undefined });
  }
  item.canonicalRefs = refs;
}

/** Runs canonical-ref resolution across every item in every section — the generic
 * entry point scanners call once, after building their full section list, so that
 * commands/agents/rules/etc. get the same `.agents/*.md` reference linking that
 * skills have always had, without every scan site needing its own call. */
export async function resolveCanonicalRefsForSections(
  root: FileSystemDirectoryHandle,
  sections: ScanSection[],
): Promise<void> {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.canonicalRefs) continue; // already resolved (e.g. skills, merged items)
      await resolveCanonicalRefs(root, item);
    }
  }
}
