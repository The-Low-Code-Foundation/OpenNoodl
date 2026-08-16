# Phase 69 — next session

**Written 2026-08-16, session 12.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s11's two loose defects now have
task numbers, and one of them is built.** The remaining queue is **CN-019, then CN-007** — see §2
for why CN-019 goes first.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-005** | ✅ | — | Closed in sessions 4–8 |
| **CN-006** | ✅ both halves | ✅ s11 | Closed. AC3 ✅, AC1 ⚠️ half — the missing half **was CN-018** |
| **CN-018** | ✅ **producer side, s12** | 🔴 **no** | Needs a viewer build — §3 |
| **CN-019** | 📋 **specced s12** | — | **Next.** Small, and CN-007 wants it done |
| CN-006b, CN-007 … CN-017 | 📋 | — | **CN-018 goes before CN-006b; CN-019 before or with CN-007** |

s12 wrote ~40 lines of product code and closed the golden that had been misattributed three times.

---

## 1. ✅ The cross-package golden is CLOSED — and the story about it was false

s11 §4 left this proven-real and unowned. It is fixed (`3d3cbb22`).

`f7da52d1` (CN-003) taught the injector to emit `window.__noodl_module_name` before each kit's
script tag and updated **only `@nodegx/module-inject`'s own tests**. The editor's
`expected-inject.snapshot.txt` was last recorded by LIB-003 (`19ecdff7`) and never moved — generated
**26** lines, committed golden **24**, one marker line short per prefix block.

What was done, and the order matters:

- **Reproduced first**, in plain Node, every input at committed state. It reproduced every time.
  🔴 **The relayed story — three sessions deep — was that this was `test:ci` contamination "that
  would not reproduce on committed code".** It was false, and CN-006's work was what got blamed for
  it.
- **Re-recorded through the editor's exact composition** (`scanModuleManifests` → `toInjectModules`
  → `injectIntoTemplate` → `buildInjectionTags`, `projectmodules.ts:534-556`) rather than the
  package's own `injectIntoHtml`, so the golden is checked against the surface the editor test
  actually calls.
- **Mutation-proven** — commenting out the marker emission puts it back to 24 lines and fails.
- The test header now carries a **do-not-regenerate** note naming this episode, because the
  next person to meet a red byte-comparison will be tempted to re-record it away.

**So `test:ci` should now read 2843 / 6 again.** ⚠️ **Not measured** — no suite was run this session
(§5). Re-measure; do not quote that figure as observed.

---

## 2. 🔴 CN-019 is next, and the obvious fix is the wrong one

[CN-019 — A file is not a node](CN-019-A-FILE-IS-NOT-A-NODE.md). `CodeFileDocument` reuses
`JavaScriptEditor`, so a kit's `index.js` — **the first file CN-006's create command sends a new
author to** — is labelled `SCRIPT` and greets them with *"This node has no ports yet. Type
`Inputs.`…"*. It names a mechanism that does not exist in that file.

✅ **The lint pass already carries the exact guard the port bar is missing**, and its comment names
this case by name (`portDiagnostics.ts:634-641`). So one surface of the pair is already right.

🔴 **Do not just copy it.** `openNode != null` fixes the row you observed and keeps the worse one:

| ambient slot | what the file is told |
|---|---|
| cleared | `no-ports` → *"Type `Inputs.`"* — **the case s11 saw** |
| a Function popout still live | `unused-ports` → read **that unrelated node's** ports |

The defect is that the subject is inferred from module-level ambient state (`authoringContext.ts`,
whose only producer is the property panel). A better inference is not a fix. **Write AC2 — open a
kit file immediately after closing a Function popout — before writing any code.**

⚠️ `shouldShowBar` honours a dismissal and retires after N successes, so **a clean screenshot on a
machine that has already dismissed the bar reads exactly like a fix.** Assert on `portBarState`'s
kind, or force it.

---

## 3. 🔴 CN-018 is built and NOT driven — do not report it as visibly fixed

