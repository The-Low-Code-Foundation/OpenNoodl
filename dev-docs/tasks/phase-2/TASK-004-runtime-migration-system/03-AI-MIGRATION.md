# 03 - AI-Assisted Migration

## Overview

An optional AI-powered system that uses Claude to automatically migrate complex React code patterns that can't be fixed with simple find-and-replace. Includes budget controls, retry logic, and human-in-the-loop decision points.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Migration Wizard                          │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              AI Migration Controller                 │   │
│  │  • Budget management                                │   │
│  │  • Queue management                                 │   │
│  │  • Retry orchestration                              │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                    │
│           ┌─────────────┴─────────────┐                     │
│           ▼                           ▼                     │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │ Code Analyzer   │       │ Claude Client    │             │
│  │ (Babel AST)     │       │ (API Calls)      │             │
│  └─────────────────┘       └─────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## AI Configuration UI

### First-Time Setup

```tsx
// packages/noodl-editor/src/editor/src/views/migration/AIConfigPanel.tsx

interface AIConfigPanelProps {
  existingConfig?: AIConfig;
  onSave: (config: AIConfig) => void;
  onCancel: () => void;
}

interface AIConfig {
  apiKey: string;
  budget: {
    maxPerSession: number;
    pauseIncrement: number;
    showEstimates: boolean;
  };
  preferences: {
    preferFunctional: boolean;  // Prefer converting to functional components
    preserveComments: boolean;  // Keep existing code comments
    verboseOutput: boolean;     // Add explanatory comments
  };
}

function AIConfigPanel({ existingConfig, onSave, onCancel }: AIConfigPanelProps) {
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || '');
  const [maxBudget, setMaxBudget] = useState(existingConfig?.budget.maxPerSession || 5);
  const [pauseIncrement, setPauseIncrement] = useState(
    existingConfig?.budget.pauseIncrement || 5
  );
  const [showEstimates, setShowEstimates] = useState(
    existingConfig?.budget.showEstimates ?? true
  );
  const [preferFunctional, setPreferFunctional] = useState(
    existingConfig?.preferences.preferFunctional ?? true
  );
  
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const validateApiKey = async () => {
    setValidating(true);
    setValidationError(null);
    
    try {
      await testAnthropicKey(apiKey);
      return true;
    } catch (error) {
      setValidationError(error.message);
      return false;
    } finally {
      setValidating(false);
    }
  };
  
  const handleSave = async () => {
    if (await validateApiKey()) {
      onSave({
        apiKey,
        budget: {
          maxPerSession: maxBudget,
          pauseIncrement,
          showEstimates
        },
        preferences: {
          preferFunctional,
          preserveComments: true,
          verboseOutput: true
        }
      });
    }
  };
  
  return (
    <div className={css['ai-config-panel']}>
      <div className={css['ai-config-header']}>
        <RobotIcon size={24} />
        <div>
          <h3>Configure AI Migration Assistant</h3>
          <p>
            OpenNoodl uses Claude (by Anthropic) to intelligently migrate 
            complex code patterns.
          </p>
        </div>
      </div>
      
      {/* API Key Section */}
      <section className={css['config-section']}>
        <h4>Anthropic API Key</h4>
        <p>
          You'll need an API key from Anthropic. 
          <a href="https://console.anthropic.com" target="_blank">
            Get one here →
          </a>
        </p>
        
        <div className={css['api-key-input']}>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className={validationError ? css['input-error'] : ''}
          />
          <Button
            variant="secondary"
            size="small"
            onClick={validateApiKey}
            disabled={!apiKey || validating}
          >
            {validating ? <Spinner size={14} /> : 'Validate'}
          </Button>
        </div>
        
        {validationError && (
          <div className={css['validation-error']}>
            <ErrorIcon size={14} />
            {validationError}
          </div>
        )}
        
        <div className={css['security-note']}>
          <LockIcon size={14} />
          <span>
            Your API key is stored locally and encrypted. It's never sent to 
            OpenNoodl servers - all API calls go directly to Anthropic.
          </span>
        </div>
      </section>
      
      {/* Budget Section */}
      <section className={css['config-section']}>
        <h4>Budget Controls</h4>
        
        <div className={css['config-field']}>
          <label>Maximum spend per migration session</label>
          <div className={css['budget-input']}>
            <span>$</span>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
            />
          </div>
          <span className={css['field-hint']}>
            Typical migration: $0.10 - $2.00
          </span>
        </div>
        
        <div className={css['config-field']}>
          <label>
            <input
              type="checkbox"
              checked={pauseIncrement > 0}
              onChange={(e) => setPauseIncrement(e.target.checked ? 5 : 0)}
            />
            Pause and ask before each ${pauseIncrement} increment
          </label>
        </div>
        
        <div className={css['config-field']}>
          <label>
            <input
              type="checkbox"
              checked={showEstimates}
              onChange={(e) => setShowEstimates(e.target.checked)}
            />
            Show cost estimate before each component
          </label>
        </div>
      </section>
      
      {/* Preferences Section */}
      <section className={css['config-section']}>
        <h4>Migration Preferences</h4>
        
        <div className={css['config-field']}>
          <label>
            <input
              type="checkbox"
              checked={preferFunctional}
              onChange={(e) => setPreferFunctional(e.target.checked)}
            />
            Prefer converting to functional components with hooks
          </label>
          <span className={css['field-hint']}>
            When possible, Claude will convert class components to 
            modern functional components
          </span>
        </div>
      </section>
      
      <div className={css['config-actions']}>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={!apiKey || validating}
        >
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
```

