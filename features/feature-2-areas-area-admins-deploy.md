# Feature: Areas, Area Admins & Deployment

**Feature ID:** 2
**Branch pattern:** `feature/2-areas-area-admins-deploy`
**Status:** Draft
**Created:** 2026-11-02
**Input:** OC areas (Athletics, Support Central, Maintenance…) own groups of vehicles. Admins add, edit, and deactivate areas and assign one or more area admins to each. Area admins see the areas they manage, and every later feature uses this feature's helpers so area admins only see data for their areas. This feature also owns the seed data and the GitHub Actions deploy to AWS.
**Depends on:** [Feature 1 — Sign-in, Roles & User Management](feature-1-google-auth-user-management.md)

---

## User Stories

### US-2.1: Add, edit and deactivate areas

**As an** admin  
**I want to** add, edit, and deactivate areas  
**So that** the list of areas that own vehicles stays accurate

**Priority:** P1  
**Independent test:** Open **Areas** as admin, create `Athletics`, edit its description, deactivate it; the list shows each change  
**Acceptance scenarios:** see ### US-2.1 under Acceptance Criteria

### US-2.2: Assign and remove area admins

**As an** admin  
**I want to** assign one or more area admins to an area, and remove them  
**So that** the right people manage each area's vehicles and requests

**Priority:** P1  
**Independent test:** Open **Manage admins** on an area, add two area admins, remove one; the area shows the remaining admin  
**Acceptance scenarios:** see ### US-2.2 under Acceptance Criteria

### US-2.3: See each area's admins at a glance

**As an** admin  
**I want to** see each area's admins in the areas list  
**So that** I can tell who manages what without opening each area

**Priority:** P2  
**Independent test:** Areas list shows admin names on each row; an area with none shows **No admins**  
**Acceptance scenarios:** see ### US-2.3 under Acceptance Criteria

### US-2.4: See the areas I manage

**As an** area admin  
**I want to** see the list of areas I manage  
**So that** I know which areas' vehicles and requests are mine

**Priority:** P1  
**Independent test:** Sign in as an area admin assigned to `Athletics`; **My Areas** lists only `Athletics`  
**Acceptance scenarios:** see ### US-2.4 under Acceptance Criteria

### US-2.5: Only see data for my areas

**As an** area admin  
**I want** data for other areas hidden in the UI and refused by the API  
**So that** I only work on my own areas' vehicles and requests

**Priority:** P1  
**Independent test:** As an area admin, `GET /vehicle/areas/:areaId` for my area returns `200`; for another area returns `403`. `getManagedAreaIds` unit tests pass for each role  
**Acceptance scenarios:** see ### US-2.5 under Acceptance Criteria

### US-2.6: Load sample data with one command

**As a** developer  
**I want to** run one seed command that loads sample users, areas, and area admins  
**So that** the team can test and demo without entering data by hand

**Priority:** P1  
**Independent test:** On an empty database run `npm run seed --prefix backend` twice; sample rows exist once each  
**Acceptance scenarios:** see ### US-2.6 under Acceptance Criteria

### US-2.7: Deploy every merge to main

**As the** team  
**I want** every merge to `main` to deploy to the AWS instance through GitHub Actions  
**So that** the demo site always runs the latest tested code

