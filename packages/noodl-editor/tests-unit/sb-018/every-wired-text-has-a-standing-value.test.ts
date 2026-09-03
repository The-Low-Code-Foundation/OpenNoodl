/**
 * SB-018 (3) — the public site's `<h1>` rendered the literal word `Text`, and it
 * was six nodes, not one.
 *
 * s15's drive of an unclaimed site read:
 *
 *     Text
 *     This site has not been set up yet.
 *
 * The second line is s14's `diagnoseNotFound` working. The first is
 * `/Pages/Site`'s `<h1>`, whose only `text` was a wire from `readPage.out-title`
 * — and with no `Page` record that wire never publishes, so the node kept the
 * runtime's declared default (`visual/text.ts`, `default: 'Text'`).
 *
 * 🔴 **The census is the finding.** SB-018 filed this as one heading. Running the
 * rule over the shipped artefact instead of over the one node the drive happened
 * to see found **six** `Text` nodes with a wire and no standing value — including
 * `/Site/SectionView`'s body, on the same public page, and `/Admin/PageRow`'s
 * title and slug, which is the admin list. The other wired `Text` nodes in the
 * template (`link`, `rowStatus`, `notFound`) already carried one, so the template
 * had the rule and four nodes broke it.
 *
 * 🔴 **And it compounds SB-017 §11.** A deployed admin panel writes `Page` rows
 * with no title and no slug, because the `prop-` wires are dropped. Before this
 * fix those rows listed as **"Text"** in the panel — a placeholder that reads as
 * content. Now they list as blank, which is what they are.
 *
 * ⚠️ The standing value is `''` and not a phrase, deliberately. These are
 * headings and row labels on live pages mid-load; any word put there would be
 * read as the site's own copy for the moment before the record lands. `link` and
 * `rowStatus` keep their phrases because those are genuine defaults for a value
 * that may legitimately never arrive.
 */

// 🔴 This file declares `siteBuilder` at top level and has no `import`/`export`,
// which makes it a global SCRIPT to TypeScript rather than a module — and
// ts-jest typechecks all of `tests-unit/` in one program. Five spec files spell
// the same `const siteBuilder`, so whichever pair landed in one worker's program
// failed with TS2451 "Cannot redeclare block-scoped variable" and the whole
// SUITE failed to run: `test:main` reported 2 failed suites with 0 failed tests,
// which reads like a flake and is not one. `export {}` makes this a module and
// scopes the name to the file.
export {};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const siteBuilder = require('../../src/editor/src/models/template/templates/site-builder.content.json');

interface TemplateNode {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  children?: TemplateNode[];
}

