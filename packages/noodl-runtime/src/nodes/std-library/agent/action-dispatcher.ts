'use strict';

/**
 * Backend-to-frontend action dispatching (AGENT-005).
 *
 * This is the one piece of AIX-005 where a **remote server tells the client what to do**,
 * so the shape of it is a security decision before it is a feature decision. Two rules
 * follow from that, and everything else in this file is their consequence:
 *
 * 1. **The vocabulary is closed.** A dispatcher can execute exactly two things: a built-in
 *    action the app author *enabled by name* on the dispatcher node, and an action type
 *    some `Action Handler` node in the graph *registered*. An action type that is neither
 *    is refused. There is no fallback, no `eval`, no "call the function named in the
 *    message", and no way for a message to widen its own permissions.
 * 2. **Nothing is silent.** Every refusal carries a reason and reaches a graph output.
 *    An app author who cannot step through code has to be able to see that the server
 *    asked for something and was told no, and why.
 *
 * ## What an action can and cannot reach
 *
 * **Can reach**, and only these:
 *
 * - The four built-in store actions (`SET_STORE`, `MERGE_STORE`, `DELETE_STORE_KEY`,
 *   `CLEAR_STORE`) — *if* the author listed that name in the dispatcher's `builtIns`
 *   input, which is empty by default. They write only to the store named on the
 *   dispatcher node, never to a store named in the message, and only to keys the
 *   dispatcher's `allowedKeys` permits.
 * - Whatever the app author wired downstream of an `Action Handler` node's `trigger`
 *   output. **This is genuinely open-ended and includes navigation**: a handler wired to
 *   a `Navigate` node means the server can navigate the app. That is a real capability
 *   with a real risk, and it is deliberately made visible as a wire on the canvas rather
 *   than granted implicitly by the dispatcher.
 *
 * **Cannot reach**, at all:
 *
 * - The network. There is no `FETCH` built-in (the phase-3.5 spec had one; see §6 of the
 *   as-built notes). A server-supplied URL fetched by the client with the user's cookies
 *   is a CSRF and exfiltration primitive, and it is not something a dispatcher should
 *   hand out by default.
 * - The DOM, `window`, and custom DOM events. This module is framework-neutral runtime
 *   code and touches no browser global; the spec's `SHOW_TOAST` / `HIGHLIGHT_ELEMENT` /
 *   `SCROLL_TO` / `TRIGGER_SIGNAL` built-ins all did, and all of them are expressible as
 *   an `Action Handler` wired to the nodes that already do those jobs.
 * - Any store other than the one configured on the dispatcher node.
 * - Any action type not in the closed set described above — including one whose handler
 *   has been unregistered or disabled.
 *
 * ## Ordering
 *
 * Actions execute **strictly one at a time, in arrival order**, per dispatcher node. A
 * multi-step flow sent as an array arrives as an array and runs in sequence. The queue is
 * bounded; an overflow refuses the *newest* action rather than dropping an accepted one,
 * so what has been admitted keeps its order.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */
import { globalStoreManager } from './globalstore';

export type Unsubscribe = () => void;

/** Why an action was not executed. Every value here reaches a graph output. */
export type RefusalReason =
  /** Not a usable action at all: unparseable, not an object, or no `type`. */
  | 'invalid'
  /** A well-formed action whose type nothing in this graph handles. */
  | 'unknown'
  /** A recognised action the app has not authorised — an off built-in, or a key outside the allow-list. */
  | 'not-allowed'
  /** The dispatcher's rate limit was exceeded. */
  | 'rate-limited'
  /** The queue was full. */
  | 'queue-full';

export interface ActionEnvelope {
  type: string;
  [key: string]: unknown;
}

/** What a handler is handed. Exactly one of `complete` / `fail` takes effect. */
export interface ActionContext {
  actionId: string;
  actionType: string;
  action: ActionEnvelope;
  payload: unknown;
  complete(result?: unknown): void;
  fail(message: string): void;
}