**Priority:** P1  
**Independent test:** Merge to `main`; the **Deploy** workflow runs tests, then deploys; the AWS site serves the new build  
**Acceptance scenarios:** see ### US-2.7 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: All area endpoints MUST require a valid session (`authenticate`). Unauthenticated requests MUST return `401`.
- **FR-002**: `GET /vehicle/areas` MUST be allowed for every role. Role `admin` MUST receive all areas (active and inactive). Other roles MUST receive only active areas. Areas MUST be ordered by `name`. Each area MUST include an `admins` array of `{ id, firstName, lastName, email }`.
- **FR-003**: `POST /vehicle/areas` and `PUT /vehicle/areas/:areaId` MUST require role `admin` (`requireRole("admin")` from Feature 1). There MUST be no `DELETE` for areas; admins deactivate by setting `isActive` to `false`.
- **FR-004**: `name` MUST be required, trimmed, and at most 100 characters. Too-long message: **"Area name must be 100 characters or fewer."** `name` MUST be unique, ignoring case. Duplicate → `400` with `{ "message": "Area name is already taken." }`. `description` is optional text.
- **FR-005**: A deactivated area MUST be hidden from non-admin `GET /vehicle/areas`. Its `area_admins` rows MUST be kept. Reactivating (`isActive` `true`) MUST show it again.
- **FR-006**: `POST /vehicle/areas/:areaId/admins` with `{ "userId": <id> }` MUST require role `admin`. Unknown area → `404` `{ "message": "Area with id=<id> not found." }`. Unknown user → `404` `{ "message": "User with id=<id> not found." }`. A user whose role is not `area_admin` or who is inactive → `400` `{ "message": "User must be an active area admin." }`. Already assigned → `400` `{ "message": "User is already an admin of this area." }`. Success MUST set `assigned_at` to now and return `201` with the area (including `admins`).
- **FR-007**: An area MAY have many admins. A user MAY administer many areas.
- **FR-008**: `DELETE /vehicle/areas/:areaId/admins/:userId` MUST require role `admin`. If that user is not an admin of that area → `404` `{ "message": "User is not an admin of this area." }`. Success MUST return `200` with the area (including `admins`).
- **FR-009**: When Feature 1 `PUT /vehicle/users/:userId` changes a user's role away from `area_admin`, all of that user's `area_admins` rows MUST be deleted in the same request.
- **FR-010**: This feature MUST export `getManagedAreaIds(user)` from `backend/app/authorization/areaScope.js`. Given `req.user`, it MUST return an array of area ids: every area id for `admin`; the ids in `area_admins` for that user for `area_admin` (active and inactive areas); and `[]` for `requestor`.
- **FR-011**: This feature MUST export `requireAreaAccess` middleware from `backend/app/authorization/areaScope.js`. It MUST run after `authenticate`, read `req.params.areaId`, and call `next()` when the user is `admin` or the id is in `getManagedAreaIds(req.user)`. Otherwise it MUST return `403` `{ "message": "You do not manage this area." }`.
- **FR-012**: `GET /vehicle/areas/mine` MUST allow roles `admin` and `area_admin` (`requestor` → `403`). It MUST return the areas whose ids are in `getManagedAreaIds(req.user)`, ordered by `name`, including inactive ones with their `isActive` flag.
- **FR-013**: `GET /vehicle/areas/:areaId` MUST allow roles `admin` and `area_admin` and MUST use `requireAreaAccess`. It returns one area with `admins`. Unknown area (for an admin) → `404` `{ "message": "Area with id=<id> not found." }`.
- **FR-014**: `MenuBar` MUST add **Areas** (role `admin`, path `/areas`) and **My Areas** (role `area_admin`, path `/my-areas`). The router MUST restrict `areas` to `admin` and `my-areas` to `area_admin` (Feature 1 FR-010).
- **FR-015**: `npm run seed --prefix backend` (`backend/scripts/seed.mjs`) MUST load: 1 `admin`, 2 `area_admin`, and 3 `requestor` users (one requestor is an approved driver with a future license expiration); active areas **Athletics**, **Support Central**, and **Maintenance** with descriptions; and `area_admins` rows (first area admin → Athletics; second → Support Central and Maintenance). Seeded users have no `google_id`; Feature 1 links them by email on first sign-in. Seed emails MUST be constants at the top of the script so the team can put in their own OC emails.
- **FR-016**: The seed MUST be safe to run more than once: it MUST use find-or-create by `users.email`, `areas.name`, and (`user_id`, `area_id`), and MUST NOT delete or overwrite existing rows. The seed function MUST be exported so tests can call it.
- **FR-017**: `.github/workflows/deploy.yml` MUST run on push to `main`. It MUST run the **Test** workflow first, and the frontend and backend deploy jobs MUST `need` it so failing tests block deployment. The backend's production `.env` MUST include `GOOGLE_CLIENT_ID`. The frontend build MUST receive `VITE_GOOGLE_CLIENT_ID`. Both come from the `GOOGLE_CLIENT_ID` repository secret.
- **FR-018**: `.github/workflows/test.yml` MUST run on pull requests to `dev` and `main` and when called by **Deploy**.

---

## Assumptions

- Feature 1 MUST be merged to `dev` before this feature (it provides `authenticate`, `requireRole`, `MenuBar`, role route guards, and the `users` table).
- API mount is `/vehicle/…`.
- The AWS site URL is listed as an authorized JavaScript origin on the Google OAuth client.
- US-2.7 scenarios are verified by the GitHub Actions run log, not by Jest/Vitest.
- Feature 3 (fleet management) and Feature 4 (requests) add vehicle types, vehicles, and requests to the same seed script when they ship.
- Area **logo** and **notice email** from North's interview notes are not in the ERD and are not part of this feature.

## Edge Cases

