import { Op } from "sequelize";
import db from "../app/models/index.js";

export async function checkVehicleAvailability(vehicleId, start, end, { excludeRequestId, transaction } = {}) {
  const vehicle = await db.vehicle.findByPk(vehicleId, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  if (!vehicle) {
    return { available: false, reason: "not_found" };
  }
  if (vehicle.status === "retired") {
    return { available: false, reason: "retired" };
  }
  if (vehicle.status !== "available") {
    return { available: false, reason: "maintenance" };
  }

  const blocked = await db.vehicleUnavailability.findOne({
    where: {
      vehicleId,
      startsAt: { [Op.lt]: end },
      endsAt: { [Op.gt]: start },
    },
    transaction,
  });
  if (blocked) {
    return { available: false, reason: "blocked" };
  }

  const requestWhere = {
    status: "approved",
    departureAt: { [Op.lt]: end },
    returnAt: { [Op.gt]: start },
  };
  if (excludeRequestId != null) {
    requestWhere.id = { [Op.ne]: excludeRequestId };
  }

  const booked = await db.vehicleAssignment.findOne({
    where: { vehicleId },
    include: [{ model: db.request, as: "request", required: true, where: requestWhere }],
    transaction,
  });
  if (booked) {
    return { available: false, reason: "booked" };
  }

  return { available: true, reason: null };
}
