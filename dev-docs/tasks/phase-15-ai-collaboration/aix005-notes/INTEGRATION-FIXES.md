# AIX-005 — the three integration defects, fixed

The defects are the ones `EXAMPLE-AND-DOCS.md` §6.1, §6.2 and §6.3 reported: found by
wiring all fifteen nodes together as one working example, none of them a bug in any single
agent's work. This file says what changed, why that fix and not the alternatives, and what
is still unverified.

Base: `cline-dev` @ `860c38d`. The worktree was created **556 commits behind** (at
`360cdc4`, the same "Added Contribution markdown file" commit every other AIX-005 worktree
started from) and was `git reset --hard cline-dev` before any work. Fifth worktree in a row.

---

## 1. `[object Object]` on the advertised streaming wiring (§6.1)

### What was wrong

`SSE.data` runs every payload through `parseJsonOrText`, which is right: an agent stream
mixes JSON frames with bare text, and a `data` output that went `undefined` on `[DONE]`
would be useless. But it means `data` is an **object** for the commonest real shape,
`data: {"delta":"Hi"}` — and `TextAccumulator.chunk` did `String(value)`, so the wiring
recommended by the enrichment's `patterns[0]`, by the `agent-sse-chat-stream` catalog
example, by `AGENTIC-UI.md` and by the example project rendered `[object Object]` once per
token. Nothing looked broken from the inside; the live run never caught it because the mock
endpoint speaks plain text.

### The fix: three parts, and only together

**1. A `text` output and a `textPath` input on `net.noodl.SSE`.** `text` is the one data
output guaranteed to be a string: the payload as sent when `textPath` is blank, or the field
at that dot path (`choices.0.delta.content`) when it is set. `splitPath` / `valueAtPath` /
`textForPath` are pure functions in `stream-parsers.ts`, AGENT-007's home for exactly this
kind of thing, unit-tested there.

**2. `TextAccumulator` refuses a non-text chunk.** Strings, numbers, booleans and bigints are
accepted; an object, an array, a function or a Date is refused, nothing is appended, and a
new `error` output names both what arrived and which port should have been wired instead. The
node also raises an editor warning (`text-accumulator-chunk-not-text`).

**3. Every place that recommended `data → chunk` now recommends `text → chunk`** — see §4.

### Why not the alternatives

- **"Add a `text` output that is always the unparsed data field" (the ~5-line suggestion in
  §6.1) is already `raw`.** Duplicating it would not help: for a JSON stream, `raw → chunk`
  renders a run of JSON fragments instead of an answer. The trap is not "no string output
  exists", it is "the string output holds an envelope". Extraction is the missing piece, so
  `text` does extraction, and `raw` keeps its exact meaning.
- **Documentation alone was rejected.** §6.1 chose it and the docs still said it, but the
  *headline* wiring of the whole task then requires a Function node whose body is
  `Outputs.Text = Inputs.Data?.choices?.[0]?.delta?.content ?? ''`. For a family whose
  premise is that a non-programmer can build an agent UI, the first five minutes cannot need
  optional chaining.
- **Silently `String(object)` was not an option either way** — it is the failure mode this
  whole family exists to prevent.
- **Making `chunk` guess** (pick the first string field, JSON-parse and hope) was rejected:
  it turns a legible mis-wiring into an intermittent one.
- **`data` was left exactly as it is.** It is correct for the nodes that want structure — the
  JSON Stream Parser, and the Action Dispatcher's `action` input, which is how the example's
  Tools page is wired. Changing `data` would have broken those.

### The bonus the path buys

With `textPath` set, a payload that is not JSON — the `[DONE]` sentinel every OpenAI-style
stream ends with — resolves to `''`, and an empty chunk is already a no-op everywhere in this
family. The old `data → chunk` wiring appended `[DONE]` to the end of the answer on any
endpoint that sends one. Nobody had noticed that either; the mock did not send one. It does
now, on the new route.

---

## 2. Object-typed inputs had no editor (§6.2)

### What was wrong

