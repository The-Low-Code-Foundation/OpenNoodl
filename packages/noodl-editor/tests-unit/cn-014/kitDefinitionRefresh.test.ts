/**
 * CN-014 AC1 — a kit's edited definition reaches the editor without a restart.
 *
 * ## The defect this grades
 *
 * Driving CN-010 AC1 (session 19) established the behaviour by a control pair:
 * one write to a kit's `index.js` both flipped an existing node's dynamic-port
 * condition **and** added a brand-new node, and one viewer reload delivered the
 * new node (177 → 178 types) and never the changed condition — five polls over
 * thirty seconds, then a full editor restart delivered it. Same file, same
 * write, same reload; the only variable was whether the editor already knew the
 * type name. That is `mergeUpdates`' known-name branch, which carried
 * `// TODO: Update the node data?` and did nothing with the new definition.
 *
 * ⚠️ **The consequence is worse than the bug reads.** Dynamic ports work the
 * first time and every tuning edit afterwards is silently ignored, so the
 * author's natural conclusion is "dynamic ports don't work in kits" — the
 * opposite of what CN-010 proved.
 *
 * ## Why the tests below are shaped the way they are
 *
 * The interesting half of this fix is not "replace the data", it is **not
 * replacing too much**. The generated cloud node library shares *all 84* of its
 * type names with the browser library (`Expression`, `REST2`, `Model2`, …) and
 * merges on top of the browser's report once per session, so an unconditional
 * replace would hand 84 built-ins' definitions to the cloud library and invert a
 * precedence that has always been first-writer-wins.
 *
 * 🔴 **That control is therefore built from the two real payloads on disk** —
 * `cloud-node-library.json` as shipped, and CN-003's recorded browser library —
 * not from hand-written stand-ins. A hand-written pair would have to be *given*
 * an overlap to test, which makes it a test of the fixture rather than of the
 * product; this phase has twice lost time to controls that could not fail.
 */

import cloudNodeLibraryJson from '../../src/editor/src/models/nodelibrary/cloud-node-library.json';
import recordedBrowserLibrary from '../cn-003/fixtures/kit-app.editor-nodelibrary.json';

// The importer calls `NodeLibrary.instance.reload()`, and that module reaches
// `ComponentModel`, `NodeGraphNode` and two view modules — none of which exist
// in a plain-Node runner. Mocking it keeps this suite in `tests-unit` (where it
// runs in seconds beside a live editor) and makes "did the library republish?"
// directly observable, which is the property half of these tests assert.
const reload = jest.fn();
jest.mock('@noodl-models/nodelibrary/nodelibrary', () => ({
  NodeLibrary: {
    instance: {
      get reload() {
        return reload;
      }
    }
  }
}));

import { NodeLibraryData, NodeLibraryDataNodeType, RuntimeType } from '../../src/editor/src/models/nodelibrary/NodeLibraryData';
import { NodeLibraryImporter } from '../../src/editor/src/models/nodelibrary/NodeLibraryImporter';

/** `updateIndex` publishes onto `window`; there is no renderer here. */
beforeAll(() => {
  (global as unknown as { window: Record<string, unknown> }).window = {};
});

beforeEach(() => {
  reload.mockClear();
});

/**
 * A kit node in the shape the viewer sends, with its conditional dynamic-port
 * group spelled the way CN-010 measured a real kit spelling it.
 */
function kitPanel(condition: string): NodeLibraryDataNodeType {
  return {
    name: 'dynports.kit.Panel',
    displayName: 'Panel',
    category: 'Visuals',
    color: 'visual',
    docs: 'A panel.',
    ports: [{ name: 'mode', type: 'string', plug: 'input', group: 'General' }],
    dynamicports: [
      {
        name: 'conditionalports/basic',
        condition,
        inputs: ['itemCount']
      }
    ],
    metadata: { module: 'Dynports Kit' }
  } as unknown as NodeLibraryDataNodeType;
}

