# Feature: Vehicle Management

**Feature ID:** 5
**Branch pattern:** `feature-5-vehicle-management`
**Status:** Draft
**Created:** 2026-11-04
**Input:** Signed-in area admins review vehicle requests for the areas they administer on one screen; admins review every area. They approve a request by assigning one or more available vehicles from that area (each with an optional approved driver), or deny it with a note. Assignments can change before the trip starts. After the trip, the area admin enters a trip log for each vehicle and marks the request completed. Area admins also maintain the destination list that requestors pick from. Double-booking is prevented by a backend conflict-check service, not by the schema.
**Depends on:** [Feature 1 — User Authentication](feature-1-user-auth.md); [Feature 3 — Vehicles & Unavailability](feature-3-vehicles.md); [Feature 4 — Vehicle Requests](feature-4-vehicle-requests.md)

---



## User Stories



### US-5.1: Select to work with the review queue

**As a** signed-in area admin or admin  
**I want to** open the review queue from the menu  
**So that** I can see requests waiting for a decision

**Priority:** P1  
**Independent test:** Login as area admin, select **Review** on the menu bar; the review view appears  
**Acceptance scenarios:** see ### US-5.1 under Acceptance Criteria
 

### US-5.2: View pending requests

**As a** signed-in area admin  
**I want to** see pending requests for the areas I administer, earliest departure first  
**So that** I handle the most urgent trips first

**Priority:** P1  
**Independent test:** Selecting **Review** lists only pending requests whose `area_id` is in the user's `area_admins` rows, ordered by `departure_at`. An admin sees every area.  
**Acceptance scenarios:** see ### US-5.2 under Acceptance Criteria
 

### US-5.3: Approve a request and assign vehicles

**As a** signed-in area admin  
**I want to** approve a request and assign one or more vehicles to it  
**So that** the requestor has transportation for the trip

**Priority:** P1  
**Independent test:** Open the approve dialog on a pending request, pick at least one vehicle, click **Approve**; the request shows as approved with its vehicles  
**Acceptance scenarios:** see ### US-5.3 under Acceptance Criteria
 

### US-5.4: Deny a request

**As a** signed-in area admin  
**I want to** deny a request with a note explaining why  
**So that** the requestor understands the decision

**Priority:** P1  
**Independent test:** Deny a pending request with a note; it leaves the pending list with status `denied`  
**Acceptance scenarios:** see ### US-5.4 under Acceptance Criteria
 

### US-5.5: See only available vehicles

**As a** signed-in area admin  
**I want to** see only vehicles from the request's area that are available for the trip window  
**So that** I don't assign a vehicle that is retired, in maintenance, blocked, or already booked

**Priority:** P1  
**Independent test:** The vehicle picker excludes other areas' vehicles and vehicles that are `retired`, in `maintenance`, blocked by `vehicle_unavailability`, or on an overlapping approved trip  
**Acceptance scenarios:** see ### US-5.5 under Acceptance Criteria
 

### US-5.6: Warn when a request is not fully covered

**As a** signed-in area admin  
**I want to** be warned when assigned seats are fewer than `passenger_count`, or fewer vehicles are assigned than `vehicles_needed`  
**So that** I can add another vehicle

**Priority:** P2  
**Independent test:** Assign too few seats or vehicles; a warning appears and saving is still allowed  
**Acceptance scenarios:** see ### US-5.6 under Acceptance Criteria
 

### US-5.7: Assign a driver to each vehicle

**As a** signed-in area admin  
**I want to** assign an active, approved driver with a current license to each vehicle  
**So that** every vehicle has someone cleared to drive it

**Priority:** P1  
**Independent test:** The driver picker lists only users with `is_active` true, `is_approved_driver` true, and `license_expiration` on or after the trip's return date  
**Acceptance scenarios:** see ### US-5.7 under Acceptance Criteria
 

### US-5.8: Change or remove an assignment

**As a** signed-in area admin  
**I want to** change or remove an assignment before the trip starts  
**So that** I can react to changes in plans

**Priority:** P2  
**Independent test:** Edit or remove an assignment on an approved request departing in the future; the view updates. After departure, the change is refused.  
**Acceptance scenarios:** see ### US-5.8 under Acceptance Criteria
 

### US-5.9: Refuse conflicting assignments

**As the** application  
**I want to** refuse any assignment that conflicts, even if the UI is bypassed  
**So that** a vehicle is never double-booked

**Priority:** P1  
**Independent test:** `POST /api/review/requests/:requestId/assignments` with a vehicle on an overlapping approved trip returns `409` and stores nothing  
**Acceptance scenarios:** see ### US-5.9 under Acceptance Criteria
 

### US-5.10: Enter trip logs and complete a request

**As a** signed-in area admin  
**I want to** enter the trip log for each assigned vehicle after the trip and mark the request completed  
**So that** mileage, fuel, times, and issues are recorded for every trip

**Priority:** P1  
**Independent test:** On an approved request whose return time has passed, fill in a trip log for each vehicle and click **Complete**; status becomes `completed`  
**Acceptance scenarios:** see ### US-5.10 under Acceptance Criteria
 

### US-5.11: Edit a trip log

**As a** signed-in area admin  
**I want to** edit a trip log on a completed request  
**So that** I can keep trip data accurate

**Priority:** P3  
**Independent test:** Edit a trip log from a completed request; the view updates  
**Acceptance scenarios:** see ### US-5.11 under Acceptance Criteria
 

### US-5.12: Manage destinations

**As a** signed-in area admin  
**I want to** add, rename, and deactivate destinations  
**So that** requestors choose from a dropdown instead of typing repeats

**Priority:** P1  
**Independent test:** Add a destination on the **Destinations** tab; it appears in `GET /api/destinations`. Deactivate it; requestors no longer see it.  
**Acceptance scenarios:** see ### US-5.12 under Acceptance Criteria
 

### US-5.13: Restrict review to area admins and admins

**As the** application  
**I want to** allow only area admins (for their areas) and admins (for all areas) to review requests  
**So that** requestors cannot approve, deny, assign, or log trips

**Priority:** P1  
**Independent test:** Sign in as a requestor — **Review** is hidden; `GET /api/review/requests` returns `403`  
**Acceptance scenarios:** see ### US-5.13 under Acceptance Criteria
 

## Requirements



### Functional Requirements

