# Phase 69 — next session

**Written 2026-08-16, session 7.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty. **CN-005 is next and nothing blocks it.**

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** | ✅ `ed28a03c` | ✅ | Render harness sees kits |
| **CN-002** | ✅ `378793bc` | ✅ | A skipped check says it was skipped |
| **CN-003** | ✅ | ✅ | All five items. Slices 1–4 |
| **CN-004** | ✅ `4df8c5bd` | ✅ | **Closed this session.** Items 1–3 were already done; item 4 was broken — §2 |
| **CN-005** | 📋 | — | **Next.** `ReactNodeDefinition` as a consumable `.d.ts`, no build step (✅ D2) |
| CN-006 … CN-017 | 📋 | — | CN-006/CN-007 are the rest of the authoring arc |

---

## 1. Gate readings

All taken this session at HEAD.

| Gate | Reading |
|---|---|
| `test:main` (editor jest) | ✅ **217 suites / 3369** |
| `test:packages` | ⚠️ **13 of 14 green** — `@noodl/mcp` red on a **pre-existing flake**, §3 |
| `@nodegx/kit-catalog` jest | ✅ **2 suites / 38** |
| `@noodl/noodl-viewer-react` jest | ✅ **69 / 899** |
| `@nodegx/module-inject` jest | ✅ **15** |
| `@noodl/mcp` jest | ✅ **49 / 576** when it passes — §3 |
| `catalog:check` | ✅ up to date, **175 node types** |
| `typecheck:editor`, `typecheck:editor-tests` | ✅ 0 each |
| `npx tsc --noEmit` in `packages/noodl-mcp` | 🔴 **8 errors — the SAME 8 as the last two sessions**, none in touched files. Still in no gate |

⚠️ **Baselines move under you.** `test:main` was 214/3335 last session and is 217/3369 with my two
suites. **Re-measure; never subtract from a handover's number.**

⚠️ **`test:ci` was not run here and did not need to be** — everything above is plain Node. No editor
was launched this session.

---

## 2. What this session settled

### 🔴 CN-004's items 1–3 were already done, and nothing had ever said so

Every skip site gates on `catalog.hasType()`, which CN-003's overlay makes true — so
`checkParameterValues`, the unknown-port checks and `--strict` took kit nodes on the normal path the
moment the overlay landed. **Measured before changing anything**: a kit node with `progress: 'lots'`
already drew `invalid-parameter-value` / error, identical to the built-in control, and a correct kit
node was already silent.

⚠️ Worth stating rather than quietly shipping, because three things were already true and **none of
them discriminates** — they are equally true of an overlay that resolves a type and then checks
nothing: the info count goes to zero, `unknown-node-type` falls silent, "validation knows the type".
The consequence that does discriminate was written down before anything ran.

### 🔴 Item 4 WAS broken, in both directions, and no fixture could see it

The demo kit and the cashflow kit declare **no `dynamicports` at all**, so `toDynamicPorts` ran on
the empty case for a task and a half. It called all four exported shapes `declared-port-groups` and
passed the raw entries through:

| | before | after |
|---|---|---|
| kit node with a `channelPort` | `unknown-parameter` **on a CORRECT kit** — guaranteed, the exporter keeps a channel port out of the static list on purpose | silent |
| kit node's conditional group, parameter set while off | **nothing** | `inactive-conditional-parameter`, as a built-in draws |

The two vocabularies differ: `formatDynamicPorts` emits `{ name, condition, ports: [portObject] }`,
the catalog stores and every consumer reads `{ condition, inputs: [name] }`. One is a false
accusation, one a silent miss — a fix for whichever was noticed first leaves the other.

New fixture `packages/noodl-mcp/tests/fixtures/kit-dynports` is a **real kit run by the real
extractor**; `dynports-kit-nodelibrary.json` is its recorded payload, which is what the mapping suite
grades against. All of it is mutation-proven: reverting `toDynamicPorts` kills 8 mapping tests and
both consequence tests, and correctly leaves the 12 parity tests green.

