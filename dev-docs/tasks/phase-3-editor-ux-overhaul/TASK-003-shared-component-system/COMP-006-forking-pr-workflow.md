# COMP-006: Component Forking & PR Workflow

## Overview

Enable users to fork imported components, make modifications, and contribute changes back to the source repository via pull requests. This creates a collaborative component ecosystem where improvements can flow back to the team or community.

## Context

With COMP-005, users can import components and track their source. But when they need to modify a component:
- Modifications are local only
- No way to share improvements back
- No way to propose changes to org components
- Forked components lose connection to source

This task enables:
- Fork components with upstream tracking
- Local modifications tracked separately
- Contribute changes via PR workflow
- Merge upstream updates into forked components

### Forking Flow

```
Import component (COMP-005)
    ↓
User modifies component
    ↓
System detects local modifications ("forked")
    ↓
User can:
  - Submit PR to upstream
  - Merge upstream updates into fork
  - Revert to upstream version
```

## Requirements

### Functional Requirements

1. **Fork Detection**
   - Detect when imported component is modified
   - Mark as "forked" in tracking metadata
   - Track original vs modified state
   - Calculate diff from upstream

2. **Fork Management**
   - View fork status in component panel
   - See what changed from upstream
   - Option to "unfork" (reset to upstream)
   - Maintain fork while pulling upstream updates

3. **PR Creation**
   - "Contribute Back" action on forked components
   - Opens PR creation flow
   - Exports component changes
   - Creates branch in upstream repo
   - Opens GitHub PR interface

4. **Upstream Sync**
   - Pull upstream changes into fork
   - Merge or rebase local changes
   - Conflict detection
   - Selective merge (choose what to pull)

5. **Visual Indicators**
   - "Forked" badge on modified components
   - "Modified from v2.1.0" indicator
   - Diff count ("3 changes")
   - PR status if submitted

### Non-Functional Requirements

- Fork detection < 1 second
- Diff calculation < 3 seconds
- Works with large components (100+ nodes)
- No performance impact on editing

## Technical Approach

### 1. Fork Tracking Extension

```typescript
// Extension to COMP-005 ImportedComponent
interface ImportedComponent {
  // ... existing fields ...
  
  // Fork tracking
  isFork: boolean;
  forkStatus?: ForkStatus;
  originalChecksum?: string;     // Checksum at import time
  currentChecksum?: string;      // Checksum of current state
  upstreamVersion?: string;      // Latest upstream version
  
  // PR tracking
  activePR?: {
    number: number;
    url: string;
    status: 'open' | 'merged' | 'closed';
    branch: string;
  };
}

interface ForkStatus {
  changesCount: number;
  lastModified: string;
  canMergeUpstream: boolean;
  hasConflicts: boolean;
}
```

### 2. Fork Detection Service

```typescript
// packages/noodl-editor/src/editor/src/services/ComponentForkService.ts

class ComponentForkService {
  private static instance: ComponentForkService;
  
  // Fork detection
  async detectForks(): Promise<ForkDetectionResult>;
  async isComponentForked(componentId: string): Promise<boolean>;
  async calculateDiff(componentId: string): Promise<ComponentDiff>;
  
  // Fork management
  async markAsForked(componentId: string): Promise<void>;
  async unfork(componentId: string): Promise<void>;  // Reset to upstream
  
  // Upstream sync
  async canMergeUpstream(componentId: string): Promise<MergeCheck>;
  async mergeUpstream(componentId: string): Promise<MergeResult>;
  async previewMerge(componentId: string): Promise<MergePreview>;
  
  // PR workflow
  async createContribution(componentId: string): Promise<ContributionResult>;
  async checkPRStatus(componentId: string): Promise<PRStatus>;
  
  // Diff/comparison
  async exportDiff(componentId: string): Promise<ComponentDiff>;
  async compareWithUpstream(componentId: string): Promise<ComparisonResult>;
}

interface ComponentDiff {
  componentId: string;
  changes: Change[];
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  propertiesChanged: number;
}

interface Change {
  type: 'added' | 'removed' | 'modified';
  path: string;  // Path in component tree
  description: string;
  before?: any;
  after?: any;
}
```

### 3. Checksum Calculation

