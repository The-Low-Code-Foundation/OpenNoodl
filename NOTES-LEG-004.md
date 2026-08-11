# NOTES — LEG-004, `.gitattributes` + a textconv driver

Branch `leg-004`, based on `80868946`. Everything below was measured on
2026-08-11 in this worktree, on this machine, with **two sibling sessions live
in the primary checkout** — which matters for the timings and is called out
where it does.

---

## 1. What changed, and why

| File | Change |
|---|---|
| `.gitattributes` (repo root) | four lines gain `diff=noodl`; a five-line comment header states the command-line limit |
| `packages/noodl-git/src/core/init.ts` | `NOODL_MERGE_ATTRIBUTES` → `NOODL_GRAPH_ATTRIBUTES` (`merge=noodl diff=noodl`), plus `NOODL_SUPERSEDED_GRAPH_ATTRIBUTES`; `installMergeDriver` now also writes `diff.noodl.name` and `diff.noodl.textconv` |
| `packages/noodl-git/src/core/attributes.ts` | `appendGitAttributes` gains a `supersedes` option so a pre-LEG-004 repo is *upgraded in place* rather than gaining a second set of lines; also fixes a latent bug where appending to a file with no trailing newline joined two lines |
| `packages/noodl-git/src/git.ts` | import/call renamed, `supersedes` passed |
| `packages/noodl-git/src/textconv/renderGraph.js` | **new** — the renderer (pure, no dependencies) |
| `packages/noodl-git/src/textconv/index.js` | **new** — `runTextconv(argv)`, the catalog display-name provider |
| `packages/noodl-git/src/textconv/cli.js` | **new** — the bare-`node` entry point used in a checkout |
| `packages/noodl-git/src/textconv/renderGraph.test.js` | **new** — 17 tests, one per acceptance rule |
| `packages/noodl-git/jest.config.js`, `package.json` | **new** — `@noodl/git` had no test runner at all |
| `packages/noodl-editor/src/main/src/textconv-driver.js` | **new** — the packaged app's entry point |
| `packages/noodl-editor/src/main/main.js` | `--textconv` dispatch hoisted to line 1; `process.env.appPath` set beside `exePath` |

### The three design decisions that are not in the spec

**(a) The label is not in the repeated prefix — and §1's sketch and the
Acceptance section contradict each other on this.**

The spec's sketch repeats the label on every line:

```
Pages/Checkout · Group "Order summary" · width = 100 %
```

and the Acceptance section demands *"renaming one node's label produces a
one-line diff."* Those cannot both hold: a node with five parameters would
redden six lines under that sketch. The criterion is the load-bearing half — it
is the stated test of the whole design — so the prefix is the **label-free**
designator, and the label appears exactly once per node, on its header line:

```
  Group ~grp "Order summary"
  Group ~grp · paddingTop = 8
  Group ~grp · width.unit = "%"
```

Renaming reddens one line whatever the node carries. The prefix still "names
something" in a 900-node file (type + greppable id), which was §1's actual
worry, and ids end up *present but not leading* as §1 asked. Sort order excludes
the label for the same reason: with the label in the sort key a rename moves the
node's whole block.

**(b) Cross-references never carry the other node's name.** A connection line is
`~btn.onClick → ~nav.navigate`, and a legacy-project connection line names types
but not labels. Same rule: renaming node X must not redden lines that are about
something else. In `connections.json` there is no choice anyway — see (c).

**(c) The rendering is a pure function of the file's bytes.** Git hands textconv
a *temp* file for anything that is not the worktree copy, so `connections.json`
cannot reach `nodes.json` to resolve a name. It would have been possible to read
siblings in the one case where the path is the real worktree file. That would be
worse than not doing it: the same blob would render two different ways and every
line of a diff between them would be spurious. Connections are rendered by id,
and the id is the join key back to the `nodes.json` rendering where the name is.

### Smaller judgement calls, all deliberate

- **`x`/`y` excluded entirely** (spec: "excluded, or last"), matching
  `FormatOptions.includeCosmetic`, which also defaults false.
- **`modified` excluded from `component.json`.** It is rewritten on every save
  and says nothing a commit date does not. Consequence: a commit that touches
  only `modified` shows in `--stat` with an empty `git diff`. That is the same
  shape as "moving a node produces no diff" and is intended.
- **Empty arrays and objects are dropped.** `ports: []`, `metadata: {}` and
  `visualStateTransitions: []` sit on every node of every legacy project and
  never change. Dropping them took `project-examples/agent-chat` from 2,128 to
  1,769 rendered lines (−17%) and costs a diff nothing.
