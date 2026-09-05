# Phase 79 — next session

**Written 2026-09-05, end of session 8.** Richard's instruction was *"let's drive the new tutorials
that haven't been driven yet, as long as a peer isn't using the editor"*. **All four undriven spine
lessons were driven**, each with a control pair, in a running editor. Nothing was built this session
and nothing needed to be.

## The board — re-derived from the task files

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟡 **unblocked, seven sessions overdue** — seven spine lessons join |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open, independent |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) — lesson 1 | 🟢 built, gated, driven |
| [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) — lesson 2 | 🟢 **built, gated, DRIVEN** |
| [SYL-006](SYL-006-LESSON-3-POKE-IT.md) — lesson 3 | 🟢 **built, gated, DRIVEN** |
| [SYL-007](SYL-007-LESSON-4-IT-FORGETS-YOU.md) — lesson 4 | 🟢 **built, gated, DRIVEN** |
| [SYL-008](SYL-008-LESSON-5-SHOW-WHAT-IT-FEELS.md) — lesson 5 | 🟢 **built, gated, DRIVEN** |
| [SYL-009](SYL-009-LESSON-6-MOODS.md) — lesson 6 | 🟢 built, gated, driven *(app route only — see J1)* |
| [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md) — lesson 7 | 🟢 built, gated, driven *(app route only — see J1)* |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 written; §3 and §6 are Richard's |
| defect registers | **21 rows across five files, every one owner `NONE`** |

**Seven of twelve spine lessons ship. Every lesson that ships has now been driven.**

---

## 🟢 The five-session first job is DONE

Read [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md) — method,
caveats and the two ways a click lies to you.

**Twenty-six graded `connection` conditions shipped across lessons 3-7 with none ever observed being
graded. They are observed now.** Every question the hand-offs had been carrying is answered yes:
the runner grades a `connection`; it resolves 5- and 6-segment node paths; it grades runtime-minted
signal inputs, runtime-minted outputs, and ports minted by what the learner *typed* (`{count}` in a
format string, `pokes` in an expression); it round-trips a string with `{braces}`; and **all four
untouched starters refuse**, which is the arm that makes the other four mean anything.

🟢 **Two things got cheaper for every future drive.** A fresh profile via `NOODL_USER_DATA_DIR`
**seeds all 8 lessons onto the shelf by itself** — no register surgery, no native file dialog. And a
pre-solved second install (`cp -R` the installed dir, replace the two files that differ, add a
register entry) gives a cold-open control pair without racing the editor's own flush.

---

## FIRST JOB — pick one; there is no longer a blocked-for-five-sessions row

### (a) [J1](DEFECTS-THE-RUNNER-DRIVE-FOUND.md#j1--a-blockquote-renders-as-a-literal--in-the-line-carrying-the-lessons-whole-idea) — the blockquote that renders as a literal `>`. **Strongest, and cheap.**

🔴 **Five of the eight shipped lessons**, and in each one the mangled line is the sentence the lesson
exists to teach. `blockquotes: 0` in the DOM; the `>` and the `*emphasis*` both come through literal
while `**bold**` in the same body is fine.

⚠️ **It reaches lessons 6 and 7, which the board calls driven** — they were driven by the
serve-and-click route, which never renders lesson prose. That is worth holding on to generally: *the
route you drove by decides which defects you could possibly have seen.*

The fix is the renderer, not the prose. Ruling blockquotes out of `LESSON-VOICE.md` and rewriting
five lessons is the cheaper-looking option and the wrong one — the authors used a blockquote because
the format offers it.

### (b) [J2](DEFECTS-THE-RUNNER-DRIVE-FOUND.md#j2--check-my-work-on-an-incomplete-step-removes-the-instructions) — *Check my work* deletes the instructions

Recorded against lesson 1 in session 3, measured again on lesson 3 this session, so it is the
runner's and it has survived five sessions unowned. Press it while stuck and the step body and the
*Show me how* disclosure leave the DOM, with no new feedback of any kind. The learner pressed it
*because* they were stuck.

### (c) SYL-002 — the chain check. **Seven sessions late.**

R1 said *"build the equality check before lesson 3, not after lesson 12."* Nothing about this
session changed its cost, and eight bundles now join. Method unchanged: round-trip the previous
solution's `nodes.json` through `json.dumps(d, indent=2, ensure_ascii=False)`, no trailing newline,
compare bytes; `nodes.json` and `connections.json` only — `_registry.json` legitimately differs
([D4](DEFECTS-LESSON-2-FOUND.md)). Lesson order comes from `curriculum.json` in the other repo.

### (d) Lesson 8 — `snacks`, ~1 session

`Static Data`, `For Each`, `For Each Actions`. Its opening problem is built and waiting: lesson 7
ends pointing at `Feed`, `Play` and `Sleep` — three words typed by hand since lesson 2 that Nibbles
now actively asks you to use.

🔴 **Read all five registers before designing, and check every node name in the entry with
`get_node_type` first.** Four of the seven entries built so far named a node that could not do the
job its description implied.

---

## What this drive did NOT cover, so nobody re-reads it as more than it is

- **The install-from-a-folder path** — still only `tut-004/the-real-bundle-installs.test.ts`. The
  real installer goes through a native file dialog CDP cannot drive. The starters here came via the
  **seed**, which is the path shipped lessons actually take.
