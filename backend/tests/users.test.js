/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, createUser, createSession, signInAs, mockGoogleAccount } from "./helpers.js";

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
  describe("US-1.4 — Role-based menus and API access", () => {
    it("Requestor cannot call an admin-only API", async () => {
      const { auth } = await signInAs("requestor");

      const res = await request(app).get(`${API}/users`).set(auth);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: "You do not have permission for this action." });
    });

    it("Area admin cannot call an admin-only API", async () => {
      const target = await createUser({ role: "requestor" });
      const { auth } = await signInAs("area_admin");

      const put = await request(app)
        .put(`${API}/users/${target.id}`)
        .set(auth)
        .send({ role: "admin" });
      expect(put.status).toBe(403);
      expect(put.body).toEqual({ message: "You do not have permission for this action." });
      expect((await db.user.findByPk(target.id)).role).toBe("requestor");

      const list = await request(app).get(`${API}/users`).set(auth);
      expect(list.status).toBe(403);
      const one = await request(app).get(`${API}/users/${target.id}`).set(auth);
      expect(one.status).toBe(403);
    });

    it("returns 401 for /users without a session", async () => {
      const res = await request(app).get(`${API}/users`);
      expect(res.status).toBe(401);
    });
  });

  describe("US-1.5 — View and search users", () => {
    it("Admin views all users", async () => {
      const { auth } = await signInAs("admin", { firstName: "Zed", lastName: "Zulu" });
      await createUser({ firstName: "Ann", lastName: "Smith" });
      await createUser({ firstName: "Bob", lastName: "Jones" });
      await createUser({ firstName: "Cal", lastName: "Adams" });

      const res = await request(app).get(`${API}/users`).set(auth);

      expect(res.status).toBe(200);
      expect(res.body.map((u) => u.lastName)).toEqual(["Adams", "Jones", "Smith", "Zulu"]);
      expect(Object.keys(res.body[0])).toEqual(
        expect.arrayContaining([
          "id",
          "email",
          "firstName",
          "lastName",
          "phone",
          "role",
          "isApprovedDriver",
          "licenseExpiration",
          "isActive",
        ])
      );
      expect(res.body[0]).not.toHaveProperty("googleId");
    });

    it("Admin searches users by name or email", async () => {
      const { auth } = await signInAs("admin", { firstName: "Ada", lastName: "Admin" });
      await createUser({ firstName: "Ann", lastName: "Smith", email: "asmith@oc.edu" });
      await createUser({ firstName: "Bob", lastName: "Jones", email: "bjones@oc.edu" });

      const byName = await request(app).get(`${API}/users`).query({ search: "SMI" }).set(auth);
      expect(byName.status).toBe(200);
      expect(byName.body.map((u) => u.lastName)).toEqual(["Smith"]);

      const byEmail = await request(app)
        .get(`${API}/users`)
        .query({ search: "  bjones@  " })
        .set(auth);
      expect(byEmail.body.map((u) => u.lastName)).toEqual(["Jones"]);

      const blank = await request(app).get(`${API}/users`).query({ search: "   " }).set(auth);
      expect(blank.body).toHaveLength(3);

      const wildcard = await request(app).get(`${API}/users`).query({ search: "%" }).set(auth);
      expect(wildcard.body).toHaveLength(0);
    });

    it("returns one user by id and 404 for a non-integer id", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser({ firstName: "Bob", lastName: "Jones" });

      const one = await request(app).get(`${API}/users/${bob.id}`).set(auth);
      expect(one.status).toBe(200);
      expect(one.body.lastName).toBe("Jones");

      const abc = await request(app).get(`${API}/users/abc`).set(auth);
      expect(abc.status).toBe(404);
      expect(abc.body).toEqual({ message: "User with id=abc not found." });
    });
  });

  describe("US-1.6 — Change a user's role and deactivate a user", () => {
    it("Admin changes a user's role", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser({ firstName: "Bob", lastName: "Jones" });
      const bobToken = await createSession(bob);

      const res = await request(app)
        .put(`${API}/users/${bob.id}`)
        .set(auth)
        .send({ role: "area_admin", email: "hacked@oc.edu", firstName: "Hacked", googleId: "x" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("area_admin");
      expect(res.body.email).toBe(bob.email);
      expect(res.body.firstName).toBe("Bob");

      const bobList = await request(app)
        .get(`${API}/users`)
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobList.status).toBe(403);
      const bobProfile = await request(app)
        .get(`${API}/profile`)
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobProfile.body.role).toBe("area_admin");
    });

    it("Admin sets an invalid role", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser();

      const res = await request(app)
        .put(`${API}/users/${bob.id}`)
        .set(auth)
        .send({ role: "superuser" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Role must be admin, area_admin, or requestor." });
      expect((await db.user.findByPk(bob.id)).role).toBe("requestor");
    });

    it("Admin deactivates a user", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser({ email: "bob@oc.edu" });

      const res = await request(app)
        .put(`${API}/users/${bob.id}`)
        .set(auth)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);

      mockGoogleAccount({ sub: "google-bob", email: "bob@oc.edu" });
      const login = await request(app).post(`${API}/login`).send({ credential: "valid" });
      expect(login.status).toBe(403);
      expect(login.body).toEqual({ message: "Your account has been deactivated." });
    });

    it("Admin reactivates a user", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser({ email: "bob@oc.edu", isActive: false });

      const res = await request(app)
        .put(`${API}/users/${bob.id}`)
        .set(auth)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);

      mockGoogleAccount({ sub: "google-bob", email: "bob@oc.edu" });
      const login = await request(app).post(`${API}/login`).send({ credential: "valid" });
      expect(login.status).toBe(200);
    });

    it("Admin cannot change their own role or active status", async () => {
      const { user, auth } = await signInAs("admin");

      const role = await request(app)
        .put(`${API}/users/${user.id}`)
        .set(auth)
        .send({ role: "requestor" });
      expect(role.status).toBe(400);
      expect(role.body).toEqual({ message: "You cannot change your own role or active status." });

      const active = await request(app)
        .put(`${API}/users/${user.id}`)
        .set(auth)
        .send({ isActive: false });
      expect(active.status).toBe(400);

      expect(await db.user.findByPk(user.id)).toMatchObject({ role: "admin", isActive: true });

      const driver = await request(app)
        .put(`${API}/users/${user.id}`)
        .set(auth)
        .send({ role: "admin", isActive: true, isApprovedDriver: true, licenseExpiration: "2028-05-31" });
      expect(driver.status).toBe(200);
      expect(driver.body.isApprovedDriver).toBe(true);
    });

    it("Admin edits a user that does not exist", async () => {
      const { auth } = await signInAs("admin");

      const res = await request(app)
        .put(`${API}/users/99999`)
        .set(auth)
        .send({ role: "requestor" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "User with id=99999 not found." });
    });
  });

  describe("US-1.7 — Mark approved drivers", () => {
    it("Admin marks a user as an approved driver", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser();

      const res = await request(app)
        .put(`${API}/users/${bob.id}`)
        .set(auth)
        .send({ isApprovedDriver: true, licenseExpiration: "2028-05-31" });

      expect(res.status).toBe(200);
      expect(res.body.isApprovedDriver).toBe(true);
      expect(res.body.licenseExpiration).toBe("2028-05-31");
    });

    it("API rejects an approved driver without a license expiration", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser();

      for (const licenseExpiration of [null, "", "2028-02-30", "not-a-date"]) {
        const res = await request(app)
          .put(`${API}/users/${bob.id}`)
          .set(auth)
          .send({ isApprovedDriver: true, licenseExpiration });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "License expiration is required for approved drivers." });
      }
      expect((await db.user.findByPk(bob.id)).isApprovedDriver).toBe(false);
    });

    it("Admin removes approved driver status", async () => {
      const { auth } = await signInAs("admin");
      const bob = await createUser({ isApprovedDriver: true, licenseExpiration: "2028-05-31" });

      const res = await request(app)
        .put(`${API}/users/${bob.id}`)
        .set(auth)
        .send({ isApprovedDriver: false });

      expect(res.status).toBe(200);
      expect(res.body.isApprovedDriver).toBe(false);
      expect(res.body.licenseExpiration).toBe("2028-05-31");
    });
  });
});
