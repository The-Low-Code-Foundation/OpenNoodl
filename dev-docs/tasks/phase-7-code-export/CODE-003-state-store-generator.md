# CODE-003: State Store Generator

## Overview

The State Store Generator creates the reactive state management layer from Noodl's Variable, Object, and Array nodes. It also handles Component Object, Parent Component Object, and Repeater Object patterns. These stores are the backbone of application state in exported code.

**Estimated Effort:** 1-2 weeks  
**Priority:** HIGH  
**Dependencies:** CODE-001 (@nodegx/core)  
**Blocks:** CODE-004 (Logic Node Generator)

---

## Store Types

### 1. Variables (Global Reactive Values)

**Noodl Pattern:**
- Variable nodes create named global values
- Set Variable nodes update them
- Any component can read/write

**Generated Structure:**
```
stores/
├── variables.ts      ← All Variable definitions
└── index.ts          ← Re-exports everything
```

### 2. Objects (Reactive Key-Value Stores)

**Noodl Pattern:**
- Object nodes read from a named object by ID
- Set Object Properties nodes update them
- Can have dynamic property names

**Generated Structure:**
```
stores/
├── objects.ts        ← All Object definitions
└── index.ts
```

### 3. Arrays (Reactive Lists)

**Noodl Pattern:**
- Array nodes read from a named array by ID
- Insert Into Array, Remove From Array modify them
- Static Array nodes are just constants

**Generated Structure:**
```
stores/
├── arrays.ts         ← Reactive Array definitions
├── staticArrays.ts   ← Constant array data
└── index.ts
```

---

## Analysis Phase

Before generating stores, we need to analyze the entire project:

```typescript
interface StoreAnalysis {
  variables: Map<string, VariableInfo>;
  objects: Map<string, ObjectInfo>;
  arrays: Map<string, ArrayInfo>;
  staticArrays: Map<string, StaticArrayInfo>;
  componentStores: Map<string, ComponentStoreInfo>;
}

interface VariableInfo {
  name: string;
  initialValue: any;
  type: 'string' | 'number' | 'boolean' | 'color' | 'any';
  usedInComponents: string[];
  setByComponents: string[];
}

interface ObjectInfo {
  id: string;
  properties: Map<string, PropertyInfo>;
  usedInComponents: string[];
}

interface ArrayInfo {
  id: string;
  itemType: 'object' | 'primitive' | 'mixed';
  sampleItem?: any;
  usedInComponents: string[];
}

function analyzeProjectStores(project: NoodlProject): StoreAnalysis {
  const analysis: StoreAnalysis = {
    variables: new Map(),
    objects: new Map(),
    arrays: new Map(),
    staticArrays: new Map(),
    componentStores: new Map()
  };
  
  // Scan all components for Variable nodes
  for (const component of project.components) {
    for (const node of component.nodes) {
      switch (node.type) {
        case 'Variable':
        case 'String':
        case 'Number':
        case 'Boolean':
        case 'Color':
          analyzeVariableNode(node, component.name, analysis);
          break;
          
        case 'Set Variable':
          analyzeSetVariableNode(node, component.name, analysis);
          break;
          
        case 'Object':
          analyzeObjectNode(node, component.name, analysis);
          break;
          
        case 'Set Object Properties':
          analyzeSetObjectNode(node, component.name, analysis);
          break;
          
        case 'Array':
          analyzeArrayNode(node, component.name, analysis);
          break;
          
        case 'Static Array':
          analyzeStaticArrayNode(node, component.name, analysis);
          break;
          
        case 'net.noodl.ComponentObject':
        case 'Component State':
          analyzeComponentStateNode(node, component.name, analysis);
          break;
      }
    }
  }
  
  return analysis;
}
```

---

## Variable Generation

### Single Variable Nodes

**Noodl Variable Node:**
```json
{
  "type": "Variable",
  "parameters": {
    "name": "isLoggedIn",
    "value": false
  }
}
```

**Generated Code:**
```typescript
// stores/variables.ts
import { createVariable } from '@nodegx/core';

/**
 * User authentication status
 * @used-in LoginForm, Header, ProfilePage
 */
export const isLoggedInVar = createVariable('isLoggedIn', false);
```

### Typed Variable Nodes

**Noodl String Node:**
```json
{
  "type": "String",
  "parameters": {
    "name": "searchQuery",
    "value": ""
  }
}
```

