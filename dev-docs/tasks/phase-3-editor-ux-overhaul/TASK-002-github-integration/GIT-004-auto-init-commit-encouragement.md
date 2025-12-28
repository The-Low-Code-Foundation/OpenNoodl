# GIT-004: Auto-Initialization & Commit Encouragement

## Overview

Make version control a default part of the Noodl workflow by automatically initializing git for new projects and gently encouraging regular commits. This helps users avoid losing work and prepares them for collaboration.

## Context

Currently:
- New projects are not git-initialized by default
- Users must manually open Version Control panel and initialize
- There's no prompting to commit changes
- Closing a project with uncommitted changes has no warning

Many Noodl users are designers or low-code developers who may not be familiar with git. By making version control automatic and unobtrusive, we help them develop good habits without requiring git expertise.

### Existing Infrastructure

From `LocalProjectsModel.ts`:
```typescript
async isGitProject(project: ProjectModel): Promise<boolean> {
  const gitPath = await getTopLevelWorkingDirectory(project._retainedProjectDirectory);
  return gitPath !== null;
}
```

From `git.ts`:
```typescript
async initNewRepo(baseDir: string, options?: { bare: boolean }): Promise<void> {
  if (this.baseDir) return;
  this.baseDir = await init(baseDir, options);
  await this._setupRepository();
}
```

## Requirements

### Functional Requirements

1. **Auto-Initialization**
   - New projects are git-initialized by default
   - Initial commit with project creation
   - Option to disable in settings
   - Existing non-git projects can be initialized easily

2. **Commit Encouragement**
   - Periodic reminder when changes are uncommitted
   - Reminder appears as subtle notification, not modal
   - "Commit now" quick action
   - "Remind me later" option
   - Configurable reminder interval

3. **Quick Commit**
   - One-click commit from notification
   - Simple commit message input
   - Default message suggestion
   - Option to open full Version Control panel

4. **Close Warning**
   - Warning when closing project with uncommitted changes
   - Show number of uncommitted files
   - Options: "Commit & Close", "Close Anyway", "Cancel"
   - Can be disabled in settings

5. **Settings**
   - Enable/disable auto-initialization
   - Enable/disable commit reminders
   - Reminder interval (15min, 30min, 1hr, 2hr)
   - Enable/disable close warning

### Non-Functional Requirements

- Reminders are non-intrusive
- Quick commit is fast (<2 seconds)
- Auto-init doesn't slow project creation
- Works offline

## Technical Approach

### 1. Auto-Initialization in Project Creation

```typescript
// packages/noodl-editor/src/editor/src/models/projectmodel.ts

async createNewProject(name: string, template?: string): Promise<ProjectModel> {
  const project = await this._createProject(name, template);
  
  // Auto-initialize git if enabled
  if (EditorSettings.instance.get('git.autoInitialize') !== false) {
    try {
      const git = new Git(mergeProject);
      await git.initNewRepo(project._retainedProjectDirectory);
      await git.commit('Initial commit');
    } catch (error) {
      console.warn('Failed to auto-initialize git:', error);
      // Don't fail project creation if git init fails
    }
  }
  
  return project;
}
```

### 2. Commit Reminder Service

```typescript
// packages/noodl-editor/src/editor/src/services/CommitReminderService.ts

class CommitReminderService {
  private static instance: CommitReminderService;
  private reminderTimer: NodeJS.Timer | null = null;
  private lastRemindedAt: number = 0;
  
  // Start monitoring for uncommitted changes
  start(): void;
  stop(): void;
  
  // Check if reminder should show
  shouldShowReminder(): Promise<boolean>;
  
  // Show/dismiss reminder
  showReminder(): void;
  dismissReminder(snoozeMinutes?: number): void;
  
  // Events
  onReminderTriggered(callback: () => void): () => void;
}
```

### 3. Quick Commit Component

```typescript
// packages/noodl-core-ui/src/components/git/QuickCommitPopup/QuickCommitPopup.tsx

interface QuickCommitPopupProps {
  uncommittedCount: number;
  suggestedMessage: string;
  onCommit: (message: string) => Promise<void>;
  onDismiss: () => void;
  onOpenFullPanel: () => void;
}
```

### 4. Close Warning Dialog

```typescript
// packages/noodl-core-ui/src/components/git/UnsavedChangesDialog/UnsavedChangesDialog.tsx

interface UnsavedChangesDialogProps {
  uncommittedCount: number;
  onCommitAndClose: () => Promise<void>;
  onCloseAnyway: () => void;
  onCancel: () => void;
}
```

### 5. Default Commit Messages

```typescript
// Smart default commit message generation
function generateDefaultCommitMessage(changes: GitStatus[]): string {
  const added = changes.filter(c => c.status === 'added');
  const modified = changes.filter(c => c.status === 'modified');
  const deleted = changes.filter(c => c.status === 'deleted');
  
  const parts: string[] = [];
  
  if (added.length > 0) {
    if (added.length === 1) {
      parts.push(`Add ${getComponentName(added[0].path)}`);
    } else {
      parts.push(`Add ${added.length} files`);
    }
  }
  
  if (modified.length > 0) {
    if (modified.length === 1) {
      parts.push(`Update ${getComponentName(modified[0].path)}`);
    } else {
      parts.push(`Update ${modified.length} files`);
    }
  }
  
  if (deleted.length > 0) {
    parts.push(`Remove ${deleted.length} files`);
  }
  
  return parts.join(', ') || 'Update project';
}
```

