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

## What was built, 2026-08-12 (late)

Stateful form only, as §"the version that is worth nothing" demands.

| File | What |
|---|---|
| `utils/portBar.ts` | **new.** The four states, the dismissal store, the retire counter |
| `utils/notation.ts` | +3 sentence builders |
| `JavaScriptEditor.tsx` + `.module.scss` | the bar, the `✕`, the toolbar `?` |
| `utils/portDiagnostics.ts` | message 4 stands down on the other side of §3's split |
| `tests/code-editor/portBar.test.ts` | **new.** 19 specs |

21 suites / 334 tests green in `noodl-core-ui`.

### §3, resolved deliberately — the predicate is `minesAnyPort`

Both surfaces read the same lists, and *"two components narrating the same fact in different words is
how a help surface stops being believed."* The line, made testable rather than left as an intention:

- **The bar owns "you have not started"** — the document mines **no** port at all.
- **FUN-004's message 4 owns "you started and this specific port got left behind"** — the document
  mines at least one.

Neither surface tests the other's state; they test the same predicate from opposite sides, which is
why they cannot drift into both firing. It cost four FUN-004 specs, all of which had used bodies that
mine nothing — they now mine something, and a new row pins the handover explicitly.

### ⚠️ Proved red

Deleting the self-retire — the `'silent'` return when an output is mined — fails three specs,
including both "disappears the moment an output is written" rows. That is §1's last row and the whole
discipline of the feature: a bar that persists once the user is succeeding is a bar that gets
dismissed while it is still useful.

### 🔴 §4 is NOT done — the numbers are still owed

The bar deliberately uses **`--theme-color-fg-default` on `--theme-color-bg-2`**, which is the pairing
`.ModeLabel` already ships in the toolbar directly above it — a combination already on screen, chosen
because picking anything else without a meter would be a guess dressed as a decision. No opacity, and
no `Secondary` foreground, per F22.

**That is a reasoned choice, not a measurement, and §4 asks for a measurement.** Contrast in light
**and** dark, both passing AA, with the numbers recorded — *"not 'looks fine'"*. It sits in our DOM
rather than CodeMirror's, so the tokens do apply and F23's 1.36:1 trap is avoided by construction,
but that is an argument and the task asked for numbers.

### Also not driven

Every acceptance row: the two named ports on a fresh node, the bar vanishing on a working output, the
dismissal surviving a node change, and the retire threshold.

## Register

| # | Finding | State |
|---|---|---|
| F20 | A static help bar is worse than none for this user; only a bar naming their own ports earns its place | ✅ design decision, from the originating observation |
| F21 | The bar must retire itself on success, or it is dismissed while still useful | ✅ ours to design |
| F22 | `TextType.Secondary` ≡ `TextType.Default`, and no opacity both dims and stays legible in light mode | ✅ both confirmed on screen previously |
| F23 | CodeMirror `baseTheme` colours bypass our tokens — measure computed values inside the editor DOM | ⚠️ standing trap; the lint panel shipped at 1.36:1 |
