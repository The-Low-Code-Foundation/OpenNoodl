# Phase 6A: UBA Foundation

## Schema Parser, Basic Fields, and Core Infrastructure

**Phase:** 6A of 6  
**Duration:** 3 weeks (15 working days)  
**Priority:** CRITICAL (blocks all other UBA phases)  
**Status:** NOT STARTED

---

## Overview

Phase 6A establishes the core infrastructure for the Universal Backend Adapter system. This includes the schema specification, YAML parser, basic field type renderers, configuration storage, and backend communication protocol.

By the end of this phase, a developer should be able to:
1. Write a minimal UBA schema
2. Add their backend to Nodegx
3. See a configuration panel with basic fields
4. Save configuration
5. Have that configuration sent to their backend

### Success Vision

```
Developer creates:                    User sees in Nodegx:
┌─────────────────────────┐          ┌─────────────────────────┐
│ schema_version: "1.0"   │          │ My Backend        [Save]│
│ backend:                │   ───►   ├─────────────────────────┤
│   name: "My Backend"    │          │ API Key *               │
│ sections:               │          │ [•••••••••••••••]       │
│   - id: "auth"          │          │                         │
│     fields:             │          │ Environment             │
│       - id: "api_key"   │          │ [Production        ▼]   │
│         type: "secret"  │          │                         │
│       - id: "env"       │          │ Enable Debug            │
│         type: "select"  │          │ [✓]                     │
└─────────────────────────┘          └─────────────────────────┘
```

---

## Goals

1. **Define schema specification v1.0** - Complete, documented, versioned
2. **Build schema parser** - YAML parsing with validation
3. **Implement basic field renderers** - 8 core field types
4. **Create config panel shell** - Generic panel that renders any schema
5. **Implement config storage** - Save/load with encryption for secrets
6. **Build backend discovery** - Fetch schemas from URLs
7. **Implement config push** - Send configuration to backends

---

## Prerequisites

- React 19 migration complete (Phase 1) ✅
- Backend Services panel exists (BYOB) ✅
- Core UI components available ✅

---

## Task Breakdown

### UBA-001: Schema Specification v1.0
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-001-schema-spec`

#### Description

Define and document the complete YAML schema specification. This is the contract between backends and Nodegx - it must be thorough, unambiguous, and versioned.

#### Deliverables

1. **Schema Specification Document**
   - Complete YAML structure definition
   - All field types (basic + complex + special)
   - Validation rules
   - Conditional visibility syntax
   - Debug schema format

2. **JSON Schema for Validation**
   - Machine-readable schema definition
   - Used by parser for validation
   - Enables IDE autocomplete for schema authors

3. **Version Compatibility Rules**
   - How schema versions are compared
   - Backward compatibility guarantees
   - Deprecation process

#### Files to Create

```
docs/
└── uba/
    ├── schema-specification-v1.md      # Human-readable spec
    ├── schema-changelog.md             # Version history
    └── migration-guide.md              # For schema authors

packages/noodl-editor/src/editor/src/models/UBA/
└── schema-v1.json                      # JSON Schema
```

#### Specification Outline

```yaml
# Schema Structure (to be fully specified)

schema_version: "1.0"           # Required, semver

backend:                        # Required
  id: string                    # Unique identifier
  name: string                  # Display name
  description?: string          # Optional description
  version: string               # Backend version (semver)
  icon?: string                 # Icon name or URL
  homepage?: string             # Documentation URL
  
  endpoints:                    # Required
    config: string              # Config endpoint path
    health?: string             # Health check path
    debug_stream?: string       # Debug WebSocket/SSE path
    
  auth?:                        # Optional
    type: "none" | "bearer" | "api_key" | "basic"
    header?: string             # Header name
    
  capabilities?:                # Optional feature flags
    hot_reload?: boolean
    debug?: boolean
    batch_config?: boolean

sections:                       # Required, array
  - id: string                  # Section identifier
    name: string                # Display name
    description?: string
    icon?: string
    collapsed?: boolean         # Initial state
    visible_when?:              # Conditional visibility
    fields: Field[]             # Array of fields

debug?:                         # Optional debug schema
  enabled: boolean
  event_schema: DebugField[]
```

#### Acceptance Criteria

- [ ] All field types documented with examples
- [ ] Validation rules clearly specified
- [ ] JSON Schema validates example schemas correctly
- [ ] At least 3 example schemas pass validation
- [ ] Documentation reviewed by team

#### Testing

```bash
# Validate example schemas against JSON Schema
npm run test:uba-schema
```

---

### UBA-002: Schema Parser
**Effort:** 4 days  
**Assignee:** TBD  
**Branch:** `feature/uba-002-schema-parser`  
**Depends On:** UBA-001

#### Description

Build a robust YAML parser that reads schema files, validates them against the JSON Schema, and produces typed TypeScript objects for use by the UI.

#### Deliverables

1. **YAML Parser**
   - Parse YAML to JavaScript objects
   - Handle syntax errors gracefully
   - Support both string and file input

2. **Schema Validator**
   - Validate against JSON Schema
   - Detailed error messages with line numbers
   - Warning vs error distinction

3. **Type Definitions**
   - Complete TypeScript types for schema
   - Discriminated unions for field types
   - Strict typing throughout

4. **Version Handler**
   - Detect schema version
   - Apply compatibility transforms
   - Warn about deprecated features

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── types.ts                    # TypeScript type definitions
├── SchemaParser.ts             # Main parser class
├── SchemaValidator.ts          # Validation logic
├── SchemaVersionHandler.ts     # Version compatibility
└── errors.ts                   # Custom error classes
```

