# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (thirteen rulings, **and Blocker 1's four amendments** —
the fourth is from 2026-08-15 and is the *mirror* of the other three), then
`UNI-010-A-TUTORIAL-YOUR-OWN-CLAUDE-CAN-WRITE.md` (its header records slice 1), then
`UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md`, then `TASKS.md`.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue is EMPTY. Nothing is blocked on a decision.** Do not re-litigate D1–D13 — if
one is wrong, amend `RULINGS.md` with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; **NodeGX University is its learning wing**. Editor
  button: **"Sign in to NodeGX"**. ⚠️ `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**. 🔴 **The editor
  process writes it** — never a sidecar, never the platform.
- **D9** — 🔴 ruled *against* the recommendation: a record-capped backend means UNI-008 holds
  end-user data. Five obligations; effort raised; still last.
- **D13** — coaching delivery (**LearnBook**) is **phase 68**, platform stack, after Tier 1 + UNI-004.

## 🎉 UNI-010 slice 1 is BUILT — the F1–F4 harness (`90776d8b`, docs `0a1310e8`)

The 2026-08-14 ruling let a model author `completeWhen` directly and priced it exactly: *free
authoring stands, and in exchange the verifier must absorb the full F1–F6 taxonomy.* A structural
guarantee was traded for a gate. **Slice 1 is that gate.**

| Class | What answers it | Where |
|---|---|---|
| **F1** unreachable | the shipped `verifyLessonManifest` — reused, not forked | `models/lessonverify.ts` |
| **F2** dead on solution | replay the conditions against the lesson's own answer | `models/lessonbundleverify.ts` |
| **F2′** ghostwritten | replay against the **starter** — §3.5's line | same |
| **F3** ambiguous address | decoy injection + already-ambiguous comparison | same |
| **F4** empty preview | engine 2, injected as a port | same (adapter is `noodl-mcp`) |

Plus **`models/lessonprojectcontext.ts`** — a `LessonEvalContext` built from project *files*, with no
editor at all — and **`models/lessonbundleread.ts`** — the bundle on disk.
**46 tests** in `noodl-editor/tests-unit/uni-010/` (jest / `test:main`).

🔴 **The bundle format gains one thing: a bundle carries its own solution, at `solution/`.** Without
it F2, F2′, F3 and F4 all go dark and the gate that was traded for §3.1 is not actually there. Hence
`installable` is a **separate field from `ok`** — a bundle where nothing failed *because nothing was
checked* is not a bundle that passed. A curated bundle may legitimately have none; the reader says so
and lets the caller decide.

## 🔴 What slice 1 found, because it is the thing to carry forward

**A gate can fail in the other direction, and that direction is worse.** All four previous
"building the caller" findings in this phase were one shape: *a check that did not catch enough.*
This one is the mirror.

The F3 decoy test asks *"would this condition survive a second node of the type it addresses?"* For
almost any type-addressed path with a specific assertion the answer is **no** — so as an error it
**rejects essentially every sound lesson**. `App:%Page:#Greeting` names the page by type because that
is how a page component is shaped; a hypothetical second Page is not a defect.

> 🔴 **A gate that rejects the correct answer is worse than no gate.** A missed defect reaches one
> learner; a false rejection tells every author their correct work is wrong, and the rational
> response is to stop believing the gate — which disarms the checks that *were* right.

The repair was not to weaken the test but to **re-read the binding it was enforcing**. §3.2 permits
type-only addressing *"only where the graph guarantees exactly one node of that type"* — so **error**
when a second candidate already exists in starter or solution, **warning** when exactly one does.

⚠️ **The reusable trick:** compare against the artifact's **own end state**. A solution is the graph
*after every step*, so a lesson that itself asks for a second Text has two in its own answer — the
ambiguity is visible in the shipped artifact instead of requiring a guess about learner behaviour.

✅ **Two things this settled that were previously recorded as open:**

- **Depth is reachable after all.** The second amendment recorded depth as the boundary the static
  check cannot cross (*"the verifier has no project"*). Still true of `lessonverify` — and a
  **solution replay crosses it**. The drive bundle's own step 2 (`%Text` where the Text sits inside
  the Page) is well-formed, correctly spelt, real-type, and one level too shallow. The harness fails
  it. The boundary was a property of *having no project*, not of static checking.
- **The file-backed context agrees with the live editor.** Over `bundle-good` it reports steps 2 and
  4 failing and step 3 passing — the same per-step verdicts the slice-4 drive measured through the
  UI. 🔴 Two plausible shortcuts would have broken that, both live: a component is addressed by its
  **legacy name**, not its directory (`components/__page__/Home` is named `/#__page__/Home`), and a
  stored node serialises **only its dynamic ports**, so `hasPort: "text"` — true of every Text in the
  editor — reads false from the file alone. Reuse `toLegacyName` / `reconstructLegacyComponent` from
  `io/ProjectImporter.ts`; both are pure (type-only imports) and load in plain Node.

