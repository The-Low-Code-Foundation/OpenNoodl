# RUN 2 (retry) — build **CN-017 (Trust)**. Phase 69 is still at 18/20.

**Written 2026-08-18, end of s30.** 🔴 **s30 BUILT NOTHING.** It read the install path, corrected
three of the *previous* prompt's readings, and was then redirected onto a phase-67 question for the
rest of the session. **CN-017 is still never started**, and the floor in §6 is **inherited, not
measured** — s30 ran no gates at all.

So this file is the previous prompt with §2 replaced by what was actually measured. Everything s29
wrote that s30 confirmed is kept; the three things s29 got wrong are marked 🔴 **s30 CORRECTION**.

## Read, in this order

1. **[CN-017-TRUST.md](CN-017-TRUST.md)** — the task and ✅ D6.
2. **§2 and §3 of this file** — the install path as measured, and the one decision to take first.
3. **[README.md](README.md) §0** — the concurrency rule. §2 there is Richard's open ruling on
   CN-016 and is **not yours**.

---

## 1. The job

**Build CN-017, and nothing else.** Tier 6, effort **L**. It goes before CN-016 because CN-016 lists
it as the gate for anything not first-party, and CN-017 depends on nothing outside this repo.

Five acceptance criteria; the two easiest to get wrong:

- 🔴 **AC1 — a locally-scaffolded kit runs with NO prompt and NO gate.** That is D6's promise and the
  first thing a consent flow breaks. Test it on **real `createNodeKit` output**, not in principle.
- 🔴 **AC5 — no UI text may call a verified kit "safe".** Verification establishes *what a script
  defines*. It is a smoke test for shape, **not a security boundary.**

---

## 2. 🔴 The install path, measured. Four routes, ONE write.

s29's prompt had a three-row table and it was right about the row that matters and **missing a
route**. The correct map — every path by which kit code lands in a project's `noodl_modules/`:

| route | entry point | source of the code | verified? |
|---|---|---|---|
| **library** (a UMD global) | `LibrariesSection.tsx:103` → `registerLibrary` | fetched URL / dropped file | ✅ **yes** — `verifyLibrarySource` before any write |
| **local kit** (scaffold) | `KitsSection.tsx:162` → `createNodeKit` | generated on the spot | ⚠️ no, and **AC1 says it must stay that way** |
| **module / prefab from the library** | `ModuleCard.tsx:59-60` → `ModuleLibraryModel.installModule` / `installPrefab` | **a zip downloaded from a URL**, unzipped into user data | 🔴 **NO** |
| 🆕 **import from a downloaded archive** | `EditorPage.tsx:298` `_importProject` | **a URL-unpacked archive** | 🔴 **NO — and s29's prompt does not mention this route at all** |
| **import from another local project** | `projectlibrarymodel.ts:35` | a project on this machine | ⚠️ no (local; probably correct) |

🔴 **The bottom three converge on one line, and that line is the write AC2 is about:**

```ts
// import-engine/apply.ts:210-220 — inside apply(), after the model changes, in the "disk work" block
const modules = plan.modules.filter((m) => active(m.policy));
for (const m of modules) {
  FileSystem.instance.copyRecursiveSync(
    source._retainedProjectDirectory + '/noodl_modules/' + m.name,
    target._retainedProjectDirectory + '/noodl_modules/' + m.name
  );
```

A module carrying `project/noodl_modules/*` therefore lands **kit code in the project with no check of
any kind**, by three different doors.

### 2a. 🔴 This is the scope decision, and it is NOT the one s29 framed

s29 recommended *"build CN-017 against the install path that exists (`ModuleLibraryModel`)"*. That
recommendation **misses `_importProject`**, which unpacks an archive **from a URL** — by any honest
reading, at least as third-party as the curated module library. Hooking only `ModuleLibraryModel`
would ship an AC2 that reads as met and leaves the more obviously untrusted door open.

The two real options:

| | Where the check goes | Catches | Cost |
|---|---|---|---|
| **(a)** | the two **installers** (`ModuleLibraryModel` + `_importProject`) | both URL-sourced routes | two call sites to keep in step; a third installer added later is unprotected by default |
| **(b)** | `apply.ts`, at the module-copy loop | **all three**, by construction | also gates **project-to-project import**, which is local code — needs an explicit carve-out or it brushes AC1's spirit |

