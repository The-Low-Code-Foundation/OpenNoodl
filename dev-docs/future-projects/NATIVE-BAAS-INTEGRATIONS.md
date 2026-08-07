# FUTURE: Native BaaS Integration Nodes

> **Document Type:** Future Project Scoping  
> **Status:** Planning  
> **Prerequisites:** TASK-002 (Robust HTTP Node)  
> **Estimated Effort:** 2-4 weeks per BaaS  
> **Priority:** High (post-HTTP node completion)

## Executive Summary

This document outlines the strategy for adding native Backend-as-a-Service (BaaS) integrations to OpenNoodl. The goal is to provide the same seamless "pick a table, see the fields" experience that Parse Server nodes currently offer, but for popular BaaS platforms that the community is asking for.

The key insight: **Noodl's Parse nodes demonstrate that schema-aware nodes dramatically improve the low-code experience.** When you select a table and immediately see all available fields as input/output ports, you eliminate the manual configuration that makes the current REST node painful.

## The Problem

**Community feedback:** "How do I hook up my backend?" is the #1 question from new Noodl users.

Current options:
1. **Parse Server nodes** - Great UX, but Parse isn't everyone's choice
2. **REST node** - Requires JavaScript scripting, intimidating for nocoders
3. **Function node** - Powerful but even more code-heavy
4. **AI-generated Function nodes** - Works but feels like a workaround

Users coming from other low-code platforms (n8n, Flutterflow, Retool) expect to see their backend in a dropdown and start building immediately.

## Strategic Approach

### Two-Track Strategy

**Track 1: Robust HTTP Node (TASK-002)**
- Foundation for any API integration
- Declarative, no-code configuration
- cURL import for quick setup
- The "escape hatch" that works with anything

**Track 2: Native BaaS Modules (This Document)**
- Schema-aware nodes for specific platforms
- Dropdown table selection → automatic field ports
- Visual query builders
- Authentication handled automatically

These tracks are complementary:
- HTTP Node = "You can connect to anything"
- BaaS Nodes = "Connecting to X is effortless"

### Module Architecture

Each BaaS integration ships as an installable **Noodl Module** (like MQTT or Material Icons):

```
noodl_modules/
├── supabase/
│   ├── manifest.json
│   ├── index.js
│   └── nodes/
│       ├── SupabaseConfig.js      # Connection configuration
│       ├── SupabaseQuery.js       # Read records
│       ├── SupabaseInsert.js      # Create records
│       ├── SupabaseUpdate.js      # Update records
│       ├── SupabaseDelete.js      # Delete records
│       ├── SupabaseRealtime.js    # Live subscriptions
│       └── SupabaseAuth.js        # Authentication
├── pocketbase/
│   └── ...
└── directus/
    └── ...
```

Benefits of module approach:
- Core Noodl stays lean
- Users opt-in to what they need
- Independent update cycles
- Community can contribute modules
- Easier to maintain

### Layered Implementation

```
┌─────────────────────────────────────────┐
│     BaaS Node (UX Layer)                │  ← Table dropdown, field ports, visual filters
├─────────────────────────────────────────┤
│     BaaS Adapter (Logic Layer)          │  ← Schema introspection, query translation
├─────────────────────────────────────────┤
│     HTTP Primitive (Transport Layer)    │  ← Actual HTTP requests (from TASK-002)
└─────────────────────────────────────────┘
```

This means:
- One HTTP implementation to maintain
- BaaS modules are mostly "schema + translation"
- Debugging is easier (can inspect raw HTTP)
- HTTP node improvements benefit all BaaS modules

---

## BaaS Platform Analysis

### Priority 1: Supabase

**Why first:**
- Most requested by community
- Excellent schema introspection via PostgREST
- PostgreSQL is familiar and powerful
- Strong ecosystem and documentation
- Free tier makes it accessible

**Schema Introspection:**
```bash
# Supabase exposes OpenAPI spec at root
GET https://your-project.supabase.co/rest/v1/
# Returns full schema with tables, columns, types, relationships
```

**Node Set:**
| Node | Purpose | Key Features |
|------|---------|--------------|
| Supabase Config | Store connection | URL, anon key, service key |
| Query Records | SELECT | Table dropdown, column selection, filters, sorting, pagination |
| Insert Record | INSERT | Table dropdown, field inputs from schema |
| Update Record | UPDATE | Table dropdown, field inputs, row identifier |
| Delete Record | DELETE | Table dropdown, row identifier |
| Realtime Subscribe | Live data | Table + filter, outputs on change |
| Auth (Sign Up) | Create user | Email, password, metadata |
| Auth (Sign In) | Authenticate | Email/password, magic link, OAuth |
| Auth (User) | Current user | Session data, JWT |
| Storage Upload | File upload | Bucket selection, file input |
| Storage Download | File URL | Bucket, path → signed URL |
| RPC Call | Stored procedures | Function dropdown, parameter inputs |

