# TASK-011: Advanced Code Editor Features

**Status:** 📝 Planned (Future)  
**Priority:** Low-Medium  
**Estimated Effort:** 1-2 weeks  
**Dependencies:** TASK-009 (Monaco Replacement)

---

## Problem Statement

The current JavaScriptEditor (from TASK-009) is functional and reliable but lacks advanced IDE features:

- No syntax highlighting (monochrome code)
- No autocomplete/IntelliSense
- No hover tooltips for variables/functions
- No code folding
- No minimap

These features would improve the developer experience, especially for:

- Complex function nodes with multiple variables
- Script nodes with longer code
- Users coming from IDEs who expect these features

---

## Proposed Solutions

### Option A: Add Syntax Highlighting Only (Lightweight)

**Use Prism.js** - 2KB library, just visual colors

**Pros:**

- Very lightweight (~2KB gzipped)
- No web workers needed
- Works with textarea overlay
- Many language support
- Easy to integrate

**Cons:**

- No semantic understanding
- No autocomplete
- Just visual enhancement

**Implementation:**

```typescript
import Prism from 'prismjs';

import 'prismjs/components/prism-javascript';

// Overlay highlighted version on top of textarea
function HighlightedCode({ code }) {
  const highlighted = Prism.highlight(code, Prism.languages.javascript, 'javascript');
  return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
```

---

### Option B: Upgrade to CodeMirror 6 (Moderate)

**CodeMirror 6** - Modern, modular editor library

**Pros:**

- Lighter than Monaco
- Works well in Electron
- Syntax highlighting
- Basic autocomplete
- Extensible plugin system
- Active development

**Cons:**

- Larger bundle (~100KB)
- More complex integration
- Learning curve
- Still need to configure autocomplete

**Features Available:**

- ✅ Syntax highlighting
- ✅ Line numbers
- ✅ Code folding
- ✅ Search/replace
- ✅ Multiple cursors
- ⚠️ Autocomplete (requires configuration)
- ❌ Full IntelliSense (not as good as Monaco/VSCode)

---

### Option C: Monaco with Web Worker Fix (Complex)

**Go back to Monaco** but fix the web worker issues

**Pros:**

- Best-in-class editor
- Full IntelliSense
- Same as VSCode
- TypeScript support
- All IDE features

**Cons:**

- **Very** complex web worker setup in Electron
- Large bundle size (~2MB)
- We already abandoned this approach
- High maintenance burden

**Verdict:** Not recommended - defeats purpose of TASK-009

---

## Recommended Approach

**Phase 1: Syntax Highlighting with Prism.js**

- Low effort, high impact
- Makes code more readable
- No performance impact
- Keeps the editor simple

**Phase 2 (Optional): Consider CodeMirror 6**

- Only if users strongly request advanced features
- After Phase 1 has proven stable
- Requires user feedback to justify effort

---

## Phase 1 Implementation: Prism.js

### Architecture

```tsx
/**
 * Enhanced JavaScriptEditor with syntax highlighting
 */
<div className={css.EditorContainer}>
  {/* Line numbers (existing) */}
  <div className={css.LineNumbers}>...</div>

  {/* Syntax highlighted overlay */}
  <div className={css.HighlightOverlay} dangerouslySetInnerHTML={{ __html: highlightedCode }} />

  {/* Actual textarea (transparent text) */}
  <textarea
    className={css.Editor}
    style={{ color: 'transparent', caretColor: 'white' }}
    value={code}
    onChange={handleChange}
  />
</div>
```

### CSS Layering

```scss
.EditorContainer {
  position: relative;

  .HighlightOverlay {
    position: absolute;
    top: 0;
    left: 50px; // After line numbers
    right: 0;
    bottom: 0;
    padding: 16px;
    pointer-events: none; // Don't block textarea
    overflow: hidden;
    white-space: pre;
    font-family: var(--theme-font-mono);
    font-size: 13px;
    line-height: 1.6;
  }

  .Editor {
    position: relative;
    z-index: 2;
    background: transparent;
    color: transparent; // Hide actual text
    caret-color: var(--theme-color-fg-default); // Show cursor
  }
}
```

### Color Theme

```scss
// Prism.js theme customization
.token.comment {
  color: #6a9955;
}
.token.keyword {
  color: #569cd6;
}
.token.string {
  color: #ce9178;
}
.token.number {
  color: #b5cea8;
}
.token.function {
  color: #dcdcaa;
}
.token.operator {
  color: #d4d4d4;
}
.token.variable {
  color: #9cdcfe;
}
```

