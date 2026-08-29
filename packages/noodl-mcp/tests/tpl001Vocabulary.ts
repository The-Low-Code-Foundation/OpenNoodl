/**
 * TPL-001 — the words the members' area is built out of.
 *
 * Three files author this template and all three name the same collections,
 * roles, endpoints and access rules. They are here rather than restated in each
 * because a template's **policy and its graphs are the same claim written
 * twice**: `nodegx.security.json` says who may read `Announcement`, and every
 * query and write node in the app assumes it. A drifting spelling in either half
 * is an app that is green everywhere and refused at run time — and the spec that
 * grades the policy against the graphs (`tpl001Template.test.ts`) can only do
 * that if there is one place to compare both to.
 *
 * ⚠️ **The policy file itself does NOT import this.** It is hand-authored JSON
 * (SB-015's rule, restated in TPL-001 §3: *the product is the policy here*), so
 * the constants below are what a spec holds it to, not what generates it. A
 * generated policy would be a policy nobody read.
 *
 * @module noodl-mcp/tests/tpl001Vocabulary
 */

// ── The router ───────────────────────────────────────────────────────────────

/** The router every page registers into. Cross-file contract — see `APP_NODES`. */
export const ROUTER = 'Main';

// ── The four standings, and why they are not a status column ─────────────────

/**
 * 🔴 **A member is a role membership, and nothing in this template mirrors it.**
 *
 * `roles/SystemRoles.ts` is the only way into `_Role` from a graph, and
 * `users/SystemUsers.ts` guarantees a user it creates resolves to `roles: []`.
 * So the four states an app can be looking at are:
 *
 * | who | how it is expressed |
 * |---|---|
 * | a visitor | no session |
 * | a **pending** member | signed in, `roles: []` |
 * | a member | `role:member` |
 * | a moderator | `role:admin` |
 *
 * 🔴 **And that is why no rule in the policy may say `authenticated`.** It is
 * true for the pending user — the person who asked to join ten seconds ago and
 * whom nobody has approved — and it is also the value a collection read falls
 * back to when a deployed backend has `devOpen: false` and nothing else. The
 * failure mode is the default, so it must not also be a spelling anybody typed
 * on purpose.
 */
export const ROLE_MEMBER = 'member';
export const ROLE_MODERATOR = 'admin';

/**
 * What `myStanding` answers, and the only vocabulary the browser branches on.
 *
 * ⚠️ `unknown` is a real answer rather than an error code: a roles read that
 * fails must not be reported as "you are not a member" (which fails shut but
 * lies to a member) nor as a member (which fails open). The page shows a "we
 * could not check" line, and shows no content — the failure is legible and the
 * data still never loads.
 */
export const STANDING_VISITOR = 'visitor';
export const STANDING_PENDING = 'pending';
export const STANDING_MEMBER = 'member';
export const STANDING_MODERATOR = 'moderator';
export const STANDING_UNKNOWN = 'unknown';

// ── The collections ──────────────────────────────────────────────────────────

/** The association itself: one row, written by the setup flow, read by the world. */
export const COLLECTION_ASSOCIATION = 'Association';
/** What the moderators post. Members read; nobody else may. */
export const COLLECTION_ANNOUNCEMENT = 'Announcement';
/** What is coming up. Same readership as an announcement. */
export const COLLECTION_MEETING = 'Meeting';
/** A person asking to join. Written only by a cloud function; read only by moderators. */
export const COLLECTION_REQUEST = 'MemberRequest';

/**
 * Who belongs. Written only by a cloud function, read only by moderators.
 *
 * 🔴 **This is a PROJECTION, and the fact it projects lives in `_Role`.**
 * Richard's ruling, 2026-08-28, taken with the cost stated: nothing enumerates a
 * role's members — `getuserroles` reads one user's roles and `_User` is a system
 * class no browser query can reach — so *"see the member list"* (§3) is not
 * buildable without writing the membership down a second time.
 *
 * ⚠️ **So it can drift, and the direction is knowable.** Every row is written by
 * the same endpoint that adds the role, in the same request; nothing else writes
 * one. What is NOT covered is a role changed by hand — through the backend's own
 * admin surface, or a `_Role` edit — which leaves a member in `_Role` and no row
 * here, or a row here for somebody no longer in `_Role`. The directory is
 * therefore *who this app admitted*, which is the honest thing for it to say,
 * and {@link DIRECTORY_PROJECTION_NOTE} says it on the screen rather than only
 * here.
 */
