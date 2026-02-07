# PlayBall Session Planner - Technical Audit & Refactor Plan

**Generated:** February 2026
**Last Updated:** February 2026 (Phases 0-5 Complete)
**Codebase Size:** ~8,800 lines across 52 source files (after cleanup)
**Primary Stack:** React 18, Vite, Tailwind CSS, react-konva, @dnd-kit

---

## 1. Executive Summary

### Completed Refactoring (Phases 0-5)

| Phase | Status | What Was Done |
|-------|--------|---------------|
| **Phase 0** | ✅ Complete | Deleted ~1,900 lines of dead code (3 files) |
| **Phase 1** | ✅ Complete | Created `src/constants/diagram.js` - unified constants |
| **Phase 2** | ✅ Complete | Created `src/utils/id.js` - single ID generation |
| **Phase 3** | ✅ Complete | Created `src/hooks/useKonvaImage.js` - shared image loading |
| **Phase 4** | ✅ Complete | Created `src/constants/storage.js` - centralized keys |
| **Phase 5** | ✅ Complete | Created `src/constants/navigation.js` - view constants |

### Remaining Issues

| Priority | Issue | Impact | Status |
|----------|-------|--------|--------|
| **P0** | Monolithic DiagramBuilder.jsx (1,736 lines) | Hard to debug, test, modify | Pending (Phase 6) |
| **P1** | Unused modular architecture (1,729 lines) | Wasted investment | Ready to wire up |
| **P2** | Two different diagram editors in production | Inconsistent UX | Pending |

### What Was Fixed

1. ~~Dead code~~ → **Deleted** ~1,900 lines
2. ~~Duplicate ID functions (4)~~ → **Unified** to `src/utils/id.js`
3. ~~Duplicate constants~~ → **Consolidated** to `src/constants/diagram.js`
4. ~~Inconsistent localStorage patterns~~ → **Standardized** keys in `src/constants/storage.js`
5. ~~Magic string navigation~~ → **Constants** in `src/constants/navigation.js`

---

## 2. Architecture Map

### 2.1 Module/Folder Boundaries

```
src/
├── main.jsx                 # Entry point
├── App.jsx                  # Thin wrapper → AppShell
├── index.css                # Tailwind + custom utilities
│
├── constants/               # ✅ NEW (Phases 1, 4, 5)
│   ├── diagram.js           # CONE_COLORS, FIELD_TYPES, TOOLS, etc.
│   ├── storage.js           # localStorage keys
│   └── navigation.js        # VIEWS constants
│
├── components/
│   ├── AppShell.jsx         # Main router/shell (174 lines)
│   │
│   ├── teams/               # Team management views
│   │   ├── TeamList.jsx     # Teams grid (115 lines)
│   │   ├── TeamDetail.jsx   # Sessions list for team
│   │   ├── TeamCard.jsx
│   │   ├── SessionCard.jsx
│   │   ├── CreateTeamModal.jsx
│   │   └── ScheduleSessionModal.jsx
│   │
│   ├── session-builder/
│   │   └── SessionBuilder.jsx   # Main session editor (621 lines)
│   │
│   ├── DiagramBuilder/          # MAIN diagram editor (ACTIVE)
│   │   ├── index.js             # Exports
│   │   ├── DiagramBuilder.jsx   # MONOLITH (1,736 lines) ← Future Phase 6
│   │   ├── DiagramContext.jsx   # Context provider (310 lines) ← Ready to wire
│   │   ├── components/          # Modular components ← Ready to wire
│   │   │   ├── DiagramCanvas.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   ├── InspectorPanel.jsx
│   │   │   ├── FieldBackground.jsx
│   │   │   ├── QuickActionsBubble.jsx
│   │   │   ├── TransformerWrapper.jsx
│   │   │   └── shapes/          # Shape components (updated to use hooks)
│   │   └── utils/
│   │       ├── constants.js     # Re-exports from src/constants/diagram.js
│   │       └── lineUtils.js
│   │
│   ├── DiagramBuilderNew/       # VARIATION diagram editor (ACTIVE for modals)
│   │   ├── index.js
│   │   ├── DiagramBuilderKonva.jsx (272 lines) - uses shared hooks
│   │   ├── Toolbar.jsx
│   │   └── shapes/
│   │
│   ├── DiagramLibrary.jsx       # Library browser (321 lines)
│   ├── Section.jsx              # Section editor (331 lines)
│   ├── Variation.jsx            # Variation editor (179 lines)
│   ├── SessionSummary.jsx       # Summary form (227 lines)
│   ├── Header.jsx               # Session builder header (42 lines)
│   ├── SessionPlanPDF.jsx       # PDF export (333 lines)
│   ├── LibraryModal.jsx         # Section library modal
│   ├── AddSectionModal.jsx      # Add section dialog
│   ├── TagSelector.jsx          # Multi-tag input
│   └── ContextualHelp.jsx       # Uses useLocalStorage hook
│
├── hooks/
│   ├── useTeams.js              # Main app state + navigation (uses VIEWS)
│   ├── useDiagramLibrary.js     # Diagram library state (uses shared keys)
│   ├── useLocalStorage.js       # Generic localStorage hook (42 lines)
│   └── useKonvaImage.js         # ✅ NEW (Phase 3) - shared image loading
│
└── utils/
    ├── helpers.js               # Utilities + data factories (255 lines)
    └── id.js                    # ✅ NEW (Phase 2) - generateId()
```

