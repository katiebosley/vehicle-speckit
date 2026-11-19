# API Reference

**Status:** Feature 1 sign-in, users, and profile, Feature 3 fleet, Feature 4 requests, Feature 5 review and destinations, and Feature 6 calendar, availability, dashboard, and trip logs.

API mount path is `/vehicle-t2` (see `backend/server.js`).

## Endpoints

| Method | Endpoint                    | Auth       | Purpose                                                    | Feature |
| ------ | --------------------------- | ---------- | ---------------------------------------------------------- | ------- |
| `POST` | `/vehicle-t2/login`         | No         | Verify Google credential, find/create user, return session | 1       |
| `POST` | `/vehicle-t2/logout`        | Yes        | Invalidate the current session token                       | 1       |
| `GET`  | `/vehicle-t2/users`         | Yes, admin | List users ordered by last, first name; optional `?search=` | 1       |
| `GET`  | `/vehicle-t2/users/:userId` | Yes, admin | Fetch one user                                             | 1       |
| `PUT`  | `/vehicle-t2/users/:userId` | Yes, admin | Change `role`, `isApprovedDriver`, `licenseExpiration`, `isActive` | 1 |
| `GET`  | `/vehicle-t2/profile`       | Yes        | Fetch the signed-in user                                   | 1       |
| `PUT`  | `/vehicle-t2/profile`       | Yes        | Update own `firstName`, `lastName`, `phone`                | 1       |

### `POST /login`

Request: `{ "credential": "<Google ID token>" }`

Success `200`:

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

| Status | Message                                  | When                                            |
| ------ | ---------------------------------------- | ----------------------------------------------- |
| `401`  | `Google sign-in failed.`                 | Missing/invalid/expired/wrong-audience credential, or `GOOGLE_CLIENT_ID` unset |
| `403`  | `Sign in with your OC Google account.`   | Email domain not `oc.edu` / `eagles.oc.edu`     |
| `403`  | `Your account has been deactivated.`     | `isActive` is `false`                           |

### User object (`/users…`, `/profile`)

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

`googleId` is never returned.

### Errors

| Status | Message                                                  | Endpoint                 |
| ------ | -------------------------------------------------------- | ------------------------ |
| `401`  | `Unauthorized! …`                                        | Any authenticated route  |
| `403`  | `You do not have permission for this action.`            | `/users…` as non-admin   |
| `400`  | `Role must be admin, area_admin, or requestor.`          | `PUT /users/:userId`     |
| `400`  | `You cannot change your own role or active status.`      | `PUT /users/:userId`     |
| `400`  | `License expiration is required for approved drivers.`   | `PUT /users/:userId`     |
| `404`  | `User with id=<id> not found.`                           | `GET`/`PUT /users/:userId` |
| `400`  | `First name is required.` / `Last name is required.`     | `PUT /profile`           |
| `400`  | `Phone must be 20 characters or fewer.`                  | `PUT /profile`           |

### Vehicle types (Feature 3, US-3.1)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/vehicle-t2/vehicle-types` | Any signed-in role. Admin receives every type. Other roles receive active types only. Ordered by name. |
| `POST` | `/vehicle-t2/vehicle-types` | Admin. `201` with the type. |
| `PUT` | `/vehicle-t2/vehicle-types/:vehicleTypeId` | Admin. Unknown id → `404`. |

Create and update body: `name`, optional `description`, optional `defaultPassengerCapacity` (1–30), optional `isActive` (default `true` on create). There is no delete.

### Vehicles and blocks (Feature 3, US-3.3 through US-3.6)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/vehicle-t2/vehicles` | Admin or area admin. Admin sees every vehicle. Area admin sees managed areas only. Optional `areaId`, `status`, `vehicleTypeId`. Ordered by display name. |
| `GET` | `/vehicle-t2/vehicles/:vehicleId` | Admin or area admin. Includes `unavailability`. Out of scope → `404`. |
| `POST` | `/vehicle-t2/vehicles` | Admin or area admin. `201`. |
| `PUT` | `/vehicle-t2/vehicles/:vehicleId` | Admin or area admin. Status `retired` is how a vehicle leaves service. |
| `POST` | `/vehicle-t2/vehicles/:vehicleId/unavailability` | Admin or area admin. `201`. |
| `PUT` | `/vehicle-t2/vehicles/:vehicleId/unavailability/:unavailabilityId` | Admin or area admin. |
| `DELETE` | `/vehicle-t2/vehicles/:vehicleId/unavailability/:unavailabilityId` | Admin or area admin. `200` with `{ "message": "Unavailability window removed." }`. |

