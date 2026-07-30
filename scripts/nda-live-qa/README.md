# Phase 30 live-QA fixture

One project that exercises every claim the phase-30 batch shipped without watching run. Built
because five separate claims needed one editor launch, and rebuilding the graph by hand each time is
where the session time goes.

```bash
node scripts/nda-live-qa/make-fixture.js "<project dir>/project.json"
node scripts/nda-live-qa/make-iconsets.js "<project dir>"      # optional, for NDA-007
```

Kill the editor with `-9` **before** writing, or its shutdown save overwrites the fixture. Then open
the project from the launcher.

## What is in it, and which claim each part is for

| Part | Claim |
| --- | --- |
| Columns, `'1 1 1 1'`, medium `<800` → `'1 1'`, small `<500` → `'1'` | NDA-006 §3 breakpoints, at ≥2 container widths |
| Columns, `Auto Fit`, `minWidth` 200 | NDA-006 §3 Auto Fit |
| Columns whose **only** authored child is a Repeater over 4 records | NDA-006 §2 — that it renders at all, and the wrapper-key fix |
| Columns, `packing: masonry`, 7 boxes of heights 40/90/60/120/50/80/70 | NDA-006 §4 — expected tops `0,0,0,40,90,60,160`, height 230 |
| One Button wired to **two** Show Popup nodes, both on `Replace It` | NDA-010 §3 — one popup, and the superseded node sends `Dismissed` |
| Two Icon nodes, one preset to a sprite value and one blank | NDA-007 §2/§3 — the app path and the picker path |
| An `Expression` reading `1 +* `, `Run` unconnected, **no `On App Error` node anywhere** | NDA-004 §2 criterion 2 — a `[noodl] … [expression/compile-failed]` line on the *default* channel |

**The absence of an `On App Error` node is load-bearing.** Criterion 2 read as met for three
sessions because the fixture it was checked against happened to contain one; the default channel
produced nothing at all in any deployed runtime. Do not add one to this fixture.

## Measuring, from CDP

Everything below is run against `--target=viewer` unless it says otherwise.

**Reconciliation needs DOM identity, not a value.** The per-instance `input-<guid>` class that
NDA-008's state check used proves nothing here: the guid is minted in the node's `initialize()`, and
a React remount does not recreate the node. Capture element references *before* the mutation and
compare with `===`:

```js
window.__before = [...rep.querySelectorAll(':scope > .column-item')]
  .map((it, i) => { it.setAttribute('data-qa-was', i); return { wrapper: it, input: it.querySelector('input') }; });
window.__coll.remove(window.__coll.items[1]);          // delete a middle row
// then: wrapperIdentity should be [0,2,3]; under the bug it is [0,1,2] with new inputs at 1 and 2
```

Reaching the Repeater's source collection: walk `el.__reactFiber$…` up `.return` to
`memoizedProps.noodlNode`, then `noodlNode.nodeScope.getNodeWithId('<graph node id>')._internal.items`.

**Container width, not the window.** `pickBreakpointLayout` keys off the container, so set
`.columns-container`'s `parentElement.style.width` and let the node's own `ResizeObserver` fire.

**A `<use>` reference that resolved has a non-zero `getBBox()`**; one that was blocked or missing
gives `0x0` with no error anywhere. That is the only cheap witness that a sprite actually painted.

**Do not return a node view's `.type`** from an `eval` — it serialises the whole node definition and
the graph with it, tens of thousands of characters.
