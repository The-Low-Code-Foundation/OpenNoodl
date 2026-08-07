# Phase 6C: UBA Debug System

## Real-Time Backend Debugging and Observability

**Phase:** 6C of 6  
**Duration:** 2 weeks (10 working days)  
**Priority:** HIGH  
**Status:** NOT STARTED  
**Depends On:** Phase 6A complete

---

## Overview

Phase 6C implements the debug system that allows users to observe their backend's execution in real-time. This is crucial for AI agent backends like Erleah where understanding the agent's reasoning process is essential for debugging and prompt tuning.

The debug panel connects to a backend's debug stream (WebSocket or SSE) and displays events in a structured, expandable tree view with filtering, searching, and export capabilities.

### Value Proposition

**Without Debug Panel:**
```
User: "Why did the agent give a wrong answer?"
Developer: *checks server logs* *searches through JSON* *rebuilds mental model*
Time wasted: 30 minutes
```

**With Debug Panel:**
```
User: "Why did the agent give a wrong answer?"
Developer: *opens debug panel* *sees exact tool calls* *spots wrong parameter*
Time wasted: 30 seconds
```

---

## Goals

1. **Build debug connection** - WebSocket and SSE support with auto-reconnect
2. **Create event store** - Store, filter, and search debug events
3. **Build debug panel UI** - Tree view with expand/collapse, filtering, search
4. **Implement export** - JSON and CSV export of debug sessions
5. **Add sidebar integration** - Debug panel accessible from Backend Services

---

## Prerequisites

- Phase 6A complete ✅
- Backend Services panel working ✅
- UBA backend with debug endpoint (for testing)

---

## Task Breakdown

### UBA-014: Debug Connection
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-014-debug-connection`

#### Description

Implement WebSocket and SSE connection handlers for receiving debug events from backends. Include auto-reconnect logic, connection state management, and event parsing.

#### Connection Protocol

Backends expose debug streams at their configured `debug_stream` endpoint:

**WebSocket:**
```
wss://backend.example.com/nodegx/debug
```

**SSE:**
```
GET https://backend.example.com/nodegx/debug
Accept: text/event-stream
```

**Event Format:**
```json
{
  "id": "evt_abc123",
  "timestamp": "2026-01-07T14:23:45.123Z",
  "request_id": "req_xyz789",
  "type": "tool_call",
  "data": {
    "tool": "vector_search",
    "args": { "query": "Python developers" },
    "result": { "count": 12 },
    "duration_ms": 423
  }
}
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── DebugConnection.ts
├── WebSocketConnection.ts
├── SSEConnection.ts
└── DebugEvent.ts
```

#### Implementation

```typescript
// DebugEvent.ts
export interface DebugEvent {
  id: string;
  timestamp: string;
  request_id: string;
  type: string;
  data: Record<string, any>;
}

export interface ParsedDebugEvent extends DebugEvent {
  parsedTimestamp: Date;
  formattedTime: string;
}

export function parseDebugEvent(raw: string | object): ParsedDebugEvent {
  const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const parsedTimestamp = new Date(event.timestamp);
  
  return {
    ...event,
    parsedTimestamp,
    formattedTime: parsedTimestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  };
}

