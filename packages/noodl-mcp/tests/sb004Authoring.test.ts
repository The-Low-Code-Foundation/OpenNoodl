/**
 * SB-004 — the publish flow, authored through the real MCP surface.
 *
 * This is the phase's dogfood. SB-001 made cloud components authorable and
 * SB-002 taught the idiom, but s1 closed leaving one debt in those words: *the
 * plan door has never driven a cloud target end to end*. Both doors are
 * exercised here — `create_component` and `create_plan`/`stage`/`apply` — on a
 * real server (`helpers.ts` → `createServer` from `src`), so a rejection here is
 * a rejection an agent would get.
 *
 * The shapes, per SB-004 §5 — all five, endpoints and the helpers they compose:
 *   site/SetSectionAccess  — the Run Tasks worker: ACL rules for ONE section
 *   site/CopySectionToPage — the Run Tasks worker: clone ONE section onto a page
 *   site/ContactRecipient  — the Settings idiom: SiteSettings + Secret → an address
 *   publishPage            — Request → Query sections → build items → Run Tasks
 *                            → Update the Page → Response
 *   duplicatePage          — Request → read the page → Create the copy → Query its
 *                            sections → Run Tasks → Response
 *   submitContactForm      — Request (no auth) → ContactRecipient → Create Record
 *                            → Send Email → Response
 *
 * ⚠️ Assertions go to the registry key and the component file's `path`, never
 * through `store.resolve` — SB-001's trap.
 *
 * ⚠️ And the standing limit, which the door itself states: every run returns
 * `dynamic-port-skipped` over exactly the parameters carrying the security model
 * (`collectionName`, `acl-*`, `ptype-*`/`preq-*`), because those ports come from
 * the class schema and the catalog cannot see them. Green here means the graph is
 * well-formed. It is NOT evidence that the publication invariant holds — only
 * SB-004 §7's real-backend run, with `devOpen: false`, can be that.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';

/**
 * The seven components' node and wire lists now live beside this file, because
 * SB-004 §7's real-backend run authors the SAME ones through the same door and
 * then deploys what the door wrote (§7 acceptance 8: the run must drive this
 * task's output, not a twin). Two copies would agree only until the first edit
 * that reached one of them.
 */
import {
  CLAIM_NODES,
  CLAIM_WIRES,
  CONTACT_NODES,
  CONTACT_WIRES,
  COPY_WORKER_NODES,
  COPY_WORKER_WIRES,
  DUPLICATE_NODES,
  DUPLICATE_WIRES,
  ENDPOINT_NODES,
  ENDPOINT_WIRES,
  RECIPIENT_NODES,
  RECIPIENT_TYPE,
  RECIPIENT_WIRES,
  WORKER_NODES,
  WORKER_WIRES
} from './sb004Components';

interface Diag {
  code: string;
  severity: string;
  message: string;
}

interface CreateResponse {
  created: string;
  legacyName: string;
  type: string;
  validation: { summary: { errors: number; warnings: number; infos: number }; diagnostics?: Diag[] };
}

interface ErrorResponse {
  error: { code: string; message: string; details?: { readable?: string[]; newErrors?: Diag[] } };
}

type Either = CreateResponse & ErrorResponse;

interface PlanOp {
  id: string;
  target: string;
}
interface CreatePlanResponse {
  planId: string;
  operations: PlanOp[];
}
interface StageResponse {
  validation?: { diagnostics?: Diag[]; summary?: Record<string, number> };
  error?: ErrorResponse['error'];
}

interface RegistryFile {
  components: Record<string, { type?: string; path?: string }>;
}

