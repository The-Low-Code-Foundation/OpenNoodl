# CODE-001: @nodegx/core Companion Library

## Overview

The `@nodegx/core` library is a small (~8KB gzipped) runtime that provides Noodl-like reactive primitives for generated React applications. It bridges Noodl's push-based signal model with React's declarative rendering while keeping generated code clean and idiomatic.

**Estimated Effort:** 2-3 weeks  
**Priority:** CRITICAL - Foundation for all other tasks  
**Dependencies:** None  
**Blocks:** All other CODE-* tasks

---

## Design Principles

1. **Minimal** - Only include what's needed, tree-shakeable
2. **Familiar** - React developers should recognize patterns (Zustand-like, Jotai-like)
3. **Debuggable** - Works with React DevTools, clear stack traces
4. **Type-safe** - Full TypeScript with generics
5. **SSR-compatible** - Works with Next.js, Remix (future-proofing)

---

## API Specification

### 1. Variables (Noodl.Variables)

Noodl Variables are global reactive values that trigger updates across all subscribers.

```typescript
// ============================================
// @nodegx/core/variable.ts
// ============================================

import { useSyncExternalStore, useCallback } from 'react';

type Listener = () => void;

export interface Variable<T> {
  /** Get current value */
  get(): T;
  
  /** Set new value, notify all subscribers */
  set(value: T): void;
  
  /** Subscribe to changes */
  subscribe(listener: Listener): () => void;
  
  /** Variable name (for debugging) */
  readonly name: string;
}

// Internal store for all variables
const variableStore = new Map<string, Variable<any>>();

/**
 * Create a reactive variable
 * 
 * @example
 * // stores/variables.ts
 * export const isLoggedIn = createVariable('isLoggedIn', false);
 * export const userName = createVariable('userName', '');
 * 
 * // In component
 * const [loggedIn, setLoggedIn] = useVariable(isLoggedIn);
 */
export function createVariable<T>(name: string, initialValue: T): Variable<T> {
  // Return existing if already created (supports hot reload)
  if (variableStore.has(name)) {
    return variableStore.get(name)!;
  }
  
  let value = initialValue;
  const listeners = new Set<Listener>();
  
  const variable: Variable<T> = {
    name,
    
    get() {
      return value;
    },
    
    set(newValue: T) {
      if (Object.is(value, newValue)) return;
      value = newValue;
      listeners.forEach(listener => listener());
    },
    
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  
  variableStore.set(name, variable);
  return variable;
}

/**
 * React hook for using a variable
 * Returns [value, setter] tuple like useState
 */
export function useVariable<T>(variable: Variable<T>): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    variable.subscribe,
    variable.get,
    variable.get // SSR fallback
  );
  
  const setValue = useCallback((newValue: T) => {
    variable.set(newValue);
  }, [variable]);
  
  return [value, setValue];
}

/**
 * Get variable value outside React (for logic functions)
 */
export function getVariable<T>(variable: Variable<T>): T {
  return variable.get();
}

/**
 * Set variable value outside React (for logic functions)
 */
export function setVariable<T>(variable: Variable<T>, value: T): void {
  variable.set(value);
}

/**
 * Access the global Variables namespace (Noodl.Variables compatibility)
 */
export const Variables = new Proxy({} as Record<string, any>, {
  get(_, name: string) {
    const variable = variableStore.get(name);
    return variable?.get();
  },
  set(_, name: string, value: any) {
    const variable = variableStore.get(name);
    if (variable) {
      variable.set(value);
      return true;
    }
    // Auto-create if doesn't exist
    createVariable(name, value);
    return true;
  }
});
```

### 2. Objects (Noodl.Objects)

Noodl Objects are reactive key-value stores identified by ID, with property-level change tracking.

