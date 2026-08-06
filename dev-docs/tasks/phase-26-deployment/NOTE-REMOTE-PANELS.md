# Note — Execution history and the Data Browser against a deployed backend

**Origin:** Richard's first-hour alpha pass, 2026-08-05 (phase-42 item 20). Not a task — a
constraint to hold in mind when this phase is built. The ask: when a user's app is deployed to a
VM (DEP-005/DEP-006), how do they see its execution history and browse its live data?

## The honest headline

The two panels are coupled at **different layers**, so a remote story does one cheaply and the
other properly:

- **Execution history is coupled by address.** The renderer does one IPC call; the main process
  merges local sources fetched from `http://127.0.0.1:<port>` with a 2s timeout and **no
  Authorization header** (`ExecutionHistoryManager.ts:229-246`). It works today only because
  `/executions` is `admin`-gated and loopback dev-open relaxes auth. The source provider is
  already pluggable (`setRemoteSources`, wired to `BackendManager.getRunningEndpoints()` at
  `main.js:854`). Remote = a credentialed `RemoteExecutionSource` (add `token`, send the bearer)
  plus a second provider for saved remote targets. Cheap.

- **The Data Browser is coupled by architecture.** It has **no URL at all** — every call is an
  Electron IPC invoke keyed on a **local child-process id**, gated by `requireRunning(id)`, with
  the admin token read from `secrets.json` on the local filesystem
  (`ServiceSupervisor.js:313-350`). `backendList.ts:286-336` (`dataBrowserAvailability`) already
  documents exactly this and names the two prerequisites for generalising: BCN-004's REST adapter
  (**since landed**) and a main-process route that hands a `BackendHandle` to an adapter instead
  of a process id (**still missing**). That route is the real work.

## The pieces a remote connection slots into (dependency order)

1. Credentialed execution-history sources (`token` on `RemoteExecutionSource`; bearer on both
   fetches).
2. A saved-remote-targets provider merged into `setRemoteSources`.
3. The main-process `BackendHandle` route for the Data Browser (removes cases from the
   `kind !== 'managed'` gate without touching the capability gate).
4. Credential storage: DEP-004's `safeStorage` pattern (`AiCredentials.ts` is the model); a
   "prod VM deploy target" and a "remote backend to browse" are plausibly the **same record**.
   Never in `project.json` — a NodeGX project is a shared git repo.
5. DEP-001 first: the exported app's backend endpoint is frozen at build time; until it's
   un-frozen, "the deployed app's backend" isn't a value the editor can name.

## The security question that must be answered before either

The Data Browser deliberately uses the **admin** token (sees every row regardless of ACL). The
remote version means storing a production admin credential in the editor — the same class of
problem as the still-open adminToken disclosure (BCN-009, unowned). BAK-005's read-only credential
tier is the existing prior art for a lower-privilege answer; decide the tier **before** building
the route in step 3.

Also note the alternative that already ships: **BAK-005's served `/_admin` dashboard** runs on the
deployed backend itself (executions list + collection browser, live via SSE) with the editor
closed. The remote-panels work is editor convenience on top of that, not the only path — and for
alpha-stage users "open your VM's /_admin" may be the honest v1 answer.
