# NOTES — DSG-007, a project that can own its backend

**Built 2026-08-11**, in a worktree off `cline-dev` tip `80868946`. Territory: `packages/noodl-mcp` only.
Commits at the bottom.

The register's headline holds — **a project has no stable identity a backend can be bound to** — but
almost every *mechanism* the spec gives for it is wrong, and one of its three exhibits is the system
working correctly. What follows is what the code and the disk actually say, checked on 2026-08-11.

---

## §1 — Re-verification: three of the spec's claims are false

| Spec claim | Verdict |
|---|---|
| §2's disk table (7 backends, ports, `projectIds`) | ✅ **exact**, byte for byte |
| §3's already-bound refusal at `provisionTools.ts:87-95` | ✅ **exact** |
| "**No v2 project on this machine has an `id`**" | 🔴 **false** — 13 of 20 do |
| "nothing in the v2 creation path writes one" | 🔴 **false** for MCP — `create_project` has minted one since AIX-012 |
| F28: "two `Stock Cupboard Backend`s … is the predicted stranding" | 🔴 **false** — two *different projects*, correctly kept apart |
| F27: "the `ecommerce-example` workaround is gone" | ⚠️ **half right**, and the mechanism is the opposite of the one given |

### The projects that do have an id

Every project `create_project` wrote carries a `crypto.randomUUID()`: `Kiln & Co.` ×10, both
`Stock Cupboard`s, `ecom-responsive-probe`. The seven without one — `Puppy test 3`, `Puppy test`,
`Tutorial project`, `ecommerce-example`, `test1`, `puppy-test-2` — are exactly the projects **the
editor** created or has opened and saved. The split is not "v2 projects" versus anything; it is
**editor-touched** versus **MCP-only**.

### 🔴 F28 is the ownership rule working, not failing

The two `Stock Cupboard Backend`s on 8583/8584 are owned by
`NodeGX test projects/phase58-backend-deferred` (`1de70885-…`) and
`NodeGX test projects/phase58-backend-alltools` (`31fb013d-…`) — the two arms of P58/S4's paid control
experiment, created 19 seconds apart, each correctly bound to its own backend with its own database.

That is **DSG-007's own last acceptance criterion being met**: *"two different projects both named
'Shop' must not share a backend."* Reading it as stranding is the mirror-image error of the defect —
and acting on it (merging them) would have destroyed one arm's data. F28 should be closed as
**not a defect**.

---

## §2 — 🔴 The actual root cause, which is not in the spec at all

The spec says the creation path never writes `id`. It is worse than that: **the editor mints an `id`
and then deletes it, twice over.** Two lines in one file, both in
`packages/noodl-editor/src/editor/src/models/projectmodel.ts`:

1. **The constructor does not read it.** `ProjectModel`'s constructor (`:148-157`) copies `name`,
   `settings`, `version`, `runtimeVersion`, `metadata` off the parsed file — and **not `id`**, even
   though the class declares `public id?: string` at `:122`. So `ProjectModel.fromJSON` on a project
   file that *does* carry an `id` yields a model whose `.id` is `undefined`.
2. **`toJSON()` does not emit it.** `toJSON()` (`:1383`) lists nine keys; `id` is not among them. And
   the v2 save path is `projectmodel.ts:662` → `.saveProject(retainedProjectDirectory, this.toJSON())`
   → `buildProjectV2File`, whose `if (project.id !== undefined) file.id = project.id`
   (`ProjectExporter.ts:377`) is therefore **dead code on every save**.

So the sequence is:

- `LocalProjectsModel._addProject` (`:175-183`) **does** mint `project.id = guid()` for a new project —
  the spec is wrong that nothing does. It lives in memory only.
- The first save drops it. `nodegx.project.json` is written **without `id`**.
- Every subsequent load leaves `.id` undefined, and every subsequent save deletes the field again if
  anything else put it back.

That single fact explains every row of §2's table without needing any other hypothesis:

- **Three backends with `projectIds: []`** — `provisionBackend.ts:358` reads `project.id`, which is
  `undefined` for any project that has been *reloaded*, so `createBackend` stamped nothing.
- **`Puppy test 3 backend` owns `692d3658-…`, which no project file claims.** Consistent with a
  provision that ran while the id was still in memory (or via MCP), followed by an editor save that
  deleted the field. The backend kept the stamp; the project lost the proof.
- **F27's "the hand fix does not survive whatever rewrote that file."** The thing that rewrote it was
  an ordinary editor save. Nothing exotic, and it will do it again to any fix applied by hand.
- ⚠️ **F27's other half is wrong**: `projectIds: ["ecommerce-example"]` is *not* a project name being
  used where an id belongs. `NodeGX test projects/ecom-responsive-probe/nodegx.project.json` carries
  `"id": "ecommerce-example"` — a hand-written id that merely *reads* like a name, in a project that
  survived because it was never opened in the editor. The stamp is correctly matched. The project the
  spec was looking at (`ecommerce-example/`) is a different directory that lost its id to a save.

**This is the fix DSG-007 §4.1 and §4.2 are really asking for, it is two lines, and it is outside this
task's territory** (`packages/noodl-editor`, with a concurrent session live in that checkout). It is
not done. Nothing below substitutes for it.

---

## §3 — What was built, in `packages/noodl-mcp`

### Identity, adopted rather than invented

⚠️ Checked first, per the design-disjointness rule: `tools/createProject.ts` already mints project ids
with `crypto.randomUUID()`, and every project that path produced carries one. The new module mints
**the same shape** so a backfilled project and a freshly created one are indistinguishable to
`findReusableBackend`. No new format, no new config key, no second record.

⚠️ Deliberately **not** merged with process-ownership identity (`kind` + `pid` + session start time,
`backend/runtimeRecord.ts`). That answers "may I signal this pid"; this answers "may I take this
database". Different questions, different failure modes. `runtimeRecord.ts` is untouched, and no
orphan guard was rebuilt — `--parent-pid`, the heartbeat and the reaper already stack.

### `src/backend/projectIdentity.ts` (new) — §4.2

`ensureProjectId(projectDir)` returns `present` / `minted` / `unavailable`, and:

- **adds `id` and nothing else.** `modified` is deliberately not bumped — acquiring an identity is not
  a change to the design, and a bumped timestamp is a spurious diff in every VC panel that shows one.
  A test compares the *whole* object before and after, not a field list.
- **is idempotent by construction.** A project that already has one is not opened for writing at all;
  the test asserts the bytes *and* the mtime are unchanged.
- **never throws.** A missing, unparseable or unwritable project file yields `unavailable` with a
  sentence, and an unparseable file is left exactly as it was — repairing it here would hide the real
  fault.
- **`id` goes after `name`**, matching `create_project`'s skeleton and the schema's property order, so
  a backfilled file and a created one diff to nothing but the value.

### `explainReuse` in `backend/provision.ts` — §4.3

The rule was never wrong; its only failure mode was silence. `findReusableBackend` returned
`undefined` for **five materially different situations** and the caller's response to all five was to
create a second backend without comment. Now each gets a verdict and a sentence, carried in
`reuseVerdict`/`reuseNote` **and appended to `warnings`**, so a caller that only reads `warnings`
still sees it.

- `reused` / `none-of-that-name` — nothing to say.
- `project-has-no-id` — a namesake exists; this project cannot prove it owns it; the identity reason is
  quoted rather than guessed at.
- `owned-by-another-project` — says *"this is correct, not a failure"*, because it is.
- ⚠️ `identity-only-just-minted` — **found by a failing test, not by reading the spec.** A project whose
  id was minted on this very call has by definition never owned anything, so a same-named backend is
  far more likely *its own*, stranded when the identity went missing, than a stranger's. Reporting
  that as the ordinary `owned-by-another-project` case would print "this is correct, not a failure"
  over precisely the state `Shop backend` and `Puppy test 3 backend` are in. It gets its own verdict
  and names the repair.
