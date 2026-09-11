# Phase 57 — handover after session 11 (2026-08-09)

**What ran:** **BLD-008 built.** All six acceptance criteria are pinned as specs and **none of them
has been on screen** — this is a build session, not a drive. The docs pass is inverted: the agent
asks before it drafts, the TODO count stops being a feature, and the `question` message kind BLD-002
reserved finally has an author.

Phase 57 is **10 of 16 built, 8 driven** (BLD-001 ✅, 002 ✅, 003 ✅, 004 ✅, 005 ✅, 006 ✅,
007 ✅, **008 🟡 built-not-driven**, 012 🟡).

## 🔴 Before you plan anything

> **The editor has a real, verified Anthropic provider. A drive costs Richard money.**

Session 10 found this the hard way; it is still true. Check the **file**, not localStorage:

```bash
node -e "const s=require(process.env.HOME+'/Library/Application Support/NodeGX/editorSettings.json').settings;
console.log(Object.keys(s).filter(k=>/^ai\./.test(k)).join('\n'))"
```

Nothing in this session made a provider call. Every number below is a spec, not a measurement, and
the register says so in R8.

## ⚠️ The findings worth more than the task

### 1. A Stop button that has been calling `null?.cancel()` since BLD-001

`ProjectReviewView` held its run in a `useRef`, filled only by `start()`. `start()` is reachable from
the `!isEmbedded` button and the `startImmediately` flag — and since BLD-001 the **only** mount of
that view is `renderOutcome`'s embedded one, started by `AiAuthoringPanel`. So the ref was never
filled, and the Stop the user sees during a docs run has done nothing for four sessions.

It was found not by looking for it but because the interview's controls need the same reference: an
answer has to reach the run, and the run was reachable from neither mount. `ProjectReviewStore` owns
it now, beside the state it already owned.

**The reusable version:** *a ref filled on a path nobody takes is indistinguishable from a ref that
works.* `tsc` sees a written ref, the specs never mount React, and the button renders. The question
that finds it is **"who calls the thing that fills this?"** — which is the same question session 10's
uncalled `flush()` needed, one directory over, one session earlier.

### 2. A busy flag guarding the work instead of the door

`run()` publishes `busy: true`, then — with the interview disabled — delegated straight to `draft()`,
whose first line is `if (this.state.busy) return this.state`. It saw its own caller's flag and
returned immediately, leaving `phase: 'assembling'` and three pending drafts.

**Every pre-BLD-008 run spec went red on it**, which is what a suite written against the old flow is
for and the reason those specs were kept rather than rewritten. The guard now sits on `draft()`, the
public entry point a user can press twice; the loop is a private `runDrafts()`.

⚠️ Note what did *not* catch it: the new BLD-008 specs all passed, because they reach `draft()` from
`phase: 'interviewing'` where `busy` is false. **The specs you did not touch are the ones that catch
you** — the same sentence as session 8's, and it has now happened twice.

### 3. The feature contained a mechanism arguing against itself

`todoAdvisoryMessage` is sent when a draft carries **no** `> TODO:` lines and asks the model to add
some. It is a good rule and it was right about its old subject: a draft written from a partial read
that is certain about everything has smoothed its guesses into facts.

After BLD-008, a draft with no TODO lines is **acceptance criterion 2's first half** — it means every
question was answered. Left on, the pass would have spent a turn asking the model to undo the thing
the interview just bought. It is off whenever nothing was declined.

Third occurrence in three sessions of the phase's running shape: **a rule that was right about its
old subject.** (BLD-004's clock, BLD-004's state class, BLD-007's ellipsis, BLD-006's
`is-highlighted`, and now this.)

## 🔴 The finding that is not about BLD-008: BLD-017 is new

Richard, on the shipped panel, mid-session:

> *"Why does the interface still look like a CS student's winter project? We have a mockup somewhere
> we're supposed to follow."*

**We do, and nine tasks were built against its structure without anyone diffing its CSS.** BLD-002
took the mockup's type scale, BLD-003 its control placement, BLD-005 its pinned run header. Nobody
took its **surfaces** — and that is what makes a dark panel read as designed rather than as a stack
of paragraphs:

- the collapsed activity run is a **filled chip** in the mockup (`bg-2`, border, radius 4, duration
  right-aligned); shipped, `.Run` is `background: none; border: 0`;
- an outcome is a **bordered card with a footer band** for its actions; shipped, it is text followed
  by a bare `HStack`;
