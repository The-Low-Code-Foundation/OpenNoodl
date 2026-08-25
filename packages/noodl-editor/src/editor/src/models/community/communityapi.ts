/**
 * UNI-011 — the editor's client for the platform API (`nodegx-community`, `/api/v1`).
 *
 * 🔴 D14 made this a MIRROR, and the load-bearing consequence is negative: **this client
 * decides nothing.** Not who may see the community (D15), not where the entry point goes
 * (D16), not which threads are visible. It transports and it types. D15's ruling says why in
 * terms of this exact file: *"a mirror's natural implementation renders whatever the API
 * returns — so an editor build that decides for itself is one release away from disagreeing
 * with the web."*
 *
 * That is asserted rather than promised. `tests-unit/uni-011/communityapi.test.ts` feeds this
 * client a payload whose `entryPoint` **contradicts its own components** and requires the
 * client to follow the payload: a client that recomputed D16 would say `browser`, and this one
 * says what it was told. Same shape for D15's `absent`.
 *
 * ⚠️ **Editor-outbound only, and there is no socket here on purpose.** README surface 3 and
 * D14 consequence 3: the mirror *pulls* on its own schedule and the platform never connects
 * in. An unread count is a poll result. This module owns no timer — `poll()` takes the clock
 * from its caller — because a module that starts its own interval is one an editor cannot
 * stop without knowing about it.
 */
import type { CaptureImageRef, PostAttachment } from './nodeartifact';
import { parsePostBody, readPostBlocks, type Block, type PostBlock } from './postbody';

// ───────────────────────────────────────────────────────────────────────────────
// The payloads, mirroring `nodegx-community/src/lib` — the API's types, not ours
// ───────────────────────────────────────────────────────────────────────────────

export type Capabilities = Record<string, boolean>;

export type CommunityVisibility =
  | { surface: 'absent'; reason: string }
  | { surface: 'present'; capabilities: Capabilities };

export type MeResponse = {
  viewer: { handle: string; kind: 'individual' | 'org_minor' } | null;
  community: CommunityVisibility;
};

export type ComponentReading<T> = { value: T; required: T; met: boolean };

export type ThresholdResponse = {
  met: boolean;
  entryPoint: 'in-editor-mirror' | 'browser';
  threads: ComponentReading<number>;
  consecutiveWeeksWithCall: ComponentReading<number>;
  medianFirstReply: {
    medianHours: number | null;
    requiredBelowHours: number;
    n: number;
    unreplied: number;
    minimumSample: number;
    met: boolean;
    note?: string;
  };
  /**
   * 🔴 **REMOVED FROM THE PLATFORM BY D19 AND STILL DECLARED HERE UNTIL 2026-08-19.** Optional
   * so the type stops lying about a live route: `src/lib/mirror.ts:123` records the field going
   * with the branch that produced it. ⚠️ Nothing reads it; it is kept optional rather than
   * deleted only so an older platform's payload still parses.
   */
  source?: { forum: 'absent' | 'present' };
};

export type MirrorReplay = {
  slug: string;
  title: string;
  heldOn: string;
  videoUrl: string | null;
  description: string | null;
};

export type MirrorArticle = { slug: string; title: string; summary: string | null; kind: string };

// ───────────────────────────────────────────────────────────────────────────────
// TUT-004 — tutorials, and the bundles the editor can install
// ───────────────────────────────────────────────────────────────────────────────

/**
 * A row of `/api/v1/community/tutorials`.
 *
 * 🔴 **`installable` is not `projectUrl !== null`, and the panel must not derive it.** They are
 * two different affordances that happen to sit on one article: `projectUrl` is the *web page's*
 * "Download the starter project →" link — unconstrained free text on any host — and
 * `installable` says the platform holds a bundle this editor can score and install. A tutorial
 * may have either, both or neither, and a panel that inferred one from the other would offer to
 * install a blog post.
 *
 * ⚠️ `projectUrl` is deliberately **absent from this type**. Nothing in the editor should be
 * able to reach for it: the whole point of P1 is that no browser opens, and a URL nobody can
 * read is a URL nobody can be tempted to fetch.
 */
export type TutorialSummary = {
  slug: string;
  title: string;
  summary: string | null;
  level: string | null;
  category: string | null;
  estimatedMinutes: number | null;
  outcomes: string[];
  nodes: string[];
  installable: boolean;
};

/**
 * The bundle itself: relative path → file contents.
 *
 * ⚠️ **Text only.** A lesson bundle is JSON and Markdown — TUT-003's is 35 files with not one
 * binary in it — and the transport is jsonb, so a bundle that needed a PNG would need a
 * different wire, not a bigger string. If that day comes it is a new decision, not a
 * widened type.
 */
export type TutorialBundlePayload = {
  slug: string;
  title: string;
  version: number;
  updatedAt: string;
  files: Record<string, string>;
};

/**
 * 🔴 **A bundle entry is a relative path, AND THIS CHECK IS DELIBERATELY THE SECOND COPY.**
 *
 * `nodegx-community/src/lib/tutorialbundles.isSafeBundlePath` refuses the same shapes at
 * publish. That one protects the *platform's* data; this one protects *this machine*, and they
 * are not the same job. Every key here becomes a filename under the learner's Learning folder,
 * written by this process — so the question "may this land at this path" has to be answered by
 * the process doing the landing. A validator on the far side of a wire is a claim about a
 * server, not a gate on a disk, and a compromised or simply older platform would satisfy it
 * while sending `../../.ssh/authorized_keys`.
 *
 * ⚠️ So this is not drift and must not be "deduplicated". `learningfolder.isSafeLessonId`
 * carries the identical argument one level up, for the lesson id.
 */
export function isSafeBundleEntry(path: string): boolean {
  if (!path || path.length > 400) return false;
  if (path.includes('\\') || path.includes('\0')) return false;
  if (path.startsWith('/') || path.endsWith('/')) return false;
  return path.split('/').every((s) => s.length > 0 && s !== '.' && s !== '..');
}

function readTutorialSummary(raw: unknown): TutorialSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slug !== 'string' || typeof r.title !== 'string') return null;
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    slug: r.slug,
    title: r.title,
    summary: typeof r.summary === 'string' ? r.summary : null,
    level: typeof r.level === 'string' ? r.level : null,
    category: typeof r.category === 'string' ? r.category : null,
    estimatedMinutes: typeof r.estimatedMinutes === 'number' ? r.estimatedMinutes : null,
    outcomes: strings(r.outcomes),
    nodes: strings(r.nodes),
    // ⚠️ Defaults to FALSE on anything that is not a literal `true`. An older platform that
    // does not send the field must read as "no button", never as "install this".
    installable: r.installable === true
  };
}

export type CommunityHome = {
  replays: MirrorReplay[];
  articles: MirrorArticle[];
  threshold: ThresholdResponse;
  standing: { points: number; badges: unknown[] } | null;
};

/**
 * A row in the Bench's thread list.
 *
 * 🔴 **`externalId` WAS DECLARED HERE AND THE PLATFORM HAS NEVER SENT IT.** Retired 2026-08-19
 * (NAT-007). `mirrorThreads` returns `MirrorThread`, which carries `id` and no external
 * identifier of any kind — the field is a leftover from the Discourse era, when a thread's real
 * home was somebody else's forum and its id here was a foreign key.
 *
 * ⚠️ **It was not dead code. It was read, and it was `undefined`.** Both surfaces built their
 * browser hand-off out of it — `openCommunity(`/bench/${thread.externalId}`)` in the rail panel
 * and the same string in `ProjectsPage` — so every thread anybody clicked opened
 * `community.nodegx.io/bench/undefined`. The web page's route segment is the thread's **uuid**
 * (`app/bench/[threadId]/page.tsx` passes it straight to `threadById`), so `id` was the right
 * value all along and is what both call sites use now.
 *
 * 🔴 **This is the second field in this file to outlive the platform that sent it**, after the
 * `{forum: 'absent'}` arm above, and it failed the same way: both sides compile, TypeScript
 * checks the *declaration* against the consumers and never against the wire, and the value that
 * arrives is `undefined` rather than a type error. ⚠️ The first was found by curling a live
 * route; this one by looking for the field on the platform because a task needed it. **Neither
 * was found by a test, and there is still no mechanism that would find the third.**
 */
export type ForumThread = {
  id: string;
  title: string;
  createdAt: string;
  firstReplyMinutes: number | null;
  /**
   * FB-002 — a thread with an accepted answer. `accepted_post_id` being non-null on the
   * platform, which is the platform's definition of *answered* and is **not** "has any reply":
   * `replyCount` and `firstReplyMinutes` both move without this ever becoming true.
   *
   * 🔴 **Verified on the wire, not read off the platform's source.** The header above records
   * what the alternative cost twice, so: `curl https://community.nodegx.io/api/v1/community/threads`
   * on 2026-08-25 answered `200` with two rows carrying all eight fields `mirrorThreads` sends,
   * one `"accepted":true` and one `"accepted":false`.
   *
   * ⚠️ **The other three — `section`, `authorHandle`, `replyCount` — are on the wire and stay
   * undeclared, deliberately.** Nothing draws them. This file's two scars are both fields that
   * were *declared* and then read as `undefined` or drawn by nobody; a field declared here is a
   * promise that something downstream keeps, so the list gets one when something needs one.
   */
  accepted: boolean;
};

/**
 * 🔴 **What `threads()` can see, and therefore what any filter over it is filtering.**
 *
 * `mirrorThreads` calls `listThreads(sql, { limit: 100 })` and sends a bare `{threads: [...]}`
 * — no total, no `nextOffset`, nothing to follow. So unlike `readDirectory`, which walks the
 * people endpoint's pages to the end, this client cannot walk anything: it gets the 100 newest
 * threads and that is the whole population every client-side count is computed over.
 *
 * ⚠️ **This number is a copy of the platform's, and nothing checks that they agree.** If the
 * platform *raises* its limit we simply hold more than we claim, which is harmless. If it
 * *lowers* it, `composeBench` would stop drawing its bound line while the list really is
 * partial — the silent half of the failure. The honest fix is for the route to send the window
 * it used; until it does, this constant is the assumption, written down where the filter that
 * depends on it can see it.
 *
 * @see `nodegx-community/src/lib/mirror.ts` — `mirrorThreads`
 */
export const MIRROR_THREAD_WINDOW = 100;

