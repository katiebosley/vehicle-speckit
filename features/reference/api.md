# API Reference

**Status:** Feature 1 sign-in, users, and profile, plus Feature 3 vehicle types, vehicles, unavailability, and the area reads the Fleet screen needs.

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

## Conventions

- Flat JSON responses (no `{ success, data }` envelope).
- Errors: `{ "message": "..." }`.
- Authenticated routes: `Authorization: Bearer <token>`.
