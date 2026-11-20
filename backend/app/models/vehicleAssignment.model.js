export default (sequelize, Sequelize) =>
  sequelize.define(
    "vehicleAssignment",
    {
      requestId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      vehicleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      driverId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      assignedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "vehicle_assignments",
      underscored: true,
      timestamps: false,
      indexes: [
        { unique: true, fields: ["request_id", "vehicle_id"] },
        { fields: ["vehicle_id"] },
      ],
    }
  );
