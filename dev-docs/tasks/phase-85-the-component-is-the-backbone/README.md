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
| 3 | 🔴 *"A single node… is not a component — a file and a hop that bought nothing"* | LearnBook's `/Global logical components/`: **37 components, 107 instantiations**, `Format full name` **9×**, `Is Trainer check` **9×**. Prefabs: **80** logic-only components, **49** of them one node | CMP-003 |
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
⚠️ It reads the **GitHub checkout** — until this folder is committed and pushed, it can only report
"still uncommitted".

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

🔴 **And the loop only compounds if the shelf is two-way (CMP-004).** Without it, every cycle
improves the *doctrine* and every agent still builds every part from scratch. With it, one good
`Sanitise email` is written once and reached for by everyone after. That is the Tailwind bargain,
and it is the difference between the MCP getting better advice and the MCP getting better parts.

## 5. Tasks

| id | what | status |
|---|---|---|
| [CMP-001](CMP-001-THE-COMPONENT-INTERFACE-PLAYBOOK.md) | The nine interface patterns, the three grading floors, and the `States.currentState` defect that blocks the variant pattern | **OPEN** — written 2026-09-09, not built |
| [CMP-002](CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md) | A graded MCP build of one business landing page, with the §3 reflection run over it. The baseline arm for CMP-001 AC4 | **NEXT** — 🔴 run it in a session that has read only the brief |
| CMP-003 | Logic components: correct the "when not to" rule, and give the playbook its tenth pattern | **OPEN** — measured, not written |
| [CMP-004](CMP-004-THE-SHELF-NOBODY-IS-TOLD-ABOUT.md) | The shelf nobody is told about — put it in the order, make it searchable, make it two-way, seed it with parts | **OPEN** — 🔴 highest leverage in the phase |
| — | [`STUDIED-APPS.md`](STUDIED-APPS.md) | the ledger, one row per cycle |

## 6. Instrument

[`measure-interfaces.py`](measure-interfaces.py) — one script, four graph dialects, so no arm is
graded by a pass written for it. Reproduces every number in CMP-001 §2.
