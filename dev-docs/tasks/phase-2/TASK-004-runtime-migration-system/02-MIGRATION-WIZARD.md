# 02 - Migration Wizard

## Overview

A step-by-step wizard that guides users through the migration process. The wizard handles project copying, scanning, reporting, and executing migrations.

## Wizard Steps

1. **Confirm** - Confirm source/target paths
2. **Scan** - Analyze project for migration needs
3. **Report** - Show what needs to change
4. **Configure** - (Optional) Set up AI assistance
5. **Migrate** - Execute the migration
6. **Complete** - Summary and next steps

## State Machine

```typescript
// packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts

type MigrationStep = 
  | 'confirm'
  | 'scanning'
  | 'report'
  | 'configureAi'
  | 'migrating'
  | 'complete'
  | 'failed';

interface MigrationSession {
  id: string;
  step: MigrationStep;
  
  // Source project
  source: {
    path: string;
    name: string;
    runtimeVersion: 'react17';
  };
  
  // Target (copy) project
  target: {
    path: string;
    copied: boolean;
  };
  
  // Scan results
  scan?: {
    completedAt: string;
    totalComponents: number;
    totalNodes: number;
    customJsFiles: number;
    categories: {
      automatic: ComponentMigrationInfo[];
      simpleFixes: ComponentMigrationInfo[];
      needsReview: ComponentMigrationInfo[];
    };
  };
  
  // AI configuration
  ai?: {
    enabled: boolean;
    apiKey?: string; // Only stored in memory during session
    budget: {
      max: number;
      spent: number;
      pauseIncrement: number;
    };
  };
  
  // Migration progress
  progress?: {
    phase: 'copying' | 'automatic' | 'ai-assisted' | 'finalizing';
    current: number;
    total: number;
    currentComponent?: string;
    log: MigrationLogEntry[];
  };
  
  // Final result
  result?: {
    success: boolean;
    migrated: number;
    needsReview: number;
    failed: number;
    totalCost: number;
    duration: number;
  };
}

interface ComponentMigrationInfo {
  id: string;
  name: string;
  path: string;
  issues: MigrationIssue[];
  estimatedCost?: number;
}

interface MigrationIssue {
  id: string;
  type: MigrationIssueType;
  description: string;
  location: {
    file: string;
    line: number;
    column?: number;
  };
  autoFixable: boolean;
  fix?: {
    type: 'automatic' | 'ai-required';
    description: string;
  };
}

type MigrationIssueType = 
  | 'componentWillMount'
  | 'componentWillReceiveProps'
  | 'componentWillUpdate'
  | 'unsafeLifecycle'
  | 'stringRef'
  | 'legacyContext'
  | 'createFactory'
  | 'findDOMNode'
  | 'reactDomRender'
  | 'other';

interface MigrationLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  component?: string;
  message: string;
  details?: string;
  cost?: number;
}
```

## Step 1: Confirm

```tsx
// packages/noodl-editor/src/editor/src/views/migration/steps/ConfirmStep.tsx

interface ConfirmStepProps {
  session: MigrationSession;
  onUpdateTarget: (path: string) => void;
  onNext: () => void;
  onCancel: () => void;
}

function ConfirmStep({ session, onUpdateTarget, onNext, onCancel }: ConfirmStepProps) {
  const [targetPath, setTargetPath] = useState(session.target.path);
  const [targetExists, setTargetExists] = useState(false);
  
  useEffect(() => {
    checkPathExists(targetPath).then(setTargetExists);
  }, [targetPath]);
  
  const handleTargetChange = (newPath: string) => {
    setTargetPath(newPath);
    onUpdateTarget(newPath);
  };
  
  return (
    <WizardStep
      title="Migrate Project"
      subtitle="We'll create a copy of your project and migrate it to React 19"
    >
      <div className={css['confirm-step']}>
        <PathSection
          label="Original Project (will not be modified)"
          path={session.source.path}
          icon={<LockIcon />}
          readonly
        />
        
        <div className={css['arrow-down']}>
          <ArrowDownIcon />
          <span>Creates copy</span>
        </div>
        
        <PathSection
          label="Migrated Copy"
          path={targetPath}
          onChange={handleTargetChange}
          error={targetExists ? 'A folder already exists at this location' : undefined}
          icon={<FolderPlusIcon />}
        />
        
        {targetExists && (
          <div className={css['path-exists-options']}>
            <Button 
              variant="secondary" 
              size="small"
              onClick={() => handleTargetChange(`${targetPath}-${Date.now()}`)}
            >
              Use Different Name
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={() => confirmOverwrite()}
            >
              Overwrite Existing
            </Button>
          </div>
        )}
        
        <InfoBox type="info">
          <p>
            <strong>What happens next:</strong>
          </p>
          <ol>
            <li>Your project will be copied to the new location</li>
            <li>We'll scan for compatibility issues</li>
            <li>You'll see a report of what needs to change</li>
            <li>Optionally, AI can help fix complex code</li>
          </ol>
        </InfoBox>
      </div>
      
      <WizardActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={onNext}
          disabled={targetExists}
        >
          Start Migration
        </Button>
      </WizardActions>
    </WizardStep>
  );
}
```

