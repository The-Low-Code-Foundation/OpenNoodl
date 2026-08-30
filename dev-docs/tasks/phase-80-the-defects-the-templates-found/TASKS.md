# Phase 80 — task list

Status legend: ⬜ open · 🟡 partial · ✅ done · 🔒 blocked on a ruling · 🧭 needs Richard

Ranked by **who it bites**, not by cost. See
[THE-SWEEP-2026-08-29.md](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md) §4 for the
derivation and [README.md](README.md) for why the phase exists.

| id | status | task | source rows | bites |
|---|---|---|---|---|
| DEF-001 | ✅ done | [The defaults fail accessibility on the two controls every app has](DEF-001-THE-DEFAULTS-FAIL-ACCESSIBILITY.md) | P78 D11, D13 | every **end user** |
| DEF-002 | ✅ done | [The door does not check connections](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md) | P77 D1, D10 · P78 D1 | every **agent-authored app** |
| DEF-003 | ✅ done | [Three authoring acts with no honest surface](DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md) | P77 D8 = P76 F15 · P77 D7 · P76 F16 | every **author** |
| DEF-004 | ✅ done | [When it goes wrong you cannot see where](DEF-004-WHEN-IT-GOES-WRONG-YOU-CANNOT-SEE-WHERE.md) | P77 D2, D3 | anyone **debugging** |
| DEF-005 | 🔒 ruling | [Membership is a category the graph cannot express](DEF-005-MEMBERSHIP-IS-UNEXPRESSIBLE.md) | P78 D2, D3 | every **membership app** |
| DEF-006 | ✅ done | [The design system punishes the agent that uses it](DEF-006-THE-DESIGN-SYSTEM-PUNISHES-ITS-USER.md) | P78 D12, D15, **D20** | every **agent** styling on-system |
| DEF-007 | 🟡 partial | [A project means one thing on disk and another once loaded](DEF-007-DISK-AND-LOAD-DISAGREE.md) — **§6 seam named, §6.1 AC3 measured (56), §3.3 struck** | P78 D9 residual · P77 D5 · **P77 D11** | the **next template** |
| DEF-008 | ✅ done | [The measurement owed](DEF-008-THE-MEASUREMENT-OWED.md) — **driven s13: D6 does not reproduce; `maxWidth` applies on `Text` in every authored form; the one route to `none` (instance-authored) is blocked at the door. DEF-001's rendered-button inch closed at 5.17:1 in the same render** | P77 D6 · P78 D5 | nobody yet — a re-drive |
| DEF-009 | 🟡 partial | [A public write door ships with no limit](DEF-009-A-PUBLIC-WRITE-DOOR-WITH-NO-LIMIT.md) — **ACs 1–3 met s14 (`44298914`): `public-write-door-unlimited` + policy threading + template limit; AC4 (default) 🧭 Richard** | **P76 F3** | a **site owner** whose form fills their database |
| DEF-017 | ✅ **done — C1, C2 (D18+D19), C3** | [Track C, handed over by phase 78](../phase-78-the-templates/TRACK-C-HANDOFF.md) | **P78 D18, D19, D26** | every app: controls in the wrong face; one content surface for nine kinds of thing |
| DEF-014 | ✅ done | [A filter on a column nothing has written is a 500](DEF-014-A-QUERY-AGAINST-A-COLUMN-LESS-CLASS.md) — **all four ACs; AC1 driven through the template's own `publishPage`** | **P77 SBR-015 s12 drive** | every **site owner on day one** — the site-builder cannot publish its first page |
| DEF-015 | ✅ done | [The backend card calls three components undeployed that can never deploy](DEF-015-THE-CARD-WARNS-ABOUT-WORKERS.md) — **all four ACs; AC1 and AC2 driven in the app at s12 (§9.2, §9.3)** | **P77 SBR-015 s12 drive** | every **author with a Run Tasks worker** — a green deploy that reads as failed |
| DEF-016 | ✅ done | [External Link reports Failure on every new tab it opens](DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md) | **P18 EXP-011 Tier 2.5 s41 drive** | every **author who wired Done or Failure** on the node — a link that worked, reported as blocked |

## Carried forward from phase 76, by reference

🔴 **These four were `⬜ open` when phase 76 closed.** They are **not re-authored here** — a second
copy of a task drifts from the first, and phase 76's files hold the measurements. Phase 80 owns
them; **read the linked file, not a summary of it.**

| id | status | task | source | bites |
|---|---|---|---|---|
| DEF-010 | ✅ done | [SB-009 — a component named in a **parameter** is not checked](../phase-76-the-site-builder/SB-009-A-COMPONENT-NAMED-IN-A-PARAMETER.md) — **all 5 ACs s14 (`44298914`); `component-parameter-unresolved` PROMOTED on the sweep (178 projects, 614 params, 15 hits all legacy-true); cross-runtime reuses `wrong-runtime-node`** | P76 F1 | every agent-authored app; **13 `component`-typed ports, 1 has an owner** |
| DEF-011 | ✅ done | [SB-010 — the door does not derive a JS node's script ports](../phase-76-the-site-builder/SB-010-THE-SCRIPT-PORTS-THE-DOOR-DOES-NOT-WRITE.md) — **s14 (`e6f26ffa`): re-driven pre-fix, then `withAuthoredScriptPorts` at both assembly seams; templates regenerated; the 30s-504 tense had aged (SBR-017's export backstop) — the standing cost was every consumer of `nodes.json`** | P76 F10 | **every cloud component any agent authors** — dead signal outputs, a 30s 504 |
| DEF-012 | 🟡 partial | [SB-011 — a query widens when it cannot narrow](../phase-76-the-site-builder/SB-011-A-QUERY-THAT-WIDENS-WHEN-IT-CANNOT-NARROW.md) — **§1 CLOSED s15 (2026-08-30): a failed translation fails the node (Query Records + Aggregate), `schemaFor` reads the built-in `columns` shape, a first-write Pointer column keeps its `targetClass`; SB-004 §7's pinned arm inverted; 3 mutants killed. §2 (fetch-before-parameters) measured — 265/270 parameter-fed queries at the default — and left with a finding: the file's own candidate collides with the optional-filter contract; the honest candidate is a door precondition. See SB-011 §5** | P76 F12/F13 | a cloud query returns **every row** when asked for a few |
| DEF-013 | 🔒 ruling | [SB-012 — three spellings of a component name](../phase-76-the-site-builder/SB-012-THREE-SPELLINGS-OF-A-COMPONENT-NAME.md) | P76 s6 | **an app whose pages link to each other cannot be authored in one pass** |

⚠️ **DEF-010, DEF-011 and DEF-013 are the same door as
[DEF-002](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md)** — `noodl-mcp/src/validate.ts` and its
reference resolution. DEF-002 grades **wires**; DEF-010/013 grade **references named in
parameters**; DEF-011 is **port derivation**. Four checks, one file. 🔴 **Sequence them, and assert
cardinality where they meet** — a check in a second pipeline is a duplicate first.

✅ **The shared corpus sweep the three demanded was run ONCE, 2026-08-29** —
`npm run calibrate:door` (`scripts/phase80-door-corpus.ts`) over 178 projects (both project
corpora). Denominators printed with the findings: 614 component-typed parameters (543
`ShowPopup.target`, 70 `taskTemplate`), 853 For Each templates counted-as-skipped, 612 cloud
components, 110 public doors, 4,356 Function nodes. Findings: **15 unresolved / 6 projects (all
legacy, sampled true) → promoted · 0 cross-runtime · 27 unlimited public write doors / 23
projects (all `submitContactForm`) → warning stays advisory · 3 nodes of DEF-011 debt in 1
MCP-authored project**.

⚠️ **DEF-013's premise may have aged the same way DEF-011's cost claim had** — SB-012's middle
rows (targets *are* checked, but "only against what is already on disk") were measured 2026-08-26,
and the door's `components` list has since been rebuilt from `authoredProjectViews`, which
overlays a plan's unapplied operations. **Re-drive SB-012 §1's table at HEAD before spending
Richard's ruling** — the two-pages-that-link-to-each-other plan may now stage clean.

## Carried forward from phase 78, by reference

🔴 **Registered 2026-08-29 at Richard's instruction** — *"We need to add the defects to phase 80"* —
after phase 78 s17 measured that these rows were named in **zero** files outside their own register.
They had been parked on a sweep that never existed: s16's prompt said *"phase 80 owns the register
sweep"*, and what phase 80 actually recorded was that it had been **created from** one. A completed
act, read as a standing commitment.

