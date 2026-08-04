# AAQ-006 — The agent harness

**Origin:** Richard's directive, verbatim: *"We're trying to convince people who use Claude Code to
use our AI builder instead… Can we integrate Strands SDK or the open source Claude agent thing?
Let's not cut corners here please, doesn't matter if we need another phase of tasks to get it done."*
**Depends on:** AAQ-005 (the substrate is the tool contract this harness binds)
**Status:** open

## The evaluation (recorded so it isn't relitigated)

| | Strands Agents TS SDK | Claude Agent SDK | Keep in-house loop |
|---|---|---|---|
| Language / embedding | TypeScript, Node **and** browser — embeds in the editor directly | TS, but it is Claude Code's engine as a library; subprocess-shaped | already embedded |
| Provider coupling | **Agnostic** — Anthropic, Bedrock, OpenAI, Gemini, custom providers | Anthropic only | agnostic (AIX-001 registry) |
| Tools | Zod-typed custom tools + MCP; hooks; conversation mgmt; multi-agent | Built-in Read/Write/Edit/Bash/Grep + MCP + subagents | our own, one-shot shaped |
| Fit | Our substrate becomes its toolset; harness does loop/iteration/history | Filesystem toolset is dead weight here; the loop is superb but closed | the constraint we're escaping |
| License / maturity | Apache-2.0, TS v1.0 Apr 2026, v1.4 Jun 2026 (unified harness-sdk monorepo) | Anthropic product docs | n/a |

**Decision: Strands Agents TypeScript SDK for the embedded builder.** The Claude Agent SDK remains
the *external* client story — Claude Code driving `noodl-mcp` — which AAQ-005 makes first-class.
The frontier default stays Claude through the user's key; the harness stops being what enforces it.
This preserves the AIX-001 position (registry capabilities, not model ids) instead of abandoning it.

Sources: [strandsagents.com](https://strandsagents.com/) ·
[TS 1.0 announcement](https://strandsagents.com/blog/strands-agents-typescript-v1/) ·
[harness-sdk repo](https://github.com/strands-agents/harness-sdk) ·
[npm @strands-agents/sdk](https://www.npmjs.com/package/@strands-agents/sdk)

**Open sub-decision (resolve in slice 0):** whether our existing provider-agnostic AI client wraps
into a Strands custom model provider (keeping AiConfigStore, keys UI, cost accounting as-is), or
Strands' own providers replace it per-vendor. Default position: wrap ours — one place computes cost
and reads keys today, and the launcher settings UI already edits it.

## What the harness replaces

`PlanningSession` → `PlanRun` → per-op `AuthoringSession` (strict serial, one component per session,
two passes, no memory between ops) becomes **one agent session per build**:

- The agent plans, then builds components through the substrate in whatever order dependencies
  demand — a page and its section components authored with shared context, siblings visible.
- Refinement is a turn, not a new pipeline run.
- The plan survives as a *user-facing checkpoint*, not as the execution model: the agent proposes
  the component/backend/token plan, the user approves scope, the agent executes. Plan review,
  per-component diff review, Apply/Discard vocabulary (AIB-004), cost display (AIB-002), and the
  all-or-nothing apply all stay — they attach to the changeset, which the substrate still owns.

## Slices

0. **Spike** (timeboxed): Strands agent in the editor's dev build, bound to three substrate read
   tools + `create_component`, driving one real component birth end to end. Resolves the
   model-provider sub-decision and any Electron/webpack packaging surprises (externals hoisting is a
   known trap — `opennoodl-packaging-traps`). Output: a go/no-go note in this file.
1. **The build session**: agent session wired to the full substrate; Build panel streams its
   progress (per-tool-call events → the AIB-002 legibility UI); staging/review unchanged.
2. **Persistence**: sessions serialize to `.nodegx/` per AAQ-004's UX contract — list, reopen,
   continue. A restart is a stop.
3. **Retire the old orchestration**: `PlanRun`'s serial executor goes; the scripted no-provider
   drivers are ported so live QA never regresses to hand-testing.
4. **Budgets and stops**: per-build token/cost budget surfaced in the panel (cost was computed and
   never rendered once before — AIB-002); a stall deadline that distinguishes stall from user stop
   (the F11 lesson); Stop is graceful and keeps staged work.

## Acceptance criteria

1. The puppy brief runs as **one** agent session producing a multi-component changeset; per-component
   review works as today; apply is atomic.
2. Kill the editor mid-build; reopen: the session is listed, its staged output intact, continuation
   works (AIB-003/slice-4 behaviour, now on the new engine).
3. Provider swap: the same build runs against a second configured provider with no code path
   change — proving the wrap decision, whatever it was.
4. Cost and per-step progress render live during the build; a deliberate mid-build stop keeps
   everything staged.
5. The packaged build (not just dev) runs a session — a green dev build proves nothing about
   packaging.

## Traps

- Never `Date.now()`-style nondeterminism in anything replayed for resume.
- The editor is a queue, not a resource to seize — coordinate live QA with Richard's running editor.
- Webpack `DefinePlugin` folding and externals hoisting have silently broken packaged deps before;
  the spike exists to hit this early.
- Strands hooks/telemetry must feed the phase-36 observability substrate, not a parallel log.
