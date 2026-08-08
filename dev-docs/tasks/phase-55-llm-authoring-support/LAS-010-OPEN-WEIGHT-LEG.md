# LAS-010 — The open-weight leg

**Status:** 📋 open · **Track 4 (models)** · ⚠️ **step 1 is human-gated** · required by LAS-011

## The gap, stated honestly (audit §A)

The phase's bar requires a mid-tier **open-weight** model, and no such replay has ever run:

- ollama is installed with only `llama3.2:latest` — 3B, 22 months old, below mid-tier and a weak
  tool-caller. Not a serious candidate.
- The editor's provider layer is ready (native ollama adapter, `providers/ollama.ts`, 322 lines,
  tested; any OpenAI-compatible `baseUrl` is first-class) — but that is the *editor-loop* path.
- **No MCP-capable client for a local model exists here.** The cold-replay rig
  (STOREFRONT-BRIEF.md protocol) runs on `claude` CLI, which cannot drive ollama. The phase-15
  headless harnesses (`aix002-measure`, `aix15-live`) take `--provider=ollama` but drive the
  in-editor loop, are phase-15 vintage, and likely need build repair against today's `src/`.

## Build

### 1. The model — Richard decides first, nothing starts before this

`ollama pull qwen2.5-coder:32b` is ~20 GB on this machine's disk (the registry's own seeded
default family; the settings UI hint says `ollama pull qwen2.5-coder`). Alternatives to put in
front of Richard rather than assume: a smaller pull (`qwen2.5-coder:14b`, ~9 GB — weaker but may
be the more honest "mid-tier" bar), a different machine, or a hosted open-weight endpoint
(OpenRouter/vLLM via `openai-compatible` — no disk, but "open-weight" then means the weights are
open, not that it ran locally; fine for the architecture question, say so in the matrix). **Ask;
record the choice here.**

#### ✅ DECIDED 2026-08-08 — Richard: hosted 32B on **DeepInfra**

The local pull was ruled out on measured hardware, not preference. Richard's machine is a
**MacBook Air (MacBookAir10,1), M1, 16 GB unified memory**, `iogpu.wired_limit_mb: 0` (default →
Metal working set caps at ~10.7 GB), 91 GB disk free, ollama 0.13.5 with only `llama3.2:latest`.

- `qwen2.5-coder:32b` ≈ 20 GB at Q4 — above *total* RAM and roughly double the GPU ceiling. Ollama
  cannot fully offload it; the fallback is CPU inference with swap, on a fanless chassis. Disk was
  never the constraint; RAM is. **Not pulled.**
- `qwen2.5-coder:14b` ≈ 9 GB — fits under the ceiling with ~1.6 GB headroom, which the MCP tool
  schemas plus KV cache consume. Runs, but a 40-turn replay is an hours-long throttled run.
- **Chosen: hosted `qwen2.5-coder-32b`-class via DeepInfra**, through the existing
  `openai-compatible` provider path. Richard supplies the API key when the task runs — **do not
  ask for it before then, and never commit it**; read it from the environment.

The matrix row must be labelled **"open weights, hosted (DeepInfra)"** — the weights are open, the
run was not local. That distinction is the phase's own honesty rule, not a footnote.

### 2. The driver — MCP surface, not the editor loop

~200 lines, modelled on the rig that already worked: ollama `/api/chat` (native tool-calling)
bridged to a `noodl-mcp` stdio server child process — tools advertised from the server's real
schemas, tool_calls executed against it, results fed back, transcript to JSONL, `--max-turns`.
Same fresh-project protocol as STOREFRONT-BRIEF.md (`create_project` first, brief verbatim, no
rescues). Two contract notes from source, so the driver is written right the first time:

- `providers/ollama.ts` emits tool calls complete in one frame (no partials) — irrelevant to MCP
  but confirms the models' tool-call format is well-formed JSON by the time it surfaces.
- The MCP server's backend dies with the server process — the driver owns the server child for
  the whole session (persistent), or the run must not provision a backend.

Prefer this over repairing `aix15-live`: it tests the **same surface as the haiku/sonnet
replays** (comparability is the point of the matrix). The repair remains the fallback if native
tool-calling on the chosen model proves too unreliable to even stage a component — if that
happens, that finding IS a result (capability-class), record it, and run the editor-loop
harness instead so the matrix still gets its row.

Park the driver in `scripts/devtools/` beside the measurement tooling — it is repo
infrastructure now, not scratch.

### 3. The run

Replay STOREFRONT-BRIEF.md cold. One run, no rescues, stalls are data. Score with the standard
fixture table + `render_report` (LAS-005) + `validate:project`, and classify every failure
(knowledge / ordering / capability / seam) with transcript citations, exactly as
AUDIT-SESSION-1 did for haiku.

## Acceptance

- An open-weight row in the scoring table with the same columns as haiku/sonnet (components,
  page node count, connections, For Each/Static Data, Columns, warnings, render report, cost,
  turns).
- The driver committed, documented in STOREFRONT-BRIEF.md's protocol section as the third rig.
- The model/hardware decision recorded here with Richard's sign-off.

## Register

| # | Finding | State |
|---|---|---|
| — | | |