## Step 2: Scanning

```tsx
// packages/noodl-editor/src/editor/src/views/migration/steps/ScanningStep.tsx

interface ScanningStepProps {
  session: MigrationSession;
  onComplete: (scan: MigrationScan) => void;
  onError: (error: Error) => void;
}

function ScanningStep({ session, onComplete, onError }: ScanningStepProps) {
  const [phase, setPhase] = useState<'copying' | 'scanning'>('copying');
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const [stats, setStats] = useState({ components: 0, nodes: 0, jsFiles: 0 });
  
  useEffect(() => {
    runScan();
  }, []);
  
  const runScan = async () => {
    try {
      // Phase 1: Copy project
      setPhase('copying');
      await copyProject(session.source.path, session.target.path, {
        onProgress: (p, item) => {
          setProgress(p * 50); // 0-50%
          setCurrentItem(item);
        }
      });
      
      // Phase 2: Scan for issues
      setPhase('scanning');
      const scan = await scanProject(session.target.path, {
        onProgress: (p, item, partialStats) => {
          setProgress(50 + p * 50); // 50-100%
          setCurrentItem(item);
          setStats(partialStats);
        }
      });
      
      onComplete(scan);
    } catch (error) {
      onError(error);
    }
  };
  
  return (
    <WizardStep
      title={phase === 'copying' ? 'Copying Project...' : 'Analyzing Project...'}
      subtitle={phase === 'copying' 
        ? 'Creating a safe copy before making any changes'
        : 'Scanning components for compatibility issues'
      }
    >
      <div className={css['scanning-step']}>
        <ProgressBar value={progress} max={100} />
        
        <div className={css['scanning-current']}>
          {currentItem && (
            <>
              <Spinner size={14} />
              <span>{currentItem}</span>
            </>
          )}
        </div>
        
        <div className={css['scanning-stats']}>
          <StatBox label="Components" value={stats.components} />
          <StatBox label="Nodes" value={stats.nodes} />
          <StatBox label="JS Files" value={stats.jsFiles} />
        </div>
        
        {phase === 'scanning' && (
          <div className={css['scanning-note']}>
            <InfoIcon size={14} />
            <span>
              Looking for React 17 patterns that need updating...
            </span>
          </div>
        )}
      </div>
    </WizardStep>
  );
}
```

## Step 3: Report

