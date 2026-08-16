# Phase 69 — next session

**Written 2026-08-16, session 4.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty, so nothing below is blocked on a decision. Then read
[CN-003](CN-003-THE-PROJECT-CATALOG-OVERLAY.md), whose slice log now carries the measurements.

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** | ✅ `ed28a03c` | ✅ | Render harness sees kits. `@nodegx/module-inject` extracted |
| **CN-002** | ✅ `378793bc` | ✅ | A skipped check says it was skipped. Baseline **0/5/8** |
| **CN-003** slice 1 | ✅ `f1663600` | ✅ | `@nodegx/kit-catalog` — the shared mapping, 26/26 |
| **CN-003** slice 2a | ✅ `d9346cc9` | ✅ | Headless extractor → `dist/kit-extract.cjs` |
| **CN-003** slice 2b | ✅ this session | ✅ | MCP + CLI callers. **Criterion 3 closed: 0/5/8 → 0/0/0** |
| **CN-003** slice 3 | 📋 | — | **Next.** Editor caller + the `compareOverlays` agreement test |
| **CN-003** slice 4 | 📋 | — | Lesson-vocabulary routing. ⚠️ **HOT FILES — see §4** |
| CN-004 … CN-017 | 📋 | — | All blocked on CN-003 except CN-005/CN-007 |

---

## 1. Gate readings

All taken this session, at HEAD with slice 2b applied.

| Gate | Reading |
|---|---|
| `@noodl/mcp` jest | ✅ **46 suites / 551** — 21 of them new here |
| `test:packages` | ✅ **14 projects**, all green |
| `catalog:check` | ✅ committed catalog up to date, **175 node types** (criterion 4) |
| `npx tsc --noEmit` in noodl-mcp | 🔴 **8 errors — byte-identical to the pre-existing set**, `diff`ed |
| `npx tsc -p scripts/tsconfig.json --noEmit` | ✅ **0 errors** |
| `validate:project` on cashflow | ✅ **0 / 0 / 0**, 28 of 28 endpoints (was 0/5/8, 18) |

⚠️ **The mcp suite baseline moved by one test that is not mine.** The handover said 45 / 529; it is
46 / 551 now and I added exactly 21. A peer landed one. Re-measure; do not subtract.

⚠️ **`test:ci` was not run and did not need to be.** Everything above is plain Node and safe beside a
live editor. If you do run it, the floor is **2843 / 6 @ seed 39393**, and an editor launch *or*
teardown reaps it while npm still exits 0.

---

## 2. What slice 2b settled

### 🔴 The acceptance number and the MCP route were never joinable

CN-003's criterion 3 is quoted against `cashflow-command-centre`. That project is a **legacy
monolithic `project.json`**, and the MCP server refuses those at startup — so the number could never
have moved by wiring the MCP server, and the previous handover's "take the reading first, then wire
slice 2b" was measuring one pipeline with the other's instrument.

Both are wired now, sharing the extractor and the mapping and differing only in which catalog
document they merge into. `src/kitExtract/extract.ts` knows about **no catalog at all** for exactly
that reason; `src/kitOverlay.ts` is the MCP server's install half, and
`scripts/validate-project.ts` merges into `defaultCatalog()`.

**The measurement, with the control beside it:**

| `validate:project` on cashflow | errors | warnings | infos | endpoints checked |
|---|---|---|---|---|
| `--no-kits` (control) | 0 | 5 | 8 | **18** |
| default | 0 | 0 | 0 | **28** |

🔴 **Do not quote the infos going to zero on their own.** Suppressing them produces the same number
and would be a regression. The load-bearing figure is **18 → 28 endpoints**, which is exactly the "10
of 28 never reached" CN-002 measured from the other side, and on `tests/fixtures/kit-app` the
replacement is a real diagnostic: `error [nonexistent-port] … did you mean 'progress'?`.

### 🔴 Slice 2a shipped a defect that only a caller could find

`entry.js` handed `process.argv[2]` to `path.join` untouched, and `require()` treats a
relative-looking path as a **module id**. A relative project directory made every kit report `Cannot
find module …` while extraction reported success. Seventh instance of *build the caller*, and the
same shape as CN-001's: **the failure presented as a success**.

### The MCP surface got kit nodes for free

Not asked for by slice 2b and worth knowing before CN-008/CN-009 are scoped: because the merge is in
`catalog.ts`, `list_node_types`, `get_node_type` and `visualRoots` are kit-aware now. Driven against
the **built** `dist/noodl-mcp.cjs` over real stdio on `cn001-kit-drive`: all five cashflow types
listed, `nodegx.cashflow.Pill` returned with its full port list. **No tool was added; the
tool-surface budget is untouched.**

### Knowingly not done

