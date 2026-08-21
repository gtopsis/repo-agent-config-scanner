import { safeGetDirectory, walkFiles, readText } from './fsWalk.js';
import { parseFrontmatterSafe } from './frontmatter.js';
import type { ScanItem } from '../types.js';

/** GitHub Agentic Workflows: markdown files (not the usual YAML) in the same
 * .github/workflows/ directory as regular Actions, with frontmatter (`on`,
 * `permissions`, `safe-outputs`, `engine`) followed by natural-language
 * instructions for the AI engine. `engine` selects which AI runs the workflow
 * (`copilot` | `claude` | `codex` | `gemini`) — callers filter to the engine
 * relevant to their editor, since a project's workflows folder may target several. */
export async function scanAgenticWorkflows(root: FileSystemDirectoryHandle, engine: string): Promise<ScanItem[]> {
  const githubDir = await safeGetDirectory(root, '.github');
  if (!githubDir) return [];
  const workflowsDir = await safeGetDirectory(githubDir, 'workflows');
  if (!workflowsDir) return [];

  const files = await walkFiles(workflowsDir, '.github/workflows', (f) => f.name.endsWith('.md'));
  const items: ScanItem[] = [];

  for (const f of files) {
    const text = await readText(f.handle);
    const { meta, body } = parseFrontmatterSafe(text);
    if (meta.engine !== engine) continue;
    items.push({
      name: f.name.replace(/\.md$/, ''),
      path: f.path,
      description: `GitHub Agentic Workflow (${engine})`,
      meta,
      preview: body,
    });
  }

  return items;
}
