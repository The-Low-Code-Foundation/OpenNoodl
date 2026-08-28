# Next session — the wall that was not there

## 🔴🔴 FIRST: the testing freeze is still on until Richard clears it

**Richard asked (2026-08-28, mid-session 30) for no CPU/RAM-intensive runs machine-wide until he
explicitly says to start again.** A peer session confirmed it and deferred its own `test:ci`.
**Keep this notice at the top of this file until Richard says it is lifted — do not remove it
just because a session ends.**

That means **no** jest suite, **no** `build-corpus.ts`, **no** `coverage-audit.ts`, **no**
`npm run typecheck`, **no** `export-ledger:check`, **no** editor launch. His words: *"Save the
tests, we'll run them later and sweep up all the work done at once."*

**There is unrun work waiting for that sweep** — see §19e below. Reading, raw-file measurement
with python/awk, and writing code and tests are all fine and are what session 30 did.

---

**Where the phase stands (2026-08-28, after thirty sessions).** Session 29 said to read the kit
as one artefact. Session 30 did, and found that one of §17b's ten walls **does not exist**: its
58 nodes are real deferrals, correctly refused, but every one sits behind a wall already on the
list, and the reason string sent three sessions looking at the wrong thing.

**Coverage: expected unchanged at 3,775/4,441 (85.00%) — not measured, see the freeze.** No
verdict changed; only reason strings did. Written up in
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) **§19**.

## 🔴 Read this before picking anything

**The list re-ordered.** Row identity is now item 1, ahead of Tier B:

1. **Row identity (the s10 wall), ~160 nodes** — was 136; §19c moves 24 more onto it. Four
   `Filters/*` components ×8 clones turn on one question: **what is a row's identity in the
   emit?** `Filters/Multi Choice/Item` is the whole thing in six wires —
   `Model2.prop-Label → checkbox.label`, `Model2.prop-Checked → checkbox.checked`,
   `Model2.id → SetModelProperties.modelId`. That is `items.map(row => …)`.
2. **EXP-003 Tier B** — ~350 script-tier nodes, same kit. `Filters/Range`'s geometry script is
   the shape: it writes the component record everything downstream reads.
3. **The two `ProductCard` projects' missing interface** (§11d(2)/(3)) — ruled §13b, built §14.
   Still the disposition, not a defect.

