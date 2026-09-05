## §66.5 #1 — Enabled wired from a Variable nothing has written: MEASURED in the runtime (ON), the export brought to the runtime's rule; the rule generalised to every stream lib (session 94, lane enabled, 2026-09-05)

### §66.5#1.0 The measurement — the runtime, headlessly, before a line of export code

The register's question: `Enabled` wired from a `Variable` nothing has written — does the runtime deliver `undefined` into the setter
at boot (`!!undefined` ⇒ OFF, what the export did) or never run it (⇒ ON, the `!== false` reading of an untouched node)?

**The rule is the scheduler's, not the node's** (`packages/noodl-runtime/src`): `node.ts:806` `sendValue`: `if (value === undefined)
return;` — an undefined never crosses a wire; `node.ts:818-821` `flagOutputDirty` goes through it; `node.ts:544-556` `connectInput`
delivers at connect time only `if (outputValue !== undefined)`. The Variable's `name` setter (`variablenode2.ts:174-180` →
`setVariableName` :252-257) flags `value` dirty at the first update, and the getter (:156-161) answers `variablesModel.get(name)` —
`undefined` for a name nothing wrote — so the flag sends nothing; at connect time the name is still QUEUED (`nodescope.ts:157-214`,
the connections at :424-437) so the getter answers `undefined` regardless. The `enabled` setter is never entered;
`subscribetochanges.ts:323-330` `isEnabled` reads `!== false` ⇒ ON, and `reconfigure` (:402-406) subscribes. **Corollary**: a
Variable written back to `undefined` later also delivers nothing — the last delivered value stands.

**The instrument** — `packages/noodl-runtime/test/corpus/exp-011-s66-5-an-unwritten-variable-never-reaches-a-setter.test.ts` (9 rows,
`createCorpusGraph`: a real GraphModel + NodeScope, `updateDirtyNodes` as the frame; a spy on the definition's setter AND an observable
beside it — headlessly `NoodlRuntime.instance` is undefined, so an enabled node's boot reconfigure reports the CAPABILITY_UNAVAILABLE
fatal: `realtimeFailure` pulsed, `subscribe-to-changes/realtime-failed` raised — which happens ONLY past `if (!this.isEnabled()) return;`).
Readout (`$SCRATCH/runtime.log`): **R1** unwritten ⇒ setter calls `[]`; pre-written `'seeded'` ⇒ `['seeded']` · **R1b** written
`false` after boot ⇒ `[false]`; then `undefined` ⇒ unchanged · **S1** unwritten → Enabled: `setEnabled` 0 calls, `_internal.enabled`
undefined, `isEnabled()` true, raises 1, signals `['realtimeFailure']` — **ON** · **S2** pre-written false ⇒ `[false]`, raises 0 ·
**S3** pre-written true ⇒ `[true]`, raises 1 · **S4** authored false/true ⇒ 0/1 raises · **S5** boot raises 1; false ⇒ `[false]`,
teardown; then `undefined` ⇒ no call, `enabled` stays false, raises still 1 · **G1** SSE `autoReconnect` unwritten ⇒ 0 calls, internal
stays `true` (the runtime default) · **G2** WebSocket `autoConnect` unwritten ⇒ 0 calls, internal `true`. 9/9, exit 0.
**It generalises**: the rule is on every wire, so every config option of every translated stream node inherits it.

### §66.5#1.1 What the export did, and what it does now

Reverted arm (`probe-reverted.log`, the fixture wired by IR mutation): 0 refusals, the page prints `const enabledValue =
useValue(enabled);` and `{ collection: 'Contact', enabled: enabledValue }`, the store `value<string | undefined>(undefined)` — and
`realtime.ts`'s `has(options, key)` = `hasOwnProperty` ⇒ `!!undefined` ⇒ `internal.enabled = false` ⇒ **OFF at boot. A divergence
inside a translated node**, and the same hole in `sse.ts` (`autoReconnect` true ⇒ false), `websocket.ts` (`autoConnect` true ⇒ false,
`reconnectDelay` ⇒ `NaN`) and `streaming.ts` (the parser's 1 MiB ⇒ 0, the accumulator's `'\n'` ⇒ `''`, 1000 ⇒ 0).

