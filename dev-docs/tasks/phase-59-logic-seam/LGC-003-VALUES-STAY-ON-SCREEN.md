# LGC-003 — a=1, b=2, a+b=3, without asking

**Status:** 🔨 §1–§3 and §5 built 2026-08-12 · **§4 filed, not built, deliberately** · **no drive
run** — see [Deferred verification](#deferred-verification) · **Track: the eyes** · depends on
**LGC-002** (the probe) and **LGC-006** (which found that the plugin this task names does not do
what the task thought)

## What this adds over LGC-002

Do It answers one block when asked. This makes the whole program answer at once, during a real run —
which is the thing Richard described wanting: *"a=1 b=2 a+b=3 right on the blockly nodes"*.

It is second because pull proves the mechanism at a tenth of the cost, and because a wall of numbers
is the failure mode the research explicitly warns about (see §4).

## §1 — The probe, pushed

**Instrumentation is emitted at code-gen time, in the editor.** Wrap every value block's generated
output:

```js
// value blocks: [code, order]  ->  ['__p("<blockId>", ' + code + ')', Order.ATOMIC]
// statement blocks: Blockly's native STATEMENT_PREFIX = '__s("%1");\n'
```

Two properties make this safe rather than clever:

- **`__p(id, value)` returns `value` unchanged.** It is an identity function, so the instrumented
  program computes exactly what the bare one does.
- **Wrapping in a call is `Order.ATOMIC`**, so operator precedence cannot be disturbed. `a + b * c`
  survives. This is the detail that kills naive implementations, and it is free if the order is set
  correctly.

`javascriptGenerator.addReservedWords('__p','__s')` so a user-named variable cannot collide.

**One generated string, two probes.** `__p` is the ninth `new Function` parameter from LGC-002.
When no trace client is attached it is `(_id, v) => v` — monomorphic, inlined, effectively free.
When one is, it records. **There is no debug build and no release build**, so there is no class of
bug that appears only when nobody is watching.

Delivery: batch the `{blockId → value}` map at the end of a run and push it over the existing relay
— the same channel `start_trace` and the Provenance panel already use.

⚠️ **The trace switch is global.** `start_trace` also starts and *clears* the trace the editor's own
Provenance panel is showing, and TALK-003 recorded that starting one destroys a human's in-progress
recording. Whatever attaches this must not silently commandeer that switch when a user has a
recording open.

## §2 — The tell that matters more than the numbers

**A block that did not execute this run renders hollow.**

This is worth more than any value badge. "My condition never fired" is the most common confusion in
any visual logic tool, and it becomes visible without reading anything — no number to interpret, no
type to understand, just a block that looks switched off.

Two halves, and one is free:

- **Static** — blocks not connected to anything runnable. **`@blockly/disable-top-blocks` already
  does this** (LGC-006). ⚠️ Unverified against our toolbox; confirm before relying on it.
- **Dynamic** — connected, but not reached this run. This is ours, and it falls out of §1: a block
  with no entry in the run's map did not execute.

## §3 — The scrubber

Keep the last ~50 runs of maps. A scrubber along the bottom of the workspace; drag back and every
badge repaints to that run. *"It worked three clicks ago"* becomes answerable.

Nearly free once §1 exists, and it plugs into the recording HUD from TALK-003.

**Prior art and its warning.** NuzzleBug is an omniscient debugger for Scratch with stepping,
breakpoints and *reverse* stepping — so this is validated, not speculative. But its evaluation found
that although children could debug effectively with it, **"systematic debugging requires dedicated
training"**, and that even when the tool answered correctly learners struggled to comprehend the
fault or the fix.

**So values alone do not close the loop.** Which is why §4 exists and is the more important half.

## §4 — The follow-on this task files rather than builds

NuzzleBug's validated contribution was that it is an **interrogative** debugger — you ask a question
and get an explanation, rather than reading state and inferring.

**We already ship that verb.** The observe MCP has `why_is_this_empty`, and it computes where data
stopped from the graph and the trace rather than making the user search a log.

Bringing it into the workspace — right-click a block → *"Why is this empty?"* / *"Why didn't this
run?"* — is a bigger idea than any badge, and it is continuous with what NodeGX already does for the
node graph. **It is filed here deliberately and not specced**, because it should follow real
observation of people using §1–§3, not precede it.

## §5 — The four details that decide whether this delights or irritates

1. **Paint on the output plug**, where the wire leaves the block, so the values read left-to-right
   along the data path. A value in a side panel is a log; a value on the plug is an explanation.
2. **Loops need a count, not a flicker.** A block inside a loop has N values. Show the last plus
   `×12`, click to scrub iterations. This is where naive implementations die.
3. **Repaint on an animation frame**, not per value. A program on a frame clock would otherwise
   strobe. ⚠️ Both runtime clocks are frame clocks — that is filed, and it applies here.
4. **Reuse `previewValue`'s display dialect.** Same rule as LGC-002.

## Acceptance

- With a Visual Function running, every executed value block shows its current value at its output
  plug; unexecuted blocks render hollow.
- Instrumented and uninstrumented runs of the same program produce **identical outputs** — proven by
  a spec that runs both and diffs, not by inspection. `a + b * c` and a nested ternary are the two
  fixtures that matter.
- With no trace client attached, `__p` is the identity probe and no values are recorded — verified
  by asserting nothing accumulates, not by assuming.
- The scrubber replays the last runs and the badges repaint per run; a block inside a loop shows an
  iteration count and scrubs.
- ⚠️ **A recording started by a human is not clobbered** when the workspace attaches, per TALK-003.
- ⚠️ **Save, close, reopen: the serialised workspace is unchanged.** Same check as LGC-002, same
  reason.

## What was built, 2026-08-12

| Piece | File | Note |
|---|---|---|
| the instrumentation | `noodl-editor/.../BlocklyEditor/BlockProbes.ts` | wraps `blockToCode`, scoped and restored; Blockly-only, so it is graded headlessly |
| every decision §2/§3/§5 make | `.../BlocklyEditor/BlockValueTrace.ts` | imports **nothing**: the hollow rule, the loop count, the run history, the frame coalescing |
| the marks | `.../BlocklyEditor/BlockValueBadges.ts` | imperative SVG into the block's `<g>`, never the model |
| the switch, addressed | `.../BlocklyEditor/BlockTraceClient.ts` | broadcast to arm, **pin the answering `clientId`**, drop everyone else's frames |
| the scrubber and the glue | `.../BlocklyEditor/BlockValueController.ts` | one strip, one `FramePaintScheduler`, one badge layer |
| §2's static half | `BlocklyWorkspace.tsx`, one line | `Blockly.Events.disableOrphans` — **core**, not the plugin |
| the recorder | `noodl-runtime/src/blockrun.ts` | the identity pair, the per-run map, the iteration cap |
| the switch, per node | `noodl-runtime/src/nodecontext.ts` | `setBlockTracing` / `beginBlockRun` / `endBlockRun` — **its own switch, never `traceEnabled`** |
| the two extra parameters | `.../std-library/logic-builder.ts` | `__p` and `__s`, ninth and tenth, unconditional |
| the transport | `ViewerConnection.ts` · `editorconnection.ts` | `setBlockTracing` out; `blockTraceState` and `blockValues` back |

**Five decisions worth knowing before extending this.**

1. **The address is pinned on the way back, not chosen on the way out.** LGC-002's handover said
   LGC-003 "should address the client it is tracing", and half of that turned out to be
   impossible: a block editor tab knows a node id and nothing else, so arming must still be
   broadcast. What is addressed is the *listening* — the first viewer to answer `attached: true`
   is pinned, and every frame from any other `clientId` is dropped. With two previews showing the
   same component that is the difference between one program's values and two interleaved.
2. 🔴 **Block tracing declines the shared trace switch entirely.** §1's warning is that
   `start_trace` also *clears* the buffer the Provenance panel shows, and TALK-003 recorded a
   human losing a recording to it. HUD-004 made that switch survivable with an ownership set;
   this does something stronger and cheaper — its own per-node `Set` on the `NodeContext`,
   nothing shared. Opening a block editor **cannot** clear a recording because it cannot reach
   one, and three specs assert that by object identity rather than by reading the code.
3. **The frame is formatted at the end of the run, not at each hit.** A loop of five hundred
   would otherwise pay five hundred `previewValue` walks for values nobody reads. The cost is one
   named inaccuracy: a program that mutates an object it also reports shows that object's state
   at the end of the run. Both the run and the flush are synchronous inside `_executeLogic`, so
   nothing outside the run can move underneath it.
4. **A block id with no visible block is skipped silently, and that is load-bearing.** LGC-007's
   My Blocks expands a saved definition's body *inline at every call site* before generating, and
   the expansion carries the definition's own block ids — so a definition used twice produces two
   probes with the same id, for blocks in no workspace the user can see. Painting only what
   `getBlockById` returns is what keeps that from becoming a badge on the wrong block.
5. **§2's static half writes to the model and the dynamic half never does.** `disableOrphans`
   really does disable orphan blocks, and Blockly serialises that — so opening an existing
   program with orphans in it will re-save it with them marked disabled. That is legitimate and
   it is the save churn LGC-006 asked a drive to measure. The hollow wash is drawn, never
   `setEnabled`, because a mark that serialises would end up in the user's git diff.

## Deferred verification

**No editor was driven this session.** Everything below is unverified.

### 1. The acceptance list, and how to run it

Open a project with a Visual Function whose blocks compute something from an input, wire a value
in, and start the preview.

| # | Steps | A pass looks like |
|---|---|---|
| 1 | Run the node once | Every executed value block shows its value at its **left** edge, where the wire leaves |
| 2 | Add an `if` whose condition is false and run again | The blocks inside it render **hollow** — a dashed, washed-out outline, no red, no icon |
| 3 | Put a block inside a `repeat 12` and run | **One** badge reading `<last>  ×12`, not twelve repaints |
| 4 | Click that badge | It steps to `1/12`, `2/12`, … then wraps back to `<last>  ×12` |
| 5 | Run the node five times, drag the strip back | Badges repaint to that run; the label reads `Run 2 of 5`; the `Live` button is enabled |
| 6 | Run it again while scrubbed back | The badges do **not** jump forward. This is the criterion §3 exists for |
| 7 | 🔴 Start a **Provenance recording**, then open the block editor and let it arm | The recording is still running and still has its events. Nothing about the Record button changes |
| 8 | Drag a block out of the program | Every badge disappears immediately, not 300 ms later |
| 9 | Two previews open on the same component | Badges come from one of them. Values must not alternate between two programs |
| 10 | Move the mouse over a badge on a block that ran once | No pointer cursor: only a badge with iterations behind it is clickable |

### 2. 🔴 The two checks most likely to be skipped

**(a) Save, close, reopen: the serialised `workspace` is unchanged** — *except* for what
`disableOrphans` legitimately disables. Exact steps: copy the `workspace` parameter out of the
project file; run the node several times, leaving badges up; touch nothing else; wait past the
300 ms debounce; close the tab; diff. **Pass:** identical, character for character, **on a
program with no orphan blocks**. On a program *with* orphans, expect exactly one added
`disabledReasons` per orphan and nothing else — and if there is anything else, §2's static half
is doing more than it claims.

The reason it should pass is structural: the badges are `document.createElementNS` into the
block's SVG group and produce no Blockly events. The generation half is pinned by specs; the
rendered half is not.

**(b) The save churn `disableOrphans` causes.** LGC-006's row asked for this by name: it fires
block-change events, and `BlocklyWorkspace`'s listener debounces a save-and-regenerate on
anything that is not a UI event. **Measure:** open a program with several orphan blocks and count
`flushSave` calls on load and after a drag. A pass is "one extra on first load, none thereafter";
a fail is a save per orphan per drag.

### 3. Not verifiable without a rendered workspace

- **The badge and the hollow wash are legible.** Colours come from `--theme-color-bg-2` /
  `-border-strong` / `-fg-default` / `-primary`; **no contrast ratio has been measured on
  composited pixels, in either theme.** Do this before calling the rendering done.
- **The badge does not cover the block.** It hangs `width + 6` px to the left of the block's
  origin, which is where the output connection is — reasoned from Blockly's geometry, not seen.
  On a block at the left edge of the viewport it may sit off-screen.
- **The hollow wash reads as "switched off" rather than "broken".** That is a judgement about
  pixels and it is the one thing §2's whole claim rests on.
- **The scrubber strip fits.** It is appended into `css.Root` below the Blockly container; it has
  not been checked that the container gives up the height rather than the workspace overflowing.
- **The strip's sentences appear when they should.** Four states, one sentence each
  (`STATUS_COPY`), none of them observed.
- **Two previews.** The pinning only earns its keep with two viewers attached.

## §4, filed and not built

`why_is_this_empty` in the workspace is **not** built, deliberately and as the task instructs. It
is the more important half and it should follow real observation of people using §1–§3, not
precede it. Nothing in this commit forecloses it: the run frames are the substrate it would ask.

## Register

| # | Finding | State |
|---|---|---|
| L7 | `Order.ATOMIC` on the probe wrapper is what makes precedence safe. Get it wrong and the instrumented program computes different arithmetic than the real one — silently | 🔴 **half wrong, corrected 2026-08-12.** Measured against Blockly 12.3.1: `valueToCode` only ever *adds* parentheses, and parenthesising a call expression is a no-op — so **every** order in the enum computes the same arithmetic, proved by a spec that generates at each of them and diffs. What makes precedence safe is that the wrapper is a **call** at all; a probe emitted as anything that is not one self-delimiting expression is what rewrites `a + b * c`, and a spec builds exactly that and watches the differential catch it. `ATOMIC` is kept because it is the honest declaration and the only one that adds no redundant parentheses |
| L8 | NuzzleBug: a correct answer is not a understood answer. **"Systematic debugging requires dedicated training"** — badges are necessary and not sufficient | ⚠️ standing, drives §4. Three rules in `BlockValueTrace.ts` are written to obey it: a block that emitted no code is never marked, nothing is hollow before the first run, and `×1` is never printed |
| L9 | The didn't-execute tell is probably worth more than every value badge combined, and half of it is an npm package | ✅ built — and **it is not an npm package.** `@blockly/disable-top-blocks` greys nothing out (LGC-006 L31); the greying is `Blockly.Events.disableOrphans`, core, present at 12.3.1. One line, zero bytes, no dependency added |
| L13 | 🔴 **`addReservedWords` is only read once, when the generator lazily builds `nameDB_` at its first `init()`.** Reserving `__p`/`__s` inside the generation call — the obvious place — reserves nothing at all on any session that has already generated code, and a user variable named `__p` then compiles to `var __p; __p = __p("id", 1)`, shadowing the parameter and turning every later probe into a call on a number | ✅ found by a spec, fixed in `initNoodlGenerators` |
| L14 | 🔴 **Blockly folds `STATEMENT_PREFIX` in *inside* `blockToCode`**, so a block whose generator returns `''` still emits `__s("id");` — the four `Define …` blocks were reported as having executed, and would have been badged | ✅ found by a spec; `suppressPrefixSuffix` on the four declaration mixins |
| L15 | My Blocks inlines a saved definition's body **with the definition's own block ids** at every call site, so a definition used twice produces duplicate probe ids for blocks that exist in no visible workspace | ⚠️ contained rather than fixed: only ids `getBlockById` resolves are painted. Fixing it properly means re-iding during expansion, which is LGC-007's file |
| L16 | `Run` is an `EdgeTriggeredInput`: `setInputValue('run', true)` three times in a row is **one** run. A spec that repeats it without toggling passes while measuring nothing | ⚠️ caught here; `pulse()` in `block-trace.test.ts` |
