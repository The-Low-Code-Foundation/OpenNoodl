# CODE-008: Node Comments Export

## Overview

Export user-added node comments as code comments in the generated React application. This preserves documentation and context that developers add to their visual graphs, making the exported code more maintainable and self-documenting.

**Estimated Effort:** 2-3 days  
**Priority:** MEDIUM (quality-of-life enhancement)  
**Dependencies:** CODE-002 through CODE-005 (generators must exist)  
**Blocks:** None

---

## Feature Description

Noodl now supports adding comments to individual nodes via a comment button. These plain-text comments explain what a node does, why it's configured a certain way, or document business logic. When exporting to React code, these comments should be preserved as actual code comments.

### User Value

1. **Documentation survives export** - Notes added during visual development aren't lost
2. **Onboarding** - New developers reading exported code understand intent
3. **Maintenance** - Future modifications are guided by original context
4. **Audit trail** - Business logic explanations remain with the code

---

## Comment Sources

### Node-Level Comments (Primary)

Each node stores its comment in the `metadata.comment` field. This is the comment button feature you can click on each node:

**Source:** `NodeGraphNode.ts`
```typescript
// Get the comment text for this node
getComment(): string | undefined {
  return this.metadata?.comment;
}

// Check if this node has a comment
hasComment(): boolean {
  return !!this.metadata?.comment?.trim();
}

// Set or clear the comment for this node
setComment(comment: string | undefined, args?: { undo?: any; label?: any }) {
  if (!this.metadata) this.metadata = {};
  this.metadata.comment = comment?.trim() || undefined;
  this.notifyListeners('commentChanged', { comment: this.metadata.comment });
}
```

**Serialized JSON Structure:**
```json
{
  "id": "function-123",
  "type": "Function",
  "metadata": {
    "comment": "Calculates shipping cost based on weight and destination zone. Uses tiered pricing from the 2024 rate card."
  },
  "parameters": {
    "code": "..."
  }
}
```

### Canvas Comments (Separate System)

The floating comment boxes on the canvas are a **different system** managed by `CommentsModel`. These are stored at the component level, not attached to nodes:

```json
{
  "components": [{
    "name": "MyComponent",
    "nodes": [...],
    "comments": [
      {
        "id": "comment-abc",
        "text": "This section handles authentication",
        "x": 100,
        "y": 200,
        "width": 300,
        "height": 150,
        "fill": "transparent",
        "color": "logic"
      }
    ]
  }]
}
```

**For code export, we focus on node-level comments (`metadata.comment`) since they're directly associated with specific code constructs.**

### Component-Level Comments (Future)

Components themselves could have description metadata:

```json
{
  "name": "CheckoutForm",
  "metadata": {
    "description": "Multi-step checkout flow. Handles payment validation, address verification, and order submission."
  },
  "nodes": [...]
}
```

### Connection Comments (Future)

Potentially, connections between nodes could also have comments explaining data flow:

```json
{
  "sourceId": "api-result",
  "sourcePort": "items",
  "targetId": "repeater",
  "targetPort": "items",
  "metadata": {
    "comment": "Filtered products matching search criteria"
  }
}
```

---

## Output Formats

### Function/Logic Files

```typescript
// logic/calculateShipping.ts

/**
 * Calculates shipping cost based on weight and destination zone.
 * Uses tiered pricing from the 2024 rate card.
 */
export function calculateShipping(weight: number, zone: string): number {
  // ... implementation
}
```

### Component Files

```tsx
// components/CheckoutForm.tsx

/**
 * Multi-step checkout flow.
 * Handles payment validation, address verification, and order submission.
 */
export function CheckoutForm() {
  // ...
}
```

### Inline Comments for Complex Logic

When a node's comment explains a specific piece of logic:

```tsx
function OrderSummary() {
  const items = useArray(cartItemsArray);
  
  // Apply member discount if user has active subscription
  // (Business rule: 15% off for Premium, 10% for Basic)
  const discount = useMemo(() => {
    if (membershipLevel === 'premium') return 0.15;
    if (membershipLevel === 'basic') return 0.10;
    return 0;
  }, [membershipLevel]);
  
  // ...
}
```

### Store Comments

```typescript
// stores/variables.ts

/**
 * Current user's membership level.
 * Determines discount rates and feature access.
 * Set during login, cleared on logout.
 */
export const membershipLevelVar = createVariable<'none' | 'basic' | 'premium'>('membershipLevel', 'none');
```

### Event Channel Comments

```typescript
// events/channels.ts

/**
 * Fired when user completes checkout successfully.
 * Triggers order confirmation email and inventory update.
 */
export const orderCompleted = createEventChannel<OrderCompletedEvent>('orderCompleted');
```

---

## Implementation

### Step 1: Extract Comments During Analysis

