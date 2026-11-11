# Feature: Making and Tracking Requests

**Feature ID:** 4
**Branch pattern:** `feature/4-making-and-tracking-requests`
**Status:** Ready
**Created:** 2026-11-04
**Input:** Requestors submit, validate, list, view, edit, and cancel their own vehicle reservation requests (form + “my requests” list/detail).
**Depends on:** [Feature 1 — Sign-in, Roles & User Management](./feature-1-google-auth-user-management.md) (who is asking), [Feature 2 — Areas, Area Admins & Deployment](./feature-2-areas-area-admins-deploy.md) (areas to pick from), [Feature 3 — Fleet Management](./feature-3-fleet-management.md) (`vehicle_types` + list for the form)
**Related:** Hands pending requests with a known `areaId` to Feature 5 (review queue). F5 writes review fields; a later fulfillment feature writes vehicle/driver assignments that this feature only displays.

> **Implementation gate:** Product code for this feature MUST wait until Features 1–2 and Feature 3’s `vehicle_types` table + `GET /vehicle-t2/vehicle-types` exist on `dev`. This feature consumes that list endpoint; it MUST NOT create or edit vehicle types.

---

## User Stories

### US-4.1: Submit a vehicle request
**As a** requestor
**I want to** submit a request with area, purpose, destination, departure and return date/time, passenger count, vehicle type, and number of vehicles needed
**So that** the fleet office can receive my reservation need

**Priority:** P1
**Independent test:** Authenticated requestor `POST`s a valid body and receives `201` with `status: "pending"` and `requesterId` equal to their user id
**Acceptance scenarios:** see ### US-4.1 under Acceptance Criteria

### US-4.2: Validation errors on invalid request
**As a** requestor
**I want to** get clear errors if return is before departure, departure is in the past, or a required field is missing
**So that** I can fix the form before it is stored

**Priority:** P1
**Independent test:** Invalid create/update returns `400` with the exact message for that rule; no row is created/changed
**Acceptance scenarios:** see ### US-4.2 under Acceptance Criteria

### US-4.3: List my requests
**As a** requestor
**I want to** see a list of my own requests with their status (pending, approved, denied, cancelled, completed), newest first
**So that** I can track where each reservation stands

**Priority:** P1
**Independent test:** After creating two requests, `GET` list returns only the caller’s rows ordered by `createdAt` descending and includes `status`
**Acceptance scenarios:** see ### US-4.3 under Acceptance Criteria

### US-4.4: View request detail
**As a** requestor
**I want to** open a request to see its details, the reviewer’s notes, and the vehicles and drivers assigned once it is approved
**So that** I know the decision and who/what was assigned

**Priority:** P1
**Independent test:** `GET` own request by id returns full fields; `reviewNotes` when set; `assignments` array (empty until a later feature writes rows)
**Acceptance scenarios:** see ### US-4.4 under Acceptance Criteria

### US-4.5: Edit a pending request
**As a** requestor
**I want to** edit a request while it is still pending
**So that** I can correct details before review

**Priority:** P1
**Independent test:** `PUT` own pending request updates fields; `PUT` when status is not `pending` returns `400`
**Acceptance scenarios:** see ### US-4.5 under Acceptance Criteria

### US-4.6: Cancel a request
**As a** requestor
**I want to** cancel a request that is pending or approved and has not started yet
**So that** I can free the reservation when plans change

**Priority:** P1
**Independent test:** Cancel own pending → `cancelled`; cancel own approved with future `departureAt` → `cancelled`; cancel approved with past `departureAt` → `400`
**Acceptance scenarios:** see ### US-4.6 under Acceptance Criteria

### US-4.7: Isolation of others’ requests
**As a** requestor
**I want to** be unable to see anyone else’s requests in the UI or through the API
**So that** reservation privacy is preserved

