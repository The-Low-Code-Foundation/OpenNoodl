# DEF-035 — which ports exist depends on when you looked

**Status:** ✅ **CLOSED s34** — AC1–AC5 met. AC5 was driven in a real editor on
2026-08-31; see §6, which also corrects §2.2's blast radius by 14× and registers the
defect that correction found (**DEF-036**).
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

🔴 **s34's drive corrected this table, and the correction is larger than the one this
section is proud of.** 3,783 is the population whose `prop-*` ports the schema
*generates*. It is **not** the population that leaves a build when the cache is wiped,
because `recordWiredFieldPorts` (P77 SBR-008) re-mints a `prop-<field>` port, typed
`'*'`, for any field a wire already names — *"the wire is the declaration"* — and the
**Record family calls it and the User family does not**. So:

| | wires | projects |
| --- | ---: | ---: |
| schema-generated `prop-*` wires (this section's number) | 3,783 | 28 |
| **Record family — `recordWiredFieldPorts` keeps them** | **3,579** | — |
| **User family — nothing keeps them: these actually vanish** | **271** | **21** |

The drive is what caught it: the fixture holds 176 schema-derived wires in its export
and lost **exactly 14** — every one of them `net.noodl.user.User` or
`net.noodl.user.SignUp`, none of them Record. The predicate above independently
predicts 14 for `LearnBook`. ✅ **Two instruments, one number, arrived at from
different directions.**

The missing producer is registered as **DEF-036**, and it is a defect in its own right:
the same asymmetry costs the User family its ports on every cold read, not only this
one.

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
- **AC5 ✅ DRIVEN (s34).** Two exports of one real project — a copy of `LearnBook` —
  taken in a real Electron editor through the real `exportToJSON` → `exportComponent`
  → health filter, on the fixed build and on the pre-fix build rebuilt from
  `e5b68d30^`. **Fixed: 2,587 connections before and after the trigger, identical,
  and `project.json` byte-identical. Pre-fix: one `window-focused` wrote
  `dbCollections = undefined` to disk and the next export was 2,573 — 14 wires gone,
  no edit between them.** §6 has the readings, the controls and the diff by wire name.

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

---

## 6. The drive — AC5, 2026-08-31 (s34)

**Fixture.** A **copy** of `~/vscode_projects/Noodl projects/LearnBook` (opening a
project dirties every component, so the original was never opened). Two identical
copies, `md5 2bd73d17faf57d1629870e0cf528fe87`, 2,719 connections on disk,
`dbCollections` = 14 classes. Its endpoint is
`https://b2myxf2kbh.eu-central-1.awsapprunner.com` with **no `type` field**, so
`fetchBuiltInSchema` walks past the `not-applicable` branches, asks `backend:list`,
matches no managed backend and resolves **`unavailable`** — the branch the defect
lived in, reached by a real project without anything being staged.

**Instrument.** A real `npm run dev:debug` Electron editor. The project was opened
through the launcher card, and the export taken through the product's own path —
`exportToJSON(ProjectModel.instance, { useBundles: false })` → `exportComponent` →
`getConnectionHealth`. Nothing below the export was doubled. Reached over CDP through
the webpack chunk registry (`webpackChunknoodl_editor.push`), which is a way of
*calling* the modules, not of replacing them.

### 6.1 The two arms

| | **A — HEAD (fixed)** | **B — pre-fix (`git show e5b68d30^`, rebuilt)** |
| --- | --- | --- |
| build identity, read off `SchemaHandler.prototype._fetch.toString()` in the running renderer | `FIXED-BUILD` | `UNFIXED-BUILD` |
| `dbCollections` after opening | 14 | 14 |
| export **before** the trigger | 2,587 conns · **176** schema wires | 2,587 conns · **176** schema wires |
| `_fetch` calls driven by `window-focused` | **2** | **1** |
| `setMetaData('dbCollections' \| 'systemCollections' \| 'dbVersionMajor')` | **none** | **`dbCollections=undefined`, `systemCollections=undefined`, `dbVersionMajor=undefined`** |
| `dbCollections` after the trigger | 14 | **undefined** |
| export **after** the trigger | 2,587 · **176** | **2,573 · 162** |
| `project.json` on disk | `2bd73d17…` — **unchanged** | `18bcb37c…` — **the `dbCollections` key is gone from the file** |
| reopened cold in a fresh window | — | 2,573 · 162 — the loss is settled, not transient |

**The person sentence, measured: two exports of one project, no edit between them,
fourteen wires' difference, no error and nothing in either artefact saying so.**

### 6.2 The controls, because both arms could have lied

- 🔴 **`fetchCalls` is the known-firing signal.** Arm A's headline is an *absence* —
  nothing was written. An absence is worthless beside a trigger that might never have
  fired, and "refused to write" and "was never asked" look identical from the outside.
  A spy on the instance counted **2** real `_fetch` calls in arm A and **1** in arm B,
  so both arms are answers to a question that was actually put.
- 🔴 **The build under the drive was measured, not assumed.** `_fetch.toString()` was
  read in the running renderer in both arms. A `cd`-shaped mistake or a webpack watcher
  that had not finished would otherwise have let arm B run on the fixed bundle and
  report "no defect" — the shape that closes a row wrongly.
- ✅ **The arms share a baseline.** Both took an identical first export (2,587 · 176)
  *before* any trigger, on their own build. The difference is therefore attributable to
  the focus event, not to the rebuild.
- ✅ **The diff is by wire name, not by count.** 14 lost, **0 gained**.

### 6.3 What the 14 are, and why it is 14 and not 176

Every lost wire is `net.noodl.user.*`:

```
5 × ParentComponentObject.value-*        -> net.noodl.user.SignUp.prop-{firstName,lastName,profilePhoto}
9 × net.noodl.user.User.prop-{firstName,lastName,defaultOrg,trainer} -> Expression / Variable2 /
                                            DbModel2.modelId / CloudFunction2.in-orgId / Component Outputs …
```

The Record family lost nothing, and that is not luck. `dbmodelcrudbase.ts:392` and
`dbmodelnode2.ts:554` call **`recordWiredFieldPorts`**, which walks the node's own
connections and mints a `prop-<field>` port for every field a wire names that the
schema did not cover. Its docblock states the principle outright — *"the wire is the
declaration"* — and it was built by P77 SBR-008 for a different reason. It is why a
Record node keeps its ports with the schema gone.

`user-ports.ts` has no equivalent. `userSchemaContext` resolves the accounts table out
of `base.collections`, and with `dbCollections` wiped that list is empty,
`selectedCollection` is `undefined`, and no `prop-*` port is minted at all — so the
wires into and out of them are `con-no-target-port` / `con-no-source-port`, both
`level: 'error'`, and DEF-034 established that an error is what still deletes a wire
from an export.

🔴 **That asymmetry is DEF-036**, registered rather than absorbed here: this fix stops
the cache being wiped, and does not give the User family the net the Record family has.
A User node still loses its ports on any genuinely empty read.

### 6.4 What the drive does not show

- ⚠️ **It never had a *running* built-in backend.** No project in the 118-project
  corpus binds one — they all point at remote Parse servers — so the arm AC5's wording
  imagined ("backend running") was not available on a real project. What was driven is
  the arm the defect actually lives in: a backend the editor **cannot reach**. The
  warm/cold pair was made by the trigger, which is the variable D13 named.
- ⚠️ **The fix does not heal a project already wiped.** Arm B's fixture is still
  missing `dbCollections` on disk; the fixed build leaves it alone, correctly, because
  it still cannot reach the backend. Recovery needs a backend that answers.
- ⚠️ **`recordWiredFieldPorts` types its ports `'*'`.** A Record wire survives, but the
  narrowed column type does not, and the Class dropdown is empty while the cache is
  cold. "The wires survive" is not "nothing is lost".

### 6.5 One thing the drive settled for DEF-028 in passing

`NodeGraphModel.prototype.flushEvaluateHealth` was spied through one real export:
**211 calls, one per component**, no error, on a 2,228-node project. DEF-028's fix is
therefore observed running in a real editor at real scale — which is not the same as
its own AC5 drive (two takes of one project differing), but it removes the question of
whether the unconditional flush is affordable on a large graph.
