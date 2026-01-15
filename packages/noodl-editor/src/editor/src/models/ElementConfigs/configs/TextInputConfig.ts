/**
 * TextInputConfig
 *
 * Element configuration for TextInput nodes.
 * Defines default styling, 2 variants, and state-based styling.
 *
 * @module noodl-editor/models/ElementConfigs/configs
 * @since 1.2.0
 */

import type { ElementConfig } from '../ElementConfigTypes';

/**
 * TextInput element configuration
 * Provides modern, accessible input field styles
 */
export const TextInputConfig: ElementConfig = {
  nodeType: 'net.noodl.controls.textinput',

  description: 'Interactive text input field with validation states',

  categories: ['input', 'form', 'interactive'],

  // Default properties applied when a new TextInput is created
  defaults: {
    // Layout
    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)',
    width: '100%',
    height: '40px',

    // Typography
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-normal)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 'var(--leading-normal)',
    color: 'var(--theme-color-fg-default)',

    // Border
    borderRadius: 'var(--radius-md)',
    borderWidth: 'var(--border-1)',
    borderStyle: 'solid',
    borderColor: 'var(--theme-color-border-default)',

    // Background
    backgroundColor: 'var(--theme-color-bg-3)',

    // Display
    display: 'block',
    outline: 'none',

    // Transitions
    transitionProperty: 'border-color, box-shadow, background-color',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',

    // Default variant
    _variant: 'default'
  },

  // Style variants
  variants: {
    // Default: Standard input appearance
    default: {
      backgroundColor: 'var(--theme-color-bg-3)',
      borderColor: 'var(--theme-color-border-default)',
      color: 'var(--theme-color-fg-default)',

      states: {
        focus: {
          borderColor: 'var(--primary)',
          boxShadow: '0 0 0 3px var(--primary-alpha-20)',
          outline: 'none'
        },
        hover: {
          borderColor: 'var(--theme-color-border-hover)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          backgroundColor: 'var(--theme-color-bg-2)',
          color: 'var(--theme-color-fg-default-shy)'
        },
        placeholder: {
          color: 'var(--theme-color-fg-default-shy)',
          opacity: '0.6'
        }
      }
    },

    // Error: Validation error state
    error: {
      backgroundColor: 'var(--theme-color-bg-3)',
      borderColor: 'var(--destructive)',
      color: 'var(--theme-color-fg-default)',

      states: {
        focus: {
          borderColor: 'var(--destructive)',
          boxShadow: '0 0 0 3px var(--destructive-alpha-20)',
          outline: 'none'
        },
        hover: {
          borderColor: 'var(--destructive-hover)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          backgroundColor: 'var(--theme-color-bg-2)',
          color: 'var(--theme-color-fg-default-shy)'
        },
        placeholder: {
          color: 'var(--theme-color-fg-default-shy)',
          opacity: '0.6'
        }
      }
    }
  }
};
