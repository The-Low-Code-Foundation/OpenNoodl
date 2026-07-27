/**
 * The deployed app's config parameters, fetched once and cached.
 *
 * Two transports, chosen by which runtime is executing: `XMLHttpRequest` in a browser
 * viewer, `fetch` in the cloud runtime (where the credentials are baked into the bundle
 * as `_noodl_cloudservices` rather than read from the runtime's metadata).
 *
 * @module noodl-runtime
 */

/** What `_makeRequest` reports back. Both callbacks are required. */
interface ConfigRequestCallbacks {
  success(result: ConfigResponse): void;
  error(error: unknown): void;
}

/** The backend's `/config` response. Only `params` is read. */
interface ConfigResponse {
  params?: Record<string, unknown>;
}

// `NoodlRuntime.instance` is assigned inside the constructor of an untyped `.js` entry
// point, which TypeScript's inference of that file does not track — so an
// `import … = require()` resolves `instance` to nothing. A bare require is the workaround
// ~10 converted files use; see PLAT-003 NOTES §29.4 and PLAT-006.
const NoodlRuntime = require('../../../noodl-runtime');

class ConfigService {
  static instance: ConfigService;

  /** How long a fetched config stays fresh before a background refresh is started. */
  cacheDuration: number;
  /** Absolute time at which {@link configCache} goes stale. */
  ttl?: number;
  configCache?: Record<string, unknown>;
  /** In-flight fetch, so concurrent callers share one request rather than racing. */
  configCachePending?: Promise<Record<string, unknown>>;

  /** Only read on the cloud-runtime branch, and only when no baked credentials exist. */
  endpoint?: string;
  appId?: string;

  constructor() {
    this.cacheDuration = 15 * 60 * 1000; // 15 min cache
  }

  _makeRequest(path: string, options: ConfigRequestCallbacks) {
    if (typeof _noodl_cloud_runtime_version === 'undefined') {
      // Running in browser
      var xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          var json;
          try {
            json = JSON.parse(xhr.response);
          } catch (e) {}

          if (xhr.status === 200 || xhr.status === 201) {
            options.success(json);
          } else options.error(json || { error: xhr.responseText, status: xhr.status });
        }
      };

      const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');
      const appId = cloudServices.appId;
      const endpoint = cloudServices.endpoint;
      xhr.open('GET', endpoint + path, true);

      xhr.setRequestHeader('X-Parse-Application-Id', appId);

      xhr.send();
    } else {
      // Running in cloud runtime
      const endpoint = typeof _noodl_cloudservices !== 'undefined' ? _noodl_cloudservices.endpoint : this.endpoint;
      const appId = typeof _noodl_cloudservices !== 'undefined' ? _noodl_cloudservices.appId : this.appId;
      const masterKey = typeof _noodl_cloudservices !== 'undefined' ? _noodl_cloudservices.masterKey : undefined;

      fetch(endpoint + path, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': appId,
          'X-Parse-Master-Key': masterKey
        }
      })
        .then((r) => {
          if (r.status === 200 || r.status === 201) {
            r.json()
              .then((json) => options.success(json))
              .catch((e) =>
                options.error({
                  error: 'Config: Failed to get json result.'
                })
              );
          } else {
            r.json()
              .then((json) => options.error(json))
              .catch((e) => options.error({ error: 'Failed to fetch.' }));
          }
        })
        .catch((e) => {
          options.error({ error: e.message });
        });
    }
  }

  _getConfig(): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      this._makeRequest('/config', {
        success: (config) => {
          resolve(config.params || {});
        },
        error: (err) => {
          reject(err);
        }
      });
    });
  }

  async getConfig() {
    if (this.configCachePending) return this.configCachePending;

    if (!this.configCache) {
      this.configCachePending = this._getConfig();

      this.configCache = await this.configCachePending;
      delete this.configCachePending;
      this.ttl = Date.now() + this.cacheDuration;
      return this.configCache;
    } else {
      // Update cache if ttl has passed
      if (Date.now() > this.ttl) {
        this._getConfig().then((config) => {
          this.configCache = config;
          this.ttl = Date.now() + this.cacheDuration;
        });
      }

      // But return currently cached
      return this.configCache;
    }
  }

  clearCache() {
    delete this.configCache;
  }
}

ConfigService.instance = new ConfigService();

export = ConfigService;
