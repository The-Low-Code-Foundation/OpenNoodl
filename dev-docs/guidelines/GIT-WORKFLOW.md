# Git Workflow Guide

How to manage branches, commits, and pull requests for OpenNoodl development.

## Branch Naming

### Format

```
type/id-short-description
```

### Types

| Type | Use For | Example |
|------|---------|---------|
| `task` | Task documentation work | `task/001-dependency-updates` |
| `feature` | New features | `feature/vercel-deployment` |
| `fix` | Bug fixes | `fix/page-router-scroll` |
| `refactor` | Code improvements | `refactor/property-panel-hooks` |
| `docs` | Documentation only | `docs/api-reference` |
| `test` | Test additions | `test/rest-node-coverage` |

### Examples

```bash
# Task branches (from dev-docs)
git checkout -b task/001-dependency-updates
git checkout -b task/002-typescript-cleanup

# Feature branches
git checkout -b feature/add-oauth-support
git checkout -b feature/multi-project-windows

# Fix branches
git checkout -b fix/nested-router-scroll
git checkout -b fix/array-change-tracking

# Refactor branches
git checkout -b refactor/remove-class-components
git checkout -b refactor/data-node-architecture
```

## Commit Messages

### Format

```
type(scope): short description

[optional longer description]

[optional footer with references]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring (no behavior change)
- `docs` - Documentation changes
- `test` - Test additions/changes
- `chore` - Build/tooling changes
- `style` - Formatting (no code change)
- `perf` - Performance improvement

### Scopes

Use the affected area:

- `editor` - Main editor code
- `runtime` - Runtime engine
- `viewer` - Viewer/preview
- `ui` - Core UI components
- `build` - Build system
- `deps` - Dependencies

### Examples

```bash
# Features
git commit -m "feat(editor): add connection breakpoints"
git commit -m "feat(runtime): implement retry logic for REST node"

# Fixes
git commit -m "fix(viewer): resolve scroll jumping in nested routers"
git commit -m "fix(editor): prevent crash when deleting connected node"

# Refactoring
git commit -m "refactor(ui): convert PropertyPanel to functional component"
git commit -m "refactor(runtime): simplify collection change tracking"

# Docs
git commit -m "docs(readme): update installation instructions"
git commit -m "docs(api): add JSDoc to public methods"

# Tests
git commit -m "test(runtime): add unit tests for REST node"
git commit -m "test(editor): add integration tests for import flow"

# Chores
git commit -m "chore(deps): update webpack to 5.101.3"
git commit -m "chore(build): enable source maps in development"
```

### Multi-line Commits

For complex changes:

```bash
git commit -m "feat(editor): add AI-powered node suggestions

- Integrate with OpenAI API for code analysis
- Add suggestion UI in node picker
- Cache suggestions for performance

Closes #123"
```

## Workflow

### Starting Work

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Create your branch
git checkout -b task/001-dependency-updates

# 3. Make your changes...

# 4. Stage and commit frequently
git add -A
git commit -m "feat(deps): update React to v19"
```

### During Development

```bash
# Check status often
git status

# View your changes
git diff

# Stage specific files
git add packages/noodl-editor/package.json

# Commit logical chunks
git commit -m "fix(deps): resolve peer dependency conflicts"

# Push to remote (first time)
git push -u origin task/001-dependency-updates

# Push subsequent commits
git push
```

### Keeping Up to Date

```bash
# If main has changed, rebase your work
git fetch origin
git rebase origin/main

# Resolve any conflicts, then continue
git add .
git rebase --continue

# Force push after rebase (your branch only!)
git push --force-with-lease
```

### Creating Pull Request

1. Push your branch to remote
2. Go to GitHub repository
3. Click "New Pull Request"
4. Select your branch
5. Fill in the template:

```markdown
## Summary
Brief description of changes

## Task Reference
TASK-001: Dependency Updates

## Changes Made
- Updated React to v19
- Fixed peer dependency conflicts
- Migrated to createRoot API

## Testing
- [ ] All existing tests pass
- [ ] Manual testing completed
- [ ] New tests added (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No console.log statements
```

### After PR Merged

```bash
# Switch to main
git checkout main

# Pull the merged changes
git pull origin main

# Delete your local branch
git branch -d task/001-dependency-updates

# Delete remote branch (if not auto-deleted)
git push origin --delete task/001-dependency-updates
```

## Common Scenarios

### Oops, Wrong Branch

```bash
# Stash your changes
git stash

# Switch to correct branch
git checkout correct-branch

# Apply your changes
git stash pop
```

### Need to Undo Last Commit

```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Undo commit and discard changes
git reset --hard HEAD~1
```

### Need to Update Commit Message

