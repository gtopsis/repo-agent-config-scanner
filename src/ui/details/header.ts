import { escapeHtml, iconEl } from '../htmlHelpers.js';
import { formatItemMarkdown } from '../../lib/exportMarkdown.js';
import type { CategoryMeta } from '../../config/categories.js';
import type { ScanItem, ScanResult, ScanSection } from '../../types.js';

const COPY_ICON = 'ti-copy';
const COPIED_ICON = 'ti-check';
const COPIED_RESET_MS = 1500;

/** A "Copy as Markdown" button for the current item — writes to the clipboard via
 * `window.navigator.clipboard` explicitly (not just `navigator`), since this module
 * is used alongside code elsewhere in the app that names a local variable
 * `navigator` for the unrelated cross-reference Navigator — using the fully
 * qualified global avoids any ambiguity between the two. */
function buildCopyButton(result: ScanResult, section: ScanSection, item: ScanItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-btn';
  button.title = 'Copy as Markdown';
  button.innerHTML = `<i class="ti ${COPY_ICON}" aria-hidden="true"></i>`;

  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', async () => {
    try {
      await window.navigator.clipboard.writeText(formatItemMarkdown(result, section, item));
      button.classList.add('copied');
      button.innerHTML = `<i class="ti ${COPIED_ICON}" aria-hidden="true"></i>`;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = `<i class="ti ${COPY_ICON}" aria-hidden="true"></i>`;
      }, COPIED_RESET_MS);
    } catch (e) {
      console.error('Copy to clipboard failed', e);
    }
  });

  return button;
}

/** The item's icon, breadcrumb, name, path(s), and a copy-as-markdown action — the
 * one part of the panel that's always shown regardless of section type. */
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
  header.appendChild(buildCopyButton(result, section, item));
  return header;
}
