# Panel & Modal UI Style Guide

This guide documents the visual patterns used in OpenNoodl's editor panels and modals. **Always follow these patterns when creating new UI components.**

---

## Core Principles

### 1. Professional, Not Playful

- **NO emojis** in UI labels, buttons, or headers
- **NO decorative icons** unless they serve a functional purpose
- Clean, minimal aesthetic that respects the user's intelligence
- Think "developer tool" not "consumer app"

### 2. Consistent Visual Language

- Use design tokens (CSS variables) for ALL colors
- Consistent spacing using the spacing system (4px base unit)
- Typography hierarchy using the Text component types
- All interactive elements must have hover/active states

### 3. Dark Theme First

- Design for dark backgrounds (`--theme-color-bg-2`, `--theme-color-bg-3`)
- Ensure sufficient contrast with light text
- Colored elements should be muted, not neon

---

## Panel Structure

### Standard Panel Layout

```tsx
<div className={css.Root}>
  {/* Header with title and close button */}
  <div className={css.Header}>
    <HStack hasSpacing>
      <Icon icon={IconName.Something} size={IconSize.Small} />
      <VStack>
        <Text textType={TextType.DefaultContrast}>Panel Title</Text>
        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
          Subtitle or context
        </Text>
      </VStack>
    </HStack>
    <IconButton icon={IconName.Close} onClick={onClose} />
  </div>

  {/* Toolbar with actions */}
  <div className={css.Toolbar}>{/* Filters, search, action buttons */}</div>

  {/* Content area (scrollable) */}
  <div className={css.Content}>{/* Main panel content */}</div>

  {/* Footer (optional - pagination, status) */}
  <div className={css.Footer}>{/* Page controls, counts */}</div>
</div>
```

### Panel CSS Pattern

```scss
.Root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--theme-color-bg-2);
  color: var(--theme-color-fg-default);
}

.Header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--theme-color-bg-3);
  flex-shrink: 0;
}

.Toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--theme-color-bg-3);
  gap: 8px;
  flex-shrink: 0;
}

.Content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.Footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid var(--theme-color-bg-3);
  background-color: var(--theme-color-bg-2);
  flex-shrink: 0;
}
```

---

## Modal Structure

### Standard Modal Layout

```tsx
<div className={css.Overlay}>
  <div className={css.Modal}>
    {/* Header */}
    <div className={css.Header}>
      <Text textType={TextType.Proud}>Modal Title</Text>
      <IconButton icon={IconName.Close} onClick={onClose} />
    </div>

    {/* Body */}
    <div className={css.Body}>{/* Form fields, content */}</div>

    {/* Footer with actions */}
    <div className={css.Footer}>
      <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Muted} onClick={onClose} />
      <PrimaryButton label="Create" variant={PrimaryButtonVariant.Cta} onClick={onSubmit} />
    </div>
  </div>
</div>
```

### Modal CSS Pattern

```scss
.Overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.Modal {
  background-color: var(--theme-color-bg-2);
  border-radius: 8px;
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.Header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--theme-color-bg-3);
}

.Body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.Footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--theme-color-bg-3);
}
```

---

## Form Elements

### Text Inputs

```scss
.Input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--theme-color-bg-3);
  border-radius: 4px;
  background-color: var(--theme-color-bg-1);
  color: var(--theme-color-fg-default);
  font-size: 13px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }

  &::placeholder {
    color: var(--theme-color-fg-default-shy);
  }
}
```

### Select Dropdowns

```scss
.Select {
  padding: 8px 12px;
  border: 1px solid var(--theme-color-bg-3);
  border-radius: 4px;
  background-color: var(--theme-color-bg-1);
  color: var(--theme-color-fg-default);
  font-size: 13px;
  min-width: 120px;

  &:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }
}
```

### Form Groups

```scss
.FormGroup {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.Label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-color-fg-default);
}

.HelpText {
  margin-top: 4px;
  font-size: 11px;
  color: var(--theme-color-fg-default-shy);
}
```

---

## Data Tables & Grids

### Table Pattern

