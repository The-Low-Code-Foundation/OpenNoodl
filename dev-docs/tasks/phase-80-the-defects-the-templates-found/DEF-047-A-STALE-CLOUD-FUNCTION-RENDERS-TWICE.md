# DEF-047 — A stale cloud function renders twice, as a tick and as a warning

> **Status:** ✅ **BUILT s45 (2026-09-03)**
> **Source:** the unowned register in [TASKS.md](TASKS.md), owner `NONE`, found by DEF-015 s12 in
> its own AC2 control frame and visible in that session's screenshot.
> **Bites:** anybody who deletes a cloud function and looks at the backend card afterwards — the
> panel tells them the function is both fine and wrong, one line apart.

---

## 1. The defect

`CloudFunctionsSection` drew its list from four overlapping arrays with five sibling `.map()`
calls. The first mapped `backendFunctions` — everything `GET /admin/workflows` reports — with a
green ✓. The third mapped `stale`, which is *defined as a subset of `backendFunctions`*, with an
amber warning triangle:

```ts
const stale = backendFunctions.filter((name) => !endpoints.includes(name));
…
{backendFunctions.map((name) => (<li …><Icon icon={IconName.Check} …/>{name}</li>))}
{stale.map((name) => (<li …><Icon icon={IconName.WarningTriangle} …/>{name} — on this backend, not in the project</li>))}
```

So a function the backend still serves that the project no longer has appeared **twice**: once as
a healthy row and once as a problem row. Nothing reconciled them and nothing could, because the
two rows are produced by two different loops over two different sets that happen to intersect.

Re-measured at HEAD before building — the register's own citation (`CloudFunctionsSection.tsx:123`
filters `stale` out of `backendFunctions`) was **the wrong way round**: `:123` *defines* `stale`
from `backendFunctions` and filters nothing out of it. The defect is real, the line reference is
right, the sentence describing it was not.

---

## 2. 🔴 Why it survived: nothing in this repo could grade it

The classification lived **inside the JSX**, and `CloudFunctionsSection` cannot be mounted by any
runner here:

- `tests-unit` is `testEnvironment: 'node'` — no jsdom, no `@testing-library/react`, and `Icon`
  alone makes a spec fail *to run* (`Tests: 0 total`, not a red assertion).
- the Electron jasmine suite (`tests/`) can render, but no spec in it names this component; the
  grep for `CloudFunctionsSection` and `cloud-function-live` across `tests/` and `tests-unit/`
  returns **nothing**.

So the panel has drawn contradictory rows since WFA-001, was screenshotted doing it, and was
registered as *"trivially fixed"* — and the reason it was not fixed is not that it was too small.
It is that a one-line filter would have been ungradeable too.

---

## 3. What was built

**A pure classifier, and one map in the view.**
[`cloudFunctionRows.ts`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/cloudFunctionRows.ts)
takes the project's cloud components and the backend's function list and returns **one ordered
list of row descriptors** — `{ kind, key, testId, text }` — plus the endpoint count the
backend-stopped sentence needs. The view holds a single `rows.map(...)` and a `kind → icon` table,
and classifies nothing.

🔴 **The fix is not a filter.** Filtering `stale` out of the tick map closes this instance and
leaves the shape that produced it: five maps over four overlapping arrays, where any future bucket
can overlap any other and nothing says so. With one pass, a name drawn twice is not a bug to
re-fix — it is unrepresentable, and the cardinality is asserted rather than assumed.

⚠️ **Every shipped `data-test` id is carried in the row unchanged** (`cloud-function-live-<name>`,
`cloud-function-missing-<name>`, `cloud-function-stale-<name>`, `cloud-workers-<backendId>`,
`cloud-component-unreachable-<name>`), and so is the row order, so a drive or a screenshot reads
the panel exactly as before.

### 3.1 One behaviour change, deliberate: `stale` is measured against the whole project

`stale` was `backendFunctions` minus **endpoints**. That set can contain a name the project *does*
hold — as a `worker` — and the row's sentence, *"on this backend, not in the project"*, would then
be false. It is now `backendFunctions` minus **every cloud component of any role**, so every
sentence the section says is true of every row it draws.

⚠️ **On the population that exists today the two definitions coincide**, because the backend's
list is the components holding a Request node (DEF-015 §1). This is written down rather than left
to be discovered: it is the definition under which the wording stays honest on a population nobody
has produced yet. `missing` is unchanged and still **endpoints only**, which is DEF-015's ruling —
a worker has no route to be absent from.

---

## 4. Gates

| gate | reading |
| --- | --- |
| `tests-unit/def-047/cloud-function-rows.test.ts` | **7/7, exit 0** |
| **reverted arm** — the pre-fix shape restored inside `cloudFunctionRows` (a tick for every backend name, plus a separate stale pass) | **1 suite failed, 3 red / 4 passed** — and the three reds are the three defect assertions: the single-stale-row case, the no-name-drawn-twice cardinality case, and the whole-project `stale` case. The four that stay green are about `missing`, workers, unreachable keys and the empty control, none of which this defect touches |
| `tsc -p packages/noodl-editor --noEmit` | **exit 0**, 0 `error TS` |

✅ **`test:ci` TAKEN — 2943 specs, 5 failures, seed 13203, HEAD `2f5c7ef5`**, fresh
`test-results.json`. Four are the `AIX-006 style vocabulary` floor, by name. **The fifth is not
this change**, and that is measured rather than argued:

- it reproduces **deterministically at the same seed**, so it is order-dependent, not random;
- **the control — the same seed with this fix reverted in the tree — reads the same 5 failures.**
  ✅ Source reverted, never a spec: the seeded shuffle depends on the SPEC SET, so removing one spec
  would have changed the order and destroyed the control. This fix's spec lives in `tests-unit/`,
  which the test-CI bundle does not compile, so the set was provably identical — 2943 in both arms;
- **DEF-007 s38 already met the same spec** as a lone fifth red and re-seeded it away
  (70598 → 76055). It is `projectsaveflush.js`, a timing spec that polls the disk after the
  1000 ms debounce, and its own header records that `saveOnModelChange`, `savePending` and
  `ProjectModel.instance` are module globals whose leakage makes the next spec file order-dependent.

⚠️ **That leak is an unowned gate defect, twice sighted.** Not a product defect, so it is not a DEF
row — but a session that meets a fifth red should check this name before its own change.

⚠️ **What the gate cannot prove:** that the JSX renders one `<li>` per row. That is structural now
— a single map, and no second list for it to disagree with — rather than asserted, because the
component cannot be mounted here. A screen would confirm it; the panel needs a running local
backend serving a function the project has since deleted.
