# Phase 75 — next session

**State as of 2026-08-23 (session 15).** Session 15 built, specced and **drove FB-003 over real
HTTP** — the two composers, so somebody other than Richard can ask for work or offer to do it.
**FB-003 is closed.** The drive found a defect the task file, the spec fixtures and sixteen green
specs had all walked past, and it is on the **most likely path through the feature**. Read *"What
session 15 found"*, then session 14's notes, which still stand.

## What session 15 found

### ✅ FB-003 — BUILT, SPECCED, DRIVEN, CLOSED (`nodegx-community` `67df2b1`)

Two POSTs added to the routes that already served the GETs, and one client island
(`src/components/BoardComposer.tsx`) holding both composers. **An API caller and not a server
action**, on `ApproveForm.tsx`'s recorded argument and because AC1 is literally that a request
posted on the web reaches the **editor's** NAT-009 client without either being redeployed.

- 🔴 **THE DRIVE FOUND WHAT NOTHING ELSE COULD, AND IT WAS THE COMMON CASE.**
  **`coaching_offers.account_id` references `profiles`, not `accounts`** (`0004…sql:255`). So an
  account with **no profile row cannot create an offer at all** — and that is *every* account a
  real sign-up produces, because `upsertProfile` has no caller in `src/`. It answered the generic
  **`"that offer could not be created"`**, which is precisely the default `board-http.ts` exists
  to prevent. Now `[offer-needs-profile]`, a **403 naming the precondition**.
- 🔴 **THE SPEC FIXTURE IS WHAT HID IT.** `makeUnlistedBuilder` creates an account **with** a
  profile and no evidence — the *below-the-bar* case. A real sign-up has **no profile row**, a
  different refusal entirely. ✅ **New rule: when a fixture builds the subject, ask which state
  of the subject PRODUCTION actually produces.** The below-the-bar arm was green and honest and
  simply about somebody who does not exist yet.
- ✅ **The control that settled it**: the *same* profile-less account posts an RFP happily (201),
  because `rfps.poster_account_id` references `accounts`. One account, two verbs, opposite
  answers — driven over HTTP, not just specced.
- ✅ **Creating an offer and being ADVERTISED are two events.** `listOffers` gates on D8's bar;
  `createOffer` gates on neither. The route returns `listed`, computed by a predicate **shared
  with `listOffers`** — a second copy would agree the day it was written and drift the first time
  the bar moved. Three states, all driven: **403**, **201 `listed:false`**, **201 `listed:true`**.
- 🔴 **Two more refusal-layer defects.** `boardRefusalResponse`'s default said *"that **response**
  could not be sent"* — it would have told somebody who posted a **request** that their response
  failed. And **`[rfp-response-cap]` names two different failures** (cap spent vs cap not
  positive); unreachable today because no route lets a poster set a cap, recorded rather than
  "fixed" with something nothing can exercise.
- ✅ **There is no rate band and no budget vocabulary.** The scope asked for both; the schema has
  `price_cents`/`currency`/`duration_minutes`, and `budget_band` is free text with a length check.
  Derived from the schema per the task's own NAT-008 trap, and a spec row asserts the budget
  sentence names no band.
- ✅ **D15 by construction**: two new `WRITE_CAPABILITIES`, which is what makes them governed —
  `d15-visibility` quantifies over that list and **grew four rows by itself**.
  🔴 `gateFor` copies `serveCommunityWrite`'s **order** on purpose: measured live, signed-out is
  `surface=present, viewer=NO, postRfp=False` and org-minor is `surface=ABSENT` — **identical in
  capabilities, opposite in treatment**.
- ⚠️ **One mutation survived and it is an EQUIVALENT MUTANT**, not a hole: swapping the `surface`
  and `viewer` checks changes nothing, because `apiviewer.ts:97` makes `viewer === null` imply
  `surface === 'present'`. ✅ **The invariant is now the assertion** — a mutation that breaks it
  turns the row red, so the ordering becomes load-bearing exactly when it starts to matter.
- 🔴 **A `useRouter` in the island made `renderToStaticMarkup` THROW** — *"invariant expected app
  router to be mounted"* — so `uni023`'s read-path row failed **to run** rather than failing.
  ✅ Fixed structurally: the gate is a separate component from the form, so the server render
  returns `null` before anything touches the router. Same family as the memory index's
  *"a THROWING HOOK ⇒ fails TO RUN"*.

## First moves, in order

1. 🔴 **FB-010 — and session 15 turned it from "nice" into a BLOCKER.** *"Offer coaching"* now
   exists and **refuses every real account**, correctly and by name, because there is nowhere to
   create a profile. FB-003 built the door; FB-010 is the key. Its AC1/AC2 are unchanged;
   ⚠️ its AC3 (revoking an editor grant from the web) still makes
   `nat007-device-consent.test.tsx`'s absence assertion false **on purpose**.