- **FR-001**: All review endpoints MUST require a valid session (`authenticate`) and `req.user.role` equal to `area_admin` or `admin`. Role `requestor` MUST receive `403` with `{ "message": "Area admin role required." }` and MUST NOT persist a change.
- **FR-002**: An `area_admin` MUST only read or change requests whose `area_id` appears in an `area_admins` row with their `user_id`. An `admin` MUST read and change requests in every area. An out-of-area or unknown `requestId` MUST return `404` with **"Request with id= not found."** Do not use `403` for an out-of-area request.
- **FR-003**: `GET /api/review/requests` MUST return requests in the caller's scope filtered by `status` (default `pending`; also `approved`, `denied`, `completed`), ordered by `departure_at` ascending in the API and in the view. Each request MUST include `requester_name`, `area_name`, `vehicle_type_name`, `destination_name`, `assignments` (with vehicle, driver, and `trip_log`), and `assigned_capacity`.
- **FR-004**: Approve MUST only act on a `pending` request; otherwise `400` with **"Only pending requests can be reviewed."** The body MUST contain at least one assignment; otherwise `400` with **"At least one vehicle is required."** On success, in one transaction, the API MUST create every `vehicle_assignments` row (`assigned_by` = `req.user.id`, `assigned_at` = now), set `status` to `approved`, set `reviewed_by` and `reviewed_at`, and store optional `review_notes`. If any assignment is invalid, nothing is saved.
- **FR-005**: Deny MUST only act on a `pending` request (same `400` as FR-004). `review_notes` MUST be required and trimmed; otherwise `400` with **"A note is required to deny a request."** On the Review UI, an empty note MUST be blocked with **"Required"** and MUST NOT send an API request. On success set `status` to `denied`, `reviewed_by`, and `reviewed_at`.
- **FR-006**: A vehicle is available for `[start, end)` only if: it exists (else `400` with **"Vehicle with id= not found."**); its `status` is `available`; no `vehicle_unavailability` row overlaps the window; and no assignment on another `approved` request overlaps the window. Two windows overlap when `existing_start < end AND start < existing_end`; windows that only touch do not overlap. Requests with status `pending`, `denied`, `cancelled`, or `completed` never block. The request being edited is excluded.
- **FR-007**: An assigned vehicle's `area_id` MUST equal the request's `area_id`; otherwise `400` with **"Vehicle with id= does not belong to this request's area."** This check lives in the route, not in the availability service.
- **FR-008**: `backend/services/vehicleAvailability.js` MUST export `checkVehicleAvailability(vehicleId, start, end, { excludeRequestId, transaction } = {})` returning `{ available, reason }` where `reason` is `null`, `"not_found"`, `"maintenance"`, `"retired"`, `"blocked"`, or `"booked"`. Every write that creates or changes an assignment MUST call it inside the same transaction as the write.
- **FR-009**: If any assigned vehicle is unavailable, the API MUST return `409` with **"Vehicle with id= is not available for this trip."** and MUST NOT save any assignment from that call. This applies to approve, add, and update, whether or not the UI was used.
- **FR-010**: `GET /api/review/requests/:requestId/available-vehicles` MUST return only vehicles in the request's area that pass FR-006 for `[departure_at, return_at)`. Vehicles matching the request's `vehicle_type_id` are listed first. The vehicle picker MUST use this endpoint.
- **FR-011**: A vehicle MUST NOT appear twice on one request. Message: **"A vehicle can only be assigned once per request."** On the Review UI, a duplicate MUST be blocked and MUST NOT send an API request. The API MUST return `400` with that message.
- **FR-012**: `driver_id` is optional. When present it MUST reference a user with `is_active` true, `is_approved_driver` true, and `license_expiration` on or after the date of `return_at`; otherwise `400` with **"Driver with id= is not an approved driver with a current license."** A driver MUST NOT be on two vehicles of one request; message **"A driver can only be assigned to one vehicle per request."** (UI blocks without an API call; API returns `400`). `GET /api/review/requests/:requestId/eligible-drivers` MUST return only eligible drivers; the driver picker MUST use it.
- **FR-013**: The UI MUST show a non-blocking `<v-alert type="warning">` when assigned capacity is less than `passenger_count` (**"Assigned seats () are fewer than passengers ()."**) or fewer vehicles than `vehicles_needed` are assigned (**" of  requested vehicles assigned."**). The API MUST NOT reject on capacity or vehicle count.
- **FR-014**: Adding, updating, or deleting an assignment MUST only be allowed on an `approved` request whose `departure_at` is in the future; otherwise `400` with **"Assignments cannot change after the trip starts."** Updates reset `assigned_by` and `assigned_at`. Deleting the last assignment MUST return `400` with **"An approved request must keep at least one vehicle."** Unknown `assignmentId`, or one on a different request, MUST return `404` with **"Assignment with id= not found."**
- **FR-015**: Complete MUST only act on an `approved` request whose `return_at` has passed; otherwise `400` with **"Only approved requests whose trip has ended can be completed."** The body MUST contain exactly one trip log per assignment; otherwise `400` with **"A trip log is required for every assigned vehicle."** `start_mileage`, `end_mileage`, `picked_up_at`, and `returned_at` are required; `fuel_added_gallons` (≥ 0) and `issues_reported` are optional. `end_mileage` MUST be ≥ `start_mileage` (**"End mileage must be greater than or equal to start mileage."**). `returned_at` MUST be ≥ `picked_up_at` (**"Return time must be after pick-up time."**). On the Review UI, missing fields show **"Required"** and invalid values show those messages; no API request is sent. On success, in one transaction, insert the `trip_logs` rows and set `status` to `completed`.
- **FR-016**: `PUT /api/review/trip-logs/:tripLogId` MUST only act on a trip log whose request is `completed` and in the caller's scope; otherwise `404` with **"Trip log with id= not found."** Same field rules as FR-015. `assignment_id` cannot change.
- **FR-017**: The API MUST ignore client-supplied `status`, `reviewed_by`, `reviewed_at`, `assigned_by`, `assigned_at`, and `request_id`. `reviewed_by` and `assigned_by` come from `req.user.id`; `request_id` comes from the URL.
- **FR-018**: `GET /api/destinations` MUST return active destinations ordered by `name` to any authenticated user. `POST` and `PUT` MUST require `area_admin` or `admin` (else `403` with **"Area admin role required."**). `name` MUST be required, trimmed, at most 255 characters, and unique ignoring case. Duplicate message: **"A destination named  already exists."** `PUT` may change `name` and `is_active`. There is no delete. Unknown `destinationId` → `404` with **"Destination with id= not found."**
- **FR-019**: Unauthenticated API requests MUST return `401`. Unauthenticated navigation to `/review` MUST redirect to `login`. A `requestor` MUST NOT see **Review** in `MenuBar`, and navigation to `/review` MUST redirect to `home`.
- **FR-020**: This feature MUST deliver the review UI as a **single view** in `ReviewQueue.vue` (tabs and dialogs). No sidebar/main split.

---



## Assumptions

