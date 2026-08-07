# AGENT-007: Stream Parser Utilities

## Overview

Create utility nodes for parsing streaming data, particularly JSON streams, chunked responses, and incremental text accumulation. These utilities help process SSE and WebSocket messages that arrive in fragments.

**Phase:** 3.5 (Real-Time Agentic UI)  
**Priority:** MEDIUM  
**Effort:** 2-3 days  
**Risk:** Low

---

## Problem Statement

### Current Limitation

Streaming data often arrives in fragments:

```
Chunk 1: {"type":"mes
Chunk 2: sage","conte
Chunk 3: nt":"Hello"}
```

Without parsing utilities, developers must manually:
1. Accumulate chunks
2. Detect message boundaries
3. Parse JSON safely
4. Handle malformed data

This is error-prone and repetitive.

### Desired Pattern

```
[SSE] data → raw chunks
  ↓
[Stream Parser] accumulate & parse
  ↓
[Complete JSON Object] → use in app
```

### Real-World Use Cases (Erleah)

1. **AI Chat Streaming** - Accumulate tokens into messages
2. **JSON Streaming** - Parse newline-delimited JSON (NDJSON)
3. **Progress Updates** - Extract percentages from stream
4. **CSV Streaming** - Parse CSV row-by-row
5. **Log Streaming** - Parse structured logs

---

## Goals

1. ✅ Accumulate text chunks into complete messages
2. ✅ Parse NDJSON (newline-delimited JSON)
3. ✅ Parse JSON chunks safely (handle incomplete JSON)
4. ✅ Extract values from streaming text (regex patterns)
5. ✅ Detect message boundaries (delimiters)
6. ✅ Buffer and flush patterns
7. ✅ Handle encoding/decoding

---

## Technical Design

### Node Specifications

We'll create FOUR utility nodes:

1. **Text Accumulator** - Accumulate chunks into complete text
2. **JSON Stream Parser** - Parse NDJSON or chunked JSON
3. **Pattern Extractor** - Extract values using regex
4. **Stream Buffer** - Buffer with custom flush logic

### Text Accumulator Node

```javascript
{
  name: 'net.noodl.TextAccumulator',
  displayNodeName: 'Text Accumulator',
  category: 'Data',
  color: 'green',
  docs: 'https://docs.noodl.net/nodes/data/text-accumulator'
}
```

#### Ports: Text Accumulator

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `chunk` | string | Data | Text chunk to add |
| `add` | signal | Actions | Add chunk to buffer |
| `clear` | signal | Actions | Clear accumulated text |
| `delimiter` | string | Config | Message delimiter (default: "\\n") |
| `maxLength` | number | Config | Max buffer size (default: 1MB) |
| **Outputs** |
| `accumulated` | string | Data | Current accumulated text |
| `messages` | array | Data | Complete messages (split by delimiter) |
| `messageCount` | number | Status | Number of complete messages |
| `messageReceived` | signal | Events | Fires when complete message |
| `bufferSize` | number | Status | Current buffer size (bytes) |
| `cleared` | signal | Events | Fires after clear |

### JSON Stream Parser Node

```javascript
{
  name: 'net.noodl.JSONStreamParser',
  displayNodeName: 'JSON Stream Parser',
  category: 'Data',
  color: 'green'
}
```

#### Ports: JSON Stream Parser

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `chunk` | string | Data | JSON chunk |
| `parse` | signal | Actions | Trigger parse |
| `clear` | signal | Actions | Clear buffer |
| `format` | enum | Config | 'ndjson', 'array', 'single' |
| **Outputs** |
| `parsed` | * | Data | Parsed object |
| `success` | signal | Events | Fires on successful parse |
| `error` | string | Events | Parse error message |
| `isComplete` | boolean | Status | Object is complete |

### Pattern Extractor Node

```javascript
{
  name: 'net.noodl.PatternExtractor',
  displayNodeName: 'Pattern Extractor',
  category: 'Data',
  color: 'green'
}
```