- an accepted card collapses to a **success-ruled receipt**; and so on for eight rows.

⚠️ **It is not a redesign, and the task says so first.** The mockup draws its panels in *"NodeGX's
own dark tokens, used verbatim, so the mockups are honest about what the panel actually looks like"*.
There is no palette to adopt. **The rule is: copy the intent, name the token, never copy the hex** —
the mockup is dark-only, so a copied `rgba(77, 163, 255, 0.13)` is an azure wash on a *white* panel
in light mode.

Eight gaps are measured in [BLD-017](BLD-017-MOCKUP-FIDELITY.md). **The ninth was closed here** as
the worked example.

## The design decisions that are not obvious from the task

> **The open question is a card. The thread carries the settled ones.**

`InterviewCard` draws the mockup's `.qcard` in full — a mono `QUESTION` eyebrow, the question at
weight 560, why it is being asked, the agent's guess in an inset `bg-1` well with its own label, and
the three answers in a footer band. `docsTurns` emits `question` activities only for exchanges that
are **settled**, so the text is on screen exactly once.

⚠️ **The first cut had this the other way round** — the question as an activity, the controls in a
bare box beneath. It kept the no-duplication property and lost the mockup, because a question, its
evidence and its answers are *one decision* and two stacked boxes read as two things to deal with.

⚠️ And they are `question` activities rather than `tool` lines **because `isCollapsible` differs**.
As tool lines, six questions and their answers would sit behind a "8 steps ▸" disclosure — the
transcript of the only exchange in this panel where the *user* supplied the content, hidden by the
mechanism built to hide "Read node documentation". There is a spec for exactly that.

⚠️ **BLD-002's reservation for `question` was itself right about its old subject** — *"the loudest
thing in the thread, because it is the only activity that blocks"*, written when a question was
assumed to be one line of text. It is now the transcript treatment, a quiet accent rule: seven
accent-ringed boxes stacked would be noise. Sixth occurrence of the phase's recurring shape.

> **The TODO lines are written by code, and the drafting prompt is forbidden from writing any.**

"Skipping three produces exactly three" is not something a prompt can promise. `insertSkipTodos`
inserts one line per declined question under its heading — and never drops one, even when the model
deleted the heading. So the count is arithmetic, in one place, with a spec.

⚠️ **The residual is stated rather than hidden.** A model that ignores the prohibition adds a line
and the count then exceeds the number of skips. The only "fix" is silently deleting the model's own
words, which is worse. There is a spec pinning the current behaviour so that a later decision to
strip them is a deliberate one.

> **The interview is the `design` role; the drafting turns stay global.**

Deciding what to ask a person about their own product — and writing the sentence they will correct —
is the act `ScopingSession` performs, and it sets the ceiling on all three documents. The drafting
turns that follow are transcription of answers already given, which is the line `ReviewDocSession`'s
global entry already drew.

⚠️ **`tests-unit/phase-55/roleModels.test.ts` is what caught the new call site.** Any new
`AiClient.chat*` caller under `AiAssistant/` must appear in `AI_ROLE_SESSIONS` or
`AI_GLOBAL_SESSIONS` with a written reason. Worth knowing before you add a session, not after.

## Two task premises that needed a decision

- **`ReviewDocKind` had to widen** for item 8's invented document, and widening a union is how a
  lookup silently returns `undefined`. `REVIEW_DOC_PATHS` and `DOC_TEMPLATES` are therefore
  `Record<KnownDocKind, …>`, **not** `Record<ReviewDocKind, …>` — indexing them with `proposed` is a
  compile error rather than the string `"undefined"` in a file path. A proposed document carries its
  own path.
- **The question set is seven, not the task's estimated six.** Three from BRIEF (all of it), three
  from ARCHITECTURE (the *why* of the data model, backend contracts, decisions), one from
  CONVENTIONS. Pinned exactly, so growth is a decision rather than a drift.

## What is built

