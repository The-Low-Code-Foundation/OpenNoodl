/**
 * Backend Presets
 *
 * Pre-configured endpoint patterns for popular BaaS platforms.
 * These can be customized by users after selection.
 *
 * @module BackendServices
 * @since 1.2.0
 */

import { BACKEND_DISPLAY_NAMES } from '@noodl/backend-contract';

import { BackendSecurityDisclosure, securityFor } from './security';
import { BackendAuthConfig, BackendEndpoints, BackendType, ResponseConfig } from './types';

/**
 * Which mechanism configures a backend of this type.
 *
 * BCN-009: the panel is one list, but underneath it there are still three
 * places a backend binding can be written, and pretending otherwise is how a
 * user ends up with a Parse endpoint configured twice in two shapes:
 *
 * - `rest-config` — a `BackendConfig` in the project's `backendServices`
 *   metadata. URL, tokens, endpoint patterns. The REST backends.
 * - `cloud-endpoint` — the project's `cloudservices` metadata, `{endpoint,
 *   appId, type}`. One per project, and the only thing a Parse-wire backend
 *   needs. Written by the Cloud Services Endpoint card.
 * - `managed-process` — a `nodegx-backend` this editor starts and stops. Listed
 *   over IPC, not stored in the project at all; it becomes the project's
 *   backend by writing `cloudservices` when it starts.
 *
 * Converging those three metadata homes is BCN-009 step 2 and is deliberately
 * *not* done here — this field is what lets one list dispatch to the right one
 * in the meantime.
 */
export type BackendConfigurationRoute = 'rest-config' | 'cloud-endpoint' | 'managed-process';

/**
 * Preset configuration for a backend type
 */
export interface BackendPreset {
  type: BackendType;
  displayName: string;
  description: string;
  icon: string;
  docsUrl: string;
  defaultAuth: BackendAuthConfig;
  endpoints: BackendEndpoints;
  responseConfig: ResponseConfig;
  /** Placeholder URL to show in the input */
  urlPlaceholder: string;
  /** Short help text shown inline */
  authHelpText: string;
  /** Detailed help for admin API key (shown in popup) */
  adminKeyHelp: string;
  /** Detailed help for public API key (shown in popup) */
  publicKeyHelp: string;
  /** Which of the three configuration mechanisms owns a backend of this type. */
  configuredBy: BackendConfigurationRoute;
  /**
   * What this backend's security model means for the app the user is about to
   * publish. Carried on the preset so that every surface which can name a
   * backend can also say what choosing it publishes — see `./security.ts`.
   */
  security: BackendSecurityDisclosure;
}

/**
 * "Built-in" — the backend that ships with NodeGX.
 *
 * BCN-009 step 1. The name is Richard's call, recorded in the phase's answered
 * questions: **"Built-in"**, because it says the least and so ages the best.
 * "SQLite" leaks an implementation detail that stops being true if the
 * persistence layer ever changes, and "NodeGX Backend" reads as a separate
 * thing you have to go and get.
 *
 * The endpoints below are the Parse REST paths this backend serves
 * (`nodegx-backend/src/server/parse-wire.ts`). They are recorded for the same
 * reason every other preset records them — so one table describes every
 * backend — but nothing writes a `BackendConfig` of this type: a built-in
 * backend is configured by starting one (`managed-process`), which writes the
 * project's `cloudservices` metadata for it.
 */
export const nodegxPreset: BackendPreset = {
  type: 'nodegx',
  displayName: BACKEND_DISPLAY_NAMES.nodegx,
  description: 'The backend that ships with NodeGX. Records, users, files, functions and realtime, with nothing to set up',
  icon: 'database',
  docsUrl: '',
  urlPlaceholder: 'http://localhost:8577',
  authHelpText: 'No keys to configure — a built-in backend is reached by its app id',
  adminKeyHelp: `**Admin access (Built-in)**

There is no admin key to paste. The editor talks to a built-in backend it started, over a channel that never leaves this machine, and to a deployed one through the app id on the Cloud Services Endpoint card.

Who can read and write each collection is set in **Access**, on the backend's own card.`,
  publicKeyHelp: `**Public access (Built-in)**

There is no public key. Your published app carries the backend's **app id**, which names the server and opens nothing on its own.

What a visitor may do is decided by the **Access** rules on each collection, and by any rule carried on an individual record. Both are checked by the backend on every request.`,
  defaultAuth: {
    method: 'none'
  },
  endpoints: {
    list: '/classes/{table}',
    get: '/classes/{table}/{id}',
    create: '/classes/{table}',
    update: '/classes/{table}/{id}',
    delete: '/classes/{table}/{id}',
    schema: '/schemas'
  },
  responseConfig: {
    dataPath: 'results',
    totalCountPath: 'count',
    paginationType: 'offset',
    offsetParam: 'skip',
    limitParam: 'limit'
  },
  configuredBy: 'managed-process',
  security: securityFor('nodegx')
};

