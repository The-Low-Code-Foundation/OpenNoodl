# UNI-010 — a tutorial your own Claude can write

**Surface:** editor + MCP (no platform dependency — that is the point) · **Tier: experiment**
· **Effort:** M (after UNI-007's format exists) · ✅ **D5 RULED 2026-08-14** · still needs UNI-007's
lesson format and grading runner (criteria 3 and 4 there are this task's prerequisites)

> **D5 makes this task's premise literally true** ([RULINGS.md](RULINGS.md)). The Learning section
> is a **visible launcher section written by the editor process** — so a lesson the user's own
> Claude authors locally lands in exactly the same place, through exactly the same writer, as one
> pulled from the platform, **with no account and no platform involved**. "No platform dependency —
> that is the point" is now a ruling, not an aspiration.
>
> 🔴 **The verifier gets sharper: `Array` and `Object` must be REJECTED, not substituted.**
> Re-verification against `node-catalog.json` on 2026-08-14 found that two of the nine display names
> are **ambiguous** — `Array` maps to both `Collection` and `Collection2`, and **`Object` maps to
> both `Model` and `Model2`** (recorded as `Model2` alone until now). A freely-authoring model
> reaching for a display name therefore risks more than a silent no-match: an ambiguous name can
> resolve to the **wrong one of two**, which is class **F3** — the class the prior arc predicted
> *"nobody expects to see and is worst when it appears"*, and the class this task's own ruling made
> mandatory verifier work. **The static check must reject these two rather than auto-correct them**,
> because there is no single right substitution to make.

> ## 🟡 SLICE 1 BUILT 2026-08-15 — the harness (F1–F4), the deliverable that outlives the experiment
>
> Commit `90776d8b`. **46 tests** in `noodl-editor/tests-unit/uni-010/` (jest / `test:main`).
> No platform, no account, no model call.
>
> | Shipped | Where |
> |---|---|
> | **The file-backed evaluation context** — grades lesson conditions against project files, with no editor at all | [`models/lessonprojectcontext.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonprojectcontext.ts) |
> | **The F1–F4 scorecard** — replay, ghostwriting, decoy, render | [`models/lessonbundleverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleverify.ts) |
> | **The bundle reader**, including the `solution/` the bargain requires | [`models/lessonbundleread.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleread.ts) |
>
> **Acceptance criterion 1 is met for the four machine-detectable classes** — one deliberately-broken
> bundle per class, each refused with a sentence naming what to change. F1 reuses the shipped
> `verifyLessonManifest` (not a fork); F2, F2′ and F3 are new; F4 is engine 2 injected as a port.
>
> ### 🔴 The bundle format gains one thing, and it is the price of the ruling
>
> **A bundle carries its own solution, at `solution/`.** Without it there is no replay, no decoy and
> no render — three of the four checkable classes go dark, and the gate that was traded for §3.1's
> structural guarantee is not actually there. Hence `installable` is a *separate* field from `ok`: a
> bundle where nothing failed **because nothing was checked** is not a bundle that passed. ⚠️ A
> curated bundle may legitimately have no solution; the reader says so and lets the caller decide.
>
> ### 🔴 What building the caller found — the fourth and fifth time in this phase
>
> The harness read complete on its own terms. Running it over the **real slice-4 drive bundles**
> changed two things:
>
> **1. F3 had to become two findings.** The decoy test asks "would this survive a second node of the
> type it addresses?", and for almost any `%Type` segment carrying a specific assertion the answer is
> no. Reported as an error that **fails essentially every sound lesson** — `App:%Page:#Greeting` names
> the page by type because that is how a page component is shaped, and a hypothetical second Page is
> not a defect. 🔴 *A gate that rejects the correct answer is worse than no gate, and it fails in the
> one direction this module is most obliged to avoid.* §3.2's binding is narrower and is the right
> line: permitted *"only where the graph guarantees exactly one node of that type"*. So **error** when
> a second candidate already exists in the starter or the solution, **warning** when exactly one does.
>
> ⚠️ **The solution is what makes the error case reachable**, and that is the neat part: the solution
> is the graph *after every step*, so a lesson that itself instructs the learner to add a second Text
> has two Texts in its own answer. That is exactly where F3 was predicted to appear, and it is caught
> by comparison rather than by guesswork.
>
> **2. The scorecard was flattening its own F1 codes.** Every static error mapped onto one opaque
> code. It reads fine to a human — the message survives — and it destroys the deliverable: LEARN-009
> is a *regenerable per-lesson score*, and a run that cannot say which F1 defect it hit cannot answer
> the arc's own pre-registered prediction about which class dominates.
>
> ### ✅ The context agrees with the live editor, which is the fidelity claim actually tested
>
> Run over `bundle-good` with the starter substituted for the solution, the harness reports **steps 2
> and 4 failing and step 3 passing** — the *same per-step verdicts the slice-4 drive measured through
> the UI*. The context is not a paraphrase of the evaluator; it feeds the real one.
>
> 🔴 **Two shortcuts would have broken that, and both were live.** A condition's first path segment
> matches the component's **legacy name**, which is not its directory — this repo's own bundle has
> `components/__page__/Home` named `/#__page__/Home`. And a stored node serialises only its *dynamic*
> ports, so `hasPort: "text"` — true of every Text node in the editor — reads false from the file
> alone. Either one makes the harness report correct lessons as defective, which is the single output
> a gate must never produce.
>
> ⚠️ **A side finding worth carrying:** `%Text` in the drive bundle's own step 2 fails because the
> Text sits *inside* the Page — a well-formed, correctly-spelt, real-type path that is one level too
> shallow. [RULINGS.md](RULINGS.md) records depth as the boundary the *static* check cannot reach
> ("the verifier has no project"). **A solution replay reaches it**, and this is the class of defect
> that motivates carrying one.
>
> ### ⚠️ What is NOT built
>
> The **`create_lesson` MCP surface** — the authoring brief and the validating install tool — and the
> **provenance-labelled install** that runs this scorecard rather than only `verifyLessonManifest`.
> 🔴 `LearningFolderModel.install()` still gates on **F1 alone**, so an AI-authored bundle installed
> today gets the static check and nothing else. Criteria 2 and 3 are slice 2's.
>
> ✅ **Both closed by slice 2 (below).**

> ## 🟡 SLICE 2 BUILT 2026-08-15 — the gate is collected, and the surface exists
>
> **`create_lesson` / `check_lesson` / `get_lesson_brief`** in `noodl-mcp`, and
> `LearningFolderModel.install()` now runs the whole F1–F4 scorecard instead of the static check
> alone. 28 new tests (16 editor-side in `tests-unit/uni-010/`, 12 in `noodl-mcp`).
>
> | Shipped | Where |
> |---|---|
> | **The install policy** — which classes each provenance must have *passed* | [`models/lessoninstallpolicy.ts`](../../../packages/noodl-editor/src/editor/src/models/lessoninstallpolicy.ts) |
> | **The install gate**, widened from F1 to the scorecard; `install()` is now `async` | `models/learningfolder.ts` |
> | **The authoring brief** — the format, the path grammar, the whole condition vocabulary | [`noodl-mcp/src/lessons/authoringBrief.ts`](../../../packages/noodl-mcp/src/lessons/authoringBrief.ts) |
> | **Score-then-write** — the bundle assembler that writes nothing unless it passed | [`noodl-mcp/src/lessons/bundleWriter.ts`](../../../packages/noodl-mcp/src/lessons/bundleWriter.ts) |
> | **The three tools**, a deferred `lesson` tool group | [`noodl-mcp/src/tools/lessonTools.ts`](../../../packages/noodl-mcp/src/tools/lessonTools.ts) |
>
> ### 🔴 The hard problem was D5, and the answer is an asymmetry
>
> The sidecar must not write launcher state, so `create_lesson` writes a **folder** and the learner
> installs it through the launcher's ordinary picker. That picker passes `local` — pointing at a
> directory says nothing about who wrote what is in it — so the obvious question is how the editor
> ever applies the stricter AI gate. Slice 3 had assumed "the editor will have watched the MCP write
> it". **It does not, and there is no channel that would let it.**
>
> The way out is that slice 3's own rule is asymmetric and nobody had noticed. Provenance is the
> caller's word *because a bundle declaring itself `curated` would be believed* — but declaring
> `authoredBy: "ai"` **spends** trust rather than buying it: it moves the bundle from a one-class
> install gate to a three-class one.
>
> > 🔴 **A claim may only tighten.** A liar has no motive to make itself less trusted, so the one
> > direction that costs the claimant is the one direction it is safe to honour.
>
> One optional manifest field, one pure `resolveProvenance`, and the MCP route works through the
> existing dialog with **no new plumbing, no IPC and no bridge** — and D5 is untouched, because the
> sidecar wrote a folder and the editor process wrote the register.
>
> ### 🔴 The gate is a policy TABLE, not slice 1's `installable` — because the editor cannot answer F4
>
> Gating install on `installable` ("every class checked and passed") was the obvious move and it is
> wrong, for a reason only building the caller showed: **nothing in a packaged editor can render a
> solution directory.** Engine 2's editor adapter drives the *running viewer*; the sidecar's spawns
> the render harness out of `scripts/`, which is not in `build.files`. So `installable` is
> unreachable in the shipped editor, and gating on it would mean **no AI-authored lesson could ever be
> installed** — the fourth amendment's failure, one slice later, in the module that recorded it.
>
> So `REQUIRED_CLASSES` is keyed by provenance — `curated`/`org`/`local` → F1; `local-ai` → F1, F2, F3
> — plus one rule that holds for everyone: **a `fail` in any class blocks**, which also makes curated
> bundles better checked than slice 3 left them.
>
> ⚠️ **F4 is required of nobody at install, and that is a recorded hole rather than a shrug.** It is
> the class the prior arc predicted would *dominate*, and it is answered by the **producer**
> (`create_lesson` has the harness and refuses to write without it, unless `allow_unrendered` is
> passed by name) and not by the installer. A bundle a model hand-writes with its own file tools and
> installs directly therefore reaches a learner with F4 unchecked. If the editor ever gains the
> capability, the test named for this is what changes.
>
> ### 🔴 What building the caller found this time: a lazy `require` defers execution, not resolution
>
> The fifth instance, and unlike the other four it is not about a check at all.
>
> UNI-007 moved `ProjectModel` and `NodeGraphContextTmp` out of module scope in
> `views/lessons/lessonevalconditions.ts` and into a `require` **inside** `liveLessonEvalContext()`,
> with the reason recorded in the file: *"this is what makes 'the same verifier, not a fork'
> achievable: UNI-010 runs this runner inside an MCP sidecar with no renderer around it."*
>
> That claim was true of jest, which never evaluates the branch, and **false of the sidecar, which is
> bundled.** esbuild resolves a `require()` with a literal path wherever it sits, so the first import
> from `noodl-mcp` pulled in `projectmodel` → the node graph → React → `.scss` and `.svg`, and the
> build failed outright. Three slices rested on the claim because nothing had ever tried to bundle it.
>
> > 🔴 **"Loadable in plain Node" and "safe to bundle" are two different properties**, and the trick
> > that buys the first buys none of the second. The check is to build it, not to read it.
>
> Fixed by the split the repo already had a convention for:
> [`lessonevalconditions.live.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.live.ts),
> beside `lessonwholesolution.live.ts`. `lessonevalconditions.ts` now reaches no editor singleton by
> any route a bundler can follow, which is what the original note claimed and did not have.
>
> ### 🔴 A second gate that could not report its own margin
>
> Adding a deferred tool group tripped AWP-006's 8,200-token surface budget. Measured, same fixture:
>
> | surface | tokens |
> |---|---|
> | **UNI-010 entirely absent** | **8,198** — *two* tokens under the bar |
> | + the `lesson` catalogue entry and `find_tools` enum value | 8,206 |
> | + its one-line `purpose` | **8,223** |
>
> LEG-001 raised that bar to 8,200 and wrote down that it was banking 58 tokens of slack. **56 of them
> had been spent** by work that never knew it was spending them, because `expect(tokens <= BUDGET)`
> says nothing at 8,197 and nothing at 8,199 — *it reports the crossing and never the approach*. The
> first person told is the one who runs out. Raised to 8,280 with the measurements written down.
>
> ⚠️ And the group exposed a live staleness bug on the way in: `find_tools`' `group` argument was a
> **hand-written `z.enum`**, so the new group was advertised in the tool's own description and
> rejected by its schema. Now derived from the manifest.
>
> ### ✅ The brief's examples are typed values, not prose
>
> Every condition the brief shows is a real `LessonConditionDef` in `CONDITION_EXAMPLES`, rendered
> into the text, and the spec compiles all eleven through the real `compileConditions`. The worked
> manifest is likewise run through the harness and asserted to pass all four classes. A brief whose
> own example the gate would refuse is worse than no example — and *a doc that lies has examples that
> lie too* is a trap this repo has already paid for.
>
> ### ⚠️ What is still NOT built
>
> - **Criterion 2's end-to-end drive.** The provenance plumbing exists and is unit-tested; nobody has
>   yet installed an MCP-written bundle through the real launcher and watched the AI-authored label
>   appear. That is the next drive, and its consequence list has to include something only the AI
>   route could satisfy.
> - **Criterion 3 — the five-lesson run.** Not started.
> - **Two projects, one bound server.** `create_lesson` takes two project *directories*, so the
>   authoring model has to produce the starter and the solution itself. The MCP binds one project, so
>   in practice it authors the solution with the write tools and builds the starter alongside it. This
>   works and it is not ergonomic; a `derive_starter` step is the obvious slice-3 candidate.

> ## ✅ CRITERION 2 DRIVEN 2026-08-15 (tenth session) — and the F4 hole is bigger than slice 2 recorded
>
> Eight consequences written down **before** the producer was run and before the editor was
> launched, each phrased so it could not also be true of a broken feature. **Eight of eight passed**
> — and the drive turned up one finding that changes what slice 2's own mitigation is worth.
>
> ### The artifacts, and why there are four of them
>
> `writeLessonBundle` — `create_lesson`'s implementation — was run over two real project
> directories derived from the slice-4 drive project (a starter with a bare page, a solution with
> `Text#Greeting` and `Variable2#Counter`). Everything downstream was derived from its output by
> deleting things, so no arm is a separately-authored bundle that could differ by accident.
>
> | Bundle | `authoredBy` | `solution/` | Outcome at the launcher |
> |---|---|---|---|
> | `bundle-ai` | `"ai"` (**stamped by the producer**) | yes | installed · card reads **"Written locally"** |
> | `bundle-twin` | *line deleted* | yes | installed · card reads **"From disk"** |
> | `bundle-stripped-ai` | `"ai"` | **no** | 🔴 **REFUSED**, naming F2 and F3 |
> | `bundle-stripped-noclaim` | *line deleted* | **no** | installed · **"From disk"** |
> | `bundle-claims-curated` | `"curated"` | yes | installed · **"From disk"** — the claim ignored |
>
> 🔴 **The bottom pair is the result.** `diff -rq` says the two directories differ in one file, and
> `diff` says that file differs by one line — and **one is refused while the other installs.** That
> is the asymmetry's *bite*, not just its label: the three-class gate genuinely rejects a bundle the
> one-class gate accepts. A feature that ignored `authoredBy` would have installed both; one that
> believed the manifest outright would have refused neither.
>
> ⚠️ **The label pair alone would not have shown this**, and a first draft of this write-up said
> "install vs refusal" while describing it. The slice-3 author read that summary, found it
> internally inconsistent, and asked. *The evidence you show is a summary of the evidence you have,
> and the gap between them is where wrong conclusions live.*
>
> ### What was driven versus what was faked
>
> The **only** thing stubbed was the OS folder picker's return value
> (`filesystem.openDialog`). The real "Install a lesson…" button was clicked, so the shipped
> handler ran untouched — including its `provenance: 'local'` argument, `resolveProvenance`, the
> whole scorecard, the register write, the toast and its console line
> (`[Learning] Checked as local-ai: F1, F2, F3 passed; F4 not checked.`).
>
> ⚠️ **The stdio transport was NOT driven.** Richard's registered MCP servers still run a
> pre-slice-2 build — confirmed rather than assumed: `find_tools`' group enum is
> `backend|docs|explore|project|theme`, with no `lesson`. What ran is the same
> `writeLessonBundle`, one call below the transport. **`create_lesson`-over-MCP remains untested
> end to end**, and that is the honest boundary of this drive.
>
> ### 🔴 The finding: the producer can only answer F4 *from a checkout*
>
> Slice 2 recorded F4 as "a hole at the installer, answered by the producer". Running the producer
> found the mitigation is narrower than that sentence:
>
> ```
> The render harness is not present in this installation — render_report needs the repo checkout
> (scripts/devtools/measure-from-disk.js). Set NODEGX_RENDER_CLI to it, or run this server from a
> checkout.
> ```
>
> With `NODEGX_RENDER_CLI` pointed at the checkout, F4 **passes** and the bundle writes with all
> four classes green. Without it, `create_lesson` refuses unless `allow_unrendered` is passed.
>
> 🔴 **And UNI-007 had already written down why that matters, one slice earlier**, about this exact
> file: *"`scripts/` is not in `package.json`'s `build.files` … so that route works in this checkout
> and is dead for every real learner."* Join the two sentences and the real position is:
>
> > **For a user running the packaged sidecar, F4 is checked by nobody.** The installer cannot (the
> > editor drives the running viewer), and the producer cannot either (the harness it spawns is not
> > shipped). F4 is the class the prior arc predicted would **dominate**.
>
> ⚠️ Nobody had joined them because each statement was true and local to its own slice. **A hole
> recorded in two halves, in two files, is not a recorded hole** — it reads as covered from either
> end. This is the sixth "build the caller" instance and the first where *the evidence was already
> written down and merely unassembled.*
>
> **Not fixed here**, because the fix is a scope decision rather than a bug: either ship the harness
> with the sidecar, or have `create_lesson` say plainly that a packaged install cannot answer F4 and
> that `allow_unrendered` is the normal case rather than the exception. **Richard's call** — flagged
> rather than taken.
>
> > 🔴 **NEW INPUT to that call, 2026-08-15: phase 69 / CN-001 is about to rewrite this same file.**
> > [CN-001](../phase-69-the-node-you-write-yourself/CN-001-THE-EYES-MUST-SEE-KITS.md) (tier 0, effort
> > S, no rulings attached) fixes a *different* defect in `render-from-disk.js` — it hardcodes two
> > module stylesheets and never calls `injectIntoHtml`, so a project using a custom node renders
> > blank. Its chosen fix is to **extract the pure half into a no-build workspace package** on the
> > `@nodegx/render-measure` pattern, which is precisely the shape of option one above. **CN-001 does
> > not close this hole** — `scripts/` is still outside `build.files`, and an injector cannot help a
> > file that never shipped — but it does most of the structural work, so the two decisions are worth
> > taking together rather than separately.
> >
> > ⚠️ **And an ordering constraint on criterion 3:** CN-001 changes the instrument F4 is scored with.
> > Do not let the five-lesson run straddle it. Finish criterion 3 first, or land CN-001 first and
> > score all five afterwards — **and record which**, because a split dataset is not a ≥3-of-5 result.
> > Lesson projects use no kits today, so nothing already measured is wrong.
>
> ### ✅ Two more things the drive established
>
> - 🔴 **The harness refuses a lesson whose steps are already done in the starter.** Building a
>   control whose project *was* the solution, install was refused: *"This step is already complete in
>   the project the learner opens, so it will tick itself the moment they arrive."* This is the trap
>   UNI-010 most needs, because **the natural way to author a lesson is to build the finished thing
>   and describe it** — at which point the starter you ship *is* the solution. A model told "write me
>   a lesson" has every reason to return exactly that.
> - ✅ **Grading does not depend on provenance, measured rather than assumed.** The AI arm and the
>   non-AI twin — identical steps, same starter — produced the *same sentence*: *"0 of 2 checked
>   steps are done. Step 2 … Your app renders — 1 elements drawn."* And it is not a constant:
>   adding `Text#Greeting` to the AI arm's live graph moved it to **1 of 2 and 2 elements drawn**,
>   both engines moving on the same edit.
>
> ### 🔴 The one code change: the asymmetry's precondition is now executable
>
> Raised by the slice-3 author reviewing slice 2: honouring `authoredBy: "ai"` is safe **only while
> `local-ai` is strictly the most demanding row** in `REQUIRED_CLASSES`. Any future AI fast-path —
> *"the producer already scored F2, skip it at install"* — reverses the incentive and makes the field
> worth forging, **and it would arrive in review looking like an optimisation.**
>
> Two specs now hold it (`tests-unit/uni-010/lessoninstallpolicy.test.ts`), and the guard was proved
> to bite rather than assumed to: setting `'local-ai': ['F1']` fails five tests, including the new
> superset one; reverting passes 18/18. ⚠️ Honest note — only the **structural** superset test
> catches that mutation; the behavioural twin beside it guards a different regression (a provenance
> branch inside `decideInstall`) and stays green through it. Two tests, two failure modes, neither
> redundant.
>
> ### ⚠️ One measurement I spoiled, recorded rather than quietly dropped
>
> D5 says a lesson must never enter the recents list. I backed up
> `recently_opened_project.json` before launching, compared after, found it **differed**, and
> restored it — **before diffing the entries**, so I cannot say whether the difference was my
> lessons or ordinary launcher churn. What I *can* say is that the restored file (which already
> contained slice 4's lesson opens) has **zero entries referencing the Learning folder**, so the
> guarantee held across those. **The next drive should diff the entry ids before restoring.**

> ## ✅ SLICE 3 — §8.1 CLOSED 2026-08-16 (`eff91029`): F4 now reads the render's findings
>
> The criterion-3 run's first finding, and the one it named *"the difference between UNI-010 being
> an experiment that passed and a feature that can ship"*. Full write-up:
> [UNI-010-CRITERION-3-RUN.md](UNI-010-CRITERION-3-RUN.md) §8.1 and §12.1. **14 new specs**
> (`test:main` 205 / **3171**, up from 3157; `noodl-mcp` 44 / 510).
>
> **What was wrong.** F4 failed on `!valid` or `!rendered`, and `rendered` is `drawnElementCount > 0`.
> A lesson whose row component declared `dynamicports` where the editor reads `ports` had no
> interface, so its Repeater stamped three rows of the literal word `"Text"` beside one real
> heading — four drawn elements, F1–F4 all pass, written. The harness's own
> `dead-placeholder-text` **error** was in the same payload, as a **string** in
> `WholeSolutionResult.findings`, and `findings` did not participate in the verdict.
>
> 🔴 **The shape of the defect is worth keeping, because it is not "the gate was too lenient".** F4
> already refuses to accept "no errors" as evidence — that is the "clean can mean EMPTY" discipline,
> and it was working. What let the bundle through is that the drawn count is a **project-level**
> number, so **one working element vouched for every broken one beside it.** The information needed
> to catch it was already in the payload; the rule could not reach it because it had been flattened
> to prose one layer earlier.
>
> | Shipped | Where |
> |---|---|
> | **`renderDefectCodes()`** — the second shared rule, beside `countDrawnElements` | [`models/lessondrawncount.ts`](../../../packages/noodl-editor/src/editor/src/models/lessondrawncount.ts) |
> | **`WholeSolutionResult.renderDefects`** — the field the codes survive in | [`models/lessongrading.ts`](../../../packages/noodl-editor/src/editor/src/models/lessongrading.ts) |
> | **F4's new verdict**, `solution-renders-broken` | [`models/lessonbundleverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleverify.ts) |
> | Both engine-2 adapters reporting it | `models/lessonwholesolution.ts`, `noodl-mcp/lessons/wholeSolutionGrader.ts` |
>
> 🔴 **It reads severity, not a list of codes.** Naming `dead-placeholder-text` alone would leave
> `empty-list`, `broken-image` and `content-not-visible` — all `error` in the harness today — in the
> identical hole, and would exclude whatever it grows next. `blank-render` is excluded because
> `rendered` already answers it: one defect, one accusation.
>
> ⚠️ **`renderDefects` absent means "not reported", never "none found"** — the same distinction
> `drawnElementCount` draws, with the same consequence: an adapter that stays silent opts itself out.
> `normaliseWholeSolutionResult` will not invent it, because an invented empty list turns every
> silent adapter into a clean bill of health.
>
> ### ✅ Graded as a control pair, which is the only grade that means anything here
>
> The finding was *"two scorecards that should differ are identical"*, so a single broken case would
> have proved nothing — it passes against a gate that has started failing everything. Two arms:
>
> - **The new specs re-run with the new branch disabled: 3 fail, all 25 pre-existing pass.** The
>   branch is the only thing that moved.
> - **Pinned on recorded renders, not invented ones.** `phase55-replay-haiku` — a real capture that
>   draws 68 things, several of them the word "Text" — now reports
>   `['dead-placeholder-text', 'broken-image']`; `phase55-replay-sonnet`, the build phase 55 calls
>   correct, still reports `[]`; `ecommerce-example`'s `minimum-layout-width` **warning** is not a
>   defect and must not become one.
>
> ### ⚠️ The scope call inside it: the learner's surface changed its SENTENCE, not its verdict
>
> `summariseGrade` printed *"Your app renders — 4 elements drawn, with no blocking problems"* over
> the identical evidence. That sentence is now honest. **The completion verdict is untouched, and
> deliberately so:** the authoring gate grades a *finished* solution, while a learner is mid-build
> and a placeholder they have not filled in yet is what progress looks like. Failing them on these
> codes would be the same "a gate that rejects the correct answer" mistake F3's first draft made,
> pointed at the one person who cannot argue with it. Two specs hold the pair — the sentence must
> change, the `complete` flag must not.
>
> ### 🔴 Still open, and this does not touch either
>
> - **§8.2** — F4 renders only the Router's `startPage`, so a defect anywhere else is invisible
>   *including to this new check*, which can only see what was rendered. Belongs to phase 69's
>   CN-001 (upstream: `render_report` has the same blind spot).
> - **The F4 packaged-install scope call is still Richard's.** `scripts/` is not in `build.files`, so
>   on a packaged install F4 is checked by nobody — and a sharper F4 that never runs is still a
>   sharper F4 that never runs.

## Premise

Added 2026-08-14: for people who don't want the University platform at all, let **their own
Claude Code** author a tutorial lesson — an MCP instruction set + tool that teaches the model
how to write a lesson bundle, which lands in the same Learning folder with the same step-by-step
UX and the same grading. Personalisation at **zero platform cost** (the learner's own
subscription pays), fully offline from our servers, and a free test bed for the lesson format.

Richard's own doubt, verbatim: *"is it still too risky that the LLM makes a mistake and the
tutorial it makes gets stuck or teaches the wrong thing?"* This task exists to answer that
empirically, and its design splits the risk in two:

- **"Gets stuck" is machine-catchable.** A lesson bundle is only *installed* if it passes the
  verifier: every step's completion condition is satisfiable by that step's own solution state,
  each intermediate state validates, and the final solution passes `validate_project` +
  `render_report` with real pixels drawn (the "clean can mean EMPTY" lesson applies — assert
  drawn output, not just no-errors). Generate-then-verify, exactly like grading a student. A
  lesson that can't be completed by replaying its own steps never reaches the Learning folder.
- **"Teaches the wrong thing" is not machine-catchable** — no gate grades pedagogy. Mitigations,
  not guarantees: the MCP instructions embed the LEARN-002 spine + tutor-boundary material so
  the model projects from curated concepts rather than inventing doctrine (Loom's closed-palette
  idea applied to pedagogy); the lesson template constrains shape (concept → guided steps →
  check); and every AI-authored lesson is **provenance-marked** in the bundle and *visibly
  labelled* on its Learning-folder card — never presented as curated NodeGX curriculum.

## 🔴 Ruling 2026-08-14 — free authoring stands, the verifier pays for it

This task duplicates an already-specced arc:
**[LEARN-007…010](../phase-17-noodl-learn/EXPERIMENT-GENERATED-LESSONS.md)** (specced 2026-08-02,
open questions answered 2026-08-09). Its §3.1 is written as binding: *"The model fills slots. It
never authors predicates… A task in this arc that has the model emitting `completeWhen` directly
has misread this section."* UNI-010's premise is the opposite.

Put to Richard as a direct conflict, 2026-08-14. **Ruling: the model may author conditions — and
in exchange the verifier must absorb the full F1–F6 taxonomy, not F2 alone.**

The bet, stated honestly: §3.1's guarantee was *structural* (a condition never generated cannot be
wrong); this replaces it with a **gate**, so the gate carries all the risk and every class it
misses reaches a learner.

| | Class | What it is | How this task must detect it |
|---|---|---|---|
| **F1** | Unreachable | condition names a node type or port that doesn't exist | **static** vs `node-catalog.json` — and see the vocabulary trap below |
| **F2** | Dead on solution | conditions never fire against the lesson's own solution | deterministic replay — *the only class v1 covered* |
| **F3** | Ambiguous address | condition resolves to the **wrong node** when several candidates exist | **decoy graph**: add a second plausible node, assert it still resolves to the intended one |
| **F4** | Empty preview | sample-data keys miss the bindings, so nothing renders | **render and assert drawn output** — 🔴 "clean can mean EMPTY"; absence of errors is not evidence |
| **F5** | Variant-blind | conditions fail a legitimate *alternative* correct solution | **humans only** — the five-lesson run |
| **F6** | Text–graph divergence | prose asks for what conditions don't check, or vice versa | **human read** |

The prior arc's pre-registered prediction, which this task should be scored against: *"F4 (empty
preview) is the top defect. F3 is the one nobody expects to see and is worst when it appears."*
**v1 as written gated on the class predicted least common and omitted both predicted worst.**

### 🔴 The two-vocabulary trap makes F1 load-bearing here

[LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md) documents a **silent** failure:
prose must use a node's **display name**, conditions must use its **type name**, and nine of them
differ — `Repeater`→`For Each`, `Static Array`→`Static Data`, `Delay`→`Timer`, `Array`→`Collection`,
`Insert Object Into Array`→`CollectionInsert`, `Object`→`Model2`, `Record`→`DbModel2`,
`Page Router`→`Router`, `Repeater Item`→`For Each Actions`. A condition naming a display name
matches nothing and *tells the learner they failed a step they completed* — precisely the
"tutorial gets stuck" risk, and a freely-authoring model will reach for the picker's names.
The static check must reject display names outright.

### Two constraints that survive the ruling as authoring guidance

They were *findings*, not preferences, and nothing now enforces them structurally — so the MCP
brief must teach them and the human read must look for them:

- **§3.2 — address by `#label`, not `%Type`.** `findNodeWithPath` returns the **first** match at
  each path segment, so type-only addressing on a learner's own project is a lottery.
- **§3.3 — binding keys come from the pattern, values from the theme.** A model inventing sensible
  data with the wrong field names renders an empty box (this is F4's cause).

## Scope (v1 — an experiment with a kill switch)

- A `create_lesson` surface in the local MCP: instructions (the how-to-author brief: format,
  pedagogy constraints, worked example) + a validating install tool that runs the verifier and
  writes the bundle via the editor process (🔴 never writing launcher state from the sidecar).
- The verifier itself — shared with UNI-007's runner, not a fork.
- Provenance + labelling end to end (bundle field → card badge).
- **The test Richard wants:** ask Claude Code for, say, "a lesson on wiring a For Each to
  Static Data, assuming I know JavaScript" — then take the lesson as a learner. Grade the
  experience honestly: did the verifier catch the broken drafts? Was the surviving lesson
  worth taking?

## Kill / keep criteria (pre-registered, so the experiment can fail honestly)

- **Kill** if the verifier passes lessons that still routinely dead-end in human hands, or if
  authoring reliability is so low the verifier rejects nearly everything (the format is too
  hard for the model — fix the format or the brief before shipping the feature).
- **Keep** if ≥ 3 of 5 test-generated lessons install and are completable + worth completing —
  then this graduates from experiment to shipped feature, and becomes the org story's cheap
  end too (a teacher's Claude authoring class-specific lessons onto UNI-005's shelf).

**Reconciled with the prior arc (2026-08-14):** LEARN-009's harness output is the *evidence*
(F1–F4 scored mechanically, per-lesson, regenerable); UNI-010's ≥3-of-5 is the *decision rule*.
The harness was always designed to outlive its experiment — *"it becomes the gate any future
generated lesson passes before a learner sees it"* — which is already UNI-007's "same verifier,
not a fork" requirement. Build it once, here.

## Acceptance criteria

1. A deliberately-broken bundle is refused with a diagnostic the authoring model can act on — the
   refusal *writes* its reason (the phase-64 lesson: grade a refusal by what it wrote). **Per the
   2026-08-14 ruling this needs one deliberately-broken bundle per machine-detectable class, not
   one overall:** F1 (a condition naming `Repeater` instead of `For Each`), F2 (unsatisfiable step
   condition), F3 (a condition that resolves to a decoy node), F4 (sample-data keys that miss the
   bindings, so the solution renders nothing).
2. A valid bundle installs, shows the AI-authored label, and grades identically to a
   platform-authored lesson through UNI-007's runner.
3. The five-lesson test run is performed and written up against the kill/keep criteria.

## Not in v1

Sharing AI-authored lessons to other users or the platform shelf (curation questions belong to
a later tranche), auto-repair loops where the MCP re-prompts the model, non-Claude clients
(the MCP is client-agnostic by nature; we only *test* with Claude Code).
