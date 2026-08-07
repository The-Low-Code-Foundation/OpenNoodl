/**
 * Minimal browser globals so the viewer packages' node modules can be loaded
 * headlessly in Node. Node *registration* is metadata-only and never renders,
 * but a handful of modules touch `window`/`document`/`Noodl` at module scope.
 */
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node-catalog-generator', platform: 'node' };
}
if (typeof globalThis.document === 'undefined') {
  const noopEl = () => ({
    style: {},
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => null
  });
  globalThis.document = {
    createElement: noopEl,
    createTextNode: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
    head: noopEl(),
    body: noopEl(),
    documentElement: noopEl(),
    location: { hostname: 'localhost', protocol: 'http:', href: 'http://localhost/' },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    getElementsByTagName: () => []
  };
}
if (typeof globalThis.location === 'undefined') {
  globalThis.location = globalThis.document.location;
}
// A few node modules reference the deployed viewer's global `Noodl` JS API at
// module scope (e.g. `Noodl.deployed`). A recursive noop proxy satisfies them.
if (typeof globalThis.Noodl === 'undefined') {
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  globalThis.Noodl = new Proxy({ deployed: false }, { get: (t, k) => (k in t ? t[k] : noop) });
}
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
