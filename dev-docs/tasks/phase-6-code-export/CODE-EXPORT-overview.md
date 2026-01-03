# CODE-EXPORT: React Code Export System

## Overview

A comprehensive code export system that transforms Nodegx (Noodl) projects into clean, maintainable React 19 applications. Unlike a simple "eject with TODOs" approach, this system generates **fully functional code** by including a small companion library (`@nodegx/core`) that provides Noodl-like reactive primitives.

**Phase:** Future (Post Phase 3)  
**Total Estimated Effort:** 12-16 weeks  
**Strategic Value:** Very High - eliminates vendor lock-in concern

---

## Philosophy: The Companion Library Approach

### The Problem with Pure Code Export

A naive code export faces a fundamental paradigm mismatch:

| Noodl Model | React Model | Challenge |
|-------------|-------------|-----------|
| Push-based signals | Pull-based rendering | Signals → useEffect chains |
| Global Variables | Component state | Cross-component sync |
| Observable Objects | Plain objects | Change detection |
| Event propagation | Props/callbacks | Parent/child/sibling events |
| Visual states | CSS + useState | Animation transitions |

Attempting to mechanically translate every pattern results in either:
- **Unreadable code** (nested useEffect chains)
- **TODO comments** (giving up on hard parts)

### The Solution: @nodegx/core

Instead of fighting React's model, we provide a **tiny runtime library (~8KB)** that preserves Noodl's mental model while generating idiomatic code:

```
┌─────────────────────────────────────────────────────────────────┐
│                      project.json                                │
│                  (Noodl Node Graph)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Code Generator                               │
│  • Analyze component graph                                      │
│  • Identify state boundaries                                    │
│  • Generate React components                                    │
│  • Preserve Function node code                                  │
│  • Wire up reactive primitives                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Generated Project                              │
│                                                                 │
│  my-app/                                                        │
│  ├── src/                                                       │
│  │   ├── components/        ← Clean React components            │
│  │   ├── stores/            ← From Variables/Objects/Arrays     │
│  │   ├── logic/             ← Extracted Function node code      │
│  │   ├── events/            ← Event channel definitions         │
│  │   └── App.tsx            ← Root with routing                 │
│  ├── package.json           ← Depends on @nodegx/core           │
│  └── vite.config.ts         ← Modern build setup                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Series

| Task | Name | Effort | Description |
|------|------|--------|-------------|
| CODE-001 | @nodegx/core Library | 2-3 weeks | Companion runtime library |
| CODE-002 | Visual Node Generator | 1-2 weeks | UI components + styling |
| CODE-003 | State Store Generator | 1-2 weeks | Variables, Objects, Arrays |
| CODE-004 | Logic Node Generator | 2-3 weeks | Functions, Expressions, Logic |
| CODE-005 | Event System Generator | 1-2 weeks | Send/Receive Event, Component scope |
| CODE-006 | Project Scaffolding | 1-2 weeks | Routing, entry point, build config |
| CODE-007 | CLI & Integration | 1-2 weeks | Export command, editor integration |

**Total: 12-16 weeks**

---

## Noodl Feature → Generated Code Mapping

### Visual Nodes

| Noodl Node | Generated Code |
|------------|----------------|
| Group | `<div>` with Flexbox/CSS |
| Text | `<span>` / `<p>` with text binding |
| Image | `<img>` with src binding |
| Button | `<button>` with onClick |
| TextInput | `<input>` with onChange + controlled value |
| Checkbox | `<input type="checkbox">` |
| Repeater | `{array.map(item => <Component key={item.id} />)}` |
| Page Router | React Router `<Routes>` + `<Route>` |
| Page | Route component |
| Component Children | `{children}` prop |

### State & Data Nodes

| Noodl Node | Generated Code |
|------------|----------------|
| Variable | `createVariable()` from @nodegx/core |
| Set Variable | `variable.set(value)` |
| Object | `createObject()` with Proxy |
| Set Object Properties | `object.set(key, value)` |
| Array | `createArray()` reactive array |
| Static Array | Plain `const array = [...]` |
| Insert Into Array | `array.push()` / `array.insert()` |
| Remove From Array | `array.remove()` / `array.filter()` |
| Array Filter | `useArrayFilter(array, predicate)` |
| Array Map | `useArrayMap(array, transform)` |

### Logic Nodes

| Noodl Node | Generated Code |
|------------|----------------|
| Function | Extracted function in `/logic/` |
| Expression | Inline expression or `useMemo` |
| Condition | Ternary or `if` statement |
| Switch | `switch` statement or object lookup |
| And / Or / Not | `&&` / `||` / `!` operators |
| States | State machine using `createStateMachine()` |
| Delay | `setTimeout` wrapped in cleanup |
| Debounce | `useDebouncedValue()` hook |

### Event & Communication Nodes

| Noodl Node | Generated Code |
|------------|----------------|
| Send Event | `events.emit(channel, data)` |
| Receive Event | `useEvent(channel, handler)` |
| Component Inputs | Component props |
| Component Outputs | Callback props |
| Navigate | `useNavigate()` from React Router |

### Component Scope Nodes

| Noodl Node | Generated Code |
|------------|----------------|
| Component Object | `useComponentStore()` hook |
| Parent Component Object | `useParentStore()` with context |
| Repeater Object | `item` from map callback |
| For Each Item | `item` from map callback |

---

## Architecture Decision Records

### ADR-001: Companion Library vs Pure Export

**Decision:** Include @nodegx/core companion library

**Rationale:**
- Preserves Noodl's mental model (easier for users to understand)
- Generates cleaner, more maintainable code
- Avoids useEffect spaghetti
- Library is small (~8KB) and tree-shakeable
- Enables future multi-framework support (same primitives, different renderers)

**Trade-offs:**
- Still has a "runtime" dependency
- Not 100% "pure React"

### ADR-002: Code Generator Architecture

**Decision:** AST-based generation with templates

**Approach:**
1. Parse project.json into intermediate representation (IR)
2. Analyze component boundaries and dependencies
3. Generate TypeScript AST using ts-morph
4. Apply formatting with Prettier
5. Write files to output directory

**Why AST over string templates:**
- Type-safe code generation
- Automatic import management
- Easier to maintain and extend
- Better handling of edge cases

### ADR-003: Styling Approach

**Decision:** CSS Modules by default, Tailwind optional

**Options considered:**
- Inline styles (what Noodl uses internally)
- CSS Modules (clean separation)
- Tailwind CSS (utility-first)
- Styled Components (CSS-in-JS)

**Rationale:**
- CSS Modules work everywhere, no build config needed
- Easy to migrate to other approaches
- Tailwind can be enabled as an option for users who prefer it

---

## Success Criteria

### Functional Requirements

1. **Visual Parity** - Exported app looks identical to Noodl preview
2. **Behavioral Parity** - All interactions work the same
3. **Data Flow Parity** - State changes propagate correctly
4. **Event Parity** - Events trigger correct handlers

### Code Quality Requirements

1. **Readable** - A React developer can understand the code
2. **Maintainable** - Code follows React best practices
3. **Typed** - Full TypeScript with proper types
4. **Formatted** - Consistent code style (Prettier)
5. **Organized** - Logical file structure

### Performance Requirements

1. **Bundle Size** - @nodegx/core adds < 10KB gzipped
2. **Runtime Performance** - No worse than hand-written React
3. **Build Time** - Export completes in < 30 seconds for typical project

---

## Out of Scope (Phase 1)

The following are explicitly NOT included in the initial implementation:

1. **Database/Cloud nodes** - Query Records, Cloud Functions (placeholder stubs)
2. **Round-trip editing** - Cannot re-import exported code
3. **Framework targets** - Only React 19 initially
4. **Native targets** - No React Native export yet
5. **SSR/SSG** - Client-side only initially

---

## Related Documents

- [CODE-001: @nodegx/core Library](./CODE-001-nodegx-core-library.md)
- [CODE-002: Visual Node Generator](./CODE-002-visual-node-generator.md)
- [CODE-003: State Store Generator](./CODE-003-state-store-generator.md)
- [CODE-004: Logic Node Generator](./CODE-004-logic-node-generator.md)
- [CODE-005: Event System Generator](./CODE-005-event-system-generator.md)
- [CODE-006: Project Scaffolding](./CODE-006-project-scaffolding.md)

---

## Appendix: What This Enables

### Use Cases

1. **Prototype → Production Handoff**
   - Build MVP in Nodegx
   - Validate with users
   - Export for engineering team

2. **Outgrowing Low-Code**
   - Project needs custom functionality
   - Export and continue in code

3. **Learning Tool**
   - See how visual designs become code
   - Learn React patterns

4. **Component Libraries**
   - Build UI components visually
   - Export for use in other projects

5. **Hybrid Development**
   - Design system in Nodegx
   - Export components
   - Use in larger codebase

### Strategic Benefits

1. **Eliminates vendor lock-in** - Users can always leave
2. **Builds trust** - Transparent about what Nodegx does
3. **Enables enterprise adoption** - IT teams can audit code
4. **Creates evangelists** - Exported code spreads Nodegx patterns
