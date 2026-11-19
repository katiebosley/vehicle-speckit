# Feature: Schedule Calendar, Trip Logs & Dashboard

**Feature ID:** 6
**Branch pattern:** `feature/6-schedule-calendar-trip-logs-dashboard`
**Status:** Draft
**Created:** 2026-11-04
**Input:** Demo-facing views that tie the system together: a calendar of who has which vehicle when, role-based home dashboards, and optional check-out/check-in trip logs.
**Depends on:** [Feature 1 — Sign-in, Roles & User Management](./feature-1-google-auth-user-management.md), [Feature 2 — Areas, Area Admins & Deployment](./feature-2-areas-area-admins-deploy.md), Feature 3 — fleet / vehicles & vehicle types (in progress), [Feature 4 — Making and Tracking Requests](./feature-4-making-and-tracking-requests.md), Feature 5 — review & vehicle assignment (assignments must exist; may be mocked with seed data)
**Related:** Replaces Feature 1’s placeholder home content. Reads assignments, requests, and vehicles owned by earlier features; **owns** `trip_logs` writes. Trip-log stories are **cuttable** if Sprint 3 runs short.

> **Cuttable slice:** US-6.5, US-6.6, and US-6.7 (and `trip_logs` table / APIs) MAY be deferred without blocking calendar, availability, or dashboards. Mark deferred items in Out of Scope if cut before merge.

---

## User Stories

### US-6.1: Assignment calendar
**As an** admin or area admin
**I want to** see a calendar of assignments by week or month, filtered by area or vehicle
**So that** I know who has which vehicle when

**Priority:** P1
**Independent test:** As admin, open calendar for a week that has seeded assignments; events show vehicle and driver; filter by area and by vehicle narrows the set. As area admin, only managed areas appear.
**Acceptance scenarios:** see ### US-6.1 under Acceptance Criteria

### US-6.2: Check vehicle-type availability
**As** any signed-in user
**I want to** check which vehicles of a type are free for a date range before I submit a request
**So that** I do not request a type that has no capacity in that window

**Priority:** P1
**Independent test:** `GET` availability for a vehicle type and date range returns free vehicles; a vehicle with an overlapping assignment is omitted
**Acceptance scenarios:** see ### US-6.2 under Acceptance Criteria

### US-6.3: Requestor home dashboard
**As a** requestor
**I want** my home page to show my upcoming trips and pending requests
**So that** I see what matters next after sign-in

**Priority:** P1
**Independent test:** Sign in as requestor with one pending request and one upcoming approved assignment; home lists both sections with correct items
**Acceptance scenarios:** see ### US-6.3 under Acceptance Criteria

### US-6.4: Area admin home dashboard
**As an** area admin
**I want** my home page to show pending requests and vehicles in maintenance for my areas
**So that** I can act on work in my scope

**Priority:** P1
**Independent test:** Sign in as area admin for Athletics; home shows pending requests and maintenance vehicles only for Athletics, not other areas
**Acceptance scenarios:** see ### US-6.4 under Acceptance Criteria

### US-6.5: Check out and check in a vehicle
**As a** driver
**I want to** check a vehicle out with start mileage and check it in with end mileage, fuel added, and any issues
**So that** trip usage is recorded

**Priority:** P2 (cuttable)
**Independent test:** Assigned driver `POST`s check-out then check-in on their assignment; trip log stores mileages, fuel, and issues
**Acceptance scenarios:** see ### US-6.5 under Acceptance Criteria

### US-6.6: Mileage updates on check-in
**As the** application
**I want to** update the vehicle’s current mileage when a trip is checked in
**So that** fleet mileage stays accurate

**Priority:** P2 (cuttable)
**Independent test:** After check-in with `endMileage` 50100, vehicle `currentMileage` is 50100
**Acceptance scenarios:** see ### US-6.6 under Acceptance Criteria

