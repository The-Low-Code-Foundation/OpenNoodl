# Phase 78 — next session

## Where it stands

**The members' area has a look now, and building it turned up three product defects that no gate in
this repo can see.** Last session's prompt put "the remaining bare surfaces" at the top of the
queue. That is done. It was bigger than the one line suggested.

| | before | after |
|---|---|---|
| `Text` nodes with **no size and no colour** | **31 of 45** | **0** |
| cards in the whole app | 4 (the repeater rows) | 4 rows + **17 notice boxes** + 5 panels |
| gap between two announcement cards | **0px — borders touching** | `--space-4` |
| `Pages/SignIn` refusal | **ungated**, always mounted | gated on `login.failure` |
| drive suite | 47 | **51** |
| `tpl001Template.test.ts` | 42 | **45** (three new ratchet rows) |

✅ Gates on the finished tree: template + appearance **67/67**, drive **51/51**, `typecheck` and
`typecheck:mcp` both clean. ⚠️ `test:ci` **not run** — no editor source was touched.

## 🔴 Read this before you change anything about a notice

**A notice is a `Group` wrapping one `Text`, and the `Group` keeps the notice's id.** That is not
cosmetic bookkeeping — it is why this change moved **zero** `mounted` connections. `Text` cannot
carry a surface (the vocabulary is explicit: `Group` carries fills, `Text` carries the type ramp),
so every notice needed a wrapper; had the wrapper taken a new id, twenty `mounted` wires would have
been repointed by hand and one missed wire is a card that never hides.

Only **two** connections in the whole template changed, both because their `text` is wired and the
port lives on the inner node: `Pages/Setup`'s `missing` → `missingText`, `Pages/SignIn`'s `error`
→ `errorText`.

✅ `notice(id, label, parent, text, { tone })` in `tpl001Components.ts` is the only way to make one.
Tones are `neutral` (empty states, "not a moderator"), `accent` (pending, request received) and
`refused` (genuine failures). Every pair is measured — 6.62, 6.45 and 5.96 against the surface it
actually lands on.

## 🔴 And read this before you "improve" a list

**§3 of the new ratchet forbids a fill on any container of a `For Each`, and it is the one rule here
that breaks the wrong way.** `card` fills with `--surface` and the row cards fill with `--surface`,
so wrapping a list in a card makes the row edges measure **1.26:1** against their own container and
the list stops reading as separate cards.

⚠️ **The mistake makes every other instrument greener.** Measured, not assumed: with the fill added,
`templateAppearance.test.ts` **passed** — the colour count went up, a structural parameter was
added, and §2 was satisfied. Only §3 went red. If you find §3 in your way, the answer is not to
relax it.

## Then, in order

1. ⬜ **The landing page hero.** `H_HERO` is wired and the page is still a name, a blurb and two
   buttons. It is the one page a stranger sees, and it is now the least designed screen in the
   template — everything around it moved. ⚠️ It renders empty without a backend, so look at it with
   one.
2. ⬜ **Seed sample content** (AC6 ships graphs, not rows — still open and additive). Every list
   renders its designed empty state, which is correct and is why the screenshots are quiet. It also
   means **nobody has yet seen the row cards with the new gap in them**; that reading is owed.
3. ⬜ **D18 / D19 / D20** — the three product defects below. D18 is one line of CSS and is on the
   first screen a person fills in.
4. ⬜ **Then** T5 / publishing. AC1 is ungradeable until it is on the shelf.

## 🔴 The three product defects, all found by looking at a screenshot

Recorded in [DEFECTS-THE-TEMPLATES-FOUND.md](DEFECTS-THE-TEMPLATES-FOUND.md). Richard, today:
*"Part of the main objective of creating this template is to uncover bugs a builder might experience
using NodeGX and fix them."* These are that, and **not one of them is visible to any gate** — 45
byte-identity specs, 51 drive specs, the appearance ratchet and two typechecks are all green over
all three.

- **D18 🔴 Form controls ignore `--font-sans`.** Measured with `getComputedStyle` on `Pages/Setup`:
  the `<label>` gets the project's font, the `<input>` renders **Arial** and the same node with
  `type: 'textArea'` renders **monospace**. Those are UA defaults — nothing sets `font-family` on
  form controls at all. Every form in every NodeGX app is in a typeface the app does not use, and
  any multi-line field looks like a code editor. ⚠️ **Not fixable from a template**: there is no
  `fontFamily` among the parameters the door accepts for that node.
