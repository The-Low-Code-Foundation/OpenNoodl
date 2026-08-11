# Phase 60 — next session

**Written 2026-08-11**, at the end of the session that closed **SIG-003**, the phase's second flagship.
**4 of 7 are done — SIG-001, 002, 003, 004 — which is the whole of *what a wire means*.**
**The next session's job is SIG-005**, and it opens *what a wire looks like*.

Commits: `2f513016` (the library sweep and the gate), `15028e25` (docs), `6e27f741` (one straggler).
Remaining: **005, 006, 007**.

## What this session did, so you do not redo it

`Other` was never a category anyone chose. `ConnectionBar` reads `p.group ? p.group : 'Other'`, so the
**absence of one line** in a node definition rendered as if it were a decision — and on every Variable
node that was the four ports the node exists for, while the only port with a heading was the NDA-003
back-compat one.

| Measure | Before | After |
|---|---:|---:|
| Static ports with no `group` | **167** across 58 node types | **0** |
| Ports in a kind heading that is not their kind | **35** | **0** |
| Ports in a retired group (`Value`, `Signals`, `Changed Events`) | **63** | **0** |
| `groupPriority` entries naming a retired group | **4** | **0** |
| Connectable **dynamic** ports with no group | **2 seams** | **0** |

**§2 was answered by Richard: the teaching end — `Values` / `Actions` / `Events`.** The normative
write-up is **[`dev-docs/reference/PORT-GROUP-VOCABULARY.md`](../../reference/PORT-GROUP-VOCABULARY.md)**;
read it rather than SIG-003, which is now a record. The gate is `npm run catalog:groups:check`, in the
`node-catalog` CI job.

Verified live: a String variable's inputs render **Values(Value) · Actions(Set)** and its outputs
**Values(Value, Length) · Events(Changed, Done, Completed, Unchanged)**, no `Other`; and a sweep of
`window.NodeLibraryData` — the same data the popup reads — gave **175 node types, 3,056 connectable
ports, 0 ungrouped**.

### The five things worth carrying

1. 🔴 **The gate's fourth rule was a check that could never go red.** It read
   `node.connectionPanel.groupPriority` off the generated catalog, and **the catalog carries
   `connectionPanel` on none of its 175 entries**. It printed a confident `✓ 0` while four cloud nodes
   really did still name the retired `'Value'` — found by a grep run for another reason. It now reads
   source. **Prove a new gate red by injecting one violation of each class before trusting it green**,
   and note `$?` after a pipeline is the *last* command's status: `gate.js --check | head` reported 0
   while the gate exited 1.
2. 🔴 **An acceptance criterion, applied literally, would have made the library worse.** "No node files
   a signal port and a value port under the same heading" is wrong for **subject** headings:
   `Snap To Position X` is `Do` + `Duration` + `Value`, a task and its parameters. 77 node/group pairs
   mix kinds and most are correct. Left unchecked in SIG-003 with the reason; what shipped is the
   narrower rule that only the three *kind* headings must be pure.
3. 🔴 **A previous fix attempt was inert.** `logic-builder.ts` carried
   `group: '', // Empty group to avoid "Other" label`. The empty string is **falsy**, so the port landed
   under `Other` anyway — and it was a **duplicate object key** overriding the line above it. A comment
   claiming a workaround is a reason to verify the workaround, not to skip the port.
4. ⚠️ **The library had already voted.** `error` (a value output) sat under `Events` on 33 nodes and
   under an existing `Error` group on **41**. Same port, same purpose, two headings, never counted.
   Following the majority cleared 33 of the 35 violations. **Census before convention.**
5. ⚠️ **Measure an audit's concentration before estimating it.** 60% of the 167 came from ten port
   names (`this` ×27, `childIndex` ×27, `childrenCount` ×12 — three edits in one file cleared 44), and
   **26% were on deprecated nodes**. It looked like 58 files and was really about six. Report live and
   deprecated separately: the live number was 123, not 167.

### Gates, measured on the settled tree

