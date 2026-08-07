# WIZARD-001: Project Creation Wizard

## Overview

Create a guided project setup experience that transforms "blank canvas anxiety" into "ready to build in 60 seconds." The wizard integrates style presets, backend configuration, GitHub connection, deployment setup, and AI scaffolding into a streamlined flow.

**Phase:** 8 (Styles Overhaul) or standalone  
**Priority:** HIGH (major UX improvement)  
**Effort:** 20-28 hours  
**Risk:** Medium (integrates multiple systems)  
**Dependencies:** STYLE-003 (Presets), GIT-004A (GitHub OAuth), DEPLOY-001, AI-004

---

## Background

### Current State

Creating a new Noodl project:
1. Click "New Project"
2. Enter name
3. Get blank canvas
4. Manually configure everything: styling, backend, git, deployment...

### Target State

A Replit/Vercel-style wizard:
1. Choose how to start (Quick/Guided/AI)
2. Pick style preset (or describe your app)
3. Configure backend
4. Connect GitHub
5. Set up deployment
6. (Optional) AI generates scaffold
7. **Start building with everything ready**

---

## The Three Entry Modes

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATE NEW PROJECT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  How would you like to start?                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⚡ QUICK START                                         │   │
│  │  Blank project with Modern preset.                      │   │
│  │  Configure everything later.                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🛠️ GUIDED SETUP                                        │   │
│  │  Walk through style, backend, GitHub, and deployment    │   │
│  │  options step by step.                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✨ AI PROJECT BUILDER                                  │   │
│  │  Describe what you want to build. AI sets up            │   │
│  │  everything and generates starter components.           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Guided Setup Flow

### Step 1: Project Basics

```
┌─────────────────────────────────────────────────────────────────┐
│ NEW PROJECT                                          Step 1/6   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROJECT NAME                                                   │
│  [My Awesome App                    ]                          │
│                                                                 │
│  DESCRIPTION (optional)                                        │
│  [A task management tool for small teams    ]                  │
│                                                                 │
│  💡 Tip: A good description helps AI generate better           │
│     components if you enable AI scaffolding later.             │
│                                                                 │
│                                                                 │
│                                                                 │
│                                         [Next: Style Preset →] │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Style Preset

```
┌─────────────────────────────────────────────────────────────────┐
│ STYLE PRESET                                         Step 2/6   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Choose a visual style for your project:                       │
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Modern  │ │ Minimal │ │ Playful │ │ Corp    │ │  Soft   │  │
│  │         │ │         │ │         │ │         │ │         │  │
│  │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │  │
│  │ │ btn │ │ │ │ btn │ │ │ │ btn │ │ │ │ btn │ │ │ │ btn │ │  │
│  │ └─────┘ │ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │  │
│  │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │  │
│  │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │  │
│  └────●────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│    Selected                                                     │
│                                                                 │
│  "Clean and professional with subtle depth"                    │
│                                                                 │
│  [x] I'll customize colors and fonts later                     │
│                                                                 │
│  [← Back]                                   [Next: Backend →]  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Backend & Data

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND & DATA                                       Step 3/6   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Does your app need to store data?                             │
│                                                                 │
│  ○ NO BACKEND                                                  │
│    Frontend only - static content, no user data                │
│                                                                 │
│  ● LOCAL BACKEND (Recommended for starting)                    │
│    SQLite database that works offline.                         │
│    Zero configuration. Sync to cloud later.                    │
│    ✓ Free  ✓ No account needed  ✓ Works offline               │
│                                                                 │
│  ○ CLOUD BACKEND                                               │
│    Connect to an existing backend service:                     │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ [Supabase ▼]                                        │     │
│    │  • Supabase (Postgres + Auth + Realtime)           │     │
│    │  • Pocketbase (Self-hosted, simple)                │     │
│    │  • Firebase (Google ecosystem)                     │     │
│    │  • Directus (Headless CMS)                         │     │
│    │  • Custom REST API                                 │     │
│    │  • Custom GraphQL API                              │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  ○ DOCKER                                                      │
│    Spin up Postgres/MySQL in a local container.                │
│    For developers who want full database control.              │
│                                                                 │
│  [← Back]                             [Next: Authentication →] │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4: Authentication (Conditional)

