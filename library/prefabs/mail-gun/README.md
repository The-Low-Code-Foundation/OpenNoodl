# Mail Gun — configuring it

This prefab sends email through Mailgun **from a cloud function**. The API key never reaches the
browser: it is read server-side by a `Secret` node, and the graph only ever carries its *name*.

## What you must provision

| Secret name | What it is | Credential? |
|---|---|---|
| `MAILGUN_API_KEY` | Your Mailgun private API key | **yes** |
| `MAILGUN_DOMAIN` | The sending domain, e.g. `mg.example.com` | no — but it differs per deployment, so it lives in the same place |

Both are read through the same door. `MAILGUN_DOMAIN` is not a secret; it is here because the
`functions` secret store is the one mechanism a cloud function has for reading a *named,
per-deployment* value, and splitting the two would give this prefab two configuration mechanisms,
one of which fails silently.

Until both are provisioned, `Send Email` fires **Failure** and the backend logs which name is
missing. It never sends with a blank key or an empty domain.

## The two ways to provision them

**1. The secrets file** — `<dataDir>/secrets.json` on the machine running the backend, under the
`functions` section:

```json
{
  "functions": {
    "MAILGUN_API_KEY": "key-xxxxxxxxxxxxxxxxxxxx",
    "MAILGUN_DOMAIN": "mg.example.com"
  }
}
```

Read-modify-write the whole file: it also holds the backend's admin token and webhook secrets.

**2. Environment variables** — for deploy targets that provision env vars rather than a data
directory:

```
NODEGX_SECRET_MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxx
NODEGX_SECRET_MAILGUN_DOMAIN=mg.example.com
```

The file wins if both are set.

⚠️ **`secrets.json` is machine-local and does not travel with a deploy.** A prefab that works on your
machine and fails in production is almost always a secret nobody provisioned on that target.

## Using it

`/#__cloud__/MailGun/Send Email` takes `To`, `From`, `Subject`, `Html` or `Text`, `CC`, `BCC` and a
`Do` signal, and answers `Success` or `Failure`. `Do` fetches both values first and runs the send
once they have arrived.

`/#__cloud__/MailGun/Settings` is the component that does the fetching — `Fetch` in, `API Key` +
`Domain Name` + `Ready` + `Failure` out.
