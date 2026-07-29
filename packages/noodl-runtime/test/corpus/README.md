# NDA-001 — the node behaviour corpus

Every symptom in [`dev-docs/tasks/phase-30-node-library-audit/FINDINGS.md`](../../../../dev-docs/tasks/phase-30-node-library-audit/FINDINGS.md),
turned into a named test **before** anything is fixed. Task spec:
[`NDA-001-NODE-BEHAVIOUR-CORPUS.md`](../../../../dev-docs/tasks/phase-30-node-library-audit/NDA-001-NODE-BEHAVIOUR-CORPUS.md).

This is the ruler the rest of phase 30 is measured with. NDA-002 and NDA-003 change behaviour
that every stateful node depends on; without this, "did that break anything" is unanswerable.

## Where it lives

The corpus spans two packages, because the nodes do.

| Rows | File |
|---|---|
| R1–R6 | `packages/noodl-runtime/test/corpus/nda-001-collection-reactivity.test.ts` |
| R7, E1–E4 | `packages/noodl-runtime/test/corpus/nda-001-variable-values.test.ts` |
| R10, E5, E6, E8 | `packages/noodl-runtime/test/corpus/nda-001-object-graph.test.ts` |
| F1 | `packages/noodl-runtime/test/corpus/nda-001-failure-reporting.test.ts` |
| R8, R9 | `packages/noodl-viewer-react/tests/corpus/nda-001-states-reactivity.test.ts` |
| E7 | `packages/noodl-viewer-react/tests/corpus/nda-001-array-node-empty.test.ts` |
| F2 | `packages/noodl-viewer-react/tests/corpus/nda-001-popup-stacking.test.ts` |
| F3 | `packages/noodl-viewer-react/tests/corpus/nda-001-columns-repeater.test.tsx` |

Two shared pieces sit here:

- **`graph-harness.ts`** — a `GraphModel` imported from editor data, a `NodeScope` per
  component, a recording `editorConnection`, and `update()` / `frame(dt)` / `settle()` as the
  frame boundary. Both packages use it; the viewer's files import it across the package
  boundary rather than keeping a second copy. Use `helpers/node-harness.ts` instead when a row
  needs one isolated node — that is still the right tool for R1–R7 and E1–E4.
- **`expected-failure.ts`** — declares `test.failing` for the `@types/jest` 27 that actually
  resolves in this monorepo (Jest itself is 29.7 and has the feature). Each corpus file
  imports it for the side effect, so it applies where it is used and nowhere else.

## How to run it

```sh
# What CI runs — includes both corpus suites, among everything else.
npm run test:packages

# Just the corpus, while working on a row.
npm --prefix packages/noodl-runtime      exec -- jest test/corpus
npm --prefix packages/noodl-viewer-react exec -- jest tests/corpus
```

CI runs it through the `test-packages` job in `.github/workflows/pr.yml`, which calls
`npm run test:packages` → `lerna run test --scope @noodl/runtime --scope
@noodl/noodl-viewer-react …` → each package's `jest`. Both corpus directories are matched by
the default `testMatch`, so nothing had to be wired specially — but the wiring was *verified*
by running the exact CI command, because RUN-004 found six suites that were in no workflow at
all.

## Red tests that are green in CI

A permanently red suite would break CI for everyone until NDA-002/003 land. Every row that
fails today is therefore marked **`test.failing`**, which:

- passes while the body throws — so the suite is green and CI stays usable;
- **fails when the body stops throwing** — so a fix cannot land quietly. The task that fixes a
  row must delete the marker in the same commit, which is the point.

`test.failing` is a skip's opposite: the behaviour is named, executed and asserted every run.
Rows marked ✅ are ordinary `test` and are pinned so NDA-002/003 cannot regress them.

## Row status

`fails` = `test.failing`, red for the reason given. `pinned` = passes and is guarded.

### Reactivity — all closed by NDA-002

