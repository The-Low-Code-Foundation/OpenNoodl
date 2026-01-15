# Future: External Service Integrations

**Status:** Deferred  
**Target Phase:** Phase 12 or later  
**Dependencies:** Phase 11 Series 1-4 complete

---

## Overview

This document outlines the external service integrations that would transform OpenNoodl into a true n8n competitor. These are **deferred** from Phase 11 to keep the initial scope manageable.

Phase 11 focuses on the workflow engine foundation (execution history, deployment, monitoring). Once that foundation is solid, these integrations become the natural next step.

---

## Integration Categories

### Tier 1: Essential (Do First)

These integrations cover 80% of workflow automation use cases:

| Integration       | Description                  | Complexity | Notes                             |
| ----------------- | ---------------------------- | ---------- | --------------------------------- |
| **HTTP Request**  | Generic REST API calls       | 🟢 Low     | Already exists, needs improvement |
| **Webhook**       | Receive HTTP requests        | 🟢 Low     | Already in Phase 5 TASK-007       |
| **Email (SMTP)**  | Send emails via SMTP         | 🟢 Low     | Simple protocol                   |
| **SendGrid**      | Transactional email          | 🟢 Low     | REST API                          |
| **Slack**         | Send messages, read channels | 🟡 Medium  | OAuth, webhooks                   |
| **Discord**       | Bot messages                 | 🟡 Medium  | Bot token auth                    |
| **Google Sheets** | Read/write spreadsheets      | 🟡 Medium  | OAuth2, complex API               |

### Tier 2: Popular (High Value)

| Integration  | Description             | Complexity | Notes           |
| ------------ | ----------------------- | ---------- | --------------- |
| **Stripe**   | Payments, subscriptions | 🟡 Medium  | Webhooks, REST  |
| **Airtable** | Database operations     | 🟡 Medium  | REST API        |
| **Notion**   | Pages, databases        | 🟡 Medium  | REST API        |
| **GitHub**   | Issues, PRs, webhooks   | 🟡 Medium  | REST + webhooks |
| **Twilio**   | SMS, voice              | 🟡 Medium  | REST API        |
| **AWS S3**   | File storage            | 🟡 Medium  | SDK integration |

### Tier 3: Specialized

| Integration         | Description        | Complexity | Notes               |
| ------------------- | ------------------ | ---------- | ------------------- |
| **Salesforce**      | CRM operations     | 🔴 High    | Complex OAuth, SOQL |
| **HubSpot**         | CRM, marketing     | 🟡 Medium  | REST API            |
| **Zendesk**         | Support tickets    | 🟡 Medium  | REST API            |
| **Shopify**         | E-commerce         | 🟡 Medium  | REST + webhooks     |
| **Zapier Webhooks** | Zapier integration | 🟢 Low     | Simple webhooks     |

---

## Architecture Pattern

All integrations should follow a consistent pattern:

### Node Structure

```typescript
// Each integration has:
// 1. Auth configuration node (one per project)
// 2. Action nodes (Send Message, Create Record, etc.)
// 3. Trigger nodes (On New Message, On Record Created, etc.)

// Example: Slack integration
// - Slack Auth (configure workspace)
// - Slack Send Message (action)
// - Slack Create Channel (action)
// - Slack On Message (trigger)
```

### Auth Pattern

```typescript
interface IntegrationAuth {
  type: 'api_key' | 'oauth2' | 'basic' | 'custom';
  credentials: Record<string, string>; // Encrypted at rest
  testConnection(): Promise<boolean>;
}
```

### Credential Storage

- Credentials stored encrypted in SQLite
- Per-project credential scope
- UI for managing credentials
- Test connection before save

---

## MVP Integration: Slack

As a reference implementation, here's what a Slack integration would look like:

### Nodes

1. **Slack Auth** (config node)

   - OAuth2 flow or bot token
   - Test connection
   - Store credentials

2. **Slack Send Message** (action)

   - Channel selector
   - Message text (with variables)
   - Optional: blocks, attachments
   - Outputs: message ID, timestamp

3. **Slack On Message** (trigger)
   - Channel filter
   - User filter
   - Keyword filter
   - Outputs: message, user, channel, timestamp

### Implementation Estimate

| Component                      | Effort  |
| ------------------------------ | ------- |
| Auth flow & credential storage | 4h      |
| Send Message node              | 4h      |
| On Message trigger             | 6h      |
| Testing & polish               | 4h      |
| **Total**                      | **18h** |

---

## Integration Framework

Before building many integrations, create a framework:

### Integration Registry

```typescript
interface Integration {
  id: string;
  name: string;
  icon: string;
  category: 'communication' | 'database' | 'file_storage' | 'marketing' | 'payment' | 'custom';
  authType: 'api_key' | 'oauth2' | 'basic' | 'none';
  nodes: IntegrationNode[];
}

interface IntegrationNode {
  type: 'action' | 'trigger';
  name: string;
  description: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
}
```

### Integration Builder (Future)

Eventually, allow users to create custom integrations:

- Define auth requirements
- Build actions with HTTP requests
- Create triggers with webhooks/polling
- Share integrations via marketplace

---

## Recommended Implementation Order

1. **Framework** (8h) - Auth storage, credential UI, node patterns
2. **HTTP Request improvements** (4h) - Better auth, response parsing
3. **SendGrid** (6h) - Simple, high value
4. **Slack** (18h) - Most requested
5. **Stripe** (12h) - High business value
6. **Google Sheets** (16h) - Popular but complex OAuth

---

## References

- [n8n integrations](https://n8n.io/integrations/) - Feature reference
- [Zapier apps](https://zapier.com/apps) - Integration inspiration
- [Native BaaS Integrations](../../future-projects/NATIVE-BAAS-INTEGRATIONS.md) - Related concept

---

## Why Deferred?

1. **Foundation first** - Execution history is more important than more integrations
2. **Scope creep** - Each integration is 8-20h of work
3. **HTTP covers most cases** - Generic HTTP Request node handles many APIs
4. **Community opportunity** - Integration framework enables community contributions

Once Phase 11 core is complete, integrations become the obvious next step.
