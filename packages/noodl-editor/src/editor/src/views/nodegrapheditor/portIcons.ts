/**
 * Port Type Icons for Node Graph Editor
 *
 * Provides simple, minimal icon indicators for port data types.
 * Uses Unicode characters for reliability and clarity at small sizes.
 *
 * @module portIcons
 * @since TASK-000I-C2
 */

/**
 * Supported port types in the Noodl system
 */
export type PortType =
  | 'signal'
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'color'
  | 'any'
  | 'component'
  | 'enum';

/**
 * Icon representation for a port type
 */
export interface PortIcon {
  /** Unicode character to display */
  char: string;
  /** Optional description for debugging */
  description?: string;
}

/**
 * Icon definitions for each port type
 * Using simple, clear Unicode characters that render well at small sizes
 */
export const PORT_ICONS: Record<PortType, PortIcon> = {
  signal: {
    char: '⚡',
    description: 'Signal/Event trigger'
  },
  string: {
    char: 'T',
    description: 'Text/String data'
  },
  number: {
    char: '#',
    description: 'Numeric data'
  },
  boolean: {
    char: '◐',
    description: 'True/False value'
  },
  object: {
    char: '{ }',
    description: 'Object/Record'
  },
  array: {
    char: '[ ]',
    description: 'Array/List'
  },
  color: {
    char: '●',
    description: 'Color value'
  },
  any: {
    char: '◇',
    description: 'Any type'
  },
  component: {
    char: '◈',
    description: 'Component reference'
  },
  enum: {
    char: '≡',
    description: 'Enumeration/List'
  }
};

/**
 * Visual constants for port icon rendering
 */
export const PORT_ICON_SIZE = 10; // Font size in pixels
// UIX-005: system stack (the Inter-* per-weight families were demoted in UIX-001)
const PORT_ICON_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const PORT_ICON_PADDING = 4; // Space between icon and label

/**
 * Map Noodl internal type names to icon types
 *
 * Noodl uses various type names internally - this function normalizes them
 * to our standard PortType set for consistent icon display.
 *
 * @param type - The internal Noodl type name (may be undefined)
 * @returns The corresponding PortType for icon selection
 *
 * @example
 * ```typescript
 * getPortIconType('*') // returns 'signal'
 * getPortIconType('string') // returns 'string'
 * getPortIconType(undefined) // returns 'any'
 * ```
 */
export function getPortIconType(type: string | undefined): PortType {
  // Handle undefined or non-string types (runtime safety)
  if (!type || typeof type !== 'string') return 'any';

  // Normalize to lowercase for case-insensitive matching
  const normalizedType = type.toLowerCase();

  // Direct type mappings
  const typeMap: Record<string, PortType> = {
    // Signal types
    signal: 'signal',
    '*': 'signal',

    // Primitive types
    string: 'string',
    number: 'number',
    boolean: 'boolean',

    // Complex types
    object: 'object',
    array: 'array',
    color: 'color',

    // Special types
    component: 'component',
    enum: 'enum',

    // Aliases
    text: 'string',
    bool: 'boolean',
    list: 'array',
    json: 'object'
  };

  return typeMap[normalizedType] || 'any';
}

/**
 * Draw a port type icon on canvas
 *
 * Renders a small icon character indicating the port's data type.
 * The icon is drawn with the specified color and at the given position.
 *
 * @param ctx - Canvas rendering context
 * @param type - The port type to render an icon for
 * @param x - X coordinate (center of icon)
 * @param y - Y coordinate (center of icon)
 * @param color - Color to render the icon (CSS color string)
 * @param alpha - Optional opacity override (0-1)
 *
 * @example
 * ```typescript
 * drawPortIcon(ctx, 'signal', 100, 50, '#ff0000', 0.8);
 * drawPortIcon(ctx, 'number', 150, 50, 'rgba(255, 255, 255, 0.6)');
 * ```
 */
export function drawPortIcon(
  ctx: CanvasRenderingContext2D,
  type: PortType,
  x: number,
  y: number,
  color: string,
  alpha: number = 1
): void {
  const icon = PORT_ICONS[type];
  if (!icon) {
    console.warn(`Unknown port type: ${type}`);
    return;
  }

  ctx.save();

  // Set rendering properties
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.font = `${PORT_ICON_SIZE}px ${PORT_ICON_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw the icon character
  ctx.fillText(icon.char, x, y);

  ctx.restore();
}

/**
 * Get the visual width of an icon (for layout calculations)
 *
 * Measures the actual rendered width of a port icon character.
 * Useful for positioning labels correctly after icons.
 *
 * @param ctx - Canvas rendering context (with font already set)
 * @param type - The port type
 * @returns Width in pixels
 */
export function getPortIconWidth(ctx: CanvasRenderingContext2D, type: PortType): number {
  const icon = PORT_ICONS[type];
  if (!icon) return 0;

  ctx.save();
  ctx.font = `${PORT_ICON_SIZE}px ${PORT_ICON_FONT}`;
  const width = ctx.measureText(icon.char).width;
  ctx.restore();

  return width;
}
