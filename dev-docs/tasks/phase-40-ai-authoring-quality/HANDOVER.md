# Phase 40 — AI authoring quality: the handover prompt

Rewritten 2026-08-05 at the end of the **AAQ-005 slice-2 session**, which closed the apply gap. The
previous version's headline was "slice 1 built the one gate, now converge the toolset". Slice 2 found
something more urgent first: the two clients judged a candidate identically and then did entirely
different things with it, and slice 1's own gate-sharing had made one of Layer 1's defects *harder* to
see rather than fixing it. Everything the earlier versions knew and is still true has been folded in
below, including their nine corrections, all of which survived.

Paste the block below into a fresh session.

---

You are continuing **Phase 40 — AI authoring quality**. Read
`dev-docs/tasks/phase-40-ai-authoring-quality/README.md` and this file before doing anything, then the
task file for whatever you pick up. The phase's own rule applies to its documents as well as to the code:
**read the mechanism in source before trusting a stated fact, including the README's and this file's.**
**Nine** premises written by people who opened or built this phase have now failed that check, plus a
tenth still standing in the review path (AAQ-011 F8). They are listed below. Finding them has been most
of the value of the last five sessions, and the last three — a defect sitting *underneath* three correct
fixes to the same report, a shared-code claim that was really a missing import, and a module header that
talked a reader out of looking at the very client it needed to be bound to — are the reason to assume an
eleventh exists.

## Where the phase stands

**Layer 1 is COMPLETE. The engine has started: AAQ-005 slices 1 and 2 are built and green.** Commits
`4a0fdd4f`, `83647de9`, `c0bf8b5b` (Layer-1 build), `3ef42833` (Layer-1 live pass), `36ce5669`,
`437ec919` (F4/F5 + slice 4), `ac853edf` (the fourth `prop-*` mechanism), `0cfa8640` (slice 1, one gate)
and `e8423f8a` (slice 2, one apply) on `cline-dev`.

Gates as of `e8423f8a`: editor suite **2200 specs, 0 failures**; `noodl-mcp` **136 tests / 14 suites,
green**; runtime **2144 passed**; `typecheck:editor` and `typecheck:editor-tests` clean.

