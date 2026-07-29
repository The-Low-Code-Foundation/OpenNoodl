# Phase 30 — next session handover (written for Opus, 2026-07-29)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree **still** carries another session's uncommitted work (Blockly editor,
`logic-builder.ts` + untracked `logic-builder-io.ts`, icon assets, core-ui icons, and the two
`node-catalog*.json` files) that must never ride along. End commit messages with the Claude
co-author line.

## Where the phase stands

**Tier 1 is done and live-verified.** NDA-001 corpus (`7a27e7c3`), NDA-013 (`0e96c93a`), NDA-002
(`bd6632ca`…`825da393`), NDA-003 (`e707f0cc`…`b2032129`), NDA-014 (`61e8b3da`).

**Tier 2 is now more than half done.** Since the last handover: NDA-016 complete (`2c50bafc`),
NDA-015 complete all three sections and live-verified (`22bdf4d6`, `930a9451`), NDA-010 §2 complete
with it, NDA-008 §0/§1/§3 complete (`0db1d770`, `44ee7e1d`). NDA-004 §1 is built with 8 of the mute
10 reporting.

Six normative docs in `dev-docs/reference/`: `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`,
`FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`.
`BINDING-CONTRACT.md` now has a **"How to obey it"** section naming the helpers — read it before
writing any node that finds something by walking.

Gates as of `44ee7e1d`, all re-run: **1,072** runtime jest, **125** viewer jest, **1,885** editor
jasmine (0 failures).

## Rules that will bite you if skipped

**The corpus uses `test.failing`.** A red row is green in CI until fixed; the moment your fix makes a
row pass, `test.failing` FAILS loudly — unmark it in the same commit as the fix. Conventions in
`packages/noodl-runtime/test/corpus/README.md`; the viewer half (and the newer non-`test.failing`
contract rows) in `packages/noodl-viewer-react/tests/corpus/README.md`.

**Catalog regeneration folds in ANY uncommitted node-source edits.** After
`node scripts/node-catalog/generate.js` or `npm run catalog:merge`, stage only your hunks
(`git apply --cached` with a filtered diff). A typecast or port change has five consumers:
`nodelibraryexport.ts`, `node-catalog.json`, the register (`node scripts/node-audit/register.js`),
the validator/editor suite, and `docs/node-catalog/compatibility.json` (gates `catalog:merge`).

**Editing runtime types breaks the viewer typecheck until you rebuild declarations.** Run
`npm run build:types` in `packages/noodl-runtime`. A stale `dist-types/` reports the error against
`dist-types/src/internal.d.ts`, not the file you edited. `dist-types/` is gitignored; never commit it.

**Viewer ts-jest targets pre-ES2015.** `for…of` over a `Map` iterator in *runtime* source fails the
entire viewer suite with TS2802 — use `forEach` into an array. Cost one debugging round this session.

**The committed viewer bundles are stale.** `packages/noodl-editor/src/external/*` and
`packages/nodegx-backend/deploy/artifact/` embed old copies. Anything grading those artefacts is
testing old code. The dev webpack watch does not dirty them.

**Editor tests are jasmine-not-jest:** `cd packages/noodl-editor && npm run test:ci` (webpack +
electron, ~6 min, run in background). Runtime/viewer are plain jest (`npx jest` **from inside the
package** — running it from the repo root picks up the root babel config and fails on `import type`).

**FINDINGS.md has the defect evidence with file:line citations.** Trust it over the task specs where
they disagree — **eight** spec claims have now fallen to implementation.

## Driving the editor — the corrections that cost time

Use the `run-editor` skill for the basics. Additions:

- `pkill` (SIGTERM) does not kill the dev Electron. Use `pkill -9 -f "OpenNoodl/node_modules/electron/dist"`
  and wait for the pid to go (`until ! pgrep -f … ; do sleep 1; done`). Never `pkill -f Electron`.
- Run every `npm run cdp` **from the repo root**. Bash cwd persists across calls, and a stray
  `cd packages/…` makes every later `cdp` call fail with `Missing script: "cdp"`.
- Getting a graph in front of the editor: back up and overwrite the `project.json` of a registered
  scratch project (`~/Library/Application Support/NodeGX/recently_opened_project.json` lists them;
  `VerifyFix4` is a throwaway), then `npm run cdp -- click "[class*=ProjectCard]"`. **Kill with -9
  before rewriting**, or the shutdown save overwrites you. Restore and `diff` afterwards to prove it.
- **Reaching canvas node views from CDP:** `window.__nodeGraphEditor`. `ed.model.roots` is the graph
  model's roots; `ed.roots` the view roots (with `typeDisplayName()`, `nodeSize`). `ed.forEachNode`
  only walks *visual* roots, so a non-visual node is invisible to it — use `ed.roots` directly.
  `ed.model.roots.find(n => n.id === …).getHealth()` gives the warning text.
- The launcher's "New project" wizard opens as an overlay and silently swallows card clicks. If a
  card click does nothing, check `document.elementFromPoint`.
- `npm run cdp -- click` scrolls its target into view first, so it cannot measure scroll-on-click.
  Use `element.focus()` / `dispatchEvent` directly when the scroll position is the measurement.
- The phase-23 screenshot corpus photographs **editor chrome only**. It cannot see anything
  `noodl-viewer-react` renders, so it is the wrong acceptance test for any viewer/layout change.

## The work, in order

### 1. NDA-004's tail — the largest remaining block, and now unblocked