### Dependencies

```json
{
  "dependencies": {
    "prismjs": "^1.29.0"
  }
}
```

---

## Phase 2 Implementation: CodeMirror 6 (Optional)

### When to Consider

Only move to CodeMirror if users report:

- "I really miss autocomplete"
- "I need code folding for large functions"
- "Can't work without IDE features"

### Migration Path

```typescript
// Replace JavaScriptEditor internals with CodeMirror

import { javascript } from '@codemirror/lang-javascript';
import { EditorView, basicSetup } from 'codemirror';

const view = new EditorView({
  doc: initialCode,
  extensions: [
    basicSetup,
    javascript()
    // Custom theme
    // Custom keymaps
    // Validation extension
  ],
  parent: containerEl
});
```

### Effort Estimate

- Setup: 2 days
- Theme customization: 1 day
- Autocomplete configuration: 2 days
- Testing: 1 day
- **Total: ~1 week**

---

## User Feedback Collection

Before implementing Phase 2, collect feedback:

**Questions to ask:**

1. "Do you miss syntax highlighting?" (Justifies Phase 1)
2. "Do you need autocomplete?" (Justifies CodeMirror)
3. "Is the current editor good enough?" (Maybe stop here)
4. "What IDE features do you miss most?" (Priority order)

**Metrics to track:**

- How many users enable the new editor?
- How long do they use it?
- Do they switch back to Monaco?
- Error rates with new editor?

---

## Cost-Benefit Analysis

### Syntax Highlighting (Prism.js)

| Benefit                 | Cost                 |
| ----------------------- | -------------------- |
| +50% readability        | 2KB bundle           |
| Faster code scanning    | 1 day implementation |
| Professional appearance | Minimal complexity   |

**ROI:** High - Low effort, high impact

### Full IDE (CodeMirror)

| Benefit                   | Cost                  |
| ------------------------- | --------------------- |
| Autocomplete              | 100KB bundle          |
| Better UX for power users | 1 week implementation |
| Code folding, etc         | Ongoing maintenance   |

**ROI:** Medium - Only if users demand it

### Monaco (Web Worker Fix)

| Benefit                 | Cost                    |
| ----------------------- | ----------------------- |
| Best editor available   | 2MB bundle              |
| Full TypeScript support | 2-3 weeks setup         |
| IntelliSense            | Complex Electron config |

**ROI:** Low - Too complex, we already moved away

---

## Decision Framework

```
User reports: "I miss syntax highlighting"
→ Implement Phase 1 (Prism.js)
→ Low effort, high value

After 3 months with Phase 1:
→ Collect feedback
→ Users happy? → Stop here ✅
→ Users want more? → Consider Phase 2

Users demand autocomplete:
→ Implement CodeMirror 6
→ Medium effort, medium value

Nobody complains:
→ Keep current editor ✅
→ Task complete, no action needed
```

---

## Recommendations

**Now:**

- ✅ Keep current JavaScriptEditor (TASK-009)
- ✅ Monitor user feedback
- ❌ Don't implement advanced features yet

**After 3 months:**

- Evaluate usage metrics
- Read user feedback
- Decide: Phase 1, Phase 2, or neither

**If adding features:**

1. Start with Prism.js (Phase 1)
2. Test with users for 1 month
3. Only add CodeMirror if strongly requested
4. Never go back to Monaco

---

## Success Metrics

**Phase 1 (Prism.js):**

- [ ] Code is more readable (user survey)
- [ ] No performance regression
- [ ] Bundle size increase <5KB
- [ ] Users don't request more features

**Phase 2 (CodeMirror):**

- [ ] Users actively use autocomplete
- [ ] Fewer syntax errors
- [ ] Faster code writing
- [ ] Positive feedback on IDE features

---

## Alternative: "Good Enough" Philosophy

**Consider:** Maybe the current editor is fine!

**Arguments for simplicity:**

- Expression nodes are typically 1-2 lines
- Function nodes are small focused logic
- Script nodes are rare
- Syntax highlighting is "nice to have" not "must have"
- Users can use external IDE for complex code

**When simple is better:**

- Faster load time
- Easier to maintain
- Less can go wrong
- Lower cognitive load

---

## Future: AI-Powered Features

Instead of traditional IDE features, consider:

- AI code completion (OpenAI Codex)
- AI error explanation
- AI code review
- Natural language → code

These might be more valuable than syntax highlighting!

---

**Next Action:** Wait for user feedback. Only implement if users request it.
