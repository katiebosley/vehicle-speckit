# Feature: Fleet Management

**Feature ID:** 3
**Branch pattern:** `feature/3-fleet-management`
**Status:** Draft
**Created:** 2026-11-01
**Input:** OC areas keep their own cars, trucks, vans, and golf carts. Admins keep the shared list of vehicle types. Admins and area admins add and edit the vehicles in the areas they manage, change vehicle status, and block a vehicle when it cannot be reserved.
**Depends on:** [Feature 1 — Sign-in, Roles & User Management](feature-1-google-auth-user-management.md), [Feature 2 — Areas, Area Admins & Deployment](feature-2-areas-area-admins-deploy.md)

---

## User Stories

### US-3.1: Add, edit, and deactivate vehicle types

**As an** admin
**I want to** add, edit, and deactivate vehicle types
**So that** requestors ask for a real kind of vehicle (car, truck, van, golf cart) and area admins file each vehicle under one

**Priority:** P1
**Independent test:** Open **Vehicle Types** as admin, create `Van`, edit its default passenger capacity, deactivate it; the list shows each change
**Acceptance scenarios:** see ### US-3.1 under Acceptance Criteria

### US-3.2: See the vehicle types I can request

**As a** requestor
**I want to** see only active vehicle types
**So that** the request form can offer a type without showing types the admin has turned off

**Priority:** P1
**Independent test:** As a requestor, `GET /vehicle-t2/vehicle-types` returns active types only, ordered by name
**Acceptance scenarios:** see ### US-3.2 under Acceptance Criteria

### US-3.3: Add and edit vehicles in my areas

**As an** area admin
**I want to** add a vehicle to an area I manage and correct its details later
**So that** the fleet record matches the vehicle OC actually has

**Priority:** P1
**Independent test:** As an area admin for Athletics, create a van with a VIN and plate, then change its color; the fleet list shows the new color
**Acceptance scenarios:** see ### US-3.3 under Acceptance Criteria

### US-3.4: See only vehicles for my areas

**As an** area admin
**I want** vehicles from other areas hidden in the fleet list and refused by the API
**So that** I only maintain the group of vehicles my area owns

**Priority:** P1
**Independent test:** As an area admin for Athletics, the fleet list shows Athletics vehicles only; `GET /vehicle-t2/vehicles/:vehicleId` for a Support Central vehicle returns `404`
**Acceptance scenarios:** see ### US-3.4 under Acceptance Criteria

### US-3.5: Take a vehicle out of service without deleting it

**As an** area admin
**I want to** mark a vehicle in maintenance or retired
**So that** later features will not treat it as available, and the record remains for history

**Priority:** P1
**Independent test:** Edit a vehicle, set status to `maintenance`, save; set it to `retired`. `DELETE /vehicle-t2/vehicles/:vehicleId` is not a route (`404`)
**Acceptance scenarios:** see ### US-3.5 under Acceptance Criteria

### US-3.6: Block a vehicle for a date range

**As an** area admin
**I want to** record a start, an end, and a reason when a vehicle cannot be used
**So that** Feature 5 can refuse to assign it during that window even if its status is still `available`

**Priority:** P1
**Independent test:** On a vehicle, add a block for next week with reason `Oil change`; the vehicle detail lists that window. A second block that overlaps it is refused
**Acceptance scenarios:** see ### US-3.6 under Acceptance Criteria

### US-3.7: Load sample fleet data with the existing seed

**As a** developer
**I want** the Feature 2 seed command to also load vehicle types and a few vehicles
**So that** the team can demo the fleet without typing every row

