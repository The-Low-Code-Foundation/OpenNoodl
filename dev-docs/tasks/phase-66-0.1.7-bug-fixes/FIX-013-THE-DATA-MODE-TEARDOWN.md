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

## ✅ RULED 2026-08-16 (session 42) — ruling 1 answered

**Ruling 1 → (c): the shim serves ZERO rows.** A data-reading component on the bench shows its real
empty state and the user feeds it through inputs — closest to *"just inputs and outputs, done"*.
Rejected: **(a)** synthesized rows served silently (worse than today — the lie loses its label) and
**(b)** rows plus a caption. ⚠️ Take (b)'s one-line caption anyway wherever an empty frame would
otherwise read as a broken bench.

✅ **This is the ruling the big subtraction hangs on.** `sandboxData.ts` (567 lines) and the runtime
shim (1,121) are downstream of **`useSampleData`**, not of the toolbar — so with 1(c) the Fix
direction must **stop hard-coding `useSampleData: true`**, which it currently does.

🔴 **Rulings 2, 3 and 4 remain open**, and 2 is now smaller than the file originally claimed: its
payoff is **three** files (toolbar, editor, `sandboxDataDraft`), not five.

---

## 🔴 1(c) named a state that did not exist (measured 2026-08-17, session 54)

**The ruling is answerable. It was not *buildable*.** Both earlier readings of this task — s33's
import-graph table and s42's ruling note — say the same thing about how to reach 1(c): stop shipping
sample data, i.e. `useSampleData: false`. 🔴 **That flag does the opposite of what 1(c) asks for**,
and the third state the ruling actually names could not be expressed at all.

### What `useSampleData: false` really does

`noodl-viewer-react.js:66`, in full:

```js
const sandbox = readSandboxSession();
if (sandbox) {
  runtimeArgs.editorClientId = sandbox.clientId;
  if (sandbox.useSampleData) startSandbox();      // ← the shim install
}
```

🔴 **`useSampleData: false` uninstalls the network shim.** The preview then reaches the project's
**real backend** — which is the whole point of the "Real backend" button, and is exactly what
`buildBenchExport` already says out loud: *"Real backend — this bench uses your project's live
data."* (`componentBench.ts:456`). It is **AC3's violation**, not its implementation.

### And an empty dataset is not an empty sandbox

The other half, and the one that is genuinely surprising. `SandboxStore.list()`
(`store.ts:168-181`) **invents `DEFAULT_RECORD_COUNT` = 5 records for any class it has never heard
of** — deliberately, so a preview never strands a graph. `install.ts:43` constructs
`{ classes: {}, user: … }` when there is no dataset at all. So **both** routes to "no data" serve
*five synthesized rows per class queried*, not zero.

✅ **This is not an inference — it was already pinned by a spec**, which is how it was found:
`sandbox-store.test.ts:34-39`, *"invents records for a class the editor did not predict"*,
`expect(results.length).toBe(5)`. The behaviour 1(c) rules against is the one the suite defends.

| route to "serve zero rows" | what actually happens | AC3 |
|---|---|---|
| `useSampleData: false` | shim uninstalled → **real backend** | 🔴 violated |
| ship `{ classes: {} }` | shim installed → **5 invented rows per class** | ✅ held, but not 1(c) |
| ship a class with `records: []` | that class serves 0 rows; **any class the walk missed still gets 5** | ✅ held, partial |

### ✅ Built s54 — the third state, and nothing switched on

The missing capability, with no behaviour change to any existing caller:

- **`SandboxDataset.synthesizeMissing?: boolean`** 🆕 (`noodl-runtime/src/sandbox/types.ts`).
  Defaults to `true` — `dataset?.synthesizeMissing !== false` — so `undefined`, `true` and *no
  dataset at all* are all the behaviour that shipped before it existed.
- **`SandboxStore.list()`** honours it: serves `[]` instead of synthesizing, and **still caches**,
  so `create` pushes into the same list a later `query` reads. 🔴 **An empty-state sandbox is still
  a writable one** — a form with no rows behind it has to stay previewable.
- **`buildSandboxDataset({ emptyState: true })`** 🆕 (`sandboxData.ts`). The graph walk still runs
  and the class list is still shipped — **named, and empty** — because a named class is what stops
  the store inventing it. `synthesizeMissing: false` closes the gap for a class the walk missed.
  Drops `unknownShape`: a caveat about blank rows is noise when there are no rows.
- **The summary says the emptiness is the point** — `No sample data — Books served empty, signed in
  as a sample user`. That is ruling 1's *"take (b)'s one-line caption anyway wherever an empty frame
  would otherwise read as a broken bench"*, taken.