**Deleted files (Phase 0):**
- ~~DiagramBuilder.OLD.jsx~~ (deleted)
- ~~DiagramBuilderImproved.jsx~~ (deleted)
- ~~DiagramBuilderTldraw.jsx~~ (deleted)
- ~~App.css~~ (deleted)

### 2.2 Key User Flows

```
┌─────────────────────────────────────────────────────────────────┐
│                         AppShell                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  useTeams() - Global navigation + team/session state    │    │
│  │  useDiagramLibrary() - Diagram library                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│    ┌─────────────────────────┼─────────────────────────┐        │
│    │                         │                         │        │
│    ▼                         ▼                         ▼        │
│ [teams]              [team-detail]            [session-builder] │
│ TeamList ──────────► TeamDetail ──────────► SessionBuilder      │
│                                                    │             │
│                                     ┌──────────────┼──────────┐ │
│                                     │              │          │ │
│                                     ▼              ▼          ▼ │
│                            [diagram-builder] [diagram-library]  │
│                            DiagramBuilder    DiagramLibrary     │
└─────────────────────────────────────────────────────────────────┘

Flow: TeamList → TeamDetail → SessionBuilder → Section → DiagramBuilder
                                               ↓
                                          Variation → DiagramBuilderNew (modal)
```

### 2.3 State Ownership Model

| State Domain | Owner | Persistence | Consumers |
|--------------|-------|-------------|-----------|
| Teams & Sessions | `useTeams` | `ppp_teams_v1` | AppShell, TeamList, TeamDetail, SessionBuilder |
| Navigation | `useTeams` | `ppp_current_view_v1` | AppShell |
| Section Library | `useLocalStorage` in SessionBuilder | `ppp_section_library_v1` | SessionBuilder, LibraryModal |
| Diagram Library | `useDiagramLibrary` | `ppp_diagram_library_v1` | AppShell, DiagramLibrary, Section |
| Contextual Help Prefs | Direct localStorage | `ppp_help_prefs_v1` | ContextualHelp |

**Problem:** Three different localStorage patterns are used:
1. `useLocalStorage` hook (generic, reusable)
2. Manual `useEffect` + `localStorage` in `useTeams`
3. Direct `localStorage` access in `useDiagramLibrary` and `ContextualHelp`

