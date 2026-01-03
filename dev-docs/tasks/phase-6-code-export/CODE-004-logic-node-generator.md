# CODE-004: Logic Node Generator

## Overview

The Logic Node Generator transforms Noodl's Function nodes, Expression nodes, and logic nodes (Condition, Switch, And/Or/Not, etc.) into clean JavaScript/TypeScript code. This is one of the more complex aspects of code export because it requires understanding the data flow graph and generating appropriate code patterns.

**Estimated Effort:** 2-3 weeks  
**Priority:** HIGH  
**Dependencies:** CODE-001 (@nodegx/core), CODE-003 (State Store Generator)  
**Blocks:** CODE-006 (Project Scaffolding)

---

## Function Node Transformation

### Noodl Function Node Structure

In Noodl, Function nodes contain JavaScript that interacts with:
- `Inputs` object - values from connected inputs
- `Outputs` object - set values to send to outputs  
- `Outputs.signalName()` - send a signal

```javascript
// Noodl Function Node code
const doubled = Inputs.value * 2;
Outputs.result = doubled;

if (doubled > 100) {
  Outputs.exceeded();  // Signal
}
```

### Transformation Strategy

**Option 1: Pure Function (preferred when possible)**
```typescript
// logic/mathUtils.ts

export function doubleValue(value: number): { result: number; exceeded: boolean } {
  const doubled = value * 2;
  return {
    result: doubled,
    exceeded: doubled > 100
  };
}
```

**Option 2: Side-effect Function (when updating stores)**
```typescript
// logic/userActions.ts
import { createSignal, setVariable } from '@nodegx/core';
import { userNameVar, isLoggedInVar } from '../stores/variables';

export const onLoginSuccess = createSignal('onLoginSuccess');
export const onLoginFailure = createSignal('onLoginFailure');

export async function handleLogin(email: string, password: string): Promise<void> {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) throw new Error('Login failed');
    
    const user = await response.json();
    
    // Set variables (equivalent to Outputs.userName = user.name)
    setVariable(userNameVar, user.name);
    setVariable(isLoggedInVar, true);
    
    // Send signal (equivalent to Outputs.success())
    onLoginSuccess.send();
  } catch (error) {
    onLoginFailure.send();
  }
}
```

**Option 3: Hook Function (when needing React context)**
```typescript
// hooks/useFormValidation.ts
import { useMemo } from 'react';

export function useFormValidation(email: string, password: string) {
  return useMemo(() => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 8;
    
    return {
      emailValid,
      passwordValid,
      formValid: emailValid && passwordValid,
      emailError: emailValid ? null : 'Invalid email address',
      passwordError: passwordValid ? null : 'Password must be at least 8 characters'
    };
  }, [email, password]);
}
```

---

## Input/Output Mapping

### Inputs Transformation

| Noodl Pattern | Generated Code |
|---------------|----------------|
| `Inputs.value` | Function parameter |
| `Inputs["my value"]` | Function parameter (camelCased) |
| Dynamic inputs | Destructured object parameter |

```javascript
// Noodl code
const sum = Inputs.a + Inputs.b + Inputs["extra value"];

// Generated
export function calculateSum(a: number, b: number, extraValue: number): number {
  return a + b + extraValue;
}
```

### Outputs Transformation

| Noodl Pattern | Generated Code |
|---------------|----------------|
| `Outputs.result = value` | Return value |
| `Outputs.signal()` | Signal.send() |
| Multiple outputs | Return object |
| Async outputs | Promise or callback |

```javascript
// Noodl code
Outputs.sum = Inputs.a + Inputs.b;
Outputs.product = Inputs.a * Inputs.b;
if (Outputs.sum > 100) {
  Outputs.overflow();
}

// Generated
import { createSignal } from '@nodegx/core';

export const onOverflow = createSignal('onOverflow');

export function calculate(a: number, b: number): { sum: number; product: number } {
  const sum = a + b;
  const product = a * b;
  
  if (sum > 100) {
    onOverflow.send();
  }
  
  return { sum, product };
}
```

---

