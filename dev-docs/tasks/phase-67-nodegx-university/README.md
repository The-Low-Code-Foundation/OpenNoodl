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
   board, org workspaces, lesson pathing, content (replays, tutorials), the Bench (our own Q&A surface, D19), hosting
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

## The rulings queue — ⚠️ REOPENED 2026-08-15 (D14 ruled · D15, D16 open)

> ⚠️ **It was empty, and it is not any more.** 2026-08-15 Richard scoped **UNI-011** — the community
> mirrored inside the app — which brought **D14** (ruled: the web is canonical, the **editor mirrors
> it against the same API**, editor-only features are the transition incentive) and left **D15**
> (community for org-minor accounts) and **D16** (the never-empty launch threshold) open. **D13 is
> amended** in the same sitting: LearnBook gains an **editor client**; its *build* does not move off
> the platform. All of it is in [RULINGS.md](RULINGS.md).
>
> ✅ **The original eleven are still made. The register is [RULINGS.md](RULINGS.md)** — read that, not
> the list below, which is kept only as the record of what was asked.
>
> **First session 2026-08-14:** D1, D10, R6's clarification and the UNI-010 verifier question;
> **D12 struck** as a false premise — written up in
> [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md).
> **Second session 2026-08-14:** **D2–D9 and D11**, with their consequences, in
> [RULINGS.md](RULINGS.md). 🔴 Do not re-litigate any of them; amend the register instead.
>
> **The three headlines a reader needs before opening any task:**
> 1. The site is **NodeGX Community**; University is its learning wing; the button says **"Sign in
>    to NodeGX"**; ⚠️ the repo must be renamed to `nodegx-community` **before** any Pages deploy.
> 2. The **Learning section is visible and platform-managed** (D5) — which unblocks UNI-007 *and*
>    makes UNI-010 runnable with no platform at all.
> 3. **D9 went against the recommendation** — hosting includes a record-capped backend, so UNI-008
>    now carries a data-retention, export and DPA obligation. Five consequences in the register.

