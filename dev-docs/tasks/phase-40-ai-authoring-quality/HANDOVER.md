# Phase 40 — AI authoring quality: the handover prompt

Rewritten 2026-08-05 at the end of the **AAQ-005 slice-3 session**, which converged the authoring
vocabulary. The previous version's headline was "the gate is one and the apply is one; the toolset is
not". That is still true of the tool *set* — but the thing underneath it, the schema of what an agent may
say about a node, turned out to have drifted in both directions while nobody was deciding anything, and
one of the differences meant a port an agent authored **could not exist**. Everything the earlier versions
knew and is still true has been folded in below, including their nine corrections, all of which survive,
plus a tenth from this session.

Paste the block below into a fresh session.

---

You are continuing **Phase 40 — AI authoring quality**. Read
`dev-docs/tasks/phase-40-ai-authoring-quality/README.md` and this file before doing anything, then the
task file for whatever you pick up. The phase's own rule applies to its documents as well as to the code:
**read the mechanism in source before trusting a stated fact, including the README's and this file's.**
**Ten** premises written by people who opened or built this phase have now failed that check, plus an
eleventh still standing in the review path (AAQ-011 F8). They are listed below. Finding them has been
most of the value of the last six sessions, and the last four — a defect sitting *underneath* three
correct fixes to the same report, a shared-code claim that was really a missing import, a module header
that talked a reader out of looking at the client it needed to be bound to, and a twin that **slice 1
created by converging the policy around it** — are the reason to assume a twelfth exists.

## Where the phase stands

**Layer 1 is COMPLETE. The engine has started: AAQ-005 slices 1, 2 and 3 are built and green.** Commits
`4a0fdd4f`, `83647de9`, `c0bf8b5b` (Layer-1 build), `3ef42833` (Layer-1 live pass), `36ce5669`,
`437ec919` (F4/F5 + slice 4), `ac853edf` (the fourth `prop-*` mechanism), `0cfa8640` (slice 1, one gate),
`e8423f8a` (slice 2, one apply) and `873172d0` (slice 3, one vocabulary) on `cline-dev`.

Gates as of `873172d0`: editor suite **2202 specs, 0 failures**; `noodl-mcp` **161 tests / 15 suites**;
runtime **2144 passed**; `typecheck:editor` and `typecheck:editor-tests` clean.

