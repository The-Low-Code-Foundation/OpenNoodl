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
/**
 * ⚠️ **The offer is made ONCE, and it used to be made twice.** The sentence read
 * *"Already have an account? Sign in instead."* — "Sign in instead" reads as a
 * link, is not one, and sat immediately above a separate outline `Sign in`
 * button that is the actual control. REL-002c item 3: one sentence, one
 * control.
 */
export const ALREADY_A_MEMBER_HINT = 'Already have an account?';

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

// ── Taking something down again ──────────────────────────────────────────────

/**
 * 🔴 **The policy always allowed this and the app never offered it.**
 *
 * `nodegx.security.json` grants `role:admin` `delete` on both `Announcement`
 * and `Meeting` — it has since the policy was written, because a moderator who
 * may post is obviously the person who may take a post down. But no graph in
 * the template ever placed a `Delete Record`, so the only way to remove a
 * notice with the wrong date on it was to open the backend's own admin surface.
 * For the person in §1 — a church secretary — that is the same as "impossible",
 * and it is the failure mode of every app in this template's market: the thing
 * you published by mistake stays published.
 *
 * ⚠️ **Found while costing the sample content, and it is what settled it.**
 * Seeding examples into a live association's noticeboard is only defensible if
 * the moderator can take them out again; Richard ruled (2026-08-29) to close
 * this gap and seed nothing, so the empty state stays the first impression.
 *
 * ⚠️ **Removal is on the DETAIL page, never on the row.** A row lives in a
 * `For Each` where a mis-tap is one pixel from the tap that opens it, and the
 * row does not show enough to be sure which notice you are deleting. The detail
 * page shows the whole thing, and it already holds the id.
 */
export const REMOVE_ANNOUNCEMENT_LABEL = 'Remove this announcement';
export const REMOVE_MEETING_LABEL = 'Remove this meeting';

/**
 * The confirm step, which exists because the action cannot be undone.
 *
 * ⚠️ **Two buttons and neither is filled.** `PRIMARY_LABELS` emphasises the one
 * thing a screen is for, and a destructive confirmation is not it — a filled
 * "Yes, remove it" would make the dangerous half the one the eye lands on.
 */
export const CONFIRM_REMOVE_TEXT = 'This cannot be undone. Members will no longer see it.';
export const CONFIRM_REMOVE_YES = 'Yes, remove it';
export const CONFIRM_REMOVE_NO = 'Keep it';

/**
 * The one refusal, and it says what to do next.
 *
 * ⚠️ Unlike the setup and join refusals this one leaks nothing by being plain:
 * the person reading it is a moderator who already holds `role:admin`, and the
 * only ways it fires are a network failure or a record somebody else removed
 * first.
 */
export const REMOVE_FAILED_TEXT = 'That could not be removed just now. Please try again in a moment.';

// ═════════════════════════════════════════════════════════════════════════════
// TPL-002 — telling people something was posted
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 **The flag is ONE field on the `Member` row, and it is written `false`.**
 *
 * Not absent-means-off. The fan-out's filter is `notifyByEmail equal to true`,
 * so an absent field would already be safe — but the account screen has to draw
 * a box, and a box bound to `undefined` is a box that renders neither ticked nor
 * unticked. `decideMembership` writes it explicitly at approval, which is the
 * only moment a `Member` row is born.
 *
 * ⚠️ **Opt-in, and this is the one default in the template with a legal reason
 * rather than a taste one.** TPL-002 §4: these are charities and congregations
 * in the UK and EU, consent is opt-in, and a template shipping opt-out would
 * teach every association that installed it to break the law on the first day.
 */
export const MEMBER_FIELD_NOTIFY = 'notifyByEmail';

