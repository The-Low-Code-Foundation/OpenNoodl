# Phase 6D: UBA Polish & Documentation

## Error Handling, Performance, and Developer Documentation

**Phase:** 6D of 6  
**Duration:** 2 weeks (10 working days)  
**Priority:** HIGH  
**Status:** NOT STARTED  
**Depends On:** Phase 6A, 6B, 6C complete

---

## Overview

Phase 6D focuses on production readiness: comprehensive error handling, performance optimization, accessibility compliance, and complete documentation for both users and backend developers.

This phase transforms the UBA system from "it works" to "it works reliably and is well-documented."

### Key Outcomes

1. **Robust Error Handling** - Graceful failures, helpful messages, recovery paths
2. **Performance** - Smooth UI even with complex schemas and many events
3. **Accessibility** - Full keyboard navigation, screen reader support
4. **Documentation** - Schema reference, backend guide, tutorials

---

## Goals

1. **Comprehensive error handling** - Every failure mode handled gracefully
2. **Performance optimization** - Lazy loading, virtualization, caching
3. **Backend Services integration** - UBA seamlessly integrated into existing panel
4. **Complete documentation** - Reference docs, tutorials, examples
5. **Example schemas** - Templates for common backend types

---

## Prerequisites

- Phase 6A complete ✅
- Phase 6B complete ✅
- Phase 6C complete ✅

---

## Task Breakdown

### UBA-018: Error Handling
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-018-error-handling`

#### Description

Implement comprehensive error handling for all UBA operations with user-friendly messages, recovery suggestions, and graceful degradation.

#### Error Categories

| Category | Examples | User Impact |
|----------|----------|-------------|
| **Network** | Backend unreachable, timeout, DNS failure | Can't fetch schema or push config |
| **Schema** | Invalid YAML, unsupported version, missing fields | Can't render config panel |
| **Auth** | Token expired, invalid credentials, 403 | Can't communicate with backend |
| **Validation** | Required field missing, pattern mismatch | Can't save config |
| **Runtime** | Debug stream disconnected, event parse error | Degraded debugging |

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── errors/
│   ├── UBAError.ts
│   ├── NetworkError.ts
│   ├── SchemaError.ts
│   ├── AuthError.ts
│   ├── ValidationError.ts
│   └── index.ts
└── ErrorRecovery.ts

packages/noodl-editor/src/editor/src/views/UBA/
├── ErrorBoundary.tsx
├── ErrorDisplay.tsx
└── ErrorRecoveryActions.tsx
```

#### Implementation

