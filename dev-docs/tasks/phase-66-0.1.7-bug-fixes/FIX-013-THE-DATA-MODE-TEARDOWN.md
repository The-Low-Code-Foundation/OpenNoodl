# FIX-013 — The Data-mode teardown

**Report 8 (c)** · Tier 2 · Effort **S** to remove, **M** with the summary relocation · 🔴 rulings first

> *"The 'data' option doesn't seem to work at all, throws weird messages and buttons all over the
> place … forget signing in and signing out and real database data for now … Just let the user
> define the inputs and outputs, done."* (screenshot `workbench-1.png`)

## Mechanism — the screenshot is the fully-degenerate case, pinned

The toolbar row (Sign out / Data / Sample data / Real backend) is `SandboxToolbar`, mounted at
`ComponentBench.tsx:585-595`; the panel is `SandboxDataEditor` (`:597-604`). Every string in the
screenshot is pinned (`SandboxDataEditor.tsx:117-120, :131-137, :315-322`). `CategoryCard` reads
**no collections**, so the dataset has zero classes and the panel has literally nothing to edit —
yet the Data button was still offered, because `hasDataset = Boolean(result?.dataset)` and a
dataset object exists *with zero classes* (`ComponentBench.tsx:592`), and the footer still
advertises an Apply that would apply nothing. That is the "weird messages and buttons" complaint,
precisely.

The four states: sample+signed-in (default; a network shim synthesizes records and fakes
`currentUser`), sample+signed-out, **Real backend** (deletes `metadata.sandbox` — the bench talks
to the project's actual backend), and a user-data layer whose Apply rebuilds the export (hence
`location.reload`).

## Deletion is safely scoped — nothing shared is orphaned

The AI authoring preview (`SandboxPreview.tsx`) uses the identical toolbar, editor, and hook, and
`buildSandboxDataset` has a second caller (`sandboxExport.ts:226`). Removing the Data complexity
**from the bench** is a subtraction at exactly four sites in `ComponentBench.tsx` (`:108-113`
state, `:179-189` args+deps, `:261` args, `:585-604` mounts) and touches nothing else.

**Keep:** `useSandboxViewer` (required — sandbox client identity, partition, design-token
injection, and `remountKey`, which BEN-002 proved is the only way to clear an input with no
derived default; deleting it breaks Reset), the harness splice minus the dataset half, and
`describe()`'s summary — including the **backwards-ports sentence, the single most valuable
diagnostic the bench emits** — which currently only reaches the user through the toolbar and
therefore needs a new home: the chrome strip beside `BenchCaption` (`VisualCanvas.tsx:242-245`).

## Fix direction

Hard-code `useSampleData: true, signedIn: true` (or make them non-optional defaults in
`buildBenchExport`), delete the toolbar and data-editor mounts, relocate `result.summary` /
`result.notice` into the chrome strip. The URL keeps `noodl-sandbox-data=sample&auth=in`, so the
bench **never touches the real backend** — safer than today. The later "import a record as dummy
input values" idea is a small, self-contained picker writing into `applyValueSet` — it needs none
of the removed machinery; file separately.

## 🔴 The deletability payoff is attached to the WRONG ruling (measured 2026-08-16, session 33)

Ruling 2 below says that if the AI preview drops its toolbar too, then `sandboxData.ts`
*"(567 lines, 15 specs)"*, `sandboxDataDraft`, the toolbar, the editor and *"the ~900-line runtime
shim all become genuinely deletable — a much bigger, cleaner subtraction."* 🔴 **Two of those five
are not ruling 2's to give.** The import graph, measured:

| module | production importers | deletable by dropping both toolbars? |
|---|---|---|
| `SandboxToolbar.tsx`, `SandboxDataEditor.tsx` | the two surfaces only | ✅ **yes** |
| `sandboxDataDraft.ts` | **exactly one** — `SandboxDataEditor.tsx:66` | ✅ **yes** |
| `sandboxData.ts` (567) | `componentBench.ts:80` **and `sandboxExport.ts:25`** | 🔴 **no** |
| runtime shim (`noodl-runtime/src/sandbox/`, **1,121** lines) | `noodl-viewer-react/src/sandbox/index.ts:61` | 🔴 **no** |

