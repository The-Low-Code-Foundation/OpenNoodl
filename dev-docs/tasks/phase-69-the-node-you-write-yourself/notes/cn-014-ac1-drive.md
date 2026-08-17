# CN-014 AC1 — driving the frozen-definition fix

**Session 20, 2026-08-17.** 🔴 **Everything above the horizontal rule was written BEFORE the editor
was launched.** The standing obligation is to state what would be observably true of a *working*
build in a sentence that could not also be true of a broken one — s19 lost a reading to exactly this
and nearly filed a false finding about working code.

## What was fixed, and what that does NOT establish

`NodeLibraryImporter.mergeUpdates` now replaces a node's data when the runtime that **owns** that
data re-reports it, and `mergeInByName` now marks the library updated when a picker group genuinely
changed. Eight tests, five mutations killed.

⚠️ **That is a claim about `window.NodeLibraryData` and `NodeLibrary.instance.reload()` — the
library.** CN-014 AC1 is a claim about **the property panel**. The two are different surfaces and the
whole point of this phase's "verify the consequence" rule is that the first does not imply the
second: `reload()` fires `notifyListeners('libraryUpdated')`, and whether the *open property panel*
of an *already-selected* node re-reads its type on that event is not established anywhere.

## Observations, written in advance

**O1 — the criterion.** A kit node is placed on canvas and selected. Its `index.js` is edited to
rename an existing port's `displayName`. The viewer reloads. **The property panel row shows the new
name, with no editor restart.**

- *Could this be true of a broken build?* No. The pre-fix build kept the old definition for the rest
  of the session; s19 polled it five times over thirty seconds and then restarted to get it.
- ⚠️ *Could it be FALSE of a working build?* **Yes — and this is the trap that matters.** If the panel
  simply does not re-render, O1 fails while the library is perfectly correct. So O1 is only
  interpretable beside O2.

**O2 — the liveness control, which must be part of the same write.** The same edit to `index.js` also
adds a brand-new node type. If **O2 passes and O1 fails**, the library refreshed and the *panel* is
the stale surface — a real finding, but a different one, and it must not be reported as "the fix did
not work". If **both fail**, the library did not refresh and the fix is wrong.

🔴 This is s19's control pair reused deliberately: one write, two changes, one reload. It is what
eliminated the file, the watcher, the transport and the reload in a single move, and it is the only
reason the original finding was attributable.

**O3 — the regression guard.** `Expression` is one of the **84** type names the generated cloud
library shares with the browser library. After the reload it must still carry the **browser's**
definition. A build that dropped the ownership gate would silently hand all 84 to the cloud library,
and nothing on screen would announce it.

