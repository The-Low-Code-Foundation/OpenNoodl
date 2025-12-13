# DASH-004: Tutorial Section Redesign

## Overview

Redesign the tutorial section (Learn tab) to be more compact, informative, and useful. Move from large tiles to a structured learning center with categories, progress tracking, and better discoverability.

## Context

The current tutorial section (`projectsview.ts` and lessons model) shows tutorials as large tiles with progress bars. The tiles take up significant screen space, making it hard to browse many tutorials. There's no categorization beyond a linear list.

The new launcher has an empty `LearningCenter.tsx` view that needs to be built out.

### Current Tutorial System

The existing system uses:
- `LessonProjectsModel` - manages lesson templates and progress
- `lessonprojectsmodel.ts` - fetches from docs endpoint
- Templates stored in docs repo with progress in localStorage

## Requirements

### Functional Requirements

1. **Category Organization**
   - Categories: Getting Started, Building UIs, Data & Logic, Advanced Topics, Integrations
   - Collapsible category sections
   - Category icons/colors

2. **Tutorial Cards (Compact)**
   - Title
   - Short description (1-2 lines)
   - Estimated duration
   - Difficulty level (Beginner, Intermediate, Advanced)
   - Progress indicator (not started, in progress, completed)
   - Thumbnail (small, optional)

3. **Progress Tracking**
   - Visual progress bar per tutorial
   - Overall progress stats ("5 of 12 completed")
   - "Continue where you left off" section at top
   - Reset progress option

4. **Filtering & Search**
   - Search tutorials by name/description
   - Filter by difficulty
   - Filter by category
   - Filter by progress (Not Started, In Progress, Completed)

5. **Tutorial Detail View**
   - Expanded description
   - Learning objectives
   - Prerequisites
   - "Start Tutorial" / "Continue" / "Restart" button
   - Estimated time remaining (for in-progress)

6. **Additional Content Types**
   - Video tutorials (embedded or linked)
   - Written guides
   - Interactive lessons (existing)
   - External resources

### Non-Functional Requirements

- Fast loading (tutorials list cached)
- Works offline for previously loaded tutorials
- Responsive layout
- Accessible navigation

## Data Model

### Enhanced Tutorial Structure

```typescript
interface Tutorial {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  category: TutorialCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  type: 'interactive' | 'video' | 'guide';
  thumbnailUrl?: string;
  objectives?: string[];
  prerequisites?: string[];
  
  // For interactive tutorials
  templateUrl?: string;
  
  // For video tutorials
  videoUrl?: string;
  
  // For guides
  guideUrl?: string;
}

interface TutorialCategory {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  order: number;
}

interface TutorialProgress {
  tutorialId: string;
  status: 'not-started' | 'in-progress' | 'completed';
  lastAccessedAt: string;
  completedAt?: string;
  currentStep?: number;
  totalSteps?: number;
}
```

### Default Categories

```typescript
const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  { id: 'getting-started', name: 'Getting Started', icon: IconName.Rocket, color: '#22C55E', order: 0 },
  { id: 'ui', name: 'Building UIs', icon: IconName.Palette, color: '#3B82F6', order: 1 },
  { id: 'data', name: 'Data & Logic', icon: IconName.Database, color: '#8B5CF6', order: 2 },
  { id: 'advanced', name: 'Advanced Topics', icon: IconName.Cog, color: '#F97316', order: 3 },
  { id: 'integrations', name: 'Integrations', icon: IconName.Plug, color: '#EC4899', order: 4 },
];
```

## Technical Approach

### 1. Tutorial Service

Extend or replace `LessonProjectsModel`:

```typescript
// packages/noodl-editor/src/editor/src/services/TutorialService.ts

class TutorialService {
  private static instance: TutorialService;
  
  // Data fetching
  async fetchTutorials(): Promise<Tutorial[]>;
  async getTutorialById(id: string): Promise<Tutorial | null>;
  
  // Progress
  getProgress(tutorialId: string): TutorialProgress;
  updateProgress(tutorialId: string, progress: Partial<TutorialProgress>): void;
  resetProgress(tutorialId: string): void;
  
  // Queries
  getInProgressTutorials(): Tutorial[];
  getCompletedTutorials(): Tutorial[];
  getTutorialsByCategory(categoryId: string): Tutorial[];
}
```

