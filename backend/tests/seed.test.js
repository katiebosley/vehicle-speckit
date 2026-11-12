import db from "../app/models/index.js";
import { seedFleet } from "../scripts/seed.mjs";

const Area = db.area;
const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;
const VehicleUnavailability = db.vehicleUnavailability;

describe("Feature 3 — Fleet Management", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
    for (const name of ["Athletics", "Support Central", "Maintenance"]) {
      const existing = await Area.findOne({ where: { name } });
      if (!existing) {
        await Area.create({ name, isActive: true });
      }
    }
  });

  beforeEach(async () => {
    await VehicleUnavailability.destroy({ where: {} });
    await Vehicle.destroy({ where: {} });
    await VehicleType.destroy({ where: {} });
  });

  describe("US-3.7 — Load sample fleet data with the existing seed", () => {
    it("Seed loads vehicle types and vehicles", async () => {
      await seedFleet();

      const types = await VehicleType.findAll();
      const names = types.map((type) => type.name).sort();
      expect(names).toEqual(["Car", "Golf Cart", "Truck", "Van"]);
      expect(types.every((type) => type.isActive)).toBe(true);

      for (const areaName of ["Athletics", "Support Central", "Maintenance"]) {
        const area = await Area.findOne({ where: { name: areaName } });
        const count = await Vehicle.count({ where: { areaId: area.id } });
        expect(count).toBeGreaterThan(0);
      }

      const maintenance = await Area.findOne({ where: { name: "Maintenance" } });
      const blocked = await Vehicle.findOne({ where: { areaId: maintenance.id, status: "maintenance" } });
      expect(blocked).not.toBeNull();
    });

    it("Running the seed twice creates no duplicates", async () => {
      await seedFleet();
      const typeCount = await VehicleType.count();
      const vehicleCount = await Vehicle.count();

      await seedFleet();

      expect(await VehicleType.count()).toBe(typeCount);
      expect(await Vehicle.count()).toBe(vehicleCount);

      for (const name of ["Car", "Truck", "Van", "Golf Cart"]) {
        expect(await VehicleType.count({ where: { name } })).toBe(1);
      }
      for (const vin of ["ATHCAR000001", "SUPTRK000001", "MNTVAN000001", "MNTGLF000001"]) {
        expect(await Vehicle.count({ where: { vin } })).toBe(1);
      }
    });
  });
});
