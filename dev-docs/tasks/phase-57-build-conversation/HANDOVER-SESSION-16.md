# Phase 57 — handover after session 16 (2026-08-10)

**What ran:** **BLD-016 built and driven, end to end, with no billed call.**

**Phase 57 is now 13 of 17 fully built, plus BLD-014's webview half.** Counted off the tables in
`TASKS.md`, not incremented: Track A 9 of 11, Track B 4 of 6 plus a half.

## 🔴 The finding worth more than the task

> **An acceptance criterion decided the architecture, and it was right.**

*"Deleting the inserted token removes the chip, and vice versa."* The obvious build cannot satisfy
that: picking from the menu inserts a token **and** attaches a reference, which is two writes to two
stores, and keeping them equal needs a third mechanism that nobody maintains and that `tsc` cannot
check. Every "and vice versa" bug in that design is a missing edge in a graph of updates.

So the composer text became the **single source of truth** and the chip row is derived from it:
`reconcileMentions(text, candidates, attached)` runs over the whole text on every change, and both
directions fall out of one pure function. **The menu inserts text and attaches nothing.** The chip's
Remove button deletes text and detaches nothing.

Two things came free that were not free in the other design:

- **Typing a mention works.** That is the AIB-010 half of the task — a name typed rather than picked
  must not silently mean nothing — and under this design it *cannot*, because every `@` token in the
  text is either resolved into a chip or refused by name.
- **There is no reconciliation code to write.** The chip row cannot lag the text, because it is not
  a second copy of anything.

### ⚠️ The interaction inside it that a refactor will break

`attach` respects the *settled* rule — a token still under the caret is never read, or typing
`@Pages/Home` one character at a time would accuse the user of six mistakes on the way to one name.
`detach` does **not** respect it. They look like they should agree and they must not: if `detach`
also ignored unsettled tokens, deleting the space after a finished mention would drop its chip while
the token was still every character it had been — the row disagreeing with the text it was derived
from, which is the one state this whole design exists to make unreachable.

Driven, all four states: edit the name → chip goes; restore → chip returns on its own; delete only
the trailing space → **chip stays**; click Remove → the token leaves the text. Pinned as specs, and
the specs were inverted before they were trusted (3 inversions, 4 tests red).

## 🔴 BLD-011's union carried a default nobody had measured

`REFERENCE_CAPS.page` was **12,000**. BLD-011 declared the whole `ReferenceKind` union up front so
the chip row, the caps, the meter, the carry-over rule and the persistence format would be written
once — and that bet paid off completely: this task changed **none** of them. It added three readers,
one constant and a hook.

What it did not buy was the *values*. `page` was declared next to `doc` and inherited a doc-sized
cap, while a page's payload is a **component's** v2 serialization. Every mentioned page would have
been cut to half a graph, silently, with the truncation notice as the only evidence.

> **A member declared ahead of its task is a default nobody measured.** The shape generalises; the
> numbers do not.

Raised to 24,000, with a spec asserting `page === component` rather than asserting `24_000`, so the
next change to either moves both.

## ⚠️ A near-miss, and the third of this shape in two sessions

The first contrast sweep reported **4.58 in light** for the refusal line. I nearly filed it. It was
the **danger icon** — a graphical object at a 3:1 threshold — because `refusalRow.querySelector('span')`
grabs the first span and the icon is first. The sentence measures **7.70 dark / 7.10 light**, the
best numbers in that row, which is exactly what the glyph-carries-the-alarm / text-carries-the-words
split was for.

Session 15's phantom 71px overflow was the same error in a different dimension.

> **Measure the element you are making a claim about, and print what you measured.** A ratio with no
> `fg`/`bg` hex beside it is a number you cannot check.

## The five sources, and the one that saves money

| Kind | Anchored in | The row says |
|---|---|---|
| component | `ProjectModel` | node count |
| page | **the Router that lists it** — registration, not a folder name | which router, and whether it is the start page |
| doc | the discovered doc set (BLD-007) | **whether it is already sent every turn** |
| collection | the project's schema cache | column count |
| attachment | this thread's chip row | file kind |

