import { createDetailsPanel } from './ui/detailsPanel.js';
import { createItemList } from './ui/itemList.js';
import { createNavigator } from './ui/navigator.js';
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
 * disabled placeholders, and the topbar spinner is shown while any are still pending.
 * `initialFocus`, when given (e.g. jumping here from the Compare view),
 * selects that editor/item instead of falling back to the previously-active one. */
export function renderResults(
  results: ScanResult[],
  container: HTMLElement,
  topbar: TopbarRefs,
  allEditors: { editor: string; label: string }[] = results.map((r) => ({ editor: r.editor, label: r.label })),
  initialFocus?: { editor: string; sectionKey: string; itemPath: string },
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
  const navigator = createNavigator(results, selectEl);

  const detailsPanel = createDetailsPanel(detailsEl, layout, navigator);
  const itemList = createItemList(itemListEl, layout, detailsPanel);
  navigator.setItemList(itemList);

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
    (initialFocus && orderedResults.find((r) => r.editor === initialFocus.editor)) ??
    orderedResults.find((r) => r.editor === prevEditor) ??
    orderedResults.find((r) => r.detected) ??
    orderedResults[0];
  if (selected) {
    selectEl.value = selected.editor;
    const focus =
      initialFocus && selected.editor === initialFocus.editor
        ? { sectionKey: initialFocus.sectionKey, itemPath: initialFocus.itemPath }
        : undefined;
    itemList.render(selected, focus);
  }
}
