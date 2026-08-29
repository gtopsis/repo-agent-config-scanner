import { safeGetDirectory, safeGetFile, readText, walkFiles, DEFAULT_SKIP_DIRS } from '../lib/fsWalk.js';
import { scanSkillsAcrossFolders } from '../lib/skills.js';
import { scanMcpFile } from '../lib/mcp.js';
import { resolveCanonicalRefsForSections } from '../lib/canonicalRefs.js';
import { readJsonSafe, jsonParseErrorItem } from '../lib/jsonFile.js';
import { pushSection, scanFrontmatterSection } from '../lib/sections.js';
import type { ScanItem, ScanResult } from '../types.js';

interface CursorHookEntry {
  command?: string;
  matcher?: string;
  timeout?: number;
  failClosed?: boolean;
  type?: string;
}

interface CursorHooksJson {
  version?: number;
  hooks?: Record<string, CursorHookEntry | CursorHookEntry[]>;
}

interface EnvironmentJson {
  snapshot?: string;
  dockerfile?: string;
  context?: string;
  install?: string;
  start?: string | string[];
  terminals?: unknown[];
  [key: string]: unknown;
}

async function scanHooks(cursorDir: FileSystemDirectoryHandle, hookItems: ScanItem[]): Promise<void> {
  const result = await readJsonSafe<CursorHooksJson>(cursorDir, 'hooks.json');
  if (!result) return;
  if (result.parseError) {
    hookItems.push(jsonParseErrorItem('hooks.json', '.cursor/hooks.json', result.text));
    return;
  }

  for (const [event, entries] of Object.entries(result.json.hooks || {})) {
    const list = Array.isArray(entries) ? entries : [entries];
    for (const entry of list) {
      const matcherLabel = entry.matcher ?? '*';
      hookItems.push({
        name: `${event} — ${matcherLabel}`,
        path: '.cursor/hooks.json',
        description: entry.command || '',
        meta: {
          event,
          matcher: matcherLabel,
          type: entry.type || 'command',
          timeout: entry.timeout,
          failClosed: entry.failClosed,
        },
      });
    }
  }
}

// AGENTS.md is recognized anywhere in the tree in Cursor (more specific/deeper files
// take precedence for files scoped under that directory) — not just the project root.
async function scanNestedAgentsMd(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const files = await walkFiles(root, '', (f) => f.name === 'AGENTS.md', DEFAULT_SKIP_DIRS);
  for (const f of files) {
    const text = await readText(f.handle);
    items.push({
      name: f.path,
      path: f.path,
      description: f.path === 'AGENTS.md' ? '' : 'Scoped to this directory and its children',
      preview: text || '',
    });
  }
}

async function scanJsonSettingFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  path: string,
  description: string,
  items: ScanItem[],
): Promise<void> {
  const result = await readJsonSafe(dir, fileName);
  if (!result) return;
  if (result.parseError) {
    items.push(jsonParseErrorItem(fileName, path, result.text));
    return;
  }
  items.push({ name: fileName, path, description, meta: result.json });
}

export async function scanCursor(root: FileSystemDirectoryHandle): Promise<ScanResult> {
  let detected = false;

  const instructionItems: ScanItem[] = [];
  const hookItems: ScanItem[] = [];
  const mcpItems: ScanItem[] = [];
  const ignoreItems: ScanItem[] = [];
  const environmentItems: ScanItem[] = [];
  const settingItems: ScanItem[] = [];

  const cursorRulesFile = await safeGetFile(root, '.cursorrules');
  if (cursorRulesFile) {
    detected = true;
    const text = await readText(cursorRulesFile);
    instructionItems.push({
      name: '.cursorrules',
      path: '.cursorrules',
      description: 'Legacy project rules file',
      preview: text || '',
    });
  }

  await scanNestedAgentsMd(root, instructionItems);
  if (instructionItems.length) detected = true;

  const ignoreDescriptions: Record<string, string> = {
    '.cursorignore': 'Excludes files from Agent, Tab, Inline Edit, and @-mentions',
    '.cursorindexingignore': 'Excludes files from codebase indexing only (still readable if @-mentioned)',
  };
  for (const name of ['.cursorignore', '.cursorindexingignore']) {
    const file = await safeGetFile(root, name);
    if (!file) continue;
    detected = true;
    const text = await readText(file);
    ignoreItems.push({
      name,
      path: name,
      description: '',
      meta: { purpose: ignoreDescriptions[name] },
      preview: text || '',
    });
  }

  const cursorDir = await safeGetDirectory(root, '.cursor');
  let ruleItems: ScanItem[] = [];
  let agentItems: ScanItem[] = [];
  let commandItems: ScanItem[] = [];

  if (cursorDir) {
    detected = true;

    ruleItems = await scanFrontmatterSection(cursorDir, 'rules', '.cursor/rules', {
      predicate: (f) => f.name.endsWith('.mdc'),
    });
    agentItems = await scanFrontmatterSection(cursorDir, 'agents', '.cursor/agents', {
      predicate: (f) => f.name.endsWith('.md'),
    });
    commandItems = await scanFrontmatterSection(cursorDir, 'commands', '.cursor/commands', {
      predicate: (f) => f.name.endsWith('.md'),
    });

    await scanHooks(cursorDir, hookItems);
    await scanMcpFile(cursorDir, 'mcp.json', '.cursor/mcp.json', mcpItems);
    await scanJsonSettingFile(cursorDir, 'environment.json', '.cursor/environment.json', 'Cloud/background agent environment setup', environmentItems);
    await scanJsonSettingFile(cursorDir, 'cli.json', '.cursor/cli.json', 'Project-scoped permissions for the Cursor CLI agent', settingItems);
  }

  const skillItems = await scanSkillsAcrossFolders(root, ['.cursor', '.agents']);
  if (skillItems.length) detected = true;

  const sections: ScanResult['sections'] = [];
  pushSection(sections, 'instructions', 'Project Instructions', instructionItems);
  pushSection(sections, 'rules', 'Rules', ruleItems);
  pushSection(sections, 'skills', 'Skills', skillItems);
  pushSection(sections, 'agents', 'Subagents', agentItems);
  pushSection(sections, 'commands', 'Commands', commandItems);
  pushSection(sections, 'hooks', 'Hooks', hookItems);
  pushSection(sections, 'mcpServers', 'MCP Servers', mcpItems);
  pushSection(sections, 'ignore', 'Ignore Rules', ignoreItems);
  pushSection(sections, 'environment', 'Environment', environmentItems);
  pushSection(sections, 'settings', 'Settings', settingItems);

  await resolveCanonicalRefsForSections(root, sections);
  return { editor: 'cursor', label: 'Cursor', detected, sections };
}