✅ **Recommendation: (b), with the source of the plan carried into `apply` as data** so the copy loop
can distinguish "this came from a URL" from "this came from a folder on this machine" — rather than
two installers each remembering to call a checker. **Put the distinction in the plan, not in the
callers**; that is the same move as putting the guarantee on the decision (§4).
⚠️ **Whichever is chosen, say in the task file which routes are verified and which are not.** A
sentence naming the covered set is the difference between a scoped AC and a false one.

### 2b. Two properties of the download path to design around, not discover

- **It caches, and reuses a non-empty cache directory without re-downloading**
  (`getModuleTemplateRoot` → `isDirectoryEmpty` → `findProjectRoot`, `modulelibrarymodel.ts:239-283`).
  A once-installed module is **never re-fetched**, so a check placed *inside* the download branch is
  skipped on every install after the first. Put it outside, on the resolved root path.
- **It already writes outside the project, silently** — `platform.getUserDataPath() + '/library/<name>'`.
  CN-017's trap list says a provenance store *"must not write outside the project without saying
  so"*. The **installer** is already doing the thing the trap warns about. ⚠️ **"A failing kit writes
  nothing" is therefore about the PROJECT, not about the machine** — say so in as many words, or the
  criterion is quietly false. If you want it literally true, the only clean version is: remove the
  cache dir *when this call created it and verification then failed*, which is provable-safe because
  the directory was empty before the call.

### 2c. 🔴 s30 CORRECTION — s29's "reuse one of the two kit evaluators" is not executable as written

s29 was right that `verifyLibrarySource` has the **wrong contract** — `globalName` is a hard
requirement (`projectmodules.ts:136-138`) and a kit declares no global, it calls
`Noodl.defineModule`. That stands.

🔴 **But neither replacement it names can be called from the editor.** Measured:

- **`noodl-mcp/src/kitExtract/entry.js`** is an **esbuild entry for a child process**. It
  `require`s `@noodl/runtime`, `noodl-viewer-react/src/register-nodes` and a `dom-shim`, and is
  bundled to `dist/kit-extract.cjs`. Its own header says the separate process **is** the containment.
  It is not a function; there is nothing to import.
- **`noodl-viewer-react/static/ssr/kit-modules.js`** takes `htmlData` — **a deploy's `index.html`** —
  and reads the injector's script tags out of it. There is no `index.html` at install time. It also
  evaluates with bare `new Function(source)()`, i.e. **in the caller's own global scope**, which is
  correct for a server render and wrong for verifying a stranger's code inside the editor renderer
  (`nodeIntegration: true`).

✅ **What is actually reusable, and the split is the point:**

| half | reuse | why |
|---|---|---|
| **the sandbox** | `verifyLibrarySource`'s `vm.createContext` browser-shaped context (`projectmodules.ts:148-174`) | already in the editor, already isolated, already the ERG-002 discipline the task names |
| **the question** | the `defineModule`-collecting shim from `kitExtract/entry.js:93-97` — a `Proxy` noop base with `defineModule: (m) => collected.push(m)` | the honest kit-side question is *"did it call `defineModule`, and what did it define?"* |

That is **one** new function in `projectmodules.ts`, beside `verifyLibrarySource`, sharing its
sandbox builder — not a third evaluator. 🔴 **Extract the sandbox object into a helper both call**,
or it is a copy and LIB-003's regression happens by other means. Record the choice and this reasoning
in CN-017.

### 2d. ✅ Item 4 is already answered — close it, do not spend a session on it

`packages/noodl-runtime/src/sandbox/responder.ts`'s `noodl_modules/` entry sits in a `PASSTHROUGH`
array whose own comment reads *"Paths the sandbox must not touch: the viewer's own origin-relative
assets"*, beside `static/` and `favicon`. It is **HTTP routing in a mock Parse backend**. It does not
gate, sandbox or observe code execution. 🔴 **Do not read it as a security carve-out.** Write that
sentence into CN-017 and close the item.

---

## 3. 🔴 Where provenance lives — decide this before writing anything

**A provenance record must not live in the kit's own `manifest.json`.** That file arrives **inside
the zip**, authored by the party being vouched for, so a kit could ship
`installedFrom: {origin: 'local'}` and be believed. Phase 67 has a recorded case of exactly this
shape — a forgeable link, closed in E8 — and it is the same defect class.

Measured, for wherever you put it:

