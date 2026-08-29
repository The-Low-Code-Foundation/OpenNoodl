/**
 * TPL-001 — the members' area drive harness.
 *
 * 🔴 **It drives the SHIPPED ARTEFACT, not a re-authoring of it.**
 * `helpers/site-drive.ts` authors the site builder through the MCP door on every
 * run, because that template's product IS the authoring. This one is different:
 * TPL-001's product is a **prepared project directory** that a person receives
 * byte for byte (`templates/members-area/`), and `tpl001Template.test.ts`
 * already gates that the directory is what the door writes. So the honest
 * subject here is the directory itself — copied, bound, and served. If the
 * generator and the artefact ever disagree, the byte gate reddens; this suite
 * would otherwise measure a project nobody is given.
 *
 * ## The four conditions that make this a measurement rather than a demo
 *
 * 🔴 **1. `devOpen: false`, from the shipped policy file.** `devOpenActive`
 * disables row-level ACL entirely, and TPL-001's whole product is who may read
 * what. `started.security.enforced` is asserted before anything else. The policy
 * is `require`d from `templates/members-area.security.json` — the same file the
 * generator copies into the artefact — so what is measured is what a person
 * gets.
 *
 * 🔴 **2. Nobody is created by the harness.** `signup: "nobody"` in that policy
 * means `POST /users` is refused, so every account in this drive is minted the
 * way the product mints them: the moderator through `claimAssociation` against
 * the backend secret, every other person through `requestAccess`. A harness that
 * created its own users would be measuring a flow the template does not have.
 *
 * 🔴 **3. The browser signs in through the app's own form.** No session token is
 * ever written into the page. `signIn` types into the two `<input>`s the SignIn
 * page renders and clicks the button it renders, so the session the browser
 * holds is the one the product's Log In node put there.
 *
 * 🔴 **4. Every absence is read beside a known-firing signal.** `readVisit` is
 * imported from `site-drive.ts` rather than re-written, and it reads
 * `document.documentElement.outerHTML` as well as `innerText`. `innerText`
 * reports only what was painted, so an absence checked on it alone would pass on
 * a page that was carrying the announcements and merely not painting them.
 *
 * ⚠️ Since D7/D16 this template **unmounts** rather than hides — every gate is
 * `mounted`, so gated content is not in the document at all. The `outerHTML`
 * discipline is kept because it is what makes that claim checkable, and it is
 * the reading that would catch a regression to `visible`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { bundleAuthoredComponents, WorkflowBundle } from './authored-bundle';
import type { RenderedPage } from './site-drive';

/** The repo root, from `packages/nodegx-backend/tests/helpers`. */
const REPO = path.join(__dirname, '..', '..', '..', '..');

/** The prepared directory a person receives. */
export const TEMPLATE_DIR = path.join(REPO, 'templates', 'members-area');

/**
 * The shipped policy — read from the **source** file the generator copies in,
 * not retyped.
 *
 * ⚠️ It is deliberately the file beside the artefact rather than the copy inside
 * it: they are byte-identical by the gate's own assertion, and reading the
 * source says which one is authoritative.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const MEMBERS_SECURITY = require(path.join(REPO, 'templates', 'members-area.security.json')) as Record<
  string,
  unknown
>;

/**
 * Every endpoint the shipped artefact carries, in registry-key form, **derived
 * from disk**.
 *
 * 🔴 **This was a hand-written list of four, and TPL-002 found out how it
 * fails.** Adding `myNotifySetting`, `setNotifySetting`, `unsubscribe` and
 * `notifyMembers` to the template left this constant unchanged, so the bundle a
 * drive loads held four of eight — and every call to a new one answered **404**,
 * which reads exactly like an endpoint that is broken rather than one that was
 * never deployed. Nothing in the harness could have said which.
 *
 * ⚠️ It is the same class as the frozen-fixture trap: a constant that presumes
 * the live side only ever agrees with it. The directory IS the list, so this
 * reads the directory — and a ninth function is bundled by existing.
 */
