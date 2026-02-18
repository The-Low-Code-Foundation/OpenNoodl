# Phase 6: UBA System — Richard's Progress

## Sprint 1 Session 2 — 18 Feb 2026

### Completed this session

#### STYLE-005: SuggestionBanner wiring (property panel) — COMPLETE

- Created `ElementStyleSectionHost` (editor-side React wrapper)
  - Combines `ElementStyleSection` + `SuggestionBanner`
  - Uses `useStyleSuggestions()` for the active suggestion
  - Creates local `StyleTokensModel` instance (multiple instances safe — sync via ProjectModel events)
  - Calls `executeSuggestionAction()` on accept, `dismissSession`/`dismissPermanent` on ignore/never
- Wired into `propertyeditor.ts` — drop-in replacement, zero API change
- All TS errors resolved

#### UBA-001: TypeScript type definitions — COMPLETE

- `packages/noodl-editor/src/editor/src/models/UBA/types.ts`
- Full discriminated union on `Field.type` (string, text, number, boolean, secret, url, select, multi_select)
- `BackendMetadata`, `Endpoints`, `AuthConfig`, `Capabilities`, `Section`, `Condition`, `DebugSchema`
- `ParseResult<T>` discriminated union + `ParseError` type
- Zero external dependencies

#### UBA-002: SchemaParser — COMPLETE

- `packages/noodl-editor/src/editor/src/models/UBA/SchemaParser.ts`
- Accepts pre-parsed JS object (JSON.parse / yaml.load output) — no YAML dep required
- Validates: schema_version, backend (id/name/version/endpoints/auth/capabilities), sections, fields, debug
- Unknown field types → warning, not error (forward-compat)
- Unknown schema major version → warning with best-effort parsing
- All field types validated individually; partial errors collected before failing
- `packages/noodl-editor/src/editor/src/models/UBA/index.ts` — clean barrel exports

#### UBA-002: SchemaParser unit tests — COMPLETE

- `packages/noodl-editor/tests/models/UBASchemaParser.test.ts`
- 22 test cases covering: null/array rejection, missing version, version warning, minimal happy path
- Backend: missing, missing id, missing endpoints.config, optional fields, invalid auth type
- Sections: not array, minimal section, missing id
- Field types: string, boolean, number (min/max), secret, select (+ no-options error), multi_select, unknown type warning
- Debug schema with event_schema

### Next session priorities

#### UBA-003: Field renderers

- 8 field renderer components (one per field type)
- `FieldRenderer` factory component (dispatches on `field.type`)
- Shared styles (`fields.module.scss`)
- `FieldWrapper` with label, description, required indicator

#### UBA-004: ConfigPanel shell

- `ConfigPanel.tsx` — renders sections + fields from a parsed `UBASchema`
- `useConfigForm` hook — manages form values, validation, dirty state
- Section collapsing, `visible_when` condition evaluation

### Tracking

| Task                               | Status  |
| ---------------------------------- | ------- |
| STYLE-005: SuggestionBanner wiring | ✅ DONE |
| UBA-001: TypeScript types          | ✅ DONE |
| UBA-002: SchemaParser + tests      | ✅ DONE |
| UBA-003: Field renderers           | 🔲 NEXT |
| UBA-004: ConfigPanel + hook        | 🔲 TODO |