### API Key Storage

```typescript
// packages/noodl-editor/src/editor/src/utils/migration/keyStorage.ts

import Store from 'electron-store';
import { safeStorage } from 'electron';

const store = new Store({
  name: 'ai-config',
  encryptionKey: 'opennoodl-migration' // Additional layer
});

export async function saveApiKey(apiKey: string): Promise<void> {
  // Use Electron's safeStorage for OS-level encryption
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(apiKey);
    store.set('anthropic.apiKey', encrypted.toString('base64'));
  } else {
    // Fallback to electron-store encryption
    store.set('anthropic.apiKey', apiKey);
  }
}

export async function getApiKey(): Promise<string | null> {
  const stored = store.get('anthropic.apiKey') as string | undefined;
  if (!stored) return null;
  
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }
  
  return stored;
}

export async function clearApiKey(): Promise<void> {
  store.delete('anthropic.apiKey');
}

export async function testAnthropicKey(apiKey: string): Promise<boolean> {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  
  try {
    // Make a minimal API call to verify the key
    await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    });
    return true;
  } catch (error) {
    if (error.status === 401) {
      throw new Error('Invalid API key');
    }
    if (error.status === 403) {
      throw new Error('API key does not have required permissions');
    }
    throw new Error(`API error: ${error.message}`);
  }
}
```

## Claude Integration

### System Prompt

```typescript
// packages/noodl-editor/src/editor/src/utils/migration/claudePrompts.ts

export const MIGRATION_SYSTEM_PROMPT = `You are a React migration assistant for OpenNoodl, a visual programming platform. Your job is to migrate React class components from React 17 patterns to React 19.

## Your Task
Convert the provided React code to be compatible with React 19. The code may contain:
- componentWillMount (removed in React 19)
- componentWillReceiveProps (removed in React 19)
- componentWillUpdate (removed in React 19)
- UNSAFE_ prefixed lifecycle methods (removed in React 19)
- String refs (removed in React 19)
- Legacy context API (removed in React 19)
- React.createFactory (removed in React 19)

## Migration Rules

### Lifecycle Methods
1. componentWillMount → Move logic to componentDidMount or constructor
2. componentWillReceiveProps → Use getDerivedStateFromProps (static) or componentDidUpdate
3. componentWillUpdate → Use getSnapshotBeforeUpdate + componentDidUpdate

### String Refs
Convert: ref="myRef" → ref={this.myRef = React.createRef()} or useRef()

### Legacy Context
Convert contextTypes/childContextTypes/getChildContext → React.createContext

### Functional Preference
If the component doesn't use complex state or many lifecycle methods, prefer converting to a functional component with hooks.

