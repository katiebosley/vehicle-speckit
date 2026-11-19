import { Op } from "sequelize";
import db from "../models/index.js";
import logger from "../config/logger.js";
import { getManagedAreaIds } from "../authorization/areaScope.js";

const Area = db.area;
const Vehicle = db.vehicle;
const VehicleType = db.vehicleType;
const VehicleUnavailability = db.vehicleUnavailability;

const DISPLAY_NAME_SQL =
  "CASE WHEN `vehicle`.`name` IS NOT NULL AND CHAR_LENGTH(TRIM(`vehicle`.`name`)) > 0 THEN `vehicle`.`name` ELSE CONCAT(`vehicle`.`year`, ' ', `vehicle`.`make`, ' ', `vehicle`.`model`) END";

function sendError(res, status, message) {
  return res.status(status).send({ message });
}

function parseInteger(value) {
  if (value === undefined || value === null || value === "") {
    return { missing: true };
  }
  if (typeof value === "boolean") {
    return { invalid: true };
  }
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(number)) {
    return { invalid: true };
  }
  return { value: number };
}

function requiredText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return value;
}

function parseInstant(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function displayNameOf(vehicle) {
  const name = typeof vehicle.name === "string" ? vehicle.name.trim() : "";
  if (name) {
    return name;
  }
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function presentWindow(window) {
  return {
    id: window.id,
    vehicleId: window.vehicleId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    reason: window.reason,
    createdBy: window.createdBy,
    createdAt: window.createdAt,
    updatedAt: window.updatedAt,
  };
}

function presentVehicle(vehicle, { includeWindows = false } = {}) {
  const name = typeof vehicle.name === "string" && vehicle.name.trim() ? vehicle.name.trim() : null;
  const body = {
    id: vehicle.id,
    areaId: vehicle.areaId,
    areaName: vehicle.area?.name ?? null,
    vehicleTypeId: vehicle.vehicleTypeId,
    vehicleTypeName: vehicle.vehicleType?.name ?? null,
    name,
    displayName: displayNameOf(vehicle),
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vin: vehicle.vin,
    purchasedDate: vehicle.purchasedDate,
    color: vehicle.color,
    capacity: vehicle.capacity,
    licensePlate: vehicle.licensePlate,
    licensePlateExpireMonth: vehicle.licensePlateExpireMonth,
    currentMileage: vehicle.currentMileage,
    status: vehicle.status,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };

  if (includeWindows) {
    body.unavailability = (vehicle.unavailability || []).map(presentWindow);
  }

  return body;
}

const vehicleIncludes = [
  { model: Area, as: "area", attributes: ["id", "name"] },
  { model: VehicleType, as: "vehicleType", attributes: ["id", "name"] },
];

async function loadVehicle(id, { withWindows = false } = {}) {
  const include = [...vehicleIncludes];
  if (withWindows) {
    include.push({
      model: VehicleUnavailability,
      as: "unavailability",
      separate: true,
      order: [["startsAt", "ASC"]],
    });
  }
  return Vehicle.findByPk(id, { include });
}

async function inScope(user, vehicle) {
  const managed = await getManagedAreaIds(user);
  return managed.includes(vehicle.areaId);
}

async function tableExists(tableName) {
  const [rows] = await db.sequelize.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = :tableName
     LIMIT 1`,
    { replacements: { tableName } }
  );
  return rows.length > 0;
}

async function assignmentTablesReady() {
  return (await tableExists("vehicle_assignments")) && (await tableExists("requests"));
}

async function hasFutureApprovedTrip(vehicleId) {
  if (!(await assignmentTablesReady())) {
    return false;
  }

  const [rows] = await db.sequelize.query(
    `SELECT va.id
     FROM vehicle_assignments va
     INNER JOIN requests r ON r.id = va.request_id
     WHERE va.vehicle_id = :vehicleId
       AND r.status = 'approved'
       AND r.return_at > :now
     LIMIT 1`,
    { replacements: { vehicleId, now: new Date() } }
  );
  return rows.length > 0;
}

async function overlapsApprovedTrip(vehicleId, startsAt, endsAt) {
  if (!(await assignmentTablesReady())) {
    return false;
  }

  const [rows] = await db.sequelize.query(
    `SELECT va.id
     FROM vehicle_assignments va
     INNER JOIN requests r ON r.id = va.request_id
     WHERE va.vehicle_id = :vehicleId
       AND r.status = 'approved'
       AND r.departure_at < :endsAt
       AND :startsAt < r.return_at
     LIMIT 1`,
    { replacements: { vehicleId, startsAt, endsAt } }
  );
  return rows.length > 0;
}

async function findNormalized(column, value, excludeId) {
  const where = [db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col(column)), value.toLowerCase())];
  if (excludeId !== undefined) {
    where.push({ id: { [Op.ne]: excludeId } });
  }
  return Vehicle.findOne({ where: { [Op.and]: where } });
}

function maxYear() {
  return new Date().getUTCFullYear() + 1;
}

function validateFields(body, { partial }) {
  const updates = {};
  const has = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);

  if (!partial) {
    const requiredMissing = ["areaId", "vehicleTypeId", "make", "model", "year", "vin", "purchasedDate", "color", "capacity", "licensePlate", "licensePlateExpireMonth", "currentMileage"].some((key) => {
      const value = body[key];
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === "string" && value.trim() === "") {
        return true;
      }
      return false;
    });
    if (requiredMissing) {
      return { error: "All required fields must be provided." };
    }
  }

  if (has("name") && body.name !== undefined) {
    if (body.name === null || (typeof body.name === "string" && body.name.trim() === "")) {
      updates.name = null;
    } else if (typeof body.name !== "string") {
      return { error: "All required fields must be provided." };
    } else if (body.name.trim().length > 100) {
      return { error: "Name must be 100 characters or fewer." };
    } else {
      updates.name = body.name.trim();
    }
  }

  if (has("make")) {
    const make = requiredText(body.make);
    if (!make) {
      return { error: "All required fields must be provided." };
    }
    if (make.length > 50) {
      return { error: "Make must be 50 characters or fewer." };
    }
    updates.make = make;
  }

  if (has("model")) {
    const model = requiredText(body.model);
    if (!model) {
      return { error: "All required fields must be provided." };
    }
    if (model.length > 50) {
      return { error: "Model must be 50 characters or fewer." };
    }
    updates.model = model;
  }

  if (has("year")) {
    const year = parseInteger(body.year);
    const limit = maxYear();
    if (year.missing || year.invalid || year.value < 1990 || year.value > limit) {
      return { error: `Year must be between 1990 and ${limit}.` };
    }
    updates.year = year.value;
  }

  if (has("vin")) {
    const vin = requiredText(body.vin);
    if (!vin) {
      return { error: "All required fields must be provided." };
    }
    if (!/^[A-Za-z0-9]{6,17}$/.test(vin)) {
      return { error: "VIN must be 6 to 17 letters or digits." };
    }
    updates.vin = vin.toUpperCase();
  }

  if (has("purchasedDate")) {
    const purchasedDate = typeof body.purchasedDate === "string" ? body.purchasedDate.trim() : "";
    const parsed = parseDateOnly(purchasedDate);
    if (!parsed) {
      return { error: "All required fields must be provided." };
    }
    if (parsed > todayUtc()) {
      return { error: "Purchased date cannot be in the future." };
    }
    updates.purchasedDate = parsed;
  }

  if (has("color")) {
    const color = requiredText(body.color);
    if (!color) {
      return { error: "All required fields must be provided." };
    }
    if (color.length > 40) {
      return { error: "Color must be 40 characters or fewer." };
    }
    updates.color = color;
  }

  if (has("capacity")) {
    const capacity = parseInteger(body.capacity);
    if (capacity.missing || capacity.invalid || capacity.value < 1 || capacity.value > 30) {
      return { error: "Capacity must be from 1 to 30." };
    }
    updates.capacity = capacity.value;
  }

  if (has("licensePlate")) {
    const licensePlate = requiredText(body.licensePlate);
    if (!licensePlate) {
      return { error: "All required fields must be provided." };
    }
    if (licensePlate.length > 15) {
      return { error: "License plate must be 15 characters or fewer." };
    }
    updates.licensePlate = licensePlate.toUpperCase();
  }

  if (has("licensePlateExpireMonth")) {
    const month = parseInteger(body.licensePlateExpireMonth);
    if (month.missing || month.invalid || month.value < 1 || month.value > 12) {
      return { error: "License plate expire month must be from 1 to 12." };
    }
    updates.licensePlateExpireMonth = month.value;
  }

  if (has("currentMileage")) {
    const mileage = parseInteger(body.currentMileage);
    if (mileage.missing || mileage.invalid || mileage.value < 0) {
      return { error: "Mileage must be 0 or greater." };
    }
    updates.currentMileage = mileage.value;
  }

  if (has("status") && body.status !== undefined) {
    if (!["available", "maintenance", "retired"].includes(body.status)) {
      return { error: "Status must be available, maintenance, or retired." };
    }
    updates.status = body.status;
  }

  return { updates };
}

async function assertArea(user, areaId) {
  const parsed = parseInteger(areaId);
  if (parsed.missing || parsed.invalid) {
    return { error: "You do not manage this area.", status: 403 };
  }

  const managed = await getManagedAreaIds(user);
  if (!managed.includes(parsed.value)) {
    return { error: "You do not manage this area.", status: 403 };
  }

  const area = await Area.findByPk(parsed.value);
  if (!area || !area.isActive) {
    return { error: "Area is not active.", status: 400 };
  }

  return { areaId: parsed.value };
}

async function assertType(vehicleTypeId) {
  const parsed = parseInteger(vehicleTypeId);
  if (parsed.missing || parsed.invalid) {
    return { error: "Invalid vehicle type.", status: 400 };
  }

  const type = await VehicleType.findByPk(parsed.value);
  if (!type || !type.isActive) {
    return { error: "Invalid vehicle type.", status: 400 };
  }

  return { vehicleTypeId: parsed.value };
}

const controller = {};

controller.findAll = async (req, res) => {
  try {
    const managed = await getManagedAreaIds(req.user);
    if (req.user.role !== "admin" && managed.length === 0) {
      return res.send([]);
    }

    const where = {};
    if (req.user.role !== "admin") {
      where.areaId = { [Op.in]: managed };
    }

    if (req.query.areaId !== undefined) {
      const areaId = parseInteger(req.query.areaId);
      if (req.user.role !== "admin") {
        if (areaId.missing || areaId.invalid || !managed.includes(areaId.value)) {
          return sendError(res, 403, "You do not manage this area.");
        }
      } else if (areaId.missing || areaId.invalid || !(await Area.findByPk(areaId.value))) {
        return sendError(res, 404, `Area with id=${req.query.areaId} not found.`);
      }
      where.areaId = areaId.value;
    }

    if (req.query.status !== undefined && ["available", "maintenance", "retired"].includes(req.query.status)) {
      where.status = req.query.status;
    }

    if (req.query.vehicleTypeId !== undefined) {
      const typeId = parseInteger(req.query.vehicleTypeId);
      if (!typeId.missing && !typeId.invalid) {
        where.vehicleTypeId = typeId.value;
      }
    }

    const vehicles = await Vehicle.findAll({
      where,
      include: vehicleIncludes,
      order: [[db.sequelize.literal(DISPLAY_NAME_SQL), "ASC"]],
    });

    return res.send(vehicles.map((vehicle) => presentVehicle(vehicle)));
  } catch (err) {
    logger.error(err.message);
    return sendError(res, 500, "Unable to list vehicles.");
  }
};

controller.findOne = async (req, res) => {
  try {
    const id = parseInteger(req.params.vehicleId);
    if (id.missing || id.invalid) {
      return sendError(res, 404, "Vehicle not found.");
    }

    const vehicle = await loadVehicle(id.value, { withWindows: true });
    if (!vehicle || !(await inScope(req.user, vehicle))) {
      return sendError(res, 404, "Vehicle not found.");
    }

    return res.send(presentVehicle(vehicle, { includeWindows: true }));
  } catch (err) {
    logger.error(err.message);
    return sendError(res, 500, "Unable to load vehicle.");
  }
};

controller.create = async (req, res) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, "areaId")) {
      const area = await assertArea(req.user, req.body.areaId);
      if (area.error) {
        return sendError(res, area.status, area.error);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "vehicleTypeId")) {
      const type = await assertType(req.body.vehicleTypeId);
      if (type.error) {
        return sendError(res, type.status, type.error);
      }
    }

    const validated = validateFields(req.body, { partial: false });
    if (validated.error) {
      return sendError(res, 400, validated.error);
    }

    const vinTaken = await findNormalized("vin", validated.updates.vin);
    if (vinTaken) {
      return sendError(res, 400, "VIN is already in use.");
    }

    const plateTaken = await findNormalized("license_plate", validated.updates.licensePlate);
    if (plateTaken) {
      return sendError(res, 400, "License plate is already in use.");
    }

    const created = await Vehicle.create({
      ...validated.updates,
      areaId: parseInteger(req.body.areaId).value,
      vehicleTypeId: parseInteger(req.body.vehicleTypeId).value,
      status: validated.updates.status || "available",
    });

    const vehicle = await loadVehicle(created.id);
    return res.status(201).send(presentVehicle(vehicle));
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      const fields = Object.keys(err.fields || {});
      if (fields.some((field) => field.includes("license"))) {
        return sendError(res, 400, "License plate is already in use.");
      }
      return sendError(res, 400, "VIN is already in use.");
    }
    logger.error(err.message);
    return sendError(res, 500, "Unable to create vehicle.");
  }
};

controller.update = async (req, res) => {
  try {
    const id = parseInteger(req.params.vehicleId);
    if (id.missing || id.invalid) {
      return sendError(res, 404, "Vehicle not found.");
    }

    const vehicle = await Vehicle.findByPk(id.value);
    if (!vehicle || !(await inScope(req.user, vehicle))) {
      return sendError(res, 404, "Vehicle not found.");
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "areaId")) {
      const area = await assertArea(req.user, req.body.areaId);
      if (area.error) {
        return sendError(res, area.status, area.error);
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "vehicleTypeId")) {
      const nextType = parseInteger(req.body.vehicleTypeId);
      if (nextType.missing || nextType.invalid || nextType.value !== vehicle.vehicleTypeId) {
        const type = await assertType(req.body.vehicleTypeId);
        if (type.error) {
          return sendError(res, type.status, type.error);
        }
      }
    }

    const validated = validateFields(req.body, { partial: true });
    if (validated.error) {
      return sendError(res, 400, validated.error);
    }

    if (validated.updates.vin) {
      const vinTaken = await findNormalized("vin", validated.updates.vin, vehicle.id);
      if (vinTaken) {
        return sendError(res, 400, "VIN is already in use.");
      }
    }

    if (validated.updates.licensePlate) {
      const plateTaken = await findNormalized("license_plate", validated.updates.licensePlate, vehicle.id);
      if (plateTaken) {
        return sendError(res, 400, "License plate is already in use.");
      }
    }

    if (validated.updates.status === "retired" && vehicle.status !== "retired") {
      if (await hasFutureApprovedTrip(vehicle.id)) {
        return sendError(res, 409, "This vehicle is assigned to a future trip.");
      }
    }

    await vehicle.update(validated.updates);
    const reloaded = await loadVehicle(vehicle.id);
    return res.send(presentVehicle(reloaded));
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      const fields = Object.keys(err.fields || {});
      if (fields.some((field) => field.includes("license"))) {
        return sendError(res, 400, "License plate is already in use.");
      }
      return sendError(res, 400, "VIN is already in use.");
    }
    logger.error(err.message);
    return sendError(res, 500, "Unable to update vehicle.");
  }
};

function readWindow(body) {
  const startsAt = parseInstant(body.startsAt);
  const endsAt = parseInstant(body.endsAt);
  if (!startsAt || !endsAt || endsAt.getTime() <= startsAt.getTime()) {
    return { error: "End must be after start." };
  }

  const reason = requiredText(body.reason);
  if (!reason) {
    return { error: "A reason is required." };
  }
  if (reason.length > 255) {
    return { error: "Reason must be 255 characters or fewer." };
  }

  return { startsAt, endsAt, reason };
}

async function overlappingWindow(vehicleId, startsAt, endsAt, excludeId) {
  const where = {
    vehicleId,
    startsAt: { [Op.lt]: endsAt },
    endsAt: { [Op.gt]: startsAt },
  };
  if (excludeId !== undefined) {
    where.id = { [Op.ne]: excludeId };
  }
  return VehicleUnavailability.findOne({ where });
}

async function scopedVehicle(req, res) {
  const id = parseInteger(req.params.vehicleId);
  if (id.missing || id.invalid) {
    sendError(res, 404, "Vehicle not found.");
    return null;
  }
  const vehicle = await Vehicle.findByPk(id.value);
  if (!vehicle || !(await inScope(req.user, vehicle))) {
    sendError(res, 404, "Vehicle not found.");
    return null;
  }
  return vehicle;
}

controller.createWindow = async (req, res) => {
  try {
    const vehicle = await scopedVehicle(req, res);
    if (!vehicle) {
      return undefined;
    }

    const window = readWindow(req.body);
    if (window.error) {
      return sendError(res, 400, window.error);
    }

    if (await overlappingWindow(vehicle.id, window.startsAt, window.endsAt)) {
      return sendError(res, 400, "This vehicle is already blocked during that time.");
    }

    if (await overlapsApprovedTrip(vehicle.id, window.startsAt, window.endsAt)) {
      return sendError(res, 409, "This vehicle is assigned to a trip during that time.");
    }

    const created = await VehicleUnavailability.create({
      vehicleId: vehicle.id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      reason: window.reason,
      createdBy: req.user.id,
    });

    return res.status(201).send(presentWindow(created));
  } catch (err) {
    logger.error(err.message);
    return sendError(res, 500, "Unable to block vehicle.");
  }
};

controller.updateWindow = async (req, res) => {
  try {
    const vehicle = await scopedVehicle(req, res);
    if (!vehicle) {
      return undefined;
    }

    const windowId = parseInteger(req.params.unavailabilityId);
    const existing = windowId.missing || windowId.invalid
      ? null
      : await VehicleUnavailability.findOne({ where: { id: windowId.value, vehicleId: vehicle.id } });
    if (!existing) {
      return sendError(res, 404, "Unavailability window not found.");
    }

    const window = readWindow(req.body);
    if (window.error) {
      return sendError(res, 400, window.error);
    }

    if (await overlappingWindow(vehicle.id, window.startsAt, window.endsAt, existing.id)) {
      return sendError(res, 400, "This vehicle is already blocked during that time.");
    }

    if (await overlapsApprovedTrip(vehicle.id, window.startsAt, window.endsAt)) {
      return sendError(res, 409, "This vehicle is assigned to a trip during that time.");
    }

    await existing.update({
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      reason: window.reason,
    });

    return res.send(presentWindow(existing));
  } catch (err) {
    logger.error(err.message);
    return sendError(res, 500, "Unable to update block.");
  }
};

controller.removeWindow = async (req, res) => {
  try {
    const vehicle = await scopedVehicle(req, res);
    if (!vehicle) {
      return undefined;
    }

    const windowId = parseInteger(req.params.unavailabilityId);
    const existing = windowId.missing || windowId.invalid
      ? null
      : await VehicleUnavailability.findOne({ where: { id: windowId.value, vehicleId: vehicle.id } });
    if (!existing) {
      return sendError(res, 404, "Unavailability window not found.");
    }

    await existing.destroy();
    return res.send({ message: "Unavailability window removed." });
  } catch (err) {
    logger.error(err.message);
    return sendError(res, 500, "Unable to remove block.");
  }
};

export default controller;