```tsx
// packages/noodl-editor/src/editor/src/views/migration/steps/ReportStep.tsx

interface ReportStepProps {
  session: MigrationSession;
  onConfigureAi: () => void;
  onMigrateWithoutAi: () => void;
  onMigrateWithAi: () => void;
  onCancel: () => void;
}

function ReportStep({ 
  session, 
  onConfigureAi,
  onMigrateWithoutAi, 
  onMigrateWithAi,
  onCancel 
}: ReportStepProps) {
  const { scan } = session;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  const totalIssues = 
    scan.categories.simpleFixes.length + 
    scan.categories.needsReview.length;
  
  const estimatedCost = scan.categories.simpleFixes
    .concat(scan.categories.needsReview)
    .reduce((sum, c) => sum + (c.estimatedCost || 0), 0);
  
  const allAutomatic = totalIssues === 0;
  
  return (
    <WizardStep
      title="Migration Report"
      subtitle={`${scan.totalComponents} components analyzed`}
    >
      <div className={css['report-step']}>
        {/* Summary Stats */}
        <div className={css['report-summary']}>
          <StatCard 
            icon={<CheckCircleIcon />}
            value={scan.categories.automatic.length}
            label="Automatic"
            variant="success"
          />
          <StatCard
            icon={<ZapIcon />}
            value={scan.categories.simpleFixes.length}
            label="Simple Fixes"
            variant="info"
          />
          <StatCard
            icon={<ToolIcon />}
            value={scan.categories.needsReview.length}
            label="Needs Review"
            variant="warning"
          />
        </div>
        
        {/* Category Details */}
        <div className={css['report-categories']}>
          <CategorySection
            title="Automatic"
            description="These will migrate without any changes"
            icon={<CheckCircleIcon />}
            items={scan.categories.automatic}
            variant="success"
            expanded={expandedCategory === 'automatic'}
            onToggle={() => setExpandedCategory(
              expandedCategory === 'automatic' ? null : 'automatic'
            )}
          />
          
          {scan.categories.simpleFixes.length > 0 && (
            <CategorySection
              title="Simple Fixes"
              description="Minor syntax updates needed"
              icon={<ZapIcon />}
              items={scan.categories.simpleFixes}
              variant="info"
              expanded={expandedCategory === 'simpleFixes'}
              onToggle={() => setExpandedCategory(
                expandedCategory === 'simpleFixes' ? null : 'simpleFixes'
              )}
              showIssueDetails
            />
          )}
          
          {scan.categories.needsReview.length > 0 && (
            <CategorySection
              title="Needs Review"
              description="May require manual adjustment"
              icon={<ToolIcon />}
              items={scan.categories.needsReview}
              variant="warning"
              expanded={expandedCategory === 'needsReview'}
              onToggle={() => setExpandedCategory(
                expandedCategory === 'needsReview' ? null : 'needsReview'
              )}
              showIssueDetails
            />
          )}
        </div>
        
        {/* AI Assistance Prompt */}
        {!allAutomatic && (
          <div className={css['ai-prompt']}>
            <div className={css['ai-prompt__icon']}>
              <RobotIcon size={24} />
            </div>
            <div className={css['ai-prompt__content']}>
              <h4>AI-Assisted Migration Available</h4>
              <p>
                Claude can automatically fix the {totalIssues} components that 
                need code changes. Estimated cost: ~${estimatedCost.toFixed(2)}
              </p>
            </div>
            <Button 
              variant="secondary"
              onClick={onConfigureAi}
            >
              Configure AI Assistant
            </Button>
          </div>
        )}
      </div>
      
      <WizardActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        
        {allAutomatic ? (
          <Button variant="primary" onClick={onMigrateWithoutAi}>
            Migrate Project
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onMigrateWithoutAi}>
              Migrate Without AI
            </Button>
            {session.ai?.enabled && (
              <Button variant="primary" onClick={onMigrateWithAi}>
                Migrate With AI
              </Button>
            )}
          </>
        )}
      </WizardActions>
    </WizardStep>
  );
}

// Category Section Component
function CategorySection({
  title,
  description,
  icon,
  items,
  variant,
  expanded,
  onToggle,
  showIssueDetails = false
}: CategorySectionProps) {
  return (
    <div className={css['category-section', `category-section--${variant}`]}>
      <button 
        className={css['category-header']}
        onClick={onToggle}
      >
        <div className={css['category-header__left']}>
          {icon}
          <div>
            <h4>{title} ({items.length})</h4>
            <p>{description}</p>
          </div>
        </div>
        <ChevronIcon direction={expanded ? 'up' : 'down'} />
      </button>
      
      {expanded && (
        <div className={css['category-items']}>
          {items.map(item => (
            <div key={item.id} className={css['category-item']}>
              <ComponentIcon />
              <div className={css['category-item__info']}>
                <span className={css['category-item__name']}>
                  {item.name}
                </span>
                {showIssueDetails && item.issues.length > 0 && (
                  <ul className={css['category-item__issues']}>
                    {item.issues.map(issue => (
                      <li key={issue.id}>
                        <code>{issue.type}</code>
                        <span>{issue.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {item.estimatedCost && (
                <span className={css['category-item__cost']}>
                  ~${item.estimatedCost.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Step 4: Migration Progress

```tsx
// packages/noodl-editor/src/editor/src/views/migration/steps/MigratingStep.tsx