- Area name `athletics` when `Athletics` exists → `400` duplicate.
- Area name whitespace-only → client **"Required"**; API `400` `{ "message": "Area name is required." }`.
- Non-integer `areaId` (e.g. `/vehicle/areas/abc`) → `404`.
- Area admin requests `GET /vehicle/areas/:areaId` for an area that does not exist → `403` (not in their managed list; existence is not revealed).
- Assigning an inactive user or a `requestor` as area admin → `400`.
- Deactivating an area that still has admins → allowed; admins stay assigned and still see it (labeled **Inactive**) in **My Areas**.
- Admin demotes an area admin to `requestor` in Feature 1 → their area assignments are removed (FR-009).
- Running the seed when some sample rows already exist → only missing rows are created.

## Success Criteria

- **SC-001**: Every Gherkin scenario in US-2.1 through US-2.6 has at least one automated test before merge; US-2.7 is shown by a green **Deploy** run on `main`.
- **SC-002**: A signed-in admin can create, edit, deactivate, and reactivate areas, and assign and remove area admins, from one screen.
- **SC-003**: An area admin sees only their areas in **My Areas** and gets `403` for any other area's `GET /vehicle/areas/:areaId`.
- **SC-004**: `npm run seed --prefix backend` on an empty database gives a working demo: each team member can sign in as admin, area admin, or requestor using the seeded emails.
- **SC-005**: `npm test` passes for area API, area scope helpers, seed, and areas/my-areas views.

---

## Data Ownership & Isolation

Areas are a shared catalog managed by admins. Area admins are scoped to the areas they are assigned to. This feature provides the helpers every later feature MUST use to scope vehicles and requests by area.

| Rule               | Requirement                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Read (list)**    | `GET /vehicle/areas`: admin → all areas; other roles → active areas only.                                              |
| **Read (one)**     | `GET /vehicle/areas/:areaId`: admin → any; area admin → only managed areas (`403` otherwise); requestor → `403`.        |
| **Write**          | Create, update, and admin assignment are `admin` only (`403` otherwise).                                               |
| **Area scope**     | `getManagedAreaIds(req.user)` is the single source of "which areas can this user manage". Do not duplicate it inline.  |
| **Implementation** | `authenticate` → `requireRole(...)` → `requireAreaAccess` (when the route has `:areaId`).                               |

---

## API Requirements

| Method   | Endpoint                                 | Auth                    | Purpose                                         |
| -------- | ---------------------------------------- | ----------------------- | ----------------------------------------------- |
| `GET`    | `/vehicle/areas`                         | Yes                     | List areas (admin: all; others: active only)    |
| `GET`    | `/vehicle/areas/mine`                    | Yes, admin / area admin | List areas I manage                             |
| `GET`    | `/vehicle/areas/:areaId`                 | Yes, admin / area admin | Fetch one area (area access required)           |
| `POST`   | `/vehicle/areas`                         | Yes, admin              | Create an area                                  |
| `PUT`    | `/vehicle/areas/:areaId`                 | Yes, admin              | Update name, description, or active status      |
| `POST`   | `/vehicle/areas/:areaId/admins`          | Yes, admin              | Assign an area admin to an area                 |
| `DELETE` | `/vehicle/areas/:areaId/admins/:userId`  | Yes, admin              | Remove an area admin from an area               |

**Create / update area request body:**

```json
{
  "name": "Athletics",
  "description": "Team vans and buses for OC Athletics.",
  "isActive": true
}
```

`isActive` is optional on create (default `true`).

**Assign area admin request body:**

```json
{
  "userId": 4
}
```

**Area success response** (`200` / `201`):

```json
{
  "id": 1,
  "name": "Athletics",
  "description": "Team vans and buses for OC Athletics.",
  "isActive": true,
  "admins": [
    { "id": 4, "firstName": "Alex", "lastName": "Reed", "email": "areed@oc.edu" }
  ],
  "createdAt": "2026-11-02T12:00:00.000Z",
  "updatedAt": "2026-11-02T12:00:00.000Z"
}
```

List endpoints return an array of this object.

**Error response:** `{ "message": "Human-readable explanation." }` with appropriate HTTP status.

---

## Screen Requirements

### [View: Areas] — route name `areas` — path `/areas` — `Areas.vue`

