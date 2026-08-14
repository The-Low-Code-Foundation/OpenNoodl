# Phase 67 — NodeGX University (Track UNI)

**Created:** 2026-08-14, from two brainstorm sessions with Richard (2026-08-13/14). This is a
**vision + foundations phase**: it fixes the shape of the community platform, pins the decisions
already made, queues the ones still open, and scopes the first buildable tranche. Unlike phase 66,
most of the code here does **not** live in this repo — the platform is a new codebase; this repo
gets the editor-side hooks.

## The premise, in one sentence

Everything Richard wants to offer around NodeGX — tutorials, points and badges, a forum, meetup
replays, prefab sharing, RFPs, coaching, school and company programmes, share-hosting — hangs off
**one identity**: a NodeGX account the editor can sign into, which gates *nothing* in the editor
and opens *everything* on the platform.

## The two principles (non-negotiable, restate in every task)

1. **The login gates nothing.** The editor is fully functional logged out, forever. No feature,
   node, panel, or export is ever behind the account. The account adds surfaces (learning,
   community, sharing); it never subtracts.
2. **Monetisation is services, convenience, and matchmaking — never features.** Coaching hours,
   training, org consulting, hosting convenience. Richard's own coaching offer rides the same
   rails as anyone else's ("eating my own dog food", 2026-08-14) — the RFP/coaching system is
   open to any listed dev, not exclusive to him.

## Decisions already made (2026-08-13/14 brainstorms — do not re-litigate)

| # | Decision |
|---|---|
| R1 | Points/badges/challenges, RFP + coaching, and org access are the **big focus** — in that spirit, Tier 1 of this phase |
| R2 | Badges are in ("I like them") alongside points; challenges are a **large list** covering attendance, answers, publishing, lessons — contribution as well as consumption |
| R3 | Coaching is advertised through the RFP/profile system, **open to anyone**, Richard listed first |
| R4 | Orgs (schools, companies) are **contact-us provisioned** in v1, not self-serve |
| R5 | Corporate/school orgs can hook up a **GitHub org** — org admin manages and inspects the team through that role |
| R6 | Org features: shared prefabs/modules/templates, pushing lessons/assignments, viewing graded results, **manual grading override** (human instead of AI). Real-time project collaboration was scoped in old phases — build on that, don't rescope. ✅ **Located and clarified 2026-08-14** ([PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F2): there are *two* scopings and they disagree. UNI-005/006 build on **[phase 51](../phase-51-collaboration/README.md)** (async git-merge), **COL-004 advisory claiming first — 3 days**. [ECO-001](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md) (real-time, gated, 4–6 months) **stays parked**; no UNI task may assume live co-editing |
| R7 | Share hosting: **free for 15 days**, then off; **manual restarts** allowed up to **~45 days total lifetime**; after that pay, or we hand over clear guidance + functionality to self-publish (Hetzner etc.) |
| R8 | Tutorials are Loom-*style* in pedagogy (intake conversation → personalised path → hands-on practical) but **not** Loom's codebase, and not text-instructional — the practical is **beamed into the real editor**; Loom is a north star, not a dependency |
| R9 | Lesson projects are set apart from normal projects — either hidden from the picker or a dedicated **Learning folder** in the launcher, carrying platform-only metadata (completion %, score, feedback) fed by MCP grading or admin manual grading |
| R10 | The web-light browser editor is **parked** — the login + MCP bridge makes it less necessary, not more |
| R11 | No freemium, no gating — see principle 2. Free hosting exists to create the Bubble-style "your app is already online" wow, capped by lifetime not by features |
| R12 | For people who skip the platform entirely: explore an MCP that lets **the user's own Claude** author a tutorial lesson into the Learning folder — explicitly an *experiment* Richard wants to test, with his stated risk ("the tutorial gets stuck or teaches the wrong thing") answered by generate-then-verify + provenance labels, and pre-registered kill/keep criteria (UNI-010). Corollary: **the lesson format is an open contract with two producers** (platform, local MCP) — pinned in UNI-007. ⚠️ **Reconciled 2026-08-14** ([PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F3): this experiment already exists as **[LEARN-007…010](../phase-17-noodl-learn/EXPERIMENT-GENERATED-LESSONS.md)** (specced 08-02, questions answered 08-09). Its §3.1 bans the model from authoring completion conditions; **Richard ruled 08-14 that free authoring stands, and the verifier must absorb the full F1–F6 failure taxonomy in exchange** — UNI-010 as written gated on F2 alone |

## The architecture, in three surfaces

1. **The platform** (new repo — ruling D1): identity, points/badges/challenges, profiles, RFP
   board, org workspaces, lesson pathing, content (replays, tutorials), Discourse SSO, hosting
   control plane. Loom's *patterns* (spine + projection, generate-once-cache, model tiering) are
   proven and reusable as ideas; its code is not imported.
2. **The editor hooks** (this repo): the sign-in (a card in the launcher / a menu item — nothing
   more), the Learning folder, push-to-share, prefab publish, and the grading runner that reuses
   the existing MCP tooling (`validate_component`, `validate_project`, `render_report`). The
   runner grades in both directions: a *learner's* attempt against a lesson, and a *generated
   lesson* before it may install (R12/UNI-010 — the same verifier, not a fork).
3. **The bridge — and its direction.** 🔴 The OBS-004 lesson is binding: an open localhost socket
   is readable by any web page (no same-origin on WebSockets); the relay is token-gated per launch
   for exactly this reason. Therefore **the platform never connects inbound to the user's
   machine**. Every exchange is editor-outbound: the signed-in editor *pulls* assignments and
   lesson projects from the platform API ("beaming" is a pull), runs grading locally, and *pushes*
   results up. No new listening surface on the user's machine, ever.

