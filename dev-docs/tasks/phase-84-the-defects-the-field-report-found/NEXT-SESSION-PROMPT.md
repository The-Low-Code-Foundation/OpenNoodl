# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is answered (0.2.3)** and four
still gate tasks.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 9)

Seventeen task files, each grepped for its own marker. **Seven built, TWO partly built, eight never
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

⚠️ **Do not pipe that into a counter that greps `BUILT`** — `🟡 **PARTLY BUILT**` contains it, and
session 9's first count came out `5 / 2 / 8`. The three states are mutually exclusive only because
the `elif` orders them.

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
| FLD-002 | The Columns node says which breakpoint it is at | #22 | 🟢 **BUILT** `4e8ce7ab5`, AC1 driven · ✅ **replied, STAYS OPEN** | — |
| FLD-003 | Advanced Columns, as a prefab | #22 | ⬜ never built | FLD-002 ✅, FLD-004, **R3** |
| FLD-010 | An agent can ask whether a human has the project open | #41 | ⬜ never built | FLD-009 ✅, **R6** |
| FLD-011 | The render report writes to disk and stops sleeping | #40 | 🟡 **PARTLY** `c7f5ea794` · ✅ **replied, STAYS OPEN** | — |
| FLD-013 | An agent learns what will not translate before it designs | #37 | ⬜ never built | — **ungated** |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | 🔴 **P25 — does not FIT the budget** |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | 🟡 **PARTLY** `556915fa4` · ✅ **replied, STAYS OPEN** | 🔴 **needs a Linux box** |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

🔴 **Two tasks are now `🟡 PARTLY BUILT` and NEITHER is done.** FLD-011 is missing
parallelise-by-tab (AC3, AC6). FLD-016 has all four fixes in and **AC2, AC4, AC5 measured**, but
**AC1 and AC3 cannot be measured on any machine we have** — see §3.

## 2. What session 9 built — FLD-016, `556915fa4`

**Four sub-problems from #29, and two of them were one config line.** The full write-up is in the
task file; the short version:

- **(a)+(b)** `"toolsets": { "appimage": "1.0.3" }` in `noodl-editor/package.json`. The legacy
  AppImage toolset both dynamically links `libfuse.so.2` **and** adds `--no-sandbox` to the
  `.desktop` Exec as a `defaultArg` (`AppImageTarget.js:25-28`). One line removes both.
- **(c)** `src/main/src/linux-display.js` — `ozone-platform-hint=auto` when a Linux session has
  `$WAYLAND_DISPLAY` and no `$DISPLAY`. **9 specs, 3 reverted arms.**
- **(d)** `rpm` target, an `.rpm` row in `scripts/check-release-assets.js`, and an
  `Install rpmbuild (Linux)` step in `release.yml`.
- README now has a **Linux notes** section — FUSE, Wayland, the sandbox, three artifacts.

**Measured on our own AppImage, built twice, one variable changed:**

| arm | `.desktop` `Exec=` | runtime |
|---|---|---|
| REVERTED (`--config.toolsets.appimage=0.0.0`, ≡ absent) | `AppRun --no-sandbox %U` | links `libfuse.so.2` |
| FIXED (`1.0.3`) | `AppRun %U` | no FUSE linkage |

## 3. The next task to build

🔴 **FLD-016 is NOT the next session's job unless a Linux box appears.** Its remaining ACs are a
smoke test, not code. Ranked:

1. **FLD-013** (#37) — ungated MCP-surface work, and now the **top ungated task**. ⚠️ **Check P25
   FIRST**: run `npx jest tests/toolDisclosure.test.ts` in `packages/noodl-mcp` and read the
   `[surface]` line before adding any tool, parameter or description. **5 tokens spare.**
2. **FLD-011's remaining half** — parallelise by tab. ⚠️ Weaker case than the task file assumed;
   the settle budget already took the corpus 205s → 55s. AC3's shared `consoleErrors` array is the
   trap.
3. **FLD-017** (#42) — R5 gates the minification half **only**; the never-executed-asar half is
   ungated and nobody has looked at it.
4. **FLD-003** (#22) — unblocked by FLD-002 but still gated on **R3** and FLD-004. It is the open
   half of an issue already answered, which keeps R3 the ruling with the most behind it after R4.

🔴 **FLD-014 is NOT ungated (P25). FLD-004 needs R4, FLD-005 needs P13, FLD-015 needs R2 and P9.**
**FLD-010 is unblocked** and R6 can reasonably be answered *no*; ask before building a lock.

## 4. 🔴 The reply gate is OPEN — 14 sent, 10 owed

Standing authorisation, 2026-09-10: post and close from Richard's account, **no ask**. Every reply
carries (1) a first line saying it is an **automated reply generated from Claude** and (2) **the
release the fix ships in — re-derived per issue, never inherited.**

**Re-derive the count from GitHub, case-INSENSITIVELY** (`jq`'s `test` is case-sensitive and the
shipped line is capitalised; s8's first run reported a false 3/21):

```sh
for i in 1 5 9 12 13 14 15 21 22 25 26 27 29 30 32 33 34 35 37 39 40 41 42 43; do
  n=$(gh issue view $i --repo The-Low-Code-Foundation/NodeGX --json comments \
      --jq '[.comments[]|select(.body|test("(?i)automated reply generated from claude"))]|length')
  [ "$n" != "0" ] && echo "sent  #$i" || echo "OWED  #$i"
done
```

Sent (14): #1 #5 #9 #12 #14 #15 #21 #22 **#29 #30** #32 #33 #40 #41.
Owed (10): **#13 #25 #26 #27 #34 #35 #37 #39 #42 #43**.

⚠️ Do not count with `grep replied` — the table spells them **SENT**, and that grep undercounts.

🔴 **FIVE issues now stand replied-and-deliberately-open: #22, #29, #30, #40, #41.** Every one is
the same shape — *the issue asked for two things, one is built, closing it would close the other*.
That shape is now the norm here, not the exception. Say which half is which, in the reply.

✅ **FOUR of the ten owed have NO task and their answers are already sketched** in §5 of the
[register](./DEFECTS-THE-FIELD-REPORT-FOUND.md): **#13, #25, #27, #34**. (#30 was the fifth and
went out this session.) Those
are cheap replies that move the end condition — but 🔴 **re-measure each before sending**; P15 and
the #30 row both show a register answer can be right, wrong, or right-but-incomplete.

⚠️ **Re-run the §5 sweep, do not read the table.** One command, recorded in §5; it has caught an
omission twice.

## 5. What session 9 learned that the next one should not re-learn

🔴 **`scripts/noodl-editor/build-editor.ts:62` runs `npx rimraf ./node_modules`.** The repo's own
release path **deletes and reinstalls node_modules** — unrunnable on a shared checkout with peers
live. Register row **P28**. ✅ The useful half: **electron-builder builds a Linux AppImage, `.deb`
and `.rpm` on darwin-arm64, all exit 0**, if you invoke the binary directly with
**`--config.npmRebuild=false`** (else `@electron/rebuild` rewrites native modules in the shared
tree) and point `--config.directories.output=` at the scratchpad. **A Linux packaging change is
gradeable on this Mac after all** — that was the task's own first question and the answer was yes.

🔴 **A source-text `toContain` reads DEAD CODE as live code — and this session's own spec had the
hole.** The FLD-016 wiring assertion was
`expect(mainSource).toContain("require('./src/linux-display')…")`, and the reverted arm that
**commented the call out** passed 9/9, because `// require(…)` still contains the substring. Fixed
by anchoring to the start of a line (`/^[ \t]*require\(…/m`), where `//` breaks the match. 🔴 **The
general rule: a substring match cannot tell "is called" from "appears in the file".** Both arms
redden now. Same family as [[verify-the-consequence-not-just-the-mechanism]].

🔴 **A reverted arm can be passed as CONFIG instead of edited into a shared file.**
`--config.toolsets.appimage=0.0.0` reproduces HEAD-before exactly, because
`AppImageTarget.js:27` treats `"0.0.0"` and *absent* identically. No file a peer might commit was
ever touched. Look for this shape whenever the thing under test is read out of config.

🔴 **`unsquashfs` does not exist on macOS, but electron-builder ships a `7zz` that reads an
AppImage directly** — `~/Library/Caches/electron-builder/7zip@1.0.0/*/bin/7zz l <file>.AppImage`
lists the squashfs. That is what made AC2 gradeable against the artefact rather than the config.

⚠️ **The task file's §3(d) was wrong.** It said `check-release-assets.js` *"asserts only
`latest.yml`/`latest-mac.yml`"*; it already asserted the AppImage and the `.deb`. The real gap was
the `.rpm` alone. [[measure-the-artefact-before-believing-the-task-file]], fourth time this phase.

⚠️ **zsh does not word-split an unquoted `$VAR`.** The AC4 grading run passed three filenames as
ONE newline-joined argument, and the checker reported the AppImage and `.deb` missing — a red that
looked like a real finding. `REAL=("${(@f)$(…)}")` and `"${REAL[@]}"`. Also: **`EXIT=$?` after a
pipe reads the LAST command in the pipe**, which reported `0` for a run that exited 1.

## 6. Gates, as they stood at the end of session 9

- 🟢 **`npm run test:main` — 447 suites / 7368 tests, exit 0.** Baseline was **446 / 7359**; the
  delta is exactly FLD-016's one suite and nine tests. Zero FAIL lines.
- 🟢 `node scripts/check-release-assets.js --self-test` — **5/5 cases, exit 0** (was 4/4).
- 🟢 All three Linux targets build from the real package, exit 0:
  `NodeGX-0.2.2-linux-x86_64.AppImage`, `-linux-amd64.deb`, `-linux-x86_64.rpm`.
- ⚠️ **`@noodl/mcp` is still 2 suites / 3 tests RED at HEAD and it is still NOT ours** —
  `def018-def020-layout-drive` (D28) and `sbr009ThemeEditorDrive`. Not re-measured this session
  because nothing FLD-016 touched is reachable from them (a config field, a main-process module,
  a release script). 🔴 **An inherited pre-existing verdict is only as good as the change it was
  measured against** — re-prove it if you touch anything they import.
- 🔴 `npx jest tests/toolDisclosure.test.ts` in `packages/noodl-mcp` is a gate to check **BEFORE**
  adding to the MCP surface. It prints the margin on a **passing** run. **5 tokens.** See P25.

⚠️ **A peer session is holding phase-85 work uncommitted in this checkout** (`node-catalog*.json`,
`AiAssistant` prompts, `sbr013Doctrine`, `docs-site/.../states.md`, plus untracked phase-85 task
files). Session 9 committed **by pathspec** and `git add`ed its two untracked files first. **Do
not `git commit -a` here, and never `git stash`.**

## 7. 🔴 Rulings — one down, four still gating

✅ **R1 ANSWERED: 0.2.3, not split.** What is *published* is **0.2.2** — re-derive per issue.

Still open: **R2** charts as a kit or core nodes · **R3** the Advanced Columns prefab · **R4** does
the units-port fix ship in a patch · **R5** is minification in scope · **R6** does FLD-010 include
the lock (answered *"probably not"* in public on #41 — confirm). Full wording in
[README.md](./README.md) §2.

🔴 **R4 and P13 remain the phase's critical path** — the only things between the next session and
the last two track-A tasks.

## 8. 🔴 One thing for Richard, and it is not a ruling

**FLD-016's AC1 and AC3 need a real Linux box, and AC3 has teeth.** Re-enabling Chromium's sandbox
is a genuine behaviour change on older kernels and under restrictive AppArmor profiles — the change
makes the Linux app strictly better on a modern Fedora and could, in principle, stop it launching
somewhere it launches today. **It must be smoke-tested on at least two distributions before 0.2.3
ships.** #29's reporter is on Fedora 44 / KDE / Wayland and has been asked, in the reply, to verify
— that is the cheapest path, and it is now waiting on them.

⚠️ `brew install rpm` was installed on this machine to produce the `.rpm`. Reversible with
`brew uninstall rpm`; it conflicts with `rpm2cpio`, which was not installed.

## 9. The end condition has not moved

The phase closes when the issues are each **fixed and closed, or answered on the thread with the
measurement that changed our mind**. Read the count off §5 of the register, not off README §6's
"fifteen".

**Fourteen sent, ten to go.**
