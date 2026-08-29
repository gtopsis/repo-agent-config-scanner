import { safeGetDirectory } from './fsWalk.js';
import { scanFrontmatterFiles } from './scanFrontmatterFiles.js';
import type { ScanItem } from '../types.js';

function folderNameFromSkillPath(path: string, fileName: string): string {
  return path.split('/').slice(-2, -1)[0] ?? fileName;
}

/** SKILL.md is a cross-tool convention: a skill's identity comes from the name of the
 * folder containing SKILL.md (frontmatter `name` wins if present), discoverable
 * recursively under each of the given "<parentFolder>/skills" locations. Every editor
 * that supports Skills recognizes its own folder plus the shared `.claude/skills` and
 * `.agents/skills` locations other tools use — callers just supply which parent
 * folder names are relevant to them. */
export async function scanSkillsAcrossFolders(
  root: FileSystemDirectoryHandle,
  parentFolderNames: string[],
): Promise<ScanItem[]> {
  // Keyed by resolved skill name so the same skill found under more than one parent
  // folder (e.g. .claude/skills and .agents/skills) merges into a single entry
  // instead of appearing as separate "duplicate" skills.
  const byName = new Map<string, ScanItem>();

  for (const parentName of parentFolderNames) {
    const parentDir = await safeGetDirectory(root, parentName);
    if (!parentDir) continue;
    const skillsDir = await safeGetDirectory(parentDir, 'skills');
    if (!skillsDir) continue;

    const found = await scanFrontmatterFiles(skillsDir, `${parentName}/skills`, {
      predicate: (f) => f.name === 'SKILL.md',
      resolveName: (meta, fileName, path) => (meta.name as string) || folderNameFromSkillPath(path, fileName),
    });

    for (const item of found) {
      const existing = byName.get(item.name);
      if (!existing) {
        byName.set(item.name, item);
      } else {
        existing.additionalPaths = [...(existing.additionalPaths ?? []), item.path];
      }
    }
  }

  return [...byName.values()];
}