export const CLOUD_KEYS = fs
  .readdirSync(path.join(TEMPLATE_DIR, 'components', '__cloud__'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `__cloud__/${e.name}`)
  .sort();

/** The secret the setup flow compares against. Machine-local, never a project file. */
export const SETUP_TOKEN = 'tpl001-setup-token-4f1ac9';

/** A copy of the shipped artefact, which is what gets served. */
export function copyTemplateProject(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-project-`));
  fs.cpSync(TEMPLATE_DIR, dir, { recursive: true });
  return dir;
}

/** Every cloud component the artefact carries, in the bundle shape a backend loads. */
export function bundleMembersCloud(projectDir: string): WorkflowBundle {
  return bundleAuthoredComponents(projectDir, CLOUD_KEYS);
}

/**
 * A data directory holding the deployed bundle, ready to `start()`.
 *
 * ⚠️ `security.json` is written **before** start(): `SecurityState` reads it in
 * its constructor, and a config applied afterwards leaves the boot dev-open —
 * which for this template means every pending member reads everything.
 */
export function makeMembersDataDir(
  bundle: WorkflowBundle,
  label: string,
  security: Record<string, unknown> | null = MEMBERS_SECURITY,
  secrets: Record<string, string> = { ASSOCIATION_SETUP_TOKEN: SETUP_TOKEN }
): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-data-`));
  fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'workflows', 'members.workflow.json'), JSON.stringify(bundle));
  if (security !== null) fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(security));
  fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ functions: secrets }));
  return dataDir;
}

// ── Driving the browser ──────────────────────────────────────────────────────

/**
 * What one control on the page looks like from outside it.
 *
 * 🔴 **`text` and `label` are two different readings and the difference is the
 * whole point.** `innerText` reports only painted text while `textContent`
 * reports everything in the markup. So a spec asserting "the member was not
 * offered Post something" against `innerText` alone passes for a reason it never
 * established: the button could be on the page and merely unpainted — which is
 * exactly what this template did before D7/D16, when its moderator toolbar was
 * gated with `visible: false`.
 *
 * ⚠️ The gates are `mounted` now, so for gated content the two readings agree.
 * They are still taken separately: `label` is what proves the stronger claim —
 * not merely unpainted, but **absent** — and it is the half that goes red first
 * if a gate is ever put back on `visible`.
 *
 * - `text` — `innerText`. What a reader sees. Empty for a hidden control.
 * - `label` — `textContent`. What is in the document, painted or not.
 * - `painted` — it has a layout box. True for a control below the fold, false
 *   for `display: none`.
 * - `reachable` — `elementFromPoint` at the control's own centre, **at the
 *   current scroll position**. A rendered element can sit behind a blocker, and
 *   a click that lands on the blocker reports success and does nothing.
 *
 * 🔴 **An absence claim belongs on `painted`, never on `reachable`.**
 * `elementFromPoint` answers `null` for any coordinate outside the viewport, so
 * "not reachable" is also true of a perfectly ordinary button four hundred
 * pixels further down — and "the member was not offered Post something" must not
 * be satisfiable by scrolling. `reachable` is for aiming a click; `painted` is
 * for saying what a person is shown.
 */
export interface Control {
  index: number;
  text: string;
  label: string;
  x: number;
  y: number;
  painted: boolean;
  reachable: boolean;
}

const CONTROLS = (selector: string) => `(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll(${JSON.stringify(selector)}));
  return JSON.stringify(els.map(function (el, i) {
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var painted = r.width > 0 && r.height > 0;
    var hit = painted ? document.elementFromPoint(x, y) : null;
    return {
      index: i,
      text: (el.innerText || el.value || el.getAttribute('placeholder') || '').trim(),
      label: (el.textContent || el.value || el.getAttribute('placeholder') || '').trim(),
      x: x, y: y,
      painted: painted,
      reachable: !!hit && (hit === el || el.contains(hit) || hit.contains(el))
    };
  }));
})()`;