```typescript
// ============================================
// @nodegx/core/object.ts
// ============================================

import { useSyncExternalStore, useCallback, useMemo } from 'react';

type Listener = () => void;
type PropertyListener = (key: string, value: any, oldValue: any) => void;

export interface ReactiveObject<T extends Record<string, any> = Record<string, any>> {
  /** Object ID */
  readonly id: string;
  
  /** Get entire object data */
  get(): T;
  
  /** Get a specific property */
  getProperty<K extends keyof T>(key: K): T[K];
  
  /** Set a specific property */
  set<K extends keyof T>(key: K, value: T[K]): void;
  
  /** Set multiple properties at once */
  setProperties(props: Partial<T>): void;
  
  /** Replace entire object */
  setAll(data: T): void;
  
  /** Subscribe to any change */
  subscribe(listener: Listener): () => void;
  
  /** Subscribe to specific property changes */
  onPropertyChange(listener: PropertyListener): () => void;
}

// Internal store for all objects
const objectStore = new Map<string, ReactiveObject<any>>();

/**
 * Create or get a reactive object by ID
 * 
 * @example
 * // stores/objects.ts
 * export const currentUser = createObject('currentUser', {
 *   id: '',
 *   name: '',
 *   email: '',
 *   avatar: ''
 * });
 * 
 * // In component
 * const user = useObject(currentUser);
 * console.log(user.name);
 */
export function createObject<T extends Record<string, any>>(
  id: string, 
  initialData: T = {} as T
): ReactiveObject<T> {
  if (objectStore.has(id)) {
    return objectStore.get(id)!;
  }
  
  let data = { ...initialData };
  const listeners = new Set<Listener>();
  const propertyListeners = new Set<PropertyListener>();
  
  const notify = () => {
    listeners.forEach(l => l());
  };
  
  const notifyProperty = (key: string, value: any, oldValue: any) => {
    propertyListeners.forEach(l => l(key, value, oldValue));
    notify();
  };
  
  const obj: ReactiveObject<T> = {
    id,
    
    get() {
      return { ...data };
    },
    
    getProperty<K extends keyof T>(key: K): T[K] {
      return data[key];
    },
    
    set<K extends keyof T>(key: K, value: T[K]) {
      const oldValue = data[key];
      if (Object.is(oldValue, value)) return;
      data = { ...data, [key]: value };
      notifyProperty(key as string, value, oldValue);
    },
    
    setProperties(props: Partial<T>) {
      let changed = false;
      const newData = { ...data };
      
      for (const key in props) {
        if (!Object.is(data[key], props[key])) {
          newData[key] = props[key]!;
          changed = true;
        }
      }
      
      if (changed) {
        data = newData;
        notify();
      }
    },
    
    setAll(newData: T) {
      data = { ...newData };
      notify();
    },
    
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    
    onPropertyChange(listener: PropertyListener) {
      propertyListeners.add(listener);
      return () => propertyListeners.delete(listener);
    }
  };
  
  objectStore.set(id, obj);
  return obj;
}

/**
 * Get an object by ID (creates if doesn't exist)
 */
export function getObject<T extends Record<string, any>>(id: string): ReactiveObject<T> {
  if (!objectStore.has(id)) {
    return createObject<T>(id);
  }
  return objectStore.get(id)!;
}

/**
 * React hook for using an object's full data
 */
export function useObject<T extends Record<string, any>>(
  obj: ReactiveObject<T>
): T {
  return useSyncExternalStore(
    obj.subscribe,
    obj.get,
    obj.get
  );
}

/**
 * React hook for using a single property (more efficient)
 */
export function useObjectProperty<T extends Record<string, any>, K extends keyof T>(
  obj: ReactiveObject<T>,
  key: K
): T[K] {
  const getSnapshot = useCallback(() => obj.getProperty(key), [obj, key]);
  
  return useSyncExternalStore(
    obj.subscribe,
    getSnapshot,
    getSnapshot
  );
}

/**
 * Access the global Objects namespace (Noodl.Objects compatibility)
 */
export const Objects = new Proxy({} as Record<string, any>, {
  get(_, id: string) {
    const obj = getObject(id);
    // Return a proxy that allows property access
    return new Proxy({}, {
      get(_, prop: string) {
        return obj.getProperty(prop);
      },
      set(_, prop: string, value: any) {
        obj.set(prop, value);
        return true;
      }
    });
  },
  set(_, id: string, value: any) {
    if (typeof value === 'object' && value !== null) {
      const obj = getObject(id);
      obj.setAll(value);
    }
    return true;
  }
});
```

