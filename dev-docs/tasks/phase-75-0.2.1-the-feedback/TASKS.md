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

- ⬜ **FB-007** — the editor uploads the capture it already takes (M)
- ⬜ **FB-010** — a settings page, so a profile can exist at all (M)
- ⬜ **FB-003** — become a coach / post an RFP: the two composers (M)

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
- ⬜ **FB-018** — the binding chip everywhere; say which value wins; check the §3 regression
  claim (M)
- ⬜ **FB-021** — gated ports render disabled with their reason (M)
- ⬜ **FB-015** — the image picker empty state + import into `assets/` (M)
- ⬜ **FB-017** — basics-first panel + per-node view state: collapse, scroll, width, search
  (L; revives STYLE-004's deferral)
- ⬜ **FB-016** — box-model overlay, transform-origin crosshair, radius-following highlight
  (M/L)
- ⬜ **FB-022** — drag-to-scrub numeric fields (M/L; after FB-017/018 land in the same rows)
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
- ⬜ **FB-011** — the ports render once (revises UNI-016's rendering pair) (S/M)

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