The reactivity rows were red on the unmodified tree for the reasons in the last column;
[NDA-002](../../../../dev-docs/tasks/phase-30-node-library-audit/NDA-002-REACTIVITY-CONTRACT.md)
turned every one of them green and they are pinned in that direction now. The normative
statement of what they enforce is
[`dev-docs/reference/REACTIVITY-CONTRACT.md`](../../../../dev-docs/reference/REACTIVITY-CONTRACT.md).

| # | Test | Status | What used to happen |
|---|---|---|---|
| R1 | `R1: collection.push(item) fires change` | **pinned** | 0 notifications. `push` is the native method; the patch never wrapped it. |
| R2 | `R2: collection.splice(0, 1) fires change` | **pinned** | 0 notifications. |
| R3 | `R3: collection[0] = item fires change` | **pinned** | 0 notifications. |
| R4 | `R4: collection.items.push(item) fires change` | **pinned** | 0 notifications — `items` handed back the raw array. It returns the notifying Proxy now, which is the reference a consumer already holds, so `items === collection` still reads true. |
| R5 | `R5: collection.length = 0 fires change` | **pinned** | 0 notifications; the array emptied silently. |
| R6 | `R6: collection.add(item) fires change` | **pinned** | 1 notification, delivered a microtask late. |
| R7 | `R7: setting a Variable to its startValue fires changed` | **pinned** | `signals` was `[]` — `initialize` had already seeded `currentValue`. |
| R8 | `R8: stateChanged fires for a state change that happened and came back` | **pinned** | 0 `stateChanged`. Both requests coalesced in one pass; the survivor equalled the current state. |
| R9 | `R9: reached-B fires when B is passed through` | **pinned** | 0 hits. B was never entered, so no transition started and `onFinish` never ran. |
| R10 | `R10: Function node → Set Object Properties → Object node fires changed` | **pinned** | `changed` fires; the record carries the function's value. |

⚠️ One pinned row was deliberately **inverted** rather than kept: `R6 (corollary)` recorded
that `add` notified *asynchronously*, which the contract's third clause outlaws. It now pins
synchronous delivery. Two further collection corollaries were added with NDA-002 — one `set`
emits N structural events and a single `change`, a no-op `set` is silent, and a throwing
listener does not silence the ones behind it.

### Empty values

| # | Test | Status | What actually happens |
|---|---|---|---|
| E1 | `E1: a String Variable fed null stores an empty value…` | fails | Stores the four-character text `"null"`. |
| E2 | `E2: a String Variable fed undefined is left alone` | fails | Stores `"undefined"`, and fires a spurious `changed`. |
| E3 | `E3: a Number Variable fed null is distinguishable from a real zero` | fails | Both hold `0`; cleared and zero are the same state. |
| E4 | `E4: a Number Variable fed undefined is left alone` | fails | Stores `NaN`. |
| E4′ | `E4 (corollary): once NaN lands, changed stops meaning anything` | fails | 3 `changed` for 3 identical sets — `NaN !== NaN`. |
| E5 | `E5: Set Object Properties fed null writes null onto the record` | **pinned** | Writes `null`; `Model` notifies. |
| E6 | `E6: Set Object Properties fed undefined leaves the key alone` | fails | Writes `''` — see the spec correction below. |
| E6′ | `E6 (untyped): …with no declared type also leaves the key alone` | fails | Writes `undefined` over the record's real content. |
| E7 | `E7: an Array node fed undefined items leaves its collection alone` | **pinned** | Returns early; the collection is untouched. |
| E8 | `E8: two changes are observed downstream, and the cleared state is empty` | fails | Downstream sees `['hello', 'null', 'world']` — two changes *are* observed, but the cleared state arrives as truthy text. |
| E8′ | `E8 (pinned): a null crossing a bare connection is delivered` | **pinned** | `['hello', null, 'world']`. |

### Failure reporting

