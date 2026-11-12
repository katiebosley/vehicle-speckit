/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { routes, authGuard } from "../src/router.js";
import Utils from "../src/config/utils.js";

function freshRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.beforeEach(authGuard);
  return router;
}

function signInAs(role) {
  Utils.setStore("user", { userId: 1, role, token: "session-token" });
}

beforeEach(() => {
  localStorage.clear();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.1 — Sign in with Google", () => {
    it("Signed-in user visits login page", async () => {
      signInAs("requestor");
      const router = freshRouter();

      await router.push("/login");

      expect(router.currentRoute.value.name).toBe("home");
    });
  });

  describe("US-1.4 — Role-based menus and API access", () => {
    it("Unauthenticated user accesses a protected route", async () => {
      const router = freshRouter();

      await router.push("/");
      expect(router.currentRoute.value.name).toBe("login");

      await router.push("/profile");
      expect(router.currentRoute.value.name).toBe("login");
    });

    it("Requestor navigates to an admin-only route", async () => {
      signInAs("requestor");
      const router = freshRouter();

      await router.push("/users");

      expect(router.currentRoute.value.name).toBe("home");
    });

    it("area admin is also redirected away from the admin-only route", async () => {
      signInAs("area_admin");
      const router = freshRouter();

      await router.push("/users");

      expect(router.currentRoute.value.name).toBe("home");
    });

    it("admin can open the users route", async () => {
      signInAs("admin");
      const router = freshRouter();

      await router.push("/users");

      expect(router.currentRoute.value.name).toBe("users");
    });
  });
});
