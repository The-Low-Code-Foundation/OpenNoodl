# Supabase connector — configuring it

This prefab is **logic only** — no pages, no router, no UI. Every component is a pure
signal-in/signal-out wrapper around the Supabase JS client, which is shared through
`Noodl.Variables.supabase`. You build the screens; these components do the talking.

## 1. Load the Supabase JS client

`Setup Client` calls `window.createClient(url, key)`, so the Supabase JS library must be
loaded **and** its `createClient` exposed under that name. Add this under
**Project Settings → Head Code**:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>window.createClient = supabase.createClient;</script>
```

(The CDN bundle exposes a global `supabase` object; the second line is the shim the
prefab expects. Without it `Setup Client` fires `Failure` with
`window.createClient is not a function`.)

## 2. Configure `Core/Supabase - Setup Client`

Place it once, early (e.g. on your app root), and send `Do` on app start. Inputs:

| Input | Where to get it |
|---|---|
| `Supabase URL` | Supabase dashboard → Project Settings → API → Project URL |
| `Supabase Anon Key` | Supabase dashboard → Project Settings → API → `anon` `public` key |

It creates the client into `Noodl.Variables.supabase` and fires `Success`/`Failure`.
It is idempotent — if the client already exists it does nothing. Every other component
checks for that client and logs an error (no signal) if `Setup Client` has not run yet,
so always gate your flows on its `Success`.

The anon key is a *publishable* key — it is designed to ship to the browser. Protect your
data with Supabase Row Level Security policies, not by hiding this key.

## 3. The components

All are under `#Supabase Prefab`. Each takes a `Do` signal and answers `Success`/`Failure`
(plus `Data`/`Error` string outputs where noted).

**Core**
- `Supabase - Setup Client` — see above.
- `Supabase - Example Request` — template for a table query (`from('companies').select('*')`).
  Duplicate it and change the table/columns for your own queries.

**User** (auth flows)
- `Supabase - Sign Up` — `Email`, `Password`, `First Name`, `Last Name`.
- `Supabase - Log In` — `Email`, `Password`; stores the user for the profile components.
- `Supabase - Log Out`
- `Supabase - Fetch Current User Auth` — outputs `Logged In` (boolean); use it to route on app start.
- `Supabase - Send Magic Link` — `Email` (passwordless OTP sign-in).
- `Supabase - Send Password Reset` — `Email`; the mail's redirect link is
  `window.location.origin` + `/update-password` (a String node inside the component —
  edit it to match your own route, and make sure that page exists in your app).
- `Supabase - Resend Confirmation` — `Email` (re-sends the signup confirmation mail).
- `Supabase - Update Current User Auth` — change `Email`/`Password` of the logged-in user.
- `Supabase - Fetch Current User Profile Data` / `Supabase - Update Current User Profile Data` —
  read/write a `profiles` table row for the current user (expects a `profiles` table keyed by
  the auth user id, the standard Supabase starter schema).

## Upgrading from 1.x

1.x bundled a ~13-component example app (pages, router, header, full auth screens) around
this connector. 2.0.0 ships the connector only; the example app was removed. If you relied
on those screens, keep your installed 1.1.0 copy — installed prefabs are copies, nothing
changes in existing projects.
