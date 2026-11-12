export default (sequelize, Sequelize) => {
  const VehicleUnavailability = sequelize.define(
    "vehicleUnavailability",
    {
      vehicleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      startsAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endsAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "vehicle_unavailability",
      underscored: true,
    }
  );

  return VehicleUnavailability;
};
