# Phase 69 — next session

**Written 2026-08-16, session 14.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **CN-007 is built and mostly closed —
the page exists, it is gated, and it is reachable from the editor.** Two things are owed on it, both
needing a running editor, and **both are blocked on the same thing CN-018 is blocked on.**

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-018** | ✅ producer side (s12) | 🔴 **no** | Needs a viewer build — §3. Unchanged since s12 |
| **CN-019** | ✅ s13 | ✅ s13 | Closed |
| **CN-007** | ✅ **s14** (`7b42d130`) | 🔴 **no** | **AC1/3/4/5 met, AC2 not started** — §1, §2 |
| CN-006b, CN-008 … CN-017 | 📋 | — | **CN-008 is the natural next build.** CN-018 still goes before CN-006b |

---

## 1. ✅ CN-007 — what landed, and the one bit that is a trap

The page is [`docs-site/docs/custom-nodes.md`](../../../docs-site/docs/custom-nodes.md) (sidebar
position 4; troubleshooting moved to 5). `npm --prefix docs-site run build` succeeds, and the config
sets **`onBrokenLinks: 'throw'`**, so that build is what checks its three relative links — not an
assumption.

**AC1's gate is `packages/nodegx-node-kit-types/tests/docsamples.test.js`.** It went there because
that package is already in all four registrations, so it needed none of its own — no new script, no
lockfile edit, no `test:packages` scope change.

🔴 **The gate's first version graded nothing, and this is the transferable part.** It reached the
types with `/// <reference path=…>` pointed at a *module* `.d.ts`, which puts **no names in scope at
all**; and the flagship sample carried no `@type` annotation, so it was plain JS. "Zero diagnostics"
therefore meant "nothing was resolved and nothing was checked" — indistinguishable from a perfect
page. ✅ **Its own planted-fault control is what caught it**, which is the entire argument for
writing the control first. Rebuilt to **materialise a real kit folder** — `index.js` beside
`types/node-kit.d.ts` in a temp dir — so it exercises CN-005's actual delivery path rather than a
shortcut into `src/` that would resolve where a real author's kit does not.

Then mutation-proven properly: a real typo (`displayNodeName` → `displayNodeNam`) planted in the real
page turns exactly one test red. **9 tests; the package went 62 → 70.** ⚠️ The s13 handover said the
baseline was **60**; it was already 62 when I measured. Re-measure, do not quote.

🔴 **The spec's item 4 was backwards and the page corrects it.** `runtimeVersion` is
`'react17' | 'react19'`; **projects created in current NodeGX are set to `'react19'`**
(`LocalProjectsModel.ts:330,369`); the field is deliberately never auto-defaulted; and the legacy
slot spelled `react17` actually serves React **18.3.1**. CN-007's spec said "18.3.1 default, 19
opt-in", which is the wrong way round for every new project.

## 2. 🔴 What CN-007 still owes — both need an editor

**a. The D8 change is BUILT and NOT DRIVEN.** The cashflow kit is on tokens; nothing has seen it
render. [notes/cn-007-d8-token-drive.md](notes/cn-007-d8-token-drive.md) carries the observations,
written before the attempt, with the discriminator table. The short version:

- ✅ measured: all 10 token names resolve in the shipped map (mutation-proven — `--green-6000` ⇒
  exit 1); `color` ports carry no units so a token default passes through
  (`react-component-node.ts:914-918`); every token is emitted to `:root`.
- 🔴 unmeasured: **the pill actually painting `rgb(22,163,74)`**, and **that removing the `||`
  fallbacks did not blank every node**.

⚠️ **Three green source facts are not a rendered pixel** — CN-006's O2 is the local precedent where
exactly this class of reading was true while the render was broken. The drive is one page load and
two `getComputedStyle` calls.

**b. AC2 has not started** — "following the page from scratch produces a working node in the picker,
done by someone who has not read this phase, recording where they stall." That is the acceptance
criterion the whole page exists for and it is the one I could not self-administer.

## 3. 🔴 CN-018 is still built and NOT driven — unchanged since s12

Nothing in s13 or s14 touched this. The editor loads its viewer from
`packages/noodl-editor/src/external/viewer`, which is **gitignored build output**, so a running
editor keeps the old grouping until a viewer build. **Do not report it as visibly fixed without one.**

**Owed on that same viewer build, all three at once:**

