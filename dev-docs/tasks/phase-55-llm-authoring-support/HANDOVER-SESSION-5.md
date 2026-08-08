# Phase 55 — the handover prompt for session 6 (the last one)

Paste the block below into a fresh session. Written to be read cold, by a model that has seen
neither phase 54 nor sessions 1–5.

---

You are continuing **Phase 55 — Any LLM can build in NodeGX**. Read
`dev-docs/tasks/phase-55-llm-authoring-support/README.md` and `TASKS.md` first, then
`dev-docs/best-practices/` — especially `05-WORKED-EXAMPLE-STOREFRONT.md`, which is Richard's own
architecture for the app this phase is calibrated against.

Your session is **(6) of six** in TASKS.md §Order: **LAS-010** (the open-weight leg) + **LAS-011**
(the acceptance matrix). **This is the session the phase closes on.** TASKS.md says it plainly:
*the phase does not close on green gates; it closes on this matrix.*

## The phase's rule, and the score so far

**Read the mechanism in source before trusting any stated fact** — including facts stated by this
phase's own task documents, and including facts stated by this handover.

Phase 54 opened on three wrong premises. Session 1 found three more, session 2 five, session 3 one,
session 4 four (plus a fifth while writing its handover). **Session 5 found two more, and one of
them was in the handover you are replacing.** The count has never been zero. Assume a wrong premise
exists in your own task and go looking for it early — the cheapest check is opening the file at the
line a document cites and reading the actual signature. That is about forty seconds and it has
caught something every single session.

### The correction you inherit — read this before planning your session

Session 4's handover told you: *"cross-provider role selection is the mechanism LAS-010 and LAS-011
will lean on."* **That is wrong, and believing it will send you down the wrong path.**

LAS-010's chosen driver (§2 of its task file) is a **standalone MCP driver**: a model's HTTP API
bridged to a `noodl-mcp` stdio server child process. It never touches the editor, so it never
touches `AiClient`, so LAS-009's per-role provider work is **not** in its path. LAS-011's own header
says it outright: *"LAS-009 is optional for the matrix."*

LAS-009 matters to you **only** if you fall back to the editor-loop harness (repairing
`aix15-live`), which LAS-010 §2 keeps as a fallback. Plan for the MCP driver.

## LAS-010 is human-gated, and the gate is an API key

**Settled 2026-08-08 (Richard):** hosted `qwen2.5-coder-32b`-class via **DeepInfra**, through the
`openai-compatible` path — *not* a local pull. The decision was made on measured hardware: Richard's
machine is a 16 GB M1 MacBook Air whose Metal working set caps around 10.7 GB, and
`qwen2.5-coder:32b` is ~20 GB at Q4. Disk was never the constraint; RAM was.

- **Richard supplies the API key when the task runs.** Do not ask for it before then, never commit
  it, read it from the environment.
- The matrix row must read **"open weights, hosted (DeepInfra)"**. The weights are open; the run was
  not local. That distinction is the phase's own honesty rule, not a footnote.
- ⚠️ `ollama` on this machine has **only `llama3.2:latest`** (3B, 22 months old). Confirmed again in
  session 5 — it is a fine smoke-test target and **not** a mid-tier open-weight candidate.

**Relevant to you, from session 5 (F35):** the editor's model registry has **zero
`openai-compatible` entries** (`client/models.ts`: 3 anthropic, 4 openai, 2 ollama, 0
openai-compatible). If you configure DeepInfra *in the editor* — the fallback path — the main model
picker will offer you nothing until you run **Test connection**, which populates it by discovery.
The per-role model control already works around this with a text field; the main picker does not.

## What sessions 1–5 closed — do not rebuild it

| Task | Commit | What landed |
|---|---|---|
| LAS-008 | `57895017` | `DESIGN_AUTHORING` rewritten from Richard's §7; tripwire over the exported prompt constants |
| LAS-002 | `69257e87` | `stage_plan_operation` + `apply_plan` return diagnostics in a validation block |
| LAS-003 | `5a35a1f8`, `631ae6bc` | `layoutString` grammar (error), unsized decorated absolute box (warning), raw colour literal (warning) |
| LAS-001 ⭐ | `1b9e344a` | the interface gate — 3 codes, all authored-blocking |
| LAS-004 | `d7e06c00` | repeated-sibling-subtree promoted to authored-blocking; oversized-page info at 40 nodes |
| LAS-005 ⭐ | `9c3e3ce7`, `a4d204b9`, `464c5cd3` | `render_report` — the eyes |
| LAS-006 | `cad33e6c`, `4348b8a9` | plan operations carry inputs/outputs/repeats/instantiates; the plan as a contract at staging |
| LAS-007 ⭐ | `4348b8a9` | the fixing recipe attached inside the rejection; traps preamble in `get_project_info` |
| LAS-009 | `5af9fde6`, `e80eb172`, `453dac6e` | design/plan/act **provider and model** per role; cross-provider proven live |

**Closed:** F1, F2, F3, F5, F6, F7, F9, F23, F24, F25, F33, F35.
**Open:** F10 (a third plug-blind reader in `explain/graph.ts`), F14 (`validate:project` runs rules
only), F16 (`ecommerce-example`'s empty product band), F21 (`noodl-mcp`'s red unwatched `tsc`),
F22 (LAS-005 §5, the editor client), F30 (11 pre-existing findings in seven catalog examples),
F32 (below), F34 (below).

**F34 is worth knowing before you score cost.** LAS-009 §3 asked for per-role spend "in the session
cost line". The usage log it named feeds **nothing** — `getUsageLog()` and `getSessionCostUsd()`
have zero callers; the visible line is `PlanRun.costUsd`, accumulated session-side. And
`PlanningSession`'s `outcome.costUsd` is **discarded at its call site**
(`ProjectAuthoringView.tsx:604`), so plan-role spend reaches no line at all. If your matrix wants
per-phase cost from the *editor*, it is not there. From the MCP rig you are metering yourself
anyway, so this mostly does not bite — but do not cite an editor cost line you have not read.