### US-6.7: Vehicle trip history
**As an** admin or area admin
**I want to** view a vehicle’s trip history and reported issues
**So that** I can review past usage and problems

**Priority:** P2 (cuttable)
**Independent test:** `GET` trip history for a vehicle in scope returns prior trip logs including `issuesReported`; area admin cannot read another area’s vehicle (`404` or `403` per ownership rules below)
**Acceptance scenarios:** see ### US-6.7 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Calendar & availability (P1)

- **FR-001**: System MUST require authentication for all Feature 6 endpoints.
- **FR-002**: `GET /vehicle/calendar` MUST allow roles `admin` and `area_admin`. It MUST return assignment events for a requested range (`start`, `end` query params, ISO datetimes). Each event MUST include at least: `assignmentId`, `vehicleId`, `vehicleName` (or plate), `driverId`, driver name, `areaId`, `departureAt`, `returnAt`, and related `requestId` when present.
- **FR-003**: Calendar MUST support view intent via query `view=week|month` (clients may also pass explicit `start`/`end`). Optional filters: `areaId`, `vehicleId`.
- **FR-004**: For `area_admin`, calendar results MUST be limited to areas in Feature 2 `getManagedAreaIds(req.user)`. `admin` sees all areas. Filtering to an area outside scope → empty results or `403` `{ "message": "You do not manage this area." }` when `areaId` is explicitly out of scope.
- **FR-005**: `GET /vehicle/availability` MUST allow any authenticated role. Required query: `vehicleTypeId`, `departureAt`, `returnAt`. It MUST return vehicles of that type that are **free** for the entire range: status is `available` (not `maintenance` or `retired`), and no assignment overlaps `[departureAt, returnAt)` (overlap if existing `departureAt < returnAt` AND existing `returnAt > departureAt` using the request’s schedule on the assignment’s request, or assignment window fields if Feature 5 stores them).
- **FR-006**: Availability MUST reject invalid ranges with `400` `"Return must be after departure."` when `returnAt` ≤ `departureAt`.

#### Dashboards (P1)

- **FR-007**: The `home` route MUST replace Feature 1’s placeholder with role-specific dashboard content from this feature (same route name `home`, path `/`).
- **FR-008**: For role `requestor`, home MUST show: (1) **Pending requests** — the user’s requests with `status = "pending"`; (2) **Upcoming trips** — the user’s assignments (as requester or as `driverId`) with `departureAt` ≥ now, ordered soonest first. Empty copy quoted in Screen Requirements.
- **FR-009**: For role `area_admin`, home MUST show: (1) **Pending requests** for areas in `getManagedAreaIds`; (2) **Vehicles in maintenance** for those areas (`status = "maintenance"`). MUST NOT show other areas’ data.
- **FR-010**: For role `admin`, home MUST show a summary suitable for demo: at least **Pending requests** (all areas) and a link/entry point to **Calendar**. (Admin may also see maintenance vehicle counts; keep payloads documented in API.)
- **FR-011**: Dashboard data MUST come from dedicated read APIs (or one `GET /vehicle/dashboard` that branches by role). UI MUST NOT invent rows the API did not return.

#### Trip logs (P2 — cuttable)

