# CODE-REFERENCE: Noodl Node Export Reference

## Overview

This document provides a comprehensive reference for how each Noodl-specific node type transforms into generated React code. This is the definitive guide for implementing the code generator.

---

## Table of Contents

1. [State Nodes](#state-nodes)
2. [Component Scope Nodes](#component-scope-nodes)
3. [Event Nodes](#event-nodes)
4. [Logic Nodes](#logic-nodes)
5. [Visual Container Nodes](#visual-container-nodes)
6. [Data Manipulation Nodes](#data-manipulation-nodes)
7. [Navigation Nodes](#navigation-nodes)
8. [Utility Nodes](#utility-nodes)

---

## State Nodes

### Variable / String / Number / Boolean / Color

**Purpose:** Global reactive values that can be read/written from anywhere.

**Noodl Pattern:**
```
┌──────────────┐
│   Variable   │
│ name: "foo"  │──○ Value
│ value: 123   │
└──────────────┘
```

**Generated Code:**
```typescript
// stores/variables.ts
import { createVariable } from '@nodegx/core';

export const fooVar = createVariable<number>('foo', 123);

// Usage in component
import { useVariable } from '@nodegx/core';
import { fooVar } from '../stores/variables';

function MyComponent() {
  const [foo, setFoo] = useVariable(fooVar);
  return <span>{foo}</span>;
}

// Usage in logic
import { getVariable, setVariable } from '@nodegx/core';
import { fooVar } from '../stores/variables';

function updateFoo(newValue: number) {
  setVariable(fooVar, newValue);
}
```

---

### Set Variable

**Purpose:** Updates a Variable's value.

**Noodl Pattern:**
```
┌───────────────────┐
│   Set Variable    │
│ name: "foo"       │
│─○ Value           │
│─○ Do              │──○ Done
└───────────────────┘
```

**Generated Code:**
```typescript
// Inline in component
import { fooVar } from '../stores/variables';

<button onClick={() => fooVar.set(newValue)}>
  Update
</button>

// Or via hook
const [, setFoo] = useVariable(fooVar);
<button onClick={() => setFoo(newValue)}>
  Update
</button>
```

---

### Object

**Purpose:** Read properties from a reactive object by ID.

**Noodl Pattern:**
```
┌────────────────┐
│     Object     │
│ id: "user"     │──○ name
│                │──○ email
│                │──○ avatar
└────────────────┘
```

**Generated Code:**
```typescript
// stores/objects.ts
import { createObject } from '@nodegx/core';

export interface User {
  name: string;
  email: string;
  avatar: string;
}

export const userObj = createObject<User>('user', {
  name: '',
  email: '',
  avatar: ''
});

// Usage in component
import { useObject } from '@nodegx/core';
import { userObj } from '../stores/objects';

function UserProfile() {
  const user = useObject(userObj);
  
  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

---

### Set Object Properties

**Purpose:** Updates properties on an Object.

**Noodl Pattern:**
```
┌──────────────────────┐
│  Set Object Props    │
│ id: "user"           │
│─○ name               │
│─○ email              │
│─○ Do                 │──○ Done
└──────────────────────┘
```

**Generated Code:**
```typescript
import { userObj } from '../stores/objects';

// Single property
userObj.set('name', 'John Doe');

// Multiple properties
userObj.setProperties({
  name: 'John Doe',
  email: 'john@example.com'
});

// Replace entire object
userObj.setAll({
  name: 'John Doe',
  email: 'john@example.com',
  avatar: '/avatars/john.jpg'
});
```

---

### Array

**Purpose:** Read from a reactive array by ID.

**Noodl Pattern:**
```
┌──────────────┐
│    Array     │
│ id: "items"  │──○ Items
│              │──○ Count
└──────────────┘
```

**Generated Code:**
```typescript
// stores/arrays.ts
import { createArray } from '@nodegx/core';

export interface Item {
  id: string;
  name: string;
  price: number;
}

export const itemsArray = createArray<Item>('items', []);

// Usage in component
import { useArray } from '@nodegx/core';
import { itemsArray } from '../stores/arrays';

function ItemList() {
  const items = useArray(itemsArray);
  
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}

// Get count
const count = itemsArray.length;
```

---

### Static Array

**Purpose:** Constant array data (not reactive).

**Noodl Pattern:**
```
┌─────────────────────┐
│    Static Array     │
│ items: [{...},...]  │──○ Items
│                     │──○ Count
└─────────────────────┘
```

**Generated Code:**
```typescript
// stores/staticArrays.ts

export interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

export const menuItems: MenuItem[] = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Products', path: '/products', icon: 'box' },
  { label: 'Contact', path: '/contact', icon: 'mail' }
];

// Usage in component
import { menuItems } from '../stores/staticArrays';

function NavMenu() {
  return (
    <nav>
      {menuItems.map(item => (
        <NavLink key={item.path} to={item.path}>
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

---

### States

**Purpose:** Simple state machine with named states and optional values per state.

**Noodl Pattern:**
```
┌──────────────────────┐
│       States         │
│ states: [idle,       │
│   loading, success,  │
│   error]             │
│ start: idle          │
│─○ To Idle            │
│─○ To Loading         │
│─○ To Success         │
│─○ To Error           │──○ State
│                      │──○ At Idle
│                      │──○ At Loading
│                      │──○ opacity (value)
└──────────────────────┘
```

**Generated Code:**
```typescript
// stores/stateMachines.ts
import { createStateMachine } from '@nodegx/core';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export const loadingStateMachine = createStateMachine<LoadingState>({
  states: ['idle', 'loading', 'success', 'error'],
  initial: 'idle',
  values: {
    idle: { opacity: 1, message: '' },
    loading: { opacity: 0.5, message: 'Loading...' },
    success: { opacity: 1, message: 'Complete!' },
    error: { opacity: 1, message: 'Error occurred' }
  }
});

// Usage in component
import { useStateMachine, useStateValues } from '@nodegx/core';
import { loadingStateMachine } from '../stores/stateMachines';

function LoadingButton() {
  const [state, goTo] = useStateMachine(loadingStateMachine);
  const values = useStateValues(loadingStateMachine);
  
  const handleClick = async () => {
    goTo('loading');
    try {
      await doSomething();
      goTo('success');
    } catch {
      goTo('error');
    }
  };
  
  return (
    <button 
      onClick={handleClick}
      style={{ opacity: values.opacity }}
      disabled={state === 'loading'}
    >
      {values.message || 'Submit'}
    </button>
  );
}
```

---

## Component Scope Nodes

### Component Object (Component State)

**Purpose:** State scoped to a component instance. Each instance has its own state.

**Noodl Pattern:**
```
┌────────────────────┐
│  Component Object  │──○ count
│  (Component State) │──○ isOpen
└────────────────────┘
```

**Runtime Behavior:**
- Created when component mounts
- Destroyed when component unmounts
- Isolated per instance

**Generated Code:**
```typescript
// components/Counter.tsx
import { 
  ComponentStoreProvider, 
  useComponentStore, 
  useSetComponentStore 
} from '@nodegx/core';

interface CounterState {
  count: number;
  isOpen: boolean;
}

function CounterInner() {
  const state = useComponentStore<CounterState>();
  const { set } = useSetComponentStore<CounterState>();
  
  return (
    <div>
      <span>{state.count}</span>
      <button onClick={() => set('count', state.count + 1)}>+</button>
      <button onClick={() => set('isOpen', !state.isOpen)}>Toggle</button>
    </div>
  );
}

export function Counter() {
  return (
    <ComponentStoreProvider<CounterState> 
      initialState={{ count: 0, isOpen: false }}
    >
      <CounterInner />
    </ComponentStoreProvider>
  );
}
```

---

### Parent Component Object

**Purpose:** Read the Component Object of the visual parent component.

**Noodl Pattern:**
```
┌──────────────────────────┐
│  Parent Component Object │──○ selectedId
│                          │──○ isExpanded
└──────────────────────────┘
```

**Runtime Behavior:**
- Reads from parent's Component Object
- Read-only (cannot set parent's state directly)
- Updates when parent's state changes

**Generated Code:**
```typescript
// components/ListItem.tsx
import { useParentComponentStore } from '@nodegx/core';

interface ParentListState {
  selectedId: string | null;
  isExpanded: boolean;
}

function ListItem({ id, label }: { id: string; label: string }) {
  const parentState = useParentComponentStore<ParentListState>();
  
  const isSelected = parentState?.selectedId === id;
  const showDetails = parentState?.isExpanded && isSelected;
  
  return (
    <div className={isSelected ? 'selected' : ''}>
      <span>{label}</span>
      {showDetails && <ItemDetails id={id} />}
    </div>
  );
}
```

---

### Component Children

**Purpose:** Slot where child components are rendered.

**Noodl Pattern:**
```
Card Component:
┌──────────────────────┐
│  ┌────────────────┐  │
│  │    Header      │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ [Component     │  │
│  │   Children]    │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │    Footer      │  │
│  └────────────────┘  │
└──────────────────────┘
```

**Generated Code:**
```typescript
// components/Card.tsx
import styles from './Card.module.css';

interface CardProps {
  children?: React.ReactNode;
  title?: string;
}

export function Card({ children, title }: CardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3>{title}</h3>
      </div>
      <div className={styles.content}>
        {children}
      </div>
      <div className={styles.footer}>
        <span>Card Footer</span>
      </div>
    </div>
  );
}

// Usage
<Card title="My Card">
  <p>This content goes in the children slot</p>
  <Button>Click me</Button>
</Card>
```

---

### For Each / Repeater

**Purpose:** Iterate over an array, rendering a template component for each item.

**Noodl Pattern:**
```
┌───────────────────┐
│     For Each      │
│─○ Items           │
│ template: "Card"  │
└───────────────────┘
```

**Generated Code:**
```typescript
// components/ItemList.tsx
import { useArray, RepeaterItemProvider } from '@nodegx/core';
import { itemsArray } from '../stores/arrays';
import { ItemCard } from './ItemCard';

export function ItemList() {
  const items = useArray(itemsArray);
  
  return (
    <div className="item-list">
      {items.map((item, index) => (
        <RepeaterItemProvider
          key={item.id}
          item={item}
          index={index}
          itemId={`item_${item.id}`}
        >
          <ItemCard />
        </RepeaterItemProvider>
      ))}
    </div>
  );
}

// ItemCard.tsx - the template component
import { useRepeaterItem, useRepeaterIndex } from '@nodegx/core';

interface Item {
  id: string;
  name: string;
  price: number;
}

export function ItemCard() {
  const item = useRepeaterItem<Item>();
  const index = useRepeaterIndex();
  
  return (
    <div className="item-card">
      <span className="index">#{index + 1}</span>
      <h4>{item.name}</h4>
      <span className="price">${item.price}</span>
    </div>
  );
}
```

---

### Repeater Object (For Each Item)

**Purpose:** Access the current item inside a For Each template.

**Noodl Pattern:**
```
Inside For Each template:
┌──────────────────┐
│  Repeater Object │──○ id
│                  │──○ name
│                  │──○ price
└──────────────────┘
```

**Generated Code:**
```typescript
import { useRepeaterItem } from '@nodegx/core';

function ProductCard() {
  const product = useRepeaterItem<Product>();
  
  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
}
```

---

## Event Nodes

### Send Event

**Purpose:** Broadcast an event with optional data.

**Noodl Pattern:**
```
┌─────────────────────┐
│     Send Event      │
│ channel: "refresh"  │
│ mode: "global"      │
│─○ itemId            │
│─○ Send              │
└─────────────────────┘
```

**Generated Code (Global):**
```typescript
// events/channels.ts
import { createEventChannel } from '@nodegx/core';

interface RefreshEvent {
  itemId: string;
}

export const refreshEvent = createEventChannel<RefreshEvent>('refresh');

// Sending
import { refreshEvent } from '../events/channels';

function handleSend(itemId: string) {
  refreshEvent.send({ itemId });
}

<button onClick={() => handleSend('123')}>Refresh</button>
```

**Generated Code (Scoped - Parent/Children/Siblings):**
```typescript
import { useScopedEventSender } from '../events/ComponentEventContext';

function ChildComponent() {
  const { sendToParent } = useScopedEventSender();
  
  return (
    <button onClick={() => sendToParent('itemSelected', { itemId: '123' })}>
      Select
    </button>
  );
}
```

---

### Receive Event

**Purpose:** Listen for events on a channel.

**Noodl Pattern:**
```
┌─────────────────────┐
│   Receive Event     │
│ channel: "refresh"  │──○ itemId
│                     │──○ Received
└─────────────────────┘
```

**Generated Code (Global):**
```typescript
// Using generated hook
import { useRefreshEvent } from '../events/hooks';

function DataPanel() {
  useRefreshEvent((data) => {
    console.log('Refresh requested for:', data.itemId);
    fetchData(data.itemId);
  });
  
  return <div>...</div>;
}

// Or using generic hook
import { useEventChannel } from '../events/hooks';
import { refreshEvent } from '../events/channels';

function DataPanel() {
  useEventChannel(refreshEvent, (data) => {
    fetchData(data.itemId);
  });
  
  return <div>...</div>;
}
```

**Generated Code (Scoped):**
```typescript
import { useScopedEvent } from '../events/ComponentEventContext';

function ParentComponent() {
  useScopedEvent('itemSelected', (data: { itemId: string }) => {
    setSelectedId(data.itemId);
  });
  
  return (
    <ComponentEventProvider>
      <ItemList />
    </ComponentEventProvider>
  );
}
```

---

## Logic Nodes

### Function Node

**Purpose:** Custom JavaScript code with inputs/outputs.

**Noodl Pattern:**
```
┌─────────────────────┐
│      Function       │
│─○ value             │
│─○ multiplier        │──○ result
│─○ Run               │──○ done
│                     │
│ Script:             │
│ const result =      │
│   Inputs.value *    │
│   Inputs.multiplier;│
│ Outputs.result =    │
│   result;           │
│ Outputs.done();     │
└─────────────────────┘
```

**Generated Code:**
```typescript
// logic/mathFunctions.ts
import { createSignal } from '@nodegx/core';

export const onMultiplyDone = createSignal('onMultiplyDone');

export function multiply(value: number, multiplier: number): number {
  const result = value * multiplier;
  onMultiplyDone.send();
  return result;
}

// Usage in component
import { multiply, onMultiplyDone } from '../logic/mathFunctions';
import { useSignal } from '@nodegx/core';

function Calculator() {
  const [result, setResult] = useState(0);
  
  useSignal(onMultiplyDone, () => {
    console.log('Calculation complete!');
  });
  
  const handleCalculate = () => {
    const newResult = multiply(value, multiplier);
    setResult(newResult);
  };
  
  return <button onClick={handleCalculate}>Calculate</button>;
}
```

---

### Expression

**Purpose:** Evaluate a JavaScript expression reactively.

**Noodl Pattern:**
```
┌────────────────────────────────────┐
│           Expression               │
│─○ a                                │
│─○ b                                │──○ result
│                                    │──○ isTrue
│ expression: (a + b) * 2            │──○ isFalse
└────────────────────────────────────┘
```

**Generated Code:**
```typescript
// Simple case - inline
const result = (a + b) * 2;

// With dependencies - useMemo
const result = useMemo(() => (a + b) * 2, [a, b]);

// Accessing Noodl globals
import { useVariable } from '@nodegx/core';
import { taxRateVar, subtotalVar } from '../stores/variables';

function TaxCalculator() {
  const [taxRate] = useVariable(taxRateVar);
  const [subtotal] = useVariable(subtotalVar);
  
  const tax = useMemo(() => subtotal * taxRate, [subtotal, taxRate]);
  
  return <span>Tax: ${tax.toFixed(2)}</span>;
}
```

---

### Condition

**Purpose:** Route execution based on boolean value.

**Generated Code:**
```typescript
// Visual conditional
{isLoggedIn ? <Dashboard /> : <LoginForm />}

// Logic conditional
if (isValid) {
  onSuccess.send();
} else {
  onFailure.send();
}
```

---

### Switch

**Purpose:** Route based on value matching cases.

**Generated Code:**
```typescript
// Component selection
const viewComponents = {
  list: ListView,
  grid: GridView,
  table: TableView
};
const ViewComponent = viewComponents[viewMode] || ListView;
return <ViewComponent items={items} />;

// Action routing
switch (action) {
  case 'save':
    handleSave();
    break;
  case 'delete':
    handleDelete();
    break;
  case 'cancel':
    handleCancel();
    break;
}
```

---

### And / Or / Not

**Purpose:** Boolean logic operations.

**Generated Code:**
```typescript
// And
const canSubmit = isValid && !isLoading && hasPermission;

// Or
const showWarning = hasErrors || isExpired;

// Not
const isDisabled = !isEnabled;

// Combined
const showContent = (isLoggedIn && hasAccess) || isAdmin;
```

---

## Navigation Nodes

### Page Router

**Purpose:** Define application routes.

**Generated Code:**
```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

### Navigate

**Purpose:** Programmatic navigation.

**Generated Code:**
```typescript
import { useNavigate } from 'react-router-dom';

function NavButton({ to }: { to: string }) {
  const navigate = useNavigate();
  
  return (
    <button onClick={() => navigate(to)}>
      Go
    </button>
  );
}

// With parameters
const productId = '123';
navigate(`/products/${productId}`);

// With options
navigate('/login', { replace: true });
```

---

### Page Inputs / Page Outputs

**Purpose:** Pass data to/from pages via route parameters.

**Generated Code:**
```typescript
// Page Inputs (route parameters)
import { useParams, useSearchParams } from 'react-router-dom';

function ProductPage() {
  // URL params (/products/:id)
  const { id } = useParams<{ id: string }>();
  
  // Query params (/products?category=electronics)
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  
  return <div>Product {id} in {category}</div>;
}

// Page Outputs (navigate with state)
navigate('/checkout', { state: { cartItems } });

// Read in target page
import { useLocation } from 'react-router-dom';
const { state } = useLocation();
const cartItems = state?.cartItems;
```

---

## Summary: Quick Reference Table

| Noodl Node | @nodegx/core Primitive | Generated Pattern |
|------------|------------------------|-------------------|
| Variable | `createVariable` | Store + `useVariable` hook |
| Object | `createObject` | Store + `useObject` hook |
| Array | `createArray` | Store + `useArray` hook |
| Static Array | N/A | Constant export |
| States | `createStateMachine` | Store + `useStateMachine` hook |
| Component Object | `ComponentStoreProvider` | Context provider wrapper |
| Parent Component Object | `useParentComponentStore` | Context consumer hook |
| Component Children | N/A | `{children}` prop |
| For Each / Repeater | `RepeaterItemProvider` | `.map()` with context |
| Repeater Object | `useRepeaterItem` | Context consumer hook |
| Send Event (global) | `events.emit` | Event channel |
| Send Event (scoped) | `useScopedEventSender` | Context-based events |
| Receive Event | `useEvent` / hooks | Event subscription |
| Function | N/A | Extracted function |
| Expression | N/A | Inline or `useMemo` |
| Condition | N/A | Ternary / `if` |
| Switch | N/A | `switch` / object lookup |
| And/Or/Not | N/A | `&&` / `||` / `!` |
| Navigate | `useNavigate` | React Router |
| Page Router | `<Routes>` | React Router |
