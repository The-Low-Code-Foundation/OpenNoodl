# AIX-011: Project-scope authoring

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-011 |
| **Phase** | Phase 15 — AI Collaboration Experience (Track C) |
| **Priority** | 🔴 Critical — "wire this page up to the others" is the first thing every user asks for, and today the answer is no |
| **Difficulty** | 🔴 Hard — multi-component apply threatens the property that makes reject safe |
| **Prerequisites** | AIX-009, AIX-002 (landed), AIX-003 (slices 1–5 landed) |
| **Blocks** | AIX-012 |
| **Recommended executor** | 🔵 Fable 5 — the transaction semantics are the task, and they are expensive to get wrong |
| **Branch** | commit directly to `cline-dev` |

## Objective

Raise the authoring loop from one component per session to a reviewed plan
spanning several — so "now wire this page up to the other relevant pages" works.

## Background

The in-editor assistant is hard-scoped to a single component, in two independent
places. The panel collects exactly one `componentPath`
([`AiAuthoringPanel.tsx:142`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L142)),
and the agent's only write tool is `submit_component`
([`authoring/tools.ts:117`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/tools.ts#L117)),
which takes one component's nodes and connections.

The agent is not, however, blind to the rest of the project. It receives a
project overview and may read up to six existing components
([`ContextBuilder.ts:32`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L32)).
So for the canonical request — *"now wire it up to the other relevant pages"* —
it can already see which pages exist and author correct navigation **out of**
the new page. What it cannot do is put a link to the new page **on** Home. That
requires a second, manual, update-mode session per affected component, which the
user must know to run and must scope themselves.

Note what is *not* missing: the substrate. `noodl-mcp` already exposes
`create_component`, `update_component`, `delete_component`, `list_components`
and `search_project` (`packages/noodl-mcp/src/tools/`), and driving a project
through Claude Code today genuinely does multi-component work. The gap is that
the in-editor experience — the one with the canvas, the diff review and the undo
stack — cannot.

### The property that must not break

AIX-002's reject is safe for a structural reason, not a promised one: a staged
candidate is a detached `ComponentModel` and **rejecting means no call to
`ProjectModel` was ever made**. Accept is one undoable step
([`staging.ts:44`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/staging.ts#L44),
[`staging.ts:83`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/staging.ts#L83)).

Naively extending to N components breaks this: apply component 3 of 5, hit a
validation failure, and the project is now in a state the user did not ask for
and cannot cleanly leave. Preserving the property across a multi-component plan
is the actual engineering content of this task.

## Current state

| Fact | Evidence |
|---|---|
| Panel takes one component path | `AiAuthoringPanel.tsx:142`, `:194` |
| One write tool, one component | `authoring/tools.ts:117` (`SUBMIT_COMPONENT`) |
| Agent can *read* the project (overview + ≤6 components) | `ContextBuilder.ts:32`, `:108`, `:215` |
| Accept/update are undoable, individually | `staging.ts:44`, `staging.ts:83` |
| The undo system already supports many actions as one step | `UndoActionGroup` — [`undo-queue-model.ts:77`](../../../packages/noodl-editor/src/editor/src/models/undo-queue-model.ts#L77) |
| Granular per-change accept with dependency closures exists | AIX-003 slices 1–5 — `ChangeReviewDocument` |
| MCP can already write multiple components | `packages/noodl-mcp/src/tools/author.ts` — `create_`/`update_`/`delete_component` |

## Scope

### 1. A plan step

A project-scope request produces, first, a **plan**: an ordered list of
operations, each naming a component and an intent, with no graph content yet.

```
1. create  Pages/Checkout   — the new page
2. update  Pages/Cart       — add "Proceed to checkout" navigation
3. update  App              — register the /checkout route
4. doc     docs/ARCHITECTURE.md — record the checkout flow
```

The plan is shown to the user **before any authoring happens** and is editable:
drop an operation, or reject the plan outright. This is where a wrong
interpretation gets caught cheaply, before spending tokens on five components.
It is also, not incidentally, the natural scoping conversation.

A `doc` operation type is first-class in the plan. This is how docs stay current
without the automatic-rewrite sludge AIX-009 §5 rejects: the doc update is a
reviewable line item in the same plan as the code that motivates it.

### 2. Execution: fan out, reuse the existing loop

Each operation runs through the **existing single-component session** —
unchanged prompts, unchanged validation gate, unchanged repair loop. This task
adds an orchestrator, not a second authoring implementation.

Two orchestration facts to settle and record:

- **Ordering.** Creates before the updates that reference them, so an update can
  cite a real component name. A plan whose dependencies cannot be ordered is
  rejected at plan time, not discovered mid-run.
- **Shared context.** Each operation's session must know it is part of a plan
  and see the sibling operations' *intents* (not their full graphs — the budget
  will not carry that, and the intent is what prevents two pages inventing two
  different names for the same route).

### 3. Transaction semantics — the crux

Everything is staged before anything is applied. Concretely:

1. All operations author and validate. Nothing touches `ProjectModel`.
2. Any operation failing the gate after repair is reported; the user chooses to
   apply the rest or abandon. Partial application is *offered explicitly*, never
   arrived at by accident.
3. Apply wraps every accepted operation in **one `UndoActionGroup`**, so a
   single undo restores the project exactly — the multi-component analogue of
   `updateAuthoredComponent`'s byte-identical undo.
4. Reject at any point before apply leaves zero trace, for the same structural
   reason as today.

Point 3 is the load-bearing one and needs a test that is not a spec-level
assertion: author a 3-component plan, apply, undo once, and compare the project
files byte-for-byte with a pre-apply snapshot.

### 4. Review

Reuses AIX-003's review document, extended from one component's changes to a
plan's. The existing dependency-closure machinery is the right primitive: it
already makes an invalid partial accept unrepresentable *within* a component,
and the cross-component case is the same shape one level up (you cannot accept
"Cart links to Checkout" while rejecting "create Checkout").

### 5. Panel changes

Extend `AiAuthoringPanel` rather than adding a second panel. It gains a scope
toggle — **This component** / **Project** — with the component field hidden in
project scope. Component scope is unchanged in behaviour and remains the
default; users who want the current, tighter loop keep it exactly.

### 6. MCP parity

`create_plan` / `apply_plan`, so an external agent gets the same staged
all-or-nothing semantics rather than a sequence of individually-committed
`create_component` calls. The existing per-component tools stay — they are the
right primitive for a caller that wants direct control.

### Out of scope

- Creating a project (AIX-012)
- Deleting components in a plan — the destructive case deserves its own thinking;
  create and update only, and say so in the UI
- Cross-*project* work (`dev-docs/future-projects/MULTI-PROJECT.md`)

## Acceptance

1. With a project containing Home, Cart and a new Checkout page, the request
   *"wire Checkout into the app"* produces a plan that updates **Cart and the
   route registration**, not only Checkout — the failure mode this task exists
   to fix.
2. Rejecting the plan performs zero authoring turns and touches nothing.
3. Editing the plan (dropping operation 3) authors only the remaining
   operations.
4. Applying a 3-component plan and pressing undo **once** restores the project
   byte-for-byte against a pre-apply snapshot.
5. One operation failing the validation gate never leaves the project partially
   modified without the user having explicitly chosen that.
6. Component scope is behaviourally unchanged: the AIX-007 measurement corpus
   still runs 8/8 first-attempt at the same cost per component.
7. A plan including a `doc` operation writes the doc through AIX-009's reviewed
   write path, in the same undo group.
8. `create_plan` / `apply_plan` give an MCP caller the same staging guarantees.

## Risks

| Risk | Mitigation |
|---|---|
| Partial application leaves an unrecoverable project | Stage-everything-first; one `UndoActionGroup`; criterion 4 tests the real files, not a mock |
| Plan-level context blows the budget or the AIX-007 cache | Siblings contribute *intents*, not graphs; re-run the cost corpus as criterion 6 |
| Project scope becomes the default and regresses the tight component loop | Component scope stays default; criterion 6 guards the measured behaviour |
| Review UI becomes unreadable at plan scale | Reuse AIX-003's grouped list, which was already built for legibility at 40 nodes — and inherit its open residual (the 40-node fresh-reviewer test) |
| Two orchestrators (editor and MCP) drift | One shared plan model and one execution path; MCP tools call it rather than reimplementing |

## References

- [AIX-002 — The Authoring Loop](./AIX-002-AUTHORING-LOOP.md) — the loop being fanned out
- [AIX-003 — Graph-Native Review](./AIX-003-GRAPH-NATIVE-REVIEW.md) — the review document and dependency closures
- [AIX-009 — Project context documents](./AIX-009-PROJECT-CONTEXT-DOCS.md) — the `doc` operation's write path
- `packages/noodl-mcp/src/tools/author.ts` — the multi-component substrate that already exists
