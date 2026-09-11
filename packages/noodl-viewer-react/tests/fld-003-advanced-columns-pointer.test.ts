/**
 * FLD-003 — the pointer from the Columns node to the Advanced Columns prefab, and the prefab
 * it points at.
 *
 * [#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22), Richard: *"I actually
 * wonder if a prefab is the right call here, with even a reference to it in the Columns node so
 * a user would see 'Ok I have these basic Small and Medium options, or it says here I can search
 * the prefabs for Advanced Columns'."*
 *
 * ## What this file is for
 *
 * A pointer is a pair, and a pair rots from either end: the prefab can be renamed or dropped, or
 * the port text can be rewritten by somebody who never knew the sentence was load-bearing. The
 * enrichment on this very node was stale for weeks and nothing said so (FLD-002 §2), which is
 * why AC4 asks for the surface to be *read* rather than trusted. So every assertion below
 * derives the string it looks for from `library.json`'s own label rather than restating it:
 * rename the prefab and this file fails, which is the whole point of it existing.
 *
 * Three copies of that sentence exist and all three are generated or mirrored from the node
 * definition — the panel tooltip, `node-catalog.json` (which is what the MCP authoring loop
 * reads), and the enrichment file rendered in the picker preview. Each is checked against the
 * source, so a stale catalog fails here as staleness rather than three weeks later as a node
 * that documents a prefab nobody can find.
 *
 * ⚠️ **AC5 is an absence, so it is asserted beside a signal known to fire.** "No `matchMedia` in
 * the prefab" is worth nothing unless the same search finds one in `prefabs/media-query`, which
 * is built on exactly the viewport-keyed mechanism this prefab must not copy — Columns
 * breakpoints are container-keyed and the two do not compose.
 */
/* eslint-env jest */

import * as fs from 'fs';
import * as path from 'path';

import ColumnsNodeModule from '../src/nodes/visual/columns';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PREFAB_DIR = path.join(REPO_ROOT, 'library/prefabs/advanced-columns');

const readJSON = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const meta = readJSON(path.join(PREFAB_DIR, 'library.json'));
const smallLayout = (ColumnsNodeModule as any).node.inputs.smallLayout;

