# Phase 30 — next session handover (written for Opus, 2026-07-29)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree still carries another session's uncommitted work (Blockly/logic-builder
edits, icon assets, core-ui icons) that must never ride along. End commit messages with the Claude
co-author line.

## Where the phase stands

**Tier 1 is done and live-verified.** NDA-001 corpus (`7a27e7c3`), NDA-013 Repeater Refresh
(`0e96c93a`), NDA-002 reactivity (`bd6632ca`…`825da393`), NDA-003 empty values
(`e707f0cc`…`b2032129`), NDA-014 type dead ends including its fifth consumer (`61e8b3da`).

**NDA-004 §1 is built** (`8cca1a76`…`df9038b3`). The runtime error channel exists, `On App Error`
ships, corpus rows F1/F1′ are green, and 7 of the mute 10 now report. Read the NDA-004 section
below before touching anything that raises.

**Both blocking §0 tasks are now resolved, and both had been aimed at the wrong file.**
NDA-016 is complete (`2c50bafc`); NDA-008 §0 is answered and the task re-scoped (`ebe47758`).
That is two spec premises falsified by one reading of the running app — treat it as the phase's
most reliable lesson, not a coincidence. See "What §0 changed" below.

Six normative docs in `dev-docs/reference/`: `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`,
`FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`.
Every fix in this phase is measured against the NDA-001 corpus and must obey those contracts.

Gates: **1,072** runtime jest and **1,885** editor jasmine as of `df9038b3` — not re-run since, as
last session touched only `noodl-viewer-react`. Viewer jest is **97** as of `2c50bafc`.

## Rules that will bite you if skipped

1. **The corpus uses `test.failing`.** A red row is green in CI until fixed; the moment your fix
   makes a row pass, `test.failing` FAILS loudly — unmark the row in the same commit as the fix.
   Conventions in `packages/noodl-runtime/test/corpus/README.md`; viewer half in
   `packages/noodl-viewer-react/tests/corpus/`. The README's ownership table says which task turns
   which rows green.
2. **Catalog regeneration folds in ANY uncommitted node-source edits in the tree.** After
   `node scripts/node-catalog/generate.js` or `npm run catalog:merge`, stage only your hunks
   (`git apply --cached` with a filtered diff). A typecast or port change has **five** consumers:
   `nodelibraryexport.ts`, `node-catalog.json`, the register (`node scripts/node-audit/register.js`),
   the validator/editor suite, and `docs/node-catalog/compatibility.json` (castSemantics +
   verifiedPairs — gates `catalog:merge`).
3. **Editing runtime types breaks the viewer typecheck until you rebuild declarations.** Run
   `npm run build:types` in `packages/noodl-runtime`. A stale `dist-types/` reports the error
   against `dist-types/src/internal.d.ts`, *not* against the file you edited. `dist-types/` is
   gitignored; never commit it.
4. **The committed viewer bundles are stale.** `packages/noodl-editor/src/external/*` and
   `packages/nodegx-backend/deploy/artifact/` embed pre-Proxy copies of `collection.ts` and
   pre-channel copies of `node.ts`. Anything grading those artifacts is testing old code. The dev
   webpack watch does *not* dirty them — the working tree stayed clean across four dev launches
   last session.
5. **Editor tests are jasmine-not-jest**: `cd packages/noodl-editor && npm run test:ci` (webpack +
   electron, slow, run in background). Runtime/viewer are plain jest (`npx jest` in the package).
6. `FINDINGS.md` has the defect evidence with file:line citations. Trust it over the task specs
   where they disagree — **six** spec claims have now fallen to implementation. Two of those are
   marked SUPERSEDED in place rather than deleted; read the superseding note before the body.

## Driving the editor — the parts that cost time last session

Use the `run-editor` skill for the basics. These are the corrections and additions:

- **`pkill` (SIGTERM) does not kill the dev Electron.** It survives, keeps port 9222, and the next
  `dev:debug` dies on the single-instance lock — whose cleanup then kills the *new* helpers, not
  the old one. The log line is `Noodl is already running.` followed by `bind() failed`. Use
  `pkill -9 -f "OpenNoodl/node_modules/electron/dist"` and **wait for the pid to actually go**
  (`until ! pgrep -f … ; do sleep 1; done`) before relaunching. Never `pkill -f Electron`.
- **Run every `npm run cdp` from the repo root.** Bash cwd persists across calls in this harness,
  and a stray `cd packages/…` makes every later cdp call fail with `Missing script: "cdp"`.
