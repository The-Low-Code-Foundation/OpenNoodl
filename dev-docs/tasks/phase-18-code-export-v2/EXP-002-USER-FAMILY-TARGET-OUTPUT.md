# EXP-002 — the user family: the target output (session 21)

**Decided on paper before code, like every slice since step 5. Read this before touching Log In /
Log Out / Sign Up / User, the session api stub, or the shared awaited-call action.** This slice is
the second consumer of the asynchronous shape RECORD-VERBS-TARGET §4 settled, and building it is
what turns that shape from *a record-verb feature* into *the vocabulary's general awaited call* —
which is the point of doing it before HTTP and the relation verbs.

Sources read first:
`packages/noodl-viewer-react/src/nodes/std-library/user/login.ts`, `logout.ts`, `signup.ts`
(the `Do` → `schedule…` → `UserService` → `reportOutcomes` funnel, and each node's own
`setError`), and `packages/noodl-runtime/src/nodes/std-library/user/user.ts` (the session
subscription, the getters, `runOnValueChange`, and the SSR note). Corpus: `rank2.ts` re-run at
this session's HEAD, `probe.ts` over the four types — scratchpad `30c14fe6-…`, outputs
`rank2-s21.txt` / `user-probe.txt`.

## §0 Why this slice, and why the handoff's order was wrong

Session 20's handoff ranked **the relation verbs + `DbModel2` first** and the user family second.
Re-running `rank2.ts` at this session's HEAD — the s20 change had landed *after* the ranking that
chose it, so `rank2-out.txt` describes a tree that no longer exists — inverts the two:

| slice | nodes | projects | distinct components | collateral it retires |
|---|---|---|---|---|
| `AddDbModelRelation` + `DbModel2` + the consumed `Id` | **3** | **1** | **1** | none |
| `LogIn` + `LogOut` + `SignUp` + `User` | **13** | **4** | **7** | 6 (`trigger login.done` / `trigger logout.done`) |

`RemoveDbModelRelation` has **zero corpus instances** — it was in the handoff's item 1 on the
strength of being a neighbour, not a measurement. The relation slice is three nodes in one page of
one project; the handoff ranked it first on *"it completes one real page end to end"*, which is a
demo criterion, not the coverage criterion this phase is measured by. The handoff's own sentence
about the user family — *"the cheapest remaining breadth in the corpus"* — was the correct
reading, filed under the wrong rank.

> This is the fifth consecutive session in which re-deriving the ranking on measured ground
> changed the plan, and the second in which **the previous session's own handoff** was the thing
> corrected. The instrument is not the problem; running it *before* the slice and then not again
> *after* is. **A ranking is invalidated by the change it motivated.**

## §1 What the runtime actually does (from the sources)

**The three actions are one shape three times**, and it is `dbmodelcrudbase`'s shape:

- **The trigger is the only trigger.** `login` on Log In *and on Log Out* — the port is spelled
  `login` on both, deliberately, because "the port name is persisted in every project that uses
  this node, so it cannot be corrected without breaking them" (`logout.ts`). Sign Up's is
  `signup`. Each is `valueChangedToTrue` → `schedule…`.
- **The value inputs accumulate, they do not trigger** — `set` writes `_internal.username` and
  nothing else. The request carries whatever has arrived when the trigger fires, exactly as
  `prop-*` does on the record verbs.
- **Coalescing per update pass, outcomes per invocation.** `logInScheduled` collapses two `Do`s
  in one pass into one attempt, while `pendingLogIn` keeps both tokens — *"two invocations must
  still produce two outcomes"*. Identical to `scheduleOnce`/`pendingOutcomes`.
- **`error` is a value output that is never cleared.** `setError` assigns `_internal.error` and
  flags it dirty *before* `reportOutcomes(…, 'failure')`, so a graph wiring `Failure → show` can
  already read `Error`. No path anywhere assigns it back to empty.
- **No `Unchanged` on any of the three**, and `logout.ts` records that this was *measured*, not
  assumed: `ParseAuthAdapter.logOut` POSTs `/logout` unconditionally.
- **Sign Up additionally takes `prop-<column>`** — runtime-discovered inputs for the project's
  extra `_User` columns, collected into `internal.userProperties`.

