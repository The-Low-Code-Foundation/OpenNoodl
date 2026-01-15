/**
 * ElementConfigRegistry
 *
 * Central registry for managing element configurations.
 * Provides methods to register, retrieve, and apply element configs.
 *
 * @module noodl-editor/models/ElementConfigs
 * @since 1.2.0
 */

import type {
  ElementConfig,
  VariantConfig,
  SizeConfig,
  RegisterConfigOptions,
  ConfigValidationResult,
  ApplyVariantParams,
  ResolveStylesParams,
  StyleResolutionResult,
  CSSValue
} from './ElementConfigTypes';

/**
 * Minimal node interface for applying configs
 * This represents the shape we need from NodeModel
 */
interface NodeLike {
  /** Node type identifier */
  type: string;
  /** Node unique ID */
  id: string;
  /** Node parameters/properties */
  parameters: Record<string, any>;
}

/**
 * Registry for element configurations
 * Singleton pattern - use ElementConfigRegistry.instance
 */
export class ElementConfigRegistry {
  private static _instance: ElementConfigRegistry;
  private configs: Map<string, ElementConfig>;

  private constructor() {
    this.configs = new Map();
  }

  /**
   * Get the singleton instance
   */
  static get instance(): ElementConfigRegistry {
    if (!ElementConfigRegistry._instance) {
      ElementConfigRegistry._instance = new ElementConfigRegistry();
    }
    return ElementConfigRegistry._instance;
  }

  /**
   * Register a new element configuration
   *
   * @param config - The element configuration to register
   * @param options - Registration options
   * @returns True if registered successfully, false if already exists and override is false
   *
   * @example
   * ```typescript
   * ElementConfigRegistry.instance.register(ButtonConfig);
   * ```
   */
  register(config: ElementConfig, options: RegisterConfigOptions = {}): boolean {
    const { override = false, validate = true } = options;

    // Validate if requested
    if (validate) {
      const validation = this.validate(config);
      if (!validation.valid) {
        console.error(`[ElementConfigRegistry] Invalid config for ${config.nodeType}:`, validation.errors);
        return false;
      }

      if (validation.warnings.length > 0) {
        console.warn(`[ElementConfigRegistry] Warnings for ${config.nodeType}:`, validation.warnings);
      }
    }

    // Check if already exists
    const exists = this.configs.has(config.nodeType);
    if (exists && !override) {
      console.warn(
        `[ElementConfigRegistry] Config for ${config.nodeType} already exists. Use override: true to replace.`
      );
      return false;
    }

    // Register the config
    this.configs.set(config.nodeType, config);

    console.log(
      `[ElementConfigRegistry] ${exists ? 'Updated' : 'Registered'} config for ${config.nodeType} ` +
        `(${Object.keys(config.variants).length} variants)`
    );

    return true;
  }

  /**
   * Get an element configuration by node type
   *
   * @param nodeType - The node type identifier
   * @returns The element config, or undefined if not found
   *
   * @example
   * ```typescript
   * const config = ElementConfigRegistry.instance.get('net.noodl.visual.button');
   * ```
   */
  get(nodeType: string): ElementConfig | undefined {
    return this.configs.get(nodeType);
  }

  /**
   * Check if a config exists for a node type
   *
   * @param nodeType - The node type identifier
   * @returns True if a config exists
   */
  has(nodeType: string): boolean {
    return this.configs.has(nodeType);
  }

  /**
   * Get all variant names for a node type
   *
   * @param nodeType - The node type identifier
   * @returns Array of variant names, or empty array if config not found
   *
   * @example
   * ```typescript
   * const variants = ElementConfigRegistry.instance.getVariants('net.noodl.visual.button');
   * // Returns: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link']
   * ```
   */
  getVariants(nodeType: string): string[] {
    const config = this.configs.get(nodeType);
    if (!config) return [];
    return Object.keys(config.variants);
  }

  /**
   * Get all size preset names for a node type
   *
   * @param nodeType - The node type identifier
   * @returns Array of size names, or empty array if no sizes defined
   */
  getSizes(nodeType: string): string[] {
    const config = this.configs.get(nodeType);
    if (!config || !config.sizes) return [];
    return Object.keys(config.sizes);
  }

