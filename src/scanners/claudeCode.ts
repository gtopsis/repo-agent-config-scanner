import { safeGetDirectory, readText, walkFiles, DEFAULT_SKIP_DIRS } from '../lib/fsWalk.js';
import { scanSkillsAcrossFolders } from '../lib/skills.js';
import { scanMcpFile } from '../lib/mcp.js';
import { scanAgenticWorkflows } from '../lib/agenticWorkflows.js';
import { resolveCanonicalRefsForSections } from '../lib/canonicalRefs.js';
import { readJsonSafe, jsonParseErrorItem } from '../lib/jsonFile.js';
import { pushSection, scanFrontmatterSection } from '../lib/sections.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

interface ClaudeHookEntry {
  type?: string;
  command?: string;
}

interface ClaudeHookMatcher {
  matcher?: string;
  hooks?: ClaudeHookEntry[];
  command?: string;
  type?: string;
}

interface ClaudeSettingsJson {
  hooks?: Record<string, ClaudeHookMatcher | ClaudeHookMatcher[]>;
  [key: string]: unknown;
}

interface PersonOrString {
  name?: string;
  [key: string]: unknown;
}

interface ClaudePluginManifest {
  name?: string;
  displayName?: string;
  version?: string;
  description?: string;
  author?: string | PersonOrString;
  license?: string;
  homepage?: string;
  [key: string]: unknown;
}

interface ClaudeMarketplaceManifest {
  name?: string;
  owner?: string | PersonOrString;
  description?: string;
  version?: string;
  plugins?: unknown[];
}

// Recognized top-level settings.json keys, each surfaced as its own labeled item
// instead of being lumped into one generic "other settings" blob.
const KNOWN_SETTINGS_KEYS: Record<string, string> = {
  statusLine: 'Status Line',
  subagentStatusLine: 'Subagent Status Line',
  permissions: 'Permissions',
  outputStyle: 'Output Style',
  enabledPlugins: 'Enabled Plugins',
  extraKnownMarketplaces: 'Known Marketplaces',
};

async function scanSettingsFile(
  claudeDir: FileSystemDirectoryHandle,
  fileName: string,
  hookItems: ScanItem[],
  settingItems: ScanItem[],
): Promise<void> {
  const result = await readJsonSafe<ClaudeSettingsJson>(claudeDir, fileName);
  if (!result) return;
  if (result.parseError) {
    hookItems.push(jsonParseErrorItem(fileName, `.claude/${fileName}`, result.text));
    return;
  }
  const json = result.json;

  for (const [event, matchers] of Object.entries(json.hooks || {})) {
    const matcherList = Array.isArray(matchers) ? matchers : [matchers];
    for (const m of matcherList) {
      const matcherLabel = m.matcher ?? '*';
      const hooksArr: ClaudeHookEntry[] = Array.isArray(m.hooks) ? m.hooks : m.command ? [m] : [];
      for (const h of hooksArr) {
        hookItems.push({
          name: `${event} — ${matcherLabel}`,
          path: `.claude/${fileName}`,
          description: h.command || '',
          meta: { event, matcher: matcherLabel, type: h.type || 'command' },
        });
      }
    }
  }

  for (const [key, label] of Object.entries(KNOWN_SETTINGS_KEYS)) {
    if (!(key in json)) continue;
    const value = json[key];
    const isObj = typeof value === 'object' && value !== null;
    settingItems.push({
      name: label,
      path: `.claude/${fileName}`,
      description: isObj ? '' : String(value),
      meta: isObj ? (value as Record<string, unknown>) : undefined,
    });
  }

  const handledKeys = new Set(['hooks', ...Object.keys(KNOWN_SETTINGS_KEYS)]);
  const otherKeys = Object.keys(json).filter((k) => !handledKeys.has(k));
  if (otherKeys.length) {
    settingItems.push({
      name: `${fileName} (other settings)`,
      path: `.claude/${fileName}`,
      description: otherKeys.join(', '),
      meta: Object.fromEntries(otherKeys.map((k) => [k, json[k]])),
    });
  }
}

async function scanWorkflows(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const githubDir = await safeGetDirectory(root, '.github');
  if (!githubDir) return;
  const workflowsDir = await safeGetDirectory(githubDir, 'workflows');
  if (!workflowsDir) return;

  const files = await walkFiles(workflowsDir, '.github/workflows', (f) => /\.ya?ml$/.test(f.name));
  for (const f of files) {
    const text = await readText(f.handle);
    if (!/claude-code-action/.test(text)) continue;
    items.push({
      name: f.name.replace(/\.ya?ml$/, ''),
      path: f.path,
      description: 'Uses the Claude Code GitHub Action',
      preview: text,
    });
  }
}

// CLAUDE.md (and its personal, untracked CLAUDE.local.md variant) load on-demand
// from any subdirectory, not just the project root.
async function scanNestedMemoryFiles(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const files = await walkFiles(root, '', (f) => f.name === 'CLAUDE.md' || f.name === 'CLAUDE.local.md', DEFAULT_SKIP_DIRS);
  for (const f of files) {
    const text = await readText(f.handle);
    const description =
      f.name === 'CLAUDE.local.md'
        ? 'Personal, untracked variant'
        : f.path === 'CLAUDE.md'
          ? ''
          : 'Loaded on-demand when working in this directory';
    items.push({ name: f.path, path: f.path, description, preview: text || '' });
  }
}

