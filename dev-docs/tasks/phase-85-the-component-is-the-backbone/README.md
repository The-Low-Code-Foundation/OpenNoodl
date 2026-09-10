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
shelf; `list_library` still has no query that answers *"is there a date formatter?"* (CMP-004 AC2),
and the shelf still carries no single-part entries (CMP-004 AC3). [CMP-005](CMP-005-THE-DATE-FORMATTER.md)
is the first real part to stock it with — and it is a worked example of the whole thesis: the
product's answer to "format a date as Thursday, 10 September" is currently *"write a Function node
with Intl"*, in its own documentation.

## 5. Tasks

| id | what | status |
|---|---|---|
| [CMP-001](CMP-001-THE-COMPONENT-INTERFACE-PLAYBOOK.md) | The nine interface patterns, the three grading floors, and the `States.currentState` defect that blocks the variant pattern | **AC1 ✅ 2026-09-10** — the enum input is on the wire. AC2–AC4 open |
| [CMP-002](CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md) | A graded MCP build of one business landing page, with the §3 reflection run over it. The baseline arm for CMP-001 AC4 | **NEXT** — 🔴 run it in a session that has read only the brief |
| [CMP-003](CMP-003-LOGIC-COMPONENTS.md) | Logic components: correct the "when not to" rule, and give the playbook its tenth pattern | **AC1 ✅ 2026-09-10** — both doctrine copies corrected. AC2–AC4 open |
| [CMP-004](CMP-004-THE-SHELF-NOBODY-IS-TOLD-ABOUT.md) | The shelf nobody is told about — put it in the order, make it searchable, make it two-way, seed it with parts | **AC1 ✅ 2026-09-10** (step 3 of THE ORDER) · **AC4 ✅ 2026-09-10** (`export_to_library`, step 4, graded by round trip). AC2, AC3, AC5 open — 🔴 **AC2 is now the highest leverage left**: step 4 adds entries whose value is entirely in finding them |
| [CMP-005](CMP-005-THE-DATE-FORMATTER.md) | The date formatter is eight placeholders, and the docs tell you to write JavaScript. Node or part — decide, then build | **WRITTEN 2026-09-10**, not built. AC1 is a decision, not code |
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

- 🔴 **`get_node_type` emits neither `patterns` nor `antiPatterns`, at any detail level.**
  `catalog.ts`'s `getNodeTypeDetail` copies `summary`, `description`, `whenToUse`,
  `runtimeBehavior`, `relatedNodes` and `dynamicPorts` out of the enrichment and stops. Both fields
  reach exactly one reader — the EDITOR's node-docs panel (`nodeDocs.ts:161`, "Watch out for"),
  which is a person. So every pattern and anti-pattern authored into the enrichment corpus is
  invisible to the agent doing the authoring. Found 2026-09-10 while arming CMP-001 AC1; it is not
  that AC's to fix, and it is the natural home for CMP-001 AC2's playbook if that lands per-node
  rather than as a fifth doctrine field.
