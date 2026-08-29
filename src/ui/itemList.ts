import { categoryMeta, orderedSections } from '../config/categories.js';
import { emptyState } from './htmlHelpers.js';
import { buildItemRow, buildGroupHeading, matchesFocus } from './itemRow.js';
import type { FocusTarget } from './itemRow.js';
import type { CategoryMeta } from '../config/categories.js';
import type { DetailsPanel } from './detailsPanel.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

export type { FocusTarget } from './itemRow.js';

export interface ItemList {
  render(result: ScanResult, focus?: FocusTarget): void;
}

interface SelectableRow {
  row: HTMLButtonElement;
  section: ScanSection;
  item: ScanItem;
  meta: CategoryMeta;
}

/** Owns rendering the sidebar's foldable category groups and item rows for whichever
 * editor is currently selected, and wires row selection through to the details panel. */
export function createItemList(itemList: HTMLElement, layout: HTMLElement, detailsPanel: DetailsPanel): ItemList {
  function selectRow(result: ScanResult, target: SelectableRow, scrollIntoView: boolean): void {
    itemList.querySelectorAll('.item-row.active').forEach((r) => r.classList.remove('active'));
    target.row.classList.add('active');
    detailsPanel.render(result, target.section, target.item, target.meta);
    layout.classList.add('showing-details');
    if (scrollIntoView) target.row.scrollIntoView({ block: 'nearest' });
  }

  function render(result: ScanResult, focus?: FocusTarget): void {
    itemList.innerHTML = '';
    layout.classList.remove('showing-details');

    if (!result.detected || result.sections.length === 0) {
      itemList.innerHTML = emptyState(`No ${result.label} configuration found.`);
      detailsPanel.renderEmpty('Nothing to show for this editor.');
      return;
    }

    let first: SelectableRow | null = null;
    let focused: SelectableRow | null = null;

    for (const section of orderedSections(result)) {
      const meta = categoryMeta(section.key);

      const group = document.createElement('details');
      group.className = 'section-group';
      group.dataset.sectionKey = section.key;
      group.open = true;
      group.appendChild(buildGroupHeading(section, meta));

      const itemsWrap = document.createElement('div');
      itemsWrap.className = 'section-items';

      for (const item of section.items) {
        const row = buildItemRow(item, meta);
        const entry: SelectableRow = { row, section, item, meta };
        row.addEventListener('click', () => selectRow(result, entry, false));
        itemsWrap.appendChild(row);

        if (!first) first = entry;
        if (matchesFocus(section, item, focus)) focused = entry;
      }

      group.appendChild(itemsWrap);
      itemList.appendChild(group);
    }

    const selected = focused ?? first;
    if (selected) selectRow(result, selected, /* scrollIntoView */ !!focused);
  }

  return { render };
}
