/**
 * CN-006b AC2 — provenance in the property panel header.
 *
 * ✅ **D1**: a node says which kit it came from. ✅ **D6**: that statement is what
 * a consent decision gets recorded against, so it has to be right rather than
 * decorative.
 *
 * 🔴 **Every case here is built from the shape a real viewer actually sent.**
 * `tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` is the recorded
 * payload of a live `sendNodeLibrary`, and reading it is what settled two things
 * this task's spec got wrong:
 *
 *  - `module` is already on the exported type (2 of 177 carry it, both the
 *    kit's), so provenance needed a reader, not plumbing; and
 *  - `docs` is **prose on a kit node**, while **not one of the 175 built-ins
 *    carries the field at all** — so the spec's "link to its docs" would have
 *    rendered an author's sentence as an `href`.
 *
 * The fixture is asserted directly below, so if a future viewer stops sending
 * `module`, or starts sending a URL in a kit's `docs`, these tests say so instead
 * of quietly grading a hand-written object that agrees with itself.
 */

import * as fs from 'fs';
import * as path from 'path';

import { getNodeProvenance } from '../../src/editor/src/views/panels/propertyeditor/provenance';

const FIXTURE = path.join(__dirname, '..', 'cn-003', 'fixtures', 'kit-app.editor-nodelibrary.json');

type ExportedType = { name: string; module?: string; docs?: string };

function recordedNodeTypes(): ExportedType[] {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).nodetypes;
}

describe('the recorded payload a real viewer sent', () => {
  test('carries `module` on the kit types and on nothing else', () => {
    const types = recordedNodeTypes();
    const withModule = types.filter((t) => t.module);

    expect(types.length).toBe(177);
    expect(withModule.map((t) => t.name).sort()).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
    expect(withModule.every((t) => t.module === 'Demo Kit')).toBe(true);
  });

  test("a kit node's `docs` is prose, and no built-in carries the field at all", () => {
    /*
     * 🔴 The load-bearing assertion for the "not a link" decision. If this ever
     * flips — a kit shipping a URL, or built-ins gaining `docs` here — the
     * property panel's treatment of the field has to be revisited, and this is
     * the test that will say so.
     */
    const types = recordedNodeTypes();
    const kitTypes = types.filter((t) => t.module);
    const builtins = types.filter((t) => !t.module);

    expect(kitTypes.every((t) => typeof t.docs === 'string' && t.docs.length > 0)).toBe(true);
    expect(kitTypes.some((t) => String(t.docs).startsWith('http'))).toBe(false);
    expect(builtins.filter((t) => t.docs)).toEqual([]);
  });
});

describe('getNodeProvenance', () => {
  test('names the kit for a kit node, exactly as the payload spells it', () => {
    const badge = recordedNodeTypes().find((t) => t.name === 'demo.kit.Badge');

    expect(getNodeProvenance({ type: badge })).toEqual({
      kitName: 'Demo Kit',
      kitDocs: 'A labelled badge that can show a percentage.'
    });
  });

  test('a built-in has no provenance — which is what AC2 renders as "no row"', () => {
    // The other arm, and the one P1 turns on. Taken from the same payload rather
    // than hand-written, so "a built-in has no module" is a fact about what the
    // viewer sends and not about what this test assumed.
    const builtin = recordedNodeTypes().find((t) => !t.module);

    expect(getNodeProvenance({ type: builtin })).toEqual({});
  });

  test('a kit node with no docs still gets its kit named', () => {
    // ⚠️ The common case, not an edge one: `@nodegx/kit-scaffold` emits no `docs`
    // at all (CN-008), so the first kit anybody makes lands here. Provenance must
    // not be conditional on the author having written a sentence.
    expect(getNodeProvenance({ type: { name: 'x.Y', module: 'Harbour Metrics' } })).toEqual({
      kitName: 'Harbour Metrics'
    });
  });

  test('whitespace-only docs is treated as no docs', () => {
    const p = getNodeProvenance({ type: { name: 'x.Y', module: 'Harbour Metrics', docs: '   \n ' } });

    expect(p.kitName).toBe('Harbour Metrics');
    expect(p.kitDocs).toBeUndefined();
  });

  test('an empty module string is not a kit', () => {
    // `'Unknown Module'` is a real kit name the runtime stamps deliberately
    // (CN-018), but `''` is the old collapsed-group bug's signature and must not
    // draw a row reading "from ".
    expect(getNodeProvenance({ type: { name: 'x.Y', module: '' } })).toEqual({});
  });

  test('a node with no type at all is not a crash', () => {
    // The header renders during selection changes, when `model.type` can be
    // momentarily absent.
    expect(getNodeProvenance({})).toEqual({});
    expect(getNodeProvenance(undefined)).toEqual({});
  });
});
