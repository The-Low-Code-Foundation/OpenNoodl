# Phase 30 — next session handover (written for Opus, 2026-07-29)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree **still** carries another session's uncommitted work (Blockly editor,
`logic-builder.ts` + untracked `logic-builder-io.ts` and its two test files, icon assets, core-ui
icons, and both `node-catalog*.json` files) that must never ride along. End commit messages with the
Claude co-author line.

## Where the phase stands

**Tier 1 is done and live-verified.** NDA-001 corpus (`7a27e7c3`), NDA-013 (`0e96c93a`), NDA-002
(`bd6632ca`…`825da393`), NDA-003 (`e707f0cc`…`b2032129`), NDA-014 (`61e8b3da`).

**Tier 2 is most of the way through.** Since the last handover: **NDA-008 is complete** — §2 landed
(`63f76b62`) on top of §0/§1/§3 (`0db1d770`, `44ee7e1d`) — and **defect class F is closed**
(`d15ac7df`). Already done before that: NDA-016 (`2c50bafc`), NDA-015 all three sections + live QA
(`22bdf4d6`, `930a9451`), NDA-010 §2. NDA-004 §1 is built with 8 of the mute 10 reporting.

Six normative docs in `dev-docs/reference/`: `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`,
`FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`.
**`BINDING-CONTRACT.md` has grown two sections worth reading before you touch anything that resolves
a target without a wire**: "How to obey it" names the helpers, and "The two walks" is a table you
will otherwise get wrong.

Gates as of `63f76b62`, all re-run: **1,075 runtime jest, 145 viewer jest, 1,885 editor jasmine
(0 failures)**.

## Rules that will bite you if skipped

**The corpus uses `test.failing`.** A red row is green in CI until fixed; the moment your fix makes a
row pass, `test.failing` FAILS loudly — unmark it in the same commit as the fix. Conventions in
`packages/noodl-runtime/test/corpus/README.md`; the viewer half (and the newer non-`test.failing`
contract rows) in `packages/noodl-viewer-react/tests/corpus/README.md`.

**Catalog regeneration folds in ANY uncommitted node-source edits.** After
`node scripts/node-catalog/generate.js` or `npm run catalog:merge`, stage only your hunks
(`git apply --cached` with a filtered diff). A typecast or port change has **five** consumers:
`nodelibraryexport.ts`, `node-catalog.json`, the register (`node scripts/node-audit/register.js`),
the validator/editor suite, and `docs/node-catalog/compatibility.json` (gates `catalog:merge`).

**Editing runtime types breaks the viewer typecheck until you rebuild declarations.** Run
`npm run build:types` in `packages/noodl-runtime`. A stale `dist-types/` reports the error against
`dist-types/src/internal.d.ts`, not the file you edited. `dist-types/` is gitignored; never commit it.

**Viewer ts-jest targets pre-ES2015.** `for…of` over a Map iterator in runtime source fails the
entire viewer suite with TS2802 — use `forEach` into an array.

**The committed viewer bundles are stale.** `packages/noodl-editor/src/external/*` and
`packages/nodegx-backend/deploy/artifact/` embed old copies. Anything grading those artefacts is
testing old code. The dev webpack watch does not dirty them.

**Editor tests are jasmine-not-jest**: `cd packages/noodl-editor && npm run test:ci` (webpack +
electron, ~6 min, run in background). Runtime/viewer are plain jest (`npx jest` from *inside* the
package — running it from the repo root picks up the root babel config and fails on `import type`).

⚠️ **The runtime jest count is not reproducible from a clean checkout.** Jest picks up the other
session's uncommitted `logic-builder-*.test.ts` files, so "1,075" includes them. Trust the *delta*
you introduce, not the absolute number.

`FINDINGS.md` has the defect evidence with `file:line` citations. Trust it over the task specs where
they disagree — **eleven** spec claims have now fallen to implementation.

## Driving the editor — the corrections that cost time

Use the `run-editor` skill for the basics. Additions:

- `pkill` (SIGTERM) does not kill the dev Electron. Use
  `pkill -9 -f "OpenNoodl/node_modules/electron/dist"` and wait for the pid to go
  (`until ! pgrep -f … ; do sleep 1; done`). Never `pkill -f Electron`.
- Run every `npm run cdp` **from the repo root**. Bash cwd persists across calls, and a stray
  `cd packages/…` makes every later `cdp` call fail with `Missing script: "cdp"`.