/**
 * The one-click token the unsubscribe link carries.
 *
 * 🔴 **It exists because the person clicking it is signed OUT.** TPL-002 AC4 is
 * explicit: from the email, without asking anyone. There is no session on that
 * request and no role to check, so the token IS the authority — which means it
 * must be unguessable, per-member, and must name a row without the caller ever
 * naming one.
 *
 * ⚠️ **It is not a secret the template ships or an HMAC of a backend key.** Both
 * were considered. A keyed digest would need a second provisioned secret beside
 * `ASSOCIATION_SETUP_TOKEN`, and an association that never provisioned it would
 * have unsubscribe links that silently never worked — the exact failure TPL-002
 * §2 exists to avoid one layer up. A stored random token needs no provisioning
 * and fails visibly if it is missing.
 *
 * ⚠️ **Minted lazily as well as at approval.** Every `Member` row written before
 * this feature existed has no token, and a fan-out that skipped those rows would
 * silently mail nobody on an association that had been running for a year. The
 * pump mints one for any row that lacks it, in the same request that mails it.
 */
export const MEMBER_FIELD_UNSUBSCRIBE_TOKEN = 'unsubscribeToken';

/** Reads the caller's own notification setting. `role:member`/`role:admin`. */
export const FN_MY_NOTIFY = 'myNotifySetting';
/**
 * Writes the caller's own notification setting.
 *
 * 🔴 **The row is found from `req.userId` and never from a parameter.** TPL-002
 * §6 calls this the one place row-level ACL is load-bearing, and the shape built
 * here answers that concern by removing the write rather than guarding it: a
 * member has no direct write access to `Member` at all — `create`/`update` stay
 * `nobody` in the policy — and the only id this endpoint will act on is the one
 * the session proves. "Nobody else's row" is then structural rather than a rule
 * somebody has to keep correct.
 */
export const FN_SET_NOTIFY = 'setNotifySetting';
/** Turns the setting off from the email itself. `public` — the token is the gate. */
export const FN_UNSUBSCRIBE = 'unsubscribe';
/** Mails the opted-in members about one announcement. `role:admin`. */
export const FN_NOTIFY_MEMBERS = 'notifyMembers';

/** Every endpoint TPL-002 adds, for the spec that holds the policy to them. */
export const TPL002_FUNCTIONS = [FN_MY_NOTIFY, FN_SET_NOTIFY, FN_UNSUBSCRIBE, FN_NOTIFY_MEMBERS];

/** The two roles allowed to read and set their own preference. Never `authenticated`. */
export const MEMBER_OR_MODERATOR = [`role:${ROLE_MEMBER}`, `role:${ROLE_MODERATOR}`];

/**
 * "Members who asked to be told."
 *
 * ⚠️ `equal to true` and not `is not null`: the field is a boolean the account
 * screen flips both ways, so a row that was ticked and then unticked holds
 * `false` rather than nothing at all.
 *
 * 🔴 **`value`, not `input`, and the difference is the whole rule.** In a
 * `visualFilter` leaf `input` names a PORT the value arrives on (`qp-<name>` on
 * Query Records) and `value` is a literal — `collectFilterParameters` walks the
 * tree collecting `input` names and nothing else. Written as `input: true` this
 * rule named a port called `true` that nothing ever set, and the query returned
 * **every member**: measured, s14, as a send that reached three people when one
 * had opted in. `UPCOMING_FILTER`'s `input: 'today'` is the other shape, and it
 * is correct there because `Pages/Meetings` wires `qp-today`.
 */
export const NOTIFY_FILTER = {
  combinator: 'and',
  rules: [{ property: MEMBER_FIELD_NOTIFY, operator: 'equal to', value: true }]
};

// ── The sentences ────────────────────────────────────────────────────────────

/** The label on the box. It says what will happen, not what the field is called. */
export const NOTIFY_OPT_IN_LABEL = 'Email me when a moderator posts an announcement';

/** Under the box: the two things a person needs to know before ticking it. */
export const NOTIFY_OPT_IN_NOTE =
  'Off unless you turn it on. Every email has a link that turns it off again, and you do not need to sign in to use it.';

export const NOTIFY_SAVED_ON_TEXT = 'Saved. We will email you when something is posted.';
export const NOTIFY_SAVED_OFF_TEXT = 'Saved. We will not email you about new announcements.';
export const NOTIFY_SAVE_FAILED_TEXT = 'That could not be saved just now. Please try again in a moment.';

/** The unsubscribe page, signed out. */
export const UNSUBSCRIBED_TEXT =
  'Done. You will not receive any more emails about new announcements. You are still a member, and you can turn them back on from your account at any time.';
