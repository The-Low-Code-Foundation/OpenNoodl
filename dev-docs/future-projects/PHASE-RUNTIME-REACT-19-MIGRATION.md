# Phase: Runtime React 19 Migration

## Overview

This phase modernizes the OpenNoodl runtime (the code that powers deployed/published projects) from React 17 to React 19. Unlike the editor migration, this directly affects end-user applications in production.

**Key Principle:** No one gets left behind. Users choose when to migrate, with comprehensive tooling to guide them.

## Goals

1. **Dual Runtime Support** - Allow users to deploy to either React 17 (legacy) or React 19 (modern) runtime
2. **Migration Detection System** - Automatically scan projects for React 19 incompatibilities
3. **Guided Migration** - Provide clear, actionable guidance for fixing compatibility issues
4. **Zero Breaking Changes for Passive Users** - Projects that don't explicitly opt-in continue working unchanged

## Architecture

### Dual Runtime System

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenNoodl Editor                         │
├─────────────────────────────────────────────────────────────┤
│                    Deploy/Publish Dialog                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Runtime Version: [React 17 (Legacy) ▼]             │    │
│  │                   [React 19 (Modern)  ]             │    │
│  │                                                     │    │
│  │  ⚠️ Migration Status: 2 issues detected            │    │
│  │     [Run Migration Check] [View Details]           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   noodl-viewer-react    │     │   noodl-viewer-react    │
│      (React 17)         │     │      (React 19)         │
│                         │     │                         │
│  • Legacy lifecycle     │     │  • Modern lifecycle     │
│  • ReactDOM.render()    │     │  • createRoot()         │
│  • String refs support  │     │  • Strict mode ready    │
└─────────────────────────┘     └─────────────────────────┘
```

### Package Structure

```
packages/
├── noodl-viewer-react/
│   ├── src/
│   │   ├── index.js              # Shared entry logic
│   │   ├── init-legacy.js        # React 17 initialization
│   │   └── init-modern.js        # React 19 initialization
│   ├── static/
│   │   ├── deploy/               # React 17 bundle (default)
│   │   └── deploy-react19/       # React 19 bundle
│   └── webpack-configs/
│       ├── webpack.deploy.legacy.js
│       └── webpack.deploy.modern.js
├── noodl-viewer-cloud/
│   └── [similar structure]
└── noodl-runtime/
    └── src/
        ├── compat/
        │   ├── react17-shims.js  # Compatibility layer
        │   └── react19-shims.js
        └── migration/
            ├── detector.js       # Incompatibility detection
            └── reporter.js       # Migration report generation
```

## Migration Detection System

### Detected Patterns

The migration system scans for the following incompatibilities:

#### Critical (Will Break)

| Pattern | Detection Method | Migration Path |
|---------|------------------|----------------|
| `componentWillMount` | AST scan of JS nodes | Convert to `constructor` or `componentDidMount` |
| `componentWillReceiveProps` | AST scan of JS nodes | Convert to `static getDerivedStateFromProps` or `componentDidUpdate` |
| `componentWillUpdate` | AST scan of JS nodes | Convert to `getSnapshotBeforeUpdate` + `componentDidUpdate` |
| `ReactDOM.render()` | String match in custom code | Convert to `createRoot().render()` |
| String refs (`ref="myRef"`) | Regex in JSX | Convert to `React.createRef()` or callback refs |
| `contextTypes` / `getChildContext` | AST scan | Convert to `React.createContext` |
| `createFactory()` | String match | Convert to JSX or `createElement` |

#### Warning (Deprecated but Functional)

| Pattern | Detection Method | Recommendation |
|---------|------------------|----------------|
| `defaultProps` on function components | AST scan | Use ES6 default parameters |
| `propTypes` | Import detection | Consider TypeScript or remove |
| `findDOMNode()` | String match | Use refs instead |

#### Info (Best Practice)

| Pattern | Detection Method | Recommendation |
|---------|------------------|----------------|
| Class components | AST scan | Consider converting to functional + hooks |
| `UNSAFE_` lifecycle methods | String match | Plan migration to modern patterns |

### Detection Implementation

```javascript
// packages/noodl-runtime/src/migration/detector.js

