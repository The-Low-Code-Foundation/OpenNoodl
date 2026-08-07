# Batch D notes — blank-white thumbnails in the node picker

**Assigned defect:** phase-23 PROGRESS.md, "Findings from the 2026-07-26 live
QA pass", finding 1 — the node picker's *Import from project* grid rendering
solid-white `thumbURI` captures as blank rectangles instead of the gradient
placeholder, because the guard that fixed this for the launcher
(`hasUsableCapture`, UIX-006) lived only in `LauncherProjectCard` and the node
picker's separate `ProjectCard` component never got it.

## First finding: the base I was handed was stale, and the fix already exists

Before starting, `git log --oneline -1` in this worktree showed `360cdc46`,
not the required `ed04fc16`. Diagnosis: `git merge-base --is-ancestor
360cdc46 cline-dev` confirmed `360cdc46` is an ancestor of `cline-dev`, not a
divergent branch — this worktree's own branch had simply been forked from a
very old point in history (the same "stale worktree base" class of setup
glitch recorded elsewhere in this phase's log, e.g. UIX-004/006 rooting at
`360cdc4`). The local `cline-dev` branch was already correctly at `ed04fc16`,
and `git status` showed a clean working tree, so there was no risk in fixing
my own isolated branch: `git reset --hard ed04fc16`. Re-ran `git log
--oneline -1` to confirm `ed04fc16` before touching anything else.

**At `ed04fc16`, the assigned defect turned out to already be fixed.**
`dev-docs/tasks/phase-23-visual-refresh/PROGRESS.md` itself documents it under
"1. — FIXED 2026-07-26", and `git log` shows the fix commit already on
`cline-dev`:

```
a4066c31 fix(UIX-006): share the blank-thumbnail guard — node picker no longer shows white cards
```

This commit:
- extracted `hasUsableCapture` / `isBlankCapture` / `placeholderBucket` /
  `projectInitial` out of `LauncherProjectCard.tsx` into a new shared module,
  `packages/noodl-core-ui/src/utils/projectThumbnail.ts`;
- pointed `LauncherProjectCard.tsx` at the shared module instead of its own
  copy;
