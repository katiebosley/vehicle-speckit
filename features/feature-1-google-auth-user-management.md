# Feature: Sign-in, Roles & User Management

**Feature ID:** 1
**Branch pattern:** `feature-1-google-auth-user-management`
**Status:** Draft
**Created:** 2026-11-02
**Input:** OC faculty, staff, and teams sign in to the vehicle scheduling app with their OC Google account. Every user has one role (admin, area admin, requestor) that controls which menus, pages, and API calls they can use. Admins manage users: search them, change roles, deactivate accounts, and mark approved drivers with a license expiration date. Every user can edit their own name and phone.


---

## User Stories

### US-1.1: Sign in with Google

**As** any user  
**I want to** sign in with my OC Google account  
**So that** I do not need a separate password for this app

**Priority:** P1  
**Independent test:** Click **Sign in with Google** on the login page with a valid OC account; land on `home` with `user` (including `role` and `token`) in `localStorage`  
**Acceptance scenarios:** see ### US-1.1 under Acceptance Criteria

### US-1.2: Create my account on first sign-in

**As a** first-time user  
**I want** a user record with the `requestor` role created the first time I sign in  
**So that** I can start making requests without an admin creating my account

**Priority:** P1  
**Independent test:** Sign in with a Google account that has no `users` row; a row is created with role `requestor`  
**Acceptance scenarios:** see ### US-1.2 under Acceptance Criteria

### US-1.3: Sign out

**As** any signed-in user  
**I want to** sign out  
**So that** no one else can use my account on a shared device

**Priority:** P1  
**Independent test:** Click **Sign out** in `MenuBar`; server session is invalidated, `localStorage` is cleared, and the login page is shown  
**Acceptance scenarios:** see ### US-1.3 under Acceptance Criteria

### US-1.4: Role-based menus and API access

**As** any signed-in user  
**I want** to see only the menus and pages my role allows, and have the API reject calls my role cannot make  
**So that** each role only uses the tools meant for it

**Priority:** P1  
**Independent test:** Sign in as a `requestor` — **Users** is hidden and `GET /vehicle/users` returns `403`; signed out — protected routes redirect to login and the API returns `401`  
**Acceptance scenarios:** see ### US-1.4 under Acceptance Criteria

### US-1.5: View and search users

**As an** admin  
**I want to** view and search all users  
**So that** I can find the account I need to manage

**Priority:** P1  
**Independent test:** Open **Users** as admin; all users are listed; typing in search narrows the list by name or email  
**Acceptance scenarios:** see ### US-1.5 under Acceptance Criteria

### US-1.6: Change a user's role and deactivate a user

**As an** admin  
**I want to** change a user's role (admin, area admin, requestor) and deactivate or reactivate a user  
**So that** people have the right access and former staff can no longer sign in

**Priority:** P1  
**Independent test:** Edit a user, change role to `area_admin`, save; the user's next API call uses the new role. Deactivate a user; their next sign-in is refused  
**Acceptance scenarios:** see ### US-1.6 under Acceptance Criteria

### US-1.7: Mark approved drivers

**As an** admin  
**I want to** mark a user as an approved driver and record their license expiration date  
**So that** only approved drivers with a valid license can be assigned to trips later

**Priority:** P1  
**Independent test:** Edit a user, check **Approved driver**, enter a license expiration date, save; the user shows as an approved driver in the list  
**Acceptance scenarios:** see ### US-1.7 under Acceptance Criteria

### US-1.8: View and edit my profile

**As** any signed-in user  
**I want to** view and edit my own profile (first name, last name, phone)  
**So that** area admins can see accurate contact information for me

