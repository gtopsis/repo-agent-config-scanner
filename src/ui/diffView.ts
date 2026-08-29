import { computeDiffTables } from '../lib/diff.js';
import { categoryMeta } from '../config/categories.js';
import { escapeHtml, icon, emptyState } from './htmlHelpers.js';
import type { DiffTable } from '../lib/diff.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ScanResult } from '../types.js';

export interface DiffView {
  render(results: ScanResult[], allEditors: { editor: string; label: string }[]): void;
}

/** Builds one section's presence-matrix table: a heading, then a `<table>` with one
 * column per editor and one row per item name, a checkmark button where that editor
 * has a matching item (clickable — jumps to it), a plain dash where it doesn't. */
function buildDiffTable(table: DiffTable, onSelect: (target: ItemTarget) => void): HTMLElement {
  const meta = categoryMeta(table.sectionKey);
  const section = document.createElement('section');
  section.className = 'diff-table-section';
  section.style.setProperty('--accent', `var(--cat-${meta.color})`);

  const heading = document.createElement('h3');
  heading.className = 'diff-table-heading';
  heading.innerHTML = `${icon(meta.icon)} ${escapeHtml(table.label)}`;
  section.appendChild(heading);

  const tableEl = document.createElement('table');
  tableEl.className = 'diff-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>Name</th>${table.editors.map((e) => `<th>${escapeHtml(e.label)}</th>`).join('')}</tr>`;
  tableEl.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of table.rows) {
    const tr = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.className = 'diff-name-cell';
    nameCell.textContent = row.name;
    tr.appendChild(nameCell);

    for (const editor of table.editors) {
      const target = row.targets[editor.editor];
      const td = document.createElement('td');
      td.className = 'diff-cell';
      if (target) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'diff-present';
        btn.title = target.item.path;
        btn.innerHTML = icon('ti-check');
        btn.addEventListener('click', () => onSelect(target));
        td.appendChild(btn);
      } else {
        td.innerHTML = `<span class="diff-absent" aria-hidden="true">—</span>`;
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
  tableEl.appendChild(tbody);
  section.appendChild(tableEl);

  return section;
}

/** Renders a presence-matrix table per curated section (skills/commands/agents/
 * rules/mcpServers): rows are item names, columns are editors, a checkmark means
 * that editor has an item with that name in that section — so drift between tools
 * (configured in one, missing in another) is visible at a glance. */
export function createDiffView(container: HTMLElement, onSelect: (target: ItemTarget) => void): DiffView {
  function render(results: ScanResult[], allEditors: { editor: string; label: string }[]): void {
    container.innerHTML = '';
    const tables = computeDiffTables(results, allEditors);

    if (!tables.length) {
      container.innerHTML = emptyState('Nothing to compare yet — pick a project with at least one skill, command, agent, rule, or MCP server.');
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'diff-wrap';
    for (const table of tables) wrap.appendChild(buildDiffTable(table, onSelect));
    container.appendChild(wrap);
  }

  return { render };
}