- **Getting a graph in front of the editor cheaply**: back up and overwrite the `project.json` of a
  registered scratch project (`~/Library/Application Support/NodeGX/recently_opened_project.json`
  lists them; `VerifyFix4` under `NodeGX test projects/` is a throwaway), then click its launcher
  card. Kill the editor with `-9` before rewriting the file, or the shutdown save overwrites you.
  Restore the backup afterwards and diff it to prove the restore.
- **The launcher's "New project" wizard opens as an overlay over the cards** and silently swallows
  card clicks. If a card click does nothing, check `document.elementFromPoint` — you probably have
  a `ProjectCreationWizard` open. Cancel it first.
- **Reaching runtime nodes from the preview.** The viewer target exposes no runtime handle on
  `window`, but every visual node's DOM element leads back to its node: find the `__reactFiber$…`
  key on the element and walk `.return` until `memoizedProps.noodlNode`. From there `props`,
  `setInputValue`, `getVisualParentNode`, `getChildren` and the node's own methods are all live.
  Walking DOM *ancestors* the same way gives you the whole node chain
  (`Text → Group → Page Stack → Page → Router`), which is how you get at a container node.
- **The runtime frame counter only advances when the update loop runs.** State written by
  `setInputValue` may not be committed to the DOM in the same `eval`. Read it back in a *later*
  cdp call, not the same one.
- **`npm run cdp -- click` scrolls its target into view first**, so it cannot be used to measure
  scroll-on-click. Use `element.focus()` / `dispatchEvent` directly when the scroll position is the
  measurement.
- **The phase-23 screenshot corpus photographs editor chrome only** — launcher, panels, property
  editor, the Canvas2D graph. It cannot see anything `noodl-viewer-react` renders, so it is the
  wrong acceptance test for any viewer/layout change; running it there greens having tested
  nothing. It is still genuinely owed to NDA-002 criterion 3.

## What §0 changed (read before NDA-008 or anything layout-shaped)

**NDA-016 — `sizeMode` is never unset.** A fresh, never-touched Text node reads
`props.sizeMode === 'contentHeight'` and `props.width === '100%'`; so does every one of 15 visual
node types placed with no parameters. The editor never writes a `sizeMode` parameter — it does not
reference `sizeMode` at all — so there was no persistence defect to file either.

The real defect, and **the reusable rule: anything a child reads off its parent at render time is
invisible to `forceUpdate`.** `render`'s `noodlNodeAsProp` block copies `parent.props.layout` into
the child's `parentLayout` when the *child* renders, and `renderChildren` memoises the elements in
`cachedChildren`, which is invalidated only by `addChild`/`removeChild`/`_resetReactVirtualDOM`. An
editor parameter edit reaches the node via `queueInput → setInputValue → input.set` and touches
none of them. `setLayout()` is now the single writer of `props.layout` after init. If another
parent-read prop is ever added, it needs the same treatment.

§1 was still worth building, from a direction the spec missed: `defineRegularInputProp` **deletes**
the prop when a value is `undefined`, so a *connection* that abstains unsets the port. The same
setter made `width`/`height`'s `onChange` (`value.isFixed`) a live TypeError.

**NDA-008 — the Component Stack does not scroll.** 0 px moved and 0 `focus()` calls on a switch
(patch `HTMLElement.prototype.focus` and count — the decisive technique), across `navigate`+Push,
`replace`, and `useRoutes` on and off. The trap is `viewer.jsx:344-353`, which wraps the whole app
in `overflow: hidden; width:100%; height:100%` around taller content: **`overflow: hidden` stops
the user scrolling, not the browser**, so a programmatic scroll is one-way and the header never
comes back. Trigger is any real DOM focus — `.focus()` moved it 0 → 1169,
`.focus({preventScroll:true})` 0 → 0 — and the library's only DOM focus is `TextInput`
(`text-input.ts:211-214`).

## The work, in order

### 1. NDA-015 §2 + NDA-010 §2 — explicit binding, applied (start here)

The largest unblocked build in the phase, and the one Richard's reports keep pointing at. Per
`BINDING-CONTRACT.md`: optional named target (explicit-miss is a failure, never a fallback),
resolved target visible on the canvas (check phase 28's CAN-001/002 label mechanism before
inventing one), loud failure through the NDA-004 channel — which now exists, so this is unblocked.
Includes the §2 sweep (`getNodesWithType` / `parentNodeScope` / `getVisualParentNode` /
`componentOwner` walks) and the `parentcomponentobject.ts:88` FIXME (§3).

