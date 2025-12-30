# AGENT-002: WebSocket Node

## Overview

Create a new runtime node that establishes and manages WebSocket connections, enabling bidirectional real-time communication between Noodl applications and servers. This complements SSE (AGENT-001) by supporting two-way messaging patterns.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** HIGH  
**Effort:** 3-5 days  
**Risk:** Medium

---

## Problem Statement

### Current Limitation

The existing HTTP Request node and SSE node (AGENT-001) only support one-way communication:

```
HTTP:  Client → Server → Response (one-shot)
SSE:   Server → Client (one-way stream)
```

WebSocket enables true bidirectional communication:

```
WebSocket: Client ⇄ Server (continuous two-way)
```

### Real-World Use Cases

1. **Collaborative Editing** - Multiple users editing same document
2. **Gaming** - Real-time multiplayer interactions
3. **Chat Applications** - Send and receive messages
4. **Live Cursors** - Show where other users are pointing
5. **Device Control** - Send commands, receive telemetry
6. **Trading Platforms** - Real-time price updates + order placement

---

## Goals

1. ✅ Establish and maintain WebSocket connections
2. ✅ Send messages (text and binary)
3. ✅ Receive messages (text and binary)
4. ✅ Handle connection lifecycle (open, error, close)
5. ✅ Auto-reconnect with exponential backoff
6. ✅ Ping/pong heartbeat for connection health
7. ✅ Queue messages when disconnected

---

## Technical Design

### Node Specification

```javascript
{
  name: 'net.noodl.WebSocket',
  displayNodeName: 'WebSocket',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/websocket',
  searchTags: ['websocket', 'ws', 'realtime', 'bidirectional', 'socket']
}
```

### Port Schema

