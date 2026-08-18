# RUN 3 — **CN-016 (Publish a kit)**. Phase 69 is at **19 of 20**, and CN-016 is now UNBLOCKED.

**Written 2026-08-18, end of s31.** ✅ **CN-017 is BUILT and CLOSED — all five acceptance criteria
met.** ✅ **Richard ruled the blocker the same day (D21): CN-016 AC1 is descoped to a built artefact
plus a divergence gate.** So CN-016 is buildable, it is the last task in the phase, and **closing it
closes phase 69 at 20/20.**

⚠️ Also fixed in s31, on Richard's ruling: archive-extraction containment in `@noodl/platform-node`.
🔴 **The flag that prompted it was overstated and is corrected in §3 — do not re-raise it as a live
`../` traversal.**

## Read, in this order

1. **[RULINGS.md D21](RULINGS.md)** — what AC1 now is, and **the two moves it does not permit**.
2. **[CN-016-PUBLISH-A-KIT.md](CN-016-PUBLISH-A-KIT.md)** — the task, with AC1 amended in place.
3. **§2 and §3 of this file** — what CN-017 built that CN-016 now sits on, and the measured facts you
   would otherwise re-derive.

---

## 1. ✅ AC1, as ruled — and the two things the ruling does not permit

**AC1 is now:** *the reference kit installs from a **built artefact** into a fresh project, its node
is placeable with zero console errors, **and a gate fails the moment the origin and `library/`
diverge.***

🔴 **The gate is the load-bearing half, not the descope.** Descoping alone would close phase 69 and
leave the origin rotting further — which is the state that produced the problem. The gate turns an
invisible drift into a red build the next time anyone touches it. **If you build the install and skip
the gate, you have not met AC1.**

🔴 **You may not satisfy AC1 by installing from a local folder that happens to resolve.** That is the
exact move the original criterion forbade, it would read as green, and it would be false. *"A built
artefact"* means the output of `library:build`, addressed as a build output.

⚠️ **And `library:build` writes a GITIGNORED `library-dist/`** — which is its own recorded trap twice
over: a gitignored artefact makes tests vanish, and an ignored build leaves an observation with no
provenance. `git check-ignore -v` before trusting anything you measure against it.

**Why it had to be ruled:** the real origin serves **2024 Noodl content**, nothing publishes
`library/`, and "copy it into the docs repo" is a documented manual step nobody has ever performed.
The fix belongs to phase 65's **LBR-001**, which is `Not started`. That gap **stays phase 65's** — this
ruling does not close it, it stops it widening unobserved.

⚠️ **A peer holds `scripts/library/check.ts` uncommitted and is scoping phase 65.** `library:check` is
AC4's gate and the divergence gate's most likely home, so it is **the single most collision-prone file
in this task**. Announce before editing it.

## 2. What CN-017 built, and what CN-016 inherits from it

CN-016 is *"publish a kit"*; CN-017 was *"decide whether to run somebody else's"*. They meet at the
install path, and the install path now has a shape you must build **with**, not around.

### 2a. Every plan states where it came from, and the type system enforces it

```ts
// import-engine/types.ts
export type ImportOrigin =
  | { kind: 'local-project' }                                    // a folder on this machine
  | { kind: 'export-staging' }                                   // the throwaway project an export zips
  | { kind: 'downloaded'; url: string; consents: KitConsent[] }; // an archive from a URL
```

`ImportPlan.origin` and `PlanOptions.origin` are **required**. 🔴 **If CN-016 adds an install route,
it will not compile until it has said what it is** — that is deliberate, and it is the enforcement.
Making it optional to "get moving" removes the only thing stopping the next route from being
ungated.

⚠️ **A required field is invisible to `typecheck` in a `.js` file.** Two untyped spec helpers
(`tests/project/projectimport.js`, `projectimportapply.js`) called `plan()` with four arguments and
**only `test:ci` caught them** — `Cannot read properties of undefined (reading 'renames')`. If you
touch these signatures, sweep tracked `*.js`/`*.jsx` by hand; the compiler will not.

### 2b. The gate is in the copy loop, not in the installers

`import-engine/moduleGate.ts` → `copyPlannedModules()` owns the loop and takes the copy function as a
parameter. `apply()` calls it. An executable module (a kit **or** an ERG-002 library — both inject a
`<script>`) from a `downloaded` origin with no consent record is **not copied**, and the warning names
it.

✅ **So a CN-016 install route gets the gate for free** if it goes through `apply()`. It gets nothing
if it writes to `noodl_modules/` directly — and there is no second check that would catch that.

### 2c. Consent, and the words

`views/ImportFlow/openKitConsent.tsx` → `requireDownloadConsent({title, url, sourceDir})`. Called by
`ModuleLibraryModel._install` (**above** the `hasCollisions` fork, because LIB-005's one-click path
skips the flow entirely) and by `EditorPage._importProject`. Returns an `ImportOrigin`; throws
`ImportFlowCancelled` on decline, **including on dismiss** — a consent that can be given by not
answering is not consent.

⚠️ **No dialog when the download carries no executable module.** A prefab of plain components still
installs in one click; a prompt for an icon set would train people to click through the one that
matters.