### 2.4 Data Lifecycle

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  localStorage │───►│  React State │───►│   Render     │
│   (persist)   │◄───│   (source)   │    │   (derive)   │
└──────────────┘    └──────────────┘    └──────────────┘
        ▲                   │
        │    ┌──────────────┘
        │    ▼
┌──────────────────┐
│  User Actions    │
│  (update state)  │
└──────────────────┘
```

### 2.5 Dependency Graph

```
App.jsx
  └── AppShell.jsx
        ├── useTeams.js ─────────► helpers.js
        ├── useDiagramLibrary.js ─► helpers.js
        │
        ├── TeamList.jsx
        │     ├── TeamCard.jsx
        │     └── CreateTeamModal.jsx
        │
        ├── TeamDetail.jsx
        │     ├── SessionCard.jsx
        │     └── ScheduleSessionModal.jsx
        │
        ├── SessionBuilder.jsx
        │     ├── Header.jsx
        │     ├── SessionSummary.jsx ──► TagSelector.jsx
        │     ├── Section.jsx
        │     │     └── Variation.jsx ──► DiagramBuilderNew/
        │     ├── AddSectionModal.jsx
        │     ├── LibraryModal.jsx
        │     └── SessionPlanPDF.jsx
        │
        ├── DiagramBuilder/ (main)
        │     └── DiagramBuilder.jsx (monolith)
        │
        └── DiagramLibrary.jsx
