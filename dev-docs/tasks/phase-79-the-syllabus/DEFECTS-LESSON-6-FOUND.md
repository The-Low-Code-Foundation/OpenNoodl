# Defects building spine lesson 6 found

**Opened 2026-09-05 while building [SYL-009](SYL-009-LESSON-6-MOODS.md).** Every row is a finding
about the *product or the lesson tooling*, not about lesson 6 — lesson 6 works around each one and
ships. Rows carry an **owner or `NONE`**; `NONE` means nobody is doing this and it will be
rediscovered at full price by whoever writes lesson 7.

⚠️ None of these blocked an acceptance criterion, so none was fixed here. The standing rule is build
the tasks, not farm the defects. The earlier registers are
[DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) (5 rows),
[DEFECTS-LESSON-3-FOUND.md](DEFECTS-LESSON-3-FOUND.md) (4 rows) and
[DEFECTS-LESSON-5-FOUND.md](DEFECTS-LESSON-5-FOUND.md) (4 rows); **all thirteen are still open.**

| # | severity | owner | one line |
|---|---|---|---|
| H1 | ⚠️ medium | `NONE` | `paramsEqual` on a `stringlist` is order-independent, and a `States` node's start state depends on the order |
| H2 | ⚠️ medium | `NONE` | a `States` value with no `type-<value>` is a number, and the FIRST jump hides it |
| H3 | ⚠️ medium | `NONE` — ⚠️ **runner half fixed s9** | `Timer`'s display name is **Delay**, and the curriculum's lesson 7 entry says `Timer` |
| H4 | low | `NONE` | the catalog's one-line summary of `Visible` does not say it keeps the space |

---

## H1 ⚠️ — paramsEqual on a stringlist is order-independent, and the order is load-bearing

**The shape.** A `stringlist` parameter is stored as a comma-separated string, and the lesson
condition evaluator compares two of them by sorting:

```ts
// packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts:550
if (portType === 'stringlist') {
  // Order-independent comma lists.
  const actualList = String(actual ?? '').split(',').sort();
  const expectedList = String(expected ?? '').split(',').sort();
  return actualList.join(',') === expectedList.join(',');
}
```

**Why it matters.** A `States` node **starts in the first state in its list** (`states.ts`, the
`states` setter: `scheduleGoToState(startState || states[0])`). So the order is not cosmetic, and a
step that says *"set States to `Bored` and `Happy`, in that order"* is graded by a condition that
cannot tell the two orders apart. The prose and the condition disagree, which is the shape
`LESSON-VOICE.md` §10 says only ever fails in the silent direction.

**It does not break lesson 6**, and the reason is worth recording because it is luck rather than
design: the `Condition` evaluates on its first value and pushes `Mood` to the correct state before
the first frame a learner sees, so a learner who typed `Happy,Bored` gets the right card anyway. A
lesson where the start state was the answer would ship a hole.

⚠️ The tolerance is deliberate and probably right for the common case (a list of page names, a set of
options). What is missing is a way to say *this list is ordered* — there is no `paramsEqualOrdered`,
and `hasParams` is weaker still.

---

## H2 ⚠️ — a States value with no type is a number, and the first jump hides it

**The shape.** `States` decides how to move a value by reading `type-<value>`, and **`undefined` is
treated as `number`**:

```ts
// packages/noodl-viewer-react/src/nodes/std-library/states.ts:161
if (valueTypes['type-' + v] === 'number' || valueTypes['type-' + v] === undefined) {
```

Only `string`, `boolean` and `textStyle` take the assign-it-straight-away path in `goToState`.
Everything else is tweened, and a sentence has no midpoint.

🔴 **The first state change is exempt, which is what makes this expensive.** `jumpToState` assigns
`internal.stateParameters[prefix + v] || 0` regardless of type, so a `States` node holding two
strings with the type left at its default **renders correctly at load** and only goes wrong on the
first transition. A lesson, a spec or a render report that looks at the opening frame sees a working
node.

**Worked around** by grading `type-word` explicitly in step 4 and by measuring lesson 6 on arms that
have already crossed the threshold, not only on its opening frame.

⚠️ The editor's default for the generated enum is `number`, which is the right default for the
node's animation use and the wrong one for its state-machine use. Nothing warns.

---

## H3 ⚠️ — Timer's display name is Delay, and the curriculum calls it Timer

**The shape.** `get_node_type("Timer")` returns `displayName: "Delay"`, category `Utilities`. A
learner told to add a **Timer** will not find one in the picker.

Its ports are also not what "Timer" suggests: `start`, `restart`, `stop`, `duration`, `startDelay`
in; `timerStarted` and `timerFinished` out. **There is no repeat and no `isRunning` boolean** — it is
a one-shot delay, restartable for debouncing, and turning it into a lasting fact needs a `Switch`
beside it.

**Why it matters now.** `it-gets-demanding` — spine lesson 7 — names `Timer`, `And`, `Or` and
`Inverter`, and its description is *"time as a source of events"*. Whoever writes it will design
around a repeating timer that does not exist unless they check first. This is the same trap lessons 3
and 4 hit, and it is the third curriculum entry in six to name a node that cannot do the job the
description implies.

⬜ Not a defect in the node. The defect is that the curriculum and the picker disagree, and the only
place that can be fixed is `curriculum.json` in the other checkout.

---

## H4 low — the catalog's one-line summary of Visible does not say it keeps the space

**The shape.** `Visible` is a shared port on every visual node:

```ts
// packages/noodl-viewer-react/src/node-shared-port-definitions.ts:346
description: 'Hides the element while keeping the space it occupies in the layout',
set(value) { value ? this.removeStyle(['visibility']) : this.setStyle({ visibility: 'hidden' }); }
```

The `description` is exact. The **summary** an authoring tool sees first — *"Boolean level;
hides/shows without removing layout logic elsewhere"* — reads like a note about side effects, not
like *this element keeps its box*.

**What it cost.** Lesson 6's first design was two Texts sharing a slot in the card, one shown while
the other was hidden. That design leaves a permanent blank line, and it was abandoned only because
the port's own `description` was read before anything was built. Rendered instead of read, it would
have looked like a spacing bug in the card rather than a wrong choice of port.

⚠️ Worth a sentence in the summary — *"the element keeps its space; use a Group's own children or a
conditional to remove it"* — because a hide/show pattern is the first thing most authors reach for.


---

## ⚠️ H3 — NARROWED, not closed (2026-09-05, session 9)

The **editor-facing half is fixed**: the lesson runner's *"Looking for…"* line used to repeat the
internal type id back at the learner, so a step grading a `Timer` told them to look for a "Timer"
while the picker offers **Delay**. That sentence now resolves through the node picker's own label
function — see [D2](DEFECTS-LESSON-2-FOUND.md), fixed in the same pass, which turned out to be the
same defect wearing a different hat for eight node types.

🔴 **The row itself stays open.** What H3 is about is the **curriculum entry**, whose text lives
in the other repo and still names a node called `Timer`. Nothing in this pass touched it, and the
prose a learner reads in the lesson body is unchanged. Owner still `NONE`.
