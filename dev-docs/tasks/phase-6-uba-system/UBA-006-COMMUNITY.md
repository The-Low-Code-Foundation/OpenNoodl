# Phase 6F: UBA Community

## CLI Tools, Schema Gallery, and Community Resources

**Phase:** 6F of 6  
**Duration:** 2 weeks (10 working days)  
**Priority:** MEDIUM  
**Status:** NOT STARTED  
**Depends On:** Phase 6D, 6E complete

---

## Overview

Phase 6F focuses on community enablement: tools that help backend developers create and validate UBA schemas, a gallery for discovering community backends, and resources that foster ecosystem growth.

This phase is about making UBA accessible and encouraging adoption beyond Visual Hive's own needs.

### Community Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Developer creates       Schema validated      Community uses   │
│   a cool backend    ───►  and published   ───►  backend easily  │
│                                                                  │
│   ┌──────────────┐       ┌──────────────┐      ┌──────────────┐ │
│   │ Python/Go/   │       │ npx nodegx   │      │ Browse in    │ │
│   │ Node backend │  ───► │ validate     │ ───► │ Nodegx       │ │
│   │ + schema.yaml│       │ publish      │      │ gallery      │ │
│   └──────────────┘       └──────────────┘      └──────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Goals

1. **Schema validation CLI** - Help developers validate schemas before deploying
2. **Schema gallery** - Browse and discover community backends (future)
3. **Submission process** - How to contribute backends to the gallery
4. **Community resources** - Templates, examples, Discord/forum

---

## Prerequisites

- Phase 6D complete ✅ (documentation exists)
- Phase 6E complete ✅ (reference implementation exists)

---

## Task Breakdown

### UBA-029: Schema Validation CLI
**Effort:** 2 days  
**Assignee:** TBD  
**Branch:** `feature/uba-029-validation-cli`

#### Description

Create a CLI tool that validates UBA schemas, tests backend endpoints, and provides helpful feedback for developers.

#### Features

1. **Validate schema file** - Check YAML syntax and schema compliance
2. **Test live backend** - Fetch schema, test endpoints
3. **Generate types** - Output TypeScript types from schema
4. **Init command** - Create starter schema file

#### Usage

```bash
# Install globally
npm install -g @nodegx/uba-cli

# Or use npx
npx @nodegx/uba-cli validate ./schema.yaml

# Commands
nodegx-uba validate <file>           # Validate a local schema file
nodegx-uba test <url>                # Test a live backend
nodegx-uba init                      # Create a starter schema
nodegx-uba types <file> -o types.ts  # Generate TypeScript types
```

#### Files to Create

```
packages/nodegx-uba-cli/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts           # CLI entry point
│   ├── commands/
│   │   ├── validate.ts
│   │   ├── test.ts
│   │   ├── init.ts
│   │   └── types.ts
│   ├── validator/
│   │   ├── schema.ts
│   │   └── endpoints.ts
│   ├── generator/
│   │   └── typescript.ts
│   └── templates/
│       └── starter-schema.yaml
└── tests/
    └── ...
```

#### Implementation

