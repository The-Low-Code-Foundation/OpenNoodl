# EXP-002 collections — Collection2 written by hand first

> The named-stores slice decided this slice's write idiom on paper (NAMED-STORES-TARGET §5);
> this document settles it on real fixture material before the generator exists, exactly as
> every slice has. A **named client-side array** becomes a module-level `collection<T>()`, read
> in render with `useCollection` and appended to with **one `.add({...})` call** compiled from
> the `NewModel → CollectionInsert` chain. Model2 stays deferred (NAMED-STORES-TARGET §6);
> everything else about arrays (remove, clear, filter, map, anonymous `CollectionNew`) defers
> with notes.

The fixture is the **Cheer** project extended with a third page
(`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`, snapshot at
`packages/nodegx-export/tests/fixtures/cheer`). The addition:

```
Pages/Notes                page > shell > [heading, entryInput, addButton, notesList]
  noteDraftVar             (Variable2 "noteDraft" — the step-5 write-through draft)
  entryInput onTextChanged → noteDraftVar value   (write-through: the draft is app state)
  addButton  onClick       → makeNote  new        (NewModel, properties "text,mood",
                                                   prop-mood literal "sunny")
  noteDraftVar value       → makeNote  prop-text  (the wired property — a .get() snapshot)
  makeNote   id            → insertNote modifyId  (CollectionInsert, collectionId "notes")
  makeNote   done          → insertNote add
  notesArray items         → notesList  items     (Collection2, collectionId "notes")
  notesList                (For Each, template /Components/NoteRow, no mapping script)
Components/NoteRow         Component Inputs (text, mood) → row Group > [noteText, moodTag]
```

The For Each carries **no mapping script** — deliberately. An editor-authored repeater gets the
identity `map({...})` written into its declared port's default when a template is picked; an
MCP-authored one gets nothing, and the runtime then **identity-maps item properties onto
same-named component inputs by itself** (`foreach.tsx`: `model.data[port.name] !== undefined ⇒
setInputValue(port.name, …)`, plus `id`/`Id` when the template declares such an input). So "no
script" is not "no mapping": it is the identity mapping over the template's input names — a rule
step 4's `mapping: []` got silently wrong, fixed in this slice.

The runtime semantics were read from the source, not assumed (`collectionnode2.ts`,
`collectionnode-new.ts`, `collectionnode-insert.ts`, `newmodelnode.ts`, `modelcrudbase.ts` in
`noodl-runtime/src/nodes/std-library/data/`):

- A **named array is process-wide create-on-read**: `Collection.get(id)` reads one module-level
  table, so every node spelling the same id reaches the same array — the same contract as a
  named store, and the same translation: a module-level constant every consumer imports.
- **`NewModel` in this fork has no "add to collection" input.** `addModelId` is applied with
  inputs excluded (`{ includeOutputs: true }`), so the node's surface is `properties`
  (stringlist parameter), one `prop-<name>` value input per listed property (wired or an
  authored literal parameter), one `type-<name>` selector each, the `new` (Do) pulse, and the
  `id` + `done` outputs. The classic-Noodl single-node insert does not exist here; the
  **only insert path is the `CollectionInsert` chain**, which is why translating the pair is
  translating the write.
- `NewModel.done` fires **after** `setModel` flags `id` dirty — "a graph wired `Done → Insert`
  must already be able to read the id when the pulse lands" (its own comment). The chain's
  ordering is guaranteed by the runtime, so collapsing it into one statement loses nothing.
- `CollectionInsert.modifyId` is `allowConnectionsOnly` — always a wire. Its `Do` resolves the
  model by id and `Array.prototype.add` **dedups by model identity** (`contains` → the
  `unchanged` outcome). Every `NewModel.new` mints a *distinct* model, so on this chain the
  dedup can never fire — `.add({...})` appending unconditionally is exact, and it is exact
  *only because* condition (c) below pins the model's provenance to the same handler.
