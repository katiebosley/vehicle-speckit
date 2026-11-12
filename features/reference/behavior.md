# Behavior & Rules Reference

**Living snapshot** of product rules currently in force on `dev`.

These files answer: *"What rules does the app enforce right now?"*  
They do **not** authorize new scope — implement only from `features/feature-*.md`.

| File | Role |
|------|------|
| [api.md](./api.md) | Routes / payloads |
| [data-model.md](./data-model.md) | Tables / columns (+ target ERD) |
| **This file** | Ownership, sort, validation, UI rules |

## Sign-in & sessions — Feature 1

| Rule | Enforcement | Provenance |
|------|-------------|------------|
| Google Identity Services is the only sign-in; no passwords or register screen | `Login.vue`, `auth.controller.js` | FR-001 |
| Google ID token verified with `GOOGLE_CLIENT_ID` as audience; unset ID refuses all sign-ins | `auth.controller.js` | FR-002 |
| Only `oc.edu` and `eagles.oc.edu` emails may sign in | `auth.config.js` `allowedEmailDomains` | FR-003 (domain list chosen pending clarification) |
| Lookup order: `google_id`, then email (links seeded users); else create `requestor` | `auth.controller.js` | FR-004 |
| Sign-in never changes an existing user's role | `auth.controller.js` | FR-004 |
| Sessions last 24 hours; an unexpired session is reused | `auth.controller.js`, `auth.config.js` | FR-005 |
| Inactive users: `403` at login, `401` on existing sessions | `auth.controller.js`, `authenticate` | FR-006 |
| Frontend clears `localStorage` `user` and routes to login on any `401` | `services/services.js` | US-1.1 |

## Roles & access — Feature 1

| Rule | Enforcement | Provenance |
|------|-------------|------------|
| Roles: `admin`, `area_admin`, `requestor` | `user.model.js` `ROLES` | FR-008 |
| `authenticate` sets `req.user = { id, role, email }`; `requireRole(...roles)` returns `403` | `authorization/authorization.js` | FR-007 |
| `/users…` is admin-only (API `403`, route redirect to `home`) | `user.routes.js`, `router.js` `meta.roles` | FR-010, FR-011 |
| Signed-out users are redirected to `login`; signed-in users are redirected away from `login` | `router.js` `authGuard` | FR-010 |
| `MenuBar` on every route; Profile for all roles, Users for admin, nothing when signed out | `MenuBar.vue` | FR-009 |

## User management — Feature 1

| Rule | Enforcement | Provenance |
|------|-------------|------------|
| Users list ordered by last name, then first name | `user.controller.js` | FR-011 |
| Search: trimmed, case-insensitive, matches first name, last name, or email; blank returns all | `user.controller.js` | FR-011 |
| Admin edits only `role`, `isApprovedDriver`, `licenseExpiration`, `isActive`; other fields ignored | `user.controller.js` | FR-012 |
| Admin cannot change their own role or active status (UI disables those fields) | `user.controller.js`, `EditUserDialog.vue` | FR-013 |
| Approved drivers need a valid license date; turning approval off keeps the date; past dates allowed | `user.controller.js`, `EditUserDialog.vue` | FR-014 |
| No user create/delete; accounts appear on first sign-in | — | Out of scope |
| First admin: `npm run promote-admin --prefix backend -- <email>` | `app/scripts/promote-admin.js` | FR-016 |

## Profile — Feature 1

| Rule | Enforcement | Provenance |
|------|-------------|------------|
| Users read/write only their own profile | `profile.controller.js` uses `req.user.id` | FR-015 |
| Editable: first name, last name (required, ≤100), phone (optional, ≤20); other fields ignored | `profile.controller.js`, `Profile.vue` | FR-015 |
| Saving updates the stored `user` name so `MenuBar` shows it | `Profile.vue` `user-changed` event | US-1.8 |
