# Phase 69 — next session

**Written 2026-08-16, session 8.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty. **CN-006 is next and nothing blocks it.**

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** | ✅ `ed28a03c` | ✅ | Render harness sees kits |
| **CN-002** | ✅ `378793bc` | ✅ | A skipped check says it was skipped |
| **CN-003** | ✅ | ✅ | All five items. Slices 1–4 |
| **CN-004** | ✅ `4df8c5bd` | ✅ | Items 1–3 were already done; item 4 was broken both ways |
| **CN-005** | ✅ `f251695c` + `14c948b3` | ✅ | **Closed this session.** `@nodegx/node-kit-types` — §2 |
| **CN-006** | 📋 | — | **Next.** The scaffold. ✅ D1, ✅ D8. Consumes CN-005 — §3 |
| CN-006b … CN-017 | 📋 | — | CN-007 is the other half of the authoring arc |

---

## 1. Gate readings

All taken this session at HEAD. Nothing in the editor was touched, so nothing here should have moved
— and it didn't.

| Gate | Reading |
|---|---|
| `test:main` (editor jest) | ✅ **217 suites / 3369** — unchanged from s7, as expected |
| `@nodegx/node-kit-types` jest | ✅ **3 suites / 62** (new) |
| `@nodegx/kit-catalog` jest | ✅ 2 / 38 |
| `@nodegx/module-inject` jest | ✅ 15 |
| `@nodegx/render-measure` jest | ✅ 5 |
| `npx lerna run test --scope @nodegx/node-kit-types` | ✅ runs — the gate reaches the new package |

