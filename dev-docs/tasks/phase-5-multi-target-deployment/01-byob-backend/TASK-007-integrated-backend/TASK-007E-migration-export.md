# TASK-007E: Migration & Export Tools

## Overview

Implement tools for migrating data between backends and exporting schemas/data for production deployment. This includes a Parse-to-Local migration wizard and schema export for various production databases.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** E (Migration & Export)
**Effort:** 8-10 hours
**Priority:** MEDIUM
**Depends On:** TASK-007A, TASK-007B, TASK-007D

---

## Objectives

1. Create schema export wizard (PostgreSQL, Supabase, PocketBase, JSON)
2. Build Parse Server migration wizard for existing Noodl users
3. Implement data export in multiple formats
4. Create connection switcher for moving to external backends
5. Document migration paths clearly

---

## User Stories

### Story 1: Export to Production Database
> As a developer ready to deploy, I want to export my local schema to PostgreSQL so I can set up my production database.

### Story 2: Migrate from Noodl Cloud
> As an existing Noodl user, I want to migrate my Parse-based project to the new local backend so I can continue development offline.

### Story 3: Move to Supabase
> As a developer scaling up, I want to switch from local backend to Supabase while keeping my data and schema intact.

---

## Implementation Steps

### Step 1: Export Wizard Component (3 hours)

**File:** `packages/noodl-editor/src/editor/src/views/BackendPanel/ExportWizard.tsx`