**Priority:** P2  
**Independent test:** Open **Profile** from `MenuBar`, change phone, save; reload shows the new phone  
**Acceptance scenarios:** see ### US-1.8 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Users MUST sign in only with Google Identity Services. The frontend obtains a Google ID token (`credential`) and sends it to `POST /vehicle/login`. There MUST be no username/password login and no register screen or endpoint.
- **FR-002**: The backend MUST verify the ID token with `google-auth-library` (`OAuth2Client.verifyIdToken`) using the `GOOGLE_CLIENT_ID` environment variable as the audience. A missing, malformed, expired, or wrong-audience token MUST return `401` with `{ "message": "Google sign-in failed." }`.
- **FR-003**: Only OC Google accounts MAY sign in. A verified token whose email domain is not an allowed OC domain MUST return `403` with `{ "message": "Sign in with your OC Google account." }` and MUST NOT create a user.
- **FR-004**: On a verified sign-in the backend MUST find the user by `google_id`. If none matches, it MUST find the user by `email` (case-insensitive) and store the Google `sub` in `google_id` (links seeded users). If neither matches, it MUST create a user with `role` `requestor`, `is_approved_driver` `false`, `is_active` `true`, and `first_name` / `last_name` from the token's `given_name` / `family_name`. An existing user's `role` MUST NOT change on sign-in.
- **FR-005**: Sessions MUST use the **JWT + Session table** pattern: token stored server-side; client sends `Authorization: Bearer <token>`. Session lifetime MUST be **24 hours**. Login MUST reuse a non-expired session for the same user when one exists.
- **FR-006**: A user with `is_active` `false` MUST receive `403` with `{ "message": "Your account has been deactivated." }` on `POST /vehicle/login`. `authenticate` MUST reject the session of an inactive user with `401`.
- **FR-007**: `authenticate` MUST set `req.user = { id, role, email }` from the session's user. This feature MUST export `requireRole(...roles)` middleware from `backend/app/authorization/authorization.js`. It MUST run after `authenticate` and return `403` with `{ "message": "You do not have permission for this action." }` when `req.user.role` is not in `roles`.
- **FR-008**: `role` MUST be one of `admin`, `area_admin`, `requestor`. Any other value on `PUT /vehicle/users/:userId` MUST return `400` with `{ "message": "Role must be admin, area_admin, or requestor." }`.
- **FR-009**: `MenuBar` MUST be mounted in `App.vue` and visible on every route, including `login`. It MUST show the signed-in user's name, **Profile** (all roles), **Users** (role `admin` only), and **Sign out** when a session exists. With no session it MUST show no nav items and no **Sign out**. Items MUST be filtered by `user.role` from the `localStorage` `user` payload.
- **FR-010**: The Vue router MUST redirect to `login` for every route except `login` when there is no session, and MUST redirect a signed-in user away from `login` to `home`. A route marked with allowed roles (e.g. `users` → `admin`) MUST redirect a signed-in user whose role is not allowed to `home`.
- **FR-011**: `GET /vehicle/users` MUST require role `admin`. It MUST return all users ordered by `last_name`, then `first_name`. Optional query `search` MUST filter case-insensitively to users whose first name, last name, or email contains the trimmed search text.
- **FR-012**: `PUT /vehicle/users/:userId` MUST require role `admin` and MUST only change `role`, `isApprovedDriver`, `licenseExpiration`, and `isActive`. Any other fields in the body (name, email, phone, `googleId`) MUST be ignored. Unknown `userId` → `404` with `{ "message": "User with id=<id> not found." }`.
- **FR-013**: An admin MUST NOT change their own `role` or `isActive` through `PUT /vehicle/users/:userId`. Attempting it MUST return `400` with `{ "message": "You cannot change your own role or active status." }`.
- **FR-014**: When `isApprovedDriver` is `true`, `licenseExpiration` MUST be a valid date. Missing → `400` with `{ "message": "License expiration is required for approved drivers." }` (same text as the client message). Turning `isApprovedDriver` off MUST keep the stored `licenseExpiration`.
- **FR-015**: `GET /vehicle/profile` and `PUT /vehicle/profile` MUST require a session and MUST only read or write the signed-in user (`req.user.id`). `PUT` MUST only change `firstName`, `lastName`, and `phone`; `role`, `email`, `isApprovedDriver`, `licenseExpiration`, and `isActive` in the body MUST be ignored. `firstName` and `lastName` MUST be required, trimmed, and at most 100 characters. `phone` is optional, trimmed, at most 20 characters; too-long message: **"Phone must be 20 characters or fewer."**
- **FR-016**: This feature MUST provide `npm run promote-admin --prefix backend -- <email>` (script in `backend/app/scripts/`) that sets `role` to `admin` for an existing user with that email, and exits with a non-zero code and a clear message if no user has that email. This bootstraps the first admin before [Feature 2](feature-2-areas-area-admins-deploy.md) seed data exists.
- **FR-017**: API responses MUST NOT include `google_id`. User JSON uses camelCase keys (`firstName`, `lastName`, `isApprovedDriver`, `licenseExpiration`, `isActive`) mapped to the snake_case columns in **Data Model Requirements**.

---

## Assumptions


- The vehicle API mounts at `/vehicle/…` 
- A Google Cloud OAuth client exists. Backend reads `GOOGLE_CLIENT_ID` from `backend/.env`; frontend reads `VITE_GOOGLE_CLIENT_ID`. Both are the same client ID.
- `google-auth-library` is a new backend dependency. `security.mdc` and ADR-0002 describe username/password + bcrypt; they MUST be updated in the implementation PR to describe Google sign-in.
- Automated tests MUST NOT call Google. Backend tests mock `verifyIdToken`; frontend tests mock the Google Identity Services script and `authServices`.
- Sequelize models use `underscored: true` so JS attributes are camelCase and columns match the ERD's snake_case names.
- Area assignment for area admins is [Feature 2](feature-2-areas-area-admins-deploy.md). In this feature `area_admin` is only a role value.

## Edge Cases

