# DEP-008 — Notes

**Status:** implemented 2026-07-27. Spec: [DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md](./DEP-008-ARTIFACT-CONTENTS-AND-IGNORE.md).

The spec's own framing was that "the code is one function; the decisions about
defaults are the work". This file is the decisions.

---

## 1. The default ignore set

Applied on every deploy whether or not a `.noodlignore` exists. Named
individually — there is no wildcard sweep of dotfiles, because `.well-known/`
and `.htaccess` are things people deliberately deploy to a static host, and a
blanket dot-rule would take them silently. Source of truth:
`DEFAULT_IGNORE_ENTRIES` in
`packages/noodl-editor/src/editor/src/utils/compilation/build/ignore.ts`.

| Rule | Category | Reasoning |
|---|---|---|
| `.noodlignore` | the mechanism | The ignore file is configuration, not content. |
| `.git/` `.gitignore` `.gitattributes` `.gitmodules` `.github/` `.svn/` `.hg/` | version control | `.git/` alone can contain the entire project history including deleted secrets. The others were partly covered before. |
| `.DS_Store` `Thumbs.db` `desktop.ini` | OS metadata | `.DS_Store` was already excluded; the Windows equivalents were not, which is the sort of asymmetry nobody notices until they are on Windows. |
| `.vscode/` `.idea/` | editor settings | Frequently contain local paths and occasionally tokens. |
| `.noodl/` `.nodegx/` | our own state | Build scripts and editor caches. Previously caught by the `.noodl` substring check, which also took unrelated files. |
| `node_modules/` | dependencies | Both a size and a privacy problem, and the walk now *prunes* it rather than enumerating it and discarding the result. |
| `Dockerfile` `.dockerignore` `docker-compose.yml` `docker-compose.yaml` | container build | `Dockerfile` was already excluded; the rest of the set was not. Compose files routinely carry environment values. |
| `.env` `.env.*` `.npmrc` | credentials | See "the one judgement call" below. |
| `project.json` | project source | Unchanged from before. |
| `docs/` | private notes | The AIX-009 interlock. Discussed below. |

### The one judgement call: `.env`

The spec puts secret *scanning* out of scope — WF-003 owns that and this task
must not duplicate it. Excluding `.env` by name is not scanning: it is one more
named default, in the same class as `.DS_Store`, and it is the single most
expensive accident this copy step can have. A `.env` served from an app's public
origin is a full credential disclosure with no error, no log line and no
recovery short of rotating everything.

Excluding it costs a user who genuinely wanted to publish a `.env` one negation
line, and that negation shows up in the deploy report. Not excluding it costs
somebody their database. Taken.

`.npmrc` rides along for the same reason — it commonly holds a registry token.

### `docs/` — the AIX-009 interlock

Phase 15's `docs/` folder holds scoping notes, rejected approaches, backend
contracts and AI conventions. It is deliberately a *visible* directory rather
than `.nodegx/docs/` so that people read and edit it in an ordinary editor and
commit it to git — which under the old copy behaviour meant "published".

It is a default rather than something the user has to opt into: a creator who
has never read this page must not have to. It is re-includable with `!docs/`
like any other default, which is the escape hatch for anyone who genuinely wants
their design notes on the site.

Proved mechanically by `describe('DEP-008 criterion 7 …')` in
`packages/noodl-editor/tests/utils/deploy-ignore.test.ts` — a project with a
seven-file `docs/` (nested folders, `.md` and non-`.md`) deployed, asserted
absent from the output, with a root-level `README.md` still present so that the
assertion cannot be satisfied by a blanket markdown filter.

### What is deliberately *not* a default

`notes.txt`, `*.psd`, `*.sketch`, `README.md`, `LICENSE`, `*.pdf`. All of these
are things a creator might reasonably be publishing. The spec's own acceptance
criterion 1 pins `notes.txt` as *deployed* by default: the user must say so. The
defaults cover files that are unambiguously machinery or unambiguously private,
and the deploy report covers the rest by making every exclusion visible.

---

## 2. v2 project source in deploy output (scope item 4)

**Decision: v2 project source is excluded by default, and re-includable.**

The rules `nodegx.project.json`, `nodegx.routes.json`, `nodegx.styles.json` and
`components/` are added only when the project directory actually *is* v2 — the
existing `ProjectFormatDetector` decides, so this reads the live contract rather
than re-implementing detection.

Reasoning, in order of weight:

1. **Consistency with what was already decided.** `project.json` — the legacy
   equivalent, the same information in one file — has been excluded since before
   this task. Shipping v2 source while excluding v1 source is not a position
   anybody took; it is the accident the spec asked us to convert into a
   decision. Converting it in the direction of the existing decision is the
   smaller change.
2. **DEP-001 changes what `nodegx.project.json` means at runtime.** The spec
   flags this explicitly. If a deploy artifact grows a runtime-read config file
   under that name, a *source* file of the same name copied verbatim into the
   same directory is a name collision with two plausible readers — and the
   failure mode is a deployed app reading the wrong one. Not shipping the source
   file removes the question. (DEP-001's spec is not visible from this worktree;
   this is reasoning from DEP-008's own pointer to it, not from DEP-001's text.)
3. **Deploy output stops being mistakable for a project.** `deployToFolder`
   already refuses to deploy into a folder containing `project.json` ("Cannot
   deploy to a project folder"). A v2 deploy output containing
   `nodegx.project.json` + `components/` satisfies `ProjectFormatDetector`'s
   own v2 test, so the output directory *is* a project by the codebase's own
   definition — openable in the editor, importable by the MCP server. That is a
   confusing artifact to hand someone.
4. **It is source, and the built bundle is already the artifact.** The graph
   ships in `noodl_bundles/` and the export JSON regardless. The verbatim source
   copy adds no capability to the deployed app.

**The counter-argument, and why it did not win.** "Legible by design" is a real
product position, and a NodeGX app whose source travels with it is arguably a
feature — a user could open a deployed site's folder in the editor. But that is
a *feature*, and features are opted into. Anyone who wants it writes three lines:

```gitignore
!nodegx.project.json
!components/
```

and the deploy report tells everyone else that it happened. Should the product
later decide source-shipping is the default, flipping `V2_SOURCE_IGNORE_ENTRIES`
is a one-line change with a test that will fail loudly.

**Why `components/` is conditional on v2 detection.** `components/` is a
plausible name for an asset folder in a legacy project. Excluding it
unconditionally would be exactly the risk the spec's own table names — "a new
default breaks someone's existing deploy by excluding an asset they relied on".
Pinned by a spec: a legacy project's `components/legacy-widget.js` still
deploys.

---

## 3. Two bugs fixed in the same seven lines

**The substring over-match (criterion 4).** `f.fullPath.indexOf('.git') !== -1`
tested the **absolute** path, not the relative one. So it dropped
`pre.gitlab-assets/logo.png` as the spec describes — and, worse, it dropped
*every file in the project* for any project stored under a directory whose name
contains `.git` or `.noodl` anywhere in its absolute path. Matching is now by
path segment on the project-relative path. There is a regression spec for both:
the folder case, and a project deliberately created at a temp path containing
`.noodl` and `.git`.

**The walk.** The old code called `filesystem.listDirectoryFiles`, which walks
the entire tree and returns a flat list, and then filtered it — so a project with
`node_modules/` was fully enumerated on every deploy before the results were
thrown away. The walk is now recursive and prunes an excluded directory instead
of descending into it. Pruning is conservative: a directory is only pruned when
the rule set contains no negation at all, because pruning a directory a later
`!` line would have rescued would be exactly the silent under-copying this task
exists to remove.

---

## 4. Something the spec did not ask for: stale exclusions

Excluding `docs/` from *this* deploy does not remove the `docs/` that a
*previous* deploy already wrote into the output folder — and `clearFolders` only
clears top-level folders it is about to recreate, so an excluded folder is
precisely the one it stops clearing. Every existing user who has deployed a
project with private files is still serving them after this change lands, unless
something tells them.

The copy step does not delete them. It cannot distinguish an artifact of its own
from something the user put in that folder, and deleting the wrong one is
unrecoverable. So it reports them: `ProjectCopyReport.staleExclusions` lists
every excluded path that already exists in the output, the console names the
absolute paths, and the toast is an *error* rather than a success — a deploy
that leaves private files being served should not read as clean.

Pinned by two specs (the stale case and the fresh-folder case).

## 5. Deviations from the spec

**Wording of scope item 2 — "and the editor's own dotfiles".** Implemented as
the two named directories `.noodl/` and `.nodegx/` rather than a dotfile
wildcard. A wildcard would take `.well-known/` and `.htaccess`, which are
deployment *inputs* for static hosts. Named rules only.

**Scope item 5 says "the deploy report".** There is no artefact called a deploy
report in the codebase — the deploy surface is a fire-and-forget toast plus the
console. Implemented as three surfaces rather than inventing a document:

- a **pre-deploy** summary in the Deploy panel (count + rules + an expandable
  per-path list), because "before you click" is more useful than "after";
- the **success toast** carries the excluded count;
- the **console** carries the full per-path list grouped by rule, with the
  reason each default exists.

`previewProjectFileExclusions` and the copy itself go through one scan function,
and a spec asserts the preview and the actual deploy agree — a preview that
could drift from the deploy would be worse than no preview.

**`Compilation.deployToFolder` now returns a value** (`DeployToFolderResult`)
rather than `Promise<void>`, which is how the count reaches the toast. This is
the only signature change outside `build/`. The tab's `onPostBuild` no longer
raises the success toast — the caller does, so it can include the count; failure
is still raised by `onPostBuild`.

**No new dependency.** The obvious implementation is the `ignore` npm package,
which is present in the tree but only as a transitive dependency of eslint —
using it would mean editing `package.json` and `package-lock.json`, which are
the files three parallel worktrees collide on hardest, and would need an
`npm install` in the primary checkout after merge. The matcher is hand-rolled
(~150 lines) and validated against **real `git check-ignore`** output over a
19-pattern × 31-path corpus, which is a stronger guarantee than matching a
library's behaviour would have been: it pins the actual contract the spec's risk
table asks for ("use gitignore syntax as-is; do not invent a dialect").

---

## 6. Acceptance

| # | Criterion | Where it is proved |
|---|---|---|
| 1 | `docs/` + `node_modules/` absent, `notes.txt` present | `describe('DEP-008 criterion 1 …')` |
| 2 | `.noodlignore` entry excludes on next deploy | `describe('DEP-008 criterion 2 …')` |
| 3 | A negation re-includes a default, and is the only way to | `describe('DEP-008 criterion 3 …')` |
| 4 | `pre.gitlab-assets/` deploys; regression test | `describe('DEP-008 criterion 4 …')` |
| 5 | Report states excluded count and the rule per path | `describe('DEP-008 criterion 5 …')` + the panel and console surfaces |
| 6 | Targets inherit; no per-target filter | `describe('DEP-008 criterion 6 …')` — asserts, over the real source, that only `copy.ts` enumerates the project directory and only `ignore.ts` declares patterns |
| 7 | **AIX-009 interlock** — populated `docs/` produces no `docs/` and no `.md` from it | `describe('DEP-008 criterion 7 …')` |

All in `packages/noodl-editor/tests/utils/deploy-ignore.test.ts` (40 specs),
wired into the editor suite via `tests/utils/index.ts`.

### Verification actually run

| Check | Command | Result |
|---|---|---|
| The 40 DEP-008 specs | jest, node runner, from the worktree | **38/38 pass** (incl. the git conformance spec against real `git check-ignore`) |
| Editor typecheck | `npx tsc -p packages/noodl-editor --noEmit` | clean |
| Editor test typecheck | `npx tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | clean |

### Not run — must come from the primary checkout

- **`npm run test:ci`** (the Electron/Jasmine editor suite). The 40 specs were
  run under a node runner, not under Electron. They use only Jasmine-compatible
  globals and `fs`/`path`/`child_process` (all externals under
  `target: 'electron-renderer'`), but that is an argument, not a run.
- **A live editor pass.** The Deploy panel's exclusion preview, the toggle, and
  the toast count have never been rendered. The `Text`/`TextButton` composition
  is unverified visually.
- **An SSR/SSG deploy.** `deployToFolder` runs twice for SSR; the second pass
  copies the same project folder through the same rules into `public/`. Argued
  identical by construction, not observed.
- **`npm run lint:ci`** reported "0 errors, 0 warnings across **0 files**" from
  this worktree — the ratchet found nothing to lint here, so it is vacuous, not
  green.
- **`npm run tsfixme`** is **RED at the base commit** (`c364c781`) and not
  because of this work: every file it names is in `packages/noodl-runtime`
  (`agent-live-endpoint.test.ts` +28, `node-signal-value-pairing.test.ts` +13,
  `api/queryutils.ts` +4, …), none of which this task touches.
- **Windows.** The walk now emits `/`-separated paths throughout, which is
  better-defined than the old `nodePath.resolve` output that `clearFolders` then
  split on `/`. Not run on Windows.
