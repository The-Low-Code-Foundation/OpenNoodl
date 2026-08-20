# UNI-007 — the lesson beamed into the editor

**Surface:** all three · **Tier 2 (the differentiator)** · **Effort:** L · ✅ **UNBLOCKED — D5 ruled
2026-08-14**; ~~D12~~ 🔴 **struck 2026-08-14 — already ruled**

> ## 🟡 Slices 1–4 are BUILT (2026-08-14 third + fifth sessions, 2026-08-15 sixth + seventh)
>
> No platform, no account. Slice 3 adds the first UI; **slice 4 gives the grading runner its first
> caller anywhere** — and, on the way, found that slice 3's lessons had been opening with no lesson
> layer at all.
>
> | Shipped | Where |
> |---|---|
> | ✅ **"Check my work"** (slice 4) — the runner's first caller, and the grade written back | [`models/lessoncheck.ts`](../../../packages/noodl-editor/src/editor/src/models/lessoncheck.ts) + the control in [`views/lessonlayer2.ts`](../../../packages/noodl-editor/src/editor/src/views/lessonlayer2.ts) / `views/lessons/LessonLayerView.jsx` |
> | ✅ **Engine 2's EDITOR adapter** (slice 4) — live `SemanticValidator` + BLD-014's CDP capture | [`models/lessonwholesolution.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonwholesolution.ts) + `.live.ts` |
> | ✅ **The drawn-element rule, shared by both adapters** (slice 4) | [`models/lessondrawncount.ts`](../../../packages/noodl-editor/src/editor/src/models/lessondrawncount.ts) |
> | 🔴 **The lesson layer, for a Learning-folder lesson** (slice 4) — it never attached | [`models/learninglesson.ts`](../../../packages/noodl-editor/src/editor/src/models/learninglesson.ts) + the reader port on `models/lessonmodel.ts` |
> | **The static two-vocabulary check** — the format contract's own gate, and the one blocker of §11's three that survived the fact-check | [`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts) |
> | **The grading runner — both engines, kept apart structurally** | [`models/lessongrading.ts`](../../../packages/noodl-editor/src/editor/src/models/lessongrading.ts) |
> | ✅ **Engine 2's MCP adapter** (slice 2) — validity via `validate_project`'s own call, "did it draw" via the render harness | [`noodl-mcp/src/lessons/wholeSolutionGrader.ts`](../../../packages/noodl-mcp/src/lessons/wholeSolutionGrader.ts) |
> | ✅ **The Learning folder register** (slice 3a) — install / reset / progress / grade, D5's guarantees made structural | [`models/learningfolder.ts`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) |
> | ✅ **The launcher's Learning section** (slice 3b) — cards, install route, reset | [`noodl-core-ui/.../components/LearningSection/`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/LearningSection/LearningSection.tsx) + [`projectsview.learningstate.ts`](../../../packages/noodl-editor/src/editor/src/views/projectsview.learningstate.ts) + `ProjectsPage.tsx` |
> | **160 tests**, `tests-unit/uni-007/` | jest / **`test:main`**, not the electron suite — see below |
> | 21 tests, against **real recorded renders** | `noodl-mcp` jest — ⚠️ **not in `test:ci`**, run `npx jest` in that package |
>
> ### Slice 4 — "check my work", and the lesson layer that was never there (seventh session)
>
> Commits `61d4a6d7`, `c0d04bba`, `c38fcb7b`, `47fa6040`, `393ec7bf`.
>
> #### ✅ DRIVEN in the real editor, against a consequence list written first
>
> The list was written before the drive and each line phrased so that **it could not also be true of
> a broken feature** — the rule phase-66 landed the same morning. One line failed.
>
> | Consequence | Result |
> |---|---|
> | The grading runner is **in the bundle** | ✅ `__wreq('…/lessongrading.ts').gradeLesson` is a `function` — the exact inverse of the measurement that proved nothing called it |
> | The **lesson layer attaches** | ✅ `isLesson: true`, 4 steps compiled from `lesson.json`, `.lessonlayerview` mounted, 3 task cards |
> | The learner can **read the instructions** | ✅ intro popup renders; the three task titles are in the bar |
> | A wrong and a right state **grade differently** | ✅ deleting `Variable2` took engine 1 from *1 of 3* to *0 of 3*; deleting the `Page` node took engine 2 from *"renders — 2 elements drawn"* to *"renders nothing at all"* — **and each moved without the other**, which is the structural separation, live |
> | The **card shows score and feedback** | ✅ "Scored 33%" + the sentence, after returning to the launcher |
> | `drawnElementCount` is a **real number** | ✅ 2, measured off the running viewer |
> | An empty page is **not** a clean pass | ✅ recorded `valid: true, rendered: false` — the "clean can mean EMPTY" rule end to end, in the app rather than in a spec |
> | **Reset** re-pulls and clears | ✅ grade and progress both `null`, card back to "Not started", the deleted `Page` node restored |
> | The verifier still **refuses a bad bundle** | ✅ `shadowed-by-deprecated` + `unmatchable-node-path`, both findings, at install |
> | **Reopen resumes on the step you left** | ❌ **FAILED** → fixed → ✅ re-driven |
>
> #### 🔴 The one that failed, and why no spec could have caught it
>
> Reopening restarted the lesson at step 1. The index came from `project.lesson.index`, which
> `ProjectModel.toJSON` persists — **but only when the project is saved**, and a learner reading
> instructions has changed no files. *"Carried over, never reset"* was true of the code and false
> through the UI.
>
> ⚠️ **A spec could not have caught it, because a spec has a save in it and a learner does not.** The
> fix reads the **register**: `recordProgress` writes on every step change with no save anywhere in
> the path, so it is both fresher and incapable of lagging. The project file stays as the fallback.
>
> 🔴 **It was also the consequence most tempting to skip** — the cheap-looking one at the bottom of
> the list. Restating the standing lesson: *the criterion you would drop is the one carrying the
> assumption.*
>
> #### ⚠️ Two things the drive established about driving, not about lessons
>
> - **`cdp click` reported `clicked … at 1166,715` for a click that did nothing.** The coordinates
>   were right; a `PopupLayer` modal was on top. 🔴 **`document.elementFromPoint(x, y)` is the check** —
>   if it is not your element, the click is landing somewhere else. This is the mouse twin of
>   phase-66's key finding the same day (a key event arrives `isTrusted` and runs no editing command
>   without `Emulation.setFocusEmulationEnabled` on the *same* session): **the transport succeeded and
>   the effect did not, and CDP reports success either way.**
> - **A running `test:ci` is indistinguishable from a booting editor** in a bare `ps` grep for
>   `OpenNoodl/node_modules/electron/dist` — it *is* Electron running the same app. Two sessions read
>   this suite's host as a fourth party launching an editor. The discriminator is the argv:
>   `Electron test.js --ci` under a `run-electron-tests.js` parent is a **suite**; `Electron . --dev`
>   under `start.ts` is a **dev stack**.
>
> #### 🔴 The premise that was false: **a Learning-folder lesson had no lesson layer**
>
> The handover said to put the button "in the lesson layer". There was no lesson layer.
> `EditorPage` attaches one only when `ProjectModel.instance.isLesson()` — `project.lesson !==
> undefined` — and the **only** code that has ever set that field is
> `LessonsProjectsModel._cloneLessonIntoDirectory`, the hosted-zip path, which points a `LessonModel`
> at an HTTP `baseURL`. `handleOpenLearningLesson` never did. So every lesson slice 3 installed
> opened as **an ordinary project**: no steps, no instructions, no completion evaluation, nothing to
> grade against.
>
> 🔴 **This is the fourth time this phase that building a caller found what a shipped thing does not
> do — and the first time the thing was a *feature* rather than a check.** The three before were
> gates that read complete on their own terms. This one had a live drive over it. The drive verified
> that the project opened and that the recents list did not grow — both true, both what it set out to
> check, and neither of them *"can this lesson be taught"*. The slice-3 session's own formulation,
> which is the one to carry:
>
> > **A drive proves what it measured, and what it measured is a choice you made before you knew what
> > was broken.**
>
> ⚠️ **And it had already produced a symptom that was explained away.** Slice 3 recorded that the
> card said "State on a page" while the titlebar said the project's own name, and reasoned about
> whether the opener should rename the project. The real answer was that there was no lesson layer to
> show a lesson title. **A plausible explanation is how a defect stops being investigated** — the
> observation was accurate and the story on top of it closed the question.
>
> **The fix** ([`models/learninglesson.ts`](../../../packages/noodl-editor/src/editor/src/models/learninglesson.ts)):
> the open path attaches a `LessonModel` whose source is read from the **installed directory**.
> `LessonModel` gains an injected reader for it, because `window.fetch` will not read a `file://`
> path from the renderer and an installed lesson has no origin for the hosted path's `baseURL` trick.
> 🔴 Everything after the read — format detection, `compileLessonSource`, steps, annotations — stays
> the one shared path; a second compiler is how two producers of one format start disagreeing about
> it. A manifest that will not compile now leaves the layer with no steps instead of an unhandled
> rejection and a progress bar that waits forever.
>
> **The step index is carried over, never reset.** `ProjectModel.toJSON` persists `lesson`, so a
> learner who closes the editor half way through comes back where they left off; resetting is the
> launcher's button and re-pulls the whole project. `recordProgress` gets its first real caller here
> — and writes progress *only*. ⚠️ **Only a grade may say a lesson is complete.**
>
> #### The runner finally has a caller
>
> `models/lessoncheck.ts` finds the register entry for the open project (its id is on the project —
> the opener sets it), **re-reads `lesson.json` from disk now** so an author iterating on a bundle
> grades against what they last wrote, grades with both engines, and records the evidence.
> `recordGrade` had existed since slice 3 with only a test harness calling it.
>
> 🔴 **Three states, not two.** *"The check could not run"* — no browser to render in, a lesson folder
> that has gone — is neither a pass nor a failure, is styled as neither, and withholds completion
> without ever telling the learner they failed. That sentence has more damage available to it than
> any other string in this slice, and the specs pin the three things it must never say.
>
> #### Engine 2's second adapter, and why it is not the sidecar's
>
> `noodl-editor` has no `@noodl/mcp` dependency and must not gain one, so the editor cannot call
> `noodl-mcp`'s adapter. It does not need to — it owns both halves:
>
> - **validity** → `SemanticValidator` over `ProjectModel.instance`. The **live** project, not a
>   re-read of disk: the learner is graded on what they have built, and what they have built is in
>   front of them.
> - **did it draw** → BLD-014's CDP capture, a hidden `BrowserWindow` over the running viewer.
>   🔴 Deliberately **not** `scripts/devtools/measure-from-disk.js`, which the sidecar spawns:
>   `scripts/` is not in `package.json`'s `build.files` and the harness needs a Chrome on the user's
>   machine, so that route works in this checkout and is **dead for every real learner**. Rendered
>   with `screenshot: 'none'` (D10).
>
> **The counting rule moved to [`models/lessondrawncount.ts`](../../../packages/noodl-editor/src/editor/src/models/lessondrawncount.ts),
> which imports nothing at all, and `noodl-mcp`'s adapter delegates to it.** Two adapters holding two
> copies of `min`-not-`sum` is one adapter plus a future defect — the rule is a property of the render
> harness, not of either caller. It is re-exported through `editor-deps.ts` as the one **value** in an
> otherwise types-only section; the dependency direction (mcp imports the editor, never the reverse)
> is untouched. The sidecar's 21 specs pass unchanged.
>
> ⚠️ **A `.jsx` file is invisible to `eslint`'s directory scan too**, not only to `tsc` and jest. The
> control's markup adds ~11 `react/prop-types` errors that `lint:ci` does not count, because
> `eslint <dir>` resolves `.js`/`.ts`/`.tsx` and not `.jsx`. `test:ci`'s webpack remains the only gate
> that reads the file at all.
>
> ### Slice 3 — the Learning folder, and the hole its gate exposed (sixth session, `e3aec6b6` + `a89ec153`)
>
> **The register is a SECOND store, not a flag on `recentProjects`.** A boolean on
> `LocalProjectsModel`'s entries would have put lesson projects into the recents list, where
> `renameProject` and `removeProject` already exist and are already wired to the card menu — so
> every one of those sites would need a guard, and a rule enforced at N sites is broken at N+1.
> A separate register makes D5 **structural**: there is no rename, there is no delete, and a lesson
> cannot appear in the normal picker flow because it is not in the list that flow reads.
> 🔴 The same reasoning governs *opening*: the card deliberately does **not** call
> `LocalProjectsModel.openProjectFromFolder`, which would add the lesson to recents and undo all of
> it. Proved in the live app — recents did not grow.
>
> **The verifier is the install gate.** A lesson written in the prose vocabulary can never be
> completed, and install is the only moment refusing it costs nothing. Warnings do not block: a
> lesson that will age badly is still one that can be finished today.
>
> 🔴 **Reset checks the source BEFORE it deletes anything.** Delete-then-fail loses the learner's
> work *and* the lesson — strictly worse than the state reset was pressed to repair, from the one
> button someone presses when they are already stuck.
>
> #### 🔴 The hole in the shipped check, found by building its caller
>
> `typeNamesInPath` correctly drops the first path segment, because `findNodeWithPath` reads it as a
> **component name**. Nobody had followed that through: a path written `%Group`, component name
> omitted, therefore contains *nothing the two-vocabulary check looks at* and passed in silence —
> while at runtime the evaluator hunts for a component literally called `"%Group"` and never finds
> one. Same for a bare `App:Group` segment, which reaches `nodes[parseFloat('Group')]` and indexes
> with `NaN`.
>
> Both end in exactly the outcome the vocabulary rule exists to prevent: the step never completes
> and the learner is told they have not done what they have done. **A gate that catches one spelling
> of never-matches and not the other is not a gate.** Now `unmatchable-node-path`, shape checked
> before vocabulary, and both fired against a hand-written bundle in the live editor.
>
> ⚠️ **What the static check still cannot catch, and this is a boundary not a bug:** *depth*. The
> drive's own lesson said `/#__page__/Home:%Text` where the `Text` sits under a `Page` node, so the
> condition is well-formed, well-spelt and still false. The verifier has no project — it is run
> before the project it grades exists — so wrong-but-plausible depth is engine 1's job to reveal,
> not the static check's.
>
> #### 🔴 A second boundary, found 2026-08-15 reconciling with phase 69: the catalog is built-ins only
>
> `defaultLessonVocabulary()` is built over `defaultCatalog()`, and `node-catalog.json` is generated
> from the **live register of built-ins** at repo-build time — a project's own `noodl_modules` kit
> nodes are not in it and cannot be. So **a lesson that teaches a custom node is refused at install**:
> `unknown-node-type` is `severity: 'error'` here, that error is class **F1**, and `REQUIRED_CLASSES`
> demands F1 of *every* provenance — the bundle is rejected for `curated` exactly as for `local-ai`,
> with a message telling the author their own node type does not exist.
>
> ⚠️ **This is a scope cap, not a defect to fix here.** The verifier is right to reject a name it
> cannot resolve; what is missing is the project-scoped catalog, which is
> [phase 69 / CN-003](../phase-69-the-node-you-write-yourself/CN-003-THE-PROJECT-CATALOG-OVERLAY.md)'s
> keystone. ✅ **The seam it needs already exists and costs this task nothing:**
> `VerifyLessonOptions.vocabulary` is an injection point and `LessonVocabulary`'s constructor takes
> `(catalog, index)`, so a caller holding a project passes a vocabulary built over the overlaid
> catalog. 🔴 It must be built from **the bundle's own project files**, not the currently-open
> project — this check runs before the learner's project exists.
>
> Until then: **no UNI-006 or UNI-007 curriculum step may name a kit node type**, and phase 69's
> CN-004 owns proving the consequence when the overlay lands (the step must *tick*, not merely stop
> erroring).
>
> #### 🔴 THE DEFECT SLICE 3 SHIPPED, found by slice 4's author on 2026-08-15
>
> **`handleOpenLearningLesson` never set `project.lesson`, so a Learning-folder lesson opened as an
> ordinary project.** `EditorPage` attaches the lesson layer only when `ProjectModel.isLesson()` —
> i.e. `project.lesson !== undefined` — and the only code that had ever set that field is
> `LessonsProjectsModel._cloneLessonIntoDirectory`, the hosted-zip path. The opener written in
> `a89ec153` loads the project and sets `project.id`, and stops there. **No steps, no instructions,
> no completion evaluation, nothing to grade against.** Fixed in slice 4 (`models/learninglesson.ts`).
>
> 🔴 **The live drive did not catch it, and why is the part worth keeping.** The drive verified that
> the project opened and that the recents list did not grow. Both true; both exactly what was set
> out to be checked; neither of them is *"can this lesson be taught?"*. This repo already carries
> **[verify the CONSEQUENCE, not just the mechanism]** as a standing trap, and slice 3 walked into
> it — its chosen consequence was the D5 guarantee, and it never asked what the learner would see.
>
> ⚠️ **It also retro-explains a symptom slice 3 recorded and explained wrongly.** The handover noted
> that the card said "State on a page" while the titlebar said the project's name, and reasoned
> about whether the opener should rename the project. The real answer is that **there was no lesson
> layer to show a lesson title.** A symptom described accurately and explained plausibly is how a
> defect stops being investigated.
>
> **This is the fourth instance of the "build the caller" method paying**, and the first of a
> different kind: the first three were a *check* that was incomplete. This is a shipped **feature
> whose visible half was never reachable**, and it survived a drive because the drive measured the
> half that worked.
>
> #### 🔴 The security hole this slice OPENED, and closed (`6d6d067e`)
>
> Compiled step HTML goes to `innerHTML` ([`lessonlayer2.ts:201`](../../../packages/noodl-editor/src/editor/src/views/lessonlayer2.ts))
> and `dangerouslySetInnerHTML` ([`LessonItem.jsx:117`](../../../packages/noodl-editor/src/editor/src/views/lessons/LessonItem.jsx))
> **inside the editor's own renderer, which has node integration.** A lesson body containing
> `[click me](javascript:require("child_process").exec("…"))` compiled into a live anchor:
> arbitrary code with filesystem access, one click away. `media.src` reached the emitted
> `<img>`/`<video>` the same way.
>
> `escapeAttr` never stopped it and was never meant to — it escapes quotes and angle brackets, and
> `javascript:alert(1)` contains neither.
>
> ⚠️ **The sink is old; the exposure is this task's.** Until slice 3 the only producer of lesson
> content was `LessonTemplatesModel`'s hosted index — one first-party endpoint. The Learning folder
> installs from **any folder on disk**, and UNI-010's premise is that the user's own model authors
> one. Closed with a **scheme allow-list**, not more escaping: `safeLessonUrl()` allows http, https,
> mailto and relative paths for links, plus `data:image/` for media. Two layers — the verifier
> reports `unsafe-url` so the author is told, the compiler neutralises at the sink so the legacy
> `lesson.html` reader (which never passes through the verifier) is covered too.
>
> **Two spellings worth carrying to any other URL sink:** `JaVaScRiPt:` and `java<TAB>script:` both
> work in a browser and both defeat `startsWith('javascript:')`. Strip control characters *before*
> reading the scheme. And note the general lesson: **escaping and scheme allow-listing are different
> defences**, and an escaper would not have caught this one.
>
> #### Provenance is the caller's word, never the manifest's
>
> A bundle that *declared* itself `curated` would be believed, and the one producer this format
> explicitly invites is an agent on the user's own machine. So provenance is an install argument,
> and there is now a fourth value — **`local`**, "installed from a folder you pointed us at", which
> says nothing about who wrote it. UNI-010's route will pass `local-ai` because it will know.
>
> #### The empty state reverses an earlier instinct, deliberately
>
> "Never show an empty shelf" is right for a shelf only a sign-in can fill — it would be an
> advertisement. It is **wrong** once a lesson installs from a folder with no account, because then
> the empty state is the only place that route is discoverable. So the section renders on the
> presence of an install handler, not on the count, and its copy names no platform and no account.
>
> **What the two modules actually do.**
>
> - `verifyLessonManifest(manifest)` reads every `%Type` path segment and every `hasType` in a
>   lesson, classifies it against `node-catalog.json`, and returns findings — never throws, because
>   both producers of this format hand it machine-written JSON. Ambiguous names are **rejected
>   without a suggestion**, on purpose: substituting would be choosing which of two nodes the author
>   meant, and choosing wrong is F3.
> - `gradeLessonSteps(manifest, ctx)` is **engine 1** — synchronous, pure, and it *calls the
>   existing evaluator*. It adds no condition logic of its own, which is the whole point.
> - `WholeSolutionGrader` is **engine 2**, an injected port. `normaliseWholeSolutionResult()`
>   enforces 🔴 *clean can mean EMPTY* on the way in: a result claiming `rendered: true` with zero
>   drawn elements is rewritten to `rendered: false` with a finding, so an adapter that forgets
>   cannot pass a learner on an empty page. The rule reaches the completion flag too.
> - `buildLessonEvidence()` carries **no project content** — positional step outcomes and counts
>   only. That is D10, not tidiness: the evidence bundle is the obvious route by which a pupil's
>   graph would leave the machine.
>
> **One upstream change was needed and is worth knowing about.**
> `views/lessons/lessonevalconditions.ts` imported `ProjectModel` and `NodeGraphContextTmp` at
> module scope for the sole benefit of `liveLessonEvalContext()`, which made the whole evaluator —
> and anything built on it — unloadable outside a renderer. Those two are now `require`d **inside
> that one function**. 🔴 This is what makes "the same verifier, not a fork" achievable: UNI-010
> runs this runner inside an MCP sidecar with no renderer around it.
>
> ### Slice 2 — engine 2 has an implementation (fifth session)
>
> `createWholeSolutionGrader(projectDir)` is the port's first implementation. It runs
> `new ProjectStore(dir)` + `validateOnDisk` — literally the call behind `validate_project` — and
> `runRenderReport`, and reduces both to the two answers a learner's card shows.
>
> - 🔴 **It always reports `drawnElementCount`, including zero.** This is the whole reason the
>   adapter is worth writing carefully. `normaliseWholeSolutionResult()` rewrites a claimed render
>   with a zero count into a failure, but it deliberately does **not** invent a count an adapter
>   omitted — so *an adapter that stays silent about the count opts itself out of the empty-page
>   check entirely.* There is a spec named for that.
> - 🔴 **The count applies the render harness's own blank rule, not a second one.** The harness calls
>   a viewport blank at `text.elements === 0 && images.total === 0`, so drawn = those two summed, and
>   the aggregate across viewports is the **minimum, not the sum** — the harness raises
>   `blank-render` if *any* viewport is blank, and summing would let a healthy desktop hide an empty
>   phone. Two independent reads (the count, and the harness's own `blank-render` finding), and the
>   conservative one wins if they ever disagree.
> - 🔴 **It renders with `screenshot: 'none'`.** A screenshot of a learner's project is project
>   content, and D10 says that never leaves the machine. Engine 2 needs two numbers and a list; it
>   has no use for the picture.
> - **It never throws.** No Chrome, no viewer bundle, a legacy project — all come back as
>   `unavailable`, this package's standing rule for absence. A throw would take engine 1's per-step
>   verdicts down with it, and those are the half that works without a Chrome.
> - **Validation is non-strict, and that is a judgement.** Strict mode exists so a typo'd node type
>   hard-fails an *agent authoring a fresh graph*; a learner dragging nodes out of the picker is not
>   that population. Warnings are reported, never fatal.
>
> **One editor-side change came with it: `WholeSolutionResult.unavailable`.** Engine 2 previously had
> no way to say *"I could not run"* — only `rendered: false`, which reads as *"your page is empty"*.
> Those are different conversations with a learner, and UNI-010 runs this port inside an MCP sidecar
> where "no Chrome" is an ordinary Tuesday. It is the same distinction `StepGrade.error` already drew
> for engine 1. The evidence bundle carries it as a **flag, not the sentence** — the sentence names a
> filesystem, and the bundle is the thing that leaves one.
>
> 🔴 **It deliberately does *not* force `rendered: false`, and the first draft did.** Engine 2's two
> halves fail **independently**: a project the validator cannot *read* may still render perfectly, so
> collapsing them emits `rendered: false` beside `drawnElementCount: 98` — a payload contradicting
> itself, which is the very shape `normaliseWholeSolutionResult()` exists to catch. Reproducing the
> defect one layer above the guard against it is easy enough to be worth naming. **The safety
> property belongs on the decision, not on the observation:** `buildLessonEvidence().complete` now
> requires `valid && rendered && !unavailable`, stated once, and every field beside it stays honest
> about what its own half saw.
>
> **🔴 What is NOT built, so nobody reads this as more than it is:**
>
> - ✅ ~~**NOTHING CALLS THE GRADING RUNNER**~~ — **closed by slice 4** (`47fa6040`). It was proved
>   rather than assumed: `__webpack_require__` in the running renderer answered *"Cannot find module
>   `./src/editor/src/models/lessongrading.ts`"*, because no editor module imported it. It does now.
> - ✅ ~~**Nothing writes a grade back**~~ — **closed by slice 4.** `recordGrade` and `recordProgress`
>   both have real callers.
> - ✅ **Slice 4 is BUILT and DRIVEN** (2026-08-15). Ten consequences checked, one failed and was
>   fixed and re-driven — see the drive table above.
> - ⚠️ **Lesson prose must use explicit markdown links.** `linkify` is off in both Remarkable
>   instances, so a *bare* URL in a lesson body never becomes an anchor — only `[text](url)` and
>   `<url>` do. Safe direction, but UNI-010's premise is a model authoring these bodies, so it is a
>   thing the format's producers have to know.
> - ⚠️ **`buildLessonEvidence` carries `valid`/`rendered`/`findingCount`, not the drawn count.** The
>   number reaches the learner through the sentence and the console, never through the bundle. That
>   is D10 holding — but if UNI-002's points event ever wants it, adding it is a *decision about what
>   leaves the machine*, not a field.
> - **Nothing calls the MCP adapter either**, and it is deliberately not an MCP tool — a
>   `grade_lesson` tool needs a `LessonEvalContext` built from a project on disk, which nothing
>   builds yet. ⚠️ And `noodl-editor` has **no `@noodl/mcp` dependency**, so the editor's button
>   cannot call that adapter: expect a second, small **editor-side** adapter. One port, one adapter
>   per process that owns the machinery.
> - **No intake, no pathing, no projection cache.** Criterion 1 is not started — it is platform work.
> - ⚠️ **A lesson's title and its project's name can disagree**, and nothing reconciles them. The
>   card showed "State on a page" while the editor titlebar showed the project's own name. The open
>   path sets `project.name` only when the project has none, on purpose — forcing it would write
>   into the learner's project on open. The right fix is for the lesson layer to show the lesson
>   title, not for the opener to rename anything.

> **D5 — a visible, platform-managed Learning section** ([RULINGS.md](RULINGS.md)). R9's two options
> resolve in favour of the visible one, because visible progress motivates. **"Immutable" means
> platform-managed, not read-only:**
>
> - The learner **edits the lesson project freely** — that IS the lesson. Nothing in the content is
>   locked.
> - The learner **cannot rename, detach or delete it** from the launcher.
> - **Reset = re-pull a fresh copy.** That is the entire recovery story — no undo stack, no partial
>   repair path.
>
> 🔴 **The editor process writes this state. Never the platform, never an MCP sidecar** — the
> launcher's recent-projects store is read-only to sidecars, and a design that has the platform
> writing it is wrong on the bridge direction as well as on this ruling.
>
> ⚠️ **Progress metadata must not assume an account.** Completion %, score and feedback are fed
> either by local grading (this task's runner) or by a pulled platform result, and **the display
> cannot tell which** — that is what lets UNI-010 run with no platform at all.

> ✅ **CURRICULUM-DESIGN §11's three blockers — FACT-CHECKED 2026-08-14** against source and git.
> Full write-up in [RULINGS.md](RULINGS.md); the short version:
>
> - ✅ **Blocker 2 CLEAR.** Phase 60 is **7/7 closed (2026-08-11)** and its signal wording shipped as
>   `SIGNAL_SENTENCE` in `portCopy.ts`. The curriculum glossary had never been told and still carried
>   the paraphrase phase 60 disproved — **corrected in place**. **L2 is unblocked.**
> - ✅ **Blocker 3 CLEAR.** Phase 61 is **8 of 9 built on `cline-dev`**, and FUN-001 §2's notation
>   ruling (`Inputs.`/`Outputs.`, never `Noodl.Inputs`) was **signed 2026-08-12** and is enforced by
>   `notation.test.ts`. Phase 61's own table said otherwise and was stale — corrected.
>   ⚠️ **FUN-005's ports rail does not exist**, so no L11 step may say "click the port in the rail
>   beside the code".
> - 🔴 **Blocker 1 STANDS, and is worse than recorded.** Two of the nine display names are
>   **ambiguous**, not merely divergent: `Array` → `Collection`/`Collection2`, and **`Object` →
>   `Model`/`Model2`** (recorded as `Model2` alone until 2026-08-14). **The format contract must
>   state the two-vocabulary rule and mark those two as unusable in prose**, because an ambiguous
>   name can resolve to the *wrong* node rather than to none — class F3, not just F1.
>
> ⚠️ **Two owed items this task inherits and never mentions**, both from CURRICULUM-DESIGN §11:
> **curriculum hosting** (§9.3 — now partly a D2/D9 question), and the **tutor lesson-context
> overlay** (§9.1, *"required before L2 testing"*). The intake → path → beamed-lesson arc runs
> straight into the second.

> **Corrections from [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) (2026-08-14):**
>
> **The spine is ruled, not pending.** LEARN-002's D1–D9 were answered **2026-08-09**
> ([CURRICULUM-DESIGN §10](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)): 12 lessons, ~30 min each,
> the **pet** theme, adults *and* teenagers, Counter before Variable (Variable revealed at L6),
> code-mapping in the spine, badges in, capstone = menu with free choice, L8 on the **built-in
> backend**, Logic Builder as an optional visual track.
>
> **What actually blocks authoring** is [CURRICULUM-DESIGN §11](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)'s
> three items, none a design question: (1) the two-vocabulary rule — see below; (2) **phase 60 must
> land its "signal" wording first**, or L2 is authored against a sentence already known false;
> (3) **L11 must not be authored until phase 61 lands**. Confirm phases 59/60/61 status before
> claiming a spine to project from.
>
> **Tier-1 AI projection is off by default for org-minor accounts** (D10, ruled 2026-08-14) — or
> runs on pathing metadata only, never pupil project content. LEARN-005's "verified zero external
> data transmission" is a network-level claim and no account ruling relaxes it.

> ## ✅ AC1 IS MET — intake → path, and the projection cache (2026-08-19, session 43)
>
> Platform repo, `nodegx-community`. **48 test files / 1164 tests / 0 failures**, `tsc` clean.
>
> | Shipped | Where |
> |---|---|
> | **The intake** — three closed-answer questions, one current set per learner | `src/lib/pathing.ts`, `learner_intakes` (0016) |
> | **Tier-0 branching** — the visual-logic learner never meets the function-node lesson; `data` / `custom-nodes` tracks join the path when asked for | `pathFor()` |
> | **Tier-1 projection, cached per (learner, concept)** | `src/lib/projection/projector.ts`, `concept_projections` (0016) |
> | **The real projector** — Sonnet, per this task's own scope line | `src/lib/projection/anthropic.ts` |
> | Routes | `GET/POST /v1/me/intake`, `GET /v1/me/path`, `POST /v1/me/path/project` — `docs/API.md` §5c |
> | Gates | **29 specs**, `tests/uni007-intake-and-pathing.test.ts` |
>
> ### 🔴 The two assertions the criterion actually turns on, and both were verified RED first
>
> 1. **"Exactly one model call ever" is only provable concurrently.** Check-then-call-then-store
>    passes a sequential test perfectly and double-bills under any real load: two requests both
>    find no row, both call, and the second overwrites the first with an equally plausible answer —
>    nothing errors and the output is indistinguishable. So the `(account_id, concept)` **primary
>    key is claimed before the model is called**, and the loser reads the row. Measured: with the
>    defect deliberately reintroduced, the eight-concurrent-request spec went red and **the
>    sequential one still passed**, which is the evidence for the claim rather than the theory.
> 2. **Omitting a lesson orphans whatever depended on it.** The capstone needs the code-mapping
>    lesson; the visual-logic learner does not get that lesson. Omit it naively and the path's last
>    step depends on a lesson that is not in the path — and the path still *renders* perfectly. So
>    an omitted lesson hands its own `needs` down, and the invariant is asserted directly over all
>    **18** intake combinations, not on the two the criterion names.
>
> ### 🔴 UNI-022 AC4 caught the first implementation, and it was right to
>
> The first `pathFor` hardcoded three lesson slugs. UNI-022's sweep — *no `.ts` under `src/` may
> name a lesson* — failed, and it was not a naming quibble: it meant **branching a learner past a
> lesson was a code change**, which is the same defect as adding a lesson being one. Fixed by
> moving the rules into `curriculum.json` (`requires` / `includedBecause` / `omittedBecause` /
> `final`); `pathFor` now names no lesson at all. ⚠️ **A guard from a neighbouring task found a
> design error in this one** — the sweep was not written for UNI-007 and is what made it visible.
>
> ### D10, made structural in two places
>
> - **Off for org-minor accounts**, decided by reading the account's **own kind** rather than by
>   trusting a caller's argument, and decided **before** the row is claimed — so the day D10
>   changes for an account there is something left to project into. Paired with a known-firing
>   control: an individual account through the identical code does call.
> - **Pathing metadata only, never pupil content.** The projector is handed two finished strings
>   and never sees the learner, the account or the intake object. The answer set is closed — no
>   free-text question — and `learner_intakes_answers_are_tokens` (0016) enforces it *in the
>   schema*, because "the route validates it" is the sentence that stops being true when somebody
>   adds a second writer. Registered in UNI-005's inventory with a probe.
>
> ### ⚠️ What this does NOT change
>
> **§1b's wall stands: all fifteen lessons are still `in-writing`, so every path is a path to
> nothing installable.** That is deliberate and visible rather than worked around — `ready`/`total`
> and a `truth` sentence are computed per path from each lesson's own standing, and a spec asserts
> the curriculum really is all `in-writing` so the sentence cannot rot. **Curriculum hosting is
> UNI-007 §11's, still open, and it is the real blocker on "a stranger learns NodeGX".**

> ## ✅ AC1's EDITOR HALF IS BUILT — the caller the platform end never had (2026-08-20, session 48)
>
> Editor repo. **49 specs** in `tests-unit/uni-007/` (`learnerpath`, `communityapi-path`,
> `learnerpath-render`) plus 4 added to UNI-001's session gate; `tsc -p packages/noodl-editor`
> clean; **driven over real HTTP** against `next dev` on its own database.
>
> | Shipped | Where |
> |---|---|
> | The four `/api/v1/me` calls — `intake`, `submitIntake`, `path`, `projectConcept` — and their payload types | [`models/community/communityapi.ts`](../../../packages/noodl-editor/src/editor/src/models/community/communityapi.ts) |
> | The view model — which of six states, and the words for each | [`models/community/learnerpathview.ts`](../../../packages/noodl-editor/src/editor/src/models/community/learnerpathview.ts) |
> | The hook — the caller | [`hooks/useLearnerPath.ts`](../../../packages/noodl-editor/src/editor/src/hooks/useLearnerPath.ts) |
> | The section, above the installed-lessons grid on the Learning tab | [`noodl-core-ui/.../components/LearnerPathSection/`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/LearnerPathSection/LearnerPathSection.tsx) + `views/Learning.tsx` + `ProjectsPage.tsx` |
>
> ### 🔴 Building the caller found TWO defects in the shipped client, and neither had a route
>
> Both are the same shape: **a status the platform deliberately chooses had no home in the
> client's mapping table, and every unmapped status defaults to the one outcome that blames the
> network.**
>
> 1. **`Read<T>` had no `unauthenticated`, so a 401 read as *"could not reach the community"*.**
>    Every other read on this API answers `200` for a null viewer *on purpose* — D15's refusal is
>    a `404`, and a signed-out pull must be indistinguishable from a member with an empty list —
>    so nothing had ever exercised it. `GET /me/path` is **the first read on this API that
>    answers 401**, and it walked straight into the hole. ⚠️ The sharp part: `Write<T>` has had
>    `unauthenticated` since 2026-08-16 and its doc comment argues the distinction at length.
>    **A distinction argued for one half of a client is not thereby made in the other half** —
>    and the comment reads as though it were, which is why four days of reading that file did not
>    find this.
> 2. **`post()` mapped 400/403/429 and let `409` fall through.** `POST /me/path/project` answers
>    `409 {error: "take the intake first"}` — a sentence a learner can act on — and it arrived as
>    an outage. API.md §6 gives the RFP response cap the same status, so NAT-009 would have
>    inherited it.
>
> ✅ Both are asserted **against a control that must disagree**, never alone: *"401 produces some
> outcome"* passes against the defect; *"401 and a dead socket produce **different** outcomes"*
> does not.
>
> ⚠️ **The `Read<T>` change cost three edits elsewhere and the compiler found all three** —
> `peopleview.ts` (×2) and `threadview.ts`. Each is branched with a sentence rather than cast:
> those routes cannot 401 today, and a cast would have silently reinstated the conflation the day
> the Bench is ever scoped to members.
>
> ### 🔴 The assertion this surface actually turns on
>
> **`truth` is printed verbatim and never reconstructed from `ready`/`total`.** Today it says
> *"none of them can be installed yet: every one is still being written"* for every learner. An
> eleven-step path with titles, times and reasons reads like a finished product; the same path
> with that sentence reads like a curriculum being built — and it is the one string a tidy-up
> would delete as redundant.
>
> Proved the only way it can be: the spec hands the view a payload whose counts **contradict its
> own sentence** and requires the sentence. A version that recomputed would produce the plausible
> string and the wrong one, **and every other assertion in the file would still pass**. Same shape
> as `entryPointFor`'s spec for D16. The render spec then adds the half a view model cannot be
> asked — **it is drawn ABOVE the steps**, because a caveat below an eleven-item list is a caveat
> most readers never reach, and *"the sentence is present somewhere in the tree"* passes against
> exactly that. Graded: moving it below the `<ol>` — a change that keeps it present — reddens only
> the ordering assertion.
>
> ### ✅ Driven over real HTTP — `next dev`, own database, the real client
>
> Twelve consequences, written before the build. `nodegx_community_s48` on the 55432 container.
>
> | Consequence | Result |
> |---|---|
> | Questions arrive with **no token**, labels are the platform's | ✅ 3 questions, `answers: null` |
> | **Expired token vs dead socket must DISAGREE** | ✅ `unauthenticated` vs `unreachable`; surface says *sign in*, questions still drawn |
> | 409 reaches the learner as the platform's words | ✅ `"take the intake first"` |
> | No intake ⇒ the **form**, not an error | ✅ `intake` state from `{intake: null, path: null}` |
> | Two intakes ⇒ **visibly different paths** | ✅ visual **11** steps, code **13** |
> | …and the **omission** carries its reason | ✅ *"The same ideas in code — you said you would rather wire logic up visually"* |
> | The `truth` sentence is drawn | ✅ `ready 0/11` |
> | **Five path reads spend NOTHING** | ✅ model calls `0 → 0`, counted |
> | **Two project requests = ONE model call** | ✅ counted `0 → 1 → 1`; `fresh: true` then `false`; identical prose |
> | **D10: org-minor refused while the individual is READY** | ✅ arms differ, and the allowed arm genuinely projected |
> | …and the refusal **costs no model call** | ✅ `1 → 1` |
> | The projection reaches the row, and the offer is **withdrawn** | ✅ `projectable: false` once one exists |
>
> 🔴 **The first drive reported C5 and C6 green and both were VACUOUS**, which is the transferable
> bit. With no `ANTHROPIC_API_KEY` the individual arm answered `unavailable`, so *"the arms
> differ"* was satisfied by `refused ≠ unavailable` — **while nothing had projected at all**, and
> a `|| kind === 'unavailable'` escape hatch I had written myself carried the `fresh` assertion.
> Re-run against a **counting fake projector** (temporary, reverted): only then is *"two requests,
> one call"* a measurement rather than a shape. ⚠️ *A control pair whose arms differ for a reason
> that is not the one you varied has measured nothing* — fourth instance in this phase.
>
> ### ✅ UNI-001 AC4's session gate fired on this hook, and it was right to
>
> `session-readers.test.ts` went red the moment `useLearnerPath.ts` landed: a new session reader
> with nobody having answered *"what does this read withhold?"*. **The cheap answer — "it is a new
> surface, so it took nothing away" — is true and is not enough**, because it would license any
> new surface to be account-only and *"the login gates nothing"* would decay into *"gates nothing
> that existed on 2026-08-14."* The answer that counts: **the part of this surface that can work
> without an account does** — `GET /me/intake` takes no token, so a signed-out editor draws the
> real questions, not a locked panel describing them. Registered with a control pair: the checker
> is shown it **can** see this hook's gate (the path read) before it is believed about the intake
> read being ungated.
>
> ### ⚠️ NOT done, and not claimable
>
> **The editor was never launched.** A peer held the stack and CDP 9222 for this whole session.
> So: the wire is driven, the view model is graded by nine mutations, and the component is graded
> by seventeen render assertions and four mutations — but **nobody has seen this section in the
> running launcher**. Layout, the Learning tab's column width, theme, and whether the `truth`
> paragraph reads as prominent rather than as boilerplate are all **unverified**. That is a drive,
> not a spec, and it is the next session's first job.
>
> ⚠️ **§1b's wall is untouched and is now visible in the editor too**: all fifteen lessons are
> `in-writing`, so this section draws a real, personalised, ordered path to **nothing
> installable**. Curriculum hosting is §11's, still open, and still the real blocker on *"a
> stranger learns NodeGX"*.


## Premise

The pedagogy ruling (R8): Loom-*style* — an intake conversation works out what the learner
already knows (dev background, internet fluency, which NodeGX route they chose: visual logic vs
function nodes) and builds a personalised path — but the practical is **not text**: it is a real
project **beamed into the real editor**, because the Noodl/Backendless magic was hands-in-the-app.
"Beamed" is a pull (README, bridge constraint): the signed-in editor fetches the lesson project
from the platform and installs it in the **Learning folder** (R9/D5), where it carries metadata
normal projects don't have — completion, score, feedback — fed by MCP grading or by a human
(UNI-006).

## The lesson format is an OPEN CONTRACT — design it that way

🔴 Two producers write this format from day one: the platform's lesson generator, and — per
UNI-010 — **the user's own Claude through a local MCP**. So the format, not the platform, is the
source of truth. One versioned bundle: project files + `lesson.json` (steps, instructions,
per-step machine-checkable completion conditions, solution reference) + provenance (curated /
org / AI-generated-locally). Anything that writes a valid, verified bundle is a lesson source.
(LEARN-001's non-programmer `lesson.json` format work is the starting point — revive, don't
reinvent.)

**More of it exists than this task assumed** (verified 2026-08-14): a declarative manifest +
compiler in [`models/lessonformat.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts)
(+18 tests), a completion evaluator that is a **pure function of (conditions, context)** with
`eval()` removed in [`views/lessons/lessonevalconditions.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts)
(+33 tests), a **closed 11-verb condition vocabulary**, semantic addressing (component/label/type —
never node id or DOM), progress persistence and a Learn-tab entry UI, all verified in the running
editor 2026-07-25.

### 🔴 The trap the open contract must carry

[LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md): every lesson carries **two
vocabularies**. Prose (`title`, `body`) uses a node's **display name**; conditions (`%Type`,
`hasType`) use its **type name** — and nine differ: `Repeater`→`For Each`,
`Repeater Item`→`For Each Actions`, `Static Array`→`Static Data`, `Delay`→`Timer`,
`Array`→`Collection`, `Insert Object Into Array`→`CollectionInsert`, `Object`→`Model2`,
`Record`→`DbModel2`, `Page Router`→`Router`.

*"The failure is silent: a condition naming a display name matches nothing, and the learner is told
they have not done a step they have in fact done."* An open contract with two producers doubles the
exposure. **The format spec must state the rule and the verifier must enforce it statically**
against `node-catalog.json` — neither currently does.

## Scope (v1)

- **Platform: intake + pathing.** A short conversational intake → a path of lessons from the
  D12-ruled spine, with tier-0 personalisation first (branching: the visual-logic learner never
  meets the function-node lesson) and tier-1 AI projection (Loom's generate-once-cache pattern:
  Sonnet projects a spine concept onto this learner's context, cached per (learner, concept) —
  cents, once, forever) where branching isn't enough.
- **Editor: the Learning folder** (per D5's ruling): a launcher section the *editor process*
  writes — 🔴 never a sidecar; the launcher store is read-only to external processes (the
  electron-store lesson). Lesson projects show lesson metadata (progress, score, feedback) on
  their cards; "immutable" per D5 = platform-managed (freely editable inside — that IS the
  lesson — but not renamed/detached; reset = re-pull fresh).
- **Editor: the grading runner.** ⚠️ **Two jobs, two engines — this task conflated them.** Per-step
  completion already exists as the tested 11-verb pure evaluator (`lessonevalconditions.ts`) and is
  what the lesson runtime uses to advance a step; building a second per-step grader on MCP
  primitives would fork the very contract this task exists to keep single. So:
  - **per-step completion** → the existing evaluator. No MCP call, no model call.
  - **whole-solution validity + "did anything actually render"** → the MCP tooling
    (`validate_component`, `validate_project`, `render_report`). 🔴 Assert *drawn output*, not
    absence of errors — "clean" can mean EMPTY.

  Runs locally, on demand ("check my work"); on finish, produces the evidence bundle (consumed by
  UNI-002 bridge-events and UNI-006 submissions).
- **Feedback loop:** score + feedback (machine or human) flow back onto the Learning-folder card.

## Acceptance criteria

1. ✅ **MET 2026-08-19.** Intake → path: two learners with different intakes (visual-logic vs
   function-node) receive visibly different paths from the same spine; the projection for one
   (learner, concept) pair makes exactly one model call ever (the cache spec — Loom's proven
   guarantee, re-proven here). ⚠️ Re-proven **concurrently**: the sequential form of that spec
   passes with the defect in place. See the AC1 block above.
2. A lesson pulled into the Learning folder appears in the launcher's Learning section with its
   metadata, absent from the normal picker flow per D5; reset re-pulls a clean copy.
3. ✅ **MET 2026-08-14.** "Check my work" grades a deliberately-wrong and a correct attempt
   differently, per step, with **no model call** — per-step via the existing 11-verb evaluator,
   whole-solution via local MCP tooling. (The "no model call" half is already true today; the
   criterion is that the two engines stay separate and neither is reimplemented.) Both engines are
   built and the whole-solution half has its adapter; ⚠️ what remains is a *caller* — the button
   that runs it lives in the Learning folder, criterion 2.
4. The format round-trips: a bundle authored by hand (no platform) installs and grades
   identically — proving the open contract before UNI-010 leans on it.
5. The full loop: completion → evidence → score+feedback on the card → UNI-002 points event.

## ✅ The tutor lesson-context overlay — built 2026-08-16 (CURRICULUM-DESIGN §9.1)

One of the **two owed items phase 67 never carried**, and the one marked *"required before L2
testing"* since 2026-07-25. TUTOR-BOUNDARY §4 had specified it as an implementable spec for three
weeks; nothing had been built, and nothing in phase 67 mentioned it.

**What ships.** When the open project is a lesson, `ExplainSession` appends TUTOR-BOUNDARY §4's
overlay to the explain system prompt, naming the current step and forbidding the tutor from
completing it.

| Piece | Where |
|---|---|
| The overlay, the glossary, the markdown stripper, the `deep` clamp | [`explain/tutor.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/explain/tutor.ts) — **new, import-free** |
| Appended to the system prompt, never substituted | [`explain/prompts.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/explain/prompts.ts) `systemPrompt(tutor?)` |
| `tutorContext` option; `deep` clamped for every caller | [`ExplainSession.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/explain/ExplainSession.ts) |
| Authored step title/body kept beside the compiled HTML | `lessonformat.ts` `CompiledStepSource`, `lessonmodel.ts` `getCurrentStepSource()` |
| Supplies the context; drops "In depth" from the menu | `ExplainPanel.tsx` |

🔴 **Three decisions worth not re-deriving:**

1. **A lesson being open arms the boundary — not knowing the step.** When the step text cannot be
   read (a legacy `<!-- # -->` lesson, or a manifest step with neither title nor body) the overlay is
   *still* appended and still forbids completion; only the task line degrades to saying so. Returning
   "no tutor context" there would drop the whole boundary for exactly the lessons whose text is
   hardest to read.
2. **The step source is carried, not re-parsed.** `CompiledLesson` now holds the authored
   title/body index-aligned with the compiled HTML. Recovering `{step.title, step.body}` by
   un-rendering the HTML would be a second, lossier reader of a format `LessonModel`'s own header
   already warns has exactly one — *"a second compiler is how two producers of one format start
   disagreeing"*.
3. **`deep` is clamped in the session, not just hidden in the menu.** §4 disables it because depth
   *"invites solution-shaped walkthroughs of the exact step"* — and `deep`'s own instruction is
   literally *"walk the data flow step by step"*, which over a half-built lesson graph is §5.4's
   oracle-extraction attack available from a dropdown. A hidden menu item protects the panel; a
   clamp protects every caller, including the measurement harness.

### ✅ D7's obligation is now discharged by construction, and the check that looked like proof was not

CURRICULUM-DESIGN §6 states D7 as prose: *"this glossary cites phase 60's sentence — it does not
paraphrase it"*, plus *"if `portCopy.ts` changes, this line changes with it"*. That was a promise
somebody had to keep by remembering. `SIGNAL_SENTENCE` is now **exported** and the tutor glossary
**derives** its Signal line from it, so the two cannot disagree.

🔴 **The spec asserting that derivation cannot fail, and I claimed it could.** Its first comment read
*"reword `SIGNAL_SENTENCE.lead` and this fails"*. Measured: rewording the lead to *"Signal — a
pulse, not a number."* left **all 25 specs in the file green**, because the assertion reads its
oracle out of the artefact under test — the green-side twin this repo already carries a trap for.

✅ **The system is sound anyway, and the measurement is what shows it:** the same reword fails **two
specs in `tests-unit/connection-popup/portCopy.test.ts`**, which pin the sentence verbatim. So the
wording is guarded once, where phase 60 owns it, and the tutor follows by construction. The comment
now says that instead. ⚠️ The spec still earns its place as a guard against somebody **replacing the
derivation with a hand-copied string** — the moment that happens it becomes a live drift detector.

### Controls run, because a prompt is the easiest artifact to weaken silently

- **Overlay disconnected from the prompt** (`systemPrompt` ignores its argument): **2 specs fail**,
  both seam specs. ⚠️ *"keeps every base rule"* correctly still passes — it guards against
  substitution, not omission, and the "appends" spec is the one that covers omission.
- **A defect the specs found before review did.** `stripMarkdown` read the first word of an *inline*
  triple-backtick span as a language tag, so ` ```a > b``` ` came out as `> b` — silently deleting
  the left-hand side of the expression a step was telling the learner to type. Block fences and
  inline spans are now handled separately.

### ⚠️ What is NOT closed, stated plainly

🔴 **TUTOR-BOUNDARY §5's adversarial run has not happened, and it is the acceptance.** Six attacks
are enumerated — direct ask, persistence, reframe, oracle extraction, helpful-refusal scoring,
false-positive check — and every one needs a **live provider**. What is graded here is that the
overlay *says* the right things and *reaches* the prompt. **Whether a model obeys it is unmeasured**,
and the two must not be reported as one. §6 already records the honest limit: the boundary is
prompt-enforced above the structural read-only floor.

⚠️ **The `ExplainSession` and `ExplainPanel` wiring is not spec-covered** — both reach the AI client
and `ProjectModel`, so neither is reachable from the plain-Node runner. The seam that *is* covered is
`tutorOverlay` → `systemPrompt`. **A drive is owed** and belongs with the §5 run, which needs a
lesson open in a real editor anyway.

## Not in v1

Tier-2 live AI tutoring inside lessons — ⚠️ **partly landed 2026-08-16**: the phase-17 tutor
*overlay* is built (above), so what remains of that track is §5's live adversarial run and the
register/accuracy tuning §6 defers to it. Also: certification, community-authored lessons on the
platform (the format allows it; the publishing surface waits), chaptered replay links from nodes.
