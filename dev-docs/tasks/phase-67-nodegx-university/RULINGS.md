# Phase 67 — the ruling register

**Purpose:** one place that holds every decision this phase owed, so no task re-derives one and no
future phase re-litigates one. Supersedes the "rulings queue" in [README.md](README.md), which now
points here.

**Status: the queue is EMPTY — D18 ruled 2026-08-17; D15, D16 and D17 ruled 2026-08-16.** It
reopened 2026-08-15 with D14; all three successors are now closed and every one was ruled **as
recommended**, which is recorded because a queue emptied by agreement is weaker evidence than one
emptied by argument — see the note under D17. D1 and
D10 were ruled 2026-08-14 (first session, written up in
[PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md)); **D2–D9 and D11 were ruled 2026-08-14
(second session)** and are recorded below. R6's clarification and the UNI-010 verifier question are
in the reconciliation document. **D13 was ruled 2026-08-14 (fourth session)** — the coaching
delivery layer (LearnBook) is [phase 68](../phase-68-learnbook/README.md), on the platform stack —
and is **amended 2026-08-15** by D14 (an editor *client*; the build does not move).

> ✅ **The queue reopened 2026-08-15 and closed again 2026-08-16.** D14 arrived with **D15** and
> **D16** open; **D17** (curriculum hosting) was added 2026-08-16 out of CURRICULUM-DESIGN §9.3,
> owed by LEARN-002 since 2026-08-09 and never ruled. All three were put to Richard in one sitting
> — *before* the work they gate, which was the whole point of raising them — and all three were
> ruled 2026-08-16. Their sections below carry the rulings.
>
> 🔴 **The rule that outlives them:** D15 and D16 gate what UNI-011 may **ship**, not what it may
> **be built as**. Finding that out after building it is the expensive order, and that is why they
> were asked while the platform track was starting rather than when the mirror was ready.

> 🔴 **Do not re-litigate any of these.** If one turns out to be wrong, amend it here with a date
> and a reason — do not leave two live documents in disagreement. That failure mode is what
> produced four of the five findings in the reconciliation.

---

## The register

| # | Question | Ruling | Ruled |
|---|---|---|---|
| **D1** | Platform repo + stack | New repo, **Next.js + Postgres + Drizzle, Docker on Hetzner**; no code imported from Loom | 08-14 |
| **D2** | Naming + domain | **NodeGX Community** — University is its learning wing | 08-14 |
| **D3** | Points economy | **Earn-only at launch** — no redemption | 08-14 |
| **D4** | Badge taxonomy v1 | **Four families × three tiers**, ~12 artworks, flat SVG | 08-14 |
| **D5** | Learning folder shape | **Visible launcher section**, platform-managed | 08-14 |
| **D6** | Org identity | **GitHub org for companies + invite list / email domain for schools** | 08-14 |
| **D7** | Payments | **Paddle** as merchant of record; **coaching sessions only** sellable | 08-14 |
| **D8** | RFP/profile listing policy | **Open to anyone** with a profile bar; **reactive** moderation; **double-blind relay** | 08-14 |
| **D9** | Hosting v1 scope | **Frontend + record-capped shared backend** — *against the recommendation* | 08-14 |
| **D10** | Minors + GDPR | **Org-owned pseudonymous accounts**; school is the data controller | 08-14 |
| **D11** | Usage-analytics toggle | **In the v1 consent screen, default off**; never shown to org-minor accounts | 08-14 |
| ~~D12~~ | ~~LEARN-002's D1–D6~~ | 🔴 **STRUCK** — a false premise; all six answered 2026-08-09 | 08-14 |
| **D13** | Coaching delivery (LearnBook) | **Phase 68, platform repo, D1 stack — not NodeGX**; reuses UNI-005's roster and UNI-006's state machine; NodeGX rebuild is a later tranche · ⚠️ **amended 08-15 by D14** — an editor *client* is in scope; the *build* does not move | 08-14 |
| **D14** | Community surface: web, editor, or both | 🔴 **BOTH — the web is canonical and public; the editor MIRRORS it against the same API.** Editor-only features are the transition incentive, not a different feature set | **08-15** |
| **D15** | Community for org-minor accounts | **Default OFF; org admin may enable READ-ONLY.** Never write, never post, in either client | **08-16** |
| **D16** | The never-empty launch threshold | **30 threads · 3 consecutive weeks with a call held · median first reply < 24h.** Until met, the entry point opens the browser | **08-16** |
| **D17** | Curriculum hosting — where lessons are served from | **Part of the platform API under D14; GitHub Pages as v0.** 🔴 A lesson must stay installable from a **local directory with no origin**, whatever else changes | **08-16** |
| **D18** | One accent hue across the products | 🔵 **AZURE** (`#4da3ff`) — the community site adopts the editor's, against the recommendation. ⚠️ The **landing page keeps teal** and becomes the odd one out; that is chosen, not inherited | **08-17** |

---

## D18 — azure, and the recommendation it went against · ✅ RULED 2026-08-17

**Asked** because UNI-013 could not be scoped without it: the two shipping systems disagree.
The editor is **azure** `#4da3ff` (`--base-color-azure-500`); the landing page is **teal** `#0b8f81`
light / `#2dd4bf` dark (`--signal`). The community site is neither — it is `#4b9fff`, a hand-made
near-miss of the editor's azure, which is the evidence that nothing was ever imported.

**Ruled: azure.** One hue across the two *products* — the editor and the community site — which is
the pair a user moves between, and the pair D14/UNI-011 puts inside a single window.

> 🔴 **Recorded as a ruling that went AGAINST the recommendation, because that is the useful half.**
> The pitch argued **teal**, reasoning that the landing page is what a stranger meets first and the
> community site sits directly behind it, so those two should agree. Azure accepts the opposite
> trade: **the landing page becomes the odd one out.**
>
> This register carries a standing note that *"a recommendation adopted wholesale is weaker evidence
> of a good decision than one argued down"* (see the note under D15–D17). **D18 is the first ruling
> in this phase that was argued down**, and it is worth one line saying so.

**Consequences.**

1. **UNI-013** adopts the editor's `--base-color-azure-*` ramp; `#4b9fff` disappears.
2. 🔴 **`nodegx-web` is NOT in scope and keeps teal.** If it is ever brought into line, **this ruling
   is the reason it moves rather than the community site** — that direction is now decided in
   advance, which is the thing a register is for.
3. **UNI-011's mirror** renders community content inside an azure editor, and no longer has a hue
   seam at the boundary.

⚠️ **What would reopen it:** a decision that the landing page and the community site are one
*brand surface* and the editor is the outlier. That is a marketing call rather than a product one,
and nobody has made it.

---

## D2 — NodeGX Community, and the rename that must happen now

**Ruled: the site is "NodeGX Community". "NodeGX University" is its learning wing** — one section
beside the forum, RFP board, prefab shelf and replay library.

| | |
|---|---|
| Site name | **NodeGX Community** |
| Learning wing | **NodeGX University** (a section, not a product) |
| Subdomain | ~~`community.nodegx.dev`~~ → **`community.nodegx.io`** (amended 2026-08-17, see below) |
| Editor sign-in button | **"Sign in to NodeGX"** |
| Repo | `nodegx-university` → **`nodegx-community`** |

**Why:** learning is roughly a third of what the platform does — R1's big focus is points, RFPs and
orgs — so "University" would misname most of it. The neutral button never over-promises: it is
truthful whether the account opens onto a lesson, a forum thread, or an RFP.

🔴 **The rename is time-critical and the reason is recorded.** GitHub Pages does not follow a repo
rename — a Pages site attached before the rename keeps serving from the old path and the new one
404s. The repo is **private and empty and has no Pages site**, so the rename is free *today* and
expensive after the first deploy. **Rename before anything is attached.**

⚠️ **No domain is committed anywhere in this repo.** Checked 2026-08-14: `nodegx.dev` appears only
as aspirational JSON-Schema `$id`s in phase 10's drafts, and the `signal./sync./notify.nodegx.com`
hosts are from a 2024 collaboration draft that was never built. `community.nodegx.dev` is a choice
this ruling makes, not a fact it records — **the domain still has to be registered.**

