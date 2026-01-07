# CODE-005: Event System Generator

## Overview

The Event System Generator transforms Noodl's Send Event and Receive Event nodes into a clean event-driven architecture. It handles global events, component-scoped events, and various propagation modes (parent, children, siblings).

**Estimated Effort:** 1-2 weeks  
**Priority:** MEDIUM  
**Dependencies:** CODE-001 (@nodegx/core)  
**Blocks:** CODE-006 (Project Scaffolding)

---

## Noodl Event Model

### Event Propagation Modes

Noodl supports several propagation modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Global** | All Receive Event nodes with matching channel | App-wide notifications |
| **Parent** | Only parent component hierarchy | Child-to-parent communication |
| **Children** | Only child components | Parent-to-child broadcast |
| **Siblings** | Only sibling components | Peer communication |

### Send Event Node

```json
{
  "type": "Send Event",
  "parameters": {
    "channelName": "userLoggedIn",
    "sendMode": "global"
  },
  "dynamicports": [
    { "name": "userId", "plug": "input" },
    { "name": "userName", "plug": "input" }
  ]
}
```

### Receive Event Node

```json
{
  "type": "Receive Event",
  "parameters": {
    "channelName": "userLoggedIn"
  },
  "dynamicports": [
    { "name": "userId", "plug": "output" },
    { "name": "userName", "plug": "output" }
  ]
}
```

---

## Event Analysis

```typescript
interface EventChannelInfo {
  name: string;
  propagation: 'global' | 'parent' | 'children' | 'siblings';
  dataShape: Record<string, string>; // property name -> type
  senders: Array<{
    componentName: string;
    nodeId: string;
  }>;
  receivers: Array<{
    componentName: string;
    nodeId: string;
  }>;
}

function analyzeEventChannels(project: NoodlProject): Map<string, EventChannelInfo> {
  const channels = new Map<string, EventChannelInfo>();
  
  for (const component of project.components) {
    for (const node of component.nodes) {
      if (node.type === 'Send Event') {
        const channelName = node.parameters.channelName;
        
        if (!channels.has(channelName)) {
          channels.set(channelName, {
            name: channelName,
            propagation: node.parameters.sendMode || 'global',
            dataShape: {},
            senders: [],
            receivers: []
          });
        }
        
        const channel = channels.get(channelName)!;
        channel.senders.push({
          componentName: component.name,
          nodeId: node.id
        });
        
        // Collect data shape from dynamic ports
        for (const port of node.dynamicports || []) {
          if (port.plug === 'input') {
            channel.dataShape[port.name] = inferPortType(port);
          }
        }
      }
      
      if (node.type === 'Receive Event' || node.type === 'Event Receiver') {
        const channelName = node.parameters.channelName;
        
        if (!channels.has(channelName)) {
          channels.set(channelName, {
            name: channelName,
            propagation: 'global',
            dataShape: {},
            senders: [],
            receivers: []
          });
        }
        
        const channel = channels.get(channelName)!;
        channel.receivers.push({
          componentName: component.name,
          nodeId: node.id
        });
        
        // Collect data shape from dynamic ports
        for (const port of node.dynamicports || []) {
          if (port.plug === 'output') {
            channel.dataShape[port.name] = inferPortType(port);
          }
        }
      }
    }
  }
  
  return channels;
}
```

---

## Generated Event Definitions

### Events Type File

```typescript
// events/types.ts

/**
 * Event data types for type-safe event handling
 * Auto-generated from Noodl project
 */

export interface UserLoggedInEvent {
  userId: string;
  userName: string;
  timestamp?: number;
}

export interface ItemAddedEvent {
  itemId: string;
  itemName: string;
  category: string;
}

export interface FormSubmittedEvent {
  formId: string;
  data: Record<string, any>;
  isValid: boolean;
}

export interface NavigationEvent {
  from: string;
  to: string;
  params?: Record<string, string>;
}

export interface NotificationEvent {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// Union type for all events (useful for logging/debugging)
export type AppEvent = 
  | { channel: 'userLoggedIn'; data: UserLoggedInEvent }
  | { channel: 'itemAdded'; data: ItemAddedEvent }
  | { channel: 'formSubmitted'; data: FormSubmittedEvent }
  | { channel: 'navigation'; data: NavigationEvent }
  | { channel: 'notification'; data: NotificationEvent };
```

