# Phase 57 — handover after session 13 (2026-08-09)

**What ran:** **BLD-008 driven.** The interview reached a real Anthropic endpoint on a real project,
seven questions were answered on screen, and the drive found **three defects the build could not**
— all three fixed and re-measured live. Phase 57 is **11 of 17 built, and BLD-008 is now ✅ rather
than 🟡**.

The finding worth keeping is not the contrast failure. It is that **the one card in this panel that
blocks was the one thing the thread would not scroll to** — and that both halves of the cause were
correct decisions, individually defensible, pinned by their own specs.

## 🔴 Before you plan anything

> **The editor has a real, verified Anthropic provider. A drive costs Richard money.**

**This session billed $0.058813 and Richard approved the amount and the depth in advance.** The
breakdown, read out of the renderer console rather than estimated:

```
[ai] plan:   anthropic/claude-sonnet-5 —  2 in (+0 cached, 4129 written) /  514 out, $0.015467
[ai] design: anthropic/claude-sonnet-5 — 12 in (+0 cached, 9893 written) / 1859 out, $0.043346
```

⚠️ **Ask before the next one, and scope it.** Richard was offered four depths and chose "routing +
real interview, stop at the questions". **The drafting turns were therefore not run** — three
sequential document turns, the expensive part — so acceptance criteria 2 and 5 remain specs. Do not
read "BLD-008 driven" as "BLD-008 fully driven"; the register says exactly which half.

## ⚠️ The findings worth more than the task

### 1. Two correct decisions, and the blocking question ends up below the fold

`BuildThread` follows the tail **only while a turn is `busy`** — right, and the comment says why:
scrolling up to read must not be undone by the next token. `docsTurns` marks the interviewing phase
**neither `busy` nor finished** — also right, and *also* pinned, because `busy` would put a heartbeat
on a turn that is not working and the `done` branch would report "Drafted 0 documents" over a thread
of unanswered questions.

Put together: **the sole blocking state in the panel is the sole state the follow rule declines to
follow.** Measured at the shipped 400px, the moment the questions arrive:

| | |
|---|---|
| thread `scrollTop` | **26** of a possible **547** |
| visible | the eyebrow, and the first line of the question |
| not visible | `why`, the guess, **all three answer buttons** |

Nothing on screen said a decision was waiting 500px further down. BLD-008's own build note says *"a
question that goes unnoticed is worse than no question"* — the card was built loud and then left
off-screen.

**Fixed in `InterviewCard`, not `BuildThread`**, because only the card knows which element the
question is, and it needs the *opposite* anchor: `block: 'start'`, not the thread's `'end'`. That is
not a preference —

> **one question is 501px tall in a 419px viewport at 400px** (877px at 248px, 334px at 607px).

The card is taller than the viewport at every width this panel ships at, so anchoring its bottom
would scroll the question itself off the top and leave three buttons with nothing above them.
After: `scrollTop` 0 → 1291 unprompted, card top exactly at viewport top, eyebrow/question/why/guess
**100%** visible, action band **13%** — a peeking control, which is the affordance rather than the
bug.

**The reusable version:** *when you exempt a state from a rule, check what else that rule was doing
for it.* Both files were right about their own subject and neither could see the other's.

### 2. An accent wash is not free, and it costs the accent the most

`.Tag` — the "QUESTION" eyebrow — measured **3.85:1** in light, under the 4.5:1 that binds at 9.5px.

The card lays `--theme-color-primary-bg` over `bg-2`. Tinting a surface with the accent moves the
surface **toward** the accent, so the accent is the one colour that pays most to sit on it:

| on | plain `bg-2` | the washed card |
|---|---|---|
| `primary` | 6.45 / **4.33** | 5.23 / **3.85** ← fails |
| `fg-default-shy` | 5.57 / 5.06 | 4.52 / 4.51 |

(dark / light.) Light `primary` was **already at 4.33** on plain bg-2 — the exact figure `Ghost` sits
on the design-system list for — so the wash had 0.33 of margin available and took 0.48.

Fixed to `--theme-color-primary-highlight`, which is the ramp's *more-contrasting* azure in both
themes (azure-400 dark, `#0e5fd0` light): **6.56 / 4.97**. Same accent identity, above the floor.

⚠️ **`.Why` now passes by 0.01** (4.51 light) and was deliberately left alone: `fg-default` is what
`.Guess` already uses, so darkening the evidence collapses two roles the mockup drew apart. **This
card has no margin left. Anything further laid over it must be re-measured, not reasoned about.**

This extends BLD-017's lesson rather than repeating it: that one was *a mockup is not a contrast
measurement*. This one is **a token name is not one either** — every colour here was already a
correct token, and the surface underneath is what moved.

### 3. The panel announced two documents it never writes, and the spec enshrined it

First sentence on the drive:

> *"I'll draft 3 project documents — docs/ARCHITECTURE.md, docs/COMPONENTS.md, docs/PAGES.md."*

It then wrote BRIEF / ARCHITECTURE / CONVENTIONS. **Not a model fluke.** `decideIntent`'s docs branch
built the sentence from `plan.operations[].target`, and `routePlan`'s docs case calls
`startProjectReview(project)` and **never reads the plan again**. A sentence derived from a discarded
plan is structurally free to disagree with what happens, and did so on the first try.

⚠️ It carried a second falsehood from the same root — **"I'll draft"**, when BLD-008 inverted this
route to read → *ask* → draft. The next thing that happens is questions.

⚠️ **And `tests-unit/bld-001/intent.test.ts` had a green assertion that the sentence names the
documents — it passed because the sentence echoed the plan.** A spec can pin the mechanism and miss
the claim. It is now inverted: the three seeds appear *whatever the plan said*, and an invented
target does not.

