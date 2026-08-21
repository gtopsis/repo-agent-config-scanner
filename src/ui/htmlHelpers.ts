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

export function iconEl(meta: CategoryMeta, size: 'sm' | 'lg'): string {
  return `<span class="icon-badge ${size}"><i class="ti ${meta.icon}" aria-hidden="true"></i></span>`;
}
