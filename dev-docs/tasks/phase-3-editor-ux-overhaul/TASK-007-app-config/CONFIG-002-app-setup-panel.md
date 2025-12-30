# CONFIG-002: App Setup Panel UI

## Overview

Create a new "App Setup" top-level sidebar panel for editing app configuration, SEO metadata, PWA settings, and custom variables.

**Estimated effort:** 18-24 hours  
**Dependencies:** CONFIG-001  
**Blocks:** CONFIG-004, CONFIG-005

---

## Objectives

1. Add new "App Setup" tab to sidebar navigation
2. Create panel sections for Identity, SEO, PWA, and Custom Variables
3. Integrate existing port type editors for type-aware editing
4. Implement add/edit/remove flows for custom variables
5. Support category grouping for variables
6. Migrate relevant settings from Project Settings panel

---

## Files to Create

### 1. App Setup Panel

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/AppSetupPanel.tsx`

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ProjectModel } from '@noodl-models/projectmodel';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { AppConfig } from '@noodl/runtime/src/config/types';

import { IdentitySection } from './sections/IdentitySection';
import { SEOSection } from './sections/SEOSection';
import { PWASection } from './sections/PWASection';
import { VariablesSection } from './sections/VariablesSection';

export function AppSetupPanel() {
  const [config, setConfig] = useState<AppConfig>(
    ProjectModel.instance.getAppConfig()
  );
  
  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    ProjectModel.instance.setAppConfig(newConfig);
  }, [config]);
  
  const updateIdentity = useCallback((identity: Partial<AppConfig['identity']>) => {
    updateConfig({
      identity: { ...config.identity, ...identity }
    });
  }, [config, updateConfig]);
  
  const updateSEO = useCallback((seo: Partial<AppConfig['seo']>) => {
    updateConfig({
      seo: { ...config.seo, ...seo }
    });
  }, [config, updateConfig]);
  
  const updatePWA = useCallback((pwa: Partial<AppConfig['pwa']>) => {
    updateConfig({
      pwa: { ...config.pwa, ...pwa } as AppConfig['pwa']
    });
  }, [config, updateConfig]);
  
  return (
    <BasePanel title="App Setup" hasContentScroll>
      <IdentitySection 
        identity={config.identity} 
        onChange={updateIdentity} 
      />
      
      <SEOSection 
        seo={config.seo}
        identity={config.identity}
        onChange={updateSEO}
      />
      
      <PWASection
        pwa={config.pwa}
        onChange={updatePWA}
      />
      
      <VariablesSection
        variables={config.variables}
        onChange={(variables) => updateConfig({ variables })}
      />
    </BasePanel>
  );
}
```

### 2. Identity Section

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/IdentitySection.tsx`

```tsx
import React from 'react';
import { AppIdentity } from '@noodl/runtime/src/config/types';

import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { PropertyPanelTextArea } from '@noodl-core-ui/components/property-panel/PropertyPanelTextArea';
import { ImagePicker } from '../../propertyeditor/DataTypes/ImagePicker';

interface IdentitySectionProps {
  identity: AppIdentity;
  onChange: (updates: Partial<AppIdentity>) => void;
}

export function IdentitySection({ identity, onChange }: IdentitySectionProps) {
  return (
    <CollapsableSection title="App Identity" hasGutter hasVisibleOverflow>
      <PropertyPanelRow label="App Name">
        <PropertyPanelTextInput
          value={identity.appName}
          onChange={(value) => onChange({ appName: value })}
          placeholder="My Noodl App"
        />
      </PropertyPanelRow>
      
      <PropertyPanelRow label="Description">
        <PropertyPanelTextArea
          value={identity.description}
          onChange={(value) => onChange({ description: value })}
          placeholder="Describe your app..."
          rows={3}
        />
      </PropertyPanelRow>
      
      <PropertyPanelRow label="Cover Image">
        <ImagePicker
          value={identity.coverImage}
          onChange={(value) => onChange({ coverImage: value })}
          placeholder="Select cover image..."
        />
      </PropertyPanelRow>
    </CollapsableSection>
  );
}
```

### 3. SEO Section

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/SEOSection.tsx`