- **`dynamicports` collapses to one line naming the ports.** They are derived,
  not authored — `nodesSoftEqual` in `GraphMerge` already deletes them before
  comparing two nodes — and expanded they are six lines per port whose `index`
  field churns on every reorder.
- **Multi-line string parameters are split one source line per output line**, so
  a one-character edit inside a 200-line `functionScript` reddens one line.
- **Object parameters are flattened by sorted key path** (`width.unit`,
  `width.value`), so a writer re-keying JSON produces no diff.
- **v2 root nodes are content-sorted; declared `children` order is honoured.**
  The v2 `nodes` array order is discarded entirely — that is what makes
  "reordering nodes within a file produces no diff" true. Legacy nested graphs
  keep their nested array order, because there the array *is* the authored order.
- **`diff.noodl.cachetextconv` is deliberately NOT set.** Git keys that cache on
  the blob sha alone, so every rendering ever produced would survive a change to
  the renderer and readers would be shown output no version of the code emits.
  Cost of leaving it off is in §3.

---

## 2. Deviations from the spec, with reasoning

1. **The renderer does not reuse `GraphSnapshot`, and does not extract
   `nodeName` from `DiffFormatter`.** Both live in `noodl-editor` and are
   TypeScript. The textconv driver has to be runnable by a bare `node` in a
   checkout (no bundle) and by the packaged Electron binary as a plain Node
   process, and `@noodl/git` depending on `noodl-editor` inverts the existing
   layering. It is also outside the territory this task was given.
   *What was reused instead:* the semantics, deliberately and with comments —
   the `stateParamaters` legacy-misspelling normalisation and the transient-key
   set from `GraphSnapshot`, the `dynamicports`-are-not-content rule from
   `nodesSoftEqual`, the cosmetic policy from `FormatOptions.includeCosmetic`,
   the injected `DisplayNameProvider` contract from `DiffFormatter`, and the
   fail-soft policy from `safeGraphDiff`.
   **This is a third copy of one semantics in the repo, which the spec explicitly
   warns about.** I judged the layering and the bare-node requirement to
   outweigh it, but it should be recorded as debt, not as a clean outcome.

2. **The entry point runs as plain Node, not as Electron.** The spec says
   "`main/src/textconv-driver.js` … dispatched from `main.js` next to the
   existing `--merge` check". It is dispatched from `main.js`, but from **line
   1**, not next to `--merge`, and `installMergeDriver` configures
   `ELECTRON_RUN_AS_NODE=1`. Two forcing reasons: main.js's own guard exits 1
   under `ELECTRON_RUN_AS_NODE` (and a non-zero textconv breaks `git log`), and
   every require after line 1 assumes a real Electron main process. This is the
   spec's own "slimmer entry point, not a slower one nobody runs", taken before
   measuring rather than after — see §3 for what a full app boot would have cost.

3. **`process.env.appPath` is new.** `installMergeDriver` needs to name a script
   for the Electron-as-Node route; `exePath` alone is not enough. Set beside
   `exePath` in `main.js` so `@noodl/git` never reaches for an Electron API.

4. **If `appPath` is missing, no textconv is installed at all.** `diff=noodl`
   with no `diff.noodl.textconv` is an unknown driver, which git ignores. A
   wrong command would break `git log`; installing nothing degrades to raw JSON.

5. **The user-facing note ships as a comment block inside `.gitattributes`**,
   both the repo root one and the one written into every project. That is the
   one place it is certain to be read, and it lands in the user's own repo and
   their own PR. There is no docs-site page — `docs-site/**` is outside this
   task's territory (see §5).

---

## 3. Every measured number, and how it was measured

Fixture: `/tmp/leg004perf`, a throwaway repo with **25 revisions**, each commit
renaming one node's label. Two files tracked: a real 7.7 KB v2
`nodes.json` (`replay-deepseek-v4-pro/.../ProductCard`) and the real 213 KB
262-node legacy `project-examples/agent-chat/project.json`. Timings are
`/usr/bin/time -p` around `git log -p -- <file>`.

**Invocation count, measured with a counting wrapper as the textconv command:**
`git log -p` over 25 revisions invokes textconv **49 times** (24 diffs × 2 sides
+ 1 for the root commit).

### Per-invocation cost (20× loops, `/usr/bin/time -p`, best of several runs)

| Route | ms / invocation |
|---|---:|
| `node -e "0"` (floor) | **28** |
| `node cli.js` (checkout route), catalog off | **31** |
| `node cli.js` (checkout route), catalog on | **42–48** |
| `node main.bundle.js` | **60–77** |
| `ELECTRON_RUN_AS_NODE=1 Electron main.bundle.js` (packaged route) | **132–160** |
| `ELECTRON_RUN_AS_NODE=1 Electron -e "0"` (floor for that route) | **98** |

