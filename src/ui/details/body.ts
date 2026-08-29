import { renderMarkdown } from '../../lib/markdown.js';
import { SECTION_BODY_TYPE } from '../../config/fieldSchemas.js';
import { escapeHtml } from '../htmlHelpers.js';
import type { RefNav } from './refNav.js';
import type { ScanItem, ScanSection } from '../../types.js';

/** Turns inline backtick-quoted `.agents/*.md` references inside a rendered markdown
 * body (they come out as plain `<code>` spans) into clickable jump-to-item links,
 * wherever the reference resolves to a scanned item somewhere in the current scan. */
function linkifyReferences(bodyEl: HTMLElement, item: ScanItem, nav: RefNav): void {
  const refs = item.canonicalRefs;
  if (!refs?.length) return;

  bodyEl.querySelectorAll('code').forEach((codeEl) => {
    const text = codeEl.textContent ?? '';
    const ref = refs.find((r) => r.raw === text);
    if (!ref) return;
    const target = nav.resolve(ref.path);
    if (!target) return;

    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'ref-link';
    link.title = `Jump to ${target.item.name} (${target.sectionLabel})`;
    link.innerHTML = `<code>${escapeHtml(text)}</code><i class="ti ti-arrow-right" aria-hidden="true"></i>`;
    link.addEventListener('click', () => nav.goTo(target));
    codeEl.replaceWith(link);
  });
}

/** Renders the item's main content — markdown for prose-y sections (skills,
 * commands, agents, rules...), a plain escaped code block for config/JSON-ish
 * sections — per `SECTION_BODY_TYPE`. Markdown bodies additionally get any inline
 * `.agents/*.md` references turned into jump-to-item links. */
export function renderBody(section: ScanSection, item: ScanItem, nav: RefNav): HTMLElement | null {
  if (!item.preview) return null;
  const bodyType = SECTION_BODY_TYPE[section.key] || 'none';

  if (bodyType === 'markdown') {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'details-body md-body';
    bodyEl.innerHTML = renderMarkdown(item.preview);
    linkifyReferences(bodyEl, item, nav);
    return bodyEl;
  }

  if (bodyType === 'code') {
    const codeEl = document.createElement('pre');
    codeEl.className = 'md-code details-body';
    codeEl.innerHTML = `<code>${escapeHtml(item.preview)}</code>`;
    return codeEl;
  }

  return null;
}