**Generated Code:**
```typescript
// stores/variables.ts
import { createVariable } from '@nodegx/core';

export const searchQueryVar = createVariable<string>('searchQuery', '');
export const itemCountVar = createVariable<number>('itemCount', 0);
export const isDarkModeVar = createVariable<boolean>('isDarkMode', false);
export const primaryColorVar = createVariable<string>('primaryColor', '#3b82f6');
```

### Complete Variables File

```typescript
// stores/variables.ts
import { createVariable, Variable } from '@nodegx/core';

// ============================================
// Authentication
// ============================================

export const isLoggedInVar = createVariable<boolean>('isLoggedIn', false);
export const currentUserIdVar = createVariable<string>('currentUserId', '');
export const authTokenVar = createVariable<string>('authToken', '');

// ============================================
// UI State
// ============================================

export const isDarkModeVar = createVariable<boolean>('isDarkMode', false);
export const sidebarOpenVar = createVariable<boolean>('sidebarOpen', true);
export const activeTabVar = createVariable<string>('activeTab', 'home');

// ============================================
// Search & Filters
// ============================================

export const searchQueryVar = createVariable<string>('searchQuery', '');
export const filterCategoryVar = createVariable<string>('filterCategory', 'all');
export const sortOrderVar = createVariable<'asc' | 'desc'>('sortOrder', 'desc');

// ============================================
// Form State
// ============================================

export const formEmailVar = createVariable<string>('formEmail', '');
export const formPasswordVar = createVariable<string>('formPassword', '');
export const formErrorVar = createVariable<string>('formError', '');

// ============================================
// Type-safe Variable Registry (optional)
// ============================================

export const variables = {
  isLoggedIn: isLoggedInVar,
  currentUserId: currentUserIdVar,
  authToken: authTokenVar,
  isDarkMode: isDarkModeVar,
  sidebarOpen: sidebarOpenVar,
  activeTab: activeTabVar,
  searchQuery: searchQueryVar,
  filterCategory: filterCategoryVar,
  sortOrder: sortOrderVar,
  formEmail: formEmailVar,
  formPassword: formPasswordVar,
  formError: formErrorVar,
} as const;

export type VariableName = keyof typeof variables;
```

---

## Object Generation

### Object Node Analysis

**Noodl Object Node:**
```json
{
  "type": "Object",
  "parameters": {
    "idSource": "explicit",
    "objectId": "currentUser"
  },
  "dynamicports": [
    { "name": "name", "type": "string" },
    { "name": "email", "type": "string" },
    { "name": "avatar", "type": "string" },
    { "name": "role", "type": "string" }
  ]
}
```

**Generated Code:**
```typescript
// stores/objects.ts
import { createObject, ReactiveObject } from '@nodegx/core';

// ============================================
// User Objects
// ============================================

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'user' | 'guest';
}

export const currentUserObj = createObject<CurrentUser>('currentUser', {
  id: '',
  name: '',
  email: '',
  avatar: '',
  role: 'guest'
});

// ============================================
// Settings Objects
// ============================================

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  autoSave: boolean;
}

export const appSettingsObj = createObject<AppSettings>('appSettings', {
  theme: 'system',
  language: 'en',
  notifications: true,
  autoSave: true
});

// ============================================
// Form Data Objects
// ============================================

export interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contactFormObj = createObject<ContactForm>('contactForm', {
  name: '',
  email: '',
  subject: '',
  message: ''
});
```

### Set Object Properties Generation

**Noodl Set Object Properties Node:**
```json
{
  "type": "Set Object Properties",
  "parameters": {
    "idSource": "explicit",
    "objectId": "currentUser"
  },
  "connections": [
    { "from": "loginResult.name", "to": "name" },
    { "from": "loginResult.email", "to": "email" }
  ]
}
```

**Generated Code:**
```typescript
// In component or logic file
import { currentUserObj } from '../stores/objects';

function updateCurrentUser(data: { name: string; email: string }) {
  currentUserObj.set('name', data.name);
  currentUserObj.set('email', data.email);
  
  // Or batch update
  currentUserObj.setProperties({
    name: data.name,
    email: data.email
  });
}
```

---

## Array Generation

### Reactive Arrays

