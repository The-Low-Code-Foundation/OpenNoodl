# EXP-015 — The tag the author chose

**Status:** 🟢 **BUILT, GATED AND DRIVEN — session 97, 2026-09-06.** All ten acceptance criteria
graded below. `tests/the-tag.test.ts`, 32 rows; fixture `tests/fixtures/tag-desk`; seven mutation
arms, 7/7 killed. Driven: the exported landing page went from **0 headings and 0 landmarks** to
**1 `h1`, 5 `h2`, 5 `section`, 1 `main`** — the viewer's column in §5, exactly.
⚠️ **§1 and §6 below were WRONG about the reporting and are corrected in place.**
**Owner:** P18. **Opened by:** the TPL-003 landing-pages export drive, 2026-09-06. Richard, on being
shown the finding: *"There is actually a tag selector in the text node … with h1 and span and
whatever."* There is, it is a port, and the export has never read it.
**Priority:** 🔴 High. Silent, total, and worst on exactly the artefact the export is being sold for.
**Difficulty:** 🟡 Medium — the map is a one-line change; the enum validation and the class-name and
style plumbing that assume a fixed tag are the work.

## Objective

A Text node set to `h1` exports as `<h1>`; a Group set to `section` exports as `<section>`. Today
the authored tag is discarded and every visual node comes out as the exporter's fixed default, so an
exported landing page has no headings and no landmarks at all.

## What is true today (measured 2026-09-06)

1. **The export never reads the port.** `grep "'as'"` across `packages/nodegx-export/src` returns
   **nothing**. `emit/component.ts:102` holds `TAGS`, a fixed `Record<string,string>` from node role
   to element — `group: 'div'`, `page: 'div'`, `text: 'p'`, `columns: 'div'`, `stack: 'div'` — and
   nothing consults the node's parameters. ~~The authored value is not refused, not noted, not
   counted as a translation gap.~~
   🔴 **CORRECTED 2026-09-06 (session 97), measured on the installed export.** The last sentence was
   wrong. `as` is in neither style table, so it fell out of `computeNodeStyle` as `unhandled` and was
   reported like any other unmapped parameter: **61 `parameter as on <id> has no style/content
   mapping — dropped, reported` lines**, 61 of the 91 unmapped-parameter notes on this template, all
   61 in `EXPORT-REPORT.md`, and 61 `TODO(export)` markers in the emitted components. What was
   missing was the **translation**, not the report — and the note said "no mapping", which reads as
   a gap in the exporter rather than "your headings are gone". ✅ read the notes before writing down
   what a defect is silent about.
2. **The port is real, shipped, and documented as mattering.** `nodes/visual/text.ts:47` and
   `nodes/visual/group.ts:247` both declare `as`, `group: 'Advanced HTML'`, `displayName: 'Tag'`,
   with the description *"HTML element to render as, which changes nothing visually but matters for
   screen readers and SEO"*. Text offers `div h1 h2 h3 h4 h5 h6 p span`; Group offers
   `div section article aside nav header footer main span`. Both default to `div`.
3. **The runtime honours it in two lines.** `components/visual/Text/Text.tsx:46` —
   `const Component = (props.as || 'div')`. `components/visual/Group/Group.tsx:302` —
   `const { as = 'div', ...props } = this.props`. So the value reaches the DOM.
4. **The template sets it 61 times**, and the export loses all 61. Across
   `templates/landing-pages`: `section` ×15, `span` ×17, `h2` ×17, `h3` ×4, `h1` ×3, `main` ×3,
   `header` ×1, `footer` ×1.
5. **Measured on one page, both renderers, same project directory:**

   | element | NodeGX viewer | exported React |
   |---|---|---|
   | `h1` | 1 | 0 |
   | `h2` | 5 | 0 |
   | `section` | 5 | 0 |
   | `main` | 1 | 0 |
   | `div` | 132 | 76 |

   The exported page has **no heading of any level and no landmark of any kind**. A screen reader
   gets no heading navigation and no regions; a crawler gets no `h1`.
