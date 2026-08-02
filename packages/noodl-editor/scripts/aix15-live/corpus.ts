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
