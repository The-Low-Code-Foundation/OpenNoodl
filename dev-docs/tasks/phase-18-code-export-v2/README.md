# Phase 18: Code Export v2

**Status:** 🟡 In progress — re-scoped 2026-08-28 (session 32) after twelve sessions built the
wrong thing well. Read [§ What went wrong](#what-went-wrong-and-the-mechanism-that-caused-it)
before picking any work.

---

## The objective, in one sentence

**An app somebody builds in NodeGX today — with the 0.2.0 editor, the nodes in the picker, custom
nodes written by the MCP, and a deployed NodeGX backend — exports to a React repo that builds,
runs, and still works.**

"Still works" is the load-bearing half. An export that produces a beautiful React app whose
buttons do nothing and whose database calls return `[]` has not exported the app; it has exported
a picture of the app.

### What that commits us to

| | commitment |
|---|---|
| **Nodes** | Every node in the picker exports, or the picker stops offering it. New nodes ship exportable. 🔴 *Re-read 2026-09-03: EXP-011's "not a target" list did neither for 22 nodes — reversed in §50; the ten that stay out are **badged** (EXP-013), which is the nearest honest thing to "stops offering it".* |
| **Custom nodes** | Nodes from `noodl_modules` — MCP-written, module, prefab — export as the React they already are. |
| **Backend** | The exported frontend talks to the **project's existing deployed NodeGX backend**: its database, its cloud functions, its auth. Not a stub. Not a TODO. |
| **Honesty** | Anything that cannot export says so **in the artefact**, not only in a console log nobody keeps. |

### What it explicitly does NOT commit us to

- **Exporting old Noodl projects.** Downloaded Noodl prefabs, legacy kits, `Model2`-era idioms:
  if a NodeGX user would not build it today, it is not a target. This reverses twelve sessions of
  de-facto priority.
- Round-trip editing of exported code back into the graph.
- Native Svelte/Vue compilers (EXP-005 remains AI post-processing of the React output).
- SSR/SSG export targets.

---

## The number this phase is judged on

```
npm run export-ledger:picker          # ratcheted in PR CI
node scripts/export-ledger/picker-coverage.js    # the readable report
```

> **PICKER COVERAGE: 73 of 127 placeable nodes export (57.5%)** — 2026-08-30, session 65

"Placeable" means `inNodePicker`, not deprecated, browser-capable: what a person can actually drop
on a canvas. The floor lives in `coverage-ledger.json` as `pickerCoverageFloor` and ratchets both
ways — a fall fails CI, and a rise fails until the floor is raised in the same commit, so no gain
is ever lost quietly.

**🔴 There is a second number and it must never again drive priority.** The corpus audit
(`coverage-audit.ts` over ~40 old test projects) reads **85.00%**, or **93.38%** over components a
route can reach. Both are true and both are about *those projects*, not about NodeGX. Keep the
corpus as a **regression detector** — it is a good one, and it catches real breakage. Never rank
work with it.

---

## What went wrong, and the mechanism that caused it

Sessions 20–31 chose their work by running `rank2.ts` / `coverage-audit.ts` over a corpus of ~40
projects that had accumulated since phase 7 as drive fixtures for *other* phases. Whatever those
projects deferred most became the next slice.

**Session 19 diagnosed this exactly and it was ignored:**

> *"THE CORPUS HAS STOPPED MEASURING WHAT MATTERS. 40 projects that exist because earlier phases
> needed something to drive; never sampled for library coverage, never refreshed… treat the audit
> as a **regression detector, not a priority oracle**."*

Twelve sessions ranked off it anyway. The consequences, measured in session 31:

- **83% of everything the metric still complained about was one downloaded third-party Noodl
  prefab kit** (`filters-0-1.zip`), copied into eight projects, and **never placed on a page in
  any of them**. Four sessions of design work went into walls inside code no app renders.
- A fifth of the corpus's node count is in components no route reaches.
- The metric is structurally blind to a node nobody in the corpus used — which is most of the
  picker. It read 85% healthy while 76 of 127 placeable nodes did not export at all.

**The deeper cause is this file.** Phase 18 was written as *"the funded execution of phase 7's
2025 code-export design"*, and that design's own out-of-scope list said:

> ~~*Database/cloud node full export — generated as typed API-service stubs, not working
> backends.*~~ **Reversed 2026-08-28. See EXP-009.**

That was correct for 2025 Noodl, where export meant *leaving the tool*. It is wrong for NodeGX,
where export means *taking your app with its backend*. Everything downstream followed from it.

### The three mechanisms that stop it recurring

1. **The metric changed.** `export-ledger:picker` is ratcheted in PR CI and reports the picker,
   not the corpus. It cannot be blind to an unused node, because it counts nodes, not instances.
2. **The gate got teeth.** EXP-008's classification gate lets a node ship `deferred` with a
   one-line exemption. That is still allowed — but the picker ratchet now means the *aggregate*
   cannot slide, so exemptions cost something.
3. **The out-of-scope list is now an explicit reversal with a task behind it**, not an inherited
   assumption nobody re-read.

---

## Task list

| Task | Name | Status |
|------|------|--------|
| [EXP-001](./EXP-001-NODEGX-CORE.md) | `@nodegx/core` companion library | ✅ Built — **published to npm 2026-09-01 as `@nodegx/core@0.1.0`**; 4 metadata/CI rows carried to `0.1.1` |
| [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md) | Deterministic generators | 🟡 In progress — **re-aimed at the picker** |
| [EXP-003](./EXP-003-AI-LOGIC-TRANSLATION.md) | AI logic translation + trace harness | Not started |
| [EXP-004](./EXP-004-EXPORT-REPORT-UX.md) | Export report & honesty UX | 🔴 **Promoted** — the report exists only as stdout today |
| [EXP-005](./EXP-005-MULTIFRAMEWORK-PIPELINE.md) | Multi-framework pipeline | Not started (unchanged) |
| [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | Not started |
| [EXP-007](./EXP-007-EXPORT-PROVENANCE.md) | Export provenance & regeneration safety | Not started |
| [EXP-008](./EXP-008-EXPORT-COVERAGE-LEDGER.md) | Coverage ledger & contributor gate | ✅ Built — **picker ratchet added 2026-08-28** |
| [EXP-009](./EXP-009-BACKEND-CONNECTION.md) | **The exported app talks to its deployed backend** | 🟢 **Built + driven s33** — AC4 (cloud functions) waits on EXP-011's node |
| [EXP-010](./EXP-010-CUSTOM-NODES-AND-MODULES.md) | **Custom nodes, modules and prefabs export** | 🔴 **NEW** |
| [EXP-011](./EXP-011-PICKER-COVERAGE.md) | **Close the picker gap, ranked by what apps need** | 🟡 **94/127 (74.0%) s80** — §52 built `Script` (Tier 2.8 row 2): the escape hatch, hosted rather than re-hosted — the runtime's parser and lifecycle transcribed into `src/lib/script.ts`, the author's code verbatim and unchecked in its own file, every read of its outputs typed; §51 built `Component Children` (Tier 2.8 row 1), the first row of Richard's re-ruled list: the wrapper's `children` prop rendered where the marker sits, an instance's placed children passed through in order, a marker-less target dropping them with a note, not silently; §49 built the animation pair, `States` and `Animate To Value` (Tier 3.8), as two emitted modules transcribed from `states.ts`, `animate-to-value.ts`, `timerscheduler.ts`, `easecurves.ts` and `bezier-easing`, graded frame by frame against those files, and the **wired style sink** (`opacity`/`color`/`backgroundColor` as an inline `style`) neither could do without; §48 `CSS Definition` + the CSS Class fold + the `Date` column; §47 the named Object; §41–§46 Cloud Services. 🔴 **Re-ruled 2026-09-03 (§50)**: the "not a target" list was wrong — 22 of its rows are now **Tier 2.8**, in the build order §3 lists (Component Children, Script, Run Tasks, On App Error, Create New Array, …), the three transports are Tier 3.11, ten stay out **and must be badged (EXP-013)**. Ceiling 117/127 |
| [EXP-012](./EXP-012-THE-EDITOR-EXPORT-COMMAND.md) | The editor export command | 🟢 Built + driven s67; rides 0.2.2 |
| [EXP-013](./EXP-013-NOT-EXPORTABLE-SAID-WHERE-THE-NODE-IS-PLACED.md) | **"Not exportable yet", said where the node is placed** | 🟢 **BUILT, GATED, DRIVEN — s78, 2026-09-03**, all seven ACs graded in its own file. ⚠️ This row read *"NEW — the next first job"* until 2026-09-06; corrected off the task file |
| [EXP-014](./EXP-014-THE-GROUND-THE-HEADLINE-SITS-ON.md) | **The ground the headline sits on** | 🟢 **BUILT, GATED, DRIVEN — s97, 2026-09-06.** The two layer ports fold into one `background-image`, gradient first, with the runtime's size/position defaults and `no-repeat`; `backdropBlur` maps to both spellings or neither. Hero headline **1.03:1 → 17.24:1**; 9 refusals gone, none added. One residual: the `<img src>` channel is still project-relative (§14.5, owner NONE) |
| [EXP-015](./EXP-015-THE-TAG-THE-AUTHOR-CHOSE.md) | **The tag the author chose** | 🟢 **BUILT, GATED, DRIVEN — s97, 2026-09-06.** The authored `as` wins, validated against the catalog's own per-type enum and honoured through the page collapse; a void element, a type with no Tag port and an off-enum value each fall back **and are reported by name, in the code**. Export now renders 1 `h1`, 5 `h2`, 5 `section`, 1 `main` — the viewer's column exactly. ⚠️ §1/§6's "nothing in the report says so" was WRONG: it said so 61 times, in the wrong words |
| [EXP-016](./EXP-016-THE-TYPEFACE-THAT-SHIPS-UNUSED.md) | **The typeface that ships unused** | 🟢 **BUILT, GATED, DRIVEN — s97, 2026-09-06.** `base.css`'s `body` is the runtime's two declarations, and the form controls inherit; body, heading and button all compute Inter, and `document.fonts` moved from four faces **`unloaded`** to four `loaded` (§1's "4 faces loaded" was the pre-fix reading and was wrong — nothing had fetched them) |
| [EXP-017](./EXP-017-THE-BUILD-A-DEPLOY-PICKS-UP.md) | **The build a deploy picks up** | 🟢 **BUILT, GATED, DRIVEN — s98, 2026-09-11.** A deploy now **reads the engine it is about to copy** and names it on every run; a development build is refused with its own code (**exit 11**) *before a byte is written*, and the refusal names the **9.43 MB source map**, not the size. 🔴 The armed loser is the map stripped off — still unminified, still refused, so production is a conjunction. Inter now ships **once, as woff2**: `scripts/library/ttf-to-woff2.js`, zlib only, **1,256,396 B → 488,132 B**. 🔴 A browser found what four readers could not — a WOFF2 must be **4-byte aligned**, and two of the four faces were aligned *by luck*. ⚠️ A duplicate the project REFERS to still ships, reported: see §"What AC4 does not do" |

⚠️ **EXP-011's row below reads `94/127 (74.0%) s80` and is stale**: `export-ledger:picker` reported
**117 of 127 (92.1%)** on 2026-09-06, which is the ceiling that row's own last sentence names. The
ten out are §50's out-of-scope rulings, badged by EXP-013.

### Order, and why

1. **EXP-009 — the backend.** The largest single gap between "exports" and "works". Every data,
   auth and cloud-function call currently emits a stub that returns `[]` or throws. Nothing else
   on this list changes whether an exported app can show a user their own data.
2. **EXP-010 — custom nodes.** Cheap and currently zero: `parseProject` never opens
   `noodl_modules`, so MCP-written nodes are dropped silently. They are already React
   (`window.React` + `createElement` + ports), which makes this far less work than it sounds — and
   it unblocks every module and prefab at once.
3. **EXP-011 — the picker gap**, ranked by what an app needs: the `Object`/array vocabulary,
   `HTTP Request`, the date family, `Page Inputs`.
4. **EXP-004 — the honesty UX**, promoted because today a deferral is *invisible in the output*.
5. **EXP-013 — the warning where the node is placed**, opened 2026-09-03 and put **ahead of the next
   EXP-011 row**: an exclusion is only honest if the person placing the node is told, and today they
   are told at export, by component count, after the pathway behind the node has already been dropped.

---

## The corpus, and what it is still for

`projects.txt` and the 40 fixtures stay. They are a genuine regression net: they caught real
defects in sessions 21–31 that no unit test did, and the `build-corpus.ts` 40/40 typecheck gate is
worth keeping. **Their new job description is "tell me if I broke something", and nothing else.**

They should also be *joined*, not replaced, by a small set of apps built in the 0.2.0 editor and
by the MCP, covering the picker — see EXP-011 §2.

## References

- `dev-docs/reviews/NOODL-REVIVAL-ROADMAP.md` §3 Track F
- `dev-docs/tasks/phase-7-code-export/` — the 2025 design. Sound on generators; **its scoping
  assumptions about the backend are superseded here.**
- [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) §20 — the
  session-31 measurement that forced this re-scope.
