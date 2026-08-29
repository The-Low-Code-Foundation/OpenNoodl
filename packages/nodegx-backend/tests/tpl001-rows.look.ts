/**
 * TPL-001 — the four lists, WITH ROWS IN THEM, as pictures.
 *
 * 🔴 **This is a harness, not a gate. It asserts almost nothing.** It seeds a
 * real backend through the template's own doors, signs a moderator in through
 * the browser, and writes a PNG and the page text for each list at 1280 and 390.
 * What it produces is something to look at, which this phase treats as an
 * acceptance criterion in its own right — *"appearance is graded BEFORE the
 * behaviour work, by looking at it"* (Richard, standing ruling).
 *
 * 🔴 **It exists because the thing it renders had never been seen.** Every list
 * in this template draws its empty state on a fresh install — correctly, that is
 * AC6 — so `render-report` and every drive read the empty half. §13 recorded the
 * gap in s7 (*"has NOT been looked at with rows in it"*) and it stayed open for
 * four sessions, across two rounds of styling the rows. B3's whole finding was
 * visible in the first screenshot this produced.
 *
 * ⚠️ **No suite runs it**, and the `.look.ts` suffix is why: `jest.config.js`
 * matches `*.test.ts`, so this cannot slow a gate down or redden one, and equally
 * nothing keeps it compiling. Run it deliberately:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/tpl001-rows.look.ts
 *
 * `B3_OUT=/some/dir` chooses where the pictures land (default `/tmp/b3-look`).
 * Each page also writes `<page>-<width>.geom.txt`: the first three ruled rows'
 * own box and their children's, which is how the 50/50 split and the 361px
 * button in §19 were caught. A screenshot shows you something is wrong; the
 * geometry says what.
 *
 * ⚠️ **Seeded with more rows than the drives use, on purpose.** A list of one
 * looks fine however it is styled — the defect B3 is about only appears at
 * eight.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import {
  bundleMembersCloud,
  copyTemplateProject,
  makeMembersDataDir,
  SETUP_TOKEN,
  signIn
} from './helpers/members-drive';
import { bindProjectToBackend, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

const OUT = process.env.B3_OUT || '/tmp/b3-look';
const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
const MEMBERS_READ_ACL = {
  'role:admin': { read: true, write: true },
  'role:member': { read: true, write: false }
};

const ANNOUNCEMENTS = [
  ['The roof appeal', 'We have raised half of what the roof needs, and the rest is in sight.', '2026-08-20T10:00:00.000Z'],
  ['The harvest supper', 'Saturday the ninth, in the hall, from seven.', '2026-08-18T10:00:00.000Z'],
  ['Choir practice moves', 'Thursdays from September, same time.', '2026-08-15T10:00:00.000Z'],
  ['Churchyard tidy', 'Bring gloves. Tea and cake afterwards.', '2026-08-11T10:00:00.000Z'],
  ['New hall bookings', 'The hall is now bookable through the office.', '2026-08-04T10:00:00.000Z'],
  ['Summer fete thanks', 'Nine hundred pounds, and not a drop of rain.', '2026-07-28T10:00:00.000Z'],
  ['Parking on Sundays', 'Please leave the lane by the gate clear.', '2026-07-21T10:00:00.000Z'],
  ['The organ fund', 'A donor has offered to match what we raise by Christmas.', '2026-07-14T10:00:00.000Z']
];
const MEETINGS = [
  ['Parish council', '2099-01-12', 'The hall'],
  ['Standing committee', '2099-02-03', 'The vestry'],
  ['Fabric committee', '2099-02-19', 'The hall'],
  ['Annual meeting', '2099-03-30', 'The church'],
  ['Finance group', '2099-04-08', 'The office'],
  ['Safeguarding review', '2099-05-14', 'The vestry']
];
const JOINERS = [
  ['Mo Joiner', 'mo@example.invalid'],
  ['Pat Pending', 'pat@example.invalid'],
  ['Ada Newcomer', 'ada@example.invalid'],
  ['Sam Quiet', 'sam@example.invalid'],
  ['Tom Waiting', 'tom@example.invalid']
];

describe('B3 — the four lists, with rows in them', () => {
  it('renders and shoots', async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const projectDir = copyTemplateProject('tpl001-b3');
    const dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl001-b3');
    const service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'tpl001-b3',
      backendName: "TPL-001 B3 look"
    });
    const started = await service.start();
    const base = started.listen.url;
    const client = httpClient(() => base);
    expect(started.security.enforced).toBe(true);
    bindProjectToBackend(projectDir, 'tpl001-b3', started.listen.port);

    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      blurb: 'A congregation that meets on Sundays.',
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
    // Approve three so the directory has depth; two stay on the queue.
    for (const [, email] of JOINERS.slice(0, 3)) {
      const users = await client.get<{ results: Array<Record<string, unknown>> }>(
        '/classes/MemberRequest',
        tok
      );
      const row = (users.json?.results ?? []).find((r) => String(r.email) === email);
      if (row) await client.post('/functions/decideMembership', { requestId: row.objectId, approve: true }, tok);
    }
    for (const [title, body, postedAt] of ANNOUNCEMENTS) {
      await client.post('/classes/Announcement', { title, body, postedAt, ACL: MEMBERS_READ_ACL }, tok);
    }
    for (const [title, when, place] of MEETINGS) {
      await client.post(
        '/classes/Meeting',
        { title, when, place, details: 'All welcome.', ACL: MEMBERS_READ_ACL },
        tok
      );
    }

    const counts: Record<string, unknown> = {};
    for (const cls of ['Announcement', 'Meeting', 'MemberRequest', 'Member']) {
      const r = await client.get<{ results: unknown[] }>(`/classes/${cls}`, tok);
      counts[cls] = r.json?.results?.length ?? `status ${r.status}`;
    }
    console.log('SEEDED ' + JSON.stringify(counts));

    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      await page.setViewport({ width: 1280, height: 1000 });
      await page.navigate('/sign-in');
      await signIn(page, MODERATOR.email, MODERATOR.password);

      const shoot = async (label: string, url: string, w: number, h: number) => {
        await page.setViewport({ width: w, height: h });
        await page.navigate(url);
        await new Promise((r) => setTimeout(r, 1400));
        const height = Number(await page.evaluate('document.documentElement.scrollHeight'));
        const shot = (await (page as unknown as { client: { send(m: string, p: unknown): Promise<{ data: string }> } }).client.send(
          'Page.captureScreenshot',
          {
            format: 'png',
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: w, height: Math.min(height, 16384), scale: 1 }
          }
        )) as { data: string };
        const file = path.join(OUT, `${label}-${w}.png`);
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
        const geom = String(
          await page.evaluate(`(function () {
            var out = [];
            var seen = 0;
            var all = document.querySelectorAll('div');
            for (var i = 0; i < all.length; i++) {
              var el = all[i];
              var cs = getComputedStyle(el);
              if (cs.borderBottomStyle !== 'solid' || cs.flexDirection !== 'row') continue;
              if (seen++ > 2) break;
              var r = el.getBoundingClientRect();
              var kids = [];
              for (var k = 0; k < el.children.length; k++) {
                var kr = el.children[k].getBoundingClientRect();
                kids.push(el.children[k].tagName + ' ' + Math.round(kr.left) + '..' + Math.round(kr.right) + ' w' + Math.round(kr.width));
              }
              out.push('ROW ' + Math.round(r.left) + '..' + Math.round(r.right) + ' h' + Math.round(r.height) + ' | ' + kids.join(' | '));
            }
            return out.join('\\n');
          })()`)
        );
        fs.writeFileSync(path.join(OUT, `${label}-${w}.geom.txt`), geom);
        const text = String(await page.evaluate('document.body.innerText'));
        fs.writeFileSync(path.join(OUT, `${label}-${w}.txt`), text);
        console.log(`SHOT ${file} height=${height}`);
      };

      for (const [label, url] of [
        ['members', '/members'],
        ['meetings', '/meetings'],
        ['requests', '/requests'],
        ['directory', '/directory']
      ] as Array<[string, string]>) {
        await shoot(label, url, 1280, 1000);
        await shoot(label, url, 390, 844);
      }
      console.log('CONSOLE ERRORS: ' + JSON.stringify(page.consoleErrors));
    });

    await service.stop();
  });
});