## UI Mockups

### Commit Reminder Notification

```
┌─────────────────────────────────────────────────────────────┐
│ 💾 You have 5 uncommitted changes                           │
│                                                             │
│ It's been 30 minutes since your last commit.                │
│                                                             │
│ [Commit Now]  [Remind Me Later ▾]  [Dismiss]               │
└─────────────────────────────────────────────────────────────┘
```

### Quick Commit Popup

```
┌─────────────────────────────────────────────────────────────┐
│ Quick Commit                                           [×]  │
├─────────────────────────────────────────────────────────────┤
│ 5 files changed                                             │
│                                                             │
│ Message:                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Update LoginPage and add UserProfile component          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Open Version Control]                    [Cancel] [Commit] │
└─────────────────────────────────────────────────────────────┘
```

### Close Warning Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Uncommitted Changes                                 [×]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ You have 5 uncommitted changes in this project.             │
│                                                             │
│ These changes will be preserved locally but not versioned.  │
│ To keep a history of your work, commit before closing.      │
│                                                             │
│ ☐ Don't show this again                                    │
│                                                             │
│       [Cancel]  [Close Anyway]  [Commit & Close]           │
└─────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/CommitReminderService.ts`
2. `packages/noodl-core-ui/src/components/git/QuickCommitPopup/QuickCommitPopup.tsx`
3. `packages/noodl-core-ui/src/components/git/QuickCommitPopup/QuickCommitPopup.module.scss`
4. `packages/noodl-core-ui/src/components/git/UnsavedChangesDialog/UnsavedChangesDialog.tsx`
5. `packages/noodl-core-ui/src/components/git/CommitReminderToast/CommitReminderToast.tsx`
6. `packages/noodl-editor/src/editor/src/utils/git/defaultCommitMessage.ts`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
   - Add auto-initialization in project creation

2. `packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx`
   - Add close warning handler
   - Integrate CommitReminderService

3. `packages/noodl-utils/editorsettings.ts`
   - Add git-related settings

4. `packages/noodl-editor/src/editor/src/views/panels/EditorSettingsPanel/`
   - Add git settings section

5. `packages/noodl-editor/src/main/main.js`
   - Handle close event for warning

## Settings Schema

```typescript
interface GitSettings {
  // Auto-initialization
  'git.autoInitialize': boolean;  // default: true
  
  // Commit reminders
  'git.commitReminders.enabled': boolean;  // default: true
  'git.commitReminders.intervalMinutes': number;  // default: 30
  
  // Close warning
  'git.closeWarning.enabled': boolean;  // default: true
  
  // Quick commit
  'git.quickCommit.suggestMessage': boolean;  // default: true
}
```

## Implementation Steps

### Phase 1: Auto-Initialization
1. Add git.autoInitialize setting
2. Modify project creation to init git
3. Add initial commit
4. Test with new projects

### Phase 2: Settings UI
1. Add Git section to Editor Settings panel
2. Implement all settings toggles
3. Store settings in EditorSettings

### Phase 3: Commit Reminder Service
1. Create CommitReminderService
2. Add timer-based reminder check
3. Create CommitReminderToast component
4. Integrate with editor lifecycle

### Phase 4: Quick Commit
1. Create QuickCommitPopup component
2. Implement default message generation
3. Wire up commit action
4. Add "Open full panel" option

### Phase 5: Close Warning
1. Create UnsavedChangesDialog
2. Hook into project close event
3. Implement "Commit & Close" flow
4. Add "Don't show again" option

### Phase 6: Polish
1. Snooze functionality
2. Notification stacking
3. Animation/transitions
4. Edge case handling

## Testing Checklist

- [ ] New project is git-initialized by default
- [ ] Initial commit is created
- [ ] Auto-init can be disabled
- [ ] Commit reminder appears after interval
- [ ] Reminder shows correct uncommitted count
- [ ] "Commit Now" opens quick commit popup
- [ ] "Remind Me Later" snoozes correctly
- [ ] Quick commit works with default message
- [ ] Quick commit works with custom message
- [ ] Close warning appears with uncommitted changes
- [ ] "Commit & Close" works
- [ ] "Close Anyway" works
- [ ] "Don't show again" persists
- [ ] Settings toggle all features correctly
- [ ] Works when offline

## Edge Cases

1. **Project already has git**: Don't re-initialize, just work with existing
2. **Template with git**: Use template's git if present, else init fresh
3. **Init fails**: Log warning, don't block project creation
4. **Commit fails**: Show error, offer to open Version Control panel
5. **Large commit**: Show progress, don't block UI
6. **No changes on reminder check**: Don't show reminder

## Dependencies

- GIT-002 (Git Status Dashboard) - for status detection infrastructure

## Blocked By

- GIT-002 (shares status checking code)

## Blocks

- None

## Estimated Effort

- Auto-initialization: 2-3 hours
- Settings UI: 2-3 hours
- Commit reminder service: 3-4 hours
- Quick commit popup: 2-3 hours
- Close warning: 2-3 hours
- Polish: 2-3 hours
- **Total: 13-19 hours**

## Success Criteria

1. New projects have git by default
2. Users are gently reminded to commit
3. Committing is easy and fast
4. Users are warned before losing work
5. All features can be disabled
6. Non-intrusive to workflow

## Future Enhancements

- Commit streak/gamification
- Auto-commit on significant changes
- Commit templates
- Branch suggestions
- Integration with cloud backup
