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

  🔴 **§1's drive (`bb30773c`) makes that excluded case worse than "a different fix", and it should
  change how the parser-asymmetry ruling is priced.** The `Type` row is gated on the output being
  **declared in `scriptOutputs`** — a mined-only output gets **no row at all** (driven: the SCRIPT
  OUTPUTS section is empty). So for an author who never opened the panel:

  | what they wrote | port type | Type row | message 5 | outcome |
  |---|---|---|---|---|
  | `Outputs.Done()` | signal | ✗ none | silent | ✅ works — nothing owed |
  | **`Outputs.Done_1()`** / `Outputs.Done.send()` | **value** | ✗ none | **silent** | 🔴 **throws, with no surface anywhere** |

  ⚠️ **State the scope precisely — the second row only.** A peer summarised this as *"the author who
  most needs 'set its Type to Signal' has no Type control and no warning"*, which reads as message 5
  under-firing in general. It does not: row 1 is silent because the code is **correct**. The gap is
  exactly the pinned-out case, and what §1's drive adds is that those authors have **no route at
  all** — no panel control to discover, and no diagnostic to read. That is an argument for taking the
  parser fix (or extending message 5 to it with its own wording), not for loosening `declared`.
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
built by `fromJSON`; s23's was built the same way.

✅ **Settled since: a model-level absence is no evidence at all about the row.** `outtype-` appears
in **zero** `noodl-editor` `.ts`/`.tsx` source files — every occurrence is in `noodl-runtime` /
`noodl-viewer-react` (the nodes that build the ports) or in `noodl-core-ui`'s code-editor utils.
The editor has **no static knowledge of these ports**; they arrive as *dynamic* ports from the
runtime. So `getPorts()` returning nothing is correct behaviour, and s23's DOM reading and mine were
about different objects — neither was wrong. (Peer's lead, verified across the tree here.)

⚠️ **My DOM null is NOT settled, and it has two candidate causes I cannot discriminate:**

1. **Wrong panel implementation.** `propertyeditor.ts:207` sets `sidebar-property-editor` — that
   panel is the **legacy non-React view**, and my query was unscoped and React-shaped.
2. **Absent precondition.** If the rows render only once a runtime has registered the dynamic ports,
   a drive with **no preview running** would find nothing and be *right* to.

🔴 **"Two candidate causes, undiscriminated" — not "unexplained".** The first invites the one drive
that settles it; the second reads as a mystery and gets inherited as folklore. **The drive:** open
the panel on that node **with a preview running and the node live**, then query
`.sidebar-property-editor`. Present ⇒ precondition, and ruling 1 collapses back to the copy
question. Absent ⇒ a genuine render defect, and Richard is being asked the wrong question.

✅ **Robustness worth stating, because it is a stronger claim than "it works":** this fix is
**independent of that precondition entirely.** `declaredPorts.ts` reads the **parameter bag**, not
the node's ports — a package-boundary decision (`noodl-core-ui` owns no project model) that happens
to mean `outtype-Done` is readable whether or not the *port* was ever registered. The whole drive
ran with no preview. Nothing here breaks if the row turns out to need a live viewer.

⚠️ Nobody has yet driven the dropdown *click* — which is the click ruling 1 is actually about.

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

---

## Session 26 — §5 item 2 DRIVEN. The row's precondition is not the viewer, it is a DECLARED row

Driven in a live editor (`d0891746` + working tree), preview running, fixture a copy of
`fix003-drive`. Screenshots in the session scratchpad. **The blocking question for ruling 1 is
settled, and the answer is not either of the two candidate causes on record.**

### The control pair — one variable, paired readings, reproduced

Two `JavaScriptFunction` nodes in one component, built the same way (`NodeGraphNode.fromJSON` +
`graph.addRoot`), carrying the **identical script**:

```js
Outputs.Done();
Outputs.Result = 42;
```

| node | `scriptOutputs` proplist | property panel (`.sidebar-property-editor`) |
|---|---|---|
| **A** | `[{id:'so1',label:'Done'},{id:'so2',label:'Result'}]` | `SCRIPT OUTPUTS │ Done │ Type │ Result │ Type` — 2 rows, both inputs read `String` |
| **B** | **absent** — outputs exist only because the script text was mined | `SCRIPT OUTPUTS │ ` — **section completely empty. 0 rows, 0 inputs** |

Both read at the same moment, then re-read after an intervening popout open/close: **identical both
times.** B's panel goes straight from the `SCRIPT OUTPUTS` header to `GENERAL`.

🔴 **So the Type row is gated on the author having DECLARED the output in the `scriptOutputs`
proplist — not on a live viewer, and not on the panel implementation.** Source agrees and names the
gate: `simplejavascript.ts:792-793` builds the `outtype-` port only inside
`if (scriptOutputs !== undefined && scriptOutputs.length > 0)`. A mined output gets its `out-` port
(it works, it wires, it appears on the canvas) and **no `outtype-` port at all**.

⚠️ **Both candidate causes in the previous section are therefore wrong**, and the second one is the
one to retract loudly: *"the rows need a live viewer to register the dynamic ports"* — my preview
**was** live and node B still had no row, while node A beside it did. A shared precondition cannot
explain a difference between two nodes that share it.

### The diagnostic is silent on exactly the node that has no way to fix itself

Same popout, same document, read through the editor's own lint state
(`forEachDiagnostic`, `@codemirror/lint`):

| node | diagnostics |
|---|---|
| **A** declared | **1** — *"Done is a String output, not a Signal, so calling it throws when the node runs. Set its Type to Signal in the property panel, or write `Outputs.Done = …` instead."* |
| **B** mined | **0** |

✅ **The silence is attributable, because A is a known-firing control in the same run** — the lint
ran, the predicate declined. This is the discipline §3e asked for and it is what makes the null
worth anything.

🔴 **The author who most needs the §2 message is the one who cannot receive it.** Writing
`Outputs.Done()` without adding a proplist row yields: a working-looking `Done` output on the
canvas, **no Type control anywhere in the panel**, and **no warning**. The diagnostic §2 shipped
speaks only to authors who already found the proplist.

⚠️ **Stated as a source read, not driven:** that node B *throws* at runtime.
`_isSignalType` (`simplejavascript.ts:633-635`) tests `outputPorts[name].type === 'signal'`, and a
mined output registers as `'*'` (`:697-699`) — the same predicate that makes A throw, and A's throw
is driven (s23 saw `Line 1: Outputs.Done is not a function`). **I did not run node B.**

### AC1 is driven, and it is false

Clicking `+` beside `SCRIPT OUTPUTS` opens exactly one control:

```html
<div class="header proplist-header"><div style="height: 35px; position: relative;">
  <input class="sidebar-panel-dark-input name-edit" placeholder="Entry name" type="text" value="">
</div></div>
```

**A name field, and nothing else.** No type control at creation time. AC1's *"offers Signal at
creation time"* is **false as built** — driven, not inferred.

### The dropdown, finally opened — Signal IS there, and it is last

Real trusted click (`cdp click`, not `.click()`) on Done's Type control on node A. The portal list
holds **eight** options, in this order:

`String · Boolean · Number · Object · Date · Array · Color · **Signal**`

✅ So *"Signal is missing"* is **false for a declared output** — it is present, offered, and the
last item in the list. The report is `"I never found the Type dropdown"`, and §3d's two reasons
stand. ⚠️ The peer's `MeasuringContainer` warning was needed and correct: the DOM held **2** such
`ul`s and only **1** was real.

### 🔴 Instrument caveat that resolves s24's null without needing their fixture

**`node.dynamicports` is volatile and disagrees with the rendered panel in BOTH directions.**
Measured in one call, late in the session:

- **A** — panel renders two Type rows; `dynamicports` `outtype-*` list is **empty**
- **B** — `dynamicports` contains `outtype-Done`; panel renders **no** Type row

🔴 **So neither `getPorts()` nor `dynamicports` is evidence about the row, in either direction.**
The earlier reading in this file — that a model-level absence is no evidence — was right, and this
extends it: a model-level **presence** is no evidence either. **The rendered panel is the only
instrument that has been self-consistent across every reading here.**

⚠️ **This also means my own first measurement of the pair should not be quoted as corroboration.**
It was model-level, it agreed with the DOM at the time, and by the end of the session it no longer
did. The finding rests on the DOM readings, which were paired and reproduced.

### ⚠️ One sub-experiment failed to set up — recorded so nobody reads it as a result

I tried to check whether declaring `Done` on node B restores its Type row. The panel showed a `Done`
row, but `B.parameters` still held **only `functionScript`** — my synthetic `Enter` never committed
the proplist entry, so the row on screen was an uncommitted edit field. **The question is untested,
not answered.** (The legacy `sidebar-panel-dark-input name-edit` needs a real blur/commit, not a
dispatched `KeyboardEvent`.)

### What ruling 1 is now about

Not *"is Signal missing"* (it is not, for a declared output) and not *"does the row render"* (it
does, when the output is declared). It is:

**An author who writes `Outputs.Done()` and never opens the `scriptOutputs` proplist gets a broken
signal output, no Type control, and no diagnostic.** That is a different and larger question than
the label/`String`-default copy issue in §3d, and both are live. Richard is ruling on two things.

