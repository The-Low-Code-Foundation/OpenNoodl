# TUT-003 — the tutorial itself

**Surface:** content + editor · **Tier 3** · **Effort:** M · 🔴 **R3 open** (README §3)

## The premise

The first community tutorial, and the one that teaches [README §0](README.md)'s ruling: **the
Visual Function computes; the canvas does the async work; the signal wire is the await.**

It is deliberately the tutorial *and* the argument. A builder who finishes it should be able to
answer "how do I call the database from blocks?" with "you don't — and here is what you do instead",
without having read a design note.

## What it builds

A one-page "log a thing" app:

```
Button onClick ──▶ Visual Function          (validate + shape the input — SYNCHRONOUS)
                     │
                     ├─ send signal "ok"   ──▶ Create Record ──▶ Success ──▶ Query Records ──▶ list
                     └─ send signal "bad"  ──▶ Text (the reason)
```

Every claim in §0 is exercised: the fan-out (`send signal` registering signal outputs on demand),
the ordering guarantee (the graph sequences on `Success`, and the values are already up to date
because [`logic-builder.ts:400-406`](../../../packages/noodl-runtime/src/nodes/std-library/logic-builder.ts)
flags outputs before firing it), and the round trip back into a second Visual Function if the
learner goes on.

🔴 **It must also teach the cost, not hide it.** README §0's accepted cost is that state gets
re-threaded through ports across the split. The step that would otherwise be painful is the one
where `Noodl.Variables` blocks earn their place — teach that in the same breath, or the pattern
reads as a workaround rather than a design.

## 🔴 A bundle without a `solution/` is not a bundle

[`lessonbundleread.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleread.ts):
without a solution there is **no F2 replay, no F3 decoy and no F4 render** — three of the four
machine-checkable classes go dark, and `installable` is a separate field from `ok` precisely so that
"nothing failed because nothing was checked" cannot read as a pass.

So: bundle root = the starter the learner opens; `solution/` = the finished graph; `lesson.json` =
the steps.

## R3 — the open question

Does the tutorial ship its collection pre-made, or does the learner create it?

- **Learner creates it** — better pedagogy, and it is exactly the half TUT-002 makes gradeable.
  Also the riskier half: a learner who names the collection differently fails every subsequent
  condition, so the step needs the name to be unmissable.
- **Pre-made** — gradeable with today's verbs, less taught.

Recommend **learner creates**, with the collection name given verbatim in the step body and the
first data condition being *collection exists* so the mistake surfaces immediately rather than three
steps later. But it is Richard's call, and the answer changes step 2 onward.

## Acceptance criteria

1. The bundle installs through `LearningFolderModel.install` and appears in the launcher's Learning
   section with its metadata, absent from the normal picker flow (D5).
2. `lessonbundleverify` scores it **`ok` and `installable`**, with all four classes actually checked
   — a run where F2/F3/F4 report `not-checked` does not satisfy this.
3. Every step's conditions are reachable: `verifyLessonManifest` returns no F1, including for the
   TUT-002 data conditions.
4. Driven end-to-end in the real editor: a learner following the steps completes every step, and
   **"Check my work" grades a deliberately-wrong attempt differently from a correct one** — the
   wrong attempt being a *plausible* error (the Visual Function wired to `Do` on the wrong branch),
   not an empty project.
5. 🔴 **The data condition is observed failing first.** Complete the graph but create no record; the
   data step must stay red. A data condition that has only ever been seen green proves nothing —
   this is the same rule NAT-001 was built under.
6. The tutorial's own backend is created on install and is **not** shared with any other project —
   README §1B. Asserted, not assumed.
7. It reads correctly in both themes; the lesson layer is one of the surfaces NAT-002/003 moved.

## Watch out for

- 🔴 **Opening a project writes three files into it.** Author and drive against a **copy**, and
  expect the bundle's own starter to be dirtied by the act of opening it — bake the bundle from a
  clean source, not from the directory you drove.
- The starter must not inherit another project's backend config. The FIX-004 §C drive hit exactly
  this: a copied project raised `EADDRINUSE 127.0.0.1:8581` because it carried the original's
  backend binding.
- `suggestedNodes` on the data steps should surface the Record family, or the learner hunts the
  picker for a node the step just named.