#### Inputs

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| `url` | string | Connection | WebSocket URL (ws:// or wss://) |
| `connect` | signal | Actions | Establish connection |
| `disconnect` | signal | Actions | Close connection |
| `send` | signal | Actions | Send message |
| `message` | * | Message | Data to send (JSON serialized if object) |
| `messageType` | enum | Message | 'text' or 'binary' (default: text) |
| `autoReconnect` | boolean | Connection | Auto-reconnect on disconnect (default: true) |
| `reconnectDelay` | number | Connection | Initial delay (ms, default: 1000) |
| `maxReconnectDelay` | number | Connection | Max delay with backoff (ms, default: 30000) |
| `protocols` | string | Connection | Comma-separated subprotocols |
| `queueWhenDisconnected` | boolean | Message | Queue messages while offline (default: true) |
| `heartbeatInterval` | number | Connection | Ping interval (ms, 0=disabled, default: 30000) |

#### Outputs

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| `received` | * | Data | Received message data |
| `receivedRaw` | string | Data | Raw message string |
| `messageReceived` | signal | Events | Fired when message arrives |
| `messageSent` | signal | Events | Fired after send succeeds |
| `connected` | signal | Events | Fired when connection opens |
| `disconnected` | signal | Events | Fired when connection closes |
| `error` | string | Events | Error message |
| `isConnected` | boolean | Status | Current connection state |
| `queueSize` | number | Status | Messages waiting to send |
| `latency` | number | Status | Round-trip time (ms) |

### State Machine

```
          ┌─────────────┐
   START  │             │
   ────┬─→│ DISCONNECTED│←──┐
       │  │             │   │
       │  └─────────────┘   │
       │         │          │
       │    [connect]       │
       │         │          │
       │         ▼          │
       │  ┌─────────────┐   │
       │  │ CONNECTING  │   │
       │  └─────────────┘   │
       │         │          │
       │    [onopen]        │
       │         │          │
       │         ▼          │
       │  ┌─────────────┐   │
       └──│  CONNECTED  │   │
          │             │   │
          │  [send/recv]│   │
          │             │   │
          └─────────────┘   │
                │ │         │
          [onclose/error]   │
                │           │
                └───────────┘
             [autoReconnect
              with backoff]
```

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── websocketnode.js         # Main node implementation
└── websocketnode.test.js    # Unit tests
```

### Core Implementation

```javascript
var WebSocketNode = {
  name: 'net.noodl.WebSocket',
  displayNodeName: 'WebSocket',
  category: 'Data',
  color: 'data',
  
  initialize: function() {
    this._internal.socket = null;
    this._internal.isConnected = false;
    this._internal.messageQueue = [];
    this._internal.reconnectAttempts = 0;
    this._internal.reconnectTimer = null;
    this._internal.heartbeatTimer = null;
    this._internal.lastPingTime = 0;
  },
  
  inputs: {
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'Connection',
      set: function(value) {
        this._internal.url = value;
      }
    },
    
    connect: {
      type: 'signal',
      displayName: 'Connect',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doConnect();
      }
    },
    
    disconnect: {
      type: 'signal',
      displayName: 'Disconnect',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doDisconnect();
      }
    },
    
    send: {
      type: 'signal',
      displayName: 'Send',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doSend();
      }
    },
    
    message: {
      type: '*',
      displayName: 'Message',
      group: 'Message',
      set: function(value) {
        this._internal.messageToSend = value;
      }
    },
    
    messageType: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Text', value: 'text' },
          { label: 'Binary', value: 'binary' }
        ]
      },
      displayName: 'Message Type',
      group: 'Message',
      default: 'text',
      set: function(value) {
        this._internal.messageType = value;
      }
    },
    
    autoReconnect: {
      type: 'boolean',
      displayName: 'Auto Reconnect',
      group: 'Connection',
      default: true,
      set: function(value) {
        this._internal.autoReconnect = value;
      }
    },
    
    reconnectDelay: {
      type: 'number',
      displayName: 'Reconnect Delay (ms)',
      group: 'Connection',
      default: 1000,
      set: function(value) {
        this._internal.reconnectDelay = value;
      }
    },
    
    maxReconnectDelay: {
      type: 'number',
      displayName: 'Max Reconnect Delay (ms)',
      group: 'Connection',
      default: 30000,
      set: function(value) {
        this._internal.maxReconnectDelay = value;
      }
    },
    
    protocols: {
      type: 'string',
      displayName: 'Protocols',
      group: 'Connection',
      set: function(value) {
        this._internal.protocols = value;
      }
    },
    
    queueWhenDisconnected: {
      type: 'boolean',
      displayName: 'Queue When Disconnected',
      group: 'Message',
      default: true,
      set: function(value) {
        this._internal.queueWhenDisconnected = value;
      }
    },
    
    heartbeatInterval: {
      type: 'number',
      displayName: 'Heartbeat Interval (ms)',
      group: 'Connection',
      default: 30000,
      set: function(value) {
        this._internal.heartbeatInterval = value;
        if (this._internal.isConnected) {
          this.startHeartbeat();
        }
      }
    }
  },
  
  outputs: {
    received: {
      type: '*',
      displayName: 'Received',
      group: 'Data',
      getter: function() {
        return this._internal.lastReceived;
      }
    },
    
    receivedRaw: {
      type: 'string',
      displayName: 'Received Raw',
      group: 'Data',
      getter: function() {
        return this._internal.lastReceivedRaw;
      }
    },
    
    messageReceived: {
      type: 'signal',
      displayName: 'Message Received',
      group: 'Events'
    },
    
    messageSent: {
      type: 'signal',
      displayName: 'Message Sent',
      group: 'Events'
    },
    
    connected: {
      type: 'signal',
      displayName: 'Connected',
      group: 'Events'
    },
    
    disconnected: {
      type: 'signal',
      displayName: 'Disconnected',
      group: 'Events'
    },
    
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function() {
        return this._internal.lastError;
      }
    },
    
    isConnected: {
      type: 'boolean',
      displayName: 'Is Connected',
      group: 'Status',
      getter: function() {
        return this._internal.isConnected;
      }
    },
    
    queueSize: {
      type: 'number',
      displayName: 'Queue Size',
      group: 'Status',
      getter: function() {
        return this._internal.messageQueue.length;
      }
    },
    
    latency: {
      type: 'number',
      displayName: 'Latency (ms)',
      group: 'Status',
      getter: function() {
        return this._internal.latency || 0;
      }
    }
  },
  
  methods: {
    doConnect: function() {
      // Disconnect existing
      if (this._internal.socket) {
        this.doDisconnect();
      }
      
      const url = this._internal.url;
      if (!url) {
        this.setError('URL is required');
        return;
      }
      
      if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        this.setError('URL must start with ws:// or wss://');
        return;
      }
      
      try {
        // Parse protocols
        const protocols = this._internal.protocols
          ? this._internal.protocols.split(',').map(p => p.trim())
          : undefined;
        
        const socket = new WebSocket(url, protocols);
        this._internal.socket = socket;
        
        // Connection opened
        socket.onopen = () => {
          this._internal.isConnected = true;
          this._internal.reconnectAttempts = 0;
          this._internal.lastError = null;
          
          this.flagOutputDirty('isConnected');
          this.flagOutputDirty('error');
          this.sendSignalOnOutput('connected');
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Flush queued messages
          this.flushMessageQueue();
          
          console.log('[WebSocket] Connected to', url);
        };
        
        // Message received
        socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        // Connection closed
        socket.onclose = (event) => {
          console.log('[WebSocket] Closed:', event.code, event.reason);
          
          this._internal.isConnected = false;
          this.flagOutputDirty('isConnected');
          this.sendSignalOnOutput('disconnected');
          
          this.stopHeartbeat();
          
          // Auto-reconnect
          if (this._internal.autoReconnect && !event.wasClean) {
            this.scheduleReconnect();
          }
        };
        
        // Connection error
        socket.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.setError('Connection error');
        };
        
      } catch (e) {
        this.setError(e.message);
        console.error('[WebSocket] Failed to connect:', e);
      }
    },
    
    doDisconnect: function() {
      // Clear timers
      if (this._internal.reconnectTimer) {
        clearTimeout(this._internal.reconnectTimer);
        this._internal.reconnectTimer = null;
      }
      this.stopHeartbeat();
      
      // Close socket
      if (this._internal.socket) {
        this._internal.socket.close(1000, 'Client disconnect');
        this._internal.socket = null;
        this._internal.isConnected = false;
        this.flagOutputDirty('isConnected');
        
        console.log('[WebSocket] Disconnected');
      }
    },
    
    doSend: function() {
      const message = this._internal.messageToSend;
      if (message === undefined || message === null) {
        return;
      }
      
      // If not connected, queue or drop
      if (!this._internal.isConnected) {
        if (this._internal.queueWhenDisconnected) {
          this._internal.messageQueue.push(message);
          this.flagOutputDirty('queueSize');
          console.log('[WebSocket] Message queued (disconnected)');
        } else {
          this.setError('Cannot send: not connected');
        }
        return;
      }
      
      try {
        const socket = this._internal.socket;
        const messageType = this._internal.messageType || 'text';
        
        // Serialize based on type
        let data;
        if (messageType === 'binary') {
          // Convert to ArrayBuffer or Blob
          if (typeof message === 'string') {
            data = new TextEncoder().encode(message);
          } else {
            data = message;
          }
        } else {
          // Text mode - serialize objects as JSON
          if (typeof message === 'object') {
            data = JSON.stringify(message);
          } else {
            data = String(message);
          }
        }
        
        socket.send(data);
        this.sendSignalOnOutput('messageSent');
        
      } catch (e) {
        this.setError('Send failed: ' + e.message);
      }
    },
    
    handleMessage: function(data) {
      this._internal.lastReceivedRaw = data;
      
      // Try to parse as JSON
      try {
        this._internal.lastReceived = JSON.parse(data);
      } catch (e) {
        // Not JSON, use raw
        this._internal.lastReceived = data;
      }
      
      // Check if it's a pong response
      if (data === 'pong' && this._internal.lastPingTime) {
        this._internal.latency = Date.now() - this._internal.lastPingTime;
        this.flagOutputDirty('latency');
        return; // Don't emit messageReceived for pong
      }
      
      this.flagOutputDirty('received');
      this.flagOutputDirty('receivedRaw');
      this.sendSignalOnOutput('messageReceived');
    },
    
    flushMessageQueue: function() {
      const queue = this._internal.messageQueue;
      if (queue.length === 0) return;
      
      console.log(`[WebSocket] Flushing ${queue.length} queued messages`);
      
      while (queue.length > 0) {
        this._internal.messageToSend = queue.shift();
        this.doSend();
      }
      
      this.flagOutputDirty('queueSize');
    },
    
    scheduleReconnect: function() {
      const baseDelay = this._internal.reconnectDelay || 1000;
      const maxDelay = this._internal.maxReconnectDelay || 30000;
      const attempts = this._internal.reconnectAttempts;
      
      // Exponential backoff: baseDelay * 2^attempts
      const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
      
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
      
      this._internal.reconnectTimer = setTimeout(() => {
        this._internal.reconnectAttempts++;
        this.doConnect();
      }, delay);
    },
    
    startHeartbeat: function() {
      this.stopHeartbeat();
      
      const interval = this._internal.heartbeatInterval;
      if (!interval || interval <= 0) return;
      
      this._internal.heartbeatTimer = setInterval(() => {
        if (this._internal.isConnected) {
          this._internal.lastPingTime = Date.now();
          try {
            this._internal.socket.send('ping');
          } catch (e) {
            console.error('[WebSocket] Heartbeat failed:', e);
          }
        }
      }, interval);
    },
    
    stopHeartbeat: function() {
      if (this._internal.heartbeatTimer) {
        clearInterval(this._internal.heartbeatTimer);
        this._internal.heartbeatTimer = null;
      }
    },
    
    setError: function(message) {
      this._internal.lastError = message;
      this.flagOutputDirty('error');
    },
    
    _onNodeDeleted: function() {
      this.doDisconnect();
    }
  },
  
  getInspectInfo: function() {
    if (this._internal.isConnected) {
      return {
        type: 'value',
        value: {
          status: 'Connected',
          url: this._internal.url,
          latency: this._internal.latency + 'ms',
          queueSize: this._internal.messageQueue.length
        }
      };
    }
    return {
      type: 'text',
      value: 'Disconnected'
    };
  }
};

