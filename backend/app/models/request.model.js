export const REQUEST_STATUSES = ["pending", "approved", "denied", "cancelled", "completed"];

export default (sequelize, Sequelize) => {
  const Request = sequelize.define(
    "request",
    {
      requesterId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      areaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      vehicleTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      vehiclesNeeded: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      passengerCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      purpose: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      destination: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      destinationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      departureAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      returnAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(...REQUEST_STATUSES),
        allowNull: false,
        defaultValue: "pending",
      },
      reviewedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reviewNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "requests",
      underscored: true,
    }
  );

  return Request;
};