- **D19 ⚠️ A control's label is pure `#000`,** not `--foreground`, while the input's own text beside
  it is correctly tokenised. Same family, smaller.
- **D20 🔴 The vocabulary has 18 compositions and none for a field, a notice, or an empty state.**
  This is the *mechanism* behind D10 rather than a separate complaint: a generator told to style
  on-system looks for the element in front of it, finds nothing, and writes bare text. ⚠️ The
  non-obvious half: a composition names parameters for **one** node, and a notice is inherently two
  (`Group` + `Text`), so the vocabulary has no way to express the pattern even in principle.

## Traps

- 🔴 **`readVisit` navigates; `readHere` does not.** Anything a click produced is gone if you
  navigate. The new §1b sign-in arm depends on this, exactly as §7's D14 arm does.
- 🔴 **The template is GENERATED.** `tpl001Components.ts` is the source; `npm run template:members`
  **clears `templates/members-area/` wholesale**. ✅ Snapshot and `diff -r` after regenerating.
- 🔴 **`rowGap` and `columnGap` are direction-conditional** (`group.ts:473-482`), so the wrong one
  of the pair is a parameter the runtime never reads. `laidOut(direction, params, gap)` carries only
  the one that direction reads — use it rather than spreading `PANEL` onto a row.
- 🔴 **A parameter can be inert and the door refuses and names the fix.** `width` on a text input
  needs `sizeMode`; `borderWidth` needs a `borderStyle` that is not `none`. **Read the message.**
  ✅ A clean generation run reports `55 × info dynamic-port-skipped` and nothing else — a warning
  count above that is yours.
- 🔴 **`${PIPESTATUS[0]}` is empty in zsh**, and `cmd | tail` reports **tail's** exit code. Redirect
  to a file and read `$?`.
- 🔴 **The compositions are looked up, never typed.** `composition(id)` throws on an unknown id.
- ⚠️ **Order matters**: preset first, project tokens second. `set_style_preset` **clears** the token
  block.
- ⚠️ **Never open `templates/members-area/` in the editor** — opening writes `.gitignore`,
  `.mcp.json` and `CLAUDE.md` into it. Copy it first; the render harness above works on a copy.
- ⚠️ `nodegx-backend` and `noodl-mcp` are **jest**, run **from the package directory**, and never
  two package suites at once.
- Shared checkout: commit **by pathspec**, untracked ⇒ add+commit in one chain.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion on every template, graded BEFORE the behaviour work, by
  looking at it.** ✅ Honoured this session: the change was rendered and read with
  `getComputedStyle`, which is how all three defects above were found.
- **Templates exist to surface product defects** — bugs found while building go in this prompt as
  work.
- **Privacy**: `requestAccess` keeps the non-answer. ⚠️ The setup form's message names a blank box
  in the browser and never reaches the server; *wrong token* and *already set up* remain
  indistinguishable.
- **Publishing**: not yet. He drives it first.

## ⚠️ Housekeeping carried in this session's commit

- A peer added a five-line cross-link block to `DEFECTS-THE-TEMPLATES-FOUND.md` pointing at phase
  77's sibling register, and deliberately left it uncommitted so a pathspec commit would not sweep
  the ~361 uncommitted insertions in that file. It rides along here.
- **Phase 78 had two different defects both numbered D10.** The second (*"applying a preset alone
  changes nothing"*) is now **D17**, with a note saying so. Every existing "D10" reference means the
  first one — the generators bypassing the design system — and still resolves correctly.
- ✅ **The register now opens with a table carrying an owner for all 20 rows**, mapped to
  [phase 80](../phase-80-the-defects-the-templates-found/TASKS.md), which was created the same day
  from a three-register sweep. ⚠️ The `status` column is **as recorded, not re-measured at HEAD** —
  only the 08-29 rows were measured today, and a re-measure of the rest is owed.
- 🔴 **Two things a next session must not trip over.** (1) Phase 80 calls this file's **D10**
  **`D10a`** — the sweep disambiguated the duplicate at the same time this file renumbered the other
  half to D17, so there are two fixes for one problem. Same row, two names; the register says so in
  both directions, and **one of the two files should be made to match the other**. (2) **D18/D19/D20
  are unowned.** D20 is a clean fit for DEF-006. **D18/D19 are not a clean fit for DEF-001** — that
  task is scoped to accessibility, and D18 is a *fidelity* defect, not an a11y one. Filing them
  there without a re-measure would put a typography bug inside an accessibility task.