- **FR-012**: System MUST persist at most one `trip_logs` row per assignment (`assignment_id` unique).
- **FR-013**: `POST /vehicle/assignments/:assignmentId/checkout` MUST allow the assignment’s `driverId` (and MAY allow `admin`). Body: `{ "startMileage": <int> }`. MUST create/update the trip log with `pickedUpAt` = now and `startMileage`. MUST reject if already checked out (`pickedUpAt` set and not yet returned) with `400` `"This trip is already checked out."`
- **FR-014**: `POST /vehicle/assignments/:assignmentId/checkin` MUST allow the same actors as check-out. Body: `{ "endMileage": <int>, "fuelAddedGallons": <number|null>, "issuesReported": <string|null> }`. MUST set `returnedAt` = now, store fields, and require prior check-out. Missing check-out → `400` `"Check out before checking in."`. `endMileage` MUST be ≥ `startMileage` or `400` `"End mileage must be greater than or equal to start mileage."`
- **FR-015**: On successful check-in, system MUST set the vehicle’s `current_mileage` / `currentMileage` to `endMileage`.
- **FR-016**: `GET /vehicle/vehicles/:vehicleId/trip-logs` MUST allow `admin` and `area_admin` (scoped: area admin only for vehicles in managed areas). Returns trip logs newest first, including `issuesReported`, mileages, fuel, timestamps, and assignment/driver summary.
- **FR-017**: Cross-scope vehicle or assignment access for area admins MUST NOT leak other areas’ data (`404` `{ "message": "Vehicle not found." }` or assignment not found — prefer `404` for consistency with requestor ownership patterns when the resource is out of scope).
- **FR-018**: Non-drivers MUST NOT check out/in another user’s assignment → `403` `{ "message": "You do not have permission for this action." }` (or `404` if hiding existence of others’ assignments is preferred; **use `403` when the assignment is visible to the caller otherwise, `404` when out of area scope**). Concrete: assigned driver mismatch → `403`; area-admin wrong area → `404`.

#### Cross-cutting

- **FR-019**: API JSON MUST use camelCase; DB columns snake_case via `underscored: true` (Feature 1 pattern). Mount: `/vehicle`.
- **FR-020**: `MenuBar` MUST add **Calendar** for `admin` and `area_admin` (path `/calendar`). MUST NOT create a second `MenuBar`.
- **FR-021**: This feature MUST NOT create or edit `requests`, `vehicle_assignments`, or vehicle inventory rows except updating `currentMileage` on check-in (FR-015). Review/approve remains Feature 5.

---

## Assumptions

- Feature 5 provides `vehicle_assignments` with at least `id`, `requestId`, `vehicleId`, `driverId`, and enough schedule data (via joined request `departureAt`/`returnAt`) for calendar and overlap checks.
- Feature 3 provides `vehicles` with `areaId`, `vehicleTypeId`, `status` (`available` | `maintenance` | `retired`), `currentMileage`, `name` / `licensePlate`.
- Feature 4 provides `requests` with statuses including `pending` and schedule fields.
- Feature 2 `getManagedAreaIds` scopes area admins.
- “Driver” means the user whose id is `driverId` on the assignment (typically an approved driver from Feature 1).
- Seed data from Sprint 2 (or Feature 5 seeds) MAY back calendar/dashboard demos before live F5 UI exists.
- If trip logs are cut, FR-012–FR-018 and US-6.5–US-6.7 are deferred; calendar, availability, and dashboards still ship.

## Edge Cases

- Calendar with no assignments in range → empty events array / empty calendar state
- Availability with no free vehicles → empty array (not an error)
- Invalid availability range → `400` `"Return must be after departure."`
- Area admin filters calendar to unmanaged `areaId` → `403` `"You do not manage this area."`
- Check-out twice → `400` `"This trip is already checked out."`
- Check-in without check-out → `400` `"Check out before checking in."`
- `endMileage` < `startMileage` → `400` `"End mileage must be greater than or equal to start mileage."`
- Requestor opens `/calendar` → redirected to `home` (role guard)
- Unauthenticated → `401`

## Success Criteria

- **SC-001**: Every non-deferred Gherkin scenario has at least one automated test before merge
- **SC-002**: Admin or area admin can open calendar and filter by area/vehicle for a seeded week
- **SC-003**: Any user can query availability for a type/date range and see only free vehicles
- **SC-004**: Requestor and area admin home dashboards show the correct scoped sections
- **SC-005**: If trip logs ship: check-in updates vehicle mileage and history shows issues
- **SC-006**: Living reference updated in the same PR when this feature merges

---

## Data Ownership & Isolation

