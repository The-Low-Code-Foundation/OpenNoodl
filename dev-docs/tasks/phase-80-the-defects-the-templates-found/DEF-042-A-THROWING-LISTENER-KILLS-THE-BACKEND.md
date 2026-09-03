# DEF-042 — a throwing event listener kills the whole backend, and the catch written for it cannot see the throw

**Status: ✅ BUILT — 2026-09-03, session 45, on Richard's ruling the same day. Measured and
diagnosed by s43; 🔴 the blast radius that made it need a ruling was NEVER COUNTED, and when it was
counted it turned out to be one `await` on one line.**
Promoted from [UNOWNED-ROWS-TO-MEASURE.md §2](UNOWNED-ROWS-TO-MEASURE.md), owner `NONE` since
2026-08-30. 🔴 **The row's central recommendation — *"catching the rejection so the PUT answers 400
and the backend survives is small and clearly right; that half needs no ruling"* — is wrong, and
the measurement is what shows it.**

## Who it bites, and in what words

> *"I opened my second project, hit deploy, and my first project's backend just… stopped. The
> editor said `fetch failed`."*

The product advertises the shared backend — the card reads *"1 attached · 23 others"* — and every
site-builder project ships the same seven cloud components, so **any two of them collide on the
first deploy of the second**. A *copy* of a project is always a new bundle
(`<projectName>-<hash of directory>`), never a replacement.

## Reproduced at HEAD — 2026-09-03, no editor involved

Against the **committed** `packages/nodegx-backend/dist/cli.js` (verified current: no `src/**.ts`
is newer than it), started with `serve --ephemeral`, two `PUT`s carrying bundles that declare the
same component name:

| step | result |
| --- | --- |
| `PUT /admin/workflows/projectA` | **HTTP 200** `{"success":true}` |
| `PUT /admin/workflows/projectB` | 🔴 **HTTP 000 — no response at all** |
| `GET /admin/status` afterwards | 🔴 **HTTP 000 — connection refused** |

stderr: `Error: Duplicate component name /#__cloud__/site/SetSectionAccess`, then `EXIT=1`.

⚠️ **`--ephemeral` was forced by the environment, not chosen**: this box's Node 20.11.1 has no
usable `node:sqlite` and `better-sqlite3` is not installed, so the backend refuses to start
persistent. The row already states ephemeral does not avoid the defect — *"it drops data
persistence, not the workflows directory"* — and the reproduction confirms that.

## 🔴 The row's fix is already in the tree, and it never runs

`WorkflowRunner.loadWorkflow` has wrapped `await candidateRunner.load(bundle)` in a try/catch
**since WFA-001** — long before this row was measured on 2026-08-30. Verified in the *built*
bundle (`dist/cli.js:64113-64124`), not just in source. It is written precisely for this case, and
its docblock says so: *"never mutating live state until the new set is known to load […] A failure
leaves the previous runner serving and the previous file on disk."*

**It did not run.** There is no `Failed to load workflow projectB (previous version left in place)`
line anywhere in the log before the crash.

## Why — the seam, and it is not where the row looked

```
EventSender.prototype.emit = async function (eventName, data) {   // ← async
  … await Promise.resolve(callback.call(null, data)); …
};

GraphModel.prototype.addComponent = function (component) {        // ← synchronous
  …
  this.emit('componentAdded', component);                          // ← promise DROPPED
};
```

`registerGraphModelListeners` registers a `componentAdded` listener that calls
`context.registerComponentModel`, which throws `Duplicate component name`. Because `emit` is
`async` and `addComponent` does not await it, **that throw rejects a promise nobody is holding.**
It never joins the awaited chain `loadWorkflow` is watching, so the catch cannot see it, and Node
terminates the process on the unhandled rejection instead of the request returning 500.

The async stack trace is what makes this legible — and misleading at first read. It *ends*
`at async WorkflowRunner.loadWorkflow`, which looks like the throw is inside the guarded await.
That frame is where the chain was **created**, not where the rejection was **delivered**.

### ⚠️ It is not one call site — `graphmodel.ts` has **15** un-awaited `this.emit(...)`

`componentAdded` is merely the one a person has met. `rootComponentNameUpdated`,
`componentRemoved`, `componentRenamed`, `nodeAdded`, `nodeRemoved`, `nodeWasRemoved`,
`projectSettingsChanged`, `metadataChanged`, `variantUpdated` are all the same hazard waiting for
a listener that throws.

## ✅ What was built — and 🔴 the blast radius nobody had counted

s43 left this row unbuilt on one premise: *"making the throw reachable means `addComponent` must
await `emit`, which makes it `async`, which ripples through every synchronous caller — in
`noodl-runtime`, shared with the viewer. That is not a small change and it is not backend-local."*

**Counted on 2026-09-03, before writing anything:**

