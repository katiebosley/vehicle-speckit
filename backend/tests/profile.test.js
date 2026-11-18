/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, createUser, signInAs } from "./helpers.js";

const API = "/vehicle-t2";

beforeEach(async () => {
  await syncTestDatabase();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.8 — View and edit my profile", () => {
    it("User updates their name and phone", async () => {
      const { user, auth } = await signInAs("requestor", { firstName: "Jane", lastName: "Doe" });
      const other = await createUser({ firstName: "Other" });

      const res = await request(app)
        .put(`${API}/profile`)
        .set(auth)
        .send({ firstName: "  Janet ", lastName: "Doe", phone: " 405-555-0199 " });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: user.id, firstName: "Janet", phone: "405-555-0199" });
      expect(res.body).not.toHaveProperty("googleId");

      const reload = await request(app).get(`${API}/profile`).set(auth);
      expect(reload.body.firstName).toBe("Janet");
      expect((await db.user.findByPk(other.id)).firstName).toBe("Other");
    });

    it("User cannot change their own role through the profile", async () => {
      const { user, auth } = await signInAs("requestor");

      const res = await request(app)
        .put(`${API}/profile`)
        .set(auth)
        .send({
          firstName: "Jane",
          lastName: "Doe",
          role: "admin",
          email: "other@oc.edu",
          isApprovedDriver: true,
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("requestor");
      expect(await db.user.findByPk(user.id)).toMatchObject({
        role: "requestor",
        email: user.email,
        isApprovedDriver: false,
        isActive: true,
      });
    });

    it("rejects a whitespace-only first name, a missing last name, and a long phone", async () => {
      const { auth } = await signInAs("requestor");

      const first = await request(app)
        .put(`${API}/profile`)
        .set(auth)
        .send({ firstName: "   ", lastName: "Doe" });
      expect(first.status).toBe(400);
      expect(first.body).toEqual({ message: "First name is required." });

      const last = await request(app).put(`${API}/profile`).set(auth).send({ firstName: "Jane" });
      expect(last.status).toBe(400);
      expect(last.body).toEqual({ message: "Last name is required." });

      const phone = await request(app)
        .put(`${API}/profile`)
        .set(auth)
        .send({ firstName: "Jane", lastName: "Doe", phone: "1".repeat(21) });
      expect(phone.status).toBe(400);
      expect(phone.body).toEqual({ message: "Phone must be 20 characters or fewer." });

      const longName = await request(app)
        .put(`${API}/profile`)
        .set(auth)
        .send({ firstName: "J".repeat(101), lastName: "Doe" });
      expect(longName.status).toBe(400);
    });
  });
});
