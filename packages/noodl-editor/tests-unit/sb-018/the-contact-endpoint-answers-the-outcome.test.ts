/**
 * SB-018 (5) — the wiring, in the template that ships.
 *
 * The mechanism is measured elsewhere and in the packages that own it:
 * `noodl-runtime/test/sb-018-a-signal-into-a-value-port.test.ts` (a pulse into a
 * value port arrives as `true` then `false`) and
 * `noodl-viewer-cloud/tests/sb-018-received-is-the-outcome.test.ts` (an unset
 * `pm-` port leaves its key out of the body, so `{"received": false}` proved the
 * port was set). This file asserts the graph the template ships is the one those
 * two describe.
 *
 * 🔴 **The fix is not the one SB-018 (5) proposed.** That file offered "publish a
 * value (`Outputs.built = true` beside the signal)" as the cheap option. It would
 * have swapped one constant for another: `compose` runs on `req.receive`, before
 * anything is stored, so a `true` published there is `true` on the failure path
 * too — the visitor whose message was lost would be told it arrived. The flag has
 * to be raised where the outcome is known, which is after the write.
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
  label?: string;
  type: string;
  parameters: Record<string, unknown>;
  ports?: { name: string; plug: string; type: string }[];
  children?: TemplateNode[];
}

interface TemplateConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

function flatten(roots: TemplateNode[], out: TemplateNode[] = []): TemplateNode[] {
  for (const node of roots || []) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

function contactForm(): { nodes: TemplateNode[]; connections: TemplateConnection[] } {
  const component = siteBuilder.components.find((c: TSFixme) => c.name === '/#__cloud__/submitContactForm');
  if (component === undefined) throw new Error('no submitContactForm in the shipped template');
  return { nodes: flatten(component.graph.roots), connections: component.graph.connections ?? [] };
}

function nodeOfType(type: string): TemplateNode {
  const found = contactForm().nodes.filter((node) => node.type === type);
  if (found.length !== 1) throw new Error(`expected exactly one ${type}, found ${found.length}`);
  return found[0];
}

/**
 * ⚠️ Wires are read by **label**, not by id. The authoring door remaps ids on the
 * way in — `save` ships as `save-3` — so an id-keyed assertion here passes or
 * fails on how many other components happened to use the same word.
 */
function labelOf(nodeId: string): string {
  const node = contactForm().nodes.find((candidate) => candidate.id === nodeId);
  return node?.label ?? nodeId;
}

/** Every wire into one node's port, as `<source label>.<port>`. */
function feeding(label: string, port: string): string[] {
  const target = contactForm().nodes.find((node) => node.label === label);
  if (target === undefined) throw new Error(`no node labelled "${label}"`);
  return contactForm()
    .connections.filter((wire) => wire.toId === target.id && wire.toProperty === port)
    .map((wire) => `${labelOf(wire.fromId)}.${wire.fromProperty}`)
    .sort();
}

/** The four nodes this file is about, by the labels the component set gives them. */
const WRITE = 'Record the message';
const ANSWER = 'The answer the visitor gets';
const MAIL = 'Tell the site owner';
const RESPONSE = 'Answer the visitor';
const BODY = 'The message body';

describe('SB-018 (5): `received` reports the write, not a pulse rearming', () => {
  it('the four nodes this file names are all in the shipped component', () => {
    // A `find` that misses returns `undefined` and a `filter` that misses
    // returns `[]`, both of which read as "the wire is not there" — which is
    // what three of the four cases below assert. This row is what stops a
    // renamed label turning every one of them green for the wrong reason.
    const labels = contactForm().nodes.map((node) => node.label);
    for (const label of [WRITE, ANSWER, MAIL, RESPONSE, BODY]) expect(labels).toContain(label);
  });

  it('🔴 no signal output reaches `pm-received` any more', () => {
    // The defect, stated as an absence over the whole component rather than as
    // "that one wire is gone": any signal into that value port reproduces it.
    const { nodes, connections } = contactForm();
    const byId: Record<string, TemplateNode> = {};
    nodes.forEach((node) => (byId[node.id] = node));

    const signalsIntoParameters = connections.filter((wire) => {
      if (!wire.toProperty.startsWith('pm-')) return false;
      const source = byId[wire.fromId];
      // Declared signal outputs, and the runtime's own `done`/`failure`/`completed`
      // family, which no port list carries.
      const declared = (source.ports ?? []).some((port) => port.name === wire.fromProperty && port.type === 'signal');
      return declared || ['done', 'failure', 'completed', 'success'].includes(wire.fromProperty);
    });

    expect(signalsIntoParameters).toEqual([]);
  });

  it('the flag is raised after the row is written, and it is a value', () => {
    const stored = contactForm().nodes.find((node) => node.label === ANSWER)!;

    // A plain value output, parsed from the script — `out-ready` is the only
    // declared port, because a signal is the one thing the parser cannot infer.
    expect(String(stored.parameters.functionScript)).toContain('Outputs.received = true;');
    expect(stored.ports).toEqual([{ name: 'out-ready', plug: 'output', type: 'signal' }]);

    // 🔴 It runs off the WRITE, not off the request. This is the assertion that
    // separates the fix from SB-018 (5)'s own suggestion: a flag published on
    // `req.receive` would be true on the failure path too.
    expect(feeding(ANSWER, 'run')).toEqual([`${WRITE}.done`]);
    expect(feeding(RESPONSE, 'pm-received')).toEqual([`${ANSWER}.out-received`]);
  });

  it('🔴 …and it is IN the success chain, so the value cannot lose a race with the send', () => {
    // `stored` sits between `save.done` and `mail.send` rather than hanging off
    // `save.done` beside it. Ordering written down instead of depending on
    // whether `sendemail` can answer `completed` synchronously.
    expect(feeding(MAIL, 'send')).toEqual([`${ANSWER}.out-ready`]);
    // 🔴 SBR-015 added the third sender, and it closes a hang this spec's own
    // ordering created: `stored` is the ONLY thing that fires `mail.send`, and
    // `mail.completed` is the only thing that answers — so a throw in `stored`
    // reached neither and a visitor watched the template's one PUBLIC endpoint
    // hang for the backend's full thirty seconds. Its script is two lines, but
    // `Outputs.ready is not a function` — the documented deployed failure of an
    // undeclared signal port — is exactly a throw here, and this graph has had
    // that bug before.
    expect(feeding(RESPONSE, 'send')).toEqual([
      `${WRITE}.failure`,
      `${MAIL}.completed`,
      `${ANSWER}.failure`
    ]);
  });

  it('🔴 …and the node SB-018 (5) would have flagged runs on the REQUEST, which is why it could not', () => {
    // The measurement behind rejecting that file's own suggested fix. `compose`
    // is fed by the Request node's `receive`, so anything it publishes is
    // published before the row is written — including on the path where the row
    // is never written at all.
    expect(feeding(BODY, 'run')).toEqual(['submitContactForm(name, email, message, pageSlug).receive']);
  });

  it('the failure path still answers, and answers with the key', () => {
    // `pm-received: false` as a PARAMETER, so `save.failure -> res.send` — which
    // never passes through `stored` — produces `{"received": false}` rather than
    // dropping the key. A parameter and not a wire on purpose: SB-017 §11
    // measured that the export copies parameters verbatim and the runtime
    // registers the input on that path, so this survives whatever happens to the
    // node's dynamic port list.
    const response = nodeOfType('noodl.cloud.response');
    expect(response.parameters).toEqual({ params: 'received', 'pm-received': false });
  });
});
