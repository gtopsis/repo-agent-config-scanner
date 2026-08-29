import type { ItemTarget } from '../../lib/itemIndex.js';

/** How rendering code resolves and follows an in-content reference to another
 * scanned item (e.g. a skill's body pointing at `.agents/commands/foo.md`). Shared
 * by every details-panel sub-renderer that can encounter a reference. */
export interface RefNav {
  resolve(path: string): ItemTarget | undefined;
  goTo(target: ItemTarget): void;
}