- **§2's remaining per-node `Failure` outputs.** 9 of the register's list are done. For each
  remaining one the questions are *can it actually fail?* and *does the author need to branch, or
  only to know?* Mark 🔵 in `NODE-REGISTER.md` rather than adding a vestigial port — a `Failure`
  output on a node that cannot fail is worse than nothing. **Run NDA-012's Data and Cloud Services
  worksheets first**; the spec says they are the right input and they will sharpen the list.
- **The last 2 mute nodes: `Response` and `Logic Builder`.** Logic Builder is still blocked —
  another session's rewrite is still uncommitted in `logic-builder.ts`, plus untracked
  `logic-builder-io.ts` and its tests. Check `git status` and skip if still dirty.
- **Criterion 2's cloud-runtime and export legs.** One raised error, observed in all four contexts.
  Editor and browser are covered; cloud and export are not, and the spec itself predicts export is
  the one that gets forgotten. It still is.
- **Catalog regeneration**, still skipped for the same reason (rule 2; the tree is still dirty).
  This is now owed for: `On App Error`, Parent Component Object's `targetComponent`, Close Popup's
  `targetComponent`, Pop Component Stack's `Popped`/`Failure`/`Error`, and Navigate's transition
  ports in replace mode. `nodelibraryexport.ts` reads the live register so the editor picker and
  property panel are already correct — **verified live this session** — only the generated JSON
  snapshot is stale. `NODE-REGISTER.md`'s Mute?/Fail? columns are wrong until this runs; its
  hand-written Verdict column is the current truth and says so at the top.

### 2. `_forEachModel` — the class F tail, and the best-value single fix left

The NDA-015 §2 sweep found the binding class is wider than the two nodes the specs named. **"The
current Repeater item" is resolved by the same kind of walk in five places** — `modelcrudbase.ts`,
`modelnode2.ts`, `dbmodelcrudbase.ts`, `dbmodelnode2.ts`, `javascriptnodeparser._findForEachModel` —
each ending in a silent `undefined`. So **`Id Source = Repeater Item` on a node that is not inside a
Repeater binds to nothing and says nothing.** Full write-up in FINDINGS as **F-ii**.

The shape is already named for you as `findAncestorWithProperty` in `runtime/src/componentwalk.ts`,
and `ResolvedTargetReporter` gives you clause (b) for free. This is five files and five corpus rows,
and it closes the defect class properly rather than in two places.

### 3. NDA-008 §2's one remaining bullet

Only the re-mount bullet is left (criterion 4): re-selecting the *current* component should not
re-mount it. Unverified — check it before assuming it is broken, given this task's record.

### 4. Small residuals (batch them)

- **Live QA of NDA-008 §1/§3 and NDA-010 §2.** All three are jest-only. The §1 rows were shown to
  discriminate and the popup rows too, but nobody has watched a replace animate or a nested Close
  Popup work in the running app.
- Run the screenshot corpus (NDA-002 criterion 3; harness at
  `dev-docs/tasks/phase-23-visual-refresh/corpus/`, `run.sh` is the one-command wrapper).
- Live DOM demo: Function-node `object` output wired to a Text node shows JSON (the cast table is
  verified live; the wiring demo was not performed).
- Unfiled cosmetic: with `useRoutes` on and no page paths set, the Component Stack's
  `_updateUrlWithTopPage` pushes a bare `#` onto the URL.

## Parked / later

**NDA-010 §1 — re-scoped, do not start from the spec body.** Its premise is partly stale:
`showpopup.ts:129-177` **already** derives typed `popupParam-*` from the target component's input
ports and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the
hand-typed `results`/`closeActions` on the *Close Popup* side (the reverse direction from what the
spec assumed) and results being untyped (`*`). The correction is written into the spec in place.

**NDA-010 §3** (stack policy, corpus row F2) is untouched and unchanged.

NDA-005 (port docs — batch with NDA-012), NDA-006 (Columns; slices 1–2 Sonnet, slice 3 needs a
breakpoint decision from Richard, slice 4 gated), NDA-007 §2–3 (build against
`ICON-SOURCE-MODEL.md`), NDA-011 (assessment first), NDA-009 §1 — the editor-time Run Tasks template
check, which catches F1's mistake earlier than the runtime backstop NDA-004 added.

## Executor guidance

Spec metadata names a recommended executor per task/section. Implementation against a red corpus with
a written contract is reliably delegable. **Live diagnosis and anything touching cross-cutting
runtime semantics deserve Opus directly.**

The phase's single most reliable lesson, now with eight data points: **a spec premise is a hypothesis,
not a fact.** NDA-016's, NDA-008 §0's, NDA-015 §1's canvas-surface suggestion, NDA-015 §3's FIXME,
NDA-010 §1's port derivation, NDA-008 §3's "two failures" (there were three), plus two smaller ones —
all fell to reading or running the code. A mechanical pass would have implemented each specced fix and
left the real defect in place. **Read the implementation before you build against the brief.**

Second lesson, cheap to apply: **a success criterion can name the wrong instrument.** NDA-016
criterion 4 demanded a screenshot-corpus run for a change the corpus cannot photograph. Say so, and
run the check that does apply, rather than collecting a meaningless green or silently skipping.

Third: **show your rows discriminate.** Every fix this session was verified by temporarily removing
the fix and confirming the right rows go red while the pinned control stays green. It caught nothing
this time, which is the point — it is cheap and it is the difference between a test and a decoration.

Fence agent territories by file and forbid them `PROGRESS.md` — the coordinator owns it. Update
`PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks land, not at the end.
