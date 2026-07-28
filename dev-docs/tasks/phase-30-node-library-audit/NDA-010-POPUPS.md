# NDA-010: Popups — data in, data out, and only one at a time

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

⚠️ Existing projects have hand-named `popupParam-*` ports. Whatever replaces this must keep reading
them, or ship a migration. Check the QA fixture and the docs-repo library content for real usage
before designing the replacement.

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