// DebugConnection.ts
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DebugConnectionConfig {
  url: string;
  auth?: AuthConfig;
  protocol: 'websocket' | 'sse';
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface DebugConnectionCallbacks {
  onEvent: (event: ParsedDebugEvent) => void;
  onStateChange: (state: ConnectionState) => void;
  onError: (error: Error) => void;
}

export class DebugConnection {
  private config: DebugConnectionConfig;
  private callbacks: DebugConnectionCallbacks;
  private connection: WebSocketConnection | SSEConnection | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private state: ConnectionState = 'disconnected';
  
  constructor(config: DebugConnectionConfig, callbacks: DebugConnectionCallbacks) {
    this.config = {
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10,
      ...config
    };
    this.callbacks = callbacks;
  }
  
  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }
    
    this.setState('connecting');
    this.reconnectAttempts = 0;
    
    try {
      if (this.config.protocol === 'websocket') {
        this.connection = new WebSocketConnection(
          this.config.url,
          this.config.auth,
          this.handleEvent.bind(this),
          this.handleConnectionClose.bind(this),
          this.handleError.bind(this)
        );
      } else {
        this.connection = new SSEConnection(
          this.config.url,
          this.config.auth,
          this.handleEvent.bind(this),
          this.handleConnectionClose.bind(this),
          this.handleError.bind(this)
        );
      }
      
      await this.connection.connect();
      this.setState('connected');
    } catch (error) {
      this.handleError(error);
    }
  }
  
  disconnect(): void {
    this.clearReconnectTimeout();
    this.connection?.disconnect();
    this.connection = null;
    this.setState('disconnected');
  }
  
  private handleEvent(rawEvent: string | object): void {
    try {
      const event = parseDebugEvent(rawEvent);
      this.callbacks.onEvent(event);
    } catch (error) {
      console.error('Failed to parse debug event:', error, rawEvent);
    }
  }
  
  private handleConnectionClose(): void {
    this.connection = null;
    
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }
  
  private handleError(error: Error): void {
    this.callbacks.onError(error);
    this.setState('error');
    
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    this.clearReconnectTimeout();
    this.reconnectAttempts++;
    
    const delay = this.config.reconnectDelay! * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  private setState(state: ConnectionState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }
  
  getState(): ConnectionState {
    return this.state;
  }
}

// WebSocketConnection.ts
export class WebSocketConnection {
  private ws: WebSocket | null = null;
  
  constructor(
    private url: string,
    private auth: AuthConfig | undefined,
    private onEvent: (event: string | object) => void,
    private onClose: () => void,
    private onError: (error: Error) => void
  ) {}
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add auth as query parameter if needed
      const wsUrl = this.buildUrl();
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        this.onEvent(event.data);
      };
      
      this.ws.onclose = () => {
        this.ws = null;
        this.onClose();
      };
      
      this.ws.onerror = (event) => {
        reject(new Error('WebSocket connection failed'));
      };
    });
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  private buildUrl(): string {
    const url = new URL(this.url);
    
    if (this.auth) {
      // Add token as query parameter for WebSocket
      // (Headers not well supported in browser WebSocket)
      url.searchParams.set('token', this.auth.token);
    }
    
    return url.toString();
  }
}

// SSEConnection.ts
export class SSEConnection {
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;
  
  constructor(
    private url: string,
    private auth: AuthConfig | undefined,
    private onEvent: (event: string | object) => void,
    private onClose: () => void,
    private onError: (error: Error) => void
  ) {}
  
  async connect(): Promise<void> {
    // If auth is needed and browser EventSource doesn't support headers,
    // use fetch with streaming instead
    if (this.auth) {
      return this.connectWithFetch();
    }
    
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.url);
      
      this.eventSource.onopen = () => {
        resolve();
      };
      
      this.eventSource.onmessage = (event) => {
        this.onEvent(event.data);
      };
      
      this.eventSource.onerror = () => {
        this.onError(new Error('SSE connection failed'));
        this.disconnect();
      };
    });
  }
  
  private async connectWithFetch(): Promise<void> {
    this.abortController = new AbortController();
    
    const response = await fetch(this.url, {
      headers: {
        'Accept': 'text/event-stream',
        ...buildAuthHeaders(this.auth)
      },
      signal: this.abortController.signal
    });
    
    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    const processStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            this.onClose();
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          
          // Parse SSE format
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.trim()) {
                this.onEvent(data);
              }
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.onError(error);
        }
      }
    };
    
    processStream();
  }
  
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
```

#### Acceptance Criteria

- [ ] WebSocket connection works
- [ ] SSE connection works
- [ ] Auth headers/tokens sent correctly
- [ ] Events parsed and emitted
- [ ] Auto-reconnect with exponential backoff
- [ ] Max reconnect attempts respected
- [ ] Connection state tracked
- [ ] Graceful disconnect works

#### Test Cases

```typescript
describe('DebugConnection', () => {
  describe('WebSocket', () => {
    it('connects to WebSocket endpoint', async () => { /* ... */ });
    it('receives and parses events', async () => { /* ... */ });
    it('reconnects on disconnect', async () => { /* ... */ });
    it('stops reconnecting after max attempts', async () => { /* ... */ });
  });
  
  describe('SSE', () => {
    it('connects to SSE endpoint', async () => { /* ... */ });
    it('handles auth with fetch fallback', async () => { /* ... */ });
    it('parses SSE event format', async () => { /* ... */ });
  });
});
```

---

### UBA-015: Debug Event Store
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-015-debug-store`  
**Depends On:** UBA-014