**Priority:** P1
**Independent test:** List never includes another user’s id; `GET`/`PUT`/cancel of another user’s request id returns `404`
**Acceptance scenarios:** see ### US-4.7 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: All request endpoints in this feature MUST require `authenticate` then `requireRole("requestor")` from Feature 1. Unauthenticated → `401`. Authenticated but not `requestor` → `403` with `{ "message": "You do not have permission for this action." }`.
- **FR-002**: System MUST set `requesterId` from `req.user.id` on create — MUST NOT accept `requesterId` from the client body.
- **FR-003**: Requestors MUST be able to create a request with: `areaId`, `purpose`, `destination`, `departureAt`, `returnAt`, `passengerCount`, `vehicleTypeId`, and `vehiclesNeeded` (default `1` when omitted).
- **FR-004**: On successful create, system MUST persist `status = "pending"` and leave `reviewedBy`, `reviewedAt`, and `reviewNotes` null.
- **FR-005**: System MUST reject create/update with `400` and message `"All required fields must be provided."` when any required field is missing or empty (after trim for strings).
- **FR-006**: System MUST reject create/update with `400` and message `"Return must be after departure."` when `returnAt` is less than or equal to `departureAt`.
- **FR-007**: System MUST reject create/update with `400` and message `"Departure must be in the future."` when `departureAt` is not strictly after the server’s current time.
- **FR-008**: System MUST reject create/update with `400` and message `"Passenger count and vehicles needed must be at least 1."` when `passengerCount` or `vehiclesNeeded` is not an integer ≥ 1.
- **FR-009**: System MUST reject create/update when `areaId` does not reference an **active** area (Feature 2), or `vehicleTypeId` does not reference a **usable** vehicle type (Feature 3: type exists and `isActive` is true) — `400` with message `"Invalid area or vehicle type."`.
- **FR-010**: System MUST return the authenticated requestor’s requests only on list, ordered by `createdAt` descending (newest first), including `status` and summary fields needed by the list screen.
- **FR-011**: System MUST return full detail for an owned request, including nullable review fields (`reviewedBy`, `reviewedAt`, `reviewNotes`) and an `assignments` array of `{ vehicle, driver }` summaries when assignment rows exist; otherwise `assignments: []`.
- **FR-012**: System MUST allow update of an owned request only while `status = "pending"`. Updates MUST apply the same validation rules as create. Updates MUST NOT modify review fields or `requesterId`.
- **FR-013**: System MUST allow cancel of an owned request when `status` is `"pending"`, or when `status` is `"approved"` and `departureAt` is strictly in the future. Cancel MUST set `status = "cancelled"`.
- **FR-014**: System MUST reject cancel with `400` and message `"This request cannot be cancelled."` when the request is not cancellable under FR-013 (including approved with `departureAt` ≤ now, or status `denied` / `cancelled` / `completed`).
- **FR-015**: System MUST respond with `404` and `{ "message": "Request not found." }` for get/update/cancel when the id does not exist **or** is not owned by `req.user.id` (MUST NOT use `403` for ownership — distinct from Feature 2 area-admin `403`).
- **FR-016**: This feature MUST NOT write `reviewedBy`, `reviewedAt`, or `reviewNotes` (Feature 5 owns those writes). This feature MUST NOT create or edit vehicle assignments or trip logs.
- **FR-017**: UI MUST show only data returned for the signed-in requestor (list and detail from this feature’s APIs).
- **FR-018**: `MenuBar` MUST add **My Requests** for role `requestor` (path `/my-requests`). This feature MUST NOT create a second `MenuBar` (extend Feature 1’s shell like Feature 2 does for **Areas** / **My Areas**).

---

## Assumptions

- Feature 1 provides Google sign-in, Bearer sessions, `authenticate`, `requireRole`, roles including `requestor`, and the shared `MenuBar`.
- Feature 2 provides areas; requestors load the form dropdown via `GET /vehicle-t2/areas` (active areas only). Create/update requires an **active** `areaId`.
- Feature 3 provides `vehicle_types` and `GET /vehicle-t2/vehicle-types` (authenticated; requestor receives active types only, ordered by `name` — F3 FR-003). A type is **usable** when `isActive` is true (F3 FR-007). Create/update validates `vehicleTypeId` per FR-009. This feature does not own type CRUD.
- API JSON uses **camelCase** (Feature 1 FR-017 pattern). Sequelize models use `underscored: true` so JS attributes are camelCase and columns match the ERD’s snake_case names.
- API mount is `/vehicle-t2/…` (same scaffold mount as Feature 3 and the app shell).
- Review fields exist on `requests` for display but are written only by Feature 5.
- `assignments` on detail may stay empty until a later fulfillment feature persists assignment rows. Feature 4 still defines the response shape.
- “Hasn’t started yet” for cancel means: approved and `departureAt` is still in the future (no trip-log dependency in this feature).
- Admins and area admins use Feature 5 for review queues — not this requestor UI.

