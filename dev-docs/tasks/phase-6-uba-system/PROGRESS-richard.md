# UBA System — Progress (Richard)

## Sprint 1 Session — 18 Feb 2026

### Completed

#### UBA-001: Types

- `packages/noodl-editor/src/editor/src/models/UBA/types.ts`
- Full discriminated union for all 8 field types
- `ParseResult<T>` / `ParseError` types
- `Condition` with operator-based structure

#### UBA-002: SchemaParser

- `packages/noodl-editor/src/editor/src/models/UBA/SchemaParser.ts`
- Validates unknown input against the UBA schema spec
- Returns `ParseResult<UBASchema>` with structured errors + warnings
- Tests: `packages/noodl-editor/tests/models/UBASchemaParser.test.ts`

#### UBA-003: Field Renderers

All 8 field components + FieldWrapper + FieldRenderer factory:

| File                                    | Component                            |
| --------------------------------------- | ------------------------------------ |
| `views/UBA/fields/FieldWrapper.tsx`     | Shared label/error/description shell |
| `views/UBA/fields/StringField.tsx`      | Single-line text input               |
| `views/UBA/fields/TextField.tsx`        | Multi-line textarea                  |
| `views/UBA/fields/NumberField.tsx`      | Numeric input with clamping          |
| `views/UBA/fields/BooleanField.tsx`     | Toggle switch                        |
| `views/UBA/fields/SecretField.tsx`      | Password input with show/hide        |
| `views/UBA/fields/UrlField.tsx`         | URL input with protocol validation   |
| `views/UBA/fields/SelectField.tsx`      | Native select dropdown               |
| `views/UBA/fields/MultiSelectField.tsx` | Tag-based multi-select               |
| `views/UBA/fields/FieldRenderer.tsx`    | Factory dispatcher                   |
| `views/UBA/fields/fields.module.scss`   | Shared SCSS (CSS vars only)          |
| `views/UBA/fields/index.ts`             | Barrel                               |

#### UBA-004: ConfigPanel + Conditions

Complete form shell with section tabs, validation, dirty state:

| File                                  | Purpose                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `models/UBA/Conditions.ts`            | `evaluateCondition`, `getNestedValue`, `setNestedValue`, `isEmpty` |
| `views/UBA/hooks/useConfigForm.ts`    | Form state, dirty tracking, `validateRequired`, `flatToNested`     |
| `views/UBA/ConfigSection.tsx`         | Single section with `visible_when` filtering                       |
| `views/UBA/ConfigPanel.tsx`           | Tabbed panel, save/reset, error banners                            |
| `views/UBA/ConfigSection.module.scss` | Section styles                                                     |
| `views/UBA/ConfigPanel.module.scss`   | Panel styles                                                       |
| `views/UBA/index.ts`                  | Barrel                                                             |
| `models/UBA/index.ts`                 | Updated to export Conditions                                       |

#### Tests

- `tests/models/UBAConditions.test.ts` — 22 cases covering all 6 operators + path utils
- `tests/models/UBASchemaParser.test.ts` — existing tests (unchanged)

> ⚠️ Tests unverified this session — port 8081 in use by dev server. Run after stopping the app.

---

## Next Up (Sprint 2)

### UBA-005: Backend HTTP Client

- `services/UBAClient.ts` — `configure(values)`, `health()`, `debugStream()`
- Typed around `BackendMetadata.endpoints`

### UBA-006: UBAPanel Integration

- Mount `ConfigPanel` inside a proper editor panel
- Wire to project settings persistence
- Schema loading from backend `config` endpoint

### UBA-007: Debug Stream Panel

- SSE event viewer using `debug_stream` endpoint
- Live log display with `DebugSchema` field rendering

---

## Architecture Decisions

- Values stored as **flat dot-path map** (`section.field`) for simplicity
- `flatToNested()` converts to nested object before sending to backends
- `evaluateCondition` uses flat-path map directly (no nesting required in form state)
- Section visibility filtered in `ConfigPanel` via `visible_when` on sections
- Field visibility handled in `ConfigSection` — hidden fields return `null` (unmounted)
- `useConfigForm` intentionally computes `initial` only on mount — `reset()` handles re-init