## What was measured

Both themes, `nodegx-qa-fixture` (24 components, **no `docs/`** — criterion 1's exact case):

| | result |
|---|---|
| questions asked before any draft | **7** — R7 exactly, `brief`×3 / `architecture`×3 / `conventions`×1 |
| `.nodegx/review/interview.json` | written; correct `version`, `projectId`, one answer per settled question |
| horizontal overflow, **248 → 608px** | **0 at every width**; buttons outside their band **0**; thread `scrollWidth` overflow **0** |
| card height | 877px @248 · 501px @400 · 334px @607 |
| `.Tag` after fix | **6.56** dark / **4.97** light |
| `.Text` / `.Why` / `.GuessLabel` / `.Guess` | 12.20 / 4.52 / 5.98 / 8.26 dark · 13.72 / 4.51 / 5.34 / 7.49 light |
| borders | card `#37404c` border-strong; guess well + actions rule `#232a33` border-default — BLD-017's elevation rule held |

Skip states its consequence and **names the file**: *"Skipped — this becomes a TODO in
docs/BRIEF.md."* Rewrite pre-fills with the guess (194 chars) and the edit lands in the transcript.
Complete state reads *"6 answered, 1 skipped — each skip becomes one TODO naming the question"* with
seven `Change: <heading>` buttons; reopening one returns the card and the progress line.

**Question quality is good, and worth knowing before anyone re-litigates the feature.** Q1 asked
whether the project was a real product or a QA harness, cited *"`/erg-rig` and the unreferenced
`erg001-cloud` are pure signal/counter test rigs… with no relation to the Home/Catalog/Settings
pages"*, and guessed correctly.

## What was NOT driven — stated, not implied

- **The drafting turns.** Out of scope by Richard's choice. Criteria 2 (zero TODOs / three skips) and
  5 (rejecting every draft leaves the project byte-identical) are still specs.
- **Restart-resume.** The sidecar was verified *written*; `resumeInterview` replacing the model turn
  is read, not measured. Re-entering a docs run costs another routing turn.
- **The proposed fourth document** (build item 8) — the model offered none, so `.Proposal` has now
  survived a real drive without executing. R15.
- ⚠️ **A cheap way to re-drive the card exists.** `startProjectReview` reads
  `.nodegx/review/interview.json` and a resumed interview **replaces the model turn entirely**, so a
  hand-written file gets seven real questions through the real components for **zero** interview
  cost. You still pay one routing turn to reach a live `docs-run` turn, because the embedded
  `ProjectReviewView` mounts only on a turn whose id is exactly `docs-run`. The drive's own file is
  saved for reuse; it was **deleted from the test project** afterwards so the next docs run there
  asks rather than resumes.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean (re-run after the `intent.ts` change) |
| `typecheck:editor-tests` | clean (re-run after the `intent.ts` change) |
| `test:main` | **100 suites, 1383 tests**, zero failures — unchanged from session 12's baseline |
| `test:ci` | **`Jasmine: 2596 specs, 6 failures (failed). Randomized with seed 30232.`** — the documented baseline, all inherited |

✅ **And the baseline is now confirmed at a second seed.** Session 12 measured 6 at seed **39386**;
this run measured the same 6 at seed **30232**, and they are the same six by name — AI model
registry ×2, AIX-006 style vocabulary ×4. The two real bugs behind them are unchanged: the registry
expects `gpt-4o`/`gpt-4o-mini` where the catalogue now has `gpt-4.1`, and AIX-006's style pass is not
emitting `STYLE LINT`. **BEN-001 ×3 did not appear at either seed.**

⚠️ **The first `test:ci` was killed and restarted deliberately.** It had been launched before the
`intent.ts` fix, so its verdict would have graded a tree that no longer existed. A gate that ran
against the wrong tree is worse than no gate, because it reads green.

## Concurrency

⚠️ **The sibling session is live.** `dev-docs/tasks/phase-17-noodl-learn/` was written at 22:24–22:26,
about 35 minutes before this session started, and `LEARN-011-THE-FREE-LESSON-ENDPOINT.md` is theirs.
`packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx, codemirror-theme.ts}` is
now inherited for a **seventh** session — leave it.

Every commit here was pathspec-scoped. No `git add -A`, no `git stash`. The five files touched are
all under `AiAuthoringPanel/`, `thread/` and `tests-unit/`, plus this phase's own docs.

⚠️ **The committed QA fixture was not touched.** `dev-docs/qa-fixtures/nodegx-qa-fixture` and
`NodeGX test projects/nodegx-qa-fixture` are different copies — the launcher opens the second, which
is outside the repo, and that is the one the drive used. Confirmed by mtime (Aug 7 vs Jul 28) before
opening anything.

## What to do next

1. **BLD-010's list is now six, not seven, and two are cheaper than they look.** BLD-003's docs route
   has been on screen at last (this session drove it), so that debt is closed. Remaining: BLD-004's
   R4 (Ollama) and R5 (`reasoning_content`); BLD-006's R12; BLD-017's F2 and F4; and **BLD-008's
   drafting turns + restart-resume**.
2. **The design-system row is still four**, and R12 hardens one of them: `Ghost`'s 4.33:1 in light is
   now measured as *the reason an accent eyebrow failed on a washed surface too*. The two rows are
   the same underlying colour seen twice — worth fixing as one change rather than two.
3. **R14 is a ten-minute reword.** The coverage line quotes the character budget (8% used) and omits
   the read cap (`maxComponentReads: 8`) that actually bound. It cost this session real time chasing
   a selection bug that does not exist.
4. **Six tasks remain unbuilt**: BLD-009, 011, 013, 014, 015, 016 — and BLD-012 is still 🟡 on
   OpenAI's leg and the panel chip.
