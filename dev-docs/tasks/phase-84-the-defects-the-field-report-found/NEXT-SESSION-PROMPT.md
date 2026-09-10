# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is now answered (0.2.3)** and
four still gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 6)

Seventeen files, each grepped for its own `🟢 **BUILT**` marker. **Six built, eleven never built.**
That is the file count, not a copied status. Re-derive it, do not inherit this table:

```sh
cd dev-docs/tasks/phase-84-the-defects-the-field-report-found
for f in FLD-*.md; do printf '%s ' "$f"; grep -q '🟢 \*\*BUILT\*\*' "$f" && echo BUILT || echo '⬜'; done
```

**Track A — it went wrong and said nothing** (outranks track B in every ordering decision)

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-001 | The Columns node measures itself | #21 | 🟢 **BUILT** `3c13818d` · ✅ **replied + closed** | — |
| FLD-004 | A wire into a dimension port is honoured, or refused out loud | #26 | ⬜ never built | 🔴 **R4** |
| FLD-005 | A column of Groups does not multiply out | #35 | ⬜ never built | 🔴 **P13 collision** |
| FLD-006 | Fit view fits | #33 | 🟢 **BUILT** `901280af`, AC1 driven · ✅ **replied + closed** | — |
| FLD-007 | A lesson step that can be completed | #5 | 🟢 **BUILT** `4068d139` · ✅ **replied + closed** | — |
| FLD-008 | An aggregation that cannot answer says so | #14 | 🟢 **BUILT** `d1daabb1` · ✅ **replied + closed** | — |
| FLD-009 | The editor does not overwrite what an agent wrote | #41 | 🟢 **BUILT** `fa227028`, driven · ✅ **replied, issue STAYS OPEN** | — |
| FLD-012 | The empty-box warning stops crying wolf | #32 | 🟢 **BUILT** `0df984a11`, AC1–AC5 measured · ✅ **replied + closed** | — |

🔴 **Track A is now exhausted except for its two gated tasks.** Both need a decision, not work:
FLD-004 needs **R4**, FLD-005 needs **P13** resolved. Do not start either without it.

**Track B — it costs too much to install and to drive**

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-002 | The Columns node says which breakpoint it is at | #22 | ⬜ never built | FLD-001 ✅ **unblocked** |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002, FLD-004, **R3** |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009 ✅ unblocked, **R6** |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | ⬜ never built | — **ungated** |
| FLD-013 | An agent learns what will not translate before it designs | #37 | ⬜ never built | — **ungated** |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | — **ungated** |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | ⬜ never built | — **ungated** |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

## 2. 🔴 The reply gate is OPEN — stop asking, start sending

Richard granted **standing authorisation** on 2026-09-10: post and close from his GitHub account,
**no ask**. `gh` is authenticated as `richardosborne14`. Two things are mandatory on every reply:

1. A first line saying it is an **automated reply generated from Claude**.
2. **The release the fix ships in.**

🔴 **Re-derive that release per issue — do NOT inherit "0.2.3".** Session 6 was about to write
"0.2.3" on four replies and checked first: **0.2.2 is published** (2026-09-07, `gh release list`),
and all four fixes were already in it. `git show v0.2.2:<path>` and
`git merge-base --is-ancestor <sha> v0.2.2` settle it in seconds, and *"already published, in
0.2.2"* is a far better answer to a reporter than *"it will ship in 0.2.3"*.

**Ten sent. Session 6 sent five** — #32 (FLD-012, replied + closed) and the whole of §3: #9, #12,
#1, #15, all replied and closed.

🔴 **#41 is still the lesson in one direction, and #15 is the lesson in the other.** #41 asks for
the `session_status` tool (FLD-010, unbuilt) and stays open because FLD-009 fixed a *different*
half. #15's three symptoms had two named replacements and a third that was **never reproduced
here** — so it was closed as *overtaken by the rebuild*, not as fixed-and-verified, and the reply
says exactly that and invites a reopen. **Do not claim a verification you did not do.**

⚠️ **Re-run the §5 sweep, do not read the table.** Session 6 ran it: **15 issues carry a task, 24
rows, nothing missing.** It has caught an omission twice before; it is one command and it is
recorded in §5 of the [register](./DEFECTS-THE-FIELD-REPORT-FOUND.md).

**Distance: 6 of 17 built. 10 replies sent, 14 still owed.**

## 3. The next task to build

Track A outranks track B, and **track A has nothing left that is not gated**. So either get R4 or
P13 decided, or build the best ungated track-B task. Of those four, ranked:

