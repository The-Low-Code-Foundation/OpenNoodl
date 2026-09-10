# Phase 84 — next session

**Phase:** 84, *the defects the field report found*. **Prefix `FLD`.** Scoped 2026-09-09.
Read [README.md](./README.md) first — §2 carries the rulings; **R1 is answered (0.2.3)** and four
still gate tasks.

🔴 **READ §6 BEFORE ANYTHING ELSE.** CI was blind for 34 days, session 10 restored it, and it came
back with **six red gates**. Three of them are one command each. That is now the largest pile of
loose work attached to this phase and none of it is FLD work.

## 1. The board — re-derived from the task FILES, 2026-09-10 (end of session 10)

Seventeen task files, each grepped for its own marker. **Eight built, TWO partly built, seven never
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
| FLD-013 | An agent learns what will not translate before it designs | #37 | 🟢 **BUILT** `e51c8c61d`, 5/5 ACs · ✅ **replied + CLOSED** | — |
| FLD-014 | The MCP surface stops costing a round trip | #43 | ⬜ never built | 🔴 **P25 — does not FIT the budget** |
| FLD-015 | Charts that export | #39 | ⬜ never built | **R2**, 🔴 **P9 collision** |
| FLD-016 | The Linux install works on a current distribution | #29 | 🟡 **PARTLY** `556915fa4` · ✅ **replied, STAYS OPEN** | 🔴 **needs a Linux box** |
| FLD-017 | The release stops shipping what it never runs | #42 | ⬜ never built | R5 (minify only) |

🔴 **Two tasks are `🟡 PARTLY BUILT` and NEITHER is done.** FLD-011 is missing parallelise-by-tab
(AC3, AC6). FLD-016 has all four fixes in and AC2/AC4/AC5 measured, but **AC1 and AC3 cannot be
measured on any machine we have** — see §8.

## 2. What session 10 built — FLD-013, `e51c8c61d`

**#37 asked for `export: {status, badge, reason}` on the catalog tools. Shipped with the PORTS
beside the status, because the field as asked would have read `translated` on `Circle`** — the type
that produced all twenty-three of the refusals the issue was filed about. The refusal is per
**parameter source**, not per type. Full write-up in the task file §6; the short version:

- `export: {status, badge?, structurePorts, contentPorts}` on `get_node_type`, unconditional and at
  the **default** detail (a reading only `detail:"full"` carries is one almost nobody sees).
- On `list_node_types`, on rows that have something to say — **non-translated OR refuses on a wire**,
  which is a deliberate departure from the task's §3. The strict rule drops nine translated-and-
  refusing types, `Circle` first.
- `exportCoverage` on the listing payload, so the silence on the other 107 rows is readable.
- `STRUCTURE_PORTS`, `CONTENT_BOUND_PORTS` **and `renderRole`'s `switch (node.type)`** moved out of
  `analyze/plan.ts` into `packages/nodegx-export/src/structurePorts.ts`. One table, two readers.

🔴 **The reverted arm found a hole shaped like the task.** Deleting `startAngle` from
`STRUCTURE_PORTS.circle` reddened **nothing**: four of the thirteen circle ports were asserted by
hand and nine were not, including the port #37's dashboard wired. Closed by a sweep that reads the
table under a cardinality floor, and proved to grade *behaviour* by a third arm that leaves the
table alone and breaks the code path.

Ratchet: `list_node_types` **47,860 → 58,386 wire bytes (+22.0%)**, attributed field by field, and
it is the first size assertion that tool has ever had. `nodeDocBudget` ceilings **not** moved —
nothing went red (`Group` 13,689 → 13,718 of 14,300). The 8,280-token disclosure gate is unchanged
at **8,275**: nothing was added to a tool description.

## 3. The next task to build

🔴 **FLD-016 is not the next session's job unless a Linux box appears.** Ranked:

