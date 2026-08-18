# RUN 2 — build **CN-017 (Trust)**. Phase 69 is at 18/20; this is one of the last two.

**Written 2026-08-18, end of s29.** s29 read the code before writing this, and **three of the task
file's premises need correcting before you start.** They are §2 below. Read them first — two of them
change what you build, not just how.

## Read, in this order

1. **[CN-017-TRUST.md](CN-017-TRUST.md)** — the task and ✅ D6.
2. **§2 of this file** — what s29 measured that the task file does not know.
3. **[README.md](README.md) §0** — the concurrency rule. s29 got caught by it. §2 there is Richard's
   open ruling on CN-016 and is **not yours**.

---

## 1. The job

**Build CN-017, and nothing else.** Tier 6, effort **L**. It goes before CN-016 because CN-016 lists
it as the gate for anything not first-party, and CN-017 depends on nothing outside this repo.

Five acceptance criteria; the two easiest to get wrong:

- 🔴 **AC1 — a locally-scaffolded kit runs with NO prompt and NO gate.** That is D6's promise and the
  first thing a consent flow breaks. Test it on **real `createNodeKit` output**, not in principle.
- 🔴 **AC5 — no UI text may call a verified kit "safe".** Verification establishes *what a script
  defines*. It is a smoke test for shape, **not a security boundary**.

---

## 2. 🔴 Three corrections. Read before designing anything.

### 2a. The install site is NOT Settings → Libraries. It is the **Node Picker**, and it unzips.

The task file says *"reuse ERG-002's verify-before-write discipline"*, which is real — but it is real
on the **library** path, and that is not where a third-party **kit** arrives. Measured:

| path | entry point | verified? |
|---|---|---|
| **library** (a UMD global) | `LibrariesSection.tsx:103` → `registerLibrary` → `verifyLibrarySource` (`projectmodules.ts:340`) | ✅ **yes**, before any write |
| **local kit** (scaffold) | `KitsSection.tsx:162` → `createNodeKit` | ⚠️ no, and **AC1 says it must stay that way** |
| **third-party kit / module** | `ModuleCard.tsx:59-60` → `ModuleLibraryModel.installModule` / `installPrefab` → `_install` | 🔴 **NO verification, no consent, no provenance** |

🔴 **That third row is where AC2, AC3 and AC4 land**, and nothing in the task file points at it.
`ModuleLibraryModel.getModuleTemplateRoot` downloads a zip from a URL and unzips it into
`platform.getUserDataPath() + '/library/<name>'`, then `_install` copies the contents into the project
through the import flow. A module carrying `project/noodl_modules/*` therefore lands **kit code in the
project with no check of any kind**.

⚠️ **Two properties of that path you must design around, not discover:**
- **It caches, and it reuses a non-empty cache directory without re-downloading** (`isDirectoryEmpty`
  → `findProjectRoot`). So a once-installed module is **never re-verified**, and a verification hook
  in the wrong place will be skipped on every install after the first.
- **It already writes outside the project, silently** — into user data. CN-017's own trap list says a
  provenance store *"must not write outside the project without saying so"*. The **installer** is
  already doing the thing the trap warns about. Say so; do not quietly match it.

### 2b. `verifyLibrarySource` has the WRONG CONTRACT for a kit. Do not force it.

`verifyLibrarySource(code, globalName)` — and `globalName` is a **hard requirement**:

```
if (!name) return { ok: false, message: 'A global variable name is required to verify a library.' };
```

Its whole question is *"did global `X` appear?"* (`projectmodules.ts:135`, returning
`LibraryVerifyResult { ok, message, otherGlobalsDefined? }`). **A kit declares no global** — it calls
`Noodl.defineModule({ ... })`. So reusing it verbatim means inventing a global name a kit does not
have, and the check would answer a question nobody asked.

✅ **Two kit-shaped evaluators already exist. Reuse one of those instead:**
- `packages/noodl-mcp/src/kitExtract/entry.js` — runs a kit's `index.js` with a `defineModule` shim
  that **collects** what it defined, and already isolates per-kit failures.
- `packages/noodl-viewer-react/static/ssr/kit-modules.js` — evaluates a kit the way a `<script>` tag
  does (`new Function(source)()`), reports loaded / threw / skipped, and since ✅ D19 installs a
  `React` shim for the duration.

