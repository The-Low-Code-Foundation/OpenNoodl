# Phase 69 — the closing campaign. **16 of 20 done. Here is the exact path to 20, and the one thing that cannot be done from inside this phase.**

**Written 2026-08-18, end of s28.** 🔴 **This file is a REWRITE, not an amendment.** Overwrite it
when the campaign ends; anything that outlives the phase goes to memory, not here.

> ## Read §1 and §2 before touching anything.
>
> **§1** is the map — what is actually left, measured from the ledger, not from a handover.
> **§2 is a RULING Richard must make before RUN 3 is worth starting**, because CN-016 has an
> acceptance criterion that **cannot be met by any amount of work inside phase 69**.
>
> **This is a 3-run campaign, not one session.** Ordering matters: RUN 1 closes two tasks and takes
> one session. RUN 2 and RUN 3 are the two Tier-6 tasks that have **never been started** and are
> marked effort **L** each. A session that tries to do all three will finish none.

---

## 0. STEP ZERO — the tree, every run

```bash
git status --short packages/noodl-editor/src   # empty ⇒ safe to launch
```

A peer has `scripts/library/check.ts`, `phase-50`/`phase-68` notes and the untracked
`phase-65-the-library/` and `phase-70-the-course-is-an-app/` dirs in flight — **not yours, do not
sweep them.** Commit with explicit pathspecs, never `git add -A`; a sibling's commit sweeps staged
files. 🔴 **Never `git stash` on this checkout** — `pop` crashes a live editor.

## 1. Where phase 69 actually is

**Closed: 16 of 20.** CN-001–006b, CN-009, CN-010, **CN-011** (s28), CN-012, **CN-015** (s28),
CN-018, CN-019.

| What is left | Owner | Reality |
|---|---|---|
| **CN-013** AC1 — SSR | RUN 1 | ✅ **D19 ruled.** Code is small. |
| **CN-014** AC3 — the dev loop | RUN 1 | ✅ Code **already written in s28**. Needs a rebuild + a drive. |
| **D20** — a bad kit loses the kit, not the app | RUN 1 | ✅ Ruled. Small. |
| **CN-017** — Trust | RUN 2 | 🔴 **Never started.** Tier 6, effort **L**. Self-contained. |
| **CN-016** — Publish a kit | RUN 3 | 🔴 **Never started.** Tier 6, effort **L**. ⚠️ **AC1 blocked — §2.** |
| **CN-007** AC2 | not yours | Needs a reader who has **not** read this phase. |
| **CN-008** AC1 | not yours | Needs a live model. |

✅ **After RUN 1 the phase is 18/20 and everything remaining is distribution-and-trust.** That is a
clean place to stop if appetite runs out — say so rather than leaving it ambiguous.

## 2. 🔴 THE RULING THAT MUST COME FIRST — CN-016 AC1 cannot be met inside this phase

**CN-016 AC1:** *"The reference kit installs from the **real origin** into a fresh project"* —
explicitly *"not from a local folder that happens to resolve."*

**Measured s28:** the real origin serves **2024 Noodl content**. Nothing publishes `library/`.
`library:build` writes gitignored `library-dist/`, and "copy it into the docs repo" is a documented
**manual** step nobody has ever performed. The task that owns fixing this is **phase 65's LBR-001**,
which is **`Not started`** — and phase 65's own README says *"Nothing else in this phase matters
until the publish path works."*

🔴 **So phase 69 contains a criterion that phase 69 cannot satisfy.** This is the reason the phase
feels unclosable: every other route is open and this one is owned elsewhere. It needs a decision,
not another session of discovering it.

