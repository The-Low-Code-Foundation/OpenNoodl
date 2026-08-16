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

  | what they wrote | port type | Type row | message 5 (static) | runtime, after a Run | outcome |
  |---|---|---|---|---|---|
  | `Outputs.Done()` | signal | ✗ none | silent | — | ✅ works — nothing owed |
  | **`Outputs.Done_1()`** / `Outputs.Done.send()` | **value** | ✗ none | **silent** | 🔴 **reports it** | 🔴 **throws — but only tells you once you run it** |

  ⚠️ **State the scope precisely — the second row only.** A peer summarised this as *"the author who
  most needs 'set its Type to Signal' has no Type control and no warning"*, which reads as message 5
  under-firing in general. It does not: row 1 is silent because the code is **correct**.

  🔴 **CORRECTED — I wrote "no surface anywhere" and that is false, measured.** A later drive put the
  runtime diagnostics beside a known-firing control: `Outputs.Done.send()` → *"Line 1: Cannot read
  properties of undefined (reading 'send')"*, `Outputs.Done_1()` → *"Outputs.Done_1 is not a
  function"*. Both throw — that half was right, and was previously only reasoned — but **neither is
  silent.** ⚠️ **I had this evidence in my own session and did not connect it**: the `Last run` row I
  recorded beside message 5 (§"the runtime corroborated the premise") is the *same mechanism*, and it
  was always going to fire here too.

  ⚠️ **Two different things, and the drive measured only one of them — flagged by its own author.**
  What was measured for row 2 is **`WarningsModel` entries for the node**. What I measured, in the
  declared case, is a rendered `Last run` diagnostic in the code editor. The link between them is
  real but is the *mechanism* (`setRuntimeDiagnostic` ← `warningsChanged`, `CodeEditorType.ts:421-429`
  — the seam `6de1ae25` repaired), **not a second measurement.** So: *"the runtime records a warning
  for this node"* is driven; *"the author sees it in the gutter for **this** case"* is inferred from
  a mechanism proven on a different case. It is very likely true and it is not measured, and after
  today that distinction is worth the extra sentence.

  ✅ **The accurate claim, and it still supports a ruling:** row 2 has **no *static* surface** — no
  Type row to discover, no lint warning while authoring — and is reported **only after the node
  runs**. That is materially worse than a declared port, which warns before you run anything, and
  materially better than nothing. It argues for the parser fix or a message-5 variant, **not** for
  loosening `declared`. ✅ **The same claim had propagated to four places and all four are now
  corrected** (`efcfa8b4`) — ⚠️ my own pointer here said *"§3b below"*, which is in the **phase
  handover**, not this file, so it sent a reader scrolling for a section that was never here. A
  cross-reference that names a section without naming its file is a broken pointer the moment the
  two documents drift.
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

✅ **SUPERSEDED for the ruling by `bb30773c` — §1 is no longer blocked.** A control pair (identical
script, one output declared in `scriptOutputs`, one mined from text only) gave `Done │ Type │ Result
│ Type` versus a **completely empty** SCRIPT OUTPUTS section, source-confirmed at
`simplejavascript.ts:792-793` where the `outtype-` port is built only inside
`if (scriptOutputs !== undefined && scriptOutputs.length > 0)`. **Declaration is necessary**, and
that is the ruling-relevant fact.

⚠️ **But do NOT record session 24's particular null as "explained" — it still is not.** Three
candidates remain and the drive separated none of them:

1. their fixture never declared `scriptOutputs` (the gate above accounts for it) — **STILL LIVE**;
2. ~~the runtime axis — *declared + no live preview* is an untested cell~~ — 🔴 **PREMISE FALSE.**
   With a project open and **no preview action**, an `<webview>` "Noodl Viewer" runtime is live —
   witnessed pushing dynamic ports — so "no live preview" is not the author-reachable state the cell
   assumed. ⚠️ **Bounded: observed with a project OPEN; the Launcher case is untested.**

   🔴 **STRUCK — *"a CDP target list is not the list of runtimes"*, which I filed here and called the
   general form worth keeping. It is false.** `cdp.js:333` prints `/json/list` **unfiltered**, type
   first; there is no page-only filter, so `targets` never hid the webview. The author of the
   original observation retracted it: they ran `targets` **before** opening the project and `curl`
   **after**, and attributed a state difference to the instrument. ⚠️ **I verified the retraction in
   `cdp.js` rather than accepting it** — twice today an accepted correction was itself wrong.
   ✅ **The narrower true thing, if a replacement is wanted:** `cdp.js:143`'s error hint —
   *"The viewer window only exists while a project preview is running"* — is misleading;
   `--target=viewer` attaches with no preview, because `KNOWN_TARGETS.viewer` matches `'Noodl Viewer'`
   (`:121`) and `appTarget` accepts type `webview` (`:126`). Both verified here.
