# EXP-002 step 5 — stores and events, written by hand first

> The step-4 pipeline exports Puppy test 3 with **zero `@nodegx/core` imports** — correctly, because
> that project contains no store or event constructs. Step 5 is where the library gets *earned*:
> Variable nodes, Send/Receive Event pairs, and the wired text input. EXP-001's target components
> settled the API shapes; this document settles the **generator's decisions** on real fixture
> material, hand-written before the generator existed, exactly as steps 2 and 4 were.

The source is real and v2-native: **Cheer**
(`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`), a one-page app authored through the
MCP server for exactly this purpose (Puppy test 3 has none of these constructs — the step-4
headline finding). Snapshot: `packages/nodegx-export/tests/fixtures/cheer`. The graph:

```
Pages/Home                 page > shell > [headline, nameInput, visitorBadge, cheerButton, cheerBanner]
  nameInput  onTextChanged → visitorVar value        (Variable2 "visitorName" — continuous write)
  visitorVar value         → cheerSend  message      (Event Sender "celebrate", payload "message")
  cheerButton onClick      → cheerSend  sendEvent

Components/GreetingBadge   badge > greetText
  readVisitor value        → greetText  text         (Variable2 "visitorName" — the read side)

Components/CheerBanner     banner > cheerText
  readCheer  value         → cheerText  text         (Variable2 "lastCheer")
  onCheer    eventReceived → storeCheer do           (Event Receiver "celebrate" → Set Variable "lastCheer")
  onCheer    message       → storeCheer value
```

The runtime semantics these translations must preserve were read from the interpreter, not assumed
(the EXP-001 lesson): `variablenode2.ts` — every Variable is one property of the shared
`--ndl--global-variables` record, writes on the `value` input apply after inputs settle, `changed`
fires app-wide; `eventsender.ts`/`eventreceiver.ts` (viewer) — channel-name-keyed global bus,
payload port names come from the sender's `payload` stringlist, and the payload values land
*before* `eventReceived` fires (NDA-012), which is what makes "payload as handler argument" a
faithful translation. `net.noodl.controls.textinput`'s `onTextChanged` is a **value output
carrying the current text** (`textChanged` is the pulse) — the canonical example project wires it
exactly as this fixture does.

---

## 1. The stores module — one file, every Variable, `value()` each

```ts
// src/stores/variables.ts
import { value } from '@nodegx/core';

/** Written by "Write lastCheer" (Set Variable `storeCheer` on /Components/CheerBanner). */
export const lastCheer = value<string | undefined>(undefined);

/** Written by "Visitor name" (net.noodl.controls.textinput `nameInput` on /Pages/Home). */
export const visitorName = value<string | undefined>(undefined);
```

**What this settles.**

- **All Variables share one module.** The interpreter holds every Variable as one property of a
  single shared record; `src/stores/variables.ts` is that record made legible. (EXP-001 §3's
  store-per-module rule is about *named stores* — Global Store, Object — which arrive next slice;
  a Variable is a single key, and per-key files would be noise at ten variables.)
- **A variable is `value(undefined)`, typed by its writers.** Nothing in the graph declares an
  initial value — an unread variable is `undefined`, and the export says so rather than inventing
  `''`. The type parameter is inferred from the statically-known writes (a text input writes
  `string`; a payload key's type follows the sender's wire); writers that cannot be typed make the
  variable `unknown`, and an `unknown` variable bound into rendered content **defers that binding**
  rather than emitting TypeScript that does not compile.
- **The doc comment is the writer list** (mirroring the api-stub TODO shape): where the value comes
  from is the one thing a reader of this file cannot see.
- Export names are the camelCased variable name; order is first-use across D1-sorted components.
- A Variable2 or Set Variable whose `name` is not a literal parameter defers to EXP-003 — a
  computed variable name is genuinely dynamic.

## 2. The events module — `channel()` per literal channel name

```ts
// src/events.ts
import { channel } from '@nodegx/core';

export interface CelebratePayload {
  message?: string;
}

/** Sent by "Broadcast celebrate" (Event Sender `cheerSend` on /Pages/Home). */
export const celebrate = channel<CelebratePayload>('celebrate');
```

**What this settles.**

- **A channel is a typed module-level `Signal`.** The payload interface is the union of every
  matching sender's `payload` keys — exactly how the interpreter's receiver discovers its output
  ports. All keys optional (a sender with an unwired payload port sends `undefined` there — C3).
- Payload key types are inferred like variable types (here: `message` comes from
  `visitorVar.value`, whose writers are all `string`).
- Only **global** propagation translates in this slice. `parent`/`children`/`siblings` scope the
  event to the component tree — that structure does not exist in the exported call graph, so those
  senders defer to EXP-003 with a note.
- A channel with no payload keys is `channel('name')` and emits `emit()` — the `T = void` default.

## 3. `GreetingBadge` — a variable read is a `useValue` hook

```tsx
// src/components/GreetingBadge.tsx
import { useValue } from '@nodegx/core/react';

import { visitorName } from '../stores/variables';
import styles from './GreetingBadge.module.css';

/** Badge. */
export function GreetingBadge() {
  const name = useValue(visitorName);

  return (
    <div className={styles.badge}>
      <p className={styles.greetText}>{name}</p>
    </div>
  );
}
```

**What this settles.**

- **A `Variable2.value → rendered sink` wire is a `useValue` hook plus an interpolation** — the
  EXP-001 §3 shape, with `value` in place of `store`.
- **The hook's local name is the variable's last camelCase word** (`visitorName` → `name`,
  `lastCheer` → `cheer`), deduplicated against props, queries and other locals, falling back to
  `<name>Value`. This mirrors the vocabulary-gated naming the style merger already uses, and it is
  what a person writing this file would call the local.
