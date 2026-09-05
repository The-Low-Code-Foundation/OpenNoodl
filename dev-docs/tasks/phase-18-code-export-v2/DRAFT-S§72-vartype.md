## §72 A variable with NO statically-known source is `unknown`, not `string` — §67.5's second row, built; and the record-Id hole it forced open (session 94, 2026-09-05)

**Picker 117/127 unchanged** — nothing new translates; this is the type a translated construct claims, and one build the honest type
forced: a record Id read from an `unknown` variable had no `unknown`-safe form in the emitted app (the built app was TS2345), a hole
every HTTP-written variable already fell through and the type change would have widened to every variable nothing writes.

### §72.0 What the analysis did, measured before a line of code

`appState.ts` `typeOfVariable` asked `sources.every(isString)` over the variable's `variableSources`, and `[].every(…)` is true — so a
variable with **no statically-known source** read `value<string | undefined>` and bound BARE at every sink. §47 closed the identical hole
for Object keys, §48 for Global Store keys, and §67.4 finding 1 registered it for variables. Three shapes have zero sources: a `Variable`
node nothing wires into and no Value typed in (a pure reader); a `Set Variable` whose Value is neither wired nor a primitive literal (an
`expression` — refused by the plan, its writer still listed); a Logic Builder's block write (`noodl_set_variable` — a writer with no typed
source, refused whole). **Measured on the reverted rule** (`probe-post.ts` under M1): a zero-source variable wired into a text input's
`maxLength` printed `maxLength={noteValue}` and the built app read `TS2322 'string | undefined' is not assignable to 'number | undefined'`
— the vacuous `string` was not a label, it was a red build.

**The corpus** (`corpus.ts`, a walk that replicates discovery's four source rules and is cross-checked against the post-change `tsType`):
39 fixtures, 79 variables, source-count histogram `[1:58, 2:14, 3:5, 4:2]` — **0 variables with zero sources, 0 fixtures affected**;
the pre/post snapshot of every emitted file of every fixture is **byte-identical** (`pre/*.json` = `post/*.json`, 39 of 39). The product
surface — 36 `nodegx.project.json` projects (the members-area template, 16 lessons, 8 P81 demos, editor test projects) — holds **0
`Variable2` / `Set Variable` nodes on disk** (a validated grep: 3 on panel-desk, 0 there) and exactly ONE variable, minted by the
`log-a-thing` solution's Logic Builder census (`lastEntryTitle`: a writer, 0 sources): it moves from `string | undefined` to `unknown`,
and its only reads are the transcribed-workspace comment and the VF facade's `get lastEntryTitle(): any` — nothing live changes.
The sibling hole in `typeOfPayloadKey` (the same vacuous `every` for an Event Sender's listed key nothing wires): 1 listed payload
key in the corpus, 0 unwired — registered, not built.

**probe.ts — the §69 rule as the oracle.** An unwired NUMBER Set makes a variable `unknown` today, the type §72 gives a zero-source one;
so today's emitter, fed that, answers what each sink WILL print. Random Bytes' length/encoding (browser-utilities E1), a Subscribe's
Enabled (A6), a Drag's Mounted (C13): text identical for `string` and `unknown`, typecheck `[]` — none moves. **The relation pair's
target Id (relation-pair C2): text identical, typecheck 3× `TS2345 Argument of type '{}' is not assignable to parameter of type
'string'`** — the Record fetch's `puppyRecordId`, `linkTargetId`, `unlinkTargetId`. A local bound from an `unknown` read narrows to `{}`
under `if (!local)`, never to `string`. Pre-existing for every `unknown` variable (an HTTP body, a Function output — §10's own
population); C2 typechecks the shape with a variable nothing writes, so §72 alone turned an existing green gate red.

### §72.1 What is built

`appState.ts` `typeOfVariable`: `sources.length > 0 && sources.every(…) ? 'string' : 'unknown'` — §47's rule, one construct over, with
the comment naming §72 and the measured TS2322. Every consumer already had the `unknown` road (the 21 `unknown` variables in the corpus
walk it): `state.ts` prints `value<unknown>`; plan.ts 16806 marks the binding `untyped` so the sink table coerces (`String(x ?? '')` at a
text sink, `!!x` at a boolean one, a number sink refused by name — *reads variable "note", which has no statically-typed writer, into a
sink this slice cannot coerce it to*); `exprTsType` answers `unknown` for the read, so a store key the read feeds is `unknown` too.

**The record-family coercion** (the build the type forced). Type in `plan.ts`, print in `component.ts` — two files, both armed:
`api-call` gains `coerceId?: 'string'` (set by the record verbs when `exprTsType(idExpr) === 'unknown'`), its `guards` entries gain
`coerce?: 'string'` (the relation pair, per argument), `record-fetch` gains `coerceId?: 'string'`; the three emitters print
`String(<read> ?? '')` at the bind. The runtime keys `Model.get(id?: string | number)` by the value and the client
`encodeURIComponent`s it, so `String()` transcribes both; `?? ''` keeps an unwritten variable on the runtime's own failure road — `''`
meets `Missing Record Id` / `Missing Id.` / *No target record Id … specified* exactly as `undefined` did. A `string` source binds bare as
before (F2 is the control). A new `ValueExpr` kind was considered and refused: every expression walker (imports, hook locals, validity)
would have to learn it, and a walker that misses a case renders nothing silently; a flag is consumed at exactly three emitters and the
inner `store-get` stays visible to every walker.

```tsx
const puppyRecordId = String(puppyId.get() ?? '');
if (puppyRecordId === undefined || puppyRecordId === null || puppyRecordId === '') return;
…
const linkTargetId = String(puppyId.get() ?? '');
if (!linkTargetId) throw new Error('No target record Id (the record to add a relation to) specified');
```

### §72.2 The fixtures — none changed

No fixture on disk has a zero-source variable, so none was re-authored: the byte-identical corpus snapshot is the pin proof, and the
reverted arm (M1) is the evidence of change. Every row builds its shape by mutation — panel-desk's `noteVar` with its Value dropped (a
Variable nothing writes), link-desk with the Record's Id from such a Variable (C2's shape), puppy-test-3's update/delete fed the same.
`$SCRATCH/fixtures/link-desk-72` is the C2 shape authored on disk for the drive.

