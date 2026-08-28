# Phase 18 Progress — Code Export v2

**Created:** 2026-07-22 · **Re-scoped:** 2026-08-28 (session 32)
**Objective:** an app built in NodeGX today — picker nodes, MCP-written custom nodes, a deployed
NodeGX backend — exports to a React repo that **builds, runs, and still works**. See
[README.md](./README.md).

## 🔴 The headline number

```
npm run export-ledger:picker
node scripts/export-ledger/picker-coverage.js
```

> **PICKER COVERAGE: 51 of 127 placeable nodes export (40.2%)** — 2026-08-28

**Do not report the corpus number as progress.** `coverage-audit.ts` reads 85.00% (93.38% over
components a route reaches) across ~40 old drive fixtures. It is a **regression detector** and a
good one. Sessions 20–31 used it as a priority oracle and it cost the phase twelve sessions —
README §*What went wrong* has the mechanism.

## Tasks

| ID | Title | Status |
|---|---|---|
| [EXP-001](./EXP-001-NODEGX-CORE.md) | `@nodegx/core` companion library | ✅ **Built** — `packages/nodegx-core`, 2.8 KB gzipped against an 8 KB budget, gated. No call sites: EXP-002 emits zero imports of it, by design |
| [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md) | Deterministic generators | 🟡 **In progress, re-aimed.** 51 picker nodes translate. `packages/nodegx-export`: 504 tests, 40/40 corpus projects typecheck. Remaining work moved to EXP-011 |
| [EXP-003](./EXP-003-AI-LOGIC-TRANSLATION.md) | AI logic translation + trace harness | ⚪ Not started. **Reconsider the sizing** — it was scoped against corpus JS-node counts, most of which are in the unplaced prefab kit |
| [EXP-004](./EXP-004-EXPORT-REPORT-UX.md) | Export report & honesty UX | 🔴 **Promoted.** The report exists **only as stdout**. A deferred node leaves *no marker in the emitted file* — see §"What a gap looks like" |
| [EXP-005](./EXP-005-MULTIFRAMEWORK-PIPELINE.md) | Multi-framework pipeline | ⚪ Not started |
| [EXP-006](./EXP-006-EXPORT-AUTHORING-INTENT.md) | Export carries authoring intent | ⚪ Not started |
| [EXP-007](./EXP-007-EXPORT-PROVENANCE.md) | Export provenance & regeneration safety | ⚪ Not started |
| [EXP-008](./EXP-008-EXPORT-COVERAGE-LEDGER.md) | Coverage ledger & contributor gate | ✅ **Built**, + picker ratchet 2026-08-28. ⚠️ 96 of 101 `deferred` entries share one auto-generated exemption sentence — EXP-011 §4 rewrites them |
| [EXP-009](./EXP-009-BACKEND-CONNECTION.md) | **Exported app talks to its deployed backend** | 🔴 **Not started — do this first** |
| [EXP-010](./EXP-010-CUSTOM-NODES-AND-MODULES.md) | **Custom nodes, modules and prefabs export** | 🔴 **Not started.** `parseProject` never opens `noodl_modules` |
| [EXP-011](./EXP-011-PICKER-COVERAGE.md) | **Close the picker gap, ranked by what apps need** | 🔴 Not started |

## What actually works today

51 picker nodes, built to a standard worth copying — hand-written target output first,
byte-for-byte goldens, mutation checks, a 40/40 corpus typecheck gate:

- **Visual:** Group, Text, Image, Columns (CSS Grid + container queries), Icon, Video, Circle,
  Button, Checkbox, Radio Button (+ Group), Slider, Dropdown, Text Input, Repeater, Page, Router
- **Data:** Query Records, Create/Update/Delete Record, Array, Static Array, Create New Object,
  Insert Object Into Array, Variable, Set Variable, Global Store (+ Set, Subscribe)
- **Logic:** Condition, And, Or, Inverter, Switch, Counter, String Format, Expression, Function,
  Visual Function
- **Structure:** Component Inputs, Component Outputs (callback props), Component Object
- **Flow:** Send/Receive Event, Navigate, Show/Close Popup
- **Auth:** Log In, Log Out, Sign Up, User

