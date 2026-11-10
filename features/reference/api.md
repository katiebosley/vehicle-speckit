# API Reference

**Status:** Feature 1 and Feature 2 endpoints.

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
| `400`  | `Area name is required.`                                 | `POST`/`PUT /areas`      |
| `400`  | `Area name must be 100 characters or fewer.`             | `POST`/`PUT /areas`      |
| `400`  | `Area name is already taken.`                            | `POST`/`PUT /areas`      |
| `400`  | `User must be an active area admin.`                     | `POST /areas/:areaId/admins` |
| `400`  | `User is already an admin of this area.`                 | `POST /areas/:areaId/admins` |
| `403`  | `You do not manage this area.`                           | `GET /areas/:areaId`     |
| `404`  | `Area with id=<id> not found.`                           | Area routes              |
| `404`  | `User is not an admin of this area.`                     | `DELETE /areas/:areaId/admins/:userId` |

## Conventions

- Flat JSON responses (no `{ success, data }` envelope).
- Errors: `{ "message": "..." }`.
- Authenticated routes: `Authorization: Bearer <token>`.
