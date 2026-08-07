# `@nodegx/core`

A small reactive library. About 2.8 KB gzipped, no dependencies, works with or without React.

If you arrived here because it appeared in a project you inherited: this is the only library that
NodeGX-exported code depends on. Everything else in that repository is ordinary React, TypeScript
and Vite, and you can change any of it freely. This package exists so the exported code could be
readable — the alternative was chains of `useEffect` hooks simulating the original app's event
flow, which is correct and unmaintainable.

You do not need to know anything about NodeGX to use it.

## Install

```sh
npm install @nodegx/core
```

React is an optional peer dependency, needed only for the `@nodegx/core/react` entry point.

## The five things it does

### `value` — a piece of state anything can read and subscribe to

```ts
import { value } from '@nodegx/core';

const count = value(0);

count.get(); // 0
count.set(3); // subscribers run immediately
count.update((n) => n + 1); // 4

const stop = count.subscribe((n) => console.log(n));
stop(); // unsubscribe
```

### `derived` — a value computed from other values

Dependencies are discovered automatically: whatever the function reads, it depends on. The result
is cached until one of those changes, and it is computed lazily — nothing runs until something
reads it.

```ts
import { derived, value } from '@nodegx/core';

const first = value('Ada');
const last = value('Lovelace');
const full = derived(() => `${first.get()} ${last.get()}`);

full.get(); // 'Ada Lovelace'
last.set('Byron');
full.get(); // 'Ada Byron'
```

Call `dispose()` when a derived value outlives its usefulness — the values it reads hold a
reference to it until you do. The React hooks handle this for you.

### `store` — named state shared across the app

```ts
import { store } from '@nodegx/core';

export const chat = store('chat', {
  title: 'Untitled conversation',
  messages: [] as Message[]
});

chat.get(); // the whole state, read-only
chat.set({ title: 'Renamed' }); // a patch, merged in
chat.set((s) => ({ messages: [...s.messages, message] }));
chat.reset(); // back to the initial state
```

Stores are registered by name, so `store('chat', …)` twice returns the same instance. That makes
them survive hot reloads without losing state.

### `signal` — an event, as opposed to a value

```ts
import { signal } from '@nodegx/core';

const conversationCleared = signal<void>();
const promptSubmitted = signal<string>();

promptSubmitted.subscribe((text) => console.log(text));
promptSubmitted.emit('hello');
```

Subscribers run synchronously, in subscription order, once per `emit`. For events matched by name
rather than by reference — the exported form of the original app's Send/Receive Event nodes — use
`channel('name')` or the untyped `events.emit(name, payload)` / `events.on(name, fn)`.

### `collection` — a reactive list

```ts
import { collection } from '@nodegx/core';

const messages = collection<Message>([]);
messages.add(message);
messages.updateWhere((m) => m.id === id, (m) => ({ ...m, read: true }));
messages.get(); // readonly Message[]
```

Every mutation produces a new array, so `React.memo`, `useMemo` and identity comparison all work.

## With React

```tsx
import { useStore, useValue, useSignal } from '@nodegx/core/react';

function ConversationTitle() {
  const title = useStore(chat, (s) => s.title);
  return <h1>{title}</h1>;
}
```

| Hook | Use it for |
|---|---|
| `useValue(source)` | a `value`, a `derived` or a `collection` |
| `useStore(store, selector, isEqual?)` | part of a store — the selector may be an inline arrow |
| `useCollection(collection)` | a collection, as a plain array |
| `useDerived(compute, deps?)` | a computation scoped to the component; disposed on unmount |
| `useSignal(signal, handler)` | running a handler while the component is mounted |

Selectors that build an object or array should pass the exported `shallowEqual`, or they will
re-render whenever anything in the store changes:

```tsx
const { title, answer } = useStore(chat, (s) => ({ title: s.title, answer: s.answer }), shallowEqual);
```

Everything is built on `useSyncExternalStore`, so it is safe under concurrent rendering and
server-side rendering.

## Side effects

`effect` runs a function now, and again when anything it read changes:

```ts
import { effect } from '@nodegx/core';

const stop = effect(() => {
  document.title = chat.get().title;
  return () => {
    /* optional cleanup, same contract as useEffect */
  };
});
```

Re-runs are batched to the end of the current turn, so ten writes produce one re-run. `batch(fn)`
extends a turn across several statements. In a React component, prefer `useEffect`.

## Two behaviours worth knowing about

**Writing the same value again still notifies.** `count.set(5)` when the count is already 5 runs
every subscriber. This is deliberate — the original interpreted runtime behaves this way and
exported code can depend on it. React's own `Object.is` bail-out means it costs you nothing in
render work.

**Notification is synchronous; effects are not.** `set` and `emit` have already run every
subscriber by the time the next statement executes, which is what keeps exported sequences like
`store.set(...)` followed by `signal.emit()` in the right order. Only `effect` re-runs wait for the
end of the turn.

If a subscriber writes back to something it depends on, you get a `CyclicUpdateError` rather than a
hang. `configureRuntime({ maxTurnDepth })` raises the limit; `configureRuntime({ schedule })`
replaces how the end-of-turn flush is scheduled (it defaults to a microtask).

## Why it behaves the way it does

[`CONTRACT.md`](./CONTRACT.md) records the semantics of the interpreted NodeGX runtime, clause by
clause, with a citation into its source for each one — and, for each, whether this library
reproduces it, deliberately does not, or does so only partly. Every clause has a test that names
it, in `tests/contract.test.ts`, and the clauses that could be checked against the interpreter
itself are checked there: `packages/noodl-runtime/test/nodegx-core-parity.test.ts` runs the same
scenario through both and compares the event sequences.

If exported code ever behaves differently from the app it came from, that file is where to look
first.

## License

MIT. Deliberately not the editor's GPL: this library ships *inside* the code you exported, and a
copyleft dependency there would make the ownership this whole feature exists to give you
conditional.
