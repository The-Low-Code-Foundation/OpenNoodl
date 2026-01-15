/**
 * TextConfig
 *
 * Element configuration for Text nodes.
 * Defines default styling and 10 typography variants.
 *
 * @module noodl-editor/models/ElementConfigs/configs
 * @since 1.2.0
 */

import type { ElementConfig } from '../ElementConfigTypes';

/**
 * Text element configuration
 * Provides comprehensive typography system with semantic variants
 */
export const TextConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.text',

  description: 'Text element with semantic typography variants',

  categories: ['text', 'typography', 'content'],

  // Default properties applied when a new Text is created
  defaults: {
    // FIX: Change from width: 100% to width: auto
    width: 'auto',
    height: 'auto',

    // Layout - Enable flex for proper auto-sizing
    display: 'inline-block',

    // Typography
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-normal)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 'var(--leading-normal)',
    color: 'var(--foreground)',

    // Spacing
    margin: '0',
    padding: '0',

    // Text behavior
    whiteSpace: 'normal',
    wordWrap: 'break-word',
    textAlign: 'left',

    // Default variant
    _variant: 'body'
  },

  // Typography variants - semantic naming
  variants: {
    // Display: Extra large, hero text
    display: {
      fontSize: 'var(--text-4xl)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: '-0.02em',
      color: 'var(--foreground)'
    },

    // H1: Main page heading
    h1: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: '-0.015em',
      color: 'var(--foreground)'
    },

    // H2: Section heading
    h2: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: '-0.01em',
      color: 'var(--foreground)'
    },

    // H3: Subsection heading
    h3: {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)'
    },

    // H4: Small heading
    h4: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-medium)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)'
    },

    // Body: Default text (16px)
    body: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-normal)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)'
    },

    // Body Small: Slightly smaller (14px)
    'body-sm': {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-normal)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)'
    },

    // Caption: Small text for captions (12px)
    caption: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--font-normal)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--muted-foreground)',
      letterSpacing: '0.01em'
    },

    // Label: Form labels, uppercase small text
    label: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-medium)',
      lineHeight: 'var(--leading-none)',
      color: 'var(--foreground)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },

    // Code: Monospace text for code snippets
    code: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-normal)',
      fontFamily: 'var(--font-mono)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'var(--foreground)',
      backgroundColor: 'var(--muted)',
      padding: '2px 6px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'pre-wrap'
    }
  }
};
