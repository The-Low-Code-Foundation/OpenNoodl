# SPR-002: Schema edit and Search legibility

| Field | Value |
|-------|-------|
| **ID** | SPR-002 |
| **Phase** | 54 — The alpha driving sprint |
| **Tier** | 2 |
| **Findings** | F88, F89 |
| **Measured** | 2026-08-06 against `91fcd680` |
| **Branch** | commit directly to `cline-dev` |

## §1 — F88: the schema manager's edit button does nothing 🔴

**Richard:**

> *"The edit button in the SQLite backend schema page on already created tables doesn't
> work, click but no reaction."*

**Status: reported, not reproduced.** This is the one finding in phase 54 whose mechanism
was not established on 2026-08-06 — the editor stack was stopped before it could be
driven, and no schema-manager edit handler was located by inspection.

Start at `packages/noodl-editor/src/editor/src/views/panels/schemamanager/`.

⚠️ **Reproduce before reading code.** "Click, no reaction" has at least four causes that
look identical on screen and need different fixes:

1. no handler bound to the button at all;
2. a handler that throws — **check the console first**, it costs one look;
3. a handler that opens a dialog which renders behind or off-screen (this repo has that
   defect class already: *"a click can land outside the panel that owns the button"*,
   POL-014, and F94 in this same phase is an occlusion bug);
4. a handler that is a no-op **only for already-created tables** — which is what
   Richard's wording points at. He specified *"on already created tables"*, which
   implies new-table editing works. **That asymmetry is the strongest clue in the
   report**; if it holds, the bug is in the populated/edit branch, not the button.

Drive it: create a table, add a column, save, then press edit on the saved table. Note
whether the console shows anything, and whether a dialog element enters the DOM.

## §2 — F89: the Search page is unreadable to a non-programmer

**Richard:**

> *"Nobody who's not a programmer will understand the 'Search' page on the SQLite
> database, I don't even know what it means. More explanation on this page to help
> non-coders please"*

Where: `packages/noodl-editor/src/editor/src/views/panels/search-panel/` (and
`.../search/` — confirm which one is the backend's Search page before editing; there are
two and they are not the same surface).

The feature behind it is BAK-008, full-text search. The page presumably asks which
columns are indexed for FTS, in the vocabulary of the person who implemented it.

**What "more explanation" should mean here** — the standard this repo already meets
elsewhere and this page does not. Compare the Permissions panel's own help text, which
Richard did *not* complain about:

> *"Who may call each function, and how often. Every function has a rule whether or not
> anyone set one … Limits are on top of the shared budget for all functions (600/min,
> burst 200), so a number here can only tighten."*

That paragraph works because it says **what the thing is for**, **what happens if you do
nothing**, and **what the numbers mean in consequences**. Write the Search page to that
standard:

- what search is for, in the words of someone building an app ("let your users find
  things by typing words, instead of matching a field exactly");
- what happens with nothing configured;
- what a user's app can then do that it could not before — **and which node does it**,
  because a settings page that does not name the node it enables is a dead end;
- the cost, if any, of turning it on.

**Do not** write a glossary of FTS terms. The complaint is not that the words are
undefined, it is that the page never says why anyone would come here.

## Acceptance criteria

1. F88 reproduced, mechanism named at file:line, fixed, and driven in a real editor —
   including the new-table path, to confirm the asymmetry.
2. The Search page explains itself to someone who does not know what an index is, and
   names the node that consumes it.
3. Both checked in **both themes**.

## Note on tier

These are tier 2 because neither blocks the alpha on its own: F88 has an admin-UI
fallback (the backend's own `admin/ui/index.html`), and F89 is copy. They are in this
phase because they were found in the same hour and a second sweep costs more than
finishing this one.
