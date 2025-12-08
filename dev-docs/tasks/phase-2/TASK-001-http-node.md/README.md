# TASK-001: Robust HTTP Node

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-001 |
| **Phase** | Phase 2 - Core Features |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium-High |
| **Estimated Time** | 5-7 days |
| **Prerequisites** | Phase 1 (dependency updates complete) |
| **Branch** | `feature/002-robust-http-node` |
| **Related Files** | `packages/noodl-runtime/src/nodes/std-library/data/restnode.js` |

## Objective

Create a modern, declarative HTTP node that replaces the current script-based REST node. The new node should make API integration accessible to nocoders while remaining powerful enough for developers. This is the foundational building block for all external API integrations.

## Problem Statement

The current REST node (`REST2`) is a significant barrier to Noodl adoption:

1. **Script-based configuration**: Users must write JavaScript in Request/Response handlers
2. **Poor discoverability**: Headers, params, body must be manually scripted
3. **No cURL import**: Can't paste from Postman, browser DevTools, or API docs
4. **No visual body builder**: JSON structure must be manually coded
5. **Limited auth patterns**: No presets for common authentication methods
6. **No response mapping**: Must script extraction of response data
7. **No pagination support**: Multi-page results require custom logic

The Function node is powerful but has the same accessibility problem. The AI assistant helps but shouldn't be required for basic API calls.

## Background

### Current REST Node Architecture

```javascript
// From restnode.js - users must write scripts like this:
var defaultRequestScript =
  '//Add custom code to setup the request object before the request\n' +
  '//*Request.resource     contains the resource path of the request.\n' +
  '//*Request.method       contains the method, GET, POST, PUT or DELETE.\n' +
  '//*Request.headers      is a map where you can add additional headers.\n' +
  '//*Request.parameters   is a map the parameters that will be appended\n' +
  '//                      to the url.\n' +
  '//*Request.content      contains the content of the request as a javascript\n' +
  '//                      object.\n';
```

Dynamic ports are created by parsing scripts for `Inputs.X` and `Outputs.X` patterns - clever but opaque to nocoders.

### Competitive Analysis

