// Stream 0.5i: shared copy constants. Single source of truth so messaging
// stays consistent across surfaces (Profile, Goals, Reviewer Console, and
// future Ritual / Chat / Onboarding edit-action stubs).

/**
 * Used in [PRESENTATIONAL] snackbars where edit actions would write to DB
 * in production but are read-only for the portfolio demo. Reframes from
 * "we cut features" ("Coming in V2") to "this is intentional controlled
 * state" — reviewers exploring the build see scenario-mode framing rather
 * than missing-feature framing.
 *
 * Wording chosen for Phase 3 demo:
 *   - Names Priya specifically so reviewers know they're exploring a
 *     seeded scenario, not a real user account.
 *   - "changes aren't saved" is honest about what's happening (the tap
 *     registers, the write doesn't persist).
 *   - Avoids "V2" / "coming soon" framing.
 */
export const DEMO_MODE_MESSAGE = "Demo mode — changes aren't saved for Priya.";