#### Implementation

```typescript
// types.ts
export interface UBASchema {
  schema_version: string;
  backend: BackendMetadata;
  sections: Section[];
  debug?: DebugSchema;
}

export interface BackendMetadata {
  id: string;
  name: string;
  description?: string;
  version: string;
  icon?: string;
  homepage?: string;
  endpoints: Endpoints;
  auth?: AuthConfig;
  capabilities?: Capabilities;
}

export interface Section {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  collapsed?: boolean;
  visible_when?: Condition;
  fields: Field[];
}

export type Field = 
  | StringField 
  | TextField 
  | NumberField 
  | BooleanField 
  | SecretField 
  | UrlField 
  | SelectField 
  | MultiSelectField
  // ... more field types

export interface StringField {
  type: 'string';
  id: string;
  name: string;
  description?: string;
  placeholder?: string;
  default?: string;
  required?: boolean;
  validation?: StringValidation;
  visible_when?: Condition;
  depends_on?: Dependency;
  ui?: UIHints;
}

// SchemaParser.ts
import yaml from 'js-yaml';
import Ajv from 'ajv';
import schemaV1 from './schema-v1.json';

export class SchemaParser {
  private validator: Ajv;
  
  constructor() {
    this.validator = new Ajv({ allErrors: true });
    this.validator.addSchema(schemaV1, 'uba-v1');
  }
  
  /**
   * Parse YAML string into validated schema object
   */
  parse(yamlString: string): ParseResult<UBASchema> {
    try {
      // Parse YAML
      const parsed = yaml.load(yamlString);
      
      // Validate against JSON Schema
      const valid = this.validator.validate('uba-v1', parsed);
      
      if (!valid) {
        return {
          success: false,
          errors: this.formatErrors(this.validator.errors)
        };
      }
      
      // Apply version transforms if needed
      const schema = this.applyVersionTransforms(parsed as UBASchema);
      
      return {
        success: true,
        data: schema,
        warnings: this.collectWarnings(schema)
      };
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        return {
          success: false,
          errors: [{
            path: '',
            message: error.message,
            line: error.mark?.line,
            column: error.mark?.column
          }]
        };
      }
      throw error;
    }
  }
  
  /**
   * Format AJV errors into human-readable messages
   */
  private formatErrors(errors: Ajv.ErrorObject[]): SchemaError[] {
    return errors.map(err => ({
      path: err.instancePath,
      message: this.humanizeError(err),
      keyword: err.keyword,
      params: err.params
    }));
  }
  
  private humanizeError(error: Ajv.ErrorObject): string {
    switch (error.keyword) {
      case 'required':
        return `Missing required field: ${error.params.missingProperty}`;
      case 'enum':
        return `Invalid value. Expected one of: ${error.params.allowedValues.join(', ')}`;
      case 'type':
        return `Expected ${error.params.type}, got ${typeof error.data}`;
      default:
        return error.message || 'Validation error';
    }
  }
}
```

#### Acceptance Criteria

- [ ] Parses valid YAML schemas correctly
- [ ] Returns detailed errors for invalid schemas
- [ ] Handles YAML syntax errors gracefully
- [ ] TypeScript types match schema spec exactly
- [ ] Version detection works correctly
- [ ] 100% test coverage for parser

#### Test Cases

```typescript
// SchemaParser.test.ts
describe('SchemaParser', () => {
  describe('valid schemas', () => {
    it('parses minimal schema', () => {
      const schema = `
        schema_version: "1.0"
        backend:
          id: test
          name: Test Backend
          version: "1.0.0"
          endpoints:
            config: /config
        sections: []
      `;
      
      const result = parser.parse(schema);
      expect(result.success).toBe(true);
      expect(result.data.backend.name).toBe('Test Backend');
    });
    
    it('parses schema with all field types', () => { /* ... */ });
    it('parses schema with nested objects', () => { /* ... */ });
    it('parses schema with conditions', () => { /* ... */ });
  });
  
  describe('invalid schemas', () => {
    it('reports missing required fields', () => {
      const schema = `
        schema_version: "1.0"
        backend:
          name: Test
      `;
      
      const result = parser.parse(schema);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('id');
    });
    
    it('reports invalid field type', () => { /* ... */ });
    it('reports YAML syntax errors with line numbers', () => { /* ... */ });
  });
  
  describe('version handling', () => {
    it('detects schema version', () => { /* ... */ });
    it('warns about deprecated features', () => { /* ... */ });
  });
});
```

---

### UBA-003: Basic Field Renderers
**Effort:** 5 days  
**Assignee:** TBD  
**Branch:** `feature/uba-003-basic-fields`  
**Depends On:** UBA-002

