# CONFIG-001: Core Infrastructure

## Overview

Implement the foundational `Noodl.Config` namespace, data model, project storage, and runtime initialization.

**Estimated effort:** 14-18 hours  
**Dependencies:** None  
**Blocks:** All other CONFIG subtasks

---

## Objectives

1. Create `Noodl.Config` as an immutable runtime namespace
2. Define TypeScript interfaces for configuration data
3. Implement storage in project.json metadata
4. Initialize config values at app startup
5. Establish default values for required fields

---

## Files to Create

### 1. Type Definitions

**File:** `packages/noodl-runtime/src/config/types.ts`

```typescript
export type ConfigType = 'string' | 'number' | 'boolean' | 'color' | 'array' | 'object';

export interface ConfigVariable {
  key: string;
  type: ConfigType;
  value: any;
  description?: string;
  category?: string;
  validation?: ConfigValidation;
}

export interface ConfigValidation {
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface AppIdentity {
  appName: string;
  description: string;
  coverImage?: string;
}

export interface AppSEO {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  favicon?: string;
  themeColor?: string;
}

export interface AppPWA {
  enabled: boolean;
  shortName?: string;
  startUrl: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  backgroundColor?: string;
  sourceIcon?: string;
}

export interface AppConfig {
  identity: AppIdentity;
  seo: AppSEO;
  pwa?: AppPWA;
  variables: ConfigVariable[];
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  identity: {
    appName: 'My Noodl App',
    description: ''
  },
  seo: {},
  variables: []
};
```

### 2. Config Manager (Runtime)

**File:** `packages/noodl-runtime/src/config/config-manager.ts`

```typescript
import { AppConfig, ConfigVariable, DEFAULT_APP_CONFIG } from './types';

class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig = DEFAULT_APP_CONFIG;
  private frozenConfig: Readonly<Record<string, any>> | null = null;
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  /**
   * Initialize config from project metadata.
   * Called once at app startup.
   */
  initialize(config: Partial<AppConfig>): void {
    this.config = {
      ...DEFAULT_APP_CONFIG,
      ...config,
      identity: {
        ...DEFAULT_APP_CONFIG.identity,
        ...config.identity
      },
      seo: {
        ...DEFAULT_APP_CONFIG.seo,
        ...config.seo
      }
    };
    
    // Build the frozen public config object
    this.frozenConfig = this.buildFrozenConfig();
  }
  
  /**
   * Get the immutable Noodl.Config object.
   */
  getConfig(): Readonly<Record<string, any>> {
    if (!this.frozenConfig) {
      this.frozenConfig = this.buildFrozenConfig();
    }
    return this.frozenConfig;
  }
  
  /**
   * Get raw config for editor use.
   */
  getRawConfig(): AppConfig {
    return this.config;
  }
  
  /**
   * Get a specific variable definition.
   */
  getVariable(key: string): ConfigVariable | undefined {
    return this.config.variables.find(v => v.key === key);
  }
  
  /**
   * Get all variable keys for autocomplete.
   */
  getVariableKeys(): string[] {
    return this.config.variables.map(v => v.key);
  }
  
  private buildFrozenConfig(): Readonly<Record<string, any>> {
    const config: Record<string, any> = {
      // Identity fields
      appName: this.config.identity.appName,
      description: this.config.identity.description,
      coverImage: this.config.identity.coverImage,
      
      // SEO fields (with defaults)
      ogTitle: this.config.seo.ogTitle || this.config.identity.appName,
      ogDescription: this.config.seo.ogDescription || this.config.identity.description,
      ogImage: this.config.seo.ogImage || this.config.identity.coverImage,
      favicon: this.config.seo.favicon,
      themeColor: this.config.seo.themeColor,
      
      // PWA fields
      pwaEnabled: this.config.pwa?.enabled ?? false,
      pwaShortName: this.config.pwa?.shortName,
      pwaDisplay: this.config.pwa?.display,
      pwaStartUrl: this.config.pwa?.startUrl,
      pwaBackgroundColor: this.config.pwa?.backgroundColor
    };
    
    // Add custom variables
    for (const variable of this.config.variables) {
      config[variable.key] = variable.value;
    }
    
    // Freeze to prevent mutation
    return Object.freeze(config);
  }
}

export const configManager = ConfigManager.getInstance();
```

