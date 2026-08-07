# Next-session prompt — phase 35 closeout, part 2

**Supersedes [`NEXT-SESSION-PROMPT-CLOSEOUT.md`](./NEXT-SESSION-PROMPT-CLOSEOUT.md)**, whose step 1
(landing the batch) is done. That file is still worth reading for the ERG-002 remainder detail and
the ERG-003 Option A write-up; everything else in it is now stale.

Written 2026-08-02 at `d4547f2e`, **with a concurrent session live in the checkout** — see the
warning below, which is not boilerplate this time.

## What the last session actually did

| Thing | State |
|---|---|
| **`trial-merge` landed** | ✅ `4230ee6a`, zero conflicts. Catalog regenerated to an **empty diff** |
| **All gates** | ✅ `catalog:check`, `catalog:merge:check`, `cloud-library:check`, and `catalog:examples` **50/50** |
| **NDA-017 rule regression** | ✅ Found, fixed, documented, committed (`270a191d`) |
| **ERG-003 live QA** | 🟡 Two of four rows driven and passing, including the riskiest (`d4547f2e`) |
| **ERG-004 live QA** | ❌ **Not done.** Still the headline gap |
| **ERG-005** | ❌ Not started |
| **ERG-002's four remainders** | ❌ Not started |
| **The `sendValue` sweep** | ❌ Not started |

**Measured suite baseline on the merged tree** (per package, `--ci`, not through `lerna`): runtime
**2111 passed / 0 failed** (112 of 113 suites; the 113th is deliberately skipped, 13 pending),
viewer-react 62/62 suites / 853, editor jest 15/15 / 140, core-ui 11/11 / 112. The editor's
**Electron/jasmine** suite (`npm run test:ci` in `packages/noodl-editor`) is **2009 specs / 0
failures** — note that it is a *different* suite from the jest one and covers `tests/`, which jest's
`testMatch` does not.

## ⚠️ Concurrency — this was live, not hypothetical

At the last session's start `git status` was clean and no Electron was running. **Both facts stopped
being true mid-session.** A second session committed `9f82ba84` (`docs(alpha-007)`) at 17:42 and by
18:10 had eleven uncommitted files in the tree — launcher, theme settings, `ProjectsPage`, and
⚠️ **`packages/noodl-core-ui/src/components/json-editor/utils/listValueCodec.ts`, which is an
ERG-003 file**. Check whether that has landed before you touch anything in `json-editor/`.

⚠️ **The last session ran `npm run dev:stop` three times and probably killed their editor.** It
kills by checkout, not by process tree. Do not repeat it:

- **Before launching or stopping anything**, run `ps -eo pid,lstart,command | grep -i electron` and
  compare start times against `date`. `git status --porcelain` proves nothing on its own.
- Prefer `npm run dev:stop -- --list`, which kills nothing.
- **Never `git stash`, never `git add -A`, never `git checkout <path>` on a file you have edited.**
- ⚠️ **A pathspec on `git add` is not enough — `git commit` needs one too.** `git commit -m "…" --
  <paths>`. The last session did this and its two commits came out clean despite eleven foreign
  files in the tree; that is the only reason.

## The work, in the order it is worth doing

### A. ⚠️ ERG-004 live QA — the headline gap, and it needs the editor

Nothing in ERG-004 has been seen running. `ERG-004-NOTES.md` §4.1 has the full list; the item that
matters is **driving the object twice**, because a real graph batches within a frame where the jest
corpus settles between events, and that is exactly the window the signal-before-value class lives in.

⚠️ **The last session could not wire it and the reason is worth inheriting.** `Object Changed`'s
`object` port wants an object *value*. **`Model2` (the `Object` node) has no object-valued output** —
its outputs are `id`, `changed`, `fetched`, `done`, `completed`, `failure`. Wiring `fetched` into it
produces a type-incompatible-connection warning, correctly. Find a real object source first
(`net.noodl.ComponentObject`, a `Function` with an object output, or a Repeater item) **before**
building the graph, or you will burn the same time twice.

### B. ERG-005 §0 — the phase's last blocking measurement, and it needs the editor

Five questions, answered live, in `ERG-005-COMPONENT-INTERFACE.md` §0. Not started.

⚠️ **The last session hit §0's own trap from the other side and it is now confirmed twice over.**
`Function`'s per-input **Type dropdowns simply do not exist** until a viewer is running: they are
created by `JavascriptModule.setup()`
(`noodl-viewer-react/src/nodes/std-library/javascript.ts:706`), which returns immediately unless
`context.editorConnection.isRunningLocally()`. A project with **no home component** never mounts a
viewer, so the parameters sit correctly on the node while the property panel shows nothing at all —
and it reads exactly like a defect in whatever task you are on. **Set `rootNodeId` in `project.json`
to a visual node in `App` before concluding anything about a dynamic port.** This is precisely why
§0 forbids answering from source.

### C. ERG-003's remaining live rows

`ERG-003-NOTES.md` §4 C1 now has a table of what passed and what is owed. Outstanding: `Global
Store.initialState` JS-literal recovery, `Repeater.items` binding chip, legibility at 20+ entries,
undo/redo. All need the editor.

### D. The asynchrony marker — ⚠️ needs a decision from Richard before anyone builds it

