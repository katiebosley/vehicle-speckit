# Data Model Reference

**Status:** Feature 1 (`users`, `sessions`), Feature 3 (`vehicle_types`, `areas`, `area_admins`, `vehicles`, `vehicle_unavailability`), and Feature 4 (`requests`).

Update this file when a feature that defines schema merges to `dev`.

## Target ERD

The team's full Vehicle Scheduling (OC Fleet) model. Tables not listed under **Tables** below are planned by later features and do not exist yet.

![Vehicle Scheduling ERD](../../docs/erd/vehicle-scheduling-erd.png)

Source image: [`docs/erd/vehicle-scheduling-erd.png`](../../docs/erd/vehicle-scheduling-erd.png). `sessions` is an auth table and is not drawn on the ERD.

## Tables

### `users` — Feature 1

| Column               | Type                                     | Rules                                               |
| -------------------- | ---------------------------------------- | --------------------------------------------------- |
| `id`                 | INTEGER PK                               | Auto-increment                                      |
| `google_id`          | STRING(255)                              | Unique; null until first sign-in (seeded users)     |
| `email`              | STRING(255)                              | Required, unique; stored trimmed + lowercase        |
| `first_name`         | STRING(100)                              | Required; trimmed                                   |
| `last_name`          | STRING(100)                              | Required; trimmed                                   |
| `phone`              | STRING(20)                               | Optional                                            |
| `role`               | ENUM(`admin`, `area_admin`, `requestor`) | Required; default `requestor`                       |
| `is_approved_driver` | BOOLEAN                                  | Default `false`                                     |
| `license_expiration` | DATEONLY                                 | Optional; required when `is_approved_driver` true   |
| `is_active`          | BOOLEAN                                  | Default `true`                                      |
| `created_at`         | DATE                                     | Sequelize timestamps                                |
| `updated_at`         | DATE                                     | Sequelize timestamps                                |

Model: `backend/app/models/user.model.js`. `defaultScope` excludes `google_id`; use `db.user.unscoped()` to read it.

### `sessions` — Feature 1

| Column            | Type       | Rules                                             |
| ----------------- | ---------- | ------------------------------------------------- |
| `id`              | INTEGER PK | Auto-increment                                    |
| `token`           | STRING     | Required; set to `""` on sign-out                 |
| `email`           | STRING     | Required                                          |
| `expiration_date` | DATE       | Required; 24 hours after creation                 |
| `user_id`         | INTEGER FK | Required, references `users.id` (cascade delete)  |
| `created_at`      | DATE       | Sequelize timestamps                              |
| `updated_at`      | DATE       | Sequelize timestamps                              |

Model: `backend/app/models/session.model.js`.

### `vehicle_types`

| Column | Notes |
|--------|--------|
| `name` | Required, unique, compared case-insensitively |
| `description` | Optional |
| `default_passenger_capacity` | Optional integer 1–30 |
| `is_active` | Default `true` |

### `areas` / `area_admins`

Area name, description, and `is_active`. `area_admins` pairs a user with an area. Feature 2 owns writing these rows. This branch reads them through `getManagedAreaIds`.

### `vehicles`

One vehicle belongs to one area and one vehicle type. `status` is `available`, `maintenance`, or `retired`. `displayName` is computed: the name when it is set, otherwise year, make, and model.

### `vehicle_unavailability`

A dated block on one vehicle: `starts_at`, `ends_at`, `reason`, and `created_by`. It does not change `status`.

### `requests` — Feature 4

| Column | Type | Rules |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `requester_id` | INTEGER FK | Required; references `users.id`; set from the session |
| `area_id` | INTEGER FK | Required; references `areas.id`; area must be active on create and update |
| `vehicle_type_id` | INTEGER FK | Required; references `vehicle_types.id`; type must be active on create and update |
| `vehicles_needed` | INTEGER | Required; default `1`; at least 1 |
| `passenger_count` | INTEGER | Required; at least 1 |
| `purpose` | STRING(255) | Required; trimmed; not blank |
| `destination` | STRING(255) | Required; trimmed; not blank |
| `departure_at` | DATETIME | Required; must be after the server time on create and update |
| `return_at` | DATETIME | Required; must be after `departure_at` |
| `status` | ENUM | `pending`, `approved`, `denied`, `cancelled`, `completed`; default `pending` |
| `reviewed_by` | INTEGER FK NULL | References `users.id`; written by Feature 5 |
| `reviewed_at` | DATETIME NULL | Written by Feature 5 |
| `review_notes` | TEXT NULL | Written by Feature 5 |
| `created_at` | DATETIME | Sequelize timestamps |
| `updated_at` | DATETIME | Sequelize timestamps |

Model: `backend/app/models/request.model.js`. `vehicle_assignments` is not created here. Request detail reads that table when it exists and returns `assignments: []` otherwise.

## Associations

Defined in `backend/app/models/index.js`:

- `User hasMany Session` (`userId`, cascade delete)
- `Session belongsTo User` (`userId`, alias `user`)
- `User` belongsToMany `Area` through `AreaAdmin` (alias `managedAreas` / `admins`)
- `Area` hasMany `Vehicle`
- `Vehicle` belongsTo `Area` and `VehicleType`
- `Vehicle` hasMany `VehicleUnavailability`
- `VehicleUnavailability` belongsTo `Vehicle`
- `VehicleUnavailability` belongsTo `User` (`createdBy`)
- `User` hasMany `Request` (`requesterId`, alias `requests`)
- `Request` belongsTo `User` as `requester` (`requesterId`) and as `reviewer` (`reviewedBy`)
- `Area` hasMany `Request`; `Request` belongsTo `Area`
- `VehicleType` hasMany `Request`; `Request` belongsTo `VehicleType`