## Expression Node Transformation

### Simple Expressions

```javascript
// Noodl Expression
Inputs.price * Inputs.quantity * (1 - Inputs.discount)

// Generated (inline)
const total = price * quantity * (1 - discount);

// Or with useMemo if used in render
const total = useMemo(
  () => price * quantity * (1 - discount),
  [price, quantity, discount]
);
```

### Expressions with Noodl Globals

```javascript
// Noodl Expression
Noodl.Variables.taxRate * Inputs.subtotal

// Generated
import { useVariable } from '@nodegx/core';
import { taxRateVar } from '../stores/variables';

// In component
const [taxRate] = useVariable(taxRateVar);
const tax = taxRate * subtotal;
```

### Complex Expressions

```javascript
// Noodl Expression
Noodl.Variables.isLoggedIn 
  ? `Welcome, ${Noodl.Objects.currentUser.name}!` 
  : "Please log in"

// Generated
import { useVariable, useObject } from '@nodegx/core';
import { isLoggedInVar } from '../stores/variables';
import { currentUserObj } from '../stores/objects';

// In component
const [isLoggedIn] = useVariable(isLoggedInVar);
const currentUser = useObject(currentUserObj);

const greeting = isLoggedIn 
  ? `Welcome, ${currentUser.name}!` 
  : "Please log in";
```

---

## Logic Nodes Transformation

### Condition Node

```
┌──────────┐
│ Condition│
│ value ─○─┼──▶ True Path
│          │──▶ False Path
└──────────┘
```

**Generated Code:**
```typescript
// As inline conditional
{value ? <TrueComponent /> : <FalseComponent />}

// As conditional render
if (condition) {
  return <TrueComponent />;
}
return <FalseComponent />;

// As signal routing
if (condition) {
  onTruePath.send();
} else {
  onFalsePath.send();
}
```

### Switch Node

```
┌──────────┐
│  Switch  │
│ value ─○─┼──▶ case "a"
│          │──▶ case "b"
│          │──▶ case "c"
│          │──▶ default
└──────────┘
```

**Generated Code:**
```typescript
// As switch statement
function handleSwitch(value: string) {
  switch (value) {
    case 'a':
      handleCaseA();
      break;
    case 'b':
      handleCaseB();
      break;
    case 'c':
      handleCaseC();
      break;
    default:
      handleDefault();
  }
}

// As object lookup (often cleaner)
const handlers: Record<string, () => void> = {
  a: handleCaseA,
  b: handleCaseB,
  c: handleCaseC
};
(handlers[value] || handleDefault)();

// As component mapping
const components: Record<string, React.ComponentType> = {
  a: ComponentA,
  b: ComponentB,
  c: ComponentC
};
const Component = components[value] || DefaultComponent;
return <Component />;
```

### Boolean Logic Nodes (And, Or, Not)

```
┌───┐        ┌───┐
│ A │──┐     │   │
└───┘  ├────▶│AND│──▶ Result
┌───┐  │     │   │
│ B │──┘     └───┘
└───┘
```

**Generated Code:**
```typescript
// Simple cases - inline operators
const result = a && b;
const result = a || b;
const result = !a;

// Complex cases - named function
function checkConditions(
  isLoggedIn: boolean,
  hasPermission: boolean,
  isEnabled: boolean
): boolean {
  return isLoggedIn && hasPermission && isEnabled;
}

// As useMemo when dependent on state
const canProceed = useMemo(
  () => isLoggedIn && hasPermission && isEnabled,
  [isLoggedIn, hasPermission, isEnabled]
);
```

### Inverter Node

```typescript
// Simply negates the input
const inverted = !value;
```

---

## States Node Transformation

The States node is a simple state machine. See CODE-001 for the `createStateMachine` primitive.

**Noodl States Node:**
```json
{
  "type": "States",
  "parameters": {
    "states": ["idle", "loading", "success", "error"],
    "startState": "idle",
    "values": {
      "idle": { "opacity": 1, "message": "" },
      "loading": { "opacity": 0.5, "message": "Loading..." },
      "success": { "opacity": 1, "message": "Done!" },
      "error": { "opacity": 1, "message": "Error occurred" }
    }
  }
}
```