```bash
# Most recent commit
git commit --amend -m "new message"

# Older commit (interactive rebase)
git rebase -i HEAD~3
# Change 'pick' to 'reword' for the commit
```

### Accidentally Committed to Main

```bash
# Create a branch with your commits
git branch my-feature

# Reset main to origin
git reset --hard origin/main

# Switch to your feature branch
git checkout my-feature
```

### Merge Conflicts

```bash
# During rebase or merge, if conflicts occur:

# 1. Open conflicted files and resolve
# Look for <<<<<<< ======= >>>>>>> markers

# 2. Stage resolved files
git add resolved-file.ts

# 3. Continue the rebase/merge
git rebase --continue
# or
git merge --continue
```

## Branch Protection

CI runs via GitHub Actions — see `.github/workflows/pr.yml`. It triggers on every
pull request and on every push to `main` or `cline-dev`, and runs six jobs:

| Job | What it checks |
|-----|-----------------|
| `Typecheck` | `npm run typecheck` — 0 errors across all packages |
| `Lint` | `npm run lint:ci` — an error-count ratchet against `.eslint-baseline.json` (see `scripts/lint-ratchet.js`); it may fall, never rise |
| `Test (editor)` | `npm run test:ci` — the Electron/Jasmine suite, headless via `xvfb-run` |
| `Test (platform-node)` | `npm run test:platform` — the `@noodl/platform-node` Jest suite |
| `Build (viewer + editor bundles)` | `npm run ci:build:viewer` and `npm run ci:build:editor` — webpack only, not electron-builder packaging |
| `Check build artefacts` | `npm run check:artefacts` — fails if generated webpack output is committed (see REV-008) |

`main` is configured with these protections, requiring all six jobs above:

- Requires pull request before merging
- Requires the six `pr.yml` checks to pass
- Requires branches to be up to date before merging
- No force pushes allowed

`cline-dev` is the actual working branch (single developer, no per-task branches
or PR review round-trip — see `.clinerules` § Git Workflow) and is **not**
protected: work is pushed to it directly, and `pr.yml` runs on every push so a red
result is visible without blocking. If/when this repo has more than one active
contributor, route work back through PRs into `main` and let its protection do
the blocking; see the roadmap background in
`dev-docs/tasks/phase-12-reanimation/REV-003-CI-PIPELINE.md`.

A nightly workflow (`.github/workflows/nightly.yml`) builds unsigned packaged
installers for macOS/Windows/Linux and is not a merge gate — see the file for why.

## Keeping Progress Docs Current

Every `dev-docs/tasks/phase-N-*/PROGRESS.md` is a load-bearing document, not a
tidiness nicety: it's how the next contributor (human or AI) decides what to
build versus what already exists. REV-006 (2026-07-23) found several of these
had gone stale mid-sprint — reporting "0% / not started" for work that was
actually complete — because per-developer notes (`PROGRESS-<name>.md`) were kept
current during the sprint but the shared `PROGRESS.md` was not. An AI assistant
reading the stale file would have happily re-implemented a subsystem that
already existed and was tested.

To stop this recurring:

- **Update the shared `PROGRESS.md`, not just your own `PROGRESS-<name>.md`,
  whenever a task's status changes.** Personal notes are fine as scratch space,
  but they are not a substitute for the file everyone else reads first.
- **Use the status vocabulary** (see any phase's `PROGRESS.md` for the full
  legend): `Not started` / `In progress` / `Built–not wired` / `Complete` /
  `Superseded`. In particular, don't mark something `Complete` just because the
  code exists and is tested — check whether it has real call sites in the app
  outside of tests. Code that exists but isn't wired in is `Built–not wired`,
  and the entry should name the task expected to close that gap.
- **Cite evidence** — a commit hash or file path — for any status claim. "Done"
  without evidence is exactly what caused the last drift.
- **Do this as part of the task, not after it.** A task isn't finished until its
  phase's `PROGRESS.md` reflects that; treat the update as part of the task's
  definition of done, the same way tests and type-checking are.

## Tips

### Useful Aliases

Add to your `~/.gitconfig`:

```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    lg = log --oneline --graph --all
    unstage = reset HEAD --
    last = log -1 HEAD
    branches = branch -a
```

### Before Every PR

1. Run tests: `npm run test:editor`
2. Run type check: `npx tsc --noEmit`
3. Run linter: `npx eslint packages/ --fix`
4. Review your diff: `git diff main`
5. Check commit history: `git log --oneline main..HEAD`

### Good Commit Hygiene

- Commit early and often
- Each commit should be atomic (one logical change)
- Commits should compile and pass tests
- Write meaningful commit messages
- Don't commit generated files
- Don't commit debug code
