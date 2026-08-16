# Phase 69 — next session

**Written 2026-08-16, session 10.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **CN-006 is now closed on both halves.
The queue is empty and CN-007 is next** — but read §3 before you pick it up, because s10 left one
thing undriven on purpose and it is the honest starting point.

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** … **CN-005** | ✅ | ✅ | Closed in sessions 4–8 |
| **CN-006** | ✅ **BOTH HALVES** | ⚠️ **not driven** | MCP half s9, editor half s10. Gated everywhere a non-browser gate reaches; **no editor was ever launched** — §3 |
| CN-006b … CN-017 | 📋 | — | CN-007 is the other half of the authoring arc |

---

## 1. Gate readings — re-measure, never subtract from this table

| Gate | Reading |
|---|---|
| `packages/noodl-editor` jest (`test:main`) | ✅ **220 suites / 3396 — 0 failures** |
| `@nodegx/kit-scaffold` jest | ✅ **5 suites / 66** (was 4 / 58) |
| `packages/noodl-editor` `tsc --noEmit` | ✅ **0 errors** |
| `test:ci` @ `NOODL_SPEC_SEED=39393` | ⚠️ **2843 / 7** — the floor six **plus one that is not mine**, §2 |

🔴 **Two failures this session looked like regressions and neither was.** Both were peers' work, and
both took real effort to attribute — budget for that rather than assuming a red is yours:

- `test:main` first read **219 / 1 failed**. `fix-005/dropdown-contrast.spec.ts` reads
  `BlocklyWorkspace.module.scss`; a peer had deleted its `.blocklyTreeLabel` rule mid-edit. Proven by
  comparing the needle's index at HEAD (4341) against the working tree (−1). The peer committed
  during the session; the re-run is clean, **and the test count moved 3379 → 3396 in the same
  session**.
- `test:ci`'s 7th — §2.

⚠️ **HEAD moved three commits during this session** (`863afd50` → `f4d6535c`). Nothing of mine was
staged, so nothing was swept.

---

## 2. 🔴 Owed by somebody else: a golden that only `test:ci` can see

`projectmodules — injectIntoHtml snapshot … byte-identical HTML to the committed golden` fails, in a
file this session edited — so it was treated as mine until proven otherwise. It is **not**:

