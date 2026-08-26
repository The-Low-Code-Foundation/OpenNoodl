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

// FB-005 T4 — narrowing that shelf. The filter is exported because it is ONE producer of both
// the rows and the pill counts, and phase 76's SB-007 draws the same shelf on the Templates tab:
// a second matcher beside this one is how a pill's count stops meaning the rows behind it.
export {
  EMPTY_TEMPLATE_FILTER,
  TEMPLATE_CATEGORY_LABELS,
  categoryLabel,
  filterTemplates,
  isFilterActive
} from './steps/templateFilter';
export type { TemplateFacet, TemplateFilter, TemplateFilterResult } from './steps/templateFilter';