| # | Test | Status | What actually happens |
|---|---|---|---|
| F1 | `F1: a template whose output is named Done produces a warning` | fails | No warning, ever. |
| F1′ | `F1 (corollary): …does not leave the run hung for ever` | fails | 0 signals after 20 frames; the node stays `running`. |
| F2 | `F2: two Show Popup nodes in one frame produce one popup…` | fails | Two `showPopup` calls; two stacked dialogs. |
| F3 | `F3: every child of a Columns node is given a column wrapper` | fails | 2 wrappers for 3 children — the Repeater is filtered out. |
| F3′ | `F3 (corollary): Columns is visible on its first render` | fails | `visibility:hidden` until a `ResizeObserver` callback that never comes under SSR. |

Alongside these, seven **pinned controls** exist so that a red row can never be mistaken for a
broken harness — each one drives the same code path in the case that *does* work:
`R6 (corollary)`, `R7 (pinned)`, `F1 (pinned control)`, both `R8–R9 (pinned control)` rows,
`E7 (pinned)`, `F2 (pinned)` and `F3 (pinned control)`. They stayed green through NDA-002,
which is what makes "R8 fires twice now" a fix rather than a shrug.

## Which task turns which row green

Criterion 5 of the task. A task that lands must delete the `test.failing` marker on its rows
in the same commit.

| Task | Rows it should turn green |
|---|---|
| ✅ **NDA-002** — the reactivity contract | R1, R2, R3, R4, R5 (§2), R7 (§3), R8, R9 (§4) — done; R6 and R10 undisturbed |
| **NDA-003** — defined semantics for empty | E1, E2, E3, E4, E4′, E6, E6′, E8 (and must not disturb E5, E7, E8′) |
| **NDA-006** — `Columns` rework | F3, F3′ |
| **NDA-010** — popup targeting and stack policy | F2 |
| **Run Tasks / defect class D** (owner TBD, see `NODE-REGISTER.md`) | F1, F1′ |

## Two corrections to the task spec, found by running it

1. **E6 is not ✅.** The spec marks "Set Object Properties ← `undefined`" as *"skipped
   (correct, but untested)"*, reading the `if (value !== undefined)` guard at
   `modelcrudbase.ts:308`. That guard has an `else`, and the `else` writes
   `_defaultValueForType[type]` — so an `undefined` does not leave the key alone, it
   **overwrites** the record's real content with `''` (typed) or `undefined` (untyped). E6 is a
   failing row, and NDA-003 owns it.

2. **E8's "two changes" half already works.** A `null` does cross a wire, and it does reach an
   Object node's property — both pinned. What fails is what the cleared state *is* by the time
   a downstream node sees it: a String Variable's `cast: String` turns it into the text
   `"null"`, which is truthy, so every downstream `Condition` takes the wrong branch and every
   Text node shows four characters of garbage. That is the end-to-end statement of Richard's
   report, and it is what NDA-003 has to close.

## Limitations, recorded rather than hidden

- **F2 is a proxy.** The row says "two stacked popups"; the test observes two
  `context.showPopup` calls. That is the boundary the node owns — everything past it is
  `PopupManager` and a real DOM — and the second call *is* the defect. A live-DOM version
  belongs with NDA-010's own verification.
- **F3 is a proxy.** `Columns` is rendered directly through `react-dom/server` rather than with
  a live Repeater: a Repeater needs a mounted DOM, a `ResizeObserver` and a component scope,
  none of which exist under `testEnvironment: node`. What is asserted is the mechanism the
  source actually implements — a `ForEachComponent` child is denied a column wrapper — which is
  what NDA-006 has to remove. `ForEachComponent` itself renders `null`, so the wrapper *count*
  is the observable, not the wrapper's contents.
- **R9 depends on a driven clock.** `reached-<state>` fires from a transition timer, so the
  harness advances `context.currentFrameTime` by hand. The pinned control proves the clock
  works; without it, "never fires" would be indistinguishable from "nothing asked for a frame".
- **`Array.prototype` is patched by importing `src/collection`.** Jest gives each test *file*
  its own globals, so the patch cannot reach an unrelated suite — but only while the collection
  rows stay in their own file. Keep them there.
