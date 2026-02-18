# UBA System — Richard's Progress

## Sprint 2 — 18 Feb 2026

### Session 1 (Sprint 1)

- **UBA-001**: `types.ts` — Full type definitions (UBASchema, all field types, ParseResult discriminated union)
- **UBA-002**: `SchemaParser.ts` — Instance-method parser with `normalise()`, validation, warnings
- Tests: `UBASchemaParser.test.ts` (18 cases), `UBAConditions.test.ts` (12 cases)

### Session 2 (Sprint 1)

- **UBA-003**: Field renderers — StringField, TextField, NumberField, BooleanField, SecretField, UrlField, SelectField, MultiSelectField, FieldWrapper, FieldRenderer
- **UBA-004**: `ConfigPanel.tsx` + `ConfigSection.tsx` + `useConfigForm.ts` — Full tabbed config form with validation, dirty state, required-field check, section error dots

### Session 3 (Sprint 2)

- **UBA-005**: `services/UBA/UBAClient.ts` — Static HTTP client

  - `configure()`: POST to config endpoint, timeout, auth headers, JSON body
  - `health()`: GET health endpoint, never throws, returns HealthResult
  - `openDebugStream()`: SSE via EventSource, named event types, auth as query param
  - Auth modes: bearer, api_key (custom header), basic (btoa)
  - `UBAClientError` with status + body for non-2xx responses

- **UBA-006** + **UBA-007**: `views/panels/UBAPanel/` — Editor panel
  - `UBAPanel.tsx`: BasePanel + Tabs (Configure / Debug)
    - `useUBASchema` hook: reads `ubaSchemaUrl` from project metadata, fetches + parses
    - `SchemaLoader` UI: URL input field + error banner
    - `onSave` → stores `ubaConfig` in project metadata + POSTs via UBAClient
    - `useEventListener` for `importComplete` / `instanceHasChanged`
  - `DebugStreamView.tsx`: Live SSE log viewer
    - Connect/Disconnect toggle, Clear button
    - Auto-scroll with manual override (40px threshold), max 500 events
    - Per-event type colour coding (log/info/warn/error/metric)
    - "Jump to latest" sticky button
  - `UBAPanel.module.scss`: All design tokens, no hardcoded colors
  - **Test registration**: `tests/models/index.ts` + `tests/services/index.ts` created; `tests/index.ts` updated

## Status

| Task                         | Status  | Notes                            |
| ---------------------------- | ------- | -------------------------------- |
| UBA-001 Types                | ✅ Done |                                  |
| UBA-002 SchemaParser         | ✅ Done | Instance method `.parse()`       |
| UBA-003 Field Renderers      | ✅ Done | 8 field types                    |
| UBA-004 ConfigPanel          | ✅ Done | Tabs, validation, dirty state    |
| UBA-005 UBAClient            | ✅ Done | configure/health/openDebugStream |
| UBA-006 ConfigPanel mounting | ✅ Done | UBAPanel with project metadata   |
| UBA-007 Debug Stream Panel   | ✅ Done | SSE viewer in Debug tab          |

### Session 4 (Sprint 2)

- **UBA-008**: `router.setup.ts` — Registered UBAPanel in editor sidebar

  - Added `uba` route with `UBAPanel` component
  - Panel accessible via editor sidebar navigation

- **UBA-009**: `UBAPanel.tsx` + `UBAPanel.module.scss` — Health indicator widget

  - `useUBAHealth` hook: polls `UBAClient.health()` every 30s, never throws
  - `HealthBadge` component: dot + label, 4 states (unknown/checking/healthy/unhealthy)
  - Animated pulse on `checking` state; green/red semantic colours with `--theme-color-success/danger` tokens + fallbacks
  - Shown above ConfigPanel when `schema.backend.endpoints.health` is present
  - `configureTabContent` wrapper div for flex layout

- **Test fixes**: `UBASchemaParser.test.ts`
  - Added `isFailure<T>()` type guard (webpack ts-loader friendly discriminated union narrowing)
  - Replaced all `if (!result.success)` with `if (isFailure(result))`
  - Fixed destructuring discard pattern `_sv`/`_b` → `_` with `eslint-disable-next-line`

## Status

| Task                         | Status  | Notes                            |
| ---------------------------- | ------- | -------------------------------- |
| UBA-001 Types                | ✅ Done |                                  |
| UBA-002 SchemaParser         | ✅ Done | Instance method `.parse()`       |
| UBA-003 Field Renderers      | ✅ Done | 8 field types                    |
| UBA-004 ConfigPanel          | ✅ Done | Tabs, validation, dirty state    |
| UBA-005 UBAClient            | ✅ Done | configure/health/openDebugStream |
| UBA-006 ConfigPanel mounting | ✅ Done | UBAPanel with project metadata   |
| UBA-007 Debug Stream Panel   | ✅ Done | SSE viewer in Debug tab          |
| UBA-008 Panel registration   | ✅ Done | Sidebar route in router.setup.ts |
| UBA-009 Health indicator     | ✅ Done | useUBAHealth + HealthBadge       |

## Next Up

- STYLE tasks: Any remaining style overhaul items
- UBA-010: Consider E2E integration test with mock backend
