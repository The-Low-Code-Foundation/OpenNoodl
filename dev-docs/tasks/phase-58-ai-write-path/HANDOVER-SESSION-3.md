# Phase 58, session 3 — the handover, and the next prompt

**Written 2026-08-10.** Session 3 built the last two open tasks: **AWP-005 §2** and **AWP-006**.
Phase 58 is **6 of 6 built**. What remains is not construction — it is finishing the measurement
that AWP-006's own acceptance asks for, and one paid run that no spec can substitute for.

---

## The prompt for the next session

> Finish phase 58. Everything is built and gated; three things are left, and the third is the only
> one that carries real risk.
>
> **1. Score the storefront replay artefact and write the row.** The re-replay ran on
> `deepseek-ai/DeepSeek-V4-Pro` on 2026-08-10 against the post-AWP-005/006 surface. The project is
> at `NodeGX test projects/phase58-awp006-deepseek` and the transcript is named in §Where things are
> below. Score it the way LAS-011 scored session 8 — `measurements/score-run.js <project-dir>`,
> `measurements/extract-transcript.js <transcript>`, `npm run render:report -- <project-dir>` — and
> put the row **beside session 8's** in
> `dev-docs/tasks/phase-55-llm-authoring-support/LAS-011-ACCEPTANCE-MATRIX.md`, naming the surface
> change. That naming is LAS-010's re-run rule and it now has teeth: a 60%+ cost cut would otherwise
> read as a model improvement.
>
> ⚠️ **Do not compare cells across surfaces without saying so**, and do not read a cheaper run as a
> better model. The only cells that are comparable without caveat are the artefact ones (components,
> `For Each`, `Columns`, warnings, render report) — the cost and turn cells are the *point* of the
> change, not a side effect of it.
>
> **2. Run BACKEND-BRIEF.md — this is the one that matters.** AWP-006 defers 60 of 90 tools, and its
> own warning is that *a tool the model cannot see is a capability the product does not have*. The
> storefront brief cannot test that, because it touches none of the 60.
> [BACKEND-BRIEF.md](BACKEND-BRIEF.md) is written for exactly this and has never been run. Its
> mechanism is gated by spec — `find_tools` reaches all 60, and authoring a `Record` node reveals
> the group unasked — **but no model has discovered it cold, and that is the actual risk this change
> carries.** ~$1, `--max-turns 30`. Run it against `--all-tools` too as the control: if the model
> fails both, the defect is not disclosure. Score the two disclosure paths **separately** — a run
> that passes only via the auto-reveal has not shown the search door works.
>
> **3. Then close the phase.** Update `TASKS.md`, `README.md`'s exit test, and
> `POST-ALPHA-INDEX.md` / `REVIVAL-PHASES-INDEX.md` if they carry a phase-58 state.
>
> ⚠️ **Check for a live sibling session before you touch anything** (`git log --since="3 hours ago"`,
> and read untracked files rather than assuming they are yours). Phase 58's territory is
> `packages/noodl-mcp` + `scripts/devtools` + `dev-docs/tasks/phase-58-*`, which has been disjoint
> from every sibling so far — but pathspec-scope `git add` **and** `git commit` regardless.

---

## What session 3 built

### AWP-006 — progressive tool disclosure

| | before | after |
|---|---|---|
| tools advertised | 89 | **20** |
| resident surface, per turn | ~25,886 tok | **7,828 tok** |
| turn-one billed prompt tokens | 22,968 | **8,578** |

A manifest (`src/toolGroups.ts`) splits 90 tools into `core` (resident) plus `backend` (60), `docs`
(3), `explore` (3), `project` (2) and `theme` (2). Deferred tools are **registered and disabled**;
`find_tools` re-enables them and the SDK emits `notifications/tools/list_changed`. `--all-tools`
restores the old surface in one flag.

### AWP-005 §2 — `detail` defaults to `summary`

Plus a new `ports` argument on `get_node_type` for per-port full detail. The 8-type storefront
basket went from 30,862 tok to ~6,200; `Group`'s two most-set ports cost < 500 against 11,018 for
the type. §3 is closed as unnecessary, which is what §3 asked for.

### Gates at handover

