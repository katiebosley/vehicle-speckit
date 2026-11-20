/**
 * Feature 5 — Vehicle Management
 * Spec: features/feature-5-vehicle-management.md
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
    name: `Van ${seq}`,
    make: "Ford",
    model: "Transit",
    year: 2022,
    vin: `V${String(seq).padStart(16, "0")}`,
    purchasedDate: "2020-01-01",
    color: "White",
    capacity: 15,
    licensePlate: `PLT-${seq}`,
    licensePlateExpireMonth: 6,
    currentMileage: 100,
    status: "available",
    ...overrides,
    areaId: overrides.areaId ?? area.id,
    vehicleTypeId: overrides.vehicleTypeId ?? type.id,
  });
}

async function makeRequest(area, type, overrides = {}) {
  const requester = overrides.requester || (await createUser({ role: "requestor" }));
  return db.request.create({
    requesterId: requester.id,
    areaId: area.id,
    vehicleTypeId: type.id,
    vehiclesNeeded: 1,
    passengerCount: 12,
    purpose: "Away game",
    destination: "Campus",
    departureAt: overrides.departureAt || new Date("2026-11-20T14:00:00.000Z"),
    returnAt: overrides.returnAt || new Date("2026-11-20T22:00:00.000Z"),
    status: overrides.status || "pending",
    ...overrides,
    requesterId: requester.id,
    areaId: overrides.areaId ?? area.id,
    vehicleTypeId: type.id,
  });
}

async function areaAdminFor(area) {
  const signed = await signInAs("area_admin");
  await db.areaAdmin.create({ userId: signed.user.id, areaId: area.id });
  return signed;
}

const futureStart = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
const futureEnd = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const pastStart = () => new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const pastEnd = () => new Date(Date.now() - 60 * 60 * 1000);

describe("Feature 5 — Vehicle Management", () => {
  beforeEach(async () => {
    await syncTestDatabase();
    seq = 0;
  });

  describe("US-5.2 — View pending requests", () => {
    it("Area admin sees pending requests for their areas", async () => {
      const athletics = await makeArea("Athletics");
      const music = await makeArea("Music");
      const type = await makeType();
      const admin = await areaAdminFor(athletics);
      await makeRequest(athletics, type, { departureAt: new Date("2026-12-02T14:00:00.000Z"), returnAt: new Date("2026-12-02T22:00:00.000Z") });
      await makeRequest(athletics, type, { departureAt: new Date("2026-11-20T14:00:00.000Z"), returnAt: new Date("2026-11-20T22:00:00.000Z") });
      await makeRequest(music, type);

      const response = await request(app).get("/vehicle-t2/api/review/requests").set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.area_name)).toEqual(["Athletics", "Athletics"]);
      expect(response.body.map((row) => row.departure_at)).toEqual([
        "2026-11-20T14:00:00.000Z",
        "2026-12-02T14:00:00.000Z",
      ]);
    });

    it("Admin sees pending requests for every area", async () => {
      const athletics = await makeArea("Athletics");
      const music = await makeArea("Music");
      const type = await makeType();
      const admin = await signInAs("admin");
      await makeRequest(athletics, type);
      await makeRequest(music, type);

      const response = await request(app).get("/vehicle-t2/api/review/requests").set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.area_name).sort()).toEqual(["Athletics", "Music"]);
    });
  });

  describe("US-5.3 — Approve a request and assign vehicles", () => {
    it("Area admin approves a request with one vehicle", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van = await makeVehicle(area, type, { name: "Van 12", capacity: 15 });
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { passengerCount: 12 });

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: van.id, driver_id: null }] });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("approved");
      expect(response.body.reviewed_by).toBe(admin.user.id);
      expect(response.body.reviewed_at).toEqual(expect.any(String));
      expect(response.body.assignments).toHaveLength(1);
      expect(response.body.assignments[0].vehicle_name).toBe("Van 12");
    });

    it("Area admin approves a request with multiple vehicles", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12", capacity: 15 });
      const van7 = await makeVehicle(area, type, { name: "Van 7", capacity: 15 });
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { passengerCount: 25, vehiclesNeeded: 2 });

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: van12.id }, { vehicle_id: van7.id }] });

      expect(response.status).toBe(200);
      expect(response.body.assignments).toHaveLength(2);
      expect(response.body.assigned_capacity).toBe(30);
    });

    it("Area admin approves a request that is no longer pending", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved" });

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: 1 }] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Only pending requests can be reviewed." });
    });

    it("Approve saves nothing when one vehicle conflicts", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const van7 = await makeVehicle(area, type, { name: "Van 7" });
      const admin = await areaAdminFor(area);
      const other = await makeRequest(area, type, { status: "approved" });
      await db.vehicleAssignment.create({
        requestId: other.id,
        vehicleId: van7.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });
      const trip = await makeRequest(area, type);

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: van12.id }, { vehicle_id: van7.id }] });

      expect(response.status).toBe(409);
      expect((await db.request.findByPk(trip.id)).status).toBe("pending");
      expect(await db.vehicleAssignment.count({ where: { requestId: trip.id } })).toBe(0);
    });
  });

  describe("US-5.4 — Deny a request", () => {
    it("Area admin denies a request with a note", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type);

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/deny`)
        .set(admin.auth)
        .send({ review_notes: "No vans that weekend." });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("denied");
      expect(response.body.review_notes).toBe("No vans that weekend.");
    });

    it("Area admin denies without a note via the API", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type);

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/deny`)
        .set(admin.auth)
        .send({ review_notes: "   " });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "A note is required to deny a request." });
      expect((await db.request.findByPk(trip.id)).status).toBe("pending");
    });
  });

  describe("US-5.5 — See only available vehicles", () => {
    it("Available vehicles exclude other areas and unavailable vehicles", async () => {
      const athletics = await makeArea("Athletics");
      const music = await makeArea("Music");
      const type = await makeType();
      const start = new Date("2026-11-20T14:00:00.000Z");
      const end = new Date("2026-11-20T22:00:00.000Z");
      const van1 = await makeVehicle(athletics, type, { name: "Van 1" });
      await makeVehicle(athletics, type, { name: "Van 2", status: "retired" });
      await makeVehicle(athletics, type, { name: "Van 3", status: "maintenance" });
      const van4 = await makeVehicle(athletics, type, { name: "Van 4" });
      const van5 = await makeVehicle(athletics, type, { name: "Van 5" });
      await makeVehicle(music, type, { name: "Van 6" });
      const admin = await areaAdminFor(athletics);
      await db.vehicleUnavailability.create({
        vehicleId: van4.id,
        startsAt: new Date("2026-11-20T08:00:00.000Z"),
        endsAt: new Date("2026-11-20T16:00:00.000Z"),
        reason: "Blocked",
        createdBy: admin.user.id,
      });
      const booked = await makeRequest(athletics, type, {
        status: "approved",
        departureAt: new Date("2026-11-20T20:00:00.000Z"),
        returnAt: new Date("2026-11-20T23:00:00.000Z"),
      });
      await db.vehicleAssignment.create({
        requestId: booked.id,
        vehicleId: van5.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });
      const trip = await makeRequest(athletics, type, { departureAt: start, returnAt: end });

      const response = await request(app)
        .get(`/vehicle-t2/api/review/requests/${trip.id}/available-vehicles`)
        .set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((vehicle) => vehicle.name)).toEqual(["Van 1"]);
      expect(response.body[0].id).toBe(van1.id);
    });

    it("Area admin assigns a vehicle from another area", async () => {
      const athletics = await makeArea("Athletics");
      const music = await makeArea("Music");
      const type = await makeType();
      const musicVan = await makeVehicle(music, type, { name: "Music Van" });
      const admin = await areaAdminFor(athletics);
      const trip = await makeRequest(athletics, type);

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: musicVan.id }] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: `Vehicle with id=${musicVan.id} does not belong to this request's area.`,
      });
    });
  });

  describe("US-5.7 — Assign a driver to each vehicle", () => {
    it("Eligible drivers exclude inactive, unapproved, and expired drivers", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { returnAt: new Date("2026-11-20T22:00:00.000Z") });
      await createUser({ firstName: "Sam", lastName: "Ortiz", isActive: true, isApprovedDriver: true, licenseExpiration: "2027-05-01" });
      await createUser({ firstName: "Ana", lastName: "Cole", isActive: true, isApprovedDriver: true, licenseExpiration: "2026-11-10" });
      await createUser({ firstName: "Lee", lastName: "Ng", isActive: true, isApprovedDriver: false, licenseExpiration: "2027-05-01" });
      await createUser({ firstName: "Kim", lastName: "Patel", isActive: false, isApprovedDriver: true, licenseExpiration: "2027-05-01" });

      const response = await request(app)
        .get(`/vehicle-t2/api/review/requests/${trip.id}/eligible-drivers`)
        .set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.map((driver) => driver.name)).toEqual(["Sam Ortiz"]);
    });

    it("Area admin assigns an ineligible driver", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van = await makeVehicle(area, type);
      const admin = await areaAdminFor(area);
      const ana = await createUser({ firstName: "Ana", isApprovedDriver: true, isActive: true, licenseExpiration: "2026-11-10" });
      const trip = await makeRequest(area, type, { returnAt: new Date("2026-11-20T22:00:00.000Z") });

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: van.id, driver_id: ana.id }] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: `Driver with id=${ana.id} is not an approved driver with a current license.`,
      });
      expect(await db.vehicleAssignment.count({ where: { requestId: trip.id } })).toBe(0);
    });

    it("Area admin assigns the same driver twice", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type);
      const van7 = await makeVehicle(area, type);
      const admin = await areaAdminFor(area);
      const sam = await createUser({ isApprovedDriver: true, isActive: true, licenseExpiration: "2027-05-01" });
      const trip = await makeRequest(area, type);

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({
          assignments: [
            { vehicle_id: van12.id, driver_id: sam.id },
            { vehicle_id: van7.id, driver_id: sam.id },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "A driver can only be assigned to one vehicle per request." });
    });
  });

  describe("US-5.8 — Change or remove an assignment", () => {
    it("Area admin changes a vehicle before the trip starts", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const van7 = await makeVehicle(area, type, { name: "Van 7" });
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: futureStart(), returnAt: futureEnd() });
      const assignment = await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: van12.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .put(`/vehicle-t2/api/review/requests/${trip.id}/assignments/${assignment.id}`)
        .set(admin.auth)
        .send({ vehicle_id: van7.id });

      expect(response.status).toBe(200);
      expect(response.body.assignments.map((row) => row.vehicle_name)).toEqual(["Van 7"]);
    });

    it("Keeping the same vehicle is not a conflict", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const admin = await areaAdminFor(area);
      const driver = await createUser({ isApprovedDriver: true, isActive: true, licenseExpiration: "2099-01-01" });
      const trip = await makeRequest(area, type, { status: "approved", departureAt: futureStart(), returnAt: futureEnd() });
      const assignment = await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: van12.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .put(`/vehicle-t2/api/review/requests/${trip.id}/assignments/${assignment.id}`)
        .set(admin.auth)
        .send({ vehicle_id: van12.id, driver_id: driver.id });

      expect(response.status).toBe(200);
      expect(response.body.assignments[0].vehicle_id).toBe(van12.id);
      expect(response.body.assignments[0].driver_id).toBe(driver.id);
    });

    it("Area admin removes one of several assignments", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const van7 = await makeVehicle(area, type, { name: "Van 7" });
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: futureStart(), returnAt: futureEnd() });
      await db.vehicleAssignment.create({ requestId: trip.id, vehicleId: van12.id, assignedBy: admin.user.id, assignedAt: new Date() });
      const second = await db.vehicleAssignment.create({ requestId: trip.id, vehicleId: van7.id, assignedBy: admin.user.id, assignedAt: new Date() });

      const response = await request(app)
        .delete(`/vehicle-t2/api/review/requests/${trip.id}/assignments/${second.id}`)
        .set(admin.auth);

      expect(response.status).toBe(200);
      expect(response.body.assignments.map((row) => row.vehicle_name)).toEqual(["Van 12"]);
    });

    it("Area admin removes the last assignment", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van = await makeVehicle(area, type);
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: futureStart(), returnAt: futureEnd() });
      const assignment = await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: van.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .delete(`/vehicle-t2/api/review/requests/${trip.id}/assignments/${assignment.id}`)
        .set(admin.auth);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "An approved request must keep at least one vehicle." });
    });

    it("Area admin changes an assignment after the trip starts", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van = await makeVehicle(area, type);
      const other = await makeVehicle(area, type);
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: pastStart(), returnAt: futureEnd() });
      const assignment = await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: van.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .put(`/vehicle-t2/api/review/requests/${trip.id}/assignments/${assignment.id}`)
        .set(admin.auth)
        .send({ vehicle_id: other.id });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Assignments cannot change after the trip starts." });
    });

    it("Area admin updates an assignment that is missing", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: futureStart(), returnAt: futureEnd() });

      const response = await request(app)
        .put(`/vehicle-t2/api/review/requests/${trip.id}/assignments/99999`)
        .set(admin.auth)
        .send({ vehicle_id: 1 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Assignment with id=99999 not found." });
    });
  });

  describe("US-5.9 — Refuse conflicting assignments", () => {
    it("Area admin adds a conflicting vehicle via the API", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const admin = await areaAdminFor(area);
      const start = new Date("2026-11-20T14:00:00.000Z");
      const end = new Date("2026-11-20T22:00:00.000Z");
      const booked = await makeRequest(area, type, { status: "approved", departureAt: start, returnAt: end });
      await db.vehicleAssignment.create({
        requestId: booked.id,
        vehicleId: van12.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });
      const trip = await makeRequest(area, type, {
        status: "approved",
        departureAt: new Date("2026-11-20T18:00:00.000Z"),
        returnAt: new Date("2026-11-20T23:00:00.000Z"),
      });
      const keeper = await makeVehicle(area, type);
      await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: keeper.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/assignments`)
        .set(admin.auth)
        .send({ vehicle_id: van12.id });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: `Vehicle with id=${van12.id} is not available for this trip.` });
      expect(await db.vehicleAssignment.count({ where: { requestId: trip.id, vehicleId: van12.id } })).toBe(0);
    });

    it("Two admins assign the same vehicle at the same time", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const first = await signInAs("admin");
      const second = await signInAs("admin");
      const start = futureStart();
      const end = futureEnd();
      const left = await makeRequest(area, type, { departureAt: start, returnAt: end });
      const right = await makeRequest(area, type, { departureAt: start, returnAt: end });

      const [one, two] = await Promise.all([
        request(app).post(`/vehicle-t2/api/review/requests/${left.id}/approve`).set(first.auth).send({ assignments: [{ vehicle_id: van12.id }] }),
        request(app).post(`/vehicle-t2/api/review/requests/${right.id}/approve`).set(second.auth).send({ assignments: [{ vehicle_id: van12.id }] }),
      ]);

      const statuses = [one.status, two.status].sort();
      expect(statuses).toEqual([200, 409]);
      expect(await db.vehicleAssignment.count({ where: { vehicleId: van12.id } })).toBe(1);
    });
  });

  describe("US-5.10 — Enter trip logs and complete a request", () => {
    async function finishedTrip() {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van12 = await makeVehicle(area, type, { name: "Van 12" });
      const van7 = await makeVehicle(area, type, { name: "Van 7" });
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: pastStart(), returnAt: pastEnd() });
      const first = await db.vehicleAssignment.create({ requestId: trip.id, vehicleId: van12.id, assignedBy: admin.user.id, assignedAt: new Date() });
      const second = await db.vehicleAssignment.create({ requestId: trip.id, vehicleId: van7.id, assignedBy: admin.user.id, assignedAt: new Date() });
      return { admin, trip, first, second };
    }

    function log(assignment, overrides = {}) {
      return {
        assignment_id: assignment.id,
        start_mileage: 48210,
        end_mileage: 48422,
        picked_up_at: "2026-11-20T13:45:00.000Z",
        returned_at: "2026-11-20T22:10:00.000Z",
        ...overrides,
      };
    }

    it("Area admin completes a finished trip", async () => {
      const { admin, trip, first, second } = await finishedTrip();

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/complete`)
        .set(admin.auth)
        .send({ trip_logs: [log(first), log(second, { end_mileage: 49000 })] });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("completed");
      expect(response.body.assignments.every((row) => row.trip_log)).toBe(true);
      expect(response.body.assignments.find((row) => row.id === second.id).trip_log.end_mileage).toBe(49000);
    });

    it("Area admin completes with end mileage below start mileage", async () => {
      const { admin, trip, first, second } = await finishedTrip();

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/complete`)
        .set(admin.auth)
        .send({ trip_logs: [log(first, { start_mileage: 48422, end_mileage: 48210 }), log(second)] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "End mileage must be greater than or equal to start mileage." });
      expect(await db.tripLog.count()).toBe(0);
    });

    it("Area admin completes with return before pick-up", async () => {
      const { admin, trip, first, second } = await finishedTrip();

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/complete`)
        .set(admin.auth)
        .send({
          trip_logs: [
            log(first, { picked_up_at: "2026-11-20T22:10:00.000Z", returned_at: "2026-11-20T13:45:00.000Z" }),
            log(second),
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Return time must be after pick-up time." });
    });

    it("Area admin completes without a trip log for every vehicle", async () => {
      const { admin, trip, first } = await finishedTrip();

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/complete`)
        .set(admin.auth)
        .send({ trip_logs: [log(first)] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "A trip log is required for every assigned vehicle." });
    });

    it("Area admin completes before the trip ends", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van = await makeVehicle(area, type);
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "approved", departureAt: pastStart(), returnAt: futureEnd() });
      const assignment = await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: van.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/complete`)
        .set(admin.auth)
        .send({ trip_logs: [log(assignment)] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Only approved requests whose trip has ended can be completed." });
    });
  });

  describe("US-5.11 — Edit a trip log", () => {
    it("Area admin edits a trip log and saves", async () => {
      const area = await makeArea("Athletics");
      const type = await makeType();
      const van = await makeVehicle(area, type, { name: "Van 12" });
      const admin = await areaAdminFor(area);
      const trip = await makeRequest(area, type, { status: "completed", departureAt: pastStart(), returnAt: pastEnd() });
      const assignment = await db.vehicleAssignment.create({
        requestId: trip.id,
        vehicleId: van.id,
        assignedBy: admin.user.id,
        assignedAt: new Date(),
      });
      const tripLog = await db.tripLog.create({
        assignmentId: assignment.id,
        startMileage: 10,
        endMileage: 20,
        pickedUpAt: new Date("2026-11-01T10:00:00.000Z"),
        returnedAt: new Date("2026-11-01T12:00:00.000Z"),
      });

      const response = await request(app)
        .put(`/vehicle-t2/api/review/trip-logs/${tripLog.id}`)
        .set(admin.auth)
        .send({
          start_mileage: 10,
          end_mileage: 40,
          picked_up_at: "2026-11-01T10:00:00.000Z",
          returned_at: "2026-11-01T12:00:00.000Z",
        });

      expect(response.status).toBe(200);
      expect(response.body.end_mileage).toBe(40);
    });

    it("Area admin edits a trip log that is missing", async () => {
      const admin = await signInAs("area_admin");

      const response = await request(app).put("/vehicle-t2/api/review/trip-logs/99999").set(admin.auth).send({
        start_mileage: 1,
        end_mileage: 2,
        picked_up_at: "2026-11-01T10:00:00.000Z",
        returned_at: "2026-11-01T12:00:00.000Z",
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Trip log with id=99999 not found." });
    });
  });

  describe("US-5.13 — Restrict review to area admins and admins", () => {
    it("Area admin cannot review a request outside their areas", async () => {
      const athletics = await makeArea("Athletics");
      const music = await makeArea("Music");
      const type = await makeType();
      const admin = await areaAdminFor(athletics);
      const trip = await makeRequest(music, type);
      const van = await makeVehicle(music, type);

      const response = await request(app)
        .post(`/vehicle-t2/api/review/requests/${trip.id}/approve`)
        .set(admin.auth)
        .send({ assignments: [{ vehicle_id: van.id }] });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Request with id=${trip.id} not found.` });
    });

    it("Requestor cannot list review requests via the API", async () => {
      const requestor = await signInAs("requestor");

      const response = await request(app).get("/vehicle-t2/api/review/requests").set(requestor.auth);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Area admin role required." });
    });

    it("Unauthenticated API request to review", async () => {
      const response = await request(app).get("/vehicle-t2/api/review/requests");

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/unauthorized/i);
    });
  });
});
