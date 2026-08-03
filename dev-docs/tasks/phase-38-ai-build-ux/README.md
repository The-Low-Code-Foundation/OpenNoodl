# Phase 38 — The AI Build Experience (Track W)

**Created:** 2026-08-03
**Origin:** not the roadmap. Richard built a real app — a chat product with signup, chat list and chat
pages — end to end through the launcher's AI scoping wizard and the Build panel, on the way to alpha.
It produced a three-operation plan, authored 44 nodes across three components, wrote four documents,
and then **threw all of it away on apply** with `node.parameters.pathParams.split is not a function`.

His words: *"all that LLM work and tokens have gone to waste."*

## What this phase is

Every individual piece of the AI authoring stack works. AIX-002 built the single-component loop,
AIX-011 fanned it out to plans, AIX-012 put a scoping conversation in the launcher, AIX-008 built a
sandbox preview, AIX-009/010 built project docs and review. Each shipped with tests and each is
sound in isolation.

**Phase 38 is the first time anyone drove all of them in sequence as a user would**, and the result
is that the paths *between* the parts are unbuilt, unguarded, or actively destructive. Nine
complaints came out of one session. Not one is a disagreement about design. Every one is a mechanism
that is missing, wrong, or unreachable — and they are listed with their mechanisms below because
that is the phase's whole content.

This is an alpha-blocking phase. A user who loses an hour of model output to a `.split` on the
happy path does not file a bug; they leave.

## The nine, and what each one actually is

| # | Richard's report | Mechanism | Task |
|---|---|---|---|
| 5 | *"they all throw 'the plan could not be applied' so all that LLM work has gone to waste"* | The model wrote `pathParams` as a JSON **array**; `PageInputsAdapter` calls `.split(',')` on it. **Nothing anywhere validates parameter values** — `nodes.schema.json` declares `parameters` as `additionalProperties: true`, and the semantic validator checks types and ports, never values. The apply transaction correctly rolls the whole plan back. | [AIB-001](AIB-001-PARAMETER-VALUE-CONTRACT.md) |
| 3 | *"took a REALLY long time… very little animation… you can't review any of the three steps after each one was built"* | `PlanRun.run()` is a strict sequential `for…of`, then a **second** sequential pass for docs — six serial model sessions. The Review button is gated on `done` (the whole run), not on the operation's own `staged` status, though `filesFor(id)` is populated the moment each lands. `costUsd` is computed and never rendered. | [AIB-002](AIB-002-THE-RUN-IS-LEGIBLE.md) |
| 9 | *"my conversation and all the AI created pages were gone"* | `ProjectAuthoringView` holds the plan, the run and every staged candidate in `useState`, and the panel **conditionally renders** it — switching the scope toggle unmounts the component and destroys all of it. The launcher handover is a destructive `take()` into module state, so it cannot be re-read either. | [AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) |
| 4 | *"confusion between 'Apply plan' and 'Keep all'"* + *"shows me the node canvas, but not the preview of the built component"* | Two verbs for two different scopes with no visual hierarchy between them. And plan review opens `ChangeReviewDocument` (a graph diff) when `SandboxPreview` — a rendered, runnable preview of the exact candidate — already exists and is wired only into the single-component loop. | [AIB-004](AIB-004-ONE-VOCABULARY-AND-A-REAL-PREVIEW.md) |
| 2 | *"it took me into the hello world app and didn't show anything about it building the app I'd asked for"* | The handover works — but nothing **opens or announces** the Build panel. `peekPendingScopePlan` only decides which scope tab is preselected *if the user finds the panel themselves*. | [AIB-005](AIB-005-LAUNCHER-TO-EDITOR-HANDOFF.md) |
| 1 | *"the assistant answers weren't formatted markdown, just pure markdown"* | `ScopingStep.tsx:76` renders `{message.text}` as a raw text node. A `Markdown` component exists in core-ui and is used by the Docs panel. | [AIB-006](AIB-006-MARKDOWN-RENDERING.md) |
| 6 | *"'CONVENTIONS.md' seems to have raw content, but the preview just shows a blank page"* | Remarkable terminates an HTML comment block at the first **blank line**, not at `-->`. CONVENTIONS.md is the only template whose comment spans one. The rendered HTML contains `<!--` and **zero** `-->`, so the browser swallows the entire rest of the page. Verified on the real file: 3081 chars in, one `<h1>` visible. | [AIB-006](AIB-006-MARKDOWN-RENDERING.md) |
| 7 | *"making nodes with backend stuff, but it doesn't appear to have actually added a backend"* | The scoping conversation records the backend as **prose** (`ProjectScope.backend?: string`) into ARCHITECTURE.md. No code path provisions one. Verified: `ai-test/project.json` has an empty `settings` and no `cloudServices`, while the plan authored `Create User Account` and `Log In Existing User` nodes. | [AIB-007](AIB-007-SCOPE-PROVISIONS-A-BACKEND.md) |
| 8 | *"we should consolidate the version control and github panels"* | Two separate sidebar panels over one repository. Not a defect — an accepted IA proposal. | [AIB-008](AIB-008-CONSOLIDATE-VERSION-CONTROL.md) |
| — | found along the way | Six further defects and gaps, including a Settings dialog that opens over the launcher unprompted and a failed operation whose authored output is unrecoverable. | [AIB-009](AIB-009-FOUND-ALONG-THE-WAY.md) |

