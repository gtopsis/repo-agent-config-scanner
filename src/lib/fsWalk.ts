export async function safeGetDirectory(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await parent.getDirectoryHandle(name, { create: false });
  } catch (e) {
    return null;
  }
}

export async function safeGetFile(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemFileHandle | null> {
  try {
    return await parent.getFileHandle(name, { create: false });
  } catch (e) {
    return null;
  }
}

export async function readText(fileHandle: FileSystemFileHandle | null): Promise<string> {
  if (!fileHandle) return '';
  try {
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (e) {
    return '';
  }
}

export interface WalkedFile {
  name: string;
  path: string;
  handle: FileSystemFileHandle;
}

export type WalkPredicate = (file: WalkedFile) => boolean;

/** Directory names to skip during a project-wide recursive walk (e.g. hunting for
 * nested CLAUDE.md/AGENTS.md files anywhere in the tree) — walking into these on a
 * real project would be slow and produce noise, not signal. */
export const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'target',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.cache',
  'coverage',
  '.turbo',
]);

export async function walkFiles(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string,
  predicate?: WalkPredicate,
  skipDirNames?: Set<string>,
): Promise<WalkedFile[]> {
  const results: WalkedFile[] = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const entryPath = basePath ? `${basePath}/${name}` : name;
    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle;
      if (!predicate || predicate({ name, path: entryPath, handle: fileHandle })) {
        results.push({ name, path: entryPath, handle: fileHandle });
      }
    } else if (handle.kind === 'directory') {
      if (skipDirNames?.has(name)) continue;
      const nested = await walkFiles(handle as FileSystemDirectoryHandle, entryPath, predicate, skipDirNames);
      results.push(...nested);
    }
  }
  return results;
}
