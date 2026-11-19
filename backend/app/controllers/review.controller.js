import { Op } from "sequelize";
import db from "../models/index.js";
import logger from "../config/logger.js";
import { checkVehicleAvailability } from "../../services/vehicleAvailability.js";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function personName(user) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : null;
}

function utcDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function licenseCovers(license, returnAt) {
  if (!license) {
    return false;
  }
  const licenseDate = license instanceof Date ? license.toISOString().slice(0, 10) : String(license).slice(0, 10);
  return licenseDate >= utcDate(returnAt);
}

const requestIncludes = [
  { model: db.user, as: "requester", attributes: ["id", "firstName", "lastName"] },
  { model: db.area, as: "area", attributes: ["id", "name"] },
  { model: db.vehicleType, as: "vehicleType", attributes: ["id", "name"] },
  { model: db.destination, as: "destinationRecord", attributes: ["id", "name", "isActive"] },
  {
    model: db.vehicleAssignment,
    as: "assignments",
    include: [
      { model: db.vehicle, as: "vehicle" },
      { model: db.user, as: "driver", attributes: ["id", "firstName", "lastName"] },
      { model: db.tripLog, as: "tripLog" },
    ],
  },
];

function presentTripLog(log) {
  if (!log) {
    return null;
  }
  return {
    id: log.id,
    assignment_id: log.assignmentId,
    start_mileage: log.startMileage,
    end_mileage: log.endMileage,
    fuel_added_gallons: log.fuelAddedGallons == null ? null : Number(log.fuelAddedGallons),
    picked_up_at: iso(log.pickedUpAt),
    returned_at: iso(log.returnedAt),
    issues_reported: log.issuesReported ?? null,
  };
}