  /**
   * Get a specific variant configuration
   *
   * @param nodeType - The node type identifier
   * @param variantName - The variant name
   * @returns The variant config, or undefined if not found
   */
  getVariant(nodeType: string, variantName: string): VariantConfig | undefined {
    const config = this.configs.get(nodeType);
    if (!config) return undefined;
    return config.variants[variantName];
  }

  /**
   * Get a specific size configuration
   *
   * @param nodeType - The node type identifier
   * @param sizeName - The size name
   * @returns The size config, or undefined if not found
   */
  getSize(nodeType: string, sizeName: string): SizeConfig | undefined {
    const config = this.configs.get(nodeType);
    if (!config || !config.sizes) return undefined;
    return config.sizes[sizeName];
  }

  /**
   * Apply default styles to a node
   * This should be called when a new node is created
   *
   * @param node - The node model to apply defaults to
   * @returns True if defaults were applied, false if no config found
   *
   * @example
   * ```typescript
   * // In NodeModel constructor or creation hook:
   * ElementConfigRegistry.instance.applyDefaults(newNode);
   * ```
   */
  applyDefaults(node: NodeLike): boolean {
    const config = this.configs.get(node.type);
    if (!config) return false;

    // Apply default CSS properties to node parameters
    for (const [property, value] of Object.entries(config.defaults)) {
      // Only apply if the property doesn't already have a value
      if (node.parameters[property] === undefined) {
        node.parameters[property] = value;
      }
    }

    // Set default variant if defined in defaults
    if (config.defaults['_variant'] && !node.parameters['_variant']) {
      node.parameters['_variant'] = config.defaults['_variant'];
    }

    console.log(`[ElementConfigRegistry] Applied defaults to ${node.type} (node ${node.id})`);
    return true;
  }

  /**
   * Apply a variant to a node
   *
   * @param node - The node model to apply the variant to
   * @param params - Variant application parameters
   * @returns True if variant was applied, false if config or variant not found
   *
   * @example
   * ```typescript
   * ElementConfigRegistry.instance.applyVariant(buttonNode, {
   *   variantName: 'secondary',
   *   preserveUserOverrides: true
   * });
   * ```
   */
  applyVariant(node: NodeLike, params: ApplyVariantParams | string): boolean {
    const variantName = typeof params === 'string' ? params : params.variantName;
    const size = typeof params === 'object' ? params.size : undefined;
    const preserveUserOverrides = typeof params === 'object' ? params.preserveUserOverrides !== false : true;

    const config = this.configs.get(node.type);
    if (!config) {
      console.warn(`[ElementConfigRegistry] No config found for ${node.type}`);
      return false;
    }

    const variant = config.variants[variantName];
    if (!variant) {
      console.warn(`[ElementConfigRegistry] Variant "${variantName}" not found for ${node.type}`);
      return false;
    }

    // Store user overrides if preserving
    const userOverrides: Record<string, any> = {};
    if (preserveUserOverrides) {
      // Detect which properties were user-modified
      // (properties not in defaults or previous variant)
      const previousVariantName = node.parameters['_variant'];
      const previousVariant = previousVariantName ? config.variants[previousVariantName] : null;

      for (const key in node.parameters) {
        if (key.startsWith('_')) continue; // Skip system properties

        const isFromDefaults = config.defaults[key] !== undefined;
        const isFromPreviousVariant = previousVariant && previousVariant[key] !== undefined;

        if (!isFromDefaults && !isFromPreviousVariant) {
          userOverrides[key] = node.parameters[key];
        }
      }
    }

    // Apply variant properties
    for (const [property, value] of Object.entries(variant)) {
      if (property === 'states') continue; // States are handled separately
      if (typeof value === 'string') {
        node.parameters[property] = value;
      }
    }

    // Apply size if specified
    if (size && config.sizes) {
      const sizeConfig = config.sizes[size];
      if (sizeConfig) {
        for (const [property, value] of Object.entries(sizeConfig)) {
          node.parameters[property] = value;
        }
      }
    }

    // Restore user overrides
    if (preserveUserOverrides) {
      for (const [property, value] of Object.entries(userOverrides)) {
        node.parameters[property] = value;
      }
    }

    // Store the variant name
    node.parameters['_variant'] = variantName;
    if (size) {
      node.parameters['_size'] = size;
    }

    console.log(`[ElementConfigRegistry] Applied variant "${variantName}" to ${node.type} (node ${node.id})`);
    return true;
  }

