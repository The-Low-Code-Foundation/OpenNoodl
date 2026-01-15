# Phase 11: Cloud Functions & Workflow Automation

**Status:** Planning  
**Dependencies:** Phase 5 TASK-007 (Integrated Local Backend) - MUST BE COMPLETE  
**Total Estimated Effort:** 10-12 weeks  
**Strategic Goal:** Transform OpenNoodl into a viable workflow automation platform

---

## Executive Summary

Phase 11 extends the local backend infrastructure from Phase 5 TASK-007 to add workflow automation features that enable OpenNoodl to compete with tools like n8n. This phase focuses on **unique features not covered elsewhere** - execution history, cloud deployment, monitoring, advanced workflow nodes, and Python/AI runtime support.

> ⚠️ **Important:** This phase assumes Phase 5 TASK-007 is complete. That phase provides the foundational SQLite database, Express backend server, CloudRunner adaptation, and basic trigger nodes (Schedule, DB Change, Webhook).

---

## What This Phase Delivers

### 1. Advanced Workflow Nodes

Visual logic nodes that make complex workflows possible without code:

- IF/ELSE conditions with visual expression builder
- Switch nodes (multi-branch routing)
- For Each loops (array iteration)
- Merge/Split nodes (parallel execution)
- Error handling (try/catch, retry logic)
- Wait/Delay nodes

### 2. Execution History & Debugging

Complete visibility into workflow execution:

- Full execution log for every workflow run
- Input/output data captured for each node
- Timeline visualization
- Canvas overlay showing execution data
- Search and filter execution history

### 3. Cloud Deployment

One-click deployment to production:

- Docker container generation
- Fly.io, Railway, Render integrations
- Environment variable management
- SSL/domain configuration
- Rollback capability

### 4. Monitoring & Observability

Production-ready monitoring:

- Workflow performance metrics
- Error tracking and alerting
- Real-time execution feed
- Email/webhook notifications

### 5. Python Runtime & AI Nodes (Bonus)

AI-first workflow capabilities:

- Dual JavaScript/Python runtime
- Claude/OpenAI completion nodes
- LangGraph agent nodes
- Vector store integrations

---

## Phase Structure

| Series | Name                          | Duration | Priority     |
| ------ | ----------------------------- | -------- | ------------ |
| **1**  | Advanced Workflow Nodes       | 2 weeks  | High         |
| **2**  | Execution History & Debugging | 3 weeks  | **Critical** |
| **3**  | Cloud Deployment              | 3 weeks  | High         |
| **4**  | Monitoring & Observability    | 2 weeks  | Medium       |
| **5**  | Python Runtime & AI Nodes     | 4 weeks  | Medium       |

**Recommended Order:** Series 1 → 2 → 3 → 4 → 5

Series 2 (Execution History) is the highest priority as it enables debugging of workflows - critical for any production use.

---

## Recommended Task Execution Order

> ⚠️ **Critical:** To avoid rework, follow this sequencing.

### Step 1: Phase 5 TASK-007 (Foundation) — DO FIRST

| Sub-task  | Name                           | Hours  | Phase 11 Needs?                        |
| --------- | ------------------------------ | ------ | -------------------------------------- |
| TASK-007A | LocalSQL Adapter (SQLite)      | 16-20h | **YES** - CF11-004 reuses patterns     |
| TASK-007B | Backend Server (Express)       | 12-16h | **YES** - Execution APIs live here     |
| TASK-007C | Workflow Runtime (CloudRunner) | 12-16h | **YES** - All workflow nodes need this |
| TASK-007D | Launcher Integration           | 8-10h  | No - Can defer                         |
| TASK-007E | Migration/Export               | 8-10h  | No - Can defer                         |
| TASK-007F | Standalone Deployment          | 8-10h  | No - Can defer                         |

**Start with TASK-007A/B/C only** (~45h). This creates the foundation without doing unnecessary work.

### Step 2: Phase 11 Series 1 & 2 (Core Workflow Features)

Once TASK-007A/B/C are complete:

1. **CF11-001 → CF11-003** (Advanced Nodes) - 2 weeks
2. **CF11-004 → CF11-007** (Execution History) - 3 weeks ⭐ PRIORITY

### Step 3: Continue Either Phase

At this point, you can:

- Continue Phase 11 (Series 3-5: Deployment, Monitoring, AI)
- Return to Phase 5 (TASK-007D/E/F: Launcher, Migration, Deployment)

### Why This Order?

If CF11-004 (Execution Storage) is built **before** TASK-007A (SQLite Adapter):

- Two independent SQLite implementations would be created
- Later refactoring needed to harmonize patterns
- **~4-8 hours of preventable rework**

The CloudRunner (TASK-007C) must exist before any workflow nodes can be tested.

---

## Dependency Graph