**Product-shaping (one sitting each):**
- ✅ **D1 — RULED 2026-08-14.** New repo, Next.js + Postgres + Drizzle, Docker on Hetzner; no code
  imported from Loom. Created as `nodegx-university` and ✅ **RENAMED 2026-08-14 to
  [The-Low-Code-Foundation/nodegx-community](https://github.com/The-Low-Code-Foundation/nodegx-community)**
  (private, empty) once D2 named the product. The rename was done while the repo was still empty
  with **no Pages site attached** — verified before and after — which is the only free window,
  because 🔴 **GitHub Pages does not follow a repo rename.** ⚠️ The phase's *directory* here is still
  `phase-67-nodegx-university`; that is a local path and is deliberately not renamed.
- ✅ **D2 — RULED 2026-08-14: "NodeGX Community"**, with **NodeGX University as its learning wing**.
  Subdomain `community.nodegx.io`; the editor button says **"Sign in to NodeGX"**. 🔴 **The repo
  renames to `nodegx-community`** — do it before anything is attached. ✅ **AMENDED 2026-08-17: the
  subdomain is `.io`, not the `.dev` this ruling first chose, and it RESOLVES** (A → nexus-1
  `49.12.102.195`). ⚠️ **Resolving is not being served** — nothing is deployed there.
  [RULINGS.md](RULINGS.md) D2.
- ✅ **D3 — RULED 2026-08-14: earn-only at launch.** Leaderboard + profile display; no redemption.
  Merch and coaching discounts are a later tranche once there are earners. 🔴 The event ledger is
  still **append-only and auditable from day one** — that is the part v1 must not skimp. The
  currency's *name* is deliberately left to UNI-002's UI work.
- ✅ **D4 — RULED 2026-08-14: four families × three tiers** (Learning, Building, Contributing,
  Community; bronze/silver/gold) — ~12 flat-SVG artworks. 🔴 The consequence is architectural: **a
  challenge awards into a (family, tier); it does not own a badge**, which is what keeps R2's long
  challenge list affordable. A `badgeId` per challenge re-couples them — do not build that.
- ✅ **D5 — RULED 2026-08-14: the visible launcher Learning section**, "immutable" meaning
  *platform-managed*: the learner edits the project freely (that IS the lesson) but can't
  rename/detach/delete it; reset = re-pull a fresh copy. **Unblocks UNI-007 and UNI-010** — and
  because the section is written by the editor process, a locally-authored lesson lands in it with
  no account at all.
- ✅ **D6 — RULED 2026-08-14: both.** GitHub org hookup per R5 for companies, plus invite-list /
  email-domain membership for schools (most state schools have no GitHub org — and schools are the
  population D10 was ruled for). One roster table; the source is a column, not a second roster.
- ✅ **D7 — RULED 2026-08-14: Paddle**, coaching sessions only. Both candidates are merchants of
  record handling EU VAT; **Lemon Squeezy was acquired by Stripe in 2024** and is no longer an
  independent bet. Org contracts stay contact-us and invoiced (R4).
- ✅ **D8 — RULED 2026-08-14: open to anyone** (R3 already said so) behind a profile-completeness
  bar; **reactive** report-and-review moderation rather than approval-first; a **double-blind
  relay** that reveals no address until both sides accept — which is also UNI-004's spam shield.
- 🔴 ✅ **D9 — RULED 2026-08-14: frontend *and* a record-capped backend — against the
  recommendation.** The full Bubble wow, at the price of holding end-user data on an expiring free
  tier. **Five obligations follow** and none was in UNI-008's scope: expiry becomes a data-deletion
  event; **records must be exportable before expiry** (ECO-004's exit requirement now reaches the
  data, and phase 18's project export no longer covers it); caps/rate-limits/kill-switch are v1 not
  hardening; a DPA is needed because the builder becomes a controller and we a processor; and
  **D9 × D10 intersect** — the backend tier should be off by default for org-minor accounts. This
  **raises UNI-008's effort** and confirms its deliberately-last placement. [RULINGS.md](RULINGS.md) D9.
- ✅ **D10 — RULED 2026-08-14: org-owned pseudonymous accounts** for under-16s. The school is the
  data controller; we hold no child PII. 🔴 This **reverses a stated design law** in
  [LEARN-005](../phase-17-noodl-learn/LEARN-005-CLASSROOM-MODE.md) ("no accounts by default",
  local-first student data) — a reversal [ECO-004](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md)
  says must be deliberate. Four obligations follow, all currently unwritten into UNI-005/006:
  LEARN-005 gets amended rather than contradicted; the handle→pupil mapping stays with the org
  (or we hold PII by another route); UNI-007's tier-1 AI projection is **off by default for org-minor
  accounts**; and phase 18 export stays a hard requirement. See
  [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F4.
- ✅ **D11 — RULED 2026-08-14: in the v1 consent screen, default off.** One consent moment rather
  than re-consenting every existing account later. 🔴 **Not rendered at all for org-minor accounts**
  (D10 obligation 3) — absent, not shown-and-unchecked. The scope is part of the consent string
  (*which nodes people ask about, never project content*); the heat-map pipeline stays out of scope.
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

## 🔴 What closes this phase — the alpha bar, set 2026-08-18

**The phase had no written exit criterion for five days**, which is why "are we nearly done" had no
answer. It has one now, and it is deliberately a *shipping* bar rather than a task-count: 18 tasks
across four tiers will never all be done, and waiting for that is how a phase never closes.

> **Phase 67 closes when a stranger can reach `community.nodegx.io`, make an account, ask a
> question about a node from inside the editor, and get an answer — and when that site does not
> look like a placeholder.**

Everything below is a consequence of that sentence. **Ten items. Nothing else blocks the close.**

> 🔴 **Amended 2026-08-19:** nine became ten. **E10 — a GitHub OAuth App** — was invisible while E1
> was unbuilt, because a missing issuer hides the fact that an issuer needs a credential. It is the
> cheapest item here and it blocks the criterion's first verb.

### The four that are code, and they are the whole critical path

| # | What | Owner | Why it is on this list |
|---|---|---|---|
| **E1** | ✅ **UNI-001's issuer — BUILT 2026-08-19 (session 29).** Sessions are minted; GitHub OAuth in the browser; a device flow for the editor; sign-out revokes. ✅ **AC2's launcher card + chip BUILT 2026-08-18 (session 33)** and driven in a real editor — sign-out deletes the store file; a sign-in click reports the unreachable platform rather than hanging | task | ⚠️ **Code-complete, and NOBODY CAN SIGN IN YET** — the start route answers 503 without `GITHUB_OAUTH_CLIENT_ID`. **That is E10, and it is Richard's.** 🔴 **The only editor work this criterion still names is AC4's grep, which needs a RULING and not a run** |
| **E2** | 🔴 **Deployment** — the platform served at `community.nodegx.io` | 🔴 **NO TASK OWNS IT** | It resolves (A → nexus-1) and nothing serves it. ⚠️ Shares the box with two live sites and Caddy is all-or-nothing — **curl the neighbours before and after** |
| **E3** | ✅ **MET 2026-08-18 (session 31) — [UNI-019](UNI-019-NOTHING-ON-THE-HOME-PAGE-IS-A-LINK.md) built, `nodegx-community@636d488`.** The home shows real threads signed out, **and** renders every rail with the bench empty (the D16 arm). `/bench` is first in the nav | ✅ done | D19 rewrote it; `/bench` exists and **the home page does not link to it** (observed, session 28). 🆕 **OWNED 2026-08-18 (s30), and it is worse than session 28 recorded: the home page has NO links at all** — six `<section class="card">`, **zero anchors**, for every viewer. **The only internal link to `/bench` in the whole app is the Bench's own filter pill.** ⚠️ This is an owner, **not an eleventh item** |
| **E4** | ✅ **UNI-013 slice 5 — BUILT 2026-08-18 (session 32).** All three archetypes exist and every page is an instance of one: the **list** archetype over the six list pages, the **detail** archetype on three, and the **fourth kit component — the facet bar — drawn with real counts**. Avatars on `/people`; the Bench's two link styles now one; the replay link's missing `target`/`rel` fixed in the kit rather than per page; two empty states where the no-match arm's action is asserted to clear the filter | ✅ done | Richard, three times: *"simple and sad"*, *"really disappointed visually"*. ⚠️ **The complaint is not fully answered and its own scope says why** — *"no new pages, routes, or schema"*, so the pages are now composed and six of them still have thin content on them. **That half is UNI-020…023 and is deliberately OUTSIDE this close.** 🔴 **Two things this slice could not close and did not pretend to:** `/tutorials` rows still do not link, because `/tutorials/[slug]` is UNI-020's — the row TYPE now makes an unlinked row impossible without a recorded reason, and the suite asserts it is one page; and **nobody has looked at any page in the LIGHT theme**, which is graded by the contrast arithmetic only. 🔴 **The slice also found that the active filter pill's ground is TRANSLUCENT and has been ungraded since slice 1** — a new PAIRING, not a new colour role, is what should trigger a contrast row |

### The four that are Richard's, and three of them gate E1/E2

| # | What | Blocks |
|---|---|---|
| **E5** | 🔴 **The nexus-1 decision** — does the platform go there? | **E2**, and it is the first domino |
| **E6** | **A transactional sending account + domain** (Postmark / SES / Resend) | **D19's own condition.** The ruling was made *on* email landing: *"a forum where 'someone answered you' never reaches an inbox is a forum nobody returns to."* `log` delivery covers dev and **cannot ship** |
| **E7** | **Where capture images live** | Nothing hard — a `capture` stores dimensions and consent and no image, so **nothing migrates** when it is decided. ⚠️ Intersects E2 |
| **E10** | 🔴 **A GitHub OAuth App** — client id + secret | 🆕 **Added 2026-08-19, and it is now the cheapest item on this list to clear and one of the most blocking.** E1's code is built and specced end to end; without these two strings `/api/auth/github/start` answers **503** and *nobody on earth can make an account*, which is the first verb in the exit criterion. Homepage `https://community.nodegx.io`, callback **`https://community.nodegx.io/api/auth/github/callback`** — ⚠️ byte for byte, GitHub reports a mismatch without saying which side is wrong. Free, one form. ⚠️ Intersects **E5/E2**: the callback URL has to be where the platform is actually served |

### The two that are hygiene

| # | What |
|---|---|
| **E8** | 🔴 **`NOTIFICATION_LINK_SECRET` has a dev default.** A deployment that does not set it has **forgeable unsubscribe links**. This is a launch blocker, not a nice-to-have |
| **E9** | A smoke drive of the whole loop **on the deployed box**, signed in, over real HTTPS — because every gate in both repos runs against localhost |

### 🔴 Explicitly NOT in the close — written down so they stop reading as unfinished

> 🆕 **Added 2026-08-18 (s30) — the four content tasks, and the line is deliberate.**
> **[UNI-020](UNI-020-A-TUTORIAL-THAT-SAYS-WHAT-IT-TEACHES.md)** (tutorial detail route + content
> model), **[UNI-021](UNI-021-REPLAYS-YOU-CAN-ACTUALLY-WATCH.md)** (posters, chapters, in-place
> player), **[UNI-022](UNI-022-THE-SYLLABUS-PUBLISHED.md)** (University becomes the curriculum) and
> **[UNI-023](UNI-023-ONE-FACET-BAR-SIX-LISTS.md)** (the facet bar) were scoped from Richard's read
> of the running site and are **NOT in this close**. 🔴 **The list stays at ten items.**
>
> ⚠️ **Where the line falls, and why it is not arbitrary:** the close's bar is *"does not look like
> a placeholder"*. **UNI-019 is in** because a page whose cards do not click is broken rather than
> plain, and it is E3's owner. **UNI-013 slice 5 is in** because it is already E4. The other four
> add *content* — schema, routes, filters — and a phase closing on *"somebody can sign up and use
> it"* does not need them to be true. 🔴 **What must not happen is the reverse reading:** these are
> not polish deferred forever. They are the reason slice 5 on its own will not satisfy the person
> who asked for it, and that argument is in the artifact rather than buried here.

**UNI-017** (queue + *same here*), **UNI-018** (pull a graph — and it carries an arbitrary-code
hazard that deserves its own care, not a deadline), **UNI-007**'s intake, **UNI-006**'s bridge
endpoint, **UNI-011**'s in-editor views (**deliberately** unbuilt — D16's ship order is the reverse
of its build order), **UNI-008** hosting, **UNI-010**'s remaining slice, **UNI-012**'s
packaged-install check, and **UNI-013 slice 4** (the twelve badge artworks — the profile renders a
family mark and a tier colour rather than a broken image, which was the point of doing it that way).

⚠️ **These are a phase 67b or they fold into phase 68.** That is a call for Richard at the close,
not a thing to decide by drift.

## What is deliberately NOT in this phase

- **The coaching delivery space (LearnBook)** — D13, ruled 2026-08-14: programs, modules, threaded
  coach↔coachee exchange, rich media, assignments-with-validation. It is
  **[phase 68](../phase-68-learnbook/README.md)**, sequenced after Tier 1 + UNI-004, built on the
  D1 stack (not NodeGX — the reasons are in [RULINGS.md](RULINGS.md) D13, do not re-litigate).
  UNI-004 keeps only the transaction: offer → booking → payment.
  ⚠️ **Amended 2026-08-15:** D14's mirror rule reaches it — LearnBook gains an **editor client** as a
  later phase-68 tranche, because an assignment can then carry **evidence from the real project**
  (UNI-007's grading runner already evaluates conditions against a live graph). 🔴 D13's reasons were
  about *where it is built*, and none of them moves: the platform still owns the server and schema.
  Phase 68's *"no editor-side code, no bridge"* becomes *"none in v1"*.
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
