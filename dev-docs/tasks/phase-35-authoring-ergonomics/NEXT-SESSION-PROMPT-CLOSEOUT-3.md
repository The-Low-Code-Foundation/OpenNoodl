# Next-session prompt — phase 35 closeout, part 3

**Supersedes [`NEXT-SESSION-PROMPT-CLOSEOUT-2.md`](./NEXT-SESSION-PROMPT-CLOSEOUT-2.md)**, whose §A
(ERG-004 live QA) is done. That file is still worth reading for §D's asynchrony-marker measurement
and §E's `sendValue` write-up, which are unchanged and reproduced in outline below; its §A and its
"reusable asset" section are now stale — the `erg-qa` project has been superseded by `erg004-qa`.

Written 2026-08-02 at `db4fb45e`. **A concurrent session was live in the checkout** — see the
warning below, which is again not boilerplate.

## What the last session did

| Thing | State |
|---|---|
| **ERG-004 live QA (§A)** | ✅ **Done, 7/7.** Every row of `ERG-004-NOTES.md` §4.1 driven, each class twice |
| **🔴 Output port descriptions never reached the editor** | ✅ Found by that QA, fixed + tested (`62fdc4ec`) |
| **🔴 `Object Changed` has no producer in the library** | ⚠️ **Referred — needs Richard.** See §A below |
| **A reusable QA-project generator** | ✅ `dev-docs/qa-fixtures/generate-erg004.py`, documented in that folder's README |
| **ERG-005 §0 (was §B)** | ❌ Not started. **Now the headline gap** |
| **ERG-003's remaining live rows (was §C)** | ❌ Not started |
| **The asynchrony marker (was §D)** | ❌ Blocked on Richard, unchanged |
| **The `sendValue` sweep (was §E)** | ❌ Not started |
| **ERG-002's four remainders + ERG-003 Option A (was §F)** | ❌ Not started |

**Gates on the current tree.** Runtime jest **113 of 114 suites** (one deliberately skipped),
**2117 passed, 0 failed**, no new stderr. `tsc -p packages/noodl-runtime --noEmit` clean, eslint
clean on the changed files. `catalog:check`, `catalog:merge:check` and `catalog:examples`
(**50/50**) all green. The editor's Electron/jasmine suite and the viewer-react/core-ui/editor-jest
suites were **not** re-run — the runtime change is the only code change and nothing in those
packages imports `nodelibraryexport`, but that is an argument, not a measurement.

## ⚠️ Concurrency — check, and check the right thing

At the last session's start `git status` showed two foreign files and no Electron was running; it
took the editor and gave it back. At the end, **another session was running the editor's jasmine
suite** in this checkout (`Electron test.js --ci`, pid 17405) — which is *not* the editor app, so
`--target=editor` would have found nothing while the checkout was very much in use.

- **Before launching or stopping anything**, run `ps -eo pid,lstart,command | grep -i electron` and
  read the *command*, not just the count. `Electron . --dev` is the app; `Electron test.js --ci` is
  someone's test run and `npm run dev:stop` **will kill it**.
- Prefer `npm run dev:stop -- --list`, which kills nothing.
- ⚠️ **`packages/noodl-core-ui/.../json-editor/utils/listValueCodec.ts` and its test are still
  uncommitted in the tree** — they have been since 18:10 on 2026-08-02 and belong to another
  session. They are an ERG-003 improvement (an incoming proplist id is treated as a hint, not an
  authority). **Do not touch, stash, or commit them.** Check whether they have landed before you
  edit anything under `json-editor/`.
- **Never `git stash`, never `git add -A`, never `git checkout <path>` on a file you have edited.**
- ⚠️ **A pathspec on `git add` is not enough — `git commit` needs one too:**
  `git commit -m "…" -- <paths>`. Two sessions running have now depended on this.

## The work, in the order it is worth doing

### A. ⚠️ `Object Changed` has no producer — a decision for Richard, and it blocks nothing else

**Ask Richard early**, because it is the only item here that cannot start without him, and the
answer is cheap to act on afterwards.

Measured live, in full in [`ERG-004-NOTES.md`](./ERG-004-NOTES.md) §7.4:

- **Nothing in the node library outputs a live Noodl `Object`.** Seven ports declare output type
  `object` and not one is a `Model`, which is what `Object Changed` needs.
- The whole Data category identifies objects by **string id** — `Model2.modelId` in, `Model2.id`
  out, `SetModelProperties.modelId`, `Collection2.collectionId`.
