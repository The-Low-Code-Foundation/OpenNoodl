# Phase E: Target System Core

## Overview

The Target System Core is the foundational infrastructure that enables Noodl to support multiple deployment targets. It provides the underlying systems for target selection, node compatibility validation, conditional compilation, and target-aware UX across the editor.

**Timeline:** 2-3 weeks  
**Priority:** Critical Foundation - Must complete before Phases B, C, D  
**Prerequisites:** None (runs in parallel with Phase A)

## Core Concept

Noodl's visual graph is inherently target-agnostic. Nodes define **what** happens, not **where** it runs. The Target System Core provides the infrastructure to:

1. Let users select their deployment target(s)
2. Show which nodes work on which targets
3. Prevent invalid deployments at build time
4. Enable target-specific runtime injection

## Target Types

```typescript
enum TargetType {
  WEB = 'web',              // Default - browser deployment
  CAPACITOR = 'capacitor',  // iOS/Android via Capacitor
  ELECTRON = 'electron',    // Desktop via Electron
  EXTENSION = 'extension',  // Chrome Extension
}

interface TargetDefinition {
  type: TargetType;
  displayName: string;
  icon: string;
  description: string;
  runtimePackage: string;           // e.g., 'noodl-runtime-capacitor'
  previewSupported: boolean;
  exportFormats: ExportFormat[];
}

const TARGETS: Record<TargetType, TargetDefinition> = {
  [TargetType.WEB]: {
    type: TargetType.WEB,
    displayName: 'Web',
    icon: '🌐',
    description: 'Deploy as a web application',
    runtimePackage: 'noodl-runtime',
    previewSupported: true,
    exportFormats: ['folder', 'netlify', 'vercel', 'cloudflare'],
  },
  [TargetType.CAPACITOR]: {
    type: TargetType.CAPACITOR,
    displayName: 'Mobile',
    icon: '📱',
    description: 'iOS and Android via Capacitor',
    runtimePackage: 'noodl-runtime-capacitor',
    previewSupported: true,
    exportFormats: ['capacitor-project', 'ios-xcode', 'android-studio'],
  },
  [TargetType.ELECTRON]: {
    type: TargetType.ELECTRON,
    displayName: 'Desktop',
    icon: '🖥️',
    description: 'Windows, macOS, and Linux via Electron',
    runtimePackage: 'noodl-runtime-electron',
    previewSupported: true,
    exportFormats: ['electron-project', 'dmg', 'exe', 'deb', 'appimage'],
  },
  [TargetType.EXTENSION]: {
    type: TargetType.EXTENSION,
    displayName: 'Browser Extension',
    icon: '🧩',
    description: 'Chrome extension',
    runtimePackage: 'noodl-runtime',
    previewSupported: false, // Requires loading as unpacked
    exportFormats: ['extension-folder', 'extension-zip'],
  },
};
```

## Project Configuration Model

### Target Configuration

```typescript
interface ProjectTargetConfig {
  primary: TargetType;                    // Main target (determines default palette)
  enabled: TargetType[];                  // All enabled targets
  
  // Per-target configuration
  web?: WebTargetConfig;
  capacitor?: CapacitorTargetConfig;
  electron?: ElectronTargetConfig;
  extension?: ExtensionTargetConfig;
}

interface WebTargetConfig {
  // Standard web config
}

interface CapacitorTargetConfig {
  appId: string;                          // com.company.app
  appName: string;
  version: string;
  
  ios?: {
    teamId: string;
    deploymentTarget: string;
  };
  
  android?: {
    packageName: string;
    minSdkVersion: number;
  };
  
  plugins: string[];                      // Capacitor plugins to include
  permissions: CapacitorPermission[];     // Auto-detected from nodes
}

interface ElectronTargetConfig {
  appId: string;
  appName: string;
  version: string;
  
  platforms: ('darwin' | 'win32' | 'linux')[];
  
  permissions: {
    fileSystem: boolean;
    processExecution: boolean;
    systemTray: boolean;
  };
  
  windowDefaults: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
  };
}

interface ExtensionTargetConfig {
  name: string;
  version: string;
  description: string;
  
  permissions: string[];
  hostPermissions: string[];
  
  contexts: {
    popup: boolean;
    background: boolean;
    contentScript: boolean;
  };
  
  contentScriptMatches: string[];
}
```

