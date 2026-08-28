# Phase 75 — task list

Status legend: ⬜ open · 🟡 partial · ✅ done · 🔒 blocked on a ruling · 🧭 needs Richard

## Tier 0 — verify, then quick wins (no rulings needed)

- ✅ **T0** — 2026-08-22: nexus-1 is stamped `8d40b63d9bd48b45e209e7d1e18f8da222f969de`, branch
  `main`, `dirty: false`, deployed 2026-08-21T09:25:41Z. That **matches local `main`**, so the
  `0cbd716` handover was stale and **no deploy is needed**. `community.nodegx.io` and
  `nodegx.io` both 200. ⚠️ The mail-drain refusal is therefore still ahead of us, not behind.
- ✅ **FB-008** — the community link in the editor's ?-menu (S)
- ✅ **FB-004** — the Learning tab in two tabs; path stops eating the page (S) — ✅ **driven
  08-22**: shelf first with no scrolling, path one click away, and the `overflow: hidden` clipping
  worry disproved by measurement (a 1400px probe scrolls, nothing cut). ⚠️ Tab buttons carry no
  `aria-selected` — unowned.
- ✅ **FB-002** — [the answered question that won't leave](FB-002-THE-ANSWERED-QUESTION-THAT-WONT-LEAVE.md) — **DONE. AC1–AC4; web half 2026-08-22, editor half built, gated and DRIVEN 2026-08-25** (`6eaa6655`). Both surfaces open on *waiting*, `Solved` one click away, counts produced by the same call that produced the rows. ⚠️ **This line said `🟡 editor mirror open` until 2026-08-26** — a day after the commit — and was corrected from the task file and the commit, not from memory. **Second time in this index**, three lines below FB-010's identical note. 🔴 **The drive nearly reported a working filter as broken**: the two live threads are **indistinguishable by rendered row text** — same title, and *both* say "no reply yet" because `firstReplyMinutes` is null on the **accepted** one too — so the pill flipped and the row appeared not to change. Settled by reading the React **key**, which carries `thread.id`; `solved` → `de14371e…`, `waiting` → `2abd111a…`. ✅ **When rendered text can collide, assert on identity, not on what is painted.** 🔴 **Found by driving, owned by nobody: the selected pill is 1.16:1** against the panel (fill), 1.24:1 between active and inactive label, and the border is **identical** in both states — so *which* filter is on is invisible, while every individual label passes AA at 7.9–8.5:1. **State visibility is not text contrast.** It is NAT-008's **shared** `.FilterPill`, untouched here, so the people directory has the same defect; cheapest fix is the **border** (already 3.57:1), measured in both themes. ✅ **FIXED AND DRIVEN 2026-08-27 (s58)** — the state moved to the **border and a `✓`**, in one shared `CommunityFilterPill` component that all three surfaces now draw. Painted, both themes: active border **5.60:1** dark / **4.57:1** light vs the card, **4.13 / 3.74** vs its own fill; the fill is still 1.36 and is no longer load-bearing. 5 mutants killed. ✅ **The separate `--theme-color-border-default` finding is FIXED for this shelf, s60, and it was NOT Richard's** — see [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). 🔴 **The token was never the thing to change**: `border-default` is a DIVIDER tone that `colors.css` says twice is supposed to be invisible, and raising it restages the NAT-003 regression across 376 declarations and reds VFN-002's c3 negative control by construction. The token for a control boundary already existed — `--theme-color-border-control` (POL-016), ≥3:1 on bg-0/1/2/3 in **both** themes. ⬜ **60 more control sites still wear the divider token, and 60 is a FLOOR** — the query needs `cursor: pointer`, so it misses native inputs; it missed `.TemplateFilter-search`, which was part of this very defect. ⚠️ Unowned platform defect: `firstReplyMinutes: null` on a thread with `replyCount: 1`.

## Tier 1 — the build-the-caller family (machinery exists, nobody can reach it)

- ✅ **FB-007** — [the editor uploads the capture it already takes](FB-007-THE-SCREENSHOT-NOBODY-UPLOADS.md) — **DONE, DRIVEN over real HTTP 2026-08-24.** The 23rd *build the caller*, and the first where **every piece on both sides already worked**: E7's platform half was correct, deployed and configured (4/4 `HETZNER_S3_*` read off the host), and the bucket held **zero objects** under `attachments/captures/` — nothing had ever uploaded one. Now `uploadCapture` (the only method on the client that does not send JSON), `withCaptureImage`, and the composer doing **disk → upload → post**. 🔴 **Scope 2 RULED by Richard**: NAT-008's *"this editor fetches no remote image"* is reversed **narrowly** — capture images only, from `COMMUNITY_URL` only. `avatarUrl` stays declined because its reasoning rests on *"a URL a stranger put on their profile"*, and **every clause of that is false here**; a hostile spec row proves an `image.key` of `https://evil.example/x.png` still yields our own URL. 🔴 Found: **`Buffer.from(str,'base64')` is a view into Node's shared pool**, so `.buffer` uploads an 8 KB slab (mutation-confirmed); a **200 with no grant** must degrade rather than default one, because defaulting costs the whole post; and *"drag it into your post"* had **outlived its behaviour** — FB-010's shape, one task later. **26 specs, 8 mutations red**; the full suite then caught `uni-016`'s builder guard, which was **tightened, not loosened**. ⚠️ Not driven in a browser; the composer's wiring is source-read as `uni-016` already records.
- ✅ **FB-010** — a settings page, so a profile can exist at all (M) — **DONE, DRIVEN 2026-08-23; DEPLOYED to nexus-1** (`eaa19c6`, verified live rather than by the deploy script alone: `41fe2749`). ⚠️ **This line said `⬜` until 2026-08-24 (session 18)** — the task file has read *"BUILT, SPECCED, DRIVEN"* since the 23rd and the deploy commit landed after it, so the index was the only place still claiming it was open. 🔴 A stale index line is worse than a missing one: it sends the next session to rebuild something that already shipped. Corrected from the task file and the commit, not from memory.
- ✅ **FB-003** — [become a coach / post an RFP: the two composers](FB-003-NOBODY-CAN-OFFER-OR-ASK.md) — **DONE, DRIVEN over real HTTP 2026-08-23** (`nodegx-community` `67df2b1`). Two POSTs on the routes that already served the GETs, plus one client island holding both composers — an API caller and **not** a server action, because AC1 is that a request posted on the web reaches the **editor's** NAT-009 client without either being redeployed. 🔴 **THE DRIVE FOUND WHAT THE FILE DID NOT: `coaching_offers.account_id` references `profiles`, not `accounts`** — so an account with **no profile cannot create an offer at all**, which is *every* account a real sign-up produces (`upsertProfile` has no caller — **that is FB-010**). It rendered as the generic *"that offer could not be created"* on the most likely path through the feature; now `[offer-needs-profile]`, a 403 naming the precondition. ⚠️ **The spec fixture had hidden it** — `makeUnlistedBuilder` creates a profile, so all sixteen green arms walked past the real case. ✅ Also fixed: `boardRefusalResponse`'s default said *"that **response** could not be sent"* to somebody posting a **request**. ✅ Also found, unreachable, recorded: **`[rfp-response-cap]` names two different failures**. ✅ **There is no rate band** — derived from the schema, per the task's own NAT-008 trap. **34 specs, 12 mutations all red**; suite **56/1360/0**. ⚠️ **AC4's editor half is open** — `POST_A_REQUEST_LINE` has **no UI consumer**, so there is no click to redirect; the web half (sign-in with `?next=`) is done. ~~⚠️ Not deployed.~~ ✅ **Almost certainly DEPLOYED — corrected 2026-08-24 (s18).** `67df2b1` is an **ancestor of `eaa19c6`** (verified locally with `git merge-base --is-ancestor`), and `eaa19c6` is the stamp session 17 read off nexus-1. ✅ **CONFIRMED DEPLOYED — the stamp was re-measured 2026-08-24 (s19)**, read off `49.12.102.195:/etc/nodegx-community/deployed.json` over SSH: `eaa19c6c…` on `main`, `dirty: false`. So s18's ancestry argument stands on a measured stamp rather than a relayed one. ⚠️ The box has since moved to `acd4a9a` (FB-011), which is a descendant of both.

## Tier 1c — Richard's 2026-08-27 batch (three reports, one message)

- ✅ **FB-025** — [the Run that read last time's value](FB-025-THE-RUN-THAT-READ-LAST-TIMES-VALUE.md)
  — **DONE, GATED and DRIVEN on the canvas 2026-08-27** (`27f16f8b`). 🔴 **The first drive attempt proved nothing, and that is the lesson**: authoring the `Run` connection before the value connection in `project.json` does **not** reproduce this — a project *loaded from disk* gets the value port's queue key first (`["workspace","generatedCode","x","run"]`) and is correct even on the unfixed runtime. Only Richard's build order **performed live** — unwire the value port, reload, type one character, wire it back into the running graph — makes the broken order `["workspace","generatedCode","run","x"]`. 🔴 **A general runtime ordering defect, not a Visual Function
  one.** `Node.update` drained per-port input queues in `Object.keys(_inputValuesQueue)` order —
  **insertion order of the keys**, created lazily on each port's first-ever delivery and never
  removed — so a `Run` pulsed once before its value port had ever been written kept its place at the
  head of every later drain **for the life of the node**, and the program ran on last frame's
  `Inputs`. ✅ **The repository already knew and had repaired it one node at a time**:
  `objectchanged.ts`'s `emptyToNull` exists only because of it (`NV-ii`), `nda-012` pins that
  `Signal To Index` is merely *masked* by "an accident of the node's `initialize`", and
  `CONTRACT.md` **C4 asserted the guarantee nothing implemented**. Now stated: a pending **value**
  is applied before a pending **signal**, then arrival order, and an emptied port lets go of its
  key. **C7 lockstep, C8 consolidation and `Delete` untouched.** 🔴 **Arrival order alone was wrong
  and `nodegx-core-parity` C4 is what proved it** — a value one hop upstream is pulled in by
  `_updateDependencies` *after* the signal was queued. 🔴 **`nda-012`'s mechanism row pinned the
  accident and was rewritten to pin the guarantee**, with an adversarial graph that is red on the
  old drain. Both 🔴 rows re-run against unfixed `node.ts`: red; control: green.
- ✅ **FB-026** — [the field that is not always text](FB-026-THE-FIELD-THAT-IS-NOT-ALWAYS-TEXT.md) —
  **DONE, GATED and DRIVEN 2026-08-27** (`26dcc51c`) — **both directions, through the property panel's own dropdown**, because a model write never re-renders that panel. Number: ports `number`, field publishes `5` as a `number`, wire `{healthy: true}`. Flipped back to Text: `{healthy: false}`, dashed, *"connects a **string** to a **number** port"*. ✅ **The flip is what makes the healthy reading evidence rather than a constant** — same wire, same instrument, opposite answers. Exactly one row named `Value` per plug, confirming the `getPorts` override at its own surface. 🧭 **The subject was ambiguous and Richard settled it**: the
  **Text Input**'s `Type` property, not the Visual Function's `Define input` TYPE dropdown (whose
  options are labelled exactly `any/string/number/…`, which is why it read as the other one).
  `event.target.value` is a string for **every** `<input>`, `type="number"` included, so Number
  really did publish `"5"` — **FIX-025's dashed wire was telling the truth**, and all three
  symptoms were that one defect. Now: one shared conversion with **four** callers
  (`textInputValue.ts`), empty → **`null` never `NaN`** (E3/E4; `NaN` would raise OBS-003 hops
  away), the field keeps the **raw string** so a half-typed `-`/`1.` survives, and the two ports are
  declared `'*'` and **narrowed per instance** from the parameter. 🔴 **New editor capability:
  a dynamic port now *replaces* a static one of the same name and plug** (`portOverrides.ts`) —
  before, they concatenated, and nothing collided only because every producer takes care not to.
  ✅ Richard's rename: `Text`→`Value`, `Text Changed`→`Value Changed`, **display names only**.
  🔴 **The catalog would have published a lie** (`runtime-discovered` ⇒ *"the static port list is
  incomplete"*, and `known: false`) — so `RETYPES_DECLARED_PORTS` was added and **the claim is
  driven and throws**, both branches, with an emptiness guard; **mutation-tested**.
  ⚠️ **`docs:nodes:check` read *clean* against a stale enriched catalog** — a green check on a
  stale input; `catalog:merge` first.
- ✅ **FB-027** — [copy without multi-select](FB-027-COPY-WITHOUT-MULTI-SELECT.md) — **DONE 08-27,
  GATED and DRIVEN 2026-08-27** (`c4ec2103`) — every gesture a **real input event** (a genuine right-click; `Ctrl` chords via `Input.dispatchKeyEvent` with focus emulation on the same connection), counted with `ws.getAllBlocks(false).length` before and after. Duplicate on a 4-block stack **+5** (the stack *and* the value block plugged into it); `Ctrl+X` **−4** — it removed what it copied; `Ctrl+X` on a **value** block **−1**, the `outputConnection` carve-out; `Delete` still **−1** and the stack heals. 🧭 **Ruled by Richard**: the multi-select plugin peers on `blockly >=11 <12`
  and this editor is on **12.3.1** (LGC-006's constraint, **re-checked against npm, not recalled**);
  no rollback, make the gesture that exists carry the group. 🔴 **The real defect was not only the
  missing selection**: `toCopyData(addNextBlocks = false)` **defaults to false** and all four
  Blockly call sites pass nothing, so Duplicate/Ctrl+C/Ctrl+X took the block and its inputs and left
  **the stack below it** behind — for a Visual Function, that is the whole program.
  🔴 **`MyBlocksSave.ts` had claimed the opposite since 08-12** (*"exactly as Blockly's own Duplicate
  behaves"*); corrected, and now true. `Delete` deliberately untouched. 🔴 **The doubles had a hole
  shaped like the defect**: `ShortcutRegistry.register` throws on an already-mapped key code
  (`allowOverrides` only silences the *name* warning), so the suite was green while the editor threw
  at startup — **`test:main` went to 5 suites / 90 tests red**. Fixed by `unregister` first, and the
  double now **refuses what Blockly refuses**, plus a row against the **real Blockly**.

## Tier 1b — the test-user batches (filed 08-22; no rulings needed)

- ✅ **FB-020** — the checkbox that cannot be checked (S/M) — **done 08-22, driven.** 🔴 The
  filed diagnosis was wrong: **the click always worked** (`input.checked`, `_internal.checked` and
  the `Checked` output all went true) — nothing *drew* a tick, because the real `<input>` is
  `opacity: 0`, no default icon source ships, and visual states apply only author-configured
  parameters. **No design-mode listener leak; no other control is implicated by it.** Fixed in
  `Checkbox.tsx` (default tick), `RadioButton.tsx` (AC4 — same defect, plus the dot was painted on
  every button in the group) and `checkbox.ts` (the `props.checked` desync). 14 specs, 6 of which
  go red on the unfixed code.
- ✅ **FB-019** — structured ports say what they take (was M/L, delivered S). **CLOSED 2026-08-23.**
  Three sessions of driving reduced it to a legibility task: **two of the three filed silent
  failures were fiction** (the cropper pans; a never-set Width renders), the third was real and was
  fixed (`be2921a5` — an icon port warns instead of drawing an empty span), and what survived was
  the asymmetry underneath the report — `300` into Padding Left is `300px`, into Width is `300%`,
  because `defaultUnit` differs per port. Scope (3) says so at the port, on both surfaces
  (`31f95a63`), driven. 🔴 **The editor had been saying it for years on every units port EXCEPT
  `dimension`** — i.e. except Width and Height, the two that were reported — and an absence
  assertion found a **third copy** of the same rule in the version-control conflict list with a
  `units[0]`-vs-`defaultUnit` defect as well. ⚠️ **Left open deliberately**: scope (5) (Jordan's
  aliasing report — variants and visual states unexamined), and a **latent** never-set failure on
  `Columns`' two breakpoint ports, which corrects session 12's closure of AC1 as "already ships".
- ✅ **FB-018** — [the binding chip everywhere; say which value wins](FB-018-THE-VALUE-THAT-WINS-IS-A-SECRET.md) — **DONE, DRIVEN in the real editor 2026-08-24 (s19).** Row classes chipping **5 → 16** of 36. ✅ **One seam, not ten components**: the ten non-`PropertyPanelInput` rows already wrapped themselves in `PropertyPanelRow`, so the chip went there and they each pass the connection down — four bespoke chip implementations would have been four more chances to drift, which is how this rollout reached five and stopped. 🔴 **`IconType` computed `isConnected` every render and never passed it**, so a connected icon showed no chip *and* not even the outline the other rows had. ⚠️ **The checkbox exclusion was narrowed deliberately** — a connected checkbox stayed clickable, the filed bug with a different control; `Button` stays out on a reason about the row (it stores no value). **AC2's sweep parses the dispatch chain out of `Ports.ts`, never from the table under test** — and has three kinds, because writing `exception` on a row that plainly *could* chip meets AC2's letter by lying: 16 chip, 3 structural exceptions, **17 `deferred`, named**. 🔴 **The pinned deferred list first computed itself from the table it constrains** — a derived list grows silently to match, so it is a literal now. 🔴 **The drive nearly reported wrong three times**: a selector that required a childless label (the reset dot IS a child, so the control arm read as *"no Width row"* — the property under test was in the predicate that found the element); two rows honestly unconnected because the fixture wired `source`/`icon` when the ports are `src`/`iconIconSource`, while `isPortConnected` still answered `true`; and a dead connection reader that said *"no connections"* for **all five nodes including the one visibly showing a chip**. **18 specs, 11 mutations all red**; typecheck proved to see these files by a planted error (2 → 0). Also new: `dev-docs/reference/PARAMETER-PRECEDENCE.md`. ⚠️ **Not deployed — editor-side, ships with the app.**
  claim (M)
- ✅ **FB-015** — [the empty box called Source](FB-015-THE-EMPTY-BOX-CALLED-SOURCE.md) — **DONE, DRIVEN in the real editor 2026-08-24 (s21). All five ACs.** The picker told an author with no images exactly what it told one whose loader had silently returned early: a blank panel. Four states now (items · *Looking…* · *nothing matches* · the empty state naming both routes), one shared component with per-type copy, and an **Import image…** that copies into `assets/` — created on demand — then reloads the list. 🔴 **The platform's `makeUniquePath` could not be used**: it appends after the extension, so `logo.png-1` would not appear in the picker that imported it. 🔴 **The drive found what 32 green specs could not — the Import button only existed while the picker was EMPTY**, so a second image could never be imported; every spec arm had rendered an empty picker. Actions are a permanent footer now. AC3's walk skips `node_modules` and dotfolders **by path segment** (DEP-008's `pre.gitlab-assets` lesson), which also fixes both halves of the import flow. 🔴 **AC4 was the big one: a port's `placeholder` crosses FIVE hand-written field lists between a node definition and the field, and FOUR were dropping it** — `nodedefinition.registerInput`, `InputPortMetadata`, `PropertyPanelInput` and `PropertyPanelTextInput`. ⚠️ **ERG-004 documented `formatPort` and only `formatPort`**, which runs third; each intermediate state read as *done* from the source and the drive is what separated them. **38 editor + 6 runtime specs, 21 mutations all red**; `test:main` **319/5137/0**, runtime **2560/0**, viewer **965/0**. ⚠️ **Not deployed — editor-side, ships with the app.**
- 🟢 **FB-017** — [basics-first panel + per-node view state](FB-017-THE-PANEL-THAT-SHOWS-EVERYTHING-FIRST.md) — **ALL SEVEN ACs CLOSED (s22–s25).** s22 `879f2f4c`:
  collapse revived, two tiers, badge, per-node scroll (a pre-existing defect — restore read the
  wrong element). s23 `7f8ca477`: the property filter (AC7), a search that never persists
  expansion, and a `position: sticky` that was inert. s24 `6d640c29`: the column width, where the
  filed "312 vs 346, shared sidebar layout, a session's work" turned out to be **the wrong noun** —
  the side panel has not moved since FIX-009; 312→346 was the content column overflowing its own
  scroller, and one `overflow: overlay` that had been dead since Chromium dropped it. **s25: AC4,
  the structural hint.** 🔴 **The named offender was the wrong way round** — hit-testing proved
  `border-radius` rounds an `<img>` with nothing clipping; what fails is a **container** whose
  children paint over its corners. Measured against the catalog: 14 node types round, 3 clip,
  **`Group` is the only overlap**, and `Button` has children with **no clip port at all** — so the
  message has two forms. 🔴 Two things would have shipped broken: the corner ports arrive inside a
  **nameless `TabGroup`** (a per-port wrapper draws nothing), and the panel **never re-renders on a
  parameter change**, so the note is applied in place on a seven-parameter watch list rather than by
  rebuilding rows under a focused field. 30 specs; driven over six nodes, both arms, both themes
  (8.71:1 / 5.09:1). **Left: only scope 2's `Source Set` demotion — Richard's call.**
  (L; revives STYLE-004's deferral)
- ✅ **FB-016** — box-model overlay, radius-following highlight, transform-origin crosshair: **CLOSED 2026-08-25**, all five scopes shipped and driven, AC1–AC4 met. Scope 4 landed in session 28 (the crosshair, its editor-side focus relay, and two wording/placement fixes the screenshot found)
  (M/L)
- ✅ **FB-021** — [gated ports render disabled with their reason](FB-021-THE-PORT-THAT-IS-SECRETLY-SWITCHED-OFF.md) — **SCOPES 1/3/4 DONE, DRIVEN 2026-08-25 (s30). AC1–AC4 met.** ✅ **SCOPE 2 + THE CANVAS BUILT s33, SCOPE 2 DRIVEN s34** — Richard ruled *"mark, do not hide"*, so a `basic`-gated port stays offered and is drawn inert with its reason. Both entry paths driven (no wire in flight, and with a source port picked), with a control that lifts the mark when `Size Mode` goes back. 🔴 **THE DRIVE FOUND A THIRD DEFECT, IN THE COMPOSITION**: mid-drag the folded block held 8 gated ports and one type-mismatched `Focus`, `dominantReason` answered `'other'` for the mixed set, and the summary read **"9 ports this wire can't reach"** — the precise sentence this task exists to prevent, produced by two individually-correct, individually-specced functions. Fixed with `partitionGated`: the two kinds never share a summary. ✅ **`refusalHeadline` IS NOW WIRED (s37)** — it had NO production caller: FB-021's headline branch and three pre-existing SIG-001 ones graded dead code, and the sentence users read came from `p.message` alone. `ConnectionBar` now derives it (in `refusalPlan.ts`, where a spec can reach the decision) and `DocsPopup` renders it above the detail. Driven, both branches, contrast measured in both themes. The older open question — should a `basic`-gated port stay wireable at all? The open design question — *stop splicing at `modelProxy` or mark the port* — is answered: **stop splicing**, but only for ports whose condition can be put into a sentence. `applyPortConditionsFilterForNode` stays the only thing that **decides**; `portGateReason.ts` only **narrates**, so the "don't fork a second source of truth" trap is structurally impossible rather than merely avoided. **338 of 349 gate-able ports explained**, 9 `#js` refused as a deliberate remainder, 2 refused that the real filter can never hide anyway (`icon.ts` passes `hideEnableIconInput: true`, so `useIcon NOT SET` is always true — graded with the real evaluator, not argued). 🔴 **349 is the count of gate-ABLE ports, not gated ones** — it is counterfactual, and this file's older "328 live-but-hidden" is the right population in the wrong tense. 🔴 **THE DRIVE FOUND TWO DEFECTS THE SPECS COULD NOT SEE**: AC3's jump focused `input, select, textarea, button` and `SizeModeInput` — the gating control for `width`, the port the task was filed about — is **`div`s and `span`s with `focusables: 0`**, so it scrolled and left `activeElement` on `BODY`; and the sentence named the control twice. 🔴 **And 2 of 18 mutants killed ZERO rows** — both my own specs passing by a path unrelated to the guard they named. 21 mutants now, all killing. ✅ Because a revealed row is a real view carrying `name`/`displayName`, **FB-017's filter now finds it**. ⚠️ **Not deployed** — editor-side, ships with the app.
- ✅ **FB-022** — [drag-to-scrub numeric fields](FB-022-NUMBERS-YOU-CAN-GRAB.md) — **DONE, DRIVEN 2026-08-25 (s29). AC1–AC5 all met.** Was M/L, delivered M. **33 of the shipped catalog's 73 shared visual ports scrub**, chosen by port type via `scrubPolicy.ts`, never by a hand-list. 🔴 **The eight margin/padding ports are `{name:'number'}` too** and are claimed four branches earlier in `Ports.viewClassForPort` by a widget that has had its own drag since POL-012 — the sweep re-derives that dispatch prefix out of `Ports.ts` so a predicate inserted above the numeric rows fails the suite. AC1's coalescing follows `MarginPaddingType`'s precedent (live writes with no undo, one `UndoActionGroup` at the end) but builds its own group, because `setParameter`'s `args.oldValue` check is **falsy** and cannot express "it was on its default". 🔴 **THE DRIVE FOUND TWO DEFECTS 83 GREEN SPECS MISSED**: `ModelProxy` had no `notifyListeners`, so the first real undo threw and left the field showing the dragged value while the project held the old one — **the spec passed because the fake was more capable than the real object**; and `numericPart` accepted `number` only while `transformOriginX` declares `default: '50'` as a **string**, so a drag on it started from 0 (14 number / 5 string / 14 absent across the 33, and three of the five strings are `'Auto'`, so coercion had to be rejecting too). Both fixed, both guarded by arms proven red against the pre-fix code. Measured live: **13 model writes in one 60px drag, 1 undo entry**. ⚠️ **Not deployed** — editor-side, ships with the app.
- ✅ **FB-023** — [the pool that forgets how to read a date](FB-023-THE-POOL-THAT-FORGETS-HOW-TO-READ-A-DATE.md) — **FIXED AND DRIVEN, session 11** (`nodegx-community` `0860426`). `drizzle()` **mutates the client you hand it**, setting the date parsers to identity forever, so every later raw `sql` read on the shared `apiSql()` pool returned a **string**: thread reads **500**, and an edit came back **`400 "that could not be posted"`** — blaming the author for text that was fine. 🔴 **The filed population was wrong: THREE routes poisoned the pool** (`/community/home` and **both tutorials routes**, all via `serveCommunityRead`'s shared pool), each **20/20** on a virgin pool against control **0/20** — so the file's fix candidate #2 was a **non-fix**, and the editor draws tutorials too. ✅ Fixed structurally: **`createDb()` takes no client**, because the trap was the parameter. 8-row regression file, **7 red on the reverted code**. ⚠️ **Not deployed.** **✅ DEPLOYED to nexus-1 2026-08-23** (`8d40b63`→`0860426`, neighbours 200→200); **verified live: 0/12 failures after both poisoners.**
- ✅ **FB-024** — [the search box that could not see a question](FB-024-THE-SEARCH-THAT-COULD-NOT-SEE-A-QUESTION.md) — **FIXED session 41 (2026-08-26), 20 specs, 9 mutants, all killed by their own spec.** Taken as queue item 1 (*"the bench search ANDs its terms"*). 🔴 **THE FILED DEFECT WAS IN A FUNCTION NOTHING CALLS.** `searchThreads` and its `websearch_to_tsquery` have exactly one importer — their own test file. The reader's box goes `benchList` → `buildList` → `select()` in `facets.ts`, a **JavaScript substring** over rows in memory. 🔴 **And the live defect was worse: the box labelled *"Search questions"* could not see one word of one question.** `benchList` builds rows from `listThreads`, which returns `BenchThreadSummary` — no body — so the haystack was title/handle/section/nodes. **The Bench was the only one of the six lists whose `searchable` named no text field.** Measured: a word in a question body **0 rows**, a word in an answer **0**, both **1** via `searchThreads` (the control — the text was always there). `repeater draws` found the thread; `repeater nothing` — *same title, same two words* — found **nothing**, and so did `draws repeater`. ✅ Fixed in four places: `termsOf` makes the query its **words** rather than one substring (each term still a substring, so `kern` still finds `kerning`); **Postgres's own 127-word snowball stopword list** is what makes a typed sentence work — every term was required, so the sentence needed `which` and `when` to be in a thread, and *the words carrying no meaning were the only ones doing any excluding*; `threadSearchText` feeds bodies into the haystack from the **parsed** model, `hidden_at is null` so a moderated post is not findable by a word inside it; and the label now says what it does. 🔴 **`plainto_tsquery` — the fix the item suggested — is a no-op**: measured beside `websearch_to_tsquery` it returns the **identical** tsquery. ✅ `searchThreads` ORed **and ranked** anyway (FB-014 measured it as its lexical arm), with an **explicit operator left alone, guarded on the PARSED query**: ORing `repeater -solved` gives `'repeat' | !'solv'` — every thread failing to mention "solved", a negation turned into its opposite. ⚠️ Deliberately **not** wired into the faceted list — `select()` stays the only place a row is included or excluded, which is what makes a pill's count equal its rows. Full community suite **59 files / 1418 specs / 0 failures**; `tsc --noEmit` 0. ⚠️ **Not deployed** — nexus-1 still runs the old matcher.
- (FB-012 gains the CSS-basics lesson + the accumulating-state bar — tracked there)

## Tier 2 — unblocked 2026-08-22 (D6, D7 ruled)

- ✅ **FB-001** — edit and delete your own bench post — **DONE.** D7 ruled 08-22: edit-own +
  delete-unanswered, no report/flag, no hide. Built s9 (`080a4f1` + `e3c52fbe`), **driven on both
  surfaces s10**, and **s11 gave the editor a confirmation step** (`0679ccc7`):
  `DialogLayerModel.showConfirm`, driven on both surfaces — click Delete → dialog with **0
  requests**, Cancel → the row survives and the verb resets, Confirm → **exactly one** DELETE and
  **0 orphan posts**. 🔴 `editFor` and D15 grade which verbs are *offered*, so neither could ever
  have caught a missing confirm — a whole family of specs was watching the wrong half-second.
- ✅ **FB-006** — the launcher half **done 2026-08-22**: the community page is the web's tabs
  (**Bench · Tutorials · Replays · People**), one section at a time, chrome outside them, a lead
  per tab. Built, specced (28 new assertions across two files), **driven in both themes**, and
  revert-and-counted (**5 reds** when every section draws at once). ✅ The first tab is **Bench**,
  not the proposal's *"Discussions"* — **ruled 2026-08-22**: they are one place with two names
  (one `bench_threads` source, no `/discussions` route on the web), and **chat (FB-013) is the
  reason to keep "Discussions" free**, not the reason to spend it here. `Tabs` grew a hook-free **`TabStrip`** so the page stays
  walkable by `tests-unit`; the DOM seven editor panels draw is unchanged. Revises **NAT-005**'s
  page and **NAT-008**'s D15 pair — both named in the diff. ⚠️ **NAT-012 still owns the editor
  half** (the model, the `openExternal` audit, the rail narrowing, and the D21 mention)
- ✅ **FB-011** — [the ports render once](FB-011-THE-PORTS-RENDER-TWICE.md) — **DONE, DRIVEN over real HTTP 2026-08-24**, web-side only (`nodegx-community`). 🔴 **THE FILED DECISION WAS BACKWARDS AND RICHARD RULED AGAINST IT.** The file proposed keeping the structured attachment and deleting the body prose; the report says *"the first part with **the list** makes sense… but **the bit below** where it shows a kind of **fake mockup of the node** is confusing"* — and `page.tsx` renders `PostBody` **then** `AttachmentList`, so "the bit below" is the attachment, and `NodeFigure` drew a literal node: title bar, inputs down the left, outputs down the right. **Ruled: the smallest change — mockup → list only**, body prose untouched. ⚠️ **AC1 (*"exactly once"*) is knowingly SUPERSEDED, not met** — the composer's `<pre>` *is* the string it posts (*"the preview is the payload"*), so emptying the body would also empty **"this is exactly what will be posted"**. ✅ **One-sided was safe where NAT-007 s8 said it would not be**: the editor mirror already drew a `<ul>`, so this **converges** the two surfaces rather than splitting them. 🔴 **The drive found an instrument bug 14 green specs could not**: `renderToStaticMarkup` joins adjacent text nodes and the real server render does **not**, so `({port.direction})` shipped as `(<!-- -->input<!-- -->)` — displayed fine, but the bytes the spec graded were never the bytes a reader got. Fixed at the source. **14 specs — the first over the `node_excerpt` renderer at all — 9 mutations red.** ✅ **DEPLOYED to nexus-1 2026-08-24 (s19), `acd4a9a`, and verified as a READER sees it, not just by the deploy script** — which only curls `/` and would have reported success on the old renderer. Both live threads: `nodefig` **14 → 0**, `portlist` **0 → 2**, `port-dir` **0 → 20**, **10 `<li class="port">`** with **5 `(input)` and 5 `(output)`** spans — so the *"kept one `filter`, dropped the other"* mutation is excluded on production bytes. Both linked stylesheets **200**; the rules are in `7c58972f…css` in exactly the merged-selector shape s18 warned grep under-reports (`.port,.portlist{display:flex;min-width:0}`). Neighbours **200 → 200**.

## Tier 3 — content and distribution

- ⬜ **FB-012** — a batch of default tutorials + share/export (content 🧭 Richard) (L)
- ⬜ **FB-009** — a syllabus entry you can actually start (D17 v0 hosting; lessons 🧭 Richard) (M/L)

## Tier 4 — new scope (rulings landed 08-22; scoping docs first)

- 🟡 **FB-005** — templates, **curated first** (L+) — **T1–T5 BUILT AND NOW DEPLOYED; the blocker is CONTENT** — **R-templates ruled 08-22**: share files a
  submission, Richard publishes. G3 stays shut. 🔴 **Licences are NO LONGER parked** — T5 makes an attested licence a required field of the act, because a submission is third-party code (P69).
  ✅ **T5's button landed s46** — *"Share as template…"* on every launcher project card, a five-field dialog, driven end to end. **Five defects found by driving, none visible to 226 green specs** — see [FB-005-SCOPE.md](FB-005-SCOPE.md) §4e.
  ✅ **s48 DEPLOYED THE PLATFORM HALF, and the blocker s46 found is gone.** `ops/deploy.sh` from a **pristine clone of `27be4d1`** (the script rsyncs the WORKING TREE and a peer was committing all evening); migrations `0020`/`0021`/`0022` applied before the restart; stamped `dirty=false`; neighbours **200 → 200**. `/api/v1/community/templates` and `/templates/submissions` went **404 → 200**, `/threshold` held at 200, and a 🆕 **negative control** (`/templates/does-not-exist` → **404**) is what makes those 200s mean *the route exists* rather than *a catch-all answers everything*. Production had been `acd4a9a` since 08-24. 🔴 **The shelf is now REAL and EMPTY** (`total: 0`) — *"the curated shelf is empty"* stopped being a deployment fact and became a **content** one, and publishing is Richard's editorial call, blocked behind the **3-of-8 category gap** rather than behind effort. See [FB-005-SCOPE.md](FB-005-SCOPE.md) §4e. ✅ **Scope doc done s39**
  ([FB-005-SCOPE.md](FB-005-SCOPE.md)); ✅ **T1 CLOSED s40, AC1 met** — the zip transport and its
  three providers are deleted, `newProject` has one branch and it goes through `templateRegistry`,
  and `tests-unit/fb-005/template-install-path.test.ts` (27 specs, 6 mutants killed) grades the
  **chain** rather than the registry. 🔴 **The root cause was a contract, not a bug**:
  `ITemplateProvider.download` documented *"the destination we will save the ZIP file"* while its
  one reachable implementation wrote a `project.json` **into a directory** — both
  `(string, string) => Promise<void>`, so the compiler had nothing to say and the registry unzipped
  a directory. Renamed to `install` with the contract written down.
  ✅ **T2 CLOSED s42, AC3 met** — `nodegx-community` has `project_templates` (`0020`) and
  `/api/v1/community/templates` + `/[slug]` + `/[slug]/bundle`, TUT-004's shape one shelf over, plus
  `scripts/publish-project-template.ts` — the caller a table is useless without. **42 specs, 8
  mutants killed, the four route gates green.** 🔴 **A CHECK constraint RAISED instead of refusing**:
  `.keyvalue()` on a non-object throws rather than returning false, and postgres evaluates CHECKs in
  constraint-**NAME** order — so an array payload died on a jsonpath internal error before the
  constraint whose job that case is ever ran, and reached the publisher **unmapped by
  `refusals.ts`**. ⚠️ `0017`'s `tutorial_bundle_has_solution` has the same unguarded expression and
  is correct **only by alphabetical luck** — and cannot be edited, because the ledger checksums
  applied migrations.
  ✅ **T3 CLOSED s43, AC2 met** — the create wizard has a **fourth mode**, `PlatformTemplateProvider`
  serves `community://<slug>`, and `hooks/useProjectTemplates.ts` is **the first caller
  `templateRegistry.list()` has ever had in the product** — which is T1's finding closed rather than
  restated. **97 specs, 10 mutants killed, driven end to end**: picker → Review → Create → a project
  that opens and renders. 🔴 **`TemplateRegistry.listing()` was added because a short shelf and a
  broken shelf are the same array** — `list()` swallows a provider's failure, so a community outage
  looked identical to curation; the picker now says *"this list may be short"* beside the rows that
  did arrive. 🔴 **The defect the drive found, and no spec could have**: one `refusalSentence` served
  both reads, so listing a shelf that 404s produced *"that template is no longer on the community
  shelf"* — a sentence about a template where **none was named**. Both arms are `absent`, both are
  refusals, and every assertion available is green on either wording. ⚠️ **T4–T6 remain**; the shelf
  still holds **no template** — content, not schema, and the community half has therefore never
  installed anything. 🆕 ✅ **PHASE 76 (opened 2026-08-26, parallel session) owns "the first template
  in the Templates tab"** — the launcher's top-level Templates tab has always said *"coming soon"*,
  and it is now phase 76's, not T4's. 🔴 **T3 shipped the plumbing it needs, so it must not be
  rebuilt**: `useProjectTemplates(enabled)`, `templateRegistry.listing({})` (never `list()` on a
  surface a person looks at), and the hook-free `TemplateStepBody`. ✅ **The category vocabulary is RULED and
  applied**: the platform's (`starter`/`data-app`/`dashboard`/`site`/`form`/`integration`) is
  canonical everywhere, including embedded templates, so `hello-world` moved from the prose title
  `'Getting Started'` to `starter` and a spec enforces it. Phase 76's template ships embedded with
  `site`. T4 also waited on the search item — ✅ **UNBLOCKED**, see FB-024 (and note the item's premise was wrong: the AND was in a function nothing calls)
  ✅ **T4 CLOSED s44, AC4 met** — `templateFilter.ts` narrows the shelf by category and by text,
  and `filterTemplates` produces **the rows and the pill counts from one pass over one predicate**
  (`facets.ts`' rule: two producers of one number is where they drift). **150 specs, 14 mutants
  killed, driven live.** ✅ **The measurement: `10/10` recall with terms ORed against `5/10` for the
  ANDed control** over one corpus and one query set — the *difference* is the evidence, because one
  author wrote both corpus and queries. ⚠️ **The corpus is a fixture**: the shelf still holds one
  row, so this grades the matcher, not the shelf. 🔴 **The ruling left a defect at the surface it
  was made for**: the category vocabulary went to machine slugs on 08-26 and nothing turned them
  back into words, so the card drew the literal string `starter` at a person — and T3's own spec
  had **asserted the slug was drawn**. 🔴 **Three of Richard's eight 0.2.1 templates have no honest
  category** — `pixel-game`, `interactive-fiction` and `shared-canvas` are none of the six, so the
  CHECK forces them into `starter` and that pill becomes a bin. **Richard's: a migration plus a
  ruling.** 🔴 **A second mutant survived in a spec that named a mechanism it never reached** —
  deleting the all-terms-first sort left *"answering every term outranks answering one of them"*
  green, because that query also won on raw score; rebuilt with a query where the two mechanisms
  disagree. ⚠️ **Measured live in both themes**: the active pill's *fill* is **1.16:1 dark /
  1.11:1 light** against the panel — FB-002's shipped defect exactly — which is why the state is on
  the **border** (4.80:1 / 4.14:1) and in **text**. ⚠️ **Found, not ours**:
  `--theme-color-border-default` is **1.07:1 / 1.15:1** against the panel, so **T3's unselected
  `TemplateCard` has an invisible boundary too**. ✅ **CLOSED s60 — and the "design-token decision,
  Richard's" framing was wrong.** The fix is per-control (`--theme-color-border-control`, which already
  existed), never the shared divider token. Card, pill and search box now clear 3:1 on **both** sides in
  both themes; 16 rows, 3 mutants — one of which refuses the *over*-fix. See
  [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md) for the 60 sites left.
- 🟡 **FB-013** — [chat](FB-013-THE-CHAT-WE-ARGUED-AGAINST.md) (L) — 🔴 **R-chat ruled 08-22: OVERRULED, build it.** **SCOPED + C1/C2/C3 BUILT, sessions 51–52** ([FB-013-SCOPE.md](FB-013-SCOPE.md)). 🔴 **§1 first: the risk UNI-011 predicted is no longer a prediction.** Measured off production this session — the bench holds **2 threads, 1 author, 1 reply**, and D16's threshold reads **2/30 threads, 0/3 consecutive weeks with a call, median first reply undefined at n=0**. The platform's own gate says the community has not started. Richard's ruling stands and the design is built against that number rather than around it. ✅ **The answer is structural, not copy** — the default view is **one merged river across every channel; a channel is a FILTER, not a door**, so no screen in the feature has an accidentally-reachable empty state and AC4 is restated as a property rather than a sentence. 🔴 **Four channels chosen for NON-OVERLAP with `bench_section`** (`lounge`/`templates`/`tutorials`/`collab`) — a chat `#showcase` beside a bench `showcase` is the second-vocabulary failure `0008`'s header exists to prevent, and a spec checks it against the bench's own exported list. ✅ **`0024`, `src/lib/chat.ts`, `chat-http.ts`, five routes; 22 specs, 6 mutants all killed.** 🔴 **No `chat_threads` table** — a Slack thread carries neither title nor accepted answer, so parenthood is a nullable self-FK and a table would be a join with no column in it; **one reply level and channel-inheritance are TRIGGERS**, which is what makes *"not forum level complexity"* a property of the data. 🔴 **`points_ledger` deliberately NOT reused** — awarding points for chatter is how a quiet room becomes a farmed one. ⚠️ **Found and fixed in passing: `moderation.ts` typed its subject-id `coalesce` out by hand TWICE**, and a subject missing from that list fails **silently** — `coalesce` returns null, `upholdReport` runs `where id is null`, updates nothing and throws nothing, leaving a report marked upheld beside a message still on screen. Now derived from `SUBJECT_COLUMN`. ⚠️ **And `db-schema-drift`'s table-count floor had LAPSED at 36 since UNI-014 while the mirror grew to 55** — the assertion written to catch a wholesale loss would have passed after losing twenty tables. Raised to 56. ✅ **C3 (THE WEB TAB) BUILT session 52** — `/chat` + `/chat/[messageId]`, `chatRiver` in `lib/lists.ts`, `Chat.tsx`, `ChatComposer.tsx`, a nav entry; **22 specs, 12 mutants all killed**. 🔴 **A chat message is NOT a card and does not go through `ListView`** — `CardView` renders `<h3>{title}</h3>` over a plain-string `body`, and a message has no title and a `Block[]` body, so the card archetype would mean inventing a headline and flattening the body: **a river of headlines IS the forum**. ✅ **What is shared is the ENGINE** — `buildList`, `PageHead`, `FacetBar`, `EmptyState` — so the pill markup is still declared once and `/chat` joins `FACETED_PAGES` in `uni023` rather than reasserting its promises. 🔴 **`chatRiver` calls `listRiver(sql)` with NO channel, and that line is the design**: the page never asks the database for one channel. 🔴 **The thread `<h1>` is DERIVED (`threadLabel`), never a column** — the same decision as *no `chat_threads` table*, seen from the view layer. 🔴 **C3 owed TWO sweeps that §11's table does not name, because a PAGE is not a route** — `uni023`'s exact client-island list and `uni013-slice5`'s archetype accounting **both went red**, and `uni019`'s reachability passed only because the river's href is built in `lib/lists.ts`: `linksInPage` reads a page's source and its `lib/` imports, **never its components**. ⚠️ **Mutation grading found TWO SURVIVORS and both were spec defects** — a row named *"finds a word only in a message body"* was searching for a word that lived in a **reply** (FB-024's defect restaged, and green); and narrowing in the **database** as well as in `buildList` survived everything, because every assertion read the *unfiltered* river — it would have left a reader in `#lounge` seeing `0` beside every other channel, with count-equals-rows still holding. ✅ Both now killed by a number the wrong implementation cannot produce. ⚠️ **`uni023`'s route sweep had a hole shaped like this page**: it read `pages.filter(p => LIST_PAGES.includes(p))` and compared to `LIST_PAGES` — it could see a page **deleted** and nothing else, so `/chat` would have passed it silently. Now derived from disk. 🟡 **C4's READ HALF BUILT AND DRIVEN s57** — the launcher Chat tab: `client.chat()`/`.chatThread()`, `models/community/chatview.ts`, `CommunityChatView`/`CommunityChatThread`, `useCommunityChat`, wired through `ProjectsPage`. **36 specs, 10 mutants all killed.** 🔴 **DRIVEN AGAINST A LOCAL PLATFORM, because the chat routes are NOT DEPLOYED** — `/api/v1/community/chat` is **404** on production while `/threads` is **200** and an invented path is **404**, so the tab is correct and has nothing to talk to. A scratch Postgres + `next dev` reproduced the whole surface: pills read **All 5 · #lounge 3 · #templates 1 · #tutorials 1 · #collab 0**, clicking `#lounge` returned **exactly 3** rows — *the pill's count IS its rows, driven* — and `#collab` drew *"Nothing in #collab yet. Looking for someone to build with…"*. ✅ **THE CROSS-REPOSITORY LABEL AGREEMENT WAS MEASURED, NOT ASSERTED**: the launcher's thread heading and the web's `<h1>` for the same message are byte-identical (*"Just saying hello — been building with NodeGX for a week and enjoying it."*), which is what `threadLabel`'s own note demands and what a mirrored algorithm can silently lose. 🔴 **THE WEB'S NAV IS COPIED IN TWO PLACES HERE AND ONLY ONE WAS FOUND BY READING** — `communityTabs.ts`'s header prose (corrected by re-reading the web) and `fb-006/community-tabs.test.ts`'s literal, which **went red and is how the second copy was discovered**. The header predicts exactly this drift; it took four days. 🔴 **The UNI-001 session-reader sweep also fired**, as it should: a new `readCommunitySession` caller must answer *"what does it WITHHOLD?"* before it is listed. Answer: **nothing** — no branch on whether a session exists, `null` proceeds, and `chatview.ts` never sees a token (asserted, with a control). ⚠️ **A message row is not `CommunityRow` and the row is not the click target** — a body carries links, so a `<button>` around it would nest interactives; the way in is a foot control, absent inside the thread pane where it would point at the page it is on. 🔴 **FOUND AND MEASURED, UNOWNED, NOW ON A THIRD SURFACE**: the shared `.FilterPill`'s active state is **1.36:1** fill against the panel (1.94:1 active-vs-inactive) and the **border is identical in both states** (4.17:1 either way), so *which* channel is selected is essentially invisible — the same defect FB-002 recorded on the Bench and FB-005 T4 solved for template pills by moving state to the border. Labels themselves are fine (8.46:1). Bench, People and Chat all share it. ✅ **CLOSED s58 — see the FB-002 line above.** One shared `CommunityFilterPill`; the three copied call sites are gone and a spec pins that there is exactly one. ⚠️ **Chat's pills were NOT driven** (its routes still 404 on production) — Bench and People were, and Chat draws the identical component. 🔒 **Still left: the COMPOSER (deliberately moved to sit with C5 — posting is what creates the messages a moderation posture is about), C5, and R-chat-mod, the posture question the ruling required be asked** (SCOPE §8: D7's *delete-unanswered* has no referent in chat, and *"no report/flag"* is a much larger bet in a merged river than on a page a reader chose to open; recommendation **B**, hide-by-moderator, no reader-facing report)
  ✅ **R-CHAT-MOD RULED B by Richard, 2026-08-28 (s59)** — A + hide-by-moderator, no reader-facing
  report; §8 restates what B commits to. **C5 is unblocked, and so is the launcher composer.**
  🔒 **Free tags are STILL unruled** — asked in the same breath, not answered by B; v1 keeps the
  channel as the category by default rather than by decision.
  ✅ **C5 BUILT s59** (`2bce720` in `nodegx-community`) — `isModerator` on an **env allowlist**
  (`NODEGX_MODERATORS`, ruled with Richard: no role column), `setChatMessageHidden`, and a `PATCH`
  on the existing message path so it inherits the envelope and the one `notFound()` producer.
  **21 specs, 4 mutants all killed**; full community suite **64 files / 1603 passed / 8 skipped /
  0 failures**. 🔴 **NOT DEPLOYED and INERT until configured** — the var is unset on nexus-1, so the
  route would 404 for everybody including Richard. ⬜ **Left: set the var, deploy, drive the hide.**
  🔴 **The spec file had a hole shaped like the defect until the route block was added** — every
  predicate and verb row passes on a build whose `PATCH` never calls `isModerator`. ⚠️ **Posture C
  is guarded by an absence** (`reportContent` has no product caller) and the first version of that
  guard **reported the opposite result**, because `chat.ts` and `bench.ts` discuss `upholdReport`
  in prose and an unstripped grep read those sentences as callers.
  ⚠️ **Still left in C4/C5's neighbourhood: the launcher composer**, which B also unblocked and
  which this session did not build.
- 🟢 **FB-014** — [search that survives renames](FB-014-SEARCH-THAT-SURVIVES-RENAMES.md) (M) — **DESIGN PHASE DONE 2026-08-25 (s38), [FB-014-DESIGN.md](FB-014-DESIGN.md); AC1+AC3 met, AC2 impossible.** 🔴 **The bench holds 3 posts** (2 threads, 1,369 chars, read off nexus-1) — *"a copy of real bench data"* does not exist, so the mechanism was measured against **real pre-rename product prose recovered from git** instead: the node catalog at `1f31d24f^`, 155 documents, and **29 real renames** mined from its own 98-commit history (`Success→Done` across ~15 nodes, `Logic Builder→Visual Function`). 🔴 **The finding is about the search we already ship**: with an old-vocabulary control holding everything else constant, the renames cost it **73% → 18%** recall on keyword queries; vectors recover it to **91% @10**, and **hybrid beats vector-only on the control** (17/22 vs 11/22 @1), so RRF is the answer rather than a hedge. ✅ **pgvector needs no third-party repo on prod** — `postgresql-16-pgvector` 0.6.0 is already a candidate from `noble/universe` on the Hetzner mirror; the whole DDL was **replayed on pgvector 0.5.1** to prove nothing postdates it. ✅ **`BAAI/bge-m3` (Richard's suggestion, hosted on DeepInfra) WINS** — 68%/91% on keyword queries vs `all-minilm`'s 55%/82%, **91% vs 77% on the conversational queries people actually type**, and **100% on the control**. 🔴 **But 843 ms per query against `all-minilm`'s 14 ms** — Postgres is 2.4 ms of that, so the model is 99% of the wait; hybrid hides it by painting FTS results (0.14 ms) first. 🔴 **A task prefix is model-specific and guessing is wrong BOTH ways**: `nomic-embed-text` *needs* one (without it I measured my own omission and nearly filed it as "the bigger model is worse"); `bge-m3` is *damaged* by one (91%→68%). ⚠️ **Truncating `bge-m3` is a lever not worth pulling** — 512d is free on accuracy but **misses the TOAST threshold by 24 bytes**, and 384d (the only inline size) costs 14 points on conversational queries. ⚠️ **`pg_relation_size` reported a 533 MB table as 5888 kB** because at 1024d every vector is in TOAST. 🔴 **Chunking is mandatory for a non-obvious reason**: whole-document embedding fails on 6/155 at **1070–2193 chars while a 6000-char document passes** — the window is spent in **tokens**, and two of the six were ground-truth documents, so dropping them silently would have scored the retriever on a corpus with the answers removed. 🔴 **Two of my own measurements were fiction before they were fixed** — a 100k-row latency table that Postgres hoisted into **100,000 copies of one vector** (`count(distinct)` = 1; the honest HNSW figure is **5.5× higher**, 2.93 ms median), and an index build that **exited 0 twice without building anything** while `EXPLAIN` said *Parallel Seq Scan*. ⛔ **Recommendation: build behind a flag, do not launch** — the trigger is content, not code. 🧭 **AC3 is with Richard, and the measurements sharpened it**: cost is **£0.14 per 100k posts and £0.14 per million searches** (measured tokens x DeepInfra's published $0.010/1M — not an estimate), and accuracy is no longer in doubt. **The only real question left is whether bench posts may go to a third-party processor at all.** ⚠️ This eval sent **no user data** — the corpus is the public node catalog and the bench's 3 posts were never uploaded. Also found, unowned: **`websearch_to_tsquery` ANDs bare terms**, so a conversational query matches **2/22 even in perfect vocabulary**, and **`Set Record Properties→Update Record` collides** with `noodl.byob.UpdateRecord`.

## Found while working, owned by nobody — ✅ BOTH CLOSED 2026-08-22 (`9ecec25`, nodegx-community)

- ✅ **Token drift — synced.** The vendored `colors.css` was 6 tokens behind the editor's
  canonical copy: **FIX-028** (2026-08-21) raised the dark theme's inks after Richard's *"everything
  looks disabled"*. `npm run tokens:sync` cleared all six. ⚠️ **The gate reported SIX failures for
  ONE drift** — its five known-bad probes assert an exact difference *count*, so a real drift
  pollutes every one of them. Read the probe failures as downstream, not as five more problems.
  🔴 **The sync moved two values `tests/uni013-contrast.test.ts` PINS** (`fg-highlight` → `#ffffff`,
  `--site-fg-secondary` → `#c4cedb`, both dark-arm only). The pins were right to fire; they are
  updated deliberately with the reason in the diff. **Every AA ratio row passed unchanged.**
- ✅ **`uni022-syllabus` AC4 — and the filed diagnosis was wrong.** The route does **not** hardcode
  a lesson slug: the slug is in its **header comment**, explaining FIX-027 bug 21, and nothing about
  adding a lesson requires editing it. The file already makes exactly this argument for its own D17
  sweep (`pageProse`) and AC4 simply did not use it. Fixed with `withoutCommentBlocks`, **its bound
  stated** (trailing `//` deliberately kept in scope — a stripper that mis-parses a string literal
  deletes real code from the sweep and turns a hardcoded slug green), **three control arms**, and a
  mutation check: hardcoding the slug in the route's real code still fails AC4 with one offender.
- **Community suite, 2026-08-22 after the fixes: 1277 specs, 0 failures** (was 1274 / 7; +3 is the
  new control arms). Compare **by name**, never by count, and re-measure rather than quoting this.
- ✅ **SUPERSEDED 2026-08-28 (s59) — and s31's REASONING was wrong even though its conclusion held.**
  s31 measured `acd4a9a..main` empty and concluded nothing was waiting to ship. That is an
  ancestry check against **local `main`**, which is silent about both `origin/main` and the box —
  the wrong population, twice over. Measured properly this session: `origin/main` was **18 commits
  behind** local `main` (it still is), while the *host* was at `fab1aac`, only **two** behind. The
  conclusion survived by luck, because this repo deploys by **rsyncing the working tree, not a
  commit** (`ops/deploy.sh`), so `origin` was never on the path to production at all.
  🔴 **The push gap is a REAL and separate risk**: ~15,600 lines that are live on production exist
  only on this laptop. ⬜ **Unowned: push `nodegx-community` main.**
  ✅ **CHAT IS NOW DEPLOYED (2026-08-28)** — `ops/deploy.sh 49.12.102.195`, host stamped
  `91d8b0c4ed4e`, migration `0024_fb013_chat.sql` applied (`already applied: 23`). All three
  neighbours **200 → 200** across the deploy. `/api/v1/community/chat` answers **200** with a real
  envelope and honours `?channel=lounge`, against an invented path that still **404s** — so the
  200 is a measurement and not a redirect. ⚠️ Before migrating, the three tables `0024` rewrites
  (`content_reports`, `notifications`, `notification_suppressions`) were read on the host and were
  **empty**, beside a control that drew 5 accounts and 14 enum labels: **an empty result and a
  broken query look identical**, and this one was proved to fire.
- ✅ _(s31's original note, kept)_ **both ARE deployed; this line was stale.** `9ecec25` and
  FB-002's `fd695ae` are **ancestors of `acd4a9a`** (`git merge-base --is-ancestor`, measured), and
  `acd4a9a..main` is **empty** — nothing in `nodegx-community` is waiting to ship. The `8d40b63`
  stamp above was overtaken on 08-23/24. ⚠️ The ancestry is measured locally; the *stamp* on the box
  is relayed from s19's SSH read, not re-measured this session — re-read it before any deploy claim.

## Carried from phase 74 (work lives in `phase-74-0.2.0-bug-fixes/`)

- 🟡 FIX-025 — **this line was stale in all three places, corrected 2026-08-27 (s56).** §12 was
  **driven 08-25**; §5 is a deliberate park (seeing it means signing out of Richard's live
  community session, and the render decision is already specced); **§7 is CLOSED** — its second
  cause was fixed, specced and mutation-graded this session. 🔴 **The note that made §7 look
  expensive was wrong twice**: the platform is not defective (`firstReplyMinutes` counts replies
  *by other people*, on purpose, and D16 needs it that way), and the web never drew the sentence
  at all — so there was no cross-surface decision, only a renderer conflating "nobody answered"
  with "nobody else answered". **Measured on production**: `de14371e…` still returns
  `replyCount: 1, accepted: true, firstReplyMinutes: null` — an accepted question calling itself
  unanswered — beside `2abd111a…` with `replyCount: 0`, which is the honest negative control.
  ✅ **AND NOW DRIVEN (s57), so §7 is fully closed.** Launcher → Community → Bench, against
  production: the **Waiting** pill draws `2abd111a…` as *"no reply yet"* and the **Solved** pill
  draws `de14371e…` as *"no reply from anyone else yet"* — asserted on the **React key**, because
  both rows carry the same title, author and age and `firstReplyMinutes` is `null` on both, so
  painted text can never separate them. The thread pane draws the new sentence above an accepted
  answer written **by the asker**, which is the consequence and not just the mechanism. The health
  readout still counts **both** as `unreplied` (D16 unchanged). ⚠️ The rail panel was not driven
  and need not be: `replyLatency`'s row call site is *inside the shared component*
  (`CommunityBenchView.tsx:136`), grepped — there is no second renderer to drift.
- 🧭 FIX-026 — restore source decision (a)/(b), then build
- 🟡 FIX-027 — **this line was stale on THREE of its five entries, corrected 2026-08-28 (s59).**
  It read `17 ⬜ · 19/20 ⬜` for three days after the work landed. ✅ **17, 19 and 20 are FIXED AND
  DRIVEN (2026-08-25)** — `f6d25d19` (a task step opens its own instructions, once, and a dismissal
  sticks) and `fada53fd` (finishing a lesson says so, and offers a way to start again). Corrected
  from **the artefacts, not from the task file**: `FIX-027`'s own table already said so, and the
  source carries both fixes — `lessons/lessoninstructionopen.ts` with `LessonLayerView.jsx:74`
  naming the old `showPopupWhenSelected={hasConditions === false}` it replaced, and
  `lessonlayer2.ts` with `_startAgainTarget`/`_onStartAgain` and §19/§20 markers at `:429`/`:544`.
  🔴 **Third time an index line in this phase has been stale in the safe direction** — FB-002 and
  FB-010 both said `🟡 open` after their commits. A line that under-claims costs a session
  re-deriving work that exists; **check the artefact before believing either the tick or the box**.
  ⬜ **Still genuinely open**: 14/15/16 🧭 · 22 🧭 · `state-on-a-page` needs a home ⬜ — and that
  last one **cannot be cleaned from this repo** (the bundle ships from a place neither checkout
  sees), so it is a decision about where it lives, not code waiting to be written.
- 🧭 `tsfixme` baseline decision
- 🧭 Prod `ANTHROPIC_API_KEY` (⚠️ intro pricing ends 2026-08-31)

## Adjacent (stay in their phases; 0.2.1 leans on them)

- 🟡 NAT-009 — needs its view + a drive · ⬜ NAT-010 · ⬜ NAT-011 (gains FB-004's
  reconciliation AC) · 🟡 **NAT-012 — half done 2026-08-22**: ✅ AC4 (`39404361`), ✅ **AC2's
  audit, AC3 and the editor narrowing** (`e17ee460`) — the panel is now a door (Discussions, thread
  pane, profile pane, TUT-004's tutorials) and the four community sections live on the launcher.
  **AC3 was ruled**: the router disposes the project, so the door says *"closes your project"* and
  reopening restores the component you were on. ✅ **AC3 DRIVEN 2026-08-22** — label, real close
  (`ProjectModel.instance` → `undefined`), Community landing, canvas restored; the ordinary exit is
  the control that lands on **Projects**. 🔴 **The drive deleted half the mechanism**: mutation arms
  plus an instrumented `switchToComponent` showed `restoreEditorPlace` was overwritten on **every**
  open by `useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`), and the restore AC3 promises is
  `EditorDocument`'s persisted `selectedComponentName` — older, per-project, and on every exit
  route. `rememberEditorPlace`/`takeEditorPlace`/`restoreEditorPlace` removed; the landing half
  stays. ⚠️ **Its spec asserted the source text of the dead call and passed** — replaced with an
  absence row and an `EditorDocument` pin, both mutation-checked. ⬜ **Left: AC1, AC5, AC6, AC7,
  and AC4's live-Bench half (🧭 Richard).**
  🔴 Revises **NAT-008 AC1's rail half** (withdrawn; AC2's pane stays) and **NAT-005's panel** · ⬜ NAT-004 ·
  🧭 NAT-014 AC2/4/7 · 🟡 TUT-004 (the drive; ⚠️ its AC1 loses the section it was positioned
  against when the narrowing lands)