- **The scanner enumerates directories only** (`module-inject/src/index.js:126-133`:
  `isDirectory() || isSymbolicLink()`), so a plain **file** under `noodl_modules/` is invisible to
  every existing reader. That makes `noodl_modules/` a possible home; it also means nothing currently
  reads such a file, so you own both ends.
- ✅ **There is precedent for the editor writing a record file into the project:** LIB-006's
  `writeImportReport` writes `import-report.json` + `IMPORT-REPORT.md` at **stable paths, overwritten
  per import**, and its reasoning (a stable path is what makes the project's own git history the
  record) applies unchanged here.
- ⚠️ **`manifestLooksLikeKit` is SUBTRACTIVE** (`projectmodules.ts:585-592`): a kit is `main` +
  *not* `kind: 'external-library'` + *not* `type: 'iconset'`. There is **no positive kit marker**.
  Adding one is safe for that predicate (it only rejects two known values) but 🔴 **do not collapse
  the two kinds into one field** — `registerLibrary:348` and `removeLibrary:437` both refuse to touch
  a folder they did not create, and that asymmetry is the model to copy, not to merge.

---

## 4. 🔴 Make the fields incapable of contradicting each other — concretely

The trap CN-017 names against itself: *a record with `verified: true` beside one with
`source: local` invites the reader to conclude local kits were verified.* A flat record with both
fields **cannot** be written safely, because `{origin: 'local', verified: false}` reads as *suspicious*
and `{origin: 'local', verified: true}` reads as a *lie*. Both are wrong about the same kit.

✅ **A discriminated union has exactly the states that exist** — and note this is the shape two
surfaces in this repo already reached for independently (`AskAboutNodeDialog`'s `postState`:
*"⚠️ Not three booleans … The union has exactly the states that exist"*, and `CommunityAccountState`):

```ts
type KitProvenance =
  | { origin: 'local' }                    // authored here. NO verification field EXISTS on this arm.
  | { origin: 'installed'; url: string; installedAt: string;
      verification: KitVerifyResult; consentedAt: string };
```

A local kit has **no** verification field to misread, and an installed record **cannot be
constructed without one**. 🔴 **Then render from the union, not from a flattened view of it** — the
§5 defect below was invisible in a correct model and appeared in the panel.

---

## 5. Traps that will bite this task specifically

- 🔴 **Read the surface, not the model.** s29 found Settings → Kits telling an author a kit was *"only
  PARTIALLY registered"* in the same sentence as *"NONE of this kit's nodes register"* — two fields
  made to contradict, shipped to a panel, and **invisible in `getModuleFailures()`, which was right
  all along**. Whatever consent and provenance you build, **render it and read the rendering.**
- ⚠️ **A behavioural guard can be decoration.** Test that consent actually **blocks execution**, on a
  fixture that tries to run without it. A dialog that appears and is ignored passes any test that
  only asks whether the dialog appeared.
- ⚠️ **Connect writes the real `~/.claude.json`** — this repo's recorded case of a feature touching a
  live user file. See §2b: the module installer already writes to user data.
- ⚠️ **Out of scope, keep it out:** signing, a trusted-author registry, runtime sandboxing of kit code.
- ⚠️ **Worth flagging to Richard rather than scoping in:** `unzipIntoDirectory` extracts a downloaded
  archive with no path checks. Install-time, adjacent, outside D6.
- ⚠️ **Do not assume modules work.** P65's audit: **0 of 29 shipped modules have ever been run**, 3
  register zero nodes, ~9 vendor third-party libraries with no licence text, **mapbox-gl v2+ is
  proprietary**. If you need a fixture that really installs, expect to make one.

---

## 6. ⚠️ Gates — INHERITED FROM s29, NOT MEASURED. Re-measure before you claim a delta.

