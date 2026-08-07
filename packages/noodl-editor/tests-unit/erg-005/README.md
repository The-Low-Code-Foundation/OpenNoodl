# ERG-005 §1 — specification tests for work that does not exist yet

**These two files are `.pending.ts`, not `.test.ts`, and that is deliberate.**
`jest.config.js`'s `testMatch` only collects `*.spec.*` / `*.test.*`, so nothing
here runs. They are committed as an executable specification, waiting for the
implementation they describe.

## Why they are parked rather than skipped

They were written before ERG-005 §1 was built and committed without it. As
`*.test.ts` they made `test:main` — a PR CI gate — red for everyone:
`componentContract` did not compile at all, and `validatorComponentContract` ran
5 green / 3 red.

They are **not** `describe.skip`. This repo has already shipped a feature that
never worked hidden behind eleven skipping assertions (F62), and a skipped test
inside a collected file reads as "covered" in every summary that matters. A file
jest does not collect, named `.pending`, with this README beside it, is the
honest version of the same thing: nothing is hidden, nothing is claimed, and the
spec is still here.

Filed as **F81** in `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md`.

## What is actually missing

A component's interface is **never written to disk**. `ComponentModel.toJSON()`
emits `{ name, id, graph, metadata }` — verified 2026-08-06 at
`src/editor/src/models/componentmodel.ts:359-366`, and against
`tests/testfs/import_proj5/project.json`, where 0 of 2 components carry a `ports`
key. The `ports` getter at `componentmodel.ts:369` is `getPorts()`, an in-memory
derivation that exists only while the editor is running.

So ERG-005 §1 is three changes, not one:

1. **Serialise the contract.** `ComponentModel.toJSON()` emits the derived ports,
   in both on-disk formats. This touches the project save path.
2. **`componentPorts()` returns port objects, not bare names**
   (`models/AiAssistant/explain/graph.ts:69`), plus a `formatComponentPort`, and
   `GraphComponent` (`explain/types.ts:48`) gains `ports?`. Falls back to the
   port nodes when the contract is absent *or empty*.
3. **The validator consults the contract** — `NormComponent` (`validation/model.ts:52`)
   gains `ports?`, `normalize.ts` carries it, and `rules/nonexistentPort.ts` +
   `rules/typeIncompatibleConnection.ts` stop skipping component-ref endpoints
   when a contract exists.

## Why it was not built on 2026-08-06

Step 1 changes what the editor writes to `project.json`. That is the same surface
ALPHA-001 §4 (the app-name round trip against the 1s debounce) exists to measure,
and the session it surfaced in was the alpha go/no-go run. Landing a save-path
change into the tree being audited would have invalidated the audit.

## To turn them on

Rename both to `*.test.ts` and build the three changes above. Each case was
chosen to fail without the specific change it covers — including the two that
matter most: an empty `ports: []` is a *recorded* answer and must not fold into
"no contract", and `plug` is the direction **on the instance**, so an instance
input is a Component *Input* even though `ComponentModel.getPorts()` builds it
from a map called `outputsMap`. Getting that backwards produces a plausible,
fully populated, completely reversed interface.
