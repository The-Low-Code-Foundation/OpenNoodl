# Phase 2: Editor UI - Property Panel

## Overview

Add the breakpoint selector UI to the property panel and implement the visual feedback for inherited vs overridden values. Users should be able to switch between breakpoints and see/edit breakpoint-specific values.

**Estimate:** 3-4 days

**Dependencies:** Phase 1 (Foundation)

## Goals

1. Add breakpoint selector component to property panel
2. Show inherited vs overridden values with visual distinction
3. Add reset button to clear breakpoint-specific overrides
4. Show badge summary of overrides per breakpoint
5. Add breakpoint configuration section to Project Settings
6. Filter property panel to only show breakpoint controls on `allowBreakpoints` properties

## UI Design

### Property Panel with Breakpoint Selector

```
┌─────────────────────────────────────────────────┐
│ Group                                           │
├─────────────────────────────────────────────────┤
│ Breakpoint: [🖥️] [💻] [📱] [📱]                  │
│             Des  Tab  Pho  Sml                  │
│            ─────────────────────                │
│              ▲ selected                         │
├─────────────────────────────────────────────────┤
│ ┌─ Dimensions ────────────────────────────────┐ │
│ │ Width        [100%]                         │ │
│ │ Height       [auto]        (inherited) [↺]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ Margin and Padding ────────────────────────┐ │
│ │ Margin Top   [24px]        ● changed        │ │
│ │ Padding      [16px]        (inherited) [↺]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ Style ─────────────────────────────────────┐ │
│ │ Background   [#ffffff]     (no breakpoints) │ │
│ │ Border       [1px solid]   (no breakpoints) │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 💻 2 overrides  📱 3 overrides  📱 1 override   │
└─────────────────────────────────────────────────┘
```

### Visual States

| State | Appearance |
|-------|------------|
| Base value (desktop) | Normal text, no indicator |
| Inherited from larger breakpoint | Dimmed/italic text, "(inherited)" label |
| Explicitly set for this breakpoint | Normal text, filled dot indicator (●) |
| Reset button | Shows on hover for overridden values |

### Project Settings - Breakpoints Section

```
┌─────────────────────────────────────────────────┐
│ Responsive Breakpoints                          │
├─────────────────────────────────────────────────┤
│ ☑ Enable responsive breakpoints                 │
│                                                 │
│ Cascade direction: [Desktop-first ▼]            │
│                                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ Name          Min Width    Max Width      │   │
│ │ ─────────────────────────────────────────│   │
│ │ 🖥️ Desktop     1024px       —      [Default]│   │
│ │ 💻 Tablet      768px        1023px         │   │
│ │ 📱 Phone       320px        767px          │   │
│ │ 📱 Small Phone 0px          319px          │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ [+ Add Breakpoint]  [Reset to Defaults]         │
└─────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Create BreakpointSelector Component

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/BreakpointSelector/BreakpointSelector.tsx`

```tsx
import React from 'react';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import css from './BreakpointSelector.module.scss';

export interface Breakpoint {
  id: string;
  name: string;
  icon: IconName;
  minWidth?: number;
  maxWidth?: number;
}

export interface BreakpointSelectorProps {
  breakpoints: Breakpoint[];
  selectedBreakpoint: string;
  overrideCounts: Record<string, number>;  // { tablet: 2, phone: 3 }
  onBreakpointChange: (breakpointId: string) => void;
}

export function BreakpointSelector({
  breakpoints,
  selectedBreakpoint,
  overrideCounts,
  onBreakpointChange
}: BreakpointSelectorProps) {
  return (
    <div className={css.Root}>
      <span className={css.Label}>Breakpoint:</span>
      <div className={css.ButtonGroup}>
        {breakpoints.map((bp) => (
          <Tooltip 
            key={bp.id} 
            content={`${bp.name}${bp.minWidth ? ` (${bp.minWidth}px+)` : ''}`}
          >
            <button
              className={classNames(css.Button, {
                [css.isSelected]: selectedBreakpoint === bp.id,
                [css.hasOverrides]: overrideCounts[bp.id] > 0
              })}
              onClick={() => onBreakpointChange(bp.id)}
            >
              <Icon icon={getIconForBreakpoint(bp.icon)} />
              {overrideCounts[bp.id] > 0 && (
                <span className={css.OverrideCount}>{overrideCounts[bp.id]}</span>
              )}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

function getIconForBreakpoint(icon: string): IconName {
  switch (icon) {
    case 'desktop': return IconName.DeviceDesktop;
    case 'tablet': return IconName.DeviceTablet;
    case 'phone': 
    case 'phone-small':
    default: return IconName.DevicePhone;
  }
}
```

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/BreakpointSelector/BreakpointSelector.module.scss`

```scss
.Root {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--theme-color-bg-3);
  background-color: var(--theme-color-bg-2);
}