**The fix, at the rule**: in all four emitted libs `has(options, key)` is now `hasOwnProperty && options[key] !== undefined`, with a
comment naming `node.ts sendValue`; an option passed as `undefined` is not a delivery and the internal keeps what it holds. And the
hooks decide "did an input change" from the APPLIED values, never the raw options — realtime `{ collection: s.internal.name, enabled:
s.internal.enabled }`, sse `{ url: s.internal.url, autoConnect: s.internal.autoConnect }`, websocket `{ url: s.internal.config.url,
protocols: (s.internal.config.protocols ?? []).join(','), autoConnect: s.internal.autoConnect }` — so a Variable written back to `undefined`
schedules nothing, as a setter that never ran schedules nothing (S5). For sse/websocket the comparison change is observably
equivalent (their passes already return on an unchanged URL / identity); for realtime it is not (`reconfigure` tears down and
resubscribes) — E19 pins it. The page and the plan are unchanged: the wire prints its render read as §66 said.

### §66.5#1.2 The fixture — `tests/fixtures/live-desk`

`enabledVar` (`Variable2`, label *Enabled*, name `enabled`, x 200 y 300) → `feed.enabled`; nothing writes `enabled` anywhere in the
project — **the shape the register said a fixture may wire only after the measurement**. Emitted: the same 17 files, the same two
notes, 0 refusals; `pre.json`/`post.json` differ in exactly three files — `realtime.ts` (the rule), `Home.tsx` (the import, the
render read, the option), `stores/variables.ts` (`export const enabled = value<string | undefined>(undefined);` — typed `string` by
`all([])`, the §72 lane's row; NOT pinned by this lane).

### §66.5#1.3 Gates and arms

```
runtime instrument (noodl-runtime, ONE spec): 9/9, exit 0 — runtime.log · reverted-arm probe: probe-reverted.log (0 refusals, OFF in the lib) ·
  corpus walk: corpus.log (116 fixtures, 0 stream configs from an unwritten Variable — the corpus is blind to the shape)
pkg tsc 0 (exit 0, twice — after the build and after the one typecheck-emitted red below) ·
subscribe-to-changes.test.ts 45/45 (41 → 45: A9, C4, E18, E19; A2/A3/A6/A7/B4 re-pinned to the wired base, `unwireEnabled` restores the
  unwired rows' intent) · sse.test.ts 36/36 (+E12) · websocket.test.ts 38/38 (+E13) · streaming-trio.test.ts 60/60 (+ one §D row)
export-ledger:check OK 124 translated · picker --check 117/127 (92.1 %) exit 0 (the floor does not move — a divergence inside a translated node)
whole package jest ONCE (load 4.98): 79 files (79 on disk), 2934/2935, exit 1 — the ONE red `typecheck-emitted › socket-desk`:
  TS18048 `s.internal.config.protocols` is possibly undefined (the applied-values line in websocket.ts; `protocols?` is optional on the
  connection config) — fixed as `(s.internal.config.protocols ?? []).join(',')`; then pkg tsc 0, websocket 38/38, typecheck-emitted 43/43,
  subscribe 45/45 re-run green (the whole run is NOT repeated — the fix is one emitted line, and typecheck-emitted is the gate that saw it;
  §66.4 #1's lesson a fourth time: run typecheck-emitted before the arms).
arms (mut.py, mut.log + mut-summary.txt; every source restored md5-identical): 11 armed — 10 KILLED, 1 SURVIVED-as-equivalent:
  M1 realtime has() counts undefined as delivered (3: C4 E18 E19) · M2 has() drops null not undefined (3) · M3 the realtime effect compares
  the RAW Enabled — true→undefined reconfigures (2: C4 E19) · M5 sse has() reverted (E12) · M6 websocket has() reverted (E13) · M7 streaming
  has() reverted (the §D row) · M8 the fixture wire removed (5: A2 A3 A6 A7 A9) · M9 isEnabled === true (18) · M10 Enabled coerced whether
  or not delivered (20) · M11 websocket reconnectDelay guarded by presence alone ⇒ NaN — SURVIVED: the emitted nextReconnectDelay (§66 D1,
  the contract) normalises a non-finite base to the default before any timer, as the runtime's does — equivalent, not a hole ·
  M12 has() without hasOwnProperty — EQUIVALENT by construction, killed by C4's text pin alone (recorded as such).
```

### §66.5#1.4 What building it found

1. 🔴 **The export's `has()` treated "passed as undefined" as "delivered" in all four stream libs** — one helper, copied four
   times, each carrying the same hole; a rule the runtime keeps in ONE place (`sendValue`) was transcribed nowhere. The
   measurement was the whole cost: the fix is one line per lib.
2. ⚠️ **The corpus is blind to this shape** (`corpus.log`, 116 fixtures): 6 stream nodes, 7 wired config inputs, 2 from a
   Variable — both DATA ports written by a text input; 10 unwritten Variables in the corpus feed Texts and controls, none a
   stream config. The runtime rule, not a corpus count, ranked it (RANK BY THE PRODUCT SURFACE).
3. ⚠️ **The instrument needs `category`** on a corpus module (`NodeDefinitionOptions` requires it) — a TS2741 on the first run, not
   a behaviour.
4. ⚠️ **`insert before the describe's close` found a helper's `});`** between §C and §D of the spec (the harness functions live
   there) — C4 landed inside `makeTimers` and read as a TS1005 cascade. Anchor on the helper comment that follows the describe.
