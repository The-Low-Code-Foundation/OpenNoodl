# Next-session prompt — phase 35 closeout

**Does not replace** [`NEXT-SESSION-PROMPT.md`](./NEXT-SESSION-PROMPT.md), which is ERG-001's and was
still being consumed when this was written. This one covers **everything else in the phase**: landing
the ERG-002/003/004 batch, the remainders those three declared, ERG-005 (not started), and one
library-wide defect the batch found that nobody owns.

**The phase is not done.** Written 2026-08-02 at `86e89277`, with ERG-001 §3 in flight in a
concurrent session.

## State, and how to re-derive it

| Task | State | Where |
|---|---|---|
| **ERG-001** | §0–§2, §4 (82/82), §5 landed. **§3 was in flight** at the time of writing — `reportOutcome` remaps `unchanged` per `TREAT_UNCHANGED_AS` | `cline-dev` |
| **ERG-002** | Built, **partial by fence** — 4 named remainders | branch `wt-erg-002` @ `fea1d1ee` |
| **ERG-003** | Built, 6/7 criteria. Storage decision **reversed to Option B** | branch `wt-erg-003` @ `c2129ceb` |
| **ERG-004** | Built, 6/7 criteria. Two new nodes | branch `wt-erg-004` @ `0225f553` |
| **ERG-005** | **Not started.** §0 is blocking and needs the running editor | — |

⚠️ **Do not trust this table's ERG-001 row.** It was written from outside that session. Re-derive
before planning around it: `git log --oneline -20`, then check §3's success criteria against
`outcome.ts` and `node.ts` rather than against a commit subject.

**The three branches are real refs in this repo**, not just directories. They were built as manual
worktrees under a session scratchpad in `/private/tmp`, which may have been cleaned since — that
costs you the checkouts, not the work. `git worktree prune` clears stale registrations; the branches
and `trial-merge` survive regardless.

## Step 1 — land the batch, and merge `trial-merge`, not the three branches

**`trial-merge` @ `bccc5555` already contains all three branches merged, plus a fix that exists
nowhere else.** Merging `wt-erg-002`/`003`/`004` individually will leave `noodl-core-ui` **red**.

⚠️ **Why.** ERG-003 ships a census test that derives the list-shaped port surface from the catalog and
asserts 46 input ports. ERG-004 adds `Object Changed` and `Array Changed`, each with one list-shaped
input, making it 48. The fix belongs to the *merge* — applied to `wt-erg-003` alone it would be red
there, because that branch's catalog has no new nodes. It also corrected a fault in the test's own
shape: the count assertion ran **before** the coverage loop, so a drifting census aborted the block
and could mask a port that had silently lost its editor. **Invariant first, snapshot second.**

Verified 2026-08-02: `trial-merge` merges onto `86e89277` with **zero conflicts**, catalog included.

```
git merge trial-merge          # or merge cline-dev into it, then fast-forward
npm run catalog:generate       # then confirm `git diff` is EMPTY
npm run catalog:check && npm run catalog:merge:check && npm run cloud-library:check
```

⚠️ **The empty-diff check is the one that matters.** A merged catalog can be conflict-free and still
wrong; byte-identical to regeneration is the only proof. Never hand-merge `node-catalog*.json`.

**Suite baseline on the merged tree** (measured, `--ci`, per package, not through `lerna`):
runtime 2092 / 0 failed (111/112 suites; the 112th is deliberately-skipped live-endpoint tests, 13
pending), viewer-react **62/62** / 853, editor 15/15 / 140, core-ui 11/11 / 112.

⚠️ **If you run these from a worktree rather than the primary checkout, expect one false failure.**
`obs-003-repeater-items` dies with `TypeError: Cannot redefine property: items` when
`node_modules/@noodl/runtime` resolves to the *primary* checkout, loading `collection.ts` twice so
its `Array.prototype.items` patch runs twice. It is an artefact of the symlink, not a defect — it
passes 14/14 in the primary. Diagnose it by reading the **file path in the stack trace**.

## Step 2 — the remainders, in the order they are worth doing

### A. Live QA — the whole batch's outstanding balance

All three agents were forbidden to launch Electron (the ERG-001 session held the single-instance
lock), so **every one of them owes criterion-7-shaped debt** and each named it rather than dropping
it. Read `ERG-00{2,3,4}-NOTES.md` §4 for the full lists. The two that matter most:

- **ERG-003 — `Function.scriptInputs`** (proplist). Reorder in JSON mode and confirm the per-input
  Type dropdowns stay attached. `proplist` entries carry an `id` that is the `parentItemId` the
  runtime hangs child ports off, so a reorder that drops it silently detaches every child port.
  Also: `Page Inputs.pathParams`, `Global Store.initialState`, `Repeater.items`.
- **ERG-004** — its corpus settles between events where a real graph batches **within a frame**, so
  the signal-before-value class could resurface under a real frame clock. Seven items in its notes.

### B. ERG-002's four remainders

Built and tested but **not wired**, each stopped by a territory fence rather than a problem:

1. **Code-editor completion** — `library-completions.ts` exists and is tested against a real
   CodeMirror `EditorState`; it is not registered in `codemirror-extensions.ts`.
2. **AI loop** — `AuthoringContextBuilder.libraryOverview()` works when a caller supplies data;
   nothing supplies it from the live project. The call site is `AiAuthoringPanel.tsx`.
