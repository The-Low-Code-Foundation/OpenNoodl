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

## Register

| # | Finding | State |
|---|---|---|
| F38 | **A `For Each` with no `template` renders nothing, and not one instrument notices.** Haiku's post-gates run created 3 repeaters, each with a correct inline `items` array and **no `template` parameter** — so the featured products, the category browser and the footer link columns are all absent from the page. `validate:project`: **0 errors, 0 warnings**. `render_report`: **0 errors**. The node census: `For Each 3 ✓`. The page renders *clean* because its content is *missing* — the render report counts dead placeholders and broken images, and has no check for content that was never drawn. Not a `rules/` rule: `NormNode` carries no `parameters` (verified again in `validation/model.ts`), so this belongs where LAS-001's interface gate lives | 🔴 **OPEN** — the highest-value gate the phase can still add; candidate **LAS-012** |
| F39 | **This matrix's own sonnet connections cell was in different units from haiku's.** `102` endpoints vs `0` connections. Baseline measured at 56 / 101 | ✅ **CLOSED** — matrix normalised, `score-run.js` reports both |
| F40 | **LAS-004's authored-blocking `repeated-sibling-subtree` is a wall for a 27B model.** `Qwen/Qwen3.5-27B` saw 19 of them, discarded its plan, and stopped at turn 32 having built one component — stating the rule by name as its reason. Not a loop and not a tool-calling failure: it opened exactly as sonnet did and recovered from its other rejections. **Capability**, on the model's own words. Both Claude models cleared the same rule again in this session (5 and 3 hits). Per LAS-011's own instruction this argues for smaller turns or better attachments, **not** for weakening the gate | 🔴 **OPEN** — filed as **LAS-013** |
| F41 | **`create_project` mints `Pages/Home`, and the very next tool rejects the model for planning it.** Both mid-tier models (haiku and qwen, not sonnet) burned a turn on *"Operation op-N creates 'Pages/Home', but that component already exists — use an update."* The `create_project` result does say it made a Home skeleton, so this is knowledge-the-model-was-given-and-dropped, and both recovered in one turn — but it is self-inflicted friction on our own on-ramp, and "structure > gate" says `create_plan` should absorb a create of an existing *empty skeleton* as an update | 🔴 OPEN, low severity — noted in LAS-012 |
