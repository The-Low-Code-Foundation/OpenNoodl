# Curriculum v1 — Learning Outcomes & Concept Progression

**Task:** LEARN-002 · **Status:** DRAFT — awaiting learning-designer review (Richard)
**Written:** 2026-07-25
**Rule this document enforces:** no lesson is authored until this progression is
reviewed and accepted. The sequence matters more than any individual lesson.

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

- **Target:** absolute beginners, centred on teenagers (~13–17); no programming
  assumed, basic computer literacy assumed (files, typing, a browser).
- **Setting:** self-paced at home, or a classroom period (~40–50 min). Lessons
  are sized so one lesson ≈ one sitting of 20–40 min.
- **Device:** desktop editor (LEARN-003's web viewer is out of scope here).

> **Designer decision D1:** confirm the age band and sitting length — lesson
> granularity below assumes ~30 min/lesson.

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

> **Designer decision D2:** theme. Alternates considered: a **quiz app**
> (better fit for conditions/lists, weaker for state-motivation; feels like
> school) and a **playlist/collection app** (strong for lists/data, weak
> event story). The pet wins on motivation-chain fit; happy to prototype an
> alternate spine if you disagree.

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
| L6 | **It gets demanding** | One condition isn't enough — hungry AND bored → *combining logic*; time as an event source | boolean operators, timers | Hunger rises on a timer; mood needs AND/OR of two states | Timer, And, Or, Inverter |
| L7 | **Snacks** | Feeding is abstract; a menu of snacks means *many similar things* → *lists*: one item design, repeated per data item | arrays, iteration, templates | Snack menu from static data; clicking a snack feeds by that snack's power | Static Data, For Each / Repeater |
| L8 | **A snack cupboard that changes** | The menu is fixed; real lists grow and shrink → *collections & mutation* | array push/remove, CRUD | Add/remove snacks; cupboard count derived from the list | Collection, Insert/Remove Record |
| L9 | **More than one room** | One screen is cramped → *navigation*: pages, routes, and passing which-pet/which-page *parameters* | routing, URLs, parameters | Home / Play Room / Cupboard pages; navigation with a parameter | Router, Page, Page Inputs, Navigate |
| L10 | **Build your own node** | The pet card is duplicated on two pages; changing it twice hurts → *componentisation*: your own reusable part with declared inputs/outputs | functions/components, interfaces, encapsulation | Extract `Pet Card` component with inputs (name, hunger) used on two pages | Component Inputs/Outputs |
| L11 | **The same ideas in code** | "Is this programming?" → yes: map every concept you used onto a short real JS program | variables, handlers, if, loops, functions | Nothing new in Noodl: annotate a ~15-line JS version of the pet, matching graph ↔ code | (JavaScript/Expression node as a bridge) |
| L12 | **Capstone: your own app** | — | all of the above | An app of their own choosing, from a menu of scoped ideas or free choice | any |

All node names verified against the shipped runtime
(`packages/noodl-runtime/src/nodes/std-library/`, `packages/noodl-viewer-react/src/nodes/`).

**Count:** 12 lessons (11 taught + capstone), inside the 10–15 band, leaving
room for a lesson to split in beginner testing (L4 and L9 are the likeliest
to be too dense).

**Deliberately excluded from v1:** REST/server data. The REST node exists and
"bringing in real data" is in the spec's sketch, but it drags in asynchrony,
failure states, and a public API dependency — a lot of accidental complexity
for one concept. Proposed: an optional **L8b "Real data"** appendix lesson
(fetch pet facts from a public API) rather than a spine lesson, so the spine
never breaks when an external API does.

> **Designer decision D3:** L3 can use the ready-made **Counter** node (fewer
> moving parts, but state arrives pre-packaged) or **Variable + Set Variable**
> (more wiring, but the learner *sees* that state is a thing that is read and
> written). Draft assumes Counter in L3, then reveals Variable in L6 when the
> timer needs to write hunger — "Counter was a convenience; here is the
> general thing."
>
> **Designer decision D4:** is L11 (code-mapping) in the spine or an appendix?
> It is the strongest evidence for O8/transfer, but it is the least "showable"
> lesson and the most school-like.

## 6. Concept glossary — the shared vocabulary

One glossary, used verbatim by lesson bodies **and** the AI tutor (the tutor
overlay references this list; see TUTOR-BOUNDARY.md §4). Format: *Noodl word —
general word — one-sentence definition a 13-year-old can repeat.*

- **Property** — *attribute* — a setting on an element that controls how it looks or behaves.
- **Signal** — *event* — a "this just happened, now" pulse; it carries a moment, not a value.
- **Value** — *data* — a piece of information that flows along a wire and updates whatever reads it.
- **Variable / Counter** — *state* — a value the app remembers between events; the app's memory.
- **Wire / connection** — *data flow* — the path a value or signal travels; downstream updates automatically.
- **Condition** — *if/else* — a decision point: one outcome when true, another when false.
- **Repeater item** — *array element* — one entry in a list, rendered by a shared template.
- **Collection** — *array* — an ordered list of records the app can add to and remove from.
- **Route / Page** — *URL / screen* — an addressable screen; parameters say which one and with what.
- **Component** — *function / module* — a named, reusable part with declared inputs and outputs.

The glossary is versioned here so lesson text and tutor never drift apart.

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

- **Who:** 3–5 testers in the target band per round, no programming background.
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

## 10. Open questions for the learning designer

- **D1** Age band + sitting length (§2)
- **D2** Theme: pet vs alternates (§4)
- **D3** Counter-first vs Variable-first state introduction (§5)
- **D4** Code-mapping lesson in spine vs appendix (§5)
- **D5** Badges: per-lesson `completionBadge` exists in the format — use it, or is it noise?
- **D6** Capstone: idea menu only, or free choice allowed from the start?

## 11. References

- [LEARN-002 task spec](./LEARN-002-CURRICULUM-V1.md) — scope, success criteria
- [LESSON-FORMAT.md](./LESSON-FORMAT.md) — the authoring format this targets
- [TUTOR-BOUNDARY.md](./TUTOR-BOUNDARY.md) — companion document, same review gate
- [LEARN-001-ASSESSMENT.md](./LEARN-001-ASSESSMENT.md) — engine capabilities
- Viability report §2.2 — the pedagogy thesis this curriculum must earn