/**
 * 🔴 **THE `{forum: 'absent'}` ARM IS GONE, 2026-08-19, and it was found by driving rather than
 * by reading.**
 *
 * The arm existed because `forum_threads` used to be written only by the Discourse webhook
 * receiver, so an empty table meant *"nobody has bought a forum"* rather than *"nobody has
 * posted"* — two facts that want opposite renderings. **D19 removed the situation**: we own the
 * Bench, an empty Bench is empty, and the platform deleted the branch *and* a spec now asserts
 * it is absent from its source (`src/lib/mirror.ts:45,60`).
 *
 * ⚠️ **This editor went on declaring the union for a day after the platform stopped producing
 * it**, and nothing caught it: a discriminated union whose discriminant never arrives makes
 * every consumer fall into its `else`, which rendered the right thing for the wrong reason. It
 * surfaced only when the live route was curled during the slice-3 drive.
 *
 * 🔴 **This is D15's "the two clients drift" warning, arriving in the type layer rather than the
 * rule layer** — and the type layer has no test that fails, because both sides compile.
 */
export type ForumState = { threads: ForumThread[] };

// ─────────────────────────────────────────────────────────────────────────────
// NAT-007 — one thread, as an editor object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A post's attachment, mirroring the platform's `Attachment` (`src/lib/attachments.ts`).
 *
 * ⚠️ `payload` stays `Record<string, unknown>` and is NOT narrowed by `kind` here. The kinds are
 * an open enum on the platform (`attachment_kind`), the editor renders two of the four, and a
 * union that claimed to know every payload shape would be a claim this client cannot keep — the
 * renderer reads the fields it needs and says so when they are missing.
 */
export type ThreadAttachment = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  note: string | null;
  /** Derived by the platform's database, never by a sender. See `nodeartifact.ts`. */
  facets: {
    nodeType: string | null;
    appVersion: string | null;
    os: string | null;
    warningCode: string | null;
    portsWithheld: number;
  };
};

/**
 * One post in a thread.
 *
 * 🔴 `blocks` is {@link PostBlock}`[]`, which is the parser's model **plus** the marker for a
 * kind this editor could not render — see {@link readThreadDetail} for why the wire's own
 * `Block[]` is read rather than cast.
 */
export type ThreadPost = {
  id: string;
  authorHandle: string;
  blocks: PostBlock[];
  createdAt: string;
  accepted: boolean;
  attachments: ThreadAttachment[];
};

/**
 * A thread and every post in it, mirroring the platform's `BenchThread`.
 *
 * ⚠️ `question` and `answers` are separate rather than one `posts` array, because that is the
 * platform's own shape and the distinction is real: `bench_threads` carries no body, so the first
 * post **is** the question. Flattening them here would make the renderer re-derive by index, and
 * "index 0 is the question" is a rule that survives exactly until a thread's opening post is
 * hidden by moderation.
 */
export type ThreadDetail = {
  id: string;
  section: string;
  title: string;
  authorHandle: string;
  createdAt: string;
  replyCount: number;
  accepted: boolean;
  acceptedPostId: string | null;
  firstReplyMinutes: number | null;
  question: ThreadPost;
  answers: ThreadPost[];
};

function readAttachments(value: unknown): ThreadAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: ThreadAttachment[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const facets = (typeof row.facets === 'object' && row.facets !== null ? row.facets : {}) as Record<string, unknown>;
    const payload = typeof row.payload === 'object' && row.payload !== null && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
    out.push({
      id: String(row.id ?? ''),
      kind: String(row.kind ?? ''),
      payload,
      note: typeof row.note === 'string' ? row.note : null,
      facets: {
        nodeType: typeof facets.nodeType === 'string' ? facets.nodeType : null,
        appVersion: typeof facets.appVersion === 'string' ? facets.appVersion : null,
        os: typeof facets.os === 'string' ? facets.os : null,
        warningCode: typeof facets.warningCode === 'string' ? facets.warningCode : null,
        portsWithheld: Number.isFinite(Number(facets.portsWithheld)) ? Number(facets.portsWithheld) : 0
      }
    });
  }
  return out;
}

function readPost(value: unknown): ThreadPost | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  return {
    id,
    authorHandle: typeof row.authorHandle === 'string' ? row.authorHandle : '',
    // 🔴 `readPostBlocks`, never a cast. See `postbody.ts`.
    blocks: readPostBlocks(row.blocks),
    // ⚠️ Kept as the string it arrived as, including Postgres's own spelling — `communityMeta`'s
    // formatters take both and return `null` for neither-of-those, which is where that decision
    // already lives. Normalising here would put a second one beside it.
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    accepted: row.accepted === true,
    attachments: readAttachments(row.attachments)
  };
}

/**
 * A thread payload, **validated rather than cast**.
 *
 * 🔴 THIS IS THE FIRST METHOD ON THIS CLIENT THAT TRANSFORMS A PAYLOAD, and the header's *"it
 * transports and it types"* is worth re-reading against it. Nothing here decides anything the
 * platform decided: not who may see the thread (the 404 does that, and `get()` turns it into
 * `absent` untouched), not what is accepted, not what order posts are in.
 *
 * ⚠️ **One thing it does do that the platform did not: it marks a block kind this editor cannot
 * draw.** That is AC3's requirement and it is a rendering decision rather than a policy one — but
 * it is a *difference from the wire*, so it is stated here rather than left for a reader to find
 * in `postbody.ts`. The alternative shapes are worse in both directions: casting publishes an
 * unaudited payload into a `nodeIntegration: true` renderer, and dropping silently shows somebody
 * a post with a hole in it that neither end can see.
 *
 * Exported because it is the whole of what {@link CommunityApiClient.thread} does beyond a GET,
 * and a spec should not need a fake `fetch` to grade it.
 */
export function readThreadDetail(value: unknown): ThreadDetail | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : null;
  const question = readPost(row.question);
  // ⚠️ A thread with no readable question is not a thread with an empty question — the platform
  // returns null rather than serve one (moderation can hide an opening post), so a payload that
  // arrives without one is a payload this client did not understand.
  if (!id || !question) return null;

  const answers: ThreadPost[] = [];
  if (Array.isArray(row.answers)) {
    for (const raw of row.answers) {
      const post = readPost(raw);
      if (post) answers.push(post);
    }
  }

  const replyCount = Number(row.replyCount);
  const firstReply = Number(row.firstReplyMinutes);

  return {
    id,
    section: typeof row.section === 'string' ? row.section : '',
    title: typeof row.title === 'string' ? row.title : '',
    authorHandle: typeof row.authorHandle === 'string' ? row.authorHandle : '',
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    replyCount: Number.isFinite(replyCount) ? replyCount : answers.length,
    accepted: row.accepted === true,
    acceptedPostId: typeof row.acceptedPostId === 'string' ? row.acceptedPostId : null,
    firstReplyMinutes: row.firstReplyMinutes === null || !Number.isFinite(firstReply) ? null : firstReply,
    question,
    answers
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NAT-008 — the people, as editor objects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The `{items, page}` envelope NAT-006 gave every list endpoint it added.
 *
 * 🔴 **This is a SECOND shape on this client and it has to be, which is worth saying out loud.**
 * `/v1/community/home`, `/threads` and `/threshold` predate the contract and answer their own
 * bodies; `docs/API.md` records all three as documented exceptions and
 * `tests/nat006-api-contract.test.ts` holds the list. So a reader of this file sees two
 * conventions and neither is a mistake — the older routes were not retrofitted because that
 * would break the shipped editor for no reader's benefit.
 *
 * ⚠️ `nextOffset` is a `number | null` and never an absent field, deliberately, on the platform's
 * side: *"there is no next page"* and *"this server does not tell you about next pages"* are
 * different facts. {@link readDirectory} is the caller that depends on it.
 */
export type PageInfo = {
  limit: number;
  offset: number;
  /** Rows matching the query **before** the window — what makes a partial read detectable. */
  total: number;
  nextOffset: number | null;
};

export type Paged<T> = { items: T[]; page: PageInfo };

/**
 * One row of the directory, mirroring the platform's `PersonSummary` (`lib/apisurfaces.ts`).
 *
 * ⚠️ **No account id, and its absence is the platform's decision rather than this client's
 * omission.** NAT-006 found that returning the read modules' own types would publish an internal
 * account UUID that no web page renders; `personSummary` drops it and the contract test asserts
 * no response body carries one. Declaring a field for it here would be this client asking for it
 * back.
 *
 * ⚠️ `lastActiveAt` is kept as the string it arrived as — including Postgres's own
 * `2026-08-19 11:19:27.206885+00` spelling, which NAT-007 measured on the live wire.
 * `communityMeta`'s formatters take both spellings and that is where the decision already lives.
 */
export type PersonSummary = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  availableForWork: boolean;
  offersCoaching: boolean;
  points: number;
  rateBand: string | null;
  skills: string[];
  badgeCount: number;
  lastActiveAt: string | null;
};

/**
 * A badge somebody holds.
 *
 * ⚠️ `artwork` is a PATH on the platform (`badges/learning-bronze.svg`) and this editor never
 * fetches it — see `peopleview.badgeMark` for what the editor draws instead and why a remote
 * request for a decoration is not a thing this window makes.
 */
export type PersonBadge = {
  family: string;
  tier: string;
  title: string;
  description: string;
  artwork: string;
  earnedAt: string;
};

/** D8's bar, so a profile can say what *listing* would require. Mirrors `ProfileBar`. */
export type PersonBar = {
  hasName: boolean;
  hasBlurb: boolean;
  hasPublishedThingOrLesson: boolean;
  meets: boolean;
};

/**
 * One public profile, mirroring the platform's `PersonProfile`.
 *
 * ⚠️ **No `skills`, and not by oversight** — `apisurfaces.ts` says so from the other end: the
 * skill chips belong to a directory *row*, `/u/[handle]` does not render them, and an API that
 * added them to a profile would be answering a question the web profile does not answer. A
 * profile pane in this editor that wanted them would be a change to the page and the endpoint
 * together, not a field invented here.
 */
export type PersonProfile = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  availableForWork: boolean;
  offersCoaching: boolean;
  points: number;
  avatarUrl: string | null;
  links: { label: string; url: string; ordinal: number }[];
  badges: PersonBadge[];
  bar: PersonBar;
};

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readPageInfo(value: unknown, itemCount: number): PageInfo {
  const row = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const num = (raw: unknown, fallback: number): number =>
    Number.isFinite(Number(raw)) ? Number(raw) : fallback;
  const next = Number(row.nextOffset);
  return {
    limit: num(row.limit, itemCount),
    offset: num(row.offset, 0),
    // ⚠️ Falling back to the count we were handed rather than to 0: a `total` of zero beside a
    // non-empty `items` is a payload that contradicts itself, and `readDirectory` would read it
    // as *"we hold everything"* — the one conclusion this field exists to support.
    total: num(row.total, itemCount),
    nextOffset: row.nextOffset === null || !Number.isFinite(next) ? null : next
  };
}

