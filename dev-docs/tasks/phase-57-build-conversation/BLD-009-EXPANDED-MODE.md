# BLD-009 — Expanded mode: the same thread, two hosts

**Status:** ✅ **built and driven** 2026-08-10 (session 18) · **Track A** · after BLD-003, BLD-005 · closes **D10**

## The defect, measured

A twenty-minute build across seven components, with a plan, a live preview and a conversation, is not
a 400px object. The stylesheet already fought this and won a narrow victory
([AiAuthoringPanel.module.scss:18-32](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.module.scss#L18)):

> *"POL-007 — the Build panel fits inside the Build panel. … An operation row put status, target,
> elapsed and two ungrowing, unshrinking buttons on one flex line … the row's min-content exceeded
> the panel. Nothing established `overflow-x`, so the excess scrolled the whole panel sideways and
> took the run headline off screen to the left."*

**That fix is correct and stays.** It is also a symptom: the surface is wrong for the job, not just
the layout. A quick "change this component" *is* a 400px object, so moving everything out of the
sidebar would be a downgrade.

## Build

1. **One `BuildThread`, two hosts.** The `width` variant introduced in BLD-001 is the whole
   mechanism: `panel` (400px, activity collapsed, compact run map) and `expanded`.
   **No second implementation. No forked component.** A layout that has to respond to width cannot
   be expressed as two components that drift.
2. **Expanded is a document**, in the surface the preview already occupies — thread on the left
   (~520px), live preview on the right, using the existing `FrameDivider` split that
   `AuthoringPreviewDocument` already sets up
   ([AuthoringPreviewDocument.tsx:206+](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/AuthoringPreviewDocument.tsx#L206)).
3. **This is where BLD-003's one-owner rule becomes trivial.** In expanded mode one surface shows
   both the thread and the candidate, so there is exactly one action bar and nothing to suppress.
   That is why this task depends on BLD-003 and not the reverse.
4. **Expanding and collapsing preserves the thread**, scroll position included. A run in flight is
   not interrupted by changing host — the thread is a view over a store (BLD-006), not the owner of
   the run.
5. **Offer expansion at the moment it helps**, not as a permanent control shouting for attention: a
   quiet control in the header always, and a one-time inline suggestion the first time a plan has
   more than ~3 operations.

## ⚠️ Traps

- **Closing a webview CDP target white-screens the editor** (POL-010/012 fifth session). The preview
  is a webview; driving this live needs the same care.
- **HMR will not reach a mounted panel.** Verifying expanded mode means a real reload, not a hot
  update — a change that "did nothing" is often a change that never arrived.
- The document surface and the panel are registered separately; make sure only one thread instance is
  *live* at a time, or two subscriptions will both drive the same store and the activity feed will
  double.

## How it was built — one instance, two containers

The obvious build satisfies "one component" and breaks the task: mounting `AiAuthoringPanel` a
second time inside the document gives you two sets of `useState`, two `AuthoringSession` refs and two
subscriptions — which is the doubled activity feed the trap below warns about, and which makes
*"expand mid-run, nothing restarts"* **unsatisfiable rather than merely unbuilt.**

So the panel is never mounted twice. `SidePanel` keeps every visited panel mounted behind
`display: none`, so the Build panel's instance — session, run, composer text and all — is alive
whichever document is on screen. `ExpandedBuildDocument` is a **shell**: a top bar and an empty box,
published through `expandedBuildHost`, and the panel paints itself into it with `createPortal`.
Expanding changes *where the component renders*, not *whether it exists*.

Expanded-ness is therefore never stored: it is
`CurrentDocumentId === ExpandedBuildDocumentProvider.ID`, derived on both sides through
`threadHost()`, on the `documentChanged` subscription `decisionOwner` already had.

## Acceptance

- [x] The same conversation renders in both hosts, from one component, with no forked markup —
      **`grep` finds exactly one `<BuildThread` call site in the repo**, and the DOM holds
      **one `.Thread` in both hosts** (measured in each).
- [x] Expand mid-run: the thread keeps its scroll position, nothing restarts — **`scrollTop` 640
      preserved across the round trip**, 14 turns before and after, one instance throughout, and a
      half-typed composer string survived the move. ⚠️ **"A run continues" was driven for the
      *thread*, not for a live provider run** — that needs a billed call, filed to BLD-010.
- [x] At 400px, POL-007's rules still hold — **swept 248 → 800px with the new offer row present:
      `scrollWidth − clientWidth` is 0 for the thread, the body, the header, the control row and
      `document.body` at every width.**
- [x] Both themes, both hosts, screenshotted; every text role measured with its `fg`/`bg` printed.
- [~] **Exactly one Accept in expanded mode** — the *mechanism* is verified (the expanded document
      is not one of `decisionOwner`'s candidate ids, so the thread owns; `AuthoringCandidatePane`
      contains **zero** controls by grep; zero decision buttons on screen). **The state itself — a
      live staged candidate — needs a billed run and is filed to BLD-010.**

## Register

| # | Finding | State |
|---|---|---|
| R1 | 🔴 **The wide workspace was narrower than the panel it replaced.** A document sits *beside* the sidebar, so expanding left the rail holding 452px: on a 1368px window the candidate pane got **396px**, less than the 400px panel the task exists to escape. Expanding now calls a new `layout.hideIfShown()` (the caller's verb, mirroring `openFull` against `toggleFull` — and wired to the `hide` the divider's collapse floor already used). | ✅ fixed |
| R2 | 🔴 **The reveal was hung off the Collapse button, and most exits do not use it.** Accept switches the canvas to the component it just wrote; Review changes opens the diff. Either would have left the sidebar hidden *and* the expanded document gone — the thread mounted, alive, holding the run, and on screen **nowhere**. The reveal is now keyed on the derived host leaving `document`, so every exit is one exit. Driven: expanded, clicked another rail icon, rail restored to 332px with the thread mounted behind it. | ✅ fixed |
| R3 | ⚠️ **The offer was 113px tall at the shipped 400px** — three rows for one dismissible strip. `flex-wrap` wraps a line *before* it shrinks the items on it, so a `flex: 1 1 auto` paragraph claimed the whole line and pushed a 14px icon onto one of its own. Grouped icon+sentence into one flex item: **113 → 91px**. | ✅ fixed |
| R4 | 🔴 **A first width sweep reported 0 overflow everywhere and measured nothing** — it set `style.width` on an element that does not size the panel, and `actualThread` stayed **364px at every asked width**. The panel is sized by a CSS custom property on the `FrameDivider` root. Re-swept against that variable: 212 → 764px, genuinely resized, 0 overflow. *A sweep that does not move the element is a green result about nothing.* | ✅ re-measured |
| R5 | ⚠️ **The first contrast probe walked past the dismiss button's own background**, reading the box behind the control instead of the ground under its text. `bgOf` must start at the element itself. Corrected: **6.54 light** on `bg-3`, not 7.10. | ✅ re-measured |
| R6 | 🔴 **AIB-003's saved plan is never restored — found while driving this task, and it is NOT BLD-009's.** See the section below. | 📋 filed, not fixed |

## 🔴 R6 — a saved build no longer comes back, and it is BLD-001's blast radius

Confirmed three ways:

1. **Statically** — `ProjectAuthoringView` has exactly **one** mount site
   ([AiAuthoringPanel.tsx](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx)),
   gated on `turn.id.startsWith('plan-')`. A plan turn exists only when `planSession.plan` is
   non-null. The effect that reads `.nodegx/plan/session.json` lives **inside that view**. So the
   only thing that can restore a plan is a component that only mounts once a plan is restored.
2. **Empirically** — a valid six-operation snapshot written to
   `<project>/.nodegx/plan/session.json`, then a full stack restart: the panel shows no plan, no
   plan turn, and the word "checkout" appears nowhere in the document.
3. **The fixture is not the problem** — run through the shipped `parsePlanSessionSnapshot` in a
   plain-Node harness, it parses and reports its 6 operations.

This is **exactly the shape BLD-001 recorded as B6** — *"moving WHEN a component mounts changes the
meaning of code that was correct about WHAT it renders"* — one instance later. B6 fixed the AIX-012
*launcher* handover by hoisting it to `adoptScopePlan` in the panel; the **sidecar restore, and the
`docs/decisions/000-initial-scope.md` recovery offer beside it, were left behind in the same effect.**

**Deliberately not fixed here.** Hoisting the restore is mechanical, but the *other* half of that
effect renders an **offer** (`recovered`), and deciding where a second offer lives — beside BLD-009's
own, in the one `notice` slot — is a design decision belonging to AIB-003, not to this task. Fixing
half would make the remaining half *permanently* dead rather than conditionally dead, because the
panel's `consultSavedBuild` would answer first every time.
