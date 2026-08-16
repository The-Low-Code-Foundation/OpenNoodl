# Phase 66 — next session

**Written 2026-08-16, session 37.** A rewrite, per §0. s36 built the last unbuilt piece of FIX-006
and drove it. **s37 built FIX-004 §C** — objects as data — and found that the `in` operator answers
backwards about every App Object, which decided one of the generators.

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
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Criteria 1–3 close, both themes. 🔴 Toolbox half is **dead code**. Part 2 = ruling |
| **FIX-004** §A+§B | ✅ s34 | ✅ s35 | AC 1, 3, 4, 5 close; AC2 half. Cloud half remains |
| **FIX-004** §C | ✅ **s37** `b9d6966e` | 🔴 — | 7 blocks, a **Data** category, 22 specs, 6 mutation controls. **Nobody has dragged one in the app.** Async still deliberately separate |
| **FIX-006** 1+2 | ✅ s34 | 🔴 — | Prompt changes; **only AC1/AC2 can grade them** — a live authoring run |
| **FIX-006** fix 3 | ✅ s36 `d6a635f5` | ✅ s36 | **AC3 DRIVEN** over real MCP stdio. **AC4's MCP half DRIVEN**; editor half still source-only |
| **FIX-021** slice 0 | ✅ s34 | 🔴 — | 7 specs. Slices A/B need Richard |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Twelve closed outright. Three partial** (008, 016, 017). **Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

✅ **s37 took the three marked ⬅.** `test:ci` and `noodl-mcp` jest were **not** run.

| Gate | Reading | When |
|---|---|---|
| **`test:main` (jest)** | ✅ **212 suites / 3313 tests, 0 failed** ⬅ | **s37** |
| **`tsc --noEmit -p tsconfig.json`** | ✅ **0 errors** ⬅ | **s37** |
| **`tsc -p tsconfig.tests.json`** (jasmine spec tree) | ✅ **0 errors** ⬅ | **s37** |
| **`noodl-mcp` jest** | ✅ 45 suites / 530 tests | s36 |
| **`test:ci` (jasmine)** | ⚠️ 2843 / 6 @ seed 39393 — **inherited, s34 @ `5b91e9c8`** | s34 |
| `noodl-mcp` `tsc` | ⚠️ 8 errors, all pre-existing | s34 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

✅ **`test:main` reconciles:** s36 read 210 / 3266. **+2 suites, +47 tests.** s37's new spec file is
**+1 suite / +22 tests**; the remaining **+1 / +25 is a peer's**, landed between the two readings.

🔴 **`test:ci` was again not run.** The change is additive and entirely inside
`views/BlocklyEditor/`, which the jasmine tree does not import; `tsc -p tsconfig.tests.json` covers
that tree's compilation and is clean. Residual risk is jasmine *runtime* behaviour only — **low, not
zero, and nobody has measured it.**

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

⚠️ **`tsc -p tsconfig.tests-main.json` reports 31 errors and is NOT a gate anybody runs.** It is
only ts-jest's config source in `jest.config.js`, and jest compiles just the files it transforms.
s37 attributed the set by re-running against `git show HEAD:` of that config: **identical with and
without s37's change, and with and without the peer's in-flight edit to its `include`.** The
erroring files are `erg-005/componentContract.pending.ts`, `nodegrapheditor.ts`,
`NodeGraphContext.tsx`, `UseCanvasView.ts`, `Icon.tsx`. **Do not read it as a regression.**

---

## 3. What s37 found

### 🔴 `in` is exactly inverted on an App Object, and it decided a generator

`Noodl.Objects[id]` is **not** a plain object in either runtime — both hand back a Model proxy
(`model.ts` `_modelProxyHandler`; browser `noodl-js-api.ts:67`, cloud `noodl-js-api.js:27`). The
handler implements `get`, `set`, `ownKeys` and `getOwnPropertyDescriptor` — **but no `has` trap.**
Measured on a real `Model` carrying `{title, count}`:

| expression | answer |
|---|---|
| `Object.keys(o)` / `Object.values(o)` | `['title','count']` / `['hello',3]` ✅ |
| `o['title']` | `'hello'` ✅ |
| `hasOwnProperty.call(o,'title')` | `true`; missing → `false` ✅ |
| **`'title' in o`** | **`false`** 🔴 |
| **`'data' in o`** | **`true`** 🔴 |

False for every key the author set, true for the plumbing. A `has property` block generating
`key in object` would report that **no App Object has any property**. The spec asserts `in`'s two
wrong answers beside `hasOwnProperty`'s right ones, so the shorter operator cannot later look like
a safe simplification. ⚠️ **This bites Function nodes and MCP code too, not just Blockly.**

⚠️ `JSON.stringify` of an App Object **adds an `id` key** (`Model.prototype.toJSON`) — a JSON round
trip does not return what went in.

### 🔴 `Connection.connect` lies in both directions and never throws

