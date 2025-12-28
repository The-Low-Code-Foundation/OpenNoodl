# AI-004: AI Design Assistance

## Overview

Provide AI-powered design feedback and improvements. Analyze components for design issues (accessibility, consistency, spacing) and suggest or auto-apply fixes. Transform rough layouts into polished designs.

## Context

Many Noodl users are developers or designers who may not have deep expertise in both areas. Common issues include:
- Inconsistent spacing and alignment
- Accessibility problems (contrast, touch targets)
- Missing hover/focus states
- Unbalanced layouts
- Poor color combinations

AI Design Assistance provides:
- Automated design review
- One-click fixes for common issues
- Style consistency enforcement
- Accessibility compliance checking
- Layout optimization suggestions

## Requirements

### Functional Requirements

1. **Design Analysis**
   - Scan component/page for issues
   - Categorize by severity (error, warning, info)
   - Group by type (spacing, color, typography, etc.)
   - Provide explanations

2. **Issue Categories**
   - **Accessibility**: Contrast, touch targets, labels
   - **Consistency**: Spacing, colors, typography
   - **Layout**: Alignment, balance, whitespace
   - **Interaction**: Hover, focus, active states
   - **Responsiveness**: Breakpoint issues

3. **Fix Application**
   - One-click fix for individual issues
   - "Fix all" for category
   - Preview before applying
   - Explain what was fixed

4. **Design Improvement**
   - "Polish this" command
   - Transform rough layouts
   - Suggest design alternatives
   - Apply consistent styling

5. **Design System Enforcement**
   - Check against project styles
   - Suggest using existing styles
   - Identify one-off values
   - Propose new styles

### Non-Functional Requirements

- Analysis completes in < 5 seconds
- Fixes don't break functionality
- Respects existing design intent
- Works with any component structure

## Technical Approach

### 1. Design Analysis Service

```typescript
// packages/noodl-editor/src/editor/src/services/DesignAnalysisService.ts

interface DesignIssue {
  id: string;
  type: IssueType;
  severity: 'error' | 'warning' | 'info';
  category: IssueCategory;
  node: NodeGraphNode;
  property?: string;
  message: string;
  explanation: string;
  fix?: DesignFix;
}

enum IssueCategory {
  ACCESSIBILITY = 'accessibility',
  CONSISTENCY = 'consistency',
  LAYOUT = 'layout',
  INTERACTION = 'interaction',
  RESPONSIVENESS = 'responsiveness'
}

interface DesignFix {
  description: string;
  changes: PropertyChange[];
  preview?: string;
}

class DesignAnalysisService {
  private static instance: DesignAnalysisService;
  private analyzers: DesignAnalyzer[] = [];
  
  // Analysis
  async analyzeComponent(component: ComponentModel): Promise<DesignIssue[]>;
  async analyzePage(page: ComponentModel): Promise<DesignIssue[]>;
  async analyzeProject(project: ProjectModel): Promise<DesignIssue[]>;
  
  // Fixes
  async applyFix(issue: DesignIssue): Promise<void>;
  async applyAllFixes(issues: DesignIssue[]): Promise<void>;
  async previewFix(issue: DesignIssue): Promise<FixPreview>;
  
  // Polish
  async polishComponent(component: ComponentModel): Promise<PolishResult>;
  async suggestImprovements(component: ComponentModel): Promise<Improvement[]>;
  
  // Design system
  async checkDesignSystem(component: ComponentModel): Promise<DesignSystemIssue[]>;
  async suggestStyles(component: ComponentModel): Promise<StyleSuggestion[]>;
}
```

### 2. Design Analyzers