```typescript
// UBAError.ts
export abstract class UBAError extends Error {
  abstract readonly code: string;
  abstract readonly category: 'network' | 'schema' | 'auth' | 'validation' | 'runtime';
  abstract readonly recoverable: boolean;
  abstract readonly userMessage: string;
  abstract readonly recoveryActions: RecoveryAction[];
  
  readonly timestamp: Date = new Date();
  readonly context: Record<string, any> = {};
  
  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    if (context) {
      this.context = context;
    }
  }
  
  toJSON() {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp.toISOString()
    };
  }
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

// NetworkError.ts
export class BackendUnreachableError extends UBAError {
  readonly code = 'BACKEND_UNREACHABLE';
  readonly category = 'network' as const;
  readonly recoverable = true;
  
  get userMessage(): string {
    return `Cannot connect to backend at ${this.context.url}. Please check that the backend is running and accessible.`;
  }
  
  get recoveryActions(): RecoveryAction[] {
    return [
      {
        label: 'Retry Connection',
        action: this.context.retry,
        primary: true
      },
      {
        label: 'Check Backend Status',
        action: () => window.open(this.context.healthUrl, '_blank')
      },
      {
        label: 'Use Cached Schema',
        action: this.context.useCached
      }
    ];
  }
}

export class RequestTimeoutError extends UBAError {
  readonly code = 'REQUEST_TIMEOUT';
  readonly category = 'network' as const;
  readonly recoverable = true;
  
  get userMessage(): string {
    return `Request to backend timed out after ${this.context.timeout}ms. The backend may be overloaded.`;
  }
  
  get recoveryActions(): RecoveryAction[] {
    return [
      { label: 'Retry', action: this.context.retry, primary: true },
      { label: 'Increase Timeout', action: this.context.increaseTimeout }
    ];
  }
}

// SchemaError.ts
export class SchemaParseError extends UBAError {
  readonly code = 'SCHEMA_PARSE_ERROR';
  readonly category = 'schema' as const;
  readonly recoverable = false;
  
  get userMessage(): string {
    const location = this.context.line ? ` at line ${this.context.line}` : '';
    return `Failed to parse backend schema${location}: ${this.context.parseError}`;
  }
  
  get recoveryActions(): RecoveryAction[] {
    return [
      { label: 'View Raw Schema', action: this.context.viewRaw },
      { label: 'Report Issue', action: () => this.context.reportIssue() }
    ];
  }
}

export class UnsupportedSchemaVersionError extends UBAError {
  readonly code = 'UNSUPPORTED_SCHEMA_VERSION';
  readonly category = 'schema' as const;
  readonly recoverable = false;
  
  get userMessage(): string {
    return `Schema version ${this.context.schemaVersion} is not supported. Nodegx supports up to version ${this.context.supportedVersion}.`;
  }
  
  get recoveryActions(): RecoveryAction[] {
    return [
      { label: 'Check for Updates', action: this.context.checkUpdates, primary: true }
    ];
  }
}

// AuthError.ts
export class AuthenticationError extends UBAError {
  readonly code = 'AUTH_FAILED';
  readonly category = 'auth' as const;
  readonly recoverable = true;
  
  get userMessage(): string {
    if (this.context.status === 401) {
      return 'Authentication failed. Your credentials may be invalid or expired.';
    }
    if (this.context.status === 403) {
      return 'Access denied. You may not have permission to access this backend.';
    }
    return 'Authentication error occurred.';
  }
  
  get recoveryActions(): RecoveryAction[] {
    return [
      { label: 'Update Credentials', action: this.context.openAuthDialog, primary: true },
      { label: 'Remove Backend', action: this.context.removeBackend }
    ];
  }
}

// ErrorBoundary.tsx
export class UBAErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  state = { error: null, errorInfo: null };
  
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('UBA Error Boundary caught error:', error, errorInfo);
  }
  
  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
  };
  
  render() {
    if (this.state.error) {
      return this.props.fallback || (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

// ErrorDisplay.tsx
export function ErrorDisplay({ error, errorInfo, onRetry, compact }: ErrorDisplayProps) {
  const isUBAError = error instanceof UBAError;
  
  if (compact) {
    return (
      <div className={css['error-compact']}>
        <IconAlertCircle />
        <span>{isUBAError ? error.userMessage : error.message}</span>
        {onRetry && <button onClick={onRetry}>Retry</button>}
      </div>
    );
  }
  
  return (
    <div className={css['error-display']}>
      <div className={css['error-header']}>
        <IconAlertCircle />
        <h3>Something went wrong</h3>
      </div>
      
      <p className={css['error-message']}>
        {isUBAError ? error.userMessage : error.message}
      </p>
      
      {isUBAError && error.recoveryActions.length > 0 && (
        <div className={css['recovery-actions']}>
          {error.recoveryActions.map((action, index) => (
            <button
              key={index}
              onClick={() => action.action()}
              className={cn(css['action-button'], action.primary && css['primary'])}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      
      {process.env.NODE_ENV === 'development' && (
        <details className={css['error-details']}>
          <summary>Technical Details</summary>
          <pre>{isUBAError ? JSON.stringify(error.toJSON(), null, 2) : error.stack}</pre>
        </details>
      )}
    </div>
  );
}
```

#### Error Scenarios

| Scenario | Error Class | Recovery |
|----------|-------------|----------|
| Backend URL returns 404 | `BackendUnreachableError` | Retry, check URL |
| Schema YAML syntax error | `SchemaParseError` | View raw, report |
| Schema version too new | `UnsupportedSchemaVersionError` | Update Nodegx |
| API key expired | `AuthenticationError` | Update credentials |
| Config push rejected | `ConfigRejectedError` | Show field errors |
| WebSocket disconnected | `DebugDisconnectedError` | Auto-reconnect |

#### Acceptance Criteria

- [ ] All error classes implemented
- [ ] User-friendly messages for all errors
- [ ] Recovery actions work correctly
- [ ] Error boundary catches React errors
- [ ] Development mode shows details
- [ ] Production mode hides internals

