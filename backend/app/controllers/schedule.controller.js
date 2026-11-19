import { Op } from "sequelize";
import db from "../models/index.js";
import logger from "../config/logger.js";
import { getManagedAreaIds } from "../authorization/areaScope.js";

const controller = {};

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }
  return number;
}

function vehicleLabel(vehicle) {
  const name = typeof vehicle?.name === "string" ? vehicle.name.trim() : "";
  return name || vehicle?.licensePlate || null;
}

function presentEvent(assignment) {
  const request = assignment.request;
  const vehicle = assignment.vehicle;
  const driver = assignment.driver;
  return {
    assignmentId: assignment.id,
    requestId: assignment.requestId,
    areaId: request?.areaId ?? vehicle?.areaId ?? null,
    vehicleId: assignment.vehicleId,
    vehicleName: vehicleLabel(vehicle),
    licensePlate: vehicle?.licensePlate ?? null,
    driverId: assignment.driverId ?? null,
    driverFirstName: driver?.firstName ?? null,
    driverLastName: driver?.lastName ?? null,
    departureAt: iso(request?.departureAt),
    returnAt: iso(request?.returnAt),
    pickedUpAt: iso(assignment.tripLog?.pickedUpAt),
    returnedAt: iso(assignment.tripLog?.returnedAt),
    startMileage: assignment.tripLog?.startMileage ?? null,
  };
}

function presentTrip(assignment) {
  return {
    assignmentId: assignment.id,
    requestId: assignment.requestId,
    vehicleId: assignment.vehicleId,
    vehicleName: vehicleLabel(assignment.vehicle),
    driverId: assignment.driverId ?? null,
    departureAt: iso(assignment.request?.departureAt),
    returnAt: iso(assignment.request?.returnAt),
    pickedUpAt: iso(assignment.tripLog?.pickedUpAt),
    returnedAt: iso(assignment.tripLog?.returnedAt),
    startMileage: assignment.tripLog?.startMileage ?? null,
  };
}

function presentPending(request, { includeArea = false } = {}) {
  const body = {
    id: request.id,
    purpose: request.purpose,
    departureAt: iso(request.departureAt),
    status: request.status,
  };
  if (includeArea) {
    body.areaId = request.areaId;
  }
  return body;
}

function tripIncludes(requestWhere) {
  return [
    { model: db.request, as: "request", required: true, where: requestWhere },
    { model: db.vehicle, as: "vehicle", required: true },
    { model: db.tripLog, as: "tripLog", required: false },
  ];
}

async function upcomingTrips(userId) {
  const departureAt = { [Op.gte]: new Date() };
  const [asDriver, asRequester] = await Promise.all([
    db.vehicleAssignment.findAll({
      where: { driverId: userId },
      include: tripIncludes({ departureAt }),
    }),
    db.vehicleAssignment.findAll({
      include: tripIncludes({ requesterId: userId, departureAt }),
    }),
  ]);

  const byId = new Map();
  for (const row of [...asDriver, ...asRequester]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.request.departureAt).getTime() - new Date(b.request.departureAt).getTime()
  );
}

