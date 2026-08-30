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
| DEF-005 | ⬜ **RULED s23, unbuilt** | [Membership is a category the graph cannot express](DEF-005-MEMBERSHIP-IS-UNEXPRESSIBLE.md) | P78 D2, D3 | every **membership app** |
| DEF-006 | ✅ done | [The design system punishes the agent that uses it](DEF-006-THE-DESIGN-SYSTEM-PUNISHES-ITS-USER.md) | P78 D12, D15, **D20** | every **agent** styling on-system |
| DEF-007 | 🟡 partial | [A project means one thing on disk and another once loaded](DEF-007-DISK-AND-LOAD-DISAGREE.md) — **§6 seam named, §6.1 AC3 measured (56), §3.3 struck** | P78 D9 residual · P77 D5 · **P77 D11** | the **next template** |
| DEF-008 | ✅ done | [The measurement owed](DEF-008-THE-MEASUREMENT-OWED.md) — **driven s13: D6 does not reproduce; `maxWidth` applies on `Text` in every authored form; the one route to `none` (instance-authored) is blocked at the door. DEF-001's rendered-button inch closed at 5.17:1 in the same render** | P77 D6 · P78 D5 | nobody yet — a re-drive |
| DEF-009 | ✅ done | [A public write door ships with no limit](DEF-009-A-PUBLIC-WRITE-DOOR-WITH-NO-LIMIT.md) — **ACs 1–3 met s14 (`44298914`); AC4 CLOSED s26 as ruled: a public, record-writing cloud function with no `rateLimit` is limited to 60/min burst 30 per caller (the `auth` rung). `effectiveFunctionRateLimit` is now THE per-function resolver — the dispatcher's, the panel's and the boot announcement's — and the superseded `functionRateLimit` was DELETED rather than left beside it. 🔴 The distinction the whole thing rests on: `{ratePerMinute: 0, burst: 0}` is the limiter's existing *unlimited* convention, so "the author asked for no limit" and "nobody said" are now different readings with opposite outcomes; an entry setting only `call` has said nothing about rate. 🔴 **The corpus check the ruling demanded did NOT confirm the shape it was ruled on**: the count holds (27 unlimited public write doors / 23 projects, 179 projects, command recorded in §6.3) and the composition does not — **17** are `submitContactForm` and TEN are not, among them `ses_sns_response` ×3, `stripe-webhook` ×2 and `Stripe/Process payment`. Provider webhooks are the one shape that legitimately bursts past 30, and all four projects predate the original sweep, so *"all `submitContactForm`"* was an overstatement WHEN WRITTEN. Built as ruled, with the hazard bounded by two graded things rather than described: the `{0,0}` opt-out, and `functionRateLimitAnnouncement` naming every affected endpoint at boot (AC1's other half — an operator learns from their own log, not the provider's dashboard). 🔴 s25's lesson applied BEFORE building: the door's own message said the class bucket was "the only bound", which the default made false — it now says which of TWO things is true, and the superseded sentence is asserted ABSENT. 14 specs, real HTTP; 6 mutants each killed by its own arm; M1 is the pre-fix measurement (31st call = 200 before, 429 naming 60/30 after). ⚠️ M6 guards a REAL hazard: `RECORD_WRITE_NODE_TYPES` now exists TWICE across packages that cannot import each other, held equal by a spec that reads the other file** | **P76 F3** | a **site owner** whose form fills their database |
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
| DEF-012 | ✅ done | [SB-011 — a query widens when it cannot narrow](../phase-76-the-site-builder/SB-011-A-QUERY-THAT-WIDENS-WHEN-IT-CANNOT-NARROW.md) — **§1 CLOSED s15 (2026-08-30): a failed translation fails the node (Query Records + Aggregate), `schemaFor` reads the built-in `columns` shape, a first-write Pointer column keeps its `targetClass`; SB-004 §7's pinned arm inverted; 3 mutants killed. §2 (fetch-before-parameters) CLOSED s22 (2026-08-30): the runtime cannot distinguish *not yet arrived* from *deliberately absent* (`dropUnresolvedConnected`), so the fix is the door precondition s15's finding named — `query-fetches-before-its-filter` (`queryBeforeFilter.ts`, advisory, both doors): cloud `DbCollection2`, connected filter param with a real `qp-` wire, either run-on-change box not `false`. Corpus (`calibrate:query-timing`, 178 projects): 625 queries, 325 wired-filter, 59 cloud firings in 12 projects all legacy-true (one is `fetched → response.send` — the caller receives every row), 34 already carrying SB-004's workaround silent, 180 browser left alone by decision. 11 specs, 7/7 mutants killed. See SB-011 §5 + TASKS.md s22** | P76 F12/F13 | a cloud query returns **every row** when asked for a few |
| DEF-013 | ✅ done | [SB-012 — three spellings of a component name](../phase-76-the-site-builder/SB-012-THREE-SPELLINGS-OF-A-COMPONENT-NAME.md) — **re-driven s24 first, as ruled: the defect REPRODUCED verbatim at HEAD, so the row did not close for free. Fixed at the PLAN door per option 1 — `plannedComponentNames(plan)` feeds both halves of the gate: `overlayProject`'s `refNames` (semantic) and a new `alsoResolvable` argument on `preconditionDiagnostics` (precondition). 🔴 The drive also CORRECTED the register: SB-012's table recorded node `type` as resolving against an unapplied sibling, and it does not — that `✅` was measured on a sibling already STAGED, the sequential case. A node-`type` CYCLE was refused too, so all THREE spellings were broken and the table said one was fine. Names only, never as component views (an empty view turns "interface unknown" into "interface empty"). Safe under a partial apply: `apply_plan` re-validates against `applyPlanView`, which excludes skipped ops. ⚠️ `create_component` deliberately unchanged — the ruling's accepted weakness; the two-pass workaround still stands and is still graded. 5 specs, 3 mutants. 🔴 M2 SURVIVED its first run because the arm asserted `typeof isError === 'boolean'` — a tautology that read green while the door refused** | P76 s6 | **an app whose pages link to each other cannot be authored in one pass** |

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
| DEF-019 | ✅ done | **P78 D30** | The type ramp cannot reach `font-variant-numeric`, so no app built here can align a column of numbers — **fixed s20 (`f14a1faa`): a tenth text-style port, `fontVariantNumeric` ('Numerals', enum Normal/`tabular-nums`), in the shared group + the `textStyle` picker's childPorts + the `useLabel` dynamic list (five controls), passed through `nodegx-export`'s PASSTHROUGH as `font-variant-numeric`. Re-driven at HEAD first, and the bite is the product's own font: the shipped Inter (v3.019, `starterAssets.ts` copies it into every new project) has PROPORTIONAL default figures (`1` = 1308/2048 em, `8` = 1736) and a `tnum` feature nothing could switch on. Driven in real Chrome against the shipped TTF through the real door: without the port `1111` = 59.47px vs `8888` = 78.92px (19.45px of rag on four digits); with it, both exactly 82.921875px — the control arm doubles as the font-load check (every likely fallback has equal-width digits). 4 mutants, each killed by its arm. Two census gates moved by exactly the understood amounts and were re-pinned with the reason (fb-021 +5 = `labelfontVariantNumeric` × five `useLabel` controls; fb-022 +1 = an enum scrubs nothing)** | every **app with a column of numbers** — money, times, scores |
| DEF-020 | ✅ done | **P78 D32** | Two children of a row both grow and nothing says so: `justifyContent` silently does nothing — **fixed s19: `justify-content-distributes-nothing` (warning, per row) in the same `layoutInertCombination.ts`. A row Group with a distributing `justifyContent` and ≥2 children that would grow (percentage width → `flexGrow` in `layout.ts`; width DEFAULTS to 100%, so growing is what a child of a row does) is asked to distribute space that never exists. Re-driven at HEAD first: 640/640 split, 0px gap; content-sized control 1108px gap at the edges. 🔴 **Calibration found the predicate's one WRONG shape, not just noise**: a maxWidth-capped grower leaves real free space and there justifyContent WORKS — 10 of 43 corpus firings were that shape, now excluded (child with authored/wired maxWidth = unknowable, not growing). Exactly-one-grower rows stay silent by design (they render what the author meant)** | every **agent laying two things out along a row** |
| DEF-021 | ✅ done | **P78 D33** | A fan-out send delivers **one** email and reports **N** successes — **fixed s16 (`4adab228`): each queued outcome token is stamped with the `To` it was minted under; stamps agree → today's path verbatim (one send, fields read after inputs settle), stamps disagree → one send per consecutive run of the minted address, each run settled by its own call. 3 mutants, each killed by exactly its arm; erg-001 §4's constant-To pin untouched** | every **member who was told they would be emailed** |
| DEF-022 | ✅ done | **P78 D34** | A cloud function cannot find out what the app's own public address is — **fixed s18: the Request node has an `Origin` output. The node already held the answer and threw it away (`request.ts` stored `req.headers` on the `Request` model with no port); `requestOrigin.ts` now derives it once — the caller's `Origin` header when usable (a browser POST always carries the page's own address, the thing TPL-002 had to be told from outside), else forwarded-host/host + forwarded-proto, else honestly blank (a workflow step has no caller). Port description names the trust boundary: caller-supplied, right for links back to whoever called, NOT for a password-reset a third party will click — that stays `effectiveBaseUrl`'s job, still unreachable from a graph (row below, `NONE`). 🔴 D34's "nothing exposes it to a graph" was too strong: an Object node with Id `Request` reads the raw `Headers` bag today, probed through the real runner — corrected in the register, not silently** | **everyone an app ever emails a link to** |
| DEF-023 | ✅ done | **P78 D35** | `Component` scope in a cloud function is **not** per-request, and nothing says so — **fixed s16 (`acd053e0`). 🔴 The recorded mechanism was the browser's: the cloud runtime never reaches `_componentScopes` — `noodl-js-api.js` overrode the scope to ONE module-level object, shared across all scripts, functions, requests and CONCURRENT requests. Now a WeakMap keyed on the component-owner INSTANCE (ids repeat across requests; instances do not): same-instance scripts still share (TPL-002's plan/pump contract), a new request starts clean, entries die with the request's graph — the leak half held by construction, not a spec** | every **graph that accumulates anything server-side** |
| DEF-024 | ✅ done | **P78 D36** | A `Condition` can only ever turn a gate **ON**, so a screen accumulates contradictory answers — **closed s21 (08-30), and it was NOT the design ruling the queue expected: 🔴 the register's mechanism claim was false when written — `Switch` (same Logic category) has been the two-way shape all along (`On`/`Off` signals, `Current State` pushed on every change; one Switch per answer = fewer nodes than the paired-clear workaround), and `Condition.result` itself pushes `false` on a false test. What can only turn a gate on is the AUTHORED shape (constant `condition: true`, Evaluate-pulsed), so the defect narrowed to "nothing says so": shipped `gate-only-turns-on` (advisory warning, both doors, `oneWayGate.ts`) — fires when every writer into a `mounted`/`visible` is a constant-condition Condition and the pushable set is exactly `{true}`; paired-clear and Switch shapes silent by construction; one-way DISMISS (`{false}`) not fired on, by decision with corpus numbers. Driven at HEAD first in real Chrome (`def024-gate-drive.test.ts`): latch tick-then-untick leaves BOTH notices; Switch control arm leaves exactly one. Corpus (`calibrate:gates`, 178 projects): 3,287 written gate ports, 3,211 abstain, **75 firings, all true, zero false positives read** — concentrated in the site-builder template's copies (→ P77 **D29**, filed) and pre-s6 members-area copies. 🔴 The shipped `templates/members-area/` still carries **12 one-way latches** (s15's workaround fixed `Account` only) — template work, filed in P78's D36 section. Plus one sentence each on `Condition.result`/`Switch.state` naming the two-way shape (catalog regenerated). 12 specs, 7 mutants each killed by its own arm** | every **screen whose answer has more than one form** |
| DEF-025 | ✅ | **P78 D37** | A control's label is a click target only via the control's own `label` port — which **defaults OFF** — **door half built s17: `label-not-a-click-target` warns on a Checkbox/Radio Button whose words sit in an adjacent sibling Text (43 true firings / 186 toggles over the 178-project corpus, denominators printed; stays advisory — the corpus carries 43 legitimate legacy instances, the `raw-color-literal` precedent). Default-flip half **CLOSED s25**: ruled `flip at CREATION, in BOTH doors` and built — editor (`newNodeSeed`, reaching both creation paths) and MCP (`create_component`, `update_component` `set` + `add_node`, the plan door), "newly placed" decided by **id**, so no existing rendering moves. 🔴 The flip would have SILENCED this very rule on the population it creates (measured 2→0→2 on real projects); the rule now fires on an **authored** `useLabel: true` whose Label is still the placeholder, and s17's catalog-flip arm still passes untouched** | every **person tapping the words beside a checkbox** |
| DEF-026 | ✅ done | A cloud call to an unreachable backend reports nothing — **fixed s17: `CloudFunction2`'s error handler dereferenced `e.error` unconditionally, and a connection refusal hands it `undefined` (real Chrome probed at HEAD: `readyState 4, status 0, response ''` ⇒ `JSON.parse` throws ⇒ body `undefined`), so the ONE route to the `failure` outcome died on a TypeError inside the XHR callback. Handler now total; status 0 reports "Could not reach the backend at <endpoint>". Same hole filled in `Noodl.CloudFunctions.run` (rejected with `undefined`; JSON error bodies still pass through untouched)** | **anyone** whose backend is not running — the ordinary way this breaks |
| DEF-027 | ✅ done | **P77 D28** | A `Drag`'s direct child loses its `cssClassName`, so a draggable element cannot be styled or selected from a stylesheet — `react-draggable` clones the child with its own `className` and the authored one does not survive it. 🔴 **Found by driving, and the two controls are what make it about `Drag` rather than about `cssClassName`**: a Group one level further in and a Text deeper still take their class by the SAME kind of connection from the SAME `Component Inputs` node and keep theirs (`ac2DragGestureDrive.test.ts`, and `ac2-page-editor-drag-drive.test.ts` has to find the template's own cards by `.react-draggable` because of it). It fails **silently**: the class is accepted at the door, stored in the graph, and absent from the DOM. **fixed s23 (2026-08-30): the discarding was the SPREAD's, not `Drag`'s.** `NoodlReactComponent.render` spread `...noodlNode.props` then `...otherProps`, and the library's injected `className` — arriving in `otherProps` — overwrote the author's. `react-draggable` could not merge it either: the child it clones is the wrapper element, whose props are only `{key, noodlNode, ref}`, so its own `clsx(children.props.className || '', …)` had nothing to see. Class names accumulate rather than disagree, so the two are now joined; `style` keeps its deliberate parent-wins precedence (its own arm, and a mutant proving that arm is live). Fixed at the spread rather than in `Drag.tsx` so any future wrapper is covered — **and D28's uncounted sweep now has a number: one.** `Drag.tsx:214` holds the only `cloneElement` in the viewer and `react-draggable` is the only third-party wrapper around authored children. Re-driven at HEAD first (9/9, the two pins passing), then flipped as the spec's own header instructed and re-driven green. 5 specs, 5 mutants each killed by a named arm. ⚠️ **The drive serves the gitignored `noodl.viewer.js`** — the first post-fix run was 9/9 RED until it was rebuilt, and read like a broken fix | every **author who styles, animates or selects a draggable row** — most of what anyone does with a drag |

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