export interface ActionHandler {
  invoke(context: ActionContext): void;
}

/**
 * The built-in vocabulary. **Reserved unconditionally**: an `Action Handler` node may not
 * claim one of these names even when the built-in is disabled, so that whether a name is
 * a built-in never depends on the order two nodes happened to initialise in.
 */
export const BUILT_IN_ACTIONS = ['SET_STORE', 'MERGE_STORE', 'DELETE_STORE_KEY', 'CLEAR_STORE'] as const;

export type BuiltInAction = (typeof BUILT_IN_ACTIONS)[number];

const BUILT_IN_SET = new Set<string>(BUILT_IN_ACTIONS);

export function isBuiltInAction(actionType: string): boolean {
  return BUILT_IN_SET.has(actionType);
}

/** The slice of the global store the built-in actions use. Injectable so tests need no store. */
export interface ActionStore {
  setKey(storeName: string, key: string, value: unknown, opts?: { merge?: boolean }): void;
  setState(storeName: string, updates: Record<string, unknown>): void;
  deleteKey(storeName: string, key: string): void;
  clearStore(storeName: string): void;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

type RegistrationListener = (actionType: string) => void;

interface ChannelRecord {
  handlers: Map<string, ActionHandler[]>;
  listeners: RegistrationListener[];
}

/**
 * Which action types this app is willing to execute, and who executes them.
 *
 * A process-global singleton for the same reason the store is one: an `Action Handler` in
 * one component has to be findable by a dispatcher in another with nothing but a channel
 * name in common. Registration *is* the allow-list — there is no separate permission
 * table to keep in step with it.
 */
export class ActionRegistry {
  private channels = new Map<string, ChannelRecord>();

  private ensure(channel: string): ChannelRecord {
    const name = normalizeChannel(channel);
    let record = this.channels.get(name);
    if (!record) {
      record = { handlers: new Map(), listeners: [] };
      this.channels.set(name, record);
    }
    return record;
  }

  /**
   * Adds a handler for one action type. Several handlers may claim the same type; they
   * run in registration order. The returned unsubscribe is idempotent.
   */
  register(channel: string, actionType: string, handler: ActionHandler): Unsubscribe {
    if (typeof actionType !== 'string' || actionType === '') {
      throw new Error('Action Handler: an action type is required');
    }
    if (isBuiltInAction(actionType)) {
      throw new Error(`Action Handler: "${actionType}" is a reserved built-in action name`);
    }

    const record = this.ensure(channel);
    const list = record.handlers.get(actionType) || [];
    list.push(handler);
    record.handlers.set(actionType, list);

    // Told after the handler is in place, so a listener that dispatches immediately finds it.
    for (const listener of record.listeners.slice()) {
      try {
        listener(actionType);
      } catch (error) {
        console.error('[ActionRegistry] registration listener threw:', error);
      }
    }

    let cancelled = false;
    return () => {
      if (cancelled) return;
      cancelled = true;
      const current = record.handlers.get(actionType);
      if (!current) return;
      const index = current.indexOf(handler);
      if (index !== -1) current.splice(index, 1);
      if (current.length === 0) record.handlers.delete(actionType);
      this.prune(normalizeChannel(channel));
    };
  }

  getHandlers(channel: string, actionType: string): ActionHandler[] {
    const record = this.channels.get(normalizeChannel(channel));
    if (!record) return [];
    return record.handlers.get(actionType) || [];
  }

  has(channel: string, actionType: string): boolean {
    return this.getHandlers(channel, actionType).length > 0;
  }

  /** Every action type this channel will accept, sorted. The allow-list, readable. */
  registeredTypes(channel: string): string[] {
    const record = this.channels.get(normalizeChannel(channel));
    if (!record) return [];
    return Array.from(record.handlers.keys()).sort();
  }

