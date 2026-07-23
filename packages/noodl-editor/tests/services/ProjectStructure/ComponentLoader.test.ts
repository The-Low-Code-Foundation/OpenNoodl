/**
 * ComponentLoader tests — STRUCT-005 (SUB-001)
 */
import { ComponentLoader } from '../../../src/editor/src/services/ProjectStructure/ComponentLoader';
import { MemFs } from './memfs';
import { makeProject, seedV2Project } from './fixtures';

const DIR = '/proj';

function setup() {
  const fs = new MemFs();
  seedV2Project(fs, DIR, makeProject());
  return fs;
}

describe('ComponentLoader', () => {
  it('loads a component and reconstructs its legacy shape', async () => {
    const loader = new ComponentLoader(setup());
    const home = await loader.loadComponent(DIR, 'Pages/Home');

    expect(home.name).toBe('/Pages/Home');
    expect(home.graph.roots.length).toBe(1);
    // child tree is rebuilt from the flat nodes
    expect(home.graph.roots[0].children[0].id).toBe('home2');
    expect(home.graph.connections.length).toBe(1);
  });

  it('serves a cache hit without re-reading disk', async () => {
    const fs = setup();
    const loader = new ComponentLoader(fs);
    const first = await loader.loadComponent(DIR, 'Header');

    // Mutate the on-disk file; a cache hit must NOT reflect it.
    fs.files.set(
      fs.join(DIR, 'components/Header/component.json'),
      JSON.stringify({ id: 'x', name: 'Header', path: '/Header', type: 'visual', metadata: { touched: true } })
    );
    const second = await loader.loadComponent(DIR, 'Header');
    expect(second).toBe(first); // same cached object
    expect(second.metadata).toBeUndefined();
  });

  it('re-reads after TTL expiry', async () => {
    const fs = setup();
    let clock = 1000;
    const loader = new ComponentLoader(fs, { maxCacheAge: 100, now: () => clock });

    await loader.loadComponent(DIR, 'Header');
    clock += 5000; // beyond TTL

    fs.files.set(
      fs.join(DIR, 'components/Header/component.json'),
      JSON.stringify({ id: 'comp__Header', name: 'Header', path: '/Header', type: 'visual', metadata: { touched: true } })
    );
    const reloaded = await loader.loadComponent(DIR, 'Header');
    expect(reloaded.metadata).toEqual({ touched: true });
  });

  it('evicts oldest entries beyond the cache size cap', async () => {
    const fs = new MemFs();
    let clock = 0;
    const project = makeProject({
      components: Array.from({ length: 5 }, (_, i) => ({
        name: `/C${i}`,
        id: `c${i}`,
        graph: { roots: [], connections: [] }
      }))
    });
    seedV2Project(fs, DIR, project);

    const loader = new ComponentLoader(fs, { maxCacheSize: 2, now: () => (clock += 10) });
    await loader.loadComponent(DIR, 'C0');
    await loader.loadComponent(DIR, 'C1');
    await loader.loadComponent(DIR, 'C2');

    expect(loader.cacheSize).toBe(2); // pruned to cap
  });

  it('invalidate(path) drops just that component', async () => {
    const loader = new ComponentLoader(setup());
    await loader.loadComponent(DIR, 'Header');
    await loader.loadComponent(DIR, 'Pages/Home');
    expect(loader.cacheSize).toBe(2);

    loader.invalidate('Header');
    expect(loader.cacheSize).toBe(1);

    loader.invalidate();
    expect(loader.cacheSize).toBe(0);
  });

  it('preloadComponents warms the cache in parallel', async () => {
    const loader = new ComponentLoader(setup());
    const loaded = await loader.preloadComponents(DIR, ['Header', 'Pages/Home', '%rootcomponent']);
    expect(loaded.length).toBe(3);
    expect(loader.cacheSize).toBe(3);
  });
});
