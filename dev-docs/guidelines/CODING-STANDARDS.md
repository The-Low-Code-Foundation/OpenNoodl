# OpenNoodl Coding Standards

This document defines the coding style and patterns for OpenNoodl development.

## TypeScript Standards

### Type Safety

```typescript
// ✅ DO: Explicit types
function processNode(node: NodeGraphNode): ProcessResult {
  return { success: true, data: node.data };
}

// ❌ DON'T: Any types
function processNode(node: any): any {
  return { success: true, data: node.data };
}

// ❌ DON'T: TSFixme
function processNode(node: TSFixme): TSFixme {
  return { success: true, data: node.data };
}
```

### When Type is Truly Unknown

```typescript
// ✅ DO: Use unknown and narrow
function handleData(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return String((data as { message: unknown }).message);
  }
  return String(data);
}

// ✅ DO: Document why if using any (rare)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Any required here because external library doesn't export types
function handleExternalLib(input: any): void {
  externalLib.process(input);
}
```

### Interface Definitions

```typescript
// ✅ DO: Define interfaces for data structures
interface NodeConfig {
  name: string;
  displayName: string;
  category: string;
  inputs: Record<string, InputDefinition>;
  outputs: Record<string, OutputDefinition>;
}

// ✅ DO: Use type for unions/aliases
type NodeColor = 'data' | 'logic' | 'visual' | 'component';

// ✅ DO: Export types from dedicated files
// types.ts
export interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
}
```

## React Standards

### Functional Components

```typescript
// ✅ DO: Functional components with typed props
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ❌ DON'T: Class components (unless lifecycle methods required)
class Button extends React.Component<ButtonProps> {
  render() {
    return <button>{this.props.label}</button>;
  }
}
```

### Hooks Usage

```typescript
// ✅ DO: Proper hook dependencies
const handleChange = useCallback((value: string) => {
  onChange(value);
  onValidate?.(value);
}, [onChange, onValidate]);

// ✅ DO: Cleanup in effects
useEffect(() => {
  const handler = (e: Event) => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// ❌ DON'T: Missing dependencies
const handleChange = useCallback((value: string) => {
  onChange(value); // onChange not in deps!
}, []);
```

### Component Organization

```typescript
// Component file structure
import React, { useState, useCallback, useEffect } from 'react';

// External imports
import classNames from 'classnames';

// Internal imports
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { useModel } from '@noodl-utils/hooks';

// Relative imports
import { ButtonProps } from './types';
import { validateInput } from './utils';

// Styles last
import css from './Button.module.scss';

// Types (if not in separate file)
interface LocalState {
  isHovered: boolean;
}

// Component
export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  // Hooks first
  const [state, setState] = useState<LocalState>({ isHovered: false });
  const model = useModel(SomeModel.instance);
  
  // Callbacks
  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);
  
  // Effects
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, []);
  
  // Render helpers
  const buttonClass = classNames(css.Button, css[variant]);
  
  // Render
  return (
    <button className={buttonClass} onClick={handleClick}>
      {label}
    </button>
  );
}
```

## File Organization

### Directory Structure

```
feature/
├── index.ts              # Public exports only
├── FeatureName.tsx       # Main component
├── FeatureName.module.scss
├── FeatureName.test.ts
├── types.ts              # Type definitions
├── utils.ts              # Helper functions
└── hooks.ts              # Custom hooks (if any)
```

### Index Files (Barrel Exports)

```typescript
// index.ts - Export only public API
export { FeatureName } from './FeatureName';
export type { FeatureNameProps } from './types';

// DON'T export internal utilities
```

### Import Order

```typescript
// 1. React
import React, { useState, useEffect } from 'react';

// 2. External packages (alphabetical)
import classNames from 'classnames';
import { motion } from 'framer-motion';

// 3. Internal packages (alphabetical by alias)
import { Icon } from '@noodl-core-ui/components/common/Icon';
import { NodeGraphModel } from '@noodl-models/nodegraphmodel';
import { guid } from '@noodl-utils/utils';

// 4. Relative imports (parent first, then siblings)
import { ParentComponent } from '../ParentComponent';
import { SiblingComponent } from './SiblingComponent';
import { localHelper } from './utils';

// 5. Types (if separate import needed)
import type { MyComponentProps } from './types';

// 6. Styles
import css from './MyComponent.module.scss';
```

