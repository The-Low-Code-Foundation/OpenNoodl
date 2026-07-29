# Phase 30 — next session handover (written for Opus, 2026-07-29)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree carries other sessions' uncommitted work (Blockly/logic-builder edits,
icon assets, core-ui icons) that must never ride along. End commit messages with the Claude
co-author line.

## Where the phase stands

**Tier 1 is done and live-verified.** NDA-001 corpus (`7a27e7c3`), NDA-013 Repeater Refresh
(`0e96c93a`), NDA-002 reactivity (`bd6632ca`…`825da393`), NDA-003 empty values
(`e707f0cc`…`b2032129`), NDA-014 type dead ends including its fifth consumer (`61e8b3da`).

**NDA-004 §1 is built** (`8cca1a76`…`df9038b3`). The runtime error channel exists, `On App Error`
ships, corpus rows F1/F1′ are green, and 7 of the mute 10 now report. Details below — read them
before touching anything that raises.

Six normative docs in `dev-docs/reference/`: `REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`,
`FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`, `BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`.
Every fix in this phase is measured against the NDA-001 corpus and must obey those contracts.

Gates all green as of `df9038b3`: **1,072** runtime jest, **87** viewer jest, **1,885** editor
jasmine.

## Rules that will bite you if skipped

1. **The corpus uses `test.failing`.** A red row is green in CI until fixed; the moment your fix
   makes a row pass, `test.failing` FAILS loudly — unmark the row in the same commit as the fix.
   Conventions in `packages/noodl-runtime/test/corpus/README.md`; viewer half in
   `packages/noodl-viewer-react/tests/corpus/`. The README's ownership table says which task turns
   which rows green (F1/F1′ are now marked done there).
2. **Catalog regeneration folds in ANY uncommitted node-source edits in the tree.** After
   `node scripts/node-catalog/generate.js` or `npm run catalog:merge`, stage only your hunks
   (`git apply --cached` with a filtered diff). A typecast or port change has **five** consumers:
   `nodelibraryexport.ts`, `node-catalog.json`, the register (`node scripts/node-audit/register.js`),
   the validator/editor suite, and `docs/node-catalog/compatibility.json` (castSemantics +
   verifiedPairs — gates `catalog:merge`).
3. **Editing runtime types breaks the viewer typecheck until you rebuild declarations.** Run
   `npm run build:types` in `packages/noodl-runtime`. A stale `dist-types/` reports the error
   against `dist-types/src/internal.d.ts`, *not* against the file you edited — which reads as a
   mysterious pre-existing failure. `dist-types/` is gitignored; never commit it.
4. **Editor driving:** use the `run-editor` skill. Launch detached, wait ~90s for the compile,
   `npm run cdp -- health` first. Preview is `--target=viewer`. Kill with the exact patterns in the
   skill doc, never `pkill -f Electron`. New this session: the reachable node-library handle from
   CDP is **`window.NodeLibraryData`** — the `@noodl-models/*` webpack aliases do NOT resolve under
   `require` at runtime. The viewer target exposes **no** runtime handle on `window`, so you cannot
   probe `context.errorBus` inside a live preview that way; drive it through a real graph instead.
5. **The committed viewer bundles are stale.** `packages/noodl-editor/src/external/*` and
   `packages/nodegx-backend/deploy/artifact/` embed pre-Proxy copies of `collection.ts` and
   pre-channel copies of `node.ts`. Anything grading those artifacts is testing old code.
6. **Editor tests are jasmine-not-jest**: `cd packages/noodl-editor && npm run test:ci` (webpack +
   electron, slow, run in background). Runtime/viewer are plain jest.