[CN-018](CN-018-THE-PICKER-NAMES-THE-KIT.md) landed the producer side (`2d8f8e02`): group by
`metadata.module`, one named picker subcategory per kit, 6 tests, mutation-proven.

**The editor loads its viewer from `packages/noodl-editor/src/external/viewer`, which is gitignored
build output** (`.gitignore:197`; `src/frames/viewer-frame/index.bundle.js` is untracked too). A
running editor keeps the old grouping until a viewer build. This is the same *driven ≠ shipped* gap
the phase keeps meeting — the source is right and the app has not been told.

🔴 **The one-kit blind spot, which is the transferable part.** Every kit fixture in this repo
installs exactly **one** kit, and with one kit an unnamed group is **indistinguishable** from a
correctly-named one that happens to be collapsed. A one-kit assertion, drive or screenshot passes
against the old code. **Two is the minimum for this class of defect** — apply it to CN-006b.

**Owed on that same viewer build, all three at once:**

1. Drive it — two kits installed, two `Stat Tile`s, distinguishable **without reading `data-test`**.
2. `packages/noodl-mcp/tests/kitAgreement.test.ts:182-185` — its editor expectation is a dated
   `['Unknown Module', 'Unknown Module']` and its own comment says so at length. Becomes
   `['Demo Kit', 'Demo Kit']`.
3. `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` — CN-003's
   owed re-record. (It carries only `nodetypes`, so CN-018 does not change it; it is just the same
   drive.)

⚠️ **Found in passing, not fixed:** `NodeLibraryImporter.mergeInByName` replaces a group **wholesale
by name** (`NodeLibraryImporter.ts:366-388`). Under the old `''` grouping a cloud-runtime module
group replaced **every browser kit group at once**. Named groups narrow that to same-name
collisions; a kit registering nodes in both runtimes is still last-wins. Unmeasured. Wants a look if
CN-013 is picked up.

---

## 4. ⚠️ Still carried from s11, unresolved

**§3 of s11 — did the kit reach the picker without a manual preview reload?** Observed, deliberately
not claimed: peers were editing the tree and HMR was reloading the viewer frame for unrelated
reasons, so a reload nobody caused is indistinguishable from a product that reloads itself. **Wants
a re-run on an undisturbed tree**: scaffold, then poll the viewer's `script[src]` list without
touching anything. This matters because `ViewerConnection.sendRefresh()` is dead at both ends —
sends `cmd:'refresh'`, the runtime emits `'reload'`, nothing listens — which is *why* `KitsSection`
has to tell the author to reload by hand.

---

## 5. Owed by Richard

Unchanged from s7–s11, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (8) and runs in no CI
   job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none. ⚠️ Add a
   twelfth data point: `typecheck:runtime` is **red at HEAD with 2** (`EditorConnection` redeclared
   across two test files) — confirmed by a control run at HEAD with s12's changes removed, so it is
   nobody's regression and nothing is watching it.
3. **Should `project`'s `find_tools` purpose line name kits?** It costs resident tokens out of the
   same 57 CN-009 wants. `tests/kitTools.test.ts` has the control that fails when it changes.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends (§4).

---

## 6. Checkout conditions

**19 peer sessions live** at session start.

- ✅ **No editor was launched and no suite was run.** Everything s12 claims was measured in plain
  Node or in `noodl-runtime`'s jest, both safe beside a live stack.
- ⚠️ **s12 edited sources** (`nodelibraryexport.ts`, two editor test files). That is inside the
  `test:ci` contamination window for any peer that was mid-webpack; nobody announced one.
- ✅ Gates run: `noodl-runtime` full jest **2497 passed / 13 skipped / 136 suites**;
  `@nodegx/module-inject` **15 passed**; `typecheck:runtime` red at **2**, proven pre-existing by a
  control run at HEAD.
- ✅ A peer announced a teardown mid-session (25 stopped, 9222 free). Not used.
- ✅ **`git commit -F <file> -- <pathspecs>`, always. Never `git add -A`, never `git stash`.**
  Two commits: `3d3cbb22` (golden), `2d8f8e02` (CN-018 + both specs).
- Whoever you tell you are starting, tell you have stopped.
