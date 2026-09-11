# TUT-002 — a condition that can see data

**Surface:** editor + `noodl-mcp` · **Tier 2** · **Effort:** M

> Richard, 2026-08-19:
>
> > *"We deffo need the ability for the tutorial to detect created data, only in the in built DB,
> > and that should be available to the MCP that creates the tutorials too."*

## The premise

The lesson condition vocabulary
([`lessonformat.ts:48-66`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts)) is
**entirely graph-structural** — `hasType`, `hasLabel`, `hasPort`, `exists`, `isVisualRoot`,
`hasParams`, `paramsEqual`, `connection`, `metadata`, `previewRouteEquals`,
`activeComponentEquals`, `routerLists`.

A tutorial about data can therefore grade *"you wired Create Record's `Do` to the Visual Function's
signal output"* and cannot grade *"you created a record."* For TUT-003 that is the difference
between a tutorial that checks the wiring and one that checks the outcome.

## 🔴 The evaluator stays synchronous. The context carries a snapshot.

`evalConditionsWithContext` is sync
([`lessonevalconditions.ts:498`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts))
and `LessonEvalContext` (`:101-110`) is a **plain data bag the caller builds**. Two callers exist and
both build it their own way:

| Caller | Builds from | File |
|---|---|---|
| the live editor | `ProjectModel.instance`, `NodeGraphContextTmp` | [`lessonevalconditions.live.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.live.ts) |
| the MCP sidecar / plain Node | project **files** on disk | [`lessonprojectcontext.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonprojectcontext.ts) |

**Do not make the evaluator async.** Add an optional pre-fetched field to the context — collections,
their columns, and row counts — and let each caller fill it. A database read is asynchronous; the
*grading* of an already-read snapshot is not, and conflating the two would make every one of the
eleven existing verbs async for the benefit of three new ones.

🔴 **`lessonevalconditions.ts` may not reach an editor singleton by any route a bundler can
follow.** Read the header of `.live.ts` before touching either: a lazy `require` defers execution,
not resolution, and this arc has already paid for that once.

## The MCP half is not a second implementation

`noodl-mcp` has spawned backends since AAQ-011/F13 (see `BackendManager.js`'s registry note and
`noodl-mcp/src/backend/`), so the sidecar **can** fill the same snapshot from a real running
backend. It must fill the same shape and call the same evaluator — the arc's central claim is one
evaluator, never forked, and this task is the third chance to break it.

## 🔴 Built-in DB only, and that is not merely policy

A project can be bound to Parse, Directus, PostgREST or a bare REST endpoint. A lesson condition
that queries one of those is **a lesson that phones home to someone else's server** — during
grading, unprompted, possibly on a school-managed machine (P67 D15 territory). The snapshot filler
must refuse a non-local binding and the condition must report *"this lesson grades against the
built-in database, and this project is bound to X"* rather than silently reading false.

## 🔴 The F1 half is what makes this safe for a model to author

