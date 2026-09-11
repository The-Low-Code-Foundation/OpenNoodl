# Phase 46 — the tasks (VER: Verification)

**Created:** 2026-08-09, out of [README.md](README.md).
**House rule, inherited from phase 56 and kept:** every claim about existing code in these files was
read in source, not recalled. Keep that rule for anything added, and confirm live what a driver can
confirm.

## Status

| ID | Title | Tier | Est. | File | Status |
|---|---|---|---|---|---|
| VER-001 | The case format and the headless runner | 1 | 1 wk | *in README* | 📋 |
| VER-002 | The determinism seams — four in the graph, plus `lib/` | 1 | 1.5 wks | *in README* | 📋 |
| VER-003 | `nodegx test` | 1 | 3 d | *in README* | 📋 |
| VER-004 | The Tests panel | 1 | 1 wk | *in README* | 📋 |
| **VER-009** | **A scenario grows an expectation** | **1.5** | **1 wk** | [file](VER-009-A-SCENARIO-GROWS-AN-EXPECTATION.md) | 📋 |
| **VER-010** | **The component runner: no editor, no display** | **1.5** | **1 wk** | [file](VER-010-THE-COMPONENT-RUNNER.md) | 📋 |
| **VER-011** | **Coverage is information; only failure is a warning** | **1.5** | **3 d** | [file](VER-011-COVERAGE-IS-INFORMATION.md) | 📋 |
| **VER-012** | **What did I just break** | **1.5** | **1 wk** | [file](VER-012-WHAT-DID-I-JUST-BREAK.md) | 📋 |
| **VER-013** | **The agent proposes the states; the human pins the truth** | **1.5** | **3 d** | [file](VER-013-THE-AGENT-PROPOSES-THE-HUMAN-PINS.md) | 📋 |
| VER-005 | A trace is an artifact | 2 | 1 wk | *in README* | 📋 |
| VER-006 | Replay and the mismatch policy | 2 | 1.5 wks | *in README* | 📋 |
| VER-007 | Tests are visible to the agent | 2 | 3 d | *in README* | 📋 |
| VER-008 | Workflow run assertions | 2 | 4 d | *in README* | 📋 |

Tier 1.5 total: **~3.5 weeks**. Tier 1.5 is specced to per-task files because phase 56 finished and
made it buildable; Tiers 1 and 2 remain tables in the README until someone starts them.

## The exit test — Tier 1.5

A builder opens a card component in the bench, feeds it three inputs, watches the outputs read-out,
presses **Pin these as expected**, and saves it as `Loaded`. Three weeks later they change a shared
component. They press Run all. The report says *"you changed Card; 14 components embed it; 6 have
scenarios; 2 now fail; 8 were not checked"* — and clicking a failure opens the component with the
failing scenario applied. No test file was ever written by hand.

If that runs end to end on a live editor, and `nodegx test --components` reproduces the same verdicts
in CI with no editor and no display, the tier is done.

## Ordering, and one hard dependency

```
phase 56 (done) ──► VER-009 ──► VER-010 ──► VER-012
                        │           │
                        └► VER-011 ◄┘
                                    └► VER-013  (also needs VER-007)
       VER-001 (matchers) ──► VER-009
       VER-002 (determinism) ──► VER-010   ⚠️ hard
       VER-003 (nodegx test) ──► VER-010
```

⚠️ **VER-010 must not ship before VER-002.** A component calling `Now`, `UUID`, `RandomBytes` or
`HTTP` is exactly as nondeterministic as a cloud function doing so. Ship the runner first and the
first thing builders learn about component tests is that they fail at midnight — and a test feature
that is believed to be flaky is dead, permanently, whatever it does later.

⚠️ **VER-009 depends on VER-001 only for the matcher vocabulary.** If Tier 1 has not started,
VER-009 defines the matchers and VER-001 imports them — but there is **one** implementation either
way. Two matcher dialects is the BCN-003 mistake and it is not available as a shortcut.

## The cheapest useful slice

