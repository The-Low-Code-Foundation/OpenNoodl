## §58 Tier 2.8 row 8 — the streaming trio: `JSON Stream Parser`, `Stream Buffer`, `Text Accumulator`, hosted the way AGENT-007 runs them (session 85, 2026-09-05)

The eighth row of §50's list, three picker nodes in one section. Type ids `net.noodl.JSONStreamParser`,
`net.noodl.StreamBuffer`, `net.noodl.TextAccumulator` (the display names drop the `net.noodl.` and space the
words; the ledger keys on the ids). All three are `inNodePicker`, not deprecated, `availableIn: browser` —
`picker-coverage.js` counts each, so the floor moves **98 → 101**.

### §58.0 What the three nodes are, and what that decides

**The runtime** (`noodl-runtime/src/nodes/std-library/agent/`): three `_internal` state machines over
`stream-parsers.ts`'s pure functions, each with the outcome contract (`outcomeOutputs`: `done`, `unchanged`,
`failure`, `completed`) beside its own value-level signals. None spreads `outcomeInputs`, so there is no
`Treat Unchanged as` port. Read off the files, not the docs:

- **JSON Stream Parser** (`json-stream-parser.ts`). `chunk` is retained by its setter (`undefined`/`null` → `''`,
  else `String(value)`); `Parse` appends it and runs one of three framings over the whole pending buffer —
  `ndjson` (`splitDelimited` on `\n`, blank lines skipped, a line that will not parse is an error and the
  stream goes on), `single` (`scanJsonValues` without array framing, the first complete value only), else
  `stream` (`scanJsonValues` with array framing: top-level `[`, `]`, `,` are punctuation). The scanner
  tracks strings and escapes and brace depth, so a boundary inside a string, inside an escape, or inside a
  number waits (`12` at the end of a buffer might become `123`). Order per `Parse`: nothing pending →
  `Unchanged`; over `Max Pending` → buffer cleared, `Error`/`Error Count`, then `Failure` (`Is Complete` is
  NOT touched on that branch — transcribed as is); else `Is Complete`/`Pending Characters`, then the values
  (`Parsed` = the last, `Values` = this parse's, `Value Count` cumulative), one `Error` per bad value (the
  last message wins, the count grows by all), `Success` only if a value came out, then `Failure` iff this
  parse added errors (with `Error`'s text) else `Done`, then `Completed`. `Clear` resets everything and
  fires `Cleared`, then `Done` if there was anything (pending text, values, errors or a count) else
  `Unchanged`. `format`'s setter is `(value) || 'ndjson'` and an unknown name falls to the `stream` branch.
- **Stream Buffer** (`stream-buffer.ts`). `data` is retained and **marks arrival** (`hasPendingData`, set by
  the setter and never cleared). `Add` with nothing ever delivered is `Failure` (`stream-buffer/no-data`,
  `Error` set); else push, `Max Size` overflow drops the oldest (`Dropped Items`, `Overflowed`), then a
  `Flush Size` reached hands the token to the flush; else the interval timer is armed and `Done`. `Flush`:
  the timer stopped; an empty buffer is `Unchanged` (no `Flushed`); else `Flushed Data` = the buffer (a fresh
  array each time), `Flush Count`, `Flushed`, `Done`. The timer's own flush owns no token — `Flushed` only.
  `Flush Interval`'s setter re-arms on change (stop; arm iff the buffer is non-empty). `Clear` stops the
  timer, resets, `Cleared`, then `Done`/`Unchanged` by what there was — read before the reset. `Max Size`
  coerces `>= 0`, the other two `> 0`, else 0. Deletion stops the timer.
- **Text Accumulator** (`text-accumulator.ts`). The `chunk` setter accepts text and the primitives that read
  as text (`number`/`boolean`/`bigint` → `String`), blanks `undefined`/`null`, and **refuses** anything else
  at delivery: `Error` set to `describeBadChunk`'s sentence, `Failure` pulsed and `text-accumulator/chunk-not-text`
  raised — once per distinct message (`isRepeat`), the pulse before the raise. A text chunk clears `Error`.
  `Add` with an empty chunk is `Unchanged` (keep-alive frames; also the path after a refused chunk); else
  append, `truncateHead` to `Max Length` (`Dropped Characters`, `Overflowed`), `splitDelimited` on the
  delimiter (empty delimiter: no boundaries), messages appended and capped to `Max Messages` (`Dropped
  Messages`, `Overflowed`), `Message Received` once per Add that completed any, `Changed`, `Done`. `Clear`
  as the buffer's, `Error` counting as something to clear.

**The port set is the one on disk** — none of the three declares dynamic ports; the catalog rows are the
runtime's port maps and are what `plan.ts` reads. Every wire into a port the node has not got, and every
read of one, is refused by name.

**What the export does with them.** Each node is a hook over one `_internal`, in §52/§53/§54's shape:
`src/lib/streaming.ts` transcribes `stream-parsers.ts`'s cores (`splitDelimited`, `scanJsonValues`,
`tryParseJson`, `truncateHead`, `utf8ByteLength`, `describeError`) and the three machines as **pure
functions over a state object returning the ordered event list** (`parserParse(state)`, `bufferAdd(state)`,
`accumulatorAdd(state)`, …: every signal, raise and timer instruction the runtime would issue, in the
runtime's order), and three hooks over them — `useJsonStreamParser(source, options, listeners)`,
`useStreamBuffer(…)`, `useTextAccumulator(…)` — that keep the state in a ref, deliver the events (a signal
→ the listener, a raise → `raiseAppError` with the node's provenance, arm/stop → the one timer), and bump a
reducer so the host re-renders. The handle's value outputs are **live getters** over the state, so a chain
fired by a signal reads what the runtime's getter answers at that moment, and a Text bound to one re-renders
after the invocation. Value inputs: the data port (`Chunk`/`Data`) is **read at the pulse**, `runtasks-run`'s
rule — the action carries the wired expression (or the authored literal), snapped per chain, and the hook's
`parse(chunk)`/`add(data)` runs the setter then the action; with no source at all the call takes no argument
and the setter never ran (the parser and accumulator then see `''`; the buffer sees `hasPendingData` false and
fails, as the runtime does). Config ports are read live off an options object the hook re-reads every
render (§54's Filter) — absent means the `initialize` value, present means the setter's coercion — and the
buffer's interval change re-arms the timer in an effect, as the setter does at delivery.

**Refused by name** — every sentence predicted here, then pinned in §58.4:
- a logic-only component: *component emits no file to host the JSON Stream Parser* (or the node's display name);
- *its `<port>` input is not a port this node has* · *its `<port>` output is consumed, and this node has no such port*;
- *two wires feed its `<Port>` input — last-writer-wins is not statically ordered* (any value input);
- a value input with no static source: *its `<Port>` input is fed by `<type>` — `<the feeder's own reason, or>` no statically known source in the emit vocabulary*;
- a value input fed by a text input's live text: *its `<Port>` input reads a value that only exists inside a handler*;
- a signal output wired into a value port: *its `<port>` output is consumed as a value — a pulse carries nothing to read*, decided from the sink's port kind before the chain compiles (§52.4);
- a listener chain this slice cannot compile: `doneChainOf`'s own sentences; a chain reading handler-only values: *its `<port>` chain reads values that only exist inside a handler*.
Nothing else is refused: the three nodes' every port translates. A node nothing fires and nothing reads is
still hosted (Script's and the boundary's rule — the runtime instance exists and holds its defaults); its
listener chains are compiled and never fire, as the runtime's never would.

**Recorded divergences** (in the lib's header): the setters run at the pulse with the value the render or the
chain holds rather than at delivery — so the accumulator's refused-chunk `Failure` fires at the `Add` that
carries it, not the moment the wire delivers it, and once per distinct message either way; a wired `Data`
counts as arrived whether or not its source has published (the runtime's `hasPendingData` is per delivery);
`flagOutputDirty` collapses into one re-render per invocation (the chains read live getters, so nothing they
see moves).

### §58.1 What is emitted

- **`src/emit/streamingLib.ts`** (new) → `src/lib/streaming.ts`, shipped when any component keeps one of the three;
  it imports `./errors`, so `errors.ts` ships with it (the `emitApp` rule, fifth member). Exports: the cores
  (`splitDelimited`, `scanJsonValues`, `tryParseJson`, `truncateHead`, `utf8ByteLength`, `describeError`); per node a
  state factory (`createParserState` = `initialize()`), an options applier (the setters, keyed on presence), the data
  setter, and the actions as pure functions returning `StreamEvent[]` (`parserParse`/`parserClear`,
  `bufferAdd`/`bufferFlush(state, owned)`/`bufferClear`, `accumulatorSetChunk`/`accumulatorAdd`/`accumulatorClear`);
  the three hooks. `bufferFlush`'s `owned` is the token: the interval timer's flush owns none, so it reports no outcome.
- **plan.ts**: `STREAM_PARSER_TYPE` / `STREAM_BUFFER_TYPE` / `TEXT_ACCUMULATOR_TYPE`, the `STREAM_NODES` table (the
  catalog's port set per node: data port, config ports, action verbs, signals in declaration order, value fields with
  their declared-type cast and their maybe-undefined answer — §A's last row pins it against the catalog); `ValueExpr`
  gains `stream-out`, `HandlerAction` gains `stream-action` (`value` read at the pulse, `runtasks-run`'s rule, snapped
  per chain); `StreamPlan` on `ComponentPlan.streams`; `streamPlanOf` in `scriptPlanOf`'s shape (memoised, `refuse`
  unwinds the plan and the compiled sinks), `streamReadOf`, `compileStreamAction`; `isTriggerWire`; the `compileSink`
  dispatch; the trigger-compile loop; `OWN_CHAIN_OUTPUTS` (so the attach pass skips a listener wire whatever its file
  order); the registration pass beside Script's; the binding whitelist; the seven expression/action switches; both
  walkers, `scanActions` and `fillMaterialize`; `bailAsLogicOnly`'s sentence; `streamFieldMaybeUndefined` exported.
- **component.ts**: the flag, `allActions`, `collectActionUse`, `maybeUndefined`, `exprCode` (`<local>.<field>`
  both modes), the deps walk, `chainReadsChainLocal`, `actionCode` (`<local>.<verb>(<data>)`), `actionExprsOf`, the
  import (the hooks the plan kept, sorted), the config reads through `hookExprSources`, the binding table by declared
  type (an `array` port `JSON.stringify` at text; a `*` port §10's `String(x ?? '')`; number/boolean `String()`; a
  string bare; a number sink takes a number bare and refuses the rest; a boolean sink coerces `!!`), the hook lines
  after the boundaries, the gate, the return.
- **emitApp.ts**: the lib, and `errors.ts` when it ships. **Ledger**: three rows `translated`, floor **98 → 101**,
  one sentence on the floor comment. **Moved rows**: the six floor pins (`filter-records`, `script`, `animation-pair`,
  `object-store`, `on-app-error`, `run-tasks`).

### §58.2 The fixture — `tests/fixtures/stream-desk`

`Pages/Home`: a `chunk` Variable written by two Load buttons (`{"id":1,"name":"A` and `da"}\n{"id":2,"name":"Bob"}\n` —
a document split mid-string across the two) into a JSON Stream Parser (`format: ndjson`) with Parse and Clear buttons;
a `token` Variable written the same way (`Hello, wor` / `ld|Bye|`) into a Text Accumulator (`delimiter: |`) with an
Add button; a String constant `tick` into a Stream Buffer (`maxSize: 3`) with Push and Flush buttons. Every value
output is bound to a Text; `success` / `messageReceived` / `flushed` each write a `status` Variable shown in a Text.
46 nodes, 35 wires. Load and Parse are **separate clicks on purpose**: a `Set Variable` compiles with no Done chain, and
a set-and-parse pair off one click is exactly the shape whose runtime order cannot be read from source (the pulse is
queued at the click, the Variable's delivery is queued when the setter runs) — the export would print
`chunk.set(…); parser.parse(chunk.get())` and read the fresh value, and whether the runtime parses the old chunk is a
question for a drive, registered in §58.5 rather than baked into a fixture.

Emitted (`Home.tsx`): one import of the three hooks; three hook lines with the node's provenance, its authored config
and its listener inline; `parser.parse(chunk.get())`, `acc.add(token.get())`, `buffer.add('tick')`, the bare verbs;
`{JSON.stringify(parser.values)}`, `{String(parser.valueCount)}`, `{parser.error}`, … . 15 files, both libs, no
refusal, no verdict; the emitted app typechecks as a real `ts.Program` with 0 diagnostics.

### §58.3 The gates

```
packages/nodegx-export: tsc --noEmit 0 · streaming-trio.test.ts 59/59 · export-ledger:check OK (176 types, 108 translated)
picker 101/127 (79.5%), floor 98 → 101, --check exit 0
jest, the whole package, once, alone (1-min load 4.95): 69 files (69 on disk) 2323 rows, exit 0 (was 68 / 2233)
the nine moved or joined specs, one at a time, all green: filter-records 34, script 74, animation-pair 57, object-store 35,
  on-app-error 41, run-tasks 67, emitted-syntax 62, exported-readme 169, in-code-markers 54
emitted apps typecheck (real ts.Program): the fixture, the wired-config variant, the Data-less variant, the `Parsed`/truthy
  variant — 0 diagnostics; a CONTROL row proves the checker reddens on a getter the handle has not got
arms 13/13 red, all restored (md5 identical after each; mut-summary.txt):
  M1b the scanner forgets escapes in an object string — 1 · M2 Success on every Parse — 3 · M3b Completed before the outcome — 20
  M3c the raise AFTER the failure pulse — 4 · M4b the timer's flush reports an outcome — 2 · M5b a repeated bad chunk fires again — 1
  M6b a changed interval never re-arms — 2 · M7 the Chunk setter no longer clears on null — 2 · M8b a pulse read as a value
  is no longer decided before the chain — 1 (the first cut, `sinkKind === 'never'`, was a COMPILER kill — "Tests: 0 total" — and
  was re-cut at the value level, §55's rule) · M9 the data no longer read at the pulse — 3 · M10 an array port loses its JSON
  cast — 1 · M11 two wires no longer refused — 1 · M12 streaming.ts ships without errors.ts — 8
  (five lib arms were first written as multi-line anchors and cut NOTHING — the emitter is a quoted-line array, one string per
  source line, so a `\n` anchor cannot match; recorded, re-cut as single quoted lines)
```

### §58.4 What building it found

1. 🔴 **"Retained between pulses" is a behaviour, and my rows wanted the opposite.** Three §E rows expected a bare
   `parse()` / `add()` to be `Unchanged`; the transcription re-appended the last chunk, which is exactly what the
   port description says ("a second Add with no new chunk appends it again"). The rows now pin the re-append, and
   `parse(null)` — the setter's empty chunk — for the `Unchanged` path.
2. 🔴 **The scanner consumes the whitespace before an unterminated scalar.** `single` over `{"a":1} trailing` leaves
   `rest = 'trailing'`, not `' trailing'`: the skip loop runs before `scanOneValue`, and `rest` starts where the value
   would. The runtime's answer is pinned, not mine (Pending Characters 8, not 9).
3. ⚠️ **`Clear` resets `Flush Count`** — a row expected the count to survive a Clear. It does not (`clearBuffer`).
4. ⚠️ **The reverted-arm prediction put the wrong sentence on the wrong node**: I predicted "feeds X.chunk, which has
   no static binding" on the Variable-fed *wires*; it landed on the *constant node* (`tickConst`, "its savedValue read
   feeds net.noodl.StreamBuffer.data …") and the Variable wires took the generic step-5 note — a wire has no
   disposition to carry a sentence, a node does.
5. ⚠️ **A text input's live text into Chunk takes the feeder-named fallback** ("its Chunk input is fed by
   net.noodl.controls.textinput — no statically known source in the emit vocabulary"), not the precise "only exists
   inside a handler": §54.4.2's seam again — the node registers in the early trigger loop before the controlled-state
   seam mints the input's row. Pinned as it is; residual below.
6. 🔴 **The declared type, not the value, decides the cast** (`outputproperty.ts`, NDA-014): an `array` port takes
   the JSON cast at a text sink and a `*` port does not — so `Values` prints `JSON.stringify(…)` and `Parsed` prints
   §10's `String(x ?? '')`, and a parsed *object* on `Parsed` renders `[object Object]` in the export exactly as the
   runtime's Text node renders it. Read off the runtime, not preferred.
7. ⚠️ **A boundary's wired Filter is never walked by `hookExprSources`** (found while wiring my config reads): §54's
   "wired Filter from a Variable" row passes because a Text already binds that Variable and mints the `useValue`
   local; a Filter wired from a Variable nothing else reads would print a bare name. Not this row's; registered below.
8. ⚠️ **`PIPESTATUS` is bash; this shell is zsh.** The first `tsc` gate printed an empty exit — an empty error list is
   not a pass. Re-run unpiped, read the status (0).

### §58.5 What this leaves (owner NONE unless named)

- **The one-click set-then-parse order** (§58.2): the export reads the fresh Variable in the same handler; whether the
  runtime's input queue parses the previous chunk is a drive question. If it does, the export is *more* right than the
  runtime and the difference should be recorded as such; if it does not, nothing to do. Owner NONE (a drive).
- A value input fed by a **text input's live text** refuses with the fallback sentence — §54.7's seam, third family
  (boundary Filter, Script input, streaming data/config). The controlled-state row would host all three. Owner NONE.
- **A boundary's wired Filter is not walked by `hookExprSources`** (§58.4.7) — a latent §54 hole with no fixture that
  reaches it. One line beside the Run Tasks walk. Owner P18.
- **The transports** (`Server-Sent Events`, `WebSocket`, `Subscribe To Changes`, Tier 3.11) are what feed these nodes
  in a real app; until they translate, every stream-desk chunk arrives from a Variable or a constant. The hooks'
  `parse(chunk)` / `add(data)` shape is what a transport's `onMessage` chain would call. Owner: Tier 3.11.
- The accumulator's refused-chunk **`Failure` fires at the `Add` that carries the chunk**, not at delivery (recorded
  divergence, §58.0). A transport delivering into Chunk without an Add would make the difference observable; today
  nothing does. Owner NONE.
- A wired **`Data` counts as arrived** even if its source never published; the runtime's `hasPendingData` is per
  delivery. Observable only with a source that can be unset, which no fixture wires. Owner NONE.
- `flagOutputDirty` collapses into one re-render per invocation; the listener chains read live getters so nothing they
  see moves — a chain that fires a Set Variable read by a Text sees the same frame either way. Owner NONE.
- Not driven: the exported app in a browser, the editor's picker badge and pre-flight over stream-desk (the
  orchestrator's gates). The lib's behaviour is graded under the hook harness with fake timers (§D/§E).