## Edge Cases

- Missing/blank required field → `400` `"All required fields must be provided."`
- `returnAt` ≤ `departureAt` → `400` `"Return must be after departure."`
- `departureAt` in the past or equal to now → `400` `"Departure must be in the future."`
- `passengerCount` or `vehiclesNeeded` < 1 → `400` `"Passenger count and vehicles needed must be at least 1."`
- Unknown or inactive area, or unknown/inactive (`isActive` false) vehicle type → `400` `"Invalid area or vehicle type."`
- Edit when status is not `pending` → `400` `"Only pending requests can be edited."`
- Cancel when not allowed → `400` `"This request cannot be cancelled."`
- Another user’s request id → `404` `"Request not found."`
- Unauthenticated → `401`
- Authenticated non-`requestor` → `403` `"You do not have permission for this action."`
- Empty my-requests list → empty array / empty-state copy (see Screen Requirements)

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge
- **SC-002**: A requestor can complete create → list → detail → edit (while pending) → cancel without seeing another user’s data
- **SC-003**: Invalid create/update never persists a row (or never changes an existing row)
- **SC-004**: Living reference (`api.md`, `data-model.md`, `behavior.md`) updated in the same PR when this feature merges

---

## Data Ownership & Isolation

Each requestor owns their request rows exclusively for create, read, update, and cancel in this feature.

| Rule | Requirement |
|------|-------------|
| **Read scope** | List/detail only where `requesterId = req.user.id` |
| **Write scope** | Update/cancel only when row matches `id` and `requesterId = req.user.id` |
| **Create scope** | New rows owned by the authenticated requestor (`requesterId` from `req.user.id`) |
| **Role gate** | Endpoints require `requestor`; other roles → `403` (not ownership `404`) |
| **Cross-user access** | Other user’s request → `404` (not `403`) |
| **UI scope** | UI shows only data returned for the signed-in user |
| **Implementation** | Shared helper in `app/authorization/` (e.g. `getOwnedRequestOrNull`) — do not duplicate ownership checks in every controller |

---

## Key Entities

- **Request**: A vehicle reservation ask; belongs to one User (requester), one Area, one VehicleType; has a lifecycle `status`; may later gain review metadata (F5) and assignments (later feature).
- **User** (Feature 1): Authenticated account; requestor creates and tracks own requests.
- **Area** (Feature 2): Fleet/office grouping the request is sent to; must be active when creating/updating.
- **VehicleType** (Feature 3): Category requested (e.g. Van, Car, Bus).
- **Assignment** (later feature, read-only here): Optional link of a specific vehicle and driver to an approved request; shown on detail when present.

---

## API Requirements

