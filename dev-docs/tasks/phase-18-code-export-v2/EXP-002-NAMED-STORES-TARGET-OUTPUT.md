# EXP-002 named stores — GlobalStore written by hand first

> Step 5 earned `value()` and `channel()`. This slice earns `store()`: the
> `net.noodl.GlobalStore` family becomes a module per named store, read with `useStore`
> selectors and written with `.set(patch)` in handlers — EXP-001 §3's shapes, settled here as
> **generator decisions** on real fixture material before the generator exists, exactly as every
> step has. Collection2's write idiom is decided on paper in §5; Model2 is deferred again, and §6
> says why.

The fixture is the **Cheer** project extended with a second page
(`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`, snapshot at
`packages/nodegx-export/tests/fixtures/cheer`). The addition:

```
Pages/Mood                 page > shell > [heading, noteInput, noteEcho, themeText, themeButton, stormyButton]
  moodStore                (net.noodl.GlobalStore "mood", initialState {"note":"","theme":"sunny"})
  noteInput  onTextChanged → setNote  value      (net.noodl.GlobalStore.Set "mood" key "note")
  noteInput  textChanged   → setNote  set        (the write-through pair — value + pulse)
  subNote    value         → noteEcho  text      (net.noodl.GlobalStore.Subscribe "mood" keys "note")
  subTheme   value         → themeText text      (Subscribe "mood" keys "theme")
  readVisitor-2 value      → setTheme  value     (Variable2 "visitorName" — the step-5 store)
  themeButton onClick      → setTheme  set       (Set "mood" key "theme")
  stormyButton onClick     → setStormy set       (Set "mood" key "theme", Value "stormy" TYPED IN, nothing wired — EXP-011 §70)
```

The runtime semantics were read from the source, not assumed (`globalstore.ts`,
`globalstorenode.ts`, `globalstoresetnode.ts`, `globalstoresubscribenode.ts` in
`noodl-runtime/src/nodes/std-library/agent/`):

- A named store **is one `Model`**, keyed `--ndl--global-store--<name>` — the same layering as
  Variables over `--ndl--global-variables`. "Global" means a Set in one component reaches a
  Subscribe in another with nothing but a name in common; `store(name, …)`'s name registry is the
  same contract.
- The `Global Store` node is a **view, not an owner**: `initialState` fills in only keys the
  store does not already have, never overwriting live state, however many times the node mounts.
  Core's `store(name, initial)` registers once and keeps accumulated state on re-call — the same
  effective boot behavior.
- `Set` writes **one key** (`setKey`), deferred to end-of-frame so `key`/`value`/`set` can arrive
  in any order within it. `store.set({ key: value })` is a single-key patch — the same write.
- `Subscribe` with **one key projects that key's value** ("an author watching `count` wants the
  number, not `{ count: n }`") — precisely `useStore(mood, (s) => s.note)`. Blank keys project
  the whole store; several keys project an object of just those keys — both defer this slice.
- The empty/absent `storeName` **defaults to `'app'`** on all three nodes. The translation keeps
  that default rather than deferring: an unnamed store is still one store.

---

## 1. The store module — one file per named store

```ts
// src/stores/mood.ts
import { store } from '@nodegx/core';

export interface MoodState {
  note: string;
  theme: string;
}

/**
 * Declared by "mood store" (net.noodl.GlobalStore `moodStore` on /Pages/Mood).
 * Written by "Write note" (net.noodl.GlobalStore.Set `setNote` on /Pages/Mood).
 * Written by "Write theme" (net.noodl.GlobalStore.Set `setTheme` on /Pages/Mood).
 * Written by "Write stormy" (net.noodl.GlobalStore.Set `setStormy` on /Pages/Mood).
 */
export const mood = store<MoodState>('mood', {
  note: '',
  theme: 'sunny'
});
```

**What this settles.**

- **A named store is a module** (EXP-001 §3): `src/stores/<exportName>.ts`, one per store — a
  second page reading `mood` imports the constant and needs no wiring, which is what Global
  Store meant in the graph. Variables stay together in `src/stores/variables.ts` (a Variable is
  a single key); a *named* store is a namespace and earns its own file. The identifier space is
  shared with variables and channels (D5 first-wins dedup), and `variables` is reserved in it so
  a store named "variables" cannot claim the module the Variables already own.
- **The state interface comes from the initial state first, writers second.** A key present in
  the `initialState` literal is required, typed by its JSON value (`string`/`number`/`boolean`;
  anything else types the key `unknown`). A key that only appears as a `Set` target is optional,
  typed by its statically-known writers exactly as variables are (`?: string` when every writer
  is string-typed, else `?: unknown`). An `unknown` key bound into rendered content defers that
  binding rather than emitting TypeScript that does not compile.
- **The initial state literal is transcribed, not restated**: JSON object parameter → object
  literal in shipped key order. A store no `Global Store` node declares (only Set/Subscribe name
  it) initializes `{}` — with every key optional, which is the honest type for a store whose
  first read can precede its first write.
- **The doc comment is the declarer + writer list**, the one thing a reader cannot see, in the
  variables-module shape.
- If several `Global Store` nodes declare the same store with initial state, keys merge
  first-seen wins (each node "fills in missing keys" in D1 discovery order), with a note.

## 2. `Mood` — selectors in render, patches in handlers

