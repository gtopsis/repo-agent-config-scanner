import { allTargets } from './itemIndex.js';
import type { ItemTarget } from './itemIndex.js';
import type { ScanResult } from '../types.js';

/** Section keys worth comparing across editors — ones a team would plausibly want
 * to keep in sync, unlike purely editor-specific plumbing (settings, plugins,
 * output styles, etc.) that was never expected to match across tools. */
export const DIFF_SECTION_KEYS = ['skills', 'commands', 'agents', 'rules', 'mcpServers'] as const;

const SECTION_LABELS: Record<string, string> = {
  skills: 'Skills',
  commands: 'Commands',
  agents: 'Agents',
  rules: 'Rules',
  mcpServers: 'MCP Servers',
};

export interface DiffRow {
  name: string;
  /** Keyed by editor id; present only for editors that have an item with this name
   * in this section. */
  targets: Partial<Record<string, ItemTarget>>;
}

export interface DiffTable {
  sectionKey: string;
  label: string;
  editors: { editor: string; label: string }[];
  rows: DiffRow[];
}

/** Builds one presence-matrix table per curated section key: rows are the union of
 * item names found in that section across all editors, columns are every known
 * editor (even ones with zero items at all, so a fully-missing section is as
 * visible as a partially-missing one). Matches purely by name within a section —
 * same-named items across editors are assumed to be "the same thing" for
 * comparison purposes. Sections with no items anywhere are dropped entirely. */
export function computeDiffTables(results: ScanResult[], allEditors: { editor: string; label: string }[]): DiffTable[] {
  const targets = allTargets(results);

  return DIFF_SECTION_KEYS.map((sectionKey): DiffTable => {
    const rowsByName = new Map<string, DiffRow>();
    for (const target of targets) {
      if (target.sectionKey !== sectionKey) continue;
      let row = rowsByName.get(target.item.name);
      if (!row) {
        row = { name: target.item.name, targets: {} };
        rowsByName.set(target.item.name, row);
      }
      row.targets[target.editor] = target;
    }

    const rows = [...rowsByName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );

    return { sectionKey, label: SECTION_LABELS[sectionKey] || sectionKey, editors: allEditors, rows };
  }).filter((table) => table.rows.length > 0);
}
