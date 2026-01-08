/**
 * Noodl.Config API
 *
 * Creates the immutable Noodl.Config proxy object that provides access
 * to app-wide configuration values defined in App Setup.
 *
 * @module api/config
 */

import { AppConfig, DEFAULT_APP_CONFIG } from '@noodl/runtime/src/config/types';

/**
 * Builds the flat config object exposed as Noodl.Config.
 * This flattens identity, SEO, PWA, and custom variables into a single object.
 */
function buildFlatConfig(appConfig: Partial<AppConfig> | undefined): Record<string, unknown> {
  if (!appConfig) {
    appConfig = {};
  }

  const config = {
    ...DEFAULT_APP_CONFIG,
    ...appConfig,
    identity: {
      ...DEFAULT_APP_CONFIG.identity,
      ...appConfig.identity
    },
    seo: {
      ...DEFAULT_APP_CONFIG.seo,
      ...appConfig.seo
    },
    variables: appConfig.variables || []
  };

  const flat: Record<string, unknown> = {
    // Identity fields
    appName: config.identity.appName,
    description: config.identity.description,
    coverImage: config.identity.coverImage,

    // SEO fields (with smart defaults)
    ogTitle: config.seo.ogTitle || config.identity.appName,
    ogDescription: config.seo.ogDescription || config.identity.description,
    ogImage: config.seo.ogImage || config.identity.coverImage,
    favicon: config.seo.favicon,
    themeColor: config.seo.themeColor,

    // PWA fields
    pwaEnabled: config.pwa?.enabled ?? false,
    pwaShortName: config.pwa?.shortName,
    pwaDisplay: config.pwa?.display,
    pwaStartUrl: config.pwa?.startUrl,
    pwaBackgroundColor: config.pwa?.backgroundColor
  };

  // Add custom variables
  for (const variable of config.variables) {
    flat[variable.key] = variable.value;
  }

  return flat;
}

/**
 * Creates the Noodl.Config proxy object.
 * Returns an immutable object that throws helpful errors on write attempts.
 *
 * Uses lazy evaluation via getMetaData to handle async metadata loading.
 *
 * @param getMetaData - Function to get metadata by key (from noodlRuntime)
 * @returns Readonly proxy to the configuration object
 */
export function createConfigAPI(getMetaData: (key: string) => unknown): Readonly<Record<string, unknown>> {
  const getConfig = (): Record<string, unknown> => {
    // Rebuild config on each access to handle late-loaded metadata
    const appConfig = getMetaData('appConfig') as Partial<AppConfig> | undefined;
    return buildFlatConfig(appConfig);
  };

  return new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string | symbol) {
      // Handle special Proxy methods
      if (typeof prop === 'symbol') {
        return undefined;
      }

      const config = getConfig();
      if (prop in config) {
        return config[prop];
      }
      console.warn(`Noodl.Config.${prop} is not defined`);
      return undefined;
    },

    has(_target, prop: string) {
      const config = getConfig();
      return prop in config;
    },

    ownKeys() {
      const config = getConfig();
      return Reflect.ownKeys(config);
    },

    getOwnPropertyDescriptor(_target, prop: string) {
      const config = getConfig();
      if (prop in config) {
        return {
          enumerable: true,
          configurable: true,
          value: config[prop]
        };
      }
      return undefined;
    },

    set(_target, prop: string) {
      console.error(
        `Cannot set Noodl.Config.${prop} - Config values are immutable. ` +
          `Use Noodl.Variables for runtime-changeable values.`
      );
      return false;
    },

    deleteProperty(_target, prop: string) {
      console.error(`Cannot delete Noodl.Config.${prop} - Config values are immutable.`);
      return false;
    }
  });
}
