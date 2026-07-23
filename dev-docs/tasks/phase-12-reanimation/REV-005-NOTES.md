# REV-005 Notes — Dependency Hygiene

Working notes for REV-005. See the task doc for scope; this file carries the
baseline snapshot and the decisions made along the way.

## Baseline (measured 2026-07-23, before any change)

`npm audit`:

```
{ info: 0, low: 13, moderate: 27, high: 42, critical: 7, total: 89 }
```

`npm audit --omit=dev`:

```
{ info: 0, low: 9, moderate: 9, high: 13, critical: 4, total: 35 }
```

(The task doc's 2026-07-22 measurement said 96/36 — a one-day drift, most
likely new advisories published or transitive resolution changes between
runs. Not a regression introduced by anything in this repo; treated as the
live baseline.)

Critical/high in `--omit=dev` at baseline: `@xmldom/xmldom`, `aws-sdk`,
`brace-expansion`, `dugite`, `fast-uri`, `js-yaml`, `lodash`, `mime`,
`minimatch`, `minimist`, `mkdirp`, `path-to-regexp`, `s3`, `tar`,
`underscore`, `websocket-stream`, `ws`.

`npm outdated`: 88 rows (root `--json` count). Large majority minor/patch;
majors flagged separately below.

Version incoherence confirmed present:
- TypeScript: root + `noodl-editor` on `^5.9.3`; `noodl-viewer-react`,
  `noodl-core-ui`, `noodl-viewer-cloud` on `^4.9.5`.
- webpack-cli: `^4.10.0` in `noodl-editor` and `noodl-viewer-react`;
  `^5.1.4` at root and in `noodl-viewer-cloud`.

`engines` in root `package.json` was **already** updated to
`node >=22.0.0` / `npm >=10.0.0` by REV-003 (commit `f02d1e9`) — the task
doc's "still says >=16 / >=6" framing is stale. No change needed here;
verified only.

Found but out of scope: three pre-REV-003 workflow files still hardcode
`node-version: 16` (`.github/workflows/build-noodl-editor.yml`,
`publish-cloud-runtime.yml`, `test-noodl-editor.yml`). All are
`workflow_dispatch`-only or superseded duplicates of jobs `pr.yml` already
runs (job names overlap: "Test noodl-editor" vs. `pr.yml`'s
"Test (editor)"). Not touched here — this is a CI-workflow cleanup, not a
dependency-hygiene change, and the task's mandate is package manifests. Left
as a note for whoever next touches `.github/workflows/`.

## Step 2 — safe `npm audit fix` pass

`npm audit fix` (no `--force`) touched only `package-lock.json` (641
insertions / 648 deletions, no `package.json` changed anywhere in the repo).

Result: 89 → 49 total vulnerabilities. Remaining findings all require
`--force` (semver-major bump) or have no fix at all — see the case-by-case
review below.

Verification after the fix, before committing:
- `npm run typecheck` (root): clean.
- `npm run typecheck:editor`: clean.
- `npm run typecheck:core-ui` / `npm run typecheck:viewer`: same pre-existing
  errors as before the fix (confirmed via `git stash` A/B) — jasmine/jest
  ambient-type collisions and stale `@noodl-store`/`@noodl-viewer-cloud`
  path aliases in `noodl-editor` source that these configs happen to pull
  in. Pre-existing, not introduced by this task; not touched here since
  fixing them is TS-unification/typing work, tracked separately below.
- `npm run test:platform`: 8 passed, 1 suite skipped (pre-existing skip).
- `npm run test:ci` (Electron/Jasmine suite): **712 specs, 0 failures**.
- `npm run build:editor`: refused to run against a dirty tree (the build
  script's own git-status gate) — this is exactly why step 2 says to commit
  the fix as its own changeset before continuing. Committed
  (`dfde45c`), then re-ran clean: full viewer + editor build, signed
  (ad-hoc) `.dmg`/`.zip` produced.

## Step 3/4 — TypeScript unification + webpack-cli dedupe

Did these together per package, since `noodl-viewer-react` sits at the
intersection of both split-majors.

- `noodl-viewer-cloud`: `typescript` 4.9.5 → 5.9.3. Verified: package builds
  clean (`npm run build:cloud-runtime`, webpack 0 errors).
- `noodl-core-ui`: `typescript` 4.9.5 → 5.9.3, `@types/node` 16.11.42 →
  18.19.123 (matching root). `typecheck:core-ui` produces the exact same 21
  pre-existing `@noodl-store`/`@noodl-viewer-cloud` path-alias errors as
  before the bump (confirmed via `git stash` A/B) — this tsconfig
  incidentally type-checks files under `noodl-editor/src` through its path
  mapping and always had these; not introduced here, not fixed here (path
  aliasing is an editor-config issue, not a TS-version issue).
  `storybook build` fails identically before and after
  (`SB_CORE-SERVER_0007`, `.storybook/main.ts` uses `import.meta.url` under
  a CJS-loaded `.ts` file — an esbuild-register/Node ESM interop bug,
  unrelated to the TS bump and out of scope; Storybook 8→10 migration is
  explicitly out of scope for this task).
- `noodl-viewer-react`: `typescript` 4.9.5 → 5.9.3, `webpack-cli` 4.10.0 →
  5.1.4. `typecheck:viewer` (root script) shows the same 40 pre-existing
  errors as baseline (jasmine/jest ambient-type collisions + `@types/mdx`
  JSX namespace issues — a mis-scoped root tsc invocation, not a real
  per-package regression). The package's own build
  (`webpack --config webpack-configs/webpack.prod.js`) is clean — 0 errors,
  only the pre-existing bundle-size warnings. `npx jest` in this package has
  one pre-existing failure, `tests/collection.test.js`, requiring a module
  (`src/nodes/std-library/data/collection`) that doesn't exist under that
  name anymore (renamed to `collectionnode2.js` at some point); confirmed
  via `git stash` A/B this fails identically on the unmodified tree. Stale
  test, not caused by or fixed in this task.
- `noodl-editor`: `webpack-cli` 4.10.0 → 5.1.4 (this is the package whose
  `test:ci` script shells out to `webpack-cli` directly, and whose
  packaging pipeline is highest-risk, so it got the most scrutiny).
  Verified: `typecheck:editor` clean, `npm run test:ci` **712 specs, 0
  failures** (same as pre-bump baseline), full `npm run build:editor`
  (viewer + editor bundles, signed ad-hoc `.dmg`/`.zip`) completes with 0
  errors.

Root and `noodl-viewer-cloud` were already on `webpack-cli@5.1.4` before
this task; all four packages now match. `typescript` is `^5.9.3`
everywhere. No `package.json` scripts or webpack configs needed changing —
the CLI-flag surface used here (`--config=`) is unchanged between
webpack-cli 4 and 5.

Found but out of scope: `.github/workflows/build-noodl-editor.yml`,
`publish-cloud-runtime.yml`, and `test-noodl-editor.yml` are pre-REV-003
leftovers that still hardcode `node-version: 16`. They're
`workflow_dispatch`-only or duplicate jobs `pr.yml` already runs under
different names. Not touched — this is CI-workflow cleanup, not dependency
hygiene; flagging for whoever next touches `.github/workflows/`.
