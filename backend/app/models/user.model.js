export default (sequelize, Sequelize) => {
  const User = sequelize.define(
    "user",
    {
      googleId: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM("admin", "area_admin", "requestor"),
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
      tableName: "users",
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["googleId"] },
      },
    }
  );

  return User;
};
