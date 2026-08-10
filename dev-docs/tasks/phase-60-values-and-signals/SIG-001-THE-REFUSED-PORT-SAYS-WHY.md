# SIG-001 — The refused port says why

**Status:** ✅ **closed 2026-08-11** · **Track SIG** · ⭐ **flagship**

> **Built and driven.** The refusal renders, states its category on its face, and
> connects the wire the builder meant. Six defects were found by driving it that
> no gate could have expressed — four of them in this task's own first build, and
> two of them in the spec below. See the Register.

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

All driven on `Puppy test 3` → `/Pages/Admin Login`, over CDP, 2026-08-11.
⚠️ **Button was the wrong node for the flagship** — it has no signal *inputs* at all, so a String
dragged at it refuses only `Font Family` and `Icon Source`. The scenario the phase describes needs a
**Text Input** (103 ports, four signal inputs: `Set`, `Clear`, `Focus`, `Blur`).

- [x] Dragging a String output onto a node with signal inputs, the signal inputs are **represented** —
      not absent. `4 signal inputs · a moment, not a value`, expanding to `Set`/`Clear`/`Focus`/`Blur`,
      each with its lightning glyph. Screenshotted in both themes.
- [x] The reason is legible **without hovering** and without waiting 1000ms — it is a row, not a
      tooltip. ⚠️ The 1000ms `PopupLayer` tooltip turned out to be a **third** never-rendered half
      (see Register #3) and is gone; its type-naming sentence moved into the port explainer.
- [x] Every text and glyph on a refused row measures ≥ 4.5:1, **on composited pixels**, both themes.
      Table below.
- [x] Clicking the refusal connects to a value input instead: `usernameInput.onTextChanged ->
      passwordInput.label`, which is the wire a builder would have drawn. ⚠️ It did **not**, in the
      first build — Register #2.
- [x] With a source that can reach nothing (a Button's `Click` at a `Text` node), the popup says
      *"Nothing on this node takes a **signal**."* and offers no redirect. `actionable: false`.
- [x] A node with 97 refused ports still shows its connectable ones without scrolling past a grey
      wall: **1 summary row, 4 connectable rows**. ⚠️ It was **19 summary rows** before Register #4.
- [x] ⚠️ The copy does not assert that signals never carry values, and a Boolean output into a signal
      input is still `connectable: true` (`usernameInput.focusState` → `passwordInput.focus`, measured
      live). A spec sweeps every string this phase can emit against the forbidden phrasings.

### Contrast, composited pixels (`sharp`, sampled from CDP screenshots at dpr 2)

Method: crop the element's rect, take the modal colour as the background and the pixel furthest from
it in luminance as the glyph at full coverage. fg/bg printed with every ratio.

| Element | Dark fg/bg | Ratio | Light fg/bg | Ratio |
|---|---|---|---|---|
| Offer sentence | `#eef2f6` / `#181d23` | **15.07** | `#18212b` / `#f8f9fb` | **15.44** |
| Offer, bolded port name | `#eef2f6` / `#181d23` | **15.07** | `#18212b` / `#f8f9fb` | **15.44** |
| Refused summary row | `#cbd3dc` / `#181d23` | **11.21** | `#2e3945` / `#f8f9fb` | **11.15** |
| Refused summary, hovered | `#eef2f6` / `#212933` | **13.06** | `#18212b` / `#ecf0f4` | **14.20** |
| Refused port row | `#cbd3dc` / `#181d23` | **11.21** | `#2e3945` / `#f8f9fb` | **11.15** |
| Refused signal glyph | `#a6b0bb` / `#181d23` | **7.71** | `#4b5663` / `#f8f9fb` | **7.09** |
| *(control)* ordinary enabled row | `#b0b9c2` / `#213349` | 6.46 | `#515c68` / `#d5e5f7` | 5.32 |

**The refused row is more legible than an ordinary one** (11.15 vs 5.32 in light), because enabled
rows carry `.listElementPort { opacity: 0.7 }` and refused rows opt out of it. That is the intended
outcome of the phase's standing constraint, not an accident: the row this task made visible for the
first time is the one row in the list that was never allowed to be dimmed.

⚠️ **The first contrast pass measured the editor's title bar.** The QA harness had called
`scrollIntoView` on the expanded group, pushing the offer out of the popup's scroll viewport, and a
rect at `y ≈ 2` is not the element it claims to be — it returned `#fdb122`, which is the ⚠2 warning
badge in the toolbar. Every rect is now clipped to the popup's own scroll box and *dropped* if it
does not survive. See [[measure-the-element-you-claim-about]].

## Register

| # | Finding | State |
|---|---|---|
| 1 | ⚠️ **The spec's own worked copy is the falsehood the spec forbids.** §2 offers *"4 signal inputs · signals carry no value"* as the summary wording; §"The copy cannot say" forbids exactly that, because `boolean → signal` is in the cast table. Shipped as **"a moment, not a value"**, and a spec now sweeps every string the module can emit against the forbidden phrasings. | ✅ copy corrected, guarded |
| 2 | 🔴 **The offer promised a wire it did not draw.** Built as specced — connect when there is exactly one candidate, scroll otherwise — but the *copy* said "connect it to **Label** instead" in both branches. On a Text Input (90-odd candidates) clicking it scrolled and drew nothing. `isConfidentRedirect` now decides the verb **and** the behaviour, so they cannot disagree: confident (the node's declared primary port, or a unique exact-type match) connects and says "connect it to X"; otherwise it says "pick a value input below" and is inert. | ✅ fixed, 5 specs |
| 3 | ⚠️ **A third never-rendered half.** `PortItem` opened a `PopupLayer` tooltip after a 1000ms hover on `port.message` — and `message` is only ever set on a refused port, which this task is the first thing to render. So the tooltip had fired exactly as often as the disabled row style: never. Reviving it as written would have put two floating boxes under one pointer; folded into the port explainer instead. | ✅ folded in |
| 4 | 🔴 **The grey wall came back as summary rows.** One refused line per group is right for a mixed group and catastrophic when every group is refused: a **signal** output at a Text Input produced **19 identical** *"N value inputs · a signal is a moment, not a value"* rows above the 4 ports that work. Groups with nothing connectable now fold into **one** block (`RefusedPorts`), which is also where the group headings go. 19 → 1. | ✅ fixed, driven |
| 5 | 🔴 **`groupPriority` is a display order, not a ranking.** Specced as "exact type, then group priority", the redirect for a String at a Button answered **Variant** — `string` in `General` (priority 0) beating `Label`, `string` in `Label` (priority 6). Correct by the rule and wrong to every human. The library already records which port a node is *about*: `usePortAsLabel` (35 node types: `label`, `text`, `collectionName`, `url`, `expression`…). Added as a rank key **below** exact-type, so it cannot hand a `color` output to a label. | ✅ fixed, 3 specs |
| 6 | ⚠️ **The offer named a port identifier the builder has never seen.** A Text Input's string output is *named* `onTextChanged` and *displayed* as **Text**; the offer read "onTextChanged is already live" about a row the builder had just clicked labelled "Text". Now uses `displayName`. | ✅ fixed |
| 7 | ⚠️ **Button has no signal inputs**, so it cannot host this task's own worked example. Recorded because the phase README, TASKS and this file all use "drop on a Button" as the canonical scenario, and a session that drives it will measure a feature that is working and conclude it is not. | 📋 recorded |
| 8 | ⚠️ **`getConnectionStatus` had to gain a reason code.** The popup cannot recover the *category* of a refusal from an English sentence. `reason` is a plain `string` on the model (a view's vocabulary has no business in a model) and is narrowed at the popup boundary by `asRefusalReason`, so `WorkflowGraphModel`'s three refusals of its own render as "refused, and I am not going to guess why" rather than as a confident wrong category. | ✅ built |
| 9 | ⚠️ **The explicit return type on `getConnectionStatus` is load-bearing.** Without it TypeScript infers the union of its literals, and `WorkflowGraphModel` — which overrides it — stopped being assignable to its own base class the moment either side grew a field. It did, immediately. | ✅ built |
