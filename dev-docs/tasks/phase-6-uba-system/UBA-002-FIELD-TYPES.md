# Phase 6B: UBA Field Types

## Complex, Special, and Integration Field Types

**Phase:** 6B of 6  
**Duration:** 3 weeks (15 working days)  
**Priority:** HIGH  
**Status:** NOT STARTED  
**Depends On:** Phase 6A complete

---

## Overview

Phase 6B implements all remaining field types beyond the basic types from Phase 6A. This includes complex interactive types (field mapping, key-value editors), special-purpose types (prompts, code editors), and integration types that connect to existing BYOB backends.

By the end of this phase, the UBA system will support the full range of configuration scenarios needed for sophisticated backends like the Erleah AI Agent.

### Field Type Categories

| Category | Types | Purpose |
|----------|-------|---------|
| **Complex** | `field_mapping`, `key_value`, `array`, `object`, `tool_toggle` | Structured data editing |
| **Special** | `prompt`, `code`, `file_upload`, `slider`, `color`, `schedule` | Domain-specific editing |
| **Integration** | `backend_reference`, `directus_collection`, `directus_field`, `qdrant_collection` | BYOB connections |

---

## Goals

1. **Implement complex field types** - Interactive editors for structured data
2. **Implement special field types** - Domain-specific editors with rich UX
3. **Implement integration types** - Connect to existing BYOB backends
4. **Build dynamic options system** - Fetch options from backend endpoints
5. **Complete validation system** - Client and server-side validation
6. **Implement conditional visibility** - Show/hide fields based on conditions

---

## Prerequisites

- Phase 6A complete ✅
- Basic field types working ✅
- Config panel shell working ✅
- BYOB system functional ✅

---

## Task Breakdown

### UBA-008: Complex Field Types
**Effort:** 5 days  
**Assignee:** TBD  
**Branch:** `feature/uba-008-complex-fields`

#### Description

Implement field types for editing structured data: mappings, key-value pairs, arrays, nested objects, and tool toggles with nested configuration.

#### Field Types

##### 1. Field Mapping (`field_mapping`)

Two-column interface for mapping source fields to target fields.

```yaml
# Schema example
- id: "attendee_mappings"
  type: "field_mapping"
  name: "Attendee Field Mappings"
  
  source:
    type: "directus_fields"
    backend_field: "primary_backend"
    collection_field: "attendee_collection"
    
  targets:
    - id: "name"
      name: "Full Name"
      required: true
    - id: "email"
      name: "Email"
      required: true
    - id: "bio"
      name: "Biography"
      hint: "Used for semantic search"
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ Attendee Field Mappings                                 │
│ Map your Directus fields to agent expectations          │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬─────────────────────────────┐  │
│ │ Agent Field         │ Your Field                  │  │
│ ├─────────────────────┼─────────────────────────────┤  │
│ │ Full Name *         │ [full_name            ▼]    │  │
│ │ Email *             │ [email_address        ▼]    │  │
│ │ Biography           │ [bio                  ▼]    │  │
│ │   ℹ️ Used for semantic search                      │  │
│ │ Tags                │ [interests            ▼]    │  │
│ └─────────────────────┴─────────────────────────────┘  │
│                                                         │
│ ⚠️ 2 required fields not mapped                         │
└─────────────────────────────────────────────────────────┘
```

##### 2. Key-Value (`key_value`)

Dynamic list of key-value pairs.

```yaml
- id: "custom_headers"
  type: "key_value"
  name: "Custom Headers"
  key_placeholder: "Header name"
  value_placeholder: "Header value"
  key_validation:
    pattern: "^X-[A-Za-z-]+$"
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ Custom Headers                                          │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────┬─────────────────────┬───┐      │
│ │ X-Custom-Auth       │ token123            │ × │      │
│ ├─────────────────────┼─────────────────────┼───┤      │
│ │ X-Request-ID        │ {{request_id}}      │ × │      │
│ ├─────────────────────┼─────────────────────┼───┤      │
│ │ Header name         │ Header value        │   │      │
│ └─────────────────────┴─────────────────────┴───┘      │
│                                       [+ Add Header]    │
└─────────────────────────────────────────────────────────┘
```

##### 3. Array (`array`)

List of values with add/remove/reorder.

```yaml
- id: "allowed_origins"
  type: "array"
  name: "Allowed Origins"
  item_type: "url"
  min_items: 1
  max_items: 10
```

##### 4. Object (`object`)

Nested fieldset that contains other fields.

```yaml
- id: "advanced"
  type: "object"
  name: "Advanced Settings"
  collapsed: true
  fields:
    - id: "timeout"
      type: "number"
      name: "Timeout"
      default: 30
    - id: "retries"
      type: "number"
      name: "Retries"
      default: 3
```

##### 5. Tool Toggle (`tool_toggle`)

Toggle switch with collapsible nested configuration.

