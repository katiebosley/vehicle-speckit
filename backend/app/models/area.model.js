export default (sequelize, Sequelize) => {
  const Area = sequelize.define(
    "area",
    {
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "areas",
      underscored: true,
    }
  );

  return Area;
};
