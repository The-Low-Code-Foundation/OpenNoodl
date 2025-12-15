# TASK-000: Design System Modernization - Task Index

## Overview

This is the master task for OpenNoodl's UI overhaul, broken down into 8 sub-tasks for incremental implementation.

**Color Scheme**: RED-MINIMAL palette
- **Primary**: Noodl Red (`#d21f3c`)
- **Secondary**: White (`#ffffff`)
- **Neutrals**: Pure black/gray (no color tint)

---

## Sub-Task Summary

| Task | Name | Priority | Effort | Dependencies |
|------|------|----------|--------|--------------|
| **000A** | Token Consolidation & Color Refresh | CRITICAL | 30 min | None |
| **000B** | Hardcoded Colors - Legacy Styles | HIGH | 1-2 hrs | 000A |
| **000C** | Hardcoded Colors - Node Graph | HIGH | 1-2 hrs | 000A |
| **000D** | Hardcoded Colors - Core UI | HIGH | 1-2 hrs | 000A |
| **000E** | Typography & Spacing Tokens | MEDIUM | 1 hr | 000A |
| **000F** | Component Updates - Buttons/Inputs | MEDIUM | 1-2 hrs | 000A, 000D, 000E |
| **000G** | Component Updates - Dialogs/Panels | MEDIUM | 1-2 hrs | 000A, 000D, 000E |
| **000H** | Migration Wizard Polish | HIGH | 1-2 hrs | 000A-000G |

**Total Estimated Effort**: 8-14 hours

---

## Recommended Execution Order

### Phase 1: Foundation (Do First)
1. **TASK-000A** - Token Consolidation & Color Refresh
   - This is the foundation - everything else depends on it
   - Location: `../TASK-000A-token-consolidation/OVERVIEW.md`

### Phase 2: Color Audit (Can Parallelize)
These can be done in any order after 000A:

2. **TASK-000B** - Hardcoded Colors - Legacy Styles
   - Location: `../TASK-000B-hardcoded-colors-legacy/OVERVIEW.md`

3. **TASK-000C** - Hardcoded Colors - Node Graph
   - Location: `../TASK-000C-hardcoded-colors-nodegraph/OVERVIEW.md`

4. **TASK-000D** - Hardcoded Colors - Core UI
   - Location: `../TASK-000D-hardcoded-colors-coreui/OVERVIEW.md`

5. **TASK-000E** - Typography & Spacing Tokens
   - Can be done independently
   - Location: `../TASK-000E-typography-spacing/OVERVIEW.md`

### Phase 3: Visual Polish (After Color Audit)
6. **TASK-000F** - Component Updates - Buttons/Inputs
   - Location: `../TASK-000F-component-buttons-inputs/OVERVIEW.md`

7. **TASK-000G** - Component Updates - Dialogs/Panels
   - Location: `../TASK-000G-component-dialogs-panels/OVERVIEW.md`

### Phase 4: Final Polish
8. **TASK-000H** - Migration Wizard Polish
   - Should be last as it benefits from all prior work
   - Location: `../TASK-000H-migration-wizard-polish/OVERVIEW.md`

---

## Key Files Reference

### Color Token Files
- `packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css` (primary)
- `packages/noodl-core-ui/src/styles/custom-properties/colors.css` (secondary)

### Color Source
- `dev-docs/tasks/phase-3/TASK-000-styles-overhaul/COLORS-RED-MINIMAL.md`

### Entry Points to Verify
- `packages/noodl-editor/src/editor/index.ts`
- `packages/noodl-core-ui/.storybook/preview.ts`

---

## Success Criteria (All Tasks Complete)

### Technical
- [ ] All colors use CSS variables (no hardcoded hex in styles)
- [ ] Token system supports future light theme
- [ ] Typography and spacing tokens available

### Visual  
- [ ] App uses consistent RED-MINIMAL palette
- [ ] Pure dark backgrounds (no warm/brown tint)
- [ ] Primary accent is red (`#d21f3c`)
- [ ] Good contrast and readability

### User Experience
- [ ] Migration wizard looks polished
- [ ] Interactive states are obvious
- [ ] Overall feel matches modern dev tools

---

## Verification Commands

After all tasks complete:

```bash
# Check for remaining hardcoded colors in styles
grep -rn "#[0-9a-fA-F]\{6\}" packages/noodl-editor/src/editor/src/styles/ --include="*.css" --include="*.scss" | wc -l

# Check views directory
grep -rn "#[0-9a-fA-F]\{6\}" packages/noodl-editor/src/editor/src/views/ --include="*.css" --include="*.scss" | wc -l

# Check core-ui components
grep -rn "#[0-9a-fA-F]\{6\}" packages/noodl-core-ui/src/components/ --include="*.css" --include="*.scss" | wc -l
```

**Target: Near-zero hardcoded colors** (some node-specific colors may remain intentionally)

---

## Related Documents

- `DESIGN-SYSTEM-MODERNISATION.md` - Original detailed planning document
- `COLORS-RED-MINIMAL.md` - Complete CSS palette to use
