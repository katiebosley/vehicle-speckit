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

async function makeType(name = "Van") {
  return db.vehicleType.create({ name: `${name}-${++seq}`, isActive: true });
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
    vin: `C${String(seq).padStart(16, "0")}`,
    purchasedDate: "2020-01-01",
    color: "White",
    capacity: 12,
    licensePlate: `CAL-${seq}`,
    licensePlateExpireMonth: 6,
    currentMileage: 100,
    status: "available",
    ...overrides,
    areaId: overrides.areaId ?? area.id,
    vehicleTypeId: overrides.vehicleTypeId ?? type.id,
  });
}

async function makeRequest(area, type, requester, overrides = {}) {
  return db.request.create({
    requesterId: requester.id,
    areaId: area.id,
    vehicleTypeId: type.id,
    vehiclesNeeded: 1,
    passengerCount: 4,
    purpose: "Field trip",
    destination: "Campus",
    departureAt: overrides.departureAt,
    returnAt: overrides.returnAt,
    status: overrides.status || "approved",
  });
}

async function makeAssignment(row, vehicle, driver) {
  return db.vehicleAssignment.create({
    requestId: row.id,
    vehicleId: vehicle.id,
    driverId: driver.id,
    assignedBy: driver.id,
    assignedAt: new Date(),
  });
}

describe("Feature 6 — Schedule Calendar, Trip Logs & Dashboard", () => {
  beforeEach(async () => {
    await syncTestDatabase();
    seq = 0;
  });

  describe("US-6.1 — Assignment calendar", () => {
    it("Admin views weekly assignments on the calendar", async () => {
      const admin = await signInAs("admin");
      const area = await makeArea("Athletics");
      const type = await makeType();
      const vehicle = await makeVehicle(area, type, { name: "Van 2", licensePlate: "ABC-123" });
      const driver = await createUser({ role: "requestor", firstName: "Alex", lastName: "Nguyen" });
      const requester = await createUser({ role: "requestor" });
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      const departureAt = new Date(start.getTime() + 60 * 60 * 1000);
      const returnAt = new Date(departureAt.getTime() + 2 * 60 * 60 * 1000);
      const row = await makeRequest(area, type, requester, { departureAt, returnAt });
      const assignment = await makeAssignment(row, vehicle, driver);

      const response = await request(app)
        .get("/vehicle-t2/calendar")
        .query({ start: start.toISOString(), end: end.toISOString(), view: "week" })
        .set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({
          assignmentId: assignment.id,
          requestId: row.id,
          areaId: area.id,
          vehicleId: vehicle.id,
          vehicleName: "Van 2",
          licensePlate: "ABC-123",
          driverId: driver.id,
          driverFirstName: "Alex",
          driverLastName: "Nguyen",
        }),
      ]);
    });

    it("Area admin calendar is limited to managed areas", async () => {
      const athletics = await makeArea("Athletics");
      const maintenance = await makeArea("Maintenance");
      const type = await makeType();
      const athleticsVan = await makeVehicle(athletics, type, { name: "Athletics Van" });
      const maintenanceVan = await makeVehicle(maintenance, type, { name: "Maintenance Van" });
      const driver = await createUser({ role: "requestor" });
      const requester = await createUser({ role: "requestor" });
      const start = new Date("2026-12-01T00:00:00.000Z");
      const end = new Date("2026-12-08T00:00:00.000Z");
      const departureAt = new Date("2026-12-01T09:00:00.000Z");
      const returnAt = new Date("2026-12-01T15:00:00.000Z");
      const athleticsRequest = await makeRequest(athletics, type, requester, { departureAt, returnAt });
      const maintenanceRequest = await makeRequest(maintenance, type, requester, { departureAt, returnAt });
      const athleticsAssignment = await makeAssignment(athleticsRequest, athleticsVan, driver);
      await makeAssignment(maintenanceRequest, maintenanceVan, driver);
      const areaAdmin = await signInAs("area_admin");
      await db.areaAdmin.create({ userId: areaAdmin.user.id, areaId: athletics.id });

      const response = await request(app)
        .get("/vehicle-t2/calendar")
        .query({ start: start.toISOString(), end: end.toISOString(), view: "week" })
        .set(areaAdmin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((event) => event.assignmentId)).toEqual([athleticsAssignment.id]);
      expect(response.body.every((event) => event.areaId === athletics.id)).toBe(true);
    });
  });
});
