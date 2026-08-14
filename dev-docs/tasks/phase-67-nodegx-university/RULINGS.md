# Phase 67 — the ruling register

**Purpose:** one place that holds every decision this phase owed, so no task re-derives one and no
future phase re-litigates one. Supersedes the "rulings queue" in [README.md](README.md), which now
points here.

**Status: the queue is empty.** D1 and D10 were ruled 2026-08-14 (first session, written up in
[PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md)); **D2–D9 and D11 were ruled 2026-08-14
(second session)** and are recorded below. R6's clarification and the UNI-010 verifier question are
in the reconciliation document.

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

---

## D2 — NodeGX Community, and the rename that must happen now

**Ruled: the site is "NodeGX Community". "NodeGX University" is its learning wing** — one section
beside the forum, RFP board, prefab shelf and replay library.

| | |
|---|---|
| Site name | **NodeGX Community** |
| Learning wing | **NodeGX University** (a section, not a product) |
| Subdomain | `community.nodegx.dev` |
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

## Fact-check — the three curriculum blockers (2026-08-14)

[TASKS.md](TASKS.md) and the reconciliation both point UNI-007 at
[CURRICULUM-DESIGN §11](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)'s three authoring blockers.
All three were checked against source and git rather than against task tables. **Two clear, one
sharpens, and two task tables were found stale in the process.**

### Blocker 1 — the two-vocabulary rule: **stands, and is worse than recorded**

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

✅ Also re-confirmed: **all 175 catalog entries have no `summary` and no `description` field** — the
concept-corpus argument in the reconciliation's F3 holds. The available keys are `availableIn`,
`category`, `displayName`, `docs`, `dynamicPorts`, `inNodePicker`, `inputs`, `isDeprecated`,
`isVisual`, `outputs`, `parameterEncoding`, `providedBy`.

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