```tsx
import React from 'react';
import { AppSEO, AppIdentity } from '@noodl/runtime/src/config/types';

import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { PropertyPanelColorPicker } from '@noodl-core-ui/components/property-panel/PropertyPanelColorPicker';
import { ImagePicker } from '../../propertyeditor/DataTypes/ImagePicker';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { Box } from '@noodl-core-ui/components/layout/Box';

interface SEOSectionProps {
  seo: AppSEO;
  identity: AppIdentity;
  onChange: (updates: Partial<AppSEO>) => void;
}

export function SEOSection({ seo, identity, onChange }: SEOSectionProps) {
  return (
    <CollapsableSection title="SEO & Metadata" hasGutter hasVisibleOverflow>
      <PropertyPanelRow label="OG Title">
        <PropertyPanelTextInput
          value={seo.ogTitle || ''}
          onChange={(value) => onChange({ ogTitle: value || undefined })}
          placeholder={identity.appName || 'Defaults to App Name'}
        />
      </PropertyPanelRow>
      <Box hasBottomSpacing>
        <Text textType="shy">Defaults to App Name if empty</Text>
      </Box>
      
      <PropertyPanelRow label="OG Description">
        <PropertyPanelTextInput
          value={seo.ogDescription || ''}
          onChange={(value) => onChange({ ogDescription: value || undefined })}
          placeholder={identity.description ? 'Defaults to Description' : 'Enter description...'}
        />
      </PropertyPanelRow>
      <Box hasBottomSpacing>
        <Text textType="shy">Defaults to Description if empty</Text>
      </Box>
      
      <PropertyPanelRow label="OG Image">
        <ImagePicker
          value={seo.ogImage}
          onChange={(value) => onChange({ ogImage: value })}
          placeholder="Defaults to Cover Image"
        />
      </PropertyPanelRow>
      
      <PropertyPanelRow label="Favicon">
        <ImagePicker
          value={seo.favicon}
          onChange={(value) => onChange({ favicon: value })}
          placeholder="Select favicon..."
          accept=".ico,.png,.svg"
        />
      </PropertyPanelRow>
      
      <PropertyPanelRow label="Theme Color">
        <PropertyPanelColorPicker
          value={seo.themeColor}
          onChange={(value) => onChange({ themeColor: value })}
        />
      </PropertyPanelRow>
    </CollapsableSection>
  );
}
```

### 4. PWA Section

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/PWASection.tsx`

```tsx
import React from 'react';
import { AppPWA } from '@noodl/runtime/src/config/types';

import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PropertyPanelColorPicker } from '@noodl-core-ui/components/property-panel/PropertyPanelColorPicker';
import { ImagePicker } from '../../propertyeditor/DataTypes/ImagePicker';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { Box } from '@noodl-core-ui/components/layout/Box';

interface PWASectionProps {
  pwa?: AppPWA;
  onChange: (updates: Partial<AppPWA>) => void;
}

const DISPLAY_OPTIONS = [
  { value: 'standalone', label: 'Standalone' },
  { value: 'fullscreen', label: 'Fullscreen' },
  { value: 'minimal-ui', label: 'Minimal UI' },
  { value: 'browser', label: 'Browser' }
];

