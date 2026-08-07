/**
 * Global Type Declarations for OpenNoodl
 * 
 * This file contains shared global type declarations used across all packages.
 * It consolidates declarations previously duplicated in noodl-editor and noodl-core-ui.
 * 
 * @module noodl-types
 * @since 1.1.0
 */

// =============================================================================
// Module Declarations
// =============================================================================

declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.css' {
  const styles: { readonly [key: string]: string };
  export default styles;
}

declare module '*.scss' {
  const styles: { readonly [key: string]: string };
  export default styles;
}

// =============================================================================
// Global Types
// =============================================================================

/**
 * Escape hatch for any type - use sparingly and document why.
 * Prefer proper typing where possible.
 */
type TSFixme = any;

/**
 * Node color categories used in the visual node graph editor.
 */
type NodeColor = 'data' | 'visual' | 'logic' | 'component' | 'javascript';

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Expand types for better IDE tooltips.
 * Converts intersection types to a flat object type.
 */
type Prettify<T> = {
  [K in keyof T]: T[K];
  // eslint-disable-next-line @typescript-eslint/ban-types
} & {};

/**
 * Make specific properties required while keeping others optional.
 */
type PartialWithRequired<T, K extends keyof T> = Pick<T, K> & Partial<T>;

// =============================================================================
// Window Augmentation
// =============================================================================

interface Window {
  /**
   * Current route used in the editor preview.
   */
  noodlEditorPreviewRoute: string;
}