### Events Channel File

```typescript
// events/channels.ts
import { createSignal } from '@nodegx/core';
import type {
  UserLoggedInEvent,
  ItemAddedEvent,
  FormSubmittedEvent,
  NavigationEvent,
  NotificationEvent
} from './types';

// ============================================
// Global Event Channels
// ============================================

/**
 * Authentication Events
 */
export const userLoggedIn = createEventChannel<UserLoggedInEvent>('userLoggedIn');
export const userLoggedOut = createEventChannel<void>('userLoggedOut');

/**
 * Data Events
 */
export const itemAdded = createEventChannel<ItemAddedEvent>('itemAdded');
export const itemRemoved = createEventChannel<{ itemId: string }>('itemRemoved');
export const dataRefresh = createEventChannel<void>('dataRefresh');

/**
 * Form Events
 */
export const formSubmitted = createEventChannel<FormSubmittedEvent>('formSubmitted');
export const formReset = createEventChannel<{ formId: string }>('formReset');

/**
 * Navigation Events
 */
export const navigation = createEventChannel<NavigationEvent>('navigation');

/**
 * UI Events
 */
export const notification = createEventChannel<NotificationEvent>('notification');
export const modalOpened = createEventChannel<{ modalId: string }>('modalOpened');
export const modalClosed = createEventChannel<{ modalId: string }>('modalClosed');

// ============================================
// Helper: Typed Event Channel
// ============================================

interface EventChannel<T> {
  send: (data: T) => void;
  subscribe: (handler: (data: T) => void) => () => void;
}

function createEventChannel<T>(name: string): EventChannel<T> {
  const handlers = new Set<(data: T) => void>();
  
  return {
    send(data: T) {
      handlers.forEach(h => h(data));
    },
    subscribe(handler: (data: T) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  };
}
```

### Events Hook File

```typescript
// events/hooks.ts
import { useEffect, useRef } from 'react';
import type {
  UserLoggedInEvent,
  ItemAddedEvent,
  FormSubmittedEvent,
  NavigationEvent,
  NotificationEvent
} from './types';
import * as channels from './channels';

/**
 * Hook for receiving userLoggedIn events
 */
export function useUserLoggedIn(handler: (data: UserLoggedInEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    return channels.userLoggedIn.subscribe((data) => handlerRef.current(data));
  }, []);
}

/**
 * Hook for receiving itemAdded events
 */
export function useItemAdded(handler: (data: ItemAddedEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    return channels.itemAdded.subscribe((data) => handlerRef.current(data));
  }, []);
}

/**
 * Hook for receiving notification events
 */
export function useNotification(handler: (data: NotificationEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    return channels.notification.subscribe((data) => handlerRef.current(data));
  }, []);
}

// Generic hook for any event
export function useEventChannel<T>(
  channel: { subscribe: (handler: (data: T) => void) => () => void },
  handler: (data: T) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    return channel.subscribe((data) => handlerRef.current(data));
  }, [channel]);
}
```

---

## Global Events Usage

### Sending Events

**Noodl:**
```
[Button] → click → [Send Event: "itemAdded"]
                    ├─ itemId ← "item-123"
                    ├─ itemName ← "New Item"
                    └─ category ← "electronics"
```

**Generated:**
```typescript
// In component
import { itemAdded } from '../events/channels';

function AddItemButton() {
  const handleClick = () => {
    itemAdded.send({
      itemId: 'item-123',
      itemName: 'New Item',
      category: 'electronics'
    });
  };
  
  return <button onClick={handleClick}>Add Item</button>;
}
```

