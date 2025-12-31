# GIT-004E: Component Linking System

## Overview

**THE KILLER FEATURE**: Enable bidirectional linking between GitHub issues and visual components in Nodegex. This creates unprecedented traceability between project management and implementation—something no other low-code platform offers.

Users can link issues to the components they affect, create issues directly from component context menus with auto-populated context, and navigate seamlessly between the issue tracker and the visual editor.

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** CRITICAL (key differentiator)  
**Effort:** 14-18 hours  
**Risk:** Medium (metadata persistence, navigation integration)

**Depends on:** GIT-004D (Issues CRUD)

---

## Strategic Value

### Unique Differentiator

| Platform | Issue Tracking | Component Linking |
|----------|---------------|-------------------|
| Retool | ❌ | ❌ |
| Bubble | ❌ | ❌ |
| Webflow | ❌ | ❌ |
| Linear + Figma | ✅ Issues | ❌ Not to code |
| **Nodegex** | ✅ Full | **✅ Unique** |

### Use Cases

1. **Bug Tracking**: "This issue affects the LoginForm component"
2. **Feature Requests**: "This feature will be implemented in Dashboard"
3. **Code Review**: "PR #42 modifies these 3 components"
4. **Onboarding**: "To understand this component, see related issues"

---

## User Experience

### Component Context Menu

```
┌─────────────────────────────────────┐
│ UserLoginForm                       │
├─────────────────────────────────────┤
│ 📋 Copy                             │
│ 📋 Paste                            │
│ ───────────────────────────────────│
│ ✏️ Rename                           │
│ 🗑️ Delete                           │
│ ───────────────────────────────────│
│ 🐛 Report Bug                    ◄── Quick bug report
│ 📋 Create Issue                  ◄── Full issue creation
│ 🔗 Link to Issue...              ◄── Link existing issue
│ ───────────────────────────────────│
│ 👁️ View Linked Issues (3)        ◄── Show linked issues
└─────────────────────────────────────┘
```

### Component with Linked Issues Badge

```
Canvas View:
┌───────────────────────────────────────┐
│                                       │
│   ┌─────────────────┐                 │
│   │ UserLoginForm   │                 │
│   │            [🔴3]│ ◄── Badge: 3 open issues
│   └─────────────────┘                 │
│                                       │
│   ┌─────────────────┐                 │
│   │ PaymentForm     │                 │
│   │            [🟢✓]│ ◄── Badge: all issues closed
│   └─────────────────┘                 │
│                                       │
│   ┌─────────────────┐                 │
│   │ Dashboard       │                 │
│   │                 │ ◄── No badge: no linked issues
│   └─────────────────┘                 │
│                                       │
└───────────────────────────────────────┘
```

### Link Issue Dialog

```
┌─────────────────────────────────────────────────────────┐
│ Link Issue to UserLoginForm                        [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Search issues...                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔍 validation                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ○ #42 Login form validation broken           🐛    │ │
│ │ ● #38 Add password strength meter            ✨    │ │
│ │ ○ #35 Form accessibility improvements        📝    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Link Type                                               │
│ ● Implements  ○ Fixes  ○ Related to                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                              [Cancel]  [Link Issue]     │
└─────────────────────────────────────────────────────────┘
```

### Issue Detail with Linked Components

```
┌─────────────────────────────────────────┐
│ #42 Login form validation broken        │
├─────────────────────────────────────────┤
│ ... issue content ...                   │
├─────────────────────────────────────────┤
│ 🔗 Linked Components                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 📦 UserLoginForm                    │ │
│ │    implements this issue            │ │
│ │                    [Go to Component]│ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 📦 ValidationUtils                  │ │
│ │    related to this issue            │ │
│ │                    [Go to Component]│ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Property Panel Section

```
┌─────────────────────────────────────────┐
│ UserLoginForm                           │
├─────────────────────────────────────────┤
│ Properties                              │
│ ├─ Width: 400px                         │
│ ├─ Height: auto                         │
│ └─ ...                                  │
├─────────────────────────────────────────┤
│ 🔗 Linked Issues                        │
├─────────────────────────────────────────┤
│ 🔴 #42 Login validation broken          │
│    └─ implements • @johndoe             │
│ 🟢 #38 Password strength (closed)       │
│    └─ implements • @janedoe             │
│                                         │
│ [+ Link Issue]                          │
└─────────────────────────────────────────┘
```

---

## Architecture

### Metadata Schema

```typescript
// Component metadata extension in project.json
interface ComponentDefinition {
  name: string;
  graph: NodeGraph;
  // ... existing fields
  
