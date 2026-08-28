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
| **Nodes** | Every node in the picker exports, or the picker stops offering it. New nodes ship exportable. |
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

> **PICKER COVERAGE: 51 of 127 placeable nodes export (40.2%)** — 2026-08-28

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
| [EXP-001](./EXP-001-NODEGX-CORE.md) | `@nodegx/core` companion library | ✅ Built |
| [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md) | Deterministic generators | 🟡 In progress — **re-aimed at the picker** |
| [EXP-003](./EXP-003-AI-LOGIC-TRANSLATION.md) | AI logic translation + trace harness | Not started |
| [EXP-004](./EXP-004-EXPORT-REPORT-UX.md) | Export report & honesty UX | 🔴 **Promoted** — the report exists only as stdout today |
| [EXP-005](./EXP-005-MULTIFRAMEWORK-PIPELINE.md) | Multi-framework pipeline | Not started (unchanged) |
| [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | Not started |
| [EXP-007](./EXP-007-EXPORT-PROVENANCE.md) | Export provenance & regeneration safety | Not started |
| [EXP-008](./EXP-008-EXPORT-COVERAGE-LEDGER.md) | Coverage ledger & contributor gate | ✅ Built — **picker ratchet added 2026-08-28** |
| [EXP-009](./EXP-009-BACKEND-CONNECTION.md) | **The exported app talks to its deployed backend** | 🟢 **Built + driven s33** — AC4 (cloud functions) waits on EXP-011's node |
| [EXP-010](./EXP-010-CUSTOM-NODES-AND-MODULES.md) | **Custom nodes, modules and prefabs export** | 🔴 **NEW** |
| [EXP-011](./EXP-011-PICKER-COVERAGE.md) | **Close the picker gap, ranked by what apps need** | 🟡 **TIER 1 COMPLETE** — 66/127 (52.0%); Tier 2 (Navigation, Cloud Services, string/math) is next |

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