5. ⚠️ **Two pins the base shape moved were not in EXPECTED.md**: A7 (`{}` ⇒ `{ enabled: enabledValue }` — the option object is never
   empty while the wire exists) and B4's handler-only arm (a second wire on Enabled hits "two wires" first). Both honest:
   `unwireEnabled(ir)` restores the rows' intent and A7 pins both shapes.

### §66.5#1.5 What this leaves (owner NONE unless named)

- The `enabled` store is typed `string` (`all([])` in `typeOfVariable`) — the **vartype lane (§72)** moves it to `unknown`; the hook's
  option is `unknown` so the page compiles either way. Owner: §72's lane.
- sse/websocket's raw-vs-applied comparison is equivalent today because their passes guard on URL/identity; if a pass ever loses
  that guard the applied comparison is what keeps a Variable-to-undefined from reconnecting. Owner NONE (pinned by C4's text).
- `hasOwnProperty` in `has()` is now redundant (an absent key reads `undefined`); kept for prototype safety — M12 is the equivalent
  mutant, killed by the text pin alone. Owner NONE.
- The runtime instrument lives in `test/corpus/` (the NDA-001 corpus dir) rather than a P18 dir — it is a runtime rule with a runtime
  harness; if the corpus README ever indexes rows by phase, this one is EXP-011's. Owner NONE.
- The drive (`EXPECTED-DRIVE.md`, `drive.sh`) is prepared and NOT run — the orchestrator's, serially after the merge.

### §66.5#1.6 The drive

Prepared, NOT run (the orchestrator runs it serially after the merge): `$SCRATCH/drive.sh` (modelled on s93's drive69.sh + drivelib.sh +
emit.ts, paths rewritten; `fakert.js` from §66.6 copied beside it) and the predictions in `$SCRATCH/EXPECTED-DRIVE.md`. Two arms, one at a
time, both against the fake `/realtime` on 8584 with `node_modules` symlinked from s93's built output: **A** the fixed emitter over
live-desk ⇒ T1 boot `true subscribed` with the Enabled wire present (one anonymous GET, one union POST, `__state` one stream), T2–T4 the
three frames as §66.6, T5 errs []; **C** the REVERTED emitter (`a16c2c82`, a detached worktree — never a stash) over the SAME fixture ⇒
T1 boot `false ''`, `__state` NO stream, T2 a create delivers nothing — the divergence on screen. What the drive cannot see: the runtime's
own reading (measured headlessly, not driven); a later write to the Variable (no writer exists in the fixture by design — S5/E19 cover it).
