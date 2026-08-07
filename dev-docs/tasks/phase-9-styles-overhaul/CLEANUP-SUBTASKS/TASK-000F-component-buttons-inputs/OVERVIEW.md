# TASK-000F: Component Visual Updates - Buttons & Inputs

## Overview

Apply visual refinements to button and input components to achieve a modern, polished feel. This builds on the token work done in previous tasks.

**Priority:** MEDIUM  
**Effort:** 1-2 hours  
**Risk:** Medium  
**Dependencies:** TASK-000A, TASK-000D, TASK-000E (Color tokens, Core UI audit, Spacing tokens)

---

## Objective

Make buttons and inputs feel modern and polished with:
- Subtle rounded corners
- Smooth transitions
- Clear hover/focus states
- Better disabled appearances
- Consistent spacing using tokens

---

## Part 1: Button Refinements

### File
```
packages/noodl-core-ui/src/components/inputs/PrimaryButton/PrimaryButton.module.scss
```

### Improvements to Apply

```scss
.Root {
  /* Use spacing tokens for padding */
  padding: var(--spacing-button-padding-y) var(--spacing-button-padding-x);
  gap: var(--spacing-button-gap);
  
  /* Modern rounded corners */
  border-radius: var(--radius-md);
  
  /* Smooth transitions for all interactive states */
  transition: 
    background-color var(--transition-default) var(--transition-ease),
    border-color var(--transition-default) var(--transition-ease),
    box-shadow var(--transition-default) var(--transition-ease),
    transform var(--transition-fast) var(--transition-ease);
  
  /* Font styling */
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-base);
  line-height: var(--line-height-tight);
  
  /* CTA (Primary Red) variant */
  &.is-variant-cta {
    background-color: var(--theme-color-primary);
    color: var(--theme-color-on-primary);
    border: 1px solid transparent;
    box-shadow: var(--shadow-sm);
    
    &:hover:not(:disabled) {
      background-color: var(--theme-color-primary-highlight);
      box-shadow: var(--shadow-default);
      transform: translateY(-1px);
    }
    
    &:active:not(:disabled) {
      background-color: var(--theme-color-primary-dim);
      box-shadow: none;
      transform: translateY(0);
    }
  }
  
  /* Secondary variant */
  &.is-variant-secondary {
    background-color: var(--theme-color-bg-4);
    color: var(--theme-color-fg-default);
    border: 1px solid var(--theme-color-border-default);
    
    &:hover:not(:disabled) {
      background-color: var(--theme-color-bg-5);
      border-color: var(--theme-color-border-strong);
    }
  }
  
  /* Ghost variant */
  &.is-variant-ghost {
    background-color: transparent;
    color: var(--theme-color-fg-default);
    border: 1px solid transparent;
    
    &:hover:not(:disabled) {
      background-color: var(--theme-color-bg-hover);
    }
  }
  
  /* Disabled state - consistent across all variants */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }
  
  /* Focus visible - accessibility */
  &:focus-visible {
    outline: 2px solid var(--theme-color-focus-ring);
    outline-offset: 2px;
  }
}
```

### Other Button Components to Check
- `SecondaryButton` (if exists)
- `IconButton` (if exists)
- `TextButton` (if exists)

---

## Part 2: Input Field Refinements

### File
```
packages/noodl-core-ui/src/components/inputs/TextInput/TextInput.module.scss
```

### Improvements to Apply

```scss
.Root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.InputArea {
  /* Use spacing tokens */
  padding: var(--spacing-input-padding-y) var(--spacing-input-padding-x);
  
  /* Background and border */
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  border-radius: var(--radius-default);
  
  /* Typography */
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--theme-color-fg-default);
  
  /* Transitions */
  transition: 
    border-color var(--transition-default) var(--transition-ease),
    box-shadow var(--transition-default) var(--transition-ease);
  
  /* Placeholder styling */
  &::placeholder {
    color: var(--theme-color-fg-muted);
  }
  
  /* Hover state */
  &:hover:not(:disabled):not(:focus) {
    border-color: var(--theme-color-border-strong);
  }
  
  /* Focus state - prominent red ring */
  &:focus {
    border-color: var(--theme-color-focus-ring);
    box-shadow: 0 0 0 2px rgba(210, 31, 60, 0.15);
    outline: none;
  }
  
  /* Error state */
  &.has-error {
    border-color: var(--theme-color-danger);
    
    &:focus {
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
    }
  }
  
  /* Disabled state */
  &:disabled {
    background-color: var(--theme-color-bg-2);
    color: var(--theme-color-fg-muted);
    cursor: not-allowed;
    opacity: 0.7;
  }
}

/* Label styling */
.Label {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  letter-spacing: var(--text-label-letter-spacing);
  color: var(--theme-color-fg-default-shy);
  text-transform: uppercase;
}

/* Helper/error text */
.HelperText {
  font-size: var(--font-size-xs);
  color: var(--theme-color-fg-muted);
  
  &.is-error {
    color: var(--theme-color-danger);
  }
}
```

