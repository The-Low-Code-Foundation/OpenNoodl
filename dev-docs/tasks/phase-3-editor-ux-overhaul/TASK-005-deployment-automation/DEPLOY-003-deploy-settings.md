# DEPLOY-003: Deploy Settings & Environment Variables

## Overview

Provide comprehensive deployment configuration including environment variables, build settings, custom domains, and deployment rules. Users can manage different environments (development, staging, production) with different configurations.

## Context

Currently:
- Environment variables set per deploy manually
- No persistent environment configuration
- No distinction between environments
- Custom domain setup requires external configuration

This task adds:
- Persistent environment variable management
- Multiple environment profiles
- Custom domain configuration
- Build optimization settings
- Deploy rules and triggers

## Requirements

### Functional Requirements

1. **Environment Variables**
   - Add/edit/delete variables
   - Sensitive variable masking
   - Import from .env file
   - Export to .env file
   - Variable validation

2. **Environment Profiles**
   - Development, Staging, Production presets
   - Custom profiles
   - Variables per profile
   - Easy switching

3. **Custom Domains**
   - View current domains
   - Add custom domain
   - SSL certificate status
   - DNS configuration help

4. **Build Settings**
   - Output directory
   - Base URL configuration
   - Asset optimization
   - Source maps (dev only)

5. **Deploy Rules**
   - Auto-deploy on push
   - Branch-based rules
   - Deploy schedule
   - Deploy hooks/webhooks

### Non-Functional Requirements

- Variables encrypted at rest
- Sensitive values never logged
- Sync with platform settings
- Works offline (cached)

## Technical Approach

### 1. Environment Configuration Service

```typescript
// packages/noodl-editor/src/editor/src/services/EnvironmentConfigService.ts

interface EnvironmentVariable {
  key: string;
  value: string;
  sensitive: boolean;  // Masked in UI
  scope: VariableScope;
}

enum VariableScope {
  BUILD = 'build',      // Available during build
  RUNTIME = 'runtime',  // Injected into app
  BOTH = 'both'
}

interface EnvironmentProfile {
  id: string;
  name: string;
  description?: string;
  variables: EnvironmentVariable[];
  isDefault: boolean;
  platform?: DeployPlatform;  // If linked to a platform
}

interface DeploySettings {
  outputDirectory: string;
  baseUrl: string;
  assetOptimization: boolean;
  sourceMaps: boolean;
  cleanUrls: boolean;
  trailingSlash: boolean;
}

class EnvironmentConfigService {
  private static instance: EnvironmentConfigService;
  
  // Profiles
  async getProfiles(projectId: string): Promise<EnvironmentProfile[]>;
  async createProfile(projectId: string, profile: Omit<EnvironmentProfile, 'id'>): Promise<EnvironmentProfile>;
  async updateProfile(projectId: string, profileId: string, updates: Partial<EnvironmentProfile>): Promise<void>;
  async deleteProfile(projectId: string, profileId: string): Promise<void>;
  
  // Variables
  async getVariables(projectId: string, profileId: string): Promise<EnvironmentVariable[]>;
  async setVariable(projectId: string, profileId: string, variable: EnvironmentVariable): Promise<void>;
  async deleteVariable(projectId: string, profileId: string, key: string): Promise<void>;
  async importFromEnvFile(projectId: string, profileId: string, content: string): Promise<void>;
  async exportToEnvFile(projectId: string, profileId: string): Promise<string>;
  
  // Build settings
  async getDeploySettings(projectId: string): Promise<DeploySettings>;
  async updateDeploySettings(projectId: string, settings: Partial<DeploySettings>): Promise<void>;
  
  // Platform sync
  async syncWithPlatform(projectId: string, profileId: string, platform: DeployPlatform): Promise<void>;
  async pullFromPlatform(projectId: string, platform: DeployPlatform): Promise<EnvironmentVariable[]>;
}
```

### 2. Environment Storage

```typescript
// Store in project metadata, encrypted
interface ProjectDeployConfig {
  profiles: EnvironmentProfile[];
  activeProfileId: string;
  deploySettings: DeploySettings;
  domains: CustomDomain[];
  deployRules: DeployRule[];
}

// Encryption for sensitive values
class SecureStorage {
  async encrypt(value: string): Promise<string>;
  async decrypt(value: string): Promise<string>;
}

// Store encrypted in project.json
{
  "metadata": {
    "deployConfig": {
      "profiles": [
        {
          "id": "prod",
          "name": "Production",
          "variables": [
            {
              "key": "API_URL",
              "value": "https://api.example.com",  // Plain text
              "sensitive": false
            },
            {
              "key": "API_KEY",
              "value": "encrypted:abc123...",  // Encrypted
              "sensitive": true
            }
          ]
        }
      ]
    }
  }
}
```

