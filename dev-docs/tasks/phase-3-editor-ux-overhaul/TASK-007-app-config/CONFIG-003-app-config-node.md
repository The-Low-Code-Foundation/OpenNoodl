# CONFIG-003: App Config Node

## Overview

Create an "App Config" node that provides selected configuration values as outputs, for users who prefer visual programming over expressions.

**Estimated effort:** 10-14 hours  
**Dependencies:** CONFIG-001  
**Blocks:** None

---

## Objectives

1. Create App Config node with selectable variable outputs
2. Preserve output types (color outputs as color, etc.)
3. Integrate with node picker
4. Rename existing "Config" node to "Noodl Cloud Config"
5. Hide cloud data nodes when no backend connected

---

## Node Design

### App Config Node

```
┌──────────────────────────────┐
│ App Config                   │
├──────────────────────────────┤
│ Variables                    │
│ ┌──────────────────────────┐ │
│ │ ☑ appName                │ │
│ │ ☑ primaryColor           │ │
│ │ ☐ description            │ │
│ │ ☑ apiBaseUrl             │ │
│ │ ☑ menuItems              │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│              ○ appName       │──→ string
│              ○ primaryColor  │──→ color
│              ○ apiBaseUrl    │──→ string
│              ○ menuItems     │──→ array
└──────────────────────────────┘
```

---

## Files to Create

### 1. App Config Node

**File:** `packages/noodl-runtime/src/nodes/std-library/data/appconfignode.js`

```javascript
'use strict';

const { configManager } = require('../../../config/config-manager');

const AppConfigNode = {
  name: 'App Config',
  displayName: 'App Config',
  docs: 'https://docs.noodl.net/nodes/data/app-config',
  shortDesc: 'Access app configuration values defined in App Setup.',
  category: 'Variables',
  color: 'data',
  
  initialize: function() {
    this._internal.outputValues = {};
  },
  
  getInspectInfo() {
    const selected = this._internal.selectedVariables || [];
    if (selected.length === 0) {
      return [{ type: 'text', value: 'No variables selected' }];
    }
    
    return selected.map(key => ({
      type: 'text',
      value: `${key}: ${JSON.stringify(this._internal.outputValues[key])}`
    }));
  },
  
  inputs: {
    variables: {
      type: {
        name: 'stringlist',
        allowEditOnly: true,
        multiline: true
      },
      displayName: 'Variables',
      group: 'General',
      set: function(value) {
        // Parse selected variables from stringlist
        const selected = Array.isArray(value) ? value : 
                         (typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : []);
        
        this._internal.selectedVariables = selected;
        
        // Update output values
        const config = configManager.getConfig();
        for (const key of selected) {
          this._internal.outputValues[key] = config[key];
        }
        
        // Flag all outputs as dirty
        selected.forEach(key => {
          if (this.hasOutput('out-' + key)) {
            this.flagOutputDirty('out-' + key);
          }
        });
      }
    }
  },
  
  outputs: {},
  
  methods: {
    registerOutputIfNeeded: function(name) {
      if (this.hasOutput(name)) return;
      
      if (name.startsWith('out-')) {
        const key = name.substring(4);
        const config = configManager.getConfig();
        const variable = configManager.getVariable(key);
        
        // Determine output type based on variable type or infer from value
        let outputType = '*';
        if (variable) {
          outputType = variable.type;
        } else if (key in config) {
          // Built-in config - infer type
          const value = config[key];
          if (typeof value === 'string') {
            outputType = key.toLowerCase().includes('color') ? 'color' : 'string';
          } else if (typeof value === 'number') {
            outputType = 'number';
          } else if (typeof value === 'boolean') {
            outputType = 'boolean';
          } else if (Array.isArray(value)) {
            outputType = 'array';
          } else if (typeof value === 'object') {
            outputType = 'object';
          }
        }
        
        this.registerOutput(name, {
          type: outputType,
          getter: function() {
            return this._internal.outputValues[key];
          }
        });
      }
    }
  }
};

function updatePorts(nodeId, parameters, editorConnection, graphModel) {
  const ports = [];
  
  // Get available config keys
  const allKeys = getAvailableConfigKeys(graphModel);
  
  // Get selected variables
  const selected = parameters.variables ? 
    (Array.isArray(parameters.variables) ? parameters.variables :
     parameters.variables.split(',').map(s => s.trim()).filter(Boolean)) : [];
  
  // Create output ports for selected variables
  selected.forEach(key => {
    const variable = graphModel.getMetaData('appConfig')?.variables?.find(v => v.key === key);
    let type = '*';
    
    if (variable) {
      type = variable.type;
    } else if (isBuiltInKey(key)) {
      type = getBuiltInType(key);
    }
    
    ports.push({
      name: 'out-' + key,
      displayName: key,
      plug: 'output',
      type: type,
      group: 'Values'
    });
  });
  
  editorConnection.sendDynamicPorts(nodeId, ports);
}

function getAvailableConfigKeys(graphModel) {
  const config = graphModel.getMetaData('appConfig') || {};
  const keys = [];
  
  // Built-in keys
  keys.push('appName', 'description', 'coverImage');
  keys.push('ogTitle', 'ogDescription', 'ogImage', 'favicon', 'themeColor');
  keys.push('pwaEnabled', 'pwaShortName', 'pwaDisplay', 'pwaStartUrl', 'pwaBackgroundColor');
  
  // Custom variables
  if (config.variables) {
    config.variables.forEach(v => keys.push(v.key));
  }
  
  return keys;
}

function isBuiltInKey(key) {
  const builtIn = [
    'appName', 'description', 'coverImage',
    'ogTitle', 'ogDescription', 'ogImage', 'favicon', 'themeColor',
    'pwaEnabled', 'pwaShortName', 'pwaDisplay', 'pwaStartUrl', 'pwaBackgroundColor'
  ];
  return builtIn.includes(key);
}

function getBuiltInType(key) {
  const colorKeys = ['themeColor', 'pwaBackgroundColor'];
  const booleanKeys = ['pwaEnabled'];
  
  if (colorKeys.includes(key)) return 'color';
  if (booleanKeys.includes(key)) return 'boolean';
  return 'string';
}

module.exports = {
  node: AppConfigNode,
  setup: function(context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    
    function _managePortsForNode(node) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      
      node.on('parameterUpdated', function(event) {
        if (event.name === 'variables') {
          updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
        }
      });
      
      // Also update when app config changes
      graphModel.on('metadataChanged.appConfig', function() {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }
    
    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.App Config', function(node) {
        _managePortsForNode(node);
      });
      
      for (const node of graphModel.getNodesWithType('App Config')) {
        _managePortsForNode(node);
      }
    });
  }
};
```

