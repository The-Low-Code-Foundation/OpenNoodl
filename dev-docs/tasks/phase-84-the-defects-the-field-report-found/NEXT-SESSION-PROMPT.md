# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is now answered (0.2.3)** and
four still gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 4)

Seventeen files, each grepped for its own `🟢 **BUILT**` marker. **Four built, thirteen never
built.** That is the file count, not a copied status.

**Track A — it went wrong and said nothing** (outranks track B in every ordering decision)

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-001 | The Columns node measures itself | #21 | 🟢 **BUILT** `3c13818d` · ✅ **replied + closed** | — |
| FLD-004 | A wire into a dimension port is honoured, or refused out loud | #26 | ⬜ never built | R4 |
| FLD-005 | A column of Groups does not multiply out | #35 | ⬜ never built | 🔴 **P13 collision** |
| FLD-006 | Fit view fits | #33 | 🟢 **BUILT** `901280af`, AC1 driven · ✅ **replied + closed** | — |
| FLD-007 | A lesson step that can be completed | #5 | 🟢 **BUILT** `4068d139` · ✅ **replied + closed** | — |
| FLD-008 | An aggregation that cannot answer says so | #14 | 🟢 **BUILT** `d1daabb1` · ✅ **replied + closed** | — |
| FLD-009 | The editor does not overwrite what an agent wrote | #41 | 🟢 **BUILT** `fa227028`, driven · ✅ **replied, issue STAYS OPEN** | — |
| FLD-012 | The empty-box warning stops crying wolf | #32 | ⬜ never built | — |

**Track B — it costs too much to install and to drive**

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-002 | The Columns node says which breakpoint it is at | #22 | ⬜ never built | FLD-001 ✅ unblocked |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002, FLD-004, **R3** |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009 ✅ unblocked, **R6** |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | ⬜ never built | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | ⬜ never built | — |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | — |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | ⬜ never built | — |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

## 2. 🔴 The reply gate is OPEN — stop asking, start sending

Richard granted **standing authorisation** on 2026-09-10: post and close from his GitHub account,
**no ask**. `gh` is authenticated as `richardosborne14`. Two things are mandatory on every reply:

1. A first line saying it is an **automated reply generated from Claude**.
2. **The release the fix ships in** — 0.2.3 as of 2026-09-10. ⚠️ Re-derive it; 0.2.2 was cut on
   09-06 and rolled back, so the number has moved once already.

**Four sent in session 4** — #21, #5, #14 replied and **closed**; #41 replied and **left open**.

🔴 **#41 is the lesson.** It asks for the `session_status` tool (FLD-010, unbuilt). FLD-009 fixed a
*different* half — the overwrite. Closing it would have closed an unbuilt feature request on the
strength of someone else's fix. **Check what the issue asked for, not what you fixed near it.**

⚠️ **The register's §5 table was short by two.** #21 and #41 were among the fifteen and had no row
at all. A reply table that omits an issue reads as a reply that is not owed. Both are in it now.

**Distance: 5 of 17 built. 5 replies sent, 19 still owed** (§5 of the
[register](./DEFECTS-THE-FIELD-REPORT-FOUND.md)).

🔴 **"12 still owed" was wrong, and it was wrong because the table was short.** Session 5 swept
every task file's own issue number against §5 and found **eight** issues with a task and no row —
#22, #26, #29, #32, #33, #35, #39, #42, all confirmed open on GitHub. The table now holds 24 rows.
⚠️ **It does not reconcile with README §6's "fifteen issues", and that is a finding, not a typo:**
15 of the 24 carry a task, 9 are answered without one. Read the end condition off the **table**, and
re-run the sweep (it is two commands, recorded in §5) rather than trusting either number.

## 3. The next task to build — FLD-012 (FLD-006 is DONE)

✅ **FLD-006 landed** (`901280af`, session 5), **AC1 driven**, **#33 replied and closed**. It was
claimed within twenty minutes of this board naming it, which is why the in-flight marker exists; it
worked.

✅ **Worth copying: the drive was cheap and it earned the close.** A spec calling
`centerToFit(AllNodes)` is not a person clicking Fit view, and the click is what the reporter filed.
Hit-test `elementFromPoint` at the button's centre **before** clicking — a toast was sitting on top
of it and would have eaten the press — and screenshot after, before concluding anything.

Track A outranks track B. Of the three track-A tasks left, two are gated or collided:

1. **[FLD-012 — the empty-box warning stops crying wolf](./FLD-012-THE-EMPTY-BOX-WARNING-STOPS-CRYING-WOLF.md)**
   (#32). Ungated, but read its §3 first: #32's own proposed discriminator **misses the slider
   thumb**, so do not build the reporter's suggestion as stated. Register row **P1** blocks its AC3.
2. If FLD-012 is also taken, the highest-value work left is **not a task at all — it is the twelve
   replies in §2.** Sending one costs a fraction of building one and moves the only number that
   closes this phase.

🔴 **FLD-004 needs R4 and FLD-005 needs P13 resolved. Do not start either without the ruling.**

**FLD-010 is unblocked**, and R6 ("does it include the advisory lock") can reasonably be answered
*no* — that is what the #41 reply said in public. Ask before building a locking protocol.

## 4. What session 4 learned that the next one should not re-learn

✅ **A real reverted arm fits inside jest, and it is worth the twenty lines.** Read the module's own
source, apply the inverse patch **textually**, `expect(src).toContain(...)` each replacement so a
moved source fails loudly instead of grading nothing, write the result **beside the original** so
its own imports resolve identically, `require` it, then `unlink` in a `finally`. FLD-008 does this
for a `.js` node and a `.ts` node; both reverted arms reproduce the real
`TypeError: Cannot read properties of undefined (reading 'sendWarning')` on the way past.

🔴 **A refusal that is only reported to the editor is a refusal that does not exist in production.**
FLD-008's whole defect: `context.editorConnection.sendWarning(…)` called unconditionally from an
error callback. Outside the editor it throws, the throw is swallowed by a `catch` that logs, and the
node carries on with an empty filter. **Grep for unguarded `editorConnection` in callbacks** — there
was a third copy in `nodes-deprecated` (register row **P20**), found by sweeping `convertFilterOp`
callers rather than by reading the two nodes the task named.

🔴 **And the ordering was the fix, not the guard.** A guard alone still loses the message if the
connection is present and throws for another reason. Capture first, then attempt the surface. There
is an arm on exactly that, and it is the only arm the guard-shaped fix would fail.

⚠️ **`test:main` did not move** — 446 suites / 7359, identical before and after. That is correct and
not a hole: FLD-008 lives in `@noodl/runtime` and `@noodl/cloud-runtime`, which are gated by
`npm run test:packages` (`pr.yml:160`), not by `test:main`. **Check which gate covers the package
you changed before reading an unchanged number as coverage.**

## 5. Gates, as they stood at the end of session 5

`typecheck:editor` **exit 0** · `typecheck:editor-tests` **exit 0** ·
`test:ci` **2978 specs / 4 failures, seed 30027** — exactly the named AIX-006 floor ·
`test:main` **446 suites / 7359 tests, exit 0**.

✅ **`test:main` is fully green for the first time**, and it took three runs to get there. Runs 1
and 2 were red on `fld-009/projectLevelWatch` (run 1 also on `rel-009b/projectFileWatcher`) — see
register row **P21**. The cause was not load and not a ceiling: the specs wrote **before
`fs.watch`'s FSEvents stream was live**, so no event was ever coming. Fixed by
`tests-unit/support/armWatcher.ts`.

🔴 **Read a gate's exit status out of the LOG, not out of the harness notification.** Three times
this session a background task reported *"completed (exit code 0)"* while the gate had exited **1**
— the wrapper ended in `; echo "EXIT=$?" >> log`, and the notification reports the **last** command.
Write the status into the log and grep it.

⚠️ A peer session held phase 83 and nodegx-export work uncommitted in this checkout throughout.
**Commit by pathspec** — `git status` still shows their files.

## 6. 🔴 Rulings — one down, four still gating

✅ **R1 ANSWERED: 0.2.3, not split** (Richard, 2026-09-10). It is now in four public comments, so a
change of plan has to be announced on those threads.

Still open: R2 charts as a kit or core nodes · R3 the Advanced Columns prefab · R4 does the
units-port fix ship in a patch · R5 is minification in scope · R6 does FLD-010 include the lock
(**answered "probably not" in public on #41 — confirm**). Full wording in [README.md](./README.md) §2.

## 7. The end condition has not moved

The phase closes when the fifteen issues are each **fixed and closed, or answered on the thread with
the measurement that changed our mind**. It is no longer zero. **Twelve replies to go.**
