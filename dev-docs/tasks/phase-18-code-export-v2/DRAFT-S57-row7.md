## §57 Tier 2.8 row 7 — `Repeater Item`: the row's own id, and the one pulse a row can hear (session 85, 2026-09-05)

Type id `For Each Actions`, display name *Repeater Item* — the seventh row of §50's list. Picker **98 → 99**.

### §57.0 What a Repeater Item is, and what that decides

**The ports on disk** (`foreachactions.ts`, nothing added by an editor adapter — the module's `setup()` is
empty since DEBT-006 removed the `itemAction-*` block): one input, `Remove Completed` (`removeCompleted`,
boolean, connections only), and six outputs — `Added` (`added`, signal), `Try Remove` (`tryRemove`, signal),
`Item Id` (`itemId`, string) and the outcome trio `Done` / `Completed` / `Unchanged`. **No index port, no
Remove action.** The runtime hands a row *nothing to remove itself with*; removal is data-driven (a row
leaves the array), and the Repeater Item only *hears* about it.

**What the runtime does with them**, in `foreach.tsx` and `foreachactions.ts`:

- `Item Id` is `resolveForEachItem(this).getId()` — the `_forEachModel` the repeater hung on the template
  instance (`createNode(template, guid(), { _forEachModel: model })`), walked up the scope chain. The model is
  what `Collection.set` minted the row into: `Model.create(plain)` takes **`plain.id` when the row carries
  one and mints a guid otherwise** (`model.ts:238-247`), and for a Query Records row it is the record's
  objectId. A number in `id` stays a number (`_newRecord(id)` keeps the raw value; the port says `string`).
- `Added` is `signalAdded()`, called **synchronously inside `addItem` after `createNode`, once per row,
  before `target.addChild`** — one pulse per row creation, never again for that row.
- `Try Remove` is a **hold**, not a notification: `removeItem` calls `tryRemove(cb)` on the row's first
  Repeater Item; when the output has connections the node stores `cb`, pulses `Try Remove` and waits for
  `Remove Completed`, which then fires `Done` (a hold was waiting) or `Unchanged` (none was) and `Completed`
  either way. With no connections the removal proceeds on `scheduleAfterInputsHaveUpdated` — nothing an author
  can observe.
- A Repeater Item with no template host resolves nothing: `repeater-item/no-item-in-scope`, once, and
  `Item Id` reads `undefined` for ever; `Added` never fires because no repeater creates it.

**The design — the Object-in-repeater shape, not a new one.** EXP-002-MODEL2-TARGET-OUTPUT §4 already
translates "a node inside the template reads the row": an `Object` in *From repeater* mode becomes a row prop
the parent binds from `item.<field>` (`ComponentPlan.rowProps`), typed on the template side and dropped by
name on the parent side when the feed does not carry the field. `Item Id` is exactly that read with the field
fixed to `id`, and it takes the same seam:

- **`itemId` consumed** → the template declares `itemId?: string` (the port's own type — the one thing the
  template can promise without knowing its host), and every For Each that repeats the template passes
  `itemId={item.id}` through `rowAttrs`, **in all four feed branches**, so the emitted `tsc` checks the feed's
  `id` against `string` where the row type is concrete. Per feed, by name (the parent's sentence, since the
  parent is where the row's shape is known): Static Data rows without a unique primitive `id` (the runtime
  mints a guid there that the exported app does not); a Static Data `id` not typed `string` (the runtime hands
  a number through a string port — the export will not claim a type the graph did not); a named array (its
  rows are inserted without an id — a guid again); a typed list expression without `id`. An untyped list
  keeps it, under §4e's ruling. A query feed always passes it — `id` is the record's own.
- **`added` consumed** → a once-on-mount effect guarded by `useRef(false)` — §53's task-start shape verbatim
  (`startTask` pulses once after `createNode`; so does `signalAdded`), its chain compiled by `doneChainOf(node,
  'added')` in render context and registered in every walker a task's chain is (`allActions`, `scanActions`,
  `walkActions`, `fillMaterialize`, the React import).
