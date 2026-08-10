# LGC-002 — "Do It": ask one block what it is

**Status:** 📋 open · **Track: the eyes** · prior art: MIT App Inventor, Scratch, Snap!

## The prior art, and why it changed our design

App Inventor's most-praised debugging feature: **right-click any block while a device is connected
and it executes immediately** — even outside an event — showing the returned value in a balloon
anchored to the block at a small equals sign, which you click to hide or show. Scratch and Snap! do
the same thing more cheaply: click a reporter block, get its value in a speech bubble.

The originating spec proposed **always-on badges on every block** — push. The loved implementations
are **pull**: the user asks one block *"what are you?"*.

Pull wins here for three reasons, and this task exists because of them:

1. **No trace session.** Push needs a run in flight and a relay client attached. Pull needs neither.
2. **No noise.** A program with forty blocks does not become forty numbers.
3. **It is a fraction of the work** — and it proves the same probe mechanism LGC-003 then scales up.

**Build this before LGC-003.**

## The seam

[`logic-builder.ts:418-429`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)
compiles the program with:

```js
new Function('Inputs','Outputs','Noodl','Variables','Objects','Arrays',
             'sendSignalOnOutput','__triggerSignal__', code)
```

**Add a ninth parameter and you have a probe channel.** That is the whole substrate for this task
and for LGC-003.

## §1 — Evaluate one block's subtree

Blockly generators return `[code, order]` for value blocks. To evaluate one block on demand:

1. generate code for **that block's subtree only** — `javascriptGenerator.blockToCode(block)`;
2. compile it with the same parameter list and the same context the node builds in
   `_createExecutionContext`, so `Inputs`, `Variables`, `Objects` and `Arrays` all resolve exactly
   as they would mid-run;
3. return the value to the editor and balloon it on the block.

⚠️ **Two things this must get right, and both are already documented in the code it touches:**

- **`Inputs` must be the live values, not defaults.** `_internal.inputValues` holds them. A Do It
  that evaluates against `undefined` inputs is worse than no Do It, because it answers confidently
  and wrongly.
- **Code generation lives in the editor and execution lives in the viewer.** This is the exact
  separation that made the previous dynamic-port implementation unreachable —
  [`logic-builder-io.ts`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder-io.ts)
  header, LEARNINGS-BLOCKLY §1. So Do It is: generate in the editor → send the fragment over the
  relay → compile and run in the viewer → send the value back. **Do not attempt to evaluate in the
  editor window**; nothing there has the node's inputs.

## §2 — Side effects, which App Inventor does not solve and we must

App Inventor's Do It runs the block **for real** — including its side effects — and that is
acceptable on a phone the user is watching. Ours can reach `Noodl.Variables`, `Noodl.Objects`,
`Noodl.Arrays` and `sendSignalOnOutput`.

**Rule: Do It is offered on value blocks, and refused on statement blocks that write.**

- A **value block** (has an output connection) is evaluated and ballooned. `1 + 2`, `Get input`,
  `Length of list` — all safe, all pure reads.
- A **statement block** — `Set output`, `Set variable`, `Send signal` — offers Do It **greyed, with
  the reason**: "This block changes things. Run the node to see it." Greyed-with-a-reason, not
  hidden, because a missing menu item teaches nothing.

⚠️ A value block *can* still call something impure if a user nests one. This rule is a strong
default, not a proof. Say so in the code comment rather than claiming safety the shape does not give.

## §3 — The balloon

Copy App Inventor's affordance rather than inventing one: a result balloon attached to the block,
with a small marker on the block that toggles it. It persists until dismissed or until the blocks
change, so a user can Do It on three blocks and compare.

Rendering: **imperative SVG overlay**, appended relative to `workspace.getBlockById(id).getSvgRoot()`.

⚠️ **It must not touch the workspace model.**
[`BlocklyWorkspace.tsx:29-38`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx)
reads `initialWorkspace` once and never reloads, and every settled edit is serialised through a
300 ms debounce. A balloon implemented as a Blockly comment would be **saved into the user's
program**.

Value formatting reuses the `previewValue` display dialect — it is a display language, not JSON, and
this repo has already been caught treating it as JSON once. Strings quoted, objects as `{3 keys}`,
arrays as `[12]`, `null` and `undefined` visually distinct.

## §4 — The failure balloon

If the fragment throws, the balloon shows the error, in the same place, in the danger colour. This
is not decoration: the node already learned this lesson once —
[`logic-builder.ts:243-247`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)
records that `_compileFunction` used to swallow a `SyntaxError` into a `console.error` and return
`null`, which is what made a broken block program silent. **A Do It that fails quietly repeats that
defect at a smaller scale.**

## Acceptance

- Right-clicking a value block in a Visual Function whose node is live shows its current value in a
  balloon on the block, with the live input values, not defaults.
- Right-clicking a writing statement block offers Do It **disabled with a reason**.
- A block that throws shows the error in the balloon, and the message reaches the same place a
  compile error does.
- Doing It on three blocks leaves three balloons up simultaneously.
- ⚠️ **Save the program, close the node, reopen it: no balloon, no marker, and the serialised
  workspace is byte-identical to before the Do It.** This is the check that catches the
  decorations-in-the-model defect, and it is the one most likely to be skipped.
- Do It with no running app is offered and explains itself, rather than silently doing nothing.

## Register

| # | Finding | State |
|---|---|---|
| L4 | The spec's push-first design is backwards; the loved implementations are **pull**, and pull is cheaper and quieter | ✅ corrected here, 2026-08-09 |
| L5 | `new Function`'s parameter list is the probe seam and takes a ninth argument for free | ✅ verified in source |
| L6 | App Inventor's Do It runs side effects for real. Ours reaches Variables, Objects and signals, so it needs §2's rule — the prior art does **not** carry a solution to copy | ⚠️ ours to design |
