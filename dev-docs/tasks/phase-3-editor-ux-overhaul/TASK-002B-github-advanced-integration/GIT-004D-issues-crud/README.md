# GIT-004D: Create & Update Issues

## Overview

Enable full CRUD operations for GitHub issues from within Nodegex. Users can create new issues, edit existing ones, add comments, and change issue status—all without leaving the editor. This task also introduces the Quick Bug Report feature that will integrate with component linking in GIT-004E.

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** HIGH (productivity multiplier)  
**Effort:** 12-16 hours  
**Risk:** Medium (write operations, error handling critical)

**Depends on:** GIT-004B (Issues Panel)

---

## Goals

1. **Create Issue** dialog with full options
2. **Edit Issue** capability (title, body, labels, assignees)
3. **Add Comments** to issues
4. **Change Status** (open/close issues)
5. **Issue Templates** support
6. **Quick Bug Report** for fast issue creation

---

## User Experience

### Create Issue Dialog

```
┌─────────────────────────────────────────────────────────┐
│ Create Issue                                       [X]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Template: [Bug Report ▼]                                │
│                                                         │
│ Title *                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Login form validation not showing error             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Description                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ## Bug Description                                  │ │
│ │ When entering an invalid email...                   │ │
│ │                                                     │ │
│ │ ## Steps to Reproduce                               │ │
│ │ 1. Go to login page                                 │ │
│ │ 2. Enter invalid email                              │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Write] [Preview]                                       │
│                                                         │
│ Labels                                                  │
│ [🐛 bug] [🔥 priority-high] [+ Add]                    │
│                                                         │
│ Assignees                                               │
│ [@johndoe] [+ Add]                                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                          [Cancel]  [Create Issue]       │
└─────────────────────────────────────────────────────────┘
```

### Quick Bug Report (Streamlined)

```
┌─────────────────────────────────────────────────────────┐
│ 🐛 Quick Bug Report                               [X]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ What's wrong? *                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ The submit button doesn't work                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ☑️ Include component info (UserLoginForm)               │
│ ☐ Include screenshot                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                               [Cancel]  [Report Bug]    │
└─────────────────────────────────────────────────────────┘
```

### Add Comment

```
┌─────────────────────────────────────────────────────────┐
│ Issue #42 - Login form validation broken                │
├─────────────────────────────────────────────────────────┤
│ ... issue content ...                                   │
├─────────────────────────────────────────────────────────┤
│ 💬 Comments (3)                                         │
├─────────────────────────────────────────────────────────┤
│ ... existing comments ...                               │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Add a comment...                                    │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│ [Write] [Preview]                    [Comment]          │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture

### Component Structure

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── IssuesTab/
│       ├── CreateIssueDialog.tsx      # Full issue creation
│       ├── CreateIssueDialog.module.scss
│       ├── EditIssueDialog.tsx        # Edit existing issue
│       ├── QuickBugReport.tsx         # Streamlined bug report
│       ├── AddCommentForm.tsx         # Comment input
│       ├── MarkdownEditor.tsx         # Markdown input with preview
│       ├── LabelSelector.tsx          # Multi-select labels
│       ├── AssigneeSelector.tsx       # Multi-select assignees
│       └── TemplateSelector.tsx       # Issue template picker
├── hooks/
│   ├── useCreateIssue.ts
│   ├── useUpdateIssue.ts
│   ├── useAddComment.ts
│   ├── useIssueTemplates.ts
│   └── useRepoLabels.ts
```

---

## Implementation Phases

### Phase 1: Create Issue Dialog (4-5 hours)

**Files to Create:**
- `CreateIssueDialog.tsx`
- `CreateIssueDialog.module.scss`
- `MarkdownEditor.tsx`
- `LabelSelector.tsx`
- `AssigneeSelector.tsx`
- `hooks/useCreateIssue.ts`

**Tasks:**
1. Create dialog component with form
2. Implement markdown editor with preview toggle
3. Create label selector (fetch repo labels)
4. Create assignee selector (fetch repo contributors)
5. Implement create issue API call
6. Handle loading/error states
7. Add success feedback

**Success Criteria:**
- [ ] Dialog opens from panel header "+"
- [ ] All fields work correctly
- [ ] Markdown preview works
- [ ] Issue created on GitHub
- [ ] New issue appears in list

---