- **A learner's own edit flipping a condition while the editor watches.** Both arms were cold opens.
  Lesson 1's drive did this (add a `Card`, re-check, auto-advance) and remains the only sighting.
- **Whether a person can physically drag a signal wire.** The runner grades one correctly; that is a
  different claim.
- 🔴 **[I1](DEFECTS-LESSON-7-FOUND.md) is untouched** — the gates still cannot see a time-based
  lesson. That is a gate problem, not a runner problem, and this drive says nothing about it.

## Two traps this session paid for

🔴 **`npm run cdp -- click` prints `clicked … at x,y` whether or not anything received it.** Two
clicks landed nowhere (card below the fold, `scrollIntoView` unsettled) and both would have been
written up as "the lesson refused" — which is *exactly* what a passing negative control looks like.
✅ **`elementFromPoint` before the click, and then confirm the consequence**: the
`Learning/<id>` directory `mtime` moves the instant a lesson project opens, and it is the only
honest witness to which copy is on screen.

⚠️ **A substring title match opened the wrong lesson.** Asking for a card containing `Poke it`
matched **It forgets you**, whose description begins *"Poke it twice…"*. Match the card's own `h3`
exactly, and walk **from each `Start` button up** to its `h3` — climbing up from the title overshoots
to the grid and stamps the first of ten buttons.

⚠️ **Do not script the click-through.** Fourteen scripted `NEXT` clicks advanced nothing; one
hand-issued click on the same button finished the lesson. The `[data-drive]` stamp does not reliably
survive the re-render between the `eval` that sets it and the `click` that uses it. By hand it is
four commands per lesson.

## Still Richard's, unchanged

The step prose for lessons 2-7, the `description`s and badges, and `LESSON-VOICE.md` §3 and §6.
⚠️ **J1 is a live constraint on that pass**: until the renderer is fixed, a blockquote in a lesson
body will reach the learner as a literal `>`.

---
---

# Session 9 — the defect sweep (2026-09-05, appended)

WARNING: **Everything above is session 8's and is left intact** — it is still the right account of
the drive. This section supersedes only its **FIRST JOB** list: (a) J1 is done, and so is J3.

Richard's instruction was *"do a sweep for any defects from the recent phases and line them up to
tackle as many as we can."* The sweep found P77/P78's rows already swept into phase 80 (closed,
46/46), and **P79's registers holding 23 rows with every single owner `NONE`** — the freshest and the
only wholly unowned set. That was the lane.

⚠️ **Session 8's board said 21 and the tables hold 23** (5+5+4+4+2 across the five lesson
registers, plus 4 in the runner register — recounted, not inherited). Nothing turned on the
difference, but a board figure that nobody re-derives is how a row goes missing.

## What shipped — 10 defects across 6 fix commits, every one gated and mutant-checked

| row | was | now |
|---|---|---|
| **J1(a)** | a blockquote rendered as a literal `>` in 5 of 8 lessons | OK `renderMarkdown` has a blockquote branch (+ CSS, which had none) |
| **J1(b)** | bold containing nested `*em*` never matched, and emphasis then landed on the wrong words | OK the bold rule's content class no longer forbids `*` |
| **J1(c)** | **found here, recorded by nobody** — a `*` inside a code span paired with prose outside it | OK code spans are masked before emphasis |
| **J4** | a multi-key `paramsEqual` named its parameters and not their values | OK every value named; a dimension reads `560px` |
| **D2** | the *"Looking for..."* line showed a raw type id | OK resolved through the node picker's own `getItemLabel` |
| **J3** | every shipped lesson badged **Written locally** | OK the badge got an input of its own; the gate still downgrades |
| **G1** | an `Expression`'s three typed outputs were dead for wiring | OK flagged alongside `result`, inside the existing guard |
| **E2** | `Color Blend` painted `#NaNNaNNaN` for every token colour | OK resolves `var()`, `#RGB`, `rgb()`; reports what it cannot read |
| **H4** | the catalog's `Visible` summary did not say it keeps its space | OK rewritten; both catalogs regenerated |
| **E5** | *(caused here)* the export's copy of Color Blend still had the defect | OK `readColor` ported; the parity gate is what caught it |

**E4 and H3 are NARROWED, not closed** — their editor half rode in on D2, but the curriculum entry
naming `Timer` lives in the other repo and is untouched. Do not tick them.

Suites after: **noodl-runtime 2662/2662 - noodl-viewer-react 1283/1283 - nodegx-export
2780/2780 - the 59 editor lesson suites 1058/1058 - `catalog:check` and `catalog:merge:check`
both up to date.** The editor's `test:ci` was not run — see the caveat at the bottom.

## E5 — RAISED AND CLOSED IN THE SAME SESSION (read this before the trap list)

E2 fixed `Color Blend` in the runtime and not in `nodegx-export`'s emitted copy, so for part of
this session exported apps still painted `#NaNNaNNaN`. **It is now fixed** (`03288392`): the
emitted lib has its own `readColor`. The P18 peer committed their hand-off and the package went
clean, so the collision risk that made me defer it had gone — I re-checked rather than assuming.