NDA-017's `signal-driven-stale-input` rule is `defaultEnabled: false` and **criterion 6 is no longer
met**. ERG-001's outcome contract made `Done`/`Completed` universal, which was the rule's only proxy
for *"this producer is asynchronous"*; node types carrying a completion signal went **53 → 97 of
153**, and the rule began firing on four shipped examples including the canonical latched counter,
where its suggested fix is an infinite loop.

The full measurement is in
[`NDA-017-SIGNAL-INPUT-FRESHNESS.md`](../phase-30-node-library-audit/NDA-017-SIGNAL-INPUT-FRESHNESS.md#-the-asynchrony-proxy-is-dead-2026-08-02).
**Do not try to rescue it by narrowing the port names** — that was measured and fails in both
directions (it still catches synchronous `Variable`/`Component State` via `stored`/`saved`, and now
misses genuinely asynchronous `net.noodl.SSE`/`net.noodl.WebSocket`). It needs a structured marker
the catalog carries in its own right, over ~150 node types. `runtimeBehavior` in the enrichment
catalog is the natural home but is prose today. **Where the field lives is Richard's call.**

The rule's tests now read the **real** catalog and will fail loudly when a marker lands — that is the
signal to flip it back on, not a regression.

### E. The unowned `sendValue` defect — still unowned

Unchanged from the previous prompt, and nothing since has touched it. `sendValue` returns early on
`undefined` (`node.ts:682-698`) and the receiver drains with `Object.keys(this._inputValuesQueue)`
(`node.ts:566`) — insertion order of keys created on each port's **first** delivery. A value port that
is `undefined` the first time gets its key created *after* the signal that already fired, and is
delivered **behind that signal for the life of the node**. ERG-004 fixed only its own node, by
emitting `null` rather than `undefined`. **Latent in any node pairing a signal with a
possibly-undefined value port. A test that exercises the node once cannot see it — drive every
candidate twice.**

### F. ERG-002's four remainders, and ERG-003 Option A

Neither needs the editor. Both are described in full in the previous prompt
([`NEXT-SESSION-PROMPT-CLOSEOUT.md`](./NEXT-SESSION-PROMPT-CLOSEOUT.md) §2B and §2E) and neither has
been started. ERG-002's criteria 4 and 6 need a **real deployed build** — the spec is explicit that
the preview is not evidence.

## A reusable asset the last session left behind

A scratch project at `~/vscode_projects/NodeGX test projects/erg-qa`, registered in the launcher,
holding a `Function` with three `scriptInputs`, `Page Inputs`, `Global Store`, `Repeater`, and both
new ERG-004 nodes. Its `rootNodeId` is set so the viewer actually mounts. **Two of its wires are
deliberately wrong** (the Router has no pages; `Model2.fetched → ObjectChanged.object` is the
type-mismatch described in §A) — fix or delete those before using it to judge a Problems-panel
criterion. Delete the whole directory if you would rather start clean; nothing depends on it.

Recipe that worked, if you need another: author `project.json` on disk under
`~/vscode_projects/NodeGX test projects/`, add an entry to
`~/Library/Application Support/NodeGX/recently_opened_project.json`, and **restart the app** — the
launcher reads that file only at start, and there is no in-app refresh. The New Project dialog's
Location field is not an `<input>` and needs a native Browse dialog, so the wizard is not drivable
over CDP.

---

## The prompt

Continue **phase 35 (Track T)** on branch `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`. Read
`dev-docs/tasks/phase-35-authoring-ergonomics/NEXT-SESSION-PROMPT-CLOSEOUT-2.md` in full first, then
the `README.md` for the phase, then the spec and `-NOTES.md` of whichever task you take.

**Check for a concurrent session before touching anything** — one was live when this was written,
and the checks that missed it are named above. If another session holds the editor, take **§D**
(after Richard answers), **§E** or **§F**, none of which need it. If you own the editor, take **§A**
first and **§B** second: they are the phase's two remaining pieces of live measurement, and a session
that owns the checkout is the scarce resource.

**Standing rules for this phase.** An inherited claim is a hypothesis you must test — this phase has
now overturned premises in three of its own specs, and every correction was written back into the
spec file rather than left in a report. Where a measurement contradicts a spec, **the measurement
wins and you correct the spec.** `description` is canonical; enrichment `ports` may only add what the
source cannot know. A declared `default` never runs its setter, so the default behaviour must be
correct without it. `dev-docs/reference/COMPATIBILITY-POLICY.md` is binding: existing Noodl projects
are not a design constraint.

⚠️ **Two lessons from the last session, both of which cost real time.**

1. **A green unit suite can be testing nothing.** NDA-017's rule shipped broken because its tests
   used a hand-built catalog whose synchronous stand-in declared no completion signal. Before
   trusting a passing suite, confirm your new cases actually *ran* — grep the spec names out of the
   full output, and beware truncating that output with `tail` before you grep it.
2. **A missing dynamic port is usually a missing viewer, not a defect.** See §B. Check the mechanism
   before filing the consequence.

**Report honestly.** Say which success criteria are met, which are outstanding, and which are blocked
— and on what. Debt that is named survives; debt that is dropped does not.
