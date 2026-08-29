import { safeGetDirectory, safeGetFile, readText, walkFiles } from '../lib/fsWalk.js';
import { scanFrontmatterFiles } from '../lib/scanFrontmatterFiles.js';
import { scanSkillsAcrossFolders } from '../lib/skills.js';
import { extractMcpServers, describeMcpServer } from '../lib/mcp.js';
import { parseJsonc } from '../lib/jsonc.js';
import { resolveCanonicalRefsForSections } from '../lib/canonicalRefs.js';
import type { ScanItem, ScanResult } from '../types.js';

const HOOK_EVENT_PATTERN =
  /\b(?:tool\.execute\.\w+|session\.\w+|message\.\w+|permission\.\w+|command\.executed|file\.\w+|shell\.env|server\.connected|installation\.updated|lsp\.\w+|tui\.\w+|experimental\.\w+)\b/g;

interface OpencodeAgentOrCommand {
  description?: string;
  [key: string]: unknown;
}

interface OpencodeConfigJson {
  mcp?: Record<string, unknown>;
  agent?: Record<string, OpencodeAgentOrCommand>;
  command?: Record<string, OpencodeAgentOrCommand>;
  instructions?: string[];
  experimental?: { policies?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

type LoadedConfig =
  | { name: string; json: OpencodeConfigJson; error?: false }
  | { name: string; error: true; text: string };

async function loadConfig(root: FileSystemDirectoryHandle): Promise<LoadedConfig | null> {
  for (const name of ['opencode.json', 'opencode.jsonc']) {
    const file = await safeGetFile(root, name);
    if (!file) continue;
    const text = await readText(file);
    try {
      return { name, json: parseJsonc<OpencodeConfigJson>(text) };
    } catch (e) {
      return { name, error: true, text };
    }
  }
  return null;
}

async function scanTools(opencodeDir: FileSystemDirectoryHandle): Promise<ScanItem[]> {
  const dir = await safeGetDirectory(opencodeDir, 'tools');
  if (!dir) return [];
  const files = await walkFiles(dir, '.opencode/tools', (f) => /\.(js|ts)$/.test(f.name));
  const items: ScanItem[] = [];
  for (const f of files) {
    const text = await readText(f.handle);
    items.push({
      name: f.name.replace(/\.(js|ts)$/, ''),
      path: f.path,
      description: 'Custom tool',
      preview: text || '',
    });
  }
  return items;
}

interface TuiJson {
  theme?: string;
  keybinds?: Record<string, unknown>;
  [key: string]: unknown;
}

async function scanInterface(root: FileSystemDirectoryHandle, opencodeDir: FileSystemDirectoryHandle | null): Promise<ScanItem[]> {
  const items: ScanItem[] = [];

  const tuiFile = await safeGetFile(root, 'tui.json');
  if (tuiFile) {
    const text = await readText(tuiFile);
    try {
      const json = JSON.parse(text) as TuiJson;
      const keybindCount = json.keybinds ? Object.keys(json.keybinds).length : undefined;
      items.push({
        name: 'tui.json',
        path: 'tui.json',
        description: json.theme ? `Theme: ${json.theme}` : '',
        meta: { theme: json.theme, keybindCount },
      });
    } catch (e) {
      items.push({ name: 'tui.json', path: 'tui.json', description: 'Could not parse JSON', preview: text || '' });
    }
  }

  if (opencodeDir) {
    const themesDir = await safeGetDirectory(opencodeDir, 'themes');
    if (themesDir) {
      const files = await walkFiles(themesDir, '.opencode/themes', (f) => f.name.endsWith('.json'));
      for (const f of files) {
        const text = await readText(f.handle);
        items.push({
          name: f.name.replace(/\.json$/, ''),
          path: f.path,
          description: 'Custom theme',
          preview: text || '',
        });
      }
    }
  }

  return items;
}

const KNOWN_CONFIG_KEYS: Record<string, string> = {
  formatter: 'Formatters',
  lsp: 'LSP Servers',
  permission: 'Permissions',
};

export async function scanOpencode(root: FileSystemDirectoryHandle): Promise<ScanResult> {
  let detected = false;

  const instructionItems: ScanItem[] = [];
  const agentItems: ScanItem[] = [];
  const commandItems: ScanItem[] = [];
  const pluginItems: ScanItem[] = [];
  const mcpItems: ScanItem[] = [];
  const settingItems: ScanItem[] = [];

  const agentsMdHandle = await safeGetFile(root, 'AGENTS.md');
  if (agentsMdHandle) {
    detected = true;
    const text = await readText(agentsMdHandle);
    instructionItems.push({
      name: 'AGENTS.md',
      path: 'AGENTS.md',
      description: '',
      preview: text || '',
    });
  }

  const opencodeDir = await safeGetDirectory(root, '.opencode');
  let toolItems: ScanItem[] = [];

  if (opencodeDir) {
    detected = true;

    const agentsDir = await safeGetDirectory(opencodeDir, 'agents');
    if (agentsDir) {
      agentItems.push(...(await scanFrontmatterFiles(agentsDir, '.opencode/agents', { predicate: (f) => f.name.endsWith('.md') })));
    }

    const commandsDir = await safeGetDirectory(opencodeDir, 'commands');
    if (commandsDir) {
      commandItems.push(
        ...(await scanFrontmatterFiles(commandsDir, '.opencode/commands', { predicate: (f) => f.name.endsWith('.md') })),
      );
    }

    const pluginsDir = await safeGetDirectory(opencodeDir, 'plugins');
    if (pluginsDir) {
      const files = await walkFiles(pluginsDir, '.opencode/plugins', (f) => /\.(js|mjs|ts)$/.test(f.name));
      for (const f of files) {
        const text = await readText(f.handle);
        const events = [...new Set((text || '').match(HOOK_EVENT_PATTERN) || [])];
        pluginItems.push({
          name: f.name,
          path: f.path,
          description: events.length ? `Hooks into: ${events.join(', ')}` : '',
          meta: events.length ? { events } : undefined,
          preview: text || '',
        });
      }
    }

    toolItems = await scanTools(opencodeDir);
  }

  const skillItems = await scanSkillsAcrossFolders(root, ['.opencode', '.claude', '.agents']);
  const interfaceItems = await scanInterface(root, opencodeDir);

  const config = await loadConfig(root);
  if (config) {
    detected = true;

    if (config.error) {
      settingItems.push({
        name: config.name,
        path: config.name,
        description: 'Could not parse JSON',
        preview: config.text || '',
      });
    } else {
      const json = config.json || {};

      for (const [name, cfg] of Object.entries(extractMcpServers(json as Record<string, unknown>, 'mcp'))) {
        mcpItems.push({ name, path: config.name, description: describeMcpServer(cfg), meta: cfg });
      }

      for (const [name, cfg] of Object.entries(json.agent || {})) {
        agentItems.push({
          name,
          path: `${config.name} → agent.${name}`,
          description: cfg.description || '',
          meta: cfg,
        });
      }

      for (const [name, cfg] of Object.entries(json.command || {})) {
        commandItems.push({
          name,
          path: `${config.name} → command.${name}`,
          description: cfg.description || '',
          meta: cfg,
        });
      }

      if (Array.isArray(json.instructions)) {
        for (const source of json.instructions) {
          instructionItems.push({
            name: source,
            path: source,
            description: 'Additional instruction source',
          });
        }
      }

      for (const [key, label] of Object.entries(KNOWN_CONFIG_KEYS)) {
        if (!(key in json)) continue;
        const value = json[key];
        settingItems.push({
          name: label,
          path: config.name,
          description: '',
          meta: typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : { value },
        });
      }

      if (json.experimental?.policies) {
        settingItems.push({
          name: 'Experimental Policies',
          path: config.name,
          description: 'Controls which LLM providers may be used',
          meta: { policies: json.experimental.policies },
        });
      }

      const handledKeys = new Set(['mcp', 'agent', 'command', 'instructions', ...Object.keys(KNOWN_CONFIG_KEYS)]);
      const otherKeys = Object.keys(json).filter((k) => !handledKeys.has(k));
      if (otherKeys.length) {
        settingItems.push({
          name: `${config.name} (other settings)`,
          path: config.name,
          description: otherKeys.join(', '),
          meta: Object.fromEntries(otherKeys.map((k) => [k, json[k]])),
        });
      }
    }
  }

  const sections: ScanResult['sections'] = [];
  if (instructionItems.length) sections.push({ key: 'instructions', label: 'Project Instructions', items: instructionItems });
  if (skillItems.length) sections.push({ key: 'skills', label: 'Skills', items: skillItems });
  if (agentItems.length) sections.push({ key: 'agents', label: 'Agents', items: agentItems });
  if (commandItems.length) sections.push({ key: 'commands', label: 'Commands', items: commandItems });
  if (toolItems.length) sections.push({ key: 'tools', label: 'Custom Tools', items: toolItems });
  if (pluginItems.length) sections.push({ key: 'plugins', label: 'Plugins', items: pluginItems });
  if (interfaceItems.length) sections.push({ key: 'interface', label: 'Interface', items: interfaceItems });
  if (mcpItems.length) sections.push({ key: 'mcpServers', label: 'MCP Servers', items: mcpItems });
  if (settingItems.length) sections.push({ key: 'settings', label: 'Settings', items: settingItems });

  await resolveCanonicalRefsForSections(root, sections);
  return { editor: 'opencode', label: 'OpenCode', detected, sections };
}