**Noodl Array Node:**
```json
{
  "type": "Array",
  "parameters": {
    "idSource": "explicit",
    "arrayId": "todoItems"
  }
}
```

**Generated Code:**
```typescript
// stores/arrays.ts
import { createArray, ReactiveArray } from '@nodegx/core';

// ============================================
// Todo Items
// ============================================

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export const todoItemsArray = createArray<TodoItem>('todoItems', []);

// ============================================
// Messages
// ============================================

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  read: boolean;
}

export const messagesArray = createArray<Message>('messages', []);

// ============================================
// Search Results
// ============================================

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  score: number;
}

export const searchResultsArray = createArray<SearchResult>('searchResults', []);
```

### Static Arrays

**Noodl Static Array Node:**
```json
{
  "type": "Static Array",
  "parameters": {
    "items": [
      { "label": "Home", "path": "/", "icon": "home" },
      { "label": "Products", "path": "/products", "icon": "box" },
      { "label": "About", "path": "/about", "icon": "info" },
      { "label": "Contact", "path": "/contact", "icon": "mail" }
    ]
  }
}
```

**Generated Code:**
```typescript
// stores/staticArrays.ts

// ============================================
// Navigation Items
// ============================================

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export const navigationItems: NavItem[] = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Products', path: '/products', icon: 'box' },
  { label: 'About', path: '/about', icon: 'info' },
  { label: 'Contact', path: '/contact', icon: 'mail' }
];

// ============================================
// Dropdown Options
// ============================================

export interface SelectOption {
  value: string;
  label: string;
}

export const countryOptions: SelectOption[] = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' }
];

export const categoryOptions: SelectOption[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'books', label: 'Books' }
];
```

### Array Manipulation

**Insert Into Array:**
```typescript
import { todoItemsArray } from '../stores/arrays';

function addTodo(text: string) {
  todoItemsArray.push({
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: new Date().toISOString()
  });
}
```

**Remove From Array:**
```typescript
import { todoItemsArray } from '../stores/arrays';

function removeTodo(id: string) {
  todoItemsArray.remove(item => item.id === id);
}

function clearCompleted() {
  const current = todoItemsArray.get();
  todoItemsArray.set(current.filter(item => !item.completed));
}
```

**Array Filter Node:**
```typescript
// In component
import { useArray, useFilteredArray } from '@nodegx/core';
import { todoItemsArray } from '../stores/arrays';
import { filterStatusVar } from '../stores/variables';

function TodoList() {
  const [filterStatus] = useVariable(filterStatusVar);
  
  const filteredTodos = useFilteredArray(todoItemsArray, (item) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return !item.completed;
    if (filterStatus === 'completed') return item.completed;
    return true;
  });
  
  return (
    <ul>
      {filteredTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

---

## Component Object Generation

### Component Object (Component-Scoped State)

**Noodl Component Object Node:**
- Creates state scoped to a component instance
- Each instance of the component has its own state
- Accessed via `Component.Object` in Function nodes

**Generated Code:**
```typescript
// components/Counter.tsx
import { ComponentStoreProvider, useComponentStore, useSetComponentStore } from '@nodegx/core';

interface CounterState {
  count: number;
  step: number;
}

function CounterInner() {
  const state = useComponentStore<CounterState>();
  const { set } = useSetComponentStore<CounterState>();
  
  return (
    <div>
      <span>{state.count}</span>
      <button onClick={() => set('count', state.count + state.step)}>
        +{state.step}
      </button>
    </div>
  );
}

export function Counter({ initialCount = 0, step = 1 }) {
  return (
    <ComponentStoreProvider initialState={{ count: initialCount, step }}>
      <CounterInner />
    </ComponentStoreProvider>
  );
}
```

### Parent Component Object

**Noodl Parent Component Object Node:**
- Accesses the Component Object of the visual parent
- Used for child-to-parent communication

**Generated Code:**
```typescript
// components/ListItem.tsx
import { useParentComponentStore, useSetComponentStore } from '@nodegx/core';

interface ListState {
  selectedId: string | null;
}

