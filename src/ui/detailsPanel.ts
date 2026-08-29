import { icon, emptyState } from './htmlHelpers.js';
import { renderHeader } from './details/header.js';
import { renderFields } from './details/fields.js';
import { renderHookCommand } from './details/hookCommand.js';
import { renderRawMeta } from './details/rawMeta.js';
import { renderBody } from './details/body.js';
import { renderCanonicalRefs } from './details/canonicalRefs.js';
import type { RefNav } from './details/refNav.js';
import type { CategoryMeta } from '../config/categories.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

export type { RefNav } from './details/refNav.js';

export interface DetailsPanel {
  render(result: ScanResult, section: ScanSection, item: ScanItem, meta: CategoryMeta): void;
  renderEmpty(message: string): void;
}

/** Owns rendering the details panel for whichever item is currently selected —
 * clears and rebuilds it from a fixed sequence of independent sub-renderers (each
 * responsible for one part of the panel: header, schema fields, body, etc.), rather
 * than building the whole thing inline. */
export function createDetailsPanel(details: HTMLElement, layout: HTMLElement, nav: RefNav): DetailsPanel {
  function render(result: ScanResult, section: ScanSection, item: ScanItem, meta: CategoryMeta): void {
    details.innerHTML = '';
    details.style.setProperty('--accent', `var(--cat-${meta.color})`);
    details.style.setProperty('--accent-bg', `var(--cat-${meta.color}-bg)`);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'details-back';
    backBtn.innerHTML = `${icon('ti-arrow-left')} Back to list`;
    backBtn.addEventListener('click', () => layout.classList.remove('showing-details'));
    details.appendChild(backBtn);

    details.appendChild(renderHeader(result, section, item, meta));

    const fields = renderFields(section, item);
    if (fields.el) details.appendChild(fields.el);

    const hookCommand = renderHookCommand(section, item);
    if (hookCommand) details.appendChild(hookCommand);

    const rawMeta = renderRawMeta(item, fields.shownKeys);
    if (rawMeta) details.appendChild(rawMeta);

    const body = renderBody(section, item, nav);
    if (body) details.appendChild(body);

    for (const refEl of renderCanonicalRefs(item, nav)) details.appendChild(refEl);
  }

  function renderEmpty(message: string): void {
    details.innerHTML = emptyState(message);
  }

  return { render, renderEmpty };
}
