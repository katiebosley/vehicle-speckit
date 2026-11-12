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

async function createArea(name, isActive = true) {
  return Area.create({ name, isActive });
}

async function createType(name, isActive = true) {
  return VehicleType.create({ name, isActive });
}

function vehicleBody(areaId, vehicleTypeId, overrides = {}) {
  return {
    areaId,
    vehicleTypeId,
    make: "Ford",
    model: "Transit",
    year: 2022,
    vin: "1FTBW2CM5NKA12345",
    purchasedDate: "2022-08-15",
    color: "White",
    capacity: 12,
    licensePlate: "ATH-101",
    licensePlateExpireMonth: 6,
    currentMileage: 18420,
    ...overrides,
  };
}

async function clearTrips() {
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

describe("Feature 3 — Fleet Management", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
  });

  beforeEach(async () => {
    await clearTrips();
    await VehicleUnavailability.destroy({ where: {} });
    await Vehicle.destroy({ where: {} });
    await VehicleType.destroy({ where: {} });
    await AreaAdmin.destroy({ where: {} });
    await Area.destroy({ where: {} });
    await Session.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe("US-3.3 — Add and edit vehicles in my areas", () => {
    it("Area admin creates a vehicle in a managed area", async () => {
      const { token, user } = await signIn("area_admin", "area-create@oc.edu");
      const athletics = await createArea("Athletics");
      await AreaAdmin.create({ userId: user.id, areaId: athletics.id });
      const van = await createType("Van");

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(athletics.id, van.id));

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("available");
      expect(response.body.displayName).toBe("2022 Ford Transit");

      const list = await request(app)
        .get("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`);

      expect(list.body.map((vehicle) => vehicle.displayName)).toContain("2022 Ford Transit");
    });

    it("Admin creates a vehicle in any active area", async () => {
      const { token } = await signIn("admin", "admin-create-vehicle@oc.edu");
      const support = await createArea("Support Central");
      const van = await createType("Van");

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(support.id, van.id, { vin: "SUPPORTCENTRAL01", licensePlate: "SUP-101" }));

      expect(response.status).toBe(201);
      expect(response.body.areaName).toBe("Support Central");
    });

    it("Create with a missing required field", async () => {
      const { token } = await signIn("admin", "admin-missing@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const body = vehicleBody(area.id, van.id);
      delete body.vin;

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "All required fields must be provided." });
    });

    it("Duplicate VIN", async () => {
      const { token } = await signIn("admin", "admin-vin@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id));

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id, { vin: "1ftbw2cm5nka12345", licensePlate: "ATH-102" }));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "VIN is already in use." });
    });

    it("Duplicate license plate", async () => {
      const { token } = await signIn("admin", "admin-plate@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id));

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id, { vin: "1FTBW2CM5NKA12346", licensePlate: "ath-101" }));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "License plate is already in use." });
    });

    it("Year out of range", async () => {
      const { token } = await signIn("admin", "admin-year@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id, { year: 1989 }));

      expect(response.status).toBe(400);
      expect(response.body.message.startsWith("Year must be between 1990 and")).toBe(true);
    });

    it("Area admin creates a vehicle in an unmanaged area", async () => {
      const { token, user } = await signIn("area_admin", "area-unmanaged@oc.edu");
      const athletics = await createArea("Athletics");
      const support = await createArea("Support Central");
      await AreaAdmin.create({ userId: user.id, areaId: athletics.id });
      const van = await createType("Van");

      const response = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(support.id, van.id));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not manage this area." });
      expect(await Vehicle.count()).toBe(0);
    });

    it("Create with an inactive area or inactive type", async () => {
      const { token } = await signIn("admin", "admin-inactive@oc.edu");
      const inactiveArea = await createArea("Closed", false);
      const activeArea = await createArea("Athletics");
      const inactiveType = await createType("Bus", false);
      const activeType = await createType("Van");

      const areaResponse = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(inactiveArea.id, activeType.id));

      expect(areaResponse.status).toBe(400);
      expect(areaResponse.body).toEqual({ message: "Area is not active." });

      const typeResponse = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(activeArea.id, inactiveType.id, { vin: "1FTBW2CM5NKA12346", licensePlate: "ATH-102" }));

      expect(typeResponse.status).toBe(400);
      expect(typeResponse.body).toEqual({ message: "Invalid vehicle type." });
    });

    it("Area admin edits a vehicle in their area", async () => {
      const { token, user } = await signIn("area_admin", "area-edit@oc.edu");
      const athletics = await createArea("Athletics");
      await AreaAdmin.create({ userId: user.id, areaId: athletics.id });
      const van = await createType("Van");
      const created = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(athletics.id, van.id));

      const response = await request(app)
        .put(`/vehicle-t2/vehicles/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ color: "red" });

      expect(response.status).toBe(200);

      const list = await request(app)
        .get("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`);

      expect(list.body.find((vehicle) => vehicle.id === created.body.id).color).toBe("red");
    });

    it("Area admin edits a vehicle in another area", async () => {
      const { token, user } = await signIn("area_admin", "area-other-edit@oc.edu");
      const { token: adminToken } = await signIn("admin", "admin-other-edit@oc.edu");
      const athletics = await createArea("Athletics");
      const support = await createArea("Support Central");
      await AreaAdmin.create({ userId: user.id, areaId: athletics.id });
      const van = await createType("Van");
      const created = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(vehicleBody(support.id, van.id));

      const response = await request(app)
        .put(`/vehicle-t2/vehicles/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ color: "blue" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Vehicle not found." });

      const saved = await Vehicle.findByPk(created.body.id);
      expect(saved.color).toBe("White");
    });
  });

  describe("US-3.4 — See only vehicles for my areas", () => {
    it("Area admin sees only vehicles in managed areas", async () => {
      const { token, user } = await signIn("area_admin", "area-list@oc.edu");
      const { token: adminToken } = await signIn("admin", "admin-list-scope@oc.edu");
      const athletics = await createArea("Athletics");
      const support = await createArea("Support Central");
      await AreaAdmin.create({ userId: user.id, areaId: athletics.id });
      const van = await createType("Van");
      await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(vehicleBody(athletics.id, van.id));
      await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(vehicleBody(support.id, van.id, { vin: "SUPPORTCENTRAL01", licensePlate: "SUP-101" }));

      const response = await request(app)
        .get("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.map((vehicle) => vehicle.areaName)).toEqual(["Athletics"]);
    });

    it("Admin sees vehicles in every area", async () => {
      const { token } = await signIn("admin", "admin-list-all@oc.edu");
      const athletics = await createArea("Athletics");
      const support = await createArea("Support Central");
      const van = await createType("Van");
      await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(athletics.id, van.id, { name: "Athletics Van" }));
      await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(support.id, van.id, { name: "Support Truck", vin: "SUPPORTCENTRAL01", licensePlate: "SUP-101" }));

      const response = await request(app)
        .get("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.map((vehicle) => vehicle.areaName).sort()).toEqual(["Athletics", "Support Central"]);
    });

    it("Requestor cannot list vehicles", async () => {
      const { token } = await signIn("requestor", "requestor-fleet@oc.edu");

      const response = await request(app)
        .get("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not have permission for this action." });
    });

    it("Area admin filters to an unmanaged area", async () => {
      const { token, user } = await signIn("area_admin", "area-filter@oc.edu");
      const athletics = await createArea("Athletics");
      const support = await createArea("Support Central");
      await AreaAdmin.create({ userId: user.id, areaId: athletics.id });

      const response = await request(app)
        .get(`/vehicle-t2/vehicles?areaId=${support.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not manage this area." });
    });
  });

  describe("US-3.5 — Take a vehicle out of service without deleting it", () => {
    async function athleticsVehicle() {
      const session = await signIn("area_admin", `area-status-${Date.now()}@oc.edu`);
      const athletics = await createArea("Athletics");
      await AreaAdmin.create({ userId: session.user.id, areaId: athletics.id });
      const van = await createType("Van");
      const created = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${session.token}`)
        .send(vehicleBody(athletics.id, van.id));
      return { ...session, vehicle: created.body };
    }

    it("Area admin marks a vehicle in maintenance", async () => {
      const { token, vehicle } = await athleticsVehicle();

      const response = await request(app)
        .put(`/vehicle-t2/vehicles/${vehicle.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "maintenance" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("maintenance");
    });

    it("Area admin retires a vehicle", async () => {
      const { token, vehicle } = await athleticsVehicle();

      const response = await request(app)
        .put(`/vehicle-t2/vehicles/${vehicle.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "retired" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("retired");

      const list = await request(app)
        .get("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`);

      expect(list.body.find((row) => row.id === vehicle.id).status).toBe("retired");
    });

    it("There is no delete for vehicles", async () => {
      const { token } = await signIn("admin", "admin-delete@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id));

      const response = await request(app)
        .delete(`/vehicle-t2/vehicles/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(await Vehicle.findByPk(created.body.id)).not.toBeNull();
    });

    it("Retire is refused when a future approved trip exists", async () => {
      const { token } = await signIn("admin", "admin-retire-trip@oc.edu");
      const area = await createArea("Athletics");
      const van = await createType("Van");
      const created = await request(app)
        .post("/vehicle-t2/vehicles")
        .set("Authorization", `Bearer ${token}`)
        .send(vehicleBody(area.id, van.id));

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
        { replacements: { departure: new Date("2026-12-01T00:00:00.000Z"), returnAt: new Date("2099-01-01T00:00:00.000Z") } }
      );
      const [requests] = await db.sequelize.query("SELECT id FROM requests ORDER BY id DESC LIMIT 1");
      await db.sequelize.query(
        `INSERT INTO vehicle_assignments (request_id, vehicle_id) VALUES (:requestId, :vehicleId)`,
        { replacements: { requestId: requests[0].id, vehicleId: created.body.id } }
      );

      const response = await request(app)
        .put(`/vehicle-t2/vehicles/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "retired" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "This vehicle is assigned to a future trip." });
      expect((await Vehicle.findByPk(created.body.id)).status).toBe("available");
    });
  });
});
