import db from "../models/index.js";

export function parsePositiveInt(value) {
  return typeof value === "string" && /^\d+$/.test(value) ? parseInt(value, 10) : null;
}

export async function getManagedAreaIds(user) {
  if (!user) {
    return [];
  }

  if (user.role === "admin") {
    const areas = await db.area.findAll({ attributes: ["id"] });
    return areas.map((area) => area.id);
  }

  if (user.role === "area_admin") {
    const rows = await db.areaAdmin.findAll({
      where: { userId: user.id },
      attributes: ["areaId"],
    });
    return rows.map((row) => row.areaId);
  }

  return [];
}

export async function requireAreaAccess(req, res, next) {
  const areaId = parsePositiveInt(req.params.areaId);
  if (areaId == null) {
    return res.status(404).send({ message: `Area with id=${req.params.areaId} not found.` });
  }

  if (req.user?.role === "admin") {
    return next();
  }

  const managedIds = await getManagedAreaIds(req.user);
  if (managedIds.includes(areaId)) {
    return next();
  }

  return res.status(403).send({ message: "You do not manage this area." });
}