export async function controls(page: RenderedPage, selector: string): Promise<Control[]> {
  return JSON.parse(String(await page.evaluate(CONTROLS(selector)))) as Control[];
}

/**
 * What this person is shown: it has a box and it has text. Scroll-independent —
 * see the note on `painted` above.
 */
export const offered = (cs: Control[]): string[] => cs.filter((c) => c.painted && c.text).map((c) => c.text);

/**
 * What is in their document at all — `textContent`, so hidden and unpainted
 * content counts. An element that is **unmounted** is not in the document and so
 * not here either, which is what makes this the reading D7/D16 is graded on.
 */
export const present = (cs: Control[]): string[] => cs.map((c) => c.label).filter(Boolean);

/**
 * Is this sentence **in** the document, and is it **painted**?
 *
 * 🔴 **The two are different and AC6 is about the second.** Every empty state in
 * this template is revealed by a gate. While those gates were `visible` the
 * words were in the markup from the first paint — `document.body.textContent`
 * contained "Nothing has been posted yet" on a page showing a full noticeboard,
 * so an assertion on presence would have passed on every arm and measured
 * nothing. The gates are `mounted` now and the two readings agree for gated
 * content, but the distinction is what the helper exists to keep visible.
 *
 * 🔴 **`painted` is NOT "has a layout box", and the first version of this helper
 * was.** The `visible` port hides with **`visibility: hidden`**
 * (`node-shared-port-definitions.ts:226`), not `display: none` — and a
 * `visibility: hidden` element **keeps its box**. So a rect-only reading called
 * every empty state painted on every arm, and the control arm below reported
 * three defects that do not exist. TPL-001 §8 already carried the rule this
 * broke: *the honest hidden signal is `visibility`*.
 *
 * 🔴 **That box is also the defect D7/D16 fixed** — it is why the Post page drew
 * a heading, ~500px of nothing and a back button. Keeping this note accurate
 * matters even though the template no longer uses the port: it is the reason
 * `mounted` was chosen over the port whose name sounds right.
 *
 * ⚠️ It is also deliberately NOT `elementFromPoint`: an empty state below the
 * fold is being shown to a person who scrolls, and §13 records two false
 * findings that came from confusing "outside the viewport" with "not displayed".
 */
export interface Sentence {
  present: boolean;
  painted: boolean;
}

const SENTENCE = (text: string) => `(function () {
  var needle = ${JSON.stringify(text)};
  var all = Array.prototype.slice.call(document.querySelectorAll('*'));
  var carrying = all.filter(function (el) {
    if ((el.textContent || '').indexOf(needle) === -1) return false;
    // The innermost carriers only: an ancestor contains the sentence too, and
    // an ancestor with a box would report a hidden child as painted.
    return !Array.prototype.some.call(el.children, function (k) {
      return (k.textContent || '').indexOf(needle) !== -1;
    });
  });
  return JSON.stringify({
    present: carrying.length > 0,
    painted: carrying.some(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      // visibility is inherited, so the element's own computed value already
      // answers for every ancestor that hid it; display:none is covered by the
      // zero rect above. (No backticks in here: this is inside a template
      // literal, and one would close it.)
      var cs = window.getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    })
  });
})()`;

export async function sentence(page: RenderedPage, text: string): Promise<Sentence> {
  return JSON.parse(String(await page.evaluate(SENTENCE(text)))) as Sentence;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A real trusted click at a control's centre.
 *
 * `Input.dispatchMouseEvent` rather than `el.click()`: the controls in this
 * template are runtime components whose handlers hang off pointer events, and a
 * synthetic `click()` bypasses focus and `:active` and — where a node listens
 * for `mousedown` — does not fire at all.
 */
export async function clickAt(page: RenderedPage, x: number, y: number): Promise<void> {
  const client = (page as unknown as { client: { send(m: string, p: unknown): Promise<unknown> } }).client;
  for (const type of ['mousePressed', 'mouseReleased']) {
    await client.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      clickCount: 1,
      buttons: type === 'mousePressed' ? 1 : 0
    });
  }
  await wait(1200);
}