  /** Fires when a handler is added, so a dispatcher waiting on a late handler can wake. */
  onRegister(channel: string, listener: RegistrationListener): Unsubscribe {
    const record = this.ensure(channel);
    record.listeners.push(listener);

    let cancelled = false;
    return () => {
      if (cancelled) return;
      cancelled = true;
      const index = record.listeners.indexOf(listener);
      if (index !== -1) record.listeners.splice(index, 1);
      this.prune(normalizeChannel(channel));
    };
  }

  /** Live handler count. Exists so leaks can be asserted on. */
  handlerCount(channel: string, actionType?: string): number {
    const record = this.channels.get(normalizeChannel(channel));
    if (!record) return 0;
    if (actionType !== undefined) return (record.handlers.get(actionType) || []).length;
    let total = 0;
    for (const list of record.handlers.values()) total += list.length;
    return total;
  }

  channelNames(): string[] {
    return Array.from(this.channels.keys());
  }

  reset(): void {
    this.channels.clear();
  }

  private prune(name: string): void {
    const record = this.channels.get(name);
    if (record && record.handlers.size === 0 && record.listeners.length === 0) {
      this.channels.delete(name);
    }
  }
}

export const actionRegistry = new ActionRegistry();

export function normalizeChannel(channel: string | undefined | null): string {
  return channel === undefined || channel === null || channel === '' ? 'default' : String(channel);
}

// ---------------------------------------------------------------------------
// The dispatcher
// ---------------------------------------------------------------------------

/**
 * Read live on every use, not copied at construction — the node that owns a dispatcher
 * mutates this object from its input setters, and a rate limit or an allow-list that only
 * took effect on the next reconnect would be a surprise.
 */
export interface ActionDispatcherOptions {
  channel: string;
  /** The only store the built-in actions can touch. An action naming another is ignored. */
  storeName: string;
  /** Built-in action names the author enabled. Empty means no built-in runs. */
  builtIns: string[];
  /** Keys the built-in store actions may write. Empty means any key of the configured store. */
  allowedKeys: string[];
  /** Milliseconds a handler has to complete. 0 disables the timeout. */
  handlerTimeout: number;
  /** Milliseconds an action waits for its handler to appear. 0 refuses immediately. */
  waitForHandler: number;
  /** Queue bound. 0 or less is unbounded. */
  maxQueueSize: number;
  /** Max actions accepted per window. 0 disables rate limiting. */
  rateLimit: number;
  rateLimitWindow: number;
}

export interface ActionInfo {
  actionId: string;
  actionType: string;
  action: ActionEnvelope;
  payload: unknown;
}

export interface RefusalInfo {
  actionId: string;
  /** The offending type, or `''` when the message was too malformed to have one. */
  actionType: string;
  reason: RefusalReason;
  message: string;
  /** Whatever arrived, so the author can see it in the inspector. */
  action: unknown;
}

export interface DispatcherHooks {
  onDispatched?(info: ActionInfo): void;
  onCompleted?(info: ActionInfo & { result: unknown }): void;
  onFailed?(info: ActionInfo & { error: string }): void;
  onRefused?(info: RefusalInfo): void;
  /** Queue length, in-flight state, or waiting-for-handler changed. */
  onQueueChanged?(): void;
  /** The queue drained after doing at least one thing. */
  onIdle?(): void;
}

export interface DispatcherDeps {
  registry?: ActionRegistry;
  store?: ActionStore;
  setTimeoutImpl?: (fn: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
  nowImpl?: () => number;
}

interface HandlerToken {
  done: boolean;
  /** Set when the handler settled inside its own `invoke`, so the walk loops instead of recursing. */
  sync: boolean;
}

interface QueueEntry {
  id: string;
  action: ActionEnvelope;
  payload: unknown;
  handlers: ActionHandler[];
  index: number;
  lastResult: unknown;
  timer: unknown;
  waitTimer: unknown;
  unlisten: Unsubscribe | null;
  inInvoke: boolean;
  token: HandlerToken | null;
  /** True between `onDispatched` and settlement. */
  started: boolean;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * What a handler receives.
 *
 * `payload` if the action has one, else `data` if it has one, else the whole action —
 * so `{ type: 'OPEN', sessionId: '1' }` hands over an object with `sessionId` on it, and
 * a wrapped `{ type: 'OPEN', payload: {...} }` hands over the inner object. The
 * phase-3.5 spec wrote `action.data || action`, which mistakes a falsy payload (`0`,
 * `''`, `false`, `null`) for an absent one and hands over the envelope instead; presence
 * is tested here, not truthiness.
 */
export function payloadOf(action: ActionEnvelope): unknown {
  if ('payload' in action) return action.payload;
  if ('data' in action) return action.data;
  return action;
}

/**
 * Where a built-in store action's own fields (`key`, `value`, `values`, `merge`) are read
 * from: the envelope first, then the payload a handler would have been given.
 *
 * The built-ins used to read the envelope only, so
 * `{ type: 'SET_STORE', payload: { key: 'title', value: 'x' } }` — the shape a server
 * author writes first, and the shape a *handler* receives — was refused as `invalid`.
 * There was no reason for the asymmetry beyond the order the two paths were written in.
 *
 * Envelope wins on a collision, so every message that worked before still resolves to
 * exactly the same fields. Presence is what counts, not truthiness, so `{ value: 0 }` and
 * `{ value: null }` are values like any other — the same rule `payloadOf` follows.
 *
 * `storeName` is deliberately **not** in this list. The store a dispatcher writes to is the
 * node's own configuration and no message may name it, on the envelope or in a payload.
 */
export function builtInFieldOf(action: ActionEnvelope, field: 'key' | 'value' | 'values' | 'merge'): unknown {
  if (field in action) return (action as Record<string, unknown>)[field];
  const payload = payloadOf(action);
  if (payload !== action && isPlainRecord(payload) && field in payload) return payload[field];
  return undefined;
}

let nextActionSeq = 0;

/**
 * One queue, owned by one `Action Dispatcher` node.
 *
 * The queue is deliberately **not** channel-global. Two dispatcher nodes on the same
 * channel share the handler registry but keep separate queues, so there is never a
 * question of which node's outputs report a given action's fate.
 */
export class ActionDispatcher {
  private queue: QueueEntry[] = [];
  private current: QueueEntry | null = null;
  private pumping = false;
  private disposed = false;
  private waiting = false;
  private workSinceIdle = false;
  private idleEmitted = true;
  private recentTimes: number[] = [];