**Technical Details:**
- Auth: Uses Supabase Auth (GoTrue)
- Realtime: WebSocket connection to Supabase Realtime
- Storage: S3-compatible API
- Query: PostgREST syntax (filters, operators, pagination)

**Estimated Effort:** 2-3 weeks

---

### Priority 2: Pocketbase

**Why second:**
- Growing rapidly in low-code community
- Simple, single-binary deployment
- Good schema API
- Simpler than Supabase (faster to implement)
- Self-hosting friendly

**Schema Introspection:**
```bash
# Pocketbase admin API returns collection schema
GET /api/collections
# Returns: name, type, schema (fields with types), options
```

**Node Set:**
| Node | Purpose | Key Features |
|------|---------|--------------|
| Pocketbase Config | Store connection | URL, admin credentials |
| List Records | Query | Collection dropdown, filter, sort, expand relations |
| View Record | Get one | Collection, record ID |
| Create Record | Insert | Collection dropdown, field inputs |
| Update Record | Modify | Collection, record ID, field inputs |
| Delete Record | Remove | Collection, record ID |
| Realtime Subscribe | Live data | Collection + filter |
| Auth | User management | Email/password, OAuth providers |
| File URL | Get file URL | Record, field name |

**Technical Details:**
- Simpler auth model than Supabase
- Built-in file handling per record
- Realtime via SSE (Server-Sent Events)
- Filter syntax is custom (not PostgREST)

**Estimated Effort:** 1.5-2 weeks

---

### Priority 3: Directus

**Why third:**
- Enterprise-focused, more complex
- Headless CMS capabilities
- Strong schema introspection
- GraphQL support
- Longer implementation due to complexity

**Schema Introspection:**
```bash
# Directus has comprehensive schema endpoint
GET /fields
GET /collections
GET /relations
# Returns detailed field metadata including UI hints
```

**Node Set:**
| Node | Purpose | Key Features |
|------|---------|--------------|
| Directus Config | Store connection | URL, access token |
| Get Items | Query | Collection dropdown, fields, filter, sort |
| Get Item | Single | Collection, ID |
| Create Item | Insert | Collection, field inputs |
| Update Item | Modify | Collection, ID, field inputs |
| Delete Item | Remove | Collection, ID |
| Assets | File handling | Upload, get URL |
| Auth | Authentication | Login, refresh, current user |

**Technical Details:**
- REST and GraphQL APIs available
- More complex permission model
- Richer field types (including custom)
- Flows/automation integration possible

**Estimated Effort:** 2-3 weeks

---

## Technical Deep Dive

### Schema Introspection Pattern

All BaaS modules follow this pattern:

```javascript
// 1. On config change, fetch schema
async function fetchSchema(config) {
  const response = await fetch(`${config.url}/schema-endpoint`, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` }
  });
  return response.json();
}

// 2. Store schema in editor context
context.editorConnection.sendMetadata({
  type: 'baas-schema',
  provider: 'supabase',
  tables: schema.definitions,
  // Cache key for invalidation
  hash: computeHash(schema)
});

// 3. Nodes consume schema for dynamic ports
function updatePorts(node, schema) {
  const table = node.parameters.table;
  const tableSchema = schema.tables[table];
  
  if (!tableSchema) return;
  
  const ports = [];
  
  // Create input ports for each column
  Object.entries(tableSchema.columns).forEach(([name, column]) => {
    ports.push({
      name: `field-${name}`,
      displayName: name,
      type: mapColumnType(column.type),
      plug: 'input',
      group: 'Fields'
    });
  });
  
  // Create output ports
  ports.push({
    name: 'result',
    displayName: 'Result',
    type: 'array',
    plug: 'output',
    group: 'Results'
  });
  
  context.editorConnection.sendDynamicPorts(node.id, ports);
}
```

### Query Translation

Each BaaS has different filter syntax. The adapter translates from Noodl's visual filter format:

```javascript
// Noodl visual filter format (from QueryEditor)
const noodlFilter = {
  combinator: 'and',
  rules: [
    { property: 'status', operator: 'equalTo', value: 'active' },
    { property: 'created_at', operator: 'greaterThan', input: 'startDate' }
  ]
};

// Supabase (PostgREST) translation
function toSupabaseFilter(filter) {
  return filter.rules.map(rule => {
    switch(rule.operator) {
      case 'equalTo': return `${rule.property}=eq.${rule.value}`;
      case 'greaterThan': return `${rule.property}=gt.${rule.value}`;
      // ... more operators
    }
  }).join('&');
}

// Pocketbase translation
function toPocketbaseFilter(filter) {
  return filter.rules.map(rule => {
    switch(rule.operator) {
      case 'equalTo': return `${rule.property}="${rule.value}"`;
      case 'greaterThan': return `${rule.property}>"${rule.value}"`;
      // ... more operators
    }
  }).join(' && ');
}
```

### Authentication Flow

Each module handles auth internally:

```javascript
// Supabase example
const SupabaseConfig = {
  name: 'Supabase Config',
  category: 'Supabase',
  
  inputs: {
    projectUrl: { type: 'string', displayName: 'Project URL' },
    anonKey: { type: 'string', displayName: 'Anon Key' },
    // Service key for admin operations (optional)
    serviceKey: { type: 'string', displayName: 'Service Key' }
  },
  
  // Store config globally for other nodes to access
  methods: {
    setConfig: function() {
      this.context.globalStorage.set('supabase-config', {
        url: this._internal.projectUrl,
        anonKey: this._internal.anonKey,
        serviceKey: this._internal.serviceKey
      });
      this.sendSignalOnOutput('configured');
    }
  }
};