```yaml
- id: "semantic_search"
  type: "tool_toggle"
  name: "Semantic Search"
  description: "AI-powered semantic search"
  icon: "search"
  default: true
  
  config:
    - id: "model"
      type: "select"
      name: "Embedding Model"
      options:
        - value: "small"
          label: "Small (faster)"
        - value: "large"
          label: "Large (better)"
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Semantic Search                               [ON]   │
│    AI-powered semantic search capabilities              │
├─────────────────────────────────────────────────────────┤
│ ▼ Configuration                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Embedding Model                                     │ │
│ │ [Small (faster)                               ▼]    │ │
│ │                                                     │ │
│ │ Similarity Threshold                                │ │
│ │ Lenient ────────●──────── Strict                   │ │
│ │                 0.7                                 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/views/UBA/fields/
├── FieldMappingField.tsx
├── FieldMappingField.module.scss
├── KeyValueField.tsx
├── KeyValueField.module.scss
├── ArrayField.tsx
├── ArrayField.module.scss
├── ObjectField.tsx
├── ObjectField.module.scss
├── ToolToggleField.tsx
└── ToolToggleField.module.scss
```

#### Implementation: FieldMappingField

```typescript
// FieldMappingField.tsx
interface FieldMappingFieldProps {
  field: FieldMappingFieldType;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  sourceOptions: SourceOption[];
  disabled?: boolean;
}

interface SourceOption {
  value: string;
  label: string;
  type?: string;
}

export function FieldMappingField({ 
  field, 
  value = {}, 
  onChange, 
  sourceOptions,
  disabled 
}: FieldMappingFieldProps) {
  const unmappedRequired = field.targets
    .filter(t => t.required && !value[t.id])
    .map(t => t.name);
  
  const handleMappingChange = (targetId: string, sourceField: string) => {
    onChange({
      ...value,
      [targetId]: sourceField
    });
  };
  
  return (
    <FieldWrapper field={field}>
      <div className={css['mapping-table']}>
        <div className={css['header-row']}>
          <div className={css['header-cell']}>Agent Field</div>
          <div className={css['header-cell']}>Your Field</div>
        </div>
        
        {field.targets.map(target => (
          <div key={target.id} className={css['mapping-row']}>
            <div className={css['target-cell']}>
              <span className={css['target-name']}>
                {target.name}
                {target.required && <span className={css['required']}>*</span>}
              </span>
              {target.hint && (
                <span className={css['target-hint']}>
                  <IconInfo size={12} /> {target.hint}
                </span>
              )}
            </div>
            
            <div className={css['source-cell']}>
              <select
                value={value[target.id] || ''}
                onChange={(e) => handleMappingChange(target.id, e.target.value)}
                disabled={disabled}
                className={cn(
                  css['source-select'],
                  target.required && !value[target.id] && css['missing-required']
                )}
              >
                <option value="">-- Select field --</option>
                {sourceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.type && ` (${opt.type})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      
      {unmappedRequired.length > 0 && (
        <div className={css['warning']}>
          <IconWarning /> {unmappedRequired.length} required field(s) not mapped: {unmappedRequired.join(', ')}
        </div>
      )}
    </FieldWrapper>
  );
}
```

#### Implementation: ToolToggleField

```typescript
// ToolToggleField.tsx
interface ToolToggleFieldProps {
  field: ToolToggleFieldType;
  value: ToolToggleValue;
  onChange: (value: ToolToggleValue) => void;
  disabled?: boolean;
}

interface ToolToggleValue {
  enabled: boolean;
  [key: string]: any;
}