#### Description

Create a store for managing debug events with filtering, searching, grouping by request, and memory-efficient storage (ring buffer).

#### Features

- Store events in memory (ring buffer to prevent memory leaks)
- Group events by request_id
- Filter by event type
- Search across event data
- Track timing statistics

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── DebugStore.ts
└── hooks/
    └── useDebugStore.ts
```

#### Implementation

```typescript
// DebugStore.ts
export interface DebugRequest {
  id: string;
  startTime: Date;
  endTime?: Date;
  events: ParsedDebugEvent[];
  status: 'active' | 'complete' | 'error';
  summary?: RequestSummary;
}

export interface RequestSummary {
  totalDuration: number;
  toolCalls: number;
  llmCalls: number;
  errors: number;
  totalCost?: number;
}

export interface DebugStoreOptions {
  maxEvents?: number;
  maxRequests?: number;
}

export class DebugStore {
  private events: ParsedDebugEvent[] = [];
  private requests: Map<string, DebugRequest> = new Map();
  private requestOrder: string[] = []; // For LRU eviction
  private options: Required<DebugStoreOptions>;
  private listeners: Set<() => void> = new Set();
  
  constructor(options: DebugStoreOptions = {}) {
    this.options = {
      maxEvents: 10000,
      maxRequests: 100,
      ...options
    };
  }
  
  addEvent(event: ParsedDebugEvent): void {
    // Add to events list (ring buffer)
    this.events.push(event);
    if (this.events.length > this.options.maxEvents) {
      this.events.shift();
    }
    
    // Add to request grouping
    this.addEventToRequest(event);
    
    this.notifyListeners();
  }
  
  private addEventToRequest(event: ParsedDebugEvent): void {
    const requestId = event.request_id;
    
    let request = this.requests.get(requestId);
    
    if (!request) {
      // New request
      request = {
        id: requestId,
        startTime: event.parsedTimestamp,
        events: [],
        status: 'active'
      };
      this.requests.set(requestId, request);
      this.requestOrder.push(requestId);
      
      // Evict old requests if needed
      this.evictOldRequests();
    }
    
    request.events.push(event);
    
    // Update request status based on event type
    if (event.type === 'request_end') {
      request.endTime = event.parsedTimestamp;
      request.status = 'complete';
      request.summary = this.calculateSummary(request);
    } else if (event.type === 'error') {
      request.status = 'error';
    }
    
    // Update LRU order
    const idx = this.requestOrder.indexOf(requestId);
    if (idx > 0) {
      this.requestOrder.splice(idx, 1);
      this.requestOrder.push(requestId);
    }
  }
  
  private evictOldRequests(): void {
    while (this.requestOrder.length > this.options.maxRequests) {
      const oldestId = this.requestOrder.shift()!;
      this.requests.delete(oldestId);
    }
  }
  
  private calculateSummary(request: DebugRequest): RequestSummary {
    let toolCalls = 0;
    let llmCalls = 0;
    let errors = 0;
    let totalCost = 0;
    
    for (const event of request.events) {
      if (event.type === 'tool_call') toolCalls++;
      if (event.type === 'llm_call') {
        llmCalls++;
        totalCost += event.data.cost_usd || 0;
      }
      if (event.type === 'error') errors++;
    }
    
    const totalDuration = request.endTime 
      ? request.endTime.getTime() - request.startTime.getTime()
      : 0;
    
    return { totalDuration, toolCalls, llmCalls, errors, totalCost };
  }
  
  getRequests(): DebugRequest[] {
    return Array.from(this.requests.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }
  
  getRequest(requestId: string): DebugRequest | undefined {
    return this.requests.get(requestId);
  }
  
  getAllEvents(): ParsedDebugEvent[] {
    return [...this.events];
  }
  
  filter(options: FilterOptions): ParsedDebugEvent[] {
    let filtered = this.events;
    
    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter(e => options.types!.includes(e.type));
    }
    
    if (options.requestId) {
      filtered = filtered.filter(e => e.request_id === options.requestId);
    }
    
    if (options.since) {
      filtered = filtered.filter(e => e.parsedTimestamp >= options.since!);
    }
    
    if (options.until) {
      filtered = filtered.filter(e => e.parsedTimestamp <= options.until!);
    }
    
    return filtered;
  }
  