export const COLLECTION_MEMBER = 'Member';

/** Every collection this template ships, for the spec that holds the policy to them. */
export const TPL001_COLLECTIONS = [
  COLLECTION_ASSOCIATION,
  COLLECTION_ANNOUNCEMENT,
  COLLECTION_MEETING,
  COLLECTION_REQUEST,
  COLLECTION_MEMBER
];

/**
 * The two standings a directory row can carry, and they are not the role names.
 *
 * ⚠️ `ROLE_MODERATOR` is the string `admin`, which is a machine word: P75 found
 * the cost of drawing one at a person when a template card rendered the slug
 * `starter`. The row stores the standing and the row component renders
 * {@link STANDING_LABELS} — so what is written is stable and what is read is
 * English.
 */
export const MEMBER_STANDING_MEMBER = STANDING_MEMBER;
export const MEMBER_STANDING_MODERATOR = STANDING_MODERATOR;

/** What a directory row draws for each standing. Never the role name. */
export const STANDING_LABELS: Record<string, string> = {
  [MEMBER_STANDING_MODERATOR]: 'Moderator',
  [MEMBER_STANDING_MEMBER]: 'Member'
};

// ── The endpoints ────────────────────────────────────────────────────────────

/** Creates the first moderator, against a setup token. Public; the token is the gate. */
export const FN_CLAIM = 'claimAssociation';
/** Files a request to join, creating the account it names. Public; rate-limited. */
export const FN_REQUEST_ACCESS = 'requestAccess';
/** Answers "what am I here" for the current session. Public; a stranger gets `visitor`. */
export const FN_MY_STANDING = 'myStanding';
/** Approves or declines one request. 🔴 `role:admin` — it is the door that mints members. */
export const FN_DECIDE = 'decideMembership';

export const TPL001_FUNCTIONS = [FN_CLAIM, FN_REQUEST_ACCESS, FN_MY_STANDING, FN_DECIDE];

/** The backend secret the setup flow compares against. Never a project file value. */
export const SETUP_TOKEN_SECRET = 'ASSOCIATION_SETUP_TOKEN';

// ── Record-level access rules ────────────────────────────────────────────────

/**
 * ⚠️ **A collection rule and a record ACL are two different gates and this
 * template sets both.** The policy decides whether the query is allowed to run
 * at all; the ACL written here decides which rows come back once it is. SB-004's
 * rule — *"a record born without the rule is readable the instant the collection
 * rule widens"* — is the reason the writes carry them rather than relying on the
 * policy alone.
 *
 * ⚠️ The `id` of a rule may not contain a hyphen: `setAccessControl` reads the
 * port name as `acl-<id>-<field>` through `name.split('-')`, so a two-word id
 * silently writes the wrong field.
 */

/** Moderators read and write; nobody else is named. */
export const MODERATOR_ONLY_RULES = {
  accessControl: [{ id: 'admin', label: 'Moderators' }],
  'acl-admin-target': 'role',
  'acl-admin-role': ROLE_MODERATOR,
  'acl-admin-read': true,
  'acl-admin-write': true
};

/**
 * Members read, moderators write — the shape of every announcement and meeting.
 *
 * 🔴 **Two rules and not one.** Roles here are flat and a moderator is not
 * implicitly a member (`role:admin` and `role:member` are separate rows in
 * `_Role`), so a row carrying only the member rule is a row the moderator who
 * posted it cannot read back.
 */
export const MEMBERS_READ_RULES = {
  accessControl: [
    { id: 'admin', label: 'Moderators' },
    { id: 'member', label: 'Members' }
  ],
  'acl-admin-target': 'role',
  'acl-admin-role': ROLE_MODERATOR,
  'acl-admin-read': true,
  'acl-admin-write': true,
  'acl-member-target': 'role',
  'acl-member-role': ROLE_MEMBER,
  'acl-member-read': true,
  'acl-member-write': false
};

/**
 * The association's own row: the world reads it, moderators write it.
 *
 * It is the one row a stranger is allowed to see, because the landing page is
 * rendered for a stranger and its whole content is this record.
 */
export const ASSOCIATION_RULES = {
  accessControl: [
    { id: 'admin', label: 'Moderators' },
    { id: 'world', label: 'World' }
  ],
  'acl-admin-target': 'role',
  'acl-admin-role': ROLE_MODERATOR,
  'acl-admin-read': true,
  'acl-admin-write': true,
  'acl-world-target': 'everyone',
  'acl-world-read': true,
  'acl-world-write': false
};

