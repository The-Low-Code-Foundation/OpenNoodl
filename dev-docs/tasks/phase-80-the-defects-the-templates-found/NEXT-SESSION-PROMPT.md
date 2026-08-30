# Phase 80 — next session

## State: **22 of 27 done. The buildable work is finished; what is left is Richard's.**

DEF-001–004, 006, 008, 010–012, 014–024, 026, **027** closed. DEF-007/009/025 🟡 partial;
DEF-005/013 🧭 await rulings.

🔴 **Read [TASKS.md](TASKS.md)'s table before you read this paragraph.** The s22 handoff said
*"no workable open row left — the queue is empty of buildable candidates"* while the table held
`DEF-027 | ⬜ open`, appended by phase 77 **32 minutes earlier**. s23 found it by grading the
table. This file is a summary and summaries drift; the table is the phase.

```
grep -E '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -v '✅'
```

**s23 (2026-08-30) closed DEF-027** — a `Drag`'s child lost its `cssClassName`. The recorded
mechanism (D28: *"`react-draggable` clones the child with its own `className`"*) was half right.
The library **does** merge and had nothing to see: the child it clones is the
`NoodlReactComponent` wrapper, whose props are only `{key, noodlNode, ref}`. The discarding was
the **spread** — `...noodlNode.props` then `...otherProps`, last wins. Fixed at the spread, not in
`Drag.tsx`, so a future wrapper cannot reopen it; **D28's uncounted sibling sweep answered: one.**
5 specs, 5 mutants each killed by a named arm. The pinning drive was flipped, not deleted.

Also done: the **closing sweep** both prior prompts named — the README's house rules graded
against the table (all five hold), the unowned register re-checked at HEAD, and the phase's
[closing note](README.md#closing-note--s23-2026-08-30).

## What to do next

**There is no buildable product row left in this phase, and that statement was checked against
the table on 2026-08-30 at s23's end.** If you are reading this later, re-run the grep above
before believing it — that is the whole lesson of s22→s23.

- **🧭 Richard's queue, and it is the phase's only real remainder:**
  - **DEF-025** — the default flip (3 options in TASKS.md s17). A blunt flip stamps the literal
    string `'Label'` onto every existing bare checkbox.
  - **DEF-009 AC4** — the `rateLimit` default.
  - **DEF-005** and **DEF-013** rulings. ⚠️ **Re-drive SB-012 §1's table at HEAD before spending
    DEF-013's** — the door's `components` list is now built from `authoredProjectViews`, which
    overlays a plan's unapplied operations, so the two-pages-that-link-to-each-other plan may
    already stage clean.
- **DEF-007 §3.2** — 56 decisions on `site-builder.content.json`. ⚠️ **Phase 77 is still live on
  that file** — it landed `505d9b38` during s23 and its D30/D31 lane is open. Check
  `git log -5 -- packages/noodl-editor/src/editor/src/models/template/templates/site-builder.content.json`
  and its mtime before touching it.
- **The unowned register has five rows marked *not re-measured*** (they need a live backend, a
  screen or a run — see the sweep table in TASKS.md). Any of them is honest work for a session
  with a backend up; none is a phase-80 row until someone measures it.

## Traps carried

- 🔴 **A drive serves a BUILT bundle.** `render-report.js` serves
  `packages/noodl-editor/src/external/viewer/noodl.viewer.js`, a **gitignored artifact**. A
  `noodl-viewer-react/src` change is invisible to any noodl-mcp drive until
  `cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js`
  (~40s). s23's first post-fix drive came back **9/9 RED** for this reason alone and read exactly
  like a broken fix. ⚠️ It is **shared and mutable on this checkout** — check for a running drive
  before rebuilding.
- ⚠️ **dist staleness (standing)**: a *running* MCP server answers without
  `query-fetches-before-its-filter` and 018–024/026's codes until rebuilt. DEF-027 changed the
  viewer, so `cloudruntime/sandbox.viewer.bundle.js` may owe a rebuild too — unmeasured.
- 🔴 **Make the peer-check its own tool call and READ it before starting a suite.** s23 issued
  `ps` and the suite in one command, ran a viewer-react suite plus a webpack build beside a
  peer's backend suite, and paid for it with a BLD-004 flake that had to be re-run alone.
- 🔴 **A pathspec commit sweeps a sibling's edit** — s23's D28 update to phase 77's register went
  in under `505d9b38`, someone else's commit. Harmless here (committed, not lost), but it is why
  `git log <file>` will not show s23's message for that change.
- 🔴 **Cite a package with a filename.** The register's `cloudFunctions.test.ts:85` is under
  `noodl-editor/tests/cloud/`, not `nodegx-backend/tests/`, and the wrong guess reads as *"the
  gate was deleted"*. Run a control grep for a string that IS there before concluding absence.
- 🔴 **A full-suite run piped to `tail` loses the failure names** — redirect to a file, grep
  `^FAIL` / `●`.
- 🔴 **`git checkout -- <file>` is not a mutant undo** — python string-swap restores only, with
  md5 parity after.

## Gates (s23 — full table in TASKS.md § *Gates — s23*)

4 typechecks clean · viewer-react **1100/1100** · noodl-mcp **994/994** · `ac2DragGestureDrive`
**9/9** both sides of the fix · `test:ci` **2905 specs, 4 failures, all AIX-006 by name — the
floor** · editor jest **6453/6458**, the five reds attributed (one flake, four a peer's
uncommitted template edits), and `queryBeforeFilter.test.ts` **PASS** — the reading s22 owed.
