import { allTargets } from './itemIndex.js';
import type { ItemTarget } from './itemIndex.js';
import type { ScanResult } from '../types.js';

const NAME_RANK = 0;
const DESCRIPTION_RANK = 1;
const BODY_RANK = 2;

/** Searches every scanned item across every editor. Name matches rank above
 * description matches, which rank above matches only found in the body/preview
 * content — so the most obviously-relevant results always sort first. Empty/blank
 * queries return no results (the caller should just keep the dropdown closed). */
export function searchItems(results: ScanResult[], query: string, limit = 20): ItemTarget[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const ranked: { target: ItemTarget; rank: number }[] = [];
  for (const target of allTargets(results)) {
    const { item } = target;
    let rank: number | null = null;
    if (item.name.toLowerCase().includes(q)) rank = NAME_RANK;
    else if (item.description && item.description.toLowerCase().includes(q)) rank = DESCRIPTION_RANK;
    else if (item.preview && item.preview.toLowerCase().includes(q)) rank = BODY_RANK;

    if (rank !== null) ranked.push({ target, rank });
  }

  ranked.sort(
    (a, b) => a.rank - b.rank || a.target.item.name.localeCompare(b.target.item.name, undefined, { sensitivity: 'base' }),
  );
  return ranked.slice(0, limit).map((m) => m.target);
}