### Phase 2: Issue Templates (2-3 hours)

**Files to Create:**
- `TemplateSelector.tsx`
- `hooks/useIssueTemplates.ts`

**Tasks:**
1. Fetch templates from `.github/ISSUE_TEMPLATE/`
2. Create template selector dropdown
3. Pre-fill form from selected template
4. Handle repos without templates

**Success Criteria:**
- [ ] Templates load if available
- [ ] Selecting template fills form
- [ ] Works without templates

---

### Phase 3: Edit & Update Issue (2-3 hours)

**Files to Create:**
- `EditIssueDialog.tsx`
- `hooks/useUpdateIssue.ts`

**Tasks:**
1. Create edit dialog (reuse components)
2. Pre-fill with existing issue data
3. Implement update API call
4. Handle status changes (open/close)
5. Update issue in list after save

**Success Criteria:**
- [ ] Edit opens with current data
- [ ] Can edit title, body, labels, assignees
- [ ] Can close/reopen issue
- [ ] Changes reflected immediately

---

### Phase 4: Comments (2-3 hours)

**Files to Create:**
- `AddCommentForm.tsx`
- `hooks/useAddComment.ts`

**Tasks:**
1. Add comment form to issue detail
2. Implement markdown input
3. Implement add comment API call
4. Update comments list after add
5. Handle errors

**Success Criteria:**
- [ ] Comment form shows in detail
- [ ] Can write markdown comment
- [ ] Comment appears after submit
- [ ] Preview works

---

### Phase 5: Quick Bug Report (2-3 hours)

**Files to Create:**
- `QuickBugReport.tsx`

**Tasks:**
1. Create streamlined dialog
2. Single-line title input
3. Auto-add "bug" label
4. Option to include component info
5. Integrate with context menu (prep for GIT-004E)

**Success Criteria:**
- [ ] Quick dialog opens
- [ ] Minimal fields required
- [ ] Creates issue with bug label
- [ ] Component info included when checked

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── IssuesTab/
│       ├── CreateIssueDialog.tsx
│       ├── CreateIssueDialog.module.scss
│       ├── EditIssueDialog.tsx
│       ├── QuickBugReport.tsx
│       ├── AddCommentForm.tsx
│       ├── MarkdownEditor.tsx
│       ├── LabelSelector.tsx
│       ├── AssigneeSelector.tsx
│       └── TemplateSelector.tsx
├── hooks/
│   ├── useCreateIssue.ts
│   ├── useUpdateIssue.ts
│   ├── useAddComment.ts
│   ├── useIssueTemplates.ts
│   └── useRepoLabels.ts
```

### Modify

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
  components/IssuesTab/IssuesTab.tsx
  - Add "New Issue" button
  
  components/IssuesTab/IssueDetail.tsx
  - Add edit button
  - Add close/reopen button
  - Add comment form
```

---

## API Endpoints Used

```typescript
// Create issue
octokit.issues.create({ owner, repo, title, body, labels, assignees })

// Update issue
octokit.issues.update({ owner, repo, issue_number, title, body, state, labels, assignees })

// Add comment
octokit.issues.createComment({ owner, repo, issue_number, body })

// Get issue templates
octokit.repos.getContent({ owner, repo, path: '.github/ISSUE_TEMPLATE' })

// Get labels
octokit.issues.listLabelsForRepo({ owner, repo })

// Get assignees
octokit.repos.listCollaborators({ owner, repo })
```

---

## Testing Checklist

- [ ] Create issue works
- [ ] All fields save correctly
- [ ] Templates load and apply
- [ ] Edit issue works
- [ ] Status change works
- [ ] Add comment works
- [ ] Quick bug report works
- [ ] Validation prevents empty title
- [ ] Error handling works
- [ ] Success feedback shown
- [ ] List updates after changes

---

## Progress Tracking

| Phase | Status | Started | Completed | Hours |
|-------|--------|---------|-----------|-------|
| Phase 1: Create Dialog | Not Started | - | - | - |
| Phase 2: Templates | Not Started | - | - | - |
| Phase 3: Edit & Update | Not Started | - | - | - |
| Phase 4: Comments | Not Started | - | - | - |
| Phase 5: Quick Bug Report | Not Started | - | - | - |

**Estimated Total:** 12-16 hours  
**Actual Total:** - hours