| Task | State |
|---|---|
| AAQ-001 — a created page is reachable | **Criteria 1, 3, 4, 5 closed live.** Criterion 2 closed by construction. One thing owed: promote `PageWithoutPageNode` to blocking (AAQ-011 F7). |
| AAQ-002 — the backend is first-class | ✅ **CLOSED.** All four slices built, all five criteria driven live. |
| AAQ-003 — authored apps scroll | **Criterion 1 closed live.** Criterion 3 under test. Criterion 2 (a dashboard brief's regions scrolling independently) needs a second brief — take it with the engine work. |
| AAQ-004 — the conversation is kept | Mechanism A built, under test, confirmed live. Mechanism B stays with AAQ-006. |
| AAQ-005 — one substrate | **Slices 1 (one gate), 2 (one apply) and 3 (one vocabulary) BUILT.** Criteria 1, 2 and 5 met — criterion 2 fully, for the gate *and* the vocabulary, with two drift detectors. **The tool SET is still two shapes, deliberately; criteria 3 and 4 not started.** See corrections 8, 9 and 10. |
| AAQ-006 → 007 (harness, self-review) | Not started. Read the perf warning below before designing either. |
| AAQ-008/009/010 (doctrine) | Not started. Prompt-encodable parts can land early; acceptance runs against the new engine. **AAQ-010 gained a concrete blocker: F14.** |
| AAQ-011 | Register. F4/F5/F15 closed; F9–F13 open; **F14 added this session**. F9, F10, F13 and F14 are product questions for Richard; F9 and F10 affect every wizard-built app. ⚠️ **This line is stale and incomplete as of 2026-08-06 — read the table in [AAQ-011](AAQ-011-FOUND-ALONG-THE-WAY.md), not this cell.** (a) **F10 and F13 are DECIDED** — yes to auto-start with orphan reaping as a hard requirement, and yes to `noodl-mcp` provisioning; both unowned. (b) This summary names **9 of the 15 rows** — F1, F2, F3, F6, F7 and F8 appear nowhere in it, which is how a handover loses a row that the register still holds. (c) ⚠️ **F9's classification here contradicts F9's own row**: this cell calls it a product question, and the row describes a plain bug with a named mechanism and a named fix shape (`router.tsx` calls `raiseRuntimeError` and never `clearWarning`; the `dbmodelcrudbase.clearWarnings` family is the established pattern). **Left unresolved deliberately** — it is a real disagreement about what F9 is, not a typo, and the person who owns AAQ-011 should settle it. |

## The corrections. Do not re-derive these the hard way

The first three are from the Layer-1 build session, the next three from the Layer-1 live pass, the
seventh from the AAQ-002 criteria drive, the eighth from slice 1, the ninth from slice 2 and the tenth
from slice 3. All still hold. **8, 9 and 10 are the three to read first if you are touching the
substrate**: all three are about believing that code sharing had happened.

1. **`prop-age` / `prop-bio` was never a timing problem, and AAQ-002 said it was.**
   `SchemaHandler._fetch()` (`utils/schemahandler.ts`) had been a **stub since WF-007**: it set
   `dbCollections = []`, `haveCloudServices = false`, and `_store()` then wrote `undefined` — on *every*
   `window-focused` and *every* `cloudServicesChanged`. Fixed by introspecting over `backend:list` →
   `backend:status` → `backend:getSchema`. The chain, for anyone debugging a missing data port:
   `record-ports.ts` → `resolveSchemaPortContext` (`schema-ports.ts:477`) →
   `selectedBackend?.schema?.collections` → `dbCollections` fallback → `schemahandler.ts`.
   ⚠️ This fix is real and works — and the ports **still do not appear**. See correction 7.

2. **`RouterNavigate.target` and `Page.urlPath` are not in the node catalog.** Both are
   runtime-discovered ports, and `checkParameterValues` **skips dynamic-port nodes entirely** — so any
   string passes. This is very likely *why* the model reached for "navigate to path":
   `PageStackNavigateToPath.path` is the only navigation target the catalog declares statically.
   If you need to know whether a parameter is checked, write the four-line probe; do not reason about it.
   ⚠️ The same skip bites elsewhere: `Text` and `Group` declare dynamic ports too, so decorating one with
   a bogus parameter to provoke `UnknownParameter` does **nothing**. Use `Number Remapper` — one of the
   54 static-port types, and the one the AIB-001 specs already prove is static.

3. **`buildBackendList` has no production caller.** The Backend Services panel composes three separate
   card components. A right model seam is not a right panel — check which one a user actually looks at
   before fixing either.

4. **⚠️ A component listed in a Router's `pages.routes` is NOT a page.** The runtime's page index is
   built **exclusively from `Page` nodes** (`utils/exporter/router.ts::_getPageInfo`);
   `getPagesForRouter` drops every route it cannot resolve to one, and the Router then mounts nothing.
   The result is a **blank screen, no error, and a panel truthfully reporting "The app opens on
   Puppies"**. `stagedComponentIsPage` accepts the `/Pages/…` *name* — correct for deciding what to
   register, never a claim about what renders. Now `DiagnosticCode.PageWithoutPageNode` plus an explicit
   authoring-prompt contract; the diagnostic is a **warning, not blocking** (AAQ-011 F7 carries the bill).

5. **⚠️ `prop-*` has a third mechanism, and it is not the cache.** `findReusableBackend` matched on
   **name alone** while `provisionFromScope` always named it *"App backend"*, so every AI-created project
   on a machine bound to the first backend ever provisioned there; and `backend:createTable` returned
   `created: false` for an existing table **without reconciling its columns**. Both closed (F4/F5) as
   product decisions: a project now owns its backend via `config.projectIds`, and provisioning fully
   reconciles, type changes included.

6. **⚠️ The Record family reads `collectionName`, not `collection`.** It passes
   `collectionParam: 'collectionName'` to `resolveSchemaPortContext`, **whose own default is
   `'collection'`** — so reading the resolver instead of the caller gets it wrong. Setting `collection` is
   completely inert and nothing diagnoses it. Same family: `RouterNavigate.target` is the **full legacy
   component name** (`/Pages/Puppies`), matched against the router's own `pages.routes` — not a display
   name and not a URL.

7. **⚠️⚠️ `prop-*` had a FOURTH mechanism, and it was never about backends.** Read this before you
   trust any port-generation claim in this repo. `dbmodelcrudbase._addBaseInfo` defaulted its port
   flag with `opts === undefined || opts.includeInputProperties` — right only while no other option
   exists. **ERG-001 §4 added a `done` sentence to the same options object** (`67d2c339`), which made
   `opts` defined and the whole expression falsy, and **Create Record and Update Record stopped
   emitting a single `prop-<field>` port, on every backend, in every project, for a year.** The three
   earlier mechanisms were all real and all fixed; none of them could ever have made the ports appear.
   ⚠️ **It presents as a schema bug** because `recordClassPorts` kept working — the node knows the
   collection and offers no way to write to it. The one-minute probe that settles it: add a `DbModel2`
   (Record) node on the same collection; it gates on `selectedCollection` alone, so if *its* ports
   appear the schema chain is fine and the fault is in the mixin assembly. Fixed by **deriving** both
   flags from the mixins that build what they gate. The gate is `record-property-ports.test.ts`, which
   drives the **assembled node modules** rather than the pure generators, because two suites of the
   latter stayed green throughout.

8. **⚠️⚠️ "`noodl-mcp` shares the validation rules" was false, and it is a claim-shape to distrust.**
   AAQ-005 §5 recorded the editor/MCP divergence as *policy*: shared rules, gated on `severity ===
   'error'` only. In fact `checkParameterValues`, `checkBackendRequirements`, `checkNavigation` and
   `checkPageShape` appeared **nowhere** in `packages/noodl-mcp` — grep, zero hits — and `editor-deps.ts`
   never re-exported one of them. The gate was not lenient about those diagnostics; it **never computed
   them**, and its error filter was correct with nothing to filter. So ~15 error-severity parameter
   diagnostics, `ConnectionOnlyParameter` among them — *this phase's own* diagnostic, for the mechanism
   that silently discarded a build's styling — rejected a submission in the editor and shipped clean
   through Claude Code.
   ⚠️ **The generalisation is the valuable part:** "package X shares Y via a re-export barrel" is a claim
   about a specific export list. A package importing *some* of a module's exports reads exactly like one
   importing all of them. Grep the barrel for the symbol; do not infer it from the pattern.

9. **⚠️⚠️ "`noodl-mcp` has no plan transaction at all" — and it does, and the sentence was in the way.**
   `pageRegistration.ts`'s own module header said it, as the reason the AI stack's registration floor
   could only be the editor's. `noodl-mcp` has had `create_plan`/`stage_plan_operation`/`apply_plan`
   since **AIX-011**, built on *this package's own* `authoring/plan` module. So the premise was already
   false when it was written, and its effect was to talk every subsequent reader out of asking whether
   the other client needed binding.
   ⚠️ **What it hid is the real lesson of slice 2, and it generalises past this repo.** Slice 1 shared
   `checkNavigation` into `noodl-mcp`. That check resolves a Navigate target against the project's
   **component names**, not against router registration — which is sound *in the editor* only because
   the editor's apply registers the page a moment later. Bound to a client whose apply did not, it
   certified as correct exactly the button that would not work. **Sharing a check moves its unstated
   preconditions into a client that may not meet them.** Gate parity without apply parity is a gate
   that lies. When you converge a rule, ask what the *other* code around the original call site was
   quietly guaranteeing.

10. **⚠️⚠️ "The same vocabulary SUB-008 exposes to external agents" was an intention — and a convergence
    can CREATE the twin it is meant to remove.** `authoring/tools.ts`'s own header claimed the editor
    spoke the same vocabulary as the MCP server. Read side by side, the two hand-written schemas differed
    on five fields — and one difference meant a port **could not exist**: `plug` was undeclared on the
    MCP door, and `NodeGraphNode.getPorts(filter)` selects on `p.plug && p.plug.indexOf(filter) !== -1`
    while `componentmodel` derives a component's interface from `getPorts('input')`/`getPorts('output')`.
    A `Component Inputs` node with `ports: [{ name: 'Title' }]` yields a component with **no inputs**:
    written to disk, structurally valid, invisible on the canvas, diagnosed by nobody.
    ⚠️ **The sharper half is what slice 1 did on its way past.** `authoredNodes` — the adapter every
    precondition check reads its nodes through — was byte-identical in both packages *because slice 1
    converged the policy and left the adapter alone*. It is the seam a new field must travel through to
    reach the checks, so adding `ports` to one copy would have made one gate silently stop checking. **A
    convergence that stops at the policy can manufacture a twin at the boundary it did not cross.** When
    you share a rule, share the adapter that feeds it, or write down why not.

## AAQ-005 slice 3 — one vocabulary: what it built and found

`validation/authoringVocabulary.ts` is the **one** table describing what an agent may say about a node,
an instance port, a connection and a submission. Each field carries its kind, its one shared description,
which clients expose it, where it is required, and — whenever any of those is partial — **why**.

- **Two renderers, one declaration.** The editor renders JSON Schema (`jsonSchemasFor('editor')`);
  `noodl-mcp/src/vocabulary.ts` renders zod. The table cannot render zod itself: `noodl-editor` has no
  zod dependency and should not grow one to describe a surface it emits as JSON Schema.
- **Declared, not erased.** `children` (the editor derives it from `parent`), `variant` (MCP only — F14),
  `sample_data` (editor only, sandbox preview), `path`/`type`/`allow_unknown_types` (MCP only), and
  `id`/`plug` required on one door only. Each with a reason in the table; `undeclaredDivergences()` plus
  a spec asserting it is empty means one cannot be added quietly. `SURFACE_DIVERGENCES` does the same job
  for differences that are not about a field.
- **`DiagnosticCode.PortWithoutPlug`** — an **error** in the shared precondition set, which is now
  **five checks, not four**. Both gates refuse a plug-less port.

⚠️ **Two traps you will meet if you extend this.**

**The two surfaces do not enforce alike.** zod rejects an MCP tool call before the handler runs; the
editor's schema is prompt text (`toSubmitPayload` casts unchecked, and `buildCandidate` re-derives the
shape errors it needs). So `requiredIn: ['mcp']` hard-rejects external calls that work today, while
`requiredIn: ['editor']` only changes a sentence a model reads. That is why `id` and `plug` are required
on one door and merely described on the other — converging the *text* is free, converging the
*enforcement* is a breaking change to a shipped API.

