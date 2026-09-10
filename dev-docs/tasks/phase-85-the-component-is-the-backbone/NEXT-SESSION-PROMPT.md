# Next session — phase 85

⚠️ **If you are here to run the CMP-002 build, you are in the wrong file.** Read
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md` and nothing else in this folder. Reading on past this line
disqualifies you from producing the baseline.

## The board, re-derived from the task FILES on 2026-09-10 (session 6)

| task | AC | state |
|---|---|---|
| CMP-001 | AC1 the `States.currentState` enum input | ✅ s2, four assertions over the wire |
| CMP-001 | AC2 the playbook ships as a doctrine field | ✅ **s6** — `interfaceDoctrine` on `get_project_info`, 20 specs, four controls red |
| CMP-001 | AC3 four new corpus examples | 🟡 **s6** — the four are built, validated and merged; the corpus-wide floors are NOT met and cannot be by four (see below) |
| CMP-001 | AC4 a built page clears the three floors | OPEN — needs CMP-002 |
| CMP-002 | the graded baseline build | **NEXT**, and now the only thing left that is not blocked on it |
| CMP-003 | AC1 the doctrine stops forbidding the named utility | ✅ s2, both copies |
| CMP-003 | AC2 P10 in the playbook | ✅ **s6** — it travelled into `interfaceDoctrine` with the other nine |
| CMP-003 | AC3 a built page produces one | OPEN — needs CMP-002 |
| CMP-003 | AC4 the ledger column | ✅ s2 |
| CMP-004 | AC1–AC4 | ✅ s2/s3/s4/s5 |
| CMP-004 | AC5 an agent reaches for it | OPEN — graded inside CMP-002 |
| CMP-005 | all five | ✅ **CLOSED** s4 + s5 |

**Every AC left in this phase now needs CMP-002.** Session 6 closed the last two that did not.

## The first job

🔴 **CMP-002, and there is nothing else left that is not blocked on it.** It alone grades CMP-001
AC4, CMP-003 AC3 and CMP-004 AC5. Run it from a cleared session on
`CMP-002-BUILD-BRIEF-READ-THIS-ONLY.md`, and 🔴 **you cannot grade it yourself if you have read this
file** — session 1's rule, still the binding constraint.

⚠️ **Before that session starts, its MCP server must be a FRESH one.** `interfaceDoctrine` is new;
the four Electron `noodl-mcp.cjs` processes that were live during session 6 are running an older
bundle and will not send it. `dist/` was rebuilt at 22:12 on 2026-09-10 and carries the field —
a server started after that is fine, a server bound before it is not, and the difference is
invisible in the response (an absent field looks like a field that was never added). Check for the
string "What goes on a component's interface" in the `get_project_info` response before trusting the
run: 🔴 **a CMP-002 build against a stale server measures the doctrine that shipped in August.**

If for any reason CMP-002 cannot be run, the honest second job is **the AC3 remainder** — but read
what it actually is first: it is NOT "add outputs until the percentage clears 50", it is a
judgement pass over the dozen existing row components (`/Note Row`, `/Task Line`, `/Order Row`, each
`IN ['title']` and `OUT []`) asking which of them should publish a click and does not. Moving the
metric is not the goal; the metric was chosen to describe a difference, and a corpus edited to
satisfy it stops describing anything.

## What session 6 built

**CMP-001 AC2** — the ten patterns as `INTERFACE_DOCTRINE_MD`, a shared module in the editor's
`authoring/prompts/` that imports nothing (AAQ-005: one substrate, two clients), re-exported through
`noodl-mcp/src/editor-deps.ts` and shipped read-write only, directly after `authoringDoctrine`.
Resident instruction surface **8,275 / 8,280 — unchanged**; the `get_project_info` payload grows
38,287 → **45,830 chars**.

**CMP-001 AC3** — four examples, one per pattern, each a component plus a page that places it:
`comp-variant-badge-states` (P4), `comp-controlled-quantity-stepper` (P2),
`comp-slot-panel-with-interface` (P7), `comp-placement-contract-avatar` (P1).

## 🔴 Traps — session 6's, then the standing ones

- 🔴 **THE PHASE'S OWN EXEMPLAR WAS NOT REAL, AND IT WAS ONE COMMIT FROM SHIPPING AS DOCTRINE.**
  CMP-001 §3.1 offered LearnBook's `Collapsable group` at *"11 nodes, 4 inputs"* with a
  `forceOpen → Inverter → pointerEventsEnabled` wire called **"the craft"**. The string `forceOpen`
  occurs in **no `project.json` on this machine** (the same grep for `Collapsable group` finds four
  files, so the search works), and all four copies read **9 nodes and two inputs**. Nor is the §2
  LearnBook column reproducible: 100 components / 58% / 3.9 mean, against the table's 204 / 73% /
  5.0. ✅ Every citation in the shipped text was re-derived from artefacts **in this repo** instead,
  and `cmp001InterfaceDoctrine.test.ts` pins each one against the real shelf. **Fifth premise in
  this phase not to survive contact — a citation in a task file is a claim, not a measurement.**
- 🔴 **A DOCTRINE MUST NOT STATE ITS OWN GRADING FLOORS.** CMP-002 reads `interfaceDoctrine` and is
  graded on AC3's three numbers. Those numbers are deliberately absent from the shipped text and a
  spec asserts their absence — *beside a known-firing anchor*, because an absence assertion passes
  on a blank field and grades nothing.
- 🔴 **THE GATE CAUGHT THE DOCTRINE GOING STALE, IN THE WILD, IN THE SAME SESSION.** AC3's four
  examples moved the corpus from 10% to 21% publishing, and the AC2 spec that asserts *"the number
  the doctrine states is the number the artefacts give"* went red an hour after it was written. Four
  comments quote that percentage too — grep before believing one.
- 🔴 **AN AC'S TWO HALVES CAN CONTRADICT EACH OTHER BY ARITHMETIC.** *"At least four new examples"*
  and *"the corpus clears 50% publishing"* cannot both be satisfied: 27 of the original 30 components
  publish nothing, so 17 of 34 needs ten more. Check an AC's halves against each other before
  building to the first one.
- ⚠️ **THE EXAMPLES GATE CANNOT SEE A MISSPELLED WIRE.** `catalog:examples` read **69/69 clean** with
  `Group.paddingLeft` mutated to `paddingLeftt` in a shipped example. It DOES catch port direction,
  undeclared component ports, unknown instance parameters, inert dimensions and raw colour/spacing
  literals — all four were exercised getting the new examples green. A closed-world check cannot
  simply be switched on: 566 port references check out, **172 are skipped** because their node has
  runtime-discovered ports, and `Group` is one of those. Check new wires by hand against
  `node-catalog.json`.
- ⚠️ **`npm run catalog:merge` rewrites a shared artefact.** Before regenerating, run
  `merge.js --check` with your own inputs moved aside: if it says *"up to date"*, the diff you are
  about to make is entirely yours. After regenerating, diff the example ids and the per-node
  enrichment rather than trusting the line count — 1,619 insertions and 153 deletions turned out to
  be four additions and one moved block.
- ⚠️ **Editing a JSON file with `json.dumps` reformats every array in it.** Six enrichment files
  came back with 59 changed lines for six one-line additions. Do the surgery on the text.
- ⚠️ **A `*/` inside a JSDoc comment ends the comment.** `phase-85-*/measure-interfaces.py` in a
  header made the module's first line of prose into code, and jest reported `ReferenceError: measure
  is not defined` pointing at line 9 of a comment.
- ⚠️ `tests/provision.test.ts` and `tests/projectOwnsBackend.test.ts` went red in two of four full
  `noodl-mcp` runs and green alone both times — real-backend contention between workers, not this
  work. The stable reading is **3 failed / 1528 passed / 1531 total**, the two pre-existing `*Drive`
  suites.
- 🔴 Sessions 3–5's still stand: **run the suite you are citing AFTER your last edit to it**;
  **`npm run docs:nodes` wipes and rewrites the whole directory** (28 pages were already stale at
  HEAD, and session 6 added six more nodes whose example lists changed — deliberately NOT
  regenerated, owner NONE); **the thing you are changing may ship twice**; **an inert parameter in a
  corpus example teaches a lie**; **a pipe eats the exit code**.
- 🔴 Session 1's still stand: two obvious metrics were **green before the work** (mean ports, variant
  port — do not reintroduce them), and **a session that has read this phase cannot grade a build of
  it**.

## Numbers, measured this session

- `noodl-mcp`: **3 failed / 1528 passed / 1531 total** (the two `*Drive` suites). ✅ The delta
  reconciles: 1531 − 1511 = **20** new specs, all in `cmp001InterfaceDoctrine.test.ts`.
- `npm run catalog:examples`: **72/72 clean**, strict, warnings-as-errors.
- `catalog:merge --check`: up to date; the regeneration added four examples, changed one description
  (`logic-quantity-stepper`, which now names its interface-carrying twin) and six nodes' enrichment.
- `measure-interfaces.py`, all four arms re-measured 2026-09-10:
  corpus **34 components, 21% / 12% / 0.06** (was 30, 10% / 3% / 0.03) ·
  prefabs **127, 84% / 20% / 0.22** · template **14, 14% / 0% / 0.00** (reproduces exactly) ·
  LearnBook-on-this-machine **100, 58% / 15% / 0.67** (⚠️ NOT the v5.1 the task table cites).
- Resident tool budget **8,275 / 8,280**, unchanged. `tsc --noEmit` clean in `noodl-mcp`.
- ⚠️ A peer was live in `packages/noodl-editor` and `noodl-core-ui` (P84 FLD-017) all session and
  committed at 21:5x. Both commits here used pathspecs; the one file session 6 added to that package
  is `authoring/prompts/interfaces.ts`, which nothing else touches.
