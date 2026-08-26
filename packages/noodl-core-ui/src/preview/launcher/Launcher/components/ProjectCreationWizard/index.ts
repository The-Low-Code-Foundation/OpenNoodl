export { ProjectCreationWizard } from './ProjectCreationWizard';
export type { ProjectCreationWizardProps, ScopingState } from './ProjectCreationWizard';
export type { WizardMode, WizardStep, WizardState } from './WizardContext';

// AIX-012 — the launcher's AI on-ramp: availability gating on the entry card,
// the conversation's message shape, and the plan rows the review step lists.
export type { AiAvailability } from './steps/EntryModeStep';
export type { ScopingMessage } from './steps/ScopingStep';
export type { ReviewPlanRow } from './steps/ReviewStep';

// FB-005 T3 — the template shelf the create wizard picks from.
export type { TemplateChoice, TemplateGalleryState } from './steps/TemplateStep';