module.exports = {
  node: WebSocketNode
};
```

---

## Usage Examples

### Example 1: Chat Application

```
[Text Input: message]
    → [WebSocket] message
    
[Send Button] clicked
    → [WebSocket] send signal

[WebSocket] connected
    → [Variable] isOnline = true

[WebSocket] received
    → [Array] add to messages
    → [Repeater] render chat
    
[WebSocket] disconnected
    → [Show Toast] "Connection lost, reconnecting..."
```

### Example 2: Collaborative Cursors

```
[Mouse Move Event]
    → [Debounce] 100ms
    → [Object] { x, y, userId }
    → [WebSocket] message
    → [WebSocket] send

[WebSocket] received → { x, y, userId }
    → [Array Filter] exclude own cursor
    → [Repeater] render other cursors
```

### Example 3: Real-Time Game

```
// Send player action
[Keyboard Event: space]
    → [Object] { action: "jump", timestamp: Date.now() }
    → [WebSocket] message
    → [WebSocket] send

// Receive game state
[WebSocket] received → { players: [], score: 100 }
    → [For Each] in players
    → [Sprite] update positions
```

### Example 4: IoT Device Control

```
// Send command
[Toggle Switch] changed
    → [Object] { device: "light-1", state: value }
    → [WebSocket] send