**85.00% is a node-weighted average dominated by eight clones of one downloaded prefab**
(`filters-0-1`, named in the kit's own `IMPORT-REPORT.md`). 13 of 40 projects export at 100%.
Decide whether moving the headline is the goal before optimising it — §18a and §19a are the
argument that it measures the corpus's shape more than the export's reach.

## What landed — §19

`STRUCTURE_PORTS` claimed a wired `label`/`min`/`max`/`step` meant *"the rendered structure is not
static"*. It does not. `Checkbox.tsx:191` spends `props.label` once, as the text child of
`<label>`; `useLabel` (lines 70, 170) is what decides the element exists. `Slider.tsx:116–121`
passes `min`/`max`/`step` straight into `inputProps`. On the export's side they are already
content — `CONTENT_ATTR_ORDER` lists all three, `style.ts`'s `range` rule reads only `thumbColor`
and `width`, and `component.ts:1353` already calls `childText(node, 'label')`.

**The verdict was still right, and lifting the gate would have been a bug.** `Filters/Range`'s
bounds come from a `ComponentObject` that pass 4d would happily bind — but **no wire writes it**;
a `JavaScriptFunction` writes it through the Noodl API from `Model2.prop-Min`. Binding it would
have emitted the record's *boot value*, shipping a 0–100 slider where the app renders the row's.

So: verdict unchanged, reason corrected. `CONTENT_BOUND_PORTS` (new) holds the three content
ports and **names the source type**, so the census groups these nodes onto the wall they are
actually behind — 24 onto row identity, 16 onto the script-written component record.

## 🔴 Traps session 30 paid for

**A gate can be right for a reason it does not give, and the reason is what gets read.** Third
instance of the "not yet" vs "never" family (§17a, §18c), and the first where the verdict was
already correct. **A census's rows are only as true as the sentences the gate writes into them.**

**Evidence about the sink does not settle a question about the source.** The runtime proves
`label` and `min` are content; acting on that alone ships wrong output, because the blocker is one
hop past anything the runtime shows. Companion to §18d's rule.

**zsh does not word-split an unquoted variable.** `for p in $KITS` ran once with the whole string;
every `awk` matched nothing and eight fingerprints came back `d41d8cd9…` — the md5 of empty —
which reads exactly like eight identical clones. The true answer was also "identical". ✅ **Use an
array**, and distrust a uniformity result that arrives too easily.

## 🔴 §19e — what is unrun and waiting for the sweep

When Richard lifts the freeze, run these **in this order** and reconcile before believing
anything:

1. `npm run typecheck` in `packages/nodegx-export` — `wiredIn` changed from `Set<string>` to
   `Map<string, string>`; `visualDeferReason` now takes `ReadonlyMap<string, string>`. Single
   call site (plan.ts:813), checked by reading only.
2. The suite from the package dir: `../../node_modules/.bin/jest` — **481 + 6 new = 487
   expected**. The 6 are the §19 block in `tests/visual-controls.test.ts`. Two pre-existing
   assertions cover `layoutString` and `items`, both genuinely structural and deliberately
   untouched.
3. `coverage-audit.ts` — **expect 85.00% unchanged**. A move either way means a verdict changed,
   which this session did not intend; treat it as a defect, not a win.
4. `deferred-census.ts` (`EXPECT=666`) — expect the reason strings in §19d's table.
5. `build-corpus.ts` — expect **40/40**. Read the last line, never `echo $?`.
6. ⚠️ **`walls.py` patterns are now stale** — they were written against the old sentences. It
   refuses to run unless totals reconcile, so this surfaces as `UNCLASSIFIED` residual (§17c).
   Update the patterns before quoting a wall census.

**A lone suite-level red with 0 failing tests is a flake until re-run.**

## Instruments (session 30 scratchpad `5cd94f92-…`)

- **`wirefeed.py`** (new) — the one that produced §19c. Reads the **raw** component files and
  follows every wire into a `STRUCTURE_PORTS` sink to its source type.
  `wirefeed.py <projectDir>… > out.tsv` (summary on stderr). Outputs: `wirefeed-s30.tsv`,
  `wirefeed-s30.summary`. **Its `STRUCTURE_PORTS` copy mirrors plan.ts as of s29 — update it
  alongside the source, or it measures the wrong ports.**
- `census-final-s29.tsv` — copied in; the artefact view. Group by project/component/reason with
  `awk -F'\t'`.
- s29's `deferred-census.ts`, `rootsource.ts`, `detached.ts`, `mutate.py`, `walls.py`,
  `coverage-audit.ts` + `projects.txt`, `rank2.ts`, `build-corpus.ts` (committed at `scripts/`),
  and s28's `tb-survey.ts` / `dumpall.ts` / `showfile.ts` / `ifaces.ts` — all copied in.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
run **from `packages/nodegx-export`**. Instruments take projects as argv; **zsh:
`"${(@f)$(cat projects.txt)}"`** — the paths contain spaces. `build-corpus.ts` needs **both**
`--app <harnessDir>` **and** the project list, and **exits with the failure count** — read the
last line. The coverage audit prints no corpus total; sum it with
`awk '/ ok, .* deferred$/{…}'` (the `↳ deferred:` lines double-count if you don't anchor).

🔴 **Never `git checkout <path>` to undo a source mutation.** `mutate.py` patches one line by
number, restores from a pristine copy and **prints both md5s** to prove it.

**Standing practice:** work on `cline-dev`; commit by **exact file pathspecs** (never a directory,
never stage) — peers were editing `packages/noodl-editor`, `packages/noodl-mcp`,
`packages/noodl-core-ui` and `packages/nodegx-backend` throughout s30. ts-morph and Prettier stay
uninstalled; the package is not in root `test:packages`.
