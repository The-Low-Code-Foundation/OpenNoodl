# TASK-000G: Component Visual Updates - Dialogs & Panels

## Overview

Apply visual refinements to dialog, modal, and panel components to create a modern, elevated UI feel. These are high-visibility components that frame content throughout the editor.

**Priority:** MEDIUM  
**Effort:** 1-2 hours  
**Risk:** Medium  
**Dependencies:** TASK-000A, TASK-000D, TASK-000E (Color tokens, Core UI audit, Spacing tokens)

---

## Objective

Make dialogs and panels feel modern and elevated with:
- Subtle borders for definition
- Refined shadows for depth
- Better backdrop styling
- Consistent header/body/footer structure
- Proper spacing using tokens

---

## Part 1: Dialog/Modal Refinements

### File
```
packages/noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.module.scss
```

### Improvements to Apply

```scss
/* Dialog wrapper - handles backdrop */
.Root {
  /* Backdrop styling */
  &.has-backdrop {
    background-color: var(--base-color-black-transparent-80);
    
    /* Optional: subtle blur for modern feel */
    /* Note: may have performance implications */
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
}

/* The visible dialog box */
.VisibleDialog {
  /* Background */
  background-color: var(--theme-color-bg-2);
  
  /* Border for definition against backdrop */
  border: 1px solid var(--theme-color-border-subtle);
  
  /* Modern rounded corners */
  border-radius: var(--radius-lg);
  
  /* Elevated shadow */
  box-shadow: var(--shadow-popup);
  
  /* Overflow handling */
  overflow: hidden;
  
  /* Maximum size constraints */
  max-height: 90vh;
  max-width: 90vw;
}

/* Dialog header */
.DialogHeader {
  padding: var(--spacing-4) var(--spacing-5);
  border-bottom: 1px solid var(--theme-color-border-subtle);
  
  /* Flex layout for title + close button */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
}

.DialogTitle {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--theme-color-fg-highlight);
  line-height: var(--line-height-tight);
  margin: 0;
}

.DialogSubtitle {
  font-size: var(--font-size-base);
  color: var(--theme-color-fg-default-shy);
  margin-top: var(--spacing-1);
}

/* Dialog body */
.DialogBody {
  padding: var(--spacing-5);
  overflow-y: auto;
  
  /* Smooth scrolling */
  scroll-behavior: smooth;
  
  /* Scrollbar styling (webkit) */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: var(--theme-color-bg-3);
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--theme-color-bg-5);
    border-radius: var(--radius-full);
    
    &:hover {
      background: var(--theme-color-fg-muted);
    }
  }
}

/* Dialog footer */
.DialogFooter {
  padding: var(--spacing-4) var(--spacing-5);
  border-top: 1px solid var(--theme-color-border-subtle);
  background-color: var(--theme-color-bg-1);
  
  /* Flex layout for buttons */
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-3);
}

/* Close button in header */
.CloseButton {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-default);
  background: transparent;
  border: none;
  color: var(--theme-color-fg-muted);
  cursor: pointer;
  transition: 
    background-color var(--transition-default) var(--transition-ease),
    color var(--transition-default) var(--transition-ease);
  
  &:hover {
    background-color: var(--theme-color-bg-hover);
    color: var(--theme-color-fg-default);
  }
}
```

---

## Part 2: Panel Refinements

### Files
```
packages/noodl-core-ui/src/components/sidebar/BasePanel/BasePanel.module.scss
packages/noodl-core-ui/src/components/sidebar/Section/Section.module.scss
```

### BasePanel Improvements

```scss
.Root {
  /* Background */
  background-color: var(--theme-color-bg-2);
  
  /* Border for definition */
  border: 1px solid var(--theme-color-border-subtle);
  border-radius: var(--radius-md);
  
  /* Consistent padding */
  padding: var(--spacing-panel-padding);
  
  /* Panel gap between children */
  display: flex;
  flex-direction: column;
  gap: var(--spacing-panel-gap);
}

.PanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--theme-color-border-subtle);
  margin-bottom: var(--spacing-2);
}

.PanelTitle {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--theme-color-fg-default-contrast);
}
```

### Section Improvements

