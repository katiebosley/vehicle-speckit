export const ROLES = ["admin", "area_admin", "requestor"];

export default (sequelize, Sequelize) =>
  sequelize.define(
    "user",
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      googleId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        set(value) {
          this.setDataValue("email", value?.trim().toLowerCase());
        },
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false,
        set(value) {
          this.setDataValue("firstName", value?.trim());
        },
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false,
        set(value) {
          this.setDataValue("lastName", value?.trim());
        },
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM(...ROLES),
        allowNull: false,
        defaultValue: "requestor",
      },
      isApprovedDriver: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      licenseExpiration: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["googleId"] },
      },
    }
  );
