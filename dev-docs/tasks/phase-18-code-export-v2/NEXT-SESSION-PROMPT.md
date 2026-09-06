# Next session — session 94 (2026-09-05/06) ran FOUR lanes in parallel worktrees and merged all four: §70 (`Global Store Set`'s typed-in Value), §71 (an `Object` node's OWN typed-in `prop-*` = a per-mount write), §72 (a no-source variable is `unknown`, and the record-Id coercion it forced), §66.5 #1 (MEASURED: an unwritten Variable never reaches a setter — Enabled boots ON; the export booted OFF; fixed in all four stream libs). Picker 117/127 (92.1%) unchanged — every one a divergence INSIDE a translated node. Next = the small remainders the four registers left (one-liners), then the literal-under-a-wire family row (named by FOUR registers), then §69.4 #1's cascade sentence in EXP-004's report

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 94's lanes were allowed SINGLE-spec jest runs (3–10 s each) and ONE whole-package run
each behind a load gate (`uptime` 1-min < 6); the orchestrator ran the whole package, the editor tsc, the ledger scripts, `test:ci` and
the four drives strictly one after another (`final-gates.sh`, s94 scratchpad `5fa5a892-…`). Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## 🔴 The parallel-lane recipe that WORKED (memory `p18-parallel-lanes-recipe`)