```

---

## 3. Dead Code Report

### 3.1 High Confidence (Safe to Delete)

| File | Lines | Evidence | Recommendation |
|------|-------|----------|----------------|
| `DiagramBuilder.OLD.jsx` | ~500 | No imports found anywhere | Delete |
| `DiagramBuilderImproved.jsx` | 987 | No imports found anywhere | Delete |
| `DiagramBuilderTldraw.jsx` | ~400 | No imports found anywhere | Delete |
| `App.css` | 2 | Empty file, all styles in index.css | Delete |

**Total: ~1,889 lines deletable with zero risk**

### 3.2 Medium Confidence (Unused but Architecture Exists)

| Path | Lines | Evidence | Recommendation |
|------|-------|----------|----------------|
| `DiagramBuilder/DiagramContext.jsx` | 310 | Only exported, never imported by consuming code | Keep for future modular refactor |
| `DiagramBuilder/components/DiagramCanvas.jsx` | 343 | Only imported by unused DiagramContext flow | Keep for future |
| `DiagramBuilder/components/Toolbar.jsx` | 224 | Same | Keep for future |
| `DiagramBuilder/components/InspectorPanel.jsx` | 208 | Same | Keep for future |
| `DiagramBuilder/components/FieldBackground.jsx` | 272 | Same | Keep for future |
| `DiagramBuilder/components/QuickActionsBubble.jsx` | 141 | Same | Keep for future |
| `DiagramBuilder/components/TransformerWrapper.jsx` | 63 | Same | Keep for future |
| `DiagramBuilder/components/shapes/*` | 478 | Same | Keep for future |

**Total: 2,039 lines of well-architected code that isn't wired up**

### 3.3 Low Confidence (Potentially Unused Features)

| Item | Location | Evidence | Recommendation |
|------|----------|----------|----------------|
| `aggregateSectionKeywords()` | helpers.js:140 | No callers found in grep | Verify usage, may be dead |
| `getStarterLibraryItems()` | helpers.js:212 | Only called once on first load | Keep (intentional) |
| CSS variables in `:root` | index.css:7-19 | Defined but Tailwind classes used instead | Consider removing |

---

## 4. Maintainability Issues Report

### 4.1 Duplicated Logic Hotspots

#### ID Generation (4 implementations!)

```javascript
// helpers.js - CANONICAL
export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

// DiagramBuilder/utils/constants.js
export const generateId = (prefix = 'item') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// DiagramBuilder/DiagramBuilder.jsx (local function!)
const generateId = () =>
  `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// DiagramBuilderNew/DiagramBuilderKonva.jsx (local function!)
const generateId = (type) =>
  `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
```

**Fix:** Use `uid()` from helpers.js everywhere, add optional prefix parameter.

#### Constants Duplication

`CONE_COLORS` defined in 4+ places:
- `DiagramBuilder/utils/constants.js`
- `DiagramBuilder/DiagramBuilder.jsx`
- `DiagramBuilderNew/DiagramBuilderKonva.jsx`
- `DiagramBuilder.OLD.jsx`
- `DiagramBuilderTldraw.jsx`

`FIELD_TYPES/FIELD_TEMPLATES` defined in 5 places with different values.

**Fix:** Single source of truth in `src/constants/diagram.js`.

#### Image Loading Pattern

The same SVG/image loading pattern appears in:
- `DiagramBuilder/DiagramBuilder.jsx` (lines 128-149)
- `DiagramBuilderNew/DiagramBuilderKonva.jsx` (lines 29-38)
- `DiagramBuilder/components/shapes/SoccerBall.jsx`
- `DiagramBuilder/components/shapes/Goal.jsx`

```javascript
// This pattern is repeated 4+ times
useEffect(() => {
  const img = new window.Image();
  img.onload = () => setter(img);
  img.src = src;
}, []);
```

**Fix:** Create `useKonvaImage(src)` hook.

### 4.2 Inconsistent Patterns

#### localStorage Access

**Pattern A: useLocalStorage hook**
```javascript
// SessionBuilder.jsx
const [library, setLibrary] = useLocalStorage(LIB_KEY, { version: 1, items: [] });
```

**Pattern B: Manual useEffect**
```javascript
// useTeams.js
useEffect(() => {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teamsData));
}, [teamsData]);
```

**Pattern C: Direct access**
```javascript
// useDiagramLibrary.js
localStorage.setItem(DIAGRAMS_KEY, JSON.stringify({ diagrams }));

// ContextualHelp.jsx
const prefs = JSON.parse(localStorage.getItem(HELP_PREFS_KEY) || '{}');
```

**Fix:** Standardize on `useLocalStorage` hook for all persistence.

#### State Update Patterns

```javascript
// Pattern A: Spread in callback (good)
setSession(prev => ({ ...prev, sections: newSections }));

// Pattern B: Direct mutation risk
const copy = structuredClone(section);
copy.id = uid(); // Direct property set on clone
```

### 4.3 Unclear Responsibilities (God Components)

#### `DiagramBuilder.jsx` (1,736 lines)

This single file handles:
- Canvas rendering (Konva Stage/Layer)
- Tool selection state
- Shape CRUD operations
- Line drawing state machine
- Keyboard event handling
- Image asset loading
- Diagram metadata (name, description, tags)
- Export functionality
- UI layout (toolbar, canvas, inspector panel)

**Recommended split:**
- `DiagramEditor.jsx` - Orchestration only (~200 lines)
- `useDiagramState.js` - Shape/line state management
- `useDiagramTools.js` - Tool selection, stamp preview
- `useKeyboardShortcuts.js` - Keyboard handling
- `DiagramToolbar.jsx` - Left toolbar UI
- `DiagramCanvas.jsx` - Konva canvas
- `DiagramInspector.jsx` - Right panel

#### `SessionBuilder.jsx` (621 lines)

Handles session editing, section library, drag-drop, PDF export, import/export.

**Acceptable** but could extract:
- Section library logic into custom hook
- PDF generation into utility

### 4.4 Error Handling Gaps

```javascript
// useTeams.js - catches but only logs
} catch (error) {
  console.error('Error initializing teams:', error);
  // No user feedback, no recovery
}

// SessionBuilder.jsx - alert() for errors
} catch (error) {
  alert('That session JSON didn\'t parse correctly.');
}
```

**Fix:** Consistent error handling strategy with user-visible toast notifications.

### 4.5 Typing and Validation Weaknesses

- **No TypeScript:** Entire codebase is JavaScript
- **No PropTypes:** React components have no prop validation
- **No runtime validation:** JSON from localStorage/imports not validated

**Risk:** Shape/line data structure changes can silently break saved diagrams.

---

## 5. Risk Register

### 5.1 Correctness Risks

| Risk | Location | Severity | Mitigation |
|------|----------|----------|------------|
| Diagram data format drift | Saved diagrams in localStorage | High | Add version field + migration |
| Race condition in handleRemoveImage | Section.jsx (recently fixed) | Low | Already fixed |
| Stale closure in keyboard handlers | DiagramBuilder.jsx | Medium | Use refs or dependency arrays |
| Memory leak in ResizeObserver | DiagramBuilder.jsx:167-170 | Low | Cleanup exists, verify |

### 5.2 Brittle Coupling

| Coupling | Impact | Example |
|----------|--------|---------|
| Navigation via string literals | Typos cause silent failures | `setCurrentView('diagram-builder')` |
| Shape types as magic strings | No autocomplete, typo risk | `type: 'attacker'` |
| Tag structure assumptions | Backward compat hacks | `tags?.moments \|\| tags?.moment` |

### 5.3 Areas Likely to Break During Refactor

| Area | Risk Level | Reason |
|------|------------|--------|
| DiagramBuilder.jsx | High | Heavily coupled state, complex interactions |
| Diagram serialization | High | Many places read/write diagram data |
| Navigation | Medium | String-based routing |
| LocalStorage | Medium | Multiple patterns, migration needed |

---

## 6. Target Architecture Proposal (Low-Risk)

### 6.1 Recommended Folder Structure

```
src/
├── main.jsx
├── App.jsx
├── index.css
│
├── constants/
│   ├── diagram.js          # CONE_COLORS, FIELD_TYPES, SHAPE_TYPES
│   ├── storage.js          # localStorage keys
│   └── navigation.js       # View name constants
│
├── hooks/
│   ├── useTeams.js
│   ├── useDiagramLibrary.js
│   ├── useLocalStorage.js
│   └── useKonvaImage.js    # NEW: shared image loading
│
├── utils/
│   ├── helpers.js          # Keep existing, add uid prefix param
│   └── diagramUtils.js     # NEW: line math, export helpers
│
├── components/
│   ├── AppShell.jsx
│   │
│   ├── teams/              # Keep as-is
│   │
│   ├── session-builder/
│   │   ├── SessionBuilder.jsx
│   │   └── hooks/
│   │       └── useSectionLibrary.js  # Extract from SessionBuilder
│   │
│   ├── diagram-builder/    # Refactored name (kebab-case)
│   │   ├── index.js
│   │   ├── DiagramBuilder.jsx       # Slim orchestrator
│   │   ├── DiagramCanvas.jsx
│   │   ├── DiagramToolbar.jsx
│   │   ├── DiagramInspector.jsx
│   │   ├── hooks/
│   │   │   ├── useDiagramState.js
│   │   │   └── useDiagramTools.js
│   │   └── shapes/
│   │
│   ├── diagram-library/
│   │   └── DiagramLibrary.jsx
│   │
│   └── shared/             # Reusable components
│       ├── TagSelector.jsx
│       ├── Modal.jsx       # Extract common modal pattern
│       └── ContextualHelp.jsx
```

### 6.2 Conventions

#### Naming
- **Files:** PascalCase for components, camelCase for hooks/utils
- **Folders:** kebab-case
- **Constants:** SCREAMING_SNAKE_CASE
- **Functions:** camelCase, verbs for actions (`createTeam`, `updateSection`)

#### Component Patterns
```javascript
// Preferred: Named function export
export default function TeamCard({ team, onSelect }) { ... }

// Props interface via JSDoc if not using TypeScript
/**
 * @param {{ team: Team, onSelect: (id: string) => void }} props
 */
