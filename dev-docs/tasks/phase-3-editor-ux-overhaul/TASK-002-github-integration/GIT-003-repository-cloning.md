# GIT-003: Repository Cloning

## Overview

Add the ability to clone GitHub repositories directly from the Noodl dashboard, similar to how VS Code handles cloning. Users can browse their repositories, select one, choose a local folder, and have the project cloned and opened automatically.

## Context

Currently, to work with an existing Noodl project from GitHub, users must:
1. Clone the repo manually using git CLI or another tool
2. Open Noodl
3. Use "Open folder" to navigate to the cloned project

This task streamlines that to:
1. Click "Clone from GitHub"
2. Select repository
3. Choose folder
4. Project opens automatically

### Existing Infrastructure

The `noodl-git` package already has clone functionality:
```typescript
// From git.ts
async clone({ url, directory, singleBranch, onProgress }: GitCloneOptions): Promise<void>
```

And clone tests show it working:
```typescript
await git.clone({
  url: 'https://github.com/github/testrepo.git',
  directory: tempDir,
  onProgress: (progress) => { result.push(progress); }
});
```

## Requirements

### Functional Requirements

1. **Clone Entry Points**
   - "Clone Repository" button in dashboard toolbar
   - "Clone from GitHub" option in "Create Project" menu
   - Right-click empty area → "Clone Repository"

2. **Repository Browser**
   - List user's repositories (requires OAuth from GIT-001)
   - List organization repositories
   - Search/filter repositories
   - Show repo details: name, description, visibility, last updated
   - "Clone URL" input for direct URL entry

3. **Folder Selection**
   - Native folder picker dialog
   - Remember last used parent folder
   - Validate folder is empty or doesn't exist
   - Show full path before cloning

4. **Clone Process**
   - Progress indicator with stages
   - Cancel button
   - Error handling with clear messages
   - Retry option on failure

5. **Post-Clone Actions**
   - Automatically open project in editor
   - Add to recent projects
   - Show success notification

6. **Branch Selection (Optional)**
   - Default to main/master
   - Option to select different branch
   - Shallow clone option for large repos

### Non-Functional Requirements

- Clone progress updates smoothly
- Cancellation works immediately
- Handles large repositories
- Works with private repositories (with auth)
- Clear error messages for common failures

## Technical Approach

### 1. Clone Service

```typescript
// packages/noodl-editor/src/editor/src/services/CloneService.ts

interface CloneOptions {
  url: string;
  directory: string;
  branch?: string;
  shallow?: boolean;
  onProgress?: (progress: CloneProgress) => void;
}

interface CloneProgress {
  phase: 'counting' | 'compressing' | 'receiving' | 'resolving' | 'checking-out';
  percent: number;
  message: string;
}

interface CloneResult {
  success: boolean;
  projectPath?: string;
  error?: string;
}

class CloneService {
  private static instance: CloneService;
  private activeClone: AbortController | null = null;
  
  async clone(options: CloneOptions): Promise<CloneResult>;
  cancel(): void;
  
  // GitHub API integration
  async listUserRepos(): Promise<GitHubRepo[]>;
  async listOrgRepos(orgName: string): Promise<GitHubRepo[]>;
  async searchRepos(query: string): Promise<GitHubRepo[]>;
}
```

### 2. Repository Browser Component

```typescript
// RepoBrowser.tsx

interface RepoBrowserProps {
  onSelect: (repo: GitHubRepo) => void;
  onUrlSubmit: (url: string) => void;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  updatedAt: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}
```

### 3. Clone Modal Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Clone Repository                                              [×]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ [🔍 Search repositories...                                    ] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Your Repositories ▾]  [Organizations: acme-corp ▾]                │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📁 noodl-project-template               ★ 12      2 days ago   │ │
│ │    A starter template for Noodl projects         [Private 🔒]  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 📁 my-awesome-app                        ★ 5      1 week ago   │ │
│ │    An awesome application built with Noodl       [Public 🌍]   │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 📁 client-dashboard                      ★ 0      3 weeks ago  │ │
│ │    Dashboard for client project                  [Private 🔒]  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ─── OR enter repository URL ─────────────────────────────────────  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ https://github.com/user/repo.git                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                              [Cancel]  [Next →]    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Folder Selection Step