🔴 **The important part is not E5, it is how it was found.** `small-utilities.test.ts` §A **loads
`colorblend.ts` from source and runs it** — a real parity gate — and it went red the instant the
runtime changed. **I did not know for forty minutes**, because I had reasoned that Color Blend
lives in `noodl-viewer-react` and had run `noodl-viewer-react`.

- 🔴 **A node's blast radius is not its package.** Editing one node source broke **two other
  packages** in two different ways: `nodegx-export` grades against it, and
  `node-catalog{,-enriched}.json` are generated from its port descriptions. Neither is visible
  from the directory the file sits in. **After touching any node under
  `noodl-runtime/src/nodes` or `noodl-viewer-react/src/nodes`, run `nodegx-export`'s suite and
  `catalog:check` + `catalog:merge:check`, not just the owning package's.**
- ⚠️ **A report can be worse than the defect.** The suite died on
  `this.raiseRuntimeError is not a function` — the node is also loaded as a **bare definition
  object** with no `Node.prototype`, so the new error report *threw* where the old code merely
  returned nonsense. Guarded now. Reporting must never be the thing that throws.
- ⚠️ **Parity is gated in ONE direction only.** `Color Blend` and `Boolean To String` have a gate
  that loads the interpreter's own source. **`Expression` (G1) does not** — the export's
  correctness there was read off `plan.ts` by eye. That asymmetry is a row P18 should want.

## FIRST JOB — J2, then the rest in this order

1. 🔴 **[J2](DEFECTS-THE-RUNNER-DRIVE-FOUND.md)** — *Check my work* on an incomplete step removes the
   instructions and says nothing new. Measured on two lessons, unowned for five sessions, and it
   hits the learner at the exact moment they were stuck. The only high-severity row left in the
   runner register.
2. **[H1](DEFECTS-LESSON-6-FOUND.md)** — `paramsEqual` on a `stringlist` sorts before comparing, so
   a graded step **cannot tell two orders apart** while a `States` node starts in its first state.
   A false pass in a teaching product. WARNING: **I left this on purpose**: the honest fix adds an
   ordered form to the authoring format (there is no `paramsEqualOrdered`), and that is a format
   decision touching the compiler, the evaluator, the copy module and the verifier — a session of
   its own, and arguably Richard's call, not a corner to cut at the end of a sweep.
3. **[E3](DEFECTS-LESSON-3-FOUND.md)** — a new wire does not pull its source's value.
4. **[E1](DEFECTS-LESSON-3-FOUND.md)** — a Button cannot be put on the design system from the panel.
5. **E4 and H3** — the two NARROWED rows. Their editor half is done; what is left is the
   curriculum entry naming `Timer`, which is in the **other repo**, so neither can be closed
   from this one. They are on this list so they are not mistaken for finished.
6. The remainder: D1, D3, D4, D5, G2, G3, G4, H2, I1, I2.

## Traps this session paid for, so the next one does not

- **A row's OBSERVATION and its DIAGNOSIS are two claims, and only one of them was checked.** J1
  reproduced character for character and its explanation was still wrong — one symptom had been
  attributed to the construct standing next to it. It was three defects, and the third was in a
  different lesson entirely. **Re-derive the mechanism even when the transcript matches.**
- **A getter is not a wire.** `getOutput('asNumber').value` calls the getter directly and reads
  correct against the broken runtime — a G1 spec written that way passes and grades nothing. The
  spec drives a real graph with a **sink node recording what it received**.
- **A port `description` is not a comment.** It is an input to two committed artefacts
  (`node-catalog{,-enriched}.json`) with two CI gates. E2 left both stale and nothing said so;
  H4's commit repairs it. Run `catalog:generate` + `catalog:merge` **and diff** in the same
  commit — and see the blast-radius rule in the E5 section, which is the general form of this.
- **`grep` went silent on a `.ts` file** because an edit had put a real NUL byte in it — the file
  read as binary to the tool. Written as the six-character escape sequence instead. If a grep you
  trust returns nothing, check the file is still text.
- **A corpus arm finds what a row cannot.** J1(c) exists because the gate rendered all eight
  shipped bundles rather than the one sentence the row quoted.

## The caveat, stated plainly

The editor's **`test:ci`** (webpack + Electron, the jasmine bundle) was **not run** — a peer held
the box for most of the session and it is the one gate that cannot share.
`tests/lessons/lessonformat.test.ts` lives there and covers `renderMarkdown`; its eight assertions
are restated in the cheap runner (`tests-unit/syl-j1`) and all eight pass, but **that is not the
same as having run it**. Somebody should, before this is called finished.

`DRIVE-2026-09-05-THE-LESSON-RUNNER.md` is still **untracked and is session 8's, not mine**, and
the four modified `SYL-*.md` are session 8's uncommitted edits — left exactly as found.

⚠️ **This prompt IS committed** (`30f94dca`, corrected by `6fab4cca`), and committing it
necessarily carried session 8's own uncommitted edit to this same file along with it. Their
text is above and intact; nothing of theirs was rewritten.

---
---

# Session 10 — SYL-002, the chain that cannot drift (2026-09-05, appended)

WARNING: **Sessions 8 and 9 above are left intact.** This section supersedes only session 9's
**FIRST JOB** list, at item 3: SYL-002 is built, so the list now starts at J2.

