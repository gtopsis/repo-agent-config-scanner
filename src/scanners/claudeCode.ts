import { safeGetDirectory, safeGetFile, readText, walkFiles, DEFAULT_SKIP_DIRS } from '../lib/fsWalk.js';
import { scanFrontmatterFiles } from '../lib/scanFrontmatterFiles.js';
import { scanSkillsAcrossFolders } from '../lib/skills.js';
import { scanMcpFile } from '../lib/mcp.js';
import { scanAgenticWorkflows } from '../lib/agenticWorkflows.js';
import { resolveCanonicalRefsForSections } from '../lib/canonicalRefs.js';
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
  const file = await safeGetFile(claudeDir, fileName);
  if (!file) return;

  const text = await readText(file);
  let json: ClaudeSettingsJson;
  try {
    json = JSON.parse(text) as ClaudeSettingsJson;
  } catch (e) {
    hookItems.push({
      name: fileName,
      path: `.claude/${fileName}`,
      description: 'Could not parse JSON',
      preview: text || '',
    });
    return;
  }

  if (json.hooks) {
    for (const [event, matchers] of Object.entries(json.hooks)) {
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
  const dir = await safeGetDirectory(claudeDir, 'rules');
  if (!dir) return [];
  return scanFrontmatterFiles(dir, '.claude/rules', {
    predicate: (f) => f.name.endsWith('.md'),
    resolveName: (_meta, fileName) => fileName.replace(/\.md$/, ''),
    resolveDescription: (meta) => {
      const paths = meta.paths;
      return paths ? `Scoped to: ${Array.isArray(paths) ? paths.join(', ') : String(paths)}` : 'Applies unconditionally';
    },
  });
}

async function scanOutputStyles(claudeDir: FileSystemDirectoryHandle): Promise<ScanItem[]> {
  const dir = await safeGetDirectory(claudeDir, 'output-styles');
  if (!dir) return [];
  return scanFrontmatterFiles(dir, '.claude/output-styles', { predicate: (f) => f.name.endsWith('.md') });
}

function personName(value: string | PersonOrString | undefined): string | undefined {
  if (typeof value === 'string') return value;
  return value?.name;
}

// Plugin manifests can live anywhere a plugin is developed/vendored in the repo,
// not just under a fixed top-level folder.
async function scanPlugins(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const files = await walkFiles(root, '', (f) => f.path.endsWith('.claude-plugin/plugin.json'), DEFAULT_SKIP_DIRS);
  for (const f of files) {
    const text = await readText(f.handle);
    try {
      const json = JSON.parse(text) as ClaudePluginManifest;
      items.push({
        name: json.displayName || json.name || f.path,
        path: f.path,
        description: json.description || '',
        meta: {
          displayName: json.displayName,
          version: json.version,
          description: json.description,
          author: personName(json.author),
          license: json.license,
          homepage: json.homepage,
        },
      });
    } catch (e) {
      items.push({ name: f.path, path: f.path, description: 'Could not parse JSON', preview: text || '' });
    }
  }
}

async function scanMarketplaces(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const files = await walkFiles(root, '', (f) => f.path.endsWith('.claude-plugin/marketplace.json'), DEFAULT_SKIP_DIRS);
  for (const f of files) {
    const text = await readText(f.handle);
    try {
      const json = JSON.parse(text) as ClaudeMarketplaceManifest;
      items.push({
        name: json.name || f.path,
        path: f.path,
        description: json.description || '',
        meta: {
          owner: personName(json.owner),
          version: json.version,
          pluginCount: Array.isArray(json.plugins) ? json.plugins.length : undefined,
        },
      });
    } catch (e) {
      items.push({ name: f.path, path: f.path, description: 'Could not parse JSON', preview: text || '' });
    }
  }
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
    if (skillItems.length) sections.push({ key: 'skills', label: 'Skills', items: skillItems });

    const commandsDir = await safeGetDirectory(claudeDir, 'commands');
    if (commandsDir) {
      const items = await scanFrontmatterFiles(commandsDir, '.claude/commands', { predicate: (f) => f.name.endsWith('.md') });
      if (items.length) sections.push({ key: 'commands', label: 'Commands', items });
    }

    const agentsDir = await safeGetDirectory(claudeDir, 'agents');
    if (agentsDir) {
      const items = await scanFrontmatterFiles(agentsDir, '.claude/agents', { predicate: (f) => f.name.endsWith('.md') });
      if (items.length) sections.push({ key: 'agents', label: 'Agents', items });
    }

    ruleItems = await scanRules(claudeDir);
    outputStyleItems = await scanOutputStyles(claudeDir);

    const hookItems: ScanItem[] = [];
    const settingItems: ScanItem[] = [];
    await scanSettingsFile(claudeDir, 'settings.json', hookItems, settingItems);
    await scanSettingsFile(claudeDir, 'settings.local.json', hookItems, settingItems);
    if (hookItems.length) sections.push({ key: 'hooks', label: 'Hooks', items: hookItems });
    if (settingItems.length) sections.push({ key: 'settings', label: 'Settings', items: settingItems });
  }

  if (ruleItems.length) sections.push({ key: 'rules', label: 'Rules', items: ruleItems });
  if (outputStyleItems.length) sections.push({ key: 'outputStyles', label: 'Output Styles', items: outputStyleItems });

  const mcpItems: ScanItem[] = [];
  await scanMcpFile(root, '.mcp.json', '.mcp.json', mcpItems);
  if (claudeDir) await scanMcpFile(claudeDir, 'mcp.json', '.claude/mcp.json', mcpItems);
  if (mcpItems.length) {
    detected = true;
    sections.push({ key: 'mcpServers', label: 'MCP Servers', items: mcpItems });
  }

  const workflowItems: ScanItem[] = [];
  await scanWorkflows(root, workflowItems);
  workflowItems.push(...(await scanAgenticWorkflows(root, 'claude')));
  if (workflowItems.length) {
    detected = true;
    sections.push({ key: 'workflows', label: 'Workflows', items: workflowItems });
  }

  const pluginItems: ScanItem[] = [];
  await scanPlugins(root, pluginItems);
  if (pluginItems.length) {
    detected = true;
    sections.push({ key: 'plugins', label: 'Plugins', items: pluginItems });
  }

  const marketplaceItems: ScanItem[] = [];
  await scanMarketplaces(root, marketplaceItems);
  if (marketplaceItems.length) {
    detected = true;
    sections.push({ key: 'marketplaces', label: 'Marketplaces', items: marketplaceItems });
  }

  if (instructionItems.length) {
    sections.unshift({ key: 'instructions', label: 'Project Instructions', items: instructionItems });
  }

  await resolveCanonicalRefsForSections(root, sections);
  return { editor: 'claude-code', label: 'Claude Code', detected, sections };
}