// ── Query shapes ─────────────────────────────────────────────────────────────

/**
 * Both `runOnChange` boxes off: the query does not fetch when the graph is built.
 *
 * ⚠️ **Only correct where something else triggers it.** SB-005's correction: on
 * an UNFILTERED query with these off and no `Do` wire there is no trigger left
 * at all, and the list is empty for ever. Every use in this template pairs it
 * with an explicit `storageFetch` wire — and in the members' area that pairing
 * is the load-bearing half of AC2, because the thing doing the triggering is the
 * standing check.
 */
export const NO_LOAD_TIME_FETCH = {
  'runOnChange-collectionName': false,
  'runOnChange-querySettings': false
};

/** Newest announcement first — the order a noticeboard is read in. */
export const ANNOUNCEMENT_SORT = [{ property: 'postedAt', order: 'descending' }];

/** The next meeting first. */
export const MEETING_SORT = [{ property: 'when', order: 'ascending' }];

/**
 * "Meetings that have not happened yet."
 *
 * `when` is an ISO date string (`YYYY-MM-DD`), which sorts and compares
 * lexicographically, so `greater than or equal to` on a String needs no schema —
 * the same reason SB-004 fell back to `equal to` on a String after `points to`
 * lost its bet: an operator that needs the collection schema is an operator that
 * silently matches everything in a cloud function.
 */
export const UPCOMING_FILTER = {
  combinator: 'and',
  rules: [{ property: 'when', operator: 'greater than or equal to', input: 'today' }]
};

// ── The sentences a person reads ─────────────────────────────────────────────

/**
 * 🔴 **One refusal text, for every way asking to join can fail.**
 *
 * The sharp case is an address that already has an account. Answering "you are
 * already registered" tells a stranger who is a member of this congregation,
 * which is the one fact a members' area exists to keep — so the success text is
 * the same whether an account was created or one already existed, and the
 * request row is filed only in the first case. The join page carries a standing
 * line pointing a returning person at sign-in.
 */
export const REQUEST_SENT_TEXT = 'Thank you. Your request has been passed to the moderators.';
export const REQUEST_REFUSED_TEXT = 'That request could not be sent. Please check the form and try again.';
export const ALREADY_A_MEMBER_HINT = 'Already have an account? Sign in instead.';

/** Setup, and the same one-refusal rule as `claimSite`. */
export const CLAIM_REFUSED_TEXT = 'This members’ area cannot be set up with those details.';

/** The pending person's screen. It is the whole product in one sentence. */
export const PENDING_TEXT =
  'Your request to join is with the moderators. You will be able to see announcements and meetings once it has been approved.';

/** The roles read failed. Not "you are not a member" — see `STANDING_UNKNOWN`. */
export const STANDING_UNKNOWN_TEXT = 'We could not check your membership just now. Please try again in a moment.';

/**
 * AC6 — a template ships graphs, not rows, so these are the first screens every
 * person who installs it sees.
 */
export const NO_ANNOUNCEMENTS_TEXT =
  'Nothing has been posted yet. When a moderator posts an announcement it will appear here.';
export const NO_MEETINGS_TEXT = 'No meetings are in the diary yet.';
export const NO_REQUESTS_TEXT = 'Nobody is waiting to join.';

/**
 * The directory's empty state.
 *
 * ⚠️ It is reachable on a fresh install only for a moment: `claimAssociation`
 * writes the founding moderator's own row, so the first person to open this
 * screen normally sees themselves. It stays because the screen must not be
 * blank if that write ever failed — the association is still set up in that
 * case (`mark.failure` answers `res`, deliberately), so a moderator can reach a
 * directory with nothing in it.
 */
export const NO_MEMBERS_TEXT = 'Nobody has been admitted yet. People appear here once a moderator approves them.';

/**
 * 🔴 **The screen says what it is, because a projection that lies silently is
 * worse than one nobody built.**
 *
 * The directory lists everybody this app admitted. A person given `role:member`
 * by hand — outside `decideMembership` — is a member and is not on this list.
 * That sentence is on the page rather than only in {@link COLLECTION_MEMBER}'s
 * comment, because the person who needs it is the moderator reading the list,
 * not the next developer.
 */
export const DIRECTORY_PROJECTION_NOTE =
  'Everybody admitted through this app. Somebody given access directly on the backend will not appear here.';
