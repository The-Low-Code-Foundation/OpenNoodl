# FIX-016 — The signal output hidden in a nested row

**Report 11** · Tier 3 · Effort **S** (discoverability) + **S** (diagnostic); signal *inputs* **M–L**, ruling first

> *"On the function node, why can't we add signal outputs to the props panel of the function node,
> when we can add multiple output signals inside the code itself?"*

## 🔴 The premise is false for outputs — and true for inputs

`Signal` **is** already in the Function node's output Type dropdown
(`simplejavascript.ts:784-789` concatenates `{ value: 'signal', label: 'Signal' }` onto the
output enum; the Script node spells out the same). What hides it: the add flow asks for a **name
only** (`PropListInput.tsx:295-307`, `AddNameField` has no type picker), and the Type lives in a
*separate dynamic child port* (`outtype-<label>`, default `'string'`) rendered as a nested row
**after** the port is created. Two steps, and nothing says the second is where value-vs-signal is
decided. A panel-declared signal output **works end to end** (verified through all four hops:
model push, `_isSignalType`, `runScript` callable with `.send`, registration; survives deploy via
`exportDynamicPorts`).

What is genuinely absent: **signal inputs** — the input enum has no `signal`, and
`Node.Signals.X = fn` is a *Script-node-only* feature (`_afterSourced`,
`javascriptnodeparser.js:202-210`); the Function node compiles a bare `AsyncFunction` and never
calls it. Adding one is a semantics question (does an incoming signal re-run the body, or dispatch
to a named handler?) before it is code.

## Also pinned while reading — file with this task

- **The panel wins silently over the code.** A port declared `String` in the panel but called
  `Outputs.Done()` in the body is a value port — the call **throws a `TypeError` on every run**
  and no wire from it fires (`_exists` guard drops the mined port; `unionPorts.ts:24-37` names
  this exactly).
- Parser asymmetries: the bracket form `Inputs["A"]` pushes `plug: 'inputs'` (plural — invalid,
  never dedups against the dot form); the signal-by-dot regex has **no underscore** in its class,
  so `Outputs.Done_1()` mints a *value* port (documented at `notation.ts:38-48`). Fix is S in
  code, **M in migration risk** — it changes what ports exist in live projects.
- Two latent defects: `getScriptOutputValue` guards with an unprefixed name against an `out-`-
  prefixed lookup (guard never fires); `registerOutputIfNeeded` attaches a value getter to signal
  ports unconditionally.
- The two script hosts implement proplist→ports assembly **twice** with no shared test.

## Fix direction

