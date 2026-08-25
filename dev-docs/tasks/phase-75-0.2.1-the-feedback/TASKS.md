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
- 🟡 **FB-002** — web half done (default + still searchable); **editor mirror open**, and the
  task file now says why it is cheaper than filed (`accepted` is already on the wire)

## Tier 1 — the build-the-caller family (machinery exists, nobody can reach it)

- ✅ **FB-007** — [the editor uploads the capture it already takes](FB-007-THE-SCREENSHOT-NOBODY-UPLOADS.md) — **DONE, DRIVEN over real HTTP 2026-08-24.** The 23rd *build the caller*, and the first where **every piece on both sides already worked**: E7's platform half was correct, deployed and configured (4/4 `HETZNER_S3_*` read off the host), and the bucket held **zero objects** under `attachments/captures/` — nothing had ever uploaded one. Now `uploadCapture` (the only method on the client that does not send JSON), `withCaptureImage`, and the composer doing **disk → upload → post**. 🔴 **Scope 2 RULED by Richard**: NAT-008's *"this editor fetches no remote image"* is reversed **narrowly** — capture images only, from `COMMUNITY_URL` only. `avatarUrl` stays declined because its reasoning rests on *"a URL a stranger put on their profile"*, and **every clause of that is false here**; a hostile spec row proves an `image.key` of `https://evil.example/x.png` still yields our own URL. 🔴 Found: **`Buffer.from(str,'base64')` is a view into Node's shared pool**, so `.buffer` uploads an 8 KB slab (mutation-confirmed); a **200 with no grant** must degrade rather than default one, because defaulting costs the whole post; and *"drag it into your post"* had **outlived its behaviour** — FB-010's shape, one task later. **26 specs, 8 mutations red**; the full suite then caught `uni-016`'s builder guard, which was **tightened, not loosened**. ⚠️ Not driven in a browser; the composer's wiring is source-read as `uni-016` already records.
- ✅ **FB-010** — a settings page, so a profile can exist at all (M) — **DONE, DRIVEN 2026-08-23; DEPLOYED to nexus-1** (`eaa19c6`, verified live rather than by the deploy script alone: `41fe2749`). ⚠️ **This line said `⬜` until 2026-08-24 (session 18)** — the task file has read *"BUILT, SPECCED, DRIVEN"* since the 23rd and the deploy commit landed after it, so the index was the only place still claiming it was open. 🔴 A stale index line is worse than a missing one: it sends the next session to rebuild something that already shipped. Corrected from the task file and the commit, not from memory.
- ✅ **FB-003** — [become a coach / post an RFP: the two composers](FB-003-NOBODY-CAN-OFFER-OR-ASK.md) — **DONE, DRIVEN over real HTTP 2026-08-23** (`nodegx-community` `67df2b1`). Two POSTs on the routes that already served the GETs, plus one client island holding both composers — an API caller and **not** a server action, because AC1 is that a request posted on the web reaches the **editor's** NAT-009 client without either being redeployed. 🔴 **THE DRIVE FOUND WHAT THE FILE DID NOT: `coaching_offers.account_id` references `profiles`, not `accounts`** — so an account with **no profile cannot create an offer at all**, which is *every* account a real sign-up produces (`upsertProfile` has no caller — **that is FB-010**). It rendered as the generic *"that offer could not be created"* on the most likely path through the feature; now `[offer-needs-profile]`, a 403 naming the precondition. ⚠️ **The spec fixture had hidden it** — `makeUnlistedBuilder` creates a profile, so all sixteen green arms walked past the real case. ✅ Also fixed: `boardRefusalResponse`'s default said *"that **response** could not be sent"* to somebody posting a **request**. ✅ Also found, unreachable, recorded: **`[rfp-response-cap]` names two different failures**. ✅ **There is no rate band** — derived from the schema, per the task's own NAT-008 trap. **34 specs, 12 mutations all red**; suite **56/1360/0**. ⚠️ **AC4's editor half is open** — `POST_A_REQUEST_LINE` has **no UI consumer**, so there is no click to redirect; the web half (sign-in with `?next=`) is done. ~~⚠️ Not deployed.~~ ✅ **Almost certainly DEPLOYED — corrected 2026-08-24 (s18).** `67df2b1` is an **ancestor of `eaa19c6`** (verified locally with `git merge-base --is-ancestor`), and `eaa19c6` is the stamp session 17 read off nexus-1. ✅ **CONFIRMED DEPLOYED — the stamp was re-measured 2026-08-24 (s19)**, read off `49.12.102.195:/etc/nodegx-community/deployed.json` over SSH: `eaa19c6c…` on `main`, `dirty: false`. So s18's ancestry argument stands on a measured stamp rather than a relayed one. ⚠️ The box has since moved to `acd4a9a` (FB-011), which is a descendant of both.

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
- ⬜ **FB-021** — gated ports render disabled with their reason (M)
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
- ✅ **FB-022** — [drag-to-scrub numeric fields](FB-022-NUMBERS-YOU-CAN-GRAB.md) — **DONE, DRIVEN 2026-08-25 (s29). AC1–AC5 all met.** Was M/L, delivered M. **33 of the shipped catalog's 73 shared visual ports scrub**, chosen by port type via `scrubPolicy.ts`, never by a hand-list. 🔴 **The eight margin/padding ports are `{name:'number'}` too** and are claimed four branches earlier in `Ports.viewClassForPort` by a widget that has had its own drag since POL-012 — the sweep re-derives that dispatch prefix out of `Ports.ts` so a predicate inserted above the numeric rows fails the suite. AC1's coalescing follows `MarginPaddingType`'s precedent (live writes with no undo, one `UndoActionGroup` at the end) but builds its own group, because `setParameter`'s `args.oldValue` check is **falsy** and cannot express "it was on its default". 🔴 **THE DRIVE FOUND TWO DEFECTS 83 GREEN SPECS MISSED**: `ModelProxy` had no `notifyListeners`, so the first real undo threw and left the field showing the dragged value while the project held the old one — **the spec passed because the fake was more capable than the real object**; and `numericPart` accepted `number` only while `transformOriginX` declares `default: '50'` as a **string**, so a drag on it started from 0 (14 number / 5 string / 14 absent across the 33, and three of the five strings are `'Auto'`, so coercion had to be rejecting too). Both fixed, both guarded by arms proven red against the pre-fix code. Measured live: **13 model writes in one 60px drag, 1 undo entry**. ⚠️ **Not deployed** — editor-side, ships with the app.
- ✅ **FB-023** — [the pool that forgets how to read a date](FB-023-THE-POOL-THAT-FORGETS-HOW-TO-READ-A-DATE.md) — **FIXED AND DRIVEN, session 11** (`nodegx-community` `0860426`). `drizzle()` **mutates the client you hand it**, setting the date parsers to identity forever, so every later raw `sql` read on the shared `apiSql()` pool returned a **string**: thread reads **500**, and an edit came back **`400 "that could not be posted"`** — blaming the author for text that was fine. 🔴 **The filed population was wrong: THREE routes poisoned the pool** (`/community/home` and **both tutorials routes**, all via `serveCommunityRead`'s shared pool), each **20/20** on a virgin pool against control **0/20** — so the file's fix candidate #2 was a **non-fix**, and the editor draws tutorials too. ✅ Fixed structurally: **`createDb()` takes no client**, because the trap was the parameter. 8-row regression file, **7 red on the reverted code**. ⚠️ **Not deployed.** **✅ DEPLOYED to nexus-1 2026-08-23** (`8d40b63`→`0860426`, neighbours 200→200); **verified live: 0/12 failures after both poisoners.**
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

- ⬜ **FB-005** — templates, **curated first** (L+) — **R-templates ruled 08-22**: share files a
  submission, Richard publishes. G3 stays shut; licences stay parked. Scope doc first
- ⬜ **FB-013** — chat (L) — 🔴 **R-chat ruled 08-22: OVERRULED, build it.** UNI-011's argument is
  superseded, not withdrawn. Pulls in FB-014's 2nd corpus and reopens D7's posture gap
- ⬜ **FB-014** — search that survives renames (pgvector, design + prototype only) (M)

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
- ⚠️ **Not deployed.** `9ecec25` and FB-002's `fd695ae` are committed and unshipped — nexus-1 is
  still stamped `8d40b63`. The dark theme's inks and the answered-filter default both change on the
  live site when somebody deploys; that is Richard's call, not a side effect of a gate fix.

## Carried from phase 74 (work lives in `phase-74-0.2.0-bug-fixes/`)

- ⬜ FIX-025 §5/§7/§12 — built, need the editor drive
- 🧭 FIX-026 — restore source decision (a)/(b), then build
- 🟡 FIX-027 — 14/15/16 🧭 · 17 ⬜ · 19/20 ⬜ · 22 🧭 · `state-on-a-page` needs a home ⬜
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
