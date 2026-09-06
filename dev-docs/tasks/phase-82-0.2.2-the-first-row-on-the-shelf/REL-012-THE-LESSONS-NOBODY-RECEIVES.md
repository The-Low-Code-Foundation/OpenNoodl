# REL-012 — The lessons nobody receives

**Opened** 2026-09-04 from Richard's testing pass · **Blocks 0.2.2** · Effort: **S/M**

> *"What tutorials are going to come baked into the 'Learning' tab? I've got Log a thing and Your
> creature, on screen so far."*
>
> *"Package bundles, absolutely critical. We can write more basic tutorials if we need to, but even
> just 3 right now for 0.2.2 would be fine."* — Richard, 2026-09-04

## 🔴 The finding: he is looking at his own install register, not at what ships

The Learning tab is **not a curated list**. It draws from `models/learningfolder.ts` — a per-user
install register persisted in electron-store under the key `lessons`. **Nothing seeds it.** Its only
two writers are `ProjectsPage.handleInstallLearningLesson` (a folder picker, provenance `local`) and
`lessonplatforminstall.ts` (provenance `curated`).

So *"Log a thing"* and *"Your creature, on screen"* are on Richard's screen **because Richard
installed them.** A fresh 0.2.2 install opens the Learning tab to an empty shelf, and
`learningTabs.ts` therefore lands the user on *"Your path"* instead.

### 🔴 And the bundles are not in the artefact either

`project-examples/lessons` appears in **neither `files` nor `extraResources`** in
`packages/noodl-editor/package.json`. Both lesson bundles are committed, gated by
`npm run lessons:check`, and driven — and they ship inside **no artefact a user receives.**

⚠️ **The community channel does not rescue this.** `useTutorialInstall` reads
`GET /api/v1/community/tutorials` and works signed-out, but production answers `total: 0`
(`TUTORIAL-WORKSHOP.md`). Two empty surfaces, not one.

## What exists to ship

| bundle | state |
|---|---|
| `project-examples/lessons/log-a-thing` | ✅ built, gated, driven (TUT-003) |
| `project-examples/lessons/your-creature-on-screen` | ✅ built, gated, driven (SYL-004) — **prose is a draft awaiting Richard** |
| *"It breaks on a phone"* | drafted only, spine position 2 |

Richard asked for **three**. Two exist as bundles. The third is a content decision, not a build one —
that half belongs to **FB-012** (phase 75) and **FB-009 / phase 79**, and this row must not absorb it.

## Acceptance criteria

- **AC1** — `project-examples/lessons` (or a curated subset of it) reaches the packaged app. Proven
  by inspecting a **built artefact**, not the repo: the bundles are present in the app's resources.
- **AC2** — a **first-run seed** puts the shipped bundles into the install register, so the Learning
  tab is non-empty on a machine that has never installed a lesson. Packaging alone does **not** do
  this — the register is the thing the tab reads.
- **AC3** — the seed is **idempotent and non-destructive**: a user who removed a shipped lesson does
  not get it back on every launch, and a user's own `local` installs are never overwritten.
- **AC4** — a lesson installed from the community (`curated`) and a shipped one do not collide on id.
- **AC5** — driven, not asserted: a clean profile (no electron-store `lessons` key) opens the
  Learning tab and **sees the lessons**, and one of them opens.

## ⚠️ Traps

1. 🔴 **Packaging is not the whole fix, and it is the half that looks like the whole fix.** Adding
   the directory to `extraResources` makes the files present; the tab still reads the register. A
   session that stops at AC1 will report success against a still-empty tab.
2. **`asar` and path resolution.** `extraResources` lands outside the asar; anything resolving lesson
   paths relative to `__dirname` will be wrong in the packaged app and right in dev. Check how
   `STARTER_ASSETS` solves the same problem before inventing a second answer.
3. **Size.** Both bundles carry project assets. Measure what this adds to the installer before
   choosing "all lessons" over "a curated three".
4. **Do not seed from the community on first run** — `useProjectTemplates`' note applies here too: a
   network read on every cold start for a screen most sessions never open.
5. ⚠️ **`lessons:check` covers the repo directory, not the artefact.** If the packaged copy is
   filtered or transformed, that gate does not see it — which is [the same class as the finding
   itself](../phase-67-nodegx-university/README.md): a checker that runs over the artefacts that
   already exist is what catches this.

## Owner and relations

