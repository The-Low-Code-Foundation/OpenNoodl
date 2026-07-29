# NDA-008: Component Stack — one node, two modes, both animated

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-008 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — "great idea but fucked up execution" |
| **Difficulty** | 🟠 Medium–High — 894 lines, and one symptom has no located cause |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | **§0 must complete before the rest is specced** |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Make "replace the component" and "stack the components" the same mechanism with a mode switch, so both
can animate — and stop the scroll jump that makes the node unusable as a tab system.

## §0 — RESOLVED 2026-07-29. The Component Stack does not scroll; re-scope §1/§2

This is the "fine outcome" the Risks section anticipated: the cause is real, located, and **in a
different file**. Candidate 1 (browser focus restoration) was right about the mechanism and wrong
about who triggers it.

**The stack is innocent, measured not argued.** With a Page Stack inside a page taller than the
viewport (header bar, a 1400px spacer, then the stack), scrolled to `scrollTop = 1200` so the
header is off-screen, switching components moved the scroll position by **zero pixels** and called
`HTMLElement.prototype.focus` **zero times** — verified by patching `focus` and counting. All four
configurations behave identically: `navigate` with a Push transition, `replace`, and `useRoutes`
both on and off. Nothing in `navigation-stack.tsx` scrolls, directly or by consequence.

**The scroll trap is the viewer's app root.** In the default (non-`bodyScroll`) branch,
[`viewer.jsx:344-353`](../../../packages/noodl-viewer-react/src/viewer.jsx#L344-L353) renders the
entire app inside

```jsx
<div style={{ margin: 0, padding: 0, overflow: 'hidden', width: '100%', height: '100%' }}>
```

That div is pinned to the viewport (663px measured) and holds content taller than itself (2337px
measured). `overflow: hidden` **does not stop the browser scrolling it** — it only stops the *user*.
So a programmatic scroll moves the page and there is no scrollbar, no wheel, and no key that brings
it back. That is precisely "you might end up triggering a scroll and not seeing the header bar
anymore": not a scroll that is merely unwanted, a scroll that is **one-way**.

**The trigger is any real DOM focus.** Measured on that container: `element.focus()` moved it
`0 → 1169`; `element.focus({ preventScroll: true })` moved it `0 → 0`. The only node in the library
that performs a DOM focus is `TextInput` —
[`text-input.ts:211-214`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L211-L214)
— reached two ways: its own `Focus` input
([`:132`](../../../packages/noodl-viewer-react/src/nodes/controls/text-input.ts#L132)), and Noodl's
click-capture focus system
([`viewer.jsx:293-310`](../../../packages/noodl-viewer-react/src/viewer.jsx#L293-L310)), which walks
up from every click target and calls `_focus()` on each ancestor node that defines one. `Group._focus`
only emits a signal ([`group.ts:399-404`](../../../packages/noodl-viewer-react/src/nodes/visual/group.ts#L399-L404)),
so Groups are not implicated; the deprecated TextInput is, identically.

This explains why the symptom looks intermittent and content-dependent: it needs a focusable field
somewhere in the page and a page taller than the viewport. It has nothing to do with how many
components are in the stack.

**Consequences for this task:**

- Criterion 1 is met and criterion 3 is no longer this task's to prove — nothing in the stack moves
  the scroll position. §1 (unify the modes) and §3 (report failures) stand unchanged; **§2's first
  bullet moves out.**
- The candidate fix is `focus({ preventScroll: true })` in `text-input.ts`, and it is measured to
  work. It is **not** applied here, because it is not obviously right on its own: in a genuinely
  scrollable container an author who fires `Focus` on an off-screen field reasonably expects it to
  be scrolled into view. The honest fix is probably to stop the app root being a hidden-overflow
  box that overflows at all, or to make the scroll-into-view conditional on the container being
  user-scrollable. That is a decision about the viewer's layout root, not about the Component
  Stack — file it against the viewer, and get a call from Richard on which behaviour he wants.

## §0 — Reproduce the scroll jump first (blocking) — original brief, superseded

Richard: "when switching components, it does an unnecessary scroll-to-component thing, so if you use
it as a sort of internal tab system you might end up triggering a scroll and not seeing the header bar
anymore."

**There is no `scrollIntoView` or `scrollTo` anywhere in
[`navigation-stack.tsx`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx).**
Whatever causes it is somewhere else. Candidates, in order of likelihood:

1. **Browser focus restoration.** Mounting a component containing a focusable element and focusing it
   scrolls it into view automatically. This is the most likely cause and would explain why it depends
   on the content.
2. The router or `Page` mount path — check `router.tsx` and `page.ts` for scroll restoration.
3. A CSS anchor/`:target` interaction, or `scroll-behavior` on an ancestor.

Reproduce it in the running editor with the `run-editor` skill, and **do not spec a fix until the
cause is located** — the current guess would put the fix in the wrong file. ⚠️ `--target=editor`
attaches to the preview window; use `--target=dashboard`.

If the cause turns out to be focus restoration, the fix is `preventScroll: true` on the focus call, or
not auto-focusing at all — a very small change in a file this task otherwise does not touch.

## §1 — Unify the two modes

Transitions are constructed only on the stack path
([`navigation-stack.tsx:717-765`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L717-L765)):

```ts
transition: new Transitions[args.transition.type || 'Push'](top.page, group, args.transition)
```

so "replace" has no animation surface at all. That is the split Richard describes as sad: you pick
your semantics and the animation capability comes bundled with the choice, rather than being an
independent axis.

The target model: **one mechanism, two policies.** "Replace" is "push, then drop the previous entry
once its exit transition completes". Both get the same transition machinery; the only difference is
whether the outgoing component stays in the stack afterwards.

Watch for: components that assume they stay mounted, and the memory behaviour of a stack that never
pops. Both modes must have a defined answer for what happens to the outgoing component's state.

## §2 — Make it honest as a tab system

Using this node as internal tabs is the common case and it is not what the node is designed for. Two
things follow from §0 and §1:

- ~~No scroll should occur on a switch unless the author asks for one.~~ **Moved out by §0** — no
  scroll occurs on a switch today. The scroll belongs to the viewer's layout root and to
  `TextInput`'s focus; see §0.
- Switching to an already-shown component should be a no-op, not a re-mount. Check the current
  behaviour; if it re-mounts, tab state is lost on every tab click, which would be a second reason the
  node feels wrong in this role.

## §3 — Report failures

`Pop Component Stack` is one of the ten mute nodes (signal in, no signal out) — see NDA-004. Popping
an empty stack, or targeting a component that does not exist, should be observable.

## Success criteria

1. ✅ §0 has a located cause, cited to file:line, before §1 begins — and it is not in this node.
   See §0 above: `viewer.jsx:344-353` (the hidden-overflow app root) plus `text-input.ts:211-214`
   (the only DOM focus in the library).
2. Both modes animate, with the same transition inputs.
3. Switching between two components in a scrolled page does not move the scroll position — verified
   live, with a header bar visible before and after.
4. Re-selecting the current component does not re-mount it.
5. Screenshot corpus unchanged for existing stack usage.

## Risks

- 894 lines with transition, routing and lifecycle concerns interleaved. Read it fully before editing;
  the file is a plausible candidate for its own decomposition, but that is not this task.
- §0 may find the cause is in `Page` or the router, in which case the fix belongs to a different file
  and possibly a different task. That is a fine outcome — record it and re-scope.
