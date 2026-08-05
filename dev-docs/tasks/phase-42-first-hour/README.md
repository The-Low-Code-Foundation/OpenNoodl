# Phase 42 — First Hour, second pass

**Created:** 2026-08-05
**Origin:** Richard drove the alpha "first hour" again — deeper than phase 39's pass — and wrote
down 21 items: signal semantics, the props panel, the cloud-workflow surface, MCP onboarding, the
code editor, provenance Record, pointer events, and a tail of visual defects. Every item was
researched against the code before a single doc was written; several "bugs" turned out to be
built-features-behind-broken-affordances, and several "features we built" turned out to be
decisions still waiting to be made.

Three kinds of doc in this folder:

- **FH-*** — bug-fix task docs. Mechanism confirmed with file:line, slices, criteria, traps.
- **TALK-*** — brainstorm docs for the conversations Richard asked for. Each states what the code
  actually does, the real options, and a recommendation to argue with.
- **CWF-***, **HUD-*** — the build tasks that came *out* of a TALK conversation once it was had.

## The triage table

| # | What Richard reported | What research found | Doc |
|---|---|---|---|
| 0 | Done/Completed/Unchanged "doubling up" | Semantics are real and your guess was backwards (**Completed** always fires; **Done** = changed something; **Unchanged** = valid no-op). Real problems: signal-port descriptions render **nowhere** in the editor, and on 48/82 nodes the distinction collapses (8 nodes: Done ≡ Completed). | [TALK-006](TALK-006-THE-THREE-SIGNALS.md) |
| 0.1 | "Didn't we add nodes to watch arrays?" | **Yes — built and shipped.** `Array Changed` + `Object Changed` (category Logic, ERG-004): Item Added/Removed/Changed (in-place edits via per-member subscriptions), Array Replaced, Index/Item/Key/Count. No "choose what to watch" selector **by design** — you choose by which output you wire. Known blocker: no Data node emits a live object → FH-004. Reorders (sort/reverse) deliberately fire no signal. | answer + [FH-004](FH-004-THE-OBJECT-NODE-EMITS-AN-OBJECT.md) |
| 1 | `[object Object]` as auto-name | Diagnosed in phase 3 (TASK-006B), chosen fix half-applied: `labelForNode` returns the raw expression object; the resolver built for it has zero call sites. Three collateral bugs (cache poisoning, spurious sub-label, latent crash). | [FH-003](FH-003-OBJECT-OBJECT-ON-THE-CANVAS.md) |
| 2 | WebSocket node bound to the selected backend | Wrong abstraction — the built-in backend is deliberately SSE, and 4/6 backend types don't speak WS. A five-transport realtime layer already exists with exactly **one door** (Query Records' checkbox). Proposal: standalone Subscribe To Changes node. | [TALK-005](TALK-005-BACKEND-BOUND-REALTIME.md) |
| 3 | Object node has no Object output | **Never built — and Richard already decided it should be** (2026-08-02, ERG-004 §7.4, recorded "unowned and not started"). Unblocks `Object Changed`. `Array.Items` may already serve the array side — verify first. | [FH-004](FH-004-THE-OBJECT-NODE-EMITS-AN-OBJECT.md) |
| 4 | Popout editor opens at the button's Y, off-screen | React-18 measurement race: positioned against a 0×0 box because the two editors skip the `flushSync` five other popouts use (DEBT-010 pattern), **plus** `_positionPopout` genuinely has no flip logic. Same as phase-40 AAQ-011 F2 (open, unowned — superseded here). | [FH-005](FH-005-THE-POPOUT-OPENS-OFFSCREEN.md) |
| 5 | Roboto Medium in text styles | Appears nowhere in the repo. Comes from **library prefab imports** (16 prefabs ship `Roboto-Medium.ttf`) via the font picker — or from that project's own styles metadata. One measurement in the project settles which. | [FH-006](FH-006-ROBOTO-MEDIUM.md) |
| 6 | Type selection on Component Inputs/Outputs | **Never built, and ERG-005 explicitly forbade building it yet** — §2 is a decision written up *for Richard*, still unanswered. §1 is mid-flight in another session (untracked tests-first). | [FH-007](FH-007-COMPONENT-IO-TYPES-STATUS.md) |
| 7 | Explain panel steals focus, loses selection | Panel doesn't steal focus — the property editor does (by design); Explain then pays twice: showing it **deliberately deselects** (missing from an allow-list), and it never re-reads on becoming visible. Both fixes are small; turning it off is a settings toggle, no code. | [FH-008](FH-008-THE-EXPLAIN-PANEL-CANT-HOLD-A-SELECTION.md) |
| 8, 9b | Docs panel + VC rows dark-on-dark in light mode | One shared bug: `ListItem`'s Active variant paints `--theme-color-secondary` (an **action** colour, inverted by construction) as a surface — POL-004's class. ~1.9:1 in light; broken in dark too. Three call sites, one fix. | [FH-009](FH-009-THE-ACTIVE-LIST-ITEM-IS-UNREADABLE.md) |
| 9a | Create/Connect Repository: overlay, no dialog | `position: fixed` modals rendered **in-tree** inside `BasePanel`'s CSS container (`container-type` makes the panel the containing block) — violating the contract BasePanel's own comments document. Portal/BaseDialog them; two more instances in the same panel. | [FH-010](FH-010-THE-DIALOG-TRAPPED-IN-THE-PANEL.md) |
| 10 | Record records nothing | **Structural**: nothing pulls the trace buffer unless a walk is on screen; `stop()` never pulls; preview reload silently disarms with no re-arm; Record arms with no viewer connected. Capture itself works. ✅ **Talked 2026-08-05: the HUD is an alpha feature and Record moves to the canvas** — the HUD track below. | [FH-011](FH-011-RECORD-RECORDS-NOTHING.md) + [TALK-003](TALK-003-A-RECORDING-HUD.md) |
| 11 | The whole cloud-workflow audit | Nine step kinds **by design** ("workflows orchestrate, functions compute"; conditions are data because eval'd strings = RCE behind an admin credential). Real holes: `call-function` **params have engine support and no UI** (you can't pass data into functions at all); workflow output is computed then **dropped** before the caller sees it; modern HTTP node is browser-only so the cloud picker has only deprecated REST2; POL-015 first-workflow still broken. | [TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) |
| 12 | Pin from another workflow + z-order | POL-009's slice-2 warning ignored: the pin captures identity from the open canvas, not the execution. Auto-navigate + tag from `workflowId`. Overlay bars z=200 vs picker's popup layer z=10 with no intervening stacking context. | [FH-012](FH-012-PIN-NAVIGATION-AND-Z-ORDER.md) |
| 13 | Where's the MCP server / URL? | **There is no URL and no door**: both servers are stdio (client-spawned), the editor has zero MCP UI (37 grep hits, all comments), and neither binary ships in the packaged app. ✅ **Talked 2026-08-05: settings section, two captioned buttons, per-project server names** — the MCP track below. Verifying it found two things the doc lacked: `nodegx-observe` **never reconnects** and its token is per-launch, so a copied command dies at the next editor restart; and the proposed commands **collide across projects**. | [TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) |
| 14 | Props labels cut off even when panel widened | Hard **62px** label column in both label implementations (React row + legacy row), `flex-shrink: 0` — panel width is irrelevant. Cloud-workflow steps use the same component; fixed together. | [FH-013](FH-013-PROPS-LABELS-WRAP.md) |
| 15 | Unit menus open empty | The select **removes the selected option from its own menu**, and ≈27 of 59 unit ports declare exactly one unit → one option, filtered out, empty bordered sliver. | [FH-014](FH-014-THE-EMPTY-UNIT-MENU.md) |
| 16 | Block pointer events doesn't work | Click-through is the default (handlers installed on every visual node whether connected or not; nothing stops propagation). The blockTouch option **works everywhere except Button** — one JSX line re-assigns `onClick` after the blocking wrapper. Plus a right-default question (auto-stop when Click is connected). | [FH-015](FH-015-BLOCK-POINTER-EVENTS.md) |
| 17 | Can't drag connection labels | **Built** (CAN-001) — but the grab is gated on the wire-stroke hover, the exact ordering trap the spec warned about; selection-lit chips are fully inert; zero cursor affordance; no drag test. | [FH-016](FH-016-WIRE-LABELS-ARE-DRAGGABLE-IN-THEORY.md) |
| 18, 19 | Code editor: autocomplete, linting, selection, "DIY mistake?" | **It's not DIY — it's CodeMirror 6**, and all six symptoms are located config gaps (a bad guard, a duplicate un-debounced error system, a hardcoded `dark: true`, a hover-only gutter). ~A day, mostly deletion. The real ask underneath is typed intellisense — reachable on CM6. ✅ **Talked 2026-08-05: no switch.** | [TALK-002](TALK-002-THE-CODE-EDITOR-IS-NOT-DIY.md) + [FH-017](FH-017-CODE-EDITOR-FIXES.md) + [FH-019](FH-019-TYPED-INTELLISENSE.md) |
| 20 | Execution history / data explorer for deployed apps | Noted for the deployment phase as asked: execution history is coupled by *address* (cheap to remote), the Data Browser by *architecture* (needs a BackendHandle route); the admin-credential tier must be decided first; BAK-005's served `/_admin` already exists as the v1 answer. | [phase-26 NOTE-REMOTE-PANELS](../phase-26-deployment/NOTE-REMOTE-PANELS.md) |

