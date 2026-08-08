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

#### ⚠️ SUPERSEDED 2026-08-08 (session 6) — the chosen model cannot run this, twice over

The decision above survived contact with the hardware and died on the endpoint. Both halves were
measured before a penny was spent, against DeepInfra's live catalog (`GET
https://api.deepinfra.com/models/list`, public, no key) and the server's own advertised surface:

- **`Qwen/Qwen2.5-Coder-32B-Instruct` is not tool-capable on DeepInfra.** It is still served, but
  its tags are `openai,completion` — no `tools` tag. `Qwen2.5-Coder-7B` is the same. A rig built on
  `tool_calls` has nothing to call. **F36.**
- **Its 32,768-token window is smaller than the tool list.** Write-mode `noodl-mcp` advertises
  **89 tools**; as OpenAI function schemas that is **98,676 characters ≈ 25–33k tokens**, sent on
  every single turn. The brief never arrives. **F37**, and F37 is not a DeepInfra fact — it is a
  fact about our own surface, and it applies to every 32k-context client anyone will ever point at
  this server.

**Richard's replacement choice, 2026-08-08: `Qwen/Qwen3.5-27B`** — dense 27B (the same size band as
the retired 2.5-Coder-32B, which is why it was chosen over the cheaper or stronger alternatives),
262,144-token context, $0.26/M in and $2.60/M out, tool-capable, not deprecated. The alternatives
put in front of him and declined were `openai/gpt-oss-20b` (hardest bar, ~$0.10/run),
`Qwen/Qwen3-Next-80B-A3B-Instruct` (~$0.40/run) and `Qwen/Qwen3-Coder-480B-A35B-Instruct-Turbo`
(open-weight *flagship*, not mid-tier — would have flattered the row). Richard also approved all
three replays, ~$9 total.

The matrix row label is unchanged: **"open weights, hosted (DeepInfra)"**.

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

#### ✅ BUILT 2026-08-08 — `scripts/devtools/mcp-model-driver.js`

Written against the OpenAI-compatible `/chat/completions` shape rather than ollama's native
`/api/chat`, which costs nothing (ollama serves the same shape at `/v1`) and buys the DeepInfra leg
for free — one code path drives a local pull and a hosted gateway. Plain CJS, no dependency: the
MCP client is ~90 lines of newline-delimited JSON-RPC over a `noodl-mcp` stdio child, so a
`lerna clean` cannot take the rig away, same reasoning as `render-report.js`.

Three contract details that came out of building it, none of them in the task above:

- **The server's `instructions` are passed through as the system prompt.** An MCP client is
  supposed to surface them and the `claude` CLI does, so the baselines had them. Omitting them
  would have handicapped the open-weight run and made the row incomparable — the opposite of the
  matrix's purpose.
- **Image content blocks are dropped and replaced with a one-line note.** `render_report` returns
  full-page screenshots as base64; a non-multimodal model would receive megabytes it cannot see.
  The note matters as much as the drop: without it the transcript would read as "the tool returned
  nothing" and the failure would be misclassified — the exact error LAS-011 step 3 exists to stop.
- **The driver owns the server child for the whole session**, per §2 above, so a provisioned
  backend outlives the turn that created it.

Also `--list-tools`, which is how F37 was measured, and `--tools a,b,...` to advertise a subset —
present for the *diagnosis* of F37, deliberately not used for the acceptance run, because narrowing
the surface is an operator intervention the baselines did not get.

**Verified before it was trusted:** driven end-to-end against local ollama
(`llama3.2:latest`, free) at `--base-url http://localhost:11434/v1` — the model called
`get_project_info`, the real result came back through the bridge, and it answered from it
(`turns=2 toolCalls=1 tokens=1891in/42out durS=18`).

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
| F36 | **The model this task settled on cannot call tools at the endpoint it settled on.** `Qwen/Qwen2.5-Coder-32B-Instruct` on DeepInfra is tagged `openai,completion` with **no `tools` tag** (nor has `Qwen2.5-Coder-7B`); the whole `qwen2.5-coder` family has been superseded there. Measured against the public catalog before any spend | ✅ **CLOSED** 2026-08-08 — Richard re-chose `Qwen/Qwen3.5-27B` (same size band, tool-capable, 262k ctx) |
| F37 | **Our own write-mode MCP surface does not fit in a 32k-context client.** 89 tools → **98,676 chars ≈ 25–33k tokens** of function schemas resent every turn, before the system instructions (2,112 chars) and before the brief. **60 of the 89 tools and 63% of the schema bytes are backend admin** a storefront brief never touches. There is no progressive disclosure on the server — and the two baselines did not face this, because the `claude` CLI defers tools behind `ToolSearch` (haiku's transcript opens with **11** `ToolSearch` calls). So "the same surface" is not the same surface, and any small-context MCP client is locked out today | 🔴 **OPEN** — measured, not fixed; candidate LAS-012 |