const readJson = <T>(dir: string, rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8')) as T;

/** Print whatever the door said, so a rejection is evidence rather than a red. */
function say(label: string, res: { isError: boolean; data: Either & StageResponse }): void {
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

interface GraphFile {
  nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>;
}
interface WireFile {
  connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
}

/**
 * The two defects the authoring door structurally CANNOT catch, asserted here
 * instead — on what was written to disk, not on what was sent.
 *
 * Both are legal graphs. An absent `visualFilter` means "every record in the
 * class", and a Response parameter with no wire means "omit it from the body".
 * Neither is an error to a validator; both were in the first authored
 * publishPage; and the first one would have flipped the access rules on every
 * section in the site. So they are pinned by assertion, and a future author who
 * drops either gets a red rather than a silent regression.
 */
function expectQueryFilteredOn(dir: string, key: string, nodeId: string, property: string): void {
  const graph = readJson<GraphFile>(dir, `components/${key}/nodes.json`);
  const node = graph.nodes.find((n) => n.id === nodeId);
  expect(node?.type).toBe('DbCollection2');

  const filter = node?.parameters?.visualFilter as { rules?: Array<{ property?: string; input?: string }> };
  const rule = (filter?.rules ?? []).find((r) => r.property === property);
  expect(rule).toBeDefined();

  // The rule alone is not the filter: `collectFilterParameters` mints `qp-<input>`
  // from the rule's `input`, and an unsupplied value is DROPPED rather than
  // failing (`saved.ts` — "a rule whose value is undefined is removed"). A rule
  // with no wire to its port narrows nothing and says nothing.
  const wires = readJson<WireFile>(dir, `components/${key}/connections.json`);
  const port = `qp-${rule?.input}`;
  expect(wires.connections.some((c) => c.toId === nodeId && c.toProperty === port)).toBe(true);

  // 🔴 And the second road to the same defect, found by §7's real-backend run
  // (`nodegx-backend/tests/sb004-publication-invariant.test.ts`). A filter that
  // is present on disk is still discarded at run time if the query is triggered
  // before the value reaches its port — and a Query Records node fetches ONCE
  // BY ITSELF, when its `collectionName` and `visualFilter` parameters are
  // applied at graph-build time, because both `runOnChange` boxes are ticked
  // unless something says otherwise. That first fetch has no `qp-` value, so it
  // returns every row in the class, fires `fetched`, and the rest of the graph
  // acts on it. Measured: publishing one page flipped the access rules on every
  // Section in the site, with the correct filter sitting in this very file.
  //
  // So the fix is three properties, and all three are pinned here: the boxes
  // OFF, and no `Do` wire — which leaves the filter parameter's own arrival as
  // the one and only trigger, an ordering that cannot invert.
  expect(node?.parameters?.['runOnChange-collectionName']).toBe(false);
  expect(node?.parameters?.['runOnChange-querySettings']).toBe(false);
  expect(wires.connections.filter((c) => c.toId === nodeId && c.toProperty === 'storageFetch')).toEqual([]);
}

/** Every parameter a Response declares has something wired to its `pm-` input. */
function expectEveryResponseParameterWired(dir: string, key: string): void {
  const graph = readJson<GraphFile>(dir, `components/${key}/nodes.json`);
  const wires = readJson<WireFile>(dir, `components/${key}/connections.json`);
  const responses = graph.nodes.filter((n) => n.type === 'noodl.cloud.response');
  expect(responses.length).toBeGreaterThan(0);

  for (const node of responses) {
    // A stringlist is one comma-separated STRING (§6a finding 1), so this is a
    // split, not an array read.
    const declared = String(node.parameters?.params ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // A `status: 'failure'` Response answers with `errorMessage` and legitimately
    // declares no parameters. A success Response that declares none is the F5
    // defect — a 200 with an empty body — so only that case is required to
    // carry something.
    if (node.parameters?.status !== 'failure') expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      const wired = wires.connections.some((c) => c.toId === node.id && c.toProperty === `pm-${name}`);
      expect(`${name}:${wired}`).toBe(`${name}:true`);
    }
  }
}

/** Both components landed under the editor-canonical cloud key, typed cloud. */
function expectLandedAsCloud(dir: string, key: string): void {
  const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
  expect(registry.components[key]?.type).toBe('cloud');
  expect(registry.components[`#${key}`]).toBeUndefined();
  const component = readJson<{ path: string; type: string }>(dir, `components/${key}/component.json`);
  expect(component.path).toBe(`/#${key}`);
  expect(component.type).toBe('cloud');
}

describe('SB-004: the publish flow through create_component', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("authors the Run Tasks worker: one section's access rules", async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/SetSectionAccess',
      nodes: WORKER_NODES,
      connections: WORKER_WIRES
    });
    say('worker: site/SetSectionAccess', res);
    expect(res.isError).toBe(false);
    expect(res.data.legacyName).toBe('/#__cloud__/site/SetSectionAccess');
    expectLandedAsCloud(dir, '__cloud__/site/SetSectionAccess');
  });

  it('authors the endpoint: publishPage', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/publishPage',
      nodes: ENDPOINT_NODES,
      connections: ENDPOINT_WIRES
    });
    say('endpoint: publishPage', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/publishPage');
  });

  it('publishes only THIS page\'s sections, and answers with a body', () => {
    expectQueryFilteredOn(dir, '__cloud__/publishPage', 'sections', 'pageId');
    expectEveryResponseParameterWired(dir, '__cloud__/publishPage');
  });
});