### 3. Arrays (Noodl.Arrays)

Noodl Arrays are reactive lists that trigger updates on any modification.

```typescript
// ============================================
// @nodegx/core/array.ts
// ============================================

import { useSyncExternalStore, useCallback, useMemo } from 'react';

type Listener = () => void;

export interface ReactiveArray<T> {
  /** Array ID */
  readonly id: string;
  
  /** Get current array (returns copy) */
  get(): T[];
  
  /** Get item at index */
  at(index: number): T | undefined;
  
  /** Get array length */
  get length(): number;
  
  /** Replace entire array */
  set(items: T[]): void;
  
  /** Add item to end */
  push(...items: T[]): void;
  
  /** Remove and return last item */
  pop(): T | undefined;
  
  /** Add item to beginning */
  unshift(...items: T[]): void;
  
  /** Remove and return first item */
  shift(): T | undefined;
  
  /** Insert at index */
  insert(index: number, ...items: T[]): void;
  
  /** Remove at index */
  removeAt(index: number): T | undefined;
  
  /** Remove item by reference or predicate */
  remove(itemOrPredicate: T | ((item: T) => boolean)): boolean;
  
  /** Clear all items */
  clear(): void;
  
  /** Subscribe to changes */
  subscribe(listener: Listener): () => void;
  
  /** Standard array methods (non-mutating) */
  map<U>(fn: (item: T, index: number) => U): U[];
  filter(fn: (item: T, index: number) => boolean): T[];
  find(fn: (item: T, index: number) => boolean): T | undefined;
  findIndex(fn: (item: T, index: number) => boolean): number;
  some(fn: (item: T, index: number) => boolean): boolean;
  every(fn: (item: T, index: number) => boolean): boolean;
  includes(item: T): boolean;
  indexOf(item: T): number;
}

// Internal store
const arrayStore = new Map<string, ReactiveArray<any>>();

/**
 * Create or get a reactive array by ID
 */
export function createArray<T>(id: string, initialItems: T[] = []): ReactiveArray<T> {
  if (arrayStore.has(id)) {
    return arrayStore.get(id)!;
  }
  
  let items = [...initialItems];
  const listeners = new Set<Listener>();
  
  const notify = () => {
    listeners.forEach(l => l());
  };
  
  const arr: ReactiveArray<T> = {
    id,
    
    get() {
      return [...items];
    },
    
    at(index: number) {
      return items[index];
    },
    
    get length() {
      return items.length;
    },
    
    set(newItems: T[]) {
      items = [...newItems];
      notify();
    },
    
    push(...newItems: T[]) {
      items = [...items, ...newItems];
      notify();
    },
    
    pop() {
      if (items.length === 0) return undefined;
      const item = items[items.length - 1];
      items = items.slice(0, -1);
      notify();
      return item;
    },
    
    unshift(...newItems: T[]) {
      items = [...newItems, ...items];
      notify();
    },
    
    shift() {
      if (items.length === 0) return undefined;
      const item = items[0];
      items = items.slice(1);
      notify();
      return item;
    },
    
    insert(index: number, ...newItems: T[]) {
      items = [...items.slice(0, index), ...newItems, ...items.slice(index)];
      notify();
    },
    
    removeAt(index: number) {
      if (index < 0 || index >= items.length) return undefined;
      const item = items[index];
      items = [...items.slice(0, index), ...items.slice(index + 1)];
      notify();
      return item;
    },
    
    remove(itemOrPredicate: T | ((item: T) => boolean)) {
      const predicate = typeof itemOrPredicate === 'function'
        ? itemOrPredicate as (item: T) => boolean
        : (item: T) => item === itemOrPredicate;
      
      const index = items.findIndex(predicate);
      if (index === -1) return false;
      
      items = [...items.slice(0, index), ...items.slice(index + 1)];
      notify();
      return true;
    },
    
    clear() {
      if (items.length === 0) return;
      items = [];
      notify();
    },
    
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    
    // Non-mutating methods (work on current snapshot)
    map<U>(fn: (item: T, index: number) => U): U[] {
      return items.map(fn);
    },
    
    filter(fn: (item: T, index: number) => boolean): T[] {
      return items.filter(fn);
    },
    
    find(fn: (item: T, index: number) => boolean): T | undefined {
      return items.find(fn);
    },
    
    findIndex(fn: (item: T, index: number) => boolean): number {
      return items.findIndex(fn);
    },
    
    some(fn: (item: T, index: number) => boolean): boolean {
      return items.some(fn);
    },
    
    every(fn: (item: T, index: number) => boolean): boolean {
      return items.every(fn);
    },
    
    includes(item: T): boolean {
      return items.includes(item);
    },
    
    indexOf(item: T): number {
      return items.indexOf(item);
    }
  };
  
  arrayStore.set(id, arr);
  return arr;
}

/**
 * Get array by ID
 */
export function getArray<T>(id: string): ReactiveArray<T> {
  if (!arrayStore.has(id)) {
    return createArray<T>(id);
  }
  return arrayStore.get(id)!;
}

/**
 * React hook for using array items
 */
export function useArray<T>(arr: ReactiveArray<T>): T[] {
  return useSyncExternalStore(
    arr.subscribe,
    arr.get,
    arr.get
  );
}

/**
 * React hook for filtered array (reactive)
 */
export function useFilteredArray<T>(
  arr: ReactiveArray<T>,
  predicate: (item: T) => boolean
): T[] {
  const items = useArray(arr);
  return useMemo(() => items.filter(predicate), [items, predicate]);
}

/**
 * React hook for mapped array (reactive)
 */
export function useMappedArray<T, U>(
  arr: ReactiveArray<T>,
  transform: (item: T) => U
): U[] {
  const items = useArray(arr);
  return useMemo(() => items.map(transform), [items, transform]);
}

/**
 * Access the global Arrays namespace (Noodl.Arrays compatibility)
 */
export const Arrays = new Proxy({} as Record<string, any[]>, {
  get(_, id: string) {
    return getArray(id).get();
  },
  set(_, id: string, value: any[]) {
    if (Array.isArray(value)) {
      getArray(id).set(value);
    }
    return true;
  }
});
```

