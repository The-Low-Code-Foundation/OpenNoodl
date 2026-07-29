# Node Register — all 155 catalogued nodes

Generated from `packages/noodl-types/src/node-catalog.json` (catalogFormatVersion 1.0.0).
Regenerate with `node scripts/node-audit/register.js` — hand-written `Verdict` cells are preserved.

⚠️ **The smell columns are stale for the nodes NDA-004 fixed.** They are derived from
`node-catalog.json`, which has not been regenerated since (the tree carried another session's
uncommitted node-source edits, and regeneration folds those in). The hand-written `Verdict`
column is the current truth; the `Mute?`/`Fail?` flags will correct themselves on the next
`node scripts/node-audit/register.js` run after a clean catalog regeneration.

The smell columns are *machine-derivable*, not verdicts.

- **Fail?** — has a signal input and signal outputs, but no failure/error output: the node can go wrong and say nothing.
- **Mute?** — has a signal input and no signal output at all: nothing downstream can sequence off it.
- **Doc%** — share of ports carrying a `description`, i.e. what the property panel and the AI authoring loop can read.

---

## NDA-004 §2 triage — the 50 failure-mute nodes

Criterion 4 asks for every one of the 50 to end up ✅ (has a failure output) or 🔵 (cannot fail,
recorded). This is the triage, and it is **not** all evidence yet. Two grades of confidence, kept
apart on purpose, because the phase's own calibration point is that a structural sweep found none
of the five defects a careful read found:

- **Read** — the implementation was opened and the failure path traced. Binding.
- **Reasoned** — classified from the node's category and port shape without opening the file.
  Provisional. A "reasoned 🔵" is *not* a pass; it is a prediction about where to spend the next
  read, and the Variables category is the warning: 4/4 audited, 3 new defects, in the simplest
  nodes in the library.

### ✅ Fixed this pass (read)

| Node | Failure | Code |
|---|---|---|
| Set Object Properties | `Do` with no object bound wrote nothing and said nothing | `set-object-properties/no-object` |
| Set Record Properties | `Store Type = local` was silent while `cloud` reported — two branches of one node disagreeing | `Missing Record Id` via `setError` |
| Add Record Relation | `validateInputs` returned early without an editor connection, then two bare `return`s: **deployed, it validated nothing and did nothing** | via `setError` |
| Remove Record Relation | twin of the above | via `setError` |

### 🔵 Decided, on evidence (read)

| Node | Why it gets no `Failure` |
|---|---|
| **Object** | Its `Store` is not an action. There is no `Do` — `scheduleStore` is reached from *any* value arriving at a `prop-…` port, so an Object node whose Id has not arrived yet reaches the "no model" branch once per incoming value, on the ordinary boot path. The values are deliberately retained in `dirtyValues` and written when an object appears. A `Failure` here fires on the happy path, which the contract names as worse than no port. **This one looked exactly like the four above and is not** |
| **Create New Object** | Builds its own object (`Model.get()` with no id), so it cannot fail to find one. Correctly does *not* get `addFailure`, and correctly does not get `repeaterComponent` either (`addModelId({ includeOutputs: true })` leaves `includeInputs` falsy) |
| **Record** | Its `scheduleStore` is dead code — nothing calls it (`userInputSetter` writes `inputValues`, and `updatePorts` publishes `prop-` as *outputs*). Its `setModel` guard is the class-F path, already reported by `foreachitem.ts` |

### 🔵 Reasoned — the smell is a false positive (not read)

**Visual nodes (9):** Checkbox, Component Stack, Drag, Group, Page, Page Router, Text Input ×2,
Video. Their "signal outputs" are DOM lifecycle and pointer events (`didMount`, `hoverStart`,
`onClick`); their "signal input" is `mounted`. They are not action nodes. Two carry a caveat worth
the next reader's time: **Video** takes a `play` action, and `HTMLMediaElement.play()` returns a
*rejected promise* under browser autoplay policy — a real, common, currently-invisible failure, so
this one is a likely ✅ once read. **Component Stack** genuinely acts, but NDA-008 §3 decided
deliberately that the stack does not raise: the Pop/Navigate nodes own the port and the provenance.

