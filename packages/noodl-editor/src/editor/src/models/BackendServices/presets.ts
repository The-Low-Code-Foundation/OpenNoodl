/**
 * Backend Presets
 *
 * Pre-configured endpoint patterns for popular BaaS platforms.
 * These can be customized by users after selection.
 *
 * @module BackendServices
 * @since 1.2.0
 */

import { BackendAuthConfig, BackendEndpoints, BackendType, ResponseConfig } from './types';

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
}

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
  }
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
  }
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
  }
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
  }
};

/**
 * All available presets
 */
export const backendPresets: Record<BackendType, BackendPreset> = {
  directus: directusPreset,
  supabase: supabasePreset,
  pocketbase: pocketbasePreset,
  custom: customPreset
};

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
  return Object.values(backendPresets);
}

/**
 * Get presets excluding custom (for preset selection UI)
 */
export function getPresetOptions(): BackendPreset[] {
  return [directusPreset, supabasePreset, pocketbasePreset];
}
