# Phase 76 — next session

Read `TASKS.md` here first. **SB-005 is built** (s6) but 🟡 not 🟢, and the difference is the whole
point: acceptance 6 — *a draft created through the panel is unreadable to an anonymous caller* — is
**UNMET** and belongs to SB-008. Nothing in SB-005 stands in for it, and its §4 says so up front so
it cannot be quietly counted as met by the structural criteria.

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Four things a deployed graph does not do the way the canvas does"**. Before authoring any
*browser* component, read **SB-005 §7** as well — it is where two of those four rules turned out not
to transfer the way §2 predicted.

## Where s6 left it (2026-08-26)

**SB-005 BUILT.** Six browser components authored through the real MCP door —
`noodl-mcp/tests/sb005Components.ts` — graded by `noodl-mcp/tests/sb005AdminPanel.test.ts`,
**21 specs / 9 mutants**. Acceptance 1–5 met, 3 and 4 rewritten mid-build on measurements. The claim
SB-004 §7 said this task owed is now held on the real path: `Create Record` for `Page` and `Section`
carries the draft ACL as parameters, asserted rule by rule against SB-004's own constant.

🔴 **Four things measured before authoring, each of which changed a graph.** They are the session's
real output and they are all in SB-005 §7:

- **Doctrine rule 2 does NOT bite `CloudFunction2` or `Query Records`.** Both defer their real work
  through `scheduleAfterInputsHaveUpdated` (`cloudfunction2.ts:225`, `dbcollectionnode2.ts:816`), and
  `Node.update` runs those callbacks *after* draining one queued value from every input name
  (`node.ts:626-656`). **F11 was never about signals in general** — it was about a *producer* (the
  Request node) emitting `receive` and `pm-pageId` in two passes of its own. The rule to carry is
  about **where a wire comes from**.
- **Rule 3 does NOT transfer whole.** A JavaScript output publishes only when it **changes**
  (`simplejavascript.ts:162`), so "re-emit the same id to refresh" does nothing — a panel's refresh
  *must* be a `storageFetch` wire. Acceptance 4 was rewritten around the half that is load-bearing:
  `runOnChange-*: false` (which is what stopped F12) plus **no trigger from the node that supplies
  the filter value**. The unfiltered page-list query is asserted in the same spec as NOT carrying the
  setting — s4's `claimSite` correction, still on.
- 🔴 **A rule nobody had written down: an `Update Record` must carry NO access rules.** `_getACL`
  returns `undefined` with no rules and `JSON.stringify` drops the key, so the stored ACL survives.
  Give one rules and **saving a title on a published page rewrites its ACL to draft-only while
  `published` stays `true`** — the invariant broken in the one direction its mirror cannot show.
- **Acceptance 3 refined, not weakened**: a `Create Record` may state `published: false` beside the
  draft ACL (as `duplicatePage` already does); an *update* is what makes the two disagree.

🆕 **SB-012 filed** — `RouterNavigate.target` and `For Each.template` *are* checked at the door, but
only against what is already on disk, unlike a node `type` (which SB-004 §6 F6 measured as resolving
against an unapplied sibling in the same plan). So **an app whose pages link to each other cannot be
authored in one pass by either door.** SB-005 works around it with six creates then two
`update_component` calls, with a known-firing control proving the create pass really refuses.

⚠️ **A near-miss worth carrying into any UI authoring**: `options.items` written as a comma string is
a **static** `array` port, so no `dynamic-port-skipped` info covers it and the door said nothing —
`Select.tsx:116` calls `.map` on it, so the page would have thrown on render. A static port carrying
a structured value is a gap no diagnostic in this run names. It is fed from a `Static Data` node of
`{ Label, Value }` objects now.

Final: noodl-mcp **61 suites / 718**, `typecheck:mcp` and `typecheck:editor` both exit **0** (run
**unpiped** — a piped `$?` is `tail`'s). ⚠️ `typecheck:mcp` is the stricter of the two and caught 20
errors `typecheck:editor` passed.

## The `test:ci` position — ✅ s5's debt is CLOSED

**Not run by this session; discharged by a peer's solo run, relayed as a measurement.** The peer
`Build share template dialog…` held a solo window mid-session and reported the summary line verbatim:

> `Jasmine: 2856 specs, 4 failures (failed).` — all four `AIX-006 style vocabulary`, by name, on a
> tree that included `8ce12a3c`.

That is **the recorded floor of 4**, so s5's `BACKEND_DOCTRINE_MD` change cost nothing. ⚠️ Attributed
because it matters: this is a *relayed* reading, not one taken here. It carries the summary line and
the failure names rather than a verdict, which is what makes it worth relaying at all.

**s6 adds no debt of its own** — the session touched two new noodl-mcp test files and four docs, no
editor or runtime source, so nothing in `test:ci`'s scope moved.

Standing rules for the next run: read the **summary line**, never `$?` (the clean floor exits `1`);
run it **alone**; the floor is **4**.

## Next work, in order

1. **SB-006** (the public site). 🧭 **F8 is Richard's and blocks its contact section** — `SiteSettings`
   is world-readable, so `contactRecipient` cannot live in that row; the fix takes the address from
   the `Secret` alone and changes SB-004 §2's field list. The panel already avoids it (no recipient
   field on the settings form), so SB-006 is where it actually bites.
   🔴 Read SB-005 §7 first: the public site is the *other* browser surface, and every one of its four
   measurements applies. In particular its page query is **filtered** (by slug), so it needs
   `runOnChange-*: false` and a trigger that is not its own filter source.
2. **SB-008** — the drive, and the one that decides whether any of this works. **Scope it as the
   browser half**; SB-004 §7 already did the permissions half over real HTTP, so do not re-litigate
   it. Must run with `devOpen: false` over a real SQLite engine. The thing to check is not that the
   panel works but that **a draft created through it 404s for an anonymous caller** — SB-005's
   acceptance 6.
3. **SB-007** (ship embedded, category `site`) — consume FB-005's registry, do not re-spec it.
4. **SB-009 / SB-010 / SB-011 / SB-012** whenever they fit — all measured-not-fixed, all needing a
   corpus sweep or a ruling rather than an argument. SB-012's task file argues *against* one of its
   three candidate fixes; the other two are open.

## Traps that will bite here specifically

- 🔴 **A green authoring run means well-formed and nothing else.** Four sessions running have
  produced one; three of them shipped something broken. s6's own near-miss (`options.items`) was
  caught by reading the control's source, not by any gate.
- 🔴 **Both SB-005 suites author from `noodl-mcp/tests/sb005Components.ts`** (and SB-004's from
  `sb004Components.ts`). Edit the graphs there, never in a spec — SB-008 has to drive *these*.
- 🔴 **An authored node id is a request, not a handle (F9).** Ids are made unique across the
  *project*. Read a written graph by node **type** or **label**; `sb005AdminPanel.test.ts` has
  `byType`/`byLabel`/`only` helpers that assert cardinality rather than assuming it.
- **`get_node_type` takes `type_names` (an array), caps at 8 per call**; `get_example` takes `id`;
  `get_component` takes `path`; `update_component` takes `{ path, set: { nodes, connections } }` —
  a full replacement, not a patch.
- **The MCP dist on this machine is stale** and the bound servers run it. Author through
  `noodl-mcp/tests/helpers.ts` → `createServer` from `src`.
- `Run Tasks` matches `Do`/`Success`/`Failure` on its template **by string**. `Update Record`'s
  `collectionName` is **edit-only**, so one helper cannot serve two collections.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch/teardown; `test:ci` **alone**.
