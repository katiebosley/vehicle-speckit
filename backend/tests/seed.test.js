/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Spec: features/feature-2-areas-area-admins-deploy.md
 */
import db from "../app/models/index.js";
import { seed } from "../scripts/seed.mjs";
import { syncTestDatabase } from "./helpers.js";

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
