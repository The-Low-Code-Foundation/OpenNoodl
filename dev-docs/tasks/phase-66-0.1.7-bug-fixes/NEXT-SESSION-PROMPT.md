# Phase 66 — next session

**Written 2026-08-16, session 35.** A rewrite, per §0. s34 broke the six-session auditing streak by
building four tasks; **s35 drove two of them**, and driving is what found the thing six sessions of
reading could not: a shipped fix whose CSS selector matches nothing.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree**, so the next session compares against a reading it
   can trust. ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 007 / 009 / 010 / 011 / 012 / 014 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — twelve tasks |
| **FIX-005** part 1 | ✅ s34 `5b91e9c8` | ✅ **s35** `9d8864d1` | **Criteria 1, 2, 3 CLOSE**, both themes. 🔴 **But the toolbox half is dead code — see §3.** Part 2 = ruling |
| **FIX-004** §A+§B | ✅ s34 `43b2e521` | ✅ **s35** `9d8864d1` | **AC 1, 3, 4, 5 close; AC2 half.** Cloud-function half + slice C + async remain |
| **FIX-006** 1+2 | ✅ s34 `28310bc8` | 🔴 — | **Now the ONLY built-not-driven task.** Prompt changes; graded by re-running the authoring measurements. Fix 3 not built |
| **FIX-021** slice 0 | ✅ s34 `00f5c629` | 🔴 — | 7 specs. Slices A/B need Richard |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Twelve closed outright. Two newly driven (s35). Three partial** (008, 016, 017).
**Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

🔴 **s35 ran NO suites.** Everything below is inherited from s34 at `5b91e9c8`. Three commits have
landed since (`9eff363e`, `612661ec`, `9d8864d1`) — **all three are docs-only**, so the readings
should still hold, but nobody has confirmed that.

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ 2843 / 6 failed @ seed 39393 — floor match, **same six by name** | s34, `5b91e9c8` |
| **`test:main` (jest)** | ✅ 208 suites / 3233 tests, 0 failed | s34 |
| `tsc --noEmit` — `noodl-editor` | ✅ 0 errors | s34 |
| `noodl-mcp` jest | ✅ 44 suites / 519 | s34 |
| `noodl-mcp` `tsc` | ⚠️ 8 errors, all pre-existing | s34 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.
🔴 **Re-measure `test:main` rather than quoting this table** — a peer measured **209 / 3248** on
08-16, so it moves daily and the number above is already stale.

---

## 3. 🔴 What s35 found, and it is the reason to keep driving

### FIX-005's toolbox fix is applied to a selector that matches nothing

`.blocklyTreeSelected` matches **zero elements** — measured with the toolbox rendered (16
categories) and a category *selected*, in both themes, on a single CDP connection. Blockly 12 emits
**`blocklyToolboxSelected`**. Three siblings are dead the same way: `.blocklyToolboxDiv`,
`.blocklyTreeRow`, `.blocklyTreeLabel`.

So the commit message's headline — *"the toolbox category was worse than the row the report
complained about, **1.19:1**, now **4.65 / 5.58**"* — describes a rule that has **never applied**.
Both arithmetics recompute exactly; the false step is the premise that the selector matches.

⚠️ **There is no live defect.** Blockly fills the category from an **inline style**
(`rgb(91,103,165)`) and paints the label white via its own stock rule — **5.35:1 in both themes**,
which passes AA. This is a false claim in the record, not a broken screen.

