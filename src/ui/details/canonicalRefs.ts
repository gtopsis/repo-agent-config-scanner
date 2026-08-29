import { renderMarkdown } from '../../lib/markdown.js';
import { escapeHtml, icon } from '../htmlHelpers.js';
import type { RefNav } from './refNav.js';
import type { ScanItem } from '../../types.js';

/** Renders each canonical `.agents/*.md` reference this item's body pointed at: a
 * clickable "jump to item" label when the reference resolves to something actually
 * tracked in the scan, or the plain static label + inlined content it's always shown
 * (unchanged) when it doesn't resolve to a tracked item. */
export function renderCanonicalRefs(item: ScanItem, nav: RefNav): HTMLElement[] {
  return (item.canonicalRefs ?? []).map((ref) => {
    const target = nav.resolve(ref.path);
    const refEl = document.createElement('div');
    refEl.className = ref.content ? 'canonical-ref' : 'canonical-ref canonical-ref-missing';

    const labelText = `Canonical source: ${escapeHtml(ref.path)}`;
    const labelHtml = target
      ? `<button type="button" class="canonical-ref-label canonical-ref-label-linked">` +
        `${icon('ti-git-merge')} ${labelText}` +
        `${icon('ti-arrow-right', 'canonical-ref-jump')}` +
        `</button>`
      : `<div class="canonical-ref-label">${icon('ti-git-merge')} ${labelText}</div>`;

    refEl.innerHTML =
      labelHtml +
      (ref.content
        ? `<div class="canonical-ref-body md-body">${renderMarkdown(ref.content)}</div>`
        : `<div class="canonical-ref-missing-text">Referenced file not found — the reference may be stale.</div>`);

    if (target) {
      refEl.querySelector('.canonical-ref-label-linked')?.addEventListener('click', () => nav.goTo(target));
    }

    return refEl;
  });
}