**Generated Code:**
```typescript
// stores/stateMachines.ts
import { createStateMachine } from '@nodegx/core';

export type FormState = 'idle' | 'loading' | 'success' | 'error';

export const formStateMachine = createStateMachine<FormState>({
  states: ['idle', 'loading', 'success', 'error'],
  initial: 'idle',
  values: {
    idle: { opacity: 1, message: '' },
    loading: { opacity: 0.5, message: 'Loading...' },
    success: { opacity: 1, message: 'Done!' },
    error: { opacity: 1, message: 'Error occurred' }
  }
});

// In component
import { useStateMachine, useStateValues } from '@nodegx/core';
import { formStateMachine } from '../stores/stateMachines';

function SubmitButton() {
  const [state, goTo] = useStateMachine(formStateMachine);
  const values = useStateValues(formStateMachine);
  
  const handleClick = async () => {
    goTo('loading');
    try {
      await submitForm();
      goTo('success');
    } catch {
      goTo('error');
    }
  };
  
  return (
    <button 
      onClick={handleClick}
      disabled={state === 'loading'}
      style={{ opacity: values.opacity }}
    >
      {state === 'loading' ? values.message : 'Submit'}
    </button>
  );
}
```

---

## Timing Nodes

### Delay Node

```typescript
// Noodl: Delay node with 500ms
// Generated:
import { useCallback, useRef, useEffect } from 'react';

function useDelay(callback: () => void, ms: number) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const trigger = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, ms);
  }, [callback, ms]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return trigger;
}

// Usage
const delayedAction = useDelay(() => {
  console.log('Delayed!');
}, 500);
```

### Debounce Node

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}
```

### Counter Node

```typescript
// stores/counters.ts (or inline)
import { createVariable } from '@nodegx/core';

export const clickCounter = createVariable('clickCounter', 0);

// Usage
import { useVariable } from '@nodegx/core';

