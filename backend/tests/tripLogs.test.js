/**
 * Feature 6 — Schedule Calendar, Trip Logs & Dashboard
 * Spec: features/feature-6-schedule-calendar-trip-logs-dashboard.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { createSession, createUser, signInAs, syncTestDatabase } from "./helpers.js";

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
    name: overrides.name || `Van ${seq}`,
    make: "Ford",
    model: "Transit",
    year: 2022,
    vin: `T${String(seq).padStart(16, "0")}`,
    purchasedDate: "2020-01-01",
    color: "White",
    capacity: 12,
    licensePlate: `TRP-${seq}`,
    licensePlateExpireMonth: 6,
    currentMileage: overrides.currentMileage ?? 100,
    status: "available",
  });
}

async function makeAssignment({ area, type, vehicle, driver, requester }) {
  const row = await db.request.create({
    requesterId: requester.id,
    areaId: area.id,
    vehicleTypeId: type.id,
    vehiclesNeeded: 1,
    passengerCount: 4,
    purpose: "Trip",
    destination: "Campus",
    departureAt: new Date("2026-12-01T09:00:00.000Z"),
    returnAt: new Date("2026-12-01T15:00:00.000Z"),
    status: "approved",
  });
  return db.vehicleAssignment.create({
    requestId: row.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    assignedBy: requester.id,
    assignedAt: new Date(),
  });
}

describe("Feature 6 — Schedule Calendar, Trip Logs & Dashboard", () => {
  beforeEach(async () => {
    await syncTestDatabase();
    seq = 0;
  });

  describe("US-6.5 — Check out and check in a vehicle", () => {
    it("Driver checks out then checks in", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const vehicle = await makeVehicle(area, type);
      const driver = await createUser({ role: "requestor", firstName: "Alex", lastName: "Nguyen" });
      const token = await createSession(driver);
      const requester = await createUser({ role: "requestor" });
      const assignment = await makeAssignment({ area, type, vehicle, driver, requester });
      const auth = { Authorization: `Bearer ${token}` };

      const checkout = await request(app)
        .post(`/vehicle-t2/assignments/${assignment.id}/checkout`)
        .set(auth)
        .send({ startMileage: 50000 });
      const checkin = await request(app)
        .post(`/vehicle-t2/assignments/${assignment.id}/checkin`)
        .set(auth)
        .send({ endMileage: 50120, fuelAddedGallons: 8.5, issuesReported: "Scratched bumper" });

      expect(checkout.status).toBe(200);
      expect(checkout.body.startMileage).toBe(50000);
      expect(checkout.body.pickedUpAt).toEqual(expect.any(String));
      expect(checkout.body.returnedAt).toBeNull();
      expect(checkin.status).toBe(200);
      expect(checkin.body).toEqual(
        expect.objectContaining({
          assignmentId: assignment.id,
          startMileage: 50000,
          endMileage: 50120,
          fuelAddedGallons: 8.5,
          issuesReported: "Scratched bumper",
        })
      );
      expect(checkin.body.pickedUpAt).toEqual(expect.any(String));
      expect(checkin.body.returnedAt).toEqual(expect.any(String));
      const stored = await db.tripLog.findOne({ where: { assignmentId: assignment.id } });
      expect(stored.startMileage).toBe(50000);
      expect(stored.endMileage).toBe(50120);
      expect(Number(stored.fuelAddedGallons)).toBe(8.5);
      expect(stored.issuesReported).toBe("Scratched bumper");
      expect(stored.pickedUpAt).toBeTruthy();
      expect(stored.returnedAt).toBeTruthy();
    });

    it("Driver cannot check out another driver’s assignment", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const vehicle = await makeVehicle(area, type);
      const driver = await createUser({ role: "requestor" });
      const other = await signInAs("requestor");
      const requester = await createUser({ role: "requestor" });
      const assignment = await makeAssignment({ area, type, vehicle, driver, requester });

      const response = await request(app)
        .post(`/vehicle-t2/assignments/${assignment.id}/checkout`)
        .set(other.auth)
        .send({ startMileage: 50000 });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not have permission for this action." });
      expect(await db.tripLog.count()).toBe(0);
    });
  });

  describe("US-6.6 — Mileage updates on check-in", () => {
    it("Check-in updates vehicle current mileage", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const vehicle = await makeVehicle(area, type, { currentMileage: 48000 });
      const driver = await createUser({ role: "requestor" });
      const token = await createSession(driver);
      const requester = await createUser({ role: "requestor" });
      const assignment = await makeAssignment({ area, type, vehicle, driver, requester });
      const auth = { Authorization: `Bearer ${token}` };

      await request(app)
        .post(`/vehicle-t2/assignments/${assignment.id}/checkout`)
        .set(auth)
        .send({ startMileage: 50000 });
      const checkin = await request(app)
        .post(`/vehicle-t2/assignments/${assignment.id}/checkin`)
        .set(auth)
        .send({ endMileage: 50120, fuelAddedGallons: null, issuesReported: null });

      expect(checkin.status).toBe(200);
      const fresh = await db.vehicle.findByPk(vehicle.id);
      expect(fresh.currentMileage).toBe(50120);
    });
  });

  describe("US-6.7 — Vehicle trip history", () => {
    it("Admin views trip history and issues", async () => {
      const admin = await signInAs("admin");
      const area = await makeArea("Athletics");
      const type = await makeType();
      const vehicle = await makeVehicle(area, type);
      const driver = await createUser({ role: "requestor", firstName: "Alex", lastName: "Nguyen" });
      const requester = await createUser({ role: "requestor" });
      const older = await makeAssignment({ area, type, vehicle, driver, requester });
      const newer = await makeAssignment({ area, type, vehicle, driver, requester });
      await db.tripLog.create({
        assignmentId: older.id,
        startMileage: 100,
        endMileage: 150,
        pickedUpAt: new Date("2026-11-01T09:00:00.000Z"),
        returnedAt: new Date("2026-11-01T15:00:00.000Z"),
        issuesReported: "Worn tire",
      });
      await db.tripLog.create({
        assignmentId: newer.id,
        startMileage: 150,
        endMileage: 200,
        pickedUpAt: new Date("2026-11-10T09:00:00.000Z"),
        returnedAt: new Date("2026-11-10T15:00:00.000Z"),
        issuesReported: "Scratched bumper",
      });

      const response = await request(app).get(`/vehicle-t2/vehicles/${vehicle.id}/trip-logs`).set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((log) => log.issuesReported)).toEqual(["Scratched bumper", "Worn tire"]);
      expect(response.body[0]).toEqual(
        expect.objectContaining({
          assignmentId: newer.id,
          driverFirstName: "Alex",
          driverLastName: "Nguyen",
          startMileage: 150,
          endMileage: 200,
        })
      );
    });

    it("Area admin cannot view another area’s vehicle history", async () => {
      const athletics = await makeArea("Athletics");
      const maintenance = await makeArea("Maintenance");
      const type = await makeType();
      const vehicle = await makeVehicle(maintenance, type, { name: "Shop Van" });
      const areaAdmin = await signInAs("area_admin");
      await db.areaAdmin.create({ userId: areaAdmin.user.id, areaId: athletics.id });

      const response = await request(app).get(`/vehicle-t2/vehicles/${vehicle.id}/trip-logs`).set(areaAdmin.auth);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Vehicle not found." });
    });
  });
});