2. **FB-007** — the editor uploads the capture it already takes. ⚠️ It needs a **recorded display
   decision** (scope 2 reverses NAT-008's "the editor fetches no remote image") and the E7
   platform half verified live before any editor work can be driven.
3. ⚠️ **FB-003's two deliberate remainders**: **AC4's editor half** — `POST_A_REQUEST_LINE` has
   **no UI consumer**, so there is no click to redirect and a path constant would have been a
   23rd *build-the-caller* committed on purpose; whoever builds NAT-009's board UI wants `/rfps`.
   And **the form is not driven in a browser** — server HTML, the capability payload, every
   `gateFor` branch and both routes over real HTTP are, but hydration rendering is spec + bundle
   presence only.
4. ⚠️ **DEPLOY.** `67df2b1` is committed and unshipped; nexus-1 is still at `0860426`. Two
   sessions of community work are now waiting behind a deploy that is Richard's call.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Gates, this tree

- Community suite: **56 files / 1360 specs / 0 failures** (session 11: 55/1321). **+34** the new
  `fb003-composers.test.ts`, **+1** `uni023`, **+4** generated by
  `describe.each(WRITE_CAPABILITIES)`. **Reconciles exactly** — and the +4 is the D15 gate doing
  the job it was built for, with nobody writing a row.
- `npm run typecheck` clean. **Twelve mutations, all red.**
- ⚠️ **`npm run lint` DOES NOT RUN, for anyone.** It is `next lint`, deprecated in Next 15, and it
  **prompts interactively** for an ESLint configuration instead of linting. Not caused by this
  session; worth knowing before anyone quotes it as a passing gate.
- **Editor** `tests-unit`, `noodl-viewer-react`, `@noodl/runtime`, `test:ci`: **not run** —
  nothing in this session touched the editor repo except documentation.
  🔴 **Re-measure rather than quoting any handover.**

## Session notes

- **Databases left behind**: `nodegx_community_fb003` (specs) and `nodegx_community_fb003drive`
  (the drive — migrated *and seeded*, with `nia-drive`, `sam-below` and `pupil-drive` accounts
  already in the three states). Reusable; rebuild rather than trusting them.
- ✅ **Driving this platform needs no editor and no browser**: `npm run build` then
  `npx next start -p 3200` against a `DATABASE_URL` of its own, sessions minted by inserting a
  `sessions` row with `sha256(token)`, and `curl` with a bearer. That reaches every route.
  ⚠️ **Kill it with `lsof -ti :3200 -sTCP:LISTEN`**, never the bare form.
- ⚠️ **`psql -tAc` prints the command tag as well as the row** — `insert … returning id` gave an
  id with `INSERT 0 1` glued to it, which produced a bearer token that looked like a session and
  answered **400**. Use `-tAqc … | head -1`.
- ⚠️ **The orphaned `AskAboutNodeDialog.module.scss` fix is STILL uncommitted** in the editor tree
  and still belongs to neither of us — mtime `2026-08-20 15:41`. Untouched this session. It is
  Richard's call.
- A peer session (`opennoodl-78`) was live in this checkout; this session's source edits were all
  in **`nodegx-community`**, which it was not working in.

**State as of 2026-08-23 (session 14).** Session 14 built and drove **FB-019 scope (3)** — the
task's whole remainder — and **FB-019 is now closed**. The drive found that the editor had been
saying the missing thing for years on every units port *except the two that were reported*, and an
absence assertion found a third copy of the same rule with a second defect in it. Read *"What
session 14 found"*, then session 13's notes, which still stand.

## What session 14 found

### ✅ FB-019 scope (3) / AC2 — BUILT, DRIVEN ON BOTH SURFACES, CLOSED (`31f95a63`)

- 🔴 **THE HOLE WAS IN A FEATURE, AND IT WAS EXACTLY THE SHAPE OF THE COMPLAINT.**
  `NodeLibrary.getAnnotatedPortName` has annotated units ports with their unit for years — the
  connection popup is its only caller. Its guard read `nameForPortType(type) === 'number' &&
  type.units !== undefined`, and **`dimension` is declared by exactly two ports: `width` and
  `height`.** So the popup said `Min Width (%)`, `Pad Left (px)`, `Margin Left (px)`,
  `Rotation (deg)` — and **nothing** on the two ports Richard named. Seventh recorded
  "hole shaped like the defect", and the first in a *feature* rather than a checker.
  ✅ **Worse than plain silence**: the annotation on the neighbours is what makes the silence on
  Width read as *"Width has no unit"*.
- 🔴 **AN ABSENCE ASSERTION FOUND A THIRD COPY NOBODY HAD LOOKED AT.** The spec row asserting the
  old guard text was *gone* went red on `formatParameterValue` (`nodelibrary.ts:319`) — same
  `dimension` hole, **plus** a bare-number fallback reading `units[0]` where the runtime reads
  `defaultUnit`. Those disagree on **6 of 104** declarations, so a stored bare `50` on
  `transformOriginX` displayed as `50px` while the viewer rendered `50%`. ⚠️ Its only callers are
  the **version-control conflict list**, which is why neither defect was ever reported — and why
  that half is **specced, not driven**. ✅ All three copies now share one predicate
  (`isUnitsPortType`) and one accessor (`declaredUnit`).
- ✅ **The sentence is computed, not looked up.** A wire cannot carry a unit, so the landing unit is
  (1) the author's stored unit, else (2) the seed `initializeDefaultValues` wrote — which needs
  **both** `defaultUnit` **and** a declared `default`.
- 🔴 **CASE 3 IS DELIBERATELY UNSTATED, AND IT CORRECTS A CLOSED AC.** 14 of 104 declarations have
  `defaultUnit` and **no `default`**, and they disagree: the `inputCss` ones (margins, min/max,
  `fontSize`) are coerced a second time at `react-component-node.ts:1925`, but **`Columns`' two
  breakpoint ports are `inputProps`, where a value with no `.value` is deleted** (`:635`). The
  editor cannot see which path a port is on. ⚠️ **So session 12's closure of AC1 as
  *"already ships"* was too broad** — the never-set + bare-number failure is **latent, not
  absent**, on those two ports (0 instances in 97 `project.json` files). Left open on purpose.
- ⚠️ **`WIRE_FORMAT_LEGEND` could NOT be reused as scope (3) suggested** — it tells the AI author
  *"a bare number means the FIRST unit listed"*, wrong on the same six declarations. The UI copy
  uses `defaultUnit`, which is what `nodedefinition.ts:171` actually reads. **The legend is still
  wrong and was not edited** (it is prompt text; changing it is its own measurement).

### The drive

- 🔴 **CHECKED FIRST, BECAUSE EVERYTHING RESTED ON IT: `port.default` DOES reach the editor.**
  Live off `getPorts('input')`: `width.default = 100`, `paddingLeft.default = 0`, and
  **`marginLeft` has no `default` key at all** — so the reading discriminates rather than fits.
  Without this the whole feature would have been vacuous in the real app and green in the suite.
- **Ports tab**, one Group, **35 of 220** rows carry a line: Width *"lands here as **300%**"*,
  Pad Left *"**300px**"*, Margin Left names **no** unit, Transform Origin X says **`%`** though
  `units[0]` is `px`; Background Color and Clip Content say **nothing**.
- ✅ **The strongest arm — one node, two identical declarations.** Group B's `width` is stored as
  `{150, px}` and its `height` was never set: same type, same units, same `defaultUnit`, and the
  lines say **300px** and **300%**. Varying exactly one thing (the stored parameter) flips the
  answer — the merge made visible, which no source-text spec could have shown.
- **Popup**: `Width (%)` / `Height (%)` now appear beside the unchanged neighbours, and Text's
  plain-`number` `Width` **output** correctly still gets **no** annotation — three readings of one
  port name in one DOM.

### Two driving traps that each produced a convincing false reading

- 🔴 **`connectionPopups.close()` REMOVES NOTHING, so a second popup leaves 4 bars in the DOM.**
  `bars[1]` was still the *first* popup's, so Group B read `Width (%)` and looked like a broken
  stored-unit branch. ✅ **Count the bars before indexing them.**
- 🔴 **Popup row labels contain a NON-BREAKING SPACE (char 160)** before the annotation, so
  `innerText === 'Margin Left (px)'` never matches. Three probes read *"NO ROW"* and looked exactly
  like three ports with no shape line. ✅ Normalise ` ` before comparing.

## First moves, in order

1. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family. FB-019 is
   closed, so these are the top of the queue.
2. ⚠️ **FB-019's two deliberate remainders**, if anyone wants them: scope (5) (Jordan's
   margin/corner-radius aliasing — **variants and visual states are the unexamined candidates**),
   and `Columns`' two breakpoint ports above.
3. ⚠️ **Banked from session 12, still undriven**: `registerInput` writes `{value, type}` where every
   reader wants `unit` — latent, but a dynamically registered units port has a default the merge
   cannot see.
4. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Gates, this tree

- Editor `tests-unit`: **293 suites / 4790 specs / 0 failures** (session 11: 292/4763 ⇒ **+1 suite /
  +27 specs**, all `property-editor/portWireShape.test.ts`). Reconciles exactly.
- `typecheck:editor` and `typecheck:editor-tests` clean.
- **Nine mutations, all red, control green** — listed in the task file.
- `noodl-viewer-react` / `@noodl/runtime` jest, community suite, `lessons:check`: **not re-run** —
  nothing touched them. Sessions 11–13's figures stand.
- `test:ci` **not re-run** (a full run alone was not safe beside a peer session).
  🔴 **Re-measure rather than quoting any handover.**

## Session notes

- ⚠️ **A peer session (`opennoodl-78`) was live in this checkout all session** and confirmed it had
  nothing running before the launch. Source edits were announced to it up front; it committed
  nothing that overlaps.
- 🔴 **AN ORPHANED FIX HAS BEEN UNCOMMITTED IN THE TREE SINCE 08-20 AND BELONGS TO NEITHER OF US.**
  `AskAboutNodeDialog.module.scss` — a finished, fully-commented 24-line fix whose own comment reads
  *"Measured 2026-08-19"*. **`BaseDialog` paints its surface with `::after` at `inset: 0`, which
  resolves against the padding box**, so a dialog taller than its `max-height` goes see-through for
  the scrolled remainder (measured: 700.9px painted against 858px of content). The composer is the
  only dialog tall enough to notice; the fix is local, and its comment says a shared fix in
  `noodl-core-ui` would cover every dialog but wants a visual pass first.
  🔴 **Both live sessions independently concluded it was the other's**, because each read its own
  opening `git status` and saw a file it had not touched. ✅ **The field that settles it is the
  mtime — `2026-08-20 15:41`, predating both sessions.** A status snapshot shows presence, never
  authorship. **Do not sweep it into an unrelated commit**; `opennoodl-78` has surfaced it to
  Richard, and it is his call whether it lands.
- Fixture: `fb019-shape` in this session's scratchpad — a copy of `fix012-drive` plus a Group with
  `width` set to `{150,px}` and an Icon node. ⚠️ Registered in the launcher's recents and pointing
  at a scratchpad that will be cleaned up; rebuild rather than trusting the row. The authoring is
  ~15 lines of Python over `project.json`.
- ✅ **Reaching editor modules over CDP**: `window.webpackChunknoodl_editor.push([[id], {}, r => {
  window.__wreq = r; }])` captures `__webpack_require__`; `__wreq.m` lists every module by source
  path. That is how `portWireShape` was called directly on real ports before any UI was read.