```typescript
// src/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { validateCommand } from './commands/validate';
import { testCommand } from './commands/test';
import { initCommand } from './commands/init';
import { typesCommand } from './commands/types';
import { version } from '../package.json';

const program = new Command();

program
  .name('nodegx-uba')
  .description('Nodegx Universal Backend Adapter CLI')
  .version(version);

program
  .command('validate <file>')
  .description('Validate a UBA schema file')
  .option('-s, --strict', 'Enable strict validation')
  .option('-q, --quiet', 'Only output errors')
  .action(validateCommand);

program
  .command('test <url>')
  .description('Test a live UBA backend')
  .option('-t, --token <token>', 'Auth token')
  .option('--skip-config', 'Skip config endpoint test')
  .option('--skip-health', 'Skip health endpoint test')
  .action(testCommand);

program
  .command('init')
  .description('Create a starter schema file')
  .option('-o, --output <file>', 'Output file', 'nodegx-schema.yaml')
  .option('--advanced', 'Include all optional fields')
  .action(initCommand);

program
  .command('types <file>')
  .description('Generate TypeScript types from schema')
  .option('-o, --output <file>', 'Output file', 'uba-types.ts')
  .action(typesCommand);

program.parse();


// src/commands/validate.ts
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import chalk from 'chalk';
import { schemaV1 } from '../validator/schema';

interface ValidateOptions {
  strict?: boolean;
  quiet?: boolean;
}

export async function validateCommand(file: string, options: ValidateOptions) {
  console.log(chalk.blue(`\nValidating ${file}...\n`));
  
  // Check file exists
  if (!fs.existsSync(file)) {
    console.error(chalk.red(`Error: File not found: ${file}`));
    process.exit(1);
  }
  
  // Read and parse YAML
  let schema: any;
  try {
    const content = fs.readFileSync(file, 'utf-8');
    schema = yaml.load(content);
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      console.error(chalk.red(`YAML Parse Error (line ${error.mark?.line}):`));
      console.error(chalk.red(`  ${error.message}`));
      process.exit(1);
    }
    throw error;
  }
  
  // Validate against JSON Schema
  const ajv = new Ajv({ allErrors: true, verbose: true });
  const validate = ajv.compile(schemaV1);
  const valid = validate(schema);
  
  if (!valid) {
    console.error(chalk.red('Schema Validation Failed:\n'));
    
    for (const error of validate.errors || []) {
      const path = error.instancePath || '/';
      const message = formatError(error);
      console.error(chalk.red(`  ✗ ${path}: ${message}`));
    }
    
    console.error(chalk.red(`\n${validate.errors?.length} error(s) found.`));
    process.exit(1);
  }
  
  // Additional validations
  const warnings = runAdditionalValidations(schema, options.strict);
  
  if (warnings.length > 0 && !options.quiet) {
    console.log(chalk.yellow('Warnings:\n'));
    for (const warning of warnings) {
      console.log(chalk.yellow(`  ⚠ ${warning}`));
    }
    console.log();
  }
  
  // Success
  console.log(chalk.green('✓ Schema is valid!\n'));
  
  // Print summary
  if (!options.quiet) {
    printSchemaSummary(schema);
  }
}

function formatError(error: any): string {
  switch (error.keyword) {
    case 'required':
      return `Missing required field: ${error.params.missingProperty}`;
    case 'enum':
      return `Invalid value. Expected one of: ${error.params.allowedValues.join(', ')}`;
    case 'type':
      return `Expected ${error.params.type}`;
    case 'additionalProperties':
      return `Unknown field: ${error.params.additionalProperty}`;
    default:
      return error.message || 'Validation error';
  }
}

function runAdditionalValidations(schema: any, strict?: boolean): string[] {
  const warnings: string[] = [];
  
  // Check for missing optional but recommended fields
  if (!schema.backend.description) {
    warnings.push('backend.description is recommended');
  }
  
  if (!schema.backend.homepage) {
    warnings.push('backend.homepage is recommended for documentation');
  }
  
  // Check for empty sections
  for (const section of schema.sections) {
    if (section.fields.length === 0) {
      warnings.push(`Section "${section.id}" has no fields`);
    }
  }
  
  // Check for duplicate IDs
  const sectionIds = new Set<string>();
  for (const section of schema.sections) {
    if (sectionIds.has(section.id)) {
      warnings.push(`Duplicate section ID: ${section.id}`);
    }
    sectionIds.add(section.id);
    
    const fieldIds = new Set<string>();
    for (const field of section.fields) {
      if (fieldIds.has(field.id)) {
        warnings.push(`Duplicate field ID in ${section.id}: ${field.id}`);
      }
      fieldIds.add(field.id);
    }
  }
  
  // Strict mode checks
  if (strict) {
    if (!schema.backend.endpoints.health) {
      warnings.push('[strict] Health endpoint is recommended');
    }
    
    // Check for fields without descriptions
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (!field.description) {
          warnings.push(`[strict] Field "${section.id}.${field.id}" has no description`);
        }
      }
    }
  }
  
  return warnings;
}

function printSchemaSummary(schema: any) {
  console.log(chalk.bold('Schema Summary:'));
  console.log(`  Name: ${schema.backend.name}`);
  console.log(`  Version: ${schema.backend.version}`);
  console.log(`  Sections: ${schema.sections.length}`);
  
  let totalFields = 0;
  for (const section of schema.sections) {
    totalFields += section.fields.length;
  }
  console.log(`  Total Fields: ${totalFields}`);
  
  console.log(`  Debug: ${schema.debug?.enabled ? 'Enabled' : 'Disabled'}`);
  console.log();
}


// src/commands/test.ts
import chalk from 'chalk';
import ora from 'ora';

interface TestOptions {
  token?: string;
  skipConfig?: boolean;
  skipHealth?: boolean;
}

export async function testCommand(url: string, options: TestOptions) {
  console.log(chalk.blue(`\nTesting backend at ${url}\n`));
  
  const results: TestResult[] = [];
  
  // Test schema endpoint
  const schemaSpinner = ora('Fetching schema...').start();
  try {
    const schemaUrl = new URL('/.well-known/nodegx-schema.yaml', url);
    const response = await fetch(schemaUrl.toString());
    
    if (!response.ok) {
      schemaSpinner.fail(`Schema endpoint returned ${response.status}`);
      results.push({ name: 'Schema', passed: false, error: `HTTP ${response.status}` });
    } else {
      const content = await response.text();
      const schema = yaml.load(content);
      schemaSpinner.succeed(`Schema fetched: ${schema.backend.name} v${schema.backend.version}`);
      results.push({ name: 'Schema', passed: true });
      
      // Store schema for other tests
      globalSchema = schema;
    }
  } catch (error) {
    schemaSpinner.fail(`Schema fetch failed: ${error.message}`);
    results.push({ name: 'Schema', passed: false, error: error.message });
  }
  
  // Test health endpoint
  if (!options.skipHealth && globalSchema?.backend.endpoints.health) {
    const healthSpinner = ora('Checking health...').start();
    try {
      const healthUrl = new URL(globalSchema.backend.endpoints.health, url);
      const response = await fetch(healthUrl.toString(), {
        headers: buildHeaders(options.token)
      });
      
      if (!response.ok) {
        healthSpinner.fail(`Health endpoint returned ${response.status}`);
        results.push({ name: 'Health', passed: false, error: `HTTP ${response.status}` });
      } else {
        const data = await response.json();
        healthSpinner.succeed(`Health: ${data.status}`);
        results.push({ name: 'Health', passed: data.status === 'healthy' });
      }
    } catch (error) {
      healthSpinner.fail(`Health check failed: ${error.message}`);
      results.push({ name: 'Health', passed: false, error: error.message });
    }
  }
  
  // Test config endpoint (with empty config)
  if (!options.skipConfig && globalSchema?.backend.endpoints.config) {
    const configSpinner = ora('Testing config endpoint...').start();
    try {
      const configUrl = new URL(globalSchema.backend.endpoints.config, url);
      const response = await fetch(configUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildHeaders(options.token)
        },
        body: JSON.stringify({
          config: {},
          metadata: {
            project_id: 'test',
            project_name: 'CLI Test',
            environment: 'test',
            nodegx_version: '1.0.0'
          }
        })
      });
      
      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        // Expected - empty config should fail validation
        configSpinner.succeed('Config endpoint responding (validation works)');
        results.push({ name: 'Config', passed: true });
      } else if (data.success) {
        configSpinner.warn('Config endpoint accepted empty config (no validation?)');
        results.push({ name: 'Config', passed: true, warning: 'No validation' });
      }
    } catch (error) {
      configSpinner.fail(`Config test failed: ${error.message}`);
      results.push({ name: 'Config', passed: false, error: error.message });
    }
  }
  
  // Print summary
  console.log(chalk.bold('\nTest Summary:'));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  for (const result of results) {
    if (result.passed) {
      console.log(chalk.green(`  ✓ ${result.name}`));
    } else {
      console.log(chalk.red(`  ✗ ${result.name}: ${result.error}`));
    }
  }
  
  console.log();
  console.log(`${passed} passed, ${failed} failed`);
  
  process.exit(failed > 0 ? 1 : 0);
}


// src/commands/init.ts
import * as fs from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface InitOptions {
  output: string;
  advanced?: boolean;
}

export async function initCommand(options: InitOptions) {
  console.log(chalk.blue('\nCreate a new UBA schema\n'));
  
  // Interactive prompts
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Backend ID (lowercase, no spaces):',
      default: 'my-backend',
      validate: (input) => /^[a-z][a-z0-9-]*$/.test(input) || 'Use lowercase letters, numbers, and hyphens'
    },
    {
      type: 'input',
      name: 'name',
      message: 'Backend name (display name):',
      default: 'My Backend'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'A UBA-compatible backend'
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version:',
      default: '1.0.0'
    },
    {
      type: 'confirm',
      name: 'debug',
      message: 'Enable debug streaming?',
      default: false
    }
  ]);
  
  // Generate schema
  const schema = generateSchema(answers, options.advanced);
  
  // Write file
  fs.writeFileSync(options.output, schema);
  
  console.log(chalk.green(`\n✓ Created ${options.output}`));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray('  1. Edit the schema to add your fields'));
  console.log(chalk.gray('  2. Run: nodegx-uba validate ' + options.output));
  console.log(chalk.gray('  3. Serve the schema at /.well-known/nodegx-schema.yaml'));
}

function generateSchema(answers: any, advanced?: boolean): string {
  const lines = [
    '# Nodegx UBA Schema',
    `# Generated by nodegx-uba CLI`,
    '',
    'schema_version: "1.0"',
    '',
    'backend:',
    `  id: "${answers.id}"`,
    `  name: "${answers.name}"`,
    `  description: "${answers.description}"`,
    `  version: "${answers.version}"`,
    '',
    '  endpoints:',
    '    config: "/nodegx/config"',
    '    health: "/health"',
  ];
  
  if (answers.debug) {
    lines.push('    debug_stream: "/nodegx/debug"');
    lines.push('');
    lines.push('  capabilities:');
    lines.push('    hot_reload: true');
    lines.push('    debug: true');
  }
  
  lines.push('');
  lines.push('sections:');
  lines.push('  - id: "settings"');
  lines.push('    name: "Settings"');
  lines.push('    description: "Configure your backend"');
  lines.push('    fields:');
  lines.push('      - id: "api_key"');
  lines.push('        type: "secret"');
  lines.push('        name: "API Key"');
  lines.push('        description: "Your API key"');
  lines.push('        required: true');
  lines.push('');
  lines.push('      - id: "enabled"');
  lines.push('        type: "boolean"');
  lines.push('        name: "Enabled"');
  lines.push('        default: true');
  
  if (answers.debug) {
    lines.push('');
    lines.push('debug:');
    lines.push('  enabled: true');
    lines.push('  event_types:');
    lines.push('    - id: "request"');
    lines.push('      name: "Request"');
    lines.push('      fields:');
    lines.push('        - id: "message"');
    lines.push('          type: "string"');
    lines.push('        - id: "duration_ms"');
    lines.push('          type: "number"');
    lines.push('          format: "duration"');
  }
  
  return lines.join('\n');
}


