/**
 * LEG-004 — the textconv driver's process-level behaviour.
 *
 * Deliberately plain CommonJS with no dependency beyond `fs`: this runs once
 * per blob per revision on `git log -p`, so its startup cost is the whole
 * performance story, and it has to be runnable by a bare `node` as well as by
 * the packaged Electron binary under `ELECTRON_RUN_AS_NODE=1`.
 */

'use strict';

const fs = require('fs');

const { renderGraphText } = require('./renderGraph');

/**
 * Node type names in a project are a mix of readable (`Group`, `Text`) and
 * namespaced (`net.noodl.visual.columns`). The SUB-004 catalog maps the second
 * kind to a display name, which is the single biggest readability win here.
 *
 * Loaded lazily and defensively, and never fatal: `DiffFormatter` documents the
 * same contract, and a rendering that silently falls back to raw type names is
 * still a correct, stable rendering.
 */
function catalogDisplayNames() {
  let lookup;
  return (typeName) => {
    if (!lookup) {
      lookup = () => undefined;
      if (!process.env.NOODL_TEXTCONV_NO_CATALOG) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const catalog = require('@noodl/types/src/node-catalog.json');
          const index = new Map();
          for (const node of catalog.nodes || []) {
            if (node && node.typeName && node.displayName) index.set(node.typeName, node.displayName);
          }
          lookup = (name) => index.get(name);
        } catch (error) {
          /* raw type names it is */
        }
      }
    }
    return lookup(typeName);
  };
}

/**
 * Render one file to stdout and exit 0.
 *
 * ⚠️ Always 0. Git reports a non-zero textconv as an error on an otherwise
 * ordinary `git log`, so every failure path here ends in the raw bytes rather
 * than a diagnostic. The one thing worse than an unrendered diff is a `git log`
 * that will not run.
 *
 * @param {string[]} argv  the process argv; the file path is the argument that
 *                         follows `--textconv`, or the last argument.
 */
function runTextconv(argv) {
  let text = '';
  try {
    const flag = argv.indexOf('--textconv');
    const filePath = flag !== -1 && argv.length > flag + 1 ? argv[flag + 1] : argv[argv.length - 1];
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
      text = renderGraphText(raw, { displayName: catalogDisplayNames() });
    } catch (error) {
      text = raw;
    }
  } catch (error) {
    // No such file, a directory, /dev/null, unreadable — all of them mean
    // "nothing to render", which is an empty diff side and not a failure.
    text = '';
  }

  try {
    // fs.writeSync, not process.stdout.write: the caller exits immediately
    // afterwards and an async write to a pipe would be dropped.
    if (text.length > 0) fs.writeSync(1, text);
  } catch (error) {
    /* EPIPE — git closed the pipe early (`git log -p | head`). Not an error. */
  }

  return 0;
}

module.exports = { runTextconv, renderGraphText, catalogDisplayNames };
