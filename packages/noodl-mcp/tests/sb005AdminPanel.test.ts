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
import {
  ADMIN_FILL_EXEMPTIONS,
  ADMIN_LAYOUT_OWED,
  CLAIM_REFUSAL_TEXT,
  FN_PUBLISH,
  IN_A_ROW,
  SB005_COMPONENTS,
  STACKED,
  createPass
} from './sb005Components';
import { SB006_COMPONENTS, STACKED_IN_A_COLUMN, createPass as createPass006 } from './sb006Components';

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

    // 🔴 The public site FIRST, because `buildSiteTemplateProject` writes it
    // first and `/Admin/Shell`'s "View site" names `/Pages/Site`. This spec used
    // to author the admin set into an otherwise empty project, which is a
    // population the panel never ships into — and the difference was silent
    // until a component here referred outward for the first time.
    for (const c of SB006_COMPONENTS) {
      const payload = createPass006(c);
      await call<Either>(session, 'create_component', {
        path: c.path,
        nodes: payload.nodes,
        connections: payload.connections
      });
    }
    for (const c of SB006_COMPONENTS) {
      if (!c.deferred?.length) continue;
      await call<Either>(session, 'update_component', {
        path: c.path,
        set: { nodes: c.nodes, connections: c.connections }
      });
    }

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
    // 7 → 9: `/Admin/Shell` adds Pages, Theme & settings and View site.
    // 9 → 13: SBR-017's way back in — the shell's sign-out landing, the sign-in
    // screen's two (into the panel, back to the claim screen) and the claim
    // screen's link forward to it.
    // 13 → 14: SBR-007's Preview button, which navigates to `/Pages/Site`.
    // 14 → 16: SBR-010's two, and they are one of each KIND, which is why the
    // number moves by two for one screen: `/Admin/Shell`'s `goMessages` — the
    // navigate the Messages rail item never had — and `/Pages/Messages`'s
    // `For Each.template`, pointing at `/Admin/MessageRow`.
    // ⚠️ This counts `For Each.template` and `RouterNavigate.target` only — the
    // page editor's new `/Admin/Shell` PLACEMENT is not a reference by this
    // definition and moves this number not at all. AC5's test is what covers it.
    expect(refs.length).toBe(16);
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
    // 8 → 10: the shell's `navStyle` and the page list's row-count sentence.
    // 10 → 13: SBR-007's three on the page editor — `headline`, `status` and
    // `dirty`. 🔴 **The second number stays 4 and that is the assertion that
    // matters here**: all three emit VALUES only (`Outputs.headline`,
    // `Outputs.label`, `Outputs.dirty`), never `Outputs.x()`, so none of them
    // owes a declared signal port. A new code node that called a signal output
    // and did not declare it would move the second number, not the first — which
    // is D14's defect, one component over.
    // 13 → 15 and 4 → 6: SBR-007 AC2's `moveUp` and `moveDown` on the page
    // editor. They move BOTH numbers, and that is the reading that says they are
    // right: each emits `Outputs.go()` and each declares `out-go`, so each is a
    // code node (first) that declares something (second). A pair that had called
    // a signal without declaring it would have moved the first alone — and been
    // caught by the loop above, which is where the mismatch is actually named.
    // 15 → 16 and 6 → 7: AC2's GESTURE — `dropIndex` on `/Admin/SectionRow`, the
    // first of these three to live in the row rather than on the editor. It moves
    // both numbers for the same reason the pair did, and it declares TWO signals
    // rather than one (`out-go` and `out-snap`) — which the second number cannot
    // see, because it counts nodes that declare something and not ports. The loop
    // above is what checks both are declared; a `snap` called and undeclared
    // would red there, naming the node.
    // 16 → 18 and 7 → 9: SBR-005 split `/Admin/SectionRow`'s single `merge` into
    // three writers. `absorb` folds an uploaded picture into `data.image` or
    // `data.images` depending on the kind, and `dropLast` takes the last gallery
    // picture back — both emit `Outputs.built()`, so both move BOTH numbers.
    //
    // 🔴 The split is not tidying. `merge` runs on the save press *and* on
    // `upload.done` and held the uploaded file on a value input: harmless while
    // the fold was `next.image = file`, and a duplicate-append on every
    // subsequent save the moment a gallery accumulates.
    // 18 → 22 and 9 → **9**: SBR-009 adds four code nodes and the second number
    // does not move, which is arithmetic rather than luck. `presets` emits
    // `Outputs.picked()` and declares `out-picked` (+1); `buildTokens` LOST its
    // `Outputs.built()` (−1), because Save no longer runs it — the button wires
    // straight to the record write and the object is always current. `previewCss`
    // emits a string, and the two appliers (one on `/Pages/ThemeEditor`, one on
    // `/Admin/Shell`) end in `setProperty` calls and return nothing, so neither
    // owes a declared port.
    //
    // 🔴 A +1/−1 that cancels is the shape a census cannot see, and it is exactly
    // why the loop above names nodes rather than counting them: a `picked` called
    // and undeclared would leave this pair of numbers untouched and red there.
    // 22 → 24 and 9 → **9**: SBR-010's `stamp` (the row's date and sender
    // sentences) and `tally` (the count/empty sentence). Neither calls a signal
    // out, so both are `declared=` rows and the second number is unmoved —
    // which is the arithmetic, not the luck: a screen that only READS records
    // has nothing to announce.
    // 24 → 25 and 9 → **10**: D54's `pick` on `/Admin/PresetChip`. It calls
    // `Outputs.picked()` and declares `out-picked`, so it moves BOTH — the shape
    // this pair is built to see. The chip publishes its own name at the press
    // because three placements sharing one mount-time value made every press
    // answer with the LAST placement; the picker's `run` says *now* and never
    // *which*.
    // 25 → 28 and 10 → **10**: REL-011c's three breakpoints — `fold` on
    // `/Admin/Shell`, `fields` on `/Pages/PageEditor` and `panes` on
    // `/Pages/ThemeEditor`. All three turn a
    // `Screen Resolution` width into port VALUES and neither announces anything,
    // so both are `declared=` rows and the second number is unmoved. That is the
    // arithmetic and not the luck: a node that decides a layout has nobody to
    // tell — the ports it feeds are read, not signalled.
    //
    // ⚠️ **Three nodes and not one, deliberately.** The shell's fold, the page
    // editor's two-up and the theme editor's two panes read the same number and
    // could have been one node with a `Component Outputs` hop — but a shell that
    // reports its layout to its children has to be right about all of them, and
    // three readers is three nodes against one contract.
    // 27 → 28: A9's `panes` on `/Pages/ThemeEditor`, same shape, same number.
    // 28 → 29: SBR-007 AC3's `dropWords` on `/Admin/SectionRow` — it turns the
    // drop zone's `Is Dragging Over` into the sentence the zone is showing. It
    // is a `declared=` row and the second number is unmoved, by the same
    // arithmetic as the three layout readers above: a node that only publishes a
    // string has nobody to signal.
    expect(rows.length).toBe(29);
    expect(rows.filter((r) => !r.endsWith('declared=')).length).toBe(10);
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
  /**
   * 🔴 **The invariant AC2's drag rests on, and it is a TREE property, not a wire.**
   *
   * `dropIndex` on `/Admin/SectionRow` turns a drop into a `toIndex` by counting
   * `el.parentElement.children` — the siblings whose centre sits above the dragged card's. A
   * `For Each` draws no box of its own and renders its items into its VISUAL PARENT's element, so
   * that count is only the section rows while the For Each's parent holds the For Each and nothing
   * else. `sectionRows` exists for exactly this.
   *
   * Before it existed the For Each sat directly under `sectionsPanel`, beside `sectionsHeader` and
   * `reorderRefusal` — two elements that would have been counted as rows above every section, so
   * every drop would have reported an index two too high and the endpoint would have obeyed it.
   *
   * ⚠️ **Nothing else in this suite can see that.** The wires are all correct in that arrangement,
   * the appearance ratchet is satisfied by it, and the whole thing renders. It fails only when a
   * person drags, which is why it is asserted here rather than left to be found.
   */
  it("the section repeater's parent holds the repeater and nothing else — AC2's drop index depends on it", () => {
    const editor = written['Pages/PageEditor'];
    const repeater = editor.graph.nodes.find((n) => n.type === 'For Each');
    expect(repeater).toBeDefined();

    // `children` is a list of ids, not of nodes — see the `Written` type at the top of this file.
    const parentOf = (id: string) => editor.graph.nodes.find((n) => (n.children ?? []).includes(id));

    const holder = parentOf(repeater!.id);
    expect(holder).toBeDefined();
    // The claim: one child, and it is the repeater.
    expect(holder!.children ?? []).toEqual([repeater!.id]);

    // …and the control, which is what says the walk above found a real tree rather than an empty
    // one: the holder is itself placed, and its own parent has SEVERAL children — the arrangement
    // the repeater used to be in, still present one level up.
    const panel = parentOf(holder!.id);
    expect(panel).toBeDefined();
    expect((panel!.children ?? []).length).toBeGreaterThan(1);
  });

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
      // 🔴 **SBR-010 moves four of these numbers and none of the top three.**
      // `creates`, `updates` and `deletes` are unmoved, and that is the task's
      // scope asserted as arithmetic rather than as prose: a read-only screen
      // writes nothing, so a Reply, a Delete or a mark-as-read arriving later
      // reddens HERE first, whoever adds it and whatever they call it.
      // Admin's page list, PageEditor's sections, ThemeEditor's two singletons.
      // 4 → 5: SBR-009 AC1 puts a Theme query in `/Admin/Shell`, so every admin
      // screen wears the client's theme rather than the shipped Studio blue.
      // 🔴 It is in the SHELL and not on each screen for the reason the sidebar
      // is a component: one node cannot disagree with itself between two screens.
      // 5 → 6: SBR-010's `ContactMessage` query on `/Pages/Messages` — the
      // unfiltered kind, like `/Pages/Admin`'s page list, and it wants the
      // load-time fetch for the same reason.
      queries: 6,
      // publish, unpublish, duplicate, claim.
      // 4 → 5: SBR-007 AC2's `reorder` on the page editor.
      functions: 5,
      // 2 → 3: SBR-010's message list. A `For Each` over `/Admin/MessageRow`.
      repeaters: 3,
      // PageRow 1, SectionRow 2, Setup 1, PageEditor 4, ThemeEditor 3.
      // 10 → 13: SBR-007's `headline`, `status` and `dirty` on the page editor.
      // 13 → 15: AC2's `moveUp` and `moveDown`, also on the page editor — two
      // nodes rather than one because a Function has a single `run` signal.
      // 15 → 16: AC2's `dropIndex`, on `/Admin/SectionRow` — so the SectionRow
      // term of the breakdown above is 3, not 2. It is in the ROW because it is
      // the only place that can see the dropped card's element; the two planners
      // are on the editor because only the editor can see the sorted list.
      // 18 → 22: SBR-009's four — `presets`, `previewCss` and an applier on
      // `/Pages/ThemeEditor` (so the ThemeEditor term is 6, not 3), and a second
      // applier on `/Admin/Shell`. The two appliers run ONE script,
      // `buildThemeApplierScript()`, shared with the public site's.
      // 16 → 18: SBR-005's `absorb` and `dropLast` on `/Admin/SectionRow`, so
      // its term is 5. See the note on the signal-port count above for why the
      // picture fold could not stay inside `merge`.
      // 22 → 24: SBR-010's `stamp` on `/Admin/MessageRow` (the date and the
      // sender fallback, both derived rather than wired straight through) and
      // `tally` on `/Pages/Messages` (the count-or-empty sentence).
      // 24 → 25: D54's `pick` on `/Admin/PresetChip` — the first code node in
      // that component, and the smallest one here: it republishes this chip's
      // own name at the press so the picker can tell three placements apart.
      // 25 → 28: REL-011c's three breakpoints — `fold` on `/Admin/Shell` (so its
      // term is 2, not 1), `fields` on `/Pages/PageEditor` (so its term is 7)
      // and `panes` on `/Pages/ThemeEditor` (so its term is 7). 🔴 Each sits
      // beside a `Screen Resolution` node, which is the only reactive viewport
      // reading in the runtime outside a `Columns` ratio: the admin shell had NO
      // breakpoint of any kind, so its 240px rail kept all 240 of its pixels at
      // 390 and every admin screen got ~150px. A9 is the one that says the shell
      // folding is not enough on its own — `/admin/theme` went from 362px
      // unreachable to 102 and kept its live preview off the right-hand edge.
      // 28 → 29: SBR-007 AC3's `dropWords` on `/Admin/SectionRow`, the drop
      // zone's hover sentence. The three write counts above are unmoved, which
      // is the claim: a drop is a second GESTURE onto the existing upload path,
      // not a second way to write a record.
      code: 29,
      // 4 → 5: SBR-017's `/Pages/SignIn`.
      // 5 → 6: SBR-010's `/Pages/Messages`.
      pages: 6
    });
  });


  // ── SBR-006: the admin shell ───────────────────────────────────────────────

  /**
   * 🔴 **The check the admin set never had.** `sb006PublicSite.test.ts` walks the
   * PUBLIC site with this rule and reds on anything that takes space it was not
   * given; the admin screens were outside its population, and running the same
   * rule over the shipped artefact for the first time reported **eleven** growing
   * nodes here against two there — `/Admin/PageRow` alone had four, so the page
   * rows divided the list's height between them instead of stacking.
   *
   * 🔴 **One hop this walk has and the public site's does not: `Component
   * Children`.** `/Admin/Shell` renders each screen's body at its slot
   * (`nodescope.ts:217`), so a screen's own nodes are laid out by a Group inside
   * a DIFFERENT component. Without that hop the walk stops at the shell instance
   * and never grades the body at all — it reached 41 nodes instead of 61, and
   * `/Admin/PageRow` silently vanished from the report rather than being fixed.
   * That was measured on this artefact, not imagined: the first run after the
   * rebuild looked like an improvement because the check had stopped looking.
   */
  const DEFAULT_SIZE_MODE: Record<string, string> = { Group: 'explicit', Text: 'contentHeight', Image: 'contentSize' };
  const assignsWidth = (mode: string) => mode === 'explicit' || mode === 'contentHeight';
  const assignsHeight = (mode: string) => mode === 'explicit' || mode === 'contentWidth';

  /** A slot handed down so `Component Children` can expand the instance's own children. */
  type Slot = { key: string; ids: string[] } | null;

  /**
   * The walk as ONE function, because the mutants below have to run **this** and
   * not a restatement of it — a sabotage that reddens a second implementation
   * proves only that the second implementation exists.
   *
   * Returns the graded population as well as the growing set, so an empty result
   * can be told apart from a walk that never ran.
   */
  function findGrowingNodes(
    source: Record<string, Written>,
    owed: ReadonlyArray<{ component: string; label: string }> = ADMIN_LAYOUT_OWED
  ): { graded: string[]; growing: string[] } {
    const exempt = new Set(
      [...ADMIN_FILL_EXEMPTIONS.map((e) => `${e.component} | ${e.label}`)].concat(
        owed.map((e) => `${e.component} | ${e.label}`)
      )
    );
    const componentOf = new Map(SB005_COMPONENTS.map((c) => [c.legacyName, c.key] as const));
    const graded: string[] = [];
    const growing: string[] = [];

    const walk = (key: string, ids: string[], parentLayout: string, seen: Set<string>, slot: Slot): void => {
      const source_ = source[key];
      if (!source_) return;
      const nodes = new Map(source_.graph.nodes.map((n) => [n.id, n]));
      for (const id of ids) {
        const node = nodes.get(id);
        if (!node) continue;

        const target = componentOf.get(node.type);
        if (target) {
          // Descend into the placed component, carrying THIS instance's children
          // as the slot its `Component Children` will render.
          walk(target, source[target]?.graph.visualRoots ?? [], parentLayout, new Set([...seen, target]), {
            key,
            ids: node.children ?? []
          });
          continue;
        }

        if (node.type === 'Component Children') {
          if (slot) walk(slot.key, slot.ids, parentLayout, seen, null);
          continue;
        }

        if (node.type === 'For Each') {
          const template = componentOf.get(String(node.parameters?.template ?? ''));
          if (template && !seen.has(template)) {
            walk(template, source[template]?.graph.visualRoots ?? [], parentLayout, new Set([...seen, template]), null);
          }
          continue;
        }

        const defaultMode = DEFAULT_SIZE_MODE[node.type];
        if (defaultMode !== undefined) {
          const mode = String(node.parameters?.sizeMode ?? defaultMode);
          const alongAxis = parentLayout === 'row' ? 'width' : 'height';
          const assigned = parentLayout === 'row' ? assignsWidth(mode) : assignsHeight(mode);
          const authored = node.parameters?.[alongAxis] !== undefined;
          const name = `${key} | ${node.label ?? node.type}`;
          graded.push(name);
          if (assigned && !authored && !exempt.has(name)) {
            growing.push(`${name} — ${alongAxis} defaults to 100% along its parent's ${parentLayout}`);
          }
        }

        const layout = node.type === 'Group' ? String(node.parameters?.flexDirection ?? 'column') : parentLayout;
        walk(key, node.children ?? [], layout, seen, slot);
      }
    };

    for (const c of SB005_COMPONENTS) {
      if (!c.isPage) continue;
      walk(c.key, source[c.key]?.graph.visualRoots ?? [], 'column', new Set([c.key]), null);
    }
    return { graded, growing };
  }

  it('AC1: nothing on an admin screen takes space it was not given', () => {
    const { graded, growing } = findGrowingNodes(written);
    // 🔴 The population, asserted first — and by NAME rather than by a count,
    // because the hole this walk shipped with made the count go DOWN quietly.
    // Both of these are reachable only through the shell's `Component Children`
    // slot, and the second only through the `For Each` beyond it: if the hop
    // regresses, they disappear from the graded set and this reds instead of
    // reporting a cheerful empty `growing`.
    expect(graded).toContain('Pages/Admin | Heading');
    expect(graded).toContain('Admin/PageRow | Title');
    expect(graded.length).toBeGreaterThan(35);
    expect(growing).toEqual([]);
  });

  it('AC1 MUTANT: the page row without its size mode reds, and names the row', () => {
    const mutant = { ...written, 'Admin/PageRow': clone(written['Admin/PageRow']) };
    delete byLabel(mutant['Admin/PageRow'], 'Group', 'One page').parameters!.sizeMode;
    const { growing } = findGrowingNodes(mutant);
    expect(growing).toEqual(["Admin/PageRow | One page — height defaults to 100% along its parent's column"]);
  });

  it('AC1 MUTANT: the walk without its Component Children hop stops grading the body', () => {
    // The hole this gate was nearly shipped with. Removing the shell's slot node
    // is the same thing as not following it: the screens' own bodies stop being
    // reachable, and the report gets QUIETER rather than louder.
    const mutant = { ...written, 'Admin/Shell': clone(written['Admin/Shell']) };
    mutant['Admin/Shell'].graph.nodes = mutant['Admin/Shell'].graph.nodes.filter((n) => n.type !== 'Component Children');
    const { graded } = findGrowingNodes(mutant);
    expect(graded.length).toBeLessThan(findGrowingNodes(written).graded.length);
  });

  it('the two size-mode constants have not drifted apart', () => {
    // `sb005` cannot import `sb006`'s copy — that module already imports ROUTER
    // from this one and the reverse edge is a cycle — so the value is held twice
    // and this is what stops the copies disagreeing.
    expect(STACKED).toEqual(STACKED_IN_A_COLUMN);
    // ...and the row twin is genuinely different, which is the whole trap:
    // `contentHeight` still assigns WIDTH.
    expect(IN_A_ROW.sizeMode).toBe('contentSize');
    expect(assignsWidth(STACKED.sizeMode)).toBe(true);
    expect(assignsWidth(IN_A_ROW.sizeMode)).toBe(false);
  });

  it('the growing nodes that remain are owed to a named task, exactly', () => {
    // An exclusion list cannot fail, so this grades the LIST: every owed row must
    // still be a real growing node. A fix that lands without deleting its row
    // reds here.
    const owedNames = ADMIN_LAYOUT_OWED.map((e) => `${e.component} | ${e.label}`);
    const bare = findGrowingNodes(written);
    expect(bare.growing).toEqual([]);
    for (const e of ADMIN_LAYOUT_OWED) expect(e.owner).toMatch(/SBR-\d+/);
    // Each owed node really does grow: drop it from the exemptions and it appears.
    const stillGrowing = owedNames.filter((n) => {
      const probe = findGrowingNodesWithout(n);
      return probe.some((g) => g.startsWith(n + ' —'));
    });
    expect(stillGrowing.sort()).toEqual(owedNames.sort());
  });

  /** The same walk with ONE name un-exempted, so an owed row can be shown to be real. */
  function findGrowingNodesWithout(name: string): string[] {
    return findGrowingNodes(
      written,
      ADMIN_LAYOUT_OWED.filter((e) => `${e.component} | ${e.label}` !== name)
    ).growing;
  }

  it('AC5: the shell is placed by every admin screen, and they do not all render the same', () => {
    const placements = SB005_COMPONENTS.filter((c) =>
      written[c.key]?.graph.nodes.some((n) => n.type === '/Admin/Shell')
    ).map((c) => c.key);
    // 🟢 **SBR-007 added the third placement, and it was a defect that there were
    // only two.** `/Pages/PageEditor` is an admin screen and did not wear the
    // shell, so the rail, "Theme and settings" and `Sign out` disappeared on the
    // one screen a client spends their time in and came back when they left.
    // 🟢 SBR-010 adds the fourth, and the FOURTH DISTINCT `active` — see below.
    expect(placements.sort()).toEqual(['Pages/Admin', 'Pages/Messages', 'Pages/PageEditor', 'Pages/ThemeEditor']);

    // 🔴 The half a shell fails silently: the MCP guidance's ghost is a component
    // that "renders identically however many times you place it". The interface
    // has to CARRY something, so the placements have to disagree.
    const active = placements.map(
      (k) => written[k].graph.nodes.find((n) => n.type === '/Admin/Shell')!.parameters?.active
    );
    // ⚠️ Two `'pages'` and not three: `/Pages/PageEditor` is a page's editor and
    // belongs under the Pages item, so the rail stays lit where the person came
    // from. `'messages'` is the third distinct value and `navStyle` reads it.
    expect(active).toEqual(['pages', 'messages', 'pages', 'theme']);

    // ⚠️ **The invariant is "the interface is load-bearing", NOT "every placement
    // is unique"** — and the difference only became visible at the third
    // placement. `Set(active).size === placements.length` was an accidentally
    // equivalent spelling while there were exactly two, and it is the WRONG rule:
    // the page editor sharing `pages` with the page list is CORRECT (editing a
    // page is still the Pages section, and the rail must not go dark), so the
    // stricter reading would red on a screen that renders exactly as intended.
    // What must stay true is that more than one rendering exists.
    expect(new Set(active).size).toBeGreaterThan(1);

    // ...and `active` is a real declared port, not a parameter nobody reads.
    const inputs = byLabel(written['Admin/Shell'], 'Component Inputs', 'Which item is current');
    expect(JSON.stringify(inputs.ports ?? [])).toContain('"active"');
  });

  it('AC2: the dialog is what creates a page, and the fields reach it', () => {
    const admin = written['Pages/Admin'];
    const popup = byType(admin, 'NavigationShowPopup')[0];
    expect(popup.parameters?.target).toBe('/Admin/NewPageDialog');

    const create = byType(admin, 'NewDbModelProperties')[0];
    const into = (port: string) =>
      admin.wires.find((w) => w.toId === create.id && w.toProperty === port && w.fromId === popup.id);

    // ⚠️ `closeResult-*` on Show Popup, `result-*` on Close Popup — two spellings,
    // one mechanism, and using the wrong one is a wire to a port that does not exist.
    expect(into('prop-title')?.fromProperty).toBe('closeResult-title');
    expect(into('prop-slug')?.fromProperty).toBe('closeResult-slug');
    expect(into('store')?.fromProperty).toBe('closeAction-create');

    // The two bare inputs above the list are gone — §2's third bullet.
    expect(byType(admin, 'net.noodl.controls.textinput')).toHaveLength(0);
  });

  it('AC2: the dialog declares both results and both close actions', () => {
    const close = byType(written['Admin/NewPageDialog'], 'NavigationClosePopup')[0];
    // These stringlists are what MINT the ports the screen wires to; a typo here
    // is a silently absent port on the other component.
    expect(String(close.parameters?.results).split(',').sort()).toEqual(['slug', 'title']);
    expect(String(close.parameters?.closeActions).split(',').sort()).toEqual(['cancel', 'create']);
    const wires = written['Admin/NewPageDialog'].wires;
    expect(wires.some((w) => w.toProperty === 'result-title')).toBe(true);
    expect(wires.some((w) => w.toProperty === 'result-slug')).toBe(true);
    expect(wires.some((w) => w.toProperty === 'closeAction-create')).toBe(true);
    expect(wires.some((w) => w.toProperty === 'closeAction-cancel')).toBe(true);
  });

  it('AC3: the three row actions moved behind one control, and the menu is unmounted', () => {
    const row = written['Admin/PageRow'];
    const menu = byLabel(row, 'Group', 'Row actions menu');
    // 🔴 `mounted`, not `visible`. SBR-004 drove that `visible: false` is
    // `visibility: hidden` and HOLDS ITS SPACE — 365px of empty page.
    expect(menu.parameters?.mounted).toBe(false);
    expect(menu.parameters?.visible).toBeUndefined();

    // The three actions are INSIDE the menu, not siblings of the row.
    const inMenu = (menu.children ?? []).map((id) => row.graph.nodes.find((n) => n.id === id)?.label);
    expect(inMenu.sort()).toEqual(['Duplicate', 'Publish', 'Unpublish']);

    // ...and each one closes the menu on its way out, so the row is readable again.
    //
    // 🔴 By LABEL, not `byType(row, 'States')[0]`. It was positional, and SBR-015
    // AC1 added a second `States` to this row (`callState`, which resets the
    // refusal message) — declared earlier in the node list, so it silently became
    // index 0 and this assertion read 0 closers off the wrong node. A positional
    // selector in a gate does not fail when the gate is wrong; it fails later,
    // looking exactly like the feature it grades has broken.
    const state = byLabel(row, 'States', 'Menu open or closed');
    const closers = row.wires.filter((w) => w.toId === state.id && w.toProperty === 'to-Closed');

    // 🔴 Six, not three: SBR-015 AC1. Each action closes the menu on `done` AND
    // on `failure` — before it, only `done` did, so a refusal left the menu open
    // for as long as it was watched (47 s, measured). "The menu stops being busy"
    // is half of AC1's person sentence and this is the wire that makes it true.
    expect(closers).toHaveLength(6);
    const byOutcome = closers.map((w) => w.fromProperty).sort();
    expect(byOutcome).toEqual(['done', 'done', 'done', 'failure', 'failure', 'failure']);
  });

  it('AC1: the status is a pill whose colour is derived, not authored per row', () => {
    const row = written['Admin/PageRow'];
    const status = byType(row, 'JavaScriptFunction').find((n) => String(n.parameters?.functionScript).includes('Published'))!;
    const pill = byLabel(row, 'Group', 'Status pill');
    const text = byLabel(row, 'Text', 'Draft or published');

    const wired = (toId: string, port: string) =>
      row.wires.find((w) => w.fromId === status.id && w.toId === toId && w.toProperty === port);
    expect(wired(pill.id, 'backgroundColor')?.fromProperty).toBe('out-pillBackground');
    expect(wired(text.id, 'color')?.fromProperty).toBe('out-pillColor');
    expect(wired(text.id, 'text')?.fromProperty).toBe('out-label');

    // SB-018 (3): both ports are ALSO authored, so a draft never flashes the
    // published colour before the function first publishes.
    expect(pill.parameters?.backgroundColor).toBe('var(--accent)');
    expect(text.parameters?.text).toBe('Draft');

    // 🔴 SBR-004 §9.2: an explicit `true` survives the NDA-017 migration, an
    // absent key does not — and this node's control signal is exactly what that
    // migration keys on.
    expect(status.parameters?.['runOnChange-in-published']).toBe(true);
  });

  it('§4: the refresh wire still names the row output it is derived from', () => {
    // The trap this task was warned about: the wire is name-derived from the item
    // component's port, so renaming `Changed` orphans it silently.
    const outputs = byType(written['Admin/PageRow'], 'Component Outputs')[0];
    expect(JSON.stringify(outputs.ports ?? [])).toContain('"Changed"');
    const admin = written['Pages/Admin'];
    const list = byType(admin, 'For Each')[0];
    expect(
      admin.wires.some((w) => w.fromId === list.id && w.fromProperty === 'itemOutputSignal-Changed')
    ).toBe(true);
  });

  it('the theme editor is reachable from every admin screen, not one button', () => {
    // What SBR-006 §2 says is wrong today: "the theme editor is reachable only by
    // a button at the bottom of the list".
    const admin = written['Pages/Admin'];
    expect(byType(admin, 'RouterNavigate').map((n) => n.parameters?.target)).not.toContain('/Pages/ThemeEditor');
    const shell = written['Admin/Shell'];
    const targets = byType(shell, 'RouterNavigate').map((n) => n.parameters?.target);
    // `/Pages/SignIn` is SBR-017's: the rail can end a session, so it must have
    // somewhere to put the person it just signed out.
    // `/Pages/Messages` is SBR-010's, and it closes the same shape SBR-006 named
    // for the theme editor: the rail item existed and led nowhere.
    expect(targets.sort()).toEqual([
      '/Pages/Admin',
      '/Pages/Messages',
      '/Pages/SignIn',
      '/Pages/Site',
      '/Pages/ThemeEditor'
    ]);
  });

  it('MUTANT: rendering the cloud function error reddens', () => {
    const mutant = clone(written['Pages/Setup']);
    const claim = mutant.graph.nodes.find((n) => n.type === 'CloudFunction2')!;
    const refusal = mutant.graph.nodes.find((n) => n.parameters?.text === CLAIM_REFUSAL_TEXT)!;
    mutant.wires.push({ fromId: claim.id, fromProperty: 'error', toId: refusal.id, toProperty: 'text' });
    expect(() => assertSingleMessagedRefusal(mutant)).toThrow();
  });
});