Richard's standing rule decided the lane before anything else did: **two sessions had closed zero
ACs** (session 8 drove, session 9 swept defects), so this one **had to build**. SYL-002 was the only
open, unblocked build task — and it had been *seven sessions overdue* with R1 saying *"build the
equality check before lesson 3, not after lesson 12."*

## The board — re-derived from the task FILES

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟢 **BUILT this session, all five ACs.** `bb20c8cc` |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open, independent — **the only open build task left in this phase** |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) … [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md) | 🟢 seven spine lessons built, gated, driven |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 §3 and §6 are Richard's |
| defect registers | **13 open**, every one owner `NONE`. 10 were closed in session 9 |

**Seven of thirteen spine lessons ship** — thirteen, not twelve, because R2 added one, which is the
whole story of this session.

---

## 🟢 What shipped

`npm run lessons:chain` and `npm run lessons:chain:self-test`, both in `pr.yml` beside
`lessons:check`. **6 adjacent pairs compared and holding; 12 mutations, 0 uncaught.**

### 🔴 Its first run found the drift it was written to catch — in `curriculum.json`

**`curriculum.json` had never gained `it-breaks-on-a-phone`**, the lesson R2 ruled into the spine at
position 2. It claimed `poke-it` follows `your-creature-on-screen`. **Six lessons had shipped
against an order the published syllabus did not describe.**

Fixed in the community repo the same session (`63e72b2` on `main` there, Richard asked and answered):
lesson 2 inserted, `poke-it.needs` repointed, the spine lede corrected *Twelve → Thirteen*.
Graded: `uni022-syllabus` 17/17 and `uni007-intake-and-pathing` 31/31 against the edit.

⚠️ **That repo's suite needs its own Postgres on 55432** (`docker compose up -d db` in
`~/vscode_projects/nodegx-community`; the whole suite is ECONNREFUSED without it). **Torn down
after use.** Port 55432, deliberately not 5432 — a homebrew Postgres already holds that one, and
the suite DROPs schemas.

### Where the order lives, and why it is not where the task said

The scope said *"read the order from `curriculum.json`"*. **Richard ruled twice on this**, because
the first recommendation rested on a half-read note:

- ❌ Not `lesson.json`. UNI-022 states the boundary deliberately: *"What is NOT in a manifest is
  curriculum-level: order, prerequisite, and state."*
- ❌ Not `curriculum.json` alone. **CI has no community checkout**, so that gate reports
  *"0 pairs checked"* forever — the hole shaped exactly like the defect.
- ✅ **[`project-examples/lessons/spine.json`](../../../project-examples/lessons/spine.json)**, beside
  the bundles. Adding a lesson stays a data edit.

🔴 **The two files ARE two statements of one fact and they WILL drift**, so they are **cross-checked
whenever the community file is reachable, and disagreement FAILS.** That arm is what found the
drift. Absent is reported as *"NOT RUN … UNMEASURED here"*, never as agreement.

---

## FIRST JOB — J2, then SYL-003 or lesson 8

1. 🔴 **[J2](DEFECTS-THE-RUNNER-DRIVE-FOUND.md)** — *Check my work* on an incomplete step removes the
   instructions and says nothing new. Measured on two lessons, **unowned for six sessions now**, and
   it hits the learner at the exact moment they were stuck. Still the only high-severity row in the
   runner register.
2. **[H1](DEFECTS-LESSON-6-FOUND.md)** — `paramsEqual` on a `stringlist` sorts before comparing, so a
   graded step cannot tell two orders apart. WARNING: **left deliberately twice now** — the honest fix
   adds an ordered form to the authoring format, which is a format decision touching the compiler,
   the evaluator, the copy module and the verifier. **Arguably Richard's call.**
3. **[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md)** — the avatar picker. The only open build task.
4. **Lesson 8 — `snacks`** (`Static Data`, `For Each`, `For Each Actions`). Its opening problem is
   built and waiting. 🔴 **Read all five registers first and check every node name with
   `get_node_type`** — four of seven entries so far named a node that could not do the job.
   ✅ **And it now has a gate**: `lessons:chain` will refuse the bundle unless its starter IS
   `it-gets-demanding`'s finished app, and `spine.json` must gain the row.
5. The remainder: E3, E1, E4/H3 (narrowed, other repo), D1, D3, D4, D5, G2, G3, G4, H2, I1, I2.

---

## 🔴 NOT MINE — `test:main` is red on someone else's in-flight work

`npm run test:main` ends **7143/7144, one failure**, and **it is not this session's**:

```
exp-013/exportBadge.test.tsx:42  expect(deferred.length).toBeGreaterThan(10)
                                 Expected: > 10   Received: 10
```

Controlled, not assumed:

| arm | deferred | guard `>10` |
|---|---|---|
| **HEAD (committed)** | 11 | ✅ passes |
| **working tree (peer, uncommitted)** | 10 | 🔴 fails |

The P18 peer translated **`SubscribeToChanges`** — literally the next item their own hand-off names —
which moved it from `deferred` to `translated` and tripped **their own non-vacuity floor**. It is
their file (`packages/nodegx-export/coverage-ledger.json`, mtime 19:22, uncommitted) and their
guard; the floor is simply too high now that nearly everything is translated.