**Specs: 5 runtime + 6 editor, both suites led by the CONTROL that made the mode necessary.**
✅ **Mutant-verified**: forcing `list()` back to always-synthesize fails 2 of the new runtime specs
while the CONTROL keeps passing — which is the right shape, since the mutant restores exactly what
the control pins. The mutation was diffed against a saved copy and the changed line printed
(`store.ts:176`), not `git diff`.

⚠️ **`buildBenchExport` is unchanged and nothing calls `emptyState` yet, on purpose.** Flipping the
bench without removing the toolbar in the same commit would make the reported bug *universal*: the
Data button is gated on `Boolean(result?.dataset)`, so every benched component — not just
`CategoryCard` — would offer a Data panel with nothing in it. That is the screenshot, spread.

### 🔴 What the flip costs, so the next session is not surprised

Two specs in `component-bench.test.ts` pin the behaviour ruling 1(c) reverses, and both must be
rewritten by the commit that flips the bench — neither is a defect:

- `:253` *"serves the bench sample data, and none against a real backend"* — asserts
  `toContain('Sample data')`. Becomes `No sample data`. ⚠️ Its **second half is ruling 4's** and is
  the `useSampleData: false` assertion that ruling asks about.
- `:265` *"takes the user's own records (BEN-006)"* — asserts a user record is served. Under 1(c)
  the bench serves none, so `userData` on `BenchMount` becomes dead weight and should go with the
  data editor. ⚠️ **The AI preview keeps both** — this is a bench-only subtraction, which is ruling 2
  answered as "the two surfaces diverge".

### ⚠️ Rulings 3 and 4 both have a branch that deletes nothing

Stated because the remaining build is otherwise blocked on Richard, and it need not be:

- **Ruling 3** — AC1 as written (*"No Sign out"*) already requires `signedIn` hard-coded in the bench
  UI. Keeping `signedIn` as a **programmatic option with no UI** loses no capability at the API
  level and is reversible.
- **Ruling 4** — the same shape: keep `useSampleData` programmatic, no UI, and
  `component-bench.test.ts:259-262` needs no edit at all.

🔴 **Both are still Richard's to answer** — this only records that neither branch is destructive, so
the answer does not have to arrive before the UI work is scoped.

---

## ✅ Built s55 — the flip, the deletion, and the summary's new home

**One commit, as §3 of s54's handover required**: the bench serves no rows *and* the toolbar that
would have advertised an empty Data panel is gone, so the reported defect is never made universal.

### What changed

- **`componentBench.ts`** — `buildBenchExport` passes **`emptyState: true`** to
  `buildSandboxDataset`. Hard-coded rather than offered as an option: a bench that can be switched
  back needs a control to switch it with, and **the control is the reported defect**.
- **`ComponentBench.tsx`** — `SandboxToolbar` and `SandboxDataEditor` mounts deleted, with the four
  pieces of state they owned (`useSampleData`, `signedIn`, `userData`, `dataOpen`). The export call
  drops three arguments and its effect drops three dependencies.
- **`useSandboxViewer`** is now called with **literal `true`s**. That is AC3, structurally: the hook
  is the *only* writer of `noodl-sandbox-data`, the runtime turns the shim off for the literal
  string `real` alone, and nothing the bench renders can now produce it.
- **`ComponentBench.module.scss`** — a `.Summary` strip in the slot the toolbar vacated.

### 🔴 The summary did NOT go where the Fix direction said, and the reason is measured

The Fix direction says relocate it *"into the chrome strip beside `BenchCaption`"*. 🔴 **That
placement would have satisfied the letter of the task and defeated AC2.** Three facts, all in the
source:

1. `describe()` appends the backwards-ports sentence **last**, after the base sentence and after
   the no-visual-root and ignored-input sentences.
2. `VisualCanvas.module.scss`'s `.BenchCaption` is a single `white-space: nowrap` line, and its own
   comment names it **the shrink zone** — *"the one genuinely redundant thing in the strip"* —
   because **BEN-004 measured the strip clipping at 640px**.
3. The strip has gained `BenchFrameControl`, `BenchSize` and FIX-019's chip since that direction was
   written at s33. It is fuller now than when the placement was chosen.

A sentence that is appended last, dropped into the element designated to be truncated first, is not
relocated — it is hidden. ✅ **So it lives in the bench, full-width and WRAPPING, with no height
cap.** ⚠️ **This is strictly better than the toolbar it replaced**, which was a 30px row with
`white-space: nowrap` and `text-overflow: ellipsis` — meaning the backwards-ports diagnostic
was *already* being clipped before anyone could read it. AC2 is met for the first time here, not
merely preserved.

⚠️ **It is not a second toolbar.** Nothing in it is clickable, so BEN-004 §7's *"do not build a
second toolbar"* is not engaged.

