# COMP-004: Organization Components Repository

## Overview

Enable teams to share a central component repository at the organization level. When a user belongs to a GitHub organization, they can access shared components from that org's component repository, creating a design system that's consistent across all team projects.

## Context

Individual developers can export components to personal repos (COMP-003), but teams need:
- Shared component library accessible to all org members
- Consistent design system across projects
- Centralized component governance
- Version control for team components

This task adds organization-level component repositories to the prefab source system.

### Organization Flow

```
User authenticates with GitHub (GIT-001)
    ↓
System detects user's organizations
    ↓
For each org, check for `noodl-components` repo
    ↓
Register as prefab source if found
    ↓
Components appear in NodePicker
```

## Requirements

### Functional Requirements

1. **Organization Detection**
   - Detect user's GitHub organizations
   - Check for component repository in each org
   - Support custom repo names (configurable)
   - Handle multiple organizations

2. **Repository Discovery**
   - Auto-detect `{org}/noodl-components` repos
   - Validate repository structure
   - Read repository manifest
   - Cache organization components

3. **Component Access**
   - List org components in NodePicker
   - Show org badge on components
   - Filter by organization
   - Search across all org repos

4. **Permission Handling**
   - Respect GitHub permissions
   - Handle private repositories
   - Clear error messages for access issues
   - Re-auth prompt when needed

5. **Organization Settings**
   - Enable/disable specific org repos
   - Priority ordering between orgs
   - Refresh/sync controls
   - View org repo on GitHub

### Non-Functional Requirements

- Org components load within 3 seconds
- Cached for offline use after first load
- Handles orgs with 100+ components
- Works with GitHub Enterprise (future)

## Technical Approach

### 1. Organization Prefab Source

```typescript
// packages/noodl-editor/src/editor/src/models/prefab/sources/OrganizationPrefabSource.ts

interface OrganizationConfig {
  orgName: string;
  repoName: string;
  enabled: boolean;
  priority: number;
}

class OrganizationPrefabSource implements PrefabSource {
  config: PrefabSourceConfig;
  
  constructor(private orgConfig: OrganizationConfig) {
    this.config = {
      id: `org:${orgConfig.orgName}`,
      name: orgConfig.orgName,
      priority: orgConfig.priority,
      enabled: orgConfig.enabled
    };
  }
  
  async initialize(): Promise<void> {
    // Verify repo access
    const hasAccess = await this.verifyRepoAccess();
    if (!hasAccess) {
      throw new PrefabSourceError('No access to organization repository');
    }
    
    // Load manifest
    await this.loadManifest();
  }
  
  async listPrefabs(): Promise<PrefabMetadata[]> {
    const manifest = await this.getManifest();
    return manifest.components.map(c => ({
      ...c,
      id: `org:${this.orgConfig.orgName}:${c.id}`,
      source: 'organization',
      organization: this.orgConfig.orgName
    }));
  }
  
  async downloadPrefab(id: string): Promise<string> {
    // Clone specific component from repo
    const componentPath = this.getComponentPath(id);
    return await this.downloadFromGitHub(componentPath);
  }
}
```

### 2. Organization Discovery Service

```typescript
// packages/noodl-editor/src/editor/src/services/OrganizationService.ts

interface Organization {
  name: string;
  displayName: string;
  avatarUrl: string;
  hasComponentRepo: boolean;
  componentRepoUrl?: string;
  memberCount?: number;
}

class OrganizationService {
  private static instance: OrganizationService;
  
  // Discovery
  async discoverOrganizations(): Promise<Organization[]>;
  async checkForComponentRepo(orgName: string): Promise<boolean>;
  async validateComponentRepo(orgName: string, repoName: string): Promise<boolean>;
  
  // Registration
  async registerOrgSource(org: Organization): Promise<void>;
  async unregisterOrgSource(orgName: string): Promise<void>;
  
  // Settings
  getOrgSettings(orgName: string): OrganizationConfig;
  updateOrgSettings(orgName: string, settings: Partial<OrganizationConfig>): void;
  
  // Refresh
  async refreshOrgComponents(orgName: string): Promise<void>;
  async refreshAllOrgs(): Promise<void>;
}
```

### 3. Auto-Registration on Login

```typescript
// Integration with GitHub OAuth

async function onGitHubAuthenticated(token: string): Promise<void> {
  const orgService = OrganizationService.instance;
  const registry = PrefabRegistry.instance;
  
  // Discover user's organizations
  const orgs = await orgService.discoverOrganizations();
  
  for (const org of orgs) {
    // Check for component repo
    const hasRepo = await orgService.checkForComponentRepo(org.name);
    
    if (hasRepo) {
      // Register as prefab source
      const source = new OrganizationPrefabSource({
        orgName: org.name,
        repoName: 'noodl-components',
        enabled: true,
        priority: 80  // Below built-in, above docs
      });
      
      registry.registerSource(source);
    }
  }
}
```

### 4. Organization Settings UI

