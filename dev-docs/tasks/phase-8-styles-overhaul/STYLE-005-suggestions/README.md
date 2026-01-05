# STYLE-005: Smart Style Suggestions

## Overview

Implement gentle nudges that help users systematize their styling. When users repeatedly use the same custom values or create elements with many overrides, suggest saving them as tokens or variants.

**Phase:** 8 (Styles Overhaul)  
**Priority:** MEDIUM (polish feature)  
**Effort:** 8-10 hours  
**Risk:** Low  
**Dependencies:** STYLE-001, STYLE-002, STYLE-004

---

## Background

### The Problem

Users often start with custom values (especially beginners), then realize they've used the same hex color in 15 places. Changing it requires finding and updating all 15 instances.

### The Solution

Non-intrusive suggestions that help users "graduate" to systematic styling:

1. **Repeated Value Detection**: "You've used #3b82f6 in 5 elements. Save as token?"
2. **Custom Variant Detection**: "This button has 4 custom values. Save as new variant?"
3. **Inconsistency Detection**: "These buttons use similar but different colors. Unify them?"

---

## Suggestion Types

### Type 1: Repeated Color

Triggered when the same hex color appears in 3+ elements.

```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 STYLE SUGGESTION                                      [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ You've used  ■ #3b82f6  in 5 elements.                         │
│                                                                 │
│ Save as a token to update all at once?                         │
│                                                                 │
│ Token name: [--brand-blue          ]                           │
│                                                                 │
│ Elements using this color:                                     │
│ • Button "Sign Up" (background)                                │
│ • Button "Learn More" (background)                             │
│ • Text "Welcome" (color)                                       │
│ • + 2 more                                                     │
│                                                                 │
│ [Create Token & Update All]  [Ignore]  [Don't Suggest Again]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Type 2: Repeated Spacing

Triggered when the same spacing value appears repeatedly.

```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 STYLE SUGGESTION                                      [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ You're using  24px  padding in 8 elements.                     │
│                                                                 │
│ This matches --space-6 from your tokens.                       │
│ Switch to the token for consistent theming?                    │
│                                                                 │
│ [Switch to Token]  [Keep Manual Values]  [Don't Suggest]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Type 3: Custom Variant Candidate

Triggered when an element has 3+ property overrides.

```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 STYLE SUGGESTION                                      [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ This button has 4 custom properties that could be a variant:   │
│                                                                 │
│ • Background: #22c55e (custom)                                 │
│ • Text color: #ffffff                                          │
│ • Border radius: 9999px                                        │
│ • Padding: 12px 32px                                           │
│                                                                 │
│ Preview:    ┌──────────────────┐                               │
│             │   [ Success ]    │                               │
│             └──────────────────┘                               │
│                                                                 │
│ [Save as "success" Variant]  [Keep as Custom]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Type 4: Similar Values (Inconsistency)

Triggered when near-identical values exist (e.g., #3b82f6 and #3b81f5).

```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 STYLE SUGGESTION                                      [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Found similar but different colors:                            │
│                                                                 │
│  ■ #3b82f6  used in 4 elements                                 │
│  ■ #3b81f5  used in 2 elements                                 │
│  ■ #3a82f6  used in 1 element                                  │
│                                                                 │
│ These look like they should be the same color.                 │
│ Unify them?                                                    │
│                                                                 │
│ Unify to: [■ #3b82f6 ▼]                                        │
│                                                                 │
│ [Unify All]  [Ignore]  [Don't Suggest]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Type 5: Off-System Element

Triggered when selecting an element with multiple custom values.

```
┌─────────────────────────────────────────────────────────────────┐
│ 💡 This element uses 6 custom values                    [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Custom values won't update when you change your theme.         │
│                                                                 │
│ Options:                                                        │
│ • [Map to Tokens] - Replace values with matching tokens        │
│ • [Save as Variant] - Create a reusable variant                │
│ • [Keep Custom] - I know what I'm doing                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detection Logic

### Style Analyzer Service

```typescript
interface StyleAnalyzer {
  // Analyze entire project for patterns
  analyzeProject(): StyleAnalysisResult;
  
  // Analyze single element
  analyzeElement(nodeId: string): ElementAnalysisResult;
  
  // Get suggestions for current context
  getSuggestions(context: AnalysisContext): StyleSuggestion[];
}

interface StyleAnalysisResult {
  repeatedColors: RepeatedValue[];
  repeatedSpacing: RepeatedValue[];
  variantCandidates: VariantCandidate[];
  inconsistencies: Inconsistency[];
}

interface RepeatedValue {
  value: string;
  property: string;
  count: number;
  elements: ElementReference[];
  matchingToken?: string;  // If value matches existing token
}

interface VariantCandidate {
  nodeId: string;
  nodeType: string;
  overrides: PropertyOverride[];
  suggestedName?: string;
}

interface Inconsistency {
  type: 'color' | 'spacing' | 'typography';
  values: { value: string; count: number }[];
  suggestedUnification: string;
}
```

### Detection Thresholds

```typescript
const THRESHOLDS = {
  // Minimum occurrences before suggesting token
  repeatedValueMinCount: 3,
  
  // Minimum overrides before suggesting variant
  variantCandidateMinOverrides: 3,
  
  // Color similarity threshold (0-100, lower = more similar)
  colorSimilarityThreshold: 5,
  
  // Spacing similarity threshold (in px)
  spacingSimilarityThreshold: 2,
};
```

### Color Similarity Detection

```typescript
function areColorsSimilar(color1: string, color2: string): boolean {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  // Calculate Euclidean distance in RGB space
  const distance = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
  
  return distance < THRESHOLDS.colorSimilarityThreshold;
}
```

---

## Implementation

### Phase 1: Analysis Engine (3-4 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/services/
├── StyleAnalyzer/
│   ├── StyleAnalyzer.ts         # Main analyzer service
│   ├── ColorAnalyzer.ts         # Color-specific analysis
│   ├── SpacingAnalyzer.ts       # Spacing analysis
│   ├── VariantAnalyzer.ts       # Variant candidate detection
│   ├── types.ts                 # TypeScript interfaces
│   └── index.ts
```

**Analysis Pipeline:**

```typescript
class StyleAnalyzer {
  private project: ProjectModel;
  private tokenSystem: StyleTokensModel;
  
  analyzeProject(): StyleAnalysisResult {
    const allNodes = this.project.getAllVisualNodes();
    const styleValues = this.extractAllStyleValues(allNodes);
    
    return {
      repeatedColors: this.findRepeatedColors(styleValues),
      repeatedSpacing: this.findRepeatedSpacing(styleValues),
      variantCandidates: this.findVariantCandidates(allNodes),
      inconsistencies: this.findInconsistencies(styleValues),
    };
  }
  
  private extractAllStyleValues(nodes: NodeModel[]): StyleValueMap {
    const values: StyleValueMap = {
      colors: new Map(),
      spacing: new Map(),
      typography: new Map(),
    };
    
    for (const node of nodes) {
      // Extract color values
      for (const prop of COLOR_PROPERTIES) {
        const value = node.getStyleValue(prop);
        if (value && !value.startsWith('var(')) {
          this.addToMap(values.colors, value, node, prop);
        }
      }
      
      // Extract spacing values
      for (const prop of SPACING_PROPERTIES) {
        const value = node.getStyleValue(prop);
        if (value && !value.startsWith('var(')) {
          this.addToMap(values.spacing, value, node, prop);
        }
      }
    }
    
    return values;
  }
}
```

### Phase 2: Suggestion UI Components (2-3 hrs)

**Files to create:**

```
packages/noodl-core-ui/src/components/
├── StyleSuggestions/
│   ├── SuggestionBanner.tsx     # Inline suggestion banner
│   ├── SuggestionBanner.module.scss
│   ├── SuggestionModal.tsx      # Full suggestion dialog
│   ├── SuggestionModal.module.scss
│   ├── CreateTokenForm.tsx      # Token creation mini-form
│   ├── CreateVariantForm.tsx    # Variant creation mini-form
│   └── index.ts
```

**SuggestionBanner Component:**

```typescript
interface SuggestionBannerProps {
  suggestion: StyleSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  onNeverShow: () => void;
}

function SuggestionBanner({ 
  suggestion, 
  onAccept, 
  onDismiss, 
  onNeverShow 
}: SuggestionBannerProps) {
  return (
    <div className={css.Banner}>
      <Icon name={IconName.Lightbulb} className={css.Icon} />
      <div className={css.Content}>
        <p className={css.Message}>{suggestion.message}</p>
        {suggestion.preview && (
          <div className={css.Preview}>{suggestion.preview}</div>
        )}
      </div>
      <div className={css.Actions}>
        <Button variant="primary" onClick={onAccept}>
          {suggestion.acceptLabel}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Ignore
        </Button>
        <IconButton 
          icon={IconName.Close} 
          onClick={onNeverShow}
          title="Don't suggest this again"
        />
      </div>
    </div>
  );
}
```

### Phase 3: Integration Points (2-3 hrs)

**Where suggestions appear:**

1. **Property Panel**: Banner at top when element has suggestions
2. **Floating Toast**: Project-wide suggestions (periodic)
3. **Style Tokens Panel**: Suggestions for repeated values

**Integration in Property Panel:**

```typescript
// In PropertyEditor.tsx
function PropertyEditor({ node }: { node: NodeModel }) {
  const suggestions = useStyleSuggestions(node);
  const [dismissedSuggestions, setDismissed] = useState<Set<string>>(new Set());
  
  const activeSuggestion = suggestions.find(
    s => !dismissedSuggestions.has(s.id)
  );
  
  return (
    <div className={css.PropertyEditor}>
      {activeSuggestion && (
        <SuggestionBanner
          suggestion={activeSuggestion}
          onAccept={() => handleAccept(activeSuggestion)}
          onDismiss={() => setDismissed(prev => new Set([...prev, activeSuggestion.id]))}
          onNeverShow={() => handleNeverShow(activeSuggestion.type)}
        />
      )}
      
      {/* Rest of property panel */}
    </div>
  );
}
```

### Phase 4: Action Handlers (2-3 hrs)

**Implementing suggestion actions:**

```typescript
class SuggestionActionHandler {
  // Create token from repeated value
  async createTokenFromValue(
    value: string,
    tokenName: string,
    elements: ElementReference[]
  ): Promise<void> {
    // 1. Create the token
    await StyleTokensModel.addToken({
      name: tokenName,
      value: value,
      category: this.inferCategory(value),
    });
    
    // 2. Update all elements to use the token
    for (const ref of elements) {
      const node = ProjectModel.getNode(ref.nodeId);
      node.setStyleValue(ref.property, `var(${tokenName})`);
    }
    
    // 3. Track for analytics
    Analytics.track('suggestion_accepted', { type: 'create_token' });
  }
  
  // Create variant from element
  async createVariantFromElement(
    nodeId: string,
    variantName: string
  ): Promise<void> {
    const node = ProjectModel.getNode(nodeId);
    const overrides = this.extractOverrides(node);
    
    // 1. Create the variant
    await ElementConfigModel.addVariant(node.nodeType, variantName, overrides);
    
    // 2. Apply variant to element (clears overrides)
    node.setVariant(variantName);
    
    Analytics.track('suggestion_accepted', { type: 'create_variant' });
  }
  
  // Unify similar values
  async unifyValues(
    values: string[],
    targetValue: string,
    elements: ElementReference[]
  ): Promise<void> {
    for (const ref of elements) {
      if (values.includes(ref.value)) {
        const node = ProjectModel.getNode(ref.nodeId);
        node.setStyleValue(ref.property, targetValue);
      }
    }
    
    Analytics.track('suggestion_accepted', { type: 'unify_values' });
  }
}
```

---

## User Preferences

Allow users to control suggestion behavior:

```typescript
interface StyleSuggestionPreferences {
  enabled: boolean;
  
  // Per-type controls
  showRepeatedColorSuggestions: boolean;
  showRepeatedSpacingSuggestions: boolean;
  showVariantSuggestions: boolean;
  showInconsistencySuggestions: boolean;
  
  // Frequency
  frequency: 'always' | 'sometimes' | 'rarely';
  
  // Dismissed suggestions (persisted)
  dismissedTypes: Set<SuggestionType>;
  dismissedSpecific: Set<string>;  // Specific suggestion IDs
}
```

**Settings UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ STYLE SUGGESTIONS                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [x] Enable style suggestions                                   │
│                                                                 │
│ Suggest when:                                                   │
│ [x] Same color used multiple times                             │
│ [x] Same spacing used multiple times                           │
│ [x] Element has many custom values                             │
│ [x] Similar values might be inconsistent                       │
│                                                                 │
│ Frequency: [Sometimes ▼]                                       │
│            ● Always - Show all suggestions                     │
│            ○ Sometimes - Show important suggestions            │
│            ○ Rarely - Only show critical suggestions           │
│                                                                 │
│ [Reset Dismissed Suggestions]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Timing & Triggers

### When to analyze:

1. **On element selection**: Check selected element for suggestions
2. **On property change**: Re-analyze if custom value entered
3. **Periodic background**: Full project scan every 5 minutes (if idle)
4. **On project open**: Initial analysis

### Debouncing:

```typescript
// Don't spam suggestions
const SUGGESTION_COOLDOWN = 30000; // 30 seconds between suggestions

class SuggestionScheduler {
  private lastSuggestionTime = 0;
  
  shouldShowSuggestion(): boolean {
    const now = Date.now();
    if (now - this.lastSuggestionTime < SUGGESTION_COOLDOWN) {
      return false;
    }
    this.lastSuggestionTime = now;
    return true;
  }
}
```

---

## Testing Strategy

### Unit Tests

- Color similarity detection
- Repeated value detection
- Variant candidate identification
- Action handlers

### Integration Tests

- Suggestion appears when threshold met
- Accept action creates token/variant
- Dismiss persists across sessions
- Preferences respected

### Manual Testing Checklist

- [ ] Add same hex color to 3+ elements → suggestion appears
- [ ] Accept "Create Token" → token created, elements updated
- [ ] Dismiss suggestion → doesn't reappear
- [ ] Click "Don't Suggest Again" → type permanently hidden
- [ ] Create element with 4+ overrides → variant suggestion appears
- [ ] Disable suggestions in settings → no suggestions appear

---

## Success Criteria

- [ ] Repeated color detection works
- [ ] Repeated spacing detection works
- [ ] Variant candidate detection works
- [ ] Similar value detection works
- [ ] Accept actions work correctly
- [ ] Dismiss actions persist
- [ ] User preferences respected
- [ ] Non-intrusive UX (not spammy)

---

## Dependencies

**Blocked By:**
- STYLE-001 (Token System) - suggestions create tokens
- STYLE-002 (Element Configs) - suggestions create variants
- STYLE-004 (Property Panel) - suggestions display location

**Blocks:**
- None (final task in Phase 8)

---

*Last Updated: January 2026*