/** Exported so a spec can grade the reader without a fake `fetch`. */
export function readPersonSummary(value: unknown): PersonSummary | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const handle = typeof row.handle === 'string' ? row.handle : null;
  // 🔴 A row with no handle is not a person with a blank name: the handle is the id this surface
  // navigates by, so a row without one is a payload this client did not understand — and drawing
  // it would put an entry point on screen that cannot open.
  if (!handle) return null;
  const points = Number(row.points);
  const badgeCount = Number(row.badgeCount);
  return {
    handle,
    displayName: typeof row.displayName === 'string' ? row.displayName : null,
    bio: typeof row.bio === 'string' ? row.bio : null,
    availableForWork: row.availableForWork === true,
    offersCoaching: row.offersCoaching === true,
    points: Number.isFinite(points) ? points : 0,
    rateBand: typeof row.rateBand === 'string' ? row.rateBand : null,
    skills: readStringArray(row.skills),
    badgeCount: Number.isFinite(badgeCount) ? badgeCount : 0,
    lastActiveAt: typeof row.lastActiveAt === 'string' ? row.lastActiveAt : null
  };
}

function readBadges(value: unknown): PersonBadge[] {
  if (!Array.isArray(value)) return [];
  const out: PersonBadge[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const title = typeof row.title === 'string' ? row.title : null;
    if (!title) continue;
    out.push({
      family: typeof row.family === 'string' ? row.family : '',
      tier: typeof row.tier === 'string' ? row.tier : '',
      title,
      description: typeof row.description === 'string' ? row.description : '',
      artwork: typeof row.artwork === 'string' ? row.artwork : '',
      earnedAt: typeof row.earnedAt === 'string' ? row.earnedAt : ''
    });
  }
  return out;
}

function readLinks(value: unknown): { label: string; url: string; ordinal: number }[] {
  if (!Array.isArray(value)) return [];
  const out: { label: string; url: string; ordinal: number }[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const url = typeof row.url === 'string' ? row.url : null;
    if (!url) continue;
    const ordinal = Number(row.ordinal);
    out.push({
      label: typeof row.label === 'string' && row.label !== '' ? row.label : url,
      url,
      ordinal: Number.isFinite(ordinal) ? ordinal : out.length
    });
  }
  return out;
}

/** Exported for the same reason {@link readThreadDetail} is. */
export function readPersonProfile(value: unknown): PersonProfile | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const handle = typeof row.handle === 'string' ? row.handle : null;
  if (!handle) return null;
  const points = Number(row.points);
  const bar = (typeof row.bar === 'object' && row.bar !== null ? row.bar : {}) as Record<string, unknown>;
  return {
    handle,
    displayName: typeof row.displayName === 'string' ? row.displayName : null,
    bio: typeof row.bio === 'string' ? row.bio : null,
    availableForWork: row.availableForWork === true,
    offersCoaching: row.offersCoaching === true,
    points: Number.isFinite(points) ? points : 0,
    avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
    links: readLinks(row.links),
    badges: readBadges(row.badges),
    bar: {
      hasName: bar.hasName === true,
      hasBlurb: bar.hasBlurb === true,
      hasPublishedThingOrLesson: bar.hasPublishedThingOrLesson === true,
      meets: bar.meets === true
    }
  };
}

/**
 * The whole directory, as far as this client is willing to read it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **WHY THIS LOOP EXISTS, MEASURED 2026-08-20 RATHER THAN REASONED.**
 *
 * `GET /api/v1/community/people` **has no search parameter at all**, and it *pages*. Both
 * halves were measured against the route handler on a real database, with a control beside
 * them:
 *
 * | request | answer |
 * |---|---|
 * | `?q=ada` over `[ada, grace, linus]` | **all three** — the keyword is dropped, not honoured |
 * | `?q=zzzzzzzz` | **all three** again |
 * | `?offersCoaching=true` (the control) | `[linus]` — the route ran, and its own filters narrow |
 * | `?limit=3` over 7 rows | 3 items, `total: 7`, `nextOffset: 3` |
 * | `?limit=1000` | clamped to 100, and `page.limit` says so |
 *
 * ⚠️ The control is what makes the first two rows mean anything: *"the keyword is ignored"* and
 * *"the request never reached the route"* are otherwise the same measurement, and this phase has
 * recorded that confusion five times.
 *
 * 🔴 **So a client that searched by sending `q` would show the unfiltered directory and call it a
 * result** — which is the *"four endpoints that silently ignore their keyword"* failure this
 * task's traps name, arriving from the other side. Search therefore happens in the editor, over
 * rows, which is also what the **web** does: `facets.ts`'s `select()` filters `listDirectory`'s
 * full list in memory and the endpoint's own comment says a client should *"filter the page it
 * was given rather than have this route grow a second filtering vocabulary"*.
 *
 * 🔴 **But filtering the page you were given is only honest if you were given the whole thing** —
 * a local search over page 1 of 5 is the same silent lie in a nicer shape. So this follows
 * `nextOffset` to the end, and when it stops early it **says so** rather than returning a partial
 * list that looks whole. {@link Directory.complete} is not decoration: `peopleview.ts` puts a
 * sentence on screen when it is false.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export type Directory = {
  people: PersonSummary[];
  /** What the platform says exists, which is not always what we hold. */
  total: number;
  /** 🔴 `false` = we stopped early. The surface must say so; see the note above. */
  complete: boolean;
};

/**
 * ⚠️ A stated cap, not a `while (true)`. Ten pages of 100 is a thousand people, well past the
 * *"the biggest table is in the hundreds"* scale `apishape.ts` says this design is sized for —
 * and a client that would page forever is one a broken `nextOffset` turns into a hammer.
 */
export const DIRECTORY_MAX_PAGES = 10;

export async function readDirectory(
  client: Pick<CommunityApiClient, 'people'>,
  options: { maxPages?: number } = {}
): Promise<Read<Directory>> {
  const maxPages = options.maxPages ?? DIRECTORY_MAX_PAGES;
  const people: PersonSummary[] = [];
  let offset = 0;
  let total = 0;

  for (let page = 0; page < maxPages; page++) {
    const read = await client.people({ offset });
    // ⚠️ A failure on page 2 is a failure, not a short directory. Returning what we had would
    // hand the surface a list it would draw as complete — and `complete: false` cannot rescue
    // that, because the reader would be told the platform has fewer people rather than that we
    // could not finish asking.
    if (read.outcome !== 'ok') return read;

    for (const row of read.value.items) people.push(row);
    total = read.value.page.total;

    if (read.value.page.nextOffset === null) {
      return { outcome: 'ok', value: { people, total, complete: true } };
    }
    // 🔴 A `nextOffset` that does not advance would loop forever on a platform bug. Treated as
    // the end of the list AND as incomplete, which is the pair of statements that is true.
    if (read.value.page.nextOffset <= offset) break;
    offset = read.value.page.nextOffset;
  }

  return { outcome: 'ok', value: { people, total, complete: people.length >= total } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAT-009 — the work board
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * One request for work, mirroring the platform's `RfpView` (`lib/apisurfaces.ts`).
 *
 * ⚠️ **`responseCount` is a COUNT and there is no field for the responses.** That is the
 * platform's mechanism rather than a thin payload: *"a response is a private message between two
 * parties that the relay exists to keep private"*, so publishing the bodies would defeat this
 * board's own privacy design on its index page. A client that wanted them would be asking for
 * something no endpoint serves.
 *
 * ⚠️ `responseCap` is dropped platform-side too — the web renders the approach to the threshold
 * (`responsesRemaining`) and never the raw policy number.
 */
export type RfpSummary = {
  id: string;
  title: string;
  description: string;
  budgetBand: string;
  timeline: string | null;
  state: 'open' | 'closed';
  posterHandle: string;
  responseCount: number;
  responsesRemaining: number;
  createdAt: string;
  closedAt: string | null;
};

function readRfpSummary(value: unknown): RfpSummary | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const title = typeof row.title === 'string' ? row.title : '';
  // 🔴 Validated rather than cast, for `readPostBlocks`' reason: a row this client cannot read is
  // dropped and the page's `total` is left alone, so the surface can say it is showing part of
  // the board. Casting would draw a row with an empty title and a working button.
  if (!id || !title) return null;
  const state = row.state === 'closed' ? 'closed' : 'open';
  const count = Number(row.responseCount);
  const remaining = Number(row.responsesRemaining);
  return {
    id,
    title,
    description: typeof row.description === 'string' ? row.description : '',
    budgetBand: typeof row.budgetBand === 'string' ? row.budgetBand : '',
    timeline: typeof row.timeline === 'string' ? row.timeline : null,
    state,
    posterHandle: typeof row.posterHandle === 'string' ? row.posterHandle : '',
    responseCount: Number.isFinite(count) ? count : 0,
    responsesRemaining: Number.isFinite(remaining) ? remaining : 0,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    closedAt: typeof row.closedAt === 'string' ? row.closedAt : null
  };
}

/**
 * One of the caller's own responses — `GET /api/v1/me/rfp-responses`.
 *
 * 🔴 **`connectedAt` IS ALWAYS NULL AND BOTH ACCEPTS ARE ALWAYS FALSE, and this is the platform's
 * measurement rather than a client guess.** The relay thread beside a response has an
 * accept-and-connect step, and the function that performs it — `acceptConnection` — has no caller
 * anywhere on the platform but its own suite. Nothing on any client can advance it.
 *
 * ⚠️ So `rfpboardview.ts` draws them as **facts about the row** and never as a stage in a
 * process. A progress bar that cannot fill is worse than no bar: it tells somebody to wait for
 * something that is not coming.
 */
export type MyRfpResponse = {
  id: string;
  rfpId: string;
  rfpTitle: string;
  rfpState: 'open' | 'closed';
  posterHandle: string;
  message: string;
  createdAt: string;
  connectedAt: string | null;
  posterAccepted: boolean;
  youAccepted: boolean;
};

function readMyRfpResponse(value: unknown): MyRfpResponse | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const rfpId = typeof row.rfpId === 'string' ? row.rfpId : '';
  if (!id || !rfpId) return null;
  return {
    id,
    rfpId,
    rfpTitle: typeof row.rfpTitle === 'string' ? row.rfpTitle : '',
    rfpState: row.rfpState === 'closed' ? 'closed' : 'open',
    posterHandle: typeof row.posterHandle === 'string' ? row.posterHandle : '',
    message: typeof row.message === 'string' ? row.message : '',
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    connectedAt: typeof row.connectedAt === 'string' ? row.connectedAt : null,
    posterAccepted: row.posterAccepted === true,
    youAccepted: row.youAccepted === true
  };
}