## What to do next — in the order I'd pick

**1. UNI-010 slice 2 — the `create_lesson` MCP surface, and the install that uses the harness.**
This is the obvious next move and the pieces are all in place.

- 🔴 **`LearningFolderModel.install()` still gates on `verifyLessonManifest` alone**, i.e. **F1 only**.
  An AI-authored bundle installed today gets the static check and nothing else. Wire the scorecard in,
  gated on provenance: `local-ai` requires `installable`, `curated` need not.
- The MCP tool: instructions (the how-to-author brief — format, §3.2 label addressing, §3.3 binding
  keys, the pedagogy constraints) + a validating install. 🔴 **The sidecar must not write launcher
  state** (D5): it writes a *bundle on disk* and asks the editor to install it.
- Share the verifier through `noodl-mcp/src/editor-deps.ts` — the same relative-path re-export
  pattern slice 2 of UNI-007 used. `lessonverify`/`lessonbundleverify`/`lessonprojectcontext` are all
  pure; `lessonbundleread`'s fs is injected.
- ⚠️ Lesson prose must use **explicit markdown links** — `linkify` is off in both Remarkable
  instances, so a bare URL never becomes an anchor. UNI-010's producer is a model, so the brief must
  say this.

**2. Then criteria 2 and 3** — a valid bundle installs with the AI-authored label and grades
identically (the provenance plumbing already exists end to end: `LessonProvenance` has `local-ai`,
and `LearningSection` renders `PROVENANCE_LABEL`), and the **five-lesson run** written up against the
pre-registered kill/keep criteria.

**3. The two owed items UNI-007 still does not carry**, both CURRICULUM-DESIGN §11: **curriculum
hosting** (§9.3 — now partly a D2/D9 question) and the **tutor lesson-context overlay** (§9.1,
*"required before L2 testing"*).

**4. Platform work (UNI-001 + UNI-009 minimal cut)** — bigger, and a different repo.

## Gates as they stand (all run 2026-08-15 on `90776d8b`)

