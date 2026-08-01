# Node Library Audit — First-Pass Findings

**Created:** 2026-07-28
**Status:** evidence gathered, not yet remediated. Every claim below carries a file:line citation.
**Scope of this pass:** the four systemic defect classes, plus the eight nodes Richard named by hand.
The remaining per-node work is tracked in [`NODE-REGISTER.md`](./NODE-REGISTER.md).

---

## How this pass was done

The catalog at [`packages/noodl-types/src/node-catalog.json`](../../../packages/noodl-types/src/node-catalog.json)
enumerates **155 nodes** with their full port schemas. That gives the audit a denominator and lets a
class of defect be counted rather than anecdotally reported. [`scripts/node-audit/register.js`](../../../scripts/node-audit/register.js)
derives the machine-checkable smells; everything else here came from reading the implementations.

The headline numbers, all reproducible:

| Measure | Count | Share |
|---|---|---|
| Catalogued nodes | 155 | — |
| Ports across all nodes | 2,650 | — |
| **Ports carrying a description** | 142 | **5%** |
| **Nodes where *no* port is documented** | 112 | **72%** |
| Nodes with a signal input + signal outputs but **no failure/error output** | 50 | 32% |
| Nodes with a signal input and **no signal output at all** | 10 | 6% |
| Deprecated nodes | 23 | 15% |
| Deprecated **but still in the node picker** | 4 | — |
| Nodes with no docs URL | 14 | 9% |

---

## Defect class A — the reactivity contract is not a contract

This is the one Richard described as cutting across everything, and it is the most valuable finding
in the pass, because it explains failures in Object, Array, Variable, Repeater and every Cloud Data
node at once. It is **not** one bug. It is three separate layers that each decided independently what
"changed" means.

### A1 — `Model` is correct. The collection is not.

