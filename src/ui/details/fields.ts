import { FIELD_SCHEMAS } from '../../config/fieldSchemas.js';
import { escapeHtml, formatValue } from '../htmlHelpers.js';
import type { ScanItem, ScanSection } from '../../types.js';

export interface FieldsResult {
  /** `null` when the section's schema has nothing to show for this item. */
  el: HTMLElement | null;
  /** Which `item.meta` keys the schema already displayed, so the raw-meta dump
   * can skip them and only show what's left over. */
  shownKeys: Set<string>;
}

/** Renders the labeled field rows declared for this section's type in
 * `FIELD_SCHEMAS` (e.g. a skill's `allowed-tools`, `license`), pulling each value
 * out of the item's raw frontmatter/config (`item.meta`). */
export function renderFields(section: ScanSection, item: ScanItem): FieldsResult {
  const schema = FIELD_SCHEMAS[section.key] || [];
  const shownKeys = new Set<string>();
  const fieldsEl = document.createElement('div');
  fieldsEl.className = 'details-fields';

  for (const field of schema) {
    const raw = item.meta ? item.meta[field.key] : undefined;
    const formatted = formatValue(raw, field.format);
    if (formatted === null) continue;
    shownKeys.add(field.key);

    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<div class="field-label">${escapeHtml(field.label)}</div>`;

    const value = document.createElement('div');
    value.className = 'field-value';
    if (Array.isArray(formatted)) {
      value.innerHTML = formatted.map((v) => `<span class="chip">${escapeHtml(v)}</span>`).join('');
    } else {
      value.textContent = formatted;
    }
    row.appendChild(value);
    fieldsEl.appendChild(row);
  }

  return { el: fieldsEl.children.length ? fieldsEl : null, shownKeys };
}
