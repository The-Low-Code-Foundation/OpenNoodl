# Phase 85 — The component is the backbone

**Scoped:** 2026-09-09, from Richard's field test of the landing-page template.
**Status: OPEN.** **Prefix: `CMP`.**

🔴 **This phase does not close.** It is the standing loop, not a fix. Every other phase here has a
last task; this one has a cadence.

> "Clever components are one of the backbones of why using Noodl was good. You're as close to a
> 'real developer' as possible in terms of separation of concerns and reusing as much as possible
> instead of writing everything from scratch, the difference between code that can be easily handed
> off to another developer and code that's an indecipherable mess."
>
> "I'd say we should schedule continuous improvement of the MCP, run regular sessions as I and the
> community create new apps in NodeGX to show you what's been done and marvel at the clever
> component creation, to then continuously add extra improvements to the MCP and turn it into a
> NodeGX Jedi master one day, but that will never stop learning or wanting to learn how to do
> things better." — Richard, 2026-09-09

## 1. The person sentence

**An agent building in NodeGX writes components a person would be glad to inherit — and gets better
at it every time a real app is built, because what that app did well is folded back in.**

## 2. 🔴 The finding that shapes the whole phase

Four separate defects, all the same shape: **the doctrine exists and nobody measured whether it
was followed — and where it does speak, it is sometimes wrong.**

| # | doctrine says | what shipped | task |
|---|---|---|---|
| 1 | *"A named section is a component… a graph past ~25 nodes wanted to be several"* | template pages of **63 / 72 / 98** nodes, **zero** section components | CMP-002 |
| 2 | *"Interfaces are deliberate"* — and nothing else | **14%** of template components publish outputs, vs **84%** of the Noodl prefabs | CMP-001 |
| 3 | 🔴 *"A single node… is not a component — a file and a hop that bought nothing"* | LearnBook's two shared logic folders: **37 components, 107 instantiations**, `Format full name` **9×**, `Is Trainer check` **9×**. Prefabs: **80** logic-only components, **45** of them one or two working nodes | CMP-003 — rule ✅ |
| 4 | 🔴 nothing — the briefing never mentions the library | a **42-entry shelf** with `list_library` / `install_prefab` ships in the same server; `grep` for library/shelf/reuse in `instructions.ts` returns **zero**. Every part is built from scratch | CMP-004 |

Row 3 is the sharpest: **the shipped doctrine actively forbids the single most common utility
pattern in every real Noodl codebase we have.** A model reading it will never write `Sanitise
email`, and the next page will grow its own anonymous Function node that does the same thing.

⚠️ Honest nuance, measured: 17 of LearnBook's 37 logic components are used 0 or 1 times. Extraction
is not free and not always repaid in reuse. But **the second reason stands at one use** — a named
`Sanitise email` in a shared folder is findable by the next builder; an anonymous Function node on
page 4 is not, and gets recreated. Readability and findability are the case, reuse is the bonus.

## 3. The loop

Each cycle is one session, and produces one row in `STUDIED-APPS.md`.

**Step 1 — build.** An app or a page gets built, either by the MCP (a graded run, CMP-002 shape) or
by Richard/the community in the editor.

**Step 2 — grade it.** `./measure-interfaces.py v2 <project>/components` against the CMP-001 floors.
Numbers before opinions.

**Step 3 — stand back and read the graph.** 🔴 This is the step that is easy to skip and is where the
value is. Not "does it work" — **"what would the next developer wish had a name?"** Six questions,
asked of every page:

1. **What repeats?** Two structurally identical siblings are one component and a data source.
2. **What is named but inlined?** If you would say "the hero" out loud, it is a component.
3. **What cluster of logic nodes does one job?** An evaluation, a guard, a derivation — does it have
   a name, or is it a drift of nodes beside the visual tree?
4. 🔴 **What single node is a utility in disguise?** A Function that converts a string to the JSON a
   dropdown expects; a date format; a name formatter; a permission check. *Would a builder on
   another page recreate this rather than find it?* If yes, it is a component with a name, however
   small — **this overrides the "when not to" rule**, see §2 row 3.
5. **What is hard-coded that wanted a port?** A colour, a size, a visibility, a label — anything the
   second instance would have needed.
6. **What does this component refuse to tell its parent?** A click, a value, a failure, its own
   element for a scroll target.

**Step 4 — fold back.** Anything the answers surface becomes one of: a new pattern in the CMP-001
playbook, a corpus example, a correction to a doctrine, or a defect row. **Every entry names the app
it came from**, so a pattern can be traced to the real page that earned it.

**Step 5 — re-grade the arms.** The floors move up only when a real build clears them.

### 3.1 Cadence