### ✅ AMENDED 2026-08-17 by Richard — it is `community.nodegx.io`, and it resolves

**A record → nexus-1, `49.12.102.195`**, confirmed at the authoritative nameserver and at 8.8.8.8.
`nodegx.io` and `www.nodegx.io` already pointed there (the landing page), so this is a subdomain of
a domain that was **already registered**, on Namecheap's nameservers.

🔴 **The correction worth keeping is not the TLD, it is how long it survived.** This ruling
correctly flagged its own subdomain as *"a choice this ruling makes, not a fact it records"* — and
then **four days of handovers turned it into a fact**, carrying *"`community.nodegx.dev` is not
registered"* as item 1 for Richard through six sessions. Nobody checked it against a registrar, and
the check was one `dig`. ⚠️ **The blocker was mis-stated the whole time**: it was never *"a domain
needs registering"*, it was *"a subdomain of a domain we already own needs an A record"* — a much
smaller ask, and one that might have been done days earlier had it been described accurately.
*A caveat travels worse than the claim it qualifies; the claim gets copied forward and the caveat
does not.*

⚠️ **Resolving is not being served, and the two must not be collapsed.** nexus-1 runs the static
`nodegx.io` landing page plus two of Richard's live sites, and Caddy has **no site block** for
`community.nodegx.io`; the platform (`nodegx-community`) is deployed nowhere. 🔴 **A response from
that host is therefore not evidence of anything** — Caddy 308s http→https for *every* Host including
invented ones. Read the loaded config from the admin API at `127.0.0.1:2019` instead.

✅ **What it does unblock:** OAuth callback URLs can now be registered against a hostname that
resolves, which is exactly what UNI-001's remainder was waiting on.

**Consequences:** UNI-009 is "the community home" in the literal sense — it *is* the site, and the
tutorials index is one card on it. UNI-001's button copy is fixed and must not be reinvented per
surface (the FUN-001 shape: four surfaces disagreeing about one string is worse than blank).

---

## D3 — earn-only at launch

**Ruled: points accrue and display; nothing is redeemable in v1.** Leaderboard and profile display
only. Merch (the endorsed Backendless $1-cap trick) and coaching discounts become a later tranche
**once there is a population of earners**.

**Consequences for UNI-002:** no redemption ledger, no fulfilment, no shipping, no refund policy,
no tax question. The event ledger still has to be **append-only and auditable from day one** —
retro-fitting redemption onto a ledger you cannot recount is the expensive version of this decision,
and it is the one thing v1 must not skimp.

⚠️ **Residual, deliberately not ruled:** the currency's *name*. It is a copywriting choice with no
architectural consequence, and it can be picked when UNI-002's UI is written. Do not let it block
the engine.

---

## D4 — four families, three tiers

**Ruled: ~8–10 badges at launch across four families — Learning, Building, Contributing,
Community — each with a bronze/silver/gold tier.** Flat SVG in the editor's existing icon idiom.

```
Learning      ▸ finished a lesson · a path · the spine
Building      ▸ published a prefab · 5 · 25
Contributing  ▸ answered a question · 10 · 50
Community     ▸ attended a meetup · 5 · spoke at one
```

**The consequence is architectural, not decorative.** R2 wants a **large** challenge list, and this
ruling is what makes a large list affordable: **a challenge awards into a (family, tier), it does
not own a badge.** The badge table is twelve rows and stays twelve rows; the challenge registry
grows without artwork. A schema where a challenge carries a `badgeId` re-couples them and puts every
new challenge behind a drawing — **do not build that.**

---

## D5 — a visible Learning section, platform-managed

**Ruled: a "Learning" section in the launcher, beside recent projects.** R9's two options are
resolved in favour of the visible one — visible progress motivates.

**"Immutable" means platform-managed, not read-only.** Precisely:

- The learner **edits the lesson project freely** — that IS the lesson. Nothing about the project
  content is locked.
- The learner **cannot rename, detach or delete it** from the launcher.
- **Reset = re-pull a fresh copy.** That is the whole recovery story; there is no undo stack to
  maintain and no partial-repair path.

**Consequences:**

- 🔴 **The launcher's recent-projects store is read-only to sidecars** (standing constraint). The
  **editor process** writes Learning-section state — never the platform, never an MCP sidecar. A
  design that has the platform writing the launcher store is wrong on the bridge direction as well
  as this one.
- **This is what makes UNI-010 runnable with no platform at all.** A lesson the user's own Claude
  authors locally lands in the same visible section, through the same editor-owned writer, with no
  account involved. UNI-010 is unblocked by this ruling as much as UNI-007 is.