describe('SB-004: duplicate and contact, through create_component', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * The control, and it has to run FIRST — before `site/ContactRecipient` is
   * authored — because what it measures is an absence.
   *
   * SB-009 says a component named through a `component`-typed PARAMETER
   * (`RunTasks.taskTemplate`) is accepted `0/0/0` even when nothing of that name
   * exists. This is the other half of that sentence: the same helper composed as
   * an INSTANCE, where the name is the node's `type`, IS resolved. Without this
   * arm, SB-009's clean result would be indistinguishable from a gate that
   * simply never runs on this fixture.
   */
  it('refuses an instance of a helper that does not exist yet (the control SB-009 needs)', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/submitContactForm',
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('CONTROL: submitContactForm before its helper exists', res);
    expect(res.isError).toBe(true);
    // Named by CODE, not by "it errored": the arm is worthless if the rejection
    // could be a bad port or a malformed script. `unresolved-component-ref` is
    // precisely the check SB-009 found has no counterpart on the parameter side.
    const refused = res.data.error?.details?.newErrors ?? [];
    expect(refused.map((d) => d.code)).toContain('unresolved-component-ref');
    expect(refused.find((d) => d.code === 'unresolved-component-ref')?.message).toContain(RECIPIENT_TYPE);
    // And nothing was written: a refused create leaves no component behind.
    expect(fs.existsSync(path.join(dir, 'components/__cloud__/submitContactForm'))).toBe(false);
  });

  it('authors the duplicate worker: one section, cloned onto a page', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/CopySectionToPage',
      nodes: COPY_WORKER_NODES,
      connections: COPY_WORKER_WIRES
    });
    say('worker: site/CopySectionToPage', res);
    expect(res.isError).toBe(false);
    expect(res.data.legacyName).toBe('/#__cloud__/site/CopySectionToPage');
    expectLandedAsCloud(dir, '__cloud__/site/CopySectionToPage');
  });

  it('authors the endpoint: duplicatePage', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/duplicatePage',
      nodes: DUPLICATE_NODES,
      connections: DUPLICATE_WIRES
    });
    say('endpoint: duplicatePage', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/duplicatePage');
  });

  it('authors the settings helper: site/ContactRecipient', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/ContactRecipient',
      nodes: RECIPIENT_NODES,
      connections: RECIPIENT_WIRES
    });
    say('helper: site/ContactRecipient', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/site/ContactRecipient');
  });

  it('authors the endpoint: submitContactForm, now that the helper exists', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/submitContactForm',
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('endpoint: submitContactForm', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/submitContactForm');
  });

  /**
   * The three endpoints are functions; the three helpers are not. SB-003 made
   * that a runtime boundary (a helper 404s as a function name); here it is the
   * authored shape the boundary reads — a Request node, or none.
   */
  it('gives every endpoint a Request node and every helper none', () => {
    // The graph lives in `nodes.json` beside `component.json`, not inside it —
    // read from disk rather than from the create response, so this says what a
    // deploy would find.
    const hasRequest = (key: string): boolean => {
      const graph = readJson<{ nodes: Array<{ type: string }> }>(dir, `components/${key}/nodes.json`);
      return graph.nodes.some((n) => n.type === 'noodl.cloud.request');
    };
    expect(hasRequest('__cloud__/duplicatePage')).toBe(true);
    expect(hasRequest('__cloud__/submitContactForm')).toBe(true);
    expect(hasRequest('__cloud__/site/CopySectionToPage')).toBe(false);
    expect(hasRequest('__cloud__/site/ContactRecipient')).toBe(false);
  });

  it('authors claimSite: the function that mints the first admin (F7)', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/claimSite',
      nodes: CLAIM_NODES,
      connections: CLAIM_WIRES
    });
    say('endpoint: claimSite', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/claimSite');
    expectEveryResponseParameterWired(dir, '__cloud__/claimSite');
  });

  /**
   * The properties that make `claimSite` safe are all structural, so they can
   * be asserted here rather than only in §7's run — and they are the ones a
   * later edit would quietly break.
   */
  it('gates claimSite on BOTH conditions, fails closed, and grants only the caller', () => {
    const graph = readJson<GraphFile>(dir, 'components/__cloud__/claimSite/nodes.json');
    const wires = readJson<WireFile>(dir, 'components/__cloud__/claimSite/connections.json');

    // 🔴 Resolve by TYPE, never by the id that was sent. The door makes node ids
    // unique across the PROJECT, so `settings` here was written as `settings-2`
    // — `site/ContactRecipient` already had a node by that name. An authored id
    // is a request, not a handle (§6 F9). Every type below appears exactly once
    // in this component, and `single` asserts that rather than assuming it.
    const single = (type: string) => {
      const found = graph.nodes.filter((n) => n.type === type);
      expect(`${type}:${found.length}`).toBe(`${type}:1`);
      return found[0];
    };
    const responses = graph.nodes.filter((n) => n.type === 'noodl.cloud.response');
    // SB-014 put a second `NewDbModelProperties` in this graph — the `Theme`
    // singleton — so this one is resolved by the collection it writes rather
    // than by being the only creator, which it no longer is.
    const creators = graph.nodes.filter((n) => n.type === 'NewDbModelProperties');
    const creatorFor = (collection: string) => {
      const found = creators.filter((n) => n.parameters?.collectionName === collection);
      expect(`${collection} creators:${found.length}`).toBe(`${collection} creators:1`);
      return found[0];
    };
    const ids = {
      req: single('noodl.cloud.request').id,
      secret: single('noodl.cloud.secret').id,
      settings: single('DbCollection2').id,
      gate: single('JavaScriptFunction').id,
      grant: single('noodl.cloud.addusertorole').id,
      mark: creatorFor('SiteSettings').id,
      theme: creatorFor('Theme').id,
      deny: responses.find((n) => n.parameters?.status === 'failure')?.id
    };
    const byId = (id?: string) => graph.nodes.find((n) => n.id === id);
    const node = (name: keyof typeof ids) => byId(ids[name]);
    const wired = (to: keyof typeof ids, toProperty: string) =>
      wires.connections.find((c) => c.toId === ids[to] && c.toProperty === toProperty);
    const from = (c?: { fromId: string }) => (c ? (Object.keys(ids) as Array<keyof typeof ids>).find((k) => ids[k] === c.fromId) : undefined);

    // 1. Both gate conditions reach the decision.
    expect(from(wired('gate', 'in-expected'))).toBe('secret');
    expect(from(wired('gate', 'in-unclaimed'))).toBe('settings');

    // 2. Fail closed: the secret is fetched FIRST, and its failure answers a
    //    refusal rather than falling through to the grant.
    expect(from(wired('secret', 'fetch'))).toBe('req');
    expect(from(wired('settings', 'storageFetch'))).toBe('secret');

    // 3. `isEmpty` is true before the first query runs, so the gate must be
    //    triggered by `fetched` — never by anything that could arrive earlier.
    expect(wired('gate', 'run')?.fromProperty).toBe('fetched');

    // 3b. 🔴 SB-013, and (3) alone is not it. `Run` is purely ADDITIVE
    //     (`run-on-value-change.ts` §1) — wiring it unticks nothing — so a gate
    //     with its boxes on ALSO ran as each input arrived, and the run that
    //     arrived with the secret decided on the pre-fetch `isEmpty`. Both
    //     barriers are asserted here because both are one edit from gone, and
    //     `sb004-publication-invariant.test.ts` grades each against an outsider
    //     holding the admin role.
    const gate = node('gate');
    for (const port of ['in-expected', 'in-supplied', 'in-unclaimed', 'in-rows']) {
      expect(`${port} auto-run:${String(gate?.parameters?.[`runOnChange-${port}`])}`).toBe(`${port} auto-run:false`);
    }
    // …and the readiness the script decides on: `items` is the only output of a
    // Query Records node that separates "matched nothing" from "has not run".
    expect(from(wired('gate', 'in-rows'))).toBe('settings');
    expect(wired('gate', 'in-rows')?.fromProperty).toBe('items');
    expect(gate?.parameters?.functionScript).toContain('if (Inputs.rows === undefined) return;');
    // The query fetches once, on the wire after the secret, and not at load.
    for (const port of ['collectionName', 'querySettings']) {
      expect(`${port} auto-fetch:${String(node('settings')?.parameters?.[`runOnChange-${port}`])}`).toBe(
        `${port} auto-fetch:false`
      );
    }

    // 3c. SB-014 — the site's OTHER singleton, minted in the same place. The
    //     theme editor saves by `firstItemId`, so with no row its Save wrote
    //     nowhere and said nothing.
    expect(from(wired('theme', 'store'))).toBe('mark');
    expect(node('theme')?.parameters?.['prop-tokens']).toEqual({
      colorPrimary: '',
      colorBackground: '',
      colorText: '',
      fontFamily: ''
    });
    // The public site reads the theme with no session, so the row is born
    // world-readable — the same rule `SiteSettings` carries.
    expect(node('theme')?.parameters?.['acl-world-read']).toBe(true);
    expect(node('theme')?.parameters?.['acl-world-write']).toBe(false);
    // ⚠️ And its failure answers the SUCCESS response, not the refusal: by then
    // the role is granted and the site is claimed, and "This site cannot be
    // claimed" would send a real admin away with no second claim possible.
    const themeFailure = wires.connections.find((c) => c.fromId === ids.theme && c.fromProperty === 'failure');
    expect(themeFailure?.toId).not.toBe(ids.deny);

    // 4. The grantee is the resolved session, NOT a request parameter. If this
    //    ever reads `pm-…`, anybody may name anybody.
    expect(wired('grant', 'userId')?.fromProperty).toBe('userId');
    expect(node('grant')?.parameters?.role).toBe('admin');
    expect(node('grant')?.parameters?.createRole).toBe(true);

    // 5. Only the gate's OK branch can reach the grant.
    const intoGrant = wires.connections.filter((c) => c.toId === ids.grant && c.toProperty === 'add');
    expect(intoGrant.map((c) => `${from(c)}.${c.fromProperty}`)).toEqual(['gate.out-ok']);

    // 6. One indistinguishable refusal: a caller must not be able to tell
    //    "wrong token" from "already claimed". Every failing node reaches it.
    expect(node('deny')?.parameters?.status).toBe('failure');
    const denials = wires.connections.filter((c) => c.toId === ids.deny && c.toProperty === 'send');
    expect(denials.map(from).sort()).toEqual(['gate', 'grant', 'mark', 'secret', 'settings']);
  });

  it('copies only the source page\'s sections, and both endpoints answer with a body', () => {
    expectQueryFilteredOn(dir, '__cloud__/duplicatePage', 'sections', 'pageId');
    expectEveryResponseParameterWired(dir, '__cloud__/duplicatePage');
    expectEveryResponseParameterWired(dir, '__cloud__/submitContactForm');
  });
});

