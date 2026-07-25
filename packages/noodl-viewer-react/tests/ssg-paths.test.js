/**
 * Unit tests for SSG route enumeration + output mapping (RUN-002 step 5).
 */
const { routesFromExport, outputPathFor } = require('../static/ssr/ssg-paths');

describe('routesFromExport', () => {
  it('returns the root route plus every static page from the router index', () => {
    const { routes, dynamicRoutes } = routesFromExport({
      routerIndex: {
        pages: [
          { path: 'home', title: 'Home', component: '/#__page__/Home' },
          { path: 'second', title: 'Second', component: '/#__page__/Second' }
        ]
      }
    });
    expect(routes).toEqual(['/', '/home', '/second']);
    expect(dynamicRoutes).toEqual([]);
  });

  it('separates dynamic routes instead of silently dropping them', () => {
    const { routes, dynamicRoutes } = routesFromExport({
      routerIndex: {
        pages: [
          { path: 'products', component: '/#__page__/Products' },
          { path: 'products/{id}', component: '/#__page__/Product' }
        ]
      }
    });
    expect(routes).toEqual(['/', '/products']);
    expect(dynamicRoutes).toEqual(['/products/{id}']);
  });

  it('dedupes and tolerates already-slashed paths', () => {
    const { routes } = routesFromExport({
      routerIndex: {
        pages: [
          { path: '/home', component: 'a' },
          { path: 'home', component: 'a' }
        ]
      }
    });
    expect(routes).toEqual(['/', '/home']);
  });

  it('handles a missing or empty router index (single-page project)', () => {
    expect(routesFromExport({}).routes).toEqual(['/']);
    expect(routesFromExport({ routerIndex: { pages: [] } }).routes).toEqual(['/']);
    expect(routesFromExport(undefined).routes).toEqual(['/']);
  });

  it('ignores malformed page entries', () => {
    const { routes } = routesFromExport({
      routerIndex: { pages: [null, {}, { path: '' }, { path: 'ok' }] }
    });
    expect(routes).toEqual(['/', '/ok']);
  });
});

describe('outputPathFor', () => {
  it('maps the root route to index.html', () => {
    expect(outputPathFor('/')).toBe('index.html');
  });

  it('maps routes to directory-index files so static hosts need no rewrites', () => {
    expect(outputPathFor('/second')).toBe('second/index.html');
    expect(outputPathFor('/a/b')).toBe('a/b/index.html');
  });

  it('normalises redundant slashes', () => {
    expect(outputPathFor('//second/')).toBe('second/index.html');
  });
});