`typecheck:editor`, `typecheck:editor-tests`, `typecheck:viewer`, `typecheck:cloud` **clean** ·
`test:main` **115 suites / 1611 tests green** (was 114/1600; +12 specs in `groupOrder.test.ts`) ·
`catalog:check`, `catalog:merge:check`, `cloud-library:check`, `docs:nodes:check`, `catalog:examples`
**all clean** · `lint:ci` **869 errors against a 3916 baseline** ·
`test:ci` **`Jasmine: 2632 specs, 6 failures` at seed 72213** — the recorded baseline, confirmed **by
name**: four `AIX-006 style vocabulary`, two `AI model registry`. Same 2632 spec count as the previous
session, which is correct: SIG-003's 12 new specs are Jest and live in `test:main`, not in the Jasmine
suite.

⚠️ **`typecheck:runtime` FAILS, and it is not this work.** Two files redeclare `EditorConnection`:
`packages/noodl-runtime/test/editorconnection.replyidentity.test.ts:23` and
`…/editorconnection.sendqueue.test.ts:24`. Both are **unmodified** in this diff. Pre-existing; worth
someone's ten minutes, but do not let it read as a regression.

⚠️ Editing a port `group` makes **four** artifacts stale at once — `catalog:generate`, `catalog:merge`,
`cloud-library:generate`, `docs:nodes`. All four have `--check` gates and all four are in CI.

---

Paste the block below into a fresh session.

---

Work on **phase 60, task SIG-005** for OpenNoodl/NodeGX. Work on `cline-dev`, commit straight to it,
no branches and no PRs. **Check for a second live session first** (`git log --since="3 hours ago"`, and
read untracked files rather than assuming they are yours) — there was one throughout the previous two
sessions, on phases 50/54/55/57/58, touching `packages/noodl-core-ui/`,
`packages/noodl-editor/src/editor/src/{utils/ExtractToComponent.ts, views/nodegrapheditor/EditorClipboard.ts,
views/nodegrapheditor/ExtractToComponentPopup.*, views/panels/ComponentsPanelNew/, pages/ProjectsPage/,
models/template/}` and `packages/noodl-editor/tests/`. If it is still live, pathspec-scope every
`git add` **and** every `git commit`, and **never stash** — a stash was attempted last session and
correctly refused.

Read these first, in this order:

1. `dev-docs/tasks/phase-60-values-and-signals/README.md` — the phase and its **four premise
   corrections**, every one read in source. Do not re-derive them. Correction 3 is SIG-006's answer and
   correction 1 is the reason no copy may say "a signal carries no value".
2. `dev-docs/tasks/phase-60-values-and-signals/TASKS.md` — the ordering, and **"What SIG-003 settled,
   and what it left"**.
3. `dev-docs/tasks/phase-60-values-and-signals/SIG-005-THE-SIGNAL-TRAVELS.md` — the task. **Its §0 is
   an investigation and it comes before any rendering code.**
4. `dev-docs/tasks/phase-60-values-and-signals/SIG-006-WHICH-WAY-DOES-THIS-WIRE-GO.md` — **§"Build"
   item 4 only**, which is why SIG-005 comes first: hover and the runtime pulse are the *same*
   travelling mark on the same painter. **SIG-005 owns the mechanism; SIG-006 consumes it.** Building
   them the other way round mints two animation paths on one wire.

**SIG-005 is not "build a pulse". The pulse is built, and switched on by default.** The task is to find
out why a finished, enabled mechanism is something no user has ever mentioned seeing. Four things the
previous session established from source on 2026-08-11 that you should not spend time rediscovering —
they close **R1** and most of **§0.1–§0.3**:

- ✅ **The producer is `NodeContext.prototype.connectionSentValue`**,
  `packages/noodl-runtime/src/nodecontext.ts:573`. It fills `connectionsToPulse` (`:585-601`) and ships
  it via `editorConnection.sendPulsingConnections` at `:626` and `:645`. The editor consumes it at
  `ViewerConnection.ts:214` → `DebugInspector.instance.setConnectionsToPulse`. **SIG-005's R1 is
  answered — record it and move on.**
- 🔴 **§0.2 is answered, and the answer is the task's biggest finding: it pulses EVERY connection, not
  only signals.** `connectionSentSignal` (`nodecontext.ts:608`) is a four-line wrapper that *calls*
  `connectionSentValue` with a string. **A value changing and a signal firing produce an identical
  pulse.** That is precisely the confusion this phase exists to separate, rendered identically by the
  one mechanism that could teach the difference — so §1.4 is not a contingency, it is the work.