export function PWASection({ pwa, onChange }: PWASectionProps) {
  const enabled = pwa?.enabled ?? false;
  
  return (
    <CollapsableSection 
      title="PWA Configuration" 
      hasGutter 
      hasVisibleOverflow
      hasTopDivider
      isClosed={!enabled}
      headerContent={
        <PropertyPanelCheckbox
          value={enabled}
          onChange={(value) => onChange({ enabled: value })}
        />
      }
    >
      {enabled && (
        <>
          <PropertyPanelRow label="Short Name">
            <PropertyPanelTextInput
              value={pwa?.shortName || ''}
              onChange={(value) => onChange({ shortName: value })}
              placeholder="Short app name for home screen"
            />
          </PropertyPanelRow>
          
          <PropertyPanelRow label="Display Mode">
            <PropertyPanelSelectInput
              value={pwa?.display || 'standalone'}
              options={DISPLAY_OPTIONS}
              onChange={(value) => onChange({ display: value as AppPWA['display'] })}
            />
          </PropertyPanelRow>
          
          <PropertyPanelRow label="Start URL">
            <PropertyPanelTextInput
              value={pwa?.startUrl || '/'}
              onChange={(value) => onChange({ startUrl: value || '/' })}
              placeholder="/"
            />
          </PropertyPanelRow>
          
          <PropertyPanelRow label="Background Color">
            <PropertyPanelColorPicker
              value={pwa?.backgroundColor}
              onChange={(value) => onChange({ backgroundColor: value })}
            />
          </PropertyPanelRow>
          
          <PropertyPanelRow label="App Icon">
            <ImagePicker
              value={pwa?.sourceIcon}
              onChange={(value) => onChange({ sourceIcon: value })}
              placeholder="512x512 PNG recommended"
              accept=".png"
            />
          </PropertyPanelRow>
          <Box hasBottomSpacing>
            <Text textType="shy">
              Provide a 512x512 PNG. Smaller sizes will be generated automatically.
            </Text>
          </Box>
        </>
      )}
    </CollapsableSection>
  );
}
```

### 5. Variables Section

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariablesSection.tsx`

```tsx
import React, { useState, useMemo } from 'react';
import { ConfigVariable, ConfigType } from '@noodl/runtime/src/config/types';

import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { IconName } from '@noodl-core-ui/components/common/Icon';

import { VariableGroup } from './VariableGroup';
import { AddVariableDialog } from '../dialogs/AddVariableDialog';

interface VariablesSectionProps {
  variables: ConfigVariable[];
  onChange: (variables: ConfigVariable[]) => void;
}

export function VariablesSection({ variables, onChange }: VariablesSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<ConfigVariable | null>(null);
  
  // Group variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, ConfigVariable[]> = {};
    
    for (const variable of variables) {
      const category = variable.category || 'Custom';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(variable);
    }
    
    return groups;
  }, [variables]);
  
  const handleAddVariable = (variable: ConfigVariable) => {
    onChange([...variables, variable]);
    setShowAddDialog(false);
  };
  
  const handleUpdateVariable = (key: string, updates: Partial<ConfigVariable>) => {
    onChange(variables.map(v => 
      v.key === key ? { ...v, ...updates } : v
    ));
  };
  
  const handleDeleteVariable = (key: string) => {
    onChange(variables.filter(v => v.key !== key));
  };
  
  const handleEditVariable = (variable: ConfigVariable) => {
    setEditingVariable(variable);
    setShowAddDialog(true);
  };
  
  const handleSaveEdit = (variable: ConfigVariable) => {
    if (editingVariable) {
      // If key changed, remove old and add new
      if (editingVariable.key !== variable.key) {
        onChange([
          ...variables.filter(v => v.key !== editingVariable.key),
          variable
        ]);
      } else {
        handleUpdateVariable(variable.key, variable);
      }
    }
    setEditingVariable(null);
    setShowAddDialog(false);
  };
  
  return (
    <CollapsableSection 
      title="Configuration Variables" 
      hasGutter 
      hasVisibleOverflow
      hasTopDivider
      headerContent={
        <PrimaryButton
          icon={IconName.Plus}
          size={PrimaryButtonSize.Small}
          variant={PrimaryButtonVariant.Ghost}
          onClick={() => setShowAddDialog(true)}
          label="Add"
        />
      }
    >
      {Object.entries(groupedVariables).map(([category, vars]) => (
        <VariableGroup
          key={category}
          category={category}
          variables={vars}
          onUpdate={handleUpdateVariable}
          onDelete={handleDeleteVariable}
          onEdit={handleEditVariable}
        />
      ))}
      
      {variables.length === 0 && (
        <Text textType="shy">
          No custom variables defined. Click "Add" to create one.
        </Text>
      )}
      
      {showAddDialog && (
        <AddVariableDialog
          existingKeys={variables.map(v => v.key)}
          editingVariable={editingVariable}
          onSave={editingVariable ? handleSaveEdit : handleAddVariable}
          onCancel={() => {
            setShowAddDialog(false);
            setEditingVariable(null);
          }}
        />
      )}
    </CollapsableSection>
  );
}
```