- `_pushInputValues` writes **only the keys listed in `properties`**, skips `undefined`
  per key (the empty-value contract's abstain), and applies `type-<p>` coercions for
  `array`/`object`-typed properties (those defer here).

---

## 1. The collection module — one file per named array

```ts
// src/collections/notes.ts
import { collection } from '@nodegx/core';

export interface NotesItem {
  text?: string;
  mood?: string;
}

/**
 * Named by "Notes array" (Collection2 `notesArray` on /Pages/Notes).
 * Inserted by "Make note" (NewModel `makeNote` → CollectionInsert `insertNote` on /Pages/Notes).
 */
export const notes = collection<NotesItem>([]);
```

**What this settles.**

- **A named array is a module**: `src/collections/<exportName>.ts`, one per literal-named
  array — a second page reading `notes` imports the constant, which is what a shared
  `collectionId` meant in the graph. The directory is `collections/`, not `stores/`: the
  constructs are different core types, and a store and an array may share an authored name
  without their modules colliding. Export names still join the **one shared identifier space**
  (variables → channels → stores → collections, D5 first-wins dedup), so a component importing
  from several modules never collides.
- **The item interface is the union of statically-known inserted property sets,
  optional-keyed** (NAMED-STORES-TARGET §5): every translated insert chain contributes its
  `properties` list, each key typed by its source (a literal parameter by `typeof`; a wire by
  step 5's inference — text inputs and string-typed variables are `string`). All keys are
  optional — exactly the payload rule, and the honest type for a list whose reads can precede
  every write. A key two chains type differently is `unknown`. The interface name is
  `<Pascal(name)>Item`, deduplicated in the interface space beside `<Pascal>State`.
- **The initial contents are `[]`** — a named array starts empty in the runtime table and
  every observed graph fills it at runtime. (`Static Data → Collection2.items` seeding exists
  in the wild; it defers here with a note.)
- **The doc comment is the reader + inserter list**, the one thing a reader of the module
  cannot see, in the store-module shape.
- The module emits for every literal-named, non-deferred array that any translated construct
  touches. A `Collection2`/`CollectionInsert` with a **wired or non-literal `collectionId`**
  is genuinely dynamic — the node defers and contributes nothing.

## 2. `Notes` — `useCollection` in render, one `.add` in the handler

```tsx
// src/pages/Notes.tsx
import { useCollection } from '@nodegx/core/react';

import { notes } from '../collections/notes';
import { NoteRow } from '../components/NoteRow';
import { noteDraft } from '../stores/variables';
import styles from './Notes.module.css';

/** Notes. */
export function NotesPage() {
  const notesItems = useCollection(notes);

  return (
    <div className={styles.notesPage}>
      <title>Notes</title>

      <p className={styles.notesHeading}>Notes</p>

      <input
        className={styles.entryInput}
        placeholder="What happened?"
        onChange={(event) => noteDraft.set(event.target.value)}
      />

      <button
        className={styles.addButton}
        onClick={() => notes.add({ text: noteDraft.get(), mood: 'sunny' })}
      >
        Add note
      </button>

      {notesItems.map((item, index) => (
        <NoteRow key={index} text={item.text} mood={item.mood} />
      ))}
    </div>
  );
}
```

**What this settles.**

- **The `NewModel → CollectionInsert` pair compiles into one action** in the handler that owns
  `NewModel.new` — `notes.add({ text: noteDraft.get(), mood: 'sunny' })` — when
  **(a)** every `prop-<p>` resolves in that handler's context (an authored literal parameter,
  or a wire step 5's `ValueExpr` machinery already resolves — which adds a `literal` expr kind
  beside prop / input-text / store-get / payload),
  **(b)** the `CollectionInsert`'s `collectionId` is literal, and
  **(c)** nothing else consumes the `NewModel`'s outputs: its `id` feeds exactly this insert's
  `modifyId`, its `done` feeds exactly this insert's `add`, and no other wire leaves it. An id
  used elsewhere means the model has identity beyond the insert — Model2 territory, deferred.
  Both nodes' dispositions are `collapsed` into the handler's element.
- **The entries are the `properties` list in authored order**, each rendered by the expr rules
  handlers already use (`.get()` snapshots, `event.target.value` only in its own input's
  onChange, payload reads only in their receiver). A property with **no literal and no wire is
  omitted** — from the object *and from the item type*: the runtime's per-key abstain means
  nothing can ever write it, and a key that cannot exist has no honest place in the interface.
  A property whose wire cannot resolve in the owning handler's context defers the whole chain
  (one insert is one statement; half an object is not an insert).
- **`Collection2.items → For Each.items` renders with `useCollection`** — the read side. The
  hook local is `<exportName>Items` (`notesItems`), deduplicated in the component's reserved
  space; the map item local is `item`, the index local `index`, both deduplicated.
- **The repeater keys by `index`.** Exported items carry only authored properties — no
  fabricated ids: the runtime's generated model ids are identity the graph never wrote into
  the items, and inventing data is worse than positional keys. Index keys are stable here
  because this slice translates **appends only** (remove/clear defer), so the list is
  append-only by construction.
- **The mapping resolves in three tiers.** An authored static `map({...})` script gives its
  entries (step 4's rule). **No script at all gives the identity mapping over the template's
  Component Inputs names** — the runtime's own default, read from `foreach.tsx`, not assumed.
  A dynamic script defers. In either static tier, an entry whose field is not a key of the
  item interface is **dropped with a note, not deferred**: the runtime feeds `undefined`
  there, which the empty-value contract never delivers — and in the exported app the field
  genuinely never exists, because only translated inserts populate the collection.
- The `Collection2` node's disposition is `collapsed` into the component file that hosts the
  hook, exactly as a bound `Subscribe` is.

## 3. What defers, all with notes, none silently

- `CollectionNew` (anonymous arrays — no name, no module to give them), `CollectionRemove`,
  `CollectionClear`, `Filter Collection`, `Map Collection` — every one, wholesale.
- A `Collection2` or `CollectionInsert` whose `collectionId` is wired or non-literal.
- A `Collection2` whose `items` **input** is fed (source-collection copying / Static Data
  seeding), or whose `fetch` / `changed` / `fetched` / `count` / `firstItemId` ports are
  wired anywhere — the node is doing signal-graph work this slice does not translate.
- A `Collection2` whose `items` output feeds anything but a translated repeater's `items`.
- An insert chain failing (a): a `prop-<p>` wire with no statically-known source, or one whose
  expr is invalid in the owning handler (another input's `onTextChanged`, another receiver's
  payload). Failing (b): wired `collectionId`. Failing (c): any extra consumer of `id` or
  `done` (including two inserts fed by one `NewModel`).
- A `NewModel` with an `array`/`object`-typed property (`type-<p>`), or one whose `new` pulse
  is not owned by a rendered element's DOM event or a receiver.
- A `CollectionInsert` whose `modifyId` is not a lone `NewModel.id` in the same handler —
  inserting an *existing* model by id is Model2 territory.
- A `For Each` fed by a `Collection2` whose mapping script is dynamic (mapped fields outside
  the item interface drop per entry instead — see §2).

**Recorded divergences (cosmetic, same class the earlier slices accepted):**

- The runtime array holds live `Model` objects with generated ids; the export holds plain
  object literals with only the authored properties. Nothing translated can observe the
  difference: mapping fields are restricted to authored properties and id consumers defer.
- The runtime insert dedups by model identity and can report `unchanged`; the export appends
  unconditionally — unreachable divergence on this chain, since every translated insert
  inserts a model minted in the same handler invocation.
- A property wired from an undefined-valued source is skipped per key by the runtime
  (`_pushInputValues` abstains) but written as `key: undefined` by the export — invisible to
  readers (`item.text` is `undefined` either way), different under `Object.keys`, which
  nothing translated does.
- Core's `Collection` is copy-on-write where the runtime's mutates in place — the deliberate
  EXP-001 decision (`collection.ts`'s own header); React identity comparisons need it.

## 4. Dependencies

Unchanged rule: `@nodegx/core` joins the emitted `package.json` only because emitted files
import it — computed from the output, never assumed.

## 5. Model2 — still after this slice

Unchanged from NAMED-STORES-TARGET §6: id-addressed instances need id-provenance analysis this
slice only begins (the lone `NewModel.id → modifyId` wire is its first, degenerate case). The
insert chain built here is where most Model2 ids are born, which is why it went first.
