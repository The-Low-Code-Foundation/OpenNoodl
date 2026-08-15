# Phase 67 — the ruling register

**Purpose:** one place that holds every decision this phase owed, so no task re-derives one and no
future phase re-litigates one. Supersedes the "rulings queue" in [README.md](README.md), which now
points here.

**Status: the queue is empty.** D1 and D10 were ruled 2026-08-14 (first session, written up in
[PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md)); **D2–D9 and D11 were ruled 2026-08-14
(second session)** and are recorded below. R6's clarification and the UNI-010 verifier question are
in the reconciliation document. **D13 was ruled 2026-08-14 (fourth session)** — the coaching
delivery layer (LearnBook) is [phase 68](../phase-68-learnbook/README.md), on the platform stack.

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
| **D13** | Coaching delivery (LearnBook) | **Phase 68, platform repo, D1 stack — not NodeGX**; reuses UNI-005's roster and UNI-006's state machine; NodeGX rebuild is a later tranche | 08-14 |

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
