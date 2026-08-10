# FUN-006 — The bar that knows what is true

**Status:** 📋 open · **Track: the narrator** · depends on FUN-003 and FUN-001 · **weakest task in the
phase if built generically**

## The version that is worth nothing

A dismissable strip under the toolbar reading *"Use `Inputs.name` to read inputs. See the docs →"*.

It would be ignored on sight. The originating user is described accurately in the brief — *"as lazy
as most users are"* — and a static hint is indistinguishable from chrome. Worse, it is permanent
noise for everyone who already knows, so it gets dismissed on day one and never helps anyone twice.

**Build this only in the stateful form below, or do not build it.**

## §1 — It names their ports, or it says nothing

One line, reflecting what is true of the document and the node **right now**:

| State | The line |
|---|---|
| No ports, empty body | *"This node has no ports yet. Type `Inputs.` — the name you use becomes an input port."* |
| Ports declared, body empty or references none of them | *"Read `Input_1` with **`Inputs.Input_1`**. Write `Output_1` with **`Outputs.Output_1 = …`**."* — their actual names |
| Body reads inputs but writes no output | *"Nothing is written to an output, so this node produces nothing when it runs."* |
| Body writes at least one output | **nothing.** The bar disappears |

The second row is the sentence that would have saved the originating session, and it is only possible
because FUN-003 makes declared ports readable and FUN-001 builds the expression correctly for names
that are not identifiers.

⚠️ **The last row is the discipline.** A bar that persists once the user is succeeding is a bar that
gets dismissed while it is still useful. It must retire itself.

## §2 — Dismissal

- Dismissed **per user**, not per node. Dismissing it on one node and meeting it again on the next is
  the behaviour that makes people hate these.
- A small `?` in the toolbar brings it back, so dismissal is not a one-way door.
- ⚠️ **Auto-retire.** After N Function nodes in which the user has written a working output, stop
  showing it by default. The state to count is "wrote an output", not "opened the editor" — opening
  it fifty times without succeeding is exactly when it should keep appearing.

## §3 — It is the same knowledge as FUN-004, in a different register

The bar and the lint messages read the same two lists. The difference is when:

- **FUN-004 speaks after a mistake**, anchored to a character range, as a warning.
- **FUN-006 speaks before one**, anchored to the document, as a statement of fact.

⚠️ **They must never both be on screen saying the same thing.** If FUN-004's "declared but never
read" information message is live, the bar's second row is redundant — pick one. The cleanest split:
the bar covers *"you have not started"*, FUN-004 covers *"you started and this specific thing is
wrong"*. Whichever way it is resolved, resolve it deliberately; two components narrating the same
fact in different words is how a help surface stops being believed.

## §4 — Legibility, which has cost this repo repeatedly

⚠️ The bar is secondary text in a dense panel, and every instinct here has a filed defect behind it:

- **Do not reach for opacity to make it recede.** No opacity value both dims and keeps antialiased
  text legible, and **light mode is the binding constraint**. Use a token.
- **`TextType.Secondary` is identical to `TextType.Default`** — confirmed on screen, same ratio in
  both themes. It is not a way to make something quieter.
- CodeMirror `baseTheme`s hardcode colours our tokens never reach; the lint panel was measured at
  **1.36:1** for exactly this reason. If the bar sits inside the CodeMirror DOM, check the computed
  colour, do not assume the token applied.

Measure the contrast in **both** themes before calling this done.

## Acceptance

- A fresh Function node with two declared ports and an empty body shows a line containing **those two
  port names**.
- Writing a working output makes the bar disappear without being dismissed.
- Dismissing it on one node keeps it dismissed on the next; the `?` restores it.
- After the retire threshold, a new Function node does not show it by default.
- The bar and the lint panel never state the same fact simultaneously.
- Contrast measured in light **and** dark, both passing AA, with the numbers recorded — not "looks
  fine".

## Register

| # | Finding | State |
|---|---|---|
| F20 | A static help bar is worse than none for this user; only a bar naming their own ports earns its place | ✅ design decision, from the originating observation |
| F21 | The bar must retire itself on success, or it is dismissed while still useful | ✅ ours to design |
| F22 | `TextType.Secondary` ≡ `TextType.Default`, and no opacity both dims and stays legible in light mode | ✅ both confirmed on screen previously |
| F23 | CodeMirror `baseTheme` colours bypass our tokens — measure computed values inside the editor DOM | ⚠️ standing trap; the lint panel shipped at 1.36:1 |