⚠️ **`test:main` is an UNWATCHED gate and their own package suite will not catch this** — the
assertion lives in `noodl-editor`, not `nodegx-export`. It reaches CI the moment they commit.

## Traps this session paid for

- 🔴 **A recommendation built on a half-read note.** I recommended putting `needs` in `lesson.json`
  and Richard accepted — then the *next sentence* of `curriculum.ts`'s header turned out to forbid
  exactly that. ✅ **Read the whole note before quoting the half that agrees with you**, and when it
  turns out otherwise, say so and re-ask rather than quietly building the accepted-but-wrong thing.
- 🔴 **The self-test read the developer's real community checkout.** Two arms passed here and would
  have gone **red in CI** for a reason having nothing to do with the corpus. ✅ **A self-test that
  only works where somebody happens to have a sibling repo checked out is not a self-test** — it now
  writes a fixture derived from `spine.json`.
- ⚠️ **Two arms first read as "NOT caught" when the gate was right and my expectation was wrong.**
  It reported the divergence in the opposite direction to the phrase I predicted, and it correctly
  exited 0 on a skipped lesson. ✅ **A failing arm is a claim about the expectation as much as about
  the code.**
- ⚠️ **`expect: 'SKIPPED'` alone passes on a gate that prints the word and counts the pair anyway.**
  ✅ **Assert the denominator moved**, not that a sentence appeared.
- ⚠️ **`package.json` carried a peer's uncommitted `reap:orphans` line.** A pathspec commit would
  have swept it. ✅ **Staged my version through `git hash-object -w` + `git update-index --cacheinfo`
  and committed the INDEX** — their line is still in the working tree, uncommitted.
- ⚠️ **`curriculum.json` does not round-trip through `json.dumps`** — its `nodes` arrays are kept on
  one line by hand (662 bytes of reformatting). ✅ **Edited surgically as text.**
- ⚠️ **`tsc -p scripts/tsconfig.json` pulls in the whole editor source and will not finish here.**
  It is **not a CI gate**; `ts-node` full-typechecks by default, so `npm run lessons:chain` running
  clean IS the typecheck, and that is what CI runs.
- ⚠️ **`cd X && …` persists the cwd into the NEXT tool call.** A follow-up `ls` read as
  "No such file or directory" from inside `packages/noodl-editor`.

## Still Richard's, unchanged

The step prose for lessons 2-7, the `description`s and badges, and `LESSON-VOICE.md` §3 and §6.
Two things now wait on that pass:

- ⬜ **`state` in `curriculum.json` is `in-writing` for all thirteen.** Seven bundles ship, but the
  prose is a draft and `LessonState` has only `ready | in-writing` — `ready` would claim the writing
  is finished. **One line per lesson when the prose lands.**
- ⬜ **Four comments in the community repo still say "fifteen lessons"** (`curriculum.ts:111`,
  `pathing.ts:24`, `university/page.tsx:27-28`, `me/assignments/[id]/lesson/route.ts:15`). Prose,
  not code; now sixteen.

## What this session did NOT do

- **The editor's `test:ci`** (webpack + Electron) was **not run**, as in session 9. Nothing this
  session touches editor source — the change is `scripts/`, `package.json`, `pr.yml` and one new
  data file — but that is an argument, not a reading.
- **Nothing was driven.** SYL-002 is a gate; it has no surface a person touches.


---
---

# Session 11 — J2, and the press that never landed (2026-09-05, appended)

WARNING: **Sessions 8, 9 and 10 above are left intact.** This section supersedes only session 10's
**FIRST JOB** list, at item 1: J2 is fixed. The list now starts at H1.

Session 10 built SYL-002, so the *"two sessions, zero ACs ⇒ must build"* guard was not armed, and
J2 had stood at the top of three consecutive hand-offs. It is a 🔴 high row on the surface every
shipped lesson depends on, so this session took it. ⚠️ **Stated plainly: under a strict reading of
the standing rule this was a defect, not a build task** — J2 blocks no AC (SYL-004's negative
control passed). SYL-003 and lesson 8 are still unbuilt, and that is the cost.

## The board — re-derived from the task FILES

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟢 built s10, all five ACs, in CI |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open — **the only open build task in this phase** |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) … [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md) | 🟢 seven spine lessons built, gated, driven |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 §3 and §6 are Richard's |
| **[DEFECTS-THE-RUNNER-DRIVE-FOUND.md](DEFECTS-THE-RUNNER-DRIVE-FOUND.md)** | 🟢 **0 open, 4 fixed — the whole runner register is closed** |
| the five per-lesson registers | **15 open**, every one owner `NONE` |

⚠️ **Counts re-derived, not inherited, and they disagree with earlier boards again.** Grepping the
register tables for owner `NONE` versus `FIXED` gives **24 rows: 15 open, 9 fixed** (L2 4/1, L3 3/2,
L5 3/1, L6 3/1, L7 2/0, runner 0/4). Session 8 said 21, session 9 said 23. Nothing turns on it, but
**re-derive rather than copy** — session 9 flagged exactly this and it drifted again.

---

## 🟢 J2 is fixed, and the row's DIAGNOSIS was wrong