**Priority:** P2
**Independent test:** On a database that already has the Feature 2 areas, run `npm run seed --prefix backend` twice; the sample types and vehicles exist once each
**Acceptance scenarios:** see ### US-3.7 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Every endpoint in this feature MUST use `authenticate` from Feature 1. No session → `401`.
- **FR-002**: JSON MUST use camelCase. Sequelize models MUST use `underscored: true`. The mount MUST be `/vehicle-t2`
- **FR-003**: `GET /vehicle-t2/vehicle-types` MUST allow every authenticated role. Role `admin` MUST receive every type (active and inactive). Every other role MUST receive only types with `isActive` true. Order MUST be `name` ascending.
- **FR-004**: `POST /vehicle-t2/vehicle-types` and `PUT /vehicle-t2/vehicle-types/:vehicleTypeId` MUST require role `admin`. There MUST be no `DELETE` for types. Other roles → `403` `{ "message": "You do not have permission for this action." }`. Unknown `vehicleTypeId` → `404` `{ "message": "Vehicle type with id=<id> not found." }`.
- **FR-005**: Vehicle type `name` MUST be required, trimmed, at most 50 characters, and unique ignoring case. Missing or blank → `400` `{ "message": "Vehicle type name is required." }`. Too long → `400` `{ "message": "Vehicle type name must be 50 characters or fewer." }`. Duplicate → `400` `{ "message": "Vehicle type name is already taken." }`. `description` is optional text. `defaultPassengerCapacity` is optional; when present it MUST be an integer from 1 to 30, otherwise `400` `{ "message": "Default passenger capacity must be from 1 to 30." }`. `isActive` defaults to `true` on create.
- **FR-006**: Deactivating a type (`isActive` false) MUST return `400` `{ "message": "This vehicle type is still used by a vehicle that is not retired." }` when any vehicle of that type has `status` other than `retired`. Reactivating a type MUST be allowed. A type with only retired vehicles MAY be deactivated.
- **FR-007**: A vehicle type is **usable** when `isActive` is true. Feature 4 MUST be able to treat any other type id as not usable (`400` `{ "message": "Invalid area or vehicle type." }` is Feature 4's message; this feature does not create requests).
- **FR-008**: `GET /vehicle-t2/vehicles` MUST allow `admin` and `area_admin` only. `requestor` → `403` `{ "message": "You do not have permission for this action." }`. `admin` sees every vehicle. `area_admin` sees only vehicles whose `areaId` is in `getManagedAreaIds(req.user)` from Feature 2. Optional query filters: `areaId`, `status` (`available`, `maintenance`, `retired`), `vehicleTypeId`. An `area_admin` who passes an `areaId` outside their managed areas → `403` `{ "message": "You do not manage this area." }`. An `admin` who passes an unknown `areaId` → `404` `{ "message": "Area with id=<id> not found." }`. Results MUST be ordered by `displayName` ascending. The list MUST NOT include the `unavailability` array.
- **FR-009**: `GET /vehicle-t2/vehicles/:vehicleId` MUST allow `admin` and `area_admin`. `admin` may read any vehicle. `area_admin` may read a vehicle only when its `areaId` is in `getManagedAreaIds`. Otherwise, including an unknown id, the response MUST be `404` `{ "message": "Vehicle not found." }` (do not use `403` for a vehicle outside the caller's areas). The body MUST include that vehicle's `unavailability` windows, earliest `startsAt` first.
- **FR-010**: `POST /vehicle-t2/vehicles` and `PUT /vehicle-t2/vehicles/:vehicleId` MUST allow `admin` and `area_admin`. `requestor` → `403` `{ "message": "You do not have permission for this action." }`. On create and whenever `areaId` is sent, that area MUST be in `getManagedAreaIds(req.user)` or the response is `403` `{ "message": "You do not manage this area." }`. The area MUST be active or the response is `400` `{ "message": "Area is not active." }`. On create, and whenever `vehicleTypeId` changes, the type MUST exist and be usable or the response is `400` `{ "message": "Invalid vehicle type." }`. A `PUT` for a vehicle outside the caller's areas, or an unknown vehicle, MUST return `404` `{ "message": "Vehicle not found." }`.
- **FR-011**: A vehicle MUST NOT be hard-deleted. There is no `DELETE /vehicle-t2/vehicles/:vehicleId`. Taking a vehicle out of the fleet is `status: "retired"`.
- **FR-012**: These vehicle fields are required on create. Missing or blank (after trim, for strings) → `400` `{ "message": "All required fields must be provided." }`.
  - `areaId`, `vehicleTypeId`
  - `make` and `model`, each trimmed, at most 50 characters. Too long → `400` `{ "message": "Make must be 50 characters or fewer." }` or `"Model must be 50 characters or fewer."`
  - `year`, an integer from 1990 through the server's current calendar year + 1. Otherwise `400` `{ "message": "Year must be between 1990 and <year>." }` with `<year>` filled in
  - `vin`, trimmed, 6 to 17 letters or digits, stored uppercase, unique ignoring case. Bad format → `400` `{ "message": "VIN must be 6 to 17 letters or digits." }`. Duplicate → `400` `{ "message": "VIN is already in use." }`
  - `purchasedDate` as `YYYY-MM-DD`, not after today (UTC). Otherwise `400` `{ "message": "Purchased date cannot be in the future." }`
  - `color`, trimmed, at most 40 characters. Too long → `400` `{ "message": "Color must be 40 characters or fewer." }`
  - `capacity`, an integer from 1 to 30. Otherwise `400` `{ "message": "Capacity must be from 1 to 30." }`
  - `licensePlate`, trimmed, at most 15 characters, stored uppercase, unique ignoring case. Too long → `400` `{ "message": "License plate must be 15 characters or fewer." }`. Duplicate → `400` `{ "message": "License plate is already in use." }`
  - `licensePlateExpireMonth`, an integer from 1 to 12. Otherwise `400` `{ "message": "License plate expire month must be from 1 to 12." }`
  - `currentMileage`, an integer ≥ 0. Otherwise `400` `{ "message": "Mileage must be 0 or greater." }`
  - `status` one of `available`, `maintenance`, `retired`. Default on create is `available`. Otherwise `400` `{ "message": "Status must be available, maintenance, or retired." }`
  - `name` is optional, trimmed, at most 100 characters. Too long → `400` `{ "message": "Name must be 100 characters or fewer." }`
- **FR-013**: Every vehicle response MUST include `displayName`: `name` when it is non-empty, otherwise `"<year> <make> <model>"`. Responses MUST also include `areaName` and `vehicleTypeName`.
- **FR-014**: The client MUST NOT be able to set `id`, `createdAt`, `updatedAt`, or `displayName`. The server ignores those fields if they are sent.
- **FR-015**: Setting `status` to `retired` MUST return `409` `{ "message": "This vehicle is assigned to a future trip." }` when a `vehicle_assignments` row for this vehicle belongs to a request with `status` `approved` and `returnAt` still in the future. This feature does not create that table. When the table is not in the database yet, the check MUST NOT fail the request (there is nothing to conflict with). 
- **FR-016**: `POST /vehicle-t2/vehicles/:vehicleId/unavailability` with `{ "startsAt", "endsAt", "reason" }` MUST allow `admin` and `area_admin` for a vehicle they can read (same scope as FR-009). Success → `201` with the window. `startsAt` and `endsAt` are required ISO datetimes. `endsAt` MUST be strictly after `startsAt`, otherwise `400` `{ "message": "End must be after start." }`. `reason` MUST be required, trimmed, and at most 255 characters. Blank → `400` `{ "message": "A reason is required." }`. Too long → `400` `{ "message": "Reason must be 255 characters or fewer." }`. `createdBy` MUST be set from `req.user.id`, never from the body.
- **FR-017**: A new or updated window MUST NOT overlap another window on the same vehicle. Overlap is `existing.startsAt < endsAt AND startsAt < existing.endsAt`. Windows that only touch do not overlap. Overlap → `400` `{ "message": "This vehicle is already blocked during that time." }`. The window being updated is excluded from that check.
- **FR-018**: Creating or updating a window that overlaps an approved assignment's trip (`departureAt` / `returnAt` on the request, same overlap test as FR-017) MUST return `409` `{ "message": "This vehicle is assigned to a trip during that time." }`. Same "table missing" rule as FR-015.
- **FR-019**: `PUT /vehicle-t2/vehicles/:vehicleId/unavailability/:unavailabilityId` and `DELETE /vehicle-t2/vehicles/:vehicleId/unavailability/:unavailabilityId` MUST use the same vehicle scope as FR-009. Unknown window, or a window that belongs to a different vehicle → `404` `{ "message": "Unavailability window not found." }`. `DELETE` success → `200` with `{ "message": "Unavailability window removed." }`. Removing a window is allowed; removing a vehicle is not.
- **FR-020**: `MenuBar` MUST add **Vehicle Types** (role `admin`, path `/vehicle-types`) and **Fleet** (roles `admin` and `area_admin`, path `/fleet`). Do not create a second `MenuBar`. The router MUST send any other role to `home` (Feature 1 FR-010). Requestors see neither item.
- **FR-021**: `npm run seed --prefix backend` MUST, after Feature 2's users and areas exist, find-or-create these active types by `name`: **Car** (default capacity 5), **Truck** (3), **Van** (12), **Golf Cart** (4). It MUST find-or-create vehicles by `vin` in the areas **Athletics**, **Support Central**, and **Maintenance** (look areas up by name). At least one vehicle per those three areas, plus one Maintenance vehicle with `status` `maintenance` so a later dashboard has a row to show. The seed MUST NOT delete or overwrite existing rows. Running it twice MUST NOT insert duplicates.

---

## Assumptions

- Feature 1 is on `dev`: Google sign-in, roles `admin`, `area_admin`, and `requestor`, `authenticate`, `requireRole`, and `MenuBar`.
- Feature 2 is on `dev`: `areas`, `area_admins`, `getManagedAreaIds`, `requireAreaAccess`, and `GET /vehicle-t2/areas` for the area picker. Feature 2's spec text says `/vehicle/areas`; call the same route under this app's mount.
- This feature owns `vehicle_types`, `vehicles`, and `vehicle_unavailability` only.
- **Vehicle type** holds a name, an optional description, an optional default passenger capacity, and an active flag. It does not hold make or model. Admin maintains the catalog. Area admins only pick a type when they add a vehicle. The default capacity pre-fills the vehicle form; the vehicle stores its own `capacity` (that is the seat count Feature 5 sums).
- **Make and model** are strings. The form offers a starter list and also lets the user type a value that is not on the list (North's combo box). This feature does not add make/model tables.
- **Status and unavailability are different.** `status` is `available`, `maintenance`, or `retired`. Feature 5 treats anything other than `available` as not assignable (`maintenance` or `retired`). A `vehicle_unavailability` row blocks a date range even when `status` is still `available` (Feature 5's reason `blocked`). Saving a block does not change `status`. Setting `maintenance` does not create a block.
- **Mileage log and service log** from the interview (many rows of date + mileage, or date + service performed) are not tables in this feature. The vehicle stores one `currentMileage`. Feature 6 may overwrite that field on check-in. Nobody on the team currently owns a service-log table.
- **Maintenance person** from the interview is not a role. Feature 1's roles stay `admin`, `area_admin`, and `requestor`. An area admin marks maintenance by setting `status`.
- **Delete vs deactivate.** Types are deactivated (`isActive` false). Vehicles are retired (`status` retired). Neither is hard-deleted, so a request or assignment that already points at them still has a row to show.
- VIN is not forced to 17 characters, so a golf-cart serial can be stored in `vin`.
- All datetimes are UTC. "Today" for `purchasedDate` is the server's UTC date.
- Feature 4 reads active types from `GET /vehicle-t2/vehicle-types` and stores `vehicleTypeId` on a request. Feature 5 reads `status`, `areaId`, `vehicleTypeId`, `capacity`, and `vehicle_unavailability` when it assigns a vehicle. Feature 6 reads `status`, `currentMileage`, `displayName`, and `licensePlate`.

## Edge Cases

- Type name `van` when `Van` exists → `400` duplicate.
- Deactivate a type that only retired vehicles use → allowed.
- Deactivate a type that an `available` or `maintenance` vehicle still uses → `400`.
- Whitespace-only make, model, color, plate, or VIN → `400` `{ "message": "All required fields must be provided." }`.
- VIN or plate that differs only by case → duplicate `400`.
- Year `1989` or year after current year + 1 → `400`.
- `licensePlateExpireMonth` `0` or `13` → `400`.
- `capacity` `0` or `31` → `400`.
- `currentMileage` `-1` → `400`.
- `purchasedDate` tomorrow → `400`.
- Area admin creates a vehicle with another area's `areaId` → `403` `{ "message": "You do not manage this area." }`.
- Area admin opens a vehicle id from another area, or an id that does not exist → `404` `{ "message": "Vehicle not found." }`.
- Inactive area on create → `400` `{ "message": "Area is not active." }`.
- Inactive or unknown type on create → `400` `{ "message": "Invalid vehicle type." }`.
- Two unavailability windows that only touch at one instant → allowed.
- Unavailability `endsAt` equal to `startsAt` → `400`.
- Retire or block while an approved trip is still in the future, once `vehicle_assignments` exists → `409`. Before that table exists → the save succeeds.
- `DELETE` a vehicle → `404` (no route).
- Requestor calls a vehicle endpoint → `403`.
- No session → `401`.
- Empty type list or empty fleet list → empty array and the empty-state copy in Screen Requirements.
- Running the seed when the sample VIN already exists → that vehicle is left as it is.

## Success Criteria

- **SC-001**: Every Gherkin scenario in this file has at least one automated test before merge.
- **SC-002**: A signed-in admin can create, edit, deactivate, and reactivate vehicle types from **Vehicle Types**.
- **SC-003**: A signed-in area admin can add a vehicle, edit it, set `maintenance` or `retired`, and add or remove a date block, and cannot do any of that for an area they do not manage.
- **SC-004**: A signed-in requestor can list active vehicle types and receives `403` on every vehicle endpoint.
- **SC-005**: `npm run seed --prefix backend` twice does not duplicate the sample types or vehicles, and `npm test` passes for this feature's API, seed, and views.

---

## Data Ownership & Isolation

Vehicle types are a shared catalog, same idea as areas. Vehicles belong to one area. Area admins maintain only their areas' vehicles. Requestors may read the type list and may not read or change the fleet.

| Rule | Requirement |
|------|-------------|
| **Types, read** | Any authenticated user. Admin sees inactive types; everyone else sees active types only. |
| **Types, write** | `admin` only. Other roles → `403`. |
| **Vehicles, read** | `admin`: all. `area_admin`: `areaId` in `getManagedAreaIds`. Anyone else, or an area admin asking for a vehicle outside that set → `404` on one vehicle, `403` on the list. |
| **Vehicles, write** | `admin` or `area_admin`, and the target `areaId` MUST be in `getManagedAreaIds` (`403` otherwise). |
| **Unavailability** | Same read scope as the parent vehicle. `404` when the vehicle is out of scope. `requestor` → `403`. |
| **Retire** | Not a delete. A retired vehicle remains readable to the same people who could read it before. |
| **Implementation** | `authenticate`, then `requireRole`. Use `getManagedAreaIds` for every area check. Do not copy that query into the controller. |

---

## Key Entities

- **Vehicle type**: a kind of vehicle the fleet offers (Car, Truck, Van, Golf Cart). Has a name, optional description, optional default passenger capacity, and an active flag. Many vehicles and, later, many requests share one type.
- **Vehicle**: one physical car, truck, van, or golf cart. Belongs to one area and one vehicle type. Stores identity (VIN, plate, make, model, year, color), seat count, plate-expire month, purchase date, current mileage, and a status of available, in maintenance, or retired.
- **Vehicle unavailability**: a dated block on one vehicle, with a reason and the user who entered it. It does not change the vehicle's status. Feature 5 treats an overlapping block as "not available" even when status is still `available`.
- **Area** (Feature 2): the department that owns the vehicle.
- **User** (Feature 1): the admin or area admin who maintains the fleet, and the user recorded on `createdBy` for a block.

---

## API Requirements

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/vehicle-t2/vehicle-types` | Yes | List types (admin: all; others: active only) |
| `POST` | `/vehicle-t2/vehicle-types` | Yes, admin | Create a type |
| `PUT` | `/vehicle-t2/vehicle-types/:vehicleTypeId` | Yes, admin | Update name, description, default capacity, or active flag |
| `GET` | `/vehicle-t2/vehicles` | Yes, admin / area admin | List vehicles in scope |
| `GET` | `/vehicle-t2/vehicles/:vehicleId` | Yes, admin / area admin | One vehicle, including blocks |
| `POST` | `/vehicle-t2/vehicles` | Yes, admin / area admin | Add a vehicle |
| `PUT` | `/vehicle-t2/vehicles/:vehicleId` | Yes, admin / area admin | Edit a vehicle, including status |
| `POST` | `/vehicle-t2/vehicles/:vehicleId/unavailability` | Yes, admin / area admin | Add a date block |
| `PUT` | `/vehicle-t2/vehicles/:vehicleId/unavailability/:unavailabilityId` | Yes, admin / area admin | Change a date block |
| `DELETE` | `/vehicle-t2/vehicles/:vehicleId/unavailability/:unavailabilityId` | Yes, admin / area admin | Remove a date block |

There is no `DELETE` for `/vehicle-types` or `/vehicles`.

**Create / update vehicle type:**

```json
{
  "name": "Van",
  "description": "Passenger vans",
  "defaultPassengerCapacity": 12,
  "isActive": true
}
```

`isActive` is optional on create (default `true`). `description` and `defaultPassengerCapacity` are optional.

**Vehicle type success** (`200` / `201`):

```json
{
  "id": 3,
  "name": "Van",
  "description": "Passenger vans",
  "defaultPassengerCapacity": 12,
  "isActive": true,
  "createdAt": "2026-11-04T15:00:00.000Z",
  "updatedAt": "2026-11-04T15:00:00.000Z"
}
```

`GET /vehicle-t2/vehicle-types` returns an array of that object.

**Create / update vehicle:**

```json
{
  "areaId": 1,
  "vehicleTypeId": 3,
  "name": "",
  "make": "Ford",
  "model": "Transit",
  "year": 2022,
  "vin": "1FTBW2CM5NKA12345",
  "purchasedDate": "2022-08-15",
  "color": "White",
  "capacity": 12,
  "licensePlate": "ATH-101",
  "licensePlateExpireMonth": 6,
  "currentMileage": 18420,
  "status": "available"
}
```

**Vehicle success** (`200` / `201`). List items omit `unavailability`. Detail includes it.

```json
{
  "id": 10,
  "areaId": 1,
  "areaName": "Athletics",
  "vehicleTypeId": 3,
  "vehicleTypeName": "Van",
  "name": null,
  "displayName": "2022 Ford Transit",
  "make": "Ford",
  "model": "Transit",
  "year": 2022,
  "vin": "1FTBW2CM5NKA12345",
  "purchasedDate": "2022-08-15",
  "color": "White",
  "capacity": 12,
  "licensePlate": "ATH-101",
  "licensePlateExpireMonth": 6,
  "currentMileage": 18420,
  "status": "available",
  "unavailability": [
    {
      "id": 4,
      "vehicleId": 10,
      "startsAt": "2026-12-01T00:00:00.000Z",
      "endsAt": "2026-12-05T00:00:00.000Z",
      "reason": "Oil change",
      "createdBy": 4,
      "createdAt": "2026-11-04T15:00:00.000Z",
      "updatedAt": "2026-11-04T15:00:00.000Z"
    }
  ],
  "createdAt": "2026-11-04T15:00:00.000Z",
  "updatedAt": "2026-11-04T15:00:00.000Z"
}
```

**Create / update unavailability:**

```json
{
  "startsAt": "2026-12-01T00:00:00.000Z",
  "endsAt": "2026-12-05T00:00:00.000Z",
  "reason": "Oil change"
}
```

**Error response:** `{ "message": "Human-readable explanation." }` with the status code named in the FR for that case.

---

## Screen Requirements

### [View: Vehicle Types] — route name `vehicle-types` — path `/vehicle-types` — `VehicleTypes.vue`

- Heading: **Vehicle Types**. Admin-only route.
- Primary action: **+ New type** (`oc-cta`) opens **Add Vehicle Type**.
- **Add Vehicle Type** / **Edit Vehicle Type** fields: **Name** (`v-text-field`, required, max 50), **Description** (`v-textarea`, optional), **Default passenger capacity** (`v-text-field` type number, optional, 1–30). **Edit** also has **Active** (`v-switch`).
- Dialog actions: **Create** / **Save** (`oc-cta`) and **Cancel** (secondary). **Cancel** closes without a request.
- List: `v-table`; columns **name**, **description**, **default capacity** (or an em dash when null), **status** (Active / Inactive); ordered by name.
- Icon-only row action **Edit type**, `size="small"`, with an `aria-label`.
- **Empty state:** **"No vehicle types yet. Create your first type."**
- **Loading state:** progress indicator. **Error state:** `<v-alert type="error">`.

### [View: Fleet] — route name `fleet` — path `/fleet` — `Fleet.vue`

- Heading: **Fleet**. Roles `admin` and `area_admin`.
- Filters: **Area**, **Type**, **Status**. Admin's area filter uses `GET /vehicle-t2/areas` (all areas). Area admin's area filter uses `GET /vehicle-t2/areas/mine`. Type filter uses `GET /vehicle-t2/vehicle-types`. Status options: Any, Available, Maintenance, Retired.
- Primary action: **+ New vehicle** (`oc-cta`) opens **Add Vehicle**.
- **Add Vehicle** / **Edit Vehicle** fields, in this order: **Area** (required `v-select` of areas the user may write), **Type** (required `v-select` of active types; choosing a type with `defaultPassengerCapacity` fills **Capacity** only when that field is still empty), **Name** (optional), **Make** (`v-combobox`, required; suggestions Chevrolet, Ford, GMC, Honda, Toyota, Club Car; a typed value is allowed), **Model** (`v-combobox`, required; suggestions Camry, Colorado, F-150, Odyssey, Transit, Onward; a typed value is allowed), **Year**, **VIN**, **Purchased date**, **Color**, **Capacity**, **License plate**, **Plate expire month** (`v-select` 1–12, labels January–December), **Current mileage**, and on edit a **Status** `v-select` (`available`, `maintenance`, `retired`).
- Dialog actions: **Create** / **Save** (`oc-cta`) and **Cancel**. Client-side **"Required"** on empty required fields MUST NOT send the request. Server error messages from FR-012 MUST show on the matching field or in the dialog alert.
- List: `v-table`; columns **vehicle** (`displayName`), **plate**, **type**, **area**, **seats**, **mileage**, **status**. Ordered by `displayName`.
- Icon-only row actions, `size="small"`, with `aria-label`s: **Edit vehicle**, **Block dates**.
- **Block dates** dialog: title **Block dates — &lt;displayName&gt;**; lists current windows (start, end, reason) each with **Remove block**; fields **Start**, **End**, **Reason**; **Add block** (`oc-cta`); **Close**.
- **Retire** is the edit dialog's status set to `retired`, with a confirm: **"Retire this vehicle? It stays on the fleet list and cannot be reserved for new trips."** Confirm button **Retire**. Cancelling the confirm leaves status unchanged.
- **Empty state:** **"No vehicles yet. Add your first vehicle."** when the unfiltered list is empty. When filters match nothing: **"No vehicles match these filters."**
- **Loading state:** progress indicator. **Error state:** `<v-alert type="error">`.

**App chrome**

- Use the Feature 1 `MenuBar`. Do not create a second `MenuBar`.
- Add **Vehicle Types** for `admin` and **Fleet** for `admin` and `area_admin`.
- Requestors see neither item. A requestor who opens `/fleet` or `/vehicle-types` is sent to `home`.

---

## Data Model Requirements

DB columns are snake_case. API JSON is camelCase.

### `vehicle_types` table (new — owned by this feature)

| Column | Type | Rules |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `name` | STRING(50) | Required; trimmed; unique (case-insensitive) |
| `description` | TEXT | Optional |
| `default_passenger_capacity` | INTEGER | Optional; 1–30 when set |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | DATE | Sequelize timestamps |
| `updated_at` | DATE | Sequelize timestamps |

### `vehicles` table (new — owned by this feature)

| Column | Type | Rules |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `area_id` | INTEGER FK | Required; references `areas.id` |
| `vehicle_type_id` | INTEGER FK | Required; references `vehicle_types.id` |
| `name` | STRING(100) | Optional |
| `make` | STRING(50) | Required |
| `model` | STRING(50) | Required |
| `year` | INTEGER | Required; 1990 through current year + 1 |
| `vin` | STRING(17) | Required; stored uppercase; unique (case-insensitive) |
| `purchased_date` | DATEONLY | Required; not in the future |
| `color` | STRING(40) | Required |
| `capacity` | INTEGER | Required; 1–30 |
| `license_plate` | STRING(15) | Required; stored uppercase; unique (case-insensitive) |
| `license_plate_expire_month` | INTEGER | Required; 1–12 |
| `current_mileage` | INTEGER | Required; ≥ 0; default 0 |
| `status` | ENUM | `available`, `maintenance`, `retired`; default `available` |
| `created_at` | DATE | Sequelize timestamps |
| `updated_at` | DATE | Sequelize timestamps |

`displayName` is not a column.

### `vehicle_unavailability` table (new — owned by this feature)

| Column | Type | Rules |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `vehicle_id` | INTEGER FK | Required; references `vehicles.id` |
| `starts_at` | DATETIME | Required |
| `ends_at` | DATETIME | Required; after `starts_at` |
| `reason` | STRING(255) | Required; trimmed |
| `created_by` | INTEGER FK | Required; references `users.id`; set from the session |
| `created_at` | DATE | Sequelize timestamps |
| `updated_at` | DATE | Sequelize timestamps |

### Associations (in `models/index.js`)

- `VehicleType` hasMany `Vehicle`
- `Vehicle` belongsTo `VehicleType`
- `Area` hasMany `Vehicle`
- `Vehicle` belongsTo `Area`
- `Vehicle` hasMany `VehicleUnavailability`
- `VehicleUnavailability` belongsTo `Vehicle`
- `VehicleUnavailability` belongsTo `User` as `createdBy`
- Later, Feature 4 adds `VehicleType` hasMany `Request`. This feature does not create `requests`.

### Not created by this feature

- `requests`, `vehicle_assignments`, `trip_logs`, `destinations`
- A mileage-log table or a service-log table
- Writes to `users` or `areas`

---

## Acceptance Criteria (Gherkin)

### US-3.1 — Add, edit, and deactivate vehicle types

#### Scenario: Admin views all vehicle types
* **Given** I am signed in as an admin
* **And** an active type `Van` and an inactive type `Bus` exist
* **When** I open **Vehicle Types**
* **Then** I see both types
* **And** `GET /vehicle-t2/vehicle-types` returns both, ordered by name

#### Scenario: Admin has no vehicle types
* **Given** I am signed in as an admin
* **And** there are no vehicle types
* **When** I open **Vehicle Types**
* **Then** I see **"No vehicle types yet. Create your first type."**

#### Scenario: Admin creates a vehicle type
* **Given** I am signed in as an admin
* **When** I create a type named `Van` with default passenger capacity 12
* **Then** the list shows `Van` as Active
* **And** the API returns `201` with that type

#### Scenario: Admin creates a vehicle type with a missing name
* **Given** I am signed in as an admin and the add dialog is open
* **When** I leave **Name** blank and choose **Create**
* **Then** I see **"Required"**
* **And** no API request is sent
* **And** a `POST` with a blank name returns `400` `{ "message": "Vehicle type name is required." }`

#### Scenario: Admin creates a duplicate vehicle type
* **Given** a type named `Van` exists
* **When** I create a type named `van`
* **Then** the API returns `400` `{ "message": "Vehicle type name is already taken." }`
* **And** the dialog shows that message

#### Scenario: Admin edits a vehicle type
* **Given** I am signed in as an admin
* **And** type `Van` has default capacity 12
* **When** I change the default capacity to 15 and save
* **Then** the list shows 15
* **And** the API returns `200`

#### Scenario: Admin deactivates a vehicle type
* **Given** type `Bus` is active
* **And** no non-retired vehicle uses `Bus`
* **When** I edit `Bus` and turn **Active** off
* **Then** the list shows `Bus` as Inactive

#### Scenario: Admin cannot deactivate a vehicle type that is still in use
* **Given** an available vehicle uses type `Van`
* **When** I set `Van` to inactive
* **Then** the API returns `400` `{ "message": "This vehicle type is still used by a vehicle that is not retired." }`
* **And** `Van` stays active

#### Scenario: Admin reactivates a vehicle type
* **Given** type `Bus` is inactive
* **When** I turn **Active** on and save
* **Then** `Bus` is active
* **And** a requestor list includes `Bus`

#### Scenario: Requestor cannot create a vehicle type
* **Given** I am signed in as a requestor
* **When** I `POST /vehicle-t2/vehicle-types`
* **Then** the response is `403` `{ "message": "You do not have permission for this action." }`

#### Scenario: Unauthenticated request to vehicle types
* **Given** I have no session
* **When** I `GET /vehicle-t2/vehicle-types`
* **Then** the response is `401`

### US-3.2 — See the vehicle types I can request

#### Scenario: Requestor lists only active vehicle types
* **Given** I am signed in as a requestor
* **And** `Van` is active and `Bus` is inactive
* **When** I `GET /vehicle-t2/vehicle-types`
* **Then** the array contains `Van`
* **And** it does not contain `Bus`
* **And** the names are in alphabetical order

#### Scenario: Area admin lists only active vehicle types
* **Given** I am signed in as an area admin
* **And** `Van` is active and `Bus` is inactive
* **When** I `GET /vehicle-t2/vehicle-types`
* **Then** the array contains `Van` and does not contain `Bus`

### US-3.3 — Add and edit vehicles in my areas

#### Scenario: Area admin creates a vehicle in a managed area
* **Given** I am signed in as an area admin for Athletics
* **And** Athletics is active and type `Van` is active
* **When** I add a 2022 Ford Transit with a new VIN and plate `ATH-101` in Athletics
* **Then** the API returns `201`
* **And** `status` is `available`
* **And** `displayName` is `2022 Ford Transit`
* **And** the fleet list shows that vehicle

#### Scenario: Admin creates a vehicle in any active area
* **Given** I am signed in as an admin
* **When** I add a vehicle in Support Central
* **Then** the API returns `201`
* **And** the vehicle's `areaName` is Support Central

#### Scenario: Create with a missing required field
* **Given** the add-vehicle dialog is open
* **When** I leave **VIN** blank and choose **Create**
* **Then** I see **"Required"** and no API request is sent
* **And** a `POST` missing `vin` returns `400` `{ "message": "All required fields must be provided." }`

#### Scenario: Duplicate VIN
* **Given** a vehicle already has VIN `1FTBW2CM5NKA12345`
* **When** I create another vehicle with VIN `1ftbw2cm5nka12345`
* **Then** the API returns `400` `{ "message": "VIN is already in use." }`

#### Scenario: Duplicate license plate
* **Given** a vehicle already has plate `ATH-101`
* **When** I create another vehicle with plate `ath-101`
* **Then** the API returns `400` `{ "message": "License plate is already in use." }`

#### Scenario: Year out of range
* **Given** I am signed in as an admin
* **When** I create a vehicle with year 1989
* **Then** the API returns `400` and the message starts with **"Year must be between 1990 and"**

#### Scenario: Area admin creates a vehicle in an unmanaged area
* **Given** I am an area admin for Athletics only
* **When** I `POST` a vehicle with Support Central's `areaId`
* **Then** the response is `403` `{ "message": "You do not manage this area." }`
* **And** no vehicle row is created

#### Scenario: Create with an inactive area or inactive type
* **Given** I am signed in as an admin
* **When** I create a vehicle in an inactive area
* **Then** the response is `400` `{ "message": "Area is not active." }`
* **When** I create a vehicle with an inactive vehicle type
* **Then** the response is `400` `{ "message": "Invalid vehicle type." }`

#### Scenario: Area admin edits a vehicle in their area
* **Given** I manage Athletics
* **And** an Athletics vehicle is white
* **When** I change the color to red and save
* **Then** the list shows red
* **And** the API returns `200`

#### Scenario: Area admin edits a vehicle in another area
* **Given** I manage Athletics only
* **And** a Support Central vehicle exists
* **When** I `PUT /vehicle-t2/vehicles/:vehicleId` for that vehicle
* **Then** the response is `404` `{ "message": "Vehicle not found." }`
* **And** the vehicle is unchanged

#### Scenario: Cancel editing a vehicle
* **Given** the edit dialog is open with a new color typed in
* **When** I choose **Cancel**
* **Then** the dialog closes
* **And** the vehicle color is unchanged

### US-3.4 — See only vehicles for my areas

#### Scenario: Area admin sees only vehicles in managed areas
* **Given** I manage Athletics only
* **And** both Athletics and Support Central have vehicles
* **When** I open **Fleet**
* **Then** I see the Athletics vehicles
* **And** I do not see the Support Central vehicles

#### Scenario: Admin sees vehicles in every area
* **Given** I am signed in as an admin
* **And** Athletics and Support Central both have vehicles
* **When** I open **Fleet**
* **Then** I see vehicles from both areas

#### Scenario: Requestor cannot list vehicles
* **Given** I am signed in as a requestor
* **When** I `GET /vehicle-t2/vehicles`
* **Then** the response is `403` `{ "message": "You do not have permission for this action." }`
* **And** **Fleet** is not in the menu
* **And** opening `/fleet` sends me to `home`

#### Scenario: Area admin filters to an unmanaged area
* **Given** I manage Athletics only
* **When** I `GET /vehicle-t2/vehicles?areaId=<Support Central id>`
* **Then** the response is `403` `{ "message": "You do not manage this area." }`

### US-3.5 — Take a vehicle out of service without deleting it

#### Scenario: Area admin marks a vehicle in maintenance
* **Given** I manage the vehicle's area
* **And** the vehicle status is `available`
* **When** I set status to `maintenance` and save
* **Then** the fleet list shows Maintenance
* **And** the API returns `200` with `"status": "maintenance"`

#### Scenario: Area admin retires a vehicle
* **Given** I manage the vehicle's area
* **And** the vehicle has no future approved assignment
* **When** I confirm **Retire**
* **Then** the vehicle remains on the fleet list with status Retired
* **And** the API returns `200` with `"status": "retired"`

#### Scenario: There is no delete for vehicles
* **Given** I am signed in as an admin
* **When** I `DELETE /vehicle-t2/vehicles/:vehicleId`
* **Then** the response is `404`
* **And** the vehicle row still exists

#### Scenario: Retire is refused when a future approved trip exists
* **Given** the vehicle is on an approved request whose return is still in the future
* **When** I set the vehicle's status to `retired`
* **Then** the API returns `409` `{ "message": "This vehicle is assigned to a future trip." }`
* **And** the status stays unchanged

### US-3.6 — Block a vehicle for a date range

#### Scenario: Area admin blocks a vehicle for a date range
* **Given** I manage the vehicle's area
* **When** I add a block from 1 Dec 2026 through 5 Dec 2026 with reason `Oil change`
* **Then** the API returns `201`
* **And** the vehicle detail lists that window and reason
* **And** the vehicle `status` is unchanged

#### Scenario: End is not after start
* **Given** I manage the vehicle's area
* **When** I add a block whose end is not after its start
* **Then** the API returns `400` `{ "message": "End must be after start." }`

#### Scenario: Overlapping block on the same vehicle
* **Given** the vehicle is already blocked for 1 Dec 2026 through 5 Dec 2026
* **When** I add a block for 4 Dec 2026 through 8 Dec 2026
* **Then** the API returns `400` `{ "message": "This vehicle is already blocked during that time." }`

#### Scenario: Area admin removes a block
* **Given** I manage the vehicle
* **And** it has one unavailability window
* **When** I remove that block
* **Then** the API returns `200` `{ "message": "Unavailability window removed." }`
* **And** the vehicle detail lists no windows

#### Scenario: Area admin cannot block another area's vehicle
* **Given** I manage Athletics only
* **And** a Support Central vehicle exists
* **When** I `POST` an unavailability window for that vehicle
* **Then** the response is `404` `{ "message": "Vehicle not found." }`

#### Scenario: Block is refused when it overlaps an approved trip
* **Given** the vehicle is on an approved request from 1 Dec 2026 through 3 Dec 2026
* **When** I add a block from 2 Dec 2026 through 4 Dec 2026
* **Then** the API returns `409` `{ "message": "This vehicle is assigned to a trip during that time." }`
* **And** no window is saved

### US-3.7 — Load sample fleet data with the existing seed

#### Scenario: Seed loads vehicle types and vehicles
* **Given** the Feature 2 seed areas Athletics, Support Central, and Maintenance exist
* **When** I run `npm run seed --prefix backend`
* **Then** types Car, Truck, Van, and Golf Cart exist and are active
* **And** at least one vehicle exists in each of those three areas
* **And** one Maintenance vehicle has status `maintenance`

#### Scenario: Running the seed twice creates no duplicates
* **Given** the fleet seed has already run
* **When** I run `npm run seed --prefix backend` again
* **Then** each sample type name exists once
* **And** each sample VIN exists once

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-3.1 | Admin views all vehicle types | `frontend/tests/VehicleTypes.test.js` | `Admin views all vehicle types` |
| US-3.1 | Admin has no vehicle types | `frontend/tests/VehicleTypes.test.js` | `Admin has no vehicle types` |
| US-3.1 | Admin creates a vehicle type | `backend/tests/vehicleTypes.test.js` | `Admin creates a vehicle type` |
| US-3.1 | Admin creates a vehicle type with a missing name | `backend/tests/vehicleTypes.test.js` | `Admin creates a vehicle type with a missing name` |
| US-3.1 | Admin creates a duplicate vehicle type | `backend/tests/vehicleTypes.test.js` | `Admin creates a duplicate vehicle type` |
| US-3.1 | Admin edits a vehicle type | `backend/tests/vehicleTypes.test.js` | `Admin edits a vehicle type` |
| US-3.1 | Admin deactivates a vehicle type | `backend/tests/vehicleTypes.test.js` | `Admin deactivates a vehicle type` |
| US-3.1 | Admin cannot deactivate a vehicle type that is still in use | `backend/tests/vehicleTypes.test.js` | `Admin cannot deactivate a vehicle type that is still in use` |
| US-3.1 | Admin reactivates a vehicle type | `backend/tests/vehicleTypes.test.js` | `Admin reactivates a vehicle type` |
| US-3.1 | Requestor cannot create a vehicle type | `backend/tests/vehicleTypes.test.js` | `Requestor cannot create a vehicle type` |
| US-3.1 | Unauthenticated request to vehicle types | `backend/tests/vehicleTypes.test.js` | `Unauthenticated request to vehicle types` |
| US-3.2 | Requestor lists only active vehicle types | `backend/tests/vehicleTypes.test.js` | `Requestor lists only active vehicle types` |
| US-3.2 | Area admin lists only active vehicle types | `backend/tests/vehicleTypes.test.js` | `Area admin lists only active vehicle types` |
| US-3.3 | Area admin creates a vehicle in a managed area | `backend/tests/vehicles.test.js` | `Area admin creates a vehicle in a managed area` |
| US-3.3 | Admin creates a vehicle in any active area | `backend/tests/vehicles.test.js` | `Admin creates a vehicle in any active area` |
| US-3.3 | Create with a missing required field | `frontend/tests/Fleet.test.js` | `Create with a missing required field` |
| US-3.3 | Duplicate VIN | `backend/tests/vehicles.test.js` | `Duplicate VIN` |
| US-3.3 | Duplicate license plate | `backend/tests/vehicles.test.js` | `Duplicate license plate` |
| US-3.3 | Year out of range | `backend/tests/vehicles.test.js` | `Year out of range` |
| US-3.3 | Area admin creates a vehicle in an unmanaged area | `backend/tests/vehicles.test.js` | `Area admin creates a vehicle in an unmanaged area` |
| US-3.3 | Create with an inactive area or inactive type | `backend/tests/vehicles.test.js` | `Create with an inactive area or inactive type` |
| US-3.3 | Area admin edits a vehicle in their area | `backend/tests/vehicles.test.js` | `Area admin edits a vehicle in their area` |
| US-3.3 | Area admin edits a vehicle in another area | `backend/tests/vehicles.test.js` | `Area admin edits a vehicle in another area` |
| US-3.3 | Cancel editing a vehicle | `frontend/tests/Fleet.test.js` | `Cancel editing a vehicle` |
| US-3.4 | Area admin sees only vehicles in managed areas | `frontend/tests/Fleet.test.js` | `Area admin sees only vehicles in managed areas` |
| US-3.4 | Admin sees vehicles in every area | `frontend/tests/Fleet.test.js` | `Admin sees vehicles in every area` |
| US-3.4 | Requestor cannot list vehicles | `backend/tests/vehicles.test.js` | `Requestor cannot list vehicles` |
| US-3.4 | Area admin filters to an unmanaged area | `backend/tests/vehicles.test.js` | `Area admin filters to an unmanaged area` |
| US-3.5 | Area admin marks a vehicle in maintenance | `backend/tests/vehicles.test.js` | `Area admin marks a vehicle in maintenance` |
| US-3.5 | Area admin retires a vehicle | `backend/tests/vehicles.test.js` | `Area admin retires a vehicle` |
| US-3.5 | There is no delete for vehicles | `backend/tests/vehicles.test.js` | `There is no delete for vehicles` |
| US-3.5 | Retire is refused when a future approved trip exists | `backend/tests/vehicles.test.js` | `Retire is refused when a future approved trip exists` |
| US-3.6 | Area admin blocks a vehicle for a date range | `backend/tests/vehicleUnavailability.test.js` | `Area admin blocks a vehicle for a date range` |
| US-3.6 | End is not after start | `backend/tests/vehicleUnavailability.test.js` | `End is not after start` |
| US-3.6 | Overlapping block on the same vehicle | `backend/tests/vehicleUnavailability.test.js` | `Overlapping block on the same vehicle` |
| US-3.6 | Area admin removes a block | `backend/tests/vehicleUnavailability.test.js` | `Area admin removes a block` |
| US-3.6 | Area admin cannot block another area's vehicle | `backend/tests/vehicleUnavailability.test.js` | `Area admin cannot block another area's vehicle` |
| US-3.6 | Block is refused when it overlaps an approved trip | `backend/tests/vehicleUnavailability.test.js` | `Block is refused when it overlaps an approved trip` |
| US-3.7 | Seed loads vehicle types and vehicles | `backend/tests/seed.test.js` | `Seed loads vehicle types and vehicles` |
| US-3.7 | Running the seed twice creates no duplicates | `backend/tests/seed.test.js` | `Running the seed twice creates no duplicates` |

---

## Agent implementation request

```text
Implement Feature 3 from @features/feature-3-fleet-management.md on branch `feature/3-fleet-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
Do not implement requests, assignments, trip logs, destinations, or the calendar.
```

**Reference updates for this feature:** `features/reference/api.md`, `features/reference/data-model.md`, `features/reference/behavior.md`

---

## Definition of Done

*   [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-021** satisfied)
*   [ ] **Success Criteria (SC-001**–**SC-005)** met
*   [ ] All mapped tests pass (`npm test`)
*   [ ] Test Coverage Map complete
*   [ ] `features/reference/data-model.md` updated (schema)
*   [ ] `features/reference/api.md` updated (routes and payloads)
*   [ ] `features/reference/behavior.md` updated (who may edit the fleet, usable type, status vs unavailability)
*   [ ] Feature 4 can list active types from `GET /vehicle-t2/vehicle-types`

---

## Out of Scope

*   Creating, editing, or cancelling requests (Feature 4). This feature only supplies the type list Feature 4's form needs.
*   Approving or denying requests, assigning a vehicle or driver, destinations, and trip logs (Feature 5). Feature 5 reads `status`, `capacity`, `areaId`, and `vehicle_unavailability`; it does not own those columns.
*   The calendar, home dashboards, check-out / check-in, and updating `currentMileage` from a returned trip (Feature 6).
*   A mileage-log table (many dated readings) and a service-log table (oil change, tires, repair). North's interview lists both. No feature on `dev` owns them. This feature stores one `currentMileage` and a free-text unavailability `reason` only.
*   A **maintenance person** role. Area admins set `status` to `maintenance`.
*   Make and model lookup tables. The combo boxes are suggestion lists plus a typed value.
*   Hard-deleting a vehicle type or a vehicle.
*   Area logo, area notice email, and the pickup / return emails from the interview.

---