```scss
.Root {
  /* Section spacing */
  padding: var(--spacing-section-padding) 0;
  
  /* Border between sections */
  &:not(:last-child) {
    border-bottom: 1px solid var(--theme-color-border-subtle);
  }
}

.SectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-3);
}

.SectionTitle {
  font-size: var(--text-label-size);
  font-weight: var(--text-label-weight);
  letter-spacing: var(--text-label-letter-spacing);
  color: var(--theme-color-fg-muted);
  text-transform: uppercase;
}

.SectionContent {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

/* Collapsible section */
.SectionToggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  
  &:hover .SectionTitle {
    color: var(--theme-color-fg-default-shy);
  }
}

.CollapseIcon {
  transition: transform var(--transition-default) var(--transition-ease);
  
  &.is-collapsed {
    transform: rotate(-90deg);
  }
}
```

---

## Part 3: Sidebar Item Refinements

### File
```
packages/noodl-core-ui/src/components/sidebar/SidebarItem/SidebarItem.module.scss
```

### Improvements

```scss
.Root {
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-default);
  
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  
  color: var(--theme-color-fg-default);
  
  transition: 
    background-color var(--transition-default) var(--transition-ease),
    color var(--transition-default) var(--transition-ease);
  
  cursor: pointer;
  
  &:hover {
    background-color: var(--theme-color-bg-hover);
  }
  
  &.is-active {
    background-color: var(--theme-color-primary);
    color: var(--theme-color-on-primary);
  }
  
  &.is-selected {
    background-color: var(--theme-color-bg-4);
    color: var(--theme-color-fg-highlight);
  }
}

.ItemIcon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: inherit;
  opacity: 0.7;
}

.ItemLabel {
  flex: 1;
  font-size: var(--font-size-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ItemBadge {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  padding: var(--spacing-0-5) var(--spacing-1);
  background-color: var(--theme-color-bg-5);
  border-radius: var(--radius-sm);
  color: var(--theme-color-fg-default-shy);
}
```

---

## Part 4: Tooltip Refinements

### File
```
packages/noodl-core-ui/src/components/common/Tooltip/Tooltip.module.scss
```

### Improvements

```scss
.Root {
  background-color: var(--theme-color-bg-4);
  color: var(--theme-color-fg-default);
  
  padding: var(--spacing-1-5) var(--spacing-2);
  border-radius: var(--radius-default);
  
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  
  box-shadow: var(--shadow-md);
  border: 1px solid var(--theme-color-border-default);
  
  /* Ensure tooltip is above everything */
  z-index: var(--z-tooltip);
  
  /* Max width for long content */
  max-width: 250px;
}

/* Arrow/pointer if applicable */
.Arrow {
  fill: var(--theme-color-bg-4);
  stroke: var(--theme-color-border-default);
}
```

---

## Testing Checklist

### Dialogs/Modals
- [ ] Dialog has visible border
- [ ] Shadow creates sense of elevation
- [ ] Backdrop is semi-transparent dark
- [ ] Backdrop blur works (if enabled)
- [ ] Header/body/footer clearly separated
- [ ] Title text is prominent
- [ ] Close button works and has hover state
- [ ] Footer buttons aligned correctly
- [ ] Scrollable body works for long content
- [ ] Focus trapped inside dialog

### Panels
- [ ] Panel has subtle border
- [ ] Header section distinct from content
- [ ] Section titles are uppercase/muted
- [ ] Content areas have proper spacing
- [ ] Collapsible sections animate smoothly

### Sidebar Items
- [ ] Items have hover states
- [ ] Active item clearly highlighted (red)
- [ ] Selected item distinct from hover
- [ ] Icons aligned with text
- [ ] Overflow text truncates with ellipsis

### Tooltips
- [ ] Tooltip has border and shadow
- [ ] Text is readable
- [ ] Position correctly relative to trigger
- [ ] Arrow points to trigger (if applicable)

### General
- [ ] Consistent border radius across all components
- [ ] Consistent border colors
- [ ] Smooth transitions
- [ ] Storybook shows all variations correctly

---

## Verification in Storybook

```bash
npm run storybook
```

Navigate to:
- Layout / BaseDialog
- Sidebar / BasePanel
- Sidebar / Section
- Sidebar / SidebarItem
- Common / Tooltip

Review all stories and variants.

---

## Success Criteria

- [ ] Dialogs feel elevated and professional
- [ ] Panels have clear visual structure
- [ ] Sections organize content clearly
- [ ] Sidebar items are interactive and obvious
- [ ] Tooltips are readable and well-positioned
- [ ] Consistent use of tokens throughout
- [ ] No visual regressions from previous functionality
