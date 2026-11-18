# API Reference

**Status:** Feature 1 sign-in, users, and profile, Feature 2 areas, Feature 3 fleet, and Feature 4 requests.

API mount path is `/vehicle-t2` (see `backend/server.js`). The feature spec writes these routes as `/vehicle`.

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
| `PUT`  | `/vehicle-t2/profile/test-role` | Yes   | Testing: set own `role` to `admin` or `requestor`          | 4       |
| `GET`  | `/vehicle-t2/areas`         | Yes        | List areas. Admin: all. Other roles: active only. Ordered by name. | 2 |
| `GET`  | `/vehicle-t2/areas/mine`    | Yes, admin / area admin | Areas the user manages, including inactive | 2 |
| `GET`  | `/vehicle-t2/areas/:areaId` | Yes, admin / area admin | One area. Area admins only for an area they manage. | 2 |
| `POST` | `/vehicle-t2/areas`         | Yes, admin | Create an area | 2 |
| `PUT`  | `/vehicle-t2/areas/:areaId` | Yes, admin | Update name, description, `isActive` | 2 |
| `POST` | `/vehicle-t2/areas/:areaId/admins` | Yes, admin | Assign an area admin. Body `{ "userId": <id> }` | 2 |
| `DELETE` | `/vehicle-t2/areas/:areaId/admins/:userId` | Yes, admin | Remove an area admin | 2 |

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
| `403`  | `You do not have permission for this action.`            | Admin-only routes as a non-admin |
| `400`  | `Role must be admin, area_admin, or requestor.`          | `PUT /users/:userId`     |
| `400`  | `You cannot change your own role or active status.`      | `PUT /users/:userId`     |
| `400`  | `License expiration is required for approved drivers.`   | `PUT /users/:userId`     |
| `404`  | `User with id=<id> not found.`                           | `GET`/`PUT /users/:userId`, `POST /areas/:areaId/admins` |
| `400`  | `First name is required.` / `Last name is required.`     | `PUT /profile`           |
| `400`  | `Phone must be 20 characters or fewer.`                  | `PUT /profile`           |
| `400`  | `Role must be admin or requestor.`                       | `PUT /profile/test-role` |
| `400`  | `Area name is required.`                                 | `POST`/`PUT /areas`      |
| `400`  | `Area name must be 100 characters or fewer.`             | `POST`/`PUT /areas`      |
| `400`  | `Area name is already taken.`                            | `POST`/`PUT /areas`      |
| `400`  | `User must be an active area admin.`                     | `POST /areas/:areaId/admins` |
| `400`  | `User is already an admin of this area.`                 | `POST /areas/:areaId/admins` |
| `403`  | `You do not manage this area.`                           | `GET /areas/:areaId`     |
| `404`  | `Area with id=<id> not found.`                           | Area routes              |
| `404`  | `User is not an admin of this area.`                     | `DELETE /areas/:areaId/admins/:userId` |

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

## Conventions

- Flat JSON responses (no `{ success, data }` envelope).
- Errors: `{ "message": "..." }`.
- Authenticated routes: `Authorization: Bearer <token>`.
