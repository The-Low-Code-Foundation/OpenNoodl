/**
 * VIB-001 — the Site Builder (P76/P77), photographed at both doors.
 *
 * 🔴 **A harness, not a gate**, on the same terms as `vib001-members.look.ts`.
 * Run it deliberately — VIB-001 AC1's second "one command":
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib001-site.look.ts
 *
 * ## What "the shipped artefact" is here, and why it is not a file copy
 *
 * TPL-001 ships a **prepared directory** (`templates/members-area/`), so its
 * door run copies bytes. This template ships a **`ProjectContent` blob** that
 * the editor instantiates into a new project — `site-builder.content.json` plus
 * the `designTokens` and `securityPolicy` that `EmbeddedTemplateProvider`
 * writes at install. There is no directory on disk to copy.
 *
 * So this reconstructs what a person receives, from the two halves that produce
 * it, and each half is already gated elsewhere rather than re-asserted here:
 *
 * - the graphs come from `authorSiteTemplate` — the same door writes that
 *   generate the committed JSON, and `sb007Template.test.ts` asserts the
 *   committed JSON is byte-identical to that generation. Re-checking it here
 *   would be a second copy of that gate.
 * - the look comes from `buildSiteDesignTokens()` — the same function
 *   `site-builder.template.ts` passes as `designTokens`, written into
 *   `metadata.designTokens`, which is the key `EmbeddedTemplateProvider:148`
 *   writes and the deploy stamps into `:root`.
 *
 * 🔴 **Without that second half the door render would be a lie in the flattering
 * direction**: SBR-003's whole point is that a never-claimed, zero-record site
 * already wears Studio. A door run with no tokens would photograph a greyer
 * product than ships, and the phase would go and "fix" a defect nobody has.
 *
 * ⚠️ The public site is a catch-all at `{slug}` and reads every word it displays
 * out of records, so **the door state is expected to have nothing to say**. That
 * is not a harness failure — it is the first thing a person sees after choosing
 * this template, and VIB-009 owns whatever the picture turns out to be.
 */
import * as fs from 'fs';
import * as path from 'path';

import { buildSiteDesignTokens } from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { judge, today } from './helpers/judge';
import { clickButton, fill } from './helpers/members-drive';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  DRAFT_ACL,
  makeSiteDataDir,
  SITE_SECURITY
} from './helpers/site-drive';

jest.setTimeout(1800000);

const SETUP_TOKEN = 'vib001-site-token-6b2e91';
const OWNER = { email: 'owner@example.invalid', password: 'pw-owner' };
const CONTACT_TO = 'owner@example.invalid';
const DATE = today();

interface Row {
  objectId: string;
  [field: string]: unknown;
}

/**
 * The install step the editor performs and `authorSiteTemplate` does not.
 *
 * Mirrors `EmbeddedTemplateProvider.instantiate`: the template's `designTokens`
 * go into project metadata under the key the style panel persists to, which is
 * where the preview injector and the deploy's `:root` stamp both read them.
 */
function applyTemplateDesignTokens(projectDir: string): void {
  const file = path.join(projectDir, 'nodegx.project.json');
  const project = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  const metadata = (project.metadata as Record<string, unknown>) ?? {};
  metadata.designTokens = buildSiteDesignTokens();
  project.metadata = metadata;
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
}

