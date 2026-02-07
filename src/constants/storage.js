/**
 * Centralized localStorage key definitions.
 * All storage keys should be defined here for consistency and discoverability.
 *
 * Naming convention: ppp_{feature}_{version}
 * - ppp = PlayBall Practice Planner
 * - feature = descriptive name
 * - version = v1, v2, etc. for migration support
 */

// Teams and sessions
export const TEAMS_KEY = 'ppp_teams_v1';
export const LEGACY_SESSION_KEY = 'ppp_session_builder_v2'; // Pre-teams migration key

// Navigation state
export const CURRENT_VIEW_KEY = 'ppp_current_view_v1';

// Diagram library
export const DIAGRAMS_KEY = 'ppp_diagram_library_v1';

// UI preferences
export const HELP_PREFS_KEY = 'ppp_help_preferences_v1';

// Device sync and sharing
export const COACH_IDENTITY_KEY = 'ppp_coach_identity_v1';
export const SHARED_TEAMS_KEY = 'ppp_shared_teams_v1';