```typescript
// packages/noodl-editor/src/editor/src/services/ai/analyzers/

// Base analyzer
interface DesignAnalyzer {
  name: string;
  category: IssueCategory;
  analyze(component: ComponentModel): DesignIssue[];
}

// Accessibility Analyzer
class AccessibilityAnalyzer implements DesignAnalyzer {
  name = 'Accessibility';
  category = IssueCategory.ACCESSIBILITY;
  
  analyze(component: ComponentModel): DesignIssue[] {
    const issues: DesignIssue[] = [];
    
    component.forEachNode(node => {
      // Check contrast
      if (this.hasTextAndBackground(node)) {
        const contrast = this.calculateContrast(
          node.parameters.color,
          node.parameters.backgroundColor
        );
        if (contrast < 4.5) {
          issues.push({
            type: 'low-contrast',
            severity: contrast < 3 ? 'error' : 'warning',
            category: IssueCategory.ACCESSIBILITY,
            node,
            message: `Low color contrast (${contrast.toFixed(1)}:1)`,
            explanation: 'WCAG requires 4.5:1 for normal text',
            fix: {
              description: 'Adjust colors for better contrast',
              changes: this.suggestContrastFix(node)
            }
          });
        }
      }
      
      // Check touch targets
      if (this.isInteractive(node)) {
        const size = this.getSize(node);
        if (size.width < 44 || size.height < 44) {
          issues.push({
            type: 'small-touch-target',
            severity: 'warning',
            category: IssueCategory.ACCESSIBILITY,
            node,
            message: 'Touch target too small',
            explanation: 'Minimum 44x44px recommended for touch',
            fix: {
              description: 'Increase size to 44x44px minimum',
              changes: [
                { property: 'width', value: Math.max(size.width, 44) },
                { property: 'height', value: Math.max(size.height, 44) }
              ]
            }
          });
        }
      }
      
      // Check labels
      if (this.isFormInput(node) && !this.hasLabel(node)) {
        issues.push({
          type: 'missing-label',
          severity: 'error',
          category: IssueCategory.ACCESSIBILITY,
          node,
          message: 'Form input missing label',
          explanation: 'Screen readers need labels to identify inputs'
        });
      }
    });
    
    return issues;
  }
}

// Consistency Analyzer
class ConsistencyAnalyzer implements DesignAnalyzer {
  name = 'Consistency';
  category = IssueCategory.CONSISTENCY;
  
  analyze(component: ComponentModel): DesignIssue[] {
    const issues: DesignIssue[] = [];
    
    // Collect all values
    const spacings = this.collectSpacings(component);
    const colors = this.collectColors(component);
    const fontSizes = this.collectFontSizes(component);
    
    // Check for one-offs
    const spacingOneOffs = this.findOneOffs(spacings, SPACING_SCALE);
    const colorOneOffs = this.findOneOffs(colors, component.colorStyles);
    const fontOneOffs = this.findOneOffs(fontSizes, FONT_SCALE);
    
    // Report issues
    for (const oneOff of spacingOneOffs) {
      issues.push({
        type: 'inconsistent-spacing',
        severity: 'info',
        category: IssueCategory.CONSISTENCY,
        node: oneOff.node,
        property: oneOff.property,
        message: `Non-standard spacing: ${oneOff.value}`,
        explanation: 'Consider using a standard spacing value',
        fix: {
          description: `Change to ${oneOff.suggestion}`,
          changes: [{ property: oneOff.property, value: oneOff.suggestion }]
        }
      });
    }
    
    return issues;
  }
}

// Layout Analyzer
class LayoutAnalyzer implements DesignAnalyzer {
  name = 'Layout';
  category = IssueCategory.LAYOUT;
  
  analyze(component: ComponentModel): DesignIssue[] {
    const issues: DesignIssue[] = [];
    
    // Check alignment
    const alignmentIssues = this.checkAlignment(component);
    issues.push(...alignmentIssues);
    
    // Check whitespace balance
    const whitespaceIssues = this.checkWhitespace(component);
    issues.push(...whitespaceIssues);
    
    // Check visual hierarchy
    const hierarchyIssues = this.checkHierarchy(component);
    issues.push(...hierarchyIssues);
    
    return issues;
  }
}

// Interaction Analyzer
class InteractionAnalyzer implements DesignAnalyzer {
  name = 'Interaction';
  category = IssueCategory.INTERACTION;
  
  analyze(component: ComponentModel): DesignIssue[] {
    const issues: DesignIssue[] = [];
    
    component.forEachNode(node => {
      if (this.isInteractive(node)) {
        // Check hover state
        if (!this.hasHoverState(node)) {
          issues.push({
            type: 'missing-hover',
            severity: 'warning',
            category: IssueCategory.INTERACTION,
            node,
            message: 'Missing hover state',
            explanation: 'Interactive elements should have hover feedback',
            fix: {
              description: 'Add subtle hover effect',
              changes: this.generateHoverState(node)
            }
          });
        }
        
        // Check focus state
        if (!this.hasFocusState(node)) {
          issues.push({
            type: 'missing-focus',
            severity: 'error',
            category: IssueCategory.INTERACTION,
            node,
            message: 'Missing focus state',
            explanation: 'Keyboard users need visible focus indicators'
          });
        }
      }
    });
    
    return issues;
  }
}
```