function displayName(vehicle) {
  const name = typeof vehicle?.name === "string" ? vehicle.name.trim() : "";
  if (name) {
    return name;
  }
  if (!vehicle) {
    return null;
  }
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function presentAssignment(assignment) {
  const vehicle = assignment.vehicle;
  return {
    id: assignment.id,
    request_id: assignment.requestId,
    vehicle_id: assignment.vehicleId,
    vehicle_name: displayName(vehicle),
    license_plate: vehicle?.licensePlate || null,
    capacity: vehicle?.capacity ?? null,
    driver_id: assignment.driverId ?? null,
    driver_name: personName(assignment.driver),
    assigned_by: assignment.assignedBy,
    assigned_at: iso(assignment.assignedAt),
    trip_log: presentTripLog(assignment.tripLog),
  };
}

function presentRequest(request) {
  const assignments = [...(request.assignments || [])].sort((a, b) => a.id - b.id);
  const assignedCapacity = assignments.reduce((sum, assignment) => sum + (assignment.vehicle?.capacity || 0), 0);
  return {
    id: request.id,
    requester_id: request.requesterId,
    requester_name: personName(request.requester),
    area_id: request.areaId,
    area_name: request.area?.name ?? null,
    vehicle_type_id: request.vehicleTypeId,
    vehicle_type_name: request.vehicleType?.name ?? null,
    vehicles_needed: request.vehiclesNeeded,
    passenger_count: request.passengerCount,
    purpose: request.purpose,
    destination_id: request.destinationId ?? null,
    destination_name: request.destinationRecord?.name || request.destination,
    departure_at: iso(request.departureAt),
    return_at: iso(request.returnAt),
    status: request.status,
    reviewed_by: request.reviewedBy ?? null,
    reviewed_at: iso(request.reviewedAt),
    review_notes: request.reviewNotes ?? null,
    assigned_capacity: assignedCapacity,
    assignments: assignments.map(presentAssignment),
    created_at: iso(request.createdAt),
    updated_at: iso(request.updatedAt),
  };
}

async function areaIdsFor(user) {
  if (user.role === "admin") {
    return null;
  }
  const rows = await db.areaAdmin.findAll({ where: { userId: user.id }, attributes: ["areaId"] });
  return rows.map((row) => row.areaId);
}

async function findInScope(user, requestId, { transaction, lock } = {}) {
  const id = asId(requestId);
  if (id == null) {
    return null;
  }
  const request = await db.request.findByPk(id, { transaction, lock });
  if (!request) {
    return null;
  }
  const areaIds = await areaIdsFor(user);
  if (areaIds && !areaIds.includes(request.areaId)) {
    return null;
  }
  return request;
}

async function loadPresented(id, transaction) {
  const request = await db.request.findByPk(id, { include: requestIncludes, transaction });
  return presentRequest(request);
}

function notPending(request) {
  if (request.status !== "pending") {
    throw fail(400, "Only pending requests can be reviewed.");
  }
}

function ensureMutable(request) {
  if (request.status !== "approved" || new Date(request.departureAt).getTime() <= Date.now()) {
    throw fail(400, "Assignments cannot change after the trip starts.");
  }
}

async function assertDriver(request, driverId, transaction) {
  if (driverId == null) {
    return;
  }
  const driver = await db.user.findByPk(driverId, { transaction });
  if (!driver?.isActive || !driver.isApprovedDriver || !licenseCovers(driver.licenseExpiration, request.returnAt)) {
    throw fail(400, `Driver with id=${driverId} is not an approved driver with a current license.`);
  }
}

async function assertVehicle(request, vehicleId, transaction) {
  const check = await checkVehicleAvailability(vehicleId, request.departureAt, request.returnAt, {
    excludeRequestId: request.id,
    transaction,
  });
  if (check.reason === "not_found") {
    throw fail(400, `Vehicle with id=${vehicleId} not found.`);
  }
  const vehicle = await db.vehicle.findByPk(vehicleId, { transaction });
  if (vehicle.areaId !== request.areaId) {
    throw fail(400, `Vehicle with id=${vehicleId} does not belong to this request's area.`);
  }
  if (!check.available) {
    throw fail(409, `Vehicle with id=${vehicleId} is not available for this trip.`);
  }
}

function readAssignment(body) {
  const source = body ?? {};
  return {
    vehicleId: asId(source.vehicle_id),
    driverId: source.driver_id == null || source.driver_id === "" ? null : asId(source.driver_id),
    rawDriver: source.driver_id,
  };
}

function rejectDuplicateVehicles(ids) {
  if (new Set(ids).size !== ids.length) {
    throw fail(400, "A vehicle can only be assigned once per request.");
  }
}

function rejectDuplicateDrivers(ids) {
  const drivers = ids.filter((id) => id != null);
  if (new Set(drivers).size !== drivers.length) {
    throw fail(400, "A driver can only be assigned to one vehicle per request.");
  }
}

async function sendRequest(res, id, transaction) {
  return res.send(await loadPresented(id, transaction));
}

const controller = {};

controller.list = async (req, res) => {
  try {
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : "pending";
    const where = { status };
    const areaIds = await areaIdsFor(req.user);
    if (areaIds) {
      where.areaId = areaIds;
    }
    const requests = await db.request.findAll({
      where,
      include: requestIncludes,
      order: [["departureAt", "ASC"]],
    });
    return res.send(requests.map(presentRequest));
  } catch (err) {
    logger.error(`review.list failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load requests." });
  }
};

controller.availableVehicles = async (req, res) => {
  try {
    const request = await findInScope(req.user, req.params.requestId);
    if (!request) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const vehicles = await db.vehicle.findAll({ where: { areaId: request.areaId } });
    const available = [];
    for (const vehicle of vehicles) {
      const check = await checkVehicleAvailability(vehicle.id, request.departureAt, request.returnAt, {
        excludeRequestId: request.id,
      });
      if (check.available) {
        available.push(vehicle);
      }
    }
    available.sort((a, b) => {
      const aMatch = a.vehicleTypeId === request.vehicleTypeId ? 0 : 1;
      const bMatch = b.vehicleTypeId === request.vehicleTypeId ? 0 : 1;
      if (aMatch !== bMatch) {
        return aMatch - bMatch;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    return res.send(
      available.map((vehicle) => ({
        id: vehicle.id,
        name: displayName(vehicle),
        capacity: vehicle.capacity,
        license_plate: vehicle.licensePlate,
        vehicle_type_id: vehicle.vehicleTypeId,
      }))
    );
  } catch (err) {
    logger.error(`review.availableVehicles failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load vehicles." });
  }
};

controller.eligibleDrivers = async (req, res) => {
  try {
    const request = await findInScope(req.user, req.params.requestId);
    if (!request) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const users = await db.user.findAll({
      where: { isActive: true, isApprovedDriver: true, licenseExpiration: { [Op.ne]: null } },
      order: [["lastName", "ASC"], ["firstName", "ASC"]],
    });
    const eligible = users.filter((user) => licenseCovers(user.licenseExpiration, request.returnAt));
    return res.send(
      eligible.map((user) => ({
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        name: personName(user),
      }))
    );
  } catch (err) {
    logger.error(`review.eligibleDrivers failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load drivers." });
  }
};

controller.approve = async (req, res) => {
  try {
    const existing = await findInScope(req.user, req.params.requestId);
    if (!existing) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const items = Array.isArray(req.body?.assignments) ? req.body.assignments.map(readAssignment) : [];
    if (items.length === 0 || items.some((item) => item.vehicleId == null)) {
      return res.status(400).send({ message: "At least one vehicle is required." });
    }
    rejectDuplicateVehicles(items.map((item) => item.vehicleId));
    const badDriver = items.find((item) => item.rawDriver != null && item.rawDriver !== "" && item.driverId == null);
    if (badDriver) {
      return res.status(400).send({
        message: `Driver with id=${badDriver.rawDriver} is not an approved driver with a current license.`,
      });
    }
    rejectDuplicateDrivers(items.map((item) => item.driverId));

    const notes = typeof req.body?.review_notes === "string" ? req.body.review_notes.trim() : "";
    const saved = await db.sequelize.transaction(async (transaction) => {
      const request = await db.request.findByPk(existing.id, { transaction, lock: transaction.LOCK.UPDATE });
      notPending(request);
      const ordered = [...items].sort((a, b) => a.vehicleId - b.vehicleId);
      for (const item of ordered) {
        await assertVehicle(request, item.vehicleId, transaction);
        await assertDriver(request, item.driverId, transaction);
      }
      for (const item of items) {
        await db.vehicleAssignment.create(
          {
            requestId: request.id,
            vehicleId: item.vehicleId,
            driverId: item.driverId,
            assignedBy: req.user.id,
            assignedAt: new Date(),
          },
          { transaction }
        );
      }
      await request.update(
        {
          status: "approved",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
        },
        { transaction }
      );
      return loadPresented(request.id, transaction);
    });
    return res.send(saved);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.approve failed: ${err.message}`);
    return res.status(500).send({ message: "Could not approve the request." });
  }
};

controller.deny = async (req, res) => {
  try {
    const existing = await findInScope(req.user, req.params.requestId);
    if (!existing) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const notes = typeof req.body?.review_notes === "string" ? req.body.review_notes.trim() : "";
    if (!notes) {
      return res.status(400).send({ message: "A note is required to deny a request." });
    }
    const saved = await db.sequelize.transaction(async (transaction) => {
      const request = await db.request.findByPk(existing.id, { transaction, lock: transaction.LOCK.UPDATE });
      notPending(request);
      await request.update(
        {
          status: "denied",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
        { transaction }
      );
      return loadPresented(request.id, transaction);
    });
    return res.send(saved);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.deny failed: ${err.message}`);
    return res.status(500).send({ message: "Could not deny the request." });
  }
};

controller.addAssignment = async (req, res) => {
  try {
    const existing = await findInScope(req.user, req.params.requestId);
    if (!existing) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const item = readAssignment(req.body);
    if (item.vehicleId == null) {
      return res.status(400).send({ message: "At least one vehicle is required." });
    }
    if (item.rawDriver != null && item.rawDriver !== "" && item.driverId == null) {
      return res.status(400).send({
        message: `Driver with id=${item.rawDriver} is not an approved driver with a current license.`,
      });
    }
    const saved = await db.sequelize.transaction(async (transaction) => {
      const request = await db.request.findByPk(existing.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: db.vehicleAssignment, as: "assignments" }],
      });
      ensureMutable(request);
      if (request.assignments.some((row) => row.vehicleId === item.vehicleId)) {
        throw fail(400, "A vehicle can only be assigned once per request.");
      }
      if (item.driverId != null && request.assignments.some((row) => row.driverId === item.driverId)) {
        throw fail(400, "A driver can only be assigned to one vehicle per request.");
      }
      await assertVehicle(request, item.vehicleId, transaction);
      await assertDriver(request, item.driverId, transaction);
      await db.vehicleAssignment.create(
        {
          requestId: request.id,
          vehicleId: item.vehicleId,
          driverId: item.driverId,
          assignedBy: req.user.id,
          assignedAt: new Date(),
        },
        { transaction }
      );
      return loadPresented(request.id, transaction);
    });
    return res.send(saved);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.addAssignment failed: ${err.message}`);
    return res.status(500).send({ message: "Could not add the assignment." });
  }
};

controller.updateAssignment = async (req, res) => {
  try {
    const existing = await findInScope(req.user, req.params.requestId);
    if (!existing) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const assignmentId = asId(req.params.assignmentId);
    const item = readAssignment(req.body);
    if (item.rawDriver != null && item.rawDriver !== "" && item.driverId == null) {
      return res.status(400).send({
        message: `Driver with id=${item.rawDriver} is not an approved driver with a current license.`,
      });
    }
    const saved = await db.sequelize.transaction(async (transaction) => {
      const request = await db.request.findByPk(existing.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: db.vehicleAssignment, as: "assignments" }],
      });
      const assignment = assignmentId == null ? null : request.assignments.find((row) => row.id === assignmentId);
      if (!assignment) {
        throw fail(404, `Assignment with id=${req.params.assignmentId} not found.`);
      }
      ensureMutable(request);
      if (request.assignments.some((row) => row.id !== assignment.id && row.vehicleId === item.vehicleId)) {
        throw fail(400, "A vehicle can only be assigned once per request.");
      }
      if (item.driverId != null && request.assignments.some((row) => row.id !== assignment.id && row.driverId === item.driverId)) {
        throw fail(400, "A driver can only be assigned to one vehicle per request.");
      }
      if (item.vehicleId == null) {
        throw fail(400, "Vehicle with id= not found.");
      }
      await assertVehicle(request, item.vehicleId, transaction);
      await assertDriver(request, item.driverId, transaction);
      await assignment.update(
        {
          vehicleId: item.vehicleId,
          driverId: item.driverId,
          assignedBy: req.user.id,
          assignedAt: new Date(),
        },
        { transaction }
      );
      return loadPresented(request.id, transaction);
    });
    return res.send(saved);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.updateAssignment failed: ${err.message}`);
    return res.status(500).send({ message: "Could not update the assignment." });
  }
};

controller.removeAssignment = async (req, res) => {
  try {
    const existing = await findInScope(req.user, req.params.requestId);
    if (!existing) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const assignmentId = asId(req.params.assignmentId);
    const saved = await db.sequelize.transaction(async (transaction) => {
      const request = await db.request.findByPk(existing.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: db.vehicleAssignment, as: "assignments" }],
      });
      const assignment = assignmentId == null ? null : request.assignments.find((row) => row.id === assignmentId);
      if (!assignment) {
        throw fail(404, `Assignment with id=${req.params.assignmentId} not found.`);
      }
      ensureMutable(request);
      if (request.assignments.length <= 1) {
        throw fail(400, "An approved request must keep at least one vehicle.");
      }
      await assignment.destroy({ transaction });
      return loadPresented(request.id, transaction);
    });
    return res.send(saved);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.removeAssignment failed: ${err.message}`);
    return res.status(500).send({ message: "Could not remove the assignment." });
  }
};