- `unowned-namesake` — reported, **never adopted**. Taking a backend on its name alone is the
  AAQ-002/F4 defect ownership exists to prevent, and "it had no owner" is not a safe special case, it
  is the *common* case for exactly those orphans.

`findReusableBackend` itself is **unchanged** — it is the rule mirrored from the editor's copy, and the
name-only match is not reintroduced anywhere.

### `censusBackends` + `list_backend_processes` — §4.4

Classifies every backend **directory** (not process — an unowned backend is usually not running, which
is why nobody notices it) as `owned` / `owned-namesake` / `unowned`, and returns a note naming the
unowned ones. It **reports and deletes nothing**: a backend directory is a database.

⚠️ Deviation: §4.4 asks for this on `list_backends`, which lives in `tools/backendTools.ts` — outside
the territory I was given. It went on `list_backend_processes` instead. Moving it is a few lines.
Also note `client.listBackends()` **drops `projectIds`** from its descriptor, so it could not have
carried this without a change anyway; `listBackendConfigs()` was added for it.

### Wiring

`provision_backend` now calls `ensureProjectId(store.projectDir)` **before** provisioning, and reports
`projectId`, `projectIdentity`, `reuseVerdict` and `reuseNote`.

---

## §4 — The consequence, not the mechanism

`tests/projectOwnsBackend.test.ts` runs DSG-007's headline acceptance criterion against a **real
`nodegx-backend`** — provision, restart the server, provision again — and asserts one backend
directory rather than two, the same `backendId`, and an id read back off the file rather than
re-minted.

⚠️ It first **deletes the `id` from the copied fixture**, because `tests/fixtures/demo-app` ships
`"id": "demo-app-0001"`. **That is why 350 existing tests never caught F2**: the only project the
provisioning suite has ever seen was already fixed. A fixture that cannot fail the way the machine
does will pass forever.

A second test pins the **limit**: an id lost between two provisions — exactly what an editor save does
today — still produces a second backend directory. It is now `identity-only-just-minted` with a note
naming the repair, instead of silence. That test exists so nobody reads the first one as the phase
closing.

**Suite: 31 suites, 352 tests, all passing**, with `packages/nodegx-backend` built so the end-to-end
blocks actually ran rather than skipping. `npx tsc --noEmit` is clean apart from six pre-existing
errors in `tests/interfaceGate.test.ts` and `tests/stagingDiagnostics.test.ts`, which I did not touch.

---

## §5 — Migration for the stranded backends: **proposed, nothing executed**

⚠️ Nothing under `~/.noodl/backends/` was created, modified or deleted. The two live
`Stock Cupboard Backend` processes were not signalled. Only `config.json` files were read.

The repair does not need to guess, because **the binding already exists in the other direction**: each
stranded project records `metadata.cloudservices.endpoint`, and that endpoint identifies a backend. So
the rule is *"give the project an id, then add that id to the backend it already points at"* — no name
matching anywhere.

| Project (no `id`) | Points at | Backend | Today's `projectIds` | Proposed |
|---|---|---|---|---|
| `Puppy test 3` | 8581 | `backend_msjck0y2ukxwv` | `["692d3658-…"]` — claimed by nobody | mint an id, append it; leave the stale entry (harmless) |
| `Tutorial project` | 8580 | `backend_msdakk0sgym7s` App backend | `[]` | mint, append |
| `ecommerce-example` | 8582 | `backend_msk1w1ujnckt4` Shop backend | `["ecommerce-example"]` — held by `ecom-responsive-probe` | mint, **append alongside**; do not replace |
| `Puppy test` **and** `test1` | both 8578 | `backend_mkgmvdcayltzq` SQLite backend | `[]` | ⚠️ **needs a human** — two projects, one database. Deliberate or an accident of the defect? |
| — | — | `backend_ms94j6xso72rl` BCN009 QA (8579) | `[]` | **no project points at it.** Keep as a QA fixture or delete; a human decides. **Do not delete.** |
| `phase58-backend-deferred` | 8583 | Stock Cupboard | `["1de70885-…"]` | ✅ **nothing to do — correct** |
| `phase58-backend-alltools` | 8584 | Stock Cupboard | `["31fb013d-…"]` | ✅ **nothing to do — correct** |

