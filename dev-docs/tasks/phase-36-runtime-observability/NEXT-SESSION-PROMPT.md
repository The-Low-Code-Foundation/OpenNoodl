# Next-session prompt — phase 36, after OBS-001

**OBS-001 is discharged.** The trace substrate is built and merged (`5e9c3514`, merged `193419fc`),
with 16 corpus rows against all seven of its acceptance criteria. `noodl-runtime` 1859/1872 and
`noodl-viewer-react` 678/678, zero failures.

It was built in an isolated worktree while ERG-001 (phase 35) held the primary checkout, and the two
never touched a shared file. **Assume phase 35 is still running** — check before choosing.

Paste the block under the rule. Everything above it is context for choosing.

## Choosing the slice

| Stream | Contents | State |
|---|---|---|
| **A — OBS-002, the walk** | The product. Right-click → backward walk, three annotation layers | **Recommended.** OBS-001 alone is invisible; this is what makes it a feature |
| **B — OBS-003, node diagnostics** | Layer 3. Node-local invariant checks | ⚠️ **Blocked while ERG-001 runs** — see below |
| **C — OBS-004, agent access** | MCP over the relay + input injection | Tier 3, and deliberately last: it is only good if A and B are good |

**Recommended: stream A.** OBS-002 is the only reason OBS-001 exists. Note its honest early
stopping point — **layer 1 (provenance) requires nothing to have fired and works on a cold editor**,
so a first slice that ships layer 1 alone is legitimate and useful.

⚠️ **Do not start OBS-003 while ERG-001 is live.** Its first batch of checks targets `states.ts`,
the Repeater family, and generic checks in `node.ts` — all live ERG-001 territory. Phase 35 shipped
the Repeater family (`f3a4a1a9`) *during* the OBS-001 session. Check `git log --oneline -5` and
`git status --porcelain` first; if ERG-001 has stopped, OBS-003 is the highest value-per-hour task
in the phase and has no dependencies at all.

## What OBS-001 actually gave you

Not in the README — it was written before the code existed. The runtime side is complete and the
**editor side is empty**: nothing anywhere sends `traceEnabled` or listens for `traceDictionary` /
`traceEvents`. OBS-002 builds both halves of that.

On `NodeContext` (`packages/noodl-runtime/src/nodecontext.ts`):

| Call | Does |
|---|---|
| `setTraceEnabled(bool)` | Allocates/drops the ring buffer, sends the dictionary. Independent of `setDebugInspectorsEnabled` |
| `buildSessionDictionary()` | `{ nodes: {id: {name, type, component}}, edges: [{from:{node,port}, to:{node,port}}] }` |
| `getTraceEvents(afterSeq?)` | Flat `TraceEvent[]`, oldest first. Omit `afterSeq` for everything |
| `clearTrace()` | Drops events; `seq` deliberately keeps counting |

Over the relay (`packages/noodl-runtime/src/editorconnection.ts`), all `isRunningLocally()`-gated:

- **editor → viewer:** `{cmd:'traceEnabled', content:{enabled}}`, `{cmd:'getTraceEvents', content:{clientId, afterSeq}}`
- **viewer → editor:** `{cmd:'traceDictionary'}`, `{cmd:'traceEvents', content:{events}}`

⚠️ **The editor receives the *nested* shape** (`{from:{node,port}}`), the runtime stores flat.
`toWireEvent` in `tracebuffer.ts` is the boundary. Code the editor against `WireTraceEvent`.

⚠️ **The editor pulls; the runtime does not push.** That is deliberate — shipping 250k events at a
renderer is exactly what killed the shelved panel. The buffer is an index the walk queries.

## Prior art the README missed, and it matters

⚠️ **A panel already tried OBS-002's exact question and failed.** The phase-4 Data Lineage panel
asked *"where does this value come from, and where does it go?"* and was **retired from reach** in
DEBT-012 — see the commented-out registration at
[router.setup.ts:124-142](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L124-L142).
Its defect was structural and is the one OBS-002 is most likely to repeat: **it enumerated ports
instead of following wires**, so a 3-node chain produced 40+ "upstream" steps.

Read [DETERMINISTIC-LINEAGE-SUBSTRATE.md](../../future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md)
before designing the walk. Its conclusion — build a **headless substrate several features consume,
not another panel that walks the live graph** — is what OBS-001's dictionary edge list now makes
possible: the topology follows wires because the runtime hands it over already followed.

Also note `AiAssistant/explain/` — Explain Mode answers the human-facing version of this question
and is cited in DEBT-012 as the reason lineage was low priority. Worth reading before deciding
whether the walk is a panel, a canvas overlay, or both.

---

## The prompt

Continue phase 36 (Track U) on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.

**First, check whether another session holds the checkout:** `git log --oneline -5` and
`git status --porcelain`. An uncommitted file is orphaned work, not another session's — read it,
then commit or discard it deliberately. If ERG-001 (phase 35) is still committing, **work in a
worktree and keep off the node library entirely** (see the recipe below).