#### Ports: Pattern Extractor

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `text` | string | Data | Text to extract from |
| `pattern` | string | Pattern | Regex pattern |
| `extract` | signal | Actions | Trigger extraction |
| `extractAll` | boolean | Config | Extract all matches vs first |
| **Outputs** |
| `match` | string | Data | Matched text |
| `matches` | array | Data | All matches |
| `groups` | array | Data | Capture groups |
| `found` | signal | Events | Fires when match found |
| `notFound` | signal | Events | Fires when no match |

### Stream Buffer Node

```javascript
{
  name: 'net.noodl.StreamBuffer',
  displayNodeName: 'Stream Buffer',
  category: 'Data',
  color: 'green'
}
```

#### Ports: Stream Buffer

| Port Name | Type | Group | Description |
|-----------|------|-------|-------------|
| **Inputs** |
| `data` | * | Data | Data to buffer |
| `add` | signal | Actions | Add to buffer |
| `flush` | signal | Actions | Flush buffer |
| `clear` | signal | Actions | Clear buffer |
| `flushSize` | number | Config | Auto-flush after N items |
| `flushInterval` | number | Config | Auto-flush after ms |
| **Outputs** |
| `buffer` | array | Data | Current buffer contents |
| `bufferSize` | number | Status | Items in buffer |
| `flushed` | signal | Events | Fires after flush |
| `flushedData` | array | Data | Data that was flushed |

---

## Implementation Details

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── textaccumulatornode.js    # Text accumulator
├── jsonstreamparsernode.js   # JSON parser
├── patternextractornode.js   # Regex extractor
├── streambuffernode.js       # Generic buffer
└── streamutils.test.js       # Tests
```

### Text Accumulator Implementation

```javascript
// textaccumulatornode.js

var TextAccumulatorNode = {
  name: 'net.noodl.TextAccumulator',
  displayNodeName: 'Text Accumulator',
  category: 'Data',
  color: 'green',
  
  initialize: function() {
    this._internal.buffer = '';
    this._internal.messages = [];
  },
  
  inputs: {
    chunk: {
      type: 'string',
      displayName: 'Chunk',
      group: 'Data',
      set: function(value) {
        this._internal.pendingChunk = value;
      }
    },
    
    add: {
      type: 'signal',
      displayName: 'Add',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.addChunk();
      }
    },
    
    clear: {
      type: 'signal',
      displayName: 'Clear',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.clearBuffer();
      }
    },
    
    delimiter: {
      type: 'string',
      displayName: 'Delimiter',
      group: 'Config',
      default: '\n',
      set: function(value) {
        this._internal.delimiter = value;
      }
    },
    
    maxLength: {
      type: 'number',
      displayName: 'Max Length (bytes)',
      group: 'Config',
      default: 1024 * 1024, // 1MB
      set: function(value) {
        this._internal.maxLength = value;
      }
    }
  },
  
  outputs: {
    accumulated: {
      type: 'string',
      displayName: 'Accumulated',
      group: 'Data',
      getter: function() {
        return this._internal.buffer;
      }
    },
    
    messages: {
      type: 'array',
      displayName: 'Messages',
      group: 'Data',
      getter: function() {
        return this._internal.messages;
      }
    },
    
    messageCount: {
      type: 'number',
      displayName: 'Message Count',
      group: 'Status',
      getter: function() {
        return this._internal.messages.length;
      }
    },
    
    messageReceived: {
      type: 'signal',
      displayName: 'Message Received',
      group: 'Events'
    },
    
    bufferSize: {
      type: 'number',
      displayName: 'Buffer Size',
      group: 'Status',
      getter: function() {
        return new Blob([this._internal.buffer]).size;
      }
    },
    
    cleared: {
      type: 'signal',
      displayName: 'Cleared',
      group: 'Events'
    }
  },
  
  methods: {
    addChunk: function() {
      const chunk = this._internal.pendingChunk;
      if (!chunk) return;
      
      // Add to buffer
      this._internal.buffer += chunk;
      
      // Check max length
      const maxLength = this._internal.maxLength || (1024 * 1024);
      if (this._internal.buffer.length > maxLength) {
        console.warn('[TextAccumulator] Buffer overflow, truncating');
        this._internal.buffer = this._internal.buffer.slice(-maxLength);
      }
      
      // Check for complete messages
      const delimiter = this._internal.delimiter || '\n';
      const parts = this._internal.buffer.split(delimiter);
      
      // Keep last incomplete part in buffer
      this._internal.buffer = parts.pop();
      
      // Add complete messages
      if (parts.length > 0) {
        this._internal.messages = this._internal.messages.concat(parts);
        this.flagOutputDirty('messages');
        this.flagOutputDirty('messageCount');
        this.sendSignalOnOutput('messageReceived');
      }
      
      this.flagOutputDirty('accumulated');
      this.flagOutputDirty('bufferSize');
    },
    
    clearBuffer: function() {
      this._internal.buffer = '';
      this._internal.messages = [];
      
      this.flagOutputDirty('accumulated');
      this.flagOutputDirty('messages');
      this.flagOutputDirty('messageCount');
      this.flagOutputDirty('bufferSize');
      this.sendSignalOnOutput('cleared');
    }
  },
  
  getInspectInfo: function() {
    return {
      type: 'value',
      value: {
        bufferSize: this._internal.buffer.length,
        messageCount: this._internal.messages.length,
        lastMessage: this._internal.messages[this._internal.messages.length - 1]
      }
    };
  }
};

