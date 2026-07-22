# REV-008: Trustworthy Dev Loop, Visibility, and Merge Verification Debt

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-008 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🔴 Critical (Stream A) / 🟡 Medium (Streams B–D) |
| **Difficulty** | 🟡 Medium — mostly known fixes, but Stream A touches packaging |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | REV-001, REV-002, and commit `1502581` (dev-loop fix) — all landed on `cline-dev` |
| **Branch** | `task/rev-008-dev-loop-hardening` |
| **Recommended executor** | 🟠 **Opus 4.8** — Stream A changes what ships in the packaged app, and Stream D is exploratory verification of a six-month-old merge. Streams B and C alone would be Sonnet-tier. |

## Objective

Remove the last structural reasons the dev loop can lie to you, close the
visibility gaps that remain after the tooling added in `1502581`, and pay off the
verification debt left by the `cline-dev-tara` merge.

## Background — read this first

This task exists because of what a single session on 2026-07-22 uncovered. A new
session will not have that context, so it is recorded here in full.

**The editor did not launch.** It opened a black window. The cause turned out to
be two independent stale-build-artefact bugs, stacked:

1. `packages/noodl-editor/src/editor/index.html` chooses its bundle at runtime:

   ```js
   const path = process.env.devMode !== 'yes' ? '.' : 'http://localhost:8080/src/editor';
   ```

   **Nothing in the repo ever set `devMode` to `'yes'`** — only `test.js` set it,
   to `'test'`. So the editor always loaded `./index.bundle.js` from disk while
   the webpack dev server served fresh code to nobody. HMR did nothing and code
   changes were invisible. The bundle on disk was a *production* build, which
   pairs production react-dom with the externalised *development* react, and that
   throws before first paint:

   ```
   TypeError: dispatcher.getOwner is not a function
     at getOwner (node_modules/react/cjs/react.development.js:416)
     at createDialogLayer (router.tsx:59)
   ```

   (`getOwner` is dev-only ownership tracking; production react-dom never
   installs it.)

2. `packages/noodl-editor/src/main/main.bundle.js` is the Electron **entry
   point**, and `npm run dev` only ever ran webpack-dev-server for the
   *renderer*. There was no dev webpack config for the main process at all. The
   committed bundle was months old, so **main-process edits did nothing in dev**.
   This is why the first attempt at fixing (1) appeared to fail — `main.js` was
   being edited while Electron ran a stale bundle.

Both are fixed in commit `1502581`. What remains is the *root enabler*: those
bundles are committed build artefacts living in `src/`, indistinguishable from
source. Until that changes, this class of bug can recur silently.

**Why it went unnoticed for months.** The renderer console was never surfaced
anywhere. A renderer that died on startup looked identical to one that booted
fine — the main process logged "webserver hustling bytes on port 8574" either
way. Commit `b5f200c` is literally titled "Trying to fix editor launch bugs", and
`webpack.renderer.dev.js` still carries a `BUILD TIMESTAMP` canary someone added
"to verify fresh code is running". Previous work was circling this without
landing it.

## What already exists — do not rebuild it

Landed in `1502581`. Read these before starting; they are the platform for the
rest of the work:

| Path | What it gives you |
|------|-------------------|
| `scripts/devtools/cdp.js` | DevTools Protocol client: `health`, `eval`, `console`, `screenshot`, `dom`, `wait`, `reload`, `targets` |
| `scripts/devtools/dev-debug.js` | `npm run dev:debug` — full stack with CDP on :9222, all service output tee'd to `.logs/dev.log` |
| `packages/noodl-editor/webpackconfigs/webpack.main.dev.js` | Dev build of the main process; `scripts/start.ts` runs it on every dev launch |
| `.claude/skills/run-editor/SKILL.md` | Agent-facing workflow and the repo's launch traps |
| `dev-docs/reference/DEBUG-INFRASTRUCTURE.md` | Human-facing version of the same, plus the test harness |

Quick start for a new session:

```bash
nohup npm run dev:debug -- --quiet > /dev/null 2>&1 &
until grep -q "launching Electron" .logs/dev.log; do sleep 15; done
sleep 30
npm run cdp -- health      # {"reactMounted": true, ...} means the app really rendered
```

