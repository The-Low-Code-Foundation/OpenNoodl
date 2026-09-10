# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-10 (session 7)

| task | AC | state |
|---|---|---|
| CMP-001 | AC1 the `States.currentState` enum input | ✅ s2, four assertions over the wire |
| CMP-001 | AC2 the playbook ships as a doctrine field | ✅ s6 — `interfaceDoctrine` on `get_project_info`; **s7 added an eleventh rule** (the repeated row) and 4 specs |
| CMP-001 | AC3 four new corpus examples | 🟡 **s6 built the four; s7 judged the remainder and closed it as a judgement** — 26% publishing, floor still FAIL, deliberately |
| CMP-001 | AC4 a built page clears the three floors | OPEN — needs CMP-002 |
| CMP-002 | the graded baseline build | **NEXT, and the only thing left.** 🔴 s7 could not run it — see below |
| CMP-003 | AC1 the doctrine stops forbidding the named utility | ✅ s2, both copies |
| CMP-003 | AC2 P10 in the playbook | ✅ s6 |
| CMP-003 | AC3 a built page produces one | OPEN — needs CMP-002 |
| CMP-003 | AC4 the ledger column | ✅ s2 |
| CMP-004 | AC1–AC4 | ✅ s2/s3/s4/s5 |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |
| CMP-005 | all five | ✅ CLOSED s4 + s5 |

## The first job

🔴 **CMP-002. Nothing else is unblocked.** It alone grades CMP-001 AC4, CMP-003 AC3 and CMP-004 AC5.

🔴 **WHY SESSION 7 COULD NOT RUN IT, MEASURED — CHECK BOTH BEFORE YOU START.**

1. **Its MCP servers predated the doctrine.** Both of s7's servers started `14:26:46`;
   `packages/noodl-mcp/dist/noodl-mcp.cjs` was rebuilt at `22:12:07` the same day. A server bound
   before the build sends the August doctrine and the response looks *identical* — an absent field
   is not an error. Worse: the **bound project server was the INSTALLED APP**
   (`/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs`), which contains **zero**
   occurrences of the anchor string, so it can never carry this work however recently it started.
   ✅ **The check, and run it first:** `get_project_info` must contain
   *"What goes on a component's interface"* **and** *"A repeated row publishes to the repeater"*.
   The second string is s7's and dates the bundle to this session or later.
2. **A session that has read this folder cannot produce the baseline** — session 1's rule, still
   binding, and the reason s7 stopped rather than building anyway.

⚠️ **`dist/` is gitignored and untracked**, so it is *always* a local artefact: whatever you inherit
in a fresh session may be any age. Rebuild it, then check the two strings. Do not infer from the
commit that the running server has the code.

## What session 7 built — the CMP-001 AC3 remainder, and it was not a percentage problem

🔴 **The corpus had ZERO `itemOutputSignal-…` connections across all 72 examples.** Not "the rows are
thin" — *the mechanism by which a repeated row talks back to its page was undemonstrated*, and both
examples that reached for it were broken by it.

**The mechanism, read from `foreach.tsx` rather than assumed.** A `For Each` mints
`itemOutputSignal-<name>` for every `signal` output on its template component and `itemOutput-<name>`
for every value (`:1029-1046`), sets `itemActionItemId = model.getId()` synchronously and sends the
signal in one scheduled pass (`:905-928`). **A repeater template's interface IS reachable — it
surfaces on the repeater, not on the instance.** 🔴 **And the id only moves if the signal is
consumed**: `itemOutputSignals[name]` is written only by `registerOutputIfNeeded` (`:939-941`) and
read by `onOutputChanged` (`:628`), so an `itemActionItemId` wire with no `itemOutputSignal-…` wire
beside it reads `undefined` forever.

**Two examples fixed, each broken by its own description:**

- `data-shared-array-add-remove` — title says *"insert, **remove** and clear"*. `modifyId` was wired
  from `itemActionItemId`; **nothing ever fired `remove`**, and with no item signal consumed the id
  was never set either. `/Todo Row` now publishes `remove`.
- `cloud-record-crud` — buttons read *"Rename **selected**"* / *"Delete **selected**"* with both
  writers on `idSource: "value"`; **nothing selected anything and no `modelId` was wired**. Rename
  and Delete moved onto `/Note Row`, which is the only thing that knows which record it is, and the
  row's title became a field so Rename writes a real value through `itemOutput-title`.

