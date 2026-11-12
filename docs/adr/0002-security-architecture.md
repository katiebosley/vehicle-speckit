# ADR-0002: Security architecture — Google sign-in with server-side sessions

**Status:** Accepted
**Date:** 2026-11-08
**Deciders:** T2 Vehicles team

## Context

OC faculty, staff, and teams already have OC Google accounts. The starter kit shipped username/password auth (bcrypt + register screen), which would mean storing passwords and running our own account recovery. Feature 1 needs one role per user (admin, area admin, requestor) enforced on every API call.

## Decision

Sign in only with Google Identity Services. The frontend sends the Google ID token to `POST /login`; the backend verifies it with `google-auth-library` against `GOOGLE_CLIENT_ID`, allows only OC email domains, and issues our own JWT stored in a `sessions` row (24 hours, Bearer header). `authenticate` and `requireRole(...roles)` in `backend/app/authorization/authorization.js` guard every non-login route.

## Consequences

### Positive
- No passwords stored; OC's Google Workspace handles account security and recovery.
- Sessions can be revoked server-side (sign-out, deactivation) because tokens live in the database.
- Roles are checked on the server for every request, not just hidden in the UI.

### Negative / tradeoffs
- Local and deployed sign-in depend on a Google Cloud OAuth client and its authorized JavaScript origins.
- Automated tests must mock `verifyIdToken`; real Google sign-in is only verified manually.
- Allowed domains (`oc.edu`, `eagles.oc.edu`) are a code constant; changing them needs a deploy.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Username/password (starter kit) | Stores passwords; needs register and reset flows; duplicates OC accounts |
| Stateless JWT only (no sessions table) | Cannot revoke on sign-out or deactivation before expiry |
| Google OAuth authorization-code flow with client secret | Only identity is needed; the ID-token flow needs no secret on our server |

## Related artifacts

- Feature specs: [Feature 1](../../features/feature-1-google-auth-user-management.md)
- Cursor rules: [`security.mdc`](../../.cursor/rules/security.mdc), [`auth-patterns.mdc`](../../.cursor/rules/auth-patterns.mdc)
