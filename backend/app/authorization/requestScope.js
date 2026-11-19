import db from "../models/index.js";

const requestIncludes = [
  { model: db.area, as: "area", attributes: ["id", "name"] },
  { model: db.vehicleType, as: "vehicleType", attributes: ["id", "name"] },
  { model: db.user, as: "reviewer", attributes: ["id", "firstName", "lastName"] },
];

export async function listOwnedRequests(userId) {
  return db.request.findAll({
    where: { requesterId: userId },
    include: requestIncludes,
    order: [["createdAt", "DESC"]],
  });
}

export async function getOwnedRequestOrNull(req, id) {
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) {
    return null;
  }

  const row = await db.request.findOne({
    where: { id: requestId, requesterId: req.user.id },
    include: requestIncludes,
  });
  return row ?? null;
}

function columnSet(rows) {
  return new Set(
    rows.map((row) => String(row.columnName ?? row.COLUMN_NAME ?? "").toLowerCase())
  );
}

function cell(row, name) {
  if (row[name] !== undefined && row[name] !== null) {
    return row[name];
  }
  const match = Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase());
  return match ? row[match] : null;
}

/**
 * Assignment rows are written by a later feature. This read returns [] when
 * `vehicle_assignments` is missing. `driver` is null until that table has `driver_id`.
 */
export async function listRequestAssignments(requestId) {
  const [columns] = await db.sequelize.query(
    `SELECT COLUMN_NAME AS columnName
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'vehicle_assignments'`
  );
  const names = columnSet(columns);
  if (!names.has("request_id") || !names.has("vehicle_id")) {
    return [];
  }

  const hasDriver = names.has("driver_id");
  const driverSelect = hasDriver
    ? "u.id AS driverId, u.first_name AS firstName, u.last_name AS lastName"
    : "NULL AS driverId, NULL AS firstName, NULL AS lastName";
  const driverJoin = hasDriver ? "LEFT JOIN users u ON u.id = va.driver_id" : "";

  const [rows] = await db.sequelize.query(
    `SELECT va.id AS id,
            v.id AS vehicleId,
            v.name AS vehicleName,
            v.license_plate AS licensePlate,
            ${driverSelect}
     FROM vehicle_assignments va
     INNER JOIN vehicles v ON v.id = va.vehicle_id
     ${driverJoin}
     WHERE va.request_id = :requestId
     ORDER BY va.id ASC`,
    { replacements: { requestId } }
  );

  return rows.map((row) => {
    const driverId = cell(row, "driverId");
    return {
      id: Number(cell(row, "id")),
      vehicle: {
        id: Number(cell(row, "vehicleId")),
        name: cell(row, "vehicleName"),
        licensePlate: cell(row, "licensePlate"),
      },
      driver: driverId
        ? {
            id: Number(driverId),
            firstName: cell(row, "firstName"),
            lastName: cell(row, "lastName"),
          }
        : null,
    };
  });
}