### 6. Variable Group Component

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariableGroup.tsx`

```tsx
import React from 'react';
import { ConfigVariable } from '@noodl/runtime/src/config/types';

import { Box } from '@noodl-core-ui/components/layout/Box';
import { Text } from '@noodl-core-ui/components/typography/Text';

import { VariableRow } from './VariableRow';

import css from './VariableGroup.module.scss';

interface VariableGroupProps {
  category: string;
  variables: ConfigVariable[];
  onUpdate: (key: string, updates: Partial<ConfigVariable>) => void;
  onDelete: (key: string) => void;
  onEdit: (variable: ConfigVariable) => void;
}

export function VariableGroup({ 
  category, 
  variables, 
  onUpdate, 
  onDelete,
  onEdit 
}: VariableGroupProps) {
  return (
    <Box className={css.Root}>
      <Text className={css.CategoryLabel}>{category}</Text>
      <div className={css.VariablesList}>
        {variables.map(variable => (
          <VariableRow
            key={variable.key}
            variable={variable}
            onUpdate={(updates) => onUpdate(variable.key, updates)}
            onDelete={() => onDelete(variable.key)}
            onEdit={() => onEdit(variable)}
          />
        ))}
      </div>
    </Box>
  );
}
```

### 7. Variable Row Component

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariableRow.tsx`

```tsx
import React from 'react';
import { ConfigVariable, ConfigType } from '@noodl/runtime/src/config/types';

import { IconName, Icon } from '@noodl-core-ui/components/common/Icon';
import { MenuDialog, MenuDialogItem } from '@noodl-core-ui/components/popups/MenuDialog';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import { TypeEditor } from './TypeEditor';

import css from './VariableRow.module.scss';

interface VariableRowProps {
  variable: ConfigVariable;
  onUpdate: (updates: Partial<ConfigVariable>) => void;
  onDelete: () => void;
  onEdit: () => void;
}

const TYPE_LABELS: Record<ConfigType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  color: 'Color',
  array: 'Array',
  object: 'Object'
};

export function VariableRow({ variable, onUpdate, onDelete, onEdit }: VariableRowProps) {
  const menuItems: MenuDialogItem[] = [
    { label: 'Edit', icon: IconName.Pencil, onClick: onEdit },
    { label: 'Delete', icon: IconName.Trash, isDangerousAction: true, onClick: onDelete }
  ];
  
  return (
    <div className={css.Root}>
      <div className={css.KeyColumn}>
        <Tooltip content={variable.description || `Type: ${TYPE_LABELS[variable.type]}`}>
          <span className={css.Key}>{variable.key}</span>
        </Tooltip>
        <span className={css.Type}>{variable.type}</span>
      </div>
      
      <div className={css.ValueColumn}>
        <TypeEditor
          type={variable.type}
          value={variable.value}
          onChange={(value) => onUpdate({ value })}
        />
      </div>
      
      <MenuDialog items={menuItems}>
        <button className={css.MenuButton}>
          <Icon icon={IconName.MoreVertical} />
        </button>
      </MenuDialog>
    </div>
  );
}
```

### 8. Type Editor Component

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/TypeEditor.tsx`

```tsx
import React from 'react';
import { ConfigType } from '@noodl/runtime/src/config/types';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { PropertyPanelNumberInput } from '@noodl-core-ui/components/property-panel/PropertyPanelNumberInput';
import { PropertyPanelCheckbox } from '@noodl-core-ui/components/property-panel/PropertyPanelCheckbox';
import { PropertyPanelColorPicker } from '@noodl-core-ui/components/property-panel/PropertyPanelColorPicker';
import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';

