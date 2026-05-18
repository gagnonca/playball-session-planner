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

// Section (exercise) library - also used as LIB_KEY in SessionBuilder
export const SECTION_LIBRARY_KEY = 'ppp_section_library_v1';

// Session library
export const SESSION_LIBRARY_KEY = 'ppp_session_library_v1';

// Ids of auto-populated library items the coach has hidden from view.
// Source data (the section/session) is NOT deleted — just filtered out of the library.
export const LIBRARY_HIDDEN_KEY = 'ppp_library_hidden_v1';

// UI preferences
export const HELP_PREFS_KEY = 'ppp_help_preferences_v1';
export const SUMMARY_COLLAPSED_KEY = 'ppp_summary_collapsed_v1';

// Device sync and sharing
export const COACH_IDENTITY_KEY = 'ppp_coach_identity_v1';
export const SHARED_TEAMS_KEY = 'ppp_shared_teams_v1';
export const FOLLOWED_SHARES_KEY = 'ppp_followed_shares_v1';

// Account (stubbed — UI flow exists, real auth not yet wired).
// Shape: { email, signedInAt } | null
export const ACCOUNT_KEY = 'ppp_account_v1';

// AI Configuration (user's own OpenAI API key)
export const AI_CONFIG_KEY = 'ppp_ai_config_v1';

// Onboarding
export const HAS_SEEN_WELCOME_KEY = 'ppp_has_seen_welcome';

// Promotions
export const IOS_PROMO_DISMISSED_KEY = 'ppp_ios_promo_dismissed';

// Library — items the coach has pinned to the top of each tab.
// Shape: { sessions: string[], exercises: string[], diagrams: string[] }
// All ids are normalized to the group key (lowercased name) for sessions/exercises
// since the existing Library groups items by name; diagrams use the raw item id.
export const LIBRARY_PINS_KEY = 'ppp_library_pins_v1';
