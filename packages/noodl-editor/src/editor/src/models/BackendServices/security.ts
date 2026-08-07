/**
 * What each backend's security model means for the app you are about to publish.
 *
 * ## Why this file exists
 *
 * Under one merged node family a user can change backends in a dropdown and
 * silently change their app's security model. A Directus or Supabase backend
 * **publishes a token into the app**, where every visitor can read it and use it
 * from somewhere that is not your app. The built-in backend and Parse publish an
 * app id, which is not a password, and lean on rules checked on the server.
 * Those are materially different promises, and until this file the difference
 * was stated in exactly one place: a comment on `BackendAuthConfig.publicToken`
 * in `types.ts`. Nothing a user could ever see.
 *
 * ## How the prose is written, and why it reads like this
 *
 * BCN-001 §5.4 set the voice for the capability reason strings and it carries
 * over, with one addition. The four rules:
 *
 * 1. **Name the backend and the thing, not the mechanism.** "Your Supabase anon
 *    key is published with your app" — not "credential exposure in the client
 *    bundle".
 * 2. **Say where to go.** A sentence that says a rule exists but not which
 *    screen sets it has moved the problem, not solved it.
 * 3. **No backlog language.** These are product facts about somebody else's
 *    backend, not our roadmap.
 * 4. **Written for a beginner about to press publish.** Second person, no term
 *    used without being glossed once ("Row Level Security is Supabase's per-row
 *    permission system"), and never a threat where a fact will do.
 *
 * The fourth rule is why none of this is a warning banner. A red banner on every
 * backend teaches nothing and gets dismissed; the thing that changes behaviour
 * is one true sentence in the place where the choice is made. Red in this
 * product means danger — a destructive action or a failure — and a factual
 * statement about how your backend works is neither.
 *
 * ## Reviewed?
 *
 * **Not yet.** The wording is the deliverable of BCN-009 and Richard reviews it
 * before it is final; the same prose is reproduced in `BCN-009-NOTES.md` so it
 * can be read and marked up without running the editor.
 *
 * @module BackendServices/security
 */

import type { BackendType } from '@noodl/backend-contract';

/**
 * What a published app carries, from the point of view of somebody who opens it
 * and reads the source.
 *
 * The distinction that matters is not "is there a string in the bundle" — there
 * always is — but **whether that string is usable on its own**. An app id names
 * a server; an access token acts on one.
 */
export type PublishedCredentialKind =
  /** Names the backend. Useless without permission rules allowing the request. */
  | 'app-id'
  /** Acts on the backend, with whatever the token's role allows. Copyable. */
  | 'access-token'
  /** Nothing is published; the backend decides from rules alone. */
  | 'none'
  /** The user's own API. We cannot know, and saying so is the honest answer. */
  | 'unknown';

export interface BackendSecurityDisclosure {
  /** One line, shown on the card without being opened. */
  headline: string;
  /** What a visitor to the published app can read, and what it lets them do. */
  visitorsCanSee: string;
  /** Where the rules live, and which screen sets them. */
  rulesAreSet: string;
  /** One link. Optional because a link that rots is worse than no link. */
  learnMore?: { label: string; url: string };
  publishedCredential: PublishedCredentialKind;
  /**
   * A noun phrase that reads naturally after "publishes" — used to build the
   * before/after sentences when a project changes backends.
   */
  publishes: string;
  /** A noun phrase that reads naturally after "decided by" for the same reason. */
  rulesLiveIn: string;
}

/**
 * The six disclosures.
 *
 * One per backend type, keyed by the contract's union rather than the editor's
 * old four-value one — which is the reason BCN-009 reconciled them.
 */
