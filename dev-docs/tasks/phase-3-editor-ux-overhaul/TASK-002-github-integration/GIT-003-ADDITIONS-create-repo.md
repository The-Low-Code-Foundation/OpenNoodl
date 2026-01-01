# GIT-003 Addition: Create Repository from Editor

**Insert this section into:** `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-002-github-integration/GIT-003-repository-cloning.md`

**Insert after:** The existing "Repository Cloning" scope section

---

## Additional Scope: Create Repository from Editor

### Overview

Beyond cloning existing repositories, users should be able to create new GitHub repositories directly from the Nodegex launcher or editor without leaving the application.

**Added Effort:** 4-6 hours (on top of existing GIT-003 estimate)

### User Flow

```
New Project Dialog:
├── 📁 Create Local Project (existing)
│       └── Standard local-only project
│
├── 📥 Clone from GitHub (existing GIT-003 scope)  
│       └── Clone existing repo
│
└── 🆕 Create New GitHub Repository (NEW)
        ├── Repository name: [my-noodl-project]
        ├── Description: [Optional description]
        ├── Visibility: ○ Public  ● Private
        ├── Owner: [▾ My Account / My Org 1 / My Org 2]
        ├── ☑ Initialize with README
        ├── ☑ Add .gitignore (Noodl template)
        └── [Create Repository & Open]
```

### UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ Create New GitHub Repository                              [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ OWNER                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 johndoe                                              [▾] │ │
│ │ ────────────────────────────────────────────────────────    │ │
│ │ 👤 johndoe (personal)                                       │ │
│ │ 🏢 my-company                                               │ │
│ │ 🏢 another-org                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ REPOSITORY NAME                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ my-awesome-app                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ✓ my-awesome-app is available                                   │
│                                                                 │
│ DESCRIPTION (optional)                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ A Noodl project for...                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ VISIBILITY                                                      │
│ ● 🔓 Public - Anyone can see this repository                   │
│ ○ 🔒 Private - You choose who can see                          │
│                                                                 │
│ INITIALIZE                                                      │
│ ☑ Add README.md                                                │
│ ☑ Add .gitignore (Noodl template)                              │
│                                                                 │
│                              [Cancel]  [Create & Open Project]  │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Implementation

#### GitHub API Calls

```typescript
// Create repository for user
POST /user/repos
{
  "name": "my-awesome-app",
  "description": "A Noodl project for...",
  "private": true,
  "auto_init": true  // Creates README
}

// Create repository for organization
POST /orgs/{org}/repos
{
  "name": "my-awesome-app",
  "description": "A Noodl project for...",
  "private": true,
  "auto_init": true
}
```

#### Required OAuth Scopes

Ensure GIT-001 OAuth requests these scopes:
- `repo` - Full control of private repositories
- `read:org` - Read organization membership (for org dropdown)

#### Name Validation

```typescript
// Check if repo name is available
GET /repos/{owner}/{repo}
// 404 = available, 200 = taken

// Real-time validation as user types
const validateRepoName = async (owner: string, name: string): Promise<{
  available: boolean;
  suggestion?: string;  // If taken, suggest "name-2"
}> => {
  // Also validate:
  // - No spaces (replace with -)
  // - No special characters except - and _
  // - Max 100 characters
  // - Can't start with .
};
```

### Files to Create

```
packages/noodl-editor/src/editor/src/views/Launcher/
├── CreateRepoDialog/
│   ├── CreateRepoDialog.tsx
│   ├── CreateRepoDialog.module.scss
│   ├── OwnerSelector.tsx        # Dropdown with user + orgs
│   ├── RepoNameInput.tsx        # With availability check
│   └── VisibilitySelector.tsx
```

### Files to Modify

```
packages/noodl-editor/src/editor/src/views/Launcher/Launcher.tsx
  - Add "Create GitHub Repo" option to new project flow

packages/noodl-editor/src/editor/src/services/GitHubService.ts (from GIT-001)
  - Add createRepository() method
  - Add checkRepoNameAvailable() method
  - Add listUserOrganizations() method
```

### Implementation Tasks

1. **Owner Selection (1-2 hours)**
   - Fetch user's organizations from GitHub API
   - Create dropdown component with user + orgs
   - Handle orgs where user can't create repos

2. **Repository Creation (2-3 hours)**
   - Implement name validation (real-time availability check)
   - Create repository via API
   - Handle visibility selection
   - Initialize with README and .gitignore

3. **Project Integration (1 hour)**
   - After creation, clone repo locally
   - Initialize Noodl project in cloned directory
   - Open project in editor

### Success Criteria

- [ ] User can create repo in their personal account
- [ ] User can create repo in organizations they have access to
- [ ] Name availability checked in real-time
- [ ] Private/public selection works
- [ ] Repo initialized with README and .gitignore
- [ ] Project opens automatically after creation
- [ ] Proper error handling (permission denied, name taken, etc.)

---

## Updated GIT-003 Summary

| Sub-Feature | Est. Hours | Priority |
|-------------|------------|----------|
| Clone existing repo | 8-12 | Critical |
| **Create new repo** | 4-6 | High |
| Private repo auth handling | 2-3 | High |
| **Total** | **14-21** | - |