🔴 **`sandboxData.ts` and the shim are downstream of `useSampleData`, not of the toolbar.**
`sandboxExport.ts:221-232` builds the dataset on *every* export unless `useSampleData` is false —
and this document's own **Fix direction hard-codes `useSampleData: true`**. So the recommended fix
puts `buildSandboxDataset` on the *only* remaining path: it is called more, not less.

🔴 **The shim is independently un-deletable, for a second reason.** It lives in `noodl-runtime`,
is installed by the **viewer** (`noodl-viewer-react`), and is already bundled into all three built
outputs (`noodl.viewer.js`, `noodl.deploy.js`, `ssr/noodl.deploy.js`). Its switch is a URL param
read at `noodl-viewer-react/src/sandbox/index.ts:51` — `useSampleData: params.get('noodl-sandbox-data') !== 'real'`
— which **defaults to ON**, and only the literal string `'real'` turns it off. No editor-side
toolbar removal can reach it.

✅ **What this changes about the decision, without making it:** rulings 1 and 2 are **coupled**, and
the file presents them as independent. The big subtraction is **ruling 1 option (c)**'s to authorise
(*shim serves zero rows*), not ruling 2's. Answer ruling 1 with (a) or (b) and `sandboxData.ts` plus
the shim stay **whatever** ruling 2 says — leaving ruling 2's real payoff at three files: the
toolbar, the editor, and the draft.

⚠️ **Bounds, stated so they are not assumed away.** This is a static import-graph reading, not a
drive. It was taken with `-a` and `--exclude-dir` (path, never `| grep -v` — see phase 66 §3g), the
barrel re-exports at `authoring/index.ts:160-163` were followed to their consumers, and a search for
dynamic/lazy `require()`/`import()` of either module returned **empty beside a firing positive
control** on the same pattern in the same directory. The line counts are re-measured (`wc -l`): 567
holds; the shim is **1,121**, not ~900.

## 🔴 Rulings needed before building — these decide the task

1. **What does a data-reading component show on the bench?** (a) keep the shim serving synthesized
   rows, silently — *worse than today: the lie loses its label*; (b) keep + a "sample data" note
   in the caption; (c) **shim serves zero rows** so the component shows its real empty state and
   the user feeds it via inputs — closest to "just inputs and outputs, done". Recommend (c),
   possibly with (b)'s one-line caption.
2. **Does the AI authoring preview keep its toolbar row?** If yes, the two surfaces diverge and
   BEN-004 §7's "do not build a second toolbar" constraint is knowingly retired — say so in the
   doc. ~~If it drops too, `sandboxData.ts` (567 lines, 15 specs), `sandboxDataDraft`, the toolbar,
   the editor, and the ~900-line runtime shim all become genuinely deletable — a much bigger,
   cleaner subtraction.~~ 🔴 **CORRECTED s33 — see the section above.** Dropping both toolbars
   deletes **three** files (toolbar, editor, `sandboxDataDraft`). `sandboxData.ts` and the runtime
   shim are downstream of **`useSampleData`**, which the Fix direction hard-codes to `true`; their
   deletability belongs to **ruling 1(c)**, not to this ruling. ⚠️ **Decide ruling 1 first** — it
   sets the size of this one, not the other way round.
3. **Signed-in hard-coded** loses the ability to bench a component's signed-out branch (POL-008
   fixed the inverse defect). Acceptable for the bench?
4. `tests/ai/component-bench.test.ts:259-262` asserts the Real-backend path — delete the
   assertions, or keep `useSampleData` as a programmatic option with no UI?

## Acceptance criteria

1. Benching `CategoryCard` shows: the frame, the inputs rail, the outputs rail, the scenario bar,
   and the one-line summary. No Sign out, no Data, no Sample data / Real backend, no Apply banner.
   Screenshot vs `workbench-1.png`.
2. The backwards-ports diagnostic still reaches the user (drive a component with inverted plugs).
3. The bench cannot reach the project's real backend (assert the export always carries the
   sandbox flag).
4. The AI authoring preview per ruling 2 — either unchanged (control) or swept in the same commit.
