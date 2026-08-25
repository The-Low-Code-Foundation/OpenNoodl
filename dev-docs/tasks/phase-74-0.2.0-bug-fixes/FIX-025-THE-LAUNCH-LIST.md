# FIX-025 — the twelve things Richard found before 0.2.0

**Filed:** 2026-08-20, from Richard, using the app. **Worked:** 2026-08-20 → 08-21.

Twelve reports in one list, spanning the Blockly canvas, the launcher, the editor rail, the
community mirror, the learning surfaces and the community platform. **Twelve are closed** — seven of
them confirmed in a running editor, and bug 6 proved in production on 2026-08-21. One (11b) has a
second half deliberately left, scoped as `FIX-026`. **Driving them turned up a thirteenth bug,
which 11a had just made reachable** — see the drive section.

---

## The two that are worth reading even if you only read one section

### 1. The intake 500 was diagnosed by reading the production log, not by reproducing it

Three sessions had tried to reproduce `POST /api/v1/me/intake` → 500 locally. Session 49 spent most
of a session on nine dimensions and got nine clean results. **The log had never been read.**

```
[api] POST /me/intake failed: TypeError: The "string" argument must be of type string or an
  instance of Buffer or ArrayBuffer. Received an instance of Object
    at Function.str (.next/server/chunks/4940.js:22:12098)   ← postgres.js bytes.str
    at Array.forEach                                          ← postgres.js Bind
  code: 'ERR_INVALID_ARG_TYPE'
```

Two timestamps, 21:05:13 and 21:07:06 on 2026-08-20 — Richard's two attempts.

🔴 **And `learner_intakes` had 0 rows.** No intake has *ever* saved in production. The feature has
never worked for anybody, which the local suite could not show because the local suite passes.

Measured on the production host against the production database: the identical statement with the
identical payload **succeeds** outside the Next bundle. So the SQL, the data and the schema are
all fine, and the fault lives in the built bundle — which is exactly why every local reproduction
came back clean.

⚠️ **The mechanism is NOT established, and the fix is not confirmed.** See the header comment on
`recordIntake` in the platform repo: the obvious story (a `Parameter` wrapper failing an
`instanceof` across duplicated module copies) does not survive being worked through, because every
branch still ends at a serializer that returns a string. The change removes the wrapper — the one
object on that path — rather than explaining it. **The proof is a deploy plus one saved intake.**

### 2. The first attempt at that fix was wrong, and the suite caught it

`${JSON.stringify(answers)}::jsonb` broke five tests with `cannot call jsonb_each_text on a
non-object`. postgres.js takes each parameter's type from the server's `Describe`, so a bare
`::jsonb` makes Postgres infer `$1` as jsonb and the jsonb serializer `JSON.stringify`s text that
is *already* JSON — storing a double-encoded **string scalar**. The intermediate `::text` pins the
inferred type so the string is sent verbatim. Verified directly: `jsonb_typeof` answers `object`
with the double cast and `string` without it.

---

## The twelve

| # | Report | Where it was | Status |
|---|---|---|---|
| 1 | Last block in the Blockly drawer sits under the Run bar | `BlocklyWorkspace.tsx` | ✅ |
| 2 | Opening a project lands on the Community panel | `useSetupSettings.ts` | ✅ |
| 3 | Launcher opens on Community | `usePersistentTab.ts` | ✅ |
| 4 | Learning tab says "Sign in" while signed in | `useLearnerPath.ts` | ✅ |
| 5 | Signed-out intake questions look answerable | `LearnerPathSection.tsx` | ✅ |
| 6 | `POST /me/intake` → 500 | platform `pathing.ts` | ✅ **deployed `c5d3ad5`, PROVED** |
| 7 | Answered question still says "no reply yet" | `useCommunityMirror.ts` | ✅ |
| 8 | Current step shows two check icons | `LessonLayerView.css` | ✅ |
| 9 | "Check my work" doesn't explain itself | `lessonconditioncopy.ts` | ✅ |
| 10 | Long step description overflows, can't scroll | `LessonLayerView.css` | ✅ |
| 11a | "State on a page" Caption step won't complete | `lessonevalconditions.ts` | ✅ |
| 11b | Protection against wrecking the tutorial | `lessonprotection.ts` | ⚠️ half |
| 12 | Wrong-typed wire into a Visual Function is silent | `connectionCoercion.ts` | ✅ **DRIVEN 08-25** |
| **13** | **Finishing a lesson blanked the lesson bar** — found by driving 11a | `lessonstepflow.ts` | ✅ |