```tsx
import React, { useState } from 'react';
import { Dialog } from '@noodl-core-ui/components/layout/Dialog';
import { RadioGroup, Radio } from '@noodl-core-ui/components/inputs/RadioGroup';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { SecondaryButton } from '@noodl-core-ui/components/inputs/SecondaryButton';
import { CodeEditor } from '@noodl-core-ui/components/inputs/CodeEditor';
import { IconCopy, IconDownload } from '@noodl-core-ui/components/common/Icon';
import styles from './ExportWizard.module.scss';

type ExportFormat = 'postgres' | 'supabase' | 'pocketbase' | 'json';
type ExportStep = 'options' | 'generating' | 'result';

interface Props {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

export function ExportWizard({ backendId, backendName, onClose }: Props) {
  const [step, setStep] = useState<ExportStep>('options');
  const [format, setFormat] = useState<ExportFormat>('postgres');
  const [includeData, setIncludeData] = useState(false);
  const [includeSampleData, setIncludeSampleData] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const formatOptions = [
    {
      value: 'postgres',
      label: 'PostgreSQL',
      description: 'Standard PostgreSQL DDL statements'
    },
    {
      value: 'supabase',
      label: 'Supabase',
      description: 'PostgreSQL with Row Level Security policies'
    },
    {
      value: 'pocketbase',
      label: 'PocketBase',
      description: 'PocketBase collection schema JSON'
    },
    {
      value: 'json',
      label: 'JSON Schema',
      description: 'Portable JSON schema definition'
    }
  ];

  const handleExport = async () => {
    setStep('generating');
    setError(null);

    try {
      // Get schema
      let schemaResult = await window.electronAPI.backend.exportSchema(
        backendId,
        format
      );

      // Get data if requested
      if (includeData || includeSampleData) {
        const dataFormat = format === 'json' ? 'json' : 'sql';
        const dataResult = await window.electronAPI.backend.exportData(
          backendId,
          dataFormat
        );

        if (includeSampleData && !includeData) {
          // Limit to first 10 records per table
          schemaResult += '\n\n-- SAMPLE DATA (first 10 records per table)\n';
          schemaResult += limitDataToSample(dataResult, 10);
        } else {
          schemaResult += '\n\n-- DATA\n';
          schemaResult += dataResult;
        }
      }

      // Add format-specific headers/comments
      const finalResult = addFormatHeader(schemaResult, format, backendName);

      setResult(finalResult);
      setStep('result');
    } catch (e: any) {
      setError(e.message || 'Export failed');
      setStep('options');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    // Show toast notification
  };

  const handleDownload = () => {
    const extension = format === 'json' || format === 'pocketbase' ? 'json' : 'sql';
    const filename = `${backendName.toLowerCase().replace(/\s+/g, '-')}-schema.${extension}`;
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      title="Export Schema"
      onClose={onClose}
      width={600}
    >
      {step === 'options' && (
        <div className={styles.content}>
          <p className={styles.description}>
            Export your database schema to use with a production database.
            The exported schema can be used to create tables in your target database.
          </p>

          <div className={styles.section}>
            <h4>Export Format</h4>
            <RadioGroup value={format} onChange={(v) => setFormat(v as ExportFormat)}>
              {formatOptions.map(opt => (
                <Radio key={opt.value} value={opt.value}>
                  <div className={styles.radioContent}>
                    <span className={styles.radioLabel}>{opt.label}</span>
                    <span className={styles.radioDesc}>{opt.description}</span>
                  </div>
                </Radio>
              ))}
            </RadioGroup>
          </div>

          <div className={styles.section}>
            <h4>Data Options</h4>
            <Checkbox
              checked={includeData}
              onChange={setIncludeData}
              label="Include all data"
            />
            <p className={styles.hint}>
              Export all records from all tables. Use for full backup or migration.
            </p>
            
            <Checkbox
              checked={includeSampleData}
              onChange={setIncludeSampleData}
              disabled={includeData}
              label="Include sample data (10 records per table)"
            />
            <p className={styles.hint}>
              Export a few records for testing your production setup.
            </p>
          </div>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          <div className={styles.actions}>
            <SecondaryButton label="Cancel" onClick={onClose} />
            <PrimaryButton label="Generate Export" onClick={handleExport} />
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className={styles.generating}>
          <div className={styles.spinner} />
          <p>Generating export...</p>
        </div>
      )}

      {step === 'result' && (
        <div className={styles.content}>
          <div className={styles.resultHeader}>
            <h4>Export Complete</h4>
            <div className={styles.resultActions}>
              <SecondaryButton
                label="Copy"
                icon={IconCopy}
                onClick={handleCopy}
              />
              <PrimaryButton
                label="Download"
                icon={IconDownload}
                onClick={handleDownload}
              />
            </div>
          </div>

          <div className={styles.codeContainer}>
            <CodeEditor
              value={result}
              language={format === 'json' || format === 'pocketbase' ? 'json' : 'sql'}
              readOnly
              height={400}
            />
          </div>

          <div className={styles.nextSteps}>
            <h4>Next Steps</h4>
            {format === 'postgres' && (
              <ol>
                <li>Create a PostgreSQL database on your hosting provider</li>
                <li>Run this SQL in your database to create the tables</li>
                <li>Update your project to use the external database connection</li>
              </ol>
            )}
            {format === 'supabase' && (
              <ol>
                <li>Go to your Supabase project's SQL Editor</li>
                <li>Paste and run this SQL to create tables with RLS</li>
                <li>Configure authentication policies as needed</li>
                <li>Update your project to use Supabase as the backend</li>
              </ol>
            )}
            {format === 'pocketbase' && (
              <ol>
                <li>Open PocketBase Admin UI</li>
                <li>Import collections from the JSON file</li>
                <li>Configure API rules as needed</li>
                <li>Update your project to use PocketBase as the backend</li>
              </ol>
            )}
            {format === 'json' && (
              <ol>
                <li>Use this schema definition with any compatible database</li>
                <li>Convert to your target database's DDL format</li>
                <li>Create tables and configure your backend</li>
              </ol>
            )}
          </div>

          <div className={styles.actions}>
            <SecondaryButton label="Export Another" onClick={() => setStep('options')} />
            <PrimaryButton label="Done" onClick={onClose} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function addFormatHeader(content: string, format: ExportFormat, backendName: string): string {
  const timestamp = new Date().toISOString();
  
  if (format === 'json' || format === 'pocketbase') {
    // For JSON formats, wrap in metadata
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify({
        _meta: {
          exportedFrom: 'Nodegex Local Backend',
          backendName,
          exportedAt: timestamp,
          format
        },
        ...parsed
      }, null, 2);
    } catch {
      return content;
    }
  }

  // For SQL formats
  return `-- ============================================
-- Nodegex Schema Export
-- Backend: ${backendName}
-- Format: ${format.toUpperCase()}
-- Exported: ${timestamp}
-- ============================================

${content}`;
}

function limitDataToSample(data: string, limit: number): string {
  // For SQL inserts, keep only first N per table
  const lines = data.split('\n');
  const counts: Record<string, number> = {};
  
  return lines.filter(line => {
    const match = line.match(/^INSERT INTO "(\w+)"/);
    if (!match) return true;
    
    const table = match[1];
    counts[table] = (counts[table] || 0) + 1;
    return counts[table] <= limit;
  }).join('\n');
}
```