```
Phase 5 TASK-007 (Local Backend)
         │
         ├── SQLite Adapter ✓
         ├── Backend Server ✓
         ├── CloudRunner ✓
         ├── Basic Triggers ✓
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                    PHASE 11                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Series 1: Advanced Nodes ─┬─► Series 2: Exec History
│                            │          │
│                            │          ▼
│                            └─► Series 3: Deployment
│                                        │
│                                        ▼
│                               Series 4: Monitoring
│                                        │
│                                        ▼
│                               Series 5: Python/AI
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Task List

### Series 1: Advanced Workflow Nodes (2 weeks)

| Task     | Name                                    | Effort | Status      |
| -------- | --------------------------------------- | ------ | ----------- |
| CF11-001 | Logic Nodes (IF/Switch/ForEach/Merge)   | 12-16h | Not Started |
| CF11-002 | Error Handling Nodes (Try/Catch, Retry) | 8-10h  | Not Started |
| CF11-003 | Wait/Delay Nodes                        | 4-6h   | Not Started |

### Series 2: Execution History (3 weeks) ⭐ PRIORITY

| Task     | Name                         | Effort | Status      |
| -------- | ---------------------------- | ------ | ----------- |
| CF11-004 | Execution Storage Schema     | 8-10h  | Not Started |
| CF11-005 | Execution Logger Integration | 8-10h  | Not Started |
| CF11-006 | Execution History Panel UI   | 12-16h | Not Started |
| CF11-007 | Canvas Execution Overlay     | 8-10h  | Not Started |

### Series 3: Cloud Deployment (3 weeks)

| Task     | Name                        | Effort | Status      |
| -------- | --------------------------- | ------ | ----------- |
| CF11-008 | Docker Container Builder    | 10-12h | Not Started |
| CF11-009 | Fly.io Deployment Provider  | 8-10h  | Not Started |
| CF11-010 | Railway Deployment Provider | 6-8h   | Not Started |
| CF11-011 | Cloud Deploy Panel UI       | 10-12h | Not Started |

### Series 4: Monitoring & Observability (2 weeks)

| Task     | Name                      | Effort | Status      |
| -------- | ------------------------- | ------ | ----------- |
| CF11-012 | Metrics Collection System | 8-10h  | Not Started |
| CF11-013 | Monitoring Dashboard UI   | 12-16h | Not Started |
| CF11-014 | Alerting System           | 6-8h   | Not Started |

### Series 5: Python Runtime & AI Nodes (4 weeks)

| Task     | Name                  | Effort | Status      |
| -------- | --------------------- | ------ | ----------- |
| CF11-015 | Python Runtime Bridge | 12-16h | Not Started |
| CF11-016 | Python Core Nodes     | 10-12h | Not Started |
| CF11-017 | Claude/OpenAI Nodes   | 10-12h | Not Started |
| CF11-018 | LangGraph Agent Node  | 12-16h | Not Started |
| CF11-019 | Language Toggle UI    | 6-8h   | Not Started |

---

## What's NOT in This Phase

### Handled by Phase 5 TASK-007

- ❌ SQLite database adapter (TASK-007A)
- ❌ Express backend server (TASK-007B)
- ❌ CloudRunner adaptation (TASK-007C)
- ❌ Basic trigger nodes (Schedule, DB Change, Webhook)
- ❌ Schema management
- ❌ Launcher integration

### Deferred to Future Phase

- ❌ External integrations (Slack, SendGrid, Stripe, etc.) - See `FUTURE-INTEGRATIONS.md`
- ❌ Workflow marketplace/templates
- ❌ Multi-user collaboration
- ❌ Workflow versioning/Git integration
- ❌ Queue/job system

---

## Success Criteria

### Functional

- [ ] Can create IF/ELSE workflows with visual expression builder
- [ ] Can view complete execution history with node-by-node data
- [ ] Can debug failed workflows by pinning execution to canvas
- [ ] Can deploy workflows to Fly.io with one click
- [ ] Can monitor workflow performance in real-time
- [ ] Can create Python workflows for AI use cases
- [ ] Can use Claude/OpenAI APIs in visual workflows

### User Experience

- [ ] Creating a conditional workflow takes < 3 minutes
- [ ] Debugging failed workflows takes < 2 minutes
- [ ] Deploying to production takes < 5 minutes
- [ ] Setting up AI chat assistant takes < 10 minutes

### Technical

- [ ] Workflow execution overhead < 50ms
- [ ] Execution history queries < 100ms
- [ ] Real-time monitoring updates < 1 second latency
- [ ] Can handle 1000 concurrent workflow executions

---

## Risk Assessment

| Risk                             | Impact       | Mitigation                                        |
| -------------------------------- | ------------ | ------------------------------------------------- |
| Phase 5 TASK-007 not complete    | **BLOCKING** | Do not start Phase 11 until TASK-007 is done      |
| Python runtime complexity        | High         | Start with JS-only, add Python as separate series |
| Deployment platform variability  | Medium       | Focus on Fly.io first, add others incrementally   |
| Execution history storage growth | Medium       | Implement retention policies early                |

---

## References

- [Phase 5 TASK-007: Integrated Local Backend](../phase-5-multi-target-deployment/01-byob-backend/TASK-007-integrated-backend/README.md)
- [Cloud Functions Revival Plan (Original)](./cloud-functions-revival-plan.md)
- [Native BaaS Integrations](../../future-projects/NATIVE-BAAS-INTEGRATIONS.md)
- [Phase 10: AI-Powered Development](../phase-10-ai-powered-development/README.md)

---

## Changelog

| Date       | Change                                               |
| ---------- | ---------------------------------------------------- |
| 2026-01-15 | Restructured to remove overlap with Phase 5 TASK-007 |
| 2026-01-15 | Prioritized Execution History over Cloud Deployment  |
| 2026-01-15 | Moved integrations to future work                    |