module.exports = {
  node: TextAccumulatorNode
};
```

### JSON Stream Parser Implementation

```javascript
// jsonstreamparsernode.js

var JSONStreamParserNode = {
  name: 'net.noodl.JSONStreamParser',
  displayNodeName: 'JSON Stream Parser',
  category: 'Data',
  color: 'green',
  
  initialize: function() {
    this._internal.buffer = '';
  },
  
  inputs: {
    chunk: {
      type: 'string',
      displayName: 'Chunk',
      group: 'Data',
      set: function(value) {
        this._internal.chunk = value;
      }
    },
    
    parse: {
      type: 'signal',
      displayName: 'Parse',
      group: 'Actions',
      valueChangedToTrue: function() {
        this.doParse();
      }
    },
    
    clear: {
      type: 'signal',
      displayName: 'Clear',
      group: 'Actions',
      valueChangedToTrue: function() {
        this._internal.buffer = '';
      }
    },
    
    format: {
      type: {
        name: 'enum',
        enums: [
          { label: 'NDJSON', value: 'ndjson' },
          { label: 'JSON Array', value: 'array' },
          { label: 'Single Object', value: 'single' }
        ]
      },
      displayName: 'Format',
      group: 'Config',
      default: 'ndjson'
    }
  },
  
  outputs: {
    parsed: {
      type: '*',
      displayName: 'Parsed',
      group: 'Data',
      getter: function() {
        return this._internal.parsed;
      }
    },
    
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function() {
        return this._internal.error;
      }
    },
    
    isComplete: {
      type: 'boolean',
      displayName: 'Is Complete',
      group: 'Status',
      getter: function() {
        return this._internal.isComplete;
      }
    }
  },
  
  methods: {
    doParse: function() {
      const chunk = this._internal.chunk;
      if (!chunk) return;
      
      this._internal.buffer += chunk;
      
      const format = this._internal.format || 'ndjson';
      
      try {
        if (format === 'ndjson') {
          this.parseNDJSON();
        } else if (format === 'single') {
          this.parseSingleJSON();
        } else if (format === 'array') {
          this.parseJSONArray();
        }
      } catch (e) {
        this._internal.error = e.message;
        this._internal.isComplete = false;
        this.flagOutputDirty('error');
        this.flagOutputDirty('isComplete');
      }
    },
    
    parseNDJSON: function() {
      // NDJSON: one JSON per line
      const lines = this._internal.buffer.split('\n');
      
      // Keep last incomplete line
      this._internal.buffer = lines.pop();
      
      // Parse complete lines
      const parsed = [];
      for (const line of lines) {
        if (line.trim()) {
          try {
            parsed.push(JSON.parse(line));
          } catch (e) {
            console.warn('[JSONStreamParser] Failed to parse line:', line);
          }
        }
      }
      
      if (parsed.length > 0) {
        this._internal.parsed = parsed;
        this._internal.isComplete = true;
        this.flagOutputDirty('parsed');
        this.flagOutputDirty('isComplete');
        this.sendSignalOnOutput('success');
      }
    },
    
    parseSingleJSON: function() {
      // Try to parse complete JSON object
      try {
        const parsed = JSON.parse(this._internal.buffer);
        this._internal.parsed = parsed;
        this._internal.isComplete = true;
        this._internal.buffer = '';
        
        this.flagOutputDirty('parsed');
        this.flagOutputDirty('isComplete');
        this.sendSignalOnOutput('success');
      } catch (e) {
        // Not complete yet, wait for more chunks
        this._internal.isComplete = false;
        this.flagOutputDirty('isComplete');
      }
    },
    
    parseJSONArray: function() {
      // JSON array, possibly incomplete: [{"a":1},{"b":2}...
      // Try to parse as-is, or add closing bracket
      
      let buffer = this._internal.buffer.trim();
      
      // Try parsing complete array
      try {
        const parsed = JSON.parse(buffer);
        if (Array.isArray(parsed)) {
          this._internal.parsed = parsed;
          this._internal.isComplete = true;
          this._internal.buffer = '';
          
          this.flagOutputDirty('parsed');
          this.flagOutputDirty('isComplete');
          this.sendSignalOnOutput('success');
          return;
        }
      } catch (e) {
        // Not complete, try adding closing bracket
        try {
          const parsed = JSON.parse(buffer + ']');
          if (Array.isArray(parsed)) {
            this._internal.parsed = parsed;
            this._internal.isComplete = false; // Partial
            
            this.flagOutputDirty('parsed');
            this.flagOutputDirty('isComplete');
            this.sendSignalOnOutput('success');
          }
        } catch (e2) {
          // Still not parseable
          this._internal.isComplete = false;
          this.flagOutputDirty('isComplete');
        }
      }
    }
  }
};