### 2. Component Structure

```
packages/noodl-core-ui/src/preview/launcher/Launcher/
├── views/
│   └── LearningCenter/
│       ├── LearningCenter.tsx        # Main view
│       ├── LearningCenter.module.scss
│       ├── ContinueLearning.tsx      # "Continue" section
│       ├── TutorialCategory.tsx      # Category section
│       └── TutorialFilters.tsx       # Filter bar
├── components/
│   ├── TutorialCard/
│   │   ├── TutorialCard.tsx          # Compact card
│   │   ├── TutorialCard.module.scss
│   │   └── index.ts
│   ├── TutorialDetailModal/
│   │   ├── TutorialDetailModal.tsx   # Expanded detail view
│   │   └── TutorialDetailModal.module.scss
│   ├── DifficultyBadge/
│   │   └── DifficultyBadge.tsx       # Beginner/Intermediate/Advanced
│   ├── ProgressRing/
│   │   └── ProgressRing.tsx          # Circular progress indicator
│   └── DurationLabel/
│       └── DurationLabel.tsx         # "15 min" display
```

### 3. Learning Center Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Learn                                          [🔍 Search...    ]   │
├─────────────────────────────────────────────────────────────────────┤
│ Filters: [All ▾] [All Difficulties ▾] [All Progress ▾] [Clear]     │
├─────────────────────────────────────────────────────────────────────┤
│ ⏸️ Continue Learning                                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📚 OpenNoodl Basics            47%  [●●●●●○○○○○]  [Continue →] │ │
│ │ Data-driven Components        12%  [●○○○○○○○○○]  [Continue →] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ 🚀 Getting Started                                            ▼    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │
│ │ AI Walkthru  │ │ Basics       │ │ Layout       │                 │
│ │ 🟢 Beginner  │ │ 🟢 Beginner  │ │ 🟢 Beginner  │                 │
│ │ 15 min       │ │ 15 min       │ │ 15 min       │                 │
│ │ ✓ Complete   │ │ ● 47%        │ │ ○ Not started│                 │
│ └──────────────┘ └──────────────┘ └──────────────┘                 │
├─────────────────────────────────────────────────────────────────────┤
│ 🎨 Building UIs                                               ▼    │
│ ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/TutorialService.ts`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/LearningCenter/LearningCenter.tsx`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/LearningCenter/LearningCenter.module.scss`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/LearningCenter/ContinueLearning.tsx`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/LearningCenter/TutorialCategory.tsx`
6. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/LearningCenter/TutorialFilters.tsx`
7. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/TutorialCard/TutorialCard.tsx`
8. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/TutorialCard/TutorialCard.module.scss`
9. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/TutorialDetailModal/TutorialDetailModal.tsx`
10. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/DifficultyBadge/DifficultyBadge.tsx`
11. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProgressRing/ProgressRing.tsx`
12. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/DurationLabel/DurationLabel.tsx`
13. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useTutorials.ts`

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/LearningCenter.tsx`
   - Replace empty component with full implementation
   - Move to folder structure

2. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Update import for LearningCenter

3. `packages/noodl-editor/src/editor/src/models/lessonprojectsmodel.ts`
   - Either extend or create adapter for new TutorialService

## Implementation Steps

### Phase 1: Data Layer
1. Create TutorialService
2. Define data types
3. Create useTutorials hook
4. Migrate existing lesson data structure

### Phase 2: Core Components
1. Create TutorialCard component
2. Create DifficultyBadge
3. Create ProgressRing
4. Create DurationLabel

### Phase 3: Main Layout
1. Build LearningCenter view
2. Create TutorialCategory sections
3. Add ContinueLearning section
4. Implement category collapse/expand