### Storage in Project Metadata

```typescript
// In project.json
{
  "name": "My App",
  "version": "1.0.0",
  
  "targets": {
    "primary": "capacitor",
    "enabled": ["web", "capacitor"],
    
    "capacitor": {
      "appId": "com.mycompany.myapp",
      "appName": "My App",
      "version": "1.0.0"
    }
  },
  
  // ... other project config
}
```

## Node Compatibility System

### Compatibility Declaration

Every node declares its target compatibility:

```typescript
interface NodeDefinition {
  name: string;
  displayName: string;
  category: string;
  
  // Target compatibility
  targetCompatibility: TargetType[] | 'all';
  
  // Per-target implementation
  implementations?: {
    [key in TargetType]?: {
      runtime: string;            // Different runtime file
      warnings?: string[];        // Limitations on this target
    };
  };
  
  // ... other node properties
}
```

### Compatibility Patterns

**Universal Nodes** (work everywhere):
```typescript
{
  name: 'Group',
  targetCompatibility: 'all',
  // Single implementation works on all targets
}
```

**Platform-Specific Nodes** (single target):
```typescript
{
  name: 'Camera Capture',
  targetCompatibility: [TargetType.CAPACITOR],
  // Only available when Capacitor is enabled
}
```

**Multi-Platform with Different Implementations**:
```typescript
{
  name: 'File Picker',
  targetCompatibility: [TargetType.WEB, TargetType.ELECTRON, TargetType.CAPACITOR],
  implementations: {
    [TargetType.WEB]: {
      runtime: 'file-picker-web.ts',
      warnings: ['Limited to browser file picker API'],
    },
    [TargetType.ELECTRON]: {
      runtime: 'file-picker-electron.ts',
      // Full native file dialog
    },
    [TargetType.CAPACITOR]: {
      runtime: 'file-picker-capacitor.ts',
      warnings: ['On iOS, requires photo library permission'],
    },
  },
}
```

**Graceful Degradation**:
```typescript
{
  name: 'Haptic Feedback',
  targetCompatibility: [TargetType.CAPACITOR, TargetType.WEB],
  implementations: {
    [TargetType.CAPACITOR]: {
      runtime: 'haptic-capacitor.ts',
      // Full haptic API
    },
    [TargetType.WEB]: {
      runtime: 'haptic-web.ts',
      warnings: ['Limited to Vibration API - may not work on all devices'],
    },
  },
}
```

### Compatibility Registry

```typescript
class NodeCompatibilityRegistry {
  private static instance: NodeCompatibilityRegistry;
  private registry: Map<string, TargetType[]> = new Map();
  
  registerNode(nodeType: string, compatibility: TargetType[] | 'all'): void {
    if (compatibility === 'all') {
      this.registry.set(nodeType, Object.values(TargetType));
    } else {
      this.registry.set(nodeType, compatibility);
    }
  }
  
  isCompatible(nodeType: string, target: TargetType): boolean {
    const compatibility = this.registry.get(nodeType);
    return compatibility?.includes(target) ?? false;
  }
  
  getCompatibleTargets(nodeType: string): TargetType[] {
    return this.registry.get(nodeType) ?? [];
  }
  
  getNodesForTarget(target: TargetType): string[] {
    return Array.from(this.registry.entries())
      .filter(([_, targets]) => targets.includes(target))
      .map(([nodeType, _]) => nodeType);
  }
  
  getIncompatibleNodes(usedNodes: string[], target: TargetType): string[] {
    return usedNodes.filter(node => !this.isCompatible(node, target));
  }
}
```

## Node Palette Filtering

