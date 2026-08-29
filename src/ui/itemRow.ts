import { escapeHtml, iconEl } from './htmlHelpers.js';
import type { CategoryMeta } from '../config/categories.js';
import type { ScanItem, ScanSection } from '../types.js';

export interface FocusTarget {
  sectionKey: string;
  itemPath: string;
}

/** Builds one sidebar row for a scanned item — a pure DOM factory with no click
 * behavior of its own, independent of how the sidebar's groups are laid out or what
 * selecting a row should do, so the same row markup could be reused anywhere else
 * items need to be listed. */
export function buildItemRow(item: ScanItem, meta: CategoryMeta): HTMLButtonElement {
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
  return row;
}

/** Builds the foldable `<summary>` heading for one section's group of rows. */
export function buildGroupHeading(section: ScanSection, meta: CategoryMeta): HTMLElement {
  const heading = document.createElement('summary');
  heading.className = 'item-group-heading';
  heading.innerHTML =
    `<i class="ti ti-chevron-right chevron" aria-hidden="true"></i>` +
    `<i class="ti ${meta.icon}" style="color:var(--cat-${meta.color})" aria-hidden="true"></i>` +
    `<span>${escapeHtml(section.label)}</span>` +
    `<span class="item-group-count">${section.items.length}</span>`;
  return heading;
}

/** Whether an item is the one a caller asked to be focused on (e.g. jumping here
 * via a cross-reference), matching on the item's primary path or any of the other
 * locations it was also found at. */
export function matchesFocus(section: ScanSection, item: ScanItem, focus?: FocusTarget): boolean {
  if (!focus || section.key !== focus.sectionKey) return false;
  return item.path === focus.itemPath || item.additionalPaths?.includes(focus.itemPath) === true;
}