// src/commands/types.ts
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import chalk from 'chalk';

interface TypesOptions {
  output: string;
}

export async function typesCommand(file: string, options: TypesOptions) {
  console.log(chalk.blue(`\nGenerating TypeScript types from ${file}...\n`));
  
  const content = fs.readFileSync(file, 'utf-8');
  const schema = yaml.load(content);
  
  const types = generateTypes(schema);
  
  fs.writeFileSync(options.output, types);
  
  console.log(chalk.green(`✓ Generated ${options.output}`));
}

function generateTypes(schema: any): string {
  const lines = [
    '// Auto-generated by nodegx-uba CLI',
    '// Do not edit manually',
    '',
    `export interface ${pascalCase(schema.backend.id)}Config {`,
  ];
  
  for (const section of schema.sections) {
    lines.push(`  ${section.id}: {`);
    
    for (const field of section.fields) {
      const tsType = fieldTypeToTs(field.type);
      const optional = field.required ? '' : '?';
      lines.push(`    ${field.id}${optional}: ${tsType};`);
    }
    
    lines.push('  };');
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

function fieldTypeToTs(fieldType: string): string {
  switch (fieldType) {
    case 'string':
    case 'text':
    case 'secret':
    case 'url':
    case 'email':
    case 'prompt':
    case 'code':
    case 'color':
      return 'string';
    case 'number':
    case 'slider':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'select':
      return 'string';
    case 'multi_select':
      return 'string[]';
    case 'array':
      return 'any[]';
    case 'object':
    case 'field_mapping':
    case 'key_value':
      return 'Record<string, any>';
    case 'tool_toggle':
      return '{ enabled: boolean; [key: string]: any }';
    default:
      return 'any';
  }
}

function pascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
```

#### package.json

```json
{
  "name": "@nodegx/uba-cli",
  "version": "1.0.0",
  "description": "CLI tools for Nodegx Universal Backend Adapter",
  "main": "dist/index.js",
  "bin": {
    "nodegx-uba": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest"
  },
  "dependencies": {
    "ajv": "^8.12.0",
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "inquirer": "^9.2.0",
    "js-yaml": "^4.1.0",
    "ora": "^7.0.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

#### Acceptance Criteria

- [ ] `validate` command works
- [ ] `test` command works
- [ ] `init` command creates valid schema
- [ ] `types` command generates TypeScript
- [ ] Published to npm
- [ ] README documentation

---

### UBA-030: Schema Gallery (Future)
**Effort:** 5 days  
**Assignee:** TBD  
**Branch:** `feature/uba-030-schema-gallery`  
**Status:** FUTURE - Stretch goal

#### Description

Create a gallery for discovering and adding community backends directly from within Nodegx.

**Note:** This is a stretch goal for Phase 6F. If time permits, implement the basics. Otherwise, document the design for future implementation.

#### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Schema Gallery                                    [Submit Yours]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Search: [                    ]  Category: [All Categories ▼]   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Featured                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ 🧠 Erleah AI    │  │ 📊 Analytics    │  │ 🔔 Notifications│  │
│  │ Agent           │  │ Engine          │  │ Service         │  │
│  │                 │  │                 │  │                 │  │
│  │ AI assistant    │  │ Event tracking  │  │ Push notifs via │  │
│  │ for conferences │  │ and analytics   │  │ Firebase/APNS   │  │
│  │                 │  │                 │  │                 │  │
│  │ ⭐ 4.8 (234)    │  │ ⭐ 4.5 (189)    │  │ ⭐ 4.3 (156)    │  │
│  │ [Add Backend]   │  │ [Add Backend]   │  │ [Add Backend]   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  Community                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ 💬 Chat Service │  │ 📧 Email Sender │  │ 🗄️ File Storage │  │
│  │ ...             │  │ ...             │  │ ...             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Gallery Entry Format

```yaml
# gallery/erleah-ai-agent.yaml
id: "erleah-ai-agent"
name: "Erleah AI Agent"
description: "Agentic AI assistant for conference attendees"
author: "Visual Hive"
author_url: "https://visualhive.co"
version: "1.0.0"
category: "AI/ML"
tags: ["ai", "agent", "conference", "langraph"]
icon: "https://erleah.com/icon.png"
homepage: "https://docs.erleah.com"
repository: "https://github.com/visualhive/erleah"

# How to get the backend running
deployment:
  docker:
    image: "visualhive/erleah:latest"
    compose_url: "https://raw.githubusercontent.com/visualhive/erleah/main/docker-compose.yml"
  
  cloud:
    railway: "https://railway.app/template/erleah"
    render: "https://render.com/deploy?repo=visualhive/erleah"

# Schema URL (for validation)
schema_url: "https://raw.githubusercontent.com/visualhive/erleah/main/nodegx-schema.yaml"

# Stats (populated by registry)
stats:
  installs: 234
  rating: 4.8
  reviews: 42
```

#### API Endpoints (Registry Service)

```
GET  /api/gallery                    # List all backends
GET  /api/gallery/:id                # Get backend details
GET  /api/gallery/search?q=...       # Search backends
GET  /api/gallery/categories         # List categories
POST /api/gallery/submit             # Submit new backend
POST /api/gallery/:id/review         # Submit review
```

#### Submission Process

1. Developer creates GitHub issue using template
2. Automated validation runs:
   - Schema URL accessible
   - Schema validates
   - Health endpoint responds
   - Docker image builds
3. Manual review by maintainers
4. Added to gallery with "unverified" badge
5. After 10+ installs, eligible for "verified" badge

#### Files to Create (If Implementing)

```
packages/noodl-editor/src/editor/src/views/UBA/
├── Gallery/
│   ├── Gallery.tsx
│   ├── Gallery.module.scss
│   ├── GalleryCard.tsx
│   ├── GalleryDetail.tsx
│   └── SubmitDialog.tsx

# Registry service (separate repo)
nodegx-gallery-api/
├── src/
│   ├── routes/gallery.ts
│   ├── services/validation.ts
│   └── models/backend.ts
└── data/
    └── backends/
        ├── erleah-ai-agent.yaml
        └── ...
```

#### Minimum Viable Gallery

If implementing in Phase 6F, focus on:

1. **Static gallery** - Hardcoded list of 3-5 backends
2. **Add from gallery** - Click to add backend URL
3. **Basic search** - Client-side filtering
4. **Submit link** - Opens GitHub issue template

Save for future:
- Full registry service
- Reviews and ratings
- Docker deployment integration
- Verification system

#### Acceptance Criteria (MVP)

- [ ] Gallery shows hardcoded backends
- [ ] Click adds backend to project
- [ ] Basic search/filter works
- [ ] Submit link works
- [ ] Design documented for future

---

## Community Resources

### GitHub Repository Structure

```
nodegx/
├── packages/
│   ├── noodl-editor/           # Main editor
│   ├── nodegx-uba-cli/         # CLI tool
│   └── ...
├── docs/
│   └── uba/                    # UBA documentation
├── examples/
│   └── uba-backends/           # Example backend implementations
│       ├── python-fastapi/
│       ├── node-express/
│       └── go-fiber/
└── gallery/                    # Gallery entries (for MVP)
    ├── erleah-ai-agent.yaml
    └── ...
```

### Example Backend Templates

Create starter templates for common frameworks:

#### Python/FastAPI

```python
# examples/uba-backends/python-fastapi/main.py
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any

app = FastAPI()

# Serve schema
@app.get("/.well-known/nodegx-schema.yaml")
async def get_schema():
    return FileResponse("nodegx-schema.yaml", media_type="application/x-yaml")

# Config endpoint
class ConfigRequest(BaseModel):
    config: Dict[str, Any]
    metadata: Dict[str, Any]

@app.post("/nodegx/config")
async def apply_config(request: ConfigRequest):
    # TODO: Apply configuration
    return {
        "success": True,
        "applied_at": datetime.utcnow().isoformat() + "Z"
    }

# Health endpoint
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}
```

#### Node.js/Express

```javascript
// examples/uba-backends/node-express/index.js
const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());

// Serve schema
app.get('/.well-known/nodegx-schema.yaml', (req, res) => {
  res.type('application/x-yaml');
  res.sendFile(__dirname + '/nodegx-schema.yaml');
});

// Config endpoint
app.post('/nodegx/config', (req, res) => {
  const { config, metadata } = req.body;
  // TODO: Apply configuration
  res.json({
    success: true,
    applied_at: new Date().toISOString()
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: '1.0.0' });
});

app.listen(8000);
```

---

## Phase 6F Checklist

### UBA-029: Validation CLI
- [ ] `validate` command
- [ ] `test` command
- [ ] `init` command
- [ ] `types` command
- [ ] npm package published
- [ ] README documentation

### UBA-030: Schema Gallery (Stretch)
- [ ] Gallery UI (MVP)
- [ ] Hardcoded backend list
- [ ] Add from gallery
- [ ] Submit link
- [ ] Future design documented

### Community Resources
- [ ] Example templates created
- [ ] Contributing guide
- [ ] Issue templates
- [ ] Discord/forum setup

---

## Success Criteria

- [ ] CLI tool usable by community
- [ ] At least 3 example backends
- [ ] Documentation enables self-service
- [ ] Gallery concept validated (if implemented)

---

## Future Roadmap (Post Phase 6)

### Phase 7: Docker Integration

Connect UBA with Docker for one-click backend deployment:

```
User selects backend in gallery
        ↓
Nodegx pulls Docker image
        ↓
Spins up containers
        ↓
Backend auto-configured
        ↓
User starts building
```

### Phase 8: Backend Marketplace

- Verified publisher program
- Paid backends
- Usage analytics
- Revenue sharing

### Phase 9: UBA SDK

- Official SDKs for Python, Node.js, Go
- Middleware for debug instrumentation
- Testing utilities

---

## Notes

- CLI tool is highest priority in this phase
- Gallery can start as simple static list
- Community building is ongoing effort
- Success depends on documentation quality
