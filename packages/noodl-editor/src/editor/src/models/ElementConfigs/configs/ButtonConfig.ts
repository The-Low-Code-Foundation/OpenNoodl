/**
 * ButtonConfig
 *
 * Element configuration for Button nodes.
 * Defines default styling, 6 variants, and 4 size presets.
 *
 * @module noodl-editor/models/ElementConfigs/configs
 * @since 1.2.0
 */

import type { ElementConfig } from '../ElementConfigTypes';

/**
 * Button element configuration
 * Provides modern, accessible button styles with multiple variants
 */
export const ButtonConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.button',

  description: 'Interactive button element with multiple style variants and sizes',

  categories: ['button', 'interactive', 'form'],

  // Default properties applied when a new Button is created
  defaults: {
    // Layout
    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    paddingLeft: 'var(--space-4)',
    paddingRight: 'var(--space-4)',

    // Typography
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-medium)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    lineHeight: 'var(--leading-none)',

    // Border
    borderRadius: 'var(--radius-md)',
    borderWidth: '0',
    borderStyle: 'solid',

    // Display
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',

    // Transitions
    transitionProperty: 'background-color, border-color, color, box-shadow, transform',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',

    // Default variant
    _variant: 'primary'
  },

  // Size presets
  sizes: {
    sm: {
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-3)',
      paddingRight: 'var(--space-3)',
      fontSize: 'var(--text-xs)',
      height: '32px'
    },

    md: {
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      fontSize: 'var(--text-sm)',
      height: '40px'
    },

    lg: {
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      fontSize: 'var(--text-base)',
      height: '48px'
    },

    xl: {
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-8)',
      paddingRight: 'var(--space-8)',
      fontSize: 'var(--text-lg)',
      height: '56px'
    }
  },

  // Style variants
  variants: {
    // Primary: Solid background, high emphasis
    primary: {
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',

      states: {
        hover: {
          backgroundColor: 'var(--primary-hover)',
          boxShadow: 'var(--shadow-md)'
        },
        active: {
          transform: 'scale(0.98)',
          boxShadow: 'var(--shadow-sm)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          pointerEvents: 'none'
        }
      }
    },

    // Secondary: Subtle background, medium emphasis
    secondary: {
      backgroundColor: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',

      states: {
        hover: {
          backgroundColor: 'var(--secondary-hover)',
          boxShadow: 'var(--shadow-md)'
        },
        active: {
          transform: 'scale(0.98)',
          boxShadow: 'var(--shadow-sm)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          pointerEvents: 'none'
        }
      }
    },

    // Outline: Transparent background with border
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      boxShadow: 'none',

      states: {
        hover: {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-foreground)',
          borderColor: 'var(--accent)'
        },
        active: {
          transform: 'scale(0.98)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          pointerEvents: 'none'
        }
      }
    },

    // Ghost: Minimal style, subtle hover
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderWidth: '0',
      boxShadow: 'none',

      states: {
        hover: {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-foreground)'
        },
        active: {
          transform: 'scale(0.98)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          pointerEvents: 'none'
        }
      }
    },

    // Destructive: For dangerous actions (delete, remove, etc.)
    destructive: {
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',

      states: {
        hover: {
          backgroundColor: 'var(--destructive-hover)',
          boxShadow: 'var(--shadow-md)'
        },
        active: {
          transform: 'scale(0.98)',
          boxShadow: 'var(--shadow-sm)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          pointerEvents: 'none'
        }
      }
    },

    // Link: Text-only style, no background
    link: {
      backgroundColor: 'transparent',
      color: 'var(--primary)',
      borderWidth: '0',
      boxShadow: 'none',
      textDecoration: 'none',
      paddingLeft: '0',
      paddingRight: '0',
      height: 'auto',

      states: {
        hover: {
          textDecoration: 'underline',
          color: 'var(--primary-hover)'
        },
        active: {
          color: 'var(--primary)'
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
          pointerEvents: 'none'
        }
      }
    }
  }
};