```typescript
interface NodeWithMetadata {
  id: string;
  type: string;
  metadata?: {
    comment?: string;
  };
  label?: string;
  parameters?: Record<string, any>;
}

interface CommentInfo {
  nodeId: string;
  nodeType: string;
  nodeName?: string;
  comment: string;
  placement: 'jsdoc' | 'inline' | 'block';
}

function extractNodeComments(nodes: NodeWithMetadata[]): Map<string, CommentInfo> {
  const comments = new Map<string, CommentInfo>();
  
  for (const node of nodes) {
    // Comments are stored in node.metadata.comment
    const comment = node.metadata?.comment;
    
    if (comment && comment.trim()) {
      comments.set(node.id, {
        nodeId: node.id,
        nodeType: node.type,
        nodeName: node.label || node.parameters?.name,
        comment: comment.trim(),
        placement: determineCommentPlacement(node)
      });
    }
  }
  
  return comments;
}

function determineCommentPlacement(node: NodeWithMetadata): 'jsdoc' | 'inline' | 'block' {
  // JSDoc for functions, components, exports
  if (['Function', 'Javascript2', 'Component'].includes(node.type)) {
    return 'jsdoc';
  }
  
  // JSDoc for state stores (Variables, Objects, Arrays)
  if (['Variable', 'String', 'Number', 'Boolean', 'Object', 'Array'].includes(node.type)) {
    return 'jsdoc';
  }
  
  // Inline for simple expressions, conditions
  if (['Expression', 'Condition', 'Switch'].includes(node.type)) {
    return 'inline';
  }
  
  // Block comments for complex logic nodes
  return 'block';
}
```

### Step 2: Format Comments

```typescript
/**
 * Format a comment as JSDoc
 */
function formatAsJSDoc(comment: string): string {
  const lines = comment.split('\n');
  
  if (lines.length === 1) {
    return `/** ${comment} */`;
  }
  
  return [
    '/**',
    ...lines.map(line => ` * ${line}`),
    ' */'
  ].join('\n');
}

/**
 * Format a comment as inline
 */
function formatAsInline(comment: string): string {
  // Single line
  if (!comment.includes('\n') && comment.length < 80) {
    return `// ${comment}`;
  }
  
  // Multi-line
  return comment.split('\n').map(line => `// ${line}`).join('\n');
}

/**
 * Format a comment as block
 */
function formatAsBlock(comment: string): string {
  const lines = comment.split('\n');
  
  if (lines.length === 1) {
    return `/* ${comment} */`;
  }
  
  return [
    '/*',
    ...lines.map(line => ` * ${line}`),
    ' */'
  ].join('\n');
}
```

### Step 3: Inject Comments During Generation

```typescript
// In function generator
function generateFunctionNode(
  node: NoodlNode,
  comments: Map<string, CommentInfo>
): string {
  const comment = comments.get(node.id);
  const functionCode = generateFunctionCode(node);
  
  if (comment) {
    const formattedComment = formatAsJSDoc(comment.comment);
    return `${formattedComment}\n${functionCode}`;
  }
  
  return functionCode;
}

// In component generator
function generateComponent(
  component: NoodlComponent,
  nodeComments: Map<string, CommentInfo>
): string {
  let code = '';
  
  // Component-level comment
  if (component.comment) {
    code += formatAsJSDoc(component.comment) + '\n';
  }
  
  code += `export function ${component.name}() {\n`;
  
  // Generate body with inline comments for relevant nodes
  for (const node of component.nodes) {
    const comment = nodeComments.get(node.id);
    
    if (comment && comment.placement === 'inline') {
      code += `  ${formatAsInline(comment.comment)}\n`;
    }
    
    code += generateNodeCode(node);
  }
  
  code += '}\n';
  
  return code;
}
```

### Step 4: Handle Special Cases

#### Long Comments (Wrap at 80 chars)

```typescript
function wrapComment(comment: string, maxWidth: number = 80): string[] {
  const words = comment.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine.trim());
  }
  
  return lines;
}
```

#### Comments with Code References

```typescript
// If comment mentions node names, try to update references
function updateCommentReferences(
  comment: string,
  nodeNameMap: Map<string, string> // old name -> generated name
): string {
  let updated = comment;
  
  for (const [oldName, newName] of nodeNameMap) {
    // Replace references like "the Calculate Total node" with "calculateTotal()"
    const pattern = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'gi');
    updated = updated.replace(pattern, `\`${newName}\``);
  }
  
  return updated;
}
```

#### Comments with TODO/FIXME/NOTE

```typescript
function enhanceComment(comment: string): string {
  // Detect and format special markers
  const markers = ['TODO', 'FIXME', 'NOTE', 'HACK', 'XXX', 'BUG'];
  
  for (const marker of markers) {
    if (comment.toUpperCase().startsWith(marker)) {
      // Already has marker, keep as-is
      return comment;
    }
  }
  
  return comment;
}
```

---

## Examples

### Example 1: Function Node with Comment

**Noodl Node JSON:**
```json
{
  "id": "function-123",
  "type": "Function",
  "label": "validateCard",
  "metadata": {
    "comment": "Validates credit card using Luhn algorithm. Returns true if valid."
  },
  "parameters": {
    "code": "// user code here..."
  }
}
```

**Visual (in editor):**
```
┌─────────────────────────────────────────┐
│ 💬 "Validates credit card using Luhn   │
│     algorithm. Returns true if valid." │
├─────────────────────────────────────────┤
│            Function                     │
│ name: validateCard                      │
│─○ cardNumber                            │──○ isValid
└─────────────────────────────────────────┘
```

**Generated:**
```typescript
// logic/validateCard.ts

