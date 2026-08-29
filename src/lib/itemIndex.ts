import type { ScanItem, ScanResult } from '../types.js';

/** Where a resolved reference path actually lives, so the details panel can jump
 * straight to it (switching editor tab / expanding its section as needed). */
export interface ItemTarget {
  editor: string;
  editorLabel: string;
  sectionKey: string;
  sectionLabel: string;
  item: ScanItem;
}

/** One `ItemTarget` per scanned item across every editor's results — the flat form
 * other consumers (the reference index, the diff view) build on top of, so the
 * "walk every result → every section → every item" loop lives in exactly one
 * place. */
export function allTargets(results: ScanResult[]): ItemTarget[] {
  const targets: ItemTarget[] = [];
  for (const result of results) {
    for (const section of result.sections) {
      for (const item of section.items) {
        targets.push({
          editor: result.editor,
          editorLabel: result.label,
          sectionKey: section.key,
          sectionLabel: section.label,
          item,
        });
      }
    }
  }
  return targets;
}

/** Indexes every scanned item across every editor by each of its known locations
 * (its primary `path` plus any `additionalPaths` it was also found under), so a
 * canonical-ref path resolved from one item's body can be matched back to whichever
 * item — in whichever editor's results — actually lives there. Rebuilt on every
 * render since `results` streams in incrementally as editors finish scanning. */
export function buildItemIndex(results: ScanResult[]): Map<string, ItemTarget> {
  const index = new Map<string, ItemTarget>();

  for (const target of allTargets(results)) {
    index.set(target.item.path, target);
    for (const extra of target.item.additionalPaths ?? []) {
      index.set(extra, target);
    }
  }

  return index;
}
