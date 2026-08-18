# Phase 69 — **18 of 20 done.** Two Tier-6 tasks left, and one of them still needs a ruling from Richard.

**Written 2026-08-18, end of s29.** 🔴 **This file is a REWRITE, not an amendment.** Overwrite it
when the campaign ends; anything that outlives the phase goes to memory, not here.

> ## Read §1 and §2 before touching anything.
>
> **§1** is the map, measured from the ledger rather than inherited.
> **§2 is still the ruling Richard must make**, and s29 did not touch it — CN-016 AC1 cannot be met
> by any amount of work inside phase 69. Nothing in RUN 1 changed that.
>
> **RUN 1 is done.** What is left is RUN 2 (CN-017) and RUN 3 (CN-016), each effort **L**, each
> its own session. A session that tries both will finish neither.

---

## 0. STEP ZERO — every run, and it is not a formality

```bash
git status --short packages/noodl-editor/src   # empty ⇒ safe to launch
ListAgents                                     # then ASK before launching
```

🔴 **s29 checked this at 17:44, got "empty", and by 18:00 a peer had three uncommitted files in
`packages/noodl-editor/src` and an editor stack mid-compile.** A launching stack is invisible for
~75s — no Electron, port 9222 still free — so a clean `ps` is not a clean checkout. **Two editors do
not coexist on this checkout even on different CDP ports**, and an edit to a bundled file between
your launch and `reactMounted` wedges the renderer permanently. Announce, ask who owns what, and
announce teardown to everyone you announced the launch to.

A peer has `scripts/library/check.ts`, `phase-50`/`phase-68` notes and the untracked
`phase-65-the-library/` and `phase-70-the-course-is-an-app/` dirs in flight; another has
`noodl-core-ui/src/preview/launcher/**`, `ProjectsPage.tsx`, `AskAboutNodeDialog.tsx`,
`useCommunityAccount.ts` and `tests-unit/uni-001/**` — **not yours, do not sweep them.** Commit with
explicit pathspecs, never `git add -A`. 🔴 **Never `git stash` on this checkout.**

## 1. Where phase 69 actually is

**Closed: 18 of 20.** CN-001–006b, CN-009, CN-010, CN-011, CN-012, **CN-013** (s29), **CN-014**
(s29), CN-015, CN-018, CN-019.

| What is left | Owner | Reality |
|---|---|---|
| **CN-017** — Trust | **RUN 2, do this first** | 🔴 **Never started.** Tier 6, effort **L**. Self-contained: no external blocker. |
| **CN-016** — Publish a kit | RUN 3 | 🔴 **Never started.** Tier 6, effort **L**. ⚠️ **AC1 blocked — §2.** |
| **CN-007** AC2 | not yours | Needs a reader who has **not** read this phase. |
| **CN-008** AC1 | not yours | Needs a live model. |

✅ **Everything remaining is distribution-and-trust.** This is a clean place to stop if appetite runs
out — say so plainly rather than leaving it ambiguous.

## 2. 🔴 STILL UNRULED — CN-016 AC1 cannot be met inside this phase

**CN-016 AC1:** *"The reference kit installs from the **real origin** into a fresh project"* —
explicitly *"not from a local folder that happens to resolve."*

**Measured s28, unchanged since:** the real origin serves **2024 Noodl content**. Nothing publishes
`library/`. `library:build` writes gitignored `library-dist/`, and "copy it into the docs repo" is a
documented **manual** step nobody has ever performed. The task that owns fixing this is phase 65's
**LBR-001**, which is **`Not started`** — and phase 65's own README says *"nothing else in this phase
matters until the publish path works."*

| | Option |
|---|---|
| **(a)** | **Do LBR-001 inside this campaign** as RUN 3a. Closes AC1 honestly. ⚠️ Annexes another phase's work, and phase 65 is being scoped by a peer — coordinate or collide. |
| **(b)** | **Descope AC1** to *"installs from a built artefact, with a gate that fails the moment the origin and `library/` diverge"*. Phase 69 closes; the origin gap stays phase 65's, with a gate that stops it rotting further. |
| **(c)** | **Hold CN-016 open** until phase 65 lands LBR-001; close phase 69 at 19/20 with CN-016 explicitly deferred and named. |