1. **[FLD-011 — the render report writes to disk and stops sleeping](./FLD-011-THE-RENDER-REPORT-WRITES-TO-DISK-AND-STOPS-SLEEPING.md)**
   (#40). Ungated, and session 6 has just been living in this exact code — `render-report.js`,
   `withRenderedPage`, `measure-from-disk.js`. ⚠️ It asks for the corpus to grade **finding
   stability, not just speed** (its §4): `demo/fld-012-arms.js --corpus --json <file>` now produces exactly
   that readout, and `--report <file>` re-derives it without re-rendering.
2. **[FLD-002 — the Columns node says which breakpoint it is at](./FLD-002-THE-COLUMNS-NODE-SAYS-WHICH-BREAKPOINT-IT-IS-AT.md)**
   (#22). Unblocked by FLD-001, and it is the only remaining task on an issue a reporter is still
   waiting on that has no gate at all.
3. **FLD-013** / **FLD-014** — both ungated, both MCP-surface work.

🔴 **FLD-004 needs R4, FLD-005 needs P13, FLD-015 needs R2 and P9. Do not start any of them without
the ruling.** **FLD-010 is unblocked** and R6 can reasonably be answered *no* — that is what the
#41 reply said in public. Ask before building a locking protocol.

## 4. What session 6 learned that the next one should not re-learn

✅ **One render, four arms — the shape to copy for anything measured inside the page.**
`demo/fld-012-arms.js` renders each page **once** and evaluates four textually reverted builds of
the measurement expression against that **one DOM**. A before/after taken as two renders is two
DOMs, and calling the difference a fix is a guess. It also makes each half of a two-part fix
separable, which is how AC3's number came out honest.

🔴 **`appearance: none` is the computed default of a plain `<div>` in Chrome.** FLD-012's own §3
proposed skipping empty boxes by it. That would have suppressed **every finding on every page**,
including the author's genuinely empty box, and read as a clean pass. **A CSS property whose
initial value equals the discriminating value discriminates nothing** — check the computed default
on a bare element before making any property a test. Register row **P22**.

🔴 **A rule reading 0 in BOTH arms grades nothing.** FLD-012's AC4 named four inheriting rules;
three of the codes **do not exist** (`accent-poverty`, `accent-dominance`, `irregular-rhythm`) and
every one read `0 → 0`, which looks exactly like *"the fix left it alone"* and is really *"nothing
was ever counted"*. The readout now prints `NOT EXERCISED by this corpus — grades nothing` for that
case — the same shape as asserting an absence with no known-firing signal beside it. And the rule
that actually moved — `flat-type-scale`, **18 → 14** — was **not in the doc's list at all**: it
inherits `visible` through `textEls`, and its `>= 10 text elements` gate was being cleared by text
nobody could see.

🔴 **The catalog carries TWO of each UI control.** `Radio Button` / `Range` are `isDeprecated:
true, inNodePicker: false`; the picker offers `net.noodl.controls.radiobutton` /
`net.noodl.controls.range`, and they render **different markup**. Session 6's first fixture used
the deprecated pair by accident and reproduced a real false positive that was **not the
reporter's**. Any fixture built from a display name is exposed to this. Register row **P23**.

⚠️ **Comments inside `measureExpression` live in a template literal.** A backtick in a comment
terminates the string. Existing comments escape them (`` \` ``); a blanket replace will clobber
those four lines. Write comments backtick-free and diff before committing.

✅ **A control run is cheap and it settles attribution.** `@noodl/mcp` came back 2 suites / 3 tests
red. Snapshotting the changed file, restoring `git show HEAD:<path>` over it, running just those two
suites, and copying the snapshot back took about a minute and proved them **pre-existing** —
identical 3 failed / 15 passed without the change. `def018-def020-layout-drive` and
`sbr009ThemeEditorDrive` use `withRenderedPage` but never `measureExpression`, so they could not
have been affected. **Never `git stash` here; snapshot and `cp` back.**

## 5. Gates, as they stood at the end of session 6

`npx lerna run test --scope @nodegx/render-measure` **2 suites / 13 tests, exit 0** ·
`npm run test:main` **446 suites / 7359 tests, exit 0** — identical to session 5's baseline, and
correctly so: `@nodegx/render-measure` is gated by **`test:packages`**, not by `test:main`.

⚠️ **`@noodl/mcp` is 2 suites / 3 tests RED at HEAD, and it is NOT ours** — `def018-def020-layout-drive`
(D28 expects an overlap defect to reproduce and gets 0 overlaps) and `sbr009ThemeEditorDrive` (two
AC2 arms). Proved pre-existing by the control described in §4. **Somebody should own these**; they
are in `test:packages`, which is a PR gate.

🔴 **Read a gate's exit status out of the LOG, not out of the harness notification.**

⚠️ A peer session held **phase 83 / nodegx-export / noodl-preview** work uncommitted in this
checkout throughout session 6 (`nodegx-export/src/cli/*`, `noodl-preview/*`,
`noodl-editor/.../compilation/build/*`, untracked `hls014-*`). **Commit by pathspec.** It did not
redden `test:main`.

## 6. 🔴 Rulings — one down, four still gating

✅ **R1 ANSWERED: 0.2.3, not split** (Richard, 2026-09-10) — but see §2: what is *already published*
is **0.2.2**, and four replies were corrected to say so before they went out.

Still open: **R2** charts as a kit or core nodes · **R3** the Advanced Columns prefab · **R4** does
the units-port fix ship in a patch · **R5** is minification in scope · **R6** does FLD-010 include
the lock (**answered "probably not" in public on #41 — confirm**). Full wording in
[README.md](./README.md) §2.

🔴 **R4 and P13 are now the phase's critical path**, because they are the only things standing
between the next session and the last two track-A tasks.

## 7. The end condition has not moved

The phase closes when the issues are each **fixed and closed, or answered on the thread with the
measurement that changed our mind**. Read the count off §5 of the register, not off README §6's
"fifteen".

**Ten sent, fourteen to go.**
