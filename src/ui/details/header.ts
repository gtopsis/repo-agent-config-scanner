import { escapeHtml, iconEl } from '../htmlHelpers.js';
import type { CategoryMeta } from '../../config/categories.js';
import type { ScanItem, ScanResult, ScanSection } from '../../types.js';

/** The item's icon, breadcrumb, name, and path(s) — the one part of the panel that's
 * always shown regardless of section type. */
export function renderHeader(result: ScanResult, section: ScanSection, item: ScanItem, meta: CategoryMeta): HTMLElement {
  const header = document.createElement('div');
  header.className = 'details-header';
  header.innerHTML =
    iconEl(meta, 'lg') +
    `<div class="details-heading">` +
    `<div class="details-breadcrumb">${escapeHtml(result.label)} · ${escapeHtml(section.label)}</div>` +
    `<h2 class="details-name">${escapeHtml(item.name)}</h2>` +
    `<div class="details-path">${escapeHtml(item.path)}</div>` +
    (item.additionalPaths?.length
      ? `<div class="details-path details-path-extra">Also available via: ${item.additionalPaths.map(escapeHtml).join(', ')}</div>`
      : '') +
    `</div>`;
  return header;
}