| | Option |
|---|---|
| **(a)** | **Do LBR-001 inside this campaign** as RUN 3a. Closes CN-016 AC1 honestly. ⚠️ Adds a phase-65 task to a phase-69 push, and phase 65 is being scoped by a peer **right now** — coordinate or collide. |
| **(b)** | **Descope CN-016 AC1** to *"installs from a built artefact, with a gate that fails the moment the origin and `library/` diverge"*. Phase 69 closes; the origin gap stays phase 65's, with a gate that stops it rotting further. |
| **(c)** | **Hold CN-016 open** until phase 65 lands LBR-001, and close phase 69 at 19/20 with CN-016 explicitly deferred and named. |

**Recommendation: (b).** It is the only option that closes this phase on its own terms without
either annexing another phase's work or leaving a task dangling on someone else's schedule — and the
divergence gate is genuinely the durable half. 🔴 **Whichever is chosen, do not let a session
"satisfy" AC1 by installing from a local folder.** That is the exact move the criterion forbids, it
would read as green, and it would be false.

---

## 3. RUN 1 — the closer. One session. Closes CN-013 and CN-014.

### 3a. 🔴 FIRST: rebuild the viewer, or everything below reads the old behaviour

**The editor runs a BUILT viewer.** `packages/noodl-editor/src/external/viewer/noodl.viewer.js` is a
committed artefact, it is what `external/viewer/index.html:109` loads, and after s28 it **still
carries the old messages** — measured, not assumed.

```bash
npm run ci:build:viewer
# then PROVE it took, without launching anything:
grep -c 'preview renders nothing' packages/noodl-editor/src/external/viewer/noodl.viewer.js   # want ≥1
```

⚠️ **`0` means do not launch.** A drive on the stale bundle reads the old anonymous text, and the
obvious conclusion — *"s28's change did not work"* — is wrong and costs an afternoon.
⚠️ **Never run this build beside a live suite** — a build next to a suite causes `freshDb` timeouts.

### 3b. Drive CN-014 AC3 (~30 min)

Fixture needs no preparation: **`NodeGX test projects/cn027-drive`** — four kits, one with a
deliberate syntax error, probes on `/Pages/Home`, a live connection. It is a copy; never open an
original.

**Write these observations BEFORE launching**, then read them:

1. Console names **the kit AND the file** — `Kit "…" failed to load: … (in …/index.js)`.
2. Settings → Kits **still** names it (s23's surface must not regress).
3. The other three kits still load; viewer stays mounted.
4. Fix the syntax error → the kit **recovers**.
5. Same stack, s27's other failure: a kit logic node with no `category` → the exception now names
   the node and the kit instead of reading as a dead renderer.

### 3c. Build D19 — the SSR `React` shim. Closes CN-013 AC1.

In `packages/noodl-viewer-react/static/ssr/kit-modules.js`, put `React` on a `window` shim before
`new Function(source)()`.

🔴 **`React` and NOTHING ELSE — not `document`, not a DOM.** `kit-modules.js` argues this against
itself in its own comment and is right: faking a DOM lets a kit register nodes that cannot render
server-side anyway, **trading a named failure for a silent one**. A kit needing more is a *new*
ruling.

⚠️ **Then (b), which is not optional follow-up:** move the documented pattern to a guarded accessor
and update **the worked example and the scaffold** — otherwise new kits keep being written against a
global that may not exist and the shim becomes load-bearing forever.

🔴 **BUILD THE CALLER.** A unit test on the loader is what let this ship broken the first time
(`ssr-kit-modules.test.js` existed and nothing had ever built a deploy). Do a **real deploy**:
`deployToFolder` with `{ environment: undefined, runtimeType: 'ssr' }`, then
`npm install && npm run build`, run the server, and grep the served HTML for a kit node's marker.
✅ There is a working recipe in [notes/cn-013-ssr.md](notes/cn-013-ssr.md) and s27's observations.

### 3d. Build D20 — a bad kit loses the kit, not the app

`registerModule` currently aborts and takes the viewer down. Make a throw cost **the whole kit** and
report it.

🔴 **The condition that does NOT relax: the failure must reach Settings → Kits**, by the channel the
load-time failures already use (`__noodl_module_failures` → `setModuleFailures` → payload →
`NodeLibraryImporter` → `KitsSection`). Skipping a kit **silently** is *strictly worse than today* —
it replaces a blank screen nobody can miss with a missing node the author blames on a typo.

⚠️ **`packages/noodl-runtime/test/registration-failures-name-the-kit.test.ts` asserts the CURRENT
blast radius on purpose** (*"still aborts the module"*). **Rewrite it to the new contract; do not
delete it** — that test exists so this behaviour cannot move by accident.

---

## 4. RUN 2 — CN-017 Trust. Self-contained, no external blocker. Start here after RUN 1.

**Why this before CN-016:** CN-016 lists CN-017 as a gate for anything not first-party, and CN-017
depends on nothing outside this repo. `verifyLibrarySource` (ERG-002) and `registerLibrary`'s
`kind: 'external-library'` marker already exist — this is **wiring an existing mechanism to kits**,
not inventing one.

Five ACs, and the two that are easiest to get wrong:

- 🔴 **AC1 — a locally-scaffolded kit runs with NO prompt and NO gate.** This is D6's promise and the
  easiest thing to accidentally break while building a consent flow. Test it on a real scaffold
  output, not in principle.
- 🔴 **AC5 — verification must be honest about its limits.** `verifyLibrarySource` establishes *what
  a script defines*, **not that it is safe**. No UI text may claim a verified kit is "safe".

⚠️ **The trap this task names against itself, and it is a real one here:** *"put the guarantee on the
decision, not the observation."* A record with `verified: true` beside one with `source: local`
invites the reader to conclude local kits were verified. **Make the fields incapable of
contradicting each other.** This repo already has a recorded case of exactly two fields made to
contradict.

⚠️ **Establish what the sandbox responder's `noodl_modules/` pattern (`responder.ts:36`) is for.**
Vestigial or load-bearing — say which. Do not assume.

⚠️ **Out of scope and must stay out:** signing, a trusted-author registry, runtime sandboxing of kit
code. All defensible futures; none are D6; pretending otherwise delays the phase indefinitely.

## 5. RUN 3 — CN-016 Publish a kit. **Do not start before §2 is ruled.**

Everything except AC1 is unblocked: the minimal reference kit (✅ D5 — new and deliberately minimal,
**not** the cashflow kit), kit-aware `library.json`, compat gating that fires, versioning that does
not silently replace.

🔴 **Do not build on an assumption that "modules work".** P65's audit is why this is Tier 6:
**0 of 29 shipped modules have ever been run**, 3 register zero nodes, ~9 vendor third-party
libraries with no licence text, and **mapbox-gl v2+ is proprietary**. Exactly **one** kit has been
proven end to end — the cashflow kit — and it is not one of the 29.

⚠️ **`scripts/library/check.ts` is a peer's live file right now.** AC4 says `library:check` passes and
the schema is strict, so a new field must be added deliberately — **coordinate before editing it.**

⚠️ **The cashflow kit is NOT shipped content** (D5) — no licence sweep, no `library.json` — **but it
must keep working**, because CN-007's docs depend on it.

## 6. Not yours to close — hand these to Richard

- **CN-007 AC2** — needs someone who has **not** read this phase to follow the docs page and record
  where they stall. A fresh agent can run this in parallel with any run above. Otherwise close CN-007
  on its other four criteria and say so.
- **CN-008 AC1** — needs a live model. ⚠️ **The seam CN-008 §7 names is not a usable check:**
  `AiConfigStore.getApiKey(provider)` **ignores its argument**, so a bogus provider returns the same
  16-character value as `anthropic`. Do not read *"a key is set"* from it.
- ⚠️ **Rulings #11 and #12 are still unanswered** — no `--success`/`--warning`/`--info` semantic
  tokens; and `kitDiagnostics` printing outside `validate:project`'s summary, so an `ERROR` sits
  above `0 error(s)` and the exit code stays `0` (the `--json` path omits kit diagnostics entirely).

## 7. Gates — what s28 measured, and how to read them

| Gate | s28 result |
|---|---|
| `@nodegx/module-inject` | **27** passed (21 → 27) |
| `@noodl/runtime` | **2532** passed, 139 suites, **EXIT 0** (+12) |
| `@nodegx/kit-catalog` | **78** passed |
| `test:ci` @ seed 39393 | **2849 / 10 failed** — ✅ **A/B'd against committed code: IDENTICAL set, delta 0** |
| mutants | **8/8 killed** (4 per side, each restored and re-run green) |

🔴 **The recorded floor of `2843 / 6` is STALE — do not quote it.** s28 measured **2849 / 10** and
then **ran the same suite again on committed code with s28's four files reverted**: the failure set
was **identical, by name** (4 × `AIX-006 style vocabulary`, 2 × `AI model registry`, 1 × `AIX-011`,
3 × `SUB-011 expression parameters`). **Delta introduced by s28: zero.** Those ten are somebody's
open work, not this phase's — and the golden **ran and passed** in both runs, which is what actually
cleared the injector change.

✅ **That A/B is the routine to copy** when a suite comes back above floor: revert your own files to
`HEAD` (**never `git stash` here**), re-run at the same seed, compare failure sets **by name**. A
count alone would not have settled it.

- ✅ **PIN THE SEED: `NOODL_SPEC_SEED=39393`.**
- 🔴 **DELETE `packages/noodl-editor/tests/test-results.json` before every run and require a fresh
  mtime.** A stale file reads as a perfect pass.
- 🔴 **`test:ci`'s exit code misleads both ways, and any pipe reports the pipe's last command.**
  Prove completion from the mtime, never from `$?`. **Never pipe a suite to `tail`** — it loses the
  failure list *and* the exit code.
- ⚠️ **`npx tsc --noEmit -p tsconfig.json` in `noodl-runtime` exits 2 on two PRE-EXISTING errors**
  (`Cannot redeclare block-scoped variable 'EditorConnection'`, in
  `editorconnection.replyidentity.test.ts` and `editorconnection.sendqueue.test.ts`). Neither was
  touched by s28. Not a regression; do not "fix" it inside another task without checking whose it is.

## 8. Traps that will bite these runs specifically

- 🔴 **The built viewer bundle is not the repaired source** — §3a. Bites *every* runtime change.
- 🔴 **`expected-inject.snapshot.txt` is the ONLY cross-package check** that the editor's injector
  agrees with `@nodegx/module-inject`. s28 re-recorded it deliberately (diff verified against
  `git show HEAD:` first). **Never regenerate it to make a red run green — the diff is the finding.**
- 🔴 **`cdp reload --target=viewer` reloads the EDITOR** (confirmed 08-15 and s27). Use
  `eval "location.reload()" --target=viewer`.
- 🔴 **Do not edit anything the editor bundles between launch and `reactMounted:true`** — it wedges
  the renderer permanently (bundle curl returns **000** *after* a successful compile; 000 *before*
  the first compile is normal). Only a relaunch clears it.
- 🔴 **`NodeLibrary.types` reads empty when the VIEWER is dead** — a zero is the instrument, not a
  finding, and the `category` throw is one of the things that kills it.
- 🔴 **A criterion about a message must name its SURFACE.** s23 and s27 recorded opposite verdicts on
  the same failure and **both were right** — the kit was named in Settings → Kits and not on the
  console. When a task file and a measurement disagree, **ask which surface each read** before
  reaching for staleness or over-claim.
- ⚠️ **Opening a project writes three files into it, and dirties every component.** Always drive a
  copy.
- ⚠️ **`DeployOptions.environment` is required** (may be `undefined`, must be present).
- ⚠️ To open a specific project: `LocalProjectsModel.instance.openProjectFromFolder(dir)`, then
  `App.instance.exitProject()`, then click `[data-test=launcher-project-card]`.
