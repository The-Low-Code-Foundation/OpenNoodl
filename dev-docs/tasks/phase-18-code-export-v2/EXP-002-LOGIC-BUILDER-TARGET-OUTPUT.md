# EXP-002 Logic Builder (Visual Function) — the target output (session 19)

**Status: paper design, no production code.** Read §1 before writing any of it: the handoff's
premise about this node is wrong, and the runtime source says so in as many words.

The short version. A Visual Function is **a third script host, not a structured-JSON program**.
Its ports come from the Blockly workspace (`detectIO`); its *body* is `generatedCode`, the
editor's JavaScript projection, and that is the only thing the runtime ever compiles. So the
translation is EXP-003's re-hosting, reusing session 14's machinery — with one addition that is
the whole value of this design: because the body is **generated from a closed block vocabulary**,
the export may trust its idioms in a way it can never trust hand-written JavaScript. That is what
lets `Noodl.Variables["x"]` bind to the export's existing variables store instead of deferring.

---

## §1 What the runtime actually does (`logic-builder.ts`, `logic-builder-io.ts` — read first)

🔴 **The handoff said "the program is structured JSON ⇒ generate from it deterministically".
It is not what runs.** `_compileFunction` reads `_internal.generatedCode` and does
`new Function(…, code)`. The workspace is never compiled anywhere in the runtime — the file says
so directly: *"The workspace itself is never compiled here: turning blocks into code needs
Blockly, which only the editor has."* Generating our own code from the workspace would be a
**rewrite** requiring a second Blockly generator in the export, and it would be the export's
opinion about the blocks rather than the program the app actually runs.

