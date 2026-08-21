/** Arbitrary parsed frontmatter or config object for one item — shape is inherently
 * dynamic (user-authored YAML frontmatter / third-party JSON config), so values are
 * `unknown` rather than a fixed union; consumers narrow at the point of use. */
export type Meta = Record<string, unknown>;

export interface CanonicalRef {
  path: string;
  /** Undefined when the referenced file couldn't be found (e.g. a stale/moved reference). */
  content?: string;
}

export interface ScanItem {
  name: string;
  path: string;
  description: string;
  meta?: Meta;
  preview?: string;
  /** Other locations this same item was also found at (e.g. a skill present under
   * both .claude/skills and .agents/skills) — set only when a scan step merges
   * same-named items found via multiple parent folders. */
  additionalPaths?: string[];
  /** Shared canonical files this item's body points at (e.g. a skill that says
   * "Read and execute `../../.agents/workflows/foo.md`") — resolved and read at scan
   * time so the details view can show the referenced content inline. */
  canonicalRefs?: CanonicalRef[];
}

export interface ScanSection {
  key: string;
  label: string;
  items: ScanItem[];
}

export interface ScanResult {
  editor: string;
  label: string;
  detected: boolean;
  sections: ScanSection[];
}
