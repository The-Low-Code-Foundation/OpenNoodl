/**
 * AC6 — **the first thing a person sees on a fresh install.**
 *
 * TPL-001 §5: *"a template ships graphs, not rows"*. Every list in this template
 * is empty on the day it is installed, and each one carries a designed sentence
 * instead of a blank space. §12 recorded this as the one acceptance criterion
 * with **no reading against it**: the main drive seeds an announcement, a
 * meeting and two join requests before the browser ever opens, so the empty
 * states it renders past are the states nothing has looked at.
 *
 * ## 🔴 Why "the sentence is on the page" is not the measurement
 *
 * Every empty state ships `visible: false` and is revealed by a gate, so the
 * words are in the markup from the first paint. `document.body.textContent`
 * contains *"Nothing has been posted yet"* on a page showing a full
 * noticeboard. An assertion on **presence** passes on both arms and measures
 * the DOM's existence — the same class as §13's `innerText` finding, inverted.
 *
 * So this file reads **painted** (a layout box, which `display: none` does not
 * have), and it takes both arms:
 *
 * | arm | rows | what must be true |
 * |---|---|---|
 * | **empty** | none | every empty state painted, no list drawn |
 * | **seeded** | one of each, posted between the two visits | every empty state **dark**, every row drawn |
 *
 * 🔴 **The seeded arm is what makes the empty arm mean anything.** Without it,
 * "painted" would be equally consistent with an empty state that is simply
 * always on — which is a real defect (a noticeboard that says it is empty above
 * six announcements) and it would pass an empty-arm-only spec.
 *
 * One backend, one browser, one signed-in moderator, minutes apart. The only
 * thing that changes between the arms is that three rows now exist.
 *
 * ## ⚠️ The directory's empty state is deliberately NOT graded here
 *
 * `NO_MEMBERS_TEXT` is unreachable on a working install: `claimAssociation`
 * writes the founding moderator's own directory row, so the first person able
 * to open `/directory` is already on it. What this file asserts instead is that
 * fact — **one row, themselves** — which is the fresh-install reading the
 * directory actually has. The empty state stays in the graph for the case where
 * that write failed, which setup survives by design (TPL-001 §14).
 */
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import {
  bundleMembersCloud,
  controls,
  copyTemplateProject,
  makeMembersDataDir,
  offered,
  sentence,
  Sentence,
  SETUP_TOKEN,
  signIn
} from './helpers/members-drive';
import { bindProjectToBackend, readVisit, Visit, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

const MODERATOR = { name: 'Ruth Bramley', email: 'mod@ac6.invalid', password: 'pw-moderator' };
const ASSOCIATION = { name: 'St Anywhere', blurb: 'A congregation that meets on Sundays.' };

/** What a moderator posts BETWEEN the two visits, and nothing before. */
const LATER = {
  announcement: { title: 'The first announcement', body: 'Now there is something to read.' },
  meeting: { title: 'The first meeting', when: '2099-01-01', place: 'The hall', details: 'All welcome.' },
  asker: { name: 'Ann Asker', email: 'ann@ac6.invalid', password: 'pw-ann' }
};

/** The three sentences AC6 is about, and the screen each belongs to. */
const EMPTY_STATES = [
  { where: 'members', text: 'Nothing has been posted yet.' },
  { where: 'meetings', text: 'No meetings are in the diary yet.' },
  { where: 'requests', text: 'Nobody is waiting to join.' }
];

describe('TPL-001 AC6 — what a fresh install shows before anybody has posted anything', () => {
  let projectDir = '';
  let dataDir = '';
  let service: BackendService;
  let base = '';
  const client = httpClient(() => base);
  const as = (token: string) => ({ 'x-parse-session-token': token });

  const visits: Record<string, Visit> = {};
  /** `<arm>.<where>` → what that empty state was doing on that visit. */
  const states: Record<string, Sentence> = {};
  /** What the moderator was offered on each visit, so a dead page is visible. */
  const buttons: Record<string, string[]> = {};
  let moderatorToken = '';
  let seeded = { announcement: -1, meeting: -1, request: -1 };
  let directoryRows: string[] = [];

  beforeAll(async () => {
    projectDir = copyTemplateProject('tpl001-ac6');
    dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl001-ac6');
    service = new BackendService({ dataDir, port: 0, backendId: 'tpl001-ac6', backendName: 'AC6' });
    const started = await service.start();
    base = started.listen.url;
    // 🔴 The same precondition every other drive opens with: with `devOpen` on,
    // row-level ACL is off and this measures a different app.
    expect(started.security.enforced).toBe(true);
    bindProjectToBackend(projectDir, 'tpl001-ac6', started.listen.port);

    // Setup, and NOTHING else. This is the whole of a fresh install: one
    // moderator, one association row, and not a single list row anywhere.
    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: ASSOCIATION.name,
      blurb: ASSOCIATION.blurb,
      // D22 (s8): the founder's own name, so the directory shows a person
      // rather than their email address twice.
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    moderatorToken = await client
      .post<{ sessionToken: string }>('/login', { username: MODERATOR.email, password: MODERATOR.password })
      .then((r) => r.json.sessionToken);

    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      await page.setViewport({ width: 1280, height: 1600 });

      const look = async (arm: string, where: string, url: string) => {
        const key = `${arm}.${where}`;
        visits[key] = await readVisit(page, url);
        buttons[key] = offered(await controls(page, 'button'));
        const state = EMPTY_STATES.find((e) => e.where === where);
        if (state) states[key] = await sentence(page, state.text);
      };

      // 🔴 The moderator, not a member: `/requests` is moderator-only, and a
      // moderator is a member too (§11), so one person reaches all three
      // screens and the two arms are taken by the same pair of eyes.
      await signIn(page, MODERATOR.email, MODERATOR.password);

      // ── Arm 1: the day it was installed ──────────────────────────────────
      await look('empty', 'members', '/members');
      await look('empty', 'meetings', '/meetings');
      await look('empty', 'requests', '/requests');
      visits['empty.directory'] = await readVisit(page, '/directory');

      // ── Between the arms: one of each, over HTTP ──────────────────────────
      // Posted from outside the browser deliberately — this file is about what
      // the lists DRAW, and the posting forms are §7 of the main drive.
      const a = await client.post(
        '/classes/Announcement',
        { ...LATER.announcement, postedAt: new Date('2026-08-28T09:00:00.000Z').toISOString() },
        as(moderatorToken)
      );
      const m = await client.post('/classes/Meeting', LATER.meeting, as(moderatorToken));
      const r = await client.post('/functions/requestAccess', {
        name: LATER.asker.name,
        email: LATER.asker.email,
        password: LATER.asker.password,
        message: 'I would like to join.'
      });
      seeded = { announcement: a.status, meeting: m.status, request: r.status };

      // ── Arm 2: the same screens, with something on them ───────────────────
      await look('seeded', 'members', '/members');
      await look('seeded', 'meetings', '/meetings');
      await look('seeded', 'requests', '/requests');
    });

    directoryRows = await client
      .get<{ results?: Array<Record<string, unknown>> }>('/classes/Member', as(moderatorToken))
      .then((res) => (res.json?.results ?? []).map((row) => String(row.name ?? '')));
  });

  afterAll(async () => {
    if (service) await service.stop();
  });

  describe('§0 the arms really differ', () => {
    it('🔴 the seeding between them succeeded, so "seeded" is not a second empty arm', () => {
      // Without this, both arms are the empty install and every assertion below
      // is satisfiable by a page that never changed.
      expect(seeded.announcement).toBeLessThan(300);
      expect(seeded.meeting).toBeLessThan(300);
      expect(seeded.request).toBeLessThan(300);
    });

    it('and the pages were alive on both — the moderator was offered their tools', () => {
      expect(buttons['empty.members']).toContain('Post something');
      expect(buttons['seeded.members']).toContain('Post something');
    });
  });

  describe('§1 AC6 — every empty state is PAINTED on a fresh install', () => {
    it.each(EMPTY_STATES)('$where says "$text"', ({ where }) => {
      expect(`${where}:${states[`empty.${where}`].painted}`).toBe(`${where}:true`);
    });

    it('and no list has drawn a row on any of the three screens', () => {
      expect(visits['empty.members'].text).not.toContain(LATER.announcement.title);
      expect(visits['empty.meetings'].text).not.toContain(LATER.meeting.title);
      expect(visits['empty.requests'].text).not.toContain(LATER.asker.name);
    });

    it('🔴 the members page is not simply blank — it is a screen with a sentence on it', () => {
      // The failure this AC exists to prevent is an empty page, not a wrong one.
      expect(visits['empty.members'].text).toContain('Announcements');
      expect(visits['empty.members'].text.trim().length).toBeGreaterThan(40);
    });
  });

  describe('§2 the control — with rows, the same sentences go dark', () => {
    it.each(EMPTY_STATES)('$where no longer shows its empty state', ({ where }) => {
      expect(`${where}:${states[`seeded.${where}`].painted}`).toBe(`${where}:false`);
    });

    it('🔴 …while still being IN the document, which is why `painted` is the reading', () => {
      // If this were false the arms would differ by the node existing at all,
      // and `painted` would be measuring the same thing `present` does.
      for (const { where } of EMPTY_STATES) {
        expect(`${where}:${states[`seeded.${where}`].present}`).toBe(`${where}:true`);
      }
    });

    it('and every row the seeding wrote is now drawn', () => {
      expect(visits['seeded.members'].text).toContain(LATER.announcement.title);
      expect(visits['seeded.meetings'].text).toContain(LATER.meeting.title);
      expect(visits['seeded.requests'].text).toContain(LATER.asker.name);
    });
  });

  describe('§3 the directory on a fresh install is not empty — it holds the founder', () => {
    it('🔴 setup wrote the founding moderator’s own row', () => {
      // The reading `NO_MEMBERS_TEXT` cannot give, and the reason it is not
      // graded above: a moderator who can open this screen is already on it.
      // D22 (s8): under their NAME. Until setup asked for one, this row was
      // filed under the email address and this spec asserted that as correct.
      expect(directoryRows).toEqual([MODERATOR.name]);
    });

    it('and the moderator sees themselves rather than a blank list', () => {
      expect(visits['empty.directory'].text).toContain(MODERATOR.name);
      expect(visits['empty.directory'].text).toContain('Moderator');
    });
  });
});