| Rule | Requirement |
|------|-------------|
| **Calendar** | `admin`: all; `area_admin`: managed areas only |
| **Availability** | Any authenticated user; results are non-sensitive free-vehicle lists |
| **Requestor dashboard** | Only own pending requests and own upcoming trips |
| **Area admin dashboard** | Only managed areas’ pending requests and maintenance vehicles |
| **Trip check-out/in** | Assignment’s `driverId` (and `admin`); wrong driver → `403` |
| **Trip history** | `admin` any vehicle; `area_admin` only vehicles in managed areas → else `404` |
| **Implementation** | Reuse `getManagedAreaIds` / area helpers; add thin calendar/dashboard/trip helpers in `app/authorization/` or feature controllers without duplicating scope rules |

---

## Key Entities

- **Assignment** (Feature 5, read-only here): Links a request to a vehicle and driver for a time window.
- **Vehicle** (Feature 3, read-only except mileage on check-in): Fleet unit with type, area, status, mileage.
- **Request** (Feature 4, read-only here): Reservation ask; pending items feed dashboards.
- **TripLog** (this feature): Check-out/check-in record for one assignment (mileage, fuel, issues, timestamps).
- **User** (Feature 1): Roles drive which dashboard and calendar access apply; drivers are assignment `driverId`s.

---

## API Requirements

Mount: `/vehicle`. Auth: Yes. Flat JSON; errors `{ "message": "..." }`.

### P1 — Calendar, availability, dashboard

| Method | Endpoint | Auth / roles | Purpose |
|--------|----------|--------------|---------|
| `GET` | `/vehicle/calendar` | admin, area_admin | Assignment events (`start`, `end`, optional `view`, `areaId`, `vehicleId`) |
| `GET` | `/vehicle/availability` | any authenticated | Free vehicles for `vehicleTypeId` + `departureAt` + `returnAt` |
| `GET` | `/vehicle/dashboard` | any authenticated | Role-specific home payload |

**Calendar event (array item):**

```json
{
  "assignmentId": 1,
  "requestId": 10,
  "areaId": 2,
  "vehicleId": 5,
  "vehicleName": "Van 2",
  "licensePlate": "ABC-123",
  "driverId": 7,
  "driverFirstName": "Alex",
  "driverLastName": "Nguyen",
  "departureAt": "2026-12-01T09:00:00.000Z",
  "returnAt": "2026-12-01T15:00:00.000Z"
}
```

**Availability success** (`200`):

```json
[
  {
    "id": 5,
    "name": "Van 2",
    "licensePlate": "ABC-123",
    "capacity": 12,
    "areaId": 2
  }
]
```

**Dashboard — requestor** (`200`):

```json
{
  "role": "requestor",
  "pendingRequests": [{ "id": 10, "purpose": "Field trip", "departureAt": "…", "status": "pending" }],
  "upcomingTrips": [{ "assignmentId": 1, "vehicleName": "Van 2", "departureAt": "…", "returnAt": "…" }]
}
```

**Dashboard — area_admin** (`200`):

```json
{
  "role": "area_admin",
  "pendingRequests": [{ "id": 11, "areaId": 2, "purpose": "…", "departureAt": "…", "status": "pending" }],
  "maintenanceVehicles": [{ "id": 8, "name": "Bus 1", "areaId": 2, "status": "maintenance" }]
}
```

**Dashboard — admin** (`200`):

```json
{
  "role": "admin",
  "pendingRequests": [{ "id": 11, "areaId": 2, "purpose": "…", "status": "pending" }],
  "pendingRequestCount": 3,
  "maintenanceVehicleCount": 1
}
```

### P2 — Trip logs (cuttable)

| Method | Endpoint | Auth / roles | Purpose |
|--------|----------|--------------|---------|
| `POST` | `/vehicle/assignments/:assignmentId/checkout` | driver of assignment, admin | Start trip log |
| `POST` | `/vehicle/assignments/:assignmentId/checkin` | driver of assignment, admin | Complete trip log + update mileage |
| `GET` | `/vehicle/vehicles/:vehicleId/trip-logs` | admin, area_admin (scoped) | History + issues |