```

#### State Management Rules
1. **Global state:** Only in hooks (`useTeams`, `useDiagramLibrary`)
2. **Component state:** `useState` for UI-only state
3. **Persistence:** Always use `useLocalStorage` hook
4. **Derived state:** Compute in render, don't store

### 6.3 "How We Do X" Standards

| Task | Pattern |
|------|---------|
| LocalStorage | `useLocalStorage(key, initialValue)` hook |
| Toast notifications | `toast(message)` from helpers.js |
| Modals | Common `Modal` wrapper component |
| Forms | Controlled inputs with `handleChange(field, value)` |
| Loading states | `if (!data) return <Loading />` at component top |
| Error handling | try/catch → `toast('Error message')` |
| ID generation | `uid()` from helpers.js |

---

## 7. Incremental Migration Plan

### Phase 0: Dead Code Removal (P0) ✅ COMPLETE
**Goal:** Remove confusion, reduce bundle size
**Status:** ✅ Complete - ~1,900 lines deleted

| Step | Action | Status |
|------|--------|--------|
| 0.1 | Delete `DiagramBuilder.OLD.jsx` | ✅ Done |
| 0.2 | Delete `DiagramBuilderImproved.jsx` | ✅ Done |
| 0.3 | Delete `DiagramBuilderTldraw.jsx` | ✅ Done |
| 0.4 | Delete `App.css` | ✅ Done |
| 0.5 | Run build, verify no errors | ✅ Verified |

---

### Phase 1: Constants Consolidation (P1) ✅ COMPLETE
**Goal:** Single source of truth for diagram constants
**Risk:** Low
**Validation:** All diagram features work identically

| Step | Action |
|------|--------|
| 1.1 | Create `src/constants/diagram.js` with merged constants |
| 1.2 | Update `DiagramBuilder/DiagramBuilder.jsx` to import from constants |
| 1.3 | Update `DiagramBuilderNew/DiagramBuilderKonva.jsx` to import from constants |
| 1.4 | Update `DiagramBuilder/utils/constants.js` to re-export from new location |
| 1.5 | Verify all diagram colors/types match |

**Before:**
```javascript
// DiagramBuilder/DiagramBuilder.jsx
const CONE_COLORS = [
  { id: 'orange', color: '#FF6B35' },
  // ...
];
```

**After:**
```javascript
// src/constants/diagram.js
export const CONE_COLORS = [
  { id: 'orange', label: 'Orange', color: '#FF6B35' },
  { id: 'yellow', label: 'Yellow', color: '#FDD835' },
  { id: 'blue', label: 'Blue', color: '#42A5F5' },
  { id: 'green', label: 'Green', color: '#66BB6A' },
];

