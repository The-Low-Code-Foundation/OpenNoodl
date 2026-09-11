# DEF-027 — a `Drag`'s child loses its CSS class, so a draggable element cannot be styled

**Found by phase 77's s30 drive, filed as [D28](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d28)
and moved here 2026-08-30 (12:50) by that phase.** ✅ **Closed s23 (2026-08-30).**

A `Group` inside a `Drag` with `cssClassName` set by connection reached the DOM carrying
`react-draggable` **and nothing else**. The authored class was accepted at the door, stored in the
graph, survived the deploy, and was simply absent at runtime — no error, nothing to search for.

⚠️ **This row was open and unnamed in the s22 handoff.** Phase 77 appended it to
[TASKS.md](TASKS.md) at 12:50; s22 wrote `NEXT-SESSION-PROMPT.md` at 13:22 saying the queue held
no workable open row. Both were reading the same file. Recorded because it is the shape the phase
exists to prevent: **a row that nobody names gets rediscovered at full price** — and this one was
32 minutes from being lost.

## 1. The person sentence

**Someone makes a row draggable, writes a stylesheet rule for it, and the rule never fires.**
Nothing they can see is wrong: the class is in the editor, in the graph, in the deployed build.
It is missing from exactly one place — the element — and there is no message that says so. Most
of what a person does with a drag is style it, animate it, or reach it from a stylesheet, so this
is not an edge of the node; it is the node.

## 2. The mechanism, and it is the spread's rather than `Drag`'s

Two things had to be true at once, and each one alone is harmless.

**`react-draggable` cannot see the authored class.** It does try to merge — `Draggable.js:252`
clones its child with `clsx(children.props.className || '', 'react-draggable', …)`. But the child
it clones is the `NoodlReactComponent` **wrapper** element, and the node's own `render` creates
that with only `{key, noodlNode, ref}` (`react-component-node.ts:1344`). The author's class lives
on `noodlNode.props` and is not read until one level deeper. So `children.props.className` is
`undefined`, and the library hands down a bare `react-draggable`.

**The wrapper's spread then let that win outright** (`react-component-node.ts:743-746`):

```ts
...noodlNode.props,   // ← the author's className
...otherProps         // ← react-draggable's, injected by the React parent — last wins
```

`style` above it is deliberately the other way round — the parent wins, and
`NoodlReactComponentProps` says so — because two parents disagreeing about a css property must
resolve to one value. **Class names do not disagree; they accumulate.** Applying the `style`
precedence to `className` is what discarded the author's.

## 3. The evidence

Driven at HEAD **before** anything was changed (`ac2DragGestureDrive.test.ts`, real Chrome, real
pointer): 9/9 passing, including the two assertions that pinned the defect —
`boot['probe-card-a']` **undefined**, `boot.card0.text` **exactly `'react-draggable'`**.

🔴 **The controls are what make it about `Drag` rather than about `cssClassName`**, and they are
phase 77's, not this session's:

| | class in the DOM |
|---|---|
| `Group` inside a `Drag`, `cssClassName` by connection | **absent** — `react-draggable` only |
| `Group` one level further in, same connection, same `Component Inputs` node | present |
| `Text` deeper still, same kind of connection | present |
| `Group` outside any `Drag`, `cssClassName` by parameter | present |

Rows two and three exclude *"a connected `cssClassName` does not apply"*; row four excludes
*"that Group was special"*. Without them a single missing class proves nothing.

## 4. The sibling sweep D28 asked for, and its answer

D28 said: *"any other node that clones a child through a third-party wrapper has the same shape,
and a fix that names only `Drag` would leave them. **Nobody has counted them.**"*

**Counted: one.** `Drag.tsx:214` holds the only `React.cloneElement` in
`packages/noodl-viewer-react/src`, and `react-draggable` is the only third-party wrapper any
node puts around authored children (`@better-scroll` in `Group` operates on the Group's own
element, not on a child element's props).

The fix is placed at the spread anyway, not in `Drag.tsx`. The discarding is the wrapper's, so
repairing it there closes the hole for **any** future wrapper rather than for the one node that
happens to expose it today — and it is still in the viewer's own component, not in the dependency,
which is what D28 asked for.

## 5. Acceptance criteria

| | criterion | state |
|---|---|---|
| **AC1** | A `Drag`'s direct child reaches the DOM carrying **both** its authored class and `react-draggable` | ✅ driven in real Chrome — `boot.card0.text` contains `probe-card-a` and `react-draggable` |
| **AC2** | The library's own classes are not lost in the repair (`react-draggable-dragging`/`-dragged` still work) | ✅ the injected half is kept verbatim; M3 (drop it) is killed by AC1's arm |
| **AC3** | An unauthored `cssClassName` adds nothing — no stray `"undefined"`, no bare separator | ✅ two control arms, `undefined` and `''` (the port's declared default) |
| **AC4** | The `style` precedence this did **not** change still resolves parent-wins | ✅ its own arm, and M5 proves that arm is live |
| **AC5** | The sibling sweep is answered with a number, not an intention | ✅ §4 — one |
| **AC6** | The drive that pinned the defect is **flipped, not deleted**, as its own header instructed | ✅ see §6 |

## 6. What was changed

- **`packages/noodl-viewer-react/src/react-component-node.ts`** — an injected `className` is
  merged with the node's own instead of replacing it. `NoodlReactComponent` is now exported so
  the spec can render it inside a real `Drag`; the node's `render` is still its only production
  caller.
- **`packages/noodl-viewer-react/tests/def027-drag-child-css-class.test.tsx`** — 5 arms. Both
  halves of the mechanism are real (the real `Drag`, the real library, the real wrapper, the real
  `Text` leaf); only `noodlNode.props` is a fixture, and that is genuinely just data.
- **`packages/noodl-mcp/tests/ac2DragGestureDrive.test.ts`** — the two pinned assertions flipped
  in place with the reason kept above them, and `READ` now finds the cards by `probe-card-` rather
  than borrowing `.react-draggable`. Phase 77 wrote that instruction into the file; this is it
  being followed.

**Mutants — 5, each killed by a named arm:**

| mutant | killed by |
|---|---|
| M1 drop the merge entirely | FINDING |
| M2 `&&` → `||` (an absent half stringifies to `"undefined"`) | the no-authored-class control |
| M3 keep only the authored half, discard the library's | FINDING (its second assertion) |
| M4 merge **before** the spread, so `otherProps` overwrites it again | FINDING |
| M5 control check — make the node's `style` win over the parent's | the style-precedence arm |

M1, M3 and M4 share an arm, and that is stated rather than papered over: FINDING carries two
assertions and they fail on different ones. M5 mutates code this task did **not** change, on
purpose — it is the check that the AC4 arm is not vacuous.

⚠️ **The viewer bundle has to be rebuilt for the drive to see the fix.** `render-report.js`
serves `packages/noodl-editor/src/external/viewer/noodl.viewer.js`, a **gitignored build
artifact**; the pre-fix drive and the post-fix drive are only comparable across a rebuild of it.
The first post-fix run went 9/9 **red** for exactly this reason and it read like a broken fix.