- Google popup closed or cancelled → no API call; user stays on login with no error.
- Valid Google token for a non-OC domain → `403`; no user row created.
- Email in a different case than a seeded row (e.g. `JDoe@oc.edu` vs `jdoe@oc.edu`) → links to the existing row; no duplicate.
- Deactivated user with a still-valid session → next API call `401`; frontend clears session and redirects to login.
- Admin edits their own row → may change `isApprovedDriver` / `licenseExpiration`; role and active changes are refused (`400`).
- `search` that is empty or whitespace-only → returns all users.
- `licenseExpiration` in the past is accepted; Feature 5 (review and vehicle assignment) refuses expired drivers at assignment time.
- Non-integer `userId` (e.g. `/vehicle/users/abc`) → `404`.
- Profile `firstName` whitespace-only → client **"Required"**; API `400` `{ "message": "First name is required." }`.

## Success Criteria

- **SC-001**: Every Gherkin scenario in this feature has at least one automated test before merge.
- **SC-002**: In one manual pass a new OC user can sign in with Google, land on `home` as a `requestor`, edit their profile, and sign out.
- **SC-003**: An admin can find a user by search, make them an `area_admin`, mark them an approved driver with a license date, and deactivate them; the deactivated user cannot sign in.
- **SC-004**: A `requestor` and an `area_admin` cannot see **Users** and get `403` from every `/vehicle/users` endpoint.
- **SC-005**: `npm test` passes with backend auth/users/profile and frontend router/login/`MenuBar`/users/profile coverage.

---

## Data Ownership & Isolation

Each user owns their own profile. Only admins can see or change other users. Later features scope vehicles and requests by role and area using `req.user` from this feature.

| Rule               | Requirement                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Own profile**    | `GET` / `PUT /vehicle/profile` read and write only `req.user.id`. No `userId` parameter.                        |
| **Other users**    | Only `admin` may `GET` / `PUT /vehicle/users…`. Other roles → `403`.                                            |
| **Self-lockout**   | An admin cannot change their own `role` or `isActive` (`400`).                                                  |
| **Sensitive data** | `google_id` is never returned. There are no passwords.                                                          |
| **Implementation** | `authenticate` on every non-login endpoint; `requireRole("admin")` after `authenticate` on `/vehicle/users…`.   |

---

## API Requirements

| Method | Endpoint                 | Auth       | Purpose                                                      |
| ------ | ------------------------ | ---------- | ------------------------------------------------------------ |
| `POST` | `/vehicle/login`         | No         | Verify Google credential, find/create user, return session   |
| `POST` | `/vehicle/logout`        | Yes        | Invalidate current session token                             |
| `GET`  | `/vehicle/users`         | Yes, admin | List all users; optional `?search=`                          |
| `GET`  | `/vehicle/users/:userId` | Yes, admin | Fetch one user                                               |
| `PUT`  | `/vehicle/users/:userId` | Yes, admin | Change role, approved driver, license expiration, active     |
| `GET`  | `/vehicle/profile`       | Yes        | Fetch the signed-in user's profile                           |
| `PUT`  | `/vehicle/profile`       | Yes        | Update the signed-in user's first name, last name, phone     |

**Login request body:**

```json
{
  "credential": "<Google ID token>"
}
```

**Login success response** (`200`, flat JSON, no envelope):

```json
{
  "userId": 7,
  "email": "jdoe@oc.edu",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "requestor",
  "isApprovedDriver": false,
  "token": "<jwt>"
}
```

**Update user request body** (admin):

```json
{
  "role": "area_admin",
  "isApprovedDriver": true,
  "licenseExpiration": "2028-05-31",
  "isActive": true
}
```

