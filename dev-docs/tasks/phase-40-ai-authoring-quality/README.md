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
*(All of the AAQ-002 items above were closed on 2026-08-05 — see the section at the end.)*

## The Layer-1 live pass (2026-08-05)

Layer 1 was mechanism-verified, spec-covered, and had never been seen running. It has now been driven end
to end through the launcher wizard — scoping conversation, project creation, plan, authoring fan-out,
apply, preview — by `packages/noodl-editor/scripts/aaq40-live/`, which replays a recorded conversation
into `AiClient.chatStream` and needs no provider. That is not a weaker test than a cold model run for
what Layer 1 does: registration, the scroll setting and the schema cache are all performed by the apply
transaction, **downstream of the provider boundary**. What it does not test is authoring quality, which is
the engine tasks' business.

**It found three defects that 2165 green specs could not see.** All three are fixed:

1. A plan whose first page linked to its second was **unappliable** — `plannedComponents` reached every
   authoring session and not the apply's pre-check, whose component list grows forward. One fact, two
   places, present in one. Now one shared function.
2. The start page never moved, so every wizard-built app **opened on "Hello World!"**. The placeholder
   test asserted the template's Home has no children; it has a `Text` child. The one case the mechanism
   existed for could never match.
3. A registered page still **rendered a blank screen**. The runtime's page index is built exclusively
   from `Page` nodes, and nothing in the AI stack said a page component needs one. New diagnostic, new
   prompt contract — the diagnostic is a warning rather than blocking, and AAQ-011 F7 carries the bill.

Afterwards, against a real preview window: the router lists the pages, the app opens on the built page,
both navigations resolve, and the listing page scrolls (1832px of content in a 343px viewport, with the
scrollbar in the screenshot). AAQ-004 mechanism A was confirmed the same run, unplanned — both prose
rounds of the scoping turn stand in the bubble.

**Two Layer-1 criteria still fail, and their cause is new.** `prop-*` ports do not exist, because
provisioning binds every project on a machine to the *same* backend (name-matched, and the name is always
"App backend") and `createTable` never reconciles an existing table's columns. That is finding #7's third
distinct mechanism — after "timing" (wrong) and "the cache was never written" (right, and fixed). Both
halves are product decisions, filed as AAQ-011 F4/F5 rather than patched.

## AAQ-002 closed out (2026-08-05, commits `36ce5669`, `437ec919`)

Richard took F4 and F5: **a project gets its own backend**, and **provisioning may fully reconcile an
existing collection, type changes included**. Both are built, with the editor suite at **2198 specs, 0
failures** and the runtime suite green. Slice 4 landed with them — the authoring context now carries the
collections and their fields, from the plan's provision *and* the project's cached schema, because at
authoring time a wizard-built project has neither a backend nor any other description of what it will
have.

Three things belong here rather than only in the task file:

1. **A type change existed nowhere in the stack.** The backend's admin surface had four schema actions and
   SQLite has no `ALTER COLUMN`, so "full reconcile" meant building a fifth —
   `SchemaManager.changeColumnType`, through byob-admin and the editor's IPC. It is lossy by SQLite's CAST
   rules and says so, in a spec and to the user. F4 is what makes that acceptable: the collection being
   reconciled now always belongs to the project doing the reconciling.
2. **`config.projectIds` had been dead since the backend manager was written**, with three modules
   carrying a comment saying so. It is now the ownership key, which is why the fix needed no new field.
3. **⚠️ A seventh premise failed the read** (AAQ-011 F8): the project review told the model the
   built-in backend's collections were "unknown, not absent", on the ground that the editor has no schema
   introspection for a `cloudservices` endpoint. That was true when AIX-010 wrote it and stopped being
   true in **this phase's own Layer 1**. ✅ Closed `61579634` — `collectBackendSummary` reads the
   `dbCollections` cache Layer 1 restored. Outcome 3 narrowed rather than being replaced: an empty cache
   is still "we could not look", because that is what a stopped backend leaves behind.

**Criteria 1–3 are still undriven.** Every previous answer to criterion 5 also looked right on paper.

**And one thing that turned out not to be true:** this said authoring a 55-node component cost **6m51s of
editor main-thread time with a zero-latency provider** (AAQ-011 F6), and that the engine work should fix
it first. ✅ **Measured and closed 2026-08-06.** The number was wall clock, not main-thread time, and the
wall clock belonged to the *fixture provider's* `setTimeout` pacing in an occluded window — 11ms on
screen, ~1000ms hidden, measured in this Electron build. The editor's own cost is 5.7ms for 400 nodes
streamed as 4000 partial payloads (`packages/noodl-editor/scripts/aaq011-perf`), and it does not grow
with fragment count. Nothing here gates AAQ-007.

## AAQ-002 driven and closed — and finding #7 had a FOURTH mechanism (2026-08-05)

Criteria 1, 2 and 3 have now been driven live, with the project re-opened cold after a full editor
restart. All three pass, **Layer 1 is complete**, and the pass found the mechanism that had been
underneath the other three the whole time. Editor suite **2198 specs, 0 failures**; runtime **2144
passed**; both typechecks clean.