Empty socket + refused pairing ⇒ `false`. **Occupied** socket + refused pairing ⇒ **`true`**, while
the offered block stays unconnected and the incumbent keeps its place. So a control written as
`expect(…).toThrow()` fails on *correct* behaviour, and `expect(connect(wrong)).toBe(false)` fails
after a successful connect. ✅ **`isConnected()` is the only honest readout.** All three readings
were measured; a spec records them. s37 wrote the control wrong twice before measuring.

### ⚠️ A bare `{}` at the start of a generated statement is a *block*

`noodl_set_object_property_expr` puts its object socket at column 0, so `noodl_new_object` emits
`({})` always. `new Function('{}["a"] = 1;')` is a SyntaxError blamed on the assignment rather than
on the block the author dropped. The spec compiles both forms.

### ⚠️ One deliberate withdrawal — a fence I did not own

The four object-shaped blocks were built dual-listed under **App Objects** as well as Data, which
is what this toolbox already does for `noodl_convert` (Math *and* Text) and which findability — the
actual complaint behind FIX-004 — argues for. It was withdrawn when
`tests-unit/vfn-012/browser-blocks.spec.ts` went red: that spec holds the three seam categories
**byte-identical**. Its assertion is stricter than the claim in its own title (*"changes no existing
block type id"*, which an addition does not do), **but relaxing another phase's guard so your own
change fits through it is the wrong way round.** Ruling in §5.

---

## 4. What to do next and why

0. 🔴 **FIX-006 AC1 + AC2 are the whole remaining task there, and they need a live authoring run.**
   Fixes 1+2 are prompt changes; no spec can grade them. Re-run the authoring measurements against
   the reported request ("take a string, cut first char, convert to number, multiply by 0.9") and
   check the model reaches for a Function/Expression, and writes `const`/`slice` not `var`/regex.
   **Agent-actionable if a live build loop is available.**
1. 🟢 **Drive FIX-004 §C** — everything in it is headless Blockly plus a real `Model`. Worth doing
   **alongside another drive**: open the Logic Builder, confirm the **Data** category draws all
   seven blocks in its flyout (read the *flyout workspace*, not the toolbox XML — that is the hole
   `hat-migration.spec.ts`'s `try/catch` leaves), then build `read JSON → the property names of →
   For each → get property of` and check it runs. ⚠️ A drive is also the only way to see whether
   `Data` beside `App Objects` reads clearly on screen.
2. **FIX-006 AC4's editor half** — the in-editor `systemPrompt()` on the wire, not in source. Cheap
   once an editor is up; ⚠️ do it **alongside another drive**, not for its own sake.
3. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
4. **FIX-004 AC2's cloud half.** ⚠️ `console.log` in the cloud sandbox is **not stdout**:
   `sandbox.isolate.js` routes it to `_noodl_api_call('log', …)`. Expect a Noodl log entry.
5. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

s36's lesson was *ask what the RULE would say about code that is already correct*. **s37's is the
next question along: ask what your INSTRUMENT says when the answer is the one you expect.** Three
separate things lied in the same afternoon — `in` on a Model proxy, `connect()`'s return value, and
`npx jest` run from the wrong directory — and each was *plausible enough to write a passing spec
around*. The `in` trap would have shipped a block that always says "no"; the `connect()` trap made a
correct refusal look like a failure twice; the cwd trap printed `Tests: 0 total` and read as a
broken spec file. **None was caught by reading. All three were caught by varying one thing and
watching the answer change.**

✅ **And measure the memory index with `node`, never `python`** — in Python both `len(s)` and
`len([c for c in s])` are code points, so the check prints two identical numbers and cannot see the
UTF-16 overflow that actually binds.

---

## 5. Owed by Richard

- 🟢 **FIX-004 §C — the seam-category question, NEW.** Should `App Objects` also list the four
  object-shaped blocks (`get`/`set property` by expression, `the property names of`,
  `has property`)? And should `tests-unit/vfn-012/browser-blocks.spec.ts`'s byte-identity assertion
  be narrowed to the claim its own title makes — *no existing block type id changes* — so future
  additions are not forbidden by accident? **Cheap either way; both are one edit.**
- 🟢 **FIX-005 — the dead-selector decision.** §4 item 3. Delete or retarget. **Cheap either way**;
  nothing is currently broken on screen, so this is about the record and about whether the toolbox
  should follow the token palette at all.
- 🔴 **FIX-005 part 2 — the rename.** **A.** Keep `Runtime Variables` + a tooltip — cheapest.
  **B.** `Global Variables` + `App Config` → `App Settings`. **C.** Revert to `App Variables` and
  rename `App Config` — biggest sweep. ⚠️ **It reverses VFN-012 deliberately**, and the stated
  reason ("the global ones") is the *opposite* of why it was renamed. Copy only, plus two specs.
- 🟢 **FIX-016 ruling 1.** **(a) Copy/default**: the row says only `Type` and reads `String`
  whether or not anything is stored. **(b) Parser asymmetry, RE-PRICED DOWN**: `Outputs.Done_1()` /
  `Outputs.Done.send()` get a value port and no Type row, but **throw at runtime by name and line**
  — a copy question, not a diagnostics gap. ⚠️ **Do not conflate with plain `Outputs.Done()`.**
- 🔴 **FIX-016 §3 — signal-input semantics.** Does an incoming signal re-run the body, or dispatch
  to a named handler? Or rule signal inputs out. **The only genuinely blocked part of FIX-016.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible. ⚠️ Ctrl-Space is **OS-bound on
  your machine** (`com.apple.symbolichotkeys` key 60).
- 🔴 **FIX-017 AC3** — premise false (ports and API names never share a prefix). Restate or strike.
- 🔴 **FIX-008 fix C** — a measurement from you. The oldest open item on this list.
- 🔴 **FIX-013 — four rulings; answer ruling 1 FIRST.** Ruling 2's real payoff is **three files**:
  `sandboxData.ts` keeps `sandboxExport.ts:25`, and the 1,121-line runtime shim keeps
  `noodl-viewer-react/src/sandbox/index.ts:61`. ✅ The big subtraction is **ruling 1(c)'s**.
- 🔴 **FIX-015** — the eight rulings. Brainstorm, then its own phase.
- 🔴 **FIX-021 slices A/B** — the six memory rulings. Slice 0 is done.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  It is **phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s37.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fix it, delete
  it, or rule that a closed phase's corpus tooling may rot.** Five sessions have now declined.
- 🟢 **~18 MCP servers are alive on this checkout and nothing reaps them.** They accrue about a pair
  per session; `dev:stop` spares them **by design**. ⚠️ **Killing processes one can only *infer* are
  orphaned is your call, not a passing session's.**
- ⚠️ **MCP servers hold pre-rebuild code.** s36 rebuilt `noodl-mcp/dist` (gitignored), so **running
  servers are behind it** until they restart. The **packaged-app** repackage is still owed.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls and bit s36 twice and s37 once (`npx jest` from the repo root silently picks up the
**root** jest config, which has no TS transform: every spec then reports *"Test suite failed to
run: SyntaxError"* and **`Tests: 0 total`**, which reads exactly like a broken spec file).

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. s37 did exactly that for `objectData.ts` and
`object-data.spec.ts` and left every peer-owned dirty file untouched.

⚠️ **This checkout is busy** — **18 peer sessions** during s37, and `MEMORY.md` arrived with **38
chars free** and was at **2 free** by mid-session because a peer grew it. **Re-read before editing
shared files, and size-check at the END.** ✅ s37 added no index line at all: both of its durable
findings were filed **into** files that already have pointers
(`phase-66-scoped-from-the-user-test.md`, `harness-and-gates-pointers.md`), which costs zero budget.
⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to another phase — **do not
commit or modify it. But DO read it.**

### 🔴 Measuring the memory index

**`node`, never `python`.**

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

Budget is **17,510 UTF-16**. If those two numbers come out *equal*, your instrument is wrong, not
the file.

### Mutation controls — cheap, and they caught a real mistake

s37 ran six against the new specs (`in` for `hasOwnProperty`; bare `{}`; the statement dropped from
`HATTABLE_BLOCK_TYPES`; `keys` emitting values; a block dropped from the toolbox; the computed key
hard-coded). Each killed **1–2 specs and no more**, which is the useful shape — a mutant that kills
everything means the specs are coupled, one that kills nothing means they are decorative.

⚠️ **Restore from the backup and re-run the baseline as the LAST step, not the second-to-last.**
s37's final `perl` was a seventh mutant rather than the restore, and the run was *labelled*
"BASELINE restored" while showing 2 failures. It was caught only by reading the number.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.**

⚠️ **A survivor count is NOT proof the shield was exercised.** The discriminating version needs a
**decoy** matching `DEV_TOOL` + repo root but unprotected, which must **die** in the same run.

### Etiquette

**Announce before *and* after any `test:ci` or editor launch**, and **re-take `ListAgents` at both
ends**. ⚠️ **Two peers can share a name** — send with the `[ref]` when a listing shows one.
✅ **`test:main`, the `tsc` gates and `noodl-mcp` jest are plain Node and safe beside a live stack** —
s37 ran the first three with 18 peers active and announced nothing.
🔴 **Peer messages stay SHORT and RARE** (Richard, 08-16: *"curb its enthusiasm"*).

### Driving over MCP without an editor

✅ **s36 drove FIX-006 AC3 with no editor at all**, which avoids every editor-launch hazard:
`node packages/noodl-mcp/dist/noodl-mcp.cjs <proj> --allow-writes`, JSON-RPC on stdin.
⚠️ **`fix012-drive` is a V1 project and the server refuses it** — use `cn001-kit-drive`.
⚠️ Copy the project to the scratchpad first and rename it in **`nodegx.project.json`** (a V2 project
has no root `project.json`). Nothing then touches a real project or the recent-projects list.
⚠️ **Read the tool schema before calling** — `create_component` takes **`path`**, not `component`;
a wrong argument name comes back as a validation error that is easy to misread as the rule not firing.
