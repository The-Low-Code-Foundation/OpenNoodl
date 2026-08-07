# RCK-002: Deterministic Journey Replay

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-002 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 1 — the model |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium–High |
| **Estimated Time** | 2–2.5 wks |
| **Prerequisites** | RCK-001 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — a large surface with opaque failure modes; the flakiness work is diagnostic |

## Objective

Every active journey runs headlessly against the real app and reports green or red, fast enough to run
on every meaningful graph change, and reliably enough that a red result is believed.

## Background

This is the boring layer, and it is boring on purpose. The phase's whole design rests on keeping
deterministic replay separate from stochastic persona exploration:

> **exploration discovers, replay defends**

A persona run finds that the date picker confuses people. The builder fixes it. That moment is then
*promoted* into a replay step which runs forever after at near-zero cost. Expensive discovery is paid
once per defect.

Conflating the two layers is how QA suites die: a stochastic step makes the suite flaky, a flaky suite
gets ignored, and the deterministic value is lost along with it.

NodeGX starts this task with an unusual advantage: the headless-drive infrastructure exists already,
built for other reasons. SUB-009's live preview established the headless-editor-export recipe (four
shims), RUN-001 built a reusable CDP corpus harness for the React 18-vs-19 comparison, and AIX-008
renders a staged component beside its graph. This task assembles rather than invents.

## Current State

| Piece | State |
|---|---|
| Headless render | `packages/noodl-preview` (SUB-009) — the 4-shim recipe, reusable |
| CDP harness | RUN-001's 18-vs-19 corpus harness; RUN-003 documents the live-editor CDP traps |
| Sandbox preview | AIX-008 — per-`clientId` export seam, staged component rendered beside its graph |
| Editor CDP traps | recorded: `--target=editor` attaches to the *preview* window; use `--target=dashboard`; launch detached; never `cdp reload` |
| A test runner for apps | nothing |

## Desired State

### 1. One driver, two consumers

A single headless driver — launch the app, navigate, act, observe — used by both this task and RCK-003.
The difference is entirely in what the caller is allowed to see:

| | Replay (this task) | Blind persona (RCK-003) |
|---|---|---|
| Sees | the DOM, node ids, port values | a screenshot |
| Acts by | selector / node id | coordinate |
| Asserts | `successWhen` | nothing; it just behaves |

Building the driver once with a **capability parameter** rather than two drivers is what keeps the two
layers honest about running against the same app. RCK-003 owns the blind capability; this task owns the
driver.

### 2. Steps assert something

`JourneyStep.successWhen` needs a small, closed vocabulary — not an expression language:

- a component is mounted / a route is active
- a node's output port has a value / changed
- a backend call completed with a given status
- text is visible on screen
- **nothing** (a navigational step that only needs to not crash)

Closed on purpose. An assertion DSL becomes a second programming language inside the product, and the
`successWhen` cases above cover what a journey actually needs.

### 3. It runs where the app runs

Three modes, same journeys:

- **Preview** — the default, fast, no deploy needed.
- **Local full-stack** — DEP-002's bundle, so backend behaviour is real.
- **A deployed URL** — the truth, including the backend and the CDN.

A journey that passes in preview and fails against a deployment is a *finding*, not a runner bug, and
the report must say which mode produced each result.

### 4. Self-healing, from the edit

RCK-001 raises journey orphans at edit time. This task closes the loop:

- After a graph change, only the journeys whose anchors were touched re-run. The editor knows which
  those are; it does not need to infer them from a diff.
- A step that fails because its anchor moved is reported as **`unresolved`**, distinct from a genuine
  functional failure. Conflating them is how a suite trains people to ignore red.

### 5. Failures are findings

A red step becomes an OPS-003 finding, with the screenshot at the point of failure, the component path,
the node ids and the last backend call — the same context shape every other source uses, so *"fix the
highest-priority open finding"* works identically whether the reporter was a runner, a persona, a human
or the builder.

### 6. Promotion

An explicit path from a persona finding (RCK-005) to a replay step: pick the moment, name the intent,
choose the assertion, and it is in the suite. This is the flywheel and it should be one click from a
report, not a re-authoring exercise.

### 7. A readiness item

`quality.journeys-green` at **Sharing** — evidence is the last run, its mode, and how many journeys
were exercised.

## Implementation Steps

1. **Assess the existing harnesses first** and write down what is reusable in `RCK-002-NOTES.md` —
   SUB-009's shims, RUN-001's CDP harness, AIX-008's export seam. Do not build a fourth headless path
   before reading the three that exist.
2. The driver, with the capability parameter, deliberately shaped so RCK-003 can add the blind mode
   without a fork.
3. The `successWhen` vocabulary + evaluation.
4. The three run modes, with mode recorded on every result.
5. Selective re-run on graph change; `unresolved` distinct from failed.
6. Failures → findings, with full context.
7. Promotion from a persona finding.
8. The readiness item.
9. **Live pass**: run the QA fixture's journeys in all three modes. Break something that only breaks
   against a real backend and confirm preview passes while deployed fails — and that the report says so.

## Success Criteria

- [ ] One driver, one code path, with a capability parameter — not two drivers.
- [ ] All three run modes work and every result records which mode produced it.
- [ ] A graph edit re-runs only the affected journeys, chosen from the edit rather than from a diff.
- [ ] `unresolved` (anchor moved) is never reported as a functional failure.
- [ ] A red step produces a finding with a screenshot and full graph context.
- [ ] Promotion from a persona finding to a replay step is one click.
- [ ] **Flake rate measured, not asserted**: the fixture suite run 20 times back to back, with the
      result recorded in `RCK-002-NOTES.md`. A suite whose flake rate was never measured is not done.

## Out of Scope

- **Anything a persona does.** RCK-003/004.
- **Visual regression / pixel diffing.** UIX-009's screenshot corpus exists for the editor; applying it
  to user apps is a separate argument.
- **Load testing.** Different tool, different question.
- **Unit tests for user graphs.** Interesting, out of scope. This is end-to-end only.
- **CI integration for user projects.** Runs from the editor. A user with their own CI can call the
  runner, but wiring their pipeline is not ours.

## Traps

- **The editor CDP traps are documented and were learned expensively.** `--target=editor` attaches to
  the *preview* window; use `--target=dashboard`; launch detached; never `cdp reload`; HMR breaks the
  webpack probe (WFA-005); a stale `__nodeGraphEditor` reference survives longer than expected. Read
  those notes before writing a line of driver code.
- **Flakiness is the only thing that can kill this layer.** Waiting on a fixed timeout will appear to
  work for a week. Wait on observable state — the app's own signals — and measure the flake rate
  explicitly.
- **A backend test suite that spawns a CLI grades `dist`, not `src`** (BAK-009). The same trap applies
  the moment this runner drives a built artifact while the author edits sources.
- **`--target` and userData traps from LEARN-001** apply to launching anything Electron-shaped
  headlessly.
- **`unresolved` will want to collapse into `failed`.** It is one `else` away, every time. Guard it in
  the type, not in the reporting layer.
- **Selective re-run is a correctness risk, not just an optimisation.** A journey that should have
  re-run and did not produces a green suite over broken code — the exact phantom-success failure
  OPS-002 exists to prevent. If the affected-set computation is uncertain, run everything and say so.
- **Editor launch rewrites the example project** (minifies `project.json`, drops `rootComponent`) on
  open and on shutdown. A runner that opens projects repeatedly will churn them; revert after killing,
  and prefer the committed QA fixture over the agent-chat example.
</content>