.Label {
  font-size: 12px;
  color: var(--theme-color-fg-default);
  margin-right: 8px;
}

.ButtonGroup {
  display: flex;
  gap: 2px;
}

.Button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: none;
  background-color: var(--theme-color-bg-3);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--theme-color-bg-1);
  }

  &.isSelected {
    background-color: var(--theme-color-primary);
    
    svg path {
      fill: var(--theme-color-on-primary);
    }
  }

  svg path {
    fill: var(--theme-color-fg-default);
  }
}

.OverrideCount {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--theme-color-on-primary);
  background-color: var(--theme-color-secondary);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Step 2: Create Inherited Value Indicator

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/InheritedIndicator/InheritedIndicator.tsx`

```tsx
import React from 'react';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import css from './InheritedIndicator.module.scss';

export interface InheritedIndicatorProps {
  isInherited: boolean;
  inheritedFrom?: string;  // 'desktop', 'tablet', etc.
  isBreakpointAware: boolean;
  onReset?: () => void;
}

export function InheritedIndicator({
  isInherited,
  inheritedFrom,
  isBreakpointAware,
  onReset
}: InheritedIndicatorProps) {
  if (!isBreakpointAware) {
    return null;  // Don't show anything for non-breakpoint properties
  }

  if (isInherited) {
    return (
      <Tooltip content={`Inherited from ${inheritedFrom}`}>
        <span className={css.Inherited}>
          (inherited)
          {onReset && (
            <button className={css.ResetButton} onClick={onReset}>
              <Icon icon={IconName.Undo} size={12} />
            </button>
          )}
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="Value set for this breakpoint">
      <span className={css.Changed}>
        <span className={css.Dot}>●</span>
        {onReset && (
          <button className={css.ResetButton} onClick={onReset}>
            <Icon icon={IconName.Undo} size={12} />
          </button>
        )}
      </span>
    </Tooltip>
  );
}
```

### Step 3: Integrate into Property Editor

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.ts`

```typescript
// Add to existing property editor

import { BreakpointSelector } from './components/BreakpointSelector';

// In render method, add breakpoint selector after visual states
renderBreakpointSelector() {
  const node = this.model;
  const hasBreakpointPorts = this.hasBreakpointAwarePorts();
  
  if (!hasBreakpointPorts) return;  // Don't show if no breakpoint-aware properties
  
  const settings = ProjectModel.instance.getBreakpointSettings();
  const overrideCounts = this.calculateOverrideCounts();
  
  const props = {
    breakpoints: settings.breakpoints.map(bp => ({
      id: bp.id,
      name: bp.name,
      icon: bp.icon,
      minWidth: bp.minWidth,
      maxWidth: bp.maxWidth
    })),
    selectedBreakpoint: this.modelProxy.breakpoint || settings.defaultBreakpoint,
    overrideCounts,
    onBreakpointChange: this.onBreakpointChanged.bind(this)
  };
  
  ReactDOM.render(
    React.createElement(BreakpointSelector, props),
    this.$('.breakpoint-selector')[0]
  );
}

onBreakpointChanged(breakpointId: string) {
  this.modelProxy.setBreakpoint(breakpointId);
  this.scheduleRenderPortsView();
}

hasBreakpointAwarePorts(): boolean {
  const ports = this.model.getPorts('input');
  return ports.some(p => p.allowBreakpoints);
}

calculateOverrideCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  const settings = ProjectModel.instance.getBreakpointSettings();
  
  for (const bp of settings.breakpoints) {
    if (bp.id === settings.defaultBreakpoint) continue;
    
    const overrides = this.model.breakpointParameters?.[bp.id];
    counts[bp.id] = overrides ? Object.keys(overrides).length : 0;
  }
  
  return counts;
}
```

### Step 4: Update Property Panel Row Component

**File:** `packages/noodl-core-ui/src/components/property-panel/PropertyPanelRow/PropertyPanelRow.tsx`

```tsx
// Extend PropertyPanelRow to show inherited indicator

export interface PropertyPanelRowProps {
  label: string;
  children: React.ReactNode;
  
  // NEW props for breakpoint support
  isBreakpointAware?: boolean;
  isInherited?: boolean;
  inheritedFrom?: string;
  onReset?: () => void;
}

export function PropertyPanelRow({
  label,
  children,
  isBreakpointAware,
  isInherited,
  inheritedFrom,
  onReset
}: PropertyPanelRowProps) {
  return (
    <div className={classNames(css.Root, { [css.isInherited]: isInherited })}>
      <label className={css.Label}>{label}</label>
      <div className={css.InputContainer}>
        {children}
        {isBreakpointAware && (
          <InheritedIndicator
            isInherited={isInherited}
            inheritedFrom={inheritedFrom}
            isBreakpointAware={isBreakpointAware}
            onReset={!isInherited ? onReset : undefined}
          />
        )}
      </div>
    </div>
  );
}
```

### Step 5: Update Ports View

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts`

```typescript
// Extend the Ports view to pass breakpoint info to each property row

renderPort(port) {
  const isBreakpointAware = port.allowBreakpoints;
  const currentBreakpoint = this.modelProxy.breakpoint;
  const defaultBreakpoint = ProjectModel.instance.getBreakpointSettings().defaultBreakpoint;
  
  let isInherited = false;
  let inheritedFrom = null;
  
  if (isBreakpointAware && currentBreakpoint !== defaultBreakpoint) {
    isInherited = this.modelProxy.isBreakpointValueInherited(port.name);
    inheritedFrom = this.getInheritedFromBreakpoint(port.name, currentBreakpoint);
  }
  
  // Pass these to the PropertyPanelRow component
  return {
    ...existingPortRenderData,
    isBreakpointAware,
    isInherited,
    inheritedFrom,
    onReset: isBreakpointAware && !isInherited 
      ? () => this.resetBreakpointValue(port.name, currentBreakpoint)
      : undefined
  };
}

resetBreakpointValue(portName: string, breakpoint: string) {
  this.modelProxy.setParameter(portName, undefined, {
    breakpoint,
    undo: true,
    label: `reset ${portName} for ${breakpoint}`
  });
  this.render();
}

getInheritedFromBreakpoint(portName: string, currentBreakpoint: string): string {
  const settings = ProjectModel.instance.getBreakpointSettings();
  const breakpointOrder = settings.breakpoints.map(bp => bp.id);
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
  
  // Walk up the cascade to find where value comes from
  for (let i = currentIndex - 1; i >= 0; i--) {
    const bp = breakpointOrder[i];
    if (this.model.hasBreakpointParameter(portName, bp)) {
      return settings.breakpoints.find(b => b.id === bp)?.name || bp;
    }
  }
  
  return settings.breakpoints[0]?.name || 'Desktop';  // Default
}
```

### Step 6: Add Breakpoint Settings to Project Settings Panel

**File:** `packages/noodl-editor/src/editor/src/views/panels/ProjectSettingsPanel/sections/BreakpointSettingsSection.tsx`

```tsx
import React, { useState } from 'react';
import { ProjectModel } from '@noodl-models/projectmodel';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';

export function BreakpointSettingsSection() {
  const [settings, setSettings] = useState(
    ProjectModel.instance.getBreakpointSettings()
  );

  function handleEnabledChange(enabled: boolean) {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    ProjectModel.instance.setBreakpointSettings(newSettings);
  }

  function handleCascadeDirectionChange(direction: string) {
    const newSettings = { ...settings, cascadeDirection: direction };
    setSettings(newSettings);
    ProjectModel.instance.setBreakpointSettings(newSettings);
  }

  function handleBreakpointChange(index: number, field: string, value: any) {
    const newBreakpoints = [...settings.breakpoints];
    newBreakpoints[index] = { ...newBreakpoints[index], [field]: value };
    
    const newSettings = { ...settings, breakpoints: newBreakpoints };
    setSettings(newSettings);
    ProjectModel.instance.setBreakpointSettings(newSettings);
  }

  return (
    <CollapsableSection title="Responsive Breakpoints" hasGutter>
      <PropertyPanelRow label="Enable breakpoints">
        <PropertyPanelCheckbox
          value={settings.enabled}
          onChange={handleEnabledChange}
        />
      </PropertyPanelRow>

      <PropertyPanelRow label="Cascade direction">
        <PropertyPanelSelectInput
          value={settings.cascadeDirection}
          onChange={handleCascadeDirectionChange}
          options={[
            { label: 'Desktop-first', value: 'desktop-first' },
            { label: 'Mobile-first', value: 'mobile-first' }
          ]}
        />
      </PropertyPanelRow>

      <div className={css.BreakpointList}>
        {settings.breakpoints.map((bp, index) => (
          <BreakpointRow
            key={bp.id}
            breakpoint={bp}
            isDefault={bp.id === settings.defaultBreakpoint}
            onChange={(field, value) => handleBreakpointChange(index, field, value)}
          />
        ))}
      </div>
    </CollapsableSection>
  );
}
```

### Step 7: Add Template to Property Editor HTML

**File:** `packages/noodl-editor/src/editor/src/templates/propertyeditor.html`

Add breakpoint selector container:

```html
<!-- Add after visual-states div -->
<div class="breakpoint-selector"></div>
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.ts` | Add breakpoint selector rendering, integrate with ModelProxy |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts` | Pass breakpoint info to property rows |
| `packages/noodl-editor/src/editor/src/templates/propertyeditor.html` | Add breakpoint selector container |
| `packages/noodl-core-ui/src/components/property-panel/PropertyPanelRow/PropertyPanelRow.tsx` | Add inherited indicator support |
| `packages/noodl-editor/src/editor/src/views/panels/ProjectSettingsPanel/ProjectSettingsPanel.tsx` | Add breakpoint settings section |
| `packages/noodl-editor/src/editor/src/styles/propertyeditor/` | Add breakpoint-related styles |

## Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/BreakpointSelector/BreakpointSelector.tsx` | Main breakpoint selector component |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/BreakpointSelector/BreakpointSelector.module.scss` | Styles for breakpoint selector |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/BreakpointSelector/index.ts` | Export |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/InheritedIndicator/InheritedIndicator.tsx` | Inherited value indicator |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/InheritedIndicator/InheritedIndicator.module.scss` | Styles |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/InheritedIndicator/index.ts` | Export |
| `packages/noodl-editor/src/editor/src/views/panels/ProjectSettingsPanel/sections/BreakpointSettingsSection.tsx` | Project settings UI |

## Testing Checklist

- [ ] Breakpoint selector appears in property panel for nodes with breakpoint-aware properties
- [ ] Breakpoint selector does NOT appear for nodes without breakpoint-aware properties
- [ ] Clicking breakpoint buttons switches the current breakpoint
- [ ] Property values update to show breakpoint-specific values when switching
- [ ] Inherited values show dimmed with "(inherited)" label
- [ ] Override values show with dot indicator (●)
- [ ] Reset button appears on hover for overridden values
- [ ] Clicking reset removes the breakpoint-specific value
- [ ] Override count badges show correct counts
- [ ] Project Settings shows breakpoint configuration
- [ ] Can change cascade direction in project settings
- [ ] Can modify breakpoint thresholds in project settings
- [ ] Changes persist after saving and reloading project

## Success Criteria

1. ✅ Users can switch between breakpoints in property panel
2. ✅ Clear visual distinction between inherited and overridden values
3. ✅ Can set breakpoint-specific values by editing while breakpoint is selected
4. ✅ Can reset breakpoint-specific values to inherit from larger breakpoint
5. ✅ Override counts visible at a glance
6. ✅ Project settings allow breakpoint customization

## Gotchas & Notes

1. **Visual States Coexistence**: The breakpoint selector should appear ABOVE the visual states selector (if present). They're independent axes.

2. **Port Filtering**: Only ports with `allowBreakpoints: true` should show the inherited/override indicators. Non-breakpoint properties look normal.

3. **Connected Ports**: If a port is connected (has a wire), it shouldn't show breakpoint controls - the connection takes precedence.

4. **Performance**: Calculating override counts could be expensive if done on every render. Consider caching or only recalculating when breakpointParameters change.

5. **Mobile-First Logic**: When cascade direction is mobile-first, the inheritance flows the OTHER direction (phone → tablet → desktop). Make sure the `getInheritedFromBreakpoint` logic handles both.

6. **Keyboard Navigation**: Consider adding keyboard shortcuts to switch breakpoints (e.g., Ctrl+1/2/3/4).

## UI/UX Refinements (Optional)

- Animate the transition when switching breakpoints
- Add tooltips showing the pixel range for each breakpoint
- Consider a "copy to all breakpoints" action
- Add visual preview of how values differ across breakpoints