Only shown if backend selected:

```
┌─────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION                                       Step 4/6   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Does your app need user login?                                │
│                                                                 │
│  ○ NO AUTHENTICATION                                           │
│    Public app - anyone can access everything                   │
│                                                                 │
│  ● EMAIL + PASSWORD                                            │
│    Traditional signup/login with email verification            │
│                                                                 │
│  ○ MAGIC LINK                                                  │
│    Passwordless - users click a link sent to email             │
│                                                                 │
│  ○ SOCIAL LOGIN                                                │
│    Sign in with Google, GitHub, etc.                           │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ [x] Google  [x] GitHub  [ ] Apple  [ ] Microsoft   │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  ○ I'LL CONFIGURE LATER                                        │
│    Skip for now, add authentication later                      │
│                                                                 │
│  [x] Generate login/signup UI components                       │
│                                                                 │
│  [← Back]                                  [Next: GitHub →]    │
└─────────────────────────────────────────────────────────────────┘
```

### Step 5: Version Control

```
┌─────────────────────────────────────────────────────────────────┐
│ VERSION CONTROL                                      Step 5/6   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Connect your project to GitHub for backup and collaboration.  │
│                                                                 │
│  ○ SKIP FOR NOW                                                │
│    I'll set up Git later                                       │
│                                                                 │
│  ● CONNECT TO GITHUB                                           │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐     │
│    │  [🔗 Sign in with GitHub]                           │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
│    ─────────── After signing in ───────────                    │
│                                                                 │
│    Repository:                                                 │
│    ● Create new repository                                     │
│      Name: [my-awesome-app        ]                            │
│      Visibility: [Private ▼]                                   │
│                                                                 │
│    ○ Use existing repository                                   │
│      ┌─────────────────────────────────────────────────────┐   │
│      │ my-org/existing-repo                                │   │
│      │ my-org/another-project                              │   │
│      │ personal/side-project                               │   │
│      └─────────────────────────────────────────────────────┘   │
│                                                                 │
│    ○ Paste repository URL                                      │
│      [https://github.com/...                     ]             │
│                                                                 │
│  [← Back]                               [Next: Deployment →]   │
└─────────────────────────────────────────────────────────────────┘
```

### Step 6: Deployment (Conditional)

Only shown if GitHub connected:

```
┌─────────────────────────────────────────────────────────────────┐
│ DEPLOYMENT                                           Step 6/6   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Set up automatic deployment when you push to GitHub.          │
│                                                                 │
│  ○ SKIP FOR NOW                                                │
│    I'll deploy manually or set this up later                   │
│                                                                 │
│  ● AUTO-DEPLOY ON PUSH                                         │
│                                                                 │
│    Platform:                                                    │
│    ● Vercel (Recommended for React)                            │
│      [🔗 Connect Vercel Account]                               │
│                                                                 │
│    ○ Netlify                                                   │
│      [🔗 Connect Netlify Account]                              │
│                                                                 │
│    ○ GitHub Pages (Static sites only)                          │
│      No account needed - uses GitHub Actions                   │
│                                                                 │
│    ○ Cloudflare Pages                                          │
│      [🔗 Connect Cloudflare Account]                           │
│                                                                 │
│    Options:                                                     │
│    [x] Create preview deployments for pull requests            │
│    [x] Show deployment status in Noodl dashboard               │
│                                                                 │
│  [← Back]                                   [Next: Review →]   │
└─────────────────────────────────────────────────────────────────┘
```

### Step 7: AI Setup (Optional)