```typescript
// Calculate stable checksum for component state
function calculateComponentChecksum(component: ComponentModel): string {
  // Serialize component in stable order
  const serialized = stableSerialize({
    nodes: component.nodes.map(serializeNode),
    connections: component.connections.map(serializeConnection),
    properties: component.properties,
    // Exclude metadata that changes (ids, timestamps)
  });
  
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

// Detect if component was modified
async function detectModification(componentId: string): Promise<boolean> {
  const metadata = ComponentTrackingService.instance.getComponentSource(componentId);
  if (!metadata?.originalChecksum) return false;
  
  const component = ProjectModel.instance.getComponentWithId(componentId);
  const currentChecksum = calculateComponentChecksum(component);
  
  return currentChecksum !== metadata.originalChecksum;
}
```

### 4. PR Creation Flow

```typescript
async createContribution(componentId: string): Promise<ContributionResult> {
  const tracking = ComponentTrackingService.instance;
  const metadata = tracking.getComponentSource(componentId);
  
  if (!metadata?.source.repository) {
    throw new Error('Cannot contribute: no upstream repository');
  }
  
  // 1. Export modified component
  const component = ProjectModel.instance.getComponentWithId(componentId);
  const exportedFiles = await exportComponent(component);
  
  // 2. Create branch in upstream repo
  const branchName = `component-update/${metadata.componentName}-${Date.now()}`;
  const github = GitHubApiClient.instance;
  
  await github.createBranch(
    metadata.source.repository,
    branchName,
    'main'
  );
  
  // 3. Commit changes to branch
  await github.commitFiles(
    metadata.source.repository,
    branchName,
    exportedFiles,
    `Update ${metadata.componentName} component`
  );
  
  // 4. Create PR
  const pr = await github.createPullRequest(
    metadata.source.repository,
    {
      title: `Update ${metadata.componentName} component`,
      body: generatePRDescription(metadata, exportedFiles),
      head: branchName,
      base: 'main'
    }
  );
  
  // 5. Track PR in metadata
  metadata.activePR = {
    number: pr.number,
    url: pr.html_url,
    status: 'open',
    branch: branchName
  };
  await tracking.saveMetadata();
  
  return {
    success: true,
    prUrl: pr.html_url,
    prNumber: pr.number
  };
}
```

### 5. UI Components

#### Fork Badge in Component Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Components                                                          │
├─────────────────────────────────────────────────────────────────────┤
│ ├── AcmeButton  [🏢 v2.1.0] [🔀 Forked +3]                          │
│ │   ├── Right-click options:                                       │
│ │   │   • View Changes from Upstream                               │
│ │   │   • Merge Upstream Changes                                   │
│ │   │   • Contribute Changes (Create PR)                           │
│ │   │   • Reset to Upstream                                        │
│ │   │   ──────────────────────                                     │
│ │   │   • PR #42 Open ↗                                            │
│ │   └──                                                             │
└─────────────────────────────────────────────────────────────────────┘
```

#### Diff View Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Changes in AcmeButton                                         [×]  │
│ Forked from v2.1.0                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Summary: 3 nodes modified, 1 added, 0 removed                      │
│                                                                     │
│ CHANGES                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ + Added: LoadingSpinner node                                    │ │
│ │   └─ Displays while button action is processing                 │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ~ Modified: Button/backgroundColor                              │ │
│ │   └─ #3B82F6 → #2563EB (darker blue)                           │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ~ Modified: Button/borderRadius                                 │ │
│ │   └─ 4px → 8px                                                  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ~ Modified: HoverState/scale                                    │ │
│ │   └─ 1.02 → 1.05                                                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│              [Reset to Upstream]  [Contribute Changes]  [Close]    │
└─────────────────────────────────────────────────────────────────────┘
```

#### PR Creation Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Contribute Changes                                            [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ You're about to create a Pull Request to:                          │
│ 🏢 acme-corp/noodl-components                                       │
│                                                                     │
│ Component: AcmeButton                                               │
│ Changes: 3 modifications, 1 addition                               │
│                                                                     │
│ PR Title:                                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Update AcmeButton: add loading state, adjust styling           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Description:                                                        │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ This PR updates the AcmeButton component with:                  │ │
│ │ - Added loading spinner during async actions                    │ │
│ │ - Darker blue for better contrast                               │ │
│ │ - Larger border radius for modern look                          │ │
│ │ - More pronounced hover effect                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ☑ Open PR in browser after creation                                │
│                                                                     │
│                                         [Cancel]  [Create PR]      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6. Upstream Merge Flow