1. Drive it — two kits installed, two `Stat Tile`s, distinguishable **without reading `data-test`**.
2. `packages/noodl-mcp/tests/kitAgreement.test.ts:182-185` — `['Unknown Module', 'Unknown Module']`
   becomes `['Demo Kit', 'Demo Kit']`.
3. `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` — CN-003's
   owed re-record.

🔴 **The one-kit blind spot is the transferable part.** With one kit an unnamed group is
indistinguishable from a correctly-named one that is merely collapsed. **Two is the minimum** —
apply it to CN-006b.

⚠️ **Still unmeasured from s12:** `NodeLibraryImporter.mergeInByName` replaces a group **wholesale by
name** (`NodeLibraryImporter.ts:366-388`). Named groups narrow it to same-name collisions; a kit
registering nodes in both runtimes is still last-wins. Wants a look if CN-013 is picked up.

## 4. ⚠️ Carried, unresolved

🔴 **New in s14, and it wants a task number: the cashflow kit is OUTSIDE this repo.** It lives in
`NodeGX test projects/cashflow-command-centre`, so the D8 work is **unversioned and covered by no
gate whatsoever**. D5 makes CN-007 depend on it staying working, and nothing enforces that — a
`rm -rf` of a test-projects folder silently removes the page's only worked example. Options are to
vendor it into the repo as a fixture or to accept the risk explicitly; right now it is neither.

⚠️ **A gap in the token vocabulary, found while doing D8:** the semantic set has `--destructive` but
**no `--success` and no `--warning`**. Any kit with three status bands must reach into the palette
scale for two of them. The cashflow kit now takes all three from the scale so they read as one
system. This is a vocabulary gap, not a kit problem, and it will recur.

**From s11 — did the kit reach the picker without a manual preview reload?** Still deliberately not
claimed: peers were editing the tree and HMR was reloading the viewer frame for unrelated reasons.
**Wants a re-run on an undisturbed tree.** `ViewerConnection.sendRefresh()` is dead at both ends —
sends `cmd:'refresh'`, the runtime emits `'reload'`, nothing listens — which is *why* `KitsSection`
tells the author to reload by hand. The docs page now states this as a known rough edge.

⚠️ **From s13, still free to check:** `CodeFileDocument` renders **two toolbars** — its own
`css.Topbar` above `JavaScriptEditor`'s, with two separate Save buttons (visible in
`notes/cn019-driven.png`).

## 5. Owed by Richard

Unchanged from s7–s13, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (8) and runs in no CI
   job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
   ⚠️ `typecheck:runtime` is red at 2, proven pre-existing. ⚠️ `typecheck:core-ui` reports **44
   `TS2307`s**, cause unidentified — s13 guessed and the guess was wrong (`build:types` does not fix
   them; they name `@noodl-viewer-cloud/execution-history`, `@noodl-versioning`, `@noodl-store/*`).
3. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens out of the same
   57 CN-009 wants. `tests/kitTools.test.ts` has the control that fails when it changes.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends.

## 6. Checkout conditions

**21 peer sessions live** at session start.

- ⚠️ **I did NOT launch an editor.** A peer's stack held 9222 for the entire session (`dev-debug.js`
  pid `24529`, Electron `. --dev` pid `27909`) — still live when I stopped. Nothing of mine to tear
  down, and **nobody was told anything**, because nothing was started.
- ⚠️ **s14 edited two source files** — `packages/noodl-core-ui/src/constants/externalLinks.ts` and
  `SettingsPanel/sections/KitsSection.tsx`. That is inside the `test:ci` contamination window.
  `ps` showed **no `test-editor.ts` / SpecRunner / jest run in flight** at the time, so no peer was
  messaged. If a peer reports an odd `test:ci` around this timestamp, this is the candidate.
- ✅ Gates run: `@nodegx/node-kit-types` **70 passed / 4 suites** (62 → 70, my 9 minus one
  `it.each` expansion accounting). `noodl-core-ui` full jest **477 passed / 26 suites** — identical
  to the s13 baseline, so the constants edit is clean. `noodl-editor` `tests-unit/cn-006` **31
  passed / 3**. `npm --prefix docs-site run build` **succeeds**.
- 🔴 **`test:ci` was NOT run.** The floor still stands where s12 left it (`2843 / 6 @ 39393`).
  **Re-measure before quoting it**; s13's and s14's commits are not in it.
- ✅ **`git commit -F <file> -- <pathspecs>`, always.** One work commit: `7b42d130`.
- Whoever you tell you are starting, tell you have stopped.
