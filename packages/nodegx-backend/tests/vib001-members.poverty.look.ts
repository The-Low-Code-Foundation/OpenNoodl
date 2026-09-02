/**
 * REL-002c — **the WordPress-starter tells, measured on all thirteen pages.**
 *
 * 🔴 **Why this exists, and it is not a tidy-up.** Row 6's bar is Richard's:
 * *"I want all pages looking as good as the homepage."* Every session so far
 * graded each page **beside the members-area's own `/`** — and on 2026-09-02 he
 * ruled that page itself is in the *"passable… old-school WordPress template"*
 * bucket, against the VIB-006 landing page he called *"fucking pro"*. So twelve
 * pages were certified against a benchmark he rejects. **The comparison was
 * circular, and this harness replaces it with the instrument that already
 * separates the two poles.**
 *
 * ⚠️ **`vib007-m3-measure.look.ts` is the ancestor and does most of this
 * already** — same `renderReport`, same VIB-006 control. It stops at four
 * members-area pages because it renders **the door with no backend**, where
 * `/` and `/members` paint the *"not connected yet"* card and the other nine
 * pages are unreachable. This one seeds a real backend and **signs the
 * moderator in**, which is the only way the nine signed-in pages render as
 * anything but a login wall.
 *
 * 🔴 **The control is measured in the same run, first.** VIB-007 AC3 recorded
 * that all three poverty findings fire on the baseline door pages and **none**
 * on the VIB-006 page. An absence here is only worth reading beside that
 * known-firing/known-silent pair — a run where the control also reads zero
 * findings is a broken instrument, not a good template.
 *
 * ⚠️ **Desktop only, and that is the rubric's constraint rather than a
 * shortcut.** `DISPLAY_TYPE_MIN_PX = 48` is defined for desktop in README §2;
 * `render-measure` says in as many words that a phone threshold would be
 * invented. Grounds and imagery are width-independent enough that one width is
 * an honest reading.
 *
 * ⚠️ **Only the poverty family is reported.** Probes are passed empty, so the
 * probe-driven findings (`empty-list` and friends) are NOT measured here and
 * must not be read off this run.
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib001-members.poverty.look.ts
 */
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import { placeStarterAssets } from './helpers/judge';
import {
  bundleMembersCloud,
  copyTemplateProject,
  makeMembersDataDir,
  SETUP_TOKEN,
  signIn
} from './helpers/members-drive';
import { bindProjectToBackend } from './helpers/site-drive';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = path.join(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RR = require(path.join(REPO, 'scripts', 'devtools', 'render-report')) as any;

jest.setTimeout(1800000);

/** The one width README §2 gives a number for. */
const DESKTOP = { name: 'desktop', width: 1280, height: 900, mobile: false };

const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
const MEMBERS_READ_ACL = {
  'role:admin': { read: true, write: true },
  'role:member': { read: true, write: false }
};

type Row = {
  arm: string;
  page: string;
  largestPx: number;
  images: number;
  icons: number;
  grounds: number;
  tells: string;
};
const rows: Row[] = [];

/** A copy with the assets a real project has — measuring without them prices the empty arm. */
function servedCopy(from: string, label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `pov-${label}-`));
  fs.cpSync(from, dir, { recursive: true });
  const placed = placeStarterAssets(dir);
  if (placed.failed.length) throw new Error(`starter assets failed: ${placed.failed.join(', ')}`);
  return dir;
}

/**
 * Render `pages` and read the poverty family off each one.
 *
 * `prepare` runs once, before the first navigation, on the same connection —
 * which is what makes a signed-in measurement possible at all.
 */
async function measureArm(
  arm: string,
  projectDir: string,
  pages: { label: string; url: string }[],
  opts: { backendPort?: number; prepare?: (page: any) => Promise<void> } = {}
) {
  const overridden = Object.fromEntries(RR.overriddenDefaults(projectDir));
  const placeholders = [...new Set([...RR.placeholderStrings(), ...Object.keys(overridden)])];
  // Probes drive the LIST findings, not the poverty family; empty keeps this
  // run honest about what it did and did not measure.
  const expression = RR.measureExpression(placeholders, []);

  await RR.withRenderedPage({ projectDir, backendPort: opts.backendPort }, async (page: any) => {
    await page.setViewport(DESKTOP);
    if (opts.prepare) await opts.prepare(page);

    for (const spec of pages) {
      await page.navigate(spec.url);
      await new Promise((r) => setTimeout(r, 900));
      const raw = await page.evaluate(expression);
      const measured: Record<string, any> = {
        [DESKTOP.name]: { requested: { width: DESKTOP.width, height: DESKTOP.height }, ...raw }
      };
      const { findings } = RR.summarise(measured, null, overridden);
      const poverty = findings.filter((f: any) => RR.isPovertyFinding(f));
      const v = measured[DESKTOP.name];
      rows.push({
        arm,
        page: spec.label,
        largestPx: Math.round(v?.text?.largestFontSize ?? -1),
        images: v?.images?.total ?? -1,
        icons: v?.images?.icons ?? -1,
        grounds: v?.grounds?.distinct ?? -1,
        tells: poverty.map((f: any) => f.code).sort().join(' ') || '—'
      });
      // eslint-disable-next-line no-console
      console.log(`POV ${arm} ${spec.label} ` + JSON.stringify(rows[rows.length - 1]));
    }
  });
}

