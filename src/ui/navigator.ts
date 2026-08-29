import { buildItemIndex } from '../lib/itemIndex.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ItemList } from './itemList.js';
import type { ScanResult } from '../types.js';

export interface Navigator {
  /** Looks up whether a resolved reference path points at a tracked scan item. */
  resolve(path: string): ItemTarget | undefined;
  /** Follows a resolved reference: switches the editor `<select>` if the target
   * lives under a different editor, then focuses its row/details via `itemList`. */
  goTo(target: ItemTarget): void;
  /** `itemList` doesn't exist yet when the navigator is created (it's built with a
   * reference to the details panel the navigator itself feeds into) — wired in once
   * available, before any real navigation can happen. */
  setItemList(itemList: ItemList): void;
}

/** Owns cross-editor reference resolution/navigation for one render pass: indexes
 * every scanned item across every editor's results, and knows how to jump to
 * whichever one a reference resolves to. Kept separate from `render.ts` so that
 * module only has to own the layout skeleton, not navigation semantics too. */
export function createNavigator(results: ScanResult[], selectEl: HTMLSelectElement): Navigator {
  const index = buildItemIndex(results);
  const resultByEditor = new Map(results.map((r) => [r.editor, r]));
  let itemList: ItemList | null = null;

  return {
    resolve: (path) => index.get(path),
    goTo: (target) => {
      const result = resultByEditor.get(target.editor);
      if (!result || !itemList) return;
      if (selectEl.value !== target.editor) selectEl.value = target.editor;
      itemList.render(result, { sectionKey: target.sectionKey, itemPath: target.item.path });
    },
    setItemList: (list) => {
      itemList = list;
    },
  };
}
