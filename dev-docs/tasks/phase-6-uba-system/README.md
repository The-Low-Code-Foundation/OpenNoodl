# Phase 6: Universal Backend Adapter (UBA) System

**Phase:** 6  
**Status:** 🔴 Not Started  
**Effort:** 8-12 weeks  
**Priority:** HIGH

---

## Overview

The Universal Backend Adapter (UBA) system enables Noodl to connect to any backend service (Directus, Supabase, Pocketbase, Firebase, custom APIs) through a unified configuration interface. Instead of hardcoding backend integrations, users configure adapters that translate between Noodl's data model and the target backend.

---

## Problem Statement

Currently, Noodl users who want to use external backends must:

1. Manually configure HTTP requests for each endpoint
2. Handle authentication, pagination, and error handling themselves
3. Build custom UI for CRUD operations
4. No schema introspection - everything is manual

---

## Solution: UBA System

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOODL DATA LAYER                              │
│                                                                  │
│   Query Node  →  UBA Adapter  →  Backend API  →  Response       │
│                                                                  │
│   The adapter handles:                                          │
│   • Authentication (Bearer, Basic, API Key)                     │
│   • Schema introspection                                        │
│   • Query translation                                           │
│   • Pagination                                                   │
│   • Error normalization                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

| Task    | Name              | Description                       | Effort    |
| ------- | ----------------- | --------------------------------- | --------- |
| UBA-001 | Foundation        | Schema parser, basic field types  | 2-3 weeks |
| UBA-002 | Field Types       | Complex fields (relations, JSON)  | 1-2 weeks |
| UBA-003 | Debug System      | Live debugging panel              | 1-2 weeks |
| UBA-004 | Polish            | UX improvements, error handling   | 1 week    |
| UBA-005 | Reference Backend | Example implementation (Directus) | 1-2 weeks |
| UBA-006 | Community         | Adapter sharing, marketplace      | 2-3 weeks |

---

## Architecture

See individual task files for detailed architecture:

- [UBA-001-FOUNDATION.md](./UBA-001-FOUNDATION.md) - Core system architecture
- [UBA-002-FIELD-TYPES.md](./UBA-002-FIELD-TYPES.md) - Field type system
- [UBA-003-DEBUG-SYSTEM.md](./UBA-003-DEBUG-SYSTEM.md) - Debug infrastructure
- [UBA-004-POLISH.md](./UBA-004-POLISH.md) - UX polish tasks
- [UBA-005-REFERENCE-BACKEND.md](./UBA-005-REFERENCE-BACKEND.md) - Directus adapter
- [UBA-006-COMMUNITY.md](./UBA-006-COMMUNITY.md) - Community features

---

## Dependencies

- Phase 3 Editor UX (property panel infrastructure)
- HTTP Node improvements (Phase 2/3)

---

## Success Criteria

- [ ] Users can configure Directus/Supabase connection via UI
- [ ] Schema introspection populates dropdowns automatically
- [ ] CRUD operations work with configured adapters
- [ ] Debug panel shows live request/response data
- [ ] At least 3 backend adapters available

---

## History

- **2026-01-07**: Moved from Phase 3 TASK-008 to dedicated Phase 6
- Previously named "granular-deployment" which was misleading

---

_Last Updated: January 2026_
