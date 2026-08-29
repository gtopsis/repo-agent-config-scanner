import { escapeHtml } from '../htmlHelpers.js';
import type { ScanItem } from '../../types.js';

/** A collapsible dump of whatever's left in `item.meta` after the section's schema
 * already surfaced its known fields — keeps unrecognized/tool-specific keys visible
 * without needing a dedicated field-schema entry for every possible one. */
export function renderRawMeta(item: ScanItem, shownKeys: Set<string>): HTMLElement | null {
  const otherKeys = item.meta ? Object.keys(item.meta).filter((k) => !shownKeys.has(k)) : [];
  if (!otherKeys.length) return null;

  const rawDetails = document.createElement('details');
  rawDetails.className = 'raw-meta';
  const otherObj = Object.fromEntries(otherKeys.map((k) => [k, item.meta![k]]));
  rawDetails.innerHTML = `<summary>Other fields</summary><pre>${escapeHtml(JSON.stringify(otherObj, null, 2))}</pre>`;
  return rawDetails;
}
