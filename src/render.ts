import { createDetailsPanel } from './ui/detailsPanel.js';
import { createItemList } from './ui/itemList.js';
import { buildItemIndex } from './lib/itemIndex.js';
import type { ItemTarget } from './lib/itemIndex.js';
import type { ItemList } from './ui/itemList.js';
import type { ScanResult } from './types.js';

export interface TopbarRefs {
  selectEl: HTMLSelectElement;
  statusEl: HTMLElement;
  spinnerEl: HTMLElement;
}

/** Builds the sidebar/details layout skeleton, wires it to the item-list and
 * details-panel modules, and drives the topbar editor <select>. `allEditors` is the
 * fixed, canonical editor order — options always follow it regardless of which
 * editors have finished scanning, so the list never reshuffles as results stream in.
 * Editors from `allEditors` with no matching entry in `results` yet are shown as
 * disabled placeholders, and the topbar spinner is shown while any are still pending. */
export function renderResults(
  results: ScanResult[],
  container: HTMLElement,
  topbar: TopbarRefs,
  allEditors: { editor: string; label: string }[] = results.map((r) => ({ editor: r.editor, label: r.label })),
): void {
  const { selectEl, statusEl, spinnerEl } = topbar;
  const prevEditor = selectEl.selectedOptions[0]?.dataset.editor;

  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'layout';

  const itemListEl = document.createElement('aside');
  itemListEl.className = 'sidebar';

  const detailsEl = document.createElement('section');
  detailsEl.className = 'details-panel';

  layout.append(itemListEl, detailsEl);
  container.appendChild(layout);

  const resultByEditor = new Map(results.map((r) => [r.editor, r]));
  const itemIndex = buildItemIndex(results);

  // `goTo` is referenced by `detailsPanel` (created first) but calls into `itemList`
  // (created second) — declared here so both closures can capture the same binding,
  // which is assigned before `goTo` is ever actually invoked (only on user click).
  let itemList!: ItemList;
  function goTo(target: ItemTarget): void {
    const result = resultByEditor.get(target.editor);
    if (!result) return;
    if (selectEl.value !== target.editor) selectEl.value = target.editor;
    itemList.render(result, { sectionKey: target.sectionKey, itemPath: target.item.path });
  }

  const detailsPanel = createDetailsPanel(detailsEl, layout, { resolve: (path) => itemIndex.get(path), goTo });
  itemList = createItemList(itemListEl, layout, detailsPanel);

  const orderedResults = allEditors.map((e) => resultByEditor.get(e.editor)).filter((r): r is ScanResult => !!r);

  selectEl.innerHTML = '';
  allEditors.forEach(({ editor, label }) => {
    const result = resultByEditor.get(editor);
    const option = document.createElement('option');
    option.value = editor;
    option.dataset.editor = editor;
    if (result) {
      option.textContent = result.detected ? result.label : `${result.label} — none`;
    } else {
      option.disabled = true;
      option.textContent = label;
    }
    selectEl.appendChild(option);
  });
  selectEl.hidden = false;

  const detectedCount = orderedResults.filter((r) => r.detected).length;
  statusEl.textContent = `${detectedCount}/${allEditors.length} configured`;
  statusEl.hidden = false;
  spinnerEl.hidden = orderedResults.length === allEditors.length;

  selectEl.onchange = () => {
    const result = resultByEditor.get(selectEl.value);
    if (result) itemList.render(result);
  };

  const selected =
    orderedResults.find((r) => r.editor === prevEditor) ?? orderedResults.find((r) => r.detected) ?? orderedResults[0];
  if (selected) {
    selectEl.value = selected.editor;
    itemList.render(selected);
  }
}
