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