**VER-009 + VER-011 is ~1.5 weeks** and delivers: pin expectations in the bench, see verdicts live,
see which components are unproven. No CLI, no CI, no blast radius — but it is the whole authoring
experience, on top of a phase 56 that is already finished, and it is enough to find out whether
builders pin anything at all. That question is worth answering before spending the other two weeks.

## Standing constraints — settled, do not relitigate

- **One matcher vocabulary**, shared with cloud-function cases. A matcher language is a programming
  language one feature at a time; keep it at exact / subset / `~number` / `*` / `!undefined`.
- **One verdict module**, shared between the editor and the headless runner. Acquisition may differ;
  comparison may not.
- **Expectations are pinned by a human, by looking.** An agent proposes inputs, never expectations.
- **Nothing gates on a red suite** in this tier. Report first; earn the right to block later.
- **Running the tests writes nothing to the project.** Results live in a git-ignored cache.
- **Only failure warns.** Untested is information; untestable is silence.

## Register

Findings from the specification session, each read in source. Rows are added as tasks are built.

| # | Finding |
|---|---|
| **V1** | ⚠️ **The bench's output channel cannot carry an expectation.** Everything on it has been through `previewValue` ([tracebuffer.ts:129](../../../packages/noodl-runtime/src/tracebuffer.ts#L129)), a **display dialect** — strings arrive quoted, `undefined` arrives as the word, `NaN` and `<function f>` are not JSON — and **`DEFAULT_VALUE_CAP = 200`** ([:108](../../../packages/noodl-runtime/src/tracebuffer.ts#L108)) truncates. So a 300-char and a 3,000-char value are indistinguishable to an assertion. `benchOutputs.ts` documents the dialect at [:272](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchOutputs.ts#L272) — it was already measured, for a display bug, and nobody had asked what it means for a test. **This is the finding that shapes VER-009.** |
| **V2** | **The headless single-component mount already exists.** [`render-from-disk.js`](../../../scripts/devtools/render-from-disk.js) reconstructs the exporter's `projectData` from a v2 project in plain node and sets `rootComponent` **by name** — the same splice `sandboxExport.ts` performs in the editor. VER-010 was estimated at 1.5 wks on the assumption this needed building; it is 1 wk. |
| **V3** | **`benchHarness()` is a pure JSON transform** ([componentBench.ts:342-350](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/componentBench.ts#L342-L350)) — one component, one node of the target's `legacyName`, `parameters` = the inputs. It takes models today, but nothing about the shape is editor-bound. This is the piece everyone assumes is the hard part of a headless component test. |
| **V4** | **Editor format code already runs in plain node**, deliberately and with a written rationale: [`editor-deps.ts`](../../../packages/noodl-mcp/src/editor-deps.ts), *"Electron-free by construction (verified)"*. The precedent for VER-010's imports exists and has a policy attached — import, never twin. |
| **V5** | **`WarningsModel` already has four levels** — `error`, `warning`, `info`, `success` — and `getWarnings` filters on them ([warningsmodel.ts:116](../../../packages/noodl-editor/src/editor/src/models/warningsmodel.ts#L116)). VER-011 needs no new mechanism, only the right level. ⚠️ **Unverified:** whether the components panel and canvas dot *filter* by level or render anything present. If the latter, an `info` row dots every untested component. Probe before building. |
| **V6** | **`componentClosure` walks the wrong direction for a blast radius.** It exists and is used ([componentBench.ts:450](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/componentBench.ts#L450)), but it answers *what does this reach*, and VER-012 needs *what reaches this*. Same edge set, inverted — and ⚠️ `MAX_CLOSURE_DEPTH = 4` must not be inherited: a capped blast radius under-reports, and under-reporting reads as "nothing else was affected". |
| **V7** | **BEN-005 §4 filed this tier itself** — *"Running scenarios as automated tests… needs an assertion language this task does not have."* The follow-up was recorded rather than scope-crept, and the register it was filed in is why this phase could be specced against a finished foundation instead of a guess. |