🔴 **The same commit deleted the `.goog-*` rules for exactly this** ("matching nothing for several
major versions while reading as a second set of rules that might be the ones in force"). Four more
instances were left standing, one of them freshly edited in that commit.

**Why the gates were green:** the 22 specs read token names **out of the SCSS** — deliberately, so
they "cannot drift from the rule". That answers *does this rule name the right tokens*, never *does
this rule match anything*. See memory `a-spec-that-reads-its-oracle-from-the-artefact-under-test`.

### FIX-004's acceptance criterion 1 cannot fail as written

`"42" × 0.9` is `37.800000000000004` **whether or not the convert block does anything** —
multiplication coerces, and `typeof` is `number` in both arms. The task file names that exact
asymmetry (`"5" * 1` works, `"5" + 0` concatenates) in its mechanism section, one page above the
criterion it invalidates. ✅ **The discriminating arm is `+`:** `42.9` with convert, `"420.9"`
without. Both driven.

### The dropdown itself is genuinely fixed

All ten contrast figures reproduce the task file **exactly**, measured as computed styles off live
rows: 13.03 / 11.04 / 9.09 dark, 14.20 / 13.18 / 12.11 light, rules 3.89 / 5.94 and 3.40 / 4.77.
Criterion 2's `:hover` vs `[aria-selected]` reorder works. Criterion 3: checkbox `display:none`,
all six labels at an identical x.

---

## 4. What to do next and why

0. 🔴 **FIX-006 is now the only built-not-driven task.** Both fixes are prompt changes and a spec
   cannot grade them — re-run the authoring measurements. **Agent-actionable, no ruling needed.**
1. 🟢 **FIX-005's dead selectors — a small decision, then a small commit.** Either **delete** the
   four dead rules (hygiene; matches what `5b91e9c8` did to `.goog-*`; leaves the toolbox on
   Blockly's category-coloured selection at 5.35:1), or **retarget** them to
   `.blocklyToolboxSelected` and friends (applies the intended `bg-5` + rule treatment, needs
   `!important` to beat Blockly's inline style). ⚠️ **Retargeting is a visible redesign of the
   toolbox** and should not fall out of a contrast fix — that is why s35 did neither.
2. **FIX-006 fix 3** — the validator rule for a `Javascript2` node with no `define(`/`script(`.
   Agent-actionable.
3. **FIX-004 slice C** (objects as data) — agent-actionable. ⚠️ **Async is deliberately separate**:
   the Visual Function compiles with a **sync** `new Function`. Its own task.
4. **FIX-004 AC2's cloud half** — the only unmet part of a driven criterion. ⚠️ `console.log` in the
   cloud sandbox is **not stdout**: `sandbox.isolate.js` routes it to
   `_noodl_api_call('log', …, {level:'info'})`. Expect a Noodl log entry.
5. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).
6. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

🔴 **Do NOT re-run `test:ci` to "check"** — nothing but docs has landed since it was taken.

### How to start here

s34's lesson was *build the cheapest item on a list that has not moved*. **s35's is narrower and
sharper: when a fix ships with a gate, ask what the gate would say if the fix were not applied at
all.** FIX-005's suite would have said exactly what it said. The check that settled it was one line
— `querySelectorAll(sel).length` with the UI on screen — and it was written down as a kill
condition *before* the editor was launched.

✅ **Write the kill condition first.** For FIX-005 it was *"if a resting row's computed
`border-left-width` is not 3px, the ruleset is not in force whatever the specs say."* It came out
3px, so the dropdown half was believed on evidence rather than on the suite.

---

## 5. Owed by Richard

- 🟢 **FIX-005 — the dead-selector decision.** §4 item 1. Delete or retarget. **Cheap either way**,
  and the measurement is done: nothing is currently broken on screen, so this is about the record
  and about whether the toolbox should follow the token palette at all.
- 🔴 **FIX-005 part 2 — the rename.** Still the other thing blocking that task.
  **A.** Keep `Runtime Variables` + a tooltip *"the global `Noodl.Variables`"* — cheapest, reverses
  nothing. **B.** `Global Variables` + `App Config` → `App Settings`. **C.** Revert to
  `App Variables` and rename `App Config` and the settings section — literal, biggest sweep.
  ⚠️ **It reverses VFN-012 deliberately**, and your stated reason ("the global ones") is the
  *opposite* of the reason it was renamed. Copy only — block type ids are frozen — plus two specs.
- 🟢 **FIX-016 ruling 1.** **(a) Copy/default**: the row says only `Type` and reads `String` whether
  or not anything is stored. **(b) Parser asymmetry, RE-PRICED DOWN**: `Outputs.Done_1()` /
  `Outputs.Done.send()` get a value port and no Type row, but **throw at runtime by name and line**
  — *"an accurate message that doesn't name the fix"*, a copy question, not a diagnostics gap.
  ⚠️ **Do not conflate with plain `Outputs.Done()`, which works.**
- 🔴 **FIX-016 §3 — signal-input semantics.** Does an incoming signal re-run the body, or dispatch
  to a named handler? Or rule signal inputs out. **The only genuinely blocked part of FIX-016.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible. ⚠️ Ctrl-Space is **OS-bound on
  your machine** (`com.apple.symbolichotkeys` key 60), so copy naming it names a chord you cannot
  press.
- 🔴 **FIX-017 AC3** — premise false (ports and API names never share a prefix). Restate or strike.
- 🔴 **FIX-008 fix C** — a measurement from you. The oldest open item on this list.
- 🔴 **FIX-013 — four rulings; answer ruling 1 FIRST.** Ruling 2's real payoff is **three files**,
  not the big subtraction it advertised: `sandboxData.ts` keeps `sandboxExport.ts:25`, and the
  1,121-line runtime shim keeps `noodl-viewer-react/src/sandbox/index.ts:61`. ✅ The big subtraction
  is **ruling 1(c)'s** to authorise. 🔴 **Nothing pre-empts your decision — only its price tag moved.**
- 🔴 **FIX-015** — the eight rulings. Brainstorm, then its own phase.
- 🔴 **FIX-021 slices A/B** — the six memory rulings. Slice 0 is done.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  It is **phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s35.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()` so nothing shields
  them. Lines 18–19 inert. **Fix it, delete it, or rule that a closed phase's corpus tooling may
  rot.** Three sessions have now declined to edit a closed phase's directory.
- 🟢 **33 MCP servers are alive on your machine and nothing ever reaps them.** A peer tracked the
  population 19 → 25 → 33 across 08-15/16; they accrue about a pair per Claude session and
  `dev:stop` spares them **by design** (right for a live peer, wrong for a dead session). Oldest has
  been running since 12:03 the previous day. ⚠️ **Killing processes one can only *infer* are
  orphaned is your call, not a passing session's.** Becoming a memory-pressure question, not a
  tidiness one.
- ⚠️ **MCP servers hold pre-rebuild code** — the **repackage** is separately owed.
- 🟢 **A lockfile written by `start.ts` at *intent*** — the ~75s window in which no process check can
  be correct is a hole no filter can close.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** (the cwd persists
between calls and bit s35 twice).

🔴 **`git commit <pathspecs>` — never `git add` at all.** A sibling's commit sweeps whatever is in
your index. The only exception is a **new** file: `add` and commit in the **same** command.

⚠️ **This checkout is busy** — 16 peer sessions during s35, and `MEMORY.md` was edited by a peer
*while s35 was editing it* (three `Edit` calls missed because the text moved). **Re-read before
editing shared files, and size-check at the end.**
⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to another phase — **do not
commit or modify it. But DO read it.**

### 🔴 The memory index is chronically at its ceiling

s34 landed it at 92 / 5 free; s35 found it **73 / 163 OVER**. ✅ s35 left it at
**17,372 / 17,463 — 138 / 47 free.** 🔴 **UTF-16 binds**, because emoji cost two units each.
🔴 **Measure with `node`, not `python`** — s35 wrote a Python check where `len(s)` is *code points*,
not UTF-16, so it reported the two counts as identical and would have passed a file that was over:

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`, which `dev:stop` leaves **on**. 🔴 **`pkill` never reaches
`sweep()`**, so `NEVER_SWEEP` does not run; it is the one route with no protection at all.

⚠️ **A survivor count is NOT proof the shield was exercised.** s35 reported "33 MCP servers survived,
shield held" and two peers correctly narrowed it: with no decoy, 33 → 33 is what you would see
whether the shield worked or had been deleted. The discriminating version is a **decoy** matching
`DEV_TOOL` + repo root but unprotected, which must **die** in the same run (`a905af94`). And a clean
teardown with **no suite running** says nothing about the suite half of the guard.

### Etiquette

**Announce before *and* after any `test:ci` or editor launch.** 🔴 **The LAUNCH list is the TEARDOWN
list**, and **re-take `ListAgents` at both ends** — s35's roster went 15 → 16 inside the window, and
the new arrival had never received the launch notice. ⚠️ **Two peers shared the name `opennoodl-21`**;
send with the `[ref]` when a listing shows one.
✅ **`test:main` is plain Node and safe beside a live stack** — no announce needed.
🔴 **Peer messages stay SHORT and RARE** (Richard, 08-16: *"curb its enthusiasm"*).

### Driving cleanup — s35's checklist, all four done

Remove the `cp -R` fixture; filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key **`recentProjects`**) and
the per-project key in `editorSettings.json`, **after** the editor is down. ⚠️ A copied project keeps
the original's **name** — rename it on disk.
🔴 **`ThemeManager.setMode` writes to the USER's `editorSettings.json` and persists.** s35 flipped to
light to measure and restored **`dark`**; the key sat at index 16 of 205, so it pre-existed and was
overwritten rather than added. ⚠️ **If your editor theme was `system`, not `dark`, s35 changed it —
both resolve to dark on a dark-mode Mac, so it looks identical today.**
