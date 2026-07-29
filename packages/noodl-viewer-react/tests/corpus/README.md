# NDA-001 corpus — the viewer half

Rows R8, R9, E7, F2 and F3 live here because the nodes they name do: `States`,
`Collection2` (the Array node), `Show Popup` and `Columns` are all viewer nodes.

The other half is in `packages/noodl-runtime/test/corpus/`, and so is everything shared: the
graph harness, the `test.failing` declaration, the row-by-row status table, the mapping from
corpus rows to the later tasks that turn them green, and the recorded limitations.

**Read that one:** [`../../../noodl-runtime/test/corpus/README.md`](../../../noodl-runtime/test/corpus/README.md)

## Rows added after NDA-001

Not part of the original corpus — these are contract rows a later task brought with its fix, so they
land green rather than as `test.failing`. Same rules otherwise: a pinned control per claim, and the
row must be shown to discriminate before it is trusted.

| File | Contract | Rows |
|---|---|---|
| `nda-015-explicit-binding.test.ts` | [Binding](../../../../dev-docs/reference/BINDING-CONTRACT.md) §(a)(b)(c) on Parent Component Object | 9 |
| `nda-010-close-popup-targeting.test.ts` | Binding §(a)(b)(c) on Close Popup — NDA-010 §2 | 7 |

Both use `visual-container.ts` rather than the real `Group`: the walk under test reads exactly
`addChild` and `getVisualParentNode`, and standing up a React node needs a DOM, a `ResizeObserver`
and three untransformed scroll plugins. Both members are copied verbatim from
`react-component-node.ts`, because a reconstruction that diverged there would be testing the
reconstruction.

Two harness gaps were closed to make these runnable, and both are worth knowing about:

- **`frame()` now emits `frameStart`/`frameEnd`**, matching `NoodlRuntime._doUpdate`. It did not
  before, so anything deferred with `NodeContext.scheduleNextFrame` — closing a popup is the case —
  never ran, and read as a node that did nothing.
- **`graph.errors`** exposes the runtime error channel directly. `editorConnection.warnings` sees the
  same events through the editor adapter but only their *message*; a row asserting on the `code`,
  which is the stable half of the pair, has to read `errors`.

`nda-010-close-popup-targeting.test.ts` also shims `requestAnimationFrame`, which
`testEnvironment: node` does not provide and `showPopup` uses to attach the popup to its wrapper —
the attachment that gives the popup a visual parent for the walk to climb.