### ✅ AC 4b was driven, not just verified

CN-003 slice 4 graded the *install gate*. The criterion asks for the step to **tick**, so
`lessonStepTicks.test.ts` builds the runtime's own eval context with the node placed and asserts
`gradeLessonSteps(...).passed`. 🔴 `exists` matches on `node.type.name` off the project graph and
consults no catalog, so it would tick with no overlay at all — **`hasPort` is the load-bearing half**,
and its overlay-cleared control is what makes the test mean anything.

---

## 3. 🔴 The mcp gate is flaky, and it was before this task

`@noodl/mcp`'s provisioning suites (`provision.test.ts`, `projectOwnsBackend.test.ts`) start real
backend processes and fail intermittently under machine load. **Interleaved A/B runs on this machine:**

| | runs failing |
|---|---|
| without CN-004's suite | **2 of 6** |
| with it | 4 of 6 |

and a 49th suite touching **no package code at all** — 1.5 s of arithmetic — reproduces the same
failures. `READY_TIMEOUT_MS` is 30 s, so it is not that deadline.

🔴 **A sequential "clean before, red after" comparison on a shared machine measures the machine, not
your change.** A single before/after sample had me convinced this task caused it, and that reading
was committed to a comment before the interleaved runs falsified it. **Interleave, on a box with 18
concurrent sessions.**

**This wants a task number.** It is not CN-004's and no amount of thrift in a new suite closes it.

---

## 4. Owed, and small

- ⚠️ **The packaged `dist/noodl-mcp.cjs` still carries the old mapping.** Registered MCP servers get
  the item-4 fix only after a rebuild. Deliberately not rebuilt here: 18 peer sessions have a server
  running out of that path.
- ⚠️ **Re-record `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`.**
  Its `kitModule` still reads `'Unknown Module'`; `kitAgreement.test.ts` asserts that and is marked a
  fossil in place. Costs a **viewer build and a drive** — the editor loads its bootstrap from
  `src/external`, gitignored build output of `noodl-viewer-react/static`. After it the expectation
  becomes `['Demo Kit', 'Demo Kit']`.
- ⚠️ **The kit-name fix is still unverified in the running editor**, for the same reason. Both halves
  are tested and mutation-proven; what has not been observed is the two meeting in a built viewer.

---

## 5. Owed by Richard

1. **Widen the project gate to check parameter values?** Unchanged, and CN-004 sharpened it rather
   than settling it. `checkParameterValues` has **exactly one** production caller
   (`authoredPreconditionDiagnostics`), so `validate:project` / `validate_project` check parameter
   values for **no node of any provenance**. 🔴 That is not a kit-specific hole, so D4's parity holds
   either way — which is why CN-004 could close without it. `cn004.test.ts`'s last block asserts the
   silence deliberately, **so it fails loudly on the day the scope call is taken: replace it, do not
   delete it.**
2. **The ungated typechecks.** noodl-mcp's is red (8) and runs in no CI job; seven of eleven
   `typecheck:*` scripts run nowhere, and `scripts/` is in none of them. Unchanged.

Also open and not caused here, both wanting task numbers:
🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else**, including the
start page's own `urlPath`. 🔴 **The mcp provisioning flake**, §3.

---

## 6. Checkout conditions

Several sessions share this checkout; peers were active in `phase-50`, `phase-65`, `phase-68` and
`scripts/library/check.ts` throughout, and none was touched. The working tree at handover carries
exactly the four peer paths it carried at session start.

- ✅ **`git commit -m … -- <pathspecs>`, always. Never `git add -A`, never `git stash`.** Untracked
  fixtures were added and committed in one chain with the message already in a file.
- ✅ **No editor was launched** — everything is plain Node, so no drive negotiation was needed and no
  peer's `test:ci` was at risk.
- Whoever you tell you are starting, tell you have stopped.