- **This row owns**: packaging + first-run seed + the drive.
- **FB-012** (phase 75) owns *tutorial content*; **phase 79** owns the syllabus. Neither is blocked
  by this and this is not blocked by them — two shipped bundles are enough for AC1–AC5.

---

## Findings — build session 2026-09-04

### What was built

| file | what |
|---|---|
| `packages/noodl-editor/package.json` | one `extraResources` entry: `../../project-examples/lessons` → `lessons`, with the droppings filter below |
| `packages/noodl-editor/src/editor/src/models/lessonseed.ts` | **new** — the packaging contract, the path resolver, the seed and its ledger |
| `packages/noodl-editor/src/editor/index.ts` | one line: `void seedShippedLessonsOnStartup();` inside `DOMContentLoaded` |
| `packages/noodl-editor/tests-unit/rel-012/shipped-lessons-reach-the-artefact.test.ts` | **new** — AC1 gate over the packaging config, with six mutant arms |
| `packages/noodl-editor/tests-unit/rel-012/seeding-the-learning-shelf.test.ts` | **new** — AC2 over the real bundles, AC3/AC4 over the seed's decisions |

`ProjectsPage.tsx` and `noodl-core-ui/src/preview/launcher/` were **not touched** and did not need to
be: `ProjectsPage` already subscribes to `learningFolderChanged`, which `install` emits, so the shelf
rebuilds itself when the seed lands.

### 🔴 Trap 3 — the size, measured before choosing

`project-examples/lessons` is **97,794 bytes** across 66 files (`log-a-thing` 58,747, `your-creature-on-screen`
39,047) — all JSON and Markdown, **no binaries**. `tar czf` of the directory is **30,720 bytes**, which is
the order of what it adds to a compressed dmg/nsis/AppImage.

**So "a curated three" was never a real choice.** At ~30 KB in the installer the whole directory ships,
and a lesson added in 0.2.3 seeds itself on upgrade with no config change. Revisit only if a bundle
ever carries media.

### 🔴 Trap 2 — `STARTER_ASSETS`' answer was read, and deliberately not reused

`starterAssets.ts` puts its files inside `files` (i.e. **inside the asar**) and resolves them against
`platform.getAppPath()`. That does not transfer here, for two reasons:

1. **It copies one file at a time** with `filesystem.copyFile` → `fs.copyFileSync`, which Electron's asar
   shim patches. `LearningFolderModel.install` copies a **directory**: `fs.cpSync(from, to, {recursive:true})`,
   and `cp`/`cpSync` are not in the patched surface. A lesson root inside `app.asar` would `existsSync`,
   pass `preflight` (which reads files individually), and then fail at the copy — invisible in dev, total
   when packaged. ⚠️ **Not executed against a packaged build** — no build was run this session. The design
   avoids depending on the answer rather than betting on it.
2. **`install` records `source: {kind:'local', path: bundleDir}`** and `canReset` answers `available` only
   while that path exists. Real files under `Resources/` make *Start again* work on a shipped lesson; an
   asar path would make `canReset` say yes and `repairFrom` fail.

The resolution answer reused instead is the repo's **other** existing one — `resolveMcpServer.js` /
`ServiceSupervisor.resolveServiceEntry`: a candidate list ending at `process.resourcesPath`, returning
what it probed. Same reason (`extraResources`), same shape. It is not a third answer.

### 🔴 AC3 — a ledger, not a presence check

`seededLessons` is a second key in the same `learning_folder` store. It records every bundle the seed has
**acted on**, including a **stand-down** (something was already in the register under this bundle's id, or
under the ordinary `slugifyLessonId(title)` id the folder picker and the community installer would give
it). The register is read only to decide whether to stand down — never to decide whether to install. So a
learner who removes a shipped lesson does not get it back, and a `local` install is never handed to
`install`, which deletes the target directory before copying.

⚠️ A **refusal is deliberately not ledgered**: a bundle the gate rejects is a defect in the artefact, and
the build that fixes it must be able to seed.

### 🔴 AC4 — the namespace is structural

Every other install path derives its id with `slugifyLessonId`, which replaces every run of
non-alphanumerics with `-` and therefore **can never emit an underscore**. A shipped lesson's id is
`shipped_<directory>`. The mutant arm in the spec installs the same real bundle twice under the ordinary
id and asserts the register ends with **one** entry — proving the collision is real and the prefix is
load-bearing, not decorative.

### 🔴 A defect this change would itself have shipped, found by measuring the directory

