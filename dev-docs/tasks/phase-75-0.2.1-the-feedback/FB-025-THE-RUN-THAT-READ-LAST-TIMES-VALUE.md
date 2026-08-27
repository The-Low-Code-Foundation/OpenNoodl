# FB-025 — the Run that read last time's value

**Filed** 2026-08-27 by Richard. **Built, specced and gated the same day; driven on a canvas the
same day** — see *Driven on the canvas*.

> When I run the visual function node multiple times, with a value that varies every time the run
> signal is triggered (an input where the 'text' value changing outputs the 'value changed' signal,
> triggering a visual function node that uses that input's value to compute if something is true or
> false) it uses the previous value and outputs the result for the previous value, as if the new
> value arrives too late and there's a race condition between the standard 'run' signal input in
> the visual function node and the values that come into it.

It is a race, and Richard's word for it is exactly right — but it is not a race that is re-run each
time. It was decided **once, on the node's first frame, and then held for the life of the node.**

## The mechanism

`Node.update` drained its per-port input queues like this:

```js
const inputNames = Object.keys(this._inputValuesQueue);
```

`_inputValuesQueue` is a plain object keyed by port name, and its keys come out in **insertion
order** — the order each port was *first ever* delivered to, which is not the order the entries
waiting right now arrived in. `queueInput` created a port's key lazily and nothing ever removed it,
so once `run` had been pulsed before `x` had ever been written, `run` sat at the head of the drain
order **for ever**. Every later frame applied the pulse before the value that had arrived with it,
and the program ran on whatever `Inputs` held from last time.

Reaching that state takes nothing exotic. `sendValue` returns early on `undefined`, so a source
whose first value is empty queues its **signal** and not its value — and a builder who wires `Run`
before deciding what to feed the node gets there by hand.

## It is a class, and the repository already knew

Two places had repaired one node each and written down that the general case was open:

- `objectchanged.ts` — `emptyToNull` exists *only* to stop a port's first emit being `undefined`,
  because "a value port that was `undefined` the first time gets its key created after the signal
  port that did fire, and from then on is delivered after that signal, forever". Named there as
  **`NV-ii`**.
- `nda-012-logic-category.test.ts` — pins that `Signal To Index` is **masked** from the same defect
  purely because `index` holds `0` rather than `undefined` when the wire is made: *"an accident of
  the node's `initialize`, not of its ordering"*.

And `packages/nodegx-core/CONTRACT.md` **C4** already asserted the guarantee — *"a value lands
before the signal that follows it"* — that nothing in `node.ts` implemented.

## The fix — the drain order is stated instead of inherited

`Node.update` now orders each pass itself, in two parts, both in `node.ts`:

1. **A pending value is applied before a pending signal.** Arrival order alone is not enough: a
   value can be one hop behind the signal that describes it, pulled in by `_updateDependencies`
   (C6) *after* the signal was already queued. That is the `nodegx-core` parity scenario, and it is
   what turned red when only part 2 was in place.
2. **An emptied port lets go of its queue key**, so what the key order describes is the ports with
   input pending, in the order that input arrived — not the node's whole history.

⚠️ **C7 lockstep is unchanged.** A port appears in the pass order at most once, so it still advances
one entry per pass and a value stays in step with the signal beside it when several events are
queued in one frame.

⚠️ **`Delete` and `checkAndDelete` are untouched**, and so is `_isFirstUpdate` consolidation (C8).

## What was measured

| | |
|---|---|
| Reproduced first | a failing spec against the real `Logic Builder` node, before any fix |
| `noodl-runtime` | **2555 pass, 13 skipped, 0 fail** |
| `noodl-viewer-react` | **1079 pass, 0 fail** |
| editor `test:main` | **5791 pass, 0 fail** |
| editor `test:ci` | **2856 specs, 4 failures**, seed 18627, `a0477e22` — the recorded floor, all four `AIX-006 style vocabulary` |

**Both 🔴 rows in `fb-025-run-reads-the-value-beside-it.test.ts` were re-run against the unfixed
`node.ts` and went red; the control row stayed green.** Same for the rewritten `nda-012` row.

🔴 **Two suites caught the fix mid-way, and both were right.** `nodegx-core-parity`'s C4 row is what
proved arrival order alone is wrong — it is the value-one-hop-behind case, and it went red on the
first attempt. And `nda-012`'s mechanism row went red because it pinned the *accident*; it was
**rewritten to pin the guarantee**, with an adversarial graph (`corpus.Trigger.value` reads
`undefined` until `send`, so the pulse port's key is created first) that is red on the old drain.

## Driven on the canvas, 2026-08-27 — and the first attempt proved nothing

✅ **Richard's graph was built and watched, and the fix holds.** Fixture:
`NodeGX test projects/fb025-drive`, one `/App` component — a Text Input whose `Value Changed` goes
to a Visual Function's `Run` and whose `Value` goes to a declared input `x`; the program is
`Outputs["seen"] = Inputs["x"]`; a second Text node shows the field's `Value` **directly**, so one
DOM read gives *what the field holds now* beside *what the Run computed*.

🔴 **Authoring the `run` connection first in `project.json` does NOT reproduce the defect, and a
drive that stopped there would have recorded a pass on an arrangement that was never broken.** The
first run typed three characters and `seen` matched `echo` every time — **on the unfixed runtime as
well.** The reason is measurable rather than inferred: the subject's drain order is
`Object.keys(node._inputValuesQueue)`, and on that graph it read
`["workspace","generatedCode","x","run"]` — **the value port's key already came first**. This is
precisely the *"a graph wired the other way was always correct by accident"* case, and it is the
default when a project is *loaded from disk*, whatever order the connections are listed in.

✅ **What does reproduce it is Richard's *build order*, performed live**: unwire `x`, reload the
viewer so the node is fresh, type one character — the `Run` pulse creates its key while `x` has
never been delivered — then wire `x` **into the running graph**. The key order becomes
`["workspace","generatedCode","run","x"]` and the node is not recreated. That is the state a builder
reaches by wiring `Run` before deciding what to feed the node, and it is sticky.

| typed | field / `echo` | `seen` — **unfixed** | `seen` — **fixed** |
|---|---|---|---|
| `2` | `12` | `1` | `12` |
| `3` | `123` | `12` | `123` |
| `4` | `1234` | `123` | `1234` |

🔴 **The unfixed column is Richard's report, reproduced on a canvas: one event behind, every time,
three times running.** The known-broken arm was a real revert of `node.ts` to `76465eeb` with the
viewer bundle rebuilt from it — confirmed at the served bundle, not assumed: `wantSignal` (a name
only the fix introduces) matched **0** times in `http://localhost:8574/noodl.viewer.js` during the
broken arm and **2** times after the restore, so the absence was an absence and not a dead grep.
`node.ts` was restored byte-exact (`md5 44e42e0481940ec7b595004e075fc1a8`).

✅ **Part 2 of the fix is visible directly.** After the drain, `_inputValuesQueue` on the fixed
runtime reads `[]` — the emptied ports have let go of their keys. On the unfixed runtime the same
node kept `["workspace","generatedCode","run","x"]` for the life of the graph, which is the
mechanism this task describes, observed rather than argued.

## What is left

⬜ Nothing for FB-025. The runtime specs, the corpus rows and the canvas now agree.
