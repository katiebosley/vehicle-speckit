import db from "../models/index.js";

const Area = db.area;
const AreaAdmin = db.areaAdmin;

export async function getManagedAreaIds(user) {
  if (!user) {
    return [];
  }

  if (user.role === "admin") {
    const areas = await Area.findAll({ attributes: ["id"] });
    return areas.map((area) => area.id);
  }

  if (user.role === "area_admin") {
    const rows = await AreaAdmin.findAll({
      where: { userId: user.id },
      attributes: ["areaId"],
    });
    return rows.map((row) => row.areaId);
  }

  return [];
}