function library(nodetypes: NodeLibraryDataNodeType[]): NodeLibraryData {
  return {
    nodetypes,
    nodeIndex: { coreNodes: [], moduleNodes: [] },
    projectsettings: { ports: [], dynamicports: [] }
  } as unknown as NodeLibraryData;
}

/** Deep-copied per import: a real client parses fresh JSON off the wire. */
function fresh<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * ⚠️ `NodeLibraryDataNodeType` declares seven fields and **neither `ports` nor
 * `dynamicports`** — the two a kit author actually edits. Reads here go through
 * a widened view rather than the declared type, and the fix itself never names a
 * field (it compares whole objects), which is what keeps it honest about a wire
 * shape the editor only partially describes.
 */
type WireNodeType = NodeLibraryDataNodeType & Record<string, unknown>;

function storedNode(importer: NodeLibraryImporter, name: string): WireNodeType | undefined {
  const data = (global as unknown as { window: { NodeLibraryData?: NodeLibraryData } }).window.NodeLibraryData;
  return data?.nodetypes.find((n) => n.name === name) as WireNodeType | undefined;
}

/**
 * A browser client's import, as `ViewerConnection` performs it.
 *
 * ⚠️ Every reload arrives under a **new** `clientId`: the ordinary viewer mints
 * `guid()` on each socket open (`editorconnection.ts`) and only a sandbox
 * preview passes a fixed id. So "the same client re-imported" is not a question
 * the importer can ask, which is why the fix keys on the runtime instead.
 */
let reloadCounter = 0;
function browserImport(importer: NodeLibraryImporter, lib: NodeLibraryData) {
  importer.onClientImport(`viewer-${++reloadCounter}`, RuntimeType.Browser, fresh(lib));
}

