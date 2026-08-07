# Phase 43 — Backend authoring clarity

**Created:** 2026-08-05
**Status:** open, not yet scheduled (phase 41 accessibility remains the current scheduled phase)

## Why this phase exists

On 2026-08-05 Richard — who commissioned both the workflow engine and the cloud function runtime,
and had just spent an hour driving them — asked:

> *"Why are there cloud functions AND workflows and it seems like you're saying they're two
> different things with their own nodes? Wtf is the difference?"*

and then, having understood it:

> *"my whole rambling about 'the workflows don't have enough nodes' is because I'd not understood at
> all what Workflows do in our backend."*

An entire morning of design decisions was made on that misunderstanding, and two of them had to be
reversed. **If the author of the system cannot tell the two surfaces apart from the product, no user
will.** That is not a documentation gap; it is a design defect in the editor, and it is worth its
own phase rather than a task inside phase 42.

The architecture itself is sound and is not what this phase questions — see
[BACKEND-AUTHORING-MODEL.md](../../reference/BACKEND-AUTHORING-MODEL.md), which is the canonical
statement and this phase's input.

## The problem, stated precisely

Nothing in the product tells you which surface you are on, or what it is for:

1. **Both are canvases with nodes and wires**, and they share the visual language of the whole
   editor — but they share no node set, no execution engine, and no storage.
2. **The node picker is the only signal**, and it is a silent one: 57 entries on one canvas, 9 step
   kinds on the other, with nothing saying why. Richard read the 9 as "the workflow system is
   missing its nodes".
3. **A workflow is not in your project.** It lives in the backend. Nothing on screen says so, and
   the consequences (it isn't in git with the rest, it survives a project close) are invisible.
4. **A new workflow is born as a bare `call-function` step that is also the entry**, so the first
   card reads as a declaration of the workflow rather than a call out of it.
5. **Triggers cannot be placed** — they are a read-only view of backend state — and the picker
   never says where they live.
6. **The names carry history, not meaning.** "Cloud function" is a Noodl-era term; the wire URLs
   say Parse for compatibility reasons unrelated to what the thing is.
7. **The join is invisible.** That a `call-function` step passes the run payload and `previous` into
   the function's Request node is discoverable only by reading engine source.

## Scope

**In scope**
- Canvas identity: what am I editing, where does it live, what runs it.
- Picker orientation: why this canvas has these nodes, and where the other ones are.
- The naming question, explicitly including whether "cloud function" and "workflow" survive.
- First-run: what a new workflow and a new cloud function are born as, and what their empty states
  say.
- The trigger surface: where triggers live and how you reach them from the canvas.
- Making the join legible: what a step actually hands to a function.
- User-facing docs derived from the canonical model page.

**Out of scope**
- Changing the architecture. The split is deliberate and defended in the model page.
- The capability gaps — those are phase 42's CWF track and TALK-007 (arrays in cloud functions).

## Inputs

- [BACKEND-AUTHORING-MODEL.md](../../reference/BACKEND-AUTHORING-MODEL.md) — canonical, written first
- [CWF-006](../phase-42-first-hour/CWF-006-TRIGGERS-AND-THE-ENTRY-STEP.md) — the affordance task
  scoped before this phase existed. **Its two items are a subset of this phase**; keep it as the
  cheap immediate fix and let this phase supersede it if it lands first.
- [TALK-001](../phase-42-first-hour/TALK-001-THE-CLOUD-WORKFLOW-AUDIT.md) — the conversation that
  exposed the problem, including the two decisions reversed by it.

## The measure of success

A person who has never seen the product opens a workflow canvas and a cloud function canvas and can
say, without asking anyone: what each one is, why the node lists differ, where the thing they are
editing is stored, and which one to reach for next. Test it on someone who wasn't in the room.
