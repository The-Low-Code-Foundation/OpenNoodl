# SUB-010 Assessment — external authoring demo, run 2026-07-23

**The question:** is "an agent you already have builds a page in a Noodl project
over MCP, you watch it live, then continue by hand in the visual editor" a real
experience or wishful thinking?

**The answer: it is real.** The whole loop ran end to end against a real
production app, and the differentiating beat — the agent's output opening as a
plain editable node graph — held. Two genuine defects were flushed out along the
way (one fixed same-day, one now known and characterized), which is exactly what
the spike was for.

**Recommendation: GO** on the SUB-008 tool-surface hardening and AIX-002, with
the caveats in "Frictions" below routed into their designs.

---

## What was run

| Piece | Instance |
|---|---|
| Project | **"Shine Phase 2"** (`tests/testfs/git-repo-utf8`) — real production app: 44 components, 688 nodes, 525 connections; articles, auth, comments, popups, Contentful GraphQL. Exported to v2 with the pure `ProjectExporter`; git-baselined. |
| Agent | **Headless Claude Code 2.1.217** (`claude -p`, claude-fable-5) in an empty cwd, **all filesystem tools disallowed**, only the `nodegx` MCP server (SUB-008 build, `--allow-writes`). Genuinely external: no repo access, no project-file access. |
| View | SUB-009 preview (`npm run preview`) watching the project on :8575; headless-Chrome screenshots on every disk change. |
| Hand-off | The NodeGX editor (dev stack) opening the same directory; manual edits via the editor's own model APIs; fidelity via `git diff`. |

The ask (verbatim in [SETUP.md](./SETUP.md)): the app 404s at the root URL —
add a Home page following the app's conventions, with a welcome heading, a
description, a button to the Profile page, and make it the router's start page.

## What happened

1. **Orientation → authoring in 15 turns / 102 s / $1.98.** The agent explained
   `App` and `Pages/Profile`, read three convention-bearing components, pulled
   catalog entries, then issued exactly two writes: `create_component
   Pages/Home` (8 nodes) and `update_component App` (router routes +
   startPage). **Both accepted on the first attempt, zero new diagnostics.**
   Full verbatim report: [agent-final-report.md](./agent-final-report.md).
2. **The preview told the story in real time.** Writes landed at 23:14:41 and
   23:14:48; the preview rebuilt in 247 ms and 200 ms; the watcher's screenshots
   bracket the moment: still-404 with `Pages/Home` already on disk
   ([shot 02](./shots/02-home-created-router-unchanged.png)), then the Home page
   live ([shot 03](./shots/03-home-live.png)).
3. **The hand-off held.** The editor opened the same directory; the agent's page
   sat in the component tree as an ordinary graph
   ([shot 05](./shots/05-agent-page-as-editable-graph.png)) with readable node
   names (`welcome-heading`, `Home Content`). Two manual text edits were made
   through the editor's model layer and saved; the standalone preview picked
   both up ([shot 06](./shots/06-preview-after-manual-edit.png)); the project
   still validates 0 errors / 13 pre-existing warnings — via the same MCP
   server the agent used.

## The context-budget headline

