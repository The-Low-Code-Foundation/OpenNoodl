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
import type { PostAttachment } from './nodeartifact';
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
};

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

/**
 * 🔴 A community read is one of three outcomes and `absent` is not an error.
 *
 * A client that modelled the 404 as a failure would retry it, log it, or show a "could not
 * reach the community" banner — and a pupil whose school switched the community off would get
 * an error message about a surface D15 says must not appear to them at all. *Absent means
 * absent* is a property of the client's type, not of its rendering.
 */
export type Read<T> =
  | { outcome: 'ok'; value: T }
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

  /** UNI-016 — answer, on the same terms. An answer may carry a graph of its own. */
  answer(
    threadId: string,
    input: { body: string; attachments?: PostAttachment[] }
  ): Promise<Write<AnswerAccepted>> {
    return this.post<AnswerAccepted>(`/api/v1/bench/threads/${encodeURIComponent(threadId)}/posts`, input);
  }

  /**
   * ⚠️ Not a `get()` with a method parameter. The two differ in more than the verb — a body,
   * a content type, a distinct outcome union and a 401 branch — and threading four
   * conditionals through one function to save a dozen lines is how the read path acquires a
   * bug that only the write path can trigger.
   */
  private async post<T>(path: string, body: unknown): Promise<Write<T>> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json'
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}${path}`, {
        headers,
        method: 'POST',
        body: JSON.stringify(body)
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
    if (response.status === 400 || response.status === 403) {
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
