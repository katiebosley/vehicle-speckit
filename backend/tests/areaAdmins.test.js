/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Spec: features/feature-2-areas-area-admins-deploy.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { createArea, createUser, signInAs, syncTestDatabase } from "./helpers.js";

describe("Feature 2 — Areas, Area Admins & Deployment", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  describe("US-2.2 — Assign and remove area admins", () => {
    it("Admin assigns an area admin to an area", async () => {
      const admin = await signInAs("admin");
      const alex = await createUser({ role: "area_admin", firstName: "Alex", lastName: "Reed" });
      const athletics = await createArea({ name: "Athletics" });

      const response = await request(app)
        .post(`/vehicle-t2/areas/${athletics.id}/admins`)
        .set(admin.auth)
        .send({ userId: alex.id });

      expect(response.status).toBe(201);
      expect(response.body.admins.map((person) => person.id)).toEqual([alex.id]);
      expect(await db.areaAdmin.count({ where: { userId: alex.id, areaId: athletics.id } })).toBe(1);
    });

    it("Admin assigns a second area admin to the same area", async () => {
      const admin = await signInAs("admin");
      const alex = await createUser({ role: "area_admin", firstName: "Alex", lastName: "Reed" });
      const sam = await createUser({ role: "area_admin", firstName: "Sam", lastName: "Cole" });
      const athletics = await createArea({ name: "Athletics" });
      await db.areaAdmin.create({ userId: alex.id, areaId: athletics.id, assignedAt: new Date() });

      const response = await request(app)
        .post(`/vehicle-t2/areas/${athletics.id}/admins`)
        .set(admin.auth)
        .send({ userId: sam.id });

      expect(response.status).toBe(201);
      expect(response.body.admins.map((person) => person.lastName).sort()).toEqual(["Cole", "Reed"]);
    });

    it("Admin assigns a user who is not an area admin", async () => {
      const admin = await signInAs("admin");
      const bob = await createUser({ role: "requestor", firstName: "Bob", lastName: "Jones" });
      const athletics = await createArea({ name: "Athletics" });

      const response = await request(app)
        .post(`/vehicle-t2/areas/${athletics.id}/admins`)
        .set(admin.auth)
        .send({ userId: bob.id });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "User must be an active area admin." });
      expect(await db.areaAdmin.count()).toBe(0);
    });

    it("Admin assigns a user who is already an admin of the area", async () => {
      const admin = await signInAs("admin");
      const alex = await createUser({ role: "area_admin", firstName: "Alex", lastName: "Reed" });
      const athletics = await createArea({ name: "Athletics" });
      await db.areaAdmin.create({ userId: alex.id, areaId: athletics.id, assignedAt: new Date() });

      const response = await request(app)
        .post(`/vehicle-t2/areas/${athletics.id}/admins`)
        .set(admin.auth)
        .send({ userId: alex.id });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "User is already an admin of this area." });
    });

    it("Admin removes an area admin from an area", async () => {
      const admin = await signInAs("admin");
      const alex = await createUser({ role: "area_admin", firstName: "Alex", lastName: "Reed" });
      const sam = await createUser({ role: "area_admin", firstName: "Sam", lastName: "Cole" });
      const athletics = await createArea({ name: "Athletics" });
      await db.areaAdmin.create({ userId: alex.id, areaId: athletics.id, assignedAt: new Date() });
      await db.areaAdmin.create({ userId: sam.id, areaId: athletics.id, assignedAt: new Date() });

      const response = await request(app)
        .delete(`/vehicle-t2/areas/${athletics.id}/admins/${alex.id}`)
        .set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.admins.map((person) => person.id)).toEqual([sam.id]);
    });

    it("Admin removes a user who is not an admin of the area", async () => {
      const admin = await signInAs("admin");
      const alex = await createUser({ role: "area_admin", firstName: "Alex", lastName: "Reed" });
      const athletics = await createArea({ name: "Athletics" });

      const response = await request(app)
        .delete(`/vehicle-t2/areas/${athletics.id}/admins/${alex.id}`)
        .set(admin.auth);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "User is not an admin of this area." });
    });

    it("Changing a user's role away from area admin removes their area assignments", async () => {
      const admin = await signInAs("admin");
      const alex = await createUser({ role: "area_admin", firstName: "Alex", lastName: "Reed" });
      const athletics = await createArea({ name: "Athletics" });
      const maintenance = await createArea({ name: "Maintenance" });
      await db.areaAdmin.create({ userId: alex.id, areaId: athletics.id, assignedAt: new Date() });
      await db.areaAdmin.create({ userId: alex.id, areaId: maintenance.id, assignedAt: new Date() });

      const response = await request(app)
        .put(`/vehicle-t2/users/${alex.id}`)
        .set(admin.auth)
        .send({ role: "requestor" });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe("requestor");
      expect(await db.areaAdmin.count({ where: { userId: alex.id } })).toBe(0);
    });
  });
});
