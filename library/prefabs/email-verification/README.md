# Email Verification — configuring it

These cloud functions verify a new user's email address and drive the password-reset flow. They send
through SendGrid **server-side**; the API key never reaches the browser. It is read by a `Secret`
node, and the graph only ever carries its *name*.

## What you must provision

| Secret name | What it is | Credential? |
|---|---|---|
| `SENDGRID_API_KEY` | Your SendGrid API key | **yes** |
| `EMAIL_VERIFICATION_DOMAIN` | The origin your app is deployed at, e.g. `https://example.com`. Every link in the emails is built from it | no |
| `EMAIL_VERIFICATION_FROM` | The From address the emails are sent as | no |

The last two are not secrets. They are here because they differ per deployment and the `functions`
secret store is the one mechanism a cloud function has for reading a *named, per-deployment* value.

⚠️ `EMAIL_VERIFICATION_DOMAIN` previously had a built-in `http://localhost:8574` development
default. It no longer does — a verification link that silently points at localhost in production is
the failure this change removes.

`SENDGRID_API_KEY` is the same name the standalone **Send Grid** prefab uses, deliberately: the
`/#__cloud__/SendGrid/*` components the two prefabs share are identical, so one key configures both.

Until all three are provisioned, the functions answer with a `failure` response rather than sending
mail with a blank key, and the backend logs which name is missing.

## The two ways to provision them

**1. The secrets file** — `<dataDir>/secrets.json` on the machine running the backend, under the
`functions` section:

```json
{
  "functions": {
    "SENDGRID_API_KEY": "SG.xxxxxxxxxxxxxxxxxxxxxx",
    "EMAIL_VERIFICATION_DOMAIN": "https://example.com",
    "EMAIL_VERIFICATION_FROM": "no-reply@example.com"
  }
}
```

Read-modify-write the whole file: it also holds the backend's admin token and webhook secrets.

**2. Environment variables** — for deploy targets that provision env vars rather than a data
directory:

```
NODEGX_SECRET_SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxx
NODEGX_SECRET_EMAIL_VERIFICATION_DOMAIN=https://example.com
NODEGX_SECRET_EMAIL_VERIFICATION_FROM=no-reply@example.com
```

The file wins if both are set.

⚠️ **`secrets.json` is machine-local and does not travel with a deploy.** A prefab that works on your
machine and fails in production is almost always a secret nobody provisioned on that target.

## Using it

`/#__cloud__/Sign Up/Send Verification Email` and `/#__cloud__/Sign Up/Request Reset Password` are
the two entry functions. Each now fetches its settings the moment the request arrives, and answers
with a `failure` response reading *"This function is not configured on this server"* if a value is
missing.

`/#__cloud__/Sign Up/Actions/Format Email` changed shape: it takes `Domain` as an input and is
triggered by `Do`, answering `Done`. It no longer reads configuration itself — the entry function
that calls it does, once per request.