/**
 * s1's named debt: the plan door had never driven a cloud target end to end.
 * Two cloud operations in ONE plan — the worker and the endpoint that composes
 * it — staged and applied.
 */
describe('SB-004: the same flow through the plan door', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('plans, stages and applies two cloud components', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Publishing: flip a page and its sections between draft and public',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/site/SetSectionAccess',
          intent: 'Run Tasks worker: write one section\'s access rules.'
        },
        {
          kind: 'create',
          target: '#__cloud__/publishPage',
          intent: 'The endpoint: publish or unpublish a page and all its sections.'
        }
      ]
    });
    say('create_plan (two cloud targets)', plan as never);
    expect(plan.isError).toBe(false);

    const [workerOp, endpointOp] = plan.data.operations;

    const stagedWorker = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: workerOp.id,
      nodes: WORKER_NODES,
      connections: WORKER_WIRES
    });
    say('stage worker', stagedWorker);
    expect(stagedWorker.isError).toBe(false);

    const stagedEndpoint = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: endpointOp.id,
      nodes: ENDPOINT_NODES,
      connections: ENDPOINT_WIRES
    });
    say('stage endpoint', stagedEndpoint);
    expect(stagedEndpoint.isError).toBe(false);

    const applied = await call<Either>(session, 'apply_plan', { plan_id: plan.data.planId });
    say('apply_plan', applied);
    expect(applied.isError).toBe(false);

    // The whole point: through THIS door too, both land as cloud components
    // under the editor's spelling — not in the browser bundle.
    expectLandedAsCloud(dir, '__cloud__/site/SetSectionAccess');
    expectLandedAsCloud(dir, '__cloud__/publishPage');
  });

  /**
   * The question the publishPage pair cannot answer, and SB-005/006 will need
   * the answer to.
   *
   * publishPage names its worker through a `taskTemplate` PARAMETER, which
   * SB-009 measured as unchecked — so that plan would have applied whether or
   * not the worker existed, and it says nothing about ordering. Here the
   * endpoint names its helper as a node TYPE, which the control above proves IS
   * resolved. So this asks something real: staged in one plan, does the
   * endpoint's stage see a SIBLING that has not been applied yet?
   */
  /**
   * The known-firing arm for the test below, and it has to come first.
   *
   * Without it, "the endpoint staged cleanly beside its unapplied sibling"
   * cannot be told apart from "`stage_plan_operation` never resolves component
   * references at all" — the same green, opposite meanings. Same nodes, same
   * wires, one variable changed: whether the helper is in the plan.
   */
  it('CONTROL: staging that endpoint with NO sibling helper is refused', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Contact: the endpoint alone, with nothing to resolve its helper',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/submitContactForm',
          intent: 'The endpoint on its own — the helper is deliberately absent.'
        }
      ]
    });
    expect(plan.isError).toBe(false);

    const staged = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('CONTROL: stage endpoint with no sibling helper', staged);
    expect(staged.isError).toBe(true);
    // ⚠️ The two doors report a refusal differently, and an agent parsing them
    // has to know: `create_component` returns structured `details.newErrors`
    // (asserted by code above), while `stage_plan_operation` carries only
    // `details.readable` prose (`planTools.ts:795-801`). The code is in the
    // line, so that is what this reads — but it is read, not merely counted.
    const readable = (staged.data.error?.details?.readable ?? []).join('\n');
    expect(readable).toContain('unresolved-component-ref');
    expect(readable).toContain(RECIPIENT_TYPE);

    await call(session, 'discard_plan', { plan_id: plan.data.planId });
  });

  it('holds a helper and the endpoint that instantiates it in one plan', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Contact: take a message from the public site and mail it on',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/site/ContactRecipient',
          intent: 'Settings helper: where contact mail goes.'
        },
        {
          kind: 'create',
          target: '#__cloud__/submitContactForm',
          intent: 'Public endpoint: record an enquiry and mail it to the site owner.'
        }
      ]
    });
    say('create_plan (helper + its caller)', plan as never);
    expect(plan.isError).toBe(false);

    const [helperOp, endpointOp] = plan.data.operations;

    const stagedHelper = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: helperOp.id,
      nodes: RECIPIENT_NODES,
      connections: RECIPIENT_WIRES
    });
    say('stage helper', stagedHelper);
    expect(stagedHelper.isError).toBe(false);

    // The load-bearing call. Its helper exists only as an unapplied sibling.
    const stagedEndpoint = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: endpointOp.id,
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('stage endpoint naming an UNAPPLIED sibling', stagedEndpoint);
    expect(stagedEndpoint.isError).toBe(false);

    const applied = await call<Either>(session, 'apply_plan', { plan_id: plan.data.planId });
    say('apply_plan (helper + its caller)', applied);
    expect(applied.isError).toBe(false);

    expectLandedAsCloud(dir, '__cloud__/site/ContactRecipient');
    expectLandedAsCloud(dir, '__cloud__/submitContactForm');
    expectEveryResponseParameterWired(dir, '__cloud__/submitContactForm');
  });
});