async function scanRules(claudeDir: FileSystemDirectoryHandle): Promise<ScanItem[]> {
  return scanFrontmatterSection(claudeDir, 'rules', '.claude/rules', {
    predicate: (f) => f.name.endsWith('.md'),
    resolveName: (_meta, fileName) => fileName.replace(/\.md$/, ''),
    resolveDescription: (meta) => {
      const paths = meta.paths;
      return paths ? `Scoped to: ${Array.isArray(paths) ? paths.join(', ') : String(paths)}` : 'Applies unconditionally';
    },
  });
}

async function scanOutputStyles(claudeDir: FileSystemDirectoryHandle): Promise<ScanItem[]> {
  return scanFrontmatterSection(claudeDir, 'output-styles', '.claude/output-styles', {
    predicate: (f) => f.name.endsWith('.md'),
  });
}

function personName(value: string | PersonOrString | undefined): string | undefined {
  if (typeof value === 'string') return value;
  return value?.name;
}

// Plugin/marketplace manifests can live anywhere they're developed/vendored in the
// repo, not just under a fixed top-level folder — both are otherwise the exact same
// "find files matching a suffix, parse each as JSON, map to an item" shape.
async function scanJsonManifests<T>(
  root: FileSystemDirectoryHandle,
  pathSuffix: string,
  toItem: (json: T, path: string) => ScanItem,
  items: ScanItem[],
): Promise<void> {
  const files = await walkFiles(root, '', (f) => f.path.endsWith(pathSuffix), DEFAULT_SKIP_DIRS);
  for (const f of files) {
    const text = await readText(f.handle);
    try {
      items.push(toItem(JSON.parse(text) as T, f.path));
    } catch (e) {
      items.push(jsonParseErrorItem(f.path, f.path, text));
    }
  }
}

async function scanPlugins(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  await scanJsonManifests<ClaudePluginManifest>(
    root,
    '.claude-plugin/plugin.json',
    (json, path) => ({
      name: json.displayName || json.name || path,
      path,
      description: json.description || '',
      meta: {
        displayName: json.displayName,
        version: json.version,
        description: json.description,
        author: personName(json.author),
        license: json.license,
        homepage: json.homepage,
      },
    }),
    items,
  );
}

async function scanMarketplaces(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  await scanJsonManifests<ClaudeMarketplaceManifest>(
    root,
    '.claude-plugin/marketplace.json',
    (json, path) => ({
      name: json.name || path,
      path,
      description: json.description || '',
      meta: {
        owner: personName(json.owner),
        version: json.version,
        pluginCount: Array.isArray(json.plugins) ? json.plugins.length : undefined,
      },
    }),
    items,
  );
}

export async function scanClaudeCode(root: FileSystemDirectoryHandle): Promise<ScanResult> {
  const sections: ScanSection[] = [];
  let detected = false;

  const instructionItems: ScanItem[] = [];
  await scanNestedMemoryFiles(root, instructionItems);
  if (instructionItems.length) detected = true;

  const claudeDir = await safeGetDirectory(root, '.claude');
  let ruleItems: ScanItem[] = [];
  let outputStyleItems: ScanItem[] = [];

  if (claudeDir) {
    detected = true;

    const skillItems = await scanSkillsAcrossFolders(root, ['.claude']);
    pushSection(sections, 'skills', 'Skills', skillItems);

    const commandItems = await scanFrontmatterSection(claudeDir, 'commands', '.claude/commands', {
      predicate: (f) => f.name.endsWith('.md'),
    });
    pushSection(sections, 'commands', 'Commands', commandItems);

    const agentItems = await scanFrontmatterSection(claudeDir, 'agents', '.claude/agents', {
      predicate: (f) => f.name.endsWith('.md'),
    });
    pushSection(sections, 'agents', 'Agents', agentItems);

    ruleItems = await scanRules(claudeDir);
    outputStyleItems = await scanOutputStyles(claudeDir);

    const hookItems: ScanItem[] = [];
    const settingItems: ScanItem[] = [];
    await scanSettingsFile(claudeDir, 'settings.json', hookItems, settingItems);
    await scanSettingsFile(claudeDir, 'settings.local.json', hookItems, settingItems);
    pushSection(sections, 'hooks', 'Hooks', hookItems);
    pushSection(sections, 'settings', 'Settings', settingItems);
  }

  pushSection(sections, 'rules', 'Rules', ruleItems);
  pushSection(sections, 'outputStyles', 'Output Styles', outputStyleItems);

  const mcpItems: ScanItem[] = [];
  await scanMcpFile(root, '.mcp.json', '.mcp.json', mcpItems);
  if (claudeDir) await scanMcpFile(claudeDir, 'mcp.json', '.claude/mcp.json', mcpItems);
  if (mcpItems.length) detected = true;
  pushSection(sections, 'mcpServers', 'MCP Servers', mcpItems);

  const workflowItems: ScanItem[] = [];
  await scanWorkflows(root, workflowItems);
  workflowItems.push(...(await scanAgenticWorkflows(root, 'claude')));
  if (workflowItems.length) detected = true;
  pushSection(sections, 'workflows', 'Workflows', workflowItems);

  const pluginItems: ScanItem[] = [];
  await scanPlugins(root, pluginItems);
  if (pluginItems.length) detected = true;
  pushSection(sections, 'plugins', 'Plugins', pluginItems);

  const marketplaceItems: ScanItem[] = [];
  await scanMarketplaces(root, marketplaceItems);
  if (marketplaceItems.length) detected = true;
  pushSection(sections, 'marketplaces', 'Marketplaces', marketplaceItems);

  if (instructionItems.length) {
    sections.unshift({ key: 'instructions', label: 'Project Instructions', items: instructionItems });
  }

  await resolveCanonicalRefsForSections(root, sections);
  return { editor: 'claude-code', label: 'Claude Code', detected, sections };
}
