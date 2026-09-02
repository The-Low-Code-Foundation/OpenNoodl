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
import { placeStarterAssets } from './judge';
import type { RenderedPage } from './site-drive';

/** The repo root, from `packages/nodegx-backend/tests/helpers`. */
const REPO = path.join(__dirname, '..', '..', '..', '..');

/** The prepared directory a person receives. */
/**
 * The artefact every members-area drive renders.
 *
 * 🔴 **`TPL001_TEMPLATE_DIR` overrides it, and REL-010 is why it exists.** That
 * row's before/after is read off one harness, and §3 of the task requires
 * *"before/after on one instrument, or it does not count"*. On 2026-09-02 the
 * baseline was taken on `noodl.viewer.js` md5 `8c0ad51b…` and a peer's webpack
 * rebuilt the bundle to `e35ea918…` **between the two runs** — the register row
 * R3 exactly (*"nothing in a vib-001 render manifest pins the runtime"*), only
 * live rather than historical.
 *
 * Re-taking the baseline needs the artefact as it was AND the runtime as it is,
 * and those two live in different places: the artefact is in git, the runtime is
 * on disk. So the override points a run at a `git archive` of the committed
 * template while the viewer stays whatever it currently is.
 *
 * ⚠️ **Unset, this is exactly what it always was.** Every other drive suite
 * reads the same constant and none of them passes the variable, so the default
 * path is not a new code path — it is the only one they take.
 */
export const TEMPLATE_DIR = process.env.TPL001_TEMPLATE_DIR
  ? path.resolve(process.env.TPL001_TEMPLATE_DIR)
  : path.join(REPO, 'templates', 'members-area');

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

/**
 * A copy of the shipped artefact **plus the assets a real install has**, which
 * is what gets served.
 *
 * 🔴 **The starter assets were NOT placed here until REL-010, and the drive was
 * therefore rendering a project nobody receives.** A template directory is not a
 * project: `STARTER_ASSETS` — Inter, the 1,998 Lucide glyphs and the 44 CC0
 * photographs — is put into every project by the installer, and the template
 * submission's excluded-files list is *derived from that same constant*, so the
 * artefact **references** `noodl_modules/starter-imagery/…` and deliberately
 * ships none of the bytes. Copy the directory alone and every one of those
 * references 404s.
 *
 * 🔴 **It was invisible for six sessions because of WHICH KIND of reference the
 * template had.** Its only asset reference was a `backgroundImage` on the hero
 * Group, and a CSS background that fails to load **logs nothing**. REL-010 added
 * the template's first real `Image` nodes, an `<img>` that 404s **does** log,
 * and §1's *"logged nothing"* assertion went red with three
 * `image/load-failed` lines — for a defect in this helper that predates them.
 *
 * ⚠️ **This is the same reading, from the other side, as REL-010 §2.1**: the
 * poverty instrument cannot SEE a CSS background, and this drive cannot HEAR
 * one. A photograph carried as a background is invisible to both, and the
 * template carried all of its photography that way.
 *
 * ✅ `placeStarterAssets` is imported rather than reimplemented — `judge.ts`
 * owns the one copy, and `starterAssetList.ts` exists precisely so that a second
 * list cannot drift. **`failed` throws**: a harness that quietly installed four
 * of the five things a real project has would photograph a project nobody owns
 * and report nothing.
 */