**Update profile request body:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "405-555-0142"
}
```

**User success response** (`GET` / `PUT` users and profile, `200`):

```json
{
  "id": 7,
  "email": "jdoe@oc.edu",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "405-555-0142",
  "role": "area_admin",
  "isApprovedDriver": true,
  "licenseExpiration": "2028-05-31",
  "isActive": true,
  "createdAt": "2026-11-02T12:00:00.000Z",
  "updatedAt": "2026-11-02T12:00:00.000Z"
}
```

`GET /vehicle/users` returns an array of this object.

**Error response:** `{ "message": "Human-readable explanation." }` with appropriate HTTP status.

---

## Screen Requirements

### [View: Login] — route name `login` — path `/login` — `Login.vue`

- `MenuBar` visible (no nav items, no **Sign out**).
- Heading: **OC Vehicle Scheduling**
- One action: Google Identity Services rendered **Sign in with Google** button. No username/password fields and no register link.
- While `POST /vehicle/login` is in flight, show a progress indicator.
- Errors from the API (`401`, `403`) show in `<v-alert type="error">` with the API `message`.

### [View: Home] — route name `home` — path `/`

- Protected landing page for every role after sign-in.
- Shows **"Welcome, <firstName>"** and the user's role label (**Admin**, **Area Admin**, **Requestor**).
- Role-specific dashboard content is Feature 6 (calendar, trip logs, dashboard); this feature ships the placeholder only.

### [View: Users] — route name `users` — path `/users` — `Users.vue`

- Heading: **Users**. Admin-only route (FR-010).
- Search field (`v-text-field`, label **Search users**) filters by name or email via `GET /vehicle/users?search=`.
- List: `v-table`; columns **name** (last, first), **email**, **role**, **approved driver** (Yes/No), **license expires**, **status** (Active/Inactive); ordered by last name, first name.
- Icon-only row action, `size="small"`, `aria-label` **Edit user**, opens **Edit User** dialog.
- No **+ New user** — accounts are created on first sign-in.
- **Empty state:** **"No users match your search."** when search returns nothing.
- **Loading state:** progress indicator while fetching. **Error state:** `<v-alert type="error">`.

### [View: Edit User] — dialog on Users

- Title: **Edit User**
- Read-only: **Name**, **Email**, **Phone**.
- Editable: **Role** (`v-select`: Admin, Area Admin, Requestor), **Approved driver** (`v-checkbox`), **License expiration** (date field; required when **Approved driver** is checked — **"License expiration is required for approved drivers."**), **Active** (`v-switch`).
- When editing their own row, the admin sees **Role** and **Active** disabled.
- Actions: **Save** (`oc-cta`) / **Cancel** (secondary). Invalid input does not call the API. Server errors in `<v-alert type="error">`. On success the dialog closes and the row updates.

### [View: Profile] — route name `profile` — path `/profile` — `Profile.vue`

- Heading: **My Profile**
- Editable: **First Name**, **Last Name** (required, **"Required"**), **Phone** (optional, max 20).
- Read-only: **Email**, **Role**, **Approved driver**, **License expires**.
- Action: **Save** (`oc-cta`). On success, show a success `<v-alert>` and update the `localStorage` `user` name so `MenuBar` shows the new name.

**App chrome**

- Mount `MenuBar` in `App.vue` above `<v-main>`. Visible on every route.
- No session: no nav items, no **Sign out**.
- Session: user's name, **Profile** (all roles), **Users** (`admin`), **Sign out**.
- **Sign out** calls `POST /vehicle/logout`, calls `google.accounts.id.disableAutoSelect()`, clears `localStorage` `user`, and routes to `login`.
- Later features add items by role (Feature 2 adds **Areas** for `admin` and **My Areas** for `area_admin`). They MUST NOT create a second `MenuBar`.

---

## Key Entities

- **User**: an OC person identified by their Google account. Has one role (admin, area admin, requestor), contact info, an approved-driver flag with license expiration, and an active flag. Owns their profile; later makes requests (Feature 4) and may be assigned as a driver (Feature 5).
- **Session**: server-side record tying a JWT token to a user; expires after 24 hours.

---

## Data Model Requirements

Team ERD (target model for all features): [`docs/erd/vehicle-scheduling-erd.png`](../docs/erd/vehicle-scheduling-erd.png). Shipped schema: [`features/reference/data-model.md`](reference/data-model.md).

### `users` table

| Column                | Type                                       | Rules                                               |
| --------------------- | ------------------------------------------ | --------------------------------------------------- |
| `id`                  | INTEGER PK                                 | Auto-increment                                      |
| `google_id`           | STRING(255)                                | Unique; nullable until first sign-in (seeded users) |
| `email`               | STRING(255)                                | Required, unique; stored lowercase                  |
| `first_name`          | STRING(100)                                | Required; trimmed                                   |
| `last_name`           | STRING(100)                                | Required; trimmed                                   |
| `phone`               | STRING(20)                                 | Optional                                            |
| `role`                | ENUM(`admin`, `area_admin`, `requestor`)   | Required; default `requestor`                       |
| `is_approved_driver`  | BOOLEAN                                    | Default `false`                                     |
| `license_expiration`  | DATEONLY                                   | Optional; required when `is_approved_driver` true   |
| `is_active`           | BOOLEAN                                    | Default `true`                                      |
| `created_at`          | DATE                                       | Sequelize timestamps                                |
| `updated_at`          | DATE                                       | Sequelize timestamps                                |

`defaultScope` excludes `google_id`. No `username` or `password` columns.

### `sessions` table

| Column            | Type       | Rules                           |
| ----------------- | ---------- | ------------------------------- |
| `id`              | INTEGER PK | Auto-increment                  |
| `token`           | STRING     | Required                        |
| `email`           | STRING     | Required                        |
| `expiration_date` | DATE       | Required                        |
| `user_id`         | INTEGER FK | Required, references `users.id` |

### Associations (in `models/index.js`)

- `Session belongsTo User` (`userId`, alias `user`)
- `User hasMany Session`

---

## Acceptance Criteria (Gherkin)

### US-1.1 — Sign in with Google

#### Scenario: User signs in with a valid OC Google account

- **Given** a user exists with email `jdoe@oc.edu` and role `requestor`
- **And** I am on the login page
- **When** I complete **Sign in with Google** as `jdoe@oc.edu`
- **Then** the API returns `200` with `userId`, `email`, `firstName`, `lastName`, `role`, and `token`
- **And** a session row is created or reused in the database
- **And** I am redirected to the home page
- **And** my session is stored in `localStorage` under the key `user`

#### Scenario: User signs in with a non-OC Google account

- **Given** I am on the login page
- **When** I send `POST /vehicle/login` with a valid Google credential for `someone@gmail.com`
- **Then** the API returns `403` with `{ "message": "Sign in with your OC Google account." }`
- **And** no user row is created for `someone@gmail.com`

#### Scenario: User signs in with an invalid Google credential

- **Given** I am on the login page
- **When** I send `POST /vehicle/login` with a credential that fails Google verification
- **Then** the API returns `401` with `{ "message": "Google sign-in failed." }`
- **And** the error is displayed in a `<v-alert type="error">`

#### Scenario: Deactivated user cannot sign in

- **Given** a user exists with email `former@oc.edu` and `isActive` `false`
- **When** I send `POST /vehicle/login` with a valid Google credential for `former@oc.edu`
- **Then** the API returns `403` with `{ "message": "Your account has been deactivated." }`
- **And** no session is created

#### Scenario: Signed-in user visits login page

- **Given** I have a valid session in `localStorage`
- **When** I navigate to the login page
- **Then** I am redirected to the home page

#### Scenario: API request includes session token

- **Given** I am signed in as a user with role `requestor`
- **When** the frontend makes an authenticated API request
- **Then** the request includes header `Authorization: Bearer <token>`

#### Scenario: Expired or invalid session token

- **Given** I am signed in as a user with role `requestor`
- **And** my session token is expired or revoked
- **When** the frontend makes an authenticated API request
- **Then** the API returns `401` with an unauthorized message
- **And** `localStorage` key `user` is cleared
- **And** I am redirected to the login page

---

### US-1.2 — Create my account on first sign-in

#### Scenario: First-time user gets a requestor account

- **Given** no user exists with email `newuser@oc.edu`
- **When** I send `POST /vehicle/login` with a valid Google credential for `newuser@oc.edu` with given name `New` and family name `User`
- **Then** the API returns `200` with `role` `requestor`
- **And** a user row exists with email `newuser@oc.edu`, `first_name` `New`, `last_name` `User`, `is_approved_driver` `false`, `is_active` `true`, and the Google `sub` in `google_id`

#### Scenario: Seeded user is linked on first Google sign-in

- **Given** a user exists with email `areaadmin@oc.edu`, role `area_admin`, and no `google_id`
- **When** I send `POST /vehicle/login` with a valid Google credential for `AreaAdmin@oc.edu`
- **Then** the API returns `200` with `role` `area_admin`
- **And** that user's `google_id` is set to the Google `sub`
- **And** only one user row exists with email `areaadmin@oc.edu`

#### Scenario: Returning user keeps their role

- **Given** a user exists with role `admin` and a stored `google_id`
- **When** that user signs in with Google again
- **Then** the API returns `200` with `role` `admin`
- **And** the user's role in the database is still `admin`

---

### US-1.3 — Sign out

#### Scenario: User signs out

- **Given** I am signed in as a user with role `requestor`
- **And** I am on the home page
- **When** I click **Sign out** in the `MenuBar`
- **Then** the API invalidates my session token on the server
- **And** `localStorage` key `user` is removed
- **And** I am redirected to the login page
- **And** `MenuBar` is still visible
- **And** **Sign out** is not shown

---

### US-1.4 — Role-based menus and API access

#### Scenario: Unauthenticated user accesses a protected route

- **Given** I have no session in `localStorage`
- **When** I navigate directly to the home page
- **Then** I am redirected to the login page

#### Scenario: Unauthenticated API request

- **Given** I have no valid session token
- **When** I request `GET /vehicle/profile`
- **Then** the API returns `401` with an unauthorized message

#### Scenario: MenuBar is visible on the login page without nav items

- **Given** I have no session in `localStorage`
- **When** I am on the login page
- **Then** the `MenuBar` is displayed
- **And** **Profile**, **Users**, and **Sign out** are not shown

#### Scenario: Requestor does not see admin-only menu items

- **Given** I am signed in as a user with role `requestor`
- **When** I view the `MenuBar`
- **Then** **Profile** and **Sign out** are shown
- **And** **Users** is not shown

#### Scenario: Admin sees Users in the menu

- **Given** I am signed in as a user with role `admin`
- **When** I view the `MenuBar`
- **Then** **Users**, **Profile**, and **Sign out** are shown

#### Scenario: Requestor navigates to an admin-only route

- **Given** I am signed in as a user with role `requestor`
- **When** I navigate directly to `/users`
- **Then** I am redirected to the home page

#### Scenario: Requestor cannot call an admin-only API

- **Given** I am signed in as a user with role `requestor`
- **When** I request `GET /vehicle/users`
- **Then** the API returns `403` with `{ "message": "You do not have permission for this action." }`

#### Scenario: Area admin cannot call an admin-only API

- **Given** I am signed in as a user with role `area_admin`
- **When** I send `PUT /vehicle/users/2` with `{ "role": "admin" }`
- **Then** the API returns `403` with `{ "message": "You do not have permission for this action." }`
- **And** user `2`'s role is unchanged

#### Scenario: Deactivated user's existing session is rejected

- **Given** I am signed in as a user with role `requestor`
- **And** an admin has since set my `isActive` to `false`
- **When** I request `GET /vehicle/profile` with my existing token
- **Then** the API returns `401` with an unauthorized message

---

### US-1.5 — View and search users

#### Scenario: Menu Selection

- **Given** I am signed in as a user with role `admin`
- **When** I click **Users** in the `MenuBar`
- **Then** the users view is displayed

#### Scenario: Admin views all users

- **Given** I am signed in as a user with role `admin`
- **And** users `Ann Smith`, `Bob Jones`, and `Cal Adams` exist
- **When** I open the users view
- **Then** all three users are listed with name, email, role, approved driver, license expires, and status
- **And** they are ordered by last name: `Adams`, `Jones`, `Smith`

#### Scenario: Admin searches users by name or email

- **Given** I am signed in as a user with role `admin`
- **And** users `Ann Smith` (`asmith@oc.edu`) and `Bob Jones` (`bjones@oc.edu`) exist
- **When** I search users for `SMI`
- **Then** the API is called with `search=SMI`
- **And** only `Ann Smith` is listed

#### Scenario: Search with no matches shows empty copy

- **Given** I am signed in as a user with role `admin`
- **When** I search users for `zzzz`
- **Then** I see **"No users match your search."**

---

### US-1.6 — Change a user's role and deactivate a user

#### Scenario: Admin changes a user's role

- **Given** I am signed in as a user with role `admin`
- **And** user `Bob Jones` has role `requestor`
- **When** I open **Edit User** for `Bob Jones`, select role **Area Admin**, and click **Save**
- **Then** the API returns `200` with `role` `area_admin`
- **And** the dialog closes and the row shows **Area Admin**
- **And** Bob's next authenticated request has `req.user.role` `area_admin`

#### Scenario: Admin sets an invalid role

- **Given** I am signed in as a user with role `admin`
- **When** I send `PUT /vehicle/users/2` with `{ "role": "superuser" }`
- **Then** the API returns `400` with `{ "message": "Role must be admin, area_admin, or requestor." }`
- **And** user `2`'s role is unchanged

#### Scenario: Admin deactivates a user

- **Given** I am signed in as a user with role `admin`
- **And** user `Bob Jones` is active
- **When** I open **Edit User** for `Bob Jones`, turn **Active** off, and click **Save**
- **Then** the API returns `200` with `isActive` `false`
- **And** the row shows **Inactive**
- **And** Bob's next `POST /vehicle/login` returns `403` with `{ "message": "Your account has been deactivated." }`

#### Scenario: Admin reactivates a user

- **Given** I am signed in as a user with role `admin`
- **And** user `Bob Jones` is inactive
- **When** I send `PUT /vehicle/users/:userId` for Bob with `{ "isActive": true }`
- **Then** the API returns `200` with `isActive` `true`
- **And** Bob can sign in again

#### Scenario: Admin cannot change their own role or active status

- **Given** I am signed in as a user with role `admin`
- **When** I send `PUT /vehicle/users/:userId` for my own id with `{ "role": "requestor" }`
- **Then** the API returns `400` with `{ "message": "You cannot change your own role or active status." }`
- **And** my role is still `admin`

#### Scenario: Admin edits a user that does not exist

- **Given** I am signed in as a user with role `admin`
- **When** I send `PUT /vehicle/users/99999` with `{ "role": "requestor" }`
- **Then** the API returns `404` with `{ "message": "User with id=99999 not found." }`

#### Scenario: Admin cancels editing a user

- **Given** I am signed in as a user with role `admin`
- **And** the **Edit User** dialog is open for `Bob Jones`
- **When** I change the role and click **Cancel**
- **Then** no API request is sent
- **And** the dialog closes and the row is unchanged

---

### US-1.7 — Mark approved drivers

#### Scenario: Admin marks a user as an approved driver

- **Given** I am signed in as a user with role `admin`
- **When** I open **Edit User** for `Bob Jones`, check **Approved driver**, enter license expiration `2028-05-31`, and click **Save**
- **Then** the API returns `200` with `isApprovedDriver` `true` and `licenseExpiration` `2028-05-31`
- **And** the row shows approved driver **Yes** and license expires `2028-05-31`

#### Scenario: Admin marks an approved driver without a license expiration

- **Given** I am signed in as a user with role `admin`
- **And** the **Edit User** dialog is open
- **When** I check **Approved driver**, leave license expiration empty, and click **Save**
- **Then** inline validation blocks the request
- **And** I see the message **"License expiration is required for approved drivers."**
- **And** no API request is sent

#### Scenario: API rejects an approved driver without a license expiration

- **Given** I am signed in as a user with role `admin`
- **When** I send `PUT /vehicle/users/2` with `{ "isApprovedDriver": true, "licenseExpiration": null }`
- **Then** the API returns `400` with `{ "message": "License expiration is required for approved drivers." }`

#### Scenario: Admin removes approved driver status

- **Given** I am signed in as a user with role `admin`
- **And** `Bob Jones` is an approved driver with license expiration `2028-05-31`
- **When** I send `PUT /vehicle/users/:userId` for Bob with `{ "isApprovedDriver": false }`
- **Then** the API returns `200` with `isApprovedDriver` `false`
- **And** `licenseExpiration` is still `2028-05-31`

---

### US-1.8 — View and edit my profile

#### Scenario: User opens their profile

- **Given** I am signed in as a user with role `requestor`
- **When** I click **Profile** in the `MenuBar`
- **Then** the profile view shows my first name, last name, phone, email, and role
- **And** email and role are read-only

#### Scenario: User updates their name and phone

- **Given** I am signed in as a user with role `requestor`
- **And** I am on the profile view
- **When** I change first name to `Janet` and phone to `405-555-0199` and click **Save**
- **Then** the API returns `200` with `firstName` `Janet` and `phone` `405-555-0199`
- **And** the `MenuBar` shows `Janet`

#### Scenario: User saves profile with a missing first name

- **Given** I am signed in as a user with role `requestor`
- **And** I am on the profile view
- **When** I clear first name and click **Save**
- **Then** no API request is sent
- **And** I see the message **"Required"**

#### Scenario: User saves profile with a phone that is too long

- **Given** I am signed in as a user with role `requestor`
- **And** I am on the profile view
- **When** I enter a phone of 21 characters and click **Save**
- **Then** no API request is sent
- **And** I see the message **"Phone must be 20 characters or fewer."**

#### Scenario: User cannot change their own role through the profile

- **Given** I am signed in as a user with role `requestor`
- **When** I send `PUT /vehicle/profile` with `{ "firstName": "Jane", "lastName": "Doe", "role": "admin" }`
- **Then** the API returns `200` with `role` `requestor`
- **And** my role in the database is still `requestor`

---

## Test Coverage Map

Each scenario above must map to at least one automated test.

| Story  | Scenario                                                 | Test file                                                             | Test name                                                  |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| US-1.1 | User signs in with a valid OC Google account             | `backend/tests/auth.test.js`, `frontend/tests/Login.test.js`          | `User signs in with a valid OC Google account`             |
| US-1.1 | User signs in with a non-OC Google account               | `backend/tests/auth.test.js`                                          | `User signs in with a non-OC Google account`               |
| US-1.1 | User signs in with an invalid Google credential          | `backend/tests/auth.test.js`, `frontend/tests/Login.test.js`          | `User signs in with an invalid Google credential`          |
| US-1.1 | Deactivated user cannot sign in                          | `backend/tests/auth.test.js`                                          | `Deactivated user cannot sign in`                          |
| US-1.1 | Signed-in user visits login page                         | `frontend/tests/router.test.js`                                       | `Signed-in user visits login page`                         |
| US-1.1 | API request includes session token                       | `backend/tests/authenticate.test.js`, `frontend/tests/services.test.js` | `API request includes session token`                     |
| US-1.1 | Expired or invalid session token                         | `backend/tests/authenticate.test.js`, `frontend/tests/services.test.js` | `Expired or invalid session token`                       |
| US-1.2 | First-time user gets a requestor account                 | `backend/tests/auth.test.js`                                          | `First-time user gets a requestor account`                 |
| US-1.2 | Seeded user is linked on first Google sign-in            | `backend/tests/auth.test.js`                                          | `Seeded user is linked on first Google sign-in`            |
| US-1.2 | Returning user keeps their role                          | `backend/tests/auth.test.js`                                          | `Returning user keeps their role`                          |
| US-1.3 | User signs out                                           | `backend/tests/auth.test.js`, `frontend/tests/MenuBar.test.js`        | `User signs out`                                           |
| US-1.4 | Unauthenticated user accesses a protected route          | `frontend/tests/router.test.js`                                       | `Unauthenticated user accesses a protected route`          |
| US-1.4 | Unauthenticated API request                              | `backend/tests/authenticate.test.js`                                  | `Unauthenticated API request`                              |
| US-1.4 | MenuBar is visible on the login page without nav items   | `frontend/tests/MenuBar.test.js`                                      | `MenuBar is visible on the login page without nav items`   |
| US-1.4 | Requestor does not see admin-only menu items             | `frontend/tests/MenuBar.test.js`                                      | `Requestor does not see admin-only menu items`             |
| US-1.4 | Admin sees Users in the menu                             | `frontend/tests/MenuBar.test.js`                                      | `Admin sees Users in the menu`                             |
| US-1.4 | Requestor navigates to an admin-only route               | `frontend/tests/router.test.js`                                       | `Requestor navigates to an admin-only route`               |
| US-1.4 | Requestor cannot call an admin-only API                  | `backend/tests/users.test.js`                                         | `Requestor cannot call an admin-only API`                  |
| US-1.4 | Area admin cannot call an admin-only API                 | `backend/tests/users.test.js`                                         | `Area admin cannot call an admin-only API`                 |
| US-1.4 | Deactivated user's existing session is rejected          | `backend/tests/authenticate.test.js`                                  | `Deactivated user's existing session is rejected`          |
| US-1.5 | Menu Selection                                           | `frontend/tests/MenuBar.test.js`, `frontend/tests/Users.test.js`      | `Menu Selection`                                           |
| US-1.5 | Admin views all users                                    | `backend/tests/users.test.js`, `frontend/tests/Users.test.js`         | `Admin views all users`                                    |
| US-1.5 | Admin searches users by name or email                    | `backend/tests/users.test.js`, `frontend/tests/Users.test.js`         | `Admin searches users by name or email`                    |
| US-1.5 | Search with no matches shows empty copy                  | `frontend/tests/Users.test.js`                                        | `Search with no matches shows empty copy`                  |
| US-1.6 | Admin changes a user's role                              | `backend/tests/users.test.js`, `frontend/tests/Users.test.js`         | `Admin changes a user's role`                              |
| US-1.6 | Admin sets an invalid role                               | `backend/tests/users.test.js`                                         | `Admin sets an invalid role`                               |
| US-1.6 | Admin deactivates a user                                 | `backend/tests/users.test.js`, `frontend/tests/Users.test.js`         | `Admin deactivates a user`                                 |
| US-1.6 | Admin reactivates a user                                 | `backend/tests/users.test.js`                                         | `Admin reactivates a user`                                 |
| US-1.6 | Admin cannot change their own role or active status      | `backend/tests/users.test.js`                                         | `Admin cannot change their own role or active status`      |
| US-1.6 | Admin edits a user that does not exist                   | `backend/tests/users.test.js`                                         | `Admin edits a user that does not exist`                   |
| US-1.6 | Admin cancels editing a user                             | `frontend/tests/Users.test.js`                                        | `Admin cancels editing a user`                             |
| US-1.7 | Admin marks a user as an approved driver                 | `backend/tests/users.test.js`, `frontend/tests/Users.test.js`         | `Admin marks a user as an approved driver`                 |
| US-1.7 | Admin marks an approved driver without a license expiration | `frontend/tests/Users.test.js`                                     | `Admin marks an approved driver without a license expiration` |
| US-1.7 | API rejects an approved driver without a license expiration | `backend/tests/users.test.js`                                      | `API rejects an approved driver without a license expiration` |
| US-1.7 | Admin removes approved driver status                     | `backend/tests/users.test.js`                                         | `Admin removes approved driver status`                     |
| US-1.8 | User opens their profile                                 | `frontend/tests/Profile.test.js`                                      | `User opens their profile`                                 |
| US-1.8 | User updates their name and phone                        | `backend/tests/profile.test.js`, `frontend/tests/Profile.test.js`     | `User updates their name and phone`                        |
| US-1.8 | User saves profile with a missing first name             | `frontend/tests/Profile.test.js`                                      | `User saves profile with a missing first name`             |
| US-1.8 | User saves profile with a phone that is too long         | `frontend/tests/Profile.test.js`                                      | `User saves profile with a phone that is too long`         |
| US-1.8 | User cannot change their own role through the profile    | `backend/tests/profile.test.js`                                       | `User cannot change their own role through the profile`    |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 1 from @features/feature-1-google-auth-user-management.md on branch `feature/1-google-auth-user-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Update @.cursor/rules/security.mdc and ADR-0002 to describe Google sign-in instead of username/password.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `features/reference/data-model.md`, `features/reference/api.md`, `features/reference/behavior.md`

