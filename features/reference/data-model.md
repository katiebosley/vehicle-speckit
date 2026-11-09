# Data Model Reference

**Status:** empty starter — no application tables yet.

Update this file when a feature that defines schema merges to `dev`.

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

### `vehicles`

Table exists so a type cannot be deactivated while a non-retired vehicle uses it. Vehicle create/edit APIs are not part of US-3.1.

## Associations

- `Session` belongsTo `User`
- `VehicleType` hasMany `Vehicle`
- `Vehicle` belongsTo `VehicleType`