There is no delete for a vehicle. A requestor receives `403` on every vehicle route.

### Areas read by Fleet

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/vehicle-t2/areas` | Any signed-in role. Admin receives every area. Other roles receive active areas. Ordered by name. |
| `GET` | `/vehicle-t2/areas/mine` | Admin or area admin. Areas from `getManagedAreaIds`, including inactive ones. |

### Requests (Feature 4)

All routes require a signed-in `requestor`. Other roles receive `403` `{ "message": "You do not have permission for this action." }`.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/vehicle-t2/requests` | `201` pending request. `requesterId` comes from the session. `vehiclesNeeded` defaults to `1`. |
| `GET` | `/vehicle-t2/requests` | `200` array of the caller’s requests, `createdAt` descending. Includes `status`, `areaName`, and `vehicleTypeName`. |
| `GET` | `/vehicle-t2/requests/:id` | `200` owned request plus `reviewNotes`, `reviewer` when set, and `assignments` (`[]` when none). |
| `PUT` | `/vehicle-t2/requests/:id` | `200` updated pending request. Does not change `requesterId` or review fields. |
| `POST` | `/vehicle-t2/requests/:id/cancel` | `200` with `status` `cancelled`. |

Create and update body: `areaId`, `purpose`, `destination`, `departureAt`, `returnAt`, `passengerCount`, `vehicleTypeId`, optional `vehiclesNeeded`.

Detail `assignments` items are `{ id, vehicle: { id, name, licensePlate }, driver: { id, firstName, lastName } | null }` when a later feature has stored rows.

| Status | Message | When |
|--------|---------|------|
| `400` | `All required fields must be provided.` | A required field is missing or blank |
| `400` | `Return must be after departure.` | `returnAt` is before or equal to `departureAt` |
| `400` | `Departure must be in the future.` | `departureAt` is now or in the past |
| `400` | `Passenger count and vehicles needed must be at least 1.` | Either value is not an integer of at least 1 |
| `400` | `Invalid area or vehicle type.` | Area or vehicle type is missing from the active lists |
| `400` | `Only pending requests can be edited.` | Update when status is not `pending` |
| `400` | `This request cannot be cancelled.` | Cancel is not allowed for that status and departure |
| `404` | `Request not found.` | Unknown id, or the row belongs to someone else |

### Review and destinations (Feature 5)

Mounted at `/vehicle-t2/api/review` and `/vehicle-t2/api/destinations`. Review JSON uses snake_case. Feature 4 request JSON stays camelCase.

