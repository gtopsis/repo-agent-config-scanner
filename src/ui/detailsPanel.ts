import { renderMarkdown } from '../lib/markdown.js';
import { FIELD_SCHEMAS, SECTION_BODY_TYPE } from '../config/fieldSchemas.js';
import { escapeHtml, formatValue, iconEl } from './htmlHelpers.js';
import type { CategoryMeta } from '../config/categories.js';
import type { ScanItem, ScanResult, ScanSection } from '../types.js';

export interface DetailsPanel {
  render(result: ScanResult, section: ScanSection, item: ScanItem, meta: CategoryMeta): void;
  renderEmpty(message: string): void;
}

/** Owns rendering the details panel for whichever item is currently selected. */
export function createDetailsPanel(details: HTMLElement, layout: HTMLElement): DetailsPanel {
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
      details.appendChild(bodyEl);
    } else if (bodyType === 'code' && item.preview) {
      const codeEl = document.createElement('pre');
      codeEl.className = 'md-code details-body';
      codeEl.innerHTML = `<code>${escapeHtml(item.preview)}</code>`;
      details.appendChild(codeEl);
    }

    for (const ref of item.canonicalRefs ?? []) {
      const refEl = document.createElement('div');
      refEl.className = ref.content ? 'canonical-ref' : 'canonical-ref canonical-ref-missing';
      refEl.innerHTML =
        `<div class="canonical-ref-label"><i class="ti ti-git-merge" aria-hidden="true"></i> Canonical source: ${escapeHtml(ref.path)}</div>` +
        (ref.content
          ? `<div class="canonical-ref-body md-body">${renderMarkdown(ref.content)}</div>`
          : `<div class="canonical-ref-missing-text">Referenced file not found — the reference may be stale.</div>`);
      details.appendChild(refEl);
    }
  }

  function renderEmpty(message: string): void {
    details.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  return { render, renderEmpty };
}