1. **Discoverability (S):** offer the type at add time in `AddNameField`, or a one-line hint under
   `scriptOutputs` sourced from `NOTATION_RULES` ("pick Type = Signal for an `Outputs.Name()`
   trigger").
2. **The mismatch diagnostic (S):** *"`Done` is declared as a String output but your code calls it
   — set its Type to Signal, or write `Outputs.Done = …`"* — FUN-004's `portDiagnostics.ts`
   machinery (wired at `esLintDiagnostics.ts:278`) is the ready home and already has both lists.
3. **Signal inputs (M–L):** only after the semantics ruling; the 7-item touch list is in the lane
   notes (enum split, `registerInputIfNeeded` handler semantics, the already-broken `intype-`
   setter, no run-on-change checkbox for signals, SIG-003 `Signals` group, two written
   assumptions to revise, notation call form).

## Rulings

- 🔴 **Drive first:** is the report "Signal is missing" or "I never found the Type dropdown"?
  One live look decides how much of 1 is needed.
- Signal-input semantics: re-run the body vs named handlers (copying `Node.Signals` changes what
  a Function *is*). Or rule signal inputs out and document `run` as the only trigger.
- Parser regex fixes: take the migration risk now or file separately?

## Acceptance criteria

1. Adding an output from the panel offers Signal at creation time (or an equally direct route),
   and the new signal output accepts a wire to a signal input — driven.
2. ✅ **CLOSED `4be3f1f6` — built and driven.** The declared-String-but-called mismatch produces
   the named diagnostic in the code editor; a correctly-declared signal does not (control).
3. Panel-declared signal outputs still work end to end after any refactor (the four hops re-run).

## §2 — what shipped, and what the drive changed (2026-08-15, session 23)

**Message 5** in `portDiagnostics.ts`, wording in `notation.ts#outputCalledButNotSignalMessage`.
52 specs in `portDiagnostics.test.ts`; 419/419 in `noodl-core-ui`; 0 `tsc` errors in either file.

> `Done is a String output, not a Signal, so calling it throws when the node runs. Set its Type to
> Signal in the property panel, or write Outputs.Done = … instead.`

Three design calls, each pinned by a spec that fails without it:

- **Reads the syntax tree, not `minePorts`.** The miner is text over the whole document —
  comments included, deliberately, because that is how ports come to exist. *"Your code calls
  this"* is a claim about code that **runs**. Verified non-vacuous: `minePorts` types `Done` as a
  signal from `// Outputs.Done();` alone, so a miner-based implementation would fire on a comment.
- **Only `declared` ports.** An output existing solely because the code calls it is mined *as a
  signal* and works. The undeclared underscore case (`Outputs.Done_1()` → value port) breaks too,
  but its fix is `Outputs["Done_1"]()`, not a Type change — that stays with the parser-asymmetry
  ruling below and is **pinned out** so it cannot be folded in silently.
- **No fix-it, alone among the five messages.** The repair the author wants is a panel change the
  editor cannot make; the one it could make — rewriting the call as an assignment — keeps the port
  and abandons the trigger. Two different programs, not two spellings of one.

### 🔴 The drive rewrote the message

First wording was *"a value output with no Type set"* — true of the stored parameter, **false on
screen**. `outtype-<label>` is absent until touched, so the effective type is `'*'`; but the panel
renders the enum's `default: 'string'`, and **an author with nothing stored is looking at a
dropdown that reads `String`** (measured in the running editor, both Type rows, one stored and one
absent, displaying identically). A message contradicting the visible dropdown reads as being about
some other port. Changed to name what they see.

### 🔴 The runtime corroborated the premise unprompted

Beside message 5, on the same line, the editor showed a `Last run` diagnostic:
**`Line 1: Outputs.Done is not a function`**. The "declared row wins, so the call throws" claim was
a source read across four hops; it is now a measurement.

### 🔴 Open, and found by this drive: the diagnostic does not clear when you obey it

`setOpenNodeContext` is written **only when the popout opens** (`CodeEditorType.ts:343-354`).
Changing Type to `Signal` with the popout open leaves message 5 standing — **and it survives a
forced re-lint**, so the lint did re-run and read a stale port list. It clears on reopen (driven).

Unique to message 5 among the five: messages 1-4 are about the *document*, which changes and
re-publishes nothing; message 5 is about a **panel setting**, and its own advice is the thing that
does not take effect. Cheap candidate fix — re-publish the open node when its parameters change.

### Driven matrix

| probe | panel state | message 5 | control (message 2 on `Result`) |
|---|---|---|---|
| `Outputs.Done()` | declared, Type untouched | ✅ fires, warning, `Outputs.Done` 0-12, no fix-it | ✅ fires |
| `Outputs.Done()` | declared, `outtype-Done: signal` | ✅ **silent** | ✅ fires |
| `Outputs.Done()` | **no panel row at all** | ✅ **silent** (mined as a real signal) | ✅ fires |

🔴 **The control column is what makes the silent rows mean anything.** A diagnostic is a feature
that can be *willing but never asked* — an absent signal has two causes, *refused* or *never
requested*, with opposite fixes. The fixture carries a second, known-firing diagnostic so a silence
is attributable: both → works; control only → the predicate declined; neither → nothing invoked the
analysis. Without it, a silent row would have sent the next session to the predicate with a
screwdriver for a wiring fault.

### Also observed for ruling 1 ("drive first"), as an observation, not a verdict

The property panel renders, per output: the name, then a nested row labelled only **`Type`**, whose
control is a dropdown. It is **present and visible without expanding anything** — so the report is
better read as *"I never found the Type dropdown"* than *"Signal is missing"*. Two things make it
easy to miss: the row is labelled `Type` with no mention of Signal, and — see above — **it reads
`String` whether or not anything is set**, so it looks answered. Richard's call what that is worth.