- 🔴 **`n.type` on a graph node is the type MODEL, not a string** — `n.typename` is the string.
  Comparing `n.type === 'Group'` silently matched nothing and serialising it dumped 157KB.

**State as of 2026-08-23 (session 13).** Session 13 did what session 12's handover put first:
it **drove FB-019 AC3's icon arm before fixing it**. Unlike the two before it, **this claim was
true** — the empty span is real. It is now fixed, re-driven, specced and committed, and AC3 is
closed. Read *"What session 13 found"*, then session 12's notes, which still stand.

## What session 13 found

### ✅ FB-019 AC3 — THE FIRST PREDICTED-FROM-SOURCE CLAIM IN THIS FILE THAT WAS REAL

Three have now been driven; **two were fiction, this one was not**. The lesson is not "trust the
file again" — it is that the drive is what tells them apart, and it cost about an hour.

- ✅ **The defect, measured.** Three `Icon` nodes, one Function node with its output type **left
  unset** (the `outtype-` enum offers no `*`, so *not choosing* is how you get one). A string
  `'account_circle'` over that `*` wire rendered
  `<span class="" style="font-size:40px; color:rgb(255,0,0)"></span>` — **present, styled, empty**.
- 🔴 **The third arm is what made it a defect.** A never-set icon port renders **no span at all**.
  So an undrawable value does *not* degrade to "nothing"; it leaves a styled box that still takes
  its `iconSize` in layout. Without arm C the reading would have been "no icon either way, so what".
- ✅ **Silent in all three places one would look**: 0 of 16 cast-table rows target `icon`; the
  connection warning stays quiet for a `*` source by design; nothing in the console or `dev.log`.
- 🔴 **A CAST-TABLE READING TAKEN BEFORE A PROJECT IS OPEN IS VACUOUS AND LOOKS LIKE A REFUSAL.**
  The first read reported `string→number: false` — wrong. `NodeLibrary.library` holds only
  `{colors}` until a project loads. ✅ **The control caught it**: a pair that is *known* true.
- ✅ **Resolved to WARN, not coerce — and the reason is in the source.** `iconValueForGlyph` builds
  a glyph value as `{class: set.iconClass, code: glyph, codeAsClass: set.codeAsClass}`: **two of
  three fields come from the installed set's manifest**. A bare string carries only the glyph name,
  so coercion must guess the set, and the two shipped conventions want opposite fields. The task's
  suggested `{codeAsClass:true, class:s}` is wrong for both. **Guessing renders a blank glyph
  again, having reported success.**
- ✅ **Fixed at the port, not in `IconGlyph`**: an `icon` branch in `defineRegularInputProp` that
  `setDiagnostic`s and **drops** the value. At the port the name and node id are known, it runs
  once per *set* not per render, and `setDiagnostic` is a setter so the raise clears itself.
- ✅ **Re-driven**: arm A → no span, warnings **0 → 1**, message names the value and the shape.
  Then the same wire made to carry `{class:'material-icons', code:'search'}` → warning back to
  **0** and the glyph **drew**. 🔴 That last step is why refusing the *wire* would have been wrong:
  a Function emitting a proper icon object is legitimate, and `*`→icon is the only route it has.
- ✅ **20 specs, mutation-checked twice** (2 reds for the port branch, 7 for the predicate).
  ⚠️ An earlier draft "killed 4" — two were red only because the harness was never called, which
  **overstates a mutation count**; they now grade *no message raised*, true either way.
- ✅ **Provably inert**: 76 `iconIconSource` parameters across 97 `project.json` files, all 76
  accepted. ⚠️ Bound: *parameters*; wired values cannot be swept statically.
- 🆕 **Scope (4)'s other half was already done** — the "manifest.json / library panel" copy on
  **Enable Icon** is not in the source. Same shape as AC1: an item describing what already ships.

## First moves, in order

1. **FB-019 scope (3)** — say the wire shape at the port, in the connection popup and the Ports
   tab. This is now the whole of FB-019 and needs no ruling. It is what makes `300 → 300%` and
   the icon union legible *before* someone wires them, which neither drive's fix does.
2. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
3. ⚠️ **Banked from session 12, still undriven**: `registerInput` writes `{value, type}` where
   every reader wants `unit` — latent, but a dynamically registered units port has a default the
   merge cannot see.
4. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Gates, this tree

- `noodl-viewer-react` jest: **75 suites / 965 specs / 0 failures** (mine is +1 suite / +20 specs).
- `@noodl/runtime` jest: **140 suites / 2543 specs / 0 failures** — unchanged from session 12.
- `lessons:check` clean; `typecheck:viewer` clean.
- Community suite and editor `tests-unit` **not re-run** — nothing touched either. Session 11's
  figures stand: 55/1321/0 and 292/4763/0.
- `test:ci` **not re-run** (swap was at 10.2G/11.2G all session; a full run alone was not safe).
  🔴 **Re-measure rather than quoting any handover.**

## Driving, session 13's additions

- ✅ **A `*` output is what you get by NOT choosing an output type.** The `outtype-<name>` enum has
  no `*` entry; the editor's dynamic-port builder reads `parameters['outtype-'+label] || '*'`. So
  a fixture that needs a `*` source just omits the parameter.
- ✅ **The warnings instrument**: `graph.evaluateConnectionHealth(con)` computes,
  `WarningsModel.instance.getWarnings({component, connection})` reads,
  `getTotalNumberOfWarnings()` is the cheap scalar. ⚠️ **`getConnectionHealth` is a different
  function with a different argument shape** (`sourceId`/`sourcePort`, not `fromId`/`fromProperty`)
  and throws on a stored connection — it reads, it does not compute.
- ✅ **A control pair on one wire**: monkeypatch the source node's `getPort` to return a different
  `type`, re-evaluate, read, restore. Varies exactly one thing and restores the original reading.
- 🔴 **`forEachNode` stops on a truthy return** — `types.push(n.type)` returns a number, so the
  walk stopped at node 1 and dumped its entire listener graph (255KB). Use `findNodeWithId`.
- 🔴 **`npm run cdp -- reload --target=viewer` killed the viewer and reloaded the EDITOR**, closing
  the project. Expected per the memory index; costs a re-open, so take the DOM reading first.
- ⚠️ **A launcher card can be off-screen** (y≈5800): tag the leaf by text, `scrollIntoView`, then
  read the rect in a **separate** eval before clicking.
- Fixture: `fb019-icon` in this session's scratchpad — three arms plus the `*`-output Function.
  ⚠️ Registered in the launcher's recents and pointing at a scratchpad that will be cleaned up;
  rebuild rather than trusting the row. The authoring script is small — three `net.noodl.visual.icon`
  nodes and one `JavaScriptFunction` with `scriptOutputs` and no `outtype-`.

**State as of 2026-08-23 (session 12).** Session 12 did the thing session 11's handover put first:
it **drove an image-cropper pan before believing FB-019**. The pan works. Both of FB-019's
silent-failure bugs are fiction, the task shrank from M/L to S/M, and the one thing that needed
building was a test to keep the accident that saves it. Read *"What session 12 found"*, then
session 11's notes, which still stand.

## What session 12 found

### 🔴 FB-019 — THE DIAGNOSIS WAS RIGHT ABOUT THE MECHANISM AND WRONG ABOUT WHETHER IT FIRES

That is the sixth wrong filed diagnosis in a row, and a **new shape**: the file described the
failure path correctly, line by line, and never grepped for the guard that prevents it.

- ✅ **The cropper pans.** Shipped prefab, unmodified, 400×300 arena, 680×384 image:
  `translateX(-140px) translateY(-42px)` on load, and a +100/+30 drag moves it to
  `translateX(-40px) translateY(-12px)` — the deltas exactly. Predicted `translate(NaN…)`: absent.
- ✅ **The control was built into the module.** `refreshView()` emits `ImageXpos` and `ImageWidth`
  from adjacent lines into `transformX` (**no** stored parameter) and `width` (stored `{100,'px'}`)
  **on the same node, same tick**. The task expected them to disagree. They agree.
