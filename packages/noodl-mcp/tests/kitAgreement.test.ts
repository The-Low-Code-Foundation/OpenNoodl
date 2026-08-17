/**
 * CN-003 slice 3 — the two routes agree. ✅ **D3's** obligation, made falsifiable.
 *
 * ## Why this suite exists
 *
 * D3 let the editor and the MCP server derive the same facts by **different
 * routes**: the editor reads the node library the viewer already sent it, the
 * server executes the kit headlessly. The ruling accepted that risk in exchange
 * for a much smaller surface, and wrote the price into the task — *"CN-003 must
 * include a check that they agree, or the divergence will be discovered by a
 * user"*, and *"when they diverge, the failure must name the divergence, not
 * just fail"*.
 *
 * This is that check. It lives in this package because this is the one place
 * both halves are reachable: the extractor is here, and the editor's pure
 * modules are already imported by relative path (see `src/editor-deps.ts`).
 *
 * ## 🔴 What a green run says, and what it does not
 *
 * It says **the two registers agree** for this project. It does **not**
 * independently verify the mapping — both sides run the same
 * `catalogNodesFromNodeLibrary`, deliberately, because two hand-written mappings
 * for one set of facts is the duplication this phase exists to end. The mapping
 * is graded in `@nodegx/kit-catalog`'s own suite. Do not quote a pass here as
 * evidence the overlay is correct.
 *
 * It also does not say the two routes are *independent derivations*: both go
 * through `@noodl/runtime`'s register, the viewer's node definitions and
 * `generateNodeLibrary`. What differs — and what a user would hit — is that one
 * runs inside a browser frame with the project loaded and the other in a bare
 * Node process under a DOM shim.
 *
 * ## The editor side is a recording, and that is what the task asked for
 *
 * CN-003: *"a test that takes one fixture project, gets the type set + port sets
 * by the MCP route and by a **recorded `sendNodeLibrary` payload**, and asserts
 * they match"*. The recording is
 * `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`;
 * its header records when, from what, and how it was reduced. ⚠️ It is a
 * recording, so it ages: a change to the viewer's node definitions moves the
 * live MCP side and not the recorded editor side, and this suite is where that
 * shows up. That is the intended behaviour — re-record, do not relax the check.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compareOverlays, describeComparison } = require('@nodegx/kit-catalog');
import type { OverlayCatalogNode } from '@nodegx/kit-catalog';

import { extractProjectOverlay } from '../src/kitOverlay';
// The editor's half, by relative path — the same seam `editor-deps.ts` uses.
import {
  loadDefaultCatalog as editorCatalogIndex,
  setCatalogOverlay as setEditorOverlay
} from '../../noodl-editor/src/editor/src/validation/catalog';
import { overlayFromNodeLibrary } from '../../noodl-editor/src/editor/src/validation/kitOverlay';
import { loadV2Directory } from '../../noodl-editor/src/editor/src/validation/loadV2Project';
import { SemanticValidator } from '../src/editor-deps';
import { buildKitExtractor } from './helpers';

const KIT_APP = path.join(__dirname, 'fixtures', 'kit-app');
const EDITOR_RECORDING = path.join(
  __dirname,
  '..',
  '..',
  'noodl-editor',
  'tests-unit',
  'cn-003',
  'fixtures',
  'kit-app.editor-nodelibrary.json'
);

let tempDir: string;
let mcpNodes: OverlayCatalogNode[];
let editorNodes: OverlayCatalogNode[];

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn003-agree-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(tempDir);

  const extracted = extractProjectOverlay(KIT_APP);
  // 🔴 A route that failed must never be compared as though it had answered
  // nothing: two empty lists agree perfectly. This is the same distinction
  // `ProjectKitOverlay.unavailable` exists to keep.
  expect(extracted.unavailable).toBeUndefined();
  expect(extracted.failures).toEqual([]);
  mcpNodes = extracted.nodes;

  const recording = JSON.parse(fs.readFileSync(EDITOR_RECORDING, 'utf8'));
  editorNodes = overlayFromNodeLibrary(recording).nodes;
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  setEditorOverlay([]);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('the editor route and the MCP route', () => {
  it('both actually produced an overlay to compare', () => {
    // Without this, every assertion below is satisfied by two empty lists — the
    // vacuous pass this repo has been caught by before.
    expect(mcpNodes.map((n) => n.typeName).sort()).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
    expect(editorNodes.map((n) => n.typeName).sort()).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
    expect(mcpNodes.every((n) => n.inputs.length > 0)).toBe(true);
    expect(editorNodes.every((n) => n.inputs.length > 0)).toBe(true);
  });

  it('agree on every kit node type and port', () => {
    const comparison = compareOverlays(mcpNodes, editorNodes, {
      labelA: 'the MCP extractor',
      labelB: 'the editor’s node library'
    });
    // The message is the point: a divergence must be readable, not just red.
    expect(describeComparison(comparison)).toBe(
      'the MCP extractor and the editor’s node library agree on every kit node type and port.'
    );
    expect(comparison.agree).toBe(true);
  });

  it('agree port-for-port, asserted on the resolved entries rather than on counts', () => {
    // ⚠️ Counts agreeing is weaker than sets agreeing, and this phase has
    // already published a corroboration table made of counts.
    for (const mcp of mcpNodes) {
      const editor = editorNodes.find((n) => n.typeName === mcp.typeName);
      expect(editor).toBeDefined();
      expect(editor?.inputs.map((p) => `${p.name}:${p.type.name}`)).toEqual(
        mcp.inputs.map((p) => `${p.name}:${p.type.name}`)
      );
      expect(editor?.outputs.map((p) => `${p.name}:${p.type.name}`)).toEqual(
        mcp.outputs.map((p) => `${p.name}:${p.type.name}`)
      );
    }
  });
});

describe('✅ the two routes now agree about the kit’s name as well', () => {
  /**
   * Found by building this suite, and it was a real defect rather than a test
   * artefact — `compareOverlays` does not compare `kitModule`, so nothing else
   * would have said so.
   *
   * `NoodlRuntime.registerModule` names a module from the object the kit passed
   * to `Noodl.defineModule` (`noodl-runtime.ts:517`:
   * `wrapped.node.module = module.name || 'Unknown Module'`). **No kit set that
   * name** — not this fixture and not the cashflow reference kit; the name lives
   * in `manifest.json`, which the *viewer* never read. The MCP extractor did
   * read it (`entry.js`: `module.name = module.name || moduleName`), so the two
   * routes disagreed for every node: `'Demo Kit'` headlessly,
   * `'Unknown Module'` in the editor.
   *
   * ## ✅ FIXED 2026-08-16 (slice 4), and RE-RECORDED 2026-08-17 (s15)
   *
   * `@nodegx/module-inject` emits `window.__noodl_module_name` immediately
   * before each kit's script tag, and the three runtime bootstraps adopt it in
   * `defineModule` (graded in `@nodegx/module-inject`'s suite and in
   * `noodl-viewer-react/tests/module-name.test.js`, both mutation-proven).
   *
   * 🔴 **This assertion spent a day as a fossil, and that is the transferable
   * part.** The fix landed on 2026-08-16 but the *recording* on the editor side
   * predated it, so the line below read `'Unknown Module'` — a dated measurement
   * wearing the clothes of a current one, which is exactly the shape this repo
   * keeps getting caught by, hence the name of the test. Three handovers then
   * carried "owed: re-record after a viewer build" as if the build were the
   * blocker; a viewer build carrying the fix had in fact existed since
   * 2026-08-16 21:57. **A claim that something is blocked on an artefact is a
   * claim about that artefact's mtime and contents — check both.**
   *
   * Re-recorded from a running editor on 2026-08-17 with the fixture copied to a
   * scratchpad and opened there; the header inside the JSON records the capture.
   */
  it('names the kit from the manifest on both routes', () => {
    expect(mcpNodes.map((n) => n.kitModule)).toEqual(['Demo Kit', 'Demo Kit']);
    // The recorded editor payload, re-recorded 2026-08-17. See the note above.
    expect(editorNodes.map((n) => n.kitModule)).toEqual(['Demo Kit', 'Demo Kit']);

    // …and the agreement check is silent about it, deliberately: it compares
    // what a *validator* needs. Recorded so nobody reads its green as covering
    // provenance.
    const comparison = compareOverlays(mcpNodes, editorNodes, { labelA: 'mcp', labelB: 'editor' });
    expect(comparison.agree).toBe(true);
  });
});

