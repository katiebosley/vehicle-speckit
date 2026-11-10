import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import areaModel from "./area.model.js";
import areaAdminModel from "./areaAdmin.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = userModel(sequelize, Sequelize);
db.session = sessionModel(sequelize, Sequelize);
db.area = areaModel(sequelize, Sequelize);
db.areaAdmin = areaAdminModel(sequelize, Sequelize);

db.user.hasMany(db.session, { foreignKey: { name: "userId", allowNull: false }, onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: { name: "userId", allowNull: false }, as: "user" });

db.user.belongsToMany(db.area, {
  through: db.areaAdmin,
  foreignKey: "userId",
  otherKey: "areaId",
  as: "managedAreas",
  onDelete: "CASCADE",
});
db.area.belongsToMany(db.user, {
  through: db.areaAdmin,
  foreignKey: "areaId",
  otherKey: "userId",
  as: "admins",
  onDelete: "CASCADE",
});

export default db;