**Recommendation is still (b).** It is the only option that closes this phase on its own terms
without annexing another phase or leaving a task on someone else's schedule, and the divergence gate
is the durable half. 🔴 **Whichever is chosen, do not let a session "satisfy" AC1 by installing from
a local folder.** That is the exact move the criterion forbids, it would read as green, and it would
be false.

---

## 3. What RUN 1 (s29) built, and the two things in it that will bite the next runs

✅ **D19** — the SSR loader shims `window` with **`React` and nothing else** for the duration of a kit
load, and **removes it before the render**. ✅ **D20** — `registerModule` is **atomic** and the blast
radius moved to the call sites. ✅ **CN-013 AC1** closed on a real deploy; ✅ **CN-014 AC3** closed on a
re-driven stack. Plus one defect found by reading a panel instead of a model — see §4.

🔴 **`registerModule` still THROWS, on purpose, and a future session will want to "finish" D20 by
silencing it. Do not.** Two callers read that throw to report a broken kit at all —
`noodl-viewer-cloud/src/kitModules.ts:286` and `noodl-mcp/src/kitExtract/entry.js:145` each wrap it in
a `try` and push a failure from the `catch`. Swallowing it leaves both `catch` blocks dead **while
both surfaces call a broken kit healthy.** Grepping the callers before writing is what caught that.

🔴 **The rollback RESTORES what it displaced; it does not delete.** A kit is allowed to shadow a
built-in (D9, and `nodegx-kit-catalog/src/health.js` states it to authors as fact). A delete-based
rollback would take the shadowed built-in with it, so one bad node in one kit would silently cost the
project its `Group`. Unwind is **newest-first**.

## 4. 🔴 The defect RUN 1 found, fixed, and could not re-drive

Settings → Kits told the author a kit that had registered **nothing** was *"only PARTIALLY
registered — nodes defined before the failure are available"*, and after D20 the same row
**contradicted itself in one sentence**: *"NONE of this kit's nodes register … It is only PARTIALLY
registered."*

**Cause:** `NodeLibraryImporter.updateIndex` filtered `nodetypes` against `clients.getNodeNames()`
and nothing filtered `nodeIndex.moduleNodes`; `mergeInByName` only ever replaces-by-name or pushes.
So the picker's per-kit group survived forever, and `KitsSection` feeds those names to
`kitDiagnostics` as *"what this kit registered"*. ✅ Fixed, pruned against the **same** name set, with
the `partial` branch **kept** — a script that throws after some `defineModule` calls really is
half-registered. 7 tests, **5/5 mutants killed**.

⚠️ **Not re-driven.** That fix and a one-line console dedup are proven by unit tests and mutants, not
by a second stack. The live readings in [notes/s29-drive-observations.md](notes/s29-drive-observations.md)
are from the **18:00:17** bundle (`e56e8d38…`); the shipped bundle is now **18:33:21**
(`52d7fa4c…`). **If the next run launches an editor anyway, re-read the two Kits-panel rows** — it
costs one minute and closes the last unobserved gap in RUN 1.

## 5. RUN 2 — CN-017 Trust. Self-contained. Start here.

**Why before CN-016:** CN-016 lists CN-017 as a gate for anything not first-party, and CN-017 depends
on nothing outside this repo.

🔴 **CORRECTION to this section, measured after it was written.** It said *"this is wiring an existing
mechanism to kits, not inventing one."* That is **half right and the wrong half is load-bearing** —
[NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) §2 has the readings:

- The **verify-before-write discipline** is real and live, but on the **library** path
  (`LibrariesSection.tsx:103` → `registerLibrary` → `verifyLibrarySource`).
- **A third-party kit does not arrive there.** It arrives through the **Node Picker** —
  `ModuleCard.tsx:59-60` → `ModuleLibraryModel.installModule` → download, unzip, import — with **no
  verification, no consent and no provenance**, and a **user-data cache that is never re-verified
  after the first install**.
- 🔴 **`verifyLibrarySource` has the wrong contract for a kit.** It hard-requires a `globalName`; a kit
  declares no global, it calls `Noodl.defineModule`. Two kit-shaped evaluators already exist
  (`noodl-mcp/src/kitExtract/entry.js`, `static/ssr/kit-modules.js`) — reuse one, do not write a third.

**Read the prompt's §2 before designing anything.** ERG-002 is the right *model*; it is not a socket
this plugs into.

Five ACs, and the two easiest to get wrong:

- 🔴 **AC1 — a locally-scaffolded kit runs with NO prompt and NO gate.** D6's promise, and the easiest
  thing to break while building a consent flow. Test it on a real scaffold output, not in principle.
