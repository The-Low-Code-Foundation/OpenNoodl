# Send Grid — configuring it

This prefab sends email through SendGrid **from a cloud function**. The API key never reaches the
browser: it is read server-side by a `Secret` node, and the graph only ever carries its *name*.

## What you must provision

| Secret name | What it is | Where to get it |
|---|---|---|
| `SENDGRID_API_KEY` | Your SendGrid API key — **a credential** | SendGrid → Settings → API Keys |

Until it is provisioned, `Send Email` fires **Failure** and the backend logs
`Secret: "SENDGRID_API_KEY" is not provisioned on this machine…`. It never sends with a blank key.

## The two ways to provision it

**1. The secrets file** — `<dataDir>/secrets.json` on the machine running the backend, under the
`functions` section:

```json
{
  "functions": {
    "SENDGRID_API_KEY": "SG.xxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

Read-modify-write the whole file: it also holds the backend's admin token and webhook secrets, and
replacing it wholesale destroys them.

**2. An environment variable** — for deploy targets that provision env vars rather than a data
directory:

```
NODEGX_SECRET_SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxx
```

The file wins if both are set.

⚠️ **`secrets.json` is machine-local and does not travel with a deploy.** A prefab that works on your
machine and fails in production is almost always a secret nobody provisioned on that target.

## Using it

`/#__cloud__/SendGrid/Send Email` takes `To`, `From`, `Subject`, `Html` or `Text`, `CC`, `BCC` and a
`Do` signal, and answers `Success` or `Failure`. `Do` now fetches the key first and runs the send
once the key has arrived, so wire your own chain to `Success`/`Failure` and not to a timer.

`/#__cloud__/SendGrid/Settings` is the component that does the fetching — `Fetch` in, `API Key` +
`Ready` + `Failure` out. Nothing else needs to know the secret's name.
