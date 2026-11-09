import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import vehicleTypeModel from "./vehicleType.model.js";
import vehicleModel from "./vehicle.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = userModel(sequelize, Sequelize);
db.session = sessionModel(sequelize, Sequelize);
db.vehicleType = vehicleTypeModel(sequelize, Sequelize);
db.vehicle = vehicleModel(sequelize, Sequelize);

db.session.belongsTo(db.user, { foreignKey: "userId", as: "user" });
db.user.hasMany(db.session, { foreignKey: "userId" });

db.vehicleType.hasMany(db.vehicle, { foreignKey: "vehicleTypeId" });
db.vehicle.belongsTo(db.vehicleType, { foreignKey: "vehicleTypeId" });

export default db;
