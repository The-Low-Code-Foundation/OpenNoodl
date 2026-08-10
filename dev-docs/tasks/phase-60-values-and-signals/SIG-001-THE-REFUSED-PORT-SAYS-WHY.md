# SIG-001 — The refused port says why

**Status:** 📋 open · **Track SIG** · ⭐ **flagship**

> The editor already writes the sentence this user needed. It writes it into `p.message`, and seven
> lines later deletes the row that would have shown it.

## The moment

Drag from a String output. Drop on a Button. The signal inputs you were reaching for **are not in the
list**. Not greyed, not annotated — absent.

Absence is unattributable. There is no way to tell *"the editor is protecting me from a category
error"* apart from *"I clicked the wrong thing"* or *"this tool can't do that"*. Both of the users this
phase is named for concluded the second.

## What is on disk

**The refusal is computed, with prose, for every port.**
[`ConnectionBar.tsx:139-163`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L139-L163) asks
`getConnectionStatus` for each target port and stores both a flag and an explanation:

```ts
p.disabled = !status.connectable;
p.message = status.message;   // "Type mismatch a source port of type <strong>string</strong>
                              //  cannot be connected to a target port with type <strong>signal</strong>."
```

**The row that displays it is fully built.**
[`PortItem.tsx:29-39`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L29-L39) renders
`props.port.message` as an anchored tooltip after a 1000ms hover.
[`:76`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L76) has a three-way `state`
with a `'disabled'` case. [`ConnectionPopup.module.scss:101-107`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss#L101)
styles `.listElement.disabled` — including dimming the lightning glyph.

**And the list never passes one.**
[`ConnectionBar.tsx:170`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L170), inside
the grouping loop:

```ts
ports.forEach((p) => {
  if (p.disabled) return;      // <- the message dies here
```

**Both halves exist. They have never met.** The `message` written at `:151` and `:161` can only be
displayed by a `PortItem` that is never constructed, and the `disabled` style is unreachable from the
list that owns the component.

## ⚠️ The copy cannot say "signals don't carry values"

See [README §correction 1](README.md). The cast table allows `boolean → signal`. A builder who reads
"signals never carry a value" and then successfully wires a Boolean into one has caught us teaching a
falsehood, and this popup would be the only place the behaviour is written down.

**Say what a signal *is*, not what it lacks:** a signal is a **moment**. A value is a **standing
state**. Only a boolean has an unambiguous moment in it — the flip to true — which is why it is the one
value type that may cross.

## Build

1. **Stop deleting the row.** Disabled ports enter `groups` and render. The `if (p.disabled) return;`
   at `:170` becomes a render, not a `continue`.
2. **Do not bury the connectable ports.** A node like Text Input has dozens of ports and most of them
   will be refused by any given source. Refused ports **collapse into one footer row per group** —
   *"4 signal inputs · signals carry no value"* — expandable, closed by default. ⚠️ The whole point of
   this task is that the beginner sees the category exists; it is not that they read forty grey lines.
3. **The reason is visible without a 1000ms hover.** The existing tooltip stays for the full sentence,
   but the collapsed footer row states the category on its face. A beginner who does not know a
   tooltip is there will not wait a second on a greyed row to find out.
4. **Rewrite `getConnectionStatus`'s message for a human.** The current string names two type
   identifiers and the word "cast". It is a correct sentence for someone who already understands the
   answer. Replace with, for a value → signal attempt:
   > **Signal inputs are moments, not values.** `Text` is already live — connect it to a value input
   > like **Label** and it updates by itself.

   ⚠️ Keep the type names available (the tooltip, or a second line) — they are what makes the message
   useful to someone debugging a custom module's port types.
5. **Offer the wire they meant.** The collapsed row, and each refused port, is **clickable** and
   connects to the best-matching value input instead. This is the step that converts a dead end into
   the lesson: the builder learns the rule *and* gets the connection.
   - "Best matching" = the target's ports that `canCastPortTypes` accepts from this source, ranked by
     exact type match, then by group priority. If there is exactly one, offer it by name; if there are
     several, scroll the list to them rather than guessing.
   - ⚠️ If there are **none**, say so plainly and offer nothing. A redirect that connects something
     arbitrary is worse than the current silence.

## ⚠️ The trap this task walks into

[`ConnectionPopup.module.scss:104-106`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/ConnectionPopup.module.scss#L104)
dims the signal glyph on a disabled row to **`opacity: 0.3`**, and the row text to
`--theme-color-fg-disabled`. Both were written for a state **that has never rendered**, so neither has
ever been measured against a real backdrop.

BLD-005 swept exactly this and found *no* opacity that both reads as dimmed and clears AA in light
mode. **Measure the composited pixels in both themes before shipping**, and if the answer is that a
refused row cannot be both legible and quiet, make it legible — a row nobody can read is not a quieter
row, it is the absence this task exists to fix, with extra steps.

## Acceptance

- [ ] Dragging a String output onto a Button, the signal inputs are **represented** in the popup —
      not absent. Screenshotted, both themes.
- [ ] The reason is legible **without hovering** and without waiting 1000ms.
- [ ] Every text and glyph on a refused row measures ≥ 4.5:1 against the surface it actually paints
      on, **in light mode**, on composited pixels. Table in the task's Register, not a claim.
- [ ] Clicking the refusal connects to a value input instead, and the resulting wire is the one a
      builder would have drawn by hand.
- [ ] With a source whose type can reach **nothing** on the target, the popup says so and offers no
      redirect.
- [ ] A node with 40+ refused ports still shows its connectable ones without scrolling past a grey
      wall. Driven on a real node, counted.
- [ ] ⚠️ The copy does not assert that signals never carry values. Wire a Boolean output into a signal
      input as a live check that the sentence shipped is still true.

## Register

| # | Finding | State |
|---|---|---|
| | | |
