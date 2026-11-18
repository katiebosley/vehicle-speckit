/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Feature 3 — Fleet Management
 * Spec: features/feature-2-areas-area-admins-deploy.md
 * Spec: features/feature-3-fleet-management.md
 */
import db from "../app/models/index.js";
import { seed, seedFleet } from "../scripts/seed.mjs";
import { syncTestDatabase } from "./helpers.js";

const Area = db.area;
const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;
const VehicleUnavailability = db.vehicleUnavailability;

describe("Feature 2 — Areas, Area Admins & Deployment", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  describe("US-2.6 — Load sample data with one command", () => {
    it("Seed loads sample users, areas and area admins", async () => {
      await seed();

      const users = await db.user.findAll();
      expect(users.filter((user) => user.role === "admin")).toHaveLength(1);
      expect(users.filter((user) => user.role === "area_admin")).toHaveLength(2);
      const requestors = users.filter((user) => user.role === "requestor");
      expect(requestors).toHaveLength(3);
      const drivers = requestors.filter((user) => user.isApprovedDriver);
      expect(drivers).toHaveLength(1);
      const license = drivers[0].licenseExpiration;
      const licenseYear = license instanceof Date ? license.getFullYear() : Number(String(license).slice(0, 4));
      expect(licenseYear).toBeGreaterThanOrEqual(2099);

      const areas = await db.area.findAll({ order: [["name", "ASC"]] });
      expect(areas.map((area) => area.name)).toEqual(["Athletics", "Maintenance", "Support Central"]);
      expect(areas.every((area) => area.isActive)).toBe(true);

      const areaAdmins = users.filter((user) => user.role === "area_admin").sort((a, b) => a.id - b.id);
      const athletics = areas.find((area) => area.name === "Athletics");
      const support = areas.find((area) => area.name === "Support Central");
      const maintenance = areas.find((area) => area.name === "Maintenance");
      const firstLinks = await db.areaAdmin.findAll({ where: { userId: areaAdmins[0].id } });
      const secondLinks = await db.areaAdmin.findAll({ where: { userId: areaAdmins[1].id } });

      expect(firstLinks.map((row) => row.areaId)).toEqual([athletics.id]);
      expect(secondLinks.map((row) => row.areaId).sort((a, b) => a - b)).toEqual(
        [support.id, maintenance.id].sort((a, b) => a - b)
      );
    });

    it("Running the seed twice creates no duplicates", async () => {
      await seed();
      const before = {
        users: await db.user.count(),
        areas: await db.area.count(),
        areaAdmins: await db.areaAdmin.count(),
      };

      await seed();

      expect(await db.user.count()).toBe(before.users);
      expect(await db.area.count()).toBe(before.areas);
      expect(await db.areaAdmin.count()).toBe(before.areaAdmins);
    });
  });
});

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
