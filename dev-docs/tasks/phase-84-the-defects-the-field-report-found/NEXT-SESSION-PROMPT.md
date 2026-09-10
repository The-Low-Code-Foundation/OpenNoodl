# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is now answered (0.2.3)** and
four still gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 8)

Seventeen task files, each grepped for its own marker. **Seven built, one PARTLY built, nine never
built.** That is the file count, not a copied status. Re-derive it, do not inherit this table:

```sh
cd dev-docs/tasks/phase-84-the-defects-the-field-report-found
for f in $(ls FLD-*.md | grep -v WHAT-WAS-BUILT); do
  id=$(echo "$f" | cut -d- -f1,2)
  if grep -q '🟢 \*\*BUILT\*\*' "$f"; then echo "$id BUILT"
  elif grep -q '🟡 \*\*PARTLY BUILT\*\*' "$f"; then echo "$id PARTLY"
  else echo "$id --"; fi
done
```

⚠️ **The old one-liner over `FLD-*.md` now over-counts** — `FLD-011-WHAT-WAS-BUILT.md` matches the
glob and is not a task. The `grep -v WHAT-WAS-BUILT` is not cosmetic.

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

🔴 **Track A is still exhausted except for its two gated tasks.** FLD-004 needs **R4**, FLD-005
needs **P13**. Do not start either without the ruling.

**Track B — it costs too much to install and to drive**

| id | task | issue | state | depends on |
|---|---|---|---|---|
| FLD-002 | The Columns node says which breakpoint it is at | #22 | 🟢 **BUILT** `4e8ce7ab5`, AC1 driven · ✅ **replied, issue STAYS OPEN** | — |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002 ✅ **unblocked**, FLD-004, **R3** |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009 ✅ unblocked, **R6** |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | 🟡 **PARTLY BUILT** `c7f5ea794` · ✅ **replied, issue STAYS OPEN** | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | ⬜ never built | — **ungated** |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | 🔴 **P25 — does not FIT the token budget** |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | ⬜ never built | — **ungated** |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

🔴 **FLD-011 is `🟡 PARTLY BUILT` on purpose and it is NOT done.** `out_dir` (AC1, AC5) and the
settle budget (AC2, AC4) are built and measured; **parallelise-by-tab is not, so AC3 and AC6 are
unmet** — and AC3 (per-tab console attribution) is the arm the task itself calls the one that
matters. Read [FLD-011-WHAT-WAS-BUILT.md](./FLD-011-WHAT-WAS-BUILT.md) §6 before picking it up.

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

**Twelve sent, twelve owed — re-derived from GitHub, not from the table.** Session 8 sent one:
#22 (FLD-002), **deliberately left OPEN**. ⚠️ Do not count replies with `grep replied` — the table
spells them **SENT**, and that grep undercounts by five. The honest count is the `gh` loop below.

🔴 **Run it case-INSENSITIVELY.** Session 8's first run used `test("automated reply generated from
Claude")` and reported **3 sent, 21 owed** — a number that contradicted four rows carrying comment
links, which is the only reason it got caught. The shipped disclosure line is *"**A**utomated reply
generated from Claude."*, capitalised, and `jq`'s `test` is case-sensitive by default. **A count
that disagrees with a documented row is the instrument, not the fact.**

```sh
for i in 1 5 9 12 13 14 15 21 22 25 26 27 29 30 32 33 34 35 37 39 40 41 42 43; do
  n=$(gh issue view $i --repo The-Low-Code-Foundation/NodeGX --json comments \
      --jq '[.comments[]|select(.body|test("(?i)automated reply generated from claude"))]|length')
  [ "$n" != "0" ] && echo "sent  #$i" || echo "OWED  #$i"
done
```

Sent (12): #1 #5 #9 #12 #14 #15 #21 #22 #32 #33 #40 #41.
Owed (12): #13 #25 #26 #27 #29 #30 #34 #35 #37 #39 #42 #43.

🔴 **#22 is now the third in the #41 shape.** It asks for two things — the state read-out and more
breakpoint slots / an Advanced Columns prefab. FLD-002 built the first; the second is **FLD-003,
unbuilt and gated on R3**. So it was replied to and **left open**, with the reply saying which half
is which. Three issues now stand replied-and-open for that reason: **#22, #40, #41.**

🔴 **#41 is still the lesson in one direction, and #15 is the lesson in the other.** #41 asks for
the `session_status` tool (FLD-010, unbuilt) and stays open because FLD-009 fixed a *different*
half. #15's three symptoms had two named replacements and a third that was **never reproduced
here** — so it was closed as *overtaken by the rebuild*, not as fixed-and-verified, and the reply
says exactly that and invites a reopen. **Do not claim a verification you did not do.**

⚠️ **Re-run the §5 sweep, do not read the table.** Session 6 ran it: **15 issues carry a task, 24
rows, nothing missing.** It has caught an omission twice before; it is one command and it is
recorded in §5 of the [register](./DEFECTS-THE-FIELD-REPORT-FOUND.md).

