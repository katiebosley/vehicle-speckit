/**
 * Feature 6 — Schedule Calendar, Trip Logs & Dashboard
 * Spec: features/feature-6-schedule-calendar-trip-logs-dashboard.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { createUser, signInAs, syncTestDatabase } from "./helpers.js";

let seq = 0;

async function makeArea(name) {
  return db.area.create({ name, isActive: true });
}

async function makeType() {
  return db.vehicleType.create({ name: `Van-${++seq}`, isActive: true });
}

async function makeVehicle(area, type, overrides = {}) {
  seq += 1;
  return db.vehicle.create({
    areaId: area.id,
    vehicleTypeId: type.id,
    name: overrides.name,
    make: "Ford",
    model: "Transit",
    year: 2022,
    vin: `A${String(seq).padStart(16, "0")}`,
    purchasedDate: "2020-01-01",
    color: "White",
    capacity: overrides.capacity ?? 12,
    licensePlate: overrides.licensePlate,
    licensePlateExpireMonth: 6,
    currentMileage: 100,
    status: overrides.status || "available",
  });
}

describe("Feature 6 — Schedule Calendar, Trip Logs & Dashboard", () => {
  beforeEach(async () => {
    await syncTestDatabase();
    seq = 0;
  });

  describe("US-6.2 — Check vehicle-type availability", () => {
    it("User sees free vehicles for a type and date range", async () => {
      const user = await signInAs("requestor");
      const area = await makeArea("Athletics");
      const type = await makeType();
      const free = await makeVehicle(area, type, { name: "Van 2", licensePlate: "ABC-123", capacity: 12 });
      const busy = await makeVehicle(area, type, { name: "Van 9", licensePlate: "BUS-999", capacity: 8 });
      const shop = await makeVehicle(area, type, {
        name: "Van Shop",
        licensePlate: "SHP-1",
        status: "maintenance",
      });
      const requester = await createUser({ role: "requestor" });
      const departureAt = new Date("2026-12-01T09:00:00.000Z");
      const returnAt = new Date("2026-12-01T15:00:00.000Z");
      const row = await db.request.create({
        requesterId: requester.id,
        areaId: area.id,
        vehicleTypeId: type.id,
        vehiclesNeeded: 1,
        passengerCount: 4,
        purpose: "Game",
        destination: "Campus",
        departureAt,
        returnAt,
        status: "approved",
      });
      await db.vehicleAssignment.create({
        requestId: row.id,
        vehicleId: busy.id,
        driverId: requester.id,
        assignedBy: user.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .get("/vehicle-t2/availability")
        .query({
          vehicleTypeId: type.id,
          departureAt: departureAt.toISOString(),
          returnAt: returnAt.toISOString(),
        })
        .set(user.auth);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: free.id,
          name: "Van 2",
          licensePlate: "ABC-123",
          capacity: 12,
          areaId: area.id,
        },
      ]);
      expect(response.body.map((vehicle) => vehicle.id)).not.toContain(busy.id);
      expect(response.body.map((vehicle) => vehicle.id)).not.toContain(shop.id);
    });

    it("Availability rejects invalid date range", async () => {
      const user = await signInAs("requestor");
      const type = await makeType();

      const before = await request(app)
        .get("/vehicle-t2/availability")
        .query({
          vehicleTypeId: type.id,
          departureAt: "2026-12-02T15:00:00.000Z",
          returnAt: "2026-12-01T09:00:00.000Z",
        })
        .set(user.auth);
      const equal = await request(app)
        .get("/vehicle-t2/availability")
        .query({
          vehicleTypeId: type.id,
          departureAt: "2026-12-01T09:00:00.000Z",
          returnAt: "2026-12-01T09:00:00.000Z",
        })
        .set(user.auth);

      expect(before.status).toBe(400);
      expect(before.body).toEqual({ message: "Return must be after departure." });
      expect(equal.status).toBe(400);
      expect(equal.body).toEqual({ message: "Return must be after departure." });
    });
  });
});