[`model.ts:314-339`](../../../packages/noodl-runtime/src/model.ts#L314-L339) is well-behaved:
`set` notifies whenever `oldValue !== value`, which correctly includes a transition *to* `null`,
and it offers `forceChange` and `silent` escape hatches. Nothing needs fixing here.

The collection is a different story. `Collection` is not a class — it is a set of properties patched
onto `Array.prototype` ([`collection.ts:63-235`](../../../packages/noodl-runtime/src/collection.ts#L63-L235)).
Exactly five operations notify:

| Notifies | Silent |
|---|---|
| `add`, `addAtIndex`, `remove`, `removeAtIndex`, `set` | `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `arr[i] = x`, `arr.length = 0` |

And then [`collection.ts:63-71`](../../../packages/noodl-runtime/src/collection.ts#L63-L71) hands the
raw array straight out:

```js
Object.defineProperty(Array.prototype, "items", {
  get(this: PatchedArray) { return this; },
```

`items` **is** the array. So the moment any user code — a Function node, a workflow step, an exported
module — reaches for `.items`, or simply treats the collection as the array it genuinely is, every
mutation from that point on is invisible to the `on('change')` listeners that fourteen nodes rely on
(`collectionnode2.ts:187`, `filtercollectionnode.ts:243`, `mapcollectionnode.ts:136`,
`dbcollectionnode2.ts:339`, `options.ts:62`, and others).

**This is exactly the reported symptom**: "using a JS node and `Noodl.Array` to add something doesn't
trigger the change signal". It is not intermittent and it is not mysterious — `push` was never wired
up. The rule an author actually has to internalise today is *"only the five verbs notify, and nothing
tells you which five"*, which is not a rule anyone can be expected to hold.

A second, quieter problem in the same file: `notify` is `async` and `await`s each listener
([`collection.ts:171-179`](../../../packages/noodl-runtime/src/collection.ts#L171-L179)), and so are
`add`/`remove`. A synchronous-looking `arr.add(x)` therefore settles a turn later than the caller
expects, and a listener that throws rejects a promise nobody holds.

### A2 — `undefined` and `null` are conflated, inconsistently, at four different layers

Richard's second symptom — "if the value was not null and then becomes null, that doesn't register,
and the old value is stuck" — is a defect *class*, not a single guard. Different layers guard on
different things:

| Layer | Guard | Effect |
|---|---|---|
| [`node.ts:426`](../../../packages/noodl-runtime/src/node.ts#L426) | `if (outputValue !== undefined)` | on connect, an undefined upstream value never seeds the input |
| [`modelcrudbase.ts:308`](../../../packages/noodl-runtime/src/nodes/std-library/data/modelcrudbase.ts#L308) | `if (value !== undefined)` | Set Object Properties silently skips the key rather than clearing it |
| [`collectionnode2.ts:112`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode2.ts#L112) | `if (value === undefined) return;` | the Array node ignores the write entirely |
| [`string.ts:24`](../../../packages/noodl-runtime/src/nodes/std-library/variables/string.ts#L24) | `String(value)` | a String variable fed `null` stores the **literal text `"null"`** |

That last one deserves calling out on its own. `cast: String` means `null` becomes `"null"` and
`undefined` becomes `"undefined"` — four and nine characters of visible garbage in the UI, and both
are truthy, so every downstream `Condition` takes the wrong branch. `Number`'s cast is no better:
`Number(null)` is `0` (indistinguishable from a real zero) and `Number(undefined)` is `NaN` (which
fails `!==` against itself, so [`variablebase.ts:98`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L98)
reports `changed` on *every* set once a NaN lands).

**There is no defined semantics for "empty" anywhere in the runtime.** That is the actual defect. The
fix is not to patch four guards — it is to decide what `null` means (clear the value), what
`undefined` means (no opinion, leave it alone), write it down, and make all four layers obey it.

### A3 — `Variable` swallows the first change, `States` can swallow any of them

[`variablebase.ts:96-106`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L96-L106)
only fires `changed` when `currentValue !== value`, which is right — but `initialize` seeds
`currentValue` with `startValue`, so a Variable that is *set* to its start value fires nothing, and
an author wiring "set to 0 then react" gets silence.

`States` is worse, and it is the direct cause of "sometimes triggering a state change using the state
value input doesn't trigger the state change output":

```ts
// states.ts:416-428
scheduleGoToState: function (this: StatesInstance, state: string) {
  this._internal.goToState = state;
  if (this.hasScheduledGoToState) return;   // <-- coalesces
  ...
}
// states.ts:430-434
goToState: function (this: StatesInstance, state?: string) {
  if (internal.state === state) return;      // <-- and then discards
```

State changes inside one update pass are **coalesced to the last one**. Go `A → B → A` within a
frame and `goToState` is called once with `A`; `internal.state` is already `A`; it returns; **no
signal fires at all**, and no `stateChanged`, and no `reached-A`. The intermediate `B` never happened
as far as anything downstream is concerned. There is additionally a deliberate first-transition
swallow at [`states.ts:407-412`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L407-L412)
(`valuesAreInitialised`), which is defensible on its own but compounds the impression of randomness.

---

## Defect class B — 32% of action nodes cannot report failure

Fifty nodes take a signal input, emit signal outputs, and have no `Failure`/`Error` output among
them. Ten more take a signal input and emit **no** signal at all — `Send Event`, `Repeater`,
`Function`, `Logic Builder`, `Close Popup`, `Pop Component Stack`, `Navigate To Path`, `Unique Id`,
`External Link`, `Response`. Nothing downstream can sequence off "that finished", let alone "that
failed".

This is the structural reason behind Richard's "no information when it fucks up". It is not a
missing log line; the node has nowhere to *put* the information. Where a node does detect a problem
it usually routes to `editorConnection.sendWarning`, which is **editor-only** — it does not exist in
a deployed app, in cloud runtime, or in export.

### B-i — a write that reported success and went nowhere (2026-07-30)

`Set Parent Component Object Properties` is the worst instance of class B found so far, and it is
not a silence. `setparentcomponentobjectproperties.ts` walked up for an ancestor owning a Component
Object and returned `undefined` when there was none. The shared base at
`componentutils/base.ts` passed that straight into `Model.get`, and `Model.get(undefined)` is the
**anonymous tier** (`packages/noodl-runtime/src/model.ts:205-212`): it mints a fresh, unnamed record
on every call, which nothing else in the graph can reach and nothing holds a reference to.

So the node wrote every wired property into a throwaway and emitted `Done`. Every other class-B
defect in this phase made a working node look broken. This one made a broken node look like it
worked, which is the one thing the Failure Contract says a completion signal must never do.

Generalised into the Binding Contract: **a walk that can return nothing must never hand that nothing
to a create-on-read lookup.** The miss has to be a branch, not a value.

### B-ii — the Video node's two invisible failures (2026-07-30)

`HTMLMediaElement.play()` returns a promise, and `Video.tsx` dropped it at all three call sites
(`play`, `restart`, and the deferred play in `onCanPlay`). Under the browsers' autoplay policy a
`Play` on a page the user has not yet interacted with rejects with `NotAllowedError` and nothing
happens: no warning, no signal, no console line. This is almost certainly the most-hit single defect
in the phase, because it fires on every autoplaying video in every deployed app.

The register's triage predicted that one from the node's category. Reading the file found a second
it could not have: the `<video>` element's **`error` event had no listener at all**. A 404 source or
an undecodable one never fires `canplay`, so a `Play` sets `wantToPlay` and waits for ever — exactly
as if nobody had pressed it. `Image` has had an `On Error` port all along; `Video` never got one.

The third finding is the one that constrains the fix: `AbortError` — `play()` superseded by a
`pause()` or a new `src` — rejects on a graph that is working exactly as written. It is deliberately
**not** reported, and `SILENT_PLAY_REJECTIONS` in `Video.tsx` is where that decision lives.

### B-iii — the Expression node's failure value is plausible (2026-07-30)

Both of Expression's failure modes returned **`0`** and said nothing outside the editor.

That value is the finding. Every other class-B defect makes a working node look broken, which at
least *looks* wrong. `0` looks fine: `Is False` fires, `Is True` does not, and every downstream
branch takes exactly the path a legitimate zero would have sent it down. "Your expression is broken"
and "your expression evaluated to zero" were the same observable.

The compile path was additionally misreporting itself. `_compileFunction` caught the syntax error,
logged it to the console and returned `undefined`; `_calculateExpression` then called `.apply` on
that `undefined`, and the resulting `TypeError` landed in its own catch. So the single diagnosis
that reached a deployed runtime was *"Cannot read properties of undefined (reading 'apply')"* — the
runtime's own bug, not the author's. The real syntax error existed only in `evalCompileWarnings`,
which routes through `sendWarning` and is therefore editor-only.

Worth carrying forward: **when auditing a silent failure, ask what value it falls back to.** A
fallback that is indistinguishable from a legitimate result is a strictly worse defect than a
fallback that is obviously wrong, and the register's `Fail?` column cannot see the difference.

### B-iv — `setError` is 22 helpers, not one (2026-07-30)

The standing note said *"`dbmodelcrudbase.setError` still uses `sendWarning` as its channel… fixing
it is one helper"*. It is **22 separate `setError` definitions across 22 files**, each with its own
copy of the same `sendWarning` call, reached from ~80 call sites:

| Area | Files |
|---|---|
| Record CRUD (`dbmodelcrudbase`, `dbmodelnode2`, `dbcollectionnode2`, `signfileurl`, `byob-subscribe`) | 5 |
| User / auth (`login`, `logout`, `signup`, `signinwith`, `resetpassword`, `requestpasswordreset`, `requestmagiclink`, `verifyemail`, `sendemailverification`, `user`, `setuserproperties`) | 11 |
| Agent (`statesnapshotnode`, `undonode`) | 2 |
| Other (`cloudfunction2`, `uploadfile`) | 2 |
| Deprecated (`dbmodelnode`, `dbcollectionnode`) | 2 |

This is the same shape as F-i, one layer down: a helper that looks shared, copied. The class-B
count in this document therefore *understates* the problem — these nodes all have `failure`/`error`
ports, so the register's `Fail?` column passes them, and every one of them still sends its
*diagnosis* to an editor-only channel.

**CLOSED 2026-07-30, and the finding above is wrong in a way worth keeping.** It counted
twenty-two `setError` *definitions* and read them as copies of one. They are not. Reading all
twenty-two:

| What `setError` actually did | Count | Which |
|---|---|---|
| `editorConnection.sendWarning` — the shape this finding describes | **14** | `dbmodelcrudbase`, the 11 user/auth, `dbmodelnode2`, deprecated `dbmodelnode` |
| **Nothing at all** — the message reached the `Error` port and stopped | **6** | `dbcollectionnode2`, `signfileurl`, `uploadfile`, `cloudfunction2`, deprecated `dbcollectionnode`, and (with a `console.warn`) `byob-subscribe` |
| Nothing, **and no `Failure` port either** | **3** of the above plus 2 | `byob-subscribe`, `statesnapshotnode`, `undonode` |

The correction matters because the second row is **worse** than the first, not a lesser version
of it. An editor-only diagnosis at least exists while an author is building; these had none
anywhere — not in a deployed app, not in a cloud function, not on the canvas. And three nodes
failed *both* clauses of the contract at once: no diagnosis and no signal, so an author could
wire the success port and had nothing whatever to sequence off a failure, only an `Error` value
to poll.

Generalised: **a count of look-alike call sites is a hypothesis about them, not a description.**
This is the fifth-lesson pattern ("five identical-looking call sites are not five instances of
one defect") applied to a *finding in this document* rather than to source — and it is the third
time in the phase that a claim in our own notes has needed re-checking the way a spec premise
does.

Landed in three commits: `dbmodelcrudbase` first, then the eleven user/auth as one batch
(`user/<operation>-failed` per node — the family code is right where seven node types share one
funnel, wrong where each node has its own and the *operation* is the distinguishing fact), then
the remaining ten. The editor keeps exactly what it had throughout, because
`createEditorWarningSubscriber` forwards to `sendWarning` with the identical
`{ showGlobally: true, message }` payload.

The trap that makes each one two changes rather than one: **the bus's editor subscriber keys its
warning by the raised `code`**, not by a key the call site picks. Any `clearWarning` still naming
the old hand-written key clears nothing, so the node accumulates a warning it can never shed. Raise
and clear have to move together, every time.

Two rows earned their place by *failing* a discrimination check:

1. Reverting only the `clearWarnings` half reddens exactly the eleven round-trip rows; reverting
   only the raise reddens the two channel rows per node and turns the round-trip rows back
   **green**. That pair is what shows the rows pin the raise/clear *pairing* rather than either
   half alone — a single revert would have looked like a pass for a test that only watched one end.
2. The `message !== undefined` guard on `statesnapshotnode`/`undonode` (where `setError(undefined)`
   is how every success path clears) survived its first control with the guard removed. `setError`
   opens with `if (this._internal.error === message) return`, so on a node that has never failed,
   `setError(undefined)` never reaches the guard at all. The reachable path is a clear that follows
   a **real** error — the moment the node starts working again — which is where an unguarded port
   would fire `Failure`. Worth generalising: **an early-return dedup at the top of a method can make
   a happy-path control unreachable**, so a control for "does this fire when it should not" has to
   drive the state the method actually gets called in.

The node passes the "does a `Failure` port fire on the happy path" test for a specific reason worth
recording, because it is the opposite of the Object node's: `registerInputIfNeeded` seeds every
discovered input to `0`, not `undefined`. There is no window in which the ports exist but hold
nothing, so this node never passes through a "values have not arrived yet" state on its way to
working. A corpus row pins that seeding, because the safety of the port depends on it.

### B-v — the Array mutators: three nodes, three different wrong answers (2026-07-30)

The register's ⏳ item 6 grouped six Array nodes and warned that the family poses the Object node's
question — is the trigger an author `Do`, or a value arriving? For the three mutators it is
unambiguously a `Do` (`add` / `remove` / `clear` are `valueChangedToTrue` on ports the editor labels
`Do`), so the port is safe. What the read found was not one defect three times:

| Node | What "nothing to act on" did |
|---|---|
| `Insert Object Into Array` | `sendWarning` and a bare `return`, both behind `if (this.context.editorConnection)` — [`collectionnode-insert.ts:66-84`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-insert.ts#L66-L84). Precise on the canvas, silent in a deployed app, a cloud function or an export, and no graph surface in any of them |
| `Remove Object From Array` | **two bare `return`s** — [`collectionnode-remove.ts:62-63`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-remove.ts#L62-L63). No warning, no signal, no console line, nowhere. Same shape as `Add`/`Remove Record Relation` in batch 1 |
| `Clear Array` | **no guard at all**: `collection.set([])` on `undefined` threw a `TypeError` out of a scheduled callback — [`collectionnode-clear.ts:40-42`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-clear.ts#L40-L42). Not silence — a crash, from a node whose Array Id had simply not been filled in |

Underneath all three sat the **false-success** shape, the one `Set Parent Component Object
Properties` was fixed for in batch 2. `setCollectionID` handed its id straight to `Collection.get`,
and `Collection.get(undefined)` is the anonymous tier ([`collection.ts:721-727`](../../../packages/noodl-runtime/src/collection.ts#L721-L727))
— a fresh, differently-named collection on every call. A missing id therefore did not leave the node
unbound, it bound the node to a throwaway: the `=== undefined` guard passed, the mutation landed,
and the node emitted **`Done`** for a write nothing in the graph could ever read. That is now the
**second** confirmed instance of the banked trap, in a different registry, which promotes it from an
anecdote to a pattern: grep any create-on-read lookup fed by a value that can be absent.

Fixed as one mixin (`collection-failure.ts`) rather than three copies, per B-iv's lesson. Verdicts:
Insert / Remove / Clear ✅; `Create New Array` 🔵 (builds its own collection, like `Create New
Object`); `Array` 🔵 (its `Id` is a value arriving, not a `Do` — the Object node's answer). `Array
Filter` is left ⏳ and is the family's genuinely mixed case: `scheduleFilter` is reached from the
`Filter`/`Refresh` signals *and* from the `enabled` setter and the collection-change callback, so a
raise there fires on the boot path. It needs the trigger distinguished first.

#### Three premises that fell, two of them mine

1. **`undefined` cannot reach an input setter over a connection.** `Node.prototype.sendValue`
   ([`node.ts:635-637`](../../../packages/noodl-runtime/src/node.ts#L635-L637)) drops it at the
   sender. The first draft of the corpus rows drove `undefined` down a wire and **two rows stayed
   green with the fix removed** — the discrimination check earning its place again. (What made it
   look reachable: `outputproperty.sendValue` does *not* filter, and that is the one I read. The
   filter is one layer up, in the method `flagOutputDirty` actually calls.)
2. **So the port's empty-value reading had to change.** The one sender that can pass `undefined` is
   a parameter reset — `NodeModel.setParameter(name, undefined)` deletes the parameter and
   `_onNodeModelParameterUpdated` queues the port default, which here is `undefined`
   ([`node.ts:871-882`](../../../packages/noodl-runtime/src/node.ts#L871-L882)). `undefined` at this
   port means exactly one thing, **an author cleared the Array Id field**, so honouring the
   contract's default "no opinion" reading would leave the node writing to an array the author had
   just removed from it — a stale target instead of a throwaway one, and no louder. Both empty
   values unbind here. Worth generalising: *the Empty-Value Contract's "undefined abstains" is a
   statement about ports a wire can feed; on a port only a parameter can empty, `undefined` is a
   deletion and abstaining is a defect.*
3. **`signalsFor` does not prove a port exists** — see the viewer corpus README. Removing the
   `failure` output reddened **nothing** until three `hasOutput` rows were added. The existing §2
   corpus files share the gap.

### B-vi — States goes to a state it does not have, and reports success (2026-07-30)

Register ⏳ item 5, predicted as "`goToState` with a name that is not in the list". Right about the
trigger, and the damage is a `0`-class defect rather than a silence one.

`goToState` never checked its argument against `internal.states`
([`states.ts:476-480`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L476-L480)
before the fix). An unknown name has no `value-<state>-<name>` parameters, so the transition timer's
`onStart` fell through to `stateValues[prefix + v] || 0` and animated **every value to 0** — zero for
numbers, black for colours. The node then wrote the bogus name to its `State` output and fired
`stateChanged`, so everything downstream was told the transition had succeeded. `reached-<state>`,
the one signal that would have looked wrong, never fired — because no such port exists for a state
that does not exist.

Ordinary to hit: `State` is an enum input, and a wire can feed an enum any string at all. A Text
Input, a Record property, or a state renamed in the editor while something upstream still spells it
the old way. Fixed with a membership check that **refuses to move** as well as reporting
(`states/unknown-state`, `detail` carrying the requested name and the real list) — moving was the
whole mechanism of the damage.

The port is safe on the happy path for `Expression`'s reason, and it is a *narrower* guard than it
looks: it fires only for a **truthy** unknown name. A falsy request is resolved to the first state
one line above, which is the boot path and what `states`'s own setter depends on. A corpus control
pins that, and reverting just the falsy resolution reddens exactly that control — the Object node's
lesson, checked rather than assumed.

### B-vii — Open File Picker: the missing outcome was never a failure (2026-07-30)

Register ⏳ item 2: *"has `success` and no counterpart; cancel and read-error are both real."* Half
right, and the half it got wrong is the useful part.

**Cancel is real and it is not a failure.** `<input type="file">` fires `cancel` when the dialog
closes with nothing chosen (Chrome 113+, Safari 16.4+, Firefox 109+) and the node had no listener, so
"the user chose a file" and "the user changed their mind" were the same observable: `Success` in one
case and, for ever, nothing in the other. Anything an author put behind `Open` — a spinner, a
disabled button, a queued upload — had no way back. But a user declining a dialog is a **legitimate
empty result**, which the Failure Contract lists among the things that must not raise; a `Failure`
there fires on a graph working exactly as written. So it is a `Cancelled` **completion** signal, and
a corpus row asserts nothing reaches the error channel on that path.

**There is no read error.** The prediction assumed one. The node never reads the file — it hands out
the `File` object and five pieces of metadata, and reading is another node's job. Recorded rather
than invented.

**There was a third failure, and it is the one that reported success wrongly.** `change` can arrive
with an empty `FileList` (a re-pick the user backed out of), and
[`openfilepicker.ts:48`](../../../packages/noodl-viewer-react/src/nodes/std-library/openfilepicker.ts#L48)
assigned `files[0]` unconditionally — discarding whatever file *had* been picked — then fired
`Success` with all five outputs reading `undefined`.

The `Failure` port it does get is for `input.click()` throwing, refused in a sandboxed frame without
`allow-modals`.

#### A correction worth more than the fix: the runtime's blanket catch

The first draft claimed an unguarded throw there "propagates out of an input setter", the shape §3
found in `Response`. The discrimination check showed that row green with the `try`/`catch` removed.
[`nodecontext.ts:220-228`](../../../packages/noodl-runtime/src/nodecontext.ts#L220-L228) wraps every
node's `update()` in a `catch` that only `console.error`s, so an exception out of any input setter is
already swallowed. What it costs is still real and worth reporting — `Node.update` rethrows to that
catch, so the rest of that node's pass (remaining queued inputs, after-update callbacks) is
abandoned, and the sole diagnosis is an unstructured console line with no code and no provenance,
invisible to `On App Error` and to every subscriber. **The blanket catch is why this class was never
noticed, not a reason it did not need reporting** — and it means "the node throws" is not by itself
evidence of a crash anywhere in this codebase.

### B-viii — the two navigation nodes: five drops, none of them the node's own line (2026-07-30)

Register ⏳ item 4, predicted as *"a target page that does not resolve; `navigate.ts` already
returns early on `_findPage` missing"*. The trigger question is unambiguous — both nodes' `Navigate`
is `valueChangedToTrue` in group `Actions` — so the port is safe. What the read found was that the
prediction named **one** drop of **five**, and that not one of them was in the file the register
pointed at. Both nodes call a handler, which calls a collaborator, which returns bare.

| Node | Where | What "could not navigate" did |
|---|---|---|
| Push Component To Stack | [`navigation-stack.tsx:790-806`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L790-L806) | three bare `return`s: no components configured, a navigation still animating, a Target Page that does not resolve |
| " | [`navigation-stack.tsx:682-698`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L682-L698) | **the same three again**, `replaceAsync`'s own copy |
| Navigate | [`router.tsx:566-570`](../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L566-L570) | two bare `return`s, the second carrying `//TODO: send error to editor, "invalid page component name"` |

Two of the five are worth naming.

**The transitioning guard is NDA-008 §3's own case, unfixed on the other side.** That task fixed
exactly this on the Pop node and described it as "the one authors actually hit, because a
double-tapped back button used to lose its second tap without trace". The push side has the
identical guard, in the same file, and was left silent — the fix followed the *node* it was scoped
to rather than the *shape* it had found. Worth generalising: **when a fix is scoped by node, check
whether the collaborator it corrected has other callers with the same need.** The evidence was
sitting three functions above the code that was edited.

**`target` is an enum input, and a wire can feed an enum any string at all.** That is B-vi's States
lesson, arriving in a second node a day later. A component renamed in the editor while something
upstream still spells it the old way stops navigating and nothing anywhere says so.

#### Where the report goes, when the outcome outlives the frame

NDA-008 §3 settled *whose* failure this is — the stack did not fail, the node that asked it to act
did, and that node owns the port and the provenance. The new part is the call shape: `back()` is
synchronous and returns a `StackBackResult`, but `navigate`/`replace` go through the stack's
`asyncQueue`, so by the time the outcome is known the caller's frame is gone. A `hasFailed`
callback beside the existing `hasNavigated` is the same decision expressed for an async call.

Its optionality is load-bearing, not politeness: a project's own JavaScript reaches both handlers
(`api/navigation.ts` → `Noodl.Navigation.navigate`) and supplies neither callback. Falling back to
raising on the *stack* would attribute a script's mistake to a node the author did not write.

#### Not fixed, and why

A Stack or Router **name** that matches nothing is *queued*, not dropped —
`NavigationHandler._performNavigation` holds it for a stack that may still mount. At the instant of
the call a typo and a not-yet-mounted stack are indistinguishable, so there is nothing honest to
raise. That is the Component Stack's own 🔵 reasoning one level out, and it is the boundary of what
this class of fix can reach.

### B-ix — the false-success shape is now three registries deep (2026-07-30)

`Set Variable` with no `Name` called `Model.set(undefined, value)`. That neither throws nor
no-ops: it writes `data[undefined]` on the shared `--ndl--global-variables` record, notifies a
change whose `name` is `undefined` so no Variable node can hear it, and fires **`Done`**.

That is the third confirmed instance, in the third registry:

| Node | Call | What it produced |
|---|---|---|
| Set Parent Component Object Properties | `Model.get(undefined)` | a fresh anonymous record per store |
| Insert / Remove / Clear Array | `Collection.get(undefined)` | a fresh anonymous collection per call |
| **Set Variable** | `Model.set(undefined, value)` | a key named `undefined` on the record every Variable node shares |

The first two were *create-on-read* lookups; this one is a **write with an absent key**, which is
a different mechanism reaching the same place. So the banked rule generalises past its original
wording: it is not only "any create-on-read lookup fed by a value that can be absent" — it is
**any keyed operation whose key can be absent, where the absent case is representable**. JavaScript
will happily make `undefined` a property name, and every node in this class then reports success.

The cheapest check for the class: ask what the *observable difference* is between the missing-input
case and the working case. If the answer is "none, from inside the node", the node cannot be
trusted to report and the guard has to be at the call site.

### B-x — three controls that proved nothing, and what they had in common (2026-07-30)

The phase's fourth lesson is "show your rows discriminate". Three separate controls written this
session were shown, by that check, to pin **nothing**, and the shape is worth naming because a
green control is more dangerous than a missing one.

1. **An early-return dedup made the guard unreachable.** `statesnapshotnode`/`undonode` open with
   `if (this._internal.error === message) return;`. A control asserting "a successful save does
   not signal `Failure`" therefore never reached the new `message !== undefined` guard on a fresh
   node, and stayed green with the guard removed. The reachable path is a clear that follows a
   **real** error — the moment the node starts working again.
2. **The scheduler was never reached.** Array Filter's boot-path control set no parameters, so
   nothing ever called `scheduleFilter` and "raises nothing at boot" was true for the wrong
   reason. It now drives two real boot paths: `enabled` as a *parameter*, whose setter runs at
   construction, and an upstream `null` arriving on `Items` — what a Query Records node sends
   before its first fetch.
3. **The node did not exist.** Filter Records' two controls asserted `signalsFor('records')` was
   empty — and `signalsFor` on an unknown id returns `[]`, so a node that failed to construct
   (its `initialize` reaches `CloudStore.instance`) made them pass vacuously. The graph builder
   now asserts the node exists before any row runs.

All three are the same failure: **a control asserting an absence, in a state where the code under
test never runs.** The rule that catches all three is to make the control prove the code *did* run
— reach the state the method is actually called in, and assert something positive alongside the
absence.

This is harness fact 1 generalised. That one said `signalsFor` cannot tell "the port fired" from
"the port does not exist"; these say a silence-assertion cannot tell "it stayed quiet" from "it
never ran".

### B-xi — a `hasOutput` top-up found a present defect, not a future one (2026-07-30)

The batch-1 and batch-2 §2 corpus files asserted on `signalsFor` and the raised code, never on
`hasOutput`. Retro-fitting those assertions was scoped as regression insurance. It found that
**Send Event has fired a `Failure` signal with no `Error` port since batch 1** — a raised code and
nothing an author can read on the canvas, which the Failure Contract names by itself: *"a bare
signal reproduces 'no information' one level up"*.

Worth carrying: **a fix reported as done is a hypothesis too.** Batch 1 recorded Send Event as ✅
because the register's `Fail?` column and the corpus rows both agreed, and both were looking at
the signal. The contract has two clauses and only one of them was checked.

## Defect class C — 95% of ports are undocumented

2,508 of 2,650 ports carry no `description`. 112 of 155 nodes have not a single documented port.

This is not a cosmetic docs gap, because three consumers read that field:

1. the property panel and connection panel, which is where an author asks "what does this do";
2. the semantic validator (SUB-006) and enrichment (SUB-005), which can only check what is described;
3. **the AI authoring loop** (AIX-002/AIX-011), where port descriptions are the primary signal the
   model has for choosing a port. 95% blank is why the model guesses.

Fourteen nodes additionally have no docs URL at all, and four deprecated nodes are still in the node
picker.

## Defect class D — string-matched contracts with no validation

`Run Tasks` is the clearest case and explains "god help you trying to get the Run or Do signal to
pass in there". The node drives its task component by *string*:

> "there is no port wiring between the template and this node, which is why the signal names
> `'Success'` and `'Failure'` are matched by string below" — [`runtasks.ts:24-28`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L24-L28)

It pulses an input literally named `'Do'` ([`runtasks.ts:234`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L234))
and listens for outputs literally named `'Success'` / `'Failure'`
([`runtasks.ts:347-351`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L347-L351)).
Name your component output `Done` and nothing happens, forever, with no warning — the four
`sendWarning` calls at `runtasks.ts:246-258` cover other conditions, not this one.

The same pattern appears in the popup nodes via dynamic `popupParam-` / `closeResult-` port prefixes
([`showpopup.ts:91-99`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L91-L99)),
and it is why the semantic validator has to skip port checks on "dynamic" nodes — the contract is
not expressible, so it cannot be checked.

---

## The eight named nodes

### 1. Columns — `net.noodl.visual.columns`

Three distinct defects, one of them a plain bug.

**The layout array is mutated in place.** [`Columns.tsx:43-47`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L43-L47):

```js
const newLayout = layout;      // not a copy
if (rowWidth.expected < rowWidth.min) {
  newLayout.pop();
}
```

`calcAutofold` then recurses on its own mutated output
([`Columns.tsx:18-27`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L18-L27)).
The only responsive behaviour the node has is *popping columns off the end* until the row fits — it
cannot reflow `1 2 1` into two rows, cannot change ratios per breakpoint, and cannot grow back
without a fresh render pass.

**There are no breakpoints.** The entire responsive API is one `layoutString` (`'1 2 1'`) plus a
single `minWidth` ([`columns.ts:40-100`](../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts#L40-L100)).
There is no way to express "3 up on desktop, 2 on tablet, 1 on mobile", which is the request every
real layout makes.

**Repeaters bypass the column layout entirely.** [`Columns.tsx:119-134`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L119-L134)
filters `ForEachComponent` *out* of `children` and renders it separately at line 154, outside the
`.column-item` wrapper that carries the width:

```jsx
{forEachComponent && forEachComponent}
{children.map((child, i) => ( <div className="column-item" style={{ width: ... }}> ))}
```

with the comment "ForEachComponent breaks the layout but is needed to send onMount/onUnmount". So
Columns + Repeater — the single most common reason to reach for Columns — produces unwrapped,
unsized children. Masonry is not merely absent; **ordinary column layout over a repeater does not
work**, and the fix for masonry has to start here.

Also worth fixing while in there: `visibility: hidden` until the first `ResizeObserver` callback
([`Columns.tsx:141`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L141))
means the node renders blank on first paint and renders blank under SSR, which is why the catalog
marks it `partial`.

### 2. Icon — `net.noodl.visual.icon`

The node itself is thin and fine ([`icon.ts`](../../../packages/noodl-viewer-react/src/nodes/visual/icon.ts),
45 lines). The problem is the shape of `Noodl.Icon`: a `{ class, code, codeAsClass }` triple that the
renderer splats into a `<span>`
([`Icon.tsx:32-38`](../../../packages/noodl-viewer-react/src/components/visual/Icon/Icon.tsx#L32-L38)).

That model assumes **icon-font semantics** — a CSS class plus a codepoint. It cannot represent an SVG
sprite, an inline SVG set, or an icon component library, which is what essentially every modern icon
set ships as. Adding a custom set therefore means getting a font *and* a stylesheet into the editor's
own document (so the picker can render it) *and* into the viewer document (so the app can), through
two different asset paths. That is the "very tricky to add custom icon sets and actually see them"
complaint, and it is a design limit rather than a bug.

Related, already-known: `IconSize` is inert at all 130 call sites in the editor UI (see the
`uix-010` note) — a separate issue in the editor chrome, not this node, but it will come up in the
same conversation.

### 3. Component Stack — `navigation-stack.tsx`

894 lines. The mode split Richard describes is real: transitions are constructed only on the stack
path ([`navigation-stack.tsx:717-765`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L717-L765)),
so "replace" has no animation surface at all. There is one thing worth correcting in the brief: I
could not find any `scrollIntoView`/`scrollTo` call in this file — the scroll-jump on switching is
therefore coming from somewhere else (browser focus restoration, the router, or a `Page` mount), and
**that needs to be reproduced live before it is specified**, or the fix will be aimed at the wrong
component. This is the one item in the eight where I have a symptom and no confirmed cause.

> **RESOLVED 2026-07-29 by NDA-008 §0 — and the caution above was worth every word.** The stack
> moves the scroll position **0 px** on a switch and calls `focus()` **0 times** (patched and
> counted, across navigate/replace/`useRoutes` on and off). The scroll is the browser focusing an
> element inside the viewer's `overflow: hidden` app root (`viewer.jsx:344-353`) — which stops the
> *user* scrolling, not the browser, so the jump is one-way and the header never comes back. The
> only DOM focus in the library is `TextInput` (`text-input.ts:211-214`). Full account in
> [`NDA-008-COMPONENT-STACK.md`](NDA-008-COMPONENT-STACK.md) §0.

### 4. Run Tasks — see defect class D above

Additionally: `sendSignalOnInput(taskComponent, 'Do')` at
[`runtasks.ts:234`](../../../packages/noodl-runtime/src/nodes/std-library/runtasks.ts#L234) reaches
into another component's scope to pulse it, which is why the setup feels like action-at-a-distance —
there is no wire to look at, so there is nothing on the canvas that explains the coupling.

### 5. Show / Close Popup

Both symptoms are structural.

**Data in and out is by dynamic string-prefixed ports.** `popupParam-*` on the way in, `closeResult-*`
on the way out ([`showpopup.ts:91-99`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L91-L99), [`showpopup.ts:140`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L140),
[`closepopup.ts:118`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L118)).
Nothing type-checks the pair, and the validator has to skip it.

**Close Popup finds its target through an injected callback, not a wire.** `_setCloseCallback`
([`closepopup.ts:64-66`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L64-L66))
is called by whatever mounted the popup; `showPopup` passes `senderNode: this.nodeScope.componentOwner`
([`showpopup.ts:78`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L78)).
So whether a given Close Popup node works depends on which component scope it happens to sit in, with
no visible indication. That is precisely "very hard to find the right place to put the close popup
node so that it actually works".

**Nothing de-duplicates shows.** `scheduleShow` coalesces within one update pass
([`showpopup.ts:63-73`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L63-L73))
but two passes, or two Show Popup nodes, stack two popups. There is no "already showing" guard and no
stack policy.

### 6. States — see A3 above

### 7. Array nodes — see A1 above

### 8. REST node — `restnode.ts`

671 lines, plus [`httpnode.ts`](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts)
at 1,078 lines covering overlapping ground. The "cute little REST custom language" is the
resource-definition string format. The audit position is straightforward: **there are now two HTTP
nodes and the newer one does not need the DSL.** The task is to confirm `httpnode` is a superset in
practice, then deprecate the REST node's DSL path rather than improve it. Note `httpnode.ts:353-462`
carries six separate `!== undefined && !== null` guards — same defect class A2, same file.

---

# Second pass — defects found outside the original eight

**Added 2026-07-29.** The first pass read only the eight nodes Richard named and swept the other 147
*structurally* (ports, signals, docs coverage). A structural sweep cannot find "works until you add a
second one", so it found none of the five defects below. Richard reported four of them from memory;
the fifth (class E) fell out while confirming the third.

Two of these generalise into new systemic classes.

## Defect class E — `object` and `array` are dead ends in the type system

This started as "there were output types on Function and Script nodes that don't work, like objects".
It is not a Function-node bug. It is the port type table.

The Function/Script node offers `object` as an output type, and the value it carries is fine. The
problem is what an `object` port is allowed to *connect to*. From the catalog's typecast table:

```
{ "from": "object", "to": [] }        ← casts to nothing
{ "from": "string", "to": [ …, "array", "object" ] }   ← but string casts INTO object
```

So an `object`-typed output connects only to an input *exactly* typed `object`. Counting those across
the whole library:

| | Count |
|---|---|
| Input ports in the library | 1,750 |
| **Input ports typed `object`** | **4** — `Global Store.initialState`, `Server-Sent Events.headers`, `State Snapshot.snapshotData`, `Send Email.variables` |
| Input ports typed `*` (wildcard) | 12 |
| Output ports typed `object` | 13 |

**An `object` output can reach four destinations in the entire product.** And because the Function
node defaults an untyped output to `*` ([`simplejavascript.ts:442`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L442),
`node.parameters['outtype-' + p.label] || '*'`), **selecting the correct type makes the port strictly
less useful than leaving it alone**. That is a UI that punishes the author for being accurate, which
is a fair description of "output types that don't work".

The same is half-true of `array`: it casts only to `collection` and back. The 13 `object` outputs
include `HTTP Request.responseHeaders`, `Query Data.firstRecord` and every `error` port on the Cloud
Data nodes — i.e. the error objects from defect class B are themselves nearly unconnectable.

Fixing this is a type-table decision, not a node fix: either `object` gains casts (to `string` via
JSON, at minimum), or `*` becomes the honest default and the enum stops offering a choice that makes
things worse.

## Defect class F — implicit nearest-ancestor resolution, with no way to target

Richard's report: "you can't target a specific component object with the Parent Component Object
node, so if you've made a couple of components that both have Component Objects in them and you nest
the components, sometimes the wrong Component Object will be updated."

Confirmed, and it is not "sometimes" — it is deterministic and undiscoverable.
[`parentcomponentobject.ts:149-186`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L149-L186)
walks up the component tree and returns the **first** ancestor that contains a
`net.noodl.ComponentObject` node:

```ts
if (parent.nodeScope.getNodesWithType('net.noodl.ComponentObject').length > 0) {
  return parent;
}
return getParentComponent(parent);   // otherwise keep walking
```

There is no name input, no id input, no depth input — **nothing on the node lets an author say which
ancestor they meant**. Nest two components that each own a Component Object and the inner node
silently binds to the nearer one. The node does expose the resolved name in `getInspectInfo`
([`parentcomponentobject.ts:101-103`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L101-L103)),
which is the only way to find out what happened, and only while inspecting.

Worse, the resolution is not stable. One branch walks `getVisualParentNode()`
([`parentcomponentobject.ts:159`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L159)),
so **the binding can change when the visual tree changes**, and there is a standing
`//FIXME: temporary hack` at [line 88](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L88)
deferring resolution by a frame because the parent's node scope may not exist yet. That is where the
"sometimes" comes from.

**This is the same shape as the Close Popup defect** in the first pass: a node that finds its target
by walking scope, with no way to name the target and no indication of what it found. Treat them as
one class. The fix is the same in both: an optional explicit target, and a *visible* indication of
what was resolved when it is left implicit.

### The class F sweep — done 2026-07-29 (NDA-015 §2, criterion 4)

Both named nodes are fixed. The sweep the spec asked for — grep `getNodesWithType`,
`parentNodeScope`, `getVisualParentNode`, `componentOwner` across `noodl-runtime/src/nodes` and
`noodl-viewer-react/src/nodes` — found the class is **wider than the two reported nodes**, in two
directions the specs did not name.

**F-i. The walk itself existed four times, and had already drifted.** The recursive
`getParentComponent` was hand-copied into `parentcomponentobject.ts`,
`setparentcomponentobjectproperties.ts`, `javascriptnodeparser.js` and the deprecated
`parentcomponentstate.ts`. Three of them are not identical: the `.js` copy accepts the deprecated
`'Component State'` node type as well as `'net.noodl.ComponentObject'`, the two TypeScript copies
accept only the latter. So **a Function node reading `Component Object` and a Parent Component Object
node sitting in the same place could resolve to different ancestors**, with nothing to say so. Closed
by moving the walk to `noodl-runtime/src/componentwalk.ts` and having the Component Object family
accept both types.

**F-i′. F-i was only a quarter closed, and the live half was worse than the half that was fixed.**
Re-read on 2026-07-29 while doing F-ii: only `parentcomponentobject.ts` had actually adopted
`componentwalk.ts`. `setparentcomponentobjectproperties.ts`, `parentcomponentstate.ts` and
`javascriptnodeparser.js` were **still hand-rolled**, still carrying their own type lists — so the
drift F-i describes was still shipping, in a worse direction than the one it names:

| Site | Accepted | Direction |
|---|---|---|
| `parentcomponentobject.ts` | modern + deprecated | **read** |
| `javascriptnodeparser.js` | modern + deprecated | read (Function nodes) |
| `setparentcomponentobjectproperties.ts` | modern only | **write** |
| `parentcomponentstate.ts` (deprecated node) | deprecated only | read/write |

F-i's example is two *readers* disagreeing. The live one is a **reader and a writer of the same
state disagreeing**: with a deprecated `Component State` on `/Outer` and a modern Component Object
on `/Root`, `Parent Component Object` read `/Outer` while the `Set Parent Component Object
Properties` node beside it wrote `/Root`. The author sees a value that never changes and a write
that never lands, with nothing on the canvas to explain it. Now closed for real — all four go
through `componentwalk.ts`, and the type list is a shared constant (`COMPONENT_OBJECT_TYPES`) rather
than four hand-written lists. The deprecated node's list stays deliberately narrower; widening it
would have *moved* bindings rather than aligned them, which is written into the code.

Worth generalising: **"de-duplicated into one place" is a claim to re-check, not a fact to inherit.**
The commit that created `componentwalk.ts` converted one of four call sites and described the job as
done.

**F-i″. And sharing the walk was still not the end of it (2026-07-30).** With all four sites on
`componentwalk.ts` the reader and the writer could no longer *disagree*, but the writer still had no
explicit target — the last ⚠️ row in `BINDING-CONTRACT.md`'s table — and, worse, no answer for the
case where the shared walk returns nothing. That is B-i above: it handed the `undefined` to
`Model.get` and reported `Done`. Closed 2026-07-30; `Set Parent Component Object Properties` now
obeys all three clauses, with the same `targetComponent` input spelled identically to its reader's
so the pair can be aimed together.

The pattern across F-i, F-i′ and F-i″ is worth stating plainly: **each round of "this is now
consistent" left a real defect behind, and each one was found by reading rather than by grep.**

**F-ii. `_forEachModel` is the same defect class — five sites. ✅ Closed 2026-07-29.** All five now
resolve through `noodl-runtime/src/foreachitem.ts`, which implements the three clauses once: an
optional `Repeater Component` input (a), the resolved template on the node card (b), and
`repeater-item/no-item-in-scope` · `/target-not-found` · `/target-has-no-item` (c). 16 corpus rows,
shown to discriminate. Three things the original write-up did not know:

- **There are two producers, not one.** `runtasks.ts:193` sets `_forEachModel` with the same
  `createNode` extraProps shape as the Repeater, so the messages name both — telling an author with
  a Run Tasks template that they are "not inside a Repeater" would send them hunting a bug that is
  not there.
- **The fifth site could not be fixed like the other four.** `Component.RepeaterObject` is computed
  for *every* Function node in the project, not only ones whose author asked for a repeater item, so
  raising eagerly would have filed a failure against every Function node in every non-repeated
  component. It is a lazy getter; only a script that reads it can be told it resolved nothing.
- **One of the five was crashing, not falling silent.** `dbmodelnode2.setModel` dereferenced its
  argument unguarded (a documented live defect, PLAT-003 NOTES §27.3), so a `Record` set to "From
  repeater" outside a repeater threw a `TypeError` from inside an input setter. Its twin the Object
  node always guarded. Fixed with the rest.

The original write-up follows.

**F-ii (as first written).** "The current Repeater item"
is resolved by walking `parentNodeScope.componentOwner` upwards until a component carries
`_forEachModel`:

| File | Line |
|---|---|
| `data/modelcrudbase.ts` | 104–106 |
| `data/modelnode2.ts` | 126–128 |
| `data/dbmodelcrudbase.ts` | 292–294 |
| `data/dbmodelnode2.ts` | 153–155 |
| `javascriptnodeparser.js` | 429–432 (`_findForEachModel`) |

Every one ends `setModel(component !== undefined ? component._forEachModel : undefined)` — so setting
**Id Source = Repeater Item on a node that is not inside a Repeater silently binds to nothing**, which
is clause (c) exactly. Nested Repeaters give the same undiscoverable nearest-wins binding as clause
(a). Not fixed here: it is five files this task does not otherwise touch, each needing its own corpus
row, and the shape is named as `findAncestorWithProperty` in `componentwalk.ts` so a sixth spelling
does not get invented. **This is the highest-value remaining item in class F.**

> Path correction: all five sites are in **`packages/noodl-runtime/src/`**, not the viewer — the
> table's bare `data/…` prefixes read as viewer paths and are not.

**What the sweep cleared.** The other `componentOwner` hits are not this class: they read
`componentOwner.name` to attribute a warning (~20 sites), or `componentOwner` for the node's *own*
scope rather than an ancestor's. `getNodesWithType` on a `graphModel` (Users, HTTP, REST, BYOB, …) is
editor-time port plumbing over the whole project, not a scope walk. Routers and Page Stacks target by
an explicit name already, so they satisfy clause (a) and only lack (b).

## The Repeater does not re-read its source on Refresh

Richard: "when an array feeding into the repeater is changed… not through the standard Noodl node
system… the repeater doesn't update, and using the Refresh signal does fuck all."

Both halves confirmed, and they are **two separate bugs**.

The first half is defect class A1 — the source collection never notifies on `push`, so
`onItemsCollectionChanged` never runs. The `items` setter also early-returns on an unchanged
reference ([`foreach.tsx:209`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L209),
`if (value === this._internal.items) return;`), so re-sending the same mutated array does nothing either.

The second half is its own defect and the more damning one. The Repeater keeps a private copy of the
collection — "so we don't have to refresh all content if the input items collection changes"
([`foreach.tsx:162`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L162)) —
and **`refresh()` rebuilds from that copy, never from `items`**:

```ts
// foreach.tsx:509-527
refresh: async function () {
  this._deleteAllItemNodes();
  ...
  for (let i = 0; i < internal.collection.size(); i++) {   // <-- the private copy
    const model = internal.collection.get(i);
    await this.addItem(model, baseIndex + i);
  }
}
```

`internal.collection` is only resynced by `internal.collection.set(internal.items)`, which runs from
`onItemsCollectionChanged` (never fires — see above) and `scheduleCopyItems` (only when a *different*
array object arrives). So Refresh tears down every item node and rebuilds them from stale data,
producing byte-identical output at the cost of a full re-render. It does not do nothing; it does a
lot of work and changes nothing, which is worse.

**Fix is one line in shape**: `refresh()` must resync from `items` before rebuilding. That is what a
signal named Refresh means, and it makes the Repeater recoverable even while class A1 is outstanding
— which is a good argument for landing it *before* NDA-002.

`Array Filter` and `Array Map` are downstream of the same A1 defect
([`filtercollectionnode.ts:243`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/filtercollectionnode.ts#L243),
[`mapcollectionnode.ts:136`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/mapcollectionnode.ts#L136)),
and neither has a Refresh input at all.

## Text sizes to content until you touch Size Mode

Richard: "the text node starts off as responsive width, but if you add two text nodes side by side
the first one will take up 100% of the width, unless you change to fixed width and back to
responsive, then it works."

> **SUPERSEDED 2026-07-29 by NDA-016 §0.** The mechanism below is wrong, and the "gap" it records
> was the tell. `sizeMode` is **never unset** — a fresh, never-touched Text node reads
> `props.sizeMode === 'contentHeight'`, `props.width === '100%'` off the live node in the preview,
> and so does every one of 15 visual node types placed with no parameters. The symptom is a stale
> `parentLayout`: a child copies its parent's layout into its props when *it* renders,
> `renderChildren` memoises the result, and the Group's Layout setter re-rendered only itself — so
> the change never reached the children. Full account and fix in
> [`NDA-016-LAYOUT-SIZEMODE.md`](NDA-016-LAYOUT-SIZEMODE.md) §0. Kept verbatim below because the
> reasoning is sound and still wrong, which is the useful part: every step of it checks out against
> the source, and the conclusion does not survive one reading of the running app.

Partially confirmed, with the mechanism identified and one gap.

[`layout.ts:60-67`](../../../packages/noodl-viewer-react/src/layout.ts#L60-L67) is the whole of size
resolution:

```ts
if (props.sizeMode === 'explicit')          { style.width = props.width; style.height = props.height; }
else if (props.sizeMode === 'contentHeight') { style.width = props.width; }
else if (props.sizeMode === 'contentWidth')  { style.height = props.height; }
// no else
```

**There is no `else`.** When `sizeMode` is unset, `style.width` is never assigned from `props.width`,
so it keeps whatever `defaultCss` gave it — for Text, `width: 'auto'`
([`text.ts:30-33`](../../../packages/noodl-viewer-react/src/nodes/visual/text.ts#L30-L33), carrying a
`// FIX:` comment). `flexShrink` is then set to `0` unconditionally at
[`layout.ts:69`](../../../packages/noodl-viewer-react/src/layout.ts#L69), and the percentage →
`flexGrow` conversion at [`layout.ts:71-75`](../../../packages/noodl-viewer-react/src/layout.ts#L71-L75)
is gated on `isPercentage(style.width)` — which `'auto'` is not. So an unset `sizeMode` yields a
non-shrinkable, non-growing item: the first one takes the row. Setting Size Mode explicitly and back
puts a real value on the port, the branch runs, `width` becomes `'100%'`, and both children get
`flexGrow` and share.

**The gap:** `sizeMode` is declared with `default: 'contentHeight'`
([`node-shared-port-definitions.ts:638-653`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L638-L653))
and defaults *are* copied into props at
[`react-component-node.ts:823-841`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L823-L841),
so on this reading `props.sizeMode` should already be set and the symptom should not occur. Something
between those two — port registration order, a `dynamicports` interaction, or the editor writing the
parameter only on first edit — is dropping it. **This one needs the running editor to finish
diagnosing.** The missing `else` is a real defect regardless and should be closed either way; it is
the same undefined-versus-explicit confusion as defect class A2, in the layout engine.

## Repeater Item: only the first one gets the remove handshake

I could not reproduce "doesn't work at all" from source — the node is in the picker, not deprecated,
and both its signals are wired from the Repeater
([`foreach.tsx:454`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L454)
for `Added`, [`foreach.tsx:479`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L479)
for `Try Remove`). Two things are worth recording anyway:

1. **Asymmetric fan-out.** `Added` is signalled on *every* Repeater Item node in the template (a loop
   at line 454); `Try Remove` is sent only to `forEachActions[0]` (line 479). A template with two
   Repeater Item nodes gets one that never receives the remove handshake, and since `Try Remove` is a
   handshake the Repeater *waits* on, this is a plausible source of "it doesn't work".
2. **A mechanism was deleted from under it.** The node used to publish `itemAction-…` ports whose
   handler called a `signalItemAction` that no node ever defined — "dead *and* broken", removed under
   DEBT-006 ([`foreachactions.ts:86-89`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreachactions.ts#L86-L89)).
   If the memory is of item actions rather than of the node itself, that is what it is.

---

## Two creatable nodes read "Delete Record" — NDA-011 criterion 3, one family over (2026-07-30)

Found by the live-QA pass, not by reading a spec. NDA-011 criterion 3 fixed six deprecated control
nodes that held the *plain* names their modern replacements supply via `displayName`, and the sting it
recorded was the picker showing "two entries reading Button and no way to tell them apart". That is
now true of exactly one other label, and this one is **not** a deprecated/modern pair — both entries
are current, supported nodes in the same category:

| `name` | label | category | deprecated |
| --- | --- | --- | --- |
| `DeleteDbModelProperties` | Delete Record | Data | no |
| `noodl.byob.DeleteRecord` | Delete Record | Data | no |

Enumerated live from `NodeLibraryData.nodetypes` in the running editor: grouping all 156 registered
types by their picker label leaves **eleven** duplicated labels, ten of which are a deprecated node
shadowing its replacement (the six controls plus Object/Component Object/Parent Component
Object/Variable/Array/Cloud Function). `Delete Record` is the only one with two *creatable* entries.

The rest of the two record families were named to avoid exactly this — `NewDbModelProperties` is
"Create New Record" against BYOB's "Create Record", `SetDbModelProperties` is "Set Record Properties"
against "Update Record", `DbCollection2` is "Query Records" against "Query Data". Delete is the one
pair where the disambiguating word ran out, and nothing in the library checks for the collision, which
is why it survived the sweep that was looking for it.

**Not fixed here, because the fix is a naming decision and not a mechanical one:** either the
Parse-wire family or the BYOB family has to give up the plain label, and which one is canonical is the
question WF-007 left open rather than something to settle inside a QA pass. Recorded for Richard.

Generalisable: **a criterion that says "no two nodes should read the same"** is a property of the
*registry*, and checking it by reading the nodes one spec named will find only the instances that spec
knew about. The check costs one `reduce` over `nodetypes` and would have caught all eleven.

---

## Defect class G — a signal-driven node cannot tell a fresh input from a stale one (2026-07-30)

**Reported by the Noodl community, not found by either pass.** Recorded in full, and specced as
[NDA-017](./NDA-017-SIGNAL-INPUT-FRESHNESS.md):

> The expression node, when its "Run" connected to some other node and it had ran successfully before
> with a clear output of say an expression A + B (where values of A and B is coming from other nodes
> like array or a func) it gives out the same previous output of A+B when its "Run" gets triggered
> again but the values coming for A or B from other nodes gets failed to run/couldn't run on time so
> it gives out the outdated value as an output which messed up the whole logic, so basically i was fed
> up with the memory mess of nodes, had to use function node many times in places where even a simple
> expression node would be suffice.

The mechanism is confirmed from source. When a control signal is connected, the value setters go
passive — `if (!this.isInputConnected('run')) this._scheduleEvaluateExpression()`
([`expression.ts:123`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L123), and
the same guard at [`:286`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L286),
[`:312`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L312),
[`:321`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L321)) — and `Run`
evaluates whatever is in the scope object at that moment
([`:328-330`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L328-L330)). The
scope entry holds the last value that arrived, and nothing in the node or in `Node` distinguishes "the
value the author meant" from "a value from a previous cycle" from "the seed".
`scheduleAfterInputsHaveUpdated` ([`node.ts:767`](../../../packages/noodl-runtime/src/node.ts#L767))
drains the *synchronous* pending queue, which is exactly why this is invisible for sync producers and
unavoidable for async ones.

Three distinct failures, and only the first is a first-run problem: the `0` seed
([`expression.ts:117-118`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L117-L118))
makes `A + B` evaluate to a plausible `0` before anything has produced; an async producer leaves the
previous cycle's value in place, which is the reported case; and the unchanged-output gate re-flags
`result` only when the value differs
([`:133-139`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L133-L139)) while
`On True`/`On False` pulse on **every** evaluation
([`:140-141`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L140-L141)) — so a
stale evaluation fires a signal downstream while the value port stays quiet. That third one is what
"messed up the whole logic" describes.

**The workaround in the report does not work.** The Function node carries the identical idiom
([`simplejavascript.ts:156`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L156),
[`:287`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L287)) and is *more*
exposed, because `runScript` is `async` so its own outputs land a turn late by construction.

**Twelve node families share the idiom**, grepped across the runtime and the viewer: Expression,
Function, Condition (`eval`), User (`fetch`), Variable (`saveValue`), Record (`fetch`), Filter Records
(`filter`), Query Records (`storageFetch`), Object (`fetch`), Text Input (`set`), Component Object and
Parent Component Object (`fetch`). Full citation table in the spec. The idiom is not the defect — "fire
when I say, not on every keystroke" is the point of a control signal. What is missing is any account of
what a node should do when it is told to fire and its inputs are not ready.

**Why neither pass found it.** Class A asked "does a mutation notify?" and class B asked "can a failure
be reported?". This is neither: the notification arrives and nothing fails. It arrives *after* the
signal that consumed the value. No check in the 12-check worksheet asks about ordering between a
node's signal inputs and its value inputs — which is itself a finding about the worksheet.

**It also cuts against a conclusion this document already drew.** B-iii's reasoning for why `Failure`
is safe on Expression was that `registerInputIfNeeded` seeds every input to `0`, so "the values have
not arrived yet" is not a state the node passes through
([`expression.ts:154-158`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L154-L158)).
That is true of the *reporting* question and false of the *evaluation* question — the seed is precisely
what lets a not-yet-arrived input evaluate to a plausible number. Both readings are correct; they
answer different questions, and the comment needs to say so.

**Not reproduced.** Everything above is read from source. NDA-017 §0 is blocking for that reason.

---

## Defect class H — the deployed build was never looked at (2026-07-30)

Two criteria in this phase end with the clause "…in a deployed build", and both had been deferred
by more than one session. Running the deploy once — a real Deploy To Folder, driven from the
editor, served over http and measured — found **three defects**, none of which any test in the
repo could have caught, and two of which were in code the phase had already signed off.

The generalisable finding is the shape, not the three: **a criterion whose last clause names a
build nobody runs is a criterion that grades the build everybody runs.** The two legs that *were*
verified were verified in the editor and the preview, which share a code path with each other and
not with the artefact users receive.

### H-i — an inline style is a declaration list, and CSS repairs one path but not the other

`Columns.tsx` built the container width as `` `calc(100% + (${marginX}px)` `` — one parenthesis
short — and had done since the node was written. It never showed up because the two consumers of
that style object disagree about what an unterminated block means:

- **Client.** React sets each property through the CSSOM, `element.style.width = '…'`. The value
  is parsed *in isolation*, and CSS's end-of-input rule closes the unterminated block for you. The
  declaration is valid, serialises back as `calc(100% + 0px)`, and looks correct in devtools.
- **Server.** `renderToString` serialises the whole object into one `style` attribute, parsed as a
  *declaration list*. The unclosed block swallows the `;` and everything after it — `width` **and**
  `box-sizing` were both dropped.

Measured on the SSG output with the scripts stripped, which is the first paint: the container fell
back to shrink-to-fit as a flex item (110px), and every percentage-width child computed to **0**.
The whole of a Columns node's pre-hydration content was a zero-width strip.

Two things worth carrying:

1. **Which declarations are lost depends on key order in the style object.** `box-sizing` was the
   casualty because it happened to be written after `width`. That makes the failure mode unstable
   under ordinary tidying, and it is why the corpus row asserts *balance* rather than the literal.
2. **The comment three lines above the bug describes the bug.** Slice 1 removed
   `visibility: hidden` because it "painted blank through the whole of SSR/SSG". SSR painted blank
   anyway, for an unrelated reason, one line down. A fix that removes one cause of a symptom is not
   evidence that the symptom is gone — and here the *comment recording the fix* was what made the
   symptom look accounted for.

### H-ii — `if (editorConnection)` was always true, so the console channel never existed

`FAILURE-CONTRACT.md` and `nodecontext.ts`'s own comment both claimed that every runtime other
than the editor gets a structured console line "so a failure is never fully silent". The selection
was `if (this.editorConnection) … else console`. `NoodlRuntime` constructs an `EditorConnection`
**unconditionally**, in every runtime, and says so in a comment at `noodl-runtime.ts:285-288`:
"create an editor connection even if we're running deployed … it won't connect and act as a
no-op". So the else branch was unreachable outside a directly-constructed context — that is, outside
its own unit test.

Measured, with an Expression that cannot compile, in a real deployed browser build and in a real
SSG build: subscribers were `['editorWarningSubscriber']` plus whatever the graph had added, and
**no console output was produced in either**. Every raised failure went to a websocket connected
to nothing.

Both contexts *did* deliver the event to an `On App Error` node, structured and complete — which
is why the leg read as met. That is the trap: **criterion 2 was checked through the surface an
author has to opt into, and passed.** An app with no On App Error node reported nothing at all.

The right discriminator is not "is there a connection object" — there always is — but "is the
editor's warning panel a surface someone is watching". Note the cloud runtime inverts the obvious
test: it never passes `runDeployed`, so a *deployed* cloud function reports
`runningInEditor: true`.

### H-iii — the disconnected send queue grows for the life of the page

Found underneath H-ii. `EditorConnection.send` batches: while a flush timer is armed, or while
disconnected, the message is queued. The flush returned early when still disconnected **without
clearing `sendTimer`**. After the first flush in a deployed build the handle stays truthy for ever,
so the guard at the top of `send` takes the queue branch on every later call, `!this.sendTimer` is
false so nothing re-arms, and `sendQueue` grows without bound.

Every runtime warning goes down that path. So the leak was driven by exactly the diagnostics H-ii
had already made undeliverable — a silent failure channel that also consumed memory in proportion
to how much it had to say.

**A "no-op when unused" claim is a hypothesis, like any other.** This one was written in a comment,
believed for years, and was half true: the connection genuinely never connects, and genuinely does
not no-op.

### H-iv — the fixed state, confirmed on a second deploy (2026-07-30)

H-i and H-ii were both *measured as defects* and then fixed against the corpus; neither fixed state
had been watched running. One further Deploy To Folder — same headless recipe, same fixture plus an
`Expression` reading `1 +* ` and **no `On App Error` node anywhere in the project** — confirms both:

| Witness | Under the defect | Now |
| --- | --- | --- |
| Masonry container / items, script-stripped SSG first paint | 0px / 0px ×7 | **1280px / 427px ×7** |
| Breakpoint Columns container / items, same page | 110px / 28px ×4 | **1280px / 320px ×4** |
| `box-sizing` in the serialised `style` attribute | dropped | **present** |
| `[noodl] … [expression/compile-failed]` in SSG build stdout | absent | **present, with the structured payload** |
| The same line in the deployed browser console | absent | **present, as `console.error`** |

The masonry witness was **discriminated on the artefact itself** rather than in source: substituting
`width:calc(100% + 0px)` → `width:calc(100% + (0px)` in the served HTML and reloading collapses the
masonry container to **0** and reproduces the recorded 110/28 numbers on the breakpoint container.
That is a cheaper discrimination check than a revert-and-rebuild, and it is available for any defect
whose evidence is a serialised attribute: **the deploy output is a fixture you can edit.**

One correction to H-i in passing: the recorded "the container fell back to shrink-to-fit as a flex
item (110px)" is the *breakpoint* Columns node. The masonry container goes to **0**, because its
children are absolutely positioned and it has nothing to shrink to fit.

Also confirmed on the hydrated page, which is what NDA-006 §5 asked for and is now measured twice:
masonry tops `0,0,0,40,90,60,160`, container height **230** — exactly what the corpus computes.

---

## `On App Error` was registered but not in the picker — found by regenerating the catalog (2026-07-30)

**The catch-all half of the Failure Contract could not be added to a graph.** NDA-004 §1 built
`On App Error`, Richard confirmed it as one of the contract's two halves, and criterion 2 measured it
receiving structured events in a deployed browser build and in SSG. It was never in the editor's
add-node picker, so the only way an author could get one was to hand-write `project.json`.

`nodelibraryexport.ts`'s `coreNodes` is a **curated index, not a projection of the register**. The two
are maintained separately, registering a node type does not offer it, and this one was only ever done
on the register side. Every measurement in the phase that found the node working found it in a fixture
whose graph a script had written — which is why nothing had noticed.

This is the criterion-2 trap one level further down. That one said *a criterion can be met through a
surface the author has to opt into*: the deployed-browser and SSG legs passed because the fixture
happened to contain an `On App Error` node, while an ordinary app got nothing. Here the opt-in surface
**could not be opted into at all**. The generalisation worth carrying: when a fix's user-facing half is
"the author adds a node", check that the author can add the node, and check it through the picker
rather than through a fixture.

**It took a catalog regeneration to become visible**, and only as a derived field: `inNodePicker` comes
from `coreNodes` (`build-catalog.js:186`), and one query over the regenerated catalog lists four
non-deprecated types reading `false`. ~~The other three are legitimate — `Page` is created through the
Router flow, `net.noodl.user.RequestMagicLink` and `net.noodl.user.SignInWith` through the sign-in
flow.~~ **CORRECTED 2026-07-30 by NDA-012's Cloud Services pass: only `Page` is legitimate.** See the
next section. That is a reusable query, and it is the registry-side companion to NDA-011 criterion 3's
duplicate-label sweep: **ask the catalog which nodes exist and cannot be created, and which can be
created and read the same.**

Fixed by adding it to the `System` sub-category of `Logic & Utilities`, beside `Screen Resolution` and
`Open File Picker`. Three rows in
[`nda-004-on-app-error-reachable.test.ts`](../../../packages/noodl-runtime/test/corpus/nda-004-on-app-error-reachable.test.ts);
the revert reddens the first and leaves both controls green. The control matters more than usual here:
`toContain` over a list of ~130 names passes for almost anything, so a second row asserts a registered
type that is *deliberately* absent (the deprecated `Cloud Function`) — without it the row cannot tell
"the index offers this node" from "the index offers everything", which is exactly the defect.

---

## NDA-012 Cloud Services (2026-07-30) — 25 defects, and three of them are corrections to this file

The category worksheet is [`audit/cloud-services.md`](./audit/cloud-services.md) and carries all 22
nodes with citations. Recorded here are only the ones that change something outside the category.

### CS-i — the picker dismissal above was wrong, and it was written the same day

The `On App Error` entry ends by naming three other non-deprecated types absent from the picker and
declaring all three legitimate: `Page` "created through the Router flow",
`net.noodl.user.RequestMagicLink` and `net.noodl.user.SignInWith` "through the sign-in flow".

**There is no sign-in flow.** Grepping every source directory in the editor, the runtime and the
viewer for either type name returns nothing outside the two nodes' own definition files — no
adapter, no template, no creation path of any kind. `Page` really is created by
[`RouterAdapter.ts`](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/RouterAdapter.ts);
the other two were an assumption written next to a fact, in a sentence whose first clause is true.

So **two of the three nodes BAK-004 shipped cannot be added to a graph**, and the group that omits
them lists four *deprecated* nodes: `Verify Email`, `Send Email Verification`, `Reset Password` and
`Request Password Reset` ([`nodelibraryexport.ts:688-699`](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L688-L699)).
An author looking for passwordless sign-in finds the superseded password flow and not the thing
built to replace it. Neither node has a `docs` URL either, so its node card's help link is dead —
the only documentation is each file's (good, long) header comment.

The generalisation is the one this document already states about traps, aimed one step earlier:
**a dismissal is a hypothesis too.** The query that found the four types was reusable and correct;
what was not checked was the sentence explaining away three of its results. Checking it cost one
grep.

⚠️ **Corrected by DA-i (2026-07-31), and the correction runs the same way this finding does.** The
contrast above — two nodes that cannot be added *while four deprecated ones can* — is wrong in its
second half. Those four are **listed** in the index and then dropped by the picker's creatability
filter, so they are equally unreachable. The sentence "an author looking for passwordless sign-in
finds the superseded password flow" describes something that cannot happen: they find neither. The
substance of CS-i stands and gets worse; only the contrast was an inference from a listing.

### CS-ii — a criterion met over two packages is not met over three

`Aggregate Records` had **both** defects the phase had already swept for, and neither sweep had
opened it:

- It wrote its message to `_internal.err` while the `Error` output's getter reads `_internal.error`,
  so the port had never carried anything and only `Failure` ever fired. PLAT-003 NOTES §23.4 recorded
  exactly this in the deprecated `dbcollectionnode`; §27.3 found it again in `dbcollectionnode2`,
  the node that replaced it. This was the **third** live instance.
- It raised nothing on the runtime error channel — B-iv's condition, which NDA-004 §2 closed across
  twenty-two `setError` helpers and reported as met for the family.

Both sweeps covered `noodl-runtime` and `noodl-viewer-react`. This file is in `noodl-viewer-cloud`,
the third package that registers nodes, and it is the only Cloud Services node that lives there.

Fixed, with a discrimination check on each half separately —
[`nda-012-aggregate-records.test.ts`](../../../packages/noodl-viewer-cloud/tests/nda-012-aggregate-records.test.ts),
rows C1–C5. **Row C1 asserts through the output's getter, never through `_internal`**: the defect is
precisely that the writer and the reader named different fields, and an assertion on either field
alone cannot see a mismatch between them. That is the reusable half.

⚠️ Getting a row to run at all required `packages/noodl-viewer-cloud/tsconfig.tests.json` to gain
`DOM` and `ES2021.WeakRef` libs. Before that, any test in this package that `require`d one of its own
*node modules* died compiling `@noodl/runtime` (`TS2304: Cannot find name 'location'`) — so the
package could test its plain modules and not its nodes, which is a large part of why its nodes were
never swept.

### CS-iii — a config fetch that fails once can never succeed again

`ConfigService.getConfig` stores the in-flight promise in `configCachePending` and deletes it *after*
the `await`, so a rejection skips the delete
([`configservice.ts:118-131`](../../../packages/noodl-runtime/src/api/configservice.ts#L118-L131)).
Every later caller is handed the same rejected promise without reaching the transport, and
`clearCache()` — the only recovery the class offers, and what the editor calls when the config schema
changes ([`dbconfig.ts:193-196`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbconfig.ts#L193-L196))
— deletes `configCache`, which a failed fetch never populated.

Underneath it, the `Config` node has **no failure surface of any kind**: no `Failure` signal, no
`Error` port, no raise, and its one call site is a `.then` with no `.catch`
([`dbconfig.ts:51-54`](../../../packages/noodl-runtime/src/nodes/std-library/data/dbconfig.ts#L51-L54)).
So a backend that is briefly unreachable at page load leaves every Config node in the app blank and
silent for the life of the page, with an unhandled rejection as the only trace.

Pinned as three `test.failing` rows plus a control in
[`nda-012-cloud-services-category.test.ts`](../../../packages/noodl-runtime/test/corpus/nda-012-cloud-services-category.test.ts).
Deliberately **not fixed** — NDA-012 produces verdicts, and unlike CS-ii there is no signed-off
criterion this falsifies. A candidate fix (`try`/`finally` around the `await`) reddens all three rows
and leaves the control green, so the rows are known to discriminate.

### CS-iv — defect class D has its textbook case, twice in one file

Parse's verify-email and reset-password endpoints answer with **HTML**, so `UserService` reads the
outcome out of the page text. The success test is written correctly (`indexOf(…) !== -1`). The second
test on both is not:

```ts
} else if (response.indexOf('Invalid Verification Link')) {   // userservice.ts:388
} else if (response.indexOf('Invalid Link')) {                // userservice.ts:428
```

`indexOf` returns `-1` when the phrase is **absent**, which is truthy — and `0` when it is at the very
start, which is falsy. So the branch fires for every response that is not a success, and the `else`
below it is reachable only when the page opens with the phrase. `Verify Email` and `Reset Password`
therefore report "Invalid verification token" for a network failure, a rate limit and an expired token
alike; and `Reset Password`'s unreachable branch says **"Failed to verify email"**.

Same file, same method family: `verifyEmail` interpolates the username and token straight into a query
string with no encoding ([`userservice.ts:379-381`](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts#L379-L381)),
while `signInWithProvider` forty lines further down encodes both of its interpolations.

This is the same bare-pattern class SUB-013 hit on 2026-07-30 in the catalog generator. Two
independent instances in one day is enough to make it worth a grep: **a truthiness test on the result
of `indexOf`, `search` or `findIndex` is a bug unless the target really is at index 0.**

### CS-v — `Set User Properties`, signed out, is a black hole

`UserService.setUserProperties` wraps its entire body in `if (_cu !== undefined)`
([`userservice.ts:327-354`](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts#L327-L354)),
so with no session **neither callback is called**. The node's `Do` produces no `Success`, no
`Failure`, no `Error`, no console line and no raise, and it re-arms — so an author can press it
forever and learn nothing. Every other node in the family reports a missing session, because the
backend refuses the request and the error callback runs; this one never gets that far.

It is the Failure Contract's condition stated as sequencing rather than as diagnosis: a signal input
whose terminating signal is *conditional* is, on that condition, a mute node. Worth checking for
wherever a service method guards its whole body rather than branching.

---

## NDA-012 Navigation (2026-07-30) — 15 defects in 8 nodes, and a node that was never usable

The full worksheet is [`audit/navigation.md`](./audit/navigation.md). Five findings reach outside the
category.

### NV-i. `Page Inputs` had no connectable ports, and had not since the initial commit

The node whose entire purpose is giving a page access to its own path and query parameters shipped
with the whole of its module `setup` commented out — `git show b9c60b07` has it commented in the
first commit of this repository. `sendDynamicPorts` was therefore never called for it, and **every
real output it has is a `pm-*` announced from there**.

The runtime half was intact the whole time: the Router calls `_setPageParams`
(`router.tsx:298,330`), and `registerOutputIfNeeded` resolves `pm-*` to `getPageParam`. What was
missing was the editor ever being *told* the ports exist — and a port the editor does not know about
cannot be connected to. Meanwhile the node sits in the curated picker index at
`nodelibraryexport.ts:568`, so an author could add it, fill in both stringlists, and find nothing to
wire.

**This is CS-i one step further along.** There, `Sign In With` and `Request Magic Link` could not be
*added* to a graph. Here the node can be added and does nothing. Both were invisible to every check
this phase runs, because every check reads the node definition and this class of defect lives in
what the definition is *not* wired to. Fixed; five corpus rows.

### NV-ii. Signal-before-value is masked or exposed by an accident of `initialize`

`Signal To Index` was left standing when `Receive Event` was fixed, specifically so it would get its
own discrimination check. **The check refused to discriminate**: restoring the original statement
order leaves every row green. That is not a weak row — it is a real difference between the two nodes,
and the mechanism governs the whole class.

A receiver's input queue is **per port**: `_inputValuesQueue` is `{ [portName]: value[] }`, and
`Node.update` drains it with `Object.keys(...)` (`node.ts:531,543`), one entry per port per pass. So
which of a pulse and its paired value is applied first is decided by **which port name was inserted
into that object first**, not by the order the node called `sendPulse` and `sendValue`. And the first
insertion happens at *connection* time — `connectInput` pushes the source port's current value
downstream, but only `if (outputValue !== undefined)` (`node.ts:452`).

Therefore:

- `Signal To Index` initialises `currentIndex` to `0`, so `index`'s getter is non-`undefined` when the
  wire is made. The `value` key is created first and drains ahead of `pulse` **for the life of the
  node**, masking the source order entirely.
- `Receive Event`'s payload outputs read `undefined` until an event arrives, so no `value` key is
  created at connect, `pulse` is inserted first, and the defect is observable — which is why *that*
  row discriminated.

**Whether this defect class is visible depends on whether the paired value port held a non-`undefined`
value when the connection was made** — an accident of the node's `initialize`, not of its ordering.
Every node in the class is latently wrong; some graphs happen to hide it. The reorder was kept because
it removes the dependence on the accident, not because it repaired an observed wrong read, and the
worksheet says so. **Two nodes previously counted as one class turn out to be two situations**, and
any future sweep for this class cannot use "does a test catch it" as the test.

### NV-iii. A fourth cross-category shape — one-shot state that is not one-shot

`Close Popup`'s close action (`closepopup.ts`) and `Pop Component Stack`'s back action
(`navigate-back.ts`) are both written by their trigger and **never cleared**. So the second use of the
node reports the first one's outcome: close a popup through `Save`, then close it later through the
plain `Close` signal, and the Show Popup node fires `Save` again — running the author's save branch
for an interaction the user never made.

It is not an ordering defect: the value is correct when first read and wrong on every read after. It
is invisible to any test that exercises the node once, which is why the twelve checks did not ask for
it — they have no "and then what happens the second time?" question. Both fixed. Two independent
implementations of one mistake, in two files with no shared helper.

### NV-iv. The component boundary is still typed in one direction, one node over

NDA-010 §1 fixed exactly this for Show Popup's close results: ports derived from another component
should carry that component's declared type rather than `'*'`. **`Push Component To Stack` has the
same asymmetry and did not get the fix** — `navigate.ts:291-296` pushes every `pm-<inputName>` as
`'*'`, discarding the type the target component's `inputPorts` declares, where `showpopup.ts:233`
reads `o.type || '*'`. Same phase, same class E, same shape, one file apart. Filed, not fixed:
narrowing a port type is the kind of change that can stop an existing graph, and NDA-010 §1's fix was
additive only because it fell back to `'*'`; the same care is needed here and it is more than a
per-node pass should decide.

### NV-v. Editor-time code is materially less well tested than runtime code

**Six of the fifteen defects live in a module's `setup`** — the dynamic-port derivations. None were
reachable by the ordinary corpus: `graph-harness` does not call `setup` and says so in its own
comment. They needed the fake-graph-model harness NDA-009 and NDA-010 built.

That is not a small corner. Every node in this category derives its most important ports there, and
the two dedupe bugs found in `showpopup.ts` — a guard comparing a bare name against a prefixed one, and
a loop with no guard at all — sit twenty lines from `navigate.ts:304,318`, which are the same two
guards written correctly. **A defect class that only exists in code no harness runs will keep being
found one file at a time**, which is an argument for making the `setup` harness a shared fixture rather
than a per-task one.


## NDA-012 the small remainder (2026-07-30) — Component Utilities, Utilities, CustomCode, Animation, Cloud

**39 defects in 21 of 27 audited nodes** (one, `Logic Builder`, is blocked). 1.44 per node, against
the running 1.41 — **still no decline after 79 nodes.** But the per-category spread is the more
useful number this time, because it moves for reasons that are visible:

| Category | Nodes | With ≥1 | Defects | Per node |
|---|---|---|---|---|
| Animation | 4 | 4 | 10 | **2.50** |
| CustomCode | 4 (of 5) | 4 | 8 | **2.00** |
| Utilities | 8 | 7 | 12 | 1.50 |
| Cloud | 3 | 3 | 4 | 1.33 |
| Component Utilities | 8 | 3 | 5 | 0.63 |

### SR-i — a low rate with a cause is not a low rate

Component Utilities scored **0.63, less than half the running average**, and the reason is on the
record rather than inferred: **four of its eight nodes had already been remediated twice**, by
NDA-015 (the whole binding contract lives in `parentcomponentobject.ts`) and by NDA-004 §2 batch 2.
The most-fixed node in the library, `net.noodl.ParentComponentObject`, came out of this pass with a
clean sheet on all twelve checks — the only node in the phase to do so.

This matters for the stop rule. **Cloud Services' 1.14 dip was explained by sibling dilution, and
this one is explained by prior work; neither is evidence of exhaustion.** A category the phase has
already worked over finds less, which is what "already worked over" means. The stop signal remains a
category with *no* prior remediation producing nothing new, and nothing is close.

### SR-ii — three of the four dynamic-port mechanisms carry no documentation at all

NDA-005 §2 established that `sendDynamicPorts` has no `description` field. This pass found the same
hole at two more mechanisms, which makes it a property of the design rather than an oversight:

| Mechanism | Reaches the catalog? | Used by |
|---|---|---|
| Static `inputs`/`outputs` | **yes** — `nodedefinition.ts:79,146` | most nodes |
| `sendDynamicPorts` | ports yes, `description` **no** | 89 nodes |
| `numberedInputs` | **no metadata entry at all** — `nodedefinition.ts:100-131` | `String Mapper`, `Index To String`, `And`, `Or`, … |
| Port Editor panel | **no** | `Component Inputs`, `Component Outputs`, `Globals` |

`registerNumberedInput` wraps `registerInputIfNeeded` on the *instance* and never writes to
`metadata.inputs`, so a `description` on a numbered family goes nowhere and the catalog, the
validator and the AI loop cannot see the ports exist at all. The Port Editor mechanism is worse
again: `Component Inputs` and `Component Outputs` **define every component's public interface** and
are undocumentable by any means the library currently has.

So NDA-005's coverage percentage measures one mechanism of four. It is not wrong — it is the number
for the ports that *have* a documentation channel — but the six nodes reporting **100% on `0/0`
ports** are not documented, they are unmeasurable, and the register should say `n/a`.

### SR-iii — the library encodes structured names into flat strings and decodes them with `split('-')`

Two independent instances landed on the same day, in different packages and different categories:

- **`net.noodl.ComponentObject`** wrote `first-name` from the input and read `name` on the output,
  because `registerOutputIfNeeded` took the last `-` segment while `registerInputIfNeeded` stripped
  the prefix. **Fixed** — one node, one property, a writer and a reader on two different keys.
- **`States`** decodes `value-<state>-<name>` with `parts[1]`/`parts[2]`, so a value called
  `bg-color` writes `currentValues['bg']` while the output reads `bg-color`. **Not fixed**, and the
  reason is the interesting half: the port name concatenates **two** author-chosen names, so
  `value-a-b-c` is genuinely ambiguous. It needs an encoding decision, not a substring change.

`Function`'s `'in' + n` missing its hyphen (`simplejavascript.ts:359`) and the deprecated
`Component State`'s identical last-segment bug are the same family. **Nothing in the library
validates that this round trip is lossless**, and every one of these is invisible until an author
happens to use a hyphen in a name — which is the most ordinary thing in the world.

This is the seventh cross-category shape, after signal-before-value, the emitting value port,
create-on-read, and one-shot latching.

### SR-iv — the escape hatches had the worst failure surfaces

CustomCode's 2.00 is the phase's second-highest rate, and it is concentrated in exactly the wrong
place: the nodes an author reaches for when no other node will do.

- **`Script`'s External File mode had no failure path at all.** `createFromURL`'s `onerror` logged
  to the console and **never called back**, so `isWaitingForExternalFileToLoad` stayed set — and the
  node's `update()` override clears `_dirty` and skips `Node.prototype.update` for exactly as long as
  that flag is true. A Script node pointed at an unreachable URL was **permanently and silently
  inert**: no code, no ports, no warning, no error, no further updates, ever. A 404 was a second bug
  underneath: `onreadystatechange` fired on any completed request, so the server's error page was
  handed to the parser as if it were the author's script. Both **fixed**.
- **`Function` was mute when its script would not compile** — `parseScript` swallowed the
  `SyntaxError` into a `console.log` and `Run` returned without a sound. NDA-004 §3 had given this
  node `Success`/`Failure`/`Error` for code that *throws*, and NDA-004 §2 had fixed the identical
  compile-failure defect on `Expression`. **The two script hosts differed for no reason.** Fixed.
- **`Script`'s run path is still editor-only** and is filed: user code that throws reaches
  `sendWarning` and `console.log`, with no raise and no port, so a throwing Script node is silent in
  a deployed build.

The lesson generalises CS-ii. A sweep that fixes *"the Expression node"* and *"the Function node"* by
name does not fix *"nodes that host user code"* — and there were four of those, in three packages.

⚠️ **Superseded in scale by SR-viii, written the same day.** Two corrections: the fourth script host
had the same compile-failure defect too, and this section was written without checking it — and
there are **five**, not four. `REST` (Data) is the fifth, and it is the worst of them.

### SR-v — `Date To String`'s only failure port had never fired, and a comment said so

`_format`'s catch called `flagOutputDirty('onError')`. `flagOutputDirty` is
`sendValue(name, output.value)` (`node.ts:647-650`), and a signal output's `value` is `undefined`, so
every receiver got a *value* of `undefined` on a signal input instead of the `true`/`false` pair
`sendPulse` delivers. **`Invalid Date` had never fired, since the node was written.**

PLAT-003 NOTES §25 had recorded the line — *"note this **flags** the signal dirty rather than sending
it"* — and kept it verbatim, correctly for a typing slice whose rule was to change no behaviour. The
observation was right and nobody came back for it. Fixed, with the corpus row driving it **over a
real wire into a receiver**, because asserting on the sender's own signal log cannot tell a pulse
from a value.

A second, smaller correction fell out of the same read: the file's comment claimed an invalid date
throws out of `getDate()`. It does not — `getDate()` returns `NaN`. The catch is reached because
`Intl.DateTimeFormat.format` throws `RangeError`, which is incidental to the line that looks like
the check.

### SR-vi — the timer leak that four nodes shared and one node never had

`TimerScheduler` keeps a running timer in `runningTimers` until something stops it, and deleting a
node does not. `Animate To Value`, `Transition`, `States` and `Animation` never stopped theirs, so a
node deleted mid-animation kept being ticked every frame — flagging outputs dirty on a dead node and
holding the whole instance reachable through the scheduler. `Animation` was worst: it owns *n+1*
timers, one per animated output plus one, and stopped none.

**`Delay` has had the delete listener since it was written** (`timer.ts:38-40`). It is the same
mechanism, correct, in the same repository — and it is filed under **`Utilities`, not `Animation`**,
so no per-category read would ever have put the two side by side. Fixed at all four sites.

### SR-vii — `Page Inputs`, live: the suspicion was wrong and a different defect is real

NEXT-SESSION §3 carried a suspicion from live QA — the `Path Parameters` / `Query Parameters` group
headers appearing with no entries — with an instruction not to write it up before reproducing it.
Reproduced in the running editor, and **it does not happen.** The panel lists the entries, the model
updates, and the ports update: `pathParams: 'productId,tab'` renders two rows, adding `categoryId`
through the panel writes `productId,tab,categoryId`, and the node's dynamic ports become
`pm-productId`, `pm-tab`, `pm-categoryId`, `pm-sort` — four, correctly de-duplicating the `tab` that
appears in both lists, exactly as NV-i's fix documents. **NV-i is live-verified.**

What the live check *did* find is one step to the left. The stringlist's **"New entry" popup renders
the comment/code editor variant**: an 8-row `string-input-popup-textarea`, 420×198, with the
placeholder `// Add your comment here...`. For a port whose entries are single identifiers that is
wrong three times over — a multi-line field for a one-line name, a placeholder instructing the
author to write a comment, and a value that can contain newlines and commas, which the node then
splits on `,` into ports.

**The general lesson is the one the phase keeps relearning from the other direction.** A suspicion
formed by driving the model programmatically was not merely unconfirmed, it was pointed at the wrong
component: the panel was fine and the *editor* in the popup was not. Neither could have been told
apart without opening it.

## NDA-012 `Logic Builder` (2026-07-30) — 6 defects in the node that was believed blocked

The fifth CustomCode node, audited last because nine consecutive handovers described it as another
session's uncommitted work. It was not (see `audit/customcode.md`), and it carried more defects than
any other node in the category.

### SR-viii — the compile-failure silence was on *four* of five script hosts, and the fifth was found by finally running the grep

SR-iv, written hours earlier, named `Expression` and `Function`, said the class was "nodes that host
user code", and put the count at four. `Logic Builder` had the same defect, in the same shape, for
the third time. **Then the grep this section was about to claim would have found them all was
actually run, and it found a fifth nobody had counted.**

| Node | Category | Compile failure was | Status |
|---|---|---|---|
| `Expression` | CustomCode | swallowed, node silent | fixed, NDA-004 §2 |
| `Function` | CustomCode | `SyntaxError` → `console.log`, `Run` returned silently | fixed, NDA-012 CustomCode |
| `Logic Builder` | CustomCode | `SyntaxError` → `console.error`, `_executeLogic` bare-returned | fixed, this pass |
| `Script` | CustomCode | load path fixed; **run path** still `sendWarning`-only | open, filed |
| **`REST`** (`REST2`) | **Data** | `catch (e) { console.log(e) }`, ×2 | **open, filed — new** |

**`REST` is the worst of the five and was never in the frame**, because every pass so far looked at
CustomCode and `REST` is filed under Data. `restnode.ts:178-184` and `:194-201` each compile an
author script in an input setter and swallow the `SyntaxError` into a `console.log` — and because
the assignment is inside the `try`, **`_internal.requestFunc` keeps the last script that did
compile**. So a broken edit to the Request or Response script does not merely fail silently: the
node goes on fetching with the *previous* script, and the author is watching a request they have
already changed. Filed for the Data pass; not fixed here, because Data is a whole category and this
commit is CustomCode.

Four passes found the same defect four times, one node at a time, over two days. Each fix cited the
previous one. The query that finds all five in one read is: *every call to `new Function` or `eval`
whose `catch` does not end in a port.* It is a grep, it takes ten seconds, and it was written into
this document as a rhetorical flourish before anybody ran it.

The generalisation is not "look for script hosts". Two of them:

1. **When a fix's own commit message says "the identical defect X had already fixed on Y", that
   sentence is a query, and the query has not been run.** Two nodes named in one message is the
   signal that a third exists.
2. **A class named by its exemplars inherits their category.** "The script hosts" meant CustomCode
   to four consecutive passes, and the fifth host had been sitting in Data the whole time. The
   defining property was `new Function`, not the folder.

### SR-ix — a reserved-name collision that a new port was blamed for, and predated it

NDA-004 §3 warned that giving `Function` a completion signal needed "a reserved name that cannot
collide", because its outputs are author-declared. On `Function` it solved itself — author outputs
are registered as `'out-' + name`. On `Logic Builder`, which registers block-declared names
verbatim, the collision was **already live and silent** against the node's existing ports: a block
writing `set output "error"` had its value discarded by `registerOutputIfNeeded`'s early return,
and a `Define input` named `run` was published as a second `run` port an author could wire a value
into.

So the risk the spec flagged as *a cost of the change* was a bug that had been there all along, and
the change is what finally made someone look. **Before accepting a stated cost of a change, check
whether it is already being paid.**

### SR-x — a context field that was built on every call and never delivered

`_createExecutionContext` assembled `__triggerSignal__` with a comment reading "for conditional
logic", and `_compileFunction`'s parameter list stopped one short of it. It read `undefined` inside
**every block program ever run**, so a node with two signal inputs could not tell which had fired.
Beside it sat a `this.sendSignalOnOutput` alias that could never have worked at all — a
`new Function` body is sloppy-mode and called with no receiver.

Both were unreachable, both typechecked, and both had comments describing what they were *for*. The
shape to carry: **a well-commented field is not an exercised one**, and the cheapest check is to
count the parameters at the call site against the ones at the declaration.

## NDA-012 Data — scope (2026-07-31), before the per-node pass

### DA-i — "listed in the index" is not "offered by the picker", and three documents had conflated them

Richard asked whether the Data nodes were waiting to be reprovisioned onto BYOB now that Parse is
retired, and whether the pass could skip them. Answering it needed the picker question settled, and
settling it corrected this document, the catalog, and the audit worksheets.

**On the premise first**, because it is the reusable part: what WF-007 retired was the Parse
*dashboard* and the hosted Parse *server*. The Parse **wire protocol** was deliberately kept —
`nodegx-backend/src/server/parse-wire.ts` implements `/classes/:c` and `X-Parse-Application-Id`
precisely because `api/cloudstore.js` speaks it, and every Record-family node goes through
`cloudstore`. So the Record family is the front door to the *built-in* backend, not stranded legacy,
and BYOB's five nodes are a **parallel** path for external backends rather than its replacement.
Nothing in Data is awaiting reprovisioning. Two further corrections to the handover's family table
fell out: the "legacy Object/Variable/Collection" family is not backend code at all (`Model2`,
`Collection2`, `Variable2` are client-side state primitives), and the Record family is **split
across two categories** — the verbs are `Data`, but `Record` itself, `Config`, `Cloud File` and
`Sign File URL` are `Cloud Services`, so a Data pass documents the verbs and not the noun.

**The picker finding.** The catalog's `inNodePicker` was reporting `true` for `REST2` and the four
`net.noodl.user.*` password/verification nodes. It is derived in
[`build-catalog.js`](../../../scripts/node-catalog/lib/build-catalog.js) from membership of the
curated index in `nodelibraryexport.ts`. But the picker does not render that index — it builds
through [`createnodeindex.ts`](../../../packages/noodl-editor/src/editor/src/utils/createnodeindex.ts),
which puts every listed name, core and module alike, through `getCreateStatus`, and
[`componentmodel.ts:292-295`](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L292-L295)
returns `creatable: false` for anything deprecated. Five deprecated types are nonetheless listed.

Measured live, in the running editor, against a real `ComponentModel`:

| | |
|---|---|
| Curated index lists | 126 |
| Picker offers | 121 |
| Dropped by the filter | **5 — exactly the five deprecated-but-listed types, and nothing else** |

Five non-deprecated controls (`net.noodl.HTTP`, `SignUp`, `LogIn`, `Group`, `DbModel2`) stayed
`creatable: true`, so the filter's only effect is deprecation and the catalog can mirror it exactly.
`inNodePicker` now ANDs with `!deprecated`; regenerating flips those five booleans and **nothing
else — strip that one field and the catalog is byte-identical to HEAD.**

**The consequence for the auth surface is larger than the flag.** Six nodes are unreachable from the
picker by *two different mechanisms* with the same outcome: `SignInWith` and `RequestMagicLink` are
creatable but **not listed** (CS-i), and the four password/verification nodes are **listed but not
creatable** (this finding). So password reset and email verification have no picker presence at all
— and BAK-002 shipped the server-side flows they would drive.

Three lessons, and the first two are this phase's own rules pointed at its instruments:

1. **A flag named after a user-visible fact is not that fact.** `inNodePicker` meant "in the curated
   list" for the life of the catalog. It misled a handover (which planned 30 minutes of work on
   `REST` because it was "in the picker"), CS-i, and `scripts/node-audit/worksheets.js`, which
   stamps "not in picker" onto every worksheet the phase audits from.
2. **A predicate with two filters cannot be mirrored by copying one of them.** The catalog copied
   the listing and not the creatability check. The fix is not more data — it is applying the second
   filter the editor already applies.
3. **The diagnosis was wrong twice before it was right.** The first mechanism proposed for the five
   was the `|| !!metadata.module` fallback clause, and a discrimination check appeared to confirm it
   — 25 deprecated controls read `false`, 5 read `true`. The check passed for the wrong reason: all
   five are in the curated index, so the module clause never fired. **A discrimination check
   confirms a partition, not the mechanism you attribute it to** — the controls were consistent with
   two different causes and only reading the index told them apart.

### Scope decided — and then the pass held

🛑 **Held the same day.** Richard is mid-sprint **merging all backends into the same Data nodes**, so
the per-node pass waits for it. The hold is about sequencing, not scope: NDA-012's checks and
NDA-005's C1 are written *per port*, and the merge is a change to which ports exist. **Visual (29)
is the unblocked category and goes next.** On resume, re-derive the inputs rather than inherit them
(regenerate the catalog; `rm audit/data.md` first, since `worksheets.js` never overwrites; re-measure
before planning) and **read the merge diff as an audit input** — new backend plumbing is where this
phase's recurring shapes come back.

Richard's call, 2026-07-31: **drop the deprecated nodes.** Data's pass covers **42 nodes / 471
ports**, not 46 / 517. The four dropped (`Collection` 17 ports, `Model` 11, `REST2` 9, `Variable` 9)
are 46 ports, 8.9% of the category, and **all four are at 0%**, so nothing already earned is lost
and the coverage denominator changes rather than the numerator. `REST`'s compile-failure defect
(SR-viii, the fifth script host) is **filed and not fixed**: it is real, but it fires only for a
project that already contains a REST node, and the 2026-07-30 fresh-start decision puts legacy
projects outside the design constraints.

## NDA-012 Data — the Record CRUD family (2026-08-01), 6 of 37 nodes

The hold is lifted: phase 34 landed, the catalog was regenerated, `audit/data.md` was deleted and
regenerated, and every number below is measured after the merge rather than inherited. **Data is 41
nodes in the catalog, 37 in scope** — the five `noodl.byob.*` entries the old worksheet carried no
longer exist, so the pre-merge figure of 42 was already stale when it was written down.

Six nodes read: the five Record verbs plus Filter Records. **Four defects, in four of the six.**

### DA-ii — a relation to an unloaded record burns the relation name, permanently

The headline, and it is a data-corruption defect reachable from an ordinary graph.

`Add Record Relation` sends `targetCollection: Model.get(targetModelId)._class`. **`Model.get` mints
a record on read** (`model.ts:232`), so an id that arrived from a URL parameter, a text input or a
Function node — rather than from a Query Records result — resolves to a record nothing has ever
loaded, whose `_class` is `undefined`. `validateInputs` checked that the *id* was present and never
that the *record* was known, which is precisely the distinction that matters.

**Measured against the rig's Parse Server rather than reasoned about**, and the measurement is worse
than the reading suggested:

| Step | Result |
|---|---|
| `AddRelation` with `className` | `200` — the working path |
| `AddRelation` with `className` omitted | `107 Could not add field enemies` — so the node *does* report failure |
| schema afterwards | `"enemies":{"type":"Relation","targetClass":"undefined"}` — **written anyway** |
| the same relation, retried correctly | `111 schema mismatch … expected Relation<undefined> but got Relation<nda012_Target>` |

So the failing attempt is what destroys the schema, and the author who then fixes their graph finds
it still never works. `Remove Record Relation` carries the identical line and the identical gap.

Both **fixed**: one `targetCollection()` reader per node so the validation and the request cannot
disagree, refused in `validateInputs` with a sentence that names the cause and the fix. Rows D3/D4.

⚠️ **This is the phase's third recurring shape — a create-on-read lookup fed by a value that can be
absent — with a twist worth carrying: here the value is *not* absent.** The id is present and valid.
What is absent is the *record behind it*, and no amount of validating the input catches that. The
earlier instances (`Model.get(undefined)`, `Record`'s cleared `Id`) were all "the key is missing";
this one is "the key is fine and the registry invented the row". A sweep looking for the first shape
would not have found it.

### DA-iii — two ways an Access Control rule silently does nothing

Both in the shared `_getACL` (`dbmodelcrudbase.ts`), so `Create Record` and `Update Record` share
them. Both confirmed by driving the real mixin.

**(a) A rule whose `Target` was never opened contributes nothing.** The runtime tested
`rule.target === 'everyone' / 'user' / 'role'` and fell through all three when `target` was
`undefined` — while the node's *own port builder*, twenty lines up, reads
`parameters['acl-…-target'] === undefined || === 'user'` when deciding whether to offer the
`User Id` port. The author-facing half had always read an untouched dropdown as "the current user";
the runtime half had not. The reachable path is ordinary: `-target` is a dynamic port, so its
declared `default: 'user'` never runs a setter unless the author opens the dropdown, while toggling
`Read` or `Write` *does* create the rule object. **"Add a rule, untick Write" produced an ACL
identical to adding no rule at all**, and the record was written with no access control whatsoever.

**(b) A `user` rule that cannot resolve a user writes the key `"undefined"`.** With no `User Id`
wired and nobody signed in, `acl[userId] = _rule(rule)` keyed on the four-character string. Two
consequences, both bad: the record is locked to a principal that cannot exist, and because
`Object.keys(acl).length > 0` is then true, the function returns that ACL instead of `undefined`, so
the "no rules, no ACL" path cannot rescue it. **A record created that way is unreadable by everyone,
including its author.** The `rule === undefined` branch ten lines above has always guarded exactly
this case — the two branches simply disagreed.

Both **fixed**. Rows D1, D2.

⚠️ **The reason this had no coverage is worth more than the defects.** `record-backend-routing.test.ts`
— the suite that exists to prove these nodes talk to the right backend — stubs `_getACL: () => undefined`
in its instance factory. That is a reasonable stub for what it was testing and it made the entire ACL
path invisible to the only tests that drive these nodes. **A stub in a shared test factory is a
coverage hole with no warning label**, and it is not visible from the file that has the defect.

### DA-iv — `Delete Record` described creating, and the string reaches nobody

`shortDesc` carried `Create Record`'s sentence verbatim — *"Stores any amount of properties and can
be used standalone or together with Collections and For Each nodes."* — on the node that deletes one.

**Fixed, and recorded as reaching nobody today**, which is the more useful half. `shortDesc` is not
exported to the node catalog: regenerating after the change produced a byte-identical file. Its only
consumer is the AI authoring loop's `ContextBuilder.ts:228`, as `enriched?.summary ?? node.shortDesc`
— and this node's enrichment summary is present and correct, so the fallback never fires.

⚠️ **The field is rotting across the category, not just here.** Four sibling nodes —
`Insert Object Into Array`, `Remove Object From Array`, `Array`, `Create New Array` — all carry the
*same* sentence, *"A collection of models, mainly used together with a…"*, describing the noun on
four different verbs. Fifty sites declare `shortDesc` across the three runtime packages. It is the
same shape NDA-005 §0 found in `description`: **a field an author is invited to write, which no
consumer reads.** Filed for the Array family pass rather than swept here.

### DA-v — Filter Records grows the global record registry, one `save` at a time — filed

`cloudStoreEvents` calls `Model.get(args.objectId)` on **every** `save` for the class it watches, to
ask whether its collection contains that record. `Model.get` mints on read, and `models` is a strong
map, so a record this node does *not* hold is created in the global registry and left there for the
life of the page.

**Filed rather than fixed**, with the reasoning: the guard wants `Model.exists`, but the very same
line is also the documented wrong-scope read — it reaches the global `Model` rather than
`nodeScope.modelScope`, so under a scoped store the `contains` test compares against a record from
the wrong store and the re-filter is skipped anyway. Repairing one half without the other would fix
the leak and leave the node still not re-filtering. It wants both, together, with a scoped-store
fixture that does not exist yet.

### Checked and clean — recorded so they are not re-raised

- **`acl-<id>-<field>` is safe from the `split('-')` class (SR-iii).** Proplist item ids are 4-char
  base-36 (`PropListType.ts:74-81`), and base-36 contains no hyphen, so `name.split('-')` always
  yields exactly three parts. This is the first instance of that class that turned out to be fine,
  and it is fine *for a reason a future edit could remove* — a change to the id generator would break
  it silently.
- **Filter Records' `setup` is not missing existing nodes.** It registers only
  `nodeAdded.FilterDBModels` where the CRUD base additionally enumerates `getNodesWithType` after
  `editorImportComplete`. `GraphModel.addComponent` emits `nodeAdded` for every node already in the
  component (`graphmodel.ts:232`), so both patterns are covered. The `editorImportComplete` wrapper
  is about metadata ordering, not about missing nodes.
- **`displayNodeName` vs `displayName`.** The family uses both spellings; `nodedefinition.ts:264`
  resolves `opts.displayNodeName || opts.displayName`, so they cannot diverge.

### Standing, not re-raised

`Delete Record` alone reads `nodeScope.ModelScope` — capital M — a defect documented and left
verbatim since PLAT-003, so it ignores the component's record scope where Create, Update and both
relation nodes honour it. Fixing it is a behaviour change for any scoped-store project. Still unowned.

### DA-vi — the third silent success, in a family NDA-004 had already worked over

`Remove Object From Array` reports `Done` for a removal that cannot happen.

NDA-004 §2 fixed the two failures this node could *detect* — no array bound, no Object Id supplied.
It left the one an author is most likely to hit, because from inside the node an unknown id looks
exactly like a good one. It is not: `Model.get` mints on read, so an unknown id produces a brand-new
object that by construction is not in the array; `Array.prototype.remove` finds `indexOf === -1` and
returns silently (`collection.ts:606-614`); and the node then sends `Done`. **Measured: an array of
size 1, removing an id never loaded, stays size 1 and reports success.**

`collection-failure.ts`'s own header names this exact thing — *"A completion signal for work that
went nowhere is the one thing the Failure Contract says must never happen"* — while describing the
throwaway-array case. **The rule was written down and applied to one of its two causes.** Fixed with
`Model.exists`, which covers the weakly-held anonymous tier too, so a record reachable only through
the array itself is still removable; that control is the load-bearing row.

⚠️ **The lesson is about how the previous pass scoped itself.** NDA-004 §2 read these three nodes
carefully, wrote a shared helper, and stated the principle in the helper's own docstring. It still
missed this, because it was looking for *nodes that stay silent when they fail* and this is a node
that **succeeds loudly when it fails**. A sweep framed around one symptom will not find the other,
even in a file it is editing.

Recorded and deliberately **not** fixed: removing a record that exists but sits in a *different*
array is still `Done`. That one is genuinely ambiguous — idempotent "make sure this is not in here"
is a defensible reading — so it is pinned by a row rather than changed.

⚠️ **`Model.get`-as-a-lookup is now four sites in this category alone**: both relation nodes
(DA-ii), Filter Records' save handler (DA-v), and this. It is the phase's third recurring shape and
the Data category is where it concentrates, because Data is where ids arrive as strings from
outside the graph. **A `Model.get` whose result is only ever *read* from, or handed to something
that compares by identity, is a `Model.exists` question wearing a `Model.get` costume.**

## NDA-012 Data — closing the category (2026-08-01), 29 nodes in a four-worker batch

Data closed at 37/37. 26 new defects, 13 fixed and 13 filed. Per-node detail is in
`WORKER-{A,B,C,D}-NOTES.md`; what follows is only what reaches outside the nodes it was found in.

### DB-i — the two instrument defects, which outrank every node finding here

**(a) The `B1` pre-fill has been answering a different question for fifteen categories.**
`scripts/node-audit/worksheets.js:55` derives the machine-filled `B1` column by matching
`/fail|error/i` against output **names**. A node with a *string* port called `Error` and no failure
signal at all therefore reads **"✅ has one"**. Worker A found four such nodes in one directory —
they ended a signal input on an error string with no signal and no raise, while five siblings in the
same directory have both. **Every category audited so far read that column**, and the phase's own
rule about pre-filled data — that it is a hint, not a verdict — is the only thing that has been
protecting it.

**(b) `Model.get(undefined)` cannot be reached over a connection.** `Node.prototype.sendValue`
returns early on `undefined` (`node.ts:635`), so the reachable empty values are `null` and `''`.
The phase's third recurring shape has been written down as *"a create-on-read lookup fed by a value
that can be absent"* and its canonical spelling has been `Model.get(undefined)` since NDA-004 §2 —
which reached it through an **internal walk**, not a wire. ⚠️ **A sweep hunting the `undefined`
spelling over connections would find nothing and conclude the class was clean.** `typeof null ===
'object'` is what actually routes a cleared value into `Model.create(null)`.

The same line has a second consequence Worker C had to design around: **a value output cannot be
cleared.** Flagging an output whose value is `undefined` sends nothing, so the downstream input keeps
what it last received — which is why `HTTP Request`'s stale `Status Code` after a failure is pinned
by a row rather than fixed.

### DB-ii — a declared `default` never runs its setter, and three nodes did nothing at all

`registerInput` writes a declared `default` straight into `_inputValues` (`node.ts:116-118`), and
`NodeScope` queues for update only the keys the *model* carries (`nodescope.ts:148-157`). So a port
that has a default and no authored parameter is **never set**, and any node whose real work happens
in a setter side effect does nothing until an author touches an input.

`Global Store`, `Subscribe to Store` and `State History` were all built that way. **Fixed.**

⚠️ **It was invisible from the canvas, and that is the transferable part.** The property panel shows
the default, so the node looks configured; and `Global Store`'s `State` getter reads the manager
directly, so *reading* the node worked — only the reactions were missing. **"It declares a default,
therefore it behaves as configured" is false in this runtime**, and the predicate — *a node whose
real work is a setter side effect and all of whose ports have defaults* — is mechanical, so it can
be swept for. It found three dead nodes in fifteen and **has never been run outside Data.**

### DB-iii — the third recurring shape has a fourth site, and it is a *shared* record

`Model.get('')` and `Model.get(null)` are the **named** tier: one record per spelling, kept for the
life of the process and shared by every node in that state. `Set Object Properties` with `Id = null`
wrote into `Model._models['null']` and fired `Done` — a write reported as a success, into a record
no id can read back, colliding silently with every other node whose Id happened to be blank.

**One shape, four sites, two of them still open**: `dbmodelcrudbase.ts:423` and `dbmodelnode2.ts:235`
carry it byte-for-byte, and in the Record family it lands on **DA-ii's schema-burning mechanism**.
Worker C could not fix them (Worker D's territory) and Worker D was descriptions-only, so they are
filed and **unowned**. That is a cost of the parallel seam and it is recorded as one.

### DB-iv — new code carried fewer defects than old code, which contradicts the standing warning

The fifteen agentic/streaming nodes are the newest in the library (AIX-005) and **had never been
read by any pass**. The phase's standing rule is that unread means unaudited, not clean — and the
expectation from the hold was that the *newest* code, the phase-34 backend merge, would carry fresh
instances of the known classes.

Both predictions went the other way. The never-read new code scored **0.93 per node, the lowest in
the phase**, with two nodes completely clean. The batch's worst defects were in the **oldest** code:
the Object family's dirty-value flush, and `Variable` writing a key literally named `undefined`.

⚠️ **This does not retire the warning** — the same never-read directory is where DB-ii's three dead
nodes were. It qualifies it: *unread* predicts nothing about density either way, and a category's
age is not the ordering heuristic it looks like.

### DB-v — a cloud function cannot make an HTTP request

Found by pushing on a worker's stale-premise report rather than filing it.

| | `availableIn` | deprecated | in picker |
|---|---|---|---|
| `net.noodl.HTTP` | `["browser"]` | no | yes |
| `REST2` | `["browser","cloud"]` | **yes** | **no** |

Across all 57 cloud-available types the only other candidates are `Sign File URL` and
`noodl.cloud.request` — and the latter is the function's **incoming** trigger (`singleton`, *"Fires
when a request arrives"*), not a client. **So there is no pickable outgoing-HTTP node in a cloud
function at all.**

⚠️ **The attribution matters and is easy to get wrong.** This is *not* caused by DA-i. The editor has
always filtered deprecated types out of the picker (`componentmodel.ts:292-295`); DA-i only made the
catalog mirror it. **DA-i did not create the hole — it made it discoverable**, which is the argument
for that fix rather than against it. NDA-011 decided *"deprecated, not deleted"* without this fact in
front of it.

### DB-vi — a green count with new noise beside it is not a green gate

The runtime suite began reporting *"a worker process has failed to exit gracefully"* while showing
**0 failures**. Bisected: `Optimistic Update — an Apply that works` leaves the transaction open, and
an open transaction owns a rollback `setTimeout` until something commits, rolls back or deletes the
node. **The product code was correct** — `_onNodeDeleted` clears it — so this was test teardown.

Three things worth keeping. **A single test file runs in-band**, so the leak was invisible when the
suite was run alone and appeared only once a second file forced a worker process — *"it passes on its
own"* was true and meaningless. **`--detectOpenHandles` reported nothing**, because it forces
in-band; the bisect had to be by pairing. And the fix is to **delete the node**, not to fake timers,
because `_onNodeDeleted` clearing that timer is the H1 contract the family is being audited against —
so the teardown doubles as its control.

### Checked and clean — recorded so they are not re-raised

- **`instanceof Collection` answers differently in jest and in the shipped build.** `class
  CollectionImpl extends Array {}` at `target: es5` makes it `false` under `noodl-viewer-react`'s
  ts-jest and `true` in the product. Measured at both targets. It briefly read as an A1 defect; it is
  not, but **two `instanceof Collection` branches in the Array family have never been exercised by
  any test** and one existing corpus premise rests on the jest answer.
- **`shortDesc` reaches nobody, and DA-iv named the wrong cause.** DA-iv attributed it to enrichment
  summaries shadowing the fallback. The real cause is one level up: `build-catalog.js` writes
  `shortDesc` on a single hard-coded line and it is **not in the catalog for any core node**, so
  `ContextBuilder`'s `?? node.shortDesc` cannot fire regardless of enrichment. Fifty sites declare it.
  Whether it should exist at all is a decision for Richard.

## DC — Run Tasks and the start of Visual (2026-08-01, second session)

### DC-i — a node audited for one contract is not an audited node

**`Run Tasks` was worked over four times by NDA-009 and nobody ever ran it.**

NDA-009 §1–§4 are about the *template contract* — the three port names the node matches by string
against its template — and they are thorough: an editor-time check, the names made configurable,
per-task failure reporting, a node-card affordance, two corpus files, 35 rows. **Not one of them
starts, aborts or finishes a run.** Five defects were sitting in the eighty lines between `run` and
`checkDone`, and two of them **permanently disabled the node**:

| | Measured, through a real graph |
|---|---|
| `Abort` with nothing in flight | `state=aborted` for ever; every later `Do` did nothing, silently |
| `Stop On Failure` after one failure | `state=running` for ever; every later `Do` did nothing |
| `Max Running Tasks = 0` | silent hang — no signals, no errors, no tasks, no end |
| `Do` with no template | nothing at all; `editorConnection.sendWarning` was the only report |
| Empty `Items` list | `success` but no `done` |

⚠️ **Neither wedge is author error.** One is the author pressing their own `Abort` button; the other
is ticking the node's own `Stop On Failure` option. The node then did nothing for the rest of the
page's life and said nothing about why.

Two shapes here are already named in this document and recurred anyway. The editor-only preconditions
are **B2** exactly, the class NDA-004 §2 swept the Data nodes for — Run Tasks was not in that sweep
because it is `std-library/`, not `std-library/data/`. And `Done` firing on only one of four terminal
paths is the sequencing half of **B3**: an author who wired "when the run is Done, do the next thing"
had their graph stop dead precisely when there was **no work to do**, because an empty list is the
common case, not an edge one — a query that matched nothing hands this node `[]`.

The counting lesson: `Run Tasks` had been carried in this phase as *"the only in-scope Data node
still at 0%"*, i.e. as a documentation gap. It was the densest single node in the category.

### DC-ii — Visual's C1 is concentrated, not large

Visual looked like the phase's biggest documentation job: **593 undocumented ports across 20 nodes**,
more than Data had ports in total. Measured, the *work* was nothing like the count. **34 port names
accounted for 262 of them** — `mounted` on 17 nodes, `variant` on 14, `enabled` on 13, the border,
corner-radius and text-style families on 8 each — and most are **generated**, not declared:
`defineBorderTab` and `defineCornerTab` each emit 5 ports per node, the text-style block emits 7.

**About 20 sentences, written into two files, closed 269 port instances** and took the category from
51.6% to 73.6%. `PORT-DESCRIPTION-STYLE.md` §"Where to write them" had predicted exactly this and
named the same two files; this is its first confirmation at category scale.

⚠️ **Two things the concentration analysis got wrong, both caught by re-measuring afterwards:**

- **`backgroundColor` is not shared machinery.** It looked like it — 8 nodes, no descriptions — but
  it is declared at **8 separate per-node sites**. A name appearing on many nodes does not mean one
  declaration, and the grouping has to be done by *declaration site*, not by name.
- **`Slider` carries its own private copy of `addBorderInputs`** (`slider.ts:225`). So the shared
  generator's descriptions do not reach its ~40 `thumbBorder*`/`trackBorder*` ports — and, more
  seriously, **no fix to the shared border ports has ever reached Slider, or ever will.** Whether the
  two copies have drifted in *behaviour* is unchecked and is the open question, not the duplication.

### DC-iii — the Empty-Value Contract, where the end user can see it

`Text` rendered `String(props.text)`, so a `null` value painted **the four characters `null` on the
page**. `null` and `undefined` are ordinary arrivals there: a record property nobody filled in, a
Function node's early return, a Repeater item missing a field. Class **A2** already records this
`String(value)` cast against the String *variable*, where the garbage at least stays inside the
graph; here it is on screen, and no one had looked.

The same cast one layer down: `getAbsoluteUrl(null)` is the literal path `/null`, which `Image` and
`Video` handed to the browser, which fetched it and 404'd. On `Video` that meant **NDA-004 §2's own
`Playback Failure` port was firing for an empty input as well as a broken one** — the Failure
Contract's "must not raise on a legitimate empty result", reached from the empty-value side rather
than the failure side, which is why that pass did not see it.

⚠️ **The guard must test `null`/`undefined` explicitly, not truthiness.** `0` and `false` are
legitimate things to put in a Text node and `!value` blanks both. Pinned by controls.

### DC-iv — the cost of parallelism, paid in full this time

The Data batch's seam stranded two defects in a territory gap (OB-ii's last two sites), and the
handover named picking them up as the first job of this session. **Done** — and measuring them first
showed the shape was worse in the Record family than in the Object family, exactly as predicted: a
minted record has `_class === undefined`, which is DA-ii's schema-burning value, so a blank `Id`
reached `Update`/`Delete Record` as `objectId: ''` against `className: undefined`.

⚠️ **And a guard in the obvious place would have measured as fixed while the reachable path stayed
broken.** `dbmodelnode2.ts` has *three* routes to the shared record, and the third — `modelId.set`'s
`typeof value === 'object'`, which catches `null` and diverts it into `Model.create(null)` — runs
**before** `setModelID`. A row driving `setModelID` directly would have gone green. The corpus row
drives the input setter a wire actually reaches, which is the only version of the test that means
anything.

**This session's own seam did worse than the Data batch's**, for a reason outside the code: all three
Visual workers were terminated mid-task by an account monthly spend limit, none having committed.
Their uncommitted work was reviewable and mostly good, and was salvaged, verified and pinned by the
orchestrator — but **none of it had tests**, and two of the four behavioural claims could not be
measured without a DOM and a frame clock. Those are named in the corpus file rather than left silent.
The generalisable point: **a parallel batch's work is only as safe as its last commit**, and a brief
that says "commit small and often" is not a style preference.

## The Visual per-node audit (NDA-012, 2026-08-01)

### DV-i — DB-ii has now been run outside Data, and the answer is "two, out of 242"

The predicate is differential and mechanical: build the same node twice — once with no authored
parameters, once with exactly one port authored at *its own declared default* — and diff the
resulting instance state. Anything that differs is a setter side effect the declared default failed
to produce. Pinned in
[`nda-012-visual-declared-defaults.test.ts`](../../../packages/noodl-viewer-react/tests/corpus/nda-012-visual-declared-defaults.test.ts).

**687 ports in Visual declare a `default` and carry a custom `set`. 242 of them differ. Two are
defects.** That ratio is the finding, and it is the opposite of Data's — where the predicate found
three dead nodes in fifteen.

⚠️ **The reason Visual is not full of dead nodes is a second route Data does not have.**
`react-component-node` copies `inputProps`/`inputCss` defaults into `props`/`startStyle` at
[`react-component-node.ts:753-766`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L753-L766)
and [`:827-846`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L827-L846). So for
a Visual node the interesting shape is not "DB-ii fires" — it fires 242 times — but **"DB-ii fires
*and* the second route is also blocked."** That conjunction happens twice.

### DV-ii — `Button` and `Icon` declare a padding default that reaches nothing

`addPaddingInputs` gives all four of its ports `applyDefault: false`
([`node-shared-port-definitions.ts:277`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L277),
`:291`, `:310`, `:327`), which is exactly the switch that blocks the `startStyle` route. DB-ii blocks
the setter route. Fourteen nodes call the generator; **twelve pass `0`, so losing the default costs
them nothing — and the two that pass a non-zero value are the two that are wrong**:
[`button.ts:64-71`](../../../packages/noodl-viewer-react/src/nodes/controls/button.ts#L64-L71) (20px
horizontal, 5px vertical) and
[`icon.ts:30-37`](../../../packages/noodl-viewer-react/src/nodes/visual/icon.ts#L30-L37) (5px).

A freshly-dropped Button renders with its label flush against its edges while the property panel
shows Pad Left 20. **No node's `defaultCss` sets padding**, so the `applyDefault: false` guard is not
protecting anything; it only costs these two nodes their declared padding.

### DV-iii — `Component Stack` says it clips and does not

[`navigation-stack.tsx:258-266`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-stack.tsx#L258-L266)
is the only thing that writes `overflow: hidden`, its port declares `default: true`, and the node's
`defaultCss` (`:211-217`) has no `overflow`. So a stack whose panel reads "Clip Content ✓" lets a
pushed component taller than itself spill out. It is the category's only non-`safe` SSR node and its
lifecycle is its whole job, which is why H1 was worth running on it.

⚠️ **`Page Router` has the identical port shape and is fine**, which is what makes this a defect
rather than a pattern: the Router's default enum value takes the `removeStyle` branch
([`router.tsx:180`](../../../packages/noodl-viewer-react/src/nodes/navigation/router.tsx#L180)),
a no-op on a node that never had the style. Not running *that* setter costs nothing.

### DV-iv — the four mechanisms that absorb the other 240, measured rather than asserted

These are pinned as rows in the same file, deliberately. **Without them the next person to run the
predicate reads 242 and files 242 defects.**

| Absorber | Where | What it covers |
|---|---|---|
| `name = name \|\| 'Main'` at all four entry points | [`navigation-handler.ts:52`](../../../packages/noodl-viewer-react/src/nodes/navigation/navigation-handler.ts#L52), `:63`, `:68`, `:105` | `Component Stack`'s `Name` and `Navigate`'s `Stack` both stay `undefined` and still resolve |
| `props.parentLayout \|\| 'column'` | [`layout.ts:126`](../../../packages/noodl-viewer-react/src/layout.ts#L126) | `Radio Button Group`'s `Layout` never calls `setLayout`, and the fallback is the declared default |
| `toPixels` accepts number or string | [`Columns.tsx:41`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L41) | `Columns`' `initialize` mirror seeds raw numbers where the framework would have written `'16px'` — NDA-006 already closed the arithmetic |
| the authored value **is** the CSS initial value | — | the large majority: `translateX(0px)`, `mixBlendMode: normal`, `pointerEvents: auto`, `borderStyle: none`, zero paddings and gaps, `position: relative`, `opacity: 1`, `flexWrap: nowrap`, `wordBreak: normal`, `textTransform: none`, `backgroundColor: transparent` |

⚠️ **`Columns` is worth reading twice.** Its `initialize()`
([`columns.ts:27-34`](../../../packages/noodl-viewer-react/src/nodes/visual/columns.ts#L27-L34))
mirrors four defaults, and it runs *after* the framework's default→props copy
([`react-component-node.ts:864`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L864)),
so **the hand-written mirror overwrites the framework's correct `'16px'` with a bare `16`.** A mirror
written to work around DB-ii can reintroduce the type confusion the framework had already got right.

### DV-v — the `Auto` sentinel is unit-suffixed on one port and not the other

`letterSpacing` and `lineHeight` both default to the sentinel string `'Auto'`, and only
`letterSpacing` is declared with `units: ['px']`. So authoring the value the panel already shows
produces `letter-spacing: Autopx` — not a CSS value at all — while `lineHeight` yields a plain
`'Auto'`, which is also not a CSS value, but a different one. Five nodes carry the pair (`Text`,
`Checkbox`, `Dropdown`, `Radio Button`, `Text Input`, the last on both its own and its label's ports).

The net effect is benign — a browser drops an invalid declaration, which is roughly what "Auto" is
asking for — but **the two ports spell one intent two ways and neither is the CSS keyword**, so
anything that reads the style back (an export, an SSR pass, a style inspector) sees one of two junk
values. Recorded rather than fixed: the correct spelling is a decision about what `Auto` means.

## What these passes did *not* cover

- **76 of 155 nodes** have only their machine-derived smell row in `NODE-REGISTER.md`. No
  implementation has been read for them. The second pass is direct evidence that the structural sweep
  under-reports: five real defects in the first six nodes anyone looked at closely.
- ~~**Two findings are unfinished.**~~ **Both closed 2026-07-29 in the running editor, and both
  turned out to be aimed at the wrong file** — which is the strongest argument in this document for
  the "reproduce before speccing" rule. The Component Stack does not scroll (NDA-008 §0); the Text
  sizing default was never unset, and the real defect was a stale `parentLayout` (NDA-016 §0).
- No live verification of *any* finding. Everything here is read from source.
- Deprecated-node dispositions (23 nodes) have not been decided.
