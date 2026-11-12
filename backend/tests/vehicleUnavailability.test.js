import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";

const User = db.user;
const Session = db.session;
const Area = db.area;
const AreaAdmin = db.areaAdmin;
const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;
const VehicleUnavailability = db.vehicleUnavailability;

async function signIn(role, email) {
  const user = await User.create({
    email,
    firstName: "Ada",
    lastName: role,
    role,
    isActive: true,
  });
  const token = `token-${role}-${user.id}`;
  await Session.create({
    token,
    email,
    expirationDate: new Date(Date.now() + 60 * 60 * 1000),
    userId: user.id,
  });
  return { token, user };
}

async function fleetVehicle(areaName = "Athletics") {
  const session = await signIn("area_admin", `blocks-${areaName}-${Date.now()}@oc.edu`);
  const area = await Area.create({ name: areaName, isActive: true });
  await AreaAdmin.create({ userId: session.user.id, areaId: area.id });
  const type = await VehicleType.create({ name: "Van", isActive: true });
  const vehicle = await Vehicle.create({
    areaId: area.id,
    vehicleTypeId: type.id,
    make: "Ford",
    model: "Transit",
    year: 2022,
    vin: `VIN${area.id}BLOCK01`,
    purchasedDate: "2022-08-15",
    color: "White",
    capacity: 12,
    licensePlate: `P${area.id}01`,
    licensePlateExpireMonth: 6,
    currentMileage: 100,
    status: "available",
  });
  return { ...session, area, vehicle };
}

describe("Feature 3 — Fleet Management", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
  });

  beforeEach(async () => {
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
    await VehicleUnavailability.destroy({ where: {} });
    await Vehicle.destroy({ where: {} });
    await VehicleType.destroy({ where: {} });
    await AreaAdmin.destroy({ where: {} });
    await Area.destroy({ where: {} });
    await Session.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe("US-3.6 — Block a vehicle for a date range", () => {
    it("Area admin blocks a vehicle for a date range", async () => {
      const { token, vehicle } = await fleetVehicle();

      const response = await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-05T00:00:00.000Z",
          reason: "Oil change",
        });

      expect(response.status).toBe(201);

      const detail = await request(app)
        .get(`/vehicle-t2/vehicles/${vehicle.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(detail.body.status).toBe("available");
      expect(detail.body.unavailability).toEqual([
        expect.objectContaining({ reason: "Oil change" }),
      ]);
    });

    it("End is not after start", async () => {
      const { token, vehicle } = await fleetVehicle();

      const response = await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startsAt: "2026-12-05T00:00:00.000Z",
          endsAt: "2026-12-05T00:00:00.000Z",
          reason: "Oil change",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "End must be after start." });
    });

    it("Overlapping block on the same vehicle", async () => {
      const { token, vehicle } = await fleetVehicle();
      await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-05T00:00:00.000Z",
          reason: "Oil change",
        });

      const response = await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startsAt: "2026-12-04T00:00:00.000Z",
          endsAt: "2026-12-08T00:00:00.000Z",
          reason: "Tires",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "This vehicle is already blocked during that time." });
    });

    it("Area admin removes a block", async () => {
      const { token, vehicle } = await fleetVehicle();
      const created = await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-05T00:00:00.000Z",
          reason: "Oil change",
        });

      const response = await request(app)
        .delete(`/vehicle-t2/vehicles/${vehicle.id}/unavailability/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Unavailability window removed." });

      const detail = await request(app)
        .get(`/vehicle-t2/vehicles/${vehicle.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(detail.body.unavailability).toEqual([]);
    });

    it("Area admin cannot block another area's vehicle", async () => {
      const athletics = await signIn("area_admin", "area-block-ath@oc.edu");
      const ownArea = await Area.create({ name: "Athletics", isActive: true });
      await AreaAdmin.create({ userId: athletics.user.id, areaId: ownArea.id });
      const support = await Area.create({ name: "Support Central", isActive: true });
      const type = await VehicleType.create({ name: "Van", isActive: true });
      const vehicle = await Vehicle.create({
        areaId: support.id,
        vehicleTypeId: type.id,
        make: "Ford",
        model: "Transit",
        year: 2022,
        vin: "SUPPORTBLOCK01",
        purchasedDate: "2022-08-15",
        color: "White",
        capacity: 12,
        licensePlate: "SUP-BLK",
        licensePlateExpireMonth: 6,
        currentMileage: 100,
        status: "available",
      });

      const response = await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${athletics.token}`)
        .send({
          startsAt: "2026-12-01T00:00:00.000Z",
          endsAt: "2026-12-05T00:00:00.000Z",
          reason: "Oil change",
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Vehicle not found." });
    });

    it("Block is refused when it overlaps an approved trip", async () => {
      const { token, vehicle } = await fleetVehicle();
      await db.sequelize.query(`CREATE TABLE IF NOT EXISTS requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status VARCHAR(20) NOT NULL,
        departure_at DATETIME NOT NULL,
        return_at DATETIME NOT NULL
      )`);
      await db.sequelize.query(`CREATE TABLE IF NOT EXISTS vehicle_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        vehicle_id INT NOT NULL
      )`);
      await db.sequelize.query(
        `INSERT INTO requests (status, departure_at, return_at) VALUES ('approved', :departure, :returnAt)`,
        {
          replacements: {
            departure: new Date("2026-12-01T00:00:00.000Z"),
            returnAt: new Date("2026-12-03T00:00:00.000Z"),
          },
        }
      );
      const [requests] = await db.sequelize.query("SELECT id FROM requests ORDER BY id DESC LIMIT 1");
      await db.sequelize.query(
        `INSERT INTO vehicle_assignments (request_id, vehicle_id) VALUES (:requestId, :vehicleId)`,
        { replacements: { requestId: requests[0].id, vehicleId: vehicle.id } }
      );

      const response = await request(app)
        .post(`/vehicle-t2/vehicles/${vehicle.id}/unavailability`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startsAt: "2026-12-02T00:00:00.000Z",
          endsAt: "2026-12-04T00:00:00.000Z",
          reason: "Oil change",
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "This vehicle is assigned to a trip during that time." });
      expect(await VehicleUnavailability.count()).toBe(0);
    });
  });
});
