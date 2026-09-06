# Phase 82 — next session

> ### 🟢 s57 (2026-09-06) — 0.2.2 IS PUBLISHED AND TAGGED. THE PHASE'S CLOSE CONDITION IS MET EXCEPT ITS LAST HALF-LINE
>
> **17 commits.** The phase opened to prep a launch and this session ran it: the shelf work
> that was still sitting uncommitted went in, the branch was pushed, the members' area was
> published to the community shelf by Richard, and `v0.2.2` was tagged at `10a6c147`.
>
> **1. 🔴 THE BLOCKER WAS NOT ON THE BOARD — IT WAS THE WORKING TREE.** Every REL row read
> *"Richard's"*, and the honest reading of the phase was that nothing buildable was left. But
> `HELD_TEMPLATE_IDS` still held `site-builder` at HEAD and `landing-pages.template.ts` was
> **untracked**, so a tag cut that morning would have shipped **an empty template shelf** under
> release notes whose first headline is *"templates you can start from"*. The board said
> *"Left: the commit"* on REL-017 and no session had read that as a blocker. ✅ **A row whose
> remaining work is "commit it" is indistinguishable on a board from a row that is done** —
> `git status` is the only instrument that separates them, and it is not part of re-deriving
> a board from task files.
>
> **2. ✅ WHAT WENT IN (15 commits of it), all of it work other sessions had finished and not
> committed**: the landing-pages template + the site-builder unhold (87 files, `9da450b0`),
> SBR-008's wire-declared ports, SBR-011's SSE connection pool, FB-013's chat writes,
> REL-002a's body-scroll diagnostic, the phase-75 border sweep, REL-007's pricing, REL-012's
> `NOODL_USER_DATA_DIR`, DEF-007's comment, the devtools reaper, and every lane's session
> records. **Gated on the settled tree afterwards**: `typecheck:editor`/`:runtime`/`:mcp` all
> **EXIT=0, 0 errors**; `test:main` **432 suites / 7218 tests, EXIT=0**. ⚠️ **The P77 handoff's
> floor of "3 failed suites, owner NONE" is gone** — do not carry it forward; re-measure.
> ⚠️ `typecheck:core-ui` exits 2 on 50 unowned `noodl-editor` files. Structural, pre-existing,
> **in no gate** — `dev-docs/tasks/NEXT-SESSION.md` has said so since phase 12.
>
> **3. 🔴 THE PUBLISH CREDENTIAL DID NOT EXIST WHERE EVERY DOCUMENT SAID IT DID.**
> `REL-001-SUBMISSION.md` gives the command with `DATABASE_URL=<the community DB url>` and
> Richard did not have it either. Measured: `~/nodegx-community-deploy.env` holds the OAuth,
> Brevo and S3 secrets and **no DATABASE_URL**; `ops/provision.sh` generates the password **on
> the box** and writes `postgres://…@127.0.0.1:5432/…` — the *server's* loopback. **So no
> connection string typed on a laptop could ever have worked**, and the publisher cannot run on
> the server either, because it reads the 100-file bundle off local disk. The answer is a
> tunnel: [`publish-members-area.sh`](../release-0.2.2/publish-members-area.sh).
> ⚠️ **This session could not run it** — `ssh`, `gh` and `api.github.com` are all blocked by the
> harness here. Richard ran it.
>
> **4. ✅ THE ROW WAS VERIFIED ON THE LIVE SHELF, NOT ASSUMED.** *"I think it's done"* is not a
> measurement, and the publish-before-tag ordering rests entirely on the row existing.
> `GET https://community.nodegx.io/api/v1/community/templates` → `total: 1`, one row,
> `members-area` / *Members' area* / `starter` / **`fileCount: 100`** — the same figure
> `tpl001Template.test.ts` §1 asserts about the bundle on disk, so it is a row **of the artefact
> we gated**, not merely a row with the right name. 🔴 **Read the content, never the status
> code** — the standing nexus-1 note that *"a 308 proves nothing"* is the same trap.
>
> **5. 🔴 THE SCREENSHOTS ARE GITIGNORED NOW, AND THE TEXT BESIDE THEM IS NOT.** Richard's call:
> six uncommitted drive runs were ~116 MB against a 412 MB `.git`. The rule covers images under
> `verdicts/` and `notes/` in the task tree; the `.txt`/`.json` dumps — **407 KB for those same
> six runs** — are committed, because they are what a later session diffs when it says *"113 of
> 120 identical"*. ⚠️ **201 MB of pictures stay tracked**: an ignore rule does not untrack.
> ✅ A picture a task file argues from still goes in with `git add -f`. Checked before writing
> the rule that nothing in `packages/` or `scripts/` reads those paths.
>
> ⬜ **WHAT IS ACTUALLY LEFT, and none of it is the cut.**
>
> - 🔴 **NOBODY HAS READ THE RELEASE WORKFLOW.** The tag push triggers a ~16-minute run that
>   builds and notarizes **15 assets**, and this session could not watch it. Per the runbook,
>   *do not read a published artifact as evidence a job was green* — electron-builder uploads
>   as it goes. `verify-release-assets` runs `if: always()`; `latest-mac.yml` must list all four
>   mac files under one `version: 0.2.2`. **First job: read that run.** If it failed, the
>   recovery order is release first, then tag ([`PUBLISH-0.2.2.md`](../release-0.2.2/PUBLISH-0.2.2.md) §3).
> - ⬜ **The GitHub release body** is drafted at
>   [`GITHUB-RELEASE-0.2.2.md`](../release-0.2.2/GITHUB-RELEASE-0.2.2.md) with two deliberate
>   blanks: the asset names, and the commit count (**851** at the tag; re-derive, it moved four
>   times during this session alone).
> - ⏳ **REL-015 AC9/AC11.** Richard gave one video and a channel on 09-06. **AC9 asked for two
>   videos**, and a **channel URL is not a video** — `splitVideoUrl` would store a provider id
>   that renders a broken player. The channel has **no slot anywhere on the platform**; it is
>   linked from the release notes and the changelog instead. Commands in
>   [REL-015 §6.8](REL-015-THE-SHELVES-YOU-CAN-FILL.md), **unrun — both write to the deployed
>   database**. AC11 needs prose a session must not invent.
> - ⏳ **REL-016** is Richard's call on the dead `devMode` flag — un-gating exposes two panels
>   nobody has driven, and it is two gates, not one.
> - ⏳ **REL-002c** closes on WORTHY, which is the V2 brief and needs a seam named by him.
> - 📋 **The registers still carry rows.** [TESTING-PASS §2.3](TESTING-PASS-2026-09-04.md) and
>   [NOTES-UNOWNED-NODE-WORK](NOTES-UNOWNED-NODE-WORK.md) — s55's finding stands: *"the board"
>   in a phase with a register is more than the task table*, and the remaining `NONE` rows there
>   are decisions rather than builds.


> ### 🟢 s56 (2026-09-05) — A SECOND ROW FOR THE SHELF: TPL-003, THE LANDING PAGES, BUILT IN ONE SESSION
>
> Richard asked for *"one more template to ship with 0.2.2 … no backend … a few different pages
> … 'top 3' landing page types."* It exists, he ruled it in (the launch page was rebuilt on his
> first look), and on his second ask it is **EMBEDDED** — `embedded://landing-pages` beside the
> site builder, no publish. Editor specs 172/172, MCP gates 81/81, look 2/2, both typechecks 0.
> Board row **REL-017**. Everything is in
> [TPL-003](../phase-78-the-templates/TPL-003-THE-LANDING-PAGES.md).
>
> **Next session: NOTHING to build here from s56.** **Nothing is committed** — the pathspecs are
> under REL-017 in `TASKS.md`, and two of them carry a peer's uncommitted unhold edit as well.
> ⚠️ The members' area is still a SHELF row awaiting his publish; he called it a packages template. ⚠️ If you regenerate the members' area for any
> reason, adopt `templatePins.ts` there (register L8) and run its gate.