## What a gap looks like — and why EXP-004 is promoted

A deferred node is **invisible in the output**. Exported from `Puppy test 3`:

```jsx
<button className={styles.deleteBtn}>Delete Puppy</button>   {/* no onClick — chain deferred */}
<p className={styles.listText} />                            {/* empty — a Function fed it */}
```

No `TODO`, no comment, no marker; grep finds zero. No report file is written into the output at
all — the notes go to the export console and nothing keeps them. **The failure mode is a silently
half-working app**, which is worse than a loud one. Every dropped wire already has a good sentence
written about it; none of it survives into the artefact.

## The corpus, and its new job description

`projects.txt` + the 40 fixtures + `build-corpus.ts` (40/40 typecheck) stay. They caught real
defects in sessions 21–31 that no unit test did. **They tell you if you broke something. They do
not tell you what to build.** EXP-011 §2 adds picker-exercising projects built in the 0.2.0 editor
and by the MCP, which is what should be ranked against.

## Session history

Sessions 1–31 are recorded in the target-output docs, principally
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) §1–§21, which is
the phase's working log. §20 is the session-31 measurement that forced this re-scope; §21 marks
its own "what is left" lists void.

**Session 33 (2026-08-28, `b83161c5`) — EXP-009 built and driven.** The exported `Puppy test 3`
lists its real database rows in a headless browser (zero with the backend stopped); auth and
writes round-trip; no master key in the bundle. Design in
[EXP-009-CLIENT-TARGET-OUTPUT.md](./EXP-009-CLIENT-TARGET-OUTPUT.md), drive record in
[EXP-009 §8](./EXP-009-BACKEND-CONNECTION.md). Gates: 519/519 · corpus 40/40 · 85.00% unchanged
· picker ratchet holds 51/127. AC4 (cloud functions) waits on EXP-011's node translation.

**Session 34 (2026-08-28) — EXP-010 built and driven: custom nodes stop being holes.**
`parseProject` had **zero references to `noodl_modules`** — the directory was never opened, so
every node from a project's own kit fell out of the render tree and left the JSX with a gap and no
marker. Route B now ships each kit verbatim behind a one-file shim, with a typed React wrapper per
node type at every call site. `cn027-drive` — a real 25-component site — exports, builds
(`tsc -b && vite build`) and renders **all four** of its custom nodes in a headless browser.
Ports were driven in both directions, each path separately: an `outputProps` signal, an `outputs`
signal fired from `initialize` (the shape a partial reader loses), and a value output landing in a
bound element. A kit that throws, one with no `index.js`, an ES-module build and a plain library
each export the rest of the app and are named once with their own status; a node whose kit did not
load leaves a `TODO(export)` **in the file**. Icon-set stylesheets and their binary fonts now ship
verbatim and are linked, which quietly fixes the bundled Inter font and Lucide set in **24** corpus
projects. AC6 is settled as a decision, not a number, recorded in `coverage-ledger.json`'s
`$customNodesComment`. Details and the five near-misses in
[EXP-010 §7–§9](./EXP-010-CUSTOM-NODES-AND-MODULES.md). Gates: 554/554 · module-inject 31/31 ·
corpus sweep 47/47 emit clean · picker ratchet holds 51/127 · `export-ledger:check` OK.