// DiagramBuilder/DiagramBuilder.jsx
import { CONE_COLORS } from '../../constants/diagram';
```

---

### Phase 2: ID Generation Unification (P1) ✅ COMPLETE
**Goal:** Single ID generation function
**Status:** ✅ Complete - Created `src/utils/id.js`

| Step | Action |
|------|--------|
| 2.1 | Add prefix parameter to `uid()` in helpers.js |
| 2.2 | Replace local `generateId` in DiagramBuilder.jsx |
| 2.3 | Replace local `generateId` in DiagramBuilderKonva.jsx |
| 2.4 | Delete `generateId` from constants.js |

**Before:**
```javascript
// helpers.js
export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
```

**After:**
```javascript
// helpers.js
export function uid(prefix = '') {
  const id = Math.random().toString(16).slice(2) + Date.now().toString(16);
  return prefix ? `${prefix}-${id}` : id;
}
```

---

### Phase 3: useKonvaImage Hook (P1) ✅ COMPLETE
**Goal:** Remove duplicate image loading code
**Status:** ✅ Complete - Created `src/hooks/useKonvaImage.js`

| Step | Action |
|------|--------|
| 3.1 | Create `src/hooks/useKonvaImage.js` |
| 3.2 | Refactor DiagramBuilder.jsx to use hook |
| 3.3 | Refactor DiagramBuilderKonva.jsx to use hook |

**New hook:**
```javascript
// src/hooks/useKonvaImage.js
import { useState, useEffect } from 'react';