### Phase 4: Filtering
1. Create TutorialFilters component
2. Implement search
3. Implement filter dropdowns
4. Wire up filter state

### Phase 5: Detail View
1. Create TutorialDetailModal
2. Add start/continue/restart logic
3. Show objectives and prerequisites

### Phase 6: Polish
1. Add loading states
2. Add empty states
3. Smooth animations
4. Accessibility review

## Component Specifications

### TutorialCard

```
┌────────────────────────────┐
│ [📹]  OpenNoodl Basics     │  <- Type icon + Title
│ Learn the fundamentals     │  <- Description (truncated)
│ 🟢 Beginner  ⏱️ 15 min     │  <- Difficulty + Duration
│ [●●●●●○○○○○] 47%          │  <- Progress bar
└────────────────────────────┘
```

Props:
- `tutorial: Tutorial`
- `progress: TutorialProgress`
- `onClick: () => void`
- `variant?: 'compact' | 'expanded'`

### DifficultyBadge

| Level | Color | Icon |
|-------|-------|------|
| Beginner | Green (#22C55E) | 🟢 |
| Intermediate | Yellow (#EAB308) | 🟡 |
| Advanced | Red (#EF4444) | 🔴 |

### ProgressRing

Small circular progress indicator:
- Size: 24px
- Stroke width: 3px
- Background: gray
- Fill: green (completing), green (complete)
- Center: percentage or checkmark

## Compatibility Notes

### Existing Lesson System

The current system uses:
```typescript
// lessonprojectsmodel.ts
interface LessonTemplate {
  name: string;
  description: string;
  iconURL: string;
  templateURL: string;
  progress?: number;
}
```

The new system should:
1. Be backwards compatible with existing templates
2. Migrate progress data from old format
3. Support new enhanced metadata

### Migration Path

1. Keep `lessonprojectsmodel.ts` working during transition
2. Create adapter in TutorialService to read old data
3. Enhance existing tutorials with new metadata
4. Eventually deprecate old model

## Testing Checklist

- [ ] Tutorials load from docs endpoint
- [ ] Categories display correctly
- [ ] Category collapse/expand works
- [ ] Progress displays correctly
- [ ] Continue Learning section shows in-progress tutorials
- [ ] Search filters tutorials
- [ ] Difficulty filter works
- [ ] Progress filter works
- [ ] Clicking card shows detail modal
- [ ] Start Tutorial launches tutorial
- [ ] Continue Tutorial resumes from last point
- [ ] Restart Tutorial resets progress
- [ ] Progress persists across sessions
- [ ] Empty states display appropriately
- [ ] Responsive at different window sizes

## Dependencies

- DASH-001 (Tabbed Navigation System)

### External Dependencies

None - uses existing noodl-core-ui components.

## Blocked By

- DASH-001

## Blocks

- None

## Estimated Effort

- TutorialService: 2-3 hours
- TutorialCard components: 2-3 hours
- LearningCenter layout: 3-4 hours
- Filtering: 2-3 hours
- Detail modal: 2-3 hours
- Polish & testing: 2-3 hours
- **Total: 13-19 hours**

## Success Criteria

1. Tutorials are organized by category
2. Users can easily find tutorials by search/filter
3. Progress is clearly visible
4. "Continue Learning" helps users resume work
5. Tutorial cards are compact but informative
6. Detail modal provides all needed information
7. System is backwards compatible with existing tutorials

## Future Enhancements

- Video tutorial playback within app
- Community-contributed tutorials
- Tutorial recommendations based on usage
- Learning paths (curated sequences)
- Achievements/badges for completion
- Tutorial ratings/feedback

## Design Notes

The learning center should feel like:
- Duolingo's course browser (compact, progress-focused)
- Coursera's course catalog (categorized, searchable)
- VS Code's Getting Started (helpful, not overwhelming)

Prioritize getting users to relevant content quickly. The most common flow is:
1. See "Continue Learning" → resume last tutorial
2. Browse category → find new tutorial → start
3. Search for specific topic → find tutorial → start

Don't make users click through multiple screens to start learning.
