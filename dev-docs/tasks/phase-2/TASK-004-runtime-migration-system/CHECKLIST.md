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
- [ ] MigrationWizard.tsx container
- [ ] ConfirmStep.tsx component
- [ ] ScanningStep.tsx component  
- [ ] ReportStep.tsx component
- [ ] CompleteStep.tsx component
- [ ] MigrationExecutor.ts (project copy + basic fixes)
- [ ] DialogLayerModel integration for showing wizard

## Session 3: Projects View Integration
- [ ] Update projectsview.ts to detect and show legacy badges
- [ ] Add "Migrate Project" button to project cards
- [ ] Add "Open Read-Only" button to project cards
- [ ] Create EditorBanner.tsx for read-only mode warning
- [ ] Wire open project flow to detect legacy projects

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
