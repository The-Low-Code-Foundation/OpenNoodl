/**
 * ALPHA-005 — the legal documents, reachable from inside the app.
 *
 * `PRIVACY.md` and `TERMS.md` are authored at the repository root, because that
 * is where a person looking at the project on GitHub will find them, and having
 * two copies is how one of them goes stale. electron-builder copies them into
 * the packaged app's resources (see `extraResources` in package.json), so the
 * same file serves both readers.
 *
 * Rendering is deliberately tiny: enough Markdown for the subset these two
 * documents actually use (headings, paragraphs, lists, tables, links, code,
 * bold/italic, rules). Pulling a Markdown library into the main process would
 * mean shipping one for two static files.
 *
 * The window is loaded from a `data:` URL with no `nodeIntegration`, and every
 * link is opened in the user's own browser rather than navigated to in-app.
 *
 * @module main/legal-window
 */

const fs = require('fs');
const path = require('path');
const { BrowserWindow, shell, app } = require('electron');

/** The documents this module knows how to show, keyed by the id the menu uses. */
const DOCUMENTS = {
  privacy: { file: 'PRIVACY.md', title: 'NodeGX — Privacy Policy' },
  terms: { file: 'TERMS.md', title: 'NodeGX — Alpha Terms' }
};

/** Matches the main window's startup background tokens (colors.css bg-0). */
const THEME = {
  dark: { bg: '#0b0e12', panel: '#151a21', fg: '#c9d1d9', muted: '#8b949e', link: '#58a6ff', rule: '#232a33' },
  light: { bg: '#eef1f5', panel: '#ffffff', fg: '#1f2429', muted: '#5a636e', link: '#0b62d0', rule: '#d8dee6' }
};

let openWindows = {};

/**
 * Where the document lives. Packaged builds get it from `extraResources`;
 * running from source, walk up to the repository root. Returns null rather than
 * throwing so a missing file degrades to a readable message.
 */
function resolveDocumentPath(fileName) {
  const candidates = [
    path.join(process.resourcesPath || '', 'legal', fileName),
    path.join(app.getAppPath(), '..', '..', fileName),
    path.join(app.getAppPath(), '..', '..', '..', fileName)
  ];

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch (_e) {
      // Unreadable candidate — try the next one.
    }
  }
  return null;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Placeholder for a lifted-out code span. Delimited on both sides, because a
 * bare `15` would collide with prose such as "sections 15 and 16". A
 * private-use code point rather than NUL, so the restore pattern below is not
 * a control-character regex; neither can occur in the source documents.
 */
const CODE_MARK = '\uE000';

