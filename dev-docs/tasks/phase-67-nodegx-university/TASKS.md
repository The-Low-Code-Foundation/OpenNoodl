# Phase 67 — the tasks (UNI: NodeGX University)

**Created:** 2026-08-14 out of [README.md](README.md). Read the README's two principles and the
rulings queue first — several tasks are blocked on D-rulings, and the two principles (the login
gates nothing; services not features) are acceptance criteria in every task.

> 🔴 **Read [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) before starting any task
> here.** The first working session (2026-08-14) did the archaeology §"Two things to check" below
> demands, and found **five** phase-67 premises wrong or incomplete against phases 17, 20 and 51 —
> including that **D12 does not exist** (ruled 2026-08-09) and that **UNI-010's experiment is
> already specced** as LEARN-007…010. Four rulings were made; the Blocked column below reflects them.

**Surfaces:** `platform` = the new repo (D1), `editor` = this repo, `bridge` = the
editor-outbound sync between them. No task opens an inbound connection to the user's machine.

> ✅ **THE RULINGS QUEUE IS EMPTY AGAIN — D15, D16 and D17 all ruled 2026-08-16.** It was emptied
> 2026-08-14 (D2–D9, D11), reopened 2026-08-15 with UNI-011 and D14, and closed again. **Nothing in
> this phase is waiting on a decision.** The Blocked column is once more a record of what each task
> must *honour*, not what it is waiting for. The register is **[RULINGS.md](RULINGS.md)** — read it,
> not this banner.