- Getting a graph in front of the editor: back up and overwrite the `project.json` of a registered
  scratch project (`~/Library/Application Support/NodeGX/recently_opened_project.json` lists them;
  `VerifyFix4` is a throwaway), then `npm run cdp -- click "[class*=ProjectCard]"`. Kill with `-9`
  before rewriting, or the shutdown save overwrites you. Restore and diff afterwards to prove it.
- Reaching canvas node views from CDP: `window.__nodeGraphEditor`. `ed.model.roots` is the graph
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

### 1. NDA-004's tail — now the largest remaining block by a distance

- **§2's remaining per-node `Failure` outputs.** 9 of the register's list are done. For each
  remaining one the questions are *can it actually fail?* and *does the author need to branch, or
  only to know?* Mark 🔵 in `NODE-REGISTER.md` rather than adding a vestigial port — a `Failure`
  output on a node that cannot fail is worse than nothing. Run NDA-012's **Data** and **Cloud
  Services** worksheets first; the spec says they are the right input and they will sharpen the list.
- **The last 2 mute nodes: `Response` and `Logic Builder`.** Logic Builder is still blocked —
  another session's rewrite is still uncommitted in `logic-builder.ts`, plus untracked
  `logic-builder-io.ts` and its tests. **Check `git status` and skip if still dirty.**
- **Criterion 2's cloud-runtime and export legs.** One raised error, observed in all four contexts.
  Editor and browser are covered; cloud and export are not, and the spec itself predicts export is
  the one that gets forgotten. It still is.
- **Catalog regeneration**, still skipped for the same reason (rule 2; the tree is still dirty). Now
  owed for: `On App Error`; Parent Component Object's `targetComponent`; Close Popup's
  `targetComponent`; Pop Component Stack's `Popped`/`Failure`/`Error`; Navigate's transition ports in
  replace mode; and **`repeaterComponent` on seven node types** — Object (`Model2`), Record
  (`DbModel2`), Set Object Properties, Set Record Properties, Delete Record, Add Record Relation,
  Remove Record Relation. (The two `Create New …` nodes correctly do *not* get it:
  `addModelId({ includeOutputs: true })` leaves `includeInputs` falsy, which is right for a node that
  creates rather than references.) `nodelibraryexport.ts` reads the live register so the editor
  picker and property panel are already correct — verified live — only the generated JSON snapshot is
  stale. **`NODE-REGISTER.md`'s `Mute?`/`Fail?` columns are wrong until this runs**; its hand-written
  Verdict column is the current truth and says so at the top.

### 2. Live QA — the biggest un-run instrument, and it is now three tasks deep

Everything below has passed jest and **nobody has watched it in the running app**. Batch it into one
session with a scratch project; it is one editor launch, not five.

- **Class F (`d15ac7df`)** — an Object node with `Id Source = From repeater` outside a Repeater
  should show the danger ring and `repeater-item/no-item-in-scope`; inside one, its card should read
  `→ /Item` in the sub-label slot. Nested Repeaters with `Repeater Component` set should reach the
  outer item. The sub-label path itself was live-verified for NDA-015, so this is checking the new
  *producers*, not the channel.
- **NDA-008 §2 (`63f76b62`)** — click the active tab in a Component Stack and confirm the tab keeps
  its state, the stack does not grow, and the Navigate node's `Navigated` signal *still fires*.
- **NDA-008 §1/§3 and NDA-010 §2** — a replace that animates, and a nested Close Popup.
- Run the **screenshot corpus** (NDA-002 criterion 3; harness at
  `dev-docs/tasks/phase-23-visual-refresh/corpus/`, `run.sh` is the one-command wrapper).
- **Live DOM demo**: Function-node `object` output wired to a Text node shows JSON (the cast table is
  verified live; the wiring demo was not performed).

### 3. Small residuals

- **`Set Parent Component Object Properties` has no explicit target.** It now shares the walk and the
  type list, so it can no longer disagree with its reader — but BINDING-CONTRACT §(a) is still owed.
  It is the last ⚠️ row in that doc's table. Small, and the pattern is right there in
  `parentcomponentobject.ts`.
- **Unfiled cosmetic:** with `useRoutes` on and no page paths set, the Component Stack's
  `_updateUrlWithTopPage` pushes a bare `#` onto the URL.

## Parked / later