⚠️ **The doc column is not cosmetic.** `CONVENTIONS.md` and `BRIEF.md` default to `inject: always`,
so their bodies are already in the authoring prompt's **cache-stable half**. BLD-011's picker
attached the body again — after the boundary, where it is the expensive copy. A mention (or an
attach) of an always-sent doc now resolves to a **pointer**: measured **290 characters against a
3,089-character file**, saved on every authoring turn of every operation.

⚠️ The pointer's wording is *"part of this project's standing context"*, deliberately not "above":
the always-block is in the **authoring** turn, and the **planning** turn gets only `docsOverview`
with character counts and no bodies. "Above" would be a lie on one of the two.

## What was measured (driven against `ai-test`, no billed call)

| | result |
|---|---|
| menu, first open | 4 groups, 7 rows, **340px** in a 364px composer, nothing clipped |
| control row, menu open vs shut | **0px difference** at 248 / 340 / 400 / 800 — the list is out of flow |
| horizontal overflow, 248 → 800px | **0** for the row, the composer and `document.body` |
| keyboard | `@` opens on row 0 · ArrowDown ×2 · ArrowUp · Enter inserted `@Pages/Home ` and closed it |
| a mentioned page | **4.8k characters** — graph plus routing lines, well under the raised 24k cap |
| an always-sent doc | **290** characters against **3,089** |
| the fifth kind | pasted `brief.md` → `Attachments` group → picked → token inserted, **no second chip** |
| refusal | `@Chekcout — Nothing in this project is called Chekcout.`, Send **disabled** |
| `Not a mention` | refusal cleared, Send re-enabled, **prose untouched** |
| refusal sentence, dark / light | **7.70 / 7.10** |
| `Not a mention`, active menu row + its note | **6.66 / 6.54** each, plus POL-016's inset ring |
| new state classes | `.Item.is-active`, `.MentionRefusal`, `.MentionDismiss` — all real selectors |
| the Add-context picker | same list, same notes, **no duplicate rows**, 340px, nothing clipped |

## What was NOT driven — stated, not implied

- 🔴 **The `get_component` criterion is the one that is not met.** The mechanism is built and pinned
  — `renderReferenceBlock` emits *"The components and pages below are here in full — do not call
  get_component for any of them"* whenever a component or page rides the turn, and a spec holds a
  doc-only turn byte-identical to BLD-011's block. But the criterion says to **compare tool calls
  before and after on a fixture run**, and that needs a billed call. **Filed to BLD-010.** It is the
  criterion's own instruction, and this phase has already paid twice for accepting a mechanism as a
  consequence.
- ⚠️ **The `collection` leg has never met a real schema.** `ai-test` has no backend, so the group
  correctly did not render. ⚠️ Its failure mode is stated rather than tested: `projectSchemaCollections`
  returns empty for *"could not look"* as well as *"nothing there"*, so a **stopped** backend
  silently offers no collections to mention.
- ⚠️ **Drag-and-drop is still undriven** (inherited from BLD-013). Paste was driven again here, as
  the way to get a real attachment onto the row for the fifth mention kind.
- ⚠️ **A space-named component was never mentioned live.** The quoted token form
  (`@"My Cart Widget"`) is specced in both directions but `ai-test` has no such name.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **108 suites, 1491 tests**, zero failures |
| `test:ci` | **`Jasmine: 2632 specs, 6 failures (failed). Randomized with seed 91127.`** — the documented six, matched **by name** |

⚠️ **The recorded `test:main` baseline was wrong, and the arithmetic is how I found out.** Session 15
recorded 106/1448 (its commit message said 1447). Running everything *except* my two new suites
today returns **106 suites / 1452 tests**. So the delta here is exactly **+2 suites / +39 tests**,
and the previous number was short by four. **Measure the baseline, do not inherit it** — one command
(`npx jest --testPathIgnorePatterns "/node_modules/" "tests-unit/bld-016"`) settles it.