function readLog(body) {
  const source = body ?? {};
  const pickedUpAt = source.picked_up_at ? new Date(source.picked_up_at) : null;
  const returnedAt = source.returned_at ? new Date(source.returned_at) : null;
  return {
    assignmentId: asId(source.assignment_id),
    startMileage: source.start_mileage,
    endMileage: source.end_mileage,
    fuel: source.fuel_added_gallons,
    pickedUpAt: pickedUpAt && !Number.isNaN(pickedUpAt.getTime()) ? pickedUpAt : null,
    returnedAt: returnedAt && !Number.isNaN(returnedAt.getTime()) ? returnedAt : null,
    issues: typeof source.issues_reported === "string" ? source.issues_reported : null,
  };
}

function assertLog(log) {
  if (
    !Number.isInteger(log.startMileage) ||
    !Number.isInteger(log.endMileage) ||
    !log.pickedUpAt ||
    !log.returnedAt
  ) {
    throw fail(400, "Start mileage, end mileage, picked up at, and returned at are required.");
  }
  if (log.endMileage < log.startMileage) {
    throw fail(400, "End mileage must be greater than or equal to start mileage.");
  }
  if (log.returnedAt.getTime() < log.pickedUpAt.getTime()) {
    throw fail(400, "Return time must be after pick-up time.");
  }
  if (log.fuel != null && log.fuel !== "" && (Number.isNaN(Number(log.fuel)) || Number(log.fuel) < 0)) {
    throw fail(400, "Fuel added must be zero or greater.");
  }
}