describe('CN-014 AC1 — an edited kit definition reaches the library', () => {
  it("replaces a re-reporting runtime's own node data", () => {
    const importer = new NodeLibraryImporter();

    browserImport(importer, library([kitPanel("mode = 'list'")]));
    expect((storedNode(importer, 'dynports.kit.Panel').dynamicports as any)[0].condition).toBe("mode = 'list'");

    browserImport(importer, library([kitPanel("mode = 'grid'")]));

    // The defect: this used to still read `mode = 'list'` for the rest of the
    // session, because the name was already known.
    expect((storedNode(importer, 'dynports.kit.Panel').dynamicports as any)[0].condition).toBe("mode = 'grid'");
    expect(reload).toHaveBeenCalled();
  });

  it('still delivers a brand-new node in the same import — the s19 control pair', () => {
    const importer = new NodeLibraryImporter();
    browserImport(importer, library([kitPanel("mode = 'list'")]));

    const badge = { ...kitPanel("mode = 'list'"), name: 'dynports.kit.Badge', displayName: 'Badge' };
    browserImport(importer, library([kitPanel("mode = 'grid'"), badge as NodeLibraryDataNodeType]));

    // This half always worked, and it is what made the failure legible as
    // "dynamic ports are broken" rather than "the library is stale".
    expect(storedNode(importer, 'dynports.kit.Badge')).toBeDefined();
    expect((storedNode(importer, 'dynports.kit.Panel').dynamicports as any)[0].condition).toBe("mode = 'grid'");
  });

  it('does not republish the library when a re-import changes nothing', () => {
    const importer = new NodeLibraryImporter();
    browserImport(importer, library([kitPanel("mode = 'list'")]));

    reload.mockClear();
    browserImport(importer, library([kitPanel("mode = 'list'")]));

    // Without this, every viewer reload would rebuild every node type and
    // re-run the catalog overlay for no reason.
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('CN-014 — the cloud library does not capture the browser\'s definitions', () => {
  /** Names carried by both real payloads. Measured, not asserted from memory. */
  const cloudLib = cloudNodeLibraryJson as unknown as NodeLibraryData;
  // The recording carries `nodetypes` only; the importer also reads `nodeIndex`
  // and `projectsettings`, which the browser client always sends.
  const browserLib = {
    ...(recordedBrowserLibrary as unknown as NodeLibraryData),
    nodeIndex: { coreNodes: [], moduleNodes: [] },
    projectsettings: { ports: [], dynamicports: [] }
  } as unknown as NodeLibraryData;

  const browserByName = new Map(browserLib.nodetypes.map((n) => [n.name, n]));
  const shared = cloudLib.nodetypes.map((n) => n.name).filter((n) => browserByName.has(n));

  it('the two shipped payloads collide AND disagree, or the control below is vacuous', () => {
    expect(shared.length).toBe(84);
    expect(shared).toContain('Expression');

    // 🔴 Overlap alone would not make the control able to fail: if the two
    // payloads agreed on these names, "the browser definition survived" would
    // be equally true of a build that let the cloud library overwrite them.
    const disagree = shared.filter(
      (name) =>
        JSON.stringify(browserByName.get(name)) !==
        JSON.stringify(cloudLib.nodetypes.find((n) => n.name === name))
    );
    expect(disagree.length).toBe(84);
  });

  it('keeps every shared name on the browser definition while adding the cloud runtime', () => {
    const importer = new NodeLibraryImporter();

    // A real browser client, then the static cloud library the importer merges
    // itself on the first non-cloud import.
    browserImport(importer, browserLib);

    const published = (global as unknown as { window: { NodeLibraryData: NodeLibraryData } }).window.NodeLibraryData;

    const captured: string[] = [];

    for (const name of shared) {
      const stored = published.nodetypes.find((n) => n.name === name) as WireNodeType;
      const { runtimeTypes, ...storedData } = stored;

      // The whole definition is still the browser's, not just a field of it.
      if (JSON.stringify(storedData) !== JSON.stringify(browserByName.get(name))) {
        captured.push(name);
      }

      // ...and the cloud runtime was recorded, not substituted.
      expect(runtimeTypes).toContain(RuntimeType.Cloud);
      expect(runtimeTypes).toContain(RuntimeType.Browser);
    }

    expect(captured).toEqual([]);
  });

  it('a browser reload still refreshes a node the cloud library also claims', () => {
    const importer = new NodeLibraryImporter();
    browserImport(importer, browserLib);

    // `Expression` now carries two runtime types. Ownership, not the union, is
    // what decides whether the browser may replace it — a rule keyed on
    // "runtimeTypes has one entry" would silently stop refreshing these 84.
    const edited = fresh(browserLib);
    const expression = edited.nodetypes.find((n) => n.name === 'Expression');
    expression.docs = 'CN-014 edited this.';
    browserImport(importer, edited);

    const stored = storedNode(importer, 'Expression');
    expect(stored.docs).toBe('CN-014 edited this.');
    expect(stored.runtimeTypes).toContain(RuntimeType.Cloud);
  });
});

describe('CN-014 — a changed picker group is published', () => {
  function libraryWithGroup(items: string[]): NodeLibraryData {
    return {
      nodetypes: [kitPanel("mode = 'list'")],
      nodeIndex: {
        coreNodes: [],
        moduleNodes: [{ name: 'Dynports Kit', subCategories: [{ name: 'Visuals', items }] }]
      },
      projectsettings: { ports: [], dynamicports: [] }
    } as unknown as NodeLibraryData;
  }

  it('republishes when a kit group\'s contents change', () => {
    const importer = new NodeLibraryImporter();
    browserImport(importer, libraryWithGroup(['dynports.kit.Panel']));

    reload.mockClear();
    browserImport(importer, libraryWithGroup(['dynports.kit.Panel', 'dynports.kit.Badge']));

    // `mergeInByName` always performed this replacement; it just never said so,
    // so the fresh group sat unpublished in `currentNodeLibrary`.
    expect(reload).toHaveBeenCalled();
  });

  it('stays quiet when the group is identical', () => {
    const importer = new NodeLibraryImporter();
    browserImport(importer, libraryWithGroup(['dynports.kit.Panel']));

    reload.mockClear();
    browserImport(importer, libraryWithGroup(['dynports.kit.Panel']));

    expect(reload).not.toHaveBeenCalled();
  });
});
