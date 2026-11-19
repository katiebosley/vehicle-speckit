/**
 * Feature 5 — Vehicle Management
 * Spec: features/feature-5-vehicle-management.md
 */
import db from "../app/models/index.js";
import { checkVehicleAvailability } from "../services/vehicleAvailability.js";
import { seedFleet } from "../scripts/seed.mjs";
import { createUser, syncTestDatabase } from "./helpers.js";

const START = new Date("2026-11-20T14:00:00.000Z");
const END = new Date("2026-11-20T22:00:00.000Z");

async function seedAreas() {
  for (const name of ["Athletics", "Support Central", "Maintenance"]) {
    await db.area.create({ name, isActive: true });
  }
}

async function makeRequest(area, type, requester, status, start, end) {
  return db.request.create({
    requesterId: requester.id,
    areaId: area.id,
    vehicleTypeId: type.id,
    vehiclesNeeded: 1,
    passengerCount: 2,
    purpose: "Trip",
    destination: "Campus",
    departureAt: start,
    returnAt: end,
    status,
  });
}

describe("Feature 5 — Vehicle Management", () => {
  beforeEach(async () => {
    await syncTestDatabase();
    await seedAreas();
    await seedFleet();
  });

  describe("US-5.5 — See only available vehicles", () => {
    it("Vehicles on non-approved requests remain available", async () => {
      const athletics = await db.area.findOne({ where: { name: "Athletics" } });
      const type = await db.vehicleType.findOne({ where: { name: "Car" } });
      const van = await db.vehicle.findOne({ where: { vin: "ATHCAR000001" } });
      const requester = await createUser({ role: "requestor" });

      for (const status of ["completed", "denied", "cancelled"]) {
        const request = await makeRequest(athletics, type, requester, status, START, END);
        await db.vehicleAssignment.create({
          requestId: request.id,
          vehicleId: van.id,
          assignedBy: requester.id,
          assignedAt: new Date(),
        });

        const result = await checkVehicleAvailability(van.id, START, END);
        expect(result).toEqual({ available: true, reason: null });
        await db.vehicleAssignment.destroy({ where: { requestId: request.id } });
        await request.destroy();
      }
    });

    it("Touching trip windows do not conflict", async () => {
      const athletics = await db.area.findOne({ where: { name: "Athletics" } });
      const type = await db.vehicleType.findOne({ where: { name: "Car" } });
      const van = await db.vehicle.findOne({ where: { vin: "ATHCAR000001" } });
      const requester = await createUser({ role: "requestor" });
      const earlierEnd = new Date("2026-11-20T14:00:00.000Z");
      const earlierStart = new Date("2026-11-20T08:00:00.000Z");
      const request = await makeRequest(athletics, type, requester, "approved", earlierStart, earlierEnd);
      await db.vehicleAssignment.create({
        requestId: request.id,
        vehicleId: van.id,
        assignedBy: requester.id,
        assignedAt: new Date(),
      });

      const result = await checkVehicleAvailability(van.id, START, END);
      expect(result).toEqual({ available: true, reason: null });
    });

    it("Availability service reports each reason", async () => {
      const athletics = await db.area.findOne({ where: { name: "Athletics" } });
      const type = await db.vehicleType.findOne({ where: { name: "Car" } });
      const availableCar = await db.vehicle.findOne({ where: { vin: "ATHCAR000001" } });
      const maintenance = await db.vehicle.findOne({ where: { status: "maintenance" } });
      const admin = await createUser({ role: "admin" });
      const retired = await db.vehicle.create({
        areaId: athletics.id,
        vehicleTypeId: type.id,
        make: "Ford",
        model: "Retired",
        year: 2010,
        vin: "RETIRED000000001",
        purchasedDate: "2010-01-01",
        color: "Gray",
        capacity: 4,
        licensePlate: "RET-001",
        licensePlateExpireMonth: 1,
        currentMileage: 1,
        status: "retired",
      });
      await db.vehicleUnavailability.create({
        vehicleId: availableCar.id,
        startsAt: new Date("2026-11-20T08:00:00.000Z"),
        endsAt: new Date("2026-11-20T16:00:00.000Z"),
        reason: "Service",
        createdBy: admin.id,
      });
      const bookedVehicle = await db.vehicle.create({
        areaId: athletics.id,
        vehicleTypeId: type.id,
        name: "Booked",
        make: "Ford",
        model: "Booked",
        year: 2022,
        vin: "BOOKED0000000001",
        purchasedDate: "2020-01-01",
        color: "Blue",
        capacity: 5,
        licensePlate: "BOK-001",
        licensePlateExpireMonth: 6,
        currentMileage: 10,
        status: "available",
      });
      const request = await makeRequest(athletics, type, admin, "approved", START, END);
      await db.vehicleAssignment.create({
        requestId: request.id,
        vehicleId: bookedVehicle.id,
        assignedBy: admin.id,
        assignedAt: new Date(),
      });

      await expect(checkVehicleAvailability(999999, START, END)).resolves.toEqual({
        available: false,
        reason: "not_found",
      });
      await expect(checkVehicleAvailability(maintenance.id, START, END)).resolves.toEqual({
        available: false,
        reason: "maintenance",
      });
      await expect(checkVehicleAvailability(retired.id, START, END)).resolves.toEqual({
        available: false,
        reason: "retired",
      });
      await expect(checkVehicleAvailability(availableCar.id, START, END)).resolves.toEqual({
        available: false,
        reason: "blocked",
      });
      await expect(checkVehicleAvailability(bookedVehicle.id, START, END)).resolves.toEqual({
        available: false,
        reason: "booked",
      });
    });
  });
});