✅ **My `test:ci` run returned exactly 6, which is consistent with the sibling's correction landed in
`4f1fb213`**: the baseline is a **floor** of 6, not exactly 6, because an order-dependent BEN-001
trio can push it to 9 at some seeds. Mine did not come up at 91127.

⚠️ The dev stack was down for `test:ci` and stopped again after the drive. Nothing is running.

## Concurrency

A sibling **was live at session start** — an `Electron test.js --ci` begun at 18:01 — so no gate and
no launch happened until it cleared. That is worth carrying: `ps aux | grep "[e]lectron/dist"`
answered the question in one call, and running `test:ci` beside theirs would have made both invent
failures.

They then committed `4f1fb213` (phase-57 `HANDOVER-SESSION-15.md` + `NEXT-SESSION-PROMPT.md`, plus
phases 59–61) **into this phase's directory** while I was working. Checked before committing: they
did not touch `TASKS.md` or `BLD-016-MENTIONS.md`, so nothing was overwritten in either direction.
⚠️ **The two phase-57 files that looked like inherited uncommitted litter at session start were
theirs and have now landed** — the "leave it alone" set is smaller than the last three handovers
said, and that is the second time a self-perpetuating leave-it-alone list has been wrong.

Their inherited uncommitted set is otherwise unchanged: the two `code-editor/` files, the `Launcher/`
files, `hello-world.template.ts`, `ProjectsPage.tsx`, `ExtractToComponent.ts`, `EditorClipboard.ts`,
`useComponentActions.ts`, three `tests/` files and the four untracked `ExtractToComponentPopup`/spec
files. **Leave them.**

Every commit here was pathspec-scoped, verified with `git show --stat` before moving on. No
`git add -A`, no `git stash`. The pre-existing `stash@{0}` was not touched and still wants
identifying.

⚠️ **The `ai-test` fixture was not modified.** Everything was constructed in the renderer's memory —
one pasted `File` and some composer text. `project.json` was never written, no `docs/` file was
created or removed, and the composer and chip row were emptied at the end of the drive.

## What to do next

1. **BLD-015 (web search)** is now the cheapest remaining feature and is the same shape one more
   time: a kind, a resolver, a glyph. It still needs Q4 (which backend) answered first.
2. **BLD-014's CDP half** — unblocked since F22. Only the transport is missing: a `Page.navigate`
   entry point and the viewport vocabulary `DEFAULT_VIEWPORTS` already exports. ⚠️ A URL capture is
   a network egress, and build item 7 says to say so before the first one.
3. **BLD-009 (expanded mode)** is the last unbuilt *feature*, and closes D10.
4. **BLD-010's list is now eleven.** BLD-004's R4 and R5; BLD-006's R12; BLD-017's F2 and F4;
   BLD-008's drafting turns + restart-resume; BLD-011's R9; BLD-013's drag-and-drop and file-picker
   paths; BLD-014's on-screen staleness; and new here — **BLD-016's `get_component` consequence
   (needs one billed call)** and **its collection leg (needs a project with a backend)**.
5. **The design-system row is unchanged at four.** This session added no call-site override.

## Driving this panel — what session 16 adds

- ⚠️ **A controlled `TextArea` cannot be driven with `el.value = …`.** React's controlled input
  ignores it. Use the native setter and dispatch `input`:
  `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el, v)` then
  `el.dispatchEvent(new Event('input',{bubbles:true}))`. Caret moves want a `select` event; keys
  want `new KeyboardEvent('keydown',{key,bubbles:true})`. All of it reaches the real handlers.
- **The whole of BLD-016 is driveable with no billed call**, including the fifth mention kind —
  paste a `File` through a `DataTransfer` (BLD-013's path) to get a real attachment on the row.
- ⚠️ **A menu row must be picked with `mousedown`, not `click`.** The menu closes when the caret
  leaves the mention, and a click blurs the text area first — so a `click` lands on a menu that has
  already decided it is shut. The component prevents the default on `mousedown` for the same reason.
- ⚠️ **Compare open against shut at the same width** when claiming a popup costs no layout. "The row
  is 30px" is not the claim; "the row is identical with the menu up" is, and it needs both readings.