| Module | What it is |
|---|---|
| `review/interviewQuestions.ts` | Pure. `##` headings out of `DOC_TEMPLATES`, plus a rule per heading. An unclassified heading is **asked** — and a spec makes it red as well, because a default cannot fail loudly. |
| `review/interviewState.ts` | Pure. Answers, the resume rule, `insertSkipTodos`, `interviewActivities`. |
| `review/interviewPrompts.ts` | The asking prompt, and `answersBlock` — answers as facts, `> TODO:` forbidden. |
| `review/InterviewSession.ts` | One turn, one tool, `design` role. **Degrades to the plain questions rather than failing the pass.** |
| `review/InterviewSidecar.ts` | `.nodegx/review/interview.json`, debounced + queued, on `flushAiSidecars` **from the day it was written**. |
| `review/ProjectReviewRun.ts` | `run()` assembles and asks; `draft()` writes. The gap between them is a person. |
| `AiAuthoringPanel/InterviewCard.tsx` | The controls, and nothing the thread already says. |
| `tests-unit/bld-008/` | 42 specs across the derivation, the state, the sidecar and the turns. |
| `tests/ai/project-review.test.ts` | 13 more, in the Jasmine suite, where the run reaches a client. |

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **99 suites, 1365 tests**, zero failures (was 95 / 1322) |
| `test:ci` | see the closing commit for the `Jasmine:` line — run with the dev stack **stopped** |

⚠️ **`test:ci` is where the busy-flag regression showed up**, at 15 failures against an inherited 6.
Six were mine and are fixed. **The other nine are not all inherited-6:** that run reported BEN-001 ×3,
AI model registry ×2 and AIX-006 style vocabulary ×4, which is nine, against a documented baseline of
six. Jasmine randomises order (`Randomized with seed …`), so some of those are order-dependent rather
than fixed. **Do not treat "6" as the baseline without re-measuring it** — record the seed.

## Driving this panel — what session 12 has to do

Nothing in BLD-008 has been on screen. The drive needs a project **with no docs** (the fixture
`ai-test` has `docs/uk-vat.md`, so it is not that project without a copy) and should measure:

1. **Criterion 1 on screen** — coverage first, then the questions, with no draft text anywhere.
2. **The phrasing and the guesses.** The whole economics rest on "correcting is cheaper than
   composing"; a guess that is generic is a failed feature even though every spec passes. Read them.
3. **The sit-down at 400px.** Seven questions, each with a guess, a reason and three buttons, in a
   panel BLD-007's B8 already showed is too narrow for a fixed-width label. **Sweep the width** — the
   B8 lesson is that a spot-check at the default proves nothing about the range.
4. **`.Question`'s contrast**, both themes. It is `--theme-color-bg-3` with a `--theme-color-primary`
   inset ring and `--theme-color-fg-highlight` text, and it has never been painted. Three of this
   phase's five contrast defects were in rules nobody had measured.
5. **Criterion 3 for real** — answer three, quit, reopen, ask for docs again. The resume must not
   make a second billed call; watch for one.
6. **R6** — send a new request mid-interview and see what the panel says. It retires the interview
   (correctly, per AIB-003) and the answers survive on disk, but nothing on screen says so.

## Concurrency and cleanup

`ps` showed no editor and no dev stack at start or at the end. `git status` showed exactly the
sibling-owned things the last handover named:
`packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx, codemirror-theme.ts}`
**still theirs, still uncommitted** — inherited for a fifth session, untouched. The untracked
`dev-docs/tasks/phase-59…61/` directories are likewise not mine and were left alone.

No project fixture was opened, so nothing under `NodeGX test projects/` changed. No worktree. Every
commit pathspec-scoped; no `git add -A`, no `git stash`.

## What to do next

1. **BLD-017** — the mockup fidelity pass. Richard raised it and it is the reason the panel does not
   look finished. F1 (the run chip) and F2 (the outcome card + footer band) are the two the eye lands
   on. The interview's question card is the worked example; `InterviewCard.module.scss`'s header maps
   every raw hex in the mockup to the token it stands for.
2. **Drive BLD-008** — the six points above. It is the largest un-driven surface in the phase, and
   worth doing *after* BLD-017 so one drive measures both.
3. **BLD-009** (expanded mode) or **BLD-010** (the acceptance pass). BLD-010 now owns five debts:
   BLD-003's docs route has **never been on screen**; BLD-004's **R4** (Ollama, inferred) and **R5**
   (OpenAI-compatible `reasoning_content`, unwired); BLD-006's **R12** (the quit flush is wired, not
   driven); and **all of BLD-008**.
4. **BLD-012's two remaining gaps** — the chip (blocked on BLD-011) and OpenAI against a real
   endpoint.
5. **The design-system row** is unchanged at three: `MenuDialog` end slot, `HStack` `height:100%`,
   `Ghost` 4.33:1 in light.
