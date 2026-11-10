import { Op } from "sequelize";
import db from "../models/index.js";
import { ROLES } from "../models/user.model.js";
import logger from "../config/logger.js";

const User = db.user;

const exports = {};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateOnly = (value) => {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const parseUserId = (value) => (/^\d+$/.test(value) ? parseInt(value, 10) : null);

const notFound = (res, id) =>
  res.status(404).send({ message: `User with id=${id} not found.` });

exports.findAll = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where = {};

  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = [
      { firstName: { [Op.like]: pattern } },
      { lastName: { [Op.like]: pattern } },
      { email: { [Op.like]: pattern } },
    ];
  }

  try {
    const users = await User.findAll({
      where,
      order: [
        ["lastName", "ASC"],
        ["firstName", "ASC"],
      ],
    });
    return res.send(users);
  } catch (err) {
    logger.error(`users.findAll failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load users." });
  }
};

exports.findOne = async (req, res) => {
  const id = parseUserId(req.params.userId);

  try {
    const user = id === null ? null : await User.findByPk(id);
    if (!user) {
      return notFound(res, req.params.userId);
    }
    return res.send(user);
  } catch (err) {
    logger.error(`users.findOne failed: ${err.message}`);
    return res.status(500).send({ message: "Could not load user." });
  }
};

exports.update = async (req, res) => {
  const id = parseUserId(req.params.userId);
  const { role, isApprovedDriver, licenseExpiration, isActive } = req.body ?? {};

  if (role !== undefined && !ROLES.includes(role)) {
    return res.status(400).send({ message: "Role must be admin, area_admin, or requestor." });
  }

  try {
    const user = id === null ? null : await User.findByPk(id);
    if (!user) {
      return notFound(res, req.params.userId);
    }

    const changesOwnAccess =
      (role !== undefined && role !== user.role) ||
      (isActive !== undefined && isActive !== user.isActive);
    if (user.id === req.user.id && changesOwnAccess) {
      return res
        .status(400)
        .send({ message: "You cannot change your own role or active status." });
    }

    const nextApproved = isApprovedDriver ?? user.isApprovedDriver;
    const nextLicense =
      licenseExpiration !== undefined ? licenseExpiration : user.licenseExpiration;

    if (nextApproved && !isValidDateOnly(nextLicense)) {
      return res
        .status(400)
        .send({ message: "License expiration is required for approved drivers." });
    }

    const changes = {};
    if (role !== undefined) changes.role = role;
    if (isActive !== undefined) changes.isActive = isActive;
    if (isApprovedDriver !== undefined) changes.isApprovedDriver = isApprovedDriver;
    if (licenseExpiration !== undefined) changes.licenseExpiration = licenseExpiration || null;

    await db.sequelize.transaction(async (transaction) => {
      if (user.role === "area_admin" && changes.role && changes.role !== "area_admin") {
        await db.areaAdmin.destroy({ where: { userId: user.id }, transaction });
      }
      await user.update(changes, { transaction });
    });
    return res.send(user);
  } catch (err) {
    logger.error(`users.update failed: ${err.message}`);
    return res.status(500).send({ message: "Could not update user." });
  }
};

export default exports;
