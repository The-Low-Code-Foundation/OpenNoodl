# React 19 Migration System - Implementation Checklist

## Session 1: Foundation + Detection
- [x] Create migration types file (`models/migration/types.ts`)
- [x] Create ProjectScanner.ts (detection logic with 5-tier checks)
- [ ] Update ProjectModel with migration fields (deferred - not needed for initial wizard)
- [x] Create MigrationSession.ts (state machine)
- [ ] Test scanner against example project (requires editor build)
- [x] Create CHANGELOG.md tracking file
- [x] Create index.ts module exports

## Session 2: Wizard UI (Basic Flow)
- [x] MigrationWizard.tsx container
- [x] WizardProgress.tsx component
- [x] ConfirmStep.tsx component
- [x] ScanningStep.tsx component  
- [x] ReportStep.tsx component
- [x] CompleteStep.tsx component
- [x] FailedStep.tsx component
- [x] SCSS module files (MigrationWizard, WizardProgress, ConfirmStep, ScanningStep, ReportStep, CompleteStep, FailedStep)
- [ ] MigrationExecutor.ts (project copy + basic fixes) - deferred to Session 4
- [x] DialogLayerModel integration for showing wizard (completed in Session 3)

## Session 3: Projects View Integration
- [x] DialogLayerModel.showDialog() generic method
- [x] LocalProjectsModel runtime detection with cache
- [x] Update projectsview.html template with legacy badges
- [x] Add CSS styles for legacy project indicators
- [x] Update projectsview.ts to detect and show legacy badges
- [x] Add "Migrate Project" button to project cards
- [x] Add "Open Read-Only" button to project cards
- [x] onMigrateProjectClicked handler (opens MigrationWizard)
- [x] onOpenReadOnlyClicked handler (opens project normally)
- [ ] Create EditorBanner.tsx for read-only mode warning - deferred to Post-Migration UX
- [ ] Wire auto-detect on existing project open - deferred to Post-Migration UX

## Session 4: AI Migration + Polish
- [ ] claudeClient.ts (Anthropic API integration)
- [ ] keyStorage.ts (encrypted API key storage)
- [ ] AIConfigPanel.tsx (API key + budget UI)
- [ ] BudgetController.ts (spending limits)
- [ ] BudgetApprovalDialog.tsx
- [ ] Integration into wizard flow
- [ ] MigratingStep.tsx with AI progress
- [ ] Post-migration component status badges
- [ ] MigrationNotesPanel.tsx

## Post-Migration UX
- [ ] Component panel status indicators
- [ ] Migration notes display
- [ ] Dismiss functionality
- [ ] Project Info panel migration section
- [ ] Component filter by migration status

## Polish Items
- [ ] New project dialog React 19 notice
- [ ] Welcome dialog for version updates
- [ ] Documentation links throughout UI
- [ ] Migration log viewer
