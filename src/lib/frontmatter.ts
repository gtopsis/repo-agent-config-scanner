import type { Meta } from '../types.js';

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export interface ParsedFrontmatter {
  meta: Meta;
  body: string;
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const lines = (text || '').split('\n');
  if ((lines[0] || '').trim() !== '---') {
    return { meta: {}, body: text || '' };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { meta: {}, body: text || '' };
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  const meta: Meta = {};
  let pendingKey: string | null = null;

  for (const raw of frontmatterLines) {
    const line = raw.replace(/\t/g, '  ');

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && pendingKey) {
      const existing = meta[pendingKey];
      const arr = Array.isArray(existing) ? existing : [];
      arr.push(stripQuotes((listMatch[1] ?? '').trim()));
      meta[pendingKey] = arr;
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1] as string;
      const val = (kvMatch[2] ?? '').trim();
      pendingKey = null;

      if (val === '') {
        pendingKey = key;
        meta[key] = '';
        continue;
      }
      if (val.startsWith('[') && val.endsWith(']')) {
        meta[key] = val
          .slice(1, -1)
          .split(',')
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean);
      } else if (val === 'true' || val === 'false') {
        meta[key] = val === 'true';
      } else {
        meta[key] = stripQuotes(val);
      }
    }
  }

  return { meta, body };
}

export function parseFrontmatterSafe(text: string): ParsedFrontmatter {
  try {
    return parseFrontmatter(text);
  } catch (e) {
    return { meta: {}, body: text || '' };
  }
}