Close Popup is shared with NDA-010 §2. NDA-004 gave it `Closed`/`Failure`/`Error` and made "no
popup in scope" report — **the reporting half is done, the targeting half is yours.** Read both
specs together and do not re-do the ports.

### 2. A decision for Richard, then NDA-008 §1/§3

**Ask him this before building:** should the viewer's app root stop being a hidden-overflow box
that overflows (`viewer.jsx:344-353`), or should `TextInput` focus with `preventScroll: true`? The
second is a one-line measured fix but would stop a deliberate `Focus` bringing an off-screen field
into view in a container that *is* scrollable. Don't pick for him — it is a product behaviour
question, and it belongs to the viewer rather than to any node in this phase.

NDA-008 §1 (unify replace/stack so both animate) and §3 (Pop Component Stack reports) are unblocked
and unchanged. §2's no-scroll bullet has moved out; §2's second bullet — re-selecting the current
component should not re-mount — is unverified and still worth checking.

### 3. NDA-004's tail (delegable; batch it around the above)

- **§2's remaining per-node `Failure` outputs.** 8 of the register's list are done. For each
  remaining one the questions are *can it actually fail?* and *does the author need to branch, or
  only to know?* Mark 🔵 in `NODE-REGISTER.md` rather than adding a vestigial port — a `Failure`
  output on a node that cannot fail is worse than nothing. **Run NDA-012's Data and Cloud Services
  worksheets first**; the spec says they are the right input to §2 and they will sharpen the list.
- **The last 3 mute nodes**: Pop Component Stack, Response, Logic Builder. **Logic Builder is still
  blocked** — another session's rewrite is still uncommitted in `logic-builder.ts`, plus untracked
  `logic-builder-io.ts` and two new tests. Check `git status` and skip if still dirty.
- **Criterion 2's cloud-runtime and export legs.** One raised error, observed in all four contexts.
  Editor and browser are covered; cloud and **export** are not, and the spec itself predicts export
  is the one that gets forgotten. It still is.
- **Catalog regeneration** for `On App Error` and the new ports — still skipped, still for the same
  reason (rule 2 above; the tree is still dirty). `nodelibraryexport.ts` reads the live register so
  the editor picker is already correct; only the generated JSON snapshot is stale.
  `NODE-REGISTER.md`'s `Mute?`/`Fail?` columns are wrong for 8 rows until this runs; its
  hand-written `Verdict` column is the current truth and says so at the top of the file.

### 4. Small residuals (batch them when convenient)

- Run the screenshot corpus (NDA-002 success criterion 3; harness at
  `dev-docs/tasks/phase-23-visual-refresh/corpus/`, `run.sh` is the one-command wrapper).
- Live DOM demo: Function-node `object` output wired to a Text node shows JSON (the cast table is
  verified live; the wiring demo was not performed).
- Unfiled cosmetic: with `useRoutes` on and no page paths set, the Component Stack's
  `_updateUrlWithTopPage` pushes a bare `#` onto the URL.

### Parked / later

NDA-005 (port docs — batch with NDA-012), NDA-006 (Columns; slices 1–2 Sonnet, slice 3 needs a
breakpoint decision from Richard, slice 4 gated), NDA-007 §2–3 (build against
`ICON-SOURCE-MODEL.md`), NDA-011 (assessment first), NDA-009 §1 — the *editor-time* Run Tasks
template check, which catches F1's mistake earlier than the runtime backstop NDA-004 added.

## Executor guidance

Spec metadata names a recommended executor per task/section. Implementation against a red corpus
with a written contract is reliably delegable — Sonnet did NDA-013 and NDA-003 cleanly. **Live
diagnosis and anything touching cross-cutting runtime semantics deserve Opus directly**: the two §0
tasks last session both overturned their own spec's premise, and a mechanical pass would have
implemented the specced fix and left the real defect in place.

One more thing worth internalising from those two: **a success criterion can name the wrong
instrument.** NDA-016 criterion 4 demanded a screenshot-corpus run for a change the corpus cannot
photograph. Say so, and run the check that does apply, rather than collecting a meaningless green
or silently skipping.

Fence agent territories by file and forbid them `PROGRESS.md` — the coordinator owns it. Update
`PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks land, not at the end.