### 4. Signals (Noodl Signal System)

Noodl uses "signals" for one-shot event triggers that flow through connections.

```typescript
// ============================================
// @nodegx/core/signal.ts
// ============================================

import { useEffect, useRef } from 'react';

type SignalHandler = () => void;

export interface Signal {
  /** Signal name (for debugging) */
  readonly name: string;
  
  /** Send the signal (trigger all handlers) */
  send(): void;
  
  /** Subscribe to signal */
  subscribe(handler: SignalHandler): () => void;
}

/**
 * Create a signal (one-shot event)
 * 
 * @example
 * // In logic file
 * export const onSaveComplete = createSignal('onSaveComplete');
 * 
 * // Sending
 * onSaveComplete.send();
 * 
 * // Receiving in component
 * useSignal(onSaveComplete, () => {
 *   showToast('Saved!');
 * });
 */
export function createSignal(name: string = 'signal'): Signal {
  const handlers = new Set<SignalHandler>();
  
  return {
    name,
    
    send() {
      handlers.forEach(h => h());
    },
    
    subscribe(handler: SignalHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  };
}

/**
 * React hook for responding to signals
 */
export function useSignal(signal: Signal, handler: () => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    return signal.subscribe(() => handlerRef.current());
  }, [signal]);
}

/**
 * Combine multiple signals into one
 */
export function mergeSignals(...signals: Signal[]): Signal {
  const merged = createSignal('merged');
  
  signals.forEach(signal => {
    signal.subscribe(() => merged.send());
  });
  
  return merged;
}
```

