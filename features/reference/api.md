# API Reference

**Status:** Feature 3 vehicle types, vehicles, and unavailability are on the feature branch. Area list routes are the reads the Fleet screen needs until Feature 2 lands.

API mount path is `/vehicle-t2` (see `backend/server.js`).

## Endpoints

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
