/**
 * What `this` is inside each agent node's own callbacks — the per-instance scratch
 * space it keeps, and the `methods` it installs on itself.
 *
 * A node definition's callbacks are typed `this: NodeInstance`, which is the *published*
 * surface: it knows nothing about the methods that definition adds beside them. So a
 * method calling a sibling method was written `(this as any).addChunk()`, and a test
 * driving one was written `(node as any).handleFrame(frame)` — three descriptions of one
 * object (the definition, its methods, its tests), none of them checked against the
 * others.
 *
 * Naming each surface once here is the same rule `RuntimeVisualNode` follows in
 * `src/internal.d.ts`. Declarations rather than a module because the node files use
 * `export =` for their `{ node }` payload, which forbids exporting anything else beside
 * it — there was nowhere for these to live in the files that own them.
 *
 * Adding a method to a definition's `methods` block without adding it here does not
 * break the build; the cost shows up at the call site, which stops compiling. That is
 * the intended pressure.
 *
 * **Every `*Internal` below is a `type`, not an `interface`, and must stay one.**
 * `NodeInstance._internal` is `Record<string, unknown>`, and only a type alias for an
 * object literal gets TypeScript's implicit index signature — an interface does not, so
 * narrowing `_internal` with one makes the whole node instance unassignable to
 * `NodeInstance` and every callback in the definition fails to typecheck at once. That
 * is why `globalstorenode.ts` could narrow its `_internal` inline and these could not.
 */

import type { NodeInstance } from '@noodl/types';

import type { SseConnection, SseConnectionState, SseTransportEnv } from './sse-connection';
import type { SseFrame } from './stream-parsers';
import type { WebSocketConnection, WebSocketConnectionConfig } from './websocket-connection';

// ---------------------------------------------------------------------------
// net.noodl.SSE
// ---------------------------------------------------------------------------

export type SseInternal = {
  url: string;
  transport: 'auto' | 'eventsource' | 'fetch';
  method: string;
  headers: Record<string, string> | null;
  body: unknown;
  withCredentials: boolean;
  eventTypes: string;
  textPath: string;
  autoConnect: boolean;
  autoReconnect: boolean;
  reconnectOnStreamEnd: boolean;
  reconnectDelay: number;
  maxReconnectDelay: number;
  maxRetries: number;
  dedupeById: boolean;

  connection: SseConnection | null;
  connectionState: SseConnectionState;
  data: unknown;
  raw: string;
  eventType: string;
  autoConnectScheduled: boolean;
  /**
   * Injectable environment, read once per connect.
   *
   * Production leaves this empty and the connection falls through to the platform
   * globals. Tests assign to it before connecting; the runtime's test environment is
   * `node`, where `EventSource` and streaming `fetch` do not exist, so a seam is the
   * only way the lifecycle matrix can be exercised at all.
   */
  seams: SseTransportEnv;
};

export interface SseNodeInstance extends NodeInstance {
  _internal: SseInternal;

  scheduleAutoConnect(): void;
  doConnect(): void;
  doDisconnect(): void;
  teardownConnection(): void;
  handleState(state: SseConnectionState): void;
  handleFrame(frame: { event: string; data: string; id: string }): void;
  handleError(message: string): void;
}

// ---------------------------------------------------------------------------
// net.noodl.TextAccumulator
// ---------------------------------------------------------------------------

export type AccumulatorInternal = {
  pendingChunk: string;
  buffer: string;
  messages: string[];
  lastMessage: string;
  delimiter: string;
  maxLength: number;
  maxMessages: number;
  droppedCharacters: number;
  droppedMessages: number;
  error: string;
};

export interface TextAccumulatorNodeInstance extends NodeInstance {
  _internal: AccumulatorInternal;

  reportChunkError(message: string): void;
  clearChunkError(): void;
  addChunk(): void;
  clearBuffer(): void;
}

// ---------------------------------------------------------------------------
// net.noodl.StreamBuffer
// ---------------------------------------------------------------------------

/** Timer seams only; this node has no transport. See {@link SseInternal.seams}. */
export interface StreamBufferSeams {
  setTimeoutImpl?(handler: () => void, timeout: number): unknown;
  clearTimeoutImpl?(handle: unknown): void;
}

export type BufferInternal = {
  pendingData: unknown;
  hasPendingData: boolean;
  buffer: unknown[];
  flushedData: unknown[];
  flushCount: number;
  droppedItems: number;
  flushSize: number;
  flushInterval: number;
  maxSize: number;
  /** Whatever `setTimeoutImpl` returned — a number in a browser, a Timeout in Node. */
  timer: unknown;
  seams: StreamBufferSeams;
};

export interface StreamBufferNodeInstance extends NodeInstance {
  _internal: BufferInternal;

  addItem(): void;
  doFlush(): void;
  clearBuffer(): void;
  armTimer(): void;
  stopTimer(): void;
}

// ---------------------------------------------------------------------------
// net.noodl.JSONStreamParser
// ---------------------------------------------------------------------------

export type JsonStreamFormat = 'ndjson' | 'stream' | 'single';

export type ParserInternal = {
  pendingChunk: string;
  buffer: string;
  format: JsonStreamFormat;
  maxLength: number;
  parsed: unknown;
  values: unknown[];
  totalValues: number;
  error: string;
  errorCount: number;
  isComplete: boolean;
};

export interface JsonStreamParserNodeInstance extends NodeInstance {
  _internal: ParserInternal;

  doParse(): void;
  reportError(message: string): void;
  clearBuffer(): void;
}

// ---------------------------------------------------------------------------
// net.noodl.PatternExtractor
// ---------------------------------------------------------------------------

export type ExtractorInternal = {
  text: string;
  pattern: string;
  flags: string;
  extractAll: boolean;
  match: string | null;
  matches: string[];
  groups: string[];
  namedGroups: Record<string, string>;
  error: string;
};

export interface PatternExtractorNodeInstance extends NodeInstance {
  _internal: ExtractorInternal;

  doExtract(): void;
}

// ---------------------------------------------------------------------------
// The nodes that already spell their surface out inline
//
// websocket.ts, actiondispatchernode.ts and actionhandlernode.ts write
// `(this as NodeInstance & { scheduleRebuild(): void })` at each call site instead of
// reaching for `any`, so they never contributed markers. The names are still needed
// here, because a *test* driving one of these has the same problem and no inline
// intersection to borrow.
// ---------------------------------------------------------------------------

export interface WebSocketNodeInstance extends NodeInstance {
  getConnection(): WebSocketConnection;
  applyConfig(config: WebSocketConnectionConfig): void;
  scheduleRebuild(): void;
  rebuild(): void;
}

export interface ActionDispatcherNodeInstance extends NodeInstance {
  doDispatch(): void;
  doCancel(): void;
}

export interface ActionHandlerNodeInstance extends NodeInstance {
  scheduleSetup(): void;
  setupRegistration(): void;
  teardownRegistration(): void;
  doComplete(): void;
  doFail(): void;
}

export interface GlobalStoreNodeInstance extends NodeInstance {
  scheduleSetup(): void;
  setupStore(): void;
  teardown(): void;
}

/** Re-exported so a consumer needs one import for a node and the frames it handles. */
export type { SseFrame };