## The design position

Recorded first, because most of the tasks are downstream of it.

### Model output is the expensive artifact. Treat it like one.

Every defect that made Richard angry is the same defect wearing different clothes: **the system
discards model output that cost real money and real minutes, and does so silently.**

- Apply fails → the whole plan is rolled back and there is no retry path (AIB-001).
- Switch a tab → three authored components evaporate (AIB-003).
- One operation fails → its partial output is dropped and cannot be re-run alone (AIB-009).
- Close the window → the launcher's plan is gone, *even though it is durable on disk* in
  `docs/decisions/000-initial-scope.md` and nothing reads it back (AIB-003).

The rule this phase adopts: **authored output is durable from the moment it validates, and no
navigation, failure, or restart may destroy it without the user saying so.** The transaction
property AIX-011 built — nothing reaches the project until apply — is right and stays. What is wrong
is that "not in the project yet" was implemented as "not anywhere yet."

### A rollback is not an outcome. It is a question.

`applyAuthoredPlan` rolling back cleanly is correct engineering and terrible product. The user is
left holding a red sentence and a dead plan. After AIB-001, an apply failure must present as: *here
is the operation that failed, here is the parameter that was wrong, here is the fix — retry just
that one.* The transaction stays all-or-nothing; the **recovery** becomes incremental.

### Validate what the model writes, not just what it names.

AIX-002's gate checks that node *types* exist and that *ports* connect. It never checks that a
parameter **value** is a shape the editor can consume. The catalog knows: 24 distinct port types,
and the ones with non-obvious wire formats are not rare —

| Port type | Ports in catalog | Wire format the model must produce |
|---|---:|---|
| `number` | 926 | number, not `"100"` |
| `enum` | 249 | one of the declared options, exactly |
| `dimension` | 28 | string with units, e.g. `"100px"` |
| `stringlist` | 25 | **comma-separated string**, not an array ← the crash |
| `proplist` | 7 | array of `{label, value}` |

Nothing checks any of them. `pathParams` is the one that happened to reach an adapter that calls
`.split`. The other 1,235 ports are the same bug waiting for a different plan.

### Progress is a promise about time, not an animation.

Richard did not ask for a nicer spinner. He asked to know *what it is doing* and to *act on finished
work while the rest runs*. Those are the same requirement: the run must publish per-operation state
that the UI can act on, not just a global `busy`. The data is already there — `PlanRun` tracks every
operation's status and the panel throws it away behind one `done` gate.

