# HLS-005 — what was built

**Session 6, 2026-09-09.** The report no longer says *"nothing left over"* when something was.
Issue [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23) is closed (C23), and so is
C42. **4 of 4 acceptance criteria.** 91 suites / 3239 rows green in `nodegx-export` (from 90 /
3204); `tsc --noEmit` clean.

## 1. The rule that decided whether a binding was emitted, finally named

The task asked for it because it was *"inferrable only by diffing outputs"*. It is this:

> **`planComponent` records `plan.bindings[node][port]` for every `Component Inputs` wire into a
> rendered node — unconditionally, without asking whether anything downstream can render one. The
> emitter's builders then divide into two shapes, and both leak.**
>
> - `styleAttrs` iterates the **rule table** (`WIRED_STYLE_SINKS`, exactly three ports wide:
>   `opacity`, `color`, `backgroundColor`) and looks bindings up. A binding on any other port is
>   never visited, so it is never reported.
> - `contentAttrs` iterates the **bindings**, but `continue`s on any port with no `attr:` role.
>
> A property in neither table falls through both **in silence.**

That is why #23's table has one input reaching three sinks of which two survive: the difference
between the survivors and the casualty is not the input, it is whether the **sink** is in a table.

🔴 **Neither end of the chain could see it.** The plan's count of bindings is right. The emitter's
count of attributes is right. Nothing compared them — two gates covering the ends of a chain read
as coverage.

🔴 **And the intent was already written down, correctly, in the code that did not implement it.**
`style.ts`'s own comment on `WIRED_STYLE_SINKS` says a wired `width` and a wired `transformX` are
*"both refused by name until a fixture asks"*. They were not refused by name. They were dropped
without a word. The comment is now corrected in place rather than deleted, because a stale
statement of intent is how the next reader concludes the mechanism exists.

## 2. What was measured before anything was built

🔴 **The first instrument was blind, and its zero was persuasive.** Checking *"declared in the
`Props` interface but not destructured in the signature"* reported **0 of 50** — because
`emitComponent` builds the interface **and** the destructure from the same `plan.props` list, so
that reading is impossible by construction. The defect is a prop destructured and never used in the
body. It is recorded here because a measurement that cannot fire is not evidence of absence.

Re-armed, over the **emitted `.tsx`** of all 43 corpus projects — never over the plan that decided
the drop, because a check fed by its own producer cannot bootstrap:

| | |
|---|---|
| components declaring a `Props` interface | 21 (50 props) |
| props declared and never read | **9**, in 4 components |
| already named by a note | 6 |
| 🔴 **silent** | **3** — `batch-desk/Notify.Do`, `puppy-test-3/BenchProbe.Align`, `…/BenchProbe.Ghost` |
| 🔴 **components in *"nothing left over"* carrying one** | **1** — `batch-desk/Notify` |

`puppy-test-3/Components/BenchProbe` is #23's table one construct over, and it was already in the
repo: `Title`→`text` and `Accent`→`color` survived, and **`Align`→`textAlignX` vanished with
nothing said.** The corpus had carried the defect all along; nobody had counted the artefact.

⚠️ **Two of the three silent ones are not defects, and the gate had to be built to know the
difference** — a gate on "no unread prop" would reject the correct answer twice:

- **`Ghost`** is declared on a `Component Inputs` node and wired to **nothing**. The interface is
  what the author declared; the emitted app delivers exactly as much as the running app does.
- **`Do`** was not dropped, it was **relocated**. `Notify` is a Run Tasks template: its `Do` chain
  runs in a mount effect, because mounting is when `startTask` pulses it.

So the gate's unit is **the authored wire**, not the prop.

## 3. The fix

`emit/component.ts` keeps a **claim ledger** — every binding the emitter takes, recorded in the
same statement that takes it (`styleAttrs`, `contentAttrs`, `classAttrOf`, `childText`, the
`mounted` wrapper, and both instance paths). After the tree is walked, a sweep reports every
binding no builder claimed, through the two channels the exporter already uses for everything it
cannot do: a note in `EXPORT-REPORT.md` and a `TODO(export)` marker above the `return`.

🔴 **Recorded where the binding is consumed, never re-derived from the rule tables.** A second copy
of *"which ports can render a binding"* is a copy that drifts, and it would drift silently in
exactly the direction the ledger exists to catch. A builder that starts handling a new port claims
it in the statement that handles it, or the sweep reports it.

**The note names both ends of the wire**, and the second half is not decoration: #23 is a table of
*inputs*, and the author arrives asking what happened to `load`, not to `sr_fill.width`.

