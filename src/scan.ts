import { scanClaudeCode } from './scanners/claudeCode.js';
import { scanCopilot } from './scanners/copilot.js';
import { scanOpencode } from './scanners/opencode.js';
import { scanCursor } from './scanners/cursor.js';
import type { ScanResult } from './types.js';

interface ScannerEntry {
  editor: string;
  label: string;
  run: (root: FileSystemDirectoryHandle) => Promise<ScanResult>;
}

/** The registry of every supported editor's scanner. Adding a new editor is just:
 * write its scanner module, then add it here — nothing else needs to change. */
const SCANNERS: ScannerEntry[] = [
  { editor: 'claude-code', label: 'Claude Code', run: scanClaudeCode },
  { editor: 'github-copilot', label: 'GitHub Copilot', run: scanCopilot },
  { editor: 'opencode', label: 'OpenCode', run: scanOpencode },
  { editor: 'cursor', label: 'Cursor', run: scanCursor },
];

/** Static editor identity, available before any scan runs — lets the UI show
 * placeholders for editors that haven't finished scanning yet. */
export const EDITOR_META = SCANNERS.map(({ editor, label }) => ({ editor, label }));

function withSortedSections(result: ScanResult): ScanResult {
  return {
    ...result,
    sections: result.sections.map((section) => ({
      ...section,
      items: [...section.items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    })),
  };
}

export async function scanAll(
  root: FileSystemDirectoryHandle,
  onResult?: (result: ScanResult) => void,
): Promise<ScanResult[]> {
  return Promise.all(
    SCANNERS.map(({ run }) =>
      run(root).then((result) => {
        const sorted = withSortedSections(result);
        onResult?.(sorted);
        return sorted;
      }),
    ),
  );
}
