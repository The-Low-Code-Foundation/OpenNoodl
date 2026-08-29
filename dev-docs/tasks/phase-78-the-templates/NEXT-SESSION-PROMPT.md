# Phase 78 — next session

## Where it stands

**The landing page is designed, and the session found six shipped files that had never been
committed at all.** Last session's queue put the hero first; that is done, and the work underneath it
was larger than the one line suggested.

| | before | after |
|---|---|---|
| landing page content height (900px viewport) | **333px** | 741px |
| compositions on `USED_COMPOSITIONS` with **no user** | **2** (`eyebrow`, `sectionHead`) | 0 |
| gates reading `USED_COMPOSITIONS` | **0** — it claimed one in its own doc comment | 1 (§4) |
| components in the template | 21 | **22** (`Members/InsideTile`) |
| `mounted` gates | 28 | **29** |
| files in the artefact that git had never seen | **6** | 0 |
| template + appearance | 67/67 | **68/68** |
| tpl001 drives (three suites) | 51 + others | **71/71** |

✅ `typecheck:mcp` clean. ⚠️ `test:ci` **not run** — no editor source touched.

## 🔴 Read this before you touch the artefact

**Regenerating carries product-side composition changes into the template, and nobody is watching
that seam.** DEF-001 (`30eb92b2`) moved the outline button's border to `--border-control`; the
shipped template still said `--muted-foreground`, so `tpl001Template.test.ts`'s byte-identity gate
was **red at that commit** until this session regenerated. The gate works — but the person changing
a composition has no reason to run the template suite, and will not see it.

✅ Regenerate and diff **before** concluding anything about the artefact: `npm run template:members`,
then `git diff -- templates/`. A change you did not make is a product change arriving.

## 🔴 And read this before you add a second of anything to a page

**The door refuses three structurally identical sibling subtrees** — `repeated-sibling-subtree`,
naming the remedy: *"Make one component and instantiate it 3 times."* That is why the landing tiles
are `Members/InsideTile` rather than three copies. The rule is right and it fired on the first
attempt.

⚠️ **The six `info` lines that come with a component instance are not a hole.** A clean run is now
`55 × dynamic-port-skipped` **+ `6 × unknown-type-check-skipped`**; the six say the catalog-driven
*parameter values* check did not run on `/Members/InsideTile`. A dedicated check does: `titel` came
back `instance-unknown-parameter`, blocking, listing both real ports. Settled as **D21, disproved** —
do not spend the session re-deriving it. A count above 61 is yours.

## Then, in order

1. ⬜ **Seed sample content** (AC6 ships graphs, not rows — still open and additive). Every list
   renders its designed empty state, which is correct and is why the screenshots are quiet. It also
   means **nobody has yet seen the row cards with the gap added in s7**; that reading is still owed,
   and it is now the oldest unpaid one in this phase.
2. ⬜ **D18 / D19 / D20** — see below. D18 got worse and clearer this session.
3. ⬜ **Then** T5 / publishing. AC1 is ungradeable until it is on the shelf.

## 🔴 D18 is bigger than it was filed as, and it is still unowned

**It is not "forms" — it is every control, including buttons.** Measured on `Pages/Landing` with
`getComputedStyle`: the eyebrow, headline and blurb get `Source Sans Pro`; **both buttons render
`Arial`**. So the defect is on every page of every template, not only pages with a form, and it is
visible in screenshots already in this repo — nobody had looked at the *buttons*.

⚠️ **The vocabulary actively tells an agent not to fix it.** The `body` composition's description
reads *"Never set `fontFamily` — the project body already carries `var(--font-sans)`"*. True for
`Text`, false for `<button>`, `<input>` and `<textarea>`, which do not inherit it. Whatever task
takes D18 must change that description in the same breath.

🔴 **Ownership, unchanged and now overdue.** D18/D19/D20 are recorded in
[THE SWEEP](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md) but **no `DEF` task names
any of them**. D20 → DEF-006 was *agreed by both sessions* and still is not filed — grep DEF-006 for
`D20` and it is absent. D18 is ruled **not DEF-001** (a fidelity defect, not an a11y one, and the
button reading strengthens that: nothing here is illegible).

## Traps

- 🔴 **A pathspec commit does not pick up untracked files.** This is how six artefacts — including
  `tpl001Theme.ts`, the appearance ratchet, and the `Pages/Directory` and `Members/MemberRow`
  component directories — sat unversioned across two sessions that each believed they had committed
  the template. ✅ **`git status --short | grep '^??'` before you believe a commit was complete.**
- 🔴 **A drive spec can measure a word rather than a property.** `§3` asserted the absence of
  "Announcements" to mean *the members page did not render*; a new tile owning that word broke it
  while the app got better. It reads **"Sign out"** now — and `text`, not `html`, because the members
  page's chrome IS in a stranger's document unpainted. Not a leak: the load-bearing spec (no
  announcement title or body anywhere in `html`) passed throughout.
- 🔴 **`USED_COMPOSITIONS` was decoration for its whole life** — it said *"asserted by the gate"* and
  no gate read it. ✅ It is now compared against `requestedCompositions()`, recorded by
  `composition()` itself. **Grep for a reader before believing a list is enforced.**
- 🔴 **The template is GENERATED.** `tpl001Components.ts` is the source; `npm run template:members`
  **clears `templates/members-area/` wholesale**. ✅ Snapshot and `diff -r`.
  ✅ `TPL001_DIAG_DETAIL=1 npm run template:members` now prints every diagnostic individually — the
  summary line alone is a count with no location.
- 🔴 **§2 of the ratchet counts a `Group` wrapping exactly ONE `Text` as a notice and pins it at 17.**
  A tile is two Texts. A tile that lost its second would silently become an 18th notice.
- 🔴 **§3 forbids a fill on any container of a `For Each`**, and undoing it makes every other
  instrument *greener*. If §3 is in your way the answer is not to relax it.
- 🔴 **`readVisit` navigates; `readHere` does not.** Anything a click produced is gone if you navigate.
- 🔴 **`rowGap`/`columnGap` are direction-conditional** — use `laidOut(direction, params, gap)`.
- 🔴 **A parameter can be inert and the door names the fix.** `width` on a text input needs
  `sizeMode`; `borderWidth` needs a non-`none` `borderStyle`. **Read the message.**
- 🔴 **`${PIPESTATUS[0]}` is empty in zsh**, and `cmd | tail` reports **tail's** exit code.
- ⚠️ **Stay inside `--space-12`.** Only `--space-2/3/4/5/6/10/12` are proven to resolve in this
  template; `band` reaches for `--space-20` but nothing here has rendered it.
- ⚠️ **Never open `templates/members-area/` in the editor** — opening writes three files into it.
- ⚠️ `nodegx-backend` and `noodl-mcp` are **jest**, run **from the package directory**, never two
  package suites at once. `typecheck:mcp` is a **root** script.
- ⚠️ **HEAD moves under you.** Four peer commits landed mid-session here. Re-run the gates *after*
  the last one, not before.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion on every template, graded BEFORE the behaviour work, by
  looking at it.** ✅ Honoured: the page was rendered and read at 1280 and 390, both arms, before and
  after — and the "before" reading is what found the 333px.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer.
- **Publishing**: not yet. He drives it first.
