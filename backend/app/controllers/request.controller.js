import db from "../models/index.js";
import logger from "../config/logger.js";
import {
  getOwnedRequestOrNull,
  listOwnedRequests,
  listRequestAssignments,
} from "../authorization/requestScope.js";

const REQUIRED = "All required fields must be provided.";
const RETURN_AFTER = "Return must be after departure.";
const FUTURE = "Departure must be in the future.";
const COUNTS = "Passenger count and vehicles needed must be at least 1.";
const INVALID_REF = "Invalid area or vehicle type.";
const ONLY_PENDING = "Only pending requests can be edited.";
const CANNOT_CANCEL = "This request cannot be cancelled.";
const NOT_FOUND = "Request not found.";

function missing(value) {
  return value === undefined || value === null || value === "";
}

function blankString(value) {
  return typeof value !== "string" || value.trim() === "";
}

function parseInstant(value) {
  if (missing(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function idState(value) {
  if (missing(value)) {
    return "missing";
  }
  if (!Number.isInteger(value)) {
    return "invalid";
  }
  return "ok";
}

function positiveInt(value) {
  return Number.isInteger(value) && value >= 1;
}

function readInput(body) {
  const source = body ?? {};
  const vehiclesOmitted = missing(source.vehiclesNeeded);
  return {
    areaId: source.areaId,
    vehicleTypeId: source.vehicleTypeId,
    purpose: source.purpose,
    destination: source.destination,
    departureAt: parseInstant(source.departureAt),
    returnAt: parseInstant(source.returnAt),
    departureProvided: !missing(source.departureAt),
    returnProvided: !missing(source.returnAt),
    passengerCount: source.passengerCount,
    vehiclesNeeded: vehiclesOmitted ? 1 : source.vehiclesNeeded,
  };
}

function validate(input, now) {
  const area = idState(input.areaId);
  const type = idState(input.vehicleTypeId);
  const passengerMissing = missing(input.passengerCount);

  if (
    area === "missing" ||
    type === "missing" ||
    blankString(input.purpose) ||
    blankString(input.destination) ||
    !input.departureProvided ||
    !input.departureAt ||
    !input.returnProvided ||
    !input.returnAt ||
    passengerMissing
  ) {
    return REQUIRED;
  }

  if (input.returnAt.getTime() <= input.departureAt.getTime()) {
    return RETURN_AFTER;
  }

  if (input.departureAt.getTime() <= now.getTime()) {
    return FUTURE;
  }

  if (!positiveInt(input.passengerCount) || !positiveInt(input.vehiclesNeeded)) {
    return COUNTS;
  }

  if (area === "invalid" || type === "invalid") {
    return INVALID_REF;
  }

  return null;
}

async function refsAreUsable(areaId, vehicleTypeId) {
  const [area, type] = await Promise.all([
    db.area.findByPk(areaId),
    db.vehicleType.findByPk(vehicleTypeId),
  ]);
  return Boolean(area?.isActive && type?.isActive);
}

function iso(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function present(request, { detail = false, assignments = [] } = {}) {
  const payload = {
    id: request.id,
    requesterId: request.requesterId,
    areaId: request.areaId,
    vehicleTypeId: request.vehicleTypeId,
    vehiclesNeeded: request.vehiclesNeeded,
    passengerCount: request.passengerCount,
    purpose: request.purpose,
    destination: request.destination,
    departureAt: iso(request.departureAt),
    returnAt: iso(request.returnAt),
    status: request.status,
    reviewedBy: request.reviewedBy ?? null,
    reviewedAt: iso(request.reviewedAt),
    reviewNotes: request.reviewNotes ?? null,
    createdAt: iso(request.createdAt),
    updatedAt: iso(request.updatedAt),
    areaName: request.area?.name ?? null,
    vehicleTypeName: request.vehicleType?.name ?? null,
  };

  if (detail) {
    payload.assignments = assignments;
    payload.reviewer = request.reviewer
      ? {
          id: request.reviewer.id,
          firstName: request.reviewer.firstName,
          lastName: request.reviewer.lastName,
        }
      : null;
  }

  return payload;
}

function writableFields(input) {
  return {
    areaId: input.areaId,
    vehicleTypeId: input.vehicleTypeId,
    vehiclesNeeded: input.vehiclesNeeded,
    passengerCount: input.passengerCount,
    purpose: input.purpose.trim(),
    destination: input.destination.trim(),
    departureAt: input.departureAt,
    returnAt: input.returnAt,
  };
}

async function reloadOwned(req, id) {
  return getOwnedRequestOrNull(req, id);
}

const controller = {};

controller.create = async (req, res) => {
  try {
    const input = readInput(req.body);
    const message = validate(input, new Date());
    if (message) {
      return res.status(400).send({ message });
    }
    if (!(await refsAreUsable(input.areaId, input.vehicleTypeId))) {
      return res.status(400).send({ message: INVALID_REF });
    }

    const created = await db.request.create({
      ...writableFields(input),
      requesterId: req.user.id,
      status: "pending",
    });
    const row = await reloadOwned(req, created.id);
    return res.status(201).send(present(row));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to create the request." });
  }
};

controller.findMine = async (req, res) => {
  try {
    const rows = await listOwnedRequests(req.user.id);
    return res.send(rows.map((row) => present(row)));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to list requests." });
  }
};

controller.findOne = async (req, res) => {
  try {
    const row = await getOwnedRequestOrNull(req, req.params.id);
    if (!row) {
      return res.status(404).send({ message: NOT_FOUND });
    }
    const assignments = await listRequestAssignments(row.id);
    return res.send(present(row, { detail: true, assignments }));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to load the request." });
  }
};

controller.update = async (req, res) => {
  try {
    const row = await getOwnedRequestOrNull(req, req.params.id);
    if (!row) {
      return res.status(404).send({ message: NOT_FOUND });
    }
    if (row.status !== "pending") {
      return res.status(400).send({ message: ONLY_PENDING });
    }

    const input = readInput(req.body);
    const message = validate(input, new Date());
    if (message) {
      return res.status(400).send({ message });
    }
    if (!(await refsAreUsable(input.areaId, input.vehicleTypeId))) {
      return res.status(400).send({ message: INVALID_REF });
    }

    await row.update(writableFields(input));
    const updated = await reloadOwned(req, row.id);
    return res.send(present(updated));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to update the request." });
  }
};

function canCancel(row, now) {
  if (row.status === "pending") {
    return true;
  }
  if (row.status === "approved" && new Date(row.departureAt).getTime() > now.getTime()) {
    return true;
  }
  return false;
}

controller.cancel = async (req, res) => {
  try {
    const row = await getOwnedRequestOrNull(req, req.params.id);
    if (!row) {
      return res.status(404).send({ message: NOT_FOUND });
    }
    if (!canCancel(row, new Date())) {
      return res.status(400).send({ message: CANNOT_CANCEL });
    }

    await row.update({ status: "cancelled" });
    const updated = await reloadOwned(req, row.id);
    return res.send(present(updated));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to cancel the request." });
  }
};

export default controller;
