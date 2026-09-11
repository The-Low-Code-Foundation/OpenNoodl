# Phase 67 — prior-art reconciliation

**Created:** 2026-08-14, first working session of the phase.
**Why:** [TASKS.md](TASKS.md) "Two things to check before starting any task here" §1 requires the
old collaboration scoping to be located before UNI-005/006 invent org semantics that contradict it.
The search found that scoping — and four other collisions between this phase and work already
specced in phases 17, 20 and 51.

**Read this before any UNI task.** Phase 67 was written from two brainstorms, not from the
archive, and five of its stated premises are wrong or incomplete against documents already in the
repo. Three rulings in the queue are already answered elsewhere; two more were answered in this
session.

---

## Summary of findings

| # | Phase 67 says | The archive says | Effect |
|---|---|---|---|
| F1 | D12: LEARN-002's D1–D6 "still unruled since 2026-07-25", "the oldest debt in the building", on the critical path | **All answered 2026-08-09**, plus three new ones (D7–D9) | **D12 is struck.** Replaced by three real authoring blockers |
| F2 | R6: real-time collab "was scoped in old phases — build on that" | Two different scopings exist. Phase 51 is **async git-merge** and rules real-time **out of scope**; ECO-001 is the real-time one and is **gated, 4–6 months, spec-only** | **Ruled:** build on phase 51 |
| F3 | UNI-010 is a new experiment with pre-registered kill/keep criteria | **LEARN-007…010** is the same experiment, specced 2026-08-02, open questions answered 2026-08-09, with a six-class failure taxonomy and a scoring harness | UNI-010 **inherits** the taxonomy; kill/keep criteria are reconciled |
| F4 | UNI-005/006: org accounts, platform-held graded results | **LEARN-005** states "no accounts by default", local-first student data, "privacy is close to absolute". **ECO-004** says reversing that needs "a considered choice with proper legal advice" | **D10 ruled**, and LEARN-005 must be amended to say so |
| F5 | UNI-007: "LEARN-001's `lesson.json` format work is the starting point — revive, don't reinvent" | Correct, and **more exists than the task knows**: a closed 11-verb condition vocabulary, a pure evaluator with 33 tests, a compiler, and a documented silent-failure trap | UNI-007's scope shrinks; one trap must be carried into the format contract |

---

## F1 — D12 does not exist

**Phase 67 says** ([README.md](README.md) D12, [TASKS.md](TASKS.md) "First sitting"):

> D12 — LEARN-002's D1–D6 (age band, theme, state intro, code-mapping placement, badges, capstone
> menu) — **still unruled since 2026-07-25** and now on this phase's critical path.

**The source says** ([CURRICULUM-DESIGN.md](../phase-17-noodl-learn/CURRICULUM-DESIGN.md) §10,
"Decision register — answered 2026-08-09"):

| | Question | Answer |
|---|---|---|
| D1 | Age band + sitting length | As drafted — ~30 min/lesson, **both** adults and teenagers; round-1 testing adults only |
| D2 | Theme: pet vs alternates | **The pet.** *"Cute, and adults can appreciate it too"* |
| D3 | Counter-first vs Variable-first | **Counter first**, Variable revealed in L6 |
| D4 | Code-mapping lesson: spine or appendix | **Spine** — the only evidence for O8 |
| D5 | Badges: use `completionBadge` or drop it | **Use them** |
| D6 | Capstone: idea menu or free choice | **Menu, with free choice allowed** |
| D7 | Beginner wording for "signal" | **Phase 60 owns it**; the current glossary line is probably false |
| D8 | L8: in-memory array or built-in backend | **The backend** — *"We have our own inbuilt awesome backend"* |
| D9 | Logic Builder (Blockly) in the curriculum | **Yes, as an option**; blocked on phase 59 surfacing it |

[PROGRESS.md](../phase-17-noodl-learn/PROGRESS.md) records the same: *"LEARN-002's design is
reviewed and accepted (2026-08-09) — authoring is unblocked."*

**How the error happened, because it will happen again.** The phase-67 brainstorm read the
*memory note* `learn-002-curriculum-v1`, written 2026-07-25, which correctly said "do not author
lessons until he rules on D1–D6". Richard ruled five days before phase 67 was written; the memory
was never updated. **A register outlives its fix.** The phase-67 author cited the note instead of
the document it pointed at.