### 3. Domain Configuration

```typescript
interface CustomDomain {
  domain: string;
  platform: DeployPlatform;
  siteId: string;
  status: DomainStatus;
  sslStatus: SSLStatus;
  dnsRecords?: DNSRecord[];
}

enum DomainStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  FAILED = 'failed'
}

enum SSLStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  FAILED = 'failed'
}

interface DNSRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  required: boolean;
}

class DomainService {
  async addDomain(siteId: string, domain: string): Promise<CustomDomain>;
  async verifyDomain(domainId: string): Promise<DomainStatus>;
  async getDNSInstructions(domain: string): Promise<DNSRecord[]>;
  async checkSSL(domainId: string): Promise<SSLStatus>;
}
```

### 4. Deploy Rules

```typescript
interface DeployRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: DeployTrigger;
  conditions: DeployCondition[];
  actions: DeployAction[];
}

interface DeployTrigger {
  type: 'push' | 'schedule' | 'manual' | 'webhook';
  config: PushConfig | ScheduleConfig | WebhookConfig;
}

interface PushConfig {
  branches: string[];  // Glob patterns
  paths?: string[];    // Only deploy if these paths changed
}

interface ScheduleConfig {
  cron: string;  // Cron expression
  timezone: string;
}

interface DeployCondition {
  type: 'branch' | 'tag' | 'path' | 'message';
  operator: 'equals' | 'contains' | 'matches';
  value: string;
}

interface DeployAction {
  type: 'deploy' | 'notify' | 'webhook';
  config: DeployActionConfig | NotifyConfig | WebhookConfig;
}
```

### 5. UI Components

