export type FieldFormat = 'bool' | 'list' | 'kv';

export interface FieldSchemaEntry {
  key: string;
  label: string;
  format?: FieldFormat;
}

// Known frontmatter/config fields per category, shown as labeled rows in the
// details panel instead of a raw JSON dump. Fields absent on a given item are
// skipped; anything present but not listed here falls back to "Other fields".
export const FIELD_SCHEMAS: Record<string, FieldSchemaEntry[]> = {
  skills: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'allowed-tools', label: 'Allowed tools', format: 'list' },
    { key: 'license', label: 'License' },
    { key: 'paths', label: 'Paths', format: 'list' },
    { key: 'disable-model-invocation', label: 'Manual invocation only', format: 'bool' },
  ],
  rules: [
    { key: 'description', label: 'Description' },
    { key: 'globs', label: 'Globs', format: 'list' },
    { key: 'paths', label: 'Paths', format: 'list' },
    { key: 'alwaysApply', label: 'Always apply', format: 'bool' },
  ],
  commands: [
    { key: 'description', label: 'Description' },
    { key: 'argument-hint', label: 'Argument hint' },
    { key: 'allowed-tools', label: 'Allowed tools', format: 'list' },
    { key: 'model', label: 'Model' },
    { key: 'agent', label: 'Agent' },
    { key: 'subtask', label: 'Subtask', format: 'bool' },
  ],
  agents: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'mode', label: 'Mode' },
    { key: 'model', label: 'Model' },
    { key: 'tools', label: 'Tools', format: 'list' },
    { key: 'permission', label: 'Permission' },
    { key: 'temperature', label: 'Temperature' },
    { key: 'top_p', label: 'Top P' },
    { key: 'steps', label: 'Max steps' },
    { key: 'color', label: 'Color' },
    { key: 'disable', label: 'Disabled', format: 'bool' },
    { key: 'hidden', label: 'Hidden', format: 'bool' },
    { key: 'readonly', label: 'Read-only', format: 'bool' },
    { key: 'is_background', label: 'Runs in background', format: 'bool' },
    { key: 'target', label: 'Target' },
  ],
  hooks: [
    { key: 'event', label: 'Event' },
    { key: 'matcher', label: 'Matcher' },
    { key: 'type', label: 'Type' },
    { key: 'timeout', label: 'Timeout (s)' },
    { key: 'failClosed', label: 'Fail closed', format: 'bool' },
  ],
  mcpServers: [
    { key: 'type', label: 'Type' },
    { key: 'command', label: 'Command', format: 'list' },
    { key: 'args', label: 'Args', format: 'list' },
    { key: 'url', label: 'URL' },
    { key: 'environment', label: 'Environment', format: 'kv' },
    { key: 'headers', label: 'Headers', format: 'kv' },
    { key: 'enabled', label: 'Enabled', format: 'bool' },
    { key: 'oauth', label: 'OAuth', format: 'bool' },
    { key: 'timeout', label: 'Timeout (ms)' },
  ],
  pathInstructions: [
    { key: 'applyTo', label: 'Applies to' },
    { key: 'excludeAgent', label: 'Excluded from' },
  ],
  prompts: [
    { key: 'description', label: 'Description' },
    { key: 'mode', label: 'Mode' },
    { key: 'tools', label: 'Tools', format: 'list' },
    { key: 'model', label: 'Model' },
  ],
  chatmodes: [
    { key: 'description', label: 'Description' },
    { key: 'tools', label: 'Tools', format: 'list' },
    { key: 'model', label: 'Model' },
  ],
  workflows: [
    { key: 'engine', label: 'Engine' },
    { key: 'on', label: 'Trigger' },
  ],
  plugins: [
    { key: 'events', label: 'Hooks into', format: 'list' },
    { key: 'displayName', label: 'Display name' },
    { key: 'version', label: 'Version' },
    { key: 'description', label: 'Description' },
    { key: 'author', label: 'Author' },
    { key: 'license', label: 'License' },
    { key: 'homepage', label: 'Homepage' },
  ],
  marketplaces: [
    { key: 'owner', label: 'Owner' },
    { key: 'description', label: 'Description' },
    { key: 'version', label: 'Version' },
    { key: 'pluginCount', label: 'Plugins listed' },
  ],
  outputStyles: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'keep-coding-instructions', label: 'Keeps default coding instructions', format: 'bool' },
    { key: 'force-for-plugin', label: 'Auto-applied by plugin', format: 'bool' },
  ],
  ignore: [{ key: 'purpose', label: 'Purpose' }],
  environment: [
    { key: 'snapshot', label: 'Snapshot' },
    { key: 'dockerfile', label: 'Dockerfile' },
    { key: 'context', label: 'Build context' },
    { key: 'install', label: 'Install script' },
    { key: 'start', label: 'Start command' },
  ],
  interface: [
    { key: 'theme', label: 'Theme' },
    { key: 'keybindCount', label: 'Custom keybinds' },
  ],
};

export const SECTION_BODY_TYPE: Record<string, 'markdown' | 'code'> = {
  instructions: 'markdown',
  skills: 'markdown',
  commands: 'markdown',
  agents: 'markdown',
  prompts: 'markdown',
  chatmodes: 'markdown',
  pathInstructions: 'markdown',
  plugins: 'code',
  rules: 'markdown',
  workflows: 'code',
  outputStyles: 'markdown',
  ignore: 'code',
  tools: 'code',
  interface: 'code',
};
