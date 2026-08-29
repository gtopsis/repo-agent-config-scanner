import { categoryMeta, orderedSections } from '../config/categories.js';
import { escapeHtml, iconEl } from './htmlHelpers.js';
import type { CategoryMeta } from '../config/categories.js';
import type { DetailsPanel } from './detailsPanel.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

export interface ItemList {
  render(result: ScanResult, focus?: FocusTarget): void;
}

export interface FocusTarget {
  sectionKey: string;
  itemPath: string;
}

interface FirstItem {
  row: HTMLButtonElement;
  section: ScanSection;
  item: ScanItem;
  meta: CategoryMeta;
}

/** Owns rendering the sidebar's foldable category groups and item rows for whichever
 * editor is currently selected, and wires row selection through to the details panel. */
export function createItemList(itemList: HTMLElement, layout: HTMLElement, detailsPanel: DetailsPanel): ItemList {
  function render(result: ScanResult, focus?: FocusTarget): void {
    itemList.innerHTML = '';
    layout.classList.remove('showing-details');

    if (!result.detected || result.sections.length === 0) {
      itemList.innerHTML = `<div class="empty-state">No ${escapeHtml(result.label)} configuration found.</div>`;
      detailsPanel.renderEmpty('Nothing to show for this editor.');
      return;
    }

    const sortedSections = orderedSections(result);
    let first: FirstItem | null = null;
    let focused: FirstItem | null = null;

    for (const section of sortedSections) {
      const meta = categoryMeta(section.key);

      const group = document.createElement('details');
      group.className = 'section-group';
      group.dataset.sectionKey = section.key;
      group.open = true;

      const heading = document.createElement('summary');
      heading.className = 'item-group-heading';
      heading.innerHTML =
        `<i class="ti ti-chevron-right chevron" aria-hidden="true"></i>` +
        `<i class="ti ${meta.icon}" style="color:var(--cat-${meta.color})" aria-hidden="true"></i>` +
        `<span>${escapeHtml(section.label)}</span>` +
        `<span class="item-group-count">${section.items.length}</span>`;
      group.appendChild(heading);

      const itemsWrap = document.createElement('div');
      itemsWrap.className = 'section-items';

      for (const item of section.items) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'item-row';
        row.style.setProperty('--accent', `var(--cat-${meta.color})`);
        row.style.setProperty('--accent-bg', `var(--cat-${meta.color}-bg)`);
        row.innerHTML =
          iconEl(meta, 'sm') +
          `<span class="item-row-text">` +
          `<span class="item-row-name">${escapeHtml(item.name)}</span>` +
          (item.description ? `<span class="item-row-desc">${escapeHtml(item.description)}</span>` : '') +
          `</span>`;
        row.addEventListener('click', () => {
          itemList.querySelectorAll('.item-row.active').forEach((r) => r.classList.remove('active'));
          row.classList.add('active');
          detailsPanel.render(result, section, item, meta);
          layout.classList.add('showing-details');
        });
        itemsWrap.appendChild(row);

        if (!first) first = { row, section, item, meta };
        if (
          focus &&
          section.key === focus.sectionKey &&
          (item.path === focus.itemPath || item.additionalPaths?.includes(focus.itemPath))
        ) {
          focused = { row, section, item, meta };
        }
      }

      group.appendChild(itemsWrap);
      itemList.appendChild(group);
    }

    const selected = focused ?? first;
    if (selected) {
      selected.row.classList.add('active');
      detailsPanel.render(result, selected.section, selected.item, selected.meta);
      if (focused) {
        selected.row.scrollIntoView({ block: 'nearest' });
        layout.classList.add('showing-details');
      }
    }
  }

  return { render };
}