  // NEW: GitHub integration metadata
  github?: {
    linkedIssues: LinkedIssue[];
    linkedPRs?: LinkedPR[];  // Future: PR linking
  };
}

interface LinkedIssue {
  number: number;           // GitHub issue number
  linkType: 'implements' | 'fixes' | 'related';
  linkedAt: string;         // ISO date
  linkedBy?: string;        // GitHub username
}

interface LinkedPR {
  number: number;
  linkedAt: string;
}
```

### Component Structure

```
packages/noodl-editor/src/editor/src/services/github/
├── ComponentLinking.ts           # Core linking logic
├── ComponentLinkingTypes.ts      # TypeScript interfaces

packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   ├── LinkIssueDialog.tsx       # Dialog to link existing issue
│   ├── LinkedComponentsList.tsx  # Show components in issue detail
│   └── ComponentIssueBadge.tsx   # Badge for canvas view

packages/noodl-editor/src/editor/src/views/PropertyPanel/
├── sections/
│   └── LinkedIssuesSection.tsx   # Issues section in property panel
```

### Service Layer

```typescript
// ComponentLinking.ts
export class ComponentLinking {
  // Link an issue to a component
  static async linkIssue(
    componentName: string,
    issueNumber: number,
    linkType: LinkType
  ): Promise<void>;
  
  // Unlink an issue from a component
  static async unlinkIssue(
    componentName: string,
    issueNumber: number
  ): Promise<void>;
  
  // Get all issues linked to a component
  static getLinkedIssues(componentName: string): LinkedIssue[];
  
  // Get all components linked to an issue
  static getLinkedComponents(issueNumber: number): LinkedComponent[];
  
  // Check if component has open issues
  static hasOpenIssues(componentName: string): boolean;
  
  // Get issue badge info for component
  static getBadgeInfo(componentName: string): BadgeInfo;
}
```

---

## Implementation Phases

### Phase 1: Metadata System (3-4 hours)

**Files to Create:**
- `services/github/ComponentLinking.ts`
- `services/github/ComponentLinkingTypes.ts`

**Tasks:**
1. Design metadata schema
2. Extend ProjectModel with GitHub metadata methods
3. Implement metadata persistence in project.json
4. Create ComponentLinking service class
5. Add migration for existing projects (empty metadata)

**Success Criteria:**
- [ ] Can save link metadata to component
- [ ] Metadata persists in project.json
- [ ] Can retrieve linked issues for component
- [ ] Can retrieve linked components for issue

---

### Phase 2: Link Issue Dialog (3-4 hours)

**Files to Create:**
- `components/LinkIssueDialog.tsx`
- `components/LinkIssueDialog.module.scss`

**Tasks:**
1. Create dialog component
2. Implement issue search within dialog
3. Add link type selector (implements, fixes, related)
4. Save link on confirmation
5. Update issue detail to show link

**Success Criteria:**
- [ ] Dialog opens from context menu
- [ ] Can search and select issue
- [ ] Can choose link type
- [ ] Link saved to component

---

### Phase 3: Create Issue from Component (3-4 hours)

**Files to Modify:**
- `components/IssuesTab/CreateIssueDialog.tsx`
- `components/IssuesTab/QuickBugReport.tsx`

**Tasks:**
1. Add component context to create dialog
2. Pre-fill issue with component info
3. Auto-generate description with component path
4. Option to include component screenshot
5. Auto-link created issue to component

**Success Criteria:**
- [ ] "Create Issue" in context menu works
- [ ] Dialog pre-fills component name
- [ ] Description includes component path
- [ ] New issue auto-linked

---

### Phase 4: Visual Indicators (2-3 hours)

**Files to Create:**
- `components/ComponentIssueBadge.tsx`

**Files to Modify:**
- Node graph editor component rendering

**Tasks:**
1. Create badge component
2. Add badge rendering to node graph editor
3. Show count of linked issues
4. Color-code by issue status (red=open, green=all closed)
5. Add click handler to show linked issues

**Success Criteria:**
- [ ] Badge appears on components with links
- [ ] Badge shows issue count
- [ ] Color indicates status
- [ ] Click shows linked issues

---

### Phase 5: Navigation (2-3 hours)

**Files to Create:**
- `components/LinkedComponentsList.tsx`

**Files to Modify:**
- `components/IssuesTab/IssueDetail.tsx`
- Property panel integration

**Tasks:**
1. Add "Linked Components" section to issue detail
2. Implement click-to-navigate from issue to component
3. Add "Linked Issues" section to property panel
4. Implement click-to-navigate from component to issue

**Success Criteria:**
- [ ] Issue shows linked components
- [ ] Can click to navigate to component
- [ ] Property panel shows linked issues
- [ ] Can click to navigate to issue

---

### Phase 6: Quick Bug Report Integration (1-2 hours)

**Files to Modify:**
- Node graph editor context menu

**Tasks:**
1. Add "Report Bug" to component context menu
2. Connect to QuickBugReport dialog
3. Pass component context
4. Auto-link on creation

**Success Criteria:**
- [ ] "Report Bug" in context menu
- [ ] Opens quick dialog
- [ ] Component info included
- [ ] Bug auto-linked

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/services/github/
├── ComponentLinking.ts
└── ComponentLinkingTypes.ts

packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   ├── LinkIssueDialog.tsx
│   ├── LinkIssueDialog.module.scss
│   ├── LinkedComponentsList.tsx
│   └── ComponentIssueBadge.tsx

packages/noodl-editor/src/editor/src/views/PropertyPanel/
├── sections/
│   └── LinkedIssuesSection.tsx
```

