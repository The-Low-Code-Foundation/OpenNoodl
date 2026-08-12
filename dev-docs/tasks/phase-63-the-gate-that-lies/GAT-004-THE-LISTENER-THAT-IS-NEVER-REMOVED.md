# GAT-004 — The listener that is never removed

**Status:** 📋 open · ⭐ **the real fix** · **Tier 2** · half a day · depends on GAT-001 for a
trustworthy before/after

## The two facts

**One.** `Model.on` appends and nothing removes:

```js
Model.prototype.on = function (event, listener, group) {
  this.listeners.push({ event, listener, group });
  ...
};

Model.prototype.off = function (group) {
  for (var i = 0; i < this.listeners.length; i++) {
    if (this.listeners[i].group === group) { ... }
  }
};
```

[`model.js:10-21`, `:83-92`](../../../packages/noodl-editor/src/shared/model.js). `off` matches on
`group` — so a listener registered **without** one can never be removed by it, and
`removeAllListeners()` (`:95`) exists but has to be called by somebody.

Across ~2,700 specs sharing singletons (`WarningsModel.instance`, `NodeLibrary.instance`, project
models), the arrays pass 10,000 and keep going.

**Two.** Dispatch is linear over everything ever registered:

```js
Model.prototype.notifyListeners = function (event, args) {
  for (let index = 0; index < this.listeners.length; index++) {
    const listener = this.listeners[index];
    if (shouldNotify(listener, event)) listener.listener(args);
  }
  ...
};
```

and `shouldNotify` does `Array.indexOf` or **string** `indexOf` per entry. Benchmarked with the class
copied verbatim, listeners registered for events *other* than the one dispatched:

```
    10 listeners -> 0.0013 ms/notify  (1x)
  1000 listeners -> 0.0106 ms/notify  (8x)
 10000 listeners -> 0.0996 ms/notify  (79x)
 20000 listeners -> 0.1873 ms/notify  (149x)
```

## 🔴 ⚠️ The mechanism is plausible and **unproven**, and this task's first job is to prove it

The story — *specs leak listeners, dispatch degrades, the suite gets slower as it runs, later specs
crawl, the run dies in its last quarter* — fits every observation:

- all four runs died or slowed in the last quarter, none in the first half;
- the passing run had the **most** warnings (12,368), i.e. the most registrations.

**It fits. That is not the same as being true.** 0.1 ms per notify is only material if the suite
performs tens of thousands of notifications, and nobody has counted them. A suite that notifies 2,000
times loses 0.2 seconds and this entire diagnosis is wrong.

**Measure before fixing:**

1. Count `notifyListeners` calls across a full run (a counter and one line at the end).
2. Record the listener-array length at the start and end of the run, per singleton.
3. Multiply. If the product is not minutes, **say so and stop** — the slowdown is somewhere else and
   this task becomes a tidy-up rather than a fix.

⚠️ This repo has a filed instance of a plausible mechanism being wrong about its own subsystem, and
one of a log pattern being called a defect signature without anyone grepping a passing log. Both apply
here.

## §1 — Give the specs a teardown

The smallest correct fix, if §0's measurement holds:

- a global `afterEach` that calls `removeAllListeners()` on the singletons a spec can reach;
- ⚠️ **or** per-spec `off(group)` with an actual group — better hygiene, far more edits, and every
  missed site is a silent partial leak.

The global teardown is the recommendation: one place, no per-spec discipline to maintain, and a leak
that comes back is a leak in *one* function rather than in whichever spec forgot.

⚠️ **A global `removeAllListeners` can break specs that rely on a subscription surviving between
`it()` blocks.** That is a real pattern and some will be relying on it accidentally. Expect fallout,
and read each failure rather than special-casing it away — a spec that needed a listener from a
previous spec is a spec with a hidden dependency, which is worth knowing about.

## §2 — Consider making the leak impossible rather than tidy

Out of scope to redesign `Model`, but in scope to ask: should `on()` without a group be an error in
the test environment? A leak that cannot be introduced beats one that is swept up afterwards.

⚠️ **Only in tests.** Product code registers group-less listeners legitimately and this phase does not
change the product's event system.

## §3 — Do not "optimise" `shouldNotify`

The tempting micro-fix is to index listeners by event name and make dispatch O(1). Resist it in this
task:

- it changes semantics — `shouldNotify` supports array events and a dot-notation prefix match, and an
  index has to reproduce both exactly;
- it is product code on a hot path used everywhere;
- **if the leak is fixed, the arrays are small and O(n) over a small n is free.**

Optimising dispatch to survive a leak is fixing the symptom of the symptom. If §0's measurement says
dispatch is hot even *without* a leak, that is a different task with its own file.

## Acceptance

- §0's measurement is recorded: notification count, listener growth, and the product — **before any
  fix**.
- After the teardown, the listener arrays do not grow across the run (measured, not assumed).
- The 10,000 warning does not fire at all in a normal run.
- `test:ci` wall clock before and after, same pinned seed, quiet machine, recorded.
- ⚠️ **Same 2,702 specs, same six failures by name.** A teardown that "fixes" the speed by not running
  specs is the failure mode; compare the total, not just the failure count.
- Any spec that broke because it depended on a surviving listener is listed, with what it was
  depending on.

## Register

| # | Finding | State |
|---|---|---|
| G17 | `on()` appends unboundedly; `off(group)` cannot remove a group-less listener | ✅ read in source |
| G18 | `removeAllListeners()` exists and is unused by the spec suite | ✅ read in source; no `afterEach` or teardown found in `tests/` |
| G19 | `notifyListeners` is O(n) over all listeners, with a string `indexOf` per entry | ✅ read in source + benchmarked, 79× at 10k vs 10 |
| G20 | **That this is what makes the suite slow** | 🔴 ⚠️ **UNVERIFIED — the whole of §0.** Plausible, fits every observation, and not measured. Do not fix before proving |
| G21 | Which singletons accumulate, and how fast | ⚠️ unverified — part of §0's measurement |
| G22 | Whether any spec depends on a listener surviving between `it()` blocks | ⚠️ unverified; §1 expects fallout |