`d36175be`. Read [DEFECTS-THE-RUNNER-DRIVE-FOUND.md](DEFECTS-THE-RUNNER-DRIVE-FOUND.md) for the full
account; the short version is the part worth carrying.

The row said *"Check my work removes the instructions and says nothing new"* — a grading pass that
ran and then discarded the instructions. **It never ran.** `.popup-layer` is fixed, 100vw x 100vh,
`z-index: 10`, and `showPopout` raised a click-eating blocker for **every** popout;
`.lesson-bottombar` carries no `z-index` at all. While the instructions were open — the ordinary
path, since §17 opens them on entering a step — **CHECK MY WORK sat underneath the blocker**. The
press fired the body-level dismissal instead: the popout closed, `instructionDismissed` remembered
it so it never reopened, and the button received nothing.

🔴 **The control that pins it.** On the *reverted* arm, pressing the button a **second** time — the
instructions now gone and `elementFromPoint` returning the button itself — produced the full
grading summary. Same button, same code, same step; the only variable was the blocker. And because
§17 opens instructions on entering a step, **the press a learner actually makes is always the
swallowed one.**

The fix is two opt-ins on `showPopout` (`blockOutsideClicks`, `keepOpenWithin`), both defaulting to
today's behaviour so the ~20 other call sites are untouched — confirmed live. Decisions live in
`views/PopupLayer/popoutdismissal.ts` because `popuplayer.ts` imports `electron` and the plain-Node
runner cannot load it.

## 🟢 test:ci WAS RUN — the caveat sessions 9 and 10 both carried is closed

**2943 specs, 5 failures, seed 28415.** Four are the known **AIX-006** floor. **None is mine.**

🔴 **The fifth is P77's and it is red on `cline-dev` right now, for every peer.**

```
SB-017 acceptance 6 — leaves every browser component alone
  Expected 39 to be 38.
```

Pinned by counting `JavaScriptFunction` nodes in the non-cloud components of
`site-builder.content.json` at each commit that touched it — the spec's own method:

| commit | count |
|---|---|
| `02a3c924` | 38 |
| **`f77e6647`** — *feat(p77/sbr-007): AC3 — a picture can be dropped onto a section* | **39** |
| `4fbd8cd2`, HEAD | 39 |

**`/Admin/SectionRow` went 5 → 6** in `f77e6647` — the picture-drop gesture, exactly that commit's
subject. The literal still says 38.

⚠️ **I did NOT bump it, deliberately.** The spec's own comment says *"the count is the population;
the LINE BELOW is the claim"* — the real assertion is that those browser Function nodes had no cloud
ports written onto them, and the count failing means **that assertion did not run**. Bumping the
literal without checking it is the hole-shaped-like-the-defect move. **Owner: P77 / SBR-007.** The
fix is `38` → `39` plus one sentence naming SectionRow's picture-drop, then re-run `test:ci` to see
what the claim underneath says.

🔴 **Two readings FITTED before one EXCLUDED.** I first attributed the red to a peer's uncommitted
unhold of `site-builder`, then to `4fbd8cd2`. Both were coherent; both were wrong. Counting at each
revision is what settled it. *A reading that fits is not one that excludes* — third repeat.

---

## FIRST JOB — the list, unchanged except that J2 is gone

1. **[H1](DEFECTS-LESSON-6-FOUND.md)** — `paramsEqual` on a `stringlist` sorts before comparing, so
   a graded step **cannot tell two orders apart**. A false pass in a teaching product. WARNING:
   **left deliberately three times now** — the honest fix adds an ordered form to the authoring
   format, touching the compiler, the evaluator, the copy module and the verifier. **Arguably
   Richard's call**, and worth asking him rather than deferring a fourth time.
2. **[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md)** — the avatar picker. The only open build task.
3. **Lesson 8 — `snacks`** (`Static Data`, `For Each`, `For Each Actions`). Opening problem built and
   waiting. 🔴 **Read all five registers first and check every node name with `get_node_type`** —
   four of seven entries so far named a node that could not do the job. ✅ It now has a gate:
   `lessons:chain` refuses the bundle unless its starter IS `it-gets-demanding`'s finished app, and
   `spine.json` must gain the row.
4. **P77's SB-017 literal** (above) — not this phase's, but it is red for everyone until someone acts.
5. The remainder: E3, E1, E4/H3 (narrowed, other repo), D1, D3, D4, D5, G2, G3, G4, H2, I1, I2.

## Traps this session paid for

- 🔴 **A row's OBSERVATION and its DIAGNOSIS are two claims — second session running.** J1 taught
  this in s9; J2 repeated it exactly. The transcript matched character for character and the
  explanation was still wrong, because *"said nothing new"* reads as a quiet check and was actually
  **no check at all**. ✅ **When a symptom is an absence, ask what a total absence would look like.**
- 🔴 **A blocker is invisible to every instrument except `elementFromPoint`.** DOM presence, text and
  even a successful `cdp click` all said the button was fine. `RENDERED ≠ REACHABLE`, and the drive
  doc's own advice — *stamp, check `elementFromPoint`, then confirm the consequence* — is what found
  it. `npm run cdp -- click` printed `clicked … at x,y` for a press that reached nothing.
