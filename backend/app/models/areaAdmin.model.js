export default (sequelize, Sequelize) => {
  const AreaAdmin = sequelize.define(
    "areaAdmin",
    {
      userId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      areaId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: "area_admins",
      underscored: true,
      timestamps: false,
    }
  );

  return AreaAdmin;
};