**Variables (4):** Boolean, Color, Number, String. Named by the spec itself as the 🔵 example.

**Logic and Math (3):** Condition, Switch, Counter. A condition being false is not a failure
(contract, "what counts as a failure").

**Utilities (1):** Delay. A timer that runs cannot fail.

### ⏳ Not yet decided (not read) — where the next pass should go

Ordered by expected yield, highest first. Every one of these takes a signal and acts:

1. **Expression** — a malformed expression is a real failure and `expression-evaluator.ts` already
   has a `compileExpression` returning `null` (visible in the jest console output as a caught
   parse error). Almost certainly ✅.
2. **Open File Picker** — has `success` and no counterpart; cancel and read-error are both real.
3. **Show Popup** — a target component that does not resolve. Overlaps NDA-010 §3 (stack policy),
   so sequence it after that decision rather than before.
4. **Push Component To Stack / Navigate** — a target page that does not resolve. `navigate.ts`
   already returns early on `_findPage` missing.
5. **States** — `goToState` with a name that is not in the list.
6. **Array family** (Array, Array Filter, Clear Array, Create New Array, Insert Object Into Array,
   Remove Object From Array) — the same "no collection bound" question the Object family just
   answered, and the same trap: check whether the trigger is an author `Do` or a value arriving.
7. **Filter Records, State History, Stream Buffer, Set Variable, Repeater Item.**
8. **Component Object / Parent Component Object / Set Component Object Properties / Set Parent
   Component Object Properties** (4, plus 3 deprecated twins) — NDA-015 gave these *raising* but
   not `Failure` **ports**. They are the cheapest remaining ✅s, because the resolution and the
   message already exist.
9. **Deprecated (5):** Animation, Transition, Array, Object, Variable, Parent Component State,
   Script Downloader. Decide as a group whether deprecated nodes are in scope at all.

