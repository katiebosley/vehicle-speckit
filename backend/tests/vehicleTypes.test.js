import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";

const User = db.user;
const Session = db.session;
const VehicleType = db.vehicleType;
const Vehicle = db.vehicle;

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
  return token;
}

async function createType(fields) {
  return VehicleType.create({
    name: "Van",
    isActive: true,
    ...fields,
  });
}

describe("Feature 3 — Fleet Management", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
  });

  beforeEach(async () => {
    await Vehicle.destroy({ where: {} });
    await VehicleType.destroy({ where: {} });
    await Session.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe("US-3.1 — Add, edit, and deactivate vehicle types", () => {
    it("Admin views all vehicle types", async () => {
      const token = await signIn("admin", "admin-list@oc.edu");
      await createType({ name: "Van", isActive: true });
      await createType({ name: "Bus", isActive: false });

      const response = await request(app)
        .get("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.map((type) => type.name)).toEqual(["Bus", "Van"]);
      expect(response.body.find((type) => type.name === "Bus").isActive).toBe(false);
      expect(response.body.find((type) => type.name === "Van").isActive).toBe(true);
    });

    it("Admin creates a vehicle type", async () => {
      const token = await signIn("admin", "admin-create@oc.edu");

      const response = await request(app)
        .post("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Van", defaultPassengerCapacity: 12 });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Van");
      expect(response.body.defaultPassengerCapacity).toBe(12);
      expect(response.body.isActive).toBe(true);
    });

    it("Admin creates a vehicle type with a missing name", async () => {
      const token = await signIn("admin", "admin-blank@oc.edu");

      const response = await request(app)
        .post("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "   " });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Vehicle type name is required." });
    });

    it("Admin creates a duplicate vehicle type", async () => {
      const token = await signIn("admin", "admin-dup@oc.edu");
      await createType({ name: "Van" });

      const response = await request(app)
        .post("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "van" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Vehicle type name is already taken." });
    });

    it("Admin edits a vehicle type", async () => {
      const token = await signIn("admin", "admin-edit@oc.edu");
      const type = await createType({ name: "Van", defaultPassengerCapacity: 12 });

      const response = await request(app)
        .put(`/vehicle-t2/vehicle-types/${type.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ defaultPassengerCapacity: 15 });

      expect(response.status).toBe(200);
      expect(response.body.defaultPassengerCapacity).toBe(15);
    });

    it("Admin deactivates a vehicle type", async () => {
      const token = await signIn("admin", "admin-off@oc.edu");
      const type = await createType({ name: "Bus", isActive: true });

      const response = await request(app)
        .put(`/vehicle-t2/vehicle-types/${type.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
    });

    it("Admin cannot deactivate a vehicle type that is still in use", async () => {
      const token = await signIn("admin", "admin-inuse@oc.edu");
      const type = await createType({ name: "Van", isActive: true });
      await Vehicle.create({
        areaId: 1,
        vehicleTypeId: type.id,
        make: "Ford",
        model: "Transit",
        year: 2022,
        vin: "1FTBW2CM5NKA12345",
        purchasedDate: "2022-08-15",
        color: "White",
        capacity: 12,
        licensePlate: "ATH-101",
        licensePlateExpireMonth: 6,
        currentMileage: 100,
        status: "available",
      });

      const response = await request(app)
        .put(`/vehicle-t2/vehicle-types/${type.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isActive: false });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "This vehicle type is still used by a vehicle that is not retired.",
      });

      const saved = await VehicleType.findByPk(type.id);
      expect(saved.isActive).toBe(true);
    });

    it("Admin reactivates a vehicle type", async () => {
      const admin = await signIn("admin", "admin-on@oc.edu");
      const requestor = await signIn("requestor", "requestor-on@oc.edu");
      const type = await createType({ name: "Bus", isActive: false });

      const response = await request(app)
        .put(`/vehicle-t2/vehicle-types/${type.id}`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ isActive: true });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(true);

      const listed = await request(app)
        .get("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${requestor}`);

      expect(listed.body.map((row) => row.name)).toContain("Bus");
    });

    it("Requestor cannot create a vehicle type", async () => {
      const token = await signIn("requestor", "requestor-create@oc.edu");

      const response = await request(app)
        .post("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Van" });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "You do not have permission for this action." });
    });

    it("Unauthenticated request to vehicle types", async () => {
      const response = await request(app).get("/vehicle-t2/vehicle-types");

      expect(response.status).toBe(401);
    });
  });

  describe("US-3.2 — See the vehicle types I can request", () => {
    it("Requestor lists only active vehicle types", async () => {
      const token = await signIn("requestor", "requestor-list@oc.edu");
      await createType({ name: "Bus", isActive: false });
      await createType({ name: "Van", isActive: true });
      await createType({ name: "Car", isActive: true });

      const response = await request(app)
        .get("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.map((type) => type.name)).toEqual(["Car", "Van"]);
    });

    it("Area admin lists only active vehicle types", async () => {
      const token = await signIn("area_admin", "area-admin-list@oc.edu");
      await createType({ name: "Van", isActive: true });
      await createType({ name: "Bus", isActive: false });

      const response = await request(app)
        .get("/vehicle-t2/vehicle-types")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.map((type) => type.name)).toContain("Van");
      expect(response.body.map((type) => type.name)).not.toContain("Bus");
    });
  });
});