The premise under test is that decomposition lets an agent work **without
ingesting the project**. Enforced and logged ([context-log.jsonl](./context-log.jsonl),
extracted from the agent's session transcript):

- **14 tool calls, 63,346 bytes of tool results total** (≈16k tokens) — against
  a project whose components directory is ~1.1 MB on disk.
- It read **6 of 44 components** (1 full page, 2 explains, 3 targeted reads)
  plus project info, the registry listing, and 7 catalog entries.
- The whole-project dump never happened because no tool offers it.
- Bonus sandbox evidence: when a tool result pointed at an overflow file, the
  agent tried to load `Read`/`Bash` — and was refused (call 8 in the log). The
  boundary held under actual pressure.

## Finding 1 (fixed): v2's optional `parameters` crashed the editor's open path

The single biggest catch. `Pages/Home` legitimately omitted `parameters` on two
component-instance nodes (v2 makes it optional; the MCP server writes it
sparsely). Legacy graphs carry it on **every** node (688/688 in this corpus),
and `applyPatches` dereferences `node.parameters` before `NodeGraphNode`'s own
defaulting runs — so the editor's v2 load threw, fell back to a legacy read,
found no `project.json` in a pure-v2 directory, and surfaced **"Could not load
project"**. Every MCP-authored component was un-openable.

Fixed at the reconstruction boundary — `ProjectImporter.unflattenNodes` now
restores the invariant (`parameters ?? {}`), regression-tested; the exporter
already omits empty `parameters` on write, so the round-trip stays byte-stable.
Without this spike, the first external user would have hit it as their first
impression.

## Finding 2 (characterized): first editor save is a 93-file normalization

After one text edit, the editor's first save rewrote **93 files** — because the
corpus project was format-version 3 and the editor upgraded it to 4 on open,
and because the editor's save path emits enrichments the pure exporter doesn't
(`visualRoots`, materialized dynamic ports, merge metadata). Semantically the
agent's work survived intact (router config, graph, parameters all verified),
and the **second** edit saved surgically — `Pages/Home` plus registry only.

Verdict: **lossless, but noisy once.** For the git-mediated collaboration
Phase 13 is building toward, that first-open normalization should be an
explicit, named event (an "upgrade/normalize" commit), not a surprise inside
someone's feature diff. Routed to SUB-008/SUB-002: either the exporter and MCP
writes adopt the editor-normalized shape, or first-open normalization becomes a
visible step.

## Smaller frictions (routed to SUB-008 / SUB-009 / editor)

1. **`get_node_type` with 7 types returned ~126 KB** and blew the MCP host's
   tool-result limit; the overflow "saved to file" hint was useless to a
   filesystem-less agent. It recovered by learning ports from real components —
   arguably better practice — but the tool needs a compact mode or a size cap.
   *(SUB-008, highest-value tweak.)*
2. **v2 opening is feature-flagged off by default** (`nodegx.formatV2`); the
   hand-off silently fails without it. Fine mid-rollout, but the flag's default
   decides when this demo is real for users. *(Editor rollout.)*
3. **Editor viewer vs deploy runtime render variants differently** — the
   agent's "Button Primary" button is cyan in the editor preview, purple in the
   deploy-path preview. Pre-existing renderer discrepancy, not agent-caused;
   worth a look. *(Editor/runtime.)*
4. Harness nits, documented in SETUP.md: Chrome headless needs `--timeout` to
   screenshot an SSE-holding page; the cdp tool loses the editor target once
   the SPA pushStates away from `index.html`.

## Is it worth wanting?

An honest yes, with a shape worth naming. The agent didn't just emit valid
JSON — it **reverse-engineered the app's conventions from five reads** (shared
header component, container idiom, button variant, font/color language) and
produced a page a designer would recognize as native, in the app's own visual
vocabulary. Watching the 404 flip to a styled Home page ~10 seconds after the
ask, then opening that page as an ordinary graph and editing it — with every
edit flowing back to the same preview — feels like one artifact with two
editing surfaces, which is precisely the pitch. No code-generating competitor
has the second surface; that remains the defensible difference.

What it is *not* yet: packaged. This run needed repo-built binaries, a manual
v2 export, a feature flag, and a hand-rolled agent config. The gap between
"provable" (this demo) and "usable by a stranger" is SUB-008's distribution
work plus the flag flip — mechanical, not conceptual.

**Go.** The two-month SUB-008 + AIX-002 spend is buying polish on a loop that
already works, not a bet on whether it can.

---

*Reproduction: [SETUP.md](./SETUP.md). Evidence: [shots/](./shots),
[context-log.jsonl](./context-log.jsonl), [agent-final-report.md](./agent-final-report.md).
Not done: a narrated video recording — the run is scripted and repeatable from
SETUP.md whenever a human-recorded take is wanted (the interactive
`claude mcp add` route works for a live Claude Code session, and the same
config works in Claude Desktop).*
