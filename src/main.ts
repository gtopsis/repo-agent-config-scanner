import { scanAll, EDITOR_META } from './scan.js';
import { isFileSystemAccessSupported } from './compat.js';
import { renderResults } from './render.js';
import { renderSkeletonList } from './ui/skeleton.js';
import { saveDirectoryHandle, loadDirectoryHandle } from './lib/handleStore.js';
import { saveScanCache, loadScanCache } from './lib/resultsCache.js';
import type { ScanResult } from './types.js';

const folderBtn = document.getElementById('folder-btn') as HTMLButtonElement;
const reconnectBtn = document.getElementById('reconnect-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const compatBanner = document.getElementById('compat-banner') as HTMLElement;
const editorSelect = document.getElementById('editor-select') as HTMLSelectElement;
const editorSpinner = document.getElementById('editor-spinner') as HTMLElement;
const editorStatus = document.getElementById('editor-status') as HTMLElement;
const app = document.getElementById('app') as HTMLElement;

let currentHandle: FileSystemDirectoryHandle | null = null;
let scanning = false;

// Same button, same toolbar slot in both states: before a folder is picked it reads
// "Select project" and starts the picker; afterward it shows the active folder's name
// and clicking it re-opens the picker to choose a different one.
function showFolderChrome(name: string): void {
  folderBtn.textContent = name;
  folderBtn.title = 'Click to choose a different project folder';
  folderBtn.classList.add('active');
}

function display(results: ScanResult[]): void {
  renderResults(results, app, { selectEl: editorSelect, statusEl: editorStatus, spinnerEl: editorSpinner }, EDITOR_META);
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

if (!isFileSystemAccessSupported()) {
  compatBanner.hidden = false;
  folderBtn.disabled = true;
  folderBtn.title = 'Requires a Chromium-based browser (Chrome, Edge, Brave, Opera...)';
} else {
  restoreSession();
}
