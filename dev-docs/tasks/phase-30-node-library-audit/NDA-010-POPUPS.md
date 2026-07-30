# NDA-010: Popups — data in, data out, and only one at a time

> **Status: §2 complete — 2026-07-29** (shared with NDA-015). §1 and §3 remain; read the notes on
> each below before starting them, because §1's premise is partly stale.
>
> Success criterion 2 is met: a Close Popup node anywhere in the popup's component tree now works, and
> says why when it does not. Corpus: `noodl-viewer-react/tests/corpus/nda-010-close-popup-targeting.test.ts`
> — 7 rows, verified discriminating (removing the fix reddens 4 and leaves the pinned control green).

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-010 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High |
| **Difficulty** | 🟠 Medium |
| **Estimated Time** | 2 weeks |
| **Prerequisites** | §2 is shared with NDA-015 (binding contract) — do them together |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Make popup data flow legible, make Close Popup work wherever it is put, and stop popups stacking by
accident.

## §1 — Typed parameters and results

Data crosses the popup boundary through dynamic string-prefixed ports: `popupParam-*` in
([`showpopup.ts:91-99`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L91-L99),
[`:140`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L140)) and
`closeResult-*` out ([`closepopup.ts:118`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L118)).

Nothing type-checks the pair, nothing tells the author which params the target popup expects, and the
semantic validator has to skip the node because the contract is not expressible. That is Richard's
"a nightmare to get them to take the data you want to pass in and out".

The target popup is a component with known inputs and outputs. **Derive the param and result ports
from it**, the way a Component Instance already derives its ports, instead of asking the author to
invent matching names on both sides. This is the same fix shape as NDA-009 §2.

Hand-named `popupParam-*` ports exist in the QA fixture and possibly in the docs-repo library
content. **Those two are the only compatibility target** — check them for real usage, and update
them as part of this change if the derived-port design cannot read them. Legacy user projects are
explicitly *not* a constraint here: derive the ports properly and let the importer flag what it
cannot convert ([`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md)).

> ### ⚠️ §1's premise is partly stale — read before building (noted 2026-07-29, NDA-010 §2)
>
> Two of the sentences above are already false of the code, found while doing §2. Source-read only,
> not run — but the code is unambiguous.
>
> **Show Popup already derives its ports from the target component.** `showpopup.ts:129-177`
> (`_updatePorts`) iterates the target component's `inputPorts` and emits one `popupParam-<name>`
> port per input **carrying that input's declared type** (`type: o.type || '*'`). It then reads the
> target's `NavigationClosePopup` nodes and emits `closeAction-*` and `closeResult-*` from their
> parameters, re-running on `inputPortAdded`/`inputPortRemoved`/`nodeAdded`/`parameterUpdated`. So
> "nothing tells the author which params the target popup expects" is wrong, and so is "asking the
> author to invent matching names on both sides" — **only one side invents them**, and the other is
> generated, which is why the names cannot mismatch.
>
> What is *actually* missing, and what §1 should be re-scoped to:
>
> 1. **The Close Popup side is still hand-typed.** `results` and `closeActions` are `stringlist`
>    parameters (`closepopup.ts`), so results are named by hand — the reverse direction from what this
>    section assumed. Deriving *those* from the component's output ports is the real gap.
> 2. **Results are untyped.** `closeResult-*` ports are pushed as `type: '*'` while `popupParam-*`
>    carry a real type. So one direction type-checks and the other does not.
> 3. **The validator.** Whether the semantic validator can now express the contract needs re-checking
>    against what is actually derived, not against this section's description of it.
>
> Do not start §1 without re-reading `showpopup.ts` first. This is the phase's recurring lesson: six
> spec claims have now fallen to implementation.

## §2 — Close Popup must know what it closes

`Close Popup` does not find its popup — it waits to be *handed* a callback. `_setCloseCallback`
([`closepopup.ts:64-66`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L64-L66))
is called by whatever mounted the popup, and `showPopup` passes
`senderNode: this.nodeScope.componentOwner`
([`showpopup.ts:78`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L78)).

So **whether a given Close Popup node works depends on which component scope it happens to sit in**,
with no indication either way. That is exactly "very hard to find the right place to put the close
popup node so that it actually works" — and it is the same defect class as Parent Component Object
(class F). Do this section with [NDA-015](./NDA-015-EXPLICIT-BINDING.md); the fix is shared:

- an optional explicit target,
- a visible indication of what was resolved when left implicit,
- a warning when nothing resolves, instead of a node that silently does nothing.

> ### ✅ Done 2026-07-29
>
> The push became a **pull**. `NodeContext.showPopup` now publishes its close handler on the popup's
> component instance as `_popupCloseHandler` — unconditionally, where the old registration ran only
> when the popup's top-level scope happened to contain a Close Popup node — and `closepopup.ts`
> resolves *upwards* to the nearest ancestor carrying one, using the shared walk in
> `runtime/src/componentwalk.ts`. The handed-down callback is still preferred when present, so every
> graph that works today takes exactly the path it took before.
>
> All three bullets landed: an optional `Popup` input (an explicit miss fails, it never falls back to
> the enclosing popup — closing *something* would be worse than closing nothing), the resolved popup
> name on the node card via the new `nodesublabel` channel, and the NDA-004 failure raised with
> `close-popup/no-popup-in-scope` or `close-popup/target-not-found`.
>
> One assertion in NDA-004's `mute-node-completion.test.ts` moved with it: the `Error` output now
> carries the same sentence as the raised event instead of a shorter separate one, which is what the
> Failure Contract asks for ("accompanied by an `Error` value output carrying `message`/`code`").

## §3 — A stack policy

`scheduleShow` coalesces within a single update pass
([`showpopup.ts:63-73`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L63-L73))
but two passes, or two different Show Popup nodes, stack two popups. There is no "already showing"
guard and no policy.

Decide and implement one. Recommend: **a single modal slot by default**, with an explicit opt-in to
stacking, because accidental stacking is the reported problem and deliberate stacking is rare. Whatever
is chosen, `Closed` must fire correctly for every popup in the stack, including ones dismissed
implicitly by a replacement.

## Success criteria

1. Corpus row F2 green — two Show Popup nodes firing in the same frame produce the defined outcome,
   not two stacked popups.
2. A Close Popup node placed anywhere in the popup's component tree works, or says why it does not.
3. Popup params and results are derivable from the target component; the semantic validator can check
   them.
4. Existing popup graphs in the QA fixture behave identically or are migrated.
