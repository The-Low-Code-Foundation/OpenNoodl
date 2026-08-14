# Curriculum v1 — Learning Outcomes & Concept Progression

**Task:** LEARN-002 · **Status:** ✅ **REVIEWED AND ACCEPTED** by the learning designer (Richard), 2026-08-09
**Written:** 2026-07-25 · **Decisions recorded:** 2026-08-09 (§10)
**Rule this document enforces:** no lesson is authored until this progression is
reviewed and accepted. The sequence matters more than any individual lesson.

> **The gate is now open.** D1–D6 are answered in §10, along with four decisions
> that did not exist when this was written. Three items in §11 must be settled
> before the first lesson is authored — none of them is a design question.

---

## 1. The thesis, restated as something falsifiable

The claim is **not** "Noodl is an easy way to build apps." The claim is:

> A learner who builds a working application in a visual graph ends up
> understanding **state**, **data flow**, **events**, and **composition** as
> named concepts they can reason about and recognise elsewhere — including in
> written code. A learner who prompts an AI into building the same app does not.

Every design decision below traces back to that. The failure mode to design
against is the tutorial that teaches *Noodl operation* ("click here, drag
this") — learners finish, can drive the tool, and have learned nothing
transferable. The countermeasures are structural, not aspirational:

1. **Concepts are named at the moment they solve a felt problem**, never
   before. State is introduced only after the learner has built something that
   visibly *forgets*.
2. **Every concept gets its general-programming name** in the same breath as
   its Noodl name (§6, glossary).
3. **Comprehension is tested by transfer, not repetition** — each concept
   lesson ends with a task the instructions do not cover, verified by the
   engine's project-state conditions (§7).
4. **The AI tutor explains and never authors** ([TUTOR-BOUNDARY.md](./TUTOR-BOUNDARY.md)).

## 2. Learner profile

- **Target:** absolute beginners. **Both** adults and teenagers (~13–17) — the
  curriculum is written to serve both, not to pick one. No programming assumed,
  basic computer literacy assumed (files, typing, a browser).
- **Setting:** self-paced at home, or a classroom period (~40–50 min). Lessons
  are sized so one lesson ≈ one sitting of 20–40 min.
- **Device:** desktop editor (LEARN-003's web viewer is out of scope here).

> ✅ **D1 answered (2026-08-09):** age band and sitting length confirmed as
> drafted — ~30 min per lesson. The audience is **both** adults and teenagers.
>
> ⚠️ **But the first testing round is adults only**, because that is who is
> available (see §8). This is a real limitation on the evidence: a lesson that
> works for a motivated adult hobbyist is not thereby shown to work for a
> fifteen-year-old in a classroom period. Tone and pacing decisions taken on
> adult evidence must be re-tested before any classroom claim is made.

## 3. Terminal learning outcomes

A learner who completes the curriculum can, without help:

| # | Outcome | Assessed by |
|---|---|---|
| O1 | Explain what **state** is, point to where it lives in their app, and say why the app breaks if it lives in the wrong place | L3–L4 transfer + explain-back; capstone |
| O2 | Trace how **data flows** from a source (state, input, server) to what the user sees, through transformations | L4, L8 transfer; explain-back |
| O3 | Distinguish an **event** from a **value**, and say what triggers what | L2 transfer; recurs every lesson after |
| O4 | Read and author **conditional logic** — "when this, then that, otherwise…" | L5–L6 transfer |
| O5 | Explain why **one design serves many items** in a list, and what data an item template receives | L7–L8 transfer |
| O6 | Break an app into **components** and defend the boundaries they drew | L10 transfer; capstone |
| O7 | **Build a small app independently** from an idea, not from instructions | Capstone (L12) |
| O8 | **Recognise the concepts in written code** — shown a ~15-line JS snippet, identify the state, the event handler, the condition, the loop | L11 + capstone debrief |

O8 is the transfer claim made literal, and it is the one a Noodl-operation
tutorial cannot fake. It gets its own lesson (L11) rather than being an
afterthought.

## 4. The running build, and why one app instead of twelve

Lessons 1–10 build **one app, cumulatively**: a virtual pet ("Creature").
Rationale: the motivation chain in §5 only works if the problem the learner
*felt* in lesson N is the problem lesson N+1 solves — that requires continuity.
A pet is state-rich by nature (hunger, mood, energy), event-rich (feed, play,
poke), and endears itself enough that teenagers keep going. It needs no
domain knowledge and no sensitive data.

**Engine mechanics:** the lessons engine clones a template project per lesson.
Continuity is therefore implemented as *template chaining*: lesson N's template
**is** lesson N−1's solution. This has a pedagogically useful side effect —
every lesson starts from a known-good state, so a learner who mangled lesson 3
is not wrecked for lesson 4, and any lesson can be started standalone for
classroom triage.

> ✅ **D2 answered (2026-08-09): the pet.** *"The pet theme is cute and I think
> adults can appreciate it too."* Alternates considered and rejected: a **quiz
> app** (better fit for conditions/lists, weaker for state-motivation; feels
> like school) and a **playlist/collection app** (strong for lists/data, weak
> event story).

## 5. Concept progression — the spine

Each row: the *problem the learner just felt* → the concept that resolves it.
This is the reviewable core of the document.

| # | Lesson (working title) | Felt problem → concept | General-programming name | They build | New nodes |
|---|---|---|---|---|---|
| L1 | **Your creature, on screen** | Blank page → a UI is a *tree* of visual elements with *properties* | elements, hierarchy, properties | The pet's card: image, name, coloured frame | Group, Text, Image, Circle |
| L2 | **Poke it** | It's a poster, it ignores you → *events*: "something just happened" pulses that trigger actions, distinct from values | events, event handlers | Poke button wiggles the pet (animation on click) | Button, Animate To Value |
| L3 | **It forgets you** | Poke it twice, nothing accumulates — the app has no memory → *state*: a remembered value that events change | variables, state | Hunger counter: Feed button decrements hunger; count survives between clicks | Counter (or Variable + Set Variable — see D3), Value Changed |
| L4 | **Show what it feels** | The number is stored but the screen doesn't say anything meaningful → *data flow*: values travel from state through transforms to the screen, updating automatically | expressions, reactive data flow | Hunger number formatted into "Hunger: 3/10" and a fill-bar width | Expression, String Format |
| L5 | **Moods** | "Hungry" vs "fine" is a decision the app must make → *conditions & branching* | if / else, booleans, comparison | Mood: hunger > 6 shows the grumpy face and "Feed me!" | Condition, Switch, States |
| L6 | **It gets demanding** | One condition isn't enough — hungry AND bored → *combining logic*; time as an event source | boolean operators, timers | Hunger rises on a repeating delay; mood needs AND/OR of two states | Delay (`Timer`) ⚠️, And, Or, Inverter |
| L7 | **Snacks** | Feeding is abstract; a menu of snacks means *many similar things* → *lists*: one item design, repeated per data item | arrays, iteration, templates | Snack menu from a static array; clicking a snack feeds by that snack's power | Static Array (`Static Data`), Repeater (`For Each`), Repeater Item (`For Each Actions`) |
| L8 | **A cupboard that remembers** | The menu is fixed, and it forgets when you close the app → *stored records*: data that outlives the session | database, CRUD | Add/remove snacks in the built-in backend; cupboard count from a query | Record (`DbModel2`), Create Record, Query Records, Delete Record |
| L9 | **More than one room** | One screen is cramped → *navigation*: pages, routes, and passing which-pet/which-page *parameters* | routing, URLs, parameters | Home / Play Room / Cupboard pages; navigation with a parameter | Page Router (`Router`), Page, Page Inputs, Navigate |
| L10 | **Build your own node** | The pet card is duplicated on two pages; changing it twice hurts → *componentisation*: your own reusable part with declared inputs/outputs | functions/components, interfaces, encapsulation | Extract `Pet Card` component with inputs (name, hunger) used on two pages | Component Inputs/Outputs |
| L11 | **The same ideas in code** | "Is this programming?" → yes: map every concept you used onto a short real JS program | variables, handlers, if, loops, functions | Nothing new in Noodl: annotate a ~15-line JS version of the pet, matching graph ↔ code | (JavaScript/Expression node as a bridge) |
| L12 | **Capstone: your own app** | — | all of the above | An app of their own choosing, from a menu of scoped ideas or free choice | any |

**Node names re-verified against `node-catalog.json` on 2026-08-09.** Five had
drifted since the 2026-07-25 draft. The column above now reads *Display name
(`type name`)* wherever the two differ — prose uses the first, `completeWhen`
conditions use the second, and the failure when they are swapped is silent. The
full mapping and the reason are in
[LESSON-FORMAT.md §3](./LESSON-FORMAT.md) under "`%Type` takes the node's type
name".

⚠️ **L6's mechanism needs a design pass.** `Timer` displays as **Delay** and is
**one-shot** — Start/Restart/Duration/Started/Finished, with no repeat option
([timer.ts](../../../packages/noodl-viewer-react/src/nodes/std-library/timer.ts)).
"Hunger rises on a timer" therefore requires wiring **Finished → Restart**, a
self-referential loop. That is either a lovely accidental lesson in feedback
loops or a step too far for L6; the author decides when L6 is written, and if it
is too much, the timer moves to L7+ and L6 keeps only the boolean logic.

**Count:** 12 lessons (11 taught + capstone), inside the 10–15 band, leaving
room for a lesson to split in beginner testing (L4 and L9 are the likeliest
to be too dense).

**Deliberately excluded from v1:** *third-party* REST/server data. The REST node
exists and "bringing in real data" is in the spec's sketch, but a public API
drags in asynchrony, failure states, and a dependency that can break the spine
when someone else's server goes down. Proposed: an optional **L8b "Real data"**
appendix lesson (fetch pet facts from a public API) rather than a spine lesson.

This is **not** the same as excluding data storage — see D8 below, which puts
the built-in backend into L8.

> ✅ **D3 answered (2026-08-09): Counter first, as drafted.** L3 uses the
> ready-made **Counter** node (fewer moving parts, though state arrives
> pre-packaged); **Variable + Set Variable** is revealed in L6 when something
> other than a button needs to write hunger — *"Counter was a convenience; here
> is the general thing."*
>
> ✅ **D4 answered (2026-08-09): L11 stays in the spine.** It is the only direct
> evidence for O8 (recognising the concepts in written code), and O8 is the
> claim that distinguishes this curriculum from a Noodl-operation tutorial. It
> is also the lesson most affected by phase 61 — see §11.
>
> ✅ **D8 (new, 2026-08-09): L8 uses the built-in backend, not an in-memory
> array.** *"We have our own inbuilt awesome backend."* The felt problem shifts
> accordingly — from *"lists grow and shrink"* to *"it forgets when you close
> the app"* — which is a stronger motivation and teaches persistence, a concept
> the draft did not cover at all.
>
> ⚠️ **The cost, recorded rather than discovered:** L8 now requires a
> **provisioned backend**, which is a setup step, a running process, and a
> failure surface no earlier lesson has. Three consequences: (1) L8 needs a
> "your backend is running" precondition the lesson engine cannot check with its
> current condition verbs; (2) the classroom path (managed Chromebooks,
> LEARN-003's web viewer) cannot run a local backend, so **L8 is the first
> lesson that will not port to the browser**; (3) if provisioning fails, the
> learner is stuck in a way no earlier lesson can produce. An in-memory
> **Array** variant of L8 should be kept as the fallback, not deleted.

### 5.1 The visual-code track (D9, new 2026-08-09)

Phase 59 found that a **full Blockly workspace with a math palette has shipped
since phase 3** and nobody opens it — the node is **Logic Builder**, and its
ports are derived from its blocks, so building the body publishes the signature
([phase-59 README](../phase-59-logic-seam/README.md)).

✅ **Answered: yes, but as an option — "for those who don't want to write code."**

For a learner arriving from Scratch this is the natural rung between blocks and
text, and it costs the spine nothing because it is an *alternate route through
existing lessons*, not a new lesson:

- **L11** ("the same ideas in code") gains a parallel path: the same concepts
  shown in **Logic Builder blocks** for learners who do not want to read JS.
  O8 (recognise the concepts in written code) is still assessed on the JS
  version — the block path is scaffolding toward it, not a substitute, or the
  transfer claim quietly evaporates.
- Any lesson step that would use an **Expression** or **Function** node may
  offer Logic Builder as an equal-standing alternative.

⚠️ **Blocked on phase 59.** Logic Builder is currently unfindable, and the
curriculum must not teach a route the product hides. If phase 59 does not
surface it, this track is dropped rather than shipped as a treasure hunt.
Sequencing consequence in §11.

## 6. Concept glossary — the shared vocabulary

One glossary, used verbatim by lesson bodies **and** the AI tutor (the tutor
overlay references this list; see TUTOR-BOUNDARY.md §4). Format: *Noodl word —
general word — one-sentence definition a 13-year-old can repeat.*

- **Property** — *attribute* — a setting on an element that controls how it looks or behaves.
- **Signal** — *event* — a moment, not a value; it runs something on the node it points at. ✅ **Phase 60's shipped wording, cited not paraphrased — see below.**
- **Value** — *data* — a piece of information that flows along a wire and updates whatever reads it.
- **Variable / Counter** — *state* — a value the app remembers between events; the app's memory.
- **Wire / connection** — *data flow* — the path a value or signal travels; downstream updates automatically.
- **Condition** — *if/else* — a decision point: one outcome when true, another when false.
- **Repeater item** — *array element* — one entry in a list, rendered by a shared template.
- **Collection** — *array* — an ordered list of records the app can add to and remove from.
- **Route / Page** — *URL / screen* — an addressable screen; parameters say which one and with what.
- **Component** — *function / module* — a named, reusable part with declared inputs and outputs.

The glossary is versioned here so lesson text and tutor never drift apart.

> ✅ **D7 answered (2026-08-09): phase 60 owns the signal/value wording.**
>
> Three documents were about to define "signal" for a beginner independently:
> this glossary, [phase 60](../phase-60-values-and-signals/README.md) (the
> canvas vocabulary), and phase 61's FUN-001 (the same distinction in code).
> Phase 61 already defers to phase 60; phase 17 now does too. **This glossary
> cites phase 60's sentence — it does not paraphrase it.**
>
> ⚠️ **The line above was wrong as written, and has been corrected.** Phase 60
> read the cast table and found that **`boolean → signal` is allowed**, along
> with `signal → boolean` and `signal → number`
> ([nodelibraryexport.ts:207-240](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L207)).
> "A signal carries a moment, not a value" is the kind of clean sentence a
> builder disproves in their first week — the NDA-017 shape, where the only
> written-down description of a behaviour described a trap as a feature.
>
> ✅ **RESOLVED 2026-08-14. Phase 60 is 7/7 closed (2026-08-11) and its wording
> shipped** — `SIGNAL_SENTENCE` in
> [`portCopy.ts:85`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/portCopy.ts):
>
> > *"Signal — a moment, not a value. It runs something on the node it points
> > at. Value connections carry their data on their own, so you usually don't
> > need a signal to set a value — reach for one when you want to control
> > **when** something happens."*
>
> The glossary line now cites the first clause of that sentence verbatim. 🔴 **If
> `portCopy.ts` changes, this line changes with it** — it is a citation, not an
> independent definition, and phase 60 owns it. **L2 is unblocked.**
>
> 🔴 **This warning outlived its fix by three days** — it said "do not author
> until phase 60 publishes" while phase 60 had already published. Phase 67's
> [RULINGS.md](../phase-67-nodegx-university/RULINGS.md) records it as one of
> three instances of the same pattern found in a single day.

## 7. Assessment — three layers

**Layer 1: transfer tasks, machine-verified (every concept lesson).**
The last card of each lesson is a task the instructions do not cover, phrased
as an outcome ("Give the pet a *thirst* meter that the Drink button lowers —
you've done everything you need for this"), verified by the engine's
`completeWhen` conditions on project state (node exists, connection exists,
params set). This is the format's superpower: it observes the **model**, not
the pixels, so "did they transfer the concept" is checkable without a human.
Completion of the scripted steps is *not* counted as comprehension; only the
transfer card is.

**Layer 2: explain-back, tutor-mediated (end of L3, L5, L8, L10).**
A popup step asks the learner to explain the lesson's concept in their own
words *to the tutor panel* and compare with the tutor's explanation of their
actual graph. v1 keeps this as guided self-check (the format has no free-text
grading step, and building auto-grading of explanations is out of scope);
LEARN-005's teacher view is where a human reads these. The step body gives the
learner the question and 2–3 "did you mention…" self-check bullets.

**Layer 3: the capstone (L12).**
Open build, no step-by-step. Support = the tutor (within its boundary) plus a
printed one-page "recipe card" of concept names. Scoped idea menu (e.g. score
keeper, flash-card quiz, decision spinner, two-page fan site with a list) or
free choice. **Pass bar:** the app runs; it uses state, at least one condition,
and one list *or* one owned component; and the learner can answer "where does
your app remember things?" and "walk me through what happens when you click X."
Those two questions — not app polish — are the measure.

**What the engine cannot verify (accepted gaps):** the quality of an
explanation (layers 2–3 need a human or a future AIX capability), and anything
behavioural-at-runtime beyond graph structure. Documented so nobody mistakes
the transfer cards for full assessment.

## 8. Beginner testing protocol (lessons 1–3 first)

Per the task spec: author L1–L3, test with real beginners, revise the
*approach* before authoring L4+.

- **Who:** 3–5 testers per round, no programming background. ⚠️ **Round 1 is
  adults only** (2026-08-09: that is who is available — Richard plus one or two
  community members). The teenage band is a stated target (§2) with **no
  evidence behind it until a later round**; nothing about classroom fit may be
  claimed from round-1 results.
- **Capture per lesson:** completion (y/n), wall-clock time, stall points
  (where they asked for help or sat >2 min), skips, and the exit interview:
  *"can you tell me how it works?"* scored against the lesson's concept
  (0 = operation only, 1 = concept in own words, 2 = concept + transfer).
- **Tutor observation:** whether they used it, what they asked, and every
  instance of trying to get answers out of it (feeds the boundary tests).
- **Revision rule:** any step where ≥2 testers stall gets rewritten; any
  lesson averaging <1 on explanation gets redesigned, not polished.
- Results recorded in `dev-docs/tasks/phase-17-noodl-learn/testing/` per round.

## 9. Engineering follow-ons this design creates

1. **Tutor lesson-context overlay** (small AIX-004 extension): when a lesson is
   active, `ExplainSession` receives the current step's task so the boundary
   ("don't dictate this step's solution") can be enforced in the prompt. See
   TUTOR-BOUNDARY.md §5. *Required before L2 testing.*
2. **Template chaining check:** verify a cloned lesson project can serve as the
   next lesson's template with its `lesson.json` swapped (expected to work —
   the lesson field round-trips — but unproven). *Required before authoring L2.*
3. **Curriculum hosting:** the engine reads lesson lists from a URL; the new
   curriculum needs a home (likely the docs repo + GitHub Pages, mirroring how
   the legacy 8 are hosted by `the-low-code-foundation`). Decision owed by
   LEARN-002, blocking distribution, not authoring.
4. **Non-programmer format validation** (LEARN-001's open criterion): first
   authoring rounds double as the validation session — log every place the
   format needed a programmer's eye. If lesson authoring stays in JSON-by-hand
   past L3, consider a tiny authoring aid.

## 10. Decision register — answered 2026-08-09

Answered by the learning designer (Richard) in session, 2026-08-09. D1–D6 were
this document's original questions; D7–D9 did not exist when it was written and
come from phases 59, 60 and 61, all specced on 2026-08-09.

| | Question | Answer | §|
|---|---|---|---|
| **D1** | Age band + sitting length | **As drafted** — ~30 min/lesson, and the audience is **both** adults and teenagers. Round-1 testing is adults only | §2, §8 |
| **D2** | Theme: pet vs alternates | **The pet.** *"Cute, and adults can appreciate it too"* | §4 |
| **D3** | Counter-first vs Variable-first | **Counter first**, Variable revealed in L6 | §5 |
| **D4** | Code-mapping lesson: spine or appendix | **Spine.** It is the only evidence for O8 | §5 |
| **D5** | Badges: use `completionBadge` or drop it | **Use them** (approved as part of the draft, not separately argued) | — |
| **D6** | Capstone: idea menu or free choice | **Menu, with free choice allowed** (as drafted) | §7 |
| **D7** | Who owns the beginner wording for "signal" | **Phase 60.** This glossary cites it; the current line is probably wrong | §6 |
| **D8** | L8: in-memory array or the built-in backend | **The backend.** *"We have our own inbuilt awesome backend"* — cost recorded | §5 |
| **D9** | Logic Builder (Blockly) in the curriculum | **Yes, as an option** for learners who do not want to write code. Blocked on phase 59 surfacing it | §5.1 |

## 11. Before the first lesson is authored

Three items, none of them a design question, all of which silently damage
lessons if skipped. Listed in the order they bite.

1. **The two-vocabulary rule.** ⚠️ **Still open — the only one of the three that
   is.** Prose uses display names, conditions use type names, and five of this
   spine's nodes now differ between the two. A `completeWhen` written in display
   names matches nothing and tells the learner they failed a step they
   completed. Rule and mapping: [LESSON-FORMAT.md §3](./LESSON-FORMAT.md).
   🔴 **Re-verified 2026-08-14 and it is worse than recorded:** *two* display
   names are **ambiguous**, not one — `Array` resolves to `Collection` *and*
   `Collection2`, and **`Object` resolves to `Model` *and* `Model2`** (both §3
   and phase 67's reconciliation record `Model2` alone). An ambiguous name can
   resolve to the *wrong* node rather than to none, which is a different and
   worse failure. Details:
   [phase 67 RULINGS.md](../phase-67-nodegx-university/RULINGS.md).
2. ✅ **CLEARED 2026-08-14. Phase 60's signal wording landed** — the phase closed
   7/7 on 2026-08-11 and the sentence ships in `portCopy.ts`. §6's glossary line
   now cites it. **L2 is unblocked.**
3. ✅ **CLEARED 2026-08-14 for L11. Phase 61 is 8 of 9 built on `cline-dev`**
   (FUN-005, the ports rail, is the only one open), and FUN-001 §2's notation
   ruling — `Inputs.`/`Outputs.`, never `Noodl.Inputs` — was **signed 2026-08-12
   and is enforced by `notation.test.ts`**. ⚠️ Phase 61's own task table still
   marks four merged tasks open; trust git, not the table. **The one caveat:
   FUN-005 does not exist, so no L11 step may reference a ports rail beside the
   code.** Phase 59 has surfaced the visual track (LGC-001/009/010 built and
   driven), so D9's option is real — but ⚠️ **LGC-007's My Blocks has an engine
   and no UI**, so no lesson may ask a learner to save or reuse a block group.
   Authoring L1–L3 first (as §8 already requires) remains the right order.

Not blocking authoring, still owed: **curriculum hosting** (§9.3) and the
**tutor lesson-context overlay** (§9.1, required before L2 testing).

## 12. References

- [LEARN-002 task spec](./LEARN-002-CURRICULUM-V1.md) — scope, success criteria
- [LESSON-FORMAT.md](./LESSON-FORMAT.md) — the authoring format this targets
- [TUTOR-BOUNDARY.md](./TUTOR-BOUNDARY.md) — companion document, same review gate
- [LEARN-001-ASSESSMENT.md](./LEARN-001-ASSESSMENT.md) — engine capabilities
- Viability report §2.2 — the pedagogy thesis this curriculum must earn