**Deriving a zod shape from a table erases the types that keep the write path safe.** A rendered
`Record<string, ZodTypeAny>` makes zod infer every tool argument as `{ [x: string]: any }`, and every
write handler in `author.ts` and `planTools.ts` takes its arguments from that inference. It surfaced only
because one handler still declared its parameter precisely; without that, the whole authoring write path
would have become `any` under a change described as a refactor. Runtime values come from the table;
compile-time shapes are stated in `vocabulary.ts` and checked by the parity spec reading each registered
schema back.

**And the corpus had to be read, not reasoned about.** Real projects use *three* plug values — `input`
(512), `output` (879) and **`input/output` (92)**. A check recognising only the first two would have
flagged 92 legitimate ports. All three populations were measured before the diagnostic became an error:
1483 of 1483 corpus instance ports carry a plug; the AI specs and MCP fixtures declare none without one.

## The harnesses, so you extend them rather than write a sixth

| File | What it pins |
|---|---|
| `noodl-mcp/tests/gateParity.test.ts` | one candidate through **both gate bindings** — same verdict, same blocking codes (slice 1; +2 cases in slice 3) |
| `noodl-mcp/tests/vocabularyParity.test.ts` | **both schema renderings read back** — field sets, optionality, descriptions, enum members, passthrough behaviour. **8 of 23 fail** against the old hand-written schemas |
| `noodl-mcp/tests/pageRegistration.test.ts` | registration on all three MCP write paths; **6 of 8 fail** with it neutralised |
| `noodl-mcp/tests/planProjectEffects.test.ts` | the `scroll` → `bodyScroll` setting and the provision refusal; **3 of 7 fail** with both reverted |
| `noodl-editor/tests-unit/aaq-001/pageRegistration.test.ts` | the shared pure registration core — 36 cases |
| `noodl-editor/tests-unit/aaq-005/authoringVocabulary.test.ts` | `submit_component` **byte-for-byte** against the literal it replaced; the undeclared-divergence invariant; no field absent from `nodes.schema.json`. **7 of 16 fail** with one undeclared, unstored field added |
| `noodl-editor/tests-unit/aaq-005/instancePorts.test.ts` | the fifth check, including all three real plug values |