// Receive telemetry
[WebSocket] received → { temperature: 72, humidity: 45 }
    → [Number] temperature
    → [Gauge] display
```

---

## Testing Checklist

### Functional Tests

- [ ] Connection establishes to valid WebSocket server
- [ ] Connection fails gracefully with invalid URL
- [ ] Can send text messages
- [ ] Can send JSON objects (auto-serialized)
- [ ] Can receive text messages
- [ ] Can receive JSON messages (auto-parsed)
- [ ] `connected` signal fires on open
- [ ] `disconnected` signal fires on close
- [ ] `messageSent` signal fires after send
- [ ] `messageReceived` signal fires on receive
- [ ] `isConnected` reflects current state
- [ ] Auto-reconnect works after disconnect
- [ ] Exponential backoff increases delay
- [ ] Messages queue when disconnected
- [ ] Queued messages flush on reconnect
- [ ] Manual disconnect stops auto-reconnect
- [ ] Heartbeat sends ping messages
- [ ] Latency calculated from ping/pong
- [ ] Subprotocols negotiated correctly
- [ ] Node cleanup works (no memory leaks)

### Edge Cases

- [ ] Handles rapid connect/disconnect cycles
- [ ] Handles very large messages (>1MB)
- [ ] Handles binary data correctly
- [ ] Handles server closing connection unexpectedly
- [ ] Handles network going offline/online
- [ ] Queue doesn't grow unbounded
- [ ] Multiple WebSocket nodes don't interfere
- [ ] Connection closes cleanly on component unmount

### Performance

- [ ] Memory usage stable over 1000+ messages
- [ ] No visible UI lag during high-frequency messages
- [ ] Queue processing doesn't block main thread
- [ ] Heartbeat doesn't impact performance

---

## WebSocket vs SSE Decision Guide

Help users choose between WebSocket (AGENT-002) and SSE (AGENT-001):

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| **Direction** | Server → Client only | Bidirectional |
| **Protocol** | HTTP/1.1, HTTP/2 | WebSocket protocol |
| **Auto-reconnect** | Native browser behavior | Manual implementation |
| **Message format** | Text (typically JSON) | Text or Binary |
| **Firewall friendly** | ✅ Yes (uses HTTP) | ⚠️ Sometimes blocked |
| **Complexity** | Simpler | More complex |
| **Use when** | Server pushes updates | Client needs to send data |

**Rule of thumb:**
- Need to **receive** updates → SSE
- Need to **send and receive** → WebSocket

---

## Browser Compatibility

WebSocket is supported in all modern browsers:

| Browser | Support |
|---------|---------|
| Chrome | ✅ Yes |
| Firefox | ✅ Yes |
| Safari | ✅ Yes |
| Edge | ✅ Yes |
| IE 11 | ⚠️ Partial (no binary frames) |

---

## Security Considerations

### 1. Use WSS (WebSocket Secure)
Always use `wss://` in production, not `ws://`. This encrypts traffic.