### 3. AI Polish Engine

```typescript
// packages/noodl-editor/src/editor/src/services/ai/PolishEngine.ts

interface PolishResult {
  before: ComponentSnapshot;
  after: ComponentSnapshot;
  changes: Change[];
  explanation: string;
}

class PolishEngine {
  async polishComponent(component: ComponentModel): Promise<PolishResult> {
    // 1. Analyze current state
    const issues = await DesignAnalysisService.instance.analyzeComponent(component);
    
    // 2. Apply automatic fixes
    const autoFixable = issues.filter(i => i.fix && i.severity !== 'error');
    for (const issue of autoFixable) {
      await this.applyFix(issue);
    }
    
    // 3. Use AI for creative improvements
    const aiImprovements = await this.getAiImprovements(component);
    
    // 4. Apply AI suggestions
    for (const improvement of aiImprovements) {
      await this.applyImprovement(improvement);
    }
    
    return {
      before: this.originalSnapshot,
      after: this.currentSnapshot,
      changes: this.recordedChanges,
      explanation: this.generateExplanation()
    };
  }
  
  private async getAiImprovements(component: ComponentModel): Promise<Improvement[]> {
    const prompt = `Analyze this Noodl component and suggest design improvements:
    
    Component structure:
    ${this.serializeComponent(component)}
    
    Current styles:
    ${this.serializeStyles(component)}
    
    Suggest improvements for:
    1. Visual hierarchy
    2. Whitespace and breathing room
    3. Color harmony
    4. Typography refinement
    5. Micro-interactions
    
    Output JSON array of improvements with property changes.`;
    
    const response = await this.anthropicClient.complete(prompt);
    return JSON.parse(response);
  }
}
```

### 4. UI Components

#### Design Review Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Design Review                                               [×]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 📊 Overview                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 2 Errors   🟡 5 Warnings   🔵 3 Info                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 🔴 ERRORS                                           [Fix All (2)]  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ♿ Low color contrast on "Submit" button                  [Fix] │ │
│ │   Contrast ratio 2.1:1, needs 4.5:1                             │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ♿ Missing label on email input                           [Fix] │ │
│ │   Screen readers cannot identify this input                      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 🟡 WARNINGS                                         [Fix All (5)]  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📐 Inconsistent spacing (12px vs 16px scale)             [Fix] │ │
│ │ 👆 Touch target too small (32x32px)                      [Fix] │ │
│ │ ✨ Missing hover state on buttons                        [Fix] │ │
│ │ ...                                                              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                    [Analyze Again]  [✨ Polish All] │
└─────────────────────────────────────────────────────────────────────┘
```

#### Polish Preview

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Polish Preview                                             [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ BEFORE                           AFTER                              │
│ ┌────────────────────────┐      ┌────────────────────────┐         │
│ │  ┌──────────────────┐  │      │  ┌──────────────────┐  │         │
│ │  │   Cramped card   │  │      │  │                  │  │         │
│ │  │   No shadow      │  │  →   │  │   Polished card  │  │         │
│ │  │   Basic button   │  │      │  │   with shadow    │  │         │
│ │  └──────────────────┘  │      │  │   and spacing    │  │         │
│ │                        │      │  └──────────────────┘  │         │
│ └────────────────────────┘      └────────────────────────┘         │
│                                                                     │
│ Changes Applied:                                                    │
│ • Added 24px padding to card                                       │
│ • Added subtle shadow (0 2px 8px rgba(0,0,0,0.1))                 │
│ • Increased button padding (12px 24px)                             │
│ • Added hover state with 0.95 scale                                │
│ • Adjusted border radius to 12px                                   │
│                                                                     │
│                                         [Revert]  [Apply Polish]   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Design Rules Engine

```typescript
// packages/noodl-editor/src/editor/src/services/ai/DesignRules.ts