### `git log -p`, 25 revisions — **the register number**

| Route | 7.7 KB `nodes.json` | 213 KB `project.json` |
|---|---:|---:|
| **checkout** (`node` + source) | **2.16 s** (2.16 / 2.17 / 2.15) | **3.30–4.17 s** |
| **packaged** (`ELECTRON_RUN_AS_NODE` + bundle) | **6.7 s** best, 13.4 s worst | **16.3 s** best, 36.5 s worst |
| no textconv (raw JSON, control) | 0.03 s | 0.04 s |

⚠️ **The packaged-route spread is machine noise, not measurement error I can
remove here.** Two sibling sessions were live in the primary checkout throughout,
and repeated Electron-binary spawns on macOS also pay a code-signature check.
The checkout-route numbers were stable to ±1%; the packaged ones varied 2×. Take
**~7 s for a 25-revision component and ~16 s for a 262-node monolithic
project.json** as the honest packaged figure, and treat it as an upper bound
that a quiet machine should beat.

For scale, the alternative the spec started from — a full Electron **app** boot
per blob — would be roughly 1–2 s × 49 ≈ **50–100 s** for the same command.
That is the number that made the plain-Node route non-optional.

### `diff.noodl.cachetextconv`

Not enabled, and the measurement was cut short by machine contention, so **I do
not have a trustworthy number for it**. It is in the could-not-verify list. The
reason not to enable it is correctness (stale renderings survive a renderer
change), not speed.

### The catalog costs 990 KiB in `main.bundle.js`

`catalogDisplayNames()` statically requires `@noodl/types/src/node-catalog.json`.
Webpack stats confirm this module is pulled into the main bundle **only** by
`../noodl-git/src/textconv/index.js`, at **1,013,635 bytes**, taking
`main.bundle.js` from roughly 660 KiB to **1,675,635 bytes**. That is also why
the bundle route costs ~20 ms more per invocation than the source route.

What it buys, measured over all 5,642 nodes in every `project.json` and
`nodes.json` in the repo: **25.0% of nodes get a different, friendlier type
name** (`net.noodl.controls.button` → `Button`, `JavaScriptFunction` →
`Function`, `Javascript2` → `Script`). 6.9% of node types are namespaced.

I kept it, because the rendering is then identical in a checkout and in a
packaged app and because 16 ms is 10% of a cost dominated by process startup.
**This is the single easiest thing to reverse if a reviewer disagrees**: delete
the `require` in `catalogDisplayNames`, and the renderer falls back to raw type
names with no other change (there is a test for exactly that fallback, and
`NOODL_TEXTCONV_NO_CATALOG=1` already exercises it at runtime).

### Rendering size

`project-examples/agent-chat/project.json`: 213 KB / 262 nodes / 7 components →
**1,769 rendered lines** (2,128 before empty containers and `dynamicports` were
collapsed).

---

## 4. Acceptance, run rather than reasoned

All of these were executed against real `git` in throwaway repos under `/tmp`.

| Criterion | Result | Evidence |
|---|---|---|
| `installMergeDriver` on a fresh clone → `git diff` renders named nodes and ports, no further setup | ✅ | Fresh `git init`, ran the real `installMergeDriver` + `appendGitAttributes` via ts-node; `git config --local --list` shows `diff.noodl.textconv`; `git show` renders `Group ~grp "Order summary"`, `Button ~btn · ports["onClick"].plug = "output"` |
| **Renaming one node's label → one-line diff** | ✅ | `git diff --unified=0` printed exactly `-  Group ~grp "Order summary"` / `+  Group ~grp "Order summary v2"`. Also covered by two unit tests, one of them on a node with six parameters |
| **Moving a node on the canvas → no diff** | ✅ | `x: 40,y: 40` → `x: 340,y: 540`; raw numstat `1 1`, rendered diff empty |
| **Reordering nodes within a file → no diff** | ✅ | `nodes` array reversed; raw numstat `54 6`, rendered diff empty |
| Malformed / partially written file renders raw and exits 0; `git log` never errors | ✅ | Truncated mid-JSON, empty file, and non-JSON text all render raw; `git log -p` exit 0 with empty stderr in every case |
| **Timed on ≥20 revisions** | ✅ | 25 revisions, 49 invocations — see §3 |
| User-facing note says "command line", does not imply GitHub | ✅ | Five-line comment header in both the root `.gitattributes` and the one written into every project; it also states the `git blame` caveat |