- **Refused, by name, the whole node** (`dispositionForLogic`-level, before any prop is minted):
  1. no For Each names the component as its template — *"no For Each names /Components/X as its template,
     so there is no repeater row: Item Id reads undefined and Added never fires (the runtime reports
     `repeater-item/no-item-in-scope` once). A Repeater Item nested one component below the template walks up
     in the runtime; this slice reads only a template's own"*;
  2. a Run Tasks names it — *"named as a Run Tasks template by <comp> › <node>, where the item is a task
     input rather than a rendered row (runtasks.ts sets `_forEachModel` too) — this slice translates the For
     Each row only"*;
  3. `Try Remove` connected — *"its Try Remove is connected, which holds the repeater's teardown of this row
     until Remove Completed is pulsed — the emitted row unmounts the moment its item leaves the list and has
     no hold to offer"*;
  4. `Remove Completed` wired — *"its Remove Completed is wired: the exit handshake it completes has no
     counterpart in the emitted row, which unmounts the moment its item leaves the list"*;
  5. `Done`/`Completed`/`Unchanged` consumed — *"its "<port>" output is consumed, and it reports the exit
     handshake this slice does not translate (Done when a held removal is released, Unchanged when none was
     waiting, Completed either way)"*.
- **Two hosts** are *not* a refusal: the prop's type is the port's, and each host's feed is gated on its own
  rows, so a template repeated over two lists gets `itemId` from the one whose rows carry a string `id` and a
  named drop from the other. (The `Object` gate refuses two hosts because it reads *arbitrary* fields; this
  node reads one, whose type it declares itself.)
- A Repeater Item nothing reads collapses into the root, as an `Object` nothing reads does — inert in the
  runtime, absent in the emit, nothing lost.