### Dynamic Palette Based on Target

When a user selects their primary target, the node palette updates to show compatible nodes:

```typescript
class NodePaletteService {
  private currentTarget: TargetType;
  private enabledTargets: TargetType[];
  
  setTargets(primary: TargetType, enabled: TargetType[]): void {
    this.currentTarget = primary;
    this.enabledTargets = enabled;
    this.refreshPalette();
  }
  
  getVisibleNodes(): NodeDefinition[] {
    return allNodes.filter(node => {
      // Node is visible if compatible with ANY enabled target
      const compatibility = node.targetCompatibility === 'all' 
        ? Object.values(TargetType)
        : node.targetCompatibility;
        
      return compatibility.some(t => this.enabledTargets.includes(t));
    });
  }
  
  getNodeCategories(): Category[] {
    const visibleNodes = this.getVisibleNodes();
    
    // Group by category, add target-specific categories
    const categories = new Map<string, NodeDefinition[]>();
    
    visibleNodes.forEach(node => {
      const existing = categories.get(node.category) ?? [];
      categories.set(node.category, [...existing, node]);
    });
    
    // Add target-specific category headers
    if (this.enabledTargets.includes(TargetType.CAPACITOR)) {
      // Ensure "Mobile" category exists
    }
    if (this.enabledTargets.includes(TargetType.ELECTRON)) {
      // Ensure "Desktop" category exists
    }
    
    return Array.from(categories.entries()).map(([name, nodes]) => ({
      name,
      nodes,
    }));
  }
}
```

### Compatibility Badges in UI

Nodes display badges indicating their target compatibility:

```
┌──────────────────────────────────────────────────────────────┐
│ Node Palette                                          [🔍]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ▼ UI Elements                                               │
│    ├── Text                                    [🌐📱🖥️🧩]   │
│    ├── Button                                  [🌐📱🖥️🧩]   │
│    ├── Image                                   [🌐📱🖥️🧩]   │
│    └── Video                                   [🌐📱🖥️]     │
│                                                              │
│  ▼ Mobile                                                    │
│    ├── Camera Capture                          [📱]          │
│    ├── Push Notifications                      [📱]          │
│    ├── Haptic Feedback                         [📱🌐*]       │
│    └── Geolocation                             [📱🌐]        │
│                                                              │
│  ▼ Desktop                                                   │
│    ├── Read File                               [🖥️]          │
│    ├── Write File                              [🖥️]          │
│    ├── Run Process                             [🖥️]          │
│    └── System Tray                             [🖥️]          │
│                                                              │
│  ▼ Extension                                                 │
│    ├── Storage Get                             [🧩]          │
│    ├── Tab Query                               [🧩]          │
│    └── Send Message                            [🧩]          │
│                                                              │
│  * = Limited functionality on this target                    │
└──────────────────────────────────────────────────────────────┘
```

### Badge Component

```typescript
interface CompatibilityBadgeProps {
  targets: TargetType[];
  warnings?: Partial<Record<TargetType, string>>;
}

function CompatibilityBadge({ targets, warnings }: CompatibilityBadgeProps) {
  return (
    <div className="compatibility-badge">
      {targets.map(target => (
        <span 
          key={target}
          className={`target-icon ${warnings?.[target] ? 'has-warning' : ''}`}
          title={warnings?.[target] || TARGETS[target].displayName}
        >
          {TARGETS[target].icon}
          {warnings?.[target] && <span className="warning-indicator">*</span>}
        </span>
      ))}
    </div>
  );
}
```

## Build-Time Validation

### Validation Service

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: 'incompatible_node' | 'missing_config' | 'invalid_permission';
  nodeId?: string;
  nodeName?: string;
  message: string;
  target: TargetType;
}

interface ValidationWarning {
  type: 'limited_functionality' | 'performance' | 'permission_broad';
  nodeId?: string;
  message: string;
  target: TargetType;
}