### Receiving Events

**Noodl:**
```
[Receive Event: "itemAdded"]
├─ itemId → [Text] display
├─ itemName → [Variable] set
└─ received → [Animation] trigger
```

**Generated:**
```typescript
// In component
import { useItemAdded } from '../events/hooks';
import { setVariable } from '@nodegx/core';
import { latestItemNameVar } from '../stores/variables';

function ItemNotification() {
  const [notification, setNotification] = useState<ItemAddedEvent | null>(null);
  
  useItemAdded((data) => {
    setNotification(data);
    setVariable(latestItemNameVar, data.itemName);
    
    // Clear after animation
    setTimeout(() => setNotification(null), 3000);
  });
  
  if (!notification) return null;
  
  return (
    <div className="notification">
      Added: {notification.itemName}
    </div>
  );
}
```

---

## Scoped Events (Parent/Children/Siblings)

For non-global propagation modes, we use React context.

### Component Event Provider

```typescript
// events/ComponentEventContext.tsx
import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

interface ScopedEventHandlers {
  [channel: string]: Array<(data: any) => void>;
}

interface ComponentEventContextValue {
  // Send event to parent
  sendToParent: (channel: string, data: any) => void;
  
  // Send event to children
  sendToChildren: (channel: string, data: any) => void;
  
  // Send event to siblings
  sendToSiblings: (channel: string, data: any) => void;
  
  // Register this component's handlers
  registerHandler: (channel: string, handler: (data: any) => void) => () => void;
  
  // Register child component
  registerChild: (handlers: ScopedEventHandlers) => () => void;
}

const ComponentEventContext = createContext<ComponentEventContextValue | null>(null);

export function ComponentEventProvider({ 
  children,
  onEvent 
}: { 
  children: ReactNode;
  onEvent?: (channel: string, data: any) => void;
}) {
  const parentContext = useContext(ComponentEventContext);
  const childHandlersRef = useRef<Set<ScopedEventHandlers>>(new Set());
  const localHandlersRef = useRef<ScopedEventHandlers>({});
  
  const registerHandler = useCallback((channel: string, handler: (data: any) => void) => {
    if (!localHandlersRef.current[channel]) {
      localHandlersRef.current[channel] = [];
    }
    localHandlersRef.current[channel].push(handler);
    
    return () => {
      const handlers = localHandlersRef.current[channel];
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }, []);
  
  const registerChild = useCallback((handlers: ScopedEventHandlers) => {
    childHandlersRef.current.add(handlers);
    return () => childHandlersRef.current.delete(handlers);
  }, []);
  
  const sendToParent = useCallback((channel: string, data: any) => {
    // Local handler
    onEvent?.(channel, data);
    // Propagate up
    parentContext?.sendToParent(channel, data);
  }, [parentContext, onEvent]);
  
  const sendToChildren = useCallback((channel: string, data: any) => {
    childHandlersRef.current.forEach(childHandlers => {
      const handlers = childHandlers[channel];
      handlers?.forEach(h => h(data));
    });
  }, []);
  
  const sendToSiblings = useCallback((channel: string, data: any) => {
    // Siblings are other children of our parent
    parentContext?.sendToChildren(channel, data);
  }, [parentContext]);
  
  const value: ComponentEventContextValue = {
    sendToParent,
    sendToChildren,
    sendToSiblings,
    registerHandler,
    registerChild
  };
  
  return (
    <ComponentEventContext.Provider value={value}>
      {children}
    </ComponentEventContext.Provider>
  );
}

// Hook for sending scoped events
export function useScopedEventSender() {
  const context = useContext(ComponentEventContext);
  
  return {
    sendToParent: context?.sendToParent ?? (() => {}),
    sendToChildren: context?.sendToChildren ?? (() => {}),
    sendToSiblings: context?.sendToSiblings ?? (() => {})
  };
}

// Hook for receiving scoped events
export function useScopedEvent(
  channel: string,
  handler: (data: any) => void
) {
  const context = useContext(ComponentEventContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  
  useEffect(() => {
    if (!context) return;
    return context.registerHandler(channel, (data) => handlerRef.current(data));
  }, [context, channel]);
}
```