**Read first, in this order:**

1. `dev-docs/tasks/phase-36-runtime-observability/README.md` — the design position. "The log is
   never the surface" and "scale comes from topology, not filtering" are the whole spec.
2. `dev-docs/tasks/phase-36-runtime-observability/OBS-002-PROVENANCE-WALK.md` — the task.
3. `dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md` — **the named failure to avoid.**
   A previous panel answered this question by enumerating ports instead of following wires and was
   retired for it.
4. `packages/noodl-runtime/src/tracebuffer.ts` — the substrate's module header explains what the old
   debug path could not represent, and why the event shape is what it is.
5. `packages/noodl-runtime/test/corpus/obs-001-trace-substrate.test.ts` — the clearest statement of
   what the trace guarantees. If you need a behaviour it does not assert, it is not guaranteed.

**Two facts about the runtime that decide designs:**

- **Delivery is queued, not a call stack.** `OutputProperty.sendValue` pushes into the target's
  `_inputValuesQueue`; the target drains it in its own `update()`. This is why `cause` rides in a
  parallel `_inputCauseQueue` rather than coming off the stack. Any new causal work must respect it.
- **`cause: 0` means root** — a timer, a DOM event, boot. It does not mean "unknown".

**Territory, if phase 35 is still live.** ERG-001 owns `packages/noodl-runtime/src/nodes/**`,
`packages/noodl-viewer-react/src/nodes/**`, `src/node.ts`'s `reportOutcome`, and the three generated
catalogs. OBS-002 is `packages/noodl-editor/src/editor/src/**` and is disjoint from all of it.
Verify with `comm -12` over both branches' `git diff --name-only` before merging.

**The worktree recipe that works** (do **not** use `isolation: "worktree"` — it roots every worktree
at `origin/main`, currently ~1000 commits behind):

```
git worktree add -b <name> <scratchpad>/obs cline-dev
```

Then build the worktree's root `node_modules` as a **real directory** of symlinks to each of the
primary's entries — *except* `@noodl`, which must be a real dir whose links point at the
**worktree's own** packages. The primary's `@noodl/*` are relative symlinks that resolve against
the symlink's realpath, so a wholesale root symlink silently resolves every cross-package import to
the primary checkout. Also: `@noodl/runtime` has no entry in the primary's `node_modules/@noodl` —
add it. And `dist-types/` is a gitignored build output the worktree never has; run
`tsc -p tsconfig.types.json && node scripts/copy-handwritten-types.js` in `noodl-runtime` or ~7
phantom "Cannot find module '@noodl/runtime'" errors will look like your fault. **Never run
`npm install` in the worktree** — the symlinks mean it would mutate the primary's modules.

**Traps:**

- ⚠️ **Editor behaviour cannot be verified from a worktree.** Anything through `lerna exec`
  (`dev:debug`, `test:ci`) resolves to the *primary* checkout's source, so a live run there
  exercises code that is not your diff. Merge first, then verify in the primary.
- ⚠️ **The editor takes a single-instance lock.** If another session is driving it, both sessions
  drive one Electron and their webpack watch reloads your renderer mid-script. Never run
  `dev:stop` in that state — it kills by checkout and takes their run down too.
- Editor specs are **jasmine, not jest**. `npx jest` in `noodl-editor` will not find them.
- `npx jest --reporters=<path> <testfile>` fails — `--reporters` is an array option and eats the
  following positional. Put `--testPathPattern` before it.
- HMR closes modals mid-QA; expand a tree before probing it.

**Definition of done.** OBS-002's acceptance list, plus: a walk over a chain where one hop never
fired shows the ✓/✕ boundary **without the user scanning anything**, and a walk on a cold editor
(nothing ever recorded) still renders layer 1. If you ship layer 1 only, say so plainly and say
what layer 2 needs.

**Report at the end:** which of the four OBS tasks are now discharged, what the walk does *not* yet
answer, and whether the shelved `TriggerChainDebuggerPanel` was rebuilt or retired — that is open
question 3 in the README and it is still Richard's call.

## Open questions for Richard — still unanswered

Carried forward from the README; OBS-001 shipped defaults for the first two, so these are now
"confirm or change", not "decide from nothing".

1. **Buffer default.** Shipped at **250k events** with a **200-char value-preview cap**. The real
   memory lever is the character cap, not the event count.
2. **Session boundary.** Shipped as **clear on trace start and on preview reload**, not time-based.
3. **Does the shelved panel get rebuilt or retired?** Untouched so far. `TriggerChainDebuggerPanel`
   is still registered `experimental: true` at
   [router.setup.ts:303](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L303) and
   still reads the old snapshot recorder.
4. **OBS-004 scope.** Unchanged — token first, or keep the MCP server local-only and defer?
