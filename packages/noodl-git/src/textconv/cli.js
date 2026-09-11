#!/usr/bin/env node
/**
 * LEG-004 — the dev-mode textconv entry point.
 *
 * In a checkout there is a `node` on the PATH, so `git` can call this file
 * directly and skip Electron entirely. The packaged app has no `node`, and goes
 * through `main.bundle.js` under `ELECTRON_RUN_AS_NODE=1` instead — see
 * `noodl-editor/src/main/src/textconv-driver.js`. Both routes end in the same
 * `runTextconv`.
 */

'use strict';

process.exit(require('./index').runTextconv(process.argv));