## Output Format
You MUST respond with a JSON object in this exact format:
{
  "success": true,
  "code": "// The migrated code here",
  "changes": [
    "Converted componentWillMount to useEffect",
    "Replaced string ref with useRef"
  ],
  "warnings": [
    "Verify the useEffect dependency array is correct"
  ],
  "confidence": 0.85
}

If you cannot migrate the code:
{
  "success": false,
  "code": null,
  "reason": "Explanation of why migration failed",
  "suggestion": "What the user could do manually",
  "confidence": 0
}

## Rules
1. PRESERVE all existing functionality exactly
2. PRESERVE all comments unless they reference removed APIs
3. ADD comments explaining non-obvious changes
4. DO NOT change prop names or component interfaces
5. DO NOT add new dependencies
6. If confidence < 0.7, explain why in warnings
7. Test the code mentally - would it work?

## Context
This code is from an OpenNoodl project. OpenNoodl uses a custom node system where React components are wrapped. The component may reference:
- this.props.noodlNode - Reference to the Noodl node instance
- this.forceUpdate() - Triggers re-render (still valid in React 19)
- this.setStyle() - Noodl method for styling
- this.getRef() - Noodl method for DOM access`;

export const RETRY_PROMPT_TEMPLATE = `The previous migration attempt failed verification.

Previous attempt result:
{previousError}

Previous code:
\`\`\`javascript
{previousCode}
\`\`\`

Please try a different approach. Consider:
1. Maybe the conversion should stay as a class component instead of functional
2. Check if state management is correct
3. Verify event handlers are bound correctly
4. Ensure refs are used correctly

Provide a new migration with the same JSON format.`;

export const HELP_PROMPT_TEMPLATE = `I attempted to migrate this React component {attempts} times but couldn't produce working code.

Original code:
\`\`\`javascript
{originalCode}
\`\`\`

Attempts and errors:
{attemptHistory}

Please analyze this component and provide:
1. Why it's difficult to migrate automatically
2. Step-by-step manual migration instructions
3. Any gotchas or things to watch out for
4. Example code snippets for the tricky parts

Format your response as helpful documentation, not JSON.`;
```

### Claude Client

```typescript
// packages/noodl-editor/src/editor/src/utils/migration/claudeClient.ts

import Anthropic from '@anthropic-ai/sdk';

export interface MigrationRequest {
  code: string;
  issues: MigrationIssue[];
  componentName: string;
  preferences: AIConfig['preferences'];
  previousAttempt?: {
    code: string;
    error: string;
  };
}

export interface MigrationResponse {
  success: boolean;
  code: string | null;
  changes: string[];
  warnings: string[];
  confidence: number;
  reason?: string;
  suggestion?: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

export class ClaudeClient {
  private client: Anthropic;
  private model = 'claude-sonnet-4-5-20250514';
  
  // Pricing per 1M tokens (as of 2024)
  private pricing = {
    input: 3.00,   // $3 per 1M input tokens
    output: 15.00  // $15 per 1M output tokens
  };
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  
  async migrateComponent(request: MigrationRequest): Promise<MigrationResponse> {
    const userPrompt = this.buildUserPrompt(request);
    
    const startTime = Date.now();
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: MIGRATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });
    