## The six conversations, in the order I'd have them

1. 🔄 **[TALK-001](TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) — cloud workflows. HAD 2026-08-05, then
   REOPENED the same day.** Decisions recorded at the foot of the doc; seven build tasks written
   (the CWF track below). Reopened because it audited the workflow *steps* and never audited what a
   cloud *function* can compute with — that is
   [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md), now annotated end to end and awaiting
   one decision (Pile B) plus anything Richard wants to add. **The cloud picker offers 57 nodes and
   not one array type — but a Function node is a Node 22 script with `crypto.subtle`, `fetch`,
   `FormData` and all 79 env vars**, so almost nothing on the wish list is a runtime problem; it is
   a node-and-door problem. CWF-003 shrank as a result.
2. ✅ **[TALK-002](TALK-002-THE-CODE-EDITOR-IS-NOT-DIY.md) — code editor. HAD 2026-08-05.**
   **No editor switch** (we are stock CM6 minus six rows of config). Slice 3 **takes the
   `eslint-linter-browserify` dependency** — the doc had mis-costed it as free, it is installed by
   nobody. Typed intellisense is promoted out of future-projects into
   [FH-019](FH-019-TYPED-INTELLISENSE.md). FH-017 unblocked and started.
3. ✅ **[TALK-004](TALK-004-THE-MCP-FRONT-DOOR.md) — MCP onboarding. HAD 2026-08-05.**
   Settings section beside the AI one, **two** captioned Copy buttons, and the registration is
   **named after the project** so multiple projects coexist. Q3 went to (a) — the editor creates the
   project — against the doc's lean, because [TAB-006](../phase-37-project-tabs/TAB-006-TAB-AWARE-AGENT-ACCESS.md)
   records that tabs affect `nodegx-observe` (bound to a port) and explicitly **not** `noodl-mcp`
   (bound to the path in argv, *"none — it works unchanged"*). Four build tasks (the MCP track
   below); the observe reconnect fix gates the observe button.