  private registry: ActionRegistry;
  private store: ActionStore;
  private setTimeoutImpl: (fn: () => void, ms: number) => unknown;
  private clearTimeoutImpl: (handle: unknown) => void;
  private nowImpl: () => number;

  constructor(
    public readonly options: ActionDispatcherOptions,
    private hooks: DispatcherHooks = {},
    deps: DispatcherDeps = {}
  ) {
    this.registry = deps.registry || actionRegistry;
    this.store = deps.store || (globalStoreManager as unknown as ActionStore);
    this.setTimeoutImpl = deps.setTimeoutImpl || ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutImpl = deps.clearTimeoutImpl || ((handle) => clearTimeout(handle as never));
    this.nowImpl = deps.nowImpl || (() => Date.now());
  }

  // -- observable state ----------------------------------------------------

  get queueSize(): number {
    return this.queue.length;
  }

  get isExecuting(): boolean {
    return this.current !== null && this.current.started;
  }

  /** The action type currently waiting for a handler to appear, or `''`. */
  get waitingFor(): string {
    return this.waiting && this.current ? this.current.action.type : '';
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  // -- input ---------------------------------------------------------------

  /**
   * Admits one action, an array of actions, or JSON text holding either.
   *
   * Everything that can be rejected is rejected *here or at the head of the queue*, never
   * halfway through executing: a malformed member of an array is refused on its own and
   * the rest of the array still runs, because dropping five good actions over one bad one
   * would be a worse failure than the bad one.
   *
   * @returns whether **anything at all** was admitted, which is what the node reports as the
   * outcome of one `Dispatch` (ERG-001 §4). A partial admission is `true`: some work was
   * accepted, and the members that were not are separately visible on `Refused`.
   */
  dispatch(raw: unknown): boolean {
    if (this.disposed) return false;

    const coerced = this.coerce(raw);
    if ('error' in coerced) {
      this.refuse(raw, '', 'invalid', coerced.error);
      return false;
    }

    let admitted = false;

    for (const candidate of coerced.actions) {
      if (!isPlainRecord(candidate)) {
        this.refuse(candidate, '', 'invalid', 'an action must be an object with a "type"');
        continue;
      }
      const type = candidate.type;
      if (typeof type !== 'string' || type === '') {
        this.refuse(candidate, '', 'invalid', 'an action must have a non-empty string "type"');
        continue;
      }

      const max = this.options.maxQueueSize;
      if (max > 0 && this.queue.length >= max) {
        this.refuse(candidate, type, 'queue-full', `the queue is full (${max}); this action was not accepted`);
        continue;
      }

      const action = candidate as ActionEnvelope;
      this.queue.push({
        id: typeof action.id === 'string' && action.id ? action.id : 'action_' + ++nextActionSeq,
        action,
        payload: payloadOf(action),
        handlers: [],
        index: 0,
        lastResult: undefined,
        timer: null,
        waitTimer: null,
        unlisten: null,
        inInvoke: false,
        token: null,
        started: false
      });
      admitted = true;
    }

    if (admitted) this.notifyQueue();
    this.pump();
    return admitted;
  }

  /**
   * Drops everything queued and abandons anything in flight. Returns how many actions
   * were discarded, so the graph can say so rather than have them vanish.
   */
  cancelAll(): number {
    const dropped = this.queue.length + (this.current ? 1 : 0);
    for (const entry of this.queue) this.clearEntryTimers(entry);
    this.queue.length = 0;
    if (this.current) {
      this.clearEntryTimers(this.current);
      this.current = null;
    }
    this.waiting = false;
    if (dropped > 0) this.notifyQueue();
    return dropped;
  }

  /**
   * Releases the dispatcher. Queued actions are **discarded, not executed** — the node
   * that would have shown their results is gone, and running UI actions into a disposed
   * component is worse than dropping them. Nothing is emitted, because there is nothing
   * left to emit to; what matters is that no timer and no registry listener survives.
   */
  dispose(): number {
    if (this.disposed) return 0;
    const dropped = this.queue.length + (this.current ? 1 : 0);
    for (const entry of this.queue) this.clearEntryTimers(entry);
    this.queue.length = 0;
    if (this.current) {
      this.clearEntryTimers(this.current);
      this.current = null;
    }
    this.waiting = false;
    this.disposed = true;
    return dropped;
  }

  // -- the loop ------------------------------------------------------------

  private pump(): void {
    if (this.pumping || this.disposed) return;
    this.pumping = true;

    try {
      while (!this.current && this.queue.length > 0 && !this.disposed) {
        const entry = this.queue.shift() as QueueEntry;
        this.notifyQueue();

        if (!this.allowRate()) {
          this.refuseEntry(entry, 'rate-limited', `rate limit of ${this.options.rateLimit} actions exceeded`);
          continue;
        }

        const type = entry.action.type;

        if (isBuiltInAction(type)) {
          const check = this.checkBuiltIn(entry.action);
          if (check) {
            this.refuseEntry(entry, check.reason, check.message);
            continue;
          }
          this.current = entry;
          this.runBuiltIn(entry);
          continue;
        }

        const handlers = this.registry.getHandlers(this.options.channel, type);
        if (handlers.length === 0) {
          const wait = this.options.waitForHandler;
          if (wait > 0) {
            this.current = entry;
            this.park(entry, wait);
            break;
          }
          this.refuseEntry(entry, 'unknown', `no handler is registered for "${type}"`);
          continue;
        }

        this.startExecution(entry, handlers);
      }
    } finally {
      this.pumping = false;
    }

    this.maybeIdle();
  }

  /**
   * Holds an action whose handler has not appeared yet.
   *
   * A component that registers its handlers on mount can easily lose a race with a stream
   * that is already open, and refusing on that race would be a bug the author sees only
   * intermittently. So the head of the queue waits — and because ordering is a promise
   * this dispatcher makes, everything behind it waits too. That is the trade, and it is
   * bounded: `waitForHandler` caps it, and `Waiting For` names the type that is holding
   * things up while it happens.
   */
  private park(entry: QueueEntry, wait: number): void {
    this.waiting = true;
    this.notifyQueue();

    entry.unlisten = this.registry.onRegister(this.options.channel, (registeredType: string) => {
      if (registeredType !== entry.action.type) return;
      if (this.current !== entry) return;
      this.unpark(entry);
      this.startExecution(entry, this.registry.getHandlers(this.options.channel, registeredType));
      // startExecution may settle synchronously; drive whatever is behind it.
      this.pump();
    });

    entry.waitTimer = this.setTimeoutImpl(() => {
      entry.waitTimer = null;
      if (this.current !== entry) return;
      this.unpark(entry);
      this.current = null;
      this.refuseEntry(entry, 'unknown', `no handler is registered for "${entry.action.type}"`);
      this.pump();
    }, wait);
  }

  private unpark(entry: QueueEntry): void {
    this.waiting = false;
    if (entry.unlisten) {
      entry.unlisten();
      entry.unlisten = null;
    }
    if (entry.waitTimer !== null) {
      this.clearTimeoutImpl(entry.waitTimer);
      entry.waitTimer = null;
    }
  }

  private startExecution(entry: QueueEntry, handlers: ActionHandler[]): void {
    entry.handlers = handlers.slice();
    entry.index = 0;
    entry.started = true;
    this.current = entry;
    this.workSinceIdle = true;
    this.idleEmitted = false;
    this.notifyQueue();
    this.emit('onDispatched', this.infoOf(entry));
    this.runNextHandler(entry);
  }

  /**
   * Walks this action's handlers in registration order, one at a time.
   *
   * Written as a loop with a `sync` flag rather than as recursion because a handler that
   * completes inside its own `invoke` — which is what `Auto Complete` does, and what most
   * handlers will do — would otherwise build a stack frame per handler and per queued
   * action, and a hundred-step guided tour would be a hundred frames deep.
   */
  private runNextHandler(entry: QueueEntry): void {
    for (;;) {
      if (this.current !== entry || this.disposed) return;

      if (entry.index >= entry.handlers.length) {
        this.settle(entry, true, entry.lastResult);
        return;
      }

      const handler = entry.handlers[entry.index];
      const token: HandlerToken = { done: false, sync: false };
      entry.token = token;

      const context: ActionContext = {
        actionId: entry.id,
        actionType: entry.action.type,
        action: entry.action,
        payload: entry.payload,
        complete: (result?: unknown) => {
          if (token.done || this.current !== entry) return;
          token.done = true;
          this.clearHandlerTimer(entry);
          if (result !== undefined) entry.lastResult = result;
          entry.index++;
          if (entry.inInvoke) token.sync = true;
          else this.runNextHandler(entry);
        },
        fail: (message: string) => {
          if (token.done || this.current !== entry) return;
          token.done = true;
          this.clearHandlerTimer(entry);
          this.settle(entry, false, String(message || 'the handler reported a failure'));
        }
      };

      const timeout = this.options.handlerTimeout;
      if (timeout > 0) {
        entry.timer = this.setTimeoutImpl(() => {
          entry.timer = null;
          if (token.done || this.current !== entry) return;
          token.done = true;
          this.settle(entry, false, `the handler for "${entry.action.type}" did not complete within ${timeout}ms`);
        }, timeout);
      }

      entry.inInvoke = true;
      try {
        handler.invoke(context);
      } catch (error) {
        entry.inInvoke = false;
        if (!token.done) {
          token.done = true;
          this.clearHandlerTimer(entry);
          this.settle(entry, false, String((error as Error)?.message || error));
        }
        return;
      }
      entry.inInvoke = false;

      if (!token.sync) return;
    }
  }

  private settle(entry: QueueEntry, ok: boolean, value: unknown): void {
    if (this.current !== entry) return;
    this.clearEntryTimers(entry);
    this.current = null;
    this.notifyQueue();

    if (ok) this.emit('onCompleted', Object.assign(this.infoOf(entry), { result: value }));
    else this.emit('onFailed', Object.assign(this.infoOf(entry), { error: String(value) }));

    this.pump();
  }

  // -- built-ins -----------------------------------------------------------

  /**
   * Everything that can make a built-in unacceptable, checked **before** it is announced
   * as dispatched — so an unauthorised write is a refusal the author can see as such,
   * rather than a dispatch that immediately fails and looks like a bug in their handler.
   */
  private checkBuiltIn(action: ActionEnvelope): { reason: RefusalReason; message: string } | null {
    const type = action.type;

    if (this.options.builtIns.indexOf(type) === -1) {
      return {
        reason: 'not-allowed',
        message: `"${type}" is a built-in action but this dispatcher does not have it enabled`
      };
    }

    const allowed = this.options.allowedKeys;

    if (type === 'SET_STORE' || type === 'DELETE_STORE_KEY') {
      const key = builtInFieldOf(action, 'key');
      if (typeof key !== 'string' || key === '') {
        return { reason: 'invalid', message: `${type} requires a non-empty string "key"` };
      }
      if (allowed.length > 0 && allowed.indexOf(key) === -1) {
        return { reason: 'not-allowed', message: `the key "${key}" is not in this dispatcher's allowed keys` };
      }
      return null;
    }

    if (type === 'MERGE_STORE') {
      const values = builtInFieldOf(action, 'values');
      if (!isPlainRecord(values)) {
        return { reason: 'invalid', message: 'MERGE_STORE requires a "values" object' };
      }
      if (allowed.length > 0) {
        const rejected = Object.keys(values).filter((key) => allowed.indexOf(key) === -1);
        if (rejected.length > 0) {
          return {
            reason: 'not-allowed',
            message: `these keys are not in this dispatcher's allowed keys: ${rejected.join(', ')}`
          };
        }
      }
      return null;
    }

    if (type === 'CLEAR_STORE') {
      if (allowed.length > 0) {
        // Clearing would take out keys the allow-list was written to protect, so an
        // allow-list and a clear are mutually exclusive rather than quietly reconciled.
        return {
          reason: 'not-allowed',
          message: 'CLEAR_STORE is refused while allowed keys are set, because it would remove keys outside them'
        };
      }
      return null;
    }

    return { reason: 'unknown', message: `"${type}" is not a known built-in action` };
  }

  private runBuiltIn(entry: QueueEntry): void {
    entry.started = true;
    this.workSinceIdle = true;
    this.idleEmitted = false;
    this.notifyQueue();
    this.emit('onDispatched', this.infoOf(entry));

    const action = entry.action;
    const storeName = this.options.storeName;

    try {
      let result: unknown;
      // Resolved with the same rule `checkBuiltIn` validated with — `builtInFieldOf` is
      // pure, so the two cannot disagree about what this action says.
      switch (action.type) {
        case 'SET_STORE': {
          const key = builtInFieldOf(action, 'key') as string;
          this.store.setKey(storeName, key, builtInFieldOf(action, 'value'), {
            merge: builtInFieldOf(action, 'merge') === true
          });
          result = { storeName, key };
          break;
        }
        case 'MERGE_STORE': {
          const values = builtInFieldOf(action, 'values') as Record<string, unknown>;
          this.store.setState(storeName, values);
          result = { storeName, keys: Object.keys(values) };
          break;
        }
        case 'DELETE_STORE_KEY': {
          const key = builtInFieldOf(action, 'key') as string;
          this.store.deleteKey(storeName, key);
          result = { storeName, key };
          break;
        }
        case 'CLEAR_STORE':
          this.store.clearStore(storeName);
          result = { storeName };
          break;
        default:
          throw new Error(`"${action.type}" is not a known built-in action`);
      }
      this.settle(entry, true, result);
    } catch (error) {
      this.settle(entry, false, String((error as Error)?.message || error));
    }
  }

  // -- plumbing ------------------------------------------------------------

  private coerce(raw: unknown): { actions: unknown[] } | { error: string } {
    if (raw === undefined || raw === null) return { error: 'no action was provided' };

    let value = raw;

    if (typeof value === 'string') {
      const text = value.trim();
      if (text === '') return { error: 'no action was provided' };
      try {
        value = JSON.parse(text);
      } catch (error) {
        return { error: 'the action is not valid JSON: ' + String((error as Error)?.message || error) };
      }
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return { error: 'the action array is empty' };
      return { actions: value.slice() };
    }

    return { actions: [value] };
  }

  /** Sliding window. Timestamps outside the window are forgotten rather than accumulated. */
  private allowRate(): boolean {
    const limit = this.options.rateLimit;
    if (limit <= 0) return true;

    const window = this.options.rateLimitWindow > 0 ? this.options.rateLimitWindow : 60000;
    const now = this.nowImpl();
    const cutoff = now - window;

    while (this.recentTimes.length > 0 && this.recentTimes[0] <= cutoff) this.recentTimes.shift();
    if (this.recentTimes.length >= limit) return false;

    this.recentTimes.push(now);
    return true;
  }

  private clearHandlerTimer(entry: QueueEntry): void {
    if (entry.timer !== null) {
      this.clearTimeoutImpl(entry.timer);
      entry.timer = null;
    }
  }

  private clearEntryTimers(entry: QueueEntry): void {
    this.clearHandlerTimer(entry);
    this.unpark(entry);
  }

  private refuseEntry(entry: QueueEntry, reason: RefusalReason, message: string): void {
    this.clearEntryTimers(entry);
    this.workSinceIdle = true;
    this.idleEmitted = false;
    this.emit('onRefused', {
      actionId: entry.id,
      actionType: entry.action.type,
      reason,
      message,
      action: entry.action
    });
  }

  private refuse(action: unknown, actionType: string, reason: RefusalReason, message: string): void {
    this.workSinceIdle = true;
    this.idleEmitted = false;
    this.emit('onRefused', {
      actionId: 'action_' + ++nextActionSeq,
      actionType,
      reason,
      message,
      action
    });
  }

  private maybeIdle(): void {
    if (this.disposed || this.current || this.queue.length > 0) return;
    if (this.idleEmitted || !this.workSinceIdle) return;
    this.idleEmitted = true;
    this.workSinceIdle = false;
    this.emit('onIdle');
  }

  private notifyQueue(): void {
    this.emit('onQueueChanged');
  }

  private infoOf(entry: QueueEntry): ActionInfo {
    return {
      actionId: entry.id,
      actionType: entry.action.type,
      action: entry.action,
      payload: entry.payload
    };
  }

  /**
   * Hooks are graph outputs, and a node that throws while reacting must not take the
   * queue down with it — the next action still has to run, and the failure still has to
   * be visible somewhere.
   */
  private emit<K extends keyof DispatcherHooks>(name: K, ...args: unknown[]): void {
    const hook = this.hooks[name] as ((...a: unknown[]) => void) | undefined;
    if (!hook) return;
    try {
      hook.apply(this.hooks, args);
    } catch (error) {
      console.error(`[ActionDispatcher] ${String(name)} hook threw:`, error);
    }
  }
}

/** Splits a comma-separated port value. Blank, whitespace and stray commas yield an empty list. */
export function parseList(value: string | undefined | null): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
