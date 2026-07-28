# NDA-001: Node Behaviour Corpus

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-001 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 1 — must land before any fix in this phase |
| **Priority** | 🔴 Critical — every other task is measured against it |
| **Difficulty** | 🟠 Medium — the tests are simple; harnessing the runtime headlessly is the work |
| **Estimated Time** | 4–6 days |
| **Prerequisites** | None |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — the symptoms are known, the harness is the opaque part |

## Objective

Turn every symptom in [`FINDINGS.md`](./FINDINGS.md) into a **failing test**, before anything is
fixed. NDA-002 and NDA-003 change behaviour that every stateful node in the library depends on;
without a corpus, "did that break anything" is unanswerable.

## Why this is first

The reactivity fix in NDA-002 adds notifications where there were none. That is exactly the kind of
change that turns a silent bug into a render loop somewhere else — `outputproperty.ts:123` already
has a 500-sends-per-iteration circuit breaker and `node.ts` a 100-iteration one, which tells you the
runtime has met this class of problem before. A corpus is how that gets caught in CI rather than in
Richard's editor.

## What the corpus must cover

Each of these is a test that **fails today**. That is the acceptance criterion — a test that passes
on the current tree is testing the bug, not the fix.

### Reactivity

| # | Scenario | Expected | Today |
|---|---|---|---|
| R1 | `collection.push(item)` | `change` fires | silent |
| R2 | `collection.splice(0, 1)` | `change` fires | silent |
| R3 | `collection[0] = x` | `change` fires | silent |
| R4 | `collection.items.push(item)` | `change` fires | silent (`items` **is** the array) |
| R5 | `collection.length = 0` | `change` fires | silent |
| R6 | `collection.add(item)` | `change` fires | ✅ passes — pin it |
| R7 | Variable set to its `startValue` | `changed` fires | silent |
| R8 | `States` A→B→A in one update pass | `stateChanged` fires (twice, or at minimum once) | fires **zero** times |
| R9 | `States` A→B→A: `reached-B` | fires | never fires |
| R10 | Object property set from a Function node | Object node's `change` fires | ✅ passes — pin it |

### Empty values

| # | Scenario | Expected | Today |
|---|---|---|---|
| E1 | String variable ← `null` | stores `''` (or defined equivalent) | stores the text `"null"` |
| E2 | String variable ← `undefined` | unchanged | stores the text `"undefined"` |
| E3 | Number variable ← `null` | defined behaviour, distinguishable from `0` | `0` |
| E4 | Number variable ← `undefined` | unchanged | `NaN`, and then `changed` fires on **every** subsequent set |
| E5 | Set Object Properties ← `null` | clears the key | writes `null` (correct, but untested) |
| E6 | Set Object Properties ← `undefined` | leaves the key alone | skipped (correct, but untested) |
| E7 | Array node ← `undefined` | leaves it alone | returns early (correct, but untested) |
| E8 | Value goes non-null → null → non-null | two changes observed | end-to-end unverified |

E8 is Richard's exact report and is the single most important test in the corpus. It needs to run
**through a graph**, node-to-node, not by calling `Model.set` directly — `Model` is already correct
(`model.ts:314-339`), so a unit test on it would pass and prove nothing.

### Failure reporting

| # | Scenario | Expected | Today |
|---|---|---|---|
| F1 | Run Tasks with a template whose output is named `Done`, not `Success` | a warning | silence, forever |
| F2 | Two Show Popup nodes fire in the same frame | one popup, or a defined stack policy | two stacked popups |
| F3 | Columns + Repeater | children carry column widths | children render unwrapped |

## Approach

Prefer the **existing** harness over a new one. Three already exist in this repo and the recipes are
written down:

- the headless-editor-export recipe (4 shims) from SUB-009 / `packages/noodl-preview`;
- the headless registry loading via esbuild + shims from SUB-004;
- the NodeGX QA fixture, which is a committed project with load-bearing structure.

R1–R6 and E1–E4 are pure runtime and need no editor at all — they can run under the existing jest
setup in `packages/noodl-runtime`. R8/R9, E5–E8 and F1–F3 need a real graph and an update loop, which
is where the headless viewer harness earns its place.

⚠️ **Trap, recorded from PLAT-003:** the viewer's ts-jest target is pre-ES2015, and `Collection`
patches `Array.prototype` — which is load-bearing. A corpus that imports `collection.ts` into a test
file changes `Array.prototype` for *every* test in that worker. Isolate it.

## Success criteria

1. Every row above exists as a named test.
2. Every row marked "fails today" fails, for the stated reason, on an unmodified tree.
3. Rows marked ✅ pass and are pinned, so NDA-002 cannot regress them.
4. The suite runs in CI, in a workflow that actually executes it — six jest suites were found in *no*
   workflow during RUN-004, so verify the wiring rather than assuming it.
5. `dev-docs` records which of the corpus each later task is expected to turn green.

## Out of scope

Fixing anything. This task lands a red suite. NDA-002 and NDA-003 turn it green.
