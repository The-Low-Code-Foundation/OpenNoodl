/**
 * **The document outline as a BROWSER builds it** — one instrument, shared.
 *
 * A template's `as` parameters are read off the shipped JSON by census specs
 * (`sb007Template.test.ts` §12, `tpl001Template.test.ts` §8). Those are claims
 * about what was **authored**. This module is the other half: what the runtime
 * actually puts in the document. **A parameter is an intention** — nothing in a
 * census says `as: 'main'` on a `Group` reaches the DOM as a `<main>`, or that
 * a node's children end up its element's descendants.
 *
 * ## Why this lives in one file rather than in each drive
 *
 * REL-011c s27 wrote this reading inline in `sb008-public-site-drive.test.ts`.
 * The moment a second drive wanted it the repo was one copy-paste away from two
 * probes that answer *slightly* different questions and disagree without
 * anybody noticing — the failure mode this project has already paid for twice
 * (a second palette copy, a check in a second pipeline). One expression, one
 * parse, one vocabulary of faults.
 *
 * It sits in `noodl-mcp/tests` because that is the direction the dependency
 * already runs: `nodegx-backend`'s drives import `sb005Components` and friends
 * from here, and the MCP-side drives can import it without reaching across into
 * a package that would drag `BackendService` in with it.
 *
 * ## 🔴 The containment reading needs something deliberately OUTSIDE
 *
 * `h1sInMain` alone proves nothing. A probe that answered *"inside"* for
 * everything in the document would pass on every page ever written. `navsInDoc`
 * / `navsInMain` is the negative control and it must be read **in the same
 * document** — an absence measured somewhere else is not a control.
 */

/** One reading of one rendered document's landmarks. */
export interface Landmarks {
  /** `<main>` elements in the document. Exactly one is the claim. */
  mains: number;
  /** `<h1>` elements in the document. Exactly one is the claim. */
  h1s: number;
  /** `<h1>`s that are DOM descendants of the one `<main>`. */
  h1sInMain: number;
  /** `<nav>`s anywhere in the document — the negative control's numerator. */
  navsInDoc: number;
  /** `<nav>`s inside the one `<main>` — must be zero, and is what makes `h1sInMain` mean "inside". */
  navsInMain: number;
}

/**
 * 🔴 **The sentinel an arm that never ran leaves behind.**
 *
 * Every field is `-1`, which no document can produce. Without it a browser arm
 * that silently failed to run would leave zeroes, and `0 mains` is exactly what
 * a *reverted* arm is supposed to read — the two would be indistinguishable,
 * and the reverted arm would pass by not happening.
 */
export const NO_LANDMARKS: Landmarks = Object.freeze({
  mains: -1,
  h1s: -1,
  h1sInMain: -1,
  navsInDoc: -1,
  navsInMain: -1
});

/**
 * The expression, evaluated in the page. Returns an object by value.
 *
 * `one` is null unless there is EXACTLY one `<main>`: with two of them
 * "inside the main" has no referent, and answering about the first would be a
 * reading of a document this template is not supposed to produce.
 */
export const READ_LANDMARKS = `(function () {
  var m = document.querySelectorAll('main');
  var one = m.length === 1 ? m[0] : null;
  return {
    mains: m.length,
    h1s: document.querySelectorAll('h1').length,
    h1sInMain: one ? one.querySelectorAll('h1').length : 0,
    navsInDoc: document.querySelectorAll('nav').length,
    navsInMain: one ? one.querySelectorAll('nav').length : 0
  };
})()`;

/** The narrowest shape of a driven page this module needs. */
export interface EvaluatingPage {
  evaluate(expression: string): Promise<unknown>;
}

/**
 * Read one document's landmarks.
 *
 * `Runtime.evaluate` is sent `returnByValue`, so the expression above comes
 * back as an object — but the drives in this repo wrap `evaluate` in two
 * different ways (some `String(...)` the result and parse it), so both a string
 * and an object are accepted rather than one being assumed.
 */
export async function readLandmarks(page: EvaluatingPage): Promise<Landmarks> {
  const raw = await page.evaluate(READ_LANDMARKS);
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Landmarks;
}

/**
 * What is wrong with one reading, in words, or `null` if nothing is.
 *
 * Returning a sentence rather than a boolean is deliberate: a failing spec then
 * prints *which* of the four ways a document can be wrong actually happened,
 * and "never ran" is one of them rather than a silent zero.
 */
export function outlineFault(l: Landmarks | undefined): string | null {
  if (!l || typeof l.mains !== 'number') return 'no reading was taken';
  if (l.mains === -1) return 'the arm never ran';
  if (l.mains !== 1) return `${l.mains} <main>, expected 1`;
  if (l.h1s !== 1) return `${l.h1s} <h1>, expected 1`;
  if (l.h1sInMain !== 1) return `${l.h1sInMain} <h1> inside the <main>, expected 1`;
  if (l.navsInMain !== 0) return `${l.navsInMain} <nav> inside the <main>, expected 0`;
  return null;
}

/**
 * Strip the `as` parameters out of an authored project, in place — the
 * **reverted arm**.
 *
 * 🔴 The house rule is that an arm restores the *absence the fix removed*
 * rather than breaking something new: before REL-011c these components carried
 * no `as` at all, so deleting the parameter is literally the shipped state of
 * the eleven sessions before it. The count comes back so the caller can assert
 * how many tags it actually removed — **an arm that stripped nothing reads
 * exactly like a fix that does not work**.
 *
 * @param componentDirs component paths relative to `<project>/components`,
 *   e.g. `'Pages/Messages'`. A path with no `nodes.json` is skipped silently
 *   and simply contributes nothing to the count, which the caller's expected
 *   total is there to catch.
 */
export function stripOutlineTags(
  fs: {
    existsSync(p: string): boolean;
    readFileSync(p: string, enc: 'utf-8'): string;
    writeFileSync(p: string, data: string): void;
  },
  join: (...parts: string[]) => string,
  projectDir: string,
  componentDirs: readonly string[]
): number {
  let removed = 0;
  type Node = { parameters?: Record<string, unknown>; children?: unknown };
  const walk = (nodes: Node[]): void => {
    for (const node of nodes) {
      if (node.parameters && 'as' in node.parameters) {
        delete node.parameters.as;
        removed++;
      }
      const kids = node.children;
      if (Array.isArray(kids)) walk(kids as Node[]);
    }
  };
  for (const componentDir of componentDirs) {
    const file = join(projectDir, 'components', componentDir, 'nodes.json');
    if (!fs.existsSync(file)) continue;
    const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as { nodes?: Node[] };
    walk(doc.nodes ?? []);
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  return removed;
}