---

### UBA-019: Performance Optimization
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-019-performance`

#### Description

Optimize UBA system performance through lazy loading, memoization, virtualization, and efficient caching.

#### Performance Goals

| Metric | Target | Method |
|--------|--------|--------|
| Schema parse time | < 50ms | Optimize parser |
| Config panel render | < 100ms | Lazy load fields |
| Field type switch | < 16ms | Memoization |
| Debug event render | < 5ms | Virtualization |
| Memory (1000 events) | < 50MB | Ring buffer |

#### Key Optimizations

##### 1. Lazy Loading Field Renderers

```typescript
// fields/index.ts
const fieldComponents: Record<string, React.LazyExoticComponent<any>> = {
  string: React.lazy(() => import('./StringField')),
  text: React.lazy(() => import('./TextField')),
  number: React.lazy(() => import('./NumberField')),
  // Complex types loaded only when needed
  field_mapping: React.lazy(() => import('./FieldMappingField')),
  prompt: React.lazy(() => import('./PromptField')),
  code: React.lazy(() => import('./CodeField')),
};

export function FieldRenderer({ field, ...props }: FieldRendererProps) {
  const Component = fieldComponents[field.type] || fieldComponents.string;
  
  return (
    <React.Suspense fallback={<FieldSkeleton />}>
      <Component field={field} {...props} />
    </React.Suspense>
  );
}
```

##### 2. Memoized Components

```typescript
// ConfigSection.tsx
export const ConfigSection = React.memo(function ConfigSection({
  section, values, errors, onChange, disabled
}: ConfigSectionProps) {
  const visibility = useMemo(
    () => calculateVisibility(section.fields, values),
    [section.fields, values]
  );
  
  const handleFieldChange = useCallback(
    (fieldId: string) => (value: any) => onChange(`${section.id}.${fieldId}`, value),
    [section.id, onChange]
  );
  
  return (
    <div className={css['section']}>
      {section.fields.map(field => (
        visibility.get(field.id)?.visible && (
          <MemoizedFieldRenderer
            key={field.id}
            field={field}
            value={getNestedValue(values, `${section.id}.${field.id}`)}
            onChange={handleFieldChange(field.id)}
            error={errors[`${section.id}.${field.id}`]}
            disabled={disabled}
          />
        )
      ))}
    </div>
  );
});
```

##### 3. Virtualized Debug Event List

```typescript
// DebugEventTree.tsx
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

export function DebugEventTree({ events, eventSchema }: DebugEventTreeProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  
  const getItemSize = useCallback((index: number) => {
    const event = events[index];
    return expandedEvents.has(event.id) ? 200 : 48;
  }, [events, expandedEvents]);
  
  return (
    <AutoSizer>
      {({ height, width }) => (
        <VariableSizeList
          height={height}
          width={width}
          itemCount={events.length}
          itemSize={getItemSize}
          overscanCount={5}
        >
          {({ index, style }) => (
            <div style={style}>
              <DebugEventItem
                event={events[index]}
                expanded={expandedEvents.has(events[index].id)}
                onToggle={() => toggleExpand(events[index].id)}
              />
            </div>
          )}
        </VariableSizeList>
      )}
    </AutoSizer>
  );
}
```

##### 4. Schema Caching with ETag

```typescript
// SchemaCache.ts
export class SchemaCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl = 24 * 60 * 60 * 1000; // 24 hours
  
  async fetchWithCache(url: string, auth?: AuthConfig): Promise<UBASchema> {
    const cached = this.cache.get(url);
    
    const headers: HeadersInit = { ...buildAuthHeaders(auth) };
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }
    
    const response = await fetch(url, { headers });
    
    if (response.status === 304 && cached) {
      return cached.schema; // Not modified
    }
    
    const rawYaml = await response.text();
    const schema = parseSchema(rawYaml);
    const etag = response.headers.get('ETag') || undefined;
    
    this.cache.set(url, { schema, fetchedAt: Date.now(), etag });
    return schema;
  }
}
```

#### Performance Tests

```typescript
describe('UBA Performance', () => {
  it('parses complex schema in < 50ms', async () => {
    const start = performance.now();
    await parseSchema(complexSchemaYaml);
    expect(performance.now() - start).toBeLessThan(50);
  });
  
  it('renders config panel in < 100ms', async () => {
    const start = performance.now();
    render(<ConfigPanel schema={complexSchema} />);
    await waitFor(() => screen.getByRole('tablist'));
    expect(performance.now() - start).toBeLessThan(100);
  });
  
  it('handles 1000 debug events without memory leak', () => {
    const store = new DebugStore({ maxEvents: 1000 });
    for (let i = 0; i < 2000; i++) {
      store.addEvent(generateMockEvent(i));
    }
    expect(store.getAllEvents().length).toBe(1000);
  });
});
```

#### Acceptance Criteria

- [ ] Lazy loading implemented
- [ ] Component memoization applied
- [ ] Debug list virtualized
- [ ] Schema caching with ETag
- [ ] Performance benchmarks pass

---

### UBA-020: Backend Services Integration
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-020-backend-integration`

