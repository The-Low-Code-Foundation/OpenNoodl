/**
 * Phase 15 close-out — the live corpus.
 *
 * One entry per criterion still owed a real provider at the end of the phase.
 * Each is written the way its user would type it, not the way its schema thinks:
 * the whole point of these runs is to find out what a model does with ordinary
 * English, and a request phrased in the vocabulary of the tool being tested
 * measures the tester rather than the tool.
 */

/** AIX-002 spec step 6 — update mode: revise a component that already exists. */
export interface UpdatePrompt {
  slug: string;
  /** Legacy name as the corpus project holds it, e.g. `/Visual Components/Pill`. */
  legacyName: string;
  componentPath: string;
  description: string;
}

export const UPDATE_PROMPTS: UpdatePrompt[] = [
  {
    slug: 'pill-dot',
    legacyName: '/Visual Components/Pills/Pill',
    componentPath: 'Visual Components/Pills/Pill',
    description:
      "Add an optional small dot to the left of the pill's label, and a component input called " +
      "'Dot Color' that sets its colour. When 'Dot Color' is empty the dot should not be shown at all."
  },
  {
    slug: 'bottom-buttons',
    legacyName: '/Visual Components/Bottom Button Section',
    componentPath: 'Visual Components/Bottom Button Section',
    description:
      "Give this section a component input called 'Disabled'. When it is true the buttons inside " +
      'should be dimmed and stop responding to clicks.'
  },
  {
    // The live-provider pass left `update /App` as an unexplained repeated
    // failure. `/App` is the router host, so the task is deliberately a routing
    // change and nothing else: the candidate has to rewrite the Router's nested
    // `pages` object, and the run answers both "does the session complete" and
    // "did the other route survive".
    slug: 'app-start-page',
    legacyName: '/App',
    componentPath: 'App',
    description:
      'The app should open on the Profile page instead of the Article page. Leave everything else ' +
      'exactly as it is — both pages must stay reachable.'
  }
];

/**
 * AIX-005's one undemonstrated criterion — "AIX-002 can author with these nodes".
 * Deliberately phrased without naming a single node type: the catalog side of
 * the criterion is already gated, so what is unproven is whether a model
 * *reaches for* the agentic nodes when the request only describes the behaviour.
 */
export interface AgenticPrompt {
  slug: string;
  componentPath: string;
  description: string;
  /** Catalog type names whose presence in the candidate proves the criterion. */
  wants: string[];
}

/**
 * The fifteen types AIX-005 added, by catalog `typeName`. Listed here rather
 * than derived by prefix: they share no prefix — they are `net.noodl.*` like
 * every other shipped node, which is the point (they are ordinary nodes, not a
 * bolted-on namespace) and is exactly why a prefix test silently scored zero.
 *
 * Fourteen `typeName`s, not the fifteen the task counts: the catalog went
 * 140 → 154, and Undo / Redo are two nodes in the picker served by one type.
 */
export const AGENTIC_TYPES = [
  'net.noodl.ActionDispatcher',
  'net.noodl.ActionHandler',
  'net.noodl.GlobalStore',
  'net.noodl.GlobalStore.Set',
  'net.noodl.GlobalStore.Subscribe',
  'net.noodl.JSONStreamParser',
  'net.noodl.OptimisticUpdate',
  'net.noodl.SSE',
  'net.noodl.StateHistory',
  'net.noodl.StateHistory.Undo',
  'net.noodl.StateSnapshot',
  'net.noodl.StreamBuffer',
  'net.noodl.TextAccumulator',
  'net.noodl.WebSocket'
] as const;

export const AGENTIC_PROMPTS: AgenticPrompt[] = [
  {
    slug: 'streaming-answer',
    componentPath: 'Visual Components/AIX Streaming Answer',
    description:
      'A panel that shows an assistant answering a question. It connects to the endpoint at ' +
      'http://localhost:8791/chat, which streams the answer back token by token as server-sent ' +
      'events, and the text on screen should grow as the tokens arrive rather than appearing all at ' +
      "once. Show a 'Thinking…' state before the first token, and a Stop button that cancels the " +
      'answer mid-stream and keeps whatever has arrived so far.',
    wants: ['net.noodl.SSE', 'net.noodl.TextAccumulator']
  },
  {
    slug: 'shared-draft',
    componentPath: 'Visual Components/AIX Draft Box',
    description:
      'A text area whose contents are shared with the rest of the app — anything else in the app ' +
      'that shows the draft should update as the user types, and the user should be able to undo ' +
      'and redo their edits with two buttons.',
    wants: ['net.noodl.GlobalStore.Set', 'net.noodl.StateHistory']
  }
];