| Task | State |
|---|---|
| AAQ-001 — a created page is reachable | **Criteria 1, 3, 4, 5 closed live.** Criterion 2 closed by construction. One thing owed: promote `PageWithoutPageNode` to blocking (AAQ-011 F7). |
| AAQ-002 — the backend is first-class | ✅ **CLOSED.** All four slices built, all five criteria driven live. |
| AAQ-003 — authored apps scroll | **Criterion 1 closed live.** Criterion 3 under test. Criterion 2 (a dashboard brief's regions scrolling independently) needs a second brief — take it with the engine work. |
| AAQ-004 — the conversation is kept | Mechanism A built, under test, confirmed live. Mechanism B stays with AAQ-006. |
| AAQ-005 — one substrate | **Slices 1 (one gate) and 2 (one apply) BUILT.** Criteria 1 and 5 met; criterion 2 met *only in its "a test fails if the two surfaces diverge" half* (`gateParity.test.ts`) — the "same tool schemas from the same source of truth" half is untouched. **Toolset convergence and criteria 3/4 not started.** See corrections 8 and 9. |
| AAQ-006 → 007 (harness, self-review) | Not started. Read the perf warning below before designing either. |
| AAQ-008/009/010 (doctrine) | Not started. Prompt-encodable parts can land early; acceptance runs against the new engine. |
| AAQ-011 | Register. F4/F5 closed; F9–F11 from the AAQ-002 drive; F12 from slice 1; **F13 added this session**. F9, F10 and F13 are product questions for Richard; F9 and F10 affect every wizard-built app. |

## The corrections. Do not re-derive these the hard way

The first three are from the Layer-1 build session, the next three from the Layer-1 live pass, the
seventh from the AAQ-002 criteria drive, the eighth from AAQ-005 slice 1 and the ninth from slice 2. All
still hold. **8 and 9 are the two to read first if you are touching the substrate**: both are about
believing a claim that code sharing had happened.

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

## AAQ-005 slice 1 — one gate: what it built and found

`validation/authoredCandidate.ts` is now the **one** definition of the authored gate's policy and its four
precondition checks, bound three times: the editor's `validateCandidateComponent`, the MCP write gate, and
the MCP plan gate. `looksLikePageComponent` moved to `validation/navigation.ts` beside `checkPageShape`
(re-exported from `pageRegistration`, so no caller changed) because three bindings must answer "is this a
page" identically.

Three things worth knowing before you extend it:

- **There were three gates, not two.** `noodl-mcp/src/validate.ts` and `tools/planTools.ts::validateStaged`
  were separate implementations, each with its own copy of `diagnosticKey`, one of them commented as
  *deliberately kept identical* to the editor's. BCN-003's three twins, already realised, inside the task
  written to prevent them. **A comment saying "kept identical on purpose" is a twin confessing.**
- **Project normalization and the validator instance are deliberately NOT converged.** The editor
  validates against an `ExplainGraph`; MCP validates over its `ProjectStore` with a validator built on the
  *enriched* catalog index, so its catalog tools and its gate can never disagree about a type. Converging
  those too would change MCP's semantic results as a side effect of closing a gap in what it checks —
  a regression bought with a refactor. If you touch this, keep that line.
- **Binding it exposed a defect in the editor.** The baseline exemption filtered `severity === 'error'`,
  so a pre-existing **blocking warning** was always charged to the agent — re-arming the treadmill the
  exemption exists to prevent, on the population the corpus is full of (imported nodes with parameters
  the catalog cannot see). Proven on `noodl-mcp`'s own fixture: adding one unrelated `Text` node to
  `/Pages/Home` was rejected for a dead `RouterNavigate` the agent had never touched. Now exempted on
  blocking identity over all four checks. Baselining the project-relative checks is safe **because the
  baseline is validated against today's project** — a link broken by someone else's deletion is already
  in the set and forgiven; one the candidate breaks itself is not, and still blocks.

Both new specs were **verified to fail against the old behaviour** (4 of 6 parity cases; the exemption
case). `packages/noodl-mcp/tests/gateParity.test.ts` is the divergence detector: one candidate, both
bindings, same verdict and same blocking codes.

## AAQ-005 slice 2 — one apply: what it built and found

**Layer 1's three project-level effects lived in the editor's apply path and nowhere else**, so an
external agent got none of them. Page registration (AAQ-001), `bodyScroll` (AAQ-003) and provisioning
(AAQ-002) were all absent from `noodl-mcp` — `provision` and `scroll` appeared nowhere in the package at
all, while both packages import `validatePlan` from the *same* `authoring/plan` module, which has handled
`provision` since AIB-007. See correction 9 for the part that matters.

What exists now:

- **One registration decision, two bindings.** `readRouterPagesValue`, `findRoutersInComponents`,
  `isPlaceholderPageGraph` and `resolvePageRegistration` moved out of the editor's `staging.ts` into
  `pageRegistration.ts`, over plain nodes. `staging.ts` feeds it `ProjectModel` nodes; `noodl-mcp`'s new
  `project/pageRegistration.ts` feeds it `ProjectStore` ones. Neither holds policy.
- **Registration fires on all three MCP write paths** — `create_component`, `update_component` (updates
  count, exactly as the editor's apply does) and `apply_plan` in plan order — and is **reported** as
  `registeredPages`, because a tool that writes a component the caller did not name has to say so.
- **`create_plan` takes `scroll`**, applied as `bodyScroll` via `ProjectStore.writeProjectSettings`,
  which never overwrites a setting already present.
- **Provisioning does not port and says so.** It means starting and supervising a `nodegx-backend` child
  process — the editor's manager over IPC; `backend/client.ts` only speaks admin HTTP to backends already
  running. `create_plan` accepts `kind: 'provision'` (one vocabulary) and refuses it with the reason and
  somewhere to go. Filed as **AAQ-011 F13**, and it is a product question of the F4/F5 class.

Two traps caught before they shipped, both now specced. **`graph.roots` is parentless nodes, not
`visualRoots`** — the latter is the `allowAsChild` subset, so reading it would have *widened* the
placeholder rule and let an apply steal the start page from a part-built page. And the **start-page lookup
is exact**, not the module's tolerant `isSamePage`, because `getComponentWithName` compares verbatim;
widening it would have been a real behaviour change smuggled in under a refactor.

The four harnesses, so you extend them rather than write a fifth:

| File | What it pins |
|---|---|
| `noodl-mcp/tests/gateParity.test.ts` | one candidate through **both gate bindings** — same verdict, same blocking codes (slice 1) |
| `noodl-mcp/tests/pageRegistration.test.ts` | registration on all three MCP write paths; **6 of 8 fail** with it neutralised |
| `noodl-mcp/tests/planProjectEffects.test.ts` | the `scroll` → `bodyScroll` setting and the provision refusal; **3 of 7 fail** with both reverted |
| `noodl-editor/tests-unit/aaq-001/pageRegistration.test.ts` | the shared pure core — 36 cases, 14 of them new in slice 2, including the `visualRoots` trap |

⚠️ There is **no apply-parity spec across the two clients** the way `gateParity` covers the gate — the
editor's apply needs a `ProjectModel` and the MCP one needs a `ProjectStore`, so what is shared is proven
at the *decision* level (the pure core, tested once) and bound twice. If you add a third client, that is
the seam to check by hand.

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

The gate is one and the apply is one; the **toolset** is not. In order:

1. **AAQ-005, the rest of it** — the toolset convergence, plus criteria 3 and 4. The editor still exposes
   **three** tools (`get_node_types`, `get_component`, `submit_component`) while `noodl-mcp` exposes its
   own much larger surface. ⚠️ Before planning a merge, know that **two divergences are deliberate and
   documented**: the editor's hierarchy contract is `parent`-only with `children` *derived* (MCP accepts
   both and reconciles), and `variant`/`stateParameters` are deliberately not agent-expressible in the
   editor — `CARRIED_NODE_FIELDS` in `candidate.ts` carries them over from the base instead. Forcing one
   schema over those would be the "regression bought with a refactor" slice 1 warned about; a drift
   *detector* over the shared vocabulary is probably the honest deliverable. (Note the second one is a
   real gap for AAQ-010: on a **create** there is no base, so an editor-authored component can never have
   a variant or a visual state.)
   Criterion 3 (a scripted multi-component session — page + two sections + a token write in one
   changeset) and criterion 4 (Claude Code driven live against `noodl-mcp`, transcript kept as a fixture)
   are untouched. **Criterion 4 is now worth driving**: before slice 2 it would have produced an app with
   unreachable pages and no scrolling and reported success. It is still the only way to learn what
   external authoring actually feels like.
2. **AAQ-006 (harness) → AAQ-007 (self-review)**, in that order, on top of it. Read the perf warning
   above first — it is a prerequisite for AAQ-007, not a footnote.
3. **AAQ-011 F9 and F10**, if you want the Layer-1 apps defensible before the engine lands. F9 is a false
   `⚠ 1` on *every* app the wizard builds (`router.tsx::resetAsync` raises `router/no-pages` on the mount
   preceding its `pages` parameter and never calls `clearWarning`; `dbmodelcrudbase.clearWarnings` is the
   shape the fix wants). F10 decides whether a wizard-built app works the second time it is opened —
   `backend:start` has exactly two callers, neither on the project-open path — and is partly a product
   question worth putting to Richard with F9's answer.
4. **AAQ-011 F7** — promote `PageWithoutPageNode` to the blocking set, which now lives in
   `validation/authoredCandidate.ts` and is one set for both clients. It needs 57 fixture sites across 15
   AI spec files corrected (every one builds a `/Pages/…` component out of a bare Group). Mechanical, but
   it changes what a large part of the suite asserts, so it wants its own read — and it now changes what
   Claude Code may write too, which is a bigger blast radius than when F7 was filed.
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
  five sessions was on that side of the line.
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
  cases to an existing file avoids it. (`noodl-mcp`'s jest picks up new files automatically — the two
  packages differ here.)
- ⚠️ **`packages/noodl-mcp`'s jest suite IS a gate**, via `test:packages --scope @noodl/mcp`. Run it with
  `npx jest` from that directory; it is at **136 tests / 14 suites** as of `e8423f8a`. **It had been red
  for 8 days** before slice 1 (since `7fd3e053`) and nobody noticed. Its own `npm run typecheck` is
  **still red** from that commit (`duplicateNodeId.ts:86`, an unguarded `Map.get(...)`) and is gated by
  nothing; its tsconfig additionally pulls **jasmine** types over jest specs, so `tsc --noEmit` there
  reports dozens of bogus `toHaveLength does not exist` errors. **Do not own either failure** — filter for
  your own files (`npx tsc --noEmit 2>&1 | grep -v jasmine\|toHaveLength\|tests/`).
- `tsconfig.tests-main.json` is **not** a gate; `typecheck:editor` and `typecheck:editor-tests` are.
- Corpus calibration is cheap: `git ls-files '*project.json'` is 96 real projects.
- ⚠️ **A rule calibrated on the project corpus is not calibrated on the authored one.**
  `PageWithoutPageNode` fires 6 times over 96 real projects and **57 times across 15 AI spec files**.
  Since slice 1 there is a third population: `noodl-mcp`'s fixtures and whatever Claude Code writes.
  Before you make a diagnostic blocking, run **all three** suites.
- **Verify a new spec fails without the fix.** Slice 1's parity spec passed on the first run; only
  reverting the change proved it was worth anything (4 of 6 then failed). A spec that has never been red
  is an unchecked claim. Slice 2 did the same and learned which of its cases were load-bearing: the
  negative cases ("a non-page registers nothing") pass either way and prove nothing on their own.
- ⚠️ **`noodl-mcp`'s `demo-app` fixture is itself an instance of the AAQ-001 defect.** Its Router carries
  `{ name: "Main" }` and **no `pages` key at all**, so the fixture's own `/Pages/Home` is unregistered,
  and its `nodegx.project.json` has neither `rootNodeId` nor `settings.rootComponent` (so `isRoot` is
  never true and `chooseRouter` takes the first router it finds). Convenient for testing the empty-router
  path; misleading if you assume a fixture is well-formed.
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

⚠️ **No second session was live during the slice-2 session.** Checked at the start (`ps` showed no
Electron/jest/webpack for this repo, and nothing under the repo had been written in 90 minutes) and the
working tree at the end matched the start exactly. The slice before it *did* have one. **Check for
yourself at the start of every session** — it is a per-session fact, not a standing one.

Fourteen tracked files have been modified and uncommitted since before the last five sessions and are
**still untouched** — `package-lock.json`, `nodegx-observe`, `ProjectImporter.ts`, `projectmodel*.ts`,
`featureFlags.ts`, `LocalProjectsModel.ts`, `analyze.ts`, the whole `VersionControlPanel/` set,
`tests/versioning/index.ts` — plus untracked `tests-unit/erg-005/`, `tests/versioning/snapshotproject.test.ts`,
`VersionControlPanel/context/snapshotProject.ts`, `dev-docs/tasks/phase-37-project-tabs/`,
`dev-docs/tasks/phase-41-accessibility/` and the phase-17 LEARN docs. They belong to other sessions.
**Do not attribute them, do not commit them, never `git add -A`, and never `git stash`.** Commit with
explicit pathspecs on *both* `git add` and `git commit`.

⚠️ `npx jest` from `packages/noodl-editor` still reports **2 failing suites in `tests-unit/erg-005/`**
(3 specs; 40 suites / 510 specs pass). That is another session's in-flight work — `GraphComponent.ports`
does not exist yet — and it is **not yours**. The gates that matter are `test:ci` (**2200/0**), `npx jest`
from `packages/noodl-mcp` (**136/136**), `npx jest` from `packages/noodl-runtime` (**2144 passed**), and
the two typechecks.