function flatten(roots: TemplateNode[], out: TemplateNode[] = []): TemplateNode[] {
  for (const node of roots || []) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

/** Every `Text` node in the template, with what feeds its `text` port. */
function textNodes(): { component: string; id: string; text: unknown; fedBy: string[] }[] {
  return siteBuilder.components.flatMap((component: TSFixme) => {
    const connections = component.graph.connections ?? [];
    return flatten(component.graph.roots)
      .filter((node) => node.type === 'Text')
      .map((node) => ({
        component: component.name,
        id: node.id,
        text: node.parameters.text,
        fedBy: connections
          .filter((wire: TSFixme) => wire.toId === node.id && wire.toProperty === 'text')
          .map((wire: TSFixme) => `${wire.fromId}.${wire.fromProperty}`)
      }));
  });
}

describe('SB-018 (3): a wired `Text` never shows the runtime default', () => {
  it('🔴 the runtime defaults `text` to the word `Text`, and an empty parameter overrides it', () => {
    // The mechanism, from the module that owns it rather than from the drive's
    // screenshot — and both halves of it, because only the second says the fix
    // works. `''` is falsy, and a setter written `props[name] = value || default`
    // would have taken this whole change and changed nothing.
    //
    // ⚠️ `node-shared-port-definitions` reads the `Noodl` global at module scope
    // to decide whether to attach editor tooltips. It is a viewer global, absent
    // in a plain-Node runner, and its absence fails the REQUIRE — which reads as
    // "the node has no default" if the assertion is written any other way.
    (global as TSFixme).Noodl = { deployed: false };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const text = require('../../../noodl-viewer-react/src/nodes/visual/text');
    const definition = (text.default ?? text).node as TSFixme;

    // The default a node with no `text` at all keeps — the literal word.
    expect(definition.inputs.text.default).toBe('Text');

    // `react-component-node.ts:645-650` assigns the default into `props` at
    // construction and lets the setter overwrite it, so the setter run against a
    // props bag holding the default IS the question: does `''` land?
    const props: Record<string, unknown> = { text: definition.inputs.text.default };
    const node = { props, forceUpdate: () => undefined };

    definition.inputs.text.set.call(node, '');
    expect(props.text).toBe('');

    // 🔴 The control, and it is the state every one of these six nodes was in:
    // a port that is never set keeps the default. Without this row, the row
    // above proves only that a setter assigns.
    definition.inputs.text.set.call(node, undefined);
    expect(props.text).toBe(undefined);
    expect('text' in props).toBe(false);
  });

  it('every `Text` node in the shipped template carries a standing `text`', () => {
    // The corpus rule, over the artefact that ships. Asserted for every `Text`
    // and not only the wired ones: an unwired `Text` with no parameter renders
    // the placeholder forever, which is the same defect with no wire to blame.
    const missing = textNodes()
      .filter((node) => node.text === undefined)
      .map((node) => `${node.component} ${node.id}`);

    expect(missing).toEqual([]);

    // A loop over nothing passes. This template has `Text` nodes, and most of
    // them are fed by a wire.
    expect(textNodes().length).toBeGreaterThan(10);
    expect(textNodes().filter((node) => node.fedBy.length > 0).length).toBeGreaterThan(0);
  });

  it('🔴 the six that were missing one are named, so a regression says which', () => {
    // s19 fixed exactly these. Named rather than counted: a future edit that
    // drops the parameter from one of them should fail with the node in the
    // message, and a future edit that adds a seventh should fail on the rule
    // above rather than here.
    const standing: Record<string, unknown> = {};
    for (const node of textNodes()) standing[`${node.component} ${node.id}`] = node.text;

    expect(standing['/Pages/Site pageTitle']).toBe('');
    expect(standing['/Pages/Site siteName']).toBe('');
    // 🔴 **`/Site/SectionView body` is GONE and this row named a node that no
    // longer exists** — read as red by P82 s23. SBR-005 turned `SectionView`
    // into a switch that draws nothing (five wrappers, one per kind), and the
    // body it used to own became one Text per kind. `/Site/SectionView` now
    // carries no `Text` at all, so `standing[…]` was `undefined` rather than
    // `''` and this arm had been red since that task landed.
    // ⚠️ The successors are named INDIVIDUALLY rather than the row being
    // deleted: a rule-level check ("every Text carries a standing text", above)
    // stayed green through all of it, which is exactly why the named list
    // exists — it says WHICH node lost its parameter, and one that is deleted
    // instead of re-pointed cannot say anything.
    // ⚠️ The ids carry `-2`/`-3` suffixes because node ids are made unique
    // across the PROJECT (SB-004 F9), not because there are three of anything.
    expect(standing['/Site/RichTextSection body']).toBe('');
    expect(standing['/Site/ContactSection body-2']).toBe('');
    expect(standing['/Site/CtaSection body-3']).toBe('');
    expect(standing['/Admin/PageRow rowTitle']).toBe('');
    expect(standing['/Admin/PageRow rowSlug']).toBe('');
    expect(standing['/Admin/SectionRow kindText']).toBe('');

    // And the three that already had one keep their phrases — the standing value
    // is not blanket-blank, it is "blank unless there is a real default to say".
    expect(standing['/Site/NavLink link']).toBe('Page');
    expect(standing['/Admin/PageRow rowStatus']).toBe('Draft');
    expect(standing['/Pages/Site notFound']).toBe('That page could not be found.');
  });

  it('🔴 the `<h1>` the drive read is the one this is about, and it is still an `<h1>`', () => {
    // The consequence rather than the mechanism: the heading a visitor reads
    // first has to be the node that was fixed. A `text` parameter on some other
    // node would satisfy every assertion above and leave the drive's finding in
    // place.
    const site = siteBuilder.components.find((c: TSFixme) => c.name === '/Pages/Site');
    const heading = flatten(site.graph.roots).find((node) => node.parameters.as === 'h1');

    expect(heading?.id).toBe('pageTitle');
    expect(heading?.parameters.text).toBe('');
    expect(
      (site.graph.connections ?? []).filter(
        (wire: TSFixme) => wire.toId === heading?.id && wire.toProperty === 'text'
      )
    ).toEqual([{ fromId: 'readPage', fromProperty: 'out-title', toId: 'pageTitle', toProperty: 'text' }]);
  });
});
