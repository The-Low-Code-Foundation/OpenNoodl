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

### ~~Open~~ ✅ CLOSED `6de1ae25` — the diagnostic does not clear when you obey it

**Both faults below are fixed and driven 6/6 (session 24; see the follow-up section further down).**
Kept in full because the diagnosis is the valuable part, and because it was recorded wrong once.

Changing Type to `Signal` with the popout open leaves message 5 standing. It clears on reopen
(driven).

🔴 **CORRECTED — I got the mechanism wrong, and the wrong mechanism implies a fix that does
nothing.** I originally wrote *"it survives a forced re-lint, so the lint did re-run and read a
stale port list."* The survival is measured; **the inference is false.** `forceLinting` is a
**no-op on an idle editor**: `force()` runs only `if (this.set)`, and `update()` sets `set` only on
`docChanged`, a config change, or `needsRefresh` — and at `4be3f1f6` `linter()` was called with **no
second argument**, so `needsRefresh` was null. After a freshly-opened popout's mount-time lint,
`set` is `false`. **The lint did not read a stale list; it did not run.** (Found by a peer;
verified in `@codemirror/lint/dist/index.js:304-326` and `git show 4be3f1f6:…/codemirror-extensions.ts`.)

⚠️ **My probe could not distinguish the two explanations** — a stale read and a lint that never
happens look identical from the outside — and I reported one of them as measured. The rule I broke
is one this phase already carries: *a reading that fits is not one that excludes.*

🔴 **There are TWO independent faults here and either alone reproduces the symptom:**

1. **The registry is stale.** `setOpenNodeContext` is written **only when the popout opens**
   (`CodeEditorType.ts:343-354`, the sole producer) — established from source, not from my drive.
2. **The linter is unreachable.** Neither lint source is a pure function of the document, but
   without `needsRefresh` the linter re-runs on **document edits only**.

**Republishing the node — the fix my original note pointed at — would have fixed nothing on its
own**, because the linter would still never re-run to notice. Reopening the popout worked precisely
because it cures both at once.

Unique to message 5 among the five: messages 1-4 are about the *document*, which changes and
re-lints; message 5 is about a **panel setting**, and its own advice is the thing that does not take
effect.

⚠️ **The same hole was swallowing FUN-007 §2's runtime diagnostic** (peer's finding):
`CodeEditorType.ts:421-429` subscribes to `warningsChanged` so a run's error reaches the gutter
*while the popout is open* — it reached React and stopped, because an effect-only transaction never
set `set`. The `Last run` row I saw beside message 5 was visible only because the **mount-time** lint
happens to run after the field is written. A node that threw while its editor sat open stayed clean.

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

## §2 follow-up — the diagnostic that ignored you (2026-08-15, session 24)

Built. `utils/relint.ts` (new), `authoringContext.ts#subscribeToOpenNode`,
`declaredPorts.ts#declaredPortsEqual`, `JavaScriptEditor.tsx`, `runtimeDiagnostic.ts`,
`codemirror-extensions.ts`, `CodeEditorType.ts`. 25 new specs; 444/444 in `noodl-core-ui`;
`tsc --noEmit` clean in `noodl-editor`, 44 in `noodl-core-ui` (unchanged, none in these files).

### 🔴 s23's reading of the mechanism was wrong, and the correction is the whole fix

s23 recorded: *"it survives a forced `forceLinting`, so the lint re-ran and read a stale port
list."* The second clause does not follow, and it is false. `@codemirror/lint`:

```js
force() { if (this.set) { … this.run() } }                       // dist/index.js:324
update(u) { if (u.docChanged || configChanged ||
              config.needsRefresh?.(u)) this.set = true … }      // :313-322
run()   { this.set = false; … }                                  // :304
```

`needsRefresh` was never configured. So after the first lint of a freshly-opened editor `set` is
`false`, **and only a document edit can set it again** — `forceLinting` on an idle editor returns
without running a single source. The lint did not run against a stale list; **it did not run.**

