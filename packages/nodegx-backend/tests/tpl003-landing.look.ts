/**
 * TPL-003 — the landing pages, photographed at the door, and the form driven.
 *
 * 🔴 **A harness, not a gate.** `.look.ts` is outside `testMatch`, so this can
 * neither slow a gate down nor redden one. Run it deliberately:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/tpl003-landing.look.ts
 *
 * It does two things the byte gate cannot:
 *
 * 1. **Photographs all three pages at four widths** through the phase-81 Judge,
 *    so a person can look at them. The verdict is theirs.
 * 2. **Drives the two things a landing page has to DO** and asserts on the
 *    consequence, not the wiring: the header's *Get in touch* scrolls the
 *    document to the form, and *Send* composes a `mailto:` link and hands it to
 *    the browser with the message in it. `window.open` is stubbed for the
 *    second so the reading is the URL the app built, not whether a mail client
 *    exists on the box running this.
 *
 * ⚠️ The door state only. This template HAS no other state — there is no
 * backend to bind, which is the product.
 */
import { judge, placeStarterAssets, today } from './helpers/judge';
import { withRenderedPage } from './helpers/site-drive';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(1800000);

const REPO = path.resolve(__dirname, '..', '..', '..');
const TEMPLATE_DIR = path.join(REPO, 'templates', 'landing-pages');
const SHIPPED_PROJECT = path.join(TEMPLATE_DIR, 'nodegx.project.json');
const DATE = today();

/** The shipped directory as a real project: a copy, with the starter assets every creation path installs. */
function copyTemplateProject(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-project-`));
  fs.cpSync(TEMPLATE_DIR, dir, { recursive: true });
  const placed = placeStarterAssets(dir);
  if (placed.failed.length) throw new Error(`starter assets failed: ${placed.failed.join(', ')}`);
  return dir;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Set a React-controlled input's value the way a person typing does. */
const TYPE_INTO = `(function () {
  function setVal(el, v) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  var name = document.querySelector('input[type="text"]');
  var email = document.querySelector('input[type="email"]');
  var message = document.querySelector('textarea');
  if (name) setVal(name, 'Test Person');
  if (email) setVal(email, 'test@example.invalid');
  if (message) setVal(message, 'Hello from the drive.');
  return JSON.stringify({ text: !!name, email: !!email, textarea: !!message });
})()`;

/**
 * Record what the runtime asks the browser to scroll to. 🔴 Headless Chrome
 * does not move `scrollY` for a SMOOTH scroll inside the settle window (the
 * repository's memory has this exact trap), so the call is the gradeable
 * reading and the position is logged beside it.
 */
const HOOK_SCROLL = `(function () {
  window.__scrolledTo = [];
  var orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (arg) {
    window.__scrolledTo.push({ tag: this.tagName, text: (this.innerText || '').slice(0, 40), arg: JSON.stringify(arg) });
    return orig.call(this, { block: 'start' });
  };
  return 'ok';
})()`;

const STUB_OPEN = `(function () {
  window.__opened = null;
  window.open = function (u, t, p) { window.__opened = { u: u, t: t, p: p }; return null; };
  return 'ok';
})()`;

const CLICK = (label: string) => `(function () {
  var b = Array.prototype.slice.call(document.querySelectorAll('button')).find(function (x) { return x.textContent.trim() === ${JSON.stringify(label)}; });
  if (!b) return 'no button ' + ${JSON.stringify(label)};
  b.click();
  return 'clicked';
})()`;

const READ = `JSON.stringify({ opened: window.__opened, scrollY: window.scrollY, scrolledTo: window.__scrolledTo || [], text: document.body.innerText })`;

describe('TPL-003 — the landing pages at the door', () => {
  it('photographs all three pages at four widths', async () => {
    const projectDir = copyTemplateProject('tpl003-door');
    const run = await judge({
      task: 'tpl-003',
      subject: 'landing-pages',
      state: 'door',
      projectDir,
      shippedProjectFile: SHIPPED_PROJECT,
      date: DATE,
      pages: [
        { label: 'freelancer', url: '/', as: 'one person selling a skill' },
        { label: 'business', url: '/business', as: 'a place people visit' },
        { label: 'launch', url: '/launch', as: 'something that does not exist yet' }
      ]
    });
    expect(run.shots.length).toBe(12);
    // eslint-disable-next-line no-console
    console.log('DOOR MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });

  it('🔴 the header scrolls to the form, and Send composes a mailto with the message in it', async () => {
    const projectDir = copyTemplateProject('tpl003-drive');
    await withRenderedPage({ projectDir }, async (page) => {
      await page.setViewport({ width: 1280, height: 900 });
      await page.navigate('/');
      await wait(1500);

      // ── The scroll ──────────────────────────────────────────────────────
      expect(await page.evaluate(HOOK_SCROLL)).toBe('ok');
      const before = JSON.parse(String(await page.evaluate(READ))) as { scrollY: number; scrolledTo: unknown[] };
      expect(before.scrollY).toBe(0);
      expect(before.scrolledTo).toEqual([]);
      expect(await page.evaluate(CLICK('Get in touch'))).toBe('clicked');
      await wait(1500);
      const after = JSON.parse(String(await page.evaluate(READ))) as { scrollY: number; scrolledTo: Array<{ tag: string; text: string }> };
      // The runtime asked the browser to bring the contact band into view — and
      // the band, not the header or the page.
      expect(after.scrolledTo).toHaveLength(1);
      expect(after.scrolledTo[0].text.toLowerCase()).toContain('get in touch');
      // eslint-disable-next-line no-console
      console.log('SCROLL after Get in touch: scrollY=' + after.scrollY + ' target=' + JSON.stringify(after.scrolledTo[0]));

      // ── The empty form refuses, and opens nothing ────────────────────────
      expect(await page.evaluate(STUB_OPEN)).toBe('ok');
      expect(await page.evaluate(CLICK('Send'))).toBe('clicked');
      await wait(600);
      const refused = JSON.parse(String(await page.evaluate(READ))) as { opened: unknown; text: string };
      expect(refused.opened).toBeNull();
      expect(refused.text).toContain('Please fill in all three boxes first.');

      // ── The filled form composes the mail ────────────────────────────────
      // 🔴 The three controls are ALSO the check that the Field component's
      // wired `type` took: a text input, an email input and a textarea.
      const typed = JSON.parse(String(await page.evaluate(TYPE_INTO))) as { text: boolean; email: boolean; textarea: boolean };
      expect(typed).toEqual({ text: true, email: true, textarea: true });
      expect(await page.evaluate(CLICK('Send'))).toBe('clicked');
      await wait(600);
      const sent = JSON.parse(String(await page.evaluate(READ))) as { opened: { u: string; t: string } | null; text: string };
      expect(sent.opened).not.toBeNull();
      const url = sent.opened!.u;
      expect(url.startsWith('mailto:EDIT ME')).toBe(true);
      expect(decodeURIComponent(url)).toContain('subject=Website enquiry from Test Person');
      expect(decodeURIComponent(url)).toContain('Hello from the drive.');
      expect(decodeURIComponent(url)).toContain('test@example.invalid');
      // In place, not a new tab: a mailto in `_blank` leaves a blank tab behind.
      expect(sent.opened!.t).toBe('_self');
      expect(sent.text).toContain('Your mail app should have opened');
      expect(sent.text).not.toContain('Please fill in all three boxes first.');

      expect(page.consoleErrors).toEqual([]);
    });
  });
});
