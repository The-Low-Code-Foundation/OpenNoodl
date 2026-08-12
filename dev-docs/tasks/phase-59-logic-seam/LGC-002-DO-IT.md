# LGC-002 — "Do It": ask one block what it is

**Status:** 🔨 §1–§4 built 2026-08-12 · **one line of wiring outstanding** and **no drive run** —
see [Deferred verification](#deferred-verification) · **Track: the eyes** · prior art: MIT App
Inventor, Scratch, Snap!

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

## What was built, 2026-08-12

| Piece | File | Note |
|---|---|---|
| the offer rule, the fragment generator, the dismiss rule, the balloon copy | `noodl-editor/.../BlocklyEditor/DoIt.ts` | import-free but for Blockly, so all four are graded headlessly |
| the balloon | `.../BlocklyEditor/DoItBalloons.ts` | imperative SVG into `getSvgRoot()`; never a Blockly comment |
| menu, session, lifetime | `.../BlocklyEditor/DoItController.ts` | one session per open block editor, keyed by `workspace.id` |
| the round trip's editor end | `.../BlocklyEditor/DoItProbeClient.ts` | four failure sentences, one per thing that can go wrong |
| the round trip's transport | `ViewerConnection.ts` · `noodl-runtime/src/editorconnection.ts` | `evaluateBlockFragment` out, `blockFragmentResult` back, unbatched |
| routing to the node | `noodl-runtime/src/nodecontext.ts` | `found: false` is a distinct answer from an error |
| **execution** | `noodl-runtime/src/nodes/std-library/logic-builder-probe.ts` | same eight parameters, same context, live `Inputs` |

**Three decisions worth knowing before extending this.**

1. **The request is broadcast, not addressed.** Every other request on this channel names the
   viewer it is for, because its caller knows which client it is talking to. A block editor tab
   knows a node id and nothing else — the node is in whichever preview has that component
   mounted — so every viewer is asked and each answers whether it has the node. LGC-003 pushes
   rather than pulls and will want the opposite: it should address the client it is tracing.
2. **The writing list has five entries, not the three §2 names.** `set property on object` and
   `add to array` write to live containers too. §2's three were examples.
3. **The value is formatted in the viewer, by `previewValue`, and travels as a string.** Not a
   convenience: the values a block computes include Collections, Models, DOM nodes and circular
   objects, none of which survive `JSON.stringify` on a socket.

## Deferred verification

**No editor was driven this session.** Everything below is unverified. Nothing in this task's
acceptance list has been observed; the specs cover the parts that do not need an editor.

### 0. The one line that is missing 🔴

`CanvasTabs.tsx` does not pass the node id, so **Do It cannot reach a node until it does**. The
file belonged to another lane on the day this was built. One line:

```diff
               <BlocklyWorkspace
                 key={activeTab.id}
+                nodeId={activeTab.nodeId}
                 initialWorkspace={activeTab.workspace || undefined}
                 onChange={handleWorkspaceChange}
               />
```

Without it the menu item still appears and still explains itself — *"This block editor is not
attached to a node…"* — which is deliberate: a Do It that is simply absent is indistinguishable
from one that is broken. **Pass:** with the line in, right-clicking a value block no longer
shows that sentence.

### 1. The acceptance list, and how to run it

Open a project with a Logic Builder whose blocks compute something from an input, wire a value
into that input, and start the preview.

| # | Steps | A pass looks like |
|---|---|---|
| 1 | Right-click a `get input` block, then a `×` block above it | A balloon on each, showing the current values. The `×` balloon equals the product of the other two |
| 2 | Change the value feeding the input **without re-running the node**, then Do It again | The **new** value. This is the one that catches an evaluation against defaults, and it is the criterion the whole task turns on |
| 3 | Right-click `set output`, `set variable`, `send signal` | The item reads *"Do It — This block changes things. Run the node to see it."* and is greyed, not missing |
| 4 | Do It on a block that throws (`get property` on an input that is `undefined`) | The message, in the balloon, in red, with the `!` marker |
| 5 | Do It on three blocks | Three balloons, all up at once. Click a marker: that one hides, the others do not |
| 6 | Stop the preview, Do It | *"Do It runs the block in your app, and no preview is running…"* — immediately, not after three seconds |
| 7 | Preview running but the component not on screen | *"The preview is running, but this Logic Builder is not in it right now…"* |
| 8 | Do It on a value block that nests `add to array` | The value **and** the array grew. This is not a bug; it is §2's limit, and it should be confirmed rather than discovered |

### 2. 🔴 The check most likely to be skipped

**Save the program, close the node, reopen it: no balloon, no marker, and the serialised
workspace byte-identical to before the Do It.**

Exact steps:

1. open the Logic Builder, copy the `workspace` parameter's value out of the project file;
2. Do It on three blocks; leave the balloons up;
3. touch nothing else — do **not** move a block, which would legitimately re-serialise;
4. wait past the 300 ms debounce, close the tab, save;
5. diff the `workspace` parameter against the copy.

**Pass:** identical, character for character, and reopening the node shows no balloons and no
markers.

The reason it should pass is structural — the balloon is `document.createElementNS` into the
block's SVG group, it produces no Blockly events, and `workspaces.save()` reads the model —
and the generation half of the same claim *is* pinned by a spec (`does not disturb what the
workspace saves`). The rendered half is not, and this is the check that would catch it.

### 3. Not verified, and not verifiable without a rendered workspace

- **The balloon is legible.** Colours come from `--theme-color-bg-2` / `-border-strong` /
  `-fg-default` / `-danger`; the contrast ratios have **not** been measured on composited
  pixels, in either theme. Do this before calling §3 done.
- **The marker is clickable.** It binds `pointerdown` and stops propagation so Blockly's gesture
  handler does not start a drag from it. Reasoned, not observed. Confirm the marker toggles and
  does **not** select or drag the block.
- **The balloon survives a re-render.** Blockly updates a block's paths in place rather than
  rebuilding its group, so a child `<g>` should survive a field edit or a zoom. Not observed —
  and a field edit dismisses the balloons anyway, so the case to watch is zoom and theme flip.
- **A second preview.** The broadcast/`found` design only earns its keep with two viewers
  attached; with one it is untested extra machinery.

## Register

| # | Finding | State |
|---|---|---|
| L4 | The spec's push-first design is backwards; the loved implementations are **pull**, and pull is cheaper and quieter | ✅ corrected here, 2026-08-09 |
| L5 | `new Function`'s parameter list is the probe seam and takes a ninth argument for free | ✅ verified in source. **LGC-002 needed no ninth parameter** — a fragment compiles against the same eight. The ninth is LGC-003's `__p`, and it is still free |
| L6 | App Inventor's Do It runs side effects for real. Ours reaches Variables, Objects and signals, so it needs §2's rule — the prior art does **not** carry a solution to copy | 🔨 designed and built: **value blocks only**, five writing types refused, two side effects contained and the rest documented as not contained |
| L10 | `blockToCode` alone is **not** enough to generate a runnable fragment. Blockly's helper-function definitions (`mathRandomInt`) and variable declarations come out of `finish()`, so a bare call generates a `ReferenceError` for a block that works perfectly inside the whole program | ✅ found and pinned by two specs; `init`/`finish` bracket every generation |
| L11 | TypeScript narrows a boolean-literal discriminant on `=== false` and **not** on `!x`. The short form silently loses the `reason` field the greyed menu item exists to show | ⚠️ noted at both call sites |
| L12 | Do It cannot reach a node until `CanvasTabs.tsx` passes `nodeId`. Built as a prop that explains its own absence rather than as a menu item that vanishes | 🔴 **one line, outstanding** — see Deferred verification §0 |