⚠️ There is **no apply-parity spec across the two clients** the way `gateParity` and `vocabularyParity`
cover the gate and the schemas — the editor's apply needs a `ProjectModel` and the MCP one a
`ProjectStore`, so what is shared is proven at the *decision* level (the pure core, tested once) and bound
twice. If you add a third client, that is the seam to check by hand.

## The driver — use it, do not rebuild it

`packages/noodl-editor/scripts/aaq40-live/` drives the **whole launcher path** with **no AI provider**:
scoping conversation → project creation → plan review → authoring fan-out → apply. It has its own README.

```bash
npm run dev:debug -- --quiet
node packages/noodl-editor/scripts/aaq40-live/wizard-replay.js \
  --drive --fast --name=aaq40-pass --location=/some/scratch/dir
```

The seam is `AiClient.chatStream` / `isConfigured`, and the responder is **request-aware** — it dispatches
on which tools the caller offered, so one patch serves the scoping turn *and* both authoring sessions.
There is no API key on this machine and none is needed for Layer-1 work: registration, `bodyScroll`, the
schema cache and the apply pre-check are all performed by the **apply transaction, downstream of the
provider boundary**. What it cannot test is authoring *quality* — that needs a real model, and it is what
AAQ-005..007 are for.

`--fast` streams one partial payload per submission instead of eight. Use the default when the partial
path is what you are testing; use `--fast` when it is not, because of this:

## ⚠️ Read this before designing the engine

**Authoring a 55-node component cost 6m51s of editor main-thread time against a ZERO-latency provider.**
A 9-node component in the same run took 0s. The `PartialPayloadScanner` is *not* the cost — 0–1ms for the
whole component, measured directly by calling `update()` in the renderer. The cost is per `publish()`,
and it is superlinear in node count. A real provider streams far more partials than the eight this pass
used, so a live run is **worse, not better**.

Phase 40 aims at components far larger than 55 nodes. Measure this and fix it before building an
iteration loop (AAQ-007) that republishes a candidate many times per build. Filed as AAQ-011 F6; the
prime suspect is `AuthoringSession.publish` → the Build panel's re-render, not the scanner.

## What to do next

The gate is one, the apply is one, and the vocabulary is one. In order:

1. **AAQ-005 criteria 3 and 4.** Criterion 3 is a scripted multi-component session (page + two section
   components + a token write in one changeset, applied atomically, undone as one group) — note the token
   write has no verb yet on either door, so decide whether `set_design_tokens` lands here or with AAQ-009.
   **Criterion 4 is now the highest-value single thing left in this task**: Claude Code driven live
   against `noodl-mcp`, transcript kept as a fixture. Before slice 2 it would have produced an app with
   unreachable pages and no scrolling and reported success; before slice 3 it could have authored a
   component interface that did not exist. It is still the only way to learn what external authoring
   actually feels like, and everything it exercises has now been made honest.
   ⚠️ Before planning any *tool-set* merge, know that **the remaining divergences are deliberate and
   documented in `SURFACE_DIVERGENCES`**: the editor's hierarchy contract is `parent`-only with `children`
   derived, `operations`/`if_revision` are MCP-only (AIX-002 rejected the delta dialect for the editor —
   the unit is the whole component), and the plan tools are MCP-only *as tools* while both clients bind
   the same plan module. Forcing one tool list over those would be the "regression bought with a refactor"
   slice 1 warned about.