```tsx
// src/pages/Mood.tsx
import { useStore } from '@nodegx/core/react';

import { mood } from '../stores/mood';
import { visitorName } from '../stores/variables';
import styles from './Mood.module.css';

/** Mood board. */
export function MoodPage() {
  const note = useStore(mood, (s) => s.note);
  const theme = useStore(mood, (s) => s.theme);

  return (
    <div className={styles.moodPage}>
      <title>Mood</title>

      <p className={styles.moodHeading}>Mood board</p>

      <input
        className={styles.noteInput}
        placeholder="Write a note"
        onChange={(event) => mood.set({ note: event.target.value })}
      />

      <p className={styles.noteEcho}>{note}</p>

      <p className={styles.themeText}>{theme}</p>

      <button className={styles.themeButton} onClick={() => mood.set({ theme: visitorName.get() })}>
        Steal the visitor's name
      </button>
      <button className={styles.stormyButton} onClick={() => mood.set({ theme: 'stormy' })}>
        Make it stormy
      </button>
    </div>
  );
}
```

**What this settles.**

- **A single-key `Subscribe.value → rendered sink` wire is a `useStore` selector hook.** The
  hook's local name is the key itself (deduplicated like step 5's hook locals, falling back to
  `<exportName><PascalKey>`), because the key is what the author named the thing.
- **A `Set` node is `mood.set({ key: expr })` in whichever handler owns its `set` pulse** — the
  step-5 action machinery with a third action kind beside navigate/emit/store-set. The `value`
  wire resolves in handler context exactly as before: `event.target.value` only in its own
  input's onChange, `payload.*` only in its receiver, variable reads as `.get()` snapshots.
- **The write-through pair is two wires, one attribute.** `onTextChanged → value` plus
  `textChanged → set` from the same rendered input collapse into a single
  `onChange={(event) => mood.set({ note: event.target.value })}` — the input stays uncontrolled,
  step 5's rule unchanged. A `textChanged` pulse is a DOM event owned by its input; it joins the
  trigger-attachment pass with onChange as its handler slot.
- **Selector reads and `.get()` snapshots split by context** exactly as `useValue` vs `.get()`
  did in step 5: `theme` re-renders the page on store writes; the button reads `visitorName` at
  click time and subscribes to nothing.

## 3. What defers, all with notes, none silently

- **`persist: true`** (authored) defers the whole store: rehydration from browser storage is
  runtime behavior `store()` does not have. `storageKey` alone (without persist) is inert and
  only noted.
- `Set` with authored `merge: true` or `transaction: true`; `Set` whose `key` is wired or
  non-literal; any of the three nodes with a non-literal `storeName` (empty string is the `app`
  default, not a deferral).
- `Subscribe` with zero keys (whole store) or several keys; its `changed` /
  `previousValue` / `changedKeys` outputs driving anything (signal chains defer in this slice
  wholesale).
- The `Global Store` node's own outputs (`state`, `changedKeys`, `stateChanged`, `ready`,
  `error`, `storeId`) wired anywhere — reported by the catch-all.
- An `initialState` that is not a literal JSON object (a wire, or unparseable text): the
  declarer defers, the store still exists from its Set/Subscribe nodes with `{}` initial.

**Recorded divergences (cosmetic, same class step 5 accepted):**

- The runtime notifies only on genuine change (`changedKeys` is equality-gated per commit);
  core's `store` propagates every `.set` (CONTRACT C2) and React's `Object.is` bail-out absorbs
  the difference for renders. Signal-chain subscribers would see it — and signal chains defer.
- The runtime's `Set` writes at end-of-frame; the export writes synchronously in the handler —
  the ordering divergence step 5 already accepted for Set Variable.

## 4. Dependencies

Unchanged rule: `@nodegx/core` joins the emitted `package.json` only because emitted files
import it — computed from the output, never assumed.

## 5. Collection2 — the write idiom, decided on paper (next slice implements)

EXP-001's table maps Collection/Collection2 to `collection()`. A read-only translation is
worthless — a client-side collection nobody inserts into renders an empty list forever — so the
slice is only worth building when the **write chain** translates. The chain, in every observed
authoring (and the runtime's own node set: `NewModel` → `CollectionInsert`), is:

```
trigger → NewModel do        (properties p1..pn wired or literal)
NewModel created / id        → CollectionInsert model (or NewModel wires itself via `add to collection`)
NewModel done                → CollectionInsert do    (collectionName "todos")
```

**The decision:** that pair compiles into **one action** in the owning handler —
`todos.add({ p1, …, pn })` — when (a) the `NewModel`'s property wires all resolve in handler
context, (b) the `CollectionInsert`'s `collectionName` is literal, and (c) nothing else consumes
the `NewModel`'s outputs (an id used elsewhere means the model has identity beyond the insert,
which is Model2 territory). The item type of `collection<T>('todos')` is the union of statically
known inserted property sets, optional-keyed like payloads. A `For Each` whose `items` is fed by
`Collection2.items` then renders with `useCollection(todos)` — the read side. Everything else
about collections (Filter/Map nodes, remove, clear) defers.

## 6. Model2 — deferred again, and why

Model2's ports are parameter-dependent (`prop-*` dynamic ports typed by authored schema) and its
instances are **id-addressed**: which record a node reads is a runtime value on its `id` input,
not a static name. There is no module-level constant to compile a read into until the id's
provenance is itself statically known (a literal id, or a NewModel in the same handler). That
analysis is real work and belongs to its own slice — after Collection2, whose insert chain is
where most Model2 ids are born anyway.
