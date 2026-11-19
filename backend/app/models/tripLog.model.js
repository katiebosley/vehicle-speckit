export default (sequelize, Sequelize) =>
  sequelize.define(
    "tripLog",
    {
      assignmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      startMileage: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      endMileage: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      fuelAddedGallons: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      pickedUpAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      returnedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      issuesReported: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "trip_logs",
      underscored: true,
    }
  );