Additional things verified beyond the criteria:

- **The packaged route actually runs.** `ELECTRON_RUN_AS_NODE=1 <Electron>
  main.bundle.js --textconv <file>` renders correctly and exits 0, against a
  bundle built with `webpack.main.dev.js`. This was the part I expected to have
  to leave unverified.
- **Upgrade of an existing repo.** A repo carrying the four old `merge=noodl`
  lines plus an unrelated `*.png binary` line is rewritten in place to
  `merge=noodl diff=noodl`, the unrelated line is untouched, the note is
  appended, and a second run is a no-op.
- `git blame` uses textconv by default (no `--textconv` needed) and renders the
  graph text.
- `git log -p` exits 0 across the whole fixture history.
- 17/17 jest tests pass (`cd packages/noodl-git && npx jest`).
- `npx tsc --noEmit -p tsconfig.json`: 38 errors, **all pre-existing** and all in
  `noodl-runtime` / `noodl-viewer-react` (missing generated `@noodl/runtime`
  types because `build:types` has not run in this worktree). **Zero** in
  `noodl-git` or `src/main/`.

---

## 5. Could not verify

1. **A real packaged build.** I verified the packaged *command shape* against a
   dev-built `main.bundle.js` outside an asar. Not verified: that
   `app.getAppPath()` + `src/main/main.bundle.js` is the right path inside
   `app.asar`; that `ELECTRON_RUN_AS_NODE` reads a script from inside an asar
   (it should — Electron's asar patch is active in RUN_AS_NODE mode — but it is
   untested here); and that the code-signed binary spawns as fast as the
   unsigned dev one.
2. **Windows.** `installMergeDriver` writes `ELECTRON_RUN_AS_NODE=1 "<exe>" …`,
   an env-var prefix, which needs a POSIX shell. Git runs textconv commands with
   `RUN_USING_SHELL`, and Git for Windows ships `sh`, so this *should* work —
   but it is reasoning, not a measurement, and it is the single most likely
   place this breaks. A Windows smoke test is the one thing I would gate a
   release on.
3. **`diff.noodl.cachetextconv`** — no trustworthy timing (see §3).
4. **The editor actually calling this.** `installMergeDriver` was driven from a
   ts-node harness with `@electron/remote` and `localStorage` stubbed, not from
   a running editor. The call site in `_setupRepository` is unchanged, so the
   risk is low, but no editor was launched (correctly — the task forbade it).
5. **The merge driver still merging.** I changed `init.ts` around it but not the
   merge command itself, and did not run a conflicting merge.
6. **`git difftool` / IDE integrations** — untested.

---

## 6. Findings outside my territory — reported, not fixed

1. 🔴 **`nodegx.project.json` is not covered by any of the four patterns.** The
   v2 project manifest is written as `nodegx.project.json`
   (`ProjectStore.ts:138`, `createProject.ts:280`); the attribute line says
   `project.json`, and gitattributes matches basenames exactly. So the v2
   manifest gets neither `merge=noodl` nor `diff=noodl`. For `diff` that is a
   small loss (the manifest is a short flat JSON). For **`merge`** it may be a
   real gap that predates LEG-004 — a v2 project's settings and cloud-service
   binding merge with git's line merger, not the semantic one. I did not add the
   pattern: `merge=noodl` on a manifest would route it into `mergeProject`,
   which expects a whole legacy project, and that is a behaviour change nobody
   specced. **Worth its own task.** (The renderer classifies it correctly as
   *not* a component file and falls through to raw JSON, verified.)
2. ⚠️ **Nothing in CI runs the new tests.** `@noodl/git` is absent from the root
   `test:packages` scope list. The one-word fix is `--scope @noodl/git` in
   `package.json`'s `test:packages`, which is outside this task's territory. Left
   undone deliberately — a suite nobody runs is the "registers outlive their
   fixes" failure mode, so this should be folded in by whoever merges.
3. ℹ️ **`git diff --stat` / `--numstat` do not use textconv.** They count raw
   JSON lines. Nothing to fix; worth knowing before someone reports it as a bug.
4. ℹ️ **Legacy top-level sibling order is not rendered.** In a legacy
   `project.json`, `graph.roots` array order is simultaneously "file order" and
   "authored visual order", and the acceptance criterion demands that reordering
   produce no diff. Roots are therefore content-sorted, so reordering top-level
   visual siblings in a v1 project is invisible in the diff. v2 is unaffected —
   `visualRoots` is explicit and is rendered.
5. ℹ️ **`appendGitAttributes` had a latent bug**: appending to a `.gitattributes`
   whose last line lacked a terminator glued the two lines together. Fixed here
   because I was rewriting the function anyway.