module.exports = {
  node: JSONStreamParserNode
};
```

### Pattern Extractor Implementation (abbreviated)

```javascript
// patternextractornode.js

var PatternExtractorNode = {
  name: 'net.noodl.PatternExtractor',
  displayNodeName: 'Pattern Extractor',
  category: 'Data',
  color: 'green',
  
  inputs: {
    text: { type: 'string', displayName: 'Text' },
    pattern: { type: 'string', displayName: 'Pattern' },
    extract: { type: 'signal', displayName: 'Extract' },
    extractAll: { type: 'boolean', displayName: 'Extract All', default: false }
  },
  
  outputs: {
    match: { type: 'string', displayName: 'Match' },
    matches: { type: 'array', displayName: 'Matches' },
    groups: { type: 'array', displayName: 'Groups' },
    found: { type: 'signal', displayName: 'Found' },
    notFound: { type: 'signal', displayName: 'Not Found' }
  },
  
  methods: {
    doExtract: function() {
      const text = this._internal.text;
      const pattern = this._internal.pattern;
      
      if (!text || !pattern) return;
      
      try {
        const regex = new RegExp(pattern, this._internal.extractAll ? 'g' : '');
        const matches = this._internal.extractAll 
          ? [...text.matchAll(new RegExp(pattern, 'g'))]
          : [text.match(regex)];
        
        if (matches && matches[0]) {
          this._internal.match = matches[0][0];
          this._internal.matches = matches.map(m => m[0]);
          this._internal.groups = matches[0].slice(1);
          
          this.flagOutputDirty('match');
          this.flagOutputDirty('matches');
          this.flagOutputDirty('groups');
          this.sendSignalOnOutput('found');
        } else {
          this.sendSignalOnOutput('notFound');
        }
      } catch (e) {
        console.error('[PatternExtractor] Invalid regex:', e);
      }
    }
  }
};
```

---

## Usage Examples

### Example 1: AI Chat Streaming (Erleah)

```
[SSE] data → text chunks
  ↓
[Text Accumulator]
  delimiter: ""  // No delimiter, accumulate all
  chunk: data
  add
  ↓
[Text Accumulator] accumulated
  → [Text] display streaming message
  
// Real-time text appears as AI types!
```

### Example 2: NDJSON Stream

```
[SSE] data → NDJSON chunks
  ↓
[JSON Stream Parser]
  format: "ndjson"
  chunk: data
  parse
  ↓
[JSON Stream Parser] parsed → array of objects
  ↓
[For Each] object in array
  → [Process each object]