🔴 **The copy is in `kitConsentCopy.ts`, as data, and AC5 is graded on it two ways** — as data, and by
reading `openKitConsent.tsx` **off disk as source** and sweeping it, because a `.tsx` is invisible to
the plain-Node jest runner. **If CN-016 adds a publish or install surface with its own words, put
them in a `.ts` module or they are ungradeable.** No UI text may call a verified kit "safe".

### 2d. Provenance

`noodl_modules/kit-provenance.json`, a **three-arm discriminated union** (`local` / `imported` /
`installed`). A local kit has no verification field to misread; an installed one cannot be
constructed without one. `describeKitOrigin()` is the **only sanctioned renderer** — the Kits section
and the property-panel byline both use it, so they cannot describe one kit two ways.

🔴 **It is not in the kit's `manifest.json`, and CN-016 must not put a publish record there either.**
That file arrives inside the archive, authored by the party being vouched for. Phase 67 closed a
defect of exactly that shape (E8).

⚠️ **Both scaffold routes record it now** — `createNodeKit` (editor) and `create_node_kit` (MCP, via
`editor-deps.ts`). A third producer of kits must record too, or its kits read as *"origin not
recorded"*.

---

## 3. Five things measured in s31 that you would otherwise re-derive

1. **`verifyLibrarySource` cannot verify a kit.** `globalName` is a hard requirement
   (`projectmodules.ts`) and a kit declares no global — it calls `Noodl.defineModule`. Use
   **`verifyKitSource`**, which shares the sandbox via `createBrowserSandbox()`.
2. **Neither existing kit evaluator is callable from the editor.**
   `noodl-mcp/src/kitExtract/entry.js` is an **esbuild entry for a child process**;
   `noodl-viewer-react/static/ssr/kit-modules.js` needs a **deploy's `index.html`** and evals in the
   caller's own global scope.
3. **The runtime sandbox responder's `noodl_modules/` pattern is not a security carve-out.**
   `responder.ts:36` is in a `PASSTHROUGH` array beside `static/` and `favicon`, used once
   (`responder.ts:302`) to return `null` = *let this reach the network untouched*. HTTP routing in
   AIX-008's mock backend. **CN-017 item 4 is closed; do not reopen it.**
4. **The module installer caches and reuses `getUserDataPath()/library/<name>` without re-downloading**
   (`modulelibrarymodel.ts:239-283`). A check inside the download branch runs on the **first** install
   of a module and never again. Anything CN-016 adds must run on the **resolved root path**.
5. 🔴 **JSZip's LOADER normalises `../` out of entry names — and its WRITER does too.** A fixture
   built with `zip.file('../x')` therefore produces a perfectly safe archive and grades nothing;
   s31's first traversal spec passed for exactly that reason and had to be rewritten to inject the
   hostile name into the *loaded* archive instead.

✅ **Archive extraction: raised, measured, corrected and FIXED on 2026-08-18 — Richard ruled "fix it
now".**

🔴 **The flag as CN-017 originally wrote it was WRONG, and this is the important half.** *"A crafted
archive with `../` entries writes outside its target"* is **false here**: JSZip strips `../` before
the writing code sees it, and `path.join` eats a leading `/`. The commit message `ce96338c` carries
the overstated wording; CN-017 §8 carries the correction.

**What was real:** a **backslash entry on Windows**, which this app ships to. `..\win.js` survives
JSZip, and `path.join('C:\tmp\target', '..\win.js')` is `C:\tmp\win.js`.

**Fixed:** `resolveZipEntryPath` + `extractZipToFolder` in `@noodl/platform-node`, lifted out of
`unzipUrl`'s `XMLHttpRequest` closure so a plain-Node spec can reach them. The **whole archive is
refused on one bad entry, before any write**, and the failure names the entry. 9 specs under
`test:platform` (a CI gate), one of which pins JSZip's own normalisation so an upgrade that changes
it fails loudly. ⚠️ **`FileSystemElectron extends FileSystemNode` and does not override `unzipUrl`**,
so the editor inherits this — there is one implementation, reached through a subclass.

🔴 **Do not re-raise this as a live `../` traversal.**

---

## 4. ✅ Gates — MEASURED ON THIS TREE, s31. Re-measure before claiming a delta.

Tree: `cline-dev` with CN-017's 24 changed/added files and nothing else of mine.

| Gate | Result |
|---|---|
| `test:ci` @ `NOODL_SPEC_SEED=39393` | ✅ **2849 total / 10 failed — AT FLOOR, the same ten BY NAME** (§4a) |
| editor `test:main` | ✅ **3875 / 254 suites, ZERO failures** |
| `typecheck:editor` | ✅ 0 |
| `typecheck:editor-tests` | ✅ 0 |
| `typecheck:mcp` | ✅ 0 |
| `test:packages` | ✅ all green |
| `@noodl/mcp` alone | ✅ **644 / 54, ZERO failures** |
| new: `tests-unit/cn-017` | ✅ **52 / 4 suites** |