/** `POST /api/v1/community/rfps/:id/responses`, 201. */
export type ResponseAccepted = {
  responseId: string;
  /**
   * 🔴 **READ OFF THE PLATFORM AND NEVER ASSUMED.** It is `'relayed'` on every response today —
   * the relay has already queued the double-blind email — and the field exists because the
   * sentence a client draws differs by arm: *"the poster has been emailed"* against *"the poster
   * will be told"*. **D10 is open and it is exactly this choice.** NAT-008's four guessed
   * rate-band keys, all four wrong and silently invisible, are the standing warning.
   */
  outcome: string;
};

export type MemberAssignment = {
  id: string;
  orgSlug: string;
  orgName: string;
  title: string;
  instructions: string | null;
  lessonSource: 'curated' | 'org_shelf';
  lessonRef: string;
  dueAt: string | null;
  state: 'in_progress' | 'submitted' | 'graded' | null;
  score: number | null;
  complete: boolean | null;
  feedback: string | null;
};

/**
 * UNI-006's bridge — what the editor pulls, hands in, and hears back.
 *
 * 🔴 THE THREE-WAY `lesson` READING IS THE PLATFORM'S, AND THIS CLIENT MUST NOT COLLAPSE IT.
 * `available: false` is not a failure and not an absence: it means *the assignment is
 * genuinely yours and we have not published the lesson*. Today that is the ordinary case —
 * the platform hosts no curated bundles at all. A client that treated it as an error would
 * tell a pupil their homework does not exist, which is the one sentence the API went out of
 * its way to make sayable-apart. `reason` is the platform's own words; show them.
 */
export type AssignmentLesson =
  | {
      available: true;
      source: 'org_shelf';
      lessonRef: string;
      title: string;
      version: number;
      /** The lesson bundle, as `learningfolder` installs it. Opaque here on purpose. */
      bundle: unknown;
    }
  | { available: false; source: 'curated' | 'org_shelf'; lessonRef: string; reason: string };

/** `POST /api/v1/me/assignments/:id/submit`, 201. */
export type SubmissionAccepted = {
  submissionId: string;
  state: 'in_progress' | 'submitted' | 'graded';
  /**
   * 🔴 `null` IS SUCCESS, not a failure to grade. A `human`-graded assignment waits for a
   * person (D13), which is the shape phase 68's coaching flow is built on. A caller that
   * treated null as an error would break it before it is written.
   */
  score: number | null;
};

/** A grading by a PERSON that the member has not seen. Runner grades never appear here. */
export type GradingNotice = {
  gradingId: string;
  assignmentId: string;
  assignmentTitle: string;
  orgSlug: string;
  score: number;
  complete: boolean;
  feedback: string | null;
  gradedAt: string;
};

// ───────────────────────────────────────────────────────────────────────────────
// UNI-007 AC1 — the intake, and the path it produces
// ───────────────────────────────────────────────────────────────────────────────

/**
 * One intake question. 🔴 **The options come down the wire and are NOT declared here**, which
 * is the whole reason this type is so thin. `pathing.ts` owns the question set; an editor that
 * shipped its own copy would show a learner one set of choices and record them against
 * another the first time the platform re-words a question — and nothing would error, because
 * the values would still parse. `intakeQuestionsAreUsed` on the platform fails if a question
 * stops branching anything; there is no equivalent guard against a client that stopped
 * agreeing, so the client does not get to have an opinion.
 */
export type IntakeQuestion = {
  key: string;
  prompt: string;
  options: { value: string; label: string }[];
};

/** ⚠️ Three known keys, and the values are open `string` **on purpose** — see {@link IntakeState}. */
export type IntakeAnswers = {
  experience: string;
  logic: string;
  building: string;
};

/**
 * `GET /api/v1/me/intake`.
 *
 * 🔴 **`answers` is `null` for a signed-out viewer and this read needs no token** — the only
 * one on this client that says so out loud. The question set is nobody's data, and requiring
 * a session to see the form makes signing in a prerequisite for finding out what it is for.
 *
 * ⚠️ **The answer values are typed `string`, not a union of the six literals.** Narrowing them
 * here would put a copy of the platform's closed answer set in the editor, which is the same
 * defect as copying the questions one field along: a learner answering a re-worded option
 * would fail an editor-side check against a value the platform considers perfectly valid.
 * Validity is the platform's (`parseIntake`, and `learner_intakes_answers_are_tokens` in the
 * schema beneath it); this client carries what was chosen.
 */
export type IntakeState = { questions: IntakeQuestion[]; answers: IntakeAnswers | null };

/** Per-lesson, never one banner for the page — `curriculum.ts` argues why. */
export type LessonStanding =
  | { kind: 'ready' }
  | { kind: 'in-writing' }
  | { kind: 'needs'; lesson: { slug: string; title: string } };

export type PathStep = {
  slug: string;
  title: string;
  description: string;
  teaches: string;
  estimatedMinutes: number;
  nodes: string[];
  /** Always null, or a slug appearing EARLIER in this path — repaired platform-side. */
  needs: string | null;
  track: string;
  standing: LessonStanding;
  /** Why this step is in THIS learner's path. */
  reason: string;
  /** Tier 1, from the cache only. `GET /me/path` never calls a model. */
  projection: string | null;
};

/** 🔴 What the intake branched AWAY, with the platform's reason. Half of "visibly different". */
export type PathOmission = { slug: string; title: string; reason: string };

export type LearnerPath = {
  steps: PathStep[];
  omitted: PathOmission[];
  ready: number;
  total: number;
  minutes: number;
  /**
   * 🔴 **The platform's own sentence about what this path can deliver today, and the editor
   * prints it rather than deciding it.** Today it reads *"none of them can be installed yet"*
   * for every learner, because all fifteen lessons are `in-writing`. That is the one string on
   * this screen it would be most tempting to drop — a personalised path reads better without
   * it — and dropping it is what would make a path to nothing look like a product.
   */
  truth: string;
};

/** `GET /api/v1/me/path`. ⚠️ No intake is `{intake: null, path: null}`, NOT a 404. */
export type PathState = { intake: IntakeAnswers | null; path: LearnerPath | null };

/**
 * What `POST /api/v1/me/path/project` can come back as.
 *
 * 🔴 **`refused` IS D10 AND IT IS NOT AN ERROR.** Tier-1 projection is off for org-owned
 * accounts belonging to under-18s, decided from the account's own kind. The client that draws
 * this as a failure tells a pupil their school's policy is a bug; the tier-0 path is complete
 * and is what they should see.
 *
 * ⚠️ **`fresh` is the only evidence that "one model call ever" held.** Two calls for one
 * concept return the same `projection` with `fresh: false` on the second — and a client that
 * ignored the field could not tell that from having made two calls, because both answers are
 * equally plausible prose.
 */
export type ProjectionOutcome =
  | { kind: 'ready'; projection: string; model: string | null; fresh: boolean }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; failure: string }
  | { kind: 'in-flight' }
  | { kind: 'unavailable'; reason: string };

export type ProjectionAccepted = { concept: string; outcome: ProjectionOutcome };

/**
 * 🔴 A community read is one of FOUR outcomes and `absent` is not an error.
 *
 * A client that modelled the 404 as a failure would retry it, log it, or show a "could not
 * reach the community" banner — and a pupil whose school switched the community off would get
 * an error message about a surface D15 says must not appear to them at all. *Absent means
 * absent* is a property of the client's type, not of its rendering.
 *
 * 🔴 **`unauthenticated` was added 2026-08-20, and the reason is a defect rather than a
 * symmetry.** Every read on this API answered `200` for a null viewer — deliberately, because
 * D15's refusal is a `404` and a signed-out pull must be indistinguishable from a member with
 * an empty list. `GET /api/v1/me/path` is **the first read that answers `401`** (UNI-007 AC1;
 * a path is nobody's but its owner's), and until this variant existed `get()` fell through to
 * `!response.ok` and reported it as `unreachable` — telling a learner whose token had expired
 * that their network was down, while the platform was answering them precisely.
 *
 * ⚠️ That is the *same* argument {@link Write} makes for its own `unauthenticated`, which was
 * written on 2026-08-16 and reasoned about writes only. The read path had the identical bug
 * for four days and no route exercised it. **A distinction argued for one half of a client is
 * not thereby made in the other half** — the doc comment reads as though it were.
 */
export type Read<T> =
  | { outcome: 'ok'; value: T }
  /** No credential, or an expired one. The caller's own fix, and an ordinary fact. */
  | { outcome: 'unauthenticated' }
  | { outcome: 'absent' }
  | { outcome: 'unreachable'; status: number | null; detail: string };

/**
 * What a write can come back as. 🔴 FIVE outcomes, not three, and see `askQuestion` for why
 * `unauthenticated` and `refused` are not folded into the read's `unreachable`.
 */
export type Write<T> =
  | { outcome: 'ok'; value: T }
  /** No credential, or an expired one. The caller's own fix, and an ordinary fact. */
  | { outcome: 'unauthenticated' }
  /** D15 says this surface does not exist for you. ⚠️ Not an error, and not narrated. */
  | { outcome: 'absent' }
  /** The platform refused the content, in its own words. Safe to show; it chose them. */
  | { outcome: 'refused'; detail: string }
  | { outcome: 'unreachable'; status: number | null; detail: string };

/** `POST /api/v1/bench/threads`, 201. */
export type AskAccepted = { threadId: string; postId: string; pointsAwarded: number };

/** `POST /api/v1/bench/threads/:id/posts`, 201. */
export type AnswerAccepted = { postId: string; pointsAwarded: number };

export type ClientOptions = {
  /**
   * Where the platform lives — `community.nodegx.io`.
   *
   * ⚠️ **`.io`, not `.dev`**: the whole phase said `.dev` until 2026-08-17 and nobody checked it
   * against the registrar. It **resolves** (A → nexus-1, `49.12.102.195`) and **nothing serves it
   * yet** — the platform is deployed nowhere. See UNI-001.
   */
  baseUrl: string;
  /** The session token, when there is one. Reading works without it (D14 consequence 4). */
  token?: string | null;
  /** Injected so the suite needs no network and no editor. */
  fetchImpl?: typeof fetch;
};

