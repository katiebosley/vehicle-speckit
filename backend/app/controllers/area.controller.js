import { UniqueConstraintError } from "sequelize";
import db from "../models/index.js";
import logger from "../config/logger.js";
import { getManagedAreaIds, parsePositiveInt } from "../authorization/areaScope.js";

const adminInclude = {
  model: db.user,
  as: "admins",
  attributes: ["id", "firstName", "lastName", "email"],
  through: { attributes: [] },
};

function areaNotFound(res, areaId) {
  return res.status(404).send({ message: `Area with id=${areaId} not found.` });
}

function presentArea(area) {
  const json = area.toJSON();
  const admins = (json.admins || [])
    .map((admin) => ({
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id - b.id);

  return {
    id: json.id,
    name: json.name,
    description: json.description ?? null,
    isActive: Boolean(json.isActive),
    admins,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

async function loadArea(areaId) {
  return db.area.findByPk(areaId, { include: [adminInclude] });
}

function validateName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Area name is required." };
  }
  const trimmed = name.trim();
  if (trimmed.length > 100) {
    return { error: "Area name must be 100 characters or fewer." };
  }
  return { value: trimmed };
}

async function nameTaken(name, exceptId) {
  const existing = await db.area.findOne({
    where: db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("name")), name.toLowerCase()),
  });
  return Boolean(existing && existing.id !== exceptId);
}

function optionalDescription(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "description")) {
    return undefined;
  }
  if (typeof body.description !== "string") {
    return null;
  }
  const trimmed = body.description.trim();
  return trimmed === "" ? null : trimmed;
}

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const where = req.user?.role === "admin" ? {} : { isActive: true };
    const areas = await db.area.findAll({
      where,
      include: [adminInclude],
      order: [["name", "ASC"]],
    });
    return res.send(areas.map(presentArea));
  } catch (err) {
    logger.error(`areas.findAll failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load areas." });
  }
};

exports.findMine = async (req, res) => {
  try {
    const ids = await getManagedAreaIds(req.user);
    if (ids.length === 0) {
      return res.send([]);
    }
    const areas = await db.area.findAll({
      where: { id: ids },
      include: [adminInclude],
      order: [["name", "ASC"]],
    });
    return res.send(areas.map(presentArea));
  } catch (err) {
    logger.error(`areas.findMine failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load areas." });
  }
};

exports.findOne = async (req, res) => {
  try {
    const areaId = parsePositiveInt(req.params.areaId);
    if (areaId == null) {
      return areaNotFound(res, req.params.areaId);
    }
    const area = await loadArea(areaId);
    if (!area) {
      return areaNotFound(res, areaId);
    }
    return res.send(presentArea(area));
  } catch (err) {
    logger.error(`areas.findOne failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load the area." });
  }
};

exports.create = async (req, res) => {
  try {
    const nameResult = validateName(req.body?.name);
    if (nameResult.error) {
      return res.status(400).send({ message: nameResult.error });
    }
    if (await nameTaken(nameResult.value)) {
      return res.status(400).send({ message: "Area name is already taken." });
    }

    const description = optionalDescription(req.body);
    const area = await db.area.create({
      name: nameResult.value,
      description: description === undefined ? null : description,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : true,
    });
    const created = await loadArea(area.id);
    return res.status(201).send(presentArea(created));
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return res.status(400).send({ message: "Area name is already taken." });
    }
    logger.error(`areas.create failed: ${err.message}`);
    return res.status(500).send({ message: "Could not create the area." });
  }
};

exports.update = async (req, res) => {
  try {
    const areaId = parsePositiveInt(req.params.areaId);
    if (areaId == null) {
      return areaNotFound(res, req.params.areaId);
    }
    const area = await db.area.findByPk(areaId);
    if (!area) {
      return areaNotFound(res, areaId);
    }

    const nameResult = validateName(req.body?.name);
    if (nameResult.error) {
      return res.status(400).send({ message: nameResult.error });
    }
    if (await nameTaken(nameResult.value, area.id)) {
      return res.status(400).send({ message: "Area name is already taken." });
    }

    area.name = nameResult.value;
    const description = optionalDescription(req.body);
    if (description !== undefined) {
      area.description = description;
    }
    if (typeof req.body?.isActive === "boolean") {
      area.isActive = req.body.isActive;
    }
    await area.save();
    const updated = await loadArea(area.id);
    return res.send(presentArea(updated));
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      return res.status(400).send({ message: "Area name is already taken." });
    }
    logger.error(`areas.update failed: ${err.message}`);
    return res.status(500).send({ message: "Could not update the area." });
  }
};

exports.assignAdmin = async (req, res) => {
  try {
    const areaId = parsePositiveInt(req.params.areaId);
    if (areaId == null) {
      return areaNotFound(res, req.params.areaId);
    }
    const area = await db.area.findByPk(areaId);
    if (!area) {
      return areaNotFound(res, areaId);
    }

    const userId = parsePositiveInt(req.body?.userId == null ? "" : String(req.body.userId));
    if (userId == null) {
      return res.status(404).send({ message: `User with id=${req.body?.userId} not found.` });
    }
    const user = await db.user.findByPk(userId);
    if (!user) {
      return res.status(404).send({ message: `User with id=${userId} not found.` });
    }
    if (user.role !== "area_admin" || !user.isActive) {
      return res.status(400).send({ message: "User must be an active area admin." });
    }

    const existing = await db.areaAdmin.findOne({ where: { userId, areaId } });
    if (existing) {
      return res.status(400).send({ message: "User is already an admin of this area." });
    }

    await db.areaAdmin.create({ userId, areaId, assignedAt: new Date() });
    const updated = await loadArea(areaId);
    return res.status(201).send(presentArea(updated));
  } catch (err) {
    logger.error(`areas.assignAdmin failed: ${err.message}`);
    return res.status(500).send({ message: "Could not assign the area admin." });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
    const areaId = parsePositiveInt(req.params.areaId);
    if (areaId == null) {
      return areaNotFound(res, req.params.areaId);
    }
    const area = await db.area.findByPk(areaId);
    if (!area) {
      return areaNotFound(res, areaId);
    }

    const userId = parsePositiveInt(req.params.userId);
    const assignment = userId == null ? null : await db.areaAdmin.findOne({ where: { userId, areaId } });
    if (!assignment) {
      return res.status(404).send({ message: "User is not an admin of this area." });
    }

    await assignment.destroy();
    const updated = await loadArea(areaId);
    return res.send(presentArea(updated));
  } catch (err) {
    logger.error(`areas.removeAdmin failed: ${err.message}`);
    return res.status(500).send({ message: "Could not remove the area admin." });
  }
};

export default exports;
