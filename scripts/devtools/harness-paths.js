/**
 * Where the render harness's data lives, in a checkout **and** in a packaged install.
 *
 * UNI-012. Until 2026-08-20 every path in `render-report.js` and
 * `render-from-disk.js` hung off `REPO = path.resolve(__dirname, '../..')`, which
 * is the repo root when — and only when — this directory is `<repo>/scripts/devtools`.
 * On a packaged install `scripts/` was not shipped at all, so the question never
 * arose: the harness was absent and `render_report` refused. Shipping it makes the
 * resolution order the whole of the work, and it lives here rather than twice.
 *
 * ⚠️ **Two layouts, deliberately not one.** The obvious tidy-up — copy every data
 * file into one directory and resolve everything relative to it — would duplicate
 * the 14MB viewer bundle that the editor already ships. Measured on the 0.1.7 dmg:
 * `src/external/viewer/`, `node_modules/ws` and `node_modules/@nodegx/render-measure`
 * are **already inside `app.asar`**. What is genuinely absent is the harness itself,
 * the two node catalogs and `DefaultTokens.ts`. So the packaged layout resolves the
 * viewer where the editor already put it, and only the absent files move.
 *
 * 🔴 **This works because the harness is spawned with `process.execPath`, which for
 * the MCP sidecar is the Electron binary under `ELECTRON_RUN_AS_NODE=1`** — and that
 * runtime reads inside `app.asar`, runs a main script from inside it, and resolves
 * `require('@nodegx/…')` through the asar's own `node_modules`. Plain `node` does
 * none of those things: it fails `ENOTDIR` on the first read. All four were measured
 * against the installed 0.1.7 app before this file was written, because "asar is
 * transparent" is true of Electron's main process and not obviously true of a
 * spawned child. If a future change makes the harness spawn under plain Node, every
 * packaged candidate below stops resolving **and the checkout ones still work**,
 * which is the failure that reads as "fine on my machine".
 *
 * @module scripts/devtools/harness-paths
 */
const fs = require('fs');
const path = require('path');

/** Layout A — a repo checkout: this file is `<repo>/scripts/devtools/`. */
const CHECKOUT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Layout B — packaged: this file is `<Resources>/app.asar/render-harness/`.
 *
 * `PACKAGED_ROOT` is the asar root, which is what the editor's own `src/` hangs
 * off. The files this task adds sit in `data/` beside the harness instead, so
 * that adding one is an `extraFiles` line and not a new resolution rule.
 */
const PACKAGED_ROOT = path.resolve(__dirname, '..');
const PACKAGED_DATA = path.join(__dirname, 'data');

/**
 * The first candidate that exists, and everything tried.
 *
 * Returns `{ path: null, probed }` rather than throwing: the caller decides
 * whether a given file is fatal (the viewer bundle) or degrades (nothing does,
 * as of this task — see `checkPrerequisites`). **The probed list is returned
 * even on success** because a refusal that cannot say where it looked sends the
 * reader to guess at a layout, which is the failure UNI-012 §2.1 records for the
 * Chrome probe.
 */
function firstExisting(candidates) {
  const probed = [];
  for (const candidate of candidates) {
    probed.push(candidate);
    if (fs.existsSync(candidate)) return { path: candidate, probed, candidates };
  }
  return { path: null, probed, candidates };
}

/**
 * Resolve one of the harness's data files. Checkout first, then packaged.
 *
 * ⚠️ `probed` stops at the hit and `candidates` does not, and the difference
 * matters to anything asking *"does this resolver know about the packaged
 * layout?"*. In a checkout the first candidate matches, so `probed` has exactly
 * one entry — a check reading `probed` to prove both layouts are covered would
 * pass a resolver that had never heard of the second one. On a **failure** the
 * two are identical, which is why the refusal messages print `probed`.
 */
function resolveHarnessPath(checkoutRelative, packagedCandidate) {
  return firstExisting([path.join(CHECKOUT_ROOT, checkoutRelative), packagedCandidate]);
}

const VIEWER_DIR = resolveHarnessPath(
  'packages/noodl-editor/src/external/viewer',
  path.join(PACKAGED_ROOT, 'src', 'external', 'viewer')
);

const CATALOG_JSON = resolveHarnessPath(
  'packages/noodl-types/src/node-catalog.json',
  path.join(PACKAGED_DATA, 'node-catalog.json')
);

const ENRICHED_CATALOG_JSON = resolveHarnessPath(
  'packages/noodl-types/src/node-catalog-enriched.json',
  path.join(PACKAGED_DATA, 'node-catalog-enriched.json')
);

/**
 * Where the shipped default tokens are DECLARED.
 *
 * 🔴 **Repointed 2026-09-11 (TPL-005).** This named
 * `StyleTokensModel/DefaultTokens.ts`, which HLS-001 reduced to a twelve-line
 * re-export — the declarations moved to `@nodegx/project-contract/tokens`. The
 * regex in `render-from-disk.js` therefore matched **nothing**, and the harness
 * emitted `0 shipped defaults`: every `var(--space-*)`, `var(--radius-*)` and
 * `var(--border-*)` in every rendered project resolved to empty. Pages came out
 * with no padding and no gaps, and the harness looked like it had found a
 * product-wide spacing defect. It is the exact "lying harness" its own comment
 * in `render-from-disk.js` warns about, and the refactor walked straight into it.
 *
 * ⚠️ The packaged candidate is unchanged: a packaged install ships the file
 * under its old name, and `firstExisting` prefers the checkout.
 */
const TOKENS_SRC = resolveHarnessPath(
  'packages/nodegx-project-contract/tokens.ts',
  path.join(PACKAGED_DATA, 'DefaultTokens.ts')
);

/**
 * `ws`, as a path in a checkout and as a bare specifier otherwise.
 *
 * ⚠️ The bare specifier is not a fallback for "not installed" — it is the
 * packaged case, where `ws` sits in the asar's own `node_modules` and ordinary
 * resolution finds it from here. `checkPrerequisites` still reports it missing
 * when neither route works, so the two are distinguishable.
 */
const WS_MODULE = (() => {
  const checkout = path.join(CHECKOUT_ROOT, 'node_modules', 'ws');
  const candidates = [checkout, "require('ws')"];
  if (fs.existsSync(checkout)) return { path: checkout, probed: [checkout], candidates, bare: false };
  try {
    require.resolve('ws');
    return { path: 'ws', probed: candidates, candidates, bare: true };
  } catch {
    return { path: null, probed: candidates, candidates, bare: false };
  }
})();

module.exports = {
  CHECKOUT_ROOT,
  PACKAGED_ROOT,
  PACKAGED_DATA,
  VIEWER_DIR,
  CATALOG_JSON,
  ENRICHED_CATALOG_JSON,
  TOKENS_SRC,
  WS_MODULE,
  firstExisting,
  resolveHarnessPath
};
