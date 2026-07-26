import { RouterHandler } from '../nodes/navigation/router-handler';

const NoodlRuntime = require('@noodl/runtime');

export interface PopupResult {
  /** The Close Popup node's action name, with its `closeAction-` prefix stripped. */
  action: string;
  parameters: unknown;
}

export interface NavigateToPathOptions {
  /** Appended as a `?a=1&b=2` query string. Values are not URL-encoded. */
  query?: Record<string, unknown>;
}

interface NavigationApi {
  /** Set by `createNoodlAPI` immediately after this module is loaded. */
  _noodlRuntime?: any;
  showPopup(componentPath: string, params?: Record<string, unknown>): Promise<PopupResult>;
  navigate(routerName: string, targetPageName: string, params?: Record<string, string | number | boolean>): void;
  navigateToPath(path: string, options?: NavigateToPathOptions): void;
}

/** `Noodl.Navigation` — the navigation half of the project-facing JavaScript API. */
const navigation: NavigationApi = {
  async showPopup(componentPath, params) {
    return new Promise((resolve) => {
      navigation._noodlRuntime.context.showPopup(componentPath, params, {
        onClosePopup: (action: string, results: unknown) => {
          resolve({
            action: action.replace('closeAction-', ''),
            parameters: results
          });
        }
      });
    });
  },

  navigate(routerName, targetPageName, params) {
    RouterHandler.instance.navigate(routerName, {
      target: targetPageName,
      params: params
    });
  },

  /**
   * Pushes a URL and fires a synthetic `popstate` so the Router reacts, since
   * `pushState` alone does not emit one.
   *
   * Which half of the URL the path lands in depends on the project's
   * `navigationPathType` setting: `hash` (the default, and what an unset value
   * means) puts it after `#`, `path` puts it in the pathname.
   */
  navigateToPath(path, options) {
    let hashPath: string, urlPath: string;
    const navigationPathType = NoodlRuntime.instance.getProjectSettings()['navigationPathType'];
    if (navigationPathType === undefined || navigationPathType === 'hash') hashPath = path;
    else urlPath = path;

    const query = [];
    if (options && options.query !== undefined) {
      for (const key in options.query) {
        query.push(key + '=' + options.query[key]);
      }
    }

    const compiledUrl =
      (urlPath !== undefined ? urlPath : '') +
      (query.length >= 1 ? '?' + query.join('&') : '') +
      (hashPath !== undefined ? '#' + hashPath : '');

    window.history.pushState({}, '', compiledUrl);
    dispatchEvent(new PopStateEvent('popstate', {}));
  }
};

export default navigation;