### What actually blocks the curriculum

D12 is struck, but [CURRICULUM-DESIGN.md §11](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)
lists three items that must precede the first authored lesson — none is a design question:

1. **The two-vocabulary rule** — see F5 below. Nine node names differ between prose and
   conditions; a `completeWhen` written in display names matches nothing and tells the learner
   they failed a step they completed.
2. **Phase 60's "signal" wording must land first** (D7), or L2 — the lesson that *introduces*
   events — is authored against a sentence phase 60 already found to be false.
3. **Phase 61 changes what L11 teaches**, and phase 59 decides whether D9's visual track exists
   at all. **L11 must not be authored until phase 61 lands.**

⚠️ **UNI-007's real dependency is these three, not D12.** Two of them point at phases 59/60/61,
whose status must be confirmed before UNI-007's pathing work claims a spine to project from.

---

## F2 — "the old collab scoping" is two documents, not one

R6 tells the reader to build on prior scoping without naming it. There are two, and they say
opposite things.

| | [Phase 51 — Collaboration](../phase-51-collaboration/README.md) | [ECO-001 — Real-Time Collaborative Editing](../phase-20-ecosystem/ECO-001-COLLABORATIVE-EDITING.md) |
|---|---|---|
| What | Async, git-merge: move-aware structural diff, merge the tractable cases, per-node conflict resolution, advisory claiming | Real-time multiplayer: CRDT/OT, presence, live cursors |
| Status | **Specced, not started**, 6 tasks (COL-001…006), ~7 weeks | 🔒 **Gated — do not start before Gate G3**; "a specification, not an implementation plan" |
| Scale | ~7 weeks | **4–6 months**, "the largest single item in Horizon 3" |
| Real-time? | **Explicitly out of scope** | It *is* the real-time one |

Phase 51 names real-time collaborative editing in its "Deliberately out of scope" list: *"A
different product, an order of magnitude more work, and it does not solve the git case anyone
actually has."*

**Ruling (2026-08-14): UNI-005/006 build on phase 51, and COL-004 goes first.**

Phase 51's own recommendation is unusually emphatic and it fits the org story exactly:

> **COL-004** — Component claiming — 3 d — ⚠️ **Ship this first, alone, before COL-001.** A soft
> advisory lock … It does not prevent anything and needs no merge work. It is three days and it
> prevents most of the collisions that COL-001…003 exist to resolve.

For an org shelf where several members touch shared prefabs and templates, advisory claiming is
the whole of what v1 needs. **ECO-001 stays parked**; nothing in UNI-005/006 may assume live
co-editing. The "teacher watching twenty-five graphs update live" capability ECO-001 pitches for
education is *not* available to UNI-006 and must not appear in its scope.

