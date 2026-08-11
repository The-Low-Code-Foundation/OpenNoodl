# Phase 54 — the state at close

**Written:** 2026-08-11 evening, by a session that owned the checkout twice and lost it once, and
that ran six agents in parallel over the work the phase had left.

**This replaces the previous prompt.** What changed: **DSG-003 is complete** — the five named
recipes are built, each from a measured render — **F38 is refuted, F39 is answered and F40 is
closed**, and the recipe that exists to teach doctrine `§9` turned out to be teaching it backwards.

---

## §0 — The one thing to read before starting a long gate

🔴 **A 15-minute `test:ci` cannot be protected by checking the checkout before you start.** It has
now died this way **twice in two sessions**, and neither session could have prevented it:

- the previous session's run was killed at spec 550 when a sibling's `dev:debug` came up **six
  seconds** after it started;
- this session swept twice — `npm run dev:stop -- --list` *and* an independent `ps` — got a clean
  answer from both, started the run, and a dev stack came up at **17:42**, inside the gap between
  the sweep and the launch. That run died at **spec 1291 of 2632** on the 900s wall.

The lesson is not "sweep harder". It is that **the sweep answers a question about the past** and the
run needs an answer about the next fifteen minutes. Either hold the machine deliberately (ask, then
`npm run dev:stop`, then verify with `ps` and go straight into the run), or expect to re-run.

⚠️ The previous prompt's §0 still holds and is not repeated: `npm run dev:stop --list` **kills**
(npm swallows the flag); `node scripts/devtools/dev-processes.js --list` is a **silent no-op**; the
one correct form is `npm run dev:stop -- --list`.

## §1 — Where the phase stands

| Task | State |
|---|---|
| DSG-001 | ✅ done — the reference build, measured |
| DSG-002 | ✅ done `2ef44128` |
| DSG-003 | ✅ **done this session — 11 `ui-*` recipes, corpus 57 → 62** |
| DSG-004 | ✅ **merged to `cline-dev`** |
| DSG-005 | ✅ **merged to `cline-dev`** |
| DSG-006 | ✅ rubric built and scored; two of its eight rows now understood (§3) |
| DSG-007 | ✅ **merged to `cline-dev`** — and **F2/F30 is finally proven** |

✅ **The gate is green and the three branches are in.** `test:ci` on the merged tree:
**`Jasmine: 2607 specs, 6 failures`, seed 46463** — the recorded floor, and **the same six by
name**: two `AI model registry`, four `AIX-006 style vocabulary`. `cline-dev` is now
`053771ee` + the correction below.

✅ **DSG-007's `ProjectIdentity` specs ran for the first time in four sessions — 8 of 8, all
passing.** ⚠️ The prompt that said *"0 of its 9 specs appear in the log"* was **searching for the
wrong string**: the file is `ProjectIdentity.test.ts` but the suite is
`ProjectModel identity — the id a backend is bound to`, and there are **8 specs, not 9**. A log of
spec names does not contain file names. Three sessions of "fixed-and-unproven" rested partly on a
grep that could not have matched.

⚠️ **One real regression was found and it is what a gate is for.** The first clean run came back
**7**, and the extra was `AIX-011 — does not charge the agent for unknown node types the component
already had`. DSG-004 promoted `inert-dimension` into `AUTHORED_BLOCKING_WARNINGS`; the Article
fixture carries one; the spec asserted *every* error there was an unknown type. **The exemption was
unharmed** — `baselined.ok` stayed true, `baselined.errors` stayed empty,
`preExisting.length === errors.length` still held, and the sibling spec expecting exactly one charged
error still passed — so the assertion was about the *fixture* and was narrowed to `some()`
(`a5df1e06`). 🔴 **Editing a test rather than a gate is the move that deserves suspicion; the check
that licenses it is that every contract assertion passed untouched.**

## §2 — DSG-003, and why four of the five recipes changed their own premise

Every recipe was **built, rendered and measured before it was written down**, which the task file
demanded and which nothing in the repo could actually do: there was no path from an example fragment
to a render at all. That gap is why three earlier recipes shipped eleven backwards ports behind a
green gate. The path now exists —
[`measurements/example-to-project.js`](measurements/example-to-project.js) turns any example into a
v2 project the disk renderer opens — and it is the reusable half of this session's work.

