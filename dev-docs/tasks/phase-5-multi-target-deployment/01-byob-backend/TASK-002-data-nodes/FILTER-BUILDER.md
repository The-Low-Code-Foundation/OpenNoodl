# Visual Filter Builder Specification

The Visual Filter Builder is the **hero feature** of TASK-002. It transforms the painful experience of writing Directus filter JSON into an intuitive visual interface.

## The Problem

Directus filters require complex nested JSON:

```json
{
  "_and": [
    { "status": { "_eq": "published" } },
    { "author": { "name": { "_contains": "John" } } },
    { "_or": [{ "views": { "_gt": 100 } }, { "featured": { "_eq": true } }] }
  ]
}
```

This is error-prone and requires memorizing operator names.

## The Solution

A visual builder that generates this JSON automatically:

```
┌─────────────────────────────────────────────────────────────────────┐
│ FILTER CONDITIONS                                      [+ Add Rule] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ AND ─────────────────────────────────────────────────────── [×] ─┐
│ │                                                                   │
│ │  [status ▾]       [equals ▾]     [published ▾]         [×]       │
│ │                                                                   │
│ │  [author.name ▾]  [contains ▾]   [John          ]      [×]       │
│ │                                                                   │
│ │  ┌─ OR ───────────────────────────────────────────── [×] ─┐      │
│ │  │  [views ▾]     [greater than ▾] [100    ]       [×]    │      │
│ │  │  [featured ▾]  [equals ▾]       [true ▾]        [×]    │      │
│ │  │  [+ Add Condition]                                     │      │
│ │  └────────────────────────────────────────────────────────┘      │
│ │                                                                   │
│ │  [+ Add Condition]  [+ Add Group]                                 │
│ └───────────────────────────────────────────────────────────────────┘
│                                                                     │
│ ▶ Preview JSON                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Schema-Aware Field Dropdown

Fields populated from cached schema with:

- Nested relation traversal (`author.name`, `category.parent.name`)
- Field type icons
- Smart search/filtering

### 2. Type-Aware Operator Selection

| Field Type | Available Operators                                                          |
| ---------- | ---------------------------------------------------------------------------- |
| String     | equals, not equals, contains, starts with, ends with, is empty, is not empty |
| Number     | equals, not equals, greater than, less than, >=, <=, between                 |
| Boolean    | equals, not equals                                                           |
| Date       | equals, before, after, between, is empty                                     |
| Enum       | equals, not equals, in, not in                                               |
| Relation   | equals (ID), is empty, is not empty                                          |

### 3. Type-Aware Value Input

| Field Type | Value UI                              |
| ---------- | ------------------------------------- |
| String     | Text input                            |
| Number     | Number input with validation          |
| Boolean    | Toggle or dropdown (true/false/null)  |
| Date       | Date picker                           |
| Enum       | Dropdown with schema-defined values   |
| Relation   | Search/select from related collection |

### 4. AND/OR Grouping

- Drag-and-drop reordering
- Unlimited nesting depth
- Visual indentation
- Collapse/expand groups

### 5. JSON Preview

- Toggle to see generated Directus filter
- Syntax highlighted
- Copy button
- Edit JSON directly (advanced mode)

## Data Model

```typescript
interface FilterGroup {
  id: string;
  type: 'and' | 'or';
  conditions: (FilterCondition | FilterGroup)[];
}

interface FilterCondition {
  id: string;
  field: string; // e.g., "status" or "author.name"
  operator: FilterOperator;
  value: any;
}

type FilterOperator =
  | '_eq'
  | '_neq' // equals, not equals
  | '_gt'
  | '_gte' // greater than (or equal)
  | '_lt'
  | '_lte' // less than (or equal)
  | '_contains'
  | '_ncontains'
  | '_starts_with'
  | '_ends_with'
  | '_in'
  | '_nin' // in array, not in array
  | '_null'
  | '_nnull' // is null, is not null
  | '_between'; // between two values
```

## Implementation Approach

### Component Structure

```
FilterBuilder/
├── FilterBuilder.tsx           # Main container
├── FilterBuilder.module.scss
├── FilterGroup.tsx             # AND/OR group (recursive)
├── FilterCondition.tsx         # Single condition row
├── FieldSelector.tsx           # Schema-aware field dropdown
├── OperatorSelector.tsx        # Type-aware operator dropdown
├── ValueInput.tsx              # Type-aware value input
├── JsonPreview.tsx             # Generated JSON preview
└── types.ts                    # TypeScript interfaces
```

### State Management

```typescript
// In the Query Records node property panel
const [filter, setFilter] = useState<FilterGroup>({
  id: 'root',
  type: 'and',
  conditions: []
});

// Convert to Directus format on change
useEffect(() => {
  const directusFilter = convertToDirectusFilter(filter);
  node.setParameter('filter', directusFilter);
}, [filter]);
```

## Directus Filter Conversion

```typescript
function convertToDirectusFilter(group: FilterGroup): object {
  const key = `_${group.type}`; // _and or _or

  const conditions = group.conditions.map((item) => {
    if ('type' in item) {
      // Nested group
      return convertToDirectusFilter(item);
    } else {
      // Single condition
      return convertCondition(item);
    }
  });

  return { [key]: conditions };
}

function convertCondition(cond: FilterCondition): object {
  // Handle nested fields like "author.name"
  const parts = cond.field.split('.');

  let result: any = { [cond.operator]: cond.value };

  // Build nested structure from inside out
  for (let i = parts.length - 1; i >= 0; i--) {
    result = { [parts[i]]: result };
  }

  return result;
}
```

## Success Criteria

- [ ] Users can build filters without knowing Directus JSON syntax
- [ ] Field dropdown shows all fields from schema
- [ ] Nested relations work (author.name)
- [ ] Operators change based on field type
- [ ] Value inputs match field type
- [ ] AND/OR grouping works with nesting
- [ ] Generated JSON is valid Directus filter
- [ ] JSON preview shows the output
