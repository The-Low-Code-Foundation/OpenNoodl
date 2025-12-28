# TASK-004: Storybook 8 Story Migration

## Status: ✅ COMPLETED (2025-07-12)

## Overview
Migrate all Storybook stories from the deprecated CSF2 format (using `ComponentStory` and `ComponentMeta`) to the new CSF3 format required by Storybook 8.

## Problem Statement
After upgrading to Storybook 8 in TASK-001, the story files still use the old Storybook 6/7 APIs:
- `ComponentStory` type is removed
- `ComponentMeta` type is removed
- Stories use the old CSF2 format

This causes ~214 TypeScript errors in `*.stories.tsx` files.

## Error Analysis

| Error Type | Count | Location |
|------------|-------|----------|
| `ComponentStory` not exported | ~107 | `*.stories.tsx` |
| `ComponentMeta` not exported | ~107 | `*.stories.tsx` |
| **Total** | **~214** | `packages/noodl-core-ui/src/components/*` |

## Migration Pattern

### Before (CSF2 / Storybook 6-7)
```typescript
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { Button } from './Button';

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] }
  }
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  variant: 'primary',
  label: 'Click me'
};

export const Secondary = Template.bind({});
Secondary.args = {
  variant: 'secondary',
  label: 'Click me'
};
```

### After (CSF3 / Storybook 8)
```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary'] }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    label: 'Click me'
  }
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    label: 'Click me'
  }
};
```

## Key Changes

| Old (CSF2) | New (CSF3) |
|------------|------------|
| `ComponentMeta<typeof C>` | `Meta<typeof C>` |
| `ComponentStory<typeof C>` | `StoryObj<typeof meta>` |
| `const Template = (args) => <C {...args} />` | Inline in story object |
| `Template.bind({})` | Direct story object |
| `Story.args = { }` | `args: { }` property |

## Files to Update

All `.stories.tsx` files in `packages/noodl-core-ui/src/components/`:

### AI Components (~12 files)
- [ ] `src/components/ai/AiChatBox/AiChatBox.stories.tsx`
- [ ] `src/components/ai/AiChatCard/AiChatCard.stories.tsx`
- [ ] `src/components/ai/AiChatLoader/AiChatLoader.stories.tsx`
- [ ] `src/components/ai/AiChatMessage/AiChatMessage.stories.tsx`
- [ ] `src/components/ai/AiChatSuggestion/AiChatSuggestion.stories.tsx`
- [ ] `src/components/ai/AiChatboxError/AiChatboxError.stories.tsx`
- [ ] `src/components/ai/AiIcon/AiIcon.stories.tsx`
- [ ] `src/components/ai/AiIconAnimated/AiIconAnimated.stories.tsx`

### App Components
- [ ] `src/components/app/SideNavigation/SideNavigation.stories.tsx`
- [ ] `src/components/app/TitleBar/TitleBar.stories.tsx`

### Common Components
- [ ] `src/components/common/ActivityIndicator/ActivityIndicator.stories.tsx`
- [ ] `src/components/common/Card/Card.stories.tsx`
- [ ] `src/components/common/EditorNode/EditorNode.stories.tsx`
- [ ] `src/components/common/ErrorBoundary/ErrorBoundary.stories.tsx`
- [ ] `src/components/common/Icon/Icon.stories.tsx`
- [ ] And many more...

### Inputs, Layout, Popups, etc.
- [ ] All other component directories with stories

## Automation Option

Storybook provides a codemod for migration:
```bash
npx storybook@latest migrate csf-2-to-3 --glob "packages/noodl-core-ui/src/**/*.stories.tsx"
```

However, manual review will still be needed for:
- Complex render functions
- Custom decorators
- Play functions

## Success Criteria
- [ ] No `ComponentStory` or `ComponentMeta` imports in codebase
- [ ] All stories use CSF3 format with `Meta` and `StoryObj`
- [ ] Storybook builds without errors: `npm run storybook`
- [ ] Stories render correctly in Storybook UI

## Estimated Time
4-8 hours (depending on codemod effectiveness)

## Dependencies
- TASK-001 (Storybook 8 dependency upgrade - completed)

## Priority
**Low** - Does not block editor development. Only affects Storybook component documentation.

## Notes
- This is purely a code quality/documentation task
- Storybook still works with warnings
- Consider batching updates by component category
- May want to combine with component documentation updates