6. ~~**The refusal reporting is silent here, and that is its own defect.**~~
   🔴 **CORRECTED 2026-09-06 (session 97).** It was in both. See the correction under §1: 61 notes,
   61 report lines, 61 in-code markers. The defect in the *reporting* was narrower and real — the
   sentence was `has no style/content mapping`, which does not tell a person their document
   structure was flattened. Session 97 replaced it with a named refusal that says what happened and
   what the element stayed.
7. ⚠️ **The existing decision this reverses.** `EXP-002-TARGET-OUTPUT.md:508` records *"Semantic
   HTML | Not guessed deterministically; `<div>`/`<p>` with authored class names"*. That is correct
   about **guessing** and was written before the `as` port existed. Nothing here guesses: the author
   picked the tag from an enum. Update that row rather than leaving two documents disagreeing.

## Acceptance criteria

1. ✅ **The authored tag wins.** `TAGS[role]` becomes the default, overridden by the node's `as`
   parameter where one is set. A Text with `as: 'h1'` emits `<h1>`; a Group with `as: 'section'`
   emits `<section>`; a node with no `as` is byte-identical to today's output. That last clause is
   the regression guard for the whole corpus.
2. ✅ **The value is validated against the port's own enum, per node type, from the catalog** —
   never a second hand-written list (`a-second-copy-of-a-palette-drifts-silently`). A value outside
   the enum falls back to the default **and is reported**, because a silently ignored authored value
   is the defect this task exists to fix.
3. ✅ **Nothing else keys off the tag.** Class-name assignment, the style fold, event binding and
   the `Columns`/`Stack`/`Drag` wrappers must behave identically whatever the element is. Grade a
   Group as `section`, `nav` and `main` and assert the emitted CSS and props are unchanged from the
   `div` arm — the tag is the only difference.
4. ✅ **Void and self-closing elements are refused, not emitted.** The enums cannot currently reach
   one, so this is a guard with a spec rather than a live path: an `as` naming an element that
   cannot take children falls back and reports.
5. ✅ **The exported page carries the structure.** On the landing-pages template, the exported app
   matches §5's viewer column: **1 `h1`, 5 `h2`, 5 `section`, 1 `main`**. Assert the counts, not
   just presence — a rule that emitted `h1` for every heading would pass a presence check and be
   wrong.
6. ✅ **Heading order is preserved, not invented.** The export emits what the author set. If the
   authored order skips a level the export reproduces it and does not renumber. Out of scope here:
   warning about the skip. Say so in the report copy if it is cheap; do not build a linter.
7. ✅ **Gates.** `nodegx-export` tsc 0 and jest green; the whole-package run as the pin sweep, since
   every emitted-component fixture that contains an `as` will move; editor tsc 0;
   `export-ledger:check` OK; picker floor unchanged.
8. ✅ **Driven.** Export, build, serve, and count the elements in the running app rather than in the
   emitted source — `verify-the-consequence-not-just-the-mechanism`, and a source-text assertion
   would pass on a tag that React never renders.
9. ✅ **The ledger note is corrected.** `coverage-ledger.json`'s `Group` entry reads
   `status: translated, note: "flex group → div"` — the arrow is exactly the behaviour being fixed.
   Update it and `Text`'s to say the authored tag is honoured with `div`/`p` as the default.
   `export-ledger:check` stays OK.
10. ✅ **The contradicting document is corrected.** `EXP-002-TARGET-OUTPUT.md:508` still reads
   *"Semantic HTML | Not guessed deterministically; `<div>`/`<p>` with authored class names"*.
   Rewrite that row to say the authored tag is honoured and only an **absent** one defaults. Two
   documents disagreeing about the same behaviour is how this gets rediscovered at full price.

## What was built — session 97, 2026-09-06

