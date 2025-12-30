# CONFIG-006: Expression System Integration

## Overview

Integrate `Noodl.Config` access into the expression evaluator with autocomplete support for config keys.

**Estimated effort:** 4-6 hours  
**Dependencies:** CONFIG-001, TASK-006 (Expression System Overhaul)  
**Blocks:** None

---

## Objectives

1. Make `Noodl.Config` accessible in Expression nodes
2. Add autocomplete for config keys in expression editor
3. Provide type hints for config values
4. Handle undefined config keys gracefully

---

## Expression Usage Examples

```javascript
// Simple value access
Noodl.Config.appName

// Color in style binding
Noodl.Config.primaryColor

// Conditional with config
Noodl.Config.pwaEnabled ? "Install App" : "Use in Browser"

// Template literal
`Welcome to ${Noodl.Config.appName}!`

// Array access
Noodl.Config.menuItems[0].label

// Object property
Noodl.Config.apiSettings.timeout
```

---

## Files to Modify

### 1. Expression Evaluator Context

**File:** `packages/noodl-runtime/src/nodes/std-library/expression.js` (or new expression-evaluator module from TASK-006)

Add Noodl.Config to the expression context:

```javascript
// In the expression preamble or context setup
const { configManager } = require('../../../config/config-manager');

function createExpressionContext() {
  return {
    // Math helpers
    min: Math.min,
    max: Math.max,
    cos: Math.cos,
    sin: Math.sin,
    // ... other existing helpers ...
    
    // Noodl globals
    Noodl: {
      Variables: Model.get('--ndl--global-variables'),
      Objects: objectsProxy,
      Arrays: arraysProxy,
      Config: configManager.getConfig()  // Add Config access
    }
  };
}
```

If following TASK-006's enhanced expression node pattern:

**File:** `packages/noodl-runtime/src/expression-evaluator.ts`

```typescript
import { configManager } from './config/config-manager';

export function createExpressionContext(nodeContext: NodeContext): ExpressionContext {
  return {
    // ... existing context ...
    
    Noodl: {
      // ... existing Noodl properties ...
      Config: configManager.getConfig()
    }
  };
}
```

### 2. Expression Editor Autocomplete

**File:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/` (or relevant autocomplete module)

Add Config keys to autocomplete suggestions:

```typescript
import { ProjectModel } from '@noodl-models/projectmodel';
import { AppConfig } from '@noodl/runtime/src/config/types';

interface AutocompleteItem {
  label: string;
  kind: 'property' | 'method' | 'variable';
  detail?: string;
  documentation?: string;
}

function getConfigAutocompletions(prefix: string): AutocompleteItem[] {
  const config = ProjectModel.instance.getAppConfig();
  const items: AutocompleteItem[] = [];
  
  // Built-in config keys
  const builtInKeys = [
    { key: 'appName', type: 'string', doc: 'Application name' },
    { key: 'description', type: 'string', doc: 'Application description' },
    { key: 'coverImage', type: 'string', doc: 'Cover image path' },
    { key: 'ogTitle', type: 'string', doc: 'Open Graph title' },
    { key: 'ogDescription', type: 'string', doc: 'Open Graph description' },
    { key: 'ogImage', type: 'string', doc: 'Open Graph image' },
    { key: 'favicon', type: 'string', doc: 'Favicon path' },
    { key: 'themeColor', type: 'color', doc: 'Theme color' },
    { key: 'pwaEnabled', type: 'boolean', doc: 'PWA enabled state' },
    { key: 'pwaShortName', type: 'string', doc: 'PWA short name' },
    { key: 'pwaDisplay', type: 'string', doc: 'PWA display mode' },
    { key: 'pwaStartUrl', type: 'string', doc: 'PWA start URL' },
    { key: 'pwaBackgroundColor', type: 'color', doc: 'PWA background color' }
  ];
  
  // Add built-in keys
  for (const { key, type, doc } of builtInKeys) {
    if (key.startsWith(prefix)) {
      items.push({
        label: key,
        kind: 'property',
        detail: type,
        documentation: doc
      });
    }
  }
  
  // Add custom variables
  for (const variable of config.variables) {
    if (variable.key.startsWith(prefix)) {
      items.push({
        label: variable.key,
        kind: 'property',
        detail: variable.type,
        documentation: variable.description
      });
    }
  }
  
  return items;
}

