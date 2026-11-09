export default (sequelize, Sequelize) => {
  const Vehicle = sequelize.define(
    "vehicle",
    {
      areaId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      vehicleTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      make: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      vin: {
        type: Sequelize.STRING(17),
        allowNull: false,
        unique: true,
      },
      purchasedDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      licensePlate: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true,
      },
      licensePlateExpireMonth: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      currentMileage: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("available", "maintenance", "retired"),
        allowNull: false,
        defaultValue: "available",
      },
    },
    {
      tableName: "vehicles",
      underscored: true,
    }
  );

  return Vehicle;
};