`health` is the important one — it distinguishes "a window opened" from "the app
rendered", which is exactly the distinction that was missing.

---

## Stream A — Committed build artefacts 🔴

The root enabler. **42 tracked `*.bundle.js` files, 23.8 MB**, including all three
entry points:

| Artefact | Role |
|---|---|
| `packages/noodl-editor/src/main/main.bundle.js` | Electron main entry (`"main"` in package.json) |
| `packages/noodl-editor/src/editor/index.bundle.js` | Editor renderer |
| `packages/noodl-editor/src/frames/viewer-frame/index.bundle.js` | Viewer frame |

All three were last committed in `297dfe0` (2026-02-18) — the same 249-file
"Added sprint protocol" bulk commit that also introduced the duplicate
ElementConfigs implementation described in
[MERGE-NOTES-cline-dev-tara.md](../../reviews/MERGE-NOTES-cline-dev-tara.md).
One careless commit caused both problems.

### The decision to make

Committed artefacts in `src/` are why a stale bundle can silently run. But they
cannot simply be deleted without checking what depends on them:

- `packages/noodl-editor/package.json` `"main"` points at `main.bundle.js`, and
  `build.files` includes `"*.js"` and `"src"` — electron-builder packages these.
- `packages/noodl-editor/scripts/build.ts` regenerates them via
  `webpack.main.production.js` / `webpack.renderer.production.js`.
- A fresh clone that runs `npm run dev` now rebuilds main automatically, but the
  *renderer* disk bundle would be absent — harmless, since dev loads from :8080,
  but confirm `npm run build:editor` from a clean tree still works.

### Steps

1. Establish whether anything consumes the committed bundles other than
   electron-builder and a manual `electron .`. Check CI (`ci:build:editor`),
   `scripts/build-pack.ts`, and any docs telling contributors to run `electron .`
   directly.
2. Gitignore the generated bundles and `git rm --cached` them. Prefer a pattern
   over 42 individual entries, but keep it tight enough not to ignore real source.
3. Verify from a **clean clone**: `npm install && npm run build:editor` produces a
   working packaged app, and `npm run dev:debug` + `npm run cdp -- health` reports
   `reactMounted: true`.
4. Add a guard so this cannot regress silently — e.g. a `predev` check that fails
   if `main.bundle.js` is older than the newest file in `src/main/`, or simply
   assert in CI that no `*.bundle.js` is tracked.

### Success criteria

- [ ] No generated `*.bundle.js` tracked in git
- [ ] Clean clone → `npm run build:editor` produces a launchable packaged app
- [ ] Clean clone → `npm run dev:debug` → `cdp health` reports `reactMounted: true`
- [ ] Repo shrinks by ~24 MB of artefacts
- [ ] A regression guard exists and is wired into CI (coordinate with REV-003)

---

## Stream B — Remaining visibility gaps 🟡

`cdp.js` covers the editor renderer. It does not yet cover:

1. **The viewer frame and preview.** `src/frames/viewer-frame` is a separate
   target; a running project's preview is where most user-facing bugs live.
   `appTarget()` in `cdp.js` deliberately picks the editor page. Add target
   selection (`--target=editor|viewer`) so the preview can be inspected too.
2. **The main process.** Only its stdout is visible. Electron supports
   `--inspect` for the main process; wire an opt-in port alongside
   `NOODL_REMOTE_DEBUG_PORT` so main-process breakpoints/eval are possible.
3. **The services.** Web server (8574), cloud functions (8577) and cloud runtime
   log to `.logs/dev.log`, but there is no health check. A
   `npm run cdp -- services` that probes each port and reports up/down would make
   "is the backend even running?" a one-liner.