What this deliberately does **not** do: mint an id on rows that have none (a guid per render would differ from
the runtime's stable one and from itself across renders); hold a row's unmount for an exit animation (the
repeater is not being redesigned — §29's ruling); expose an index (the node has no such port).

### §57.1 What is emitted

- **The template** (`PersonRow.tsx`): `itemId?: string` on the props interface, destructured, rendered where the
  Text sat — `<p className={styles.idText}>{itemId}</p>`; and, when `Added` is consumed, `useEffect`/`useRef` earned
  in the import block and a once-on-mount effect after the boundaries and before the query effects:
  ```
  // Repeater Item "This row": its Added chain runs once, on mount — signalAdded fires once per row, right after the repeater creates it (foreach.tsx).
  const added = useRef(false);
  useEffect(() => {
    if (added.current) return;
    added.current = true;
    lastAdded.set(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, like the row's own Added pulse
  }, []);
  ```
- **The host** (`Home.tsx`): `itemId={item.id}` on the row element, in every feed branch that can supply it, beside
  `key={item.id}` and §29's `onRemoved={() => …}`. A feed that cannot supply it drops the attribute with a sentence
  naming the node and the port, under the page in `EXPORT-REPORT.md`, and the pre-flight counts it.
- **The plan**: `ComponentPlan.rowProps` entries carry `repeaterItem` (the node id) so the parent's drop names the node
  rather than the generic "no row carries this field"; `ComponentPlan.repeaterItems` holds the compiled Added chains;
  `REPEATER_ITEM_TYPE` is exported beside `RUN_TASKS_TYPE`; the read is admitted in Pass 4g beside `Object`'s
  `prop-*` reads and in `resolveExpr` beside the same branch. No new lib — the effect is inline, §53's shape.
- **Refused by name** — the five whole-node sentences of §57.0 (no host; a Run Tasks host; Try Remove connected; Remove
  Completed wired; Done/Completed/Unchanged consumed), the four parent-side drops (static rows without a unique `id`; a
  static `id` typed number; a named array inserted without a string `id`; a typed list without `id`), the Added chain
  that does not translate (*"Repeater Item X: its Added chain did not translate — <reason>; its Item Id, if read, still
  does"*), and the fallback for a component with no visual root.

### §57.2 The fixture — `tests/fixtures/roster-desk`

A Static Data `People` (`p1` Ada, `p2` Grace, `p3` Linus — string ids) repeated by `peopleList` into
`/Components/PersonRow`: a Text from the `name` input, a Text from the Repeater Item's Item Id, a Remove button whose
Click is the row's `removed` output; `Added → Set Variable lastAdded ← Item Id`. The page relays `itemOutputSignal-removed`
into `Set Variable lastAction = "Removed a person."` and shows both variables. Emitted whole: 0 refusals, 15 files, the
real `tsc` over the app clean.

🔴 **The brief asked for "a Remove button that signals the item's removal through the node's own mechanism".** The node
has none — no Remove or Delete action, no index port; `tryRemove` is the repeater *asking the row* whether it may go.
Removal is data-driven (a row leaves the array), and §30's `Remove Object From Array` needs a *named* array feed, which
the exporter cannot seed from a Static Data (`collection<T>([])` boots empty). So the fixture's Remove rides §29's
relay into a page action, which is what the runtime can do with a static list too; a working delete over a named array
is `note-desk`'s and stays there.

### §57.3 Gates

```
nodegx-export: tsc 0 · repeater-item.test.ts 29/29 · jest 69 files (69 on disk = 68 + this one) 2293 rows, exit 0, alone on the box at load 6
export-ledger:check OK — 176 types, 106 translated · picker --check 99/127 (78.0%), exit 0 (was 98)
six floor pins moved 98 → 99: animation-pair, filter-records, on-app-error, object-store, run-tasks, script
neighbours re-run alone, green: unreported-deferrals 7, in-code-markers 54, logic 29, typecheck-emitted 34, static-data 23,
  collection-remove 20, repeater-row-signals 14, foreach-relay-ports 10, filter-records 34
arms 15/15 killed (mut-summary.txt), sources restored md5-identical; two first cuts did NOT compile ("0 total" is not a
  kill) and were re-cut at the value level: M4 (the outcome arm → the port names misspelt, 3 red) and M12 (the named-array
  gate → the key predicate inverted, 1 red)
```

### §57.4 Traps found

- 🔴 **Predicted a Remove signal; the node has only outputs.** §7.3 called the ports "the Repeater's removal handshake"
  and the brief read that as a signal the row sends. Reading `foreachactions.ts` first: `tryRemove(cb)` is the
  repeater's call *into* the row, and the row's only verb is `Remove Completed`. The design changed before a line was
  written — nothing to emit for removal, a hold to refuse by name.
- 🔴 **Predicted a text input's live text in the Added chain would be handler-only (§56 E2's rule).** It is not: the
  exporter syncs the input's text into `useState` and the chain reads `''` on mount — which is the runtime's answer too
  (the input is empty when `signalAdded` fires). Pinned as a row rather than refused; the row that *does* refuse an
  Added chain uses a `Navigate` with no target.
- 🔴 **A `defer()` subject does not reach the report.** I asserted the report would carry the deferral's subject phrase;
  the report carries the *note*, and the deferral only feeds in-file markers and the pre-flight count. The row asserts
  the sentence under the page and `refusals === 1`.
- ⚠️ **Notes are prefixed with the component path at `emitApp`**, so a `startsWith` on the sentence reads nothing.
- ⚠️ **`not.toContain('itemId')` matched the AC3 marker's own port name** (`rowItem.itemId` in the TODO comment) — an
  absence assertion on a substring that the *refusal prose* also contains proves nothing; narrowed to `itemId?:`.
- ⚠️ A ternary arm replaced by `false` narrows the discriminant to `never` and fails to compile under ts-jest — twice.

### §57.5 Residuals (owner NONE unless named)

- A Static Data with a **number** `id` drops Item Id by name; the honest translation is the runtime's — the number
  through a string port — which the export declines to type. Owner NONE.
- A Repeater Item **nested one component below** the template (the runtime walks up the scope chain) refuses with the
  no-host sentence, which names the case. Translating it needs an "instantiated inside a template" map. Owner NONE.
- `foreach.tsx:587-593` feeds a template's Component Input named `id`/`Id` from `model.getId()` in identity-mapping mode;
  the exporter's `template-inputs` mapping binds `id` from `item.id` (right when rows carry one) and `Id` from `item.Id`
  (never carried — dropped with the generic sentence). Pre-existing, not this row's; owner NONE.
- The exit handshake (`Try Remove` → exit animation → `Remove Completed`) stays refused by name; an honest translation
  is a deferred-unmount list in the host, which is a repeater redesign. Owner NONE.
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed.
