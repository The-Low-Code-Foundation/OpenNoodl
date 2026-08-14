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
2. The declared-String-but-called mismatch produces the named diagnostic in the code editor;
   a correctly-declared signal does not (control).
3. Panel-declared signal outputs still work end to end after any refactor (the four hops re-run).
