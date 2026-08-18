# CN-017 — Trust

| Field | Value |
|---|---|
| **Tier** | 6 |
| **Effort** | L |
| **Surface** | `runtime`, `editor`, `library` |
| **Rulings** | ✅ **D6** — local kits run freely; third-party **verified on install**, provenance recorded, **explicit consent** |
| **Depends on** | CN-006b (provenance display), CN-003 |
| **Gates** | CN-016 for anything not first-party |

## What we are actually shipping

A kit is **arbitrary JavaScript with full page access**, injected by `<script>` tag into the same
context as the app. It can read anything the app can read, call anything the app can call, and reach
the network. That is not a flaw to be engineered away — it is what makes a custom node as capable as
a built-in, which is **P1**. It does mean the honesty bar is high.

Note also that the runtime's sandbox responder already carries a `noodl_modules/` path pattern
(`responder.ts:36`), so there is an existing carve-out whose intent this task must establish rather
than assume.

## ✅ D6, in three parts

**1. Locally-authored kits run freely.** A kit you wrote in your own project is not gated. Gating it
would couple authoring to distribution — you could not validate your own work until you had published
it — and would make CN-006's scaffold useless. This is the part that keeps the phase's promise
intact.

**2. Third-party kits are verified on install.** Reuse ERG-002's **`verifyLibrarySource`**: it runs
fetched source in a `vm.createContext` sandbox shaped like a browser tab (`window`/`self`/`globalThis`
aliased, stub `document`/`navigator` so a UMD wrapper's `typeof` probes fall through) and confirms
what it actually defines. Its three distinguished failure shapes (ES module, CommonJS, wrong global)
are the right model: **a check that says what went wrong and what to do**, not a boolean.

⚠️ Be precise about what verification buys. `verifyLibrarySource` establishes *what a script defines*,
**not that it is safe**. Do not let the install dialog imply otherwise. Sandboxed execution is a
smoke test for shape, not a security boundary.

**3. Provenance recorded, explicit consent for non-first-party.** This is what makes CN-006b's
provenance display load-bearing rather than cosmetic: the property panel is where a user finds out
whose code is running in their app.

## What to build

1. **Verification on install** for library/URL-sourced kits, reusing `verifyLibrarySource` and
   ERG-002's verify-before-write discipline (a failed check writes nothing to disk).
2. **A provenance record** per kit — local / library / URL, source, when, and what was consented to.
   `registerLibrary` already writes a `kind: 'external-library'` manifest marker so list/remove never
   touch a hand-authored module; kits need the equivalent.
3. **A consent step** for non-first-party kits that states plainly what a kit can do. One clear
   sentence beats a wall of warning.
4. **Establish what the sandbox responder's `noodl_modules/` pattern is for** and whether it
   constrains anything today. If it is vestigial, say so; if it is load-bearing, document it.

## Acceptance criteria

1. A locally-scaffolded kit runs with **no prompt and no gate** — the D6 promise, and the easiest one
   to accidentally break.
2. Installing a third-party kit runs verification, and a failing kit **writes nothing**.
3. Provenance is recorded and visible in the property panel (CN-006b) and the kits list.
4. The consent copy states what a kit can do, in one sentence, without either minimising or
   catastrophising.
5. ⚠️ **Verification is honest about its limits** — no UI text claims a verified kit is "safe".

## Traps

- 🔴 **Put the guarantee on the decision, not the observation.** A record saying "verified: true" next
  to one saying "source: local" invites a reader to conclude local kits were verified. Make the
  fields incapable of contradicting each other — this repo has a recorded case of exactly two fields
  made to contradict.
- ⚠️ **A behavioural guard can be decoration.** Test that consent actually blocks execution, on a
  fixture that tries to run without it.
- ⚠️ **Connect writes the real `~/.claude.json`** — a recorded case of a feature touching a live user
  file. Any provenance store must not write outside the project without saying so.

## Out of scope

- Signing, a registry of trusted authors, or runtime sandboxing of kit code. All are defensible
  futures; none are D6, and pretending otherwise would delay the phase indefinitely.

---

# ✅ BUILT — s31, 2026-08-18. All five acceptance criteria met.

**What this section is:** what was *measured*, including four of this task file's own premises that
turned out to be wrong, and where each criterion is graded. The spec above is left standing so the
corrections are visible as corrections.

## 0. Four premises of the spec above, corrected

| # | The spec said | Measured |
|---|---|---|
| 1 | *"Reuse ERG-002's `verifyLibrarySource`"* | 🔴 **Wrong contract, and it cannot be reused as-is.** `globalName` is a hard requirement (`projectmodules.ts:136-138`: *"A global variable name is required to verify a library."*) and it grades the script on whether that global appeared. **A kit declares no global** — it calls `Noodl.defineModule` — so every kit on earth fails that check for a reason that is not about the kit. What *is* reused is the **sandbox**, extracted into `createBrowserSandbox()` and shared by both, so the two cannot drift the way the two `noodl_modules` scanners drifted before LIB-003 |
| 2 | (s29's prompt) *"reuse one of the two kit evaluators"* | 🔴 **Neither is callable from the editor.** `noodl-mcp/src/kitExtract/entry.js` is an **esbuild entry point for a child process** — it `require`s `@noodl/runtime`, the viewer's `register-nodes` and a `dom-shim`, and bundles to `dist/kit-extract.cjs`; there is no function to import. `noodl-viewer-react/static/ssr/kit-modules.js` takes a **deploy's `index.html`** and reads script tags out of it (there is no `index.html` at install time), and evaluates with a bare `new Function(source)()` **in the caller's own global scope**. What was reusable was the *question*: the `defineModule`-collecting `Proxy` shim from `kitExtract/entry.js:93-97`, copied deliberately and cited |
| 3 | *"the sandbox responder already carries a `noodl_modules/` carve-out whose intent this task must establish"* | ✅ **Established, and it is not a security carve-out.** `responder.ts:36` sits in a `PASSTHROUGH` array whose own comment reads *"Paths the sandbox must not touch: the viewer's own origin-relative assets"*, beside `static/` and `favicon`. It is used at exactly one place (`responder.ts:302`) to return `null`, meaning *let this request reach the network untouched*. It is **HTTP routing in AIX-008's mock Parse backend** and gates, sandboxes and observes nothing. 🔴 **Do not read it as a carve-out.** Item 4 is closed |
| 4 | *"three install routes"* (s29's prompt) | 🔴 **Four.** `EditorPage._importProject` (`EditorPage.tsx:297`) unpacks **an archive from a URL** and was named nowhere. It is at least as third-party as the curated module library, and hooking only `ModuleLibraryModel` would have shipped an AC2 that read as met with the more obviously untrusted door open |

## 1. The install path, and where the gate went

Every route by which kit code reaches a project's `noodl_modules/`:

| route | entry point | source | gated now? |
|---|---|---|---|
| **scaffold** | `KitsSection.tsx` → `createNodeKit` | generated here | ⚪ **no, by design — AC1** |
| **library (UMD global)** | `LibrariesSection.tsx:103` → `registerLibrary` | fetched URL / dropped file | ✅ already was (`verifyLibrarySource` before any write) |
| **module / prefab** | `ModuleCard.tsx` → `ModuleLibraryModel.installModule` / `installPrefab` | a zip from a URL | ✅ **now consented + gated** |
| **project import from a URL** | `EditorPage.tsx:297` `_importProject` | a URL-unpacked archive | ✅ **now consented + gated** |
| **project import from a local project** | `projectlibrarymodel.ts:35` | a project on this machine | ⚪ **no, by design — local code** |

🔴 **The bottom three converge on one line** — `apply()`'s module copy loop — so the gate went
**there**, not into the two installers. Two installers each remembering to call a checker leaves a
third installer unprotected by default; a gate in the loop is reached by construction.

**How the loop can tell them apart:** `ImportPlan.origin`, a **required** field of type
`ImportOrigin` (`import-engine/types.ts`):

```ts
export type ImportOrigin =
  | { kind: 'local-project' }
  | { kind: 'downloaded'; url: string; consents: KitConsent[] };
```

⚠️ **Required, and that is the enforcement.** An optional field defaulting to *trusted* makes
forgetting it safe-looking and silent; optional-defaulting-to-*untrusted* fails closed but leaves
`apply()` unable to say **why** it refused. Required means a new install route **does not compile**
until it has stated what it is. It broke 22 call sites across three spec files on the first
typecheck, which is the gate working.

🔴 **And two more that no typecheck could see.** `tests/project/projectimport.js` and
`projectimportapply.js` call `plan()` untyped; all three typechecks and `test:main` stayed green and
**only `test:ci` failed**, at runtime, with `Cannot read properties of undefined (reading 'renames')`.
✅ **A `.js` file opts out of type-level contracts exactly as silently as it opts out of syntax
checking** — after any signature change here, sweep tracked `*.js`/`*.jsx` by hand.

### 1a. Two properties of the download path, designed around rather than discovered

- **It caches.** `getModuleTemplateRoot` (`modulelibrarymodel.ts:239-283`) reuses a non-empty
  `getUserDataPath()/library/<name>` without re-downloading, so a check placed *inside* the download
  branch runs on the first install of a module and **never again**. Consent runs on the **resolved
  root path**, every install.
- **It already writes outside the project.** The installer unzips into user data before anything
  here runs. ⚠️ **So "a failing kit writes nothing" is about the PROJECT, not about the machine**,
  and this file says so rather than letting the criterion be quietly false. What CN-017 guarantees is
  that a kit that fails verification, or that the user does not accept, is **never written into
  `<project>/noodl_modules/`**.

## 2. Where provenance lives, and why not in the manifest

🔴 **Not in the kit's own `manifest.json`.** That file arrives *inside the archive*, authored by the
party being vouched for — a kit could ship `origin: 'local'` and be believed. Phase 67 closed a
defect of exactly this shape (a forgeable link, E8).

The record is the **installing project's**, at `noodl_modules/kit-provenance.json`
(`KIT_PROVENANCE_FILE`), a stable path overwritten per write — LIB-006's `writeImportReport`
reasoning, so the project's own git history is the record.

⚠️ **A plain FILE under `noodl_modules/`, and the placement is load-bearing — measured:** the one
scanner keeps only `isDirectory() || isSymbolicLink()` entries
(`nodegx-module-inject/src/index.js:126-133`) and the import engine's `listModules`
(`import-engine/analyze.ts:70-78`) keeps only entries carrying a `manifest.json`. So the file is
invisible to every existing reader, cannot become a phantom module in a list, **and is not copied by
an import** — which is correct: provenance belongs to the project that installed the kit, not to the
kit.

## 3. The union, and the two fields that cannot contradict each other

```ts
export type KitProvenance =
  | { module: string; origin: 'local'; createdAt: string }
  | { module: string; origin: 'imported'; fromProject: string; importedAt: string }
  | { module: string; origin: 'installed'; url: string; installedAt: string;
      verification: KitVerifyResult; consentedAt: string };
```

A local kit has **no verification field to misread**; an installed record **cannot be constructed
without one**. This is the third surface in this repo to reach the shape independently
(`AskAboutNodeDialog`'s `postState`, `CommunityAccountState`).

🔴 **And it is rendered from the union, not from a flattened view of it.** `describeKitOrigin()` is
the **only sanctioned renderer**, shared by the Kits section and the property-panel byline so two
surfaces cannot describe one kit two ways — the defect RUN 1 found by reading a panel instead of a
model. It has **four** outputs, not three: *"origin not recorded"* is its own state. ⚠️ Collapsing
"we have no record" into "you wrote it" is exactly how a downloaded kit ends up reading as a local
one.

⚠️ **The record is validated per ARM on read, not just "has a module and an origin".** The file is
in the project's git history, so it goes through merges and hand-edits — an `installed` record that
lost its `verification` would crash `describeKitOrigin` at render time, in a panel, on somebody
else's machine. A record that does not match its own arm is dropped **with its name said**, and
accepting a partial one would put back exactly the contradiction the union exists to prevent.

## 4. What was built

| File | What |
|---|---|
| `src/shared/utils/projectmodules.ts` | `createBrowserSandbox()` (extracted, shared with ERG-002) · `verifyKitSource` + `KitVerifyOutcome` (7 shapes incl. `not-checked`) · `moduleDeclaresExecutableCode` · `scanExecutableModules` · `KitProvenance` + `KIT_PROVENANCE_FILE` + `readKitProvenance` / `recordKitProvenance` / `pruneKitProvenance` + `isKitProvenance` · `describeKitOrigin` · `createNodeKit` now records a local origin · `listNodeKits` joins provenance by folder name |
| `import-engine/types.ts` | `ImportOrigin`, `KitConsent`, **required** `ImportPlan.origin` |
| `import-engine/plan.ts` | `PlanOptions.origin` required; `options` no longer defaults |
| **`import-engine/moduleGate.ts`** *(new)* | `executableModuleNames` · `moduleCopyDecision` · **`copyPlannedModules`** — the copy loop itself, with the copy injected |
| `import-engine/apply.ts` | calls `copyPlannedModules`, folds its warnings into the result, records provenance for what landed |
| **`views/ImportFlow/openKitConsent.tsx`** *(new)* | `requireDownloadConsent` — the modal |
| **`views/ImportFlow/kitConsentCopy.ts`** *(new)* | the dialog's words, as data |
| `modulelibrarymodel.ts` · `EditorPage.tsx` · `projectlibrarymodel.ts` · `openImportFlow.ts` · `ImportFlow.tsx` · `model/session.ts` · `model/selection.ts` | origin threaded; consent called |
| `noodl-mcp` `editor-deps.ts` · `tools/kitTools.ts` | ⚠️ **the second scaffold route records too** — `create_node_kit` writes a `local` record through the shared function, so a kit written by the MCP does not read as *"origin not recorded"* while the editor's reads as *"written here"* |
| `KitsSection.tsx` · `NodeLabel.tsx` | the origin row and the byline |

🔴 **`copyPlannedModules` owns the loop, not just the verdict, and that was a correction mid-build.**
An earlier shape exported only the decision and left `apply()` to act on it — which put the one thing
this task must guarantee (*an unconsented module is not written*) back in the half that needs a
renderer to run, where a spec could confirm the verdict while the copy happened anyway. The copy
function is now a parameter, so the refusal is graded by watching what it is **not** asked to do.

⚠️ **`sourceDir` for the scan is `source._retainedProjectDirectory`, not `plan.sourceDir`** —
`projectFromDirectory` may resolve a nested project root, and grading one folder while copying from
another would gate the wrong manifests.

## 5. Acceptance criteria, and where each is graded

52 specs across four files in `packages/noodl-editor/tests-unit/cn-017/`.

| AC | Met | Graded by |
|---|---|---|
| **1** — a locally-scaffolded kit runs with no prompt and no gate | ✅ | `verifyKitSource.test.ts` runs **real `createNodeKit` output** through the check (not a fixture written to pass it) · `moduleGate.test.ts` — a local origin copies with no consent list consulted · `provenance.test.ts` — the scaffold records an origin and `createNodeKit` still returns ok. **The scaffold route never reaches the gate at all**: it writes into the open project rather than importing |
| **2** — installing a third-party kit verifies, and a failing kit writes nothing | ✅ | `moduleGate.test.ts` — *"never asks the copy function to write an unconsented kit"* asserts the copy was **not called**; a failing kit is not offered for consent at all (no "install anyway" affordance) |
| **3** — provenance recorded and visible in the property panel and the kits list | ✅ | `provenance.test.ts` (record/merge/prune/join) · both surfaces render `describeKitOrigin` |
| **4** — consent copy states what a kit can do, in one sentence | ✅ | `consentCopy.test.ts` — asserts it *is* one sentence, names the access ("your data", "your network") and carries no risk adjective |
| **5** — verification is honest about its limits; no UI text calls a verified kit "safe" | ✅ | `consentCopy.test.ts`, **two instruments**: the copy read as data, **and** `openKitConsent.tsx` read off disk as source and swept (a `.tsx` is invisible to this runner, so a claim added straight into markup would pass the first) |

🔴 **The source sweep carries a negative control and was mutation-checked.** A source-analysis spec
whose path stops resolving reads as a clean pass — this repo has a recorded case of exactly that
sitting green for a day. So the file is asserted non-empty and asserted to contain markers that are
genuinely in it *before* anything is asserted absent; and inserting `This kit is safe.` into the
rendered statement was confirmed to turn the spec **red** (`Tests: 1 failed, 10 passed`) and then
reverted.

⚠️ **AC5's absence checks all sit beside a known-firing signal** — every string is asserted
non-empty before being asserted free of `safe` / `trusted` / `secure`. An absence check over an empty
string passes for the wrong reason.

## 6. What verification does and does not buy — stated once, plainly

`verifyKitSource` runs a kit's `index.js` in a `vm` context shaped like a browser tab, with a
`defineModule`-collecting `Noodl` shim, and reports **what the script defines**. Six outcomes:
`defines-nodes`, `no-define-module`, `defines-no-nodes`, `es-module`, `commonjs`, `threw` — plus
`not-checked` for a module whose code arrives from a URL at runtime and has no local file to read.
⚠️ **`not-checked` is a value, not an absent field**: "we did not look" and "there was nothing to
look at" would otherwise be indistinguishable from a missing assignment, and a renderer would show
the same blank for all three.

⚠️ **`React` is a recursive noop in that sandbox.** ✅ D19 put React in the runtime's gift as a bare
global and the scaffold's template opens with `var h = React.createElement`, so without a stub
**every scaffolded kit would fail with a `ReferenceError` that says nothing about the kit**. The cost
is stated rather than hidden: this grades **declaration shape, not behaviour**. There is a spec for
it, so a future sandbox change that drops the stub is caught by a test that says why it matters.

🔴 **A `vm` context is not a security boundary** — Node's own documentation says so, the timeout is
escapable, and a kit is arbitrary JavaScript with the app's full page access **by design**, which is
what makes a custom node as capable as a built-in (P1). Nothing in this feature's UI says otherwise,
and AC5's two instruments exist to keep it that way.

## 6a. The export path, found by following it rather than assuming

🔴 **`apply()` runs for EXPORTS too.** `exportProjectComponents` → `openExportFlow` → `stageAndZip`
stages into a throwaway project and calls the same `apply()`, then **zips that directory**. So a
provenance record written during an export would travel *inside a stranger's download*, claiming
these kits came from a project on **their** computer.

`ImportOrigin` therefore has a third arm, `export-staging`: copies freely (it is your own project),
records nothing. Lumping it in with `local-project` would have shipped that record, and no
acceptance criterion would have caught it.

## 6b. Gates, measured on this tree

| Gate | Result |
|---|---|
| `test:ci` @ `NOODL_SPEC_SEED=39393` | ✅ **2849 / 10 failed — AT FLOOR, the same ten by name** as the s29 floor: 4 × `AIX-006 style vocabulary`, 2 × `AI model registry`, 1 × `AIX-011`, 3 × `SUB-011 expression parameters` |
| editor `test:main` | ✅ **3875 / 254 suites, zero failures** |
| `typecheck:editor` · `typecheck:editor-tests` · `typecheck:mcp` | ✅ 0 |
| `test:packages` | ✅ green |
| `@noodl/mcp` alone | ✅ **644 / 54, zero failures** |
| `tests-unit/cn-017` | ✅ **52 / 4 suites** |
| eslint, changed files | ✅ clean (the two errors in `EditorPage.tsx` are **pre-existing at `HEAD`** — verified against the unmodified file) |

⚠️ **`test:ci`'s total stays 2849 because CN-017's specs are `tests-unit/` (jest), not `tests/`.**

🔴 **Three `test:ci` runs, and the first two were discarded on principle.** Run 1 was stopped because
source was edited while it ran; run 2 came back at floor but its webpack bundle predated two later
edits. A suite's bundle is built at the start, so an edit made during a run is simply absent from it
— quoting such a number would be quoting a tree that no longer exists.

## 7. Out of scope, and one thing to hand to Richard

Signing, a trusted-author registry and runtime sandboxing of kit code stayed out, as the spec says.

⚠️ **Archive extraction was flagged here as an adjacent hazard and has since been measured and
fixed — see §8, which corrects the flag's own wording.** Richard ruled "fix it now" on 2026-08-18.

## 8. 🔴 CORRECTION — the archive-extraction flag this task raised was OVERSTATED

CN-017's close flagged *"`unzipIntoDirectory` extracts a downloaded archive with no path checks — a
crafted archive with `../` entries writes outside its target."* **Measured 2026-08-18, that is wrong**,
and the commit message `ce96338c` carries the overstated version.

| entry name | JSZip's **loader** | `path.join(root, name)` | escapes? |
|---|---|---|---|
| `../escaped.js` | **normalised to `escaped.js`** | — | **no** |
| `a/b/../../../x.js` | **normalised to `x.js`** | — | **no** |
| `/etc/passwd` | preserved | `root/etc/passwd` — `join` eats the leading `/` | **no** |
| `..\win.js` | **preserved** | posix: a file literally named `..\win.js`; **win32: `C:\tmp\win.js`** | 🔴 **yes, on Windows** |

🔴 **The classic traversal was never reachable through this code path**, because JSZip sanitises it
before the writing code ever sees it — and JSZip's *writer* normalises it too, which is why the first
fixture written against it produced a perfectly safe archive and graded nothing.

**What is real:** a **backslash entry on Windows**, which this app ships to. `..\win.js` survives
JSZip and `path.join('C:\tmp\target', '..\win.js')` is `C:\tmp\win.js`.

✅ **The guard was still worth building, for two accurate reasons rather than one inflated one:** it
closes the Windows case, and it is what stops a future JSZip release changing its normalisation from
silently reopening the rest. It is *defence in depth over a dependency's current behaviour*, not the
patch for a live traversal — and describing it as the latter would be the kind of over-claim AC5
exists to prevent, applied to our own work instead of to a kit's.

**Built:** `resolveZipEntryPath` (containment on the **resolved** path, `+ path.sep` so a sibling
whose name merely starts with the target's is refused too) and `extractZipToFolder`, lifted out of
`unzipUrl`'s closure so a plain-Node spec can reach it — `unzipUrl` reaches for `XMLHttpRequest`, and
a guard that could only run inside a renderer is a guard nobody checks. **The whole archive is
refused on one bad entry, before anything is written**, so no caller inherits a half-extracted
directory it would treat as a successful download. The failure now names the entry instead of saying
"Failed to extract".

⚠️ **9 specs in `packages/noodl-platform-node/tests/filesystem-unzip.test.ts`** (`test:platform`, a CI
gate). They inject the hostile name into the loaded archive rather than trying to build one, because
JSZip's writer normalises it; the contract graded is *given a name that escapes, however it arrived,
write nothing*. One spec pins JSZip's own normalisation, so an upgrade that changes it fails here and
points at the guard as the thing now doing the work.

