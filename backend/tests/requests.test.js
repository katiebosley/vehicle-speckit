/**
 * Feature 4 — Making and Tracking Requests
 * Spec: features/feature-4-making-and-tracking-requests.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";

const API = "/vehicle-t2";

async function signIn(role, email) {
  const user = await db.user.create({
    email,
    firstName: "Ada",
    lastName: role,
    role,
    isActive: true,
  });
  const token = `token-${role}-${user.id}`;
  await db.session.create({
    token,
    email,
    expirationDate: new Date(Date.now() + 60 * 60 * 1000),
    userId: user.id,
  });
  return { token, user };
}

async function createArea(name, isActive = true) {
  return db.area.create({ name, isActive });
}

async function createType(name, isActive = true) {
  return db.vehicleType.create({ name, isActive });
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function requestBody(areaId, vehicleTypeId, overrides = {}) {
  return {
    areaId,
    vehicleTypeId,
    purpose: "Field trip to museum",
    destination: "Downtown Museum",
    departureAt: hoursFromNow(48),
    returnAt: hoursFromNow(54),
    passengerCount: 12,
    vehiclesNeeded: 1,
    ...overrides,
  };
}

async function clearRequests() {
  const [rows] = await db.sequelize.query(
    `SELECT table_name AS tableName FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name IN ('vehicle_assignments', 'requests')`
  );
  const names = rows.map((row) => row.tableName || row.TABLE_NAME);
  if (names.includes("vehicle_assignments")) {
    await db.sequelize.query("DELETE FROM vehicle_assignments");
  }
  if (names.includes("requests")) {
    await db.sequelize.query("DELETE FROM requests");
  }
}

describe("Feature 4 — Making and Tracking Requests", () => {
  beforeAll(async () => {
    await clearRequests();
    await db.sequelize.sync({ alter: true });
  });

  beforeEach(async () => {
    await clearRequests();
    await db.vehicleUnavailability.destroy({ where: {} });
    await db.vehicle.destroy({ where: {} });
    await db.vehicleType.destroy({ where: {} });
    await db.areaAdmin.destroy({ where: {} });
    await db.area.destroy({ where: {} });
    await db.session.destroy({ where: {} });
    await db.user.destroy({ where: {} });
  });

  describe("US-4.1 — Submit a vehicle request", () => {
    it("Requestor submits a valid request", async () => {
      const { token, user } = await signIn("requestor", "submit@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");

      const response = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          ...requestBody(area.id, van.id),
          requesterId: 999999,
          status: "approved",
          reviewedBy: user.id,
          reviewNotes: "ignore me",
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("pending");
      expect(response.body.requesterId).toBe(user.id);
      expect(response.body.reviewedBy).toBeNull();
      expect(response.body.reviewedAt).toBeNull();
      expect(response.body.reviewNotes).toBeNull();
      expect(response.body.areaId).toBe(area.id);
      expect(response.body.vehicleTypeId).toBe(van.id);
      expect(response.body.purpose).toBe("Field trip to museum");
      expect(response.body.passengerCount).toBe(12);
      expect(response.body.vehiclesNeeded).toBe(1);
      expect(response.body.areaName).toBe("Athletics");
      expect(response.body.vehicleTypeName).toBe("Van");

      const omitted = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { vehiclesNeeded: undefined, destination: "Library" }));

      expect(omitted.status).toBe(201);
      expect(omitted.body.vehiclesNeeded).toBe(1);
      expect(await db.request.count()).toBe(2);
    });

    it("Unauthenticated user cannot create a request", async () => {
      const response = await request(app).post(`${API}/requests`).send({ purpose: "Trip" });

      expect(response.status).toBe(401);
      expect(await db.request.count()).toBe(0);
    });

    it("Non-requestor cannot create a request", async () => {
      const { token } = await signIn("admin", "admin-create@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");

      const response = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not have permission for this action." });
      expect(await db.request.count()).toBe(0);
    });
  });

  describe("US-4.2 — Validation errors on invalid request", () => {
    it("Requestor omits a required field", async () => {
      const { token } = await signIn("requestor", "omit@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const body = requestBody(area.id, van.id);
      delete body.purpose;

      const response = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "All required fields must be provided." });
      expect(await db.request.count()).toBe(0);

      const blank = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { purpose: "   " }));

      expect(blank.status).toBe(400);
      expect(blank.body).toEqual({ message: "All required fields must be provided." });

      const counts = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { passengerCount: 0 }));

      expect(counts.status).toBe(400);
      expect(counts.body).toEqual({ message: "Passenger count and vehicles needed must be at least 1." });
      expect(await db.request.count()).toBe(0);
    });

    it("Return is not after departure", async () => {
      const { token } = await signIn("requestor", "return@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const departureAt = hoursFromNow(48);

      const equal = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { departureAt, returnAt: departureAt }));

      expect(equal.status).toBe(400);
      expect(equal.body).toEqual({ message: "Return must be after departure." });

      const before = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { departureAt, returnAt: hoursFromNow(24) }));

      expect(before.status).toBe(400);
      expect(before.body).toEqual({ message: "Return must be after departure." });
      expect(await db.request.count()).toBe(0);
    });

    it("Departure is in the past", async () => {
      const { token } = await signIn("requestor", "past@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");

      const response = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(
          requestBody(area.id, van.id, {
            departureAt: hoursFromNow(-24),
            returnAt: hoursFromNow(24),
          })
        );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Departure must be in the future." });
      expect(await db.request.count()).toBe(0);
    });

    it("Invalid area or vehicle type", async () => {
      const { token } = await signIn("requestor", "refs@oc.edu");
      const activeArea = await createArea("Athletics");
      const inactiveArea = await createArea("Closed", false);
      const activeType = await createType("Van");
      const inactiveType = await createType("Bus", false);

      const cases = [
        requestBody(999999, activeType.id),
        requestBody(inactiveArea.id, activeType.id),
        requestBody(activeArea.id, 999999),
        requestBody(activeArea.id, inactiveType.id),
      ];

      for (const body of cases) {
        const response = await request(app)
          .post(`${API}/requests`)
          .set("Authorization", `Bearer ${token}`)
          .send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid area or vehicle type." });
      }

      expect(await db.request.count()).toBe(0);
    });
  });

  describe("US-4.3 — List my requests", () => {
    it("Requestor sees own requests newest first", async () => {
      const { token, user } = await signIn("requestor", "list@oc.edu");
      const other = await signIn("requestor", "list-other@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");

      const older = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { purpose: "Older trip" }));
      const newer = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { purpose: "Newer trip" }));
      await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${other.token}`)
        .send(requestBody(area.id, van.id, { purpose: "Someone else" }));

      await db.sequelize.query("UPDATE requests SET created_at = :createdAt WHERE id = :id", {
        replacements: { createdAt: new Date("2026-01-01T00:00:00.000Z"), id: older.body.id },
      });
      await db.sequelize.query(
        "UPDATE requests SET created_at = :createdAt, status = 'approved' WHERE id = :id",
        { replacements: { createdAt: new Date("2026-06-01T00:00:00.000Z"), id: newer.body.id } }
      );

      const response = await request(app).get(`${API}/requests`).set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([newer.body.id, older.body.id]);
      expect(response.body.every((row) => row.requesterId === user.id)).toBe(true);
      expect(response.body.map((row) => row.status)).toEqual(["approved", "pending"]);
      expect(response.body[0].purpose).toBe("Newer trip");
    });
  });

  describe("US-4.4 — View request detail", () => {
    it("Requestor views review notes and assignments when present", async () => {
      const { token, user } = await signIn("requestor", "detail@oc.edu");
      const reviewer = await signIn("admin", "reviewer@oc.edu");
      const driver = await db.user.create({
        email: "alex.nguyen@oc.edu",
        firstName: "Alex",
        lastName: "Nguyen",
        role: "requestor",
      });
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id));

      const empty = await request(app)
        .get(`${API}/requests/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(empty.status).toBe(200);
      expect(empty.body.assignments).toEqual([]);
      expect(empty.body.reviewNotes).toBeNull();

      const vehicle = await db.vehicle.create({
        areaId: area.id,
        vehicleTypeId: van.id,
        name: "Van 2",
        make: "Ford",
        model: "Transit",
        year: 2022,
        vin: "1FTBW2CM5NKA12345",
        purchasedDate: "2022-08-15",
        color: "White",
        capacity: 12,
        licensePlate: "ABC-123",
        licensePlateExpireMonth: 6,
        currentMileage: 100,
        status: "available",
      });

      await db.request.update(
        {
          status: "approved",
          reviewedBy: reviewer.user.id,
          reviewedAt: new Date("2026-11-10T15:00:00.000Z"),
          reviewNotes: "Approved for the museum.",
        },
        { where: { id: created.body.id } }
      );

      await db.sequelize.query(`CREATE TABLE IF NOT EXISTS vehicle_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        driver_id INT NULL,
        assigned_by INT NULL,
        assigned_at DATETIME NULL
      )`);
      const [driverColumn] = await db.sequelize.query(
        `SELECT COLUMN_NAME AS columnName FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'vehicle_assignments'
           AND column_name = 'driver_id'`
      );
      if (driverColumn.length === 0) {
        await db.sequelize.query("ALTER TABLE vehicle_assignments ADD COLUMN driver_id INT NULL");
      }
      await db.sequelize.query(
        `INSERT INTO vehicle_assignments (request_id, vehicle_id, driver_id, assigned_by, assigned_at)
         VALUES (:requestId, :vehicleId, :driverId, :assignedBy, NOW())`,
        {
          replacements: {
            requestId: created.body.id,
            vehicleId: vehicle.id,
            driverId: driver.id,
            assignedBy: reviewer.user.id,
          },
        }
      );

      const response = await request(app)
        .get(`${API}/requests/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.requesterId).toBe(user.id);
      expect(response.body.status).toBe("approved");
      expect(response.body.reviewNotes).toBe("Approved for the museum.");
      expect(response.body.reviewedBy).toBe(reviewer.user.id);
      expect(response.body.reviewer).toEqual({
        id: reviewer.user.id,
        firstName: "Ada",
        lastName: "admin",
      });
      expect(response.body.assignments).toEqual([
        {
          id: expect.any(Number),
          vehicle: { id: vehicle.id, name: "Van 2", licensePlate: "ABC-123" },
          driver: { id: driver.id, firstName: "Alex", lastName: "Nguyen" },
        },
      ]);
    });
  });

  describe("US-4.5 — Edit a pending request", () => {
    it("Requestor edits a pending request", async () => {
      const { token, user } = await signIn("requestor", "edit@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id));

      await db.request.update(
        { reviewNotes: "Keep me", reviewedBy: user.id },
        { where: { id: created.body.id } }
      );

      const response = await request(app)
        .put(`${API}/requests/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(
          requestBody(area.id, van.id, {
            destination: "Science Museum",
            requesterId: 999999,
            reviewNotes: "Changed",
            status: "approved",
          })
        );

      expect(response.status).toBe(200);
      expect(response.body.destination).toBe("Science Museum");
      expect(response.body.status).toBe("pending");
      expect(response.body.requesterId).toBe(user.id);
      expect(response.body.reviewNotes).toBe("Keep me");
      expect(response.body.reviewedBy).toBe(user.id);

      const missing = await request(app)
        .put(`${API}/requests/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { purpose: "" }));

      expect(missing.status).toBe(400);
      expect(missing.body).toEqual({ message: "All required fields must be provided." });
      expect((await db.request.findByPk(created.body.id)).destination).toBe("Science Museum");
    });

    it("Requestor cannot edit a non-pending request", async () => {
      const { token } = await signIn("requestor", "edit-approved@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id));

      await db.request.update({ status: "approved" }, { where: { id: created.body.id } });

      const response = await request(app)
        .put(`${API}/requests/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id, { destination: "Should not save" }));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Only pending requests can be edited." });
      expect((await db.request.findByPk(created.body.id)).destination).toBe("Downtown Museum");
    });
  });

  describe("US-4.6 — Cancel a request", () => {
    it("Requestor cancels a pending request", async () => {
      const { token } = await signIn("requestor", "cancel-pending@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id));

      const response = await request(app)
        .post(`${API}/requests/${created.body.id}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("cancelled");
      expect((await db.request.findByPk(created.body.id)).status).toBe("cancelled");
    });

    it("Requestor cancels an approved request that has not started", async () => {
      const { token } = await signIn("requestor", "cancel-future@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${token}`)
        .send(requestBody(area.id, van.id));

      await db.request.update({ status: "approved" }, { where: { id: created.body.id } });

      const response = await request(app)
        .post(`${API}/requests/${created.body.id}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("cancelled");
    });

    it("Requestor cannot cancel an approved request after departure time", async () => {
      const { token, user } = await signIn("requestor", "cancel-past@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const row = await db.request.create({
        requesterId: user.id,
        areaId: area.id,
        vehicleTypeId: van.id,
        passengerCount: 2,
        purpose: "Started trip",
        destination: "Campus",
        departureAt: new Date(Date.now() - 60 * 60 * 1000),
        returnAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "approved",
      });

      const response = await request(app)
        .post(`${API}/requests/${row.id}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "This request cannot be cancelled." });
      expect((await db.request.findByPk(row.id)).status).toBe("approved");

      await row.update({ status: "denied" });
      const denied = await request(app)
        .post(`${API}/requests/${row.id}/cancel`)
        .set("Authorization", `Bearer ${token}`);
      expect(denied.status).toBe(400);
      expect(denied.body).toEqual({ message: "This request cannot be cancelled." });
    });
  });

  describe("US-4.7 — Isolation of others’ requests", () => {
    it("Requestor cannot list another user’s requests", async () => {
      const a = await signIn("requestor", "owner-a@oc.edu");
      const b = await signIn("requestor", "owner-b@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");

      const mine = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${a.token}`)
        .send(requestBody(area.id, van.id, { purpose: "Mine" }));
      await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${b.token}`)
        .send(requestBody(area.id, van.id, { purpose: "Theirs" }));

      const response = await request(app).get(`${API}/requests`).set("Authorization", `Bearer ${a.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(mine.body.id);
      expect(response.body[0].requesterId).toBe(a.user.id);
    });

    it("Requestor cannot open another user’s request by id", async () => {
      const a = await signIn("requestor", "open-a@oc.edu");
      const b = await signIn("requestor", "open-b@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const theirs = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${b.token}`)
        .send(requestBody(area.id, van.id));

      const response = await request(app)
        .get(`${API}/requests/${theirs.body.id}`)
        .set("Authorization", `Bearer ${a.token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Request not found." });
    });

    it("Requestor cannot update or cancel another user’s request", async () => {
      const a = await signIn("requestor", "write-a@oc.edu");
      const b = await signIn("requestor", "write-b@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const theirs = await request(app)
        .post(`${API}/requests`)
        .set("Authorization", `Bearer ${b.token}`)
        .send(requestBody(area.id, van.id));

      const updated = await request(app)
        .put(`${API}/requests/${theirs.body.id}`)
        .set("Authorization", `Bearer ${a.token}`)
        .send(requestBody(area.id, van.id, { destination: "Stolen" }));
      const cancelled = await request(app)
        .post(`${API}/requests/${theirs.body.id}/cancel`)
        .set("Authorization", `Bearer ${a.token}`);

      expect(updated.status).toBe(404);
      expect(updated.body).toEqual({ message: "Request not found." });
      expect(cancelled.status).toBe(404);
      expect(cancelled.body).toEqual({ message: "Request not found." });
      const stored = await db.request.findByPk(theirs.body.id);
      expect(stored.destination).toBe("Downtown Museum");
      expect(stored.status).toBe("pending");
    });
  });
});