**Check-out body:** `{ "startMileage": 50000 }`  
**Check-in body:** `{ "endMileage": 50120, "fuelAddedGallons": 8.5, "issuesReported": "Scratched bumper" }`  
**Trip log response** includes `id`, `assignmentId`, `startMileage`, `endMileage`, `fuelAddedGallons`, `pickedUpAt`, `returnedAt`, `issuesReported`.

---

## Screen Requirements

### [View: Home] — route name `home` — path `/` (replaces Feature 1 placeholder)

**Requestor**

*   Heading: **Welcome, \<firstName\>**
*   Section **Pending requests** — list with link to Feature 4 detail; empty: `"No pending requests."`
*   Section **Upcoming trips** — vehicle, departure; empty: `"No upcoming trips."`
*   Optional CTA: **New Request** (`oc-cta`) → Feature 4 `request-new`

**Area admin**

*   Sections **Pending requests** and **Vehicles in maintenance** for managed areas
*   Empty: `"No pending requests for your areas."` / `"No vehicles in maintenance."`
*   Link to **Calendar**

**Admin**

*   Summary counts and/or pending list; prominent link to **Calendar**
*   Empty pending: `"No pending requests."`

### [View: Calendar] — route name `calendar` — path `/calendar`

*   Roles: `admin`, `area_admin`
*   Week / month toggle
*   Filters: Area (select), Vehicle (select; options depend on area filter when set)
*   Events show vehicle + driver (+ time)
*   **Empty:** `"No assignments in this range."`
*   **Loading / error:** progress; `<v-alert type="error">`

### [View: Availability helper] — used from request flow and/or standalone

*   Inputs: vehicle type, departure, return
*   Action: **Check availability**
*   Results list free vehicles; empty: `"No vehicles of this type are free for those dates."`
*   May live on New Request (Feature 4) as a panel calling Feature 6 API, or route `availability` — prefer panel on request form plus optional MenuBar entry for all roles labeled **Check availability** if useful for demo

### [View: Trip check-out / check-in] — P2 — e.g. on assignment or trip detail

*   Driver (or admin) sees **Check out** / **Check in** when applicable
*   Check-out field: **Start mileage**
*   Check-in fields: **End mileage**, **Fuel added (gallons)** (optional), **Issues** (optional text)
*   Actions: **Check Out** / **Check In** (`oc-cta`)

### [View: Vehicle trip history] — P2

*   From vehicle detail (Feature 3) or admin fleet UI: **Trip history** list with dates, mileages, fuel, issues
*   Empty: `"No trips logged for this vehicle."`

**App chrome:** MenuBar adds **Calendar** (`admin`, `area_admin`). Do not create a second MenuBar.

---

## Data Model Requirements

### `trip_logs` table (new — owned by this feature; cuttable with P2)

| Field | Type | Rules |
|-------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `assignment_id` | INTEGER FK UQ | Required; references `vehicle_assignments.id`; one log per assignment |
| `start_mileage` | INTEGER | Required on check-out |
| `end_mileage` | INTEGER NULL | Set on check-in; ≥ `start_mileage` |
| `fuel_added_gallons` | DECIMAL(8,2) NULL | Optional on check-in |
| `picked_up_at` | DATETIME | Set on check-out |
| `returned_at` | DATETIME NULL | Set on check-in |
| `issues_reported` | TEXT NULL | Optional on check-in |
| `created_at` / `updated_at` | DATETIME | Required |

### Associations

- `VehicleAssignment` hasOne `TripLog`
- `TripLog` belongsTo `VehicleAssignment`
- Read-only joins to `Vehicle`, `Request`, `User` (driver) for calendar/dashboard/history

### Not owned (read / limited write)

- `vehicle_assignments`, `requests`, `vehicles`, `vehicle_types`, `areas` — earlier features
- Only vehicle field this feature may update: `current_mileage` on check-in