1. **`prop-*` had nothing to do with backends.** Driven with every earlier fix in place — own
   backend, `Puppy` created with its columns, the cache holding them, the Class dropdown listing it —
   there were still no `prop-*` ports. `addBaseInfo` defaulted its port flag with
   `opts === undefined || opts.includeInputProperties`, so the moment **ERG-001 §4 added a `done`
   sentence to the same options object** (`67d2c339`), the expression went falsy and **Create Record
   and Update Record stopped emitting property ports entirely — on every backend, in every project.**
   The three earlier mechanisms were all real and all needed fixing; none of them could ever have made
   the ports appear. ⚠️ **It presents exactly like a schema bug**, because the Class dropdown kept
   working: the node knew the collection existed and offered no way to write to it. The discriminating
   probe took one minute and should have been first — a Record node in the same project, on the same
   collection, gets its ports, because it gates on `selectedCollection` alone.
2. **Fixed by deletion, not by a corrected default.** The flags are derived from the mixins that build
   what they gate (`addInputProperties`, `addRelationProperty`), read at port-update time. A corrected
   default would have left the next option added to `addBaseInfo` armed with the same trap. This is
   the **one-fact-in-two-places** class the Layer-1 live pass named, and the phase has now paid for it
   twice.
3. **The gate had to move altitude.** Two existing suites cover the pure port generators, which were
   never broken, and both stayed green for a year. `record-property-ports.test.ts` drives the
   **assembled node modules** through `setup()` and asserts what reaches `sendDynamicPorts` — verified
   to fail 4/10 against the old behaviour before being kept.

Criterion 2 is now closed end to end: ports at first load, zero port warnings, and a record written
through the authored form in a real preview (`{name: "Biscuit", age: 4, …}`), visible in the Data
Browser, with `Done` firing the navigation. Criterion 1: one card, one ACTIVE badge, no endpoint
section, Schema and Data both opening on the provisioned collection. Criterion 3: the disconnect copy
states both facts, and afterwards the pointer is gone while the card and the process remain.

**Three defects filed rather than patched** (AAQ-011 F9–F11), and one of them is not small:
**every wizard-built app carries a permanent, false `⚠ 1`** — *"This Router has no Pages configured"* —
because `router.tsx` raises that diagnosis on a mount that precedes its `pages` parameter and **never
clears it**. The app renders correctly the whole time. F10 is the other one that matters: **nothing
starts a project's backend when the project is opened**, so a wizard-built app is dead the second day
until the user finds Backend Services.

## AAQ-005 slice 1 — one gate, and an eighth stale premise (2026-08-05)

Layer 1 was complete, so the engine began. Its first slice is the one thing AAQ-005 could deliver
without designing the multi-component contract first: **the authored-candidate gate, defined once and
bound three times**. Editor suite **2200 specs, 0 failures**; `noodl-mcp` **121 tests green** (it had
been red for 8 days); runtime **2144**; both typechecks clean.

The premise that failed is AAQ-005's own §5, and it failed in the direction that matters:

1. **`noodl-mcp` did not share the validation rules — it shared the semantic validator and nothing
   else.** The four precondition checks appeared nowhere in the package. So the gate was not lenient
   about those diagnostics; it never computed them. The `severity === 'error'` filter the task file
   blamed was correct and had nothing to filter. Consequence: about **fifteen error-severity parameter
   diagnostics**, `ConnectionOnlyParameter` among them — *this phase's own* diagnostic, for the
   mechanism that silently discarded a build's styling — rejected a submission in the editor and
   shipped clean through Claude Code.
2. **There were three gates, not two.** The MCP write tools and the MCP plan tools each had their own
   implementation, each with its own copy of `diagnosticKey`, one of them commented as deliberately
   kept identical to the editor's. BCN-003's three twins, already realised, inside the task written to
   prevent them.
3. **Binding it found a second defect in the editor.** The baseline exemption covered `severity ===
   'error'` only, so a **pre-existing blocking warning was always charged to the agent** — the exact
   treadmill the exemption exists to prevent, on the population the corpus is full of. Proven on
   `noodl-mcp`'s own fixture: adding one unrelated Text node to `/Pages/Home` was rejected for a dead
   `RouterNavigate` the agent had never touched.

Both new specs were verified to fail against the old behaviour (4 of 6 parity cases; the exemption
case), which is the only reason to believe them. The convergence deliberately stops short of project
normalization and the validator instance — the two clients differ there for good reasons, and changing
MCP's semantic results as a side effect of closing a gap in what it checks would be a regression bought
with a refactor.

## AAQ-005 slice 2 — the apply gap, and a ninth stale premise (2026-08-05)

Slice 1 made both clients judge a candidate identically. Slice 2 found they still did entirely different
things afterwards — and that the difference had quietly reintroduced two of the four findings Layer 1
exists to close. Editor suite **2200 specs, 0 failures**; `noodl-mcp` **136 tests / 14 suites** (was
121/12); runtime **2144**; both typechecks clean.