```
┌─────────────────────────────────────────────────────────────────┐
│ AI ASSISTANT                                         Optional   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Let AI help you get started faster.                           │
│                                                                 │
│  ○ SKIP AI FEATURES                                            │
│    I'll build everything manually                              │
│                                                                 │
│  ● ENABLE AI ASSISTANT                                         │
│                                                                 │
│    API Key:                                                    │
│    [sk-ant-•••••••••••••••••••••••••••••] [Verify ✓]          │
│    Don't have one? [Get API key from Anthropic →]              │
│                                                                 │
│    What should AI generate?                                    │
│                                                                 │
│    [x] Starter components based on project description         │
│        AI will create basic UI structure and navigation        │
│                                                                 │
│    [x] Database schema (if backend selected)                   │
│        AI will suggest tables and fields based on your         │
│        project description                                     │
│                                                                 │
│    [ ] Sample data                                             │
│        Populate database with realistic test data              │
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ 💰 Estimated cost: ~$0.05 - $0.15 (one-time)        │     │
│    │    Based on project complexity                       │     │
│    │    [?] How is this calculated?                       │     │
│    └─────────────────────────────────────────────────────┘     │
│                                                                 │
│  [← Back]                                   [Next: Review →]   │
└─────────────────────────────────────────────────────────────────┘
```

### Final Step: Review & Create

```
┌─────────────────────────────────────────────────────────────────┐
│ REVIEW & CREATE                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Project: "My Awesome App"                                     │
│  A task management tool for small teams                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CONFIGURATION SUMMARY                                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Style:       Modern preset (blue theme)          [Edit] │   │
│  │ Backend:     Local SQLite                        [Edit] │   │
│  │ Auth:        Email + Password                    [Edit] │   │
│  │ GitHub:      my-org/my-awesome-app (new)        [Edit] │   │
│  │ Deployment:  Vercel (auto-deploy)               [Edit] │   │
│  │ AI:          Generate components + schema        [Edit] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ COST ESTIMATE                                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Monthly:                                                │   │
│  │ • Style system ─────────────────────── Free             │   │
│  │ • Local SQLite ─────────────────────── Free             │   │
│  │ • GitHub (private repo) ────────────── Free             │   │
│  │ • Vercel (hobby tier) ──────────────── Free             │   │
│  │                                        ─────────        │   │
│  │                              Total:    $0/month         │   │
│  │                                                         │   │
│  │ One-time:                                               │   │
│  │ • AI scaffold generation ───────────── ~$0.08           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [ ] Remember these settings for future projects               │
│                                                                 │
│  [← Back]                              [Create Project →]      │
└─────────────────────────────────────────────────────────────────┘
```

### Creation Progress