| question | answer |
| --- | --- |
| callers of `graphModel.addComponent` in the runtime, both viewers and the backend | **ONE** — [`graphmodel.ts:113`](../../../packages/noodl-runtime/src/models/graphmodel.ts#L113), twelve lines above the function |
| is that caller already `async`? | **yes** — `importComponentFromEditorData` has been `async` all along |
| is the chain above it awaited? | **yes, every link**: `loadWorkflow` → `CloudRunner.load` (`index.ts:164`) → `NoodlRuntime.setData` (`noodl-runtime.ts:693`) → `importEditorData` (`graphmodel.ts:176`) |

🔴 **The chain was already fully `async` and fully awaited except for the last two links, both in
`graphmodel.ts`.** The guard in `loadWorkflow` was not missing and not wrongly written — it was
**starved by two missing `await`s in one file**. The "ripple into the shared runtime" was one
`await` on one line, and the row's premise was the thing that needed measuring rather than the fix.

**Built:** `addComponent` is `async` and awaits its `componentAdded` emit; its single caller awaits
it. Three lines of behaviour, in one file, with the reasoning in the function's header.

⚠️ **What was deliberately NOT built**, and both are named in the code:

- **The other 15 emits in `graphmodel.ts` are still un-awaited**, `_onNodeAdded`'s among them —
  reached from a `forEach` inside `addComponent` itself. `componentAdded` is the one a person has
  met; **the class is narrowed, not closed.** Awaiting the rest changes node-registration ordering
  in the browser viewer, which is its own decision. The last arm of the runtime gate **measures**
  this so the code and this row cannot drift apart about it.
- **`editormodeleventshandler.ts:225` calls `importComponentFromEditorData` without awaiting**, so
  a throw still detaches on the editor's live-edit path.

⚠️ **The ordering this buys is a strengthening, not a change of contract.** Callers now wait for
every `componentAdded` listener before the next component is imported. They previously did not
reliably — the first listener ran synchronously and the rest in microtasks interleaving with the
caller's own `await` — so *"registration has finished"* was already being assumed without being
true.

⚠️ **The PUT answers 500, not the 400 the original register row asked for.** `updateWorkflow` maps
every `{success:false}` to 500, and it covers disk failures as well as bad bundles, so splitting it
would need `loadWorkflow` to signal which kind. Out of scope here and **not a defect** — this row's
own recommendation had already concluded the 500 and *"previous version left in place"* were
correct.

## The gate — `tests/def-042-detached-emit.test.ts` (nodegx-backend)

Three tests pinning the **mechanism**, not the crash, so the suite never has to kill a process.

- *emit is async* — the precondition. If it stops being one, the hazard is gone and these tests
  should be revisited, not deleted.
- **CONTROL** — *an AWAITED emit delivers the throwing listener to the caller*. This is the arm
  that proves `loadWorkflow`'s catch is correctly written: when the rejection reaches it, it does
  its job. The defect is that it never arrives.
- 🔴 *an UN-AWAITED emit strands the rejection* — the caller's `try/catch` catches nothing while
  the dropped promise is rejected with `Duplicate component name`.

⚠️ **The third arm was rewritten after its first version measured the harness.** It originally
waited on `process.on('unhandledRejection')`; **jest installs its own handler, so that event never
reaches a listener inside the suite** and the arm failed for a reason that had nothing to do with
the product. The process-level consequence is measured where it actually happens — against
`dist/cli.js`, above.

## Gates run

🔴 **The crash is a PROCESS-level consequence, so the gate is a drive against the built service, not
a spec.** Jest installs its own `unhandledRejection` handler — s43's first attempt waited on that
event and measured the harness. The drive spawns `dist/cli.js` and sends the two `PUT`s over real
HTTP.

| gate | before (reverted arm) | after |
| --- | --- | --- |
| **drive** — `PUT projectA`, `PUT projectB`, `GET /admin/status`, both against a FRESH build | A **200**; B **no response** (`ECONNRESET`); status **`ECONNREFUSED`**; child **exit 1** | A **200**; B **500** `{"success":false,"error":"Duplicate component name …"}`; status **200**; **service alive** |
| the guard's own log line, `Failed to load workflow … (previous version left in place)` | **absent** | 🟢 **present** — the catch that has been dead since WFA-001 now runs |
| `test/models/def-042-component-added-await.test.ts` (new, `noodl-runtime`) | **4 red of 5** | **5/5, exit 0** |
| `tests/def-042-detached-emit.test.ts` (s43's mechanism spec) | 3 passed | **3 passed** — unchanged, and correctly so: it pins `EventSender`, which this fix does not touch |
| `noodl-runtime` full suite | — | **146 suites / 2566 passed**, 5 red = the SQLite floor by name, byte-identical to s44's reading |
| `noodl-viewer-react` suite · `noodl-viewer-cloud` suite | — | **87 suites / 1138 passed** · **13 suites / 219 passed** |
| `tsc` — `noodl-runtime`, `noodl-viewer-react`, `noodl-viewer-cloud`, `nodegx-backend` | — | **exit 0 × 4**, 0 `error TS` |

🔴 **Both arms of the drive were taken against a FRESH build.** `dist/` is gitignored, and the
artefact s43 measured was from 09-02 — comparing today's build against it would have varied the
whole day's runtime changes as well as this fix.

🔴 **The "absent guard line" reading was re-taken after the instrument changed.** The first pass
searched only stderr; `WorkflowRunner.safeLog` uses `console.log`, so the line lands on **stdout**
and its absence would have been an artefact of the instrument. The drive now reads both streams,
and the reverted arm was **re-run with it** — the absence is real, beside a known-firing signal in
the other arm.

## Bounds

- ✅ **The backend survives and answers.** What is fixed is `componentAdded`; see *What was built*
  for the two paths deliberately left detached.
- ⚠️ **This is not the semantics question.** Whether two projects on one backend *should* collide at
  all — namespace per bundle, refuse the second, last-writer-wins — is untouched and still a design
  question with a person attached. The second deploy is now **refused, loudly, with the previous
  version still serving**, which is a defensible answer and not necessarily the final one.
- The reproduction used a **hand-built minimal bundle** declaring one duplicate component name, not
  a real site-builder export. That is sufficient for the crash and is *not* evidence about how
  many real project pairs collide — the row's own "any two site-builder projects" claim is
  inherited, not re-measured here.
- **Ephemeral mode only**, forced by this box's missing SQLite engine. The crash is in workflow
  loading, which the row states is independent of persistence, but a persistent-mode reproduction
  has not been done here.
- The 15 un-awaited `emit` call sites are counted in `graphmodel.ts` alone. **Other files were not
  swept.**