### ✅ Ruling 2, answered as the two surfaces DIVERGE — recorded here as the ruling requires

`SandboxToolbar`, `SandboxDataEditor` and `sandboxDataDraft` all keep their owner in
`SandboxPreview.tsx`, so **nothing is orphaned and nothing was deleted from disk**. The AI preview
keeps its toolbar, its data editor and its sample rows. 🔴 **BEN-004 §7's constraint is therefore
knowingly retired for the bench**, which is what ruling 2 said had to be written down if the answer
went this way. Ruling 2's remaining payoff — deleting those three files — is **not taken**, and is
still available if the AI preview is ever swept too.

### ✅ Rulings 3 and 4 taken on their non-destructive branch

Both survive as **programmatic options with no UI**: `signedIn` and `useSampleData` are still
parameters of `BenchMount` and still honoured by `buildBenchExport`. `component-bench.test.ts`'s
Real-backend assertions needed **no edit**, exactly as the branch predicted. Nothing is lost at the
API level and both are reversible. 🔴 **Richard's answers are still owed**; this only means the
build did not have to wait for them.

### 🔴 The fixture reads no collections — and that is the reported case, not a weak test

The first spec written for this asserted the dataset names at least one class. **It failed:
`Expected 0 to be greater than 0`.** `ShareItem` reads **no collections at all** — which is the
identical shape to the bug report's `CategoryCard`, the component whose Data panel *"has literally
nothing to edit"*.

🔴 **That makes `synthesizeMissing: false` the only thing doing any work on this component**, and it
promotes s54's addition from a gap-closer to the mechanism itself: with `classes: {}` and
synthesis left on, the bench would serve **five invented rows per class queried** — more fabricated
data than before the change meant to remove it.

⚠️ **It also caught a spec that could not fail.** The passing half of the same spec looped
`for (const klass of Object.values(shipped.classes))` asserting `records.length === 0` — over an
empty map, so it **iterated zero times and passed without measuring anything**. Both specs were
rewritten: the empty-map case is now asserted directly (`Object.keys(classes).length` is `0`, and
`synthesizeMissing` is `false`), and the populated case is pinned in a second spec that **supplies**
a class through `userData` rather than hoping the fixture has one.

---

## ✅ DRIVEN s57 (2026-08-18) — AC1 and AC2 both met in the running editor

**The task is now CLOSED for code and for drive.** Built at `346114a6` (s55), driven here on the
checkout tree with that commit as an ancestor of HEAD `fd811952`. No source was changed to drive it.

**Rig.** `npm run dev:debug`, CDP on 9222, against a `cp -R` copy of the waiting fixture
`fix013-drive` — 🔴 **whose `project.json` `name` field read `fix012-drive`**, the coin-toss the
memory warns about, so the copy's `name` was rewritten to `FIX013-S57-DRIVE-COPY` **before** driving
and every reading below is provably about that project (the window title in the screenshot carries
it, and the card matched **1 of 46** in the launcher). The source fixture is byte-identical
afterwards (`30c47070…`, checked before and after). The copy and its launcher-recents entry were
removed at teardown.

### AC1 — the four controls are gone, the five parts are there

Measured by `data-test` hook rather than by visible text, because 🔴 **a text search for
`"Sample data"` FALSE-POSITIVES on the summary itself** — ruling 1(c)'s caption is the literal
string `No sample data — signed in as a sample user`.

| | `/Probe` | `/App` |
|---|---|---|
| frame · inputs rail · outputs rail · scenario bar · summary | ✅ 5/5 | ✅ 5/5 |
| `sandbox-auth-toggle` (Sign out) | 0 | 0 |
| `sandbox-data-toggle` (Data) | 0 | 0 |
| `sandbox-sample-data` (Sample data) | 0 | 0 |
| `sandbox-real-backend` (Real backend) | 0 | 0 |
| `Apply` button · Apply-banner text | 0 · absent | 0 · absent |

🔴 **The absence is asserted beside a KNOWN-FIRING signal, and the first attempt at that control
FAILED — which is the finding.** The real `SandboxToolbar` was mounted from the webpack module cache
into the bench's own subtree and the *identical* query re-run:

```
BEFORE   auth=0 data=0 sample=0 real=0
CONTROL  auth=1 data=1 sample=1 real=1     ← labels read "Sign out", "Data", "Sample data", "Real backend"
AFTER    auth=0 data=0 sample=0 real=0
```

⚠️ **A first control run reported `0 0 0 0` and would have been recorded as a passing absence check
had the control row not been read.** The cause was the instrument, not the app: `SandboxToolbar` and
`SandboxDataEditor` were mounted as siblings, `SandboxDataEditor` threw, and React discarded the
**whole** tree — including the toolbar that was supposed to be firing. Mounted alone, the toolbar
fires 4/4. 🔴 **A control that reads zero is indistinguishable from the absence it is supposed to
license; read the control row before the measurement row.**