/**
 * AIX-011 criterion 1 — plan quality. Each request needs more than one component
 * to be a sane answer, which is the whole reason project scope exists; a request
 * a single component could satisfy would measure nothing.
 */
export interface PlanPrompt {
  slug: string;
  request: string;
  /** Lower bound on operations for the plan to be a credible answer. */
  minOperations: number;
}

export const PLAN_PROMPTS: PlanPrompt[] = [
  {
    slug: 'saved-articles',
    request:
      'Let readers save articles to read later. I want a "Saved" page listing what they have saved, ' +
      'a save/unsave control they can drop onto an article, and the article list should show which ' +
      'ones are already saved.',
    minOperations: 3
  },
  {
    slug: 'author-profiles',
    request:
      'Add author profiles: a page for one author with their photo, bio and the articles they wrote, ' +
      'and make the author name on an article link through to it.',
    minOperations: 2
  }
];

/**
 * AIX-012 criteria 1 and 2 — the scoping conversation. Scripted user turns, not
 * a single prompt: the criterion is about what several exchanges converge on,
 * and a one-shot request cannot fail the way a conversation can.
 *
 * `turns` are sent in order regardless of what the model asks, which is harsher
 * than a real user and deliberately so — it tests whether the conversation
 * survives a user who answers the question they wanted to be asked.
 */
export interface ScopePrompt {
  slug: string;
  turns: string[];
}

export const SCOPE_PROMPTS: ScopePrompt[] = [
  {
    slug: 'book-club',
    turns: [
      'I want to build an app for my book club. We pick a book each month and everyone leaves a short ' +
        'review with a rating out of five.',
      'About twelve of us, all on our phones. We already have a WhatsApp group so I do not want chat ' +
        'in the app — just the books and the reviews.',
      'Yes, people need to sign in so we know whose review is whose. Nothing fancy, email and password ' +
        'is fine.',
      'I thought about letting people propose books and vote, but honestly whoever hosts picks the ' +
        'book, so no voting. That is everything.',
      // Fifth turn on purpose. Without it the run measures only the walk-away
      // case: the model proposes pages, the scripted user says "that is
      // everything" without confirming them, and — correctly, since it must
      // never invent a decision — nothing is recorded, so the plan is empty and
      // the docs are TODOs. That is a real outcome worth having seen, but it is
      // not the one criterion 1 is about.
      'Yes, those three pages are exactly right. Go with that.'
    ]
  }
];

/**
 * AIX-004 register and accuracy. One question per scope the panel offers, asked
 * about a component the asker has not read — which is the case Explain Mode
 * exists for.
 */
export interface ExplainPrompt {
  slug: string;
  componentName: string;
  question?: string;
  /**
   * Lower-cased substrings whose presence indicates the answer came from this
   * graph rather than from the model's idea of what such a component contains.
   * Matched leniently — this scores register and grounding, it is not a gate.
   */
  wants: string[];
}

export const EXPLAIN_PROMPTS: ExplainPrompt[] = [
  {
    slug: 'chat-page',
    componentName: '/#__page__/Chat',
    wants: ['sse', 'stream', 'repeater', 'stop']
  },
  {
    slug: 'chat-followup',
    componentName: '/#__page__/Chat',
    question: 'What happens if the connection drops halfway through an answer?',
    wants: ['reconnect', 'last-event-id', 'retry', 'resume']
  },
  {
    slug: 'state-page',
    componentName: '/#__page__/State',
    wants: ['store', 'undo', 'redo', 'history']
  }
];

/**
 * AIX-011 criterion 7 — a plan that actually contains a `doc` operation.
 *
 * The first live pass produced none, and the reason turned out to be
 * mechanical rather than editorial: the planning prompt only allows a doc
 * operation "when the project's docs are listed in the overview material", and
 * nothing ever listed them. So a doc run needs two things a `PLAN_PROMPTS`
 * entry cannot carry — a project that HAS docs, and a request whose answer is
 * partly a written decision rather than a graph.
 */