- Feature 1 auth (`users.role` in `admin`, `area_admin`, `requestor`; `authenticate`; `MenuBar`) MUST be merged to dev before implementing this feature. `users` has `is_approved_driver`, `license_expiration`, and `is_active`.
- `areas` and `area_admins` exist as in the ERD. Tests may seed them. This feature reads them and does not manage them.
- Feature 3 (`vehicle_types`, `vehicles`, `vehicle_unavailability`) MUST be merged to dev. Tests may seed vehicles.
- Feature 4 (`requests`) MUST be merged to dev. Feature 4 creates requests with status `pending` and owns `cancelled`.
- Feature 4 replaces `requests.destination` with `requests.destination_id`, and its request form uses `GET /api/destinations`. This feature owns the `destinations` table and migration.
- Until Features 3 and 4 merge, the conflict-check service may be built and tested against seed data.
- All datetimes are stored and compared in UTC. "Now" is the server clock.
- API mount for this resource is `/api/…`. Use `/api/review` and `/api/destinations`.



## Edge Cases

- Approve with no vehicles → client block; **"At least one vehicle is required."**; no API call.
- Deny with empty or whitespace-only note → client block; **"Required"**; no API call. API → `400`.
- Approve or deny a request that is no longer `pending` → `400` with **"Only pending requests can be reviewed."**
- Two admins assign the same vehicle to overlapping trips at the same time → only one succeeds; the other gets `409`.
- Trip windows that only touch → not a conflict.
- Vehicle on an overlapping `pending`, `denied`, `cancelled`, or `completed` request → not a conflict.
- Vehicle from another area → `400`.
- Vehicle of a different type than requested → allowed; listed after matching types.
- `passenger_count` is null → no capacity warning.
- Updating an assignment with its current vehicle → not a conflict.
- Driver inactive, not approved, or license expires before return → not eligible.
- Change or remove an assignment after departure → `400`.
- Remove the last assignment → `400`.
- Complete before `return_at`, or with a trip log missing for any vehicle → `400`; nothing saved.
- Duplicate destination differing only in case or spaces → `400`.
- Deactivated destination → hidden from requestors; existing requests still show its name.
- Out-of-area `requestId` → `404`. Requestor on any review endpoint → `403`. No session → `401`.



## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: A signed-in area admin can view, approve, deny, reassign, log, and complete requests for their areas on one screen.
- **SC-003**: No combination of API calls can produce two `approved` requests with the same vehicle in overlapping windows.
- **SC-004**: `checkVehicleAvailability` has unit tests for every `reason` and the touching-windows case.
- **SC-005**: Every `completed` request has exactly one `trip_logs` row per assignment.
- **SC-006**: `npm test` passes for the review and destinations APIs, the availability service, and review view behavior.

---



## Data Ownership & Isolation

Requests are **owned by the requestor** (Feature 4). This feature owns the review fields on `requests`, plus `vehicle_assignments`, `trip_logs`, and `destinations`. Only `area_admin` (for their areas) and `admin` (for all areas) may review.


| Rule                | Requirement                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Read scope**      | `area_admin`: requests whose `area_id` is in their `area_admins` rows. `admin`: all requests.                                                                                                                    |
| **Write scope**     | Approve, deny, assignments, trip logs, and complete only within read scope, and only for `area_admin` or `admin`.                                                                                                |
| **Review fields**   | `status` (approved/denied/completed), `reviewed_by`, `reviewed_at`, `review_notes` are written only by this feature.                                                                                             |
| **Trip logs**       | Entered only by `area_admin` / `admin`. Requestors and drivers do not enter trip logs.                                                                                                                           |
| **Destinations**    | Any authenticated user MAY `GET`. Only `area_admin` / `admin` create and change them.                                                                                                                            |
| **Missing request** | Unknown or out-of-area `requestId` → `404` with `{ "message": "Request with id=<id> not found." }`.                                                                                                              |
| **Non-reviewer**    | `requestor` on review or destination-write endpoints → `403` with `{ "message": "Area admin role required." }`.                                                                                                  |
| **UI scope**        | **Review** menu and `/review` are for `area_admin` and `admin`. Requestors do not see this view.                                                                                                                 |
| **Implementation**  | Use `authenticate` on all endpoints, then `requireAreaAdmin`. Scope every request query by the caller's areas (except `admin`). Every assignment write calls `checkVehicleAvailability` in the same transaction. |


---



## API Requirements


| Method   | Endpoint                                                    | Auth            | Purpose                                                    |
| -------- | ----------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| `GET`    | `/api/review/requests?status=pending`                       | Yes, area admin | List requests in scope by status, earliest departure first |
| `GET`    | `/api/review/requests/:requestId/available-vehicles`        | Yes, area admin | Vehicles available for that request                        |
| `GET`    | `/api/review/requests/:requestId/eligible-drivers`          | Yes, area admin | Drivers eligible for that request                          |
| `POST`   | `/api/review/requests/:requestId/approve`                   | Yes, area admin | Approve and create assignments                             |
| `POST`   | `/api/review/requests/:requestId/deny`                      | Yes, area admin | Deny with a note                                           |
| `POST`   | `/api/review/requests/:requestId/assignments`               | Yes, area admin | Add a vehicle before departure                             |
| `PUT`    | `/api/review/requests/:requestId/assignments/:assignmentId` | Yes, area admin | Change vehicle or driver before departure                  |
| `DELETE` | `/api/review/requests/:requestId/assignments/:assignmentId` | Yes, area admin | Remove a vehicle before departure                          |
| `POST`   | `/api/review/requests/:requestId/complete`                  | Yes, area admin | Save trip logs and mark completed                          |
| `PUT`    | `/api/review/trip-logs/:tripLogId`                          | Yes, area admin | Edit a trip log                                            |
| `GET`    | `/api/destinations`                                         | Yes             | List active destinations                                   |
| `POST`   | `/api/destinations`                                         | Yes, area admin | Create a destination                                       |
| `PUT`    | `/api/destinations/:destinationId`                          | Yes, area admin | Rename or deactivate a destination                         |


"Area admin" means role `area_admin` or `admin`.

**Approve request body:**

```json
{
  "review_notes": "Use the north lot.",
  "assignments": [
    { "vehicle_id": 3, "driver_id": 12 },
    { "vehicle_id": 7, "driver_id": null }
  ]
}
```

**Deny request body:**

```json
{ "review_notes": "No vans available that weekend." }
```

**Add / update assignment body:**

```json
{ "vehicle_id": 3, "driver_id": 12 }
```

**Complete request body:**

```json
{
  "trip_logs": [
    {
      "assignment_id": 101,
      "start_mileage": 48210,
      "end_mileage": 48422,
      "fuel_added_gallons": 9.5,
      "picked_up_at": "2026-11-20T13:45:00.000Z",
      "returned_at": "2026-11-20T22:10:00.000Z",
      "issues_reported": "Check engine light came on near Stroud."
    }
  ]
}
```

**Edit trip log body:** same fields as one `trip_logs` entry, without `assignment_id`.

**Destination body:**

```json
{ "name": "Tulsa – Union High School", "is_active": true }
```