⚠️ **Same rule as the phase 76 carry above: NOT re-authored here.** Phase 78's register holds the
measurements, the sabotages and the repro steps. **Read
[DEFECTS-THE-TEMPLATES-FOUND.md](../phase-78-the-templates/DEFECTS-THE-TEMPLATES-FOUND.md), not this
table.** One `DEF` per row, ids checked free repo-wide before use — `DEF-010` was assigned twice in
this register once already, and that is how one row gets worked twice and another dropped.

| id | status | source row | what it is | bites |
|---|---|---|---|---|
| DEF-018 | ✅ done | **P78 D28** | A button inside a `Columns` overlaps the next one — both button compositions pin `sizeMode: 'contentSize'` — **fixed s19: `columns-child-keeps-own-width` (warning, per offending child) in the new `layoutInertCombination.ts` precondition, reaching both doors through `authoredPreconditionDiagnostics`. A Columns hands every child a fixed box (`column-item`, flexGrow/flexShrink 0) and clips nothing; a child whose RESOLVED `sizeMode` is contentSize/contentWidth ignores it — resolved against catalog defaults per DEF-006, because a bare button's TYPE DEFAULT is contentSize. Re-driven at HEAD first: the members band's own five buttons overlap 14px at 1280×900, inColumn control arm zero (`def018-def020-layout-drive.test.ts`). `gridAutoFit`'s description now carries the sentence D28 called the cheapest honest fix** | every **agent who lays controls out** in the one node that reflows |
| DEF-019 | ⬜ open | **P78 D30** | The type ramp cannot reach `font-variant-numeric`, so no app built here can align a column of numbers | every **app with a column of numbers** — money, times, scores |
| DEF-020 | ✅ done | **P78 D32** | Two children of a row both grow and nothing says so: `justifyContent` silently does nothing — **fixed s19: `justify-content-distributes-nothing` (warning, per row) in the same `layoutInertCombination.ts`. A row Group with a distributing `justifyContent` and ≥2 children that would grow (percentage width → `flexGrow` in `layout.ts`; width DEFAULTS to 100%, so growing is what a child of a row does) is asked to distribute space that never exists. Re-driven at HEAD first: 640/640 split, 0px gap; content-sized control 1108px gap at the edges. 🔴 **Calibration found the predicate's one WRONG shape, not just noise**: a maxWidth-capped grower leaves real free space and there justifyContent WORKS — 10 of 43 corpus firings were that shape, now excluded (child with authored/wired maxWidth = unknowable, not growing). Exactly-one-grower rows stay silent by design (they render what the author meant)** | every **agent laying two things out along a row** |
| DEF-021 | ✅ done | **P78 D33** | A fan-out send delivers **one** email and reports **N** successes — **fixed s16 (`4adab228`): each queued outcome token is stamped with the `To` it was minted under; stamps agree → today's path verbatim (one send, fields read after inputs settle), stamps disagree → one send per consecutive run of the minted address, each run settled by its own call. 3 mutants, each killed by exactly its arm; erg-001 §4's constant-To pin untouched** | every **member who was told they would be emailed** |
| DEF-022 | ✅ done | **P78 D34** | A cloud function cannot find out what the app's own public address is — **fixed s18: the Request node has an `Origin` output. The node already held the answer and threw it away (`request.ts` stored `req.headers` on the `Request` model with no port); `requestOrigin.ts` now derives it once — the caller's `Origin` header when usable (a browser POST always carries the page's own address, the thing TPL-002 had to be told from outside), else forwarded-host/host + forwarded-proto, else honestly blank (a workflow step has no caller). Port description names the trust boundary: caller-supplied, right for links back to whoever called, NOT for a password-reset a third party will click — that stays `effectiveBaseUrl`'s job, still unreachable from a graph (row below, `NONE`). 🔴 D34's "nothing exposes it to a graph" was too strong: an Object node with Id `Request` reads the raw `Headers` bag today, probed through the real runner — corrected in the register, not silently** | **everyone an app ever emails a link to** |
| DEF-023 | ✅ done | **P78 D35** | `Component` scope in a cloud function is **not** per-request, and nothing says so — **fixed s16 (`acd053e0`). 🔴 The recorded mechanism was the browser's: the cloud runtime never reaches `_componentScopes` — `noodl-js-api.js` overrode the scope to ONE module-level object, shared across all scripts, functions, requests and CONCURRENT requests. Now a WeakMap keyed on the component-owner INSTANCE (ids repeat across requests; instances do not): same-instance scripts still share (TPL-002's plan/pump contract), a new request starts clean, entries die with the request's graph — the leak half held by construction, not a spec** | every **graph that accumulates anything server-side** |
| DEF-024 | ⬜ open | **P78 D36** | A `Condition` can only ever turn a gate **ON**, so a screen accumulates contradictory answers | every **screen whose answer has more than one form** |
| DEF-025 | 🟡 partial | **P78 D37** | A control's label is a click target only via the control's own `label` port — which **defaults OFF** — **door half built s17: `label-not-a-click-target` warns on a Checkbox/Radio Button whose words sit in an adjacent sibling Text (43 true firings / 186 toggles over the 178-project corpus, denominators printed; stays advisory — the corpus carries 43 legitimate legacy instances, the `raw-color-literal` precedent). Default-flip half 🧭 Richard — see the s17 section: a blunt flip stamps the literal string `'Label'` onto every existing bare checkbox** | every **person tapping the words beside a checkbox** |
| DEF-026 | ✅ done | A cloud call to an unreachable backend reports nothing — **fixed s17: `CloudFunction2`'s error handler dereferenced `e.error` unconditionally, and a connection refusal hands it `undefined` (real Chrome probed at HEAD: `readyState 4, status 0, response ''` ⇒ `JSON.parse` throws ⇒ body `undefined`), so the ONE route to the `failure` outcome died on a TypeError inside the XHR callback. Handler now total; status 0 reports "Could not reach the backend at <endpoint>". Same hole filled in `Noodl.CloudFunctions.run` (rejected with `undefined`; JSON error bodies still pass through untouched)** | **anyone** whose backend is not running — the ordinary way this breaks |

🔴 **Three of phase 78's eleven unowned rows are NOT here, deliberately: D22, D23 and D24 are
template-side.** This phase is graded on the product surface and never on a template being fixed
downstream of it (README §*"Every task here is graded on the product surface"*), so filing them here
would put three template edits behind a product phase's dependencies. **They stay with phase 78 as
work before publication** — see that phase's `T6`. Named here so the split is a decision on record
and not a gap: **eleven rows, eight carried, three placed elsewhere.**

⚠️ **Candidate groupings, left unmerged on purpose.** DEF-018 and DEF-020 are both *the layout system
doing nothing and saying nothing*; DEF-022 and DEF-023 are both *a cloud function's model of its own
world*. They are filed one-per-row because a wrong merge is expensive to unpick and a right one is
cheap to make later — and because nobody has yet read the two pairs against each other at the source.

## Reds that belong to someone else, named so they stop reading as regressions

- ✅ **`noodl-mcp/tests/templateAppearance.test.ts` — `site-builder has the pinned page count`,
  expected 5, received 6 — CLOSED 2026-08-29 by phase 77.** I attributed it to TPL-001 because the
  pin lives in their file; **phase 77 took it instead and was right to**: SBR-017 is what made the
  site-builder six pages, so the pin's disagreement was their consequence. Pin bumped to 6, the new
  page answers §4's bare-page floor, noodl-mcp is **938/938**. ⚠️ **Worth keeping as a shape: the
  owner of a red is whoever moved the measured thing, not whoever owns the file the number sits in.**
- ✅ **`catalog:check` — a PR CI gate (`pr.yml:198`) — was RED at HEAD** because `0c011b6b`
  (DEF-016) changed three `External Link` port descriptions without regenerating the catalog.
  **Fixed as a side effect of DEF-003's regeneration.** Recorded because it is last session's own
  lesson arriving twice: *a closed task's outstanding debts need an owner, not just its carried rows.*