function ListItem({ id, label }: { id: string; label: string }) {
  const parentState = useParentComponentStore<ListState>();
  const isSelected = parentState?.selectedId === id;
  
  // To update parent, we need to communicate via events or callbacks
  // Since Parent Component Object is read-only from children
  
  return (
    <div className={isSelected ? 'selected' : ''}>
      {label}
    </div>
  );
}
```

### Repeater Object (For Each Item)

**Noodl Repeater Object Node:**
- Inside a Repeater/For Each, accesses the current item
- Each iteration gets its own item context

**Generated Code:**
```typescript
// components/UserList.tsx
import { useArray, RepeaterItemProvider, useRepeaterItem } from '@nodegx/core';
import { usersArray } from '../stores/arrays';

function UserCard() {
  const user = useRepeaterItem<User>();
  
  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

export function UserList() {
  const users = useArray(usersArray);
  
  return (
    <div className="user-list">
      {users.map((user, index) => (
        <RepeaterItemProvider
          key={user.id}
          item={user}
          index={index}
          itemId={`user_${user.id}`}
        >
          <UserCard />
        </RepeaterItemProvider>
      ))}
    </div>
  );
}
```

---

## Store Index File

```typescript
// stores/index.ts

// Variables
export * from './variables';

// Objects
export * from './objects';

// Arrays
export * from './arrays';

// Static data
export * from './staticArrays';

// Re-export primitives for convenience
export {
  useVariable,
  useObject,
  useArray,
  useComponentStore,
  useParentComponentStore,
  useRepeaterItem
} from '@nodegx/core';
```

---

## Type Inference

The generator should infer types from:

1. **Explicit type nodes** (String, Number, Boolean)
2. **Initial values** in parameters
3. **Connected node outputs** (if source has type info)
4. **Property panel selections** (enums, colors)

```typescript
function inferVariableType(node: NoodlNode): string {
  // Check explicit type nodes
  if (node.type === 'String') return 'string';
  if (node.type === 'Number') return 'number';
  if (node.type === 'Boolean') return 'boolean';
  if (node.type === 'Color') return 'string'; // Colors are strings
  
  // Check initial value
  const value = node.parameters.value;
  if (value !== undefined) {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'any[]';
    if (typeof value === 'object') return 'Record<string, any>';
  }
  
  // Default to any
  return 'any';
}

function inferObjectType(
  objectId: string,
  nodes: NoodlNode[],
  connections: NoodlConnection[]
): string {
  const properties: Map<string, string> = new Map();
  
  // Find all Object nodes with this ID
  const objectNodes = nodes.filter(
    n => n.type === 'Object' && n.parameters.objectId === objectId
  );
  
  // Collect properties from dynamic ports
  for (const node of objectNodes) {
    if (node.dynamicports) {
      for (const port of node.dynamicports) {
        properties.set(port.name, inferPortType(port));
      }
    }
  }
  
  // Find Set Object Properties nodes
  const setNodes = nodes.filter(
    n => n.type === 'Set Object Properties' && n.parameters.objectId === objectId
  );
  
  // Collect more properties
  for (const node of setNodes) {
    if (node.dynamicports) {
      for (const port of node.dynamicports) {
        properties.set(port.name, inferPortType(port));
      }
    }
  }
  
  // Generate interface
  const props = Array.from(properties.entries())
    .map(([name, type]) => `  ${name}: ${type};`)
    .join('\n');
  
  return `{\n${props}\n}`;
}
```

---

## Testing Checklist

### Variable Tests

- [ ] Variables created with correct initial values
- [ ] Type inference works for all types
- [ ] Set Variable updates propagate
- [ ] Multiple components can read same variable
- [ ] Variables persist across navigation

### Object Tests

- [ ] Objects created with all properties
- [ ] Property types correctly inferred
- [ ] Set Object Properties updates work
- [ ] Dynamic properties handled
- [ ] Object ID sources work (explicit, from variable, from repeater)

### Array Tests

- [ ] Arrays created with correct types
- [ ] Static arrays are constant
- [ ] Insert Into Array adds items
- [ ] Remove From Array removes items
- [ ] Array Filter works reactively
- [ ] Repeater iterates correctly

### Component Store Tests

- [ ] Component Object scoped to instance
- [ ] Parent Component Object reads parent
- [ ] Repeater Object provides item
- [ ] Multiple instances have separate state

---

## Success Criteria

1. **All stores discovered** - No missing variables/objects/arrays
2. **Types inferred** - TypeScript types are accurate
3. **Reactivity works** - Updates propagate correctly
4. **Clean organization** - Logical file structure
5. **Good DX** - Easy to use in components
