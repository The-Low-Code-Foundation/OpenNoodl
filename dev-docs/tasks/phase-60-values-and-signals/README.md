# Phase 60 — Values flow, signals fire (Track SIG)

**Created:** 2026-08-09
**Status:** 📋 specced, not started. Tasks are **[TASKS.md](TASKS.md)** (SIG-001…007).
**Origin:** Richard, 2026-08-09, watching a new user's feedback — and recognising his own first week
in Noodl:

> *"You see 'Done' and you think ok I'll hook that up to one of the signal inputs of the button,
> thinking that will transfer the VALUE along with the SIGNAL from Done. In the mental model, 'it's
> done, so it should send the value with the signal'."*
>
> *"On the other edge of that sword, the user was worried and confused when they wanted to set the
> button label and they didn't see a 'Set' signal input, because they're not aware that NodeGX value
> connections automatically transfer their value without needing a signal."*

**Every claim about existing code in this phase's files was read in source on 2026-08-09.** Anything
that could not be read is marked ⚠️ **unverified** and must be confirmed before the task depending on
it is worked. Keep both rules for anything added.

## The premise, in one sentence

**A wire has a kind and a direction, and the editor draws neither in a form a beginner can read** —
so the same user asks two opposite questions in one sitting: *why won't my value go down a signal?*
and *why is there no signal to set my value?*

Both questions have answers. The editor computes one of them, in full, and then deletes it before
anything renders.

## What is actually on disk