- ✅ **`catalog:examples` — FIXED 2026-08-29 s13, 62/62.** Both recipes repaired at the graph, per
  their own diagnostics' suggestions. `comp-repeater-set-item-object`: the wires used a bare `done`
  where `Model2`/`SetModelProperties` property ports are **`prop-done`** (`modelnode2.ts` —
  `prop-<field>` is the value, `changed-<field>` the signal; the bare name resolved to a signal,
  which is exactly the `signal-into-value-port` defect the recipe was teaching).
  `fn-aggregate-stats-function`: gained a second `noodl.cloud.response` with `status: 'failure'`,
  `error → errorMessage` and `failure → send`, so the recipe now demonstrates the failure route
  DEF-002's rule exists to require. `catalog:merge` re-run (an example edit is not docs-only —
  `packages/noodl-types/src/node-catalog-enriched.json` moved), `catalog:check` green,
  `noodl-mcp` **961/961**. The original text is below for the record: Measured by DEF-006 s7 before it changed anything, and again after: unchanged either
  way. Two shipped recipes carry a warning each, and `catalog:examples` is warnings-as-errors:
  `comp-repeater-set-item-object` fires `signal-into-value-port` on a checkbox's `checked`, and
  `fn-aggregate-stats-function` fires `failure-reaches-nothing` on a cloud aggregate. **Both example
  files date to `c0d6c86f` (2026-07-23) and are unchanged; what moved is the rules** —
  `failure-reaches-nothing` was promoted by **DEF-002** on 2026-08-29. DEF-002's closing note says
  what remains of that rule's corpus is *"two deliberately-malformed test probes"*; these are neither.
  They are the recipes `get_example` hands every agent, teaching the two defects phases 76 and 77
  filed as findings. 🔴 **Owner: `NONE`** — a closed task cannot own its debt, and this one is a PR
  gate that fails every PR until somebody takes it. Fix is a graph edit to two recipes, ~20 minutes,
  and both diagnostics carry their own `suggestion`.
- ⚠️ **A phase 77 spec asserted DEF-014's defect as correct behaviour, and phase 80 moved it.**
  `nodegx-backend/tests/sb015-first-local-run.test.ts` pinned the unclaimed arm's page query as
  *failing* (`query-records/query-failed`) rather than returning empty — true when written, and the
  evidence for SB-015 §6.4a's screen fix. With DEF-014 fixed at the cause the arm reports **zero**
  browser errors and the screen still names the state, so the assertion was inverted in place with
  its original text kept above it. **Suite green: 117/117, 1384 passed.** Recorded here because the
  owner of a red is whoever moved the measured thing, and that was this phase — phase 77 should know
  the reading changed, not discover it.
- ⚠️ **`packages/noodl-mcp/dist/noodl-mcp.cjs` is stale**, so a *running* MCP server still answers
  `notFound` for `Page.title` until the next build. Source, suites and committed catalog are correct.
  **Owner: whoever cuts the next 0.2.1 build.**

## Findings this phase raised that nobody owns

- 🔴 **`publishPage` issues its refusal after making the page public.** Owner: **`NONE`**. Found by
  DEF-014 s10 while trying to assert that a publish *did its work* rather than merely answered — the
  obvious assertion (`published: true`) could not fail.

  Run against the pre-fix behaviour, `POST /functions/publishPage` answers **400 "This page could
  not be published."** and the page comes back `published: true` with `ACL['*'].read === true`. The
  function writes the page's flag and opens its ACL, and only then runs the sections query that was
  failing. A person was told their page could not be published, about a page that was — in the
  database — published and world-readable.

  🔴 **DEF-014 removes this cause and not the ordering.** Any later failure inside that function
  leaves the same state, and the state is one a person cannot see: their own admin panel says the
  page is a draft. It is the template's graph (phase 77/78's), and DEF-014 §5 says not to fix that
  row from the backend side — so it is registered rather than done.