**Also relevant and currently uncited by phase 67:** COL-005 ("the agent declares its blast
radius") — an MCP plan already names every component it will touch, so the apply can be refused
cleanly if a human has one open. Any org-shared-shelf design should inherit it rather than
reinvent a locking story.

---

## F3 — UNI-010 is LEARN-007…010, re-derived

[EXPERIMENT-GENERATED-LESSONS.md](../phase-17-noodl-learn/EXPERIMENT-GENERATED-LESSONS.md) was
specced 2026-08-02 and had its open questions answered 2026-08-09. It is the same experiment as
UNI-010: can a generated lesson be trusted, answered by a number rather than an impression.
Phase 67 never cites it.

Four tasks: **LEARN-007** pattern kit · **LEARN-008** the generator · **LEARN-009** the scoring
harness · **LEARN-010** the run and verdict. Time-boxed to four weeks, hard.

### The failure taxonomy UNI-010 must adopt

UNI-010's verifier, as written, covers **F2 only** — "every step's completion condition is
satisfiable by that step's own solution state". The prior arc names six classes:

| | Class | What it is | Detection | Cost |
|---|---|---|---|---|
| **F1** | Unreachable | A condition names a node type or port that does not exist | **Static** — node catalog | Should be zero |
| **F2** | Dead on solution | Conditions never fire against the pattern's own solution graph | **Deterministic** | Fatal |
| **F3** | Ambiguous address | A condition resolves to the **wrong node** when several candidates exist | **Deterministic** — decoy graph | **Fatal, and invisible** |
| **F4** | Empty preview | Sample-data keys do not match the bindings, so the preview renders nothing | **Deterministic** — render, assert non-empty | Fatal |
| **F5** | Variant-blind | Conditions fail a legitimate *alternative* correct solution | **Humans** | The real risk |
| **F6** | Text–graph divergence | The prose asks for something the conditions do not check, or vice versa | **Human read** | Erodes trust slowly |

The arc's pre-registered prediction: *"F1 and F2 come in low … **F4 (empty preview) is the top
defect**. F3 is the one nobody expects to see and is worst when it appears."* UNI-010 currently
gates on the class predicted to be *least* common and omits both predicted to be worst.

### The ruling, and the one it overrides

The prior arc's §3.1 is written as binding on all four of its tasks:

> **The model fills slots. It never authors predicates.** … A task in this arc that has the model
> emitting `completeWhen` directly has misread this section.

UNI-010's premise is the opposite: the user's own Claude authors the whole bundle, conditions
included. Put to Richard 2026-08-14 as a direct conflict.

**Ruling: free authoring stands — the model may write conditions — and in exchange the verifier
must absorb the full F1–F6 taxonomy, not F2 alone.**

Consequences, recorded so the bet is honest rather than implicit:

- §3.1's guarantee was *structural* — a condition that is never generated cannot be wrong. The
  chosen design replaces a guarantee with a **gate**, so the gate carries the whole risk and
  every class it misses reaches a learner.
- **F3 and F4 are now mandatory verifier work, not optional hardening.** F3 needs decoy-graph
  evaluation (build a graph with a second plausible candidate node; assert the condition still
  resolves to the intended one). F4 needs a real render assertion — 🔴 the "clean can mean EMPTY"
  lesson applies: assert drawn output, not absence of errors.
- **F1 gets sharper here than in the original arc** because of the two-vocabulary trap (F5 below):
  a freely-authoring model will reach for display names. The static check against
  `node-catalog.json` must reject a condition naming `Repeater`, `Static Array`, `Delay`, `Array`,
  `Object`, `Record` or `Page Router` — all of which are display names whose type names differ.
- **F5 and F6 remain human-only.** No verifier grades pedagogy, and the ruling does not change
  that. UNI-010's existing provenance labelling is the mitigation and must stay.
- §3.2 (address by `#label`, not `%Type`) and §3.3 (binding keys come from the pattern, values
  from the theme) were *findings*, not preferences — §3.2 is a verified behaviour of
  `findNodeWithPath`, which returns the **first** match at each path segment. They survive the
  ruling as authoring constraints the MCP brief must teach, even though nothing now enforces them
  structurally.

### Kill/keep criteria — reconciled

UNI-010's criteria ("kill if the verifier passes lessons that routinely dead-end; keep if ≥3 of 5
install and are worth completing") are compatible with the arc's, but the arc's are quantified and
regenerable. **Use the arc's harness output as the evidence and UNI-010's ≥3-of-5 as the decision
rule.** LEARN-009 is explicitly designed to outlive its experiment: *"it becomes the gate any
future generated lesson passes before a learner sees it"* — which is precisely UNI-007's
"same verifier, not a fork" requirement, already specced.

### Two more things phase 67 should know

- **LEARN-011 — the free lesson endpoint** exists as a stub and anticipates the platform: Richard
  ruled 2026-08-09 that generated lessons reach learners through a **free hosted endpoint**, not
  BYO API key, because *"a BYO-key product cannot serve a school"*. That is a UNI-001/UNI-007
  concern and is currently unlinked from phase 67. It carries a recorded warning: **a GitHub
  secret is not a runtime secret** — anything shipped in the Electron app is readable by anyone who
  installs it, so the key must live behind a hosted endpoint. That is a service to run and pay for.
- **The spine is authored either way.** The arc's §8.4: a no-go on generation does not stop the
  12-lesson spine, because all 175 entries in `node-catalog-enriched.json` have no `summary` and
  no `description` — there is no teaching prose for any node anywhere in the product, and the docs
  site, node picker and AI authoring path all read from that file. One concept corpus serves all.

---

## F4 — org accounts reverse a stated design law

[LEARN-005 — Classroom Mode](../phase-17-noodl-learn/LEARN-005-CLASSROOM-MODE.md) sets design
constraints, not preferences:

> **No accounts by default.** Student identity should be local — a name on a device, or a class
> code — with no external service. Accounts are a privacy liability, an IT obstacle, and a friction
> point, and the educational value does not require them.
>
> **Local-first data.** Student work lives on the student's machine; sharing is an explicit action,
> and the teacher dashboard aggregates what has been shared rather than surveilling continuously.

Its success criteria include *"students start with no account and no sign-up"* and *"AI tutoring
runs locally with verified zero external data transmission"*. Hosted classroom accounts are named
in its **Out of Scope** list, pointing at ECO-004.

[ECO-004 — Hosted Platform](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md) then says:

> Phase 17's design deliberately avoids this by keeping student data local and account-free. A
> hosted platform reverses that decision, and **the reversal must be a considered choice with
> proper legal advice, not an implementation detail.**

UNI-005/006 is that reversal. It was not flagged as one.

**Ruling (2026-08-14) — D10: org-owned pseudonymous accounts.** The school is the data
controller; we hold no child PII; accounts are org-minted handles rather than pupil identities.

**Obligations this ruling creates** (none currently written into UNI-005/006):

1. **LEARN-005 must be amended**, not silently contradicted. Its "no accounts by default" law now
   reads: account-free remains the default and the local classroom mode stays valid; org-provisioned
   pseudonymous accounts are the *opt-in* path for orgs that want rostering and graded results.
   Leaving two live documents in disagreement is how the next phase re-derives this argument.
2. **Pseudonymity has to be real, not nominal.** If the org's roster maps handle → pupil name and
   the platform stores that mapping, we hold child PII by another route. The mapping stays with the
   org (R5's GitHub org hookup, or the school's own list); the platform stores the handle only.
3. **LEARN-005's local-AI constraint is untouched by this ruling.** Its "verified zero external
   data transmission" for tutoring is a network-level claim about minors' work reaching third-party
   model APIs, and no account decision relaxes it. UNI-007's tier-1 AI projection (Sonnet projecting
   a concept onto a learner's context) must therefore be **off by default for org-minor accounts**,
   or run on the pathing metadata only — never the pupil's project content.
4. **ECO-004's exit requirement is non-negotiable and applies to UNI-008 too:** *"Users' work must
   remain theirs and retrievable"* — phase 18's export is the honest answer and "should be a hard
   requirement, not a nice-to-have."

---

## F5 — the lesson format is further along than UNI-007 assumes

UNI-007 says "revive, don't reinvent", which is right. What exists, verified 2026-08-14:

| Asset | Where | State |
|---|---|---|
| Declarative `lesson.json` manifest + compiler | [`models/lessonformat.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts) | Exists (17 KB), +18 tests |
| Completion evaluator — pure fn of (conditions, context), `eval()` removed | [`views/lessons/lessonevalconditions.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts) | Exists (15 KB), +33 unit tests |
| Closed condition vocabulary — 11 verbs, not code | [LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md) | Documented |
| Conditions address nodes **semantically** (component, label, type) — never node id or DOM | same | Documented |
| Progress persistence, Learn-tab entry UI, v2 round-trip of the `lesson` field | LEARN-001 | ✅ verified in the running editor 2026-07-25 |

**Consequence for UNI-007 criterion 3.** It specifies grading via `validate_component`,
`validate_project` and `render_report`. But per-step completion grading already exists as a tested
pure function over project state, and it is the thing the lesson runtime uses to advance a step.
These are two different jobs and the task currently conflates them:

- **per-step completion** → `lessonevalconditions.ts`, the 11-verb evaluator. No MCP call needed.
- **whole-solution validity and "did anything actually render"** → the MCP tooling.

Building a second per-step grader on MCP primitives would fork the very contract UNI-007 exists to
keep single. Criterion 3's "no model call needed to grade" is already true today.

### 🔴 The trap that must be carried into the open contract

[LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md) documents a **silent** failure, and
an open contract with two producers doubles the exposure:

> Every lesson carries two vocabularies and they are frequently different strings: **prose** must
> use the display name; **conditions** must use the **type name**.

Verified against `node-catalog.json` on 2026-08-09 — nine divergences:

| Prose says (display name) | Conditions must say (type name) |
|---|---|
| Repeater | `For Each` |
| Repeater Item | `For Each Actions` |
| Static Array | `Static Data` |
| Delay | `Timer` |
| Array | ⚠️ **ambiguous** — `Collection` *and* `Collection2` |
| Insert Object Into Array | `CollectionInsert` |
| Object | ⚠️ **ambiguous** — `Model` *and* `Model2` 🔴 **corrected 2026-08-14**, this row read `Model2` alone |
| Record | `DbModel2` |
| Page Router | `Router` |

*"The failure is silent: a condition naming a display name matches nothing, and the learner is told
they have not done a step they have in fact done."*

This is exactly the failure Richard named as the risk of AI-authored tutorials, it is class F1, and
it is statically checkable. **The format contract (UNI-007) must state the rule, and the verifier
(UNI-010) must enforce it.** Neither currently does.

🔴 **Sharpened 2026-08-14 by re-verification against `node-catalog.json` (175 entries).** Two of the
nine display names are **ambiguous**, not merely divergent: `Array` carries two type names and so
does `Object`. That makes them **class F3 as well as F1** — an ambiguous name can resolve to the
*wrong one of two* rather than to none, and F3 is the class the prior arc predicted *"nobody expects
to see and is worst when it appears"*. The static check must therefore **reject** these two rather
than auto-substitute a type name for them. Full re-verification in [RULINGS.md](RULINGS.md).

🔴 **Amended again the same day (third session), and the table above is a subset, not the set.**
Deriving the classes from the catalog rather than from the recorded nine gives **103 plain
divergences, 4 ambiguous** (add `Component Object` and `Parent Component Object`) **and a third
class of 6** that no document carried: **shadowed** names — `Variable`, `Button`, `Text Input`,
`Checkbox`, `Radio Button`, `Cloud Function` — where the string *is* a real type name, so any
existence check passes, but it names the **deprecated** node rather than the one in the picker.
`Variable` is the curriculum's own L6 node. The amendment, and the check that now enforces it
(`verifyLessonManifest()` in
[`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts)),
are in [RULINGS.md](RULINGS.md) "Blocker 1 — the amendment".

**The pattern held a fourth time.** Every earlier finding in this document was a *register* that had
outlived its fix. This one is a **measurement** that outlived its method: the nine names were
correct, and re-checking the nine could only ever confirm the nine. Re-deriving from the source
found eleven times as many and a class the method could not have seen. **Re-derive, don't
re-verify.**

---

## Rulings made in this session (2026-08-14)

| Ruling | Decision |
|---|---|
| **D1** — platform repo + stack | **New repo, Next.js + Postgres + Drizzle, Docker on Hetzner**, no code imported from Loom. Created as `nodegx-university`, then ✅ **renamed 2026-08-14 to [The-Low-Code-Foundation/nodegx-community](https://github.com/The-Low-Code-Foundation/nodegx-community)** (private, empty) once **D2** named the product. The warning worked: the rename happened while the repo was empty with **no Pages site**, verified either side |
| **D10** — minors + GDPR | **Org-owned pseudonymous accounts.** School is the data controller; no child PII held. Four obligations recorded in F4 |
| **R6 clarified** | UNI-005/006 build on **phase 51 (async)**, **COL-004 first**. ECO-001 real-time stays parked |
| **UNI-010 vs §3.1** | **Free authoring stands**; the verifier must absorb **F1–F6**, not F2 alone. Consequences recorded in F3 |
| **D12** | **Struck — already ruled 2026-08-09.** Replaced by CURRICULUM-DESIGN §11's three authoring blockers |

~~Still open and unblocking most of the phase:~~ ✅ **ALL RULED 2026-08-14, second session** — D2,
D3, D4, D5, D6, D7, D8, D9 and D11, each with its consequences, in **[RULINGS.md](RULINGS.md)**.
**The queue is empty and no task is blocked on a decision.** 🔴 D9 went *against* the
recommendation and carries five new obligations for UNI-008.

---

## The general lesson

Phase 67 was scoped from conversation and memory rather than from the archive, and the archive
already contained: the collab scoping R6 gestured at, the generated-lesson experiment UNI-010
proposes, the classroom privacy law UNI-005/006 reverses, and the ruling D12 says is outstanding.
Four of the five findings here are cases of **the repo already having voted**.

Before scoping a UNI task, grep `dev-docs/tasks/` for its subject. Phases 17, 20 and 51 are this
phase's direct ancestors and none of them was cited when it was written.