```scss
.Grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    text-align: left;
    padding: 10px 12px;
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-color-fg-default-shy);
    background-color: var(--theme-color-bg-3);
    border-bottom: 1px solid var(--theme-color-bg-3);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--theme-color-bg-3);
    color: var(--theme-color-fg-default);
  }

  tr:hover td {
    background-color: var(--theme-color-bg-3);
  }
}
```

### Type Badges

For showing data types, use subtle colored badges:

```scss
.TypeBadge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  color: white;
}

// Use semantic colors, not hardcoded
.TypeString {
  background-color: var(--theme-color-primary);
}
.TypeNumber {
  background-color: var(--theme-color-success);
}
.TypeBoolean {
  background-color: var(--theme-color-notice);
}
.TypeDate {
  background-color: #8b5cf6;
} // Purple - no token available
.TypePointer {
  background-color: var(--theme-color-danger);
}
```

---

## Expandable Rows

For tree-like or expandable content:

```scss
.ExpandableRow {
  border: 1px solid var(--theme-color-bg-3);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
  background-color: var(--theme-color-bg-2);

  &[data-expanded='true'] {
    border-color: var(--theme-color-primary);
  }
}

.RowHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: var(--theme-color-bg-3);
  }
}

.RowContent {
  padding: 0 16px 16px;
  background-color: var(--theme-color-bg-1);
  border-top: 1px solid var(--theme-color-bg-3);
}

.ExpandIcon {
  transition: transform 0.2s;
  color: var(--theme-color-fg-default-shy);
}
```

---

## Empty States

When there's no content to show:

```scss
.EmptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--theme-color-fg-default-shy);

  .EmptyIcon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .EmptyText {
    margin-bottom: 8px;
  }
}
```

---

## Loading & Error States

### Loading

```scss
.Loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--theme-color-fg-default-shy);
}
```

### Error

```scss
.Error {
  padding: 12px 16px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--theme-color-danger);
  border-radius: 4px;
  color: var(--theme-color-danger);
  font-size: 13px;
}
```

---

## Button Patterns

### Use PrimaryButton Variants Correctly

| Variant  | Use For                                    |
| -------- | ------------------------------------------ |
| `Cta`    | Primary action (Create, Save, Submit)      |
| `Muted`  | Secondary action (Cancel, Close, Refresh)  |
| `Ghost`  | Tertiary action (Edit, View, minor action) |
| `Danger` | Destructive action (Delete)                |

### Button Sizing

- `Small` - In toolbars, table rows, compact spaces
- `Medium` - Modal footers, standalone actions
- `Large` - Rarely used, hero actions only

---

## Spacing System

Use consistent spacing based on 4px unit:

| Token | Value | Use For                  |
| ----- | ----- | ------------------------ |
| `xs`  | 4px   | Tight spacing, icon gaps |
| `sm`  | 8px   | Related elements         |
| `md`  | 12px  | Standard padding         |
| `lg`  | 16px  | Section padding          |
| `xl`  | 24px  | Large gaps               |
| `xxl` | 32px  | Major sections           |

---

## Typography

### Use Text Component Types

| Type              | Use For                         |
| ----------------- | ------------------------------- |
| `Proud`           | Panel titles, modal headers     |
| `DefaultContrast` | Primary content, item names     |
| `Default`         | Body text, descriptions         |
| `Shy`             | Secondary text, hints, metadata |

### Font Sizes

- Headers: 14-16px
- Body: 13px
- Labels: 12px
- Small text: 11px
- Badges: 10px

---

## Don'ts

❌ **Don't use emojis** in buttons or labels
❌ **Don't use hardcoded colors** - always use CSS variables
❌ **Don't use bright/neon colors** - keep it muted
❌ **Don't use decorative icons** that don't convey meaning
❌ **Don't use rounded corners > 8px** - keep it subtle
❌ **Don't use shadows > 0.4 opacity** - stay subtle
❌ **Don't use animation duration > 200ms** - keep it snappy
❌ **Don't mix different styling approaches** - be consistent

---

## Reference Components

For working examples, see:

- `packages/noodl-editor/src/editor/src/views/panels/schemamanager/`
- `packages/noodl-editor/src/editor/src/views/panels/databrowser/`
- `packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/`

---

_Last Updated: January 2026_
