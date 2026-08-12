# Phase 61 — next session

**Written 2026-08-12, late.** Replaces the evening handover. **Six of nine built, FUN-009 driven and
closed, and the blocker that stood over FUN-004 is gone.** Four build lanes can now run concurrently;
this file is mostly about what makes that safe.

---

## 1. Read this first — what is built vs. what is *proven*

| Task | Built | Driven |
|---|---|---|
| **FUN-001** | ✅ | n/a — ✅ §2 signed, settled |
| **FUN-002** | ✅ | ✅ 6 of 7 · one criterion open, and ⚠️ **unmeasurable as written** — see §6 |
| **FUN-003** | ✅ | ✅ every criterion of its own |
| **FUN-007 §1** | ✅ | ✅ closed · 🔴 **§2's gutter rendering not built** — Lane A's first commit |
| **FUN-009 §0/§2** | ✅ `ace5232f` | ✅ **DRIVEN 2026-08-12, every step passed. F17 closed.** |
| **FUN-009 §1** | ✅ copy only | 🔴 **nothing renders it** — FUN-006 is the first surface that will |
| **FUN-004, 005, 006, 008** | 📋 open | — |
| **FUN-009 §5 (F35)** | 📋 open · 🔴 **five ports, not four** | — |

### ✅ What last session's drive settled, so nobody re-runs it

`codenotation` survives the runtime → editor trip (read live off `NodeLibrary.instance`). The three
popouts render **EXPRESSION / FUNCTION / SCRIPT**. `total * 2` in an Expression lints clean, reads
`✓ Valid`, and still mints the port `total`, while the same text warns in `function` and `script`.
Completions were driven **both ways**: `Inputs.` → `[]` in an Expression but `["Value"]` in a
Function; `Variables.` → two names in an Expression but `[]` in a Function. Full readings are in the
FUN-009 file under *"The drive, run 2026-08-12 evening"*.

🔴 **The consequence for this session: `validationType` is now trustworthy.** FUN-004 §3's BLOCKER is
struck (the task file records it under a fold), and FUN-004, FUN-008 and FUN-009 §5 can all gate on
it. This is what unblocks four concurrent lanes instead of two.

## 1a. ⚠️ `test:ci` — 2700 / 6 / seed 59012, but that reading is now two commits stale

Measured 2026-08-12 15:40 by a sibling, on `0ece138a`. All six failures are the inherited baseline
**by name** — `AI model registry` ×2, `AIX-006 style vocabulary` ×4. It predates `ace5232f`,
`f23d5b4c` and `601dd5d2`. **Re-run once at the top of the session and compare NAMES, not counts.**

⚠️ A run that dies without a `Jasmine:` line **graded nothing** — re-run it, never read exit 1 as
failures, and never compare a count from such a run. A backgrounded wrapper's exit code lies; read the
log. And the *"more than 10000 listeners"* flood is **normal** — ~12,300 in every green run; its
volume tracks how far the run got, so it is a progress counter, not a defect signal.

---

## 2. Machine discipline — read before spawning anything

Four lanes plus however many siblings are live all want one laptop, and this is what cost two of the
last three sessions.

- 🔴 **No lane drives the editor.** All live verification happens in the **main session**,
  **serialised**, one drive at a time (§5). A lane that needs a drive hands its script over; it does
  not launch Electron.
