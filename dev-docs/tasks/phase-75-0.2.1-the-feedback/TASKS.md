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
- ⬜ **FB-019** — structured-port silent failures: fix the dimension asymmetry, warn the rest
  (M/L) — **two confirmed bugs + Jordan's §2.2 aliasing investigation**
- ⬜ **FB-018** — the binding chip everywhere; say which value wins; check the §3 regression
  claim (M)
- ⬜ **FB-021** — gated ports render disabled with their reason (M)
- ⬜ **FB-015** — the image picker empty state + import into `assets/` (M)
- ⬜ **FB-017** — basics-first panel + per-node view state: collapse, scroll, width, search
  (L; revives STYLE-004's deferral)
- ⬜ **FB-016** — box-model overlay, transform-origin crosshair, radius-following highlight
  (M/L)
- ⬜ **FB-022** — drag-to-scrub numeric fields (M/L; after FB-017/018 land in the same rows)
- (FB-012 gains the CSS-basics lesson + the accumulating-state bar — tracked there)

## Tier 2 — unblocked 2026-08-22 (D6, D7 ruled)

- ⬜ **FB-001** — edit and delete your own bench post (M) — **D7 ruled 08-22: edit-own +
  delete-unanswered, no report/flag, no hide.** Build the smallest honest version
- ⬜ **FB-006** — one navigation model: launcher home, editor door (L) — **D6 ruled 08-22 as
  proposed**; build in one tranche with NAT-012 (this = launcher tabs, NAT-012 = the model + the
  editor narrowing). ⚠️ narrows D21, name it in the diff
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

## Found while working, owned by nobody (2026-08-22)

- 🔴 **The community repo's vendored `colors.css` has drifted from the editor's canonical copy —
  6 tokens.** `tests/uni013-token-drift.test.ts` is red (6 failures) and says what to do:
  `npm run tokens:sync`. It was red before this session's changes and is unrelated to them; the
  gate is working, nobody has run it. ⚠️ Sync then re-run: a drift check whose *probes* also fail
  is reporting one drift, not five.
- 🔴 **`tests/uni022-syllabus.test.ts` AC4 is red**: `src/app/api/v1/me/path/project/route.ts`
  hardcodes the lesson slug `"your-creature-on-screen"`, and that AC's whole point is that
  adding a lesson touches no `.ts` file. Pre-existing, unrelated, real.
- **Community suite baseline, 2026-08-22, after `npm run build`: 1274 specs, 7 pre-existing
  failures** (6 token drift + 1 syllabus). Compare **by name**, never by count.

## Carried from phase 74 (work lives in `phase-74-0.2.0-bug-fixes/`)

- ⬜ FIX-025 §5/§7/§12 — built, need the editor drive
- 🧭 FIX-026 — restore source decision (a)/(b), then build
- 🟡 FIX-027 — 14/15/16 🧭 · 17 ⬜ · 19/20 ⬜ · 22 🧭 · `state-on-a-page` needs a home ⬜
- 🧭 `tsfixme` baseline decision
- 🧭 Prod `ANTHROPIC_API_KEY` (⚠️ intro pricing ends 2026-08-31)

## Adjacent (stay in their phases; 0.2.1 leans on them)

- 🟡 NAT-009 — needs its view + a drive · ⬜ NAT-010 · ⬜ NAT-011 (gains FB-004's
  reconciliation AC) · 🔒 NAT-012 (D6) · ⬜ NAT-004 · 🧭 NAT-014 AC2/4/7 · 🟡 TUT-004 (the drive)