/**
 * Validates credit card using Luhn algorithm.
 * Returns true if valid.
 */
export function validateCard(cardNumber: string): boolean {
  // Luhn algorithm implementation
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}
```

### Example 2: Variable with Comment

**Noodl Node JSON:**
```json
{
  "id": "var-timeout",
  "type": "Number",
  "metadata": {
    "comment": "Session timeout in milliseconds. Default 30 min. Configurable via admin settings."
  },
  "parameters": {
    "name": "sessionTimeout",
    "value": 1800000
  }
}
```

**Visual (in editor):**
```
┌─────────────────────────────────────────┐
│ 💬 "Session timeout in milliseconds.   │
│     Default 30 min. Configurable via   │
│     admin settings."                    │
├─────────────────────────────────────────┤
│            Variable                     │
│ name: sessionTimeout                    │
│ value: 1800000                          │
└─────────────────────────────────────────┘
```

**Generated:**
```typescript
// stores/variables.ts

/**
 * Session timeout in milliseconds.
 * Default 30 min. Configurable via admin settings.
 */
export const sessionTimeoutVar = createVariable<number>('sessionTimeout', 1800000);
```

### Example 3: Component with Multiple Commented Nodes

**Noodl:**
```
PaymentForm Component
💬 "Handles credit card and PayPal payments. Integrates with Stripe."

├── CardInput
│   💬 "Auto-formats as user types (XXXX-XXXX-XXXX-XXXX)"
│
├── Condition (isPayPal)
│   💬 "PayPal flow redirects to external site"
│
└── Submit Button
    💬 "Disabled until form validates"
```

**Generated:**
```tsx
// components/PaymentForm.tsx

/**
 * Handles credit card and PayPal payments.
 * Integrates with Stripe.
 */
export function PaymentForm() {
  const [paymentMethod] = useVariable(paymentMethodVar);
  const [isValid] = useVariable(formValidVar);
  
  return (
    <div className={styles.form}>
      {/* Auto-formats as user types (XXXX-XXXX-XXXX-XXXX) */}
      <CardInput />
      
      {/* PayPal flow redirects to external site */}
      {paymentMethod === 'paypal' ? (
        <PayPalRedirect />
      ) : (
        <CardFields />
      )}
      
      {/* Disabled until form validates */}
      <button disabled={!isValid}>
        Submit Payment
      </button>
    </div>
  );
}
```

### Example 4: Event Channel with Comment

**Noodl:**
```
┌─────────────────────────────────────────┐
│ 💬 "Broadcast when cart changes.       │
│     Listeners: Header badge, Checkout  │
│     button, Analytics tracker"         │
├─────────────────────────────────────────┤
│          Send Event                     │
│ channel: cartUpdated                    │
│─○ itemCount                             │
│─○ totalPrice                            │
└─────────────────────────────────────────┘
```

**Generated:**
```typescript
// events/channels.ts

/**
 * Broadcast when cart changes.
 * Listeners: Header badge, Checkout button, Analytics tracker
 */
export const cartUpdated = createEventChannel<{
  itemCount: number;
  totalPrice: number;
}>('cartUpdated');
```

---

## Testing Checklist

### Comment Extraction

- [ ] Single-line comments extracted
- [ ] Multi-line comments extracted
- [ ] Empty/whitespace-only comments ignored
- [ ] Special characters in comments escaped properly
- [ ] Unicode characters preserved

### Comment Formatting

- [ ] JSDoc format correct for functions/components
- [ ] Inline comments on single line when short
- [ ] Multi-line inline comments formatted correctly
- [ ] Block comments formatted correctly
- [ ] Line wrapping at 80 characters

### Comment Placement

- [ ] Function comments above function declaration
- [ ] Component comments above component
- [ ] Variable comments above variable
- [ ] Inline logic comments at correct position
- [ ] Event channel comments preserved

### Edge Cases

- [ ] Comments with code snippets (backticks)
- [ ] Comments with URLs
- [ ] Comments with special markers (TODO, FIXME)
- [ ] Comments referencing other node names
- [ ] Very long comments (500+ characters)

---

## Success Criteria

1. **No comment loss** - Every node comment appears in generated code
2. **Correct placement** - Comments appear near relevant code
3. **Proper formatting** - Valid JSDoc/inline/block syntax
4. **Readability** - Comments enhance, not clutter, the code
5. **Accuracy** - Comment content unchanged (except formatting)

---

## Future Enhancements

1. **Comment Categories** - Support for `@param`, `@returns`, `@example` in function comments
2. **Automatic Documentation** - Generate README sections from component comments
3. **Comment Validation** - Warn about outdated comments referencing removed nodes
4. **Markdown Support** - Preserve markdown formatting in JSDoc
5. **Connection Comments** - Comments on wires explaining data flow