1. **FLD-017** (#42) — **now the only wholly ungated FLD task.** R5 gates the minification item
   **only**; the −86 MB sourcemap half and the two idle timers are ungated and nobody has looked at
   them. It also owes #42 a reply, so it moves the board and the end condition together.
2. **FLD-011's remaining half** — parallelise by tab. ⚠️ Weaker case than the task file assumed;
   the settle budget already took the corpus 205s → 55s. AC3's shared `consoleErrors` array is the
   trap.
3. **FLD-003** (#22) — unblocked by FLD-002 but still gated on **R3** and FLD-004. It is the open
   half of an issue already answered, which keeps R3 the ruling with the most behind it after R4.

🔴 **FLD-014 is NOT ungated (P25). FLD-004 needs R4, FLD-005 needs P13, FLD-015 needs R2 and P9.**
**FLD-010 is unblocked** and R6 can reasonably be answered *no*; ask before building a lock.

⚠️ **But read §6 first and decide honestly whether a red CI outranks all of these.** It is not FLD
work and it is not this phase's, and it is the reason a month of drift went unseen.

## 4. 🔴 The reply gate — 19 sent, 5 owed

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

**Sent (19):** #1 #5 #9 #12 **#13** #14 #15 #21 #22 **#25** **#27** #29 #30 #32 #33 **#34** **#37**
#40 #41. **Closed (10):** #1 #5 #9 #12 #14 #15 #21 #32 #33 **#37**.

**Owed (5): #26 #35 #39 #42 #43.**

✅ **The remaining five now map one-to-one onto the remaining build work**, which is the cleanest
this has been: #26 = FLD-004 (R4), #35 = FLD-005 (P13), #39 = FLD-015 (R2 + P9), #42 = FLD-017
(**ungated**), #43 = FLD-014 (P25). 🔴 **There are no more cheap replies.** Every one left needs
either a ruling or a build first — so from here the reply count only moves when the board does.

🔴 **NINE issues stand replied-and-deliberately-open: #13, #22, #25, #27, #29, #30, #34, #40, #41.**
Most are the same shape — *the issue asked for two things, one is built, closing it would close the
other*. Say which half is which, in the reply.

⚠️ Do not count with `grep replied` — the table spells them **SENT**, and that grep undercounts.

## 5. 🔴 What session 10 learned, and it is mostly about instruments

🔴 **A run list is not a log. `failure` for a month read as "the suite is red"; the suite was never
running.** Every job on `cline-dev` died at `npm ci` in ~19 seconds, before a single gate. Nobody
opened one. **Open the log, not the status column.** Register row **P30**.

🔴 **A register row can be a number lifted from the gate's own config.** C13 said *"real parser
count is 582"* — 582 is `.tsfixme-baseline.json`'s `max.TSFixme`, not what the scanner reads (819).
Same family as [[a-client-property-read-as-a-fact-about-the-source]]. Register row **P31**.

🔴 **Moving a role-keyed table is not enough to make it readable from outside.** FLD-013's §5 named
`STRUCTURE_PORTS` as the thing to move; the thing that actually had to move was `renderRole`'s
`switch (node.type)`, because the MCP server has type names and the tables are keyed by role. A
table you cannot key into is not shared.

🔴 **The reverted arm is where the finding was, again — and the arm that found it was the one that
should have been redundant.** Deleting the port that AC5 names from the table reddened nothing.
Nine of thirteen were ungraded. **Run the arm you expect to be boring.**

⚠️ **`npm ci --dry-run` is the cheap check for a lockfile fix**, and
`npm install --package-lock-only` is the safe way to make one on a shared checkout: it rewrites the
lock and does **not** touch `node_modules`, so no peer's install moves. The diff was 19 insertions,
0 deletions, no version moved.

⚠️ **A `--report` flag can write a tracked file as a side effect.** `npm run tsfixme:report`
rewrote `dev-docs/reference/TYPE-ESCAPE-HATCHES.md`. That was wanted here — it was a month stale —
but check `git status` after running any `:report` target.

⚠️ **A hand-rolled directory walk with `return` inside a `for...of` skips the rest of the
directory.** An ad-hoc per-package count of TSFixme read **75** against the real **819** for exactly
that reason. Same family as [[foreachnode-stops-on-a-truthy-return]] — and the fix was to stop
hand-rolling and run the instrument the repo already has (`npm run tsfixme:report`).

## 6. 🔴 Gates — CI is alive again, and it came back with six red

**`9b3017f8b` fixed the cause** (`package-lock.json` was missing `@nodegx/project-contract`, added
2026-09-09 in `55f657b8a`). Pushed. Run **34512521036** is the first in 34 days to reach the gates.
**3 green / 6 red / 1 job's worth never reached.** None of the six is caused by this session's work;
they were exposed by it.

| job | reading | fix |
|---|---|---|
| Test (platform-node) | 🟢 | — |
| Check build artefacts | 🟢 | — |
| Build (viewer + editor bundles) | 🟢 | — |
| **Node catalog freshness** | 🔴 `cloud-library:check` — `cloud-node-library.json` **stale** | **one command**: `npm run cloud-library:generate`, commit |
| **Library check (LIB-001)** | 🔴 `starter-iconset:check` — `manifest.json` **out of date** | **one command**: `node scripts/library/make-starter-iconset.js`, commit |
| **Lint** | 🔴 `npm run tsfixme` — TSFixme **819 vs 582**, `any` **806 vs 415**, `@ts-nocheck` **4 vs 0** | 🔴 **a decision, not a command** — burn down or raise the baseline with a reviewer looking. See **P31** |
| **Typecheck** | 🔴 `typecheck:backend-tests` **OOM, exit 134** (`FatalProcessOutOfMemory`, core dumped) | the known one — [[the-smallest-runner-fails-first-and-names-nothing]]; **cannot be reproduced locally** |
| **Lesson bundles (FIX-027)** | 🔴 `lessons:chain:self-test` — *"a break this gate claims to catch went through it"*, **12 mutations, 2 not caught** | a gate hole; needs reading, not a regenerate |
| **Test (runtime, backend, viewer, mcp, preview)** | 🔴 `@nodegx/node-kit-types` **1 suite / 5 tests failed**; lerna stops there, so **`noodl-mcp` never ran in CI** | unread |
| **Test (editor)** | 🔴 exit 1, no summary line in the tail | unread — expect the AIX-006 floor plus whatever else |

🔴 **Two of these are one command and would take the red from six to four.** ⚠️ But a regenerate is
an unperformed merge — `--out-dir` or `git diff` the artefact before committing it, and check whose
work made it stale.

**Local readings from session 10, for comparison:**

- 🟢 `nodegx-export`: **98 suites / 3,400 passed / 1 skipped, exit 0**.
- ⚠️ `noodl-mcp`: **102 of 104 suites**; `def018-def020-layout-drive` (D28) and
  `sbr009ThemeEditorDrive` are red. 🔴 **Re-proved pre-existing against THIS change**, not
  inherited: every changed file snapshotted, `git show HEAD:<path>` written over it, the two new
  files moved aside, the pair re-run for an identical **3 failed / 15 passed**, restored and
  md5-verified. Do that again if you touch anything they import. **Never `git stash` here.**
- 🟢 `tsc --noEmit` in both `nodegx-export` and `noodl-mcp`. 🔴 The export package's tsconfig
  **includes `tests/**`**, so it is the cheap local gate for a new spec there.
- 🟢 `noodl-mcp` esbuild bundle, with `structurePorts` present in `dist/noodl-mcp.cjs`. **Check all
  three resolvers** — tsconfig `paths`, jest `moduleNameMapper`, esbuild `alias` — when importing
  `@nodegx/export`; the bare specifier is aliased in all three, subpaths are not.
- 🔴 `npx jest tests/toolDisclosure.test.ts` in `packages/noodl-mcp` prints the margin on a
  **passing** run. **8,275 of 8,280 — 5 tokens.** Check it BEFORE adding to the MCP surface. P25.

## 7. 🔴 Rulings — one down, four still gating

✅ **R1 ANSWERED: 0.2.3, not split.** What is *published* is **0.2.2** (2026-09-07) — re-derive per
issue with `gh release list`.

Still open: **R2** charts as a kit or core nodes · **R3** the Advanced Columns prefab · **R4** does
the units-port fix ship in a patch · **R5** is minification in scope · **R6** does FLD-010 include
the lock (answered *"probably not"* in public on #41 — confirm). Full wording in
[README.md](./README.md) §2.

🔴 **R4 and P13 remain the phase's critical path.** R5 is now the cheapest ruling to ask for,
because FLD-017 is the only ungated task left and R5 decides only one of its five items.

## 8. 🔴 Two things for Richard

**(a) FLD-016's AC1 and AC3 need a real Linux box, and AC3 has teeth.** Re-enabling Chromium's
sandbox is a genuine behaviour change on older kernels and under restrictive AppArmor profiles.
**It must be smoke-tested on at least two distributions before 0.2.3 ships.** #29's reporter is on
Fedora 44 / KDE / Wayland and has been asked, in the reply, to verify — that is the cheapest path
and it is waiting on them.

**(b) The `tsfixme` baseline is a decision nobody has made.** +237 TSFixme and +391 bare `any` since
2026-08-07, accumulated while the gate could not report. The gate's own text says raising the
baseline silently is the one thing it exists to stop — so somebody has to either fund the burn-down
or look at the raise. Per-package floors is the shape proposed to @SgtSpork on #13.

⚠️ `brew install rpm` remains installed on this machine from session 9. Reversible with
`brew uninstall rpm`.

## 9. The end condition has not moved

The phase closes when the issues are each **fixed and closed, or answered on the thread with the
measurement that changed our mind**. Read the count off §5 of the register, not off README §6's
"fifteen".

**Nineteen sent, five to go — and all five are behind a build or a ruling.**