**Session 35 (2026-08-28) — EXP-011 Tier 1.4 built, driven and gated: the value Variables.**
`String`, `Number`, `Boolean` and `Color` export. They are one runtime definition
(`variablebase.createDefinition`), so they became one translation with a four-row cast table, and
which shape a node takes is decided by its wires rather than its type: nothing wired into `value`
or `Set` folds the read to a literal (String's `Length` folds with it); a wired `value` under Run
On Value Change becomes a `useState` plus a sync effect carrying `setValueTo`'s own table —
`undefined` abstains, `null` stores the `Treat empty as` coercion, otherwise `args.cast`, and
`NaN` is banned as a stored value because `NaN !== NaN` breaks the runtime's `changed` guard
permanently. A wired `Set` is **deliberately** outside the slice and says so in the author's terms:
it commits a *pending* value, which needs an abstain guard and a cast around an expression, and a
state write has room for neither. **Variable Dial** — authored through the MCP server, not by
hand-editing JSON — exports, builds and runs; a headless Chrome typed into it and watched
`Number("cake")` land on `0`, `Number("42")` land on `42`, the Boolean flag mount and unmount, and
the deferred latch stay honestly empty. The near-miss worth reading is
[EXP-011 §6.2](./EXP-011-PICKER-COVERAGE.md): a sync effect is referenced *unconditionally* at
emit, so pushing one where a **speculative** `resolveExpr` had resolved would have emitted a
`useState` and a `useEffect` nothing reads — the dead-`useSession` trap, one construct over.
**AC4 is also done:** all 97 deferred ledger entries now say *deliberately out of scope* (with the
reason) or *scheduled* (with the tier), where 95 said "pre-gate backlog" verbatim, and
`export-ledger:check` now enforces that shape — proved with a control pair before being believed.
Gates: **580/580** · module-inject 31/31 · corpus **41/41** · audit **85.27%** (from 85.00%) ·
picker ratchet **51 → 55 of 127 (43.3%)**.

**Session 36 (2026-08-28) — EXP-011 Tier 1.1 built, driven and gated: the client-side data
vocabulary.** `Object`, `Array Filter`, `Array Map` and `Clear Array` export; the other four of
Tier 1.1's eight defer on named mechanisms, and **three of those are blocked by something that is
not about them**. The shape of the slice is that a list became an ordinary **value expression**:
the collections slice could reach a named array only through a per-consumer field on the repeater,
and there are now three consumers that compose (`books → filter → map → For Each`). `Object` in
"From repeater" mode shipped **exactly as EXP-002-MODEL2-TARGET-OUTPUT §4 designed it** — the
child mints a prop per read, the parent binds `p={item.p}` — with two additions about names: the
prop is deduplicated and the row **field** is not, so both are carried; and minting happens in a
pre-pass, because `resolveExpr` runs speculatively and would declare props for reads that do not
survive. The filter keeps the runtime's **loose** `==`, whose own comment says why, and `Clear
Array` forks on `peek().length > 0` because `done` fires only when the array was not already
empty.

🔴 **The session opened by planning to mint an `id` on every inserted row so `Remove Object From
Array` could translate — and measuring first killed it.** The delete-a-row flow is blocked upstream
by the row-output relay (*"which row fired is not statically expressible"*), so the ids would have
bought nothing and changed a shipped slice's output.

🔴 **Three defects that only building and driving could find.** A `Clear Array` fork emitted
`}; else` — a **SyntaxError** that three `toContain` assertions passed on, because every substring
really was there; `tests/emitted-syntax.test.ts` now parses every emitted file of every fixture,
with a control pair, and the same latent join in `branch` went through the one shared helper. Two
**temporal dead zones** (`collectionReadEligible`, `wiredPorts` read from passes that run earlier)
crashed on the first real project while 626 tests passed, because **no fixture had a `Model2`
node**. And an `Array Map` naming a source property the array lacks emitted `row.nope`, which
**failed `tsc -b`** in the exported app — found by *sabotaging* the driven project, and the same
hole that had already been closed on the repeater side.

**Reading Shelf** — authored through the MCP server — exports with nothing dropped, builds, and
runs: a headless Chrome added two books and watched them come back **sorted** (the one added first
rendered second), added a third to a wishlist and watched the filter **exclude** it, then pressed
Clear twice and watched the `done` and `unchanged` arms answer differently. The wishlist button is
a **negative control** and the map was proved by a **mutant** — without either, both readings would
have been equally consistent with the translation never having been emitted. Also fixed, found by
building against it: `typeOfSource` was never taught about Tier 1.4's value Variables, so a
Variable written by a `String` node had no statically-typed writer and **every read of it dropped**
([EXP-011 §7.5](./EXP-011-PICKER-COVERAGE.md)). Gates: **636/636** · module-inject 31/31 · corpus
**42/42** typecheck · audit **85.45%** on session 35's own 40-project denominator (from 85.27%;
⚠️ that session's "41/41" label and its `4441` denominator described different sets) · picker
ratchet **55 → 59 of 127 (46.5%)**.