export interface PlanDocPrompt {
  slug: string;
  request: string;
  minOperations: number;
  /**
   * The `docs/` bodies the project is treated as having: handed to the planner
   * (so a doc operation is plannable), to the authoring sessions (so
   * `get_project_doc` answers), and to the doc turn as its baseline (so it is
   * revising a real file with a human's prose in it, which is the case that
   * actually tests whether it restates the graph).
   */
  docs: { architecture?: string; conventions?: string; brief?: string };
}

/**
 * A deliberately human ARCHITECTURE.md: it records decisions and one rejected
 * alternative, and it is written in the register the whole AIX-009…012 group
 * says these files are for. If the doc turn's revision reads like a different
 * document, that is the finding.
 */
const ARTICLE_ARCHITECTURE = `# Architecture

## What this app is

A reader for the articles we publish through Contentful. Everything a reader
sees comes from Contentful; everything a reader *does* — ratings, comments —
lives in the Noodl database, keyed by the Contentful article id.

## Pages

- **Article** — the reader's whole world. Deep-linked by \`pm-slug\`.
- **Profile** — account settings and the reader's own comments.

The App shell owns the only Router. Pages are registered there and nowhere
else; if a page is not in that list it is unreachable, and we have shipped that
bug twice.

## Data

We do not mirror Contentful into the database. An article's *content* is always
fetched live; only reader-generated records are stored, and each one carries the
Contentful \`article_id\` rather than a copy of the article.

We considered caching articles in the Noodl database so the app could open
offline. Rejected: the editorial team corrects live articles several times a
week, and a cache that serves a corrected article's old text is worse than a
spinner.

## Auth

Email/password through the backend's user records. Anything that writes a
reader-generated record must go through \`Is user logged in?\` first.
`;

export const PLAN_DOC_PROMPTS: PlanDocPrompt[] = [
  {
    slug: 'saved-articles-doc',
    // Phrased the way the residual asks for: work that establishes a convention
    // and an external contract, so a doc operation is the honest answer rather
    // than filler. The request never says "write a doc" in those words.
    request:
      'Let readers save articles to read later — a "Saved" page listing what they saved, and a save/unsave ' +
      'control that can go on an article. Store each save as a SavedArticle record with userId and ' +
      'articleId (the Contentful id, same as we do for ratings) — I do not want a second way of ' +
      'identifying an article appearing later, so make sure that decision is written down where the ' +
      'next person will find it.',
    minOperations: 3,
    docs: { architecture: ARTICLE_ARCHITECTURE }
  }
];
/**
 * AIX-003 — the author → review → partially-accept round trip, live.
 *
 * Every AIX-003 property is already asserted in specs: all-accepted reproduces
 * the proposal, rejection closes over the dependency edges, a partial result
 * passes the SUB-006 gate. What those specs cannot say is whether any of it
 * holds on a diff *nobody authored to be reviewable* — the fixture proposals
 * were written by the same hand as the assertions, with explicit ids, tidy
 * positions and one change per intent. A model handed a real component
 * produces neither.
 *
 * `legacyName` present ⇒ update mode against that component of the corpus
 * project, which is where removals, rewires and parameter changes come from.
 * Absent ⇒ a fresh component, which is where the all-`Created` closure lives
 * (every wire requiring both of its endpoints, every child its new parent).
 */
export interface ChangeSetPrompt {
  slug: string;
  /** Legacy name as the corpus project holds it; omit to author a new component. */
  legacyName?: string;
  componentPath: string;
  description: string;
  /**
   * Keep this run's rendered review as the artifact for the 40+ node
   * fresh-reviewer test (AIX-003 residual 2), which needs a human.
   */
  freshReviewer?: boolean;
}

