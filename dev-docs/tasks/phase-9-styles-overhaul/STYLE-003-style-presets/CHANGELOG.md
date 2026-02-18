# STYLE-003: Style Presets — CHANGELOG

## 2026-02-18 — Implementation Complete

### New files created

**Data layer (noodl-editor)**

- `models/StylePresets/StylePresetTypes.ts` — `StylePreset` and `PresetPreview` interfaces
- `models/StylePresets/presets/ModernPreset.ts` — Default (clean blue, 8px radius, soft shadows)
- `models/StylePresets/presets/MinimalPreset.ts` — Monochromatic, 2–4px radius, no shadows
- `models/StylePresets/presets/PlayfulPreset.ts` — Purple/pink, very rounded (16px), tinted shadows
- `models/StylePresets/presets/EnterprisePreset.ts` — Dark navy, conservative 4px radius, barely-there shadows
- `models/StylePresets/presets/SoftPreset.ts` — Indigo, 12px radius, ultra-light shadows
- `models/StylePresets/presets/index.ts` — barrel
- `models/StylePresets/StylePresetsModel.ts` — `getAllPresets`, `getPreset`, `getDefaultPreset`, `setPendingPresetId`, `consumePendingPreset`
- `models/StylePresets/index.ts` — public surface

**UI layer (noodl-core-ui)**

- `components/StylePresets/PresetCard.tsx` — Mini mockup card with primary swatch, text lines, surface strip
- `components/StylePresets/PresetCard.module.scss` — Card styles with selection ring
- `components/StylePresets/PresetSelector.tsx` — Horizontal grid + description below selected
- `components/StylePresets/PresetSelector.module.scss`
- `components/StylePresets/index.ts` — barrel

### Modified files

**`models/StyleTokensModel/StyleTokensModel.ts`**

- Added `applyPreset(tokens)` public method — bulk-sets tokens without undo
- Added `_applyAndClearPendingPreset()` private method — called from `_bindListeners` reload path
- Added `consumePendingPreset` import and call in the `reload` closure

**`preview/launcher/Launcher/components/CreateProjectModal/CreateProjectModal.tsx`**

- Added `presets?: PresetDisplayInfo[]` prop
- Added `selectedPresetId` local state (default `'modern'`)
- Renders `<PresetSelector>` when presets provided
- Extended `onConfirm` signature to include `presetId: string`

**`pages/ProjectsPage/ProjectsPage.tsx`**

- Added `getAllPresets`, `setPendingPresetId` imports
- Added `STYLE_PRESETS` module-level constant
- Updated `handleCreateProjectConfirm(name, location, presetId)` to call `setPendingPresetId(presetId)`
- Passes `presets={STYLE_PRESETS}` to `<CreateProjectModal>`
- Error path clears pending preset via `setPendingPresetId(null)`

### Architecture — pending preset flow

```
User picks preset → CreateProjectModal.onConfirm(name, loc, presetId)
  → ProjectsPage.handleCreateProjectConfirm
  → setPendingPresetId(presetId)          // stored in module-level var
  → LocalProjectsModel.newProject(...)
  → route to editor
  → StyleTokensModel._bindListeners reload fires (ProjectModel.instanceHasChanged)
  → _applyAndClearPendingPreset()
  → consumePendingPreset() reads + clears _pendingPresetId
  → applyPreset(preset.tokens)
  → setToken() x N → _store() → ProjectModel.instance.setMetaData('designTokens', ...)
  → tokens persisted to project.json
```

Modern preset has `tokens: {}` so it is a no-op (defaults already apply).
