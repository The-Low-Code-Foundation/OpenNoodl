/**
 * LEG-004 — the packaged app's `diff=noodl` entry point.
 *
 * Sits beside `merge-driver.js` and is dispatched from the same place, but the
 * two have opposite performance profiles and therefore opposite shapes.
 *
 * The merge driver runs once, interactively, when a merge conflicts, and can
 * afford a full Electron boot. Textconv runs **once per blob per revision** —
 * `git log -p` over one component's history invokes it dozens of times before
 * printing anything — so it runs as plain Node. `installMergeDriver` configures
 * `ELECTRON_RUN_AS_NODE=1` for exactly that reason, which means:
 *
 *  ⚠️ nothing on this path may touch `require('electron')`. Under
 *  `ELECTRON_RUN_AS_NODE` that require hands back a CLI shim whose `app` is
 *  undefined — the failure main.js guards against at its top. This module and
 *  everything it reaches must stay pure Node, and the dispatch in main.js must
 *  come before main.js's own electron requires.
 *
 * The renderer itself lives in `@noodl/git` rather than here because it has to
 * be runnable by a bare `node` in a checkout, where no bundle exists.
 */

const { runTextconv } = require('@noodl/git/src/textconv');

module.exports = {
  /**
   * Render one file to stdout and exit. Never exits non-zero: git reports a
   * failing textconv as an error on an otherwise ordinary `git log`.
   *
   * @param {string[]} argv process.argv
   */
  handleTextconv(argv) {
    let code = 0;
    try {
      code = runTextconv(argv);
    } catch (error) {
      code = 0;
    }
    process.exit(code);
  }
};