## Documentation Standards

### JSDoc for Public APIs

```typescript
/**
 * Processes a node and returns the computed result.
 * 
 * @param node - The node to process
 * @param options - Processing options
 * @returns The computed result with output values
 * 
 * @example
 * ```typescript
 * const result = processNode(myNode, { validate: true });
 * console.log(result.outputs);
 * ```
 */
export function processNode(
  node: NodeGraphNode,
  options: ProcessOptions = {}
): ProcessResult {
  // Implementation
}
```

### File Headers

```typescript
/**
 * NodeGraphModel - Manages the structure of a node graph.
 * 
 * This model handles:
 * - Node creation and deletion
 * - Connection management
 * - Graph traversal
 * 
 * @module models/NodeGraphModel
 */
```

### Inline Comments

```typescript
// ✅ DO: Explain "why", not "what"
// We batch updates here to prevent cascading re-renders
// when multiple inputs change in the same frame
this.scheduleAfterInputsHaveUpdated(() => {
  this.processAllInputs();
});

// ❌ DON'T: State the obvious
// Loop through items
for (const item of items) {
  // Process item
  process(item);
}
```

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| React Component | PascalCase | `NodePicker.tsx` |
| Utility | camelCase | `formatUtils.ts` |
| Types | camelCase or PascalCase | `types.ts` or `NodeTypes.ts` |
| Test | Match source + `.test` | `NodePicker.test.ts` |
| Styles | Match component + `.module` | `NodePicker.module.scss` |

### Code

```typescript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// Functions/Methods: camelCase
function processNodeGraph() {}
function calculateOffset() {}

// Classes/Interfaces/Types: PascalCase
class NodeGraphModel {}
interface ProcessOptions {}
type NodeColor = 'data' | 'logic';

// Private members: underscore prefix
class MyClass {
  private _internalState: State;
  private _processInternal(): void {}
}

// Boolean variables: is/has/should prefix
const isEnabled = true;
const hasChildren = node.children.length > 0;
const shouldUpdate = isDirty && isVisible;
```

## Error Handling

```typescript
// ✅ DO: Specific error types
class NodeNotFoundError extends Error {
  constructor(nodeId: string) {
    super(`Node not found: ${nodeId}`);
    this.name = 'NodeNotFoundError';
  }
}

// ✅ DO: Handle errors gracefully
async function fetchData(): Promise<Result> {
  try {
    const response = await api.fetch();
    return { success: true, data: response };
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ✅ DO: Type-safe error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
```

## Testing Standards

### Test File Structure

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  // Group related tests
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<MyComponent />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
  
  describe('interactions', () => {
    it('should call onClick when clicked', () => {
      const onClick = jest.fn();
      render(<MyComponent onClick={onClick} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Test Naming

```typescript
// ✅ DO: Descriptive test names
it('should display error message when validation fails', () => {});
it('should disable submit button while loading', () => {});

// ❌ DON'T: Vague names
it('works', () => {});
it('test 1', () => {});
```

## Git Commit Messages

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes bug nor adds feature
- `docs`: Documentation only
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(editor): add breakpoint support to connections

fix(runtime): resolve memory leak in collection listener

refactor(property-panel): convert to functional component

docs(readme): update installation instructions

test(nodes): add unit tests for REST node
```

## Performance Guidelines

### React Performance

```typescript
// ✅ DO: Memoize expensive computations
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// ✅ DO: Memoize callbacks passed to children
const handleChange = useCallback((value: string) => {
  onChange(value);
}, [onChange]);

// ✅ DO: Use React.memo for pure components
export const ListItem = React.memo(function ListItem({ item }: Props) {
  return <div>{item.name}</div>;
});
```

### General Performance

```typescript
// ✅ DO: Batch DOM operations
function updateNodes(nodes: Node[]) {
  // Collect all changes first
  const changes = nodes.map(calculateChange);
  
  // Apply in single batch
  requestAnimationFrame(() => {
    changes.forEach(applyChange);
  });
}

// ✅ DO: Debounce frequent events
const debouncedSearch = useMemo(
  () => debounce((query: string) => performSearch(query), 300),
  []
);
```
