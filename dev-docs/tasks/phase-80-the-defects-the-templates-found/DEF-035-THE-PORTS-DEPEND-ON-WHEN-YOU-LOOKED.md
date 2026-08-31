# DEF-035 — which ports exist depends on when you looked

**Status:** ✅ **BUILT s33** — AC1–AC4 met. **AC5 (the drive) is owed.**
**Registered by:** P77 [D13](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d13), second half.
**Who it bites:** every author who exports before the editor has spoken to their backend.

---

## 1. What was wrong

`dbCollections` is the only home of a built-in backend's schema. It is **project
metadata**, so `setMetaData` schedules a project save and it lives on disk.
`resolveSchemaPortContext` reads it; `recordFieldPorts` mints one `prop-<column>`
port per column of the selected class.

`SchemaHandler` fetched that schema on exactly two triggers — `window-focused` and
`Model.cloudServicesChanged` — and `_store()` wrote `dbCollections = undefined` on
**every** outcome that was not a successful read. A stopped backend, a backend
mid-restart, a backend that had not registered with `BackendManager` yet, and a
window focused three seconds before the backend finished starting all took the
same branch.

So the port set was a function of *when the human last clicked the window*, and a
focus event arriving at the wrong moment did not merely fail to refresh the cache —
it **deleted it, to disk**.

### The contract that was written and not honoured

`fetchBuiltInSchema`'s own docblock already said the caller

> distinguishes "there is nothing to cache" from "the cache is empty", because the
> second wipes the ports of a project whose backend is merely asleep.

It returned `undefined` for both cases, and `_store()` wiped on `undefined`. Two
other modules — `BackendServices/projectCollections.ts` and
`AiAssistant/review/backendSummary.ts` — had each *documented* the wipe and worked
**around** it downstream (AAQ-011 F8's "unknown, not absent" branch). Nobody had
fixed it, and the port generator has no such workaround: it just mints nothing.

---

## 2. The measurements

### 2.1 The control pair — the ports really are a function of the cache

Run against the runtime's own generator (`record-ports.ts` esbuild-bundled to CJS
from `src`, driven from plain Node), fixture in the backend's own `{name, columns}`
shape because that is what `SchemaHandler` caches:

| `dbCollections` | `ctx.source` | collections | `prop-*` ports |
| --- | --- | --- | --- |
| `[Puppy]` — **warm** | `dbCollections` | 1 | `prop-name`, `prop-age`, `prop-bio` |
| `undefined` — **cold / wiped** | `none` | 0 | **none** |
| `[]` — backend answered, no tables | `none` | 0 | none |

⚠️ **`[]` and `undefined` are indistinguishable at the port generator.** The
distinction `_store()` draws between them matters to `builtInSchemaCollections` and
`buildBackendSummary`, not to the ports — and the fix preserves it for those two.

### 2.2 The blast radius, on the population that could exhibit it

A wire into a port that does not exist is `con-no-target-port`, which
`NodeGraphModel.evaluateConnectionHealth` raises at **`level: 'error'`**
(`NodeGraphModel.ts:838-848`) — and DEF-034 established that an error is precisely
what still deletes a wire from an export. So every schema-derived record wire is
missing from a build taken while the cache is cold.

Scanned across **118 real projects** (78 legacy `project.json` + 40 v2 directories),
**63,685 connections**:

| | wires | projects |
| --- | ---: | ---: |
| `prop-*` wires, all | 9,051 | 56 |
| **schema-derived — at risk** | **3,783** | **28** |
| non-schema `prop-*` — immune | 5,268 | — |

🔴 **The prefix is not the population.** `Model2` (4,131), `NewModel` (500) and
`SetModelProperties` (291) also spell their ports `prop-<name>`, but those come from
a **`properties` string list saved in the node's own parameters**
(`modelnode2.ts:505`, `modelcrudbase.ts:380`) and no backend schema is involved.
Counting the prefix would have overstated the defect by 2.4×.

The at-risk set is the six types that go through `resolveSchemaPortContext`:

| node type | wires |
| --- | ---: |
| `DbModel2` | 1,950 |
| `NewDbModelProperties` | 1,159 |
| `SetDbModelProperties` | 418 |
| `net.noodl.user.User` | 193 |
| `net.noodl.user.SignUp` | 35 |
| `net.noodl.user.SetUserProperties` | 28 |

