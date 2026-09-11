# EXP-001 step 2 — the exported code we want, written by hand first

> "Design the API by writing exported code by hand. Take three real Noodl components and hand-write
> what you would *want* the exported output to look like. The primitives fall out of that exercise,
> and this is the step that determines the phase's quality."
> — [EXP-001](./EXP-001-NODEGX-CORE.md), implementation step 2

The components below are real, not invented: they are taken from
[`project-examples/agent-chat/project.json`](../../../project-examples/agent-chat/), the shipped
example project. Node ids are kept so the mapping can be checked.

The exercise is deliberately ordered from the case that needs no library at all to the case that
needs all of it, because **the first result of this exercise is that most exported code should not
mention `@nodegx/core`.** A library that appears in every generated line has failed, however elegant
it is.

---

## 1. `/Message Row` — props into markup, zero library

Two `Component Inputs` ports wired straight into two `Text` nodes.

```
Component Inputs #3d6a0b  role → Text #7fbee0 text
                          text → Text #7a0218 text
```

```tsx
// src/components/MessageRow.tsx — generated from /Message Row
export interface MessageRowProps {
  role?: string;
  text?: string;
}

export function MessageRow({ role, text }: MessageRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.role}>{role}</span>
      <span className={styles.body}>{text}</span>
    </div>
  );
}
```

**What this settles.** A component input is a prop. A value connection into a visual port is JSX
interpolation. Nothing reactive is involved because React already is the reactive system here. The
library must not insert itself.

---

## 2. `/Nav` — signals that terminate in an effect, still zero library

Four buttons, each `onClick` wired to a `RouterNavigate`.

```
button #e64e27 onClick → RouterNavigate #6727c1 navigate   (target /#__page__/Chat)
… ×4
```

```tsx
// src/components/Nav.tsx — generated from /Nav
import { useNavigate } from 'react-router-dom';

import { Button } from './controls/Button';

export function Nav() {
  const navigate = useNavigate();

  return (
    <nav className={styles.nav}>
      <Button label="Chat" onClick={() => navigate('/chat')} />
      <Button label="Tools" onClick={() => navigate('/tools')} />
      <Button label="State" onClick={() => navigate('/state')} />
      <Button label="Live" onClick={() => navigate('/live')} />
    </nav>
  );
}
```

**What this settles.** A signal whose whole downstream is one side effect collapses into a handler.
It never becomes a `Signal` object. The `Signal` primitive is only earned when a signal has to
*cross* a boundary the call graph cannot — a different component, or a subscriber count the
generator cannot see.

That is the rule the generator will follow, and it is why the library stays small.

---

## 3. `/#__page__/State` — the Global Store, where the library starts earning its place

```
GlobalStore.Subscribe #59c9df (store "chat", key "title") value → Text #ca7bab text
textinput #07846c onTextChanged → GlobalStore.Set #cb10a1 value
button  #19afea onClick        → GlobalStore.Set #cb10a1 set
```

The store node itself becomes a module, because a global store is global:

```ts
// src/stores/chat.ts — generated from net.noodl.GlobalStore #… (storeName "chat")
import { store } from '@nodegx/core';

export interface ChatState {
  messages: Message[];
  answer: string;
  title: string;
}

/** Initial state comes from the Function node #51ac1a wired into the store's Initial State port. */
export const chat = store<ChatState>('chat', {
  messages: [],
  answer: '',
  title: 'Untitled conversation'
});
```

and the page reads it with one hook:

```tsx
// src/pages/State.tsx — generated from /#__page__/State
import { useStore } from '@nodegx/core/react';

import { chat } from '../stores/chat';

export function StatePage() {
  const title = useStore(chat, (s) => s.title);
  const [draft, setDraft] = useState('');

  return (
    <Page title="State">
      <Nav />

      <div className={styles.row}>
        <TextInput placeholder="Conversation title" value={draft} onTextChanged={setDraft} />
        <Button label="Set title" onClick={() => chat.set({ title: draft })} />
      </div>

      <Labelled label="Title in the store">{title}</Labelled>
    </Page>
  );
}
```

**What this settles.**

- A `Subscribe` node is a **selector**, not a subscription object. `useStore(chat, s => s.title)`
  is a shape every React developer already knows from Zustand, and the selector is where
  [C2](../../../packages/nodegx-core/CONTRACT.md)'s "no equality short-circuit" gets absorbed —
  the store notifies on every write, React's `Object.is` bail-out decides whether to render.