describe('FLD-003 — the prefab the Columns node points at', () => {
  it('ships as a prefab entry with an icon, under the slug the pointer names', () => {
    expect(meta.type).toBe('prefab');
    expect(meta.label).toBe('Advanced Columns');
    expect(fs.existsSync(path.join(PREFAB_DIR, meta.icon))).toBe(true);
    expect(fs.existsSync(path.join(PREFAB_DIR, 'project/project.json'))).toBe(true);
  });

  it('names the prefab in the port a person is standing on when they want it', () => {
    // `Small Layout` is the last of the four breakpoint inputs: the place someone has reached
    // when they have used both bands this node has and are looking for a third.
    expect(smallLayout.description).toContain(meta.label);
    expect(smallLayout.tooltip).toContain(meta.label);
    expect(smallLayout.tooltip).toContain('library');
  });

  it('says it in the generated catalog too, because that is the copy the MCP loop reads', () => {
    const catalog = readJSON(path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog.json'));
    const columns = catalog.nodes.find((n: any) => n.typeName === 'net.noodl.visual.columns');
    const port = columns.inputs.find((p: any) => p.name === 'smallLayout');
    // Equality, not `toContain`: a catalog that merely mentions the prefab while the source has
    // moved on is the staleness this is here to catch.
    expect(port.description).toBe(smallLayout.description);
  });

  it('says it in the enrichment, which is the copy the node picker renders', () => {
    const enrichment = readJSON(
      path.join(REPO_ROOT, 'docs/node-catalog/enrichment/net.noodl.visual.columns.json')
    );
    expect(enrichment.ports.smallLayout).toContain(meta.label);
  });
});

describe('FLD-003 — what the prefab keys off', () => {
  const project = readJSON(path.join(PREFAB_DIR, 'project/project.json'));
  const source = fs.readFileSync(path.join(PREFAB_DIR, 'project/project.json'), 'utf8');

  const component = project.components.find((c: any) => c.name === '/Advanced Columns');
  const nodes: any[] = [];
  const walk = (n: any) => {
    nodes.push(n);
    (n.children || []).forEach(walk);
  };
  (component.graph.roots || []).forEach(walk);
  const byType = (type: string) => nodes.filter((n) => n.type === type);
  const columnsNode = byType('net.noodl.visual.columns')[0];
  const statesNode = byType('States')[0];
  const connections: any[] = component.graph.connections;

  it('does not key off window.matchMedia — and the search that says so finds one next door', () => {
    // The signal, first: media-query is built on matchMedia, so a search that comes back empty
    // there is a broken search and not a clean prefab.
    const mediaQuery = fs.readFileSync(
      path.join(REPO_ROOT, 'library/prefabs/media-query/project/project.json'),
      'utf8'
    );
    expect(mediaQuery).toContain('matchMedia');
    expect(source).not.toContain('matchMedia');
    expect(source).not.toContain('/Media Queries/');
  });

  it('decides its band from the Columns node\'s own measured width', () => {
    const toBand = connections.find(
      (c) => c.fromId === columnsNode.id && c.fromProperty === 'boundingWidth'
    );
    expect(toBand).toBeDefined();
    // …and that reading is what chooses the state, rather than the state being set by hand.
    const expression = nodes.find((n) => n.id === toBand.toId);
    expect(expression.type).toBe('Expression');
    const toState = connections.find(
      (c) => c.fromId === expression.id && c.toId === statesNode.id && c.toProperty === 'currentState'
    );
    expect(toState).toBeDefined();
  });

  it('has more bands than the two the node itself has, each with its own layout and gaps', () => {
    const states: string[] = statesNode.parameters.states.split(',');
    expect(states.length).toBeGreaterThan(3); // Default/Medium/Small is what the node already does
    for (const state of states) {
      expect(typeof statesNode.parameters[`value-${state}-Layout`]).toBe('string');
      expect(typeof statesNode.parameters[`value-${state}-Horizontal Gap`]).toBe('number');
      expect(typeof statesNode.parameters[`value-${state}-Vertical Gap`]).toBe('number');
    }
    // Every band's expression must resolve to a state the node has, or `goToState` fails at
    // runtime with the band it was asked for — the one failure a screenshot cannot show.
    const expression = nodes.find((n) => n.type === 'Expression').parameters.expression;
    for (const state of states) expect(expression).toContain(`'${state}'`);
  });

  it('exposes the three thresholds on the instance, and still carries their defaults', () => {
    const inputs = nodes.find((n) => n.type === 'Component Inputs');
    const expression = nodes.find((n) => n.type === 'Expression');
    const named = (inputs.ports || []).map((p: any) => p.name);
    expect(named).toEqual(['Large Below', 'Medium Below', 'Small Below']);

    for (const [port, arg] of [
      ['Large Below', 'large'],
      ['Medium Below', 'medium'],
      ['Small Below', 'small']
    ]) {
      expect(
        connections.find(
          (c) =>
            c.fromId === inputs.id && c.fromProperty === port &&
            c.toId === expression.id && c.toProperty === arg
        )
      ).toBeDefined();
      // 🔴 The default has to survive the wire. A component input carries no default of its own,
      // so if a wired-but-unset port arrived as `undefined` every comparison in the expression
      // would be false and every instance would sit in one band for ever. Measured in the drive
      // — an unset input does not arrive — and the parameter below is what it leaves standing.
      expect(typeof expression.parameters[arg]).toBe('number');
    }
  });

  it('drives the numeric Columns inputs, which is the half a layout string cannot do', () => {
    for (const [from, to] of [
      ['Layout', 'layoutString'],
      ['Horizontal Gap', 'marginX'],
      ['Vertical Gap', 'marginY']
    ]) {
      expect(
        connections.find(
          (c) =>
            c.fromId === statesNode.id &&
            c.fromProperty === from &&
            c.toId === columnsNode.id &&
            c.toProperty === to
        )
      ).toBeDefined();
    }
  });
});