export const BACKEND_SECURITY: Readonly<Record<BackendType, BackendSecurityDisclosure>> = Object.freeze({
  nodegx: {
    headline: 'Your app publishes an app id, not a password.',
    visitorsCanSee:
      'Anyone who opens your published app can read its app id, and that is fine — on its own it opens nothing. ' +
      'What each visitor is allowed to see and change is decided by the backend itself, on every request, ' +
      'and nothing you set here is published alongside it.',
    rulesAreSet:
      'Open Access on this backend to say who can read and write each collection. ' +
      'Individual records can carry their own rule too, which is how a visitor ends up seeing only their own.',
    publishedCredential: 'app-id',
    publishes: 'an app id, which opens nothing on its own',
    rulesLiveIn: 'the Access rules on each collection, checked by the backend'
  },

  parse: {
    headline: 'Your app publishes the application id of your Parse server.',
    visitorsCanSee:
      'Anyone who opens your published app can read that id. It is not a password: what it reaches is whatever ' +
      'your class-level permissions and per-record ACLs allow, and your Parse server checks them on every request. ' +
      'A master key is never published — nothing in NodeGX puts one into an app.',
    rulesAreSet:
      'Class-level permissions and record ACLs are set on the Parse server itself, usually through a Parse ' +
      'Dashboard run by whoever hosts it. If someone else hosts your server, they own that screen.',
    learnMore: { label: 'Parse security guide', url: 'https://docs.parseplatform.org/parse-server/guide/#security' },
    publishedCredential: 'app-id',
    publishes: 'an application id, which opens nothing on its own',
    rulesLiveIn: 'class-level permissions and record ACLs on your Parse server'
  },

  directus: {
    headline: 'The public token you enter here is published with your app.',
    visitorsCanSee:
      'Every visitor can read that token, and can use it from outside your app just as easily as from inside it. ' +
      'It does exactly what its Directus role is allowed to do — no more and no less. ' +
      'So give that role read access to the collections you want the world to see, and nothing else.',
    rulesAreSet:
      'Roles and their permissions are set in Directus under Settings → Access Control, called ' +
      'Roles & Permissions in older versions. The admin token you enter here stays in the editor and is never published.',
    learnMore: { label: 'Directus documentation', url: 'https://docs.directus.io/' },
    publishedCredential: 'access-token',
    publishes: 'an access token that any visitor can copy and use elsewhere',
    rulesLiveIn: "the permissions on that token's Directus role"
  },

  supabase: {
    headline: 'Your Supabase anon key is published with your app, and it is only safe with Row Level Security on.',
    visitorsCanSee:
      'Every visitor can read the anon key. Supabase is built that way and the key is meant to be public — but only ' +
      "while Row Level Security is switched on. Row Level Security is Supabase's per-row permission system; with " +
      'it off, that key can read and write whole tables for anyone who copies it out of your app.',
    rulesAreSet:
      'Turn Row Level Security on for every table in your Supabase dashboard, then write a policy for each thing an ' +
      'anonymous visitor may do. The service_role key you enter here stays in the editor and is never published — ' +
      'it ignores those policies entirely, which is why it must not travel.',
    learnMore: {
      label: 'Supabase Row Level Security',
      url: 'https://supabase.com/docs/guides/database/postgres/row-level-security'
    },
    publishedCredential: 'access-token',
    publishes: 'the anon key, which any visitor can copy and use elsewhere',
    rulesLiveIn: 'Row Level Security policies on each Supabase table'
  },

  pocketbase: {
    headline: 'PocketBase needs no key in your published app.',
    visitorsCanSee:
      'Nothing secret is published. PocketBase decides what an anonymous visitor may do from the API Rules on each ' +
      'collection, checked on its own server. Leave the public token empty unless you have a specific reason for one: ' +
      'if you fill it in, it is published with your app and every visitor can read it.',
    rulesAreSet:
      'Open a collection in the PocketBase admin UI and use its API Rules tab. An empty rule means anyone may do ' +
      'that thing; a rule such as published = true narrows it.',
    learnMore: { label: 'PocketBase API rules', url: 'https://pocketbase.io/docs/api-rules-and-filters/' },
    publishedCredential: 'none',
    publishes: 'nothing a visitor can use',
    rulesLiveIn: 'the API Rules on each PocketBase collection'
  },

  custom: {
    headline: 'Whatever you put in the public token is published with your app.',
    visitorsCanSee:
      'Every visitor can read it and use it from outside your app. This is the one backend where we cannot tell you ' +
      'what that token reaches, because it is your API. Before you publish, check that it can do only what a stranger ' +
      'is allowed to do, and keep the more powerful one in the Admin field, which stays in the editor.',
    rulesAreSet:
      'Your API decides for itself. NodeGX sends the token and passes on the answer — it cannot loosen or tighten ' +
      'what your server allows.',
    publishedCredential: 'unknown',
    publishes: 'whatever token you enter, which any visitor can copy and use elsewhere',
    rulesLiveIn: 'your own API, wherever you enforce them'
  }
});