⚠️ **Do not run this migration before the editor fix in §2.** Every id it writes will be deleted by the
next editor save of that project, and the machine will be back in this state with more stale stamps in
the configs than it has now.

### A hazard the register does not mention

`phase55-s8-deepseek-v4-pro` and `phase55-s8-ds-probe` **share the id `62a47fc5-3579-409f-a691-8a577e2538b2`** —
one is a copy of the other, and a copy inherits the id. Two projects that both prove ownership of the
same backend is the *other* end of this defect, and copying a project directory is something this repo
does constantly. Not fixed here; worth its own register row. The right answer is probably that a
project opened from a directory whose recorded path differs from its own re-mints, which is a bigger
decision than DSG-007.

---

## §6 — Could not verify

- **That the editor's save actually deletes an `id` in a running editor.** The read is from source
  (`toJSON` at `projectmodel.ts:1383` omits it, and `:662` is the only caller of `saveProject`), and it
  matches all seven no-id projects on disk. But I did not launch the editor to watch a file lose the
  field: the primary checkout has a concurrent session in it, and launching Electron was prohibited.
  The claim is source-plus-disk, not observed.
- **Which write actually stamped `692d3658-…` onto `Puppy test 3 backend`.** The editor path and the
  MCP path both fit. Nothing on disk distinguishes them.
- **`ecommerce-example` versus `ecom-responsive-probe` provenance.** That one is a copy of the other is
  inference from the shared id-as-name, not history.
- **Whether the two live backends on 8583/8584 are still in use.** Not probed, not signalled.
- **`test:ci` / `test:main`.** Prohibited in this worktree (they reap by checkout). Only
  `packages/noodl-mcp`'s own jest was run, from the package directory.

---

## §7 — Register, revised

| # | Finding | State |
|---|---|---|
| F2 | A project has no durable identity a backend can be bound to | 🟡 **half closed** — closed on the MCP side (backfill + creation path + loud degradation, all pinned); **open** in `noodl-editor`, where the real cause is |
| **F30** | 🔴 **`ProjectModel` neither reads `id` on load nor emits it in `toJSON`, so every editor save DELETES it.** Two lines, `projectmodel.ts:148` and `:1383`. This is F2's root cause and was not in the spec | 🔴 **open** — outside DSG-007's territory |
| F27 | The `ecommerce-example` id evaporated | ✅ **explained** by F30. ⚠️ But *"it carries the project name, not an id"* is **wrong** — `ecom-responsive-probe` really has `id: "ecommerce-example"` |
| F28 | Two `Stock Cupboard Backend`s = predicted stranding | 🔴 **withdrawn — not a defect.** Two different projects, correctly separated. Acting on it would have destroyed a paid experiment's data |
| F29 | The already-bound refusal blunts the worst case | ✅ verified, unchanged |
| **F31** | `create_project` **already** minted an `id` and nothing pinned it — so §4.1's "the creation path does not populate it" was false for the MCP half | ✅ **now pinned** |
| **F32** | `tests/fixtures/demo-app` ships `"id": "demo-app-0001"`, so no provisioning test could ever reproduce F2 | ✅ **closed** — the new suite strips it |
| **F33** | ⚠️ `phase55-s8-deepseek-v4-pro` and `phase55-s8-ds-probe` share one project id — a copied directory inherits ownership | 🔴 **open, unfixed**, needs its own decision |
| **F34** | `client.listBackends()` drops `projectIds`, the field every ownership decision turns on | ✅ worked around via `listBackendConfigs()` |
