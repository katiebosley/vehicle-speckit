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
    vin: `D${String(seq).padStart(16, "0")}`,
    purchasedDate: "2020-01-01",
    color: "White",
    capacity: 12,
    licensePlate: `DSH-${seq}`,
    licensePlateExpireMonth: 6,
    currentMileage: 100,
    status: overrides.status || "available",
    ...overrides,
    areaId: area.id,
    vehicleTypeId: type.id,
  });
}

async function makeRequest(area, type, requester, overrides = {}) {
  return db.request.create({
    requesterId: requester.id,
    areaId: area.id,
    vehicleTypeId: type.id,
    vehiclesNeeded: 1,
    passengerCount: 4,
    purpose: overrides.purpose || "Field trip",
    destination: "Campus",
    departureAt: overrides.departureAt || new Date("2026-12-01T09:00:00.000Z"),
    returnAt: overrides.returnAt || new Date("2026-12-01T15:00:00.000Z"),
    status: overrides.status || "pending",
  });
}

describe("Feature 6 — Schedule Calendar, Trip Logs & Dashboard", () => {
  beforeEach(async () => {
    await syncTestDatabase();
    seq = 0;
  });

  describe("US-6.3 — Requestor home dashboard", () => {
    it("Requestor home shows pending requests and upcoming trips", async () => {
      const requestor = await createUser({ role: "requestor", firstName: "Riley" });
      const token = await createSession(requestor);
      const other = await createUser({ role: "requestor" });
      const area = await makeArea("Athletics");
      const otherArea = await makeArea("Maintenance");
      const type = await makeType();
      const vehicle = await makeVehicle(area, type, { name: "Van 2" });
      const pending = await makeRequest(area, type, requestor, { purpose: "Field trip", status: "pending" });
      await makeRequest(otherArea, type, other, { purpose: "Someone else", status: "pending" });
      const departureAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const returnAt = new Date(departureAt.getTime() + 4 * 60 * 60 * 1000);
      const approved = await makeRequest(area, type, requestor, {
        purpose: "Away game",
        status: "approved",
        departureAt,
        returnAt,
      });
      const past = await makeRequest(area, type, requestor, {
        purpose: "Yesterday",
        status: "approved",
        departureAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        returnAt: new Date(Date.now() - 60 * 60 * 1000),
      });
      const upcoming = await db.vehicleAssignment.create({
        requestId: approved.id,
        vehicleId: vehicle.id,
        driverId: requestor.id,
        assignedBy: requestor.id,
        assignedAt: new Date(),
      });
      await db.vehicleAssignment.create({
        requestId: past.id,
        vehicleId: vehicle.id,
        driverId: requestor.id,
        assignedBy: requestor.id,
        assignedAt: new Date(),
      });

      const response = await request(app).get("/vehicle-t2/dashboard").set({ Authorization: `Bearer ${token}` });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe("requestor");
      expect(response.body.pendingRequests).toEqual([
        expect.objectContaining({ id: pending.id, purpose: "Field trip", status: "pending" }),
      ]);
      expect(response.body.upcomingTrips.map((trip) => trip.assignmentId)).toEqual([upcoming.id]);
      expect(response.body.upcomingTrips[0].vehicleName).toBe("Van 2");
    });
  });

  describe("US-6.4 — Area admin home dashboard", () => {
    it("Area admin home shows scoped pending requests and maintenance vehicles", async () => {
      const athletics = await makeArea("Athletics");
      const maintenance = await makeArea("Maintenance");
      const type = await makeType();
      const athleticsBus = await makeVehicle(athletics, type, { name: "Bus 1", status: "maintenance" });
      await makeVehicle(maintenance, type, { name: "Shop Truck", status: "maintenance" });
      const requester = await createUser({ role: "requestor" });
      const athleticsRequest = await makeRequest(athletics, type, requester, { purpose: "Practice", status: "pending" });
      await makeRequest(maintenance, type, requester, { purpose: "Other area", status: "pending" });
      const areaAdmin = await signInAs("area_admin");
      await db.areaAdmin.create({ userId: areaAdmin.user.id, areaId: athletics.id });

      const response = await request(app).get("/vehicle-t2/dashboard").set(areaAdmin.auth);

      expect(response.status).toBe(200);
      expect(response.body.role).toBe("area_admin");
      expect(response.body.pendingRequests.map((row) => row.id)).toEqual([athleticsRequest.id]);
      expect(response.body.pendingRequests.every((row) => row.areaId === athletics.id)).toBe(true);
      expect(response.body.maintenanceVehicles).toEqual([
        { id: athleticsBus.id, name: "Bus 1", areaId: athletics.id, status: "maintenance" },
      ]);
    });
  });
});