/** Inline spans: code first, so its contents are not re-processed as emphasis. */
function renderInline(text) {
  const codeSpans = [];
  let out = text.replace(/`([^`]+)`/g, (_m, code) => {
    codeSpans.push(code);
    return `${CODE_MARK}${codeSpans.length - 1}${CODE_MARK}`;
  });

  out = escapeHtml(out);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${href}">${label}</a>`);
  // Bare autolinks, as used for the GitHub settings URL.
  out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_m, href) => `<a href="${href}">${href}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  return out.replace(/\uE000(\d+)\uE000/g, (_m, index) => `<code>${escapeHtml(codeSpans[Number(index)])}</code>`);
}

/** A table row's cells, without the empty edges `| a | b |` produces. */
function splitRow(line) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  return /^\s*\|?[\s:-]*-[\s|:-]*$/.test(line) && line.includes('-');
}

function renderMarkdown(source) {
  const lines = source.split(/\r?\n/);
  const html = [];
  let listOpen = false;
  let inHtmlComment = false;

  function closeList() {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // The documents carry TODO notes to the maintainers in HTML comments.
    // They are not for the reader.
    if (inHtmlComment) {
      if (line.includes('-->')) inHtmlComment = false;
      continue;
    }
    if (line.trim().startsWith('<!--')) {
      if (!line.includes('-->')) inHtmlComment = true;
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    // Table: a header row followed by a divider row.
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      closeList();
      const header = splitRow(line);
      html.push('<div class="tablewrap"><table><thead><tr>');
      header.forEach((cell) => html.push(`<th>${renderInline(cell)}</th>`));
      html.push('</tr></thead><tbody>');

      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        html.push('<tr>');
        splitRow(lines[i]).forEach((cell) => html.push(`<td>${renderInline(cell)}</td>`));
        html.push('</tr>');
        i++;
      }
      i--;
      html.push('</tbody></table></div>');
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closeList();
      html.push('<hr />');
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    // A wrapped paragraph: gather until a blank line or a block starts.
    closeList();
    const paragraph = [line.trim()];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^\s*[-*]\s+/.test(lines[i + 1]) &&
      !/^#{1,6}\s/.test(lines[i + 1]) &&
      !lines[i + 1].trim().startsWith('|') &&
      !lines[i + 1].trim().startsWith('<!--') &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i + 1])
    ) {
      paragraph.push(lines[++i].trim());
    }
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }

  closeList();
  return html.join('\n');
}

function renderPage(title, body, theme) {
  const c = THEME[theme] || THEME.dark;
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: ${theme}; }
  body { margin: 0; padding: 40px 48px 72px; background: ${c.bg}; color: ${c.fg};
         font: 14px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .page { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 19px; margin: 34px 0 10px; padding-top: 14px; border-top: 1px solid ${c.rule}; }
  h3 { font-size: 15px; margin: 22px 0 6px; }
  p, li { color: ${c.fg}; }
  a { color: ${c.link}; }
  code { background: ${c.panel}; border: 1px solid ${c.rule}; border-radius: 4px;
         padding: 1px 5px; font-size: 12.5px;
         font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  hr { border: 0; border-top: 1px solid ${c.rule}; margin: 30px 0; }
  ul { padding-left: 22px; }
  li { margin: 5px 0; }
  .tablewrap { overflow-x: auto; margin: 14px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid ${c.rule}; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: ${c.panel}; font-weight: 600; }
  strong { color: ${theme === 'dark' ? '#ffffff' : '#000000'}; }
  em { color: ${c.muted}; font-style: italic; }
</style></head>
<body><div class="page">${body}</div></body></html>`;
}

/**
 * Open (or focus) a legal document window.
 *
 * @param {'privacy'|'terms'} id
 * @param {'dark'|'light'} theme
 */
function openLegalWindow(id, theme) {
  const doc = DOCUMENTS[id];
  if (!doc) return;

  const existing = openWindows[id];
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const docPath = resolveDocumentPath(doc.file);
  let body;
  if (docPath) {
    try {
      body = renderMarkdown(fs.readFileSync(docPath, 'utf8'));
    } catch (error) {
      body = `<h1>${escapeHtml(doc.title)}</h1><p>Could not read ${escapeHtml(doc.file)}: ${escapeHtml(
        String(error && error.message)
      )}</p>`;
    }
  } else {
    // Better to say the document is missing than to show a blank window.
    body =
      `<h1>${escapeHtml(doc.title)}</h1>` +
      `<p>${escapeHtml(doc.file)} was not found in this build. You can read it at ` +
      `<a href="https://github.com/The-Low-Code-Foundation/OpenNoodl/blob/main/${doc.file}">github.com</a>.</p>`;
  }

  const resolvedTheme = theme === 'light' ? 'light' : 'dark';
  const window = new BrowserWindow({
    width: 860,
    height: 880,
    title: doc.title,
    backgroundColor: THEME[resolvedTheme].bg,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });

  window.setMenuBarVisibility(false);

  // Links go to the user's browser; the window itself never navigates.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  window.on('closed', () => {
    delete openWindows[id];
  });

  openWindows[id] = window;
  window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(renderPage(doc.title, body, resolvedTheme)));
}

module.exports = {
  openLegalWindow,
  // Exported for tests: the renderer is the only part with logic worth checking.
  renderMarkdown,
  resolveDocumentPath,
  DOCUMENTS
};