/**
 * Click the button whose label reads `label`.
 *
 * 🔴 Throws when the button is absent **or unreachable**, and says which. Those
 * are two different findings — "the moderator's toolbar is not on this page" and
 * "it is on the page behind something" — and a helper that returned false for
 * both would make them the same reading.
 */
export async function clickButton(page: RenderedPage, label: string): Promise<void> {
  const find = async () => (await controls(page, 'button')).filter((b) => b.text === label);
  let found = await find();
  if (found.length === 0) {
    const all = (await controls(page, 'button')).map((b) => b.text);
    throw new Error(`no button labelled "${label}". Buttons on the page: ${JSON.stringify(all)}`);
  }

  /**
   * 🔴 **Unreachable and below-the-fold are not the same failure.**
   * `elementFromPoint` answers `null` for any coordinate outside the viewport,
   * so a button four hundred pixels down reads exactly like one behind a modal.
   * The Post page's second form is below the fold at the default size, and the
   * first version of this helper reported it as *blocked* — a finding about a
   * blocker that does not exist. So: scroll it into view and measure again, and
   * only then call it blocked.
   */
  if (!found.some((b) => b.reachable)) {
    await page.evaluate(`(function () {
      var b = Array.prototype.filter.call(document.querySelectorAll('button'), function (x) {
        return (x.innerText || '').trim() === ${JSON.stringify(label)};
      })[0];
      if (b) b.scrollIntoView({ block: 'center', behavior: 'instant' });
      return !!b;
    })()`);
    await wait(600);
    found = await find();
  }

  const target = found.find((b) => b.reachable);
  if (!target) {
    throw new Error(
      `button "${label}" is rendered and was scrolled to, and still nothing at its centre hits it — ` +
        `it is behind something. Candidates: ${JSON.stringify(found)}`
    );
  }
  await clickAt(page, target.x, target.y);
}

/**
 * Click the button labelled `label` that sits inside the row whose text names
 * `within`.
 *
 * 🔴 The queue draws one Approve and one Decline **per request**, so
 * `clickButton('Approve')` would take whichever the DOM happened to order first
 * — and the whole point of AC5 is that a named person was approved. This walks
 * up from each candidate button to the nearest ancestor carrying `within` in its
 * text, which is the row.
 */
export async function clickButtonInRow(page: RenderedPage, label: string, within: string): Promise<void> {
  const locate = async (scroll: boolean): Promise<string> =>
    String(
      await page.evaluate(`(function () {
      var want = ${JSON.stringify(label)}, who = ${JSON.stringify(within)};
      var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
      /**
       * 🔴 The nearest ancestor naming the person, and it must hold exactly ONE
       * of these buttons. Walking up until the name appears is not enough: keep
       * walking and you reach the list, whose text names everybody — so the
       * first version matched every Approve on the page and reported two hits.
       */
      var hits = buttons.filter(function (b) {
        if ((b.innerText || '').trim() !== want) return false;
        for (var el = b.parentElement; el; el = el.parentElement) {
          if ((el.innerText || '').indexOf(who) < 0) continue;
          var siblings = Array.prototype.filter.call(el.querySelectorAll('button'), function (x) {
            return (x.innerText || '').trim() === want;
          });
          return siblings.length === 1;
        }
        return false;
      });
      if (hits.length !== 1) {
        return 'no:' + hits.length + ':' + JSON.stringify(buttons.map(function (b) { return (b.innerText||'').trim(); }));
      }
      if (${scroll}) hits[0].scrollIntoView({ block: 'center', behavior: 'instant' });
      var r = hits[0].getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var hit = (r.width > 0 && r.height > 0) ? document.elementFromPoint(x, y) : null;
      var reachable = !!hit && (hit === hits[0] || hits[0].contains(hit) || hit.contains(hits[0]));
      return JSON.stringify({ x: x, y: y, reachable: reachable });
    })()`)
    );

  const found = await locate(false);
  if (found.startsWith('no:')) throw new Error(`"${label}" in the row for "${within}" — ${found}`);
  let at = JSON.parse(found) as { x: number; y: number; reachable: boolean };
  // Below the fold reads exactly like blocked — scroll to it before saying so.
  if (!at.reachable) {
    await locate(true);
    await wait(600);
    at = JSON.parse(await locate(false)) as { x: number; y: number; reachable: boolean };
  }
  if (!at.reachable) {
    throw new Error(`"${label}" for "${within}" was scrolled to and is still not hit-testable — it is behind something`);
  }
  await clickAt(page, at.x, at.y);
}