**n8n HTTP Request Node Features:**
- URL with path parameter support (`/users/{userId}`)
- Method dropdown (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Authentication presets (None, Basic, Bearer, API Key, OAuth)
- Query parameters (visual list → input ports)
- Headers (visual list → input ports)
- Body type selector (JSON, Form-data, URL-encoded, Raw, Binary)
- Body fields (visual list → input ports for JSON)
- Response filtering (extract specific fields)
- Pagination modes (offset, cursor, page-based)
- Retry on failure
- Timeout configuration
- cURL import

This is the benchmark. Noodl should match or exceed this.

## Desired State

After this task, users can:

1. **Basic API call**: Select method, enter URL, hit Fetch - zero scripting
2. **Path parameters**: URL `/users/{userId}` creates `userId` input port automatically
3. **Headers**: Add via visual list, each becomes an input port
4. **Query params**: Same pattern - visual list → input ports
5. **Body**: Select type (JSON/Form/Raw), add fields visually, each becomes input port
6. **Authentication**: Select preset (Bearer, Basic, API Key), fill in values
7. **Response mapping**: Define output fields with JSONPath, each becomes output port
8. **cURL import**: Paste cURL command → all fields auto-populated
9. **Pagination**: Configure pattern (offset/cursor/page), get paginated results

## Technical Approach

### Node Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Node (Editor)                         │
├─────────────────────────────────────────────────────────────────┤
│  URL: [https://api.example.com/users/{userId}              ]   │
│  Method: [▼ GET  ]                                              │
│                                                                 │
│  ┌─ Path Parameters ────────────────────────────────────────┐  │
│  │  userId: [input port created automatically]              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Headers ────────────────────────────────────────────────┐  │
│  │  [+ Add Header]                                          │  │
│  │  Authorization: [●] (input port)                         │  │
│  │  X-Custom-Header: [●] (input port)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Query Parameters ───────────────────────────────────────┐  │
│  │  [+ Add Param]                                           │  │
│  │  limit: [●] (input port)                                 │  │
│  │  offset: [●] (input port)                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Body (when POST/PUT/PATCH) ─────────────────────────────┐  │
│  │  Type: [▼ JSON]                                          │  │
│  │  [+ Add Field]                                           │  │
│  │  name: [●] (input port)                                  │  │
│  │  email: [●] (input port)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Response Mapping ───────────────────────────────────────┐  │
│  │  [+ Add Output]                                          │  │
│  │  users: $.data.users  → [●] (output port, type: array)   │  │
│  │  total: $.meta.total  → [●] (output port, type: number)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Authentication ─────────────────────────────────────────┐  │
│  │  Type: [▼ Bearer Token]                                  │  │
│  │  Token: [●] (input port)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
packages/noodl-runtime/src/nodes/std-library/data/
├── restnode.js              # OLD - keep for backwards compat
├── httpnode.js              # NEW - main node definition
└── httpnode/
    ├── index.js             # Node registration
    ├── curlParser.js        # cURL import parser
    ├── jsonPath.js          # JSONPath response extraction
    ├── authPresets.js       # Auth configuration helpers
    └── pagination.js        # Pagination strategies

packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
└── DataProviders/HttpNode/
    ├── HttpNodeEditor.tsx           # Main property panel
    ├── HeadersEditor.tsx            # Visual headers list
    ├── QueryParamsEditor.tsx        # Visual query params list
    ├── BodyEditor.tsx               # Body type + fields editor
    ├── ResponseMappingEditor.tsx    # JSONPath output mapping
    ├── AuthEditor.tsx               # Auth type selector
    ├── CurlImportModal.tsx          # cURL paste modal
    └── PaginationEditor.tsx         # Pagination configuration
```

### Key Implementation Details

#### 1. Dynamic Port Generation

Following the pattern from `dbcollectionnode2.js`:

```javascript
// httpnode.js
{
  setup: function(context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _updatePorts(node) {
      const ports = [];
      const parameters = node.parameters;

      // Parse URL for path parameters: /users/{userId} → userId port
      if (parameters.url) {
        const pathParams = parameters.url.match(/\{([A-Za-z0-9_]+)\}/g) || [];
        pathParams.forEach(param => {
          const name = param.replace(/[{}]/g, '');
          ports.push({
            name: 'path-' + name,
            displayName: name,
            type: 'string',
            plug: 'input',
            group: 'Path Parameters'
          });
        });
      }

      // Headers from visual list → input ports
      if (parameters.headers) {
        parameters.headers.forEach(h => {
          ports.push({
            name: 'header-' + h.key,
            displayName: h.key,
            type: 'string',
            plug: 'input',
            group: 'Headers'
          });
        });
      }

      // Query params from visual list → input ports
      if (parameters.queryParams) {
        parameters.queryParams.forEach(p => {
          ports.push({
            name: 'query-' + p.key,
            displayName: p.key,
            type: '*',
            plug: 'input',
            group: 'Query Parameters'
          });
        });
      }

      // Body fields (when JSON type) → input ports
      if (parameters.bodyType === 'json' && parameters.bodyFields) {
        parameters.bodyFields.forEach(f => {
          ports.push({
            name: 'body-' + f.key,
            displayName: f.key,
            type: f.type || '*',
            plug: 'input',
            group: 'Body'
          });
        });
      }

      // Response mapping → output ports
      if (parameters.responseMapping) {
        parameters.responseMapping.forEach(m => {
          ports.push({
            name: 'out-' + m.name,
            displayName: m.name,
            type: m.type || '*',
            plug: 'output',
            group: 'Response'
          });
        });
      }

      context.editorConnection.sendDynamicPorts(node.id, ports);
    }

    graphModel.on('nodeAdded.HTTP', node => _updatePorts(node));
    // ... update on parameter changes
  }
}
```

#### 2. cURL Parser

```javascript
// curlParser.js
export function parseCurl(curlCommand) {
  const result = {
    url: '',
    method: 'GET',
    headers: [],
    queryParams: [],
    bodyType: null,
    bodyContent: null,
    bodyFields: []
  };

  // Extract URL
  const urlMatch = curlCommand.match(/curl\s+(['"]?)([^\s'"]+)\1/);
  if (urlMatch) {
    const url = new URL(urlMatch[2]);
    result.url = url.origin + url.pathname;
    
    // Extract query params from URL
    url.searchParams.forEach((value, key) => {
      result.queryParams.push({ key, value });
    });
  }

  // Extract method
  const methodMatch = curlCommand.match(/-X\s+(\w+)/);
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase();
  }

  // Extract headers
  const headerMatches = curlCommand.matchAll(/-H\s+(['"])([^'"]+)\1/g);
  for (const match of headerMatches) {
    const [key, value] = match[2].split(':').map(s => s.trim());
    if (key.toLowerCase() === 'content-type') {
      if (value.includes('json')) result.bodyType = 'json';
      else if (value.includes('form')) result.bodyType = 'form';
    }
    result.headers.push({ key, value });
  }

  // Extract body
  const bodyMatch = curlCommand.match(/-d\s+(['"])(.+?)\1/s);
  if (bodyMatch) {
    result.bodyContent = bodyMatch[2];
    if (result.bodyType === 'json') {
      try {
        const parsed = JSON.parse(result.bodyContent);
        result.bodyFields = Object.entries(parsed).map(([key, value]) => ({
          key,
          type: typeof value,
          defaultValue: value
        }));
      } catch (e) {
        // Raw body
      }
    }
  }

  return result;
}
```

#### 3. Authentication Presets

```javascript
// authPresets.js
export const authPresets = {
  none: {
    label: 'None',
    configure: () => ({})
  },
  bearer: {
    label: 'Bearer Token',
    inputs: [{ name: 'token', type: 'string', displayName: 'Token' }],
    configure: (inputs) => ({
      headers: { 'Authorization': `Bearer ${inputs.token}` }
    })
  },
  basic: {
    label: 'Basic Auth',
    inputs: [
      { name: 'username', type: 'string', displayName: 'Username' },
      { name: 'password', type: 'string', displayName: 'Password' }
    ],
    configure: (inputs) => ({
      headers: { 
        'Authorization': `Basic ${btoa(inputs.username + ':' + inputs.password)}` 
      }
    })
  },
  apiKey: {
    label: 'API Key',
    inputs: [
      { name: 'key', type: 'string', displayName: 'Key Name' },
      { name: 'value', type: 'string', displayName: 'Value' },
      { name: 'location', type: 'enum', enums: ['header', 'query'], displayName: 'Add to' }
    ],
    configure: (inputs) => {
      if (inputs.location === 'header') {
        return { headers: { [inputs.key]: inputs.value } };
      } else {
        return { queryParams: { [inputs.key]: inputs.value } };
      }
    }
  }
};
```

#### 4. Response Mapping with JSONPath

```javascript
// jsonPath.js - lightweight JSONPath implementation
export function extractByPath(obj, path) {
  // Support: $.data.users, $.items[0].name, $.meta.pagination.total
  if (!path.startsWith('$')) return undefined;
  
  const parts = path.substring(2).split('.').filter(Boolean);
  let current = obj;
  
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    
    // Handle array access: items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current[part];
    }
  }
  
  return current;
}
```

#### 5. Pagination Strategies

```javascript
// pagination.js
export const paginationStrategies = {
  none: {
    label: 'None',
    configure: () => null
  },
  offset: {
    label: 'Offset/Limit',
    inputs: [
      { name: 'limitParam', default: 'limit', displayName: 'Limit Parameter' },
      { name: 'offsetParam', default: 'offset', displayName: 'Offset Parameter' },
      { name: 'pageSize', type: 'number', default: 100, displayName: 'Page Size' },
      { name: 'maxPages', type: 'number', default: 10, displayName: 'Max Pages' }
    ],
    getNextPage: (config, currentOffset, response) => {
      // Return null when done, or next offset
      const hasMore = response.length === config.pageSize;
      return hasMore ? currentOffset + config.pageSize : null;
    }
  },
  cursor: {
    label: 'Cursor-based',
    inputs: [
      { name: 'cursorParam', default: 'cursor', displayName: 'Cursor Parameter' },
      { name: 'cursorPath', default: '$.meta.next_cursor', displayName: 'Next Cursor Path' },
      { name: 'maxPages', type: 'number', default: 10, displayName: 'Max Pages' }
    ],
    getNextPage: (config, currentCursor, response) => {
      return extractByPath(response, config.cursorPath) || null;
    }
  },
  page: {
    label: 'Page Number',
    inputs: [
      { name: 'pageParam', default: 'page', displayName: 'Page Parameter' },
      { name: 'totalPagesPath', default: '$.meta.total_pages', displayName: 'Total Pages Path' },
      { name: 'maxPages', type: 'number', default: 10, displayName: 'Max Pages' }
    ],
    getNextPage: (config, currentPage, response) => {
      const totalPages = extractByPath(response, config.totalPagesPath);
      return currentPage < totalPages ? currentPage + 1 : null;
    }
  }
};
```

### Editor Property Panel

The property panel will be custom React components following patterns in:
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/`

Key patterns to follow from existing code:
- `QueryEditor/` for visual list builders
- `DataProviders/` for data node property panels

## Scope

### In Scope

- [x] New HTTP node with declarative configuration
- [x] URL with path parameter detection
- [x] Visual headers editor
- [x] Visual query parameters editor
- [x] Body type selector (JSON, Form-data, URL-encoded, Raw)
- [x] Visual body field editor for JSON
- [x] Authentication presets (None, Bearer, Basic, API Key)
- [x] Response mapping with JSONPath
- [x] cURL import functionality
- [x] Pagination configuration
- [x] Full backwards compatibility (keep REST2 node)
- [x] Documentation

### Out of Scope

- OAuth 2.0 flow (complex, can be separate task)
- GraphQL support (different paradigm, separate node)
- WebSocket support (separate node)
- File upload/download (can be Phase 2)
- Request/response interceptors (advanced, later)
- BaaS-specific integrations (see FUTURE-BAAS-INTEGRATION.md)

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| TASK-001 | Task | Build must be stable first |
| None | npm | No new packages required |

## Testing Plan

### Unit Tests

```javascript
// curlParser.test.js
describe('cURL Parser', () => {
  it('parses simple GET request', () => {
    const result = parseCurl('curl https://api.example.com/users');
    expect(result.url).toBe('https://api.example.com/users');
    expect(result.method).toBe('GET');
  });

  it('extracts headers', () => {
    const result = parseCurl(`curl -H "Authorization: Bearer token123" https://api.example.com`);
    expect(result.headers).toContainEqual({ key: 'Authorization', value: 'Bearer token123' });
  });

  it('parses POST with JSON body', () => {
    const result = parseCurl(`curl -X POST -H "Content-Type: application/json" -d '{"name":"test"}' https://api.example.com`);
    expect(result.method).toBe('POST');
    expect(result.bodyType).toBe('json');
    expect(result.bodyFields).toContainEqual({ key: 'name', type: 'string', defaultValue: 'test' });
  });
});

// jsonPath.test.js
describe('JSONPath Extraction', () => {
  const data = { data: { users: [{ name: 'Alice' }] }, meta: { total: 100 } };

  it('extracts nested values', () => {
    expect(extractByPath(data, '$.meta.total')).toBe(100);
  });

  it('extracts array elements', () => {
    expect(extractByPath(data, '$.data.users[0].name')).toBe('Alice');
  });
});
```

### Integration Tests

- [ ] Create HTTP node in editor
- [ ] Add headers via visual editor → verify input ports created
- [ ] Add body fields → verify input ports created
- [ ] Configure response mapping → verify output ports created
- [ ] Import cURL command → verify all fields populated
- [ ] Execute request → verify response data flows to outputs

### Manual Testing Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Basic GET | Create node, enter URL, connect Fetch signal | Response appears on outputs |
| POST with JSON | Select POST, add body fields, connect data | Request sent with JSON body |
| cURL import | Click import, paste cURL | All config fields populated |
| Auth Bearer | Select Bearer auth, connect token | Authorization header sent |
| Pagination | Configure offset pagination, trigger | Multiple pages fetched |

## Success Criteria

- [ ] Zero-script API calls work (GET with URL only)
- [ ] Path parameters auto-detected from URL
- [ ] Headers create input ports
- [ ] Query params create input ports
- [ ] Body fields create input ports (JSON mode)
- [ ] Response mapping creates output ports
- [ ] cURL import populates all fields correctly
- [ ] Auth presets work (Bearer, Basic, API Key)
- [ ] Pagination fetches multiple pages
- [ ] All existing REST2 node projects still work
- [ ] No TypeScript errors
- [ ] Documentation complete

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Complex editor UI | Medium | Medium | Follow existing QueryEditor patterns |
| cURL parsing edge cases | Low | High | Start simple, iterate based on feedback |
| Performance with large responses | Medium | Low | Stream large responses, limit pagination |
| JSONPath edge cases | Low | Medium | Use battle-tested library or comprehensive tests |

## Rollback Plan

1. The new HTTP node is additive - REST2 remains unchanged
2. If issues found, disable HTTP node registration in node library
3. Users can continue using REST2 or Function nodes

## References

- [n8n HTTP Request Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Existing REST node](packages/noodl-runtime/src/nodes/std-library/data/restnode.js)
- [dbcollection dynamic ports pattern](packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.js)
- [QueryEditor components](packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/QueryEditor/)
- [cURL format specification](https://curl.se/docs/manpage.html)
- [JSONPath specification](https://goessner.net/articles/JsonPath/)