### 11a — the shipped lesson had never been completable

`findNodeWithPath` resolved a `#label` / `%type` segment against **`component.graph.roots` only**.
A node dropped onto a page is a child of the `Page` node, so *all three* graded steps of the
installed *State on a page* lesson named a node that could never be found — not just the Caption
one Richard reported. His Caption node is in the project file with `"type": "Text"`,
`"label": "Caption"`; nothing could see it.

🔴 **Nothing detected this because every fixture in the suite put the graded node at the root.**
This is the run-the-checker-over-the-corpus-that-exists shape, again.

⚠️ **A spec had to be reversed:** `lessonbundleverify.test.ts` called a one-level-too-shallow path
*"the depth mistake"* and required F2 to refuse it. Depth is no longer significant for a named
segment, so that path is now correct. F2 still earns its place — the sibling test, where the prose
says `Caption` and the solution says `Greeting`, still fails.

### 8 — a CSS specificity defect that only showed in the state nobody checks

`.lesson-item .lesson-checkmark svg { display: block }` is (0,2,1); the rule hiding the completed
glyph is (0,2,0). The sizing rule won, so **both** glyphs drew on every incomplete step. A
*completed* step looked right, because its hiding rule is (0,3,0) and did win — so the one state
anybody verifies was the one state that rendered correctly. `display` is now off the sizing rule
entirely. The incomplete glyph also lost its tick and is now an empty ring, per Richard.

### 2 and 3 — two reversals of specced behaviour, on Richard's instruction

Both surfaces remembered where you were. FIX-024's fifth acceptance criterion explicitly drove and
recorded *"It persists."* Richard asked for Projects / Components unconditionally, having now
reported this class of thing twice — FIX-024's own title is *"the launcher opens on the Learning
section, not on your projects."* Remembering the tab is what makes the opening screen
unpredictable. **The writes are kept**, so restoring is a one-line change if it is ever wanted back.

### 12 — the narrow, honest slice of Direction C

The existing `con-type-mismatch` error only fires when `canCastPortTypes` says *no*, and for
`string → number` it says *yes* — the `typecasts` table permits it. `PORT-TYPE-CONTRACT.md` says
the quiet part itself: *"the table gates the editor; it converts nothing."* So the port declared
`number` holds `"5"`, and `"5" + 1` is `"51"`.

New `con-type-unconverted` **warning** (never an error — the contract's rule is that declaring a
type must not make a port less connectable, and casts are additive only). Deliberately narrow:
`string → number` and `string → boolean` only, the two where behaviour changes silently.
`string → boolean` is the worse one — **`"false"` is truthy.**

### 11b — what was NOT built, and why

Richard asked for **both** a warn-on-delete and a restore.

✅ **Built:** deleting a node a lesson step is grading now asks first, naming the step. A confirm,
never a refusal — the lesson's own first step says *"Edit it freely — that IS the lesson."*
Derived from the same `completeWhen` conditions grading reads, so an author cannot forget to
maintain it. A type-only condition protects a node only when it is the **last of its type**, which
is precisely when deleting it makes the step ungradeable; warning on every Text would fire on the
learner's own scratch nodes and train them to click through the dialog.

❌ **Not built: per-step restore.** Putting nodes back means graph mutation — re-inserting with
parents, parameters and undo integration — and it could not be verified this session (no drive; see
below). Shipping an unverified graph-mutating action into a launch branch is the wrong trade.
`LearningFolderModel.reset()` already provides a destructive recovery path, so a learner is not
stranded. **This is the outstanding half of Richard's answer and should be scoped as its own task.**

---

## Gates

- editor `npx tsc --noEmit -p packages/noodl-editor` — **clean**
- editor `test:main` — **300 files / 4865 tests / 0 failures** (re-measured 2026-08-21, exit 0)
- platform `npx tsc --noEmit` — **clean**
- platform `vitest run tests/uni007-intake-and-pathing.test.ts` — **30/30**, re-measured before the
  deploy; platform `tsc --noEmit` exit 0
