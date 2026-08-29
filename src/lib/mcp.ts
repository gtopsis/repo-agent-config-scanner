import { safeGetFile, readText } from './fsWalk.js';
import type { ScanItem } from '../types.js';

export interface McpServerConfig {
  type?: string;
  command?: string | string[];
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

/** Every editor's MCP server config is either a `command` (+ optional `args`) for a
 * local/stdio server, or a `url` for a remote one — never both — so a single
 * description function covers Claude Code, Copilot, OpenCode, and Cursor alike. */
export function describeMcpServer(cfg: McpServerConfig): string {
  if (cfg.url) return cfg.url;
  if (Array.isArray(cfg.command)) return cfg.command.join(' ');
  if (cfg.command) return `${cfg.command} ${(cfg.args || []).join(' ')}`.trim();
  return '';
}

/** Extracts a name → server-config map from a parsed MCP config file. Checks the
 * tool-specific primary key first (e.g. "mcpServers", or "mcp" for OpenCode), then
 * falls back to the "servers" key (VS Code's convention) and finally Copilot CLI's
 * "bare" format where every top-level key is itself a server name. */
export function extractMcpServers(
  json: Record<string, unknown>,
  primaryKey: string = 'mcpServers',
): Record<string, McpServerConfig> {
  const primary = json[primaryKey];
  if (primary && typeof primary === 'object') {
    return primary as Record<string, McpServerConfig>;
  }
  if (json.servers && typeof json.servers === 'object') {
    return json.servers as Record<string, McpServerConfig>;
  }
  const bare: Record<string, McpServerConfig> = {};
  for (const [k, v] of Object.entries(json)) {
    if (v && typeof v === 'object' && ('command' in v || 'url' in v)) {
      bare[k] = v as McpServerConfig;
    }
  }
  return bare;
}

export async function scanMcpFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  path: string,
  items: ScanItem[],
  primaryKey: string = 'mcpServers',
): Promise<void> {
  const file = await safeGetFile(dir, fileName);
  if (!file) return;
  const text = await readText(file);
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const servers = extractMcpServers(json, primaryKey);
    for (const [name, cfg] of Object.entries(servers)) {
      items.push({ name, path, description: describeMcpServer(cfg), meta: cfg });
    }
  } catch (e) {
    items.push({ name: fileName, path, description: 'Could not parse JSON', preview: text || '' });
  }
}