**O4 — recorded as a separate question, not folded into O1.** Whether a *connected* port that
disappears from a kit is dropped with a diagnostic or silently retained (AC1's second clause). s19
already showed the panel hides a conditional row **while the wire is still drawn, saved and live** —
so the honest prior is that this is unhandled, and it is being measured, not assumed.

## Instrument notes carried in

- 🔴 `node.setParameter()` does **not** re-render the property panel (s19). Any read of the panel
  needs a re-selection, and the re-selection must be shown to move something.
- 🔴 `BaseDialog` renders every dialog twice — filter `:not([class*=MeasuringContainer])`.
- 🔴 `WarningsModel.getTotalNumberOfWarnings()` returned **0** beside a deliberately bogus node type
  (s19), so it cannot be used to assert an editor-side absence for O4.

---

## Readings

**Verdict: the frozen definition is fixed, and O1 lands on the branch the note above reserved for
it — the library refreshes live, the already-open property panel does not.**

| # | Predicted | Measured | |
|---|---|---|---|
| **O1** | the open panel shows the new name | **shows it only after a selection change**; unchanged for 30s otherwise | ⚠️ |
| **O2** | the new node arrives (liveness control) | **arrived, 177 → 178** | ✅ |
| **O3** | the 84 shared names keep the browser definition | **`Expression` / `REST2` / `Model2` all `["browser","cloud"]`, full port sets** | ✅ |
| **O4** | (no prediction — a disappearing connected port) | **not measured**, see below | — |

### The criterion, in the two surfaces it spans

Baseline, `dyn_panel` selected, panel labels read from
`[class*=PropertyPanelInput-module__Label]`:

```
Title | Mode | Item Count | Mounted | CSS Class
```

**One write** to `index.js` renamed `title`'s `displayName` to `Panel Heading` *and* added a new
`dynports.kit.Badge` node. **One viewer reload** (`document.querySelector('webview').reload()`).

| surface | before | after one reload |
|---|---|---|
| `NodeLibrary.instance.types.length` | 177 | **178** ✅ |
| library's `title.displayName` | `Title` | **`Panel Heading`** ✅ |
| **property panel, node still selected** | `Title` | **`Title`** ⚠️ |
| property panel, after re-selecting | — | **`Panel Heading`** ✅ |

🔴 **The library row is the whole fix.** Before this session those two library cells could not both
move on one reload — that is precisely what s19 measured and what `mergeUpdates`' `// TODO` caused.
A changed definition and a new node now arrive together.

### ⚠️ The residual: an open panel does not re-render on `libraryUpdated`

**Reproduced twice, and the timing explanation is excluded.** Second cycle: renamed `Mode` to
`Layout Mode`, reloaded, confirmed the library carried it, then polled the panel **six times over
30 s without touching anything**:

```
t+5s … t+30s:  Panel Heading | Mode | Item Count | Mounted | CSS Class
```

Six identical reads while the library said `Layout Mode`. Then one re-selection (select the Feed,
select the Panel again):

```
Panel Heading | Layout Mode | Item Count | Mounted | CSS Class
```

✅ **So the variable is the selection change, not elapsed time** — which is the control that makes
this attributable rather than a guess about a slow update. `NodeLibrary.reload()` does fire
`notifyListeners('libraryUpdated')`; the property panel simply is not among the listeners that
rebuild from it.

⚠️ **Severity, stated honestly: much lower than the bug it sits behind.** The author recovers by
clicking any other node and back, and ordinary authoring does that constantly — whereas the frozen
definition was unrecoverable without restarting the editor and mislabelled itself as "dynamic ports
don't work". It is a real rough edge and it is **not** what made the dev loop unusable.

### What was NOT measured

- **O4 — a connected port that disappears from a kit.** AC1's second clause. Untouched: it needs its
  own write (removing a wired port) and s19 already showed the panel/canvas/file disagree in the
  neighbouring case. **Recorded as unmeasured, not as working.**
- **O3 is a confirmation, not a discriminating control.** There is no broken-build arm in the live
  editor, so this reading cannot fail in an informative way on its own. The arm that *can* fail is
  mutation **M2** in `tests-unit/cn-014` (drop the ownership gate → the 84-name control goes red).
  The live reading is worth having as a sanity check on the real payloads, and is worth exactly that.

### Checkout conditions

- Stack launched by this session (`dev:debug --quiet`, CDP 9222). Before launch: `dev:stop --list`
  clean, no `scripts/start.ts` running, and **26 Electrons matched as a positive control** so the
  zero was attributable rather than a dead pattern.
- **Driven on a `cp -R` copy** in the session scratchpad; `packages/noodl-mcp/tests/fixtures/kit-dynports`
  never written to.
- `window.__req` was reconstructed by pushing a probe module onto `webpackChunknoodl_editor` — it is
  not present by default in this build.
- ⚠️ **`ng.selectNode(node)` is on the NodeGraph, not on `ng.selector`** (`selector` exposes only
  `select` / `unselect` / `unselectNode` / `isActive`). `ng.getSelectedNodes()` is the read.
- ⚠️ The editor opens in **preview** mode; the node canvas needs the `ModeSegmentedButton` toggle
  before any property panel exists to measure.
