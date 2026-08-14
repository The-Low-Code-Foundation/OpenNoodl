# Phase 66 — next session

**Written 2026-08-14, session 1 (the first build session; the phase was scoped earlier the same
day).** Three tasks built and gated, none driven. This file is rewritten at the end of **every**
session — read §0 for how, and replace it rather than appending.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session (the phase-57/60/61 convention).
It carries exactly four things and nothing else:

1. **Built vs. driven**, per task, as a table — the phase-64 discipline. *Built* is code plus gates;
   *driven* is the app doing it. Never let the two blur into "done".
2. **Gate readings with their date and commit**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with the rulings still owed by Richard called out
   separately from the work an agent can do alone.

Learnings that outlive the phase go to memory, not here. This file is the phase's working state;
memory is the repo's. Both get written at the end of a session — the memory index line is what makes
a learning findable six phases later.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-007** docs half | ✅ | n/a | both catalogs, all 3 examples, `WIRE_FORMAT_LEGEND` |
| **FIX-007** gate half | ✅ | 🔴 no | blocks at write time; criteria 1 + 4 need the drive |
| **FIX-007** fixes 3 & 4 | 📋 open | — | `addConnection`/`getConnectionStatus`; `evaluateHealth()` on `instanceports` |
| **FIX-020** | ✅ | 🔴 no | all 3 criteria are visual — screenshots vs `new-port-1.png` |
| **FIX-010** | ✅ | 🔴 no | criteria 1–2 need the drive; specs green |
| **FIX-018** | 📋 open | — | ✅ **ruled** (option C) — buildable now, no blocker |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

🔴 **Three tasks sit at "built, not driven." That is the phase's whole debt right now.** Clear it
before opening a fourth build lane — a drive queue of three is one sitting; a drive queue of eight is
how a phase stops being verifiable.

---

## 2. Gate readings — 2026-08-14, on `3f633df4` + this session's uncommitted work

| Gate | Reading |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | ✅ clean |
| `catalog:check` / `catalog:merge:check` | ✅ up to date |
| `catalog:examples` | ✅ 62/62 strict |
| `docs:nodes:check` | ✅ 194 files / 175 nodes |
| `cloud-library:check` | ✅ 84 node types |
| MCP suite (`npx jest` in `packages/noodl-mcp`) | ✅ **41 suites / 458 tests** |
| `test:main` | ✅ **188 suites / 2866 tests** |
| `test:ci` | ✅ **2726 total / 6 failed, seed 28337** — all 6 inherited **by name** |

⚠️ **`test:main`'s baseline moved: 188/2866, not the 144/2107 in older handovers.** The suite grows;
compare names, not totals.

⚠️ **`test:main` flakes under its own parallelism.** `tests-unit/mcp-004/resolveNodeRuntime.test.ts`
("finds a node that only an rc file puts on PATH") failed once in a full run and passed 24/24 alone;
the next full run was 188/188. That spec writes a fake shell to a temp dir and *executes* it. Re-run
the **whole suite** before believing a single spawn-shaped failure.

### 2a. ✅ `test:ci` — 2726 / 6 / seed 28337, measured 2026-08-14 16:16 over the full change set

**The floor is still 6, and all six are the inherited baseline by name:**
`AI model registry` ×2 (`has exactly one default per provider that owns models`,
`treats openai-compatible as sharing the OpenAI catalogue`) and `AIX-006 style vocabulary` ×4.
**Zero new failures.** The total is 2726 against the 2670 in older readings — the suite has grown;
compare names.

⚠️ **The harness reported the backgrounded command as exit 0 while lerna reported `exited 1`.**
Exactly the recorded trap. `test-results.json` is the only reading that counts, and it said
`overallStatus: failed` with the six names. Read the file, never the wrapper's exit code.

⚠️ And the inverse trap, hit the same run: piping through `tail -50` **cuts the `Jasmine:` line**, so
its absence proved nothing here — the JSON showed 2726 specs graded. Do not conclude "graded nothing"
from a truncated log; check `totalCount` first.

Reminders that cost time when forgotten:
- Read `packages/noodl-editor/tests/test-results.json`, **not** the log.
- A run with no `Jasmine:` line **graded nothing** — re-run; never read exit 1 as failures.
- The *"more than 10000 listeners"* flood is normal and tracks progress, not defects.
- ⚠️ **Do not edit editor source while it builds.** One run was killed this session for exactly
  that: `test:ci` webpacks the renderer from `src/`, and edits landing mid-build make the result
  untrustworthy. Finish the code, *then* start it.
- Its output is buffered if you pipe through `tail` — you will see nothing until it exits.

---

## 3. What this session settled — do not re-derive

**The `in-`/`out-` prefix is confirmed, from three independent directions**, so treat it as fact:
`simplejavascript.ts:736-739` passes the prefixes, `javascriptnodeparser.js` stores
`{name: prefix + p, displayName: p}`, and 80 real-artefact endpoints use the prefixed form.

