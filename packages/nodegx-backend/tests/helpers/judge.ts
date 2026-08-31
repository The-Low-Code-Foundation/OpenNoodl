/**
 * VIB-001 — **The Judge**. The instrument every phase-81 task closes through.
 *
 * 🔴 **It has no pass/fail of its own.** It renders real pages of real artefacts
 * and writes PNGs and a manifest. The verdict is written afterwards, by a
 * session that has LOOKED at the picture, into the task file. Phase 81's whole
 * method is that no proxy closes a task, and an instrument that returned
 * `expect(...).toBe(true)` would immediately become one.
 *
 * ## What it is defending against
 *
 * Two templates shipped through fully green gates and were unusable-looking when
 * Richard opened them. The diagnosis (README §1) found the instruments had
 * graded a different world: **every** drive provisioned a backend, seeded it and
 * signed a user in before the first paint, at 1280 and 390 only — and one raised
 * its viewport to 1600px tall so a form would clear the fold. The state a person
 * actually meets (open the project, press preview, no backend, wide window) was
 * rendered by nothing.
 *
 * So three things here are structural rather than advisory:
 *
 * 🔴 **1. `shoot()` takes no viewport.** {@link VIEWPORTS} is frozen and every
 * shot walks all four. A call site cannot pick a flattering width, cannot skip
 * the absurd one, and cannot raise a height to make content fit — the parameter
 * to do it with does not exist. P78's `height: 1600` is unwritable through this
 * API.
 *
 * 🔴 **2. The state is asserted, not asserted-to.** `state: 'door'` *refuses* a
 * `backendPort`, *refuses* a `prepare` step, and throws if the project file
 * carries `metadata.cloudservices` — and it md5s the project file before and
 * after the run, against the shipped file where one is named. A door run that
 * had quietly been bound would throw rather than produce a screenshot with the
 * wrong label under it. (VIB-001 AC2.)
 *
 * 🔴 **3. The fold is recorded as a finding.** Every shot carries `contentBottom`,
 * `canScroll` and `unreachablePx`. Content below a fold that nothing can scroll
 * to is the members-area defect exactly, and it is now a number in the manifest
 * next to the picture rather than something a taller viewport hid.
 *
 * ⚠️ The manifest is the thing that makes a verdict checkable later: page, state,
 * viewport, the artefact's md5 and the HEAD sha. A verdict about a screenshot
 * whose subject cannot be identified is a verdict about nothing — and so is one
 * about an uncommitted pixel, which is why the output lands under `dev-docs/`
 * (checked with `git check-ignore`: not ignored) rather than in `/tmp`.
 *
 * @module nodegx-backend/tests/helpers/judge
 */
import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { RenderedPage } from './site-drive';
import { withRenderedPage } from './site-drive';

/** The repo root, from `packages/nodegx-backend/tests/helpers`. */
const REPO = path.join(__dirname, '..', '..', '..', '..');

/** Where verdict evidence lives, beside the task files that cite it. */
export const VERDICTS_ROOT = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'verdicts');

/**
 * The four widths, frozen.
 *
 * 🔴 **`preview` is not a joke.** 988×313 is what the editor's preview pane is
 * until someone picks a device, so it is the first render of every project ever
 * made here. A page that turns to soup at that size turns to soup in the moment
 * the author is deciding whether this tool is any good.
 *
 * ⚠️ `wide` is 1900 because that is roughly what Richard drove at, and it is the
 * width where the `flexGrow:100` growers misbehave most visibly — a viewport
 * ceiling they were sized against at 1280 stops being one.
 */
export const VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'preview', width: 988, height: 313, mobile: false }),
  Object.freeze({ id: 'desktop', width: 1280, height: 900, mobile: false }),
  Object.freeze({ id: 'wide', width: 1900, height: 1080, mobile: false }),
  Object.freeze({ id: 'phone', width: 390, height: 844, mobile: true })
]) as readonly Readonly<{ id: string; width: number; height: number; mobile: boolean }>[];