- 🔴 **AC5 — verification must be honest about its limits.** `verifyLibrarySource` establishes *what a
  script defines*, **not that it is safe**. No UI text may call a verified kit "safe".

⚠️ **The trap this task names against itself, and s29 hit its twin:** *"put the guarantee on the
decision, not the observation."* A record with `verified: true` beside one with `source: local`
invites the reader to conclude local kits were verified. **Make the fields incapable of contradicting
each other** — §4 above is this phase's second recorded case of exactly two fields made to
contradict, and the first one shipped to a panel.

✅ **Item 4 is already answered — do not spend a session on it.** `responder.ts`'s `noodl_modules/`
entry sits in a `PASSTHROUGH` array whose own comment reads *"Paths the sandbox must not touch: the
viewer's own origin-relative assets"*, beside `static/` and `favicon`. It is **HTTP routing in a mock
Parse backend**, not a trust carve-out, and nothing should be built on top of it. Write the sentence
into CN-017 and close the item.

⚠️ **Out of scope and must stay out:** signing, a trusted-author registry, runtime sandboxing of kit
code. All defensible futures; none are D6.

## 6. RUN 3 — CN-016 Publish a kit. **Do not start before §2 is ruled.**

Everything except AC1 is unblocked: the minimal reference kit (✅ D5 — new and deliberately minimal,
**not** the cashflow kit), kit-aware `library.json`, compat gating that fires, versioning that does
not silently replace.

🔴 **Do not build on an assumption that "modules work".** P65's audit is why this is Tier 6: **0 of 29
shipped modules have ever been run**, 3 register zero nodes, ~9 vendor third-party libraries with no
licence text, and **mapbox-gl v2+ is proprietary**. Exactly **one** kit has been proven end to end —
the cashflow kit — and it is not one of the 29.

⚠️ **`scripts/library/check.ts` is a peer's live file.** AC4 says `library:check` passes and the
schema is strict, so a new field must be added deliberately — **coordinate before editing it.**

⚠️ **The cashflow kit is NOT shipped content** (D5) — no licence sweep, no `library.json` — **but it
must keep working**, because CN-007's docs depend on it.

## 7. Not yours to close — hand these to Richard

- **CN-007 AC2** — needs someone who has **not** read this phase to follow the docs page and record
  where they stall. A fresh agent can run this in parallel with any run above. Otherwise close CN-007
  on its other four criteria and say so.
- **CN-008 AC1** — needs a live model. ⚠️ **The seam CN-008 §7 names is not a usable check:**
  `AiConfigStore.getApiKey(provider)` **ignores its argument**, so a bogus provider returns the same
  16-character value as `anthropic`.
- ⚠️ **Rulings #11 and #12 are still unanswered.** #11: no `--success`/`--warning`/`--info` semantic
  tokens. #12: `kitDiagnostics` prints outside `validate:project`'s summary, so an `ERROR` sits above
  `0 error(s)` and the exit code stays `0` (`--json` omits kit diagnostics entirely). ⚠️ **D12 made
  #12 worse** by adding a fifth code to that surface, and fixing it changes what the gate's exit code
  means — **it wants a ruling, not a unilateral wiring-up.**

## 8. Gates — what s29 measured

| Gate | s29 result |
|---|---|
| `@noodl/runtime` | **2537** passed, 139 suites (s28: 2532) |
| `noodl-viewer-react` | **931** passed, 73 suites (s25: 921 / 72) |
| `noodl-viewer-cloud` | **189** passed, 9 suites |
| `@nodegx/kit-catalog` | **78** passed |
| `@nodegx/module-inject` | **27** passed |
| `noodl-mcp` | **644** passed, 54 suites |
| `@nodegx/kit-scaffold` | **68** passed, 5 suites |
| `typecheck:editor` | **0** |
| **editor `test:main`** | ✅ **3816 / 249 suites, ZERO failures** — a peer measured 3808 with one failure before this session; see below |
| **`test:ci` @ seed 39393** | **2849 specs / 10 failures**, mtime `18:49:58` |
| Mutants | **15/15 killed** — 4 D19, 6 D20, 5 the picker prune; each restored and re-run green |