- Heading: **Areas**. Admin-only route.
- Primary action: **+ New area** (`oc-cta`) opens **Add Area** `<v-dialog>`.
- **Add Area** / **Edit Area** fields: **Area Name** (`v-text-field`, required, max 100), **Description** (`v-textarea`, optional). **Edit Area** also has **Active** (`v-switch`).
- Dialog actions: **Create** / **Save** (`oc-cta`) and **Cancel** (secondary).
- List: `v-table`; columns **name**, **description**, **admins** (chips with each admin's full name, or **No admins**), **status** (Active/Inactive); ordered by name.
- Icon-only row actions, `size="small"`, with `aria-label`s:
  - **Edit area** — opens **Edit Area** pre-filled
  - **Manage admins** — opens **Manage Admins** dialog
- **Manage Admins** dialog: title **Manage Admins — <area name>**; lists current admins with a **Remove admin** icon each; a `v-autocomplete` of active `area_admin` users not already assigned (from Feature 1 `GET /vehicle/users`) and an **Add** button (`oc-cta`); **Close** (secondary).
- **Empty state:** **"No areas yet. Create your first area."**
- **Loading state:** progress indicator. **Error state:** `<v-alert type="error">`.

### [View: My Areas] — route name `my-areas` — path `/my-areas` — `MyAreas.vue`

- Heading: **My Areas**. Area-admin-only route.
- List of the areas from `GET /vehicle/areas/mine`: name, description, and an **Inactive** chip on inactive areas. Read-only.
- **Empty state:** **"You are not assigned to any areas yet."**
- **Loading state:** progress indicator. **Error state:** `<v-alert type="error">`.

**App chrome**

- Use the Feature 1 `MenuBar`. Do **not** create a second `MenuBar`.
- Add **Areas** (role `admin`) after **Users**. Add **My Areas** (role `area_admin`).
- Requestors see neither item.

---

## Key Entities

- **Area**: an OC department that owns a group of vehicles (Athletics, Support Central, Maintenance). Has a name, description, and active flag. Later owns vehicles (Feature 3) and receives requests (Feature 4).
- **Area Admin assignment**: links a user with role `area_admin` to an area they manage, with the date assigned. Many-to-many between users and areas.

---

## Data Model Requirements

### `areas` table

| Column        | Type        | Rules                                        |
| ------------- | ----------- | -------------------------------------------- |
| `id`          | INTEGER PK  | Auto-increment                               |
| `name`        | STRING(100) | Required; trimmed; unique (case-insensitive) |
| `description` | TEXT        | Optional                                     |
| `is_active`   | BOOLEAN     | Default `true`                               |
| `created_at`  | DATE        | Sequelize timestamps                         |
| `updated_at`  | DATE        | Sequelize timestamps                         |

### `area_admins` table

| Column        | Type       | Rules                                                 |
| ------------- | ---------- | ----------------------------------------------------- |
| `user_id`     | INTEGER PK, FK | References `users.id`; `ON DELETE CASCADE`        |
| `area_id`     | INTEGER PK, FK | References `areas.id`; `ON DELETE CASCADE`        |
| `assigned_at` | DATE       | Required; default now                                 |

Composite primary key (`user_id`, `area_id`). No `created_at` / `updated_at`.

### Associations (in `models/index.js`)

- `User belongsToMany Area` through `AreaAdmin` (`userId`, alias `managedAreas`)
- `Area belongsToMany User` through `AreaAdmin` (`areaId`, alias `admins`)

---

## Acceptance Criteria (Gherkin)

### US-2.1 — Add, edit and deactivate areas

#### Scenario: Menu Selection

- **Given** I am signed in as a user with role `admin`
- **When** I click **Areas** in the `MenuBar`
- **Then** the areas view is displayed

#### Scenario: Admin views all areas

- **Given** I am signed in as a user with role `admin`
- **And** active area `Support Central` and inactive area `Athletics` exist
- **When** I open the areas view
- **Then** both areas are listed ordered by name: `Athletics`, `Support Central`
- **And** `Athletics` shows status **Inactive**

#### Scenario: Admin has no areas

- **Given** I am signed in as a user with role `admin`
- **And** there are no areas
- **When** I open the areas view
- **Then** I see **"No areas yet. Create your first area."**

#### Scenario: Admin creates an area

- **Given** I am signed in as a user with role `admin`
- **And** I am viewing the areas view
- **When** I click **+ New area**
- **And** I enter area name `Athletics` and description `Team vans and buses`
- **And** I click **Create**
- **Then** the API returns `201` with an area containing `id`, `name` `Athletics`, `isActive` `true`, and an empty `admins` array
- **And** `Athletics` appears in the list
- **And** the dialog closes

#### Scenario: Admin creates an area with a missing name

- **Given** I am signed in as a user with role `admin`
- **And** the **Add Area** dialog is open
- **When** I leave area name empty and click **Create**
- **Then** no API request is sent
- **And** I see the message **"Required"**

#### Scenario: Admin creates an area with a name that is too long

- **Given** I am signed in as a user with role `admin`
- **And** the **Add Area** dialog is open
- **When** I enter an area name of 101 characters and click **Create**
- **Then** no API request is sent
- **And** I see the message **"Area name must be 100 characters or fewer."**

#### Scenario: Admin creates an area with a duplicate name

- **Given** I am signed in as a user with role `admin`
- **And** an area named `Athletics` exists
- **When** I send `POST /vehicle/areas` with name `athletics`
- **Then** the API returns `400` with `{ "message": "Area name is already taken." }`
- **And** only one area named `Athletics` is stored

#### Scenario: Admin edits an area

- **Given** I am signed in as a user with role `admin`
- **And** area `Athletics` exists
- **When** I click **Edit area** on `Athletics`, change the description to `Vans, buses, and golf carts`, and click **Save**
- **Then** the API returns `200` with the new description
- **And** the dialog closes and the row shows the new description

#### Scenario: Admin deactivates an area

- **Given** I am signed in as a user with role `admin`
- **And** active area `Athletics` exists
- **When** I open **Edit Area** for `Athletics`, turn **Active** off, and click **Save**
- **Then** the API returns `200` with `isActive` `false`
- **And** the row shows **Inactive**
- **And** `GET /vehicle/areas` as a `requestor` does not include `Athletics`

#### Scenario: Admin reactivates an area

- **Given** I am signed in as a user with role `admin`
- **And** inactive area `Athletics` exists
- **When** I send `PUT /vehicle/areas/:areaId` for `Athletics` with `{ "name": "Athletics", "isActive": true }`
- **Then** the API returns `200` with `isActive` `true`
- **And** `GET /vehicle/areas` as a `requestor` includes `Athletics`

#### Scenario: Admin edits an area that does not exist

- **Given** I am signed in as a user with role `admin`
- **When** I send `PUT /vehicle/areas/99999` with `{ "name": "Ghost" }`
- **Then** the API returns `404` with `{ "message": "Area with id=99999 not found." }`

#### Scenario: Admin cancels editing an area

- **Given** I am signed in as a user with role `admin`
- **And** the **Edit Area** dialog is open for `Athletics`
- **When** I change the description and click **Cancel**
- **Then** no API request is sent
- **And** the dialog closes and the row is unchanged

---

### US-2.2 — Assign and remove area admins

#### Scenario: Admin assigns an area admin to an area

- **Given** I am signed in as a user with role `admin`
- **And** area `Athletics` exists with no admins
- **And** active user `Alex Reed` has role `area_admin`
- **When** I open **Manage admins** on `Athletics`, choose `Alex Reed`, and click **Add**
- **Then** the API returns `201` with `admins` containing `Alex Reed`
- **And** an `area_admins` row exists for Alex and `Athletics` with `assigned_at` set

#### Scenario: Admin assigns a second area admin to the same area

- **Given** I am signed in as a user with role `admin`
- **And** `Alex Reed` is an admin of `Athletics`
- **And** active user `Sam Cole` has role `area_admin`
- **When** I send `POST /vehicle/areas/:areaId/admins` for `Athletics` with Sam's `userId`
- **Then** the API returns `201` with `admins` containing both `Alex Reed` and `Sam Cole`

#### Scenario: Admin assigns a user who is not an area admin

- **Given** I am signed in as a user with role `admin`
- **And** user `Bob Jones` has role `requestor`
- **When** I send `POST /vehicle/areas/:areaId/admins` with Bob's `userId`
- **Then** the API returns `400` with `{ "message": "User must be an active area admin." }`
- **And** no `area_admins` row is created

#### Scenario: Admin assigns a user who is already an admin of the area

- **Given** I am signed in as a user with role `admin`
- **And** `Alex Reed` is an admin of `Athletics`
- **When** I send `POST /vehicle/areas/:areaId/admins` for `Athletics` with Alex's `userId`
- **Then** the API returns `400` with `{ "message": "User is already an admin of this area." }`

#### Scenario: Admin removes an area admin from an area

- **Given** I am signed in as a user with role `admin`
- **And** `Alex Reed` and `Sam Cole` are admins of `Athletics`
- **When** I open **Manage admins** on `Athletics` and click **Remove admin** on `Alex Reed`
- **Then** the API returns `200` with `admins` containing only `Sam Cole`
- **And** the areas list shows only `Sam Cole` on `Athletics`

#### Scenario: Admin removes a user who is not an admin of the area

- **Given** I am signed in as a user with role `admin`
- **When** I send `DELETE /vehicle/areas/:areaId/admins/:userId` for a user not assigned to that area
- **Then** the API returns `404` with `{ "message": "User is not an admin of this area." }`

#### Scenario: Changing a user's role away from area admin removes their area assignments

- **Given** I am signed in as a user with role `admin`
- **And** `Alex Reed` is an admin of `Athletics` and `Maintenance`
- **When** I send `PUT /vehicle/users/:userId` for Alex with `{ "role": "requestor" }`
- **Then** the API returns `200` with `role` `requestor`
- **And** no `area_admins` rows exist for Alex

---

### US-2.3 — See each area's admins at a glance

#### Scenario: Areas list shows each area's admins

- **Given** I am signed in as a user with role `admin`
- **And** `Alex Reed` is an admin of `Athletics`
- **And** `Maintenance` has no admins
- **When** I open the areas view
- **Then** the `Athletics` row shows `Alex Reed`
- **And** the `Maintenance` row shows **No admins**

---

### US-2.4 — See the areas I manage

#### Scenario: Area admin opens My Areas

- **Given** I am signed in as a user with role `area_admin`
- **When** I click **My Areas** in the `MenuBar`
- **Then** the my areas view is displayed

#### Scenario: Area admin sees only the areas they manage

- **Given** I am signed in as `Sam Cole` with role `area_admin`
- **And** Sam is an admin of `Support Central` and `Maintenance` but not `Athletics`
- **When** I open the my areas view
- **Then** `Maintenance` and `Support Central` are listed
- **And** `Athletics` is not listed

#### Scenario: Area admin with no areas sees empty copy

- **Given** I am signed in as a user with role `area_admin`
- **And** I am not an admin of any area
- **When** I open the my areas view
- **Then** I see **"You are not assigned to any areas yet."**

#### Scenario: Role-based area menu items

- **Given** I am signed in as a user with role `requestor`
- **When** I view the `MenuBar`
- **Then** **Areas** and **My Areas** are not shown
- **And** as role `area_admin`, **My Areas** is shown and **Areas** is not
- **And** as role `admin`, **Areas** is shown and **My Areas** is not

---

### US-2.5 — Only see data for my areas

#### Scenario: getManagedAreaIds returns every area for an admin

- **Given** areas `Athletics`, `Support Central`, and `Maintenance` exist
- **When** I call `getManagedAreaIds` for a user with role `admin`
- **Then** it returns the ids of all three areas

#### Scenario: getManagedAreaIds returns only assigned areas for an area admin

- **Given** `Sam Cole` with role `area_admin` is an admin of `Support Central` and `Maintenance`
- **When** I call `getManagedAreaIds` for Sam
- **Then** it returns exactly the ids of `Support Central` and `Maintenance`

#### Scenario: getManagedAreaIds returns no areas for a requestor

- **Given** areas exist
- **When** I call `getManagedAreaIds` for a user with role `requestor`
- **Then** it returns an empty array

#### Scenario: Area admin opens an area they manage

- **Given** I am signed in as `Sam Cole` with role `area_admin`
- **And** Sam is an admin of `Maintenance`
- **When** I request `GET /vehicle/areas/:areaId` for `Maintenance`
- **Then** the API returns `200` with the `Maintenance` area and its `admins`

#### Scenario: Area admin is refused an area they do not manage

- **Given** I am signed in as `Sam Cole` with role `area_admin`
- **And** Sam is not an admin of `Athletics`
- **When** I request `GET /vehicle/areas/:areaId` for `Athletics`
- **Then** the API returns `403` with `{ "message": "You do not manage this area." }`

#### Scenario: Requestor cannot create an area via the API

- **Given** I am signed in as a user with role `requestor`
- **When** I send `POST /vehicle/areas` with a valid area body
- **Then** the API returns `403` with `{ "message": "You do not have permission for this action." }`
- **And** no area is stored

#### Scenario: Requestor sees only active areas

- **Given** I am signed in as a user with role `requestor`
- **And** active area `Maintenance` and inactive area `Athletics` exist
- **When** I request `GET /vehicle/areas`
- **Then** the API returns `200` with `Maintenance`
- **And** `Athletics` is not included

#### Scenario: Unauthenticated API request to areas

- **Given** I have no valid session token
- **When** I request `GET /vehicle/areas`
- **Then** the API returns `401` with an unauthorized message

#### Scenario: Area admin navigates to the admin areas route

- **Given** I am signed in as a user with role `area_admin`
- **When** I navigate directly to `/areas`
- **Then** I am redirected to the home page

---

### US-2.6 — Load sample data with one command

#### Scenario: Seed loads sample users, areas and area admins

- **Given** the database has no users or areas
- **When** I run the seed
- **Then** 1 `admin`, 2 `area_admin`, and 3 `requestor` users exist, and one requestor is an approved driver with a future license expiration
- **And** active areas `Athletics`, `Support Central`, and `Maintenance` exist
- **And** the first area admin is an admin of `Athletics`
- **And** the second area admin is an admin of `Support Central` and `Maintenance`

#### Scenario: Running the seed twice creates no duplicates

- **Given** the seed has already run once
- **When** I run the seed again
- **Then** the number of rows in `users`, `areas`, and `area_admins` is unchanged

---

### US-2.7 — Deploy every merge to main

#### Scenario: Merge to main deploys after tests pass

- **Given** a pull request is merged into `main`
- **When** the **Deploy** workflow runs
- **Then** the **Test** workflow runs first and passes
- **And** the frontend and backend deploy jobs run after it
- **And** the AWS site serves the new build

#### Scenario: Failing tests block deployment

- **Given** a push to `main` contains a failing test
- **When** the **Deploy** workflow runs
- **Then** the **Test** job fails
- **And** the frontend and backend deploy jobs do not run

#### Scenario: Production build has the Google client ID

- **Given** the `GOOGLE_CLIENT_ID` repository secret is set
- **When** the **Deploy** workflow runs
- **Then** the backend production `.env` contains `GOOGLE_CLIENT_ID`
- **And** the frontend build receives `VITE_GOOGLE_CLIENT_ID`
- **And** **Sign in with Google** works on the AWS site

---

## Test Coverage Map

Each scenario above must map to at least one automated test (US-2.7: GitHub Actions run).

| Story  | Scenario                                                                   | Test file                                                          | Test name                                                                   |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| US-2.1 | Menu Selection                                                             | `frontend/tests/MenuBar.test.js`, `frontend/tests/Areas.test.js`   | `Menu Selection`                                                            |
| US-2.1 | Admin views all areas                                                      | `backend/tests/areas.test.js`, `frontend/tests/Areas.test.js`      | `Admin views all areas`                                                     |
| US-2.1 | Admin has no areas                                                         | `frontend/tests/Areas.test.js`                                     | `Admin has no areas`                                                        |
| US-2.1 | Admin creates an area                                                      | `backend/tests/areas.test.js`, `frontend/tests/Areas.test.js`      | `Admin creates an area`                                                     |
| US-2.1 | Admin creates an area with a missing name                                  | `frontend/tests/Areas.test.js`                                     | `Admin creates an area with a missing name`                                 |
| US-2.1 | Admin creates an area with a name that is too long                         | `frontend/tests/Areas.test.js`                                     | `Admin creates an area with a name that is too long`                        |
| US-2.1 | Admin creates an area with a duplicate name                                | `backend/tests/areas.test.js`                                      | `Admin creates an area with a duplicate name`                               |
| US-2.1 | Admin edits an area                                                        | `backend/tests/areas.test.js`, `frontend/tests/Areas.test.js`      | `Admin edits an area`                                                       |
| US-2.1 | Admin deactivates an area                                                  | `backend/tests/areas.test.js`, `frontend/tests/Areas.test.js`      | `Admin deactivates an area`                                                 |
| US-2.1 | Admin reactivates an area                                                  | `backend/tests/areas.test.js`                                      | `Admin reactivates an area`                                                 |
| US-2.1 | Admin edits an area that does not exist                                    | `backend/tests/areas.test.js`                                      | `Admin edits an area that does not exist`                                   |
| US-2.1 | Admin cancels editing an area                                              | `frontend/tests/Areas.test.js`                                     | `Admin cancels editing an area`                                             |
| US-2.2 | Admin assigns an area admin to an area                                     | `backend/tests/areaAdmins.test.js`, `frontend/tests/Areas.test.js` | `Admin assigns an area admin to an area`                                    |
| US-2.2 | Admin assigns a second area admin to the same area                         | `backend/tests/areaAdmins.test.js`                                 | `Admin assigns a second area admin to the same area`                        |
| US-2.2 | Admin assigns a user who is not an area admin                              | `backend/tests/areaAdmins.test.js`                                 | `Admin assigns a user who is not an area admin`                             |
| US-2.2 | Admin assigns a user who is already an admin of the area                   | `backend/tests/areaAdmins.test.js`                                 | `Admin assigns a user who is already an admin of the area`                  |
| US-2.2 | Admin removes an area admin from an area                                   | `backend/tests/areaAdmins.test.js`, `frontend/tests/Areas.test.js` | `Admin removes an area admin from an area`                                  |
| US-2.2 | Admin removes a user who is not an admin of the area                       | `backend/tests/areaAdmins.test.js`                                 | `Admin removes a user who is not an admin of the area`                      |
| US-2.2 | Changing a user's role away from area admin removes their area assignments | `backend/tests/areaAdmins.test.js`                                 | `Changing a user's role away from area admin removes their area assignments` |
| US-2.3 | Areas list shows each area's admins                                        | `frontend/tests/Areas.test.js`                                     | `Areas list shows each area's admins`                                       |
| US-2.4 | Area admin opens My Areas                                                  | `frontend/tests/MenuBar.test.js`, `frontend/tests/MyAreas.test.js` | `Area admin opens My Areas`                                                 |
| US-2.4 | Area admin sees only the areas they manage                                 | `backend/tests/areas.test.js`, `frontend/tests/MyAreas.test.js`    | `Area admin sees only the areas they manage`                                |
| US-2.4 | Area admin with no areas sees empty copy                                   | `frontend/tests/MyAreas.test.js`                                   | `Area admin with no areas sees empty copy`                                  |
| US-2.4 | Role-based area menu items                                                 | `frontend/tests/MenuBar.test.js`                                   | `Role-based area menu items`                                                |
| US-2.5 | getManagedAreaIds returns every area for an admin                          | `backend/tests/areaScope.test.js`                                  | `getManagedAreaIds returns every area for an admin`                         |
| US-2.5 | getManagedAreaIds returns only assigned areas for an area admin            | `backend/tests/areaScope.test.js`                                  | `getManagedAreaIds returns only assigned areas for an area admin`           |
| US-2.5 | getManagedAreaIds returns no areas for a requestor                         | `backend/tests/areaScope.test.js`                                  | `getManagedAreaIds returns no areas for a requestor`                        |
| US-2.5 | Area admin opens an area they manage                                       | `backend/tests/areas.test.js`                                      | `Area admin opens an area they manage`                                      |
| US-2.5 | Area admin is refused an area they do not manage                           | `backend/tests/areas.test.js`                                      | `Area admin is refused an area they do not manage`                          |
| US-2.5 | Requestor cannot create an area via the API                                | `backend/tests/areas.test.js`                                      | `Requestor cannot create an area via the API`                               |
| US-2.5 | Requestor sees only active areas                                           | `backend/tests/areas.test.js`                                      | `Requestor sees only active areas`                                          |
| US-2.5 | Unauthenticated API request to areas                                       | `backend/tests/areas.test.js`                                      | `Unauthenticated API request to areas`                                      |
| US-2.5 | Area admin navigates to the admin areas route                              | `frontend/tests/router.test.js`                                    | `Area admin navigates to the admin areas route`                             |
| US-2.6 | Seed loads sample users, areas and area admins                             | `backend/tests/seed.test.js`                                       | `Seed loads sample users, areas and area admins`                            |
| US-2.6 | Running the seed twice creates no duplicates                               | `backend/tests/seed.test.js`                                       | `Running the seed twice creates no duplicates`                              |
| US-2.7 | Merge to main deploys after tests pass                                     | `.github/workflows/deploy.yml`                                     | GitHub Actions **Deploy** run on `main`                                     |
| US-2.7 | Failing tests block deployment                                             | `.github/workflows/deploy.yml`                                     | `needs: test` on both deploy jobs                                           |
| US-2.7 | Production build has the Google client ID                                  | `.github/workflows/deploy.yml`                                     | GitHub Actions **Deploy** run + manual sign-in on the AWS site              |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 2 from @features/feature-2-areas-area-admins-deploy.md on branch `feature/2-areas-area-admins-deploy`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
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
- [ ] `GOOGLE_CLIENT_ID` repository secret added and a **Deploy** run on `main` is green

---

## Out of Scope

- Vehicle types, vehicles, and vehicle unavailability (Feature 3 — fleet management), including adding them to the seed
- Requests and request seed data (Feature 4 — making requests)
- Area logo and area notice email (in North's interview notes, not in the ERD)
- Hard-deleting areas
- Email notifications

---

## Delivered to Feature 3

- `getManagedAreaIds(req.user)` and `requireAreaAccess` from `backend/app/authorization/areaScope.js`. Routes with `:areaId` use `requireAreaAccess`; routes that take `areaId` in the body (e.g. creating a vehicle) MUST check it against `getManagedAreaIds` and return `403` `{ "message": "You do not manage this area." }`.
- `GET /vehicle/areas` (active areas for non-admins) for area pickers in the vehicle and request forms.
- `backend/scripts/seed.mjs` with sample users and areas. Feature 3 adds vehicle types and vehicles; Feature 4 adds requests. Keep it idempotent.
