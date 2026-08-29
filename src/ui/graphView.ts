import { computeReferenceGraph } from '../lib/referenceGraph.js';
import { categoryMeta } from '../config/categories.js';
import { escapeHtml, emptyState, metaLine } from './htmlHelpers.js';
import type { GraphEdge } from '../lib/referenceGraph.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ScanResult } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 52;
const COL_GAP = 28;
const ROW_HEIGHT = 110;
const PADDING = 40;
const ARROW_MARKER_ID = 'graph-arrow';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

interface Row {
  key: string;
  label: string;
  nodes: ItemTarget[];
}

interface Layout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

export interface GraphView {
  render(results: ScanResult[]): void;
}

/** Groups nodes into rows by section key, in first-seen order — the graph's only
 * layout heuristic (no physics simulation), putting items of the same "kind"
 * (skills, commands, ...) on the same horizontal band. */
function groupNodesIntoRows(nodes: ItemTarget[]): Row[] {
  const rows: Row[] = [];
  const rowByKey = new Map<string, Row>();
  for (const node of nodes) {
    let row = rowByKey.get(node.sectionKey);
    if (!row) {
      row = { key: node.sectionKey, label: node.sectionLabel, nodes: [] };
      rowByKey.set(node.sectionKey, row);
      rows.push(row);
    }
    row.nodes.push(node);
  }
  return rows;
}

/** Assigns each node an (x, y) position — nodes within a row are evenly spaced and
 * centered, rows are stacked top-to-bottom — and computes the SVG canvas size
 * needed to fit them all. */
function computeLayout(rows: Row[]): Layout {
  const maxCols = Math.max(...rows.map((r) => r.nodes.length));
  const width = PADDING * 2 + maxCols * (NODE_WIDTH + COL_GAP) - COL_GAP;
  const height = PADDING * 2 + rows.length * ROW_HEIGHT;

  const positions = new Map<string, { x: number; y: number }>();
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.nodes.length * (NODE_WIDTH + COL_GAP) - COL_GAP;
    const startX = (width - rowWidth) / 2;
    row.nodes.forEach((node, colIndex) => {
      positions.set(node.item.path, {
        x: startX + colIndex * (NODE_WIDTH + COL_GAP),
        y: PADDING + rowIndex * ROW_HEIGHT,
      });
    });
  });

  return { positions, width, height };
}

/** The arrowhead marker definition edges reference via `marker-end`, defined once
 * and shared by every edge path. */
function buildArrowMarkerDefs(): SVGDefsElement {
  const defs = svgEl('defs');
  const marker = svgEl('marker');
  marker.setAttribute('id', ARROW_MARKER_ID);
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '7');
  marker.setAttribute('refY', '4');
  marker.setAttribute('orient', 'auto');
  const arrowPath = svgEl('path');
  arrowPath.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
  arrowPath.setAttribute('class', 'graph-arrow-head');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  return defs;
}

/** A curved path from one node's bottom edge to another's top edge, curving through
 * their vertical midpoint so edges between same-row or nearby nodes stay legible
 * instead of overlapping a straight line. Returns `null` if either endpoint's
 * position is unknown (shouldn't normally happen, but keeps this defensive rather
 * than throwing). */
function buildEdgePath(edge: GraphEdge, positions: Layout['positions']): SVGPathElement | null {
  const from = positions.get(edge.from.item.path);
  const to = positions.get(edge.to.item.path);
  if (!from || !to) return null;

  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + NODE_WIDTH / 2;
  const y2 = to.y;
  const midY = (y1 + y2) / 2;

  const path = svgEl('path');
  path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
  path.setAttribute('class', 'graph-edge');
  path.setAttribute('marker-end', `url(#${ARROW_MARKER_ID})`);
  return path;
}

/** One node's clickable card, positioned via `<foreignObject>` so its content can
 * just be normal styled/truncating HTML instead of fiddly SVG text sizing. */
function buildNodeCard(
  node: ItemTarget,
  pos: { x: number; y: number },
  onSelect: (target: ItemTarget) => void,
): SVGForeignObjectElement {
  const meta = categoryMeta(node.sectionKey);

  const fo = svgEl('foreignObject');
  fo.setAttribute('x', String(pos.x));
  fo.setAttribute('y', String(pos.y));
  fo.setAttribute('width', String(NODE_WIDTH));
  fo.setAttribute('height', String(NODE_HEIGHT));

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'graph-node';
  card.style.setProperty('--accent', `var(--cat-${meta.color})`);
  card.style.setProperty('--accent-bg', `var(--cat-${meta.color}-bg)`);
  // Plain text, not metaLine() (which HTML-escapes) — a `.title` tooltip isn't an
  // HTML context, so escaping here would show a literal "&amp;" instead of "&".
  card.title = `${node.item.name} — ${node.editorLabel} · ${node.sectionLabel}`;
  card.innerHTML =
    `<span class="graph-node-name">${escapeHtml(node.item.name)}</span>` +
    `<span class="graph-node-meta">${metaLine(node.editorLabel, node.sectionLabel)}</span>`;
  card.addEventListener('click', () => onSelect(node));

  fo.appendChild(card);
  return fo;
}

/** The section-name label along the left edge of each row. */
function buildRowLabel(row: Row, rowIndex: number): SVGTextElement {
  const label = svgEl('text');
  label.setAttribute('x', '4');
  label.setAttribute('y', String(PADDING + rowIndex * ROW_HEIGHT - 10));
  label.setAttribute('class', 'graph-row-label');
  label.textContent = row.label;
  return label;
}

/** Renders the reference graph: nodes grouped into rows by section (first-seen
 * order), edges as curved SVG arrows between them. Hand-rolled SVG + HTML (via
 * <foreignObject>, so node content can just be normal styled/truncating divs) —
 * deliberately no layout/graph library, consistent with the rest of the app having
 * zero runtime dependencies and no bundler step. */
export function createGraphView(container: HTMLElement, onSelect: (target: ItemTarget) => void): GraphView {
  function render(results: ScanResult[]): void {
    container.innerHTML = '';
    const { nodes, edges } = computeReferenceGraph(results);

    if (!nodes.length) {
      container.innerHTML = emptyState(
        'No cross-references found yet — an item only shows up here once its body references another via a ' +
          'backtick-quoted `.agents/*.md` path that resolves to a scanned item.',
      );
      return;
    }

    const rows = groupNodesIntoRows(nodes);
    const { positions, width, height } = computeLayout(rows);

    const svg = svgEl('svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.classList.add('graph-svg');
    svg.appendChild(buildArrowMarkerDefs());

    for (const edge of edges) {
      const path = buildEdgePath(edge, positions);
      if (path) svg.appendChild(path);
    }

    for (const node of nodes) {
      const pos = positions.get(node.item.path);
      if (pos) svg.appendChild(buildNodeCard(node, pos, onSelect));
    }

    rows.forEach((row, rowIndex) => svg.appendChild(buildRowLabel(row, rowIndex)));

    const wrap = document.createElement('div');
    wrap.className = 'graph-wrap';
    wrap.appendChild(svg);
    container.appendChild(wrap);
  }

  return { render };
}