🔴 **`@noodl/mcp` reported 2 failures in `projectOwnsBackend.test.ts` when `test:packages` ran
beside a live `test:ci`, and 0 when re-run alone.** Contention, not a regression — but it is the
recorded shape of *"a build beside a suite"*, so **do not run `test:packages` and `test:ci`
concurrently** and do not trust a lone red from either while the other is running.

⚠️ **`typecheck:mcp` is stricter than `typecheck:editor`** (strictNullChecks). Pulling an editor
module into `editor-deps.ts` surfaces null errors the editor's own config never showed — s31 fixed
two by making `manifestLooksLikeKit` and `moduleDeclaresExecutableCode` **type predicates**, which is
the right fix rather than a cast.

Standing rules that bit or nearly bit this session:

- 🔴 **Delete `packages/noodl-editor/tests/test-results.json` before a run and prove completion from
  its mtime.** A clean floor run exits **1**; any pipe reports the pipe's last command.
- 🔴 **Never pipe a suite to `tail`** — it loses the failure list *and* the exit code.
- 🔴 **A `.js`/`.jsx`/`.tsx` change is invisible to every gate but `test:ci`.**
- ⚠️ **If you edit source while `test:ci` is running, its result is for a tree that no longer exists.**
  s31 did exactly that, stopped the run and started a clean one rather than quote a stale number.

### 4a. `test:ci` — measured, at floor, same ten by name

`NOODL_SPEC_SEED=39393` · **2849 total, 10 failed** · `seed: 39393` read back out of
`test-results.json` · fresh mtime confirmed against `date`, not assumed.

The ten, by name — **identical to the s29 floor**, so CN-017 adds none and fixes none:

| # | Failure |
|---|---|
| 4 | `AIX-006 style vocabulary` — guidance-off accept · stalled provider · advisory pass then resubmit · suggestion never downgrades |
| 2 | `AI model registry` — openai-compatible shares the OpenAI catalogue · exactly one default per provider |
| 1 | `AIX-011 — update mode is judged against its own base` (AAQ-005 pre-existing blocking warning) |
| 3 | `SUB-011 expression parameters — the validator stays silent` — silent · silent after round-trip · silent in strict mode |

⚠️ **The total is unchanged at 2849 because CN-017's 52 specs are `tests-unit/` (jest), not `tests/`
(the electron jasmine suite).** A phase-69 change that *did* add electron specs would move this
number, so do not read "2849" as proof that nothing was added.

🔴 **This is run THREE.** Run 1 was stopped (source edited under it). Run 2 came back at floor but
its webpack bundle predated two later edits, so it was re-run rather than quoted — see the last
bullet in §4.

---

## 5. Before you launch anything

```bash
git status --short packages/noodl-editor/src   # empty is NOT sufficient
ListAgents                                     # then ASK, by name, before launching
```

🔴 **A launching stack is invisible for ~75s** — no Electron process, 9222 still free. **Two editors
do not coexist on this checkout even on different CDP ports**, and a peer's edit to a bundled file
between your launch and `reactMounted` wedges the renderer until you relaunch.

⚠️ **Attribute Electron processes by their command line.** This machine routinely has five
`node_modules/electron/dist/…/Electron` processes that are all `noodl-mcp/dist/noodl-mcp.cjs` MCP
servers, not editor stacks. `ps -Ao pid,ppid,command` and read the argument.

⚠️ **Peers currently hold** `scripts/library/check.ts`, `phase-50`/`phase-68` notes, the untracked
`phase-65-the-library/` and `phase-70-the-course-is-an-app/` dirs, and
`tests-unit/uni-001/session-readers.test.ts`. Not yours. Commit with explicit pathspecs, never
`git add -A`. 🔴 **Never `git stash` here.**

## 6. One minute of unfinished business, still unclaimed

README §4: the picker-index prune and a console-message dedup are proven by unit tests and 5/5
mutants but **never re-driven** — the live readings in
[notes/s29-drive-observations.md](notes/s29-drive-observations.md) are from an 18:00:17 bundle and the
shipped one is 18:33:21. **s30 and s31 both built without launching an editor**, so this is still
open. If you launch one anyway, break a kit two ways and read the two Settings → Kits rows; neither
should say *"only PARTIALLY registered"* of a kit that registered nothing.

🆕 **And if you do launch, CN-017 has two things worth one minute of eyes**, since neither was
driven: the **kit origin line** under each card in Settings → Kits (a scaffolded kit should read
*"written here"*, never *"origin not recorded"*), and the **property-panel byline** on a kit node
(`from <kit> · written here`). Both render from `describeKitOrigin`, so a disagreement between them
would be a real defect rather than a styling nit.

## 7. When you finish

Update `CN-016-PUBLISH-A-KIT.md` and `TASKS.md` with what you **measured**, including corrections to
the task file's own premises — CN-017's write-up does that for four of its own, and it is the most
useful part of a close. Rewrite this file for the session after you. Save anything that outlives
phase 69 to memory rather than here.

**If CN-016 closes, phase 69 is done at 20/20** and this campaign's README should be overwritten
rather than amended. There is no remaining blocker and no remaining ruling — D21 was the last one.
