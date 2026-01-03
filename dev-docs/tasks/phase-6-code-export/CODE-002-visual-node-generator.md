# CODE-002: Visual Node Generator

## Overview

The Visual Node Generator transforms Noodl's visual component tree (Groups, Text, Images, Buttons, etc.) into clean React components with proper styling. This is the most straightforward part of code export since visual nodes map directly to HTML/React elements.

**Estimated Effort:** 1-2 weeks  
**Priority:** HIGH  
**Dependencies:** CODE-001 (@nodegx/core)  
**Blocks:** CODE-006 (Project Scaffolding)

---

## Node → Element Mapping

### Container Nodes

| Noodl Node | React Element | CSS Layout | Notes |
|------------|---------------|------------|-------|
| Group | `<div>` | Flexbox | Main container |
| Page | `<div>` + Route | Flexbox | Route wrapper |
| Columns | `<div>` | CSS Grid | Multi-column |
| Circle | `<div>` | border-radius: 50% | Shape |
| Rectangle | `<div>` | - | Shape |

### Content Nodes

| Noodl Node | React Element | Notes |
|------------|---------------|-------|
| Text | `<span>` / `<p>` | Based on multiline |
| Image | `<img>` | With loading states |
| Video | `<video>` | With controls |
| Icon | `<svg>` / Icon component | From icon library |
| Lottie | LottiePlayer component | Animation |

### Form Nodes

| Noodl Node | React Element | Notes |
|------------|---------------|-------|
| Button | `<button>` | With states |
| TextInput | `<input>` | Controlled |
| TextArea | `<textarea>` | Controlled |
| Checkbox | `<input type="checkbox">` | Controlled |
| Radio Button | `<input type="radio">` | With group |
| Dropdown | `<select>` | Controlled |
| Slider | `<input type="range">` | Controlled |

### Navigation Nodes

| Noodl Node | Generated Code | Notes |
|------------|----------------|-------|
| Page Router | `<Routes>` | React Router |
| Navigate | `useNavigate()` | Imperative |
| External Link | `<a href>` | With target |

---

## Style Mapping

### Layout Properties

```typescript
interface NoodlLayoutProps {
  // Position
  position: 'relative' | 'absolute' | 'fixed' | 'sticky';
  positionX?: number | string;
  positionY?: number | string;
  
  // Size
  width?: number | string | 'auto' | 'content';
  height?: number | string | 'auto' | 'content';
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  
  // Flexbox (as container)
  flexDirection: 'row' | 'column';
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  gap?: number;
  flexWrap?: 'nowrap' | 'wrap';
  
  // Flexbox (as child)
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';
  flexGrow?: number;
  flexShrink?: number;
}

// Generated CSS
function generateLayoutCSS(props: NoodlLayoutProps): string {
  const styles: string[] = [];
  
  // Position
  if (props.position !== 'relative') {
    styles.push(`position: ${props.position}`);
  }
  if (props.positionX !== undefined) {
    styles.push(`left: ${formatValue(props.positionX)}`);
  }
  if (props.positionY !== undefined) {
    styles.push(`top: ${formatValue(props.positionY)}`);
  }
  
  // Size
  if (props.width !== undefined && props.width !== 'auto') {
    styles.push(`width: ${formatValue(props.width)}`);
  }
  // ... etc
  
  // Flexbox
  styles.push(`display: flex`);
  styles.push(`flex-direction: ${props.flexDirection}`);
  styles.push(`justify-content: ${props.justifyContent}`);
  styles.push(`align-items: ${props.alignItems}`);
  
  if (props.gap) {
    styles.push(`gap: ${props.gap}px`);
  }
  
  return styles.join(';\n');
}
```

### Appearance Properties