`project-examples/lessons/your-creature-on-screen/.mcp.json` and its `solution/` twin are **untracked
and gitignored** — written by *opening the project in the editor* — and each one names absolute paths
on the machine that opened it: a `/private/tmp/claude-501/…` scratchpad and
`~/Library/Application Support/NodeGX/PREFERENCES.md`. **`extraResources` copies what is on disk; git
has no say in it.** 66 files sit in that directory and 64 are tracked.

So the change that puts the lessons in the artefact would have put one developer's paths inside
**every learner's copy of the lesson.** The entry therefore carries
`filter: ["**/*", "!**/.mcp.json", "!**/.DS_Store"]`, declared once as `SHIPPED_LESSONS_FILTER` in
`lessonseed.ts`, and `shippedLessonsPackaging` requires the config to carry **exactly** that list —
it is not evaluating globs, it is asserting that the one filter this module reasoned about is the one
the build applies. ⚠️ Both possible dot-glob semantics give the safe answer, which is why this is two
lines rather than a staging step.

The gate arm that catches the *next* one asserts over the **directory, not the index**: every file
under `project-examples/lessons` must be git-tracked or excluded by the filter. Measured: tracked 64,
on disk 66, stowaways 0.

### ⚠️ Open risk carried into AC5

Both shipped manifests declare `authoredBy: "ai"`, so both install as **`local-ai`** — F1 **and** F2 **and**
F3, whatever provenance the seed passes. `npm run lessons:check` runs F1 and the semantic validator; it
does **not** run F2/F3. `tests-unit/tut-004/the-real-bundle-installs.test.ts` proves `log-a-thing` clears
the whole gate; **nothing proves `your-creature-on-screen` does.** The AC2 spec has a named arm for it
(*"seeds EVERY shipped bundle"*), and a red there is a finding about that bundle rather than about the
seed — the shelf is still non-empty on `log-a-thing` alone.

### Not run here

No suite, no `tsc`, no webpack, no build, no editor (shared-box constraint). Every AC below is
ASSERTED-ONLY until the gate is run — see the session report for the exact commands.

---

## Grading session — 2026-09-05 · every AC moved from ASSERTED-ONLY to a reading

The build session left all five ACs ungraded: *"No suite, no `tsc`, no webpack, no build, no editor."*
This session ran all of them. **Nothing was rebuilt and nothing was fixed** — the only source change
is one dev-launcher line that made the drive possible at all.

| AC | instrument | reading |
|---|---|---|
| **AC1** | a **real packaged artefact**, built here | 🟢 `Contents/Resources/lessons` present, **4 bundles, 122 files** |
| **AC2** | `npx jest tests-unit/rel-012` | 🟢 **2 suites / 30 tests, EXIT=0** |
| **AC3** | same | 🟢 ledger + stand-down arms pass |
| **AC4** | same | 🟢 the `shipped_` namespace arm passes |
| **AC5** | **driven**, clean profile, both arms | 🟢 3 lessons on the shelf; **Log a thing opened** |

### 🔴 AC5 — the drive, and the arm that says it was the seed

**The instrument first.** A "clean profile" could not be had without either mutating Richard's own
`~/Library/Application Support/NodeGX/` (destructive, and the reason his `learning_folder.json`
already carried a `stood-down` ledger from an earlier launch) or moving `userData` wholesale.
`packages/noodl-editor/scripts/start-electron-dev.js` now honours **`NOODL_USER_DATA_DIR`**, in the
same shape as the `NOODL_MAIN_INSPECT_PORT` hook beside it: it appends Chromium's own
`--user-data-dir` switch, which moves `app.getPath('userData')` and therefore every electron-store
file with it. ✅ **Richard's register was never touched — `md5` unchanged across the whole session
(`02d3f478…`).**

**Arm A — the seed present, a profile containing one file (`firstRunLegal.json`):**

```
[renderer:info] (lessonseed.ts:419) [lesson-seed] seeded 3 shipped lesson(s):
  shipped_it-breaks-on-a-phone, shipped_log-a-thing, shipped_your-creature-on-screen
```

The Learning tab opened on **Installed lessons** — *"3 lessons"*, three cards. Clicking **Start** on
*Log a thing* opened the project: lesson panel, the six task chips, and the live preview rendering
*"Type a line and press Log it."* Screenshots: `rel012-ac5-learning-tab.png`,
`rel012-ac5-lesson-opened.png`.

**Arm B — the reverted arm.** `void seedShippedLessonsOnStartup();` disabled (one line), the renderer
rebuilt, a **second** empty profile, same stack:

