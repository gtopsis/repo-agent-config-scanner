import { searchItems } from '../lib/search.js';
import { escapeHtml, metaLine } from './htmlHelpers.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ScanResult } from '../types.js';

export interface SearchBox {
  /** Called every time new scan results arrive, regardless of which top-level view
   * (Browse/Graph/Compare) is currently active, so search always matches the
   * latest data and can navigate from any of them — not just whichever one last
   * happened to render. */
  update(results: ScanResult[], goTo: (target: ItemTarget) => void): void;
}

/** Owns the topbar search input + its results dropdown for the lifetime of the
 * page. Created once (the input/dropdown elements are persistent topbar chrome,
 * never torn down like the sidebar/details layout is on every render), and fed
 * fresh data via `update()` instead of being rebuilt. */
export function createSearch(inputEl: HTMLInputElement, dropdownEl: HTMLElement): SearchBox {
  let results: ScanResult[] = [];
  let goTo: ((target: ItemTarget) => void) | null = null;
  let matches: ItemTarget[] = [];
  let activeIndex = -1;

  function closeDropdown(): void {
    dropdownEl.hidden = true;
    dropdownEl.innerHTML = '';
    matches = [];
    activeIndex = -1;
  }

  function setActive(index: number): void {
    activeIndex = index;
    [...dropdownEl.children].forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  }

  function select(target: ItemTarget): void {
    goTo?.(target);
    inputEl.value = '';
    closeDropdown();
    inputEl.blur();
  }

  function renderDropdown(): void {
    dropdownEl.innerHTML = '';

    if (!matches.length) {
      dropdownEl.innerHTML = `<div class="search-empty">No matches</div>`;
      dropdownEl.hidden = false;
      return;
    }

    matches.forEach((target) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'search-row';
      row.innerHTML =
        `<span class="search-row-meta">${metaLine(target.editorLabel, target.sectionLabel)}</span>` +
        `<span class="search-row-name">${escapeHtml(target.item.name)}</span>` +
        (target.item.description ? `<span class="search-row-desc">${escapeHtml(target.item.description)}</span>` : '');
      // mousedown (not click) so this fires before the input's blur-triggered close.
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        select(target);
      });
      dropdownEl.appendChild(row);
    });

    dropdownEl.hidden = false;
    setActive(0);
  }

  inputEl.addEventListener('input', () => {
    const query = inputEl.value;
    if (!query.trim()) {
      closeDropdown();
      return;
    }
    matches = searchItems(results, query);
    renderDropdown();
  });

  inputEl.addEventListener('keydown', (e) => {
    if (dropdownEl.hidden && e.key !== 'Escape') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length) setActive((activeIndex + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length) setActive((activeIndex - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = matches[activeIndex];
      if (target) select(target);
    } else if (e.key === 'Escape') {
      closeDropdown();
      inputEl.blur();
    }
  });

  // A plain blur would close the dropdown before a row's click/mousedown handler
  // gets to run, so delay it slightly — select() above closes it immediately anyway.
  inputEl.addEventListener('blur', () => setTimeout(closeDropdown, 150));

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      inputEl.focus();
      inputEl.select();
    }
  });

  return {
    update(newResults, newGoTo) {
      results = newResults;
      goTo = newGoTo;
    },
  };
}