    const tokensUsed = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens
    };
    
    const cost = this.calculateCost(tokensUsed);
    
    // Parse the response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }
    
    try {
      const parsed = this.parseResponse(content.text);
      return {
        ...parsed,
        tokensUsed,
        cost
      };
    } catch (parseError) {
      return {
        success: false,
        code: null,
        changes: [],
        warnings: [],
        confidence: 0,
        reason: 'Failed to parse AI response',
        suggestion: content.text.slice(0, 500), // Include raw response for debugging
        tokensUsed,
        cost
      };
    }
  }
  
  async getHelp(request: HelpRequest): Promise<string> {
    const prompt = HELP_PROMPT_TEMPLATE
      .replace('{attempts}', String(request.attempts))
      .replace('{originalCode}', request.originalCode)
      .replace('{attemptHistory}', request.attemptHistory
        .map((a, i) => `Attempt ${i + 1}: ${a.error}`)
        .join('\n')
      );
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }
    
    return content.text;
  }
  
  private buildUserPrompt(request: MigrationRequest): string {
    let prompt = `Migrate this React component to React 19:\n\n`;
    prompt += `Component: ${request.componentName}\n\n`;
    prompt += `Issues detected:\n`;
    request.issues.forEach(issue => {
      prompt += `- ${issue.type} at line ${issue.location.line}: ${issue.description}\n`;
    });
    prompt += `\nCode:\n\`\`\`javascript\n${request.code}\n\`\`\`\n`;
    
    if (request.preferences.preferFunctional) {
      prompt += `\nPreference: Convert to functional component with hooks if clean.\n`;
    }
    
    if (request.previousAttempt) {
      prompt += `\n--- RETRY ---\n`;
      prompt += `Previous attempt failed: ${request.previousAttempt.error}\n`;
      prompt += `Previous code:\n\`\`\`javascript\n${request.previousAttempt.code}\n\`\`\`\n`;
      prompt += `Please try a different approach.\n`;
    }
    
    return prompt;
  }
  
  private parseResponse(text: string): Omit<MigrationResponse, 'tokensUsed' | 'cost'> {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      success: parsed.success ?? false,
      code: parsed.code ?? null,
      changes: parsed.changes ?? [],
      warnings: parsed.warnings ?? [],
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason,
      suggestion: parsed.suggestion
    };
  }
  
  private calculateCost(tokens: { input: number; output: number }): number {
    const inputCost = (tokens.input / 1_000_000) * this.pricing.input;
    const outputCost = (tokens.output / 1_000_000) * this.pricing.output;
    return inputCost + outputCost;
  }
  
  estimateCost(codeLength: number): number {
    // Rough estimation: ~4 chars per token
    const estimatedInputTokens = (codeLength / 4) + 1000; // +1000 for system prompt
    const estimatedOutputTokens = (codeLength / 4) * 1.5; // Output usually larger
    
    return this.calculateCost({
      input: estimatedInputTokens,
      output: estimatedOutputTokens
    });
  }
}
```

## Budget Controller

```typescript
// packages/noodl-editor/src/editor/src/models/migration/BudgetController.ts

export interface BudgetState {
  maxPerSession: number;
  spent: number;
  pauseIncrement: number;
  nextPauseAt: number;
  paused: boolean;
}

export interface BudgetCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  currentSpent: number;
  estimatedNext: number;
  wouldExceedMax: boolean;
}

export class BudgetController {
  private state: BudgetState;
  private onPauseRequired: (state: BudgetState) => Promise<boolean>;
  
  constructor(
    config: AIConfig['budget'],
    onPauseRequired: (state: BudgetState) => Promise<boolean>
  ) {
    this.state = {
      maxPerSession: config.maxPerSession,
      spent: 0,
      pauseIncrement: config.pauseIncrement,
      nextPauseAt: config.pauseIncrement,
      paused: false
    };
    this.onPauseRequired = onPauseRequired;
  }
  
  checkBudget(estimatedCost: number): BudgetCheckResult {
    const wouldExceedMax = this.state.spent + estimatedCost > this.state.maxPerSession;
    const wouldExceedPause = this.state.spent + estimatedCost > this.state.nextPauseAt;
    
    return {
      allowed: !wouldExceedMax,
      requiresApproval: wouldExceedPause && !this.state.paused,
      currentSpent: this.state.spent,
      estimatedNext: estimatedCost,
      wouldExceedMax
    };
  }
  
  async requestApproval(estimatedCost: number): Promise<boolean> {
    const check = this.checkBudget(estimatedCost);
    
    if (check.wouldExceedMax) {
      return false; // Hard limit, can't approve
    }
    
    if (check.requiresApproval) {
      const approved = await this.onPauseRequired(this.state);
      if (approved) {
        this.state.nextPauseAt += this.state.pauseIncrement;
      }
      return approved;
    }
    
    return true;
  }
  
  recordSpend(amount: number): void {
    this.state.spent += amount;
  }
  
  getState(): BudgetState {
    return { ...this.state };
  }
  