4. **[TALK-006](TALK-006-THE-THREE-SIGNALS.md) — the three signals.** One vocabulary decision
   (keep both ports on the 8 degenerate nodes?), one surface decision (where descriptions render).
5. ✅ **[TALK-003](TALK-003-A-RECORDING-HUD.md) — recording HUD. HAD 2026-08-05.** **Alpha, not
   fast-follow**, and **Record leaves the Provenance panel** for a canvas control. Four build tasks
   (the HUD track below), all gated on FH-011. Q4 went the expensive way — per-peer trace
   ownership — and the research for it found a **live data-loss bug**: an agent's `start_trace`
   destroys a recording a human is in the middle of.
6. **[TALK-005](TALK-005-BACKEND-BOUND-REALTIME.md) — backend realtime.** Mostly assembly on
   existing plumbing; needs your yes on the standalone node.

Plus one embedded decision: **ERG-005 §2** (explicit types on component I/O) inside FH-007.

## ⚠️ Read this before any CWF task

[**BACKEND-AUTHORING-MODEL.md**](../../reference/BACKEND-AUTHORING-MODEL.md) is the canonical
statement of what a workflow is, what a cloud function is, and why the split exists. It was written
after half of TALK-001's conversation turned out to rest on a misunderstanding of exactly that.
Everything below derives from it.