class TargetValidationService {
  validate(project: Project, target: TargetType): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // 1. Check all used nodes are compatible
    const usedNodes = this.getUsedNodes(project);
    usedNodes.forEach(usage => {
      const compatibility = NodeCompatibilityRegistry.getInstance()
        .getCompatibleTargets(usage.nodeType);
      
      if (!compatibility.includes(target)) {
        errors.push({
          type: 'incompatible_node',
          nodeId: usage.nodeId,
          nodeName: usage.displayName,
          message: `"${usage.displayName}" is not available on ${TARGETS[target].displayName}`,
          target,
        });
      }
      
      // Check for limited functionality warnings
      const nodeDefinition = getNodeDefinition(usage.nodeType);
      const targetWarnings = nodeDefinition.implementations?.[target]?.warnings;
      if (targetWarnings) {
        warnings.push({
          type: 'limited_functionality',
          nodeId: usage.nodeId,
          message: targetWarnings.join('; '),
          target,
        });
      }
    });
    
    // 2. Check target-specific configuration
    const targetConfig = project.targets[target];
    if (!targetConfig && target !== TargetType.WEB) {
      errors.push({
        type: 'missing_config',
        message: `${TARGETS[target].displayName} target is not configured`,
        target,
      });
    }
    
    // 3. Validate permissions
    const requiredPermissions = this.detectRequiredPermissions(usedNodes, target);
    const configuredPermissions = targetConfig?.permissions ?? [];
    
