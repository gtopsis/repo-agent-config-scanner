import { allTargets, buildItemIndex } from './itemIndex.js';
import type { ItemTarget } from './itemIndex.js';
import type { ScanResult } from '../types.js';

export interface GraphEdge {
  from: ItemTarget;
  to: ItemTarget;
}

export interface ReferenceGraph {
  nodes: ItemTarget[];
  edges: GraphEdge[];
}

/** Computes the "who references whom" graph: nodes are every scanned item that's a
 * source or target of at least one resolved `.agents/*.md` reference — items with
 * no references at all are deliberately left out, since today's reference detection
 * is narrow (backtick-quoted paths only) and a graph of every scanned item would
 * mostly just be disconnected noise. Reuses the same path-based resolution the
 * details panel's inline reference links / canonical-refs block already use, so a
 * reference is only ever an edge here if it's also clickable there. */
export function computeReferenceGraph(results: ScanResult[]): ReferenceGraph {
  const index = buildItemIndex(results);
  const nodesByPath = new Map<string, ItemTarget>();
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const target of allTargets(results)) {
    for (const ref of target.item.canonicalRefs ?? []) {
      const to = index.get(ref.path);
      if (!to) continue;

      const edgeKey = `${target.item.path}=>${to.item.path}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      nodesByPath.set(target.item.path, target);
      nodesByPath.set(to.item.path, to);
      edges.push({ from: target, to });
    }
  }

  return { nodes: [...nodesByPath.values()], edges };
}