```

### Example 3: Extract Progress

```
[SSE] data → "Processing... 45% complete"
  ↓
[Pattern Extractor]
  text: data
  pattern: "(\d+)%"
  extract
  ↓
[Pattern Extractor] groups → [0] = "45"
  → [Number] 45
  → [Progress Bar] value
```

### Example 4: Buffered Updates

```
[SSE] data → frequent updates
  ↓
[Stream Buffer]
  data: item
  add
  flushInterval: 1000  // Flush every second
  ↓
[Stream Buffer] flushed
[Stream Buffer] flushedData → batched items
  → [Process batch at once]
  
// Reduces processing overhead
```

---

## Testing Checklist

### Functional Tests

- [ ] Text accumulator handles chunks correctly
- [ ] NDJSON parser splits on newlines
- [ ] Single JSON waits for complete object
- [ ] Array JSON handles incomplete arrays
- [ ] Pattern extractor finds matches
- [ ] Capture groups extracted correctly
- [ ] Buffer flushes on size/interval
- [ ] Clear operations work

### Edge Cases

- [ ] Empty chunks
- [ ] Very large chunks (>1MB)
- [ ] Malformed JSON
- [ ] Invalid regex patterns
- [ ] No matches found
- [ ] Buffer overflow
- [ ] Rapid chunks (stress test)
- [ ] Unicode/emoji handling

### Performance

- [ ] No memory leaks with long streams
- [ ] Regex doesn't cause ReDoS
- [ ] Large buffer doesn't freeze UI

---

## Documentation Requirements

### User-Facing Docs

Create: `docs/nodes/data/stream-utilities.md`

```markdown
# Stream Utilities

Tools for working with streaming data from SSE, WebSocket, or chunked HTTP responses.

## Text Accumulator

Collect text chunks into complete messages:

```
[SSE] → chunks
[Text Accumulator] → complete messages
```

Use cases:
- AI chat streaming
- Log streaming
- Progress messages

## JSON Stream Parser

Parse streaming JSON in various formats:

- **NDJSON**: One JSON per line
- **Single**: Wait for complete object
- **Array**: Parse partial JSON arrays

## Pattern Extractor

Extract values using regex:

```
Text: "Status: 45% complete"
Pattern: "(\d+)%"
→ Match: "45"
```

Use cases:
- Extract progress percentages
- Parse structured logs
- Find specific values

## Stream Buffer

Batch frequent updates:

```
[Rapid Updates] → [Buffer] → [Batch Process]
```

Reduces processing overhead.

## Best Practices

1. **Set max lengths**: Prevent memory issues
2. **Handle parse errors**: JSON might be incomplete
3. **Use delimiters**: For message boundaries
4. **Batch when possible**: Reduce processing
```

---

## Success Criteria

1. ✅ Handles streaming data reliably
2. ✅ Parses NDJSON correctly
3. ✅ Regex extraction works
4. ✅ No memory leaks
5. ✅ Clear documentation
6. ✅ Works with AGENT-001 (SSE) for Erleah

---

## Future Enhancements

1. **XML Stream Parser** - Parse chunked XML
2. **CSV Stream Parser** - Parse CSV row-by-row
3. **Binary Parsers** - Protocol buffers, msgpack
4. **Compression** - Decompress gzip/deflate streams
5. **Encoding Detection** - Auto-detect UTF-8/UTF-16

---

## References

- [NDJSON Spec](http://ndjson.org/)
- [JSON Streaming](https://en.wikipedia.org/wiki/JSON_streaming)

---

## Dependencies

- None (pure utilities)

## Blocked By

- None (can be developed independently)

## Blocks

- None (but enhances AGENT-001, AGENT-002)

---

## Estimated Effort Breakdown

| Phase | Estimate | Description |
|-------|----------|-------------|
| Text Accumulator | 0.5 day | Basic chunking logic |
| JSON Parser | 1 day | NDJSON, single, array formats |
| Pattern Extractor | 0.5 day | Regex wrapper |
| Stream Buffer | 0.5 day | Time/size-based flushing |
| Testing | 0.5 day | Edge cases, performance |
| Documentation | 0.5 day | User docs, examples |

**Total: 3.5 days**

Buffer: None needed

**Final: 2-3 days**