```
┌─────────────────────────────────────────────────────────────────────┐
│ Organization Components                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Connected Organizations                                             │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [🏢] Acme Corp                                                  │ │
│ │     noodl-components • 24 components • Last synced: 2h ago      │ │
│ │     [☑ Enabled] [⚙️ Settings] [🔄 Sync] [↗️ View on GitHub]      │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ [🏢] StartupXYZ                                                 │ │
│ │     noodl-components • 8 components • Last synced: 1d ago       │ │
│ │     [☑ Enabled] [⚙️ Settings] [🔄 Sync] [↗️ View on GitHub]      │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ [🏢] OpenSource Collective                                      │ │
│ │     ⚠️ No component repository found                             │ │
│ │     [Create Repository]                                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [🔄 Refresh Organizations]                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. NodePicker Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│ Prefabs                                                             │
├─────────────────────────────────────────────────────────────────────┤
│ 🔍 Search prefabs...                                                │
├─────────────────────────────────────────────────────────────────────┤
│ Source: [All Sources ▾]  Category: [All ▾]                         │
│         • All Sources                                               │
│         • Built-in                                                  │
│         • Acme Corp                                                 │
│         • StartupXYZ                                                │
│         • Community                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ACME CORP                                                          │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 🏢 AcmeButton                              v2.1.0    [Clone]   │ │
│ │    Standard button following Acme design system                │ │
│ ├────────────────────────────────────────────────────────────────┤ │
│ │ 🏢 AcmeCard                                v1.3.0    [Clone]   │ │
│ │    Card component with Acme styling                            │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ BUILT-IN                                                           │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 📦 Form Input                              v1.0.0    [Clone]   │ │
│ │    Standard form input with validation                         │ │
│ └────────────────────────────────────────────────────────────────┘ │
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/models/prefab/sources/OrganizationPrefabSource.ts`
2. `packages/noodl-editor/src/editor/src/services/OrganizationService.ts`
3. `packages/noodl-core-ui/src/components/settings/OrganizationSettings/OrganizationSettings.tsx`
4. `packages/noodl-core-ui/src/components/settings/OrganizationSettings/OrgCard.tsx`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/OrganizationsView.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/services/GitHubOAuthService.ts`
   - Trigger org discovery on auth

2. `packages/noodl-editor/src/editor/src/models/prefab/PrefabRegistry.ts`
   - Handle org sources dynamically
   - Add source filtering

3. `packages/noodl-editor/src/editor/src/views/NodePicker/tabs/NodePickerSearchView/NodePickerSearchView.tsx`
   - Add source filter dropdown
   - Show org badges

4. `packages/noodl-editor/src/editor/src/views/NodePicker/components/ModuleCard/ModuleCard.tsx`
   - Show organization name
   - Different styling for org components

5. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Add Organizations section/page

## Implementation Steps

### Phase 1: Organization Discovery
1. Create OrganizationService
2. Implement GitHub org listing
3. Check for component repos
4. Store org data

### Phase 2: Organization Source
1. Create OrganizationPrefabSource
2. Implement manifest loading
3. Implement component downloading
4. Add to PrefabRegistry

### Phase 3: Auto-Registration
1. Hook into OAuth flow
2. Auto-register on login
3. Handle permission changes
4. Persist org settings

### Phase 4: Settings UI
1. Create OrganizationSettings component
2. Create OrgCard component
3. Add to Settings panel
4. Implement enable/disable

### Phase 5: NodePicker Integration
1. Add source filter
2. Show org grouping
3. Add org badges
4. Update search

### Phase 6: Polish
1. Sync/refresh functionality
2. Error handling
3. Offline support
4. Performance optimization

## Testing Checklist

- [ ] Organizations discovered on login
- [ ] Component repos detected
- [ ] Source registered for orgs with repos
- [ ] Components appear in NodePicker
- [ ] Source filter works
- [ ] Org badge displays
- [ ] Enable/disable works
- [ ] Sync refreshes components
- [ ] Private repos accessible
- [ ] Permission errors handled
- [ ] Works with multiple orgs
- [ ] Caching works offline
- [ ] Settings persist

## Dependencies

- COMP-001 (Prefab System Refactoring)
- COMP-003 (Component Export) - for repository structure
- GIT-001 (GitHub OAuth) - for organization access

## Blocked By

- COMP-001
- GIT-001

## Blocks

- COMP-005 (depends on org repos existing)
- COMP-006 (depends on org repos existing)

## Estimated Effort

- Organization discovery: 3-4 hours
- OrganizationPrefabSource: 4-5 hours
- Auto-registration: 2-3 hours
- Settings UI: 3-4 hours
- NodePicker integration: 3-4 hours
- Polish & testing: 3-4 hours
- **Total: 18-24 hours**

## Success Criteria

1. Orgs auto-detected on GitHub login
2. Component repos discovered automatically
3. Org components appear in NodePicker
4. Can filter by organization
5. Settings allow enable/disable
6. Works with private repositories
7. Clear error messages for access issues

## Repository Setup Guide (For Users)

To create an organization component repository:

1. Create repo named `noodl-components` in your org
2. Add `index.json` manifest file:
```json
{
  "name": "Acme Components",
  "version": "1.0.0",
  "components": []
}
```
3. Export components using COMP-003
4. Noodl will auto-detect the repository

## Future Enhancements

- GitHub Enterprise support
- Repository templates
- Permission levels (read/write per component)
- Component approval workflow
- Usage analytics per org
- Component deprecation notices
- Multi-repo per org support