**Shape.** `emit/component.ts` gained `authoredTag(node, fallback, catalog)`, exported and pure so
the spec grades it directly, plus a `tagOf(id, role)` closure that calls it for the node and — where
the node is a page div with a collapsed Group — for the collapsed Group after it. `TAGS[role]`
became the default rather than the answer. Validation reads `CatalogIndex.enumValues(type, 'as')`,
new, which returns the port's own enum from the catalog artifact; **no list of elements is written
anywhere in this package**. `as` joined `CONSUMED` in `style.ts`, which is what removes the 61 notes.

**Three ways to be told no, in this order**, each reported as a note *and* as an in-code marker
through the existing `defer` channel (EXP-013's rule: said where the node is placed):

1. a **void element** — checked FIRST and without consulting the catalog, so it is a real outer gate
   rather than dead code behind the enum test. Neither shipped enum contains one, which the spec
   also asserts; the whole point of the guard is the day one does.
2. a node type the catalog gives **no Tag port** (`Page`, and anything else a tool writes it onto) —
   the export has no authority to invent an element for a port it cannot validate.
3. a value **outside the port's enum**, with the options named in the sentence.

🔴 **The page collapse was the case worth building for.** A Page whose sole visual child is a Group
renders as one element carrying both nodes' parameters, so a Group set to `main` sitting directly
under a Page — the single most likely place an author puts a landmark — is exactly where the tag
would have been lost. `tag-desk`'s page is built that way and §F grades it.

**The grading (AC5, AC8), in the running app, both arms.** The reverted arm is a real
`git worktree add --detach HEAD` export, built and served beside the fixed one, counted with
`document.querySelectorAll` rather than in the emitted source:

| `templates/landing-pages` installed, `/freelancer` at 1280px | viewer (§5) | export before | export after |
|---|---|---|---|
| `h1` | 1 | **0** | **1** |
| `h2` | 5 | **0** | **5** |
| `section` | 5 | **0** | **5** |
| `main` | 1 | **0** | **1** |
| `header` / `footer` | — | 0 / 0 | 1 / 1 |
| `div` | 132 | 76 | **68** |

The `div` row is the conservation check: 68 + 1 `main` + 5 `section` + 1 `header` + 1 `footer` = 76.
Nothing was added or lost; eight divs became the elements the author chose. The viewer column is
§5's own reading, taken before this task started — three renderers now agree.

**Refusals.** 91 unmapped-parameter notes → **21**; the 61 `as` notes and EXP-014's 9 are gone and
**no new note takes their place** (the two note sets diffed, normalised for ids: zero additions).

**Gates.** `nodegx-export` jest 83 files / 3126 rows exit 0 · package `tsc` 0 · editor `tsc` exit 0,
empty log · `export-ledger:check` OK 176/124 · **picker 117/127 unchanged** · editor `test:ci` 2943
specs, 4 failures = the floor by name (AIX-006 ×4, seed 61662).

⚠️ **A note for whoever reads `TAGS` next.** `text: 'p'` is *not* the port's own default, which is
`div` for both node types. It is what this exporter has always emitted for an untagged Text, and
AC1's byte-identical clause is why it stays. So an untagged Text renders `<p>` here and `<div>` in
the viewer — a pre-existing divergence this task deliberately did not change, and the one place the
two renderers still disagree about an element name.

## Not in scope

- Guessing a tag for a node whose author set none. The default stays `div`/`p`.
- The `<a>` element. `text.ts` has it commented out in the enum; leave it commented.
- Any accessibility work beyond the element name — no ARIA, no landmarks the author did not ask for.
- The ground the heading sits on ([EXP-014](./EXP-014-THE-GROUND-THE-HEADLINE-SITS-ON.md)) and the
  typeface ([EXP-016](./EXP-016-THE-TYPEFACE-THAT-SHIPS-UNUSED.md)).

## 🔴 Fixture warning

Same as EXP-014's: export an **installed** project, not `templates/landing-pages/` itself. It does
not change this task's numbers — the parameter drops were byte-identical across both arms — but it
changes the images and the icon set, and a session that exports the bare template will spend its
first hour on findings that are not real.