`packages/noodl-mcp` — **jest 329 passing / 29 suites** (was 307/28) · `tsc --noEmit` clean apart
from the **6 pre-existing** `ToolCallResult.text` errors filed as AWP-005 A11. Nothing in the root
`typecheck` program touches this phase (`tsconfig.json`'s `include` does not list `noodl-mcp`), and
the editor consumes `noodl-mcp` as a **copied dist artifact**, never a source import — so there is
no editor gate and no webpack rebuild. `dist/` is gitignored; nothing to commit there.

---

## The five things worth carrying

**1. A backend-only profile could not have met the acceptance, and only measuring showed it.**
F37 recorded backend admin as 63% of schema bytes, so "serve a profile without it" looked like most
of the win for a fraction of the work — the task's own first recommendation. Measured, the
*remainder* is 10,189 tokens against an 8,000-token bar: **27% over**. Choosing the cheap option on
the summary statistic would have shipped something that missed its own acceptance and looked done.

**2. The replay transcripts overruled the manifest three times, and they were one `sort | uniq -c`
away.** `dev-docs/tasks/phase-55-llm-authoring-support/measurements/s{6,8}-*-transcript.txt` record
which tools four models actually called. `get_example` (14 calls) was first on the deferral list;
the docs *reads* (all four runs, inside six turns) were about to go; `search_project`,
`explain_component` and `list_examples` (**zero** calls, four runs) were about to stay.
**Membership in a resident set is a usage question and this repo already had the usage data.**

**3. A compact mode is defined by what it omits, and prose can be the only record of a fact.**
`Page.title` and `urlPath` are registered per instance, so they are in **no port list** — the
catalog's only statement that they exist is a sentence inside `runtimeBehavior`, which a summary
drops by construction. The old summary said `hasDynamicPorts: true`: "there are ports you cannot
see", with no way to see them. Flipping the default without noticing would have silently lost the
two ports a page most needs — **the same defect as §1's `[object Object]`, from the opposite side.**

**4. ⚠️ A budget measured against a temp-dir fixture lies.** The server instructions embed the
project directory, so the same build measured ~7.9k tokens in jest (a short `os.tmpdir()` path) and
**8,015 on the wire** — over the bar. `toolDisclosure.test.ts` now normalises to a deliberately long
160-character path so it errs strict. **Any budget spec over a fixture in `os.tmpdir()` inherits
this**, and it is invisible because both numbers read as "about 8,000".

**5. ⚠️ The rig had to be fixed before it could measure its own question.** `mcp-model-driver.js`
dropped every JSON-RPC notification, so it would have measured the cost saving and been structurally
incapable of seeing the capability loss. It now acts on `tools/list_changed` and re-lists between
turns, recording a `tools-changed` event. **A client that ignores the notification never sees a
revealed tool** — that is the failure mode `--all-tools` exists for, and it is worth checking any
other MCP client this gets pointed at.

---

## Where things are

| | |
|---|---|
| replay project | `~/vscode_projects/NodeGX test projects/phase58-awp006-deepseek` |
| replay transcript | session scratchpad, `replay-deepseek.jsonl` — **copy it into `dev-docs/tasks/phase-55-llm-authoring-support/measurements/` before the scratchpad is collected** |
| the brief used | extracted verbatim from `STOREFRONT-BRIEF.md`, 1,248 chars (F37 measured 1,235 — formatting only) |
| run parameters | `--model deepseek-ai/DeepSeek-V4-Pro --max-turns 60 --max-tokens 16384 --price-in 1.30 --price-out 2.60`, key from `.env` |
| measure the surface | `node scripts/devtools/mcp-model-driver.js --project <dir> --list-tools` — prints `RESIDENT SURFACE` and the per-group held/advertised split |

⚠️ **The replay project is evidence, not a fixture to edit.** Same rule as the four phase-55 replay
projects: score it, screenshot it, do not repair it.

## Still open, and deliberately not this phase's work

| # | | |
|---|---|---|
| AWP-005 A11 | `packages/noodl-mcp`'s own `npm run typecheck` is **red at HEAD** — 6 `ToolCallResult.text` errors in `interfaceGate.test.ts` and `stagingDiagnostics.test.ts`. Invisible because ts-jest runs with `diagnostics: false` and `test:packages` never calls `typecheck` | 🔴 pre-dates session 2 |
| session 2 A10 | `render-from-disk.js` derives visual roots via `!childIds.has(id)`; `ProjectImporter` uses `parent === undefined`. **Two rules, agreeing on every fixture today** | ⚠️ filed |
| AWP-006 A12 | The `claude` CLI has always deferred tools behind `ToolSearch`, so **no Claude row in the matrix has ever met the surface a plain MCP client gets.** Now that the server defers too, say which deferral a row met | ⚠️ standing caveat |
