import { computeDiffTables } from '../lib/diff.js';
import { categoryMeta } from '../config/categories.js';
import { escapeHtml } from './htmlHelpers.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ScanResult } from '../types.js';

export interface DiffView {
  render(results: ScanResult[], allEditors: { editor: string; label: string }[]): void;
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
      container.innerHTML = `<div class="empty-state">Nothing to compare yet — pick a project with at least one skill, command, agent, rule, or MCP server.</div>`;
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'diff-wrap';

    for (const table of tables) {
      const meta = categoryMeta(table.sectionKey);
      const section = document.createElement('section');
      section.className = 'diff-table-section';
      section.style.setProperty('--accent', `var(--cat-${meta.color})`);

      const heading = document.createElement('h3');
      heading.className = 'diff-table-heading';
      heading.innerHTML = `<i class="ti ${meta.icon}" aria-hidden="true"></i> ${escapeHtml(table.label)}`;
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
            btn.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i>`;
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
      wrap.appendChild(section);
    }

    container.appendChild(wrap);
  }

  return { render };
}