  getRemainingBudget(): number {
    return Math.max(0, this.state.maxPerSession - this.state.spent);
  }
}
```

## Migration Orchestrator

```typescript
// packages/noodl-editor/src/editor/src/models/migration/AIMigrationOrchestrator.ts

export interface OrchestratorConfig {
  maxRetries: number;
  minConfidence: number;
  verifyMigration: boolean;
}

export interface ComponentMigrationResult {
  componentId: string;
  componentName: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  migratedCode?: string;
  changes: string[];
  warnings: string[];
  attempts: number;
  totalCost: number;
  error?: string;
  aiSuggestion?: string;
}

export class AIMigrationOrchestrator {
  private client: ClaudeClient;
  private budget: BudgetController;
  private config: OrchestratorConfig;
  private aborted = false;
  
  constructor(
    apiKey: string,
    budgetConfig: AIConfig['budget'],
    config: OrchestratorConfig,
    onBudgetPause: (state: BudgetState) => Promise<boolean>
  ) {
    this.client = new ClaudeClient(apiKey);
    this.budget = new BudgetController(budgetConfig, onBudgetPause);
    this.config = config;
  }
  
  async migrateComponent(
    component: ComponentMigrationInfo,
    code: string,
    preferences: AIConfig['preferences'],
    onProgress: (update: ProgressUpdate) => void,
    onDecisionRequired: (request: DecisionRequest) => Promise<Decision>
  ): Promise<ComponentMigrationResult> {
    let attempts = 0;
    let totalCost = 0;
    let lastError: string | null = null;
    let lastCode: string | null = null;
    const attemptHistory: AttemptRecord[] = [];
    
    while (attempts < this.config.maxRetries && !this.aborted) {
      attempts++;
      
      // Check budget
      const estimatedCost = this.client.estimateCost(code.length);
      const budgetCheck = this.budget.checkBudget(estimatedCost);
      
      if (!budgetCheck.allowed) {
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'failed',
          changes: [],
          warnings: [],
          attempts,
          totalCost,
          error: 'Budget exceeded'
        };
      }
      
      if (budgetCheck.requiresApproval) {
        const approved = await this.budget.requestApproval(estimatedCost);
        if (!approved) {
          return {
            componentId: component.id,
            componentName: component.name,
            status: 'skipped',
            changes: [],
            warnings: ['Migration paused by user'],
            attempts,
            totalCost
          };
        }
      }
      
      // Attempt migration
      onProgress({
        phase: 'ai-migrating',
        component: component.name,
        attempt: attempts,
        message: attempts === 1 
          ? 'Analyzing code patterns...'
          : `Retry attempt ${attempts}...`
      });
      
      const response = await this.client.migrateComponent({
        code,
        issues: component.issues,
        componentName: component.name,
        preferences,
        previousAttempt: lastError ? { code: lastCode!, error: lastError } : undefined
      });
      
      totalCost += response.cost;
      this.budget.recordSpend(response.cost);
      
      if (response.success && response.confidence >= this.config.minConfidence) {
        // Verify the migration if enabled
        if (this.config.verifyMigration) {
          const verification = await this.verifyMigration(response.code!, component);
          
          if (!verification.valid) {
            lastError = verification.error;
            lastCode = response.code;
            attemptHistory.push({
              code: response.code,
              error: verification.error,
              cost: response.cost
            });
            continue;
          }
        }
        
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'success',
          migratedCode: response.code!,
          changes: response.changes,
          warnings: response.warnings,
          attempts,
          totalCost
        };
      }
      