`net.noodl.GlobalStore.initialState`, `net.noodl.SSE.headers` and
`net.noodl.StateSnapshot.snapshotData` are `type: 'object'`. `viewClassForPort` in
`propertyeditor/DataTypes/Ports.ts` had no `object` branch, returned `undefined`, and
`_getPorts` **filtered the row out entirely** — a connection-only port with nothing on screen
saying why.

### The fix, which turned out to be three lines in three packages

1. **`Ports.ts`** — `isOfObjectType()` → `CodeEditorType`, immediately after `isOfArrayType()`
   and returning the same view class. The `array` precedent, not a new affordance.
2. **`nodedefinition.ts`** — `'object'` added to `typesToSaveInInput`. This is the part that
   is not obvious: the code editor stores **what was typed, as a string**, and
   `setInputValue`'s coercion only runs if the port's type survived onto the instance's input
   record. That list had `['color', 'textStyle', 'array']`, so an object port's type was
   discarded and the coercion could never fire.
3. **`node.ts`** — the existing `array` string→literal `eval` extended to `object`, with the
   same editor warning on failure. **Object literals must be parenthesised**: `eval('{a:1}')`
   returns `1` (a block containing a labelled statement) and `eval('{a:1,b:2}')` throws. That
   one is a live trap and has a spec of its own.

The editor half alone would have been worse than the defect: a row you can type into that
does nothing. The report called this "an editor change, not a runtime one" — that is the one
thing in it that was wrong.

`getValidationType()` deliberately keeps `expression`, not `json`: `{ Authorization: 'Bearer
x' }` is a good object literal and JSON validation would flag the unquoted key.

### What else becomes editable — the whole list

**Static ports**, enumerated from the generated catalog (all 154 types across
`noodl-runtime`, `noodl-viewer-react` and `noodl-viewer-cloud`), not from a grep:

| Type | Port | Now editable? |
|---|---|---|
| `net.noodl.GlobalStore` | `initialState` | yes — the point |
| `net.noodl.SSE` | `headers` | yes — the point |
| `net.noodl.StateSnapshot` | `snapshotData` | yes — the point |
| `noodl.cloud.sendemail` | `variables` | **no** — `allowConnectionsOnly: true`, which `_getPorts` checks independently of `viewClassForPort`. It has a spec. |

There is no fifth *static* one. Every other `object` in the three runtime packages is an
**output** (`HTTP.responseHeaders`, the BYOB nodes' `firstRecord` / `error`,
`GlobalStore.state`, `StateSnapshot.snapshot`), a commented-out port, or something else
entirely (module metadata, the AI assistant's JSON Schemas, Blockly's type dropdowns).

**Dynamic ports were the part the catalog could not tell me**, and there are three sources.
Found by reading the port-building code, after the catalog said there was nothing:

1. **BYOB Create Record / Update Record** map a Directus `json` or `array` column to
   `type: 'object'` (`byob-utils.js` `getEnhancedFieldType`). Those rows used to be filtered
   out, so a JSON column could only be *wired*; they now edit as a literal. **This one needed
   a fix and got one**: the runtime registers those dynamic inputs with no type
   (`registerInput(name, { set })`), so `setInputValue`'s coercion cannot fire and the typed
   text would have been sent to Directus as a string — a `json` column holding
   `"{\"a\":1}"` instead of `{a:1}`. `ByobUtils.normalizeValue` now parses JSON text for
   `json` / `array` columns, which is the one funnel both write nodes share and the only place
   with the field schema to hand. Text that does not parse is passed through untouched, since
   a json column may legitimately hold a string. Four specs in `byob-utils.test.js`.
2. **The Script / Function node's port-type dropdown offers Object** (`javascript.ts`
   `_inputTypeEnums`). An object-typed script input now edits as a literal and the script
   receives **the string that was typed** — because those dynamic inputs are also registered
   without a type. That is not new behaviour introduced here: `array` is in the same dropdown
   and has behaved exactly this way for years (editable, delivers text). Left alone
   deliberately — passing the declared type through `registerInput` would fix both, but it
   changes a very widely used node's behaviour on the `array` path, and no live editor was
   available to check it. Documented here rather than half-fixed.