- ✅ **Then all three registration paths on one node**, one `Expression` emitting a bare `300`:

  | arm | path | stored | measured | task file said |
  |---|---|---|---|---|
  | `width` | `inputProps` | **none** | **`300%`** | *prop deleted, width lost* 🔴 |
  | `width` | `inputProps` | `{150,'px'}` | `300px` ✅ | merge fires ✅ |
  | `paddingLeft` | `inputCss` | **none** | `300px` ✅ | coerces ✅ |
  | `transformX` | `inputs` | **none** | **`translateX(300px)`** | *`NaN`* 🔴 |

- 🔴 **The seeder nobody grepped for.** The file reasoned from `react-component-node.ts:827`, whose
  default loop really does cover `inputCss` only — but that is the **React viewer's style loop**,
  not the only one. `initializeDefaultValues` (`nodedefinition.ts:161–180`, called at `:537`) runs
  over **every** input on all three paths and writes `{ unit: type.defaultUnit, value: default }`.
  `width` declares `default: 100`, `transformX` declares `default: 0` — so `_inputValues` holds a
  unit **before any wire fires** and `setInputValue`'s merge always finds one.
- ✅ **Excluded, not merely fitted.** For a never-set `width` to read `300%`, the value must already
  have been `{value:300, unit:'%'}` at the setter; only the merge builds that, and only a `unit`
  key arms it. The other writer of `_inputValues`, `registerInput` (`node.ts:130–140`), writes
  `type:` — **the wrong key** — and node creation does not call it anyway
  (`_inputs = Object.create(inputs)`).
- ✅ **And the mutation says so in the defect's own words.** Comment out that one call and the suite
  reports `width` → `undefined`, `transformX` → **`NaN`**: *exactly* the two failures FB-019 was
  filed on. The prediction was a correct description of the unguarded code.
- 🔴 **Population B is EMPTY** — not "8 connections broken today". The counts were wrong too:
  `image-cropper` has **2** transform connections (both in `Panning Control`; `Image Cropper`
  itself has **0**), not 4 across two components.
- ✅ **What survives, and it is now the whole task**: the asymmetry Richard reported is **real**,
  with a different cause. `300` into padding is `300px`; `300` into Width is `300%` — same node,
  same wire, same number — because `defaultUnit` differs per port. Not "coerces vs deletes".
  **Scope (3), say the shape at the port, is the remaining runtime story.**
- ✅ **Built: `packages/noodl-runtime/test/fb-019-units-default-seeding.test.ts`** (6 rows). AC1's
  revised clause turned out to describe behaviour that **already ships**, so building it would have
  been this phase's standing trap again; the test pins the seeder instead so it cannot be removed
  by someone tidying `registerInput`'s duplicate. Mutation-checked: first three rows red, last
  three green — correctly, they are the arms that do not depend on the seeder.
- ⚠️ **Scope (5)'s aliasing hypothesis is narrowed, not settled.** Both writers copy — the merge
  does `Object.assign({}, …)` with a comment saying why, and the seeder builds a fresh object per
  node per port. If Jordan's margin/corner-radius report is aliasing, it is elsewhere; **variants
  and visual states are the unexamined candidates.**
- ⚠️ **Banked, not driven**: `registerInput` writes `{value, type}` where every reader wants `unit`.
  Latent — the React path never reaches it — but a units port registered *dynamically* has a
  default the merge cannot see.

## First moves, in order

1. 🔴 **FB-019 AC3 — the icon arm, and DRIVE IT BEFORE FIXING IT.** It is the last
   predicted-from-source claim in that file, and **two of two** such claims in it were fiction.
   The claim: a string reaching `IconGlyph` via a `*` output renders an empty span silently.
   Needs a fixture with a `*`-typed output carrying a string into `iconIconSource` — not built this
   session, and the fiddly part is finding a node with a `*` output that emits a string.
2. **FB-019 scope (3)** — say the wire shape at the port. This is now the task's centre of gravity,
   and it is what makes `300 → 300%` legible rather than surprising. No ruling needed.
3. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
4. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Gates, this tree

- `@noodl/runtime` jest: **140 suites / 2543 specs / 0 failures** (mine is +1 suite / +6 specs).
- Community suite and editor `tests-unit` **not re-run this session** — nothing touched either.
  Session 11's figures stand: 55/1321/0 and 292/4763/0.
- `test:ci` **not re-run**. 🔴 **Re-measure rather than quoting the handover.**

## Driving, session 12's additions

- ✅ **A project can be put in front of the launcher without a native file dialog**:
  `LocalProjectsModel.instance.openProjectFromFolder(dir)` through webpack's require registers it,
  then click its card. `leaveForLauncher('projects')` (`utils/launcher/leaveForLauncher.ts`) goes
  back without hunting for a UI control.
- 🔴 **`npm run cdp -- click` takes the FIRST match, and a launcher card's name span shares its
  class with every other card.** That opened the wrong project (`nat012-drive`) and looked like a
  successful drive. ✅ Find the element by text, `setAttribute('data-x','t')`, click **that**.
- ✅ `npm run cdp -- drag "x,y" "x,y" --target=viewer` works and is how the pan was driven; the
  harness has a `drag` command, which the run-editor skill's command list does not mention.
- 🔴 **Re-read the fixture off disk AFTER driving.** The whole table depended on three ports being
  *never set*, and opening a project rewrites it — a `width` written in on open would have
  invalidated everything. Checked: it did not.
- Fixtures in this session's scratchpad (not the repo): `fb019-drive` (the cropper prefab's own
  project with an `/App` that places `Panning Control`) and `fb019-widths` (the five-arm table).
  ⚠️ **Both are registered in the launcher's recents now** and point at a scratchpad that will be
  cleaned up; rebuild rather than trusting the rows.

**State as of 2026-08-23 (session 11).** Session 11 fixed **FB-023**, **deployed the platform to
nexus-1**, and built + drove the **editor's delete confirmation**. Three things closed; read
*"What session 11 found"*, then session 10's notes, which still stand.

## What session 11 found

### FB-023 — fixed, driven, specced (`nodegx-community` `0860426`)

- 🔴 **THE MECHANISM WAS ONE `grep` AWAY, AND THE FILE HAD MARKED IT "NOT ISOLATED".**
  `drizzle()` **mutates the postgres.js client you hand it** — five lines in
  `drizzle-orm/postgres-js/driver.js` set the parsers for timestamptz/date/time/timestamp to
  identity, permanently. Every later raw `` sql`…` `` on that client reads a date as a **string**.
  - 🔴 **Why it read as flakiness**: postgres.js resolves `parser: parsers[type]` **once**, at
    Describe time, and caches it **per connection**. Statements prepared *before* the mutation
    keep working. That one fact explains the 3-cycle, the `max=1` run that "disproved" the first
    model, and every probe that would not reproduce.
  - ✅ **Lesson: when a mechanism will not isolate, read the DEPENDENCY'S source.**
- 🔴 **THE POPULATION WAS WRONG, AND IT MADE A LISTED FIX A NON-FIX.** The file named
  `/community/home` as the only poisoning route. `serveCommunityRead` hands `apiSql()` to **every**
  read route, and both tutorials routes also reach `createDb`. On a virgin pool **all three** score
  **20/20** failures against a **0/20** control. The editor draws TUT-004's tutorials, so candidate
  #2 would have left it broken *and looked fixed*. ✅ **Grep the helper that supplies the argument.**
- 🔴 **A WARM-UP CONTROL DOES NOT OBSERVE THIS BUG — IT PREVENTS IT.** Session 10's 13/20 and
  session 11's first tutorials arm reading **0/20 ("innocent")** were both artifacts of reading a
  thread before the poisoner ran. ⚠️ **A control that touches the subject can immunise it.**
- ✅ **Fix is structural: `createDb()` takes no client** — the trap was the parameter, and 3 of its
  4 call sites had fallen in. Guard row: only `src/db/index.ts` may call `drizzle(`.
- 🔴 **My own spec had a vacuous row**, caught only by mutation: *"the date survives as a Date"*
  read the test's own `freshDb()` client, **which no route ever poisons**, so it passed on broken
  code while appearing to assert the mechanism. Repointed at `apiSql()`. 8 rows, **7 red on the
  reverted code**.

### ✅ DEPLOYED to nexus-1 — the four unshipped commits are live

