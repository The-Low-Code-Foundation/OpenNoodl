# BLD-016 — `@` mentions

**Status:** ✅ **built and driven 2026-08-10** (session 16) · **Track B** · after BLD-011, BLD-007

## 🔴 The design, and the alternative it rejected

**The composer text is the source of truth, and the chip row is derived from it.**

The obvious build is the other one: picking from the menu inserts a token *and* attaches a
reference — two writes to two stores. That version cannot satisfy this task's own acceptance
criterion (*"deleting the inserted token removes the chip, and vice versa"*) without a third
mechanism to hold the two in step. Here there is nothing to hold in step:
`reconcileMentions(text, candidates, attached)` is run over the whole text on every change, and both
directions fall out of it. **The menu does not attach anything — it inserts text.** The chip's
Remove button does not detach anything — it deletes text.

The payoff is that *typing* a mention works for free, which is the AIB-010 half of the task: a name
typed rather than picked must not silently mean nothing, and under this design it cannot, because
every `@` token in the text is either resolved into a chip or refused by name.

⚠️ **The CM6 question in "The precedent to reuse" was answered NO, and the task said to verify it
first.** A CodeMirror instance would have bought a completion widget and cost the composer's paste,
drop, `onEnter` and controlled-value plumbing — all of it BLD-013's, all of it already driven. What
was actually reused is the *source shape* and the anchoring discipline, which was the point.
`TextArea` gained three optional props (`inputRef`, `onKeyDown`, `onSelect`) and nothing else moved.

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

Driven in the running editor against `ai-test`, **no billed call** — every path below is composer-
local. Measurements are from that pass.

- [x] **`@` lists all five kinds, grouped, with the deciding fact on each row.** Driven:
      `Components` (`App · 5 nodes`), `Pages` (`Pages/Home · start page · Main`), `Documents`
      (`docs/ARCHITECTURE.md · 3991 chars`, `docs/BRIEF.md · always sent`), `Attachments`
      (`brief.md · attached file`, after a real paste). ⚠️ **`Collections` was not driven** —
      `ai-test` has no backend, so the group correctly did not render and its resolver has never met
      a real schema. See R4.
- [x] **Keyboard: open, filter, arrow, enter, escape — no mouse required.** Driven: `@` opens with
      row 0 active; ArrowDown → `Pages/Home` → `docs/ARCHITECTURE.md`; ArrowUp → back; Enter
      inserted `@Pages/Home ` and closed the menu; Escape suppresses that mention only.
- [ ] **Mentioning a component measurably removes a `get_component` call from the turn.** 🟡 **The
      mechanism is built and pinned; the consequence is not measured.** `renderReferenceBlock` now
      emits *"The components and pages below are here in full — do not call get_component for any of
      them"* whenever a component or page rides the turn, and a spec holds that a doc-only turn stays
      byte-identical to BLD-011's block. **Comparing tool calls before and after needs a billed
      run** — filed to BLD-010, and it is the criterion's own instruction (*verify the consequence*).
- [x] **Deleting the inserted token removes the chip, and vice versa.** Driven, all four states:
      `@Pages/Home ` → chip; edit to `@Pages/Hom ` → **chip gone**; restore → **chip back, on its
      own**; delete only the trailing space → **chip stays** (the token is unchanged); click Remove
      → text goes from `change @Pages/Home` to `change `.
- [x] **A doc already in the always-block is labelled as such and is not sent twice.** Driven:
      `docs/CONVENTIONS.md` is labelled `always sent`, and mentioning it attaches **290 characters**
      — a pointer — against a file of **3,089**. ~2,800 characters saved per turn, per operation,
      all of it after the cache boundary.
- [x] **A mention that cannot resolve is refused in the composer with a reason.** Driven:
      `fix @Chekcout now` → `@Chekcout — Nothing in this project is called Chekcout.` with Send
      **disabled**; `Not a mention` clears it, re-enables Send, and **leaves the prose untouched**.

## What was measured