#### Description

Implement React components that render basic field types. Each renderer receives field configuration and produces appropriate UI with validation.

#### Field Types to Implement

| Type | Component | Notes |
|------|-----------|-------|
| `string` | `StringField` | Single-line text input |
| `text` | `TextField` | Multi-line textarea |
| `number` | `NumberField` | Number input with min/max/step |
| `boolean` | `BooleanField` | Toggle switch |
| `secret` | `SecretField` | Masked input, show/hide toggle |
| `url` | `UrlField` | URL input with validation |
| `select` | `SelectField` | Dropdown single-select |
| `multi_select` | `MultiSelectField` | Multi-select with tags |

#### Files to Create

```
packages/noodl-editor/src/editor/src/views/UBA/
├── fields/
│   ├── index.ts                    # Barrel export
│   ├── FieldRenderer.tsx           # Factory component
│   ├── FieldWrapper.tsx            # Common wrapper (label, description, error)
│   ├── StringField.tsx
│   ├── TextField.tsx
│   ├── NumberField.tsx
│   ├── BooleanField.tsx
│   ├── SecretField.tsx
│   ├── UrlField.tsx
│   ├── SelectField.tsx
│   └── MultiSelectField.tsx
├── fields.module.scss              # Shared field styles
└── hooks/
    └── useFieldValidation.ts       # Validation hook
```

#### Implementation Pattern

```typescript
// FieldWrapper.tsx
interface FieldWrapperProps {
  field: BaseField;
  error?: string;
  warning?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ field, error, warning, children }: FieldWrapperProps) {
  return (
    <div className={css['field-wrapper']} data-field-id={field.id}>
      <label className={css['field-label']}>
        {field.name}
        {field.required && <span className={css['required']}>*</span>}
      </label>
      
      {field.description && (
        <p className={css['field-description']}>{field.description}</p>
      )}
      
      {children}
      
      {error && (
        <p className={css['field-error']}>{error}</p>
      )}
      
      {warning && (
        <p className={css['field-warning']}>{warning}</p>
      )}
      
      {field.ui?.help_link && (
        <a href={field.ui.help_link} target="_blank" className={css['help-link']}>
          Learn more ↗
        </a>
      )}
    </div>
  );
}

// StringField.tsx
interface StringFieldProps {
  field: StringField;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export function StringField({ field, value, onChange, onBlur, error, disabled }: StringFieldProps) {
  return (
    <FieldWrapper field={field} error={error}>
      <input
        type="text"
        value={value ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={field.placeholder}
        disabled={disabled}
        className={css['text-input']}
        maxLength={field.validation?.max_length}
      />
    </FieldWrapper>
  );
}

// SecretField.tsx
export function SecretField({ field, value, onChange, error, disabled }: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  
  return (
    <FieldWrapper field={field} error={error}>
      <div className={css['secret-input-wrapper']}>
        <input
          type={visible ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? '••••••••••••'}
          disabled={disabled}
          className={css['text-input']}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className={css['visibility-toggle']}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </FieldWrapper>
  );
}

// FieldRenderer.tsx - Factory component
interface FieldRendererProps {
  field: Field;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function FieldRenderer({ field, value, onChange, error, disabled }: FieldRendererProps) {
  switch (field.type) {
    case 'string':
      return <StringField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    case 'text':
      return <TextField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    case 'number':
      return <NumberField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    case 'boolean':
      return <BooleanField field={field} value={value} onChange={onChange} disabled={disabled} />;
    case 'secret':
      return <SecretField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    case 'url':
      return <UrlField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    case 'select':
      return <SelectField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    case 'multi_select':
      return <MultiSelectField field={field} value={value} onChange={onChange} error={error} disabled={disabled} />;
    default:
      // Fallback for unknown types
      return <StringField field={field as any} value={value} onChange={onChange} error={error} disabled={disabled} />;
  }
}
```

#### Styling Guidelines

```scss
// fields.module.scss

.field-wrapper {
  margin-bottom: var(--spacing-md);
}

.field-label {
  display: block;
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-primary);
}

.required {
  color: var(--color-danger);
  margin-left: 2px;
}

.field-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.text-input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  
  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-alpha);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &.has-error {
    border-color: var(--color-danger);
  }
}

.field-error {
  font-size: var(--font-size-sm);
  color: var(--color-danger);
  margin-top: var(--spacing-xs);
}

.field-warning {
  font-size: var(--font-size-sm);
  color: var(--color-warning);
  margin-top: var(--spacing-xs);
}
```

#### Acceptance Criteria

- [ ] All 8 field types render correctly
- [ ] Default values applied
- [ ] Placeholder text shown
- [ ] Required indicator displayed
- [ ] Description text rendered
- [ ] Error state styling works
- [ ] Disabled state works
- [ ] Secret field masks/unmasks
- [ ] Select field shows options
- [ ] Multi-select allows multiple selections
- [ ] Consistent styling across all fields

#### Test Cases