🔴 **s30 ran no gates.** These are s29's numbers on s29's tree. The tree has not changed since
(`git status` clean but for three files belonging to other phases' peers), so they are *probably*
still true — **and "probably" is not a floor.** Re-measure, then compare **by name**.

| Gate | s29 value |
|---|---|
| `test:ci` @ `NOODL_SPEC_SEED=39393` | **2849 / 10 failed** — the **same ten by name**: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`, 1 × `AIX-011`, 3 × `SUB-011 expression parameters` |
| editor `test:main` | **3816 / 249 suites, ZERO failures** |
| `typecheck:editor` | **0** |
| others | `@noodl/runtime` 2537/139 · `noodl-viewer-react` 931/73 · `noodl-viewer-cloud` 189/9 · `kit-catalog` 78 · `module-inject` 27 · `noodl-mcp` 644/54 · `kit-scaffold` 68/5 |

- 🔴 **Delete `packages/noodl-editor/tests/test-results.json` before the run and require a fresh
  mtime.** A stale file reads as a perfect pass. **Prove completion from the mtime, never `$?`** — a
  clean floor run exits **1**, and any pipe reports the pipe's last command.
- 🔴 **Never pipe a suite to `tail`** — it loses the failure list *and* the exit code.
- ✅ **Above floor? Compare failure sets BY NAME** — revert your own files to `HEAD` (never
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

## 7. Before you launch anything

```bash
git status --short packages/noodl-editor/src   # empty is NOT sufficient
ListAgents                                     # then ASK, by name, before launching
```

🔴 **s29 checked at 17:44, got "empty", and a peer's stack was mid-compile by 18:00.** A launching
stack is invisible for ~75s: no Electron process, 9222 still free. **Two editors do not coexist on
this checkout even on different CDP ports**, and a peer's edit to a bundled file between your launch
and `reactMounted` wedges the renderer until you relaunch.

✅ **s30's own instance of this, and it is the useful half:** a peer held an editor stack on 9222 for
most of this session and **announced its teardown unprompted**. Verified independently before
believing it — 9222 free, no `electron/dist` / `start.ts` / webpack processes, tree unchanged. **An
announcement is not evidence of a process; walk `ps` either way**, in both directions.

⚠️ **Peers currently hold** `scripts/library/check.ts`, `phase-50`/`phase-68` notes, and the
untracked `phase-65-the-library/` and `phase-70-the-course-is-an-app/` dirs. Not yours. Commit with
explicit pathspecs, never `git add -A`. 🔴 **Never `git stash` here.**

**Most of CN-017 is buildable without a stack. Prefer that.** When you do need one, README §9 has
the CDP recipes — there is **no editor global**, models come through
`webpackChunknoodl_editor.push`, and **the launcher can list two cards with the same name** (verify
from `ProjectModel.instance`, not the card you clicked).

---

## 8. One minute of unfinished business, still unclaimed

README §4: the picker-index prune and a console-message dedup are proven by unit tests and 5/5
mutants, but **not re-driven** — the live readings in
[notes/s29-drive-observations.md](notes/s29-drive-observations.md) are from the 18:00:17 bundle and
the shipped one is 18:33:21. s30 did not launch an editor, so this is **still open**. **If you launch
one for CN-017 anyway**, break a kit two ways and read the two Settings → Kits rows. Neither should
say *"only PARTIALLY registered"* of a kit that registered nothing.

## 9. What s30 spent its session on, so nobody re-derives it

Richard asked why a signed-in editor offers nothing, which is **phase 67, not this phase.** Measured
and reported to him; **not written into phase 67's files** — if the next session is a phase-67 one,
that write-up is owed:

- Exactly **two** editor surfaces read the community session — the launcher chip and
  `AskAboutNodeDialog`. The only route in is right-click one node → "Ask about this node".
- **`community.nodegx.io` has no working HTTPS.** DNS → `49.12.102.195` (nexus-1, same box as
  `nodegx.io`); port 80 gives a 308; the TLS handshake fails with **alert 80, no peer certificate**,
  on **two** independent TLS stacks, with `nodegx.io` on the **same IP** as a passing control. So
  E2 is not "unowned and pending", it is **measurably dead**, and E10's callback URL has nowhere to
  land.
- The missing in-editor community page is **UNI-011's unbuilt half**, gated by **D16** (30 threads ·
  3 weeks with a call held · median first reply < 24h) and by **D19** (08-18: the forum is now
  *built*, not bought, conditional on UNI-014's email). ⚠️ **But D16 promises the entry point
  "exists either way and always goes somewhere real" — and no such entry point was ever built.**
  That is a real gap inside D16 rather than ahead of it.

## 10. When you finish

Update `CN-017-TRUST.md` and `TASKS.md` with what you **measured** — including corrections to the
task file's own premises, the way §2 above corrects three of s29's. Rewrite this file for the session
after you. Save anything that outlives phase 69 to memory rather than here.

**After CN-017, phase 69 is 19/20 and only CN-016 remains** — which cannot start until Richard rules
on README §2. If appetite runs out there, **say so plainly**: 19/20 with CN-016 named and deferred is
a clean stopping point, and leaving it ambiguous is the one bad outcome.
