import { safeGetDirectory, safeGetFile, readText, walkFiles, DEFAULT_SKIP_DIRS } from '../lib/fsWalk.js';
import { scanSkillsAcrossFolders } from '../lib/skills.js';
import { scanMcpFile } from '../lib/mcp.js';
import { scanAgenticWorkflows } from '../lib/agenticWorkflows.js';
import { resolveCanonicalRefsForSections } from '../lib/canonicalRefs.js';
import { readJsonSafe, jsonParseErrorItem, parseJsonOrNull } from '../lib/jsonFile.js';
import { pushSection, unshiftSection, scanFrontmatterSection } from '../lib/sections.js';
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
    const json = parseJsonOrNull<Record<string, unknown>>(text);
    if (!json) {
      items.push(jsonParseErrorItem(f.name, f.path, text));
      continue;
    }
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
  }
}

async function scanCliSettings(githubDir: FileSystemDirectoryHandle, items: ScanItem[]): Promise<void> {
  const copilotDir = await safeGetDirectory(githubDir, 'copilot');
  if (!copilotDir) return;
  for (const fileName of ['settings.json', 'settings.local.json']) {
    const path = `.github/copilot/${fileName}`;
    const result = await readJsonSafe(copilotDir, fileName);
    if (!result) continue;
    if (result.parseError) {
      items.push(jsonParseErrorItem(fileName, path, result.text));
      continue;
    }
    items.push({
      name: fileName,
      path,
      description: fileName.includes('local') ? 'Personal override (should be gitignored)' : 'Shared CLI configuration',
      meta: result.json,
    });
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

    const agentItems = await scanFrontmatterSection(githubDir, 'agents', '.github/agents', {
      predicate: (f) => f.name.endsWith('.md'),
      resolveName: (meta, fileName) => (meta.name as string) || fileName.replace(/\.agent\.md$|\.md$/, ''),
    });
    if (agentItems.length) detected = true;
    pushSection(sections, 'agents', 'Agents', agentItems);

    const pathInstructionSuffix = '.instructions.md';
    const pathInstructionItems = await scanFrontmatterSection(githubDir, 'instructions', '.github/instructions', {
      predicate: (f) => f.name.endsWith(pathInstructionSuffix),
      resolveName: (_meta, fileName) => fileName.slice(0, -pathInstructionSuffix.length),
      resolveDescription: (meta) => (meta.applyTo ? `applyTo: ${meta.applyTo}` : ''),
    });
    if (pathInstructionItems.length) detected = true;
    pushSection(sections, 'pathInstructions', 'Path Instructions', pathInstructionItems);

    const promptSuffix = '.prompt.md';
    const promptItems = await scanFrontmatterSection(githubDir, 'prompts', '.github/prompts', {
      predicate: (f) => f.name.endsWith(promptSuffix),
      resolveName: (_meta, fileName) => fileName.slice(0, -promptSuffix.length),
    });
    if (promptItems.length) detected = true;
    pushSection(sections, 'prompts', 'Prompts', promptItems);

    const chatmodeSuffix = '.chatmode.md';
    const chatmodeItems = await scanFrontmatterSection(githubDir, 'chatmodes', '.github/chatmodes', {
      predicate: (f) => f.name.endsWith(chatmodeSuffix),
      resolveName: (_meta, fileName) => fileName.slice(0, -chatmodeSuffix.length),
    });
    if (chatmodeItems.length) detected = true;
    pushSection(sections, 'chatmodes', 'Chat Modes', chatmodeItems);

    const workflowsDir = await safeGetDirectory(githubDir, 'workflows');
    const workflowItems = workflowsDir ? await scanWorkflows(workflowsDir) : [];
    workflowItems.push(...(await scanAgenticWorkflows(root, 'copilot')));
    if (workflowItems.length) detected = true;
    pushSection(sections, 'workflows', 'Workflows', workflowItems);

    const hookItems: ScanItem[] = [];
    await scanHooks(githubDir, hookItems);
    if (hookItems.length) detected = true;
    pushSection(sections, 'hooks', 'Hooks', hookItems);

    const settingItems: ScanItem[] = [];
    await scanCliSettings(githubDir, settingItems);
    if (settingItems.length) detected = true;
    pushSection(sections, 'settings', 'Settings', settingItems);
  }

  if (skillItems.length) detected = true;
  unshiftSection(sections, 'skills', 'Skills', skillItems);
  if (mcpItems.length) detected = true;
  pushSection(sections, 'mcpServers', 'MCP Servers', mcpItems);
  if (instructionItems.length) detected = true;
  unshiftSection(sections, 'instructions', 'Project Instructions', instructionItems);

  await resolveCanonicalRefsForSections(root, sections);
  return { editor: 'github-copilot', label: 'GitHub Copilot', detected, sections };
}
