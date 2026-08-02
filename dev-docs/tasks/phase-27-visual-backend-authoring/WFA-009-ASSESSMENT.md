# WFA-009 — Assessment

**Written before any WFA-009 code**, the way WFA-004 and WFA-006 recorded their decisions before
touching anything. The spec hands the executor one question and asks for evidence before it is
answered: where do value-derived ports come from, **(a)** a declarative rule in the node library or
**(b)** a restored cloud-runtime editor connection.

The answer is (a), but the framing needs one correction and the scope needs one addition, both below.

**Spec:** [WFA-009-RESPONSE-NODE-PORTS.md](./WFA-009-RESPONSE-NODE-PORTS.md)

---

## 0. Step 1 first: which fault is load-bearing? — **`registerInputIfNeeded`, and the exporter is out of scope**

The spec makes this the first deliverable because it decides whether the task touches
`utils/exporter/util.ts` at all. It is answered by a run, not by reading.

A `BackendService` was booted on **port 8711** over a hand-written bundle shaped exactly like
today's exporter output — the Response node carries `"ports": []`, because `noodl.cloud.response`
does not set `exportDynamicPorts` and never will under this change. One `pm-` port is fed by a
**connection**; a second is fed by a **literal parameter** with no connection at all, which is what
a value typed into the port exports as:

```jsonc
{ "id": "res", "type": "noodl.cloud.response",
  "parameters": { "params": "total,note", "pm-note": "a literal typed into the port" },
  "ports": [] }                                   // ← nothing dynamic in the export
// connections: req.pm-total → res.pm-total, req.receive → res.send
```

`POST http://127.0.0.1:8711/functions/returnsAValue` with `{"total": 42}` answered:

```
STATUS 200 BODY {"result":{"note":"a literal typed into the port","total":42}}
```

Both halves arrived. So:

- **A connection is enough.** `NodeScope.addConnection` calls
  `targetNode.registerInputIfNeeded(connectionData.targetPort)` before connecting
  ([nodescope.ts:120](../../../packages/noodl-runtime/src/nodescope.ts#L120)), and `response.ts`'s
  hook mints the `pm-` input on demand.
- **A literal is enough too**, by a second, independent route: `NodeScope.setNodeParameters` calls
  `registerInputIfNeeded` for every parameter name before queueing it
  ([nodescope.ts:149](../../../packages/noodl-runtime/src/nodescope.ts#L149)).
- **`exportDynamicPorts` is therefore not needed, and must not be set.** Setting it would write the
  ports into the export where nothing reads them; it changes the artefact without changing the
  behaviour.

This is corroborated by a suite that has been green since WFA-003 without anyone noticing what it
proves: `nodegx-backend/tests/workflow-data-mapping.test.ts`'s `echoFunction` fixture writes
`ports: []` on both nodes and wires `pm-*` across them, and 15 specs assert on the response bodies
(re-run for this task: **15 passed**). The register's original "the exporter drops the ports" entry
stays corrected, and WFA-006's correction of it is now backed by a run rather than by a reading.

**One thing this run also settles:** the port must exist *in the editor* for the author to wire it,
and only there. Nothing downstream of the canvas needs to know the port ever existed. That is the
whole reason (a) is a legitimate answer at all.

---

## 1. The correction: the spec's third fact is not true

Spec §Background fact 3 says:

> The editor has no local machinery that could do it instead. […] **Nothing in the editor can derive
> a port from a parameter's value**, which is exactly what `pm-<name>` needs.

That is wrong, and it is wrong in a way that changes the answer. The editor derives `pm-<name>`
ports from a comma-separated parameter **today, in shipped code, for a node that is not a cloud
node**:

```ts
// models/NodeTypeAdapters/PageInputsAdapter.ts — updatePortsForNode
node.parameters['pathParams'].split(',').forEach((p) => (uniqueNames[p] = true));
node.parameters['queryParams'].split(',').forEach((p) => (uniqueNames[p] = true));
Object.keys(uniqueNames).forEach((outputName) => {
  ports.push({ name: 'pm-' + outputName, displayName: outputName, type: '*', plug: 'output', group: 'Parameters' });
});
node.setDynamicPorts(ports);
```

`RouterNavigateAdapter` does the same for its `pm-<name>` **inputs**, and `RouterAdapter` derives
ports from the project's component list. All three are registered and running
([registeradapters.ts](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/registeradapters.ts)),
driven by `Model.nodeAdded` / `Model.parametersChanged` / `projectLoaded`, and none of them needs a
runtime.

What is true is the narrower statement the spec's trap makes correctly: **`conditionalports/*` is a
filter over statically declared ports and cannot express `pm-<name>`.** The commented-out block at
`nodelibrary.ts:117-130` names four managers whose classes (`NodeLibrary.DynamicPortNumbered`,
`…Channel`, `…Expand`) no longer exist anywhere in the repo — those really are gone. But the
*capability* was never lost; it moved from the library into `NodeTypeAdapters` and stayed there.

So the real question is not "(a) declare it or (b) bring back a runtime". It is:

> **The editor already derives ports from parameter values. Should the two cloud nodes get their own
> hand-written adapters, like `PageInputs` and `RouterNavigate` did — or should the rule be declared
> once, next to the `setup()` it mirrors, and read by one evaluator?**

(b) is dismissed on the spec's own grounds and needs no further argument here: WF-007 deleted that
window deliberately, WFA-001 chose the generated library over it deliberately, and re-introducing a
long-lived cloud runtime process to author against would be a phase, not a task. Nothing found while
answering §0 argues for reopening it. It is also, on the evidence above, unnecessary: the runtime
does not need to be told about these ports — it mints them itself.

---

## 2. The decision: one declarative rule in the library, one generic evaluator in the editor

**Chosen: a `namedports/list` entry in the node's own `dynamicports`, evaluated by a single
node-agnostic adapter.** Not a `ResponseNodeAdapter`.

```ts
// noodl-viewer-cloud/src/nodes/cloud/response.ts — ten lines above the setup() it mirrors
dynamicports: [
  { name: 'conditionalports/extended', condition: 'status = success OR status NOT SET', inputs: ['params'] },
  { name: 'conditionalports/extended', condition: 'status = failure', inputs: ['errorMessage'] },
  {
    name: 'namedports/list',
    condition: 'status = success OR status NOT SET',
    parameter: 'params',
    port: { name: 'pm-{{*}}', displayName: '{{*}}', type: '*', plug: 'input', group: 'Parameters' }
  }
]
```

Four properties decide it against a per-node adapter:

1. **The two cloud nodes that need it differ only in `plug` and a condition.** Request needs the same
   rule with `plug: 'output'` and no condition (see §4). Two hand-written adapters would be one
   algorithm typed twice; one rule is two data entries.
2. **The rule sits in the file it must agree with.** The drift WFA-004's F42/F43 warn about is a
   function of distance. `setup()` and the rule are now in the same file, ten lines apart, and a
   test asserts they emit identical ports (§5). A `ResponseNodeAdapter` in `noodl-editor` would be
   two packages away from the code it duplicates.
3. **It travels with the generated library, which is the thing WFA-001 built.** `formatDynamicPorts`
   already passes an entry with a `port` key through verbatim
   ([nodelibraryexport.ts:124](../../../packages/noodl-runtime/src/nodelibraryexport.ts#L124)), so
   the rule reaches `cloud-node-library.json` with **no generator change**. That was not designed for
   this; it is the shape the export was always willing to carry.
4. **`{{*}}` is already this codebase's port-name placeholder**, used by `setDynamicPorts`'s own
   `renamed.patterns` and by the `expand/basic` entries in `animation.ts`. The rule invents no new
   idiom.

**Where it is evaluated.** `NamedPortsAdapter`, registered alongside the seven existing adapters. It
listens to the *unsuffixed* `nodeAdded` / `parametersChanged` (the registry already fans out to
both, and the per-type variant would defeat the point of being node-agnostic), plus `projectLoaded`
for the initial sweep, and calls `node.setDynamicPorts(...)` — the same one call `PageInputsAdapter`
makes. Everything downstream (`instancePortsChanged`, the property panel, connection health,
`universal-search`) is reached the way it already is for PageInputs today. **No new notification
path, no new caching, no change to `getPorts`.**

**Why not derive in `NodeGraphNode.getPorts()` instead**, which would need no events at all: `_ports`
is cached and only invalidated by `setDynamicPorts`, and — more decisively — a port list that
changes without emitting `instancePortsChanged` leaves the property panel and the canvas drawing the
previous one. The event is the feature.

### What this deliberately does not become

It is **not** a revival of the four commented-out managers (spec Out of Scope). `numbered`,
`portchannel` and `expand` are untouched and their entries remain inert. `namedports/list` is one new
rule with one evaluator, and the evaluator ignores every `dynamicports` entry whose name it does not
recognise — as `applyPortConditionsFilterForNode` already ignores every entry that is not
`conditionalports/*`.

---

## 3. `noodl.cloud.aggregate`: **not covered, and here is why — plus the finding behind it**

The spec requires this answer, and the honest one is *no*.

`aggregatenode.js`'s `updatePorts` is not a list expansion. It builds `visualFilter`'s type from a
**database collection schema**, `qp-*` from a walk of a saved filter tree, `storageFilterValue-*`
from a **regex over a JavaScript source string** plus `JavascriptNodeParser`, and `aggprop-`/`aggop-`/
`agg-` from `aggregatesList` **crossed with the schema's property types** — a `Number` property gets
a min/max/sum/avg enum and a number output, a `String` property gets a distinct enum and a string
output. None of that is derivable from a comma-separated list, and a rule stretched far enough to
express it would be a scripting language in JSON, which is the door the editor closed on purpose.

**The finding that makes the answer easy.** `noodl.cloud.aggregate` carries **four ports** in the
generated library — `aggregates` in, `fetched` / `failure` / `error` out — and `"dynamicports":
undefined`. It has no `collectionName`, no `storageFetch` **Do** signal, no filter, no aggregate
values. Its *entire* port surface, including the input that says which collection to aggregate and
the signal that runs it, was pushed by the runtime. Aggregate Records is not a node with a missing
feature; it is a node that cannot be configured or fired at all from this editor, and giving it
`agg-<name>` outputs would leave it exactly as unusable. Fixing it means restating fifteen ports and
a schema dependency — a task of its own, on the WFA-009 model but sized like WFA-005, and it is
filed as such rather than smuggled in here.

The thing WFA-009 owes it is that the mechanism **is not Response-specific**, so when that task
comes, the list-shaped half of aggregate (`aggregates` → one group per name) is already a data
entry, and only the schema-dependent half needs an `AggregateRecordsAdapter` body — a class that
**already exists** for this exact type, currently holding only the `collectionName` reset. That is
where it goes, and it is a normal editor-side adapter, not new machinery.

---

## 4. Scope addition: **the Request node has the identical fault, and F27 cannot close without it**

Not in the spec, found while answering §0, and load-bearing.

`noodl.cloud.request` has a `params` stringlist whose description reads *"Names to pull out of the
request body, each becoming an output"*, and a `setup()`
([request.ts:139](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L139)) that is
byte-for-byte the Response one with `plug: 'output'` and no status condition. It is unreachable for
exactly the same reason. Its generated ports today are `allowNoAuth`, `params`, `receive`, `auth`,
`userId` — **no `pm-*` outputs**.

Which means F27's own success criterion — *"a value wired into it is returned by the deployed
function"* — is not reachable by fixing Response alone, because in the shipped template the value a
function returns comes **from its request**. There would be a port to wire *into* and nothing to wire
*from*. The spec's §2 live pass ("author a cloud function from the template, type two parameter
names, wire both") is describing a graph that needs both ends.

The cost of including it is one library entry, because §2 chose a rule rather than a class. Had the
answer been `ResponseNodeAdapter`, this finding would have doubled the code. That is the strongest
argument for the decision, and it arrived after the decision rather than before, which is the right
order.

---

## 5. The `setup()` coexistence answer (spec trap 5)

> `setup()` is not dead code. If a cloud runtime with an editor connection ever returns, it will push
> these ports again — so (a) must not fight it, and the assessment should say what happens when both
> are present.

**What happens: nothing, by construction, and it is tested.**

`ViewerConnection.ts:179` handles a runtime push as `node.setDynamicPorts(content.ports, options)` —
the *same* call the adapter makes, on the same field. `setDynamicPorts` opens with

```ts
if (portsEqual(ports, this.dynamicports)) return;
```

so whichever writes second is a **no-op**, provided the two produce equal port lists. There is no
loop to enter: `setDynamicPorts` changes ports, and ports changing is not what either generator
listens to (both listen to the *parameter*).

So the requirement is not "must not fight it" in the abstract — it is the concrete, checkable
property **the rule and `setup()` must emit identical ports for identical parameters**, and that is
pinned by a test that runs the real `setup()` from `response.ts`/`request.ts` against a fake
`editorConnection`, captures what it hands `sendDynamicPorts`, and compares it to the evaluator's
output over the same parameter values (`''`, `'id'`, `'id,total'`, `'a,,b'`, and `status: 'failure'`).
If someone edits one and not the other, that test fails and names both files.

One consequence, accepted deliberately: the two generators are made to agree by **fixing both**
where they disagreed with the editor's own storage format. `''.split(',')` yields `['']`, so an
emptied list produced a phantom `pm-` port with a blank label. `decodeStringList` — the codec ERG-003
made the single definition of the `stringlist` format — is `split(',').filter(Boolean)`. Both
generators now drop empty entries, which is what the codec, the property panel and the author all
already assume. The alternative (mirror the bug for parity's sake) would have made the parity test
pass by preserving a defect in the half of the pair that a future runtime would push.

## 6. What a third node with this shape does next year

It adds one entry to its own `dynamicports` and regenerates the library. No editor change, no new
class, no registration. If its port names come from something other than a list parameter — a
schema, another component, a parsed script — it writes an adapter, because that is what
`PageInputs`, `RouterNavigate` and `Router` already do and what aggregate will do. The line between
the two is stated once, in the evaluator's doc comment, and it is: **a list of names in one
parameter, and a port template per name.** Anything that needs to *look at something else* is not a
rule.

The failure mode to avoid is the opposite one — a rule grown a `#js` escape hatch until it is code in
JSON with no types, no tests and no debugger. `evaluateDynamicPortsCondition` already supports `#js`
conditions and that is as far as this goes: the rule may *ask a question* about parameters, and may
not *compute* a port.

## 7. Success criteria this assessment knowingly cannot close

Two of the spec's six need the running editor, which this task was executed without (another session
held the dev stack). They are listed with what to do, in `WFA-009-NOTES.md` §"Could not verify",
rather than being quietly counted as met.