**`User` is not an action — it is a subscription.** It has no result to await:

- It reads `UserService.current` at `initialize` and re-reads it on `loggedIn`, `loggedOut`,
  `sessionGained` and `sessionLost`, flagging `id` / `authenticated` / `email` / `username` dirty
  each time. The outputs are **getters over the session**, not stored values.
- `authenticated` is `this._internal.model !== undefined` — a real boolean, never undefined.
- Its `Fetch` input re-reads the backend, which "is also how an expired session is discovered",
  and `runOnValueChange` names `fetch` as the control signal over the `user` source: authoring
  `runOnChange-user: false` stops **every property port updating when the user changes**, which
  the node's own comment calls out as the invisible cost of wiring `Fetch`.
- ⚠️ The node documents its own SSR behaviour: *"Sessions live in browser storage; a server
  render always sees a logged-out user."* This is the sentence §4c leans on.

## §2 The corpus (probe.ts over the four types)

Thirteen raw nodes; **seven distinct (component, node) instances** after clone-dedupe, in four
projects. There is exactly **one idiom per type**, and no instance departs from it:

```
Log In / Sign Up      username ← textinput.onTextChanged
                      password ← textinput.onTextChanged
                      login|signup ← button.onClick
                      done  → RouterNavigate.navigate
                      error → Text.text
Log Out               login ← button.onClick
                      done  → RouterNavigate.navigate
User                  authenticated → Condition.condition | Group.visible | Inverter.value
                      username      → Text.text
```

**Not one instance authors a single parameter** — `params:` is empty on all seven. Every gate
below is therefore a fork the corpus does not currently take, which is a much weaker reason to
build machinery for it than §5's record-verb census gave, and is why three of them defer rather
than translate.

The value of the slice is mostly *not* the thirteen nodes. It is that `Log In`'s `done` chain
un-defers the two `RouterNavigate`s currently reading
*"trigger login.done is not a rendered element event or a receiver"* (3 nodes, 3 projects) and the
three reading `logout.done` — and that the two credential `textinput`s become controlled by §3's
clause, the same collateral the record verbs' form fields took.

## §3 The enabling change was already made

RECORD-VERBS-TARGET §3 added the third clause to CONTROLLED-STATE §4c: **a control whose value
output is read by a handler action's argument earns local state.** It was written for `prop-*`
and `modelId`, and it stated at the time that *"every later handler-argument reader (the User
nodes' credentials, HTTP's body) earns control state by the same clause."*

This slice is the first test of that claim, and it holds with no change: `username` and `password`
are read from the **button's** `onClick`, exactly as the five form fields were. The only edit is to
the predicate that decides which sinks count as handler arguments, which becomes a shared list
rather than the record verbs' inline one.

## §4 The target output, hand-written first

### 4a — Log In: the whole idiom, from `tests/fixtures/puppy-test-3/components/Pages/Admin Login`

```tsx
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [logInActionError, setLogInActionError] = useState<string | undefined>(undefined);
```

```tsx
<button
  className={styles.logInButton}
  onClick={async () => {
    try {
      await logIn(username, password);
      navigate('/admin');
    } catch (error) {
      setLogInActionError(error instanceof Error ? error.message : String(error));
    }
  }}
>
  Log In
</button>
```

The `done` chain is inside the `try`, after the await — where `reportOutcomes(…, 'done')` sits in
the runtime, after the service answers. This is `record-op`'s emitted shape with a different
function and different arguments, and that is the whole point: it is **the same action**.

### 4b — Log Out, and the Error row nothing reads

```tsx
onClick={async () => {
  try {
    await logOut();
    navigate('/admin-login');
  } catch (error) {
    setLogOutActionError(error instanceof Error ? error.message : String(error));
  }
}}
```

⚠️ **Log Out's `error` is unwired in every corpus instance**, which the record verbs never
exercised — all three of theirs feed a status `Text`. The row is still allocated and still
written, because the catch needs a setter and because *the runtime holds `_internal.error` there
too*; it simply has no reader. The emitted `const [x, setX] = useState(...)` with `x` unread is
legal under the scaffold's `strict: true` (`noUnusedLocals` is not set — checked, not assumed).
Suppressing the row instead would mean a catch with nowhere to write, which is the one thing §4d
exists to prevent.

