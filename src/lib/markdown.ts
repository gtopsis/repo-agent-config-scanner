function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] as string);
}

function inline(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return s;
}

export function renderMarkdown(text: string): string {
  if (!text) return '';

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inCode = false;
  let codeBuffer: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeBuffer = [];
      } else {
        inCode = false;
        html += `<pre class="md-code"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = (headingMatch[1] as string).length + 2;
      html += `<h${level} class="md-heading">${inline(headingMatch[2] ?? '')}</h${level}>`;
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        html += '<ul class="md-list">';
        inList = true;
      }
      html += `<li>${inline(listMatch[1] ?? '')}</li>`;
      continue;
    }
    closeList();

    if (line.trim() === '') continue;

    html += `<p class="md-p">${inline(line)}</p>`;
  }

  closeList();
  if (inCode) {
    html += `<pre class="md-code"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
  }

  return html;
}