### Modify

```
packages/noodl-editor/src/editor/src/models/projectmodel.ts
  - Add methods for component GitHub metadata

packages/noodl-editor/src/editor/src/views/nodegrapheditor/
  - Add visual indicators for components with linked issues
  - Add context menu items

packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
  components/IssuesTab/IssueDetail.tsx
  - Add linked components section

packages/noodl-editor/src/editor/src/views/PropertyPanel/
  PropertyPanel.tsx
  - Add linked issues section
```

---

## User Flows

### Flow 1: Link Existing Issue to Component

```
1. Right-click component in canvas
2. Select "Link to Issue..."
3. Search for issue in dialog
4. Select issue and link type
5. Click "Link Issue"
6. Component shows badge
7. Issue detail shows component link
```

### Flow 2: Create Issue from Component

```
1. Right-click component in canvas
2. Select "Create Issue"
3. Dialog opens with component info pre-filled
4. Fill in issue details
5. Click "Create Issue"
6. Issue created on GitHub
7. Auto-linked to component
```

### Flow 3: Navigate Issue → Component

```
1. Open issue in GitHub Panel
2. Scroll to "Linked Components" section
3. Click "Go to Component"
4. Editor navigates to component
5. Component selected/highlighted
```

### Flow 4: Navigate Component → Issue

```
1. Select component in canvas
2. Open Property Panel
3. See "Linked Issues" section
4. Click issue number
5. GitHub Panel opens to issue detail
```

### Flow 5: Quick Bug Report

```
1. Right-click component
2. Select "Report Bug"
3. Enter bug title
4. Click "Report Bug"
5. Issue created with bug label
6. Auto-linked to component
```

---

## Testing Checklist

### Metadata
- [ ] Link saves to project.json
- [ ] Link persists after reload
- [ ] Multiple links to same component work
- [ ] Same issue linked to multiple components

### Link Dialog
- [ ] Dialog opens from context menu
- [ ] Search finds issues
- [ ] Link type selectable
- [ ] Link created successfully

### Create from Component
- [ ] Context menu item works
- [ ] Pre-fills component name
- [ ] Includes component path
- [ ] Auto-links after creation

### Visual Indicators
- [ ] Badge appears on linked components
- [ ] Count is accurate
- [ ] Color reflects status
- [ ] Badge click works

### Navigation
- [ ] Issue → Component works
- [ ] Component → Issue works
- [ ] Component highlighted after navigation

### Quick Bug Report
- [ ] Opens from context menu
- [ ] Creates issue with bug label
- [ ] Links to component

### Edge Cases
- [ ] Component renamed (links preserved)
- [ ] Component deleted (links cleaned up)
- [ ] Issue deleted on GitHub (handle gracefully)
- [ ] Large number of links

---

## Progress Tracking

| Phase | Status | Started | Completed | Hours |
|-------|--------|---------|-----------|-------|
| Phase 1: Metadata System | Not Started | - | - | - |
| Phase 2: Link Dialog | Not Started | - | - | - |
| Phase 3: Create from Component | Not Started | - | - | - |
| Phase 4: Visual Indicators | Not Started | - | - | - |
| Phase 5: Navigation | Not Started | - | - | - |
| Phase 6: Quick Bug Report | Not Started | - | - | - |

**Estimated Total:** 14-18 hours  
**Actual Total:** - hours

---

## Future Enhancements

- PR linking (show PRs that modify component)
- Deployment history per component
- AI-suggested issue linking
- Bulk linking operations
- Link visualization graph
