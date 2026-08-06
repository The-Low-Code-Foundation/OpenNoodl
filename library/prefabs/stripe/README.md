# Stripe — configuring it

The cloud-function half of this prefab talks to Stripe **server-side**. The secret key never reaches
the browser: it is read by a `Secret` node inside `/#__cloud__/Stripe/Settings`, and the graph only
ever carries its *name*.

## What you must provision

| Secret name | What it is | Credential? |
|---|---|---|
| `STRIPE_API_KEY` | Your Stripe **secret** key (`sk_live_…` / `sk_test_…`) — never the publishable one | **yes** |
| `STRIPE_CHECKOUT_SUCCESS_URL` | Where Stripe returns the buyer after a successful checkout | no |
| `STRIPE_CHECKOUT_CANCEL_URL` | Where Stripe returns the buyer after a cancelled checkout | no |

The two URLs are not secrets. They are here because they differ per deployment and the `functions`
secret store is the one mechanism a cloud function has for reading a *named, per-deployment* value.

⚠️ **These previously had a built-in `http://localhost:8574/…` development default. They no longer
do.** A checkout redirect that silently points at localhost in production is exactly the failure this
change removes, so the URLs must be provisioned even for local development.

Until all three are provisioned, every Stripe cloud function fires **Failure** rather than calling
Stripe with a blank key, and the backend logs which name is missing.

## The two ways to provision them

**1. The secrets file** — `<dataDir>/secrets.json` on the machine running the backend, under the
`functions` section:

```json
{
  "functions": {
    "STRIPE_API_KEY": "sk_test_xxxxxxxxxxxxxxxxxxxxxxxx",
    "STRIPE_CHECKOUT_SUCCESS_URL": "https://example.com/checkout-success",
    "STRIPE_CHECKOUT_CANCEL_URL": "https://example.com/checkout-cancel"
  }
}
```

Read-modify-write the whole file: it also holds the backend's admin token and webhook secrets.

**2. Environment variables** — for deploy targets that provision env vars rather than a data
directory:

```
NODEGX_SECRET_STRIPE_API_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx
NODEGX_SECRET_STRIPE_CHECKOUT_SUCCESS_URL=https://example.com/checkout-success
NODEGX_SECRET_STRIPE_CHECKOUT_CANCEL_URL=https://example.com/checkout-cancel
```

The file wins if both are set.

⚠️ **`secrets.json` is machine-local and does not travel with a deploy.** A prefab that works on your
machine and fails in production is almost always a secret nobody provisioned on that target.

## Using it

Every cloud function here — `Buy Products`, `Buy Subscription`, `Cancel Subscription`,
`Update Subscription`, `Get Subscription For Customer`, `List Invoices For Customer`,
`Create Session` — now fetches its settings when you signal `Do`, and runs the Stripe call once they
have arrived. Wire your chain to `Success`/`Failure`, not to a timer.

The two webhook handlers, `/#__cloud__/Stripe/Events/Process Stripe Payment Event` and
`…/Process Stripe Subscription Event`, gained a `Failure` output for the same reason: a webhook
handler that cannot say it was unconfigured is a webhook handler that looks like it worked.

The front-end components (`/Stripe/Subscriptions/Plan Picker`, `/Stripe/Payment/Buy Products`, …)
never see any of these values. They call the cloud functions, which is the point.
