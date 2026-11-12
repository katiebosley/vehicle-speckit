# Behavior & Rules Reference

**Living snapshot** of product rules currently in force on `dev`.

## Vehicle types (Feature 3, US-3.1 and US-3.2)

| Rule | Enforcement |
|------|-------------|
| Any signed-in user may list types. Admins see inactive types. Requestors and area admins see active types only, ordered by name. | `GET /vehicle-t2/vehicle-types` |
| Only an admin may create or edit a type. | `403` `{ "message": "You do not have permission for this action." }` |
| A blank name is rejected. A name that matches another type ignoring case is rejected. | `400` with the messages in Feature 3 FR-005 |
| A type stays active when a vehicle of that type is not `retired`. | `400` `{ "message": "This vehicle type is still used by a vehicle that is not retired." }` |
| No session | `401` `{ "message": "Unauthorized!" }` |

## Fleet (Feature 3, US-3.3 through US-3.7)

| Rule | Enforcement |
|------|-------------|
| Area admins create and edit vehicles only in areas from `getManagedAreaIds`. An admin may use any active area. | `403` `{ "message": "You do not manage this area." }` |
| A vehicle outside the caller's areas, including one id, is hidden. | `404` `{ "message": "Vehicle not found." }` |
| Requestors cannot call vehicle routes, and **Fleet** is not in their menu. `/fleet` sends them home. | `403` `{ "message": "You do not have permission for this action." }` |
| Retiring a vehicle that has a future approved trip is refused. Before `vehicle_assignments` exists, retire succeeds. | `409` `{ "message": "This vehicle is assigned to a future trip." }` |
| Blocks cannot overlap each other or an approved trip. Touching windows are allowed. | `400` / `409` messages in Feature 3 FR-017 and FR-018 |
| `npm run seed --prefix backend` adds Car, Truck, Van, and Golf Cart, plus sample vehicles, without overwriting existing rows. | `backend/scripts/seed.mjs` |

These files answer: *"What rules does the app enforce right now?"*  
They do **not** authorize new scope — implement only from `features/feature-*.md`.

| File | Role |
|------|------|
| [api.md](./api.md) | Routes / payloads |
| [data-model.md](./data-model.md) | Tables / columns |
| **This file** | Ownership, sort, validation, UI rules |
