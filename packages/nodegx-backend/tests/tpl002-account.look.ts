/**
 * TPL-002 — the two pages nobody has looked at, and the band that grew a sixth
 * item, as pictures.
 *
 * 🔴 **This is a harness, not a gate. It asserts almost nothing.** TPL-002 §7
 * closed s14 with one thing owed and named it: *"`Pages/Account` and
 * `Pages/Unsubscribe` are authored, registered, routed and gated, and every
 * endpoint behind them is driven — but nobody has ticked the box on the screen,
 * and nobody has opened the unsubscribe link in a page."* Richard's standing
 * ruling is that appearance is an acceptance criterion graded **by looking at
 * it**, so this runs before the drive rather than after it.
 *
 * ⚠️ **And the band with it.** `BAND_NAV` went from five items to six in s14, in
 * a `gridAutoFit` at `minWidth: 132px` inside a 760px band. TPL-001's own note
 * says five across and the sixth folding — *"arithmetic, not a reading"*. This
 * takes the reading: every nav button's rect, grouped by its top edge, which is
 * what says how many rows there actually are and whether anything is clipped.
 *
 * 🔴 **The moderator and the member see different bands, and only one of them
 * has six items.** Three of the six are `moderatorOnly` and ship `mounted:
 * false`, so a member's band carries Announcements, Meetings and Your account —
 * three. A look taken only as a member would report a band that fits and would
 * have measured the wrong screen. Both are shot.
 *
 * 🔴 **The unsubscribe URL is taken out of the email**, not composed here. The
 * link a person clicks is the one `notifyMembers`' pump wrote into the message
 * body, and a URL retyped in a harness grades the harness. `siteUrl` is the
 * preview server's own origin so that link is openable.
 *
 * ⚠️ **No suite runs it**, and the `.look.ts` suffix is why — `jest.config.js`
 * matches `*.test.ts`. Run it deliberately:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/tpl002-account.look.ts
 *
 * `TPL002_OUT=/some/dir` chooses where the pictures land (default
 * `/tmp/tpl002-look`). Each shot also writes `<label>-<width>.txt` (the page's
 * own text) and, for the band, `<label>-<width>.band.txt` — the nav grid's rows.
 */
import * as fs from 'fs';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';
import { bundleMembersCloud, copyTemplateProject, makeMembersDataDir, SETUP_TOKEN, signIn, signOut } from './helpers/members-drive';
import { bindProjectToBackend, withRenderedPage } from './helpers/site-drive';

jest.setTimeout(900000);

const OUT = process.env.TPL002_OUT || '/tmp/tpl002-look';

const MODERATOR = { name: 'Ruth Bramley', email: 'mod@example.invalid', password: 'pw-moderator' };
/** Ticks the box, on the screen, and is the one the email goes to. */
const MO = { name: 'Mo Joiner', email: 'mo@example.invalid', password: 'pw-mo' };
/** Approved and never ticks it — she is here so the send has somebody to be silent about. */
const ANN = { name: 'Ann Other', email: 'ann@example.invalid', password: 'pw-ann' };

const MEMBERS_READ_ACL = {
  'role:admin': { read: true, write: true },
  'role:member': { read: true, write: false }
};

interface Posted {
  to: string;
  subject: string;
  text: string;
}