- So an author wires `Object.Id → Object Changed.Object`. The typecast table permits it
  (`string → object`). `node.ts:360-390` then `eval`s the string as a JS literal — `eval('(qa-obj)')`
  — which throws `ReferenceError: qa is not defined`, and **`{}` is substituted**, so the node
  watches nothing for the life of the app.
- It **does** warn (`invalid-object`, and it reaches the topbar chip). The message is useless to an
  author: it names a JavaScript identifier they never wrote.
- Today the only way to feed either node is a `Script` node returning `Noodl.Object.get(id)`.

Recommended option, and ⚠️ **the ordering constraint that makes it non-trivial**: resolve an id
string on the input with `(this.nodeScope.modelScope || Model).get(id)`, exactly the line
`modelnode2.ts:361` already uses. **It has to run before `node.ts`'s string→object `eval`, which
currently gets there first — so the port cannot stay declared as plain `object`.** Work out how
that is expressed before promising the fix is small.

### B. ⚠️ ERG-005 §0 — the phase's last blocking measurement, and it needs the editor

**Now the headline gap.** Five questions in [`ERG-005-COMPONENT-INTERFACE.md`](./ERG-005-COMPONENT-INTERFACE.md)
§0, about how a `Component Input`'s type is inferred from what it connects to inside the component:
first connection or most recent; two connections of different types; what happens when the
type-supplying connection is deleted; whether outputs follow the same rule; and **whether the
inferred type reaches the catalog** or is editor-only. §1 and §2 are unwritable until §0 is answered.

⚠️ **§0 forbids answering from source, and the last session confirmed why from a third direction.**
`Function`'s per-input Type dropdowns do not exist until a viewer is running — they are created by
`JavascriptModule.setup()` (`javascript.ts:706`), which returns immediately unless
`context.editorConnection.isRunningLocally()`. A project with no home component never mounts a
viewer, so parameters sit correctly on the node while the property panel shows nothing, and it reads
exactly like a defect. **Set `rootNodeId` in `project.json` to a visual node before concluding
anything about a dynamic port.**

⚠️ **And a fourth direction, new:** the runtime registers a `Script` node's outputs from
`this.model.outputPorts` — what the *exported graph* carries — **not** from the ports its own parser
derives from the code. A hand-authored node with `"dynamicports": []` parses fine, runs `setup`
fine, and throws *"doesn't have a port named obj"* the moment `setup` touches an output. If §0's
answer depends on a port that "should exist", check the exported graph before filing a defect.

**Use `dev-docs/qa-fixtures/generate-erg004.py` as the template.** It is a working, committed
recipe for a hand-authored project that actually runs, and the folder's README lists the four traps
building one costs. Two of its patterns matter for §0: labelled readout rows (reading a value by DOM
position produced a confident wrong conclusion), and driving mutations from CDP against the runtime
rather than clicking.

### C. ERG-003's remaining live rows — needs the editor

`ERG-003-NOTES.md` §4 C1 has the table. Outstanding: `Global Store.initialState` JS-literal
recovery, `Repeater.items` binding chip, legibility at 20+ entries, undo/redo. ⚠️ Check first
whether the uncommitted `listValueCodec.ts` in the tree has landed — it changes proplist id
handling and one of these rows may need re-reading against it.

### D. Two follow-ups the last session's own fix opened — neither needs the editor

Both are recorded in [`ERG-004-NOTES.md`](./ERG-004-NOTES.md) §7.7 and neither is large:

1. **Nothing in the editor renders a port description** — not the property editor, not the node
   picker preview, not the canvas port hover — **for inputs either.** Grepped and confirmed. The
   library-wide fix restored the *data*; no author sees it yet. This is now the cheapest large win
   in the phase: ~1656 input and ~1031 output descriptions are sitting in `NodeLibrary` unread.
   **Unowned.**
2. **A 14-port discrepancy.** The committed catalog documents 1045 of 1144 output ports; the editor
   export now carries 1031. Both read the same node definitions. Unexplained, named rather than
   rounded off, and small enough to be a half-hour diff.

### E. The asynchrony marker — ⚠️ still needs a decision from Richard

Unchanged from the previous prompt. NDA-017's `signal-driven-stale-input` rule is
`defaultEnabled: false` and criterion 6 is not met: ERG-001 made `Done`/`Completed` universal,
which was the rule's only proxy for *"this producer is asynchronous"* (53 → 97 of 153 node types),
so it began firing on four shipped examples including the canonical latched counter, where its
suggested fix is an infinite loop.

