# AWP-006 — 22,968 tokens before the model reads the brief

**Status:** ✅ **DONE 2026-08-10** — see [§As built](#as-built--2026-08-10) · **Track: the context** ·
**F37**, measured in session 6 and unchanged in session
8 · supersedes [LAS-013](../phase-55-llm-authoring-support/LAS-013-SMALL-MODEL-HEADROOM.md) §2

## The number, and that it has not moved

Write-mode `noodl-mcp` advertises **89 tools**. As OpenAI function schemas that is **100,512
characters**, plus **2,852 characters** of server instructions, sent on **every single turn**.

Turn one of the session-8 replays billed **22,968 prompt tokens** — tools, instructions, and a
1,235-character brief. Identical to session 6's measurement (`tools=89 schemaChars=100512`), so
nothing has drifted and the number can be trusted.

**F37 measured that 60 of the 89 tools and 63% of the schema bytes are backend admin** — a storefront
brief touches none of them.

## What it costs, on real runs

Because the surface is resent every turn, the cost is `floor × turns` regardless of what the model does:

| run | turns | billed input | fixed floor | share |
|---|---|---|---|---|
| DeepSeek V4 Pro | 60 | 4,410,622 | 1,378,080 | **31%** |
| Kimi K3 (run 2) | 57 | 5,725,954 | 1,309,176 | **23%** |
| Kimi K3 (run 1, void) | 34 | 2,716,964 | 780,912 | **29%** |

**Roughly 30% of every agent-authoring bill is a tool list, most of which is for a subsystem the task
never touches.**

## The premise that changed since LAS-013

LAS-013 filed this as *headroom for small models* — the 27B's 32k window could not hold the surface at
all, and F36's model was locked out entirely. **Session 8 removed that framing:** both DeepSeek V4 Pro
and Kimi K3 have **1,048,576-token** contexts, so the surface fits with enormous room to spare and
neither was blocked by it.

**So this is no longer a capability problem. It is a cost problem, and it applies to every client at
every size** — including Claude, which only escapes it because the `claude` CLI defers tools behind
its own search step (haiku's session-1 transcript opens with **11** `ToolSearch` calls). That is why
"the same surface" was never the same surface across the matrix's rows, and why sonnet's pass is not
evidence that the surface is fine.

## The fix

### §1 Serve a task-shaped surface, not the whole catalogue

The 89 tools are not one audience. Authoring a page needs the graph, catalog and render tools;
provisioning a backend needs the backend admin set; neither needs the other. Options, cheapest first:

- **Server-side profiles.** The server already takes `--allow-writes`; a `--profile authoring` that
  advertises the authoring set and omits backend admin is a small change with most of the win.
  ⚠️ **The backend tools must remain reachable** — an app with `Record` nodes genuinely needs them,
  and `provision_backend` is deliberately not a plan operation. A profile that makes them
  unreachable trades a cost problem for a capability problem.
- **Progressive disclosure.** One `find_tools` entry point plus a small core, the rest fetched on
  demand — the shape the `claude` CLI already uses, and the reason the Claude rows never met F37.
  More work; also the only option that scales as the surface grows.
- **Schema slimming.** Independent of both, and worth measuring first: 100,512 characters over 89
  tools averages 1,130 characters per tool. Some of that is prose that belongs in one place rather
  than repeated per tool.

**Recommend measuring the split before choosing.** If backend admin is 63% of bytes, a profile alone
gets the floor to roughly 8,000 tokens, which is most of the available win for a fraction of the work.

### §2 Do not break the two rules the matrix depends on

⚠️ **Narrowing the surface is an operator intervention the baselines did not get.** LAS-010 recorded
this deliberately: the driver's `--tools` flag can already narrow the surface and was **not** used for
the acceptance runs, because comparability was the point.

So: **if this task changes the served surface, re-run all rows rather than comparing across surfaces**
— LAS-010's own instruction, and it now has teeth, because a 29% cost cut would otherwise look like a
model improvement.

⚠️ **A tool the model cannot see is a capability the product does not have.** The failure mode to
watch is not cost, it is a model that never provisions a backend because it never knew it could. Any
disclosure scheme must be checked against a brief that *needs* the hidden half — an app with `Record`
nodes and auth — not only against the storefront.

## The combined target

With AWP-005, modelled against the two runs' actual per-turn bills:

| | billed today | tool-surface lever | node-doc lever | would bill | cut |
|---|---|---|---|---|---|
| DeepSeek V4 Pro | 4.41M / $5.73 | −898k / $1.17 | −381k / $0.50 | 3.13M / **$4.07** | **29%** |
| Kimi K3 | 5.73M / $16.32 | −853k / $2.43 | −796k / $2.27 | 4.08M / **$11.62** | **29%** |

Conservative — it assumes the same documents are still read and the same number of turns taken.

## Acceptance

- `--list-tools` reports the authoring surface under **8,000 tokens** including server instructions.
- Every backend tool remains reachable in the mode a backend app needs, and there is a fixture brief
  that exercises it.
- Turn-one prompt tokens on a replay drop from 22,968 to under 10,000, measured on the wire the same
  way F37 was.
- A replay of the storefront brief on DeepSeek V4 Pro (the cheapest complete builder, $5.83) after
  AWP-005 and AWP-006, with the new numbers recorded beside session 8's row and the surface change
  named — per LAS-010's re-run rule.

## As built — 2026-08-10

**Progressive disclosure, with profiles as the degenerate case.** The task offered three options and
recommended measuring the split first. Measured (`--list-tools`, write mode, 2026-08-10): **backend
admin is 57 tools and 59,840 of 100,684 chars — 59.4%**, close to F37's 63%. But the remainder is
**40,754 chars ≈ 10,189 tokens**, so *a backend profile alone misses the 8,000-token bar by 27%*.
That killed "server-side profiles" as a complete answer before any code was written, and it is the
measurement the task asked for.

### The shape

A manifest ([`src/toolGroups.ts`](../../../packages/noodl-mcp/src/toolGroups.ts)) splits the 90 tools
into one resident group and five deferred ones. Deferred tools are **registered and disabled**, so
`find_tools` re-enables them and the SDK emits `notifications/tools/list_changed` — the protocol's
own mechanism, no side channel. `--all-tools` restores the pre-AWP-006 surface in one flag.

| group | tools | resident |
|---|---|---|
| `core` | 20 | ✅ advertised |
| `backend` | 60 | held |
| `docs` (writes + `review_project`) | 3 | held |
| `explore` (`search_project`, `explain_component`, `list_examples`) | 3 | held |
| `project` (`create_project`, `get_import_report`) | 2 | held |
| `theme` (`set_project_tokens`, `set_style_preset`) | 2 | held |

### The membership was decided from the replays, not from taste

The four phase-55 acceptance replays record which tools four models actually called building the
same storefront. Counted, they **overruled three choices this table was about to make**:

- **`get_example` was first on the deferral list and stays.** 8 calls by sonnet, 6 by Kimi. The
  reasoning for cutting it — "LAS-007 pushes recipes into rejections anyway" — was sound and wrong.
- **The docs *reads* were about to be deferred and stay.** All four runs called `list_project_docs`
  and `get_project_doc` inside their first six turns; DeepSeek read three docs before writing
  anything. Deferring them puts a discovery round trip in front of reading the brief.
- **`search_project`, `explain_component` and `list_examples`: zero calls, all four runs.** They are
  useful — for somebody asking "where is this used" about a project they did not write — and none of
  them is on the path of building one. That is what deferral is for.

⚠️ Four runs of one brief is not a usage study; it is evidence about a storefront build, which is
the workload the budget exists for. Everything it argues for deferring is one call away, so being
wrong about one costs a round trip, not a capability.

### Three answers to "a tool the model cannot see"

The task's own warning is the design constraint, and one mitigation was not enough:

1. **`find_tools`' description names every deferred group, its size and its subject** — built from
   the manifest, and asserted by spec, so a group added with an empty `purpose` fails the suite.
2. **The server instructions name the call**, in the BACKENDS paragraph where an agent building a
   data app reads, and only when deferral is on: with `--all-tools` the sentence says
   `provision_backend` instead, so the instructions never point at a tool the reader cannot see.
3. **Authoring a node that needs a backend reveals the group unasked.** `ToolDisclosure.revealForNodes`
   keys off `backendRequirementFor` — the editor's reviewed `NODES_REQUIRING_BACKEND` table, so one
   classification decides both the precondition diagnostic and the disclosure. The write's success
   payload says so (`backendToolsRevealed`). **Discovery is the fallback, not the mechanism:** a
   staged `Record` node is a stronger statement of intent than any search query.

### What the numbers came out at

| | before | after |
|---|---|---|
| tools advertised | 89 | **20** |
| tool schema payload | 100,684 chars (~25,171 tok) | **28,297 chars (~7,074 tok)** |
| server instructions | 2,860 chars | 3,016 chars |
| **resident surface, per turn** | 103,544 chars (~25,886 tok) | **31,313 chars (~7,828 tok)** |

**A 70% cut, and `--list-tools` prints the total** rather than leaving two lines to be added up.

### Also changed, and it is not incidental

**`scripts/devtools/mcp-model-driver.js` now acts on `notifications/tools/list_changed`** and
re-lists between turns, recording a `tools-changed` event with the new per-turn cost. It dropped
every notification before this. A rig that ignores the notification would measure the cost saving
and silently miss the capability loss — it would have been the wrong instrument for its own
question.

### Left open, deliberately

⚠️ **Schema slimming was measured and mostly declined.** `update_component` (5,726 chars),
`create_plan` (3,609), `create_component` (3,561) and `stage_plan_operation` (3,075) are 55% of the
resident surface, and inspection of the emitted JSON Schema shows it is **already `$ref`-deduplicated
within each tool** — the node/port/connection shapes appear once and are referenced. What remains is
the same vocabulary triplicated *across* three tools, which JSON Schema over MCP cannot share. Only
one trim was taken: `render_report`'s description lost ~450 characters of per-viewport enumeration
and prerequisite prose that the response and the error message already carry at the moment they
matter.

## The re-replay — 2026-08-10

Cold replay of `STOREFRONT-BRIEF.md` on `deepseek-ai/DeepSeek-V4-Pro`, same rig, same brief
(1,248 chars), same prices, after **both** AWP-005 and AWP-006. **The surface changed, so this row
is not comparable to session 8's on cost — that is the point of the change, not a side effect.**
Per LAS-010's re-run rule, the change is named: 89 tools → 20, and `get_node_type` defaults to
`summary`.

| | session 8 (89 tools, full docs) | **after AWP-005 + 006 (20 tools, summary docs)** |
|---|---|---|
| turn-one prompt tokens | 22,968 | **8,578** — **−63%** |
| billed input, whole run | 4,410,622 | **2,674,024** — **−39%** |
| cost | $5.83 | **$3.55** — **−39%** |
| turns | **60 — max-turns, still working** | **47 — model-finished** |
| tool calls / rejections | 66 / 8 | 57 / 3 |
| `get_node_type` calls | 4 (full detail) | 4 (summary) |
| components / page own nodes | 12 / 8 | 10 / 8 |
| Component Inputs components | 5 (16 ports) | 4 (16 ports) |
| For Each / Static Data / Columns | 1 / 1 / 4 | 1 / 1 / 5 |
| `validate:project` | 0 / 0 (108 nodes) | **0 / 0 (115 nodes)** |
| render report | **blank-render, 0 texts** (F43); clean only with the defect undone | **clean as run** — 63 texts, 8 images, both viewports, 0 broken, 0 placeholders |

**The modelled target was $4.07 at a 29% cut. Actual: $3.55 at 39%** — better than the model,
because the model assumed the same number of turns and the run took 47 instead of 60. It also
**finished** instead of being cut off, which session 8's row could not say.

**F43 is closed by consequence, not by assertion.** Session 8's DeepSeek run rendered blank and
needed the defect undone by hand before it could be scored; this one renders as run.

### ⚠️ And the page is missing its hero — every instrument said clean

The screenshots
([desktop](../phase-55-llm-authoring-support/measurements/s9-awp006-deepseek-desktop.png),
[phone](../phase-55-llm-authoring-support/measurements/s9-awp006-deepseek-phone.png)) show nav,
trust strip, five product cards with badges and struck prices, category cards with counts, and a
three-column footer — **and an empty white band where the hero should be.** The hero component
exists, is complete, and has twelve nodes; its content subtree is orphaned and cannot draw.

**This is not a model error and not an AWP-006 regression.** DeepSeek issued exactly the right
three operations; two product defects on the `operations` write path swallowed them. Both are
reproduced minimally and filed as
[AWP-002 A19/A20](AWP-002-WRITE-PATH-CONFORMANCE.md#a19a20--the-minimal-reproduction). Read the row
above with that in mind: **the artefact cells are honest, and one of the brief's six sections is
invisible in a page that passed `validate:project` 0/0 and rendered "clean".** That is AWP-004's
thesis restated by a fresh run, and it earns AWP-004 a fourth check.

## Acceptance

- ✅ `--list-tools` reports the authoring surface at **7,828 tokens** including server instructions.
- ✅ Every backend tool remains reachable — gated three ways in
  [`tests/toolDisclosure.test.ts`](../../../packages/noodl-mcp/tests/toolDisclosure.test.ts), and the
  seven suites that exercise deferred tools now reach them **through `find_tools`**, so their green
  is evidence the disclosure door works. Fixture brief: [BACKEND-BRIEF.md](BACKEND-BRIEF.md).
- ✅ Turn-one prompt tokens: 22,968 → **8,578**, measured on the wire the same way F37 was.
- 📋 A replay of the storefront brief on DeepSeek V4 Pro after AWP-005 and AWP-006, recorded beside
  session 8's row with the surface change named. **The run was still in flight when session 3 ended**
  (turn 29 of 60); scored in session 4 — see [A17](#register).

## Register

| # | Finding | State |
|---|---|---|
| A11 | LAS-013 §2 filed this as a small-model capability problem. **1M-context models make it purely a cost problem**, which changes the fix from "make it fit" to "stop paying for it" | ✅ premise corrected, session 8 |
| A12 | The `claude` CLI has always deferred tools behind `ToolSearch`, so **no Claude row in the matrix has ever met the surface a plain MCP client gets**. Any cross-rig comparison must say so | ⚠️ standing caveat |
| A13 | **A backend profile alone could not have met the bar.** The non-backend surface is 10,189 tokens against an 8,000-token acceptance — 27% over. The task's recommendation to "measure the split before choosing" is what caught it; choosing the cheapest option on F37's 63% figure would have shipped something that missed its own acceptance and looked done | ✅ measured 2026-08-10 |
| A14 | **The transcripts overruled the manifest three times.** `get_example` (14 calls) was about to be deferred, the docs reads (all four runs, first six turns) were about to be deferred, and `search_project`/`explain_component`/`list_examples` (zero calls) were about to stay. **Membership in a resident set is a usage question, and this repo already had the usage data** — it was one `sort \| uniq -c` away and nearly went unasked | ✅ **the method, not the finding** |
| A15 | **The two-directional write-only assertion caught a misclassification on its first run.** `list_backend_processes` reads a registry and changes nothing, so it was filed as a read — but it ships in `registerProvisionTools`, inside the write gate. Asserting the manifest against *both* modes, in both directions, found in seconds what reading the file did not | ✅ fixed |
| A17 | ⚠️ **The handover described the re-replay as a finished artefact while its driver was still running.** Session 3 wrote up the run and named the project and transcript, but `mcp-model-driver.js` was at **turn 29 of 60** and the transcript had **no `run-end` event** — `extract-transcript.js` printed `# incomplete turns=? costUsd=0.00`. Scoring the snapshot would have produced a matrix row for a half-built app and a cost of $0.00, beside session 8's completed 60-turn row. **A transcript is only a finished artefact once it carries `run-end`; check that before scoring, and check for a live driver process before believing a handover's past tense** | ✅ caught before scoring, session 4 |
| A16 | ⚠️ **The budget is path-dependent and the jest number lied by 1.4%.** Server instructions embed the project directory, so the same build measured 7.9k in jest (a short temp dir) and **8,015 on the wire** (a 76-character project path) — over the bar. The spec now normalises to a deliberately long 160-character path so it errs strict. **Any budget measured against a fixture in `os.tmpdir()` inherits this**, and it is invisible because both numbers are "about 8,000" | ✅ fixed, and worth generalising |