⚠️ Both faults were real and either alone reproduces the symptom: the registry was stale *and* the
lint was unreachable. Fixing only the republish would have fixed nothing, and a session that
believed the s23 mechanism would have gone looking in `portDiagnostics`.

### 🔴 The same hole was swallowing FUN-007 §2's runtime diagnostic

`runtimeDiagnostics` is the linter's other source, and `setRuntimeDiagnostic` dispatched an
effect-only transaction — which sets nothing. `CodeEditorType.ts:421-429` says it subscribes to
`warningsChanged` *"so an error raised by a run that happens **while** the popout is open reaches
the gutter"*. It reached React and stopped there. The only reason the diagnostic was ever seen is
that on **open** the mount-time lint happens to run after the field is written. A node that threw
while its editor sat open stayed clean. One line: `setRuntimeDiagnostic` now asks for the re-lint.

### Predictions, written before driving

| # | probe | expected |
|---|---|---|
| 1 | popout open on `Outputs.Done()`, `Done` declared, Type untouched | message 5 fires; control (message 2 on `Result`) fires |
| 2 | set `outtype-Done` → `signal` **with the popout open** | message 5 **gone within a beat**, control still firing |
| 3 | clear `outtype-Done` again | message 5 **returns** — the wake works in both directions, not once |
| 4 | 🔴 control: `forceLinting(view)` alone, document untouched | **no view update at all** — the pre-fix no-op, reproduced in the fixed build |
| 5 | `requestRelint(view)`, document untouched | view updates — the lint runs |
| 6 | push a runtime diagnostic while the popout is open | `Last run` appears in the gutter without touching the text |

🔴 **2 and 3 are the acceptance; 4 is what makes them mean something.** If 4 shows a re-lint
happening anyway, then something else is waking the linter and the seam I added is unproven cargo —
a green 2 would be a feature passing on a mechanism I had not identified.

### Driven 6/6 — `6de1ae25`, editor `Electron . --dev` 94344, 0 renderer exceptions

**The acceptance.** Popout open, `Outputs.Done();\nResult = 1;`, `Done`/`Result` declared:

| step | message 5 | control (message 2 on `Result`) | registry | doc |
|---|---|---|---|---|
| 0 baseline | ✅ fires | ✅ fires | `Done:*,Result:*` | untouched |
| 1 Type → `signal` | ✅ **gone** | ✅ fires | `Done:signal` | untouched |
| 2 Type cleared | ✅ **returns** | ✅ fires | `Done:*` | untouched |
| 3 Type → `signal` again | ✅ **gone** | ✅ fires | `Done:signal` | untouched |

🔴 **`doc: untouched` is load bearing, not bookkeeping.** `set` is raised by document changes — so a
diagnostic that cleared because something nudged the text would look identical and would prove the
opposite of what it appeared to. The column rules out the only other mechanism that could have done
it. And the control column is what makes rows 1 and 3 a *decline* rather than dead wiring.

**Predictions 4 and 5 — the instrument, checked before the result was believed.** An
`EditorView.updateListener` appended via `StateEffect.appendConfig`, counting updates on the live
view, editor idle and document untouched:

- `forceLinting(view)` alone → **0 view updates.** The pre-fix no-op, reproduced in the fixed build.
- `requestRelint(view)` → **2.**

🔴 **This is the measurement that retires the old mechanism.** Not a source reading: the call did
nothing, counted. ⚠️ **Replication could not have caught it** — a second reading from the same dead
instrument agrees with the first. What separates them is a **positive control on the tool**, which
is what `requestRelint → 2` is.

**Prediction 6 — the runtime diagnostic, with the pre-fix path reproduced live.** Same editor, same
document, differing by exactly one call:

| step | held in the editor's state | in the gutter |
|---|---|---|
| A — field written, no re-lint asked (**pre-fix**) | `PRE-FIX PATH` | *(nothing)* |
| B — same field, one `requestRelint` | `PRE-FIX PATH` | `PRE-FIX PATH` |