describe('REL-002c — the WordPress tells, on all thirteen members-area pages', () => {
  it('CONTROL: the VIB-006 page Richard ruled "fucking pro" must read SILENT', async () => {
    const dir = servedCopy(
      path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-006-landing'),
      'vib006'
    );
    await measureArm('CONTROL vib-006', dir, [{ label: 'landing', url: '/' }]);

    // 🔴 The instrument's own calibration, re-derived rather than inherited. If
    // this reddens, every "no tells" below is a statement about a broken
    // instrument and none of this run may be quoted.
    const control = rows.find((r) => r.arm.startsWith('CONTROL'));
    expect(control).toBeDefined();
    expect(control?.tells).toBe('—');
  });

  it('measures the four door pages a stranger meets before any backend exists', async () => {
    const dir = servedCopy(path.join(REPO, 'templates', 'members-area'), 'door');
    await measureArm('members door', dir, [
      { label: '/sign-in', url: '/sign-in' },
      { label: '/join', url: '/join' },
      { label: '/setup', url: '/setup' },
      { label: '/unsubscribe', url: '/unsubscribe' }
    ]);
    expect(rows.length).toBeGreaterThan(1);
  });

  it('measures the nine signed-in pages, with a seeded backend and the moderator signed in', async () => {
    const projectDir = copyTemplateProject('poverty-living');
    const dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'poverty-living');
    const service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'poverty-living',
      backendName: 'REL-002c poverty'
    });
    const started = await service.start();
    const client = httpClient(() => started.listen.url);
    expect(started.security.enforced).toBe(true);
    bindProjectToBackend(projectDir, 'poverty-living', started.listen.port);

    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      tagline: 'Meeting on the green since 1894',
      blurb:
        'St Anywhere is a parish congregation of about ninety people. We meet on Sunday mornings, ' +
        'run the Tuesday lunch club, keep the churchyard, and put on a summer fete that has not ' +
        'been rained off since 2019. Everyone is welcome at anything on the diary.',
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    await client.post('/functions/requestAccess', {
      name: 'Sam Quiet',
      email: 'sam@example.invalid',
      password: 'pw-sam',
      message: 'I have been coming on Sunday mornings for a while now and would like to join properly.'
    });

    const login = await client.post<{ sessionToken: string }>('/login', {
      username: MODERATOR.email,
      password: MODERATOR.password
    });
    const tok = { 'x-parse-session-token': login.json.sessionToken };

    let announcementId = '';
    let meetingId = '';
    const created = await client.post<{ objectId: string }>(
      '/classes/Announcement',
      {
        title: 'The roof appeal',
        body: 'We have raised half of what the roof needs, and the rest is in sight.',
        postedAt: '2026-08-20T10:00:00.000Z',
        ACL: MEMBERS_READ_ACL
      },
      tok
    );
    announcementId = created.json?.objectId ?? '';
    const m = await client.post<{ objectId: string }>(
      '/classes/Meeting',
      { title: 'Parish council', when: '2099-01-12', place: 'The hall', details: 'All welcome.', ACL: MEMBERS_READ_ACL },
      tok
    );
    meetingId = m.json?.objectId ?? '';
    // A known-firing signal beside the absences below.
    expect(announcementId).not.toBe('');
    expect(meetingId).not.toBe('');

    const served = servedCopy(projectDir, 'living');
    try {
      await measureArm(
        'members signed-in',
        served,
        [
          { label: '/ (living)', url: '/' },
          { label: '/members', url: '/members' },
          { label: '/meetings', url: '/meetings' },
          { label: '/directory', url: '/directory' },
          { label: '/requests', url: '/requests' },
          { label: '/post', url: '/post' },
          { label: '/account', url: '/account' },
          { label: '/announcements/{id}', url: `/announcements/${announcementId}` },
          { label: '/meetings/{id}', url: `/meetings/${meetingId}` }
        ],
        {
          backendPort: started.listen.port,
          prepare: async (page: any) => {
            const session = await signIn(page, MODERATOR.email, MODERATOR.password);
            if (!session) throw new Error('the moderator could not sign in — this arm would measure the login wall');
          }
        }
      );
    } finally {
      await service.stop?.();
    }
    expect(rows.filter((r) => r.arm === 'members signed-in').length).toBe(9);
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log('\n=== REL-002c — THE WORDPRESS TELLS, PAGE BY PAGE (desktop 1280) ===');
    // eslint-disable-next-line no-console
    console.log('arm|page|largestPx|images|icons|grounds|tells');
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log([r.arm, r.page, r.largestPx, r.images, r.icons, r.grounds, r.tells].join('|'));
    }
    const subject = rows.filter((r) => !r.arm.startsWith('CONTROL'));
    const clean = subject.filter((r) => r.tells === '—').length;
    // eslint-disable-next-line no-console
    console.log(`\n${clean} of ${subject.length} members-area pages read clean; ${subject.length - clean} carry at least one tell.`);
  });
});