describe('the editor’s seam has the same consequence as the server’s', () => {
  /**
   * 🔴 Slice 2b proved this for the MCP server's catalog. That says nothing
   * about the editor's, which is a different module with its own memoised index
   * — and "the overlay is installed and never read" is the failure this phase
   * keeps meeting. Here the overlay comes from the **editor route** (the
   * recorded payload) and is installed through the **editor's** seam, so what is
   * graded is the path a builder actually runs into.
   *
   * Same project, same rules, so the numbers are the ones slice 2b published:
   * 0 errors / 5 warnings / 8 infos with **0 endpoints checked**, becoming
   * 1 error / 0 / 0 with **4 endpoints checked**.
   */
  const summarize = () => new SemanticValidator(editorCatalogIndex()).validate(loadV2Directory(KIT_APP), {}).summary;

  it('goes from nothing checked to the checks running and finding the wrong port', () => {
    setEditorOverlay([]);
    const before = summarize();
    expect([before.errors, before.warnings, before.infos, before.endpointsChecked]).toEqual([0, 5, 8, 0]);

    setEditorOverlay(editorNodes);
    const after = summarize();

    // The infos going to zero is the weak half — suppressing them would produce
    // the same number. The load-bearing figures are the two beside it.
    expect(after.infos).toBe(0);
    expect(after.endpointsChecked).toBe(4);
    expect(after.errors).toBe(1);
    expect(after.warnings).toBe(0);
  });

  it('takes the kit types back out again when the project closes', () => {
    setEditorOverlay(editorNodes);
    expect(editorCatalogIndex().hasType('demo.kit.Badge')).toBe(true);

    // What `NodeLibrary.loadLibrary()` does with an empty `window.NodeLibraryData`.
    setEditorOverlay(overlayFromNodeLibrary({ nodetypes: [] }).nodes);
    expect(editorCatalogIndex().hasType('demo.kit.Badge')).toBe(false);
    expect(summarize().endpointsChecked).toBe(0);
  });
});