  search(query: string): ParsedDebugEvent[] {
    const lowerQuery = query.toLowerCase();
    
    return this.events.filter(event => {
      // Search in type
      if (event.type.toLowerCase().includes(lowerQuery)) return true;
      
      // Search in data (recursive)
      return this.searchInObject(event.data, lowerQuery);
    });
  }
  
  private searchInObject(obj: any, query: string): boolean {
    if (typeof obj === 'string') {
      return obj.toLowerCase().includes(query);
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj).toLowerCase().includes(query);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => this.searchInObject(item, query));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => this.searchInObject(value, query));
    }
    
    return false;
  }
  
  clear(): void {
    this.events = [];
    this.requests.clear();
    this.requestOrder = [];
    this.notifyListeners();
  }
  
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

interface FilterOptions {
  type?: string;
  types?: string[];
  requestId?: string;
  since?: Date;
  until?: Date;
}

// useDebugStore.ts
export function useDebugStore(): DebugStore {
  const storeRef = useRef<DebugStore>();
  
  if (!storeRef.current) {
    storeRef.current = new DebugStore();
  }
  
  return storeRef.current;
}

export function useDebugEvents(store: DebugStore, filter?: FilterOptions) {
  const [events, setEvents] = useState<ParsedDebugEvent[]>([]);
  
  useEffect(() => {
    const update = () => {
      const filtered = filter ? store.filter(filter) : store.getAllEvents();
      setEvents(filtered);
    };
    
    update();
    return store.subscribe(update);
  }, [store, filter]);
  
  return events;
}

export function useDebugRequests(store: DebugStore) {
  const [requests, setRequests] = useState<DebugRequest[]>([]);
  
  useEffect(() => {
    const update = () => {
      setRequests(store.getRequests());
    };
    
    update();
    return store.subscribe(update);
  }, [store]);
  
  return requests;
}
```

#### Acceptance Criteria

- [ ] Events stored in ring buffer
- [ ] Events grouped by request_id
- [ ] Filter by type works
- [ ] Filter by date range works
- [ ] Search across event data works
- [ ] Request summary calculated
- [ ] Old requests evicted (LRU)
- [ ] Clear removes all events
- [ ] Subscribers notified on changes

---

### UBA-016: Debug Panel UI
**Effort:** 5 days  
**Assignee:** TBD  
**Branch:** `feature/uba-016-debug-panel`  
**Depends On:** UBA-015

#### Description

Build the main debug panel interface with request list, event tree, expandable data views, filtering, and search.

#### UI Components

1. **Header** - Backend name, connection status, controls
2. **Request List** - List of requests with summary
3. **Event Tree** - Events for selected request
4. **Event Detail** - Expanded view of event data
5. **Filter Bar** - Event type filters, search

#### Files to Create

```
packages/noodl-editor/src/editor/src/views/UBA/
├── DebugPanel.tsx
├── DebugPanel.module.scss
├── DebugHeader.tsx
├── DebugRequestList.tsx
├── DebugEventTree.tsx
├── DebugEventDetail.tsx
├── DebugFilterBar.tsx
└── components/
    ├── ConnectionStatus.tsx
    ├── EventBadge.tsx
    ├── ExpandableData.tsx
    └── DurationBadge.tsx
```

#### Implementation

```typescript
// DebugPanel.tsx
interface DebugPanelProps {
  backend: UBABackend;
  schema: UBASchema;
}

