import { Signal } from './signal';

/**
 * The exported equivalent of Send Event and Receive Event nodes: a bus keyed by event name.
 *
 * Send and Receive nodes are matched by a string in the graph, not by a wire, so the exported form
 * has to be name-keyed too. Everything else about them is a {@link Signal}, which is what backs
 * each channel.
 *
 * Prefer {@link channel} in generated code — it gives the event a type and a module-level binding,
 * so a typo becomes a compile error rather than an event nobody receives:
 *
 * ```ts
 * export const conversationCleared = channel<void>('conversationCleared');
 * conversationCleared.emit();
 * ```
 */
const channels = new Map<string, Signal<never>>();

/** Creates or returns the named typed channel. */
export function channel<T = void>(name: string): Signal<T> {
  const existing = channels.get(name);
  if (existing !== undefined) return existing as unknown as Signal<T>;

  const created = new Signal<T>();
  channels.set(name, created as unknown as Signal<never>);
  return created;
}

/** The untyped door onto the same channels, for dynamic event names. */
export const events = {
  emit(name: string, payload?: unknown): void {
    channel<unknown>(name).emit(payload);
  },
  on(name: string, listener: (payload: unknown) => void): () => void {
    return channel<unknown>(name).subscribe(listener);
  }
};

/** Forgets every channel. Used by tests; an app has no reason to call it. */
export function clearChannels(): void {
  channels.clear();
}
