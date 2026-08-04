# Phase 40 — AI Authoring Quality (Track Q)

**Created:** 2026-08-04
**Origin:** not the roadmap. Richard built a second real app end to end — a puppy-adoption site with a
listing page and an unlisted admin page, deliberately full-stack — through the launcher's AI wizard and
the Build panel. Twelve findings came out of one session, on top of the four seams the diagnosis
session had already closed. His verdict on the output:

> *"basic shit creations that nobody will believe was worth switching from Claude Code"*

And the bar this phase exists to reach:

> *"legendary creations rivaling the best Opus landing page artifacts"*

## What this phase is

Phase 38 proved the parts work in sequence. This phase is about the two things that decide whether
anyone *wants* the result: **the app the AI builds actually runs as an app** (pages are reachable, the
backend it provisioned is usable, the page scrolls), and **the thing on screen looks like a designer
made it** (bespoke identity, deep styling, component architecture). The first half is seam work in the
phase-38 tradition. The second half is new: it needs a real agent engine, because the quality gap is
not a prompt-wording problem — it is a one-shot-pipeline problem.

## The findings, and what each one actually is

Mechanisms verified against source in the opening session (file:line cited in each task). Where a
mechanism is still a hypothesis, the task says so.

| # | Richard's report | Mechanism | Task |
|---|---|---|---|
| 2 | *"long form answer… reduces to a one sentence version"* | `ScopingSession.run()` keeps only `lastProse` — the final model turn. The long turn-1 prose streams live, the model calls `record_scope`, is told *"Now answer the user in prose"*, and its short turn-2 reply is the only thing entered into the transcript. Discarded, not summarized. `ScopingSession.ts:184-216`. | [AAQ-004](AAQ-004-THE-CONVERSATION-IS-KEPT.md) |
| 4 | *"'built in backend'… only edit or disconnect… disconnect just disappeared"* | One backend, two identities. Provisioning binds via `setCloudServices` → the panel shows the **endpoint** entry ("Built-in backend"), and `dataBrowserAvailability` refuses schema/data for any `kind !== 'managed'` (`backendList.ts:270`) — even though this endpoint IS a managed local process. Disconnect removes the pointer; the process and its data live on, unlisted from the user's point of view. | [AAQ-002](AAQ-002-THE-BACKEND-IS-FIRST-CLASS.md) |
| 5 | *"page router has no pages even after I accepted all the plan"* | **Zero mentions of the Router anywhere in the AI stack** — not scoping, not `planning.ts`, not `authoring.ts`. A page exists only by being listed in a Page Router node's `pages` parameter (`router.tsx:187`), and the model has never been told that contract. | [AAQ-001](AAQ-001-A-CREATED-PAGE-IS-REACHABLE.md) |
| 6 | *"'navigate to path' /puppies but there is no such page"* | Same mechanism as #5 seen from the navigation side: the model invents URL paths because it doesn't know registration exists. Nothing validates that a navigate target resolves. | [AAQ-001](AAQ-001-A-CREATED-PAGE-IS-REACHABLE.md) |
| 7 | *"'prop-age' 'prop-bio' with errors, saying those ports don't exist"* | `prop-<field>` ports are generated from the backend's **introspected schema cache** (`record-ports.ts:161-183`). Provision creates the collections (`provisionBackend.ts:164-179`) but nothing populates the cache the ports read, so the agent's parameters land before the ports exist. *(Exact introspection trigger: hypothesis, verify live.)* | [AAQ-002](AAQ-002-THE-BACKEND-IS-FIRST-CLASS.md) |
| 8 | *"any page created by AI isn't scrollable"* | `bodyScroll` is a project setting, **default off** — the app root is `position: fixed` / `overflow: clip` (`viewer.jsx:183-187`, `static/viewer/index.html:55`). Nothing in the AI path sets it or scroll-enables a page root. Every AI page is born clipped. Not a preview bug: a doctrine nobody wrote down. | [AAQ-003](AAQ-003-AUTHORED-APPS-SCROLL.md) |
| 9 | *"styled, but it's basic AF"* | Two mechanisms. **(a)** Five style presets exist with a working launcher → `applyPreset` seam (`StylePresetsModel.ts`) and the AI creation path never touches it — every AI project is Modern blue `#3b82f6`. **(b)** The authoring prompt teaches tokens and nothing else: no states, no State nodes, no hover/disabled, no custom CSS surface. | [AAQ-009](AAQ-009-A-BESPOKE-VISUAL-IDENTITY.md), [AAQ-010](AAQ-010-THE-WHOLE-STYLING-SURFACE.md) |
| 10 | *"dragged element is a dark background pill with a dark font"* in light mode | Unverified — editor chrome CSS. Filed. | [AAQ-011](AAQ-011-FOUND-ALONG-THE-WAY.md) |
| 11 | *"'Enquiry form' group could have easily been a component"* | The planning prompt argues **against** decomposition (`planning.ts:79` — *"Two or three precise operations beat six vague ones"*) and no prompt anywhere says repeated or reusable UI earns a component. The model did what we told it. | [AAQ-008](AAQ-008-COMPONENTS-BY-DEFAULT.md) |
| 12 | *"CSS … label clipped… editor opens downwards and overflows"* | Unverified — property-panel layout. Filed. | [AAQ-011](AAQ-011-FOUND-ALONG-THE-WAY.md) |
| 1, 3 | one-shot output, no way to reopen/iterate a build conversation | `lib21-qa/.nodegx/` is empty; nothing persists in-editor build conversations. And the whole pipeline is one-directional: plan → author → apply, with no ability for the agent to look at its render and improve it. | [AAQ-004](AAQ-004-THE-CONVERSATION-IS-KEPT.md), [AAQ-006](AAQ-006-THE-AGENT-HARNESS.md), [AAQ-007](AAQ-007-THE-AGENT-SEES-ITS-WORK.md) |