Do not send `id`, `status`, `reviewed_by`, `reviewed_at`, `assigned_by`, `assigned_at`, or `request_id`. If present, ignore them (FR-017).

**Request success response** (`200`):

```json
{
  "id": 41,
  "requester_id": 9,
  "requester_name": "Jamie Lee",
  "area_id": 2,
  "area_name": "Athletics",
  "vehicle_type_id": 1,
  "vehicle_type_name": "Van",
  "vehicles_needed": 2,
  "passenger_count": 18,
  "purpose": "Away game",
  "destination_id": 5,
  "destination_name": "Tulsa – Union High School",
  "departure_at": "2026-11-20T14:00:00.000Z",
  "return_at": "2026-11-20T22:00:00.000Z",
  "status": "approved",
  "reviewed_by": 4,
  "reviewed_at": "2026-11-04T15:30:00.000Z",
  "review_notes": "Use the north lot.",
  "assigned_capacity": 15,
  "assignments": [
    {
      "id": 101,
      "request_id": 41,
      "vehicle_id": 3,
      "vehicle_name": "Van 12",
      "license_plate": "OC-1234",
      "capacity": 15,
      "driver_id": 12,
      "driver_name": "Sam Ortiz",
      "assigned_by": 4,
      "assigned_at": "2026-11-04T15:30:00.000Z",
      "trip_log": null
    }
  ],
  "created_at": "2026-11-01T10:00:00.000Z",
  "updated_at": "2026-11-04T15:30:00.000Z"
}
```

Name fields, `capacity`, `license_plate`, and `assigned_capacity` are joined or computed at response time. They are not columns on `vehicle_assignments`. Approve, deny, complete, and every assignment write (including `DELETE`) return the updated request.

**Destination success response** (`200` / `201`):

```json
{
  "id": 5,
  "name": "Tulsa – Union High School",
  "is_active": true,
  "created_at": "2026-11-04T15:00:00.000Z",
  "updated_at": "2026-11-04T15:00:00.000Z"
}
```

**Error response:** `{ "message": "Human-readable explanation." }` with appropriate HTTP status.  
**Not found:** unknown or out-of-area `requestId` → `404` with `{ "message": "Request with id=<id> not found." }`. Unknown `assignmentId`, `tripLogId`, or `destinationId` → `404` with the matching message (FR-014, FR-016, FR-018). Unknown `vehicle_id` → `400` (FR-006). Conflicting vehicle → `409` (FR-009). Requestor → `403` (FR-001).

---



## Screen Requirements



### [View: Review] — route name `review` — path `/review` — `ReviewQueue.vue`

- Heading: **Review Requests**
- Tabs (`v-tabs`): **Pending** (default), **Approved**, **Denied**, **Completed**, **Destinations**.
- List: `v-table`; columns **departure**, **return**, **area**, **requestor**, **destination**, **purpose**, **vehicle type × needed**, **passengers**, and **vehicles** (Approved and Completed tabs); rows ordered by departure (FR-003).
- Icon-only row actions use `size="small"` and accessible `aria-label`s:
  - Pending rows: **Approve request**, **Deny request**
  - Approved rows: **Manage assignments**, **Complete request** (enabled only after `return_at`)
  - Completed rows: **View trip logs** (with **Edit trip log** per vehicle)
- **Approve Request** `<v-dialog>`:
  - Read-only summary: departure, return, destination, purpose, vehicle type × needed, passengers.
  - One row per vehicle: **Vehicle** (`v-select`, options from `available-vehicles`) and **Driver** (`v-select`, optional, options from `eligible-drivers`). Opens with `vehicles_needed` rows. **+ Add vehicle** adds a row; a trash icon removes one.
  - **Notes** (`v-textarea`, optional).
  - Warnings (FR-013) update as vehicles change.
  - Actions: **Approve** (`oc-cta`) / **Cancel** (secondary `variant="text"` or `outlined`).
- **Deny Request** `<v-dialog>`: **Reason** (`v-textarea`, required). **Deny** (`oc-cta`) / **Cancel** (secondary).
- **Manage Assignments** `<v-dialog>`: current vehicles with **Edit assignment** and **Remove assignment** icon actions and **+ Add vehicle**. Same pickers and warnings as Approve. After departure, controls are disabled with **"Assignments are locked once the trip starts."** **Save** (`oc-cta`) / **Close** (secondary).
- **Complete Request** `<v-dialog>`: one section per vehicle with **Start Mileage**, **End Mileage**, **Picked Up At**, **Returned At** (required), **Fuel Added (gallons)** and **Issues Reported** (optional). **Complete** (`oc-cta`) / **Cancel** (secondary).
- **Edit Trip Log** `<v-dialog>`: same fields for one vehicle, pre-filled. **Save Trip Log** (`oc-cta`) / **Cancel** (secondary).
- **Destinations** tab: `v-table` with **name** and **active**; **+ New destination** (`oc-cta`) opens **Add Destination** `<v-dialog>` (**Name**); **Edit destination** row action opens **Edit Destination** `<v-dialog>` (**Name**, **Active** switch). **Create** / **Save Destination** (`oc-cta`) / **Cancel** (secondary).
- Client-side validation: required fields use inline rules (`"Required"`); duplicate vehicle, duplicate driver, mileage, and time rules show the FR messages. Invalid submit does not send an API request.
- A `409` shows the message in a `<v-alert type="error">` inside the open dialog and reloads the vehicle picker; the dialog stays open.
- **Empty state:** **"No requests to review."** on request tabs; **"No destinations yet. Create your first destination."** on Destinations.
- **Loading state:** skeleton or progress indicator while data is fetching.
- **Error state:** `<v-alert type="error">` for API failures.
- Area admin only: **Review** and `/review` are for `area_admin` and `admin`. Requestors do not see **Review**. Unauthenticated navigation redirects to `login`; requestor navigation redirects to `home`.
- Dialogs live in `ReviewQueue.vue` (or child presentational dialogs). No sidebar/main split.
**App chrome**
- Use the `MenuBar` introduced in [Feature 1](feature-1-user-auth.md). Do **not** create a second `MenuBar`. Do **not** hide it on `login` / `register`.
- Add **Review** (allowed roles `area_admin`, `admin`; navigates to `/review`) to `MenuBar`. Keep name and **Sign out** from Feature 1.
- Requestors MUST NOT see **Review**.
- After login, the user remains on Feature 1 `home`. US-5.1 is selecting **Review** in the menu.

---



## Key Entities

- **Request** (Feature 4): a trip a requestor asked for. This feature writes only `status`, `reviewed_by`, `reviewed_at`, and `review_notes`.
- **Vehicle Assignment**: one vehicle (and optional driver) on one approved request. The trip window comes from the request.
- **Trip Log**: what happened on one assignment (mileage, fuel, pick-up and return times, issues). Entered by the area admin. At most one per assignment.
- **Destination**: a reusable place requestors choose from. Managed by area admins.