**A workflow orchestrates; a cloud function computes; the workflow calls the function.** Data nodes,
HTTP and code belong in cloud functions — never as workflow steps. Q2 and Q4 are closed on those
grounds, and the orientation problem that made the confusion possible is its own phase
([phase 43](../phase-43-backend-authoring-clarity/README.md)).

## The CWF track (out of TALK-001, 2026-08-05)

Build in this order — CWF-001 gates the rest of the track:

| # | Task | Why |
|---|---|---|
| 1 | [CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md) — Call Function params | You cannot pass data into a cloud function at all. Engine + `$path` control both exist; the catalog declares nothing, so no UI can author a mapping. |
| 2 | [CWF-002](CWF-002-THE-WORKFLOW-RETURN.md) — the return | Output is computed then dropped at [dispatcher.ts:217](../../../packages/nodegx-backend/src/triggers/dispatcher.ts#L217). Sync/async per trigger **+** a visible Return step (Q3). |
| 3 | [CWF-003](CWF-003-HTTP-IN-THE-CLOUD-RUNTIME.md) — HTTP in cloud | **Promoted.** Under the correct model this *is* the answer to "how do I call an API", not an ergonomic nicety. One line in the cloud viewer's list — plus two checks that could make it not-one-line. |
| 4 | [CWF-005](CWF-005-RETRY-IS-A-POLICY.md) — Retry folds in | Q7: Retry *is* a call-function with backoff. Fold it as a policy group, delete the kind, migrate on read. Presentation fixes ship first, alone. |
| 5 | [CWF-004](CWF-004-THE-TRANSFORM-STEP.md) — Transform + data steps | **Rewritten 2026-08-05** on Richard's argument: without a workflow-level reshape, every function carries its caller's mess. Widened to a family (Validate, Filter, Split, Sort, Dedupe, Parse JSON). A free Function step is advised against; the "new function from this step" gesture replaces it. **Blocked on CWF-001.** |
| 6 | [CWF-006](CWF-006-TRIGGERS-AND-THE-ENTRY-STEP.md) — triggers + entry | Pile 2. Nothing is broken; the picker just never says so. Cheap affordances — and a **subset of [phase 43](../phase-43-backend-authoring-clarity/README.md)**, which supersedes it if that lands first. |
| — | [FH-018](FH-018-THE-CONFIG-NODE-IS-INERT-AND-ITS-ENDPOINT-IS-PUBLIC.md) — the Config node | Filed 2026-08-05. Inert since WF-007 (`configSchema` declared, never assigned) **and** `GET /config` is public and unfiltered. Needs a decision before slices. |
| — | [CWF-007](CWF-007-STREAMING-RESPONSES.md) — streaming | Q5: a design doc to argue with, not a build. Answer it together with [TALK-005](TALK-005-BACKEND-BOUND-REALTIME.md) — same node family. |

Deferred with reasons in the decisions table: data steps (Q2), an HTTP *step* (Q4), workflow-calls-
workflow (Q6). Pile 1.4 keeps its existing owners (POL-015, OPEN-WORK F62).

## The HUD track (out of TALK-003, 2026-08-05)

**[FH-011](FH-011-RECORD-RECORDS-NOTHING.md) gates all four** — a HUD over a recorder that records
nothing is a prettier version of the same defect. FH-011's slice 2 is **amended** by this
conversation: the poll moves out of `ProvenancePanel` and into `TraceSession`, because a sidebar
panel is not constructed until it is first opened and Record no longer lives there.

| # | Task | Why |
|---|---|---|
| 1 | [HUD-001](HUD-001-THE-RECORDING-OVERLAY.md) — the overlay, the control, the counter | Record becomes one canvas control with two states. The `execution-overlay` slot is already taken, so this gets its own layer. |
| 2 | [HUD-002](HUD-002-NODE-BADGES.md) — badges as nodes fire | The demo. `getNodeBounds` × the event's `from`/`to` (**not** `fromNode`/`toNode` — no such fields), POL-009-scoped, honest about what is off-canvas. |
| 3 | [HUD-003](HUD-003-EXPAND-TO-THE-WALK.md) — expand → roots → walk | Joins the halves. Must go through `provenanceRequest`'s stash-then-switch, and is *more* exposed to that trap than the canvas right-click was. |
| 4 | [HUD-004](HUD-004-THE-TRACE-HAS-OWNERS.md) — per-peer trace ownership | Two peers share one global boolean and **neither editor peer registers a clientId**, so there is no identity to own a switch with. Includes the data-loss fix. |
| — | replay scrubber | v2. `ExecutionTimeline` is reusable when we want it. |

## The MCP track (out of TALK-004, 2026-08-05)

Build in this order — the first two gate the third, and the ordering is the point: a front door
that hands out a command which stops working, or points at a file only contributors have, is worse
than today's no-door.

| # | Task | Why |
|---|---|---|
| 1 | [MCP-003](MCP-003-OBSERVE-RECONNECTS.md) — observe reconnects | **Gates MCP-001's observe button.** [relayClient.ts:129-171](../../../packages/nodegx-observe/src/relayClient.ts#L129) connects once, with every handler behind `if (settled) return`; the token is minted per editor launch. Restart the editor and all nine tools throw `Not connected to the NodeGX relay.` forever. Also puts `@noodl/observe` into `test:packages`, which scopes `@noodl/mcp` and not it. |
| 2 | [MCP-002](MCP-002-SHIP-THE-SERVERS.md) — ship both servers | `extraResources` has four entries and no MCP binary; `dist` is gitignored. Two build steps + two entries + one resolver, on the exact `nodegx-backend` precedent ([build-editor.ts:69](../../../scripts/build-editor.ts#L69), [ServiceSupervisor.js:65](../../../packages/noodl-editor/src/main/src/local-backend/ServiceSupervisor.js#L65)). |
| 3 | [MCP-001](MCP-001-CONNECT-AN-AI-AGENT.md) — the front door | The settings section. Reuses ExecutionDetail's clipboard pattern verbatim. **Slug the directory basename, not `ProjectModel.name`** — it is optional and falls back to `'Untitled'`, which re-creates the collision the per-project naming exists to prevent. |
| 4 | [MCP-004](MCP-004-THE-MCP-DOCS-PAGE.md) — the page and the READMEs | ⚠️ The page is a change to the **docs repo**, not this one — `docs/` here is reference material, and the user-facing origin is `getDocsEndpoint()`'s GitHub Pages site. Both package READMEs currently contradict the buttons; observe's config does not work off-PATH. |

Deferred with a reason in the decisions table: the preview button (`npm run preview` →
`127.0.0.1:8575`), a merged single server (phase-36's open question, stays closed), `npm publish`,
and making `noodl-mcp` startable with no project directory.

## Suggested build order for the FH tasks

Cheap-and-visible first, grouped by shared surface:

1. **FH-009** (ListItem — one fix, three panels) → **FH-014** (unit menu) → **FH-013** (label
   wrap). All noodl-core-ui; sequence them, don't parallelise (core-ui worktree trap).
2. **FH-005** (popout flushSync — two small edits + optional flip), **FH-010** (portal the
   dialogs), **FH-012** (pin identity + stacking context).
3. **FH-003** ([object Object]), **FH-004** (Object output — unblocks Object Changed),
   **FH-015** slice 1 (the Button one-liner) then the default-behaviour slices.
4. **FH-011** (Record — now also the gate for the whole HUD track, so it moved up in practice),
   **FH-016** (label drag), **FH-008** (Explain), ~~**FH-017**~~ (code editor —
   ✅ **DONE 2026-08-05**, all five slices, driven live in both themes), then
   **FH-019** (typed intellisense, same files — sequence them, don't parallelise).
5. **FH-006** (Roboto — after the one measurement), **FH-007** (blocked on ERG-005 §2 + the
   other session's §1).

## ⚠️ Concurrent-session note

At the time of writing, another session has uncommitted work in `projectmodel*`,
`ProjectImporter`, `LocalProjectsModel`, `featureFlags.ts` (v2-format flip),
**`VersionControlPanel/**`** and untracked `tests-unit/erg-005/`. Affected here: **FH-010** must
not touch `DiffList.tsx` and commits by explicit pathspec; **FH-007** is partly *their* workstream
— do not start §1/§2 build without checking whether that session is live. Never `git add -A`,
never stash.

## What this phase deliberately is not

Phase 41 (accessibility) stays the current scheduled phase; this folder is triage + specs so that
each item can be picked up in a session with full context, the way phase 39's fifteen were. The
TALK docs are inputs to conversations with Richard, not commitments.