`8d40b63` → **`0860426`**, at 2026-08-23T11:26:35Z. Neighbours **200 → 200** on all three
(`nodegx.io`, `nexus.digitalbricks.io`, `digitalbricks.io`); sign-in 302s; backup and restore-check
green. ✅ **Verified on the live site, not just by the deploy script**: after hitting *both*
poisoning routes, 12 consecutive live thread reads returned **200 — 0/12 failures** (pre-fix that
was 12/12). This also shipped FB-002's web half and the token/gate sync, so the live site's dark
inks and the Bench's default list changed as expected.

### ✅ The editor now asks before it withdraws (`0679ccc7`)

Richard ruled for the confirm step. `DialogLayerModel.showConfirm`, not `window.confirm` — the
layer is created once in `router.tsx` for **both** routes, so one implementation covers the panel
and the launcher tab. Driven on **both**: click Delete → dialog, **0 requests**; Cancel → thread
still in the database and the verb back to `Delete`; Confirm → **exactly one DELETE**, back on the
list, **0 orphan posts**.

- 🔴 **`editPending` moved into the request path, not the click** — setting it when the dialog
  opens leaves the pane spinning forever on a cancel, which is the *common* case.
- 🔴 **`deleteNow` must be declared BEFORE `onDelete`** — a dependency array is evaluated on every
  render, so the other order throws `Cannot access 'deleteNow' before initialization` on first draw.
- 🔴 **A HAND-ROLLED CDP CLICK REPORTED SUCCESS AND DID NOTHING.** `Input.dispatchMouseEvent` over
  a fresh WebSocket, at coordinates that hit-tested correctly, on a button whose React `onClick`
  was verifiably the new code — nothing happened, twice. **`npm run cdp -- click` worked first
  time.** ⚠️ Use the harness's `click`; tag the target with a `data-*` attribute when the selector
  is not unique. The near-miss: this looked exactly like "my code does not run".
- ✅ **The control that cracked it** was firing `showConfirm` directly through webpack's require —
  it rendered, which ruled out the dialog layer and pointed at click delivery.

## First moves, in order

1. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
2. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
3. ⚠️ **AC4's unchecked remainder from FB-023.** Every raw Date read on a Drizzle-touched client
   returned a string, including the homepage's and tutorials pages' own module-scope pools. Five
   pages rendered **byte-identical** pre/post fix, so the consequence was nil — but that bound is
   **five pages, signed out, one seed**. A signed-in render and the org pages are unchecked.
4. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Gates, this tree

- Community suite: **55 files / 1321 specs / 0 failures** (s9: 54/1313 ⇒ +1/+8, the FB-023 file).
  `npm run typecheck` clean.
- Editor `tests-unit`: **292 suites / 4763 specs / 0 failures** (s10: 292/4759 ⇒ +4, the confirm
  rows). `typecheck:editor` clean.
- `test:ci` **not re-run this session** — last known floor is session 8's (4 AIX-006 failures, a
  strict subset of 08-19's 10). 🔴 **Re-measure rather than quoting this.**

## Driving, session 11's additions

- **For pool questions you do not need the editor**: two curl arms against a built server separate
  it. 🔴 **Each arm needs a FRESH SERVER** — the pool is process-wide and one arm's reads inoculate
  the next.
- Databases exist: `nodegx_community_fb023drive` (migrated + seeded) and `…_fb023spec`.
- 🔴 **To patch `fetch` before the app's clients capture it**, use CDP
  `Page.addScriptToEvaluateOnNewDocument` + `Page.reload`. Patching after boot does **nothing** —
  `CommunityApiClient` binds `globalThis.fetch` in its constructor, and the panel silently keeps
  talking to the **live** site. ⚠️ That is the dangerous failure: check `__fb023log` is non-empty
  and the data is local **before** clicking anything destructive.
- ✅ Back up `~/Library/Application Support/NodeGX/nodegx.community.session.json` (Richard's real
  live credential) even when you do not intend to touch it; swapping the bearer in the fetch patch
  is what makes touching it unnecessary. Verified unchanged by md5 afterwards.
- ⚠️ `lsof -ti :3200 -sTCP:LISTEN` to kill a server; **never the bare form**, which matches clients.
- ⚠️ An empty element's `innerText` is `''`, so `el.innerText || '(none)'` reports `(none)` for a
  layer that **exists and is empty** — that cost a wrong conclusion about the dialog layer.

**State as of 2026-08-23 (session 10).** Session 10 did **one** thing and it took the whole
session: it **drove FB-001 on both surfaces**. The verbs work. The drive also found a platform
defect that blocked it for most of the session and that is now **FB-023** — read that first,
because it is bigger than FB-001.

## What session 10 found

