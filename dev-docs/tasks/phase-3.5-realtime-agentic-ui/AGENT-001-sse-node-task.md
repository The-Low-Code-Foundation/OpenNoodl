# AGENT-001: Server-Sent Events (SSE) Node

## Overview

Create a new runtime node that establishes and manages Server-Sent Events (SSE) connections, enabling real-time streaming data from servers to Noodl applications. This is critical for agentic UI patterns where AI backends stream responses incrementally.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** CRITICAL (blocks Erleah development)  
**Effort:** 3-5 days  
**Risk:** Medium

---

## Problem Statement

### Current Limitation

The existing HTTP Request node only supports request-response patterns:

```
User Action → HTTP Request → Wait → Response → UI Update
```

This doesn't work for streaming use cases:

```
User Action → SSE Connect → Stream messages → Progressive UI Updates
              ↓
              Message 1 →  UI Update
              Message 2 →  UI Update  
              Message 3 →  UI Update
              ...
```

### Real-World Use Cases

1. **AI Chat Responses** - Stream tokens as they generate (Erleah)
2. **Live Notifications** - Server pushes updates without polling
3. **Real-Time Dashboards** - Continuous metric updates
4. **Progress Updates** - Long-running backend operations
5. **Event Feeds** - News, social media, activity streams

---

## Goals

1. ✅ Establish and maintain SSE connections
2. ✅ Parse incoming messages (text and JSON)
3. ✅ Handle connection lifecycle (open, error, close)
4. ✅ Auto-reconnect on connection loss
5. ✅ Clean disconnection on node deletion
6. ✅ Support custom event types (via addEventListener)

---

## Technical Design

### Node Specification

```javascript
{
  name: 'net.noodl.SSE',
  displayNodeName: 'Server-Sent Events',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/sse',
  searchTags: ['sse', 'stream', 'server-sent', 'events', 'realtime', 'websocket']
}
```

### Port Schema