### 5. Events (Send Event / Receive Event)

Noodl's event system with channels and propagation modes.

```typescript
// ============================================
// @nodegx/core/events.ts
// ============================================

import { useEffect, useRef, useContext, createContext } from 'react';

type EventHandler<T = any> = (data: T) => void | boolean;

interface EventBus {
  emit<T = any>(channel: string, data?: T): void;
  on<T = any>(channel: string, handler: EventHandler<T>): () => void;
  once<T = any>(channel: string, handler: EventHandler<T>): () => void;
}

// Global event bus
const globalHandlers = new Map<string, Set<EventHandler>>();

/**
 * Global event bus (Noodl.Events compatible)
 */
export const events: EventBus = {
  emit<T = any>(channel: string, data?: T) {
    const handlers = globalHandlers.get(channel);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  },
  
  on<T = any>(channel: string, handler: EventHandler<T>) {
    if (!globalHandlers.has(channel)) {
      globalHandlers.set(channel, new Set());
    }
    globalHandlers.get(channel)!.add(handler);
    
    return () => {
      globalHandlers.get(channel)?.delete(handler);
    };
  },
  
  once<T = any>(channel: string, handler: EventHandler<T>) {
    const wrappedHandler: EventHandler<T> = (data) => {
      unsubscribe();
      handler(data);
    };
    const unsubscribe = events.on(channel, wrappedHandler);
    return unsubscribe;
  }
};

/**
 * React hook for receiving events
 * 
 * @example
 * useEvent('userLoggedIn', (userData) => {
 *   setUser(userData);
 * });
 */
export function useEvent<T = any>(
  channel: string,
  handler: EventHandler<T>
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    return events.on(channel, (data) => handlerRef.current(data));
  }, [channel]);
}

/**
 * Send an event (convenience function)
 */
export function sendEvent<T = any>(channel: string, data?: T): void {
  events.emit(channel, data);
}

// ============================================
// Component-scoped events (parent/children/siblings propagation)
// ============================================

interface ComponentEventContext {
  sendToParent: <T>(channel: string, data?: T) => void;
  sendToChildren: <T>(channel: string, data?: T) => void;
  sendToSiblings: <T>(channel: string, data?: T) => void;
  registerChild: (handlers: Map<string, EventHandler>) => () => void;
}

const ComponentEventContext = createContext<ComponentEventContext | null>(null);

/**
 * Provider for component-scoped events
 * Wraps components that need parent/child event communication
 */
export function ComponentEventProvider({ 
  children,
  onEvent 
}: { 
  children: React.ReactNode;
  onEvent?: (channel: string, data: any) => void;
}) {
  const childHandlersRef = useRef<Set<Map<string, EventHandler>>>(new Set());
  const parentContext = useContext(ComponentEventContext);
  
  const context: ComponentEventContext = {
    sendToParent(channel, data) {
      // First try local handler
      onEvent?.(channel, data);
      // Then propagate up
      parentContext?.sendToParent(channel, data);
    },
    
    sendToChildren(channel, data) {
      childHandlersRef.current.forEach(handlers => {
        const handler = handlers.get(channel);
        handler?.(data);
      });
    },
    
    sendToSiblings(channel, data) {
      parentContext?.sendToChildren(channel, data);
    },
    
    registerChild(handlers) {
      childHandlersRef.current.add(handlers);
      return () => childHandlersRef.current.delete(handlers);
    }
  };
  
  return (
    <ComponentEventContext.Provider value={context}>
      {children}
    </ComponentEventContext.Provider>
  );
}

/**
 * Hook for sending scoped events
 */
export function useScopedEvent() {
  const context = useContext(ComponentEventContext);
  
  return {
    sendToParent: <T,>(channel: string, data?: T) => {
      context?.sendToParent(channel, data);
    },
    sendToChildren: <T,>(channel: string, data?: T) => {
      context?.sendToChildren(channel, data);
    },
    sendToSiblings: <T,>(channel: string, data?: T) => {
      context?.sendToSiblings(channel, data);
    }
  };
}
```

