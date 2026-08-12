# GAT-006 — Shard the Electron suite

**Status:** 📋 open · **Tier 3: structure** · ⚠️ **may not be worth building — see §0** · depends on
GAT-004

## §0 — ⚠️ Read this before starting: this task may already be unnecessary

2,700 specs run **serially in one Electron renderer** while the machine's other cores idle. Sharding
across N processes is the obvious answer and the reason it is specced last:

**If GAT-004 lands and the suite comes back to a few minutes, the value of sharding collapses**, and
what remains is real, permanent complexity — N Electron processes, N result streams to merge, a seed
that has to mean something across shards, and a failure mode where shard 3 dies and the other four
report success.

**Do not start this task without first re-measuring `test:ci` after GAT-004.** If it is under five
minutes, close this file as "not worth it" and say so. That is a successful outcome for this task, not
a failure to complete it.

## The observation

The suite is a single `BrowserWindow` loading `SpecRunner.html`
([`test.js:134-150`](../../../packages/noodl-editor/test.js)) with `backgroundThrottling: false`, and
Jasmine runs its specs in order in that one renderer. Wall clock is therefore the sum of every spec,
plus a 93-second build (GAT-003), on a machine with many cores.

## §1 — What sharding would have to preserve

Three properties the current design gives for free, all of which sharding breaks unless handled:

- **The seed.** `NOODL_SPEC_SEED` reproduces an order-dependent failure by fixing Jasmine's random
  order. Order across *shards* is a different thing from order *within* one, and a seed that no longer
  reproduces a failure is worse than no seed — this repo has used seed-pinning to exonerate a change,
  and that technique has to survive.
- **The totals.** The standing rule is *compare the total, not the failure count*, because a vanished
  suite reads as a pass. With shards, a total is a sum, and a shard that never started contributes
  zero silently. **Every shard must be accounted for**, not just aggregated.
- **The single readout.** `tests/test-results.json` (GAT-001) becomes N files that must merge into one
  answer, including the case where they disagree about how many specs exist.

## §2 — ⚠️ Order dependence is the reason this is hard, not the process management

The suite has **known order-dependent specs** — the BEN-001 cluster has come and gone across seeds for
months, and a documented range of 6 → 12 failures is reachable without any code change.

Sharding changes which specs share a process and in what order. That will move those failures, and
the first sharded run will look like a regression whether or not it is one.

⚠️ **Budget for this explicitly.** The first sharded run's failures must be triaged against a
same-seed unsharded run, not against the remembered baseline of six. Skipping that is how this task
ships a "regression" that is an artefact of its own change.

## §3 — The cheaper alternative worth pricing first

Before N processes: does the suite parallelise *within* one renderer at all? Almost certainly not —
Jasmine is serial by design and the specs share singletons (GAT-004), which is exactly why they leak
into each other.

So the honest options are ordered:

1. Make the suite fast (GAT-004). **Try this first, it may be the whole answer.**
2. Don't run it when it cannot matter (GAT-005).
3. Shard it (this task).

## Acceptance

*If it is built at all:*

- Wall clock before and after, same seed, quiet machine, recorded.
- Every shard is accounted for — a shard that fails to start makes the run fail, and cannot silently
  reduce the total.
- The merged readout gives one total, one failure list, and the seed(s).
- The first sharded run's failures are triaged against a same-seed unsharded run and the comparison is
  written down.
- ⚠️ `NOODL_SPEC_SEED` still reproduces an order-dependent failure, demonstrated on a known one.

*If it is not built:*

- The post-GAT-004 `test:ci` time is recorded here, with the decision and the reasoning.

## Register

| # | Finding | State |
|---|---|---|
| G28 | The suite runs serially in one renderer | ✅ read in source, `test.js:134-150` |
| G29 | The suite has known order-dependent specs, with a documented 6 → 12 range at different seeds | ✅ standing repo knowledge, multiple sessions |
| G30 | Whether sharding is needed **at all** after GAT-004 | ⚠️ **unverified and decisive — §0.** Measure before building |
| G31 | Per-spec time distribution — whether a few slow specs dominate, in which case sharding helps less than it looks | ⚠️ unverified; worth an hour before committing to this |