/**
 * Type into the input whose label or placeholder reads `label`.
 *
 * ⚠️ `nth` exists because the Post page draws **two** fields labelled `Title` —
 * one on the announcement form and one on the meeting form. A helper that
 * always took the first would have typed the meeting's title into the
 * announcement and reported success.
 */
export async function fill(page: RenderedPage, label: string, value: string, nth = 0): Promise<void> {
  const client = (page as unknown as { client: { send(m: string, p: unknown): Promise<unknown> } }).client;
  const focused = await page.evaluate(`(function () {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input, textarea'));
    var matches = inputs.filter(function (i) {
      var lbl = i.closest('label') || (i.id && document.querySelector('label[for="' + i.id + '"]'));
      var t = (lbl ? lbl.textContent : '') + ' ' + (i.getAttribute('placeholder') || '') + ' ' + (i.name || '');
      return t.toLowerCase().indexOf(${JSON.stringify(label.toLowerCase())}) >= 0;
    });
    var el = matches[${nth}];
    if (!el) return 'absent:' + matches.length + ':' + JSON.stringify(inputs.map(function (i) {
      var lbl = i.closest('label');
      return (lbl ? lbl.textContent : '') + '|' + (i.getAttribute('placeholder') || '') + '|' + i.type;
    }));
    el.focus();
    el.value = '';
    return 'ok';
  })()`);
  if (String(focused).startsWith('absent')) throw new Error(`no input ${nth} for "${label}" — ${focused}`);
  await client.send('Input.insertText', { text: value });
  await wait(250);
}

/**
 * Sign in through the app's own form, and report the session the page ended up
 * holding.
 *
 * 🔴 The return value is read out of the runtime's own session store rather than
 * inferred from the page having navigated. "The form did something" and "there
 * is a session" are two claims, and this drive needs the second.
 */
export async function signIn(page: RenderedPage, email: string, password: string): Promise<string | null> {
  await page.navigate('/sign-in');
  await fill(page, 'email', email);
  await fill(page, 'password', password);
  await clickButton(page, 'Sign in');
  await wait(2000);
  return currentSession(page);
}

/** Whatever session token the runtime's store holds, or `null`. */
export async function currentSession(page: RenderedPage): Promise<string | null> {
  const raw = await page.evaluate(`(function () {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf('Parse/') === 0 && k.indexOf('currentUser') > 0) {
        try { return JSON.parse(localStorage.getItem(k)).sessionToken || null; } catch (e) { return null; }
      }
    }
    return null;
  })()`);
  return raw === null || raw === undefined ? null : String(raw);
}

/** Drop whatever session the page holds, without reloading it. */
export async function signOut(page: RenderedPage): Promise<void> {
  await page.evaluate(`(function () {
    var doomed = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf('Parse/') === 0) doomed.push(k);
    }
    doomed.forEach(function (k) { localStorage.removeItem(k); });
    return doomed.length;
  })()`);
}