All endpoints: Auth **Yes** + role **`requestor`**. Mount: `/vehicle-t2`. Flat JSON; errors `{ "message": "..." }`.

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/vehicle-t2/requests` | Yes, requestor | Create request (`pending`) |
| `GET` | `/vehicle-t2/requests` | Yes, requestor | List my requests, newest first |
| `GET` | `/vehicle-t2/requests/:id` | Yes, requestor | My request detail (+ review fields + `assignments`) |
| `PUT` | `/vehicle-t2/requests/:id` | Yes, requestor | Edit pending request |
| `POST` | `/vehicle-t2/requests/:id/cancel` | Yes, requestor | Cancel when allowed |

**Create / update request body:**

```json
{
  "areaId": 1,
  "purpose": "Field trip to museum",
  "destination": "Downtown Museum",
  "departureAt": "2026-12-01T09:00:00.000Z",
  "returnAt": "2026-12-01T15:00:00.000Z",
  "passengerCount": 12,
  "vehicleTypeId": 2,
  "vehiclesNeeded": 1
}
```

**Create success** (`201`):

```json
{
  "id": 10,
  "requesterId": 42,
  "areaId": 1,
  "vehicleTypeId": 2,
  "vehiclesNeeded": 1,
  "passengerCount": 12,
  "purpose": "Field trip to museum",
  "destination": "Downtown Museum",
  "departureAt": "2026-12-01T09:00:00.000Z",
  "returnAt": "2026-12-01T15:00:00.000Z",
  "status": "pending",
  "reviewedBy": null,
  "reviewedAt": null,
  "reviewNotes": null,
  "createdAt": "2026-11-04T15:00:00.000Z",
  "updatedAt": "2026-11-04T15:00:00.000Z"
}
```

**List success** (`200`): array of owned requests (same core fields as create; list may omit `reviewNotes` / `assignments` — detail is authoritative for those). Sorted by `createdAt` descending.

**Detail success** (`200`): create-shaped fields plus:

```json
{
  "assignments": [
    {
      "id": 1,
      "vehicle": { "id": 5, "name": "Van 2", "licensePlate": "ABC-123" },
      "driver": { "id": 7, "firstName": "Alex", "lastName": "Nguyen" }
    }
  ]
}
```

When none exist: `"assignments": []`.

**Cancel success** (`200`): request payload with `status: "cancelled"`.

**Error responses:** `{ "message": "Human-readable explanation." }` with messages quoted in FRs / Gherkin.  
**Not found / not owned:** `404` `{ "message": "Request not found." }`.  
**Unauthenticated:** `401`.  
**Wrong role:** `403` `{ "message": "You do not have permission for this action." }`.

**Dropdown data (owned elsewhere):**

- Areas: `GET /vehicle-t2/areas` (Feature 2 — requestor receives active areas only).
- Vehicle types: `GET /vehicle-t2/vehicle-types` (Feature 3 — requestor receives active types only, ordered by `name`). Form select uses each type’s `id` and `name` from that response.

---

## Screen Requirements

### [View: My Requests] — route name `my-requests` — path `/my-requests`

*   Heading: **My Requests**
*   Purpose: show the signed-in requestor’s reservations
*   Router: allow role `requestor` only (Feature 1 FR-010 pattern)
*   Primary action: **New Request** (`oc-cta`) → navigate to `request-new`
*   List columns/fields: purpose (or destination), area name if available, departure, status, newest first
*   Row opens `request-detail`
*   **Empty state:** `"No requests yet. Create your first request."`
*   **Loading:** progress/skeleton while fetching
*   **Error:** `<v-alert type="error">` with API `message`

### [View: New Request] — route name `request-new`

*   Heading: **New Request**
*   Fields: Area (select from `GET /vehicle-t2/areas`), Purpose, Destination, Departure date/time, Return date/time, Passenger count, Vehicle type (select from `GET /vehicle-t2/vehicle-types` — label by `name`, value by `id`), Vehicles needed (default 1)
*   Primary action: **Submit Request** (`oc-cta`)
*   Secondary: **Cancel** → back to `my-requests` without saving
*   Client-side checks may mirror FR-005–FR-008; server remains source of truth
*   **Error:** `<v-alert type="error">` with exact API message strings

### [View: Edit Request] — route name `request-edit`

*   Same fields as New Request, prefilled from detail
*   Only reachable for own `pending` requests; otherwise redirect/block with message `"Only pending requests can be edited."`
*   Primary action: **Save Changes** (`oc-cta`)

### [View: Request Detail] — route name `request-detail`

*   Shows all request fields and `status`
*   **Review:** show `reviewNotes` (and reviewer/time if present); if none, `"No review notes yet."`
*   **Assignments:** if `assignments.length > 0`, list vehicle name/plate and driver name; else `"No vehicles assigned yet."`
*   Actions: **Edit** (only if `pending`), **Cancel request** (only if cancellable per FR-013) with confirm dialog
*   Cancel confirm: title/body make clear the request will be cancelled; confirm button **Cancel Request**

**App chrome (MenuBar):** add **My Requests** for `requestor` (path `/my-requests`). Do not create a second `MenuBar`.

---

## Data Model Requirements

### `requests` table (new — owned by this feature)

DB columns are snake_case; API/JSON uses camelCase via Sequelize `underscored: true`.

| Field | Type | Rules |
|-------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `requester_id` | INTEGER FK | Required; references `users.id`; set from auth (`requesterId` in JSON) |
| `area_id` | INTEGER FK | Required; references `areas.id` (`areaId` in JSON); must be active on create/update |
| `vehicle_type_id` | INTEGER FK | Required; references `vehicle_types.id` (`vehicleTypeId` in JSON); Feature 3 |
| `vehicles_needed` | INTEGER | Required; default `1`; ≥ 1 (`vehiclesNeeded`) |
| `passenger_count` | INTEGER | Required; ≥ 1 (`passengerCount`) |
| `purpose` | STRING(255) | Required; non-empty after trim |
| `destination` | STRING(255) | Required; non-empty after trim |
| `departure_at` | DATETIME | Required; must be in the future on create/update (`departureAt`) |
| `return_at` | DATETIME | Required; must be after `departure_at` (`returnAt`) |
| `status` | ENUM | `pending`, `approved`, `denied`, `cancelled`, `completed`; default `pending` |
| `reviewed_by` | INTEGER FK NULL | References `users.id`; **written by Feature 5 only** (`reviewedBy`) |
| `reviewed_at` | DATETIME NULL | **Written by Feature 5 only** (`reviewedAt`) |
| `review_notes` | TEXT NULL | **Written by Feature 5 only** (`reviewNotes`) |
| `created_at` | DATETIME | Required (`createdAt`) |
| `updated_at` | DATETIME | Required (`updatedAt`) |

### Associations

- `User` hasMany `Request` (as requester via `requester_id`)
- `Request` belongsTo `User` (requester)
- `Request` belongsTo `User` (reviewer via `reviewed_by`, optional)
- `Area` hasMany `Request`
- `Request` belongsTo `Area`
- `VehicleType` hasMany `Request`
- `Request` belongsTo `VehicleType`
- Later: `Request` hasMany assignments (read on detail; table not created by this feature)

### Not created by this feature

- `vehicle_types` — Feature 3
- `vehicle_assignments`, `vehicles`, `trip_logs`, `vehicle_unavailability` — later features
- Writing `approved` / `denied` / `completed` status transitions — Feature 5+ (except this feature sets `cancelled`)

---

## Acceptance Criteria

### US-4.1 — Submit a vehicle request

#### Scenario: Requestor submits a valid request
*   **Given** I am signed in as a requestor
*   **And** an active area and a vehicle type exist
*   **When** I submit a request with area, purpose, destination, future departure and later return, passenger count, vehicle type, and vehicles needed
*   **Then** the API returns `201` with `status` `"pending"` and `requesterId` equal to my user id
*   **And** `reviewedBy`, `reviewedAt`, and `reviewNotes` are null

#### Scenario: Unauthenticated user cannot create a request
*   **Given** I am not signed in
*   **When** I send `POST /vehicle-t2/requests`
*   **Then** the API returns `401`

#### Scenario: Non-requestor cannot create a request
*   **Given** I am signed in as an admin
*   **When** I send `POST /vehicle-t2/requests` with a valid body
*   **Then** the API returns `403` with `{ "message": "You do not have permission for this action." }`

### US-4.2 — Validation errors on invalid request

#### Scenario: Requestor omits a required field
*   **Given** I am signed in as a requestor
*   **When** I submit a request missing `purpose`
*   **Then** the API returns `400` with `{ "message": "All required fields must be provided." }`
*   **And** no request row is created

#### Scenario: Return is not after departure
*   **Given** I am signed in as a requestor
*   **When** I submit a request where `returnAt` is before or equal to `departureAt`
*   **Then** the API returns `400` with `{ "message": "Return must be after departure." }`

#### Scenario: Departure is in the past
*   **Given** I am signed in as a requestor
*   **When** I submit a request with `departureAt` in the past
*   **Then** the API returns `400` with `{ "message": "Departure must be in the future." }`

#### Scenario: Invalid area or vehicle type
*   **Given** I am signed in as a requestor
*   **When** I submit a request with an unknown or inactive `areaId`, or an unknown or inactive (`isActive` false) `vehicleTypeId`
*   **Then** the API returns `400` with `{ "message": "Invalid area or vehicle type." }`

### US-4.3 — List my requests

#### Scenario: Requestor sees own requests newest first
*   **Given** I am signed in as a requestor
*   **And** I have two requests created at different times
*   **When** I open **My Requests** (or `GET /vehicle-t2/requests`)
*   **Then** I see only my requests
*   **And** they are ordered newest first by `createdAt`
*   **And** each row includes a `status` of pending, approved, denied, cancelled, or completed

#### Scenario: Empty my requests list
*   **Given** I am signed in as a requestor with no requests
*   **When** I open **My Requests**
*   **Then** I see `"No requests yet. Create your first request."`

### US-4.4 — View request detail

#### Scenario: Requestor views request detail with no review or assignments yet
*   **Given** I am signed in as a requestor
*   **And** I own a pending request
*   **When** I open that request’s detail
*   **Then** I see purpose, destination, schedule, passenger count, vehicle type, vehicles needed, area, and status
*   **And** I see `"No review notes yet."`
*   **And** I see `"No vehicles assigned yet."`
*   **And** the API `assignments` array is `[]`

#### Scenario: Requestor views review notes and assignments when present
*   **Given** I am signed in as a requestor
*   **And** I own an approved request that has `reviewNotes` and at least one assignment (seeded as if written by later features)
*   **When** I open that request’s detail
*   **Then** I see the reviewer’s notes
*   **And** I see the assigned vehicle and driver information from `assignments`

### US-4.5 — Edit a pending request

#### Scenario: Requestor edits a pending request
*   **Given** I am signed in as a requestor
*   **And** I own a request with status `"pending"`
*   **When** I change the destination and save
*   **Then** the API returns `200` with the updated destination
*   **And** `status` remains `"pending"`
*   **And** review fields remain unchanged

#### Scenario: Requestor cannot edit a non-pending request
*   **Given** I am signed in as a requestor
*   **And** I own a request with status `"approved"`
*   **When** I attempt to update it
*   **Then** the API returns `400` with `{ "message": "Only pending requests can be edited." }`

### US-4.6 — Cancel a request

#### Scenario: Requestor cancels a pending request
*   **Given** I am signed in as a requestor
*   **And** I own a request with status `"pending"`
*   **When** I cancel the request
*   **Then** the API returns `200` with `status` `"cancelled"`

#### Scenario: Requestor cancels an approved request that has not started
*   **Given** I am signed in as a requestor
*   **And** I own a request with status `"approved"` and `departureAt` in the future
*   **When** I cancel the request
*   **Then** the API returns `200` with `status` `"cancelled"`

#### Scenario: Requestor cannot cancel an approved request after departure time
*   **Given** I am signed in as a requestor
*   **And** I own a request with status `"approved"` and `departureAt` in the past
*   **When** I cancel the request
*   **Then** the API returns `400` with `{ "message": "This request cannot be cancelled." }`

### US-4.7 — Isolation of others’ requests

#### Scenario: Requestor cannot list another user’s requests
*   **Given** requestor A and requestor B both have requests
*   **And** I am signed in as requestor A
*   **When** I `GET /vehicle-t2/requests`
*   **Then** the response includes only requestor A’s requests

#### Scenario: Requestor cannot open another user’s request by id
*   **Given** requestor B owns request id `99`
*   **And** I am signed in as requestor A
*   **When** I `GET /vehicle-t2/requests/99`
*   **Then** the API returns `404` with `{ "message": "Request not found." }`

#### Scenario: Requestor cannot update or cancel another user’s request
*   **Given** requestor B owns request id `99`
*   **And** I am signed in as requestor A
*   **When** I `PUT /vehicle-t2/requests/99` or `POST /vehicle-t2/requests/99/cancel`
*   **Then** the API returns `404` with `{ "message": "Request not found." }`

---

## Test Coverage Map

Each scenario above must map to at least one automated test.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-4.1 | Requestor submits a valid request | `backend/tests/requests.test.js` | `Requestor submits a valid request` |
| US-4.1 | Unauthenticated user cannot create a request | `backend/tests/requests.test.js` | `Unauthenticated user cannot create a request` |
| US-4.1 | Non-requestor cannot create a request | `backend/tests/requests.test.js` | `Non-requestor cannot create a request` |
| US-4.2 | Requestor omits a required field | `backend/tests/requests.test.js` | `Requestor omits a required field` |
| US-4.2 | Return is not after departure | `backend/tests/requests.test.js` | `Return is not after departure` |
| US-4.2 | Departure is in the past | `backend/tests/requests.test.js` | `Departure is in the past` |
| US-4.2 | Invalid area or vehicle type | `backend/tests/requests.test.js` | `Invalid area or vehicle type` |
| US-4.2 | Requestor omits a required field | `frontend/tests/RequestForm.test.js` | `Requestor omits a required field` |
| US-4.3 | Requestor sees own requests newest first | `backend/tests/requests.test.js` | `Requestor sees own requests newest first` |
| US-4.3 | Empty my requests list | `frontend/tests/MyRequests.test.js` | `Empty my requests list` |
| US-4.4 | Requestor views request detail with no review or assignments yet | `frontend/tests/RequestDetail.test.js` | `Requestor views request detail with no review or assignments yet` |
| US-4.4 | Requestor views review notes and assignments when present | `backend/tests/requests.test.js` | `Requestor views review notes and assignments when present` |
| US-4.5 | Requestor edits a pending request | `backend/tests/requests.test.js` | `Requestor edits a pending request` |
| US-4.5 | Requestor cannot edit a non-pending request | `backend/tests/requests.test.js` | `Requestor cannot edit a non-pending request` |
| US-4.6 | Requestor cancels a pending request | `backend/tests/requests.test.js` | `Requestor cancels a pending request` |
| US-4.6 | Requestor cancels an approved request that has not started | `backend/tests/requests.test.js` | `Requestor cancels an approved request that has not started` |
| US-4.6 | Requestor cannot cancel an approved request after departure time | `backend/tests/requests.test.js` | `Requestor cannot cancel an approved request after departure time` |
| US-4.7 | Requestor cannot list another user’s requests | `backend/tests/requests.test.js` | `Requestor cannot list another user’s requests` |
| US-4.7 | Requestor cannot open another user’s request by id | `backend/tests/requests.test.js` | `Requestor cannot open another user’s request by id` |
| US-4.7 | Requestor cannot update or cancel another user’s request | `backend/tests/requests.test.js` | `Requestor cannot update or cancel another user’s request` |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 4 from @features/feature-4-making-and-tracking-requests.md on branch `feature/4-making-and-tracking-requests`.

Prerequisites on `dev`: Feature 1 (auth/roles/MenuBar), Feature 2 (areas + GET /vehicle-t2/areas), and Feature 3 minimum (`vehicle_types` + GET /vehicle-t2/vehicle-types).

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
Do not implement Feature 5 review writes or assignment/trip-log creation.
Consume Feature 3’s GET /vehicle-t2/vehicle-types for the form dropdown; do not create or edit vehicle_types. Validate vehicleTypeId per FR-009 (exists and isActive).
```