### Other Input Components to Update
- `Select/Select.module.scss`
- `Checkbox/Checkbox.module.scss`  
- `Slider/Slider.module.scss`
- `NumberInput` (if exists)
- `TextArea` (if exists)

---

## Part 3: Select/Dropdown Refinements

### File
```
packages/noodl-core-ui/src/components/inputs/Select/Select.module.scss
```

### Key Styles

```scss
.SelectTrigger {
  /* Same base styling as TextInput */
  padding: var(--spacing-input-padding-y) var(--spacing-input-padding-x);
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  border-radius: var(--radius-default);
  
  /* Flex layout for icon */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-2);
  
  transition: border-color var(--transition-default) var(--transition-ease);
  
  &:hover:not(:disabled) {
    border-color: var(--theme-color-border-strong);
  }
  
  &.is-open {
    border-color: var(--theme-color-focus-ring);
  }
}

.DropdownMenu {
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-popup);
  
  /* Ensure dropdown appears above other content */
  z-index: var(--z-dropdown);
}

.DropdownItem {
  padding: var(--spacing-2) var(--spacing-3);
  color: var(--theme-color-fg-default);
  
  &:hover {
    background-color: var(--theme-color-bg-hover);
  }
  
  &.is-selected {
    background-color: var(--theme-color-primary);
    color: var(--theme-color-on-primary);
  }
}
```

---

## Part 4: Checkbox Refinements

### File
```
packages/noodl-core-ui/src/components/inputs/Checkbox/Checkbox.module.scss  
```

### Key Styles

```scss
.CheckboxBox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--theme-color-border-strong);
  border-radius: var(--radius-sm);
  background-color: var(--theme-color-bg-3);
  transition: 
    background-color var(--transition-default) var(--transition-ease),
    border-color var(--transition-default) var(--transition-ease);
  
  &:hover:not(:disabled) {
    border-color: var(--theme-color-focus-ring);
  }
  
  &.is-checked {
    background-color: var(--theme-color-primary);
    border-color: var(--theme-color-primary);
    
    /* Checkmark icon should be white */
    color: var(--theme-color-on-primary);
  }
}
```

---

## Testing Checklist

### Buttons
- [ ] Primary (CTA) button is red with white text
- [ ] Hover state brightens and lifts slightly
- [ ] Active state darkens
- [ ] Disabled state is clearly disabled (50% opacity)
- [ ] Focus ring is visible and red
- [ ] Secondary button has visible border
- [ ] Ghost button has no background until hover

### Text Inputs
- [ ] Input has visible background and border
- [ ] Placeholder text is muted gray
- [ ] Hover state shows stronger border
- [ ] Focus state shows red ring
- [ ] Error state shows red border
- [ ] Disabled state is clearly disabled

### Selects
- [ ] Dropdown trigger looks like input
- [ ] Dropdown menu has shadow and border
- [ ] Items have hover states
- [ ] Selected item is highlighted

### Checkboxes
- [ ] Unchecked box has visible border
- [ ] Checked state shows red background
- [ ] Hover state on unchecked shows border change

### General
- [ ] All components use consistent spacing
- [ ] All components use consistent border radius
- [ ] Transitions are smooth, not jarring
- [ ] Storybook shows all states correctly

---

## Verification in Storybook

```bash
npm run storybook
```

Navigate to:
- Inputs / PrimaryButton
- Inputs / TextInput
- Inputs / Select
- Inputs / Checkbox

Review all stories and variants.

---

## Success Criteria

- [ ] Buttons feel modern and responsive
- [ ] Inputs have clear, accessible focus states
- [ ] All interactive states are smooth
- [ ] Disabled states are obvious
- [ ] Consistent use of tokens throughout
- [ ] No visual regressions from previous functionality
