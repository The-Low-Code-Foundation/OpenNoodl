# LAS-011 — The exit: the acceptance matrix

**Status:** 📋 open · **Track 4 (models)** · **the phase closes on this, not on green gates** ·
needs LAS-001…008 landed and LAS-010's rig; LAS-009 is optional for the matrix

## What this is

The phase-40 bench, extended by this phase's requirement: replay the storefront brief **cold** on
three models, score the artefacts mechanically, and put the rendered pages in front of Richard
beside a Claude artifact of the same brief. The success line is written in the README and does not
move:

> The mid-tier and open-weight runs must be *architecturally* correct — components with real
> interfaces, repeaters over data, states and signals, responsive — even where their visual taste
> is weaker than Opus's. If a weak model produces a well-architected app with mediocre spacing,
> the phase succeeded; if only a strong model produces a beautiful page, it did not.

## Protocol

1. **One run per model, no rescues, stalls are data** — STOREFRONT-BRIEF.md protocol, verbatim
   brief, fresh `create_project` each:
   - mid-tier hosted: haiku (claude CLI rig)
   - strong hosted: sonnet (claude CLI rig)
   - mid-tier open-weight: LAS-010's model and driver
2. Pin the stack: record the commit hash the replays run against; all of LAS-001…008 in, viewer
   bundle rebuilt (`render-from-disk` tests the last build otherwise — its own header's warning).
3. Score each run with the STOREFRONT-BRIEF.md table + `render_report` + `validate:project`.
   **Score the artefact, and read the transcript before classifying any failure** — the session-1
   rule (a model that was never told about a tool did not "fail to know" it).
4. Publish the before/after matrix against the session-1 baselines in AUDIT-SESSION-1.md:
   haiku (dead cards, 1-col grid, 5 broken images, 0 connections) and sonnet (blobs, motorcycle,
   zero Columns, 147 turns). The gates' effect should be legible run-to-run: F2 rejections →
   interfaces exist; F3 → grids actually multi-column; LAS-002/007 → fewer wasted turns, measured.
5. **Richard judges** the rendered pages side-by-side against a Claude artifact of the same brief.
   His verdict is recorded here in his words, not paraphrased.

## Reading the results

- A failure that survives the new gates gets classified (knowledge / ordering / capability /
  seam) with transcript citations and either spawns LAS-012+ or is **accepted with a written
  reason** — an unwritten acceptance is a premise for the next phase to trip over.
- Watch for the gates' failure mode, not just their success: a mid-tier model looping forever on
  a now-blocking rejection is a capability finding that argues for LAS-007's attachments or
  smaller turns — not for weakening the gate. Turn counts and cost per run go in the matrix for
  exactly this reason.
- If the open-weight model cannot reliably tool-call at all (LAS-010's fallback triggered), the
  matrix says so as a capability row — the phase's claim then honestly narrows to "any competent
  tool-calling LLM", and that wording lands in the README.

## The matrix

**Stack pinned at `67284cc5`** (LAS-001…008 all in). `noodl-mcp` dist rebuilt before the runs; the
viewer bundle verified current — no file in `noodl-viewer-react/src`, `noodl-runtime/src` or
`noodl-types/src` is newer than it, so `render-from-disk`'s stale-build warning does not apply.
Three fresh `create_project` mints, brief verbatim, no rescues.

| | haiku 4.5 (before → after) | sonnet 5 (before → after) | open weights, hosted (DeepInfra) |
|---|---|---|---|
| model | claude-haiku-4-5 | claude-sonnet-5 | `Qwen/Qwen3.5-27B` |
| components / page-own nodes | 9 / 7 → **10 / 8** | 17 / 8 → **18 / 8** | **2 / 2** |
| Component Inputs where instances vary | ✗ (0 components) → **✓ 7 components, 15 ports** | ✓ 3 / 16 → **✓ 5 / 23** | **✓ 1 component, 7 ports** |
| varying instances with no port to land on | **2 types** → **none ✓** | 1 type → **none ✓** | none (0 instances placed) |
| repeaters over data (For Each + source) | ✗ 0 → **3 For Each**, but see F38 | ✓ 1+1 → **✓ 1 + Static Data, `template` set** | **✗ 0** |
| Columns where layout must reflow | ✓(broken string) 2 → **3** | ✗ 0 → **✓ 7** | **✗ 0** |
| connections / endpoints | 0 / 0 → **32 / 57** | 56 / 101 → **52 / 97** | 8 / 15 |
| validate: errors / warnings | 0 / 2 → **0 / 0** | 0 / 1 → **0 / 0** | 0 / 0 (19 nodes) |
| render report | 4 errors (29 dead texts, 5 broken images, 2 one-column grids, 768px floor) → **0 errors, 1 warning** (643px floor) | blobs + motorcycle, 525px floor → **RENDERED CLEAN: 0 errors, 0 warnings, phone lays out at a true 390px, 10 images 0 broken** | "Rendered clean" — on **1 text element** |
| turns / cost | 42 / $0.53 → **47 / $0.71** | 147 / $7.86 → **92 / $5.10** | **32 / $0.68** (2.19M in / 42.8k out, 636 s) |
| rejections / calls | — → **9 / 46** (2 carried a recipe) | — → **3 / 91** | **16 / 31 — 52%** (4 carried a recipe) |
| **the page actually built** | header, hero, info strip, **then nothing** — all three repeaters lack `template` (F38) | **the whole brief**, every section, matched photography, working badges and struck prices | **one ProductCard and an empty page.** Stopped voluntarily at turn 32 |
| Richard's verdict vs artifact | — | — | — |

Artifact baseline for step 5 (same brief, built as a Claude artifact):
<https://claude.ai/code/artifact/af9ec57b-bfe5-4cea-af65-cac99b6adb74>.
Screenshots: `measurements/s6-haiku-*.png`, `s6-sonnet-*.png`.

### Reading the two Claude rows

**The gates did what they were built to do, and it is legible run-to-run.** Haiku's whole
session-1 failure was F2 — six instance parameters landing on a component with no interface, four
cards rendering the literal word "Text". After LAS-001 it declares 7 interfaces with 15 ports and
the scorer's "varying instances with no port to land on" cell reads *none* for both models. Sonnet
went from **zero** `Columns` to seven and from a page that could not lay out below 525px to one
that lays out at a true 390px.

**And the cost went down, not up.** Sonnet: 147 turns / $7.86 → 92 turns / $5.10, with **3
rejections in 91 calls**. The worry in LAS-011 — that blocking gates would make a model loop and
cost more — is contradicted for both Claude models. Haiku's 9 rejections were each a *different*
error, i.e. rejection → fix → progress, never a loop.

**Sonnet's run is an unqualified pass.** Clean render report at both viewports, every section of
the brief present, and it drove `render_report` itself mid-run rather than being told to.

**Haiku's run is the interesting one and it is not a pass.** Architecturally it is now correct on
every axis the phase measures — components, interfaces, repeaters, signals, Columns. It renders
zero errors. And it is missing half its content, because three `For Each` nodes carry a correct
`items` array and no `template` (F38). Sonnet set `template` on its one repeater; haiku set it on
none of three. That is the difference between the two pages, and nothing in the product said a
word about it.

### Reading the open-weight row — the gate stopped it, and it said so

`Qwen/Qwen3.5-27B` tool-called correctly from the first turn. It opened exactly as sonnet did
(`get_project_info` → `get_style_vocabulary` → `create_plan`), planned a sensible tree, and
recovered from its early rejections the way the phase predicts — `Columns` → `net.noodl.visual.columns`
after an `unknown-node-type`, encoding fixes after `unknown-parameter`. **The capability to tool-call
is not the limit.** LAS-011's contingency ("if the open-weight model cannot reliably tool-call at
all") did not trigger.

What stopped it was one of this phase's own gates. It saw **19 `repeated-sibling-subtree`
diagnostics**, discarded its plan, fell back to `create_component`, and at turn 32 stopped calling
tools and wrote, unprompted:

> *"the strict validation rules (particularly the `repeated-sibling-subtree` rule) are preventing
> the page from being saved. The validator requires that repeated structures be factored into
> components or driven from data…"*

That is **F40**, and it is the failure mode LAS-011 told this session to watch for, arriving
exactly as written — except that it gave up rather than looping. Its own words are the transcript
citation, so the classification does not need inference: **capability**. It understood the rule,
could state the rule, and could not perform the refactor the rule demands. LAS-004 promoted that
warning to authored-blocking on the strength of haiku and sonnet recovering from it — both did
again here (5 hits and 3 hits, both recovered). At 19 hits and 27B, it is a wall.

**The instruction in LAS-011 stands and this session follows it: this argues for smaller turns or
more of LAS-007's attachments, not for weakening the gate.** A concrete, cheap version is in
LAS-012: 4 of qwen's 16 rejections carried a recipe; the `repeated-sibling-subtree` rejection
already attaches one, and it still was not enough to get a 27B model from "three identical Groups"
to "a component plus a repeater" in one turn.

## Verdict against the phase's own success line

> *"If a weak model produces a well-architected app with mediocre spacing, the phase succeeded; if
> only a strong model produces a beautiful page, it did not."*

**On its own wording, the phase did not clear its bar.** Read honestly:

- **Strong model: beautiful page.** Sonnet produced the whole brief, clean at both viewports.
- **Mid-tier hosted: architecturally correct, half-empty.** Haiku's graph is right and its page is
  not, on one unset port that nothing checks.
- **Open-weight: blocked.** One component, stopped voluntarily, defeated by a gate this phase added.

What *did* land is real and measurable, and it is most of the distance: every F2-class defect is
gone from both Claude runs, sonnet's page went from unusable to shippable, and the gates made runs
**cheaper**, not more expensive. The remaining gap is narrow and named — the repeater contract
(F38) and the refactor cliff for small models (F40) — rather than the diffuse "AI is bad at NodeGX"
the phase opened with. That is a better position than the phase started in, and it is not the same
thing as passing.

## Step 5 — Richard's verdict

Put to him 2026-08-08 as a side-by-side judging page (all three rendered pages, the matrix, and the
two remaining defects): <https://claude.ai/code/artifact/ca1ecdea-eb95-457f-8606-342fbc8fd9b1>,
against the artifact baseline <https://claude.ai/code/artifact/af9ec57b-bfe5-4cea-af65-cac99b6adb74>.

The three questions asked, because the phase's claim depends on the answers:

1. Does **sonnet's** page clear the bar — "a real shop, not a template"?
2. If **LAS-012** lands and haiku's lists draw, would that page clear it too? That one gate is the
   whole difference between its current state and a complete page.
3. Is **"any competent LLM"** still the claim, or does it narrow — and to what? On today's evidence
   the honest answer is not 27B.

> **Richard's verdict, in his words (2026-08-08):**
>
> *"Sonnet is the only one that clears the bar, which confirms that we should recommend Opus for
> scoping larger creations and doing high level design, Sonnet for the creation work and basic
> designs. We can allow open weight models via API like DeepSeek v4 or the latest Qwen, the big
> ones, but local Ollama looks to be a waste of time. You can add the OpenAI / Grok / Google
> equivalents we recommend at the same capability level of Sonnet, we don't need to test them I
> think it's well known."*

### What the verdict settles

1. **Sonnet's page clears the bar; the other two do not.** The matrix's own reading stands.
2. **The claim narrows, deliberately.** Not "any competent LLM" — a **recommended model per role**,
   which is exactly the seam LAS-009 built and left unused. Opus for scoping and high-level design,
   Sonnet-class for the creation work.
3. **Open weights stay supported, hosted only.** DeepSeek V4 / large Qwen via API are in.
   **Local ollama is out** as a serious authoring target — consistent with everything measured:
   the machine caps at ~10.7 GB of Metal working set, the only pull present is a 3B model, and the
   89-tool surface alone is 27,322 tokens (F37).
4. **Peer models are recommended without testing, on Richard's explicit instruction.** Any entry
   added on that basis must be **labelled as untested here**, because this phase's whole method is
   that measured and assumed claims are not the same thing.

This does **not** close F38 or F40 — LAS-012 and LAS-013 remain filed. It changes what the product
should *recommend* today, not what it still gets wrong.

## The recommendation, as shipped

Richard's verdict is a decision about which models to point people at, so it lives in the model
registry (`AiAssistant/client/models.ts`) rather than only in prose — the settings role pickers read
it from there and label the recommended pick, so the UI and this document cannot drift apart.
Pinned by `tests-unit/phase-55/recommendedModels.test.ts` (8 specs, both tripwires watched failing).

| Role | Recommended | Why |
|---|---|---|
| **design** — scoping, high-level architecture | `claude-opus-5` | Richard: *"Opus for scoping larger creations and doing high level design"* |
| **plan** — the component tree | `claude-opus-5` | same call; planning is where the architecture is decided |
| **act** — authoring the graph | `claude-sonnet-5` | the only model that cleared the bar: whole brief, clean render, 92 turns / $5.10 |

**Open weights are allowed, hosted only.** `openai-compatible` now carries its own entries —
`deepseek-ai/DeepSeek-V4-Pro` (1,048,576 ctx) and `Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo`
(262,144 ctx) — which also closes the practical half of **F35**: the provider used to fall through
to the OpenAI catalogue and offer a DeepInfra user `gpt-4.1`, an id that gateway does not serve.
They carry **no pricing**, deliberately: the same weights cost different amounts on different
gateways, and a confident wrong number is worse than a null.

**Local ollama is not recommended for authoring**, and a test enforces it. Measured basis: the only
pull on the reference machine is a 3B model, `qwen2.5-coder:32b` needs ~20 GB against a ~10.7 GB
Metal ceiling, and the write-mode MCP surface alone is 27,322 prompt tokens (F37).

### The peers — recommended on reputation, deliberately *not* in the registry

Richard: *"You can add the OpenAI / Grok / Google equivalents we recommend at the same capability
level of Sonnet, we don't need to test them I think it's well known."* Recorded here with the ids
verified live, and **not** added as registry rows — a row needs a context window, an output cap and
a price, and inventing those is exactly the failure this phase spent six sessions documenting.

| Vendor | Sonnet-class pick | Verified how | Reachable today |
|---|---|---|---|
| OpenAI | `gpt-5.5` (`gpt-5.5-2026-04-23`); `gpt-5.3-codex` for coding | live `GET /v1/models` on Richard's key | ✅ `openai` provider |
| xAI | `grok-4.5` — 500k ctx, $2/$6 per MTok | docs.x.ai/docs/models | via `openai-compatible`, `https://api.x.ai/v1` |
| Google | `gemini-3.6-flash` (stable, agentic/coding); `gemini-3.1-pro-preview` is the flagship | ai.google.dev model list | via `openai-compatible` OpenAI-compat endpoint |

⚠️ **None of the three was replayed against the storefront benchmark**, and neither were Opus 5 or
the open-weight entries. Only `claude-sonnet-5` and `claude-haiku-4-5` carry `measured: true` in the
registry, and a tripwire fails if anything else claims it. The editor has no first-class xAI or
Google adapter; both are OpenAI-compatible, so they work through that provider without new plumbing
— and their context and output limits are gateway-dependent, which is the other reason they are not
registry rows.

## Acceptance (of the phase itself)

- Matrix complete, all cells evidenced (screenshots in `measurements/`, transcripts kept).
- Mid-tier **and** open-weight rows architecturally correct with clean render reports, per the
  success line — or the shortfall classified, written up, and the follow-on tasks filed.
- README status updated to the outcome; HANDOVER.md for any successor phase names what was
  accepted-with-reason.

## Session 6 — the instruments, built before the runs

Session 1 scored by hand, which is why its numbers cost a session and cannot be re-derived. Three
scripts now do it, each calibrated against the published baselines *before* being trusted:

| Instrument | What it answers | Calibration |
|---|---|---|
| `measurements/score-run.js` | every mechanical cell of the matrix, off disk | reproduces haiku's published 9/7 and sonnet's 17/8 exactly |
| `measurements/extract-transcript.js` | the call sequence, and every rejection by code, tool and whether a LAS-007 recipe rode along | reads both rigs' dialects; the payload shape was read off a live transcript after a guessed one printed `[object Object]` |
| `scripts/devtools/mcp-model-driver.js` | the third rig (LAS-010 §2) | driven end-to-end against local ollama before any spend |

**A units bug in this document, found by the scorer (F39).** The sonnet cell below read `102`
against haiku's `0` in the same row — but `102` is *connection endpoints* and `0` reads as
*connections*. Measured on the baseline: **56 connections / 101 distinct endpoints**. Zero is zero
in both units, so the mismatch was unfalsifiable until a run put a non-zero number in the other
column. The matrix below is normalised to **connections / endpoints**, both stated.

**And `validate:project`'s error count cannot be read as "clean" (F14, already open).** It reports
`0 error(s)` on the session-1 haiku baseline whose every card is dead, because it runs `rules/`
only and never the precondition checks. The row is kept for continuity; the interface question is
answered by the scorer's `varying instances w/o input` line instead.

## Session 8 — the 2026-class open-weight models, and the defect they both found

**Asked for by Richard 2026-08-08**, after the verdict: replay the brief on two current open-weight
models rather than the 27B that session 6 could only get blocked. Both were picked off DeepInfra's
live catalog and both carry the `tools` tag and a **1,048,576-token context**, so **F37's
32k-context lockout does not apply to either** — the 89-tool floor fits with room to spare.

⚠️ **These two rows are NOT on session 6's stack, and the difference is named.** Session 6 pinned
`67284cc5`; these ran at `6ad5c3ca`, which includes **LAS-012's repeater-contract gate** (three new
authored-blocking codes) and **F41's create→update coercion**. The *tool surface* is identical —
both runs report `tools=89 schemaChars=100512`, the same numbers session 6 measured — so the
comparison holds on cost and turn count; the gates are stricter, which if anything is a harder bar.
The prompt was the **byte-identical `prompt.txt` from session 6**, not a reconstruction.

| | DeepSeek V4 Pro | Kimi K3 |
|---|---|---|
| model / price | `deepseek-ai/DeepSeek-V4-Pro` · $1.30/$2.60 per MTok | `moonshotai/Kimi-K3` · $2.85/$14.25 per MTok |
| stop reason | **max-turns (60)** — still working | model-finished at 57 |
| components / page-own nodes | 12 / 8 | **11 / 25** |
| Component Inputs where instances vary | ✓ 5 components, 16 ports | ✓ 4 components, 19 ports |
| varying instances with no port to land on | none ✓ | none ✓ |
| repeaters over data | **1 For Each, `template` set** | **2 For Each + 2 Static Data** |
| Columns where layout must reflow | 4 | 5 |
| connections / endpoints | 17 / 33 | **75 / 140** |
| States / Component Outputs | 0 / 0 | 0 / **8** |
| validate: errors / warnings | 0 / 0 (108 nodes) | 0 / 0 (149 nodes) |
| render report, **as run** | **blank-render, 0 texts** (F43) | "Rendered clean", 83 texts, 10 images |
| render report, **defect undone** | **clean: 91 texts, 8 images**, desktop 2704px, phone 6128px | — |
| turns / cost | 60 / **$5.83** | 57 / **$17.01** (+$7.86 void run, F42) |
| rejections / calls | 8 / 66 (1 carried a recipe) | **5 / 91** (0 carried a recipe) |
| **the page actually built** | **the whole brief** — nav, hero, trust strip, 4 product cards with sale/best-seller badges and struck prices, category counts, three footer columns. Invisible until F43 is undone, then dismantled by its own turn-60 edit | **the whole brief in the graph, and almost none of it on screen**: an always-mounted `NoticeDialog` takes the layout, desktop is clipped at 900px, and at 390px the page is *only* the dialog |

**Neither is blocked the way Qwen3.5-27B was.** `repeated-sibling-subtree` — the wall that stopped
the 27B at turn 32 — was hit **once** by DeepSeek and **twice** by Kimi, and both recovered without
comment. **F40's cliff is a small-model cliff, not an open-weight cliff**, which is the thing
session 6 could not distinguish and this session can.

**And both are cheap in rejections.** Kimi took **5 rejections in 91 calls** — a better ratio than
sonnet's 3/91 is not, but far better than the 27B's 16/31, and it never looped.

### What actually happened: both models were defeated by the same defect in our own write path

Both built a correct storefront. Both rendered blank. **Neither failure is a model failure** — see
**F43**. The two runs differ only in whether the model escaped it:

- **Kimi escaped.** At turn 38 it saw `blank-render`, added a probe `Text` **to the existing page**,
  saw it render, correctly concluded the fault was in its *components*, and issued
  `set_visual_roots` for **all ten of them in a single turn**. 83 texts and 10 images appeared.
- **DeepSeek did not.** It ran the *same* experiment at turn 42 — but created a **new** component
  (`Pages/Test`, a `Page` node and one "Hello World" `Text`) to hold the probe. That component was
  born without visual roots too, so its control also rendered blank, and it concluded: *"this is
  almost certainly a viewer/build issue."* It then spent turns 42→60 on `urlPath`, `startPage`,
  `clip` and `flexDirection`, and at turn 60 removed the Group holding its six sections — leaving
  the `Page` node alone on disk, which is the artefact scored above.

One placement difference in the same debugging move, opposite conclusions. Scored on the artefact
alone, DeepSeek looks like the worst run of the phase; scored on what it built, it is the second
most complete page any model has produced here.

### Reading the two rows against the phase's success line

> *"If a weak model produces a well-architected app with mediocre spacing, the phase succeeded."*

On architecture **both clear it**: real interfaces, repeaters with data behind them, `Columns` on
everything that must reflow, no varying instance without a port, `validate:project` clean on 108 and
149 nodes. Kimi's 75 connections / 140 endpoints and 8 Component Outputs are the richest wiring of
any run in the phase, sonnet included.

On the *page*, neither is sonnet:

- **DeepSeek's** desktop page is complete and well-proportioned. At 390px the nav links squeeze to
  one letter per line and the hero photo collapses to a sliver — it reflows the grids and not the
  nav. `render_report` calls that clean.
- **Kimi's** page is unusable at both viewports for one reason: a dialog component mounted
  unconditionally into the layout instead of over it. Everything else it built is behind it.

So the honest addition to Richard's verdict is narrow: **hosted open weights are no longer the
blocked leg**. Both models tool-call, plan, recover from gates and self-verify with `render_report`;
what neither did is get a *page* to sonnet's standard, and one of the two was stopped by us.

**Cost note.** $30.70 total: DeepSeek $5.83, Kimi $17.01, plus $7.86 for the void Kimi run (F42).
Kimi is 11× DeepSeek's per-token output price and used a comparable number of turns, which is most
of the gap. DeepSeek V4 Pro built the more complete page for **a third of sonnet's $5.10-adjacent
cost** — $5.83 including 27 wasted turns it should never have spent.

## Session 9 — the same model, a different surface

**Run 2026-08-10 after phase 58** (AWP-001…006), same rig, same verbatim brief, same prices, same
model. This is LAS-010's re-run rule being obeyed rather than cited, and **the surface change is
named because without naming it a 39% cost cut reads as a model improvement**:

> **89 tools → 20** (AWP-006 defers 70 behind `find_tools`), and **`get_node_type` defaults to
> `detail:"summary"`** (AWP-005). Resident surface 25,886 → **7,828 tokens/turn**.

⚠️ **The cost and turn cells are not comparable to session 8's — they are the intervention.** The
artefact cells (components, `For Each`, `Columns`, validate, render report) are comparable, because
nothing in phase 58 changed what the model is asked to build.

| | session 8 DeepSeek (89 tools) | **session 9 DeepSeek (20 tools)** |
|---|---|---|
| turn-one prompt tokens | 22,968 | **8,578** — −63% |
| billed input / cost | 4,410,622 / $5.83 | **2,674,024 / $3.55** — −39% |
| stop reason | **max-turns (60)** — still working | **model-finished at 47** |
| tool calls / rejections | 66 / 8 | **57 / 3** |
| components / page own nodes | 12 / 8 | 10 / 8 |
| Component Inputs components | 5 (16 ports) | 4 (16 ports) |
| For Each / Static Data / Columns | 1 / 1 / 4 | 1 / 1 / **5** |
| validate: errors / warnings | 0 / 0 (108 nodes) | 0 / 0 (**115 nodes**) |
| render report, **as run** | **blank-render, 0 texts** (F43) — scorable only with the defect undone | **clean as run** — 63 texts, 8 images, 0 broken, 0 placeholders, both viewports |

**F43 is closed by consequence.** Session 8's artefact had to be repaired by hand before it could be
scored; this one renders as run, and the model never passed `visual_roots` once.

⚠️ **And one of the brief's six sections is invisible anyway.** The hero is an empty white band at
both viewports — not a model error and not an AWP-006 regression, but two write-path defects that
swallowed three correct operations. Filed as **AWP-002 A19/A20** with a minimal reproduction; the
full reading is in
[AWP-006 §The re-replay](../phase-58-ai-write-path/AWP-006-PROGRESSIVE-TOOL-DISCLOSURE.md#the-re-replay--2026-08-10).
**`validate:project` said 0/0 and `render_report` said clean** — which is F38's thesis arriving a
third time, from a fourth direction.

Transcript and screenshots: `measurements/s9-awp006-deepseek-*`.

⚠️ **A12 applies to every Claude row above.** The `claude` CLI has always deferred tools behind its
own `ToolSearch`, so no Claude row ever met the 89-tool surface a plain MCP client got. Now that the
server defers too, a row must say *which* deferral it met.

## Register

| # | Finding | State |
|---|---|---|
| F38 | **A `For Each` with no `template` renders nothing, and not one instrument notices.** Haiku's post-gates run created 3 repeaters, each with a correct inline `items` array and **no `template` parameter** — so the featured products, the category browser and the footer link columns are all absent from the page. `validate:project`: **0 errors, 0 warnings**. `render_report`: **0 errors**. The node census: `For Each 3 ✓`. The page renders *clean* because its content is *missing* — the render report counts dead placeholders and broken images, and has no check for content that was never drawn. Not a `rules/` rule: `NormNode` carries no `parameters` (verified again in `validation/model.ts`), so this belongs where LAS-001's interface gate lives | 🔴 **OPEN** — the highest-value gate the phase can still add; candidate **LAS-012** |
| F39 | **This matrix's own sonnet connections cell was in different units from haiku's.** `102` endpoints vs `0` connections. Baseline measured at 56 / 101 | ✅ **CLOSED** — matrix normalised, `score-run.js` reports both |
| F40 | **LAS-004's authored-blocking `repeated-sibling-subtree` is a wall for a 27B model.** `Qwen/Qwen3.5-27B` saw 19 of them, discarded its plan, and stopped at turn 32 having built one component — stating the rule by name as its reason. Not a loop and not a tool-calling failure: it opened exactly as sonnet did and recovered from its other rejections. **Capability**, on the model's own words. Both Claude models cleared the same rule again in this session (5 and 3 hits). Per LAS-011's own instruction this argues for smaller turns or better attachments, **not** for weakening the gate | 🔴 **OPEN** — filed as **LAS-013** |
| F41 | **`create_project` mints `Pages/Home`, and the very next tool rejects the model for planning it.** Both mid-tier models (haiku and qwen, not sonnet) burned a turn on *"Operation op-N creates 'Pages/Home', but that component already exists — use an update."* The `create_project` result does say it made a Home skeleton, so this is knowledge-the-model-was-given-and-dropped, and both recovered in one turn — but it is self-inflicted friction on our own on-ramp, and "structure > gate" says `create_plan` should absorb a create of an existing *empty skeleton* as an update | 🔴 OPEN, low severity — noted in LAS-012 |
| F42 | **The driver read a truncated reply as a voluntary stop, and voided a $7.86 run.** Kimi K3 deliberates in `content` before acting; on turn 34 DeepInfra cut its reply at `--max-tokens 4096` mid-plan. With no `tool_calls` in that message the driver recorded `stop: 'model-finished'` — a `run-end` claiming the model chose to stop after 53 read-only calls, when it had been interrupted mid-sentence. Every other turn was `finish_reason: "tool_calls"`; that one was `"length"`, and nothing looked | ✅ **CLOSED** 2026-08-08 — `mcp-model-driver.js` now records `stop: 'response-truncated'` plus a `warning` event when `finish_reason === 'length'` with no tool call. Re-run at `--max-tokens 16384` completed 57 turns. Non-binding for the other rows: DeepSeek's 60 turns are all `tool_calls`, and the 27B stopped with a written explanation |
| F43 ⭐ | **Every write door treats `visual_roots` as optional, nothing derives it, and a component without it is invisible.** `create_component`, `update_component.set` and `stage_plan_operation` all declare `visual_roots` as `.optional()` with **no `.describe()`** — the string never appears in any tool description. Omit it and the file has no `visualRoots`; the runtime renders a component instance from `componentModel.roots` and empty means nothing (`componentinstance.ts:322`). **The editor cannot produce such a file**: `visualRoots` is *derived* there, recomputed by `getVisualRootIds()` on every serialize, and `ProjectImporter` builds roots from the node tree regardless. So MCP writes a shape the editor never would, and `render-from-disk` (`roots: nodesFile.visualRoots \|\| []`) renders it empty. **Two compounding failures:** (1) the `blank-render` message blames the *page* — *"renders blank without a Page node at its root, and a route no Router lists is never reached"* — when the Page node and Router are correct, sending DeepSeek to `urlPath`/`startPage`/`clip` for 18 turns; (2) it **poisons the control experiment**: a probe placed in a *new* component is invisible for the same reason, so DeepSeek's "does anything render at all" test returned a false negative and it concluded the viewer bundle was stale. Verified by consequence on a copy: restore the page → blank; plain `Text` on the existing page → renders; derive `visualRoots` for its 12 components, change nothing else → **clean, 91 texts, 8 images, both viewports**, `validate:project` 0/0 on 108 nodes. Invisible until now because haiku, sonnet and qwen all happened to pass it (21, 21 and 17 mentions in their transcripts) | 🔴 **OPEN — the highest-value defect this session found.** Candidate fix is *derivation, not documentation*: `assembleCreateFiles` should default `visualRoots` to the visual top-level nodes exactly as `getVisualRootIds()` does, and the render harness should do the same when the field is absent. "Structure > gate", the phase's own preference order |
| F44 | **`get_node_type`'s `detail: "summary"` conveys no type information at all — 100% of the catalog.** `catalog.ts:273` builds each port line as `` `${dir} ${p.name}: ${String(p.type)}` ``, but a port's `type` is an object (`{name:'enum',enums:[…]}`), so every line reads `in alignContent: [object Object]`. **Measured across all 142 node types: 2,455 of 2,455 port one-liners (100%).** The mode exists to save context and is 4.5× cheaper — 6,741 vs 30,815 tokens for the 8 types a storefront needs — so the one lever we have against doc bulk is unusable, and every model pays full price. Full detail is not small: **`Group` alone is 44,070 chars ≈ 11,000 tokens**, and the 8 common visual types are **30,815 tokens — more than all 89 tool schemas combined (22,968)**. Because input is resent every turn, a doc read on turn 8 is re-billed on every turn after it: the fixed surface alone was **29%** of Kimi's 2.72M and **31%** of DeepSeek's 4.41M billed input | 🔴 **OPEN** — one-line cause. Fix `String(p.type)`, then consider making `summary` the default with full detail opt-in per port. Note the doc volume is **not** what keeps the framework salient: sonnet produced the only unqualified pass on the rig that *defers* tools behind `ToolSearch`, DeepSeek read 4 node types and built a complete app, Kimi read 21 and had authored nothing by turn 34 |
| F45 | **`render_report` passed a page whose content is entirely off-screen.** Kimi's final artefact reports *"Rendered clean: desktop 1280×900px, 83 texts, 10 images; phone 390×844px, 83 texts, 10 images"* and `findings: []`. On screen: a `NoticeDialog` with `Title` / `Body` / `Got it`, and at 390px **nothing else at all**. Two signals were in the report and neither raised a finding — desktop `pageHeight` is **exactly 900**, i.e. the viewport, so the page is clipped rather than scrolling; and phone `overflowingCount` is **43**. `scrollWidth <= clientWidth` held, so the page-level overflow check passed while 43 elements overflowed their own containers. This is the third distinct way the eyes have passed an unbuilt page (F38 was content never drawn, session 6's two "clean on 1 text element", this is content drawn and pushed out of view) | 🔴 **OPEN** — candidates: raise a finding when `pageHeight` equals the viewport height exactly, when `overflowingCount` is non-zero, or when the visible text is a small fraction of the counted text. Also `Title`/`Body` should be in `placeholderStrings` |