- ✅ **FB-001 — DRIVEN, BOTH SURFACES. The task is done.** Full tables in the task file.
  Web: the controls appear for the author and for nobody else (signed-out, non-author and
  somebody-else's-thread all draw **no `.post-controls` node at all**); Edit fetches the real
  **source**, saves, and the page comes back with the new body and an "edited" marker;
  Delete cancels cleanly, refuses an **answered** thread **in the server's own sentence**, and
  really removes an unanswered one (database: gone, **0 orphan posts**).
  Editor: the same three arms disagree the same way, and **the first editor bench WRITE ever
  driven** — composer pre-filled from source, saved, `updated_at` stamped; then Delete, thread
  gone, pane back to the list by itself. ⚠️ **NAT-012 AC4's other half is closed by this too.**
- 🔴 **FB-023 — THE PLATFORM STOPS BEING ABLE TO READ A DATE, AND SAYS IT IS YOUR POST'S FAULT.**
  New task file, **open, not fixed**. Once the panel has called `/api/v1/community/home`, the
  shared `apiSql()` pool reads `timestamptz` as a **string**. Thread reads **500 (13 of 20
  measured)**; and the write path does not crash — a perfectly good edit comes back
  **`400 "that could not be posted"`**. A 500 announces itself; this one **blames the user**,
  who would rewrite their text forever.
  - 🔴 **Why nothing caught it: the two immune populations are the two we always measure.** The
    web uses a fresh `createSql()` per request; the suite uses `freshDb()` + `resetApiSql()`.
    **Only the editor** mixes `/community/home` and `/bench/threads/:id` on one long-lived pool.
  - ✅ **The control that cracked it**: driving the **web page and the API route against the
    SAME thread**. Page 200, route 500, same row — which ruled out the data and named the pool.
  - ⚠️ **The mechanism is UNDER-CLAIMED in the file on purpose.** An early "connections born
    under drizzle" model was **disproved** by a `max=1` run. What is solid: drizzle on the shared
    pool is what does it, and giving drizzle its own pool clears **both** symptoms (measured,
    then reverted — the repo is clean).
- 🔴 **A DRIVE ARM READ CORRECT AND WAS VACUOUS, AND ONLY A LOAD SIGNAL CAUGHT IT.** The first
  pass read *"somebody else's thread → no Edit, no Delete — correct"*. The pane was actually on
  its **error arm**: no verbs because there was **no thread**. A failed read and a correctly
  verb-less post are **identical** in `hasEdit: false`. ✅ Every row of the editor table now
  carries a `loaded` column, and the rows mean nothing without it. Same family as session 8's
  `[data-panel-id]` lesson, one layer up: **ask what ELSE produces this reading.**
- ⚠️ **Found by driving, owned by nobody: the editor DELETES WITHOUT ASKING.** The web calls
  `window.confirm` first; `useCommunityThread.ts:373` fires the DELETE on click. D7 declined a
  soft delete, so the row really goes and takes its posts. Verb parity (D15) holds; **the
  safeguard is not mirrored**, and no spec could catch it — `editFor` grades which verbs are
  *offered*, never what happens between the click and the request. 🧭 **Richard's call.**
- ⚠️ **I nearly filed a harness artifact as a product bug.** The first 500 came right after I
  re-seeded *underneath a running server* — the documented stale-pool trap. Restarting "fixed"
  it, which **fitted** and would have closed the investigation; the next thread failed anyway.
  🔴 **A reading that FITS is not one that EXCLUDES** — the restart only ever tested thread A.

### FB-001's first move next session

**None — it is done.** What is left from this drive is **FB-023**, and the confirm-step ruling.

## First moves, in order

1. 🔴 **FB-023** — the defect above. It is live on every editor that opens the Community panel.
   Pick a fix (the file lists four; #1 and #2 are the real candidates) and note **AC3's trap**:
   a `freshDb()` spec **cannot reproduce this**, which is exactly why it survived. ⚠️ And AC2's
   arm — "not 500" would pass on the **400** that makes this worth fixing.
2. 🧭 **The confirm-step ruling** — does the editor's Delete grow a confirmation, or is the
   asymmetry with the web recorded as chosen?
3. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
4. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## How to drive the community platform (session 10's harness — reuse it)

- **Its own database**, so a suite run cannot wipe it and it cannot wipe a suite:
  `DATABASE_URL=postgres://nodegx:nodegx@localhost:55432/nodegx_community_fb001drive`.
  🔴 **Re-seed BEFORE starting the server, never underneath a running one** — dropping the schema
  under a live pool is the stale-OID trap and it reads as a product 500.
- `npm run build` then `npx next start -p 3200`.
- **The editor against it**: patch `window.fetch` in the renderer to rewrite
  `https://community.nodegx.io` → `http://localhost:3200` **and swap the bearer**. 🔴 Swapping the
  header is what makes it unnecessary to touch
  `~/Library/Application Support/NodeGX/nodegx.community.session.json`, which holds **Richard's
  real live credential** for the real site. Back it up anyway. ⚠️ The patch survives the
  launcher→editor transition, and clients capture `fetch` at construction, so **patch before the
  panel mounts**.
- Sessions are minted by inserting a `sessions` row with `hashSessionToken(token)`.
- ⚠️ `window.confirm` **blocks** the evaluate that clicked it — fire the click without awaiting
  and answer `Page.javascriptDialogOpening`.

**State as of 2026-08-23 (session 9).** Session 9 committed session 8's uncommitted AC7 work
(`9902bf61`) and then built **FB-001** end to end — both surfaces, on Richard's ruling. Nothing
is driven. Read *"What session 9 found"*, then session 8's notes, which still stand.

## What session 9 found

- ✅ **FB-001 — BUILT, BOTH SURFACES, UNDRIVEN.** Platform **`080a4f1`** in `nodegx-community`,
  editor **`e3c52fbe`** here. Full detail is in the task file; the findings worth carrying:
- 🔴 **A BAN DID NOT REACH THE NEW EDIT VERB, AND NOTHING ABOVE THE DATABASE WOULD HAVE.**
  `bench_posts_author_eligible` is **`BEFORE INSERT`** — complete for as long as a post could
  only be created. `communityGate` refuses D15's `absent` (a school switch, not a ban), and
  `serveCommunityWrite`'s capability check reads `communityVisibility`, whose viewer kinds are
  anonymous / individual / org_minor — **a banned account is an `individual` holding every write
  capability**. Shipping the edit verb without migration `0018` would have turned a ban from
  *"you may not post"* into *"you may not post anything NEW"*.
  - 🔴 **And the obvious fix inverted the rule.** A plain `BEFORE UPDATE` gate refuses
    `upholdReport`'s hide, making a banned account's posts **the only ones a moderator cannot
    hide**. `when (new.body is distinct from old.body)` is the whole guard. ✅ The spec row that
    catches a "simplification" is *"a moderator can still hide a banned account's post"*.
  - ✅ **The general shape: WHEN YOU ADD THE FIRST WRITE OF A NEW KIND TO A TABLE, ASK WHICH
    TRIGGERS FIRE ON IT.** Every rule that table has was written when only one verb existed.
- 🔴 **`api-malformed-id.test.ts` HAD A HOLE SHAPED LIKE THE TASK.** It discovered routes by their
  `[…Id]` segments and drove only **`GET` and `POST`** — so a `PATCH`-only route was discovered,
  driven **zero** times, and passed. The non-vacuity floor (`driven >= 9`) is met by the GETs
  alone, so the count could not catch it. ✅ Widened to four verbs **and given a row asserting the
  ARM** — at least one route of each mutating verb in scope — because narrowing `VERBS` back
  would otherwise go quiet rather than red. Mutation-verified both ways.
- ⚠️ **`/api/v1/me` NESTS THE HANDLE UNDER `viewer`, AND READING IT FLAT FAILS SILENTLY.** The
  first web control read `body.handle`; `undefined === handle` is false, so the buttons simply
  never appeared and nothing threw. ✅ Caught by reading the ROUTE, not the component — and pinned
  by a spec asserting **both** halves (`viewer.handle` is it, **and there is no top-level one**).
- ✅ **Richard ruled scope 3: the editor gets the SAME verbs**, not a browser hand-off. The
  argument that decided it: the editor already asks, answers and accepts, so the complaint
  reproduced inside it exactly.
- ⚠️ **`expect(v, msg)` is vitest-only** — it cost a jest suite that failed *to run* rather than
  failing. Same trap the memory index carries; it bites in `tests-unit`, not in the community repo.

- ⚠️ **`uni023`'s "no client island" claim was an EXACT LIST OF ONE, and FB-001 made it two.**
  ✅ Kept exact and given **a reason per entry** rather than relaxed to `toContain` — widening
  it would have retired the rule instead of restating it. ✅ **And the arm that replaces the
  count**: `PostControls` renders **nothing** in a static render, so the read path is
  byte-for-byte unchanged. Mutation-verified (`useState(true)` ⇒ that row alone goes red).
  The real rule is *reading never asks for anything*; an exact count was a cheap proxy for it.

### FB-001's first move next session

🔴 **DRIVE IT — neither surface has been.** 34 platform rows and 18 editor rows are green and
this phase's standing lesson is that a spec asserting a mechanism passes on dead code.
⚠️ **The editor drive and NAT-012 AC4's other half are ONE drive**, not two: both need a
signed-in editor against the live platform. Undriven specifically: the web `PostControls`
(`/me` fetch → source fetch → save → `confirm` + delete + redirect), and the editor pane placing
the verbs at all.

**State as of 2026-08-23 (session 8).** Session 8 built and drove **NAT-012 AC7** — the rail icon
for a D15-refused viewer. The predicted hole was real, and the drive found a **second** one nobody
had predicted. Read *"What session 8 found"*, then session 7's notes, which still stand.

## What session 8 found

- ✅ **NAT-012 AC7 — BUILT AND DRIVEN, both viewer states, they disagree on every row.**
  Registration in `router.setup.ts` stays synchronous and unconditional; a gate
  (`utils/community/communityRailGate.ts`) resolves `/api/v1/me` and **unregisters afterwards**.
  That choice came straight out of the task's own trap: making one of eleven registrations late is
  a change to everybody's boot, and this way nothing waits on the network.
  - `mirrorview.ts` gained **`refusesCommunitySurface(me)`** and `composeMirror` now calls it —
    one reading of D15 for two consumers (the panel's contents, the panel's existence).
  - ⚠️ **Signed out is never refused**: `/api/v1/me` answers 401 → `unauthenticated` with no
    token, never `absent`. That is what makes a gate safe to install at all.
  - 🔴 **No re-register, deliberately.** Inside a mounted editor the session can only go
    signed-out → signed-in — `signOutOfCommunity`'s only caller is on the **launcher**, which AC3
    established closes the project. If an in-editor sign-out is ever added, this fails quietly;
    the note is in the module.
- 🔴 **THE REMOVAL LEAKED IN THREE PLACES AND ONLY TWO WERE PREDICTED.** The 08-22 table was
  right that a naive `items.splice` leaves the panel drawing. It was not the end of it:

  | # | where | kept | found by |
  |---|---|---|---|
  | 1 | `SidebarModel.items` | the rail icon | predicted |
  | 2 | `SidebarModel.panels[id]` + `activeId` | the constructed, active panel | predicted |
  | 3 | 🔴 **`SidePanel`'s own React state** | the **mounted** panel | **DRIVING** |

  `SidePanel` renders every panel it has ever opened and hides the rest with `display: none`, and
  had **no removal path at all** — nothing could be unregistered before, so nothing ever needed
  one. `views/SidePanel/prunePanels.ts` is the fix.
- 🔴 **And the third leak looked CORRECT, which is why it is the one worth remembering.** With
  the model unregistered the mounted panel rendered *empty* — but only because `CommunityPanel`
  asks D15 itself and returns `null`. The surface's absence was resting on the **second** reading
  of the refusal; change that self-mask and a refused viewer gets the whole surface back with no
  icon, every rail-shaped test still green. Meanwhile the mounted panel kept `useCommunityMirror`
  polling three endpoints **once a minute** for a viewer told the community does not exist.
  ⚠️ **The measurement that nearly missed it read innerText.** An empty panel and an absent one
  are identical in text and opposite in meaning — **read `[data-panel-id]`**.
- ✅ **The naive fix was re-run LIVE as a control**, against the same drawing panel: rail icon
  **absent**, `getPanelComponent` **true**, `activeId` still **`community`**, panel still
  **drawing**. So the 08-22 table reproduces, and the instrument can tell the two fixes apart
  rather than passing on either.
- ⚠️ **`uni-001`'s session-reader gate caught the new reader and made it answer for itself.**
  That gate works — it went red on a module it had never seen, and the row was only added after
  the question ("what does this read withhold?") was answered. Answer: nothing; it is the clearest
  case in that table of an account making the editor do **less**.
- ⚠️ **Not driven**: the *install-time* refusal from a cold boot (persisting a fetch patch across
  a reload). `resolveCommunityRail()` — the exact function bootstrap calls — was driven in both
  states; the cold-boot refusal is covered by spec only.

**State as of 2026-08-22 (session 7).** Session 7 did **one** thing: it drove NAT-012's AC3, and
the drive deleted half the mechanism AC3 shipped with (`f50efe73`). Read *"What session 7 found"*
below before touching NAT-012, then the session-6 notes, which still stand.

## What session 7 found

- ✅ **NAT-012 AC3 — DRIVEN, and it passes.** Fixture `nat012-drive` (a copy of `fix012-drive`,
  two components `/App` + `/Probe`, registered in the launcher). Door label reads *"Community home
  — closes your project"*; `ProjectModel.instance` goes **`undefined`**; the launcher lands on
  **Community**; reopening puts the canvas back on `/Probe`. The narrowing is confirmed live too —
  the panel draws Discussions + Tutorials + the two buttons, and People/Guides/Replays/health are
  on the launcher page.
- 🔴 **But the restore was never ours, and the code written for it was DEAD.** The control that
  broke it: the *ordinary* exit ("Back to projects") also came back on `/Probe`. Three arms —
  steal the stash (`/Probe` anyway), clear `selectedComponentName` instead (`/App`), and an
  instrumented `switchToComponent` — showed **two calls on every open**: `restoreEditorPlace` →
  the stashed name, then **`useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`) → the
  default, unconditionally, later**. The second always won.
  - The restore AC3 promises is **`EditorDocument.tsx:401/432`**, which predates the task: same
    `ProjectModel.id` key, same `getComponentWithName`, same `replaceHistory: true`, and
    **persisted to `editorSettings.json`** — so it survives a restart and covers *every* exit
    route, not just this door.
  - `rememberEditorPlace` / `takeEditorPlace` / `restoreEditorPlace` are **deleted**; the landing
    half stays and is load-bearing. Re-driven after the deletion: unchanged.
  - ⚠️ **Its spec asserted the source text `restoreEditorPlace(currentInstance);` was present.**
    It was, and it meant nothing. Replaced with an absence row + an `EditorDocument` pin, both
    mutation-checked, beside a **new known-firing arm** (the old one only covered the panel file).
- 🔴 **AC7 has a hole shaped like the defect, measured before anything was built.**
  `SidebarModel` already has a removal path (the experimental toggle): splice `items`, notify.
  Run against a live *active* Community panel it leaves `activeId === 'community'`,
  `panels['community']` registered, and **the panel still drawing** — icon gone, surface present,
  the inverse of D15. The fix is three things (splice, `delete panels[id]`, switch away to
  `components`), and **the drive must read the PANEL, not the rail**. Full table in NAT-012 AC7.
- ⚠️ **Two things noticed, owned by nobody.** The launcher's recents file has a **duplicate project
  id** (`692d3658…` shared by `tut001-drive` and `Puppy test 3`), which React warns about on every
  launcher render. And the first `dev:debug` of the session died on *"Noodl is already running"*
  with no editor process on the machine — a transient single-instance race; the relaunch was clean.

**State as of 2026-08-22 (session 6).** The D6 tranche is **shipped**: FB-006's launcher
restructure (`5d31a567`), NAT-012's AC4 (`39404361`), and now **NAT-012's AC2 audit, AC3 and the
editor narrowing** (`e17ee460`). Both of session 5's open rulings came back. Read `TASKS.md`
first; it carries the measurements you must not re-derive.

## What changed this session

- ✅ **Bench vs Discussions — RULED, and the question was better than the answer expected.**
  Richard asked whether a rename was quietly merging the bench with the **chat** he commissioned
  (FB-013). It was not, and the check is on disk: *"Discussions"* was only ever a heading over
  `view.threads`; those threads are `bench_threads` from `/api/v1/bench/threads`, opened at
  `community.nodegx.io/bench/<id>`; UNI-011 coined the word for exactly that list; the web has
  **no `/discussions` route**. 🔴 **Chat is the argument FOR "Bench"** — FB-013 arrives as its own
  tab in the same table, and a chat feed is more literally a *discussion* than an answered-state
  Q&A is, so keeping "Bench" leaves the word free for the surface that will want it. Reasoning
  lives in `communityTabs.ts`'s module note; the label is still one table row.
- ✅ **NAT-012 AC3 — RULED: accept the close, label it honestly.** Richard took option (2), so the
  dispose branch in `router.tsx` is untouched. The door reads **"Community home — closes your
  project"**, and reopening restores the component you were on.
  - `utils/launcher/launcherHandoff.ts` — the two facts (landing page, place-per-project),
    **module state, consumed on read**. 🔴 Not `localStorage`: a landing read off disk at startup
    is FIX-025's defect rebuilt, and opening a project already writes three files without a fourth.
  - `utils/launcher/leaveForLauncher.ts` — the gesture. 🔴 **Both reads happen BEFORE
    `exitProject`**, which notifies `'exitEditor'` synchronously and disposes everything; that
    order is asserted as order.
  - ⚠️ **The place is keyed by NAME**, because the reopened project is a different `ProjectModel`
    with different `ComponentModel` objects — `componentInstanceId`'s WeakMap cannot answer this.
    A rename while you are away therefore **misses, and draws nothing**, which is correct: a guess
    that looked like a restore would be worse.
- ✅ **The editor narrowing.** `CommunityPanel` drew seven things; it now draws what passes *"is
  this about the project on the canvas?"* — Discussions, the thread pane, the profile pane, and
  TUT-004's installable tutorials. People / Guides / Replays / the health readout went to the
  launcher, which already draws all four. `openCommunity` **lost its `path` parameter** with the
  rows that jumped to Chrome silently.
- 🔴 **Two live task files revised, named in the diff**: NAT-008 AC1's **rail half is withdrawn**
  (AC2's profile pane stays — you reach it from an author line that is still drawn); NAT-005's
  **panel** loses two sections while its components and vocabulary are untouched.
- 🔴 **uni-001's AC4 rows were REPOINTED, not shortened.** Two anchors vanished and `isGated`
  **threw** rather than passing blind — which is the only reason it was caught. The claim follows
  the sections to the launcher page, **with a mutation arm**: that file has no viewer conditional
  at all, so three bare `false`s would have proved nothing.

## First moves, in order

1. ~~Drive NAT-012's AC3~~ — ✅ session 7. ~~NAT-012 AC7~~ — ✅ **session 8**.
   ⚠️ **AC4's other half is still open**: posting a real question to the live Bench from a
   signed-in editor. Richard's call.
2. ~~**FB-001** build~~ — ✅ session 9. ~~**the drive**~~ — ✅ **session 10, both surfaces**, and
   it closed NAT-012 AC4's other half with it.
3. **FB-019 implementation** — the sweep already revised AC1/AC2: keep the merge, fix only the
   no-stored-unit case, on **all three** registration paths. 🔴 **Drive an image-cropper pan
   first** — the six broken connections are predicted from source and nobody has watched one fail.
4. **Quick wins with no rulings**: FB-007, FB-010, FB-003 — the build-the-caller family.
5. **Still needing Richard**: FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod
   `ANTHROPIC_API_KEY` (⚠️ intro pricing ends **2026-08-31** — eight days), the 15 lessons' prose,
   Discord's row in the `?` menu, `/rfps` search.

## Standing traps for this phase

- 🔴 **THE FILED DIAGNOSIS HAS NOW BEEN WRONG FIVE TIMES RUNNING** — FB-020, `uni022` AC4, FB-019,
  NAT-012 AC3, and now **NAT-012 AC3's own implementation**, which is the new shape: the task file
  was right that AC3 needed a restore, the ruling was right, and the code built for it was
  **dead on arrival** because nobody checked whether the editor already did it. 🔴 **Before
  building a mechanism, grep for the one that already exists** — `selectedComponentName` was one
  `grep -rn` away from the task file the whole time. **Read the code a task file points at before believing what it says about it.**
  🆕 **And the same applies to a task file's own AC wording**: NAT-012 AC3 asked for a persistence
  the router does not offer, so it was *rewritten to the ruling* rather than left as a bar nothing
  would ever clear.
- 🔴 **AN EMPTY SURFACE AND AN ABSENT ONE ARE IDENTICAL IN TEXT AND OPPOSITE IN MEANING.**
  Session 8's near-miss: a refused viewer's Community panel was read as gone because its text was
  empty, when in fact it was **mounted and polling** — it drew nothing only because the component
  self-masks. ✅ **Read the structural marker (`[data-panel-id]`), never innerText**, and when a
  thing is supposed to be gone, ask *gone from what* — the model, the rail, the DOM, or the React
  tree are four different populations and this defect lived in the fourth.
- 🔴 **A SECOND READING OF A REFUSAL IS A FIX WAITING TO LAND ON ONE OF THEM.** `mirrorview.ts`
  warned about this in its own header and it is what made AC7's third leak dangerous rather than
  merely untidy. When two layers must obey one policy, **export the predicate** and let both call
  it — AC7 did, with `refusesCommunitySurface`.
- 🔴 **A narrowing shrinks a checker's population silently.** When an anchor disappears, the fix is
  to **follow the subject**, not delete the row — a claim whose population quietly shrank is how a
  gate goes quiet without going red. ⚠️ And when you repoint it to a new file, **prove the checker
  can fire there**: `Community.tsx` has no viewer conditional, so every absence read `false`
  vacuously until a mutation arm was added.
- 🔴 **A shared component's spec is a hostage** (FB-006's `TabStrip`). Before reaching for a
  stateful component in a graded tree, check whether `tests-unit`'s walker can evaluate it.
- 🔴 **A SPEC THAT ASSERTS A CALL EXISTS PASSES ON DEAD CODE.** `expect(src).toContain('foo(x);')`
  is a mechanism check, and NAT-012 AC3 is the case where the mechanism was present, correct, and
  overwritten by a later effect on every single run. The drive is the only thing that could tell
  the difference. When the subject is *"does this produce an outcome"*, the arm is: **starve every
  other candidate and see whether the outcome survives.**
- 🔴 **Revert the fix and count the reds** (still the rule). NAT-012: reverting the panel turns
  **11 of 20** rows red; mutating **only** the door's label turns exactly **1** — worth knowing
  separately, because a silent door is the failure that would otherwise look like a feature.
- ⚠️ **Borders are stored per side** — `borderTopColor`, never the shorthand.
- ⚠️ **`scroll-behavior: smooth` makes a same-eval `scrollTop` read lie**, and toward the bug.
- ⚠️ **The launcher's recents file is a real user file the running editor owns** — write it only
  while the editor is idle on the launcher, then reload.
- ✅ **Community suite, 2026-08-23 (session 9 tree, after `npm run build`): 54 files / 1313
  specs, 0 failures.** ⚠️ The real-HTTP `uni015-bench-http` file **ran** (8 tests) rather than
  self-skipping, which is what the build buys. Editor `tests-unit`: **292 / 4759 / 0** — +1
  suite / +18 specs on session 8's 291 / 4741, both `fb-001/editverbs.test.ts`.
- ✅ **`test:ci` 2026-08-23 (session 8 tree): 2849 specs, **4** failures — all `AIX-006 style
  vocabulary`.** Ran alone, completed (2849 spec-starts, the full count); ⚠️ **exit was 1, which
  is what the clean floor does too** — the reading is the failure *names*. Compared by name against
  08-19's 10-failure floor: this is a strict **subset** of it (the 4 AIX-006 rows). The other six —
  2× AI model registry, 1× AIX-011, 3× SUB-011 expression params — **passed this run**, which is
  the order-dependence the seed note warns about, not a fix. **Nothing new, and nothing in the
  sidebar / panel / community area.** ⚠️ The log carries ~6,700 `10000 listeners` warnings from the
  legacy `shared/model.js`; pre-existing and unrelated.
- **Editor `tests-unit`, 2026-08-23 (session 8 tree): 291 suites / 4741 specs, 0 failures.**
  Reconciles exactly against session 7's 290 / 4720: **+1 suite / +21 specs**, both
  `nat-012/community-rail-gate.test.ts`. ⚠️ **That is `tests-unit` ALONE.** `npx jest -c
  jest.config.js` with no path also runs `tests-main` and reports **310 / 5005** — the difference
  is a stable **19 suites / 264 specs**, which is the number to reconcile against, not the older
  `308 / 4987` (that was taken when `tests-unit` was 289 / 4723). `typecheck:editor` and
  `typecheck:editor-tests` both 0; `typecheck:core-ui` reports **44 pre-existing `TS2307`**,
  unchanged and not yours. Compare **by name**, and re-measure rather than quoting this.
- ⚠️ **Two community commits are still unshipped**: `9ecec25` (tokens + gates) and `fd695ae`
  (FB-002's web half). nexus-1 is still `8d40b63`. Deploying changes the live site's dark inks and
  the Bench's default list — **Richard's call, ask before deploying.**
- Platform: `npm run build` first; Postgres 55432; four derived-from-disk gates plus the `/v1`
  envelope contract fire on any new route or column.
- ⚠️ **A peer was blitzing phase 65 in this checkout on 2026-08-22** (library/**, scripts/library,
  noodl-mcp, import-engine) and had `library/modules/*` deletions staged. `NAT-011` still carries
  an uncommitted AC7 beside older uncommitted edits, and phase-65/70/71 are untracked — somebody
  else's work; check before sweeping any of it into a commit.
- Shared checkout: **commit by pathspec, never stage**; `git log -5 -- <path>` before overwriting
  a shared file; never `git stash`.

## Drive fixtures on disk

`fb020-drive` and `fb020b-drive` (A bare, B author checked-state, C Enable Icon off, D bare radio
group, E author fill colour — B, C and E are the regression arms). Both are in the launcher's
recent list. **FB-019 will want a new one**: a Group with a never-set Width fed a bare number, plus
a sibling whose Width *is* set — the population-A control that must not change.
✅ **`nat012-drive`** now exists (a copy of `fix012-drive`; `/App` + `/Probe`, fresh project id,
registered in the launcher) — that is the two-component fixture AC3 needed, and AC7's drive can
reuse it.

⚠️ **Driving this editor from CDP: there is no editor global, but webpack's require is reachable.**
`window.webpackChunknoodl_editor.push([[Math.random()],{},(r)=>{req=r}])` hands back
`__webpack_require__`, and `req('./src/editor/src/models/projectmodel.ts')` &c. give the app's own
module instances. 🔴 **Check `req.c[id]` first** — a module that is not already instantiated gets a
*fresh* copy, and you would be reading state the app does not share. Patching a prototype method
(`NodeGraphEditor.prototype.switchToComponent`) to record call stacks is what named the overwriter
in AC3, and is the cheapest way to answer "who actually did this".

## End every session

Update this file and memory (`phase-75-0-2-1-the-feedback.md` + its MEMORY.md pointer).