```
Components/StatusRail: wire into sr_fill.width from component input "load" has no rendered sink
on Group — the property renders from its authored parameter only, so the wire is dropped, reported
```

**C42** is one line elsewhere: `withoutMachinePaths` in `parse/parseModules.ts` takes the exporting
machine's filesystem back out of the `ENOENT` Node throws, leaving the path the author would type.

### What the fix cost the corpus: exactly one note

Measured before the golden was touched, by exporting `puppy-test-3` with and without the sweep and
diffing the trees: **one note, one report line, one refusal count (7 → 8) and one `TODO(export)`
marker, in one project.** 5 of 840 hashes. Nothing else moved. The sweep is not a flood.

## 4. The acceptance criteria

**AC1 (person) — closed, by building and rendering it.** `status-rail` exported (14 files),
`npm install` (72 packages), `npm run build` → `tsc -b && vite build` **exit 0**, 46 modules. Then
the component server-rendered through `react-dom/server` — the real component, not a source-text
match. **Not one generated file was edited**; the SSR entry is a new file beside them.

```html
<div class="_srFill_em5f5_10" style="background-color:rgb(0, 128, 0)"></div>   ← translated
<p   class="_srPtext_em5f5_17" style="color:rgb(0, 128, 0)">Load</p>           ← translated
<div class="_srPdot_em5f5_22" style="background-color:rgb(0, 128, 0)"></div>   ← translated
```

`load → sr_fill.width` is **absent from the inline style** — and that is AC1's *"or"* branch,
satisfied literally: the report names it **by input name and by sink**, and `Components/StatusRail`
is **not** in the *"nothing left over"* list.

**AC2 — closed.** *No generated component drops a wired input without the report naming it*, as a
cardinality over the **emitted artefacts** of all 44 projects. The population is pinned rather than
waived, so any new silent drop reddens it; the one pinned entry (`Notify.Do`) has its own row
asserting the **artefact** justifies it — the emitted file says *"its `Do` chain runs once on
mount"* — so the pin stops being justified the moment the relocation stops happening. An arming row
guards against a vacuous corpus (≥ 20 components, ≥ 40 props).

**AC3 — closed.** Two rows. *No component in the list carries a note or a refusal row* (the
structural half), and *no component in the list carries a silently dropped input wire* (the half
that was actually false — `batch-desk/Notify` was the only one, and it is the pinned relocation).

**AC4 — closed.** `tests/fixtures/status-rail` is #23's own table reconstructed, **labelled as a
reconstruction**, keeping the issue's node ids so the two read side by side. Three of the four rows
reproduce.

⚠️ **The fourth does not, and it is recorded rather than engineered away.** #23 measured
`statusColor → sr_pdot.backgroundColor` **dropped** while `sr_fill.backgroundColor` beside it
translated. Here **both translate**: `backgroundColor` is in `WIRED_STYLE_SINKS` and both nodes are
Groups, so nothing distinguishes them. Whatever made the reporter's third row differ is a property
of their project this table does not carry — most likely the sink was not a plain visual node.
Inventing a fixture that reproduces it by a mechanism nobody has measured would be a gate testing
its author's guess.

**The reverted arm.** A transform on the **output** — never a second copy of the emitter — that
strips the sweep's note and marker, verified against the real pre-fix export before the golden
moved. Two rows guard the mutant itself: it must have **fired**, and it must still be a **program**
(no parse diagnostics). Reverted, `load` and `width` are named nowhere, and the report tells #23's
lie: `Components/StatusRail` is back in *"Translated with nothing left over"*.

## 5. What this does not leave you

- ⚠️ **`transformX` is the other port `style.ts` names, and no fixture asks.** The sweep would now
  report it, but nothing in the corpus wires it, so that is a claim about the mechanism and not a
  measurement. Same for every non-visual sink class the corpus does not reach.
- ⚠️ **The emitter still cannot *bind* a dimension port**, and this task did not try. `width` needs
  the port's `defaultUnit` appended. HLS-005 made the refusal loud; it did not make the wire work.
  🔎 Phase 84's **FLD-004** is scoped on exactly this and is a different task.
- 🔴 **`batch-desk/Notify` still declares a `Do` prop nothing reads.** Passing it does nothing —
  the effect runs on mount regardless. The behaviour is faithful and the interface is vestigial;
  whether a Run Tasks template should declare the port at all is a design question nobody has
  ruled, and it is pinned rather than answered.
- ⚠️ **`unreadProps` over-counts reads on purpose** (any identifier occurrence in the body). Every
  prop it reports really is unread, but a prop read only in dead code would not be reported.
- ⚠️ **No second exported project was built by hand.** One was.
- ⚠️ **Nothing published.** R1 is still unruled.