**Reference updates for this feature:** `features/reference/api.md`, `features/reference/data-model.md`, `features/reference/behavior.md`

---

## Definition of Done

*   [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-018** satisfied)
*   [ ] **Success Criteria (SC-001**–**SC-004)** met
*   [ ] All mapped tests pass (`npm test`)
*   [ ] Test Coverage Map complete
*   [ ] `features/reference/data-model.md` updated (schema)
*   [ ] `features/reference/api.md` updated (routes/payloads)
*   [ ] `features/reference/behavior.md` updated (ownership, validation, cancel rules)
*   [x] Feature 3 vehicle-type list contract reconciled into this spec (`GET /vehicle-t2/vehicle-types`, usable = `isActive`, Status `Ready`)
*   [ ] Product implementation only after Features 1–2 and Feature 3 types exist on `dev`

---

## Out of Scope

*   Admin / area_admin review queue and writing `reviewedBy` / `reviewedAt` / `reviewNotes` / approve / deny (Feature 5)
*   Creating or editing `vehicle_assignments`, `trip_logs`, or vehicle inventory
*   Creating or editing `vehicle_types` or other Feature 3 fleet APIs (consume `GET /vehicle-t2/vehicle-types` only)
*   Setting status to `approved`, `denied`, or `completed` (except displaying those values when set elsewhere)
*   Requestor browsing or managing other users’ requests
*   Notifications / email on status change