  /**
   * Resolve complete styles for a node
   * Merges defaults + variant + size + user overrides
   *
   * @param params - Resolution parameters
   * @returns Resolved styles with metadata
   *
   * @example
   * ```typescript
   * const result = ElementConfigRegistry.instance.resolveStyles({
   *   nodeType: 'net.noodl.visual.button',
   *   variant: 'primary',
   *   size: 'md',
   *   userOverrides: { backgroundColor: '#custom' }
   * });
   * ```
   */
  resolveStyles(params: ResolveStylesParams): StyleResolutionResult | null {
    const { nodeType, variant, size, userOverrides = {} } = params;

    const config = this.configs.get(nodeType);
    if (!config) return null;

    const styles: Record<string, CSSValue> = {};
    const sources: Record<string, 'default' | 'variant' | 'size' | 'user'> = {};

    // 1. Apply defaults
    for (const [property, value] of Object.entries(config.defaults)) {
      if (property.startsWith('_')) continue; // Skip system properties
      styles[property] = value;
      sources[property] = 'default';
    }

    // 2. Apply variant
    let variantConfig: VariantConfig | undefined;
    if (variant) {
      variantConfig = config.variants[variant];
      if (variantConfig) {
        for (const [property, value] of Object.entries(variantConfig)) {
          if (property === 'states') continue;
          if (typeof value === 'string') {
            styles[property] = value;
            sources[property] = 'variant';
          }
        }
      }
    }

    // 3. Apply size
    if (size && config.sizes) {
      const sizeConfig = config.sizes[size];
      if (sizeConfig) {
        for (const [property, value] of Object.entries(sizeConfig)) {
          styles[property] = value;
          sources[property] = 'size';
        }
      }
    }

    // 4. Apply user overrides (highest priority)
    for (const [property, value] of Object.entries(userOverrides)) {
      styles[property] = value;
      sources[property] = 'user';
    }

    return {
      styles: {
        base: styles,
        states: variantConfig?.states
      },
      appliedVariant: variant,
      appliedSize: size,
      hasUserOverrides: Object.keys(userOverrides).length > 0,
      sources
    };
  }

  /**
   * Validate an element configuration
   *
   * @param config - The config to validate
   * @returns Validation result with errors and warnings
   */
  validate(config: ElementConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!config.nodeType) {
      errors.push('nodeType is required');
    }

    if (!config.defaults) {
      errors.push('defaults object is required');
    }

    if (!config.variants || Object.keys(config.variants).length === 0) {
      errors.push('At least one variant is required');
    }

    // Check variant structure
    if (config.variants) {
      for (const [variantName, variantConfig] of Object.entries(config.variants)) {
        if (!variantConfig || typeof variantConfig !== 'object') {
          errors.push(`Variant "${variantName}" must be an object`);
        }
      }
    }

    // Warnings for missing common properties
    if (config.defaults && !config.defaults['_variant']) {
      warnings.push('No default variant specified in defaults._variant');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get all registered node types
   *
   * @returns Array of registered node type identifiers
   */
  getRegisteredNodeTypes(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get count of registered configs
   *
   * @returns Number of registered configs
   */
  getCount(): number {
    return this.configs.size;
  }

  /**
   * Clear all registered configs
   * WARNING: This is mainly for testing, use with caution
   */
  clear(): void {
    this.configs.clear();
    console.log('[ElementConfigRegistry] Cleared all configs');
  }

  /**
   * Get a summary of the registry state
   *
   * @returns Summary object with counts and node types
   */
  getSummary(): {
    totalConfigs: number;
    nodeTypes: string[];
    configDetails: Array<{
      nodeType: string;
      variantCount: number;
      sizeCount: number;
      hasDescription: boolean;
    }>;
  } {
    const nodeTypes = this.getRegisteredNodeTypes();
    const configDetails = nodeTypes.map((nodeType) => {
      const config = this.configs.get(nodeType)!;
      return {
        nodeType,
        variantCount: Object.keys(config.variants).length,
        sizeCount: config.sizes ? Object.keys(config.sizes).length : 0,
        hasDescription: !!config.description
      };
    });

    return {
      totalConfigs: this.configs.size,
      nodeTypes,
      configDetails
    };
  }
}

// Export singleton instance for convenience
export const registry = ElementConfigRegistry.instance;