## Order of work

**AIB-001 first and alone.** It is the difference between "the AI build path works" and "the AI
build path destroys your work," and every other task is polish on a road that currently ends in a
wall.

> **✅ AIB-001 is built** (2026-08-03) — all four slices, criteria 1–5 tested, criterion 6 (the live
> replay) owed. Three things worth carrying into the rest of the phase:
>
> - **Two of AIB-001's stated wire formats were wrong**, and a validator written from its own table
>   would have rejected 3,589 legitimate values. The rules were derived from the corpus instead. The
>   pattern is now familiar enough to expect (see the phase-30 memory): *read the mechanism before
>   trusting a task's stated facts, including this README's.*
> - **A third defect fell out of it**: the authoring prompt tells the model to write
>   `paddingTop: "var(--space-4)"` and the runtime silently discarded it — so every on-system spacing
>   value the AI ever produced for a units port did nothing. Same family as the headline, one layer
>   down, and invisible from the symptom.
> - **The recovery shape AIB-001 landed on is the one the rest of the phase should copy**: the
>   transaction stays all-or-nothing, the *repair* becomes incremental. AIB-009's "a failed operation's
>   output is unrecoverable" is the same fix applied to a different failure.

Then, in parallel: **AIB-003** (stop losing state) and **AIB-006** (two small rendering fixes with
outsized credibility effect — a wizard that renders `**bold**` literally reads as unfinished before
the user has judged anything else).

> **✅ AIB-003 (slices 1–3) and AIB-006 are built** (2026-08-03). Carry forward:
>
> - **AIB-003's criteria 3 and 4 look contradictory and are not.** "Survives switching projects" and
>   "a run must not leak past a project close" resolve once the two things a run *is* are separated:
>   cancel the departing run, keep what it staged. Expect the same shape wherever this phase asks for
>   durability and safety at once.
> - **AIB-006's fix could have introduced the defect it was closing.** Stripping HTML comments
>   unconditionally would have deleted a model's own `<!-- -->` example out of a code fence in the
>   editor's AI chat — a silent corruption, in the same class as the blank preview. Whenever a fix
>   here is "sanitise the input", check every consumer of the thing being sanitised.
> - **`ProjectReviewStore.clear()` is called from nowhere.** AIX-010 left it unwired. It is the
>   precedent AIB-003 was told to copy — copy its *shape*, not its wiring.

Then **AIB-002** and **AIB-004** together — they are one experience and reviewing them separately
will produce two vocabularies again. Then **AIB-005**, **AIB-007**, **AIB-008**.

**AIB-009** is a register, worked opportunistically alongside the others.

## Exit criteria for the phase

The session Richard ran, run again, end to end:

1. Describe a chat app in the launcher's AI wizard. Assistant replies render as markdown.
2. Finish. The editor opens and **says**, unprompted, that a plan is waiting.
3. Start the build. Each operation reports what it is doing, how long it has taken, and what it has
   cost. Each becomes reviewable — as a **rendered preview**, not only a node diff — the moment it
   lands, while the rest run.
4. Switch panels, switch scope tabs, come back. Everything is still there.
5. Apply. It succeeds. If it fails, the failure names the operation and the parameter, and offers to
   retry that operation alone.
6. The app's docs all render. The backend the scope described exists in Backend Services.
7. Quit the editor and reopen the project. The plan and its authored output are still recoverable.

Criterion 5 is the phase. The rest is why anyone would get that far.

## A note on evidence

Every mechanism in the table above was verified against the source or against Richard's actual
`ai-test` project on disk during the session that opened this phase — not inferred from the
symptom. Where a task says "verified", it means a file was read or a script was run, and the task
says which. Where something is still a hypothesis, it says that instead.