| Recipe | The measurement | What it overturned |
|---|---|---|
| `ui-sticky-nav` | stuck top **0 at scrollTop 305/1205**; phone **0 at 811/1655** | stickiness *is* authorable, but there is **no `top`/`left` port** — the inset is `alignX`/`alignY`, and **no sticky band can float below the top edge** |
| `ui-data-table` | header-to-body drift **0px** at 1280 *and* 390, against controls drifting 16px and 8.44px | the column contract has to be percentage widths summing to 100 with all gutters *inside* the cells |
| `ui-form-field` | **196px vs 526px** at 1280, same file, same `width: 100%` | the `visible` mechanism it was told to copy is **inert** — deleting the wires gave a byte-identical layout |
| `ui-slide-over` | panel **860,0 · 420×900** desktop, full-bleed **390×844** phone; closed **16 boxes vs 30** | a real overlay **is** authorable, and `fixed` beat `absolute` on a measurement (`absolute` sized to the canvas, 278px, not the viewport) |
| `ui-footer-columns` | **27 → 17 nodes (−37%)**, a fourth column now **+0** instead of +6, collapse at **759px** | the plain-array Repeater route renders **every row twice** (§4, F50) |

⚠️ **Two claims were cut because the measurement refused them**, and that is the habit worth
keeping: *"no `contentHeight` gives a full-page-tall band"* measured at **57px, no change**, and
*"a margin moves it off the edge"* is true for `absolute` and false for `sticky`.

Gates: `catalog:examples` **62/62**, `catalog:tokens` **505 references across 68 files**,
`catalog:merge:check` clean. ⚠️ Examples are embedded in
`packages/noodl-types/src/node-catalog-enriched.json` — **run `npm run catalog:merge` once after any
example lands**, or the merge gate goes stale.

## §3 — `§9` scores 0/6 because the recipe teaching it was wrong

This is the sharpest result of the session and it inverts the previous prompt's ranking of F39.

`ui-empty-state` existed to make `§9` concrete. It said: *"wire the collection's count into this
Group's `visible` port and the inverse into the list — falsiness does the switching with no logic
node"*, and shipped **`"connections": []`**. Three errors in one sentence:

1. **the direction is inverted** — the count into the empty state's own port shows it when the list
   *has* rows;
2. **"no logic node" is false** for the other half, which needs an `Inverter`;
3. **`visible` is the wrong port.** It is documented at
   [`node-shared-port-definitions.ts:215`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts)
   as *"Hides the element while keeping the space it occupies"* — so the designed empty state appears
   under a page-height hole. Measured on a sibling recipe: **71px via `mounted` against 87px via
   `visible`** with four hidden elements still holding their boxes.

**Everything needed to write it correctly was already in the repo**: `isEmpty` on `DbCollection2`,
whose enrichment note says *"drive empty-state visuals from here"*; `patterns.md:39`, mined from real
projects, *"Conditional UI is driven through `mounted` … removes from layout … far more often than
`visible` (hides but keeps space)"*; and `acceptance-b.json` doing exactly that. **Only the recipe
disagreed** — and the replay models reach for falsiness-into-a-gate **twelve times** for per-row
chrome and **zero times** for a list. They use the technique where a mechanism was spelled out and
nowhere else.

The recipe now ships the whole switch — query, list, row component, both wires — and "no logic node"
is finally true as written, because a `For Each` over an empty array renders no rows and occupies no
height, so nothing needs inverting. Rendered: 4 texts on screen, 0 placeholders, both viewports.

⚠️ **`§9`'s prose is still Richard's to write.** The investigation's recommendation is the smaller
job: **add identifiers to `§9`** and fix the two existing wrong sentences
(`03-INTERACTION-AND-STATE.md:73` carries the same copy-pasted error), rather than write new prose.

## §4 — Register, new this session

**F1–F29** in the task files, **F30–F34** on the DSG branches, **F35** `--border-control`,
**F36–F45** in [NOTES-DSG-006.md](NOTES-DSG-006.md), **F38/F39/F40 and F46–F48** in
[NOTES-F38-F39-F40.md](NOTES-F38-F39-F40.md).