### 6. Component Object (Component State)

Noodl's Component Object provides component-instance-scoped state.

```typescript
// ============================================
// @nodegx/core/component-store.ts
// ============================================

import { createContext, useContext, useRef, useMemo, useSyncExternalStore } from 'react';
import { createObject, ReactiveObject, useObject } from './object';

// Context for component-scoped stores
const ComponentStoreContext = createContext<ReactiveObject | null>(null);
const ParentComponentStoreContext = createContext<ReactiveObject | null>(null);

/**
 * Provider for component-scoped store
 * 
 * @example
 * // Generated component wrapper
 * export function MyComponent({ children }) {
 *   return (
 *     <ComponentStoreProvider initialState={{ count: 0, name: '' }}>
 *       <MyComponentInner>{children}</MyComponentInner>
 *     </ComponentStoreProvider>
 *   );
 * }
 */
export function ComponentStoreProvider<T extends Record<string, any>>({ 
  children,
  initialState = {} as T
}: {
  children: React.ReactNode;
  initialState?: T;
}) {
  // Get current component store (becomes parent for children)
  const currentStore = useContext(ComponentStoreContext);
  
  // Create unique store for this component instance
  const storeRef = useRef<ReactiveObject<T>>();
  if (!storeRef.current) {
    const id = `component_${Math.random().toString(36).slice(2)}`;
    storeRef.current = createObject<T>(id, initialState);
  }
  
  return (
    <ParentComponentStoreContext.Provider value={currentStore}>
      <ComponentStoreContext.Provider value={storeRef.current}>
        {children}
      </ComponentStoreContext.Provider>
    </ParentComponentStoreContext.Provider>
  );
}

/**
 * Hook for accessing component-scoped store (Component Object node)
 */
export function useComponentStore<T extends Record<string, any> = Record<string, any>>(): T {
  const store = useContext(ComponentStoreContext);
  if (!store) {
    throw new Error('useComponentStore must be used within ComponentStoreProvider');
  }
  return useObject(store) as T;
}

/**
 * Hook for accessing parent component's store (Parent Component Object node)
 */
export function useParentComponentStore<T extends Record<string, any> = Record<string, any>>(): T | null {
  const parentStore = useContext(ParentComponentStoreContext);
  
  // Need to conditionally subscribe
  const emptyObj = useMemo(() => ({} as T), []);
  
  const data = useSyncExternalStore(
    parentStore?.subscribe ?? (() => () => {}),
    parentStore ? () => parentStore.get() as T : () => emptyObj,
    parentStore ? () => parentStore.get() as T : () => emptyObj
  );
  
  return parentStore ? data : null;
}

/**
 * Hook for setting component store values
 */
export function useSetComponentStore<T extends Record<string, any>>() {
  const store = useContext(ComponentStoreContext);
  
  return {
    set: <K extends keyof T>(key: K, value: T[K]) => {
      store?.set(key as string, value);
    },
    setAll: (data: Partial<T>) => {
      store?.setProperties(data);
    }
  };
}
```

### 7. States (State Machine)

Noodl's States node provides simple state machine functionality.