export class CommunityApiClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly doFetch: typeof fetch;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token ?? null;
    // 🔴 **`.bind(globalThis)`, AND THE BIND IS THE WHOLE FIX.** A bare `globalThis.fetch`
    // reference loses its receiver, so `this.doFetch(...)` calls it with `this` === the client
    // and the browser throws `TypeError: Failed to execute 'fetch' on 'Window': Illegal
    // invocation`. Every read fails; the panel renders three "could not reach the community"
    // rows against a platform that is up and answering 200.
    //
    // ⚠️ **The precise rule, because "fetch needs a receiver" is not quite it:** WebIDL
    // substitutes the global only when `this` is **undefined**. A bare `fetch(...)` call is
    // therefore fine, and a *method* call on any other object is not — which is why
    // `communitysignin.ts` works untouched: it holds its fetch in a local `const` and calls it
    // bare. Two call shapes, one reference, opposite outcomes.
    //
    // ⚠️ **Unreached by every spec in this repo BY CONSTRUCTION** — they all inject `fetchImpl`,
    // which is the branch that exists so the suite needs no network. The default branch had
    // therefore never executed anywhere: `AskAboutNodeDialog` hands off to the browser rather
    // than posting, so until the community panel this client had **never made a real request**.
    // *Build the caller*, ninth instance in this phase, and the first where the thing with no
    // caller was the transport itself. Found by driving, on 2026-08-19, not by reading.
    const fallbackFetch = (globalThis as { fetch?: typeof fetch }).fetch;
    this.doFetch = options.fetchImpl ?? (fallbackFetch ? fallbackFetch.bind(globalThis) : (fallbackFetch as typeof fetch));
  }

  private async get<T>(path: string): Promise<Read<T>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    // ⚠️ A bearer header rather than a cookie: this is not a browser and has no jar scoped to
    // the platform's origin. The platform accepts both against the same `sessions` row.
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}${path}`, { headers, method: 'GET' });
    } catch (err) {
      return { outcome: 'unreachable', status: null, detail: String(err) };
    }

    // 🔴 ORDER MATTERS AND IT IS THE OPPOSITE OF THE OBVIOUS ONE. 401 is checked before 404
    // because they are both refusals and only one of them may be narrated: `absent` is D15
    // saying *this surface does not exist for you*, which is drawn as nothing at all, and
    // `unauthenticated` is *you, specifically, are not signed in*, which is drawn as a way
    // back in. Collapsing either into the other tells somebody about a door they must not
    // know exists, or hides the only one they could actually open.
    if (response.status === 401) return { outcome: 'unauthenticated' };
    if (response.status === 404) return { outcome: 'absent' };
    if (!response.ok) {
      return { outcome: 'unreachable', status: response.status, detail: `HTTP ${response.status}` };
    }
    try {
      return { outcome: 'ok', value: (await response.json()) as T };
    } catch (err) {
      return { outcome: 'unreachable', status: response.status, detail: `bad JSON: ${String(err)}` };
    }
  }

  /**
   * UNI-016 — ask a question, with its structure intact.
   *
   * 🔴 THE FIRST WRITE THIS CLIENT HAS EVER MADE, and the header's *"it transports and it
   * types"* still holds: the decisions — what to bucket, which ports to publish, whether a
   * capture is attached — were all made before the payload got here. What is new is only
   * that the payload is a document rather than a string.
   *
   * ⚠️ A write is NOT a `Read<T>` with a different name, and the difference is the 401.
   * `Read`'s three outcomes are `ok | absent | unreachable`, and `absent` means D15 says
   * this surface does not exist for you — a fact about *permission*. Signed-out is a fact
   * about *this attempt*, the caller can fix it, and folding it into `unreachable` would
   * make the composer tell somebody their network was down when they simply are not signed
   * in. Hence {@link Write}, with `unauthenticated` as its own outcome.
   *
   * 🔴 A 404 here stays `absent` and MUST NOT become an error either: `apiviewer.ts` returns
   * the same 404 the read gets when D15 refuses an org-minor, deliberately, so *"a pupil is
   * not told a door exists."* A client that reported "posting failed" would narrate the door.
   */
  askQuestion(input: {
    section: string;
    title: string;
    body: string;
    attachments?: PostAttachment[];
  }): Promise<Write<AskAccepted>> {
    return this.post<AskAccepted>('/api/v1/bench/threads', input);
  }

  /**
   * FB-007 — upload the capture's bytes, and receive the reference that may name them.
   *
   * ═══════════════════════════════════════════════════════════════════════════════
   * 🔴 **THE ONLY METHOD ON THIS CLIENT THAT DOES NOT SEND JSON, AND THE PLATFORM CHOSE THAT
   * DELIBERATELY.** `POST /api/v1/bench/captures` takes a raw PNG as the whole body — not
   * multipart, which would need a parser for one field, and not base64 in a JSON envelope,
   * which is the very thing the separate route exists to avoid: `MAX_PAYLOAD_BYTES` is 32 KB
   * against a screenshot of two to five megabytes, a third larger again once base64'd, read
   * back out of a `jsonb` column every time anybody opens the thread.
   *
   * 🔴 **AND IT IS WHY {@link write} IS NOT REUSED.** That helper's first act is
   * `JSON.stringify(body)`; a `Uint8Array` through it becomes the string `{"0":137,"1":80,…}`,
   * which the platform sniffs, finds no PNG magic in, and refuses as *"that is not a PNG"* —
   * a message about the image that would in fact be about the transport.
   *
   * ⚠️ **The status table below is `write`'s on purpose, and one line short of it on purpose
   * too.** 400/403/413 are refusals with the platform's own sentence — too large, not a PNG,
   * D15 says you may not upload — and the composer shows them. **502 and 503 fall through to
   * `unreachable`, which is correct rather than an omission**: *the capture could not be
   * stored* and *capture hosting is not configured* are both our problem and both retryable,
   * and neither is anything the asker can act on. This file's header counts three times that
   * a status defaulted to `unreachable` and should not have (429, 409, 413); this is the case
   * where the default is the right answer, said out loud so the count stays honest.
   * ═══════════════════════════════════════════════════════════════════════════════
   */
  async uploadCapture(base64Png: string): Promise<Write<CaptureImageRef>> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'image/png'
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    // ⚠️ `Buffer` rather than `atob`, and it is available on both sides that run this: the
    // editor's renderer is `nodeIntegration: true`, and `tests-unit` is jest on Node.
    // `nodesharecontext.ts` already decodes the same string the same way to write it to disk.
    // 🔴 COPIED INTO AN ARRAYBUFFER THIS FUNCTION OWNS, AND THE COPY IS NOT CEREMONY.
    // `Buffer.from(string, 'base64')` returns a view into Node's SHARED POOL for small
    // allocations, so `buf.buffer` is an eight-kilobyte slab holding this capture and whatever
    // else was allocated near it. Handing that to `fetch` as the body would upload the slab —
    // the wrong length, and other memory with it. `byteOffset`/`byteLength` slicing is the
    // other correct answer; a fresh buffer is the one that cannot be got subtly wrong later.
    let bytes: ArrayBuffer;
    try {
      const decoded = Buffer.from(base64Png, 'base64');
      bytes = new ArrayBuffer(decoded.byteLength);
      new Uint8Array(bytes).set(decoded);
    } catch (err) {
      return { outcome: 'unreachable', status: null, detail: `capture could not be decoded: ${String(err)}` };
    }
    // 🔴 A refusal, not an upload of nothing. `Buffer.from` does not throw on a malformed
    // base64 string — it decodes what it can and silently returns a SHORTER buffer, empty in
    // the worst case. Posting that would spend the round trip to be told it is not a PNG.
    if (bytes.byteLength === 0) {
      return { outcome: 'unreachable', status: null, detail: 'the capture decoded to no bytes' };
    }

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}/api/v1/bench/captures`, {
        headers,
        method: 'POST',
        body: bytes
      });
    } catch (err) {
      return { outcome: 'unreachable', status: null, detail: String(err) };
    }

    if (response.status === 401) return { outcome: 'unauthenticated' };
    if (response.status === 404) return { outcome: 'absent' };
    if (response.status === 400 || response.status === 403 || response.status === 413) {
      const detail = await response
        .json()
        .then((payload: { error?: string }) => payload?.error ?? `HTTP ${response.status}`)
        .catch(() => `HTTP ${response.status}`);
      return { outcome: 'refused', detail };
    }
    if (!response.ok) {
      return { outcome: 'unreachable', status: response.status, detail: `HTTP ${response.status}` };
    }

    let body: Partial<CaptureImageRef>;
    try {
      body = (await response.json()) as Partial<CaptureImageRef>;
    } catch (err) {
      return { outcome: 'unreachable', status: response.status, detail: `bad JSON: ${String(err)}` };
    }
    // 🔴 CHECKED, NOT CAST, AND THE KEY-WITHOUT-A-GRANT CASE IS THE REASON. A 200 whose body
    // lost the grant — a proxy that rewrote it, a platform half-deployed — would otherwise
    // produce a reference the composer happily puts in the payload, and the post would be
    // refused in full with *"the image reference needs a key and a grant"*. Degrading here
    // costs the picture; passing it on costs the question.
    if (typeof body?.key !== 'string' || typeof body?.grant !== 'string') {
      return { outcome: 'unreachable', status: response.status, detail: 'the upload answered no key and grant' };
    }
    return {
      outcome: 'ok',
      value: {
        key: body.key,
        grant: body.grant,
        // ⚠️ Ours when the platform does not say, because the intake requires a positive
        // number and refuses the whole post without one.
        bytes: typeof body.bytes === 'number' && body.bytes > 0 ? body.bytes : bytes.byteLength,
        contentType: typeof body.contentType === 'string' ? body.contentType : 'image/png'
      }
    };
  }

  /** UNI-016 — answer, on the same terms. An answer may carry a graph of its own. */
  answer(
    threadId: string,
    input: { body: string; attachments?: PostAttachment[] }
  ): Promise<Write<AnswerAccepted>> {
    return this.post<AnswerAccepted>(`/api/v1/bench/threads/${encodeURIComponent(threadId)}/posts`, input);
  }

  /**
   * NAT-007 AC6 — mark the answer that solved it.
   *
   * 🔴 **The route decides who may, and it decides it in the transaction that moves the row** —
   * `acceptAnswer` reads `bench_threads.author_account_id` and throws `[bench-accept-not-asker]`
   * before touching anything. So this method sends the request for anybody who asks and reports
   * what came back; `threadwrites.ts` decides only whether the VERB is drawn. ⚠️ The two are
   * separate on purpose. The editor cannot see `author_account_id` at all — NAT-006 removed it
   * from every read payload as its own AC4 failure — so a client-side gate is a guess about
   * handles, and a guess is a fine reason to hide a button and a terrible reason to be the only
   * check.
   *
   * ⚠️ **200, not 201.** The accept route answers `Response.json({pointsAwarded})` with no status,
   * unlike `/posts`, which is 201. Both are `response.ok` and `post()` reads neither, which is why
   * this is a note rather than a branch.
   */
  acceptAnswer(threadId: string, postId: string): Promise<Write<{ pointsAwarded: number }>> {
    return this.post<{ pointsAwarded: number }>(
      `/api/v1/bench/threads/${encodeURIComponent(threadId)}/accept`,
      { postId }
    );
  }

  /**
   * FB-001 AC1 — edit a post you wrote. `PATCH`, 200.
   *
   * 🔴 **THE ROUTE DECIDES WHO MAY, and this method sends for anybody who asks** — the same
   * split {@link acceptAnswer} argues, for the same reason: NAT-006 removed
   * `author_account_id` from every read payload, so the editor cannot see who wrote a post
   * and any client-side check is a guess about handles. A guess is a fine reason to hide a
   * button and a terrible reason to be the only check. `editPost` in the platform's
   * `bench.ts` raises `[bench-edit-not-author]` before touching the row.
   *
   * ⚠️ A non-author gets `refused` with the platform's sentence, NOT `absent` — a 403,
   * because the post demonstrably exists. `absent` stays reserved for D15's 404.
   */
  editPost(threadId: string, postId: string, body: string): Promise<Write<{ editedAt: string }>> {
    return this.write<{ editedAt: string }>(
      'PATCH',
      `/api/v1/bench/threads/${encodeURIComponent(threadId)}/posts/${encodeURIComponent(postId)}`,
      { body }
    );
  }

  /**
   * FB-001 — the markdown SOURCE of your own post, so the composer has something to edit.
   *
   * 🔴 A `Read`, not a `Write`, because it is one — and it is the reason this verb needs a
   * route at all: the thread payload carries `blocks`, never the markdown, so there is
   * nothing in what the editor has already fetched that an edit box could be filled with.
   *
   * ⚠️ **`absent` here means "not yours", not only "D15 refused you"**, and the two are
   * deliberately one answer: the platform serves this to the author alone and gives everybody
   * else `notFound()`'s bytes. A caller must therefore not narrate `absent` as an error.
   */
  postSource(threadId: string, postId: string): Promise<Read<{ body: string }>> {
    return this.get<{ body: string }>(
      `/api/v1/bench/threads/${encodeURIComponent(threadId)}/posts/${encodeURIComponent(postId)}`
    );
  }

  /**
   * FB-001 AC2 — withdraw a thread you asked, while nobody else has answered. `DELETE`, 204.
   *
   * 🔴 **`Write<void>`, and the 204 branch in {@link write} is what makes it work.** An empty
   * body is not JSON; without that branch a successful delete comes back `unreachable` and
   * the person is told the community is down about a thread that is already gone.
   *
   * ⚠️ **An answered thread answers `refused` with a 409 and a sentence worth showing**:
   * *"somebody has answered this thread, so it is part of their record too"*. D7 declined
   * hide-after-answers, so that refusal is final — and a caller that swallowed the detail
   * would leave a person pressing a button that will never work, with no reason given.
   */
  deleteThread(threadId: string): Promise<Write<void>> {
    return this.write<void>(
      'DELETE',
      `/api/v1/bench/threads/${encodeURIComponent(threadId)}`,
      undefined
    );
  }

  /**
   * ⚠️ Not a `get()` with a method parameter. The two differ in more than the verb — a body,
   * a content type, a distinct outcome union and a 401 branch — and threading four
   * conditionals through one function to save a dozen lines is how the read path acquires a
   * bug that only the write path can trigger.
   */
  private post<T>(path: string, body: unknown): Promise<Write<T>> {
    return this.write<T>('POST', path, body);
  }

  /**
   * 🆕 FB-001 GENERALISED `post()` INTO THIS, and the argument the header makes against
   * folding the READ path in does not apply here.
   *
   * That note says a `get()` with a method parameter would thread four conditionals through
   * one function, because a read and a write differ in a body, a content type, an outcome
   * union and a 401 branch. `PATCH` differs from `POST` in **none** of those — same body,
   * same headers, same `Write<T>`, same status table — so a second copy of that table is
   * exactly the *"one edit away from disagreeing with itself"* arrangement `bench-http.ts`
   * warns about, and this file has already found three holes in that table one status at a
   * time. One copy, three verbs.
   *
   * ⚠️ `DELETE` passes `undefined` for the body and sends none.
   */
  private async write<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown
  ): Promise<Write<T>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    // ⚠️ No `content-type` when there is no body. A DELETE announcing it is sending JSON and
    // then sending nothing is a request the platform reads as a malformed body — and
    // `apiwrite.ts`'s `bodyOptional` accepts the EMPTY body, not a broken one.
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}${path}`, {
        headers,
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch (err) {
      return { outcome: 'unreachable', status: null, detail: String(err) };
    }

    if (response.status === 401) return { outcome: 'unauthenticated' };
    if (response.status === 404) return { outcome: 'absent' };
    // 🔴 429 IS A REFUSAL, NOT AN OUTAGE, and it fell through to `unreachable` until UNI-006's
    // bridge needed it. The platform rate-limits writes at 30/minute and says how long to wait;
    // rendering that as "could not reach the community" would tell a learner their network was
    // down while the platform was answering them precisely. `ratelimit.ts` argues the same point
    // from the other side: a caller learning it is throttled learns a fact about ITSELF, which
    // is exactly what a polling client needs in order to stop.
    if (response.status === 429) {
      const after = response.headers.get('retry-after');
      const seconds = after && /^\d+$/.test(after) ? Number(after) : null;
      return {
        outcome: 'refused',
        detail: seconds
          ? `Too many requests — try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
          : 'Too many requests — try again shortly.'
      };
    }
    // 🔴 409 IS A REFUSAL WITH A FIX IN IT, and it fell through to `unreachable` until UNI-007's
    // caller needed it — the same hole 429 had, one status along. `POST /api/v1/me/path/project`
    // answers `409 {error: "take the intake first"}`, and API.md §6 gives the RFP response cap
    // the same status. Both are sentences a learner can act on; both read as "the community is
    // down" without this branch. ⚠️ The rule this keeps failing is that the mapping table's
    // completeness is a property of the ROUTES, not of the client — every status the platform
    // deliberately chooses needs a home here, and a status with no home defaults to the one
    // outcome that blames the network.
    // 🔴 413 IS A REFUSAL WITH A FIX IN IT, AND IT IS THE THIRD TIME THIS EXACT HOLE HAS BEEN
    // FOUND HERE — after 429 (UNI-006) and 409 (UNI-007), each discovered by the caller that
    // needed it rather than by anybody auditing the table. NAT-009's `serveCommunityWrite`
    // answers 413 with the byte cap in the sentence; without this branch a person whose response
    // is too long is told the community could not be reached, and retries the same body forever.
    //
    // ⚠️ **The rule this file keeps failing is in its own comment two branches down**: the
    // mapping's completeness is a property of the ROUTES, not of the client. It is stated, it is
    // true, and nothing enforces it — which is why the count is three.
    if (
      response.status === 400 ||
      response.status === 403 ||
      response.status === 409 ||
      response.status === 413
    ) {
      // 🔴 The platform's own words, and it chooses them for this. `bench-http.ts` maps every
      // refusal through one table precisely so that a caller *"learns THAT it was refused,
      // and for the rules that are about their own input, enough to fix it"* — while never
      // learning that D15 exists. Substituting our own sentence here would either lose the
      // actionable half or re-invent the half that was withheld on purpose.
      const detail = await response
        .json()
        .then((payload: { error?: string }) => payload?.error ?? `HTTP ${response.status}`)
        .catch(() => `HTTP ${response.status}`);
      return { outcome: 'refused', detail };
    }
    if (!response.ok) {
      return { outcome: 'unreachable', status: response.status, detail: `HTTP ${response.status}` };
    }
    // 🔴 FB-001 — 204 HAS NO BODY, AND WITHOUT THIS IT READS AS AN OUTAGE. `DELETE
    // /bench/threads/:id` answers `204` with nothing, `response.json()` throws on empty, and
    // the catch below reports `unreachable` — so a delete that SUCCEEDED would tell the
    // person the community could not be reached, and they would press it again on a thread
    // that is already gone. This is the same hole the header counts three times for 429, 409
    // and 413, found once more by the caller that needed it.
    if (response.status === 204) return { outcome: 'ok', value: undefined as T };

    try {
      return { outcome: 'ok', value: (await response.json()) as T };
    } catch (err) {
      return { outcome: 'unreachable', status: response.status, detail: `bad JSON: ${String(err)}` };
    }
  }

  me(): Promise<Read<MeResponse>> {
    return this.get<MeResponse>('/api/v1/me');
  }

  home(): Promise<Read<CommunityHome>> {
    return this.get<CommunityHome>('/api/v1/community/home');
  }

  threads(): Promise<Read<ForumState>> {
    return this.get<ForumState>('/api/v1/community/threads');
  }

  /**
   * NAT-007 — one thread, with every post in it.
   *
   * 🔴 **The only read on this client that does not hand the payload straight back.** See
   * {@link readThreadDetail} for what it checks and, more importantly, for the one difference
   * from the wire that it introduces on purpose.
   *
   * ⚠️ **A payload this client could not read is `unreachable`, not `absent`.** The distinction
   * is D15's and it is load-bearing: `absent` means *the platform says this surface does not
   * exist for you* and is drawn as nothing at all, so answering it for a malformed body would
   * make a platform bug look like a school policy — and would hide the bug behind the one state
   * nobody is allowed to narrate. A body we could not parse is our problem, it is retryable, and
   * it says so.
   */
  async thread(threadId: string): Promise<Read<ThreadDetail>> {
    const read = await this.get<{ thread?: unknown }>(
      `/api/v1/bench/threads/${encodeURIComponent(threadId)}`
    );
    if (read.outcome !== 'ok') return read;

    const detail = readThreadDetail(read.value?.thread);
    if (!detail) {
      return { outcome: 'unreachable', status: null, detail: 'the thread payload could not be read' };
    }
    return { outcome: 'ok', value: detail };
  }

  /**
   * NAT-008 — one page of the directory.
   *
   * ⚠️ **`limit` and `offset` only, because those are the only two the route reads.** It takes
   * `availableForWork` and `offersCoaching` as well, and this client does not send them: the
   * editor filters over rows so that its facets and its search agree with each other and with
   * the web, and a client that filtered *some* dimensions on the server and the rest locally
   * would have two producers of one list. `readDirectory` is the caller.
   *
   * 🔴 **There is deliberately no `q` parameter here.** Sending one would be silently ignored —
   * measured, with a control; see {@link readDirectory}.
   */
  async people(window: { limit?: number; offset?: number } = {}): Promise<Read<Paged<PersonSummary>>> {
    const search = new URLSearchParams();
    if (window.limit !== undefined) search.set('limit', String(window.limit));
    if (window.offset !== undefined && window.offset > 0) search.set('offset', String(window.offset));
    const query = search.toString();

    const read = await this.get<{ items?: unknown; page?: unknown }>(
      `/api/v1/community/people${query === '' ? '' : `?${query}`}`
    );
    if (read.outcome !== 'ok') return read;

    const raw = Array.isArray(read.value?.items) ? read.value.items : null;
    // ⚠️ `unreachable`, never `absent`: see `thread()` for the full argument. A body we could not
    // read is our problem and is retryable; `absent` is a statement about the viewer's permission
    // that must never be produced by a parse failure.
    if (!raw) {
      return { outcome: 'unreachable', status: null, detail: 'the directory payload could not be read' };
    }

    const items: PersonSummary[] = [];
    // 🔴 A row this client cannot read is DROPPED, and the page's `total` is left alone. The two
    // then disagree, `readDirectory` reports `complete: false`, and the surface says it is showing
    // part of the directory — which is true. Padding `total` down to match would hide a payload
    // problem behind a number that looked consistent.
    for (const entry of raw) {
      const person = readPersonSummary(entry);
      if (person) items.push(person);
    }

    return { outcome: 'ok', value: { items, page: readPageInfo(read.value?.page, items.length) } };
  }

  /**
   * NAT-008 — one public profile.
   *
   * ⚠️ **The path is `people/{handle}`, where the web's page is `/u/{handle}`.** The platform
   * chose the difference deliberately (`docs/API.md` maps every endpoint to its page): `/u/` is a
   * short URL a person types, and this is a path a program builds after listing `/people`.
   *
   * 🔴 **A 404 here is `absent`, and that is right for all three of the things it can mean.** A
   * private profile, a hidden profile and a handle that never existed are one answer on the wire
   * — UNI-003's *"404, not a stub"* — and D15's refusal is the same bytes again. The editor must
   * not tell them apart, because telling them apart is the disclosure the platform declined to
   * make. `peopleview.ts` draws all four as *"there is no public profile here"*.
   */
  async person(handle: string): Promise<Read<PersonProfile>> {
    const read = await this.get<{ item?: unknown }>(
      `/api/v1/community/people/${encodeURIComponent(handle)}`
    );
    if (read.outcome !== 'ok') return read;

    const profile = readPersonProfile(read.value?.item);
    if (!profile) {
      return { outcome: 'unreachable', status: null, detail: 'the profile payload could not be read' };
    }
    return { outcome: 'ok', value: profile };
  }

  /**
   * NAT-009 AC1 — the work board.
   *
   * ⚠️ **`state` is the ONE filter this endpoint takes** (`open` | `closed`), and an unrecognised
   * value is ignored rather than refused — the platform's reading, so a polling client cannot
   * turn a typo into an outage. 🔴 **There is no `q`**, exactly as `/people` has none: a keyword
   * filter is the client's job over rows it holds, and `rfpboardview.ts` reports the bound it
   * searched over. Fifth endpoint in this API with no keyword parameter.
   *
   * ⚠️ **Readable signed out**, as `/rfps` is. A board that demanded an account to read would be
   * stricter than the site it mirrors, which inverts the phase's first principle.
   */
  async rfps(
    window: { limit?: number; offset?: number; state?: 'open' | 'closed' } = {}
  ): Promise<Read<Paged<RfpSummary>>> {
    const search = new URLSearchParams();
    if (window.limit !== undefined) search.set('limit', String(window.limit));
    if (window.offset !== undefined && window.offset > 0) search.set('offset', String(window.offset));
    if (window.state !== undefined) search.set('state', window.state);
    const query = search.toString();

    const read = await this.get<{ items?: unknown; page?: unknown }>(
      `/api/v1/community/rfps${query === '' ? '' : `?${query}`}`
    );
    if (read.outcome !== 'ok') return read;

    const raw = Array.isArray(read.value?.items) ? read.value.items : null;
    // ⚠️ `unreachable`, never `absent`: a body we could not read is our problem and is
    // retryable, where `absent` is a statement about the viewer's permission. See `thread()`.
    if (!raw) {
      return { outcome: 'unreachable', status: null, detail: 'the work board payload could not be read' };
    }

    const items: RfpSummary[] = [];
    for (const entry of raw) {
      const rfp = readRfpSummary(entry);
      if (rfp) items.push(rfp);
    }
    return { outcome: 'ok', value: { items, page: readPageInfo(read.value?.page, items.length) } };
  }

  /**
   * NAT-009 AC1 — one request, opened to its full brief.
   *
   * 🔴 **A 404 is `absent` and must not be narrated as a removal.** `getRfp` returns null for a
   * hidden request and for a missing one, deliberately — *"a stub page is a disclosure"* — and
   * D15's refusal is the same bytes again. Three meanings, one answer, and `docs/API.md` §4
   * forbids a client from picking one.
   */
  async rfp(id: string): Promise<Read<RfpSummary>> {
    const read = await this.get<{ item?: unknown }>(
      `/api/v1/community/rfps/${encodeURIComponent(id)}`
    );
    if (read.outcome !== 'ok') return read;
    const rfp = readRfpSummary(read.value?.item);
    if (!rfp) {
      return { outcome: 'unreachable', status: null, detail: 'the request payload could not be read' };
    }
    return { outcome: 'ok', value: rfp };
  }

  /**
   * NAT-009 AC3 — what this caller has sent to the board.
   *
   * 🔴 **`401` here is `unauthenticated`, and that arm exists because this route chose 401 over
   * an empty list.** `/v1/me/gradings` beside it answers `[]` signed out because it is a poll;
   * this is a screen a person opens to check on something they sent, and *"you have sent
   * nothing"* is a lie to tell somebody whose session expired. `get()` already separates the two.
   */
  async myRfpResponses(
    window: { limit?: number; offset?: number } = {}
  ): Promise<Read<Paged<MyRfpResponse>>> {
    const search = new URLSearchParams();
    if (window.limit !== undefined) search.set('limit', String(window.limit));
    if (window.offset !== undefined && window.offset > 0) search.set('offset', String(window.offset));
    const query = search.toString();

    const read = await this.get<{ items?: unknown; page?: unknown }>(
      `/api/v1/me/rfp-responses${query === '' ? '' : `?${query}`}`
    );
    if (read.outcome !== 'ok') return read;

    const raw = Array.isArray(read.value?.items) ? read.value.items : null;
    if (!raw) {
      return { outcome: 'unreachable', status: null, detail: 'your responses could not be read' };
    }
    const items: MyRfpResponse[] = [];
    for (const entry of raw) {
      const row = readMyRfpResponse(entry);
      if (row) items.push(row);
    }
    return { outcome: 'ok', value: { items, page: readPageInfo(read.value?.page, items.length) } };
  }

  /**
   * NAT-009 AC2 — respond to a request for work.
   *
   * 🔴 **THE ROUTE THIS CALLS DID NOT EXIST UNTIL 2026-08-20, AND NEITHER DID ANY OTHER CALLER OF
   * THE THING BEHIND IT.** `respondToRfp` shipped with UNI-004 and its only callers anywhere were
   * two test files; the web's `/rfps/[id]` still says *"responding needs an account, which arrives
   * with sign-in"*. So the editor is the only client that can answer a request for work at all —
   * the second surface in this phase where that was true, after NAT-007's answer and accept.
   *
   * ⚠️ **`post()` already carries every status this route chooses**: 400, 403, 409 and 429 all
   * become `refused` with the platform's own sentence, 401 is `unauthenticated`, 404 is `absent`.
   * 🔴 That was not free — `409` fell through to `unreachable` until UNI-007 needed it, which
   * would have told a builder whose response cap was spent that their network was down. **Do not
   * re-narrow that branch**; this route answers 409 for four different reasons.
   */
  async respond(rfpId: string, input: { message: string }): Promise<Write<ResponseAccepted>> {
    // ⚠️ **`{item: …}` and not a bare body**, unlike `/bench/threads/:id/posts` beside it, which
    // answers `{postId, pointsAwarded}` flat. The bench's writes predate `apishape.ts`; this one
    // is under `/v1/community` and answers §2's item envelope, which `docs/API.md` §6 specified.
    // Unwrapped HERE rather than by the caller, so no view model learns the envelope.
    const write = await this.post<{ item?: unknown }>(
      `/api/v1/community/rfps/${encodeURIComponent(rfpId)}/responses`,
      input
    );
    if (write.outcome !== 'ok') return write;

    const item = (typeof write.value?.item === 'object' && write.value.item !== null
      ? write.value.item
      : {}) as Record<string, unknown>;
    const responseId = typeof item.responseId === 'string' ? item.responseId : '';
    if (!responseId) {
      // 🔴 A 201 whose body we could not read is NOT `ok`, and it is not `refused` either. The
      // response almost certainly landed — so the sentence a caller draws must not say it did
      // not — but this client cannot say what happened, and `unreachable` is the arm whose
      // sentence is *"try again"* rather than *"that was rejected"*.
      return { outcome: 'unreachable', status: null, detail: 'the response was sent but could not be read back' };
    }
    return {
      outcome: 'ok',
      value: { responseId, outcome: typeof item.outcome === 'string' ? item.outcome : '' }
    };
  }

  /**
   * TUT-004 — the tutorials index, with `installable` on each row.
   *
   * ⚠️ Sixth endpoint in this API with **no keyword parameter**. Filtering is the client's job
   * over the rows it holds, and the surface that filters has to report the bound it searched.
   */
  async tutorials(window: { limit?: number; offset?: number } = {}): Promise<Read<Paged<TutorialSummary>>> {
    const search = new URLSearchParams();
    if (window.limit !== undefined) search.set('limit', String(window.limit));
    if (window.offset !== undefined && window.offset > 0) search.set('offset', String(window.offset));
    const query = search.toString();

    const read = await this.get<{ items?: unknown; page?: unknown }>(
      `/api/v1/community/tutorials${query === '' ? '' : `?${query}`}`
    );
    if (read.outcome !== 'ok') return read;

    const raw = Array.isArray(read.value?.items) ? read.value.items : null;
    if (!raw) {
      return { outcome: 'unreachable', status: null, detail: 'the tutorials payload could not be read' };
    }

    const items: TutorialSummary[] = [];
    for (const entry of raw) {
      const row = readTutorialSummary(entry);
      if (row) items.push(row);
    }
    return { outcome: 'ok', value: { items, page: readPageInfo(read.value?.page, items.length) } };
  }

  /**
   * TUT-004 — the bundle behind a tutorial's Install button.
   *
   * 🔴 **`absent` covers three things and the caller must not try to tell them apart**: no such
   * tutorial, not published yet, and no bundle attached. The platform answers one 404 to all
   * three on purpose (`getArticle`: *"a page that says 'this is not published yet' tells a
   * stranger there is something to come back for"*), and D15's refusal is the same bytes again.
   * The panel's button comes from `installable` on the listing, so an `absent` here is a race
   * rather than a state anybody navigates to.
   *
   * 🔴 **A bundle carrying an unsafe path is refused HERE, as `unreachable`, and never reaches
   * a staging directory.** `unreachable` rather than `absent` for the reason `people()` states:
   * a payload this client will not accept is our problem and is retryable; `absent` is a
   * statement about the viewer's permission and must never be produced by a parse failure.
   */
  async tutorialBundle(slug: string): Promise<Read<TutorialBundlePayload>> {
    const read = await this.get<{ item?: unknown }>(
      `/api/v1/community/tutorials/${encodeURIComponent(slug)}/bundle`
    );
    if (read.outcome !== 'ok') return read;

    const item = read.value?.item as Record<string, unknown> | undefined;
    const files = item?.files;
    if (!item || typeof item.slug !== 'string' || !files || typeof files !== 'object' || Array.isArray(files)) {
      return { outcome: 'unreachable', status: null, detail: 'the bundle payload could not be read' };
    }

    const out: Record<string, string> = {};
    for (const [path, contents] of Object.entries(files as Record<string, unknown>)) {
      // 🔴 One bad entry refuses the WHOLE bundle. Dropping it and installing the rest would
      // produce a lesson that is quietly not the lesson that was published — and the dropped
      // file is exactly the one an attacker chose.
      if (!isSafeBundleEntry(path)) {
        return {
          outcome: 'unreachable',
          status: null,
          detail: `the bundle contains an entry that is not a relative path: ${path}`
        };
      }
      if (typeof contents !== 'string') {
        return { outcome: 'unreachable', status: null, detail: `the bundle entry ${path} is not text` };
      }
      out[path] = contents;
    }

    return {
      outcome: 'ok',
      value: {
        slug: item.slug,
        title: typeof item.title === 'string' ? item.title : item.slug,
        version: typeof item.version === 'number' ? item.version : 1,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
        files: out
      }
    };
  }

  /** The URL a platform-installed lesson records as its source, so `reset` can re-pull it. */
  tutorialBundleUrl(slug: string): string {
    return `${this.baseUrl}/api/v1/community/tutorials/${encodeURIComponent(slug)}/bundle`;
  }

  threshold(): Promise<Read<ThresholdResponse>> {
    return this.get<ThresholdResponse>('/api/v1/community/threshold');
  }

  assignments(): Promise<Read<{ assignments: MemberAssignment[] }>> {
    return this.get<{ assignments: MemberAssignment[] }>('/api/v1/me/assignments');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UNI-006's bridge. 🔴 The header's *"it transports and it types"* still holds: not one
  // of these decides anything. Whether a lesson may be pulled is `shelf_item_visible_to`;
  // whether work may be handed in is `submission_gate()`; whether a bundle is acceptable is
  // `submission_evidence_violation()`. All three are in the database, on the far side of
  // the wire, and this client's job is to carry the answer back unedited.
  // ─────────────────────────────────────────────────────────────────────────────

  /** One assignment at its own URL — fresher than the row in a list that may be minutes old. */
  assignment(assignmentId: string): Promise<Read<{ assignment: MemberAssignment }>> {
    return this.get<{ assignment: MemberAssignment }>(
      `/api/v1/me/assignments/${encodeURIComponent(assignmentId)}`
    );
  }

  /** The bundle to install. See {@link AssignmentLesson} — `available: false` is not an error. */
  assignmentLesson(assignmentId: string): Promise<Read<{ lesson: AssignmentLesson }>> {
    return this.get<{ lesson: AssignmentLesson }>(
      `/api/v1/me/assignments/${encodeURIComponent(assignmentId)}/lesson`
    );
  }

  /**
   * "I have this lesson open." Idempotent on the platform, so the editor may call it every
   * time the project is opened without that being a second attempt — and a learner who
   * reopens work they already handed in does not withdraw it.
   */
  startAssignment(assignmentId: string): Promise<Write<{ submissionId: string }>> {
    return this.post<{ submissionId: string }>(
      `/api/v1/me/assignments/${encodeURIComponent(assignmentId)}/start`,
      {}
    );
  }

  /**
   * Hand the work in.
   *
   * ⚠️ `evidence` is narrowed by {@link submittedEvidence} before it gets here, and that is a
   * decision about what leaves the machine rather than a formality — see that function.
   */
  submitAssignment(
    assignmentId: string,
    evidence: Record<string, unknown>
  ): Promise<Write<SubmissionAccepted>> {
    return this.post<SubmissionAccepted>(
      `/api/v1/me/assignments/${encodeURIComponent(assignmentId)}/submit`,
      { evidence }
    );
  }

  /** Gradings by a person that this member has not seen. A poll; signed out is an empty list. */
  gradings(): Promise<Read<{ gradings: GradingNotice[] }>> {
    return this.get<{ gradings: GradingNotice[] }>('/api/v1/me/gradings');
  }

  /** ⚠️ Call this only once the feedback has actually been PUT IN FRONT OF the learner. */
  markGradingSeen(gradingId: string): Promise<Write<{ seen: true }>> {
    return this.post<{ seen: true }>(
      `/api/v1/me/gradings/${encodeURIComponent(gradingId)}/seen`,
      {}
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UNI-007 AC1 — the intake and the path
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * The three questions, and this learner's answers if they have any.
   *
   * ⚠️ **The one read on this client that is useful with `token: null`.** Everything else
   * either needs a viewer or answers the same for everybody; this answers *half* the same for
   * everybody, which is why the questions and the answers are one payload rather than two
   * routes. An editor can therefore draw the form before it has signed anybody in.
   */
  intake(): Promise<Read<IntakeState>> {
    return this.get<IntakeState>('/api/v1/me/intake');
  }

  /**
   * Answer the intake. **Retaking replaces** — the row's primary key is the account.
   *
   * ⚠️ A partial set is a `400` with the platform's sentence, not a merge. `parseIntake`
   * returns null for a missing answer rather than defaulting one, because a path built on a
   * preference nobody expressed gives the learner no way to tell which parts came from them.
   */
  submitIntake(answers: IntakeAnswers): Promise<Write<{ answers: IntakeAnswers }>> {
    return this.post<{ answers: IntakeAnswers }>('/api/v1/me/intake', { answers });
  }

  /**
   * This learner's path.
   *
   * 🔴 **FREE TO CALL, AND THAT IS A PROPERTY OF THE ROUTE RATHER THAN OF THIS METHOD'S
   * RESTRAINT.** Projections are attached from the cache only, so polling this cannot spend a
   * learner's concept budget. Making a projection is {@link projectConcept}, which is a
   * request somebody had to mean. ⚠️ Do not "helpfully" project the missing ones from a
   * refresh path — that is the same money-spending read the platform split this route to avoid.
   *
   * 🔴 **This is the first read on this API that can answer `unauthenticated`.** See
   * {@link Read} — the variant exists because of this route.
   */
  path(): Promise<Read<PathState>> {
    return this.get<PathState>('/api/v1/me/path');
  }

  /**
   * Make — or re-read — the tier-1 projection for one concept.
   *
   * 🔴 **Idempotent, and it spends money.** At most one model call per `(learner, concept)`
   * pair ever: the pair is a primary key claimed *before* the model is called, so two
   * concurrent requests are one call and the loser reads the winner's row. Calling this twice
   * is not a bug and is not free of consequence either — the second answer is the first one,
   * with `outcome.fresh: false` saying so.
   *
   * ⚠️ **The concept must be one of the caller's own steps**, and anything else is the same
   * `absent` every other refusal here answers with. The body is not a free text field that
   * reaches a model — `buildProjectionPrompt` exists to make that impossible and its own caller
   * is the only thing that could undo it.
   */
  projectConcept(concept: string): Promise<Write<ProjectionAccepted>> {
    return this.post<ProjectionAccepted>('/api/v1/me/path/project', { concept });
  }
}

/**
 * Where the entry point goes.
 *
 * 🔴 IT READS THE FIELD. There is no arithmetic here, no `>= 30`, and no copy of D16's
 * constants — and the spec proves that by handing it a payload whose components are all unmet
 * while `entryPoint` says `in-editor-mirror`, and requiring the mirror. A client that
 * recomputed would disagree with the web the first time D16 is re-ruled, and D16 says out
 * loud that its numbers are *"a floor, not a target, and cheap to re-rule."*
 *
 * ⚠️ The `unreachable` and `absent` cases both fall back to the browser, and that is D16's
 * own posture rather than a defensive default: *the entry point exists either way and always
 * goes somewhere real.* An editor that cannot reach the platform still has a working link to
 * a website.
 */
/**
 * 🔴 **RETIRED AS A GATE, 2026-08-19 (D21). It is kept, and it is called by nothing.**
 *
 * D16 said the editor surfaces the community only past a threshold and otherwise opens the
 * browser; this function was that decision, in code. **D21 reverses D16** — the community panel
 * ships unconditionally — so there is nothing left for the return value to decide.
 *
 * ⚠️ **It was already called by nothing, and that is the finding rather than a tidy-up note.**
 * On 2026-08-19 the only callers of this function were its own three specs. *Build the caller*,
 * eighth instance in this phase, and the first where the uncalled function was a **ruling's
 * enforcement** — so D16 did not gate the surface, it substituted for building one.
 *
 * ✅ **Not deleted**, deliberately. The specs beneath it prove the client follows the API's
 * `entryPoint` rather than recomputing the threshold, which is D15's rule and is still live: the
 * panel now shows all three components as a **readout**, and a client that recomputed them would
 * disagree with the web the first time the numbers move. Retiring a check needs a higher bar than
 * adding one, and "its ruling was reversed" clears the bar for the *gate*, not for the *parse*.
 */
export function entryPointFor(reading: Read<ThresholdResponse>): 'in-editor-mirror' | 'browser' {
  return reading.outcome === 'ok' ? reading.value.entryPoint : 'browser';
}

/**
 * The composed home, with every stranger-authored body already through the boundary.
 *
 * ⚠️ Today the API's list payloads carry no body at all — deliberately, so nothing has to be
 * sanitised on this path. This function exists for the surface that fetches ONE body, and it
 * is the only door: a view calls this and receives `Block[]`, which has nowhere to put markup.
 */
export function asPostBody(markdown: string | null | undefined): Block[] {
  return parsePostBody(markdown);
}

/**
 * A poll, with the caller owning the clock.
 *
 * Returns a stop function. ⚠️ Nothing in this module calls it — the caller schedules the pull,
 * which is what makes "editor-outbound only" checkable rather than promised: there is no
 * inbound connection to open because there is no connection this module holds.
 */
export function poll<T>(
  read: () => Promise<Read<T>>,
  onResult: (value: Read<T>) => void,
  options: { everyMs: number; setIntervalImpl?: typeof setInterval; clearIntervalImpl?: typeof clearInterval }
): () => void {
  const setIntervalFn = options.setIntervalImpl ?? setInterval;
  const clearIntervalFn = options.clearIntervalImpl ?? clearInterval;
  const handle = setIntervalFn(() => {
    void read().then(onResult);
  }, options.everyMs);
  return () => clearIntervalFn(handle as unknown as Parameters<typeof clearInterval>[0]);
}