- the shelf is empty, and the tab lands on **Your path** — *"Sign in to the community and these three
  answers build your path"*, which is **exactly the finding this row opened with**;
- `learning_folder.json` **was never created at all**, so the absence is structural rather than a
  rendering that happened to read zero.

⚠️ The absence in arm B is asserted **beside a known-firing signal**: the `[lesson-seed]` line is the
same grep over the same log that returned it in arm A. `grep -c` read **0**.

### 🔴 AC1 — measured against a pre-change artefact that was already on disk

`dist/mac-arm64/NodeGX.app` from **2026-08-20 07:26** — built before this row landed — has **no
`lessons` directory in `Contents/Resources`**. That is the reverted arm for AC1, and it is a real
artefact rather than a mutant. The build taken here (`build:bundles`, then
`electron-builder --mac --arm64 --dir`, both EXIT=0, artefact mtime **2026-09-05 09:50:51**) has it.

🔴 **The stowaway filter was graded with a presence control, because "0 stowaways" is a number a
broken filter also prints.** On this machine the source directory **does** carry the two files the
filter exists to stop:

```
project-examples/lessons/your-creature-on-screen/.mcp.json
project-examples/lessons/your-creature-on-screen/solution/.mcp.json
```

and the counts reconcile exactly: **source 124 files − 2 = 122 in the artefact**, `.mcp.json` and
`.DS_Store` count **0** inside the app. One developer's absolute paths did not ship.

**Trap 2 was closed by running the shipped resolver, not by reasoning about it.**
`resolveShippedLessonsRoot` was executed against the built app's real `appPath`
(`…/Resources/app.asar`) and `resourcesPath`, and returned:

```
root:   …/NodeGX.app/Contents/Resources/lessons
probed: …/NodeGX.app/Contents/project-examples/lessons   (dev candidate, missed — correct)
        …/NodeGX.app/Contents/Resources/lessons          (hit)
```

with `readdir` of that root equal to `readdir` of `project-examples/lessons`. The probe spec was
temporary and has been deleted — it cannot live in CI, which has no built app.

### 🔴 What the drive found that the build session could not

1. **Three bundles ship, not two — Richard's number is already met.** `it-breaks-on-a-phone` is
   built and seeded cleanly. A **fourth**, `poke-it`, was being authored by a peer session during
   this build and is in the artefact too; the packaged count is therefore **4 at the moment of
   measurement** and will follow whatever is on disk at build time, exactly as designed.
2. ✅ **The AC5 open risk is closed.** *"Nothing proves `your-creature-on-screen` clears the whole
   gate"* — all three cleared it: three `installed` ledger rows, three cards, no refusals.
3. 🔴 **Two editors cannot coexist on this checkout**, so the reverted arm cost a full stack
   restart. A second Electron on a second profile reached `DevTools listening on 9223` and then died:
   the web server's port (8574) was taken, main called `showMessageBox` from a `net` error handler,
   and the process aborted with *"async hook stack has become corrupted"*. **The profile redirect
   works; a second instance does not.**
4. ⚠️ **A shipped lesson is badged *"Written locally"* on the shelf** — see the register row below.

### Registered, owner `NONE`

| finding | detail |
|---|---|
| 🆕 **Shipped lessons are badged *"Written locally"*** | `SHIPPED_PROVENANCE` is `'curated'`, but both manifests declare `authoredBy: "ai"`, and `resolveProvenance`'s asymmetry is deliberate: *"declaring `curated` buys trust and is ignored; declaring `authoredBy: "ai"` spends it."* So every shipped bundle installs as `local-ai`, and the shelf renders that as *"Written locally"* — on a first run, three lessons that came with the product are labelled as though the learner wrote them. **Do not "fix" by relaxing the policy** — that would undo UNI-010's one-directional trust. The seam is the *label*, not the provenance |
| 🆕 **Nothing gates the artefact** | AC1 is green here because a build was run **by hand**. `lessons:check` still covers the repo directory only, and the packaging spec still grades the **config**. This is trap 5, still open: the artefact check exists only for as long as someone remembers to run it |

⚠️ **Amendment, same day:** a peer session committed spine lessons 3 (`poke-it`) and 4
(`it-forgets-you`) after this build, so the repo now carries **five** bundles and `lessons:check` is
EXIT=0 over all five. **The 4/122 reading above is the artefact that was measured, not a claim about
the current tree** — the entry copies whatever is on disk at build time, which is the property the
measurement was taken to establish.
