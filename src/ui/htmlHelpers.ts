import type { CategoryMeta } from '../config/categories.js';
import type { FieldFormat } from '../config/fieldSchemas.js';

export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] as string);
}

export function formatValue(value: unknown, format?: FieldFormat): string | string[] | null {
  if (value === undefined || value === null || value === '') return null;
  if (format === 'bool') return value ? 'Yes' : 'No';
  if (format === 'list') {
    const arr = Array.isArray(value) ? (value as unknown[]) : String(value).split(',').map((s) => s.trim());
    const strArr = arr.map((v) => String(v));
    return strArr.filter(Boolean).length ? strArr : null;
  }
  if (format === 'kv' && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${v}`);
    return entries.length ? entries : null;
  }
  return String(value);
}

/** The one place that builds a Tabler icon's `<i>` markup — `extraClass` for an
 * additional CSS class (e.g. a chevron's rotation class), `style` for one-off
 * inline styling (e.g. a category color) that doesn't warrant its own class. */
export function icon(name: string, extraClass?: string, style?: string): string {
  const cls = extraClass ? `ti ${name} ${extraClass}` : `ti ${name}`;
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : '';
  return `<i class="${cls}"${styleAttr} aria-hidden="true"></i>`;
}

export function iconEl(meta: CategoryMeta, size: 'sm' | 'lg'): string {
  return `<span class="icon-badge ${size}">${icon(meta.icon)}</span>`;
}

/** The standard "nothing to show" placeholder, used anywhere a list/view has no
 * content yet. HTML-escapes `message` — not for contexts needing inline markup. */
export function emptyState(message: string): string {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

/** The "editor · section"-style label pairing shown next to an item in several
 * places (details header breadcrumb, search results, graph nodes). HTML-escaped
 * for `innerHTML` use — do not use for plain-text contexts like `.title` tooltips,
 * where escaping would show literal `&amp;` instead of `&`. */
export function metaLine(a: string, b: string): string {
  return `${escapeHtml(a)} · ${escapeHtml(b)}`;
}