export const CHANGESET_PROMPTS: ChangeSetPrompt[] = [
  {
    slug: 'account-card',
    legacyName: '/Visual Components/Profile/Account Info Card',
    componentPath: 'Visual Components/Profile/Account Info Card',
    description:
      "Show the member's join date underneath their name on the account card, put a 'Sign out' link " +
      "next to 'Change Password' rather than under it, and hide the date-of-birth row entirely when " +
      'the profile has no date of birth.'
  },
  {
    slug: 'notification-prefs',
    componentPath: 'Visual Components/Profile/Notification Preferences',
    description:
      'A notification preferences card: a heading, three labelled on/off switches for email, push and ' +
      'the weekly digest, and a Save button that stays disabled until one of them has been touched. ' +
      'Take the current settings in as a component input and send the new ones out when Save is pressed.'
  },
  {
    slug: 'share-popup',
    legacyName: '/Pop-ups/Share/Share Popup',
    componentPath: 'Pop-ups/Share/Share Popup',
    description:
      "Add a 'Copy link' option to the share sheet alongside the ones already there, show a short " +
      'confirmation message when it is used, and let people dismiss the whole sheet by tapping the ' +
      'dimmed background behind it.',
    freshReviewer: true
  },
  {
    // The spec's own risk row: "large change sets are unreadable, so users
    // blind-accept". A new component of this size is the worst case for the
    // rail — every node and every wire is its own `Created` row, with nothing
    // modified to break the monotony.
    slug: 'settings-page',
    componentPath: 'Pages/Account Settings',
    description:
      "An account settings page. A header with the member's name and avatar; a Profile section with " +
      'their name, email and phone; a Notifications section with switches for email, push and the ' +
      'weekly digest; a Privacy section with a switch for a public profile and a link to the privacy ' +
      'policy; and at the bottom a danger zone with a Delete account button. Each section wants a ' +
      'heading and a divider above it, and there should be Save and Cancel buttons at the end.',
    freshReviewer: true
  }
];
/**
 * AIX-008 — the sandbox preview, against a real provider.
 *
 * AIX-008 was built and live-verified by driving a *scripted*, no-provider
 * session, which means everything downstream of the model — the spliced export,
 * the network shim, the dataset — had only ever seen candidates written by a
 * script. The one thing a real model changes is `sample_data`: the optional
 * `submit_component` field whose records take precedence over the editor's
 * heuristic synthesis. Nobody had ever seen a model fill it in.
 *
 * So every prompt here reads a backend, because a component that reads nothing
 * is a component the field is explicitly told to omit. The spread is the one
 * the success criteria name: a list, a card bound to one record, an aggregate,
 * and an auth-gated page that must render its signed-in state.
 *
 * `namedClasses` is what the request itself names. A collection the *user*
 * named is the strict case — `sample_data` keyed anything else is data the
 * graph will never read — while `account` deliberately names none, so the model
 * has to agree with itself between the graph it wrote and the data it supplied.
 */
export interface SandboxPrompt {
  slug: string;
  componentPath: string;
  description: string;
  /** Collection names the request states outright (may be empty). */
  namedClasses: string[];
  /** The component must render a signed-in state, not a login wall. */
  authGated?: boolean;
}

export const SANDBOX_PROMPTS: SandboxPrompt[] = [
  {
    slug: 'book-list',
    componentPath: 'Pages/AIX Book List',
    description:
      'A page that lists the books in my Books collection, newest first, as a vertical scrolling list. ' +
      "Each row shows the book's cover image on the left, and on the right its title in bold, the " +
      'author underneath, and the rating out of five.',
    namedClasses: ['Books']
  },
  {
    slug: 'event-card',
    componentPath: 'Visual Components/AIX Event Card',
    description:
      'A reusable card for a single event from my Events collection. It shows the event photo, the ' +
      'event name, the date it starts, the city and venue, and the ticket price. Take the event id as ' +
      'a component input and look the event up from it.',
    namedClasses: ['Events']
  },
  {
    slug: 'orders-summary',
    componentPath: 'Pages/AIX Orders',
    description:
      'An orders page. At the top a line saying how many orders there are and what they add up to in ' +
      'total, and under it the rows of my Orders collection — order number, customer name, total, ' +
      'status and the date it was placed — most recent first.',
    namedClasses: ['Orders']
  },
  {
    slug: 'account',
    componentPath: 'Pages/AIX Account',
    description:
      'An account page for whoever is signed in: their avatar, their display name and their email ' +
      'address at the top, and underneath, a list of the articles they have saved to read later with ' +
      'the title and the date they saved it. If nobody is signed in, show a short "Sign in to see ' +
      'your account" message instead of the page.',
    namedClasses: [],
    authGated: true
  }
];