- ⚠️ **`npm run cdp -- click "button" --nth=3` is not a thing** — the flag is ignored and it clicks
  the FIRST match. It navigated the launcher to another tab. ✅ Stamp `data-drive` and click that.
- ⚠️ **`--list` shows a peer's `tsc` as "dev stack".** `npm run dev:stop` would have killed a peer's
  9-minute typecheck; `NEVER_SWEEP` shields MCP servers and `test:ci`, **not a bare `tsc`**.
  ✅ **Always `dev:stop -- --list` and read the rows before `dev:stop`.**
- ⚠️ **`PIPESTATUS` is a bash-ism and read EMPTY in this zsh**, turning a typecheck into a
  no-reading that looked like a pass. ✅ Run without a pipe and read `$?`, or `$pipestatus[1]`.
- ⚠️ **`test-results.json` is written to `tests/`, not the package root.** Looking in the root said
  "no results" for a run that had completed, which reads exactly like a run that died.
- ⚠️ **A reload drops you back to the launcher**, so a hot-swapped arm needs the whole open path
  re-driven. Both arms here were cold opens, which is what made them comparable.

## Confirmed live in passing, on a fresh profile

Session 9's three fixes, observed on screen for the first time: the badge reads **NodeGX** (J3), and
the prose reads *"Looking for a **Button** called “Poke” on Home and “Poke” with label set to
"Poke""* — a resolved node name (D2) and a named value (J4).

## Still Richard's, unchanged

Step prose for lessons 2-7, the `description`s and badges, `LESSON-VOICE.md` §3 and §6, the
`state: in-writing` line per lesson, and the four "fifteen lessons" comments in the community repo.

## What this session did NOT do

- **Nothing was built.** No AC closed anywhere. See the note at the top.
- **The timeline-click route is unmeasured.** One scripted press on a lesson step did not respond
  and `elementFromPoint` returned the scroll container — session 8's own trap. It is **not**
  evidence the route is broken, and nothing in the J2 account depends on it.
- `DRIVE-2026-09-05-THE-LESSON-RUNNER.md` is **still untracked and is session 8's**, and the four
  modified `SYL-*.md` are still session 8's uncommitted edits — left exactly as found, again.

---
---

# Session 12 — SYL-003, the creature you chose (2026-09-05, appended)

WARNING: **Sessions 8–11 above are left intact.** This section supersedes session 11's **FIRST JOB**
list at item 2: SYL-003 is built. The list now reads H1, lesson 8, SB-017, the remainder.

Richard was asked which of the three lanes to take and **chose SYL-003**. Session 11 built nothing,
so under the standing rule this session had to build, and it did: **all five ACs, driven.**

## The board — re-derived from the task FILES

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟢 built s10, all five ACs, in CI |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | 🟢 **BUILT s12 — all five ACs, driven.** No open build task left in this phase |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) … [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md) | 🟢 seven spine lessons built, gated, driven |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 §3 and §6 are Richard's |
| [DEFECTS-THE-RUNNER-DRIVE-FOUND.md](DEFECTS-THE-RUNNER-DRIVE-FOUND.md) | 🟢 0 open, 4 fixed |
| the five per-lesson registers | **15 open**, every one owner `NONE` |
| **[DEFECTS-SYL-003-FOUND.md](DEFECTS-SYL-003-FOUND.md)** | 🆕 **2 open (K1, K2), owner `NONE`**; 2 more found and fixed inside the task |

⚠️ **Register count re-derived: 17 open across seven files** (15 lesson + K1 + K2). Sessions 8, 9
and 11 each reported a different total; this one is counted, not inherited.

**Seven of twelve spine lessons ship. Lesson 8 is the next one and is unbuilt.**

## 🟢 What SYL-003 is, in one paragraph