---

## Acceptance Criteria

### US-6.1 — Assignment calendar

#### Scenario: Admin views weekly assignments on the calendar
*   **Given** I am signed in as an admin
*   **And** seeded assignments exist this week
*   **When** I open **Calendar** in week view
*   **Then** I see events for those assignments including vehicle and driver
*   **And** the API `GET /vehicle/calendar` returns those events in range

#### Scenario: Area admin calendar is limited to managed areas
*   **Given** I am signed in as an area admin who manages Athletics only
*   **And** assignments exist for Athletics and Maintenance
*   **When** I open **Calendar**
*   **Then** I only see Athletics assignments

#### Scenario: Admin filters calendar by area and vehicle
*   **Given** I am signed in as an admin
*   **When** I filter by a specific `areaId` and `vehicleId`
*   **Then** only matching assignment events are shown

### US-6.2 — Check vehicle-type availability

#### Scenario: User sees free vehicles for a type and date range
*   **Given** I am signed in
*   **And** two vehicles of type Van exist and one has an overlapping assignment
*   **When** I `GET /vehicle/availability` for that type and range
*   **Then** the response includes only the free Van
*   **And** the busy Van is omitted

#### Scenario: Availability rejects invalid date range
*   **Given** I am signed in
*   **When** I request availability with `returnAt` before `departureAt`
*   **Then** the API returns `400` with `{ "message": "Return must be after departure." }`

### US-6.3 — Requestor home dashboard

#### Scenario: Requestor home shows pending requests and upcoming trips
*   **Given** I am signed in as a requestor
*   **And** I have a pending request and an upcoming assignment
*   **When** I open home
*   **Then** I see the pending request under **Pending requests**
*   **And** I see the upcoming trip under **Upcoming trips**

#### Scenario: Requestor home empty states
*   **Given** I am signed in as a requestor with no pending requests and no upcoming trips
*   **When** I open home
*   **Then** I see `"No pending requests."`
*   **And** I see `"No upcoming trips."`

### US-6.4 — Area admin home dashboard

#### Scenario: Area admin home shows scoped pending requests and maintenance vehicles
*   **Given** I am signed in as an area admin for Athletics
*   **And** Athletics has a pending request and a vehicle in maintenance
*   **And** Maintenance area has different pending/maintenance data
*   **When** I open home
*   **Then** I see only Athletics pending requests and maintenance vehicles

### US-6.5 — Check out and check in a vehicle

#### Scenario: Driver checks out then checks in
*   **Given** I am signed in as the driver on an assignment
*   **When** I check out with start mileage `50000`
*   **And** I check in with end mileage `50120`, fuel `8.5`, and issues `"Scratched bumper"`
*   **Then** the trip log stores those values with `pickedUpAt` and `returnedAt` set

#### Scenario: Driver cannot check out another driver’s assignment
*   **Given** I am signed in as a user who is not the assignment’s driver and not an admin
*   **When** I `POST` check-out for that assignment
*   **Then** the API returns `403` with `{ "message": "You do not have permission for this action." }`

### US-6.6 — Mileage updates on check-in

#### Scenario: Check-in updates vehicle current mileage
*   **Given** a trip is checked out with start mileage `50000`
*   **When** the driver checks in with end mileage `50120`
*   **Then** the vehicle’s `currentMileage` is `50120`

### US-6.7 — Vehicle trip history

#### Scenario: Admin views trip history and issues
*   **Given** I am signed in as an admin
*   **And** a vehicle has completed trip logs with issues
*   **When** I open that vehicle’s trip history
*   **Then** I see the trips newest first including reported issues

