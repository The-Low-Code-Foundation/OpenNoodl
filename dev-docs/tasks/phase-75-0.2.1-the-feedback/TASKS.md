# Phase 75 — task list

Status legend: ⬜ open · 🟡 partial · ✅ done · 🔒 blocked on a ruling · 🧭 needs Richard

## Tier 0 — verify, then quick wins (no rulings needed)

- ✅ **T0** — 2026-08-22: nexus-1 is stamped `8d40b63d9bd48b45e209e7d1e18f8da222f969de`, branch
  `main`, `dirty: false`, deployed 2026-08-21T09:25:41Z. That **matches local `main`**, so the
  `0cbd716` handover was stale and **no deploy is needed**. `community.nodegx.io` and
  `nodegx.io` both 200. ⚠️ The mail-drain refusal is therefore still ahead of us, not behind.
- ✅ **FB-008** — the community link in the editor's ?-menu (S)
- ✅ **FB-004** — the Learning tab in two tabs; path stops eating the page (S) — ⚠️ **undriven**
- 🟡 **FB-002** — web half done (default + still searchable); **editor mirror open**, and the
  task file now says why it is cheaper than filed (`accepted` is already on the wire)

## Tier 1 — the build-the-caller family (machinery exists, nobody can reach it)

- ⬜ **FB-007** — the editor uploads the capture it already takes (M)
- ⬜ **FB-010** — a settings page, so a profile can exist at all (M)
- ⬜ **FB-003** — become a coach / post an RFP: the two composers (M)

## Tier 1b — the test-user batches (filed 08-22; no rulings needed)

- ⬜ **FB-020** — the checkbox that cannot be checked (S/M) — **a broken control in a shipped
  release; first, and its diagnosis may implicate every control (design-mode listener leak)**
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

## Tier 2 — ruling-gated

- 🔒 **FB-001** — edit and delete your own bench post (D7) (M)
- 🔒 **FB-006** — one navigation model: launcher home, editor door (D6) (L)
- ⬜ **FB-011** — the ports render once (revises UNI-016's rendering pair) (S/M)

## Tier 3 — content and distribution

- ⬜ **FB-012** — a batch of default tutorials + share/export (content 🧭 Richard) (L)
- ⬜ **FB-009** — a syllabus entry you can actually start (D17 v0 hosting; lessons 🧭 Richard) (M/L)

## Tier 4 — new scope (scoping docs first, build after ruling)

- 🔒 **FB-005** — templates anyone can share (R-templates) (L+)
- 🔒 **FB-013** — the chat we argued against (R-chat) (L)
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
