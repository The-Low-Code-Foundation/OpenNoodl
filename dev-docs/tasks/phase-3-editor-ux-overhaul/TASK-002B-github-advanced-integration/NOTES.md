# GIT-004: Working Notes

## Quick Links

- [GitHub REST API Docs](https://docs.github.com/en/rest)
- [Octokit.js](https://github.com/octokit/octokit.js)
- [GitHub OAuth App Guide](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub App Permissions](https://docs.github.com/en/rest/overview/permissions-required-for-github-apps)

---

## Research Notes

### GitHub App vs OAuth App

**GitHub App (Recommended)**:
- More granular permissions
- Installation-based access (per-repo or org-wide)
- Higher rate limits (5000 vs 5000, but per installation)
- Better for org-wide deployment
- Supports webhook subscriptions

**OAuth App**:
- Simpler to implement
- User-based access
- Good for personal use
- Lower setup complexity

**Decision**: Start with OAuth App for simplicity, can upgrade to GitHub App later for enterprise features.

### Existing Code Patterns

```typescript
// Current PAT storage pattern (GitStore)
// packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
// components/GitProviderPopout/GitProviderPopout.tsx

await GitStore.set(provider, ProjectModel.instance.id, {
  username,
  password // This is actually the PAT
});
```

```typescript
// Current Git provider detection
// packages/noodl-git/src/git.ts

public getProviderForRemote(remoteUrl: string): GitProvider {
  if (!remoteUrl) return 'none';
  else if (remoteUrl.includes('noodlapp.com')) return 'noodl';
  else if (remoteUrl.includes('github.com')) return 'github';
  else return 'unknown';
}
```

### Rate Limiting Strategy

GitHub API limits:
- Unauthenticated: 60 requests/hour
- Authenticated (PAT/OAuth): 5000 requests/hour
- GitHub App: 5000 requests/hour per installation

**Caching strategy**:
```typescript
interface CacheEntry<T> {
  data: T;
  etag: string;
  timestamp: number;
}

// Use ETags for conditional requests
const headers = { 'If-None-Match': cachedEtag };
// 304 Not Modified = use cache, doesn't count against rate limit
```

---

## Implementation Notes

### OAuth Flow in Electron

```typescript
// Rough implementation sketch
async function startOAuthFlow() {
  const state = crypto.randomUUID();
  const authUrl = `https://github.com/login/oauth/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `scope=repo,read:user&` +
    `state=${state}`;
  
  // Open in external browser or BrowserWindow
  shell.openExternal(authUrl);
  
  // Listen for callback via deep link or local server
  // Exchange code for token
}
```

### Component Metadata Schema

```typescript
// Proposed schema for project.json
interface ComponentGitHubMetadata {
  linkedIssues: Array<{
    number: number;
    linkType: 'mentions' | 'implements' | 'fixes';
    linkedAt: string; // ISO date
    linkedBy?: string; // GitHub username
  }>;
  linkedPRs: Array<{
    number: number;
    linkedAt: string;
  }>;
}

// In component definition
{
  "name": "UserLoginForm",
  "graph": { ... },
  "github": {
    "linkedIssues": [
      { "number": 42, "linkType": "implements", "linkedAt": "2025-01-15T..." }
    ]
  }
}
```

### Visual Indicator Ideas

```
Component with issues:
┌──────────────────┐
│ 🔴 UserLoginForm │  ← Red badge = has open issues
└──────────────────┘

Component with resolved:
┌──────────────────┐
│ ✅ PaymentForm   │  ← Green check = all issues closed
└──────────────────┘

Badge shows count:
┌──────────────────┐
│ 3️⃣ DataTable    │  ← Number = issue count
└──────────────────┘
```

---

## Questions to Resolve

- [ ] Should we support multiple GitHub accounts?
- [ ] How to handle private vs public repos differently?
- [ ] Should component links sync back to GitHub as comments?
- [ ] How to handle issue links when component is renamed?
- [ ] Should we support GitHub Enterprise Server?

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-XX-XX | Use OAuth App initially | Simpler, can upgrade later |
| 2024-XX-XX | Store links in project.json | Keeps with existing patterns |
| - | - | - |

---

## Session Notes

### Session 1: [Date TBD]

_Notes from implementation session_

---

### Session 2: [Date TBD]

_Notes from implementation session_

---

## Useful Code Snippets

### Octokit Basic Usage

```typescript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: token });

// List issues
const { data: issues } = await octokit.issues.listForRepo({
  owner: 'The-Low-Code-Foundation',
  repo: 'OpenNoodl',
  state: 'open',
  per_page: 30
});

// Create issue
const { data: newIssue } = await octokit.issues.create({
  owner,
  repo,
  title: 'Bug in UserLoginForm',
  body: 'Description...',
  labels: ['bug']
});
```

### React-Markdown Setup

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function IssueBody({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom renderers for GitHub-specific elements
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener">
            {children}
          </a>
        )
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
```

---

## Testing Repos

- Use `The-Low-Code-Foundation/OpenNoodl` for real testing
- Create a test repo with known issue/PR states
- Test with repo that has 100+ issues for pagination

---

## References from Codebase

Files to study:
- `packages/noodl-git/src/git.ts` - Git operations patterns
- `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/` - UI patterns
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts` - Metadata storage
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/` - Context menus
