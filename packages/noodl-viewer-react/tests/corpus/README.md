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
| `nda-015-explicit-binding.test.ts` | [Binding](../../../../dev-docs/reference/BINDING-CONTRACT.md) §(a)(b)(c) on Parent Component Object, **+ reader/writer agreement** | 11 |
| `nda-010-close-popup-targeting.test.ts` | Binding §(a)(b)(c) on Close Popup — NDA-010 §2 | 7 |
| `nda-015-repeater-item-binding.test.ts` | Binding §(a)(b)(c) on the current Repeater item (`_forEachModel`) — FINDINGS F-ii | 13 |
| `nda-004-component-object-family.test.ts` | [Failure](../../../../dev-docs/reference/FAILURE-CONTRACT.md) §2 on the Component Object family, **incl. the two 🔵 verdicts** — FINDINGS B-i | 14 |
| `nda-004-video-playback.test.tsx` | Failure §2 on Video — FINDINGS B-ii | 10 |
| `nda-004-array-mutators.test.ts` | [Failure](../../../../dev-docs/reference/FAILURE-CONTRACT.md) §2 on the Array mutators, **incl. two 🔵 verdicts** — FINDINGS B-v | 23 |

Four of those rows pin an **absence**: `Set Component Object Properties` must keep having *no*
`Failure` port, because it cannot miss, `Component Object` must stay silent when values arrive, and
`Create New Array` and `Array` must keep having none for the same two reasons respectively. The
contract is explicit that a port implying a failure mode that does not exist is worse than no port,
so a later mechanical sweep "finishing the family off" is a regression, and these rows are what
catch it.

## Two harness limits found while adding the Array rows (2026-07-30)

Both were found by the discrimination check, not by a failing test, and both apply to every file
here rather than to the rows that turned them up.

**`signalsFor` does not prove a port exists.** It is a wrapper the shared harness installs over
`sendSignalOnOutput`, and it records the port name **before** delegating; `Node.sendSignalOnOutput`
on a name the node does not have only `console.log`s and returns. So deleting a node's `failure`
output leaves every `expect(signalsFor(id)).toContain('failure')` row green. Verified by doing it —
nothing failed. Assert `node.hasOutput('failure')` as well when the *port* is part of the claim; the
existing §2 files have this gap.

**No node↔node-model event is delivered in this package.** `Node.setNodeModel` registers its
`parameterUpdated` / `variantUpdated` / `inputPortRemoved` / `outputPortRemoved` listeners *with a
ref*, so they live in `EventSender.listenersWithRefs` — a `Map`, which `emit` walks with
`for (const [ref, callbacks] of map)`. This package compiles sibling-package sources with
`target: "es5"` and no `downlevelIteration`, turning that into an index loop over `map.length`:
`undefined` on a `Map`, so **zero iterations, silently**. Ref-less listeners on the same emitter
fire normally, which is why nothing else has noticed. Confirmed in both directions — `emit` reaches
a ref listener under `noodl-runtime`'s jest and not under this one.

This *extends* the banked pre-ES2015 trap rather than restating it: that trap says the symptom is a
loud `TS2802`, and here there is no error at all, because a cross-package source is transpiled with
these options but its diagnostics are never surfaced. A row that needs a real parameter edit — the
editor's own `setParameter(name, undefined)`, which is how a cleared field reaches a node — belongs
in `noodl-runtime`'s half of the corpus.

`nda-004-video-playback.test.tsx` drives the `Video` component class directly with a stub media
element rather than mounting one: `testEnvironment: node` has no DOM to dispatch a real `error`
event into. It reaches the error path through the handler on the element `render()` returns, which
needs no mount. Recorded in the file header as a limitation, alongside `F2`/`F3`.

The `_forEachModel` rows nest **two Repeaters**, for the same reason the Parent Component Object
rows nest components: with one Repeater there is only one answer and the binding looks correct
whatever the code does. Its sibling rows for the fifth site (`Component.RepeaterObject` in a
Function node) are in the runtime half, because both that seam and `Run Tasks` — the *second*
producer of `_forEachModel` — live there.

The first two files use `visual-container.ts` rather than the real `Group`: the walk under test reads exactly
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