**Distance: 7 of 17 built, 1 partly built. 12 replies sent, 12 still owed.**

## 3. The next task to build

Track A outranks track B, and **track A still has nothing left that is not gated**. So either get
R4 or P13 decided, or build the best ungated track-B task. Ranked, after session 7:

1. **FLD-016** (#29) — the Linux install. Ungated, and the only track-B task that needs **no MCP
   surface at all**, which matters while P25 stands. AppImage/FUSE 2 and the X11 default, both
   halves confirmed unmeasured on a current distribution. ⚠️ Decide whether it is gradeable on this
   machine **before** building — that answer is the task's real first question.
2. **FLD-011's remaining half** — parallelise by tab. ⚠️ **The case for it is weaker than the task
   file assumed**, because the settle budget already took the corpus from 205s to 55s. It is
   strongest on many-page projects and it carries the AC3 trap: `page.consoleErrors` is ONE shared
   array attributed by index-slicing, so interleaving misattributes every console error.
3. **FLD-013** (#37) — ungated MCP-surface work. ⚠️ Check P25 first; anything that adds to the
   resident tool surface is now gated by a budget with **5 tokens spare**.
4. **FLD-003** (#22) — 🔴 **now unblocked by FLD-002, but still gated on R3 and FLD-004.** It is the
   open half of an issue that has just been answered, which makes R3 the ruling with the most
   waiting behind it after R4. Worth putting in front of Richard.

🔴 **FLD-014 is NO LONGER ungated — do not start it.** Register row **P25**: its scope is *"accept
snake-case aliases for the 98 camelCase inputs in `backendTools.ts`"*, which **adds** to the
resident MCP tool surface. That surface has **5 tokens of headroom** against `toolDisclosure`'s
8280-token gate, and the gate's own comment says the budget has been renegotiated twice and *"there
should not be a third"*. It needs a ruling, or the `$ref` fix the gate names as the honest answer.

🔴 **FLD-004 needs R4, FLD-005 needs P13, FLD-015 needs R2 and P9. Do not start any of them without
the ruling.** **FLD-010 is unblocked** and R6 can reasonably be answered *no*. Ask before building a
locking protocol.

## 4. What session 8 learned that the next one should not re-learn

🔴 **A duplicate derivation is invisible wherever the two derivations agree — arm the case where
the right answer is not the obvious one.** FLD-002's reverted arm C derived the breakpoint a second
time beside the layout instead of out of it, which is the exact defect the ports exist to prevent.
It reddened **one** spec out of twelve: *Auto Fit reports Default*. In `layoutString` mode the
second derivation agrees with the first at every width, so the general "band matches layout"
assertion passes on the broken code. **The arm that finds a duplicate is the one where the honest
answer is "none of the above."** Register row **P27**.

🔴 **`Emulation.setDeviceMetricsOverride` is scoped to the CDP session that set it.** Resize in one
`drive-page.js` invocation and read in the next and you measure the **original** width. `cdp.js`
already documents exactly this for network emulation, one verb over, and the same sentence applies
here. The first pass at FLD-002's drive produced a table that was partly right by luck. Do the
resize, the settle and the read **on one connection**, in one process.

🔴 **`jq`'s `test()` is case-sensitive, and the reply-count loop depends on it.** The loop in §2 run
as `test("automated reply...")` reported **3 sent, 21 owed**. The shipped disclosure is capitalised.
It was caught only because the number contradicted four rows that carry comment links — **a count
that disagrees with a documented row is the instrument, not the fact.**

⚠️ **`dev:stop` would have killed a peer's suite.** `--list` showed a peer's
`lerna exec --scope @noodl/platform-node -- npm test` inside the sweep set; `NEVER_SWEEP` shields
`test:ci` and `test:main` **by name**, and a package's own `npm test` is neither. Run
`dev:stop -- --list` and read it before stopping, not after. Waiting cost about twenty minutes.

✅ **Regenerating a shared generated artifact with `--out-dir` and diffing first is cheap and it
settles the question.** `node-catalog.json` came back **33 lines added, 0 removed, the `.d.ts`
byte-identical** — purely additive, which is what made writing it in place safe with a peer holding
uncommitted work elsewhere in the tree.

⚠️ **A deferral note can be about the sink rather than the port under test.** FLD-002 AC5's first
signal arm wired `onAtSmall` into a `Set Variable` with nothing feeding its value; the wire was
dropped with *"nothing is wired into value"* — true, about the receiver, and it reads at a glance
like the port having been handled. Give the sink what it needs to compile before you believe a
sentence about the source.

## 5. What session 7 learned that the next one should not re-learn

🔴 **A self-agreement control detects nondeterminism, NOT time-dependence.** FLD-011's arms script
ran the new arm twice to check it agreed with itself, and reported three projects as `CHANGED` with
`0 unstable`. Both arms were internally deterministic — fixed sleeps land on the same side of a
timer every run — so each agreed with itself perfectly while disagreeing with the other. The thing
that actually answered it was a **third arm that varied the sample TIME**: the OLD mechanism with
the timers merely HALVED reproduced the NEW arm's reading exactly. Register row **P26**.

🔴 **Two wrong diagnoses before that one, both plausible.** First "a CSS fade-in" — an animation
wait was added and did not move the result; sampling showed the element stable at `opacity: 0` for
1.5s, not mid-transition. Then "the page is flaky". It was neither: three lesson projects reveal a
caption on a **~5 second timer**, and the old sleeps reached the phone measurement at exactly 5.9s.
**Sample the page over time before theorising about why two readings differ.**

🔴 **The resident MCP tool surface had SEVEN tokens of headroom and nothing said so until a gate went
red.** One optional parameter on one tool took it 101 tokens over. See **P25**. Before adding any
tool, parameter or description anywhere in `noodl-mcp/src/tools/`, run
`npx jest tests/toolDisclosure.test.ts` and read the `[surface]` line — it prints the margin on a
**passing** run, which is the only time anyone can act on it.

✅ **A ceiling that is the old constant makes a speed change unfalsifiably safe.** The settle budget
can never be slower than the fixed timers it replaced, because it is bounded by them — and
`report.settle.atCeiling` says how many settles got there. `0 of 98` is what makes the corpus
number mean something; had it been `98 of 98`, nothing would have been sped up at all.

⚠️ **A spec that writes files can litter the repo.** FLD-011's relative-path arm resolved
`'shots-relative'` against jest's cwd and left a directory inside `packages/noodl-mcp` on every run.
Caught by `git status` before the commit, not by the suite. Point relative-path fixtures at
`os.tmpdir()`.

⚠️ **`FLD-*.md` now matches `FLD-011-WHAT-WAS-BUILT.md`.** The board one-liner needs
`grep -v WHAT-WAS-BUILT` or it counts a report as a task.

## 6. What session 6 learned that the next one should not re-learn

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

## 7. Gates, as they stood at the end of session 8

`npm run test:main` **446 suites / 7359 tests, exit 0** — identical to sessions 5, 6 and 7.
`packages/noodl-viewer-react` **101 suites / 1360 tests, exit 0** (session 8).
`packages/nodegx-export` `tests/visual-controls.test.ts` **52 tests, exit 0** (session 8).
🔴 **The three catalog gates are now part of any node-port change and all three passed:**
`catalog:check`, `catalog:merge:check`, `catalog:groups:check`. A `group:` added to a node file and
not folded into the catalog is invisible to the group gate, so run `catalog:check` beside it.
`npx lerna run test --scope @nodegx/render-measure` **2 suites / 13 tests, exit 0**.
`packages/noodl-mcp` **99 of 101 suites, 1416 of 1419 tests** — the two reds below.

⚠️ **`@noodl/mcp` is 2 suites / 3 tests RED at HEAD and it is still NOT ours** —
`def018-def020-layout-drive` (D28) and `sbr009ThemeEditorDrive` (two AC2 arms). 🔴 **Session 6's
argument for these did not cover session 7's change and had to be redone.** That argument was *"they
use `withRenderedPage` but never `measureExpression`"* — true for FLD-012, useless for FLD-011,
which changed `withRenderedPage` itself. Re-proved with the control: `git show HEAD:` over
`render-report.js`, those two suites re-run, **identical 3 failed / 15 passed**, snapshot `cp`ed
back, md5 verified in both directions. **An inherited pre-existing verdict is only as good as the
change it was measured against.** They are in `test:packages`, a PR gate, and nobody owns them.

🔴 **`npx jest tests/toolDisclosure.test.ts` is now a gate you must check BEFORE adding to the MCP
surface, not after.** It prints `[surface] N tokens / 20 resident tools — M under the 8280 budget`
on a **passing** run. M is currently **5**. See **P25**.

🔴 **Read a gate's exit status out of the LOG, not out of the harness notification** — and note
`echo "EXIT=$?"` after a pipe reports the LAST command in the pipe, not the runner. Write the exit
into the log file itself.

⚠️ A peer session held phase-83 / `nodegx-export` / `noodl-preview` work uncommitted in this
checkout at the start of session 7 and committed it during. **Commit by pathspec**, and `git add`
untracked files first — a pathspec commit skips them.

## 8. 🔴 Rulings — one down, four still gating

✅ **R1 ANSWERED: 0.2.3, not split** (Richard, 2026-09-10) — but see §2: what is *already published*
is **0.2.2**, and four replies were corrected to say so before they went out.

Still open: **R2** charts as a kit or core nodes · **R3** the Advanced Columns prefab · **R4** does
the units-port fix ship in a patch · **R5** is minification in scope · **R6** does FLD-010 include
the lock (**answered "probably not" in public on #41 — confirm**). Full wording in
[README.md](./README.md) §2.

🔴 **R4 and P13 are now the phase's critical path**, because they are the only things standing
between the next session and the last two track-A tasks.

## 9. The end condition has not moved

The phase closes when the issues are each **fixed and closed, or answered on the thread with the
measurement that changed our mind**. Read the count off §5 of the register, not off README §6's
"fifteen".

**Twelve sent, twelve to go.**