**Whenever Richard gets time** — event-driven, because the yield comes from real apps and not from
the calendar. A weekly nudge guards against "whenever" becoming "never": routine
`trig_01MFceQCDiZvLy7cuSyeU877`, Fridays 09:00 Europe/Paris, first fire 2026-09-11. It reads this
README and `STUDIED-APPS.md`, reports where the loop stands in five lines, and says plainly when the
newest ledger row is over a month old. It is read-only and never does the work.
It reads the **GitHub checkout**; this folder was pushed to `cline-dev` at `b0ad5c8a` on
2026-09-09, so the first fire has a ledger to read.

### 3.2 🔴 Keeping the measurement honest

**A session that has read this phase cannot produce a baseline for it.** The CMP-001 patterns are
the answers; a model that knows them measures itself, not the server. So a graded build runs from
[`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md`](CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md) — a standalone
brief that carries the task and the logging protocol and none of the findings — in a session that
has read nothing else here. The same rule applies to every later re-measurement, not just the first.

## 4. Why it cannot be one phase

The three defects above were found by looking at **one** template and **one** production app. The
prefabs alone yielded nine interface patterns in an afternoon; LearnBook added a category (logic
components) that the prefab study had not surfaced as its own idea. There is no reason to think the
next app studied will yield nothing, and every reason to think the yield is what makes the MCP good
rather than adequate.

**The measure of this phase is not that it closes. It is that the floors in CMP-001 are higher this
quarter than last, and that each rise is traceable to an app somebody actually built.**

✅ **The shelf is two-way as of 2026-09-10 (CMP-004 AC4).** Without it, every cycle improved the
*doctrine* and every agent still built every part from scratch. With it, one good `Sanitise email`
is written once and reached for by everyone after. That is the Tailwind bargain, and it is the
difference between the MCP getting better advice and the MCP getting better parts.

🔴 **What the loop now waits on is FINDING and STOCKING.** `export_to_library` can put a part on the
shelf. ✅ **Both halves are now closed**: `list_library({query})` answers *"is there a date
formatter?"* (CMP-004 AC2, s4), and the shelf carries three exported single-component parts
(CMP-004 AC3, s5).

🔴 **AND THE SHELF ALREADY HELD AN ANSWER NOBODY COULD ASK FOR.** The first thing the query found
is `intl-format` — a module of locale-aware formatting nodes (`Relative Time` "3 hours ago",
`Format Number`, `Format List`, `Pluralize`), on the shelf the whole time. **CMP-005 walked past it
twice in one day**, recording relative time as an open product gap while the node sat there. Its
node names are written in exactly one place, the entry's description, and until AC2 nothing read
descriptions. **This phase's own thesis, landing on this phase**: §1's "before an agent builds a
part, it looks to see whether the community already built it", with us as the agent.

✅ **AND SESSION 5 MADE THE TWO ANSWERS TELL THE TRUTH ABOUT EACH OTHER.** The question now returns
**`format-date`** first — a part this phase exported onto the shelf — with `intl-format` still in
the answer, and each description naming the other and saying which job is not its own. 🔴 Session
4's assertion that `intl-format` ranked first went **red on the day the phase closed the gap it was
measuring**; the literal was not bumped, both facts are now asserted. *A spec pinned to the best
answer is pinned to the state of the shelf, and closing the gap is what moves it.*

✅ **CMP-005 changed the answer that question will get.** As of 2026-09-10 the product's reply to
*"format a date as Thursday, 10 September"* is **thirteen new tokens on the node that was already
there**, not *"write a Function node with Intl"* — and the sentence in `whenToUse` that said the
latter is gone, because a fix that leaves the documentation saying "go write JavaScript" has not
landed. ⚠️ **It also found the shape of the phase in miniature, twice**: the formatter ships a
**second time** as emitted source in `nodegx-export`, and the corpus's one example that set a
format set a **moment.js pattern this node cannot read** — validating clean, teaching a lie.

## 5. Tasks

