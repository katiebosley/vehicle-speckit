export default (sequelize, Sequelize) =>
  sequelize.define(
    "destination",
    {
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    { tableName: "destinations", underscored: true }
  );