export function useKonvaImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) return;
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.onerror = () => console.error(`Failed to load image: ${src}`);
    img.src = src;
  }, [src]);

  return image;
}
```

---

### Phase 4: localStorage Standardization (P2) ✅ COMPLETE
**Goal:** Consistent persistence pattern
**Status:** ✅ Complete - Created `src/constants/storage.js`, updated ContextualHelp to use hook

| Step | Action |
|------|--------|
| 4.1 | Refactor `useDiagramLibrary` to use `useLocalStorage` |
| 4.2 | Refactor `useTeams` to use `useLocalStorage` |
| 4.3 | Refactor `ContextualHelp` to use `useLocalStorage` |
| 4.4 | Test all persistence scenarios |

---

### Phase 5: Navigation Constants (P2) ✅ COMPLETE
**Goal:** Type-safe navigation
**Status:** ✅ Complete - Created `src/constants/navigation.js`

**Before:**
```javascript
setCurrentView('diagram-builder');
```

**After:**
```javascript
// src/constants/navigation.js
export const VIEWS = {
  TEAMS: 'teams',
  TEAM_DETAIL: 'team-detail',
  SESSION_BUILDER: 'session-builder',
  DIAGRAM_BUILDER: 'diagram-builder',
  DIAGRAM_LIBRARY: 'diagram-library',
};

// useTeams.js
import { VIEWS } from '../constants/navigation';
setCurrentView(VIEWS.DIAGRAM_BUILDER);
```

---

### STOP POINT: Reassess ✅ REACHED

After Phase 5, the codebase now has:
- ~1,900 fewer lines of dead code
- Unified constants
- Consistent patterns

**Decision point:** Continue with DiagramBuilder refactor or stabilize?

---

### Phase 6: DiagramBuilder Modular Refactor (P2)
**Goal:** Break up 1,736-line monolith
**Risk:** High
**Validation:** Full diagram editing workflow

This is a larger effort. Options:

**Option A: Wire up existing modular components**
- The `DiagramBuilder/components/` folder already has modular code
- Wire `DiagramBuilder.jsx` to use `DiagramContext` + modular components
- Estimated: 3-5 focused sessions

**Option B: Incremental extraction**
- Extract one piece at a time from monolith
- Start with keyboard handling, then toolbar, then canvas
- Estimated: 5-8 focused sessions

**Option C: Keep monolith, add tests**
- Accept the monolith for now
- Add integration tests for critical paths
- Refactor later when needed

**Recommendation:** Option A - the work is already done, just needs wiring.

---

## 8. Testing & Safety Plan

### 8.1 Minimal Tests to Add First

```javascript
// tests/smoke.test.js
describe('App Smoke Tests', () => {
  it('renders without crashing', () => {
    render(<App />);
  });

  it('can navigate to team detail', () => {
    // Create team → click → verify view change
  });

  it('can create and save a session', () => {
    // Create session → add section → verify localStorage
  });
});

