import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { parseProject } from '../src/parse/parseProject';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

describe('parseProject over the puppy-test-3 fixture', () => {
  const ir = parseProject(FIXTURE, catalog);

  test('reads project metadata, tokens and collections', () => {
    expect(ir.project.name).toBe('Puppy test 3');
    expect(ir.project.catalogFormatVersion).toBe(catalog.catalogFormatVersion);

    const primary = ir.project.designTokens.find((t) => t.name === '--primary');
    expect(primary).toBeDefined();
    expect(primary!.value).toBe('#18181b');
    expect(primary!.description).toBe('Main brand and action color');

    const puppy = ir.project.collections.find((c) => c.name === 'Puppy');
    expect(puppy).toBeDefined();
    expect(puppy!.columns).toContainEqual({ name: 'available', type: 'Boolean' });
  });

  test('components sort by path (D1) and carry roles from component.json', () => {
    const paths = ir.components.map((c) => c.path);
    expect(paths).toEqual([...paths].sort());

    const landing = ir.components.find((c) => c.path === 'Pages/Landing');
    expect(landing).toBeDefined();
    expect(landing!.role).toBe('page');

    const card = ir.components.find((c) => c.path === 'Components/PuppyCard');
    expect(card).toBeDefined();
    expect(card!.role).toBe('component');
  });

  test('connection keys use the GraphSnapshot format and source-port kinds resolve', () => {
    const landing = ir.components.find((c) => c.path === 'Pages/Landing')!;

    const items = landing.connections.find((c) => c.toId === 'repeater');
    expect(items).toBeDefined();
    expect(items!.key).toBe('puppyQuery:items->repeater:items');
    expect(items!.kind).toBe('value');

    const click = landing.connections.find((c) => c.fromId === 'submitButton');
    expect(click).toBeDefined();
    expect(click!.key).toBe('submitButton:onClick->navThankYou:navigate');
    expect(click!.kind).toBe('signal');
  });

  test('an unauthored mapping script lives on the declared port default, not in parameters', () => {
    // The fixture's For Each never had its mapping customised: `parameters` holds only
    // `template`, and the identity map({...}) script exists solely as the declared port's
    // default. Faithful parsing means sourceText stays undefined (nothing was authored) and
    // the effective-mapping rule in analysis must consult declared-port defaults.
    const landing = ir.components.find((c) => c.path === 'Pages/Landing')!;
    const repeater = landing.nodes.find((n) => n.id === 'repeater')!;
    expect(repeater.sourceText).toBeUndefined();
    expect(repeater.parameters.map((p) => p.name)).toEqual(['template']);

    const declared = repeater.declaredPorts.find((p) => p.name === 'inputMappingScript')!;
    expect(declared).toBeDefined();
    expect(String(declared.default)).toContain("'photo': 'photo'");
  });

  test('portKnowledge distinguishes component instances from parameter-dependent catalog nodes', () => {
    const landing = ir.components.find((c) => c.path === 'Pages/Landing')!;
    const query = landing.nodes.find((n) => n.id === 'puppyQuery')!;
    expect(query.portKnowledge).toBe('partial');
    expect(query.catalogRef).toBe('DbCollection2');

    // For Each's `template` parameter references a component; the node itself is a catalog node.
    const grid = ir.components.find((c) => c.path === 'Pages/Landing')!.nodes.find((n) => n.id === 'grid')!;
    expect(grid.catalogRef).toBe('Group');
  });

  test('authoredLabel reflects serialized-key presence, never a defaulting getter', () => {
    const landing = ir.components.find((c) => c.path === 'Pages/Landing')!;
    expect(landing.nodes.find((n) => n.id === 'page')!.authoredLabel).toBe('Landing page root');

    const app = ir.components.find((c) => c.path === 'App')!;
    const router = app.nodes.find((n) => n.type === 'Router')!;
    expect(router.authoredLabel).toBeUndefined();
  });

  test('parameters are dimension/literal-classified and name-sorted (D3)', () => {
    const landing = ir.components.find((c) => c.path === 'Pages/Landing')!;
    const root = landing.nodes.find((n) => n.id === 'root')!;

    const names = root.parameters.map((p) => p.name);
    expect(names).toEqual([...names].sort());

    expect(root.parameters.find((p) => p.name === 'width')!.value).toEqual({
      kind: 'dimension',
      value: 100,
      unit: '%'
    });
    expect(root.parameters.find((p) => p.name === 'backgroundColor')!.value).toEqual({
      kind: 'literal',
      value: 'var(--surface)'
    });
  });

  test('the router is collected with start page and source-order routes', () => {
    expect(ir.project.routers).toHaveLength(1);
    const router = ir.project.routers[0];
    expect(router.name).toBe('Main');
    expect(router.startPage).toBe('/Pages/Landing');
    expect(router.routes).toEqual([
      '/#__page__/Home',
      '/Pages/Landing',
      '/Pages/Thank You',
      '/Pages/Admin Login',
      '/Pages/Admin'
    ]);
  });

  test('parsing is deterministic: two runs serialise identically (D-rules)', () => {
    const again = parseProject(FIXTURE, catalog);
    expect(JSON.stringify(again)).toBe(JSON.stringify(ir));
  });
});