export function securityFor(type: BackendType): BackendSecurityDisclosure {
  return BACKEND_SECURITY[type] ?? BACKEND_SECURITY.custom;
}

/** True when this backend's published app carries something a stranger can act with. */
export function publishesUsableCredential(type: BackendType): boolean {
  const kind = securityFor(type).publishedCredential;
  return kind === 'access-token' || kind === 'unknown';
}

// ============================================================================
// Changing backends
// ============================================================================

export interface BackendSwitchDisclosure {
  from: { type: BackendType; name: string; publishes: string; rulesLiveIn: string };
  to: { type: BackendType; name: string; publishes: string; rulesLiveIn: string };
  /**
   * The one sentence that is only true when the *kind* of published credential
   * changes. Absent when it does not, because a line that appears every time is
   * a line nobody reads.
   */
  tokenVisibilityChange?: string;
  /** Always shown. Rules never travel, and that surprises people. */
  rulesDoNotTravel: string;
}

/**
 * What changes about token visibility and rule enforcement when a project moves
 * from one backend to another.
 *
 * Derived rather than authored: six backends make thirty ordered pairs, and
 * thirty hand-written paragraphs would drift within a phase. The two facts that
 * differ per pair already live on the disclosure — what is published and where
 * the rules are — so the comparison composes from those and only the *change of
 * kind* gets its own sentence.
 */
export function describeBackendSwitch(
  from: BackendType,
  to: BackendType,
  names: { from: string; to: string }
): BackendSwitchDisclosure {
  const a = securityFor(from);
  const b = securityFor(to);

  return {
    from: { type: from, name: names.from, publishes: a.publishes, rulesLiveIn: a.rulesLiveIn },
    to: { type: to, name: names.to, publishes: b.publishes, rulesLiveIn: b.rulesLiveIn },
    tokenVisibilityChange: describeTokenVisibilityChange(a, b, names.to),
    rulesDoNotTravel:
      `Permissions do not travel between backends. Anything you set up on ${names.from} stays there, and ` +
      `${names.to} starts with its own rules — check them before you publish.`
  };
}

function describeTokenVisibilityChange(
  from: BackendSecurityDisclosure,
  to: BackendSecurityDisclosure,
  toName: string
): string | undefined {
  if (from.publishedCredential === to.publishedCredential) return undefined;

  if (to.publishedCredential === 'unknown') {
    return `This changes what your app publishes, and ${toName} is your own API — so whether the token it publishes is safe for a stranger to hold is a question only you can answer.`;
  }

  if (to.publishedCredential === 'access-token') {
    return `This changes what your app publishes: ${toName} puts a token into the app that any visitor can copy and use from somewhere that is not your app.`;
  }

  if (from.publishedCredential === 'access-token' || from.publishedCredential === 'unknown') {
    return `This changes what your app publishes: it will no longer carry a token a visitor can copy, because ${toName} decides what visitors may do from rules checked on its own server.`;
  }

  return undefined;
}