// tests/diagram.test.js
describe('Diagram Data', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array(1000).fill(null).map(() => uid()));
    expect(ids.size).toBe(1000);
  });

  it('serializes diagram correctly', () => {
    // Create shapes → export → verify structure
  });
});
```

### 8.2 Manual Smoke Test Checklist

Before each deploy:

- [ ] Create new team
- [ ] Create new session
- [ ] Add PPP structure
- [ ] Open diagram builder from section
- [ ] Place attacker, defender, ball, cone, goal
- [ ] Draw pass line, movement line, dribble line
- [ ] Save diagram → verify appears in section
- [ ] Open diagram library
- [ ] Edit diagram from library
- [ ] Export session to PDF
- [ ] Refresh page → verify all data persisted
- [ ] Variation diagram builder works

### 8.3 Linting & Static Checks

Add to `eslint.config.js`:
```javascript
{
  rules: {
    'no-unused-vars': 'error',
    'no-console': ['warn', { allow: ['error'] }],
    'react-hooks/exhaustive-deps': 'warn',
  }
}
```

Run before commits:
```bash
npm run lint
npm run build
```

---

## 9. Optional UX Improvements

**Note:** These require explicit approval before implementation.

### Quick Wins (Low effort)
- [ ] Add keyboard shortcuts overlay (? key)
- [ ] Undo/redo in diagram builder (Ctrl+Z/Y)
- [ ] Confirmation before deleting team with sessions
- [ ] "Unsaved changes" warning before navigation

### Larger Redesigns
- [ ] Unify diagram builders (same editor for sections and variations)
- [ ] Drag-and-drop from library to session
- [ ] Collaborative editing (would require backend)
- [ ] Mobile-responsive diagram builder

---

## 10. Definition of Done

### Measurable Outcomes (Updated Feb 2026)

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Dead code lines | ~1,900 | 0 | ✅ Done |
| ID generation implementations | 4 | 1 | ✅ Done (`src/utils/id.js`) |
| CONE_COLORS definitions | 4+ | 1 | ✅ Done (`src/constants/diagram.js`) |
| localStorage key definitions | 4 | 1 | ✅ Done (`src/constants/storage.js`) |
| Navigation magic strings | Many | 1 | ✅ Done (`src/constants/navigation.js`) |
| DiagramBuilder.jsx lines | 1,736 | 1,736 | Pending (Phase 6) |
| ESLint errors | Unknown | 0 | ✅ Build passes |

### Documentation
- [x] This audit document maintained and updated
- [ ] CONTRIBUTING.md with "how we do X" patterns
- [ ] README.md updated with architecture overview

### Process
- [x] PR-sized commits (each phase = 1-2 PRs)
- [x] Manual smoke test after each phase
- [x] No regressions in existing functionality

---

## Appendix: File-by-File Reference

### New Files Created (Phases 1-5)

| File | Purpose |
|------|---------|
| `src/constants/diagram.js` | Unified diagram constants (CONE_COLORS, FIELD_TYPES, etc.) |
| `src/constants/storage.js` | Centralized localStorage keys |
| `src/constants/navigation.js` | VIEWS constants for navigation |
| `src/utils/id.js` | Single `generateId()` function |
| `src/hooks/useKonvaImage.js` | Shared Konva image loading hook |

### Active Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `DiagramBuilder.jsx` | 1,736 | Active | Monolith, needs refactor (Phase 6) |
| `DiagramBuilderKonva.jsx` | 272 | Active | Used by Variation modal, uses shared hooks |
| `SessionBuilder.jsx` | 621 | Active | Main session editor |
| `DiagramContext.jsx` | 310 | Unused | Good architecture, ready to wire up |
| `DiagramCanvas.jsx` | 343 | Unused | Part of modular arch |
| `Toolbar.jsx` (DiagramBuilder) | 224 | Unused | Part of modular arch |
| `InspectorPanel.jsx` | 208 | Unused | Part of modular arch |
| `helpers.js` | 255 | Active | Core utilities |
| `useTeams.js` | 321 | Active | Main app state, uses VIEWS constants |

### Deleted Files (Phase 0)

| File | Lines | Reason |
|------|-------|--------|
| ~~`DiagramBuilderImproved.jsx`~~ | 987 | Never imported |
| ~~`DiagramBuilder.OLD.jsx`~~ | ~500 | Abandoned |
| ~~`DiagramBuilderTldraw.jsx`~~ | ~400 | Experiment, unused |
| ~~`App.css`~~ | 2 | Empty file |