#### Description

Integrate UBA backends into the existing Backend Services panel for a unified experience.

#### Integration Points

1. **Backend List** - UBA backends appear alongside Directus, Supabase
2. **Add Backend Dialog** - "Schema-Configured Backend" option
3. **Config Button** - Opens UBA Config Panel
4. **Debug Button** - Opens Debug Panel (if supported)
5. **Health Status** - Show connection status

#### Implementation

```typescript
// BackendPanel.tsx (updated)
export function BackendPanel() {
  const { directusBackends, supabaseBackends } = useBYOBBackends();
  const { ubaBackends } = useUBABackends();
  
  return (
    <div className={css['backend-panel']}>
      <section className={css['section']}>
        <h3>Data Backends</h3>
        <BackendList backends={[...directusBackends, ...supabaseBackends]} />
      </section>
      
      <section className={css['section']}>
        <h3>Schema-Configured Backends</h3>
        {ubaBackends.length === 0 ? (
          <EmptyState message="No schema-configured backends" />
        ) : (
          ubaBackends.map(backend => (
            <UBABackendItem
              key={backend.id}
              backend={backend}
              onConfigure={() => openConfigPanel(backend)}
              onDebug={() => openDebugPanel(backend)}
            />
          ))
        )}
      </section>
      
      <Button onClick={openAddDialog}>
        <IconPlus /> Add Backend
      </Button>
    </div>
  );
}

// UBABackendItem.tsx
export function UBABackendItem({ backend, onConfigure, onDebug, onRemove }) {
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');
  
  useEffect(() => {
    checkHealth(backend).then(setHealthStatus);
  }, [backend]);
  
  return (
    <div className={css['backend-item']}>
      <div className={css['backend-info']}>
        <h4>{backend.schema.backend.name}</h4>
        <p>{backend.url}</p>
        <HealthBadge status={healthStatus} />
      </div>
      
      <div className={css['actions']}>
        <Button onClick={onConfigure}><IconSettings /></Button>
        {backend.schema.debug?.enabled && (
          <Button onClick={onDebug}><IconBug /></Button>
        )}
        <Button onClick={onRemove}><IconTrash /></Button>
      </div>
    </div>
  );
}
```

#### Acceptance Criteria

- [ ] UBA backends appear in panel
- [ ] Add dialog includes UBA option
- [ ] Configure opens Config Panel
- [ ] Debug opens Debug Panel
- [ ] Health status displayed

---

### UBA-021: Documentation
**Effort:** 4 days  
**Assignee:** TBD  
**Branch:** `feature/uba-021-documentation`

#### Description

Create comprehensive documentation for UBA.

#### Documentation Structure

```
docs/uba/
├── README.md                      # Overview and quick start
├── schema-specification.md        # Complete schema reference
├── field-types.md                 # All field types with examples
├── backend-implementation.md      # How to make backends UBA-compatible
├── tutorials/
│   ├── first-backend.md           # Create your first UBA backend
│   ├── field-mapping.md           # Using field mappings
│   ├── debug-integration.md       # Adding debug support
│   └── advanced-validation.md     # Custom validation
├── api-reference/
│   ├── endpoints.md               # Required and optional endpoints
│   ├── events.md                  # Debug event format
│   └── responses.md               # Response formats
└── troubleshooting.md             # Common issues and solutions
```

#### Key Content

##### Quick Start (README.md)