interface MigratingStepProps {
  session: MigrationSession;
  useAi: boolean;
  onPause: () => void;
  onAiDecision: (decision: AiDecision) => void;
  onComplete: (result: MigrationResult) => void;
  onError: (error: Error) => void;
}

interface AiDecision {
  componentId: string;
  action: 'retry' | 'skip' | 'manual' | 'getHelp';
}

function MigratingStep({
  session,
  useAi,
  onPause,
  onAiDecision,
  onComplete,
  onError
}: MigratingStepProps) {
  const [awaitingDecision, setAwaitingDecision] = useState<AiDecisionRequest | null>(null);
  const { progress, ai } = session;
  
  const budgetPercent = ai ? (ai.budget.spent / ai.budget.max) * 100 : 0;
  
  return (
    <WizardStep
      title={useAi ? 'AI Migration in Progress' : 'Migrating Project...'}
      subtitle={`Phase: ${progress?.phase || 'Starting'}`}
    >
      <div className={css['migrating-step']}>
        {/* Budget Display (if using AI) */}
        {useAi && ai && (
          <div className={css['budget-display']}>
            <div className={css['budget-display__header']}>
              <span>Budget</span>
              <span>${ai.budget.spent.toFixed(2)} / ${ai.budget.max.toFixed(2)}</span>
            </div>
            <ProgressBar 
              value={budgetPercent} 
              max={100}
              variant={budgetPercent > 80 ? 'warning' : 'default'}
            />
          </div>
        )}
        
        {/* Component Progress */}
        <div className={css['component-progress']}>
          {progress?.log.slice(-5).map((entry, i) => (
            <LogEntry key={i} entry={entry} />
          ))}
          
          {progress?.currentComponent && !awaitingDecision && (
            <div className={css['current-component']}>
              <Spinner size={16} />
              <span>{progress.currentComponent}</span>
              {useAi && <span className={css['estimate']}>~$0.08</span>}
            </div>
          )}
        </div>
        
        {/* AI Decision Required */}
        {awaitingDecision && (
          <AiDecisionPanel
            request={awaitingDecision}
            budget={ai?.budget}
            onDecision={(decision) => {
              setAwaitingDecision(null);
              onAiDecision(decision);
            }}
          />
        )}
        
        {/* Overall Progress */}
        <div className={css['overall-progress']}>
          <ProgressBar 
            value={progress?.current || 0} 
            max={progress?.total || 100}
          />
          <span>
            {progress?.current || 0} / {progress?.total || 0} components
          </span>
        </div>
      </div>
      
      <WizardActions>
        <Button 
          variant="secondary" 
          onClick={onPause}
          disabled={!!awaitingDecision}
        >
          Pause Migration
        </Button>
      </WizardActions>
    </WizardStep>
  );
}

// Log Entry Component
function LogEntry({ entry }: { entry: MigrationLogEntry }) {
  const icons = {
    info: <InfoIcon size={14} />,
    success: <CheckIcon size={14} />,
    warning: <WarningIcon size={14} />,
    error: <ErrorIcon size={14} />
  };
  
  return (
    <div className={css['log-entry', `log-entry--${entry.level}`]}>
      {icons[entry.level]}
      <div className={css['log-entry__content']}>
        {entry.component && (
          <span className={css['log-entry__component']}>
            {entry.component}
          </span>
        )}
        <span className={css['log-entry__message']}>
          {entry.message}
        </span>
      </div>
      {entry.cost && (
        <span className={css['log-entry__cost']}>
          ${entry.cost.toFixed(2)}
        </span>
      )}
    </div>
  );
}

