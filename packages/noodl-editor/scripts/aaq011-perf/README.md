# AAQ-011 F6 — what a streamed submission costs

The register's row (`dev-docs/tasks/phase-40-ai-authoring-quality/AAQ-011-FOUND-ALONG-THE-WAY.md`)
said authoring a 55-node component cost **6m51s of editor main-thread time against a zero-latency
provider**, per partial payload published, superlinear in node count — and named
`AuthoringSession.publish` → the Build panel's re-render as the suspect. AAQ-007 was gated on fixing
it before building an iteration loop on top.

Two drivers, because the claim has two halves and they live in different processes.

## `harness.ts` — the model layer, headless

```bash
node packages/noodl-editor/scripts/aaq011-perf/build.mjs
node packages/noodl-editor/scripts/aaq011-perf/dist/aaq011-harness.cjs \
  --nodes=9,56,200,400 --chunks=1,8,2000,4000
```

A real `AuthoringSession` (real context builder, real scanner, real validation gate) driven by a
scripted provider that streams a synthetic component of N nodes as C partial payloads, with the
clock taken **around each callback the provider makes** so the cost lands on the stage that spent
it. The listener chain is the editor's minus React — `AuthoringSession` → `PlanRun` → a subscriber
that re-snapshots the session on every publish, which is what `PlanSessionStore.followRun` does.

`--chunks` matters more than it looks. Eight is what `aaq40-live/wizard-replay.js` streams; a live
provider streams one fragment per token, which for a 56-node payload is a few thousand. Both are
worth sweeping, and they cost the same, because the publish is gated on an element *closing*.

## `timer-clamp.js` — what `setTimeout` costs in a window that is not on screen

```bash
node_modules/.bin/electron packages/noodl-editor/scripts/aaq011-perf/timer-clamp.js --quick
```

The measurement F6's closure rests on. A bare `BrowserWindow` with **the editor's own
webPreferences** — `backgroundThrottling` left at Electron's default, as `src/main/main.js:311`
leaves it — sampled on screen, hidden for 2s, and hidden for 5m30s (Chromium's "intensive" tier). A
`MessagePort` round trip is measured beside each: a macrotask like a timer, so a panel still renders
between fragments, and not a timer, so none of the throttling reaches it.

It will not start while several other Electron instances from this bundle are running — the child
fails its Mach port rendezvous. Run it when the editor suite is not.

## `renderer-probe.js` — the same thing inside the running editor

```bash
npm run dev:debug -- --quiet
node packages/noodl-editor/scripts/aaq011-perf/renderer-probe.js
node packages/noodl-editor/scripts/aaq011-perf/renderer-probe.js --timers-only
```

Two measurements a plain-Node run cannot make:

- **timers** — what `await new Promise(r => setTimeout(r, 10))` actually costs in this renderer.
  That is what the *fixture provider* does between partial payloads, and the editor's main window
  takes Electron's default `backgroundThrottling: true` (`src/main/main.js:311` overrides nothing),
  so Chromium clamps it to ~1s while the window is occluded, and stretches individual waits further
  once it has been hidden for five minutes. Run it once with the editor in front and once with it
  fully covered — the two numbers are the finding.
- **session** — the real `AuthoringSession` over the real 56-node `aaq40-live/fixtures.js` payload,
  streamed with **no sleeps at all**, timed around each `onToolCallPartial`.

## What was measured, 2026-08-06

Headless, on this machine, best of two, per cell (`total` is the whole `PlanRun`, including the
validation gate; `partials` is every `onToolCallPartial` including the scan, the state rebuild and
every listener):

| nodes | chunks | total | partials | publishes |
|---|---|---|---|---|
| 9 | 8 | 44.0ms | 0.5ms | 23 |
| 56 | 8 | 31.7ms | 0.2ms | 23 |
| 56 | 2000 | 24.7ms | 1.7ms | 82 |
| 200 | 8 | 28.7ms | 0.4ms | 23 |
| 400 | 4000 | 43.3ms | 5.7ms | 498 |

**The partial path does not grow with node count in any way that matters, and it does not grow with
fragment count at all** — 4000 fragments produce 498 publishes, because `PartialPayloadScanner`
reports `changed` only when an element closed (`partial.ts:143`) and `AuthoringSession` publishes
only then (`AuthoringSession.ts:675`). For an 80-node payload, 100 fragments and 4000 fragments
produce the same 85 publishes.

⚠️ Take these on an idle machine. The 56×8 cell measured **31.7ms** with nothing else running and
**2416.8ms** under nine concurrent editor-suite runs. That is also why the specs in
`tests/ai/aaq011-publish-cost.test.ts` assert publish *counts* rather than a stopwatch.

And `timer-clamp.js`, which is where the 6m51s went — eight `setTimeout(10)` and eight `MessagePort`
round trips, same window, three visibility states:

| state | 8 × `setTimeout(10)` | 8 × `MessagePort` |
|---|---|---|
| on screen | 88ms | 1.4ms |
| hidden 2s | 7882ms | 0.6ms |
| hidden 5m30s | 16992ms (one wait was 9982ms) | 0.8ms |

`wizard-replay.js` awaited fourteen `setTimeout`s per component — six for the prose, one per partial
payload — in a window that is occluded every time a script drives the editor from a terminal. That is
the 6m51s. The pacing is a `MessagePort` task now.