---



## Data Model Requirements

Tables match the team ERD (Vehicle Scheduling – OC Fleet). The only addition is `destinations` and `requests.destination_id`.
 

### `vehicle_assignments` table


| Field         | Type       | Rules                                          |
| ------------- | ---------- | ---------------------------------------------- |
| `id`          | INTEGER PK | Auto-increment                                 |
| `request_id`  | INTEGER FK | Required; references `requests.id` (Feature 4) |
| `vehicle_id`  | INTEGER FK | Required; references `vehicles.id` (Feature 3) |
| `driver_id`   | INTEGER FK | Optional; references `users.id`                |
| `assigned_by` | INTEGER FK | References `users.id`; set from the session    |
| `assigned_at` | DATETIME   | Set on create and update                       |


Unique index on (`request_id`, `vehicle_id`). Index on `vehicle_id`. Sequelize `timestamps: false`. No schema-level overlap constraint (FR-008).
 

### `trip_logs` table


| Field                | Type         | Rules                                                 |
| -------------------- | ------------ | ----------------------------------------------------- |
| `id`                 | INTEGER PK   | Auto-increment                                        |
| `assignment_id`      | INTEGER FK   | Required; unique; references `vehicle_assignments.id` |
| `start_mileage`      | INTEGER      | Required                                              |
| `end_mileage`        | INTEGER      | Required; ≥ `start_mileage`                           |
| `fuel_added_gallons` | DECIMAL(6,2) | Optional; ≥ 0                                         |
| `picked_up_at`       | DATETIME     | Required                                              |
| `returned_at`        | DATETIME     | Required; ≥ `picked_up_at`                            |
| `issues_reported`    | TEXT         | Optional                                              |


Sequelize `timestamps: false`.
 

### `destinations` table (new)


| Field        | Type        | Rules                                   |
| ------------ | ----------- | --------------------------------------- |
| `id`         | INTEGER PK  | Auto-increment                          |
| `name`       | STRING(255) | Required; trimmed; unique ignoring case |
| `is_active`  | BOOLEAN     | Default `true`                          |
| `created_at` | DATETIME    | Sequelize timestamps                    |
| `updated_at` | DATETIME    | Sequelize timestamps                    |




### Changes to `requests` (Feature 4 table)

- Replace `destination` with `destination_id` (INTEGER FK → `destinations.id`).
- This feature writes `status` (`approved`, `denied`, `completed`), `reviewed_by`, `reviewed_at`, and `review_notes`.



### Associations (in `models/index.js`)

- VehicleAssignment belongsTo Request (`request_id`). Request hasMany VehicleAssignment (`as: 'assignments'`).
- VehicleAssignment belongsTo Vehicle (`vehicle_id`). Vehicle hasMany VehicleAssignment.
- VehicleAssignment belongsTo User as `driver` (`driver_id`) and as `assigner` (`assigned_by`).
- TripLog belongsTo VehicleAssignment (`assignment_id`). VehicleAssignment hasOne TripLog (`as: 'trip_log'`).
- Request belongsTo User as `reviewer` (`reviewed_by`).
- Request belongsTo Destination (`destination_id`). Destination hasMany Request.
- User belongsToMany Area through `area_admins`.

---



## Acceptance Criteria (Gherkin)



### US-5.1 — Select to work with the review queue



#### Scenario: Menu Selection

- **Given** I am signed in as a user with role `area_admin`
- **When** I click **Review** in Menu Bar
- **Then** the review view is displayed



### US-5.2 — View pending requests



#### Scenario: Area admin sees pending requests for their areas

- **Given** I am signed in as an `area_admin` for area `Athletics`
- **And** pending requests exist in `Athletics` departing on different dates
- **And** a pending request exists in area `Music`
- **When** I view the review list
- **Then** the API returns `200` with only the `Athletics` pending requests
- **And** the rows are ordered by departure



#### Scenario: Admin sees pending requests for every area

- **Given** I am signed in as a user with role `admin`
- **And** pending requests exist in `Athletics` and `Music`
- **When** I view the review list
- **Then** I see the pending requests from both areas



#### Scenario: There are no requests to review

- **Given** I am signed in as an `area_admin`
- **And** there are no pending requests in my areas
- **When** I view the review list
- **Then** I see **"No requests to review."**

---



### US-5.3 — Approve a request and assign vehicles



#### Scenario: Area admin approves a request with one vehicle

- **Given** I am signed in as an `area_admin` for the request's area
- **And** a pending request exists for `2026-11-20 14:00`–`22:00` with 12 passengers
- **And** vehicle `Van 12` (capacity 15) in that area is available for that window
- **When** I click **Approve request**, select `Van 12`, and click **Approve**
- **Then** the API returns `200` with `status` `approved`, `reviewed_by`, `reviewed_at`, and one assignment for `Van 12`
- **And** the dialog closes
- **And** the request is not on the **Pending** tab



#### Scenario: Area admin approves a request with multiple vehicles

- **Given** a pending request with 25 passengers and `vehicles_needed` 2
- **And** `Van 12` and `Van 7` (capacity 15 each) are available in that area
- **When** I select both vehicles and click **Approve**
- **Then** the API returns `200` with two assignments and `assigned_capacity` `30`



#### Scenario: Area admin approves with no vehicles

- **Given** the approve dialog is displayed with no vehicle rows
- **When** I click **Approve**
- **Then** no API call is made
- **And** I see **"At least one vehicle is required."**



#### Scenario: Area admin selects the same vehicle twice

- **Given** the approve dialog is displayed
- **When** I select `Van 12` in two rows and click **Approve**
- **Then** no API call is made
- **And** I see **"A vehicle can only be assigned once per request."**



#### Scenario: Area admin approves a request that is no longer pending

- **Given** a request has already been approved
- **When** I send `POST /api/review/requests/:requestId/approve`
- **Then** the API returns `400` with `{ "message": "Only pending requests can be reviewed." }`



#### Scenario: Approve saves nothing when one vehicle conflicts

- **Given** a pending request
- **And** `Van 12` is available and `Van 7` is on an overlapping approved trip
- **When** I send `POST /api/review/requests/:requestId/approve` with both vehicles
- **Then** the API returns `409`
- **And** the request is still `pending`
- **And** no assignments are stored

---



### US-5.4 — Deny a request



#### Scenario: Area admin denies a request with a note

- **Given** a pending request in my area
- **When** I click **Deny request**, enter `No vans that weekend.`, and click **Deny**
- **Then** the API returns `200` with `status` `denied` and `review_notes` `No vans that weekend.`
- **And** the dialog closes



#### Scenario: Area admin denies a request without a note

- **Given** the deny dialog is displayed
- **When** I leave **Reason** empty and click **Deny**
- **Then** no API call is made
- **And** I see the message **"Required"**