## Already done (the diagnosis session, 2026-08-04)

Four seams closed, uncommitted at phase-open, committed with this phase's docs. See
[HANDOVER.md](HANDOVER.md) for the full account:

1. `variant` is connection-only → `DiagnosticCode.ConnectionOnlyParameter`, error.
2. `width: 260` renders at 260% → `unitSuffixTrap` (error) + `UnitlessDimension` (blocking warning).
3. `var(--token)` didn't resolve over the preview web server → tokens injected in `web-server.js`.
4. Warnings never blocked the gate → `BLOCKING_WARNINGS` for authored output only.

Calibration held: 3,589 corpus values in object form, zero bare numbers on `%`-defaulting ports,
zero false positives (`parameterValuesCorpus.test.ts`). Replayed on Richard's page: 31 findings where
the validator previously reported clean.

## The design position

### The seams lie before the model fails

Both end-to-end sessions produced the same lesson: the model's output was better than what rendered.
When something looks wrong, the first question is *"did this reach the runtime?"* — never *"why is
the model bad at this?"* Every Layer-1 task in this phase is that question asked about a different
seam.

### One substrate, two clients

The editor's authoring loop speaks a one-component dialect (`submit_component`); `noodl-mcp` already
has the multi-component substrate the editor lacks (SUB-008). Growing a second multi-component
dialect inside the editor would be the BCN-003 mistake again — three twins of one semantics. So the
engine work converges on **one tool contract** that both the embedded agent and external Claude Code
speak. The tools are the contract; the harness is swappable.

### The harness is Strands; the frontier model is still Claude

Richard's directive: *"Let's not cut corners… Can we integrate Strands SDK or the open source Claude
agent thing?"* Evaluated in [AAQ-006](AAQ-006-THE-AGENT-HARNESS.md):

- **Strands Agents TypeScript SDK** (v1.0 April 2026, Apache-2.0): provider-agnostic (Anthropic,
  Bedrock, OpenAI, Gemini, custom providers), runs in Node and the browser, Zod-typed tools, hooks,
  conversation management, multi-agent. Embeds in the editor without a sidecar and preserves the
  AIX-001 registry design (capabilities, not model ids). **Chosen.**
- **Claude Agent SDK**: Claude Code as a library — the best harness there is, but Anthropic-only, and
  its built-in toolset (Read/Write/Edit/Bash/Grep) is filesystem-oriented; authoring a Noodl project
  wants none of it. It remains the **external** client story: Claude Code driving `noodl-mcp`, which
  this phase makes first-class by converging the substrate.

### Quality comes from iteration, not from a bigger prompt

A Claude artifact is good because the model renders, looks, and fixes. The embedded agent gets the
same loop: build → render in the sandbox → inspect (screenshot, console, layout metrics) → fix →
resubmit, under a budget. That is [AAQ-007](AAQ-007-THE-AGENT-SEES-ITS-WORK.md), and it is the single
biggest lever on the bar Richard set.

