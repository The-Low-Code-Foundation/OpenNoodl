# Phase 69 — next session

**Written 2026-08-16, session 13.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **CN-019 is closed — built, driven,
and it cost a regression of my own on the way.** The queue is now **CN-007**, with **CN-018's owed
viewer build** still unclaimed.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-018** | ✅ producer side (s12) | 🔴 **no** | Needs a viewer build — §3. Unchanged from s12 |
| **CN-019** | ✅ **s13** (`175e29d9`) | ✅ **s13** (`ad0ccd79`) | **Closed.** All 5 ACs, one retired deliberately — §1 |
| CN-006b, CN-007 … CN-017 | 📋 | — | **CN-007 next.** CN-018 still goes before CN-006b |

s13 wrote ~40 lines of product code, then deleted 3 of them because the drive proved them wrong.

---

## 1. ✅ CN-019 is closed — and the interesting half is that my first fix broke a neighbour

[CN-019](CN-019-A-FILE-IS-NOT-A-NODE.md) has the full write-up and two screenshots in
[notes/](notes/). The short version, and all three parts are worth carrying:

**The fix.** `JavaScriptEditor` takes `subject: 'node' | 'file'`. `CodeFileDocument` passes
`"file"`, and it is carried into **both** surfaces that ask — the port bar and the lint pass
(`createExtensions` → `diagnosticsFor` → `javascriptDiagnostics` → `portDiagnostics`, four
signatures, all defaulted). A kit's `index.js` now shows no hint and reads **JAVASCRIPT**.

**🔴 The mutation that matters is the second one.** The task warned that copying the lint pass's
`openNode != null` guard would be wrong. It is worse than "wrong": it **passes the row that was
observed**. It fails only the stale-slot row, and it breaks two existing FUN-006 cases besides,
because a blank Function node's `openNode` is real and empty. ✅ **Mutation-test the row you did not
see, not the one that sent you.**

**🔴 The regression, which is the reason AC5 says "driven".** My first version also cleared the
ambient `openNode` slot on mount — which is exactly what AC1 asked for. A code popout is a
**portal**, not part of the canvas a document replaces, so opening the file leaves it mounted **and
on top**, and clearing the slot under it flipped its correct bar to *"This node has no ports yet"*
about a node whose panel lists two. Measured with `elementFromPoint`, not assumed;
`getBoundingClientRect` + `visibility` said both editors were fine.

⚠️ **So AC1's second clause is retired on purpose.** The replacement is stronger and is what AC2 now
asserts: the slot demonstrably **still holds** an unrelated node while the file shows nothing. A
*cleared* slot cannot distinguish the fix from the guard the task warned about; a populated one can.

⚠️ **The cause is worth naming because it will recur:** I fixed a shared component by writing global
state from one consumer — the same shape as the defect, one layer up.

### Two instrument failures that would each have produced a clean pass

1. 🔴 **`localStorage.codeeditor_portbar_successes` already held three entries**, so
   `shouldShowBar` was `false` for every state and every row would have read "no hint". They were
   left by **FIX-016 s45's** drive, on two of the very nodes in this fixture. Cleared first, and
   re-read on every row.
2. 🔴 **`portBarState.length` is 3 in both versions.** `Function.length` stops at the first
   defaulted parameter, so the new `subject = 'node'` is invisible to it. Arity is not a version
   check; **behaviour on an input the two versions answer differently** is.