2. **AAQ-006 (harness) → AAQ-007 (self-review)**, in that order, on top of it. Read the perf warning
   above first — it is a prerequisite for AAQ-007, not a footnote.
3. **AAQ-011 F14, with F9 and F10**, if you want the Layer-1 apps defensible before the engine lands.
   F14 is the one that matters for quality: **a component the editor's agent creates can never have a
   variant or a visual state**, while an external agent can set both. That is AAQ-010's subject and it
   needs the agent told which variants exist (AIB-010) or it will invent names. F9 is a false `⚠ 1` on
   *every* wizard-built app (`router.tsx::resetAsync` raises `router/no-pages` on the mount preceding its
   `pages` parameter and never calls `clearWarning`; `dbmodelcrudbase.clearWarnings` is the shape the fix
   wants). F10 decides whether a wizard-built app works the second time it is opened — `backend:start` has
   exactly two callers, neither on the project-open path.
4. **AAQ-011 F7** — promote `PageWithoutPageNode` to the blocking set, which lives in
   `validation/authoredCandidate.ts` and is one set for both clients. It needs 57 fixture sites across 15
   AI spec files corrected (every one builds a `/Pages/…` component out of a bare Group). Mechanical, but
   it changes what a large part of the suite asserts, so it wants its own read — and it now changes what
   Claude Code may write too.
5. **AAQ-011 F13** — whether the MCP server may create backends at all. Until it can, a full-stack app
   cannot be built end to end through the external door; the graph is diagnosed (slice 1 gave the package
   `checkBackendRequirements`) but nothing offers to fix it. Worth putting to Richard alongside F9/F10.
6. **AAQ-011 F12** — the MCP write gate is **component-scoped**, so a project-wide rule
   (`duplicate-node-id`) fires only *after* the write: `create_component` returns `errors: 0` and the very
   next `validate_project --strict` returns 3. An external agent can still write a colliding node id and
   be told the write is clean. Making a project-scoped rule reachable from a component-scoped gate is a
   design change, which is why slice 1 filed it rather than patched it.
7. **AAQ-011 F8** — the review path still calls the built-in backend's collections "unknown, not absent"
   on a premise Layer 1 made stale. The reader it needs (`projectSchemaCollections`) exists, so this is
   wiring; three specs assert the current four-outcome shape.

Richard's bar has not moved: *"legendary creations rivaling the best Opus landing page artifacts."* A page
that validates is not the goal, and the exit criteria are three briefs judged side by side against Claude
artifacts — see the README.

## Traps that will bite you in this specific work

Standing:

- **The seams lie before the model fails.** When something looks wrong in the render, the first question
  is *"did this reach the runtime?"*, never *"why did the model not do this?"* Every defect in the last
  six sessions was on that side of the line.
