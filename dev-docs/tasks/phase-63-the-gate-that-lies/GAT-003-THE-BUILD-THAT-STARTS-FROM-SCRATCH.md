# GAT-003 — The build that starts from scratch, every time

**Status:** ✅ **SHIPPED 2026-08-27** · **Tier 1: speed**

**What shipped:** `cache: { type: 'filesystem' }` in `webpack.test.js` (name `test`) and
`webpack.test-ci.js` (name `test-ci` — the configs differ, so they must not share entries), with
`buildDependencies.config` on both files. **Numbers:** 43.1s cold → **1.5–1.8s warm** (2,437 modules
cached); cache size **405 MB**, gitignored.

**§2 decided, not defaulted:** the cache lives in `packages/noodl-editor/.webpack-cache`, NOT
webpack's default `node_modules/.cache` — `make-worktree.sh` symlinks a worktree's package
`node_modules` to the primary's, so the default would share one cache between worktrees building
*different trees*. The package-local directory is a real directory in every worktree: isolated per
tree, worktrees start cold, correctness over speed.

**§3 proven, both directions, not argued:** a spec deliberately broken on a warm cache (2,424 modules
served cached) **failed by name** in the run's results; editing `webpack.test-ci.js` produced a full
cold rebuild (41.9s, zero cached modules), and the next build was warm again (1.8s). G16's second
invocation (~0.7s) was left uncached as recommended.

## The observation

From the 23:40 run's own output:

```
webpack 5.108.4 compiled successfully in 92870 ms
webpack 5.108.4 compiled successfully in 1721 ms
```

**93 seconds**, before a single spec runs, on every invocation — including a re-run of an unchanged
tree, which is exactly what a session does when the first run dies.

Three of tonight's four runs were re-runs of a tree that had not changed. That is ~4.5 minutes spent
rebuilding an identical bundle.

## What is on disk

[`webpack.test.js`](../../../packages/noodl-editor/webpackconfigs/webpack.test.js) sets:

```js
mode: 'development',
devtool: 'eval-cheap-module-source-map',
```

Both sensible for a test build. What it does **not** set is `cache`. Webpack 5 defaults to
`cache: { type: 'memory' }`, which is worth nothing across process invocations — every
`npm run test:ci` starts a fresh process and therefore a cold build.

[`webpack.test-ci.js`](../../../packages/noodl-editor/webpackconfigs/webpack.test-ci.js) merges that
config and adjusts `output.publicPath`; it adds no cache either.

## §1 — Turn on the filesystem cache

```js
cache: {
  type: 'filesystem',
  buildDependencies: { config: [__filename] }
}
```

`buildDependencies` is not optional: without it a change to the webpack config itself does not
invalidate the cache, and the next run builds the old configuration while reporting success. That is a
*worse* failure than a slow build, and it is the standard way this setting goes wrong.

## §2 — ⚠️ Decide where the cache lives, deliberately

Default is `node_modules/.cache/webpack`. Two things follow and both need a decision rather than a
default:

- **A shared checkout.** This repo is worked by concurrent sessions and by worktrees cut from
  `origin/main`. A cache keyed only by path is fine; a cache shared *between* worktrees building
  different trees is a correctness hazard. Confirm which one `node_modules/.cache` gives us under
  `scripts/devtools/make-worktree.sh`, which symlinks some build artefacts and not others.
- **Disk.** A webpack filesystem cache for a bundle this size is not small. Check it, and check it is
  gitignored.

## §3 — ⚠️ The cache must be provably invalidated, or this task ships a lie

The failure mode is silent and severe: a cached build that does not pick up a source change means
**the gate grades code that is not in the tree**. That is a worse version of the problem this whole
phase is about.

Prove it, do not reason about it:

1. Run, note the time.
2. Run again unchanged — must be much faster.
3. **Change a spec so it fails**, run again, and confirm the run **fails**. If it passes, the cache is
   serving stale modules and the setting must come back out.
4. Change the webpack config, run, confirm the rebuild is cold.

Step 3 is the one that matters and the one that is easy to skip.

## Acceptance

- A second run on an unchanged tree is **substantially** faster than the first, with both numbers
  recorded.
- A deliberately-broken spec still fails on a cached run (§3 step 3), demonstrated, not argued.
- Editing the webpack config produces a cold rebuild.
- The cache directory is gitignored and its size is recorded.
- ⚠️ Worktree behaviour is stated: whether two worktrees share a cache, and whether that is safe.

## Register

| # | Finding | State |
|---|---|---|
| G12 | The test bundle takes 92,870 ms to build | ✅ measured 2026-08-12, from the run's own webpack output |
| G13 | No `cache` entry in either test webpack config; webpack 5 defaults to memory cache, useless across invocations | ✅ read in source |
| G14 | Three of four runs tonight rebuilt an unchanged tree | ✅ observed — the tree was settled and committed before the last two |
| G15 | Whether `node_modules/.cache` is shared or isolated between worktrees cut by `make-worktree.sh` | ⚠️ **unverified — §2 exists for this** |
| G16 | Whether the second webpack invocation (1,721 ms) is a separate config worth caching too | ⚠️ unverified; it is 2% of the cost, so probably not worth the risk |