### 3. Noodl.Config API

**File:** `packages/noodl-viewer-react/src/config-api.ts`

```typescript
import { configManager } from '@noodl/runtime/src/config/config-manager';

/**
 * Create the Noodl.Config proxy object.
 * Returns an immutable object that throws on write attempts.
 */
export function createConfigAPI(): Readonly<Record<string, any>> {
  const config = configManager.getConfig();
  
  return new Proxy(config, {
    get(target, prop: string) {
      if (prop in target) {
        return target[prop];
      }
      console.warn(`Noodl.Config.${prop} is not defined`);
      return undefined;
    },
    
    set(target, prop: string, value) {
      console.error(
        `Cannot set Noodl.Config.${prop} - Config values are immutable. ` +
        `Use Noodl.Variables for runtime-changeable values.`
      );
      return false;
    },
    
    deleteProperty(target, prop: string) {
      console.error(`Cannot delete Noodl.Config.${prop} - Config values are immutable.`);
      return false;
    }
  });
}
```

### 4. Update Noodl JS API

**File:** `packages/noodl-viewer-react/src/noodl-js-api.js` (modify)

Add Config to the Noodl namespace:

```javascript
// Add import
import { createConfigAPI } from './config-api';

// In the Noodl object initialization
const Noodl = {
  // ... existing properties
  Config: createConfigAPI(),
  // ...
};
```

---

## Files to Modify

### 1. Project Model

**File:** `packages/noodl-editor/src/editor/src/models/projectmodel.ts`

Add methods for app config:

```typescript
// Add to ProjectModel class

getAppConfig(): AppConfig {
  return this.getMetaData('appConfig') || DEFAULT_APP_CONFIG;
}

setAppConfig(config: AppConfig): void {
  this.setMetaData('appConfig', config);
}

updateAppConfig(updates: Partial<AppConfig>): void {
  const current = this.getAppConfig();
  this.setAppConfig({
    ...current,
    ...updates
  });
}

// Config variables helpers
getConfigVariables(): ConfigVariable[] {
  return this.getAppConfig().variables;
}

setConfigVariable(variable: ConfigVariable): void {
  const config = this.getAppConfig();
  const index = config.variables.findIndex(v => v.key === variable.key);
  
  if (index >= 0) {
    config.variables[index] = variable;
  } else {
    config.variables.push(variable);
  }
  
  this.setAppConfig(config);
}

removeConfigVariable(key: string): void {
  const config = this.getAppConfig();
  config.variables = config.variables.filter(v => v.key !== key);
  this.setAppConfig(config);
}
```

### 2. Runtime Initialization

**File:** `packages/noodl-viewer-react/src/index.js` (or equivalent entry)

Initialize config from project data:

```javascript
// During app initialization
import { configManager } from '@noodl/runtime/src/config/config-manager';

// After project data is loaded
const appConfig = projectData.metadata?.appConfig;
if (appConfig) {
  configManager.initialize(appConfig);
}
```

### 3. Type Declarations

**File:** `packages/noodl-viewer-react/static/viewer/global.d.ts.keep`

Add Config type declarations:

```typescript
declare namespace Noodl {
  // ... existing declarations
  
  /**
   * App configuration values defined in App Setup.
   * These values are static and cannot be changed at runtime.
   * 
   * @example
   * // Access a config value
   * const color = Noodl.Config.primaryColor;
   * 
   * // This will throw an error:
   * Noodl.Config.primaryColor = "#000"; // ❌ Cannot modify
   */
  const Config: Readonly<{
    // Identity
    appName: string;
    description: string;
    coverImage?: string;
    
    // SEO
    ogTitle: string;
    ogDescription: string;
    ogImage?: string;
    favicon?: string;
    themeColor?: string;
    
    // PWA
    pwaEnabled: boolean;
    pwaShortName?: string;
    pwaDisplay?: string;
    pwaStartUrl?: string;
    pwaBackgroundColor?: string;
    
    // Custom variables (dynamic)
    [key: string]: any;
  }>;
}
```