- **NDA-010 §1 — re-scoped, do not start from the spec body.** Its premise is partly stale:
  `showpopup.ts:129-177` already derives typed `popupParam-*` from the target component's input ports
  and `closeResult-*`/`closeAction-*` from its Close Popup nodes. The real gaps are the hand-typed
  `results`/`closeActions` on the *Close Popup* side and results being untyped (`*`). The correction
  is written into the spec in place.
- **NDA-010 §3** (stack policy, corpus row F2) is untouched and unchanged.
- **NDA-005** (port docs — batch with NDA-012), **NDA-006** (Columns; slices 1–2 Sonnet, slice 3
  needs a breakpoint decision from Richard, slice 4 gated), **NDA-007 §2–3** (build against
  `ICON-SOURCE-MODEL.md`), **NDA-011** (assessment first), **NDA-009 §1** — the editor-time Run Tasks
  template check, which catches F1's mistake earlier than the runtime backstop NDA-004 added.

## Executor guidance

Spec metadata names a recommended executor per task/section. Implementation against a red corpus with
a written contract is reliably delegable. **Live diagnosis and anything touching cross-cutting
runtime semantics deserve Opus directly** — class F was five files across three packages, and the
valuable part of it was not the code.

**The phase's single most reliable lesson, now with eleven data points: a spec premise is a
hypothesis, not a fact.** NDA-016's, NDA-008 §0's, NDA-015 §1's canvas-surface suggestion, NDA-015
§3's FIXME, NDA-010 §1's port derivation, NDA-008 §3's "two failures" (there were three), NDA-008
§2's "a re-mount" (it was a re-mount *and* a duplicate stack entry), and F-ii's "five silent
bindings" (one of them was a crash) — all fell to reading or running the code. A mechanical pass
would have implemented each specced fix and left the real defect in place.

**Second lesson, sharpened this session: a claim that something was cleaned up is a hypothesis too.**
NDA-015 recorded "one implementation now, in `componentwalk.ts`". It was one of four call sites, and
the three left behind carried divergent type lists that made a *reader and a writer of the same
state* land on different components. Re-check "de-duplicated", "unified", "now shared" the same way
you re-check a defect claim.

**Third: a success criterion can name the wrong instrument.** NDA-016 criterion 4 demanded a
screenshot-corpus run for a change the corpus cannot photograph. Say so, and run the check that does
apply, rather than collecting a meaningless green or silently skipping.

**Fourth: show your rows discriminate.** Every fix this session was verified by temporarily removing
the fix and confirming the right rows go red while the pinned controls stay green. It is cheap, and
it is the difference between a test and a decoration. It also catches the *fixture* being too thin:
NDA-008's fake stack entries carried only `pageInfo.label`, which would have made every §2 row pass
by never matching anything — the revert pass is what exposes that.

Fence agent territories by file and forbid them `PROGRESS.md` — the coordinator owns it. Update
`PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks land, not at the end.

## Traps banked this session

- **The `_forEachModel` sites are in `packages/noodl-runtime/src/`, not the viewer.** FINDINGS' bare
  `data/…` prefixes read as viewer paths and are not. (Corrected in place.)
- **There are two component walks and they are not interchangeable** — see BINDING-CONTRACT's table.
  `componentAncestors`/`findAncestorWith*` take the *visual* parent when there is one and exclude
  self; `scopeChain` follows `parentNodeScope` only and **includes** self. Ambient properties
  (`_forEachModel`, `_popupCloseHandler`) need the second. Collapsing them looks like tidying and
  silently moves bindings.
- **Whether clause (c) needs an "is it loud yet" gate depends on the protocol.** Hunting a *node* in
  an ancestor's scope does (it may not exist yet). Reading an *ambient property* does not —
  `extraProps` land at `nodecontext.ts:398-403`, before `setComponentModel` builds any inner node.
  Check which case you have before copying either file's timing.
- **Where a resolution is computed for every node whether or not it is wanted, make it lazy.** A
  getter on the Function node's component scope is safe because the scope is handed to the user's
  script by reference, never spread or serialised.
- **Run Tasks tears down its task components when a run completes**, so a node inside one is gone by
  the time you look. Leave the template's completion unwired to hold the instance open for probing.
- A `.js` file in `noodl-runtime/src` can `require` a `.ts` sibling — jest transforms both, and
  `javascriptnodeparser.js` already did it for `./model`.