- **No cache.** The overlay is built once per session, at bind. A kit edited mid-session is not
  re-read. → **CN-014**, where the preview watcher and the editor's node library go stale the same
  way; fixing one alone would read as a whole answer.
- `packages/noodl-mcp` uses **hoisted `esbuild`** in its build *and* now in one test, without
  declaring it. Pre-existing (`build.mjs` does the same); not changed during a shared-checkout
  session, but it is a real undeclared dependency.

---

## 3. Still open, not caused here

- 🔴 **noodl-mcp's typecheck is red (8 errors) and runs in NO gate.** Verified pre-existing again
  this session by `diff` against the reading taken before any edit. Eleven `typecheck:*` scripts
  exist; `.github/workflows/pr.yml` runs four. **`scripts/` is in none of them either** — the root
  program's `include` does not list it — so `validate-project.ts` is typechecked by nothing. It is
  clean today because I checked it by hand. **Wants a task number.**
- 🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else**, including the
  start page's own `urlPath`. Anything driven by `urlPath` is unmeasurable on every page. **Wants a
  task number before tier 4.**
- 🔴 **`checkParameterValues` has exactly one caller** (`authoredPreconditionDiagnostics`), so
  neither `validate:project` nor MCP `validate_project` checks parameter values for *any* node, kit
  or built-in. Unchanged by this session. **CN-004 is written as though there is one pipeline; there
  are two.** This is item 1 in §5.

---

## 4. What to do next

### Slice 3 — the editor caller. Start here.

Build the overlay from `NodeLibrary.instance` (a read of state the editor already has — it extracts
nothing, per D3), then `compareOverlays` against the MCP route **in a test**. That is the specific
obligation D3 attached, and it is what turns slice 1's corroboration table into a control.

⚠️ **What a green `compareOverlays` will and will not say.** It says the two *registers* agree. It
does not verify the mapping — the fixture tests do that. Both routes also share the runtime, the
viewer and `generateNodeLibrary`, so a pass says *the editor's live register matches the headless
one*, not *two independent derivations agree*.

✅ **You have a real kit fixture now**: `packages/noodl-mcp/tests/fixtures/kit-app` — two nodes,
`var(--token)` colour defaults per D8, a correctly-wired component and a deliberately broken one.
`kit-hazards` beside it carries a kit that throws, a kit that shadows `Text`, and a healthy kit that
must survive both. Use them rather than building a third.

### Slice 4 — lesson vocabulary. ⚠️ Coordinate before you open these.

Routing the project-scoped catalog to `learningfolder.ts`, `lessonbundleverify.ts` and
`lessongrading.ts` (the verifier needs no change — `VerifyLessonOptions.vocabulary` is the injection
point).

🔴 **These are the hottest files in the repo**, shared with P66 and P67. **Ping the P67 session before
you open them**, and keep slice 4 in its own commit.

⚠️ **A lesson bundle is graded before its project exists.** `verifyLessonManifest` runs at *install*,
against a manifest and no project. The overlay must be built from **the bundle's own project files**,
or the check answers about the wrong kit.

### Then CN-004

🔴 **Expect real breakage, and do not soften it.** D4 was ruled against the softer rollout knowingly.
Note that the cashflow kit came out of slice 2b **completely clean** (0/0/0) — that is a fact about
its 28 connection endpoints, and says nothing about its **26 parameter values**, which are still
checked by nothing anywhere. Do not read the clean run as the kit being verified.

---

## 5. Owed by Richard — ask before CN-004

1. **Widen the project gate to check parameter values?** The 26 unverified parameters on the cashflow
   kit nodes are unverified at project level *for everyone*, kit or built-in. CN-004 assumes turning
   the checks on in one place turns them on everywhere. It does not. **Scope call, not a fix.**
2. **The ungated typechecks** (§3). Seven of eleven `typecheck:*` scripts run in no CI job, and
   `scripts/` is in none of them.

---

## 6. Checkout conditions

Several sessions share this checkout; P66 and P67 were both live throughout, and a P67 commit
(`51cff411`) landed mid-session.

- ✅ **`git commit -m … -- <pathspecs>`, always. Never `git add -A`, never `git stash`.** Peer
  working-tree changes were present in `BlocklyEditor/`, `scripts/library/check.ts`,
  `dev-docs/tasks/phase-65-*` and `phase-68-*` throughout, and none was touched.
- ⚠️ `packages/noodl-mcp/dist/` is **gitignored**. The suite therefore builds its own extractor from
  source per run rather than reading `dist/` — a suite that read `dist/` would be skipped in a fresh
  checkout and would silently grade a stale artifact in a working one. `dist/` was rebuilt by hand
  for the stdio drive; nothing depends on it staying built.
- Whoever you tell you are starting, tell you have stopped.
