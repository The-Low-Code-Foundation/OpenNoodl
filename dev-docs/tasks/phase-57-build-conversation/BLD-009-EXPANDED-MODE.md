# BLD-009 — Expanded mode: the same thread, two hosts

**Status:** 📋 not started · **Track A** · after BLD-003, BLD-005 · closes **D10**

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

## Acceptance

- [ ] The same conversation renders in both hosts, from one component, with no forked markup
      (`grep` shows one thread component).
- [ ] Expand mid-run: the run continues, the thread keeps its scroll position, nothing restarts.
- [ ] In expanded mode there is exactly one Accept on screen — the BLD-003 rule, verified in the
      host that made it easy.
- [ ] At 400px, POL-007's rules still hold with BLD-005's added sub-line: no horizontal scroll,
      headline never lost to the left.
- [ ] Both themes, both hosts, screenshotted.

## Register

| # | Finding | State |
|---|---|---|
| | | |