#### Inputs

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| `url` | string | Connection | SSE endpoint URL |
| `connect` | signal | Actions | Establish connection |
| `disconnect` | signal | Actions | Close connection |
| `autoReconnect` | boolean | Connection | Auto-reconnect on disconnect (default: true) |
| `reconnectDelay` | number | Connection | Delay before reconnect (ms, default: 3000) |
| `withCredentials` | boolean | Connection | Include credentials (default: false) |
| `customHeaders` | object | Connection | Custom headers (EventSource doesn't support, document limitation) |

#### Outputs

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| `message` | object | Data | Raw message event object |
| `data` | * | Data | Parsed message data (JSON or text) |
| `eventType` | string | Data | Event type (if custom events used) |
| `connected` | signal | Events | Fired when connection opens |
| `disconnected` | signal | Events | Fired when connection closes |
| `error` | string | Events | Error message |
| `isConnected` | boolean | Status | Current connection state |
| `lastMessageTime` | number | Status | Timestamp of last message (ms) |

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
          └─────────────┘   │
                │ │         │
          [onmessage]       │
                │ │         │
          [onerror/close]   │
                │           │
                └───────────┘
                [autoReconnect
                 after delay]
```

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── ssenode.js            # Main node implementation
└── ssenode.test.js       # Unit tests
```

### Core Implementation

```javascript
var SSENode = {
  name: 'net.noodl.SSE',
  displayNodeName: 'Server-Sent Events',
  category: 'Data',
  color: 'data',
  
  initialize: function() {
    this._internal.eventSource = null;
    this._internal.isConnected = false;
    this._internal.messageBuffer = [];
    this._internal.reconnectTimer = null;
    this._internal.customEventListeners = new Map();
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
      default: 3000,
      set: function(value) {
        this._internal.reconnectDelay = value;
      }
    },
    
    withCredentials: {
      type: 'boolean',
      displayName: 'With Credentials',
      group: 'Connection',
      default: false,
      set: function(value) {
        this._internal.withCredentials = value;
      }
    },
    
    // For custom event types (beyond 'message')
    eventType: {
      type: 'string',
      displayName: 'Listen for Event Type',
      group: 'Connection',
      set: function(value) {
        this._internal.customEventType = value;
        if (this._internal.eventSource && value) {
          this.addCustomEventListener(value);
        }
      }
    }
  },
  
  outputs: {
    message: {
      type: 'object',
      displayName: 'Message',
      group: 'Data',
      getter: function() {
        return this._internal.lastMessage;
      }
    },
    
    data: {
      type: '*',
      displayName: 'Data',
      group: 'Data',
      getter: function() {
        return this._internal.lastData;
      }
    },
    
    eventType: {
      type: 'string',
      displayName: 'Event Type',
      group: 'Data',
      getter: function() {
        return this._internal.lastEventType;
      }
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
    
    messageReceived: {
      type: 'signal',
      displayName: 'Message Received',
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
    
    lastMessageTime: {
      type: 'number',
      displayName: 'Last Message Time',
      group: 'Status',
      getter: function() {
        return this._internal.lastMessageTime;
      }
    }
  },
  
  methods: {
    doConnect: function() {
      // Disconnect existing connection if any
      if (this._internal.eventSource) {
        this.doDisconnect();
      }
      
      const url = this._internal.url;
      if (!url) {
        this.setError('URL is required');
        return;
      }
      
      try {
        // Create EventSource with options
        const options = {
          withCredentials: this._internal.withCredentials || false
        };
        
        const eventSource = new EventSource(url, options);
        this._internal.eventSource = eventSource;
        
        // Connection opened
        eventSource.onopen = () => {
          this._internal.isConnected = true;
          this._internal.lastError = null;
          this.flagOutputDirty('isConnected');
          this.flagOutputDirty('error');
          this.sendSignalOnOutput('connected');
          
          console.log('[SSE Node] Connected to', url);
        };
        
        // Message received (default event type)
        eventSource.onmessage = (event) => {
          this.handleMessage(event, 'message');
        };
        
        // Connection error/closed
        eventSource.onerror = (error) => {
          console.error('[SSE Node] Connection error:', error);
          
          const wasConnected = this._internal.isConnected;
          this._internal.isConnected = false;
          this.flagOutputDirty('isConnected');
          
          if (wasConnected) {
            this.sendSignalOnOutput('disconnected');
          }
          
          // Check if connection is permanently closed
          if (eventSource.readyState === EventSource.CLOSED) {
            this.setError('Connection closed');
            
            // Auto-reconnect if enabled
            if (this._internal.autoReconnect) {
              const delay = this._internal.reconnectDelay || 3000;
              console.log(`[SSE Node] Reconnecting in ${delay}ms...`);
              
              this._internal.reconnectTimer = setTimeout(() => {
                this.doConnect();
              }, delay);
            }
          }
        };
        
        // Add custom event listener if specified
        if (this._internal.customEventType) {
          this.addCustomEventListener(this._internal.customEventType);
        }
        
      } catch (e) {
        this.setError(e.message);
        console.error('[SSE Node] Failed to connect:', e);
      }
    },
    
    doDisconnect: function() {
      // Clear reconnect timer
      if (this._internal.reconnectTimer) {
        clearTimeout(this._internal.reconnectTimer);
        this._internal.reconnectTimer = null;
      }
      
      // Close connection
      if (this._internal.eventSource) {
        this._internal.eventSource.close();
        this._internal.eventSource = null;
        this._internal.isConnected = false;
        this.flagOutputDirty('isConnected');
        this.sendSignalOnOutput('disconnected');
        
        console.log('[SSE Node] Disconnected');
      }
    },
    
    addCustomEventListener: function(eventType) {
      if (!this._internal.eventSource || !eventType) return;
      
      // Remove old listener if exists
      const oldListener = this._internal.customEventListeners.get(eventType);
      if (oldListener) {
        this._internal.eventSource.removeEventListener(eventType, oldListener);
      }
      
      // Add new listener
      const listener = (event) => {
        this.handleMessage(event, eventType);
      };
      
      this._internal.eventSource.addEventListener(eventType, listener);
      this._internal.customEventListeners.set(eventType, listener);
    },
    
    handleMessage: function(event, type) {
      this._internal.lastMessageTime = Date.now();
      this._internal.lastEventType = type || 'message';
      this._internal.lastMessage = {
        data: event.data,
        lastEventId: event.lastEventId,
        type: type || 'message'
      };
      
      // Try to parse as JSON
      try {
        this._internal.lastData = JSON.parse(event.data);
      } catch (e) {
        // Not JSON, use raw string
        this._internal.lastData = event.data;
      }
      
      this.flagOutputDirty('message');
      this.flagOutputDirty('data');
      this.flagOutputDirty('eventType');
      this.flagOutputDirty('lastMessageTime');
      this.sendSignalOnOutput('messageReceived');
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
          lastMessage: this._internal.lastData,
          messageCount: this._internal.messageCount || 0
        }
      };
    }
    return {
      type: 'text',
      value: this._internal.isConnected ? 'Connected' : 'Disconnected'
    };
  }
};

module.exports = {
  node: SSENode
};
```

---

## Usage Examples

### Example 1: AI Chat Streaming

```
[Text Input: "Hello AI"] 
    → [Send] signal
    → [HTTP Request] POST /chat/start → returns chatId
    → [String Format] "/chat/{chatId}/stream"
    → [SSE Node] url
    → [SSE Node] connect
    
[SSE Node] data 
    → [Array] accumulate messages
    → [Repeater] render messages
    
[SSE Node] messageReceived
    → [Scroll To Bottom] in chat container
```

### Example 2: Live Notifications

```
[Component Mounted] signal
    → [SSE Node] connect to "/notifications/stream"
    
[SSE Node] data
    → [Show Toast] notification

[SSE Node] connected
    → [Variable] isLive = true → [Visual indicator]

[SSE Node] disconnected  
    → [Variable] isLive = false → [Show offline banner]
```

### Example 3: Progress Tracker

```
[Start Upload] signal
    → [HTTP Request] POST /upload → returns uploadId
    → [SSE Node] connect to "/upload/{uploadId}/progress"
    
[SSE Node] data → { percent: number }
    → [Progress Bar] value
    
[SSE Node] data → { status: "complete" }
    → [SSE Node] disconnect
    → [Navigate] to success page
```

---

## Testing Checklist

### Functional Tests

- [ ] Connection establishes to valid SSE endpoint
- [ ] Connection fails gracefully with invalid URL
- [ ] Messages are received and parsed correctly
- [ ] JSON messages parse to objects
- [ ] Plain text messages output as strings
- [ ] `connected` signal fires on open
- [ ] `disconnected` signal fires on close
- [ ] `messageReceived` signal fires for each message
- [ ] `isConnected` reflects current state
- [ ] Auto-reconnect works after disconnect
- [ ] Reconnect delay is respected
- [ ] Manual disconnect stops auto-reconnect
- [ ] Custom event types are received
- [ ] withCredentials flag works correctly
- [ ] Node cleanup works (no memory leaks)

### Edge Cases

- [ ] Handles rapid connect/disconnect cycles
- [ ] Handles very large messages (>1MB)
- [ ] Handles malformed JSON gracefully
- [ ] Handles server sending error events
- [ ] Handles network going offline/online
- [ ] Handles multiple SSE nodes simultaneously
- [ ] Connection closes cleanly on component unmount
- [ ] Reconnect timer clears on manual disconnect

### Performance

- [ ] Memory usage stable over 1000+ messages
- [ ] No visible UI lag during streaming
- [ ] Message parsing doesn't block main thread
- [ ] Multiple connections don't interfere

---

## Browser Compatibility

EventSource (SSE) is supported in:

| Browser | Support |
|---------|---------|
| Chrome | ✅ Yes |
| Firefox | ✅ Yes |
| Safari | ✅ Yes |
| Edge | ✅ Yes |
| IE 11 | ❌ No (polyfill available) |

For IE 11 support, can use: [event-source-polyfill](https://www.npmjs.com/package/event-source-polyfill)

---

## Limitations & Workarounds

### Limitation 1: No Custom Headers
EventSource API doesn't support custom headers (like Authorization).

**Workaround:**
- Send auth token as query parameter: `/stream?token=abc123`
- Use cookie-based authentication (withCredentials: true)
- Or use WebSocket instead (AGENT-002)

### Limitation 2: No Request Body
SSE is GET-only, can't send request body.

**Workaround:**
- Create session/channel via POST first
- Connect SSE to session-specific URL: `/stream/{sessionId}`

### Limitation 3: One-Way Communication
Server → Client only. Client can't send messages over same connection.

**Workaround:**
- Use separate HTTP requests for client → server
- Or use WebSocket for bidirectional (AGENT-002)

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/data/sse.md`

```markdown
# Server-Sent Events

Stream real-time data from your server to your Noodl app using Server-Sent Events (SSE). Perfect for live notifications, AI chat responses, progress updates, and real-time dashboards.

## When to Use

- **AI Chat**: Stream tokens as they generate
- **Notifications**: Push updates without polling  
- **Dashboards**: Continuous metric updates
- **Progress**: Long-running operation status

## Basic Usage

1. Add SSE node to your component
2. Set the `URL` to your SSE endpoint
3. Send the `Connect` signal
4. Use the `data` output to access messages
5. Listen to `messageReceived` to trigger actions

## Example: Live Chat

[Screenshot showing SSE node connected to chat UI]

## Authentication

Since EventSource doesn't support custom headers, use query parameters:

```
URL: https://api.example.com/stream?token={authToken}
```

Or enable `With Credentials` for cookie-based auth.

## Auto-Reconnect

By default, SSE nodes auto-reconnect if connection drops. Configure:
- `Auto Reconnect`: Enable/disable
- `Reconnect Delay`: Wait time in milliseconds

## Custom Events

Servers can send named events. Use the `Event Type` input to listen for specific events.

```javascript
// Server sends:
event: notification
data: {"message": "New user signed up"}

// Noodl receives on 'notification' event type
```
```

### Technical Docs

Add to: `dev-docs/reference/NODE-PATTERNS.md`

Section on streaming nodes.

---

## Success Criteria

1. ✅ SSE node successfully streams data in test app
2. ✅ Auto-reconnect works reliably
3. ✅ No memory leaks over extended usage
4. ✅ Clear documentation with examples
5. ✅ Works in Erleah prototype for AI chat streaming

---

## Future Enhancements

Post-MVP features to consider:

1. **Message Buffering** - Store last N messages for replays
2. **Rate Limiting** - Throttle message processing
3. **Event Filtering** - Filter messages by criteria before output
4. **Last Event ID** - Resume from last message on reconnect
5. **Connection Pooling** - Share connection across components

---

## References

- [MDN: EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [HTML Living Standard: SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [SSE vs WebSocket](https://ably.com/topic/server-sent-events-vs-websockets)

---

## Dependencies

- None (uses native EventSource API)

## Blocked By

- None

## Blocks

- AGENT-007 (Stream Parser Utilities) - needs SSE for testing
- Erleah development - requires streaming AI responses

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| Core Implementation | 1 day | Basic SSE node with connect/disconnect/message |
| Error Handling | 0.5 day | Graceful failures, reconnect logic |
| Testing | 1 day | Unit tests, integration tests, edge cases |
| Documentation | 0.5 day | User docs, technical docs, examples |
| Edge Cases & Polish | 0.5-1 day | Performance, memory, browser compat |

**Total: 3.5-4 days**

Buffer: +1 day for unexpected issues = **4-5 days total**