interface TypeEditorProps {
  type: ConfigType;
  value: any;
  onChange: (value: any) => void;
}

export function TypeEditor({ type, value, onChange }: TypeEditorProps) {
  switch (type) {
    case 'string':
      return (
        <PropertyPanelTextInput
          value={value || ''}
          onChange={onChange}
        />
      );
      
    case 'number':
      return (
        <PropertyPanelNumberInput
          value={value ?? 0}
          onChange={onChange}
        />
      );
      
    case 'boolean':
      return (
        <PropertyPanelCheckbox
          value={value ?? false}
          onChange={onChange}
        />
      );
      
    case 'color':
      return (
        <PropertyPanelColorPicker
          value={value}
          onChange={onChange}
        />
      );
      
    case 'array':
      return (
        <PropertyPanelButton
          label="Edit Array..."
          onClick={() => {
            // Open array editor popup
            // Reuse existing array editor from port types
          }}
        />
      );
      
    case 'object':
      return (
        <PropertyPanelButton
          label="Edit Object..."
          onClick={() => {
            // Open object editor popup
            // Reuse existing object editor from port types
          }}
        />
      );
      
    default:
      return <span>Unknown type</span>;
  }
}
```

### 9. Add Variable Dialog

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/dialogs/AddVariableDialog.tsx`

```tsx
import React, { useState } from 'react';
import { ConfigVariable, ConfigType } from '@noodl/runtime/src/config/types';
import { validateConfigKey } from '@noodl/runtime/src/config/validation';

import { DialogRender } from '@noodl-core-ui/components/layout/DialogRender';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { Text } from '@noodl-core-ui/components/typography/Text';

interface AddVariableDialogProps {
  existingKeys: string[];
  editingVariable?: ConfigVariable | null;
  onSave: (variable: ConfigVariable) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'color', label: 'Color' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' }
];

export function AddVariableDialog({ 
  existingKeys, 
  editingVariable, 
  onSave, 
  onCancel 
}: AddVariableDialogProps) {
  const [key, setKey] = useState(editingVariable?.key || '');
  const [type, setType] = useState<ConfigType>(editingVariable?.type || 'string');
  const [description, setDescription] = useState(editingVariable?.description || '');
  const [category, setCategory] = useState(editingVariable?.category || '');
  const [error, setError] = useState<string | null>(null);
  
  const isEditing = !!editingVariable;
  
  const handleSave = () => {
    // Validate key
    const validation = validateConfigKey(key);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }
    
    // Check for duplicates (unless editing same key)
    if (!isEditing || key !== editingVariable?.key) {
      if (existingKeys.includes(key)) {
        setError('A variable with this key already exists');
        return;
      }
    }
    
    const variable: ConfigVariable = {
      key,
      type,
      value: editingVariable?.value ?? getDefaultValue(type),
      description: description || undefined,
      category: category || undefined
    };
    
    onSave(variable);
  };
  
  return (
    <DialogRender
      title={isEditing ? 'Edit Variable' : 'Add Variable'}
      onClose={onCancel}
      footer={
        <>
          <PrimaryButton label="Cancel" variant="ghost" onClick={onCancel} />
          <PrimaryButton label={isEditing ? 'Save' : 'Add'} onClick={handleSave} />
        </>
      }
    >
      <PropertyPanelRow label="Key">
        <PropertyPanelTextInput
          value={key}
          onChange={(v) => { setKey(v); setError(null); }}
          placeholder="myVariable"
          hasError={!!error}
        />
      </PropertyPanelRow>
      {error && <Text textType="danger">{error}</Text>}
      
      <PropertyPanelRow label="Type">
        <PropertyPanelSelectInput
          value={type}
          options={TYPE_OPTIONS}
          onChange={(v) => setType(v as ConfigType)}
          isDisabled={isEditing} // Can't change type when editing
        />
      </PropertyPanelRow>
      
      <PropertyPanelRow label="Description">
        <PropertyPanelTextInput
          value={description}
          onChange={setDescription}
          placeholder="Optional description..."
        />
      </PropertyPanelRow>
      
      <PropertyPanelRow label="Category">
        <PropertyPanelTextInput
          value={category}
          onChange={setCategory}
          placeholder="Custom"
        />
      </PropertyPanelRow>
    </DialogRender>
  );
}

function getDefaultValue(type: ConfigType): any {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'color': return '#000000';
    case 'array': return [];
    case 'object': return {};
  }
}
```