// AI Decision Panel
function AiDecisionPanel({
  request,
  budget,
  onDecision
}: {
  request: AiDecisionRequest;
  budget: MigrationBudget;
  onDecision: (decision: AiDecision) => void;
}) {
  return (
    <div className={css['decision-panel']}>
      <div className={css['decision-panel__header']}>
        <ToolIcon size={20} />
        <h4>{request.componentName} - Needs Your Input</h4>
      </div>
      
      <p>
        Claude attempted {request.attempts} migrations but the component 
        still has issues. Here's what happened:
      </p>
      
      <div className={css['decision-panel__attempts']}>
        {request.attemptHistory.map((attempt, i) => (
          <div key={i} className={css['attempt-entry']}>
            <span>Attempt {i + 1}:</span>
            <span>{attempt.description}</span>
          </div>
        ))}
      </div>
      
      <div className={css['decision-panel__cost']}>
        Cost so far: ${request.costSpent.toFixed(2)}
      </div>
      
      <div className={css['decision-panel__options']}>
        <Button
          onClick={() => onDecision({ 
            componentId: request.componentId, 
            action: 'retry' 
          })}
        >
          Try Again (~${request.retryCost.toFixed(2)})
        </Button>
        
        <Button
          variant="secondary"
          onClick={() => onDecision({ 
            componentId: request.componentId, 
            action: 'skip' 
          })}
        >
          Skip Component
        </Button>
        
        <Button
          variant="secondary"
          onClick={() => onDecision({ 
            componentId: request.componentId, 
            action: 'getHelp' 
          })}
        >
          Get Suggestions (~$0.02)
        </Button>
      </div>
    </div>
  );
}
```

## Step 5: Complete

```tsx
// packages/noodl-editor/src/editor/src/views/migration/steps/CompleteStep.tsx

interface CompleteStepProps {
  session: MigrationSession;
  onViewLog: () => void;
  onOpenProject: () => void;
}

function CompleteStep({ session, onViewLog, onOpenProject }: CompleteStepProps) {
  const { result, source, target } = session;
  
  const hasIssues = result.needsReview > 0;
  
  return (
    <WizardStep
      title={hasIssues ? 'Migration Complete (With Notes)' : 'Migration Complete!'}
      icon={hasIssues ? <CheckWarningIcon /> : <CheckCircleIcon />}
    >
      <div className={css['complete-step']}>
        {/* Summary */}
        <div className={css['complete-summary']}>
          <div className={css['summary-stats']}>
            <StatCard
              icon={<CheckIcon />}
              value={result.migrated}
              label="Migrated"
              variant="success"
            />
            {result.needsReview > 0 && (
              <StatCard
                icon={<WarningIcon />}
                value={result.needsReview}
                label="Needs Review"
                variant="warning"
              />
            )}
            {result.failed > 0 && (
              <StatCard
                icon={<ErrorIcon />}
                value={result.failed}
                label="Failed"
                variant="error"
              />
            )}
          </div>
          
          {session.ai?.enabled && (
            <div className={css['summary-cost']}>
              <RobotIcon size={16} />
              <span>AI cost: ${result.totalCost.toFixed(2)}</span>
            </div>
          )}
          
          <div className={css['summary-time']}>
            <ClockIcon size={16} />
            <span>Time: {formatDuration(result.duration)}</span>
          </div>
        </div>
        
        {/* Project Paths */}
        <div className={css['complete-paths']}>
          <h4>Project Locations</h4>
          
          <PathDisplay
            label="Original (untouched)"
            path={source.path}
            icon={<LockIcon />}
          />
          
          <PathDisplay
            label="Migrated copy"
            path={target.path}
            icon={<FolderIcon />}
            actions={[
              { label: 'Show in Finder', onClick: () => showInFinder(target.path) }
            ]}
          />
        </div>
        
        {/* What's Next */}
        <div className={css['complete-next']}>
          <h4>What's Next?</h4>
          <ol>
            {result.needsReview > 0 && (
              <li>
                <WarningIcon size={14} />
                Components marked with ⚠️ have notes in the component panel - 
                click to see migration details
              </li>
            )}
            <li>
              <TestIcon size={14} />
              Test your app thoroughly before deploying
            </li>
            <li>
              <TrashIcon size={14} />
              Once confirmed working, you can archive or delete the original folder
            </li>
          </ol>
        </div>
      </div>
      
      <WizardActions>
        <Button variant="secondary" onClick={onViewLog}>
          View Migration Log
        </Button>
        <Button variant="primary" onClick={onOpenProject}>
          Open Migrated Project
        </Button>
      </WizardActions>
    </WizardStep>
  );
}
```

## Wizard Container

```tsx
// packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.tsx