```typescript
describe('Field Renderers', () => {
  describe('StringField', () => {
    it('renders with value', () => {
      render(<StringField field={mockField} value="test" onChange={jest.fn()} />);
      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });
    
    it('shows placeholder when empty', () => {
      const field = { ...mockField, placeholder: 'Enter text...' };
      render(<StringField field={field} value="" onChange={jest.fn()} />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });
    
    it('calls onChange when typed', () => {
      const onChange = jest.fn();
      render(<StringField field={mockField} value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
      expect(onChange).toHaveBeenCalledWith('new');
    });
    
    it('shows error message', () => {
      render(<StringField field={mockField} value="" onChange={jest.fn()} error="Required" />);
      expect(screen.getByText('Required')).toBeInTheDocument();
    });
  });
  
  describe('SecretField', () => {
    it('masks value by default', () => {
      render(<SecretField field={mockField} value="secret123" onChange={jest.fn()} />);
      expect(screen.getByDisplayValue('secret123').getAttribute('type')).toBe('password');
    });
    
    it('toggles visibility', () => {
      render(<SecretField field={mockField} value="secret123" onChange={jest.fn()} />);
      fireEvent.click(screen.getByTitle('Show'));
      expect(screen.getByDisplayValue('secret123').getAttribute('type')).toBe('text');
    });
  });
  
  // ... more tests for each field type
});
```

---

### UBA-004: Config Panel Shell
**Effort:** 4 days  
**Assignee:** TBD  
**Branch:** `feature/uba-004-config-panel`  
**Depends On:** UBA-003

#### Description

Build the main configuration panel component that reads a schema and renders sections with fields. This is the primary UI users interact with.

#### Deliverables

1. **ConfigPanel Component**
   - Tab navigation for sections
   - Section rendering with fields
   - Form state management
   - Save/Reset functionality
   - Loading states
   - Error display

2. **Section Components**
   - Section header with icon
   - Collapsible sections
   - Field grid layout

3. **Form State Hook**
   - Track field values
   - Track dirty state
   - Track validation errors
   - Handle nested objects

#### Files to Create

```
packages/noodl-editor/src/editor/src/views/UBA/
├── ConfigPanel.tsx
├── ConfigPanel.module.scss
├── ConfigSection.tsx
├── ConfigSection.module.scss
├── ConfigHeader.tsx
├── hooks/
│   ├── useConfigForm.ts
│   └── useConfigValidation.ts
└── context/
    └── ConfigContext.tsx
```

#### Implementation

```typescript
// ConfigPanel.tsx
interface ConfigPanelProps {
  schema: UBASchema;
  initialValues?: Record<string, any>;
  onSave: (values: Record<string, any>) => Promise<void>;
  onReset?: () => void;
  disabled?: boolean;
}

export function ConfigPanel({ schema, initialValues, onSave, onReset, disabled }: ConfigPanelProps) {
  const [activeSection, setActiveSection] = useState(schema.sections[0]?.id);
  const { values, errors, isDirty, setValue, setFieldError, reset } = useConfigForm(schema, initialValues);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const handleSave = async () => {
    // Validate all fields
    const validationErrors = validateConfig(schema, values);
    if (Object.keys(validationErrors).length > 0) {
      Object.entries(validationErrors).forEach(([field, error]) => {
        setFieldError(field, error);
      });
      return;
    }
    
    setSaving(true);
    setSaveError(null);
    
    try {
      await onSave(values);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleReset = () => {
    reset();
    onReset?.();
  };
  
  // Filter visible sections
  const visibleSections = schema.sections.filter(section => 
    evaluateCondition(section.visible_when, values)
  );
  
  return (
    <div className={css['config-panel']}>
      <ConfigHeader
        backend={schema.backend}
        isDirty={isDirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        disabled={disabled}
      />
      
      {saveError && (
        <div className={css['save-error']}>
          <IconAlert /> {saveError}
        </div>
      )}
      
      <div className={css['section-tabs']}>
        {visibleSections.map(section => (
          <button
            key={section.id}
            className={cn(css['tab'], activeSection === section.id && css['active'])}
            onClick={() => setActiveSection(section.id)}
          >
            {section.icon && <Icon name={section.icon} />}
            {section.name}
            {hasErrors(errors, section.id) && <span className={css['error-badge']} />}
          </button>
        ))}
      </div>
      
      <div className={css['section-content']}>
        {visibleSections.map(section => (
          <ConfigSection
            key={section.id}
            section={section}
            values={values}
            errors={errors}
            onChange={setValue}
            visible={activeSection === section.id}
            disabled={disabled || saving}
          />
        ))}
      </div>
    </div>
  );
}

// useConfigForm.ts
export function useConfigForm(schema: UBASchema, initialValues?: Record<string, any>) {
  const [values, setValues] = useState<Record<string, any>>(() => 
    buildInitialValues(schema, initialValues)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialSnapshot] = useState(() => JSON.stringify(values));
  
  const isDirty = useMemo(() => 
    JSON.stringify(values) !== initialSnapshot,
    [values, initialSnapshot]
  );
  
  const setValue = useCallback((path: string, value: any) => {
    setValues(prev => setNestedValue(prev, path, value));
    // Clear error when value changes
    setErrors(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);
  
  const setFieldError = useCallback((path: string, error: string) => {
    setErrors(prev => ({ ...prev, [path]: error }));
  }, []);
  
  const reset = useCallback(() => {
    setValues(buildInitialValues(schema, initialValues));
    setErrors({});
  }, [schema, initialValues]);
  
  return { values, errors, isDirty, setValue, setFieldError, reset };
}

// Helper: Build initial values from schema defaults
function buildInitialValues(schema: UBASchema, provided?: Record<string, any>): Record<string, any> {
  const values: Record<string, any> = {};
  
  for (const section of schema.sections) {
    for (const field of section.fields) {
      const path = `${section.id}.${field.id}`;
      const providedValue = getNestedValue(provided, path);
      
      if (providedValue !== undefined) {
        setNestedValue(values, path, providedValue);
      } else if (field.default !== undefined) {
        setNestedValue(values, path, field.default);
      }
    }
  }
  
  return values;
}
```