- ⚠️ **There is a second gate the spec did not know about.** The spec found
  `DebugInspector.instance.enabled = true` on the *editor* side. The *runtime* side has its own flag:
  `connectionSentValue` returns early unless `editorConnection.isConnected() && debugInspectorsEnabled`
  (`nodecontext.ts:574`), set by `setDebugInspectorsEnabled` (`:698`) from `viewer.jsx:112/258`, driven
  by the editor's `sendDebugInspectorsEnabled` (`ViewerConnection.ts:477`, called at `:173` on connect
  and `:504`). The chain **looks** complete end to end — so verify it live rather than assuming either
  that it works or that this is the bug.
- ⚠️ **A pulse lives 100 ms.** `clearOldConnectionPulsing` deletes any entry older than 100 ms
  (`nodecontext.ts:629-641`) and reschedules itself on a 100 ms `setTimeout`. Against a fade-in, a
  fade-out and `globalAlpha = t.opacity * 0.7`, that is a strong candidate for "fires, and is
  invisible" — which is a different task from "never fires".

So the three outcomes SIG-005 §0 says to distinguish are already narrowed to two, and **§0.4 —
is it visible at all — is the open one.** Measure it before changing anything.

**Standing constraints for this phase** (repeated because they are the ones that get forgotten):
`opacity` cannot dim and stay legible, and **light mode is binding** — this bites SIG-005 directly,
because `globalAlpha` multiplied onto a colour never appears in a token, so nothing in the code says a
contrast ratio moved; **red is danger only**; **wire colour already carries four meanings** (type,
health, pulse, diff annotation) and `NodeGraphEditorConnection.ts:625-627` explicitly refused to make
selection a fifth — new information goes in **shape, weight or motion**, never a sixth colour; and
**`portIcons.ts` is a complete glyph table imported by nothing** — use it or delete it in SIG-006, but
do not start a third vocabulary beside it.

**Verify in the running editor, not only in tests.** Use the `run-editor` skill. Traps that cost the
last two sessions real time:

- ⚠️ **An occluded Electron renderer clamps timers by roughly 1000× and fires zero `ResizeObserver`
  callbacks.** An animation graded by eye on a background window looks broken when it is fine and fine
  when it is broken. **A screenshot forces the frame** — grade the pulse as forced frames at ≥3 points
  along the travel, in both themes, never by watching.
- ⚠️ **Measure the element you claim about**, and print the foreground and background hex beside every
  ratio. A rect that has scrolled out of its container returns whatever the window is showing there;
  one such measurement last session returned the editor's title bar.
- ⚠️ **A synchronous measurement sweep lies** on an animated target. Sample across frames.
- ⚠️ `ed.createNewNode` takes a **type object** (`{name: 'String'}`), not a string, and appends to
  `ed.model.roots` — `forEachNode` only walks visual descendants, so a non-visual node you just created
  will not appear in it. Clean up anything you add to Richard's project: `ed.model.removeNode(m, {undo:
  true})`, then confirm `roots`.
- ⚠️ **HMR does not reach `ed.connectionPopups`** and, expect the same for the canvas painters — restart
  the stack after editing them.

**Gates.** `dev:stop` **before** `test:ci`; **measure `test:main`, never inherit its number**; only the
`Jasmine:` line counts, and match failures **by name** — the documented baseline is **6** (4 ×
`AIX-006 style vocabulary`, 2 × `AI model registry`), reaching 12 when the order-dependent BEN-001
cluster fails, so re-run at another seed before investigating. **Record the seed.** ⚠️ `test:ci` takes
well over ten minutes on this machine and its output is large — redirect it to a file and grep, because
a truncated tail loses the `Jasmine:` line and the seed, which happened last session. And ⚠️
`typecheck:runtime` is already red on two untouched test files — do not chase it.

**If SIG-005's §0 shows the mechanism is fine and only the presentation is wrong, that is the whole
task and it is small** — say so, land it, and go to SIG-006 in the same session. If §0 turns up
something larger, close §0 with the register filled in and stop there; **the investigation is the
deliverable that makes SIG-006 and SIG-007 cheap**, and it is the half nobody can redo from the specs.
Then update `TASKS.md` and the task's Register with what was measured, and say plainly what you left.