## Gates — and the two runners that every handover before session 4 conflated

- **`npx jest` in `packages/noodl-editor`** — `tests-main/` + `tests-unit/`, plain Node. **78 suites
  / 1060 specs** at session-5 close (77/1048 at session 4, 76/1029 at sessions 2–3). Green.
- **`npm run test:ci`** in `noodl-editor` — the jasmine-in-Electron suite (`tests/`), **2418
  assertions with 4 failures**, inherited since before session 4 (F32, `AIX-006 style vocabulary`:
  a fixture sets `color` on a `Group`, which `unknown-parameter` blocks, so the candidate is refused
  before the style pass it is testing). Measured both ways at `b550b750`. **Not yours.**

Full list: `npm run catalog:examples` (57/57), `catalog:check`, `catalog:merge:check`,
`typecheck:editor`, `npx jest` in `packages/noodl-editor`, `npx jest` in `packages/noodl-mcp`
(**24 suites / 250 specs**).

**Compare the passing COUNT, not the colour.** `Tests: 0` is a compile failure, not a pass; only the
`Jasmine:` line counts in `test:ci`; an OOM kill (137) is not a verdict. ⚠️ `noodl-mcp`'s own
`tsc --noEmit` is red with 6 pre-existing errors in session-2 test files (F21) — `src/` is clean and
`jest.config.js` sets `diagnostics: false`, so it is not a gate today. ⚠️ `pr.yml`'s Lint and Test
(editor) are red on push for pre-existing reasons — check *which* job before reading a red run as
yours.

## What you have that earlier sessions did not

- **Eyes.** `render_report` on the MCP surface; `npm run render:report -- "<project-dir>"` from a
  shell. Read-only, safe at any time, ~8 s.
  ⚠️ **LAS-011 step 2: rebuild the viewer bundle before scoring.** `render-from-disk` runs the
  working tree's *last build* — its own header says so. Scoring three runs against a stale runtime
  would silently invalidate the entire matrix.
- **The fixture.** `STOREFRONT-BRIEF.md` holds the brief verbatim, the cold-replay protocol
  (`create_project` first, `node packages/noodl-mcp/bin/noodl-mcp.js <dir> --allow-writes`, the brief
  plus one sentence, **no rescues — a stall is data**) and the scoring table.
- **The baselines to beat.** `measurements/` has `haiku-full.png`, `sonnet-full.png` and the
  tool-call transcripts. AUDIT-SESSION-1.md has the session-1 numbers the matrix is a before/after
  against: haiku (dead cards, 1-col grid, 5 broken images, 0 connections, 42 turns / $0.53) and
  sonnet (blobs, motorcycle, zero Columns, 147 turns / $7.86).
- **A live editor recipe**, if you need the fallback path. Use the `run-editor` skill.
  ⚠️ `--target=editor` attaches to the **preview**; never `cdp reload`; an occluded Electron window
  clamps timers ~1000×, so pace drivers with `MessagePort`. And a property-panel `<select>` is not a
  `<select>` — see the session-5 notes in LAS-009's file and the memory
  `propertypanel-select-and-text-input-driving`.
- **Do not write to a project while a human has the editor open.** The editor holds the project in
  memory and can flush a stale copy back over your work on quit.

## Working habits that are not optional here

- **Write the check before the fix.** Eleven times across five sessions.
- **Watch every new check fail before trusting it.** Session 5 broke both of its tripwires
  deliberately and watched them catch it; session 4 found one that was wrong the first time.
- **Measure the consequence, not just the mechanism.** If a change is supposed to alter behaviour,
  run it both ways and diff the numbers before writing that it did.
- **Calibrate before choosing a number, and record the calibration.** It has changed a design in
  every session.
- **Score the artefact, but read the transcript before classifying a failure** — a model that was
  never told about a tool did not "fail to know" it. This is LAS-011 step 3 and it is the rule that
  keeps the matrix honest.
- **Commit per slice**, add register rows in the same commit, and serialise register edits across
  parallel sessions — a pathspec commit can sweep a sibling's edit.
- **Never `git stash` and never `git add -A`** in this checkout. To measure a baseline, back the
  changed files up outside the repo and `git checkout --` them by pathspec.
- **Live model runs cost real money** on Richard's keys. Session 5's editor run cost ~$0.064; a full
  cold replay is dollars, and sonnet's session-1 replay was $7.86. Budget deliberately, and say what
  you spent.

## How the phase closes

LAS-011 is not a green-gate exercise. It ends with **Richard judging the rendered pages side by
side against a Claude artifact of the same brief**, and his verdict recorded *in his words, not
paraphrased*. The success line does not move:

> The mid-tier and open-weight runs must be **architecturally** correct — components with real
> interfaces, repeaters over data, states and signals, responsive — even where their visual taste is
> weaker than Opus's. **If a weak model produces a well-architected app with mediocre spacing, the
> phase succeeded; if only a strong model produces a beautiful page, it did not.**

Anything that survives the new gates gets classified (knowledge / ordering / capability / seam) with
transcript citations, and either spawns LAS-012+ or is **accepted with a written reason**. An
unwritten acceptance is a premise for the next phase to trip over — which is exactly how this phase
started.

And watch for the gates' *failure* mode, not only their success: a mid-tier model looping forever on
a now-blocking rejection is a capability finding that argues for smaller turns or more of LAS-007's
attachments — **not** for weakening the gate. Turn counts and cost per run are in the matrix for
that reason.
