/** A single pulsing placeholder row shaped like a sidebar item row (icon + two text
 * lines) — reusable anywhere real content isn't ready yet, not just the initial scan. */
function skeletonItem(): string {
  return (
    '<div class="skeleton-item">' +
    '<span class="skeleton-block skeleton-icon"></span>' +
    '<span class="skeleton-item-text">' +
    '<span class="skeleton-block skeleton-line skeleton-line-name"></span>' +
    '<span class="skeleton-block skeleton-line skeleton-line-desc"></span>' +
    '</span>' +
    '</div>'
  );
}

/** Fills `container` with `count` repeated skeleton rows. */
export function renderSkeletonList(container: HTMLElement, count = 6): void {
  container.innerHTML = `<div class="skeleton-list">${Array.from({ length: count }, skeletonItem).join('')}</div>`;
}