**Do not try to rescue it by narrowing port names** — measured, and it fails in both directions. It
needs a structured marker the catalog carries in its own right, over ~150 node types.
`runtimeBehavior` in the enrichment catalog is the natural home but is prose today. **Where the
field lives is Richard's call.** Full measurement in
[`NDA-017-SIGNAL-INPUT-FRESHNESS.md`](../phase-30-node-library-audit/NDA-017-SIGNAL-INPUT-FRESHNESS.md#-the-asynchrony-proxy-is-dead-2026-08-02).
The rule's tests read the **real** catalog and will fail loudly when a marker lands — that is the
signal to flip it back on, not a regression.

### F. The unowned `sendValue` defect — still unowned

Unchanged. `Node.prototype.sendValue` returns early on `undefined` (`node.ts:688`, inside the
function at `:682`) and the receiver drains with `Object.keys(this._inputValuesQueue)`
(`node.ts:567`) — insertion order of keys created on each port's **first** delivery.

⚠️ These two line numbers were re-checked at `db4fb45e`; `ERG-004-NOTES.md` §1 still cites `:706`
and `:566` for the same two lines, from an earlier state of the file. **Grep for the function, not
the line.** A value port that is `undefined` the first time gets its key created
*after* the signal that already fired, and is delivered **behind that signal for the life of the
node**. ERG-004 fixed only its own two nodes, by emitting `null` rather than `undefined`.

**Latent in any node pairing a signal with a possibly-undefined value port. A test that exercises
the node once cannot see it — drive every candidate twice.** ERG-004's live QA has now confirmed
the fixed shape survives a real frame clock, so the pattern to copy is known; only the sweep is
missing.

### G. ERG-002's four remainders, and ERG-003 Option A — neither needs the editor

Both described in full in [`NEXT-SESSION-PROMPT-CLOSEOUT.md`](./NEXT-SESSION-PROMPT-CLOSEOUT.md)
§2B and §2E; neither has been started. ERG-002's criteria 4 and 6 need a **real deployed build** —
the spec is explicit that the preview is not evidence.

---

## The prompt

Continue **phase 35 (Track T)** on branch `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`. Read
`dev-docs/tasks/phase-35-authoring-ergonomics/NEXT-SESSION-PROMPT-CLOSEOUT-3.md` in full first,
then the `README.md` for the phase, then the spec and `-NOTES.md` of whichever task you take.

**Check for a concurrent session before touching anything**, and read the *command* of any Electron
process you find — the check that would have misled last time is named above. If another session
holds the editor, take **§A** or **§E** (both after Richard answers), or **§D**, **§F** or **§G**,
none of which need it. If you own the editor, take **§B** first: it is the phase's last blocking
measurement and a session that owns the checkout is the scarce resource.

**Standing rules for this phase.** An inherited claim is a hypothesis you must test — this phase has
now overturned premises in three of its own specs, and every correction was written back into the
spec file rather than left in a report. Where a measurement contradicts a spec, **the measurement
wins and you correct the spec.** `description` is canonical; enrichment `ports` may only add what
the source cannot know. A declared `default` never runs its setter, so the default behaviour must be
correct without it. `dev-docs/reference/COMPATIBILITY-POLICY.md` is binding: existing Noodl projects
are not a design constraint.

⚠️ **Three lessons, the third new and the most expensive of the phase so far.**

1. **A green unit suite can be testing nothing.** NDA-017's rule shipped broken because its tests
   used a hand-built catalog whose synchronous stand-in declared no completion signal. Before
   trusting a passing suite, confirm your new cases actually *ran*, and confirm they *fail* without
   the fix — the last session restored the pre-fix body to prove its new suite caught the defect,
   and 4 of 6 rows failed as they should have.
2. **A missing dynamic port is usually a missing viewer, not a defect.** See §B. Check the mechanism
   before filing the consequence.
3. 🔴 **A green catalog is not evidence that an author can read anything.** Every output-port
   description in the library was being dropped between the runtime and the editor — **0 of 1144**
   — while `catalog:check`, `catalog:merge:check` and the 153/153 enrichment sweep were all green,
   because the catalog generator builds its ports from its **own** capture of the node definitions
   and never crosses that boundary. **When a claim is about what the editor shows, measure the
   editor.** The recipe for doing that — reaching editor singletons like `NodeLibrary` and
   `WarningsModel` through the webpack module cache over CDP — is in `ERG-004-NOTES.md` §7.3 and
   §7.5.

**Report honestly.** Say which success criteria are met, which are outstanding, and which are
blocked — and on what. Debt that is named survives; debt that is dropped does not.