- 🔴 **Check for siblings before every heavy run**, not once at the start: `dev:stop -- --list --all`
  (⚠️ the no-`--` spelling **KILLS**, including a sibling's running `test:ci`) and
  `git log --oneline --since="3 hours ago"`. It was false at 15:35 and true by 16:43 on 2026-08-12.
- ⚠️ **Never two `test:ci` at once**, and never one while a lane is doing anything heavy.
- ⚠️ The editor is a **queue, not a resource to seize.** If a drive is in flight, wait and poll.
  Never `dev:stop` to make room.
- ⚠️ Shared checkout: **never `git stash`, never `git add -A`**, and pathspec-scope both `git add`
  **and** `git commit`. A sibling has had `PortsTab/**`, `TraceSession.ts` and `tests/nodegraph/**`
  uncommitted for over a day. **Leave them.**
- Cut lanes with `scripts/devtools/make-worktree.sh`, from `origin/main`, into
  `../OpenNoodl-worktrees/` — **never** the harness's `isolation: "worktree"`, never a scratchpad.

---

## 3. 🔴 The prelude — one small commit that must land before Lanes A, B and D

**Four open tasks all need the same thing and none of them owns it: the union of the declared ports
(FUN-003's `collectDeclaredPorts`) and the mined ports (`minePorts`), deduplicated, with each output
typed value-or-signal.**

- FUN-004's four messages need it (§1: *"all four need the union"*).
- FUN-005's rail lists it (§1: *"the union of FUN-003's declared list and `minePorts`' mined list"*).
- FUN-006's bar names ports out of it.
- FUN-008 completes against it (*"a completion source over the union of the two port lists"*).

🔴 **It does not exist.** `collectDeclaredPorts` and `minePorts` are separate on purpose —
`authoringContext.ts:69-77` says so explicitly, because *"you declared this port and have not used
it"* is a sentence that needs both lists apart. **Keep them apart; add a third function that unions
them for the consumers that want everything.** Do not merge the two existing ones.

**Build it once, first, in the main session, and land it before the lanes cut.** Three or four lanes
each inventing their own union — with their own answer to "is `Done` a signal?" — is the
*parallel-agents-solve-it-twice* failure in its purest form, and the value/signal answer is exactly
where a silent defect lives (`javascriptnodeparser.js:353-366`: the shape in the text *is* the type).

Suggested shape, in `noodl-core-ui/src/components/code-editor/utils/` beside the two it composes:

```ts
export interface UnionPort { name: string; type: string; declared: boolean; mined: boolean; kind: 'value' | 'signal'; }
export function unionPorts(declared: OpenNodeFact | null, code: string): { inputs: UnionPort[]; outputs: UnionPort[] };
```

⚠️ **Keep `declared` and `mined` as flags on the row rather than collapsing them** — FUN-004's
message 4 and FUN-006's second row both need "declared but not mined", and a plain merged list cannot
express it. That is the whole reason the two sources were kept apart in the first place.

⚠️ **Answer F15 in the same commit** — FUN-004 §4 flags it **unverified** and message 4 depends on it:
does `Noodl.Inputs.foo` get mined as port `foo` by the six regexes in `scriptPorts.ts`? It decides
whether legacy code shows a false *"declared but never read"*. The task file is explicit: *"Test it;
do not reason about it"* — it is a two-line unit test.

⏱️ Perhaps an hour including the test. If Richard would rather not serialise on it, the fallback is
**Lane A builds it and Lanes B/D rebase onto that commit** — but then B and D cannot start until it
lands, which costs more concurrency than the prelude does.

---

## 4. The four lanes

Disjoint by file after the prelude. Ordered within each lane; the lanes themselves are concurrent.

### Lane A — diagnostics · **FUN-007 §2 → FUN-004**
Territory: `esLintDiagnostics.ts`, `CodeEditorType.ts`, plus F31.

1. **FUN-007 §2 first.** The mapped `line`, `column` and `hint` are already on the warning payload and
   the raised error's `detail`. **Nothing renders them.** That is the whole of §2 — same file and same
   knowledge as FUN-004, a small first commit, and it unblocks FUN-007's drive steps 8 and 9.
   ⚠️ Compute the prefix offset rather than hardcoding it, and test against a body whose **first line**
   throws; an error anchored one line off accuses innocent code. ⚠️ A stale error must clear when the
   text changes, as `parseError` already does at `simplejavascript.ts:171-176`.
2. **FUN-004**, the flagship. ✅ Now unblocked — the `validationType` gate works and is measured.
   ⚠️ Message 2 is a **new syntax-tree rule**, not a `no-undef` extension, and a genuine local named
   for an output is a **warning**, never an error.
   ⚠️ Its first acceptance is **two rows driven separately, fresh project each** — implicit globals are
   shared between Function nodes, so the first bare `Output_1` disarms the `ReferenceError`
   project-wide and the second run lies.
3. 🔴 **F31 belongs here** — a warning that stranded and never cleared, with `scriptOutputs: []` and a
   replaced script. **Be sceptical of the mechanism, not the observation:** it did not reproduce on a
   second node given the identical batch, and *"a race with a re-run scheduled against the previous
   script"* is **inference**. Reproduce before fixing.

### Lane B — the chrome · **FUN-006 → FUN-005 §1/§2**
Territory: `JavaScriptEditor.tsx` + `.module.scss`.

⚠️ **These two cannot be separate lanes.** Both mount a new surface inside the same component and the
same stylesheet, and they will conflict line-for-line. One lane, sequential, **bar first**.

- **FUN-006 closes FUN-009 §1 for free.** The copy is already written, specced and exported —
  `NOTATION_RULES` and `expressionPortNote` in `notation.ts`. 🔴 **Nothing renders either today**;
  `NOTATION_RULES`'s only consumer in the whole product is the AI prompt template. FUN-006 is the
  first surface to put any of this phase's copy on screen.
- ⚠️ **Build FUN-006 only in its stateful form.** The task file is unusually direct: a static hint is
  *"worth nothing"* and should not be built. The bar names *their* ports and **retires itself** on
  success.
- ⚠️ **§4 is not decoration: measure contrast in both themes and record the numbers.**
  `TextType.Secondary` is identical to `TextType.Default`, no opacity both dims and stays legible in
  light mode, and CodeMirror `baseTheme`s hardcode colours our tokens never reach — the lint panel
  shipped at **1.36:1** for exactly this reason. If the bar sits inside the CodeMirror DOM, read the
  **computed** colour.
- **FUN-005 §1/§2 after it.** 🔴 **Adopt the sibling's `usePortValues.ts` / `portValues.ts` — do not
  rebuild them.** They were still uncommitted in the shared checkout as of 2026-08-12; check whether
  they have landed. **Do not start §3 in this lane** — live values need the relay and the display
  dialect, and that is where the cost is.
- ⚠️ The popout renders under `flushSync` so `showPopout` can measure it (FH-005). **Anything that
  lays out asynchronously reopens the offscreen-popout defect.**

### Lane C — the runtime ports · **FUN-009 §5 (F35)**
Territory: runtime node definitions, `modes.ts`, possibly `esLintDiagnostics.ts`'s `configFor`.

🔴 **The count is five, not four.** Last session's drive enumerated the live library and found
**`For Each.templateScript`** missing from F35's table. It is not a Function body —
`new Function('item', 'var component;' + value + ';return component;')`, no `Inputs.`/`Outputs.`
anywhere — so three of the five are non-Function bodies, which is a third vote for §5's option (a).

🔴 **First measurement, before any code.** `templateScript`'s *default value* is
`component = '/MyComponent';`, and `component` is not in `globalsFor('function')`, so the node may
**warn about its own seed text** — the very defect FUN-009 just removed from the Expression node.
`lintMessages("component = '/MyComponent';", 'function')` settles it in one line. ⚠️ **It is a
reading, not a measurement** — reproduce it before treating it as true. If it warns, §5 stops being
tidying.

⚠️ `storageJSONFilter` is a **dynamic** port (`dbcollectionnode2.ts:1330-1340`, inside the
`storageFilterType === 'json'` branch). Enumerating node types will not find it.

⚠️ **This lane regenerates the catalog.** `catalog:check` goes red; run `catalog:generate` **and**
`catalog:merge`, and run the **`noodl-mcp` suite** afterwards — it is not in `test:ci` and it has been
red before.

⚠️ **One coordination point with Lane A**: if option (a) lands a fourth mode, it edits `modes.ts`
(`LABELS`/`PLACEHOLDERS`), `NOTATION_MODES` in `CodeEditorType.ts` and a `configFor` case in
`esLintDiagnostics.ts` — two of which Lane A is also in. They are different regions of those files,
but **land Lane C's mode-table commit early and have Lane A rebase**, rather than the reverse; it is
by far the smaller diff.

### Lane D — the keystroke · **FUN-008**
Territory: `noodl-completions.ts`. **Genuinely disjoint from every other lane** — this is the new
lane the FUN-009 drive made safe, and it is the smallest task in the phase.

- ⚠️ **The guard that killed this before**: `word.from === word.to && !context.explicit` kills every
  member position, because the word after a `.` is always zero-length. This task is the mirror image —
  it fires at a **non**-member position on a partial word. **Do not copy the member sources' guards.**
- ⚠️ Must not fire in `'expression'` mode, after a dot, or in a declaration position (`var Inp…`).
- ⚠️ **Drive it; do not unit-test it alone.** *"A completion source that never fires is
  indistinguishable from one that is not installed"* — it has shipped broken in this exact file
  before. ✅ The mechanics now exist: see §6.

---

## 5. The drive queue — main session, serialised, in this order

Every one of these needs the editor, so they are a queue, not a lane. Highest value first, so a short
session still gets the important ones.

1. **Lane C's one-liner** (above) — no editor needed beyond a popout; do it the moment Lane C reports.
2. **FUN-007 drive steps 8 and 9**, unblocked as soon as Lane A's first commit lands.
3. **FUN-004's two rows** — ⚠️ **a fresh project for each**, per F13c.
4. **FUN-008**, which the task file insists must be driven rather than unit-tested.
5. **FUN-006's contrast numbers**, in both themes, recorded.
6. **FUN-003's A→close→B drive** — the one criterion of that task still open, and FUN-005's rail is
   where the clearing defect becomes visible, so it pairs naturally with Lane B landing.
7. **FUN-002's last criterion** — ⚠️ **unmeasurable as written**: it asks for a byte-identical check,
   but opening a project rewrites every component. Either restate the criterion against a single
   component's serialised form or close it as answered; **do not burn a drive on it as written.**

---

## 6. Mechanics worth not rediscovering

- ✅ **Driving the code popout's CodeMirror** (learned last session, and Lanes A, B and D all need it):
  - The live `EditorView` is at **`document.querySelector('.cm-content').cmTile.view`** — *not*
    `.cmView`, and **not enumerable**, so `Object.keys` finds nothing and a first probe concludes
    there is no handle. `Object.getOwnPropertyNames(el)` returns `['cmTile']`.
  - 🔴 **`cdp type` cannot open the completion menu** — `Input.insertText` does not trigger
    autocomplete and `cdp.js` has no key dispatch. Use `startCompletion(view)` and
    `currentCompletions(view.state)` from `@codemirror/autocomplete` off the webpack registry. Read
    `currentCompletions`, not `.cm-tooltip-autocomplete`.
  - ⚠️ **An empty completion list cannot tell a firing branch from a dead one.** Inject with
    `setCodeAuthoringContext({...cur, variables: [...]})`, restore afterwards, and require **both**
    modes to answer non-empty and opposite. This is what made §2's drive evidence rather than assertion.
  - Selecting a node needs the **view** node: `ed.forEachNode(...)` then `ed.selectNode(view)`.
    `ed.selectNode(model)` throws. The Edit button is `button.property-codeeditor-button`.
- **Reading the editor's own node library** — `NodeLibrary.instance` via the chunk registry:
  ```js
  window.webpackChunknoodl_editor.push([['probe'], {probe:(m,e,req)=>{window.__req=req;}}, r=>r('probe')]);
  window.__req('./src/editor/src/models/nodelibrary/nodelibrary.ts').NodeLibrary.instance
  ```
  It is empty until a project is open. 🔴 Never `req()` `projectmodel.ts` this way — it re-evaluates
  and drops the editor to the launcher.
- **Mined ports are not synchronous.** In the creating tick a seeded node has no `in-`/`out-` ports;
  they arrive after a sub-second round trip. They land on `node.dynamicports`, not `node.ports`.
- ⚠️ **`ed.createNewNode` returns `void` and leaves `ed.highlighted` set** — clear it between
  creations or the nodes parent under one another.
- ⚠️ **`cdp click` on a class selector hits the first match** — one opened a GitHub device-login page.
  **Tag the element with a unique `id` in an `eval` first**, every time.
- ⚠️ **`SEED_FUNCTION_BODY` differs from FUN-002's specced string on purpose.** Its comment writes bare
  `Value`/`Result`, never `Inputs.Value`, because **comments are mined into ports**. Do not "restore"
  the spec.
- 🔴 **HMR leaves the mounted editor on the old module** — restart before disbelieving a fix.
- **The editor's preview cannot render a project outside the normal projects location** (404s on
  `index.json`). Use `node scripts/devtools/measure-from-disk.js <dir> --screenshot full --out <p>`.
- 🔴 **A `.gitignore` rule ending in `/` does not match a symlink.** `noodl-runtime/dist-types` was
  committed as a symlink to itself; `build:types` ELOOPed, and because that is `noodl-viewer-react`'s
  `pretest`, that package's suite could not *start*. Fixed in `d5b60f82`, but it had already been
  deleted once and re-merged from a stale worktree branch within the hour. **If a package suite
  refuses to start, suspect a build artefact before a code defect.**
- ⚠️ **A spec can be decoration.** FUN-009's predecessor asserted two branches using type names no port
  in the product has, and passed for the whole of the feature's life. When a gate covers a
  discriminator, **assert the wrong answer too** — reimplement the rejected guess and name the cases
  it gets wrong.