/**
 * The two honest states.
 *
 * `door` — the artefact exactly as shipped: no backend bound, nothing seeded,
 * nobody signed in. The state every new user, every screenshot and every
 * reviewer meets first, and the one P76 and P78 never rendered.
 *
 * `living` — provisioned, seeded with honest sample content, signed in. The only
 * state the old instruments ever saw.
 */
export type JudgeState = 'door' | 'living';

/** One page to shoot. `url` is a real route on the served project. */
export interface JudgePage {
  /** File-name-safe label, e.g. `landing`. */
  label: string;
  /** The route, e.g. `/` or `/members`. */
  url: string;
  /** What a person is meant to be doing here — carried into the manifest. */
  as?: string;
}

/** What one (page × viewport) shot recorded, beside the two PNGs. */
export interface JudgeShot {
  task: string;
  subject: string;
  state: JudgeState;
  page: string;
  url: string;
  as?: string;
  viewport: { id: string; width: number; height: number };
  /** What a person actually sees first. */
  viewportPng: string;
  /** Everything that exists, however far below the fold. */
  fullPng: string;
  /** The bottom-most painted pixel of any element, in document coordinates. */
  contentBottom: number;
  /** Whether ANY scroll container on the page actually moved when pushed. */
  canScroll: boolean;
  /**
   * Pixels of content below the fold that nothing can scroll to.
   *
   * 🔴 This is the members-area Setup form. Non-zero here means a person cannot
   * reach part of the page by any means — a defect the picture alone can look
   * like a design choice.
   */
  unreachablePx: number;
  /** `document.body.innerText` length — a page that renders nothing reads 0. */
  textChars: number;
  headings: string[];
  /** Errors logged *during this visit*, not cumulatively. */
  errors: string[];
}

/** Everything a run produced, plus what it was a run OF. */
export interface JudgeRun {
  task: string;
  subject: string;
  state: JudgeState;
  headSha: string;
  /** md5 of the served `nodegx.project.json`, before any page was rendered. */
  artefactMd5: string;
  /** The directory the PNGs and `manifest.json` landed in. */
  outDir: string;
  shots: JudgeShot[];
}