`scripts/devtools/make-worktree.sh <name>` ×4 (never the harness's `isolation:worktree`), a COMMON BRIEF at
`../OpenNoodl-worktrees/p18-COMMON-BRIEF-s94.md` (rules, CPU, the method a–j, the FINAL MESSAGE shape), one lane prompt each naming the
section, the runtime file, the code sites, the fixture and the spec. Lanes commit on their branch; the orchestrator `git cherry-pick`s
each onto `cline-dev` (all four applied clean — different regions of `plan.ts`/`appState.ts`), runs the gates ONCE on the merged tree,
then the drives with each script's worktree path repointed at the primary checkout. ⚠️ **A lane that backgrounds its own run ENDS ITS
TURN** — all four stopped "waiting for a notification"; the fix was a one-line `SendMessage`: *poll the exit file yourself*. Say it in
the brief next time. ⚠️ The §66.5 drive's `fakert.js` takes a LOG PATH argument; launched without it, it crashes on the first request and
the page reads `interrupted` (still distinguishable from OFF's empty status). Lanes ran 18–39 minutes each, ~200–290k tokens each.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged (EXP-002-NAMED-STORES-TARGET-OUTPUT.md grew the `Make it stormy` button + its provenance line to stay the goldens' mirror) |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's); §69.4 #1 (the cascade sentence on the node in front) seen a 4th time in §70.0 |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 124 translated; notes name §70/§71/§72/§66.5 |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 Route B built + driven s34 |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; **§70, §71, §72 and §66.5 #1 built this session**; §66.5 #1, §67.5 #2, §68.5 #3, §69.5 #2 CLOSED; the 10 left are §50 out-of-scope RULINGS |
| EXP-012 | 🟢 built + driven s67 |
| EXP-013 "Not exportable yet" | 🟢 — no scheduled row remains |

## What session 94 did (four lanes; each re-measured FIRST, every one found the register right — and two found it UNDERSTATED)

1. **§70 `Global Store Set`'s typed-in Value** (lane gss, `c7b1fb13`): the refusal *nothing is wired into value* had dropped the BUTTON in
   front; now a literal `globalstore-set` behind every existing gate (merge/transaction/key/number-boolean-typed-key), the literal types a
   non-initial key (`string` bare, else `unknown` through `String()`), under a wire shadowed. cheer/Pages/Mood grew `Make it stormy` →
   `setStormy` (the corpus's ONLY typed-in Global Store Set). `global-store.test.ts` 32 rows (+H1–H10), 12/12 arms. Driven: every row ✓, C1 ✓.
2. **§71 the `Object` node's OWN `prop-*`** (lane objlit, `cb599016`): MEASURED in the runtime first — `modelnode2.ts` registers ANY `prop-*`
   input, its setter `scheduleStore`s, so every authored value is written at creation, PER MOUNT, list not consulted, a Set's Do lands over
   it. The export had dropped them **silently** (no note, no refusal). Now a mount effect with the §67 seeds, entries in PARAMETER order,
   the literal types the key; a wire on the same port still refused by §47's sentence. New fixture `notice-desk`; `object-store.test.ts`
   63 rows (+§G 12), 13/13 arms; profile-desk byte-identical. Driven: every row ✓, C1 (no `useEffect`) ✓. ⚠️ The editor's panel HIDES
   the port (`allowConnectionsOnly`) — only the MCP can author it; a product-surface question, registered §71.5.
3. **§72 a no-source variable is `unknown`** (lane vartype, `1f0e11a9`): the corpus has 0 zero-source variables in 39 fixtures (79 variables,
   every emitted file byte-identical) and 1 on the product surface (a Logic-Builder-minted name). The type change alone RED the built app
   where an `unknown` Id binds into the record family (3× TS2345) — so the api-call/record-fetch plans carry `coerceId`/`guards[].coerce`
   and print `String(x.get() ?? '')`, keeping the runtime's failure road (*No target record Id … specified*). `variable-seed.test.ts` 33
   rows (+E1–E10, F1–F5), 14/14 arms; `relation-pair.test.ts` 325/334 moved honestly. Driven: P1–P4 ✓; P5 read the verbs' two caught
   `console:` reports where the sheet said `[]` — a sheet mistake about the harness's `console.error` wrap, nothing uncaught.
4. **§66.5 #1** (lane enabled, `2a637f17`): MEASURED — `node.ts:806` `sendValue` returns on `undefined`; `connectInput` delivers only a
   defined value; a Variable nothing wrote never enters ANY setter ⇒ the node's default stands (Enabled ON, SSE `autoReconnect` true, WS
   `autoConnect` true). The export's `has()` = `hasOwnProperty` read `enabled: undefined` as a delivery ⇒ OFF. Fixed in all four libs
   (`has` requires `!== undefined`; the hooks compare APPLIED values); live-desk wires `enabledVar` → `feed.enabled`; a runtime instrument
   spec lives at `packages/noodl-runtime/test/corpus/exp-011-s66-5-…test.ts` (9 rows). 10/11 arms (one equivalent). Driven both arms ✓.
5. **Docs**: the four DRAFTs stitched into EXP-011 (§66.5 #1 after §66.6; §70, §71, §72 appended, each with the OBSERVED drive), the four
   register rows ticked, PROGRESS row, the named-stores target doc.

## The final gate chain — READ on the merged tree (HEAD `1f0e11a9` + this docs commit)

`final-gates.sh`: **whole pkg jest 79 files (79 on disk) 2990/2990 exit 0** (22:25–22:26) · **editor tsc exit 0, 0 `error TS`** (22:28) ·
**`export-ledger:check` OK — 176 types, 124 translated** · **picker 117/127 exit 0** · **editor `test:ci` 2943 specs, 5 failures = the
floor BY NAME** (AIX-006 ×4 + SB-017 acceptance 6; seed 13441; `test-results.json` fresh 22:31; `.webpack-cache` cleared first; exit 1 as
always on the floor). Then the drives, one at a time: §70 `drive70.log`, §71 `drive71.log` (+ the reverted emit), §66.5 `drive66.log`
(arm A instrument-faulted) + `drive66A.log` (arm A re-run ✓) , §72 `drive72.log`. Worktrees and lane branches removed; `git worktree list`
carries the OLD stale entries only.

## Uncommitted at hand-off

Nothing of session 94's after the docs commit. `EXP-001-NODEGX-CORE.md` still carries a PEER's edit, untouched. `library/**`,
`packages/noodl-core-ui/**`, `packages/noodl-editor/**` modifications are peers' (P78/P81/P82), untouched.

## 🔴 Do this next (BUILD; every one is registered with owner NONE and is small)

1. **The one-liners, one session, one commit** — (a) `typeOfPayloadKey`'s vacuous `every` (§72.5; §47's rule a FOURTH time — grep -a
   `sources.every` in `appState.ts` and count the sites), (b) the naming-node list pin in `global-store.test.ts` (§70.4 #1 — a
   `nodes.filter(isGlobalStoreFamily)` instead of six ids), (c) the ledger's `§` normalisation (§70.4 #2 — `coverage-ledger.json` is
   ASCII-escaped except §69's raw line; one `python -c` with `ensure_ascii=True`, then every note reads the same), (d) `setWith` coercions
   with a typed-in Set Variable value (§69.5 #3 — each is one clause; measure the runtime's coercion table first). Arms for each.
2. **The literal-under-a-wire family row** — named by §67.5 #1, §68.5 #1, §69.5 #1, §70.5 #1. Measure the runtime FIRST with the s94
   instruments' shape: for a Set (Variable / Object Properties / Global Store) the typed-in value sits in `internal.value` from creation
   and a Do BEFORE the wire's first delivery writes the literal; for `Variable2`'s Value and `Model2`'s `prop-*` it is a creation-time write
   that the wire later overwrites. The honest translation is the seed PLUS the wire (§67's seed shape + the existing wire path). mood-desk's
   four Sets are the fixture. This is the biggest divergence left inside translated nodes.
3. **§69.4 #1 — the cascade sentence lands on the node IN FRONT of the refused sink** (seen in §69.0, §70.0). EXP-004's report is where a
   person reads *Save profile — nothing is wired into value*. The fix is in the registration pass (§64.4 #3 named the mechanism): the
   node in front should say *fires <sink>, which is refused: <sentence>*. Every `dropped:` note pin moves — the whole-package run is the sweep.
4. **§71.5 — the editor cannot author a `Model2` `prop-*` value** (the panel hides `allowConnectionsOnly` ports; the MCP accepts them with
   an info notice; the editor's `connection-only-parameter` sentence "discarded" is FALSE for this node). Owner NONE — a product-surface
   ruling for Richard: should the panel show it, or should the MCP refuse it?
5. EXP-004's two Richard items; the residual registers (§57.5–§72.5).

🔴 **The typing rule and the write rule live in two files** — `appState.ts` (discovery) and `plan.ts` (compile); arm BOTH (four sessions).
🔴 **A whole-package run is the pin sweep a grep cannot do.** 🔴 **Measure the PARAMETER, not the workaround** (walk every `nodes.json`).
🔴 **Byte-identical output is the strongest pin proof and the weakest evidence of change — run the reverted arm too.** 🔴 **A refused sink
drops the trigger wire in front and the node in front wears its sentence.** 🔴 **`ts-node` here needs
`-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`emit.ts` REMOVES its output
directory — copy `node_modules` in AFTER the emit** (s94 copied from s93's `profile-desk-out`). 🔴 **A reverted arm = `git worktree add
--detach <scratch> a16c2c82` + `ln -s <repo>/node_modules`; remove it after. NEVER a stash.** 🔴 **A `git checkout -- <file>` to restore an
arm DISCARDS your own edit** (lane vartype lost one, caught by an empty `git diff --stat`) — restore from a `cp` snapshot with md5.
🔴 **`grep -a`. Absolute paths. `rm` one file per command in zsh.**

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §70.5: literal under a wire (→ job 2); `merge: true` with a typed-in object; a refused Set's literal still types the key (H9); the
  cascade sentence (→ job 3); the naming-node list pin (→ job 1b).
- §71.5: literal under a wire on the same port; the editor's FALSE "discarded" sentence for `Model2` `prop-*` and the hidden port (→ job 4);
  a refused Object's other literal still types + prints "Seeded with".
- §72.5: `typeOfPayloadKey` (→ job 1a); a `number`-typed record column bound bare into a record Id (same TS2345, different type; no
  fixture wires one); a Logic-Builder-minted variable is `unknown` until EXP-003 translates the write.
- §66.5#1.5: the `enabled` store is `unknown` under §72 (the hook option is `unknown`, compiles either way); sse/ws applied-vs-raw
  comparison equivalent today; `hasOwnProperty` redundant in `has()`; the runtime instrument lives in `test/corpus/`.
- §69.5 #3 `setWith` typed-in coercions (→ job 1d); §67.5 #1 / §68.5 #1 (→ job 2); §69.4 #1 (→ job 3).

## Instruments

s94 orchestrator scratchpad `5fa5a892-0810-464b-996d-50d0f1367743`: `final-gates.sh` + `whole.*`/`editor-tsc.*`/`ledger.*`/`picker.*`/
`testci.*`, `drive70.sh`/`.log`, `build71.sh` + `drive71.sh`/`.log`, `drive66.sh`/`.log` + `drive66A.sh`/`.log`, `drive72.sh`/`.log`,
`drivelib66/71/72.sh`, `notice-desk-rev-out` (§71 C1). Lane scratch (durable, outside the repo): `../OpenNoodl-worktrees/p18-scratch-s94-{gss,
objlit,enabled,vartype}/` — each holds `probe.ts` + `probe-reverted.log`, `corpus.*`, `EXPECTED.md`, `EXPECTED-DRIVE.md`, `mut.py` +
`mut-summary.txt`, `snap.ts` + `pre/post`, `whole.log`, the built `*-out` dirs, `drive.sh`; `enabled/` also `fakert.js`, `runtime.log`,
`instrument.test.ts`; `vartype/` also `fixtures/link-desk-72` and the product-surface corpus logs. The brief: `../OpenNoodl-worktrees/p18-COMMON-BRIEF-s94.md`.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (79 spec files); `grep -a`;
absolute paths; **`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear servers down the
moment the drive is read (s94: 0 listeners on every port at every teardown).**
