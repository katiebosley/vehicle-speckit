# Data Model Reference

**Status:** Feature 3 tables are on the feature branch. `users`, `sessions`, `areas`, and `area_admins` are present so fleet routes can require a session and an area.

## Tables

### `users` / `sessions`

Present so vehicle-type routes can require a Bearer session (`req.user.role`). Columns match Feature 1. Google sign-in is not implemented on this branch.

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

## Associations

- `Session` belongsTo `User`
- `User` belongsToMany `Area` through `AreaAdmin`
- `Area` hasMany `Vehicle`
- `Vehicle` belongsTo `Area` and `VehicleType`
- `Vehicle` hasMany `VehicleUnavailability`