Review routes require a session and role `area_admin` or `admin`. A requestor receives `403` `{ "message": "Area admin role required." }`. An unknown or out-of-area request receives `404` `{ "message": "Request with id=<id> not found." }`.

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/vehicle-t2/api/review/requests?status=` | `200` requests in scope. `status` defaults to `pending`. Ordered by `departure_at`. |
| `GET` | `/vehicle-t2/api/review/requests/:requestId/available-vehicles` | `200` vehicles in the request's area that are free for that window. Matching vehicle type first. |
| `GET` | `/vehicle-t2/api/review/requests/:requestId/eligible-drivers` | `200` active approved drivers whose license covers the return date. |
| `POST` | `/vehicle-t2/api/review/requests/:requestId/approve` | `200` approved request with assignments. |
| `POST` | `/vehicle-t2/api/review/requests/:requestId/deny` | `200` denied request. |
| `POST` | `/vehicle-t2/api/review/requests/:requestId/assignments` | `200` request with the new assignment. |
| `PUT` | `/vehicle-t2/api/review/requests/:requestId/assignments/:assignmentId` | `200` request with the updated assignment. |
| `DELETE` | `/vehicle-t2/api/review/requests/:requestId/assignments/:assignmentId` | `200` request after the assignment is removed. |
| `POST` | `/vehicle-t2/api/review/requests/:requestId/complete` | `200` completed request with a trip log on every assignment. |
| `PUT` | `/vehicle-t2/api/review/trip-logs/:tripLogId` | `200` updated trip log. |
| `GET` | `/vehicle-t2/api/destinations` | `200` active destinations by name. Any signed-in role. |
| `POST` | `/vehicle-t2/api/destinations` | `201` destination. Area admin or admin. |
| `PUT` | `/vehicle-t2/api/destinations/:destinationId` | `200` destination. Area admin or admin. |

Approve body: `{ "review_notes": "optional", "assignments": [{ "vehicle_id": 3, "driver_id": 12 }] }`. Deny body: `{ "review_notes": "required" }`. Assignment body: `{ "vehicle_id": 3, "driver_id": 12 }`. Complete body: `{ "trip_logs": [{ "assignment_id", "start_mileage", "end_mileage", "picked_up_at", "returned_at", "fuel_added_gallons", "issues_reported" }] }`. Destination body: `{ "name", "is_active" }`. Client `status`, `reviewed_by`, `reviewed_at`, `assigned_by`, `assigned_at`, and `request_id` are ignored.

| Status | Message | When |
|--------|---------|------|
| `400` | `Only pending requests can be reviewed.` | Approve or deny when status is not `pending` |
| `400` | `At least one vehicle is required.` | Approve with no assignment |
| `400` | `A note is required to deny a request.` | Deny with a blank note |
| `400` | `Vehicle with id=<id> not found.` | Unknown vehicle |
| `400` | `Vehicle with id=<id> does not belong to this request's area.` | Vehicle area differs from the request |
| `409` | `Vehicle with id=<id> is not available for this trip.` | Maintenance, retired, blocked, or booked. Nothing from that call is saved |
| `400` | `A vehicle can only be assigned once per request.` | Duplicate vehicle on one request |
| `400` | `Driver with id=<id> is not an approved driver with a current license.` | Inactive, unapproved, or expired driver |
| `400` | `A driver can only be assigned to one vehicle per request.` | Same driver on two vehicles |
| `400` | `Assignments cannot change after the trip starts.` | Add, update, or delete when the request is not approved or departure has passed |
| `400` | `An approved request must keep at least one vehicle.` | Delete of the last assignment |
| `404` | `Assignment with id=<id> not found.` | Unknown assignment, or one on another request |
| `400` | `Only approved requests whose trip has ended can be completed.` | Complete too early or not approved |
| `400` | `A trip log is required for every assigned vehicle.` | Complete body does not match the assignments |
| `400` | `End mileage must be greater than or equal to start mileage.` | End mileage is lower |
| `400` | `Return time must be after pick-up time.` | `returned_at` is before `picked_up_at` |
| `404` | `Trip log with id=<id> not found.` | Unknown trip log, or one outside the caller's areas |
| `400` | `A destination named <name> already exists.` | Destination name matches ignoring case |
| `404` | `Destination with id=<id> not found.` | Unknown destination |
| `401` | Unauthorized message | No session |

### Calendar, availability, dashboard, and trip logs (Feature 6)

JSON is camelCase. Paths are on the `/vehicle-t2` mount. Every route requires a session.

