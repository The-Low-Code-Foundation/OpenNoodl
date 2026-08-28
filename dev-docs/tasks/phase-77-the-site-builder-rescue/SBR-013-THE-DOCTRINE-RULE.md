# SBR-013 — The doctrine rule

**The root-cause fix.** Eighteen honest tasks produced an unusable app because no acceptance
criterion was ever written from the user's side of the screen, and nothing in the MCP's
guidance asks for a design before a graph. 🧭 Richard extended the rule beyond this template:
*"the MCPs should follow that rule too."* This is the task that stops the next template
arriving the same way.

## 1. The person sentence

**The next person (or agent) who builds an app through the door is told to establish the token
set and the screens before authoring components — and every template task file they write
carries a sentence a person could verify.**

## 2. Scope

- **MCP authoring doctrine**: the project-server instructions and the authoring-order guidance
  ("THE ORDER, FOR ANYTHING BIGGER THAN A TWO-NODE FIX") gain the design-first steps: settle
  tokens (get_style_vocabulary / set_project_tokens), sketch the screens, THEN plan components.
  Style-from-tokens is already taught; the *ordering* and the *screens-before-components* rule
  are not.
  ⚠️ `instructions` are fixed at `initialize` and the tool surface has **three token-budget
  gates** — measure the addition on the wire, not in the source.
- **The task template** (dev-docs conventions): a required "person sentence" acceptance
  criterion. Add it where task files are actually seeded from (find the template/checklist that
  exists rather than inventing a new doc nobody reads — and if none exists, the phase README
  convention is the carrier).
- **The lesson content**: if the authoring brief / lessons surface (`lessons/authoringBrief.ts`)
  teaches component-first, correct it to design-first.

## 3. Acceptance criteria

1. The doctrine text ships on the wire within budget (measured — the budget gate stays green,
   and the measurement is quoted in the task file).
2. A cold authoring session against a fresh project, asked to "build a small site", is
   observably steered: its first tool calls include the style vocabulary before the first
   `create_component` (drive one session and read the transcript — the consequence, not the
   text).
3. The task-template change exists and phase-77's own files already comply (this phase is the
   first consumer of its own rule).

## 4. Traps

- 🔴 A ruling names a place; ruling ≠ checking it — grep for every seam where authoring
  guidance is emitted (instructions, tool descriptions, briefs, lessons) before declaring the
  doctrine landed; an instruction added in one of three surfaces is a third of a rule.