export function ToolToggleField({ field, value, onChange, disabled }: ToolToggleFieldProps) {
  const [expanded, setExpanded] = useState(false);
  
  const enabled = value?.enabled ?? field.default ?? false;
  
  const handleToggle = () => {
    onChange({
      ...value,
      enabled: !enabled
    });
  };
  
  const handleConfigChange = (configId: string, configValue: any) => {
    onChange({
      ...value,
      [configId]: configValue
    });
  };
  
  const hasConfig = field.config && field.config.length > 0;
  
  return (
    <div className={cn(css['tool-toggle'], enabled && css['enabled'])}>
      <div className={css['toggle-header']}>
        <div className={css['toggle-info']}>
          {field.icon && <Icon name={field.icon} className={css['toggle-icon']} />}
          <div>
            <span className={css['toggle-name']}>{field.name}</span>
            {field.description && (
              <span className={css['toggle-description']}>{field.description}</span>
            )}
          </div>
        </div>
        
        <Toggle
          checked={enabled}
          onChange={handleToggle}
          disabled={disabled || field.depends_on_unmet}
        />
      </div>
      
      {field.depends_on_unmet && (
        <div className={css['dependency-message']}>
          <IconInfo /> {field.depends_on.message}
        </div>
      )}
      
      {enabled && hasConfig && (
        <>
          <button
            className={css['config-toggle']}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <IconChevronDown /> : <IconChevronRight />}
            Configuration
          </button>
          
          {expanded && (
            <div className={css['config-panel']}>
              {field.config.map(configField => (
                <FieldRenderer
                  key={configField.id}
                  field={configField}
                  value={value?.[configField.id]}
                  onChange={(v) => handleConfigChange(configField.id, v)}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

#### Acceptance Criteria

- [ ] Field mapping shows all targets
- [ ] Field mapping indicates required/unmapped
- [ ] Field mapping source options load correctly
- [ ] Key-value supports add/remove/edit
- [ ] Key-value validates keys
- [ ] Array supports add/remove/reorder
- [ ] Array enforces min/max items
- [ ] Object renders nested fields
- [ ] Object supports collapsed state
- [ ] Tool toggle enables/disables correctly
- [ ] Tool toggle shows/hides config
- [ ] All types integrate with form state

---

### UBA-009: Special Field Types
**Effort:** 5 days  
**Assignee:** TBD  
**Branch:** `feature/uba-009-special-fields`  
**Depends On:** UBA-008

#### Description

Implement special-purpose field types that provide rich editing experiences for specific data types like prompts, code, files, and colors.

#### Field Types

##### 1. Prompt (`prompt`)

Rich text editor with variable interpolation and preview.

```yaml
- id: "system_prompt"
  type: "prompt"
  name: "System Prompt"
  rows: 15
  
  variables:
    - name: "conference_name"
      source: "project.name"
    - name: "current_date"
      source: "system.date"
    - name: "attendee_count"
      source: "runtime"
      
  default: |
    You are an assistant for {{conference_name}}.
    Today is {{current_date}}.
```

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│ System Prompt                                           │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ You are an assistant for {{conference_name}}.       │ │
│ │ Today is {{current_date}}.                          │ │
│ │                                                     │ │
│ │ There are {{attendee_count}} registered attendees.  │ │
│ │                                                     │ │
│ │ Your role is to help users:                         │ │
│ │ - Find relevant sessions                            │ │
│ │ - Connect with other attendees                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Available Variables:                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ {{conference_name}} - Name of the conference        │ │
│ │ {{current_date}} - Today's date                     │ │
│ │ {{attendee_count}} - Number of attendees (runtime)  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                          [Preview ▶]    │
└─────────────────────────────────────────────────────────┘
```

##### 2. Code (`code`)

Code editor with syntax highlighting.

```yaml
- id: "transform_script"
  type: "code"
  name: "Transform Script"
  language: "javascript"
  rows: 20
```

##### 3. File Upload (`file_upload`)

File picker with upload handling.

```yaml
- id: "floor_plans"
  type: "file_upload"
  name: "Floor Plan Images"
  accept: ["image/png", "image/jpeg", "application/pdf"]
  multiple: true
  max_size: "10MB"
  upload_endpoint: "/nodegx/upload"
```

##### 4. Slider (`slider`)

Visual range input with optional marks.

```yaml
- id: "temperature"
  type: "slider"
  name: "Temperature"
  min: 0
  max: 2
  step: 0.1
  default: 0.7
  marks:
    - value: 0
      label: "Precise"
    - value: 1
      label: "Balanced"
    - value: 2
      label: "Creative"
```

##### 5. Color (`color`)

Color picker with format options.

```yaml
- id: "brand_color"
  type: "color"
  name: "Brand Color"
  default: "#3B82F6"
  format: "hex"
```

##### 6. Schedule (`schedule`)

Cron expression or interval configuration.

```yaml
- id: "sync_schedule"
  type: "schedule"
  name: "Sync Schedule"
  modes: ["interval", "cron"]
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/views/UBA/fields/
├── PromptField.tsx
├── PromptField.module.scss
├── CodeField.tsx
├── CodeField.module.scss
├── FileUploadField.tsx
├── FileUploadField.module.scss
├── SliderField.tsx
├── SliderField.module.scss
├── ColorField.tsx
├── ColorField.module.scss
├── ScheduleField.tsx
└── ScheduleField.module.scss
```

#### Implementation: PromptField

```typescript
// PromptField.tsx
interface PromptFieldProps {
  field: PromptFieldType;
  value: string;
  onChange: (value: string) => void;
  runtimeValues?: Record<string, any>;
  projectValues?: Record<string, any>;
  disabled?: boolean;
}

export function PromptField({ 
  field, 
  value, 
  onChange, 
  runtimeValues = {},
  projectValues = {},
  disabled 
}: PromptFieldProps) {
  const [showPreview, setShowPreview] = useState(false);
  
  // Extract variables from text
  const usedVariables = extractVariables(value || field.default || '');
  
  // Resolve variable values
  const resolvedValues = useMemo(() => {
    const values: Record<string, string> = {};
    
    for (const variable of field.variables || []) {
      switch (variable.source) {
        case 'runtime':
          values[variable.name] = runtimeValues[variable.name] ?? `[${variable.name}]`;
          break;
        case 'system.date':
          values[variable.name] = new Date().toLocaleDateString();
          break;
        case 'system.datetime':
          values[variable.name] = new Date().toLocaleString();
          break;
        default:
          if (variable.source.startsWith('project.')) {
            const key = variable.source.replace('project.', '');
            values[variable.name] = projectValues[key] ?? `[${variable.name}]`;
          }
      }
    }
    
    return values;
  }, [field.variables, runtimeValues, projectValues]);
  
  // Generate preview
  const preview = useMemo(() => {
    let text = value || field.default || '';
    
    for (const [name, val] of Object.entries(resolvedValues)) {
      text = text.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), String(val));
    }
    
    return text;
  }, [value, field.default, resolvedValues]);
  
  // Highlight variables in editor
  const highlightedValue = useMemo(() => {
    // This would integrate with a rich text editor or CodeMirror
    return value;
  }, [value]);
  
  return (
    <FieldWrapper field={field}>
      <div className={css['prompt-editor']}>
        <textarea
          value={value ?? field.default ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows || 10}
          disabled={disabled}
          className={css['prompt-textarea']}
          placeholder="Enter prompt text..."
        />
        
        {field.variables && field.variables.length > 0 && (
          <div className={css['variables-panel']}>
            <h4>Available Variables</h4>
            <ul>
              {field.variables.map(variable => (
                <li key={variable.name}>
                  <code 
                    className={css['variable-tag']}
                    onClick={() => insertVariable(variable.name)}
                    title="Click to insert"
                  >
                    {`{{${variable.name}}}`}
                  </code>
                  <span className={css['variable-description']}>
                    {variable.description}
                    {variable.source === 'runtime' && (
                      <span className={css['runtime-badge']}>runtime</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className={css['preview-toggle']}>
          <button onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
        
        {showPreview && (
          <div className={css['preview-panel']}>
            <h4>Preview</h4>
            <pre className={css['preview-text']}>{preview}</pre>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
}
```

#### Implementation: SliderField

```typescript
// SliderField.tsx
interface SliderFieldProps {
  field: SliderFieldType;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function SliderField({ field, value, onChange, disabled }: SliderFieldProps) {
  const currentValue = value ?? field.default ?? field.min;
  
  // Calculate position for marks
  const getMarkPosition = (markValue: number) => {
    return ((markValue - field.min) / (field.max - field.min)) * 100;
  };
  
  return (
    <FieldWrapper field={field}>
      <div className={css['slider-container']}>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={currentValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={css['slider-input']}
        />
        
        {field.marks && (
          <div className={css['slider-marks']}>
            {field.marks.map(mark => (
              <div
                key={mark.value}
                className={css['slider-mark']}
                style={{ left: `${getMarkPosition(mark.value)}%` }}
              >
                <span className={css['mark-tick']} />
                <span className={css['mark-label']}>{mark.label}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className={css['slider-value']}>
          <input
            type="number"
            value={currentValue}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={disabled}
            className={css['value-input']}
          />
        </div>
      </div>
    </FieldWrapper>
  );
}
```

#### Acceptance Criteria

- [ ] Prompt field shows variables panel
- [ ] Prompt field inserts variables on click
- [ ] Prompt field preview works
- [ ] Code field has syntax highlighting
- [ ] Code field supports multiple languages
- [ ] File upload shows drag-drop zone
- [ ] File upload validates file types
- [ ] File upload shows upload progress
- [ ] Slider shows marks correctly
- [ ] Slider value updates on drag
- [ ] Color picker shows color preview
- [ ] Schedule supports both interval and cron

---

### UBA-010: BYOB Integration Types
**Effort:** 4 days  
**Assignee:** TBD  
**Branch:** `feature/uba-010-byob-integration`  
**Depends On:** UBA-008

#### Description

Implement field types that integrate with the existing BYOB (Bring Your Own Backend) system, allowing UBA backends to reference configured data backends like Directus, Supabase, or Qdrant.

#### Field Types

##### 1. Backend Reference (`backend_reference`)

Select from configured BYOB backends.

```yaml
- id: "data_source"
  type: "backend_reference"
  name: "Data Source"
  backend_types: ["directus", "supabase"]
```

##### 2. Directus Collection (`directus_collection`)

Select a collection from a connected Directus backend.

```yaml
- id: "attendee_collection"
  type: "directus_collection"
  name: "Attendee Collection"
  backend_field: "data_source"  # References backend_reference field
```

##### 3. Directus Field (`directus_field`)

Select a field from a selected Directus collection.

```yaml
- id: "name_field"
  type: "directus_field"
  name: "Name Field"
  collection_field: "attendee_collection"
  field_types: ["string", "text"]  # Filter by type
```

##### 4. Qdrant Collection (`qdrant_collection`)

Select a collection from a connected Qdrant backend.

```yaml
- id: "vector_collection"
  type: "qdrant_collection"
  name: "Vector Collection"
  backend_field: "vector_db"
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/views/UBA/fields/
├── BackendReferenceField.tsx
├── DirectusCollectionField.tsx
├── DirectusFieldField.tsx
├── QdrantCollectionField.tsx
└── integration/
    ├── useBYOBBackends.ts
    ├── useDirectusSchema.ts
    └── useQdrantCollections.ts
```

#### Implementation

```typescript
// useBYOBBackends.ts
import { useBackendServices } from '@noodl-models/BackendServices';

export function useBYOBBackends(types?: string[]) {
  const backendServices = useBackendServices();
  
  return useMemo(() => {
    let backends = backendServices.getBackends();
    
    if (types && types.length > 0) {
      backends = backends.filter(b => types.includes(b.type));
    }
    
    return backends.map(b => ({
      value: b.id,
      label: `${b.name} (${b.url})`,
      type: b.type,
      url: b.url
    }));
  }, [backendServices, types]);
}

// useDirectusSchema.ts
export function useDirectusSchema(backendId: string | undefined) {
  const backendServices = useBackendServices();
  const [schema, setSchema] = useState<DirectusSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!backendId) {
      setSchema(null);
      return;
    }
    
    const backend = backendServices.getBackend(backendId);
    if (!backend || backend.type !== 'directus') {
      setSchema(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Use cached schema if available
    if (backend.schema) {
      setSchema(backend.schema);
      setLoading(false);
      return;
    }
    
    // Fetch schema from Directus
    fetchDirectusSchema(backend)
      .then(setSchema)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
      
  }, [backendId, backendServices]);
  
  return { schema, loading, error };
}

// BackendReferenceField.tsx
export function BackendReferenceField({ field, value, onChange, disabled }: BackendReferenceFieldProps) {
  const backends = useBYOBBackends(field.backend_types);
  
  if (backends.length === 0) {
    return (
      <FieldWrapper field={field}>
        <div className={css['no-backends']}>
          <IconDatabase />
          <p>No compatible backends configured.</p>
          <a href="#" onClick={openBackendServices}>Add a backend</a>
        </div>
      </FieldWrapper>
    );
  }
  
  return (
    <FieldWrapper field={field}>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={css['backend-select']}
      >
        <option value="">-- Select backend --</option>
        {backends.map(backend => (
          <option key={backend.value} value={backend.value}>
            {backend.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

// DirectusCollectionField.tsx
export function DirectusCollectionField({ 
  field, 
  value, 
  onChange, 
  formValues,
  disabled 
}: DirectusCollectionFieldProps) {
  const backendId = formValues?.[field.backend_field];
  const { schema, loading, error } = useDirectusSchema(backendId);
  
  if (!backendId) {
    return (
      <FieldWrapper field={field}>
        <div className={css['dependency-message']}>
          Select a backend first
        </div>
      </FieldWrapper>
    );
  }
  
  if (loading) {
    return (
      <FieldWrapper field={field}>
        <div className={css['loading']}>
          <Spinner size="small" /> Loading collections...
        </div>
      </FieldWrapper>
    );
  }
  
  if (error) {
    return (
      <FieldWrapper field={field} error={error}>
        <div className={css['error']}>
          Failed to load collections
        </div>
      </FieldWrapper>
    );
  }
  
  const collections = schema?.collections || [];
  
  return (
    <FieldWrapper field={field}>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={css['collection-select']}
      >
        <option value="">-- Select collection --</option>
        {collections.map(collection => (
          <option key={collection.name} value={collection.name}>
            {collection.name}
            {collection.meta?.note && ` - ${collection.meta.note}`}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
```

#### Acceptance Criteria

- [ ] Backend reference shows configured backends
- [ ] Backend reference filters by type
- [ ] Backend reference shows helpful empty state
- [ ] Directus collection loads from selected backend
- [ ] Directus collection shows loading state
- [ ] Directus collection handles errors
- [ ] Directus field loads from selected collection
- [ ] Directus field filters by type
- [ ] Qdrant collection shows available collections
- [ ] All types cascade correctly (backend → collection → field)

---

### UBA-011: Dynamic Options
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-011-dynamic-options`  
**Depends On:** UBA-010

#### Description

Implement the system for fetching select options from backend endpoints, with caching and refresh capabilities.

#### Schema Support

```yaml
- id: "model"
  type: "select"
  name: "Model"
  options_from:
    endpoint: "/nodegx/models"
    value_field: "id"
    label_field: "name"
    refresh: "on_change"  # or "manual"
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── DynamicOptions.ts
└── OptionsCache.ts
```

#### Implementation

```typescript
// DynamicOptions.ts
interface DynamicOptionsConfig {
  endpoint: string;
  value_field: string;
  label_field: string;
  refresh?: 'on_change' | 'manual';
}

interface OptionsCacheEntry {
  options: SelectOption[];
  fetchedAt: number;
  params: string;  // JSON-stringified params for cache key
}

export class DynamicOptions {
  private cache: Map<string, OptionsCacheEntry> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  async fetch(
    backendUrl: string,
    config: DynamicOptionsConfig,
    auth?: AuthConfig,
    params?: Record<string, any>
  ): Promise<SelectOption[]> {
    const cacheKey = this.buildCacheKey(backendUrl, config.endpoint, params);
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) {
      return cached.options;
    }
    
    // Fetch from backend
    const url = new URL(config.endpoint, backendUrl);
    
    // Add params to query string
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }
    
    const response = await fetch(url.toString(), {
      headers: buildAuthHeaders(auth)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch options: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform response to options
    const items = data.options || data.data || data;
    const options: SelectOption[] = items.map((item: any) => ({
      value: item[config.value_field],
      label: item[config.label_field]
    }));
    
    // Cache
    this.cache.set(cacheKey, {
      options,
      fetchedAt: Date.now(),
      params: JSON.stringify(params)
    });
    
    return options;
  }
  
  invalidate(backendUrl: string, endpoint?: string) {
    if (endpoint) {
      const prefix = this.buildCacheKey(backendUrl, endpoint, {});
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate all for this backend
      for (const key of this.cache.keys()) {
        if (key.startsWith(backendUrl)) {
          this.cache.delete(key);
        }
      }
    }
  }
  
  private buildCacheKey(backendUrl: string, endpoint: string, params?: Record<string, any>): string {
    return `${backendUrl}:${endpoint}:${JSON.stringify(params || {})}`;
  }
}

// useDynamicOptions.ts (hook)
export function useDynamicOptions(
  backendUrl: string | undefined,
  config: DynamicOptionsConfig | undefined,
  auth?: AuthConfig,
  params?: Record<string, any>
) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const dynamicOptions = useMemo(() => new DynamicOptions(), []);
  
  const refresh = useCallback(async () => {
    if (!backendUrl || !config) {
      setOptions([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dynamicOptions.fetch(backendUrl, config, auth, params);
      setOptions(result);
    } catch (err) {
      setError(err.message);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, config, auth, params, dynamicOptions]);
  
  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return { options, loading, error, refresh };
}
```

#### Acceptance Criteria

- [ ] Options fetched from backend endpoint
- [ ] Value and label fields configurable
- [ ] Options cached with TTL
- [ ] Cache invalidation works
- [ ] Manual refresh works
- [ ] Loading state shown
- [ ] Errors handled gracefully

---

### UBA-012: Validation System
**Effort:** 4 days  
**Assignee:** TBD  
**Branch:** `feature/uba-012-validation`  
**Depends On:** UBA-008

#### Description

Implement comprehensive validation for field values, including required fields, patterns, min/max, and custom validation via backend endpoints.

#### Validation Types

```yaml
# Schema examples
- id: "email"
  type: "string"
  name: "Email"
  required: true
  validation:
    pattern: "^[^@]+@[^@]+\\.[^@]+$"
    pattern_message: "Please enter a valid email address"
    
- id: "port"
  type: "number"
  name: "Port"
  validation:
    min: 1
    max: 65535
    
- id: "collection_name"
  type: "string"
  name: "Collection"
  validation:
    custom:
      endpoint: "/nodegx/validate/collection"
      debounce: 500
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── Validation.ts
├── validators/
│   ├── required.ts
│   ├── pattern.ts
│   ├── minmax.ts
│   └── custom.ts
└── hooks/
    └── useFieldValidation.ts

packages/noodl-editor/src/editor/src/views/UBA/
└── ValidationMessage.tsx
```

#### Implementation

```typescript
// Validation.ts
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export interface ValidationContext {
  field: Field;
  value: any;
  formValues: Record<string, any>;
  backendUrl?: string;
  auth?: AuthConfig;
}

export async function validateField(context: ValidationContext): Promise<ValidationResult> {
  const { field, value } = context;
  
  // Required check
  if (field.required && isEmpty(value)) {
    return { valid: false, error: 'This field is required' };
  }
  
  // Skip other validations if empty and not required
  if (isEmpty(value)) {
    return { valid: true };
  }
  
  // Type-specific validation
  if (field.validation) {
    // Pattern validation (string types)
    if (field.validation.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(String(value))) {
        return { 
          valid: false, 
          error: field.validation.pattern_message || 'Invalid format' 
        };
      }
    }
    
    // Min/Max validation (number types)
    if (typeof field.validation.min === 'number' && value < field.validation.min) {
      return { valid: false, error: `Minimum value is ${field.validation.min}` };
    }
    
    if (typeof field.validation.max === 'number' && value > field.validation.max) {
      return { valid: false, error: `Maximum value is ${field.validation.max}` };
    }
    
    // Length validation (string types)
    if (field.validation.min_length && String(value).length < field.validation.min_length) {
      return { valid: false, error: `Minimum length is ${field.validation.min_length}` };
    }
    
    if (field.validation.max_length && String(value).length > field.validation.max_length) {
      return { valid: false, error: `Maximum length is ${field.validation.max_length}` };
    }
    
    // Custom validation (async)
    if (field.validation.custom) {
      return await customValidation(context);
    }
  }
  
  return { valid: true };
}

async function customValidation(context: ValidationContext): Promise<ValidationResult> {
  const { field, value, formValues, backendUrl, auth } = context;
  const customConfig = field.validation.custom;
  
  if (!backendUrl) {
    return { valid: true }; // Skip custom validation if no backend
  }
  
  try {
    const url = new URL(customConfig.endpoint, backendUrl);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(auth)
      },
      body: JSON.stringify({
        field: field.id,
        value,
        context: formValues
      })
    });
    
    const data = await response.json();
    
    return {
      valid: data.valid,
      error: data.valid ? undefined : data.message,
      warning: data.warning
    };
  } catch (error) {
    // Don't block on validation errors
    console.warn('Custom validation failed:', error);
    return { valid: true, warning: 'Could not validate with server' };
  }
}

// useFieldValidation.ts
export function useFieldValidation(
  field: Field,
  value: any,
  formValues: Record<string, any>,
  backendUrl?: string,
  auth?: AuthConfig
) {
  const [result, setResult] = useState<ValidationResult>({ valid: true });
  const [validating, setValidating] = useState(false);
  
  // Debounce validation for custom validators
  const debounceMs = field.validation?.custom?.debounce || 300;
  
  useEffect(() => {
    let cancelled = false;
    
    const validate = async () => {
      setValidating(true);
      
      const result = await validateField({
        field,
        value,
        formValues,
        backendUrl,
        auth
      });
      
      if (!cancelled) {
        setResult(result);
        setValidating(false);
      }
    };
    
    const timeoutId = setTimeout(validate, debounceMs);
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [field, value, formValues, backendUrl, auth, debounceMs]);
  
  return { ...result, validating };
}

// validateConfig.ts - Form-level validation
export function validateConfig(
  schema: UBASchema,
  values: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};
  
  for (const section of schema.sections) {
    for (const field of section.fields) {
      const path = `${section.id}.${field.id}`;
      const value = getNestedValue(values, path);
      
      // Skip hidden fields
      if (field.visible_when && !evaluateCondition(field.visible_when, values)) {
        continue;
      }
      
      // Synchronous validation only (for form submission)
      const result = validateFieldSync(field, value);
      
      if (!result.valid) {
        errors[path] = result.error;
      }
    }
  }
  
  return errors;
}
```

#### Acceptance Criteria

- [ ] Required validation works
- [ ] Pattern validation with custom messages
- [ ] Min/max validation for numbers
- [ ] Length validation for strings
- [ ] Custom validation calls backend
- [ ] Debounce works for custom validation
- [ ] Errors displayed inline
- [ ] Form-level validation on submit
- [ ] Validation state tracked per field

---

### UBA-013: Conditional Visibility
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-013-conditions`  
**Depends On:** UBA-012

#### Description

Implement the conditional visibility system that shows/hides fields and sections based on other field values.

#### Condition Syntax

```yaml
# Field visible when another field has specific value
visible_when:
  field: "mode"
  equals: "advanced"

# Field visible when value is in list
visible_when:
  field: "provider"
  one_of: ["anthropic", "openai"]

# Field visible when another field is truthy
visible_when:
  field: "enable_feature"
  is_truthy: true

# Field visible when another field is not a value
visible_when:
  field: "type"
  not_equals: "disabled"

# Dependency with message
depends_on:
  field: "api_key"
  condition: "is_not_empty"
  message: "Enter an API key first"
```

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── Conditions.ts
└── hooks/
    └── useConditions.ts
```

#### Implementation

```typescript
// Conditions.ts
export interface Condition {
  field: string;
  equals?: any;
  not_equals?: any;
  one_of?: any[];
  is_truthy?: boolean;
  is_not_empty?: boolean;
}

export interface Dependency {
  field: string;
  condition: 'is_truthy' | 'is_not_empty' | 'equals' | 'is_mapped';
  value?: any;
  message: string;
}

export function evaluateCondition(
  condition: Condition | undefined, 
  values: Record<string, any>
): boolean {
  if (!condition) return true;
  
  const fieldValue = getNestedValue(values, condition.field);
  
  if ('equals' in condition) {
    return fieldValue === condition.equals;
  }
  
  if ('not_equals' in condition) {
    return fieldValue !== condition.not_equals;
  }
  
  if ('one_of' in condition && Array.isArray(condition.one_of)) {
    return condition.one_of.includes(fieldValue);
  }
  
  if ('is_truthy' in condition) {
    return condition.is_truthy ? Boolean(fieldValue) : !fieldValue;
  }
  
  if ('is_not_empty' in condition) {
    return !isEmpty(fieldValue);
  }
  
  return true;
}

export function evaluateDependency(
  dependency: Dependency | undefined,
  values: Record<string, any>
): { met: boolean; message?: string } {
  if (!dependency) return { met: true };
  
  const fieldValue = getNestedValue(values, dependency.field);
  let met = false;
  
  switch (dependency.condition) {
    case 'is_truthy':
      met = Boolean(fieldValue);
      break;
    case 'is_not_empty':
      met = !isEmpty(fieldValue);
      break;
    case 'equals':
      met = fieldValue === dependency.value;
      break;
    case 'is_mapped':
      // For field_mapping type, check if the target is mapped
      met = typeof fieldValue === 'string' && fieldValue.length > 0;
      break;
  }
  
  return {
    met,
    message: met ? undefined : dependency.message
  };
}

// useConditions.ts
export function useConditions(
  fields: Field[],
  values: Record<string, any>
): Map<string, FieldVisibility> {
  return useMemo(() => {
    const visibility = new Map<string, FieldVisibility>();
    
    for (const field of fields) {
      const visible = evaluateCondition(field.visible_when, values);
      const dependency = evaluateDependency(field.depends_on, values);
      
      visibility.set(field.id, {
        visible,
        enabled: visible && dependency.met,
        dependencyMessage: dependency.message
      });
    }
    
    return visibility;
  }, [fields, values]);
}

interface FieldVisibility {
  visible: boolean;
  enabled: boolean;
  dependencyMessage?: string;
}
```

#### Updated ConfigSection

```typescript
// ConfigSection.tsx (updated)
export function ConfigSection({ section, values, errors, onChange, disabled }: ConfigSectionProps) {
  const visibility = useConditions(section.fields, values);
  
  return (
    <div className={css['section']}>
      <div className={css['section-header']}>
        {section.icon && <Icon name={section.icon} />}
        <h3>{section.name}</h3>
        {section.description && <p>{section.description}</p>}
      </div>
      
      <div className={css['section-fields']}>
        {section.fields.map(field => {
          const fieldVisibility = visibility.get(field.id);
          
          if (!fieldVisibility?.visible) {
            return null;
          }
          
          const path = `${section.id}.${field.id}`;
          
          return (
            <div 
              key={field.id} 
              className={cn(
                css['field-container'],
                !fieldVisibility.enabled && css['disabled']
              )}
            >
              {fieldVisibility.dependencyMessage && (
                <div className={css['dependency-message']}>
                  <IconInfo /> {fieldVisibility.dependencyMessage}
                </div>
              )}
              
              <FieldRenderer
                field={field}
                value={getNestedValue(values, path)}
                onChange={(value) => onChange(path, value)}
                error={errors[path]}
                disabled={disabled || !fieldVisibility.enabled}
                formValues={values}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### Acceptance Criteria

- [ ] `visible_when` hides/shows fields
- [ ] `equals` condition works
- [ ] `not_equals` condition works
- [ ] `one_of` condition works
- [ ] `is_truthy` condition works
- [ ] `depends_on` shows message
- [ ] `depends_on` disables field
- [ ] Section visibility works
- [ ] Cascading visibility works
- [ ] No infinite loops with circular conditions

---

## Phase 6B Checklist

### UBA-008: Complex Field Types
- [ ] FieldMappingField component
- [ ] KeyValueField component
- [ ] ArrayField component
- [ ] ObjectField component
- [ ] ToolToggleField component
- [ ] Unit tests for each
- [ ] Storybook stories

### UBA-009: Special Field Types
- [ ] PromptField with variables
- [ ] CodeField with syntax highlighting
- [ ] FileUploadField with drag-drop
- [ ] SliderField with marks
- [ ] ColorField with picker
- [ ] ScheduleField with modes
- [ ] Unit tests for each
- [ ] Storybook stories

### UBA-010: BYOB Integration Types
- [ ] BackendReferenceField
- [ ] DirectusCollectionField
- [ ] DirectusFieldField
- [ ] QdrantCollectionField
- [ ] Integration hooks
- [ ] Unit tests

### UBA-011: Dynamic Options
- [ ] DynamicOptions service
- [ ] Options caching
- [ ] useDynamicOptions hook
- [ ] Integration tests

### UBA-012: Validation System
- [ ] Required validation
- [ ] Pattern validation
- [ ] Min/max validation
- [ ] Custom validation
- [ ] Form-level validation
- [ ] useFieldValidation hook
- [ ] ValidationMessage component

### UBA-013: Conditional Visibility
- [ ] evaluateCondition function
- [ ] evaluateDependency function
- [ ] useConditions hook
- [ ] ConfigSection updates
- [ ] Edge case handling

### Integration
- [ ] All field types in FieldRenderer
- [ ] Full schema test with Erleah
- [ ] Performance testing
- [ ] Accessibility review

---

## Success Criteria

### Functional
- [ ] All 25+ field types render correctly
- [ ] Validation prevents invalid configs
- [ ] Conditional visibility works smoothly
- [ ] BYOB integration loads data
- [ ] Dynamic options cache efficiently

### Performance
- [ ] Field rendering < 50ms each
- [ ] No lag with many fields
- [ ] Options fetching doesn't block UI

### Quality
- [ ] Test coverage > 80%
- [ ] No TypeScript errors
- [ ] Accessible components
- [ ] Consistent UX across types

---

## Notes

- Reuse existing UI components where possible (Select, Toggle, etc.)
- Consider code splitting for complex field types
- Document each field type thoroughly
- Create example schemas demonstrating each type