1. **Layer 1's project-level effects lived in the editor's apply path and nowhere else.** Page
   registration (AAQ-001), `bodyScroll` (AAQ-003) and backend provisioning (AAQ-002) were all absent
   from `noodl-mcp` — `provision` and `scroll` appeared nowhere in the package at all, while both
   packages import `validatePlan` from the *same* `authoring/plan` module, which has handled
   `provision` since AIB-007. One plan model, two plan vocabularies.
2. **⚠️ Slice 1 made the first one sharper, not safer, and this is the transferable lesson.**
   `checkNavigation` resolves a Navigate target against the project's **component names**, not against
   router registration — sound in the editor *only because* the editor's apply registers the page a
   moment later. Bound to a client that never registered anything, the shared gate certified as correct
   exactly the button that would not work. **Gate parity without apply parity is a gate that lies**:
   sharing a check moves its unstated preconditions into a client that may not meet them.
3. **The fix is one decision with two bindings.** Four functions moved from the editor's `staging.ts`
   into `pageRegistration.ts` over plain nodes; the editor feeds it `ProjectModel` nodes, `noodl-mcp`
   feeds it `ProjectStore` ones, and neither holds policy. Registration now fires on
   `create_component`, `update_component` and `apply_plan`, and is *reported* (`registeredPages`),
   because a tool that writes a component the caller did not name has to say so.
4. **Provisioning genuinely does not port** — it means starting and supervising a backend child
   process, which is the editor's manager over IPC. So `create_plan` accepts the kind (one vocabulary)
   and refuses it with the reason and somewhere to go (AAQ-011 F13). Honest beats silent.
5. **A ninth stale premise, and it is why nobody looked for a year.** `pageRegistration.ts`'s own header
   said *"`noodl-mcp` has no plan transaction at all"*. It has had one since AIX-011 — built on this
   package's own plan module. What it lacked was not a transaction but the registration.

Two traps caught before they shipped, both now specced: `graph.roots` is **parentless nodes**, not
`visualRoots` (reading the latter would widen the placeholder rule and let an apply steal the start page
from a part-built page), and the start-page lookup is **exact**, not the module's tolerant `isSamePage`.

## AAQ-005 slice 3 — one vocabulary, and a port that could not exist (2026-08-05)

Slices 1 and 2 made both clients judge a candidate the same way and then do the same things to the
project. Slice 3 converged the surface the agent reads *before* it writes: the schema of what it may say
about a node. Editor suite **2202 specs, 0 failures**; `noodl-mcp` **161 tests / 15 suites** (was
136/14); runtime **2144**; both typechecks clean.

1. **The two tool schemas were hand-written twins in two schema languages, and had drifted both ways.**
   MCP accepted `children` and `variant` the editor did not; the editor accepted `sample_data` MCP did
   not; and MCP's instance-port schema was `{ name }` with `.passthrough()`. Now one table
   (`validation/authoringVocabulary.ts`) with two renderers, every remaining difference declared with its
   reason, and a spec that fails on an undeclared one.
2. **⚠️ One of the differences meant a port could not exist.** `plug` was undeclared on the MCP door, and
   a declared instance port without it is **inert**, not merely under-specified:
   `NodeGraphNode.getPorts(filter)` selects on `p.plug`, and `componentmodel` derives a component's
   interface from `getPorts('input')`/`getPorts('output')`. So a `Component Inputs` node carrying
   `ports: [{ name: 'Title' }]` gives the component **no inputs** — written to disk, structurally valid,
   invisible on the canvas, diagnosed by nobody. Now `DiagnosticCode.PortWithoutPlug`, an error in the
   shared precondition set (**five** checks, not four), refused by both gates.
3. **The corpus had to be read, not reasoned about.** Real projects use three plug values — `input`,
   `output` and **`input/output` (92 declared ports)**. A check recognising only the first two would have
   flagged all 92. All three populations were measured before the diagnostic became an error: 1483 of
   1483 corpus instance ports carry a plug, and the AI specs and MCP fixtures declare none without one.
4. **⚠️ Deriving a schema from a table nearly erased the types that keep the write path safe.** A
   rendered `Record<string, ZodTypeAny>` makes zod infer every tool argument as `{ [x: string]: any }`.
   It surfaced only because one handler still declared its parameter precisely; without it, the entire
   authoring write path would have become `any` under a change described as a refactor. The values come
   from the table, the compile-time shapes are stated, and the parity spec reads each registered schema
   back to keep them honest.
5. **A tenth premise-adjacent correction, smaller than the others:** `authoredNodes` — the adapter every
   precondition check reads its nodes through — was a byte-identical twin in both packages *after* slice 1
   converged the policy around it. Adding `ports` to one copy and not the other would have made one gate
   silently stop checking. Converged.

Filed: **AAQ-011 F14** — `variant`, `stateParameters` and the transition fields are authorable only
through the external door, so a component the *editor's* agent creates can never have a variant or a
visual state. `CARRIED_NODE_FIELDS` protects them on an update and there is no base on a create. That is
AAQ-010's subject and it needs the AIB-010 named-reference gap closed first, or the agent will invent
variant names.

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