> ### 🟢 THE PHASE'S "NOTHING LEFT" WAS TRUE OF THE REL ROWS AND FALSE OF THE PHASE, 2026-09-05 (s55)
>
> **One commit: `9d5be875`.** No REL row's ACs moved and none could — that half of s54's finding
> re-derived and holds. Full record: **[TESTING-PASS §5](TESTING-PASS-2026-09-04.md#§5)**.
>
> **1. 🔴 S54's HAND-OFF SAID *"no unowned, human-independent, buildable row left in this phase"*
> AND POINTED THE NEXT SESSION AT ANOTHER PHASE. THE BOARD IT RE-DERIVED WAS THE REL TABLE.**
> P82 also carries **two registers** — [TESTING-PASS §2.3](TESTING-PASS-2026-09-04.md) and
> [NOTES-UNOWNED-NODE-WORK](NOTES-UNOWNED-NODE-WORK.md) — whose rows are `NONE` by construction,
> and one of them was a build: *"Button `outline`/`ghost` icons ... correct **by inheritance**, but
> no gate pins the variants themselves."* ⚠️ **The lesson is not that s54 was careless** — its
> re-derivation was correct and its warning to re-derive was right. It is that **"the board" in a
> phase with a register is more than the task table**, and a finding of *nothing left* has to name
> which population it searched. This is the standing *"`asked − answered = absent`, never
> `everything − answered`"* shape, met on a board instead of a query.
>
> **2. ✅ THE GATE IS THE LINK BETWEEN TWO GREEN GATES, WHICH IS WHY NEITHER COULD SEE THE HOLE.**
> `icon-colour-defaults.test.ts` grades the declaration but renders a Button carrying **no variant
> at all**; DEF-001 grades every variant's colour on every ground in every palette and **renders
> nothing**. So *"is the icon visible on `outline`"* was covered from both ends and **not in the
> middle**: nothing held that a Button stamped with variant V hands its glyph V's colour. Break it
> and both stay green while the reported defect returns. 🔴 **Two gates covering the ends of a
> chain read as coverage of the chain.**
>
> ✅ **It exercises the product's chain rather than modelling it** — `ButtonConfig` →
> `applyVariant` → `node.parameters` → the `color` inputCss port → `setStyle` → `props.style` →
> `<button>` → `IconGlyph`, through a real node in a real graph (`createCorpusGraph`) rendered by
> its **own `render()`**. The glyph comes out as a bare `<span class="fa fa-check">` with **no
> `style` attribute at all**: the fix, seen rather than asserted. ⚠️ **No contrast is computed** —
> that is DEF-001's instrument and a second copy would be two readings that can disagree.
>
> | arm | reading |
> |---|---|
> | green | **39/39, `EXIT=0`**; package **98 suites / 1322 tests `EXIT=0`**, `tsc` **`EXIT=0`, 0 errors** |
> | A — `iconColor: '#FFFFFF'` back on the node (**the defect as it shipped**) | **6 red of 39 that all ran** |
> | B — `iconStyle.color = props.iconColor` deleted | **6 red of 39**, §4's rows |
> | C — a constant at the render site instead of the port | **6 red of 39**, §3's rows |
> | D — `ghost` loses its `color` in the config | **2 red of 39** |
> | E — a seventh variant added to the config | **39 → 45 tests**, exactly **1 red** |
>
> 🔴 **B and C are the discrimination pair and they redden OPPOSITE sections.** Both take a colour
> off the glyph. Without §4, *"the glyph declares no colour"* would read identically on a
> `_renderIcon` that had stopped emitting colour **at all** — an author's own choice silently
> dropped, graded as a pass. 🔴 **Arm E is what proves the population is derived**: a listed table
> would have stayed at 39 and graded the seventh variant not at all. All three mutated sources
> restored **md5-identical**.
>
> **3. ⚠️ THE ROW ASKED FOR FIVE VARIANTS. THERE ARE SIX** — `primary`, `secondary`, `outline`,
> `ghost`, `destructive`, `link`. A register row's own count is a hypothesis; the registry is the
> fact.
>
> **4. ✅ A SECOND REGISTER ROW WAS FALSE AND IS STRUCK** — *"Filter properties bar ... 1.00:1"*
> has been fixed, gated and committed since `645c3922`. s53 struck it in **NOTES §4** and not in
> **TESTING-PASS §2.3**, so it still read as open in the register a session would search. **A row
> struck in one of two registers is a row still costing somebody a rediscovery at full price.**
>
> ⬜ **WHAT THE NEXT SESSION SHOULD TAKE.** 🔴 **RE-DERIVE IT, AND FROM BOTH REGISTERS AS WELL AS
> the REL table** — that is the whole finding above. As measured this session, what is left in P82
> is: **REL-001** Richard runs the publish command; **REL-002c** needs a seam named by him (close
> protocol rule 6); **REL-004** Richard pushes; **REL-011c** held under D1; **REL-015** AC9/AC11 are
> his two links and one tutorial; **REL-016** is his call on the dead `devMode` flag. In the
> registers, the remaining `NONE` rows are all **decisions rather than builds**, and this is the
> part worth reading before picking one up:
>
> - **Dropdown, the collapsed input** ([NOTES §3](NOTES-UNOWNED-NODE-WORK.md)) — an author who
>   replaces `items` and never sets `value` gets a **4px** control, because the seeded `option-1`
>   matches nothing. 🔴 **The register's own "cheap remedy" — a default `placeholder` — is the
>   exact class of thing REL-002a REMOVED**: `text-input.ts`'s comment records `'Type here...'`
>   shipping onto **17 of 18** fields on `members-area`, manufacturing the rubric's own
>   placeholder tell. ✅ **Verified at HEAD that the remedy would work mechanically** —
>   `Select.tsx` renders the placeholder span in exactly the `selectedIndex < 0` branch, and a
>   fresh Dropdown never reaches it. So it is a real choice between a manufactured default and a
>   4px void, **not an oversight** — and it is Richard's, not a session's.
> - **Fill/Stroke inert for a custom SVG** ([NOTES §1](NOTES-UNOWNED-NODE-WORK.md)) — the row says
>   so itself: *"worth a decision, not worth taking silently."*
> - **"Add style variant" vs "Style → Variant"** — a design decision, stated as one.
>
> ⚠️ **So the honest statement is narrower than s54's and in the same direction**: P82 has no
> unowned buildable row left **that is not a decision** — and that sentence needs the registers
> searched to be worth anything.


> ### 🟢 D58 IS FIXED, AND P82 NOW HAS NO UNOWNED HUMAN-INDEPENDENT WORK LEFT, 2026-09-05 (s54)
>
> **One commit: `6101f96f`.** No REL row's ACs moved and none could — every open row is Richard's or
> held. Full record: **[D58](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d58)**.
>
> **1. ✅ D58 RE-DERIVED BEFORE IT WAS INHERITED, AND THE RED WAS REAL** — same spec, same line 327,
> same message. s53's instruction to re-derive was right to give and cost nothing to follow.
>
> **2. 🔴 THE STATED FIRST JOB SETTLED IT IN ONE READING, AND THE ANSWER WAS THE HYPOTHESIS D58 HAD
> EXCLUDED.** Printing arm A's ids gives `prep, withFlag, tasks, write, write, page-9, res`. `tasks`
> and `res` are both present, so the recorder did not stop writing rows; `page-9` ran and succeeded,
> so `publishPage`'s graph reached the node. **The id moved.** A probe over the deployed bundle
> closes the negative half: `/#__cloud__/publishPage` carries exactly one `SetDbModelProperties`,
> `page-9`, and **no `page-8` exists anywhere in the bundle** — the missing row was never a node.
>
> 🔴 **D58 excluded node-id renumbering against the WRONG ARTEFACT, and the exclusion was internally
> perfect.** It showed `site-builder.content.json`'s `page-*` ids byte-identical across the change —
> true, and irrelevant, because **this spec never loads that template**. It authors a fresh project
> through the real MCP door, and *the door rewrites ids on write*; `DEF-004` records the very same
> thing about this very same graph (`page` → `page-8`) and calls it *"two wrong instruments"*.
> `SB006_COMPONENTS` is authored first, REL-011c's seam lane gave two bands an `inner` node each, and
> `page-8` became `page-9`. ✅ **So "unknown how long it has been red" resolves to one commit,
> `4fbd8cd2`.** ⚠️ **The lesson worth carrying: a control run that reproduces the red proves the red
> is not YOUR change; it says nothing about which artefact the subject actually reads.** D58 ran that
> control, correctly, and drew a conclusion one step wider than it supported.
>
> **3. ✅ FIXED AS A CLASS.** `bundleIdFor()` resolves an **authored** id through the **deployed**
> bundle positionally and refuses to guess — a component whose bundled node list is a different
> length throws rather than returning a plausible id. The assertion names authored ids and asserts
> the three resolve to **three distinct** deployed ones.
>
> | arm | reading |
> |---|---|
> | green | **10/10**, and the package **131 suites / 1590 passed, 10 skipped, EXIT=0** |
> | A — the authored id verbatim (the pre-fix pinning) | **1 red of 10 that all ran**, on `recordedInA.has(id)` |
> | B — the mapping collapses to index 0 | **1 red of 10 that all ran**, on the cardinality assert |
>
> ✅ **The whole-suite number RECONCILES**: D58 recorded 130/131 and 1589 passed; it is now 131/131
> and 1590 — exactly the one suite and one test, nothing else moved. Source restored md5-identical
> after each arm. ⚠️ **Swept for siblings: none.** Every other literal `<base>-<n>` id in
> `nodegx-backend/tests` and `noodl-mcp/tests` belongs to a fixture authoring its own project.
>
> **4. 🔴 I REGISTERED A D59 THAT WAS WRONG AND WITHDREW IT BEFORE COMMITTING.** It said nothing
> typechecks `nodegx-backend/tests`. `tsconfig.tests.json` covers `tests/**/*.ts`, PLAT-004 built it
> for exactly that reason, and CI runs it at `pr.yml:39`. ⚠️ **What IS true and worth knowing before
> you try**: the package's own `typecheck` script excludes specs by design, ts-jest runs
> `isolatedModules: true` so the jest run does **not** type the file, and `tsc` over this ONE spec
> died `FATAL ERROR: Ineffective mark-compacts` at an **8GB** heap — **exit 134 after 634s, with
> `error TS` count 0 in the log**. That is the standing "counting error lines reads an OOM as a pass"
> trap, met head-on. **CI types this change; s54 did not, and does not claim to.**
>
> **5. ⚠️ ONLY MY OWN HUNK OF THE P77 REGISTER IS COMMITTED.** That file also carries a peer's
> uncommitted **D46/D57** hunks — a pathspec commit would have swept them, so mine went in through
> the index (`git apply --cached` on a split patch) and theirs are **still in the tree, untouched**.
>
> ⬜ **WHAT THE NEXT SESSION SHOULD TAKE.** 🔴 **Not a P82 row.** The board re-derived from the task
> files: REL-001 *Richard runs the publish command*; REL-002c needs **a seam named by him** (close
> protocol rule 6); REL-004 *Richard pushes*; REL-011c **held under D1**; REL-015's AC9/AC11 are his
> two links and one tutorial; REL-016 is his call on the dead flag. **Everything else is 🟢.** With
> D58 gone there is **no unowned, human-independent, buildable row left in this phase** — which is a
> finding, not a gap: what 0.2.2 is waiting on is Richard, and saying so is more useful than
> inventing work. ✅ **The nearest live buildable lane is P18** — but ⚠️ **`Subscribe To Changes` was
> taken by a peer WHILE THIS SESSION RAN** (`9055f34a`, P18 s90: picker 117/127, Tier 3.11 complete,
> *"no scheduled row left"*). So P18's next row is **s90's hand-off, not s89's**, and the editor write
> path is the standing candidate. 🔴 **RE-DERIVE IT FROM THE TASK FILE.** This pointer was accurate
> when written and stale within the hour — which is the argument for re-deriving every inherited
> "next", not for trusting a fresher-looking one.


> ### 🟢 THE CLOCK LANE, 2026-09-05 (s53) — added beside the other lanes, not over them
>
> **Two commits: `5c589970` (the stopwatch rows, closed) and `4fbd8cd2` (s52's whole lane,
> committed).** No REL row's ACs moved and none could — §A is unchanged and still Richard's.
>
> **1. 🔴 THE §B STOPWATCH ROW WAS RIGHT ABOUT THE SYMPTOM AND WRONG ABOUT THE CAUSE, AND THE
> PRESCRIBED FIX WOULD HAVE CHANGED NOTHING.** The row said `bld-004/reasoningChannel` and
> `aib-009/turnDeadline` *"run a 60ms stall window on a 2× margin"* and told the next session to
> raise `STALL_MS`. The margin is real; **the race is not, and raising the window would have bought
> exactly zero.** The heartbeat timer is always due `STALL_MS / 2` **before** the deadline's next
> check, and node fires expired timers in **expiry order** with microtasks draining between them —
> so however late the loop wakes, the heartbeat lands first and the check that follows reads a
> silence of ~0. 🔴 **Measured, not reasoned: with the event loop blocked 200ms out of every 5ms,
> the ORIGINAL spec still PASSED** (3227ms, up from a nominal 240ms). **Delay can make these tests
> slow. It cannot make the deadline lose.**
>
> 🔴 **WHAT ACTUALLY REDS IT IS A DIFFERENT CLOCK — jest's 5000ms per-test budget**, which is the
> same place s44's `projectFileWatcher` fix ended up (*"the stopwatch had merely moved from the spec
> to the runner"*). At twice that saturation bld-004 reads **5610ms and RED, as `Exceeded timeout of
> 5000 ms for a test` — not `AiTurnStalledError`**. ✅ **That is why s40 wrote it off as a flake: the
> failure names the runner instead of the subject.** ⚠️ **The criterion worth keeping: a stopwatch
> FAILS when the box is slow; a test that merely TAKES LONGER is not one** — and say which of the two
> you measured.
>
> ✅ **Fixed with fake timers, which is the right tool when the subject IS the clock.**
> `jest.useFakeTimers()` fakes `Date.now()` too, so elapsed time is something the test *states*:
> three tests went **250 / 150 / 90ms → 5 / 3 / 1ms**, and **5ms under the identical saturation that
> costs the original 3227ms**. Each assertion is also stronger than the one it replaced — *"the
> deadline never fired"* is now read at a moment the test chooses, instead of inferred from the turn
> happening to finish first.
>
> | arm | reading |
> |---|---|
> | green | **16/16, EXIT=0** (2 suites), and 5 suites / **50 tests** across both directories |
> | A — `onReasoning` stops calling `touch()` | **1 red of 16 that all ran**, by name, bld-004's reasoning test |
> | B — `onActivity` stops calling `touch()` | **1 red of 16 that all ran**, aib-009's slow-turn test |
> | C — `onText` stops calling `touch()` | **1 red of 16 that all ran**, aib-009's partials test |
>
> 🔴 **Every arm reds with an `AiTurnStalledError`, and that is the VACUITY CONTROL, not decoration.**
> If `Date.now()` were not faked the deadline could never fire under fake timers and all three tests
> would pass **for no reason at all**. A reverted arm that reds with the *domain* error is what says
> the fake clock is driving the code under test. Source restored **md5-identical** after each arm.
>
> ⚠️ **NOT changed, stated so it is not mistaken for an oversight**: aib-009's *"names the silence in
> seconds"* still spends a real **1002ms** against a 5000ms budget. By the criterion above it is not
> a stopwatch — a slower box makes it pass later, never fail — and it is not the registered row.
>
> 🔴 **METHOD TRAP THIS COST 120 SECONDS OF WALL CLOCK.** The control that saturates the loop must
> **self-limit by wall clock**. An unbounded `setInterval(() => block(400), 5)` starves the
> **harness**, not just the subject: `jest.advanceTimersByTimeAsync` needs REAL macrotask hops of its
> own, so the run hung past the 120s tool timeout, backgrounded, and had to be killed by pid. Every
> blocker now carries `if (Date.now() < stopAt)`.
>
> **2. ✅ S52'S ENTIRE LANE IS COMMITTED — `4fbd8cd2`, nine files, ~1,100 lines.** It was built,
> measured and written up, and then left loose in a shared checkout, which is the documented way work
> gets swept. ✅ **Two of its three gate readings were RE-TAKEN at HEAD before committing and
> reproduce s52's exactly** — `noodl-mcp` **95 suites / 1318 EXIT=0**, `tsc -p noodl-mcp` **0**,
> `test:main` **425 / 7144 EXIT=0** (which is what grades the regenerated artefact, through
> `tests-unit/sb-007/site-template.test.ts`). ⚠️ **Two were INHERITED and are s52's word, not mine**:
> the `sb008` browser drive (31/31) and `vib001-site.look.ts`, both needing a live backend and a
> browser; and *"`template:site-builder` regenerates to the same md5 twice"* — **the generator has no
> `--out-dir`**, so re-deriving that means writing over a shared artefact, which is not a thing to do
> with peers in the tree. ⚠️ Left OUT on purpose: another lane's **untracked**
> `noodl-mcp/tests/sbr011LivePreview.test.ts` (it WAS in the 95-suite reading), and P77's
> `DEFECTS-…md`, which carries a peer's D57 hunk.
>
> **3. ⚠️ TWO HANDOFF CLAIMS RE-DERIVED AND FOUND STALE — both said work was left to do that is done.**
> **[NOTES §4](NOTES-UNOWNED-NODE-WORK.md)** *"the property panel's two small ones"*: the filter
> field's 1.00:1 contrast is **fixed, gated and committed** — `propertyeditor.css:349`
> (`input.property-filter-input`, an element+class selector so it beats `.SearchInput` regardless of
> load order), graded by `nat-001/palette-contrast.spec.ts`'s last `PAIRS` row, commit **`645c3922`**.
> Only the *"Add style variant vs Style → Variant"* half is open, and that one is a design decision.
> And **s37's** *"the only human-independent buildable work left is Shape/SVG stages 2 and 3"*: both
> **shipped in session 39** ([NOTES §1](NOTES-UNOWNED-NODE-WORK.md) stages 2 and 3).
>
> ⬜ **WHAT THE NEXT SESSION SHOULD TAKE, IN ORDER.** §A is Richard's, entire; §B is now one row
> shorter. The one registered, unowned, human-independent thing left is **[D58](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md)** —
> `sbr015-execution-steps-drive` red at HEAD, 130 of 131 backend suites passing. **Its stated first
> job is to print arm A's recorded node ids**, and the obvious hypothesis (node-id renumbering, the
> D42 shape) is already **excluded by measurement**. 🔴 **Re-derive that red before inheriting it** —
> this session's whole first item is what happens when you do not.

> ### 🟢 THE SEAM LANE, 2026-09-05 (s52) — added beside the other lanes, not over them
>
> **Richard named the seams and they are BUILT.** §9.3 had stopped at *"what is left to re-show him
> is seam 2 and seam 5"*, because §4 forbids building the look until he names it. Shown the board,
> he chose **seam 2 = demote the status, promote the action** and **seam 5 = per-kind width AND
> rhythm**. Full record: **[REL-011 §11](REL-011-THE-SITE-BUILDER-SHIPS.md)**.
>
> ⚠️ **THE HOLD IS NOT LIFTED.** D1 stands, `HELD_TEMPLATE_IDS` is untouched, AC3 is still his
> ruling. This built the two things §9 identified as the product's own; **it did not re-rule them.**
>
> **Seam 2** — the loudest thing in every admin row was `Published`, a solid filled pill: **the one
> element a person cannot click, out-shouting the two they can**, which were themselves identical
> bordered chips. Status is now an 8px dot plus a quiet word; `Edit` is the only filled control in
> the row; `More` is a ghost. 🔴 **Both copies moved** — `/Pages/PageEditor` carries an identical
> cell fed by an identical function, and demoting one would have rendered the same fact two ways
> with **no gate able to see it**, because each copy is internally consistent.
>
> **Seam 5** — the measure was on `Page shell`, an **ancestor of every section**, and the rhythm was
> one `var(--space-4)` on `One section` **for all five kinds**. There was nowhere a per-kind decision
> could be expressed. Both moved down: hero and CTA **bleed to the window**, gallery/passage/contact
> stay at the measure with three different rhythms. Each bleeding band gained one node (`inner`) —
> a band cannot hold its ground at the viewport and its words at the measure with one box.
>
> 🔴 **THE FIRST RENDER FOUND A DEFECT EVERY SPEC WAS GREEN ON.** The per-kind padding was added
> *on top of* `siteMain`'s existing `rowGap`, so every gap was counted twice and **the photograph
> came back looser than the page ruled SHITTY for being uniform**. Fixed. ✅ A per-kind decision is
> only a decision if the per-kind value is the whole of it — nothing but rendering it could say so.
>
> 🔴 **TWO GATES HAD HOLES SHAPED EXACTLY LIKE THIS CHANGE, and neither would have failed.**
> `sb006PublicSite` asserted *"some node states the measure"* and **went on passing** once it moved,
> because `Header` answered the same question. And `measureClamp.ts` read `main.parentElement` —
> left alone it would have reported **`max-width: none` in BOTH arms**, which is D57's shape and the
> exact defect SBR-003 AC5 exists to detect, from a probe aimed at a box that no longer carries the
> measure. Both re-aimed and both now assert **both directions**.
>
> ⚠️ **`sb008` §7's pair moved 528 → 576 and NOTHING WAS RE-FITTED.** s51 wrote it as the equation
> `box = parent − padding`; `parent:1232 − padding:48` became `parent:1280 − padding:0` and it went
> green untouched. **The clamped end did not move at all** (704px), which is what shows the token
> still resolves and only the box changed. The control-arm edit count moved **1 → 3** and the spec
> said so rather than passing quietly.
>
> 🔴 **A GATE STAYED GREEN FOR A WHOLE 95-SUITE RUN BECAUSE IT READS THE COMMITTED ARTEFACT.**
> `GHOST_BUTTON` first used `backgroundColor: 'transparent'`, which reds `sbr014ControlStyleCensus`
> (REL-011a's *"53 of 53"*) — a keyword is exactly the outside-the-palette value it exists to catch,
> and it would have taken 53 back to **52**. It only spoke after the template was regenerated. The
> ghost's ground is now `var(--background)`. ✅ **Measure the artefact, not the last green run.**
>
> **Readings**: `noodl-mcp` **95 suites / 1318 EXIT=0**; `tsc -p noodl-mcp` **0**; `test:main`
> **425 / 7144 EXIT=0**; `sb008` browser drive **31/31**; `sb005AdminPanel` 34→**39**;
> `sb006PublicSite` 59→**67**; `vib001-site.look.ts` EXIT=0 both arms; `template:site-builder`
> regenerates to the same md5 twice.
>
> ⚠️ **`test:main`'s recorded floor is STALE IN THE GOOD DIRECTION.** P77's handoff carries
> *"3 failed, 401 passed / 4 failed, 6647 passed, owner NONE"* (`sb-018` ×2, `aib-007`). **All three
> are green** and the totals are 425 / 7144. **Re-derive that floor, do not inherit it.**
>
> 🆕 **[D58](../phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md) — REGISTERED,
> owner `NONE`, and it is NOT this change.** `sbr015-execution-steps-drive` is red at HEAD (130 of
> 131 backend suites pass; it is the only one). The obvious hypothesis — node-id renumbering, the
> D42 shape — was **excluded by measurement**: the `page-*` ids are byte-identical across the change,
> and the suite **fails identically with HEAD's artefact swapped in** and restored. First job for
> whoever takes it is to print arm A's recorded node ids.
>
> ⚠️ **`judge()` keys by `today()`, so this session's renders OVERWROTE the 09-05 corrected-instrument
> shots.** The **09-03 shots Richard ruled on are intact**; a same-day before/after pair for this
> change does not exist.
>
> ⬜ **What is left on REL-011c is what it always was: his ruling.** The pictures to re-show him are
> `verdicts/vib-001/2026-09-05/site-builder-living/` — `public-home-*` for seam 5 and
> `admin-pages-*` for seam 2. **Nothing else in this lane is buildable without him.**
>
> ⚠️ **Uncommitted, all of it.** `packages/noodl-mcp/tests/sb005Components.ts` ·
> `sb006Components.ts` · `sb005AdminPanel.test.ts` · `sb006PublicSite.test.ts` · `measureClamp.ts` ·
> `packages/nodegx-backend/tests/sb008-public-site-drive.test.ts` ·
> `packages/noodl-editor/tests-unit/sb-007/site-template.test.ts` · the regenerated
> `site-builder.content.json` · this file, `REL-011-…md`, and P77's `DEFECTS-…md` (which **carries a
> peer's D57 hunk — a pathspec commit on it would sweep that**).

> ### 🟢 THE UNGATED LANE, 2026-09-05 (s46) — added beside the other lanes, not over them
>
> **The board was right that no REL row was buildable, and it was wrong that nothing was.** Two
> registered rows with owner `NONE` were re-measured. One was a real hole and is now closed with a
> gate; the other had been fixed an hour after it was written and nobody had struck it. Commits
> **`bee37739`** and **`d3c56a3b`**.
>
> **1. ✅ THE ONE FIX FROM RICHARD'S TESTING PASS THAT SHIPPED WITH NO GATE NOW HAS ONE** —
> `tests-unit/ben-004/previewScopeMenuRead.test.ts`, **14/14, EXIT=0**, and red on four separate
> reverts. Finding 6, the workbench dropdown that could not see a component created since the
> project opened, was fixed in `16f38e7963` and deliberately left ungated.
>
> 🔴 **The reason it was written off was right about the conclusion and wrong about the cause, and
> the difference mattered.** The commit said *"`@testing-library/react` is not installed, so the
> menu cannot be opened in a spec"*. The dependency **really is absent** — the tree has
> `@testing-library/dom`, `jest-dom` and `user-event`, no React binding — and it was **never the
> blocker**: `PreviewChrome.tsx` imports `@noodl-core-ui/.../Icon`, whose `require.context` ts-jest
> rejects outright (`Icon.tsx:207`, `TS2339`), so the module fails the suite **to run**. Installing
> the dependency would have bought nothing. ✅ **A two-line probe measured both sides in one run
> before anything was written** — `previewScope.ts` clean with 17 exports, `PreviewChrome.tsx` that
> error and **zero**. *This is the third time the `Icon` trap has been paid for.*
>
> ✅ **The decision was never in the rendering.** *"What list does the menu read when it opens"* is a
> function from a getter to an array, so it moved to `previewScope.readMenuComponents` and `open()`
> calls it. §1 grades the premise, §2 the identity, §3 **Richard's bug reproduced** through the real
> `benchTargets` behind a faithful `useMemo` (`Object.is` per dep — the live-array arm computes
> **once** and `/Cards/New` is not in the menu), §4 the wire.
>
> | arm | reading |
> |---|---|
> | green — the reverted line named in `open()`'s comment | **14/14, EXIT=0** |
> | A — `readMenuComponents` returns `getComponents()` | **5 red of 14** |
> | B — `open()` reverted to `setComponents(getComponents())` | **2 red of 14**, EXIT=1 |
> | C2 — `stripComments()` removed from the spec's own reader | **1 red of 14** |
> | D — `ProjectModel.getComponents()` made to copy | **1 red of 14**, restored md5-identical |
>
> 🔴 **Arm C2 is the one that answers the original commit's other warning** (*"a source-text
> assertion would pass on dead code"*). The fix's own prose quotes the reverted form, so without the
> strip the **documentation** reddens the gate — and a differently-worded comment could equally have
> passed on behalf of a line that had been undone. C2 says the strip is load-bearing, which is why
> the reverted form is now named in that comment **on purpose**.
>
> 🔴 **AND THE GATE'S OWN §1 WAS A CLAIM ITS INSTRUMENT COULD NOT MAKE.** The first draft labelled a
> `ProjectModel`-shaped **stub** *"the known-firing control — if this reads `false`, ProjectModel
> started copying."* **A stub does not notice when the thing it imitates changes.** §1.3 now reads
> the two lines off `projectmodel.ts` itself, and Arm D is what proves it fires. ⚠️ **Ask of every
> restated fixture: what would this read if the thing it restates had moved?**
>
> **2. ✅ REL-002c §9.7 ITEM 2 STRUCK — the site-builder outline gate was built fifty-three minutes
> after the row was typed.** The row (*"ships 26 `as` tags and nothing holds them there. Owner:
> `NONE`"*) was saved at 22:30 on 09-03; **`373375fd`** landed at **23:23 the same evening** with
> that sentence's own numbers in its subject. `sb007Template.test.ts` §12 is a **full peer** of the
> members' area census, not a subset — one `h1` per page over seven pages, one `main` per page, the
> `h1` **inside** the `main`, the nav resolved from the artefact, no node carrying an `as` its type
> has no port for, and the same near-miss control. **Read green, not inferred: 9 passed, EXIT=0**,
> including two mutant rows. ⚠️ **Its claim is not what a skim takes it for** — the heading-*order*
> check is a different gate (`headingOrder.test.ts`, s41, both artefacts); what was missing was the
> **landmark census**. Both now exist, for both templates.
>
> **3. ⚠️ TRAPS THIS SESSION PAID FOR, BOTH REGISTERED ALREADY.**
> 🔴 **`npx jest` from the repo root is a DIFFERENT RUNNER.** There is no root jest config and no
> root jest gate, so it falls back to **babel-jest**, which cannot parse `import { x, type T }` —
> **`Tests: 0 total`**, three times, on arms that were fine. The cause was `cd X &&` persisting its
> cwd into a later call; the same trap also made `rm -rf <relative path>` exit 0 against a path that
> did not exist there. ✅ **`cd <abs> && pwd && npx jest …` in ONE command**, and the FAIL line names
> the runner: the editor's prints `tests-unit/…`, the root one `packages/noodl-editor/tests-unit/…`.
> 🔴 **A peer's half-saved spec read 4 red, then 19 green ninety seconds later** — `syl-j1` was
> mid-write. It was **not** in the gate run below as that; the run caught an earlier saved version
> and passed it.
>
> **4. ✅ GATES.** `npm run test:main` **426 suites / 7136 tests, EXIT=0, zero reds**;
> `npm run typecheck:editor` **0 `error TS`, EXIT=0**; `tests-unit/ben-004` **14/14**;
> `sb007Template.test.ts` §12 **9/9**.
> ⚠️ **`test:main` reconciles against s44's 423/7086 as +1 suite/+14 mine and the rest peers'
> untracked lanes in the same tree** — two runs an hour apart read 425/7115 then 426/7136, and the
> drift between them is not mine. ⚠️ **The editor's `test:ci` was NOT run and is unreadable today**:
> a peer lane holds uncommitted specs under `packages/nodegx-export/tests`, which reddens that gate
> for everyone (registered trap). The two jasmine specs that touch `previewScope` live there; this
> change to it is **purely additive** — one new exported function — and their subjects are untouched.
>
> ⬜ **No REL row's ACs moved and none could.** §A's queue is unchanged and still Richard's. What
> changed is that the phase's `NONE`-owned register is two rows shorter, and one of those two was a
> hole rather than a stale line.

> ### 🟢 THE CUT LANE, 2026-09-05 (s45) — added beside the other lanes, not over them
>
> **The board said everything left was Richard's, and it was right about the ROWS and wrong about the
> DOCUMENTS he cuts from.** Nothing here builds a feature; it makes the two files the release is
> executed out of true, and it found one ordering defect that would have shipped.
>
> **1. 🔴 THE RELEASE NOTES ADVERTISED A TEMPLATE THE APP DELIBERATELY DOES NOT OFFER, AND A SHELF
> THAT IS EMPTY.** `EmbeddedTemplateProvider.list()` returns **zero rows** in 0.2.2 —
> `HELD_TEMPLATE_IDS` holds `hello-world` (it *is* the blank project) and `site-builder` (Richard's
> D1) — so the create wizard and REL-013's new Templates tab draw **only** what the community shelf
> serves, and until `publish-project-template.ts` runs that is nothing. The notes' §"Alongside it, a
> **site builder** template and the admin shell that goes with it" was simply **false**, and its
> first headline is *"templates you can start from"*.
>
> 🔴 **The runbook made it worse by being technically correct.** §6 said the publish and the tag
> *"neither blocks the other, and row 7 can go first"* — true about **mechanism** (G5a), and read as
> **"the order does not matter"**. It does: tag first and 0.2.2 ships an empty shelf under notes that
> lead on templates. Nothing red, no gate failing, the release just wrong about itself. §6 now says
> **publish, confirm the row is live, then tag**, with the measurement under it.
>
> **2. ✅ REL-001's PRECONDITIONS RE-DERIVED AT HEAD — ALL GREEN, so the one action he is about to
> take is safe to take today.** Four top-level entries; **100 files**, which reconciles exactly with
> `tpl001Template.test.ts` §1's own control (`32 × 3 + 4`) — **the submission file's "94 files" is the
> 09-01 figure and is superseded**; no `.mcp.json` / `CLAUDE.md` / `.gitignore` (the FIX-008 B hazard,
> and `readBundleDirectory` has no skip list of any kind); no `.env` / `*.key` / `*.pem`; and a
> content scan finding **no absolute developer path and no credential-shaped literal** — every
> `secret`/`password` hit is a port name, a param name or a node id. ✅ **AC7 graded without
> regenerating anything**: §1 already compares every byte of every file against a fresh build, and it
> reads **82/82, EXIT=0**. A regenerate over a shared artefact was the obvious move and was the wrong
> one.
>
> **3. 🔴 A REGISTERED §B ROW WAS FALSE — `noodl-core-ui`'s jest DOES run in a CI gate.** It is in
> `pr.yml`'s package job (`npm run test:packages`, on `pull_request` **and** `push`), it is the
> **first** `--scope` in that script and has been since before session 39 wrote the row, all 16 scopes
> resolve against the packages' declared names (**0 unresolved**), and the suite reads **29 suites /
> 551 tests, EXIT=0** at HEAD. ⚠️ **The reading that nearly confirmed the row was `lerna list`, which
> hides private packages** — 11 of 16 — and `--all` is what makes the population honest.
> 🆕 **The real residual is registered instead** (§B): core-ui is **8th of 16** topologically and
> `lerna run` bails on the first failure, so a red in any of the seven before it means those 551
> specs never run. `--no-bail` was **not** applied — those suites bind real sockets, which is why the
> job is serial.
>
> **4. ✅ THE NOTES' NUMBERS ARE ALL RE-DERIVED, AND THE INSTRUMENT IS NOW WRITTEN DOWN.** 573 → **760
> commits** (238 feat / 126 fix / 369 docs), eleven → **fifteen days**. 🔴 **The per-workstream counts
> could not be reproduced from the old numbers** — a first pass read the alpha-feedback round *lower*
> than 09-01's figure, which over four append-only days means the instruments differ, not that
> commits vanished. So all of them were re-taken with **one stated instrument** (the `type(scope):`
> scope, split on `/` and `,`, de-duplicated per commit) and the instrument is printed in the notes:
> export **92**, templates-driven **54**, alpha feedback **37**, site-builder **55**, and the 0.2.2
> round **57** — which had never been written up at all and is the part a user meets first.
> ⚠️ **P18's alpha paragraph (114 of 127, 89%) was left untouched** — it is their number and they
> maintain it in this file.
>
> **5. ✅ TWO "KNOWN AND OPEN" ITEMS WERE FIXED, NOT CARRIED, AND WERE STILL BEING SHIPPED AS OPEN.**
> *"Four of the thirteen pages have never been photographed"* — all four are photographed at four
> widths in both arms (120 shots, `phase-81/verdicts/vib-001/2026-09-03/`). *"Eleven pages have no
> bottom edge"* — `Members/Footer` is placed on **13 of 13**. Both struck, with the measurement kept
> so the strike is auditable.
>
> ✅ **Board corrected, re-derived from the files**: REL-001 had read *"the condition is BUILT but NOT
> YET RE-RULED"* for a day after [§6.5](RICHARD-RULINGS-2026-09-04.md) recorded *"Unsubscribe is
> passable now"*. **D2's condition is MET**; the members' area reads 15 PASSABLE / 0 SHITTY.
>
> ⬜ **No REL row's ACs moved and none could** — §A's queue is unchanged and still his. What changed
> is that the two documents he executes the cut from are now true, and they were not.
>
> ✅ **DRIVEN AFTER THE FACT — the empty shelf is confirmed in the running app, on BOTH surfaces.**
> The claim above was read off source (mechanism); a peer freed the editor, so it was graded as a
> consequence. A 0.2.2 dev stack, launcher only, no project opened:
>
> | surface | what it renders |
> |---|---|
> | **Templates tab** | *"**No templates published yet** — Nothing has gone wrong, the shelf is simply bare for this release."* **Zero rows.** REL-013's AC4 state, and the old *"this feature is coming soon"* placeholder is gone |
> | **Create wizard → Start from a Template** | *"**There are no templates to start from right now.** Go back and pick another way to start."* **Zero rows**, and **`Next` is disabled** |
>
> 🔴 **The control that makes this mean anything: the tab has TWO empty states that look alike and
> mean opposite things** — *"No templates published yet"* (nothing published) and *"Templates could
> not be loaded"* (the fetch failed). A failed community request would have rendered the second and
> could have been read as confirming the first. **It rendered the first**: `isUnreadable` false,
> `isLoading` false, no *"coming soon"*, no unwired-host state. And the two surfaces print
> **different sentences**, so neither reading is the other bleeding through the modal — which it
> nearly was, since the tab sits behind the wizard and `document.body.innerText` picks up both.
> Screenshots taken of each.
>
> ⚠️ **What this still does NOT establish**: that the **production** shelf is bare. The fetch
> completed and returned nothing, which is stronger than a source reading, but a dev stack's
> community endpoint is not provably the production one. Confirming that needs the production
> `DATABASE_URL`, which is his.
>
> ⚠️ Nothing was created — the wizard was cancelled at the picker, and the projects directory is
> unchanged (newest entry 13:41, another session's). `templates/members-area` was never opened.
> Stack torn down: **25 processes stopped, 0 left**, the 6 peer MCP servers untouched.

> ### 🟢 THE GATE LANE, 2026-09-05 (s44) — added beside the other lanes, not over them
>
> **`test:main` now reads 423 suites / 7086 tests, EXIT=0, ZERO reds — the first fully green
> reading in this phase's record**, and it was taken *with* a peer's 7-suite jest overlapping it.
> Committed as **`b3037aa1`**. Getting there meant three separate faults, not the one that was
> registered.
>
> **1. `rel-009b/projectFileWatcher.test.ts` was a stopwatch.** A flat **600ms** budget for a
> **60ms**-debounced `fs.watch` event. The number nobody had taken: the batch lands at **73ms**
> (5 runs, 72–74ms), so the budget was **~8× headroom on a chain of timers** and two concurrent
> suites ate it. It waits on the **event** now — **278ms**, was 607ms.
>
> 🔴 **THE FIX WAS WRONG UNTIL THE GATE WAS READ TWICE.** jest's default per-test timeout is
> **5000ms** and the ceiling was 10s, so **the ceiling could never be reached**: the stopwatch had
> merely moved from the spec to the runner. Whole-gate run #1 **passed** (at 6.18s of suite time
> against 278ms alone — already on the boundary while reading green); run #2 **died on the runner
> timeout**. ✅ Ceiling is 30s with an explicit **35s `it()` timeout** above it, and they move
> together. **A single green gate run would have shipped this.**
>
> 🔴 **Three of the arms were wrong before they were right, and every correction came from READING a
> control rather than adjusting it.** (a) Arm C — ceiling cut below the latency — **PASSED**: the
> 200ms settle is itself a wait and supplied what the ceiling refused, so the ceiling was
> **decorative** and a later trim would have re-introduced the bug. Fixed by latching the answer
> before the settle is spent. (b) The first latch was a bare `expect()` **before** `watcher.stop()`,
> so a failure leaked the `fs.watch` handle and **jest never exited** — failed correctly in 35ms,
> then sat **7 minutes** until killed, **EXIT=143 not 1**. A spec that HANGS the gate is worse than
> one that reddens it. (c) Arm A briefly read **`Tests: 0 total`** — built by surgery it stripped the
> latch declaration and left its assertion, grading nothing while looking like a red. **16 total in
> every arm is what says each one graded something.**
>
> ✅ **The defect is reproduced DETERMINISTICALLY without loading the box** — stretching the
> watcher's own debounce to 900ms past a 600ms budget *is* "the callback was not scheduled in time".
> No peer's drive had to be disturbed to get a red.
>
> **2. 🔴 `sb-007/site-template.test.ts` was red at HEAD, from ANOTHER PHASE, and no per-package run
> could see it.** `expect(a.size).toBe(401)` against a template holding **406**. Reconciled exactly
> rather than adjusted to fit: **`f77e6647` (P77/SBR-007 AC3, 13:37 the same day)** adds five ids to
> `/Admin/SectionRow` — `dropZone`, `dropHint`, `dropWords`, `dropRefused`, `dropRefusal`.
> **401 + 5 = 406.** The gate lives in `noodl-editor`, the nodes live in `noodl-mcp`, **so a
> per-package run on either side is green** — the registered *"a literal count gate only works if
> somebody runs it"* trap with a package seam under it. ⚠️ **The count was reconciled; the FEATURE
> was not reviewed** — SBR-007 is phase 77's.
>
> **3. 🔴 REGISTERED, OWNER `NONE` — the stopwatch class is NOT unique.**
> `bld-004/reasoningChannel.test.ts:198,230` and `aib-009/turnDeadline.test.ts:19,94–117` both run a
> **60ms** stall window against a `sleep(STALL_MS / 2)` heartbeat — a **2× margin**, tighter than the
> 8× that was failing. **`bld-004` is the OTHER red s40 recorded and wrote off as "a lone red under
> concurrent load": the two reds in that session were ONE FAULT WITH TWO HOMES.** ⚠️ The source is
> **not** at fault — `turnDeadline.ts:27` reads `Date.now()` deliberately because Chromium throttles
> `setTimeout` in an occluded window, and there is no clock seam; the fix is spec-side (raise
> `STALL_MS`, keep the beat small in absolute terms). **Untouched here — they belong to BLD-004 and
> AIB-009.**
>
> ⚠️ **The `b3037aa1` baseline is NOT a clean-HEAD reading**: the tree carried another lane's
> uncommitted SBR-011/D46 realtime work throughout, and that lane said so before the run. It is
> **HEAD + D46 + two test files**.
>
> ⚠️ **`b3037aa1`'s message has one cosmetic gap** — backticks in a `-m` string were
> command-substituted, so *"Arm A briefly read `Tests: 0 total`"* lost its quoted phrase. A peer
> committed on top before it could be amended and shared history was not rewritten for a cosmetic
> defect. **[§6.4](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md) carries the correct statement.**
>
> ⬜ **The phase's own queue is unchanged and still Richard's** — see §A below. This lane touched no
> REL row's ACs; it fixed the gate every other row is read through.

> ### 🟢 THE DRIVE LIST IS EMPTY, 2026-09-05 (s43) — added beside the other lanes, not over them
>
> **The last three undriven items are driven, and none of them needed a fix.** A freshly placed
> **Dropdown** renders **64.09px wide showing "Option 1"** (panel: *Items* "2 items", *Value*
> "option-1"); a pasted **YouTube** share link becomes one
> `youtube-nocookie.com/embed/…?start=90` **iframe with zero `<video>` elements**, and the poster
> frame really loads; the **Shape** enum offers all six values and **every `dynamicports` gate holds
> on all six arms**, each printing its own sentence. Full record with the tables:
> [NOTES §5](NOTES-UNOWNED-NODE-WORK.md).
>
> 🔴 **A control, not an assertion, is what makes the Dropdown reading mean anything.** With `value`
> set to something matching no item the wrapper collapses to **4px with no span at all** — and
> `select.value` **still reports `option-1`** in that arm, because the browser refuses an unmatched
> value. **Anyone grading this node through `select.value` would have passed both arms.** The
> original arm was re-run afterwards and came back byte-identical (`64.0859375`).
>
> 🔴 **THE INSTRUMENT WAS WRONG FIRST AND HAD A SOURCE CITATION TO PROVE IT.** Reading the panel by
> label text made every shape look identical, and `nodelibrary.ts:100` really does have the
> `conditionalports` manager commented out — a perfect fit for *"the gates never reach the panel"*.
> **They do**: this panel greys an inapplicable port and explains it
> (`div.property-port-gated-control[aria-disabled=true]`), which no label query and no
> `getComputedStyle` on the label can see. **One screenshot was the discriminator and should have
> been the first instrument.** ~⅓ of the session.
>
> ⚠️ **Two things the drive did NOT measure**, so do not read them as green: the spurious-`Changed`
> claim (nothing was wired to `onChange`) and *Start Time beats a URL `t=`* (only the URL was set).
>
> ⚠️ **The stack died once mid-drive** — every Claude process on the box restarted, the launcher went
> with it, and all peer session names changed. The launch announcement went to names that no longer
> exist. Nothing was lost; the drive was simply re-run.
>
> ⬜ **What is left in the phase is now, with no exception, Richard's** — §A's queue below. There is
> no buildable and no drivable row behind it.


> ### 🟢 THE DRIVES LANE, 2026-09-05 (s42) — added beside the other lanes, not over them
>
> **The two rows that were "asserted only" are now measured, and neither needed a fix.**
>
> **REL-012 — all five ACs graded, from ASSERTED-ONLY to a reading.** AC2/3/4 by
> `npx jest tests-unit/rel-012` (**2 suites / 30 tests, EXIT=0**). **AC1 on a real packaged
> artefact** built here (`build:bundles`, then `electron-builder --mac --arm64 --dir`, both EXIT=0):
> `NodeGX.app/Contents/Resources/lessons` present, **4 bundles / 122 files**, and the reverted arm
> was already on disk — the **2026-08-20 build has no `lessons` directory at all**. 🔴 The stowaway
> filter was graded **with a presence control**: the source really does carry two `.mcp.json` files
> naming a developer's absolute paths, and **124 − 2 = 122** reconciles exactly. **AC5 driven, both
> arms**: a clean profile seeds 3 lessons and *Log a thing* opens; the reverted arm (the one
> `seedShippedLessonsOnStartup()` line disabled) lands on *Your path* with **no register file
> written at all**. ⚠️ A peer has since committed a 4th and 5th bundle — the 4/122 reading is the
> artefact that was measured, not a claim about today's tree.
>
> **REL-016 — all five pre-ungate checks PASS**, so FIX-015's *"expect a bug list"* did not hold.
> 🔴 **But the gate is not what the row thought**: `if (config.devMode)` at `router.setup.ts:435` is
> dead in **every** build — `config-dev.js` is required by nothing — so `design-tokens`,
> `file-explorer` and `undo-queue` register **nowhere, dev included**. Measured as an A/B on the
> live experimental-panels list (6 entries, then 9). ⚠️ And un-gating is **two** gates:
> `experimental: true` keeps it behind a per-user Settings toggle that is off by default.
>
> 🆕 **New instrument, and the only source change left in the tree:**
> `packages/noodl-editor/scripts/start-electron-dev.js` now honours **`NOODL_USER_DATA_DIR`**
> (Chromium's `--user-data-dir`), which is how a *first-run* drive is done without touching the
> developer's own profile. ✅ Richard's `learning_folder.json` md5 is **unchanged across the whole
> session**. **Uncommitted, and not asked for.**
>
> ✅ **The board was stale in two more places and both are corrected off the commits**: REL-013
> (`14c9bd90`) and REL-014 (`9d58c505`) were ⬜ and are built. Full records:
> [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) and
> [REL-016](REL-016-THE-TOKENS-NOBODY-CAN-EDIT.md).
>
> 🔴 **Two editors cannot coexist on this checkout** — a second Electron on a second profile reaches
> `DevTools listening` and then aborts on *"async hook stack has become corrupted"* (port 8574 taken
> → `showMessageBox` from a `net` error handler). Every control arm here therefore costs a full
> stack restart.
>
> ⬜ **Still undriven, and now the whole of the drive list**: a freshly placed Dropdown, a YouTube
> link in a Video node, the Shape node's five shapes in the property panel.


> ### 🔴 SITE-BUILDER LANE, 2026-09-05 — added beside another session's handoff, not over it
>
> **The 9-SHITTY ruling on REL-011c AC3 was taken on pictures wearing the HARNESS's palette.**
> `vib001-site.look.ts` seeded a `Theme` row with four invented values; `#1f6feb` — §3 seam 1's
> *"the framework's default blue"* — is that seed's `colorPrimary` byte for byte, on 9 of the 10
> screens. The **door** arm, which seeds nothing, renders Studio's `#1e4d8c` correctly and was the
> control all along. Seam 4's "gradient rectangles" were the seed's `SWATCH` too.
> **Fixed** (a shipped preset, imported; four real photographs), and the door arm is **byte-identical
> across the change** — 32 PNGs, combined `md5=6d90f842`.
>
> **§3 seam 3 WAS the product, survived the instrument fix, and is built**: `minHeight: 100vh` +
> `alignItems: 'stretch'` on `Admin frame`, and the rail to `sizeMode: 'contentHeight'`. Four
> pixel-sampled arms; 🔴 **arm 3 (`stretch`) moved nothing** — a three-arm run would have shipped it.
>
> ✅ **COMMITTED 2026-09-05 (s41) as `02a3c924`**, on Richard's instruction, once the peer's
> `p18-row8` merge had landed and `MERGE_HEAD` was gone — the five files exactly, by pathspec, with
> `createProject.ts`, `validate.ts` and `sbr011LivePreview.test.ts` (three OTHER lanes' uncommitted
> work in the same package) untouched. Readings as recorded: `noodl-mcp` **93 / 1261 EXIT=0**;
> `test:main` **423 / 7086 EXIT=0**.
>
> ✅ **The +3 unattributed tests are NAMED — and no suite was run to do it.** They are a peer's
> commit landed **between the two arms**: `5f407849` (the members-area lane, 08:54) adds exactly
> three `it()` blocks to `tpl001Template.test.ts`, and its own message records the whole-suite
> reading — **93 / 1260**. So **1257 + 3 + 1 = 1261**. 🔴 **§8's registered trap, one level up**: the
> four LOOK arms were flagged artefact-varied-not-commit-controlled and the two SUITE arms had the
> identical defect unnoticed. Full record: [REL-011 §8](REL-011-THE-SITE-BUILDER-SHIPS.md).
>
> 🟢 **s41 also closed the five-seam audit and built the `<h2>` gate** — [§9](REL-011-THE-SITE-BUILDER-SHIPS.md)
> and [§10](REL-011-THE-SITE-BUILDER-SHIPS.md), commit below.

---

## 🔴 SITE-BUILDER LANE, s41 — what changed, and what the next session must NOT do

**Two commits: `02a3c924`** (s40's build, held back only by the peer's merge) **and `d8af6e5d`**
(this session). ⚠️ **Three other lanes' uncommitted files live in the same package and were left
alone** — `createProject.ts`, `validate.ts`, `sbr011LivePreview.test.ts`.

### 1. 🟢 The five seams are audited to the end — and the list is TWO, not five

§8 measured seams 1, 3 and 4 and stopped. **Seams 2 and 5 had never been re-read against the
corrected instrument at all.** Read off the 09-05 living shots beside the 09-03 shots he **actually
ruled on**, then confirmed in the artefact:

| # | §3's seam | verdict |
|---|---|---|
| 1 | the framework's default blue | 🟦 **harness** — gone |
| 2 | ruled rows + outline-secondary pills | 🔴 **PRODUCT** — `/Admin/PageRow` is all tokens, so the seed fix repainted the idiom and changed none of it |
| 3 | the shell does not fill the screen | 🔴 **product** — built |
| 4 | gradient rectangles | 🟦 **harness** — gone, four real photographs |
| 5 | one column, one rhythm | 🔴 **PRODUCT** — `shell` is the ONLY node stating a width; every section of all five kinds runs through one `/Site/SectionView` at one padding |

🔴 **A fourth round aimed at §3 as written would spend two of its five items on the harness.** What
is left to re-show him is **seam 2 and seam 5**.

⚠️ **This is not a licence to build either of them.** The template is **held**, phase 77 owns it, and
[§4](RICHARD-RULINGS-2026-09-04.md) is explicit: nothing about the look is built until he names the
seam, and he has already **declined three readings a session offered**. §9 names where the work would
land and stops there deliberately.

### 2. 🟢 `<h2>` order — the residual this lane registered TWICE — is built, and GREEN AT HEAD

`headingOrder.ts` + `headingOrder.test.ts`: **20 pages across both artefacts, 0 skipped levels.** A
checker over the corpus that exists, and the corpus passes — said out loud rather than dressed up.

🔴 **The trap it was built around**: `/Pages/Site`'s own tree holds **one** heading; the other five
arrive through `/Site/SectionView`, which is **not a child of anything** — it is the `template`
**parameter** of a `For Each`. A walker following only children reports every site-builder page as a
lone `h1` and calls it well-formed: *the answer the gate wants, arrived at by seeing nothing.* Pinned
by cardinality, and the fault detector is graded on synthetic sequences before it is aimed at
anything. Mutant on the real artefacts: **3 red of 29 that all ran**, both files restored
byte-identical.

### 3. ⬜ What is left in this lane, in order

1. ✅ **DONE — the full `noodl-mcp` suite reads `94 suites / 1290 tests, EXIT=0`**, taken the moment
   the peer announced their stack was down. It had been written down as a **prediction** first, and
   then measured. ✅ **It closes §8's register row a second way**: +1 suite and **+29 tests = exactly
   the new file's specs**, so nothing else moved.
2. **Re-take §8.3's four arms on ONE commit.** They were taken at four different commits while peers
   landed work; the artefact for each is regenerable from §8.4.
3. **Everything else here is Richard's** — the fourth round, and the V2 *"modern CSS"* seam, which
   [§4.1](RICHARD-RULINGS-2026-09-04.md) says **must not be turned into a task by guessing**.

**Session 40 built the last buildable row on the queue.** All four of Richard's §7.3 judgements are
now answered *and* built. What remains is what session 39 said remained: **his content, his
decisions, and four drives** — plus one thing session 40 found while checking the board.

**Read [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §9 first** — it is the build
record for judgement 4 and it carries the one register row this session opened.

---

## ✅ WHAT SESSION 40 SHIPPED — one commit, `5f407849`

**Judgement 4** — *"`/` and `/members` unauthenticated are byte-identical… send them to `/sign-in`
instead."* The six protected pages' refusal navigator now targets `/Pages/SignIn`.

🔴 **REL-002b is untouched, and that is the shape of the change.** Same `Denied` signal, same two
producers, same six pages, same fail-closed. **Only the destination moved** — `connections.json` is
byte-identical on all six pages, and the artefact diff is **6 files · 6 targets · 6 labels · nothing
else**. `Members/Chrome`'s own navigator still goes to the landing page, because signing out is not
a refusal.

| gate | reading |
|---|---|
| `tpl001Template.test.ts` | **82/82, EXIT=0** (79 before) |
| the same file, **reverted arm** | **EXIT=1**, 1 red of 82 **that all ran**, by name |
| `noodl-mcp` full jest | **93 suites / 1260 tests, EXIT=0** |
| `rel002b-fail-closed.test.ts` (real backend, real browser) | **38/38, EXIT=0** (37 before) |
| `tpl001-refused-query.test.ts` (real backend, real browser) | **6/6, EXIT=0**, D4 still `LEGIBLE` |
| `tsc --noEmit -p packages/noodl-mcp` | **0, EXIT=0** |
| `npm run template:members` | **clean no-op BEFORE the edit**, so the diff is attributable |

---

## 🔴 THE FOUR FINDINGS WORTH CARRYING FORWARD

### 1. A byte gate cannot hold a ruling

`tpl001Template.test.ts` §1 proves the artefact is byte-for-byte what the generator writes. **That is
green for any destination** — revert the generator, regenerate, and §1 passes. Judgement 4 would have
been held by a comment and nothing else. §5b now grades the destination itself, and **derives the
gated pages from the graph** (every `Denied` wire reaching a `RouterNavigate`) rather than listing
them, so a seventh protected page with a wrong ejection reddens instead of passing.

⚠️ **The first draft of its control was WRONG and the failure was the useful part**: it asserted the
band held exactly one `RouterNavigate` and read **seven** — the band *is* the navigation. Counting
would have graded the menu; the control now finds the sign-out destination by **the wire that fires
it**.

### 2. 🔴 Renaming the node id would have INVERTED a spec's verdict

The tidy-up — `toLanding` → `toSignIn` — was measured and rejected. Ids are unique **project-wide**
(`toSignIn`, `-2`, `-3`, `-4` already exist), so renaming six renumbers the rest **by component
authoring order**. And `tpl001-refused-query.test.ts` addresses this exact node **by literal id**
when it pushes its twin's wire: a rename aims that wire at a node that does not exist, the arm
navigates nowhere, and *"the refused arm did not move"* reads as **"a refusal is SILENT to the
graph"** — the exact inverse of D4's answer, with no platform change at all.

✅ That spec now **derives** its expected URL from the artefact in two hops (`target` → the page's
`urlPath`), so a future retarget moves the spec instead of silently inverting it.

### 3. `projectFileWatcher.test.ts` reddens `test:main` whenever the box is busy

**Two `test:main` runs, both `423 suites / 7086 tests` with exactly ONE red** — `REL-009b › reports
the component when a real two-phase save lands in it` — and **16/16 EXIT=0 when run alone**. It
waits **600ms** for a debounced (60ms) `fs.watch` event in a temp directory; under two concurrent
peer suites that budget blows. It imports nothing this session touched.

⚠️ **So `test:main` was NOT read green here**, and the honest statement is: identical suite/test
counts to the `335be2e9` baseline, one load-sensitive red, green in isolation, and **the three
editor specs that actually read `templates/members-area` — `def-002`, `def-009`, `def-025` — passed
in both runs.** 🔴 **Registered, owner `NONE`: that spec needs a wait that is not a stopwatch, or
this repo's most-used gate is red on a busy box for ever.**

### 4. 🔴 The board's status column is stale in BOTH directions — re-derive from the FILES

`TASKS.md` still showed **REL-012 as ⬜ BLOCKS 0.2.2** and **REL-014 as ⬜**, and both were built and
committed by session 39 (`ead2d04f`, `9d58c505`). It also still said *"judgements 1 and 4 are still
unbuilt"* when judgement 1 shipped in `0b72b600`. **Only the REL-002c sentence was corrected here**,
because it is this row's own and it was measurably false; the others were **read, not flipped**:

🔴 **REL-012's ⬜ may well be CORRECT rather than stale.** Its own file ends *"Not run here — no
suite, no tsc, no webpack, no build, no editor. Every AC is ASSERTED-ONLY."* **AC1 wants a packaged
artefact inspected and AC5 wants a clean profile opening the Learning tab in a running editor** —
neither has been done by any session. **It is the 0.2.2 blocker and its two hardest ACs are the two
nobody can grade headlessly.** Do not mark it green off the commit.

---

## §A THE QUEUE — what is left

### ⬜ Everything here needs Richard. There is no buildable row behind it.

| what | what unblocks it |
|---|---|
| **Default tutorial content** (FB-012, phase 75) | his brief |
| **The empty template shelf** (FB-005, phase 75) | closes on **REL-001**, publishing the members' area |
| **REL-015 AC9/AC11** | two YouTube links and one real tutorial, his content |
| **REL-001 — publish** | ⏳ cleared by D2; `/unsubscribe` was re-ruled PASSABLE, so the condition is met |
| **REL-004 — cut and tag `v0.2.2`** | his. `cline-dev` is far ahead of `origin`; **RE-DERIVE the count at cut time**. Pushing is his standing decision — **do not push, do not re-raise** |
| **The V2 "modern CSS" brief** | his seam. 🔴 **Must not be turned into a task by guessing** — he declined three readings already ([rulings](RICHARD-RULINGS-2026-09-04.md) §4.1) |
| **A seam for REL-002c** | §4.2 — fourteen PASSABLE verdicts arrived with no why. **One** would do: the page he would call *nearly* worthy, and the single thing keeping it there |

### 🟢 The drives — ALL FIVE ARE DONE (s42 took 1–2, s43 took 3–5)

Written when nothing had ever run in a real editor. It is now empty, and that sentence is kept only
so the next reader can see what it cost to empty it.

1. ✅ **REL-012 AC1 + AC5** — s42: a real packaged artefact (`lessons` present, 4 bundles / 122
   files) and a clean-profile first run seeding 3 lessons, both arms.
2. ✅ **REL-016's five checks** — s42: all five PASS. 🔴 But `config.devMode` is dead in **every**
   build, so the three panels register nowhere; un-gating is two gates, not one.
3. ✅ **A freshly placed Dropdown** (`9f5ae5a7`) — s43: **64.09px, "Option 1" on screen**, panel
   reads *2 items* / *option-1*; control arm collapses to **4px**. [NOTES §5](NOTES-UNOWNED-NODE-WORK.md).
4. ✅ **A YouTube link pasted into a Video node** (`a97738b6`) — s43: one
   `youtube-nocookie.com/embed/…?start=90` iframe, **zero `<video>`**, poster frame loaded.
5. ✅ **The Shape node's shapes in the property panel** — s43: **six** values offered (five drawn
   plus Custom SVG), and every gate correct across all six arms.

---

## §B REGISTERED, OWNER `NONE`

| finding | where |
|---|---|
| 🆕 **Judgement 4 costs the UNBOUND first run its explanation** — with no backend bound an ejection now lands on a painted door whose form cannot work, rather than on the page carrying the waiting card. **Not put to him**; the remedy (split the destination by producer) would reverse REL-002b's *"the refusal is unconditional"* on a reading nobody asked for | [rulings](RICHARD-RULINGS-2026-09-04.md) §9.5, and in the spec beside the assertion |
| ✅ ~~**`projectFileWatcher.test.ts` is a stopwatch race**~~ — **FIXED s44 (`b3037aa1`)**, and the sweep found the same class in `bld-004`/`aib-009` (below) | the gate lane at the top |
| ✅ ~~**`bld-004/reasoningChannel.test.ts` and `aib-009/turnDeadline.test.ts` run a 60ms stall window on a 2× margin**~~ — **CLOSED s53 (09-05, `5c589970`), and the row's MECHANISM WAS WRONG.** The margin is real; the race is not. The heartbeat timer is always due `STALL_MS / 2` **before** the deadline's next check and node fires expired timers in **expiry order**, so however late the loop wakes the heartbeat lands first and the check reads a silence of ~0 — **measured: with the event loop blocked 200ms out of every 5ms the ORIGINAL spec still PASSED.** Delay makes these slow, it cannot make the deadline lose. What it blows is the **runner's** budget, the same place s44's fix ended up: bld-004's nominal 240ms → **3227ms** at that saturation, and at twice it **5610ms and RED as `Exceeded timeout of 5000 ms for a test`, not `AiTurnStalledError`** — which is exactly why s40 read it as a flake. Three tests moved to fake timers (250/150/90ms → **5/3/1ms**, and **5ms under the saturation that costs the original 3227ms**); arms A/B/C strip `touch()` from `onReasoning`/`onActivity`/`onText` and red one named test each, **16 of 16 running in every arm**, source restored md5-identical. `test:main` **425 / 7144 EXIT=0** — s52's own counts, so nothing was added or moved | gate lane §3; s53 lane at the top |
| ❌ ~~**`noodl-core-ui`'s jest runs in no CI gate**~~ — **FALSE, re-measured s45 (09-05).** It runs in `pr.yml`'s package job (`npm run test:packages`, on `pull_request` AND `push`); `@noodl/noodl-core-ui` is the first `--scope` in that script and has been since before session 39, the scope resolves (all 16 do — checked against each package's declared `name`, 0 unresolved), and the suite reads **29 suites / 551 tests, EXIT=0** at HEAD. ⚠️ The `pr.yml` comment above the step still says *"Six jest suites (~1,050 specs)"* and lists six packages — **the comment is stale, the scope list is not**. 🆕 **The residual, owner `NONE`:** `lerna run --concurrency 1` bails on the first failure and core-ui is **8th of 16** in topological order, so a red in any of the seven before it means core-ui's 551 specs never run — which is the same shape as the trap `pr.yml`'s own comment records (*"Nx bailed the whole run on an earlier package's failure every time — so the gap was invisible"*). `--no-bail` is the obvious fix and was **NOT applied**: several of those suites bind real sockets, which is why the job is serial, and changing a shared CI gate on one session's judgement is not this row's call | session 39; re-measured s45 |
| **Fill/Stroke are inert for a custom SVG shape**, deliberately ungated | [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1 stage 3 |
| **`/unsubscribe` has three left edges** — the defect REL-002c fixed on `Pages/Post`, surviving on a door page | [rulings](RICHARD-RULINGS-2026-09-04.md) §6.5 |
| ✅ ~~**The workbench dropdown fix is UNGATED** — `@testing-library/react` is not installed~~ — **CLOSED s46 (09-05).** The dependency was never the blocker: `PreviewChrome.tsx` imports `Icon`, whose `require.context` fails ts-jest at load (`Icon.tsx:207`, TS2339), so the module fails the suite **to run** — measured with a probe before anything was written. The decision was not in the rendering, so it moved to `previewScope.readMenuComponents` and `ben-004/previewScopeMenuRead.test.ts` grades it: **13/13, EXIT=0**, Arm A (no `.slice()`) **5 red of 13**, Arm B (`open()` reverted) **2 red of 13**, and Arm C2 (the spec's own `stripComments` removed) **1 red of 13** — which is what says the source row is not passing on the fix's prose. ⚠️ `@testing-library/react` really is absent; that half of the row was true and simply not load-bearing | [`TESTING-PASS`](TESTING-PASS-2026-09-04.md) §3 |
| **`/unsubscribe`'s ~220px void** — 🔴 he ruled it PASSABLE *having been told the void was there*. **Do not "fix" it without asking** | ruling §6.4–6.5 |

---

## §C WORKING RULES — the ones this session actually needed

0. 🔴 **`tsc -p packages/nodegx-backend/tsconfig.tests.json` CANNOT BE READ ON THIS BOX.** `EXIT=134`,
   OOM, and **its log carries 0 `error TS` lines** — the exact reading that has been mistaken for a
   pass. Narrowing to **two files** still OOMs at 6GB after 393s. ⚠️ And ts-jest runs those specs
   with `isolatedModules: true`, so **the drives do not typecheck them either**. New logic there
   must be exercised some other way — here, by running the function against the real artefact.
1. 🔴 **BUILD THE REVERTED ARM, AND RECONCILE THE COUNTS.** Mutate the **behaviour**, keep the
   **surface**: the six targets went back to `/Pages/Landing` and the generator was **regenerated**,
   so the byte gate stayed green and only the ruling could speak. `81 + 1 = 82` is what says the
   revert compiled; a revert that does not compile grades nothing.
2. 🔴 **A CONTROL THAT FAILS IS DOING ITS JOB — READ IT BEFORE "FIXING" IT.** *"The band holds one
   navigator"* read seven, and the right answer was a better control, not a bigger number.
3. 🔴 **WAIT FOR A PEER'S SUITE, AND CHECK AGAIN AFTER IT ENDS.** Both `test:main` reds landed
   beside other people's jobs; the box had **five live sessions**, a worktree mutant loop, three
   `vib001-site.look.ts` runs and a full `noodl-mcp` suite. `ps -Ao pid,command` before every gate.
4. 🔴 **RESTORE BY ABSOLUTE PATH AND `md5` THE RESULT** — and `diff -rq` the artefact. A compound
   `cd X && …` persisted its cwd into a later call here and made a present file read as missing.
5. ✅ **REGENERATE AS A NO-OP FIRST.** `npm run template:members` was run and diffed **before** the
   edit, so every byte of the later diff is attributable.
6. 🔴 **DERIVE, DON'T TYPE, ANYTHING A RENAME CAN MOVE** — the spec's expected URL, the list of
   gated pages, the sign-out navigator. Every literal here was a place a future edit could invert a
   verdict silently.
7. 🔴 **NEVER `git stash`**, never `isolation: worktree` on this repo; commit **by pathspec**,
   `git add` untracked first.