⚠️ **`test:packages` was not run in full** and neither was `test:ci`. Nothing this session touches
the editor, the viewer or the MCP server: the commits are a new isolated package, one `--scope` flag
on the `test:packages` script, and the lockfile. The four no-build package suites were run
individually instead. 🔴 **`@noodl/mcp`'s provisioning suites are still intermittently red under
load** (2 of 6 on a quiet baseline, interleaved — s7's finding, still wants a task number).

⚠️ **Baselines move under you.** Re-measure; never subtract from this table.

---

## 2. What this session settled

`@nodegx/node-kit-types` — one self-contained `src/index.d.ts` (no imports, nothing to compile),
62 tests, registered in all four places a new workspace package needs. Full write-up in
[CN-005](CN-005-THE-DEFINITION-TYPED.md); the three things that will bite someone else:

### 🔴 AC1 could not be met as written, and the measurement came first

The criterion asks for autocomplete via `import('@nodegx/node-kit-types')` in a project with **no
`node_modules`**. Driving the TypeScript language service — the process VS Code runs — a bare
specifier resolves *only* when the package is physically installed above the file. With none, the
annotation is dead and the completion list is ~1,200 DOM globals.

**Delivery is therefore a copy of the `.d.ts` inside the kit** (`types/node-kit.d.ts`), reached by a
relative path. Same zero configuration, identical completions. Both arms are asserted in
`tests/resolution.test.js`, the failing one deliberately.
🔴 The assertion that makes it mean anything is **`not.toContain('document')`** — a list that merely
*contains* `inputCss` would pass in both worlds.

### 🔴 Two holes, both found by building the caller, both in the deliverable

Neither was in a kit. Annotating something real is what exposed them.

1. **The globals a kit runs against were undeclared** — every annotated kit reported `Cannot find
   name 'Noodl'`. Now published, and the three bootstraps disagree in a way worth knowing:
   **the SSR bootstrap alone does not set `Noodl.Env`**, so reading it unguarded throws server-side.
2. **The index signature silently disabled the whole point.** Mirroring the runtime's
   `[extra: string]: unknown` on `ReactNodeDefinition` means `dispayNodeName` matches it and draws
   **no diagnostic** — while `createNodeFromReactComponent` forwards fields by naming them one at a
   time, so the runtime drops it silently too. *Silent at both ends*, on the commonest authoring
   mistake. The published type **omits it**; that cannot produce a false error, because a field the
   interface does not list is a field the bridge does not forward.
   ⚠️ **An index signature is not a property, so the property-set drift check is blind to it** — it
   is asserted separately, in both directions.

### 🔴 A gate that skipped the files it existed to grade

`skipLibCheck: true` skips type checking of **every `.d.ts`**, not just lib files. The standalone
compile gate — and a hand-run `npx tsc --noEmit --strict --skipLibCheck` already written into the
task file as a tick — both passed **with `NoSuchTypeAtAll` substituted into the published types**.
Corrected and mutation-proven, which then surfaced a real conflict it had been hiding: the file's
global `React: any` collides with React's UMD global wherever `@types/react` is in scope (this repo;
**CN-007's examples**). Clean in a kit project; exactly one diagnostic otherwise, pinned by a test.

⚠️ **Also worth carrying:** the spec's item 4 asked for `frame` to be published as dead. Traced
instead — `useFrame = !!def.frame`, and each sub-field registers real shared ports. For a kit, both
halves are live. **Publishing it as dead would have been the lie in the other direction.**

---

## 3. Starting CN-006

CN-006 is the scaffold, and CN-005 decided one thing for it:

- ✅ **The scaffold must write `types/node-kit.d.ts` into the kit** — a copy of
  `packages/nodegx-node-kit-types/src/index.d.ts` — and emit the annotation as
  `/** @type {import('./types/node-kit').ReactNodeDefinition} */`. A bare specifier does not resolve
  and there is no build step to make it. `packages/nodegx-node-kit-types/README.md` states the
  layout; `tests/fixtures/kit-annotated/index.js` is a working model of the output.
- ⚠️ **How the copy stays current is an open question CN-006 owns.** Copying at scaffold time freezes
  it at that version, and this repo's most expensive recurring failure is a stale copy that reads
  exactly like a correct answer. Consider stamping the version in a header comment.
- ✅ D8: the scaffold emits `var(--token)` colour and spacing ports by default.
- ⚠️ CN-006 competes with CN-009 for the **57 free MCP tool-surface tokens** (bar 8,280, measured
  8,223), and the test forbids a third renegotiation.

---

## 4. Owed, and small

- ⚠️ **The cashflow kit is annotated on disk and is not under version control.** It gained
  `// @ts-check`, five `@type` annotations and `noodl_modules/cashflow-kit/types/node-kit.d.ts`. It
  reports **0 diagnostics** and its module scan is unchanged (one module, zero warnings) — the
  `types/` folder is invisible to the scanner, which enumerates only directories directly under
  `noodl_modules/` and reads only `manifest.json`. A backup of the pre-annotation kit is in this
  session's scratchpad only, so **it will not survive**; the annotated form is the one on disk.
- ⚠️ **The `.d.ts` copy in the cashflow kit is a second copy and can drift.** Nothing checks it.
  CN-006's answer to the staleness question above should cover this one too.
- ⚠️ **Still owed from s7, untouched:** re-record
  `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` (needs a viewer
  build and a drive; `kitAgreement.test.ts` is a fossil in place until then), and the packaged
  `dist/noodl-mcp.cjs` still carries CN-004's pre-fix mapping. **18+ peer sessions have a server
  running out of that path**, so a rebuild was again deliberately not done.

---

## 5. Owed by Richard

Unchanged from s7, both still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has exactly one
   production caller, so `validate:project` / `validate_project` check parameter values for **no node
   of any provenance**. Not kit-specific, so D4's parity holds either way. `cn004.test.ts`'s last
   block asserts the silence deliberately — **replace it when the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `npx tsc --noEmit` is red (8, unchanged, none
   in files touched here) and runs in no CI job; seven of eleven `typecheck:*` scripts run nowhere,
   and `scripts/` is in none of them.

Also open, not caused here, both wanting task numbers:
🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else**, including the
start page's own `urlPath`. 🔴 **The `@noodl/mcp` provisioning flake.**

---

## 6. Checkout conditions

Several sessions share this checkout. At session start the tree carried three peer paths —
`dev-docs/tasks/phase-50-legibility/notes/leg-001-lane-notes.md`,
`dev-docs/tasks/phase-68-learnbook/README.md`, `scripts/library/check.ts` — plus untracked
`dev-docs/tasks/phase-65-the-library/`. **It carries exactly those four at handover.** None was
touched, and no peer commit landed during the session.

- ✅ **`git commit -F <file> -- <pathspecs>`, always. Never `git add -A`, never `git stash`.** The
  untracked package was added and committed in one chain with the message already in a file.
- ✅ **No editor was launched** — everything is plain Node, so no drive negotiation was needed and no
  peer's `test:ci` was at risk.
- ⚠️ **`packages/noodl-viewer-react/src/react-component-node.ts` was edited twice, briefly, to
  mutation-prove the drift check**, after checking `ps` for a running `test:ci` or webpack (none).
  Both times restored and verified byte-identical against HEAD before anything else ran.
- ✅ **The lockfile was updated with `npm install --package-lock-only`** — it does not touch
  `node_modules`, so it cannot land under a sibling's running suite. The diff is 13 lines and
  contains nothing but this package; read and confirmed, unlike CN-003's run which folded in an
  unrelated version correction.
- Whoever you tell you are starting, tell you have stopped.