🔴 **The research had the docs half right and missed the bigger half: all three shipped worked
examples wired the unprefixed name**, including a `Component Inputs → Function` wire — the reported
bug, blessed in the corpus the AI reads. `catalog:examples` validated 62/62 **before and after** the
correction, because the semantic validator skips dynamic-port types by design, so no gate could ever
have caught it. Generalised to memory as
`a-doc-that-lies-has-examples-that-lie-too` — **when a doc aimed at an AI is wrong, grep the examples
that ship beside it in the same commit.**

**Corpus calibration for the new gate** (44 test projects): 124 endpoints on 71 Function nodes, 80
prefixed, **12 hits, all 12 in agent-written graphs**, zero in hand-drawn or prefab wires. Canonical:
`Puppy test 3` → `Pages/Admin` → "Format Puppy List", `Inputs.items`/`Outputs.text` wired
`items`/`text` with `ports: []` — both wires dead, the list never rendered, report clean.

**Two of the task files' own directions were wrong, and were changed deliberately:**
- FIX-007 fix 2 said "give `nonexistentPort` a non-skip branch". It cannot: `NormNode` carries no
  `parameters`, and that rule is right to skip runtime-discovered types. It went to
  `authoredPreconditionDiagnostics` instead — which sees parameters, is shared by both authoring
  doors, and **blocks** rather than warning on canvas.
- FIX-010 said "invert the keep-on-query-change assertion at `NodePickerReducer.test.ts:35`". There
  was none to invert: that spec's comment *described* a keystroke but never dispatched `SetQuery`.
  The comment was corrected and the two missing assertions added.

**FIX-020's caller list is five, not six** — `PropListInput`/`StringListInput` stopped using
`StringInputPopup` at ERG-003 §3.

⚠️ **A sentence added to `AUTHORED_*_FIELDS` costs ~3× its length** (the connection and node schemas
are each inlined three times) and breaks `noodl-mcp`'s `toolDisclosure` **8,200-token surface
budget**. That gate's header demands each new cost argue for itself. Carry AI-facing rules in the
catalog, the legend, the examples and the *rejection message* instead — schema prose is the expensive
seat.

---

## 4. What to do next

**First, in this order, and it is one sitting:**

1. **Re-run `test:ci`, record §2a, commit.** The three built tasks are uncommitted work in a shared
   checkout — that is the riskiest state in this repo.
2. **The drive queue — three tasks, one editor, serialised.** `NOODL_REMOTE_DEBUG_PORT=9333`, check
   `lsof -i:9222` for a stray Chrome first.
   - **FIX-020** — open New port name; screenshot against `new-port-1.png`; then New group name, New
     folder name, the new-component prompt, and the canvas comment editor (the tallest, `multiline`).
     ⚠️ Filter `:not([class*=MeasuringContainer])` if you query the DOM — but note this is
     `PopupLayer`, **not** `BaseDialog`, so the double-render trap may not apply; verify rather than
     assume.
   - **FIX-010** — type "css" in the node picker; read `.Results`' `scrollTop` and `state.cursorKey`.
     Expect `scrollTop === 0` and the cursor on the top result. Then arrow to mid-list and change the
     category rail — the cursor must keep its node.
   - **FIX-007** — ask the internal AI to wire a Component Input to a Function-node input; expect a
     working connection and no `con-no-target-port`. Then the negative control: submit an
     unprefixed wire through MCP and confirm it is **rejected** naming `in-<name>`.
3. **Then FIX-008** (Tier 1 ⭐, the other AI-trust breaker) or **FIX-018** (ruled, buildable, a
   visible win). FIX-008 has the larger payoff; FIX-018 has no ruling risk at all.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 5. Rulings still owed by Richard

Unchanged from the [README](README.md)'s queue except that FIX-018 is now ruled. The batchable
smalls (FIX-002's send key, FIX-003's opt-in, FIX-009's PortEditor, FIX-011's persistence, FIX-012's
None, FIX-014's x/y, FIX-019's chip) each have a recommendation already written — **one sitting
clears seven tasks' blockers.** Ask for that sitting early in a session, not at the end.

The two big ones (FIX-015's eight style-token rulings, FIX-021's six memory-doc rulings) are their
own sessions and their output is a new phase, not code in this one.

---

## 6. Standing constraints — unchanged, do not relearn

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call; pathspec-scope
every `git add`. Check for a sibling session (`git log --since="3 hours ago"`, and read untracked
files rather than assuming they are yours) — the answer changes mid-session and has been false-then-
true inside one. `dev:stop` kills Richard's MCP servers; kill the `scripts/start.ts` pid instead.
Full list in the [README](README.md) § "Standing constraints inherited".
