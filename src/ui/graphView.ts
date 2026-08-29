import { computeReferenceGraph } from '../lib/referenceGraph.js';
import { categoryMeta } from '../config/categories.js';
import { escapeHtml } from './htmlHelpers.js';
import type { ItemTarget } from '../lib/itemIndex.js';
import type { ScanResult } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 52;
const COL_GAP = 28;
const ROW_HEIGHT = 110;
const PADDING = 40;

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

interface Row {
  key: string;
  label: string;
  nodes: ItemTarget[];
}

export interface GraphView {
  render(results: ScanResult[]): void;
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
      container.innerHTML =
        `<div class="empty-state">No cross-references found yet — an item only shows up here once its body ` +
        `references another via a backtick-quoted <code>.agents/*.md</code> path that resolves to a scanned item.</div>`;
      return;
    }

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

    const svg = svgEl('svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.classList.add('graph-svg');

    const defs = svgEl('defs');
    const marker = svgEl('marker');
    marker.setAttribute('id', 'graph-arrow');
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
    svg.appendChild(defs);

    for (const edge of edges) {
      const from = positions.get(edge.from.item.path);
      const to = positions.get(edge.to.item.path);
      if (!from || !to) continue;

      const x1 = from.x + NODE_WIDTH / 2;
      const y1 = from.y + NODE_HEIGHT;
      const x2 = to.x + NODE_WIDTH / 2;
      const y2 = to.y;
      const midY = (y1 + y2) / 2;

      const path = svgEl('path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute('class', 'graph-edge');
      path.setAttribute('marker-end', 'url(#graph-arrow)');
      svg.appendChild(path);
    }

    for (const node of nodes) {
      const pos = positions.get(node.item.path);
      if (!pos) continue;
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
      card.title = `${node.item.name} — ${node.editorLabel} · ${node.sectionLabel}`;
      card.innerHTML =
        `<span class="graph-node-name">${escapeHtml(node.item.name)}</span>` +
        `<span class="graph-node-meta">${escapeHtml(node.editorLabel)} · ${escapeHtml(node.sectionLabel)}</span>`;
      card.addEventListener('click', () => onSelect(node));

      fo.appendChild(card);
      svg.appendChild(fo);
    }

    rows.forEach((row, rowIndex) => {
      const label = svgEl('text');
      label.setAttribute('x', '4');
      label.setAttribute('y', String(PADDING + rowIndex * ROW_HEIGHT - 10));
      label.setAttribute('class', 'graph-row-label');
      label.textContent = row.label;
      svg.appendChild(label);
    });

    const wrap = document.createElement('div');
    wrap.className = 'graph-wrap';
    wrap.appendChild(svg);
    container.appendChild(wrap);
  }

  return { render };
}
