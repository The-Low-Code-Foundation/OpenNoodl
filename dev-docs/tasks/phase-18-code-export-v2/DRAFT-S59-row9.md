## §59 Tier 2.8 row 9 — `Hash`, `Random Bytes`, `Screen Resolution`: three browser APIs, two libs (session 85, 2026-09-05)

Type ids `net.noodl.Hash`, `net.noodl.RandomBytes`, `Screen Resolution` (the last IS its display name; the first
two are not — `Hash` / `Random Bytes`). All three are in the picker population (`inNodePicker`, browser, not
deprecated), so the floor moves **98 → 101**.

### §59.0 Design — what each node is on disk, and what it becomes

**The port sets, read off the catalog (`node-catalog.json`), not the source files** — `outcomeOutputs` adds a
`Completed` port the literal `outputs:` object does not show (§37's trap, paid once already):

| node | inputs | outputs |
|---|---|---|
| `net.noodl.Hash` | `value` (string), `algorithm` (enum SHA-256/384/512, default SHA-256), `encoding` (enum hex/base64/base64url, default hex), `hash` (signal, display **Do**) | `digest` (string), `done`, `failure`, `completed`, `error` (string) |
| `net.noodl.RandomBytes` | `length` (number, default 32), `encoding` (enum, default hex), `generate` (signal, display **New**) | `value` (string), `done`, `failure`, `completed`, `error` (string) |
| `Screen Resolution` | none | `width`, `height`, `aspectRatio` (numbers) |

**Hash and Random Bytes are `UUID`'s shape (§37), not a request's.** `hash.ts` `_run` and `randombytes.ts`
`_generate` are: read the inputs the setters stored, produce a value or a failure, write the value row (or leave it
as it was), clear or write the Error, report the outcome. That is `compileIdNew`'s two-arm `if` — with two
differences the runtime makes and the export keeps: **the value row boots empty** (neither node has an `initialize`
that seeds it; `Digest` / `Value` read `undefined` until the first Do — where UUID's `initialize` mints one), and
**a failure raises on the error channel** (`reportOutcome(…, 'failure', { code })` → `raiseRuntimeError` before the
Failure pulse: `hash/failed`, `random-bytes/failed`; §54's rule that the raise sites are the row). Hash is
asynchronous (`crypto.subtle.digest` is a promise), so its call is awaited and the handler around it is `async`
(`actionsAwait`); Random Bytes is synchronous.

So: one action kind `crypto-call { node: 'hash' | 'random-bytes', inputs, local, materialize?, errorMaterialize?,
async, then, failThen }`, one expression kind `crypto-out { node, viaState? }` for the value output, and `outcome-error`
(the shape UUID already uses, `local: '<local>.error'`) for the Error. The three-question table is UUID's, verbatim:

| read from | `Digest` / `Value` | `Error` |
|---|---|---|
| render, or another handler | the row | the row |
| the **Done** arm | `<local>.digest` / `<local>.value` | 🔴 refused — both nodes clear the message before Done fires |
| the **Failure** arm | the row (neither node writes the value on failure) | `<local>.error` |

**The inputs are read where the setters read them.** `value`/`algorithm`/`encoding` (Hash) and `length`/`encoding`
(Random Bytes): a wire is the render expression the handler closes over (a wired `length` is wrapped in `Number(…)`,
the setter's own coercion at the delivery site); an authored literal prints as a literal; neither prints `undefined`,
and the lib applies the runtime's own fallbacks *there* — `algorithm || 'SHA-256'`, `encoding || 'hex'`, `value || ''`
(the `||`, not `??`: an author who cleared the field gets the default), and `length === undefined ? 32 : length`
(NOT `||`: a `Length` of 0 is a failure, which is the node's whole reason for existing). A wired enum is accepted:
the runtime stores whatever arrives and lets WebCrypto (`digest` rejects an unknown algorithm) or `encodeBytes`
(`Unknown encoding "x". Use hex, base64 or base64url.`) refuse it at run time; the lib does the same.

**`src/lib/crypto.ts`** (new emitter `src/emit/cryptoLib.ts`): `encoding.ts` transcribed — `bytesToHex`,
`bytesToBase64` (chunked, verbatim), `bytesToBase64Url`, `encodeBytes` (unknown → throw), `requireSubtle` (message
verbatim — it is the one realistic failure and the Error output prints it), `utf8Bytes`, `randomBytes` (the
`getRandomValues` throw verbatim; the 65536-byte chunk loop is NOT transcribed, on `idLib.ts`'s stated rule: the
node's own `MAX_LENGTH = 4096` makes it one iteration, a constraint that cannot bind); `tryHash(value, algorithm,
encoding): Promise<HashResult>` (`_run`, both catch paths — the synchronous `requireSubtle` throw and the promise
rejection — as `{ ok: false, error }`); `tryRandomBytes(length, encoding): RandomBytesResult` (`_generate`, the
range gate with its exact sentence). Discriminated unions, on idLib's reason: the Done arm reads `.digest` unguarded.
Separate from `id.ts` (which deliberately does not export `randomUuid`) and from `util.ts` (a project that formats a
string should not ship a CSPRNG).

**Screen Resolution is a hook, the boundary's shape (§54) without a listener.** `screenresolution.ts` reads
`window.innerWidth/innerHeight` at `initialize` and on every `resize` (one listener per node instance, removed on
delete — NDA-012), and `aspectRatio` is `width / height` in the getter. `src/lib/screen.ts` (`src/emit/screenLib.ts`):
`useScreenResolution(): { width, height, aspectRatio }` — a lazy `useState(() => readViewport())` (the `initialize`
read, once per mount), one `resize` listener in an effect with its cleanup (the delete listener), `aspectRatio`
computed as the getter computes it (so a zero-height viewport answers `Infinity`, the runtime's own answer). Registered
on first read (`screenPlanOf`, memoised) as `ScreenResolutionPlan { nodeId, label, local, comment }` on
`plan.screenResolutions`; expression `screen-out { local, field }`, `number`, never undefined, valid in both contexts
(a handler closes over the latest render, which is what the getter answers), touching no snapshot. The hook line
prints beside the boundaries' (it reads nothing). Recorded divergence: the runtime's SSR guard (`typeof window ===
'undefined'` → outputs unset) has nothing to guard in a Vite SPA and is not transcribed; the outputs are typed `number`.

**Refused by name** (every sentence predicted here, graded in §F of the spec):

- Hash / Random Bytes: `its <port> input is not a port this node has` · `two wires feed its <Port> input — last-writer-wins is not statically ordered` · `its <Port> input has no statically known source` (or the feeder's own sentence) · `its <port> output is not a port this node has` · `its Done|Failure output is consumed as a value — a pulse carries nothing to read` · `its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them` (UUID's sentence) · `its Error is read from its own Done chain — the node clears the message before Done fires, so that read is always empty` · a read of Digest/Value/Error while Do|New is wired but never attached: the trigger's own reason or `its Do|New is never fired by a translatable trigger` · a read while Do|New is unwired: `its Digest is read, but nothing fires its Do — no digest is ever computed` / `its Value is read, but nothing fires its New — no random bytes are ever generated` (§56 E1: a row nothing writes is a dead artefact, not a translation) · the sweep for a node nothing fires: `its Do|New is never fired by a translatable source`.
- Screen Resolution: `its <port> input is not a port this node has` (it has none) · `its <port> output is consumed, and this node has no such port` · `component emits no file to host the viewport hook` · unread: the date sweep's `its answer is read by nothing statically translatable`.
- Not translated, recorded: two `Do` pulses in one tick are coalesced by `scheduleAfterInputsHaveUpdated` into one digest with two tokens; the export runs the digest once per pulse.

### §59.1 What is emitted

- **`src/lib/crypto.ts`** (`src/emit/cryptoLib.ts`, new): `tryHash(value, algorithm, encoding): Promise<HashResult>` and
  `tryRandomBytes(length, encoding): RandomBytesResult`, both discriminated unions; the three encoders, `requireSubtle`,
  `utf8Bytes`, `randomBytes` and `MAX_LENGTH = 4096` transcribed from `encoding.ts` / `hash.ts` / `randombytes.ts`; the
  throwing internals are not exported (the nodes catch; §37's `randomUuid` rule). Shipped only where a component calls a verb.
- **`src/lib/screen.ts`** (`src/emit/screenLib.ts`, new): `useScreenResolution(): { width, height, aspectRatio }` — a lazy
  `useState(() => readViewport())`, one `resize` listener per hook with its cleanup, the ratio computed as the getter computes it.
  Shipped only where a hook line prints.
- **plan.ts**: `HASH_TYPE`, `RANDOM_BYTES_TYPE`, `CRYPTO_NODES` (port order, trigger + its display name, the raised code, `async`,
  the `Number()`-coerced port, the two sentences), `SCREEN_RESOLUTION_TYPE` + `SCREEN_RESOLUTION_OUTPUTS`; `ValueExpr` gains
  `crypto-out { node, viaState? }` and `screen-out { local, field }`; `HandlerAction` gains `crypto-call { node, fn, code, async,
  inputs, local, materialize?, errorMaterialize?, then, failThen }`; `StateVarPlan.origin` gains `crypto` / `crypto-error`;
  `ScreenResolutionPlan` on `ComponentPlan.screenResolutions`; `cryptoStateOf` / `cryptoErrorStateOf` (both allocated by a
  READ — `idErrorStateOf`'s rule, not `idStateOf`'s: no seed, so a node read only inside its chain has no row),
  `cryptoLocalOf`, `cryptoChainScope`, `attachedCryptoNodes`; `compileCryptoCall` (`compileIdNew` with the inputs, the
  port-kind check on Done/Failure sinks BEFORE the chains compile, `Completed` on UUID's sentence); the `resolveExpr` branches
  (UUID's three-question table for the verbs; the boundary's registration shape for the viewport, `screenPlanOf`); the five
  expression switches, the five action walkers (`actionsValidIn`, `snapActionList`, `scanActions`, `fillMaterialize`, the
  session-read walker), `TRIGGER_PORTS`, `OWN_CHAIN_OUTPUTS`, the binding whitelist (`isCryptoRead`, `isScreenRead`), the date
  sweep (`its Do|New is never fired by a translatable source`), and a late prune of viewport plans whose node did not collapse.
- **component.ts**: the `crypto-call` print (always the block form — the Failure arm always raises; Hash's call `await`ed;
  trailing `undefined` arguments dropped so `tryRandomBytes(16, 'base64url')` reads as written; a wired Length inside `Number(…)`),
  `errorCodeOf` → the action's code, `RAISING_ACTION_KINDS` + `actionsAwait` + `actionIsStatement` + `actionTakesNoTerminator` +
  `blockBody`'s indent list + `deepActions` + `collectActionUse` + `actionExprsOf` + `chainReadsChainLocal`; `crypto-out` /
  `screen-out` in `collectExprUse`, `hookExprSources`, `maybeUndefined`, `exprCode` (`cryptoLocalReadOf`), `effectDeps`, and the
  text-sink fold whitelist; the viewport hook line beside the boundaries', printed only for nodes an emitted expression reads
  (`usedScreenNodeIds`); the two imports earned in the walkers; `cryptoHelpers` / `screenLib` on `EmittedComponent`.
- **emitApp.ts**: the two files. **Ledger**: three rows `translated` with notes; floor **98 → 101**; six pins moved
  (`animation-pair`, `filter-records`, `object-store`, `on-app-error`, `run-tasks`, `script`).

### §59.2 The fixture — `tests/fixtures/utility-desk`

`App`: the Router alone. `Pages/Home`: a text input → `plaintext` Variable (the write-through rule, §56 E2) → Hash's Value; a
"Hash it" button → Do (SHA-256, hex authored); Digest and Error bound to two Texts; Done → Set Variable `lastDigest` ← Digest
(the Done arm's local), Failure → Set Variable `hashFailed` ← Error (the Failure arm's local); two Texts on those Variables; a
"New nonce" button → Random Bytes' New (16, base64url) with Value in a Text and nothing on Done/Failure/Error; a Screen
Resolution's three outputs in three Texts. **The reverted arm** (`probe-reverted.log`, 042f221c): the three nodes `logic node
(…)`, the two Set Variables silenced behind Hash with *"the value wire has no statically known source"* (asked from the value
side, §54.2's finding again), 13 refusals, `pathway: false`, verdict null — every node predicted, the Set Variables' sentence
predicted as the alternative. **Built**: 16 files, zero refusals, the one shell note; the page reads:

```
const hashResult = await tryHash(plaintext.get(), 'SHA-256', 'hex');
if (hashResult.ok) { setHash(hashResult.digest); setHashError(undefined); lastDigest.set(hashResult.digest); }
else { setHashError(hashResult.error); raiseAppError({ code: 'hash/failed', … nodeType: 'net.noodl.Hash' … }); hashFailed.set(hashResult.error); }
…
const nonceResult = tryRandomBytes(16, 'base64url');
if (nonceResult.ok) { setNonce(nonceResult.value); } else { raiseAppError({ code: 'random-bytes/failed', … }); }
…
const viewport = useScreenResolution();   →   {viewport.width} {viewport.height} {viewport.aspectRatio}
```

### §59.3 The gates and the arms

```
packages/nodegx-export: tsc --noEmit 0 · browser-utilities.test.ts 55/55
  §A the fixture whole + the real ts.Program (8) · §B tryHash against the real WebCrypto (8) · §B′ tryRandomBytes (5)
  §C the viewport hook under a fake window (4) · §D refusals by mutation, each sentence exact (17) · §E the shapes a wire
  changes, three of them typechecked as real programs (7) · §F the findings pinned (3) · §G the ledger and the controls (3)
logic.test.ts 29/29 (the corpus control: `if (<local>.ok)` is UUID's listed shape) · in-code-markers 54/54
whole package jest ONCE: 69 files (69 on disk: 68 + this spec), 2319 rows — 2314 green + 5 red in three files that used
  `net.noodl.Hash` as their "node with no rule" (§40 sent them there; §50 reversed it): unreported-deferrals (2), script §G
  (2), record §D (1); re-pointed to `net.noodl.PatternExtractor` (§50's own out-of-scope list) and each re-run green
  (7/7, 74/74, 29/29). No file under src/ changed after the full run.
export-ledger:check OK — 176 types, 108 translated · picker 101/127 (79.5%), floor 101, --check exit 0
arms 15/15 KILLED, every arm compiled (a "0 total" would not count — §55's rule), sources restored md5-identical after each
  (mut.py, mut-summary.txt): M1 Length `|| 32` — 2 · M2 algorithm `??` — 1 · M3 base64url keeps padding — 2 · M4 the
  synchronous requireSubtle throw escapes — 1 · M5 the resize listener never removed — 1 · M6 aspect inverted — 3 · M7 Error
  read from the Done arm allowed — 1 · M8 the sink-port-kind check removed — 1 · M9 a wired Length not Number()-coerced — 1 ·
  M10 the Failure arm no longer raises — 4 · M11 crypto-out off the fold whitelist — 2 · M12 Hash not awaited — 7 (the emitted
  app's tsc among them) · M13 the Done arm's order swapped — 2 · M14 the unread-hook prune removed — 1 · M15 a read while
  nothing fires Do allowed — 3
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §59.4 What building it found

1. 🔴 **The text-sink fold's NINTH by-hand instance.** The first build rendered `{hash}` bare and `{hashError ?? ''}` folded
   on the same page — `crypto-out` compiled, rendered, and silently did not fold, exactly as the whitelist's own comment warns
   (`id-out` was the eighth). React shows `undefined` as nothing either way; a format interpolating the digest would print the
   text "undefined". One line; pinned (A7, F1); an arm (M11).
2. 🔴 **The chain compiler asks first.** I predicted *"its Done output is consumed as a value — a pulse carries nothing to read"*
   for `nonce.done → Text.text`; the export said *"its done output drives no translatable action"* — `doneChainOf` reached the
   wire before any read did. §52.4's rule, applied: `compileCryptoCall` now reads the sink's port kind BEFORE compiling the
   chains, as `appErrorPlanOf` does. Pinned (D6); an arm (M8).
3. ⚠️ **The attach pass names an untranslatable trigger before the read can.** I predicted *"its Do is never fired by a
   translatable trigger"* for a Do wired from a Delay nothing starts; the export said *"trigger idle.finished is not a rendered
   element event or a receiver"*. The predicted sentence is the COMPILED-but-unattached case (a Do fired from a Value Changed
   nothing feeds — D9b). Both pinned; the design note's sentence was right about the kind and wrong about which pass speaks.
4. ⚠️ **A node is refused once, with the first read's sentence.** Digest and Error both read with nothing wired to Do: the
   Digest sentence names the node; the Error read is dropped under the existing disposition with the step-5 note. My row
   asserted both sentences; the second exists only when the Error is the only read (D8, D8b).
5. ⚠️ **A Variable feeding an input is read in the handler as `.get()`**, not as the render local I predicted (`plaintextValue`).
   The live read is the more faithful one — the setter's stored value at the click — and it is why a `Set Variable` earlier in
   the same chain needs no snapshot rewrite for it (F2, F3).
6. ⚠️ **A Set Variable's own Done is not a chain this exporter owns** (`state-set` has no `then`): the first F3 hung the Hash
   off `setPlain.done` and the attach pass refused the trigger. Pre-existing; the row hangs both off the nonce's Done.
7. ⚠️ **My SHA-256("é") vector was wrong** — written from memory. The row now computes it with node's own `createHash` as the
   second instrument and keeps a UTF-16 control that must differ (B4). *Pin the runtime's answer, never a remembered one.*
8. ⚠️ `Value Changed`'s input port is `value`, not `input` — read the catalog, not the display name (E7's first cut).

### §59.5 What this leaves (owner NONE unless named)

- **A Digest / Value / Error read from a SIBLING handler before the attach pass is refused with *"its Do is never fired by a
  translatable trigger"* even when Do is fired by a button** — `attachedCryptoNodes` fills in the attach pass, which runs after
  every sink has compiled, and `compiledOf` memoises the refusal. Inherited from `rowIsReadable` verbatim (the id nodes have the
  same hole; the files family keeps rows for a wired-but-unattached node instead). Owner NONE. Named in the ledger's floor comment.
- **A crypto row allocated by the sweep's diagnostic read** (a Digest wired only into an unbindable logic sink) is still written
  by the action and printed — a `useState` nobody reads. The viewport hook prunes for this case (D14); the rows do not. The id
  nodes share it. Owner NONE.
- **Two `Do` pulses in one tick** are coalesced by `scheduleAfterInputsHaveUpdated` into one digest that answers both tokens;
  the export computes once per pulse. Recorded, not translated.
- **`UUID`'s Failure arm does not raise** (`id-new` is not in `RAISING_ACTION_KINDS`) while its runtime reports `uuid/failed`
  through `reportOutcome` — §54's rule says it should. Found reading the analogue; not this row's. Owner NONE.
- **`String(algorithm)`**: the runtime passes the stored value to `digest` raw; the lib stringifies. Identical for every string;
  differs only for a non-string object over a wire, which fails in both with possibly different messages. Recorded.
- The runtime's SSR guard on Screen Resolution is not transcribed (a Vite SPA has no server render); outputs typed `number`.
- The two crypto verbs and the viewport hook are **not driven** in a built app (the orchestrator runs drives after merging). The
  libs are graded under node against the real WebCrypto (§B, 13 rows) and a fake window (§C, 4 rows).