```typescript
// ============================================
// @nodegx/core/state-machine.ts
// ============================================

import { useSyncExternalStore, useCallback } from 'react';

type Listener = () => void;

export interface StateMachine<S extends string> {
  /** Current state */
  current(): S;
  
  /** Check if in specific state */
  is(state: S): boolean;
  
  /** Transition to new state */
  goTo(state: S): void;
  
  /** Get all defined states */
  states(): S[];
  
  /** Subscribe to state changes */
  subscribe(listener: Listener): () => void;
  
  /** Get values for current state */
  getValues<T>(): T;
  
  /** Set values for a specific state */
  setStateValues<T>(state: S, values: T): void;
}

interface StateDefinition<S extends string, V> {
  states: S[];
  initial: S;
  values?: Record<S, V>;
}

/**
 * Create a state machine (States node equivalent)
 * 
 * @example
 * export const buttonState = createStateMachine({
 *   states: ['idle', 'hover', 'pressed', 'disabled'],
 *   initial: 'idle',
 *   values: {
 *     idle: { background: '#ccc', scale: 1 },
 *     hover: { background: '#ddd', scale: 1.02 },
 *     pressed: { background: '#bbb', scale: 0.98 },
 *     disabled: { background: '#eee', scale: 1, opacity: 0.5 }
 *   }
 * });
 */
export function createStateMachine<S extends string, V = any>(
  definition: StateDefinition<S, V>
): StateMachine<S> {
  let currentState = definition.initial;
  const listeners = new Set<Listener>();
  const stateValues = { ...definition.values } as Record<S, V>;
  
  const notify = () => {
    listeners.forEach(l => l());
  };
  
  return {
    current() {
      return currentState;
    },
    
    is(state: S) {
      return currentState === state;
    },
    
    goTo(state: S) {
      if (!definition.states.includes(state)) {
        console.warn(`Unknown state: ${state}`);
        return;
      }
      if (currentState === state) return;
      currentState = state;
      notify();
    },
    
    states() {
      return [...definition.states];
    },
    
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    
    getValues<T>(): T {
      return stateValues[currentState] as unknown as T;
    },
    
    setStateValues<T>(state: S, values: T) {
      stateValues[state] = values as unknown as V;
    }
  };
}

/**
 * React hook for using a state machine
 */
export function useStateMachine<S extends string>(
  machine: StateMachine<S>
): [S, (state: S) => void] {
  const state = useSyncExternalStore(
    machine.subscribe,
    machine.current,
    machine.current
  );
  
  const goTo = useCallback((newState: S) => {
    machine.goTo(newState);
  }, [machine]);
  
  return [state, goTo];
}

/**
 * React hook for state machine values (for animations/styling)
 */
export function useStateValues<S extends string, V>(
  machine: StateMachine<S>
): V {
  return useSyncExternalStore(
    machine.subscribe,
    () => machine.getValues<V>(),
    () => machine.getValues<V>()
  );
}
```

### 8. Repeater Support (For Each)

Support for Repeater/For Each node pattern.

```typescript
// ============================================
// @nodegx/core/repeater.ts
// ============================================

import { createContext, useContext } from 'react';
import { ReactiveObject, createObject } from './object';

// Context for repeater item
interface RepeaterItemContext<T = any> {
  item: T;
  index: number;
  itemId: string;
  object: ReactiveObject<T>;
}

const RepeaterContext = createContext<RepeaterItemContext | null>(null);

/**
 * Provider for repeater item context
 * Used internally by generated repeater code
 */
export function RepeaterItemProvider<T extends Record<string, any>>({
  children,
  item,
  index,
  itemId
}: {
  children: React.ReactNode;
  item: T;
  index: number;
  itemId: string;
}) {
  // Create reactive object for this item
  const object = createObject<T>(itemId, item);
  
  return (
    <RepeaterContext.Provider value={{ item, index, itemId, object }}>
      {children}
    </RepeaterContext.Provider>
  );
}

/**
 * Hook for accessing repeater item (Repeater Object / For Each Item)
 */
export function useRepeaterItem<T = any>(): T {
  const context = useContext(RepeaterContext);
  if (!context) {
    throw new Error('useRepeaterItem must be used within a Repeater');
  }
  return context.item;
}

/**
 * Hook for accessing repeater item as reactive object
 */
export function useRepeaterObject<T extends Record<string, any>>(): ReactiveObject<T> {
  const context = useContext(RepeaterContext);
  if (!context) {
    throw new Error('useRepeaterObject must be used within a Repeater');
  }
  return context.object as ReactiveObject<T>;
}

/**
 * Hook for accessing repeater index
 */
export function useRepeaterIndex(): number {
  const context = useContext(RepeaterContext);
  if (!context) {
    throw new Error('useRepeaterIndex must be used within a Repeater');
  }
  return context.index;
}
```

