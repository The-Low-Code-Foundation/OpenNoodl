/**
 * The browser half of the harness: a live-reload channel and a diagnostics
 * overlay, injected into the deployed page just before `</body>`.
 *
 * Deliberately dependency-free and inline — the page it lands in is the real
 * deployed runtime template, and the preview must not perturb it beyond adding
 * one script and one overlay element.
 *
 * Behaviour:
 *   - `reload`      → a new valid build exists; reload the page.
 *   - `diagnostics` → the project is mid-edit and invalid; show the overlay
 *                     *over* the last good render rather than blanking it.
 *   - `error`       → the project could not be read at all; same treatment.
 *   - disconnect    → a muted bar; EventSource reconnects on its own.
 *
 * @module noodl-preview/client
 */

const CLIENT_SOURCE = String.raw`
(function () {
  var ID = '__noodl_preview_overlay';
  var es = null;

  function el() {
    var node = document.getElementById(ID);
    if (!node) {
      node = document.createElement('div');
      node.id = ID;
      node.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'background:rgba(16,18,21,0.92)', 'color:#e8e8ea',
        'font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
        'padding:28px 32px', 'overflow:auto', '-webkit-font-smoothing:antialiased'
      ].join(';'));
      document.body.appendChild(node);
    }
    return node;
  }

  function hide() {
    var node = document.getElementById(ID);
    if (node) node.parentNode.removeChild(node);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function row(d) {
    var where = [d.component, d.nodeLabel || d.nodeType, d.nodeId, d.port].filter(Boolean).join(' › ');
    var colour = d.severity === 'error' ? '#ff6b6b' : d.severity === 'warning' ? '#ffc857' : '#8ab4f8';
    return (
      '<li style="margin:0 0 14px;list-style:none">' +
      '<div><span style="color:' + colour + ';font-weight:600">' + esc(d.severity) + '</span>' +
      '<span style="color:#7c8087;margin-left:8px">' + esc(d.code) + '</span></div>' +
      '<div style="margin-top:2px">' + esc(d.message) + '</div>' +
      (where ? '<div style="color:#7c8087;margin-top:2px">' + esc(where) + '</div>' : '') +
      (d.suggestion ? '<div style="color:#9ad1a4;margin-top:2px">→ ' + esc(d.suggestion) + '</div>' : '') +
      '</li>'
    );
  }

  function showDiagnostics(payload) {
    var errors = payload.summary ? payload.summary.errors : 0;
    var list = (payload.diagnostics || []).filter(function (d) { return d.severity === 'error'; });
    if (!list.length) list = payload.diagnostics || [];
    el().innerHTML =
      '<div style="font-size:15px;font-weight:600;margin-bottom:4px">' +
      errors + (errors === 1 ? ' diagnostic' : ' diagnostics') + ' — waiting for a valid graph</div>' +
      '<div style="color:#7c8087;margin-bottom:20px">The last good render is underneath. ' +
      'Fix these and the preview updates itself.</div>' +
      '<ul style="margin:0;padding:0">' + list.map(row).join('') + '</ul>';
  }

  function showError(message) {
    el().innerHTML =
      '<div style="font-size:15px;font-weight:600;margin-bottom:4px;color:#ff6b6b">Could not read the project</div>' +
      '<div style="white-space:pre-wrap">' + esc(message) + '</div>' +
      '<div style="color:#7c8087;margin-top:20px">Watching for the next change.</div>';
  }

  function showDisconnected() {
    el().innerHTML =
      '<div style="font-size:15px;font-weight:600;margin-bottom:4px">Preview server disconnected</div>' +
      '<div style="color:#7c8087">Reconnecting…</div>';
  }

  function apply(msg) {
    if (msg.type === 'reload') { location.reload(); return; }
    if (msg.type === 'diagnostics') { showDiagnostics(msg); return; }
    if (msg.type === 'error') { showError(msg.message); return; }
    if (msg.type === 'ok') { hide(); return; }
  }

  function connect() {
    es = new EventSource('/__preview/events');
    es.onmessage = function (e) {
      try { apply(JSON.parse(e.data)); } catch (err) { /* ignore malformed frame */ }
    };
    es.onerror = function () {
      // EventSource retries by itself; only surface a sustained outage.
      if (es.readyState === EventSource.CLOSED || es.readyState === EventSource.CONNECTING) {
        showDisconnected();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
`;

/** The `<script>` tag to inject into the served page. */
export const CLIENT_SCRIPT = `<script type="application/javascript">${CLIENT_SOURCE}</script>`;

/**
 * Injects the client into a processed deploy page. Falls back to appending if
 * the template ever loses its `</body>` — the preview should degrade, not fail.
 */
export function injectClient(html: string): string {
  return html.includes('</body>') ? html.replace('</body>', `${CLIENT_SCRIPT}\n</body>`) : html + CLIENT_SCRIPT;
}

/**
 * The page served before the first valid build exists. It carries no runtime —
 * just the client, so the very first thing a user sees when they point the
 * preview at a broken project is the diagnostics, not a blank tab.
 */
export function bootstrapPage(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} — Noodl preview</title>
    <style>
      body { margin: 0; background: #101215; color: #e8e8ea;
             font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    </style>
  </head>
  <body>
    ${CLIENT_SCRIPT}
  </body>
</html>
`;
}