#### Scenario: Area admin denies without a note via the API

- **Given** a pending request in my area
- **When** I send `POST /api/review/requests/:requestId/deny` with `review_notes` `"   "`
- **Then** the API returns `400` with `{ "message": "A note is required to deny a request." }`
- **And** the request is still `pending`

---



### US-5.5 — See only available vehicles



#### Scenario: Available vehicles exclude other areas and unavailable vehicles

- **Given** a pending `Athletics` request for `2026-11-20 14:00`–`22:00`
- **And** in `Athletics`: `Van 1` is available, `Van 2` is `retired`, `Van 3` is in `maintenance`, `Van 4` is blocked `2026-11-20 08:00`–`16:00`, and `Van 5` is on an approved trip `2026-11-20 20:00`–`23:00`
- **And** `Van 6` is available but belongs to `Music`
- **When** I request `GET /api/review/requests/:requestId/available-vehicles`
- **Then** the API returns only `Van 1`



#### Scenario: Area admin assigns a vehicle from another area

- **When** I approve an `Athletics` request with a `Music` vehicle
- **Then** the API returns `400` with `{ "message": "Vehicle with id=<id> does not belong to this request's area." }`



#### Scenario: Vehicles on non-approved requests remain available

- **Given** `Van 6` is on an overlapping request whose status is `completed`, `denied`, or `cancelled`
- **When** I call `checkVehicleAvailability` for `Van 6`
- **Then** it returns `{ available: true, reason: null }`



#### Scenario: Touching trip windows do not conflict

- **Given** `Van 1` is on an approved trip returning `2026-11-20 14:00`
- **When** I call `checkVehicleAvailability` for `2026-11-20 14:00`–`22:00`
- **Then** it returns `{ available: true, reason: null }`



#### Scenario: Availability service reports each reason

- **Given** seed vehicles covering each case
- **When** I call `checkVehicleAvailability` for each
- **Then** it returns `not_found`, `maintenance`, `retired`, `blocked`, and `booked` respectively

---



### US-5.6 — Warn when a request is not fully covered



#### Scenario: Capacity warning is shown and saving is allowed

- **Given** a pending request with 20 passengers
- **And** the approve dialog is displayed
- **When** I select one vehicle with capacity 15
- **Then** I see **"Assigned seats (15) are fewer than passengers (20)."**
- **And** clicking **Approve** succeeds



#### Scenario: Vehicle count warning is shown and saving is allowed

- **Given** a pending request with `vehicles_needed` 2
- **When** I assign one vehicle
- **Then** I see **"1 of 2 requested vehicles assigned."**
- **And** clicking **Approve** succeeds



#### Scenario: No warning when the request is covered

- **Given** a pending request with 12 passengers and `vehicles_needed` 1
- **When** I select one vehicle with capacity 15
- **Then** no warning is shown

---



### US-5.7 — Assign a driver to each vehicle



#### Scenario: Eligible drivers exclude inactive, unapproved, and expired drivers

- **Given** a request returning `2026-11-20`
- **And** `Sam` is active, approved, with `license_expiration` `2027-05-01`
- **And** `Ana` is active, approved, with `license_expiration` `2026-11-10`
- **And** `Lee` is active and not approved
- **And** `Kim` is approved with a current license but not active
- **When** I request `GET /api/review/requests/:requestId/eligible-drivers`
- **Then** the API returns only `Sam`



#### Scenario: Area admin assigns an ineligible driver

- **When** I approve with an assignment whose `driver_id` is `Ana`
- **Then** the API returns `400` with `{ "message": "Driver with id=<id> is not an approved driver with a current license." }`
- **And** nothing is stored



#### Scenario: Area admin assigns the same driver twice

- **When** I approve with two assignments that share one `driver_id`
- **Then** the API returns `400` with `{ "message": "A driver can only be assigned to one vehicle per request." }`

---



### US-5.8 — Change or remove an assignment



#### Scenario: Area admin changes a vehicle before the trip starts

- **Given** an approved request departing in the future with `Van 12`
- **And** `Van 7` is available in that area
- **When** I edit the assignment to `Van 7` and click **Save**
- **Then** the API returns `200` with the assignment on `Van 7`
- **And** the dialog closes



#### Scenario: Keeping the same vehicle is not a conflict

- **Given** an approved request with `Van 12`
- **When** I update that assignment with `Van 12` and a new driver
- **Then** the API returns `200`



#### Scenario: Area admin removes one of several assignments

- **Given** an approved request with `Van 12` and `Van 7` departing in the future
- **When** I remove `Van 7`
- **Then** the API returns `200` with only `Van 12`



#### Scenario: Area admin removes the last assignment

- **Given** an approved request with one assignment
- **When** I send `DELETE` for that assignment
- **Then** the API returns `400` with `{ "message": "An approved request must keep at least one vehicle." }`



#### Scenario: Area admin changes an assignment after the trip starts

- **Given** an approved request whose departure has passed
- **When** I send `PUT` for one of its assignments
- **Then** the API returns `400` with `{ "message": "Assignments cannot change after the trip starts." }`
- **And** the Manage Assignments dialog shows **"Assignments are locked once the trip starts."**



#### Scenario: Area admin updates an assignment that is missing

- **When** I send `PUT` or `DELETE` for an `assignmentId` that does not exist or is on another request
- **Then** the API returns `404` with `{ "message": "Assignment with id=<id> not found." }`

---



### US-5.9 — Refuse conflicting assignments



#### Scenario: Area admin adds a conflicting vehicle via the API

- **Given** `Van 12` is on an approved request `2026-11-20 14:00`–`22:00`
- **And** another approved request in the same area overlaps that window
- **When** I send `POST /api/review/requests/:requestId/assignments` with `Van 12`
- **Then** the API returns `409` with `{ "message": "Vehicle with id=<id> is not available for this trip." }`
- **And** no assignment is stored



#### Scenario: Two admins assign the same vehicle at the same time

- **Given** two pending requests with overlapping windows
- **When** both are approved at the same time with `Van 12`
- **Then** exactly one returns `200`
- **And** the other returns `409`

---



### US-5.10 — Enter trip logs and complete a request



#### Scenario: Area admin completes a finished trip

- **Given** an approved request with `Van 12` and `Van 7` whose return time has passed
- **When** I click **Complete request**
- **And** I enter start mileage, end mileage, picked up at, and returned at for both vehicles
- **And** I click **Complete**
- **Then** the API returns `200` with `status` `completed`
- **And** each assignment has a `trip_log` with the values I entered
- **And** the dialog closes



#### Scenario: Area admin completes with a missing field

- **Given** the complete dialog is displayed
- **When** I leave **End Mileage** empty and click **Complete**
- **Then** no API call is made
- **And** I see the message **"Required"**



#### Scenario: Area admin completes with end mileage below start mileage