/**
 * ⚠️ **This one DOES distinguish, and that is a departure from the template's
 * one-refusal rule.** Setup and join answer identically however they fail,
 * because a distinguishable refusal there answers *"is this person one of you?"*
 * to a stranger who asked. A token is different: it is 128 bits of randomness
 * that only ever travelled to one address, so "that link did not work" tells a
 * guesser nothing they could act on — and the person it does reach is somebody
 * whose mail client mangled the URL, who otherwise sees a success page and goes
 * on receiving email they asked to stop.
 */
export const UNSUBSCRIBE_FAILED_TEXT =
  'That link did not work. It may have been broken by your email program — try copying the whole address, or turn emails off from your account.';

/**
 * The way back off the unsubscribe page.
 *
 * 🔴 **This exists because Richard REVERSED D39 on 2026-09-04.** D39, 2026-08-29,
 * was that the page names no association and offers no way back, and that the
 * silence was a decision rather than an omission. Asked again on the ruling
 * sheet — *"/unsubscribe carries ~190px of void above its footer"* — his answer
 * was **"Allow a way back after all"**. `tpl001Template.test.ts` §5 existed to
 * catch exactly this reversal being made by accident; it is now made on purpose
 * and §5 is rewritten to the new ruling rather than deleted.
 *
 * ⚠️ **Only the LINK half was reversed.** The other half of D39 — naming the
 * association, which costs a round trip from a mail client — was NOT put to him
 * and stays declined. §5 still asserts this page fetches nothing.
 *
 * ⚠️ **Deliberately NOT in `PRIMARY_LABELS`.** Both notices already tell the
 * reader to use their account, so this is the route they were just sent on —
 * not the point of the page. A filled button here would invent an urgency on a
 * page somebody reached on their way out.
 */
export const UNSUBSCRIBE_BACK_LABEL = 'Sign in to your account';

/** What the moderator is told when the mail went out. `{n}` is filled in the graph. */
export const NOTIFY_SENT_PREFIX = 'Emailed to ';
export const NOTIFY_SENT_SUFFIX_ONE = ' member who asked to be told.';
export const NOTIFY_SENT_SUFFIX_MANY = ' members who asked to be told.';

/**
 * 🔴 **TPL-002 §3, and the whole reason this task is separate from TPL-001.**
 *
 * Nobody ticked the box, so nothing was sent and nothing failed. Said out loud
 * because the alternative — a silent post — is indistinguishable from a post
 * whose emails all failed, and the moderator's next action differs completely.
 */
export const NOTIFY_NOBODY_TEXT = 'Posted. Nobody has asked to be emailed yet, so no emails were sent.';

/**
 * 🔴 **The §3 sentence is not written here, and that is deliberate.**
 *
 * The backend already writes it — `EmailConfigState.notConfiguredReason()`
 * returns *"Email is not configured for this backend: no SMTP host/port set.
 * Configure SMTP in the Backend Services panel (Email section)…"* — and it names
 * the panel, which is the one thing the person reading it has to go and open.
 * The template surfaces that string **verbatim** rather than replacing it with a
 * sentence of its own, so an app built from this template cannot drift out of
 * date with the product's own instructions.
 *
 * What the template owns is the LEAD-IN: the reassurance that the announcement
 * itself was posted, which the backend's message knows nothing about and which
 * is the moderator's first question.
 */
export const NOTIFY_FAILED_LEAD = 'Posted — but the emails could not be sent. ';

/**
 * The partial case, and it exists because the two halves are separately
 * actionable: *some* members were emailed (so do not post it again) and some
 * were not (so somebody has to be told another way).
 */
export const NOTIFY_PARTIAL_PREFIX = ' ';
export const NOTIFY_PARTIAL_SUFFIX = ' could not be sent. ';
/** Nothing reached anybody, and the mailer said nothing about why. */
export const NOTIFY_NONE_SENT_TEXT = 'No emails could be sent.';
/** The lead on the count. The announcement is posted whatever happened to the mail. */
export const NOTIFY_POSTED_LEAD = 'Posted. ';