### 4c — `User`: the session read, and why a stub that always answers "signed out" is honest

```ts
export function useSession(): { authenticated: boolean; user: SessionUser | null } {
  return { authenticated: false, user: null };
}
```

```tsx
const session = useSession();
…
<span className={styles.userName}>{session.user?.username ?? ''}</span>
{session.authenticated && <div className={styles.adminTools}>…</div>}
```

This is §4d's read/write asymmetry applied to a session rather than a collection, and it lands on
the right side of it for two independent reasons:

1. **Logged-out is a plausible state of a real session**, exactly as `[]` is a plausible state of
   a real collection — and the runtime says so itself: *"a server render always sees a logged-out
   user."* The generated app is not pretending; it is in the state the node documents.
2. **It is consistent with the write stubs.** `logIn` throws, so nobody can sign in, so
   `authenticated: false` is not merely plausible — it is the only state reachable through this
   module. A session stub that answered `true` would contradict the login stub in the same file.

### 4d — The session api stub module

The three actions and the read share **one** `src/api/session.ts`, minted by whichever of them
translated, exactly as a collection module is minted by a query *or* a mutation:

```ts
export interface SessionUser {
  id: string;
  username?: string;
  email?: string;
}

/**
 * TODO(export): "Log In Action" (net.noodl.user.LogIn `login` on /Pages/Admin Login)
 * signed in against the project's NodeGX backend. Connect this to your own auth; until you do it
 * throws, which is what the graph's Failure path already handles.
 */
export async function logIn(username: string, password: string): Promise<SessionUser> {
  throw new Error('logIn is not connected to a backend yet');
}
```

`logOut(): Promise<void>` and `signUp(data: {…}): Promise<SessionUser>` follow the same rule.
`useSession` is the module's only non-throwing export, for §4c's reasons.

### 4e — The shared action: `record-op` becomes `api-call`

Both families emit *an awaited call whose failure lands in a state row and whose `done` chain runs
inside the try*. Rather than add a second action kind beside `record-op` — which is the s19
dispatcher trap, where a new case silently recruits every switch site and the wrong ones **fail
without throwing** — the existing kind is **renamed and generalised**:

```ts
| { kind: 'api-call';
    nodeId: string;
    /** What produced it, for notes and the stub's provenance line. */
    verb: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'signup';
    fnName: string;
    args: Array<{ kind: 'expr'; expr: ValueExpr } | { kind: 'data'; props: Array<{ key: string; expr: ValueExpr }> }>;
    errorState: string;
    then: HandlerAction[]; }
```

`updatePuppy(id, {…})` is `[expr, data]`; `logIn(u, p)` is `[expr, expr]`; `logOut()` is `[]`.
**A rename is the safe operation and an addition is the dangerous one**: every site that switches
on the old name is a compile error until it is updated, whereas a new sibling case is a silent
fallthrough. The emitted text is unchanged for every record verb, which the existing goldens
assert byte-for-byte.

## §5 The gates (any hit ⇒ the node defers, reason named)

Shared by the three actions:

1. **The trigger is unwired, or wired from something the handler vocabulary does not compile** —
   the record verbs' gate 8, verbatim.
2. **Two wires into one value input** (`username` / `password` / `email`) — last-writer-wins is
   not statically ordered. CO §4's rule, in CO §4's words.
3. **A value input's source resolves to nothing** — defer naming the feeder (collateral, the
   standing rule).
4. **A consumed `failure` or `completed`** — the runtime pulses them per invocation and only the
   `done` chain and the `Error` value are translated in this slice.
5. **Sign Up with any `prop-*`** — it sets extra `_User` columns at sign-up, and the export's
   session stub carries no user schema to type them against. **Zero corpus instances**, so this
   is designed-and-deferred on §4c/§4e's precedent rather than built untested.

`User` translates only as a pure reactive read, and defers on:

6. **`fetch` wired** — an invocation, and the only path that mints an outcome on this node.
7. **`runOnChange-user: false` authored** — the subscription is silenced, so the ports stop
   tracking the session and the export's reactive read would be a lie in the opposite direction
   from the usual one. (Absent means ticked — check `!== false`, never falsy; step 6's rule.)
8. **A consumed `changed` / `fetched` / `done` / `failure`, or a read of `error`** — all four
   belong to the `Fetch` path this slice does not translate.
9. **`backendId` authored** — a second backend's account; one session module is all this emits.
10. **A consumed `prop-<column>` output** — the project's own `_User` columns, which `SessionUser`
    does not carry. Zero corpus demand, same ruling as gate 5.

## §6 Recorded divergences (cosmetic or named, deliberate)

- **Absent credentials become empty ones** — a control's state boots `''` and is always sent,
  where the runtime sends `undefined` for an input that never arrived. Identical to the record
  verbs' §6 clause, and named per field in a plan note.
- **Coalescing** — `logInScheduled` merges two `Do`s in one update pass; unreachable from the emit
  vocabulary, as it is for the record verbs.
- **`Log Out`'s Error row has no reader** (§4b) — allocated and written, never read.
- **The session never changes** — `useSession` is constant, where the runtime's re-reads on four
  session events. Faithful *given* the write stubs (§4c.2), and the moment an inheritor connects
  real auth it is their hook to make reactive; the TODO says so.
- `authenticated` is emitted as a plain boolean value, not a logic-truthiness device — it is
  `model !== undefined` in the runtime, so it is admitted at value sinks as well as truthiness
  ones, unlike an And/Or result (step 7's rule).

## §7 Fixture & test plan

**No fixture authoring — the shipped snapshot already carries the idiom**, which is the s20
lesson holding for the second time. `tests/fixtures/puppy-test-3` has:

- `Pages/Admin Login` — two `textinput`s into `username`/`password`, a button into `login`,
  `done → RouterNavigate`, `error → Text.text`. The entire Log In idiom, including the status line.
- `Pages/Admin` — a button into Log Out's `login`, `done → RouterNavigate` (the unwired-Error case
  §4b needed and no hand-authored fixture would have thought to include), and
  `User.authenticated → Condition.condition → onfalse → RouterNavigate` — the auth gate.

⚠️ **That Condition still defers**, on its own existing gate: its `condition` is wired with
`runOnChange-condition` absent (= ticked), so it re-tests on every change, which an `onClick`
cannot carry (step 6's rule). So the fixture proves `User`'s *read* resolves and then defers at
the Condition — which is the honest result, and the reason `User`'s render-sink case has to be
graded on `phase58-backend-deferred`'s `Group.visible` / `Text.text` wires in the audit rather
than in a golden.

Tests: goldens for §4a and §4b; the session stub module with all three writes plus `useSession`;
every §5 gate producing its named reason; the §3 control-state mint over credentials; the async
handler shape; the `error` fold at `Text.text`; and — the point of §4e — the **existing record-verb
goldens unchanged**, which is what proves the rename generalised rather than altered.

## §8 Corpus impact, stated honestly

Six of the seven distinct instances pass every gate; `phase58`'s Sign Up passes too, so the count
is seven of seven — no corpus instance takes any gate in §5, because no corpus instance authors a
parameter at all. What flips beyond the verbs is the collateral: six `RouterNavigate`s, four
credential inputs becoming controlled, two status `Text`s getting a source, and — in `phase58`
only — a `Group.visible` pair and a `username` read.

⚠️ **`User` in the fixture gains nothing** (§7), so the golden suite will *understate* this slice.
What flips is the audit re-run's to report, not this document's to promise — §10's standing
caution, and §9 below records what actually happened.

## §9 Implementation addendum (session 21 — what building the slice settled)

The slice landed as designed, including §4c. Measured, same instrument both sides over the same
40 projects — a worktree at HEAD for the before side, the working tree for the after:

| | translated / total | % |
|---|---|---|
| before | 3,749 / 4,441 | 84.42 |
| after | 3,766 / 4,441 | **84.80** |

**+17 nodes on an unchanged denominator, across four projects** (`Puppy test 3`,
`puppy-test-3-fix008c`, `tut001-drive`, `phase58-backend-deferred`); no project regressed. The
before-run **reproduces `cov-after-s20.txt` exactly**, which is what makes the pair comparable.
Per-type, and it is precisely §8's prediction: `LogIn` 0→4, `LogOut` 0→4, `SignUp` 0→1, `User`
0→1 (**of four** — §7 said the other three sit behind the Condition gate), plus the collateral
`RouterNavigate` 50→56 and `Inverter` 2→3. 390 tests (21 new).

### 🔴 Two walkers, and only one of them was updated

`session-get` was added to `collectExprUse` — and the emitted page came out with
`session.authenticated` in four bindings and **no `const session` above them**. There are *two*
expression walkers in `emit/component.ts`, each enumerating the kinds it cares about:
`collectExprUse` for handler actions and **`hookExprSources` for render bindings**. A new
ValueExpr kind that earns a hook must be added to both.

**No test would have caught it** — every unit assertion was about the binding text, which was
correct. It took `tsc -b` over the emitted app. That is the fourth payoff of s18's rule, and this
time the rule that mattered was its stronger form: **build the artefact, do not merely read it.**

### 🔴 The same shape one level up: a predicate that enumerated one family

Pass 4f's `isRecordErrorRead` named `RECORD_VERBS` while `resolveExpr` named both families, and
the mismatch **failed silently with a note**: the Log In status line resolved, fell through to
the catch-all, and rendered `<p></p>` where the interpreted app shows the refusal. Caught by
dumping the artefact, not by the 369 passing tests. Both defects are the same species as s19's
dispatcher trap, and together they sharpen the rule: **when a vocabulary grows a member, the
compiler only helps where the site is an exhaustive switch. Every site that is a *predicate* —
an `if`, a `some`, a lookup table — is silent, and those are the ones to grep for by hand.**

- ✅ **The rename was the right call, and it paid for itself.** Turning `record-op` into
  `api-call` produced compile errors at all ten dispatch sites and **left every record-verb
  golden byte-identical** (369 tests green before a line of user-family code was written), which
  is the proof §4e asked for. Had it been a sibling case instead, each of those ten would have
  been a silent fallthrough.
- 🔴 **`plan.sessionCalls` had no attachment filter** and `plan.mutations` did. An unwired Log In
  therefore deferred correctly *and still exported `logIn` from the session module*. Caught by
  the §5.1 test, which asserts the export's absence and not merely the deferral — **assert what
  the gate removes, not only what it reports.**
- ⚠️ **A test can hang the runner.** §4e was first written as one spanning regex with
  `(\s+.*\n)*`; over a whole page that backtracks catastrophically and jest never returns. It
  reads exactly like a product infinite loop. Fixed substrings assert the same thing.
- ✅ **§4c is honest and it is also cheap.** The `useSession` earn had to be a *post-pass* sweep
  over surviving bindings and actions, because `resolveExpr` runs speculatively — a `User` node
  whose reads are all dropped later must leave no `useSession` in the module. The fixture proves
  the negative case and `phase58` proves the positive one.

### 🔴 A finding outside this slice: the record verbs emit an app that does not compile

Building `phase58-backend-deferred` — which s20 never did, having built only `puppy-test-3` —
fails `tsc -b` with **two errors that reproduce identically at the baseline worktree**, so they
are the record-verb slice's, not this one's:

1. `AddStockForm.tsx:50` — `createStockItem({ name: … })` where `Partial<StockItem>` has no
   `name`. The interface is minted from the project's collection *schema*, and the graph writes a
   `prop-` the schema snapshot does not carry.
2. `StockItemRow.tsx:51` — `deleteStockItem(id)` with `id: string | undefined`; the id comes from
   an optional component prop.

Both are typing decisions in RECORD-VERBS §4d and each has a real design question behind it
(does a graph-written column join the interface? does an absent id call the stub or refuse?), so
they are recorded here rather than patched at the end of a session. **They mean a shipped slice
emits a non-compiling app for one corpus project**, which makes them the next session's item 1.
The general lesson is the narrower one: **`tsc` over one emitted project is not `tsc` over the
corpus** — a build check has a denominator too.
