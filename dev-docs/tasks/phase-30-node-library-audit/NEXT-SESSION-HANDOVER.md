# Next session — Visual remediation is under way. 13 defect cells down, 34 to go, and most of what is left is owned elsewhere.

Continue on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip when this was written: `bbfd6340` (plus this commit). **One worktree, three branches, clean
tree.** If you find an uncommitted file it is orphaned, not in flight — read it, then commit or
discard it deliberately.

## Where things stand

✅ **NDA-012's audit is complete: 17 of 17 categories, 136 of 151 nodes, twelve checks each.**
✅ **Remediation has begun.** Stream A of Richard's 2026-08-01 decision split is **done**: six fix
items, **13 of Visual's 47 in-scope ⚠️ cells closed**, all live-QA'd.

| Commit | What |
|---|---|
| `a1aaa73a` | `Page Router`'s `resetAsync` — RT-1/RT-2/RT-3 (4 cells) |
| `05d7bfe6` | `Dropdown`'s `items` setter — one rewrite, three defects (5 cells) |
| `3d0b72ba` | The `Repeater` clears on an empty `Items` — DC-iii (1 cell) |
| `0ec494ad` | `shortDesc` deleted — 57 sites, zero readers |
| `67e84363` | `Icon`/`Button` padding — DV-ii (Verdict prose) |
| `bbfd6340` | The three one-liners — DV-iii, Radio Button Group G1, Slider A3 (2 cells) |

**`Icon` and `Radio Button Group` are now clean. 13 nodes still carry at least one defect.**

### Gates — run before *and* after, all eight

| Gate | Before | After |
|---|---|---|
| `packages/noodl-runtime` jest | 93/94 suites, 1750 passing | **93/94, 1751 passing**, 0 failed |
| `packages/noodl-viewer-react` jest | 39 suites, 437 passing | **42 suites, 470 passing**, 0 failed |
| runtime typecheck | clean | **clean** |
| viewer-react typecheck (`--skipLibCheck`) | clean | **clean** |
| `catalog:check` | clean | **clean** |
| `catalog:merge:check` | clean | **clean** |
| `cloud-library:check` | clean | **clean** |
| editor `test:ci` | 2000 specs, 0 failures | **2000 specs, 0 failures** |

**No new console noise.** ⚠️ The `router-handler.ts:52` deferred-navigate trace in the viewer suite
was **measured at 2 occurrences on both sides** by stashing the change — it is pre-existing, from
`nda-004-navigation-failure.test.ts`. Don't re-chase it.

⚠️ **The TSFixme ratchet is still RED at the inherited `any +35` / `@ts-expect-error +1`, and this
session contributes zero.** ⚠️ **Do not re-baseline it.** The unowned job stands: **+28 of the +35 is
phase 30's own corpus test files** — `nda-016-layout-sizemode.test.ts` (+12),
`nda-004-navigation-failure.test.ts` (+9), `nda-008-stack-replace-transition.test.ts` (+7). Typing
those three takes it most of the way to green. The four files added this session use `unknown` and
narrow interfaces and add nothing to it.

## §1 — What phase 30 has left

1. **34 Visual ⚠️ cells across 13 nodes** — see §3. ⚠️ **The largest single block is `DV-viii` and it
   is not this phase's:** seven nodes need a completion signal and `ERG-001` owns the collision sweep
   that names the ports. Patching them here means doing them twice.
2. **`NDA-010 §1`**, **`NDA-017 §2`** (the whole twelve-family table, not Expression alone).
3. **Live-QA tails**: NDA-002, NDA-013, NDA-014, plus `Image`'s `On Error` and `Drag`'s `scale || 1`
   and snap-timer cleanup (§4).
4. **One decision left that is Richard's**: whether phase 34 ships before or after the alpha.

## §2 — The one rule this session produced

⚠️ **"A declared default that never applies" is not one defect with one remedy.** Two fixes to the
same finding class went in **opposite directions**, and both are right:

- **DV-ii — delete the declaration.** `Icon` and `Button` declared padding nothing had ever honoured.
  Adding a 5px stylesheet rule for Icon now would move every existing Icon on every canvas to satisfy
  a promise no author has ever seen kept. So the declaration went, and the stylesheet (for Button) or
  plain `0` (for Icon) became the single source. **No pixels moved.**
- **DV-iii — make the behaviour real.** `Component Stack`'s `Clip Content` says ✓ in the panel and is
  a *documented* promise whose absence causes visible layout breakage. So `overflow: hidden` went into
  `defaultCss` and the rendering changed to match the declaration.