| | result |
|---|---|
| menu, first open | 4 groups, 7 rows, **340px** in a 364px composer, nothing clipped |
| control row, menu open vs shut | **0px difference** at 248 / 340 / 400 / 800 — the list is out of flow |
| horizontal overflow, 248 → 800px | **0** for the row, the composer and `document.body` |
| a mentioned page | `Pages/Home`, **4.8k characters** (graph + routing lines), under the 24k cap |
| an always-sent doc | **290** characters against a 3,089-character file |
| refusal sentence, dark / light | **7.70 / 7.10** |
| `Not a mention` button, dark / light | **6.66 / 6.54** |
| active menu row, label and note, dark / light | **6.66 / 6.54**, plus POL-016's inset ring |
| the danger glyph on the refusal, light | **4.58** — a graphical object (3:1), and see R2 |
| new state classes | `.Item.is-active`, `.MentionRefusal`, `.MentionDismiss` all compile as real selectors |
| the Add-context picker | same list, same notes, **no duplicate rows**, 340px, nothing clipped |

## Register

| # | Finding | State |
|---|---|---|
| R1 | 🔴 **`REFERENCE_CAPS.page` was 12,000 — half a graph.** BLD-011 declared the whole `ReferenceKind` union up front so the chip row, caps, meter and persistence would be written once, and it worked. But `page` was declared *beside* `doc` and inherited a doc-sized cap, while a page's payload is a **component's** v2 serialization. Every mentioned page would have been silently truncated to half. Raised to 24,000, with a spec asserting the two are equal. **A member declared ahead of its task is a default nobody measured.** | ✅ fixed |
| R2 | ⚠️ **A near-miss: I nearly filed a contrast defect against my own refusal line.** The first sweep took `refusalRow.querySelector('span')` and got **4.58 in light** — which is the *danger icon*, a graphical object at a 3:1 threshold, not the sentence. The sentence is **7.70 / 7.10**. Re-measured per child element with the colours printed. Same family as session 15's phantom 71px overflow: **measure the element you are making a claim about, and print what you measured.** | ✅ recorded |
| R3 | ⚠️ **A doc mention used to cost double and nothing said so.** `CONVENTIONS.md` and `BRIEF.md` default to `inject: always`, so their bodies are already in the authoring prompt's cache-stable half — and BLD-011's picker attached the body again, after the boundary, where it is the expensive copy. Fixed in `resolveCandidate`, so **the Add-context button gets the fix too**, not just `@`. ⚠️ The pointer's wording is deliberately *"part of this project's standing context"* rather than "above": the always-block is in the **authoring** turn, and the **planning** turn gets only `docsOverview`, so "above" would be a lie on one of the two. | ✅ fixed |
| R4 | ⚠️ **The `collection` leg is built and undriven.** `ai-test` has no backend, so the Collections group never rendered and `readCollection` has never met a real schema. Its two failure modes are stated rather than tested: `projectSchemaCollections` returns empty for *"could not look"* as well as *"nothing there"*, so a stopped backend silently offers no collections. | 🔴 open — BLD-010 |
| R5 | ⚠️ **Drag-and-drop is still undriven** (inherited from BLD-013), and `@` adds nothing to it. Paste was driven again here, end to end, as the way to get a real attachment onto the row for the fifth mention kind. | 🔴 open — BLD-010 |
| R6 | ⚠️ **`ReferencePicker` now renders five groups from `CANDIDATE_GROUPS`, and its list is shared with the `@` menu** — same sources, same order, same stylesheet. That is deliberate (two doors, one list) and it means **a change to either menu's paint changes both.** The `@` menu adds `.Item.is-active`; the picker does not use it. | ✅ recorded |
| R7 | ⚠️ **`.ComposerControls` now has four children and two absolutely-positioned lists hung off it.** Both are out of flow and the row measured identical open and shut at every width — but this is the sixth-time rule again in advance: **a rule written for this box when it held one button should be re-read before the fifth thing goes in it.** | ✅ recorded |