4. **Automated interaction.** `cdp.js` can `eval` and `wait`, but there is no
   ergonomic click/type. A `click "<selector>"` and `type "<selector>" "text"`
   (via `Input.dispatchMouseEvent` / `Input.insertText`, not synthetic DOM events,
   so React's handlers fire correctly) would make Stream D and all future UI
   verification scriptable.
5. **Crash capture on startup.** Errors thrown during boot are gone before you
   can attach. Current workaround is `console` in the background then `reload`.
   Consider having `dev-debug.js` attach automatically and write renderer
   exceptions into `.logs/dev.log`.

### Success criteria

- [ ] Viewer/preview frame inspectable via CDP
- [ ] Main process debuggable via an opt-in `--inspect` port
- [ ] One command reports the health of all dev services
- [ ] `click` and `type` exist and drive React handlers correctly
- [ ] Startup exceptions land in `.logs/dev.log` without manual attach

---

## Stream C — Screen recording permission 🟢

**Symptom.** `screencapture` on macOS returns a black rectangle where another
app's window should be, while the desktop and dock render normally. It looks
exactly like the app failed to render. During the 2026-07-22 session this cost
several wasted steps — a "black window" screenshot was initially read as an app
crash when it was really an OS permission.

**Cause.** macOS gates screen capture behind Privacy & Security → **Screen &
System Audio Recording**. The permission belongs to the *capturing* process — the
terminal or VS Code — not to Noodl.

**Resolution — in preference order:**

1. **Prefer CDP screenshots.** `npm run cdp -- screenshot out.png` renders through
   the browser compositor and never touches the OS capture path, so it needs **no
   permission at all**. This should be the default for anything inside the window,
   which is nearly all of an Electron app.
2. **Grant the permission only for native chrome** — OS window frame, native
   menus, native dialogs, multi-window layout. These are outside the renderer and
   CDP cannot see them. System Settings → Privacy & Security → Screen & System
   Audio Recording → enable for Terminal / VS Code, then restart that app.

**Action for this task:** document the distinction in
`dev-docs/reference/DEBUG-INFRASTRUCTURE.md` and in the `run-editor` skill, so a
future session reaches for CDP first and never misreads a permission-blacked
frame as a crash. If native-chrome verification is genuinely needed, note that
Playwright's `_electron` driver is the tool for it.

### Success criteria

- [ ] Both docs state CDP-first, and that a black `screencapture` frame means
      *permission*, not failure
- [ ] The native-chrome escape hatch is documented with its prerequisite

---

## Stream D — `cline-dev-tara` verification debt 🟡

The merge (`45ac274`) is structurally sound and the suite is green at **540 specs,
0 failures** — but the suite exercises **none** of what the merge actually brought
in. Full reasoning in
[MERGE-NOTES-cline-dev-tara.md](../../reviews/MERGE-NOTES-cline-dev-tara.md).

### D1. Verify StyleTokens and the embedded template system

Never run. Both merged cleanly but have zero automated coverage.

- Create a new project from the launcher and confirm the embedded hello-world
  template (`src/editor/src/models/template/templates/hello-world.template.ts`)
  produces a working project.
- Confirm style-token injection works —
  `packages/noodl-viewer-react/src/style-tokens-injector.ts` and
  `src/editor/src/models/StyleTokens/`.
- Note that `LocalProjectsModel.newProject()` was hand-resolved during the merge:
  it takes tara's embedded-template flow but keeps `runtimeVersion = 'react19'`,
  which her January branch predates. **That combination has never executed.**
  Verify a newly created project actually gets `react19`.
- Add regression tests for whatever you confirm — this is exactly the untested
  surface that let the merge sit unverifiable for six months.

Stream B's `click`/`type` would make this scriptable rather than manual.

### D2. Dead ElementConfigs node types

Confirmed during the merge:

```
net.noodl.controls.button   → exists (packages/noodl-viewer-react/src/nodes/controls/button.ts)
net.noodl.visual.group      → DOES NOT EXIST   (real type is 'Group')
net.noodl.visual.image      → DOES NOT EXIST   (real type is 'Image')
```

So `GroupConfig` keys on an identifier that never matches — it is dead config that
has never applied to anything. `TextConfig` (`'Text'`) and the three
`net.noodl.controls.*` configs are correct.

Fixing the identifier *activates* a previously-dormant config and changes
node-creation defaults, which is why it was deliberately left out of a merge
commit. Decide intentionally: fix and accept the behaviour change, or delete the
dead config.

### D3. Port tara's `ImageConfig`

`ImageConfig.ts` was dropped during the merge — it is written against tara's type
shape (`description`, `categories`, which do not exist on `cline-dev`'s
`ElementConfig`) and shares the D2 identifier bug. Recover it from the merge
parent if wanted:

```bash
git show d67ee72:packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/ImageConfig.ts
```

Depends on the D2 decision.

### D4. Convert the stranded Jest specs

Three spec files use `@jest/globals` and run nowhere — the editor suite is
Jasmine, and `npm run test:platform` covers only `@noodl/platform-node`. They are
excluded via `tests/models/index.ts`:

- `tests/models/UBASchemaParser.test.ts`
- `tests/models/ElementConfigRegistry.test.ts`
- `tests/models/ProjectCreationWizard.test.ts`

The first three use no Jest-specific APIs beyond the import and should convert
cheaply (drop the import; Jasmine provides the globals). `StyleAnalyzer.test.ts`
also uses `jest.mock` and needs real work. Note `ElementConfigRegistry.test.ts`
targets *tara's* class API, not the registry that survived the merge — it will
need rewriting or deleting, not just converting.

⚠️ Importing `@jest/globals` throws at module load and takes down the **entire**
Electron suite, not just that file. Re-enable one at a time and run `test:ci`
between each.

### Success criteria

- [ ] New project creation verified end-to-end, with `react19` confirmed
- [ ] Style-token injection verified in a running preview
- [ ] Regression tests added for both
- [ ] D2 decided and actioned; no dead config left keyed on a non-existent type
- [ ] D3 resolved (ported or consciously dropped, recorded either way)
- [ ] Stranded specs converted, rewritten, or deleted — none left running nowhere

---

## Testing Plan

- `npm run test:ci` after **every** stream — must stay 540 specs / 0 failures
  (plus whatever D1 adds). Non-zero exit on failure is already wired.
- `npm run typecheck:editor` must stay clean.
- After Stream A, verify from a genuinely clean clone, not just a clean tree.
- After Stream D1, `npm run cdp -- health` plus a screenshot of the created
  project, read back to confirm it actually rendered.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Removing tracked bundles breaks packaging or CI | Verify `build:editor` from a clean clone *before* pushing; coordinate with REV-003 so CI covers it |
| Un-ignoring artefacts loses a fallback someone relies on | They are regenerable by `build:editor`; confirm no doc or script instructs running `electron .` against the committed bundle |
| D2's fix changes node-creation defaults for existing projects | It only affects newly created nodes, but confirm against a real project before landing |
| Re-enabling a stranded spec kills the whole suite | Re-enable one at a time, `test:ci` between each |
| REV-004's Electron upgrade re-breaks the dev loop | Add `cdp health` to REV-004's acceptance — a packaged upgrade that opens a blank window must fail loudly |

## References

- Commit `1502581` — dev-loop fix and debugging tooling (the platform for this task)
- Commit `297dfe0` — the 249-file bulk commit that introduced both the stale bundles and the duplicate ElementConfigs
- Commit `b5f200c` — "Trying to fix editor launch bugs" (prior art on the same problem)
- [MERGE-NOTES-cline-dev-tara.md](../../reviews/MERGE-NOTES-cline-dev-tara.md) — full merge reasoning and dropped work
- [REV-002-NOTES.md](./REV-002-NOTES.md) — test-harness findings, quarantined spec, stranded Jest specs
- [DEBUG-INFRASTRUCTURE.md](../../reference/DEBUG-INFRASTRUCTURE.md) — dev loop, CDP tooling, test harness
- `.claude/skills/run-editor/SKILL.md` — agent workflow

## Checklist

- [ ] Read this file, the merge notes, and REV-002-NOTES fully
- [ ] Create branch `task/rev-008-dev-loop-hardening`
- [ ] Confirm the baseline: `dev:debug` + `cdp health` → `reactMounted: true`, `test:ci` green
- [ ] Stream A — untrack build artefacts, verify from a clean clone, add a guard
- [ ] Stream B — close the visibility gaps
- [ ] Stream C — document CDP-first vs the permission escape hatch
- [ ] Stream D — verify the merge, decide D2/D3, unstrand the specs
- [ ] `test:ci` green and `typecheck:editor` clean
- [ ] Update `PROGRESS.md`; open PR