export function copyTemplateProject(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-project-`));
  fs.cpSync(TEMPLATE_DIR, dir, { recursive: true });
  const placed = placeStarterAssets(dir);
  if (placed.failed.length) throw new Error(`starter assets failed: ${placed.failed.join(', ')}`);
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
  /**
   * In the rendered tree — painted or not. **Scripts and styles excluded**; see
   * the note in `SENTENCE`, without which this was true of every sentence in
   * the template on every page.
   */
  present: boolean;
  painted: boolean;
}

const SENTENCE = (text: string) => `(function () {
  var needle = ${JSON.stringify(text)};
  /**
   * 🔴 NOT \`document.querySelectorAll('*')\`. \`render-from-disk.js:452\` inlines the
   * whole project as \`window.projectData\` in a \`<script>\` in the body, and a
   * script element's \`textContent\` is its source — so every sentence the
   * template is authored out of matched, on every page, and \`present\` was true
   * for a page that had rendered none of them. Scripts and styles are not
   * content and never were; excluding them is what makes \`present\` mean what
   * this interface says it means.
   */
  var all = Array.prototype.slice.call(document.querySelectorAll('body *')).filter(function (el) {
    return el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'NOSCRIPT';
  });
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

// ── The tick box ─────────────────────────────────────────────────────────────

/**
 * What the one box on `Pages/Account` looks like from outside it.
 *
 * 🔴 **`checked` and `marked` are two different readings, and TPL-002's opt-in
 * ruling is about the second.** `input.checked` is the control's state;
 * `marked` is whether a person can SEE a tick. They come apart: the real
 * `<input>` is `opacity: 0` (`assets/style.css`), so every mark this control
 * draws comes from `Checkbox.tsx`'s `_renderDefaultCheck` — which returns null
 * unless `useIcon` is on. A box whose state is `true` and whose mark is absent
 * is FB-020 exactly, and two users reported that as *"the box cannot be
 * checked"*. Asserting only `checked` would pass on it.
 *
 * 🔴 **`labelIsTarget` is the reading that says a phone can use this.** The
 * checkbox's own `label` port emits `<label htmlFor>`, which makes the words a
 * click target; a label drawn as a separate `Text` node does not, and then the
 * only way to opt in is to hit the box itself. `useLabel` **defaults false**
 * (`node-shared-port-definitions.ts:1440`), so this is what the difference is
 * measured on rather than assumed from the graph.
 */
export interface Box {
  present: boolean;
  /** It has a box and is not `visibility: hidden` — see `sentence`. */
  painted: boolean;
  /** `input.checked` — the control's state. */
  checked: boolean;
  /** A tick a person can see: the default check, an icon, or an image. */
  marked: boolean;
  /** Its own hit area, in CSS px. WCAG 2.2 SC 2.5.8 asks for 24×24. */
  width: number;
  height: number;
  /** Is the sentence beside it a click target — i.e. did it come from `label`? */
  labelIsTarget: boolean;
  x: number;
  y: number;
}

const BOX = `(function () {
  var el = document.querySelector('input[type=checkbox]');
  if (!el) return JSON.stringify({ present: false, painted: false, checked: false, marked: false,
    width: 0, height: 0, labelIsTarget: false, x: 0, y: 0 });
  var r = el.getBoundingClientRect();
  var cs = window.getComputedStyle(el);
  // The wrapper is what draws the mark — the input itself is transparent.
  var wrap = el.parentElement;
  var marked = !!(wrap && (wrap.querySelector('[data-ndl-default-check]') || wrap.querySelector('img') ||
    wrap.querySelector('svg')));
  return JSON.stringify({
    present: true,
    painted: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
    checked: !!el.checked,
    marked: marked,
    width: Math.round(r.width), height: Math.round(r.height),
    // A <label for> pointing at this input, or an ancestor <label> wrapping it.
    labelIsTarget: !!(el.id && document.querySelector('label[for="' + el.id + '"]')) || !!el.closest('label'),
    x: r.left + r.width / 2, y: r.top + r.height / 2
  });
})()`;

export async function readBox(page: RenderedPage): Promise<Box> {
  return JSON.parse(String(await page.evaluate(BOX))) as Box;
}

/**
 * Tick or untick the box with a real trusted click at its centre.
 *
 * 🔴 `Input.dispatchMouseEvent`, not `el.click()`: the box's `onChange` is a
 * native change event, and the runtime's `checkedChanged` hangs off it. A
 * synthetic `click()` would fire it too, but it would also make this the only
 * control in the drive not exercised the way a person exercises it — and
 * FB-020's bug lived precisely in the user-click path while the setter path
 * stayed correct.
 */
export async function clickBox(page: RenderedPage): Promise<void> {
  const box = await readBox(page);
  if (!box.present) throw new Error('no checkbox on this page');
  if (!box.painted) throw new Error(`the checkbox is not painted: ${JSON.stringify(box)}`);
  await clickAt(page, box.x, box.y);
}