| # | Node | Category | Ports (in/out) | Fail? | Mute? | Doc% | SSR | Runtimes | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Animate To Value | Animation | 4/2 |  |  | 0% | partial | browser |  |
| 2 | Animation _(deprecated)_ | Animation | 13/2 | ⚠️ |  | 0% | partial | browser |  |
| 3 | States | Animation | 4/2 | ⚠️ |  | 0% | partial | browser |  |
| 4 | Transition _(deprecated)_ | Animation | 6/2 | ⚠️ |  | 0% | partial | browser |  |
| 5 | Request | Cloud | 2/3 |  |  | 0% | — | cloud |  |
| 6 | Response | Cloud | 4/0 |  | ⚠️ | 0% | — | cloud | ✅ NDA-004 §3 — `Sent`/`Failure`/`Error`. `response/no-request-in-scope` (the callback was never installed — previously a `TypeError` out of an input setter) and `response/already-sent` (the second answer, previously discarded in silence). `Sent` fires *before* delivery because delivering tears the request scope down synchronously |
| 7 | Send Email | Cloud | 7/3 |  |  | 0% | — | cloud |  |
| 8 | Aggregate Records | Cloud Services | 1/3 |  |  | 0% | — | cloud |  |
| 9 | Cloud File | Cloud Services | 1/2 |  |  | 0% | safe | browser, cloud |  |
| 10 | Cloud Function _(deprecated)_ | Cloud Services | 3/3 |  |  | 0% | safe | browser |  |
| 11 | Cloud Function | Cloud Services | 1/3 |  |  | 0% | safe | browser |  |
| 12 | Config | Cloud Services | 0/0 |  |  | 100% | safe | browser, cloud |  |
| 13 | Log In | Cloud Services | 3/3 |  |  | 0% | safe | browser |  |
| 14 | Log Out | Cloud Services | 1/3 |  |  | 0% | safe | browser |  |
| 15 | Model _(deprecated)_ | Cloud Services | 8/9 |  |  | 0% | safe | browser |  |
| 16 | Query Collection _(deprecated)_ | Cloud Services | 0/8 |  |  | 0% | safe | browser |  |
| 17 | Query Records | Cloud Services | 0/7 |  |  | 0% | safe | browser, cloud |  |
| 18 | Record | Cloud Services | 3/5 |  |  | 0% | safe | browser, cloud | 🔵 NDA-004 §2 — its `scheduleStore` is dead code (nothing calls it); its `setModel` guard is the class-F path, already reported by `foreachitem.ts` |
| 19 | Request Magic Link | Cloud Services | 3/3 |  |  | 0% | partial | browser |  |
| 20 | Request Password Reset _(deprecated)_ | Cloud Services | 2/3 |  |  | 0% | safe | browser |  |
| 21 | Reset Password _(deprecated)_ | Cloud Services | 4/3 |  |  | 0% | safe | browser |  |
| 22 | Send Email Verification _(deprecated)_ | Cloud Services | 2/3 |  |  | 0% | safe | browser |  |
| 23 | Set User Properties | Cloud Services | 3/3 |  |  | 0% | safe | browser, cloud |  |
| 24 | Sign File URL | Cloud Services | 2/7 |  |  | 0% | safe | browser, cloud |  |
| 25 | Sign In With | Cloud Services | 3/5 |  |  | 0% | partial | browser |  |
| 26 | Sign Up | Cloud Services | 4/3 |  |  | 0% | safe | browser |  |
| 27 | Upload File | Cloud Services | 3/9 |  |  | 0% | safe | browser |  |
| 28 | User | Cloud Services | 1/8 |  |  | 0% | partial | browser, cloud |  |
| 29 | Verify Email _(deprecated)_ | Cloud Services | 3/3 |  |  | 0% | safe | browser |  |
| 30 | Component Inputs | Component Utilities | 0/0 |  |  | 100% | safe | browser, cloud |  |
| 31 | Component Object _(deprecated)_ | Component Utilities | 3/3 | ⚠️ |  | 0% | safe | browser |  |
| 32 | Component Object | Component Utilities | 2/2 | ⚠️ |  | 0% | safe | browser |  |
| 33 | Component Outputs | Component Utilities | 0/0 |  |  | 100% | safe | browser, cloud |  |
| 34 | Parent Component Object _(deprecated)_ | Component Utilities | 3/3 | ⚠️ |  | 0% | safe | browser |  |
| 35 | Parent Component Object | Component Utilities | 2/2 | ⚠️ |  | 0% | safe | browser |  |
| 36 | Set Component Object Properties | Component Utilities | 2/1 | ⚠️ |  | 0% | safe | browser |  |
| 37 | Set Parent Component Object Properties | Component Utilities | 2/1 | ⚠️ |  | 0% | safe | browser |  |
| 38 | CSS Definition | CustomCode | 1/0 |  |  | 0% | safe | browser |  |
| 39 | Expression | CustomCode | 2/8 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 40 | Function | CustomCode | 4/0 |  | ⚠️ | 0% | partial | browser, cloud | ✅ NDA-004 §3 — Success/Failure/Error added; built-ins are collision-free because author outputs are all `out-`prefixed |
| 41 | Logic Builder | CustomCode | 3/1 |  | ⚠️ | 0% | safe | browser, cloud | ⏳ NDA-004 §3 pending — file is mid-rewrite by another workstream; do not touch until that lands |
| 42 | Script | CustomCode | 5/0 |  |  | 0% | partial | browser |  |
| 43 | Action Dispatcher | Data | 12/21 |  |  | 27% | safe | browser, cloud |  |
| 44 | Action Handler | Data | 8/6 |  |  | 36% | safe | browser, cloud |  |
| 45 | Add Record Relation | Data | 4/4 |  |  | 13% | safe | browser, cloud | ✅ NDA-004 §2 — `validateInputs` returned early with no editor connection, so **deployed it validated nothing** and the caller then hit two bare `return`s. Now returns the verdict and the caller fails through `setError` |
| 46 | Array _(deprecated)_ | Data | 9/8 | ⚠️ |  | 0% | safe | browser |  |
| 47 | Array | Data | 3/6 | ⚠️ |  | 0% | safe | browser |  |
| 48 | Array Filter | Data | 3/4 | ⚠️ |  | 0% | safe | browser |  |
| 49 | Array Map | Data | 2/3 |  |  | 0% | safe | browser |  |
| 50 | Clear Array | Data | 2/1 | ⚠️ |  | 0% | safe | browser |  |
| 51 | Create New Array | Data | 2/2 | ⚠️ |  | 0% | safe | browser |  |
| 52 | Create New Object | Data | 2/2 | ⚠️ |  | 0% | safe | browser, cloud | 🔵 NDA-004 §2 — builds its own object, so it cannot fail to find one. Correctly gets neither `addFailure` nor `repeaterComponent` |
| 53 | Create New Record | Data | 3/4 |  |  | 0% | safe | browser, cloud |  |
| 54 | Create Record | Data | 1/6 |  |  | 0% | safe | browser |  |
| 55 | Delete Record | Data | 3/4 |  |  | 14% | safe | browser, cloud |  |
| 56 | Delete Record | Data | 1/4 |  |  | 0% | safe | browser |  |
| 57 | Filter Records | Data | 3/4 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 58 | Global Store | Data | 4/6 |  |  | 0% | safe | browser, cloud |  |
| 59 | HTTP Request | Data | 3/7 |  |  | 0% | safe | browser |  |
| 60 | Insert Object Into Array | Data | 3/1 | ⚠️ |  | 0% | safe | browser |  |
| 61 | JSON Stream Parser | Data | 5/10 |  |  | 7% | safe | browser, cloud |  |
| 62 | Object _(deprecated)_ | Data | 6/5 | ⚠️ |  | 0% | safe | browser |  |
| 63 | Object | Data | 4/3 | ⚠️ |  | 0% | safe | browser, cloud | 🔵 NDA-004 §2 — **read and deliberately left silent.** Its `scheduleStore` has the same shape as Set Object Properties' but no `Do`: it is reached from any value arriving at a `prop-…` port, so failing would fire on the ordinary boot path. Values are retained and written when an object arrives |
| 64 | Optimistic Update | Data | 10/12 |  |  | 18% | safe | browser, cloud |  |
| 65 | Pattern Extractor | Data | 5/10 |  |  | 13% | safe | browser, cloud |  |
| 66 | Query Data | Data | 1/8 |  |  | 0% | safe | browser |  |
| 67 | Remove Object From Array | Data | 3/1 | ⚠️ |  | 0% | safe | browser |  |
| 68 | Remove Record Relation | Data | 4/4 |  |  | 13% | safe | browser, cloud | ✅ NDA-004 §2 — twin of Add Record Relation |
| 69 | Repeater Item | Data | 1/3 | ⚠️ |  | 0% | safe | browser |  |
| 70 | REST | Data | 6/3 |  |  | 0% | safe | browser, cloud |  |
| 71 | Run Tasks | Data | 6/4 |  |  | 0% | safe | browser, cloud | ✅ NDA-004 — raises `run-tasks/no-completion-output` and ends the run instead of hanging (corpus F1/F1′). NDA-009 §1 still owes the editor-time check |
| 72 | Server-Sent Events | Data | 17/17 |  |  | 18% | client-only | browser, cloud |  |
| 73 | Set Global Store | Data | 6/2 |  |  | 0% | safe | browser, cloud |  |
| 74 | Set Object Properties | Data | 4/2 | ⚠️ |  | 0% | safe | browser, cloud | ✅ NDA-004 §2 — `Failure`/`Error` and `set-object-properties/no-object`. `Do` with no object bound wrote nothing and said nothing. Raises in `explicit` mode only; in `foreach` mode `foreachitem.ts` already raised the precise reason, and the graph surface fires either way |
| 75 | Set Record Properties | Data | 6/4 |  |  | 10% | safe | browser, cloud | ✅ NDA-004 §2 — the two branches of `Store Type` disagreed: `cloud` answered a missing Id with `setError`, `local` returned silently. Same node, same author mistake, and whether they heard about it depended on an enum |
| 76 | Set Variable | Data | 3/1 | ⚠️ |  | 0% | safe | browser |  |
| 77 | State History | Data | 6/8 | ⚠️ |  | 29% | safe | browser, cloud |  |
| 78 | State Snapshot | Data | 5/6 |  |  | 9% | safe | browser, cloud |  |
| 79 | Static Array | Data | 3/2 |  |  | 0% | safe | browser |  |
| 80 | Stream Buffer | Data | 7/8 | ⚠️ |  | 20% | partial | browser, cloud |  |
| 81 | Subscribe To Changes | Data | 0/10 |  |  | 0% | client-only | browser |  |
| 82 | Subscribe to Store | Data | 2/4 |  |  | 17% | safe | browser, cloud |  |
| 83 | Text Accumulator | Data | 6/13 |  |  | 16% | safe | browser, cloud |  |
| 84 | Undo / Redo | Data | 5/6 |  |  | 0% | safe | browser, cloud |  |
| 85 | Update Record | Data | 1/5 |  |  | 0% | safe | browser |  |
| 86 | Variable _(deprecated)_ | Data | 4/5 | ⚠️ |  | 0% | safe | browser |  |
| 87 | Variable | Data | 3/4 | ⚠️ |  | 0% | safe | browser |  |
| 88 | WebSocket | Data | 18/18 |  |  | 31% | client-only | browser, cloud |  |
| 89 | Receive Event | Events | 3/1 |  |  | 0% | safe | browser |  |
| 90 | Send Event | Events | 4/0 |  | ⚠️ | 0% | safe | browser | ✅ NDA-004 — `Sent`/`Failure`; empty channel name reported rather than dispatched into the void |
| 91 | Color Blend | Interpolation | 1/1 |  |  | 0% | safe | browser |  |
| 92 | Number Blend _(deprecated)_ | Interpolation | 2/1 |  |  | 0% | safe | browser |  |
| 93 | Script Downloader _(deprecated)_ | Javascript | 2/1 | ⚠️ |  | 0% | client-only | browser |  |
| 94 | And | Logic | 0/1 |  |  | 0% | safe | browser, cloud |  |
| 95 | Condition | Logic | 2/4 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 96 | Inverter | Logic | 1/1 |  |  | 0% | safe | browser, cloud |  |
| 97 | Or | Logic | 0/1 |  |  | 0% | safe | browser, cloud |  |
| 98 | Signal To Index _(deprecated)_ | Logic | 0/2 |  |  | 0% | safe | browser |  |
| 99 | Switch | Logic | 4/4 | ⚠️ |  | 0% | safe | browser |  |
| 100 | Value Changed | Logic | 1/1 |  |  | 0% | safe | browser |  |
| 101 | Counter | Math | 7/2 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 102 | Number Remapper | Math | 6/1 |  |  | 0% | safe | browser |  |
| 103 | Close Popup | Navigation | 3/0 |  | ⚠️ | 0% | safe | browser | ✅ NDA-004 §2 — `Closed`/`Failure`/`Error`; no-popup-in-scope now reported. Targeting stays NDA-010 §2 / NDA-015 |
| 104 | External Link | Navigation | 3/0 |  | ⚠️ | 0% | safe | browser | ✅ NDA-004 — `Success`/`Failure`/`Error`; catches the popup-blocker case that made the button look dead |
| 105 | Navigate | Navigation | 2/1 | ⚠️ |  | 0% | safe | browser |  |
| 106 | Navigate To Path | Navigation | 4/0 |  | ⚠️ | 0% | safe | browser | ✅ NDA-004 — `Success`/`Failure`/`Error`; the `path === undefined` return is no longer silent |
| 107 | Page Inputs | Navigation | 2/0 |  |  | 0% | safe | browser |  |
| 108 | Pop Component Stack | Navigation | 3/0 |  | ⚠️ | 0% | safe | browser | ⏳ NDA-004 §3 pending |
| 109 | Push Component To Stack | Navigation | 3/1 | ⚠️ |  | 0% | safe | browser |  |
| 110 | Show Popup | Navigation | 2/1 | ⚠️ |  | 0% | safe | browser |  |
| 111 | Device Orientation _(deprecated)_ | Sensors | 0/3 |  |  | 0% | client-only | browser |  |
| 112 | String Format | String Manipulation | 1/1 |  |  | 0% | safe | browser, cloud |  |
| 113 | Substring | String Manipulation | 3/1 |  |  | 0% | safe | browser, cloud |  |
| 114 | Unique Id | String Manipulation | 1/1 |  | ⚠️ | 0% | safe | browser, cloud | ✅ NDA-004 §3 — `Generated` |
| 115 | Boolean To String | Utilities | 3/2 |  |  | 0% | safe | browser, cloud |  |
| 116 | Date To String | Utilities | 2/3 |  |  | 0% | safe | browser, cloud |  |
| 117 | Delay | Utilities | 5/2 | ⚠️ |  | 0% | partial | browser |  |
| 118 | Globals _(deprecated)_ | Utilities | 0/0 |  |  | 100% | safe | browser |  |
| 119 | Index To String _(deprecated)_ | Utilities | 1/2 |  |  | 0% | safe | browser |  |
| 120 | Open File Picker | Utilities | 3/6 | ⚠️ |  | 0% | client-only | browser |  |
| 121 | Screen Resolution | Utilities | 0/3 |  |  | 0% | client-only | browser |  |
| 122 | String Mapper | Utilities | 2/1 |  |  | 0% | safe | browser, cloud |  |
| 123 | Boolean | Variables | 2/3 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 124 | Color | Variables | 2/3 | ⚠️ |  | 0% | safe | browser |  |
| 125 | Number | Variables | 2/3 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 126 | String | Variables | 2/4 | ⚠️ |  | 0% | safe | browser, cloud |  |
| 127 | Button | Visual | 48/21 |  |  | 1% | safe | browser |  |
| 128 | Button | Visual | 79/20 |  |  | 5% | safe | browser |  |
| 129 | Checkbox | Visual | 39/21 |  |  | 2% | safe | browser |  |
| 130 | Checkbox | Visual | 76/20 | ⚠️ |  | 1% | safe | browser |  |
| 131 | Circle | Visual | 33/14 |  |  | 6% | safe | browser |  |
| 132 | Columns | Visual | 10/9 |  |  | 0% | safe | browser |  |
| 133 | Component Children | Visual | 0/0 |  |  | 100% | safe | browser |  |
| 134 | Component Stack | Visual | 9/11 | ⚠️ |  | 0% | partial | browser |  |
| 135 | Drag | Visual | 16/16 | ⚠️ |  | 0% | safe | browser |  |
| 136 | Dropdown | Visual | 91/20 |  |  | 5% | safe | browser |  |
| 137 | Field Set _(deprecated)_ | Visual | 33/9 |  |  | 12% | safe | browser |  |
| 138 | Form _(deprecated)_ | Visual | 33/10 |  |  | 12% | safe | browser |  |
| 139 | Group | Visual | 85/20 | ⚠️ |  | 9% | safe | browser |  |
| 140 | Icon | Visual | 30/8 |  |  | 3% | safe | browser |  |
| 141 | Image | Visual | 62/16 |  |  | 10% | safe | browser |  |
| 142 | Label _(deprecated)_ | Visual | 57/9 |  |  | 8% | safe | browser |  |
| 143 | Options | Visual | 52/21 |  |  | 7% | safe | browser |  |
| 144 | Page | Visual | 23/9 | ⚠️ |  | 0% | safe | browser |  |
| 145 | Page Router | Visual | 9/11 | ⚠️ |  | 0% | safe | browser |  |
| 146 | Radio Button | Visual | 39/20 |  |  | 2% | safe | browser |  |
| 147 | Radio Button | Visual | 76/19 |  |  | 1% | safe | browser |  |
| 148 | Radio Button Group | Visual | 33/11 |  |  | 11% | safe | browser |  |
| 149 | Range | Visual | 40/22 |  |  | 2% | safe | browser |  |
| 150 | Repeater | Visual | 5/1 |  | ⚠️ | 0% | safe | browser | ✅ NDA-004 §3 — `Items Rendered`, fired when the operation queue drains (not when `refresh()` returns) |
| 151 | Slider | Visual | 92/21 |  |  | 1% | safe | browser |  |
| 152 | Text | Visual | 43/14 |  |  | 14% | safe | browser |  |
| 153 | Text Input | Visual | 55/21 | ⚠️ |  | 7% | safe | browser |  |
| 154 | Text Input | Visual | 97/21 | ⚠️ |  | 4% | safe | browser |  |
| 155 | Video | Visual | 66/21 | ⚠️ |  | 8% | safe | browser |  |
