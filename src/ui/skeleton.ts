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

/** The left pane's placeholder: reuses the real `.sidebar` class so it gets the
 * exact same border/padding/scroll behavior as the real one, filled with `count`
 * pulsing item rows instead of real ones. */
function skeletonSidebar(count: number): string {
  return `<aside class="sidebar">${Array.from({ length: count }, skeletonItem).join('')}</aside>`;
}

/** The right pane's placeholder — shaped like a real details view (icon + name/
 * path header, a bordered fields box, a handful of body paragraph lines) so the
 * loading state matches the final two-pane layout instead of leaving the right
 * side blank until the first result streams in. */
function skeletonDetails(): string {
  const fieldRow =
    '<div class="skeleton-field-row">' +
    '<span class="skeleton-block skeleton-line skeleton-field-label"></span>' +
    '<span class="skeleton-block skeleton-line skeleton-field-value"></span>' +
    '</div>';

  const bodyLineWidths = [95, 88, 92, 60];
  const bodyLines = bodyLineWidths
    .map((width) => `<span class="skeleton-block skeleton-line skeleton-body-line" style="width:${width}%"></span>`)
    .join('');

  return (
    '<section class="details-panel skeleton-details">' +
    '<div class="skeleton-details-header">' +
    '<span class="skeleton-block skeleton-icon-lg"></span>' +
    '<span class="skeleton-item-text">' +
    '<span class="skeleton-block skeleton-line skeleton-line-breadcrumb"></span>' +
    '<span class="skeleton-block skeleton-line skeleton-line-title"></span>' +
    '<span class="skeleton-block skeleton-line skeleton-line-path"></span>' +
    '</span>' +
    '</div>' +
    `<div class="skeleton-details-fields">${fieldRow.repeat(3)}</div>` +
    `<div class="skeleton-details-body">${bodyLines}</div>` +
    '</section>'
  );
}

/** Fills `container` with a two-pane skeleton — sidebar rows on the left, a
 * details-shaped placeholder on the right — matching the real layout's shape
 * (same `.layout`/`.sidebar`/`.details-panel` classes) so swapping in real
 * content once the first scan result arrives doesn't shift the page around. */
export function renderSkeleton(container: HTMLElement, count = 6): void {
  container.innerHTML = `<div class="layout">${skeletonSidebar(count)}${skeletonDetails()}</div>`;
}