```
┌─────────────────────────────────────────────────────────────────┐
│ CREATING "MY AWESOME APP"                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Creating project structure                                  │
│  ✓ Applying Modern style preset                                │
│  ✓ Setting up SQLite database                                  │
│  ✓ Configuring authentication                                  │
│  ● Generating components with AI...                            │
│    ├─ Analyzing project description                            │
│    ├─ Creating navigation structure                            │
│    └─ Building task management components                      │
│  ○ Generating database schema                                  │
│  ○ Creating GitHub repository                                  │
│  ○ Configuring Vercel deployment                               │
│  ○ Initial commit and push                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AI is generating: TaskList component                    │   │
│  │ ████████████████████░░░░░░░░░░░░░░░░░░░░  45%           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [View Details]                              [Cancel]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## AI Project Builder Mode

When user selects "AI Project Builder":

```
┌─────────────────────────────────────────────────────────────────┐
│ AI PROJECT BUILDER                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Describe what you want to build:                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ A project management app where teams can create         │   │
│  │ projects, add tasks with due dates and priorities,      │   │
│  │ assign tasks to team members, and track progress        │   │
│  │ with a kanban board view. Users should be able to       │   │
│  │ comment on tasks and get notifications.                 │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Examples:                                                      │
│  • "A recipe app where users can save and organize recipes"   │
│  • "An invoice generator for freelancers"                      │
│  • "A booking system for a hair salon"                         │
│                                                                 │
│  API Key: [sk-ant-•••••••••••••] [Verify ✓]                   │
│                                                                 │
│                                         [Analyze & Suggest →] │
└─────────────────────────────────────────────────────────────────┘
```

After analysis:

```
┌─────────────────────────────────────────────────────────────────┐
│ AI SUGGESTIONS                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Based on your description, here's what I recommend:           │
│                                                                 │
│  PROJECT TYPE: Web Application (Dashboard)                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STYLE                                                   │   │
│  │ Recommended: Modern                                     │   │
│  │ A clean, professional look suits project management     │   │
│  │ [Change ▼]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ BACKEND                                                 │   │
│  │ Recommended: Local SQLite → Supabase                    │   │
│  │ Start local, sync to cloud when ready for team use      │   │
│  │ [Change ▼]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AUTHENTICATION                                          │   │
│  │ Recommended: Email + Password                           │   │
│  │ Team members need accounts to be assigned tasks         │   │
│  │ [Change ▼]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SUGGESTED DATABASE SCHEMA                               │   │
│  │                                                         │   │
│  │ 📁 users (id, email, name, avatar, role)               │   │
│  │ 📁 projects (id, name, description, owner_id)          │   │
│  │ 📁 tasks (id, title, status, priority, assignee_id...) │   │
│  │ 📁 comments (id, task_id, author_id, content)          │   │
│  │ 📁 notifications (id, user_id, type, read, data)       │   │
│  │                                                         │   │
│  │ [View Full Schema]  [Edit Schema]                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ COMPONENTS TO GENERATE                                  │   │
│  │                                                         │   │
│  │ [x] Dashboard layout with sidebar navigation            │   │
│  │ [x] Project list and project detail views               │   │
│  │ [x] Task list with filtering and sorting                │   │
│  │ [x] Kanban board view                                   │   │
│  │ [x] Task detail with comments                           │   │
│  │ [x] User profile and settings                           │   │
│  │ [x] Login/Signup pages                                  │   │
│  │ [ ] Notification center                                 │   │
│  │ [ ] Team management                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Estimated AI cost: ~$0.12                                     │
│                                                                 │
│  [← Back]           [Customize More]    [Create Project →]    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Phase 1: Wizard Framework (6-8 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/views/
├── ProjectWizard/
│   ├── ProjectWizard.tsx            # Main wizard container
│   ├── ProjectWizard.module.scss
│   ├── WizardContext.tsx            # Shared state
│   ├── WizardNavigation.tsx         # Step indicators
│   ├── steps/
│   │   ├── EntryModeStep.tsx        # Quick/Guided/AI selection
│   │   ├── ProjectBasicsStep.tsx    # Name, description
│   │   ├── StylePresetStep.tsx      # Preset selection
│   │   ├── BackendStep.tsx          # Backend configuration
│   │   ├── AuthenticationStep.tsx   # Auth options
│   │   ├── GitHubStep.tsx           # Version control
│   │   ├── DeploymentStep.tsx       # Deployment setup
│   │   ├── AISetupStep.tsx          # AI configuration
│   │   ├── ReviewStep.tsx           # Summary & create
│   │   └── CreationProgressStep.tsx # Progress display
│   └── index.ts
```

**Wizard State:**

```typescript
interface WizardState {
  // Basics
  projectName: string;
  description: string;
  
  // Style
  stylePreset: string;
  
  // Backend
  backendType: 'none' | 'local' | 'cloud' | 'docker';
  cloudProvider?: 'supabase' | 'pocketbase' | 'firebase' | 'directus' | 'custom';
  cloudConfig?: Record<string, string>;
  
  // Auth
  authType: 'none' | 'email' | 'magic-link' | 'social' | 'later';
  socialProviders?: string[];
  generateAuthUI: boolean;
  
  // GitHub
  gitHubEnabled: boolean;
  gitHubRepo?: {
    type: 'new' | 'existing' | 'url';
    name?: string;
    visibility?: 'public' | 'private';
    url?: string;
  };
  
  // Deployment
  deploymentEnabled: boolean;
  deploymentPlatform?: 'vercel' | 'netlify' | 'github-pages' | 'cloudflare';
  previewDeployments: boolean;
  
  // AI
  aiEnabled: boolean;
  aiApiKey?: string;
  aiGenerateComponents: boolean;
  aiGenerateSchema: boolean;
  aiGenerateSampleData: boolean;
}

interface WizardContextValue {
  state: WizardState;
  updateState: (partial: Partial<WizardState>) => void;
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canProceed: boolean;
  createProject: () => Promise<void>;
}
```

### Phase 2: Integration Hooks (6-8 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/views/ProjectWizard/
├── hooks/
│   ├── useStylePresets.ts       # Preset loading and preview
│   ├── useGitHubSetup.ts        # GitHub OAuth and repo management
│   ├── useDeploymentSetup.ts    # Vercel/Netlify integration
│   ├── useAIScaffold.ts         # AI generation orchestration
│   └── useProjectCreation.ts    # Final project creation
```

**Integration Points:**

```typescript
// useGitHubSetup.ts
function useGitHubSetup() {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  
  const authenticate = async () => {
    // Uses GIT-004A OAuth flow
    const token = await GitHubOAuth.authenticate();
    setAuthenticated(true);
    const userRepos = await GitHubClient.listRepos(token);
    setRepos(userRepos);
  };
  
  const createRepo = async (name: string, visibility: 'public' | 'private') => {
    // Uses GIT-004A repo creation
    return await GitHubClient.createRepo({ name, private: visibility === 'private' });
  };
  
  return { isAuthenticated, repos, authenticate, createRepo };
}
```

### Phase 3: AI Builder Mode (4-6 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/views/ProjectWizard/
├── ai/
│   ├── AIProjectAnalyzer.ts     # Analyze description
│   ├── AISchemaGenerator.ts     # Generate database schema
│   ├── AIComponentGenerator.ts  # Generate components
│   ├── AIPrompts.ts             # Prompt templates
│   └── types.ts
```

**AI Analysis Flow:**

```typescript
interface AIProjectAnalysis {
  projectType: 'webapp' | 'ecommerce' | 'content' | 'custom';
  suggestedPreset: string;
  suggestedBackend: BackendConfig;
  suggestedAuth: AuthConfig;
  schema: DatabaseSchema;
  components: ComponentSuggestion[];
  estimatedCost: number;
}

async function analyzeProject(description: string): Promise<AIProjectAnalysis> {
  const prompt = buildAnalysisPrompt(description);
  const response = await anthropic.complete(prompt);
  return parseAnalysisResponse(response);
}
```

### Phase 4: Creation Orchestration (4-6 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/views/ProjectWizard/
├── creation/
│   ├── ProjectCreator.ts        # Main orchestrator
│   ├── steps/
│   │   ├── CreateProjectStructure.ts
│   │   ├── ApplyStylePreset.ts
│   │   ├── SetupBackend.ts
│   │   ├── SetupAuthentication.ts
│   │   ├── GenerateAIComponents.ts
│   │   ├── GenerateAISchema.ts
│   │   ├── CreateGitHubRepo.ts
│   │   ├── ConfigureDeployment.ts
│   │   └── InitialCommit.ts
│   └── types.ts
```

**Creation Pipeline:**

```typescript
class ProjectCreator {
  private steps: CreationStep[] = [];
  private progress: CreationProgress;
  
  constructor(config: WizardState) {
    // Build step list based on config
    this.steps.push(new CreateProjectStructure(config));
    this.steps.push(new ApplyStylePreset(config.stylePreset));
    
    if (config.backendType !== 'none') {
      this.steps.push(new SetupBackend(config));
    }
    
    if (config.authType !== 'none') {
      this.steps.push(new SetupAuthentication(config));
    }
    
    if (config.aiEnabled && config.aiGenerateSchema) {
      this.steps.push(new GenerateAISchema(config));
    }
    
    if (config.aiEnabled && config.aiGenerateComponents) {
      this.steps.push(new GenerateAIComponents(config));
    }
    
    if (config.gitHubEnabled) {
      this.steps.push(new CreateGitHubRepo(config.gitHubRepo!));
      
      if (config.deploymentEnabled) {
        this.steps.push(new ConfigureDeployment(config));
      }
      
      this.steps.push(new InitialCommit());
    }
  }
  
  async execute(onProgress: (progress: CreationProgress) => void): Promise<Project> {
    for (const step of this.steps) {
      this.progress = { 
        currentStep: step.name, 
        completed: this.steps.indexOf(step),
        total: this.steps.length 
      };
      onProgress(this.progress);
      
      await step.execute();
    }
    
    return this.project;
  }
}
```

---

## Dependencies

### Required Before WIZARD-001:

| Dependency | Task | Status | Notes |
|------------|------|--------|-------|
| Style Presets | STYLE-003 | Required | Preset selector integration |
| GitHub OAuth | GIT-004A | Required | GitHub connection step |
| Deployment | DEPLOY-001 | Optional | Can be added later |
| AI Scaffold | AI-004 | Optional | Can be added later |
| Local Backend | BACKEND-001 | Optional | Can default to "none" |

### Can Work Incrementally:

The wizard can ship with partial functionality:

**V1 (Minimum):**
- Entry mode selection
- Project basics
- Style preset
- Review & create

**V2 (Add Backend):**
- Backend step
- Authentication step

**V3 (Add Git):**
- GitHub step
- Deployment step

**V4 (Add AI):**
- AI builder mode
- AI setup step

---

## Testing Strategy

### Unit Tests

- Wizard state management
- Step validation logic
- Creation pipeline ordering
- AI prompt generation

### Integration Tests

- Full wizard flow completion
- GitHub OAuth integration
- Deployment configuration
- Project creation with all options

### Manual Testing Checklist

- [ ] Quick Start creates project with Modern preset
- [ ] Guided flow navigates all steps correctly
- [ ] Style presets show visual previews
- [ ] Backend options configure correctly
- [ ] GitHub OAuth connects successfully
- [ ] Repository creation works
- [ ] Deployment configuration applies
- [ ] AI analysis generates reasonable suggestions
- [ ] AI schema generation works
- [ ] Progress display updates correctly
- [ ] Created project has all configured features

---

## Success Criteria

- [ ] Three entry modes work (Quick/Guided/AI)
- [ ] All guided steps functional
- [ ] Style preset applies correctly
- [ ] Backend configuration works
- [ ] GitHub integration functional
- [ ] Deployment setup works
- [ ] AI builder generates reasonable scaffolds
- [ ] Progress display accurate
- [ ] Created projects fully configured
- [ ] User can skip any optional step

---

## Future Enhancements

### Templates Library

Pre-built project templates:

```
┌─────────────────────────────────────────────────────────────────┐
│ START FROM TEMPLATE                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│ │ Dashboard │ │ E-commerce│ │   Blog    │ │  Landing  │       │
│ │           │ │           │ │           │ │   Page    │       │
│ │  📊       │ │  🛒       │ │  📝       │ │  🚀       │       │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                 │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│ │  Booking  │ │  Social   │ │  CRM      │ │  Custom   │       │
│ │  System   │ │   App     │ │           │ │           │       │
│ │  📅       │ │  👥       │ │  📇       │ │  ⚡       │       │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Settings Presets

Remember wizard settings:

```typescript
interface WizardPreset {
  name: string;
  settings: Partial<WizardState>;
}

// "My Standard Setup"
const preset: WizardPreset = {
  name: "My Standard Setup",
  settings: {
    stylePreset: 'modern',
    backendType: 'local',
    authType: 'email',
    gitHubEnabled: true,
    deploymentPlatform: 'vercel'
  }
};
```

### Team Templates

Shared templates within organizations:

- Admin creates standard project setup
- Team members start new projects from org template
- Ensures consistency across team projects

---

*Last Updated: January 2026*
