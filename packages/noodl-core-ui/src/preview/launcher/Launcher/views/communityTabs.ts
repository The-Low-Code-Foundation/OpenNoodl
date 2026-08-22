/**
 * FB-006 / D6 — which tabs the launcher's community page draws, in which order, and what each
 * one says it is for.
 *
 * ## Why this is a module and not four lines inside the view
 *
 * The same reason `learningTabs` is: `Community` reads context and the strip's choice is state,
 * so neither can be evaluated by `tests-unit`'s element walker — it invokes function components
 * directly and anything that calls a hook throws. What is worth grading here is the *order*, the
 * *absence* of a tab nobody wired, and the rule that a new content kind arrives as a tab rather
 * than as more page — so those live in a module whose only imports are types.
 *
 * ## 🔴 The order is the web's nav, and it is pinned here rather than derived
 *
 * Richard, 2026-08-22 (item 5): *"at least put the different content into tabs like the web page
 * has, not everything on one page in a big list that will one day be unmanageable"*. D6 ruled it
 * as proposed: the launcher is the community's home and it mirrors the web's nav, **same names,
 * same order, so the two surfaces read as one product**.
 *
 * ⚠️ `community.nodegx.io` is a **different repository**, so this order cannot be derived from
 * disk the way a route sweep would be — it is a copy, and a copy drifts. The mitigation is that
 * the whole catalogue lives on one screen of one file, with the web's nav quoted beside it:
 *
 * ```
 * <a href="/bench">Bench</a>          <a href="/tutorials">Tutorials</a>
 * <a href="/replays">Replays</a>      <a href="/university">University</a>
 * <a href="/people">People</a>        <a href="/rfps">Work</a>
 * <a href="/coaching">Coaching</a>    <a href="/orgs">Orgs</a>
 * ```
 * (`nodegx-community/src/app/layout.tsx`, read 2026-08-22.)
 *
 * 🔴 **The first tab is "Bench", not "Discussions".** D6's written proposal said *Discussions* —
 * which is what this page's first heading has said since UNI-011 — and in the same sentence said
 * *same names as the web*. The two halves disagree, because the web calls the place **the Bench**
 * and has since UNI-015. Two names for one place is exactly the seam the ruling exists to close,
 * so the web's name wins and the launcher's old heading is what changes. ⚠️ It is one string in
 * one table if Richard wants the other reading.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/views/communityTabs
 */

/**
 * Every content kind the community has, whether or not this build can draw it.
 *
 * 🔴 **AC2 lives on this type.** "Adding a future content kind means adding a tab, not lengthening
 * a list" is not a comment anywhere — it is the fact that a kind has to appear *here*, in the
 * catalogue, to be drawn at all, and that the view renders exactly one of them at a time. A
 * surface that arrived as one more section stacked under the last one would have nowhere to be
 * declared.
 */
export type CommunityTabId =
  | 'bench'
  | 'tutorials'
  | 'replays'
  | 'university'
  | 'people'
  | 'work'
  | 'coaching'
  | 'orgs';

export interface CommunityTabDescriptor {
  id: CommunityTabId;
  /** The web's nav label for the same place. */
  label: string;
  /**
   * 🔴 AC1's *"the first screen of each tab says what it is for"*, and it is not the same
   * sentence as the section's `emptyLine`: an empty line only shows when a section is empty, and
   * a tab full of rows still has to say why a person would read them.
   */
  lead: string;
}

/**
 * The catalogue, in the web's nav order. ⚠️ Order is meaningful — {@link communityTabs} filters
 * this list and never sorts it, so this is the only place that decides what comes after what.
 */
export const COMMUNITY_TABS: readonly CommunityTabDescriptor[] = [
  {
    id: 'bench',
    label: 'Bench',
    lead: 'Questions asked from the editor land here, beside your projects. You never have to open a browser to read them.'
  },
  {
    id: 'tutorials',
    label: 'Tutorials',
    lead: 'Guides and walkthroughs people have published to the community.'
  },
  {
    id: 'replays',
    label: 'Replays',
    lead: 'Recordings of the weekly call, newest first — in case you could not make it.'
  },
  {
    id: 'university',
    label: 'University',
    lead: 'Lessons and the syllabus, once this build can draw them.'
  },
  {
    id: 'people',
    label: 'People',
    lead: 'Who else is building with NodeGX, what they work on, and how to reach them.'
  },
  { id: 'work', label: 'Work', lead: 'Projects people are hiring for, and the briefs they have posted.' },
  { id: 'coaching', label: 'Coaching', lead: 'People offering paid help, and what they charge for it.' },
  { id: 'orgs', label: 'Orgs', lead: 'Schools and teams with a shelf of their own.' }
] as const;

export interface CommunityTabsInput {
  /**
   * Which kinds this host actually supplies.
   *
   * ⚠️ A kind that is **missing or false draws no tab at all**, and the two reasons that happens
   * are not distinguished here on purpose: `people` is `null` when D15 refused this viewer and
   * `undefined` when nobody wired the surface, and *both* of those must leave the nav with no
   * trace of it. D15 says the surface is ABSENT — a greyed tab would narrate the door in the act
   * of closing it, which is the leak `learningTabs` documents for "Your path". The host is where
   * the two meanings still differ, and it is the only place they need to.
   */
  wired: Partial<Record<CommunityTabId, boolean>>;
  /** The tab the reader clicked, or `null` if they have not clicked one yet. */
  chosen?: CommunityTabId | null;
}

export interface CommunityTabsPlan {
  /** The tabs to draw, in the web's order. A single entry means: draw no strip at all. */
  tabs: CommunityTabDescriptor[];
  /** The tab whose content shows, or `null` when this host wired nothing. */
  active: CommunityTabDescriptor | null;
}

export function communityTabs({ wired, chosen = null }: CommunityTabsInput): CommunityTabsPlan {
  const tabs = COMMUNITY_TABS.filter((tab) => wired[tab.id] === true);

  /**
   * 🔴 A **fixed** first tab, unlike `learningTabs`' data-dependent default — and the difference
   * is deliberate. The learning page picks between two surfaces that are each other's fallback;
   * this page is a place with a front door. A default that moved with the data would open the
   * launcher somewhere different depending on what the mirror happened to have fetched, which is
   * the same "where did it go" complaint from the other end.
   *
   * ⚠️ `chosen` is honoured only while it names a tab that is still drawn: a refresh can retire
   * a surface (D15 arriving late, a host dropping `people`), and a `chosen` left pointing at it
   * would show an empty content area under a strip with nothing selected.
   */
  const kept = chosen ? (tabs.find((tab) => tab.id === chosen) ?? null) : null;

  return { tabs, active: kept ?? tabs[0] ?? null };
}