### Richard's three lessons are doctrine, verbatim

1. **Components by default.** Sections, forms, repeated blocks, and logic clusters are components.
   A Repeater over a data source beats hand-duplicated siblings. Clean canvases are a product goal.
2. **Use the whole styling surface.** Props first — corner rounding, transparency, visual states,
   State nodes for interaction styling — and custom CSS when necessary or justified, not before.
3. **No two projects should look alike.** Fully bespoke tokens per project (Richard's explicit
   choice over preset-picking), designed in the scoping conversation, guarded by a contrast lint —
   a lint, not a preset floor.

## Layer 1 is built (2026-08-04, commits `4a0fdd4f`, `83647de9`)

All four seam tasks landed in one session, with the editor suite at **2165 specs, 0 failures** and both
typecheck gates clean. Each task file carries what was built and the decisions taken; three things belong
here because they change what a later reader should believe:

1. **AAQ-002's stated mechanism was wrong, in a way that matters.** `prop-*` ports were filed as a
   *timing* problem. They are not: `SchemaHandler._fetch()` has been a stub since WF-007, clearing the
   only cache those ports read on every window focus. There was no trigger to be late. Fixed by
   introspecting the built-in backend over the IPC the Data Browser already uses.
2. **`RouterNavigate.target` and `Page.urlPath` are not in the node catalog** — both are
   runtime-discovered ports. That is very likely *why* the model reached for "navigate to path": it is
   the only navigation target the catalog declares statically. It also means nothing could have caught a
   wrong target, because `checkParameterValues` skips dynamic-port nodes entirely.
3. **`buildBackendList` has no production caller.** The Backend Services panel composes three separate
   card components. A model-level seam being right is not the same as the panel being right.

Outstanding from Layer 1, all of it live-QA or explicitly deferred: AAQ-001 criterion 5 (the router's
`pages`, written by the apply, seen rendering in a real preview), AAQ-002 criteria 1–3 and slice 4 (the
agent is still not told the collections), AAQ-003 criteria 1–2 (scrolls in a detached preview and on a
phone; a dashboard brief's regions scroll independently), AAQ-004 mechanism B (with AAQ-006).

## Order of work

**First, the seams — AAQ-001 through AAQ-004.** Small, mechanism-verified, and nothing above them
matters while the app is broken. These are parallelizable.

**Then the engine — AAQ-005 (substrate) then AAQ-006 (harness), then AAQ-007 (self-review).**
AAQ-005 is the risk-bearing task; AAQ-006 depends on it; AAQ-007 depends on AAQ-006.

**Then the doctrine on top of the engine — AAQ-008, AAQ-009, AAQ-010.** Prompt-encodable parts can
land earlier (they are text), but their acceptance runs against the new engine.

**AAQ-011** is a register, worked opportunistically.

## Exit criteria

Three briefs, each run **cold** through the Build panel with no coaching, each judged side-by-side
against what a Claude artifact produces for the same brief. Richard judges; "passes validation" is
explicitly not the bar.

1. **Puppy adoption, full stack** — the original brief: listing page, unlisted admin page, backend.
   Exercises every layer. The known-bad baseline exists.
2. **Pure landing page** — no backend: hero, sections, CTA. The cleanest head-to-head on visual
   quality alone.
3. **Dashboard / admin app** — data-dense: tables/lists over live data, filters, repeaters. The
   hardest test of components-by-default.

For each: the app opens on a real page (router populated), every navigation lands, the page scrolls,
the backend the scope described is usable from Backend Services *and* from the graph's data nodes,
the project has its own visual identity (provably different tokens across the three briefs), and the
graph is factored into components a person would be happy to maintain. Rendered in a real preview
window, both themes.

A fourth, standing criterion: **the same three briefs driven through `noodl-mcp` by Claude Code**
produce comparable quality — that is the proof the substrate, not the harness, carries the lessons.

## A note on evidence

Every mechanism marked verified was read in source or replayed against Richard's actual project
during the sessions that opened this phase. The two editor-chrome findings (10, 12) are filed from
symptoms and say so. AAQ-002's introspection-timing mechanism is a hypothesis until driven live.
The phase-38 rule stands: *read the mechanism before trusting a task's stated facts, including this
README's.*