**Fixture `cn019-drive`** is on disk (`fix016-msg6-drive` + `cn001-kit-drive`'s `cashflow-kit`).
⚠️ Its Function node shipped `Outputs.Done();`, which **mines an output** and silences the bar — set
it to a comment or the control cannot fire and you have four absences and no instrument.

---

## 2. CN-007 is next, and CN-019 is why it can be written honestly

[CN-007 — the docs page that replaces the broken one](CN-007-THE-DOCS-PAGE-THAT-REPLACES-THE-BROKEN-ONE.md).
CN-019 was blocking it *in spirit*: the file editor was teaching `Inputs.`-in-a-module at the exact
moment CN-007 has to teach the real model. That contradiction is gone.

⚠️ **Read `notes/cn-006-drive-observations.md` before writing any of it** — it is what a real author
actually met, and it is the only record of the path CN-007 documents.

---

## 3. 🔴 CN-018 is still built and NOT driven — unchanged from s12

Nothing in s13 touched this. `CN-018`'s producer side landed in `2d8f8e02`; the editor loads its
viewer from `packages/noodl-editor/src/external/viewer`, which is **gitignored build output**, so a
running editor keeps the old grouping until a viewer build. **Do not report it as visibly fixed
without one.**

🔴 **The one-kit blind spot is the transferable part.** Every kit fixture in this repo installs
exactly **one** kit, and with one kit an unnamed group is indistinguishable from a correctly-named
one that happens to be collapsed. **Two is the minimum** — apply it to CN-006b.

**Owed on that same viewer build, all three at once:**

1. Drive it — two kits installed, two `Stat Tile`s, distinguishable **without reading `data-test`**.
2. `packages/noodl-mcp/tests/kitAgreement.test.ts:182-185` — `['Unknown Module', 'Unknown Module']`
   becomes `['Demo Kit', 'Demo Kit']`.
3. `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` — CN-003's
   owed re-record.

⚠️ **Found in passing in s12, still unmeasured:** `NodeLibraryImporter.mergeInByName` replaces a
group **wholesale by name** (`NodeLibraryImporter.ts:366-388`). Named groups narrow that to
same-name collisions; a kit registering nodes in both runtimes is still last-wins. Wants a look if
CN-013 is picked up.

---

## 4. ⚠️ Still carried, unresolved

**From s11 — did the kit reach the picker without a manual preview reload?** Observed, deliberately
not claimed: peers were editing the tree and HMR was reloading the viewer frame for unrelated
reasons, so a reload nobody caused is indistinguishable from a product that reloads itself. **Wants
a re-run on an undisturbed tree.** This matters because `ViewerConnection.sendRefresh()` is dead at
both ends — sends `cmd:'refresh'`, the runtime emits `'reload'`, nothing listens — which is *why*
`KitsSection` has to tell the author to reload by hand.

⚠️ **Found in s13, out of scope, free to check:** `CodeFileDocument` renders **two toolbars** — its
own `css.Topbar` above `JavaScriptEditor`'s (visible in `notes/cn019-driven.png`: `index.js …` on
one row, `JAVASCRIPT ✓ Valid │ Format │ Save` on the next, with two separate Save buttons). CN-019's
own trap list flagged it as out of scope unless free. It was not free.

---

## 5. Owed by Richard

Unchanged from s7–s12, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (8) and runs in no CI
   job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
   ⚠️ `typecheck:runtime` is red at 2, proven pre-existing by a control run.
   ⚠️ **s13 adds a thirteenth data point:** `typecheck:core-ui` reports **44 `TS2307` "cannot find
   module"** errors, all of them module resolution, **none in a file s13 touched**. 🔴 **I guessed
   the cause and the guess was wrong** — I wrote that a missing `pretypecheck:core-ui` was to blame,
   then ran `npm run build:types` and got **44 again**. `build:types` only builds `@noodl/runtime`;
   these name `@noodl-viewer-cloud/execution-history`, `@noodl-versioning` and `@noodl-store/*`.
   ⚠️ Also note the script reaches **`packages/noodl-editor/src/**`** despite being pointed at
   `noodl-core-ui`. **Cause unidentified, and nothing watches it.**
3. **Should `project`'s `find_tools` purpose line name kits?** It costs resident tokens out of the
   same 57 CN-009 wants. `tests/kitTools.test.ts` has the control that fails when it changes.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends (§4).

---

## 6. Checkout conditions

**19 peer sessions live** at session start.

- ⚠️ **An editor WAS launched and has been stopped.** `dev:stop` reported *"Stopped 25 process(es).
  Nothing left running."*, 9222 confirmed free by `lsof`. The peer whose stack held 9222 before mine
  (claude pid `10100`) was told at launch and told again at teardown.
- ⚠️ **s13 edited sources** in `packages/noodl-core-ui/src/components/code-editor` and
  `CodeFileDocument.tsx`. That is inside the `test:ci` contamination window for any peer mid-webpack;
  the two candidate sessions were messaged and one confirmed it was unaffected.
- ✅ Gates run: `noodl-core-ui` full jest **477 passed / 26 suites**. `typecheck:core-ui` has **44
  pre-existing `TS2307`s and none in a touched file** — see §5.2.
- 🔴 **`test:ci` was NOT run.** The floor still stands where s12 left it (`2843 / 6 @ 39393`, peer
  `9204`, tree with `3d3cbb22`). **Re-measure before quoting it**; s13's two commits are not in it.
- ✅ **`git commit -F <file> -- <pathspecs>`, always.** Two commits: `175e29d9` (build),
  `ad0ccd79` (the correction + the drive + two screenshots).
- Whoever you tell you are starting, tell you have stopped.
