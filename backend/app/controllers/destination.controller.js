import db from "../models/index.js";
import logger from "../config/logger.js";

function asId(value) {
  return typeof value === "string" && /^\d+$/.test(value) ? parseInt(value, 10) : null;
}

function present(destination) {
  return {
    id: destination.id,
    name: destination.name,
    is_active: destination.isActive,
    created_at: destination.createdAt,
    updated_at: destination.updatedAt,
  };
}

async function nameTaken(name, exceptId) {
  const existing = await db.destination.findOne({
    where: db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("name")), name.toLowerCase()),
  });
  return Boolean(existing && existing.id !== exceptId);
}

const controller = {};

controller.list = async (req, res) => {
  try {
    const rows = await db.destination.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    });
    return res.send(rows.map(present));
  } catch (err) {
    logger.error(`destinations.list failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load destinations." });
  }
};

controller.create = async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return res.status(400).send({ message: "Destination name is required." });
    }
    if (name.length > 255) {
      return res.status(400).send({ message: "Destination name must be 255 characters or fewer." });
    }
    if (await nameTaken(name)) {
      return res.status(400).send({ message: `A destination named ${name} already exists.` });
    }
    const created = await db.destination.create({
      name,
      isActive: typeof req.body?.is_active === "boolean" ? req.body.is_active : true,
    });
    return res.status(201).send(present(created));
  } catch (err) {
    logger.error(`destinations.create failed: ${err.message}`);
    return res.status(500).send({ message: "Could not create the destination." });
  }
};

controller.update = async (req, res) => {
  try {
    const id = asId(req.params.destinationId);
    const destination = id == null ? null : await db.destination.findByPk(id);
    if (!destination) {
      return res.status(404).send({ message: `Destination with id=${req.params.destinationId} not found.` });
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
      const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
      if (!name) {
        return res.status(400).send({ message: "Destination name is required." });
      }
      if (name.length > 255) {
        return res.status(400).send({ message: "Destination name must be 255 characters or fewer." });
      }
      if (await nameTaken(name, destination.id)) {
        return res.status(400).send({ message: `A destination named ${name} already exists.` });
      }
      destination.name = name;
    }
    if (typeof req.body?.is_active === "boolean") {
      destination.isActive = req.body.is_active;
    }
    await destination.save();
    return res.send(present(destination));
  } catch (err) {
    logger.error(`destinations.update failed: ${err.message}`);
    return res.status(500).send({ message: "Could not update the destination." });
  }
};

export default controller;
