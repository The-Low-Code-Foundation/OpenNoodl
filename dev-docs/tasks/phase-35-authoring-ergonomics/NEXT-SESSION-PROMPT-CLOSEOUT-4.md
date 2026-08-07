# Next-session prompt — phase 35 closeout, part 4

**Supersedes [`NEXT-SESSION-PROMPT-CLOSEOUT-3.md`](./NEXT-SESSION-PROMPT-CLOSEOUT-3.md)**, whose §A,
§B, §C, §D and §E are all now done or decided. Its lessons 1–3 still stand and are carried forward
below with a fourth. Everything else in it is stale.

Written 2026-08-02 at `2a86bd2f`.

## What the last session did

| Thing | State |
|---|---|
| **ERG-005 §0** (was §B — the phase's last blocking measurement) | ✅ **Met, nothing owed.** All five questions + Richard's named `Function` case |
| **ERG-003 C1's four remaining rows** (was §C) | ✅ Rows 3, 4 and C4 **pass**; C3 measured and **poor** |
| **🔴 `cloud-library:check` was red**, and had been for several commits | ✅ Found and fixed. Not in anyone's plan |
| **The 14-port gap** (was §D item 2) | ✅ Closed — it was the stale artefact above |
| **Port descriptions unreadable** (was §D item 1) | ✅ **Closed for the property panel.** Signals remain |
| **An orphaned `listValueCodec` fix** left uncommitted by a dead session | ✅ Verified (4 of 45 fail without it) and committed |
| **§A — `Object Changed`** | ⚠️ **Decided by Richard, NOT built** |
| **§E — the asynchrony marker** | ⚠️ **Decided by Richard, NOT built** |
| **ERG-005 §1** | ❌ Not started. **Now the headline gap, and §0 made it bigger** |
| **§F — the `sendValue` sweep** | ❌ Not started |
| **§G — ERG-002's remainders, ERG-003 Option A** | ❌ Not started. **Re-verified as still open** — see §F below |

**Gates on the current tree.** `noodl-editor` jest **25 suites / 283 passing**; `noodl-core-ui` jest
**11 / 123**; `tsc -p packages/noodl-editor --noEmit` **clean**; `catalog:check` and
`cloud-library:check` green. Two pre-existing failures **not** caused and **not** fixed by that
session: `typecheck:core-ui` has **46 errors** (all `@noodl-viewer-cloud/*` path resolution, none in
`json-editor`), and `Ports.ts` carries one `ban-ts-comment` eslint error present at `HEAD` on the
line above the edit. The runtime jest suite and the editor's jasmine suite were **not** re-run —
nothing in this session touched `noodl-runtime`.

## ⚠️ Concurrency

The previous session was killed mid-probe by another session running `npm run dev:stop`, and it in
turn nearly killed a worktree's jasmine run.

- **`dev:stop` is not checkout-scoped in practice.** It matches on the Electron binary path, so it
  reaps a *worktree's* `Electron test.js --ci` run, and a worktree's `dev:stop` reaps your editor.
  Run `npm run dev:stop -- --list` first and **read the command**, not the count.
  `Electron . --dev` is the app; `Electron test.js --ci` is someone's test run.
- **Re-check CDP is alive before trusting a silent probe result.** A dead endpoint and a correct
  change that found nothing look identical.
- `dev-docs/tasks/phase-37-project-tabs/` is **untracked and not mine.** Leave it.
- **Never `git stash`, never `git add -A`, never `git checkout <path>` on a file you have edited.**
  ⚠️ **`git commit` needs a pathspec too**, not just `git add`: `git commit -m "…" -- <paths>`.
  Three sessions have now depended on this.

## The work, in the order it is worth doing

### A. ERG-005 §1 — the headline, and §0 doubled its scope

**Start here if you own the editor.** ERG-005 was scoped as *"the Port Editor carries no
`description`"*. §0 measured something worse: **the Port Editor's ports carry no *type* outside the
running editor either.**

- `ProjectModel.toJSON()` writes **no `ports` key** on a component. The only type on disk is the
  Port Editor's own `{"name": "*"}`, for every port it has ever created. The real type is
  recomputed by `ComponentModel.getPorts()` on every read and stored nowhere.
- Measured consequence: a graph the editor raises **2 errors** on validates **0 errors, 0 warnings**
  under `npm run validate:project`. It is blind twice — the types are not on disk, *and*
  `typeIncompatibleConnection.ts:37` and `nonexistentPort.ts:65` both `continue` on any component
  ref by design.
- The AI authoring loop's `componentPorts()` (`AiAssistant/explain/graph.ts:69`) returns a sorted
  list of **strings**. No types at all.

So §1 has to carry the derived **type** out alongside the `description`, or it will document an
interface the validator and the loop still cannot check. Full measurement in
[`ERG-005-COMPONENT-INTERFACE.md`](./ERG-005-COMPONENT-INTERFACE.md) §0; the fixture that produced it
is `dev-docs/qa-fixtures/generate-erg005.py` and it is reusable as-is.

⚠️ **§2 is a written decision for Richard, after §1, and changes no typing behaviour.** §0 gave it
its strongest argument, which is not "types should be declared" but *"a one-connection edit inside a
component silently retypes its public interface, leaves every caller's wire in place, and leaves no
trace in the project file."*

### B. Two things Richard decided and nobody has built

Both overrode the recommendation put to him. Neither is started.

**B1. `Object` gains an object-valued output** — [`ERG-004-NOTES.md`](./ERG-004-NOTES.md) §7.4.
So `Object → Object Changed` is a real `object → object` wire with no cast and no `eval`.
⚠️ **Two things make it more than a port addition.** `Array Changed`/`Collection2` needs the matching
treatment or the pair is fixed apart; and the typecast table will *still* accept the wrong wiring
(`string → object`), so the id-string path must either resolve or say something better than
*"ReferenceError: qa is not defined"*, or authors will keep reaching for the id and keep getting `{}`.

**B2. The asynchrony marker is declared in the node definitions**, not enrichment —
[NDA-017](../phase-30-node-library-audit/NDA-017-SIGNAL-INPUT-FRESHNESS.md#-the-asynchrony-proxy-is-dead-2026-08-02).
~150 node types to classify, then flip `signal-driven-stale-input` back on.
⚠️ **Pin the runtime → editor hop with a test before trusting a green catalog gate** — that is the
exact hop `catalog:check` does not cross, and it has now hidden the same class of bug twice (§7.3,
§7.8). The rule's tests read the **real** catalog and will fail loudly when a marker lands; that is
the signal to re-enable, not a regression.

### C. The `sendValue` sweep — ERG-004 §4.6, still unowned

⚠️ **Line numbers re-verified at `2a86bd2f`** — earlier prompts cite three different sets, so trust
these or grep afresh:

- `Node.prototype.sendValue` is at **`node.ts:682`**; its `if (value === undefined) return;` is at
  **`:688`**.
- The receiver drains with `Object.keys(this._inputValuesQueue)` at **`:568`**.
- The queue key is created lazily on first delivery at **`:1003`**.

So a value port that is `undefined` the first time gets its key created *after* the signal that
already fired, and is delivered **behind that signal for the life of the node**. ERG-004 fixed only
its own two nodes, by emitting `null` rather than `undefined` — which is what
`EMPTY-VALUE-CONTRACT.md` asks for anyway.

**Latent in any node pairing a signal with a possibly-undefined value port. A test that exercises the
node once cannot see it — drive every candidate twice.** ERG-004's live QA confirmed the fixed shape
survives a real frame clock, so the pattern to copy is known; only the sweep is missing.

### D. Two gaps the last session opened by closing something else

Both are new, both are named rather than fixed, both are real.

1. **A signal port's description has nowhere to appear.** The property panel now renders
   descriptions ([`ERG-004-NOTES.md`](./ERG-004-NOTES.md) §7.9), and coverage is 100% of the rows
   that exist — but a `signal` is connection-only and has no row. Its only possible surface is the
   canvas port hover, which renders nothing. The node picker preview is also still unowned.
2. **ERG-003 C3 — Easy mode is not legible on a long list.** Measured: 24 entries give a **2456px
   tree in a 269px viewport, 11% visible**. The cost is structural — every proplist entry is three
   rows and one of them is the machine-generated `id` the author never edits. ⚠️ D2's *"ids must be
   visible"* is an argument about **Advanced** mode; in Easy mode it triples every row to show a
   value nobody types. The property panel behind the editor is more legible than the editor. Cheapest
   shape for a fix is a summary row per entry (label, type, id on demand). See
   [`ERG-003-NOTES.md`](./ERG-003-NOTES.md) §4 C1.

### E. ERG-002's four remainders — ⚠️ re-verified 2026-08-02, all still open

Checked rather than inherited, because the phase's own rule says to:

1. **Code-editor completion is dead code.** `packages/noodl-core-ui/src/components/code-editor/library-completions.ts`
   exists and is tested; **nothing imports it** anywhere in `noodl-core-ui` or `noodl-editor`. It is
   not registered in `codemirror-extensions.ts`.
2. **The AI loop never sees the libraries.** `ContextBuilder.libraryOverview()` works and
   `AuthoringSession.ts:505,516` calls it — but `libraries` is the 6th constructor arg with a
   default of `[]` (`ContextBuilder.ts:93`) and **no call site anywhere supplies
   `options.libraries`**. So it returns `undefined` every time. The plumbing reaches the session and
   stops one hop short.
3. **The validator rule** — not attempted. Free-variable AST analysis plus a `NormNode` schema
   change; task-sized on its own.
4. **Criteria 4 and 6 need a real deployed build.** ⚠️ The spec is explicit that the preview is not
   evidence — phase 30 found four defects only a deployed build revealed.

### F. ERG-003 Option A, if Richard wants it

Deferred deliberately. `stringlist` stays comma-separated because **24 files / 48 call sites** under
`noodl-runtime/src/nodes` and `noodl-viewer-react/src/nodes` each independently `split(',')` the raw
parameter, and `setInputValue` hands the raw parameter to each node's own setter — so there is no
single seam to migrate at. The corpus test is the gate for doing it properly. See
[`ERG-003-NOTES.md`](./ERG-003-NOTES.md).

---

## Reusable assets from the last two sessions

**Two fixture generators**, both committed, both documented in `dev-docs/qa-fixtures/README.md`:

- `generate-erg005.py` → `erg005-qa`. Component Inputs/Outputs with typed sinks and sources, a
  `JavaScriptFunction` with typed dynamic ports, and `/App` as a visual home so a viewer mounts.
  Ships **no connections** on purpose — the measurement wires them live.
- `generate-erg003.py` → `erg003-qa`. One node per ERG-003 row **plus a control for each**, because
  *"the hint appears"* says nothing until *"the hint does not always appear"* has been shown.

**The CDP driving recipe**, which is what made these sessions possible:

```js
// Capture the webpack require. ⚠️ A chunk id may only be pushed ONCE per renderer —
// re-pushing a used id is a silent no-op, the callback never runs, and every later
// call fails with "req is not a function". Vary the id.
if (typeof window.__req !== 'function') {
  let r = null;
  const id = '__probe-' + (window.__probeSeq = (window.__probeSeq || 0) + 1);
  window.webpackChunknoodl_editor.push([[id], {}, (x) => { r = x; }]);
  window.__req = r;
}
```

- Open a project without the launcher: `req('./src/editor/src/utils/LocalProjectsModel.ts')
  .LocalProjectsModel.instance.openProjectFromFolder(dir)` — it adds a project that is not in the
  recent list — then tag its card in the DOM and `cdp click` it.
- Back to the launcher: `req('./src/editor/src/models/app.ts').App.instance.notifyListeners('exitEditor')`.
- ⚠️ **Select a node by passing the VIEW, not the model**: `ge.selectNode(ge.findNodeWithId(model.id))`.
  Passing the model throws inside `SidebarModel.switchToNode` reading `.type` off an undefined
  `.model`.
- ⚠️ **Read a property row by finding its label with a `TreeWalker`.** The panel's label is a bare
  text node, so `querySelector` cannot reach it, and a regex over `innerText` is the positional
  reading that has produced a confident wrong answer twice.

---

## The prompt

Continue **phase 35 (Track T)** on branch `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`. Read
`dev-docs/tasks/phase-35-authoring-ergonomics/NEXT-SESSION-PROMPT-CLOSEOUT-4.md` in full first, then
the `README.md` for the phase, then the spec and `-NOTES.md` of whichever task you take.

**Check for a concurrent session before touching anything**, and read the *command* of any Electron
process you find. If another session holds the editor, take **B2**, **C**, **E3** or **F**, none of
which need it. If you own the editor, take **A** — ERG-005 §1 is the phase's largest unstarted piece
and a session that owns the checkout is the scarce resource.

**Standing rules for this phase.** An inherited claim is a hypothesis you must test — this phase has
now overturned premises in four of its own specs and in two of its own next-session prompts, and
every correction was written back into the spec file rather than left in a report. Where a
measurement contradicts a spec, **the measurement wins and you correct the spec.** `description` is
canonical; enrichment `ports` may only add what the source cannot know. A declared `default` never
runs its setter, so the default behaviour must be correct without it.
`dev-docs/reference/COMPATIBILITY-POLICY.md` is binding: existing Noodl projects are not a design
constraint.

⚠️ **Four lessons. The fourth is new and it is the one that will cost you a wasted measurement.**

1. **A green unit suite can be testing nothing.** NDA-017's rule shipped broken because its tests
   used a hand-built catalog. Before trusting a passing suite, confirm your new cases *fail* without
   the fix. The last two sessions did this twice — the rescued `listValueCodec` fix (4 of 45 fail
   without it) and ERG-004's description test (4 of 6) — and both times it was the only evidence the
   test was worth having.
2. **A missing dynamic port is usually a missing viewer, not a defect.** `sendDynamicPorts` returns
   immediately unless `editorConnection.isRunningLocally()`, and a project with no home component
   never mounts a viewer. **Read the live port list before wiring**, and set `rootNodeId` to a visual
   node. ⚠️ A related trap, measured: `JavaScriptFunction`'s value port is **`in-qty`, not `qty`** —
   it is `simplejavascript.ts` with `inputPrefix: 'in-'`, while the unprefixed naming at
   `noodl-viewer-react/.../javascript.ts:799` belongs to the **`Script`** node, a different node.
3. 🔴 **A green catalog is not evidence that an author can read anything** — and the sequel:
   **a green catalog gate is not evidence the other artefact gates pass.** ERG-004's fix crossed the
   runtime → editor hop for the live library and left a **committed snapshot** of the pre-fix output
   in `cloud-node-library.json`, red for several commits, because the closeout gate run listed
   `catalog:check`/`catalog:merge:check`/`catalog:examples` and not `cloud-library:check`. **A fix to
   a generator is not finished until every artefact that generator owns has been regenerated, and
   the way to find them is to run each gate rather than the ones you remember.**
4. 🔴 **HMR will report success and change nothing.** Editing `Ports.ts` made HMR list the updated
   modules and then say *"Nothing hot updated"*: the already-mounted property editor kept the old
   code, and a live probe read **0 tooltips against a completely correct change** — indistinguishable
   from a broken one. `tsc` clean and jest green said nothing either way. **Relaunch the stack before
   measuring any change to a long-lived panel**, and prefer `dev-docs` evidence you gathered *after*
   a restart.

**Report honestly.** Say which success criteria are met, which are outstanding, and which are
blocked — and on what. Debt that is named survives; debt that is dropped does not.
