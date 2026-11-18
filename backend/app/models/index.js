import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import areaModel from "./area.model.js";
import areaAdminModel from "./areaAdmin.model.js";
import vehicleTypeModel from "./vehicleType.model.js";
import vehicleModel from "./vehicle.model.js";
import vehicleUnavailabilityModel from "./vehicleUnavailability.model.js";
import requestModel from "./request.model.js";

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
db.request = requestModel(sequelize, Sequelize);

db.user.hasMany(db.session, { foreignKey: { name: "userId", allowNull: false }, onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: { name: "userId", allowNull: false }, as: "user" });

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

db.user.hasMany(db.request, { foreignKey: "requesterId", as: "requests" });
db.request.belongsTo(db.user, {
  foreignKey: { name: "requesterId", allowNull: false },
  as: "requester",
  onDelete: "RESTRICT",
});
db.request.belongsTo(db.user, {
  foreignKey: { name: "reviewedBy", allowNull: true },
  as: "reviewer",
  onDelete: "SET NULL",
});
db.area.hasMany(db.request, { foreignKey: "areaId" });
db.request.belongsTo(db.area, {
  foreignKey: { name: "areaId", allowNull: false },
  as: "area",
  onDelete: "RESTRICT",
});
db.vehicleType.hasMany(db.request, { foreignKey: "vehicleTypeId" });
db.request.belongsTo(db.vehicleType, {
  foreignKey: { name: "vehicleTypeId", allowNull: false },
  as: "vehicleType",
  onDelete: "RESTRICT",
});

export default db;