- 🔴 **Nothing gives an auto-created class the columns its project has already declared.** Owner:
  **`NONE`**. Found by DEF-014 s10 (see that file's **§6.1**), and it is DEF-014 §3's own third
  bullet left undone rather than a new idea.

  A collection in the local backend is created by its first *use* with no columns, and gains them one
  at a time as writes arrive. The project already knows better — its `dbCollections` metadata names
  every property — but that knowledge never reaches the running backend: **every** `createAdapter`
  call site in `nodegx-backend` omits the `collections` option, so `_collections` is `{}` in every
  running backend, and `provisionBackend.ts` creates collections only on the AI-authoring plan path
  (where its own comment calls the step advisory).

  🔴 **It is the only route to a real typo/unwritten distinction.** DEF-014's fix answers a filter on
  an unwritten property as empty and reports it once in the log, because nothing in the backend can
  tell a misspelling from a property no record has carried yet — *declared but unwritten* is not a
  state that exists here. Provisioning the declared columns is what would create it. Until then, a
  misspelled property name is reportable and not refusable.


- 🔴 **There is no semantic token for error TEXT, and that is why a composition has to reach for a
  raw palette token to stay legible.** Owner: **`NONE`**. Found by DEF-006 s8 while sourcing
  `fieldError` (see that file's **§7.4**).

  `--destructive` is the only semantic red in the set and it is a **fill** colour — sized for white
  text on top of it. Measured as 14px text on the `--surface` a form card sits on, it is **4.38:1
  under Playful and 4.49:1 under Soft**, both under AA's 4.50. So `fieldError` ships `--red-700`,
  which holds 6.03:1 or better in all six palettes but which **no preset re-themes** — a re-themed
  app keeps a brick-red error line while everything else moves.

  **Neither option is right, and that is the finding.** What is missing is a token like
  `--destructive-text` that presets move *and* that clears 4.5:1 as type. 🔴 **It is not a
  one-line addition**: it means a value in `DefaultTokens.ts` **and in all five presets**, each
  chosen against the contrast floor — a design decision with a budget attached, which is why s8
  registered it instead of inventing it. ⚠️ **The gate now catches the mistake if somebody tries
  the easy version** — `design-token-contrast.test.ts` arm (e) grades text on `--surface` as well
  as `--background`, which is what would have caught `--destructive` here.

  🧭 **Plausibly Richard's**, on the same grounds DEF-001's `--primary` ruling was: it changes what
  every re-themed app looks like.

- 🔴 **A workflow step pointing at a cloud *helper* is told to deploy it, and deploying can never
  help.** Owner: **`NONE`**. Found by DEF-015 s11 while grepping for other readers of the predicate
  DEF-015 fixed — the same half-rule, at a second surface.

  `functionRefResolution.projectFunctionNames()` (`models/workflow/functionRefResolution.ts:122`)
  calls `getCloudFunctionNames`, which is still the **prefix-only** list — correctly, because that
  function's question is "is this component in the project". But `resolveFunctionRef` then compares
  it against the backend's Request-node-derived list, so a step whose `ref` names a helper resolves
  to `resolved-in-project` with the summary *"in this project · not deployed yet"* and the message
  *"Deploy it, or run it and the step will fail with a missing function."*

  🔴 **The alarm is right and the remedy is impossible.** Measured: `StepExecutor.invokeCloudFunction`
  (`nodegx-backend/src/workflow/StepExecutor.ts:208`) refuses through `runner.hasFunction`, which is
  `findRequestNodeForFunction` — so the step really does fail, with **404 `Step target function
  "<name>" not found on this backend`**. No number of deploys will change that: the component has no
  Request node, so it will never appear in `GET /admin/workflows`. The author is sent to a button
  that cannot fix it.

  ⚠️ **Not folded into DEF-015.** DEF-015's fix is "what may the card warn about"; this is "what
  should a broken step *say*", it has its own five-state model and 15 specs
  (`tests/workflow/functionrefresolution.test.ts`), and the honest answer is a **sixth** state — in
  the project, but not callable — rather than a rewording. Phase 27 authored it and is closed.

- 🔴 **A second project deploying to a shared local backend KILLS THE BACKEND PROCESS.** Owner:
  **`NONE`**. Found by DEF-015 s11 when it blocked that task's AC1 drive. **Reproduced outside the
  editor entirely**, with `curl` against a backend running the committed `nodegx-backend/dist/cli.js`
  — so no editor code is implicated.

  Two `PUT /admin/workflows/<name>` calls carrying bundles that declare the same component names.
  The first answers `200`. The second answers **nothing**: the process is gone.

  ```
  Error: Duplicate component name /#__cloud__/site/SetSectionAccess
      at NodeContext.registerComponentModel (dist/cli.js:6782)
      at GraphModel2.importComponentFromEditorData (dist/cli.js:9170)
      at async CloudRunner.load (dist/cli.js:47778)
      at async WorkflowRunner.loadWorkflow (dist/cli.js:63467)
  ```

  🔴 **It is an uncaught throw on an async path, so it takes the process down rather than failing the
  request.** `loadWorkflow` is `await`ed from the PUT handler; the rejection escapes, and Node exits
  non-zero. The editor sees only `TypeError: fetch failed` / `SocketError: other side closed`, and
  `ServiceSupervisor` logs `exited (code=1)` with no reason — the backend's own stderr is not
  forwarded, so the cause is invisible from the editor.

  ⚠️ **The population is not exotic — the product advertises it.** The backend card says *"Also used
  by: SBR-007 Page Editor Drive"* and *"1 attached · 23 others"*, so one local backend serving
  several projects is a supported arrangement. Any two of them sharing a template — every
  site-builder project shares all seven cloud components — collide on the first deploy of the second.
  A bundle name is `<projectName>-<hash of project directory>`, so a **copy** of a project is always a
  new bundle, never a replacement.

  ⚠️ `Start ephemeral (no persistence)` does **not** avoid it: it drops data persistence, not the
  workflows directory, so the already-deployed bundle is still loaded and still collides.

  **Two candidate fixes, and they are not the same size.** Catching the rejection so the PUT answers
  400 and the backend survives is small and clearly right. Deciding what *should* happen when two
  projects deploy the same component names to one backend — namespace per bundle, refuse the second,
  or last-writer-wins — is a design question with a person attached to it.

- 🔴 **A cloud function in a FOLDER is declared, listed, ticked on the card — and unreachable over
  HTTP.** Owner: **`NONE`**. Found by DEF-015 s11 while measuring an arm for phase 77's SBR-006 AC1.
  Measured on a live backend, `curl` only.

  **The same graph, deployed twice, one variable changed:**

  | deployed as | `GET /admin/workflows` | `POST /functions/<name>` |
  |---|---|---|
  | `publishPage` | listed | reaches the runner — `500 Unauthenticated requests not accepted.` |
  | `nested/publishPage` | **listed** | **`404 Not found: POST /functions/nested/publishPage`** |

  The route is `/functions/:name` and `:name` does not match a nested path, so the request never
  reaches `WorkflowRunner.run` — the 404 is the router's generic miss, **not** the runner's
  `Function '<name>' not found`. Two different 404s that read alike; only the body separates them.

  ⚠️ **Folders are a first-class affordance, not a corner.** The editor creates cloud components in
  them (`/.placeholder` exists precisely to make an empty cloud folder visible), the shipped
  site-builder template puts three of its seven in `site/`, and `getCloudFunctionNames` deliberately
  preserves nesting. 🔴 **`cloudFunctions.test.ts:85` is green and pins it**: its comment reads
  *"POST /functions/<name> — the prefix is stripped, nesting is not"* and it asserts `orders/save`.
  The gate encodes the broken address as the expected value.

  🔴 **DEF-015's card cannot see this and will show a green ✓.** The card diffs the project's
  endpoints against `GET /admin/workflows`, and a nested endpoint appears in **both** — so it
  matches, and gets a tick. That is a limit of what "the backend is serving it" can mean: the
  backend declares it and will not route to it. Fixing the route makes the tick true; until then the
  card is honest about the wrong question.

  **Two candidate fixes:** make the route accept the rest of the path (`/functions/*`), or refuse
  nested names at deploy so the author is told at push time. The first is what the name convention
  already promises.

- 🔴 **The backend card cannot see a backend-side change: its only refresh is a push.** Owner:
  **`NONE`**. Found by DEF-015 s12 while trying to drive that task's AC2 (see its **§9.4**).

  **Measured, with the backend genuinely serving three functions and the project declaring four:**
  the card kept reading four ✓ and zero warnings through a panel close/open **and** a full renderer
  reload — with the backend verified as still serving three afterwards, so it was a stale reading
  and not a silent re-push. The panel **hides rather than unmounts** (a stamp set on the section
  survived the toggle), so `useEffect` never re-fires; and `CloudFunctionsSection` refreshes on
  exactly two things — mount, and `CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED` with `isPushing` false.
  A push whose export hash is unchanged **returns early without `notify()`**, so a no-op save does
  not refresh it either.

  🔴 **The consequence is about the `missing` row specifically.** A successful push always leaves
  the backend holding exactly the project's endpoints, so `missing` is empty by construction
  immediately after one. It can only ever render when a push **failed** — which is the case
  WFA-001 built it for, with `lastError` beside it. It cannot render because the backend changed,
  because the card never looks again.

  ⚠️ **Not a defect in DEF-015's fix, and the header is honest** — it says `pushed 54s ago`. The
  **rows** are what overclaim: *"in the project, not on this backend"* reads as a statement about
  the backend now. Candidate fixes are a refresh when the panel opens, a poll while it is visible,
  or wording that says *at last push*. That is a design choice with a cost, which is why it is
  registered rather than done.

- ⚠️ **A stale cloud function is rendered twice — as a green ✓ and as a warning.** Owner:
  **`NONE`**. Found by DEF-015 s12 in the AC2 control frame, and visible in its screenshot.

  `CloudFunctionsSection` renders `backendFunctions.map(...)` with a success tick for **every**
  function the backend reports, and the `stale` block immediately below flags a subset of that same
  list with a warning triangle. So a function that is on the backend but not in the project appears
  as a healthy row *and* as a problem row, one line apart. Trivially fixed by rendering the ticks
  over `backendFunctions` minus `stale`; recorded rather than folded into DEF-015 because it is a
  rendering choice in a block that fix did not otherwise touch.

- 🔴 **A value that has not changed re-runs a "Run On Value Change" input.** Owner: **`NONE`**.
  **Raised by phase 77 s28** ([D26](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d26)),
  registered here because phase 77 is closing and this bites every builder.

  `simplejavascript.ts`'s `setScriptInputValue` schedules a run whenever a value lands on a ticked
  input, without comparing it to the value already there. Measured in a cloud-function trace: a code
  node received `title: 'Pricing'` twice, identically, ran twice, and **wrote a database row on each
  run**. That was three quarters of a defect where one `Duplicate` press created four pages.

  🔴 **It contradicts the runtime's own contract.** `run-on-value-change.ts` — Richard's 2026-08-01
  decision, written up in that file — justifies keeping `Run` on the grounds that an async re-fetch
  *"that returns an identical value fires no change"*. Only true if an identical value is not a
  change; today it is one.

  **Shape of the fix**: an equality guard for **primitives only** (a mutated array is the same
  reference and must still re-run). Four lines per family — and **twelve families share the idiom**
  (`expression.ts`, `condition.ts`, `dbcollectionnode2.ts` and nine more), which is what makes it a
  task rather than a patch: repairing one leaves the runtime inconsistent in a way no author can see.

- 🟡 **`Record.Fetched` fires when the `Id` merely binds — the description is fixed, the behaviour
  is not.** Owner: **`NONE`**. **Raised by phase 77 s28**
  ([D25](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d25)).

  `setModel` sends `Fetched` from the `Id` input setter, where `Model.get(id)` has minted an empty
  local model and nothing has been read. Deliberate, and `Done` exists because of it. ✅ s28 fixed
  the **description**, which promised *"the record has been read and the property outputs are up to
  date"* and was false in both halves on that path — regenerated through the catalog, the cloud
  library and the docs site, because there are four copies of it.

  🟡 What is left is whether a signal named `Fetched` should fire without a fetch at all. Two
  candidate repairs (fire only when the bound model has data; or split the bind announcement onto
  its own port), both of which re-grade browser graphs that rely on today's shape.

- 🔴 **The one `domelement` port in the product cannot reach the destination its own description
  names.** Owner: **`NONE`**. **Raised by phase 77 s29**
  ([D27](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d27)), registered
  here because phase 77 is closing and this is a node-library row.

  `Video.onVideoElementCreated` is typed `domelement` and described as *"for a **Group to scroll
  to** or a script to reach"*. `Group`'s `Scroll To Element - Element` is typed `reference`, and
  `canCastPortTypes('domelement','reference')` — executed over the shipped `typecasts` table — is
  **`false`**. The editor refuses the wire the description prescribes, with a `type-mismatch`.

  **And it would not have worked if it had connected**: `Group.tsx:113` calls
  `noodlChild.getDOMElement()`, so it wants the *node*; `Video.tsx:217` sends the raw element, which
  has no such method, and the guard would report *"no rendered DOM element — it may not be
  mounted"* about an element that is mounted. Two defects in eight words of description.

  **Measured over the 175-node catalog**: `domelement` has **1** output and **0** inputs, and
  reaches **0** typed inputs (the 14 it reaches are `*` wildcards). Control: `reference` has **27**
  outputs — `this`, on every visual node — which is the working wire, one identifier away.

  **Shape of the fix**, ascending: repair the description (⚠️ **four generated copies**); or widen
  `scrollToElement` to accept either and add the cast; or leave the port as the script hatch it is.

  🔴 **Why it is worth a row rather than a footnote.** Phase 77's D23 proposed *"a `domelement`
  output on `Group`, three lines, `video.ts` is the template"* as a fix. Copying this port would
  have added a **second** unconnectable port and read as closed. The row was stopped because the
  fix was checked before it was written — see phase 77 §32.5.

- 🔴 **The configured site address is unreachable from a graph — DEF-022's broader half.** Owner:
  **`NONE`**. Registered s18 (2026-08-30) while closing DEF-022, which answered the *request's*
  half only. `EmailConfigState.effectiveBaseUrl(fallback)` is the product's own answer to "where
  does this app live" — configured, operator-owned, NOT caller-supplied — and its three consumers
  are all HTTP routes inside the backend (`oauth-routes.ts`, `email-routes.ts`, `admin-auth.ts`).
  No node and no process global beside `_noodl_send_email`/`_noodl_get_secret`/
  `_noodl_system_users`/`_noodl_system_roles` exposes it. Two populations DEF-022's port cannot
  serve: a **workflow with no request** (the Origin output is honestly blank there — measured,
  it is the spec's third arm), and a **link a third party will click** (a password reset built
  from a caller-supplied header is the classic reset-poisoning shape; the port's description
  says not to). D34's suggested shape stands: a read-only `Site Address` node resolving
  `effectiveBaseUrl`, the same seam `Secret` uses (a process global set by the backend, a
  cloud-only node reading it). The email templates the backend sends already use it; a graph
  composing its own email cannot.

## Rulings needed (Richard)

- 🧭 **Does this phase exist, or do these fold into 0.2.1's bug-fix phase?** The tasks are written to
  survive either answer. What they must not do is stay inside a template phase — a template phase
  closes when its template ships, and these outlive it.
- 🧭 **DEF-005 is a security-posture ruling before it is code.** The cloud-only rule on role *writes*
  is correct and must survive; the question is whether a browser may **read** its own roles. Reading
  one's own roles grants nothing — the server still decides every request — but it is a posture
  change and it is yours.
- ✅ **DEF-001 — RULED 2026-08-29.** Richard: **`--primary` moves, white text stays.** Landed at
  `30eb92b2`. See DEF-001's §7.
- ✅ **DEF-002 — CLOSED 2026-08-29.** All three rules and AC6. `1bc1cb8a` (1a), `95be7b4c` (3),
  `820fde86` (AC6 + the calibration script), `c8e0f262` (1b/1c), `b91d696a` (2).
  🔴 **One decision is deferred, and its recorded reason was corrected at `d3461020`.** Promoting
  `failure-reaches-nothing` into `AUTHORED_BLOCKING_WARNINGS` looked blocked by the **shipped
  templates**; it was not. It was blocked by **two false positives in the rule** (a `completed` that
  already answers, and a parallel branch that already answers), both now exits with arms and
  controls. Corpus **249 → 182 → 33**, templates **clean**. What is left is **two deliberately-
  malformed test probes** — wire their `failure` or exempt them, then add the code to the set. Small
  and named, recorded in `authoredCandidate.ts` beside the set.
- 🧭 **P76 F8, still open since s4** — `contactRecipient` cannot live in a world-readable
  `SiteSettings` row. Carried in phase 76 with no register; recorded here so it stops being invisible.
  It blocks the claim that a contact form reaches anyone.
- 🧭 **DEF-009: should a public cloud function's `rateLimit` default to something rather than
  `null`?** A default too low breaks a legitimate burst; `null` is what shipped.
- 🧭 **DEF-007: where is a template with NO home caught — refuse at publish, or resolve-and-warn at
  install?** Raised by §2.1 on 2026-08-29. Nothing on the curated path checks it today, at either
  end, while `noodl-preview` already resolves-and-warns. ⚠️ **The check cannot simply be "has a
  `rootNodeId`"** — 63 of 340 manifests on this machine lack one and most are **modules and
  prefabs, which have no home by design**. Refusing is honest about a template nobody can open;
  warning matches what preview already does.

## Not in this phase, and why

- **P77 D4** (a refused query and an empty collection are the same screen) — 🔄 **reclassified as
  template work.** `DbCollection2` carries both `failure` (signal) and `error` (string) at HEAD, and
  phase 78's D4 drove it: a 403 fires `failure`. The site builder never wired them. → SBR-006/SBR-010.
- **P78 D10** (the generators bypass the design system) — template-generator work with a named home
  in phase 78. Disproved as a platform limitation: `metadata.designTokens` persists and the artefact
  ships it.
- **P77 D9** (deploy drops wire-only `prop-*`) — already owned by **SBR-008**.

### DEF-017 — Track C, and why it is phase 80's rather than phase 78's

🔴 **Renumbered from DEF-010 on 2026-08-29.** `DEF-010` was assigned **twice** in this register —
here, and to SB-009 in the carry table above. SB-009 holds the number: its own banner
(*"OWNED BY PHASE 80 AS DEF-010"*) and phase 76's closing carry table both pin it, and both predate
Track C's registration. **Commits and notes written before this date that say `DEF-010` and mean
Track C mean DEF-017** — `e87ea775` and `42325550` are the two.


🧭 **Richard scoped the members'-area repair into three tracks and ruled Track C ours**: it is
product source (`StyleCompositions.ts`, the viewer's control CSS), and phase 78 has deliberately
never touched editor source — that isolation is what has kept the two phases from colliding.
Everything is measured with file and line in
[TRACK-C-HANDOFF.md](../phase-78-the-templates/TRACK-C-HANDOFF.md); it was verified at source
before any of it was acted on, and every measurement in it held.

- ✅ **C2 (D18/D19) — DONE `42325550`.** `assets/style.css` had **exactly one `font-family`
  declaration in the whole file**, on `.ndl-controls-select`; `button` and `textinput` now
  inherit too. `StyleCompositions.ts`'s `body` description was corrected in the same commit —
  it told an author controls inherit the page font, which is what a generator reads *before
  deciding not to set one*, so the CSS repair alone would have been rewritten.
  🔴 **D19's cause is located, 2026-08-29, and it is wider than the row says.** The label is not
  hardcoded `#000` — **nothing sets a colour on it, and there is no colour floor to inherit.**
  `TokenResolver.generateCss` (POL-006) appends exactly one applied rule after the `:root` block:

      body { font-family: var(--font-sans); }

  **font-family only.** There is no `color: var(--foreground)` anywhere in the viewer, the two
  static HTML templates, or the token CSS — grepped, zero hits. So *any* element that does not set
  its own colour renders the browser's black, and the label is simply the one somebody looked at.
  `--foreground` is a token nothing reads at the floor — **the same defect class as
  `--surface-raised` in D26**, which C1 has just fixed.

  ✅ **The fix is one line in the place designed for it**, and POL-006's own reasoning transfers
  verbatim: *"a floor, not an override — `body` is the weakest place to say it, so any node that
  sets its own still wins."*
  ⚠️ **State the blast radius before doing it**: every element in every project that does not set
  a colour moves from `#000` to `var(--foreground)`. In the default theme that is `#0f172a`, a
  near-black and a small change; **in a dark theme it is a large one, and the correct one** —
  which is the argument for the fix rather than against it.
  ✅ **DONE `c43b6bb1`**, after the peer's teardown — `TokenResolver.ts` is under
  `noodl-editor/src`, which a running `dev:debug` watches, so applying it during their drive would
  have hot-rebuilt under them. Gated beside the font floor, because it is the same one line and
  because D18's fix *inherits from* this block. `test:ci` at the floor (2889/4, seed 03794).

  ✅ **D19 done — see above.** Recorded as NOT done at first, and the row's framing
  (a label defect) was narrower than the cause. Original note kept: — the colour comes from the
  label style group (`TextInput.tsx:235`, and the same in Checkbox/RadioButton), not from the
  stylesheet, so it is a different fix from D18's and was left rather than guessed at.
- ✅ **C1 (D26) — DONE `2c6a8876`.** Two compositions, `raised` and `ruled`, both **lifted verbatim
  from `ui-data-table`** and diffed against their source nodes — identical. `raised` reads
  `--surface-raised`, the token that was in the set and read by nothing; `ruled` carries **no fill
  at all**, which is what stops a list reading as a stack of cards.
  🔴 **The file's doctrine is that parameters are copied from a shipped, gated recipe and that a
  composition which cannot be grounded is LEFT OUT rather than invented.** Worth knowing before
  touching this file: "add a composition" is not a design task here, it is a sourcing task. Two
  details came free from obeying it that taste would have got wrong — `ruled` uses
  `--border-subtle` where `raised` uses `--border`, and `ruled` has no `backgroundColor`.
  ⚠️ **`raised` only reads as raised on a `--surface` ground** (`--surface-raised` and
  `--background` are both `#ffffff`), and its description says so.
  ⚠️ **A drift sweep of all 20 compositions was run and NOT reported, twice, because both readings
  were the checker** — a regex flattened `maxWidth: { value: 1200, unit: 'px' }` into a top-level
  `unit` parameter, and every false positive carried that key. The doctrine holds. A mechanical
  gate is worth having and needs a real parser.
  🟢 **Phase 78's B3 is unblocked.**

- ⬜ ~~**C1 (D26) — open**~~ Of eighteen compositions
  exactly **two** carry a content fill (`bandSurface`, `card`) and **both are `var(--surface)`**,
  so there is one way to make something look like a distinct object and **nine kinds of thing
  wear it**. That is the "standard bootstrap feel" Richard named. 🔴 **It is cheap:
  `--surface-raised` is already in the token set, declared once and read by nothing** — verified:
  0 references in `StyleCompositions.ts`, and its single occurrence in the members-area is a
  *declaration* in the project token block, not a paint. The second surface does not need a
  palette decision, it needs a **reader**. Same shape as *a token nothing reads is a theme
  nobody sees*.
  ⚠️ **Not more variants of `card`** — what is missing is contrast *between* compositions: a
  **raised** treatment on a `--surface` ground, and a **ruled** treatment so a list stops looking
  like a stack of cards. 🔴 **Phase 78's B3 is capped until C1 lands.**
- ✅ **C3 (D20)** — filed at `f9367dc7` as DEF-006 §0(c).

- **P76 F10 / F12 / F13** — already owned by **SB-010** / **SB-011**.

## Session log

- **2026-08-30 (s16)** — **DEF-021 and DEF-023 closed, both reproduced at HEAD before building**
  (`4adab228`, `acd053e0`). DEF-021: D33's one-pass/three-addresses arm went red exactly as
  recorded (1 mailer call, last address, 3 dones); fix stamps each queued outcome token with the
  `To` it was minted under and treats a batch whose stamps disagree as a fan-out — one send per
  consecutive run of the minted address, each settled by its own call. 🔴 **The stamp must never
  become the address a SINGLE-address batch uses** — a pulse can arrive before its `To` in the
  same pass, so that path still reads the settled value (its own spec arm, and the mutant that
  proves it). DEF-023: the standing instruction paid a 13th time — **the recorded mechanism was
  the wrong runtime's**. D35 cited `_componentScopes` keyed by reused instance ids; the cloud
  runtime never reaches it (`noodl-js-api.js` overrode the scope to ONE module-level object —
  wider than the row: shared across functions and CONCURRENT requests too, and across runners in
  one process, which the third spec arm caught by accident when the previous test's flag leaked
  in). Fix: WeakMap keyed on the component-owner instance. ⚠️ **TPL-002's `plan` script comment
  now overstates** — it asserts "`Component` is not per-request" as current fact; true when
  written, fixed by DEF-023. Regenerating the template for a comment was not done (byte-gate
  churn beside a peer's mcp test edits); owner: **whoever next regenerates members-area**
  (phase 78 T6 window). Gates: viewer-cloud **204/204** (was 194; +7 DEF-021, +3 DEF-023),
  `tsc -p noodl-viewer-cloud` clean, backend consumer suites over viewer-cloud/src
  (tpl002-notifications, cwf-016) **45/45**, tpl002 serial pump green pre- and post-fix (one
  address per pass — never enters the new branch). `test:ci` not owed: no editor or
  noodl-runtime source moved. ⚠️ noodl-mcp/dist and nodegx-backend/dist staleness now also
  covers DEF-021/023 — owner unchanged (next 0.2.1 build).

- **2026-08-29 (s13)** — **DEF-008 closed: the measurement was taken and D6 does not reproduce.**
  Rendered headlessly (`withRenderedPage` over a `demo-app` copy, no editor), `maxWidth` on `Text`
  reached the DOM in **all four** authored arms — bare `240` (as `240%`, DEF-003(a)'s coercion),
  object px (`240px`, offsetWidth 240), **D6's exact shape** (`contentSize` + `{100,'%'}` →
  `100%`), and inside a For Each-instantiated component (D6's real placement) — beside a `none`
  control and a known-firing Group. 🔴 **The one measured mechanism producing D6's exact reading**:
  `maxWidth` authored on a component **instance** renders `none`, indistinguishable from the
  instance without it — and the door **blocks** it (`interfaceless-instance` fired naming the
  parameter; driven, not read). `unitless-dimension` also driven on the bare form. Both §1
  candidates refuted as explanations of `none`. Outcome written into phase 77's register (D6 →
  closed into DEF-008). **DEF-001 AC1's owed inch closed in the same render**: a Button carrying
  ButtonConfig's stamps painted `#2563eb`/white at **5.17:1** with `--primary` verified at `:root`.
  §2 (LogOut's `login` input) carried as written — no work proposed.
  **Also this session: `catalog:examples` taken off the unowned list — 60/62 → 62/62** (see the red
  gate's entry above): two shipped recipes repaired at the graph, `catalog:merge` + `catalog:check`
  re-run, `noodl-mcp` 961/961. The only repo edits are the two example JSONs and the regenerated
  enriched catalog; no editor/runtime source moved, so `test:ci` is not owed — the floor stands at
  s11's 2905/4.

- **2026-08-29 (s12)** — **DEF-015 closed: AC1 and AC2 driven in the running app.** The blocker s11
  hit was cleared **without touching the defect that caused it** — instead of moving a peer's
  deployed bundle aside, the drive project was given its own empty backend (a backend directory is
  just `config.json` + `schema.json` + `data/` + `workflows/`, and `listBackends` is a plain
  `readdir`), so the shared-backend collision was routed around rather than provoked. The card reads
  **4 ✓ / 0 warnings / `3 workers, run in-process by these functions`** after an explicit
  `Deploy functions`. 🔴 **AC2's recipe as written could not be run**: deleting an endpoint from the
  deployed bundle and reloading the backend changes nothing on the card, because the card only
  refreshes on a push — registered above with owner `NONE`. The control was built from the other
  side instead (a second bundle adding one function the project does not have), and the instrument
  reads **0 → 1 → 0** with the 1 naming exactly that function. **No repo source was edited**, so
  `test:ci` was not re-run — there is nothing here for it to grade.
  Two findings registered above, both owner `NONE`.

- **2026-08-29 (s8)** — **DEF-006 (c) closed, and the survey's one judgement was wrong.** The six
  compositions landed verbatim — the vocabulary is **26** and now names a form field, a control that
  takes typing, an error line and an empty state. 🔴 **§6.4 said to source `fieldError` from
  `--destructive`; measured, that fails AA as text in two of the five presets** (Playful 4.38, Soft
  4.49 on `--surface`) where `--red-700` never drops below 6.03. The survey measured against
  **white** rather than the ground a form card sits on, and against the **default palette only** —
  which its own next line warned against. 🔴 **The contrast gate would have passed it**: it graded
  undeclared backgrounds as `--background`, where the same token clears in all six. Gate widened to
  both implicit grounds (**55 → 86 pairs**, nothing reddened) and pinned by arm (e), which a
  narrowing mutant reddens **alone**. The recipe's own note was right and its **number was stale** —
  3.60:1 was exact for `#ef4444`, the value `--destructive` held before DEF-001 moved it that
  morning. Missing `--destructive-text` registered above with owner `NONE`.
  Commits: see the phase-80 next-session prompt.

- **2026-08-29 (s7)** — **DEF-006's scope closed; (c) left, with a sourcing survey rather than a
  sentence.** The audit AC2 asked for found **1** inert parameter in 20 compositions — and widening
  the same instrument to the recipes those compositions are copied from found **11**, of which
  **2 were the rule's own false positives**: `conditionIsUnsatisfied` answered from the authored
  parameter bag while the canonical evaluator falls back to the port's default. Fixed in the rule,
  measured over compositions + 62 examples + 40 projects (1,601 nodes) at **3 removed / 0 added**,
  with a sabotage control at **70 added** so the zero is a reading. 🔴 **The contract test that
  existed to catch exactly this could not**: its model of the canonical evaluator was a bag lookup
  with the default fallback deleted. `find_tools` now finds a group by id/title/keywords — its own
  description had been promising that already — at **8,255 → 8,254** resident tokens.
  Commits: see the phase-80 next-session prompt.

- **2026-08-29 (from phase 78 s17)** — **DEF-018–DEF-025 registered**, carried by reference from
  phase 78's register at Richard's instruction. They had been parked on *"phase 80 owns the register
  sweep"* — a sentence that existed only in phase 78's own prompt, built out of this phase's
  *"created from the three-register sweep"* below. 🔴 **A phase created BY a sweep does not thereby
  own the next one**; each of the eleven was named in **zero** files outside phase 78. Three of the
  eleven (D22–D24) are template-side and stayed with phase 78 as its `T6`, because this phase is
  scoped to the product surface. Ids checked free repo-wide before use. **Nothing measured here** —
  phase 78 holds the readings.

- **2026-08-29** — Phase created from the three-register sweep. 54 findings across phases 76, 77 and
  78 — **including phase 76's 28, which had no register at all** ([now it has one](../phase-76-the-site-builder/DEFECTS-PHASE-76-FOUND.md)). 17 still real, product-side and unowned; 3 already owned. Nothing built yet.

### DEF-026 — a cloud call to an unreachable backend reports nothing

🔴 **Found by SBR-015's AC1 drive as a control pair**, one variable, identical wiring:

| backend | `failure` fires? | what the admin sees |
|---|---|---|
| **up**, function refuses (`404` from the runner) | **yes** | the refusal, in `--destructive`, menu closed |
| **down**, connection refused (**1 ms**, `transferSize: 0`) | **no** | **nothing, for 35 s.** Menu still open |

`CloudFunction2`'s `error` callback does `reportOutcomes(…, 'failure')` (`cloudfunction2.ts:182`), so the node is capable — whatever a connection refusal does, it does not arrive there.

🔴 **This is SBR-015's defect one layer further out.** SBR-015 fixed cloud *functions* whose failures reached nobody; this is a *call* whose failure reaches nobody. And it is the failure a person is most likely to meet: "the backend is not running" is the ordinary way this breaks, while a deployed function refusing is the rare way.

**Where it bites:** every app, every author. A graph wired correctly for failure still shows the user nothing, and the author has no way to tell from the canvas.

⚠️ **Not diagnosed further** — the drive established *that* it does not fire, not *where* the refusal is lost. Owner: **NONE**.

#### ✅ CLOSED s17 (2026-08-30) — the refusal was lost to a TypeError in the one handler that could report it

**Diagnosis, reproduced red at HEAD before building.** A connection refusal terminates the XHR at
`readyState 4, status 0, response ''` — **measured in real Chrome this session**, not read from the
spec: the render harness's own headless Chrome, a genuinely closed port, terminal state
`{readyState: 4, status: 0, response: '', parseThrew: true}`. So `_makeRequest`'s `JSON.parse`
throws, the handler receives `undefined`, and `doCall`'s error callback did
`e.error` unconditionally (`cloudfunction2.ts:312`) — **a TypeError inside the XHR callback,
upstream of `setError`**, which is the only route to `reportOutcomes(…, 'failure')`. The node was
capable exactly as the drive said; nothing ever arrived.

- 🔴 **Wider than a refusal**: ANY error status with a non-JSON body (a proxy's HTML 502 page) took
  the same throw. Own spec arm.
- ✅ **Fix**: the handler is total, and `_makeRequest` now passes `xhr.status` so the two failures
  with opposite fixes stay separated — status 0 (nothing answered) reports
  **"Could not reach the backend at `<endpoint>`"**; an answered error keeps its body's reason.
  The JSON-body arm (the drive's live-backend 404) is the suite's known-firing control and was
  green pre-fix.
- ✅ **Same hole, one API over**: `Noodl.CloudFunctions.run` rejected with `undefined` on a
  refusal (its `reject(err)` simply forwarded the empty body). It now rejects with
  `{error: 'Could not reach the backend at <endpoint>'}` — **object shape preserved deliberately**;
  a JSON error body still passes through verbatim because user scripts read `err.error` off it.
- **Not touched**: the deprecated `Cloud Function` node already tolerates `undefined` and fires
  `failure` (carries no reason by design); the cloud runtime's calls are fetch-based and never had
  this path.
- **Mutants**: pre-fix red stands as the totality mutant (both new arms); the status-0 branch
  mutant (refusal collapsed to the generic message) kills exactly the endpoint-naming arm.
- ⚠️ **The owed inch: the committed viewer bundles still carry the old handler**
  (`noodl-editor/src/external/viewer`, `deploy`, ssr copies, and `nodegx-backend/deploy/artifact`)
  — a drive through the editor TODAY exercises the stale bundle, not this fix. Every link is
  measured at HEAD (the pre-fix SBR-015 drive proved the request leaves the node; today's probe
  proved Chrome's refusal shape; the unit suite grades the handler over exactly that shape) — the
  end-to-end conjunction through a FRESH bundle rides with the next viewer rebuild, and P77
  SBR-015's 🟡 wired-not-yet-driven admin drive is the instrument that will observe it.
  Owner: whoever cuts the next 0.2.1 build (same row as DEF-021/023's dist note).

**Gates s17**: viewer-react **1091/1091** (s16's 1088 + exactly the 3 new arms), `tsc --noEmit`
clean. `test:ci` not owed — no editor or noodl-runtime source moved.

### DEF-025 — s17 (2026-08-30): the door half, and the ruling the default flip needs

**Premises re-verified at HEAD before building** (`addLabelInputs`: `useLabel` defaults `false`;
Button alone opts into `true`; `Checkbox.tsx`/`RadioButton.tsx` render `<label htmlFor>` only under
`useLabel` — D37's reading holds unchanged).

✅ **`label-not-a-click-target`** (`rules/labelNotAClickTarget.ts`, registered beside
`repeatedSiblingSubtree`): fires on a Checkbox/Radio Button whose effective `useLabel` is off with
an **immediate sibling** Text carrying words (authored or wired). 13 specs; 4 mutants, each killed
by exactly its arm — ⚠️ the adjacency mutant **survived its first arm**: with the scan widened to
all siblings, the heading-dismissal probe happened to land back on the control itself at the
one-spacer distance and dismissed the hit; the arm now holds a two-spacer shape too.

- **Scope is the TOGGLE pair deliberately, and the reason is written in the rule**: the design
  system's own `field` composition puts a separate `fieldLabel` Text above `Text Input`/`Options`,
  so including them fires on the doctrine's recommended shape. No catalog property carries "the
  words are the tap surface" — the list is short, reasoned, and re-decidable.
- **Corpus** (`npm run calibrate:labels`, 178 projects, 0 unreadable): **186 toggles — 29 own their
  label, 47 sit beside a Text, 43 findings, every one read and true** (legacy form kits' `/Form/
  Checkbox` + "LABEL", `Single Choice/Item` radios, one imported filter component across ten drive
  fixtures). Warning stays advisory — 43 legitimate legacy instances is `raw-color-literal`'s
  situation, not a promotion.
- 🔴 **A rule promotion re-grades every corpus the rule reaches, again**: `catalog:examples`
  (strict, warnings-as-errors) went **61/62** on `comp-repeater-set-item-object` — a task row
  checkbox beside a wired title, the todo-row shape where tapping "Buy milk" does nothing. A true
  positive in an exemplar; **the example now rides the title on the checkbox's own `label` port**
  (`useLabel` on, `row_inputs.title → label`), 62/62, `catalog:merge` + `catalog:check` re-run
  (noodl-types enriched catalog regenerated — not a docs-only change).
- ✅ **A catalog-flip spec arm pins the DEF-006 lesson forward**: the rule reads the effective
  default from the catalog, so the day the default flips, the rule falls silent on unset ports with
  no second edit. (That arm is also what makes the authored-bag-only mutant killable at all —
  both toggles default false today, so the clause was otherwise unobservable.)
- **Templates**: site-builder's one toggle owns its label (read-only scan); members-area's account
  checkbox was repaired in phase 78 s15 and is graded on the rendered DOM by
  `tpl002-account-drive` §11.

🧭 **The default-flip half needs Richard, and the honest options are three, not two**:
1. **Flip `useLabel` to `true` on the toggles** — every existing project's bare checkbox suddenly
   renders the literal string **"Label"** (the `label` port's default) beside it. A visible
   regression on every unlabelled box in every project; not a candidate as stated.
2. **Leave the default; the rule carries the correction** — what shipped this session.
3. **Flip at CREATION, not at runtime**: the editor/door authors `useLabel: true` onto newly
   placed toggles (the `STARTER`-params shape), so new work gets the right default and no existing
   rendering moves. Needs a decision on where (palette drop, MCP door, both).

**Gates s17 (DEF-025)**: editor jest **6409/6411** — the 2 reds are `sb-007/site-template`'s
template-count arms, the peer's live phase-77 lane (their `ab17845d` moved the template after this
session's DEF-026 commit; their own `10b26d57` names the suite as already red) · noodl-mcp
**966/966** (validateOnDisk composes the rule) · `catalog:examples` 62/62 · `catalog:check` clean ·
`typecheck:editor` + `:editor-tests` + `:mcp` clean · corpus false-positive gate asserts zero
*errors*, warnings pass by design · `test:ci` **2905 specs / 4 failures, all AIX-006 BY NAME, seed
90017, fresh readout** — the floor, and s15's 7 peer-template reds are gone (the peer committed
their template work at `ab17845d`).

### DEF-022 — s18 (2026-08-30): the Request node learns to say where the app lives

**The reading re-driven at HEAD before building** (the standing instruction, 14th payment, and this
time it *narrowed the claim rather than the fix*): `request.ts` still stored `req.headers` on the
`Request` model with no output port (`requestModel.set('Headers', …)`), and the backend's
`runFunction` passes `ctx.req.headers` verbatim — but 🔴 **D34's "nothing exposes it to a graph"
was too strong**. Probed through the real runner: an Object node (`Model2`) with Id `Request` and
property `Headers` reads the whole bag today. Undocumented, undiscoverable, and it hands a builder
raw headers to re-derive origin from — so the port remains the right fix, but the register's
sentence was corrected in place (P78 D34), not silently.

✅ **What landed**: `origin` output on `noodl.cloud.request`, derivation in
`requestOrigin.ts` (one place, commented for the traps): the caller's `Origin` when it is a usable
web origin — a browser's cloud-function call is a POST and a POST always carries the page's own
address, exactly what TPL-002 had to be told from outside — else `x-forwarded-host`/`host` +
sanitised `x-forwarded-proto` (default `http`, what a direct localhost backend actually serves),
else `undefined` rather than an invented address. Case-insensitive over header names
(`CloudRunner.run` is a public seam; Node's lowercasing is a transport fact, not a contract),
first-entry reads for comma lists and array values, trailing slash stripped
(`effectiveBaseUrl`'s discipline, so `origin + path` composes).

- **The trust boundary is in the port description, not just the register**: everything derived
  here is caller-supplied. Right for a link sent back to whoever called; wrong for a link a THIRD
  party will click (reset-poisoning shape). That job stays with the operator-configured
  `effectiveBaseUrl` — unreachable from a graph, now a `NONE` row above (DEF-022's broader half).
- **15 specs** (`def022-request-origin.test.ts`): a derivation table where every precedence rule
  and every refusal has a row, plus four arms through `CloudRunner.run` — browser-shaped,
  curl-shaped, the no-headers workflow-step arm (answers 200, port honestly blank), and a
  two-requests-one-runner bleed-through arm.
- **Mutants**: M1 (origin lookup dropped) killed by 6, M2 (proto defaults https) by 7, M4′ (wiring
  deleted) by 3. 🔴 **Two survivors, both verdicts about the code, not the specs**: the
  `=== 'null'` clause was DEAD CODE (the `/^https?:\/\//` shape test already refuses it) — clause
  removed, behaviour still pinned; and a stale-origin mutant CANNOT fire because each request
  builds a fresh component instance (DEF-023's own construction) — the bleed-through arm stays as
  a pin, recorded as held-by-construction.
- **Catalog regenerated** (`catalog:generate` + `catalog:merge`, diff = exactly the new port ×2
  files), `catalog:check` + `catalog:merge:check` clean — DEF-003's lesson, paid forward: a port
  that exists only in the runtime is `notFound` at every door.
- ⚠️ **Template-side adoption is P78's lane, not this row's**: TPL-002's `notifyMembers` still
  takes `siteUrl` as a parameter (its admin-only trust note stands); rewiring it onto the new
  port belongs with the members-area template work, same split as D22/D23/D24.
- ⚠️ **The committed sandbox/viewer bundles predate the port** — an editor drive today shows no
  `Origin` output on the canvas until the next cloudruntime bundle rebuild. Same owner as the
  standing dist note (DEF-021/023/026, whoever cuts the next 0.2.1 build).

**Gates s18** (commit `ae890a71`): noodl-viewer-cloud **219/219** (s16's 204 + the 15 new) +
`tsc --noEmit` clean · noodl-mcp **971/971** (catalog consumer, re-run after regeneration) ·
backend request-node consumer suites (`cwf-014-typed-request-bodies`, `cloud-function-timeout`,
`--runInBand`) 22/22 · `catalog:check` + `catalog:merge:check` clean · **`test:ci` 2905 specs / 4
failures, all AIX-006 BY NAME, seed 75285, fresh readout** — the floor, run because a new declared
port has broken name-keyed heuristics before (DEF-003/`blankDiagnosis`); no editor rule keys on
`origin` (checked) and none went red. ⚠️ Its `gitHead eac2544d` is the P77 peer's D23 commit
landing mid-window — read-time fact; result is exactly at the floor, which tolerates it.

### DEF-018 + DEF-020 — s19 (2026-08-30): the layout pair, closed as one module

**Read against each other at the source first, as the register asked, and the merge the candidate
grouping suspected is real**: both are a parent/child layout combination in which a declared
parameter is silently inert, decidable from the graph alone — D28 a child that refuses the box its
parent exists to hand it, D32 children that absorb the space their parent was asked to distribute.
One precondition module (`layoutInertCombination.ts`, both doors via
`authoredPreconditionDiagnostics`), two codes, filed as two rows because the *repairs* differ:
per-child for D28 (the count is the number of edits), per-row for D32 (the repair is a decision
about the row).

✅ **Both readings re-driven at HEAD before building** (`def018-def020-layout-drive.test.ts`,
rendered in real Chrome at 1280×900, one-variable control per arm — an absence is only a reading
beside a known-firing signal). D28: the members band's five buttons, `primaryButton` verbatim in an
autoFit Columns — "Announcements board" (158px of content, 128px box) draws **14px across**
"Meetings calendar"; `inColumn` control arm zero overlap in the identical Columns. D32: two default
Texts under `space-between` split 1280px **640/640, gap 0**; content-sized control **gap 1108px**,
both children at the row's edges. Neither claim narrowed — both rows held as recorded.

- ✅ **`columns-child-keeps-own-width`** (warning, per child): resolved `sizeMode` ∈
  {contentSize, contentWidth} on a knowable direct child of a Columns. Resolution is
  `resolveAgainstDefaults` over `CatalogIndex.inputDefaults` — DEF-006's evaluator, for DEF-006's
  reason: `net.noodl.controls.button`'s TYPE DEFAULT is `contentSize`, so the authored bag alone
  misses the child most likely to be there (own mutant, killed). Skips: component instances (root
  sizing not in this graph), For Each children (separate render path), wired sizeMode/width.
- ✅ **`justify-content-distributes-nothing`** (warning, per row): row Group + distributing
  `justifyContent` + **≥2** growers (percentage width, position relative, sizeMode reads width).
  Exactly-one-grower rows silent by design — that row usually renders what the author meant.
  🔴 **The calibration found the predicate's one WRONG shape**: a **maxWidth-capped grower leaves
  real free space, and there justifyContent WORKS** — `maxWidth` binds as plain CSS. 10 of 43
  corpus firings were that shape; a child with authored or wired maxWidth is now *unknowable, not
  growing* (own spec arm + mutant).
- ✅ **Corpus** (`npm run calibrate:layout`, new script, 178 projects, 0 unreadable, denominators
  printed): D28 **13 firings / 319 Columns / 562 direct children, 4 projects — all 13 authored
  sizeMode, 0 from the type default** (the bare-button worry is empty in this corpus). D32 **33
  firings / 317 distributing rows / 3,099 row Groups, 14 projects**. Sampled from disk, true:
  the REFERENCE BUILD's own footer ("© 2026 Kiln & Co." / "Privacy · Terms" splitting 50/50) and
  sonnet's Basket rows — "Subtotal" and "£33.50" split evenly instead of label-left, price-right.
  The agent-authored replays (phase55 NavBars, InfoStrips, Footers) are firing rows, which is the
  promotion case; **both stay advisory** on the `responsiveArrangement` precedent (promotion is
  earned against authored candidates at generation time; the corpus carries 46 legacy instances),
  and the spec pins non-membership in `AUTHORED_BLOCKING_WARNINGS` so a later edit cannot promote
  silently.
- ✅ **Mutants: 9 killed, 1 survivor by EQUIVALENCE, recorded in the code** — the D32 row-level
  `resolveAgainstDefaults` answers identically to the authored bag today (no catalog default makes
  a Group a row or distributes a justify); kept as the evaluator anyway so a future default change
  is absorbed, with a comment saying the mutant survives (s18's precedent: a survivor is a verdict
  about the code, not a spec to fake).
- ✅ **`gridAutoFit`'s description** now carries D28's "cheapest and most honest" fix: the second
  sentence says children must take the column's width and that a contentSize child (what both
  button recipes stamp) draws across the next column. The door rule is the mechanical half; the
  description is the teaching half, at the moment an author reaches for the one node that reflows.

**Gates s19**: editor jest **6433/6435** (the 2 = the peer's known sb-007 template-count arms,
their lane, same two as s17) · tests-unit suite 24/24 · noodl-mcp **985/985** (includes the new
drive) · `catalog:examples` 62/62 strict (the new warnings fire on no shipped recipe) ·
`typecheck:editor` / `:editor-tests` / `:mcp` clean · `test:ci` re-run this session with a fresh
readout (see below).