The honest kit-side question is *"did it call `defineModule`, and what did it define?"*, which is the
same shape as `verifyLibrarySource`'s three distinguished failure modes and the same reason they are
good. 🔴 **Say in the task file which evaluator you reused and why** — a third one is the regression
LIB-003 exists to end, and this phase already has four hand-written copies of the `defineModule` shim
on record.

### 2c. Item 4 is already answered. It is **vestigial for trust purposes.**

The task file asks you to establish what the sandbox responder's `noodl_modules/` pattern is for.
Measured — `packages/noodl-runtime/src/sandbox/responder.ts`:

```ts
/** Paths the sandbox must not touch: the viewer's own origin-relative assets. */
const PASSTHROUGH = [
  /\.(js|css|map|png|…)($|\?)/i,
  /^\/?noodl_modules\//,
  /^\/?static\//,
  /^\/?favicon/
];
```

It is an **HTTP-routing carve-out in a mock Parse backend** — it stops the sandbox from trying to
answer requests for the viewer's static assets, alongside `static/` and `favicon`. It does not gate,
sandbox or observe code execution. 🔴 **Do not read it as a security carve-out**, and do not build
consent on top of it. Write that one sentence into CN-017 and close item 4.

---

## 3. What to decide before you write code

**A scope boundary, and it is genuinely ambiguous.** AC2 says *"installing a third-party kit runs
verification, and a failing kit writes nothing."* Per §2a there is an install path today, so AC2 is
**hookable without inventing a distribution mechanism** — good. But CN-016 owns publishing and
installing *from the real origin*, and Richard has an **open ruling** on whether that origin gap gets
closed at all (README §2).

✅ **Recommendation: build CN-017 against the install path that exists** (`ModuleLibraryModel`), and
say explicitly in the task file that it is verified for **the module-library route**, leaving the
origin question where it already sits. Do **not** wait on CN-016, and do **not** build a second
installer.

⚠️ **Do not build on an assumption that modules work.** P65's audit: **0 of 29 shipped modules have
ever been run**, 3 register zero nodes, ~9 vendor third-party libraries with no licence text,
**mapbox-gl v2+ is proprietary**. If you need a fixture that really installs, expect to make one.

⚠️ **Out of scope, keep it out:** signing, a trusted-author registry, runtime sandboxing of kit code.
⚠️ **Worth flagging to Richard rather than scoping in:** `unzipIntoDirectory` extracts a downloaded
archive with no path checks. That is an install-time concern adjacent to this task and outside D6.

---

## 4. Traps that will bite this task specifically

- 🔴 **Put the guarantee on the decision, not the observation.** A record with `verified: true` beside
  one with `source: local` invites the reader to conclude local kits were verified. **Make the fields
  incapable of contradicting each other.** This is not hypothetical: s29 found Settings → Kits telling
  an author a kit was *"only PARTIALLY registered"* in the same sentence as *"NONE of this kit's nodes
  register"* — two fields made to contradict, shipped to a panel. README §4 has the mechanism, and
  the lesson is that the **contradiction appeared downstream of a correct model**.
- 🔴 **Read the surface, not the model.** That defect was invisible in `getModuleFailures()`, which was
  right all along. Whatever consent and provenance you build, **render it and read the rendering.**
- ⚠️ **A behavioural guard can be decoration.** Test that consent actually **blocks execution**, on a
  fixture that tries to run without it. A dialog that appears and is ignored passes any test that only
  asks whether the dialog appeared.
- ⚠️ **`registerLibrary` already refuses to overwrite a kit** — `projectmodules.ts:348` bails when an
  existing manifest lacks `kind: 'external-library'`, and `:437` mirrors it on removal. That asymmetry
  is deliberate and is the model for a kit-side marker. Do not collapse the two kinds into one field.
- ⚠️ **Connect writes the real `~/.claude.json`** — this repo's recorded case of a feature touching a
  live user file. See also §2a: the module installer already writes to user data.

---

## 5. Before you launch anything

```bash
git status --short packages/noodl-editor/src   # empty is NOT sufficient
ListAgents                                     # then ASK, by name, before launching
```