#### Scenario: Area admin cannot view another area’s vehicle history
*   **Given** I am signed in as an area admin for Athletics
*   **When** I `GET /vehicle/vehicles/:vehicleId/trip-logs` for a Maintenance vehicle
*   **Then** the API returns `404` with `{ "message": "Vehicle not found." }`

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-6.1 | Admin views weekly assignments on the calendar | `backend/tests/calendar.test.js` | `Admin views weekly assignments on the calendar` |
| US-6.1 | Area admin calendar is limited to managed areas | `backend/tests/calendar.test.js` | `Area admin calendar is limited to managed areas` |
| US-6.1 | Admin filters calendar by area and vehicle | `frontend/tests/Calendar.test.js` | `Admin filters calendar by area and vehicle` |
| US-6.2 | User sees free vehicles for a type and date range | `backend/tests/availability.test.js` | `User sees free vehicles for a type and date range` |
| US-6.2 | Availability rejects invalid date range | `backend/tests/availability.test.js` | `Availability rejects invalid date range` |
| US-6.3 | Requestor home shows pending requests and upcoming trips | `backend/tests/dashboard.test.js` | `Requestor home shows pending requests and upcoming trips` |
| US-6.3 | Requestor home empty states | `frontend/tests/HomeDashboard.test.js` | `Requestor home empty states` |
| US-6.4 | Area admin home shows scoped pending requests and maintenance vehicles | `backend/tests/dashboard.test.js` | `Area admin home shows scoped pending requests and maintenance vehicles` |
| US-6.5 | Driver checks out then checks in | `backend/tests/tripLogs.test.js` | `Driver checks out then checks in` |
| US-6.5 | Driver cannot check out another driver’s assignment | `backend/tests/tripLogs.test.js` | `Driver cannot check out another driver’s assignment` |
| US-6.6 | Check-in updates vehicle current mileage | `backend/tests/tripLogs.test.js` | `Check-in updates vehicle current mileage` |
| US-6.7 | Admin views trip history and issues | `backend/tests/tripLogs.test.js` | `Admin views trip history and issues` |
| US-6.7 | Area admin cannot view another area’s vehicle history | `backend/tests/tripLogs.test.js` | `Area admin cannot view another area’s vehicle history` |

*(Omit P2 rows from the merge DoD if trip logs are cut.)*

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 6 from @features/feature-6-schedule-calendar-trip-logs-dashboard.md on branch `feature/6-schedule-calendar-trip-logs-dashboard`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every non-deferred Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement Feature 5 assignment writes or Feature 4 request writes.
If Sprint 3 is short, ship P1 only (calendar, availability, dashboards) and leave P2 trip logs deferred per this spec’s cuttable notes.
```

**Reference updates for this feature:** `features/reference/api.md`, `features/reference/data-model.md`, `features/reference/behavior.md`

---

## Definition of Done

*   [ ] P1 backend and frontend implemented (**FR-001**–**FR-011**, **FR-019**–**FR-021**)
*   [ ] P2 trip logs implemented **or** explicitly deferred in Out of Scope / release notes (**FR-012**–**FR-018**)
*   [ ] **Success Criteria** for shipped slice met (**SC-001**–**SC-004**, plus **SC-005** if P2 ships; **SC-006**)
*   [ ] Mapped tests for shipped scenarios pass (`npm test`)
*   [ ] Test Coverage Map updated if P2 deferred (rows removed or marked deferred)
*   [ ] `features/reference/data-model.md` / `api.md` / `behavior.md` updated for what shipped
*   [ ] Feature 1 home placeholder behavior superseded by this dashboard

---

## Out of Scope

*   Creating/editing requests (Feature 4) or writing review fields / creating assignments (Feature 5)
*   Vehicle inventory CRUD and unavailability blocks (Feature 3) except reading status and updating mileage on check-in
*   Push notifications / email reminders
*   Full drag-and-drop scheduling UI beyond calendar display + filters
*   **If cut:** entire trip-log slice (US-6.5–US-6.7, `trip_logs`, check-out/in APIs, mileage update, history UI)

## Delivered from Feature 1

*   Feature 1 `home` placeholder (**Welcome** + role label only) is replaced by this feature’s role-based dashboard content on the same route.