7. The eight nodes' defect evidence with file:line citations is in `FINDINGS.md`. Trust it over the
   task specs where they disagree — four spec claims have now fallen to implementation (E6 was
   worse than specced; Array Filter never had the stale-copy bug; E8's propagation already worked;
   and NDA-004 §3's "Function needs a reserved name" problem turned out to solve itself).

## What NDA-004 §1 actually built — read before extending it

The channel is `packages/noodl-runtime/src/runtimeerror.ts`. Nodes raise through
`this.raiseRuntimeError(code, message, detail?)`; the runtime fills in `nodeId`, `componentName`
and `nodeType`, so call sites stay one line and cannot misattribute. `code` is stable, kebab-case,
namespaced by node type (`'run-tasks/no-completion-output'`) — tests and the `On App Error` node's
`Filter` input both match on the prefix, so **treat `code` as an interface and reword only
`message`**.

`sendWarning` is a *subscriber* now, not the channel. Contexts with an `editorConnection` get the
editor adapter; contexts without get a structured `console.error`. Delivery is deliberately
hardened: a throwing subscriber cannot stop the others, unsubscribing mid-delivery does not skip a
neighbour, and re-entrant raises are depth-bounded (an `On App Error` whose own downstream graph
fails must not recurse the stack away).

Non-obvious facts you would otherwise re-derive:

- **The Function node's reserved-name problem solves itself.** Every author-declared output is
  registered as `'out-' + name`, so any built-in port *without* that prefix is unreachable from
  user code. `Outputs.success` in a script writes to `out-success`, a different port from the new
  `success` signal. There is a test pinning that.
- **Collection listener throws cannot be attributed to a node.** `Array.prototype.on` keeps no node
  reference, so they go through `raiseUnattributedRuntimeError` (module-level ambient bus, last
  `NodeContext` wins — exact in every real deployment, one context per JS realm). It falls back to
  `console.error` when no context exists yet, because `Array.prototype` is patched at *import* time
  and a collection can notify before any context is built. That gap is written into
  `FAILURE-CONTRACT.md` rather than papered over.
- **The Repeater's honest completion moment is the queue drain, not `refresh()` returning.** With
  `repeaterCreateComponentsAsync` those differ by several frames. `Items Rendered` fires only when
  the drain actually did work — a completion signal that fires when nothing completed is
  indistinguishable from noise.
- **Only count `window.open` returning null as blocked when `_blank` was requested.** Same-tab
  navigation returns null legitimately in some browsers, and a `Failure` port that cries wolf gets
  ignored, which is worse than not having one.

## The work, in order

### 1. NDA-016 §0 — the sizeMode contradiction (start here; live diagnosis, then the fix)

Blocking §0: `layout.ts:60-67` has no `else` for an unset `sizeMode`, but
`node-shared-port-definitions.ts:638-653` declares `default: 'contentHeight'` and
`react-component-node.ts:823-841` copies defaults into props — so on paper the symptom cannot
happen, yet it does. Diagnose in the running editor (two Text nodes side by side; watch what
`props.sizeMode` actually is and where it gets dropped). Only then apply the spec's fix. 29-node
blast radius; the screenshot corpus is the regression gate.

First because it is a live-diagnosis task that has now been deferred twice, and because it is Opus
work — do not hand it to an agent.

### 2. NDA-008 §0 — reproduce the Component Stack scroll jump

There is **no** `scrollIntoView`/`scrollTo` in `navigation-stack.tsx` — the cause is not located.
Reproduce live before speccing anything (browser focus restoration, router, and Page mount are the
suspects). If it cannot be reproduced, record that and stop; do not fix blind.

### 3. NDA-015 §2 + NDA-010 §2 — explicit binding, applied

Per `BINDING-CONTRACT.md`: optional named target (explicit-miss is a failure, never a fallback),
resolved target visible on the canvas (check phase 28's CAN-001/002 label mechanism before
inventing one), loud failure through the NDA-004 channel — **which now exists, so this is
unblocked**. Includes the §2 sweep (`getNodesWithType` / `parentNodeScope` / `getVisualParentNode` /
`componentOwner` walks) and the `parentcomponentobject.ts:88` FIXME (§3).

Close Popup is shared with NDA-010 §2. NDA-004 gave it `Closed`/`Failure`/`Error` and made
"no popup in scope" report — **the reporting half is done, the targeting half is yours.** Read both
specs together and do not re-do the ports.

### 4. NDA-004's tail (delegable; batch it around the above)

- **§2's remaining per-node `Failure` outputs.** 8 of the register's list are done. For each
  remaining one the questions are *can it actually fail?* and *does the author need to branch, or
  only to know?* Mark 🔵 in `NODE-REGISTER.md` rather than adding a vestigial port — a `Failure`
  output on a node that cannot fail is worse than nothing. **Run NDA-012's Data and Cloud Services
  worksheets first**; the spec says they are the right input to §2 and they will sharpen the list.
- **The last 3 mute nodes**: Pop Component Stack, Response, Logic Builder. **Logic Builder is
  blocked** — another session is mid-rewrite in `logic-builder.ts`; check `git status` before
  touching it and skip if still dirty.
- **Criterion 2's cloud-runtime and export legs.** One raised error, observed in all four contexts.
  Editor and browser are covered; cloud and **export** are not, and the spec itself predicts export
  is the one that gets forgotten. It now is.
- **Catalog regeneration** for `On App Error` and the new ports — skipped this session because the
  tree carried another session's uncommitted `logic-builder` rewrite. `nodelibraryexport.ts` reads
  the live register so the editor picker is already correct; only the generated JSON snapshot is
  stale. `NODE-REGISTER.md`'s `Mute?`/`Fail?` columns are wrong for 8 rows until this runs; its
  hand-written `Verdict` column is the current truth and says so at the top of the file.

### 5. Small residuals from Tier 1 (batch them when convenient)

- Run the screenshot corpus (NDA-002 success criterion 3; harness recorded in the `uix-009` memory).
- Live DOM demo: Function-node `object` output wired to a Text node shows JSON (the cast table is
  verified live; the wiring demo was not performed).

### Parked / later

NDA-005 (port docs — batch with NDA-012), NDA-006 (Columns; slices 1–2 Sonnet, slice 3 needs a
breakpoint decision from Richard, slice 4 gated), NDA-007 §2–3 (build against
`ICON-SOURCE-MODEL.md`), NDA-011 (assessment first), NDA-009 §1 — the *editor-time* Run Tasks
template check, which catches F1's mistake earlier than the runtime backstop NDA-004 added.

## Executor guidance

Spec metadata names a recommended executor per task/section. Two runs now agree: implementation
against a red corpus with a written contract is reliably delegable (Sonnet did NDA-013 and NDA-003
cleanly, and would have done NDA-004 §2). **Live diagnosis (§0 tasks) and anything touching
cross-cutting runtime semantics deserve Opus directly** — the error channel's delivery semantics,
the Repeater's drain timing and the Function node's port namespacing were all judgement calls a
mechanical pass would have got subtly wrong.

Fence agent territories by file and forbid them `PROGRESS.md` — the coordinator owns it. Update
`PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks land, not at the end.
