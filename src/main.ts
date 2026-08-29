import { scanAll, EDITOR_META } from './scan.js';
import { isFileSystemAccessSupported } from './compat.js';
import { renderResults } from './render.js';
import { renderSkeletonList } from './ui/skeleton.js';
import { createSearch } from './ui/search.js';
import { createGraphView } from './ui/graphView.js';
import { createDiffView } from './ui/diffView.js';
import { saveDirectoryHandle, loadDirectoryHandle } from './lib/handleStore.js';
import { saveScanCache, loadScanCache } from './lib/resultsCache.js';
import type { ItemTarget } from './lib/itemIndex.js';
import type { ScanResult } from './types.js';

const folderBtn = document.getElementById('folder-btn') as HTMLButtonElement;
const reconnectBtn = document.getElementById('reconnect-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const compatBanner = document.getElementById('compat-banner') as HTMLElement;
const editorSelect = document.getElementById('editor-select') as HTMLSelectElement;
const editorSpinner = document.getElementById('editor-spinner') as HTMLElement;
const editorStatus = document.getElementById('editor-status') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchDropdown = document.getElementById('search-dropdown') as HTMLElement;
const viewTabs = document.getElementById('view-tabs') as HTMLElement;
const viewTabButtons = [...viewTabs.querySelectorAll<HTMLButtonElement>('.view-tab')];
const app = document.getElementById('app') as HTMLElement;

const search = createSearch(searchInput, searchDropdown);
const topbarRefs = { selectEl: editorSelect, statusEl: editorStatus, spinnerEl: editorSpinner };

type ViewMode = 'browse' | 'graph' | 'diff';

let currentHandle: FileSystemDirectoryHandle | null = null;
let scanning = false;
let latestResults: ScanResult[] = [];
let viewMode: ViewMode = 'browse';
let pendingFocus: { editor: string; sectionKey: string; itemPath: string } | undefined;

// Same button, same toolbar slot in both states: before a folder is picked it reads
// "Select project" and starts the picker; afterward it shows the active folder's name
// and clicking it re-opens the picker to choose a different one.
function showFolderChrome(name: string): void {
  folderBtn.textContent = name;
  folderBtn.title = 'Click to choose a different project folder';
  folderBtn.classList.add('active');
}

function updateModeTabs(): void {
  for (const btn of viewTabButtons) {
    const active = btn.dataset.mode === viewMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  }
}

/** Jumping to an item from the Graph or Compare view always means "go look at it
 * in Browse mode" — switches mode, then renderActiveView() (via the pendingFocus
 * it sets) lands renderResults() on that exact editor/section/item. */
function goToItem(target: ItemTarget): void {
  viewMode = 'browse';
  pendingFocus = { editor: target.editor, sectionKey: target.sectionKey, itemPath: target.item.path };
  updateModeTabs();
  renderActiveView();
}

const graphView = createGraphView(app, goToItem);
const diffView = createDiffView(app, goToItem);

/** Re-renders whichever view is currently active against the latest scan results.
 * The editor <select> only means anything in Browse mode (Graph/Compare show every
 * editor at once), so it's hidden outside of it. */
function renderActiveView(): void {
  if (viewMode === 'graph') {
    editorSelect.hidden = true;
    graphView.render(latestResults);
  } else if (viewMode === 'diff') {
    editorSelect.hidden = true;
    diffView.render(latestResults, EDITOR_META);
  } else {
    renderResults(latestResults, app, topbarRefs, EDITOR_META, pendingFocus);
    pendingFocus = undefined;
  }
}

function display(results: ScanResult[]): void {
  latestResults = results;
  if (results.length) {
    viewTabs.hidden = false;
    searchInput.hidden = false;
  }
  search.update(results, goToItem);
  renderActiveView();
}

async function scanAndPersist(dirHandle: FileSystemDirectoryHandle): Promise<void> {
  if (scanning) return;
  scanning = true;
  currentHandle = dirHandle;
  renderSkeletonList(app);
  refreshBtn.hidden = false;
  refreshBtn.disabled = true;
  refreshBtn.classList.add('spinning');

  try {
    const results: ScanResult[] = [];
    const allResults = await scanAll(dirHandle, (result) => {
      results.push(result);
      display(results);
    });

    saveScanCache(dirHandle.name, allResults);
    await saveDirectoryHandle(dirHandle);
  } finally {
    scanning = false;
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('spinning');
  }
}

async function pickAndScan(): Promise<void> {
  try {
    const dirHandle = await window.showDirectoryPicker();
    reconnectBtn.hidden = true;
    showFolderChrome(dirHandle.name);
    await scanAndPersist(dirHandle);
  } catch (e) {
    if (e instanceof Error && e.name !== 'AbortError') {
      console.error(e);
      alert('Could not read that folder: ' + e.message);
    }
  }
}

async function reconnect(): Promise<void> {
  if (!currentHandle) return;
  try {
    const permission = await currentHandle.requestPermission({ mode: 'read' });
    if (permission !== 'granted') return;
    reconnectBtn.hidden = true;
    await scanAndPersist(currentHandle);
  } catch (e) {
    console.error(e);
    alert('Could not reconnect to that folder — try selecting it again instead.');
  }
}

async function refresh(): Promise<void> {
  if (!currentHandle) return;
  await scanAndPersist(currentHandle);
}

// On load: show any cached results immediately (so a refresh never loses what was on
// screen), then check whether we can silently regain read access to the same folder.
// A same-session reload usually can (the browser remembers the grant); a fresh
// browser restart usually can't — reading a local folder without a click after that
// would be a real permission escalation, so the browser requires "Reconnect" instead.
async function restoreSession(): Promise<void> {
  const cached = loadScanCache();
  if (cached) {
    showFolderChrome(cached.folderName);
    display(cached.results);
  }

  const handle = await loadDirectoryHandle();
  if (!handle) return;
  currentHandle = handle;
  if (!cached) showFolderChrome(handle.name);

  const permission = await handle.queryPermission({ mode: 'read' });
  if (permission === 'granted') {
    await scanAndPersist(handle);
  } else {
    reconnectBtn.hidden = false;
  }
}

folderBtn.addEventListener('click', pickAndScan);
reconnectBtn.addEventListener('click', reconnect);
refreshBtn.addEventListener('click', refresh);

for (const btn of viewTabButtons) {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as ViewMode | undefined;
    if (!mode || mode === viewMode) return;
    viewMode = mode;
    updateModeTabs();
    renderActiveView();
  });
}

if (!isFileSystemAccessSupported()) {
  compatBanner.hidden = false;
  folderBtn.disabled = true;
  folderBtn.title = 'Requires a Chromium-based browser (Chrome, Edge, Brave, Opera...)';
} else {
  restoreSession();
}