function md5(file: string): string {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function headSha(): string {
  try {
    return execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/** Today, as the directory name that keeps a verdict attached to its date. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Everything one shot needs to know about the page, in a single evaluate.
 *
 * One expression rather than four: each round trip is a chance for the page to
 * change under the reader, and a reading assembled from four moments is a
 * reading about no moment at all (the discipline `READ_PAGE` in `site-drive.ts`
 * established).
 *
 * ⚠️ The scroll probe is deliberately two-phase and lives in {@link SCROLL_PUSH}
 * — a write is not visible in the evaluate that performed it, and `scroll-behavior:
 * smooth` makes an assigned `scrollTop` read back as 0 for the length of an
 * animation. So: push in one call with the behaviour forced to `auto`, read in
 * the next.
 */
const MEASURE = `(function () {
  var maxBottom = 0;
  var all = document.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    var bottom = r.bottom + (window.scrollY || 0);
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return JSON.stringify({
    contentBottom: Math.round(maxBottom),
    textChars: document.body ? document.body.innerText.length : 0,
    headings: Array.prototype.map.call(document.querySelectorAll('h1,h2'), function (h) {
      return h.innerText;
    }).filter(function (t) { return t && t.trim(); }).slice(0, 12)
  });
})()`;

/**
 * Push every scroll container to its end, with smooth scrolling disabled.
 *
 * Returns nothing worth reading — {@link SCROLL_READ} is what says whether
 * anything moved, on the next round trip.
 */
const SCROLL_PUSH = `(function () {
  document.documentElement.style.scrollBehavior = 'auto';
  var moved = [];
  var all = [document.scrollingElement || document.documentElement];
  var els = document.querySelectorAll('*');
  for (var i = 0; i < els.length; i++) all.push(els[i]);
  window.__vibScrollBefore = [];
  for (var j = 0; j < all.length; j++) {
    var el = all[j];
    if (!el || el.scrollHeight <= el.clientHeight + 4) continue;
    window.__vibScrollBefore.push([el, el.scrollTop]);
    el.style.scrollBehavior = 'auto';
    el.scrollTop = 1000000;
  }
  return String(window.__vibScrollBefore.length);
})()`;

/** Did anything actually move, and how far down did it get? */
const SCROLL_READ = `(function () {
  var pairs = window.__vibScrollBefore || [];
  var reached = 0;
  var moved = false;
  for (var i = 0; i < pairs.length; i++) {
    var el = pairs[i][0];
    if (el.scrollTop > pairs[i][1] + 2) moved = true;
    var gained = el.scrollTop - pairs[i][1];
    if (gained > reached) reached = gained;
  }
  return JSON.stringify({ moved: moved, reached: Math.round(reached) });
})()`;

/** Put everything back where it was, so the next capture is of the top. */
const SCROLL_RESET = `(function () {
  var pairs = window.__vibScrollBefore || [];
  for (var i = 0; i < pairs.length; i++) pairs[i][0].scrollTop = pairs[i][1];
  window.__vibScrollBefore = [];
  return 'ok';
})()`;

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** How long a route is given to settle before it is photographed. */
const SETTLE_MS = 1600;

interface CdpPage extends RenderedPage {
  client: { send(method: string, params: unknown): Promise<{ data: string }> };
}

/**
 * Render one artefact in one state at all four widths, and write the evidence.
 *
 * @returns the manifest, also written to `manifest.json` in the output directory.
 */
export async function judge(options: {
  /** The task this evidence belongs to, e.g. `vib-001`. */
  task: string;
  /** The artefact, e.g. `members-area`. */
  subject: string;
  state: JudgeState;
  /** The project directory to serve. */
  projectDir: string;
  /**
   * The shipped project file this copy must still equal, byte for byte.
   *
   * 🔴 Only meaningful on a `door` run, and that is where AC2 lives: the state
   * is only "as shipped" if the bytes are the shipped bytes.
   */
  shippedProjectFile?: string;
  /** Required by `living`, refused by `door`. */
  backendPort?: number;
  pages: JudgePage[];
  /**
   * Sign in, seed a client-side thing, anything the living state needs before
   * the first shot. Refused on a `door` run — the door has nobody to be.
   */
  prepare?: (page: RenderedPage) => Promise<void>;
  /** Overrides the date directory; for a re-run that belongs with an earlier one. */
  date?: string;
}): Promise<JudgeRun> {
  const { task, subject, state, projectDir, shippedProjectFile, backendPort, pages, prepare } = options;

  const projectFile = path.join(projectDir, 'nodegx.project.json');
  if (!fs.existsSync(projectFile)) throw new Error(`judge: not a v2 project directory: ${projectDir}`);

  // ── AC2: the door state is genuinely the door ─────────────────────────────
  if (state === 'door') {
    if (backendPort !== undefined) {
      throw new Error('judge: a door run cannot take a backendPort — that is the living state wearing the door label.');
    }
    if (prepare) {
      throw new Error('judge: a door run cannot take a prepare step — nobody is signed in at the door.');
    }
    const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8')) as { metadata?: Record<string, unknown> };
    if (project.metadata && 'cloudservices' in project.metadata) {
      throw new Error('judge: the project carries metadata.cloudservices — this is a bound project, not the door.');
    }
    if (shippedProjectFile) {
      const shipped = md5(shippedProjectFile);
      const served = md5(projectFile);
      if (shipped !== served) {
        throw new Error(
          `judge: the served project is not the shipped one (${served} vs ${shipped} for ${shippedProjectFile}).`
        );
      }
    }
  } else if (backendPort === undefined) {
    throw new Error('judge: a living run needs a backendPort — otherwise it is the door with a different name on it.');
  }

  const artefactMd5 = md5(projectFile);
  const sha = headSha();
  const outDir = path.join(VERDICTS_ROOT, task, options.date ?? today(), `${subject}-${state}`);
  fs.mkdirSync(outDir, { recursive: true });

  const shots: JudgeShot[] = [];

  await withRenderedPage({ projectDir, backendPort }, async (raw) => {
    const page = raw as CdpPage;

    if (prepare) {
      await page.setViewport({ width: 1280, height: 900 });
      await prepare(page);
    }

    for (const spec of pages) {
      for (const vp of VIEWPORTS) {
        await page.setViewport({ width: vp.width, height: vp.height, mobile: vp.mobile });
        const errorsBefore = page.consoleErrors.length;
        await page.navigate(spec.url);
        await wait(SETTLE_MS);

        const measured = JSON.parse(String(await page.evaluate(MEASURE))) as {
          contentBottom: number;
          textChars: number;
          headings: string[];
        };

        const stem = `${spec.label}-${vp.id}`;
        const viewportPng = path.join(outDir, `${stem}-viewport.png`);
        const fullPng = path.join(outDir, `${stem}-full.png`);

        /**
         * 🔴 **Both captures happen BEFORE the scroll probe, and the order is
         * the whole point.**
         *
         * The first version probed first and photographed second, on the
         * assumption that {@link SCROLL_RESET} put every container back. It did
         * not: the members-area landing at 988x313 came out a pure white
         * rectangle while its own full-page capture showed the hero at the top,
         * because the page's scroll lives on an inner container the reset did
         * not restore. That picture was captioned *"what a person sees first"*
         * and would have been read as a blank first paint — a defect in the
         * product that does not exist, found by the instrument that exists to
         * stop exactly this.
         *
         * So nothing touches the page until both photographs are taken. The
         * probe below only ever runs against a page that has already been
         * photographed, and its own side effects cannot reach a picture.
         */
        const seen = await page.client.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
          clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale: 1 }
        });
        fs.writeFileSync(viewportPng, Buffer.from(seen.data, 'base64'));

        // And everything that exists, however far below the fold it is.
        const whole = await page.client.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width: vp.width,
            height: Math.min(Math.max(measured.contentBottom, vp.height), 16384),
            scale: 1
          }
        });
        fs.writeFileSync(fullPng, Buffer.from(whole.data, 'base64'));

        // Only now: push every scroll container to its end and see what moves.
        // Two round trips, on purpose — a write is not visible in the evaluate
        // that performed it, and `scroll-behavior: smooth` makes an assigned
        // `scrollTop` read back as 0 for the length of an animation.
        await page.evaluate(SCROLL_PUSH);
        await wait(250);
        const scrolled = JSON.parse(String(await page.evaluate(SCROLL_READ))) as {
          moved: boolean;
          reached: number;
        };
        await page.evaluate(SCROLL_RESET);

        const below = Math.max(0, measured.contentBottom - vp.height);
        shots.push({
          task,
          subject,
          state,
          page: spec.label,
          url: spec.url,
          as: spec.as,
          viewport: { id: vp.id, width: vp.width, height: vp.height },
          viewportPng: path.relative(REPO, viewportPng),
          fullPng: path.relative(REPO, fullPng),
          contentBottom: measured.contentBottom,
          canScroll: scrolled.moved,
          unreachablePx: scrolled.moved ? Math.max(0, below - scrolled.reached) : below,
          textChars: measured.textChars,
          headings: measured.headings,
          errors: page.consoleErrors.slice(errorsBefore)
        });

        fs.writeFileSync(
          path.join(outDir, `${stem}.txt`),
          String(await page.evaluate('document.body ? document.body.innerText : ""'))
        );
        // eslint-disable-next-line no-console
        console.log(
          `SHOT ${subject}/${state} ${stem} content=${measured.contentBottom}px ` +
            `scroll=${scrolled.moved ? 'yes' : 'NO'} unreachable=${shots[shots.length - 1].unreachablePx}px ` +
            `text=${measured.textChars}`
        );
      }
    }
  });

  // 🔴 AC2's other half: rendering must not have touched the artefact. A door
  // verdict about a project the harness mutated mid-run is a verdict about a
  // project nobody has.
  const after = md5(projectFile);
  if (after !== artefactMd5) {
    throw new Error(`judge: the project file changed during the run (${artefactMd5} -> ${after}).`);
  }

  const run: JudgeRun = { task, subject, state, headSha: sha, artefactMd5, outDir: path.relative(REPO, outDir), shots };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(run, null, 2) + '\n');
  return run;
}
