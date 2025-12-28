# TASK-000H: Migration Wizard Polish

## Overview

Final polish pass on the React 19 Migration Wizard dialog to ensure it looks professional and provides clear user guidance. This is an important user-facing feature.

**Priority:** HIGH (User-facing feature)  
**Effort:** 1-2 hours  
**Risk:** Low  
**Dependencies:** TASK-000A through TASK-000G (All token and component updates)

---

## Objective

Ensure the Migration Wizard:
- Uses the new design tokens consistently
- Has clear visual hierarchy
- Provides obvious progress indication
- Shows success/error states clearly
- Looks polished and professional

---

## Migration Wizard Files

### Main Component
```
packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.tsx
packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.module.scss
```

### Step Components
```
packages/noodl-editor/src/editor/src/views/migration/steps/ConfirmStep.tsx
packages/noodl-editor/src/editor/src/views/migration/steps/ConfirmStep.module.scss

packages/noodl-editor/src/editor/src/views/migration/steps/ScanningStep.tsx
packages/noodl-editor/src/editor/src/views/migration/steps/ScanningStep.module.scss

packages/noodl-editor/src/editor/src/views/migration/steps/ReportStep.tsx
packages/noodl-editor/src/editor/src/views/migration/steps/ReportStep.module.scss

packages/noodl-editor/src/editor/src/views/migration/steps/CompleteStep.tsx
packages/noodl-editor/src/editor/src/views/migration/steps/CompleteStep.module.scss

packages/noodl-editor/src/editor/src/views/migration/steps/FailedStep.tsx
packages/noodl-editor/src/editor/src/views/migration/steps/FailedStep.module.scss
```

### Supporting Components
```
packages/noodl-editor/src/editor/src/views/migration/components/WizardProgress.tsx
packages/noodl-editor/src/editor/src/views/migration/components/WizardProgress.module.scss
```

---

## Part 1: Wizard Progress Indicator

### Ensure Progress Uses Tokens

```scss
/* WizardProgress.module.scss */

.Root {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  background-color: var(--theme-color-bg-1);
  border-bottom: 1px solid var(--theme-color-border-subtle);
}

.StepItem {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.StepNumber {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: 
    background-color var(--transition-default) var(--transition-ease),
    color var(--transition-default) var(--transition-ease);
  
  /* Default (pending) state */
  background-color: var(--theme-color-bg-4);
  color: var(--theme-color-fg-muted);
  
  /* Active state */
  &.is-active {
    background-color: var(--theme-color-primary);
    color: var(--theme-color-on-primary);
  }
  
  /* Completed state */
  &.is-complete {
    background-color: var(--theme-color-success);
    color: var(--theme-color-fg-highlight);
  }
  
  /* Error state */
  &.is-error {
    background-color: var(--theme-color-danger);
    color: var(--theme-color-fg-highlight);
  }
}

.StepLabel {
  font-size: var(--font-size-sm);
  color: var(--theme-color-fg-muted);
  
  &.is-active {
    color: var(--theme-color-fg-default);
    font-weight: var(--font-weight-medium);
  }
  
  &.is-complete {
    color: var(--theme-color-success);
  }
}

.StepConnector {
  flex: 1;
  height: 2px;
  background-color: var(--theme-color-bg-4);
  min-width: 20px;
  
  &.is-complete {
    background-color: var(--theme-color-success);
  }
}
```

---

## Part 2: Step Containers

### Shared Step Styles

Create a shared pattern for all step containers:

```scss
/* Shared concept for each step's .module.scss */

.StepContainer {
  padding: var(--spacing-6);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.StepTitle {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--theme-color-fg-highlight);
  margin: 0;
}

.StepDescription {
  font-size: var(--font-size-base);
  color: var(--theme-color-fg-default-shy);
  line-height: var(--line-height-relaxed);
}

.StepContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}
```

---

## Part 3: Success Banner (CompleteStep)

```scss
/* CompleteStep.module.scss */

.SuccessBanner {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background-color: var(--theme-color-success-bg);
  border: 1px solid var(--theme-color-success-dim);
  border-radius: var(--radius-md);
}

.SuccessIcon {
  width: 24px;
  height: 24px;
  color: var(--theme-color-success);
  flex-shrink: 0;
}

.SuccessText {
  font-size: var(--font-size-base);
  color: var(--theme-color-success);
  font-weight: var(--font-weight-medium);
}

/* Stats display */
.StatsCard {
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
}

.StatItem {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2);
}

.StatValue {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--theme-color-fg-highlight);
}

.StatLabel {
  font-size: var(--font-size-sm);
  color: var(--theme-color-fg-muted);
}

/* What's next section */
.NextStepsSection {
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--theme-color-border-subtle);
}

.NextStepsTitle {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  letter-spacing: var(--text-label-letter-spacing);
  color: var(--theme-color-fg-muted);
  text-transform: uppercase;
  margin-bottom: var(--spacing-3);
}

.ChecklistItem {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-1-5) 0;
  
  font-size: var(--font-size-base);
  color: var(--theme-color-fg-default);
}

.ChecklistIcon {
  width: 16px;
  height: 16px;
  color: var(--theme-color-fg-muted);
  flex-shrink: 0;
  margin-top: 2px;
}
```