```typescript
interface NoodlAppearanceProps {
  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  
  // Border
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadius?: number | string;
  
  // Shadow
  boxShadow?: string;
  boxShadowEnabled?: boolean;
  boxShadowX?: number;
  boxShadowY?: number;
  boxShadowBlur?: number;
  boxShadowSpread?: number;
  boxShadowColor?: string;
  
  // Effects
  opacity?: number;
  transform?: string;
  transformOrigin?: string;
  filter?: string;
  
  // Overflow
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto';
}

function generateAppearanceCSS(props: NoodlAppearanceProps): string {
  const styles: string[] = [];
  
  // Background
  if (props.backgroundColor) {
    styles.push(`background-color: ${props.backgroundColor}`);
  }
  
  // Border
  if (props.borderWidth) {
    styles.push(`border: ${props.borderWidth}px ${props.borderStyle || 'solid'} ${props.borderColor || '#000'}`);
  }
  if (props.borderRadius) {
    styles.push(`border-radius: ${formatValue(props.borderRadius)}`);
  }
  
  // Shadow
  if (props.boxShadowEnabled) {
    const shadow = `${props.boxShadowX || 0}px ${props.boxShadowY || 0}px ${props.boxShadowBlur || 0}px ${props.boxShadowSpread || 0}px ${props.boxShadowColor || 'rgba(0,0,0,0.2)'}`;
    styles.push(`box-shadow: ${shadow}`);
  }
  
  // Opacity
  if (props.opacity !== undefined && props.opacity !== 1) {
    styles.push(`opacity: ${props.opacity}`);
  }
  
  return styles.join(';\n');
}
```

### Typography Properties

```typescript
interface NoodlTypographyProps {
  fontFamily?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color?: string;
}

function generateTypographyCSS(props: NoodlTypographyProps): string {
  const styles: string[] = [];
  
  if (props.fontFamily) styles.push(`font-family: ${props.fontFamily}`);
  if (props.fontSize) styles.push(`font-size: ${formatValue(props.fontSize)}`);
  if (props.fontWeight) styles.push(`font-weight: ${props.fontWeight}`);
  if (props.color) styles.push(`color: ${props.color}`);
  // ... etc
  
  return styles.join(';\n');
}
```

---

## Component Generation

### Basic Group Component

**Noodl Node:**
```json
{
  "id": "group-1",
  "type": "Group",
  "parameters": {
    "backgroundColor": "#ffffff",
    "paddingLeft": 16,
    "paddingRight": 16,
    "paddingTop": 12,
    "paddingBottom": 12,
    "borderRadius": 8,
    "flexDirection": "column",
    "gap": 8
  },
  "children": ["text-1", "button-1"]
}
```

**Generated Component:**
```tsx
// components/Card.tsx
import styles from './Card.module.css';

interface CardProps {
  children?: React.ReactNode;
}

export function Card({ children }: CardProps) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  );
}
```

**Generated CSS:**
```css
/* components/Card.module.css */
.root {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background-color: #ffffff;
  border-radius: 8px;
}
```

### Text Node

**Noodl Node:**
```json
{
  "id": "text-1",
  "type": "Text",
  "parameters": {
    "text": "Hello World",
    "fontSize": 18,
    "fontWeight": 600,
    "color": "#333333"
  }
}
```

**Generated Code:**
```tsx
// Inline in parent component
<span className={styles.text1}>Hello World</span>

// Or with dynamic text binding
<span className={styles.text1}>{titleVar.get()}</span>
```

**Generated CSS:**
```css
.text1 {
  font-size: 18px;
  font-weight: 600;
  color: #333333;
}
```

### Button with States

**Noodl Node:**
```json
{
  "id": "button-1",
  "type": "Button",
  "parameters": {
    "label": "Click Me",
    "backgroundColor": "#3b82f6",
    "hoverBackgroundColor": "#2563eb",
    "pressedBackgroundColor": "#1d4ed8",
    "disabledBackgroundColor": "#94a3b8",
    "borderRadius": 6,
    "paddingLeft": 16,
    "paddingRight": 16,
    "paddingTop": 8,
    "paddingBottom": 8
  },
  "stateParameters": {
    "hover": { "backgroundColor": "#2563eb" },
    "pressed": { "backgroundColor": "#1d4ed8" },
    "disabled": { "backgroundColor": "#94a3b8", "opacity": 0.6 }
  }
}
```