- **A declared `default` never runs its setter.** The most repeated trap in this repo.
- **A saved project applies a parameter before the port exists.** Jest never reproduces it; only a real
  load does.
- **The editor test suite lies three ways. Only the `Jasmine:` line counts.**
- **Launching the dev editor rewrites the example project.** Check `git status` after killing it.
- **`--target=editor` is correct now**, but closing a webview CDP target white-screens the editor, and
  `cdp reload` on the editor page is unrecoverable. Reloading the *viewer* webview is safe and is the fix
  for a stale-looking preview.

Gates and harness:

- ⚠️ **Run jest from `packages/noodl-editor`, never from the repo root.** The root config is babel-based
  and fails on TypeScript `import { type X }` with what looks like a syntax error in your spec.
- ⚠️ **Editor specs under `tests/` are registered by hand** (`tests/index.ts` → `tests/ai/index.ts`). A
  *new* spec file nobody adds to the barrel compiles, typechecks and **silently never runs**. Adding
  cases to an existing file avoids it. (`tests-unit/` and `noodl-mcp`'s jest both auto-discover — the
  three differ here.)
- ⚠️ **`packages/noodl-mcp`'s jest suite IS a gate**, via `test:packages --scope @noodl/mcp`. Run it with
  `npx jest` from that directory; it is at **161 tests / 15 suites** as of `873172d0`. **It had been red
  for 8 days** before slice 1 (since `7fd3e053`) and nobody noticed. Its own `npm run typecheck` is
  **still red** from that commit (`duplicateNodeId.ts:86`, an unguarded `Map.get(...)`) and is gated by
  nothing; its tsconfig additionally pulls **jasmine** types over jest specs, so `tsc --noEmit` there
  reports dozens of bogus `toHaveLength does not exist` errors. **Do not own either failure** — filter for
  your own files (`npx tsc --noEmit 2>&1 | grep -vE 'jasmine|toHaveLength|^tests/'`).
- `tsconfig.tests-main.json` is **not** a gate; `typecheck:editor` and `typecheck:editor-tests` are.
- Corpus calibration is cheap and it has now paid twice: `git ls-files '*project.json'` is 96 real
  projects, and a 20-line python walk over them is what said `input/output` is a real plug value used 92
  times. **Read the corpus rather than reasoning about the value set.**
- ⚠️ **A rule calibrated on the project corpus is not calibrated on the authored one.**
  `PageWithoutPageNode` fires 6 times over 96 real projects and **57 times across 15 AI spec files**.
  There is a third population: `noodl-mcp`'s fixtures and whatever Claude Code writes.
  Before you make a diagnostic blocking, run **all three** suites.
