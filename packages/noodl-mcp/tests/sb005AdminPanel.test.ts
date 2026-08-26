/**
 * SB-005 — the admin panel, authored through the real MCP surface.
 *
 * 🔴 **Read this before reading a green run as evidence of anything.** Three
 * sessions in this phase produced a green authoring run and shipped a broken
 * template: s2's published the wrong rows, s3's could not answer a request, and
 * s4's real-backend run found four defects both doors had passed. Everything
 * below is a claim about a graph on disk. **The behavioural claim — that a draft
 * created through this panel is unreadable to an anonymous caller — is SB-008's
 * and is listed in SB-005 §5 as an unmet acceptance item.** Nothing here can
 * stand in for it.
 *
 * What this suite *can* say, and does:
 *  - every surface lands, with a `Page` root where it is a page (acceptance 1);
 *  - `Create Record` for `Page` and `Section` carries the draft ACL as
 *    parameters (acceptance 2), graded by a mutant that drops it;
 *  - nothing UPDATES `Page.published` (acceptance 3), graded by a mutant;
 *  - the filtered and unfiltered queries carry opposite shapes, asserted as a
 *    pair because applying the filtered shape to an unfiltered query is what
 *    broke `claimSite` in s4 (acceptance 4);
 *  - the claim screen answers every refusal with a constant (acceptance 5);
 *  - and one rule SB-005's draft acceptance did not have, found while building:
 *    an `Update Record` on a published row must carry NO access rules.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';
import { ADMIN_ONLY_RULES } from './sb004Components';
import { CLAIM_REFUSAL_TEXT, FN_PUBLISH, SB005_COMPONENTS, createPass } from './sb005Components';

jest.setTimeout(120000);

interface Diag {
  code: string;
  severity: string;
  message: string;
}
interface CreateResponse {
  created: string;
  legacyName: string;
  type: string;
  registeredPages?: unknown;
  validation: { summary: { errors: number; warnings: number; infos: number }; diagnostics?: Diag[] };
}
interface ErrorResponse {
  error: { code: string; message: string; details?: { readable?: string[]; newErrors?: Diag[] } };
}
type Either = CreateResponse & ErrorResponse;

interface GraphNode {
  id: string;
  type: string;
  /** The one stable handle a lookup may use — node ids are reallocated (SB-004 F9). */
  label?: string;
  parameters?: Record<string, unknown>;
  children?: string[];
  ports?: Array<{ name: string; type?: string; plug?: string }>;
}
interface Graph {
  nodes: GraphNode[];
  visualRoots?: string[];
}
interface Wire {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface Wires {
  connections: Wire[];
}
interface RegistryFile {
  components: Record<string, { type?: string; path?: string }>;
}

const readJson = <T>(dir: string, rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8')) as T;

/** Print whatever the door said, so a rejection is evidence rather than a red. */
function say(label: string, res: { isError: boolean; data: Either }): void {
  const readable = res.data?.error?.details?.readable;
  // eslint-disable-next-line no-console
  console.log(
    `\n[${label}] isError=${res.isError}` +
      (res.data?.validation?.summary ? ` summary=${JSON.stringify(res.data.validation.summary)}` : '') +
      (res.data?.error ? `\n  ${res.data.error.code}: ${res.data.error.message}` : '') +
      (readable ? `\n  ${readable.join('\n  ')}` : '') +
      (res.data?.validation?.diagnostics?.length
        ? `\n  ${res.data.validation.diagnostics.map((d) => `${d.severity} [${d.code}] ${d.message}`).join('\n  ')}`
        : '')
  );
}

/** What one component looks like once the door has written it. */
interface Written {
  graph: Graph;
  wires: Wire[];
}
const readWritten = (dir: string, key: string): Written => ({
  graph: readJson<Graph>(dir, `components/${key}/nodes.json`),
  wires: readJson<Wires>(dir, `components/${key}/connections.json`).connections
});
const clone = (w: Written): Written => JSON.parse(JSON.stringify(w)) as Written;

/**
 * 🔴 Resolve by TYPE and label, never by the id that was sent. Node ids are made
 * unique across the PROJECT, so an authored `save` may land as `save-2` — SB-004
 * F9. Every lookup below goes through here.
 */
function byType(w: Written, type: string): GraphNode[] {
  return w.graph.nodes.filter((n) => n.type === type);
}
function only(w: Written, type: string): GraphNode {
  const found = byType(w, type);
  expect(`${type}:${found.length}`).toBe(`${type}:1`);
  return found[0];
}
function byLabel(w: Written, type: string, label: string): GraphNode {
  const found = w.graph.nodes.filter((n) => n.type === type && n.label === label);
  expect(`${type}/${label}:${found.length}`).toBe(`${type}/${label}:1`);
  return found[0];
}

// ── The checks, as pure functions so a mutant can be graded against them ─────

/** Acceptance 2 — a record born a draft carries the admin rule, as parameters. */
export function assertDraftAcl(w: Written, collection: string): void {
  const creates = byType(w, 'NewDbModelProperties').filter((n) => n.parameters?.collectionName === collection);
  expect(`${collection} creates:${creates.length}`).toBe(`${collection} creates:1`);
  const params = creates[0].parameters ?? {};
  // 🔴 Asserted rule by rule against SB-004's constant, not by "has an ACL".
  // `_getACL` reads the rule LIST and each rule's own parameters, so a node with
  // `accessControl` but no `acl-admin-role` contributes nothing and the record is
  // written world-readable (`dbmodelcrudbase.ts:882-947`).
  for (const [key, value] of Object.entries(ADMIN_ONLY_RULES)) {
    expect(`${collection}.${key}=${JSON.stringify(params[key])}`).toBe(`${collection}.${key}=${JSON.stringify(value)}`);
  }
}

/**
 * Acceptance 3, in the form the invariant actually needs.
 *
 * The drafted criterion said *no node writes `Page.published`*. That is one step
 * too absolute: `duplicatePage`'s own Create Record sets `prop-published: false`
 * in the same node that carries the draft ACL (SB-004's `copy`), and so does the
 * panel's — writing the mirror to `false` beside the draft rule states the two in
 * agreement rather than leaving the mirror absent. What must never happen is an
 * UPDATE moving the mirror, because the enforced ACL stays where it was and the
 * two silently disagree. So: creation may state `false`; nothing may update it.
 */
export function assertNothingUpdatesPublished(w: Written): void {
  for (const node of byType(w, 'SetDbModelProperties')) {
    const keys = Object.keys(node.parameters ?? {});
    expect(`${node.label}:${keys.filter((k) => k === 'prop-published').join()}`).toBe(`${node.label}:`);
  }
  for (const wire of w.wires) {
    const target = w.graph.nodes.find((n) => n.id === wire.toId);
    if (target?.type !== 'SetDbModelProperties') continue;
    expect(`${target.label}<-${wire.toProperty}`).not.toBe(`${target.label}<-prop-published`);
  }
  // And creation may only state the mirror as `false`, beside the draft rule.
  for (const node of byType(w, 'NewDbModelProperties')) {
    if (!('prop-published' in (node.parameters ?? {}))) continue;
    expect(`${node.label} creates published=${JSON.stringify(node.parameters?.['prop-published'])}`).toBe(
      `${node.label} creates published=false`
    );
    expect(`${node.label} acl-admin-role=${String(node.parameters?.['acl-admin-role'])}`).toBe(
      `${node.label} acl-admin-role=admin`
    );
  }
}

/**
 * The rule SB-005's draft acceptance did not have, and the reason it matters is
 * a measurement rather than a worry.
 *
 * `_getACL` returns `undefined` for a node with no rules, the adapter puts that
 * on the body as `{ ACL: undefined }`, and `JSON.stringify` drops the key
 * (`ParseWireAdapter.ts:545`, `:272`) — so an update with no rules leaves the
 * stored ACL alone. Give one of these nodes rules and the opposite happens:
 * saving the title of a **published** page rewrites its ACL to the draft-only
 * rule, revoking the world's read while `published` stays `true`. That is the
 * invariant broken in the one direction its mirror cannot show.
 */
export function assertUpdatesCarryNoAcl(w: Written): void {
  for (const node of byType(w, 'SetDbModelProperties')) {
    const keys = Object.keys(node.parameters ?? {}).filter((k) => k === 'accessControl' || k.startsWith('acl-'));
    expect(`${node.label} acl params:${keys.sort().join(',')}`).toBe(`${node.label} acl params:`);
  }
  for (const wire of w.wires) {
    const target = w.graph.nodes.find((n) => n.id === wire.toId);
    if (target?.type !== 'SetDbModelProperties') continue;
    expect(`${target.label}<-${wire.toProperty.startsWith('acl-') ? 'ACL' : 'ok'}`).toBe(`${target.label}<-ok`);
  }
}

/**
 * Acceptance 4's filtered half, plus the part SB-004's shape could not carry
 * into a browser.
 *
 * Both `runOnChange-*` boxes off is the half that transfers: it is what stops
 * the load-time UNFILTERED fetch that no wire can be early enough to narrow
 * (SB-004 F12). The `Do`-unwired half does not transfer — a panel has to refresh
 * after a write, and re-emitting the same id cannot do it because
 * `simplejavascript.ts:162` publishes an output only when it CHANGES. So a
 * `storageFetch` wire is allowed here, and the safety is asserted at its source:
 * **no trigger may come from the same node that supplies the filter value**,
 * which is precisely the shape that let a signal reach the query in a pass where
 * the filter did not exist.
 */
export function assertFilteredQuery(w: Written, label: string, property: string): void {
  const node = byLabel(w, 'DbCollection2', label);
  expect(node.parameters?.['runOnChange-collectionName']).toBe(false);
  expect(node.parameters?.['runOnChange-querySettings']).toBe(false);

  const filter = node.parameters?.visualFilter as { rules?: Array<{ property?: string; input?: string; operator?: string }> };
  const rule = (filter?.rules ?? []).find((r) => r.property === property);
  expect(rule).toBeDefined();
  // `points to` is the operator that needs a schema and widens when it cannot
  // narrow (SB-004 F13). `Section.pageId` is a String precisely so this reads
  // `equal to`, and a future author who "improves" it back to a Pointer reddens.
  expect(rule?.operator).toBe('equal to');

  // A rule with no wire to its minted port narrows nothing: `collectFilterParameters`
  // DROPS a rule whose value is undefined, and a dropped rule matches every row.
  const port = `qp-${rule?.input}`;
  const filterFeeds = w.wires.filter((c) => c.toId === node.id && c.toProperty === port);
  expect(filterFeeds.length).toBe(1);

  const filterSource = filterFeeds[0].fromId;
  const triggers = w.wires.filter((c) => c.toId === node.id && c.toProperty === 'storageFetch');
  for (const t of triggers) {
    const from = w.graph.nodes.find((n) => n.id === t.fromId);
    expect(`${label} triggered by ${from?.label}:${t.fromId === filterSource ? 'THE FILTER SOURCE' : 'ok'}`).toBe(
      `${label} triggered by ${from?.label}:ok`
    );
  }
}

/**
 * Acceptance 4's other half, and it is not decoration.
 *
 * Switching the boxes off on a query that has NO filter parameter leaves it with
 * no trigger at all — `setQueryParameter` is the only one left and there is no
 * parameter to set. That is what made `claimSite` read a claimed site as
 * unclaimed in s4, so the two shapes are asserted together: one query must have
 * the setting and the other must not.
 */
export function assertUnfilteredQuery(w: Written, label: string): void {
  const node = byLabel(w, 'DbCollection2', label);
  expect(node.parameters?.visualFilter).toBeUndefined();
  expect(`${label} runOnChange-collectionName`).toBe(
    `${label} runOnChange-collectionName${node.parameters?.['runOnChange-collectionName'] === false ? ' SUPPRESSED' : ''}`
  );
  expect(`${label} runOnChange-querySettings`).toBe(
    `${label} runOnChange-querySettings${node.parameters?.['runOnChange-querySettings'] === false ? ' SUPPRESSED' : ''}`
  );
}

/**
 * Acceptance 5 — F7's oracle stays closed.
 *
 * Two things, and the second is the one an author would erode first: the
 * refusal is a CONSTANT (a parameter, with nothing wired to that Text's `text`),
 * and **no `error` output anywhere in the component is read**. `claimSite`
 * answers every refusal with one message by design; a panel that rendered the
 * node's `error`, or that told the two failure edges apart, would hand back the
 * "is this site claimed yet?" oracle the backend closed.
 */
export function assertSingleMessagedRefusal(w: Written): void {
  const refusals = w.graph.nodes.filter((n) => n.type === 'Text' && n.parameters?.text === CLAIM_REFUSAL_TEXT);
  expect(refusals.length).toBe(1);
  expect(w.wires.some((c) => c.toId === refusals[0].id && c.toProperty === 'text')).toBe(false);

  const errorReads = w.wires
    .filter((c) => c.fromProperty === 'error')
    .map((c) => `${w.graph.nodes.find((n) => n.id === c.fromId)?.label}.error`);
  expect(errorReads).toEqual([]);

  // Every way the claim itself can fail reaches that one message.
  const claim = only(w, 'CloudFunction2');
  const failures = w.wires.filter((c) => c.fromId === claim.id && c.fromProperty === 'failure');
  expect(failures.length).toBe(1);
  const gate = w.graph.nodes.find((n) => n.id === failures[0].toId);
  expect(gate?.type).toBe('Condition');
  expect(w.wires.some((c) => c.fromId === gate?.id && c.fromProperty === 'result' && c.toId === refusals[0].id && c.toProperty === 'visible')).toBe(
    true
  );
}

/**
 * One row per code node: what its script *calls* as a signal, and what the graph
 * *declares* as a signal port. They must be the same list — see the test below.
 */
function signalPortRows(entries: ReadonlyArray<readonly [string, Written]>): string[] {
  const rows: string[] = [];
  for (const [key, w] of entries) {
    for (const node of byType(w, 'JavaScriptFunction')) {
      const script = String(node.parameters?.functionScript ?? '');
      const emitted = [...new Set([...script.matchAll(/Outputs\.(\w+)\s*\(\)/g)].map((m) => m[1]))].sort();
      const declared = (node.ports ?? [])
        .filter((p) => p.plug === 'output' && p.type === 'signal')
        .map((p) => p.name.replace(/^out-/, ''))
        .sort();
      rows.push(`${key}/${node.label}: emits=${emitted.join('|')} declared=${declared.join('|')}`);
    }
  }
  return rows;
}

describe('SB-005: the admin panel, through the MCP door', () => {
  let session: TestSession;
  let dir: string;
  const written: Record<string, Written> = {};
  const results: Record<string, { isError: boolean; data: Either }> = {};

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    // 🔴 The known-firing arm for the two-pass structure, and it has to run
    // FIRST, on an empty project — otherwise "we authored in two passes" is a
    // habit rather than a measurement. This is the whole component, back-link
    // and all, offered to the create door exactly as an agent would offer it.
    const cyclic = SB005_COMPONENTS.find((c) => c.deferred?.length)!;
    results.__control__ = await call<Either>(session, 'create_component', {
      path: cyclic.path,
      nodes: cyclic.nodes,
      connections: cyclic.connections
    });
    say(`CONTROL: ${cyclic.path} with its back-link, nothing else authored`, results.__control__);

    // Pass one: create, in the order that resolves every forward reference.
    for (const c of SB005_COMPONENTS) {
      const payload = createPass(c);
      const res = await call<Either>(session, 'create_component', {
        path: c.path,
        nodes: payload.nodes,
        connections: payload.connections
      });
      say(`create ${c.path}`, res);
      results[c.key] = res;
    }
    // Pass two: close the cycles the create pass could not name.
    for (const c of SB005_COMPONENTS) {
      if (!c.deferred?.length) continue;
      const res = await call<Either>(session, 'update_component', {
        path: c.path,
        set: { nodes: c.nodes, connections: c.connections }
      });
      say(`close ${c.path}`, res);
      results[`${c.key}:update`] = res;
    }
    for (const c of SB005_COMPONENTS) {
      if (fs.existsSync(path.join(dir, `components/${c.key}/nodes.json`))) written[c.key] = readWritten(dir, c.key);
    }
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lands all six surfaces, pages with a Page root (acceptance 1)', () => {
    const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
    for (const c of SB005_COMPONENTS) {
      expect(`${c.path}:${results[c.key].isError}`).toBe(`${c.path}:false`);
      expect(`${c.path}:${results[c.key].data.legacyName}`).toBe(`${c.path}:${c.legacyName}`);
      expect(registry.components[c.key]).toBeDefined();
      if (c.isPage) {
        const roots = written[c.key].graph.visualRoots ?? [];
        const rootNode = written[c.key].graph.nodes.find((n) => n.id === roots[0]);
        expect(`${c.path} root:${rootNode?.type}`).toBe(`${c.path} root:Page`);
      }
    }
  });

  /**
   * The cycle, closed — and the assertion that says the second pass was needed
   * rather than merely performed.
   *
   * Every `RouterNavigate.target` and every `For Each.template` in the finished
   * panel names a component that exists. That is the state the door enforces on
   * the way in; what it cannot enforce is that the state was *reachable*, and
   * this panel's was not in one pass (see `SB005_COMPONENTS`).
   */
  it('every component reference in the finished panel resolves', () => {
    const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
    const known = new Set(Object.keys(registry.components).map((k) => `/${k}`));
    const refs: string[] = [];
    for (const c of SB005_COMPONENTS) {
      for (const n of byType(written[c.key], 'For Each')) refs.push(String(n.parameters?.template));
      for (const n of byType(written[c.key], 'RouterNavigate')) refs.push(String(n.parameters?.target));
    }
    expect(refs.length).toBe(7);
    for (const r of refs) expect(`${r}:${known.has(r)}`).toBe(`${r}:true`);
  });

  it('CONTROL: the back-link really is refused before its target exists', () => {
    const res = results.__control__;
    expect(res.isError).toBe(true);
    // Named by CODE, not by "it errored": the arm is worthless if the rejection
    // could have been a bad port or a malformed script.
    const readable = (res.data.error?.details?.readable ?? []).join('\n');
    expect(readable).toContain('unresolved-navigation');
    expect(readable).toContain('/Pages/Admin');
    // And nothing was written — the *second* half of why a second pass is
    // needed. A door that wrote the component and merely warned would have let
    // one pass stand.
    const cyclic = SB005_COMPONENTS.find((c) => c.deferred?.length)!;
    expect(results[cyclic.key].isError).toBe(false);
  });

  it('creates Page and Section rows with the draft ACL (acceptance 2)', () => {
    assertDraftAcl(written['Pages/Admin'], 'Page');
    assertDraftAcl(written['Pages/PageEditor'], 'Section');
  });

  it('MUTANT: dropping the admin rule from the new-page node reddens', () => {
    const mutant = clone(written['Pages/Admin']);
    const create = mutant.graph.nodes.find((n) => n.type === 'NewDbModelProperties');
    for (const key of Object.keys(ADMIN_ONLY_RULES)) delete create!.parameters![key];
    expect(() => assertDraftAcl(mutant, 'Page')).toThrow();
  });

  it('MUTANT: an accessControl list with no rule parameters reddens', () => {
    // The subtle version, and the one a careless author actually writes: the
    // list is there, so "has an ACL" would pass, but `_getACL` builds nothing
    // from it and the row is written world-readable.
    const mutant = clone(written['Pages/PageEditor']);
    const create = mutant.graph.nodes.find((n) => n.type === 'NewDbModelProperties');
    delete create!.parameters!['acl-admin-role'];
    expect(() => assertDraftAcl(mutant, 'Section')).toThrow();
  });

  it('never updates Page.published; publish goes through the cloud function (acceptance 3)', () => {
    for (const c of SB005_COMPONENTS) assertNothingUpdatesPublished(written[c.key]);

    // And the positive half: publish IS reachable, through `publishPage`.
    const row = written['Admin/PageRow'];
    const calls = byType(row, 'CloudFunction2').filter((n) => n.parameters?.function === FN_PUBLISH);
    expect(calls.length).toBe(2);
    expect(calls.map((n) => n.parameters?.['in-publish']).sort()).toEqual([false, true]);
  });

  it('MUTANT: an Update Record writing published reddens', () => {
    const mutant = clone(written['Pages/PageEditor']);
    const save = mutant.graph.nodes.find((n) => n.type === 'SetDbModelProperties');
    save!.parameters!['prop-published'] = true;
    expect(() => assertNothingUpdatesPublished(mutant)).toThrow();
  });

  it('MUTANT: a WIRE into prop-published reddens too', () => {
    // The parameter check alone would pass this one, and a wired boolean is the
    // more natural way an author would write "a Published checkbox".
    const mutant = clone(written['Pages/PageEditor']);
    const save = mutant.graph.nodes.find((n) => n.type === 'SetDbModelProperties')!;
    const box = mutant.graph.nodes.find((n) => n.type === 'net.noodl.controls.checkbox')!;
    mutant.wires.push({ fromId: box.id, fromProperty: 'checked', toId: save.id, toProperty: 'prop-published' });
    expect(() => assertNothingUpdatesPublished(mutant)).toThrow();
  });

  it('no Update Record anywhere carries access rules', () => {
    for (const c of SB005_COMPONENTS) assertUpdatesCarryNoAcl(written[c.key]);
  });

  it('MUTANT: giving the page save the draft rule reddens', () => {
    const mutant = clone(written['Pages/PageEditor']);
    const save = mutant.graph.nodes.find((n) => n.type === 'SetDbModelProperties');
    Object.assign(save!.parameters!, ADMIN_ONLY_RULES);
    expect(() => assertUpdatesCarryNoAcl(mutant)).toThrow();
  });

  it('the two query shapes, asserted as a pair (acceptance 4)', () => {
    assertFilteredQuery(written['Pages/PageEditor'], "This page's sections", 'pageId');
    assertUnfilteredQuery(written['Pages/Admin'], 'Every page, draft and published');
  });

  it('MUTANT: the filtered query fetching at load reddens', () => {
    const mutant = clone(written['Pages/PageEditor']);
    const q = mutant.graph.nodes.find((n) => n.label === "This page's sections")!;
    delete q.parameters!['runOnChange-querySettings'];
    expect(() => assertFilteredQuery(mutant, "This page's sections", 'pageId')).toThrow();
  });

  it('MUTANT: triggering the filtered query from its own filter source reddens', () => {
    const mutant = clone(written['Pages/PageEditor']);
    const q = mutant.graph.nodes.find((n) => n.label === "This page's sections")!;
    const feed = mutant.wires.find((c) => c.toId === q.id && c.toProperty === 'qp-pageId')!;
    mutant.wires.push({ fromId: feed.fromId, fromProperty: 'out-ready', toId: q.id, toProperty: 'storageFetch' });
    expect(() => assertFilteredQuery(mutant, "This page's sections", 'pageId')).toThrow();
  });

  it("MUTANT: applying the filtered shape to the page list reddens (s4's claimSite defect)", () => {
    const mutant = clone(written['Pages/Admin']);
    const q = mutant.graph.nodes.find((n) => n.label === 'Every page, draft and published')!;
    q.parameters!['runOnChange-collectionName'] = false;
    q.parameters!['runOnChange-querySettings'] = false;
    expect(() => assertUnfilteredQuery(mutant, 'Every page, draft and published')).toThrow();
  });

  /**
   * The routing chain, end to end, because it is four separate spellings of one
   * name and any of them can be edited alone.
   *
   * `RouterNavigate.pm-pageId` → the Router → `PageInputs.pm-pageId`, with
   * `Page.urlPath` carrying the parameter so the address bar survives a reload.
   * All four halves are wire- or parameter-driven — `registerInputIfNeeded`
   * (`router-navigate.ts:171`) and `registerOutputIfNeeded`
   * (`page-inputs.ts:64`), both reached from `NodeScope` on the connection path
   * (`nodescope.ts:149-150`) — so none of them depends on the editor-only
   * `setup()` that SB-004 F10 was about.
   *
   * ⚠️ Braces, not a colon: the Router matches `{name}` (`router.tsx:614`, `:753`).
   * A `:pageId` would be a literal path segment and the parameter would never
   * reach the page, with nothing anywhere reporting it.
   */
  it('the page id reaches the editor: navigate → router → page inputs', () => {
    const row = written['Admin/PageRow'];
    const nav = only(row, 'RouterNavigate');
    expect(nav.parameters?.target).toBe('/Pages/PageEditor');
    expect(nav.parameters?.router).toBe('Main');
    expect(row.wires.some((c) => c.toId === nav.id && c.toProperty === 'pm-pageId')).toBe(true);

    const editor = written['Pages/PageEditor'];
    const pageNode = only(editor, 'Page');
    expect(String(pageNode.parameters?.urlPath)).toContain('{pageId}');

    const inputs = only(editor, 'PageInputs');
    expect(String(inputs.parameters?.pathParams).split(',').map((s) => s.trim())).toContain('pageId');
    expect(editor.wires.some((c) => c.fromId === inputs.id && c.fromProperty === 'pm-pageId')).toBe(true);
  });

  /**
   * SB-004 F10, asserted on the browser side — the one doctrine rule that
   * crosses the boundary unchanged, and the one no door can catch.
   *
   * `Outputs.x()` is a call, and it works only if `out-x` is on the node's model
   * as a `signal` port: `_isSignalType` reads `model.outputPorts[name].type` and
   * nothing else (`simplejavascript.ts:634-636`). The editor derives that port by
   * parsing the script, but the derivation lives in a `setup()` that returns
   * unless `context.editorConnection.isRunningLocally()` (`:772-775`) — and a
   * deployed bundle has no editor connection, exactly as a deployed backend has
   * none. Undeclared, the call throws `is not a function` at run time and every
   * wire downstream of it is dead.
   *
   * Read from disk rather than from the constants, so this says what a deploy
   * would find.
   */
  it("every code node's signal outputs are declared as ports (SB-004 F10)", () => {
    const rows = signalPortRows(SB005_COMPONENTS.map((c) => [c.key, written[c.key]] as const));
    for (const row of rows) {
      const [, emits, declared] = row.match(/emits=(.*) declared=(.*)$/)!;
      // Both halves in the message, so a mismatch names the node and shows what
      // it emits — a bare boolean here would be a red with nothing to act on.
      expect(`${row.split(':')[0]} ${emits}`).toBe(`${row.split(':')[0]} ${declared}`);
    }
    // The census half: this loop must have seen every code node, and four of
    // them must actually declare something — otherwise "no mismatches" could
    // mean the door never persisted `ports` and the check compared '' with ''.
    expect(rows.length).toBe(8);
    expect(rows.filter((r) => !r.endsWith('declared=')).length).toBe(4);
  });

  it('MUTANT: dropping a declared signal port reddens', () => {
    const mutant = clone(written['Pages/PageEditor']);
    const code = mutant.graph.nodes.find(
      (n) => n.type === 'JavaScriptFunction' && String(n.parameters?.functionScript).includes('Outputs.ready()')
    )!;
    code.ports = [];
    const rows = signalPortRows([['Pages/PageEditor', mutant]]);
    expect(() => {
      for (const row of rows) {
        const [, emits, declared] = row.match(/emits=(.*) declared=(.*)$/)!;
        expect(`${row.split(':')[0]} ${emits}`).toBe(`${row.split(':')[0]} ${declared}`);
      }
    }).toThrow();
  });

  it('answers every refused claim with one constant (acceptance 5)', () => {
    assertSingleMessagedRefusal(written['Pages/Setup']);
  });

  /**
   * The census, and it is not decoration.
   *
   * Every check above is a `for` loop over nodes of a type. A loop over an empty
   * list passes, so an edit that renamed a type, or a component that quietly
   * stopped being authored, would leave this suite green while checking nothing.
   * These counts are what make the greens above mean "checked" rather than "not
   * present" — the trap this phase has hit more than once.
   */
  it('CENSUS: the checks above ran over the nodes they claim to cover', () => {
    const count = (type: string) =>
      SB005_COMPONENTS.reduce((n, c) => n + byType(written[c.key], type).length, 0);
    expect({
      creates: count('NewDbModelProperties'),
      updates: count('SetDbModelProperties'),
      deletes: count('DeleteDbModelProperties'),
      queries: count('DbCollection2'),
      functions: count('CloudFunction2'),
      repeaters: count('For Each'),
      code: count('JavaScriptFunction'),
      pages: count('Page')
    }).toEqual({
      // Page (Admin) and Section (PageEditor) — the two acceptance-2 nodes.
      creates: 2,
      // PageEditor's page save, SectionRow's section save, ThemeEditor's two.
      updates: 4,
      deletes: 1,
      // Admin's page list, PageEditor's sections, ThemeEditor's two singletons.
      queries: 4,
      // publish, unpublish, duplicate, claim.
      functions: 4,
      repeaters: 2,
      // PageRow 1, SectionRow 2, Setup 1, PageEditor 1, ThemeEditor 3.
      code: 8,
      pages: 4
    });
  });

  it('MUTANT: rendering the cloud function error reddens', () => {
    const mutant = clone(written['Pages/Setup']);
    const claim = mutant.graph.nodes.find((n) => n.type === 'CloudFunction2')!;
    const refusal = mutant.graph.nodes.find((n) => n.parameters?.text === CLAIM_REFUSAL_TEXT)!;
    mutant.wires.push({ fromId: claim.id, fromProperty: 'error', toId: refusal.id, toProperty: 'text' });
    expect(() => assertSingleMessagedRefusal(mutant)).toThrow();
  });
});
