# Phase 55 — handover after session 6 (the acceptance session)

Written to be read cold. Session 6 ran LAS-010 + LAS-011, the last two tasks. **All eleven tasks
are done. The phase does not clear its own bar, and that is recorded rather than rounded up.**

## Where the phase actually stands

| | |
|---|---|
| LAS-001…011 | ✅ all done |
| The acceptance matrix | ✅ complete, all cells measured — [LAS-011](LAS-011-ACCEPTANCE-MATRIX.md) |
| The phase's success line | ❌ **not met** — only the strong model produced a good page |
| Richard's verdict (the actual exit) | ⏳ **outstanding** — the phase is not closed until it is recorded |
| Successors filed | [LAS-012](LAS-012-REPEATER-CONTRACT.md) ⭐, [LAS-013](LAS-013-SMALL-MODEL-HEADROOM.md) |

**Do LAS-012 first.** It is one precondition check of a shape already built five times, its fixture
is already on disk (`NodeGX test projects/phase55-s6-haiku` must produce three
`repeater-without-template` errors), and it is the entire difference between "architecturally
correct" and "a page with its lists drawn".

## The three runs, in one table

Stack pinned at `67284cc5`. Brief verbatim, fresh `create_project` each, no rescues.

| | haiku 4.5 | sonnet 5 | Qwen3.5-27B (open weights, hosted) |
|---|---|---|---|
| outcome | right graph, **half a page** | **unqualified pass** | **blocked by our own gate** |
| turns / cost | 42/$0.53 → 47/$0.71 | 147/$7.86 → **92/$5.10** | 32/$0.68 |
| rejections / calls | 9 / 46 | 3 / 91 | **16 / 31** |
| render report | 4 errors → **0 errors** | blobs+motorcycle → **CLEAN** | "clean" on **1 text element** |

Screenshots and transcripts: `measurements/s6-*`. Judging page:
<https://claude.ai/code/artifact/ca1ecdea-eb95-457f-8606-342fbc8fd9b1>. Artifact baseline:
<https://claude.ai/code/artifact/af9ec57b-bfe5-4cea-af65-cac99b6adb74>.

## The six findings, and which of them were in the documents I inherited

The phase's rule — *read the mechanism in source before trusting any stated fact, including facts
stated by this phase's own documents* — paid again. **Three of these six were wrong premises in
task files or in this matrix.** The count has still never been zero.

- **F36** — LAS-010's settled model, `Qwen2.5-Coder-32B-Instruct`, is **not tool-capable on
  DeepInfra** (tags `openai,completion`, no `tools`). Caught against the public catalog *before any
  spend*. Richard re-chose `Qwen/Qwen3.5-27B`.
- **F37** — our write-mode MCP surface is **89 tools = 27,322 prompt tokens on turn one**, measured
  on the wire; 63% of the schema bytes are backend admin. Locks out every 32k-context client and is
  resent every turn (qwen billed 2.19M input tokens over 32 turns). **The baselines never met this**
  — the `claude` CLI defers tools behind `ToolSearch`; haiku opened session 1 with 11 such calls, so
  "the same surface" was never the same surface. → LAS-013 §2.
- **F38 ⭐** — **a `For Each` with no `template` renders nothing and every instrument reports a
  pass.** `validate:project` 0/0, `render_report` 0 errors, a census reads "For Each 3". Cost haiku
  its products, categories and footer. Qwen failed the same contract from the other side (template
  as a *child*, down an `invalid-argument` path that carries no recipe). → LAS-012.
- **F39** — LAS-011's own sonnet cell was in *endpoints* (102) where haiku's was in *connections*
  (0). Measured 56/101. Invisible until a run put a non-zero number in the other column. ✅ fixed.
- **F40** — **LAS-004's authored-blocking `repeated-sibling-subtree` is a wall for a 27B model.**
  19 hits; it discarded its plan and stopped at turn 32 **naming the rule**. → LAS-013 §1.
- **F41** — `create_project` mints `Pages/Home`; `create_plan` rejects the model for planning it.
  2 of 3 models, one turn each. → LAS-012 §4.

## What is now built that earlier sessions did not have

Three instruments, each **calibrated against the published baselines before being trusted** — the
session-1 numbers cost a session to produce by hand and could not be re-derived:

- **`scripts/devtools/mcp-model-driver.js`** — the third rig. An OpenAI-compatible
  `/chat/completions` endpoint bridged to a `noodl-mcp` stdio child. Drives DeepInfra *and* ollama
  (`/v1`) from one code path. Plain CJS, no dependency. `--list-tools` measures the served surface;
  `--tools a,b` narrows it (**deliberately unused for the acceptance run** — narrowing is an
  operator intervention the baselines did not get). Verified end-to-end against local ollama, free,
  before any spend.
- **`measurements/score-run.js`** — every mechanical matrix cell off disk. Reproduces haiku's
  published 9/7 and sonnet's 17/8 exactly. It found F39.
- **`measurements/extract-transcript.js`** — both rigs' dialects; rejections by tool, by diagnostic
  code, and by whether a LAS-007 recipe rode along.

## Traps this session hit, so you do not

- **A clean render report does not mean a built page.** It checks for content present-and-wrong
  (dead placeholders, broken images), never for content never drawn. Two of the three runs got
  "Rendered clean" on pages missing most or all of their content. **Read the `texts`/`images`
  counts and look at the screenshot.** This is half of F38 and it is in LAS-012 §3.
- **`validate:project`'s `0 error(s)` is not "clean"** — it runs `rules/` only, never the
  precondition checks (F14, still open). It reports 0 errors on the session-1 haiku baseline whose
  every card is dead.
- **A parameter-reading check cannot be a `rules/` rule.** `NormNode` still carries no
  `parameters`; verified again this session. Precondition checks live off
  `authoredPreconditionDiagnostics()` (`validation/authoredCandidate.ts:286`).
- **Guessing a payload shape wastes a cycle.** The rejection summariser was written twice: the
  first version guessed from LAS-002's task text and printed `[object Object]`. The real shape came
  off a live transcript — `error.details.readable[]` plus `error.details.examples.recipes[]`.
- **`create_project` writes the project you are about to serve**, so mint all replay projects
  first, then start the servers.
- **The `.env` at the repo root holds the keys** (`DEEPINFRA_API_KEY` among them) and is
  gitignored. Read it into the child process only; never echo it.

## Gates at this session's close — all green, all at the expected counts

- `npx jest` in `packages/noodl-editor` — **78 suites / 1060 specs** (unchanged from session 5).
- `npx jest` in `packages/noodl-mcp` — **24 suites / 250 specs**.
- `npm run catalog:examples` 57/57 · `catalog:check` up to date · `catalog:merge:check` up to date ·
  `typecheck:editor` clean.
- ⚠️ Unchanged and **not yours**: `npm run test:ci` (jasmine/Electron) still has the 4 inherited
  `AIX-006` failures (F32); `noodl-mcp`'s own `tsc --noEmit` still has 6 pre-existing test-file
  errors (F21).

## What the next session should do

1. **Get Richard's verdict recorded** in LAS-011 §"Step 5", verbatim. The phase does not close
   without it, and an empty block means the exit criterion was never met.
2. **LAS-012.** One check, one fixture already on disk, the highest-value gate left.
3. **LAS-013** if the claim "any competent LLM" is to survive. Its strongest candidate is an
   `extract_component` tool — structure over gate, the phase's own preference order: the model then
   does not need to be able to *do* the refactor, only to *ask* for it.
4. If LAS-013 changes the served tool surface, **re-run all three rows** rather than comparing
   across surfaces.