```markdown
# Universal Backend Adapter (UBA)

Connect any backend to Nodegx with a simple YAML schema.

## Quick Start

### 1. Create Schema

```yaml
schema_version: "1.0"
backend:
  id: "my-backend"
  name: "My Backend"
  version: "1.0.0"
  endpoints:
    config: "/nodegx/config"
sections:
  - id: "settings"
    fields:
      - id: "api_key"
        type: "secret"
        name: "API Key"
        required: true
```

### 2. Serve Schema

```python
@app.get("/.well-known/nodegx-schema.yaml")
async def get_schema():
    return FileResponse("nodegx-schema.yaml")
```

### 3. Implement Config Endpoint

```python
@app.post("/nodegx/config")
async def apply_config(request: ConfigRequest):
    # Apply configuration
    return {"success": True, "applied_at": datetime.utcnow().isoformat()}
```

[Full Guide →](./backend-implementation.md)
```

##### Backend Implementation Guide

- Python/FastAPI example
- Node.js/Express example
- Go example
- Health endpoint
- Debug stream implementation
- Testing your integration

#### Acceptance Criteria

- [ ] README with quick start
- [ ] Schema specification complete
- [ ] All field types documented
- [ ] Backend guide with examples
- [ ] 4+ tutorials
- [ ] API reference
- [ ] Troubleshooting guide

---

### UBA-022: Example Schemas
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-022-examples`

#### Description

Create example schemas for common backend types.

#### Examples

1. **Minimal** - Simplest possible schema
2. **AI Agent** - Full-featured with debug
3. **Analytics** - Event tracking backend
4. **Webhook Handler** - With code field

```yaml
# examples/minimal.yaml
schema_version: "1.0"
backend:
  id: "minimal"
  name: "Minimal Backend"
  version: "1.0.0"
  endpoints:
    config: "/config"
sections:
  - id: "settings"
    name: "Settings"
    fields:
      - id: "enabled"
        type: "boolean"
        name: "Enabled"
        default: true
```

```yaml
# examples/ai-agent.yaml
schema_version: "1.0"
backend:
  id: "ai-agent"
  name: "AI Agent"
  version: "1.0.0"
  endpoints:
    config: "/nodegx/config"
    health: "/health"
    debug_stream: "/nodegx/debug"
  capabilities:
    hot_reload: true
    debug: true
sections:
  - id: "llm"
    name: "Language Model"
    fields:
      - id: "provider"
        type: "select"
        options:
          - value: "anthropic"
            label: "Anthropic"
          - value: "openai"
            label: "OpenAI"
      - id: "api_key"
        type: "secret"
        required: true
      - id: "temperature"
        type: "slider"
        min: 0
        max: 2
        default: 0.7
  - id: "tools"
    name: "Tools"
    fields:
      - id: "web_search"
        type: "tool_toggle"
        name: "Web Search"
        default: true
  - id: "prompts"
    name: "Prompts"
    fields:
      - id: "system"
        type: "prompt"
        variables:
          - name: "agent_name"
            source: "project.name"
debug:
  enabled: true
  event_schema:
    - id: "agent_step"
      fields:
        - id: "step"
          type: "string"
        - id: "duration_ms"
          type: "number"
          format: "duration"
```

#### Acceptance Criteria

- [ ] Minimal example
- [ ] AI Agent example
- [ ] Analytics example
- [ ] Webhook example
- [ ] All validate correctly

---

## Phase 6D Checklist

### UBA-018: Error Handling
- [ ] Error class hierarchy
- [ ] All error types
- [ ] Error boundary
- [ ] Error display
- [ ] Recovery actions

### UBA-019: Performance
- [ ] Lazy loading
- [ ] Memoization
- [ ] Virtualization
- [ ] Caching
- [ ] Benchmarks pass

### UBA-020: Integration
- [ ] Backend panel updated
- [ ] UBA backend item
- [ ] Add dialog option
- [ ] Panel connections

### UBA-021: Documentation
- [ ] README
- [ ] Schema spec
- [ ] Field types
- [ ] Backend guide
- [ ] Tutorials
- [ ] API reference

### UBA-022: Examples
- [ ] Minimal
- [ ] AI Agent
- [ ] Analytics
- [ ] Webhook

---

## Success Criteria

- [ ] All errors handled gracefully
- [ ] Performance benchmarks pass
- [ ] Documentation complete
- [ ] Examples validated