    requiredPermissions.forEach(perm => {
      if (!configuredPermissions.includes(perm)) {
        warnings.push({
          type: 'permission_broad',
          message: `Permission "${perm}" may be required for ${TARGETS[target].displayName}`,
          target,
        });
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  private getUsedNodes(project: Project): NodeUsage[] {
    // Traverse all components and collect used nodes
    const usages: NodeUsage[] = [];
    
    project.components.forEach(component => {
      component.nodes.forEach(node => {
        usages.push({
          nodeId: node.id,
          nodeType: node.type,
          displayName: node.displayName,
          componentId: component.id,
        });
      });
    });
    
    return usages;
  }
  
  private detectRequiredPermissions(
    usedNodes: NodeUsage[], 
    target: TargetType
  ): string[] {
    const permissions = new Set<string>();
    
    usedNodes.forEach(usage => {
      const nodePerms = getNodePermissions(usage.nodeType, target);
      nodePerms.forEach(p => permissions.add(p));
    });
    
    return Array.from(permissions);
  }
}
```

### Pre-Export Validation UI

```
┌──────────────────────────────────────────────────────────────┐
│ Export to Mobile                                       [×]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠️ 2 issues found                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ❌ ERRORS (1)                                          │ │
│  │                                                        │ │
│  │ • "Read File" node is not available on Mobile          │ │
│  │   Used in: SettingsScreen (line 47)                    │ │
│  │   [Go to Node] [Remove Node] [Use Alternative]         │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚠️ WARNINGS (1)                                        │ │
│  │                                                        │ │
│  │ • "Haptic Feedback" has limited functionality on Web   │ │
│  │   Vibration API may not work on all devices           │ │
│  │   Used in: ButtonComponent                             │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│                              [Cancel] [Export with Warnings] │
└──────────────────────────────────────────────────────────────┘
```

## Duplicate as Target Feature

When a user wants to adapt a component for a different target, the "Duplicate as Target" feature analyzes compatibility and suggests adaptations.

### Analysis Engine

```typescript
interface TargetAdaptationAnalysis {
  compatible: boolean;
  adaptations: Adaptation[];
  blockers: Blocker[];
}

interface Adaptation {
  nodeId: string;
  nodeName: string;
  adaptationType: 'replace' | 'remove' | 'configure';
  
  // For 'replace'
  replacement?: {
    nodeType: string;
    displayName: string;
    reason: string;
  };
  
  // For 'configure'
  configChanges?: {
    property: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }[];
  
  // For 'remove'
  removalReason?: string;
  affectedConnections: string[];
}

interface Blocker {
  nodeId: string;
  nodeName: string;
  reason: string;
  suggestion?: string;
}

class TargetAdaptationService {
  analyze(
    component: Component, 
    sourceTarget: TargetType, 
    destTarget: TargetType
  ): TargetAdaptationAnalysis {
    const adaptations: Adaptation[] = [];
    const blockers: Blocker[] = [];
    
    component.nodes.forEach(node => {
      const sourceCompat = NodeCompatibilityRegistry.getInstance()
        .isCompatible(node.type, sourceTarget);
      const destCompat = NodeCompatibilityRegistry.getInstance()
        .isCompatible(node.type, destTarget);
      
      if (sourceCompat && !destCompat) {
        // Node works on source but not dest - needs adaptation
        const alternative = this.findAlternative(node.type, destTarget);
        
        if (alternative) {
          adaptations.push({
            nodeId: node.id,
            nodeName: node.displayName,
            adaptationType: 'replace',
            replacement: {
              nodeType: alternative.nodeType,
              displayName: alternative.displayName,
              reason: alternative.reason,
            },
          });
        } else if (this.isOptional(node)) {
          adaptations.push({
            nodeId: node.id,
            nodeName: node.displayName,
            adaptationType: 'remove',
            removalReason: `No ${TARGETS[destTarget].displayName} equivalent`,
            affectedConnections: this.getConnections(node),
          });
        } else {
          blockers.push({
            nodeId: node.id,
            nodeName: node.displayName,
            reason: `No ${TARGETS[destTarget].displayName} equivalent`,
            suggestion: this.getSuggestion(node.type, destTarget),
          });
        }
      }
    });
    
    return {
      compatible: blockers.length === 0,
      adaptations,
      blockers,
    };
  }
  
  private findAlternative(
    nodeType: string, 
    target: TargetType
  ): { nodeType: string; displayName: string; reason: string } | null {
    // Mapping of nodes to their alternatives on different targets
    const alternatives: Record<string, Partial<Record<TargetType, string>>> = {
      'ReadFile': {
        [TargetType.CAPACITOR]: 'CapacitorFilesystem',
        [TargetType.WEB]: null, // No alternative
      },
      'NativeFilePicker': {
        [TargetType.WEB]: 'FileInput',
        [TargetType.CAPACITOR]: 'CapacitorFilePicker',
      },
      'CameraCapture': {
        [TargetType.WEB]: 'MediaDevicesCamera',
      },
      // ... more mappings
    };
    
    const alt = alternatives[nodeType]?.[target];
    if (alt) {
      const altDef = getNodeDefinition(alt);
      return {
        nodeType: alt,
        displayName: altDef.displayName,
        reason: `Equivalent functionality for ${TARGETS[target].displayName}`,
      };
    }
    
    return null;
  }
  
  apply(
    component: Component, 
    analysis: TargetAdaptationAnalysis
  ): Component {
    const adapted = cloneComponent(component);
    
    analysis.adaptations.forEach(adaptation => {
      switch (adaptation.adaptationType) {
        case 'replace':
          this.replaceNode(adapted, adaptation.nodeId, adaptation.replacement!);
          break;
        case 'remove':
          this.removeNode(adapted, adaptation.nodeId);
          break;
        case 'configure':
          this.configureNode(adapted, adaptation.nodeId, adaptation.configChanges!);
          break;
      }
    });
    
    return adapted;
  }
}
```

### Adaptation UI

```
┌──────────────────────────────────────────────────────────────┐
│ Duplicate "FileManager" for Mobile                     [×]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Analysis: 3 nodes need adaptation                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🔄 REPLACEMENTS (2)                                    │ │
│  │                                                        │ │
│  │ ☑ "Read File" → "Capacitor Filesystem Read"            │ │
│  │   Equivalent functionality for Mobile                  │ │
│  │                                                        │ │
│  │ ☑ "Native File Picker" → "Capacitor File Picker"       │ │
│  │   Equivalent functionality for Mobile                  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🗑️ REMOVALS (1)                                        │ │
│  │                                                        │ │
│  │ ☑ "Watch Directory" - No Mobile equivalent             │ │
│  │   ⚠️ Will disconnect: onChange → UpdateList            │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  New component name: [FileManager_Mobile________]            │
│                                                              │
│                                     [Cancel] [Create Copy]   │
└──────────────────────────────────────────────────────────────┘
```

## Target Selection UI

### Project Creation Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Create New Project                                     [×]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Project Name: [My App_________________________]             │
│                                                              │
│  ── Primary Target ─────────────────────────────────────    │
│  What are you building?                                      │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │     🌐      │ │     📱      │ │     🖥️      │            │
│  │    Web      │ │   Mobile    │ │   Desktop   │            │
│  │             │ │  (iOS/And)  │ │ (Win/Mac)   │            │
│  │  [Selected] │ │             │ │             │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│  ┌─────────────┐                                             │
│  │     🧩      │                                             │
│  │  Extension  │                                             │
│  │  (Chrome)   │                                             │
│  └─────────────┘                                             │
│                                                              │
│  ℹ️ You can enable additional targets later in Settings     │
│                                                              │
│                                            [Cancel] [Create] │
└──────────────────────────────────────────────────────────────┘
```

### Project Settings - Targets Panel

```
┌──────────────────────────────────────────────────────────────┐
│ Project Settings                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [General] [Targets] [Backends] [Version Control]            │
│            ────────                                          │
│                                                              │
│  ── Enabled Targets ────────────────────────────────────    │
│                                                              │
│  ☑ 🌐 Web (Primary)                              [Configure] │
│      Standard web deployment                                 │
│                                                              │
│  ☑ 📱 Mobile                                     [Configure] │
│      iOS and Android via Capacitor                          │
│      App ID: com.mycompany.myapp                            │
│                                                              │
│  ☐ 🖥️ Desktop                                    [Enable]    │
│      Windows, macOS, Linux via Electron                     │
│                                                              │
│  ☐ 🧩 Browser Extension                          [Enable]    │
│      Chrome Extension                                        │
│                                                              │
│  ── Primary Target ─────────────────────────────────────    │
│  [Web ▾]                                                     │
│  The primary target determines the default node palette     │
│                                                              │
│                                                  [Save]      │
└──────────────────────────────────────────────────────────────┘
```

### Target Configuration Modals

Clicking "Configure" opens target-specific settings:

**Capacitor Configuration:**
```
┌──────────────────────────────────────────────────────────────┐
│ Mobile Target Settings                                 [×]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── App Identity ───────────────────────────────────────    │
│  App ID: [com.mycompany.myapp_______]                        │
│  App Name: [My App__________________]                        │
│  Version: [1.0.0____]                                        │
│                                                              │
│  ── iOS Settings ───────────────────────────────────────    │
│  Team ID: [ABCD1234__]                                       │
│  Deployment Target: [14.0 ▾]                                 │
│                                                              │
│  ── Android Settings ───────────────────────────────────    │
│  Min SDK Version: [24 ▾]                                     │
│                                                              │
│  ── Detected Permissions ───────────────────────────────    │
│  Based on nodes used in your project:                        │
│  ☑ Camera (Camera Capture node)                              │
│  ☑ Location (Geolocation node)                               │
│  ☑ Push Notifications (Push node)                            │
│                                                              │
│                                          [Cancel] [Save]     │
└──────────────────────────────────────────────────────────────┘
```

## Runtime Injection

### Conditional Runtime Loading

Different targets require different runtime packages:

```typescript
class RuntimeInjector {
  private target: TargetType;
  
  constructor(target: TargetType) {
    this.target = target;
  }
  
  getRuntime(): RuntimeBundle {
    switch (this.target) {
      case TargetType.WEB:
        return {
          core: 'noodl-runtime',
          nodes: 'noodl-nodes-web',
        };
        
      case TargetType.CAPACITOR:
        return {
          core: 'noodl-runtime',
          nodes: 'noodl-nodes-capacitor',
          bridge: '@capacitor/core',
          plugins: this.getCapacitorPlugins(),
        };
        
      case TargetType.ELECTRON:
        return {
          core: 'noodl-runtime',
          nodes: 'noodl-nodes-electron',
          preload: 'electron-preload',
        };
        
      case TargetType.EXTENSION:
        return {
          core: 'noodl-runtime',
          nodes: 'noodl-nodes-extension',
        };
    }
  }
  
  private getCapacitorPlugins(): string[] {
    // Based on nodes used in project
    const usedNodes = ProjectModel.getInstance().getUsedNodeTypes();
    const plugins: string[] = [];
    
    if (usedNodes.includes('CameraCapture')) {
      plugins.push('@capacitor/camera');
    }
    if (usedNodes.includes('Geolocation')) {
      plugins.push('@capacitor/geolocation');
    }
    if (usedNodes.includes('PushNotifications')) {
      plugins.push('@capacitor/push-notifications');
    }
    // ... more mappings
    
    return plugins;
  }
  
  inject(bundle: RuntimeBundle): string {
    // Generate import statements and initialization code
    let code = `
      import { Noodl } from '${bundle.core}';
      import * as nodes from '${bundle.nodes}';
    `;
    
    if (bundle.bridge) {
      code += `import { Capacitor } from '${bundle.bridge}';\n`;
    }
    
    if (bundle.plugins) {
      bundle.plugins.forEach(plugin => {
        const name = this.getPluginName(plugin);
        code += `import { ${name} } from '${plugin}';\n`;
      });
    }
    
    code += `
      Noodl.registerNodes(nodes);
      ${this.target !== TargetType.WEB ? `Noodl.setTarget('${this.target}');` : ''}
    `;
    
    return code;
  }
}
```

### Preview Mode Runtime Selection

```typescript
class PreviewService {
  private target: TargetType;
  
  setPreviewTarget(target: TargetType): void {
    this.target = target;
    this.reloadPreview();
  }
  
  getPreviewFrame(): string {
    switch (this.target) {
      case TargetType.WEB:
        return 'standard-preview-frame';
        
      case TargetType.CAPACITOR:
        // Mobile dimensions, inject Capacitor bridge
        return 'capacitor-preview-frame';
        
      case TargetType.ELECTRON:
        // Enable IPC bridge to main process
        return 'electron-preview-frame';
        
      case TargetType.EXTENSION:
        // Popup dimensions, inject mock chrome API
        return 'extension-preview-frame';
    }
  }
}
```

### Preview Toolbar Target Selector

```
┌──────────────────────────────────────────────────────────────┐
│ Preview                           [Web ▾] [Device ▾] [↻]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │              Preview Content                            ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘

Target Dropdown:
┌───────────────┐
│ 🌐 Web        │ ← Current
├───────────────┤
│ 📱 Mobile     │
│ 🖥️ Desktop    │
│ 🧩 Extension  │
└───────────────┘
```

## Implementation Phases

### Phase 1: Target Configuration Model (3-4 days)

**Goal:** Implement project-level target configuration

**Tasks:**
1. Define TypeScript interfaces for all target configs
2. Add targets field to project.json schema
3. Create TargetConfigService for CRUD operations
4. Migrate existing projects (add default web target)

**Files to Create:**
```
packages/noodl-editor/src/editor/src/models/
├── TargetConfig.ts
├── TargetType.ts
└── targets/
    ├── WebTargetConfig.ts
    ├── CapacitorTargetConfig.ts
    ├── ElectronTargetConfig.ts
    └── ExtensionTargetConfig.ts

packages/noodl-editor/src/editor/src/services/
└── TargetConfigService.ts
```

**Verification:**
- [ ] Target config saved/loaded correctly
- [ ] Default web target for new projects
- [ ] Migration works for existing projects

### Phase 2: Node Compatibility System (4-5 days)

**Goal:** Implement node compatibility declaration and registry

**Tasks:**
1. Add targetCompatibility to NodeDefinition
2. Create NodeCompatibilityRegistry
3. Add compatibility to all existing nodes (mark as 'all' for universal)
4. Create compatibility badge component

**Files to Create:**
```
packages/noodl-editor/src/editor/src/models/
└── NodeCompatibility.ts

packages/noodl-editor/src/editor/src/services/
└── NodeCompatibilityRegistry.ts

packages/noodl-editor/src/editor/src/components/
└── CompatibilityBadge/
    ├── CompatibilityBadge.tsx
    └── CompatibilityBadge.module.css
```

**Verification:**
- [ ] All nodes have compatibility declared
- [ ] Registry correctly filters nodes by target
- [ ] Badges render correctly in palette

### Phase 3: Build-Time Validation (3-4 days)

**Goal:** Prevent deploying incompatible nodes

**Tasks:**
1. Create TargetValidationService
2. Integrate validation into export flow
3. Create validation error UI
4. Add "Go to Node" action for errors

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/
└── TargetValidationService.ts

packages/noodl-editor/src/editor/src/views/
└── ValidationErrorsPanel/
    ├── ValidationErrorsPanel.tsx
    └── ValidationErrorsPanel.module.css
```

**Verification:**
- [ ] Incompatible nodes detected correctly
- [ ] Export blocked with clear error message
- [ ] "Go to Node" navigates to problem node

### Phase 4: Target Selection UI (3-4 days)

**Goal:** User-facing target management

**Tasks:**
1. Update project creation dialog with target selection
2. Create Targets panel in Project Settings
3. Create target configuration modals
4. Add preview target selector

**Files to Create:**
```
packages/noodl-editor/src/editor/src/views/
├── CreateProjectDialog/
│   └── TargetSelector.tsx
├── ProjectSettings/
│   └── TargetsPanel/
│       ├── TargetsPanel.tsx
│       └── TargetConfigModal.tsx
└── PreviewToolbar/
    └── TargetSelector.tsx
```

**Verification:**
- [ ] New projects prompt for target
- [ ] Targets panel shows enabled targets
- [ ] Configuration modals save correctly
- [ ] Preview switches targets

### Phase 5: Duplicate as Target (2-3 days)

**Goal:** Intelligent component adaptation

**Tasks:**
1. Create TargetAdaptationService
2. Define node alternative mappings
3. Create adaptation preview UI
4. Implement apply logic

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/
└── TargetAdaptationService.ts

packages/noodl-editor/src/editor/src/views/
└── DuplicateAsTargetDialog/
    ├── DuplicateAsTargetDialog.tsx
    └── AdaptationPreview.tsx
```

**Verification:**
- [ ] Analysis correctly identifies incompatibilities
- [ ] Alternatives suggested where available
- [ ] Apply creates working adapted component

## Dependencies

### External Packages

None for core target system - it's purely editor infrastructure.

### Internal Dependencies

- ProjectModel (for project configuration)
- NodeLibrary (for node definitions)
- Compilation service (for validation integration)
- Export services (for build-time checks)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing node compatibility | High | Medium | Default to 'all', refine over time |
| Complex migration | Medium | High | Thorough testing on real projects |
| UI complexity | Medium | Medium | Start with minimal UI, iterate |
| Alternative mappings incomplete | High | Low | Document as "best effort" |

## Success Metrics

**Phase Complete:**
- All nodes have compatibility declared
- Target selection UI functional
- Build-time validation prevents bad deploys
- Duplicate as Target works for common cases

**Integration Ready:**
- Phases B, C, D can build on this foundation
- Preview mode switches targets correctly
- Export respects target configuration

## Related Documentation

- [Phase B: Capacitor Mobile](../02-capacitor-mobile/README.md)
- [Phase C: Electron Desktop](../03-electron-desktop/README.md)
- [Phase D: Chrome Extension](../04-chrome-extension/README.md)
