# The Failure Contract

**Status:** Normative design. Decided 2026-07-29 (phase 30, NDA-004 §1); **built** 2026-07-29 —
the channel is `packages/noodl-runtime/src/runtimeerror.ts`. Both surfaces — per-node `Failure`
outputs **and** a global catch-all node — were confirmed by Richard on 2026-07-29; the decision is
no longer provisional.
**Applies to:** every node that can fail, in every runtime — editor preview, deployed browser app,
cloud runtime, SSR/SSG, and exported code.
**Enforced by:** NDA-001 corpus rows F1–F3, and the register: each of the 50 failure-mute action
nodes ends up ✅ (has a `Failure` output) or 🔵 (cannot fail, recorded).

## The rule

> **A node that goes wrong says so at runtime, through a channel that exists in every runtime, in a
> structured form, observable from the graph.**

`context.editorConnection.sendWarning` violates every clause: it exists only in the editor, so the
diagnostics an author relied on during development vanish exactly when the app ships.

## The channel

One runtime-owned error bus, living in `noodl-runtime` (not the viewer, not the editor bridge), so
every execution context gets it for free.

### Raising

Nodes raise through a single API on the node instance:

```ts
this.raiseRuntimeError(code, message, detail?)
// emits { nodeId, componentName, nodeType, code, message, detail? }
```

- `nodeId` / `componentName` / `nodeType` are filled in by the runtime, not the caller — call sites
  stay one line and cannot lie about provenance.
- `code` is a stable, kebab-case, per-node-type identifier (`'run-tasks/no-success-output'`), so
  tooling and tests can match on it without parsing prose. `message` is for humans.
- `detail` is optional structured payload (the caught error, the offending value). Contract: it must
  be safe to serialise — the cloud runtime and export paths will JSON it.

### Delivery, per clause of the rule

1. **Works everywhere.** The bus is plain synchronous pub/sub inside `noodl-runtime` with zero
   editor dependencies. Default subscribers per context:
   - *Editor:* an adapter that forwards to `editorConnection.sendWarning` — so the editor shows
     exactly what it showed before. `sendWarning` becomes a **subscriber**, never the channel.
   - *Deployed / export / SSR / cloud:* a `console.error` subscriber (one line, structured), so a
     failure is never fully silent even in an unwired app. Cloud runtime additionally routes to its
     request log.
2. **Structured, not a string.** The event object above is the interface; subscribers may format,
   the bus never does.
3. **Observable from a graph.** Two surfaces, complementary (the "both" decision):
   - **Per-node `Failure` output** (NDA-004 §2) for errors the author expects and branches on. A
     `Failure` signal must be accompanied by an `Error` value output carrying `message`/`code` — a
     bare signal reproduces "no information" one level up.
   - **A global `On App Error` node** — the top-level error boundary for the errors nobody wired.
     Outputs: `Error` (signal), `Message`, `Code`, `Node Id`, `Component Name`, `Error` (object).
     Optional `Filter` input (code prefix). Multiple instances all fire; there is no claiming.
     Rationale for both: 155 nodes will never have complete failure ports, and a catch-all alone
     cannot be branched on locally.
4. **Cheap when unobserved.** Raising allocates one small object; no stack capture, no formatting
   unless a subscriber asks. The happy path costs a method that is never called.

### Interaction with other contracts

- **Diagnostics ([`DIAGNOSTICS-CONTRACT.md`](./DIAGNOSTICS-CONTRACT.md), phase 36 OBS-003):** the
  boundary is **event vs predicate**. This contract owns conditions that *happened* — the node was
  asked to act and could not. It does **not** own conditions that are simply *true*, like "`Items`
  is not an array": those have no moment, would fire `On App Error` for nothing, and can only be
  acted on by the author in the editor. Those go to `setDiagnostic`, which is editor-only **by
  design** rather than by limitation.

  ⚠️ **A failure raised here can never be withdrawn.** `createEditorWarningSubscriber` only ever
  calls `sendWarning`; nothing goes back. So a node that raises keeps its danger ring and its
  Problems entry until the project is reloaded — *including after the author has fixed the cause*,
  which is how a Problems panel becomes noise. Two nodes pair raise with an explicit clear on the
  same code (`foreach.tsx`'s `repeater/template-script-syntax-error`, `states.ts`'s
  `states/unknown-state`); every other site in the library does not. **Whether the channel itself
  should carry a withdrawal — and what "this failure is no longer interesting" means — is an open
  question against this contract.**

- **Reactivity:** the cycle breakers (500 sends/iteration, 100 iterations) report through this
  channel when they trip — decided in the Reactivity Contract. Both now raise
  `runtime/cyclic-loop`, with a `detail` naming which breaker tripped and, for the send limit,
  the output port that ran away. The `cyclicLoops` warning-type gate is kept, so an author who
  turned the warning off still has it off.
- **Collection listener exceptions** are raised here too, but **unattributed**
  (`collection/listener-threw`, provenance `'<runtime>'`) rather than attributed to the listening
  node: listeners are registered through the patched `Array.prototype.on`, whose signature holds
  no reference back to the node that registered them. Threading a node ref through that public,
  prototype-patched API is a larger change than this contract; the gap is recorded here rather
  than papered over. `raiseUnattributedRuntimeError` is the entry point, and it falls back to
  `console.error` when no `NodeContext` exists yet — `Array.prototype` is patched at import time,
  so a collection can notify before any context has been built.
- **Types (NDA-014):** the `Error` object outputs added by §2 must be connectable — they are among
  the 13 `object` outputs the type work exists to un-strand. Land NDA-014's cast additions before
  or with §2.
- **Function node (§3):** its outputs are author-declared, so built-in `Success`/`Failure`/`Error`
  need reserved names that cannot collide with author outputs.

## What counts as a failure

- **Failure**: the node was asked to act and could not — bad input it cannot coerce, an operation
  that threw, a target it could not resolve (Close Popup with no popup in scope; Run Tasks whose
  template has no `Success` output — corpus F1). These raise.
- **Not a failure**: absence of opinion (`undefined` input — Empty-Value Contract), a legitimate
  empty result (query returning zero rows), or a condition being false. These must not raise;
  a `Failure` port that fires on non-failures trains authors to ignore it.
- A node that *cannot* fail gets no `Failure` output — a vestigial port implies a failure mode that
  does not exist. Mark it 🔵 in the register instead.

## Completion is part of the contract

Ten nodes take a signal and emit none (`Send Event`, `Repeater`, `Function`, `Logic Builder`,
`Close Popup`, `Pop Component Stack`, `Navigate To Path`, `Unique Id`, `External Link`, `Response`).
An action node emits, at minimum, a completion signal (`Done`/`Success`) — downstream sequencing
must never require timing hacks. `Function` and `Repeater` are the priority two (NDA-004 §3).

## Conformance

| Corpus row | Behaviour pinned |
|---|---|
| F1 | Run Tasks with a template lacking a `Success`-named output raises `run-tasks/*` instead of silence |
| F2 | Show Popup double-fire is surfaced per the stack policy (NDA-010) |
| F3 | Columns + Repeater layout failure is at least detectable |

Success criterion 2 of NDA-004 is the demo: one raised error observed in editor, deployed browser
app, cloud runtime, and export — the export path is the one that will be forgotten.
