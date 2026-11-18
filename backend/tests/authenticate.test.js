/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, createUser, createSession, signInAs } from "./helpers.js";

const API = "/vehicle-t2";

beforeEach(async () => {
  await syncTestDatabase();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.1 — Sign in with Google", () => {
    it("API request includes session token", async () => {
      const { user, auth } = await signInAs("requestor", { email: "jdoe@oc.edu" });

      const res = await request(app).get(`${API}/profile`).set(auth);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user.id);
      expect(res.body.email).toBe("jdoe@oc.edu");
    });

    it("Expired or invalid session token", async () => {
      const user = await createUser();
      const expiredToken = await createSession(user, { expired: true });

      const expired = await request(app)
        .get(`${API}/profile`)
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(expired.status).toBe(401);
      expect(expired.body.message).toMatch(/Unauthorized/);

      const unknown = await request(app)
        .get(`${API}/profile`)
        .set("Authorization", "Bearer not-a-real-token");
      expect(unknown.status).toBe(401);
      expect(unknown.body.message).toMatch(/Unauthorized/);
    });
  });

  describe("US-1.4 — Role-based menus and API access", () => {
    it("Unauthenticated API request", async () => {
      const res = await request(app).get(`${API}/profile`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });

    it("rejects a non-Bearer authorization header", async () => {
      const { token } = await signInAs("requestor");

      const res = await request(app).get(`${API}/profile`).set("Authorization", `Basic ${token}`);

      expect(res.status).toBe(401);
    });

    it("Deactivated user's existing session is rejected", async () => {
      const { user, auth } = await signInAs("requestor");
      await user.update({ isActive: false });

      const res = await request(app).get(`${API}/profile`).set(auth);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unauthorized/);
    });
  });
});