**The question to ask per port is which of the declaration and the behaviour is the one to believe.**
DB-ii tells you they disagree; it does not tell you which is wrong.

## §3 — The 34 remaining cells, ranked

| Node | Cells | Notes |
|---|---|---|
| **Group** | A3, B1, B2, B3 | B3 → `ERG-001` |
| **Repeater** | B1, B2, D1, E1 | The Dynamic-template surface: a `templateScript` throw reports to `editorConnection` only. **The phase's most common shape**, and cheap now that G1 is done |
| **Drag** | G1, B1, B2, B3 | B3 → `ERG-001`. G1 and the snap-timer work need a frame clock (§4) |
| **Page** | A3, B1, B2, D1 | |
| **Page Router** | A2, B3, D1 | **A2** — the change test is still identity on the page-info object, so editing a page's path *in place* makes `Reset` re-read nothing. **D1** — `decodeURI` then `decodeURIComponent` on the same parameter, two rules. B3 → `ERG-001` |
| **Video** | A3, B3, E1 | B3 → `ERG-001` |
| **Radio Button** | A1, A3, F1 | **F1 is the category's only class-F instance**: a Radio Button outside a group is visibly a control and functionally inert |
| **Text Input** | A1, G1, B3 | B3 → `ERG-001` |
| **Slider** | G1, E1 | **G1** — `newValue \|\| 0` conflates `null` with a legitimate `0`, then clamps to `Min`. **Pinned as-is** in `nda-012-control-one-liners.test.ts`, so the fix is already guarded |
| **Component Stack** | B3 | → `ERG-001`. Plus **DV-ix**, new, below |
| **Checkbox** | B3 | → `ERG-001` |
| **Dropdown** | E1 | `items` is `type: 'array'` — a library-wide type question, not this node's bug |
| **Columns** | D1 | |

**Cheapest real wins left, in order:** the Repeater's B1/B2 (same `raiseRuntimeError` move this
session did four times), Page Router's D1, Slider's G1 (already pinned), Radio Button's F1.

⚠️ **Eight of the 34 are `B3` and belong to `ERG-001`.** Removing them, the genuine remaining
per-node work is **26 cells across 12 nodes**.

### DV-ix — new, found by live QA, filed not fixed

`Component Stack`'s `resetAsync` guards `pages` with `=== undefined || .length === 0` and then
dereferences `pages[0].id`. A **present but non-array** `pages` passes the guard and throws. That is
**RT-3's exact shape in the sibling node**, and its `G1` had been marked ✅ against the case the code
handles (empty) rather than the one it does not (malformed).

**Low priority but not zero:** the proplist editor cannot produce a non-array, so it is unreachable by
ordinary authoring — but an imported or hand-edited project can, and honest legacy import is
`LIB-006`'s promise.

## §4 — Live QA still owed