describe('VIB-001 — the site builder, as a person meets it', () => {
  it('photographs the door: the template as installed, no backend, never claimed', async () => {
    const projectDir = await authorSiteTemplate('vib001-site-door');
    applyTemplateDesignTokens(projectDir);

    // 🔴 A known-firing signal beside the "the door has nothing to say" reading
    // that is about to be recorded: the tokens ARE on the project. Without this
    // an unstyled render and an untokened harness look identical in the picture.
    const installed = JSON.parse(fs.readFileSync(path.join(projectDir, 'nodegx.project.json'), 'utf-8')) as {
      metadata?: { designTokens?: { customTokens?: unknown[] } };
    };
    expect((installed.metadata?.designTokens?.customTokens ?? []).length).toBeGreaterThan(0);

    const run = await judge({
      task: 'vib-001',
      subject: 'site-builder',
      state: 'door',
      projectDir,
      date: DATE,
      pages: [
        { label: 'public-home', url: '/', as: 'the public site, before anything is written' },
        { label: 'admin-setup', url: '/admin/setup', as: 'the owner, first run' },
        { label: 'admin-signin', url: '/admin/signin', as: 'the owner coming back' },
        { label: 'admin-pages', url: '/admin/pages', as: 'the panel, unauthenticated' }
      ]
    });
    expect(run.shots.length).toBe(16);
    // eslint-disable-next-line no-console
    console.log('SITE DOOR MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });

  it('photographs the living state: claimed, themed, two pages published', async () => {
    const projectDir = await authorSiteTemplate('vib001-site-living');
    applyTemplateDesignTokens(projectDir);
    const dataDir = makeSiteDataDir(
      bundleAuthoredComponents(
        projectDir,
        SB004_COMPONENTS.map((c) => c.key)
      ),
      { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO },
      SITE_SECURITY,
      'vib001-site'
    );
    const service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'vib001-site',
      backendName: 'VIB-001 site'
    });
    const started = await service.start();
    const client = httpClient(() => started.listen.url);
    // Row-level ACL on: with it off this template leaks every draft and still
    // looks correct, so every picture below would be of a different product.
    expect(started.security.enforced).toBe(true);
    bindProjectToBackend(projectDir, 'vib001-site', started.listen.port);

    // 🔴 An email-shaped username, because the SignIn page's `Email` field feeds
    // the `LogIn` node's username port. A `vib001-site-owner` account would be
    // claimable over HTTP and unreachable through the form the product ships,
    // and the panel pictures would silently be of the signed-out state.
    const user = await client.post<{ objectId: string; sessionToken: string }>('/users', {
      username: OWNER.email,
      password: OWNER.password
    });
    const owner = { 'x-parse-session-token': user.json.sessionToken };
    const claimed = await client.post<{ result?: { claimed?: boolean } }>(
      '/functions/claimSite',
      { setupToken: SETUP_TOKEN },
      owner
    );
    expect(claimed.json.result?.claimed).toBe(true);

    // `claimSite` writes both singletons; the panel UPDATES them, and so does
    // this — creating a second row renders `rows[0]`, which is the claim's.
    const settingsRows = await client.get<{ results: Row[] }>('/classes/SiteSettings', owner);
    await client.put(
      `/classes/SiteSettings/${settingsRows.json.results[0].objectId}`,
      { siteName: 'Kestrel Joinery', homeSlug: 'home' },
      owner
    );
    const themeRows = await client.get<{ results: Row[] }>('/classes/Theme', owner);
    await client.put(
      `/classes/Theme/${themeRows.json.results[0].objectId}`,
      {
        tokens: {
          colorPrimary: '#1f6feb',
          colorOnPrimary: '',
          colorBackground: '#fffdf7',
          colorSurface: '',
          colorText: '#12202e',
          colorTextSoft: '',
          colorBorder: '',
          colorAccentSoft: '',
          radius: '',
          fontDisplay: 'Georgia, serif',
          fontUi: '',
          measure: ''
        }
      },
      owner
    );

    /**
     * 🔴 **Every section kind the template supports, not just the dull one.**
     *
     * The first version of this seed wrote `kind: 'richText'` for every section,
     * and the resulting picture — a stack of prose blocks — would have been a
     * verdict about *the seed*, not the product. `SECTION_VIEW`'s script
     * dispatches on four kinds (`sb006Components.ts`), so a page built only of
     * the plainest one photographs a ceiling the template does not actually have.
     *
     * ⚠️ `data.image` is a `cloudfile` read through `.url`. A real owner uploads
     * a file and gets a backend URL; this seeds a renderable `data:` URI, which
     * exercises the same render path with a different URL source. Stated because
     * it is the one place this seed is not what a person would have.
     */
    const SWATCH =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">' +
          '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#2b3a2f"/><stop offset="1" stop-color="#8a7f5c"/>' +
          '</linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/></svg>'
      );

    const makePage = async (
      title: string,
      slug: string,
      navOrder: number,
      sections: Array<{ kind: string; data: Record<string, unknown> }>
    ): Promise<string> => {
      const page = await client.post<Row>(
        '/classes/Page',
        { ACL: DRAFT_ACL, title, slug, published: false, showInNav: true, navOrder, seoDescription: `${title}.` },
        owner
      );
      for (let i = 0; i < sections.length; i++) {
        await client.post(
          '/classes/Section',
          { ACL: DRAFT_ACL, kind: sections[i].kind, order: i, data: sections[i].data, pageId: page.json.objectId },
          owner
        );
      }
      return page.json.objectId;
    };
    const home = await makePage('Welcome', 'home', 1, [
      {
        kind: 'hero',
        data: {
          body: 'Stairs, windows and doors, out of oak, ash and elm.',
          image: { url: SWATCH }
        }
      },
      {
        kind: 'richText',
        data: {
          body:
            'Three of us work behind the station, in a shop that has been a joinery since 1911. ' +
            'We cut our own joints, we finish by hand, and we will tell you honestly when a repair ' +
            'is the better answer than a replacement.'
        }
      },
      { kind: 'gallery', data: { image: { url: SWATCH } } },
      { kind: 'cta', data: { body: 'Come and see the workshop — Thursdays, or by arrangement.' } }
    ]);
    const about = await makePage('About the workshop', 'about', 2, [
      {
        kind: 'hero',
        data: { body: 'Forty years of joints that have not moved.', image: { url: SWATCH } }
      },
      {
        kind: 'richText',
        data: { body: 'We took the shop on in 1986 and have not changed the way it works since.' }
      }
    ]);
    // Published through the product's own endpoint, not by typing an ACL.
    for (const id of [home, about]) {
      const res = await client.post('/functions/publishPage', { pageId: id, publish: true }, owner);
      expect(res.status).toBe(200);
    }

    /**
     * REL-011b AC3 — two enquiries, so `/admin/messages` is photographed holding
     * something.
     *
     * 🔴 Through `submitContactForm` as an anonymous visitor, which is the only
     * door to that class (`ContactMessage.create` is `nobody` for everyone,
     * SB-004 §4). Seeding rows by POSTing them would be a picture of a state the
     * product cannot reach — and would fail, which is the point.
     *
     * ⚠️ The empty state of that screen is not lost by this: it is what the DOOR
     * arm's `/admin/pages` is of, and `sbr010Messages` grades the words.
     */
    for (const enquiry of [
      {
        name: 'Marion Ackroyd',
        email: 'marion@example.invalid',
        message: 'Could you re-hang a sash window that has dropped about an inch on one side?',
        pageSlug: 'home'
      },
      {
        name: 'Ted Whitlow',
        email: 'ted@example.invalid',
        message: 'Do you take on small jobs? I have one internal door that will not close.',
        pageSlug: 'about'
      }
    ]) {
      const res = await client.post('/functions/submitContactForm', enquiry);
      expect(res.status).toBe(200);
    }

    try {
      const run = await judge({
        task: 'vib-001',
        subject: 'site-builder',
        state: 'living',
        projectDir,
        backendPort: started.listen.port,
        date: DATE,
        pages: [
          { label: 'public-home', url: '/', as: 'the published home page, as a visitor' },
          { label: 'public-about', url: '/about', as: 'a second published page' },
          { label: 'admin-pages', url: '/admin/pages', as: 'the panel (recorded debt: judge for clarity)' },
          { label: 'admin-theme', url: '/admin/theme', as: 'the theme editor' },
          // 🔴 REL-011b AC3. These two routes had NEVER been photographed, on any
          // date, in any state — and `/admin/page/{pageId}` is the screen a client
          // spends their time in. D40 hid whatever is below the first screen for
          // the life of this template, so REL-011c could not be scoped without
          // them.
          { label: 'admin-page', url: `/admin/page/${home}`, as: 'the page editor, on a published page with four sections' },
          { label: 'admin-messages', url: '/admin/messages', as: 'the enquiries, with two in the list' }
        ],
        prepare: async (page) => {
          // 🔴 Through the page's own form, never by writing a token into the
          // browser: the session the pictures are taken with has to be the one
          // this template's `LogIn` node put there.
          await page.navigate('/admin/signin');
          await fill(page, 'Email', OWNER.email);
          await fill(page, 'Password', OWNER.password);
          await clickButton(page, 'Sign in');
          await new Promise((r) => setTimeout(r, 2500));
          const signedIn = await page.evaluate(`(function () {
            for (var i = 0; i < localStorage.length; i++) {
              var k = localStorage.key(i);
              if (k.indexOf('Parse/') === 0 && k.indexOf('currentUser') > 0) return 'yes';
            }
            return 'no';
          })()`);
          if (String(signedIn) !== 'yes') {
            throw new Error('the owner could not sign in — the panel pictures would be of the signed-out state');
          }
        }
      });
      // 16 → 24 with REL-011b AC3's two routes, at the same four widths.
      expect(run.shots.length).toBe(24);
      // eslint-disable-next-line no-console
      console.log('SITE LIVING MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
    } finally {
      await service.stop();
    }
  });
});
