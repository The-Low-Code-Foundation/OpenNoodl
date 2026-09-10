/**
 * HLS-015 — the deploy engine's reading of the folder it wrote.
 *
 * 🔴 **The subject is register row C67**, and the reason it needs a spec of its own is that it is
 * invisible to every natural instrument. An export made with an unpopulated node library keeps all
 * 21 components, all 375 nodes and **93 of 93 connections**; the only field that moves is `roots`,
 * and `ComponentInstanceNode.render()` returns `null` when it is empty. HLS-010 measured that;
 * `tests/hls015-drive.mjs` put both arms in a real Chrome and read 1,881 characters against 0.
 * These rows are the cheap half of the same question, so that the rule has a gate that runs in
 * milliseconds and not only one that needs a browser.
 *
 * ⚠️ `readDeployedRoots` reads the ARTEFACT rather than the model that produced it. Everything
 * upstream of the write agreed the deploy had succeeded in the arm that produced C67, so a reading
 * taken any earlier reads the same agreement.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { gradeRoots, readDeployedRoots, type RootsReading } from '../src/deployReading';

/** A written deploy folder, small enough to read and shaped exactly like a real one. */
function writeDeploy(
  dir: string,
  components: { name: string; roots: string[] }[],
  options: { rootComponent?: string | null; bundled?: { name: string; roots: string[] }[] } = {}
): void {
  fs.mkdirSync(dir, { recursive: true });
  const data = {
    rootComponent: options.rootComponent === undefined ? '/App' : options.rootComponent,
    components: components.map((component) => ({ name: component.name, roots: component.roots, nodes: [] }))
  };
  // The real file is the runtime with the export spliced into it as a literal, so the reader has
  // to find where the object ends rather than parsing the file. Both halves are reproduced.
  fs.writeFileSync(
    path.join(dir, 'index-deadbeef.js'),
    `!function(){"use strict";var x={a:"}"};window.projectData=${JSON.stringify(data)};console.log("{")}();\n`
  );
  if (options.bundled) {
    fs.mkdirSync(path.join(dir, 'noodl_bundles'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'noodl_bundles', 'b1.json'),
      JSON.stringify(options.bundled.map((c) => ({ name: c.name, roots: c.roots, nodes: [] })))
    );
  }
}

describe('HLS-015 — reading a written deploy', () => {
  let tmp: string;
  beforeEach(() => (tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls015-roots-'))));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('counts the components that carry a root', () => {
    writeDeploy(tmp, [
      { name: '/App', roots: ['n1'] },
      { name: '/Pages/Home', roots: ['n2'] },
      { name: '/Helpers/Timer', roots: [] }
    ]);
    const reading = readDeployedRoots(tmp);
    expect(reading).toMatchObject({
      components: 3,
      withRoots: 2,
      withoutRoots: ['/Helpers/Timer'],
      rootComponent: '/App',
      rootComponentRenders: true,
      indexJs: 'index-deadbeef.js'
    });
  });

  it('walks past braces inside strings rather than stopping at the first one', () => {
    // The brace walk is the only part of this that can be wrong quietly: stopping early yields
    // valid-looking JSON for a PREFIX of the export, which reads as a smaller app.
    writeDeploy(tmp, [{ name: '/App {not a brace}', roots: ['n1'] }]);
    expect(readDeployedRoots(tmp).components).toBe(1);
  });

  it('reads the lazily-fetched bundles too', () => {
    // 🔴 A project whose root component is bundled keeps every root OUT of `window.projectData`.
    // A reader that stopped at the index would report a blank app for a perfectly good one.
    writeDeploy(tmp, [{ name: '/Loader', roots: [] }], {
      bundled: [{ name: '/App', roots: ['n1'] }]
    });
    const reading = readDeployedRoots(tmp);
    expect(reading.components).toBe(2);
    expect(reading.rootComponentRenders).toBe(true);
    expect(gradeRoots(reading)).toBeNull();
  });

  it('says which file it read, and refuses a folder with no export in it', () => {
    fs.writeFileSync(path.join(tmp, 'index.html'), '<html></html>');
    expect(() => readDeployedRoots(tmp)).toThrow(/no index-\*\.js/);
  });
});

/** A reading shaped like a good run, so each row below changes exactly one field. */
const reading = (over: Partial<RootsReading> = {}): RootsReading => ({
  components: 21,
  withRoots: 21,
  withoutRoots: [],
  rootComponent: '/App',
  rootComponentRenders: true,
  indexJs: 'index-abc.js',
  ...over
});

describe('HLS-015 AC2 — which readings are equivalent to a blank page', () => {
  it('a good deploy is not refused', () => {
    expect(gradeRoots(reading())).toBeNull();
  });

  it('C67: not one component carries a root', () => {
    const problem = gradeRoots(reading({ withRoots: 0, withoutRoots: ['/App'] }));
    expect(problem).toContain('Not one of the 21');
    // The sentence names the cause a reader can act on, not just the symptom.
    expect(problem).toContain('unpopulated node library');
  });

  it('the app starts at a component that renders nothing', () => {
    // The half that is NOT C67: plenty renders, and the first page is still blank.
    const problem = gradeRoots(reading({ withRoots: 20, rootComponentRenders: false, withoutRoots: ['/App'] }));
    expect(problem).toContain('starts at "/App"');
    expect(problem).toContain('20 of 21');
  });

  it('an export naming no components at all', () => {
    expect(gradeRoots(reading({ components: 0, withRoots: 0 }))).toContain('no components at all');
  });

  it('🔴 a rootless HELPER component is not a refusal', () => {
    // The rule this row protects: `no component without a root` would reject the correct answer
    // for any project containing a logic-only component. HLS-005 filed the same shape from the
    // other side — `Ghost` is declared and wired to nothing, and `Do` was relocated on purpose.
    expect(gradeRoots(reading({ withRoots: 20, withoutRoots: ['/Helpers/Timer'] }))).toBeNull();
  });

  it('🔴 and neither is a project whose export names no start component', () => {
    // `rootComponent: null` is what a project written from outside the editor looks like before
    // the loader guesses one. Refusing on it would refuse every agent-authored project.
    expect(gradeRoots(reading({ rootComponent: null, rootComponentRenders: false }))).toBeNull();
  });
});