3. ~~a fixture artefact — `fromJSON` + `addRoot` may never reach the runtime's model~~ — 🔴 **DEAD,
   and in the reassuring direction.** That pair **is the NodePicker's own creation path**
   (`NodePicker.utils.ts:15-41`; verified here — `NodeGraphNode.fromJSON(...)` then
   `model.addRoot(node, { undo: true, label: 'create' })`). Witnessed: **4 `setDynamicPorts` pushes
   arrived from the runtime** for a normally-created node. ✅ **So no phase-66 drive built that way
   was measuring a different object than a user's node** — a worry I raised across two files, now
   retired.

✅ **So (1) is the last candidate standing — but it stands by ELIMINATION, and the eliminations are
measured while (1) never was.** Nobody has looked at s24's fixture for a `scriptOutputs` entry.
⚠️ **And the list was mine, not exhaustive** — *"the only survivor of the three I thought of"* is
[[absence-derived-from-a-partial-request-is-a-lie]] in miniature. Two dead candidates raise (1) from
*a story* to *the leading explanation*; they do not make it measured. One look at that fixture would.

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

🔴 **CORRECTED BELOW — read this with the amendment ~100 lines down before acting on it.** As
written this paragraph is **too broad**, and acting on it would mean loosening `declared` and
warning about **correct code**.

> ~~**The author who most needs the §2 message is the one who cannot receive it.** Writing
> `Outputs.Done()` without adding a proplist row yields: a working-looking `Done` output on the
> canvas, **no Type control anywhere in the panel**, and **no warning**.~~

✅ **Why it is wrong:** a call-shaped `Outputs.Done()` is mined as a **`signal`**
(`javascriptnodeparser.js:353-356`, `/Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/ → type: 'signal'`), so that
node **works**, and §2's silence on it is **correct** — `declared` doing its job. Independently
driven in the §2 matrix above: *"no panel row at all → silent (mined as a real signal)"*.
🔴 **The real gap is one row, not the whole mined case** — the *value-shaped* call
(`Outputs.Done_1()`, `Outputs.Done.send()`), which mines as a value port and has **no Type row and
no diagnostic**. See the table below.

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


### 🔴 THREE CORRECTIONS TO THE SECTION ABOVE — all mine, all caught by peers within the hour

Left visible rather than edited away, because two of them carried a ✅.

**C1 — "not on a live viewer" is NOT supported by my experiment, and the source says the runtime IS
in the path.** My preview was live in **both** arms. I varied declaration and learned about
declaration; **the viewer never varied, so it cannot have been tested.** Worse, `_managePortsForNode`
— which holds the `scriptOutputs` gate — is registered only inside
`graphModel.on('editorImportComplete', …)` on a **runtime's** graphModel
(`simplejavascript.ts:890-904`), which is exactly why `outtype-` appears in zero editor source files.
✅ **Correct claim: declaration is NECESSARY.** ⚠️ **Whether a live runtime is ALSO necessary is
untested**, and the 2×2 has two empty cells:

| | preview LIVE | preview ABSENT |
|---|---|---|
| **declared** | ✅ rows present | ⚠️ **untested — and a peer's null sits here** |
| **mined only** | ✅ section empty | — |

🔴 **The sharper open question**, which supersedes "toggle the preview": for a node created the
*normal* way, has `editorImportComplete` fired and does the runtime's `graphModel` hold it? A peer's
null may be a fixture artefact — `fromJSON` + `addRoot` writes the **editor's** model and may never
reach the runtime's.

**C2 — 🔴 I got the severity BACKWARDS, and the retraction matters more than the finding.** I wrote,
as a source read, that the mined node throws at runtime. **It does not.** The miner types a
*call-shaped* `Outputs.Done()` as **`signal`** (`javascriptnodeparser.js:353-356`, `type: 'signal'`);
only assignment-shaped usage gets `'*'` (`:373-384`). So `_isSignalType` returns true, **node B works,
and §2's silence on it is CORRECT** — `declared` doing its job.

⚠️ **So "the author who most needs the message has no control and no warning" is too broad**, and
stated that way it would send someone to loosen `declared` and start warning about correct code. The
real gap is one row, not the whole mined case:

| written, undeclared | port type | Type row | message 5 | outcome |
|---|---|---|---|---|
| `Outputs.Done()` | signal | none | silent | ✅ **works — silence is correct** |
| **`Outputs.Done_1()`** / `Outputs.Done.send()` | **value** | none | **silent** | 🔴 throws — ⚠️ **NOT** "no surface" (see note) |

