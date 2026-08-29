import { SECTION_BODY_TYPE } from '../config/fieldSchemas.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

/** Formats one scanned item as a standalone Markdown document — heading, editor/
 * section/path context, description, and body (as-is for markdown-bodied sections,
 * fenced for code-bodied ones) — suitable for pasting into a PR description, issue,
 * or doc. Used by the details panel's "Copy as Markdown" button. */
export function formatItemMarkdown(result: ScanResult, section: ScanSection, item: ScanItem): string {
  const lines: string[] = [`# ${item.name}`, '', `_${result.label} · ${section.label} · \`${item.path}\`_`];

  if (item.additionalPaths?.length) {
    lines.push('', `Also available via: ${item.additionalPaths.map((p) => `\`${p}\``).join(', ')}`);
  }

  if (item.description) {
    lines.push('', item.description);
  }

  if (item.preview) {
    const bodyType = SECTION_BODY_TYPE[section.key] || 'none';
    lines.push('', ...(bodyType === 'code' ? ['```', item.preview, '```'] : [item.preview]));
  }

  return lines.join('\n');
}
