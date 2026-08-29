# Agentic Config Visualizer

A local, no-backend tool that scans a project folder and visualizes its
per-editor agentic coding configuration — skills, commands, agents, hooks,
rules, MCP servers, and more — side by side across Claude Code, GitHub
Copilot, OpenCode, and Cursor.

## Why

Modern AI coding tools each invent their own config conventions
(`.claude/`, `.github/`, `.opencode/`, `.cursor/`, `.agents/`...). This app
gives you one screen to see what's actually configured, for which editor,
and how it's wired together — including jumping between items that
reference each other (e.g. a skill pointing at a shared `.agents/*.md`
file).

## Features

- **Multi-editor scan**: detects and parses config for Claude Code, GitHub
  Copilot, OpenCode, and Cursor in a single pass.
- **Unified sidebar**: categorized, foldable list of every skill, command,
  agent, hook, rule, MCP server, etc. found for the selected editor.
- **Rich detail view**: frontmatter fields, rendered markdown body, and raw
  JSON/config fallback for non-markdown items.
- **Cross-references**: backtick-quoted `.agents/*.md` references inside a
  skill/command/agent's body are resolved and shown inline; when a
  reference points at another tracked item, it becomes a clickable link
  that jumps straight to it (switching editor tab if needed).
- **Persistent session**: remembers the last folder and scan results across
  reloads (via the File System Access API + `localStorage`/IndexedDB).

## Requirements

A **Chromium-based browser** (Chrome or Edge) — the app relies on the
[File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
to read a local folder directly, with no upload and no server-side file
access.

## Getting started

```bash
npm install
npm start
```

This compiles TypeScript to `dist/` and starts a tiny static file server
(`http://localhost:5173` by default, override with `PORT`). Open it in
Chrome/Edge, click **Select project**, and grant access to a project
folder.

Other scripts:

```bash
npm run build   # compile once
npm run watch   # recompile on change
```

## How it works

- `src/scanners/*.ts` — one scanner per editor, each walking the relevant
  config directories/files for that tool.
- `src/lib/*.ts` — shared scanning utilities: File System Access helpers,
  frontmatter/JSON-with-comments parsing, the generic
  "walk dir → parse frontmatter → build item" pipeline, MCP server config
  parsing, and canonical `.agents/*.md` reference resolution.
- `src/types.ts` — the single generic `ScanItem`/`ScanSection`/`ScanResult`
  model every editor's scan results are normalized into.
- `src/ui/*.ts` — vanilla-DOM sidebar and details-panel rendering, no
  framework.
- `src/main.ts` / `src/render.ts` — app bootstrap, session restore, and the
  top-level layout/navigation wiring.

All scanning and rendering happens client-side in the browser; `server.ts`
only serves static files.