The diagnostic was **inside the editor and not on the screen.** Through the real producer path
(`WarningsModel.setWarning` with a `line`), `Outputs.Done is not a function` now appears while the
popout is open and clears when the warning clears.

**The dispose path.** Closing the popout cleared the slot; a parameter write afterwards published
nothing and threw nothing. No dangling subscription.

### ⚠️ What this drive did NOT do, stated because it would otherwise be assumed

**It did not click the Type dropdown.** The fixture node's dynamic `outtype-` child ports never
appeared, so no `Type` row was there to click. The parameter was written through
`NodeGraphNode.setParameter` — which is exactly what `ModelProxy.setParameter` delegates to
(`ModelProxy.ts:50-59`), so it is the identical write on the identical object — but the widget
itself is undriven here.

🔴 **And my first explanation for the missing rows was wrong.** I attributed it to my node being
built by `fromJSON`; s23's was built the same way. The real difference may be instruments rather
than nodes: **I read the model's `getPorts()`, which returns static ports only**, while the dynamic
`outtype-` children are pushed separately and may exist in the rendered panel without ever appearing
there. **Recorded as unexplained.** ⚠️ Nobody has yet driven the dropdown *click* — which is the
click ruling 1 is actually about.

### Also observed for ruling 1 ("drive first"), as an observation, not a verdict

The property panel renders, per output: the name, then a nested row labelled only **`Type`**, whose
control is a dropdown. It is **present and visible without expanding anything** — so the report is
better read as *"I never found the Type dropdown"* than *"Signal is missing"*. Two things make it
easy to miss: the row is labelled `Type` with no mention of Signal, and — see above — **it reads
`String` whether or not anything is set**, so it looks answered. Richard's call what that is worth.

⚠️ **Scope this observation honestly before ruling on it.** I measured the **rendered DOM** — two
`PropertyPanelInput-module__Label` rows reading `Type`, each with an `<input>` whose value was
`String` — and the screenshot shows both. **I never opened either dropdown**, so *"the row is
visible and reads `String`"* is driven, while *"it offers `Signal`"* remains a source read
(`simplejavascript.ts:784-789`). Nobody has yet driven the click that a confused author would make.

⚠️ **A discrepancy, now HALF explained — and it matters which half.** The peer who built the §3c fix
reported that *their* fixture's dynamic `outtype-` child ports never materialised, and attributed it
to my node having been "normally created". **It was not: mine was `NodeGraphNode.fromJSON` +
`graph.addRoot` too**, so that explanation was wrong; they corrected it at `d837b379`.

✅ **Resolved — the instruments disagreed because they measure different things.** They then read
`node.getPorts()` and got the static list only
(`scriptInputs, scriptOutputs, functionScript, run, success, failure, done, completed, unchanged,
error`) — **no `outtype-` children.** That is expected: the dynamic children arrive via
`sendDynamicPorts` and live in the **rendered panel**, not the model. So a model-level absence is
**no evidence at all** about the row, and their `getPorts()` reading and my DOM reading are both
correct about different objects.

⚠️ **NOT resolved, and left open deliberately: their DOM query also found nothing.** By their own
account it was unscoped and taken with the popout open, which makes it the weaker of the two
observations — but *weaker* is not *explained*. **If those rows genuinely fail to render in some
node states, that is a far larger discoverability problem than an unclear label**, and it would
change what ruling 1 is even about. One scoped query on `.sidebar-property-editor` in their fixture
state settles it. **Do not rule on §1 without that**; §5 item 2 blocks on it.

⚠️ Remaining hypothesis for their DOM negative, untested: *when* the editor-side
`_managePortsForNode` / `_updatePorts` hook runs relative to `addRoot`. **The rendered-DOM
measurement stands on its own; the reason the peer saw
otherwise does not yet have one.**