✅ **The ten `test:ci` failures are the recorded floor, matched BY NAME, not by count:** 4 ×
`AIX-006 style vocabulary`, 2 × `AI model registry`, 1 × `AIX-011`, 3 × `SUB-011 expression
parameters`. s28 A/B'd that exact set against committed code and found delta 0; s29 re-measured
rather than quoting it. None of the ten is in a package s29 touched. **Delta introduced by s29:
zero.**

✅ **`test:main` was red when s29 started and it was phase 69's own fault.**
`tests-unit/cn-002/unknown-type-check-skipped.test.ts` asserted `unknown.warnings === known.warnings + 1`;
`c1c0b5b5` added `validation/rules/parameterValue.ts`, which fires on the control's resolvable `Text`
node and **cannot** fire on an unresolvable one — the very skip that file grades. So the identity was
false by construction (known = 2, unknown = 1). **Re-baselined, not deleted** — and replaced with a
*stronger* assertion: the old `.every(...)` beside it passed vacuously on an empty list and said
nothing about cardinality; the list comparison does.

- ✅ **PIN THE SEED: `NOODL_SPEC_SEED=39393`.**
- 🔴 **DELETE `packages/noodl-editor/tests/test-results.json` before every run and require a fresh
  mtime.** A stale file reads as a perfect pass. **Prove completion from the mtime, never from `$?`**
  — a clean floor run exits 1, and any pipe reports the pipe's last command.
- 🔴 **Never pipe a suite to `tail`** — it loses the failure list *and* the exit code.
- ⚠️ **`npx tsc --noEmit -p tsconfig.json` in `noodl-runtime` still reports two PRE-EXISTING errors**
  (`Cannot redeclare block-scoped variable 'EditorConnection'`, in `editorconnection.replyidentity.test.ts`
  and `editorconnection.sendqueue.test.ts`). Not a regression; do not "fix" it inside another task.

## 9. Traps that will bite these runs specifically

- 🔴 **`packages/noodl-editor/src/external` is GITIGNORED** (`.gitignore:197`, `git ls-files` → 0
  tracked). A viewer rebuild leaves **no diff**, so nothing in the tree records which bundle a reading
  came from — **and a deploy COPIES that directory rather than rebuilding it**, so what a user ships
  is whatever a local build last wrote. Stamp mtime + md5 in any drive note.
- 🔴 **The built viewer is not the repaired source.** `npm run ci:build:viewer`, then grep the bundle
  for a string only the new code contains, **before** launching. ⚠️ `preview renders nothing` is no
  longer a valid marker — D20 changed that sentence. Use `NONE of this kit` or `registration-failed`.
- 🔴 **The launcher can list two cards with the same display name**, and s29's copy sorted *last*
  while the **original** sat at index 0. `openProjectFromFolder` does not move the UI and does not
  refresh a cached card label. **Verify which project opened from `ProjectModel.instance`, not from
  the card you clicked.**
- 🔴 **No editor global is exposed.** Reach models through webpack:
  `window.webpackChunknoodl_editor.push([[k], {}, r => req = r])`, then
  `req('./src/editor/src/utils/LocalProjectsModel.ts')`. Module ids are the source paths.
  ⚠️ It is `models/nodelibrary/nodelibrary.ts` — **lower case**, and `NodeLibrary.ts` does not exist.
- 🔴 **`cdp reload --target=viewer` reloads the EDITOR.** Use `eval "location.reload()" --target=viewer`.
- 🔴 **`NodeLibrary.types` reads empty when the VIEWER is dead** — a zero is the instrument, not a
  finding. D20 makes that much rarer, which makes it easier to forget.
- 🔴 **`expected-inject.snapshot.txt` is the ONLY cross-package check** that the editor's injector
  agrees with `@nodegx/module-inject`. **Never regenerate it to make a red run green — the diff is
  the finding.**
- ⚠️ **A criterion about a message must name its SURFACE.** s23 and s27 recorded opposite verdicts on
  one failure and both were right. s29 read every message on **both** the console and the panel for
  exactly that reason — and the panel is where the §4 defect was hiding.
- ⚠️ **Opening a project writes three files into it and dirties every component.** Drive a copy.
- ⚠️ **`DeployOptions.environment` is required** (may be `undefined`, must be present). An SSR deploy
  needs **two** `deployToFolder` passes — `runtimeType: 'ssr'` to the root and `'deploy'` into
  `public/` — because `compilation.ts:236` does exactly that and `index.js` reads
  `public/index.html` at setup. One pass gives you a server with no page.