/**
 * Parse Server.
 *
 * A separate entry from `nodegx` **despite speaking the same wire**, which
 * looked like duplication until BCN-001 read the handler and BCN-002 drove a
 * real `parseplatform/parse-server:7.3.0`: our backend serves `/aggregate` and
 * `/distinct` under an ordinary find permission and the read ACL, upstream
 * Parse restricts the same route to the master key, and a stock Parse Server
 * refuses file uploads outright. Same wire, different capabilities — which is
 * the thing a user needs told, so they are two rows here and two columns in the
 * capability descriptor.
 *
 * Configured through the Cloud Services Endpoint card, not through the REST
 * form: a Parse-wire backend needs `{endpoint, appId}` and nothing else, and
 * offering a second place to type them is the duplication this task removes.
 */
export const parsePreset: BackendPreset = {
  type: 'parse',
  displayName: BACKEND_DISPLAY_NAMES.parse,
  description: 'A Parse Server you or someone else hosts, reached by its endpoint and application id',
  icon: 'parse',
  docsUrl: 'https://docs.parseplatform.org/parse-server/guide/',
  urlPlaceholder: 'https://your-parse-server.example.com/parse',
  authHelpText: 'A Parse server is reached by endpoint and application id — no keys are stored here',
  adminKeyHelp: `**Admin access (Parse Server)**

There is no admin key field, and that is deliberate: the master-key admin surface was retired along with the Parse management panel, and nothing left in NodeGX reads one.

Schemas, permissions and ACLs are managed on the Parse server itself, usually through a Parse Dashboard run by whoever hosts it.`,
  publicKeyHelp: `**Public access (Parse Server)**

Your published app carries the server's **application id**. It is not a password — what it reaches is whatever your class-level permissions and per-record ACLs allow, checked by the server on every request.

A master key is never published. If your server also requires a REST API key for client requests, that key would be published too, so treat it exactly like the application id and rely on permissions rather than on it being secret.`,
  defaultAuth: {
    method: 'none'
  },
  endpoints: {
    list: '/classes/{table}',
    get: '/classes/{table}/{id}',
    create: '/classes/{table}',
    update: '/classes/{table}/{id}',
    delete: '/classes/{table}/{id}',
    schema: '/schemas'
  },
  responseConfig: {
    dataPath: 'results',
    totalCountPath: 'count',
    paginationType: 'offset',
    offsetParam: 'skip',
    limitParam: 'limit'
  },
  configuredBy: 'cloud-endpoint',
  security: securityFor('parse')
};

/**
 * Directus preset configuration
 * @see https://docs.directus.io/reference/introduction.html
 */
export const directusPreset: BackendPreset = {
  type: 'directus',
  displayName: 'Directus',
  description: 'Open source headless CMS with powerful REST API and admin panel',
  icon: 'directus',
  docsUrl: 'https://docs.directus.io/reference/introduction.html',
  urlPlaceholder: 'https://your-directus-instance.com',
  authHelpText: 'Configure tokens from Directus Admin > Settings > Access Tokens',
  adminKeyHelp: `**Admin API Key Setup (Directus)**

1. Go to **Settings → Access Tokens** in your Directus admin panel
2. Click **Create Token** and give it a descriptive name (e.g., "Noodl Schema Access")
3. Set the role to **Admin** or a custom role with:
   - Read access to \`directus_fields\` (required for schema)
   - Read access to \`directus_collections\` (required for table list)
4. Copy the generated token

**Note:** This token is only used in the editor for fetching your database structure. It will NOT be published to your deployed app.`,
  publicKeyHelp: `**Public API Key Setup (Directus)**

1. Go to **Settings → Access Tokens** in your Directus admin panel  
2. Create a new token with the **Public** role (or a custom limited role)
3. Configure which collections this role can access:
   - Go to **Settings → Roles & Permissions → Public**
   - Enable **read** permissions only on collections you want public
   - Example: Allow reading "products" but not "users"
4. Copy the generated token

**⚠️ Warning:** This token WILL be visible in your deployed app. Only grant access to data that should be publicly readable.`,
  defaultAuth: {
    method: 'bearer',
    adminToken: '',
    publicToken: ''
  },
  endpoints: {
    list: '/items/{table}',
    get: '/items/{table}/{id}',
    create: '/items/{table}',
    update: '/items/{table}/{id}',
    delete: '/items/{table}/{id}',
    schema: '/fields'
  },
  responseConfig: {
    dataPath: 'data',
    totalCountPath: 'meta.total_count',
    paginationType: 'offset',
    offsetParam: 'offset',
    limitParam: 'limit'
  },
  configuredBy: 'rest-config',
  security: securityFor('directus')
};

