# TASK-010: Critical Bug - Project Creation Fails Due to Incomplete JSON Structure

**Status**: ✅ COMPLETED  
**Priority**: URGENT (P0 - Blocker)  
**Complexity**: Medium  
**Estimated Effort**: 1 day  
**Actual Effort**: ~1 hour  
**Completed**: January 9, 2026

## Problem Statement

**Users cannot create new projects** - a critical blocker that has occurred repeatedly despite multiple fix attempts. The issue manifests with the error:

```
TypeError: Cannot read properties of undefined (reading 'comments')
    at NodeGraphModel.fromJSON (NodeGraphModel.ts:57:1)
    at ComponentModel.fromJSON (componentmodel.ts:44:1)
    at ProjectModel.fromJSON (projectmodel.ts:165:1)
```

## Impact

- **Severity**: P0 - Blocks all new users
- **Affected Users**: Anyone trying to create a new project
- **Workaround**: None available
- **User Frustration**: HIGH ("ça commence à être vraiment agaçant!")

## History of Failed Attempts

### Attempt 1: LocalTemplateProvider with relative paths (January 8, 2026)

**Issue**: Path resolution failed with `__dirname` in webpack bundles

```
Error: Hello World template not found at: ./project-examples/version 1.1.0/template-project
```

### Attempt 2: LocalTemplateProvider with process.cwd() (January 8, 2026)

**Issue**: `process.cwd()` pointed to wrong directory

```
Error: Hello World template not found at: /Users/tw/dev/OpenNoodl/OpenNoodl/packages/noodl-editor/project-examples/...
```

### Attempt 3: Programmatic project creation (January 8, 2026)

**Issue**: Incomplete JSON structure missing required fields

```typescript
const minimalProject = {
  name: name,
  components: [
    {
      name: 'App',
      ports: [],
      visual: true,
      visualStateTransitions: [],
      nodes: [
        /* ... */
      ]
    }
  ],
  settings: {},
  metadata: {
    /* ... */
  }
};
```

**Error**: `Cannot read properties of undefined (reading 'comments')`

This indicates the structure is missing critical fields expected by `NodeGraphModel.fromJSON()`.

## Root Causes

1. **Incomplete understanding of project.json schema**

   - No formal schema documentation
   - Required fields not documented
   - Nested structure requirements unclear

2. **Missing graph/node metadata**

   - `comments` field expected but not provided
   - Possibly other required fields: `connections`, `roots`, `graph`, etc.

3. **No validation before project creation**
   - Projects created without structure validation
   - Errors only caught during loading
   - No helpful error messages about missing fields

## Required Investigation

### 1. Analyze Complete Project Structure

- [ ] Find and analyze a working project.json
- [ ] Document ALL required fields at each level
- [ ] Identify which fields are truly required vs optional
- [ ] Document field types and default values

### 2. Analyze NodeGraphModel.fromJSON

- [ ] Find the actual fromJSON implementation
- [ ] Document what fields it expects
- [ ] Understand the `comments` field requirement
- [ ] Check for other hidden dependencies

### 3. Analyze ComponentModel.fromJSON

- [ ] Document the component structure requirements
- [ ] Understand visual vs non-visual components
- [ ] Document the graph/nodes relationship

## Proposed Solution

### Option A: Use Existing Template (RECOMMENDED)

Instead of creating from scratch, use the actual template project:

```typescript
// 1. Bundle template-project as a static asset
// 2. Copy it properly during build
// 3. Reference it correctly at runtime

const templateAsset = require('../../../assets/templates/hello-world/project.json');
const project = JSON.parse(JSON.stringify(templateAsset)); // Deep clone
project.name = projectName;
// Write to disk
```

**Pros**:

- Uses validated structure
- Guaranteed to work
- Easy to maintain
- Can add more templates later

**Cons**:

- Requires webpack configuration
- Larger bundle size

### Option B: Complete Programmatic Structure

Document and implement the full structure:

```typescript
const completeProject = {
  name: name,
  components: [
    {
      name: 'App',
      ports: [],
      visual: true,
      visualStateTransitions: [],
      graph: {
        roots: [
          /* root node ID */
        ],
        comments: [], // REQUIRED!
        connections: []
      },
      nodes: [
        {
          id: guid(),
          type: 'Group',
          x: 0,
          y: 0,
          parameters: {},
          ports: [],
          children: [
            /* ... */
          ]
        }
      ]
    }
  ],
  settings: {},
  metadata: {
    title: name,
    description: 'A new Noodl project'
  },
  // Other potentially required fields
  version: '1.1.0',
  variants: []
  // ... etc
};
```

**Pros**:

- No external dependencies
- Smaller bundle
- Full control

**Cons**:

- Complex to maintain
- Easy to miss required fields
- Will break with schema changes

## Implementation Plan

### Phase 1: Investigation (2-3 hours)

- [ ] Find a working project.json file
- [ ] Document its complete structure
- [ ] Find NodeGraphModel/ComponentModel fromJSON implementations
- [ ] Document all required fields
- [ ] Create schema documentation

### Phase 2: Quick Fix (1 hour)

- [ ] Implement Option A (use template as asset)
- [ ] Configure webpack to bundle template
- [ ] Update LocalProjectsModel to use bundled template
- [ ] Test project creation
- [ ] Verify project opens correctly

### Phase 3: Validation (1 hour)

- [ ] Add project JSON schema validation
- [ ] Validate before writing to disk
- [ ] Provide helpful error messages
- [ ] Add unit tests for project creation

### Phase 4: Documentation (1 hour)

- [ ] Document project.json schema
- [ ] Add examples of minimal valid projects
- [ ] Document how to create custom templates
- [ ] Update LEARNINGS.md with findings

## Files to Modify

### Investigation

- Find: `NodeGraphModel` (likely in `packages/noodl-editor/src/editor/src/models/`)
- Find: `ComponentModel` (same location)
- Find: Valid project.json (check existing projects or tests)

### Implementation

- `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`
  - Fix project creation logic
- `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`
  - Add template asset bundling if needed
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
  - Add validation logic

### Documentation

- `dev-docs/reference/PROJECT-JSON-SCHEMA.md` (NEW)
- `dev-docs/reference/LEARNINGS.md`
- `dev-docs/reference/COMMON-ISSUES.md`

## Testing Strategy

### Manual Tests

- [ ] Create new project from dashboard
- [ ] Verify project opens without errors
- [ ] Verify "App" component is visible
- [ ] Verify nodes are editable
- [ ] Verify project saves correctly
- [ ] Close and reopen project

### Regression Tests

- [ ] Test with existing projects
- [ ] Test with template-based projects
- [ ] Test empty project creation
- [ ] Test project import

### Unit Tests

- [ ] Test project JSON generation
- [ ] Test JSON validation
- [ ] Test error handling

## Success Criteria

- [ ] New users can create projects successfully
- [ ] No console errors during project creation
- [ ] Projects load correctly after creation
- [ ] All components are visible in the editor
- [ ] Projects can be saved and reopened
- [ ] Solution works in both dev and production
- [ ] Comprehensive documentation exists
- [ ] Tests prevent regression

## Related Issues

- Original bug report: Console error "Cannot read properties of undefined (reading 'comments')"
- Related to TASK-009-template-system-refactoring (future enhancement)
- Impacts user onboarding and first-time experience

## Post-Fix Actions

1. **Update TASK-009**: Reference this fix as prerequisite
2. **Add to LEARNINGS.md**: Document the project.json schema learnings
3. **Add to COMMON-ISSUES.md**: Document this problem and solution
4. **Create schema documentation**: Formal PROJECT-JSON-SCHEMA.md
5. **Add validation**: Prevent future similar issues

## Notes

- This is the THIRD attempt to fix this issue
- Problem is recurring due to lack of understanding of required schema
- Proper investigation and documentation needed this time
- Must validate before considering complete

---

**Created**: January 9, 2026  
**Last Updated**: January 9, 2026  
**Assignee**: TBD  
**Blocked By**: None  
**Blocks**: User onboarding, TASK-009