✅ **Static corroboration, independent of the DOM:** `ComponentBench.tsx` references neither
`SandboxToolbar` nor `SandboxDataEditor` nor `sandboxDataDraft` — grep returns nothing. Their only
importer is `SandboxPreview.tsx`, which is exactly ruling 2's divergence, still standing.

### AC2 — the backwards-ports sentence, in full, wrapped, unclipped

`/Probe`'s summary, read verbatim off the live DOM:

> /Probe on the bench — 6 inputs, 5 outputs. "pBackwards" is declared on a Component Inputs node with
> plug "input", which publishes it as a component OUTPUT — it must be plugged "output" to be settable
> here. No sample data — signed in as a sample user

| measure | reading |
|---|---|
| whole backwards clause present | ✅ `true` (compared against the whole clause, not a substring) |
| `white-space` | `normal` — **not** `nowrap` |
| `text-overflow` | `clip`; no `…` anywhere in the text |
| rendered box | 48px tall at `line-height: 17.4px`, `font-size: 12px`, width 988px |
| wrapped | ✅ ≈2.75 line-heights — it is on more than one line |
| clipped horizontally | ❌ no — probed with `scrollLeft`, **not** `scrollWidth` (integer-rounded) |
| clipped vertically | ❌ no — probed with `scrollTop` |

✅ **Negative control:** `/App`, which has no backwards port, gets **no** backwards sentence
(`/App on the bench — 0 inputs, 0 outputs. No sample data — signed in as a sample user`). The
diagnostic is driven by the port, not printed unconditionally.

✅ **`workbench-1.png` is the BEFORE, and the comparison is exact.** That screenshot shows all four
buttons, the open Data panel, the Apply banner — and a summary **cut off mid-word**: *"…signed in as
a sample us"*. The same clause now renders complete, on two lines. **AC2 is met for the first time
here, not merely preserved** — as s55 predicted from the source.

⚠️ **`ComponentBench`'s `useTrackBounds` history did not repeat.** s55's `.Summary` is conditionally
rendered but holds no ref; the preview surface mounted and stayed up across the whole drive.

### 🔴 Two facts the build's own write-up gets slightly wrong

1. **The backwards sentence is no longer last.** `componentBench.ts:489` appends
   `dataset.summary` after `describe()`, so ruling 1(c)'s caption trails it. The "appended last,
   dropped into the shrink zone" argument for the placement still holds — it is second-to-last, and
   it wraps — but the wording in §"The summary did NOT go where the Fix direction said" is no longer
   literally true of the shipped string.
2. **`/Probe` reports 5 outputs, not 4.** `benchInterface` reads `component.getPorts()`, the
   *published* interface, so `pBackwards` — plugged `"input"` on `Component Inputs` — is counted as
   an **output**, and the outputs rail lists it beside `oStr`, `oNum`, `oAB`, `oNone`. The count and
   the sentence are consistent with each other; a reader predicting "4 outputs" from the
   `Component Outputs` node alone will mis-predict. Worth knowing before writing an assertion on it.

---

## ✅ RULINGS 3 AND 4 — Richard, 2026-08-18 (session 61): **the non-destructive branch, both.**

Both rulings had a branch that deletes nothing, and that is the branch taken:

- ✅ **Ruling 3 → keep `signedIn` as a programmatic option with NO UI.** AC1 as written (*"No Sign
  out"*) already requires it hard-coded in the bench UI; keeping the option at the API level loses no
  capability and is reversible.
- ✅ **Ruling 4 → keep `useSampleData` programmatic, no UI.** ⚠️ **`component-bench.test.ts:259-262`
  needs no edit at all** — which is the practical content of this answer.

🔴 **Neither branch deletes anything, so there is no build and no spec rewrite.** These were the two
rulings whose *other* branch would have been a deletion someone had to authorise; that authorisation
was not given and is not needed.

🔴 **What was already closed at s57 is untouched:** `useSampleData` is **not** the switch;
`emptyState` **predates** the fix (11 occurrences in the Aug-13 app); `emptyState` must keep shipping
the class list **named**; `synthesizeMissing` defaults `true` and the bench sends `false`; `list()`
caches the empty array; the bench summary must keep **wrapping**; `ComponentBench` imports neither
`SandboxToolbar` nor `SandboxDataEditor`; and ruling 2's answer stands — **the two surfaces diverge,
and the AI preview keeps its toolbar and data editor.**

✅ **FIX-013 remains CLOSED.** These answers close the last two open questions attached to it.