3. **The validator rule** — not attempted. Needs free-variable AST analysis plus a `NormNode` schema
   change; it is task-sized on its own.
4. **Criteria 4 and 6 — a real deployed build.** ⚠️ The spec is explicit that the preview is not
   evidence: phase 30 found four defects that only a deployed build revealed.

### C. ERG-005 — the whole task, and it needs the editor

Not started. §0 is **blocking measurement, not writing**, and the spec forbids answering it from
source: both `Page`'s dead ports and `Page Inputs`' absent ports lived inside `setup()`, which
`graph-harness` does not call. Five questions, answered live. Then §1 gives the Port Editor mechanism
a `description` channel — it is the worst-documented of the four dynamic-port mechanisms and the
reason NDA-005 reports these two nodes as `n/a`. **§2 changes no typing behaviour**; it is a written
decision for Richard with §0's measurements attached.

### D. ⚠️ The unowned defect — a signal and its value port, permanently out of order

ERG-004 found this while driving its corpus twice, and **fixed only its own node**. Nobody has swept
the library.

`sendValue` returns early on `undefined` (`node.ts:682-698`) and the receiver drains with
`Object.keys(this._inputValuesQueue)` (`node.ts:566`) — insertion order of keys created on each
port's **first** delivery. So a value port that is `undefined` the first time has its key created
*after* the signal that already fired, and is then delivered **behind that signal permanently** — not
once, for the life of the node. ERG-004's `Previous Value` landed one signal late on every
`Object Replaced` after the first. The fix there was to emit `null` rather than `undefined`, which is
what the empty-value contract asks for anyway.

**This is latent in any node pairing a signal with a possibly-undefined value port** — the NV-ii
shape phase 30 already found four times, and the one ERG-001's own contract work is shaped like.
⚠️ ERG-001 §3 edits `reportOutcome`, **not** `sendValue`, so nothing about this has been touched.
A test that exercises the node once cannot see it: **drive every candidate twice.**

### E. ERG-003 Option A, if Richard wants it

Deferred deliberately, not forgotten, and it is a real task rather than a footnote. `stringlist`
stays a comma-separated string because **24 files / 48 call sites** under `noodl-runtime/src/nodes`
and `noodl-viewer-react/src/nodes` each independently `split(',')` the raw parameter — e.g.
`httpnode.ts:956` casts `parameters.bodyFields as string` before splitting — and `setInputValue`
hands the raw parameter to each node's own setter, so there is no single seam to migrate at. The
corpus test in `wt-erg-003` is the gate for doing it properly. See `ERG-003-NOTES.md`.

---

## The prompt

Continue **phase 35 (Track T)** on branch `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`. Read
`dev-docs/tasks/phase-35-authoring-ergonomics/NEXT-SESSION-PROMPT-CLOSEOUT.md` in full first, then
`README.md` for the phase, then the spec and `-NOTES.md` of whichever task you take.

**Check for a concurrent session before touching anything.** ERG-001 was live in this checkout when
the closeout prompt was written and may still be. `git status --porcelain` proves nothing on its own —
it was clean at one session's start and six files were modified two minutes later. Compare file
mtimes against `date`, and check `ps -eo pid,lstart` for an Electron whose start time precedes yours.

If another session is live:

- **Never `git stash`, never `git add -A`, never `git checkout <path>` on a file you have edited.**
- ⚠️ **A pathspec on `git add` is not enough — `git commit` needs one too.** A bare `git commit`
  commits the whole index, and has already swept another session's staged files into a commit here.
  Always `git commit -m "…" -- <paths>`.
- **The editor takes a single-instance lock.** Do not launch it if they hold it; both sessions drive
  one Electron, and any edit under `packages/` reloads theirs mid-script. Never run `npm run
  dev:stop` — it kills by checkout and takes their run down with yours.
- Do isolated build work in a worktree instead, and **defer live QA to a session that owns the
  checkout.** If you must build in a worktree, build it manually (`git worktree add -b <name> <path>
  cline-dev`) rather than with `isolation: "worktree"`, which roots at `origin/main` — ~660 commits
  stale, 7-for-7 across previous batches. Symlink `node_modules`, then **repoint
  `node_modules/@noodl/*` at the worktree's own `packages/*`** or you will get the dual-resolution
  false failure described above. Never run `npm install` in a worktree that symlinks node_modules.

**Recommended order:** land `trial-merge` first (§1 above) so the batch stops aging against a moving
branch — it is verified clean and it is one command. Then, **if you own the editor**, spend the
session on live QA (§2A) and ERG-005 §0, because both are blocked on nothing else and ERG-005 §0 is
the phase's last piece of blocking measurement. If you do **not** own the editor, take ERG-002's
remainders (§2B) or the `sendValue` sweep (§2D), neither of which needs it.

**Standing rules for this phase.** An inherited claim is a hypothesis you must test — this phase has
now overturned premises in three of its own specs, including two in this batch, and every correction
was written back into the spec file rather than left in a report. Where a measurement contradicts a
spec, **the measurement wins and you correct the spec.** `description` is canonical; enrichment
`ports` may only add what the source cannot know. A declared `default` never runs its setter, so the
default behaviour must be correct without it. `dev-docs/reference/COMPATIBILITY-POLICY.md` is
binding: existing Noodl projects are not a design constraint, and no task may be narrowed or
dual-pathed to protect them.

**Report honestly.** Say which success criteria are met, which are outstanding, and which are blocked
— and on what. Debt that is named survives; debt that is dropped does not.
