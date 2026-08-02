# WFA-009 — Notes

**Status:** 🟡 **Built, tested, and NOT live-QA'd.** The mechanism is in and every claim that can be
checked without Electron is checked by a suite that runs. The one thing this task exists to make
possible — *type a name, see a port, wire it, deploy, read the body* — was proven end to end at the
**runtime** end (a real backend, a real HTTP call, a real response body) and **not** at the editor
end, because another session held the dev stack for the whole of this task and launching a second
editor would have hijacked their run. §"Could not verify" is the list, and it is short and specific.

**Spec:** [WFA-009-RESPONSE-NODE-PORTS.md](./WFA-009-RESPONSE-NODE-PORTS.md) ·
**Decisions:** [WFA-009-ASSESSMENT.md](./WFA-009-ASSESSMENT.md)

**Branch:** `wt-wfa-009`, from `cline-dev` at `32e3a946`. Three commits:

| sha | subject |
|---|---|
| `befe9eba` | docs(wfa-009): the decision before the code — a declarative rule, and the exporter is out of scope |
| `c255618f` | feat(wfa-009): a cloud function can return a value — value-derived ports, declared |
| `a54c3383` | docs(wfa-009): how a cloud function returns a value |

---

## Step 1 — the evidence, before the assessment and before the code

The spec makes this first and it is the only reason this task is small. **A `BackendService` on port
8711**, over a bundle written by hand in the exact shape today's exporter produces — `"ports": []` on
the Response node, because `noodl.cloud.response` does not set `exportDynamicPorts` — one `pm-` port
fed by a **connection** and one by a **literal parameter**:

```
POST http://127.0.0.1:8711/functions/returnsAValue   {"total": 42}
STATUS 200 BODY {"result":{"note":"a literal typed into the port","total":42}}
```

Both arrived. `registerInputIfNeeded` is load-bearing, at **two** independent call sites
(`NodeScope.addConnection` for the wire, `NodeScope.setNodeParameters` for the literal), and the
exporter is **out of scope** — `exportDynamicPorts` is not set and must not be. The register's
original diagnosis stays corrected and is now backed by a run.

Two things that made this cheap and are worth knowing next time:

- **The proof was already in the repo, green, unread.** `nodegx-backend/tests/workflow-data-mapping.test.ts`'s
  `echoFunction` fixture has written `ports: []` and wired `pm-*` across it since WFA-003, and
  fifteen specs assert on the resulting response bodies. Nobody had noticed that the suite proves the
  exporter is not in the way. **A green suite is evidence about more than its own title**; grepping
  the fixtures before reaching for a new experiment would have shortened this by an hour.
- **It is now a spec of its own** (`wfa-009-response-value.test.ts`, 5 specs) rather than a paragraph,
  because it is the claim that decides whether a future task touches `exportPorts`. The permanent
  version binds port 0; 8711 was for the one-off capture above.

## The decision, in one line

Neither (a) as the spec framed it nor (b). **A declarative `namedports/list` rule in the node's own
`dynamicports`, evaluated by one node-agnostic editor-side adapter.** Full reasoning in the
assessment; the two things worth repeating here are the corrections.

### Correction 1 — the spec's third background fact is false

> *"Nothing in the editor can derive a port from a parameter's value."*

`PageInputsAdapter.updatePortsForNode` splits a comma-separated parameter and mints `pm-<name>`
ports. It is registered, running, and has been for years. `RouterNavigateAdapter` does the same for
`pm-<name>` **inputs**. What the spec's *trap* says is true and is the useful half —
`conditionalports/*` is a filter and cannot express this — but the conclusion drawn from it, that the
editor had no machinery at all, is not. The capability never died with the commented-out managers; it
moved into `NodeTypeAdapters`.

**The lesson, stated plainly because it cost the most time in the reading phase:** the spec named the
mechanism (`dynamicports`) and searched for prior art *under that name*. The prior art was under a
different name in a different directory. A sweep for the **behaviour** (`setDynamicPorts` callers,
six lines of grep) found it immediately.

### Correction 2 — the Request node has the identical fault, and F27 cannot close without it

`noodl.cloud.request` carries a `params` stringlist described as *"Names to pull out of the request
body, each becoming an output"*, and a `setup()` that is the Response one with `plug: 'output'`. Its
generated library entry has **no `pm-*` outputs**. So F27's own criterion — *a value wired into it is
returned by the deployed function* — was unreachable by fixing Response alone: there would be a port
to wire *into* and nothing to wire *from*, because in the shipped template the value a function
returns comes from its request.