describe('TPL-002 — looking at the account page, the unsubscribe page and the band', () => {
  it('writes the pictures', async () => {
    fs.mkdirSync(OUT, { recursive: true });

    const projectDir = copyTemplateProject('tpl002-look');
    const dataDir = makeMembersDataDir(bundleMembersCloud(projectDir), 'tpl002-look');
    // The state an association that HAS configured SMTP is in — `isConfigured()`
    // is what `Mailer.send` checks before it looks at a transport at all.
    fs.writeFileSync(
      path.join(dataDir, 'email.json'),
      JSON.stringify({
        enabled: true,
        smtp: { host: 'smtp.example.invalid', port: 587, secure: false, username: 'assoc' },
        fromAddress: 'noreply@example.invalid',
        fromName: 'St Anywhere'
      })
    );

    const service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'tpl002-look',
      backendName: 'St Anywhere'
    });
    const started = await service.start();
    const base = started.listen.url;
    const client = httpClient(() => base);
    const as = (token: string) => ({ 'x-parse-session-token': token });
    console.log(`ENFORCED ${started.security.enforced}`);

    const posted: Posted[] = [];
    service.getMailerForTesting()!.setTransportForTesting({
      sendMail: async (opts: Record<string, unknown>) => {
        posted.push({
          to: String(opts.to),
          subject: String(opts.subject || ''),
          text: String(opts.text || '')
        });
      }
    });

    bindProjectToBackend(projectDir, 'tpl002-look', started.listen.port);

    // ── Everyone, through the doors the template ships ────────────────────────
    await client.post('/functions/claimAssociation', {
      setupToken: SETUP_TOKEN,
      associationName: 'St Anywhere',
      tagline: 'Meeting on the green since 1894',
      blurb: 'A congregation that meets on Sundays.',
      moderatorName: MODERATOR.name,
      email: MODERATOR.email,
      password: MODERATOR.password
    });
    for (const person of [MO, ANN]) {
      await client.post('/functions/requestAccess', {
        name: person.name,
        email: person.email,
        password: person.password,
        message: `${person.name} would like to join.`
      });
    }
    const login = async (who: { email: string; password: string }): Promise<string> => {
      const res = await client.post<{ sessionToken: string }>('/login', {
        username: who.email,
        password: who.password
      });
      return res.json.sessionToken;
    };
    const mod = await login(MODERATOR);
    const requests = await client.get<{ results: Array<Record<string, unknown>> }>('/classes/MemberRequest', as(mod));
    for (const person of [MO, ANN]) {
      const row = (requests.json?.results ?? []).find((r) => String(r.email) === person.email);
      if (row) await client.post('/functions/decideMembership', { requestId: row.objectId, approve: true }, as(mod));
    }

    // Something for the band to sit above on every page, so no shot below is of
    // an empty state pretending to be a layout.
    for (const [title, body, postedAt] of [
      ['The roof appeal', 'We have raised half of what the roof needs.', '2026-08-20T10:00:00.000Z'],
      ['The harvest supper', 'Saturday the ninth, in the hall, from seven.', '2026-08-18T10:00:00.000Z']
    ]) {
      await client.post('/classes/Announcement', { title, body, postedAt, ACL: MEMBERS_READ_ACL }, as(mod));
    }

    await withRenderedPage({ projectDir, backendPort: started.listen.port }, async (page) => {
      const send = (page as unknown as { client: { send(m: string, p: unknown): Promise<{ data: string }> } }).client;
      const origin = `http://127.0.0.1:${page.servePort}`;

      /** A picture, the page's own text, and — where there is a band — its rows. */
      const shoot = async (label: string, url: string | null, w: number, h: number) => {
        await page.setViewport({ width: w, height: h });
        if (url !== null) await page.navigate(url);
        await new Promise((r) => setTimeout(r, 1600));
        const height = Number(await page.evaluate('document.documentElement.scrollHeight'));
        const shot = await send.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: w, height: Math.min(height, 16384), scale: 1 }
        });
        fs.writeFileSync(path.join(OUT, `${label}-${w}.png`), Buffer.from(shot.data, 'base64'));
        fs.writeFileSync(path.join(OUT, `${label}-${w}.txt`), String(await page.evaluate('document.body.innerText')));

        /**
         * The nav grid, as rows.
         *
         * 🔴 Grouped by rounded `top`, not counted: "six items in a grid" says
         * nothing about how they land, and the whole question is whether the
         * sixth folds tidily or leaves one item alone on a line. `clipped` is
         * the other half — a button whose text is wider than its box is the
         * regression that reduced "Who belongs" to one letter last phase.
         */
        const band = String(
          await page.evaluate(`(function () {
            var btns = Array.prototype.slice.call(document.querySelectorAll('button'));
            // The nav buttons are the ones inside the band's grid: every button
            // whose parent has more than two button children, plus Sign out.
            var rows = {};
            var out = [];
            btns.forEach(function (b) {
              var r = b.getBoundingClientRect();
              if (r.width === 0 && r.height === 0) return;
              var key = Math.round(r.top);
              (rows[key] = rows[key] || []).push({
                t: (b.innerText || '').trim(),
                l: Math.round(r.left), rt: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height),
                clipped: b.scrollWidth > Math.ceil(r.width) + 1
              });
            });
            Object.keys(rows).map(Number).sort(function (a, c) { return a - c; }).forEach(function (top) {
              out.push('y=' + top + '  ' + rows[top].map(function (b) {
                return '[' + b.t + '] ' + b.l + '..' + b.rt + ' w' + b.w + ' h' + b.h + (b.clipped ? ' CLIPPED' : '');
              }).join('  |  '));
            });
            return out.join('\\n');
          })()`)
        );
        fs.writeFileSync(path.join(OUT, `${label}-${w}.band.txt`), band);
        console.log(`SHOT ${label}-${w}.png height=${height}\n${band}`);
      };

      // ── The moderator's band: all six items ───────────────────────────────
      await page.setViewport({ width: 1280, height: 1000 });
      await signIn(page, MODERATOR.email, MODERATOR.password);
      await shoot('mod-members', '/members', 1280, 1000);
      await shoot('mod-members', '/members', 390, 844);
      await shoot('mod-account', '/account', 1280, 1000);
      await shoot('mod-account', '/account', 390, 844);
      await signOut(page);

      // ── The member's band: three items, and the box ───────────────────────
      await page.setViewport({ width: 1280, height: 1000 });
      await signIn(page, MO.email, MO.password);
      await shoot('member-account', '/account', 1280, 1000);
      await shoot('member-account', '/account', 390, 844);

      /**
       * 🔴 **Ticked on the screen, and shot where the click left it.** No
       * navigation between the click and the picture: the confirmation is state
       * the click produced, and reloading `/account` would photograph the boot.
       */
      await page.setViewport({ width: 1280, height: 1000 });
      const ticked = await page.evaluate(`(function () {
        var box = document.querySelector('input[type=checkbox]');
        if (!box) return 'absent';
        var r = box.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height,
          checked: box.checked, opacity: getComputedStyle(box).opacity });
      })()`);
      console.log(`BOX ${ticked}`);
      if (String(ticked) !== 'absent') {
        const at = JSON.parse(String(ticked)) as { x: number; y: number };
        for (const type of ['mousePressed', 'mouseReleased']) {
          await send.send('Input.dispatchMouseEvent', {
            type,
            x: at.x,
            y: at.y,
            button: 'left',
            clickCount: 1,
            buttons: type === 'mousePressed' ? 1 : 0
          });
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      await shoot('member-account-ticked', null, 1280, 1000);

      /**
       * 🔴 **Ticked, then unticked, in one page life — and shot.** This is the
       * picture the drive's §10 is about: a `Condition` only ever pushes its
       * `result` true, so before the clearing conditions the page carried BOTH
       * confirmations at once, one directly under the other. It is the kind of
       * defect a spec that only reads "does it say Saved" cannot see.
       */
      const box2 = await page.evaluate(`(function () {
        var b = document.querySelector('input[type=checkbox]');
        if (!b) return 'absent';
        var r = b.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      })()`);
      if (String(box2) !== 'absent') {
        const at2 = JSON.parse(String(box2)) as { x: number; y: number };
        for (const type of ['mousePressed', 'mouseReleased']) {
          await send.send('Input.dispatchMouseEvent', {
            type,
            x: at2.x,
            y: at2.y,
            button: 'left',
            clickCount: 1,
            buttons: type === 'mousePressed' ? 1 : 0
          });
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      await shoot('member-account-unticked', null, 1280, 1000);
      await shoot('member-account-unticked', null, 390, 844);

      await signOut(page);

      // ── The email, and the link out of it ─────────────────────────────────
      const created = await client.post<{ objectId: string }>(
        '/classes/Announcement',
        {
          title: 'The organ fund',
          body: 'A donor has offered to match what we raise by Christmas.',
          postedAt: '2026-08-29T10:00:00.000Z',
          ACL: MEMBERS_READ_ACL
        },
        as(mod)
      );
      posted.length = 0;
      const answer = await client.post<{ result?: Record<string, unknown> }>(
        '/functions/notifyMembers',
        { announcementId: created.json.objectId, siteUrl: origin },
        as(mod)
      );
      console.log(`NOTIFY ${JSON.stringify(answer.json?.result)}  transport=${posted.length}`);
      for (const m of posted) console.log(`MAIL to=${m.to} subject=${m.subject}\n--- body ---\n${m.text}\n---`);
      fs.writeFileSync(path.join(OUT, 'email.txt'), posted.map((m) => `to: ${m.to}\nsubject: ${m.subject}\n\n${m.text}`).join('\n\n====\n\n'));

      /** The link the message actually carried — not one composed here. */
      const link = (posted[0]?.text.match(/https?:\/\/\S+/) || [''])[0];
      console.log(`LINK ${link}`);

      // ── The unsubscribe page, signed out, from that link ──────────────────
      if (link) {
        const urlPath = link.slice(origin.length);
        await shoot('unsubscribe', urlPath, 1280, 1000);
        await shoot('unsubscribe', urlPath, 390, 844);
      }
      // And the refusal, which is the other half of the page.
      await shoot('unsubscribe-broken', '/unsubscribe?token=not-a-real-token', 1280, 1000);
      await shoot('unsubscribe-none', '/unsubscribe', 1280, 1000);

      // ── Back in, to see whether the box agrees with the link ──────────────
      await page.setViewport({ width: 1280, height: 1000 });
      await signIn(page, MO.email, MO.password);
      await shoot('member-account-after', '/account', 1280, 1000);

      console.log('CONSOLE ERRORS: ' + JSON.stringify(page.consoleErrors));
    });

    await service.stop();
  });
});
