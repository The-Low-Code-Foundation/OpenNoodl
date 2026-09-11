/**
 * Logic Builder port detection — the runtime's name for it.
 *
 * 🔴 **The implementation moved to `@nodegx/project-contract/logic-builder-io`** (HLS-001).
 * `@nodegx/export` calls `detectIO` too, and an exporter that reaches into the runtime's source
 * tree by relative path is not a package anyone can install.
 *
 * ## The invariant that made this delicate, and why it still holds
 *
 * This module's original header explained why it lived here: dynamic ports are announced from the
 * *viewer* window, which cannot see anything the editor window put on `window`, so the one piece
 * of code both halves call has to ship inside the runtime bundle.
 *
 * **That is unchanged.** A re-export is inlined by the bundler exactly as the definition was, so
 * the same code ends up in the same bundle; only the directory the source sits in has moved. Two
 * measured facts make it safe: webpack resolves the workspace symlink to the real path under
 * `packages/`, so `exclude: /node_modules/` never fires on it (`webpack-ts-rule.js` says so in its
 * own comment), and the contract package is plain ESM TypeScript, so it needs none of the
 * `module: commonjs` / `export =` handling this package's own ts-loader instance exists to provide.
 *
 * ⚠️ `export *`, not a hand-written list. The module exports seventeen symbols and the first draft
 * of this file listed five of them, which would have removed twelve names that twelve editor files
 * and four runtime suites import — silently, because a missing re-export is a resolution error at
 * the *call* site, not here.
 *
 * @see LEARNINGS-BLOCKLY.md §1 (editor/runtime window separation)
 */
export * from '@nodegx/project-contract/logic-builder-io';