- new: `tests-unit/fix-025/` — **5 files, 33 specs**; the new one is mutation-checked (4 of its 8
  rows fail against the pre-fix rule)

⚠️ **A pre-existing gate defect was fixed to get here.** `uni-001/session-readers.test.ts` walks
`packages/*/src` and its `SKIP` set covers `dist`/`build` but **not the webpack bundles that live
inside `src/`** — `src/editor/index.bundle.js` and its viewer-frame sibling are gitignored build
artifacts (`.gitignore:171`) last written at 14:40 on 2026-08-20 by somebody's dev build. They
contain a compiled copy of everything the gate scans, so on any checkout where a build has run they
appear as two unrecorded session readers and the file goes red — **for a build, not for a code
change**, and invisibly, because `git status` cannot see an ignored file.

---

## ✅ Driven, 2026-08-21 — and the drive found a thirteenth bug

Every visual item was put in front of a running editor. **Bugs 1, 8, 9, 10, 11a and 11b are
confirmed by measurement, not by reading.** Bugs 2, 3 and 4 were confirmed in passing.

| # | What was measured | Reading |
|---|---|---|
| 1 | Blockly SVG vs its container, then the flyout scrolled to its end | `.Root` **468px**, `.Workspace` **439px** — a 29px strip — and the SVG is **439**, not 468. Math flyout scrolled fully: last block **688–716**, inside the flyout (285–724) and clear of the strip; first block at **−32**, so this really is the bottom |
| 8 | Computed `display` on both glyphs, in both states | Incomplete: ring `block`, tick `none`. Completed: the reverse. **Exactly one glyph either way**, and the incomplete one is **1 circle, 0 paths** — an empty ring |
| 9 | The control on a graded step vs an ungraded one | Graded (*Add a second Text*): button **present**, *"Looking for a Text called “Caption” on Home."* Ungraded (*Log a thing*'s closing popup): **absent**. After a run the "Looking for" line is replaced by the summary |
| 10 | Popup geometry, then stressed with a 2310px body | `max-height` **624.8px** (80vh), `overflow-y: auto`, rect **78–703** of a 781px viewport, scrolled to `scrollTop` **1685 = maxScroll**. Stays on screen and reaches its own bottom; EXIT LESSON stays reachable |
| 11a | The three graded steps, then the runner | All three **complete**, including the Caption step. Runner: *"All 3 checked steps are done"* — it had said *"1 of 3 … Step 2 is the first one still to do"* |
| 11b | Delete a graded node, then an ungraded one | Caption → *"This is part of the lesson — “Caption” is one of the nodes this lesson is looking for — the step “Add a second Text” checks for it."* **Keep it** kept it. `HTTP Request` → **no prompt**, deleted |

### 🔴 13 — finishing a lesson made the lesson disappear, and 11a is what exposed it

The first attempt to open *State on a page* rendered an **empty `<div class="lessonlayerview">`**:
no steps, no bar, nothing. Instrumenting the boot path showed the steps loading fine (`steps= 4`)
and then `refresh()` returning without rendering.

`refresh()` chose between *advance* and *render*, and **advance is the branch that does not
render**. `LessonModel.next()` returns without doing anything once `index >= numberOfLessons - 1`
(`lessonmodel.ts:230`), so on a **complete final step** the layer advanced nothing, fired no
`instructionsChanged`, and never called `_renderReact` — permanently, because every later
`refresh()` made the same choice.

⚠️ **Latent since the code was written, and only reachable because of 11a.** While
`findNodeWithPath` could not resolve a `#label` below a graph root, no graded step in that lesson
could complete, so `isComplete` was never true on a last step. Repairing the grading is what
created the failure. **No amount of reading the 11a diff would have found this** — it is the
argument for driving a fix, and it is why the previous session's decision to leave the drive
undone was a real risk rather than a formality.

The decision now lives in `views/lessons/lessonstepflow.ts` as a pure function, because nothing
in `lessonlayer2.ts` is reachable from the jest runner and a comment is not a regression guard.
`tests-unit/fix-025/last-step-renders.test.ts` grades it — including a *known-firing* row that
still advances from steps 0–2, so "never advance" cannot pass. **Mutation-checked:** reverting
the rule to the pre-fix form fails 4 of its 8 rows.

## Bug 6 — ✅ CLOSED, proved in production 2026-08-21

Richard answered the three questions in the editor and the row landed. Measured on nexus-1:
**1 row, `jsonb_typeof` = `object`, `taken_at` 08:34:11Z.** `learner_intakes` had been empty since
the table was created — **this is the first intake that has ever saved.** The `::text::jsonb`
double cast is doing its job: the answers are a jsonb *object*, not the double-encoded string
scalar the first attempt at the fix produced.

⚠️ **The mechanism is still not established, and the comment on `recordIntake` still says so.**
What is now known is that removing the `Parameter` wrapper fixes it inside the built bundle. If
the same `TypeError` appears on another route, that is the signal to convert the remaining
`sql.json()` call sites.

<details><summary>The state before it was proved, kept for the reasoning</summary>

### deployed, and half-proved

`c5d3ad5` is live on nexus-1 (deploy verified: site 200, sign-in 302, all three neighbours 200).
The fix is **confirmed present in the built bundle** — `.next/server/chunks/7561.js` reads
`values (${b}::uuid, ${JSON.stringify(c)}::text::jsonb)`, no `sql.json`, which is the thing that
could not be assumed since the fault only appears after bundling.

🔴 **What is still NOT proved: that the route now answers 200.** `learner_intakes` was 0 rows
before the deploy and is 0 rows after, because nobody has taken the intake since. That test needs
an authenticated `POST /api/v1/me/intake`, and the two ways to run it from here were both
refused by the sandbox: once using Richard's stored editor session, once minting a disposable
probe account on the host. **Neither was retried around, and neither should be** — the first
would spend his credential and write a learner path he did not choose.

✅ **The remaining test is one action by Richard**: answer the three questions in the Learning
tab and press *Build my path*. Then, on the host:

```bash
ssh nexus "cd /opt/nodegx-community && printf '%s\n' \
  'import postgres from \"postgres\"' \
  'const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} })' \
  'console.log((await sql\`select count(*)::int n from learner_intakes\`)[0].n)' \
  'await sql.end()' > ./count.mjs && set -a && . /etc/nodegx-community/nodegx-community.env \
  && set +a && node ./count.mjs; rm -f ./count.mjs"
```

**One row is the pass.** If it is still 0, the cause is logged:
`journalctl -u nodegx-community --since '1 hour ago' | grep -A20 'me/intake failed'`.

</details>

## 11b's second half is still not built

Per-step restore. Unchanged from the note above: it mutates the graph and wants its own task.

⚠️ **And the drive turned up a constraint that changes its shape.** Restore needs a *pristine*
copy to restore *from*, and there isn't one inside the lesson folder — `Learning/<slug>/` **is**
the learner's working copy. The only pristine source is `entry.source.path` in the register,
which for *State on a page* is `/tmp/claude-501/uni-007-drive-bundles/bundle-good`: present
today, gone on the next reboot. So restore either stands on the same footing as `reset()` and
refuses with the same wording when the bundle has gone, or the installer has to keep a snapshot
— which is a decision, not an implementation detail, and is why this is a task and not a patch.

## ✅ Bug 12 — DRIVEN 2026-08-25, and the drive found a defect on its own surface

The fixture is a Visual Function whose block program declares three inputs — `count` as
`number`, `flag` as `boolean`, `label` as `string` — with a Text Input's `onTextChanged`
(a `string` output) wired into **all three**. One source, three targets, one health pass:
two of them are the pairs `UNCONVERTED` lists and the third is the control.

✅ **`detectIO` was run headlessly on the workspace before the editor was ever launched** and
printed exactly those three ports and types, so a silent readout could not later be blamed on
a fixture that never published the ports. The canvas then showed the same three.

| surface | `count` (string→number) | `flag` (string→boolean) | `label` (string→string) |
|---|---|---|---|
| `WarningsModel` | `con-type-unconverted` | `con-type-unconverted` | **none** |
| wire on the canvas | **dashed** | **dashed** | **solid** |
| hover tooltip | the sentence | the sentence | none |
| Warnings panel | listed, *"At connection between Field (Text) and VF (count)"* | listed | — |

🔴 **The control is the point, not decoration.** `label` is fed by the *same output* in the
*same pass* as two wires that did warn, so its silence is the rule declining — not the pass
never running. Total warnings read **2**, and the toolbar badge read **2** beside it.

✅ **The live gesture too, not just the file.** Removing the `count` wire dropped the total to
**1 immediately**; re-adding it brought it back to **2**, and the wire back to dashed.

⚠️ **It takes two seconds.** `EVALUATE_HEALTH_DEBOUNCE_MS` is 2000 (the urgent lane is 50 ms and
this warning is deliberately not on it), so a builder who drags a wrong-typed wire sees nothing
at all for two seconds. Measured: absent at +0.5 s, present at +4 s. That is the existing lazy
lane working as designed and is **not** a defect — but it is worth knowing that Richard's
original *"it didn't throw an error"* has a two-second window in which that is still true.

### 🔴 The defect the drive found: the tooltip put one word on each line

Hovering the wire produced the right sentence in the wrong shape:

```
This connects a
string
to a
number
port, and the text arrives as text — …
```

`.popup-layer-tooltip-content` was `display: flex; flex-direction: column`. **A flex container
has no inline formatting context**, so every child is blockified — each `<strong>` *and each
bare run of text between them* becomes its own flex item on its own line. Measured in the
running editor: `getComputedStyle(strong).display === 'block'`.

⚠️ **Never specific to this warning.** `con-type-mismatch` builds its message the same way
(`'…type <strong>' + name + '</strong> cannot be connected…'`), so every type warning has
hovered like this since it was written. The new sentence is just long enough to be unmissable.

✅ Fixed to `display: block`, which costs nothing: every structured tooltip this container is
given is already block-level markup — `<h3>`, `<p>` and `.popup-layer-image-row`, all built by
`noodl-viewer-react/src/tooltips.ts` — so they stack exactly as before. Re-measured live after
HMR: `strong` is `inline`, the tooltip is **one line of prose**, 1074 px wide inside a 1368 px
viewport. The Warnings panel was always correct and is unchanged.

🔴 **And the two right surfaces are why this was nearly missed.** The dash was right, the panel
was right, and the model held the correct string. Reading any one of those would have closed
the bug. **Only the third surface was wrong, and only rendering it showed that.**

`tests-unit/fix-025/tooltip-renders-inline-markup.test.ts` guards it — 4 specs, and
mutation-checked: restoring `display: flex` fails it. It grades the stylesheet rather than a
render because neither runner can render this rule (jest is `testEnvironment: 'node'`; the
jasmine renderer suite does not load the editor stylesheet), and it carries a known-flex
fixture so *"no violation found"* cannot quietly mean *"the rule was never located"*.

## What the drive did NOT cover

- **Bug 5** (signed-out intake questions) — ⚠️ **less open than this line used to read.** The
  render decision is already specced and guarded: `tests-unit/uni-007/learnerpath-render.test.tsx`
  has *"🔴 does NOT draw the options — an unanswerable form reads as a broken one"*, plus the
  question-count assertion and a no-sign-in-door control. What is unseen is only the **live
  signed-out launcher**, and seeing it still means signing out of Richard's live community
  session on this machine. Not done, and not worth his session.
- **Bug 7** (mirror reply) — specced, not driven; it needs a real answered thread. ⚠️ And there
  is a **second cause of the same sentence that the editor fix cannot reach**: the platform
  sends `firstReplyMinutes: null` on a thread with `replyCount: 1`, and
  `communityMeta.ts:98` turns `null` minutes into *"no reply yet"* unconditionally, so an
  answered thread reads unanswered **on every surface, web included**. 🔴 **Do not patch
  `replyLatency` to check `replyCount` without deciding the other half**: its own docstring
  says `null` minutes is what the health readout counts as `unreplied`, so the tab's count is
  wrong by the same data and fixing only the row would leave the two disagreeing. Unowned, and
  it is a decision rather than a patch.
