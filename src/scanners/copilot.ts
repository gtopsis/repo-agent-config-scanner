import { safeGetDirectory, safeGetFile, readText, walkFiles, DEFAULT_SKIP_DIRS } from '../lib/fsWalk.js';
import { scanFrontmatterFiles } from '../lib/scanFrontmatterFiles.js';
import { scanSkillsAcrossFolders } from '../lib/skills.js';
import { scanMcpFile } from '../lib/mcp.js';
import { scanAgenticWorkflows } from '../lib/agenticWorkflows.js';
import { resolveCanonicalRefsForSections } from '../lib/canonicalRefs.js';
import type { ScanItem, ScanResult } from '../types.js';

// AGENTS.md is a cross-tool standard Copilot's coding agent and code review both read,
// including nested per-directory copies for scoped guidance.
async function scanAgentsMd(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
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

// Copilot code review falls back to these cross-tool instruction files if present.
async function scanReviewFallbacks(root: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  for (const name of ['REVIEW.md', 'CLAUDE.md', 'GEMINI.md']) {
    const file = await safeGetFile(root, name);
    if (!file) continue;
    const text = await readText(file);
    items.push({
      name,
      path: name,
      description: 'Used as a code review instruction fallback',
      preview: text || '',
    });
  }
}

async function scanHooks(githubDir: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const hooksDir = await safeGetDirectory(githubDir, 'hooks');
  if (!hooksDir) return;
  const files = await walkFiles(hooksDir, '.github/hooks', (f) => f.name.endsWith('.json'));
  for (const f of files) {
    const text = await readText(f.handle);
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const hooksMap = (json.hooks && typeof json.hooks === 'object' ? json.hooks : json) as Record<string, unknown>;
      for (const [event, entries] of Object.entries(hooksMap)) {
        const list = Array.isArray(entries) ? entries : [entries];
        for (const entry of list) {
          if (!entry || typeof entry !== 'object') continue;
          const e = entry as { command?: string; matcher?: string; type?: string };
          items.push({
            name: `${event} — ${e.matcher ?? '*'}`,
            path: f.path,
            description: e.command || '',
            meta: { event, matcher: e.matcher ?? '*', type: e.type || 'command' },
          });
        }
      }
    } catch (err) {
      items.push({ name: f.name, path: f.path, description: 'Could not parse JSON', preview: text || '' });
    }
  }
}

async function scanCliSettings(githubDir: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const copilotDir = await safeGetDirectory(githubDir, 'copilot');
  if (!copilotDir) return;
  for (const fileName of ['settings.json', 'settings.local.json']) {
    const file = await safeGetFile(copilotDir, fileName);
    if (!file) continue;
    const text = await readText(file);
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      items.push({
        name: fileName,
        path: `.github/copilot/${fileName}`,
        description: fileName.includes('local') ? 'Personal override (should be gitignored)' : 'Shared CLI configuration',
        meta: json,
      });
    } catch (e) {
      items.push({
        name: fileName,
        path: `.github/copilot/${fileName}`,
        description: 'Could not parse JSON',
        preview: text || '',
      });
    }
  }
}

async function scanWorkflows(workflowsDir: FileSystemDirectoryHandle): Promise<ScanItem[]> {
  const items: ScanItem[] = [];
  const candidates: { fileNames: readonly string[]; name: string; description: string }[] = [
    {
      fileNames: ['copilot-setup-steps.yml', 'copilot-setup-steps.yaml'],
      name: 'copilot-setup-steps',
      description: 'Environment setup for the Copilot coding agent',
    },
    {
      fileNames: ['copilot-code-review.yml', 'copilot-code-review.yaml'],
      name: 'copilot-code-review',
      description: 'Environment setup for Copilot code review',
    },
  ];

  for (const { fileNames, name, description } of candidates) {
    let found: FileSystemFileHandle | null = null;
    let foundName = '';
    for (const fn of fileNames) {
      found = await safeGetFile(workflowsDir, fn);
      if (found) {
        foundName = fn;
        break;
      }
    }
    if (found) {
      const text = await readText(found);
      items.push({ name, path: `.github/workflows/${foundName}`, description, preview: text });
    }
  }

  return items;
}