---

## Part 4: Error/Failed State (FailedStep)

```scss
/* FailedStep.module.scss */

.ErrorBanner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background-color: var(--theme-color-danger-bg);
  border: 1px solid var(--theme-color-danger-dim);
  border-radius: var(--radius-md);
}

.ErrorIcon {
  width: 24px;
  height: 24px;
  color: var(--theme-color-danger);
  flex-shrink: 0;
}

.ErrorContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.ErrorTitle {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--theme-color-danger-light);
}

.ErrorMessage {
  font-size: var(--font-size-sm);
  color: var(--theme-color-fg-default);
  line-height: var(--line-height-normal);
}

/* Error details (collapsible) */
.ErrorDetails {
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  background-color: var(--theme-color-bg-1);
  border-radius: var(--radius-default);
  font-family: var(--font-family-code);
  font-size: var(--font-size-sm);
  color: var(--theme-color-fg-default-shy);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
```

---

## Part 5: Scanning/Loading State (ScanningStep)

```scss
/* ScanningStep.module.scss */

.LoadingContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-8) var(--spacing-4);
  gap: var(--spacing-4);
}

.Spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--theme-color-bg-4);
  border-top-color: var(--theme-color-primary);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.LoadingText {
  font-size: var(--font-size-base);
  color: var(--theme-color-fg-default-shy);
  text-align: center;
}

/* Progress bar (if applicable) */
.ProgressBar {
  width: 100%;
  max-width: 300px;
  height: 4px;
  background-color: var(--theme-color-bg-4);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.ProgressFill {
  height: 100%;
  background-color: var(--theme-color-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-slow) var(--transition-ease);
}
```

---

## Part 6: Report Step

```scss
/* ReportStep.module.scss */

.ReportContainer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.SummaryCard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--spacing-3);
}

.SummaryItem {
  background-color: var(--theme-color-bg-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  text-align: center;
}

.SummaryValue {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--theme-color-fg-highlight);
}

.SummaryLabel {
  font-size: var(--font-size-xs);
  color: var(--theme-color-fg-muted);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

/* Issue list */
.IssueList {
  border: 1px solid var(--theme-color-border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.IssueItem {
  padding: var(--spacing-3);
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  border-bottom: 1px solid var(--theme-color-border-subtle);
  
  &:last-child {
    border-bottom: none;
  }
}

.IssueIcon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  
  &.is-warning {
    color: var(--theme-color-notice);
  }
  
  &.is-error {
    color: var(--theme-color-danger);
  }
  
  &.is-info {
    color: var(--theme-color-fg-muted);
  }
}

.IssueContent {
  flex: 1;
}

.IssuePath {
  font-family: var(--font-family-code);
  font-size: var(--font-size-xs);
  color: var(--theme-color-fg-muted);
}

.IssueMessage {
  font-size: var(--font-size-sm);
  color: var(--theme-color-fg-default);
}
```

---

## Testing Checklist

### Wizard Progress
- [ ] Current step is clearly highlighted (red)
- [ ] Completed steps show green checkmarks
- [ ] Pending steps are muted
- [ ] Connectors show completion state

### Success State (CompleteStep)
- [ ] Green success banner is prominent
- [ ] Stats are easy to read
- [ ] Next steps are clear
- [ ] Primary action button is obvious

### Error State (FailedStep)
- [ ] Red error banner catches attention
- [ ] Error message is readable
- [ ] Technical details are available but not overwhelming
- [ ] Retry/close actions are clear

### Scanning State
- [ ] Spinner animates smoothly
- [ ] Progress indication is clear
- [ ] User knows something is happening

### Report Step
- [ ] Summary is scannable
- [ ] Issues are categorized by severity
- [ ] File paths are readable
- [ ] Continue action is clear

### General
- [ ] All steps use consistent spacing
- [ ] Typography is readable
- [ ] Colors match new palette
- [ ] Transitions are smooth

---

## Visual Audit Process

1. **Start Migration Wizard** from a test project
2. **Walk through each step** observing:
   - Progress indicator updates
   - Content layout and spacing
   - Button prominence
   - Color usage
3. **Test error scenarios** if possible
4. **Compare against modern UI** (Linear, Raycast, etc.)

---

## Success Criteria

- [ ] Wizard uses design tokens throughout
- [ ] Progress is obvious at a glance
- [ ] Success state feels rewarding
- [ ] Error state is informative but not alarming
- [ ] Overall experience feels polished and professional
- [ ] No hardcoded colors in migration wizard files