## The rulings queue — decisions Richard owes this phase

> ✅ **Four rulings made 2026-08-14** — D1, D10, R6's clarification and the UNI-010 verifier
> question. **D12 is struck as a false premise.** All five are written up with their consequences
> in [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md). Do not re-litigate them.

**Product-shaping (one sitting each):**
- ✅ **D1 — RULED 2026-08-14.** New repo, Next.js + Postgres + Drizzle, Docker on Hetzner; no code
  imported from Loom. Created as **[The-Low-Code-Foundation/nodegx-university](https://github.com/The-Low-Code-Foundation/nodegx-university)**
  (private, empty). ⚠️ Named from this recommendation while **D2 is still open** — if D2 renames the
  product, rename the repo *before* attaching GitHub Pages (🔴 Pages does not follow a repo rename).
- **D2** — naming + domain: "NodeGX University" vs "NodeGX Community" (or University = the
  learning wing *of* the community site); the subdomain; what the editor's sign-in button says.
- **D3** — the points economy: the currency's name, and what redemption exists at launch.
  Recommend: earn-only at launch (leaderboard + profile display); merch and coaching discounts
  as a later tranche once there are earners.
- **D4** — badge taxonomy v1 + who draws them (UNI-002 drafts the challenge list; the taxonomy
  ruling picks the launch set).
- **D5** — the Learning folder shape (R9 left two options open): hidden-flagged projects vs a
  launcher **Learning** section. Recommend the visible section — visible progress motivates —
  with "immutable" meaning *platform-managed*: the learner edits the project freely (that IS the
  lesson), but can't rename/detach/delete it from the launcher; reset = re-pull a fresh copy.
- **D6** — is GitHub the only org identity? Recommend: GitHub org hookup per R5 for companies,
  plus email-domain / invite-list membership for schools (many schools have no GitHub org).
- **D7** — payments: merchant of record (Paddle vs Lemon Squeezy — EU VAT handled for us) and
  what is sellable at launch (recommend: coaching sessions only).
- **D8** — RFP/profile listing policy: who may list (any account? points threshold? later,
  certification?), moderation, and the response-relay email plumbing.
- **D9** — hosting v1 scope: static frontend only, or frontend + record-capped multi-tenant
  backend? Plus caps (records, bundle size), the "built with NodeGX" footer, abuse policy.
- ✅ **D10 — RULED 2026-08-14: org-owned pseudonymous accounts** for under-16s. The school is the
  data controller; we hold no child PII. 🔴 This **reverses a stated design law** in
  [LEARN-005](../phase-17-noodl-learn/LEARN-005-CLASSROOM-MODE.md) ("no accounts by default",
  local-first student data) — a reversal [ECO-004](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md)
  says must be deliberate. Four obligations follow, all currently unwritten into UNI-005/006:
  LEARN-005 gets amended rather than contradicted; the handle→pupil mapping stays with the org
  (or we hold PII by another route); UNI-007's tier-1 AI projection is **off by default for org-minor
  accounts**; and phase 18 export stays a hard requirement. See
  [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F4.
- **D11** — the opt-in "share anonymous usage" toggle (confusion analytics: explain-this-node
  clicks as a curriculum heat map): in the v1 consent screen, or deferred entirely.
- ~~**D12** — LEARN-002's D1–D6~~ 🔴 **STRUCK 2026-08-14 — a false premise.** All six were answered
  **2026-08-09**, along with three new ones (D7–D9), in
  [CURRICULUM-DESIGN.md §10](../phase-17-noodl-learn/CURRICULUM-DESIGN.md). This phase was written
  from the stale 2026-07-25 memory note rather than the document it points at. There is no
  outstanding curriculum debt.
  **What actually blocks UNI-007** is [CURRICULUM-DESIGN §11](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)'s
  three authoring blockers, none of them a design question: (1) the two-vocabulary rule — nine node
  names differ between prose and conditions, and the failure is silent; (2) **phase 60's "signal"
  wording must land first** or L2 is authored against a false sentence; (3) **L11 must not be
  authored until phase 61 lands**. Confirm phases 59/60/61 status before UNI-007 claims a spine.

## What is deliberately NOT in this phase

- **The web-light browser editor** (R10 — parked, a marketing question for later).
- **Merch fulfilment** (the Backendless $1-cap trick is endorsed, but redemption waits for earners — D3).
- **Certification** ("NodeGX Certified" via graded builds) — designed for, not built; it slots
  into UNI-002/UNI-007 later and feeds RFP profiles.
- **Marketplace rev-share** (community members selling templates/courses) — after the free
  prefab shelf proves out.
- **Permanent paid hosting + custom domains** — only the free 15/45-day tier is in scope (R7);
  the paid tier is designed-for in UNI-008 but not built.
- **The real-time collaboration build** — R6 says build on the old phases' scoping; UNI-005
  only *locates and reconciles* that scoping, it does not implement collab.
- **Confusion-analytics dashboards** — D11 decides only the consent toggle; the pipeline is later.

## Standing constraints inherited — unchanged

- Editor-side work on `cline-dev`. **Never `git stash`**; `cd` to the repo root in every git
  call; explicit pathspecs; check no sibling session is live before suites.
- Gates for editor-side changes: `test:main` + `test:ci` (compare names, read
  `tests/test-results.json`), `npx tsc -p tsconfig.json --noEmit` (**never** without
  `--noEmit`), `cloud-library:check`; MCP suite after any catalog change.
- The launcher's recent-projects store is **read-only to sidecars** — the editor process itself
  writes the Learning folder state, never the platform or an MCP sidecar (UNI-007).
- The exporter publishes by **allow-list** — hosting (UNI-008) ships the exported artifact and
  must never widen `PUBLISHABLE_AUTH_FIELDS`.