- **Verify a new spec fails without the fix.** Slice 1's parity spec passed on the first run; only
  reverting the change proved it was worth anything. Slice 3 did the same by reinstating the old
  hand-written schemas (8 of 23 failed) and by adding one undeclared, unstored field (7 of 16 failed). A
  spec that has never been red is an unchecked claim — and the negative cases ("a non-page registers
  nothing") pass either way and prove nothing on their own.
- ⚠️ **`noodl-mcp`'s `demo-app` fixture is itself an instance of the AAQ-001 defect.** Its Router carries
  `{ name: "Main" }` and **no `pages` key at all**, so the fixture's own `/Pages/Home` is unregistered,
  and its `nodegx.project.json` has neither `rootNodeId` nor `settings.rootComponent`. Convenient for
  testing the empty-router path; misleading if you assume a fixture is well-formed.
- ⚠️ **Replacing a component's nodes wholesale leaves the old connections dangling**, and the gate
  correctly rejects the write. `update_component`'s `set` needs `connections: []` (or the surviving set)
  whenever it drops nodes — the fixture's Home ships a `btn.onClick → nav.navigate` pair, so a naive
  full-graph replacement fails with `dangling-connection` and reads like a bug in whatever you were
  actually testing.

Live driving:

- ⚠️ **Write the discriminating probe before the third theory.** Three mechanisms were proposed for
  finding #7 and all three were fixed before anyone asked the question that separates them: *does any
  OTHER node get its ports from this same cache?* One `DbModel2` node answered it in a minute. When a
  chain has N stages and you are on your third fix, find the input that splits the chain rather than
  re-reading it from the top.
- ⚠️ **A button below a panel's fold has a NON-ZERO bounding box.** The documented "zero-sized box" guard
  does not fire, `dispatchClick` reports success, and the click lands on whatever is at those
  coordinates. Use the driver's `clickVisible`.
- ⚠️ **HMR does not reach a mounted panel's callbacks.** Verify the running code
  (`__wr('…').fn.toString()`) before concluding a fix does not work.
- ⚠️ **A tag written in one `eval` is gone by the next one.** React re-renders between two CDP calls, so
  `el.id = 'x'` followed by a separate `cdp click #x` fails with "no element matching". Compute the box
  and dispatch the click in **one** connection — `wizard-replay.js` exports `clickButtonWithText` /
  `clickVisible` for exactly this.
- ⚠️ **`npm run cdp -- reload --target=viewer` reloaded the EDITOR** and returned to the launcher. To get
  a rebuilt runtime into the viewer, restart the stack — which is also the honest way to test anything
  claiming "at first load".
- **Match both spellings of a state.** The apply button reads "Apply to project (3)" when everything
  staged and "Apply 1 of 3 to project" when some failed; matching only the second reads a clean run as a
  hang.
- **A cold editor's first scoping turn can take over a minute**, nearly all of it module loading and the
  wizard's first render. Do not go looking for a stall.
- **A card's rarely-used actions live behind `⋯`.** Disconnect and Delete are `showContextMenuInPopup`
  items, not buttons — a scan of `button, [role=button]` finds neither and reads as "the feature is
  missing".
- **The Data Browser needs a selected backend** (AAQ-011 F11). Open it from the card's own Data button.
- **Clean up after a live pass.** Scratch projects go in a scratch directory, get deleted, and get
  removed from the launcher's recents. A backend the pass *provisioned* is now the project's own (F4), so
  delete it whole: `backend:stop` then `backend:delete`.

## The shared checkout

⚠️ **No second session was live during the slice-3 session.** Checked at the start (`ps` showed no
Electron/webpack/jest for this repo) and the working tree at the end contained exactly this session's
files plus the untouched set below. **Check for yourself at the start of every session** — it is a
per-session fact, not a standing one.

Fourteen tracked files have been modified and uncommitted since before the last six sessions and are
**still untouched** — `package-lock.json`, `nodegx-observe`, `ProjectImporter.ts`, `projectmodel*.ts`,
`featureFlags.ts`, `LocalProjectsModel.ts`, `analyze.ts`, the whole `VersionControlPanel/` set,
`tests/versioning/index.ts` — plus untracked `tests-unit/erg-005/`, `tests/versioning/snapshotproject.test.ts`,
`VersionControlPanel/context/snapshotProject.ts`, `dev-docs/tasks/phase-37-project-tabs/`,
`dev-docs/tasks/phase-41-accessibility/` and the phase-17 LEARN docs. They belong to other sessions.
**Do not attribute them, do not commit them, never `git add -A`, and never `git stash`.** Commit with
explicit pathspecs on *both* `git add` and `git commit`.

⚠️ `npx jest` from `packages/noodl-editor` still reports **2 failing suites in `tests-unit/erg-005/`**
(3 specs; 42 suites / 540 specs pass, up from 40/510 with this session's two new files). That is another
session's in-flight work — `GraphComponent.ports` does not exist yet — and it is **not yours**. The gates
that matter are `test:ci` (**2202/0**), `npx jest` from `packages/noodl-mcp` (**161/161**), `npx jest`
from `packages/noodl-runtime` (**2144 passed**), and the two typechecks.