```
┌─────────────────────────────────────────────────────────────────────┐
│ Clone Repository                                              [×]  │
├─────────────────────────────────────────────────────────────────────┤
│ Repository: github.com/user/my-awesome-app                         │
│                                                                     │
│ Clone to:                                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ /Users/richard/Projects/my-awesome-app           [Browse...]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ☐ Clone only the default branch (faster)                          │
│                                                                     │
│                                         [← Back]  [Cancel]  [Clone]│
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Progress Step

```
┌─────────────────────────────────────────────────────────────────────┐
│ Cloning Repository                                            [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Cloning my-awesome-app...                                          │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 42%     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Receiving objects: 1,234 of 2,891                                  │
│                                                                     │
│                                                        [Cancel]    │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/CloneService.ts`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CloneModal/CloneModal.tsx`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CloneModal/CloneModal.module.scss`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CloneModal/RepoBrowser.tsx`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CloneModal/FolderSelector.tsx`
6. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CloneModal/CloneProgress.tsx`
7. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/RepoCard/RepoCard.tsx`
8. `packages/noodl-editor/src/editor/src/services/GitHubApiClient.ts` (if not created in GIT-001)

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`
   - Add "Clone Repository" button to toolbar

2. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Add clone modal state and rendering

3. `packages/noodl-utils/LocalProjectsModel.ts`
   - Add cloned project to recent projects list

4. `packages/noodl-editor/src/editor/src/views/projectsview.ts`
   - Ensure cloned project can be opened (may already work)

## Implementation Steps

### Phase 1: Clone Service
1. Create CloneService wrapper around noodl-git
2. Add progress normalization
3. Add cancellation support
4. Test with public repository

### Phase 2: URL-Based Cloning
1. Create basic CloneModal with URL input
2. Create FolderSelector component
3. Create CloneProgress component
4. Wire up clone flow

### Phase 3: Repository Browser
1. Create GitHubApiClient (or extend from GIT-001)
2. Create RepoBrowser component
3. Create RepoCard component
4. Add search/filter functionality

### Phase 4: Integration
1. Add clone button to dashboard
2. Open cloned project automatically
3. Add to recent projects
4. Handle errors gracefully

### Phase 5: Polish
1. Remember last folder
2. Add branch selection
3. Add shallow clone option
4. Improve error messages

## Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Network error | "Unable to connect. Check your internet connection." | Retry button |
| Auth required | "This repository requires authentication. Connect your GitHub account." | Link to OAuth |
| Repo not found | "Repository not found. Check the URL and try again." | Edit URL |
| Permission denied | "You don't have access to this repository." | Suggest checking permissions |
| Folder not empty | "The selected folder is not empty. Choose an empty folder." | Folder picker |
| Disk full | "Not enough disk space to clone this repository." | Show required space |

## Testing Checklist

- [ ] Clone public repository via URL
- [ ] Clone private repository with OAuth token
- [ ] Clone private repository with PAT
- [ ] Repository browser shows user repos
- [ ] Repository browser shows org repos
- [ ] Search/filter works
- [ ] Folder picker opens and works
- [ ] Progress updates smoothly
- [ ] Cancel stops clone in progress
- [ ] Cloned project opens automatically
- [ ] Project appears in recent projects
- [ ] Error messages are helpful
- [ ] Works with various repo sizes
- [ ] Handles repos with submodules

## Dependencies

- GIT-001 (GitHub OAuth) - for repository browser with private repos
- DASH-001 (Tabbed Navigation) - for dashboard integration

## Blocked By

- GIT-001 (partially - URL cloning works without OAuth)

## Blocks

- COMP-004 (Organization Components) - uses similar repo browsing

## Estimated Effort

- Clone service: 2-3 hours
- URL-based clone modal: 3-4 hours
- Repository browser: 4-5 hours
- Integration & auto-open: 2-3 hours
- Polish & error handling: 2-3 hours
- **Total: 13-18 hours**

## Success Criteria

1. Users can clone by entering a URL
2. Users can browse and select their repositories
3. Clone progress is visible and accurate
4. Cloned projects open automatically
5. Private repos work with authentication
6. Errors are handled gracefully
7. Process can be cancelled

## Future Enhancements

- Clone from other providers (GitLab, Bitbucket)
- Clone specific branch/tag
- Clone with submodules options
- Clone into new project template
- Clone history (recently cloned repos)
- Detect Noodl projects vs generic repos