Worst-affected projects: `emdashdev` 1,837 · `Resourceful` 358 ·
`30d29729-…` 305 · `hsseq-test-main` 232 · `LearnBook` 174.

### 2.3 The witness P77 already had

P77 s17 watched a project's unhealthy-node census move **19 → 4 on its own, with no
edit**, between 14:18:32 and 14:22:57. That is this defect healing itself: a later
focus event arriving after the backend had finished starting.

---

## 3. What was built

### 3.1 `utils/schemaCachePolicy.ts` — three outcomes, not two

Import-free, so the judgement is gradeable in `tests-unit/` while the reading of
singletons stays in `schemahandler.ts` — the split the codebase already makes in
`BackendServices/projectCollections.ts`.

| outcome | means | cache |
| --- | --- | --- |
| `schema` | the backend answered | **replaced**, including with `[]` |
| `not-applicable` | no endpoint, or a foreign Parse server | **cleared** |
| `unavailable` | stopped, restarting, unregistered, no `ipcRenderer`, unreadable reply | **untouched** |

`fetchBuiltInSchema` now returns one of those with a reason instead of
`unknown[] | undefined`, and `_fetch` no longer pre-clears its fields before trying.

🔴 **"No managed backend matches this endpoint" is `unavailable`, not
`not-applicable`.** At editor start `backend:list` can answer before
`BackendManager` has registered the project's own backend — the exact window §2.3
measured. Clearing there would delete the ports of a project whose backend is
thirty seconds from ready.

🧭 **The trade, stated so nobody has to re-derive it.** A backend *deleted* while
`cloudservices` still points at it now leaves a stale cache behind. That is
deliberate: a stale schema mints ports a wire can land on; an absent one deletes the
wire from the build. The first is visible and recoverable, the second is silent and
destroys work. Unbinding the project — the act that actually means "not mine any
more" — raises `cloudServicesChanged` and resolves to `not-applicable`, which clears.

### 3.2 The trigger that was missing

`BackendManager` has broadcast `backend:statusChanged` on create/start/stop/delete
and on unexpected exit since WFA-005, and `SchemaHandler` was not listening.
It now is, and the constructor also fetches once — `EditorPage` builds it on project
open, and opening a project from the picker never leaves the window, so there was no
focus event to wait for and the first export of a session read whatever the previous
session left on disk.

### 3.3 Prose corrected in two other files

`projectCollections.ts` and `backendSummary.ts` each asserted the wipe as a live
fact. Both now say what is true after this fix and keep their "unknown, not absent"
branches, which are still right for the narrower set of cases that reach empty.

---

## 4. Acceptance criteria

- **AC1 ✅** An outcome the fetch could not resolve writes nothing at all — the
  cached schema, and therefore the ports, survive a backend that is asleep,
  restarting or not yet registered.
- **AC2 ✅** A backend that answers with **zero tables** still replaces the cache:
  "this backend has no tables" is an answer and must remain distinguishable from
  "we could not look".
- **AC3 ✅** A project with no endpoint, or one pointing at a foreign Parse server,
  still **clears** — no other server's classes may be attributed to this project.
- **AC4 ✅** The cache fills when the backend starts, not when the window is
  clicked: `backend:statusChanged` is a trigger, and the handler fetches on
  construction.
- **AC5 🔴 OWED — undriven.** Nobody has taken two exports of one real project in a
  real editor, one with the backend stopped and one with it running, and diffed the
  connection counts. `LearnBook` (174 at-risk wires) or `Resourceful` (358) is the
  fixture. ⚠️ Drive a **copy** — opening a project dirties every component.

---

## 5. Gates

| gate | result |
| --- | --- |
| `tests-unit/def-035` | **13/13** |
| **mutant** (`unavailable` restored to wiping) | **7 failed, 6 passed** — exactly the wipe specs; `schema` and `not-applicable` stay green |
| `test:ci` | **2916 specs, 4 failures** — the floor, all four AIX-006 by name, seed 82057 |
| `test:main` | 6491 passed, **5 failed** — all 5 **pre-existing**, reproduced at HEAD with this change reverted (`sb-007`, `sb-018`, `aib-007`) |
| `typecheck:editor` | clean, exit 0 |

✅ The mutant is the reading that matters: it reddens the seven specs about the
wipe and leaves the six about the other two statuses green, so the gate is a
partition rather than one broad assertion that would pass on anything.
