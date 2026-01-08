/**
 * Configuration Manager
 *
 * Central manager for app configuration. Initializes config at app startup
 * and provides immutable access to configuration values via Noodl.Config.
 *
 * @module config/config-manager
 */

import { AppConfig, ConfigVariable, DEFAULT_APP_CONFIG } from './types';

/**
 * Deep freezes an object recursively to prevent any mutation.
 */
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}

/**
 * ConfigManager is a singleton that manages the app configuration.
 * It is initialized once at app startup with config from project metadata.
 */
class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig = DEFAULT_APP_CONFIG;
  private frozenConfig: Readonly<Record<string, unknown>> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Gets the singleton instance.
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initializes the configuration from project metadata.
   * This should be called once at app startup.
   *
   * @param config - Partial app config from project.json metadata
   */
  initialize(config: Partial<AppConfig>): void {
    // Merge with defaults
    this.config = {
      ...DEFAULT_APP_CONFIG,
      ...config,
      identity: {
        ...DEFAULT_APP_CONFIG.identity,
        ...config.identity
      },
      seo: {
        ...DEFAULT_APP_CONFIG.seo,
        ...config.seo
      },
      variables: config.variables || []
    };

    // Build and freeze the public config object
    this.frozenConfig = this.buildFrozenConfig();
  }

  /**
   * Gets the immutable public configuration object.
   * This is what's exposed as Noodl.Config.
   *
   * @returns Frozen config object with all values
   */
  getConfig(): Readonly<Record<string, unknown>> {
    if (!this.frozenConfig) {
      this.frozenConfig = this.buildFrozenConfig();
    }
    return this.frozenConfig;
  }

  /**
   * Gets the raw configuration object (for editor use).
   * This includes the full structure with identity, seo, pwa, and variables.
   *
   * @returns The full app config object
   */
  getRawConfig(): AppConfig {
    return this.config;
  }

  /**
   * Gets a specific variable definition by key.
   *
   * @param key - The variable key
   * @returns The variable definition or undefined if not found
   */
  getVariable(key: string): ConfigVariable | undefined {
    return this.config.variables.find((v) => v.key === key);
  }

  /**
   * Gets all variable keys (for autocomplete/suggestions).
   *
   * @returns Array of all custom variable keys
   */
  getVariableKeys(): string[] {
    return this.config.variables.map((v) => v.key);
  }

  /**
   * Builds the flat, frozen config object exposed as Noodl.Config.
   * This flattens identity, SEO, PWA, and custom variables into a single object.
   *
   * @returns The frozen config object
   */
  private buildFrozenConfig(): Readonly<Record<string, unknown>> {
    const config: Record<string, unknown> = {
      // Identity fields
      appName: this.config.identity.appName,
      description: this.config.identity.description,
      coverImage: this.config.identity.coverImage,

      // SEO fields (with smart defaults)
      ogTitle: this.config.seo.ogTitle || this.config.identity.appName,
      ogDescription: this.config.seo.ogDescription || this.config.identity.description,
      ogImage: this.config.seo.ogImage || this.config.identity.coverImage,
      favicon: this.config.seo.favicon,
      themeColor: this.config.seo.themeColor,

      // PWA fields
      pwaEnabled: this.config.pwa?.enabled ?? false,
      pwaShortName: this.config.pwa?.shortName,
      pwaDisplay: this.config.pwa?.display,
      pwaStartUrl: this.config.pwa?.startUrl,
      pwaBackgroundColor: this.config.pwa?.backgroundColor
    };

    // Add custom variables
    for (const variable of this.config.variables) {
      config[variable.key] = variable.value;
    }

    // Deep freeze to prevent any mutation
    return deepFreeze(config);
  }

  /**
   * Resets the config manager (primarily for testing).
   * @internal
   */
  reset(): void {
    this.config = DEFAULT_APP_CONFIG;
    this.frozenConfig = null;
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();

// Export class for testing
export { ConfigManager };