// In the autocomplete provider
function provideCompletions(
  model: editor.ITextModel,
  position: Position
): CompletionList {
  const lineContent = model.getLineContent(position.lineNumber);
  const beforeCursor = lineContent.substring(0, position.column - 1);
  
  // Check if typing after "Noodl.Config."
  const configMatch = beforeCursor.match(/Noodl\.Config\.(\w*)$/);
  if (configMatch) {
    const prefix = configMatch[1];
    const items = getConfigAutocompletions(prefix);
    
    return {
      suggestions: items.map(item => ({
        label: item.label,
        kind: monaco.languages.CompletionItemKind.Property,
        detail: item.detail,
        documentation: item.documentation,
        insertText: item.label,
        range: new Range(
          position.lineNumber,
          position.column - prefix.length,
          position.lineNumber,
          position.column
        )
      }))
    };
  }
  
  // Check if typing "Noodl."
  const noodlMatch = beforeCursor.match(/Noodl\.(\w*)$/);
  if (noodlMatch) {
    const prefix = noodlMatch[1];
    const noodlProps = ['Variables', 'Objects', 'Arrays', 'Config'];
    
    return {
      suggestions: noodlProps
        .filter(p => p.startsWith(prefix))
        .map(prop => ({
          label: prop,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: prop,
          range: new Range(
            position.lineNumber,
            position.column - prefix.length,
            position.lineNumber,
            position.column
          )
        }))
    };
  }
  
  return { suggestions: [] };
}
```

### 3. Type Hints

**File:** Add type inference for config values

```typescript
function getConfigValueType(key: string): string {
  const config = ProjectModel.instance.getAppConfig();
  
  // Check custom variables first
  const variable = config.variables.find(v => v.key === key);
  if (variable) {
    return variable.type;
  }
  
  // Built-in type mappings
  const typeMap: Record<string, string> = {
    appName: 'string',
    description: 'string',
    coverImage: 'string',
    ogTitle: 'string',
    ogDescription: 'string',
    ogImage: 'string',
    favicon: 'string',
    themeColor: 'color',
    pwaEnabled: 'boolean',
    pwaShortName: 'string',
    pwaDisplay: 'string',
    pwaStartUrl: 'string',
    pwaBackgroundColor: 'color'
  };
  
  return typeMap[key] || 'any';
}
```

### 4. Error Handling

**File:** `packages/noodl-runtime/src/config/config-manager.ts`

Ensure graceful handling of undefined keys:

```typescript
// In the config proxy (from CONFIG-001)
get(target, prop: string) {
  if (prop in target) {
    return target[prop];
  }
  
  // Log warning in development
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `Noodl.Config.${prop} is not defined. ` +
      `Add it in App Setup or check for typos.`
    );
  }
  
  return undefined;
}
```

---

## Type Declarations Update

**File:** `packages/noodl-viewer-react/static/viewer/global.d.ts.keep`

Enhance the Config type declaration with JSDoc:

```typescript
declare namespace Noodl {
  /**
   * App configuration values defined in App Setup.
   * 
   * Config values are static and cannot be modified at runtime.
   * Use `Noodl.Variables` for values that need to change.
   * 
   * @example
   * // Access app name
   * const name = Noodl.Config.appName;
   * 
   * // Use in template literal
   * const greeting = `Welcome to ${Noodl.Config.appName}!`;
   * 
   * // Access custom variable
   * const color = Noodl.Config.primaryColor;
   * 
   * @see https://docs.noodl.net/config
   */
  const Config: Readonly<{
    /** Application name */
    readonly appName: string;
    
    /** Application description */
    readonly description: string;
    
    /** Cover image path or URL */
    readonly coverImage?: string;
    
    /** Open Graph title (defaults to appName) */
    readonly ogTitle: string;
    
    /** Open Graph description (defaults to description) */
    readonly ogDescription: string;
    
    /** Open Graph image path or URL */
    readonly ogImage?: string;
    
    /** Favicon path or URL */
    readonly favicon?: string;
    
    /** Theme color (hex format) */
    readonly themeColor?: string;
    
    /** Whether PWA is enabled */
    readonly pwaEnabled: boolean;
    
    /** PWA short name */
    readonly pwaShortName?: string;
    
    /** PWA display mode */
    readonly pwaDisplay?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
    
    /** PWA start URL */
    readonly pwaStartUrl?: string;
    
    /** PWA background color */
    readonly pwaBackgroundColor?: string;
    
    /** Custom configuration variables */
    readonly [key: string]: any;
  }>;
}
```

---

## Testing Checklist

### Expression Access

- [ ] `Noodl.Config.appName` returns correct value
- [ ] `Noodl.Config.primaryColor` returns color value
- [ ] `Noodl.Config.menuItems` returns array
- [ ] Nested access works: `Noodl.Config.menuItems[0].label`
- [ ] Template literals work: `` `Hello ${Noodl.Config.appName}` ``
- [ ] Undefined keys return undefined (no crash)
- [ ] Warning logged for undefined keys in dev

### Autocomplete

- [ ] Typing "Noodl." suggests "Config"
- [ ] Typing "Noodl.Config." shows all config keys
- [ ] Built-in keys show correct types
- [ ] Custom variables appear in suggestions
- [ ] Variable descriptions show in autocomplete
- [ ] Autocomplete filters as you type

### Integration

- [ ] Works in Expression nodes
- [ ] Works in Function nodes
- [ ] Works in Script nodes
- [ ] Works in inline expressions (if TASK-006 complete)
- [ ] Values update when config changes (editor refresh)

---

## Notes for Implementer

### TASK-006 Dependency

This task should be implemented alongside or after TASK-006 (Expression System Overhaul). If TASK-006 introduces a new expression evaluator module, integrate Config there. Otherwise, update the existing expression.js.

### Monaco Editor

The autocomplete examples assume Monaco editor is used. Adjust the implementation based on the actual editor component used in the expression input fields.

### Performance

The config object is frozen and created once at startup. Accessing it in expressions should have minimal performance impact. However, avoid calling `getConfig()` repeatedly - cache the reference.

### Cloud Functions

Remember to also update `packages/noodl-viewer-cloud/src/noodl-js-api.js` if cloud functions need Config access.
