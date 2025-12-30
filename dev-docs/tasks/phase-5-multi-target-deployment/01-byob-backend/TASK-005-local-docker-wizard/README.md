# TASK-005: Local Docker Backend Wizard

**Task ID:** TASK-005  
**Phase:** 5 - Multi-Target Deployment (BYOB)  
**Priority:** 🟢 Low  
**Difficulty:** 🟡 Medium  
**Estimated Time:** 3-5 days  
**Prerequisites:** TASK-001, Docker installed on user's machine  
**Branch:** `feature/byob-docker-wizard`

## Objective

Create a wizard that helps users spin up local backend instances (Directus, Pocketbase, Supabase) via Docker, and automatically configures the connection in Noodl.

## Background

Many users want to develop locally before deploying to production backends. Currently they must:

1. Manually install Docker
2. Find and run the correct Docker commands
3. Wait for the backend to start
4. Manually configure the connection in Noodl

This wizard automates steps 2-4.

## User Story

> As a Noodl developer, I want to quickly spin up a local backend for development, so I can start building without setting up cloud infrastructure.

## Desired State

- "Start Local Backend" button in Backend Services Panel
- Wizard to select backend type and configure ports
- One-click Docker container launch
- Automatic backend configuration after startup
- Status monitoring and stop/restart controls

## UI Design

### Step 1: Select Backend Type

```
┌─────────────────────────────────────────────────────────────────────┐
│ Start Local Backend                                            [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Select a backend to run locally via Docker:                         │
│                                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                    │
│ │  [Directus] │ │ [Pocketbase]│ │ [Supabase]  │                    │
│ │             │ │             │ │             │                    │
│ │  Directus   │ │ Pocketbase  │ │  Supabase   │                    │
│ │  ● Selected │ │             │ │  (complex)  │                    │
│ └─────────────┘ └─────────────┘ └─────────────┘                    │
│                                                                     │
│ ℹ️ Requires Docker to be installed and running                      │
│                                                                     │
│                                              [Cancel] [Next →]      │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 2: Configure Options

```
┌─────────────────────────────────────────────────────────────────────┐
│ Configure Directus                                             [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ CONTAINER NAME                                                      │
│ [noodl-directus          ]                                          │
│                                                                     │
│ PORT                                                                │
│ [8055   ] (default: 8055)                                           │
│                                                                     │
│ ADMIN CREDENTIALS                                                   │
│ Email:    [admin@example.com    ]                                   │
│ Password: [••••••••             ]                                   │
│                                                                     │
│ DATABASE                                                            │
│ ○ SQLite (simple, no extra setup)                                   │
│ ● PostgreSQL (recommended for production parity)                    │
│                                                                     │
│ DATA PERSISTENCE                                                    │
│ ☑ Persist data between restarts (uses Docker volume)               │
│                                                                     │
│                                         [← Back] [Start Backend]    │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 3: Starting / Progress

```
┌─────────────────────────────────────────────────────────────────────┐
│ Starting Directus...                                           [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░] 45%                     │
│                                                                     │
│ ✅ Checking Docker...                                               │
│ ✅ Pulling directus/directus:latest...                              │
│ ⏳ Starting container...                                            │
│ ○ Waiting for health check...                                       │
│ ○ Configuring connection...                                         │
│                                                                     │
│ ───────────────────────────────────────────────────────────────────│
│ $ docker run -d --name noodl-directus -p 8055:8055 ...             │
│                                                                     │
│                                                          [Cancel]   │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 4: Success

```
┌─────────────────────────────────────────────────────────────────────┐
│ Backend Ready! 🎉                                              [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ✅ Directus is running at http://localhost:8055                     │
│                                                                     │
│ ADMIN PANEL                                                         │
│ URL: http://localhost:8055/admin                                    │
│ Email: admin@example.com                                            │
│ Password: (as configured)                                           │
│                                                                     │
│ CONNECTION                                                          │
│ ✅ "Local Directus" backend added to your project                   │
│ ✅ Schema synced (0 collections - add some in admin panel)          │
│                                                                     │
│ [Open Admin Panel]                    [Done]                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Docker Commands

### Directus (SQLite)

```bash
docker run -d \
  --name noodl-directus \
  -p 8055:8055 \
  -e KEY="noodl-directus-key" \
  -e SECRET="noodl-directus-secret" \
  -e ADMIN_EMAIL="admin@example.com" \
  -e ADMIN_PASSWORD="password123" \
  -e DB_CLIENT="sqlite3" \
  -e DB_FILENAME="/directus/database/data.db" \
  -v noodl-directus-data:/directus/database \
  -v noodl-directus-uploads:/directus/uploads \
  directus/directus:latest
```

### Pocketbase

```bash
docker run -d \
  --name noodl-pocketbase \
  -p 8090:8090 \
  -v noodl-pocketbase-data:/pb_data \
  ghcr.io/muchobien/pocketbase:latest
```

### Supabase (docker-compose required)

Supabase is more complex and requires multiple containers. Consider either:

- Linking to official Supabase local dev docs
- Providing a bundled docker-compose.yml
- Skipping Supabase for initial implementation

## Implementation

### File Structure

```
packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/
├── LocalDockerWizard/
│   ├── LocalDockerWizard.tsx         # Main wizard component
│   ├── LocalDockerWizard.module.scss
│   ├── steps/
│   │   ├── SelectBackendStep.tsx
│   │   ├── ConfigureStep.tsx
│   │   ├── ProgressStep.tsx
│   │   └── SuccessStep.tsx
│   ├── docker/
│   │   ├── dockerCommands.ts         # Docker command builders
│   │   ├── directus.ts               # Directus-specific config
│   │   └── pocketbase.ts             # Pocketbase-specific config
│   └── types.ts
```

### Docker Detection

```typescript
async function checkDockerAvailable(): Promise<boolean> {
  try {
    const { stdout } = await exec('docker --version');
    return stdout.includes('Docker version');
  } catch {
    return false;
  }
}

async function checkDockerRunning(): Promise<boolean> {
  try {
    await exec('docker info');
    return true;
  } catch {
    return false;
  }
}
```

### Container Management

```typescript
interface DockerContainer {
  name: string;
  image: string;
  ports: Record<string, string>;
  env: Record<string, string>;
  volumes: string[];
}

async function startContainer(config: DockerContainer): Promise<void> {
  const args = [
    'run',
    '-d',
    '--name',
    config.name,
    ...Object.entries(config.ports).flatMap(([h, c]) => ['-p', `${h}:${c}`]),
    ...Object.entries(config.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    ...config.volumes.flatMap((v) => ['-v', v]),
    config.image
  ];

  await exec(`docker ${args.join(' ')}`);
}

async function waitForHealthy(url: string, timeout = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}
```

## Success Criteria

- [ ] Docker availability check works
- [ ] Directus container can be started
- [ ] Pocketbase container can be started
- [ ] Health check waits for backend to be ready
- [ ] Backend config auto-created after startup
- [ ] Container name/port configurable
- [ ] Data persists with Docker volumes
- [ ] Error handling for common issues (port in use, etc.)

## Future Enhancements

- Container status in Backend Services Panel
- Stop/Restart/Delete buttons
- View container logs
- Supabase support (via docker-compose)
- Auto-start containers when project opens