---

## 7. Register entry text for the spec file

> | # | Finding | State |
> |---|---|---|
> | L14 | `.gitattributes`, the four patterns, the driver-install path and a headless renderer **all already exist**. The README budgeted 4 days for work that is largely `merge=noodl` → `merge=noodl diff=noodl` | ✅ read in source |
> | L15 | ⚠️ textconv sees **one file, no base** — it cannot emit `formatChange` sentences. The deliverable is a stable line-oriented rendering, which is a different design | ✅ built that way |
> | L16 | A non-zero exit breaks ordinary `git log`. Fail soft to raw JSON, per `safeGraphDiff`'s precedent | ✅ done — truncated, empty and non-JSON files all render raw and exit 0; `git log -p` exit 0 verified |
> | L17 | One Electron spawn per blob per revision. Unmeasured; measure before shipping | ✅ **measured, and the design changed because of it.** 25 revisions = **49 invocations**. A full app boot would be ~50–100 s; the driver instead runs as plain Node (`ELECTRON_RUN_AS_NODE=1`, dispatched from main.js line 1). **`git log -p` over 25 revisions: 2.2 s in a checkout, ~7 s packaged** (7.7 KB `nodes.json`); **3.3–4.2 s / ~16 s** for a 213 KB 262-node `project.json`. Packaged figures were taken with two sibling sessions live and varied 2×; treat them as upper bounds |
> | L18 | GitHub's web view does not run textconv. Say so; do not imply the browser case is fixed | ✅ stated in a comment header inside `.gitattributes` itself — the root one and the one written into every project — together with the `git blame` caveat |
> | **L19** | ⚠️ **§1's sketch and the Acceptance section contradict each other.** Repeating `Group "Order summary"` on every detail line makes a rename redden one line per parameter. Resolved in favour of the criterion: the repeated prefix is the label-free designator `Group ~grp`, the label appears exactly once per node, and the sort key excludes it | ⚠️ the correction |
> | **L20** | ⚠️ **The rendering must be a pure function of the file's bytes.** Git passes a temp file, so `connections.json` cannot resolve names from `nodes.json`. Reading siblings when the path happens to be the real worktree file would make one blob render two ways and turn every line of such a diff spurious | ⚠️ standing |
> | **L21** | ⚠️ **The renderer is a third copy of the naming/normalisation semantics.** `GraphSnapshot` and `DiffFormatter` are TypeScript in `noodl-editor`; the driver must run under bare `node` in a checkout and cannot depend on them. Semantics were mirrored with comments, not extracted. Debt, recorded as such | 📋 open |
> | **L22** | ⚠️ **Bundling the SUB-004 catalog for display names costs 990 KiB in `main.bundle.js`** (webpack stats: pulled in solely by `textconv/index.js`, 1,013,635 bytes; bundle 660 KiB → 1.68 MB) and ~16 ms per invocation. It buys a friendlier type name on **25.0% of 5,642 nodes** measured across every project in the repo. Kept, for identical output in a checkout and a packaged app; reversible by deleting one `require` | ⚠️ the trade |
> | **L23** | 🔴 **`nodegx.project.json` is matched by none of the four patterns.** The v2 manifest gets neither `merge=noodl` nor `diff=noodl`; gitattributes matches basenames exactly and the line says `project.json`. The `diff` half is minor, the **`merge`** half predates LEG-004 and may be a real gap. Not fixed here — `merge=noodl` would route a manifest into `mergeProject`, which expects a whole legacy project | 📋 open, its own task |
> | **L24** | ⚠️ **`@noodl/git` has no CI gate.** LEG-004 adds the package's first tests (17, all passing via `cd packages/noodl-git && npx jest`) but the package is absent from `test:packages`'s scope list. One word — `--scope @noodl/git` — outside this task's territory | 📋 open |
> | **L25** | ⚠️ **`diff.noodl.cachetextconv` is deliberately off.** Git keys that cache on the blob sha alone, so a renderer change would serve renderings no version of the code emits. Correctness, not speed — and its speed benefit is the one number LEG-004 did not manage to measure cleanly | ⚠️ standing |

---

## 8. Scratch left in the worktree (untracked, not committed)

`.scratch/install.ts` and `.scratch/stub-electron.js` drive the real
`installMergeDriver` outside Electron. They need
`LOCAL_GIT_DIRECTORY=$PWD/node_modules/dugite/git` in the environment, because
`getGitPath()` resolves `__dirname/../../node_modules/dugite` — correct under
webpack, wrong under ts-node. Keep or delete; they are how §4 was produced.