- The cross-component share needs no wiring: both components import the same module constant,
  which is what the shared `--ndl--global-variables` record *meant*.

## 4. `CheerBanner` — a receiver is `useSignal`; a Set Variable is a statement

```tsx
// src/components/CheerBanner.tsx
import { useSignal, useValue } from '@nodegx/core/react';

import { celebrate } from '../events';
import { lastCheer } from '../stores/variables';
import styles from './CheerBanner.module.css';

/** Banner. */
export function CheerBanner() {
  const cheer = useValue(lastCheer);

  useSignal(celebrate, (payload) => {
    lastCheer.set(payload.message);
  });

  return (
    <div className={styles.banner}>
      <p className={styles.cheerText}>{cheer}</p>
    </div>
  );
}
```

**What this settles.**

- **An Event Receiver is `useSignal(channel, handler)`** — subscribed while mounted, exactly the
  interpreter's lifetime for a receiver node (it listens while its component is instantiated).
- **A Set Variable node is a method call in a handler, not a node** (EXP-001 §3's `Set` rule).
  Its `do` wire chooses the handler; its `value` wire becomes the argument, resolved in *handler
  context* — a receiver payload output renders as `payload.<key>`, which is faithful because the
  interpreter lands payload values before `eventReceived` fires.
- `setWith: "string"` (and unset) pass the value through; other conversions defer in this slice.
- Receiver `enabled`/`consume` parameters beyond their defaults defer with a note.

## 5. `Home` — writes without subscriptions

```tsx
// src/pages/Home.tsx
import { CheerBanner } from '../components/CheerBanner';
import { GreetingBadge } from '../components/GreetingBadge';
import { celebrate } from '../events';
import { visitorName } from '../stores/variables';
import styles from './Home.module.css';

/** Home. */
export function HomePage() {
  return (
    <div className={styles.page}>
      <title>Cheer</title>

      <p className={styles.headline}>Cheer for a visitor</p>

      <input
        className={styles.nameInput}
        placeholder="Type a visitor name"
        onChange={(event) => visitorName.set(event.target.value)}
      />

      <GreetingBadge />

      <button
        className={styles.cheerButton}
        onClick={() => celebrate.emit({ message: visitorName.get() })}
      >
        Cheer
      </button>

      <CheerBanner />
    </div>
  );
}
```

**What this settles, and it is the important one.**

- **A wired `onTextChanged` earns an `onChange` handler — and nothing else.** The input stays
  uncontrolled: the graph wires text *out* of the input into the variable, never back in, so the
  export gives the variable no way to write the input. Controlled state is earned by a wire in
  each direction, not by the presence of a wire. (Step 4's rule — "a control earns state only when
  a wire demands it" — extended to say *which* state each wire direction demands.)
- **The same variable read renders two ways by context.** `visitorVar.value → cheerSend.message`
  is read *inside a handler*, so it is `visitorName.get()` — a snapshot at click time, which is
  what the interpreter's input queue delivers to the sender. A read *into rendered content*
  (GreetingBadge) is a `useValue` hook. One wire kind, two translations, chosen by the sink.
- **Home subscribes to nothing.** It writes on change and reads at click time, so it never
  re-renders — `useValue` appears only where a render actually depends on the value. This is
  EXP-001's "most exported code should not mention the library" holding *within* a file that
  uses the library.
- **An Event Sender is an `emit` call in the trigger's handler.** The payload object literal
  carries one entry per wired payload key, in the sender's declared key order; unwired keys are
  omitted (C3 — `undefined` is never sent). If *any* payload wire is statically unresolvable the
  whole sender defers — a partial payload would silently change data.

## 6. Dependencies, and what stays out

`package.json` for Cheer gains `"@nodegx/core": "^0.1.0"` — computed from the output, exactly as
TARGET-OUTPUT §3 ruled: the generator scans the emitted files for `@nodegx/core` imports and adds
the dependency only then. The Puppy test 3 export must remain byte-for-byte free of it.

Deferred from this slice, all with notes, none silently:

- **Model2 / Collection2 / GlobalStore** (`store()` / `collection()` rows of EXP-001's table) —
  parameter-dependent port sets and id-addressed instances; the write idioms
  (NewModel → CollectionInsert, GlobalStore.Set) are their own deterministic shapes. GlobalStore
  is the nearest: EXP-001 §3 *is* its hand-written target.
- Signal wires whose handler owner is not a rendered DOM node or a receiver (Condition outcomes,
  `Fetch` pulses, sender `done` chains).
- Payload outputs bound into rendered content (needs state the receiver handler would set — a
  deterministic shape, but not this one).
- Non-literal variable/channel names; non-global propagation; non-string `setWith`.

**Known cosmetic divergence, recorded:** a `Text` bound to an unset variable shows the node-type
default ("Text") in the interpreter — the wire delivers `undefined` and the default text parameter
survives. The export renders the interpolation as empty instead. Faithfully exporting "default
text until first write" would mean `??`-chaining every binding against catalog defaults;
deliberately not done, noted here so EXP-003's trace comparison knows to expect it.

**Scaffold correction found by this fixture:** `tokens.css` was generated from
`metadata.designTokens.customTokens` alone, but the runtime resolves `var()` against the **182
shipped defaults merged with overrides** (editor `ProjectTokenCss.buildEffectiveTokens`, REV-009).
Cheer has no overrides at all, which made the gap visible: every emitted `var(--space-4)` was
unresolved — in Puppy's export too, where the 28 custom tokens are all colors. `tokens.css` now
emits the effective set (defaults in shipped order, overrides applied, custom extras appended),
reading `DEFAULT_TOKENS` from the editor module rather than restating it (the Rise lesson).
