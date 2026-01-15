/**
 * GroupConfig
 *
 * Element configuration for Group nodes.
 * Defines default layout properties and 7 variants for common use cases.
 *
 * @module noodl-editor/models/ElementConfigs/configs
 * @since 1.2.0
 */

import type { ElementConfig } from '../ElementConfigTypes';

/**
 * Group element configuration
 * Provides flexible layout container styles with multiple variants
 */
export const GroupConfig: ElementConfig = {
  nodeType: 'Group',

  description: 'Flexible container element for layout composition',

  categories: ['layout', 'container'],

  // Default properties applied when a new Group is created
  defaults: {
    // Layout
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',

    // Spacing
    gap: 'var(--space-4)',
    padding: '0',

    // Sizing
    width: 'auto',
    height: 'auto',

    // Default variant
    _variant: 'default'
  },

  // Style variants
  variants: {
    // Default: Simple flex column container
    default: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      padding: '0',
      backgroundColor: 'transparent'
    },

    // Card: Elevated container with border and shadow
    card: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      padding: 'var(--space-4)',
      backgroundColor: 'var(--theme-color-bg-3)',
      borderRadius: 'var(--radius-lg)',
      borderWidth: 'var(--border-1)',
      borderStyle: 'solid',
      borderColor: 'var(--theme-color-border-default)',
      boxShadow: 'var(--shadow-sm)'
    },

    // Section: Content section with padding
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      paddingTop: 'var(--space-8)',
      paddingBottom: 'var(--space-8)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      backgroundColor: 'transparent'
    },

    // Inset: Subtle background for nested content
    inset: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      backgroundColor: 'var(--theme-color-bg-2)',
      borderRadius: 'var(--radius-md)'
    },

    // Flex Row: Horizontal layout
    'flex-row': {
      display: 'flex',
      flexDirection: 'row',
      gap: 'var(--space-4)',
      alignItems: 'center',
      padding: '0',
      backgroundColor: 'transparent'
    },

    // Flex Column: Vertical layout (explicit)
    'flex-col': {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      padding: '0',
      backgroundColor: 'transparent'
    },

    // Centered: Center content both horizontally and vertically
    centered: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)',
      backgroundColor: 'transparent'
    }
  }
};