Including it cost **one library entry**, because the decision was a rule rather than a class. Had it
been a `ResponseNodeAdapter`, this finding would have doubled the code. The finding arrived *after*
the decision, which is the right order and the reason the assessment is a deliverable.

## What was built

**The rule** — `packages/noodl-editor/src/editor/src/models/nodelibrary/dynamicPortRules.ts`, a
module with **no imports**, so `tests-unit/` can grade it without Electron (the same design
`utils/provenance` uses, and the second entry in `tsconfig.tests-main.json`'s include for the same
reason). It holds:

- `evaluateDynamicPortsCondition`, **moved out of `nodelibrary.ts`** so the `conditionalports/*`
  filter and the new generator share one implementation of that little condition language rather
  than growing two dialects of it. `nodelibrary.ts` imports it back; nothing else changed there.
- `namesFromListParameter` — deliberately identical to `decodeStringList` in core-ui's
  `listValueCodec` (ERG-003's single definition of the `stringlist` format) **without importing it**:
  this module stays import-free, and the runtime `setup()`s that must agree with it cannot reach
  core-ui at all.
- `generatedPortsForNode` / `typeGeneratesNamedPorts`.

**The evaluator** — `models/NodeTypeAdapters/NamedPortsAdapter.ts`, registered beside the seven
existing adapters. Unlike all of them it is bound to **no node type**: it listens to the unsuffixed
`nodeAdded` / `parametersChanged` (the registry already fans out to both lists) plus `projectLoaded`,
and acts on any node whose *type* declares a rule. Its only call is `node.setDynamicPorts(...)` — the
same one `PageInputsAdapter` makes — so every downstream path (`instancePortsChanged`, the property
panel, `evaluateConnectionHealth`, universal search) is one that already exists.

**The declarations** — in `response.ts` and `request.ts`, ten lines above the `setup()` they mirror.
`formatDynamicPorts` in `nodelibraryexport.ts` already passes an entry with a `port` key through
verbatim, so **the rule reached `cloud-node-library.json` with no generator change** — a +25-line
diff, regenerated and committed, and `cloud-library:check` is green (58 node types). That was not
designed for this; it is the shape the export was always willing to carry.

**Naming.** `namedports/list`, not `expand/...`. `expand/basic` already exists (dead) in
`animation.ts` with a `{{portname}}` placeholder and completely different semantics — it expands
*user-defined instance ports*, not a list parameter — and reviving the four commented-out managers is
explicitly out of scope. `{{*}}` is the placeholder because `setDynamicPorts`'s own `renamed.patterns`
already uses it.

## The parity test, and the two bugs it found in code nobody had run

The spec's fifth trap — *`setup()` is not dead code; say what happens when both are present* — has a
concrete answer: `setDynamicPorts` opens `if (portsEqual(ports, this.dynamicports)) return;`, so
whichever writes second is a no-op **while the two emit equal lists**. That turns an abstract "must
not fight it" into a checkable property, and
`packages/noodl-viewer-cloud/tests/wfa-009-dynamic-port-parity.test.ts` checks it: it runs the **real
`setup()`** against a fake `editorConnection`, captures what it hands `sendDynamicPorts`, and
compares to the evaluator's output over eight parameter values × three `status` values. Edit one
without the other and it fails naming both files.

Writing it found two defects in `setup()` — in code that has not executed since WF-007, which is
exactly where defects survive:

1. **An emptied list minted a port with a blank name.** `''.split(',')` is `['']`, so deleting the
   last entry left a `pm-` port labelled with nothing. `decodeStringList` has always been
   `split(',').filter(Boolean)`; `setup()` never was.
2. **A name listed twice minted the port twice.** Harmless at run time (`registerInputIfNeeded`
   guards on `hasInput`) and confusing in the panel.

Both are fixed **in both generators**, which is the only way parity is worth having: mirroring a bug
for parity's sake would have preserved it in the half a future runtime would push.

## Suites — the real numbers

Run directly (`npx jest` / `npx tsc`) from inside the worktree, never through `npx lerna exec`, which
resolves the package root to the **primary checkout** and would have graded code I did not write.

| What | Result |
|---|---|
| `noodl-viewer-cloud` jest (all 6 suites) | **106 passed**, 0 failed (was 69 before this task; +37 are the parity suite) |
| `noodl-editor` jest — `tests-main` + `tests-unit`, 16 suites | **153 passed**, 0 failed (13 are new) |
| `nodegx-backend` `tests/wfa-009-response-value.test.ts` | **5 passed** |
| `nodegx-backend` `tests/workflow-data-mapping.test.ts` (the WFA-003 corroboration) | **15 passed** |
| `nodegx-backend` full jest, 68 suites | **733 passed, 10 skipped, 2 failed** — see below |
| `npm run cloud-library:check` | green, *"Committed cloud node library is up to date"*, 58 node types |
| `tsc -p packages/noodl-viewer-cloud --noEmit` | clean |
| `tsc -p packages/noodl-editor --noEmit` | clean |
| `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` (CI's `typecheck:editor-tests`) | clean |

**Three pre-existing reds, none of them mine, all confirmed rather than assumed:**

- **`nodegx-backend/tests/email-flows.test.ts` — 2 timeouts** (BAK-002's *Send Email node
  (WorkflowRunner integration)* pair, 30 s each). Confirmed pre-existing by **restoring the base
  content of `request.ts` and `response.ts` and re-running**: identical 2 failures, 21 passed. Both
  hang waiting on a `POST /functions/notify` that never answers.
- **Root `npx tsc --noEmit` — 18 errors, all `TS2307 Cannot find module '@noodl-versioning'`.** That
  alias is declared only in `packages/noodl-editor/tsconfig.json`, not in the root config, so the
  root program cannot resolve it. Every error is in a `VersionControlPanel` / `GraphDiffPanel` file;
  none is in anything this task touched. CI runs `npm run typecheck`, so this is worth someone's
  attention independently.
- **`tsc -p packages/nodegx-backend/tsconfig.tests.json --noEmit` (CI's `typecheck:backend-tests`) —
  10 errors**, all in `tests/realtime-filter.test.ts` and `tests/workflow-canvas-contract.test.ts`,
  neither touched here.

`packages/noodl-editor/tsconfig.tests-main.json` reports **364 errors both before and after** my
include change (measured with a copy of the original include, same number) — it reaches
`src/shared` and core-ui `.scss` modules and is **not in any CI job**; ts-jest's per-file diagnostics
are what actually gate `tests-unit`, and the new suite is clean there.

## Traps met, for whoever is next

- **`npx lerna exec` resolves to the primary checkout.** Stated in the brief and true: every command
  here was run as `npx jest --config jest.config.js` from the package directory.
- **`dist-types` is a gitignored build artifact and a fresh worktree has none.** A jest spec that
  imports `nodes/cloud/request.ts` fails on `TS2307: Cannot find module '@noodl/runtime'` until
  `packages/noodl-runtime`'s `build:types` has run. On CI it runs as `npm ci`'s `prepare`; in a
  worktree created without installing it does not, so run
  `npx tsc -p packages/noodl-runtime/tsconfig.types.json && node packages/noodl-runtime/scripts/copy-handwritten-types.js`
  once. **A worktree-only failure that looks exactly like a real one.**
- **ts-jest diagnoses every file it transforms, not just the file under test.** Importing `request.ts`
  makes jest load the `@noodl/runtime` *sources* it depends on, and `configservice.ts` uses ambient
  globals (`_noodl_cloudservices`, `_noodl_cloud_runtime_version`) declared in
  `noodl-runtime/src/globals.d.ts` — which was not in `noodl-viewer-cloud/tsconfig.tests.json`'s
  program. One `include` entry fixes it; the production compile is untouched. This is BCN-002's
  `.js`→`.ts` ambient-dragging class, met from the other side.
- **`forEachNode` aborts on a truthy return.** The sweep uses a block-bodied arrow deliberately; an
  expression body returning `setDynamicPorts`'s value would have been a silent partial walk. (The
  2026-07-26 batch's `forEachRecursive` trap, same shape.)
- **`jest <pattern>` with this backend config runs everything.** `npx jest --config jest.config.js
  wfa-009` ran all 68 suites and reported *"Ran all test suites matching /wfa-009/i"* while doing so.
  Pass the path (`tests/wfa-009-response-value.test.ts`) or you will read someone else's failures as
  your own — which is exactly what happened for one confusing minute here.

## What `noodl.cloud.aggregate` gets, and the finding behind it

**Nothing, deliberately**, and the assessment §3 says why at length. The short version and the part
that should become a task: `noodl.cloud.aggregate` carries **four ports** in the generated library —
`aggregates` in, `fetched`/`failure`/`error` out — and `dynamicports: undefined`. No
`collectionName`, no `storageFetch` **Do** signal, no filter, no aggregate values. Its entire
configuration surface was pushed by the runtime. It is not a node missing a feature; it is a node
that **cannot be configured or fired at all** from this editor, and giving it `agg-<name>` outputs
would leave it exactly as unusable. Restating ~15 ports plus a live dependency on the collection
schema is a task the size of WFA-005, and it belongs in the `AggregateRecordsAdapter` class that
already exists for that type.

Worth checking whether the same is true of other cloud nodes: the three files in
`noodl-viewer-cloud/src` that call `sendDynamicPorts` are `request.ts`, `response.ts` and
`aggregatenode.js`. Two are now covered. The React viewer's ~25 callers are **not** affected — the
preview runs with an editor connection, so their `setup()`s still fire.

## Could not verify — the live list

The editor was off limits for the whole task (another session on the shared dev stack; `dev:stop`
would have killed their run). Editor specs are Jasmine-in-Electron via `test:ci`, which is the same
prohibition, so **no jasmine spec was written** — an unrunnable spec is a liability, and the adapter
was instead kept thin with all logic in the jest-tested pure module. What that leaves, in the order
someone should drive it:

1. **The port appears as you type.** Open a cloud function, select the Response node, add `id` to
   **Parameters**. An `id` input port should appear in a **Parameters** group, with no backend
   running. Then add `total`; then delete `id`. *(Spec success criterion 1 — the headline.)*
2. **The Request node's mirror.** Same on Request: names become **output** ports.
3. **`status = failure` hides them.** Set Status to Failure on a Response node that has parameters —
   the `pm-` ports should disappear and `Error Message` appear.
4. **A removed name's connection is flagged, not dropped.** Wire `pm-id`, then delete `id` from the
   list. Expect the ordinary *"Target port doesn't exist."* error on the connection (from
   `NodeGraphModel.evaluateConnectionHealth`, on a 2 s debounce). **This is asserted in the docs I
   wrote and is the one claim there I could not run.**
5. **The whole loop.** Author from the template, name two parameters on each node, wire both, deploy,
   `POST /functions/<name>`, read the body. The runtime half of this is proven
   (`wfa-009-response-value.test.ts`); the authoring half is not.
6. **Then a workflow step reading `previous.result.total`** — spec step 4's second half, which
   WFA-003's `$path` was built for and which has never been demonstrated from an editor-authored
   function.
7. **The initial sweep on a project that was already open.** `projectLoaded` fires when the node
   library and `ProjectModel` are both ready; opening a *second* project in the same session should
   re-fire it (`ProjectModel.instanceHasChanged` resets the latch). Worth one check that ports are
   present immediately on open, not only after touching a parameter.
8. **No regression in the property panel for nodes with no rule.** The adapter runs on every
   `parametersChanged` in the project; it should be invisible. A large project's panel should feel
   unchanged.

## Collision risk with the sibling sessions

- **WFA-007 (AI proposal onto the workflow canvas).** No file overlap. One thing to watch: it may
  touch `models/workflow/WorkflowDocument.ts`, which calls `setDynamicPorts` for switch routes —
  a *different* caller of the same method, not of my adapter, and workflow nodes are not in
  `ProjectModel` so `NamedPortsAdapter`'s sweep never sees them.
- **F26 `StringInputPopup` + F37 (backend trigger dispatcher).** `StringInputPopup` is the popup
  ERG-003 removed the string-list add flow *from*; my change reads the same `stringlist` parameter
  format but touches none of its editors. F37 is in `nodegx-backend/src/triggers`; my only backend
  file is a new test.
- **The dirty `listValueCodec.ts` in the primary checkout** was **not** imported, on purpose —
  `namesFromListParameter` restates its `decodeStringList` semantics with a comment saying so, which
  also keeps the import-free property `tests-unit` depends on. If that session changes the
  `stringlist` encoding, the parity suite and the rule suite are where it will show.
- **`cloud-node-library.json`** is the one file a sibling could plausibly also regenerate. Mine is a
  clean +25 lines (two `namedports/list` entries); a conflict there should be resolved by
  regenerating after the merge, not by hand.
