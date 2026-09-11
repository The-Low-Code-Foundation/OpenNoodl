import { runInTurn } from './internal';

/**
 * A discrete event, as distinct from a value.
 *
 * The exported equivalent of a Noodl signal port — a button's `onClick`, a Function node's
 * `Outputs.Done()`. Most signals never become one of these: when a signal's entire downstream is a
 * side effect inside the same component, the generator emits an ordinary handler, which is why
 * `/Nav` in EXP-001-TARGET-OUTPUT.md contains no library call at all. A `Signal` is generated when
 * the event has to cross a boundary the call graph cannot.
 *
 * ```ts
 * const promptSent = signal<string>();
 * promptSent.subscribe((text) => console.log(text));
 * promptSent.emit('hello');
 * ```
 *
 * **Every emit fires.** The interpreted runtime does not merge two pulses that happen in the same
 * frame — a signal port is edge-triggered and each pulse carries its own reset, so the handler runs
 * once per pulse (CONTRACT.md C4). Subscribers run synchronously and in subscription order, which
 * is what preserves the value-then-signal ordering generated code relies on
 * (EXP-001-TARGET-OUTPUT.md §4).
 */
export class Signal<T = void> {
  private listeners: Set<(payload: T) => void> | null = null;

  emit(payload: T): void {
    const listeners = this.listeners;
    if (listeners === null || listeners.size === 0) return;

    runInTurn(() => {
      for (const listener of Array.from(listeners)) {
        listener(payload);
      }
    });
  }

  subscribe(listener: (payload: T) => void): () => void {
    if (this.listeners === null) this.listeners = new Set();
    this.listeners.add(listener);
    return () => {
      this.listeners?.delete(listener);
    };
  }

  /** Whether anything is listening. Mirrors the runtime's `hasConnections`. */
  get hasListeners(): boolean {
    return this.listeners !== null && this.listeners.size > 0;
  }
}

/** Creates a {@link Signal}. The exported equivalent of a signal output port. */
export function signal<T = void>(): Signal<T> {
  return new Signal<T>();
}