| The complaint | What exists | Where |
|---|---|---|
| "I tried to wire a value into a signal and nothing happened" | The popup **computes the exact refusal sentence** — *"Type mismatch, a source port of type **string** cannot be connected to a target port with type **signal**"* — writes it to `p.message`, then drops the port from the list one loop later | [`ConnectionBar.tsx:139-170`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L139-L170) |
| "…so I couldn't tell if I was wrong or the editor was broken" | `PortItem` **renders `port.message` as a tooltip**, and the row has a full `disabled` visual state | [`PortItem.tsx:29-39`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L29-L39), [`:76`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L76), [`ConnectionPopup.module.scss:101-107`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss#L101) |
| "the Text output is under Other, not Values" | An ungrouped port falls to `Other` — and on **every Variable node** `Value`, `Set`, `Value` (out) and `Changed` all declare no group at all | [`ConnectionBar.tsx:176`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L176), [`variablebase.ts:130-219`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L130-L219) |
| "the connector ends are small and hard to tell apart" | On the **wire**, both ends are the *same* 3px circle. There is no arrowhead anywhere on a finished connection | [`NodeGraphEditorConnection.ts:636-645`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L636-L645) |
| "a pulse that travels down the wire would teach this" | **It is built.** A travelling dash with an animated `lineDashOffset`, enabled by default, driven by the running viewer | [`NodeGraphEditorConnection.ts:647-656`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L647-L656), [`debuginspector.js:18`](../../../packages/noodl-editor/src/editor/src/utils/debuginspector.js#L18) |

**So this phase is mostly unhiding, renaming and one honest sentence — not new machinery.** Three of
its seven tasks connect two halves that already exist and have never met.

## ⚠️ Four premise corrections, made before any copy is written

These are the claims a reasonable person would write into this phase, and each one is wrong.

### 1. "Signals don't carry values" is **not** the rule

The cast table allows **`boolean → signal`**, and allows `signal → boolean` and `signal → number`
([`nodelibraryexport.ts:207-240`](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L207)).
The popup then layers a *stricter* rule on top that the table does not have — a signal output reaches
only a signal input — so the editor and the table disagree about `signal → number` and the editor
wins ([`ConnectionBar.tsx:153-162`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L153), documented as
`isBlockedBySignalRule` in [`portTypes.ts:45-53`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/portTypes.ts#L45-L53), whose
docstring already uses `Done` as its worked example).

Any copy asserting "a signal never carries a value" is a falsehood a builder will find within a week,
and it would be the only place the behaviour is written down — the NDA-017 shape, where a port
description described a trap as if it were a feature. **The honest framing is that a signal is a
*moment*, and only a boolean has an unambiguous moment in it: the flip to true.**

### 2. The arrow the user is squinting at is a **direction cue, and it is correct**

The report was *"the circle and arrow ends… hard to tell apart to know which direction the connector
is going"*. Read in source, the glyphs are on the **node**, not the wire:

- `dot()` — radius **3.5** ("mock: flat 7px port dots"), painted when `leftIcon`/`rightIcon === 'from'`
- `arrow()` — a triangle **8px wide, 8px tall** (`dx = ±4`, `ty ± 4`), painted for `'to'` or `'both'`

([`NodeGraphEditorNodePainter.ts:394-413`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L394-L413), selected at
[`:471-475`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L471) and [`:498-502`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts#L498).)

**Dot = it leaves here. Arrow = it arrives here.** That is exactly the information he wanted. It fails
because a 7px disc and an 8px triangle in the *same colour* are one pixel apart in size and
indistinguishable at any zoom below 100% — not because the cue is missing. ⚠️ Note `'both'` also
paints an arrow, so "arrow" does not strictly mean input.

### 3. The only wire that shows its direction is the one that doesn't exist yet

The **drag** line draws a circle at the source and a real arrowhead at the target
([`CanvasRenderer.ts:231-240`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasRenderer.ts#L231-L240)). The moment you drop
it, that arrowhead is replaced by a second identical circle and the direction information is
discarded. The editor already knows how to draw the thing SIG-006 asks for, in the same painter, one
interaction earlier.

### 4. A generic sentence on every signal port must **not** go in `description`

`PORT-DESCRIPTION-STYLE.md` is normative and explicit: `description` is *one plain sentence* read by
**the node catalog, the semantic validator and the AI authoring loop**; `tooltip` is HTML for the
property panel. **Two documents for two readers.**

Richard's ask — *"write something in the port description… on every signal port"* — is right about the
reader and wrong about the field. Pasting one sentence into several hundred `description` fields would
ship it into the catalog and be re-paid on every `get_node_type` call, and `get_node_type` on `Group`
already costs 11k tokens. **A sentence that is true of every port of a type belongs at the render seam,
not in the data.** [`DocsPopup.tsx:58-59`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/DocsPopup.tsx#L58-L59)
already prints the type as `(signal)` in the popup header — one line, every node, cannot drift. That
is SIG-004.

## The two halves

**What a wire means** — SIG-001 to SIG-004. The refusal, the affirmation, the headings, the sentence.
**What a wire looks like** — SIG-005 to SIG-007. The pulse, the direction, the routing.

They share one painter and one popup, and the first half is where the reported pain is. Do not start
at SIG-006 because it is the most fun.

## Standing constraints

- ⚠️ **`opacity` cannot express de-emphasis and stay legible.** BLD-005 swept it on real composited
  pixels: every value that reads as dimmed fails AA in light mode, and the first that passes in both
  (0.85) is too subtle to read as dimmed. **Light mode is the binding constraint.** This bites SIG-001
  immediately — [`ConnectionPopup.module.scss:104-106`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss#L104)
  already dims the signal icon to `opacity: 0.3` on a disabled row, and SIG-001 is about to make that
  row visible for the first time. Measure it before shipping it.
- **Red is danger only** (phase 23). A refused connection is not an error the builder made; it is a
  category the editor is explaining. Do not paint it red.
- **The canvas is Canvas2D and stays Canvas2D.** No port hit-testing exists today — relevant to
  SIG-006 and SIG-007, both of which want to know which glyph the pointer is near.
- **Wire colour is already carrying four meanings** — type, health, debug pulse and diff annotation —
  and `NodeGraphEditorConnection.ts:625-627` refuses to make selection the fifth, using stroke weight
  instead. **Every task here that wants to say something new on a wire must say it in shape, weight or
  motion, not colour.**
- ⚠️ **`portIcons.ts` is imported by nothing.** A full `PORT_ICONS` table with a `⚡` for signal and a
  `drawPortIcon` helper, dead on disk. Read it before writing a new one — and delete it, or use it, but
  do not let a third glyph vocabulary start.

## What this phase does not do

- It does not add a `Set` signal to value ports. The second complaint is a **missing affirmation**, not
  a missing feature — the answer is one sentence saying the wire is already live (SIG-002).
- It does not change `canCastPortTypes` or the signal rule. The rule is defensible; it is undocumented
  and invisible, which is a different problem.
- It does not touch the property panel's `tooltip` channel. See correction 4.