### 9. Main Exports

```typescript
// ============================================
// @nodegx/core/index.ts
// ============================================

// Variables
export {
  createVariable,
  useVariable,
  getVariable,
  setVariable,
  Variables,
  type Variable
} from './variable';

// Objects
export {
  createObject,
  getObject,
  useObject,
  useObjectProperty,
  Objects,
  type ReactiveObject
} from './object';

// Arrays
export {
  createArray,
  getArray,
  useArray,
  useFilteredArray,
  useMappedArray,
  Arrays,
  type ReactiveArray
} from './array';

// Signals
export {
  createSignal,
  useSignal,
  mergeSignals,
  type Signal
} from './signal';

// Events
export {
  events,
  useEvent,
  sendEvent,
  ComponentEventProvider,
  useScopedEvent
} from './events';

// Component Store
export {
  ComponentStoreProvider,
  useComponentStore,
  useParentComponentStore,
  useSetComponentStore
} from './component-store';

// State Machine
export {
  createStateMachine,
  useStateMachine,
  useStateValues,
  type StateMachine
} from './state-machine';

// Repeater
export {
  RepeaterItemProvider,
  useRepeaterItem,
  useRepeaterObject,
  useRepeaterIndex
} from './repeater';

// Noodl-compatible global namespace
export const Noodl = {
  Variables,
  Objects,
  Arrays,
  Events: {
    emit: (channel: string, data?: any) => events.emit(channel, data),
    on: (channel: string, handler: (data: any) => void) => events.on(channel, handler),
    once: (channel: string, handler: (data: any) => void) => events.once(channel, handler)
  }
};
```

---

## Package Configuration

```json
// package.json
{
  "name": "@nodegx/core",
  "version": "0.1.0",
  "description": "Reactive primitives for Nodegx-exported React applications",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "typescript": "^5.0.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0"
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "nodegx",
    "noodl",
    "react",
    "reactive",
    "state-management"
  ],
  "license": "MIT"
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// Example test file: variable.test.ts
import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createVariable, useVariable } from './variable';

describe('createVariable', () => {
  test('creates variable with initial value', () => {
    const counter = createVariable('counter', 0);
    expect(counter.get()).toBe(0);
  });
  
  test('set updates value and notifies subscribers', () => {
    const counter = createVariable('counter2', 0);
    const listener = vi.fn();
    counter.subscribe(listener);
    
    counter.set(5);
    
    expect(counter.get()).toBe(5);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  
  test('does not notify if value unchanged', () => {
    const counter = createVariable('counter3', 0);
    const listener = vi.fn();
    counter.subscribe(listener);
    
    counter.set(0);
    
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useVariable', () => {
  test('returns current value', () => {
    const counter = createVariable('hookTest', 42);
    const { result } = renderHook(() => useVariable(counter));
    
    expect(result.current[0]).toBe(42);
  });
  
  test('updates when variable changes', () => {
    const counter = createVariable('hookTest2', 0);
    const { result } = renderHook(() => useVariable(counter));
    
    act(() => {
      counter.set(10);
    });
    
    expect(result.current[0]).toBe(10);
  });
});
```

### Integration Tests

Test complete flows like:
- Variable → Component → Display
- Event send → Event receive
- Component store → Parent component store access
- Repeater with item updates

---

## Success Criteria

1. **Bundle size** < 10KB gzipped
2. **All primitives** work correctly with React 18/19
3. **SSR compatible** (works with useSyncExternalStore)
4. **TypeScript** - Full type inference
5. **Tests** - >90% coverage
6. **DevTools** - Works with React DevTools
7. **Tree-shakeable** - Unused primitives don't bloat bundle

---

## Future Enhancements (Post v1)

1. **Persistence** - localStorage/sessionStorage sync for Variables
2. **DevTools Extension** - Custom inspector for Nodegx stores
3. **Time Travel** - Undo/redo support for debugging
4. **Middleware** - Logging, persistence, sync plugins
5. **Multi-framework** - Svelte, Vue adapters using same core logic