- **When** I send `POST /api/review/requests/:requestId/complete` with `start_mileage` `48422` and `end_mileage` `48210`
- **Then** the API returns `400` with `{ "message": "End mileage must be greater than or equal to start mileage." }`
- **And** no trip logs are stored



#### Scenario: Area admin completes with return before pick-up

- **When** I send a trip log whose `returned_at` is before `picked_up_at`
- **Then** the API returns `400` with `{ "message": "Return time must be after pick-up time." }`



#### Scenario: Area admin completes without a trip log for every vehicle

- **Given** a finished approved request with two assignments
- **When** I send `POST /api/review/requests/:requestId/complete` with one trip log
- **Then** the API returns `400` with `{ "message": "A trip log is required for every assigned vehicle." }`



#### Scenario: Area admin completes before the trip ends

- **Given** an approved request whose return time is in the future
- **When** I send `POST /api/review/requests/:requestId/complete`
- **Then** the API returns `400` with `{ "message": "Only approved requests whose trip has ended can be completed." }`

---



### US-5.11 — Edit a trip log



#### Scenario: Area admin edits a trip log and saves

- **Given** a completed request in my area with a trip log for `Van 12`
- **When** I click **Edit trip log**, change **End Mileage**, and click **Save Trip Log**
- **Then** the API returns `200` with the new end mileage
- **And** the dialog closes



#### Scenario: Area admin edits a trip log and cancels

- **Given** the edit trip log dialog is displayed
- **When** I change a field and click **Cancel**
- **Then** the trip log is not updated
- **And** the dialog closes



#### Scenario: Area admin edits a trip log that is missing

- **When** I send `PUT /api/review/trip-logs/:tripLogId` for an id that does not exist or is outside my areas
- **Then** the API returns `404` with `{ "message": "Trip log with id=<id> not found." }`

---



### US-5.12 — Manage destinations



#### Scenario: Area admin creates a destination

- **Given** I am viewing the **Destinations** tab
- **When** I click **+ New destination**, enter `Tulsa – Union High School`, and click **Create**
- **Then** the API returns `201` with the destination
- **And** it appears in the destinations list
- **And** the dialog closes



#### Scenario: Area admin creates a duplicate destination

- **Given** a destination `Tulsa – Union High School` exists
- **When** I create  `tulsa – union high school`
- **Then** the API returns `400` with `{ "message": "A destination named tulsa – union high school already exists." }`



#### Scenario: Deactivated destinations are hidden from requestors

- **Given** I deactivate destination `Old Gym`
- **When** a requestor requests `GET /api/destinations`
- **Then** `Old Gym` is not returned
- **And** existing requests still show `destination_name` `Old Gym`



#### Scenario: Requestor cannot create a destination

- **Given** I am signed in as a `requestor`
- **When** I send `POST /api/destinations`
- **Then** the API returns `403` with `{ "message": "Area admin role required." }`

---



### US-5.13 — Restrict review to area admins and admins



#### Scenario: Area admin cannot review a request outside their areas

- **Given** I am an `area_admin` for `Athletics` only
- **When** I send `POST /api/review/requests/:requestId/approve` for a `Music` request
- **Then** the API returns `404` with `{ "message": "Request with id=<id> not found." }`



#### Scenario: Requestor does not see Review in the menu

- **Given** I am signed in as a user with role `requestor`
- **When** I view the `MenuBar`
- **Then** **Review** is not shown



#### Scenario: Requestor cannot list review requests via the API

- **Given** I am signed in as a user with role `requestor`
- **When** I request `GET /api/review/requests`
- **Then** the API returns `403` with `{ "message": "Area admin role required." }`



#### Scenario: Unauthenticated API request to review

- **Given** I have no valid session token
- **When** I request `GET /api/review/requests`
- **Then** the API returns `401` with an unauthorized message



#### Scenario: Unauthenticated user navigates to review

- **Given** I have no session in `localStorage`
- **When** I navigate to `/review`
- **Then** I am redirected to the login page



#### Scenario: Requestor navigates to review

- **Given** I am signed in as a user with role `requestor`
- **When** I navigate to `/review`
- **Then** I am redirected to home

---



## Test Coverage Map