🔴 **s29 checked at 17:44, got "empty", and a peer's stack was mid-compile by 18:00.** A launching
stack is invisible for ~75s: no Electron process, 9222 still free. **Two editors do not coexist on
this checkout even on different CDP ports**, and a peer's edit to a bundled file between your launch
and `reactMounted` wedges the renderer until you relaunch. Announce the launch, ask who owns the
uncommitted files, announce teardown to everyone you announced the launch to. **Never `git stash`
here**; commit with explicit pathspecs, never `git add -A`.

Peers currently hold `scripts/library/check.ts`, `phase-50`/`phase-68` notes, the untracked
`phase-65-the-library/` and `phase-70-the-course-is-an-app/` dirs, and the launcher surfaces
(`noodl-core-ui/src/preview/launcher/**`, `ProjectsPage.tsx`, `useCommunityAccount.ts`). Not yours.

**Most of CN-017 is buildable without a stack. Prefer that.** When you do need one, README §9 has the
CDP recipes s29 worked out — there is **no editor global**, models come through
`webpackChunknoodl_editor.push`, and **the launcher can list two cards with the same name** (verify
from `ProjectModel.instance`, not the card you clicked).

---

## 6. Gates — floor re-measured by s29 on this tree, not inherited

| Gate | Value |
|---|---|
| `test:ci` @ `NOODL_SPEC_SEED=39393` | **2849 / 10 failed** — the **same ten by name**: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`, 1 × `AIX-011`, 3 × `SUB-011 expression parameters` |
| editor `test:main` | **3816 / 249 suites, ZERO failures** |
| `typecheck:editor` | **0** |
| others | `@noodl/runtime` 2537/139 · `noodl-viewer-react` 931/73 · `noodl-viewer-cloud` 189/9 · `kit-catalog` 78 · `module-inject` 27 · `noodl-mcp` 644/54 · `kit-scaffold` 68/5 |

- 🔴 **Delete `packages/noodl-editor/tests/test-results.json` before the run and require a fresh
  mtime.** A stale file reads as a perfect pass. **Prove completion from the mtime, never `$?`** — a
  clean floor run exits **1**, and any pipe reports the pipe's last command.
- 🔴 **Never pipe a suite to `tail`** — it loses the failure list *and* the exit code.
- ✅ **Above floor? Compare failure sets BY NAME, not counts** — revert your own files to `HEAD` (never
  `git stash`), re-run at the same seed, diff the names.
- ⚠️ `npx tsc --noEmit` in `noodl-runtime` reports two **pre-existing** `EditorConnection` redeclare
  errors. Not yours.
- ⚠️ **A `.tsx`/`.jsx` change is invisible to every gate but `test:ci`.** CN-017 is mostly UI, so
  expect `test:main` to stay green on a broken panel. Drive it, or grade the rendering directly.
- ⚠️ **Anything you change in the viewer or `noodl-runtime` needs `npm run ci:build:viewer` before a
  drive** — and `packages/noodl-editor/src/external` is **gitignored**, so the rebuild leaves no diff
  and no gate reproduces the artefact a deploy copies. Stamp mtime + md5 in any drive note, and pick
  your pre-flight grep marker from **your own change**, never from a handover.

---

## 7. One minute of unfinished business from RUN 1

README §4: the picker-index prune and a console-message dedup are proven by unit tests and 5/5
mutants, but **not re-driven** — the live readings in
[notes/s29-drive-observations.md](notes/s29-drive-observations.md) are from the 18:00:17 bundle and the
shipped one is 18:33:21. **If you launch an editor for CN-017 anyway**, break a kit two ways and read
the two Settings → Kits rows. Neither should say *"only PARTIALLY registered"* of a kit that
registered nothing.

## 8. When you finish

Update `CN-017-TRUST.md` and `TASKS.md` with what you **measured** — including corrections to the task
file's own premises, the way §2 above corrects three of them. Rewrite this file for the session after
you. Save anything that outlives phase 69 to memory rather than here.

**After CN-017, phase 69 is 19/20 and only CN-016 remains** — which cannot start until Richard rules
on README §2. If appetite runs out there, **say so plainly**: 19/20 with CN-016 named and deferred is a
clean stopping point, and leaving it ambiguous is the one bad outcome.