- `@nodegx/module-inject` and the golden are both clean in the tree;
- the only commit touching `__noodl_module_name` is **`f7da52d1`** (*"fix(cn-003): a kit can say its
  own name"*, 16:39 today), an **ancestor of this session's starting HEAD**;
- reproduced in plain Node — the generator emits one extra
  `<script>window.__noodl_module_name = "code-a";</script>` per prefix block; the golden has neither.

⚠️ **`f7da52d1` updated `@nodegx/module-inject`'s own tests and not the editor's golden.** A package
changed its output, its own gate agreed, and only a *different* package's snapshot noticed.
**Deliberately not fixed here** — regenerating another lane's golden would launder their semantic
change through this commit. It is a one-line fix and it belongs to whoever owns CN-003.

---

## 3. 🔴 Start here: CN-006 is built and has never been driven

**No editor was launched in s9 or s10.** The code typechecks, its logic is unit-tested against a real
filesystem, and its bundling is tested against a real webpack build — but **a React surface that has
never been mounted is not a surface known to render.** Three things want a drive, and the
observations are written down here *before* the drive so a pass cannot be read into a broken feature:

1. **AC1 — the scaffolded node is in the picker and placeable.** Scaffold a kit from Project
   Settings → *Node kits*, reload the preview, open the picker. ⚠️ The runtime half is asserted; the
   picker half is not. **Expected: the node appears under its kit's name.**
2. **AC3 — the *computed* style, not the parameter value.** `an-icon-host-that-sets-fill-sets-nothing`
   is the local precedent for a style that is set and does nothing. **Expected:
   `getComputedStyle(el).paddingLeft` is a resolved pixel length, and nowhere is there a literal
   `)px`.**
3. 🔴 **The `ProjectModel.modules` staleness twin — a hypothesis, not a finding.** `readModules()` is
   called after a scaffold *because the MCP side had exactly this hole*. Whether the model was
   genuinely stale without it **has not been measured**. To measure it, comment the `readModules`
   call out, scaffold, and read `ProjectModel.instance.modules` — s9's warning applies to s10 too:
   *the MCP side looked fine too.*

⚠️ Also never mounted: **`CodeFileDocument` itself**. It is registered, typechecked and reachable
from `KitsSection`; no test mounts React.

**Where everything is:** `KitsSection.tsx` (the command) → `createNodeKit()` in
`shared/utils/projectmodules.ts` → `@nodegx/kit-scaffold` → `openCodeFile()` in
`views/documents/CodeFileDocument/`.

---

## 4. What s10 settled, in one paragraph each

**✅ D1a — Richard ruled the ambiguous clause.** D1 says the command "opens `index.js` in the code
editor" and the editor had nothing that could: its CodeMirror is bound to Function-node *parameters*,
and the only precedent for reaching a file was `shell.showItemInFolder`. Rather than pick the cheap
reading quietly, it was put to him, and he ruled for the literal one. **The editor now has a general
file-editing surface** — `openCodeFile(projectRelativePath)` opens any file inside the open project.
Nothing else uses it yet; a task that wants to edit a project file no longer has to invent one.

**🔴 A third silent hole, and it only exists past a bundler.** `@nodegx/kit-scaffold` reads the
published `.d.ts` through `require.resolve`. Plain Node is honest; **webpack rewrites the call to a
module id**, which `fs` then resolves *relative to `process.cwd()`* — so the editor's scaffold worked
or threw `ENOENT` by accident of where the process started, under a source comment claiming the
opposite. Neither package's suite could see it. `resolvePublishedPackageJson` now verifies each
candidate is an absolute path that exists.

**🔴 The gate for it had to be written twice.** Mutating the fix away left it **green**, because
`"../nodegx-node-kit-types/package.json"` happens to resolve from jest's cwd — *and* from
`packages/noodl-editor`, which is a **sibling** of the types package, so the obvious correction
reproduced the same accident. Only a packaged layout (bundle beside its `node_modules`) has neither.
Against that the mutation fails with the production `ENOENT` while five controls stay green.

**✅ Shared, not copied.** `ProjectDocsModel`'s `writeTextAtomic` and relative-path helper were
private to it; they now live in `models/ProjectFiles/projectFileIo.ts` and both models import them.

---

## 5. Owed by Richard

Unchanged from s7–s9, both still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has exactly one
   production caller, so `validate:project` / `validate_project` check parameter values for **no node
   of any provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it
   when the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `npx tsc --noEmit` is red (8, unchanged) and
   runs in no CI job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.

And from s9, still open: **should `project`'s `find_tools` purpose line name kits?** It costs resident
tokens out of the same 57 CN-009 wants. `tests/kitTools.test.ts` has the control that fails when it
changes.

Also open, not caused here, all wanting task numbers:
🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else**, including the
start page's own `urlPath`.
🔴 **The `@noodl/mcp` provisioning flake.**
🔴 **NEW: `ViewerConnection.sendRefresh()` is dead at both ends** — it sends `cmd: 'refresh'`, the
runtime emits `'reload'`, and **nothing anywhere listens**. So there is no in-app "reload the
preview", which is why `KitsSection` has to *tell the author* to do it. Small, and it would close the
last rough edge on AC1.

---

## 6. Checkout conditions

Several sessions share this checkout — **19 peer sessions were live**.

- ✅ **`git commit -F <file> -- <pathspecs>`, always. Never `git add -A`, never `git stash`.**
- ✅ **No editor was launched**, so no peer's `test:ci` was ever at risk from this session. `ps` was
  walked at session start: 19 MCP servers, **zero editors**, zero webpack, zero `test:ci`.
- ⚠️ **`test:ci` was run**, which webpacks the working tree. At that moment the tree carried this
  session's files plus a peer's `BlocklyWorkspace.module.scss` edit — SCSS, which Jasmine does not
  grade, so the reading stands.
- ⚠️ **`@nodegx/kit-scaffold/src/index.js` was mutated twice** to prove the new gate bites, and
  restored and re-verified green both times.
- ✅ **The lockfile was updated with `npm install --package-lock-only`** — 3 lines, nothing but
  `@nodegx/kit-scaffold`'s new `webpack` devDependency. Read and confirmed.
- Whoever you tell you are starting, tell you have stopped.
