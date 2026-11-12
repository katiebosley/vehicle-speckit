import { Op } from "sequelize";
import db from "../models/index.js";
import logger from "../config/logger.js";
import { getManagedAreaIds } from "../authorization/areaScope.js";

const Area = db.area;

function present(area) {
  return {
    id: area.id,
    name: area.name,
    description: area.description,
    isActive: area.isActive,
  };
}

const controller = {};

controller.findAll = async (req, res) => {
  try {
    const where = req.user.role === "admin" ? {} : { isActive: true };
    const areas = await Area.findAll({ where, order: [["name", "ASC"]] });
    return res.send(areas.map(present));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to list areas." });
  }
};

controller.findMine = async (req, res) => {
  try {
    const ids = await getManagedAreaIds(req.user);
    if (ids.length === 0) {
      return res.send([]);
    }
    const areas = await Area.findAll({
      where: { id: { [Op.in]: ids } },
      order: [["name", "ASC"]],
    });
    return res.send(areas.map(present));
  } catch (err) {
    logger.error(err.message);
    return res.status(500).send({ message: "Unable to list areas." });
  }
};

export default controller;