[`lessonbundleverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleverify.ts)
class **F1** is *"unreachable — a condition names a type or path that cannot match"*, checked by
`verifyLessonManifest`. A collection condition naming a collection that neither the starter nor the
`solution/` ever creates is exactly that defect, and if the new verbs are not added to the
unreachable check, **the harness gains a hole shaped precisely like the thing it exists to catch** —
which this codebase has now done twice, both times with a comment standing in for a check.

## Acceptance criteria

1. Three verbs land in the author-facing union and compile to the internal vocabulary 1:1, per that
   file's existing convention: collection **exists**, collection **has columns**, collection **row
   count at least N**. (Exact spellings are the implementer's; one verb per object.)
2. `evalConditionsWithContext` remains **synchronous** and its signature is unchanged. Asserted by a
   spec that calls it with no `await` and no promise in the return.
3. Both context fillers populate the snapshot: the live one from the running bound backend, the
   file/sidecar one from a backend it starts. A spec grades **the same manifest** through both and
   gets the same verdict.
4. A project bound to a non-local backend produces a **refusal that names the binding**, not
   `false`. 🔴 Paired with a known-firing control on a local binding, so "refused" and "never asked"
   cannot read identically.
5. `verifyLessonManifest` **rejects** a manifest whose collection condition names a collection absent
   from both the starter and the `solution/`, with a sentence naming what to change — driven against
   a deliberately-broken bundle, and against a correct one that must pass.
6. The MCP tool schema exposes the same three verbs, and a tutorial authored through the MCP with a
   data condition installs and grades. 🔴 Check the MCP tool-surface token budget before adding the
   schema — there are three budgets and one is a gate.
7. `test:main` and the `uni-007` / `uni-010` suites stay green; new specs are added to a barrel that
   actually runs them.

## Watch out for

- **A row count of zero is a legitimate answer and a broken snapshot is not.** Distinguish "the
  collection has no rows" from "we could not read the collection", or a tutorial will congratulate a
  learner whose backend failed to start.
- Collection and column name comparison should be **case-insensitive**: SQLite identifiers are, and
  `planSchemaReconciliation` already had to learn this the hard way (`ADD COLUMN age` against `Age`
  fails and `SchemaManager.addColumn` swallows precisely that error).
- Do not read the schema through the legacy `dbCollections` project metadata. Use the live backend;
  the metadata is a cache and TUT-003's learner will be creating tables *while the lesson runs*.

---

## Session 2 — 2026-08-20: the contract is built, the fillers are not

**Status: PARTIAL, deliberately.** The vocabulary, the evaluator, the refusal semantics and the F1
check are built and gated. 🔴 **Neither context filler is, so nothing in production produces a
snapshot** — see §"the hole" below, which is the thing the next session must fix first.

### What landed

| File | Change |
|---|---|
| `views/lessons/lessonevalconditions.ts` | `LessonCollection`, `LessonDatabaseSnapshot`, `LessonEvalContext.database`, three condition types, three evaluator arms, `isCollectionCondition`, `databaseRefusal` |
| `models/lessonformat.ts` | three author verbs — `collectionExists`, `hasColumns`, `rowCountAtLeast` — and their 1:1 compile |
| `models/lessonverify.ts` | `unreachable-collection` finding + `VerifyLessonOptions.knownCollections` |
| `tests-unit/tut-002/` | **31 specs**, 2 files |

### AC-by-AC

| AC | Status | Evidence |
|---|---|---|
| 1 — three verbs, 1:1 | ✅ | compile asserted per verb; malformed shapes refused at author time |
| 2 — evaluator stays sync | ✅ | asserted with a database condition in play; signature unchanged |
| 3 — both fillers populate the snapshot | ❌ **NOT STARTED** | the hole below |
| 4 — refusal names the binding | ✅ (contract) | `databaseRefusal` + **known-firing control** on a local binding; refused / unavailable / absent are three distinct answers. ⚠️ Cannot be end-to-end until AC3 |
| 5 — F1 rejects an unreachable collection | 🟡 **built, dormant** | 9 specs incl. a passing control; 🔴 **no caller supplies `knownCollections`** |
| 6 — MCP tool schema | ❌ **NOT STARTED** | 🔴 check the three token budgets first |
| 7 — gates green | ✅ | `test:main` **270 suites / 4381 tests, 0 failures**; `typecheck:editor` exit 0; `test:ci` **2849 / 10 @ 39393** — floor, same 10 by name. 🔴 Worth running: `tests/lessons/` covers all three changed modules |

### 🔴 The hole, stated plainly — this is the BUILD-THE-CALLER shape again

Grepped with comments stripped, because a comment naming a mechanism has stood in for a check here
three times:

- **Nothing fills `ctx.database`.** Neither `lessonevalconditions.live.ts` nor
  `lessonprojectcontext.ts` sets it. Every collection verb therefore answers `false` in the real
  editor, with a refusal sentence attached.
- **Nothing supplies `knownCollections`.** Of the four callers of `verifyLessonManifest`
  (`lessongrading`, `lessonbundleverify`, `editor-deps`, and the stale `index.bundle.js`), **none**
  passes it. The collection-reachability check is specced and never fires.

**So the 31 green specs are not coverage of a working feature.** They are coverage of a contract
that no production path exercises yet. Both facts are written into the source doc comments as well
as here, because the task file is the half that gets read second.

🔴 **TUT-003 must not author against these verbs until AC3 lands.** A lesson written now would grade
every data step as incomplete, forever.

### What the specs caught that review did not

- 🔴 **The `rowCount` type guard looked load-bearing and was nearly a no-op.** The first control
  removed it and **all 30 specs still passed** — because `undefined >= 0` is already `false` by NaN
  semantics, so the absent-count case never exercised the guard at all. The arm that does exercise
  it is a **non-number** `rowCount` (`'5' >= 1` is `true`), which is exactly what a snapshot crossing
  a process boundary as JSON can carry. Spec added; the control then went red.
  **A control that stays green is a finding about the spec, not a pass.**
- 🔴 **Two controls "went red" for the wrong reason.** Both reported `Tests: 9 passed, 9 total` —
  one suite had failed to *compile* and contributed **zero** tests, while the summary still looked
  like a result. ✅ **Reconcile the test count AND the suite count on every control**; 31→9 is not a
  failure, it is a suite that never ran.
- The F1 message listed **lower-cased** collection names, so an author told to *"correct the name to
  one of: owners, puppies"* would have typed exactly that against a solution creating `Owners`.
  Matching stays case-insensitive; reporting is now verbatim.

### Design notes worth keeping

- **`{ collection, exists }` was the natural spelling and is a trap** — `compileCondition` matches
  `'exists' in d` and would have built a *node* condition with no path. Every verb is globally
  unique, which keeps that dispatcher a lookup rather than an ordering puzzle. A spec pins it.
- **`collectionExists: false` is exempt from the F1 check.** Naming a collection nothing creates is
  its whole purpose — *"you have not made it yet"* is a legitimate step, and a gate that rejected it
  would be a gate rejecting the correct answer.
- **`knownCollections` omitted ≠ supplied-and-empty.** Omitted skips the check entirely; an explicit
  `[]` is evidence and fires. `asked − answered = absent`; `everything − answered` is a lie.

### AC3 groundwork — read-only survey, 2026-08-20

Both fillers can hit the **same two HTTP routes**, which is what keeps "one evaluator, never forked"
true on the data side as well:

| Need | Route | Reached from the editor by | Reached from the sidecar by |
|---|---|---|---|
| collections + columns | `GET /admin/schema` → `{ tables: { name, columns, createdAt }[] }` (`byob-admin.ts:72`) | `ipcMain.handle('backend:getSchema')` → `BackendManager.getSchema` | `BackendClient.request()` (`noodl-mcp/src/backend/client.ts:91`) |
| row count | `GET /api/{table}?limit=0&count=1` → `{ count }` | `BackendManager.getRecordCount` | same client |

⚠️ `SchemaTable.columns` is `unknown[]` — the `SchemaManager` it comes from is untyped JS in
`@noodl/runtime`. The filler must narrow it to names defensively, not cast.

### 🔴 The trap waiting in AC3, found before writing a line of it

[`BackendManager.getRecordCount`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js)
ends with:

```js
return result.count || 0;
```

**That is precisely the zero-vs-unreadable conflation this task's "Watch out for" warns about**, and
it is already in the tree. A response with no `count` — a route change, a permissions refusal, a
partial failure — returns **0**, and `rowCountAtLeast: 0` then holds against a collection nobody
could read. The evaluator's own guard (`typeof rowCount !== 'number'`) cannot save it, because by
then the `0` is a perfectly good number.

✅ **The filler must not use `getRecordCount` as-is.** Read `count` and leave `rowCount` **absent**
when it is not a number, so the distinction survives the trip.

**Checked, so the next session need not:** `getRecordCount` has exactly **one** other caller —
`SchemaPanel.tsx:132`, which stores into a `Record<string, number>` and falls back to `0` in its own
`catch`. So the `|| 0` **is** load-bearing there and must not be changed in place. Add a separate
count path for grading, or read the route directly.

⚠️ Noted in passing, not this task's to fix: the Schema panel therefore also renders *"0 records"*
for a table it could not read. Cosmetic there; the same conflation is a false pass here, which is
why grading needs its own path rather than sharing that one.

---

## Session 3 — 2026-08-20: the callers, and a defect that would have shipped

**Status: AC1–AC7 all closed.** The three verbs are now reachable from the live editor, from the
bundle harness and from the MCP brief. The session's own finding is §"what the harness was about
to do", which was not on anyone's list.

### What landed

| File | Change |
|---|---|
| `models/lessondatabase.ts` **new** | The pure core: the two-method reader port, the narrowing, `readLessonDatabaseSnapshot`, `classifyLessonBackend`, `ipcLessonReader`, `lessonObservesDatabase`, `collectionNamesInComponents` |
| `models/lessondatabase.live.ts` **new** | The renderer adapter — `ProjectModel` + three IPC channels + `matchEndpointToManaged`, and nothing else |
| `noodl-mcp/src/lessons/lessonDatabase.ts` **new** | The sidecar adapter — `BackendClient`, starting the backend if it is configured and down |
| `views/lessons/lessonevalconditions.live.ts` | `liveLessonEvalContext(database?)` |
| `models/lessoncheck.ts` | `CheckMyWorkDeps.readDatabase`, the merge, and `liveCheckMyWorkDeps` wiring it |
| `models/lessongrading.ts` | `StepGrade.unevaluable`, set from `databaseRefusal` before evaluating |
| `views/lessonlayer2.ts` | The live step tick: a 4s poll while a data step is active, and the refusal on the step |
| `models/lessonprojectcontext.ts` | `LessonProjectSource.database`; `unevaluableReason(condition, { hasDatabase })` |
| `models/lessonbundleverify.ts` | Derives `knownCollections` from both projects; passes `hasDatabase` to the replay |
| `models/lessonformat.ts` | `LESSON_CONDITION_VERBS` — the vocabulary, declared instead of spelt out in a refusal string |
| `noodl-mcp` brief + `check_lesson` | The three verbs documented; `backend_id` to replay them for real |

### AC-by-AC

| AC | Status | Evidence |
|---|---|---|
| 1 — three verbs, 1:1 | ✅ | session 2 |
| 2 — evaluator stays sync | ✅ | session 2; unchanged — the fillers are the async half and they are *callers* |
| 3 — both fillers populate the snapshot | ✅ | `database-fillers.test.ts`: one manifest, both transports, identical snapshots and identical verdicts, with a known-firing control |
| 4 — refusal names the binding | ✅ **end to end now** | `grading-a-data-lesson.test.ts` grades it through `checkMyWork` and through the learner's sentence |
| 5 — F1 rejects an unreachable collection | ✅ **firing** | `bundle-verifies-a-data-lesson.test.ts`; population = every `collectionName` in starter ∪ solution |
| 6 — MCP exposes the same verbs | ✅ | the tool schema never needed a change (`steps` is freeform); the **brief** did, and now a spec makes it impossible to add a verb without documenting it |
| 7 — gates green | ✅ | see the readings in NEXT-SESSION-PROMPT §2 |

### 🔴 What the harness was about to do to TUT-003

A collection condition was **checkable** by `verifyLessonBundle`, so it was replayed against a
file-backed context with no database, read the evaluator's (correct, safe) `false`, and would have
been reported as **F2 dead-on-solution** — *"a learner who builds exactly what the lesson asks for
will still be told they have not finished"* — against a perfectly good data lesson.

That is a **manufactured failure**, which `lessonprojectcontext`'s own header calls the one output
a gate must never produce. It was invisible to all 31 of session 2's specs, because none of them
ran a collection condition through the *bundle* harness, and it would have blocked TUT-003 outright
while everything stayed green.

✅ Fixed by making the collection verbs a **third** kind of unanswerable: the two editor-only verbs
are unanswerable always, this one is unanswerable *when nobody read a database*. F1's
collection-reachability check is what covers them instead — which is the reason that check exists.

### Design decisions worth keeping

- **The snapshot read is one function with two transports**, not two fillers. `ipcLessonReader`
  lives in the *pure* module deliberately: its two decisions (`backend:queryRecords` not
  `backend:getRecordCount`; `limit: 1` not `limit: 0`) are the documented traps, and they are only
  gradeable where a plain-Node runner can reach them. Both are now specs rather than comments.
- **Anything not a backend we manage is refused, by name** — including a *deployed* nodegx backend.
  One rule, and it means this module needs no second copy of "what counts as local":
  `matchEndpointToManaged` still owns that, and the caller passes the result in.
- **`checkMyWork` merges the snapshot over the context rather than passing it through
  `evalContext()`.** A dependency shaped `evalContext(database?)` is one every existing
  implementation would silently ignore — and a dropped snapshot looks exactly like a snapshot
  nobody read.
- **The refusal is `StepGrade.unevaluable`, not `error`.** `error` means *the lesson's condition is
  broken*, and `summariseGrade` says so in those words. Sending a learner to look for a mistake in
  a lesson that is fine, when the fix is "start your backend", is the wrong instruction twice.
- **The live step tick polls, at 4s, only while a data step is active.** Every other verb observes
  the editor's own model, which raises `Model.*`; a row added in the Data Browser raises nothing.
  Without the poll a data step ticks only when the learner happens to move a node.
- **`LESSON_CONDITION_VERBS` replaced a prose list.** The refusal message named the vocabulary in a
  string literal, so the one place that knew all of it could not be read — and the MCP brief had
  been two verbs behind it with nothing to notice. A verb a model is never told about is unshipped.

### What the controls caught

- 🔴 **A control read `52 passed, 52 total` with no failure line.** A jest *worker* had crashed on
  an unhandled rejection from a `void reader.readRowCount(...)` in one of my own specs, taking the
  18-test file with it. Reconciling the count (70 → 52) is the only thing that showed it; the
  summary looked like a result. The spec now awaits and swallows.
  **Reconcile the test count AND the suite count on every control — this is the second session
  running that this exact shape has appeared.**
- Eight controls verified red-then-restored: the `|| 0` count fallback, the `getRecordCount`
  channel, a foreign binding read rather than refused, `checkMyWork` dropping the snapshot,
  collection conditions replayed with no snapshot (the F2 defect above), `knownCollections` going
  dormant again, the refusal folded into `error`, and a verb missing from the brief.

### ✅ Driven — the sidecar filler, against the four real backends on this machine

Not a fixture. `lessonDatabaseFromBackend` was run over four of the seven backend directories in
`~/.noodl/backends/`, **none of which was running** — so "from a backend it starts" is literal:

```
backend_msnqlcuuw5rw1  StockItem[name|count|supplier] rows=0
backend_mkgmvdcayltzq  Articles[title|views] rows=2 · Orders[note] rows=4 · Probe[a] rows=1 ·
                       Person[name|city|age|active|price] rows=4 · User[] rows=0
backend_msdakk0sgym7s  Message[body|author|role|tokens|model|conversationId|flagged] rows=0 ·
                       User[] rows=0 · Conversation[] rows=0 · Puppy[] rows=0
backend_msjck0y2ukxwv  Puppy[name|breed|age|available|description|photo] rows=6
```

Three things this proves that the specs could not:

1. **The counts are real.** `rows=2 / 4 / 6` beside `rows=0` — a filler that always answered zero
   would have been indistinguishable from a working one against a fixture of empty tables, which is
   exactly the conflation this task is about.
2. **The routes and the narrowing survive a real `_Schema`.** Column lists come back as objects and
   are narrowed to names without a cast.
3. 🔴 **A collection that exists can report ZERO columns** — `User[]`, `Conversation[]`, `Puppy[]`
   above. `/admin/schema` pairs `sqlite_master` with the `_Schema` rows *by exact name* and falls
   back to `[]` when it cannot find the pair, which is what happens for tables the backend creates
   itself. `hasColumns` therefore answers **false** on such a table — the safe direction, and a
   trap for TUT-003: **do not grade `hasColumns` against a system table.** Predicted from the route
   source before the run; confirmed by it.

No orphaned processes afterwards — the exit hooks stopped what they started, `lsof` on 8578+ clean.

### Still open

- **The live (renderer) half is specced underneath and not driven end to end.**
  `lessondatabase.live.ts` cannot be loaded by a plain-Node runner, so what the suite grades is
  everything below it and what the drive above grades is the same shared core through the other
  transport. The remaining unproven link is short and named: `ProjectModel` → `getCloudServices` →
  `matchEndpointToManaged` → the three IPC channels → a step going green in `lessonlayer2`. It
  needs a lesson bundle with a data condition to drive against, which is TUT-003.