### Usage: Parent-to-Child Event

**Noodl:**
```
[Parent Component]
├─ [Button] → click → [Send Event: "refresh" mode="children"]
└─ [Child Component]
    └─ [Receive Event: "refresh"] → [Fetch Data]
```

**Generated:**
```typescript
// Parent component
import { ComponentEventProvider, useScopedEventSender } from '../events/ComponentEventContext';

function ParentComponent() {
  const { sendToChildren } = useScopedEventSender();
  
  return (
    <ComponentEventProvider>
      <button onClick={() => sendToChildren('refresh', {})}>
        Refresh All
      </button>
      <ChildComponent />
      <ChildComponent />
    </ComponentEventProvider>
  );
}

// Child component
import { useScopedEvent } from '../events/ComponentEventContext';

function ChildComponent() {
  const [data, setData] = useState([]);
  
  useScopedEvent('refresh', () => {
    fetchData().then(setData);
  });
  
  return <div>{/* render data */}</div>;
}
```

### Usage: Child-to-Parent Event

**Noodl:**
```
[Parent Component]
├─ [Receive Event: "itemSelected"] → [Variable: selectedId]
└─ [Child Component]
    └─ [Button] → click → [Send Event: "itemSelected" mode="parent"]
                          └─ itemId ← props.id
```

**Generated:**
```typescript
// Parent component
function ParentComponent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const handleItemSelected = (data: { itemId: string }) => {
    setSelectedId(data.itemId);
  };
  
  return (
    <ComponentEventProvider onEvent={(channel, data) => {
      if (channel === 'itemSelected') {
        handleItemSelected(data);
      }
    }}>
      <ItemList />
      {selectedId && <ItemDetail id={selectedId} />}
    </ComponentEventProvider>
  );
}

// Child component
function ItemList() {
  const items = useArray(itemsArray);
  
  return (
    <div>
      {items.map(item => (
        <ItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const { sendToParent } = useScopedEventSender();
  
  return (
    <div onClick={() => sendToParent('itemSelected', { itemId: item.id })}>
      {item.name}
    </div>
  );
}
```

---

## Event Index File

```typescript
// events/index.ts

// Types
export * from './types';

// Global event channels
export * from './channels';

// Hooks for global events
export * from './hooks';

// Scoped events (parent/children/siblings)
export {
  ComponentEventProvider,
  useScopedEventSender,
  useScopedEvent
} from './ComponentEventContext';

// Re-export from @nodegx/core for convenience
export { sendEvent, useEvent, events } from '@nodegx/core';
```

---

## Testing Checklist

### Global Events

- [ ] Send Event broadcasts to all receivers
- [ ] Receive Event hooks fire correctly
- [ ] Event data is passed correctly
- [ ] Multiple receivers all get notified
- [ ] No memory leaks on unmount

### Scoped Events

- [ ] Parent mode reaches parent only
- [ ] Children mode reaches children only
- [ ] Siblings mode reaches siblings only
- [ ] Nested components work correctly
- [ ] Context providers don't break rendering

### Type Safety

- [ ] Event data is typed correctly
- [ ] TypeScript catches wrong event names
- [ ] TypeScript catches wrong data shapes

---

## Success Criteria

1. **All channels discovered** - Every Send/Receive Event pair found
2. **Type safety** - Full TypeScript support for event data
3. **Propagation parity** - All modes work as in Noodl
4. **Clean API** - Easy to send and receive events
5. **No leaks** - Subscriptions cleaned up properly