---

### Step 2: Parse Migration Wizard (3 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Migration/ParseMigrationWizard.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Dialog } from '@noodl-core-ui/components/layout/Dialog';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { SecondaryButton } from '@noodl-core-ui/components/inputs/SecondaryButton';
import { ProgressBar } from '@noodl-core-ui/components/feedback/ProgressBar';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import styles from './ParseMigrationWizard.module.scss';

type MigrationStep = 'connect' | 'review' | 'migrate' | 'complete' | 'error';

interface ParseConfig {
  endpoint: string;
  appId: string;
  masterKey?: string;
}

interface TablePreview {
  className: string;
  recordCount: number;
  fields: string[];
  selected: boolean;
}

interface Props {
  projectId: string;
  existingParseConfig?: ParseConfig;
  onComplete: (newBackendId: string) => void;
  onCancel: () => void;
}

export function ParseMigrationWizard({ 
  projectId, 
  existingParseConfig, 
  onComplete, 
  onCancel 
}: Props) {
  const [step, setStep] = useState<MigrationStep>('connect');
  const [parseConfig, setParseConfig] = useState<ParseConfig>(
    existingParseConfig || { endpoint: '', appId: '', masterKey: '' }
  );
  const [tables, setTables] = useState<TablePreview[]>([]);
  const [migrateData, setMigrateData] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newBackendId, setNewBackendId] = useState<string | null>(null);

  // Step 1: Connect and fetch schema
  const handleConnect = async () => {
    setError(null);
    
    try {
      // Validate connection
      const schemaResponse = await fetch(`${parseConfig.endpoint}/schemas`, {
        headers: {
          'X-Parse-Application-Id': parseConfig.appId,
          'X-Parse-Master-Key': parseConfig.masterKey || '',
        }
      });

      if (!schemaResponse.ok) {
        throw new Error('Failed to connect to Parse Server. Check your credentials.');
      }

      const schemaData = await schemaResponse.json();
      
      // Get record counts for each class
      const tablesPreviews: TablePreview[] = [];
      
      for (const cls of schemaData.results || []) {
        // Skip internal Parse classes
        if (cls.className.startsWith('_') && cls.className !== '_User') {
          continue;
        }

        const countResponse = await fetch(
          `${parseConfig.endpoint}/classes/${cls.className}?count=1&limit=0`,
          {
            headers: {
              'X-Parse-Application-Id': parseConfig.appId,
              'X-Parse-Master-Key': parseConfig.masterKey || '',
            }
          }
        );
        
        const countData = await countResponse.json();
        
        tablesPreviews.push({
          className: cls.className,
          recordCount: countData.count || 0,
          fields: Object.keys(cls.fields || {}).filter(
            f => !['objectId', 'createdAt', 'updatedAt', 'ACL'].includes(f)
          ),
          selected: true
        });
      }

      setTables(tablesPreviews);
      setStep('review');
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Step 2: Start migration
  const handleStartMigration = async () => {
    setStep('migrate');
    setProgress(0);
    setError(null);

    try {
      // Create new local backend
      setProgressMessage('Creating local backend...');
      const backend = await window.electronAPI.backend.create(
        `Migrated from ${parseConfig.appId}`
      );
      setNewBackendId(backend.id);
      setProgress(5);

      // Start the backend
      setProgressMessage('Starting backend...');
      await window.electronAPI.backend.start(backend.id);
      setProgress(10);

      // Get selected tables
      const selectedTables = tables.filter(t => t.selected);
      const totalTables = selectedTables.length;
      
      // Fetch and migrate schema
      setProgressMessage('Fetching schema...');
      const schemaResponse = await fetch(`${parseConfig.endpoint}/schemas`, {
        headers: {
          'X-Parse-Application-Id': parseConfig.appId,
          'X-Parse-Master-Key': parseConfig.masterKey || '',
        }
      });
      const schemaData = await schemaResponse.json();
      
      const selectedSchema = schemaData.results.filter((cls: any) =>
        selectedTables.some(t => t.className === cls.className)
      );

      setProgressMessage('Creating tables...');
      await window.electronAPI.invoke('backend:import-parse-schema', {
        backendId: backend.id,
        schema: selectedSchema
      });
      setProgress(20);

      // Migrate data if requested
      if (migrateData) {
        let completedTables = 0;
        let totalRecordsMigrated = 0;

        for (const table of selectedTables) {
          setProgressMessage(`Migrating ${table.className}...`);
          
          // Fetch in batches
          let skip = 0;
          const batchSize = 100;
          
          while (skip < table.recordCount) {
            const response = await fetch(
              `${parseConfig.endpoint}/classes/${table.className}?limit=${batchSize}&skip=${skip}`,
              {
                headers: {
                  'X-Parse-Application-Id': parseConfig.appId,
                  'X-Parse-Master-Key': parseConfig.masterKey || '',
                }
              }
            );
            
            const data = await response.json();
            
            if (data.results?.length > 0) {
              await window.electronAPI.invoke('backend:import-records', {
                backendId: backend.id,
                collection: table.className,
                records: data.results
              });
              
              totalRecordsMigrated += data.results.length;
            }
            
            skip += batchSize;
            
            // Update progress
            const tableProgress = Math.min(skip, table.recordCount) / table.recordCount;
            const overallProgress = 20 + (
              (completedTables + tableProgress) / totalTables * 70
            );
            setProgress(Math.round(overallProgress));
          }
          
          completedTables++;
        }

        setProgressMessage(`Migrated ${totalRecordsMigrated} records`);
      }

      setProgress(100);
      setStep('complete');
    } catch (e: any) {
      setError(e.message);
      setStep('error');
    }
  };

  const toggleTableSelection = (className: string) => {
    setTables(tables.map(t =>
      t.className === className ? { ...t, selected: !t.selected } : t
    ));
  };

  const totalRecords = tables
    .filter(t => t.selected)
    .reduce((sum, t) => sum + t.recordCount, 0);

  return (
    <Dialog
      title="Migrate from Parse Server"
      onClose={onCancel}
      width={600}
    >
      {step === 'connect' && (
        <div className={styles.content}>
          <p className={styles.description}>
            Migrate your existing Parse Server data to a local backend.
            This will create a new local backend with all your data.
          </p>

          <div className={styles.form}>
            <div className={styles.field}>
              <label>Parse Server URL</label>
              <TextInput
                value={parseConfig.endpoint}
                onChange={(v) => setParseConfig({ ...parseConfig, endpoint: v })}
                placeholder="https://your-parse-server.com/parse"
              />
            </div>

            <div className={styles.field}>
              <label>Application ID</label>
              <TextInput
                value={parseConfig.appId}
                onChange={(v) => setParseConfig({ ...parseConfig, appId: v })}
                placeholder="your-app-id"
              />
            </div>

            <div className={styles.field}>
              <label>Master Key (optional, required for full export)</label>
              <TextInput
                value={parseConfig.masterKey || ''}
                onChange={(v) => setParseConfig({ ...parseConfig, masterKey: v })}
                placeholder="your-master-key"
                type="password"
              />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <SecondaryButton label="Cancel" onClick={onCancel} />
            <PrimaryButton 
              label="Connect & Scan" 
              onClick={handleConnect}
              disabled={!parseConfig.endpoint || !parseConfig.appId}
            />
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className={styles.content}>
          <p className={styles.description}>
            Select the tables you want to migrate. Uncheck any tables you want to skip.
          </p>

          <div className={styles.tableList}>
            {tables.map(table => (
              <div key={table.className} className={styles.tableRow}>
                <Checkbox
                  checked={table.selected}
                  onChange={() => toggleTableSelection(table.className)}
                />
                <div className={styles.tableInfo}>
                  <span className={styles.tableName}>{table.className}</span>
                  <span className={styles.tableCount}>
                    {table.recordCount.toLocaleString()} records
                  </span>
                </div>
                <div className={styles.tableFields}>
                  {table.fields.slice(0, 5).join(', ')}
                  {table.fields.length > 5 && ` +${table.fields.length - 5} more`}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.options}>
            <Checkbox
              checked={migrateData}
              onChange={setMigrateData}
              label="Migrate data (recommended)"
            />
            <p className={styles.hint}>
              If unchecked, only the schema will be migrated, tables will be empty.
            </p>
          </div>

          <div className={styles.summary}>
            <strong>Summary:</strong> {tables.filter(t => t.selected).length} tables, {' '}
            {migrateData ? `${totalRecords.toLocaleString()} records` : 'schema only'}
          </div>

          <div className={styles.actions}>
            <SecondaryButton label="Back" onClick={() => setStep('connect')} />
            <PrimaryButton 
              label="Start Migration" 
              onClick={handleStartMigration}
              disabled={tables.filter(t => t.selected).length === 0}
            />
          </div>
        </div>
      )}

      {step === 'migrate' && (
        <div className={styles.migrating}>
          <div className={styles.progressSection}>
            <ProgressBar value={progress} max={100} />
            <p className={styles.progressMessage}>{progressMessage}</p>
            <p className={styles.progressPercent}>{progress}%</p>
          </div>
          <p className={styles.warning}>
            Please don't close this window until migration is complete.
          </p>
        </div>
      )}

      {step === 'complete' && (
        <div className={styles.complete}>
          <div className={styles.successIcon}>✓</div>
          <h3>Migration Complete!</h3>
          <p>
            Your data has been successfully migrated to a new local backend.
            You can now use this backend with your project.
          </p>
          <div className={styles.actions}>
            <PrimaryButton 
              label="Use New Backend" 
              onClick={() => onComplete(newBackendId!)}
            />
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>⚠</div>
          <h3>Migration Failed</h3>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.actions}>
            <SecondaryButton label="Cancel" onClick={onCancel} />
            <PrimaryButton 
              label="Retry" 
              onClick={() => setStep('review')}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
```

---

### Step 3: Connection Switcher (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/BackendPanel/ConnectionSwitcher.tsx`

```tsx
import React, { useState } from 'react';
import { Dialog } from '@noodl-core-ui/components/layout/Dialog';
import { RadioGroup, Radio } from '@noodl-core-ui/components/inputs/RadioGroup';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { SecondaryButton } from '@noodl-core-ui/components/inputs/SecondaryButton';
import styles from './ConnectionSwitcher.module.scss';

type BackendType = 'local' | 'supabase' | 'pocketbase' | 'custom';

interface Props {
  projectId: string;
  currentBackend: {
    type: string;
    id?: string;
    endpoint?: string;
  };
  onSwitch: (config: any) => Promise<void>;
  onClose: () => void;
}

export function ConnectionSwitcher({ projectId, currentBackend, onSwitch, onClose }: Props) {
  const [backendType, setBackendType] = useState<BackendType>(
    currentBackend.type as BackendType || 'local'
  );
  const [config, setConfig] = useState({
    localBackendId: currentBackend.id || '',
    supabaseUrl: '',
    supabaseKey: '',
    pocketbaseUrl: '',
    customEndpoint: '',
    customApiKey: ''
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localBackends, setLocalBackends] = useState<any[]>([]);

  React.useEffect(() => {
    loadLocalBackends();
  }, []);

  const loadLocalBackends = async () => {
    try {
      const backends = await window.electronAPI.backend.list();
      setLocalBackends(backends);
    } catch (e) {
      console.error('Failed to load backends:', e);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      let testEndpoint = '';
      let testHeaders: Record<string, string> = {};

      switch (backendType) {
        case 'local':
          const backend = localBackends.find(b => b.id === config.localBackendId);
          if (!backend) throw new Error('Select a local backend');
          
          const status = await window.electronAPI.backend.status(backend.id);
          if (!status.running) {
            await window.electronAPI.backend.start(backend.id);
          }
          testEndpoint = `http://localhost:${status.port || backend.port}/health`;
          break;

        case 'supabase':
          testEndpoint = `${config.supabaseUrl}/rest/v1/`;
          testHeaders = {
            'apikey': config.supabaseKey,
            'Authorization': `Bearer ${config.supabaseKey}`
          };
          break;

        case 'pocketbase':
          testEndpoint = `${config.pocketbaseUrl}/api/health`;
          break;

        case 'custom':
          testEndpoint = config.customEndpoint;
          if (config.customApiKey) {
            testHeaders = { 'Authorization': `Bearer ${config.customApiKey}` };
          }
          break;
      }

      const response = await fetch(testEndpoint, { headers: testHeaders });
      
      if (response.ok) {
        setTestResult('success');
      } else {
        throw new Error(`Connection failed: ${response.status}`);
      }
    } catch (e: any) {
      setTestResult('error');
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSwitch = async () => {
    try {
      let newConfig: any;

      switch (backendType) {
        case 'local':
          newConfig = {
            type: 'local',
            id: config.localBackendId
          };
          break;

        case 'supabase':
          newConfig = {
            type: 'supabase',
            endpoint: config.supabaseUrl,
            apiKey: config.supabaseKey
          };
          break;

        case 'pocketbase':
          newConfig = {
            type: 'pocketbase',
            endpoint: config.pocketbaseUrl
          };
          break;

        case 'custom':
          newConfig = {
            type: 'custom',
            endpoint: config.customEndpoint,
            apiKey: config.customApiKey
          };
          break;
      }

      await onSwitch(newConfig);
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Dialog
      title="Switch Backend"
      onClose={onClose}
      width={500}
    >
      <div className={styles.content}>
        <p className={styles.description}>
          Switch your project to use a different backend. Your frontend code
          will continue to work with the new backend.
        </p>

        <div className={styles.section}>
          <h4>Backend Type</h4>
          <RadioGroup value={backendType} onChange={(v) => setBackendType(v as BackendType)}>
            <Radio value="local">
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Local Backend</span>
                <span className={styles.radioDesc}>SQLite database running locally</span>
              </div>
            </Radio>
            <Radio value="supabase">
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Supabase</span>
                <span className={styles.radioDesc}>PostgreSQL with realtime and auth</span>
              </div>
            </Radio>
            <Radio value="pocketbase">
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>PocketBase</span>
                <span className={styles.radioDesc}>Lightweight Go backend</span>
              </div>
            </Radio>
            <Radio value="custom">
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Custom REST API</span>
                <span className={styles.radioDesc}>Any REST-compatible backend</span>
              </div>
            </Radio>
          </RadioGroup>
        </div>

        <div className={styles.config}>
          {backendType === 'local' && (
            <div className={styles.field}>
              <label>Select Backend</label>
              <select
                value={config.localBackendId}
                onChange={(e) => setConfig({ ...config, localBackendId: e.target.value })}
                className={styles.select}
              >
                <option value="">Choose a backend...</option>
                {localBackends.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {backendType === 'supabase' && (
            <>
              <div className={styles.field}>
                <label>Supabase URL</label>
                <TextInput
                  value={config.supabaseUrl}
                  onChange={(v) => setConfig({ ...config, supabaseUrl: v })}
                  placeholder="https://your-project.supabase.co"
                />
              </div>
              <div className={styles.field}>
                <label>API Key (anon/public)</label>
                <TextInput
                  value={config.supabaseKey}
                  onChange={(v) => setConfig({ ...config, supabaseKey: v })}
                  placeholder="your-anon-key"
                  type="password"
                />
              </div>
            </>
          )}

          {backendType === 'pocketbase' && (
            <div className={styles.field}>
              <label>PocketBase URL</label>
              <TextInput
                value={config.pocketbaseUrl}
                onChange={(v) => setConfig({ ...config, pocketbaseUrl: v })}
                placeholder="http://127.0.0.1:8090"
              />
            </div>
          )}

          {backendType === 'custom' && (
            <>
              <div className={styles.field}>
                <label>API Endpoint</label>
                <TextInput
                  value={config.customEndpoint}
                  onChange={(v) => setConfig({ ...config, customEndpoint: v })}
                  placeholder="https://api.example.com"
                />
              </div>
              <div className={styles.field}>
                <label>API Key (optional)</label>
                <TextInput
                  value={config.customApiKey}
                  onChange={(v) => setConfig({ ...config, customApiKey: v })}
                  placeholder="your-api-key"
                  type="password"
                />
              </div>
            </>
          )}
        </div>

        {testResult === 'success' && (
          <div className={styles.success}>✓ Connection successful</div>
        )}

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <div className={styles.actions}>
          <SecondaryButton
            label={testing ? 'Testing...' : 'Test Connection'}
            onClick={handleTest}
            disabled={testing}
          />
          <div className={styles.spacer} />
          <SecondaryButton label="Cancel" onClick={onClose} />
          <PrimaryButton
            label="Switch Backend"
            onClick={handleSwitch}
            disabled={testResult !== 'success'}
          />
        </div>
      </div>
    </Dialog>
  );
}
```

---

### Step 4: Project Open Migration Prompt (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Migration/BackendMigrationPrompt.tsx`

```tsx
import React from 'react';
import { Dialog } from '@noodl-core-ui/components/layout/Dialog';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { SecondaryButton } from '@noodl-core-ui/components/inputs/SecondaryButton';
import styles from './BackendMigrationPrompt.module.scss';

interface Props {
  projectName: string;
  parseConfig: {
    endpoint: string;
    appId: string;
  };
  onContinueWithParse: () => void;
  onMigrateToLocal: () => void;
  onDismiss: () => void;
}

export function BackendMigrationPrompt({
  projectName,
  parseConfig,
  onContinueWithParse,
  onMigrateToLocal,
  onDismiss
}: Props) {
  return (
    <Dialog
      title="Backend Options"
      onClose={onDismiss}
      width={500}
    >
      <div className={styles.content}>
        <div className={styles.icon}>⚡</div>
        
        <h3>New Local Backend Available</h3>
        
        <p>
          <strong>{projectName}</strong> is currently using a Parse Server backend.
          You can now use a local backend for faster development and offline support.
        </p>

        <div className={styles.comparison}>
          <div className={styles.option}>
            <h4>🌐 Continue with Parse</h4>
            <ul>
              <li>Keep using {parseConfig.endpoint}</li>
              <li>No changes to your data</li>
              <li>Requires internet connection</li>
            </ul>
          </div>

          <div className={styles.option}>
            <h4>💻 Migrate to Local</h4>
            <ul>
              <li>Works offline</li>
              <li>Faster development</li>
              <li>Easy export to production</li>
              <li>Free (no cloud costs)</li>
            </ul>
          </div>
        </div>

        <div className={styles.actions}>
          <SecondaryButton
            label="Continue with Parse"
            onClick={onContinueWithParse}
          />
          <PrimaryButton
            label="Migrate to Local"
            onClick={onMigrateToLocal}
          />
        </div>

        <div className={styles.footer}>
          <button className={styles.link} onClick={onDismiss}>
            Don't show this again for this project
          </button>
        </div>
      </div>
    </Dialog>
  );
}
```

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/BackendPanel/
├── ExportWizard.tsx
├── ExportWizard.module.scss
├── ConnectionSwitcher.tsx
└── ConnectionSwitcher.module.scss

packages/noodl-editor/src/editor/src/views/Migration/
├── ParseMigrationWizard.tsx
├── ParseMigrationWizard.module.scss
├── BackendMigrationPrompt.tsx
└── BackendMigrationPrompt.module.scss
```

## Files to Modify

```
packages/noodl-editor/src/editor/src/models/projectmodel.ts
  - Add backend migration check on project open

packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/BackendCard.tsx
  - Add export button that opens ExportWizard
```

---

## Testing Checklist

### Export Wizard
- [ ] PostgreSQL export generates valid DDL
- [ ] Supabase export includes RLS policies
- [ ] PocketBase export creates valid JSON
- [ ] JSON schema is portable
- [ ] Data export works for all formats
- [ ] Sample data limiting works
- [ ] Copy to clipboard works
- [ ] Download works with correct filename

### Parse Migration
- [ ] Connection validation works
- [ ] Schema fetching succeeds
- [ ] Table selection works
- [ ] Progress tracking is accurate
- [ ] Data migration preserves all records
- [ ] Error handling shows useful messages
- [ ] Can retry after failure

### Connection Switcher
- [ ] Local backend selection works
- [ ] Supabase connection test works
- [ ] PocketBase connection test works
- [ ] Custom endpoint test works
- [ ] Backend switch persists in project

### Migration Prompt
- [ ] Shows for Parse-based projects
- [ ] "Don't show again" works
- [ ] Links to migration wizard
- [ ] Continue with Parse works

---

## Success Criteria

1. Users can export schema to any supported format
2. Parse migration preserves 100% of data
3. Connection switching is seamless
4. Clear guidance at each step
5. Error recovery is possible

---

## Dependencies

**Internal:**
- TASK-007A (LocalSQLAdapter - for schema/data export)
- TASK-007B (BackendManager - IPC handlers)
- TASK-007D (UI components)

**Blocks:**
- None (enables production deployment)

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | Export Wizard | 3 |
| 2 | Parse Migration Wizard | 3 |
| 3 | Connection Switcher + Prompt | 3 |
| **Total** | | **9** |