export function DebugPanel({ backend, schema }: DebugPanelProps) {
  const store = useDebugStore();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOptions>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [paused, setPaused] = useState(false);
  
  const connectionRef = useRef<DebugConnection | null>(null);
  
  // Connect to debug stream
  useEffect(() => {
    if (!schema.debug?.enabled || !schema.backend.endpoints.debug_stream) {
      return;
    }
    
    const debugUrl = new URL(
      schema.backend.endpoints.debug_stream,
      backend.url
    ).toString();
    
    connectionRef.current = new DebugConnection(
      {
        url: debugUrl,
        auth: backend.auth,
        protocol: debugUrl.startsWith('wss') ? 'websocket' : 'sse'
      },
      {
        onEvent: (event) => {
          if (!paused) {
            store.addEvent(event);
          }
        },
        onStateChange: setConnectionState,
        onError: (error) => console.error('Debug connection error:', error)
      }
    );
    
    connectionRef.current.connect();
    
    return () => {
      connectionRef.current?.disconnect();
    };
  }, [backend, schema, paused, store]);
  
  const requests = useDebugRequests(store);
  const selectedRequestData = selectedRequest 
    ? store.getRequest(selectedRequest)
    : null;
  
  const filteredEvents = useMemo(() => {
    if (!selectedRequestData) return [];
    
    let events = selectedRequestData.events;
    
    if (filter.types && filter.types.length > 0) {
      events = events.filter(e => filter.types!.includes(e.type));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      events = events.filter(e => 
        e.type.toLowerCase().includes(query) ||
        JSON.stringify(e.data).toLowerCase().includes(query)
      );
    }
    
    return events;
  }, [selectedRequestData, filter, searchQuery]);
  
  const handleClear = () => {
    store.clear();
    setSelectedRequest(null);
  };
  
  return (
    <div className={css['debug-panel']}>
      <DebugHeader
        backend={backend}
        connectionState={connectionState}
        paused={paused}
        onPauseToggle={() => setPaused(!paused)}
        onClear={handleClear}
        onReconnect={() => connectionRef.current?.connect()}
      />
      
      <div className={css['debug-content']}>
        <DebugRequestList
          requests={requests}
          selectedId={selectedRequest}
          onSelect={setSelectedRequest}
        />
        
        <div className={css['event-panel']}>
          {selectedRequestData ? (
            <>
              <DebugFilterBar
                eventTypes={getUniqueEventTypes(selectedRequestData.events)}
                filter={filter}
                onFilterChange={setFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
              
              <DebugEventTree
                events={filteredEvents}
                eventSchema={schema.debug?.event_schema}
              />
            </>
          ) : (
            <div className={css['empty-state']}>
              <IconActivity />
              <p>Select a request to view events</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// DebugRequestList.tsx
interface DebugRequestListProps {
  requests: DebugRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DebugRequestList({ requests, selectedId, onSelect }: DebugRequestListProps) {
  return (
    <div className={css['request-list']}>
      <h3>Requests</h3>
      
      {requests.length === 0 ? (
        <div className={css['empty']}>
          <p>No requests yet</p>
          <p className={css['hint']}>Events will appear when the backend processes requests</p>
        </div>
      ) : (
        <ul>
          {requests.map(request => (
            <li
              key={request.id}
              className={cn(
                css['request-item'],
                selectedId === request.id && css['selected'],
                css[`status-${request.status}`]
              )}
              onClick={() => onSelect(request.id)}
            >
              <div className={css['request-header']}>
                <span className={css['request-time']}>
                  {request.startTime.toLocaleTimeString()}
                </span>
                <StatusBadge status={request.status} />
              </div>
              
              {request.summary && (
                <div className={css['request-summary']}>
                  <span>{request.summary.totalDuration}ms</span>
                  <span>{request.summary.toolCalls} tools</span>
                  <span>{request.summary.llmCalls} LLM</span>
                  {request.summary.totalCost > 0 && (
                    <span>${request.summary.totalCost.toFixed(4)}</span>
                  )}
                </div>
              )}
              
              <div className={css['event-count']}>
                {request.events.length} events
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// DebugEventTree.tsx
interface DebugEventTreeProps {
  events: ParsedDebugEvent[];
  eventSchema?: DebugEventSchema[];
}

export function DebugEventTree({ events, eventSchema }: DebugEventTreeProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };
  
  const getEventConfig = (type: string) => {
    return eventSchema?.find(s => s.id === type);
  };
  
  return (
    <div className={css['event-tree']}>
      {events.map(event => {
        const config = getEventConfig(event.type);
        const isExpanded = expandedEvents.has(event.id);
        
        return (
          <div key={event.id} className={css['event-item']}>
            <div 
              className={css['event-header']}
              onClick={() => toggleExpand(event.id)}
            >
              <span className={css['expand-icon']}>
                {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
              </span>
              
              <span className={css['event-time']}>
                {event.formattedTime}
              </span>
              
              <EventBadge 
                type={event.type}
                color={config?.fields?.find(f => f.id === 'step')?.colors?.[event.data.step]}
              />
              
              {event.data.tool && (
                <span className={css['tool-name']}>{event.data.tool}</span>
              )}
              
              {event.data.duration_ms && (
                <DurationBadge duration={event.data.duration_ms} />
              )}
              
              {event.data.error && (
                <span className={css['error-indicator']}>
                  <IconAlertCircle />
                </span>
              )}
            </div>
            
            {isExpanded && (
              <DebugEventDetail event={event} schema={config} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// DebugEventDetail.tsx
export function DebugEventDetail({ event, schema }: DebugEventDetailProps) {
  return (
    <div className={css['event-detail']}>
      {Object.entries(event.data).map(([key, value]) => {
        const fieldSchema = schema?.fields?.find(f => f.id === key);
        
        return (
          <div key={key} className={css['detail-row']}>
            <span className={css['detail-key']}>{key}:</span>
            <ExpandableData 
              value={value} 
              schema={fieldSchema}
            />
          </div>
        );
      })}
    </div>
  );
}

// ExpandableData.tsx
export function ExpandableData({ value, schema, depth = 0 }: ExpandableDataProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  
  if (value === null || value === undefined) {
    return <span className={css['null-value']}>null</span>;
  }
  
  if (typeof value === 'string') {
    // Check for special formatting
    if (schema?.highlight === 'error') {
      return <span className={css['error-value']}>{value}</span>;
    }
    return <span className={css['string-value']}>"{value}"</span>;
  }
  
  if (typeof value === 'number') {
    if (schema?.format === 'duration') {
      return <span className={css['duration-value']}>{value}ms</span>;
    }
    if (schema?.format === 'currency') {
      return <span className={css['currency-value']}>${value.toFixed(4)}</span>;
    }
    return <span className={css['number-value']}>{value}</span>;
  }
  
  if (typeof value === 'boolean') {
    return <span className={css['boolean-value']}>{String(value)}</span>;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className={css['empty-array']}>[]</span>;
    }
    
    return (
      <div className={css['array-value']}>
        <button onClick={() => setExpanded(!expanded)} className={css['expand-toggle']}>
          {expanded ? '▼' : '▶'} Array[{value.length}]
        </button>
        
        {expanded && (
          <div className={css['array-items']}>
            {value.map((item, index) => (
              <div key={index} className={css['array-item']}>
                <span className={css['array-index']}>[{index}]</span>
                <ExpandableData value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <span className={css['empty-object']}>{'{}'}</span>;
    }
    
    return (
      <div className={css['object-value']}>
        <button onClick={() => setExpanded(!expanded)} className={css['expand-toggle']}>
          {expanded ? '▼' : '▶'} Object{'{'}...{'}'}
        </button>
        
        {expanded && (
          <div className={css['object-entries']}>
            {keys.map(key => (
              <div key={key} className={css['object-entry']}>
                <span className={css['object-key']}>{key}:</span>
                <ExpandableData value={value[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return <span>{String(value)}</span>;
}
```

#### Styling

```scss
// DebugPanel.module.scss

.debug-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-panel);
}

.debug-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.request-list {
  width: 280px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  
  h3 {
    padding: var(--spacing-sm) var(--spacing-md);
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }
}

.request-item {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  
  &:hover {
    background: var(--color-bg-hover);
  }
  
  &.selected {
    background: var(--color-primary-alpha);
  }
  
  &.status-error {
    border-left: 3px solid var(--color-danger);
  }
  
  &.status-active {
    border-left: 3px solid var(--color-primary);
  }
}

.event-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.event-tree {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.event-item {
  margin-bottom: var(--spacing-xs);
  
  .event-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    cursor: pointer;
    
    &:hover {
      background: var(--color-bg-hover);
    }
  }
}

.event-detail {
  margin-left: var(--spacing-lg);
  padding: var(--spacing-sm);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.expand-toggle {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  
  &:hover {
    color: var(--color-text-primary);
  }
}
```

#### Acceptance Criteria

- [ ] Debug panel displays in sidebar
- [ ] Connection status shown
- [ ] Requests listed with summary
- [ ] Events displayed in tree
- [ ] Events expand/collapse
- [ ] Nested data expandable
- [ ] Filter by event type
- [ ] Search across event data
- [ ] Pause/resume works
- [ ] Clear removes all data
- [ ] Responsive layout

---

### UBA-017: Debug Export
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-017-debug-export`  
**Depends On:** UBA-016

#### Description

Implement export functionality for debug sessions, allowing users to save debug data as JSON or CSV for offline analysis or sharing.

#### Export Formats

1. **JSON** - Full event data with all fields
2. **CSV** - Flattened events for spreadsheet analysis

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── DebugExport.ts
└── DebugExportDialog.tsx
```

#### Implementation

```typescript
// DebugExport.ts
export interface ExportOptions {
  format: 'json' | 'csv';
  scope: 'all' | 'request' | 'filtered';
  requestId?: string;
  filter?: FilterOptions;
  includeTimestamps: boolean;
  prettyPrint?: boolean;
}

export function exportDebugData(
  store: DebugStore,
  options: ExportOptions
): string {
  // Get events based on scope
  let events: ParsedDebugEvent[];
  
  switch (options.scope) {
    case 'request':
      const request = store.getRequest(options.requestId!);
      events = request?.events || [];
      break;
    case 'filtered':
      events = store.filter(options.filter || {});
      break;
    default:
      events = store.getAllEvents();
  }
  
  // Export based on format
  if (options.format === 'json') {
    return exportAsJson(events, options);
  } else {
    return exportAsCsv(events, options);
  }
}

function exportAsJson(events: ParsedDebugEvent[], options: ExportOptions): string {
  const data = events.map(event => ({
    id: event.id,
    timestamp: options.includeTimestamps ? event.timestamp : undefined,
    request_id: event.request_id,
    type: event.type,
    data: event.data
  }));
  
  return JSON.stringify(data, null, options.prettyPrint ? 2 : 0);
}

function exportAsCsv(events: ParsedDebugEvent[], options: ExportOptions): string {
  // Flatten event data for CSV
  const rows: string[][] = [];
  
  // Header
  const baseHeaders = ['id', 'request_id', 'type'];
  if (options.includeTimestamps) {
    baseHeaders.splice(1, 0, 'timestamp');
  }
  
  // Collect all unique data keys
  const dataKeys = new Set<string>();
  events.forEach(event => {
    Object.keys(flattenObject(event.data)).forEach(key => dataKeys.add(key));
  });
  
  const headers = [...baseHeaders, ...Array.from(dataKeys)];
  rows.push(headers);
  
  // Data rows
  events.forEach(event => {
    const flattened = flattenObject(event.data);
    const row = headers.map(header => {
      if (header === 'id') return event.id;
      if (header === 'timestamp') return event.timestamp;
      if (header === 'request_id') return event.request_id;
      if (header === 'type') return event.type;
      return flattened[header] ?? '';
    });
    rows.push(row.map(escapeCsvValue));
  });
  
  return rows.map(row => row.join(',')).join('\n');
}

function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      result[fullKey] = '';
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = String(value);
    }
  }
  
  return result;
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadExport(content: string, filename: string, format: 'json' | 'csv'): void {
  const mimeType = format === 'json' ? 'application/json' : 'text/csv';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// DebugExportDialog.tsx
export function DebugExportDialog({ 
  store, 
  selectedRequest,
  filter,
  onClose 
}: DebugExportDialogProps) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [scope, setScope] = useState<'all' | 'request' | 'filtered'>(
    selectedRequest ? 'request' : 'all'
  );
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [prettyPrint, setPrettyPrint] = useState(true);
  
  const handleExport = () => {
    const content = exportDebugData(store, {
      format,
      scope,
      requestId: selectedRequest,
      filter,
      includeTimestamps,
      prettyPrint
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug-export-${timestamp}.${format}`;
    
    downloadExport(content, filename, format);
    onClose();
  };
  
  // Preview
  const preview = useMemo(() => {
    const content = exportDebugData(store, {
      format,
      scope,
      requestId: selectedRequest,
      filter,
      includeTimestamps,
      prettyPrint
    });
    
    // Show first 1000 chars
    return content.length > 1000 
      ? content.slice(0, 1000) + '\n...'
      : content;
  }, [store, format, scope, selectedRequest, filter, includeTimestamps, prettyPrint]);
  
  return (
    <Dialog title="Export Debug Data" onClose={onClose}>
      <div className={css['export-form']}>
        <div className={css['form-group']}>
          <label>Format</label>
          <div className={css['radio-group']}>
            <label>
              <input
                type="radio"
                value="json"
                checked={format === 'json'}
                onChange={() => setFormat('json')}
              />
              JSON
            </label>
            <label>
              <input
                type="radio"
                value="csv"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
              />
              CSV
            </label>
          </div>
        </div>
        
        <div className={css['form-group']}>
          <label>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="all">All Events</option>
            {selectedRequest && (
              <option value="request">Selected Request Only</option>
            )}
            {filter && Object.keys(filter).length > 0 && (
              <option value="filtered">Filtered Events</option>
            )}
          </select>
        </div>
        
        <div className={css['form-group']}>
          <label>
            <input
              type="checkbox"
              checked={includeTimestamps}
              onChange={(e) => setIncludeTimestamps(e.target.checked)}
            />
            Include Timestamps
          </label>
        </div>
        
        {format === 'json' && (
          <div className={css['form-group']}>
            <label>
              <input
                type="checkbox"
                checked={prettyPrint}
                onChange={(e) => setPrettyPrint(e.target.checked)}
              />
              Pretty Print
            </label>
          </div>
        )}
        
        <div className={css['preview']}>
          <label>Preview</label>
          <pre>{preview}</pre>
        </div>
      </div>
      
      <div className={css['dialog-actions']}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleExport}>
          <IconDownload /> Export
        </Button>
      </div>
    </Dialog>
  );
}
```

#### Additional Features

```typescript
// Copy event to clipboard
export function copyEventToClipboard(event: ParsedDebugEvent): void {
  const json = JSON.stringify(event, null, 2);
  navigator.clipboard.writeText(json);
}

// Add to DebugEventTree
<button
  className={css['copy-button']}
  onClick={(e) => {
    e.stopPropagation();
    copyEventToClipboard(event);
  }}
  title="Copy event JSON"
>
  <IconCopy />
</button>
```

#### Acceptance Criteria

- [ ] Export as JSON works
- [ ] Export as CSV works
- [ ] Scope selection (all/request/filtered)
- [ ] Timestamps optional
- [ ] Pretty print option for JSON
- [ ] Preview shows sample output
- [ ] Download triggers correctly
- [ ] Copy single event works
- [ ] Filename includes timestamp

---

## Phase 6C Checklist

### UBA-014: Debug Connection
- [ ] WebSocketConnection class
- [ ] SSEConnection class
- [ ] DebugConnection wrapper
- [ ] Auto-reconnect logic
- [ ] Auth handling
- [ ] Connection state tracking
- [ ] Unit tests

### UBA-015: Debug Event Store
- [ ] DebugStore class
- [ ] Ring buffer implementation
- [ ] Request grouping
- [ ] Filter method
- [ ] Search method
- [ ] Summary calculation
- [ ] Subscriber pattern
- [ ] Unit tests

### UBA-016: Debug Panel UI
- [ ] DebugPanel component
- [ ] DebugHeader component
- [ ] DebugRequestList component
- [ ] DebugEventTree component
- [ ] DebugEventDetail component
- [ ] DebugFilterBar component
- [ ] ExpandableData component
- [ ] Styling complete
- [ ] Storybook stories

### UBA-017: Debug Export
- [ ] JSON export
- [ ] CSV export
- [ ] Export dialog
- [ ] Copy event feature
- [ ] Download functionality

### Integration
- [ ] Debug panel in sidebar
- [ ] Works with mock backend
- [ ] Performance with many events
- [ ] Memory usage acceptable

---

## Success Criteria

### Functional
- [ ] Connects to backend debug stream
- [ ] Events displayed in real-time
- [ ] Expand/collapse works smoothly
- [ ] Search finds relevant events
- [ ] Export produces valid files

### Performance
- [ ] Handles 1000+ events without lag
- [ ] Memory usage bounded (ring buffer)
- [ ] Connection reconnects reliably

### Quality
- [ ] Test coverage > 80%
- [ ] Accessible (keyboard, screen readers)
- [ ] Works in light/dark themes

---

## Dependencies

### External Packages

None required (uses native WebSocket and EventSource)

### Internal Dependencies

- Backend Services panel (for sidebar integration)
- Core UI components (Dialog, Button, etc.)

---

## Notes

- Consider virtualized list for very long event lists
- May need to throttle UI updates for high-frequency events
- Test with real Erleah backend when available