**Generated Component:**
```tsx
// components/PrimaryButton.tsx
import { ButtonHTMLAttributes } from 'react';
import styles from './PrimaryButton.module.css';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export function PrimaryButton({ 
  label = 'Click Me',
  children,
  className,
  ...props 
}: PrimaryButtonProps) {
  return (
    <button 
      className={`${styles.root} ${className || ''}`}
      {...props}
    >
      {children || label}
    </button>
  );
}
```

**Generated CSS:**
```css
/* components/PrimaryButton.module.css */
.root {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.root:hover:not(:disabled) {
  background-color: #2563eb;
}

.root:active:not(:disabled) {
  background-color: #1d4ed8;
}

.root:disabled {
  background-color: #94a3b8;
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Repeater (For Each)

**Noodl Node:**
```json
{
  "id": "repeater-1",
  "type": "For Each",
  "parameters": {
    "items": "{{users}}"
  },
  "templateComponent": "UserCard",
  "children": []
}
```

**Generated Code:**
```tsx
import { useArray, RepeaterItemProvider } from '@nodegx/core';
import { usersArray } from '../stores/arrays';
import { UserCard } from './UserCard';

export function UserList() {
  const users = useArray(usersArray);
  
  return (
    <div className={styles.root}>
      {users.map((user, index) => (
        <RepeaterItemProvider
          key={user.id || index}
          item={user}
          index={index}
          itemId={`user_${user.id || index}`}
        >
          <UserCard />
        </RepeaterItemProvider>
      ))}
    </div>
  );
}
```

### Component Children

**Noodl Node Structure:**
```
MyWrapper
├── Header
├── [Component Children]  ← Slot for children
└── Footer
```

**Generated Code:**
```tsx
// components/MyWrapper.tsx
import styles from './MyWrapper.module.css';

interface MyWrapperProps {
  children?: React.ReactNode;
}

export function MyWrapper({ children }: MyWrapperProps) {
  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.content}>
        {children}
      </div>
      <Footer />
    </div>
  );
}
```

---

## Visual States Handling

### State Transitions

Noodl supports animated transitions between visual states. For basic hover/pressed states, we use CSS transitions. For complex state machines, we use the `@nodegx/core` state machine.

**CSS Approach (simple states):**
```css
.button {
  background-color: #3b82f6;
  transition: 
    background-color 0.2s ease,
    transform 0.15s ease,
    opacity 0.2s ease;
}

.button:hover {
  background-color: #2563eb;
  transform: scale(1.02);
}

.button:active {
  background-color: #1d4ed8;
  transform: scale(0.98);
}
```

**State Machine Approach (complex states):**
```tsx
import { useStateMachine, useStateValues, createStateMachine } from '@nodegx/core';

// Define state machine with values for each state
const cardState = createStateMachine({
  states: ['idle', 'hover', 'expanded', 'loading'],
  initial: 'idle',
  values: {
    idle: { scale: 1, opacity: 1, height: 100 },
    hover: { scale: 1.02, opacity: 1, height: 100 },
    expanded: { scale: 1, opacity: 1, height: 300 },
    loading: { scale: 1, opacity: 0.7, height: 100 }
  }
});

export function Card() {
  const [state, goTo] = useStateMachine(cardState);
  const values = useStateValues(cardState);
  
  return (
    <div
      className={styles.root}
      style={{
        transform: `scale(${values.scale})`,
        opacity: values.opacity,
        height: values.height
      }}
      onMouseEnter={() => state === 'idle' && goTo('hover')}
      onMouseLeave={() => state === 'hover' && goTo('idle')}
      onClick={() => goTo('expanded')}
    >
      {/* content */}
    </div>
  );
}
```

---

## Input Handling

### Controlled Components

All form inputs are generated as controlled components:

```tsx
import { useVariable } from '@nodegx/core';
import { searchQueryVar } from '../stores/variables';

