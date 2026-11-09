/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import {
  syncTestDatabase,
  createUser,
  signInAs,
  mockGoogleAccount,
  mockGoogleFailure,
} from "./helpers.js";

const API = "/vehicle-t2";

beforeEach(async () => {
  await syncTestDatabase();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.1 — Sign in with Google", () => {
    it("User signs in with a valid OC Google account", async () => {
      await createUser({ email: "jdoe@oc.edu", firstName: "Jane", lastName: "Doe" });
      mockGoogleAccount({ sub: "google-jdoe", email: "jdoe@oc.edu" });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        email: "jdoe@oc.edu",
        firstName: "Jane",
        lastName: "Doe",
        role: "requestor",
      });
      expect(res.body.userId).toEqual(expect.any(Number));
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty("googleId");

      const sessions = await db.session.findAll({ where: { userId: res.body.userId } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].token).toBe(res.body.token);

      const again = await request(app).post(`${API}/login`).send({ credential: "valid" });
      expect(again.body.token).toBe(res.body.token);
      expect(await db.session.count()).toBe(1);
    });

    it("User signs in with a non-OC Google account", async () => {
      mockGoogleAccount({ sub: "google-gmail", email: "someone@gmail.com" });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: "Sign in with your OC Google account." });
      expect(await db.user.count({ where: { email: "someone@gmail.com" } })).toBe(0);
    });

    it("rejects a lookalike domain such as notoc.edu", async () => {
      mockGoogleAccount({ sub: "google-fake", email: "someone@notoc.edu" });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(403);
      expect(await db.user.count()).toBe(0);
    });

    it("User signs in with an invalid Google credential", async () => {
      mockGoogleFailure();

      const res = await request(app).post(`${API}/login`).send({ credential: "forged" });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Google sign-in failed." });
    });

    it("returns 401 when the credential is missing", async () => {
      const verify = mockGoogleFailure();

      const res = await request(app).post(`${API}/login`).send({});

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Google sign-in failed." });
      expect(verify).not.toHaveBeenCalled();
    });

    it("Deactivated user cannot sign in", async () => {
      await createUser({ email: "former@oc.edu", isActive: false });
      mockGoogleAccount({ sub: "google-former", email: "former@oc.edu" });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: "Your account has been deactivated." });
      expect(await db.session.count()).toBe(0);
    });
  });

  describe("US-1.2 — Create my account on first sign-in", () => {
    it("First-time user gets a requestor account", async () => {
      mockGoogleAccount({
        sub: "google-new",
        email: "newuser@oc.edu",
        givenName: "New",
        familyName: "User",
      });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("requestor");

      const row = await db.user.unscoped().findOne({ where: { email: "newuser@oc.edu" } });
      expect(row).toMatchObject({
        firstName: "New",
        lastName: "User",
        isApprovedDriver: false,
        isActive: true,
        googleId: "google-new",
      });
    });

    it("Seeded user is linked on first Google sign-in", async () => {
      await createUser({ email: "areaadmin@oc.edu", role: "area_admin" });
      mockGoogleAccount({ sub: "google-areaadmin", email: "AreaAdmin@oc.edu" });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("area_admin");

      const rows = await db.user.unscoped().findAll({ where: { email: "areaadmin@oc.edu" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].googleId).toBe("google-areaadmin");
    });

    it("Returning user keeps their role", async () => {
      const admin = await createUser({ email: "boss@oc.edu", role: "admin", googleId: "google-boss" });
      mockGoogleAccount({ sub: "google-boss", email: "boss@oc.edu" });

      const res = await request(app).post(`${API}/login`).send({ credential: "valid" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("admin");
      expect((await db.user.findByPk(admin.id)).role).toBe("admin");
    });
  });

  describe("US-1.3 — Sign out", () => {
    it("User signs out", async () => {
      const { token, auth } = await signInAs("requestor");

      const res = await request(app).post(`${API}/logout`).set(auth);
      expect(res.status).toBe(200);

      expect(await db.session.count({ where: { token } })).toBe(0);
      const after = await request(app).get(`${API}/profile`).set(auth);
      expect(after.status).toBe(401);
    });
  });
});
