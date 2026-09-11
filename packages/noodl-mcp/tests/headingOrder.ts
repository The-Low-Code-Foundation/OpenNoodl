/**
 * **A page's heading LEVELS, in the order a reader meets them** — one instrument,
 * two templates.
 *
 * REL-011 §5 and §6 both registered the same residual with owner `NONE`:
 *
 * > `<h2>` order is unchecked in both templates. Every section kind carries one,
 * > but nothing asserts that a page's headings descend without skipping a level.
 *
 * The censuses that exist (`sb007Template.test.ts` §12, `tpl001Template.test.ts`
 * §8) count `as` tags and assert **one `h1` inside one `<main>`**. Neither of
 * them can see an `h1` followed by an `h3`, because a count has no order.
 *
 * ## 🔴 A page's headings are mostly NOT in the page
 *
 * Measured before this was written: walking `/Pages/Site`'s own tree finds
 * **one** heading. The other five are inside `/Site/HeroSection` and its four
 * siblings, which reach the page through `/Site/SectionView` — and `SectionView`
 * is not a child of anything. It is the `template` **parameter** of a `For Each`.
 *
 * So the walk has to follow two edges that look nothing alike:
 *
 * 1. a node whose `type` is another component's name — an instance;
 * 2. a node whose `parameters.template` names a component — a `For Each`.
 *
 * `sb005AdminPanel.test.ts` already walks both for its layout reading; this is
 * the same traversal asked a different question. ⚠️ **A walker that followed only
 * children would report every page in the site builder as a lone `h1` and call
 * it well-formed** — which is exactly the shape of pass that means nothing, so
 * `headingSequence` is used with a cardinality assertion beside it and never
 * alone.
 *
 * ## What it deliberately does not model
 *
 * Repetition count (a `For Each` over ten rows draws the same levels ten times,
 * and level order is invariant under repetition), `mounted` conditions, and
 * anything the runtime reorders at draw time. This is a reading of the
 * **authored** outline, and it says so — the rendered half is
 * `documentOutline.ts`, which needs a browser.
 */

/** A visual node, as either template's on-disk shape resolves to. */
export interface OutlineNode {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  children?: OutlineNode[];
}

/**
 * The two templates ship in two different shapes — one `content.json` holding
 * every component, and a directory of `nodes.json` files with id-referenced
 * children. The traversal is the same for both, so each caller supplies the
 * three lines that differ and nothing else is copied.
 */
export interface OutlineSource {
  /** Every component name this source can resolve, instances and templates alike. */
  names(): string[];
  /** A component's visual roots, children already nested. */
  rootsOf(name: string): OutlineNode[];
}

/** One heading, with the component it was authored in. */
export interface HeadingRef {
  /** 1–6. */
  level: number;
  /** The `as` value verbatim, so a failure names what is in the artefact. */
  tag: string;
  /** The node id, which is what a person greps for. */
  id: string;
  /** The component the node lives in — usually NOT the page. */
  component: string;
}

const LEVELS: Readonly<Record<string, number>> = Object.freeze({
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6
});

/**
 * Every heading reachable from `page`, in authoring order.
 *
 * Cycles are cut by `seen`: a component may not re-enter itself. That is a
 * safety net rather than a modelling choice — a component that instantiated
 * itself would not terminate in the runtime either.
 */
export function headingSequence(source: OutlineSource, page: string): HeadingRef[] {
  const known = new Set(source.names());
  const out: HeadingRef[] = [];

  const walkComponent = (name: string, seen: ReadonlySet<string>): void => {
    const walk = (node: OutlineNode): void => {
      const tag = node.parameters?.as;
      if (typeof tag === 'string' && tag in LEVELS) {
        out.push({ level: LEVELS[tag], tag, id: node.id, component: name });
      }

      const template = node.parameters?.template;
      for (const target of [node.type, typeof template === 'string' ? template : undefined]) {
        if (target && known.has(target) && !seen.has(target)) {
          walkComponent(target, new Set([...seen, target]));
        }
      }

      for (const child of node.children ?? []) walk(child);
    };

    for (const root of source.rootsOf(name)) walk(root);
  };

  walkComponent(page, new Set([page]));
  return out;
}

/**
 * The fault in a sequence, or `null`.
 *
 * Two rules, and they are the two a screen reader's heading list depends on:
 *
 * - the first heading on a page is `h1` — a page that opens at `h2` has a level
 *   its reader never got;
 * - no step goes deeper by more than one — `h1` then `h3` claims a section that
 *   does not exist.
 *
 * ⚠️ Going back **up** by any amount is correct and must stay allowed:
 * `h1 h2 h3 h2` is a second section, not a fault. A rule that forbade it would
 * redden every page with more than one section, which is most of both templates.
 *
 * ⚠️ An empty sequence is `null` here — "no headings" is not a level fault, and
 * the templates' one-`h1`-per-page claim is the censuses' job. A caller must not
 * read `null` as "this page has an outline"; assert the cardinality it expects.
 */
export function headingOrderFault(sequence: readonly HeadingRef[]): string | null {
  if (sequence.length === 0) return null;

  const first = sequence[0];
  if (first.level !== 1) {
    return `the first heading is <${first.tag}> (${first.component} #${first.id}), not <h1>`;
  }

  for (let i = 1; i < sequence.length; i++) {
    const previous = sequence[i - 1];
    const current = sequence[i];
    if (current.level > previous.level + 1) {
      return (
        `<${previous.tag}> (${previous.component} #${previous.id}) is followed by ` +
        `<${current.tag}> (${current.component} #${current.id}) — a skipped level`
      );
    }
  }

  return null;
}

/** `h1 h2 h2` — the shape of a sequence, for a failure message worth reading. */
export function describeSequence(sequence: readonly HeadingRef[]): string {
  return sequence.length === 0 ? '(no headings)' : sequence.map((h) => h.tag).join(' ');
}
