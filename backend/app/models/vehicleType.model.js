export default (sequelize, Sequelize) => {
  const VehicleType = sequelize.define(
    "vehicleType",
    {
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      defaultPassengerCapacity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "vehicle_types",
      underscored: true,
    }
  );

  return VehicleType;
};
