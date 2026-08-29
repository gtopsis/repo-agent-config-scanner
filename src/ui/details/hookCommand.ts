import { escapeHtml } from '../htmlHelpers.js';
import type { ScanItem, ScanSection } from '../../types.js';

/** Hooks store their actual shell command in `item.description` rather than
 * `item.meta`, so it needs its own labeled code block instead of going through the
 * generic field schema. Returns a fragment so its two elements attach as flat
 * siblings in the panel, matching the rest of the layout. */
export function renderHookCommand(section: ScanSection, item: ScanItem): DocumentFragment | null {
  if (section.key !== 'hooks' || !item.description) return null;

  const cmdLabel = document.createElement('div');
  cmdLabel.className = 'field-label';
  cmdLabel.textContent = 'Command';

  const cmdBlock = document.createElement('pre');
  cmdBlock.className = 'md-code';
  cmdBlock.innerHTML = `<code>${escapeHtml(item.description)}</code>`;

  const fragment = document.createDocumentFragment();
  fragment.append(cmdLabel, cmdBlock);
  return fragment;
}