controller.calendar = async (req, res) => {
  try {
    const start = parseDate(req.query.start);
    const end = parseDate(req.query.end);
    if (!start || !end) {
      return res.status(400).send({ message: "Start and end are required." });
    }
    if (end.getTime() <= start.getTime()) {
      return res.status(400).send({ message: "End must be after start." });
    }

    const requestWhere = {
      departureAt: { [Op.lt]: end },
      returnAt: { [Op.gt]: start },
    };
    const assignmentWhere = {};

    if (req.user.role === "area_admin") {
      const managed = await getManagedAreaIds(req.user);
      const areaId = parseId(req.query.areaId);
      if (req.query.areaId !== undefined && req.query.areaId !== "") {
        if (!areaId || !managed.includes(areaId)) {
          return res.status(403).send({ message: "You do not manage this area." });
        }
        requestWhere.areaId = areaId;
      } else if (managed.length === 0) {
        return res.send([]);
      } else {
        requestWhere.areaId = { [Op.in]: managed };
      }
    } else if (req.query.areaId !== undefined && req.query.areaId !== "") {
      const areaId = parseId(req.query.areaId);
      if (!areaId) {
        return res.send([]);
      }
      requestWhere.areaId = areaId;
    }

    if (req.query.vehicleId !== undefined && req.query.vehicleId !== "") {
      const vehicleId = parseId(req.query.vehicleId);
      if (!vehicleId) {
        return res.send([]);
      }
      assignmentWhere.vehicleId = vehicleId;
    }

    const rows = await db.vehicleAssignment.findAll({
      where: assignmentWhere,
      include: [
        { model: db.request, as: "request", required: true, where: requestWhere },
        { model: db.vehicle, as: "vehicle", required: true },
        { model: db.user, as: "driver", attributes: ["id", "firstName", "lastName"], required: false },
        { model: db.tripLog, as: "tripLog", required: false },
      ],
      order: [[{ model: db.request, as: "request" }, "departureAt", "ASC"]],
    });

    return res.send(rows.map(presentEvent));
  } catch (err) {
    logger.error(`schedule.calendar failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load the calendar." });
  }
};

controller.availability = async (req, res) => {
  try {
    const vehicleTypeId = parseId(req.query.vehicleTypeId);
    const departureAt = parseDate(req.query.departureAt);
    const returnAt = parseDate(req.query.returnAt);
    if (!vehicleTypeId || !departureAt || !returnAt) {
      return res.status(400).send({ message: "Vehicle type, departure, and return are required." });
    }
    if (returnAt.getTime() <= departureAt.getTime()) {
      return res.status(400).send({ message: "Return must be after departure." });
    }

    const vehicles = await db.vehicle.findAll({
      where: { vehicleTypeId, status: "available" },
      order: [["name", "ASC"], ["id", "ASC"]],
    });
    if (vehicles.length === 0) {
      return res.send([]);
    }

    const busy = await db.vehicleAssignment.findAll({
      where: { vehicleId: { [Op.in]: vehicles.map((vehicle) => vehicle.id) } },
      attributes: ["vehicleId"],
      include: [
        {
          model: db.request,
          as: "request",
          required: true,
          attributes: [],
          where: {
            departureAt: { [Op.lt]: returnAt },
            returnAt: { [Op.gt]: departureAt },
          },
        },
      ],
    });
    const busyIds = new Set(busy.map((row) => row.vehicleId));

    return res.send(
      vehicles
        .filter((vehicle) => !busyIds.has(vehicle.id))
        .map((vehicle) => ({
          id: vehicle.id,
          name: vehicleLabel(vehicle),
          licensePlate: vehicle.licensePlate,
          capacity: vehicle.capacity,
          areaId: vehicle.areaId,
        }))
    );
  } catch (err) {
    logger.error(`schedule.availability failed: ${err.message}`);
    return res.status(500).send({ message: "Could not check availability." });
  }
};

controller.dashboard = async (req, res) => {
  try {
    if (req.user.role === "requestor") {
      const [pending, trips] = await Promise.all([
        db.request.findAll({
          where: { requesterId: req.user.id, status: "pending" },
          order: [["departureAt", "ASC"]],
        }),
        upcomingTrips(req.user.id),
      ]);
      return res.send({
        role: "requestor",
        pendingRequests: pending.map((request) => presentPending(request)),
        upcomingTrips: trips.map(presentTrip),
      });
    }

    if (req.user.role === "area_admin") {
      const managed = await getManagedAreaIds(req.user);
      if (managed.length === 0) {
        return res.send({ role: "area_admin", pendingRequests: [], maintenanceVehicles: [] });
      }
      const [pending, vehicles] = await Promise.all([
        db.request.findAll({
          where: { areaId: { [Op.in]: managed }, status: "pending" },
          order: [["departureAt", "ASC"]],
        }),
        db.vehicle.findAll({
          where: { areaId: { [Op.in]: managed }, status: "maintenance" },
          order: [["name", "ASC"], ["id", "ASC"]],
        }),
      ]);
      return res.send({
        role: "area_admin",
        pendingRequests: pending.map((request) => presentPending(request, { includeArea: true })),
        maintenanceVehicles: vehicles.map((vehicle) => ({
          id: vehicle.id,
          name: vehicleLabel(vehicle),
          areaId: vehicle.areaId,
          status: vehicle.status,
        })),
      });
    }

    const [pending, maintenanceVehicleCount] = await Promise.all([
      db.request.findAll({
        where: { status: "pending" },
        order: [["departureAt", "ASC"]],
      }),
      db.vehicle.count({ where: { status: "maintenance" } }),
    ]);
    return res.send({
      role: "admin",
      pendingRequests: pending.map((request) => presentPending(request, { includeArea: true })),
      pendingRequestCount: pending.length,
      maintenanceVehicleCount,
    });
  } catch (err) {
    logger.error(`schedule.dashboard failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load the dashboard." });
  }
};

export default controller;