### 2. Authentication
WebSocket doesn't support custom headers in browser. Options:
- Send auth token as first message after connect
- Include token in URL query: `wss://example.com/ws?token=abc123`
- Use cookie-based authentication

### 3. Message Validation
Always validate received messages server-side. Don't trust client data.

### 4. Rate Limiting
Implement server-side rate limiting to prevent abuse.

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/data/websocket.md`

```markdown
# WebSocket

Enable real-time bidirectional communication with WebSocket servers. Perfect for chat, collaborative editing, gaming, and live dashboards.

## When to Use

- **Chat**: Send and receive messages
- **Collaboration**: Real-time multi-user editing
- **Gaming**: Multiplayer interactions
- **IoT**: Device control and telemetry
- **Trading**: Price updates + order placement

## WebSocket vs Server-Sent Events

- Use **SSE** when server pushes updates, client doesn't send
- Use **WebSocket** when client needs to send data to server

## Basic Usage

1. Add WebSocket node
2. Set `URL` to your WebSocket endpoint (wss://...)
3. Send `Connect` signal
4. To send: Set `message`, trigger `send` signal
5. To receive: Listen to `messageReceived`, read `received`

## Example: Chat

[Screenshot showing WebSocket in chat application]

## Queuing

When disconnected, messages can queue automatically:
- Enable `Queue When Disconnected`
- Messages send when reconnected

## Heartbeat

Keep connection alive with automatic ping/pong:
- Set `Heartbeat Interval` (milliseconds)
- Monitor `Latency` for connection health

## Security

Always use `wss://` (secure) in production, not `ws://`.

For authentication:
```javascript
// Send auth on connect
[WebSocket] connected
  → [Object] { type: "auth", token: authToken }
  → [WebSocket] message
  → [WebSocket] send
```
```

---

## Success Criteria

1. ✅ WebSocket node successfully connects and exchanges messages
2. ✅ Auto-reconnect works reliably with exponential backoff
3. ✅ Message queuing prevents data loss during disconnects
4. ✅ Heartbeat detects dead connections
5. ✅ No memory leaks over extended usage
6. ✅ Clear documentation with examples
7. ✅ Works in Erleah for real-time backend communication

---

## Future Enhancements

Post-MVP features to consider:

1. **Compression** - Enable permessage-deflate extension
2. **Binary Frames** - Better binary data support
3. **Subprotocol Handling** - React to negotiated protocol
4. **Message Buffering** - Batch sends for performance
5. **Connection Pooling** - Share socket across components
6. **Custom Heartbeat Messages** - Beyond ping/pong

---

## References

- [MDN: WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [WebSocket Protocol RFC 6455](https://tools.ietf.org/html/rfc6455)
- [WebSocket vs SSE](https://ably.com/topic/websockets-vs-sse)

---

## Dependencies

- None (uses native WebSocket API)

## Blocked By

- None

## Blocks

- Erleah development - requires bidirectional communication

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| Core Implementation | 1.5 days | Basic WebSocket with send/receive |
| Auto-reconnect & Queue | 1 day | Exponential backoff, message queuing |
| Heartbeat | 0.5 day | Ping/pong latency tracking |
| Testing | 1 day | Unit tests, integration tests, edge cases |
| Documentation | 0.5 day | User docs, technical docs, examples |
| Polish | 0.5 day | Error handling, performance, cleanup |

**Total: 5 days**

Buffer: None needed (straightforward implementation)

**Final: 3-5 days** (depending on testing depth)