> **✅ AIB-002, AIB-004 and AIB-005 are built** (2026-08-03), with live QA. Carry forward:
>
> - **AIB-002 slice 1's stated mechanism had already been fixed by AIB-003**, and the fix it asked
>   for ("rebuild the working entry from `filesById`") was already the behaviour. What criterion 4
>   needed was a *spec*, not a change. That is now four of this phase's stated mechanisms that moved
>   under a later task — read the mechanism, including this README's.
> - **Two of the four defects this batch found came from a mount, not from a diff.** The review
>   topbar overflowed off-screen once it carried a fourth view and two longer verbs, and AIB-005's
>   panel switch was silently overwritten by a *later effect in the same mount*
>   (`useSetupSettings`). Neither is visible to a suite with no DOM, and neither is visible from
>   reading the diff. `scripts/aib38-live/scripted-plan.js` and `scripted-handoff.js` are the
>   no-provider drivers; both are reusable for the remaining tasks.
> - **A task's acceptance criterion can contradict the phase's design position.** AIB-004 criterion 6
>   ("red for no action that leaves the project unchanged") would have made `Discard plan` non-red,
>   while this phase's own position is that model output is the expensive artifact. Resolved as *red
>   exactly when there is something to lose*. Expect more of these: the criteria were written before
>   the position was.
> - **AIB-009 gained F11** — nothing anywhere ends a turn that never returns. Found because a
>   throttled timer made a scripted run look hung, and the editor had no way to tell the difference.

> **✅ AIB-007, AIB-008 and AIB-009 F2 are built** (2026-08-03). Carry forward:
>
> - **A sixth stated mechanism moved.** AIB-007 slice 2 asked for a `requires: ['backend']` catalog
>   marker behind a generator with a committed snapshot. BCN-010 had already built the reviewed
>   table (`NODE_CAPABILITIES`), with a module note giving the reasons slice 2 would have re-derived
>   — so the change is a small table beside it and the `catalog:merge:check` trap is never reached.
>   AIB-008's "Current state" was wrong in the same way: `GitHubPanel` is an Issues and Pull Requests
>   panel, and its proposed four-section shape had nowhere to put them.
> - **An inverse must restore what was there, not what the reader understands.**
>   `get/setCloudServices` reads and writes four fields; the corpus fixture carries a fifth
>   (`workspaceId`). Snapshotting an undo through that projection dropped it silently. Only
>   criterion 4's byte-for-byte assertion could catch it — the round trip looks correct at every
>   other level. Worth expecting wherever this phase records an inverse through a helper.
> - **A warning is not surfaced by being emitted.** Dropping the provision and keeping the pages that
>   need it produces a *warning*, so `validation.ok` stays true and the apply loop never reads it —
>   and a note raised before the apply is wiped by the `reset()` a **successful** apply calls. The
>   first two fixes for this were both invisible.
> - **F2's obvious assertion was wrong, and failed against correct code.** `not.toMatch(/ onerror=/)`
>   fires on escaped text. A substring check over rendered HTML cannot tell markup from content —
>   the same confusion that produces XSS. Assert on the tags, not the string.
> - **Measure before adding a mechanism.** F2's own suggested fix was a sanitiser or an allow-list.
>   Remarkable turned out to already refuse every script-bearing link target, leaving raw HTML as the
>   only vector and `html: false` as a complete answer in one line.

## Where the phase stands (2026-08-03)

| Task | State |
|---|---|
| AIB-001 | built; criterion 6 (live replay) still owed |
| AIB-002 | **built, live QA green** |
| AIB-003 | slices 1–3 built; slice 4 (persist under `.nodegx/plan/`) optional, not done; live QA owed |
| AIB-004 | **built, live QA green** |
| AIB-005 | **built, live QA green** (slice 3's wizard label not driven live) |
| AIB-006 | built; criteria 1–2 not testable offline, live QA owed |
| AIB-007 | **built** (all four slices); criterion 6 (live, against a real provider) owed |
| AIB-008 | **built** (all four slices); criterion 7 (live connect + push) owed |
| AIB-009 | F1, F2, F8, F9, F10 closed; F6 half closed; F11 open |