interface MigrationWizardProps {
  sourcePath: string;
  onComplete: (targetPath: string) => void;
  onCancel: () => void;
}

function MigrationWizard({ sourcePath, onComplete, onCancel }: MigrationWizardProps) {
  const [session, dispatch] = useReducer(migrationReducer, {
    id: generateId(),
    step: 'confirm',
    source: {
      path: sourcePath,
      name: path.basename(sourcePath),
      runtimeVersion: 'react17'
    },
    target: {
      path: `${sourcePath}-r19`,
      copied: false
    }
  });
  
  const renderStep = () => {
    switch (session.step) {
      case 'confirm':
        return (
          <ConfirmStep
            session={session}
            onUpdateTarget={(path) => dispatch({ type: 'SET_TARGET_PATH', path })}
            onNext={() => dispatch({ type: 'START_SCAN' })}
            onCancel={onCancel}
          />
        );
      
      case 'scanning':
        return (
          <ScanningStep
            session={session}
            onComplete={(scan) => dispatch({ type: 'SCAN_COMPLETE', scan })}
            onError={(error) => dispatch({ type: 'ERROR', error })}
          />
        );
      
      case 'report':
        return (
          <ReportStep
            session={session}
            onConfigureAi={() => dispatch({ type: 'CONFIGURE_AI' })}
            onMigrateWithoutAi={() => dispatch({ type: 'START_MIGRATE', useAi: false })}
            onMigrateWithAi={() => dispatch({ type: 'START_MIGRATE', useAi: true })}
            onCancel={onCancel}
          />
        );
      
      case 'configureAi':
        return (
          <AiConfigStep
            session={session}
            onSave={(config) => dispatch({ type: 'SAVE_AI_CONFIG', config })}
            onBack={() => dispatch({ type: 'BACK_TO_REPORT' })}
          />
        );
      
      case 'migrating':
        return (
          <MigratingStep
            session={session}
            useAi={session.ai?.enabled ?? false}
            onPause={() => dispatch({ type: 'PAUSE' })}
            onAiDecision={(d) => dispatch({ type: 'AI_DECISION', decision: d })}
            onComplete={(result) => dispatch({ type: 'COMPLETE', result })}
            onError={(error) => dispatch({ type: 'ERROR', error })}
          />
        );
      
      case 'complete':
        return (
          <CompleteStep
            session={session}
            onViewLog={() => openMigrationLog(session)}
            onOpenProject={() => onComplete(session.target.path)}
          />
        );
      
      case 'failed':
        return (
          <FailedStep
            session={session}
            onRetry={() => dispatch({ type: 'RETRY' })}
            onCancel={onCancel}
          />
        );
    }
  };
  
  return (
    <Dialog 
      className={css['migration-wizard']}
      size="large"
      onClose={onCancel}
    >
      <WizardProgress 
        steps={['Confirm', 'Scan', 'Report', 'Migrate', 'Complete']}
        currentStep={stepToIndex(session.step)}
      />
      
      {renderStep()}
    </Dialog>
  );
}
```

## Testing Checklist

- [ ] Wizard opens from project detection
- [ ] Target path can be customized
- [ ] Duplicate path detection works
- [ ] Scanning shows progress
- [ ] Report categorizes components correctly
- [ ] AI config button appears when needed
- [ ] Migration progress updates in real-time
- [ ] AI decision panel appears on failure
- [ ] Complete screen shows correct stats
- [ ] "Open Project" launches migrated project
- [ ] Cancel works at every step
- [ ] Errors are handled gracefully
