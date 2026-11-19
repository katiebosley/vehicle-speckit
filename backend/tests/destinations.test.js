/**
 * Feature 5 — Vehicle Management
 * Spec: features/feature-5-vehicle-management.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { createUser, signInAs, syncTestDatabase } from "./helpers.js";

describe("Feature 5 — Vehicle Management", () => {
  beforeEach(async () => {
    await syncTestDatabase();
  });

  describe("US-5.12 — Manage destinations", () => {
    it("Area admin creates a destination", async () => {
      const admin = await signInAs("area_admin");

      const response = await request(app)
        .post("/vehicle-t2/api/destinations")
        .set(admin.auth)
        .send({ name: "Tulsa – Union High School" });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Tulsa – Union High School");
      expect(response.body.is_active).toBe(true);
    });

    it("Area admin creates a duplicate destination", async () => {
      const admin = await signInAs("area_admin");
      await db.destination.create({ name: "Tulsa – Union High School", isActive: true });

      const response = await request(app)
        .post("/vehicle-t2/api/destinations")
        .set(admin.auth)
        .send({ name: "tulsa – union high school" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "A destination named tulsa – union high school already exists.",
      });
    });

    it("Deactivated destinations are hidden from requestors", async () => {
      const admin = await signInAs("admin");
      const requestor = await signInAs("requestor");
      const destination = await db.destination.create({ name: "Old Gym", isActive: true });
      const area = await db.area.create({ name: "Athletics", isActive: true });
      const type = await db.vehicleType.create({ name: "Van", isActive: true });
      const requester = await createUser();
      await db.request.create({
        requesterId: requester.id,
        areaId: area.id,
        vehicleTypeId: type.id,
        passengerCount: 2,
        purpose: "Practice",
        destination: "Old Gym",
        destinationId: destination.id,
        departureAt: new Date("2026-12-01T14:00:00.000Z"),
        returnAt: new Date("2026-12-01T18:00:00.000Z"),
        status: "pending",
      });

      const updated = await request(app)
        .put(`/vehicle-t2/api/destinations/${destination.id}`)
        .set(admin.auth)
        .send({ is_active: false });
      const listed = await request(app).get("/vehicle-t2/api/destinations").set(requestor.auth);
      const review = await request(app).get("/vehicle-t2/api/review/requests").set(admin.auth);

      expect(updated.status).toBe(200);
      expect(listed.body.map((row) => row.name)).not.toContain("Old Gym");
      expect(review.body[0].destination_name).toBe("Old Gym");
    });

    it("Requestor cannot create a destination", async () => {
      const requestor = await signInAs("requestor");

      const response = await request(app)
        .post("/vehicle-t2/api/destinations")
        .set(requestor.auth)
        .send({ name: "Library" });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Area admin role required." });
    });
  });
});