## Carried forward from phase 77, by reference — **registered s23 (2026-08-30)**

🔴 **Five product-side rows in phase 77's register had no owner and no task, and four of them
predate this phase.** Found by a sweep of every `NONE`-owned row in both registers against this
table, run at Richard's instruction on 2026-08-30. **D15's own entry in the sweep that created
phase 80 says *"it needs a task"* — it never got one**, which is this phase's founding failure
with a different row number.

⚠️ **Same rule as the other two carries: NOT re-authored here.**
[Phase 77's register](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md)
holds the measurements, the sabotages and the controls. **Read it, not this table.** Ids checked
free repo-wide before use.

| id | status | source | what it is | bites |
|---|---|---|---|---|
| DEF-028 | ⬜ open | **P77 [D13](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d13)** | **What a build contains depends on when it was taken, not on what the project says.** The export health filter races the viewer's dynamic-port announcement. ⚠️ SBR-008's ruled fix removed the `prop-` family from the filter's reach and **left the filter unchanged** — every other dynamic-port family is still exposed. 🔴 Do not read SBR-008's green specs as evidence: they call `setup()` and read what it announces; the debounced pass is not in them | every **author who exports or deploys** — two builds of one project, different contents, no error |
| DEF-029 | ⬜ open | **P77 [D15](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d15)** | **The runtime has no file-drop capability at all**, so "drop a file here" is not authorable. Measured with a known-firing control: `onDrop`/`dataTransfer`/`dragover`/`dragenter`/`DragEvent` = **0** against a **39**-hit `onClick` control over the same two packages. A missing capability, not a missing wire | every **builder who wants a drop target** — and SBR-007 AC3 as literally written |
| DEF-030 | ✅ done | **P77 [D16](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d16)** | **The appearance ratchet's per-page check cannot fail** for any page that places a styled component — `barePages()` walks the transitive closure of placed components. 🔴 Sabotage at HEAD: `/Pages/PageEditor` reads *not bare* with **every one of its own structure parameters stripped**, and so does the `/Pages/Site` control | anyone who reads a **green §4 as "this screen is designed"** — a gate that cannot fail — **fixed s24: sabotage reproduced at HEAD first, and it was WORSE than 'cannot fail' — under the placement rule `barePages` returned `[]` for ALL THREE shipped templates, so §4 compared an empty set against its floor in every case and both arms passed trivially. Rule is now the page's OWN tree; `STRUCTURE_PARAMS` unchanged and still narrow. It re-grades ONE page, not two: `/Pages/ThemeEditor`, whose only own Group carries `flexDirection`/`rowGap`/`sizeMode` — all deliberately excluded — while `/Admin/Shell` paints the screen. Real debt, on the floor BY NAME with its reason; **template-side, so P77 owns the repair**. 🔴 A second vacuity found while re-measuring: hello-world's floor entry `/Home` never matched the real name `/#__page__/Home`, and that page sets a `fontSize` so it was never bare — an allowance nobody could spend. §4 now asserts EQUALITY not a subset, plus a new arm that every floor entry names a real page. The MUTANT asserts BOTH halves — the sabotaged page is called designed by the old rule and named by the new one** |
| DEF-031 | ⬜ open | **P77 [D22](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d22)** | **A `Text` cannot be ellipsized** — the runtime ships no `text-overflow` port. `textOverflow`/`text-overflow` = **0**; controls: `wordBreak` = 2 (a `Text` `inputCss` port that DOES exist), 11 files carrying `inputCss` (the mechanism a new port would use). D20 offered shrink-and-ellipsize, wrap, or accept; wrap shipped because ellipsize **is not authorable at all** | every **author who wants a single-line label** that degrades instead of wrapping |
| DEF-032 | ✅ done | **P77 [D32](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d32)** | **The pass that grades the migration's writes examines one of sixty-five** — `gradeMountTriggered` opens with a `continue` and reaches **1.5%** of `plan.writes`. 🔴 It is the answer to *why D31 shipped past a suite that already knew about the migration*. ⚠️ Do **not** "fix" it by making the template state all 65 — that changes what the migration is for. **The gate is the gap** — **fixed s24: measured FIRST and the table confirmed at HEAD (65 writes, 1 mount-triggered, 1 graded, 64 skipped). The `1` is now ASSERTED, with cardinality where the counts meet. New `gradeWriteBackCycle` grades the failure mode nothing graded — a silenced input fed by a collection the node's own output writes — and it reaches **29 of 65**, a number asserted for the same reason. TWO confidences kept apart: `repeaterItem` (D31's exact shape) is asserted as a defect, 0 at HEAD; `sameCollection` (6 rows, all `/Pages/ThemeEditor`) is a PINNED CENSUS, not a defect — plausible-benign but unmeasured, filed as P77 **D33** and owed a drive, because D31 looked benign by the same reasoning until the runtime named it. The template is NOT asked to state all 65. 🔴 The mutant restores D31 and names TWO ports not three (`in-body` traces back through `startValue`; `in-image` comes from the upload, so it is in the write set without being in the cycle). A CONTROL asserts the two passes are not the same pass. 🔴 The new control also exposed latent contamination: `migrationProject()` shallow-spread nodes, so `parameters` was the SAME object as the shared `shipped` artefact and the mutant arms' `delete` outlived their own test** | the **team**, and through them every user of a template — a suite that reads as coverage and is not |

## Carried forward from phase 18, by reference — **registered s24 (2026-08-30)**

⚠️ **Not re-authored here.**
[EXP-011 §36.2](../phase-18-code-export-v2/EXP-011-PICKER-COVERAGE.md) holds the measurement and
the harness that made it visible. **Read it, not this table.** Id checked free repo-wide before use.

| id | status | source | what it is | bites |
|---|---|---|---|---|
| DEF-033 | ⬜ open | **P18 [§36.2](../phase-18-code-export-v2/EXP-011-PICKER-COVERAGE.md)** | **`Substring`'s property panel says `End = 0` and the node behaves as `End = -1`.** The port *declares* `0`; `initialize` writes `-1`; `registerInput` puts a declared default into `_inputValues` **without calling the setter** (`node.ts:137-139`) and the getter reads `_internal.endIndex`. The two are opposite answers, not a near-miss — `-1` returns the rest of the string, `0` returns `''` for every input. ⚠️ The fix is a **decision**, not a one-liner: aligning the declared default to `-1` changes what the panel shows, and aligning `initialize` to `0` changes what every existing `Substring` returns. 🔴 The export agrees with the **node**, so an export is not a workaround for this | every **author who drops a `Substring` and reads its panel** — the number shown is not the number running |

🔴 **Two of the five are gate defects (DEF-030, DEF-032), and they are the ones that let the
others ship.** A pass whose first line is a `continue` is not coverage until you have counted what
it **reached** — the number that mattered in D32 was never the offender count, it was the `1`.

⚠️ **D12 and D29 stay with phase 77 deliberately** — both are template-side (a double query on
arrival; the site-builder's one-way confirmation/refusal latches), and this phase is graded on the
product surface. **Seven rows found unowned, five carried, two placed elsewhere**, so the split is
a decision on record and not a gap. **Phase 78's register is clean**: its only late `NONE` row,
D38, is a harness finding already corrected in place, and D39 is ruled.

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

### The unowned register, re-checked at HEAD — s23 (2026-08-30)

The closing sweep the s21 and s22 prompts both named. **Seven rows re-measured at HEAD rather
than re-read.** All seven are still true; two citations were wrong in ways that cost a reader
time, and both are corrected in place above rather than noted here only.

| row | still true at HEAD? | what the re-measure found |
|---|---|---|
| `publishPage` refuses after publishing | **not re-measured** — needs a live backend, not a grep. Named so the gap is a decision |
| auto-created class gets no declared columns | ✅ | 4 real `createAdapter` call sites (`cli.ts` ×3, `service.ts`); **none** passes `collections`. The 5th hit is the definition |
| no semantic token for error text | ✅ | `destructive-text` appears **0** times in `noodl-core-ui` and `noodl-editor` |
| a step pointing at a cloud helper is told to deploy it | ✅ | `projectFunctionNames()` still returns `getCloudFunctionNames(...)` unfiltered |
| a second project deploying to a shared backend kills it | **not re-measured** — needs two live deploys |
| a cloud function in a folder is unreachable | ✅ | 🔴 **the citation was `cloudFunctions.test.ts:85` with no package**, and the obvious guess (`nodegx-backend/tests/`) does not contain it. It is `packages/noodl-editor/tests/cloud/cloudFunctions.test.ts:85`, and line 85 is exactly the pinning comment. Path added above |
| the backend card cannot see a backend-side change | **not re-measured** — a screen, not a grep |
| a stale function renders twice | ✅ | `CloudFunctionsSection.tsx:123` filters `stale` **out of** `backendFunctions`, and `:138` still maps the unfiltered list above `:162`'s `stale.map` |
| an unchanged value re-runs Run On Value Change | ✅ | `simplejavascript.ts:580` stores the value and calls `scheduleRun()` with no comparison to what was there |
| `Record.Fetched` fires on bind | **not re-measured** — behaviour, needs a run |
| the `domelement` port cannot reach its own description | **not re-measured** — needs the typecast table executed |
| the configured site address is unreachable from a graph | ✅ **substance**, ❌ **count** | 🔴 **"its three consumers" is four.** `admin-email.ts:133` calls `effectiveBaseUrl` too, and it has done since `e7a74773` (2026-07-27) — **before the row was written on 2026-08-30**, so this is a miscount at the time of writing and not drift. The row's conclusion is untouched: all four are backend-internal, none is reachable from a graph |

🔴 **Five rows are marked "not re-measured" rather than re-asserted.** Each needs a live backend,
a screen or a run, and copying them forward unchecked is precisely what turns a register into a
backlog — the failure this phase exists to answer. They are named, not quietly carried.

⚠️ **A citation without a package cost this sweep a wrong conclusion before it caught it.** The
first read of the folder row concluded the gate had been deleted, because `cloudFunctions.test.ts`
does not exist under `nodegx-backend/tests/`. It exists under `noodl-editor/tests/cloud/`. A
control — grepping the repo for a string that *is* there — is what separated "moved" from "gone".

## Rulings needed (Richard)

# ✅ ALL RULED — 2026-08-30. See [RICHARD-RULINGS-2026-08-30.md](RICHARD-RULINGS-2026-08-30.md).

🔴 **Captured, NOT built.** Every one of the five is the next session's work, and **two went
AGAINST the recommendation put to Richard** — read the reasons, not just the verdicts.

| row | ruling |
|---|---|
| **DEF-005** | **Build BOTH halves** — `roles` output on `User` + cloud `List Users In Role`. Cloud-only survives on the **writes**. AC3's negative control is what makes (a) safe |
| **DEF-013** | **Re-drive SB-012 §1 at HEAD FIRST** — it may already stage clean. Option 2 (downgrade to a warning) **ruled out permanently** |
| **DEF-009 AC4** | 🔴 **Against the recommendation**: default to `{ ratePerMinute: 60, burst: 30 }`, matching `auth`. Owes a corpus check over the 27 unlimited doors |
| **DEF-025** | **Flip at creation, in BOTH doors** (palette + MCP). Blunt runtime flip stays ruled out — it stamps `'Label'` on every existing bare checkbox |
| **DEF-007 §3.2** | **The template writes explicit values.** Sequenced behind phase 77's live lane on `site-builder.content.json` |
| **the 5 orphans** | 🔴 **Against the offered alternative** of a fresh phase 81: **register all five here** as DEF-028–032 |

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

## s21 (2026-08-30) — DEF-024 closed, and the ruling it was queued for was never needed

**The last open row is closed.** The next-session prompt expected DEF-024 to be "closest to a
design ruling" — the register's own suggested shapes were a `mounted` off-signal or a redesigned
`Condition`. Re-driving the reading first (the 17th payment of the rule, in DEF-003(c)'s
direction: the recorded *impossibility* was false) found the product already ships the two-way
shape: **`Switch`**, in the same Logic category, `On`/`Off`/`Flip` in, `Current State` pushed on
every change. No ruling was spent.

- **The claim, restated at the width measured**: `Condition.result` pushes `false` whenever a
  test finds false. What can only ever turn a gate ON is the authored latch — constant
  `condition: true`, `Evaluate`-pulsed (`CONDITION_GATE` in the members template) — because every
  test of a constant tests the same way. The defect is real (driven: both contradictory notices
  in one document at HEAD) but it is an AUTHORING-GUIDANCE gap, not a missing primitive.
- **`gate-only-turns-on`** (`oneWayGate.ts`, registered after `checkLayoutInertCombination`,
  advisory): fires when every writer into a visual node's `mounted`/`visible` is a
  constant-condition `Condition` and the union of pushable values is exactly `{true}`. Abstains
  on any non-Condition writer, any wired condition, component-instance targets; a no-`eval`
  constant Condition contributes nothing (a dead gate is a different absence, not claimed);
  `{false}`-only (one-way dismiss) is a recorded decision, not a firing — the corpus holds 1.
- **Corpus** (`npm run calibrate:gates`, new script, 178 projects, 0 unreadable, denominators
  printed): 3,287 written gate ports on knowable visual nodes; 3,211 abstained (healthy two-way
  writers); 0 two-way constant pairs outside the members template; **75 firings in 18 projects,
  every one a notice/confirmation/refusal, all read, zero false positives**. Concentration
  honest-limit: ~17 projects are SBR drive-fixture copies of ONE site-builder shape (filed as
  P77 **D29** — `/Site/ContactForm`'s confirmation+refusal pair and 2 `/Pages/Setup` refusals,
  verified against `site-builder.content.json` at HEAD read-only; their lane, not touched).
- 🔴 **The shipped `templates/members-area/` artefact still carries 12 one-way latches** —
  calibrator run over it directly: Join's received/refusal pair, Post's two confirmations,
  SignIn, Setup, Announcement/Meeting × (Not available + It did not go), Unsubscribe's both.
  s15's workaround covered `Pages/Account` only. Filed in P78 D36's section (template work, T6
  family). The 6 two-way pairs (Account ×3, Setup, Post, Account-fail) are what the workaround
  looks like to the calibrator — counted, silent.
- **Descriptions**: `Condition.result` now says a constant Condition only ever pushes one value
  and names `Switch`; `Switch.state` says "wire it into a mounted or visible port". Catalog
  regenerated + merged. The D28-precedent "cheapest honest fix" half.
- **Drive** (`def024-gate-drive.test.ts`, real door + real Chrome, 4 specs): fresh load = no
  notices (control); one tick = exactly the on-notice in both arms (the known-firing signal);
  tick-then-untick = latch shows BOTH, Switch arm shows exactly one. The load-bearing assertions
  are on the notice that should have GONE — D36's own generic form.
- **Mutants: 7/7 killed, each by exactly its own arm** (ignore `isfalse` · drop wired-condition
  abstention · demote non-Condition abstain to contributes-nothing — needed its own MIXED-writers
  arm, added after the corpus run · no-eval pushes anyway · fire on `{false}` · mounted-only ·
  promote to blocking). String-swap restore, md5 parity both files.

**Gates (s21, all fresh, commits `f519c43e` + `07e9237f`)**: editor jest **6442/6447** (5 reds,
none phase 80's: sb-007 ×2 template lane + sb-018 ×2 P77 drag lane, both as s20 recorded, +
**bld-004 `reasoningChannel` — a parallel-load FLAKE of the stall-guard timer: red in two full
runs, 8/8 alone**) · noodl-mcp **994/994** (990 + the 4 drive specs) · noodl-runtime **2597
passed** · viewer-react **1095/1095** · `typecheck:editor`/`:editor-tests`/`:mcp` clean ·
catalog check/merge:check/groups:check clean · `catalog:examples` **62/62 strict** (no shipped
recipe fires the new rule) · **`test:ci` 2905 specs / 4 failures, all AIX-006 BY NAME, seed
38774, fresh readout, gitHead `07e9237f`** — the canonical floor. ⚠️ A full-suite run piped to
`tail` loses the failure names — redirect to a file, then grep `^FAIL`.

## s22 (2026-08-30) — DEF-012 §2 built: the door teaches the ordering the runtime cannot decide

**The queue's one workable candidate, built exactly as s15's finding specified it.** The reading
was re-driven first (18th payment, nothing new returned this time): `runOnValueChange` is still
absent-means-ticked, `setCollectionName`/`setVisualFilter` still schedule the load-time fetch,
and `dropUnresolvedConnected: true` is still the contract that makes "wait for the parameters"
unbuildable in the runtime — *not yet arrived* and *deliberately absent* are indistinguishable
there. The one place the ordering IS decidable is the authored graph, so the fix is a door
precondition.

- **`query-fetches-before-its-filter`** (`queryBeforeFilter.ts`, advisory warning, both doors
  via `authoredPreconditionDiagnostics`, registered after `checkOneWayGate`): fires when a
  cloud component's `DbCollection2` has an authored collection name, a filter naming a
  connected value whose `qp-` port carries a real wire, and either run-on-change box not
  authored `false` (the exact runtime contract). Abstains: browser components (long-standing
  behaviour there, 180 corpus instances left alone — a decision with numbers beside it), a
  wired collection name (fetch ordering not decidable from the graph), static-value filters, a
  connected rule with no wire (never narrows in ANY pass — a different absence), and SB-004's
  workaround whatever else is wired (a `Do` beside both-boxes-false is an authored trigger).
- **The traversal is a duplicated copy, pinned by parity.** `collectFilterParameters` reads
  both saved filter shapes (pre-BCN-003b `{combinator,rules}` and current `{type,conditions}`);
  this layer must not import the runtime (the `RUN_ON_CHANGE_PREFIX` reason), so the spec's
  parity arm runs both implementations over the same filters — the
  `fix-007/function-ports.test.ts` idiom.
- **Corpus** (`npm run calibrate:query-timing`, new script, 178 projects, 0 unreadable,
  denominators printed): 625 Query Records nodes, 325 with a wired filter parameter — cloud:
  **59 firings in 12 projects** (classifier and rule agree exactly), 34 with the workaround
  already applied (all silent — SB-004-era authored projects), 0 wired-collection abstentions —
  browser: 180 at the default, 52 with the workaround. Firings sampled from disk and read true:
  LearnBook's `Find role` (nested OR/AND group, `pm-roleName → qp-roleName`, both boxes absent,
  `fetched → store`) and `Get Techpack Object Metadata` (TWO connected params, `fetched →
  response.send` — **the caller receives every row in the class**). All 59 are legacy imports;
  every MCP-era authored project carries the workaround, which is what "taught at authoring
  time" is for.
- **Templates scanned before shipping the rule** (the s14 lesson — a door rule re-grades every
  generator): site-builder's 3 filtered cloud queries and members-area's 3 all carry the
  workaround; no parity gate moved.
- **Mutants: 7/7 killed, each by exactly its own arm** (drop cloud guard · fire without the
  wire — this arm initially held wires `[]`, which the no-wires early return would have
  satisfied under the sabotage; given a real non-`qp-` wire before the ledger ran · boxes read
  `=== true` instead of `!== false` · drop workaround abstention · drop wired-collection
  abstention · drop the saved-shape walk · promote to blocking). String-swap restore, md5
  parity both files.
- **SB-011 §5 updated in place** — the "left open with this note" paragraph now records what
  was built. DEF-012 row flipped to ✅ done.

**Gates (s22, all fresh)**: editor jest **6454/6458** (4 reds in 2 suites, none phase 80's —
sb-007 ×2 + sb-018 ×2, the P77/P78 template lane: BOTH files' working-tree edits moved INSIDE
the run window, `site-builder.content.json` 13:43:49 + `sb007Template.test.ts` 13:44:32,
uncommitted; the mcp red below is the same lane. 6447 → 6458 = the 11 specs added) · noodl-mcp
**993/994** (the 1 = sb007 SBR-016 mutant-arm string-pin vs the template's new `visualSort`
clause — the peer's in-flight edit, theirs) · `typecheck:editor`/`:editor-tests`/`:mcp` clean ·
`catalog:examples` **62/62 strict** · `catalog:check` clean (no catalog change — descriptions
untouched) · **`test:ci` 2905 specs / 4 failures, all AIX-006 style vocabulary BY NAME, seed
87145, readout 13s old at read, gitHead `b86c5b69`** (a peer commit inside the window — a
read-time fact) — the canonical floor.

## s23 (2026-08-30) — DEF-027 closed: the row the handoff said did not exist

**The queue was not empty.** `NEXT-SESSION-PROMPT.md` said *"no workable open row left — again,
and this time the queue is empty of buildable candidates"*. The table said `DEF-027 | ⬜ open`.
Phase 77 appended that row at **12:50**; s22 wrote the handoff at **13:22**, 32 minutes later,
having read the same file. 🔴 **Grade the table, never a summary of it** — this is the phase's own
founding failure (a finding nobody names gets rediscovered at full price) arriving from the
inside, and it is written into the [README's closing note](README.md#closing-note--s23-2026-08-30)
rather than only here.

### The defect, and why the recorded mechanism was half right

D28 filed it as *"`react-draggable` clones the child with its own `className`"*. Driven at HEAD
first (`ac2DragGestureDrive.test.ts`, real Chrome, real pointer — **9/9, both pins passing**, the
defect confirmed as shipped), then read at the source: **two things had to be true and either
alone is harmless.**

- `react-draggable` *does* merge — `clsx(children.props.className || '', 'react-draggable', …)`.
  It had nothing to see: the child it clones is the `NoodlReactComponent` **wrapper** element,
  created with only `{key, noodlNode, ref}`. The author's class lives on `noodlNode.props`, one
  level deeper.
- `NoodlReactComponent.render` spread `...noodlNode.props` and then `...otherProps`, so the
  library's injected `className` — arriving in `otherProps` — **overwrote** the author's.

`style` immediately above is deliberately parent-wins, and `NoodlReactComponentProps` says so,
because two parents disagreeing about a css property must resolve to one value. **Class names do
not disagree; they accumulate.** Applying the `style` precedence to `className` is the whole bug.

### Fixed at the spread, not in `Drag.tsx` — and D28's uncounted sweep now has a number

D28 warned: *"any other node that clones a child through a third-party wrapper has the same shape
… **Nobody has counted them.**"* **Counted: one.** `Drag.tsx:214` holds the only `cloneElement`
in `packages/noodl-viewer-react/src`, and `react-draggable` is the only third-party wrapper any
node puts around authored children (`@better-scroll` acts on `Group`'s own element, not on a
child's props). The fix went to the spread anyway, so a future wrapper cannot reopen it — still
"in the viewer's own component, not in the dependency", which is what D28 asked for.

- **5 specs** (`noodl-viewer-react/tests/def027-drag-child-css-class.test.tsx`). Both halves of
  the mechanism are real — the real `Drag`, the real library, the real wrapper, the real `Text`
  leaf; only `noodlNode.props` is a fixture, and that is genuinely just data.
- **5 mutants, each killed by a named arm** — M1 drop the merge · M2 `&&`→`||` (an absent half
  stringifies to `"undefined"`) · M3 keep only the authored half · M4 merge *before* the spread ·
  **M5 mutates code this task did not change**, to prove the style-precedence control arm is not
  vacuous. M1/M3/M4 share FINDING and fail on different assertions of it; said rather than
  papered over.
- **The pinning drive was flipped, not deleted**, exactly as its own header instructed, and
  `READ` now finds the cards by `probe-card-` instead of borrowing `.react-draggable`.
  Re-driven after: **9/9 green**. D28 marked ✅ in phase 77's register, with its mechanism
  corrected in place.

🔴 **The trap that made a working fix read as a broken one.** The first post-fix drive came back
**9/9 RED**. `render-report.js` serves `packages/noodl-editor/src/external/viewer/noodl.viewer.js`
— a **gitignored build artifact** — so the drive was still running the pre-fix viewer, and the
new selector (which depends on the fix) matched nothing, failing every arm at once. Anyone
driving a *runtime* change through this harness owes
`cd packages/noodl-viewer-react && npx webpack --config webpack-configs/webpack.viewer.prod.js`
between the two runs. ⚠️ It is a **shared mutable artifact on this checkout** — rebuilding it
swaps what every peer's drive serves, so check for a running drive first.

### Also closed this session

- **s22's DEF-012 gate line was never recorded.** The handoff said the readouts would land *"once
  the session's final runs land"*, and they did not; the work was also still uncommitted at 13:39.
  ⚠️ **Another session committed it at 13:55** (`dde4d477` + `5786d8a5`) while s23 was mid-flight —
  so the commit is **not** this session's, only the gate readout is: `queryBeforeFilter.test.ts`
  **PASS** inside the full editor jest run below.

⚠️ **s23's own D28 edit was swept into a peer's pathspec commit** (`505d9b38`, phase 77's
D30/D31 fix) — the documented hazard, in the harmless direction: committed under someone else's
message rather than lost. Recorded so the D28 disposition can be found by `git log` on the right
commit.
- **The unowned register re-checked at HEAD** — see the section above. Seven rows re-measured,
  all still true; **five explicitly marked *not re-measured*** rather than carried; two citations
  corrected (a `cloudFunctions.test.ts` with no package, and a "three consumers" that was four
  when it was written).

### Gates — s23 (2026-08-30)

| gate | reading |
|---|---|
| `typecheck:viewer` / `:mcp` / `:editor` / `:editor-tests` | **clean**, all four |
| `noodl-viewer-react` jest | **84 suites / 1100 tests, all passed** |
| `noodl-mcp` jest | **76 suites / 994 tests, all passed** |
| `ac2DragGestureDrive` (real Chrome, real pointer) | **9/9** pre-fix *and* post-fix, with the two pins inverted between them |
| `noodl-editor` jest (`test:main`) | **6453 passed, 5 failed / 6458** — see attribution below |
| `test:ci` | **2905 specs, 4 failures, seed 79922** — 🔴 **all four AIX-006 *by name*: the recorded floor exactly.** Exit 1 is the floor's own behaviour, not a regression |

🔴 **The five editor-jest reds, attributed rather than waved through:**

- **`bld-004/reasoningChannel` — a FLAKE.** Green on its own re-run. It went red under load while
  two package suites were live on this checkout.
- **`sb-007/site-template` (×2) and `sb-018/the-list-refreshes-when-a-row-changes` (×2) — a
  peer's, and demonstrably so.** SB-007 asserts `project.components` has length **22**; the tree
  holds **24**. `site-builder.content.json`, `sb005Components.ts`, `sb006Components.ts` and
  `sb007Template.test.ts` were all **uncommitted working-tree edits** at the time of the run —
  phase 77's active D30/D31 lane, landed shortly after as `505d9b38`.
- **None of the five touches `react-component-node.ts` or `queryBeforeFilter.ts`.** Checked, not
  assumed: `grep` for both names across all three failing spec files returns nothing, and
  `tests-unit/validation/queryBeforeFilter.test.ts` **PASSED** in the same run — which is the gate
  reading s22 owed and never recorded.

⚠️ **s23 ran a viewer-react suite and a webpack build while a peer's backend suite was live**, and
the BLD-004 flake is the visible cost. The check and the run were issued in one command, so the
`ps` output could not be acted on. ✅ **Make the peer-check its own call, and read it, before
starting anything.**

---

## s24 (2026-08-30) — DEF-013 closed, and both gates fixed before anything trusted them

**Three rows closed: DEF-013, DEF-032, DEF-030.** The handoff's order was followed exactly —
the cheap re-drive first, then the two instruments, because a gate you have not audited cannot be
evidence about anything else.

### DEF-013 — the row that did not close for free

The ruling was *re-drive before deciding*, on the chance the door had moved underneath the
measurement. It had not. `def013SiblingResolution.test.ts` reproduces SB-012 §1's transcript
**character for character** on a live in-process server built from `src`, including the *did you
mean* that offers `/Pages/A` to `Pages/A` itself and omits `/Pages/B`.

Fixed at the plan door per option 1. `plannedComponentNames(plan)` feeds **both** halves of the
gate — `overlayProject`'s `refNames` and a new `alsoResolvable` argument on
`preconditionDiagnostics`.

🔴 **The drive corrected the register as well as closing the row.** SB-012's table recorded node
`type` as resolving against an unapplied sibling. It does not — that `✅` was measured on a sibling
already **staged**, the sequential case. A node-`type` **cycle** was refused too. All three
spellings were broken and the table said one of them was fine.

### DEF-032 — the `1` is now a number the suite asserts

Measured first: `plan.writes` = **65**, mount-triggered = **1**, graded = **1**, skipped = **64**.
D32's table is confirmed at HEAD. `gradeWriteBackCycle` grades the failure mode nothing graded and
reaches **29 of 65** — a number asserted for the same reason the `1` now is.

**Two confidences, kept apart**: `repeaterItem` (D31's exact shape) asserted as a defect, 0 at HEAD,
mutant-killed; `sameCollection` (**6 rows**, all `/Pages/ThemeEditor`) a **pinned census**, filed as
P77 **D33** and owed a drive. Plausible-benign is not measured, and D31 looked benign by the same
reasoning until the runtime named it.

### DEF-030 — worse than "cannot fail"

Under the placement rule `barePages` returned `[]` for **all three** shipped templates, so §4
compared an empty set against its floor in every case. Rule is now the page's own tree; it
re-grades **one** page, not two — `/Pages/ThemeEditor`, on the floor by name, **phase 77's repair**.
Second vacuity: hello-world's floor entry `/Home` never matched the real name `/#__page__/Home`.

### Gates — s24 (2026-08-30)

| gate | reading |
|---|---|
| `noodl-mcp` jest | **77 suites / 1007 tests, all passed** (994 at s23 + 13 new arms) |
| `typecheck:mcp` (`tsc --noEmit`) | **clean** |
| `def013SiblingResolution` | **5/5**, 3 mutants each killed by a named arm |
| `sb007Template` | **59/59**, D32's mutant + control live |
| `templateAppearance` | **24/24**, D30's mutant asserts both halves |

⚠️ **Not run this session, deliberately**: `test:ci`, editor jest, viewer-react. Nothing here
touches the viewer or the editor's runtime — the two source changes are both in `noodl-mcp/src`,
and the other three files are specs. **A next session that touches product code owes the wider set.**

✅ **The peer check was its own tool call every time**, per s23's cost. One peer jest run was seen
and waited out; a P18 peer landed `6f91ae2a` mid-session adding **DEF-033** to the table, and a
phase 77 peer held `TASKS.md` and `SBR-006` uncommitted throughout — both left alone.

---

### DEF-025 — s25 (2026-08-30): the flip lands in both doors, and the rule survives its own fix

**Richard's ruling built as written**: `useLabel: true` is authored onto **newly placed** `Checkbox`
/ `Radio Button` by the editor **and** by this repo's MCP doors. Nothing touches the port's declared
default, so **no existing rendering moves** and no shipped checkbox starts saying "Label".

**Premises re-verified at HEAD before building** (the standing instruction, 15th payment):
`addLabelInputs` still defaults `useLabel: false`; `Checkbox.tsx:170` / `RadioButton.tsx:178` still
gate `<label htmlFor>` on it; the catalog still carries `useLabel: false` **and** `label: 'Label'` as
static inputs on both types. D37's reading holds unchanged.

#### 🔴 The flip would have blinded the detector s17 shipped — measured, then fixed

The ruling assumed flipping at creation is inert with respect to `label-not-a-click-target`. **It is
not.** The rule skipped any control whose *effective* `useLabel` was true, on the reasoning that
such a control "already owns its words". After the flip that reasoning is false: a door-created
toggle has `useLabel: true` with `label` still at its **placeholder**, so the rule would fall silent
on precisely the population the flip creates.

**Measured on real corpus data, not argued.** Two genuine findings in `fb020-drive`, with the flip
applied to their checkboxes:

| rule | findings on the same two nodes |
|---|---|
| as s17 shipped it | **0** — both defects vanish |
| with the `unfinished` clause | **2**, message naming the placeholder |

So the rule now fires when `useLabel` was **authored** true and the `label` is unset, blank, or the
catalog's own `'Label'`, with a words-carrying sibling Text — and stays silent once the words are in
the port, or arrive over a connection.

⚠️ **The clause is `authored === true`, deliberately, not `effective === true`.** An *unset* port
under a hypothetically flipped catalog default is a different product, and s17's catalog-flip arm —
which the ruling names as load-bearing, and the only thing that makes the authored-bag-only mutant
killable — **still passes untouched**. Mutant M4 (widening `authored` to `effective`) kills exactly
that arm and nothing else, which is how the discriminator was shown to be doing real work.

#### Where it landed

- **Editor**: `newNodeSeed.ts` gains `CREATION_DEFAULTS_BY_TYPE` beside FUN-002's body-seed table —
  same moment, same guards, same undo discipline (its own entry, so one ⌘Z takes the label off and
  leaves the control). `seedNewNode` applies both. **No call-site change was needed**, because
  `seedNewNode` is already called from both paths that mint a brand-new node.
- 🔴 **The other creation mechanism was the wrong seam, and measuring said so.**
  `ElementConfigRegistry.applyDefaults` has **one** call site (`NodePicker.utils:25`); the
  drag-onto-canvas door never calls it. Building on it would have fixed one door of the two the
  ruling names. **Registered as its own unowned row** — it means STYLE-002's tokens *and DEF-001's
  accessibility border* reach a picker-placed control and not a dragged one.
- **MCP**: one funnel, `normalizeAuthoredNodes(nodes, existingIds?)`, reaching `create_component`,
  `update_component`'s `set` branch, and the plan door's stage; `add_node` is handled in
  `normalizeOperations`, where a new id is guaranteed by construction.
- 🔴 **"Newly placed" is decided by id, not by door.** `set` re-sends the entire graph on every
  call, so a bare checkbox arriving there is usually one someone deliberately left bare. Flipping it
  would be an existing rendering moving — the one consequence the ruling forbids. The plan door's
  baseline read moved ahead of its reconcile for the same reason.
- **One list, two readers**: `LABEL_TARGET_CONTROLS` lives in the import-free seed module and the
  validation rule imports it. A spec asserts the set the door fills **is** the set the rule watches.

#### Gates — s25 (2026-08-30)

| gate | reading |
|---|---|
| `noodl-mcp` jest | **78 suites / 1015 tests, all passed** (1007 at s24 + the 8 new door arms) |
| editor jest | **6473 tests, 4 failed** — `sb-007` (2) + `sb-018` (2), **both peer lanes** |
| ↳ ownership check | the same **4 failed / 52 passed** with this session's three editor files restored to HEAD |
| `tests-unit/def-025` | **28/28** (13 s17 arms + 7 new + 8 decision arms), `fun-002` **7/7** |
| `catalog:examples` | **62/62** strict, warnings-as-errors — the recipe s17 repaired stays clean |
| `calibrate:labels` | **233 projects, 0 unreadable · 77 toggles · 16 findings · 0 from the new clause** |
| ↳ its control | injected flip on 2 real nodes fires the new message — the 0 is an absence, not a dead path |
| `typecheck:mcp` · `:editor` · `:editor-tests` | **clean** |
| `test:ci` | **2905 specs / 4 failures, seed 28644, fresh readout** — all four **AIX-006 style vocabulary, BY NAME**: the floor |
| mutants | **8, each killed by its own arms** — M1/M2 (decision), M3/M4 (rule), M5–M8 (the four doors) |

`test:ci` exits **1 at the floor**, exactly as a timed-out run does, so the exit code was not read as
the result: the readout's mtime was checked fresh (23:01:49, read at 23:02:05) and the four failures
were read **by name**, not counted.

⚠️ **A phase 77 peer landed `420994d3` (SBR-015 AC4) while `test:ci` was running** — which is why the
readout's `gitHead` is a commit this session never worked from. The bundle under test was built
before that commit, so the reading is of this session's code; the peer's work is simply not in it.
Their commit touched phase 77's `TASKS.md` and `UNOWNED-ROWS-TO-MEASURE.md` — **not** phase 80's
files of the same names, which is a collision waiting for whoever reads a bare filename in a log.

⚠️ **`calibrate:labels` is NOT s17's corpus.** s17 measured 178 projects / 186 toggles / 43
findings; the invocation was never written down, and the 233 roots enumerated this session yield 77
toggles. **Different population, so this is not evidence that the 43 legacy firings are unchanged**
— it is evidence about the population reached here. The script takes its roots as arguments; a
session that wants comparability must record the command, not just the number.

⚠️ **The editor half's *wiring* is graded by the call sites, not by a spec**, exactly as FUN-002
left it — `seedNewNode` is reached from both creation paths and the decision is graded directly.
**What is owed is a drive**: place a Checkbox from the picker and drag one from the library, and
observe both arrive with the Label port visible in the property panel. Not done this session — an
editor drive serves a **built bundle** and `test:ci` held the machine.
