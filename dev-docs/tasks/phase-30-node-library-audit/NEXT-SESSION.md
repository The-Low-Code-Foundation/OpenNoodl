# Phase 30 — next session handover (written for Opus, 2026-07-29)

Work on branch `cline-dev`, commit directly to it, no task branches, no PRs. Use explicit pathspecs
on every commit — the tree carries other sessions' uncommitted work (Blockly/logic-builder edits,
icon assets) that must never ride along. End commit messages with the Claude co-author line.

## Where the phase stands

Tier 1 is **done and live-verified** (see `PROGRESS.md`, log entry "Tier 1 complete + live QA"):
NDA-001 corpus (`7a27e7c3`), NDA-013 Repeater Refresh (`0e96c93a`), NDA-002 reactivity
(`bd6632ca`…`825da393`), NDA-003 empty values (`e707f0cc`…`b2032129`), plus NDA-014 type dead ends
including its fifth consumer (`61e8b3da`). Six normative docs now exist in `dev-docs/reference/`:
`REACTIVITY-CONTRACT.md`, `EMPTY-VALUE-CONTRACT.md`, `FAILURE-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`,
`BINDING-CONTRACT.md`, `ICON-SOURCE-MODEL.md`. Every fix in this phase is measured against the
NDA-001 corpus and must obey those contracts.

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
3. **Editor driving:** use the `run-editor` skill. Launch detached, wait ~90s for the compile,
   `npm run cdp -- health` first. The preview is `--target=viewer`. Dev launch rewrites
   `project-examples/agent-chat/project.json` (minifies it, drops rootComponent) — `git checkout`
   it after killing the editor. Kill with the exact patterns in the skill doc, never `pkill -f Electron`.
4. **The committed viewer bundles are stale.** `packages/noodl-editor/src/external/*` and
   `packages/nodegx-backend/deploy/artifact/` embed pre-Proxy copies of `collection.ts`. The dev
   watch build is fine (rebuilt from source); anything that grades those artifacts is testing old
   code until they're rebuilt.
5. **Editor tests are jasmine-not-jest**: `cd packages/noodl-editor && npm run test:ci` (webpack +
   electron, slow, run in background). Runtime/viewer are plain jest.
6. The eight nodes' defect evidence with file:line citations is in `FINDINGS.md`. Trust it over the
   task specs where they disagree — three spec claims have already fallen to implementation (E6 was
   worse than specced; Array Filter never had the stale-copy bug; E8's propagation already worked).

## The work, in order

### 1. NDA-004 §2–3 — failure outputs and the mute 10 (start here)

§1 (the channel design) is decided and written into `FAILURE-CONTRACT.md`. One caveat: the
"both per-node Failure outputs AND a global On App Error node" decision was adopted on the spec's
recommendation without Richard's explicit confirmation — **ask him to confirm or veto before
building the global node**; the channel itself and per-node outputs are safe to start regardless.

Build the channel first (in `noodl-runtime`, per the contract — `sendWarning` becomes a subscriber,
never the channel), then wire the reactivity cycle breakers into it (`outputproperty.ts:123`,
`node.ts:495` — NDA-002 left a TODO referencing the contract, and Collection listener exceptions
currently `console.error` with the same TODO). Then §2 per-node Failure outputs (the 50 from the
register — mark 🔵 the ones that cannot fail rather than adding vestigial ports) and §3 completion
signals for the mute 10 (`Function` and `Repeater` first; `Function` needs reserved output names
that cannot collide with author-declared ones). Corpus rows F1 (+ F1′ hang) are yours; NDA-009 §1
closes F1 properly — coordinate rather than duplicate. The error-object outputs you add are
wireable now because NDA-014's `object → string` cast landed.

### 2. NDA-016 §0 — the sizeMode contradiction (live diagnosis, then the fix)

Blocking §0: `layout.ts:60-67` has no `else` for an unset `sizeMode`, but
`node-shared-port-definitions.ts:638-653` declares `default: 'contentHeight'` and
`react-component-node.ts:823-841` copies defaults into props — so on paper the symptom cannot
happen, yet it does. Diagnose in the running editor (two Text nodes side by side; watch what
`props.sizeMode` actually is and where it gets dropped). Only then apply the spec's fix. 29-node
blast radius; the screenshot corpus is the regression gate.

### 3. NDA-008 §0 — reproduce the Component Stack scroll jump

There is **no** `scrollIntoView`/`scrollTo` in `navigation-stack.tsx` — the cause is not located.
Reproduce live before speccing anything (browser focus restoration, router, and Page mount are the
suspects). If it cannot be reproduced, record that and stop; do not fix blind.

### 4. NDA-015 §2 + NDA-010 §2 — explicit binding, applied

Per `BINDING-CONTRACT.md`: optional named target (explicit-miss is a failure, never a fallback),
resolved target visible on the canvas (check phase 28's CAN-001/002 label mechanism before
inventing one), loud failure through the NDA-004 channel — so this lands after the channel exists.
Includes the §2 sweep (`getNodesWithType` / `parentNodeScope` / `getVisualParentNode` /
`componentOwner` walks) and the `parentcomponentobject.ts:88` FIXME (§3). Close Popup work is
shared with NDA-010 §2 — read both specs together.

### 5. Small residuals from Tier 1 (batch them when convenient)

- Run the screenshot corpus (NDA-002 success criterion 3; harness recorded in the `uix-009` memory).
- Live DOM demo: Function-node `object` output wired to a Text node shows JSON (the cast table is
  verified live; the wiring demo was not performed).
- NDA-012 Data + Cloud Services categories (worksheets in `audit/`) — the spec says they are the
  right input to NDA-004 §2, so doing them first will sharpen the 50-node list.

### Parked / later

NDA-005 (port docs — batch with NDA-012), NDA-006 (Columns; slices 1–2 Sonnet, slice 3 needs a
breakpoint decision from Richard, slice 4 gated), NDA-007 §2–3 (build against
`ICON-SOURCE-MODEL.md`), NDA-011 (assessment first), NDA-009 beyond §1.

## Executor guidance

Spec metadata names a recommended executor per task/section. From the Tier-1 run: implementation
against a red corpus with a written contract is reliably delegable (Sonnet did NDA-013 and NDA-003
cleanly); live diagnosis (§0 tasks) and anything touching cross-cutting runtime semantics deserve
Opus attention directly. Fence agent territories by file and forbid them `PROGRESS.md` — the
coordinator owns it. Update `PROGRESS.md` and the `phase-30-node-library-audit` memory as tasks
land, not at the end.
