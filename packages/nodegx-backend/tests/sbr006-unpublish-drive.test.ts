/**
 * SBR-006 AC3 — **`Unpublish`, clicked**, on the shipped admin shell against an enforcing backend.
 *
 * AC3 reads: *"Publish/unpublish/duplicate work from the overflow menu; the row's pill updates."*
 * Two of the three were driven at s22 (SBR-006 §5.13) on `backend_mterfnli74qwv` — publish
 * `success` in 25 ms, duplicate in 23 ms — and the criterion was deliberately NOT ticked, because
 * `Unpublish` had never been clicked. It sits in the same menu and calls the same endpoint with one
 * parameter different (`Admin/PageRow`'s `unpublish` node is `publishPage` with
 * `in-publish: false`), so the cheap thing to do would have been to reason about it. This file
 * clicks it instead.
 *
 * ## Why a same-endpoint sibling still needed driving
 *
 * 🔴 **The two buttons do not share a wire, and the shape of the failure they can have is the one
 * that reads as success.** `publishPage` answers 200 for both directions; `in-publish: false` is a
 * *constant on the node*, not a value on a wire, so a `CloudFunction2` whose constant never reached
 * the request would call the same endpoint and publish the page again — 200, `success`, and the
 * pill would say the opposite of what was asked for. Nothing that had already been driven could
 * distinguish that from a working unpublish.
 *
 * ## 🔴 The oracle, and why the order of the acts IS the measurement
 *
 * The stored row starts `published: false`. So a drive that clicked `Unpublish` on a fresh draft
 * and then read `published: false` would pass **on a button wired to nothing** — the reading it
 * wanted is the state it started in. That is why this file **publishes first, through the same
 * menu**, and asserts `published === true` immediately before the unpublish click. The final
 * `false` means something only because a known-firing signal put a `true` there first.
 *
 * Three oracles are read, because they fail differently:
 *
 *  1. **The stored row** — `GET /classes/Page/<id>` as the owner, over the id this file created.
 *     Never the response, never the screen (s28: 47 specs read the row the response named while
 *     three junk rows sat beside it for ten sessions).
 *  2. **The world's read rule** — `publishPage` wires `prep.out-isPublic` to the page's
 *     `acl-world-read` as well as to `prop-published`, so an unpublish that moved the flag and left
 *     the ACL would leave the page on the public site while the pill said `Draft`. Read
 *     **anonymously**, as a person with no session: 200 while published, refused after.
 *  3. **The pill** — AC3's second clause is *"the row's pill updates"*, which is a claim about the
 *     screen and is read off the screen.
 *
 * ## The mutant
 *
 * 🔴 Per s32's rule, the mutant **restores the defect** rather than repairing anything: one edit,
 * `unpublishButton.onClick → unpublish.call` dropped from `Admin/PageRow`, counted `removed:1`.
 * The same click on the same menu then leaves the row published. Without it, "the row is a draft
 * after I clicked" and "the row is a draft because I clicked" are the same reading — and the menu
 * is checked to still OFFER the button in that arm, so the arm is about the wire and not about a
 * button that went missing.
 *
 * ⚠️ `dropWire` here matches on the node ids as well as the properties. The AC2 drive's version
 * matches properties only, and `(onClick, call)` names **three** wires in this component —
 * publish, unpublish and duplicate. Its `removed:1` would have caught that, loudly; this one
 * cannot reach it.
 *
 * ## The instrument
 *
 * The phase's sixth instrument (`ac2-page-editor-drag-drive.test.ts` §34–35), unchanged: the whole
 * template authored through the real MCP server, deployed to a real `BackendService` with the
 * shipped `site-builder.security.json` and enforcement ON, and driven in headless Chrome through
 * the template's own sign-in form. The clicks go through `clickButtonInRow`, which hit-tests with
 * `elementFromPoint` before pressing — a click that lands on a ghost reports success and does
 * nothing.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents, WorkflowBundle } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { clickButtonInRow, currentSession, fill, clickButton } from './helpers/members-drive';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  DRAFT_ACL,
  makeSiteDataDir,
  RenderedPage,
  SITE_SECURITY,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(1800000);

const SETUP_TOKEN = 'sbr006-unpub-token-3c7e91';
const OWNER_EMAIL = 'owner@sbr006unpub.test';
const OWNER_PASSWORD = 'drive-pass-unpub';

/** The page the shipped arm acts on, and the one the mutant arm acts on. Two, so neither disturbs the other. */
const SHIPPED_TITLE = 'The Unpublished Page';
const SHIPPED_SLUG = 'unpub-drive';
const MUTANT_TITLE = 'The Mutant Page';
const MUTANT_SLUG = 'unpub-mutant';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Session {
  id: string;
  token: string;
}
interface Row {
  objectId: string;
  [field: string]: unknown;
}

