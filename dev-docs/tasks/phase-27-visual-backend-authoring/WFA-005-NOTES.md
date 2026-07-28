# WFA-005 — Notes

**Status:** 🚧 In progress.
**Spec:** [WFA-005-TRIGGERS-ON-CANVAS.md](./WFA-005-TRIGGERS-ON-CANVAS.md)

---

## Step 1 — F7 and F8 reproduced before anything was changed

Against a real `nodegx-backend serve` on `:8590` (`--backend-id wfa005`), a scratch data dir
holding two workflow definitions (`ping`, `orderPipeline`) copied from the live SQLite backend.
Every response below is verbatim.

### F8 — a schedule payload is silently discarded

```
POST /admin/triggers
{"type":"schedule","name":"F8 repro","target":{"kind":"workflow","name":"ping"},
 "schedule":{"cron":"*/5 * * * *","missedFirePolicy":"skip","payload":{"source":"nightly"}}}

HTTP/1.1 201 Created
{"trigger":{"id":"trg_xVCUmjjd3Qjd","type":"schedule","name":"F8 repro","enabled":true,
 "target":{"kind":"workflow","name":"ping"},…,
 "schedule":{"cron":"*/5 * * * *","missedFirePolicy":"skip"}}}
```

201, and `payload` is not in the stored trigger. Not rejected, not stored.

**And it is not about `payload`.** The same probe against every config object, and against the
trigger itself:

| Probe | Result |
|---|---|
| `schedule: {…, payload: {...}}` | **201**, dropped |
| top level: `retryPolicy: "exponential"` | **201**, dropped |
| `webhook: {…, verifySsl: false}` | **201**, dropped — stored config is `{slug, scheme, maxBodyBytes}` |
| `dbChange: {…, filter: {total: {$gt: 100}}}` | **201**, dropped |

**The asymmetry is the defect.** Put that same key in `triggers.json` and the service will not
start:

```
[nodegx-backend] FATAL: …/triggers.json is invalid — refusing to start with triggers that
would not fire correctly:
  - trigger "trg_asym": unknown schedule key "payload"
```

So the registry has exactly one rule and applies it to stored data but not to input. The cause is
in `TriggerRegistry.upsert`: it **reconstructs** `def` field by field from `input` and then
validates the reconstruction, so an unknown key is gone before `validateTriggerDef` ever sees it.
Validation of the write path is validation of a value the write path just built, which can only
ever pass. `payload` was how it was noticed.

Consequence, confirmed on the run the `*/5` schedule fired unattended:

```
triggerData: { triggerId, firedAt, cron,
               trigger: {type:'schedule', id, firedAt, cron},
               triggerType: 'schedule',
               body: {} }
```

`body` is `{}` — the field WFA-003 built for the caller's data — and the authored payload is
nowhere. One definition cannot serve both a webhook and a schedule, which is the phase-19 exit
clause.

### F7 — `Authorization: Bearer <secret>` can never authenticate

A `token`-scheme webhook (`slug: f8probe`, target `{kind:'workflow', name:'ping'}` — which also
demonstrates that the *admin API* has always accepted a workflow target, F9's point), fired three
ways with the correct secret:

| Transport | Status |
|---|---|
| `X-Webhook-Token: whsec_…` | **200** |
| `?token=whsec_…` | **200** |
| `Authorization: Bearer whsec_…` | **401** `{"error":"Unauthorized."}` |

And with no credential at all, for contrast — this is `webhook.ts`'s own message, which advertises
the transport that cannot work:

```
{"error":"Webhook rejected: missing webhook token (X-Webhook-Token / Bearer / ?token=)"}
```

**Two things beyond the spec's description**, both from the execution log:

1. **The Bearer rejection produces no execution record.** `/executions` after the four hits holds
   three runs and one rejection — the rejection being the *no-credential* one, recorded loudly by
   `dispatcher.recordRejection` as the spec's trap describes. The Bearer attempt was refused in
   `handle()` before routing reached `handleWebhook`, so it left nothing behind. An operator asking
   "why is my integration failing?" sees an empty history, not a rejected hook.
2. **It feeds the auth lockout budget.** `handle()` calls `authLimiter.recordFailure` on a thrown
   principal resolution, so a third-party service retrying a Bearer hook walks itself into BAK-005's
   429 for every route on the backend.