describe('the check can fail, and says what diverged', () => {
  // 🔴 The control. A check that has never been seen to fail measures nothing —
  // and an agreement check is exactly the shape that passes on two empty lists,
  // a broken mapping, or a comparison that quietly compares nothing.

  it('names a port one route has and the other does not', () => {
    const perturbed = editorNodes.map((n) =>
      n.typeName === 'demo.kit.Badge' ? { ...n, inputs: n.inputs.filter((p) => p.name !== 'label') } : n
    );
    const comparison = compareOverlays(mcpNodes, perturbed, { labelA: 'mcp', labelB: 'editor' });

    expect(comparison.agree).toBe(false);
    expect(comparison.divergences).toContainEqual({
      typeName: 'demo.kit.Badge',
      kind: 'port-missing',
      plug: 'input',
      port: 'label',
      detail: 'present in mcp, absent in editor'
    });
    expect(describeComparison(comparison)).toContain('[port-missing] demo.kit.Badge.input:label');
  });

  it('names a type one route has and the other does not', () => {
    const comparison = compareOverlays(
      mcpNodes,
      editorNodes.filter((n) => n.typeName !== 'demo.kit.Meter'),
      { labelA: 'mcp', labelB: 'editor' }
    );

    expect(comparison.agree).toBe(false);
    expect(describeComparison(comparison)).toContain(
      '[type-missing] demo.kit.Meter — declared in mcp, absent from editor'
    );
  });

  it('names a port whose type differs, which is the divergence a count cannot see', () => {
    const perturbed = editorNodes.map((n) =>
      n.typeName === 'demo.kit.Meter'
        ? { ...n, inputs: n.inputs.map((p) => (p.name === 'value' ? { ...p, type: { name: 'string' } } : p)) }
        : n
    );
    const comparison = compareOverlays(mcpNodes, perturbed, { labelA: 'mcp', labelB: 'editor' });

    expect(comparison.agree).toBe(false);
    expect(describeComparison(comparison)).toContain('[port-type-differs] demo.kit.Meter.input:value');
  });
});