#### Environment Variables Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Environment Variables                                         [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Profile: [Production ▾]    [+ New Profile]                         │
│                                                                     │
│ VARIABLES                                           [Import .env]  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Key                    Value                   Scope      [⋯]  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ API_URL                https://api.example.com  Runtime   [✎🗑] │ │
│ │ API_KEY                ••••••••••••••••••••••  Runtime   [✎🗑] │ │
│ │ ANALYTICS_ID           UA-12345678-1           Runtime   [✎🗑] │ │
│ │ DEBUG                  false                   Build     [✎🗑] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [+ Add Variable]                                    [Export .env]  │
│                                                                     │
│ ☑ Sync with Netlify                                                │
│ Last synced: 5 minutes ago                          [Sync Now]    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Build Settings Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Build Settings                                                [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ OUTPUT                                                              │
│ Output Directory:    [dist                                      ]  │
│ Base URL:           [/                                          ]  │
│                                                                     │
│ OPTIMIZATION                                                        │
│ ☑ Optimize assets (minify JS/CSS)                                  │
│ ☐ Generate source maps (increases build size)                      │
│ ☑ Clean URLs (remove .html extension)                              │
│ ☐ Trailing slash on URLs                                           │
│                                                                     │
│ ADVANCED                                                            │
│ Build Command:      [npm run build                              ]  │
│ Publish Directory:  [build                                      ]  │
│                                                                     │
│ NODE VERSION                                                        │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 18 (LTS)                                                    [▾] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                                  [Save Settings]   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Custom Domains Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Custom Domains                                                [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ CONNECTED DOMAINS                                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🌐 myapp.com                                                    │ │
│ │    ✓ DNS Configured  ✓ SSL Active                               │ │
│ │    Primary domain                                    [Remove]   │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 🌐 www.myapp.com                                                │ │
│ │    ✓ DNS Configured  ✓ SSL Active                               │ │
│ │    Redirects to myapp.com                            [Remove]   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [+ Add Custom Domain]                                              │
│                                                                     │
│ DEFAULT DOMAIN                                                      │
│ https://myapp.netlify.app                              [Copy]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Add Domain Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Add Custom Domain                                             [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Domain:                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ app.example.com                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ DNS CONFIGURATION REQUIRED                                         │
│                                                                     │
│ Add these records to your DNS provider:                            │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Type    Name    Value                                    [Copy] │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ CNAME   app     myapp.netlify.app                        [Copy] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ⚠️ DNS changes can take up to 48 hours to propagate               │
│                                                                     │
│ Status: ⏳ Waiting for DNS verification...                         │
│                                                                     │
│                               [Cancel]  [Verify Domain]  [Done]   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Deploy Rules Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Deploy Rules                                                  [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ RULES                                                [+ Add Rule]  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ☑ Auto-deploy production                                        │ │
│ │   When: Push to main                                            │ │
│ │   Deploy to: Production                              [Edit 🗑]  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ☑ Preview branches                                              │ │
│ │   When: Push to feature/*                                       │ │
│ │   Deploy to: Preview                                 [Edit 🗑]  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ ☐ Scheduled deploy                                              │ │
│ │   When: Daily at 2:00 AM UTC                                    │ │
│ │   Deploy to: Production                              [Edit 🗑]  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ WEBHOOKS                                          [+ Add Webhook]  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Build hook URL:                                                 │ │
│ │ https://api.netlify.com/build_hooks/abc123          [Copy] [🔄] │ │
│ │ Trigger: POST request to this URL                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/EnvironmentConfigService.ts`
2. `packages/noodl-editor/src/editor/src/services/DomainService.ts`
3. `packages/noodl-editor/src/editor/src/services/DeployRulesService.ts`
4. `packages/noodl-core-ui/src/components/deploy/EnvironmentVariables/EnvironmentVariables.tsx`
5. `packages/noodl-core-ui/src/components/deploy/EnvironmentVariables/VariableRow.tsx`
6. `packages/noodl-core-ui/src/components/deploy/EnvironmentVariables/ProfileSelector.tsx`
7. `packages/noodl-core-ui/src/components/deploy/BuildSettings/BuildSettings.tsx`
8. `packages/noodl-core-ui/src/components/deploy/CustomDomains/CustomDomains.tsx`
9. `packages/noodl-core-ui/src/components/deploy/CustomDomains/AddDomainModal.tsx`
10. `packages/noodl-core-ui/src/components/deploy/DeployRules/DeployRules.tsx`
11. `packages/noodl-core-ui/src/components/deploy/DeployRules/RuleEditor.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/DeployPopup/DeployPopup.tsx`
   - Add settings tabs
   - Integrate new panels

2. `packages/noodl-editor/src/editor/src/utils/compilation/compilation.ts`
   - Use environment variables from config
   - Apply build settings

3. `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
   - Store deploy configuration
   - Load/save config

4. `packages/noodl-editor/src/editor/src/services/DeployService.ts`
   - Apply environment variables to deploy
   - Handle domain configuration

## Implementation Steps

### Phase 1: Environment Variables
1. Create EnvironmentConfigService
2. Implement variable storage
3. Implement encryption for sensitive values
4. Add import/export .env

### Phase 2: Environment Profiles
1. Add profile management
2. Implement profile switching
3. Add default profiles (dev/staging/prod)
4. UI for profile management

### Phase 3: UI - Variables Panel
1. Create EnvironmentVariables component
2. Create VariableRow component
3. Add add/edit/delete functionality
4. Add import/export buttons

### Phase 4: Build Settings
1. Create build settings storage
2. Create BuildSettings component
3. Integrate with compilation
4. Test with deployments

### Phase 5: Custom Domains
1. Create DomainService
2. Implement platform-specific domain APIs
3. Create CustomDomains component
4. Create AddDomainModal

### Phase 6: Deploy Rules
1. Create DeployRulesService
2. Implement rule evaluation
3. Create DeployRules component
4. Create RuleEditor

## Testing Checklist

- [ ] Variables saved correctly
- [ ] Sensitive values encrypted
- [ ] Variables applied to deploy
- [ ] Import .env works
- [ ] Export .env works
- [ ] Profile switching works
- [ ] Build settings applied
- [ ] Custom domain setup works
- [ ] DNS verification works
- [ ] Deploy rules trigger correctly
- [ ] Webhooks work
- [ ] Platform sync works

## Dependencies

- DEPLOY-001 (One-Click Deploy) - for platform integration

## Blocked By

- DEPLOY-001

## Blocks

- None (final DEPLOY task)

## Estimated Effort

- Environment config service: 4-5 hours
- Variable storage/encryption: 3-4 hours
- Environment profiles: 3-4 hours
- UI variables panel: 4-5 hours
- Build settings: 3-4 hours
- Custom domains: 4-5 hours
- Deploy rules: 4-5 hours
- Testing & polish: 3-4 hours
- **Total: 28-36 hours**

## Success Criteria

1. Environment variables persist across deploys
2. Sensitive values properly secured
3. Multiple profiles supported
4. Import/export .env works
5. Custom domains configurable
6. Deploy rules automate deployments
7. Settings sync with platforms

## Security Considerations

- Sensitive values encrypted at rest
- Never log sensitive values
- Use platform-native secret storage where available
- Clear memory after use
- Validate input to prevent injection

## Future Enhancements

- Environment variable inheritance
- Secret rotation reminders
- Integration with secret managers (Vault, AWS Secrets)
- A/B testing configuration
- Feature flags integration
- Monitoring/alerting integration