---

## Validation Logic

**File:** `packages/noodl-runtime/src/config/validation.ts`

```typescript
import { ConfigVariable, ConfigValidation } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfigKey(key: string): ValidationResult {
  const errors: string[] = [];
  
  // Must be valid JS identifier
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    errors.push('Key must be a valid JavaScript identifier');
  }
  
  // Reserved keys
  const reserved = [
    'appName', 'description', 'coverImage',
    'ogTitle', 'ogDescription', 'ogImage', 'favicon', 'themeColor',
    'pwaEnabled', 'pwaShortName', 'pwaDisplay', 'pwaStartUrl', 'pwaBackgroundColor'
  ];
  
  if (reserved.includes(key)) {
    errors.push(`"${key}" is a reserved configuration key`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateConfigValue(
  value: any, 
  type: string, 
  validation?: ConfigValidation
): ValidationResult {
  const errors: string[] = [];
  
  // Required check
  if (validation?.required && (value === undefined || value === null || value === '')) {
    errors.push('This field is required');
    return { valid: false, errors };
  }
  
  // Type-specific validation
  switch (type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push('Value must be a number');
      } else {
        if (validation?.min !== undefined && value < validation.min) {
          errors.push(`Value must be at least ${validation.min}`);
        }
        if (validation?.max !== undefined && value > validation.max) {
          errors.push(`Value must be at most ${validation.max}`);
        }
      }
      break;
      
    case 'string':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
      } else if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push('Value does not match required pattern');
        }
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push('Value must be true or false');
      }
      break;
      
    case 'color':
      if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value)) {
        errors.push('Value must be a valid hex color (e.g., #ff0000)');
      }
      break;
      
    case 'array':
      if (!Array.isArray(value)) {
        errors.push('Value must be an array');
      }
      break;
      
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push('Value must be an object');
      }
      break;
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## Testing Checklist

### Unit Tests

- [ ] ConfigManager initializes with defaults
- [ ] ConfigManager merges provided config with defaults
- [ ] Frozen config includes all identity fields
- [ ] Frozen config includes all SEO fields with defaults
- [ ] Frozen config includes all custom variables
- [ ] Config object is truly immutable (Object.isFrozen)
- [ ] Proxy prevents writes and logs error
- [ ] Validation rejects invalid keys
- [ ] Validation rejects reserved keys
- [ ] Type validation works for all types

### Integration Tests

- [ ] ProjectModel saves config to metadata
- [ ] ProjectModel loads config from metadata
- [ ] Runtime initializes config on app load
- [ ] Noodl.Config accessible in Function nodes
- [ ] Config values correct in running app

---

## Implementation Order

1. Create type definitions
2. Create ConfigManager
3. Create validation utilities
4. Update ProjectModel with config methods
5. Create Noodl.Config API proxy
6. Add to Noodl namespace
7. Update type declarations
8. Add runtime initialization
9. Write tests

---

## Notes for Implementer

### Freezing Behavior

The config object must be deeply frozen to prevent any mutation:

```typescript
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach(key => {
    const value = (obj as any)[key];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}
```

### Error Messages

When users try to modify config values, provide helpful error messages that guide them to use Variables instead:

```javascript
console.error(
  `Cannot set Noodl.Config.${prop} - Config values are immutable. ` +
  `Use Noodl.Variables for runtime-changeable values.`
);
```

### Cloud Function Context

Ensure ConfigManager works in both browser and cloud function contexts. The cloud functions have a separate noodl-js-api that will need similar updates.
