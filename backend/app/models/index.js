import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import areaModel from "./area.model.js";
import areaAdminModel from "./areaAdmin.model.js";
import vehicleTypeModel from "./vehicleType.model.js";
import vehicleModel from "./vehicle.model.js";
import vehicleUnavailabilityModel from "./vehicleUnavailability.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = userModel(sequelize, Sequelize);
db.session = sessionModel(sequelize, Sequelize);
db.area = areaModel(sequelize, Sequelize);
db.areaAdmin = areaAdminModel(sequelize, Sequelize);
db.vehicleType = vehicleTypeModel(sequelize, Sequelize);
db.vehicle = vehicleModel(sequelize, Sequelize);
db.vehicleUnavailability = vehicleUnavailabilityModel(sequelize, Sequelize);

db.session.belongsTo(db.user, { foreignKey: "userId", as: "user" });
db.user.hasMany(db.session, { foreignKey: "userId" });

db.user.belongsToMany(db.area, {
  through: db.areaAdmin,
  foreignKey: "userId",
  otherKey: "areaId",
  as: "managedAreas",
});
db.area.belongsToMany(db.user, {
  through: db.areaAdmin,
  foreignKey: "areaId",
  otherKey: "userId",
  as: "admins",
});

db.area.hasMany(db.vehicle, { foreignKey: "areaId" });
db.vehicle.belongsTo(db.area, { foreignKey: "areaId", as: "area" });

db.vehicleType.hasMany(db.vehicle, { foreignKey: "vehicleTypeId" });
db.vehicle.belongsTo(db.vehicleType, { foreignKey: "vehicleTypeId", as: "vehicleType" });

db.vehicle.hasMany(db.vehicleUnavailability, { foreignKey: "vehicleId", as: "unavailability" });
db.vehicleUnavailability.belongsTo(db.vehicle, { foreignKey: "vehicleId" });
db.vehicleUnavailability.belongsTo(db.user, { foreignKey: "createdBy" });

export default db;