export function SearchInput() {
  const [query, setQuery] = useVariable(searchQueryVar);
  
  return (
    <input
      type="text"
      className={styles.input}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### Event Connections

Noodl connections from visual node events become props or inline handlers:

**Click → Signal:**
```tsx
import { onButtonClick } from '../logic/handlers';

<button onClick={() => onButtonClick.send()}>
  Click Me
</button>
```

**Click → Function:**
```tsx
import { handleSubmit } from '../logic/formHandlers';

<button onClick={handleSubmit}>
  Submit
</button>
```

**Click → Navigate:**
```tsx
import { useNavigate } from 'react-router-dom';

export function NavButton() {
  const navigate = useNavigate();
  
  return (
    <button onClick={() => navigate('/dashboard')}>
      Go to Dashboard
    </button>
  );
}
```

---

## Image Handling

### Static Images

```tsx
// Image in assets folder
<img 
  src="/assets/logo.png"
  alt="Logo"
  className={styles.logo}
/>
```

### Dynamic Images

```tsx
// From variable or object
const user = useObject(currentUser);

<img 
  src={user.avatar || '/assets/default-avatar.png'}
  alt={user.name}
  className={styles.avatar}
/>
```

### Loading States

```tsx
import { useState } from 'react';

export function LazyImage({ src, alt, className }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  return (
    <div className={`${styles.imageContainer} ${className}`}>
      {!loaded && !error && (
        <div className={styles.skeleton} />
      )}
      {error && (
        <div className={styles.errorPlaceholder}>
          Failed to load
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${styles.image} ${loaded ? styles.visible : styles.hidden}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
```

---

## Code Generation Algorithm

```typescript
interface GenerateVisualNodeOptions {
  node: NoodlNode;
  componentName: string;
  outputDir: string;
  cssMode: 'modules' | 'tailwind' | 'inline';
}

async function generateVisualComponent(options: GenerateVisualNodeOptions) {
  const { node, componentName, outputDir, cssMode } = options;
  
  // 1. Analyze node and children
  const analysis = analyzeVisualNode(node);
  
  // 2. Determine if this needs a separate component file
  const needsSeparateFile = 
    analysis.hasChildren ||
    analysis.hasStateLogic ||
    analysis.hasEventHandlers ||
    analysis.isReusable;
  
  // 3. Generate styles
  const styles = generateStyles(node, cssMode);
  
  // 4. Generate component code
  const componentCode = generateComponentCode({
    node,
    componentName,
    styles,
    analysis
  });
  
  // 5. Write files
  if (needsSeparateFile) {
    await writeFile(`${outputDir}/${componentName}.tsx`, componentCode);
    if (cssMode === 'modules') {
      await writeFile(`${outputDir}/${componentName}.module.css`, styles.css);
    }
  }
  
  return {
    componentName,
    inlineCode: needsSeparateFile ? null : componentCode,
    imports: analysis.imports
  };
}
```

---

## Testing Checklist

### Visual Parity Tests

- [ ] Group renders with correct flexbox layout
- [ ] Text displays with correct typography
- [ ] Image loads and displays correctly
- [ ] Button states (hover, pressed, disabled) work
- [ ] Repeater renders all items
- [ ] Component Children slot works
- [ ] Nested components render correctly

### Style Tests

- [ ] All spacing values (margin, padding, gap) correct
- [ ] Border radius renders correctly
- [ ] Box shadows render correctly
- [ ] Colors match exactly
- [ ] Responsive units (%,vh,vw) work
- [ ] CSS transitions animate smoothly

### Interaction Tests

- [ ] Click handlers fire correctly
- [ ] Form inputs are controlled
- [ ] Mouse enter/leave events work
- [ ] Focus states display correctly
- [ ] Keyboard navigation works

---

## Success Criteria

1. **Visual Match** - Exported app looks identical to Noodl preview
2. **Clean Code** - Generated components are readable and maintainable
3. **Proper Typing** - Full TypeScript types for all props
4. **Accessibility** - Proper ARIA attributes, semantic HTML
5. **Performance** - No unnecessary re-renders, proper memoization
