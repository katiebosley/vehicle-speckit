# API Reference

**Status:** vehicle types from Feature 3 US-3.1 and US-3.2 are on the feature branch. Other endpoints are not implemented yet.

API mount path is `/vehicle-t2` (see `backend/server.js`).

## Endpoints

### Vehicle types (Feature 3, US-3.1)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/vehicle-t2/vehicle-types` | Any signed-in role. Admin receives every type. Other roles receive active types only. Ordered by name. |
| `POST` | `/vehicle-t2/vehicle-types` | Admin. `201` with the type. |
| `PUT` | `/vehicle-t2/vehicle-types/:vehicleTypeId` | Admin. Unknown id → `404`. |

Create and update body: `name`, optional `description`, optional `defaultPassengerCapacity` (1–30), optional `isActive` (default `true` on create). There is no delete.

## Conventions

- Flat JSON responses (no `{ success, data }` envelope).
- Errors: `{ "message": "..." }`.
- Authenticated routes: `Authorization: Bearer <token>` (when Feature auth is implemented).
