# GIT Series: Git & GitHub Integration

## Overview

The GIT series transforms Noodl's version control experience from a manual, expert-only feature into a seamless, integrated part of the development workflow. By adding GitHub OAuth, surfacing git status in the dashboard, and encouraging good version control habits, we make collaboration accessible to all Noodl users.

## Target Environment

- **Editor**: React 19 version only
- **Runtime**: Not affected (git is editor-only)
- **Backwards Compatibility**: Existing git projects continue to work

## Task Dependency Graph

```
GIT-001 (GitHub OAuth)
    │
    ├──────────────────────────┐
    │                          │
    ▼                          ▼
GIT-002 (Dashboard Status)  GIT-003 (Repository Cloning)
    │
    ├──────────────────────────┐
    │                          │
    ▼                          ▼
GIT-004 (Auto-Init)        GIT-005 (Enhanced Push/Pull)
```

## Task Summary

| Task ID | Name | Est. Hours | Priority |
|---------|------|------------|----------|
| GIT-001 | GitHub OAuth Integration | 14-20 | Critical |
| GIT-002 | Git Status Dashboard Visibility | 11-16 | High |
| GIT-003 | Repository Cloning | 13-18 | High |
| GIT-004 | Auto-Initialization & Commit Encouragement | 13-19 | Medium |
| GIT-005 | Enhanced Push/Pull UI | 17-23 | Medium |

**Total Estimated: 68-96 hours**

## Implementation Order

### Week 1-2: Authentication & Status
1. **GIT-001** - GitHub OAuth (foundation for GitHub API access)
2. **GIT-002** - Dashboard status (leverages DASH-002 project list)

### Week 3: Cloning & Basic Flow
3. **GIT-003** - Repository cloning (depends on OAuth for private repos)

### Week 4: Polish & Encouragement
4. **GIT-004** - Auto-initialization (depends on status detection)
5. **GIT-005** - Enhanced push/pull (depends on status infrastructure)

## Existing Infrastructure

The codebase already has solid git foundations to build on:

### noodl-git Package
```
packages/noodl-git/src/
├── git.ts              # Main Git class
├── core/
│   ├── clone.ts        # Clone operations
│   ├── push.ts         # Push operations
│   ├── pull.ts         # Pull operations
│   └── ...
├── actions/            # Higher-level actions
└── constants.ts
```

Key existing methods:
- `git.initNewRepo()` - Initialize new repository
- `git.clone()` - Clone with progress
- `git.push()` - Push with progress
- `git.pull()` - Pull with rebase
- `git.status()` - Working directory status
- `git.getBranches()` - List branches
- `git.getCommitsCurrentBranch()` - Commit history

### Version Control Panel
```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
├── VersionControlPanel.tsx
├── components/
│   ├── GitStatusButton.tsx     # Push/pull status
│   ├── GitProviderPopout/      # Credentials management
│   ├── LocalChanges.tsx        # Uncommitted files
│   ├── History.tsx             # Commit history
│   └── BranchMerge.tsx         # Branch operations
└── context/
    └── fetch.context.ts        # Git state management
```

### Credentials Storage
- `GitStore` - Stores credentials per-project encrypted
- `trampoline-askpass-handler` - Handles git credential prompts
- Currently uses PAT (Personal Access Token) for GitHub

## Key Technical Decisions

### OAuth vs PAT

**Current**: Personal Access Token per project
- User creates PAT on GitHub
- Copies to Noodl per project
- Stored encrypted in GitStore

**New (GIT-001)**: OAuth + PAT fallback
- One-click GitHub OAuth
- Token stored globally
- PAT remains for non-GitHub remotes

### Status Checking Strategy

**Approach**: Batch + Cache
- Check multiple projects in parallel
- Cache results with TTL
- Background refresh

**Why**: Git status requires opening each repo, which is slow. Caching makes dashboard responsive while keeping data fresh.

### Auto-Initialization

**Approach**: Opt-out
- Git initialized by default
- Initial commit created automatically
- Can disable in settings