| # | Finding | State |
|---|---|---|
| F49 | 🔴 **`Columns.marginX` is consumed by `parseFloat`** ([`Columns.tsx:460`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx)), so a tokenised value yields `calc(100% + NaNpx)`, the width declaration is dropped and the container shrink-to-fits: **175px instead of 1292px**, items **58px instead of 431px**. The doctrine tells agents to tokenise every spacing value and `catalog:tokens` resolves it happily | 🔴 open — verified in source |
| F50 | 🔴 **A plain array reaching a Repeater renders every row twice.** `Model.create` mints a fresh anonymous id per element ([`model.ts:238`](../../../packages/noodl-runtime/src/model.ts)), `Collection.set` diffs by `getId()` ([`collection.ts:497`](../../../packages/noodl-runtime/src/collection.ts)), the Repeater calls `set` at least twice, so nothing matches and both passes stay on screen — **31 texts where 19 were authored**, with `catalog:examples`, `catalog:tokens` and `render:report` all green. Adding an `id` per object fixes it. **The documented plain-array route is the broken one** | 🔴 open — verified in source |
| F51 | 🔴 **No AA-passing semantic token for destructive *text*.** `--destructive` on `--surface` is **3.60:1** at 14px; the recipe ships `--red-700` (6.18:1). The same hole `--border-control` closed for rings | 🔴 open — needs Richard |
| F52 | ⚠️ **`render:report` reads at scrollTop 0**, where stuck and not-stuck are pixel-identical. It would have reported *"Rendered clean"* for **four dead or illegible** sticky variants. Any scroll-dependent recipe needs a scrolled read; the ~140-line probe is worth promoting to `scripts/devtools/` | 🟠 filed |
| F53 | 🔴 **`zIndex` on a sticky band is structural, not styling.** Without it the geometry is perfect, every rect-based check passes, and the band is unreadable because sibling bands paint through it. Only `elementFromPoint` catches it | 🟠 filed |
| F54 | ⚠️ **`ElementsOverflowing` never checks whether an ancestor scrolls** (`nodegx-render-measure/src/index.js:691`), so it flags the *correct* responsive-table pattern as clipped | 🟠 filed — false positive |
| F55 | ⚠️ **`empty-decorated-box` fires on any tinted scrim and cannot be escaped.** `unsized-absolute-box` was calibrated to exempt this exact pattern; the render check was not | 🟠 filed |
| F56 | ⚠️ **DSG-003's acceptance asks each recipe to name its trap in `demonstrates`, and cannot have it** — the merge gate reads that field as a **node-type list** and errors on free text. The trap goes in the description | ✅ corrected in practice |
| F57 | 🔴 **A long gate cannot be protected by a pre-flight sweep** — §0. Twice, two sessions, neither preventable | 🔴 open — a habit, not a fix |
| F58 | ⚠️ **`Static Data`'s `json` port is `allowEditOnly: true`** and cannot take a connection, so the obvious per-instance workaround for F50 is closed | 🟠 filed |
| F59 | ⚠️ **The runtime cannot hide a child below a breakpoint.** `Columns`'s `smallBreakpoint` only collapses columns, so every phone nav must wrap, stack or overflow | 🟠 filed — node-library gap |
| F60 | 🔴 **The overlay vocabulary was in the library, in a shipped prefab and in a validator's calibration table (151 boxes), and in *none* of the 57 examples.** The corpus, not the runtime, was the missing half — which is DSG-003's whole premise, confirmed from a direction nobody was looking | ✅ closed by `ui-slide-over` |
| F61 | ⚠️ **Never set an example's instance parameter to the same string as the fallback it overrides.** Identical strings raise `dead-placeholder-text` as an **error**, and rightly — they destroy the only evidence the wire worked | ✅ corpus rule |
| F62 | 🔴 **"0 of its specs ran" was a grep that could not match.** The spec log prints **suite and spec names**; three sessions searched it for a **file name** (`ProjectIdentity`) and read the silence as a barrel fault. The specs had been running. Before concluding a spec did not run, **read its `describe` string and search for that** — and count the `it(` blocks rather than trusting a remembered number (it was 8, recorded as 9) | ✅ closed |
| F63 | ⚠️ **A promoted diagnostic changes what every fixture-shaped assertion means.** DSG-004 promoting `inert-dimension` broke an AIX-011 assertion that said *"every error here is an unknown type"* — a claim about a fixture's contents, not about the exemption. **Promoting a code into `AUTHORED_BLOCKING_WARNINGS` should be followed by a grep for `.every(` over the diagnostic specs** | 🟠 filed |

## §5 — What needs Richard, not a session

- **`§9`'s prose** (§3) — add identifiers; fix the two copy-pasted wrong sentences. Small and testable.
- **F51**, a destructive-text token that passes AA. Same shape as the `--border-control` call.
- **The 25% accent ceiling** (unchanged from the previous prompt) — the corpus cannot defend the
  number; `ACCENT_CEILING` in [`measurements/score-design.js`](measurements/score-design.js) is the
  one line to move.
- **F33** — a copied project directory inherits its parent's id; refuse-and-explain is plausible,
  re-minting may be wrong, because "duplicate this project, same data" is legitimate.
- **F49 and F50 are product defects, not phase-54 work.** Both are cheap and both are silent, which
  is the argument for doing them soon.

## §6 — What a next session should pick up

1. **F50 first.** It is a runtime defect on the *documented* path, it doubles rendered rows, and
   every instrument in the repo says clean while it happens.
2. **F49**, one line, same argument.
3. **The scrolled-read probe (F52)** promoted into `scripts/devtools/`. Two of five recipes needed
   it; the third that did not need it would have shipped a lie without it.
4. ⚠️ **Three of the six DSG-006 "replays" rendered no page at all** yet are scored on six render
   criteria — a blank page passes `narrow-survives`. **The real design corpus is three.** Any future
   claim about the rubric's discrimination has to say so.