| Gate | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (editor) | ✅ exit 0 |
| `npm run test:main` | ✅ **202 suites / 3120 tests, 0 failures** — 🔴 **new floor** (was 199 / 3072; delta is exactly this commit's +3 / +48) |
| `npx eslint` on the new modules + tests | ✅ clean |
| `npm run test:ci` | ✅ **2788 specs / 6 failures at pinned seed 39393** — the exact floor by name, **zero `BEN-001`** |

✅ **`test:main` is safe beside a peer's live drive** — plain Node, no Electron, no renderer, no
CDP port. It is the one full gate that does not need the checkout to be quiet. Announce anyway
(concurrent `test:main` runs manufacture failures), but you do not need to wait for a stack to come
down.

✅ **`test:ci` was run and is discharged.** `NOODL_SPEC_SEED=39393 npm run test:ci`
(`tests/SpecRunner.html:41-42`), results file **deleted at 11:53:34 before the run**, mtime **12:04**
— freshness proved rather than inferred. **2788 specs / 6 failures**, the exact floor names (4 ×
`AIX-006 style vocabulary`, 2 × `AI model registry`), **zero `BEN-001`**. My handover had a
structural argument in its place (slice 1 adds only `tests-unit/` files, which the electron suite
never compiles); it is now a measurement instead, which is strictly better.

✅ **And it is a genuine replicate:** identical seed, spec set, count and names to a peer's 11:29 run
— the same-seed-*same-set* pairing an earlier handover correctly warned is usually missing.

🔴 **Quote it against a TREE, not a commit.** HEAD was `90776d8b` when the run started and
`4db77e0d` when it finished — peers committed underneath it mid-run. The webpack ran 11:53:34–11:54:41,
so what was measured is *the tree at ~11:54*: UNI-010 slice 1 plus phase-66's `keyboardhandler.spec.ts`
(+9 specs, uncommitted then, committed now). **That is why `totalCount` reads 2788 and not the 2779
in older handovers** — it is a spec-set difference, not a regression and not a gain.

🔴 **Before believing any `test:ci` number: delete `packages/noodl-editor/tests/test-results.json`
first, or `stat` it.** Exit 0 with an unchanged mtime is what a broken webpack looks like — a stale
file reproduces the floor count, the floor **names** *and* the seed, because all three check
*content*.

🔴 **The exit code and the log both mislead here, in opposite directions.** This run's log ended
`npm error command failed` and npm's own status was **1** — because npm exits non-zero whenever *any*
spec fails, and the floor is 6, so **a clean floor run always looks like a failure at the shell.**
It was simultaneously reported as **exit 0**, because the command ended `…; echo "exit: $?"` and the
*compound* genuinely succeeded. Neither signal is the readout. **`tests/test-results.json` is.**

⚠️ **Do not file that as the backgrounded-exit-code trap — it is not, and two sessions filed it that
way within one hour on 2026-08-15** (one had to correct their handover, `ccf44d1d`). Nothing lied:
the harness reported the compound's status correctly, and the compound was the wrong question.
🔴 **A false sighting makes a trap entry *more* trusted**, so check the mechanism before adding a
tally mark to one.

## ⚠️ Owed, small, and honest about it

- ⚠️ **`MEMORY.md` compaction is PARTIALLY done and still owed.** A hook asks for it under 17.1KB;
  I got it from 21.2KB to **20.1KB** and stopped. The remaining bulk is ~152 markdown links whose
  URLs alone are ~4.4KB — cutting further means either dropping entries or renaming memory files,
  and the rename would break cross-links in the topic files **while 12 sessions are live on this
  checkout**. All 152 links verified resolving after my pass. Someone should do the rename properly
  when the checkout is quiet.
- ⚠️ `dev-docs/tasks/phase-65-the-library/` is **still untracked** and `MEMORY.md` links into it.
  One `git clean` from gone. Somebody should commit it.
- ⚠️ A **`stash@{0}`** exists in this checkout (`WIP on cline-dev: ff74bcc9`) belonging to no session
  in today's conversations. 🔴 Never `git stash`/`pop` here. Identify it with Richard before anyone
  assumes it is droppable.
- ⚠️ Richard's four live `noodl-mcp.cjs` servers still run an old build; restarting them is his call.
  A running server may load `/Applications/…` rather than the checkout, in which case reaching it
  needs a **repackage**, not `npm run build`.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call
  (the Bash cwd persists and *did* bite me this session); **explicit pathspecs**.
- 🔴 **This checkout is SHARED — 12 sessions were live on 2026-08-15.** Announce over `SendMessage`
  before `test:main`, `test:ci` or an editor launch, and again after. `ListAgents` finds peers;
  reply to a peer by copying its `from=` attribute as your `to`.
  ⚠️ **`git log` authorship separates nobody** — everyone commits as Richard.
- 🔴 **`dev:stop` kills by *checkout*, so here it kills a peer's editor too.**
- ⚠️ A different `NOODL_REMOTE_DEBUG_PORT` does **not** let two editors coexist — the single-instance
  lock ignores it; 8080/8574/8577 are fixed.
- Three-plus long-lived `noodl-mcp.cjs` Electron processes are **Richard's MCP servers** — never kill.

## Things the next person will otherwise re-derive

- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
  And **never `grep -r` across `packages/noodl-editor/src/`** without `--include` — it hits
  `*.bundle.js.map` and returns 33MB.
- 🔴 **The authored condition vocabulary is not what you would guess.** It is `hasParams: string[]`
  (not a string), **`paramsEqual`** (not `paramsEq`), `{ connection: { from, to, fromPort, toPort } }`
  (no `hasConnection` key), **`previewRouteEquals`** and **`activeComponentEquals`** — which compile
  to the internal `viewerpatheq` / `activecomponentnameeq`. Read `lessonformat.ts:48-97` before
  writing a fixture; I wrote a test file against the internal names and it cost a round trip.
- 🔴 **A path segment matches only at *its* level.** `Home:%Text` will not find a Text that sits
  inside the page's `%Page` root. The drive bundle's own lesson has this bug in two steps — which is
  why its slice-4 drive scored "1 pass / 2 fail" and why F2 exists.
- ⚠️ **Drive bundles are still staged** at `/tmp/claude-501/uni-007-drive-bundles/` — `bundle-good`
  and `bundle-bad`. Neither carries a `solution/` yet, so both score three classes `not-checked`.
  `/tmp` is not forever.
- ⚠️ **`scripts/` is not in `package.json`'s `build.files`**, so every `scripts/devtools/*` harness is
  absent from a packaged editor. No gate catches it — they all run from the checkout.
- 🔴 **⌘C over any panel prose copies the selected canvas NODE instead** (phase-66 finding). The
  lesson layer's check summary is exactly such a `<div>`. Not this phase's to fix, and do not fix it
  locally — the binding is global and the repair belongs with the guard.
- `suggestedNodes` is still **dead** — `LessonModel.getCurrentSuggestedNodes()` has no callers, and
  both the verifier and the harness deliberately do not read it. Whoever wires it to the node picker
  decides which vocabulary it wants and adds it to the check in the same change.
