/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Spec: features/feature-2-areas-area-admins-deploy.md
 */
import db from "../app/models/index.js";
import { getManagedAreaIds } from "../app/authorization/areaScope.js";
import { createArea, createUser, syncTestDatabase } from "./helpers.js";

describe("Feature 2 — Areas, Area Admins & Deployment", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  describe("US-2.5 — Only see data for my areas", () => {
    it("getManagedAreaIds returns every area for an admin", async () => {
      const admin = await createUser({ role: "admin" });
      const athletics = await createArea({ name: "Athletics" });
      const support = await createArea({ name: "Support Central" });
      const maintenance = await createArea({ name: "Maintenance" });

      const ids = await getManagedAreaIds(admin);

      expect(ids.sort((a, b) => a - b)).toEqual([athletics.id, support.id, maintenance.id].sort((a, b) => a - b));
    });

    it("getManagedAreaIds returns only assigned areas for an area admin", async () => {
      const sam = await createUser({ role: "area_admin", firstName: "Sam", lastName: "Cole" });
      const support = await createArea({ name: "Support Central" });
      const maintenance = await createArea({ name: "Maintenance" });
      await createArea({ name: "Athletics" });
      await db.areaAdmin.create({ userId: sam.id, areaId: support.id, assignedAt: new Date() });
      await db.areaAdmin.create({ userId: sam.id, areaId: maintenance.id, assignedAt: new Date() });

      const ids = await getManagedAreaIds(sam);

      expect(ids.sort((a, b) => a - b)).toEqual([support.id, maintenance.id].sort((a, b) => a - b));
    });

    it("getManagedAreaIds returns no areas for a requestor", async () => {
      const requestor = await createUser({ role: "requestor" });
      await createArea({ name: "Athletics" });

      expect(await getManagedAreaIds(requestor)).toEqual([]);
    });
  });
});