| Story   | Scenario                                                           | Test file                                                                  | Test name                                                            |
| ------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| US-5.1  | Menu Selection                                                     | `frontend/tests/MenuBar.test.js`, `frontend/tests/ReviewQueue.test.js`     | `Menu Selection`                                                     |
| US-5.2  | Area admin sees pending requests for their areas                   | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin sees pending requests for their areas`                   |
| US-5.2  | Admin sees pending requests for every area                         | `backend/tests/review.test.js`                                             | `Admin sees pending requests for every area`                         |
| US-5.2  | There are no requests to review                                    | `frontend/tests/ReviewQueue.test.js`                                       | `There are no requests to review`                                    |
| US-5.3  | Area admin approves a request with one vehicle                     | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin approves a request with one vehicle`                     |
| US-5.3  | Area admin approves a request with multiple vehicles               | `backend/tests/review.test.js`                                             | `Area admin approves a request with multiple vehicles`               |
| US-5.3  | Area admin approves with no vehicles                               | `frontend/tests/ReviewQueue.test.js`                                       | `Area admin approves with no vehicles`                               |
| US-5.3  | Area admin selects the same vehicle twice                          | `frontend/tests/ReviewQueue.test.js`                                       | `Area admin selects the same vehicle twice`                          |
| US-5.3  | Area admin approves a request that is no longer pending            | `backend/tests/review.test.js`                                             | `Area admin approves a request that is no longer pending`            |
| US-5.3  | Approve saves nothing when one vehicle conflicts                   | `backend/tests/review.test.js`                                             | `Approve saves nothing when one vehicle conflicts`                   |
| US-5.4  | Area admin denies a request with a note                            | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin denies a request with a note`                            |
| US-5.4  | Area admin denies a request without a note                         | `frontend/tests/ReviewQueue.test.js`                                       | `Area admin denies a request without a note`                         |
| US-5.4  | Area admin denies without a note via the API                       | `backend/tests/review.test.js`                                             | `Area admin denies without a note via the API`                       |
| US-5.5  | Available vehicles exclude other areas and unavailable vehicles    | `backend/tests/review.test.js`                                             | `Available vehicles exclude other areas and unavailable vehicles`    |
| US-5.5  | Area admin assigns a vehicle from another area                     | `backend/tests/review.test.js`                                             | `Area admin assigns a vehicle from another area`                     |
| US-5.5  | Vehicles on non-approved requests remain available                 | `backend/tests/vehicleAvailability.test.js`                                | `Vehicles on non-approved requests remain available`                 |
| US-5.5  | Touching trip windows do not conflict                              | `backend/tests/vehicleAvailability.test.js`                                | `Touching trip windows do not conflict`                              |
| US-5.5  | Availability service reports each reason                           | `backend/tests/vehicleAvailability.test.js`                                | `Availability service reports each reason`                           |
| US-5.6  | Capacity warning is shown and saving is allowed                    | `frontend/tests/ReviewQueue.test.js`                                       | `Capacity warning is shown and saving is allowed`                    |
| US-5.6  | Vehicle count warning is shown and saving is allowed               | `frontend/tests/ReviewQueue.test.js`                                       | `Vehicle count warning is shown and saving is allowed`               |
| US-5.6  | No warning when the request is covered                             | `frontend/tests/ReviewQueue.test.js`                                       | `No warning when the request is covered`                             |
| US-5.7  | Eligible drivers exclude inactive, unapproved, and expired drivers | `backend/tests/review.test.js`                                             | `Eligible drivers exclude inactive, unapproved, and expired drivers` |
| US-5.7  | Area admin assigns an ineligible driver                            | `backend/tests/review.test.js`                                             | `Area admin assigns an ineligible driver`                            |
| US-5.7  | Area admin assigns the same driver twice                           | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin assigns the same driver twice`                           |
| US-5.8  | Area admin changes a vehicle before the trip starts                | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin changes a vehicle before the trip starts`                |
| US-5.8  | Keeping the same vehicle is not a conflict                         | `backend/tests/review.test.js`                                             | `Keeping the same vehicle is not a conflict`                         |
| US-5.8  | Area admin removes one of several assignments                      | `backend/tests/review.test.js`                                             | `Area admin removes one of several assignments`                      |
| US-5.8  | Area admin removes the last assignment                             | `backend/tests/review.test.js`                                             | `Area admin removes the last assignment`                             |
| US-5.8  | Area admin changes an assignment after the trip starts             | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin changes an assignment after the trip starts`             |
| US-5.8  | Area admin updates an assignment that is missing                   | `backend/tests/review.test.js`                                             | `Area admin updates an assignment that is missing`                   |
| US-5.9  | Area admin adds a conflicting vehicle via the API                  | `backend/tests/review.test.js`                                             | `Area admin adds a conflicting vehicle via the API`                  |
| US-5.9  | Two admins assign the same vehicle at the same time                | `backend/tests/review.test.js`                                             | `Two admins assign the same vehicle at the same time`                |
| US-5.10 | Area admin completes a finished trip                               | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin completes a finished trip`                               |
| US-5.10 | Area admin completes with a missing field                          | `frontend/tests/ReviewQueue.test.js`                                       | `Area admin completes with a missing field`                          |
| US-5.10 | Area admin completes with end mileage below start mileage          | `backend/tests/review.test.js`                                             | `Area admin completes with end mileage below start mileage`          |
| US-5.10 | Area admin completes with return before pick-up                    | `backend/tests/review.test.js`                                             | `Area admin completes with return before pick-up`                    |
| US-5.10 | Area admin completes without a trip log for every vehicle          | `backend/tests/review.test.js`                                             | `Area admin completes without a trip log for every vehicle`          |
| US-5.10 | Area admin completes before the trip ends                          | `backend/tests/review.test.js`                                             | `Area admin completes before the trip ends`                          |
| US-5.11 | Area admin edits a trip log and saves                              | `backend/tests/review.test.js`, `frontend/tests/ReviewQueue.test.js`       | `Area admin edits a trip log and saves`                              |
| US-5.11 | Area admin edits a trip log and cancels                            | `frontend/tests/ReviewQueue.test.js`                                       | `Area admin edits a trip log and cancels`                            |
| US-5.11 | Area admin edits a trip log that is missing                        | `backend/tests/review.test.js`                                             | `Area admin edits a trip log that is missing`                        |
| US-5.12 | Area admin creates a destination                                   | `backend/tests/destinations.test.js`, `frontend/tests/ReviewQueue.test.js` | `Area admin creates a destination`                                   |
| US-5.12 | Area admin creates a duplicate destination                         | `backend/tests/destinations.test.js`                                       | `Area admin creates a duplicate destination`                         |
| US-5.12 | Deactivated destinations are hidden from requestors                | `backend/tests/destinations.test.js`                                       | `Deactivated destinations are hidden from requestors`                |
| US-5.12 | Requestor cannot create a destination                              | `backend/tests/destinations.test.js`                                       | `Requestor cannot create a destination`                              |
| US-5.13 | Area admin cannot review a request outside their areas             | `backend/tests/review.test.js`                                             | `Area admin cannot review a request outside their areas`             |
| US-5.13 | Requestor does not see Review in the menu                          | `frontend/tests/MenuBar.test.js`                                           | `Requestor does not see Review in the menu`                          |
| US-5.13 | Requestor cannot list review requests via the API                  | `backend/tests/review.test.js`                                             | `Requestor cannot list review requests via the API`                  |
| US-5.13 | Unauthenticated API request to review                              | `backend/tests/review.test.js`                                             | `Unauthenticated API request to review`                              |
| US-5.13 | Unauthenticated user navigates to review                           | `frontend/tests/router.test.js`                                            | `Unauthenticated user navigates to review`                           |
| US-5.13 | Requestor navigates to review                                      | `frontend/tests/router.test.js`                                            | `Requestor navigates to review`                                      |




---



## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 5 from @features/feature-5-vehicle-management.md on branch `feature-5-vehicle-management`.
 
Follow layer order in @features/framework.md (models → services → routes → backend tests → frontend → frontend tests).
Match the team ERD for every column name.
Build backend/services/vehicleAvailability.js first and test it against seed data before wiring routes.
Every assignment write must call checkVehicleAvailability inside the same transaction as the write.
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
Do not add a database-level overlap constraint.
```

**Reference updates for this feature:** `features/reference/data-model.md`, `features/reference/api.md`, `features/reference/behavior.md`

---



## Definition of Done

- [ ] Backend and frontend implemented per this spec (**FR-0NN** satisfied)
- [ ] **Success Criteria (SC-00N)** met
- [ ] All mapped tests pass (`npm test`)
- [ ] Test Coverage Map complete
- [ ] `features/reference/data-model.md` updated (if schema changed)
- [ ] `features/reference/api.md` updated (if API changed)
- [ ] `features/reference/behavior.md` updated (if product rules changed)

---



## Out of Scope

- Creating or editing vehicles, vehicle types, and unavailability windows (Feature 3)
- Creating, editing, or cancelling requests, and the request form's destination dropdown (Feature 4)
- Managing areas and `area_admins` membership
- Calendar view and trip-log reports (Feature 6)
- Driver conflicts across different requests
- Re-checking approved trips when a vehicle later goes into maintenance or is blocked
- Updating `vehicles.current_mileage` from trip logs
- Notifications to requestors on approve or deny
- Reopening a denied or completed request
- Creating `MenuBar` (introduced in [Feature 1](feature-1-user-auth.md); this feature only adds **Review** for `area_admin` and `admin`)

---

