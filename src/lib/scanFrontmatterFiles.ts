import { walkFiles, readText } from './fsWalk.js';
import { parseFrontmatterSafe } from './frontmatter.js';
import type { WalkPredicate } from './fsWalk.js';
import type { Meta, ScanItem } from '../types.js';

export interface FrontmatterScanOptions {
  predicate: WalkPredicate;
  /** Defaults to `meta.name || <filename without its last extension>`. */
  resolveName?: (meta: Meta, fileName: string, path: string) => string;
  /** Defaults to `meta.description || ''`. */
  resolveDescription?: (meta: Meta) => string;
}

function defaultResolveName(meta: Meta, fileName: string): string {
  return (meta.name as string) || fileName.replace(/\.[^./]+$/, '');
}

function defaultResolveDescription(meta: Meta): string {
  return (meta.description as string) || '';
}

/** The single most common scanning pattern across every editor: walk a directory for
 * files matching a predicate, parse each as YAML-frontmatter + Markdown body, and
 * build one ScanItem per file. Callers only need to supply what's distinctive about
 * their file type (which files count, and how to derive a name/description from
 * fields that aren't the plain `name`/`description` frontmatter keys). */
export async function scanFrontmatterFiles(
  dir: FileSystemDirectoryHandle,
  basePath: string,
  options: FrontmatterScanOptions,
): Promise<ScanItem[]> {
  const files = await walkFiles(dir, basePath, options.predicate);
  const resolveName = options.resolveName ?? defaultResolveName;
  const resolveDescription = options.resolveDescription ?? defaultResolveDescription;

  const items: ScanItem[] = [];
  for (const f of files) {
    const text = await readText(f.handle);
    const { meta, body } = parseFrontmatterSafe(text);
    items.push({
      name: resolveName(meta, f.name, f.path),
      path: f.path,
      description: resolveDescription(meta),
      meta,
      preview: body,
    });
  }
  return items;
}