interface DesignRule {
  id: string;
  name: string;
  description: string;
  category: IssueCategory;
  severity: 'error' | 'warning' | 'info';
  check: (node: NodeGraphNode, context: DesignContext) => RuleViolation | null;
  fix?: (violation: RuleViolation) => PropertyChange[];
}

const DESIGN_RULES: DesignRule[] = [
  // Accessibility
  {
    id: 'min-contrast',
    name: 'Minimum Color Contrast',
    description: 'Text must have sufficient contrast with background',
    category: IssueCategory.ACCESSIBILITY,
    severity: 'error',
    check: (node, ctx) => {
      if (!hasTextAndBackground(node)) return null;
      const contrast = calculateContrast(node.parameters.color, node.parameters.backgroundColor);
      if (contrast < 4.5) {
        return { node, contrast, required: 4.5 };
      }
      return null;
    },
    fix: (violation) => suggestContrastFix(violation.node, violation.required)
  },
  
  {
    id: 'min-touch-target',
    name: 'Minimum Touch Target Size',
    description: 'Interactive elements must be at least 44x44px',
    category: IssueCategory.ACCESSIBILITY,
    severity: 'warning',
    check: (node) => {
      if (!isInteractive(node)) return null;
      const size = getSize(node);
      if (size.width < 44 || size.height < 44) {
        return { node, size, required: { width: 44, height: 44 } };
      }
      return null;
    },
    fix: (violation) => [
      { property: 'width', value: Math.max(violation.size.width, 44) },
      { property: 'height', value: Math.max(violation.size.height, 44) }
    ]
  },
  
  // Consistency
  {
    id: 'spacing-scale',
    name: 'Use Spacing Scale',
    description: 'Spacing should follow the design system scale',
    category: IssueCategory.CONSISTENCY,
    severity: 'info',
    check: (node) => {
      const spacing = getSpacingValues(node);
      const nonStandard = spacing.filter(s => !SPACING_SCALE.includes(s));
      if (nonStandard.length > 0) {
        return { node, nonStandard, scale: SPACING_SCALE };
      }
      return null;
    },
    fix: (violation) => violation.nonStandard.map(s => ({
      property: s.property,
      value: findClosest(s.value, SPACING_SCALE)
    }))
  },
  
  // Interaction
  {
    id: 'hover-state',
    name: 'Interactive Hover State',
    description: 'Interactive elements should have hover feedback',
    category: IssueCategory.INTERACTION,
    severity: 'warning',
    check: (node) => {
      if (isInteractive(node) && !hasHoverState(node)) {
        return { node };
      }
      return null;
    },
    fix: (violation) => generateDefaultHoverState(violation.node)
  },
  
  // ... more rules
];
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/DesignAnalysisService.ts`
2. `packages/noodl-editor/src/editor/src/services/ai/analyzers/AccessibilityAnalyzer.ts`
3. `packages/noodl-editor/src/editor/src/services/ai/analyzers/ConsistencyAnalyzer.ts`
4. `packages/noodl-editor/src/editor/src/services/ai/analyzers/LayoutAnalyzer.ts`
5. `packages/noodl-editor/src/editor/src/services/ai/analyzers/InteractionAnalyzer.ts`
6. `packages/noodl-editor/src/editor/src/services/ai/PolishEngine.ts`
7. `packages/noodl-editor/src/editor/src/services/ai/DesignRules.ts`
8. `packages/noodl-core-ui/src/components/ai/DesignReviewPanel/DesignReviewPanel.tsx`
9. `packages/noodl-core-ui/src/components/ai/DesignIssueCard/DesignIssueCard.tsx`
10. `packages/noodl-core-ui/src/components/ai/PolishPreview/PolishPreview.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx`
   - Add Design Review panel toggle
   - Add menu option

2. `packages/noodl-editor/src/editor/src/views/panels/propertiespanel/`
   - Add issue indicators on properties
   - Quick fix buttons

3. `packages/noodl-editor/src/editor/src/views/nodegrapheditor.js`
   - Highlight nodes with issues
   - Add "Polish" context menu

## Implementation Steps

### Phase 1: Analysis Infrastructure
1. Create DesignAnalysisService
2. Define issue types and categories
3. Create analyzer base class
4. Implement fix application

### Phase 2: Core Analyzers
1. Implement AccessibilityAnalyzer
2. Implement ConsistencyAnalyzer
3. Implement LayoutAnalyzer
4. Implement InteractionAnalyzer

### Phase 3: Polish Engine
1. Create PolishEngine
2. Implement auto-fix application
3. Add AI improvement suggestions
4. Generate explanations

### Phase 4: UI - Review Panel
1. Create DesignReviewPanel
2. Create DesignIssueCard
3. Group issues by category
4. Add fix buttons

### Phase 5: UI - Polish Preview
1. Create PolishPreview
2. Show before/after
3. List changes
4. Apply/revert actions

### Phase 6: Integration
1. Add to editor menus
2. Highlight issues on canvas
3. Add keyboard shortcuts

## Testing Checklist

- [ ] Accessibility issues detected
- [ ] Contrast calculation accurate
- [ ] Touch target check works
- [ ] Consistency issues found
- [ ] Fixes don't break layout
- [ ] Polish improves design
- [ ] Preview accurate
- [ ] Undo works
- [ ] Performance acceptable
- [ ] Works on all component types

## Dependencies

- AI-001 (AI Project Scaffolding) - for AnthropicClient
- AI-003 (Natural Language Editing) - for change application

## Blocked By

- AI-001

## Blocks

- None (final task in AI series)

## Estimated Effort

- Analysis service: 4-5 hours
- Accessibility analyzer: 4-5 hours
- Consistency analyzer: 3-4 hours
- Layout analyzer: 3-4 hours
- Interaction analyzer: 3-4 hours
- Polish engine: 5-6 hours
- UI review panel: 4-5 hours
- UI polish preview: 3-4 hours
- Integration: 3-4 hours
- **Total: 32-41 hours**

## Success Criteria

1. Issues detected accurately
2. Fixes don't break functionality
3. Polish improves design quality
4. Accessibility issues caught
5. One-click fixes work
6. Preview shows accurate changes

## Design Rules Categories

### Accessibility (WCAG)
- Color contrast (4.5:1 text, 3:1 large)
- Touch targets (44x44px)
- Focus indicators
- Label associations
- Alt text for images

### Consistency
- Spacing scale adherence
- Color from palette
- Typography scale
- Border radius consistency
- Shadow consistency

### Layout
- Alignment on grid
- Balanced whitespace
- Visual hierarchy
- Content grouping

### Interaction
- Hover states
- Focus states
- Active states
- Loading states
- Error states

## Future Enhancements

- Design system integration
- Custom rule creation
- Team design standards
- A/B testing suggestions
- Animation review
- Performance impact analysis