- **`Image`'s `On Error`** — needs a real DOM `error` event.
- **`Drag`'s `scale || 1` fallback** and **its snap-timer cleanup** — need a frame clock.
- The older tails: **NDA-002, NDA-013, NDA-014**.
- ⚠️ **`Dropdown`'s and the `Repeater`'s fixes are corpus-verified only.** Both are exercised against
  a real `Collection` (`on`/`off`/`set` are the runtime's own), which is strong, but neither was driven
  in the running editor — that needs a graph wired to a source that emits `null`.
- ⚠️ **DV-iii's *consequence* was not observed.** `overflow: hidden` is measured on the element; a
  taller pushed component actually being clipped was not, because the QA fixture's stack had no
  mounted child. That distinction is DV-ii's own rule and it applies to this session too.

### The live-QA recipe that worked, end to end

⚠️ **The launcher's scratch projects `VerifyFix3`/`VerifyFix4` have been emptied** by earlier dev
launches — every component has zero nodes and `rootComponent` is null. **Do not plan a QA session
around them.** Build a purpose-built project instead; it is faster and the nodes carry only what you
put there, which is what makes a default measurable.

`/Users/richardosborne/vscode_projects/NodeGX test projects/nda012-live` is this session's, and is
registered in the launcher. It has one `Group` holding an `Icon`, a `Button`, a `Component Stack` and
an **unconfigured `Page Router`** — plus a 2000px `/Tall` component.

```bash
# 1. Register a project without a native file dialog: the launcher reads this at boot.
#    ⚠️ Patch it with the app STOPPED, or it is overwritten on exit.
#    ~/Library/Application Support/NodeGX/recently_opened_project.json
#      → recentProjects[] { retainedProjectDirectory, latestAccessed, id, name }

nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 10; done; sleep 40
npm run cdp -- health
npm run cdp -- click "[class*=Grid] > *:nth-child(1)"      # newest project is card 1
npm run cdp -- eval "Object.keys(window).filter(k=>/Noodl|NodeLibrary|Graph/i.test(k))"
npm run cdp -- eval "…" --target=viewer                     # computed styles
npm run dev:stop
```

⚠️ **Read runtime failures out of the editor's warnings panel, not the console.** The viewer's
`console.error` is **not** mirrored into `.logs/dev.log` (only uncaught exceptions are), and racing
`cdp console` against preview boot is unreliable. The error bus's editor subscriber puts every raise
in the panel as persistent state:

```bash
npm run cdp -- eval "document.querySelector('[class*=WarningsChip]').innerText"   # the count
npm run cdp -- click "[class*=WarningsChip]"                                      # then read body innerText
```

That is how `router/no-pages` was confirmed, with node provenance, in one call.

⚠️ **`__nodeGraphEditor.model` node parameters can be set live and they reach the viewer.**
`node.setParameter('pages', {...})` on a root's child re-runs the node's setter in the preview — which
is how `router/no-start-page` was produced without a restart.

⚠️ **A stack trace naming a method does not name the node.** Find the line in the *served* bundle
(`curl -s http://localhost:8574/noodl.viewer.js | sed -n 'Np'`) and grep **backwards** for the
enclosing `name:` / `displayNodeName:`. Three diagnoses of one exception were wrong before this
settled it.

⚠️ **`Component Stack`'s `Pages` and `Page Router`'s `Pages` have incompatible shapes** —
`{id, label}[]` (a `proplist`) versus `{startPage, routes}`. Getting them the wrong way round is what
produced that exception, and nothing reports the mismatch.

## §5 — Waiting on Richard

- **Does phase 34 ship before or after the alpha?** Richard's standing 2026-08-01 priority is *finish
  phase 34 before the alpha*; the case for finishing phase 30 first is now stronger again, since the
  audit is done and stream A is closed.
- Standing: admin-token disclosure, Q6, `cloudservices` vs `backendServices`,
  `BCN-006-LIFECYCLE-DESIGN.md` §9, nodegx `files.delete` defaulting to `"nobody"`.

**Answered and now acted on:** `shortDesc` (deleted), the `Repeater`'s `null` semantics (clears), the
deprecated set (no revivals), `NDA-017 §1` (per-input "Run on value change"), duplicate-insert (became
`OUTCOME-CONTRACT.md` / `ERG-001`).

## §6 — Traps

### New this session

- ⚠️ **Citations drift inside a single phase.** Page Router `:272`/`:284` → `:280`/`:292`; Radio
  Button Group `:82` → `:85`; Slider `:205` → `:220`. Same code every time. **Re-verify before
  working from one**, even one written days ago by this phase.
- ⚠️ **A corpus row that pins a defect must be run against the old code before you trust the fix.**
  Every file this session was stashed-and-rerun: 3–6 red per file with the controls green. Two rows
  earned their keep by passing at baseline — the Repeater's `[]` case (an empty array is truthy, so it
  always worked) and Radio Button Group's number coercion.
- ⚠️ **`forceUpdate` and `flagOutputDirty` are non-writable `Node.prototype` properties.** A plain
  assignment throws; `Object.defineProperty` on the instance shadows them. That is how both new
  control tests count re-renders.
- ⚠️ **A hand-built instance does not scale to a node with mixins.** The router test's bag-of-fakes
  works because `resetAsync` touches little; a `Dropdown`'s `initialize` is the whole chained
  `NodeSharedPortDefinitions` stack and reaches a dozen methods. Use `createCorpusGraph` for those.
- ⚠️ **A hand-built instance does not inherit `raiseRuntimeError`** — it lives on `Node.prototype`.
  Recording it on the probe is what lets a row assert the code *and* that nothing threw.
- ⚠️ **`npx jest 2>&1 > file` loses stderr** — the redirects apply in the wrong order, and jest writes
  its summary to stderr. Use `> file 2>&1`. This briefly made a pre-existing console trace look new.
- ⚠️ **Scope a `shortDesc`-style grep past `packages/noodl-editor/src/external/`** as well as the
  repo root: those are committed bundles, and they inflated a 64-site count to 354.
- ⚠️ **A regex property-stripper will edit commented-out code.** Two already-commented `shortDesc`
  lines became `/**/` and `//    inputs: {`. `git diff | grep '^+'` caught both — **always read the
  insertions of a deletion-only change.**
