# TASK-004: Edit Backend Dialog

**Task ID:** TASK-004  
**Phase:** 5 - Multi-Target Deployment (BYOB)  
**Priority:** 🟡 Medium  
**Difficulty:** 🟢 Easy  
**Estimated Time:** 1-2 days  
**Prerequisites:** TASK-001 (Backend Services Panel)  
**Branch:** `feature/byob-edit-backend`

## Objective

Add the ability to edit existing backend configurations. Currently users can only add new backends or delete them - there's no way to update URL, credentials, or settings.

## Background

TASK-001 implemented Add Backend and Delete Backend functionality. Users frequently need to:

- Update API tokens when they rotate
- Change URLs between environments
- Modify authentication settings
- Rename backends for clarity

## User Story

> As a Noodl user, I want to edit my backend configurations, so I can update credentials or settings without recreating the entire configuration.

## Current State

- Add Backend Dialog exists (TASK-001 ✅)
- Delete backend works
- No edit capability - must delete and recreate
- `updateBackend()` method exists in model but no UI

## Desired State

- "Edit" button on BackendCard
- Opens pre-filled dialog with current values
- Save updates existing config
- Preserve schema cache and connection history

## UI Design

The Edit dialog reuses AddBackendDialog with modifications:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Edit Backend                                                   [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ NAME                                                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Production Directus                                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ TYPE                                                                │
│ [Directus            ▾]  ← Disabled (can't change type)            │
│                                                                     │
│ URL                                                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ https://api.myapp.com                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ AUTHENTICATION                                                      │
│ Method: [Bearer Token ▾]                                            │
│ Token: [•••••••••••••••••••••••••••         ] [👁] [Update]        │
│                                                                     │
│ ⚠️ Changing URL or credentials will require re-syncing schema      │
│                                                                     │
│                                    [Cancel] [Test] [Save Changes]   │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation

### Option A: Modify AddBackendDialog (Recommended)

Add an `editMode` prop to the existing dialog:

```typescript
interface AddBackendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (backend: BackendConfig) => void;
  editBackend?: BackendConfig; // If provided, dialog is in edit mode
}
```

### Option B: Create Separate EditBackendDialog

Create a new component specifically for editing. More code duplication but cleaner separation.

### Recommendation

**Option A** - Reusing AddBackendDialog is simpler since 90% of the UI is identical.

### Key Differences in Edit Mode

| Aspect         | Add Mode          | Edit Mode                    |
| -------------- | ----------------- | ---------------------------- |
| Title          | "Add Backend"     | "Edit Backend"               |
| Type selector  | Enabled           | Disabled (can't change type) |
| Submit button  | "Add Backend"     | "Save Changes"               |
| Initial values | Empty/defaults    | Populated from editBackend   |
| On submit      | `createBackend()` | `updateBackend()`            |

### Changes Required

1. **AddBackendDialog.tsx**

   - Accept optional `editBackend` prop
   - Initialize form with existing values
   - Disable type selector in edit mode
   - Change button text/behavior

2. **BackendCard.tsx**

   - Add "Edit" button to actions
   - Open dialog with `editBackend` prop

3. **BackendServicesPanel.tsx**
   - Handle edit dialog state
   - Pass selected backend to dialog

## Code Changes

### BackendCard Actions

```tsx
// Current
<IconButton icon={IconName.Trash} onClick={onDelete} />

// After
<IconButton icon={IconName.Pencil} onClick={onEdit} />
<IconButton icon={IconName.Trash} onClick={onDelete} />
```

### Dialog Mode Detection

```tsx
function AddBackendDialog({ editBackend, onSave, ... }) {
  const isEditMode = !!editBackend;

  const [name, setName] = useState(editBackend?.name || '');
  const [url, setUrl] = useState(editBackend?.url || '');
  // ... etc

  const handleSubmit = async () => {
    if (isEditMode) {
      await BackendServices.instance.updateBackend({
        id: editBackend.id,
        name,
        url,
        auth
      });
    } else {
      await BackendServices.instance.createBackend({ ... });
    }
    onSave();
  };

  return (
    <Dialog title={isEditMode ? 'Edit Backend' : 'Add Backend'}>
      {/* ... form fields ... */}
      <Button
        label={isEditMode ? 'Save Changes' : 'Add Backend'}
        onClick={handleSubmit}
      />
    </Dialog>
  );
}
```

## Success Criteria

- [ ] Edit button appears on BackendCard
- [ ] Clicking Edit opens dialog with pre-filled values
- [ ] Backend type selector is disabled in edit mode
- [ ] URL can be changed
- [ ] Credentials can be updated
- [ ] Save calls `updateBackend()` method
- [ ] Schema cache is preserved after edit
- [ ] Connection status updates after credential change