3. **The Component Object / Set Component Object Properties type dropdown** offers Object
   too, with the same registration shape and therefore the same string-passthrough.

So the blast radius is: the three ports the defect names; the BYOB JSON columns (improved,
and the double-encoding closed); Script and Component Object properties an author explicitly
declared as Object (editable now, value arrives as text, exactly as `array` already did); and
any object-typed input a third-party module declares.

One further knock-on: the node library already declares a `string → object` typecast, so a
*connection* from a string output into an object port was always allowed and used to deliver
an unparsed string that the node ignored. On a port whose type reaches the instance — the
three AIX-005 ones — it now parses, and reports a literal that does not. That is the typecast
finally meaning something, and it is louder rather than quieter, but it is a behaviour change
on a path nothing in this repository uses.

---

## 3. Built-in store actions read only the envelope (§6.3)

`SET_STORE` / `DELETE_STORE_KEY` read `action.key` / `action.value`, `MERGE_STORE` read
`action.values`, while a handler's `payload` output resolves `payload → data → the whole
object`. So `{"type":"SET_STORE","payload":{"key":"title","value":"x"}}` — the shape a server
author writes first, and the shape a *handler* would have received — was refused as
`invalid`.

`builtInFieldOf(action, field)` is now the single resolution rule: **envelope first, then
`payloadOf(action)` when that is a plain record.** Both `checkBuiltIn` and `runBuiltIn` call
it, so validation and execution cannot disagree about what an action said — the reason it is
a pure function rather than state carried on the queue entry.

Every security property is unchanged, and each has a spec that drives it *through a payload*:

- the vocabulary is still closed (`builtIns`, empty by default);
- `storeName` is still ignored wherever it appears — it is deliberately **not** in the field
  list, so `payload.storeName` is as powerless as `action.storeName`;
- `allowedKeys` still gates a key, and every key of a merge;
- `CLEAR_STORE` is still refused outright under an allow-list.

Presence, not truthiness, so `{"payload":{"key":"count","value":0}}` writes `0`. The envelope
wins on a collision, which is what makes this strictly additive: every message that worked
before resolves to exactly the same fields.

**One shape deliberately refused:** `{"type":"MERGE_STORE","payload":{"a":1,"b":2}}`, a bare
key/value map. `payload.values` and payload-as-values are indistinguishable when a store key
is itself called `values`, and a dispatcher that guesses about which keys a server may write
is the kind of thing this node was rewritten to avoid. The refusal says *"MERGE_STORE
requires a `values` object"*, which names the fix.

---

## 4. Everything that had to move with it

Consistency was the explicit requirement, so this is the full list rather than a summary:

| File | Change |
|---|---|
| `docs/node-catalog/enrichment/net.noodl.sse.json` | `textPath` + `text` port docs; `patterns[0]` rewritten around `text`; a pattern saying what `data` *is* for; two new anti-patterns; `data`'s own doc now warns |
| `docs/node-catalog/enrichment/net.noodl.actiondispatcher.json` | a pattern spelling out both accepted built-in shapes. Its `data → action` pattern is *correct* and stays: the dispatcher is the node that wants the parsed object. |
| `docs/node-catalog/enrichment/net.noodl.textaccumulator.json` | `chunk` no longer claims non-strings are stringified; `error` documented; `patterns[0]`; a new anti-pattern |
| `docs/node-catalog/examples/agent-sse-chat-stream.json` | `data → chunk` becomes `text → chunk`; `textPath: choices.0.delta.content` on the node; description explains the choice |
| `docs/runtime/AGENTIC-UI.md` | new "Which data output to wire" section (the three-output table, `textPath` recipes, the WebSocket equivalent); Text Accumulator bullet; the `initialState` blockquote now describes the literal editor; the dispatcher's payload paragraph; the object-port entry deleted from *Current limits*; the live-endpoint limit now names what the mock does cover |
| `project-examples/agent-chat/project.json` | Chat page's `data → chunk` connection becomes `text → chunk` |
| `project-examples/agent-chat/mock-agent-server.mjs` | new `POST /chat/stream-json` (OpenAI-shaped deltas + `[DONE]`); a seventh action envelope using the payload form; header/index/comment updates |
| `project-examples/agent-chat/README.md` | the new route, seven envelopes not six, the `Text`-not-`Data` wiring, the `initialState` note |
| `packages/noodl-runtime/src/nodes/std-library/data/byob-utils.js` | `normalizeValue` parses JSON text for `json` / `array` columns — the knock-on of defect 2 described in §2 |
| `packages/noodl-types/src/node-catalog*.json` | regenerated via `catalog:generate` + `catalog:merge`, never hand-edited. Diff is exactly three new ports. |

Port assertions updated in the same commit as the ports, as required: `agent-sse-node.test.ts`
(`textPath`, `text`) and `agent-stream-nodes.test.ts` (`error`).

---

## 5. Verification

All five required gates, plus the two that were worth running:

| Gate | Before | After |
|---|---|---|
| `npx jest` in `packages/noodl-runtime` | 891 passed, 5 skipped | **927 passed, 7 skipped**, 35 suites |
| `npx tsc --noEmit` in `packages/noodl-runtime` | clean | **clean** |
| `npm run catalog:check` | up to date | **154 types, up to date** |
| `npm run catalog:merge:check` | 154/154 | **154/154 documented, 49 examples** |
| `npm run catalog:examples` | 49/49 | **49/49 strict, warnings-as-errors** |
| `npm run catalog:validate -- project-examples/agent-chat` | 0 failures | **262 nodes, 222 endpoints, 0 failures** |
| `npm run test:ci` in `packages/noodl-editor` | — | **the `nodegraph` suite: 80 specs, 0 failures**, including both new property-editor specs (confirmed by name in the runner output). See the caveat below. |

**The full editor suite cannot run in a worktree**, and this is worth recording because the
next agent will hit it. `npm run test:ci` builds and boots fine, then the Git specs hang: they
shell out to dugite at `<worktree>/packages/node_modules/dugite/git/bin/git`, which does not
exist because the worktree has no installed dependencies of its own. The runner's 900 s
watchdog fires having run 12 specs, so nothing after `./git` in `tests/index.ts` is reached —
the property-editor specs among them. To verify them, `tests/index.ts` was temporarily reduced
to `export * from './nodegraph'` only, the suite run twice (once to see the count, once
grepping for the two spec names), and the file **restored** — `git status` on it is clean.
Same family as the recorded "lerna exec runs the main checkout, not the worktree" trap.

The counts moved for three reasons: 36 new specs across five files, one new suite
(`node-literal-inputs.test.ts`), and **the opt-in live suite grew from 5 specs to 7**, which is
why the *skipped* number is 7 and not 5. That is the one number that differs from the stated
baseline, and it is deliberate — see below.

**The live suite was run, and it is the interesting one.** The two extra specs are defect 1
against a real wire, and the dispatcher spec now proves defect 3 against a real stream:

```sh
node project-examples/agent-chat/mock-agent-server.mjs 4831 5
cd packages/noodl-runtime
NODEGX_AGENT_LIVE=http://localhost:4831 npx jest test/agent-live-endpoint --forceExit
```

**7/7 passing.** What it showed:

| Case | Observed |
|---|---|
| OpenAI-shaped stream, `textPath` set | 170 events, `data` really was `object` for the token frames, 490 characters accumulated, code fence and newlines intact, no `[DONE]`, no `choices`, no `[object Object]`, accumulator `error` empty |
| The old wiring (`data → chunk`) on that same stream | 167 frames refused, accumulated is `[DONE]` and nothing else, first error names the object and the `Text` output. The failure is now legible instead of plausible. |
| Dispatcher fed by a real action stream | `completedCount` **3** (was 2): the envelope form, the payload form, and the handler. `refusedCount` 4, the same four reasons. `title` ends as the payload form's value; `messages` still never created. |
| The plain-text route | unchanged, 486→490 characters, now driven from `text` |

Note the last line of the mis-wiring case: the accumulator's `error` is *empty* at the end of
that stream, because the final `[DONE]` is text and clears it. That is intended — an error
that never clears is a worse defect — and the spec watches the stream rather than its end.

---

## 6. What is **not** verified

Be sceptical of all of this.

1. **No live editor check, at all.** Another session held the editor for the whole of this
   work, exactly as during §8 of `EXAMPLE-AND-DOCS.md`, so nothing here was looked at in a
   running app. **The object-typed property row has never been seen on screen.** What is
   proved is that `viewClassForPort` returns the same class as for `array` (an editor spec that
   was run), that `_getPorts` still filters the connections-only one (ditto), and that a string
   typed into an object port reaches the node as an object (eight runtime specs). What is *not*
   proved is that the row looks right, that the popout opens and sizes as it should, or that
   saving from the popout round-trips through the project file. Someone should open the example
   project, click *Initial State* on the App page's Global Store node, and type an object.
2. **The example project still has never been opened or run.** The `text → chunk` connection
   was edited in the JSON and validated by `catalog:validate`; no canvas, no preview.
3. **`/chat/stream-json` has been driven by the runtime's own nodes through Node's `fetch`,
   not by a browser.** No browser has connected to it, and the project's Chat page still
   points at the plain route — switching it is a two-field edit in the property panel, which
   is exactly the manual check worth doing.
4. **Still not run against a real provider.** The OpenAI *shape* is now exercised; a real
   OpenAI/Anthropic endpoint, with real auth and real cross-origin, is not.
5. **`textPath` on a stream whose payload is a JSON array at the top level** (`data: [{...}]`)
   works by the path rules (`0.delta.content`) but has no spec.
6. **The editor warning raised by the accumulator has been observed in a test double, not in
   the editor.** The call matches the convention `dbcollectionnode2.js` and `expression.js`
   use, and it is guarded on `context.editorConnection` + `nodeScope.componentOwner`, so the
   worst case is that it does not appear rather than that it throws.
7. **Nothing about performance.** `textForPath` runs per event and walks a path of two to four
   segments; nobody measured it.
8. **The `object` coercion's blast radius is argued from the generated catalog plus a read of
   the three dynamic-port sources** (§2), not from a running editor. A project that loads a
   third-party module declaring an object-typed input will see that port become editable; that
   is the intent, but it has not been tried with a real module.
9. **No BYOB backend was involved.** The `normalizeValue` change is unit-tested and no Directus
   instance was written to. A JSON column set from the property panel has not been round-tripped
   against a real backend.
10. **The Script node and Component Object cases in §2 are reasoned, not observed.** The
    conclusion "editable, and the script receives the typed text" comes from reading
    `registerInputIfNeeded`; nobody typed an object literal into a Script node's Object input.

---

## 7. Left alone deliberately

- **§6.4 (`refusedType` is `''` for a malformed action)** — correct as designed; an action
  with no type has no type to report. The docs already say to wire `refusalReason` too.
- **§6.5 (a duplicate node id passes both validators)** — real, and worth fixing, but it lives
  in `scripts/node-catalog/validate-project.js` and the SUB-006 `SemanticValidator`, both
  shared files with concurrent sessions against them. Not in this task's scope and not worth
  a merge conflict.
- **§6.6 (Repeater items become process-global Models)** — how Noodl has always worked; not an
  AIX-005 seam.
- **The WebSocket node did not get `textPath`/`text`.** Its data ports are already named
  differently (`received` / `receivedRaw`), the pinned "these two nodes read alike" assertion
  is about the *lifecycle* ports, and `receivedRaw` is a guaranteed string, so the
  `[object Object]` trap does not exist there in the same way. `AGENTIC-UI.md` now says what
  to wire on a socket carrying JSON envelopes. If someone finds themselves writing the same
  Function node twice, the symmetric addition is about fifteen lines.
