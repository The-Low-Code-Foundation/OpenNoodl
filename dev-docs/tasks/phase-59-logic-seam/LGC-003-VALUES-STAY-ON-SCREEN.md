# LGC-003 — a=1, b=2, a+b=3, without asking

**Status:** 📋 open · **Track: the eyes** · depends on **LGC-002** (the probe) and **LGC-006**
(`disable-top-blocks`)

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

## Register

| # | Finding | State |
|---|---|---|
| L7 | `Order.ATOMIC` on the probe wrapper is what makes precedence safe. Get it wrong and the instrumented program computes different arithmetic than the real one — silently | ⚠️ the one that must be tested |
| L8 | NuzzleBug: a correct answer is not a understood answer. **"Systematic debugging requires dedicated training"** — badges are necessary and not sufficient | ⚠️ standing, drives §4 |
| L9 | The didn't-execute tell is probably worth more than every value badge combined, and half of it is an npm package | 📋 open |