### §72.3 Gates and arms

`tests/variable-seed.test.ts` **§E, 10 rows** (§72's type): E1 zero sources ⇒ `value<unknown>` under *No statically-known writer*; E2 a
refused expression-Value Set is a writer with no source — the writer line stays, the type is `unknown`; E3 the seed alone is one string
source (control); E4 the two unknowns told apart by the comment (a number seed vs no source); E5 the type propagates — `PanelStateRecord`'s
`note?: unknown` and `String(panelState.value.note ?? '')`, the seeded control `note?: string` and bare; E6 the app typechecks; E7 a zero-
source variable into a number sink is refused by name (bound bare and TS2322 on the reverted rule); E8 mixed sources ⇒ `unknown` (kills
`some`); E9 two string sources stay `string`; E10 straight into a Text: `String(noteValue ?? '')`, the seeded control `{noteValue}` bare.
**§F, 5 rows** (the coercion): F1 C2's shape — three coerced binds, the `unknown` store line, typecheck `[]`; F2 the string-variable
control binds bare; F3 the verb's own Id; F4 the record verbs' `guardId` path on puppy-test-3 (guard AND call coerced, typecheck `[]`);
F5 the guard still follows the coerced bind. **One pin moved outside this spec**: relation-pair C2's two locals (`linkTargetId`,
`unlinkTargetId`) now read `String(puppyId.get() ?? '')` — honest because `puppyId` has no writer in that row; its typecheck row, which
went red under the type alone, is green again. Every other pin predicted in `EXPECTED.md` stayed (twelve specs re-run before the sweep:
browser-utilities, subscribe-to-changes, drag, navigate-to-path, untyped-variable, visual-function, page-inputs, object-store,
stores-events, date-family; then the api-call family: record, record-verbs, relation-verbs, file-record, user-family,
set-user-properties-magic-link, logic — all green). Package tsc 0.

