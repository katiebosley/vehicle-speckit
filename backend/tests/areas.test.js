/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Spec: features/feature-2-areas-area-admins-deploy.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { createArea, signInAs, syncTestDatabase } from "./helpers.js";

describe("Feature 2 — Areas, Area Admins & Deployment", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  describe("US-2.1 — Add, edit and deactivate areas", () => {
    it("Admin views all areas", async () => {
      const admin = await signInAs("admin");
      await createArea({ name: "Support Central", isActive: true });
      await createArea({ name: "Athletics", isActive: false });

      const response = await request(app).get("/vehicle-t2/areas").set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((area) => area.name)).toEqual(["Athletics", "Support Central"]);
      expect(response.body[0].isActive).toBe(false);
    });

    it("Admin creates an area", async () => {
      const admin = await signInAs("admin");

      const response = await request(app).post("/vehicle-t2/areas").set(admin.auth).send({
        name: "Athletics",
        description: "Team vans and buses",
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: "Athletics",
        isActive: true,
        admins: [],
      });
      expect(response.body.id).toEqual(expect.any(Number));
    });

    it("Admin creates an area with a duplicate name", async () => {
      const admin = await signInAs("admin");
      await createArea({ name: "Athletics" });

      const response = await request(app).post("/vehicle-t2/areas").set(admin.auth).send({ name: "athletics" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Area name is already taken." });
      const stored = await db.area.findAll();
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe("Athletics");
    });

    it("Admin edits an area", async () => {
      const admin = await signInAs("admin");
      const area = await createArea({ name: "Athletics", description: "Old" });

      const response = await request(app).put(`/vehicle-t2/areas/${area.id}`).set(admin.auth).send({
        name: "Athletics",
        description: "Vans, buses, and golf carts",
      });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe("Vans, buses, and golf carts");
    });

    it("Admin deactivates an area", async () => {
      const admin = await signInAs("admin");
      const requestor = await signInAs("requestor");
      const area = await createArea({ name: "Athletics", isActive: true });

      const response = await request(app).put(`/vehicle-t2/areas/${area.id}`).set(admin.auth).send({
        name: "Athletics",
        isActive: false,
      });
      const requestorList = await request(app).get("/vehicle-t2/areas").set(requestor.auth);

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
      expect(requestorList.body.map((item) => item.name)).not.toContain("Athletics");
    });

    it("Admin reactivates an area", async () => {
      const admin = await signInAs("admin");
      const requestor = await signInAs("requestor");
      const area = await createArea({ name: "Athletics", isActive: false });

      const response = await request(app).put(`/vehicle-t2/areas/${area.id}`).set(admin.auth).send({
        name: "Athletics",
        isActive: true,
      });
      const requestorList = await request(app).get("/vehicle-t2/areas").set(requestor.auth);

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(true);
      expect(requestorList.body.map((item) => item.name)).toContain("Athletics");
    });

    it("Admin edits an area that does not exist", async () => {
      const admin = await signInAs("admin");

      const response = await request(app).put("/vehicle-t2/areas/99999").set(admin.auth).send({ name: "Ghost" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Area with id=99999 not found." });
    });
  });

  describe("US-2.4 — See the areas I manage", () => {
    it("Area admin sees only the areas they manage", async () => {
      const sam = await signInAs("area_admin", { firstName: "Sam", lastName: "Cole" });
      const support = await createArea({ name: "Support Central" });
      const maintenance = await createArea({ name: "Maintenance" });
      await createArea({ name: "Athletics" });
      await db.areaAdmin.create({ userId: sam.user.id, areaId: support.id, assignedAt: new Date() });
      await db.areaAdmin.create({ userId: sam.user.id, areaId: maintenance.id, assignedAt: new Date() });

      const response = await request(app).get("/vehicle-t2/areas/mine").set(sam.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((area) => area.name)).toEqual(["Maintenance", "Support Central"]);
    });
  });

  describe("US-2.5 — Only see data for my areas", () => {
    it("Area admin opens an area they manage", async () => {
      const sam = await signInAs("area_admin", { firstName: "Sam", lastName: "Cole" });
      const maintenance = await createArea({ name: "Maintenance" });
      await db.areaAdmin.create({ userId: sam.user.id, areaId: maintenance.id, assignedAt: new Date() });

      const response = await request(app).get(`/vehicle-t2/areas/${maintenance.id}`).set(sam.auth);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Maintenance");
      expect(response.body.admins.map((admin) => admin.id)).toContain(sam.user.id);
    });

    it("Area admin is refused an area they do not manage", async () => {
      const sam = await signInAs("area_admin");
      const athletics = await createArea({ name: "Athletics" });

      const response = await request(app).get(`/vehicle-t2/areas/${athletics.id}`).set(sam.auth);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not manage this area." });
    });

    it("Requestor cannot create an area via the API", async () => {
      const requestor = await signInAs("requestor");

      const response = await request(app).post("/vehicle-t2/areas").set(requestor.auth).send({
        name: "Athletics",
        description: "Team vans",
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not have permission for this action." });
      expect(await db.area.count()).toBe(0);
    });

    it("Requestor sees only active areas", async () => {
      const requestor = await signInAs("requestor");
      await createArea({ name: "Maintenance", isActive: true });
      await createArea({ name: "Athletics", isActive: false });

      const response = await request(app).get("/vehicle-t2/areas").set(requestor.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((area) => area.name)).toEqual(["Maintenance"]);
    });

    it("Unauthenticated API request to areas", async () => {
      const response = await request(app).get("/vehicle-t2/areas");

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/unauthorized/i);
    });
  });
});
