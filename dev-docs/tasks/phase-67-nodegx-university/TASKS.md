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

| Task | One line | Surface | Tier | Effort | Blocked on a ruling? |
|---|---|---|---|---|---|
| [UNI-001](UNI-001-ONE-LOGIN-THAT-GATES-NOTHING.md) ⭐ | the NodeGX account: OAuth, editor sign-in, consent — the spine everything hangs off | platform + editor | **1** | M/L | ~~D1~~ ✅, D2 (D11 for the consent screen) |
| [UNI-002](UNI-002-POINTS-BADGES-AND-THE-LONG-LIST-OF-CHALLENGES.md) ⭐ | the contribution engine: points, badges, the challenge registry, the event ledger | platform | **1** | M/L | D3, D4 |
| [UNI-003](UNI-003-THE-PROFILE-THAT-FOLLOWS-YOU.md) | the public dev profile: badges, points, published prefabs, offers | platform | **1** | M | D8 (listing policy) |
| [UNI-004](UNI-004-RFPS-AND-COACHING-WITHOUT-A-GATE.md) ⭐ | the RFP board + coaching offers/booking/payment, spam-shielded relay | platform | **1** | L | D7, D8 |
| [UNI-005](UNI-005-AN-ORG-IS-A-ROSTER-AND-A-SHELF.md) | org workspaces: contact-us provisioning, GitHub org hookup, roster, shared prefab/template shelf | platform | 2 | L | D6, ~~D10~~ ✅ · builds on **phase 51 / COL-004** |
| [UNI-006](UNI-006-ASSIGN-GRADE-REVIEW.md) | org teaching: push lessons/assignments to members, view graded results, human grading override | platform + bridge | 2 | M/L | ~~D10~~ ✅, ~~D12~~ struck · no live co-editing (ECO-001 parked) |
| [UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md) ⭐ | intake → personalised path → lesson project pulled into the editor's Learning folder → graded via MCP tooling | all three | 2 | L | D5, ~~D12~~ struck → **CURRICULUM-DESIGN §11's 3 blockers** (phases 59/60/61) |
| [UNI-008](UNI-008-ONLINE-IN-ONE-CLICK-OFF-IN-FORTY-FIVE-DAYS.md) | push-to-share hosting: subdomain, 15-day life, manual restarts, 45-day cap, then the self-host off-ramp | platform + editor | 3 | L | D9 |
| [UNI-009](UNI-009-THE-COMMUNITY-HOME.md) | the site itself: tutorials/tips, meetup replays, Discourse forum SSO | platform | **1 (minimal cut)** | S/M | D2 |
| [UNI-010](UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md) | the user's own Claude authors a verified lesson into the Learning folder — an experiment with pre-registered kill/keep criteria | editor + MCP | experiment | M | D5; needs UNI-007's format + runner |

**Effort is per-v1-slice, not per-dream** — every task file carries an explicit "not in v1" list.

## Suggested order, and why

**First sitting: rulings, not code.** ✅ **Held 2026-08-14** — D1 and D10 ruled, R6 clarified, the
UNI-010 verifier question ruled, D12 struck. **Still owed, and still the cheapest next session:**
D2 (which also decides whether the new repo keeps its name), then D3 + D4 to unblock the Tier-1
focus, then D5 (UNI-007 and UNI-010 both wait on it).

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
