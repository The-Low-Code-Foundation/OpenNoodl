/**
 * VIB-001 — the members' area (TPL-001), photographed at both doors.
 *
 * 🔴 **A harness, not a gate.** It asserts only the things that would make a
 * screenshot dishonest — that the door run really is unbound, and that the
 * living run really was seeded. Everything else it produces is something to
 * look at, and phase 81's close condition is a person looking at it.
 *
 * ⚠️ **No suite runs it**, and the `.look.ts` suffix is why: `jest.config.js`
 * matches `*.test.ts`, so this can neither slow a gate down nor redden one.
 * Run it deliberately — this is VIB-001 AC1's "one command":
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib001-members.look.ts
 *
 * The two states are two `judge()` runs against two copies of the same
 * directory, in one process, so nothing between them can differ except the
 * thing being varied.
 *
 * 🔴 **The door run is the one that has never been taken.** P78's own D9 named
 * it and deferred it. Everything about it is arranged so it cannot quietly
 * become the living run: `judge()` refuses a `backendPort` and a `prepare` for
 * `state: 'door'`, and md5s the served project file against
 * `templates/members-area/nodegx.project.json`.
 *
 * ⚠️ The seeding is TPL-001's own, through the product's own doors —
 * `claimAssociation` for the moderator, `requestAccess` for everyone else, and
 * the browser signs in through the SignIn page's own form. A harness that minted
 * its own users would be photographing a flow this template does not have.
 */
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import { judge, today } from './helpers/judge';
import {
  bundleMembersCloud,
  copyTemplateProject,
  makeMembersDataDir,
  SETUP_TOKEN,
  signIn,
  TEMPLATE_DIR
} from './helpers/members-drive';
import { bindProjectToBackend } from './helpers/site-drive';

import * as path from 'path';

jest.setTimeout(1800000);

const SHIPPED_PROJECT = path.join(TEMPLATE_DIR, 'nodegx.project.json');
const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
const MEMBERS_READ_ACL = {
  'role:admin': { read: true, write: true },
  'role:member': { read: true, write: false }
};

/** Honest sample content — enough rows that a list is a list, not a single row. */
const ANNOUNCEMENTS = [
  ['The roof appeal', 'We have raised half of what the roof needs, and the rest is in sight.', '2026-08-20T10:00:00.000Z'],
  ['The harvest supper', 'Saturday the ninth, in the hall, from seven.', '2026-08-18T10:00:00.000Z'],
  ['Choir practice moves', 'Thursdays from September, same time.', '2026-08-15T10:00:00.000Z'],
  ['Churchyard tidy', 'Bring gloves. Tea and cake afterwards.', '2026-08-11T10:00:00.000Z'],
  ['New hall bookings', 'The hall is now bookable through the office.', '2026-08-04T10:00:00.000Z'],
  ['Summer fete thanks', 'Nine hundred pounds, and not a drop of rain.', '2026-07-28T10:00:00.000Z']
];
const MEETINGS = [
  ['Parish council', '2099-01-12', 'The hall'],
  ['Standing committee', '2099-02-03', 'The vestry'],
  ['Fabric committee', '2099-02-19', 'The hall'],
  ['Annual meeting', '2099-03-30', 'The church']
];
const JOINERS = [
  ['Mo Joiner', 'mo@example.invalid'],
  ['Pat Pending', 'pat@example.invalid'],
  ['Ada Newcomer', 'ada@example.invalid'],
  ['Sam Quiet', 'sam@example.invalid'],
  ['Tom Waiting', 'tom@example.invalid']
];

/** The date directory both states share, so one run is one folder. */
const DATE = today();