**14 arms, 14 killed** (`mut.py`, md5-restored, value level, four files): appState.ts — M1 the vacuous `every` restored (10 red: E1 E2 E4 E5
E7 E10 …), M2 `> 1` (7 — A4 C1 E3 E5 E10 F2), M3 `some` for `every` (E8), M4 a literal always `string` (B1 B2 E4 E8), M5 the memo poisoned
(13); state.ts — M6 prints `string | undefined` whatever the plan typed (7); plan.ts — M7 a variable binding never `untyped` (E7 E10), M8
`exprTsType` answers `string` for every `store-get` (8 — E5 E6 E7 F1 F3 …), M9 the relation guards never coerce (F1 F3 F5), M10 the record
fetch never coerces (F1 F5), M11 the verbs never coerce (F4); component.ts — M12 the guard bind INVERTS the flag (F1 F2 F3 F5), M13 the
coercion prints `String(x)` without `?? ''` (F4), M14 the fetch INVERTS the flag (F1 F2 F3 F5). ⚠️ M12/M14 first read **NO-COMPILE**: a
`=== 'never'` comparison against `'string' | undefined` is TS2367, not a mutant — re-armed by inverting the ternary.

**Gates**: package tsc 0 · `variable-seed.test.ts` 33/33 · the twenty specs above green · `export-ledger:check` exit 0 (176 types, 124
translated) · picker `--check` exit 0 (117/127 holds) · **the whole package ONCE, load 4.16, no peer suite running: 79/79 suites, 2943/2943
tests, exit 0** (79 spec files on disk reconciled; the sweep for the negative pins no grep can find — none surfaced).

### §72.4 What building it found

1. 🔴 **A record Id read from an `unknown` source had no `unknown`-safe form** — three emitters (`record-fetch`, the verbs' `guardId`, the
   relation pair's `guards`) bound the read and narrowed it, and an `unknown` narrows to `{}`. Pre-existing for every HTTP-written
   variable since §43/§62; found only because §72 put a zero-source variable through C2's typecheck. Built here (§72.1).
2. ⚠️ **A number sink took a `string | undefined` variable bare** — `maxLength={noteValue}`, TS2322 in the built app — because the
   binding was not `untyped`. §72's type routes it to the refusal sentence §10 wrote for exactly this; the reverted arm is the proof.
3. ⚠️ **The corpus cannot see this row** — 0 of 79 variables; the product surface has 0 Variable nodes. The measurement that priced the
   job was the probe with the §69 rule as an oracle, not the corpus (RANK BY THE PRODUCT SURFACE: the surface here is the picker's
   Variable node with nothing wired, which no fixture authors).
4. ⚠️ **`git checkout -- <file>` to restore an arm discarded the lane's own edit** — caught by `git diff --stat` reading empty;
   re-applied from the python patch, and every later arm restored from a `cp` snapshot with an md5 check.

### §72.5 What this leaves (owner NONE unless named)

- **`typeOfPayloadKey`'s vacuous `every`** — an Event Sender's listed payload key nothing wires reads `string`; corpus 1 key, 0 unwired.
  One line, §47's rule a fourth time. Owner NONE.
- **A `number`-typed Id** (a record column typed number wired into a record Id) is bound bare into a `string` parameter — the same
  TS2345, a different type; no fixture wires one. Owner NONE.
- **A Logic Builder-minted variable is `unknown`** (`lastEntryTitle`) — the block write is refused whole, so nothing types it; the VF
  facade reads it `any`. Correct today; when EXP-003 translates the write, the source registers and the type is earned. Owner NONE.
- **The `enabled` lane's measurement (§66.5 #1)**: a Variable nothing wrote into a Subscribe's `enabled` prints `enabled: enabledValue`
  bare for `string` AND `unknown` (probe A6) — §72 changes neither the text nor the boot semantics of that shape. Owner: the enabled lane.
- §67.5 #1 / §68.5 #1 / §69.5 #1 (a literal under a wire) unchanged.

### §72.6 The drive — prepared, not run (`$SCRATCH/EXPECTED-DRIVE.md`, `drive.sh`)

`link-desk-72` (link-desk with the Record's Id from a Variable nothing writes — C2's shape): the built app's `tsc -b` is the consequence
(green with the coercion; red 3× TS2345 with the type alone). Predicted: boot `["Link Desk","","","",""]`, errs `[]` (the effect form
returns silently on `''`); Link ⇒ the link Error row reads *No target record Id (the record to add a relation to) specified* before any
request, status stays `''`; Unlink ⇒ the sibling sentence; errs `[]`; 0 listeners after teardown.