/** What the store says about one page, at one moment. */
interface Stored {
  /** `published` as the row has it — `undefined` when the read was refused, which is not `false`. */
  published: unknown;
  /** Whether an ANONYMOUS reader could fetch the row at all, and what they got. */
  worldStatus: number;
  /** The read's own status as the owner — a refused owner read returns no field, and that is not a draft. */
  ownerStatus: number;
}

const NO_STORED: Stored = { published: 'ARM NEVER RAN', worldStatus: -1, ownerStatus: -1 };

/**
 * Every row on `/admin/pages`, with the text a person reads.
 *
 * The rows are found from their own `Edit` buttons and walked up to the nearest ancestor holding
 * exactly one of them — the same boundary `clickButtonInRow` uses, so the row this reads and the
 * row it clicks in cannot be two different elements. Walking up until the title appears would
 * reach the list, whose text names every page.
 */
const READ_ROWS = `(function () {
  var edits = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
    return (b.innerText || '').trim() === 'Edit';
  });
  var rows = [];
  edits.forEach(function (b) {
    for (var el = b.parentElement; el; el = el.parentElement) {
      var mine = Array.prototype.filter.call(el.querySelectorAll('button'), function (x) {
        return (x.innerText || '').trim() === 'Edit';
      });
      if (mine.length !== 1) continue;
      if (String(el.innerText || '').indexOf('Edit') < 0) continue;
      rows.push({
        text: String(el.innerText || '').replace(/\\s+/g, ' ').trim(),
        buttons: Array.prototype.map.call(el.querySelectorAll('button'), function (x) {
          return (x.innerText || '').trim();
        })
      });
      return;
    }
  });
  return JSON.stringify({
    rowCount: rows.length,
    rows: rows,
    bodyText: String(document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 400)
  });
})()`;

interface RowRead {
  text: string;
  buttons: string[];
}
interface Rows {
  rowCount: number;
  rows: RowRead[];
  bodyText: string;
}
const NO_ROWS: Rows = { rowCount: -1, rows: [], bodyText: 'ARM NEVER RAN' };