- A `Set` node is a **method call in a handler**, not a node. `chat.set({ title: draft })`.
- The store is a module, so a second page reading `chat` needs no wiring at all — which is what the
  Global Store meant in the graph.

The richer state nodes on this page — `StateHistory`, `StateSnapshot`, `OptimisticUpdate` — are
**not** library primitives. They are generated helper modules built on `store`, and keeping them out
of `@nodegx/core` is what holds the bundle budget. The primitives have to be sufficient to express
them; they do not have to ship them.

---

## 4. `/#__page__/Chat` — a Function node, and the ordering that must survive

This is the case the whole contract exists for. Function node #385020, verbatim from the project,
including its author's comment:

```js
// Appends your turn to the conversation held in the global store.
const body = (Inputs.Text || '').trim();
if (!body) return;

const list = Array.isArray(Inputs.Messages) ? Inputs.Messages.slice() : [];
list.push({ id: 'you-' + Date.now() + '-' + list.length, role: 'You', text: body });

Outputs.Messages = list;
Outputs.Done();
```

The author of the sibling node #8466e2 wrote down the invariant they were relying on:

> "Go() is a signal output; a value output is queued onto the connected input **before** the signal
> that follows it, so Body and Headers have already landed on the stream node when Connect arrives."

That is [C2 and C7](../../../packages/nodegx-core/CONTRACT.md) stated by a user. Exported code that
reorders these breaks the app.

```ts
// src/logic/appendYourMessage.ts — generated from Function node #385020
/** Appends your turn to the conversation held in the global store. */
export function appendYourMessage(text: string, messages: Message[]): Message[] | undefined {
  const body = (text ?? '').trim();
  if (!body) return undefined;

  const list = Array.isArray(messages) ? messages.slice() : [];
  list.push({ id: `you-${Date.now()}-${list.length}`, role: 'You', text: body });
  return list;
}
```

```tsx
// at the call site, in Chat.tsx
const onSend = () => {
  const next = appendYourMessage(draft, chat.get().messages);
  if (next === undefined) return; // C3 — the node sent nothing, so nothing downstream runs

  chat.set({ messages: next }); // Outputs.Messages = list
  sendPrompt.emit(draft); //         Outputs.Done()
};
```

**What this settles, and it is the important one.**

`Outputs.X = v; Outputs.Go();` becomes two ordinary sequential statements. The ordering guarantee
the author depended on is preserved by JavaScript's own statement order — *provided the library
notifies synchronously.* If `chat.set` deferred its notification to a microtask while `emit` fired
immediately, this app would break, silently, in a way its author documented and we would have
ignored.

So: **`set` and `emit` both notify synchronously and in order. Only the observer flush (the React
re-render) is deferred to the end of the turn.** That is not a performance choice, it is a
correctness requirement, and it comes straight out of hand-writing this one function.

An early `return` becomes `return undefined`, and the caller's `if (next === undefined) return;` is
where [C3](../../../packages/nodegx-core/CONTRACT.md) ("`undefined` is never sent") lives — at the
port boundary, in generated code, not inside the library.

---

## The API this exercise produced

Nothing here was designed in the abstract; each entry is the thing the four components above
actually needed.

| Primitive | Earned by | Note |
|---|---|---|
| `value(initial)` | Variable nodes, and any local state a component genuinely shares | Most local state stayed `useState` |
| `derived(fn)` | Expression nodes, computed ports | Lazy + memoised, mirroring C1's getter |
| `signal<T>()` | §4 — a signal crossing a component boundary | §2 proved most signals never become one |
| `store(name, initial)` | §3 — Global Store, Object nodes | Selector-based reads |
| `collection(items)` | Array/Collection nodes (`For Each` in this project) | Not exercised above; kept because the census shows it |
| `events` | Send/Receive Event nodes | Name-keyed bus |
| `batch(fn)` | C5 — one render for a cascade | Rarely appears in generated code |
| `useValue` / `useStore` / `useCollection` / `useSignal` | §3, §4 | The whole React surface |

**What was rejected, and why it matters:**

- **A `Node` or `Port` abstraction.** Nothing above wanted one. Exporting the interpreter's
  vocabulary would have produced exactly the unreadable output this phase exists to avoid.
- **Per-port input queues.** See C7 in the contract — reproducing them is the `useEffect`-chain
  failure mode.
- **`connect(a, b)` wiring calls.** §1 and §2 show that most connections are not runtime objects at
  all; they are JSX interpolation and function calls.

The test of all of this is the one the task doc set: a React developer who has never heard of Noodl
should read the four files above and see an ordinary React application that happens to use a small
reactive store. They do.