// Other Supabase nodes retrieve config
const SupabaseQuery = {
  methods: {
    doQuery: async function() {
      const config = this.context.globalStorage.get('supabase-config');
      if (!config) throw new Error('Supabase not configured');
      
      const response = await fetch(
        `${config.url}/rest/v1/${this._internal.table}`,
        {
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`
          }
        }
      );
      // ... handle response
    }
  }
};
```

### Visual Filter Builder Integration

Reuse existing QueryEditor components with BaaS-specific schema:

```javascript
// In editor, when Supabase node is selected
const schema = getSupabaseSchema(node.parameters.table);

// Pass to QueryEditor
<QueryFilterEditor
  schema={schema}
  value={node.parameters.visualFilter}
  onChange={(filter) => node.setParameter('visualFilter', filter)}
/>
```

The existing `QueryEditor` components from Parse integration can be reused:
- `QueryRuleEditPopup`
- `QuerySortingEditor`
- `RuleDropdown`, `RuleInput`

---

## Implementation Phases

### Phase 1: Foundation (TASK-002)
- Complete Robust HTTP Node
- Establish patterns for dynamic ports
- Create reusable editor components

### Phase 2: Supabase Module
**Week 1:**
- Schema introspection implementation
- Config node
- Query node with table dropdown

**Week 2:**
- Insert, Update, Delete nodes
- Visual filter builder integration
- Field-to-port mapping

**Week 3:**
- Realtime subscriptions
- Authentication nodes
- Storage nodes
- Documentation and examples

### Phase 3: Pocketbase Module
**Week 1-2:**
- Schema introspection
- Core CRUD nodes
- Realtime via SSE
- Authentication
- Documentation

### Phase 4: Directus Module
**Week 2-3:**
- Schema introspection (more complex)
- Core CRUD nodes
- Asset management
- Documentation

### Phase 5: Community & Iteration
- Publish module development guide
- Community feedback integration
- Additional BaaS based on demand (Firebase, Appwrite, etc.)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to first query | < 5 minutes (with Supabase account) |
| Lines of code to query | 0 (visual only) |
| Schema sync delay | < 2 seconds |
| Community satisfaction | Positive feedback in Discord |
| Module adoption | 50% of new projects using a BaaS module |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BaaS API changes | High | Version pin, monitor changelogs |
| Schema introspection rate limits | Medium | Cache aggressively, manual refresh |
| Complex filter translation | Medium | Start simple, iterate based on feedback |
| Module maintenance burden | Medium | Community contributions, shared patterns |
| Authentication complexity | High | Follow each BaaS's recommended patterns |

## Open Questions

1. **Should modules auto-detect connection issues?**
   - e.g., "Can't reach Supabase - check your URL"
   
2. **How to handle schema changes?**
   - Auto-refresh? Manual button? Both?
   
3. **Should we support multiple instances per BaaS?**
   - e.g., "Supabase Production" vs "Supabase Staging"
   
4. **How to handle migrations?**
   - If user changes BaaS provider, any tooling to help?

5. **GraphQL support for Directus/Supabase?**
   - PostgREST is simpler, but GraphQL is more flexible

---

## References

### Supabase
- [PostgREST API](https://postgrest.org/en/stable/api.html)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)
- [Auth API](https://supabase.com/docs/guides/auth)

### Pocketbase
- [API Documentation](https://pocketbase.io/docs/api-records/)
- [JavaScript SDK](https://github.com/pocketbase/js-sdk)
- [Realtime via SSE](https://pocketbase.io/docs/realtime/)

### Directus
- [REST API Reference](https://docs.directus.io/reference/introduction.html)
- [SDK](https://docs.directus.io/guides/sdk/getting-started.html)
- [Authentication](https://docs.directus.io/reference/authentication.html)

### Noodl Internals
- [Module Creation Guide](/javascript/extending/create-lib.md)
- [Parse Nodes Implementation](/packages/noodl-runtime/src/nodes/std-library/data/)
- [Query Editor Components](/packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/QueryEditor/)

---

## Appendix: Community Quotes

> "I'm used to Flutterflow where I just pick Supabase and I'm done. In Noodl I have to figure out REST nodes and it's confusing." - Discord user

> "The Parse nodes are amazing, why can't we have that for other backends?" - Forum post

> "I tried using the Function node for Supabase but I'm not a developer, I don't know JavaScript." - New user feedback

> "If Noodl had native Supabase support I'd switch from Flutterflow tomorrow." - Potential user