const CRITICAL_PATTERNS = [
  {
    id: 'componentWillMount',
    pattern: /componentWillMount\s*\(/,
    severity: 'critical',
    title: 'componentWillMount is removed in React 19',
    description: 'This lifecycle method has been removed. Move initialization logic to the constructor or componentDidMount.',
    autoFixable: false,
    documentation: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-deprecated-react-apis',
    migration: {
      before: `componentWillMount() {\n  this.setState({ data: fetchData() });\n}`,
      after: `componentDidMount() {\n  this.setState({ data: fetchData() });\n}`
    }
  },
  {
    id: 'componentWillReceiveProps',
    pattern: /componentWillReceiveProps\s*\(/,
    severity: 'critical',
    title: 'componentWillReceiveProps is removed in React 19',
    description: 'Use static getDerivedStateFromProps or componentDidUpdate instead.',
    autoFixable: false,
    documentation: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-deprecated-react-apis',
    migration: {
      before: `componentWillReceiveProps(nextProps) {\n  if (nextProps.id !== this.props.id) {\n    this.setState({ data: null });\n  }\n}`,
      after: `static getDerivedStateFromProps(props, state) {\n  if (props.id !== state.prevId) {\n    return { data: null, prevId: props.id };\n  }\n  return null;\n}`
    }
  },
  {
    id: 'componentWillUpdate',
    pattern: /componentWillUpdate\s*\(/,
    severity: 'critical',
    title: 'componentWillUpdate is removed in React 19',
    description: 'Use getSnapshotBeforeUpdate with componentDidUpdate instead.',
    autoFixable: false,
    documentation: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-deprecated-react-apis'
  },
  {
    id: 'reactdom-render',
    pattern: /ReactDOM\.render\s*\(/,
    severity: 'critical',
    title: 'ReactDOM.render is removed in React 19',
    description: 'Use createRoot from react-dom/client instead.',
    autoFixable: true,
    migration: {
      before: `import { render } from 'react-dom';\nrender(<App />, document.getElementById('root'));`,
      after: `import { createRoot } from 'react-dom/client';\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);`
    }
  },
  {
    id: 'string-refs',
    pattern: /ref\s*=\s*["'][^"']+["']/,
    severity: 'critical',
    title: 'String refs are removed in React 19',
    description: 'Use React.createRef() or callback refs instead.',
    autoFixable: false,
    migration: {
      before: `<input ref="myInput" />`,
      after: `// Using createRef:\nmyInputRef = React.createRef();\n<input ref={this.myInputRef} />\n\n// Using callback ref:\n<input ref={el => this.myInput = el} />`
    }
  },
  {
    id: 'legacy-context',
    pattern: /contextTypes\s*=|getChildContext\s*\(/,
    severity: 'critical',
    title: 'Legacy Context API is removed in React 19',
    description: 'Migrate to React.createContext and useContext.',
    autoFixable: false,
    documentation: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-legacy-context'
  }
];

const WARNING_PATTERNS = [
  {
    id: 'defaultProps-function',
    pattern: /\.defaultProps\s*=/,
    severity: 'warning',
    title: 'defaultProps on function components is deprecated',
    description: 'Use ES6 default parameters instead. Class components still support defaultProps.',
    autoFixable: true
  },
  {
    id: 'propTypes',
    pattern: /\.propTypes\s*=|from\s*['"]prop-types['"]/,
    severity: 'warning',
    title: 'PropTypes are removed from React',
    description: 'Consider using TypeScript for type checking, or remove propTypes.',
    autoFixable: false
  }
];

class MigrationDetector {
  constructor() {
    this.patterns = [...CRITICAL_PATTERNS, ...WARNING_PATTERNS];
  }

  scanNode(nodeData) {
    const issues = [];
    const code = this.extractCode(nodeData);
    
    if (!code) return issues;

    for (const pattern of this.patterns) {
      if (pattern.pattern.test(code)) {
        issues.push({
          ...pattern,
          nodeId: nodeData.id,
          nodeName: nodeData.name || nodeData.type,
          location: this.findLocation(code, pattern.pattern)
        });
      }
    }

    return issues;
  }

  scanProject(projectData) {
    const report = {
      timestamp: new Date().toISOString(),
      projectName: projectData.name,
      summary: {
        critical: 0,
        warning: 0,
        info: 0,
        canMigrate: true
      },
      issues: [],
      affectedNodes: new Set()
    };

    // Scan all components
    for (const component of projectData.components || []) {
      for (const node of component.nodes || []) {
        const nodeIssues = this.scanNode(node);
        
        for (const issue of nodeIssues) {
          report.issues.push({
            ...issue,
            component: component.name
          });
          report.summary[issue.severity]++;
          report.affectedNodes.add(node.id);
        }
      }
    }

    // Check custom modules
    for (const module of projectData.modules || []) {
      const moduleIssues = this.scanCustomModule(module);
      report.issues.push(...moduleIssues);
    }

    report.summary.canMigrate = report.summary.critical === 0;
    report.affectedNodes = Array.from(report.affectedNodes);

    return report;
  }

  extractCode(nodeData) {
    // Extract JavaScript code from various node types
    if (nodeData.type === 'JavaScriptFunction' || nodeData.type === 'Javascript2') {
      return nodeData.parameters?.code || nodeData.parameters?.Script || '';
    }
    if (nodeData.type === 'Expression') {
      return nodeData.parameters?.expression || '';
    }
    // Custom React component nodes
    if (nodeData.parameters?.reactComponent) {
      return nodeData.parameters.reactComponent;
    }
    return '';
  }

  findLocation(code, pattern) {
    const match = code.match(pattern);
    if (!match) return null;
    
    const lines = code.substring(0, match.index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length
    };
  }
}

module.exports = { MigrationDetector, CRITICAL_PATTERNS, WARNING_PATTERNS };
```

## User Interface

### Deploy Dialog Enhancement

```
┌──────────────────────────────────────────────────────────────────┐
│                        Deploy Project                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Target: [Production Server ▼]                                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Runtime Version                                           │  │
│  │                                                            │  │
│  │  ○ React 17 (Legacy)                                       │  │
│  │    Stable, compatible with all existing code               │  │
│  │                                                            │  │
│  │  ● React 19 (Modern) ✨ Recommended                        │  │
│  │    Better performance, modern features, future-proof       │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ⚠️ Migration Check Results                                │  │
│  │                                                            │  │
│  │  Found 2 issues that need attention:                       │  │
│  │                                                            │  │
│  │  🔴 CRITICAL (1)                                           │  │
│  │     └─ MyCustomComponent: componentWillMount removed       │  │
│  │                                                            │  │
│  │  🟡 WARNING (1)                                            │  │
│  │     └─ UserCard: defaultProps deprecated                   │  │
│  │                                                            │  │
│  │  [View Full Report]  [How to Fix]                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ℹ️ Critical issues must be resolved before deploying      │  │
│  │     with React 19. You can still deploy with React 17.     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│            [Cancel]    [Deploy with React 17]    [Fix Issues]    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Migration Report Panel

```
┌──────────────────────────────────────────────────────────────────┐
│  Migration Report                                          [×]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Project: My Awesome App                                         │
│  Scanned: Dec 7, 2025 at 2:34 PM                                │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  🔴 CRITICAL: componentWillMount removed                         │
│  ───────────────────────────────────────────────────────────     │
│  Location: Components/MyCustomComponent/Function Node            │
│                                                                  │
│  This lifecycle method has been completely removed in React 19.  │
│  Code using componentWillMount will throw an error at runtime.   │
│                                                                  │
│  Your code:                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  componentWillMount() {                                    │  │
│  │    this.setState({ loading: true });                       │  │
│  │    this.loadData();                                        │  │
│  │  }                                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Recommended fix:                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  constructor(props) {                                      │  │
│  │    super(props);                                           │  │
│  │    this.state = { loading: true };                         │  │
│  │  }                                                         │  │
│  │                                                            │  │
│  │  componentDidMount() {                                     │  │
│  │    this.loadData();                                        │  │
│  │  }                                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Go to Node]  [Copy Fix]  [Learn More ↗]                       │
│                                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  🟡 WARNING: defaultProps deprecated                             │
│  ───────────────────────────────────────────────────────────     │
│  Location: Components/UserCard/Function Node                     │
│  ...                                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Infrastructure (Week 1-2)

**Objective:** Set up dual-build system without changing default behavior

- [ ] Create separate webpack configs for React 17 and React 19 builds
- [ ] Set up `static/deploy-react19/` directory structure
- [ ] Create React 19 versions of bundled React files
- [ ] Update `noodl-viewer-react/static/deploy/index.json` to support version selection
- [ ] Add runtime version metadata to deploy manifest

**Success Criteria:**
- Both runtime versions build successfully
- Default deploy still uses React 17
- React 19 bundle available but not yet exposed in UI

### Phase 2: Migration Detection (Week 2-3)

**Objective:** Build scanning and reporting system

- [ ] Implement `MigrationDetector` class
- [ ] Create pattern definitions for all known incompatibilities
- [ ] Build project scanning logic
- [ ] Generate human-readable migration reports
- [ ] Add detection for custom React modules (external libs)

**Success Criteria:**
- Scanner identifies all critical patterns in test projects
- Reports clearly explain each issue with code examples
- Scanner handles edge cases (minified code, JSX variations)

### Phase 3: Editor Integration (Week 3-4)

**Objective:** Surface migration tools in the editor UI

- [ ] Add runtime version selector to Deploy dialog
- [ ] Integrate migration scanner with deploy workflow
- [ ] Create Migration Report panel component
- [ ] Add "Go to Node" navigation from report
- [ ] Show inline warnings in JavaScript node editor

**Success Criteria:**
- Users can select runtime version before deploy
- Migration check runs automatically when React 19 selected
- Clear UI prevents accidental broken deploys

### Phase 4: Runtime Compatibility Layer (Week 4-5)

**Objective:** Update internal runtime code for React 19

- [ ] Update `noodl-viewer-react` initialization to use `createRoot()`
- [ ] Update SSR package to use `hydrateRoot()`
- [ ] Migrate any internal `componentWillMount` usage
- [ ] Update `noodl-viewer-cloud` for React 19
- [ ] Test all built-in visual nodes with React 19

**Success Criteria:**
- All built-in Noodl nodes work with React 19
- SSR functions correctly with new APIs
- No regressions in React 17 runtime

### Phase 5: Documentation & Polish (Week 5-6)

**Objective:** Prepare for user adoption

- [ ] Write migration guide for end users
- [ ] Document all breaking changes with examples
- [ ] Create video walkthrough of migration process
- [ ] Add contextual help links in migration report
- [ ] Beta test with community projects

**Success Criteria:**
- Complete migration documentation
- At least 5 community projects successfully migrated
- No critical bugs in migration tooling

## Technical Considerations

### Build System Changes

```javascript
// webpack-configs/webpack.deploy.config.js

const REACT_VERSION = process.env.REACT_VERSION || '17';

module.exports = {
  entry: `./src/init-react${REACT_VERSION}.js`,
  output: {
    path: path.resolve(__dirname, `../static/deploy${REACT_VERSION === '19' ? '-react19' : ''}`),
    filename: 'noodl.deploy.js'
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  },
  // ... rest of config
};
```

### Runtime Initialization (React 19)

```javascript
// src/init-react19.js

import { createRoot, hydrateRoot } from 'react-dom/client';

export function initializeApp(App, container, options = {}) {
  if (options.hydrate && container.hasChildNodes()) {
    return hydrateRoot(container, App);
  }
  
  const root = createRoot(container);
  root.render(App);
  return root;
}

export function unmountApp(root) {
  root.unmount();
}

// Expose for runtime
window.NoodlReactInit = { initializeApp, unmountApp };
```

### Backwards Compatibility

```javascript
// src/compat/react-compat.js

// Shim for code that might reference old APIs
if (typeof ReactDOM !== 'undefined' && !ReactDOM.render) {
  console.warn(
    '[Noodl] ReactDOM.render is not available in React 19. ' +
    'Please update your custom code to use createRoot instead.'
  );
  
  // Provide a helpful error instead of undefined function
  ReactDOM.render = () => {
    throw new Error(
      'ReactDOM.render has been removed in React 19. ' +
      'See migration guide: https://docs.opennoodl.com/migration/react19'
    );
  };
}
```

## Success Criteria

### Quantitative

- [ ] 100% of built-in Noodl nodes work on React 19
- [ ] Migration scanner detects >95% of incompatible patterns
- [ ] Build time increase <10% for dual-runtime support
- [ ] Zero regressions in React 17 runtime behavior

### Qualitative

- [ ] Users can confidently choose their runtime version
- [ ] Migration report provides actionable guidance
- [ ] No user is forced to migrate before they're ready
- [ ] Documentation covers all common migration scenarios

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Custom modules with deep React dependencies | High | Medium | Provide detection + detailed migration docs |
| Third-party npm packages incompatible | Medium | Medium | Document known incompatible packages |
| SSR behavior differences between versions | High | Low | Extensive SSR testing suite |
| Build size increase from dual bundles | Low | High | Only ship selected version, not both |
| Community confusion about versions | Medium | Medium | Clear UI, documentation, and defaults |

## Future Considerations

### React 20+ Preparation

This dual-runtime architecture sets up a pattern for future React upgrades:
- Version selection UI is extensible
- Migration scanner patterns are configurable
- Build system supports arbitrary version targets

### Deprecation Timeline

```
v1.2.0 - React 19 available as opt-in (default: React 17)
v1.3.0 - React 19 becomes default (React 17 still available)
v1.4.0 - React 17 shows deprecation warning
v2.0.0 - React 17 support removed
```

## Related Documentation

- [React 19 Official Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [TASK-001: Dependency Updates & React 19 Migration (Editor)](./TASK-001-dependency-updates.md)
- [OpenNoodl Architecture Overview](./architecture/overview.md)

---

*Last Updated: December 7, 2025*
*Phase Owner: TBD*
*Estimated Duration: 6 weeks*