| id | what | status |
|---|---|---|
| [CMP-001](CMP-001-THE-COMPONENT-INTERFACE-PLAYBOOK.md) | The ten interface patterns, the three grading floors, and the `States.currentState` defect that blocks the variant pattern | **AC1 ✅** the enum input is on the wire · **AC2 ✅ 2026-09-10 (s6)** — the ten patterns ship as `interfaceDoctrine` on `get_project_info` · **AC3 🟡 (s6 + s7)** — four examples built, one per pattern; **the s7 remainder judged all fourteen row components and fixed the two whose own descriptions promised an action they could not perform** (`cloud-record-crud`, `data-shared-array-add-remove`), lifting publishing 21% → **26%**. Twelve were deliberately left silent: the floor is still FAIL and that is the honest reading · **AC4 open** (needs CMP-002) |
| [CMP-002](CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md) | A graded MCP build of one business landing page, with the §3 reflection run over it. The baseline arm for CMP-001 AC4 | **NEXT** — 🔴 run it in a session that has read only the brief |
| [CMP-003](CMP-003-LOGIC-COMPONENTS.md) | Logic components: correct the "when not to" rule, and give the playbook its tenth pattern | **AC1 ✅** both doctrine copies corrected · **AC2 ✅ 2026-09-10 (s6)** — P10 travels with the playbook into `interfaceDoctrine` · **AC4 ✅** the ledger column · **AC3 open** (needs CMP-002) |
| [CMP-004](CMP-004-THE-SHELF-NOBODY-IS-TOLD-ABOUT.md) | The shelf nobody is told about — put it in the order, make it searchable, make it two-way, seed it with parts | **AC1 ✅** (step 3 of THE ORDER) · **AC4 ✅** (`export_to_library`, step 4) · **AC2 ✅ s4** — `list_library({query})` · **AC3 ✅ 2026-09-10 (s5)** — three exported parts, and `size` on every row instead of a label. **AC5 open** (graded inside CMP-002) |
| [CMP-005](CMP-005-THE-DATE-FORMATTER.md) | The date formatter is eight placeholders, and the docs tell you to write JavaScript. Node or part — decide, then build | ✅ **CLOSED 2026-09-10.** AC1–AC4 (s4) — the decision, **13 new tokens**, a `Locale` port, byte-identity for the eight that shipped. **AC5 (s5)** — the exported `format-date` entry, its presets rendered through the real node, and the two date answers naming each other |
| [CMP-006](CMP-006-THE-PATTERNS-NOBODY-COULD-READ.md) | The authored `patterns`/`antiPatterns` reached the editor's panel and never the agent. Relay them | **AC1 ✅ AC2 ✅ 2026-09-11 (s8)** — `detail: "full"` relays both verbatim, armed by 5 specs over the wire and 4 control arms; the resident surface came out **3 tokens cheaper** than before the work · **AC3 open** — whether the DEFAULT should carry `antiPatterns` needs a phase-55-style replay, not a ruling |
| — | [`STUDIED-APPS.md`](STUDIED-APPS.md) | the ledger, one row per cycle |

## 6. Instruments

[`measure-interfaces.py`](measure-interfaces.py) — one script, four graph dialects, so no arm is
graded by a pass written for it. Reproduces every number in CMP-001 §2.

[`measure-logic-components.py`](measure-logic-components.py) — the CMP-003 census: which components
are logic-only, how big they are, and how often each is instantiated. Committed for the reason §6
gives and session 2 proved: **two of the four numbers in §2 row 3 could not be reproduced from the
task file**, because the pass that produced them was never committed. One was a narrower question
(LearnBook has TWO logic folders, not one) and one was simply wrong ("49 of them one node" —
0 by every whole-graph reading, 20 counting working nodes, 45 at one-or-two). See CMP-003 §2.1.

## 7. Known gaps, owner NONE

- ⚠️ **`install_prefab` never carries design-token OVERRIDES, and `export_to_library` never writes
  them.** Tokens travel by name and resolve against the installing project's theme, which is the
  behaviour CMP-004 AC4 wants — but a part built against a token project A *invented*
  (`nodegx.project.json → metadata.designTokens`) falls back to the shipped `DEFAULT_TOKENS` in
  project B rather than reporting anything. It renders; it may render the wrong colour. The export
  lists the tokens a part reads, in the response and in the generated README, which is as far as
  either side can go without deciding whose theme wins. Found 2026-09-10 building AC4.

- ✅ **CLOSED 2026-09-11 (s8) as [CMP-006](CMP-006-THE-PATTERNS-NOBODY-COULD-READ.md).**
  `get_node_type` emitted neither `patterns` nor `antiPatterns` at any detail level; `detail: "full"`
  now relays both, verbatim from the corpus. **130 of 176 types carry `patterns` and 113 carry
  `antiPatterns`** — ~14.9k tokens of authored guidance that reached only the EDITOR's node-docs
  panel, i.e. a person. 🔴 **And the reason it was not a one-line oversight: `NodeEnrichment` in
  `catalog.ts` never DECLARED `antiPatterns`**, so no copy of it could have typechecked. The gap was
  in the server's own type, not just in the copy. **AC3 is still open and needs a REPLAY, not a
  ruling**: whether the DEFAULT summary should carry `antiPatterns` too — median 36% of a summary
  payload, up to 151% on a small logic node, against AWP-005 §2's measured finding that doc volume
  was *anti*-correlated with building.

- ⚠️ **The resident tool surface has 8 tokens of headroom** (`toolDisclosure.test.ts`, budget 8280,
  measured 8272 on 2026-09-11). It had **five** before CMP-006, and CMP-006's own first wording put
  it 14 OVER. The gate was not bumped — the text was funded by naming the real response keys instead
  of paraphrasing them and by collapsing a sentence the `get_node_type` schema was paying for twice.
  **A description edit is a product change with a price**, re-sent on every turn of every session.