| Task | One line | Surface | Tier | Effort | Rulings it must honour |
|---|---|---|---|---|---|
| [UNI-001](UNI-001-ONE-LOGIN-THAT-GATES-NOTHING.md) ⭐ | the NodeGX account: OAuth, editor sign-in, consent — the spine everything hangs off | platform + editor | **1** | M/L | 🟡 **SPINE BUILT 2026-08-16 — the platform track is open.** `nodegx-community` `bb3ff8d7`, first commit, D1's stack. **The schema is the deliverable**: D3/D4/D6/D10/D11 are DB constraints and triggers, not conventions, because D14 gives this API two clients and a rule enforced in a client is one the other can disagree with. 🔴 **D3 × AC3 is a real tension and is resolved, not papered over** — UPDATE refused outright *including inside an erasure* (a licence to delete is not a licence to rewrite), DELETE refused unless the transaction declares `app.gdpr_erasure`, so AC3's cascade works and a stray one cannot. **57 specs, every mechanism control-run.** 🔴 **NOT built: OAuth, sessions, the consent screen UI, any editor half** — the button renders D2's string and is **inert**, because callback URLs need the domain and the domain is unregistered. AC1/AC2/AC4 are editor-side and untouched; **AC3 is met and proven** |
| [UNI-002](UNI-002-POINTS-BADGES-AND-THE-LONG-LIST-OF-CHALLENGES.md) ⭐ | the contribution engine: points, badges, the challenge registry, the event ledger | platform | **1** | M/L | ✅ **BUILT 2026-08-16 — all four ACs met.** `105 specs / 8 files` (baseline 57/5), `tsc` clean, `next build` succeeds. **Nine control runs, every mechanism proved to bite** — the advisory-lock control fails **exactly one** spec (the two-connection race) and nothing else; dropping the whole integrity trigger fails **17**. 🔴 **The rules are in the trigger for a reason sharper than D14's:** one of the three mechanisms is `bridge_event` and the bridge is the **user's own editor**, so the price, the mechanism, the cap and the rate limit are read from the registry *by the database* — a caller naming its own points value is refused, not believed. 🔴 **`challenge_id` is NOT NULL** ⇒ every point traces to a registry row; no adjustment back door. **AC4 is proved by a challenge invented at runtime with a random slug** — no source file can hold a case for it. ⚠️ **`awarded_by` has no FK, deliberately**: `set null` is an UPDATE (D3 refuses absolutely), `restrict` breaks UNI-001 AC3, `cascade` deletes other people's awards — an immutable record cannot hold a reference whose upkeep rewrites it; the erased-admin residue is asserted by a spec. 🔴 **D4's absence spec was on the wrong table** — the ruling names *challenges*, which did not exist when the spec was written; both now asserted, and `badges` is the twelve-row cross-product **derived from the enums**. ⚠️ **NOT built: the 12 SVG artworks** (paths only — UNI-003 will be first to notice), no admin route for manual grants (auth first), threshold challenges award manually. 🔴 **AMENDED 2026-08-16 by UNI-003, and it was a live defect in this task's DATA rather than its code:** `project-first-built` awarded **(building, bronze)** — the badge whose own row reads *"Published your first prefab"* — for saving a project, so the profile claimed a publication that never happened **and D8's evidence bar was cleared by pressing save**. The catalogue is now 48: that row keeps its 20 points and awards no badge, and a once-only **`prefab-first-published`** awards the badge on `prefab.published` beside the repeatable one. ✅ **This task's own *"every one of D4's twelve badges is reachable"* spec is what made the fix safe** — a guard written here caught the second half of a change made one task later. 🔴 **Three findings**: a BEFORE ROW trigger runs **ahead of NOT NULL and FK**; a `number`-typed `bigserial` id lied and every spec passed; and `signature ?? sign(body)` turned the *"no header"* spec into a happy-path one |
| [UNI-003](UNI-003-THE-PROFILE-THAT-FOLLOWS-YOU.md) | the public dev profile: badges, points, published prefabs, offers | platform | **1** | M | ✅ **BUILT 2026-08-16 — all four ACs met.** **164 specs / 9 files** (baseline 105/8), `tsc` clean, `next build` succeeds. **Thirteen control runs, every mechanism proved to bite.** 🔴 **AC1's *"404, not a stub"* is one `null`**: private, hidden and never-created are the same answer, so no route can render a "this is hidden" page — the criterion is met by there being nothing to render. 🔴 **Hiding is deliberately NOT `visibility = 'private'`** — reusing the owner's toggle would leave them unable to tell their own opt-out from a decision about them, and AC4's *"sees why"* nowhere to live. 🔴 **D8's bar gates the LISTING, not the page and not the flags** (AC1 and AC3 are literal about the toggle being unconditional), and `profileBar()` returns its **components** rather than a boolean — D16's *"a threshold nobody can see the approach to gets crossed by rounding"*, applied a task early. ⚠️ Its evidence half reads **D4's taxonomy, not a slug list**, or UNI-002 AC4 breaks the day a second publishing challenge is added. 🔴 **THE FINDING: `project-first-built` awarded (building, bronze) — the badge whose row reads *"Published your first prefab"* — for pressing save.** It rendered a claim the holder never made **and silently cleared D8's evidence bar**, so anyone who saved a project once qualified for professional listing. Fixed as **data** (the row keeps its points and awards no badge; a new once-only `prefab-first-published` awards the badge on `prefab.published`) — ✅ and UNI-002's own *"every one of the twelve badges is reachable"* spec is what made the fix safe. ⚠️ **Nothing mechanically checks that a challenge's MEANING matches its badge**; two specs pin these rows by hand. ✅ **DRIVEN over HTTP** against consequences written first: `/u/quiet-quentin` **404** with her bio nowhere in the body, `/u/nia-new` **200 while `/people` omits her** (the D8 seam in one reading), a hide 404ing on the very next request. 🔴 The contribution line was checked against **a second instrument** (`psql`) — and nearly went unverified, because React's `<!-- -->` between text nodes makes a grep for the number return nothing, which reads exactly like a page rendering no number. ⚠️ **NOT built: no admin route** (sessions first, UNI-002's precedent), **no owner-facing account page** — `ownProfile()` is specced and returns the reason, so AC4's owner half is met **at the API and not yet at a URL** — and **the 12 SVGs still do not exist**: the profile renders the family mark and tier colour rather than a broken image, and it is deliberately not a placeholder pretending to be the badge |
| [UNI-004](UNI-004-RFPS-AND-COACHING-WITHOUT-A-GATE.md) ⭐ | the RFP board + coaching offers/booking/payment, spam-shielded relay | platform | **1** | L | ✅ **unblocked.** D7 → **Paddle**, coaching only; D8 → **double-blind relay** (also the spam shield). Build so payment can be absent — the email-only v0 stands |
| [UNI-005](UNI-005-AN-ORG-IS-A-ROSTER-AND-A-SHELF.md) | org workspaces: contact-us provisioning, GitHub org hookup, roster, shared prefab/template shelf | platform | 2 | L | ✅ **unblocked.** D6 → GitHub org **and** invite list, **one** roster; D10 → pseudonymous handles · builds on **phase 51 / COL-004** |
| [UNI-006](UNI-006-ASSIGN-GRADE-REVIEW.md) | org teaching: push lessons/assignments to members, view graded results, human grading override | platform + bridge | 2 | M/L | ✅ **unblocked.** D10 ✅, D12 struck · no live co-editing (ECO-001 parked) · never branch on membership source |
| [UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md) ⭐ | intake → personalised path → lesson project pulled into the editor's Learning folder → graded via MCP tooling | all three | 2 | L | 🟡 **SLICES 1–4 BUILT** (08-14, 08-15) — the static check, both grading engines, **both** engine-2 adapters, the Learning folder register, D5's launcher section, and ✅ **"check my work"** — the runner's first caller anywhere. **160 tests** in `test:main`, 21 in `noodl-mcp`. 🔴 Slice 4 found that a Learning-folder lesson **had no lesson layer at all** (fixed, `c38fcb7b`) — the fourth time building a caller exposed a hole, and the first time on a *feature* that a live drive had already passed over. ✅ **Slice 4 DRIVEN**: ten consequences, one failed (*"resumes on the step you left"* — true in code, false through the UI), fixed `393ec7bf` and re-driven. No intake (platform work) |
| [UNI-008](UNI-008-ONLINE-IN-ONE-CLICK-OFF-IN-FORTY-FIVE-DAYS.md) | push-to-share hosting: subdomain, 15-day life, manual restarts, 45-day cap, then the self-host off-ramp | platform + editor | 3 | **L+** | 🔴 **D9 ruled *against* the recommendation** — a record-capped backend is in. **Five new obligations**, effort raised, still deliberately last. [RULINGS.md](RULINGS.md) D9 |
| [UNI-009](UNI-009-THE-COMMUNITY-HOME.md) | the site itself: tutorials/tips, meetup replays, Discourse forum SSO | platform | **1 (minimal cut)** | S/M | 🟡 **CONTENT CUT BUILT 2026-08-16** (`bb3ff8d7`) — home, `/replays`, `/tutorials`, `/university`. ✅ **AC2 MET and verified by serving it, not by building it**: all four routes **200 with no cookie**, replays render newest-first, D2's string on every page from the one constant that owns it. ⚠️ The home is a grid of standing surfaces rather than a feed **on purpose** — D16's composition obligation, which the threshold does *not* discharge. 🔴 **NOT built: Discourse, SSO, the webhook receiver** — AC1 and AC3 are untouched and the forum is a purchase nobody has made |
| [UNI-010](UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md) | the user's own Claude authors a verified lesson into the Learning folder — an experiment with pre-registered kill/keep criteria | editor + MCP | experiment | M | 🟡 **SLICES 1–2 BUILT** (08-15). Slice 1 = the **F1–F4 harness**; slice 2 = **the gate collected and the surface built**: `LearningFolderModel.install()` runs the whole scorecard (was F1 alone), and `create_lesson` / `check_lesson` / `get_lesson_brief` ship as a deferred `lesson` group in `noodl-mcp`. **74 tests** (46 + 16 editor, 12 MCP). ✅ **Criterion 1 met for all four classes.** 🔴 D5 solved by an **asymmetry**: a manifest claim may only *tighten* — `authoredBy: "ai"` spends trust, so it is honoured where `curated` would not be, and the MCP route needs no bridge at all. 🔴 The install gate is a **policy table keyed by provenance**, not slice 1's `installable`: the editor **cannot render a solution folder**, so gating on it would refuse every AI lesson. ⚠️ **F4 is therefore checked by the producer and not the installer** — a recorded hole. 🔴 Slice 2's find: **a lazy `require` defers execution, not resolution** — the sidecar is bundled, so UNI-007's inside-the-function require never made the evaluator sidecar-safe; split to `lessonevalconditions.live.ts`. ✅ **CRITERION 2 DRIVEN 2026-08-15** (tenth session): eight consequences written before the drive, **8/8 passed**. 🔴 The asymmetry's *bite* is driven, not just its label — two directories identical but for one `authoredBy` line, one **refused** naming F2/F3 and the other installed. Grading proved provenance-independent (AI arm and non-AI twin returned the same sentence; an edit moved both engines). 🔴 **New finding: F4 is checked by NOBODY for a real user** — the producer's harness lives in `scripts/`, which is not in `build.files`, a fact UNI-007 had already recorded one slice earlier; *a hole recorded in two halves is not recorded*. **Flagged to Richard, not fixed** — it is a scope call. ✅ The "strictly stricter" precondition of the trust asymmetry is now **two specs, proved to bite**. ✅ **CRITERION 3 RUN 2026-08-16** ([UNI-010-CRITERION-3-RUN.md](UNI-010-CRITERION-3-RUN.md), pre-registered and committed *before* a lesson existed): **KEEP on the rule — 5 of 5 install and are completable, ≥3 clean on the human read.** 🔴 **And the same run gave positive evidence for the kill clause: TWO structural holes in F4**, each with a control pair. (a) F4's verdict **discards the render harness's own defect findings** — a bundle whose Repeater stamps three `dead-placeholder-text` rows scores F1–F4 all pass, and the broken/fixed pair differ by **one JSON key** with **character-identical scorecards**; (b) F4 renders **only the Router's `startPage`**, so a lesson that *teaches* a second page has its subject unscored — a dead placeholder there is invisible to F4 **and** F2 and the bundle writes. ✅ **`create_lesson` IS reachable over the real stdio transport** (item 2 closed without touching Richard's registered servers, which still cannot reach it) — 🔴 the `lesson` group is **deferred**, so the first `tools/list` returns 20 tools without it and `find_tools({group:"lesson"})` is required: **reaching the tool is a conversation, not a call**. 🔴 The human read's finding is one-directional: **five steps across four lessons check LESS than their prose asks**, because **F2 punishes a condition that is too strong and nothing punishes one that is too weak** — two have real consequences and one (the Router's `pages` list) **cannot be expressed in the vocabulary at all**. ⚠️ **The ordering constraint against CN-001 was NOT discharged** — it landed mid-run (`ed28a03c`, on disk at 00:26:13, between L3 and L4); corrected by **re-measuring** rather than arguing, and both findings reproduce post-CN-001. ✅ **SLICE 3 2026-08-16 — finding (a) CLOSED** (`eff91029`, **14 specs**, `test:main` 205/**3171**): `renderDefectCodes()` joins `countDrawnElements` as the second rule both adapters share, `WholeSolutionResult.renderDefects` carries the codes past the prose, and F4 fails on them as **`solution-renders-broken`**. 🔴 It reads the harness's **severity**, not the one code the finding named — `empty-list`, `broken-image` and `content-not-visible` were in the identical hole. ✅ **Graded as a control pair both ways**: re-run with the branch disabled, **3 new specs fail and all 25 old ones pass**; and pinned on *recorded* renders — `phase55-replay-haiku` reports two defects, `phase55-replay-sonnet` (the build phase 55 calls correct) still reports none. ⚠️ The learner's "check my work" sentence changed and its **verdict deliberately did not** — a learner mid-build legitimately has placeholders. 🔴 **Finding (b) §8.2 is untouched and belongs to CN-001**, and the F4 packaged-install scope call is still Richard's. ✅ **SLICE 4 2026-08-16 — the run's two remaining recommendations, §12.3 and §12.4, both closed** (**25 specs**, `test:main` 206/**3196**, `noodl-mcp` 44/**512**). §12.3: the brief now names the one-directional gradient out loud (*"F2 punishes a condition that is too strong and nothing punishes one that is too weak — check what your prose asked for"*) with the two shapes it took, and its **F4 paragraph is corrected** — it still described the pre-slice-3 check and never said F4 renders the start page only. §12.4: **`routerLists`**, the verb for *"a router lists this page"*, with `node` **optional** — unscoped it asks the reachability question the learner's app cares about, scoped it names one router; it compiles to **no `path` key** rather than `path: ''`, which would be a silent never-completes. ✅ **Graded as the control pair the finding was** — both arms differ only in the router's `routes`, the **old condition passes both** (asserted as the finding), and re-run with the branch disabled **14 new specs fail, all 251 pre-existing pass**. 🔴 **The purity claim was MEASURED**, per the fifth amendment: two sidecar builds back to back are 5,911,294 / 5,911,848 bytes and `readRouterPagesValue` is already in the *control*, so borrowing `pageRegistration.ts` costs **554 bytes and no new dependency**. ✅ **Zero MCP tool surface** — the manifest is an opaque passthrough, so a condition verb never reaches a tool schema; **the 57 tokens stay free and CN-006/CN-009 are not competing with this**. ⚠️ The control run found **two of my own F2 specs asserting `F2: 'fail'` alone, which passed with the verb disabled** — a failure indistinguishable from a missing mechanism measures nothing; both now assert the finding **code**. ✅ **SLICE 5 2026-08-16 — `derive_starter`** (`1332e0d1`, **25 specs**, `test:main` 209/**3248**, `noodl-mcp` 45/**529**): the starter is now **subtracted from the solution** rather than written beside it, which is the route the criterion-3 run took for all five lessons and the reason its ghostwriting refusal fired **zero times** — a number §11 reads as an upper bound, because a model building both projects independently is far more exposed. 🔴 **The condition verb decides the granularity** — `hasType`/`exists`/`hasLabel`/`hasPort` remove the node, `hasParams`/`paramsEqual` keep it and unset those parameters, `connection` removes the wire, `routerLists` un-lists the page. 🔴 **The postcondition is MEASURED, not guaranteed**: every graded step is replayed against the derived files through the real evaluator and nothing is written if one still holds — because a derivation that guaranteed F2′ *by construction* would make the gate's F2′ vacuous, and **a check that cannot fail is one nobody audits**. Both arms are in the spec. ✅ Control run: **13 of 15 new specs fail with the branch disabled, all 98 pre-existing pass** — 🔴 and the *first* control had only 11 failing, because **two of my own specs were dead in exactly slice 4's way** (one asserted a refusal indistinguishable from a missing mechanism, one asserted "the solution is unchanged", true of a function that returns immediately). 🔴 **The handover's cost premise was FALSE and is now measured**: the surface is **8,223 tokens with and without** it — a fourth tool in an already-deferred group is free, and CN-006/CN-009 are not competing with this. ✅ Purity **measured** per the fifth amendment: 5,936,471 / 5,917,637 bytes = **+18,834**, and the control was verified to be one |

| [UNI-012](UNI-012-F4-ON-A-PACKAGED-INSTALL.md) | ship the render harness with the sidecar, so F4 is answerable on a packaged install | editor packaging + MCP | falls out of UNI-010 | M | 🆕 **Added 2026-08-16.** ✅ **RULED by Richard — ship the harness**, the first of UNI-010's two options. 🔴 **Scoped, NOT built**: it is verifiable only against a packaged build, and a shipping claim nobody exercised is the artifact this phase has found wrong four times. ⚠️ **Two facts measured while scoping, and the first qualifies the ruling** — the harness probes for a **system Chrome** and refuses without one, so shipping it makes `allow_unrendered` *rare* rather than unnecessary (**both halves of the either/or are probably wanted**); and rendering through the sidecar's own Electron is closed by `ELECTRON_RUN_AS_NODE=1`, which is load-bearing and measured. ✅ CN-001 already did the structural half (`@nodegx/render-measure`) |

| [UNI-011](UNI-011-THE-COMMUNITY-MIRRORED-IN-THE-EDITOR.md) ⭐ | the community mirrored inside the app — same API as the web — plus the editor-only half: ask-about-this-node, share-a-capture | editor + bridge | 2 | M/L | 🆕 **Added 2026-08-15.** ✅ **D14 ruled** — web canonical, editor **mirrors** it; editor-only features are the transition incentive, not a reduced surface. ✅ **D15 and D16 RULED 2026-08-16 — UNI-011 is fully unblocked, to build *and* to ship.** D15 → org-minor accounts default **absent**, admin may enable **read-only**, and 🔴 **no write path exists to be switched on**; the rule lives **behind the API**, not in each client, or the mirror drifts from the web. D16 → the entry point opens the **browser** until **30 threads · 3 consecutive weeks with a call · median first reply < 24h**, each **computed with its `n` visible**; ⚠️ the never-look-empty *composition* obligation is **not** discharged by the threshold. 🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (`pages/ProjectsPage`, same `BrowserWindow`) — **no post body may render as HTML in it**; pick the `<webview>` island or raw-markdown-plus-sanitiser and prove the boundary with a known-**bad** corpus. ⚠️ Phase 37 (project tabs) is the "reach it mid-project" enabler and is **scoped, not built** — must not be assumed |

**Effort is per-v1-slice, not per-dream** — every task file carries an explicit "not in v1" list.

## Suggested order, and why

**First sitting: rulings, not code.** ✅ **Held 2026-08-14** — D1 and D10 ruled, R6 clarified, the
UNI-010 verifier question ruled, D12 struck.

**Second sitting: the rest of the rulings.** ✅ **Held 2026-08-14** — **D2, D3, D4, D5, D6, D7, D8,
D9 and D11 all ruled**, and the three curriculum blockers fact-checked against source and git.
**The queue is empty and nothing is waiting on a decision.** The next sitting is code.

✅ **The D2 rename is DONE — checked against GitHub 2026-08-16, not against this table.** The repo is
`The-Low-Code-Foundation/nodegx-community` and **`has_pages: false`**, so the time-critical window
(GitHub Pages does not follow a repo rename) is still open and still safe. Two handovers carried this
as an outstanding action after it had already been done.

✅ **The other half is DONE TOO — 2026-08-16.** The repo description read *"NodeGX University — the
community platform…"* for two days after D2 ruled the site is **NodeGX Community**: the name moved and
the sentence about the name did not, in the one place every future contributor reads first. It now
names Community as the platform and University as **the learning wing**, which is what D2 said.

🔴 **And the number that decided what this sitting does: `size: 0`, no branches, and `/commits`
returns HTTP 409 *"Git Repository is empty"*** — re-measured 2026-08-16, not carried. Eight of this
phase's twelve tasks live in it, and thirteen consecutive sessions were spent in the editor.

✅ **CLOSED THE SAME DAY — the platform track is open.** `bb3ff8d7` on `main`: D1's stack, the
schema with D3/D4/D6/D10/D11 as database constraints, D15 and D16 as one shared module each, 57
specs with a control run behind every mechanism, and UNI-009's content cut served and curled.
🔴 **The local checkout is `/Users/richardosborne/vscode_projects/nodegx-community` — a SIBLING of
this repo, never nested**, so none of this checkout's gates, peers or traps apply there and nothing
here can sweep it. Postgres runs in Docker on **55432**, deliberately not 5432, because this machine
already has one on the conventional port and both `db:seed` and the suite **drop `public`**.

**UNI-001 + UNI-009 (minimal cut) land together.** A login with nothing behind it is a broken
promise — the account must open onto *something* on day one: replays, tutorials index, the
forum. Discourse-with-SSO is bought, not built.

**Then the Tier-1 focus pair: UNI-002 → UNI-003.** The contribution engine before the profile,
because the profile is mostly a *view* of the engine (badges, points, published things). The
challenge list should launch long (R2) even if most challenges award manually at first —
Richard granting "attended the meetup" points by hand for a month is a fine v1 ledger writer.

**UNI-004 rides once profiles exist.** RFPs and coaching offers hang off profiles; payments
(D7) can trail the board itself — a booking form that ends in an email is an acceptable v0
while the merchant-of-record account is set up.

**Tier 2 as one arc: UNI-005 → UNI-006 → UNI-007.** Orgs before org-teaching before the full
learning bridge — but note UNI-007's grading runner (editor-side, reusing MCP validate/render)
is independently buildable early, and UNI-006 consumes it. If a school pilot materialises,
D10 goes first.

**UNI-010 as soon as UNI-007's format round-trips (its criterion 4).** The experiment needs no
platform at all, so it can run *before* the platform's lesson generator exists — and its verifier
is shared with UNI-007's runner, so building it early hardens the format for both producers.
Cheapest possible test of the whole lesson concept.

**UNI-008 last, deliberately.** The hosting wow is real but it is the only task with a
standing ops/abuse burden, and the 15/45-day lifecycle (R7) needs the account system mature.
Nothing else depends on it.

## 🔴 Phase 69 shares three surfaces with this phase (added 2026-08-15)

[Phase 69 — The Node You Write Yourself](../phase-69-the-node-you-write-yourself/README.md) promotes
custom nodes (`noodl_modules` kits) to a core concept. **Until 2026-08-15 neither phase referenced the
other anywhere** — grepping each phase for the other's vocabulary returned zero hits both ways —
while three surfaces are shared. Phase 69's README §4 carries the mirror of this section.

| Surface | What it means for phase 67 | Phase 69 task |
|---|---|---|
| 🔴 **`lessonverify.ts` is catalog-backed, built-ins only** | **A lesson cannot teach a custom node today.** `unknown-node-type` is `severity: 'error'` there ([`lessonverify.ts:214`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts)) — stricter than `diagnostics.ts`, where it is a warning. That error is **F1**, and `REQUIRED_CLASSES` demands F1 of *every* provenance, so the bundle is refused for `curated` as surely as for `local-ai`. Not a bug in UNI-007 — the catalog genuinely cannot enumerate per-project kits — but it **caps what UNI-006/UNI-007 curriculum can cover** until CN-003 lands | **CN-003** routes the overlay in; **CN-004** owns the consequence |
| ✅ ~~**The MCP tool-surface budget**~~ — **NOT a shared surface after all, measured 2026-08-16** | UNI-010's `lesson` group spent 56 of LEG-001's 58 banked tokens and renegotiated the bar 8,200 → **8,280** ([`toolDisclosure.test.ts`](../../../packages/noodl-mcp/tests/toolDisclosure.test.ts)), whose note reads *"there should not be a third."* This row then predicted that **`derive_starter` would compete with phase 69 for the remaining 57**. 🔴 **It does not, and the premise was wrong rather than optimistic.** A fourth tool in the already-deferred `lesson` group costs **zero** resident tokens — measured at **8,223 with it and 8,223 without** — because the only resident mention of a deferred group is `find_tools`' `(N tools)`, and *"3 tools"* and *"4 tools"* are the same length. **What spends the budget is a *resident* tool (276 tokens for this one) or a whole new *group* (25).** ⚠️ **So the constraint on CN-006/CN-009 is real but differently shaped:** if either adds a deferred tool to an existing group it is free, and if either needs a new group or a resident slot the 57 is the whole of it | **CN-009**, **CN-006** |
| ⚠️ **The render harness is UNI-010's F4 instrument** | `NODEGX_RENDER_CLI` → `measure-from-disk.js` → [`render-report.js:41`](../../../scripts/devtools/render-report.js) → `render-from-disk.js`, which CN-001 rewrites. **Do not let criterion 3's five-lesson run straddle CN-001** or the five F4 scores come from two different instruments. Lesson projects use no kits today, so current readings are sound — the risk is a split dataset | **CN-001** (tier 0, S) |

✅ **And one thing CN-001 does *not* do:** it does not close this phase's open F4 hole. That hole is
`scripts/` being absent from `build.files`, so the harness never ships — an injector fix cannot help a
file that is not there. CN-001 *does* move the pure half into a no-build workspace package, which is
the same shape as the "ship the harness with the sidecar" option, so **it makes Richard's F4 scope
call cheaper without pre-empting it.** Worth putting in front of him alongside the call itself.

## What follows this phase

**Phase 68 — LearnBook** ([../phase-68-learnbook/](../phase-68-learnbook/README.md), scoped
2026-08-14, ruling D13): the coaching *delivery* layer — programs, modules, threaded exchange,
media, assignments the coach validates — for the sessions UNI-004 sells. It consumes UNI-001
(accounts), UNI-003 (profiles), UNI-004 (the offer/booking it delivers on), UNI-005 (the roster)
and UNI-006's assignment state machine, so it starts only once those exist. Three phase-67 tasks
carry a D13 note so they are built reusable rather than forked later: UNI-004 (bookings
referenceable), UNI-005 (one roster), UNI-006 (grader can be a runner *or* a person).

## Two things to check before starting any task here

1. ✅ **The old collab scoping (R6) — DONE 2026-08-14.** Located, and it is *two* documents that
   disagree: [phase 51](../phase-51-collaboration/README.md) is async git-merge collaboration and
   rules real-time **out of scope**; [ECO-001](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md)
   is the real-time one and is gated at 4–6 months. **Ruled: UNI-005/006 build on phase 51, COL-004
   (advisory component claiming, 3 days) first.** Full write-up:
   [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F2. The archaeology also turned up
   four further collisions — read the whole document, not just F2.
2. ⚠️ **The bridge direction is a constraint, not a preference.** Editor-outbound only
   (README, surface 3 — the OBS-004 lesson). Any design sketch that has the platform "pushing"
   to an editor must be rewritten as the editor pulling on its own schedule.
3. ✅ **The three curriculum blockers — FACT-CHECKED 2026-08-14** against source and git, not
   against task tables. Full write-up in [RULINGS.md](RULINGS.md).
   - **Two of three now CLEAR.** Phase 60 is **7/7 closed** and its signal wording shipped
     (`portCopy.ts`), so **L2 is unblocked** — the curriculum glossary line has been corrected in
     place. Phase 61 is **8 of 9 built on `cline-dev`** with FUN-001 §2's notation **signed**, so
     **L11 is unblocked** — ⚠️ except that FUN-005's ports rail does not exist, so no step may
     reference it.
   - ✅ **The two-vocabulary rule — the surviving blocker — is now CLOSED by a shipped check.**
     `verifyLessonManifest()` in
     [`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts)
     rejects a condition written in the prose vocabulary and names the type name to use.
     🔴 **Re-derived from the catalog 2026-08-14 and it is much larger than "nine, two ambiguous":
     103 plain divergences, 4 ambiguous, and a third class of 6 nobody had recorded** — *shadowed*
     names (`Variable`, `Button`, `Text Input`, `Checkbox`, `Radio Button`, `Cloud Function`) where
     the string IS a real type name, so an existence check passes, but it names the deprecated node.
     `Variable` is the curriculum's own L6 node. [RULINGS.md](RULINGS.md) "Blocker 1 — the
     amendment".
   - 🔴 **Two task tables were the stale artifact, not the memory.** Phase 61's table marked four
     merged tasks `open`; the curriculum glossary warned "do not author until phase 60 publishes"
     three days after it published. Both corrected in place. **Grep git and read source before
     believing a status column — including these.**
   - 🔴 **AMENDED AGAIN 2026-08-15 — the shipped check had a hole and the format had a sink.**
     A path written `%Group` (component name omitted) contained *nothing the vocabulary check
     looked at* and passed in silence, while never matching at runtime — the same silent failure by
     a different route. And a lesson body naming `javascript:` compiled into a live anchor inside a
     node-integrated renderer. Both closed (`unmatchable-node-path`, `unsafe-url`). **Both were
     found by building the check's caller, not by reading the check.** [RULINGS.md](RULINGS.md)
     "The second amendment".
   - ⚠️ **Two owed items phase 67 never carried**, both from CURRICULUM-DESIGN §11: **curriculum
     hosting** (§9.3, now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
     *"required before L2 testing"*) — UNI-007 runs straight into the second and does not mention it.