⚠️ **Attribution on that last column, kept straight deliberately — it is TWO measurements by TWO sessions, not one.** s27 measured **`WarningsModel` entries** for those nodes (`Outputs.Done.send()` → *"Cannot read properties of undefined (reading 'send')"*; `Outputs.Done_1()` → *"Outputs.Done_1 is not a function"*). That they **render as a `Last run` gutter diagnostic** is s24's measurement, from `6de1ae25`'s drive — a `WarningsModel` warning carrying a `line` appears in the gutter and clears when the warning clears, with the pre-fix path reproduced as a control. **The conjunction holds; neither session measured both halves.** 🔴 I first wrote *"`Last run` fires (measured s27)"*, which attached one session's name to a surface the other had established — the exact slip this row exists to correct, since the whole point was that *"throws"* had been asserted as measured when it was only reasoned.

✅ **What survives, and it is still the finding:** row 2's author has **no route at all** — no panel
control to discover *and* no diagnostic to read. That re-prices the parser-asymmetry ruling from a
nicety to *the only case with no surface*.

**C3 — one of my two `dynamicports` directions was the gating rule, not an instrument lie.** I cited
(a) rows rendered with an empty `outtype-*` list, and (b) `outtype-Done` present with no row.
**(b) is predicted**: node B's `parameters` held **only `functionScript`** — `Done` was never in
`scriptOutputs`, because my synthetic `Enter` never committed — so "parameter present, no row" is
exactly the declaration gate behaving correctly.