      // Migration failed or low confidence
      lastError = response.reason || 'Low confidence migration';
      lastCode = response.code;
      attemptHistory.push({
        code: response.code,
        error: lastError,
        cost: response.cost
      });
    }
    
    // All retries exhausted - ask user what to do
    const decision = await onDecisionRequired({
      componentId: component.id,
      componentName: component.name,
      attempts,
      attemptHistory,
      costSpent: totalCost,
      retryCost: this.client.estimateCost(code.length)
    });
    
    switch (decision.action) {
      case 'retry':
        // Recursive retry with fresh attempts
        return this.migrateComponent(
          component, code, preferences, onProgress, onDecisionRequired
        );
      
      case 'skip':
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'skipped',
          changes: [],
          warnings: ['Skipped by user after failed attempts'],
          attempts,
          totalCost
        };
      
      case 'getHelp':
        const help = await this.client.getHelp({
          originalCode: code,
          attempts,
          attemptHistory
        });
        totalCost += 0.02; // Approximate cost for help request
        
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'failed',
          changes: [],
          warnings: attemptHistory.map(a => a.error),
          attempts,
          totalCost,
          aiSuggestion: help
        };
      
      case 'manual':
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'partial',
          migratedCode: lastCode || undefined,
          changes: [],
          warnings: ['Marked for manual review'],
          attempts,
          totalCost
        };
    }
  }
  
  private async verifyMigration(
    code: string, 
    component: ComponentMigrationInfo
  ): Promise<{ valid: boolean; error?: string }> {
    // Basic syntax check using Babel
    try {
      const babel = require('@babel/parser');
      babel.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
    } catch (syntaxError) {
      return { 
        valid: false, 
        error: `Syntax error: ${syntaxError.message}` 
      };
    }
    
    // Check that no forbidden patterns remain
    const forbiddenPatterns = [
      { regex: /componentWillMount\s*\(/, name: 'componentWillMount' },
      { regex: /componentWillReceiveProps\s*\(/, name: 'componentWillReceiveProps' },
      { regex: /componentWillUpdate\s*\(/, name: 'componentWillUpdate' },
      { regex: /ref\s*=\s*["'][^"']+["']/, name: 'string ref' },
      { regex: /contextTypes\s*=/, name: 'legacy contextTypes' },
    ];
    
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(code)) {
        return {
          valid: false,
          error: `Code still contains ${pattern.name}`
        };
      }
    }
    
    return { valid: true };
  }
  
  abort(): void {
    this.aborted = true;
  }
  
  getBudgetState(): BudgetState {
    return this.budget.getState();
  }
}
```

## Budget Approval Dialog

```tsx
// packages/noodl-editor/src/editor/src/views/migration/BudgetApprovalDialog.tsx

interface BudgetApprovalDialogProps {
  state: BudgetState;
  onApprove: () => void;
  onDeny: () => void;
}

function BudgetApprovalDialog({ state, onApprove, onDeny }: BudgetApprovalDialogProps) {
  return (
    <Dialog title="Budget Check" size="small">
      <div className={css['budget-approval']}>
        <div className={css['budget-icon']}>
          <WalletIcon size={32} />
        </div>
        
        <p>
          You've spent <strong>${state.spent.toFixed(2)}</strong> of your 
          <strong> ${state.maxPerSession.toFixed(2)}</strong> budget.
        </p>
        
        <p>
          Continue with another <strong>${state.pauseIncrement.toFixed(2)}</strong> allowance?
        </p>
        
        <div className={css['budget-bar']}>
          <div 
            className={css['budget-bar__spent']}
            style={{ width: `${(state.spent / state.maxPerSession) * 100}%` }}
          />
          <div 
            className={css['budget-bar__pending']}
            style={{ 
              left: `${(state.spent / state.maxPerSession) * 100}%`,
              width: `${(state.pauseIncrement / state.maxPerSession) * 100}%` 
            }}
          />
        </div>
        
        <div className={css['budget-labels']}>
          <span>$0</span>
          <span>${state.maxPerSession.toFixed(2)}</span>
        </div>
      </div>
      
      <DialogActions>
        <Button variant="secondary" onClick={onDeny}>
          Stop Here
        </Button>
        <Button variant="primary" onClick={onApprove}>
          Continue (+${state.pauseIncrement.toFixed(2)})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

## Testing Checklist

- [ ] API key validation works
- [ ] Invalid key shows clear error
- [ ] Key is stored encrypted
- [ ] Budget controls enforce limits
- [ ] Pause dialog appears at increment
- [ ] Cost estimates are reasonable
- [ ] Claude responses parse correctly
- [ ] Retry logic works
- [ ] Decision dialog appears after max retries
- [ ] "Get Help" returns useful suggestions
- [ ] Budget display updates in real-time
- [ ] Abort stops migration cleanly