function Counter() {
  const [count, setCount] = useVariable(clickCounter);
  
  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);
  const reset = () => setCount(0);
  
  return (
    <div>
      <span>{count}</span>
      <button onClick={decrement}>-</button>
      <button onClick={increment}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

---

## Data Transformation Nodes

### String Format Node

```typescript
// Noodl String Format: "Hello, {name}! You have {count} messages."
// Generated:
function formatGreeting(name: string, count: number): string {
  return `Hello, ${name}! You have ${count} messages.`;
}
```

### Date/Time Nodes

```typescript
// Date Format node
import { format, parseISO } from 'date-fns';

function formatDate(date: string | Date, formatString: string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatString);
}

// Example usage
formatDate('2024-01-15', 'MMM d, yyyy'); // "Jan 15, 2024"
```

### Number Format Node

```typescript
function formatNumber(
  value: number,
  options: {
    decimals?: number;
    thousandsSeparator?: boolean;
    prefix?: string;
    suffix?: string;
  } = {}
): string {
  const { decimals = 2, thousandsSeparator = true, prefix = '', suffix = '' } = options;
  
  let formatted = value.toFixed(decimals);
  
  if (thousandsSeparator) {
    formatted = parseFloat(formatted).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  return `${prefix}${formatted}${suffix}`;
}

// Examples
formatNumber(1234.5, { prefix: '$' }); // "$1,234.50"
formatNumber(0.15, { suffix: '%', decimals: 0 }); // "15%"
```

---

## Connection Flow Analysis

The code generator must analyze the data flow graph to determine:

1. **Execution Order** - Which nodes depend on which
2. **Reactivity Boundaries** - Where to use hooks vs pure functions
3. **Side Effect Isolation** - Keep side effects in event handlers

```typescript
interface ConnectionAnalysis {
  // Nodes that feed into this node
  dependencies: string[];
  
  // Nodes that consume this node's output
  dependents: string[];
  
  // Whether this node has side effects
  hasSideEffects: boolean;
  
  // Whether this is part of a reactive chain
  isReactive: boolean;
  
  // Suggested generation pattern
  pattern: 'inline' | 'function' | 'hook' | 'effect';
}

function analyzeConnectionFlow(
  nodes: NoodlNode[],
  connections: NoodlConnection[]
): Map<string, ConnectionAnalysis> {
  const analysis = new Map<string, ConnectionAnalysis>();
  
  for (const node of nodes) {
    // Find all connections to this node
    const incomingConnections = connections.filter(c => c.targetId === node.id);
    const outgoingConnections = connections.filter(c => c.sourceId === node.id);
    
    const dependencies = [...new Set(incomingConnections.map(c => c.sourceId))];
    const dependents = [...new Set(outgoingConnections.map(c => c.targetId))];
    
    // Determine if this has side effects
    const hasSideEffects = 
      node.type === 'Function' && containsSideEffects(node.parameters.code) ||
      node.type.includes('Set') ||
      node.type.includes('Send') ||
      node.type.includes('Navigate');
    
    // Determine if reactive (depends on Variables/Objects/Arrays)
    const isReactive = dependencies.some(depId => {
      const depNode = nodes.find(n => n.id === depId);
      return depNode && isReactiveNode(depNode);
    });
    
    // Suggest pattern
    let pattern: 'inline' | 'function' | 'hook' | 'effect' = 'inline';
    if (hasSideEffects) {
      pattern = 'effect';
    } else if (isReactive) {
      pattern = 'hook';
    } else if (node.type === 'Function' || dependencies.length > 2) {
      pattern = 'function';
    }
    
    analysis.set(node.id, {
      dependencies,
      dependents,
      hasSideEffects,
      isReactive,
      pattern
    });
  }
  
  return analysis;
}
```

---

## Code Generation Algorithm

```typescript
async function generateLogicCode(
  node: NoodlNode,
  connections: NoodlConnection[],
  analysis: ConnectionAnalysis,
  outputDir: string
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];
  
  switch (node.type) {
    case 'Function':
    case 'Javascript2':
      files.push(...generateFunctionNode(node, analysis));
      break;
      
    case 'Expression':
      files.push(...generateExpressionNode(node, analysis));
      break;
      
    case 'Condition':
      files.push(...generateConditionNode(node, analysis));
      break;
      
    case 'Switch':
      files.push(...generateSwitchNode(node, analysis));
      break;
      
    case 'States':
      files.push(...generateStatesNode(node, analysis));
      break;
      
    case 'And':
    case 'Or':
    case 'Not':
      // Usually inlined, but generate helper if complex
      if (analysis.dependents.length > 1) {
        files.push(...generateBooleanLogicNode(node, analysis));
      }
      break;
      
    case 'Delay':
    case 'Debounce':
      files.push(...generateTimingNode(node, analysis));
      break;
  }
  
  return files;
}
```

---

## Testing Checklist

### Function Node Tests

- [ ] Simple function transforms correctly
- [ ] Multiple inputs handled
- [ ] Multiple outputs return object
- [ ] Signals generate createSignal
- [ ] Async functions preserve async/await
- [ ] Error handling preserved

### Expression Tests

- [ ] Math expressions evaluate correctly
- [ ] String templates work
- [ ] Noodl.Variables access works
- [ ] Noodl.Objects access works
- [ ] Complex ternaries work

### Logic Node Tests

- [ ] Condition branches correctly
- [ ] Switch cases all handled
- [ ] Boolean operators combine correctly
- [ ] States machine transitions work
- [ ] Timing nodes delay/debounce correctly

### Integration Tests

- [ ] Data flows through connected nodes
- [ ] Reactive updates propagate
- [ ] Side effects trigger correctly
- [ ] No circular dependencies generated

---

## Success Criteria

1. **Behavioral Parity** - Logic executes identically to Noodl runtime
2. **Clean Code** - Generated functions are readable and well-named
3. **Type Safety** - Proper TypeScript types inferred/generated
4. **Testable** - Generated functions can be unit tested
5. **No Runtime Errors** - No undefined references or type mismatches
