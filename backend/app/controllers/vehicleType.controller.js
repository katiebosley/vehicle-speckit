import { Op } from "sequelize";
import db from "../models/index.js";
import logger from "../config/logger.js";

const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;

function sendError(res, status, message) {
  return res.status(status).send({ message });
}

function parseTypeId(value) {
  if (!/^\d+$/.test(String(value))) {
    return null;
  }
  return Number(value);
}

function parseCapacity(value) {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 30) {
    return { error: "Default passenger capacity must be from 1 to 30." };
  }

  return { value: number };
}

async function findNameConflict(name, excludeId) {
  const where = [
    db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("name")), name.toLowerCase()),
  ];

  if (excludeId !== undefined) {
    where.push({ id: { [Op.ne]: excludeId } });
  }

  return VehicleType.findOne({ where: { [Op.and]: where } });
}

const controller = {};

controller.findAll = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? {} : { isActive: true };
    const types = await VehicleType.findAll({
      where,
      order: [["name", "ASC"]],
    });
    return res.send(types);
  } catch (err) {
    logger.error(err.message);
    return sendError(res, 500, "Unable to list vehicle types.");
  }
};

controller.create = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return sendError(res, 400, "Vehicle type name is required.");
    }
    if (name.length > 50) {
      return sendError(res, 400, "Vehicle type name must be 50 characters or fewer.");
    }

    const capacity = parseCapacity(req.body.defaultPassengerCapacity);
    if (capacity.error) {
      return sendError(res, 400, capacity.error);
    }

    const conflict = await findNameConflict(name);
    if (conflict) {
      return sendError(res, 400, "Vehicle type name is already taken.");
    }

    const description =
      typeof req.body.description === "string" && req.body.description.trim()
        ? req.body.description.trim()
        : null;

    const created = await VehicleType.create({
      name,
      description,
      defaultPassengerCapacity: capacity.value,
      isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
    });

    return res.status(201).send(created);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return sendError(res, 400, "Vehicle type name is already taken.");
    }
    logger.error(err.message);
    return sendError(res, 500, "Unable to create vehicle type.");
  }
};

controller.update = async (req, res) => {
  try {
    const id = parseTypeId(req.params.vehicleTypeId);
    if (id === null) {
      return sendError(res, 404, `Vehicle type with id=${req.params.vehicleTypeId} not found.`);
    }

    const type = await VehicleType.findByPk(id);
    if (!type) {
      return sendError(res, 404, `Vehicle type with id=${id} not found.`);
    }

    const updates = {};

    if (req.body.name !== undefined) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) {
        return sendError(res, 400, "Vehicle type name is required.");
      }
      if (name.length > 50) {
        return sendError(res, 400, "Vehicle type name must be 50 characters or fewer.");
      }
      const conflict = await findNameConflict(name, id);
      if (conflict) {
        return sendError(res, 400, "Vehicle type name is already taken.");
      }
      updates.name = name;
    }

    if (req.body.description !== undefined) {
      updates.description =
        typeof req.body.description === "string" && req.body.description.trim()
          ? req.body.description.trim()
          : null;
    }

    if (req.body.defaultPassengerCapacity !== undefined) {
      const capacity = parseCapacity(req.body.defaultPassengerCapacity);
      if (capacity.error) {
        return sendError(res, 400, capacity.error);
      }
      updates.defaultPassengerCapacity = capacity.value;
    }

    if (req.body.isActive !== undefined) {
      const isActive = Boolean(req.body.isActive);
      if (!isActive) {
        const inUse = await Vehicle.count({
          where: {
            vehicleTypeId: id,
            status: { [Op.ne]: "retired" },
          },
        });
        if (inUse > 0) {
          return sendError(res, 400, "This vehicle type is still used by a vehicle that is not retired.");
        }
      }
      updates.isActive = isActive;
    }

    await type.update(updates);
    return res.send(type);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return sendError(res, 400, "Vehicle type name is already taken.");
    }
    logger.error(err.message);
    return sendError(res, 500, "Unable to update vehicle type.");
  }
};

export default controller;
