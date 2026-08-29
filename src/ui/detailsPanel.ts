import { renderMarkdown } from '../lib/markdown.js';
import { FIELD_SCHEMAS, SECTION_BODY_TYPE } from '../config/fieldSchemas.js';
import { escapeHtml, formatValue, iconEl } from './htmlHelpers.js';
import type { CategoryMeta } from '../config/categories.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

export interface DetailsPanel {
  render(result: ScanResult, section: ScanSection, item: ScanItem, meta: CategoryMeta): void;
  renderEmpty(message: string): void;
}

/** How the details panel resolves and follows an in-content reference to another
 * scanned item (e.g. a skill's body pointing at `.agents/commands/foo.md`). */
export interface RefNav {
  resolve(path: string): ItemTarget | undefined;
  goTo(target: ItemTarget): void;
}

/** Owns rendering the details panel for whichever item is currently selected. */
export function createDetailsPanel(details: HTMLElement, layout: HTMLElement, nav: RefNav): DetailsPanel {
  function render(result: ScanResult, section: ScanSection, item: ScanItem, meta: CategoryMeta): void {
    details.innerHTML = '';
    details.style.setProperty('--accent', `var(--cat-${meta.color})`);
    details.style.setProperty('--accent-bg', `var(--cat-${meta.color}-bg)`);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'details-back';
    backBtn.innerHTML = `<i class="ti ti-arrow-left" aria-hidden="true"></i> Back to list`;
    backBtn.addEventListener('click', () => layout.classList.remove('showing-details'));
    details.appendChild(backBtn);

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
    details.appendChild(header);

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
    if (fieldsEl.children.length) details.appendChild(fieldsEl);

    if (section.key === 'hooks' && item.description) {
      const cmdLabel = document.createElement('div');
      cmdLabel.className = 'field-label';
      cmdLabel.textContent = 'Command';
      details.appendChild(cmdLabel);
      const cmdBlock = document.createElement('pre');
      cmdBlock.className = 'md-code';
      cmdBlock.innerHTML = `<code>${escapeHtml(item.description)}</code>`;
      details.appendChild(cmdBlock);
    }

    const otherKeys = item.meta ? Object.keys(item.meta).filter((k) => !shownKeys.has(k)) : [];
    if (otherKeys.length) {
      const rawDetails = document.createElement('details');
      rawDetails.className = 'raw-meta';
      const otherObj = Object.fromEntries(otherKeys.map((k) => [k, item.meta![k]]));
      rawDetails.innerHTML = `<summary>Other fields</summary><pre>${escapeHtml(JSON.stringify(otherObj, null, 2))}</pre>`;
      details.appendChild(rawDetails);
    }

    const bodyType = SECTION_BODY_TYPE[section.key] || 'none';
    if (bodyType === 'markdown' && item.preview) {
      const bodyEl = document.createElement('div');
      bodyEl.className = 'details-body md-body';
      bodyEl.innerHTML = renderMarkdown(item.preview);
      linkifyReferences(bodyEl, item, nav);
      details.appendChild(bodyEl);
    } else if (bodyType === 'code' && item.preview) {
      const codeEl = document.createElement('pre');
      codeEl.className = 'md-code details-body';
      codeEl.innerHTML = `<code>${escapeHtml(item.preview)}</code>`;
      details.appendChild(codeEl);
    }

    for (const ref of item.canonicalRefs ?? []) {
      const target = nav.resolve(ref.path);
      const refEl = document.createElement('div');
      refEl.className = ref.content ? 'canonical-ref' : 'canonical-ref canonical-ref-missing';

      const labelText = `Canonical source: ${escapeHtml(ref.path)}`;
      let labelHtml: string;
      if (target) {
        labelHtml =
          `<button type="button" class="canonical-ref-label canonical-ref-label-linked">` +
          `<i class="ti ti-git-merge" aria-hidden="true"></i> ${labelText}` +
          `<i class="ti ti-arrow-right canonical-ref-jump" aria-hidden="true"></i>` +
          `</button>`;
      } else {
        labelHtml = `<div class="canonical-ref-label"><i class="ti ti-git-merge" aria-hidden="true"></i> ${labelText}</div>`;
      }

      refEl.innerHTML =
        labelHtml +
        (ref.content
          ? `<div class="canonical-ref-body md-body">${renderMarkdown(ref.content)}</div>`
          : `<div class="canonical-ref-missing-text">Referenced file not found — the reference may be stale.</div>`);

      if (target) {
        refEl.querySelector('.canonical-ref-label-linked')?.addEventListener('click', () => nav.goTo(target));
      }

      details.appendChild(refEl);
    }
  }

  function renderEmpty(message: string): void {
    details.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  return { render, renderEmpty };
}

/** Turns inline backtick-quoted `.agents/*.md` references inside a rendered markdown
 * body (they come out as plain `<code>` spans) into clickable jump-to-item links,
 * wherever the reference resolves to a scanned item somewhere in the current scan. */
function linkifyReferences(bodyEl: HTMLElement, item: ScanItem, nav: RefNav): void {
  const refs = item.canonicalRefs;
  if (!refs?.length) return;

  const codeEls = bodyEl.querySelectorAll('code');
  codeEls.forEach((codeEl) => {
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