- ⚠️ **Per-item commits and a generated catalog fight each other.** The catalog reflects the whole
  working tree, so committing item N's source with item N+1's catalog hunks is the default failure.
  Stash the later item, regenerate, commit, pop, regenerate.

### Standing, and confirmed live again this session

- ⚠️ **`catalog:check` can pass while `catalog:merge` and `cloud-library:check` are stale.** Run all
  three. Fix with `catalog:merge` and `cloud-library:generate`. **Any `description` edit needs all
  three regenerated.**
- ⚠️ **`packages/noodl-runtime`'s bare `npx jest` crashes** in `@jest/reporters`. Use a minimal
  reporter — 20 lines, rewrite it if gone.
- ⚠️ **Build `noodl-runtime`'s `dist-types` first** or corpus suites do not start and the run reads
  short.
- ⚠️ **The Bash cwd persists.** `cd` to the repo root explicitly; `npm run catalog:check` from a
  package directory fails with "Missing script".
- ⚠️ **`noodl.deploy.js` is a gitignored artifact nothing rebuilds.** **Every fix this session is a
  viewer change**, so none of them reaches a deployed app until
  `npm run build --prefix packages/noodl-viewer-react` runs. Not done here.
- ⚠️ **`graph-harness` does not call a module's `setup`.**
- ⚠️ **`ts-jest` here targets pre-ES2015**: `[...set]` fails with TS2802. Use `Array.from`.

### Editor / CDP

- ✅ `--target=editor` (default), `--target=viewer` for the preview. ⚠️ `--target=dashboard` is stale
  advice. ⚠️ **A dev launch rewrites the project it opens** — this session opened one *outside* the
  repo, which is why the tree stayed clean. Launch detached; **never `cdp reload`**. ⚠️ **Only one
  editor at a time** (`lsof -i :8574`); a second launch trips the single-instance lock. ⚠️
  **`npm run dev:stop` when done.**
- ⚠️ **`cdp click` takes a CSS selector only** — `text=Foo` is a `querySelector` syntax error, and the
  launcher's card classes are hashed, so `[class*=…] > *:nth-child(n)` is the reliable form.

## §7 — The rig

Not used this session. Bring up from `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e`:
`docker compose --profile supabase --profile aggregate up -d` and
`docker compose --profile parse up -d`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8092/parse/health   # parse
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8055/server/health  # directus
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091/api/health     # pocketbase
```

- **Parse** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`, mounted at `/parse`.
- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`; static token
  `bcnorch-static-token-1234567890`. ⚠️ CORS disabled; proxy at `uba-e2e/bcn-orch-cors-proxy.mjs`.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`.
- **PostgREST (as "Supabase")** `:8056` — no GoTrue, no Realtime.
- **nodegx-backend** — start your own. ⚠️ Parse wire at the **root** (`/classes/…`), and
  `/api/_schema` rather than `/schemas`.

⚠️ **Left on Parse**: `nda012_Owner`/`nda012_Target` (`enemies` deliberately poisoned — DA-ii's
evidence) plus `nda012a_*`…`nda012d_*`, `bcn005_*`, `bcn004n`, `bcn007_*`, `bcnorch`.
⚠️ **Never truncate `articles` or `authors`.** ⚠️ **Never pipe a probe into `head`** — SIGPIPE kills
node partway and reads as the server having died.

## §8 — ⚠️ 857 commits exist only on this machine

`cline-dev` is far ahead of `origin/cline-dev` and of `main` — essentially the entire revival, on one
disk with no remote copy.

⚠️ **Asked on 2026-08-01. Richard's answer: "Leave it — I'll handle the remote."** A known, accepted,
owned risk. **Do not push, and do not re-litigate it.**

Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…` import, so
`tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one** pre-existing failing
test. The root `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.

## §9 — Read these first

- [`PROGRESS.md`](./PROGRESS.md) — **its newest log entry is always more current than this file.**
  The **Decisions** section, items 7–11, holds Richard's five 2026-08-01 answers.
- [`audit/visual.md`](./audit/visual.md) — **its header now carries the remediation table and the
  47 → 34 arithmetic.**
- [`FINDINGS.md`](./FINDINGS.md) — **DV-i…DV-ix**; DV-ii and DV-iii carry ✅ status lines, DV-ix is new.
- [`../../reference/OUTCOME-CONTRACT.md`](../../reference/OUTCOME-CONTRACT.md) — what **not** to touch:
  it owns every `B3` cell in §3.
- ⚠️ **There are no Visual worker notes.** `media-source.ts` still cites a `WORKER-V-NOTES.md` that
  was never written; the claim it points at is in `FINDINGS.md` under `DC-iii`.