### 2. Variable Selector Property Editor

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/ConfigVariableSelector.tsx`

```tsx
import React, { useState, useMemo } from 'react';
import { ProjectModel } from '@noodl-models/projectmodel';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Text } from '@noodl-core-ui/components/typography/Text';

import css from './ConfigVariableSelector.module.scss';

interface ConfigVariableSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

interface VariableOption {
  key: string;
  type: string;
  category: string;
}

export function ConfigVariableSelector({ value, onChange }: ConfigVariableSelectorProps) {
  const selected = new Set(value);
  
  const options = useMemo(() => {
    const config = ProjectModel.instance.getAppConfig();
    const opts: VariableOption[] = [];
    
    // Built-in: Identity
    opts.push(
      { key: 'appName', type: 'string', category: 'Identity' },
      { key: 'description', type: 'string', category: 'Identity' },
      { key: 'coverImage', type: 'string', category: 'Identity' }
    );
    
    // Built-in: SEO
    opts.push(
      { key: 'ogTitle', type: 'string', category: 'SEO' },
      { key: 'ogDescription', type: 'string', category: 'SEO' },
      { key: 'ogImage', type: 'string', category: 'SEO' },
      { key: 'favicon', type: 'string', category: 'SEO' },
      { key: 'themeColor', type: 'color', category: 'SEO' }
    );
    
    // Built-in: PWA
    opts.push(
      { key: 'pwaEnabled', type: 'boolean', category: 'PWA' },
      { key: 'pwaShortName', type: 'string', category: 'PWA' },
      { key: 'pwaDisplay', type: 'string', category: 'PWA' },
      { key: 'pwaStartUrl', type: 'string', category: 'PWA' },
      { key: 'pwaBackgroundColor', type: 'color', category: 'PWA' }
    );
    
    // Custom variables
    config.variables.forEach(v => {
      opts.push({
        key: v.key,
        type: v.type,
        category: v.category || 'Custom'
      });
    });
    
    return opts;
  }, []);
  
  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, VariableOption[]> = {};
    options.forEach(opt => {
      if (!groups[opt.category]) {
        groups[opt.category] = [];
      }
      groups[opt.category].push(opt);
    });
    return groups;
  }, [options]);
  
  const toggleVariable = (key: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onChange(Array.from(newSelected));
  };
  
  return (
    <div className={css.Root}>
      {Object.entries(grouped).map(([category, vars]) => (
        <div key={category} className={css.Category}>
          <Text className={css.CategoryLabel}>{category}</Text>
          {vars.map(v => (
            <label key={v.key} className={css.VariableRow}>
              <Checkbox
                isChecked={selected.has(v.key)}
                onChange={() => toggleVariable(v.key)}
              />
              <span className={css.VariableKey}>{v.key}</span>
              <span className={css.VariableType}>{v.type}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## Files to Modify

### 1. Rename Existing Config Node

**File:** `packages/noodl-runtime/src/nodes/std-library/data/confignode.js`

```javascript
// Change:
name: 'Config',
displayName: 'Config',

// To:
name: 'Noodl Cloud Config',
displayName: 'Noodl Cloud Config',
shortDesc: 'Access configuration from Noodl Cloud Service.',
```

### 2. Update Node Library Export

**File:** `packages/noodl-runtime/src/nodelibraryexport.js`

```javascript
// Add App Config node
require('./src/nodes/std-library/data/appconfignode'),

// Update node picker categories
{
  name: 'Variables',
  items: [
    'Variable2',
    'SetVariable',
    'App Config',  // Add here
    // ...
  ]
}
```

### 3. Cloud Nodes Visibility

**File:** `packages/noodl-editor/src/editor/src/views/nodepicker/NodePicker.tsx` (or relevant file)

Add logic to hide cloud data nodes when no backend is connected:

```typescript
function shouldShowCloudNodes(): boolean {
  const cloudService = ProjectModel.instance.getMetaData('cloudservices');
  return cloudService && cloudService.endpoint;
}

function getFilteredCategories(categories: Category[]): Category[] {
  const showCloud = shouldShowCloudNodes();
  
  return categories.map(category => {
    if (category.name === 'Cloud Data' || category.name === 'Read & Write Data') {
      // Filter out cloud-specific nodes if no backend
      if (!showCloud) {
        const cloudNodes = [
          'DbCollection2', 
          'DbModel2', 
          'Noodl Cloud Config',  // Renamed node
          // ... other cloud nodes
        ];
        
        const filteredItems = category.items.filter(
          item => !cloudNodes.includes(item)
        );
        
        // Add warning message if category is now empty or reduced
        return {
          ...category,
          items: filteredItems,
          message: showCloud ? undefined : 'Please add a backend service to use cloud data nodes.'
        };
      }
    }
    return category;
  });
}
```

### 4. Register Node Type Editor

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts`

Add handler for the variables property in App Config node:

```typescript
// In the port type handlers
if (nodeName === 'App Config' && portName === 'variables') {
  return {
    component: ConfigVariableSelector,
    // ... props
  };
}
```

---

## Testing Checklist

### App Config Node

- [ ] Node appears in node picker under Variables
- [ ] Can select/deselect variables in property panel
- [ ] Selected variables appear as outputs
- [ ] Output types match variable types
- [ ] Color variables output as color type
- [ ] Array variables output as array type
- [ ] Values are correct at runtime
- [ ] Node inspector shows current values
- [ ] Updates when app config changes in editor

### Cloud Node Visibility

- [ ] Cloud nodes hidden when no backend
- [ ] Warning message shows in category
- [ ] Cloud nodes visible when backend connected
- [ ] Existing cloud nodes in projects still work
- [ ] Renamed node appears as "Noodl Cloud Config"

### Variable Selector

- [ ] Shows all built-in config keys
- [ ] Shows custom variables
- [ ] Grouped by category
- [ ] Shows variable type
- [ ] Checkbox toggles selection
- [ ] Multiple selection works

---

## Notes for Implementer

### Dynamic Port Pattern

This node uses the dynamic port pattern where outputs are created based on the `variables` property. Study existing nodes like `DbCollection2` for reference on how to:
- Parse the stringlist input
- Create dynamic output ports
- Handle port updates when parameters change

### Type Preservation

It's important that output types match the declared variable types so that connections in the graph validate correctly. A color output should only connect to color inputs, etc.

### Cloud Service Detection

The cloud service information is stored in project metadata under `cloudservices`. Check for both the existence of the object and a valid endpoint URL.