Type a word into the image property picker's new *Create an avatar…* route and get 36 creatures —
nine styles × four variations — drawn **on this machine**, deterministically on the word. Pick one
and it is written into the project's `assets/` as an SVG and selected. Full account in
[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md#-built--session-12-2026-09-05); the parts worth carrying
are below.

## 🔴 A licensing decision is now waiting for Richard

The task file said *"DiceBear is MIT"*. **That is the core; the artwork is licensed per style**, and
most of the good ones are not MIT. Only the **nine CC0** styles ship. **`bottts` — the obvious
creature style, the one in the step-1 probe screenshot — is deliberately excluded**, because its
licence is a sentence on a web page (*"free for personal and commercial use"*) rather than a licence
text, and `adventurer`/`fun-emoji`/`croodles`/`big-smile` are CC BY 4.0, which pushes an attribution
into every project a learner exports.

**Nothing is blocked by this** — the picker ships with nine styles. But if Richard wants robots,
that is a decision to take, not a code change. The gate (`avatarLicenceViolations`) reads each
installed package's own `LICENSE`, so adding one reddens CI immediately.

## FIRST JOB — pick one

1. **Lesson 8 — `snacks`** (`Static Data`, `For Each`, `For Each Actions`). **The strongest.** The
   opening problem is built and waiting (lesson 7 ends pointing at `Feed`, `Play`, `Sleep`), the
   chain gate already refuses a bundle whose starter is not `it-gets-demanding`'s finished app, and
   `spine.json` must gain the row. 🔴 **Read all five lesson registers first and check every node
   name with `get_node_type`** — four of seven entries so far named a node that could not do the job.
2. **[H1](DEFECTS-LESSON-6-FOUND.md)** — `paramsEqual` sorts a `stringlist` before comparing, so a
   graded step cannot tell two orders apart, and a `States` node starts in its *first* state. A false
   pass in a teaching product. WARNING: **deferred four times now.** The honest fix adds an ordered
   form to the authoring format (compiler, evaluator, copy module, verifier) — **worth asking Richard
   rather than deferring a fifth time.**
3. **P77's SB-017 literal** — `Expected 39 to be 38`, still red on `cline-dev` for every peer.
   Unchanged from session 11: the fix is `38` → `39` plus a sentence naming SectionRow's
   picture-drop, then re-run to see what the assertion underneath says. **Owner: P77 / SBR-007.**
4. **[K1](DEFECTS-SYL-003-FOUND.md)** — `delete_component` leaves a dangling router route.
5. The remainder: E3, E1, E4/H3 (narrowed, other repo), D1, D3, D4, D5, G2, G3, G4, H2, I1, I2.

## Traps this session paid for

- 🔴 **`npm run cdp -- network offline` DOES NOT SURVIVE the CDP client disconnecting.** Set it in
  one command, measure in the next, and the `fetch` control comes back **`REACHED THE NETWORK`**.
  Any offline claim written the obvious way measures the **online** app and passes. ✅ Do the
  emulation and the measurement in **one session** and read a control on **both sides** of the
  drive — `scratchpad/offline-in-app.js` is the worked example. Filed as
  [K2](DEFECTS-SYL-003-FOUND.md). *This is the session's most transferable finding.*
- 🔴 **A LICENCE ON THE WRAPPER IS NOT A LICENCE ON THE CONTENT.** `@dicebear/core` is MIT and says
  so in `package.json`; nine of its style packages say `"See LICENSE file"` and ten say
  `(MIT AND CC-BY-4.0)`. The task file had recorded the wrapper's licence as the product's. ✅ For
  any dependency shipping **assets**, read the per-package `LICENSE`, not the root `license` field.
- 🔴 **An ESM-only dependency fails a CommonJS jest suite TO RUN**, taking every unrelated spec in
  the directory with it (`Cannot use import statement outside a module`). This repo has no
  `@babel/preset-env`, so there is no ESM→CJS transform in `tests-unit`. ✅ Keep the import in one
  webpack-only leaf and inject the library into the pure module — the pattern `projectAssets.ts`
  and `popoutdismissal.ts` already use. Webpack itself bundles it with no complaint.
- 🔴 **A `TypeView` is handed a `ModelProxy`, not the `NodeGraphNode`.** It forwards `getParameter`,
  `type` and `variantName` but forwarded no `label`, and `label` is a *getter* — so
  `parent.model.label` read `undefined` in silence. ✅ Probed it live rather than guessing
  (`hasModel: true, labelType: "undefined"`); fixed by forwarding it.
- ⚠️ **`cdp eval` snippets share ONE scope.** A second `const leaf = …` throws
  `Identifier 'leaf' has already been declared` — and the throw skipped a re-stamp, so a stale
  `data-drive` from the *previous* eval was still on the wrong element and read as reachable.
  ✅ Wrap every eval in an IIFE, and clear `[data-drive]` at the top of each one.
- ⚠️ **Climbing from a card's title overshoots** — session 8 recorded this and it happened again:
  six levels up from the launcher card's name is the 1144×687 **grid**, which `elementFromPoint`
  happily calls reachable. ✅ Walk the ancestor chain printing each `getBoundingClientRect` and stop
  at the card-sized box (three levels, 344×261 here).
- ⚠️ **The node graph canvas is not DOM.** No selector reaches a node; `cdp click` takes a selector
  only. ✅ `cdp drag "x,y" "x+1,y+1" 3` selects a node, and the property panel it opens *is* DOM.
- ⚠️ **A bound port shows a `BindingChip`, not a picker.** To drive a picker you need a port nothing
  is wired to — reload to the launcher first so the editor is not holding the project, then edit
  `connections.json` on disk, then reopen.
- ✅ **A project not in the launcher can be added** by inserting into
  `~/Library/Application Support/NodeGX/recently_opened_project.json` and reloading; entries whose
  directory no longer exists are filtered out on the next `fetch()`, so deleting the folder cleans up
  after itself.

## Gates

`test:main` **429 suites / 7178 tests, exit 0.** `tsc -p packages/noodl-editor` **exit 0.**
`test:ci` **2943 specs, 5 failures, seed 71374** — four **AIX-006** (the documented floor, by name)
and P77's **SB-017**. **None is this session's**, and the count is unchanged from session 11.

## Committed

The feature is **`3e0eaa0c`** — 13 files, committed by explicit pathspec because every *other*
modified file under `packages/noodl-editor` right now belongs to a peer. ⚠️ `@electron/notarize`
moves position in `package.json`: that is npm alphabetising during the install, not an edit.

`DRIVE-2026-09-05-THE-LESSON-RUNNER.md` is **still untracked and is session 8's**, and the four
modified `SYL-00[5-8].md` are still session 8's uncommitted edits — left exactly as found, again.