**Why**: Most users benefit from version control. Making it default reduces "I lost my work" issues.

## Services to Create

| Service | Location | Purpose |
|---------|----------|---------|
| GitHubOAuthService | noodl-editor/services | OAuth flow, token management |
| GitHubApiClient | noodl-editor/services | GitHub REST API calls |
| ProjectGitStatusService | noodl-editor/services | Batch status checking, caching |
| CloneService | noodl-editor/services | Clone wrapper with progress |
| CommitReminderService | noodl-editor/services | Periodic commit reminders |
| ConflictResolutionService | noodl-editor/services | Conflict detection, resolution |

## Components to Create

| Component | Package | Purpose |
|-----------|---------|---------|
| GitHubConnectButton | noodl-core-ui | OAuth trigger button |
| GitHubAccountCard | noodl-core-ui | Connected account display |
| GitStatusBadge | noodl-core-ui | Status indicator in list |
| CloneModal | noodl-core-ui | Clone flow modal |
| RepoBrowser | noodl-core-ui | Repository list/search |
| QuickCommitPopup | noodl-core-ui | Fast commit dialog |
| SyncStatusHeader | noodl-core-ui | Editor header sync status |
| BranchSelector | noodl-core-ui | Branch dropdown |
| PullPreviewModal | noodl-core-ui | Preview before pull |

## Dependencies

### On DASH Series
- GIT-002 → DASH-002 (project list for status display)
- GIT-001 → DASH-001 (launcher context for account display)

### External Packages
May need:
```json
{
  "@octokit/rest": "^20.0.0"  // GitHub API client (optional)
}
```

## Security Considerations

1. **OAuth Tokens**: Store with electron's safeStorage API
2. **PKCE Flow**: Use PKCE for OAuth (no client secret in app)
3. **Token Scope**: Request minimum necessary (repo, read:org, read:user)
4. **Credential Cache**: Clear on logout/disconnect
5. **PAT Fallback**: Encrypted per-project storage continues

## Testing Strategy

### Unit Tests
- OAuth token exchange
- Status calculation logic
- Conflict detection
- Default commit message generation

### Integration Tests
- Clone from public repo
- Clone from private repo with auth
- Push/pull with mock remote
- Branch operations

### Manual Testing
- Full OAuth flow
- Dashboard status refresh
- Clone flow end-to-end
- Commit reminder timing
- Conflict resolution

## Cline Usage Notes

### Before Starting Each Task

1. Read the task document completely
2. Review existing git infrastructure:
   - `packages/noodl-git/src/git.ts`
   - `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/`
3. Check GitStore and credential handling

### Key Gotchas

1. **Git operations are async**: Always use try/catch, git can fail
2. **Repository paths**: Use `_retainedProjectDirectory` from ProjectModel
3. **Merge strategy**: Noodl has custom merge for project.json (`mergeProject`)
4. **Auth caching**: Credentials cached by trampoline, may need clearing
5. **Electron context**: Some git ops need main process (deep links)

### Testing Git Operations

```bash
# In tests directory, run git tests
npm run test:editor -- --grep="Git"
```

## Success Criteria (Series Complete)

1. ✅ Users can authenticate with GitHub via OAuth
2. ✅ Git status visible in project dashboard
3. ✅ Users can clone repositories from UI
4. ✅ New projects have git by default
5. ✅ Users are reminded to commit regularly
6. ✅ Pull/push is intuitive with previews
7. ✅ Branch management is accessible

## Future Work (Post-GIT)

The GIT series enables:
- **COMP series**: Shared component repositories
- **DEPLOY series**: Auto-push to frontend repo on deploy
- **Community features**: Public component sharing

## Files in This Series

- `GIT-001-github-oauth.md`
- `GIT-002-dashboard-git-status.md`
- `GIT-003-repository-cloning.md`
- `GIT-004-auto-init-commit-encouragement.md`
- `GIT-005-enhanced-push-pull.md`
- `GIT-OVERVIEW.md` (this file)