---

## Files to Modify

### 1. Sidebar Navigation

**File:** `packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx`

Add App Setup tab to sidebar:

```tsx
// Add to sidebar tabs
{
  id: 'app-setup',
  label: 'App Setup',
  icon: IconName.Settings, // or appropriate icon
  panel: AppSetupPanel
}
```

### 2. Migrate Project Settings

**File:** `packages/noodl-editor/src/editor/src/views/panels/ProjectSettingsPanel/`

Move the following to App Setup:
- Project name (becomes App Name in Identity)
- Consider migrating other relevant settings

---

## Styles

### Variable Group Styles

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariableGroup.module.scss`

```scss
.Root {
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  border-radius: var(--radius-default);
  padding: var(--spacing-2);
  margin-bottom: var(--spacing-2);
}

.CategoryLabel {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  letter-spacing: var(--text-label-letter-spacing);
  color: var(--theme-color-fg-muted);
  text-transform: uppercase;
  margin-bottom: var(--spacing-2);
}

.VariablesList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}
```

### Variable Row Styles

**File:** `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariableRow.module.scss`

```scss
.Root {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) 0;
}

.KeyColumn {
  flex: 0 0 120px;
  display: flex;
  flex-direction: column;
}

.Key {
  font-weight: var(--font-weight-medium);
  color: var(--theme-color-fg-default);
}

.Type {
  font-size: var(--font-size-xs);
  color: var(--theme-color-fg-muted);
}

.ValueColumn {
  flex: 1;
  min-width: 0;
}

.MenuButton {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-default);
  color: var(--theme-color-fg-muted);
  cursor: pointer;
  
  &:hover {
    background-color: var(--theme-color-bg-hover);
    color: var(--theme-color-fg-default);
  }
}
```

---

## Testing Checklist

### Functional Tests

- [ ] App Setup panel appears in sidebar
- [ ] Can edit App Name
- [ ] Can edit Description (multiline)
- [ ] Can upload/select Cover Image
- [ ] SEO fields show defaults when empty
- [ ] Can override SEO fields
- [ ] Can enable/disable PWA section
- [ ] PWA fields editable when enabled
- [ ] Can add new variable
- [ ] Can edit existing variable
- [ ] Can delete variable
- [ ] Type editor matches variable type
- [ ] Color picker works
- [ ] Array editor opens
- [ ] Object editor opens
- [ ] Categories group correctly
- [ ] Uncategorized → "Custom"
- [ ] Validation prevents duplicate keys
- [ ] Validation prevents reserved keys
- [ ] Validation prevents invalid key names

### Visual Tests

- [ ] Panel matches design mockup
- [ ] Sections collapsible
- [ ] Proper spacing and alignment
- [ ] Dark theme compatible
- [ ] Responsive to panel width

---

## Notes for Implementer

### Reusing Port Type Editors

The existing port type editors in `views/panels/propertyeditor/DataTypes/Ports.ts` handle most input types. Consider extracting shared components or directly importing the editor logic for consistency.

### Image Picker

Create a shared ImagePicker component that can:
- Browse project files
- Upload new images
- Accept URL input
- Show preview thumbnail

### Array/Object Editors

Reuse the existing popup editors for array and object types. These are used in the Static Array node and Function node.