/**
 * Supabase preset configuration
 * @see https://supabase.com/docs/guides/api
 */
export const supabasePreset: BackendPreset = {
  type: 'supabase',
  displayName: 'Supabase',
  description: 'Open source Firebase alternative with PostgreSQL database',
  icon: 'supabase',
  docsUrl: 'https://supabase.com/docs/guides/api',
  urlPlaceholder: 'https://your-project.supabase.co',
  authHelpText: 'Find your keys in Supabase Dashboard > Settings > API',
  adminKeyHelp: `**Admin API Key Setup (Supabase)**

1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Under "Project API Keys", find the **service_role** key
4. Click "Reveal" and copy the key

**Important:** The service_role key bypasses Row Level Security (RLS). This gives full database access which is needed for schema introspection.

**Note:** This key is only used in the editor. It will NOT be published to your deployed app.`,
  publicKeyHelp: `**Public API Key Setup (Supabase)**

1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Under "Project API Keys", find the **anon** (public) key
4. Copy this key

**Security with RLS:**
The anon key works with Row Level Security (RLS) policies. Make sure to:
- Enable RLS on tables that should have restricted access
- Create policies for what anonymous users can read
- Example policy: Allow reading products where \`is_published = true\`

**⚠️ Warning:** This key WILL be visible in your deployed app. Use RLS policies to control data access.`,
  defaultAuth: {
    method: 'api-key',
    apiKeyHeader: 'apikey',
    adminToken: '',
    publicToken: ''
  },
  endpoints: {
    list: '/rest/v1/{table}',
    get: '/rest/v1/{table}?id=eq.{id}',
    create: '/rest/v1/{table}',
    update: '/rest/v1/{table}?id=eq.{id}',
    delete: '/rest/v1/{table}?id=eq.{id}',
    schema: '/rest/v1/' // Returns OpenAPI spec
  },
  responseConfig: {
    dataPath: '', // Supabase returns array directly
    totalCountPath: '', // Needs special header: Prefer: count=exact
    paginationType: 'offset',
    offsetParam: 'offset',
    limitParam: 'limit'
  },
  configuredBy: 'rest-config',
  security: securityFor('supabase')
};

/**
 * Pocketbase preset configuration
 * @see https://pocketbase.io/docs/api-records/
 */
export const pocketbasePreset: BackendPreset = {
  type: 'pocketbase',
  displayName: 'Pocketbase',
  description: 'Lightweight backend in a single binary with SQLite',
  icon: 'pocketbase',
  docsUrl: 'https://pocketbase.io/docs/api-records/',
  urlPlaceholder: 'http://localhost:8090',
  authHelpText: 'Use admin credentials for schema access',
  adminKeyHelp: `**Admin API Key Setup (Pocketbase)**

1. Start your Pocketbase instance and go to the admin UI (typically /_/)
2. Navigate to **Settings → Admins**
3. You can either:
   - Use your admin email/password for authentication, OR
   - Create an admin API token if your version supports it

**Alternative - Using Admin Auth:**
For Pocketbase, you may need to use admin email + password authentication instead of a static token. The editor will handle this appropriately.

**Note:** Admin access is only used in the editor for fetching collections and their schemas. It will NOT be published.`,
  publicKeyHelp: `**Public API Key Setup (Pocketbase)**

Pocketbase uses **API Rules** instead of API keys for public access:

1. Go to your Pocketbase admin UI
2. Navigate to **Collections** and select a collection
3. Click **API Rules** tab
4. Configure rules for anonymous access:
   - **List rule:** Leave empty for public read, or add conditions
   - **View rule:** Leave empty for public single-item read
   - Example: \`is_published = true\` to only show published items

**No Public Token Needed:**
If you've configured API rules to allow anonymous access, you can leave this field empty. Pocketbase will allow access based on your rules.

**⚠️ Note:** API rules determine what unauthenticated users can access in your deployed app.`,
  defaultAuth: {
    method: 'bearer',
    adminToken: '',
    publicToken: ''
  },
  endpoints: {
    list: '/api/collections/{table}/records',
    get: '/api/collections/{table}/records/{id}',
    create: '/api/collections/{table}/records',
    update: '/api/collections/{table}/records/{id}',
    delete: '/api/collections/{table}/records/{id}',
    schema: '/api/collections'
  },
  responseConfig: {
    dataPath: 'items',
    totalCountPath: 'totalItems',
    paginationType: 'page',
    offsetParam: 'page',
    limitParam: 'perPage'
  },
  configuredBy: 'rest-config',
  security: securityFor('pocketbase')
};