/** A copy of the authored project, for an arm to vary by exactly one edit. */
function copyProject(projectDir: string, label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sbr006unpub-${label}-`));
  fs.cpSync(projectDir, dir, { recursive: true });
  return dir;
}

/**
 * Remove exactly one connection, named by BOTH ends, and count the removal.
 *
 * 🔴 Matching on the properties alone would name three wires here. See the header.
 */
function dropWireById(
  dir: string,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  label: string
): void {
  const file = path.join(dir, 'components', componentPath, 'connections.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
  };
  const before = doc.connections.length;
  doc.connections = doc.connections.filter(
    (c) => !(c.fromId === fromId && c.fromProperty === fromProperty && c.toId === toId && c.toProperty === toProperty)
  );
  expect(`${label} removed:${before - doc.connections.length}`).toBe(`${label} removed:1`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

describe('SBR-006 AC3 — Unpublish, from the overflow menu, on the shipped admin shell', () => {
  let projectDir = '';
  let mutantDir = '';
  let dataDir = '';
  let bundle: WorkflowBundle;
  let service: BackendService | undefined;
  let base = '';
  let backendPort = 0;

  const client = httpClient(() => base);
  const asUser = (s: Session) => ({ 'x-parse-session-token': s.token });
  let owner: Session;
  let shippedPageId = '';
  let mutantPageId = '';

  // ── Everything the specs read, captured once in beforeAll ──────────────────
  let securityEnforced = false;
  let browserSession: string | null = null;

  /** The shipped arm, in order: on arrival, after Publish, after Unpublish. */
  let storedSeeded: Stored = NO_STORED;
  let storedAfterPublish: Stored = NO_STORED;
  let storedAfterUnpublish: Stored = NO_STORED;
  let rowsClosed: Rows = NO_ROWS;
  let rowsMenuOpen: Rows = NO_ROWS;
  let rowsAfterPublish: Rows = NO_ROWS;
  let rowsAfterUnpublish: Rows = NO_ROWS;
  /** How many `Page` rows exist at the end — an "unpublish" that deleted or replaced the row is not one. */
  let pageCountAtEnd = -1;

  /** The mutant arm: the same two acts with the unpublish wire gone. */
  let mutantAfterPublish: Stored = NO_STORED;
  let mutantAfterUnpublishClick: Stored = NO_STORED;
  let mutantMenuButtons: string[] = ['ARM NEVER RAN'];

  /** What the backend recorded for the two `publishPage` runs on the shipped arm. */
  let publishRuns: Array<{ status: string; steps: Array<{ nodeType: string; status: string }> }> = [];

  const readStored = async (pageId: string): Promise<Stored> => {
    const asOwner = await client.get<Row>(`/classes/Page/${pageId}`, asUser(owner));
    // 🔴 No session token at all — this is the public site's reader, not a logged-out admin.
    const asWorld = await client.get<Row>(`/classes/Page/${pageId}`);
    return {
      published: asOwner.status === 200 ? asOwner.json.published : undefined,
      worldStatus: asWorld.status,
      ownerStatus: asOwner.status
    };
  };

  const readRows = async (page: RenderedPage): Promise<Rows> =>
    JSON.parse(String(await page.evaluate(READ_ROWS))) as Rows;

  /** Sign the browser in through the template's own form, and report the session it holds. */
  async function signInBrowser(page: RenderedPage): Promise<string | null> {
    await page.setViewport({ width: 1440, height: 1800 });
    await page.navigate('/admin/signin');
    await wait(2500);
    await fill(page, 'email', OWNER_EMAIL);
    await fill(page, 'password', OWNER_PASSWORD);
    await clickButton(page, 'Sign in');
    await wait(2500);
    return currentSession(page);
  }

  /** Load `/admin/pages` and wait for the list query to land rather than for a clock. */
  async function openList(page: RenderedPage, want: number): Promise<Rows> {
    await page.navigate('/admin/pages');
    let rows = await readRows(page);
    for (let i = 0; i < 24 && rows.rowCount < want; i++) {
      await wait(500);
      rows = await readRows(page);
    }
    return rows;
  }

  /**
   * Wait for the STORED row to reach `want`, bounded.
   *
   * 🔴 Bounded and then read anyway: if it never moves, the readings below are about a screen that
   * did nothing, which is a real outcome and the mutant arm's expected one.
   */
  async function settle(pageId: string, want: boolean): Promise<Stored> {
    let stored = await readStored(pageId);
    for (let i = 0; i < 24 && stored.published !== want; i++) {
      await wait(500);
      stored = await readStored(pageId);
    }
    return stored;
  }

  /** Open the row's overflow menu and click one of the three actions inside it. */
  async function actFromMenu(page: RenderedPage, title: string, action: string): Promise<Rows> {
    await clickButtonInRow(page, 'More', title);
    await wait(800);
    const opened = await readRows(page);
    await clickButtonInRow(page, action, title);
    await wait(1500);
    return opened;
  }

  beforeAll(async () => {
    projectDir = await authorSiteTemplate('sbr006unpub');
    bundle = bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    );

    dataDir = makeSiteDataDir(bundle, { SITE_SETUP_TOKEN: SETUP_TOKEN }, SITE_SECURITY, 'sbr006unpub');
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'sbr006unpub',
      backendName: 'SBR-006 unpublish drive'
    });
    const started = await service.start();
    base = started.listen.url;
    backendPort = started.listen.port;
    securityEnforced = started.security.enforced;

    bindProjectToBackend(projectDir, 'sbr006unpub', backendPort);

    // The owner becomes `role:admin` through the template's own door, exactly as SB-008 does.
    const signedUp = await client.post<{ objectId: string; sessionToken: string }>('/users', {
      username: OWNER_EMAIL,
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });
    expect(signedUp.status).toBe(201);
    owner = { id: signedUp.json.objectId, token: signedUp.json.sessionToken };
    const claimed = await client.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      asUser(owner)
    );
    expect(claimed.json.result?.claimed).toBe(true);

    /**
     * One page and one section, in the state a client leaves them after `New page` and one `Save`.
     *
     * 🔴 **`ACL: DRAFT_ACL` is load-bearing, and the first run of this file is why.** Without it
     * the seeded page came back **200 to an anonymous reader before anything was published** —
     * `canAccessRecord` reads an ABSENT ACL as public (`model.ts:701-718`), so a row created with
     * no rules is world-readable from the instant it exists. That reading FITS a product defect
     * perfectly, and it is not one: `/Pages/Admin`'s `create` node — the template's own `New page`
     * path — writes `ADMIN_ONLY_RULES`, so a page a person creates is born admin-only. What was
     * wrong was the SEED, which reached past the template's door with a raw `POST` and wrote a row
     * the template would never write.
     *
     * ⚠️ It matters beyond tidiness: the `worldStatus` oracle below is a **transition**, and a
     * page that was already public before the publish makes the whole sequence read
     * `200 → 200 → 404` instead of `404 → 200 → 404`. The unpublish half still discriminates, but
     * the publish half stops meaning anything, and a later reader would have no way to see that
     * from the assertion.
     */
    const seed = async (title: string, slug: string): Promise<string> => {
      const page = await client.post<Row>(
        '/classes/Page',
        { ACL: DRAFT_ACL, title, slug, published: false, showInNav: true, navOrder: 1 },
        asUser(owner)
      );
      expect(page.status).toBe(201);
      const section = await client.post<Row>(
        '/classes/Section',
        {
          ACL: DRAFT_ACL,
          kind: 'richText',
          order: 0,
          data: { body: 'A section, so the publish has something to publish.' },
          pageId: page.json.objectId
        },
        asUser(owner)
      );
      expect(section.status).toBe(201);
      return page.json.objectId;
    };

    shippedPageId = await seed(SHIPPED_TITLE, SHIPPED_SLUG);
    mutantPageId = await seed(MUTANT_TITLE, MUTANT_SLUG);

    // ── ARM 1: the SHIPPED project — the artefact a person actually receives ──
    await withRenderedPage({ projectDir, backendPort }, async (page0) => {
      const page = page0 as RenderedPage;
      browserSession = await signInBrowser(page);

      // 🔴 Read the store BEFORE the browser is anywhere near the row.
      storedSeeded = await readStored(shippedPageId);
      rowsClosed = await openList(page, 2);
      // eslint-disable-next-line no-console
      console.log('        rows on arrival:', JSON.stringify(rowsClosed).slice(0, 700));

      // ── The precondition, which is also s22's Publish re-driven on this fixture ──
      rowsMenuOpen = await actFromMenu(page, SHIPPED_TITLE, 'Publish');
      storedAfterPublish = await settle(shippedPageId, true);
      rowsAfterPublish = await readRows(page);
      // eslint-disable-next-line no-console
      console.log('        after Publish:', JSON.stringify(storedAfterPublish), JSON.stringify(rowsAfterPublish.rows));

      // ── The act AC3 has never had: Unpublish, from the same menu ─────────────
      await actFromMenu(page, SHIPPED_TITLE, 'Unpublish');
      storedAfterUnpublish = await settle(shippedPageId, false);
      rowsAfterUnpublish = await readRows(page);
      // eslint-disable-next-line no-console
      console.log(
        '        after Unpublish:',
        JSON.stringify(storedAfterUnpublish),
        JSON.stringify(rowsAfterUnpublish.rows)
      );
    });

    const all = await client.get<{ results?: Row[] }>('/classes/Page', asUser(owner));
    pageCountAtEnd = all.json.results ? all.json.results.length : -1;

    const history = new ExecutionHistory();
    history.open(dataDir);
    publishRuns = history
      .list({ workflowId: 'publishPage', limit: 20 })
      .map((r) => ({
        status: r.status,
        steps: ((history.get(r.id)?.steps || []) as unknown as Array<{ nodeType: string; status: string }>)
      }));
    // eslint-disable-next-line no-console
    console.log(
      '        publishPage runs:',
      JSON.stringify(
        publishRuns.map((r) => ({ status: r.status, steps: r.steps.map((s) => `${s.nodeType}:${s.status}`) }))
      )
    );

    // ── ARM 2: the MUTANT — one wire gone, so the click reaches nothing ───────
    mutantDir = copyProject(projectDir, 'nowire');
    dropWireById(mutantDir, 'Admin/PageRow', 'unpublishButton', 'onClick', 'unpublish', 'call', 'unpublish-call');

    await withRenderedPage({ projectDir: mutantDir, backendPort }, async (page0) => {
      const page = page0 as RenderedPage;
      await signInBrowser(page);
      await openList(page, 2);

      await actFromMenu(page, MUTANT_TITLE, 'Publish');
      mutantAfterPublish = await settle(mutantPageId, true);

      const opened = await actFromMenu(page, MUTANT_TITLE, 'Unpublish');
      mutantMenuButtons = opened.rows.find((r) => r.text.includes(MUTANT_TITLE))?.buttons ?? ['ROW NOT FOUND'];
      // The wire is gone, so nothing should move — wait the same bounded window anyway, or the
      // arm would be measuring its own impatience rather than the missing wire.
      mutantAfterUnpublishClick = await settle(mutantPageId, false);
      // eslint-disable-next-line no-console
      console.log(
        '        MUTANT after Publish / after Unpublish click:',
        JSON.stringify(mutantAfterPublish),
        JSON.stringify(mutantAfterUnpublishClick)
      );
    });
  });

  afterAll(async () => {
    if (service) await service.stop();
    for (const d of [projectDir, mutantDir, dataDir]) {
      if (d) fs.rmSync(d, { recursive: true, force: true });
    }
  });

  // ── Controls ───────────────────────────────────────────────────────────────

  it('CONTROL — the backend enforced row-level ACL while all of this was measured', () => {
    expect(securityEnforced).toBe(true);
  });

  it('CONTROL — the browser signed in through the template’s own form and holds a session', () => {
    expect(browserSession).toBeTruthy();
  });

  it('CONTROL — the page began as a DRAFT the world could not read', () => {
    expect(storedSeeded.ownerStatus).toBe(200);
    expect(storedSeeded.published).not.toBe(true);
    expect(storedSeeded.worldStatus).not.toBe(200);
  });

  it('CONTROL — the row’s overflow menu was CLOSED on arrival: none of the three actions existed', () => {
    const row = rowsClosed.rows.find((r) => r.text.includes(SHIPPED_TITLE));
    expect(`row:${row ? 'found' : `MISSING of ${rowsClosed.rowCount} — ${rowsClosed.bodyText}`}`).toBe('row:found');
    expect(row?.buttons).toEqual(['Edit', 'More']);
  });

  it('CONTROL — opening the menu mounted exactly the three actions AC3 names', () => {
    const row = rowsMenuOpen.rows.find((r) => r.text.includes(SHIPPED_TITLE));
    expect(row?.buttons).toEqual(['Edit', 'More', 'Publish', 'Unpublish', 'Duplicate']);
  });

  // ── The precondition: a known-firing signal, so the reading after it means something ──

  it('PRECONDITION — Publish from the menu made the STORED row published, and world-readable', () => {
    expect(storedAfterPublish.published).toBe(true);
    expect(storedAfterPublish.worldStatus).toBe(200);
  });

  it('PRECONDITION — and the pill read `Published` before anything was unpublished', () => {
    const row = rowsAfterPublish.rows.find((r) => r.text.includes(SHIPPED_TITLE));
    expect(row?.text).toContain('Published');
  });

  // ── The act ────────────────────────────────────────────────────────────────

  it('🟢 AC3 — `Unpublish` from the overflow menu turns the STORED row back into a draft', () => {
    expect(storedAfterUnpublish.ownerStatus).toBe(200);
    expect(storedAfterUnpublish.published).toBe(false);
  });

  it('🟢 AC3 — and the world loses its read: the page is off the public site, not merely relabelled', () => {
    expect(storedAfterUnpublish.worldStatus).not.toBe(200);
  });

  it('🟢 AC3 — and the row’s pill updates to `Draft`', () => {
    const row = rowsAfterUnpublish.rows.find((r) => r.text.includes(SHIPPED_TITLE));
    expect(`row:${row ? 'found' : `MISSING — ${rowsAfterUnpublish.bodyText}`}`).toBe('row:found');
    expect(row?.text).toContain('Draft');
    expect(row?.text).not.toContain('Published');
  });

  it('CONTROL — the SAME row was rewritten: no page was created, replaced or deleted', () => {
    expect(pageCountAtEnd).toBe(2);
  });

  it('the backend recorded BOTH calls, and every step of every one of them succeeded', () => {
    expect(publishRuns.length).toBe(2);
    expect(publishRuns.map((r) => r.status)).toEqual(['success', 'success']);
    const bad = publishRuns.flatMap((r, i) =>
      r.steps.filter((s) => s.status !== 'success').map((s) => `run${i}:${s.nodeType}:${s.status}`)
    );
    expect(bad).toEqual([]);
    expect(publishRuns.every((r) => r.steps.length > 0)).toBe(true);
  });

  // ── The mutant: it RESTORES the defect, so the click is what is being measured ──

  it('MUTANT — with `unpublishButton.onClick → unpublish.call` gone, the same click leaves the row published', () => {
    expect(mutantAfterPublish.published).toBe(true);
    expect(mutantAfterUnpublishClick.published).toBe(true);
    expect(mutantAfterUnpublishClick.worldStatus).toBe(200);
  });

  it('CONTROL — and that arm’s menu still OFFERED the button, so the arm is about the wire', () => {
    expect(mutantMenuButtons).toContain('Unpublish');
  });
});