#### UI Mockup

```
┌─────────────────────────────────────────────────────────┐
│  Erleah AI Agent                      [Reset] [Save]    │
│  agent.example.com • v1.0.0 • ● Connected               │
├─────────────────────────────────────────────────────────┤
│  [Data Sources] [Vector DB] [Tools●] [LLM] [Prompts]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🗄️ Data Sources                                 │   │
│  │    Configure where your data comes from          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Primary Backend *                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Directus (conference.directus.app)          ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Attendee Collection *                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ attendees                                    ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ▼ Field Mappings                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Map your Directus fields to agent expectations   │   │
│  │ ... (field mapping UI would go here)            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Acceptance Criteria

- [ ] Section tabs display and switch correctly
- [ ] Fields render based on schema
- [ ] Form values tracked correctly
- [ ] Dirty state detected
- [ ] Save button enabled only when dirty
- [ ] Reset restores initial values
- [ ] Loading state during save
- [ ] Error display on save failure
- [ ] Nested field paths work (section.field)
- [ ] Keyboard navigation works

---

### UBA-005: Config Storage
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-005-config-storage`  
**Depends On:** UBA-004

#### Description

Implement storage for backend configurations within Nodegx projects. Secrets must be encrypted. Configurations should support environment-specific values.

#### Deliverables

1. **Config Storage Manager**
   - Save config to project metadata
   - Load config from project
   - Encrypt/decrypt secrets

2. **Secret Manager**
   - AES encryption for secrets
   - Key derivation from project key
   - Never expose secrets in logs/exports

3. **Environment Support**
   - Development vs Production configs
   - Environment variable substitution

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── ConfigStorage.ts
├── SecretManager.ts
└── EnvironmentConfig.ts
```

#### Implementation

```typescript
// ConfigStorage.ts
import { ProjectModel } from '@noodl-models/projectmodel';
import { SecretManager } from './SecretManager';

interface StoredConfig {
  values: Record<string, any>;
  encryptedSecrets: Record<string, string>;
  environment: string;
  lastUpdated: string;
}

export class ConfigStorage {
  private secretManager: SecretManager;
  
  constructor(private project: ProjectModel) {
    this.secretManager = new SecretManager(project);
  }
  
  /**
   * Save configuration for a backend
   */
  async save(backendId: string, config: Record<string, any>, secretPaths: string[]): Promise<void> {
    // Separate secrets from regular values
    const { values, secrets } = this.separateSecrets(config, secretPaths);
    
    // Encrypt secrets
    const encryptedSecrets: Record<string, string> = {};
    for (const [path, value] of Object.entries(secrets)) {
      encryptedSecrets[path] = await this.secretManager.encrypt(value);
    }
    
    // Store in project metadata
    const stored: StoredConfig = {
      values,
      encryptedSecrets,
      environment: this.getEnvironment(),
      lastUpdated: new Date().toISOString()
    };
    
    this.project.setMetaData(`uba.${backendId}`, stored);
    await this.project.save();
  }
  
  /**
   * Load configuration for a backend
   */
  async load(backendId: string): Promise<Record<string, any> | null> {
    const stored = this.project.getMetaData(`uba.${backendId}`) as StoredConfig | undefined;
    
    if (!stored) {
      return null;
    }
    
    // Decrypt secrets
    const decryptedSecrets: Record<string, string> = {};
    for (const [path, encrypted] of Object.entries(stored.encryptedSecrets)) {
      try {
        decryptedSecrets[path] = await this.secretManager.decrypt(encrypted);
      } catch (error) {
        console.error(`Failed to decrypt secret at ${path}:`, error);
        decryptedSecrets[path] = ''; // Empty on failure
      }
    }
    
    // Merge values with decrypted secrets
    return this.mergeSecrets(stored.values, decryptedSecrets);
  }
  
  /**
   * Export config without secrets (for sharing)
   */
  exportWithoutSecrets(backendId: string): Record<string, any> | null {
    const stored = this.project.getMetaData(`uba.${backendId}`) as StoredConfig | undefined;
    
    if (!stored) {
      return null;
    }
    
    // Return values only, secrets become empty strings
    const config = { ...stored.values };
    for (const path of Object.keys(stored.encryptedSecrets)) {
      setNestedValue(config, path, '');
    }
    
    return config;
  }
  