/**
 * Custom REST API preset (starting point for manual configuration)
 */
export const customPreset: BackendPreset = {
  type: 'custom',
  displayName: 'Custom REST API',
  description: 'Configure any REST API with custom endpoints',
  icon: 'api',
  docsUrl: '',
  urlPlaceholder: 'https://api.example.com',
  authHelpText: 'Configure authentication based on your API requirements',
  adminKeyHelp: `**Admin API Key Setup (Custom REST)**

For schema introspection, you need an API key or token that has permission to:
- Read your API's schema endpoint
- Access metadata about tables/collections and their fields

This will depend on your specific API implementation. Common patterns:
- Bearer token with admin scope
- API key with read-all permissions
- Service account credentials

**Note:** This key is only used in the editor for development. It will NOT be published to your deployed app.`,
  publicKeyHelp: `**Public API Key Setup (Custom REST)**

If your API supports unauthenticated or limited-access requests, configure:
- A public API key with restricted permissions
- A read-only token for specific resources
- Or leave empty if your API handles public access differently

**⚠️ Warning:** If you provide a public key, it WILL be included in your deployed app and visible to end users. Only use keys that are safe to expose publicly.`,
  defaultAuth: {
    method: 'bearer',
    adminToken: '',
    publicToken: ''
  },
  endpoints: {
    list: '/{table}',
    get: '/{table}/{id}',
    create: '/{table}',
    update: '/{table}/{id}',
    delete: '/{table}/{id}',
    schema: '/schema'
  },
  responseConfig: {
    dataPath: 'data',
    totalCountPath: 'total',
    paginationType: 'offset',
    offsetParam: 'offset',
    limitParam: 'limit'
  },
  configuredBy: 'rest-config',
  security: securityFor('custom')
};

/**
 * All available presets.
 *
 * Six, and the order is the order the user sees: the one that needs nothing set
 * up first, then the hosted backends, then the escape hatch. `Record<BackendType,
 * …>` means adding a seventh backend type to the contract fails to compile until
 * somebody has written what it publishes.
 */
export const backendPresets: Record<BackendType, BackendPreset> = {
  nodegx: nodegxPreset,
  parse: parsePreset,
  directus: directusPreset,
  supabase: supabasePreset,
  pocketbase: pocketbasePreset,
  custom: customPreset
};

/** The order the six appear in, everywhere they are listed. */
export const BACKEND_PRESET_ORDER: readonly BackendType[] = Object.freeze([
  'nodegx',
  'parse',
  'directus',
  'supabase',
  'pocketbase',
  'custom'
]);

/**
 * Get a preset by type
 */
export function getPreset(type: BackendType): BackendPreset {
  return backendPresets[type] || customPreset;
}

/**
 * Get all presets as an array (useful for UI)
 */
export function getAllPresets(): BackendPreset[] {
  return BACKEND_PRESET_ORDER.map((type) => backendPresets[type]);
}

/**
 * The presets offered when adding a backend.
 *
 * BCN-009: this used to be three — Directus, Supabase, PocketBase — with Custom
 * hardcoded as a fourth button in the dialog and the two Parse-wire backends
 * absent entirely, which is precisely why the panel read as two unrelated
 * products. It is all six now, and the dialog dispatches on `configuredBy`.
 */
export function getPresetOptions(): BackendPreset[] {
  return getAllPresets();
}

/** The presets the REST configuration form can create a `BackendConfig` for. */
export function getRestConfigurablePresets(): BackendPreset[] {
  return getAllPresets().filter((preset) => preset.configuredBy === 'rest-config');
}
