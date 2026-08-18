# Next session — phase 69 is at **18/20**. Do **CN-017 (Trust)** and nothing else.

**Written 2026-08-18, end of s29.**

## Read first, in this order

1. **[README.md](README.md) §0, §1, §2** — the map, the step-zero concurrency rule that s29 got
   caught by, and the ruling Richard still owes on CN-016 AC1.
2. **[CN-017-TRUST.md](CN-017-TRUST.md)** — the whole task.
3. **README §4** — one small unobserved gap from RUN 1. If you launch an editor for any reason,
   spend one minute closing it.

## Your job

**Build CN-017.** It is Tier 6, effort **L**, and it is **self-contained** — nothing outside this repo
blocks it, which is why it goes before CN-016. `verifyLibrarySource` (ERG-002) and `registerLibrary`'s
`kind: 'external-library'` marker already exist: this is **wiring an existing mechanism to kits**, not
inventing one. Do not start CN-016 in the same session; each is a session.

The two acceptance criteria that are easiest to get wrong:

- 🔴 **AC1 — a locally-scaffolded kit runs with NO prompt and NO gate.** That is D6's promise and the
  easiest thing to break while building a consent flow. Test it on a **real scaffold output**.
- 🔴 **AC5 — be honest about the limits.** `verifyLibrarySource` establishes *what a script defines*,
  not that it is safe. **No UI text may call a verified kit "safe".**

⚠️ **Make the fields incapable of contradicting each other.** `verified: true` sitting beside
`source: local` invites the reader to conclude local kits were verified. This is not hypothetical
here: s29 found Settings → Kits telling an author a kit was *"only PARTIALLY registered"* in the same
sentence as *"NONE of this kit's nodes register"* — two fields made to contradict, shipped to a panel.
README §4 has the mechanism.

⚠️ **Say what the sandbox responder's `noodl_modules/` pattern (`responder.ts:36`) is for** —
vestigial or load-bearing. Do not assume.

⚠️ **Out of scope, keep it out:** signing, a trusted-author registry, runtime sandboxing of kit code.

## Before you launch anything

```bash
git status --short packages/noodl-editor/src   # empty is NOT sufficient — see below
ListAgents                                     # then ASK, by name, before launching
```

🔴 **s29 saw "empty" at 17:44 and a peer's stack was mid-compile by 18:00.** A launching stack is
invisible for ~75s: no Electron process, 9222 still free. **Two editors do not coexist on this
checkout**, and a peer's edit to a bundled file between your launch and `reactMounted` wedges the
renderer until you relaunch. Announce the launch, ask who owns the uncommitted files, and announce
teardown to everyone you announced the launch to. **Never `git stash` here**; commit with explicit
pathspecs.

CN-017 is mostly buildable without a stack. Prefer that.

## Gates, and how to read them

Floor to beat, **re-measured by s29 on this tree**, not inherited:

| Gate | Value |
|---|---|
| `test:ci` @ `NOODL_SPEC_SEED=39393` | **2849 / 10 failed** — the **same ten by name**: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`, 1 × `AIX-011`, 3 × `SUB-011 expression parameters` |
| editor `test:main` | **3816 / 249 suites, zero failures** |
| `typecheck:editor` | **0** |
| `@noodl/runtime` | 2537 / 139 · `noodl-viewer-react` 931 / 73 · `kit-catalog` 78 · `module-inject` 27 · `noodl-mcp` 644 / 54 |

- 🔴 **Delete `packages/noodl-editor/tests/test-results.json` before the run and require a fresh
  mtime.** A stale file reads as a perfect pass. **Prove completion from the mtime, never `$?`** — a
  clean floor run exits 1, and any pipe reports the pipe's last command.
- 🔴 **Never pipe a suite to `tail`.**
- ✅ **If you come back above floor, compare failure sets BY NAME, not counts** — revert your own files
  to `HEAD` (never `git stash`), re-run at the same seed, diff the names.
- ⚠️ `npx tsc --noEmit` in `noodl-runtime` reports two **pre-existing** `EditorConnection` redeclare
  errors. Not yours.

## Two traps from s29 that will bite anyone touching kits

- 🔴 **`registerModule` still throws, deliberately.** `noodl-viewer-cloud/src/kitModules.ts:286` and
  `noodl-mcp/src/kitExtract/entry.js:145` both read that throw to report a broken kit at all.
  Silencing it leaves both `catch` blocks dead **while both surfaces call a broken kit healthy.**
- 🔴 **`packages/noodl-editor/src/external` is gitignored and a deploy COPIES it.** A viewer rebuild
  leaves no diff and no gate reproduces the artefact a user ships. If a reading depends on the bundle,
  stamp its mtime and md5 in your notes.

## When you finish

Update `CN-017-TRUST.md` and `TASKS.md` with what you **measured**, rewrite this file for the session
after you, and save anything that outlives phase 69 to memory rather than here. If appetite runs out
before CN-016, **say so plainly** — 19/20 with CN-016 named and deferred is a clean stopping point,
and §2 explains why leaving it ambiguous is the one bad outcome.