**Twelve rows judged and deliberately left silent**, each for its example's own subject — the full
table is in CMP-001 §AC3 remainder. The one that matters: `comp-repeater-set-item-object::/Task Row`
is the **contrast case** — it writes to its own record from inside via `For Each Actions.itemId`, and
publishing would contradict its lesson. **A row acting on itself stays internal; a row asking the
page to act publishes.**

**The doctrine gained an eleventh rule** — *"A repeated row publishes to the repeater, not to
nowhere"* — because P7 already told agents a row should publish a click while nothing told them where
it lands. Armed by 4 new specs that re-derive the three port names **from `foreach.tsx`**, not from
prose; all four controls red (doctrine renames the ports 2/24; runtime gate removed 1/24; corpus
reverted 3/24; the id wired with no signal beside it 2/24).

## 🔴 Traps — session 7's, then the standing ones

- 🔴 **THE EXAMPLES GATE PASSED A PARAMETER THAT DOES NOT EXIST.** `Group.gap`, copied in from CSS
  habit, validated **72/72 clean** — `Group` is one of the 172 skipped runtime-discovered-port nodes.
  The real port is `columnGap`. **Every new wire and parameter on `For Each`, `Group`, `States` or
  `JavaScriptFunction` must be checked by hand against `node-catalog.json`**; the gate cannot.
- 🔴 **THE AC2 GATE CAUGHT THE DOCTRINE GOING STALE AGAIN — the literal has now moved TWICE**
  (10 → 21 → 26). Both times the artefacts moved first and the spec said the sentence was wrong,
  in the same session. **Count the artefact, never bump the literal**: `measure-interfaces.py corpus`
  and the spec agreed independently on 26.
- ⚠️ **The percentage is quoted in FIVE places** beyond the doctrine text: `editor-deps.ts:399`,
  `tools/read.ts:172`, `tools/responses.ts:114`, and two tables in CMP-001. Grep `21%`-style literals
  before believing any one of them.
- ⚠️ **A background command's completion notice reported `exit code 0` for a run that exited 1** —
  the `;`-eats-the-exit-code trap, caught only because `EXIT=$?` was written into the log. Gate on
  the log, never the notification.
- ⚠️ **A peer was live in `packages/noodl-editor` during the session** and ran a production webpack
  build at 22:26–22:28, leaving `webpackconfigs/webpack.renderer.production.js` modified and two
  `index.bundle.js.LICENSE.txt` files untracked. s7's commit used pathspecs and touched none of them.
- 🔴 Sessions 3–6's still stand: **run the suite you are citing AFTER your last edit to it**;
  **`npm run docs:nodes` wipes and rewrites the whole directory** (owner NONE, still stale);
  **`npm run catalog:merge` rewrites a shared artefact — run `merge.js --check` with your inputs
  moved aside first** (s7 did: *"up to date"*, so the 109/30 diff was provably all mine, and diffing
  the example ids confirmed only two changed and no non-example key moved); **the thing you are
  changing may ship twice**; **an inert parameter in a corpus example teaches a lie** (which is why
  Rename got a real value to write); **a `*/` inside a JSDoc block ends the comment**; **editing JSON
  with `json.dumps` reformats every array — do the surgery on the text**.
- 🔴 Session 1's still stand: two obvious metrics were **green before the work** (mean ports, variant
  port — do not reintroduce them), and **a session that has read this phase cannot grade a build of
  it**.

## Numbers, measured this session

- `noodl-mcp`: **3 failed / 1532 passed / 1535 total**, the two pre-existing `*Drive` suites
  (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`) — neither references anything here.
  ✅ The delta reconciles: 1535 − 1531 = **4**, all in `cmp001InterfaceDoctrine.test.ts` (20 → 24).
  🔴 The run's own log said `EXIT=1`; the harness notification said *"exit code 0"*. Believe the log.
- `npm run catalog:examples`: **72/72 clean**, strict, warnings-as-errors — and see the `Group.gap`
  trap above for what that sentence does not cover.
- `catalog:merge --check` before the work: *"Committed enriched catalog is up to date"*. After
  regenerating, exactly **two** examples differ and **no** non-example key moved.
- `tsc --noEmit -p packages/noodl-mcp`: clean, 0 lines of output.
- `measure-interfaces.py corpus`, re-measured after: **34 components, 26% / 12% / 0.06**
  (s6 read 21% / 12% / 0.06). All three floors still **FAIL**, which is the honest reading —
  twelve rows were examined and twelve were deliberately left alone.
- Resident tool budget unchanged; the doctrine ships as a `get_project_info` result field, outside it.