- Progress metadata (completion %, score, feedback) lives on the section entry, and is fed either by
  local grading (UNI-007's runner) or by a pulled platform result — **the display does not care
  which**, and must not be built assuming an account exists.

---

## D6 — two membership sources, one roster

**Ruled: GitHub org hookup for companies (R5), invite list / email-domain membership for schools.**

```
Org identity
├─ Company  ->  GitHub org      (admin role = org admin, per R5)
└─ School   ->  invite list / email domain
                the org mints handles and keeps the mapping (D10)

Both feed ONE roster table.
```

**Why both:** most state schools have no GitHub org, and schools are the population D10 was ruled
for. A GitHub-only identity would rule out the users the privacy ruling exists to serve.

**Consequence:** membership *source* is a column, not a second roster. Roles, assignment and grading
(UNI-006) read the roster and must never branch on where a member came from.

---

## D7 — Paddle, coaching only

**Ruled: Paddle as merchant of record. Coaching sessions are the only sellable at launch.** Org
contracts stay contact-us (R4) and are invoiced outside the platform.

**Why Paddle over Lemon Squeezy:** both are merchants of record handling EU VAT on our behalf, which
is the requirement. Lemon Squeezy was **acquired by Stripe in 2024**, so it is no longer an
independent bet; Paddle is. The catalogue is small enough that Lemon Squeezy's lighter setup was not
worth the roadmap risk.

**Consequence for UNI-004:** payments are no longer a blocker for the board itself. The
booking-form-ends-in-an-email v0 remains an acceptable interim while the Paddle account is set up —
build the board so payment is a step that can be absent.

---

## D8 — open listing, reactive moderation, a double-blind relay

R3 already ruled that listing is **open to anyone** (Richard listed first, "eating my own dog
food"). This ruling settles the guard and the relay.

```
To list:     account + complete profile + ≥1 published thing or lesson completion
Moderation:  reported -> reviewed -> hidden        (reactive, not approval-first)
Relay:       client --▸ platform --▸ dev
             addresses revealed only on mutual accept
```

**Why reactive:** approval-first is a queue only one person can clear, and it is a bottleneck that
grows with success — the failure mode is that the board looks dead because Richard was busy.

**The double-blind relay is the spam shield UNI-004 already asks for**, so it is one mechanism doing
two jobs, not a new subsystem. 🔴 Neither side sees an email address until both accept — and the
relay must not leak the address in a header, a reply-to, or a bounce.

---

## D9 — frontend **and** a record-capped backend

**Ruled: the hosted tier serves the exported frontend *and* a record-capped slice of the inbuilt
backend.** ⚠️ **This goes against the recommendation**, which was static-only. The reason it was
recommended against is not that the feature is wrong — it is the strongest version of the Bubble
wow, and a data-driven app that works the moment it is pushed is the demo — but that it converts
UNI-008 from a file-serving problem into a **data-holding** one.

**The obligations this creates, recorded so the bet is honest rather than discovered later:**

1. **Expiry becomes a data-deletion event, not a file deletion.** R7's 15-day life and 45-day cap
   now delete *end users'* records, not just the builder's bundle. That needs a stated retention
   policy and a warning before it fires.
2. **ECO-004's exit requirement extends to the data.** *"Users' work must remain theirs and
   retrievable"* — phase 18's project export is no longer a sufficient answer, because the records
   are not in the project. **Records must be exportable before expiry**, and per ECO-004 that is a
   hard requirement, not a nice-to-have.
3. **A free multi-tenant backend is an open write endpoint.** Record caps, rate limits, bundle-size
   caps and a per-app kill switch are v1 scope, not hardening.
4. **A published app that collects personal data makes the builder a controller and us a
   processor.** That needs a DPA, and it is a different legal posture from D10's "we hold no child
   PII" — D10 covers *learners*; this covers *the end users of learners' apps*.
5. 🔴 **D9 × D10 intersect.** A pupil on an org-minor account publishing an app that collects data
   from other children is the case to think about before it happens. Recommend the backend tier be
   **off by default for org-minor accounts**, matching the AI-projection default D10 already set.

**Consequence for scheduling:** this confirms rather than changes UNI-008's Tier-3, deliberately-last
placement, and it **raises its effort**. It must not be pulled earlier because the wow is tempting —
it is now the only task in the phase that carries both a standing ops burden and a standing legal
one. The exporter's allow-list constraint is unchanged: hosting ships the exported artifact and
**must never widen `PUBLISHABLE_AUTH_FIELDS`**.

---

## D11 — the consent row, default off

**Ruled: the "share anonymous usage" toggle appears in UNI-001's v1 consent screen, unchecked.**

```
Consent screen (UNI-001)
[x] Create my NodeGX account
[ ] Share anonymous usage data          <- off by default
    Which nodes people ask about, never project content.

Org-minor accounts: the row is not rendered at all.
```

**Why now rather than deferred:** the checkbox is cheap today; adding it later means re-consenting
every account that already exists, which costs more and reads worse.

**Consequences:**

- 🔴 **Never shown to org-minor accounts** — D10 obligation 3. Not "shown and defaulted off":
  **absent**.
- The scope of what is shared is part of the consent string, not a policy page: *which nodes people
  ask about*, never project content.
- The pipeline that consumes it (the confusion heat map) stays out of scope. This ruling buys the
  *right to collect*, not a dashboard.

---

## D13 — coaching delivery (LearnBook) is phase 68, on the platform stack

**Ruled 2026-08-14 (fourth session): the coaching delivery layer — Richard's LearnBook concept:
programs of modules and threaded coach↔coachee exchanges, rich media, visibility control,
assignments the coach must validate — is a phase of its own,
[phase 68](../phase-68-learnbook/README.md), sequenced after this phase's Tier 1 and UNI-004. It is
built in the platform repo on the D1 stack (Next.js + Postgres + Drizzle), not in NodeGX.**

**Why it exists at all:** D7 made coaching sessions the only sellable at launch, and UNI-004 stops
at the transaction — offer → booking → confirmation. What happens after someone books is currently
"an email and a video call URL". LearnBook is the delivery half of the one revenue rail this phase
has. Richard ran the original LearnBook for real coaching and it worked; this is a rebuild on the
Community spine, offered to anyone coaching or mentoring through the platform, not only to him
(the R3 posture).

**Why not NodeGX — recorded so it is not re-litigated:**

1. **D1 already made this call for the platform itself.** LearnBook wants the platform's accounts,
   roster, relay and Postgres; building it in NodeGX means duplicating that spine or wiring to it
   awkwardly.
2. **D9's backend is a record-capped demo tier**, deliberately capped as an abuse shield. It is not
   production storage for years of coaching threads and video — LearnBook-in-NodeGX would need a
   real backend anyway, making "made with NodeGX" half-true. Half-true is worse than absent.
3. **The feature list sits exactly on the node library's gaps** — WYSIWYG with image upload and a
   table constructor, MediaRecorder audio/video, file attachment, threaded comments, PWA push. None
   exists as a node today; building the app and the missing node library simultaneously is the 10×
   cost case, on a revenue rail that has to actually work.

**The dogfooding is inverted, not discarded.** The gaps LearnBook exposes are exactly the prefabs
the ecosystem needs. Phase 68's recorded *second act* — deliberately not in its v1 — rebuilds the
coachee-facing frontend as a flagship NodeGX export against the platform API, and every missing
capability becomes a published prefab on the UNI-005 shelf, earning UNI-002 Building badges. That
turns the demo into ecosystem assets instead of a tax on the coaching launch.

**Consequences:**

- **UNI-004 builds the transaction only.** Its "Not in v1" now names the delivery space explicitly;
  build the booking flow so a phase-68 space can attach to a booking later without rework.
- **UNI-005's roster is consumed.** Phase 68's coaching groups are a *use* of the one roster table,
  never a second group system.
- **UNI-006's assignment state machine is reused with a human grader.** Assignment → submission →
  validation-before-complete → feedback is the same machine; the coach replaces the grading runner.
  Do not fork it.
- 🔴 **Vocabulary: phase 68's tree is Program → Module → Thread.** "Lesson" stays reserved for
  UNI-007's editor-lesson format. Two products sharing the word "lesson" is the two-vocabulary
  failure this phase spent a day cleaning up — the rename is free today.
- **D10 reaches it.** Coaching spaces put an adult in private threaded exchange with org-minor
  accounts; phase 68 opens with that surface **off for org-minor accounts** until its safeguarding
  ruling (E3 in its queue) says otherwise — the same default-off posture as D9 obligation 5.

### ⚠️ D13 amended 2026-08-15 — LearnBook gets an editor client; the build does not move

**D14 reaches D13.** Richard asked whether LearnBook could be mirrored in the editor, on the
grounds that *"syncing up what the trainer is asking the learner to do, and what they've actually
done in the editor"* is the whole difficulty of coaching a builder. **Ruled: yes, as a client —
and D13's three reasons are untouched.**

The distinction is the whole amendment, so it is stated flatly:

| | |
|---|---|
| **D13 ruled** | *where LearnBook is **built*** — platform repo, D1 stack, because the spine is there, D9's backend is a capped demo tier, and the feature list sits on the node library's gaps |
| **D14 rules** | *how many **clients** that build has* — the web one, and an editor one against the same API |

None of D13's reasons is an argument against a second client; all three are arguments about where
the *server and the schema* live. Phase 68's **L1 stands verbatim**. What changes is its
*"No editor-side code, no bridge"* line, which becomes **"no editor-side code in v1"**.

🔴 **Why the editor client is worth more here than anywhere else in the phase, and it is not
convenience:** LearnBook's assignment thread already requires *"coachee must reply, coach must
VALIDATE"* (LB-006), reusing **UNI-006's assignment state machine**. UNI-007 already ships a grading
runner that evaluates completion conditions against a live graph
([`lessonevalconditions.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts),
with the sidecar-safe split at `.live.ts`). An editor-side LearnBook can therefore attach
**evidence from the actual project** to a submission — the coach sees what the learner built rather
than a description of it. That is a capability the web client cannot have at any price, and it is
the strongest single argument in this amendment.

⚠️ **Three constraints the editor client inherits and must not quietly drop:**

1. **L5 / E3 hold unchanged.** Org-minor accounts cannot enter coaching spaces in *either* client
   until E3 is ruled. A second client is a second place to get this wrong.
2. **Evidence is project content.** D11's consent line — *"which nodes people ask about, never
   project content"* — binds here exactly as it binds UNI-011. Attaching a graph excerpt or a port
   value to a submission is opt-in, previewed and redactable even though the recipient is the
   learner's own coach. **A trusted recipient is not a reason to skip the preview.**
3. **Sequencing.** The editor client is a **later tranche of phase 68**, after its v1 web surface
   exists. Building two clients against a schema that has never run gets both rebuilt.

⚠️ **The honest cost, recorded so it is not discovered later:** phase 68's second act (L2) already
promised a NodeGX-*built* coachee frontend as dogfooding. That is a **different artifact** from an
editor-*native* client, and both now sit on the roadmap. They must not be conflated — one is an
exported app proving the node library, the other is editor chrome. If only one survives, say which.

---

## D14 — the web is canonical; the editor mirrors it

**Ruled 2026-08-15 (Richard): both surfaces, one API.** The public web platform is the canonical
community; **the editor is a second client of the same backend**, showing the same content.
Editor-only features are the reason to transition — not a different feature set.

```
                    ┌─────────────────────────┐
                    │   platform API (D1)     │   one schema, one auth,
                    │   threads · events ·    │   one points ledger
                    │   profiles · RFPs       │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
   ┌──────────────────────┐            ┌──────────────────────┐
   │  WEB  (canonical)    │            │  EDITOR  (mirror)    │
   │  anyone, no install  │            │  + ask about a node  │
   │  indexed by search   │            │  + share a capture   │
   │  linkable, shareable │            │  + evidence from the │
   │  RFP clients, orgs   │            │    real project      │
   └──────────────────────┘            └──────────────────────┘
```

**Why this, and not either extreme.** The recommendation put to Richard was a *split* — launcher owns
browsing, web owns the public face. He rejected it, and was right to: a split makes the editor a
**reduced** surface, which gives a user a reason to leave it. The mirror keeps one content model and
makes the editor a **superset**, so moving from web to editor is a gain with no loss. Meanwhile the
web keeps the property the editor can never have — **anyone can participate without installing
anything** — which is what RFP clients, school admins, coachees and everyone arriving from a search
result actually need.

⚠️ **The public landing page already exists and is live** (`nodegx.io`), so the web surface is not a
hypothetical this ruling creates. It is a running thing that now gets a defined relationship to the
editor.

**Consequences, in order of how much they cost:**

1. 🔴 **The trust boundary gets *more* important, not less.** A mirror renders posts other people
   wrote, and the app's renderer is `nodeIntegration: true, contextIsolation: false`
   ([`main.js:406`](../../../packages/noodl-editor/src/main/main.js#L406)) — **including the
   launcher**, which is `pages/ProjectsPage` inside that same `BrowserWindow`, not a separate
   window. This phase already found a live hole of exactly this shape (`unsafe-url`, second
   amendment below): a `javascript:` URL in a *lesson* body was arbitrary code with filesystem
   access. Stranger-authored post bodies are the same sink, unbounded and changing daily. **No post
   body may reach the editor's renderer as HTML.** The two survivable shapes are a sandboxed
   `<webview>` island (the `legal-window.js` recipe — `nodeIntegration: false`,
   `contextIsolation: true`, `sandbox: true`, `will-navigate` intercepted) or fetching **raw
   markdown** and rendering it ourselves through the scheme allow-list `lessonverify` already ships.
2. **One API, two clients — so the API is a deliverable, not an implementation detail.** Versioning,
   pagination, and an auth story that works for a desktop client are v1 concerns. A web-shaped API
   the editor has to scrape is the failure mode.
3. **The bridge direction is unchanged and still binding.** Editor-outbound only (README surface 3).
   The mirror *pulls* on its own schedule; the platform never connects in. A "live" mirror is a
   poll, and an unread count is a poll result.
4. **"The login gates nothing" acquires a second reading.** Reading the mirror must work signed out,
   because the web equivalent does. A mirror demanding an account to *read* would be stricter than
   the public site it mirrors, which inverts principle 1.
5. **UNI-009 is now the canonical surface being mirrored**, not merely "the site". Its Discourse
   choice becomes load-bearing for the editor too: the SEO'd public forum is the half the editor
   cannot supply, and Discourse's API is what the mirror consumes.
6. ⚠️ **Phase 37 (project tabs) is the enabler Richard named, and it is scoped, NOT built** — six TAB
   tasks, tiered, unstarted. Its design makes the launcher **tab 0 that never goes away**, which is
   what would allow reading the community without leaving a project. 🔴 **UNI-011 must not assume
   it.** Design the mirror to be reachable today and *better* once phase 37 lands — never so that it
   only makes sense afterwards.

---

## D15 — community visibility for org-minor accounts · ✅ RULED 2026-08-16

**Ruled: default OFF. An org admin may enable READ-ONLY. There is no setting that lets an org-minor
account write to the community, in either client.**

```
org-minor account
├─ default              ->  community surface ABSENT      (web AND editor)
└─ admin opt-in         ->  READ-ONLY
                            no posting · no replying · no reactions · no DMs · no RFP contact
                            (no setting exists that grants any of these)
```

🔴 **The ceiling is the ruling, not the default.** A default can be changed by whoever owns the
setting; a capability that was never built cannot be turned on by an admin who misunderstands the
consequence. D10 kept child PII off our systems and made the school the data controller — but the
exposure this ruling governs is *public speech by a minor readable by adults we do not vet*, and no
data-controller arrangement makes that safe. So the org admin's switch chooses between **absent** and
**read-only**, and the write path is not on the other end of any switch.

⚠️ **Three consequences that are implementation, not policy, and are easy to get wrong:**

1. **Absent means absent.** Not rendered-and-disabled, exactly as D11 ruled for the analytics row.
   A greyed-out "Post" button tells a pupil the door exists and that they are the reason it is shut.
2. 🔴 **This binds both clients, and the editor is the one that will drift.** D14 made the editor a
   *mirror*, and a mirror's natural implementation renders whatever the API returns. The visibility
   rule therefore has to live behind the **API**, not in each client's rendering — an editor build
   that decides for itself is one release away from disagreeing with the web.
3. **It composes with D9 obligation 5 and phase 68's L5 by construction now**, which was the
   recommendation's argument and is worth restating as a check rather than an intention: three
   surfaces agreeing because they read one flag is different from three surfaces agreeing because
   three people remembered.

**The question it answered:** is the community surface — web, editor, or both — shown at all to the
org-owned pseudonymous accounts D10 created for under-16s?

**Why it is not answerable by analogy.** D10 made the school the data controller and kept child PII
off our systems, but it ruled on *identity*, not on *an open forum*. A pupil posting into a public
thread is a different exposure from a pupil holding an account: it is public speech by a minor,
under a handle the school can map back to them, readable by adults we do not vet.

**Why it was not answerable by analogy.** D10 made the school the data controller and kept child PII
off our systems, but it ruled on *identity*, not on *an open forum*. A pupil posting into a public
thread is a different exposure from a pupil holding an account: it is public speech by a minor, under
a handle the school can map back to them, readable by adults we do not vet.

**What it unblocks:** UNI-011's visibility rules. The mirror was always buildable; it can now ship to
an org tenant, against a rule that lives in the API.

---

## D16 — the never-empty threshold · ✅ RULED 2026-08-16

**Ruled: the editor surfaces the community only once all three of these hold — 30 threads, three
consecutive weeks in which a call was held, and a median first reply under 24 hours. Until then the
entry point opens the browser.**

```
if (threads >= 30 && weeksWithCallHeld >= 3 && medianFirstReplyHours < 24)
     entry point  ->  the in-editor mirror
else entry point  ->  the browser, at the web community
```

🔴 **The threshold is a gate on the *mirror*, never on the *community*.** The entry point exists
either way and always goes somewhere real — this ruling chooses *where*, and the failure it prevents
is an in-product surface that advertises a dead community to every user, every day. A first
impression of a community is made once, and it is not recoverable by shipping more code.

⚠️ **Three things about the numbers, so they are not treated as more precise than they are:**

1. **They are a floor, not a target, and they are cheap to re-rule.** If the community clears 30
   threads in a fortnight the gate was never the constraint; if it takes six months the number was
   not the reason. Amend here with a date if it turns out to be wrong — do not quietly reinterpret it.
2. 🔴 **All three must be *computed*, and the third is the one that will get faked.** "Median first
   reply < 24h" over a forum with three staff-answered threads is a true statement about nothing.
   Whatever computes it must state its **n** alongside it, for the same reason a one-sided budget
   assertion is worth less than one that reports its margin (see the gate-that-could-not-report-its-
   own-margin entry above). **A threshold nobody can see the approach to is a threshold that gets
   crossed by rounding.**
3. **"Weeks with a call held" is deliberately about an event, not a post count.** It is the one
   component that cannot be manufactured by a quiet week of seeding.

✅ **The design obligation stands and is NOT discharged by this ruling** — it was never an
alternative to it. The mirror's home must be *structurally* incapable of looking empty: events,
replays, release notes and the prefab shelf exist whether or not anyone posted this week. **The
threshold protects the launch; the composition protects every quiet week after it.** Building only
the threshold ships a surface that passes the gate and then decays.

---

## D17 — curriculum hosting · ✅ RULED 2026-08-16

**Ruled: the curriculum index is part of the platform API under D14 — one content path, the same one
the web reads — with GitHub Pages as the v0 while `community.nodegx.io` and the platform do not
exist.**

> ⚠️ **Half of that condition lapsed on 2026-08-17**: the host now resolves (see D2's amendment).
> **The platform is still deployed nowhere**, so the v0 stands — but the ruling's trigger is now one
> condition, not two, and a later reader should not treat "the domain does not exist" as still true.

This is the posture D7 already took for UNI-004: *build it so the thing that does not exist yet can be
absent.* The v0 is not a different design, it is the same fetch against a different origin.

```
v0   editor ──fetch──▸ GitHub Pages (curriculum index)     no domain, no platform
v1   editor ──fetch──▸ platform API  ◂──fetch── web        one content path (D14)
ALWAYS
     editor ──read───▸ a local directory, no origin at all  ◂── UNI-010's lessons live here
```

🔴 **The property that survives every version of this, and it is the ruling's real content:** a lesson
must stay installable **from a local directory with no origin**. That is what UNI-010's locally
authored lessons are, it is what D5 made the Learning folder for, and it is the one path with no
dependency on any of the above. UNI-007 already built it — `LessonModelArgs.read` — and it must not
be regressed into a URL fetch when the platform arrives and a single code path looks tidier.

⚠️ **The v0 is a real commitment, not a placeholder, and it carries D2's cost:** GitHub Pages does not
follow a repo rename. The rename is already done and `has_pages: false` was re-verified 2026-08-16 —
so attaching Pages to `nodegx-community` is safe **now**, and this ruling is the thing that will
attach it. ✅ Checked today rather than remembered; two earlier handovers carried the rename as
outstanding after it had been done.

**Why it intersected three rulings rather than standing alone** — unchanged, and the ruling honours
all three: **D2** (the domain is unregistered, so "on the site" is not free), **D9** (a curriculum on
the hosted tier inherits that ops posture; on Pages it does not), **D14** (a curriculum fetched by
the editor from a different origin than the web reads is the second content path D14 exists to
prevent — which is why the v0 is explicitly temporary).

**What it blocked:** distribution of the authored curriculum. It blocked **neither authoring nor
UNI-010**, both of which already work against the injected reader.

---

## ⚠️ A note on how these three were ruled, because it is evidence about the register

All three were ruled **as recommended**, in one sitting, by the person the recommendations were
written for. That is the cheapest possible outcome and it is worth one paragraph of suspicion:
**a recommendation adopted wholesale is weaker evidence of a good decision than one argued down.**

What makes these three defensible anyway is that the recommendations were not free-standing opinions —
each was derived from a ruling already made and paid for (**D15** from D10 + D9's obligation 5;
**D16** from D14's mirror; **D17** from D2 + D9 + D14), and the register records the derivation, not
just the conclusion. 🔴 **The check to apply later is therefore not "was it agreed" but "does the
parent ruling still say what this was derived from".** If one of D9, D10, D14 is ever amended, these
three are downstream of it and must be re-read — that is the specific thing this note exists to make
possible.

### 🔴 A postscript the same day: all three were ruled into a place that did not exist

**2026-08-16, twentieth session.** D15 says the visibility rule lives *behind the API*. D16 says the
threshold is *computed* with its `n` visible. D17 says the curriculum index is *part of the platform
API under D14*. All three name **the API** as the thing that holds the rule.

**There was no API.** `nodegx-community` had exactly one route under `src/app/api` — the Discourse
webhook receiver — and every other surface was a Next.js page calling `src/lib` in-process. D14's
own second consequence had already said this out loud (*"the API is a deliverable, not an
implementation detail"*) and **no task owned it**: UNI-011's surface is *"editor + bridge"*, and the
eight platform tasks each built pages.

So `communityVisibility()` and `readThreshold()` shipped as careful, controlled, well-specced pure
functions **whose only callers were their own test files** — which is the seventh instance of *build
the caller*, and the first where the missing caller was named in the ruling itself.

> ⚠️ **The generalisable half, because this register is full of rulings that name a mechanism:**
> *a ruling that names where a rule must live is a claim about a place, and the place is not
> checked by ruling it.* D15 was implemented correctly, tested thoroughly, and enforced nowhere.
> The three rulings above read as *made and implemented* for a day.

✅ **Closed by UNI-011 slice 1** (`nodegx-community` `7193f92`): five `/api/v1` routes, D15 enforced
per route by a sweep whose route list is **read off disk**, and D16's reading served with its `n`.
🔴 **D17's half is still open** — nothing serves a curriculum index, on Pages or otherwise.

**Where each was strengthened past its recommendation** — so the sitting is not recorded as pure
assent: **D15** turned "default off, admin may enable read-only" into a **capability ceiling** (no
write path exists to be switched on) and moved the rule behind the **API** rather than each client;
**D16** added that all three components must be **computed with their `n` visible**, and that the
composition obligation is not discharged by the threshold; **D17** named the **local-directory path**
as the invariant that outlives both hosting choices.

**Why it is being raised now.** It is the second of CURRICULUM-DESIGN §11's *"two owed items phase 67
never carried"*. The first — the tutor overlay — was built 2026-08-16
([UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md)). This one is not buildable, because it is a
decision, and §9.3 already flagged it as *"decision owed by LEARN-002"* — which never ruled it.
It has now been unowned for long enough to be worth a register entry rather than another sentence in
a follow-ons list.

**What is measured, not assumed:**

- The engine reads a lesson list **from a URL**. `LessonModel` fetches `this.url`, resolved against
  `baseURL`, through `window.fetch`. The legacy eight are hosted by `the-low-code-foundation`.
- 🔴 **That is no longer the only path, and the change is phase 67's.** UNI-007 made the *reader*
  injectable (`LessonModelArgs.read`) precisely because a lesson in the Learning folder is a
  directory on disk with no origin to fetch from. **So a lesson already reaches a learner with no
  hosting at all** — which is what makes UNI-010 runnable with no platform (D5).

**Why it therefore intersects three existing rulings rather than standing alone:**

1. **D2** — the site is NodeGX Community at `community.nodegx.io` (⚠️ **amended 2026-08-17 from
   `.dev`** — see D2). At the time of ruling that host did not resolve; it **now does** (A → nexus-1,
   `49.12.102.195`), but **nothing serves it**, so *"hosting the curriculum on the site"* is still
   not free and this input to D17 stands as reasoned.
2. **D9** — the hosted tier serves an exported frontend *and* a record-capped backend. A curriculum
   served from the same place inherits that ops posture; served from GitHub Pages it does not.
3. **D14** — the web is canonical and the editor mirrors it via **one API**. A curriculum fetched by
   the editor from a *different* origin than the web reads is a second content path, which is the
   shape D14 exists to prevent.

**Recommendation (not a ruling):** the curriculum index is **part of the platform API** under D14,
with **GitHub Pages as the v0** while the domain and the platform do not exist — the same
"build it so payment can be absent" posture D7 took for UNI-004. 🔴 **The property to preserve
whichever way it is ruled:** a lesson must stay installable **from a local directory with no origin**,
because that is what UNI-010's locally-authored lessons are and it is the one path with no
dependency on any of this.

**What it blocks:** distribution of the authored curriculum. It blocks **neither authoring nor
UNI-010** — both already work against the injected reader.

---

## Fact-check — the three curriculum blockers (2026-08-14)

[TASKS.md](TASKS.md) and the reconciliation both point UNI-007 at
[CURRICULUM-DESIGN §11](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)'s three authoring blockers.
All three were checked against source and git rather than against task tables. **Two clear, one
sharpens, and two task tables were found stale in the process.**

### Blocker 1 — the two-vocabulary rule: **stands, and is worse than recorded**

> 🔴 **AMENDED 2026-08-14 (third session), and the amendment is larger than the finding it
> replaces.** The counts below — nine divergences, two of them ambiguous — were derived by checking
> the nine names the archive already listed. Deriving the classes from the catalog *itself* rather
> than from the recorded list gives **103 divergences, 4 ambiguous, and a third class of 6 that
> nobody had written down.** The corrected table is under "The amendment" below; the original
> paragraphs are kept because the reasoning about F1 vs F3 is what the amendment rests on.
> The check is now built and tested — `verifyLessonManifest()` in
> [`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts).

Re-verified against `packages/noodl-types/src/node-catalog.json` (175 entries) on 2026-08-14. The
nine divergences hold. But **two display names are ambiguous, not one**:

| Prose (display name) | Conditions must say (type name) |
|---|---|
| Repeater | `For Each` |
| Repeater Item | `For Each Actions` |
| Static Array | `Static Data` |
| Delay | `Timer` |
| Insert Object Into Array | `CollectionInsert` |
| Record | `DbModel2` |
| Page Router | `Router` |
| **Array** | **`Collection` *and* `Collection2`** |
| **Object** | **`Model` *and* `Model2`** |

🔴 **`Object` → `Model` / `Model2` is a correction.**
[PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) F5 and
[LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md) both record `Object → Model2` alone.
Two catalog entries carry the display name `Object`, exactly as two carry `Array`.

**Why the correction matters more than a typo would:** an ambiguous display name is not only class
**F1** (unreachable — the condition matches nothing and fails silently). If it *does* resolve, it
can resolve to the **wrong one of two**, which is class **F3** — the class the prior arc predicted
*"nobody expects to see and is worst when it appears"*, and the one this phase's UNI-010 ruling made
mandatory verifier work. **The static check must reject a condition naming any of these nine, and
must treat `Array` and `Object` as ambiguous rather than as fixable by substitution.**

#### The amendment (2026-08-14, third session)

Derived from the catalog rather than from the list, there are **three classes**:

| Class | Count | What it is | Verdict the checker returns |
|---|---|---|---|
| Plain divergence | **103** | display name is not any type name, maps to exactly one | reject, **suggest** the type name |
| Ambiguous | **4** | display name maps to two type names | reject, **no substitution** |
| **Shadowed** | **6** | the string **is** a real type name — of a **deprecated** node — while the node the learner actually places carries it as a *display* name | reject, suggest the live type |

**Ambiguous is four, not two:** `Array` (`Collection`/`Collection2`), `Object` (`Model`/`Model2`),
`Component Object` (`Component State`/`net.noodl.ComponentObject`), `Parent Component Object`
(`Parent Component State`/`net.noodl.ParentComponentObject`).

🔴 **The shadowed class is new, and it is the one that defeats the obvious check.** `Variable`,
`Button`, `Text Input`, `Checkbox`, `Radio Button` and `Cloud Function` are all **real type names**,
so `CatalogIndex.hasType()` returns true for every one of them and a "does this type exist?" gate
passes. Each names the *deprecated* node; the one the learner drags out of the picker is
`Variable2`, `net.noodl.controls.button`, `net.noodl.controls.textinput`,
`net.noodl.controls.checkbox`, `net.noodl.controls.radiobutton`, `CloudFunction2`.

**This is not a corner case.** `Variable` is in the curriculum spine — CURRICULUM-DESIGN **D3**
rules *"Counter first, Variable revealed in L6"* — and `Button` and `Text Input` are in any beginner
lesson. [LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md) explicitly listed `Variable`,
`Button` and `Text Input` among the nodes that *"use the same string for both"*. **Corrected in place
2026-08-14.** A lesson author following that sentence would have written a step that can never
complete, for the single most-taught state node in the curriculum.

#### The second amendment (2026-08-15, sixth session) — the gate had a hole, and the format had a sink

Both found by **building the caller** rather than by re-reading the check. Full write-up in
[UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md); the short version, because both change what
"the two-vocabulary rule is closed" means:

**1. `unmatchable-node-path`.** `typeNamesInPath` correctly drops the first path segment, because
`findNodeWithPath` reads it as a **component name**. Nobody followed that through: a path written
`%Group`, component name omitted, contains *nothing the vocabulary check looks at*, so it passed in
silence — while at runtime the evaluator hunts for a component literally called `"%Group"` and never
finds one. A bare `App:Group` segment does the same, reaching `nodes[parseFloat('Group')]`.
Both end in **exactly the outcome Blocker 1 exists to prevent**. 🔴 A gate that catches one spelling
of never-matches and not the other is not a gate.

⚠️ **What the static check still cannot catch, and this is a boundary not a bug:** *depth*. A
condition can be well-formed, correctly spelt and still false because the node sits one level
deeper. The verifier has no project — it runs before the project it grades exists.

**2. `unsafe-url`, and it was a live security hole.** Compiled step HTML reaches `innerHTML` and
`dangerouslySetInnerHTML` inside the editor's renderer, which has **node integration**. A lesson body
naming `javascript:` was arbitrary code with filesystem access. The sink is old; the *exposure* is
phase 67's, because the Learning folder made third-party bundles installable and UNI-010 makes a
model a producer. Closed with a scheme allow-list — **escaping would not have caught it**, since the
payload is a scheme rather than markup.

🔴 **The method, stated once because it is now the third time it has paid:** the first amendment came
from re-deriving instead of re-verifying. This one came from **building the caller**. A check read on
its own terms looks complete; a check with something depending on it shows you what it does not do.

#### The third amendment (2026-08-15, seventh session) — the same method, and this time it was not a check

Slice 4 set out to add a "check my work" button *in the lesson layer*. **There was no lesson layer.**
`EditorPage` attaches one only when `ProjectModel.instance.isLesson()` — `project.lesson !==
undefined` — and the only code that has ever set that field is the hosted-zip path, which points a
`LessonModel` at an HTTP `baseURL`. The Learning folder's open path never did, so every lesson
slice 3 installed opened as an ordinary project: no steps, no instructions, no completion evaluation.
Fixed in `c38fcb7b`; full write-up in [UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md).

🔴 **Why it belongs here rather than only in the task file:** the first three instances were *checks*
that read complete on their own terms. This one is a shipped **feature whose visible half was never
reachable**, and — unlike the other three — **it had a live drive over it**. The drive verified that
the project opened and that the recents list did not grow. Both true. Both what it set out to check.
Neither of them is *"can this lesson be taught"*. The slice-3 session's own formulation, offered
unprompted when the defect was put to them, is the sentence to carry:

> **A drive proves what it measured, and what it measured is a choice you made before you knew what
> was broken.**

⚠️ **The defect had already produced a symptom, and the symptom was explained away.** Slice 3
recorded that the card said "State on a page" while the editor titlebar said the project's own name,
and reasoned carefully about whether the opener should rename the project — a good answer to the
wrong question, because the real cause was that no lesson layer existed to show a lesson title.
**A plausible explanation is how a defect stops being investigated.** That is a different and more
dangerous failure than not noticing, and it is worth pairing with the "verify the CONSEQUENCE, not
just the mechanism" trap this repo already carries: the consequence you verify is only as good as the
question you thought you were answering.

**The operational form, for the next drive:** *if the sentence you would write in the drive record
could also be true of a broken feature, it is the wrong sentence.* "The lesson opened into the
editor" passes that test and hid this bug for a day; "the learner can see step 1's instructions"
does not.

✅ **Applied immediately, and it paid the same afternoon.** Slice 4's drive was run against a
consequence list written *before* the drive, ten lines, each phrased to fail that test. **Nine
passed and one failed** — *"close and reopen the lesson: it resumes on the step you left"*, which was
true of the code and false through the UI, because the step index rode on `ProjectModel.toJSON` and
that only persists on **save**, which a learner reading instructions never triggers. Fixed to read
the register (`393ec7bf`) and re-driven.

🔴 **The line that failed was the cheapest-looking one on the list, and the one most tempting to
skip.** That is the generalisable half: *the criterion you would drop is the one carrying the
assumption.* And a spec could not have caught it, because a spec has a save in it and a learner does
not — which is the standing case for driving at all.

⚠️ **A side finding, recorded so it is not re-discovered:** `suggestedNodes` (LESSON-FORMAT §3's step
field) is **dead** — `LessonModel.getCurrentSuggestedNodes()` has no callers anywhere in the editor.
Which of the two vocabularies it wants is therefore *unestablished*, and the checker deliberately
does **not** read it. Whoever wires the node picker up to it decides that, and adds it to the check
in the same change.

✅ Also re-confirmed: **all 175 catalog entries have no `summary` and no `description` field** — the
concept-corpus argument in the reconciliation's F3 holds. The available keys are `availableIn`,
`category`, `displayName`, `docs`, `dynamicPorts`, `inNodePicker`, `inputs`, `isDeprecated`,
`isVisual`, `outputs`, `parameterEncoding`, `providedBy`.

#### The fourth amendment (2026-08-15, eighth session) — a gate can fail in the *other* direction

Found the same way, building UNI-010's F1–F4 harness ([UNI-010](UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md),
`90776d8b`) and then running it over the real slice-4 drive bundles. The first three amendments were
all one shape: **a check that did not catch enough.** This one is the mirror, and it is worth its own
entry because the mirror is the more dangerous failure and nothing here had named it.

The F3 decoy test asks *"would this condition survive a second node of the type it addresses?"* For
almost any `%Type` segment carrying a specific assertion the answer is no — so as an error it
**rejects essentially every sound lesson.** A path like `App:%Page:#Greeting` names the page by type
because that is how a page component is shaped, and a hypothetical second Page is not a defect in the
lesson.

> 🔴 **A gate that rejects the correct answer is worse than no gate.** A missed defect reaches one
> learner; a false rejection tells every author their correct work is wrong, and the rational response
> to it is to stop believing the gate — which disarms the checks that *were* right.

The repair was not to weaken the test but to read the binding it was enforcing. §3.2 permits type-only
addressing *"only where the graph guarantees exactly one node of that type"* — so **error** when a
second candidate already exists in the starter or the solution, **warning** when exactly one does.

⚠️ **And the thing that makes the error case reachable is worth stating separately**, because it is
reusable: **the solution is the graph after every step**, so a lesson that itself instructs the
learner to add a second Text has two Texts in its own answer. The ambiguity a generated lesson creates
is therefore visible *in the artifact the lesson ships*, and is caught by comparison rather than by
guessing at what a learner might do.

✅ **Two related things this settled, both previously open:**

- **Depth is reachable after all.** The second amendment recorded depth as the boundary the static
  check cannot cross — *"the verifier has no project — it runs before the project it grades exists."*
  That is still true of `lessonverify`, and a **solution replay** crosses it: the drive bundle's own
  step 2 (`%Text` where the Text sits inside the Page) is a well-formed, correctly-spelt,
  real-type path that is one level too shallow, and the harness fails it. The boundary was a property
  of *having no project*, not of static checking.
- **The file-backed context agrees with the live editor.** Run over `bundle-good`, it reports steps 2
  and 4 failing and step 3 passing — the same per-step verdicts the slice-4 drive measured through
  the UI. 🔴 Two plausible shortcuts would have broken that and both were live: a component is
  addressed by its **legacy name**, not its directory (`components/__page__/Home` is named
  `/#__page__/Home`), and a stored node serialises only its **dynamic** ports, so `hasPort: "text"` —
  true of every Text in the editor — reads false from the file alone.

#### The fifth amendment (2026-08-15, ninth session) — the trick that made the sidecar possible did not

Same method, fifth time, and this one is not about a check or a feature. It is about a **claim written
in a module header that no one had any way to falsify until something depended on it.**

UNI-007 moved `ProjectModel` and `NodeGraphContextTmp` out of module scope in
[`lessonevalconditions.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts)
into a `require` **inside** `liveLessonEvalContext()`, and recorded why in the file: *"this is what
makes 'the same verifier, not a fork' achievable: UNI-010 runs this runner inside an MCP sidecar with
no renderer around it."* Every reader since — including three slices of this arc and this register —
took it as settled.

It was true of jest, which never evaluates that branch, and false of the sidecar, which is **bundled**.

> 🔴 **A lazy `require` defers execution. It does not defer resolution.** esbuild resolves a
> `require()` with a literal path wherever it sits, so the first import from `noodl-mcp` pulled in
> `projectmodel` → the node graph → React → `.scss` and `.svg`, and the build failed outright.

**"Loadable in plain Node" and "safe to bundle" are two different properties**, and the trick that
buys the first buys none of the second. Fixed with the split the repo already had a convention for —
[`lessonevalconditions.live.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.live.ts),
beside `lessonwholesolution.live.ts` — so the pure module now reaches no editor singleton by any route
a bundler can follow, which is what the note claimed and did not have.

⚠️ **The generalisation, because this file is full of purity claims:** *"it only requires Electron
lazily" is not a purity argument.* `editor-deps.ts` carries a whole barrel of them and every one is
load-bearing for the standalone artifact. The check is to **build it**, not to read it.

#### The sixth amendment (2026-08-15, tenth session) — a hole recorded in two halves is not recorded

Found by driving UNI-010's criterion 2. The first five instances were all *"build the caller and it
shows you what the thing does not do"*. This one is different and worse, because **nothing was
missing: both halves of the finding were already written down, in this phase, by this arc.**

Slice 2 recorded F4 as a hole at the *installer*, closed at the *producer*: the editor cannot render
a solution directory, so `create_lesson` — which has the render harness — answers F4 instead. Running
`create_lesson` for real returns:

> *"The render harness is not present in this installation — `render_report` needs the repo checkout
> (`scripts/devtools/measure-from-disk.js`)."*

And [UNI-007](UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md) had already recorded exactly why, one
slice earlier, about this exact file: *"`scripts/` is not in `package.json`'s `build.files` … so that
route works in this checkout and is dead for every real learner."*

> 🔴 **Joined up: for a user running the packaged sidecar, F4 is checked by NOBODY** — not the
> installer, which cannot, and not the producer, whose harness is not shipped. F4 is the class the
> prior arc predicted would **dominate**.

Each sentence was true and each was local to its own slice, so from either end the hole reads as
covered by the other. **A gap split across two documents is invisible in both.** The related habit
this phase already carries — *"we did not look" and "we looked and it was fine" must never be written
the same way"* — needs a companion: **a mitigation that names another component is not a mitigation
until you have read what that component says about itself.**

⚠️ **Not fixed — it is a scope decision, not a bug**, and is flagged to Richard: either ship the
harness with the sidecar, or have `create_lesson` state that a packaged install cannot answer F4 and
that `allow_unrendered` is then the ordinary case rather than a named exception.

✅ **One thing the same drive made executable.** The slice-3 author, reviewing slice 2, pointed out
that *a claim may only tighten* holds **only while `local-ai` is strictly the most demanding row** in
`REQUIRED_CLASSES` — an AI fast-path would reverse the incentive and arrive in review looking like an
optimisation. That precondition is now two specs rather than a sentence, and the guard was proved to
bite (inverting the table fails five tests) rather than assumed to.

#### A gate that could not report its own margin (2026-08-15, ninth session)

Not a lesson-format finding, but the same family and it cost the same session an hour, so it is
recorded where the traps are. AWP-006's tool-surface budget is asserted as
`expect(tokens <= SURFACE_TOKEN_BUDGET)`. LEG-001 raised that bar to 8,200 and wrote down, explicitly,
that it was banking 58 tokens of slack for the next arrival.

Measured on 2026-08-15 with UNI-010 entirely absent: **8,198**. Fifty-six of the fifty-eight had been
spent by work that never knew it was spending them.

> 🔴 **A one-sided budget assertion reports the crossing and never the approach.** It says nothing at
> 8,197 and nothing at 8,199, so the headroom a renegotiation deliberately buys is consumed silently
> and the first person told is the one who runs out. *If a margin matters, something has to state it
> on a passing run.*

**The outcome, so this entry does not itself go stale:** the bar was **raised to 8,280** against a
measured **8,223** — restoring LEG-001's slack rather than stacking UNI-010's cost on an exhausted
bar. **57 tokens remain, and the test note says there should not be a third renegotiation**; the
sanctioned next move is a `$ref`ed node schema, since the node schema is inlined three times.
⚠️ **Cross-phase (2026-08-15):** phase 69's **CN-006** and **CN-009** are both designing new MCP tools
against those same 57 tokens, and were scoped against the old 8,200 figure. Their numbers have been
corrected; anything this phase adds (a `derive_starter`) competes with them.

> ### 🔴 The last sentence was wrong, and the correction is more useful than the warning (2026-08-16)
>
> `derive_starter` shipped and **cost zero**. Measured, same fixture, same normalisation: **8,223
> tokens with it and 8,223 without**, 57 headroom either side. A deferred group's tools never reach
> `tools/list`, and the only resident trace of one is `find_tools`' `(N tools)` — where *"3 tools"*
> and *"4 tools"* are the same length.
>
> **So "the surface budget" is not one budget.** Three different things were being called by one name:
>
> | Adding | Costs | Because |
> |---|---|---|
> | a tool to an **existing deferred group** | **0** | it is never advertised, and the group's own line does not grow |
> | a **new deferred group** | ~**25** | one catalogue entry and one `purpose`, both resident inside `find_tools` |
> | a **resident** tool | its whole schema — **276** for `derive_starter` | resident means re-sent every turn |
>
> ⚠️ **The warning to CN-006/CN-009 is therefore narrower and sharper**: if either adds a deferred
> tool to a group that already exists it is free, and only a new group or a resident slot spends the
> 57. That is a design lever, not just an accounting note.
>
> 🔴 **And the way to get it wrong is invisible.** Two mis-registrations make a tool silently resident:
> registering on `server` rather than the `rec` proxy (caught by `toolDisclosure.test.ts`'s third
> property) and registering **after** `server.ts`'s single `disclosure.applyPolicy()` call — which
> **nothing** catches unless the tool is big enough to breach the bar on its own. Nothing asserts that
> a deferred group's tools are actually absent from `tools/list`; the disclosure spec hand-lists
> `provision_backend` and `create_project`, and has never named the `lesson` group. **A one-line
> manifest-derived assertion would close it**, and is the cheapest hardening available here.
>
> ⚠️ **Method note, because it nearly went the other way:** the first measurement said **276 tokens**
> and I would have reported it. It was wrong because the measuring harness registered the tool on the
> raw server — *the exact mis-registration the suite's third property exists to catch*, walked into
> while measuring it. The number only came right after registering through `recordTools` **and**
> re-running `applyPolicy`. **A measurement instrument has the same failure modes as the code it
> measures.**
>
> ### ✅ Closed 2026-08-16 — and the warning above overstated the hole, in the useful direction
>
> `toolDisclosure.test.ts` now carries **"no deferred group reaches `tools/list`, derived from the
> manifest"**: every non-resident group's tools asserted absent, in both write modes, plus the mirror
> (every resident tool that *exists* in that mode is advertised) so it cannot pass by the surface
> collapsing. Derived from `TOOL_GROUPS`, so a group added tomorrow is covered the day it is added
> rather than the day somebody remembers the file.
>
> 🔴 **The control says the guard bites — and it also says the hazard was never as silent as claimed.**
> Moving `registerLessonTools` after `applyPolicy`: the new assertion fails naming all four
> (`lesson/check_lesson`, `lesson/create_lesson`, `lesson/derive_starter`, `lesson/get_lesson_brief`),
> **the hand-listed test still passes** — which is what makes the gap one of *class* rather than of
> coverage — and **the budget test fails too, at 9,256 tokens.** So does a single escaped
> `get_import_report`, at **8,487**.
>
> ⚠️ **The arithmetic, measured rather than argued:** the bar has **57 tokens** of headroom and the
> **smallest of the 75 deferred tools is `seed_project_docs` at 86** — nothing is under 57 at all.
> **So today every escapee breaches the budget**, and *"unless it is big enough to breach the bar on
> its own"* is true in form and empty in fact.
>
> **That leaves the new assertion worth having for two reasons, and they are not the one originally
> given:**
>
> 1. **The budget catches it anonymously.** `{tokens: 8487, tools: 21}` names no tool, no group and no
>    cause; the new one fails with `"project/get_import_report"` and points at registration order.
> 2. 🔴 **The arithmetic is scheduled to stop holding.** This entry's own sanctioned next move is a
>    `$ref`ed node schema, and that schema is inlined three times — the fix frees far more than 86
>    tokens, at which point the incidental catch disappears and nothing but this test is watching.
>
> ⚠️ **A third control was discarded rather than counted**, because it measured nothing: escaping the
> `theme` group fails the hand-listed test as well, since `set_project_tokens` is one of the five
> names it already lists. A probe has to be *outside* the thing it is testing the reach of.
>
> ✅ **Gates:** `noodl-mcp` **45 suites / 530 specs**, all pass — baseline 45/529, so **+1 spec and no
> new suite**. `eslint` clean on the changed file. `tsc --noEmit` in `packages/noodl-mcp` reports
> **8** pre-existing errors, **none** in `toolDisclosure.test.ts`. ⚠️ The last handover quoted **9**;
> measured today it is 8. The delta is not this change — the only file it touched has zero.

### Blocker 2 — phase 60's signal wording: **landed upstream, one downstream edit still owed**

**Phase 60 is 7 of 7 built, merged and closed 2026-08-11** — not the three tasks the memory index
records. The wording D7 assigned to it exists in source:

> **`SIGNAL_SENTENCE`** — [`portCopy.ts:85`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/portCopy.ts)
> *"Signal — a moment, not a value. It runs something on the node it points at. Value connections
> carry their data on their own, so you usually don't need a signal to set a value — reach for one
> when you want to control **when** something happens."*

That file's own header records why the obvious sentence is false: *"A signal never carries a value"
is **false** — `nodelibraryexport.ts:207` allows `boolean → signal`*.

🔴 **But `CURRICULUM-DESIGN.md`'s glossary was never told.** Its Signal line still carried the
paraphrase phase 60 disproved, under a ⚠️ marker reading *"Do not author the glossary line until
phase 60 publishes its wording"* — three days after phase 60 published it. **Corrected in place
2026-08-14**; the glossary now cites the shipped sentence rather than paraphrasing it, as D7
required. **Blocker 2 is clear.**

### Blocker 3 — phase 61 before L11: **clear**

L11 teaches *"the same ideas in code"* — mapping graph concepts onto a ~15-line JS program, with the
Function/Expression node as the bridge. Everything it would teach against has landed.

🔴 **Phase 61's own task table is stale and says otherwise.** It marks FUN-004, FUN-006, FUN-008 and
FUN-009 as `📋 open`; all four are committed and **verified on `cline-dev`** (`6dc6c019`, `bfc52b4c`,
`5f96f1f2`, `7afbf9fe`, `ad47b239`, `ace5232f`, `601dd5d2`). Real state: **8 of 9 built — FUN-005
(the ports rail) is the only one open**, which is what the memory index said and what the task table
denied. The table also says FUN-001 §2 is *"not yet signed by Richard"*; **it was signed 2026-08-12**,
and the ruling — `Inputs.` / `Outputs.` are the notation, `Noodl.Inputs` is never written by us — is
enforced by `notation.test.ts`, not merely stated. **Corrected in place 2026-08-14.**

⚠️ **The one caveat for L11:** FUN-005's ports rail does not exist. L11 must not assume it — no step
may say "click the port in the rail beside the code".

### Phase 59 — D9's visual track exists

Mixed, but sufficient for the curriculum's purposes: **LGC-001** (the picker explains Expression vs
Function vs Visual Function) is built and driven, **LGC-009** (the hat) is built and merged, and
**LGC-010** is built and driven — the Logic Builder is a floating window, reachable, and does not
narrow the canvas. LEARN-002's **D9** (*"Logic Builder in the curriculum — yes, as an option"*) is
supportable today. ⚠️ **LGC-007's My Blocks has an engine and no UI** — no save menu item, no dialog,
no backpack — so no lesson may ask a learner to save or reuse a block group.

### Two owed items phase 67 never carried

CURRICULUM-DESIGN §11 closes with two more items, neither of which appears anywhere in phase 67:

- **Curriculum hosting** (§9.3) — where lessons are served from. This is now partly a D2/D9 question.
- 🔴 **The tutor lesson-context overlay** (§9.1) — *"required before L2 testing"*. UNI-007's intake →
  path → beamed-lesson arc runs straight into it and does not mention it.

---

## The pattern, third instance in one day

Every one of the three blockers was recorded against a **task table or a memory note**, and in each
case the table was the stale artifact:

- **F1** (first session): a memory note said D1–D6 were unruled; the document it pointed at had
  answered them five days earlier.
- **Blocker 2**: the curriculum glossary warned "do not author until phase 60 publishes" three days
  after phase 60 published.
- **Blocker 3**: phase 61's table marked four merged tasks open, and one signed decision unsigned.

**A register outlives its fix.** Grep git and read source before believing a status column —
including the ones in this file.
