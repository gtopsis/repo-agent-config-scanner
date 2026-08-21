import type { ScanResult, ScanSection } from '../types.js';

export interface CategoryMeta {
  icon: string;
  color: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  instructions: { icon: 'ti-file-text', color: 'gray' },
  skills: { icon: 'ti-puzzle', color: 'purple' },
  commands: { icon: 'ti-terminal-2', color: 'teal' },
  agents: { icon: 'ti-robot', color: 'coral' },
  hooks: { icon: 'ti-bolt', color: 'amber' },
  settings: { icon: 'ti-settings', color: 'gray' },
  mcpServers: { icon: 'ti-plug', color: 'blue' },
  pathInstructions: { icon: 'ti-file-text', color: 'teal' },
  prompts: { icon: 'ti-message-2', color: 'teal' },
  chatmodes: { icon: 'ti-adjustments', color: 'purple' },
  plugins: { icon: 'ti-code', color: 'pink' },
  rules: { icon: 'ti-list-check', color: 'green' },
  workflows: { icon: 'ti-git-branch', color: 'red' },
  outputStyles: { icon: 'ti-palette', color: 'indigo' },
  marketplaces: { icon: 'ti-building-store', color: 'cyan' },
  ignore: { icon: 'ti-eye-off', color: 'indigo' },
  environment: { icon: 'ti-cloud-cog', color: 'cyan' },
  tools: { icon: 'ti-tool', color: 'green' },
  interface: { icon: 'ti-palette', color: 'indigo' },
};

const DEFAULT_META: CategoryMeta = { icon: 'ti-file', color: 'gray' };

export function categoryMeta(key: string): CategoryMeta {
  return CATEGORY_META[key] || DEFAULT_META;
}

// Canonical display order: context (what the AI knows) → capabilities (what it can
// do) → automation (what runs on its own) → extensions/integrations → tuning/plumbing.
// Any section key not listed here sorts after everything that is.
const SECTION_ORDER: string[] = [
  'instructions',
  'pathInstructions',
  'rules',
  'skills',
  'commands',
  'prompts',
  'agents',
  'chatmodes',
  'hooks',
  'workflows',
  'plugins',
  'marketplaces',
  'tools',
  'mcpServers',
  'outputStyles',
  'interface',
  'environment',
  'ignore',
  'settings',
];

function sectionRank(key: string): number {
  const index = SECTION_ORDER.indexOf(key);
  return index === -1 ? SECTION_ORDER.length : index;
}

export function orderedSections(result: ScanResult): ScanSection[] {
  return [...result.sections].sort((a, b) => sectionRank(a.key) - sectionRank(b.key));
}
