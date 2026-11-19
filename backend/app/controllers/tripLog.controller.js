import db from "../models/index.js";
import logger from "../config/logger.js";
import { getManagedAreaIds } from "../authorization/areaScope.js";

const controller = {};

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function parseId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function integerField(value) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function presentLog(log, extra = {}) {
  return {
    id: log.id,
    assignmentId: log.assignmentId,
    startMileage: log.startMileage,
    endMileage: log.endMileage ?? null,
    fuelAddedGallons: log.fuelAddedGallons == null ? null : Number(log.fuelAddedGallons),
    pickedUpAt: iso(log.pickedUpAt),
    returnedAt: iso(log.returnedAt),
    issuesReported: log.issuesReported ?? null,
    createdAt: iso(log.createdAt),
    updatedAt: iso(log.updatedAt),
    ...extra,
  };
}

async function loadAssignment(assignmentId) {
  return db.vehicleAssignment.findByPk(assignmentId, {
    include: [
      { model: db.request, as: "request" },
      { model: db.vehicle, as: "vehicle" },
      { model: db.tripLog, as: "tripLog" },
    ],
  });
}

async function authorizeActor(req, assignment) {
  if (!assignment) {
    return { status: 404, message: "Assignment not found." };
  }
  if (req.user.role === "admin" || assignment.driverId === req.user.id) {
    return null;
  }
  if (req.user.role === "area_admin") {
    const managed = await getManagedAreaIds(req.user);
    const areaId = assignment.request?.areaId ?? assignment.vehicle?.areaId;
    if (!managed.includes(areaId)) {
      return { status: 404, message: "Assignment not found." };
    }
  }
  return { status: 403, message: "You do not have permission for this action." };
}

controller.checkout = async (req, res) => {
  try {
    const assignmentId = parseId(req.params.assignmentId);
    const assignment = assignmentId ? await loadAssignment(assignmentId) : null;
    const denied = await authorizeActor(req, assignment);
    if (denied) {
      return res.status(denied.status).send({ message: denied.message });
    }

    const startMileage = integerField(req.body?.startMileage);
    if (startMileage == null) {
      return res.status(400).send({ message: "Start mileage is required." });
    }

    const existing = assignment.tripLog;
    if (existing?.pickedUpAt) {
      return res.status(400).send({ message: "This trip is already checked out." });
    }

    const log = existing
      ? await existing.update({ startMileage, pickedUpAt: new Date(), endMileage: null, returnedAt: null })
      : await db.tripLog.create({
          assignmentId: assignment.id,
          startMileage,
          pickedUpAt: new Date(),
        });

    return res.send(presentLog(log));
  } catch (err) {
    logger.error(`tripLog.checkout failed: ${err.message}`);
    return res.status(500).send({ message: "Could not check out the vehicle." });
  }
};

controller.checkin = async (req, res) => {
  try {
    const assignmentId = parseId(req.params.assignmentId);
    const assignment = assignmentId ? await loadAssignment(assignmentId) : null;
    const denied = await authorizeActor(req, assignment);
    if (denied) {
      return res.status(denied.status).send({ message: denied.message });
    }

    const log = assignment.tripLog;
    if (!log?.pickedUpAt || log.returnedAt) {
      return res.status(400).send({ message: "Check out before checking in." });
    }

    const endMileage = integerField(req.body?.endMileage);
    if (endMileage == null) {
      return res.status(400).send({ message: "End mileage is required." });
    }
    if (endMileage < log.startMileage) {
      return res.status(400).send({ message: "End mileage must be greater than or equal to start mileage." });
    }

    let fuel = req.body?.fuelAddedGallons;
    if (fuel === undefined || fuel === "") {
      fuel = null;
    }
    if (fuel != null && (typeof fuel !== "number" || Number.isNaN(fuel))) {
      return res.status(400).send({ message: "Fuel added must be a number." });
    }

    let issues = req.body?.issuesReported;
    if (issues === undefined || issues === null || issues === "") {
      issues = null;
    } else if (typeof issues !== "string") {
      return res.status(400).send({ message: "Issues must be text." });
    }

    await db.sequelize.transaction(async (transaction) => {
      await log.update(
        {
          endMileage,
          fuelAddedGallons: fuel,
          issuesReported: issues,
          returnedAt: new Date(),
        },
        { transaction }
      );
      await assignment.vehicle.update({ currentMileage: endMileage }, { transaction });
    });

    const fresh = await db.tripLog.findByPk(log.id);
    return res.send(presentLog(fresh));
  } catch (err) {
    logger.error(`tripLog.checkin failed: ${err.message}`);
    return res.status(500).send({ message: "Could not check in the vehicle." });
  }
};

controller.history = async (req, res) => {
  try {
    const vehicleId = parseId(req.params.vehicleId);
    const vehicle = vehicleId ? await db.vehicle.findByPk(vehicleId) : null;
    if (!vehicle) {
      return res.status(404).send({ message: "Vehicle not found." });
    }
    if (req.user.role === "area_admin") {
      const managed = await getManagedAreaIds(req.user);
      if (!managed.includes(vehicle.areaId)) {
        return res.status(404).send({ message: "Vehicle not found." });
      }
    }

    const logs = await db.tripLog.findAll({
      include: [
        {
          model: db.vehicleAssignment,
          as: "assignment",
          required: true,
          where: { vehicleId: vehicle.id },
          include: [{ model: db.user, as: "driver", attributes: ["id", "firstName", "lastName"], required: false }],
        },
      ],
      order: [
        ["pickedUpAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    return res.send(
      logs.map((log) =>
        presentLog(log, {
          vehicleId: vehicle.id,
          driverId: log.assignment?.driverId ?? null,
          driverFirstName: log.assignment?.driver?.firstName ?? null,
          driverLastName: log.assignment?.driver?.lastName ?? null,
        })
      )
    );
  } catch (err) {
    logger.error(`tripLog.history failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load trip history." });
  }
};

export default controller;
