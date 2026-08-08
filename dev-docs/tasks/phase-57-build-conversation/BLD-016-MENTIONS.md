# BLD-016 — `@` mentions

**Status:** 📋 not started · **Track B** · after BLD-011, BLD-007

## What it is

*"Ability to reference a project doc or specific component like an @ mention thing."* Type `@`, pick
a component, a doc, a page, a collection or an attachment, and it rides the turn as a reference.

## The precedent to reuse

FH-019 rebuilt the code editor's completions as three sources **each anchored in something real**,
and its module note is worth reading before starting — it is a catalogue of exactly how a
hand-written completion list rots
([noodl-completions.ts:1-30](../../../packages/noodl-core-ui/src/components/code-editor/noodl-completions.ts#L1)):

> *"This file used to open with a 25-element array of string literals. Everything the editor could
> ever offer was in it, it was written from memory on one day and maintained by nobody, and it was
> wrong in four separate ways at once…"*

There is also a positioning helper already solved
([completionPosition.ts](../../../packages/noodl-core-ui/src/components/code-editor/utils/completionPosition.ts))
and a second source pattern in `library-completions.ts`.

**So the composer becomes a small CodeMirror instance rather than a `TextInput`**, and the `@` menu
is the same problem with different sources. ⚠️ **Verify first** that a CM6 composer is not
disproportionate for a two-line input — if the completion machinery can be driven over a plain
textarea with the existing positioning helper, prefer that. The point is to reuse the *source shape*
and the anchoring discipline, not necessarily the editor.

## The five sources — each anchored, none hand-written

| Kind | Source of truth | Shown in the menu |
|---|---|---|
| component | `ProjectModel` components | node count |
| page | components registered in the Router | "page" |
| doc | the discovered doc set (**BLD-007**) | **whether it is already sent every turn** |
| collection | the project's backend schema | column count |
| attachment | this thread's attachments (BLD-013) | file kind |

The doc column matters more than it looks: **showing "always sent" stops a user paying twice for
CONVENTIONS.md** by mentioning something already in the always-block.

## Build

1. **`@` opens a grouped, keyboard-navigable menu** over the composer; selection inserts a token in
   the text *and* adds a `Reference` to the turn (BLD-011). The two must not be able to disagree —
   deleting the token removes the chip.
2. **A mention pre-authorises a read.** Mentioning a component means the agent gets it without
   spending a turn on `get_component`; mentioning a doc means it is fetched without a
   `get_project_doc` round-trip. **This is the real value** — it is not a typing convenience, it is a
   turn saved and a wrong guess avoided.
3. **Resolution respects the caps** (BLD-011). A mentioned 400-node component is not sent whole
   without saying so.
4. **Unresolvable mentions fail in the composer**, before send. AIB-010 already found that a
   name-typed parameter is never checked for resolving; do not add a second place where a name
   silently means nothing.

## ⚠️ Driving traps

- **A portalled select opened by `.click()` never closes**, and a text input commits on **blur/Enter
  only**. The `@` menu is a portalled popup over an input — both traps apply at once when driving it
  in live QA (BLD-010, row 14).
- HMR will not reach a mounted panel; verify with a real reload.

## Acceptance

- [ ] `@` lists all five kinds, grouped, with the deciding fact on each row.
- [ ] Keyboard: open, filter, arrow, enter, escape — no mouse required.
- [ ] Mentioning a component measurably removes a `get_component` call from the turn (compare tool
      calls before/after on a fixture run — **verify the consequence, not just the mechanism**).
- [ ] Deleting the inserted token removes the chip, and vice versa.
- [ ] A doc already in the always-block is labelled as such and is not sent twice.
- [ ] A mention that cannot resolve is refused in the composer with a reason.

## Register

| # | Finding | State |
|---|---|---|
| | | |