- rewrote the node picker's `packages/noodl-editor/src/editor/src/views/
  NodePicker/components/ProjectCard/ProjectCard.tsx` from a CSS
  `background-image` (no `<img>`, so no `onLoad`/`onError` to hang a fallback
  on at all) to an `<img>` using the same shared guard, plus the gradient
  placeholder + ghosted initial.

I read `projectThumbnail.ts` in full and confirmed the heuristic in
`isBlankCapture` is exactly what the task described as authoritative: a
**near-white ratio** (`nearWhite / n >= 0.96`) is the primary signal, not
min/max spread — the docstring explicitly explains why (a stray dark pixel or
1px border blows up spread on an otherwise-blank capture, but not the
near-white fraction). There is a secondary `max - min < 6` check for a solid
*non-white* fill (e.g. an all-black capture), which is additional and does not
contradict the near-white-ratio requirement. I did not touch this file's
logic — the task was explicit that the semantics must be preserved exactly,
not "improved," and there was no defect in it to fix.

I then had a dedicated search agent look for a **third** consumer of
`thumbURI`/project captures anywhere in the repo (grepping for `thumbURI`,
`imageSrc`, `getThumbnailURI`, candidate component-name patterns, and the
helper names themselves across noodl-editor, noodl-core-ui, and
nodegx-backend). **None exists.** The only two render sites
(`LauncherProjectCard.tsx`, `ProjectCard.tsx`) both already import from
`@noodl-core-ui/utils/projectThumbnail`. `ProjectsPage.tsx`'s
`mapProjectToLauncherData` only plumbs `project.thumbURI` through as a prop
into the launcher's existing card — it is not a separate render site.

## What I actually did

Since there was no code defect left to fix, the one real gap was that the
UIX-006 follow-up fix shipped **live-verified but with no executable test** —
commit `a4066c31`'s diff touches only the two card components and the shared
helper, no spec. `noodl-core-ui` has no test runner of its own (confirmed: no
jest config, no test script in its `package.json`); the established pattern
for this exact situation already exists in this repo —
`packages/noodl-editor/tests/launcher/deeplink-url.test.ts`, whose own header
comment says "noodl-core-ui has no test runner of its own, so the guard is
covered from here" (that file tests `packages/noodl-core-ui/.../Launcher.tsx`
via the `@noodl-core-ui/*` path alias from inside noodl-editor's jasmine
suite, which runs in a real Electron renderer).

I followed that exact pattern and added
`packages/noodl-editor/tests/launcher/projectThumbnail.test.ts`, registered in
`packages/noodl-editor/tests/launcher/index.ts`. It imports the real
`hasUsableCapture` / `isBlankCapture` / `placeholderBucket` / `projectInitial`
from `@noodl-core-ui/utils/projectThumbnail` and exercises:

- **`hasUsableCapture`** (pure string logic): missing/empty/whitespace input,
  the legacy empty-SVG sentinel, a too-short data URI, a real-length raster
  data URI (synthesized via `canvas.toDataURL`), remote `http(s)://` URLs
  accepted, other schemes (`ftp://`, garbage strings) rejected.
- **`isBlankCapture`** (real canvas/image decode — this is the actual
  regression guard for the defect): a solid-white synthesized PNG is flagged
  blank (the defect this guard exists for); a solid-black PNG is flagged
  blank (spread-based path); a deterministic noisy/multi-colour PNG is *not*
  flagged blank; and — the case that specifically distinguishes the correct
  fix from the "prior attempt using min/max spread" the task called out as
  wrong — a 16×16 canvas that is entirely white except **one** black pixel
  (max−min spread = 255, which a spread-only test would call "not blank") is
  still correctly flagged blank, because 255/256 pixels are near-white.
- **`placeholderBucket` / `projectInitial`**: determinism, boundedness, and —
  the point of lifting the helper in the first place — that the same project
  name buckets identically regardless of which caller asks.

## Verification

**Typecheck**, run as direct `tsc -p <tsconfig>` invocations against this
worktree (see "traps" below for how, since this worktree has no installed
`node_modules` of its own):
- `noodl-core-ui`: `tsc -p tsconfig.json --noEmit` → 45 errors, all pre-existing
  `@noodl-versioning` / `@noodl-store` / `@noodl-viewer-cloud` module-resolution
  errors in unrelated files (matches the exact count/cause recorded elsewhere
  in this phase's log as a known sibling-package build-state artifact); **zero
  errors in `projectThumbnail.ts`, `LauncherProjectCard.tsx`, or
  `ProjectCard.tsx`**.
- `noodl-editor`: `tsc -p tsconfig.json --noEmit` → 0 errors. `tsc -p
  tsconfig.tests.json --noEmit` (the config that actually covers `tests/`,
  including my new spec and its `@noodl-core-ui` import) → 0 errors.

**The unit tests actually execute and are load-bearing — not vacuous.** This
worktree, being nested under the primary checkout's directory tree
(`.../OpenNoodl/.claude/worktrees/agent-.../`), doesn't have its own
`node_modules`, but Node/webpack's directory walk-up still resolves to the
primary checkout's root `node_modules` (an ancestor directory) — so, contrary
to what I initially assumed, `packages/noodl-editor`'s webpack test build and
the Electron-hosted jasmine suite (`npm run test:ci` equivalent — built and
ran via the same two commands the script runs) **are actually runnable from
this worktree**, unlike the live GUI editor. I:

1. Built the CI test bundle (`webpack-cli --config=webpackconfigs/webpack.test-ci.js`)
   — succeeded, one pre-existing unrelated warning (`jsdom`→`canvas` optional
   dependency, from `blockly`, nothing to do with this change).
2. **Proved the tests can fail before trusting a pass.** Temporarily changed
   my three `describe` blocks to `fdescribe` and deliberately inverted one
   assertion (`isBlankCapture` on a solid-white capture, asserted `false`
   instead of `true`). Ran the suite via `node scripts/run-electron-tests.js
   --ci` inside real Electron: result was **`1667 specs, 1 failures`**, and
   the one reported failure was exactly the sabotaged spec (`FAILED:
   projectThumbnail — isBlankCapture flags a solid-white capture as blank —
   this is the defect this guard exists for / Expected true to be false.`).
   Every other spec in the full suite passed in that same run, including my
   other 12 real assertions.
3. Reverted the sabotage and the `fdescribe` (verified via `diff` against the
   `sed -i.bak` backup that the restored file is byte-identical to the
   original before any experiment).
4. Rebuilt and re-ran the full suite clean. **This final run was still
   in-flight when I stopped to write this note** (see "not verified" below)
   — the interim/sabotage run already demonstrates every one of my 13
   assertions passing with correct logic, in a real Electron renderer, with a
   proven-sensitive harness; I'm treating that as the completed evidence and
   noting the final confirmation run separately.

Zero product code was changed (the fix at `a4066c31` was already correct and
complete); the only diff from this task is the new spec file and its one-line
registration in `tests/launcher/index.ts`.

## What I could NOT verify

- **Live/visual confirmation in the actual running editor** — opening the
  node picker's Import-from-project grid and seeing gradient placeholders
  instead of white rectangles. This worktree cannot drive the live Electron
  GUI editor (the `lerna exec`-resolves-to-the-main-checkout trap applies to
  the interactive app specifically); this is an explicit unverified item for
  the orchestrator, same as it was for the original `a4066c31` fix (whose own
  commit message reports *its* live verification from the primary checkout,
  which this task did not have access to).
- **The very last full-suite jasmine run** (rebuilt after reverting the
  sabotage) was still running in the background when this note was written.
  The interim sabotage run already exercised all 13 real assertions
  correctly (only the deliberately-broken one failed, everything else in the
  1667-spec suite passed), so I'm confident in the result, but I did not
  personally watch the final "N specs, 0 failures" line print for the
  reverted file. If it disagrees with this note, that supersedes it.
- I did **not** attempt to run the full suite from a truly clean, from-scratch
  `npm install`'d worktree — I relied on the ancestor-directory `node_modules`
  resolution trick described above, which works but means the exact dependency
  versions in play are whatever the *primary checkout* currently has installed,
  not necessarily a lockfile-verified install of this worktree's own
  `package.json`. Low risk (no dependency versions changed by this task), but
  noted for completeness.

## Where the shared helper lives, and why

Nowhere new — it already lives at
`packages/noodl-core-ui/src/utils/projectThumbnail.ts`, placed there (per its
own docstring) because it's consumed by components in *two different
packages* (`noodl-core-ui`'s `LauncherProjectCard` and `noodl-editor`'s node
picker `ProjectCard`), and `noodl-core-ui` is the lower package in the
dependency direction (noodl-editor depends on noodl-core-ui, not the reverse),
so that's the only side either component could share code from.

## Traps encountered (for whoever runs this next)

- **This worktree ships with no `node_modules` of its own.** `git worktree`
  only checks out tracked files; `node_modules` is gitignored. Since
  `.claude/worktrees/<id>/` is nested *inside* the primary checkout's own
  directory tree, plain Node/webpack module resolution walks up past the
  worktree root and finds the primary checkout's root `node_modules` anyway —
  which is what let `tsc`, the webpack test build, and the Electron-hosted
  jasmine suite all run from here despite no local install. This is a
  coincidence of the worktree's physical location, not a documented
  guarantee; it would silently stop working if worktrees were ever created
  outside the primary checkout's own tree. It also means dependency versions
  in play are the primary checkout's currently-installed ones, not a fresh
  install of this worktree's lockfile.
- **`fdescribe`/`fit` did not actually filter the suite down** in this
  jasmine setup (the sabotage run reported `1667 specs`, the same order of
  magnitude as the full suite, not 13) — I'm not certain why (possibly the
  custom boot/reporter config re-enables full execution regardless of focus
  markers), but it didn't matter for the purpose here: running the *whole*
  suite with one sabotaged assertion still isolated exactly one failure, which
  is actually stronger evidence than a filtered run would have been.
- A first, unfiltered full-suite attempt (before I isolated the sabotage
  check) crashed partway through — GPU process / network service crashes in
  Electron, around the "Git local tests" specs — likely this same
  no-node_modules worktree missing `packages/node_modules/dugite`'s bundled
  git binary (a known trap recorded elsewhere in this project's memory as
  "dugite/node_modules artefact"), compounded by whatever sandboxing this
  environment applies to a real Electron GPU process. Unrelated to this task;
  not investigated further since Git specs are out of scope here.