export async function scanCopilot(root: FileSystemDirectoryHandle): Promise<ScanResult> {
  const sections: ScanResult['sections'] = [];
  let detected = false;

  const instructionItems: ScanItem[] = [];
  await scanAgentsMd(root, instructionItems);
  await scanReviewFallbacks(root, instructionItems);

  const skillItems = await scanSkillsAcrossFolders(root, ['.github', '.claude', '.agents']);

  const mcpItems: ScanItem[] = [];
  const vscodeDir = await safeGetDirectory(root, '.vscode');
  if (vscodeDir) await scanMcpFile(vscodeDir, 'mcp.json', '.vscode/mcp.json', mcpItems);
  await scanMcpFile(root, '.mcp.json', '.mcp.json', mcpItems);

  const githubDir = await safeGetDirectory(root, '.github');
  if (githubDir) {
    const instrFile = await safeGetFile(githubDir, 'copilot-instructions.md');
    if (instrFile) {
      detected = true;
      const text = await readText(instrFile);
      instructionItems.push({
        name: 'copilot-instructions.md',
        path: '.github/copilot-instructions.md',
        description: '',
        preview: text || '',
      });
    }

    await scanMcpFile(githubDir, 'mcp.json', '.github/mcp.json', mcpItems);

    const agentsDir = await safeGetDirectory(githubDir, 'agents');
    if (agentsDir) {
      const items = await scanFrontmatterFiles(agentsDir, '.github/agents', {
        predicate: (f) => f.name.endsWith('.md'),
        resolveName: (meta, fileName) => (meta.name as string) || fileName.replace(/\.agent\.md$|\.md$/, ''),
      });
      if (items.length) {
        detected = true;
        sections.push({ key: 'agents', label: 'Agents', items });
      }
    }

    const instructionsDir = await safeGetDirectory(githubDir, 'instructions');
    if (instructionsDir) {
      const suffix = '.instructions.md';
      const items = await scanFrontmatterFiles(instructionsDir, '.github/instructions', {
        predicate: (f) => f.name.endsWith(suffix),
        resolveName: (_meta, fileName) => fileName.slice(0, -suffix.length),
        resolveDescription: (meta) => (meta.applyTo ? `applyTo: ${meta.applyTo}` : ''),
      });
      if (items.length) {
        detected = true;
        sections.push({ key: 'pathInstructions', label: 'Path Instructions', items });
      }
    }

    const promptsDir = await safeGetDirectory(githubDir, 'prompts');
    if (promptsDir) {
      const suffix = '.prompt.md';
      const items = await scanFrontmatterFiles(promptsDir, '.github/prompts', {
        predicate: (f) => f.name.endsWith(suffix),
        resolveName: (_meta, fileName) => fileName.slice(0, -suffix.length),
      });
      if (items.length) {
        detected = true;
        sections.push({ key: 'prompts', label: 'Prompts', items });
      }
    }

    const chatmodesDir = await safeGetDirectory(githubDir, 'chatmodes');
    if (chatmodesDir) {
      const suffix = '.chatmode.md';
      const items = await scanFrontmatterFiles(chatmodesDir, '.github/chatmodes', {
        predicate: (f) => f.name.endsWith(suffix),
        resolveName: (_meta, fileName) => fileName.slice(0, -suffix.length),
      });
      if (items.length) {
        detected = true;
        sections.push({ key: 'chatmodes', label: 'Chat Modes', items });
      }
    }

    const workflowsDir = await safeGetDirectory(githubDir, 'workflows');
    const workflowItems = workflowsDir ? await scanWorkflows(workflowsDir) : [];
    workflowItems.push(...(await scanAgenticWorkflows(root, 'copilot')));
    if (workflowItems.length) {
      detected = true;
      sections.push({ key: 'workflows', label: 'Workflows', items: workflowItems });
    }

    const hookItems: ScanItem[] = [];
    await scanHooks(githubDir, hookItems);
    if (hookItems.length) {
      detected = true;
      sections.push({ key: 'hooks', label: 'Hooks', items: hookItems });
    }

    const settingItems: ScanItem[] = [];
    await scanCliSettings(githubDir, settingItems);
    if (settingItems.length) {
      detected = true;
      sections.push({ key: 'settings', label: 'Settings', items: settingItems });
    }
  }

  if (skillItems.length) {
    detected = true;
    sections.unshift({ key: 'skills', label: 'Skills', items: skillItems });
  }
  if (mcpItems.length) {
    detected = true;
    sections.push({ key: 'mcpServers', label: 'MCP Servers', items: mcpItems });
  }
  if (instructionItems.length) {
    detected = true;
    sections.unshift({ key: 'instructions', label: 'Project Instructions', items: instructionItems });
  }

  await resolveCanonicalRefsForSections(root, sections);
  return { editor: 'github-copilot', label: 'GitHub Copilot', detected, sections };
}