controller.complete = async (req, res) => {
  try {
    const existing = await findInScope(req.user, req.params.requestId);
    if (!existing) {
      return res.status(404).send({ message: `Request with id=${req.params.requestId} not found.` });
    }
    const logs = Array.isArray(req.body?.trip_logs) ? req.body.trip_logs.map(readLog) : [];
    const saved = await db.sequelize.transaction(async (transaction) => {
      const request = await db.request.findByPk(existing.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [{ model: db.vehicleAssignment, as: "assignments" }],
      });
      if (request.status !== "approved" || new Date(request.returnAt).getTime() > Date.now()) {
        throw fail(400, "Only approved requests whose trip has ended can be completed.");
      }
      const expected = new Set(request.assignments.map((row) => row.id));
      const received = logs.map((log) => log.assignmentId);
      if (received.length !== expected.size || new Set(received).size !== expected.size || received.some((id) => !expected.has(id))) {
        throw fail(400, "A trip log is required for every assigned vehicle.");
      }
      logs.forEach(assertLog);
      for (const log of logs) {
        await db.tripLog.create(
          {
            assignmentId: log.assignmentId,
            startMileage: log.startMileage,
            endMileage: log.endMileage,
            fuelAddedGallons: log.fuel == null || log.fuel === "" ? null : log.fuel,
            pickedUpAt: log.pickedUpAt,
            returnedAt: log.returnedAt,
            issuesReported: log.issues,
          },
          { transaction }
        );
      }
      await request.update({ status: "completed" }, { transaction });
      return loadPresented(request.id, transaction);
    });
    return res.send(saved);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.complete failed: ${err.message}`);
    return res.status(500).send({ message: "Could not complete the request." });
  }
};

controller.updateTripLog = async (req, res) => {
  try {
    const tripLogId = asId(req.params.tripLogId);
    const log = await db.tripLog.findByPk(tripLogId, {
      include: [{ model: db.vehicleAssignment, as: "assignment", include: [{ model: db.request, as: "request" }] }],
    });
    const request = log?.assignment?.request;
    const areaIds = await areaIdsFor(req.user);
    if (!log || !request || request.status !== "completed" || (areaIds && !areaIds.includes(request.areaId))) {
      return res.status(404).send({ message: `Trip log with id=${req.params.tripLogId} not found.` });
    }
    const input = readLog(req.body);
    assertLog(input);
    await log.update({
      startMileage: input.startMileage,
      endMileage: input.endMileage,
      fuelAddedGallons: input.fuel == null || input.fuel === "" ? null : input.fuel,
      pickedUpAt: input.pickedUpAt,
      returnedAt: input.returnedAt,
      issuesReported: input.issues,
    });
    const fresh = await db.tripLog.findByPk(log.id);
    return res.send(presentTripLog(fresh));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).send({ message: err.message });
    }
    logger.error(`review.updateTripLog failed: ${err.message}`);
    return res.status(500).send({ message: "Could not update the trip log." });
  }
};

export default controller;