---

## Definition of Done

- [x] Backend and frontend implemented per this spec (**FR-00N** satisfied)
- [ ] **Success Criteria (SC-00N)** met
- [x] All mapped tests pass (`npm test`)
- [x] Test Coverage Map complete
- [x] `features/reference/data-model.md` updated (if schema changed)
- [x] `features/reference/api.md` updated (if API changed)
- [x] `features/reference/behavior.md` updated (if product rules changed)
- [x] `.cursor/rules/security.mdc` and ADR-0002 describe Google sign-in

---

## Out of Scope

- Username/password login, registration, and password reset
- Admin creating or deleting users (accounts are created on first sign-in; admins deactivate instead of deleting)
- Areas and assigning area admins to areas ([Feature 2](feature-2-areas-area-admins-deploy.md))
- Seed data and the AWS deploy workflow ([Feature 2](feature-2-areas-area-admins-deploy.md))
- Refusing expired-license drivers at assignment time (Feature 5 — review and vehicle assignment)
- Role-specific home dashboards (Feature 6 — calendar, trip logs, dashboard)
- Email notifications on status changes
- Maintenance-person role (mentioned in North's interview notes; not one of the three spec roles)

---

## Delivered to Feature 2

- `authenticate` sets `req.user = { id, role, email }`; `requireRole(...roles)` is exported from `backend/app/authorization/authorization.js`.
- `MenuBar` exists in `App.vue` with role-filtered items. Feature 2 adds **Areas** (`admin`) and **My Areas** (`area_admin`); it MUST NOT create a second `MenuBar`.
- The Vue router supports per-route allowed roles (FR-010). Feature 2 marks `areas` → `admin` and `my-areas` → `area_admin`.
- Users can be pre-created by seed data with no `google_id`; they are linked by email on first sign-in (FR-004).