This is the fourth time in this phase that reading the runtime source first *was* the finding
(Switch-is-a-latch, Component Object, Model2's `_forEachModel`, now this).

The facts that shape the design:

1. **Two parameters, two jobs.** `workspace` decides the **port set** (`detectIO` — the single
   source of truth, called by both the editor and the runtime); `generatedCode` is the
   **program**. Neither substitutes for the other: code only mentions the ports it *uses*, so it
   cannot see a declared-but-unused port and cannot tell a signal from a value.
2. **The node only ever runs from a signal.** `run`, or any block-declared signal input. Values
   arriving on inputs are stored and run nothing (`set` says *"Don't auto-execute"*). So unlike
   `Function`, there is **no reactive-derived (A1) mode at all** — every Visual Function is
   session 14's **A2h handler-inline** shape. This is a simplification, not a restriction.
3. **The compiled function takes eleven positional parameters, and order is the contract**:
   `Inputs, Outputs, Noodl, Variables, Objects, Arrays, sendSignalOnOutput, __triggerSignal__,
   __p, __s, console`.
4. **`__p` / `__s` are debug probes and are identity when nobody is watching** — the runtime
   passes `IDENTITY_VALUE_PROBE` / `NOOP_STATEMENT_PROBE` on every un-inspected run. The editor
   emits them around every value block and before every statement *always*; there is no debug
   build. An exported app is never inspected, so they are always identity there.
5. **Signal outputs go through `sendSignalOnOutput("name")`**, a bare call to parameter 7 — not
   through `Outputs.x()` as on `Function`. Author names are registered **verbatim**, not
   `out-`-prefixed, which is why `RESERVED_OUTPUTS` exists.
6. **Hats do not gate.** `HAT_BLOCK_TYPE`'s generator returns `''`, and `NoodlGenerators.ts:116`
   records gating on `__triggerSignal__` as *future* work. So a workspace with five hats
   concatenates all five bodies and runs **every** one on **every** trigger. The corpus contains
   exactly this (§2, body #1) and the faithful translation must reproduce it.
7. **`Outputs` writes land after the run, all at once**, then `success`, then `done`. A write to
   a reserved name fails the whole run *after* the landable outputs have landed.
8. **No blocks is `Unchanged`, not failure**; code that will not compile is `Failure` with
   `logic-builder/code-not-compiled`. These are different states and the source is emphatic
   about it.

### 1.1 The generated idiom set is closed, and literal-keyed

This is the fact the design turns on. `NoodlGenerators.ts` emits, for the whole Noodl block
family:

| block | generated text |
|---|---|
| `noodl_get_input` | `Inputs["<literal>"]` |
| `noodl_set_output` | `Outputs["<literal>"] = <expr>;` |
| `noodl_send_signal` | `sendSignalOnOutput("<literal>");` |
| `noodl_get_variable` | `Noodl.Variables["<literal>"]` |
| `noodl_set_variable` | `Noodl.Variables["<literal>"] = <expr>;` |
| `noodl_get_object` | `Noodl.Objects[<expr>]` ← **not** literal |
| hats, all four `Define …` | `''` |

Every port and variable name is a **literal from a field**, never an expression. That is why a
Visual Function body can be reasoned about where a hand-written `Function` body cannot.

---

## §2 The corpus (measured — `lb-survey.ts`, `lb-emit.ts`, this session's scratchpad)

**14 Logic Builder instances across the deduped 40-project list, in 4 projects.** That is the
number the ranking reports, and on its own it overstates the slice three ways. Deduped by node
identity there are **6 distinct nodes** and **4 distinct `generatedCode` bodies**; three of the
projects (`fix016-msg6-drive`, `fix016-s50-drive`, `cn027-drive`) are near-clones carrying the
same four nodes.

| node | ×  | program | host emits? | wired in | outputs consumed by |
|---|---|---|---|---|---|
| `App::182f94d3` | 3 | **none** | ✅ `App.tsx` | `run ← String.changed` | — |
| `Components/CategoryCard::e32cad11` | 3 | **none** | ✅ `CategoryCard.tsx` | — | — |
| `Components/Header::c2758017` | 3 | body #1 | ✅ `Header.tsx` | `run ← Button.onClick` | `result → Group.variant` |
| `Components/ProductCard::69e69869` | 3 | body #2 | ✅ `ProductCard.tsx` | `currentPrice ← Component Inputs.price` | — |
| `Components/PriceDiscount::71972f2b` | 1 | body #3 | ❌ **none** | — | — |
| `tut003 Pages/Home::check_entry` | 1 | body #4 | ✅ `Home.tsx` | `entry ← onTextChanged`, `run ← onClick` | `ok`, `title` → `NewDbModelProperties`; `message` → `Text.text`; `bad` → `TextInput.focus` |

🔴 **Six of the fourteen instances have no program at all** — `parameters: []`, confirmed on
disk, not inferred from a possibly-broken accessor (the other eight *do* report parameters, so
the reading has a known-firing signal beside it — [[assert-an-absence-with-a-known-firing-signal-beside-it]]).
Two of the six are not even wired. They are freshly-dropped nodes: the runtime answers
`Unchanged` and does nothing.

🔴 **`PriceDiscount`'s host component emits no file** — *"no visual root — logic-only components
defer to EXP-003"*. Translating that node changes nothing that exists.

The four bodies, and what each actually is:

- **#1 (`Header`, ×3)** — five hats concatenated. Assigns `Outputs["result"]` four times, the
  last one `null`, and sets `Noodl.Variables["myVariable"]`/`["test1"]` to `null`. Its consumed
  wire `result → Group.variant` therefore delivers **`null`, always**. Junk, but live junk.
- **#2 (`ProductCard`, ×3)** — reads `Inputs["currentPrice"]`, calls a generated
  `subsequenceFromStartLast` helper that does `sequence.slice(…)` on it, writes
  `Outputs["result"]`. `currentPrice` is wired from a numeric `price`, so **this body throws**
  (`.slice` is not a function on a number) → `logic-builder/blocks-threw`. It also declares an
  output `discountedPrice` it never writes. **No output is consumed by anything.**
- **#3 (`PriceDiscount`, ×1)** — `console.log(Math.tan(Noodl.Config["test1"] …))`. Nothing
  wired, host does not emit.
- **#4 (`tut003 check_entry`, ×1)** — **the only program that does real work.** A guarded branch:
  empty input → `message` + `sendSignalOnOutput("bad")`; otherwise write
  `Noodl.Variables["lastEntryTitle"]`, read it back into `Outputs["title"]`, clear `message`,
  `sendSignalOnOutput("ok")`.

Two more measured facts:

- **Bodies #1–#3 carry `__p`/`__s` probes; body #4 does not.** It predates LGC-003. Both shapes
  are real and the design must accept both.
- 🔴 **No `Variable` node anywhere in `tut003` declares `lastEntryTitle`.** The block program
  mints it. The export's variables registry is built from `Variable2` nodes, and
  `variableNameOf` returns `undefined` for a name it does not hold — so a block-minted variable
  would silently fail to resolve. See §3.4.

---

## §3 The design

### 3.1 The port set comes from `detectIO`, never from mining the body

The export imports `detectIO` from `@noodl/runtime` — the same function the runtime and editor
both call. Mining `generatedCode` for `Inputs["x"]` would miss declared-but-unused ports and
could not distinguish a signal from a value.

🔴 **This matters immediately.** `ConnectionIR.kind` reports `value` for every `check_entry`
output wire, including `ok` and `bad`, because parse cannot see across into a runtime-discovered
port set — the contract says as much (*"'value' when it cannot be determined statically"*).
`detectIO` says `signalOutputs: [ok, bad]`. **The plan must consult `detectIO`, not the wire
kind**, or two signal chains get compiled as value bindings. This is the Component Outputs trap
(session 10) in a new costume.

### 3.2 The body is re-hosted verbatim in an A2h wrapper

Per node, one local function in the owning component:

```tsx
// Visual Function "Check the entry" — check_entry
// Re-hosted verbatim from the block editor's generated projection. Do not hand-edit:
// the blocks are the source, this is their output.
const runCheckEntry = (entry: string) => {
  const Inputs = { entry };
  const Outputs: { title?: string; message?: string } = {};
  const fired: string[] = [];
  const sendSignalOnOutput = (name: string) => { fired.push(name); };
  const Noodl = { Variables: variables };        // §3.4 — the facade, not a rewrite
  const __p = <T,>(_id: string, v: T): T => v;   // §3.3
  const __s = (_id: string): void => {};
  const __triggerSignal__ = 'run';

  /* ---- generated body, verbatim ---- */
  if (!Inputs["entry"]) {
    Outputs["message"] = 'Type something first, then press Log it.';
    sendSignalOnOutput("bad");
  } else {
    Noodl.Variables["lastEntryTitle"] = Inputs["entry"];
    Outputs["title"] = Noodl.Variables["lastEntryTitle"];
    Outputs["message"] = '';
    sendSignalOnOutput("ok");
  }
  /* ---- end generated body ---- */

  return { Outputs, fired };
};
```

The caller — the `onClick` handler that the `run` wire becomes — lands the outputs on their
sinks in `Outputs`-then-signals order (§1.7), then runs each fired signal's chain:

```tsx
onClick={() => {
  const { Outputs, fired } = runCheckEntry(entry);
  if (Outputs.message !== undefined) setStatusMessage(Outputs.message);
  for (const name of fired) { if (name === 'bad') { /* … */ } }
}}
```

Body text is **verbatim, never reindented** — session 14's rule, and the reason the goldens
protect the later AST refactor.

### 3.3 `__p` / `__s` are supplied as shims, not stripped

Both are declared unconditionally in the wrapper as identity/no-op, exactly as the runtime passes
them on an un-inspected run. A body that never mentions them pays two unused locals.

**The rejected alternative was stripping them**, and it is worth saying why: `__p("id", expr)`
calls **nest** (body #2 nests three deep), so no regex removes them safely, and doing it properly
means parsing — which is precisely the AST work this phase has deferred. Shimming is
correct-by-construction today and stripping becomes a readability pass once ts-morph lands.
Recorded in §6 as a divergence in *legibility*, not in behaviour.

### 3.4 `Noodl.Variables` binds to the existing variables store — the design's one real move

Session 14's gate defers any body matching `\bNoodl\s*[.\[]` — *"reads the Noodl API — the
runtime-coupled tier"*. That gate is **right for hand-written `Function` bodies**, where
`Noodl.Variables[x]` can be keyed by anything, and **wrong for generated ones**, where §1.1
guarantees the key is a literal from a block field.

So the export does not rewrite `Noodl.Variables["x"]` into a `store-set`. It **supplies a real
`Noodl.Variables`** backed by `src/stores/variables.ts`, and the verbatim body keeps working:

```tsx
const Noodl = { Variables: variables };
```

This is better than a rewrite on every axis that matters here — the body stays verbatim, reads
and writes keep their exact runtime meaning and ordering, and there is no chain-local snapshot
question to get wrong.

🔴 **A block-minted variable must be admitted to the registry.** `tut003` proves the case: no
`Variable2` node declares `lastEntryTitle`, so today `variableNameOf` answers `undefined` and
the binding would vanish. The plan pass must walk each admitted workspace's `noodl_get_variable`
/ `noodl_set_variable` fields and mint a `VariablePlan` for each name not already registered,
typed from the assigned expression where statically known and `unknown` otherwise — the mirror
of Static Data's derived row type. Names are read **from the workspace fields**, not from the
generated text.

### 3.5 Empty programs translate to nothing

No `generatedCode` ⇒ no wrapper, no call, no state. The `run` wire is consumed and noted. This is
the faithful translation of `Unchanged`, and it is what six of the fourteen instances get.

---

## §4 The gates (any hit ⇒ the node defers, reason named)

The gate is **on the workspace's block-type set**, not on regexes over the generated text. That
is decidable, it reads the same source of truth `detectIO` does, and it is what licenses §3.4.
A body whose workspace is entirely within the admitted vocabulary reaches only the idioms §1.1
lists.

1. **An unknown block type** — any type not in the admitted set ⇒ defer, naming the type. This is
   the default-closed direction, and it is how the gate stays honest as the block library grows.
2. **`noodl_get_config` / the app-config block** ⇒ *"reads Noodl.Config — the export has no
   app-config vocabulary"*. (Body #3.)
3. **The library-global and window blocks** ⇒ *"reaches a browser/library global"*.
4. **`noodl_get_object` / object and array blocks** ⇒ *"reads the Noodl Objects/Arrays model
   store — the runtime-coupled tier (EXP-003 Tier B)"*. Their keys are expressions (§1.1), so the
   literal-key argument does not cover them.
5. **`generatedCode` absent while `workspace` is non-empty**, or vice versa ⇒ defer. The two must
   agree; a workspace with no projection is an editor that never flushed.
6. **The body does not compile**, under `new Function` with the eleven parameters, or compiles
   only sloppy ⇒ defer with the compiler's own message (session 14's rule; the emitted module is
   strict TS).
7. **A reserved-name write** — the body assigns `Outputs["error"|"success"|"failure"|"done"|
   "unchanged"|"completed"]` or sends one as a signal ⇒ defer. The runtime *fails the run* on
   this (§1.7); reproducing that faithfully is not worth a slice.
8. **A consumed `success`/`done`/`failure`/`error` output** ⇒ defer. These are the outcome
   contract, and sequencing on them is the invocation tier.
9. **Anything session 14's `MARKER_GATES` already refuse** (clock, randomness, network, timers,
   `async`/`await`, `this`) — kept, because a `myblocks` definition can inline arbitrary
   generated helpers, and because the marker scan is cheap insurance behind gate 1.

Gates 2–4 are the ones the corpus actually exercises.

---

## §5 What this is worth — measured, and the ruling

This is the section the Model2 document established, and it applies again.

**Under the existing session-14 purity gate, unchanged (blind re-host):** bodies #1, #3 and #4
all read `Noodl.*` and defer. Only body #2 passes.

- flips: 6 empty + 3 `ProductCard` = **9 of 14**
- user-visible behaviour change in any emitted app: **none.** `ProductCard`'s outputs are
  consumed by nothing, and the body throws if it runs.

**Under this design (block-vocabulary gate + the `Variables` facade):**

- flips: 6 empty + 3 `ProductCard` + 3 `Header` + 1 `check_entry` = **13 of 14**; `PriceDiscount`
  defers on gate 2 and its host emits nothing regardless.
- user-visible behaviour change: **`tut003`'s status message renders**, and `Header`'s
  `result → variant` starts delivering the `null` it delivers in the interpreter. That is the
  honest total.

🔴 **`check_entry` may still count `deferred` under the Component Outputs precedent.** Two of its
four outputs (`ok`, `title`) land on `NewDbModelProperties`, a deferred type — and the standing
rule is *"mixed outputs node counts `deferred` while its good ports keep firing"*. So the audit
number may show **10 of 14**, not 13, while the app behaves better than before. Judge this slice
by what runs, not by the tally — session 18's lesson, arriving from the other direction.

**Ruling: build it, and build the block-aware version — but do not sell it on the coverage
number.** The justification is product, not percentage: Visual Function is the beginner's logic
surface (LGC-001 named the test user who wanted exactly this), and an export that silently drops
every Visual Function is a bad answer to *"can I take my app with me"*. The coverage delta is
~9–13 nodes on a 4,441-node denominator — **about +0.2%**, and mostly on junk. The blind re-host
is not worth building on its own: it is nearly the same work for none of the behaviour.

**Two findings for whoever picks the next slice.** `NewDbModelProperties` (8 nodes, 7 projects —
the widest-spread deferred type in the corpus, and more projects than any other) is what blocks
`check_entry`'s useful half; it is worth a look before EXP-003 Tier B. And the ranking instrument
still counts **population, not translatable population** — this session is the third consecutive
one to have to correct for that by hand ([[a-recommendation-carries-a-measurement-of-some-property-not-the-right-one]]).
`m2-rank.ts` should grow a "distinct nodes / distinct bodies / hosts that emit" column so the
next reader does not re-derive it.

---

## §6 Recorded divergences (the standing register)

- **Probe shims are kept in the emitted source.** Identity by construction, so behaviour is
  identical; the cost is legibility, retired by the ts-morph pass (§3.3).
- **Hats do not gate, and the export reproduces that.** If the runtime later gates bodies on
  `__triggerSignal__` (NoodlGenerators.ts:116 anticipates it), every multi-hat translation
  changes meaning with it. The wrapper already binds `__triggerSignal__` to the triggering port
  name, so the change is one gate, not a redesign.
- **`Outputs` land as a batch, then signals fire** — matching the runtime's ordering, not the
  order statements appear in the body.
- **A run that throws is not reproduced as a `Failure` pulse.** The re-host throws where the
  runtime throws, but the export has no outcome-contract vocabulary; a node whose failure
  channels are consumed defers instead (gate 8).
- **`error` is not emitted.** No consumer in the corpus; consuming it defers the node.

---

## §7 Fixture & test plan (the EXP-002 discipline)

- Fixture on the live Cheer project, MCP-authored, snapshot re-copied: a `Components/EntryCheck`
  carrying a Visual Function with **a declared value input, two value outputs, two signal
  outputs, a `Noodl.Variables` round-trip, and a branch** — i.e. body #4's shape, which is the
  only corpus program worth pinning. Plus a second, empty Visual Function to pin §3.5.
- Golden: the whole component, byte-for-byte, so the verbatim-body rule is enforced by the test
  rather than by intention.
- Gate tests: one per §4 rule, each asserting the **named reason**, not just the deferral.
- A `detectIO`-vs-wire-kind test that fails if the plan reads `ConnectionIR.kind` for a signal
  output (§3.1) — the trap is invisible otherwise, because the wire kind is plausible.
- 🔴 **Dump the emitted artefact** after wiring `generatedCode` as a source. Both parameters are
  `kind: 'literal'` here (verified — `logic-builder-workspace` and `logic-builder-hidden` are not
  `codeeditor` editor types, so `literalParam` *does* answer for them). That is the opposite of
  Static Data's trap, which is exactly why it must be re-verified against the artefact rather
  than assumed in either direction.
- Ledger: flip `Logic Builder` → `translated` **in the same commit** as the slice, with the
  deferred vocabulary named in the note. The gate certifies a lie otherwise.
- Drive: `tut003-log-a-thing-solution` is the real-world case — a jsdom drive proving that typing
  nothing and pressing the button shows the guard message, and that typing something clears it.