describe('VIB-001 — the members area, as a person meets it', () => {
  it('photographs the door: shipped bytes, no backend, nobody signed in', async () => {
    const projectDir = copyTemplateProject('vib001-door');

    const run = await judge({
      task: 'vib-001',
      subject: 'members-area',
      state: 'door',
      projectDir,
      shippedProjectFile: SHIPPED_PROJECT,
      date: DATE,
      pages: [
        { label: 'landing', url: '/', as: 'the first thing anyone sees' },
        { label: 'sign-in', url: '/sign-in', as: 'a member coming back' },
        { label: 'join', url: '/join', as: 'a stranger asking to join' },
        { label: 'setup', url: '/setup', as: 'the owner, first run — the page P78 could not reach' },
        { label: 'members', url: '/members', as: 'the gated area, unauthenticated (V3 says this fails open)' },
        // 🔴 **REL-002c, session 12 — the sixth door page.** A link in an
        // email is the one way into this template that does not start at `/`,
        // and the person following it is signed in to nothing. It had never been
        // rendered, in either state, by any harness.
        { label: 'unsubscribe', url: '/unsubscribe', as: 'somebody who clicked "unsubscribe" in an email' }
      ]
    });

    // Not a look-verdict — the readings that would make the pictures lie.
    // 6 pages x 4 frozen viewports, and the served bytes are the shipped bytes.
    expect(run.shots.length).toBe(24);
    expect(run.artefactMd5).toBe(
      require('crypto').createHash('md5').update(require('fs').readFileSync(SHIPPED_PROJECT)).digest('hex')
    );
    // eslint-disable-next-line no-console
    console.log('DOOR MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });

  it('photographs the living state: claimed, seeded, moderator signed in', async () => {
    const projectDir = copyTemplateProject('vib001-living');
    const dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'vib001-living');
    const service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'vib001-living',
      backendName: 'VIB-001 living'
    });
    const started = await service.start();
    const client = httpClient(() => started.listen.url);
    // 🔴 Read before anything is seeded: dev-open would make every gate in this
    // template meaningless, and the pictures would be of a different product.
    expect(started.security.enforced).toBe(true);
    bindProjectToBackend(projectDir, 'vib001-living', started.listen.port);

    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      // 🔴 **REL-002c §E-i — the copy is DATA now, so the seed has to supply BOTH
      // fields or the photographs measure a screen no real install has.** `/setup`
      // collects a short tagline and a longer paragraph; the hero renders the
      // first and the landing's "About us" band renders the second. Seeding only
      // `blurb` would leave the hero's second line empty and photograph it as a
      // gap under the association's name.
      tagline: 'Meeting on the green since 1894',
      blurb:
        'St Anywhere is a parish congregation of about ninety people. We meet on Sunday mornings, ' +
        'run the Tuesday lunch club, keep the churchyard, and put on a summer fete that has not ' +
        'been rained off since 2019. Everyone is welcome at anything on the diary.',
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    for (const [name, email] of JOINERS) {
      await client.post('/functions/requestAccess', {
        name,
        email,
        password: 'pw-' + email,
        message: `${name} would like to join.`
      });
    }
    const login = await client.post<{ sessionToken: string }>('/login', {
      username: MODERATOR.email,
      password: MODERATOR.password
    });
    const tok = { 'x-parse-session-token': login.json.sessionToken };
    // Three approved so the directory has depth; two left on the queue so the
    // requests page has something to be about.
    for (const [, email] of JOINERS.slice(0, 3)) {
      const rows = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/MemberRequest', tok);
      const row = (rows.json?.results ?? []).find((r) => String(r.email) === email);
      if (row) await client.post('/functions/decideMembership', { requestId: row.objectId, approve: true }, tok);
    }
    // 🔴 **The ids are CAPTURED now, and that is what makes the two detail
    // pages photographable at all.** `/announcements/{id}` and `/meetings/{id}`
    // take a `PageInputs` path parameter, so there is no URL that reaches them
    // without a real row — which is exactly why P78 skipped them and why they
    // have never appeared in a shot list. Seeding already creates the rows; only
    // the `objectId` was being thrown away.
    //
    // ⚠️ **The FIRST of each, because the list pages sort to it.** `/members`
    // puts the newest announcement at the top and `/meetings` the soonest
    // meeting, so these two ids are the rows a person actually clicks. A random
    // row would photograph a page nobody arrives at first.
    let firstAnnouncementId = '';
    let firstMeetingId = '';
    for (const [title, body, postedAt] of ANNOUNCEMENTS) {
      const created = await client.post<{ objectId: string }>(
        '/classes/Announcement',
        { title, body, postedAt, ACL: MEMBERS_READ_ACL },
        tok
      );
      if (!firstAnnouncementId) firstAnnouncementId = created.json?.objectId ?? '';
    }
    for (const [title, when, place] of MEETINGS) {
      const created = await client.post<{ objectId: string }>(
        '/classes/Meeting',
        { title, when, place, details: 'All welcome.', ACL: MEMBERS_READ_ACL },
        tok
      );
      if (!firstMeetingId) firstMeetingId = created.json?.objectId ?? '';
    }

    // 🔴 A known-firing signal beside every later absence: if the seed silently
    // did nothing, the pictures would show empty states and read as a design
    // problem rather than a harness one.
    const seeded: Record<string, number> = {};
    for (const cls of ['Announcement', 'Meeting', 'MemberRequest', 'Member']) {
      const r = await client.get<{ results: unknown[] }>(`/classes/${cls}`, tok);
      seeded[cls] = r.json?.results?.length ?? -1;
    }
    // eslint-disable-next-line no-console
    console.log('SEEDED ' + JSON.stringify(seeded));
    expect(seeded.Announcement).toBe(ANNOUNCEMENTS.length);
    expect(seeded.Meeting).toBe(MEETINGS.length);
    // 🔴 Same discipline as `seeded`: an empty id would build the URL
    // `/announcements/` , which routes to a page with no record and photographs
    // as an empty state — a harness fault wearing a design fault's clothes.
    expect(firstAnnouncementId).not.toBe('');
    expect(firstMeetingId).not.toBe('');

    try {
      const run = await judge({
        task: 'vib-001',
        subject: 'members-area',
        state: 'living',
        projectDir,
        backendPort: started.listen.port,
        date: DATE,
        prepare: async (page) => {
          const session = await signIn(page, MODERATOR.email, MODERATOR.password);
          // Same discipline: a signed-out living run would photograph the door
          // twice and label one of them "living".
          if (!session) throw new Error('the moderator could not sign in — the living state was never entered');
        },
        pages: [
          { label: 'landing', url: '/', as: 'the claimed association, signed in' },
          { label: 'members', url: '/members', as: 'the announcements list, with rows' },
          { label: 'meetings', url: '/meetings', as: "what's coming up" },
          { label: 'directory', url: '/directory', as: 'who belongs' },
          { label: 'requests', url: '/requests', as: 'the moderator queue' },
          { label: 'account', url: '/account', as: 'a member managing themselves' },
          // 🔴 **The three pages no harness has ever rendered.** `/post`
          // needs nothing but a signed-in moderator and was simply never asked
          // for; the two detail pages need the ids captured above. With these,
          // the shot list is all thirteen pages for the first time, and
          // *"every page"* becomes a claim the instrument can actually support.
          { label: 'post', url: '/post', as: 'the moderator writing an announcement' },
          {
            label: 'announcement',
            url: `/announcements/${firstAnnouncementId}`,
            as: 'a member reading the newest announcement — the top row of /members'
          },
          {
            label: 'meeting',
            url: `/meetings/${firstMeetingId}`,
            as: 'a member opening the soonest meeting — the top row of /meetings'
          }
        ]
      });
      expect(run.shots.length).toBe(36);
      // eslint-disable-next-line no-console
      console.log('LIVING MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
    } finally {
      await service.stop();
    }
  });
});
