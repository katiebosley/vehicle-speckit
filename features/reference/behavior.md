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

These files answer: *"What rules does the app enforce right now?"*  
They do **not** authorize new scope — implement only from `features/feature-*.md`.

| File | Role |
|------|------|
| [api.md](./api.md) | Routes / payloads |
| [data-model.md](./data-model.md) | Tables / columns |
| **This file** | Ownership, sort, validation, UI rules |