  private separateSecrets(config: Record<string, any>, secretPaths: string[]): {
    values: Record<string, any>;
    secrets: Record<string, string>;
  } {
    const values = JSON.parse(JSON.stringify(config));
    const secrets: Record<string, string> = {};
    
    for (const path of secretPaths) {
      const value = getNestedValue(config, path);
      if (value) {
        secrets[path] = value;
        setNestedValue(values, path, '[ENCRYPTED]');
      }
    }
    
    return { values, secrets };
  }
}

// SecretManager.ts
import * as crypto from 'crypto';

export class SecretManager {
  private key: Buffer;
  
  constructor(private project: ProjectModel) {
    // Derive key from project ID
    this.key = this.deriveKey(project.id);
  }
  
  private deriveKey(projectId: string): Buffer {
    // Use PBKDF2 to derive a key from project ID
    return crypto.pbkdf2Sync(
      projectId,
      'nodegx-uba-salt', // Static salt (could be improved)
      100000,
      32,
      'sha256'
    );
  }
  
  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }
  
  async decrypt(encrypted: string): Promise<string> {
    const [ivBase64, authTagBase64, ciphertext] = encrypted.split(':');
    
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### Acceptance Criteria

- [ ] Config saves to project metadata
- [ ] Config loads correctly
- [ ] Secrets are encrypted at rest
- [ ] Decryption works with correct key
- [ ] Export excludes secrets
- [ ] Environment support works
- [ ] Handles missing/corrupted data gracefully

---

### UBA-006: Backend Discovery
**Effort:** 3 days  
**Assignee:** TBD  
**Branch:** `feature/uba-006-backend-discovery`  
**Depends On:** UBA-002

#### Description

Implement the ability to fetch and cache schemas from backend URLs. This is how users add new UBA backends to their projects.

#### Deliverables

1. **Backend Discovery**
   - Fetch schema from `.well-known` URL
   - Handle authentication
   - Validate fetched schema

2. **Schema Cache**
   - Cache schemas to avoid repeated fetches
   - Cache invalidation on backend version change
   - Offline support (use cached schema)

3. **Add Backend Dialog**
   - URL input
   - Auth configuration
   - Schema preview
   - Add confirmation

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── BackendDiscovery.ts
├── SchemaCache.ts
└── BackendConnection.ts

packages/noodl-editor/src/editor/src/views/UBA/
├── AddBackendDialog.tsx
└── AddBackendDialog.module.scss
```

#### Implementation

```typescript
// BackendDiscovery.ts
export class BackendDiscovery {
  private parser: SchemaParser;
  private cache: SchemaCache;
  
  constructor() {
    this.parser = new SchemaParser();
    this.cache = new SchemaCache();
  }
  
  /**
   * Discover and validate a backend's schema
   */
  async discover(url: string, auth?: AuthConfig): Promise<DiscoveryResult> {
    const schemaUrl = this.buildSchemaUrl(url);
    
    try {
      // Fetch schema
      const response = await fetch(schemaUrl, {
        headers: this.buildHeaders(auth)
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch schema: ${response.status} ${response.statusText}`
        };
      }
      
      const yamlText = await response.text();
      
      // Parse and validate
      const parseResult = this.parser.parse(yamlText);
      
      if (!parseResult.success) {
        return {
          success: false,
          error: 'Invalid schema',
          validationErrors: parseResult.errors
        };
      }
      
      const schema = parseResult.data;
      
      // Cache the schema
      await this.cache.set(url, schema, yamlText);
      
      // Test health endpoint if available
      let healthStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
      if (schema.backend.endpoints.health) {
        healthStatus = await this.checkHealth(url, schema.backend.endpoints.health, auth);
      }
      
      return {
        success: true,
        schema,
        healthStatus,
        warnings: parseResult.warnings
      };
    } catch (error) {
      // Try cache for offline support
      const cached = await this.cache.get(url);
      if (cached) {
        return {
          success: true,
          schema: cached.schema,
          healthStatus: 'unknown',
          fromCache: true,
          warnings: ['Using cached schema (backend unreachable)']
        };
      }
      
      return {
        success: false,
        error: `Connection failed: ${error.message}`
      };
    }
  }
  
  private buildSchemaUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    url.pathname = '/.well-known/nodegx-schema.yaml';
    return url.toString();
  }
  
  private buildHeaders(auth?: AuthConfig): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/x-yaml, text/yaml, text/plain'
    };
    
    if (auth) {
      switch (auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${auth.token}`;
          break;
        case 'api_key':
          headers[auth.header || 'X-API-Key'] = auth.token;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
          break;
      }
    }
    
    return headers;
  }
  
  private async checkHealth(baseUrl: string, healthPath: string, auth?: AuthConfig): Promise<'healthy' | 'unhealthy'> {
    try {
      const url = new URL(healthPath, baseUrl);
      const response = await fetch(url.toString(), {
        headers: this.buildHeaders(auth)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy' ? 'healthy' : 'unhealthy';
      }
      
      return 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }
}

// AddBackendDialog.tsx
export function AddBackendDialog({ onClose, onAdd }: AddBackendDialogProps) {
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'api_key'>('none');
  const [authToken, setAuthToken] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  
  const handleDiscover = async () => {
    setDiscovering(true);
    setResult(null);
    
    const discovery = new BackendDiscovery();
    const result = await discovery.discover(url, 
      authType !== 'none' ? { type: authType, token: authToken } : undefined
    );
    
    setResult(result);
    setDiscovering(false);
  };
  
  const handleAdd = () => {
    if (result?.success && result.schema) {
      onAdd({
        url,
        schema: result.schema,
        auth: authType !== 'none' ? { type: authType, token: authToken } : undefined
      });
      onClose();
    }
  };
  
  return (
    <Dialog onClose={onClose} title="Add UBA Backend">
      <div className={css['form']}>
        <label>Backend URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://my-backend.example.com"
        />
        <p className={css['hint']}>
          Will look for schema at: <code>/.well-known/nodegx-schema.yaml</code>
        </p>
        
        <label>Authentication</label>
        <select value={authType} onChange={(e) => setAuthType(e.target.value as any)}>
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="api_key">API Key</option>
        </select>
        
        {authType !== 'none' && (
          <input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder={authType === 'bearer' ? 'Bearer token' : 'API key'}
          />
        )}
        
        <Button onClick={handleDiscover} disabled={!url || discovering}>
          {discovering ? 'Detecting...' : 'Detect Schema'}
        </Button>
        
        {result && !result.success && (
          <div className={css['error']}>
            <IconAlert /> {result.error}
          </div>
        )}
        
        {result?.success && result.schema && (
          <div className={css['schema-preview']}>
            <div className={css['backend-info']}>
              {result.schema.backend.icon && <Icon name={result.schema.backend.icon} />}
              <div>
                <h3>{result.schema.backend.name}</h3>
                <p>{result.schema.backend.description}</p>
                <p className={css['version']}>v{result.schema.backend.version}</p>
              </div>
              <span className={css['health-badge']} data-status={result.healthStatus}>
                {result.healthStatus}
              </span>
            </div>
            
            <div className={css['sections-preview']}>
              <h4>Configuration Sections:</h4>
              <ul>
                {result.schema.sections.map(section => (
                  <li key={section.id}>
                    {section.icon && <Icon name={section.icon} size="small" />}
                    {section.name} ({section.fields.length} fields)
                  </li>
                ))}
              </ul>
            </div>
            
            {result.schema.debug?.enabled && (
              <p className={css['debug-available']}>
                <IconBug /> Debug streaming available
              </p>
            )}
            
            {result.warnings?.length > 0 && (
              <div className={css['warnings']}>
                {result.warnings.map((warning, i) => (
                  <p key={i}><IconWarning /> {warning}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className={css['actions']}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button 
          variant="primary" 
          onClick={handleAdd}
          disabled={!result?.success}
        >
          Add Backend
        </Button>
      </div>
    </Dialog>
  );
}
```

#### Acceptance Criteria

- [ ] Fetches schema from correct URL
- [ ] Handles authentication correctly
- [ ] Validates fetched schema
- [ ] Caches schema for offline use
- [ ] Shows schema preview before adding
- [ ] Health check works
- [ ] Error messages are helpful
- [ ] Works with various URL formats

---

### UBA-007: Config Push
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-007-config-push`  
**Depends On:** UBA-005, UBA-006

#### Description

Implement sending configuration to backends when users save. Handle responses including warnings and runtime values.

#### Deliverables

1. **Config Push Service**
   - POST config to backend
   - Handle authentication
   - Process response (success, warnings, errors)

2. **Runtime Values Integration**
   - Receive runtime values from backend
   - Inject into prompt variables
   - Display in UI

3. **Hot Reload Support**
   - Detect if backend supports hot reload
   - Push config changes without restart

#### Files to Create

```
packages/noodl-editor/src/editor/src/models/UBA/
├── ConfigPush.ts
└── RuntimeValues.ts
```

#### Implementation

```typescript
// ConfigPush.ts
interface ConfigPushResult {
  success: boolean;
  applied_at?: string;
  warnings?: ConfigWarning[];
  errors?: ConfigError[];
  runtime_values?: Record<string, any>;
}

interface ConfigWarning {
  field: string;
  message: string;
}

interface ConfigError {
  field: string;
  message: string;
  code: string;
}

export class ConfigPush {
  constructor(
    private backendUrl: string,
    private auth?: AuthConfig
  ) {}
  
  /**
   * Push configuration to backend
   */
  async push(schema: UBASchema, config: Record<string, any>, metadata: ConfigMetadata): Promise<ConfigPushResult> {
    const endpoint = new URL(schema.backend.endpoints.config, this.backendUrl);
    
    const body = {
      config,
      metadata: {
        project_id: metadata.projectId,
        project_name: metadata.projectName,
        environment: metadata.environment,
        nodegx_version: metadata.nodegxVersion
      }
    };
    
    try {
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.buildAuthHeaders()
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          errors: data.errors || [{ 
            field: '', 
            message: data.message || 'Configuration rejected by backend',
            code: 'REJECTED'
          }]
        };
      }
      
      return {
        success: true,
        applied_at: data.applied_at,
        warnings: data.warnings,
        runtime_values: data.runtime_values
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          field: '',
          message: `Failed to push config: ${error.message}`,
          code: 'CONNECTION_ERROR'
        }]
      };
    }
  }
  
  private buildAuthHeaders(): Record<string, string> {
    if (!this.auth) return {};
    
    switch (this.auth.type) {
      case 'bearer':
        return { 'Authorization': `Bearer ${this.auth.token}` };
      case 'api_key':
        return { [this.auth.header || 'X-API-Key']: this.auth.token };
      default:
        return {};
    }
  }
}

// RuntimeValues.ts
export class RuntimeValues {
  private values: Record<string, any> = {};
  private listeners: Set<() => void> = new Set();
  
  update(values: Record<string, any>) {
    this.values = { ...this.values, ...values };
    this.notifyListeners();
  }
  
  get(key: string): any {
    return this.values[key];
  }
  
  getAll(): Record<string, any> {
    return { ...this.values };
  }
  
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}
```

#### Acceptance Criteria

- [ ] Config POSTs to correct endpoint
- [ ] Authentication headers included
- [ ] Success response handled
- [ ] Warnings displayed to user
- [ ] Errors displayed with field context
- [ ] Runtime values stored and accessible
- [ ] Hot reload triggers correctly
- [ ] Connection errors handled gracefully

---

## Phase 6A Checklist

### Pre-Development
- [ ] Review and approve schema specification
- [ ] Set up branch structure
- [ ] Create Storybook stories for field components

### UBA-001: Schema Specification
- [ ] Write complete specification document
- [ ] Create JSON Schema
- [ ] Write example schemas
- [ ] Review with team

### UBA-002: Schema Parser
- [ ] Implement YAML parser
- [ ] Implement JSON Schema validation
- [ ] Create TypeScript types
- [ ] Add version handling
- [ ] Write unit tests
- [ ] Test with example schemas

### UBA-003: Basic Field Renderers
- [ ] Implement StringField
- [ ] Implement TextField
- [ ] Implement NumberField
- [ ] Implement BooleanField
- [ ] Implement SecretField
- [ ] Implement UrlField
- [ ] Implement SelectField
- [ ] Implement MultiSelectField
- [ ] Create FieldRenderer factory
- [ ] Style all fields consistently
- [ ] Write component tests
- [ ] Add Storybook stories

### UBA-004: Config Panel Shell
- [ ] Implement ConfigPanel
- [ ] Implement ConfigSection
- [ ] Implement ConfigHeader
- [ ] Create useConfigForm hook
- [ ] Add validation integration
- [ ] Test tab navigation
- [ ] Test form state

### UBA-005: Config Storage
- [ ] Implement ConfigStorage
- [ ] Implement SecretManager
- [ ] Add encryption/decryption
- [ ] Test save/load cycle
- [ ] Test export without secrets

### UBA-006: Backend Discovery
- [ ] Implement BackendDiscovery
- [ ] Implement SchemaCache
- [ ] Create AddBackendDialog
- [ ] Test schema fetching
- [ ] Test caching
- [ ] Test error handling

### UBA-007: Config Push
- [ ] Implement ConfigPush
- [ ] Implement RuntimeValues
- [ ] Test push flow
- [ ] Test warning handling
- [ ] Test error handling

### Integration
- [ ] End-to-end test with mock backend
- [ ] Test with real backend (if available)
- [ ] Performance testing
- [ ] Accessibility review

### Documentation
- [ ] API documentation
- [ ] Usage examples
- [ ] Troubleshooting guide

---

## Success Criteria

### Functional
- [ ] Can add a UBA backend by URL
- [ ] Schema is fetched and validated
- [ ] Config panel renders all basic field types
- [ ] Configuration saves to project
- [ ] Configuration pushes to backend
- [ ] Secrets are encrypted at rest

### Performance
- [ ] Schema parsing < 100ms
- [ ] Panel renders < 500ms
- [ ] No memory leaks

### Quality
- [ ] Test coverage > 80%
- [ ] No TypeScript errors
- [ ] Passes linting
- [ ] Accessible (keyboard navigation, screen readers)

---

## Dependencies

### External Packages (to add)

```json
{
  "js-yaml": "^4.1.0",
  "ajv": "^8.12.0"
}
```

### Internal Dependencies

- `@noodl-models/projectmodel` - Project metadata storage
- `@noodl-core-ui` - UI components
- Backend Services system - Backend list integration

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Schema spec too complex | Start minimal, add features in 6B |
| Encryption issues | Use well-tested crypto library |
| YAML parsing errors | Comprehensive error handling |
| Backend unreachable | Offline mode with cached schema |

---

## Notes

- Keep field renderers simple in this phase; complex types come in 6B
- Focus on correctness over features
- Document all decisions for future reference
- Create reusable patterns for later phases