| Method | Path | Roles | Success |
|--------|------|-------|---------|
| `GET` | `/vehicle-t2/calendar?start=&end=&view=&areaId=&vehicleId=` | `admin`, `area_admin` | `200` assignment events that overlap `[start, end)` |
| `GET` | `/vehicle-t2/availability?vehicleTypeId=&departureAt=&returnAt=` | any signed-in role | `200` vehicles of that type with status `available` and no overlapping assignment |
| `GET` | `/vehicle-t2/dashboard` | any signed-in role | `200` role-specific home payload |
| `POST` | `/vehicle-t2/assignments/:assignmentId/checkout` | assignment driver or `admin` | `200` trip log with `pickedUpAt` set |
| `POST` | `/vehicle-t2/assignments/:assignmentId/checkin` | assignment driver or `admin` | `200` trip log with `returnedAt` set. Vehicle `currentMileage` becomes `endMileage` |
| `GET` | `/vehicle-t2/vehicles/:vehicleId/trip-logs` | `admin`, `area_admin` in the vehicle's area | `200` trip logs, newest `pickedUpAt` first |

`start` and `end` are ISO datetimes. `view` is `week` or `month` and does not replace `start` and `end`. An area admin who passes an `areaId` outside `getManagedAreaIds` receives `403`. With no `areaId`, that caller only sees managed areas. An admin sees every area.

Calendar event: `assignmentId`, `requestId`, `areaId`, `vehicleId`, `vehicleName`, `licensePlate`, `driverId`, `driverFirstName`, `driverLastName`, `departureAt`, `returnAt`, plus `pickedUpAt`, `returnedAt`, and `startMileage` when a trip log exists.

Availability item: `id`, `name`, `licensePlate`, `capacity`, `areaId`. An empty array means nothing is free.

Dashboard `requestor`: `pendingRequests` (`id`, `purpose`, `departureAt`, `status`) and `upcomingTrips` (`assignmentId`, `requestId`, `vehicleId`, `vehicleName`, `driverId`, `departureAt`, `returnAt`, `pickedUpAt`, `returnedAt`, `startMileage`). Upcoming trips are the caller's requests or driving assignments with `departureAt` at or after now, soonest first.

Dashboard `area_admin`: `pendingRequests` (same fields plus `areaId`) and `maintenanceVehicles` (`id`, `name`, `areaId`, `status`) for managed areas only.

Dashboard `admin`: `pendingRequests` (with `areaId`), `pendingRequestCount`, and `maintenanceVehicleCount`.

Check-out body: `{ "startMileage": 50000 }`. Check-in body: `{ "endMileage": 50120, "fuelAddedGallons": 8.5, "issuesReported": "Scratched bumper" }`. Trip log JSON: `id`, `assignmentId`, `startMileage`, `endMileage`, `fuelAddedGallons`, `pickedUpAt`, `returnedAt`, `issuesReported`, `createdAt`, `updatedAt`. History rows also include `vehicleId`, `driverId`, `driverFirstName`, and `driverLastName`.

| Status | Message | When |
|--------|---------|------|
| `400` | `Start and end are required.` | Calendar `start` or `end` is missing or not a date |
| `400` | `End must be after start.` | Calendar `end` is not after `start` |
| `400` | `Vehicle type, departure, and return are required.` | Availability is missing a required query value |
| `400` | `Return must be after departure.` | Availability `returnAt` is before or equal to `departureAt` |
| `403` | `You do not manage this area.` | Area admin sets calendar `areaId` outside managed areas |
| `400` | `Start mileage is required.` | Check-out `startMileage` is not an integer |
| `400` | `This trip is already checked out.` | Check-out when `pickedUpAt` is already set |
| `400` | `Check out before checking in.` | Check-in with no open check-out |
| `400` | `End mileage is required.` | Check-in `endMileage` is not an integer |
| `400` | `End mileage must be greater than or equal to start mileage.` | Check-in end mileage is lower than start mileage |
| `403` | `You do not have permission for this action.` | Caller is not the assignment driver or an admin. An area admin outside the assignment's area receives `404` instead |
| `404` | `Assignment not found.` | Unknown assignment, or an area admin outside that area |
| `404` | `Vehicle not found.` | Unknown vehicle, or an area admin outside that vehicle's area |
| `401` | Unauthorized message | No session |
| `403` | `You do not have permission for this action.` | A requestor calls calendar or trip history |

## Conventions

- Flat JSON responses (no `{ success, data }` envelope).
- Errors: `{ "message": "..." }`.
- Authenticated routes: `Authorization: Bearer <token>`.
