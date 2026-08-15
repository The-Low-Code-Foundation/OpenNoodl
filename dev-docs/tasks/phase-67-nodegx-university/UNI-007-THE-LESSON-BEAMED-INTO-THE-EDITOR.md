# UNI-007 — the lesson beamed into the editor

**Surface:** all three · **Tier 2 (the differentiator)** · **Effort:** L · ✅ **UNBLOCKED — D5 ruled
2026-08-14**; ~~D12~~ 🔴 **struck 2026-08-14 — already ruled**

> ## 🟡 Slices 1–3 are BUILT (2026-08-14 third + fifth sessions, 2026-08-15 sixth)
>
> No platform, no account. Slice 3 adds the first UI, **driven in the real editor**.
>
> | Shipped | Where |
> |---|---|
> | **The static two-vocabulary check** — the format contract's own gate, and the one blocker of §11's three that survived the fact-check | [`models/lessonverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonverify.ts) |
> | **The grading runner — both engines, kept apart structurally** | [`models/lessongrading.ts`](../../../packages/noodl-editor/src/editor/src/models/lessongrading.ts) |
> | ✅ **Engine 2's MCP adapter** (slice 2) — validity via `validate_project`'s own call, "did it draw" via the render harness | [`noodl-mcp/src/lessons/wholeSolutionGrader.ts`](../../../packages/noodl-mcp/src/lessons/wholeSolutionGrader.ts) |
> | ✅ **The Learning folder register** (slice 3a) — install / reset / progress / grade, D5's guarantees made structural | [`models/learningfolder.ts`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) |
> | ✅ **The launcher's Learning section** (slice 3b) — cards, install route, reset | [`noodl-core-ui/.../components/LearningSection/`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/LearningSection/LearningSection.tsx) + [`projectsview.learningstate.ts`](../../../packages/noodl-editor/src/editor/src/views/projectsview.learningstate.ts) + `ProjectsPage.tsx` |
> | **131 tests**, `tests-unit/uni-007/` | jest / **`test:main`**, not the electron suite — see below |
> | 21 tests, against **real recorded renders** | `noodl-mcp` jest — ⚠️ **not in `test:ci`**, run `npx jest` in that package |
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
> - 🔴 **NOTHING CALLS THE GRADING RUNNER. This is the next slice and it is the only one left in
>   the editor.** Proved rather than assumed: `__webpack_require__` in the running renderer answers
>   *"Cannot find module `./src/editor/src/models/lessongrading.ts`"* — the runner is **not in the
>   bundle at all**, because no editor module imports it. The Learning folder gave the *register* a
>   caller; the runner still has none. "Check my work" is that caller.
> - 🔴 **Nothing writes a grade back.** `recordGrade` works and is driven, but only a test harness
>   has ever called it. Same missing button.
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

1. Intake → path: two learners with different intakes (visual-logic vs function-node) receive
   visibly different paths from the same spine; the projection for one (learner, concept) pair
   makes exactly one model call ever (the cache spec — Loom's proven guarantee, re-proven here).
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

## Not in v1

Tier-2 live AI tutoring inside lessons (the phase-17 tutor overlay work remains its own track),
certification, community-authored lessons on the platform (the format allows it; the publishing
surface waits), chaptered replay links from nodes.