```typescript
async mergeUpstream(componentId: string): Promise<MergeResult> {
  const tracking = ComponentTrackingService.instance;
  const metadata = tracking.getComponentSource(componentId);
  
  // 1. Get upstream version
  const source = PrefabRegistry.instance.getSource(metadata.source.repository);
  const upstreamPath = await source.downloadPrefab(metadata.source.prefabId);
  
  // 2. Get current component
  const currentComponent = ProjectModel.instance.getComponentWithId(componentId);
  
  // 3. Get original version (at import time)
  const originalPath = await this.getOriginalVersion(componentId);
  
  // 4. Three-way merge
  const mergeResult = await mergeComponents(
    originalPath,    // Base
    upstreamPath,    // Theirs (upstream)
    currentComponent // Ours (local modifications)
  );
  
  if (mergeResult.hasConflicts) {
    // Show conflict resolution UI
    return { success: false, conflicts: mergeResult.conflicts };
  }
  
  // 5. Apply merged result
  await applyMergedComponent(componentId, mergeResult.merged);
  
  // 6. Update metadata
  metadata.importedVersion = upstreamVersion;
  metadata.originalChecksum = calculateChecksum(mergeResult.merged);
  await tracking.saveMetadata();
  
  return { success: true };
}
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/ComponentForkService.ts`
2. `packages/noodl-editor/src/editor/src/utils/componentChecksum.ts`
3. `packages/noodl-editor/src/editor/src/utils/componentMerge.ts`
4. `packages/noodl-core-ui/src/components/modals/ComponentDiffModal/ComponentDiffModal.tsx`
5. `packages/noodl-core-ui/src/components/modals/CreatePRModal/CreatePRModal.tsx`
6. `packages/noodl-core-ui/src/components/modals/MergeUpstreamModal/MergeUpstreamModal.tsx`
7. `packages/noodl-core-ui/src/components/common/ForkBadge/ForkBadge.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/services/ComponentTrackingService.ts`
   - Add fork tracking fields
   - Add checksum calculation
   - Integration with ForkService

2. `packages/noodl-editor/src/editor/src/views/panels/componentspanel.tsx`
   - Add fork badge
   - Add fork-related context menu items

3. `packages/noodl-editor/src/editor/src/services/GitHubApiClient.ts`
   - Add branch creation
   - Add file commit
   - Add PR creation

4. `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
   - Hook component save to detect modifications

## Implementation Steps

### Phase 1: Fork Detection
1. Implement checksum calculation
2. Store original checksum on import
3. Detect modifications on component save
4. Mark forked components

### Phase 2: Diff Calculation
1. Implement component diff algorithm
2. Create human-readable change descriptions
3. Calculate change counts

### Phase 3: UI - Fork Indicators
1. Create ForkBadge component
2. Add to component panel
3. Add context menu items
4. Show fork status

### Phase 4: UI - Diff View
1. Create ComponentDiffModal
2. Show changes list
3. Add action buttons

### Phase 5: PR Workflow
1. Implement branch creation
2. Implement file commit
3. Implement PR creation
4. Create CreatePRModal

### Phase 6: Upstream Merge
1. Implement three-way merge
2. Create MergeUpstreamModal
3. Handle conflicts
4. Update metadata after merge

## Testing Checklist

- [ ] Modification detected correctly
- [ ] Fork badge appears
- [ ] Diff calculated accurately
- [ ] Diff modal shows changes
- [ ] PR creation works
- [ ] PR opens in browser
- [ ] PR status tracked
- [ ] Upstream merge works (no conflicts)
- [ ] Conflict detection works
- [ ] Reset to upstream works
- [ ] Multiple forks tracked
- [ ] Works with org repos
- [ ] Works with personal repos
- [ ] Checksum stable across saves

## Dependencies

- COMP-003 (Component Export)
- COMP-004 (Organization Components)
- COMP-005 (Component Import Version Control)
- GIT-001 (GitHub OAuth)

## Blocked By

- COMP-005

## Blocks

- None (final task in COMP series)

## Estimated Effort

- Fork detection & checksum: 4-5 hours
- Diff calculation: 4-5 hours
- Fork UI (badges, menus): 3-4 hours
- Diff view modal: 3-4 hours
- PR workflow: 5-6 hours
- Upstream merge: 5-6 hours
- Testing & polish: 4-5 hours
- **Total: 28-35 hours**

## Success Criteria

1. Modified components detected as forks
2. Fork badge visible in UI
3. Diff view shows changes clearly
4. PR creation works end-to-end
5. PR status tracked
6. Upstream merge works smoothly
7. Conflict handling is clear

## Future Enhancements

- Visual diff editor
- Partial contribution (select changes for PR)
- Auto-update after PR merged
- Fork from fork (nested forks)
- Component version branches
- Conflict resolution UI
- PR review integration