✅ **This makes the conclusion stronger, not weaker: the rendered panel is a RELIABLE readout of
declaration.** Only (a) is genuine model-vs-panel disagreement. The correct caveat is narrower:
**`node.dynamicports` is a cache of what a runtime last pushed, so its *presence* is not evidence the
panel will render — but the panel is trustworthy.** ⚠️ My broadcast wording ("disagrees in both
directions, not usable even as a conservative bound") is **withdrawn**; it went to ~20 recipients and
several filed it verbatim.


**C4 — and the fourth is the same error one step on: "this explains s24's null" is attribution by
elimination.** I wrote that the declaration gate explains both previously conflicting readings.
**It is the tidiest story and the drive separated none of the candidates.** s24's null has three:
(1) their fixture never declared `scriptOutputs`; (2) **the runtime axis withdrawn in C1** —
declared-but-no-preview is untested and their null sits in exactly that cell; (3) a **fixture
artefact**, since `fromJSON` + `addRoot` writes the *editor's* model while `_managePortsForNode` is
registered on a **runtime's** graphModel.

✅ **Settled: declaration is NECESSARY** — enough to unblock §1's ruling. ⚠️ **Not settled: why s24
saw what they saw.** (Peer's catch, `c6ce10fd`.)

🔴 **Candidate (3) is the cheapest and highest-value next probe, and it reaches past this task:** if
`fromJSON` + `addRoot` never reaches the runtime's graphModel, **every phase-66 drive built that way
has been measuring a slightly different object than a real user's node.**

### ✅ s27 — C1 CLOSED, and both of my remaining caveats were wrong

Driven by a peer on a **picker-created** node, teardown clean.

🔴 **C1's "fixture artefact" candidate is DEAD — `fromJSON` + `addRoot` IS the product's path.**
`NodePicker.utils.ts:15-41` builds every picked node with `NodeGraphNode.fromJSON({…})` then
`model.addRoot(node, {undo:true, label:'create'})` (verified independently here). **So my drive
measured the same object a real user's node is**, and the caution I put in the handover — *"build
the node the normal way, not `fromJSON`"* — was wrong advice.

🔴 **C1's viewer cell: the premise was false, so the cell was never reachable.** With a project open
and **no preview action taken**, the editor hosts a `<webview src="localhost:8574">` **"Noodl
Viewer"** runtime — witnessed *pushing dynamic ports*, so it is doing the work, not merely present.
So *"declared + no live runtime"* is not author-reachable and **§1 is the copy question.**

🔴 **WITHDRAWN — s27's own instrument claim, caught by a peer within the hour: "`npm run cdp --
targets` prints only `page` targets and hides the webview."** `cdp.js:333` prints `/json/list`
**unfiltered**, `type` first — it cannot have hidden anything. **The real cause was mine:** I ran
`targets` **before opening the project** and `curl` **after**, then attributed a state difference to
the instrument. ⚠️ **Two instruments, two times, one conclusion** — this phase's own trap, committed
in the act of cataloguing it, and it reached ~6 sessions who filed it.

✅ **What survives, narrower:** `cdp.js:143`'s hint — *"The viewer window only exists while a project
preview is running"* — is **misleading**. `KNOWN_TARGETS.viewer` already matches `'Noodl Viewer'`
(`:121`) and `appTarget` accepts `webview` (`:126`), which is exactly why `--target=viewer` attached
here with **no preview running**. ⚠️ **Bound on the always-on claim:** observed with a project
**open**; whether the webview exists on the Launcher was never tested.

✅ **The gate reproduced independently, with an in-situ control**: dynamic-port pushes on one node
went `out-Done, out-Result` (undeclared) → `outtype-Done, out-Done, outtype-Result, out-Result`
(declared). Same script, declaration the only variable.

🔴 **C2's table is wrong in its SILENCE column — measured beside a known-firing control.** Both
value-shaped calls throw **and warn**:

| written, undeclared | throws | diagnostic |
|---|---|---|
| `Outputs.Done.send()` | ✅ *"Cannot read properties of undefined (reading 'send')"* | ✅ **fires**, names line 1 |
| `Outputs.Done_1()` | ✅ *"Outputs.Done_1 is not a function"* | ✅ **fires**, names line 1 |

✅ So the throw I recorded as a **source read** is now **driven** — but *"no diagnostic / no surface
at all"* is **false**. ⚠️ **The parser-asymmetry ruling loses its severity argument**: the author
gets a runtime error naming the line. What remains is only that there is **no Type row** to fix it
from, which is the same copy/discoverability question as §1 rather than a separate coverage gap.

---

## Session 28 — s24's null: the LAST candidate is FALSE, so the list has NO survivors

s27 left this as §5's cheapest loose end: *"s24's null now has one surviving candidate — that their
fixture never declared `scriptOutputs`. One look at that fixture finishes it."* It is finished, and
it finished the **opposite** way to the way it was framed. **No drive was needed and none was run.**

### 🔴 Candidate (1) — *"their fixture never declared `scriptOutputs`"* — is FALSE

s24's fixture **did** declare it, with rows `Done` and `Result`. The proof is s24's own
contemporaneous drive table plus the source that produces the column it recorded:

| # | link | source |
|---|---|---|
| 1 | the drive's `registry` column has exactly one producer | `CodeEditorType.ts:377` → `collectDeclaredPorts(node.parameters)`, published at `:385` as `declaredOutputs` |
| 2 | every `PortFact.name` comes from a `scriptOutputs` proplist **row label**, and from nowhere else | `declaredPorts.ts:119-123` → `readList(params,'scriptOutputs','outtype-','*')`; the name is `entry.label` (`:90`) |
| 3 | an **absent** `scriptOutputs` yields an **empty** list — no names at all | `decodePropList` returns `[]` for a non-array (`listValueCodec.ts:214`) |
| 4 | s24 recorded registry **`Done:*,Result:*`** at baseline | this file, §2 follow-up drive table |
| 5 | s24's driven matrix labels the panel state **"declared"** on two of its three rows | this file, driven matrix |

⇒ `scriptOutputs` held rows labelled `Done` and `Result`, with `outtype-` unset — which is precisely
what the `*` in `Done:*` **means** (`declaredPorts.ts:74`, `DEFAULT_OUTPUT_TYPE`). A fixture with no
`scriptOutputs` **cannot** produce that reading.

🔴 **And the null is recorded as spanning the declared rows.** The claim was that the fixture node's
dynamic `outtype-` child ports ***never*** appeared — across a drive whose own matrix ran two
declared rows. So declaration cannot be why they were missing, whatever the third matrix row did.

### ✅ Net effect on the candidate list: three dead, zero standing

1. never declared `scriptOutputs` — 🔴 **DEAD (this session, from s24's own record)**
2. the runtime axis, *declared + no live preview* — 🔴 DEAD (s27; ⚠️ rests on the always-on-webview
   observation **no second session has reproduced**)
3. a fixture artefact, `fromJSON` + `addRoot` — 🔴 DEAD (s27, witnessed)

**s24's null is now fully unexplained**, and that is a better state than it was in yesterday: it was
being carried as *"one leading explanation, one look from confirmed"*.

### 🔴 The reason the list ran out: an EARLIER, better list was silently dropped

The three-candidate list replaced an earlier **two-cause** list in this same file, and the causes
were never merged. The dropped one is the **instrument**:

> *"Wrong panel implementation. `propertyeditor.ts:207` sets `sidebar-property-editor` — that panel
> is the legacy non-React view, and my query was unscoped and React-shaped."*

✅ `propertyeditor.ts:207` verified this session: `this.bodyEl.className = 'sidebar-property-editor'`.
**That cause was never eliminated by anybody.** It is the only un-refuted explanation on the table.

⚠️ **But do NOT adopt it as the new leading explanation — that is the exact move that just cost three
sessions.** There is a counter-indication already: the panel *body* is legacy, yet its *rows* are
React — `PropertyPanelInput` is a `noodl-core-ui` component used from the legacy `DataTypes/*.ts`
classes (`BasicType.ts`, `EnumType.ts`, `Ports.ts`, …). So a React-shaped selector is not obviously
wrong, and another session did read `PropertyPanelInput-module__Label` rows out of the real DOM.
**This candidate needs its own measurement, not promotion.**

### 🔴 The transferable shape: a candidate list is a session's GUESS, inherited as a PARTITION

Three sessions ran elimination over a list one session wrote, and each elimination made the
remainder look stronger. The arithmetic is only valid if the list is exhaustive, and **nothing ever
checked that** — while the file itself contained an older, non-overlapping list the whole time.
⚠️ **Eliminating candidates raises the survivors' apparent odds even when the truth was never on the
list**, which is [[absence-derived-from-a-partial-request-is-a-lie]] wearing a different hat.
✅ **When you inherit a candidate list, `grep` the file for an earlier one before you start crossing
things off.**

### ⚠️ Two bounds on this session's own result, stated because they would otherwise be assumed

- **s24's fixture no longer exists on disk.** No `project.json` under `NodeGX test projects/`
  contains `Outputs.Done` (26 files searched). So this is a re-reading of s24's **record**, not a
  re-measurement of their fixture — the "one look" §5.7 asked for was **not available**. It is
  nonetheless decisive, because the registry column has exactly one producer.
- **The instrument nearly bit me on the way in.** `/usr/bin/grep -rn` (no `-a`) over `packages/`
  reported that `collectDeclaredPorts` and `setOpenNodeContext` had **no production caller** — which
  would have made link 1 above collapse. Re-run with `-a`, both callers are there in
  `CodeEditorType.ts`. 🔴 **A "no caller" reading from a grep without `-a` in this repo is an
  instrument artefact, not a finding.**

## ✅ RULED 2026-08-16 (session 42)

**Ruling 1 → keep the Script node STRICT, and make it TEACH.** Richard: *"a Script node has always
been strict AF, keep it that way, if you want to use the Script node it's because you've got
something hardcore to achieve, so you should learn the rules (and the node should teach of course)."*

So the fix is **not** to make the parser accept an undeclared `Outputs.Done()`. Declaration stays
necessary — that is the node's character, not a bug. What is missing is the **editor-time
diagnostic**: an author who writes `Outputs.Done()` and never opens the `scriptOutputs` proplist gets
a broken output, no Type control, and **no message at all**. Add the message.
Rejected: **(a) copy/default**, which would paper over the strictness being kept on purpose.

**§3 signal inputs → RULED OUT for Functions.** Richard: *"Script nodes are the ones to use when you
want multiple input signals, Functions just have Run."* Document `run` as the Function's only
trigger; do **not** copy `Node.Signals` into it. ✅ **This closes the only genuinely blocked item in
the phase.**

## ✅ §3 BUILT 2026-08-16 (session 43) — and the documentation it corrected was WRONG

Two surfaces now carry the asymmetry, one per moment:

| surface | moment | what it now says |
|---|---|---|
| `NOTATION_RULES.function` (`notation.ts`) | mid-edit, in the code editor | *"It runs when you signal Run — the only signal input this node has, and one it cannot be given a second of."* |
| `NOTATION_RULES.script` | mid-edit | *"Each function declared under signals becomes a signal input, which is how a node takes more than one trigger."* |
| `NodePicker.chooser.ts`, `JavaScriptFunction` card | pre-choice, in the picker | *"Runs when you signal Run — its only trigger — and can fire several signals when it is done."* |

🔴 **The chooser's header asserted the OPPOSITE, and the spec enforced it.** Both said every
`Node.Signals.X = function(){}` becomes a signal input *"unlimited, and additional to the built-in
`Run`"*, sourced to `javascriptnodeparser.js`. **That sentence is true of neither node** — it
splices the two together:

- `Node.Signals` is read at `javascriptnodeparser.js:203-211`, on the `_afterSourced` path, which
  is reached only by `Javascript2` — and `Javascript2` has **no** built-in `Run` port (its inputs
  are `scriptInputs`, `scriptOutputs`, `code`/`externalFile` plus whatever it declares).
- The Function node compiles its body as
  `AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', …)` (`simplejavascript.ts:609-619`).
  `Node` is not a parameter. Writing `Node.Signals.X = …` in a Function mints nothing; in a browser
  it assigns a property to the DOM `Node` constructor and reports nothing at all. Its one signal
  input is the built-in `run` (`simplejavascript.ts:251-265`).

⚠️ **So the ruling did not just unblock the item — it corrected the only place in the product where
this behaviour was written down.** The header, the spec's own docblock and the `LGC-001` prohibition
row are all amended, and the prohibition is **narrowed rather than deleted**: the *output* claim
("only one output signal") stays forbidden, because that half really is false and unlimited signal
outputs are real.

✅ **The spec is a two-armed control now** (`tests-unit/lgc-001/chooserCopy.test.ts`): one arm shows
the forbidden sentence still matches the pattern list, the other shows the now-*required* sentence
does not. A one-armed negative would have gone on passing after the list stopped catching anything.

⚠️ **Documentation only — no runtime change.** Nothing about triggering was altered in either node,
and the 7-item touch list in the lane notes is now dead work rather than pending work.

⚠️ **`NOTATION_RULES` has one consumer today** — the AI's Function template
(`AiAssistant/templates/function.ts`). It is exported from `noodl-core-ui`'s code-editor barrel but
no component renders it, so *"the sentence the editor shows a beginner"* is, as of this session,
aspirational for the function/script lines. The picker card is the surface a person actually reads.

## ✅ RULING 1 BUILT 2026-08-16 (session 44) — and the census found the opposite defect first

🔴 **Before writing the message the ruling asked for, I measured what the editor says today. It was
not silent. It was accusing the Script node's own API.** Census run through
`javascriptDiagnostics(state, validationType)` in the `noodl-core-ui` node runner, both modes, five
documents (throwaway spec, deleted):

| written | `'function'` | `'script'` (before this session) |
|---|---|---|
| `define({ inputs: … , outputs: … , run: … })` | *"No port named define. Create an input port by reading it: `Inputs.define`."* | 🔴 **the same message** |
| `script({ … })` | same shape | 🔴 **the same message** |
| `Outputs.Done();` | silent (correct — it is a signal there) | 🔴 **silent** — the ruling's premise, confirmed |
| `Node.Signals.Go = …` | silent | silent |

🔴 **`define` is the notation `NOTATION_RULES.script` tells the author to write**, and the editor
answered it with a fix-it that inserts `Inputs.define` — notation the Script node does not have. The
ruling said *"the node should teach"*; it was actively mis-teaching, and nobody had looked because the
premise on file was *"no message at all"*.

### The cause: one globals list for two differently-compiled nodes

| node | compiled as |
|---|---|
| Function (`JavaScriptFunction`) | `AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script)` — `simplejavascript.ts:609-619` |
| Script (`Javascript2`) | `Function('define', 'script', 'Node', 'Component', prefix + code)` — `javascriptnodeparser.js:22` |

`esLintDiagnostics.ts` held **one** `NOODL_FUNCTION_GLOBALS` — the *union minus `define`/`script`* —
and `configFor` handed it to both modes. `noodl-api-surface.ts`'s completion list had the same shape
and the same name, `SCRIPT_GLOBALS`, while containing the **Function** node's API: a Script node was
offered `Inputs` and `Outputs`, annotated *"Reading `Inputs.x` creates the port"* — false there — and
`define` was offered nowhere in the product.

⚠️ **And `codenotation: 'script'` is real and reached**: `javascript.ts:299` declares it on the Script
node's `code` port, `CodeEditorType.ts:68-72` maps it. This is not a mode nobody opens.

### What shipped

| file | change |
|---|---|
| `esLintDiagnostics.ts` | `FUNCTION_NODE_GLOBALS` / `SCRIPT_NODE_GLOBALS`, one per mode |
| `noodl-api-surface.ts` | `globalsFor('script')` now offers `define`, `Node`, `script` — and not `Inputs`/`Outputs` |
| `notation.ts` | **message 6**, `functionApiInScriptNodeMessage` |
| `portDiagnostics.ts` | script mode gets message 6 and **nothing else** from this pass |

> `Outputs is the Function node's API and is not in scope here, so this line throws when it runs. A
> Script node declares its ports: define({ inputs: { … }, outputs: { … }, run: function (inputs,
> outputs) { … } }).`

🔴 **The largest decision is the suppression, and it is bigger than the ruling asked for.** Messages
1–5 all emit `Inputs.`/`Outputs.` notation, and **all five are wrong in a Script node** — it mines no
ports from its text, so message 3's *"create an input port by reading it"* is an offer that creates
nothing, and message 1's *"read it with `Inputs.X`"* names a binding that is not in scope. The pass
was written for the Function node and had been running here unchanged since FUN-004. So script mode
now gets one true sentence in place of five false ones. ⚠️ **ESLint's own diagnostics still pass
through** — a genuine typo is still reported, in JavaScript's words. Only the port-notation
enrichment is dropped.

⚠️ **`Noodl` and `Script` stay declared in both**, because both are reachable in a Script node
(`window.Noodl` via `createNoodlAPI`; `Script` from the shared code prefix). Warning about them would
be being wrong about working code, which is the one thing `no-undef` may not be here.

⚠️ **Message 6 needs an open node, and that gate is load-bearing.** `'script'` is also
`CodeFileDocument`'s mode for a kit's `index.js` (CN-006) — a whole module, no ports, no property
panel — where `openNode` is null. There `Outputs` gets plain `no-undef`, which is the right answer;
*"declare ports with define({…})"* would be advice about a node that file is not. There is a spec row
for it.

### Gates (session 44, this session's own readings)

| gate | reading |
|---|---|
| `noodl-core-ui` jest | ✅ **26 suites / 461 tests** (was 25 / 444 — the delta is this task's one suite and 17 tests) |
| `typecheck:core-ui` | 44 errors, unchanged count, none in any file touched |
| `lint:ci` ratchet | ✅ exit 0 |
| `noodl-editor` `test:main` | ⚠️ **220 / 221 suites, one failure that is not this change — see below** |

🔴 **`test:main` failed twice in a row, on two *different* suites, and both are `turnDeadline`
timing tests.** `bld-004/reasoningChannel` on one run, `aib-009/turnDeadline` on the next; both report
*"nothing arrived for 0 seconds"*. Attribution, measured rather than argued:

- **`npx jest --findRelatedTests` over all four files I changed lists ZERO editor suites.** Nothing in
  the editor's runner depends on them.
- Each suite passes **3/3 in isolation**.
- The full run was clean twice earlier in this same session, before and after FIX-021 landed.

✅ So these are **load-flaky timing suites**, surfacing under the full 221-suite parallel run. ⚠️ Worth
a task of their own — a deadline test that measures the machine will keep costing sessions the
question *"is that mine?"*, and it cost this one three runs.

### The spec, and the two mutants it was checked against

`tests/code-editor/scriptNodeApi.test.ts` — 17 tests. **Every behavioural row is a pair**: the same
document linted in both modes, so a row asserts a *difference between the nodes* rather than a fact
about one. A change collapsing the two modes back into one fails here instead of passing quietly.

| mutant | result |
|---|---|
| script mode handed `FUNCTION_NODE_GLOBALS` again (undo the globals split) | **8 failed, 9 passed** |
| the script-mode branch in `portDiagnostics` made unreachable | **7 failed, 10 passed** |

Both applied to the real modules and reverted inside one shell call; both files diffed back
byte-identical afterwards.

### ⚠️ NOT driven, and one thing deliberately left standing

**No editor was launched for this.** The message is spec-level; nobody has seen it in a gutter.
✅ **Superseded — DRIVEN session 45, see below.**

🔴 **Left unfixed, on purpose, and it is the next slice:** `unionPorts` calls `minePorts(code)` in
**script** mode too, so the editor's port list for a Script node contains ports mined from
`Inputs.x` / `Outputs.y` text — and the Script node mines **nothing** from its text
(`javascript.ts:831-840` merges `parser.getPorts()`, which comes from `Node.Inputs`/`Outputs`/
`Signals` or `define()`, never from a regex over the document). So FUN-005's rail and FUN-006's bar
can show a Script node ports it does not have. Not folded in here: it is four surfaces, and message 6
does not depend on it.

## ✅ RULING 1 DRIVEN 2026-08-16 (session 45) — and two readings that were wrong before they settled

**Message 6 has now been seen in a gutter.** Live editor, `dev:debug`, fixture
`fix016-msg6-drive` (a `cp -R` of `fix003-drive`; identity confirmed by
`ProjectModel.instance._retainedProjectDirectory`, never by component names). `/Components/PriceDiscount`
carries **both** node types — `Javascript2` `dc5ef4ce…` and `JavaScriptFunction` `js` — so both arms
ran in one component with no project switch between them.

🔴 **The observation was written before the editor was launched**, per the standing rule. All four
predicted cells held; two of them held *only after settling*, and the pre-settle readings said
something else (below).

### The 2×2 — same document, both nodes, read from the live lint state

Read with `@codemirror/lint`'s own `forEachDiagnostic` off the webpack module cache, against
`document.querySelector('.cm-content').cmTile.view.state` — the state the gutter draws from, not a
second opinion about the text.

| document | Script (`Javascript2`) | Function (`JavaScriptFunction`) |
|---|---|---|
| `Outputs.Done();` | ✅ **message 6**, `warning`, `nodegx:ports`, **`actions: []`** | ✅ **nothing on `Outputs`** |
| `define({ inputs:…, outputs:…, run:… })` | ✅ **silent, 0 diagnostics** | ✅ *"No port named define. Create an input port by reading it: `Inputs.define`."* + fix-it |
| `zzzUndefinedThing;` | ✅ plain **`eslint:no-undef`**, *"'zzzUndefinedThing' is not defined."*, no action | ✅ **message 3** + fix-it *"Create input port zzzUndefinedThing"* |

🔴 **The bottom-right cell is the defect s44 found, correctly relocated.** *"No port named define …
`Inputs.define`"* is exactly what was being shown on the **Script** node before `3d3cc974`. It now
appears only on the Function node, where a missing `define` really is a missing port. The same
sentence being right in one cell and wrong in the other is the whole content of the fix, and the 2×2
is the only shape that shows it.

✅ **Every absence sits beside a firing signal on the same instrument**, and the third row is why the
suppression is not over-broad: a *genuine* typo in a Script node is still reported, in JavaScript's
words, with no port notation attached.

✅ **`openNode != null` — the load-bearing gate — is proven by consequence, not by inspection.**
`getCodeAuthoringContext` is not exported, so it could not be read directly; message 6 firing in a
real popout *is* the proof the gate passed, and that `codenotation: 'script'` reached the editor. The
popout's toolbar independently reads **SCRIPT**.

✅ **Rendered, not merely resolved.** The lint gutter carries one `cm-lint-marker-warning`, the header
reads **⚠ 1 warning**, and both the hover tooltip and `.cm-panel-lint` render the full sentence with
`nodegx:ports` beneath it and **no action button** — against the Function node's message 3, which
draws a *"Create input port"* button in the same panel. Screenshots in the session scratchpad
(`fix016-msg6-gutter.png`, `fix016-msg6-panel.png`).

### 🔴 Two instrument failures, both of which produced a *passing* reading

**1. A peer's source save HMR-reloaded the renderer mid-drive and my absence check read as a pass.**
The reload wiped every injected handle (`__view`, `__req`, `__forEach`), closed the popout and dropped
the editor back to the Launcher. The very next check — *"does the diagnostic list still contain the
message-6 text?"* — was a shell `grep` over an eval that had **thrown**, so it matched nothing and
reported the transition I was hoping for, after **zero** polls. **A dead instrument and a cleared
diagnostic are the same string.**
✅ **The repair:** every read returns an explicit `{alive: …}` field and the absence assertions require
`alive === true`. ⚠️ This is [[an-hmr-reload-wipes-injected-cdp-state]] with a new consequence — the
recorded one is *"the click falls through and looks like a feature doing nothing"*; here it looked
like a **feature working**.

**2. 🔴 The linter passes through an intermediate state, and it is indistinguishable from the settled
one except by waiting.** Setting a document clears the old diagnostics *before* the new lint runs, so
`count === 0` is true of both "correctly silent" and "not linted yet".

| arm | at first poll (~0s) | settled (~12–20s) |
|---|---|---|
| Function + `define(…)` | message 4, *"price is declared but never read"* | 🔴 **message 3 on `define`** |
| Function + `Outputs.Done();` | **0 diagnostics** | 🔴 **message 4 on `price`** |
| Script + `define(…)` | 0 diagnostics | ✅ 0 diagnostics (unchanged) |

⚠️ **So the arm-B claim in this write-up is narrower than the one I first recorded.** It is **"no
diagnostic on `Outputs`"**, *not* "silent" — the settled Function node does emit message 4 about
`price`, an unrelated declared port, which is correct behaviour and has nothing to do with this
change. Writing "silent" would have been a true-sounding sentence that a later reader could falsify in
ten seconds.
✅ **A settle of ~20s, and a re-read of every cell after it.** The A(1)→C(0) transition is *some*
evidence the lint re-ran, but it is not sufficient on its own, and I only caught this because the
fourth cell changed its answer under me.

### What is still not driven

⚠️ **The script-mode mining slice is untouched** (`unionPorts` calling `minePorts` in script mode).
This drive says nothing about FUN-005's rail or FUN-006's bar; it read the code editor's lint state
only.
