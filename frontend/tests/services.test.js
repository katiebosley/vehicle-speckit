/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import apiClient from "../src/services/services.js";
import router from "../src/router.js";
import Utils from "../src/config/utils.js";

const originalAdapter = apiClient.defaults.adapter;
let lastRequest;

function respondWith(status, data) {
  apiClient.defaults.adapter = async (config) => {
    lastRequest = config;
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status ${status}`), { response, config });
    }
    return response;
  };
}

beforeEach(() => {
  localStorage.clear();
  lastRequest = undefined;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.1 — Sign in with Google", () => {
    it("API request includes session token", async () => {
      Utils.setStore("user", { userId: 1, role: "requestor", token: "session-token" });
      respondWith(200, { id: 1 });

      await apiClient.get("profile");

      expect(lastRequest.headers.Authorization).toBe("Bearer session-token");
    });

    it("sends no Authorization header when signed out", async () => {
      respondWith(200, {});

      await apiClient.get("profile");

      expect(lastRequest.headers.Authorization).toBeUndefined();
    });

    it("Expired or invalid session token", async () => {
      Utils.setStore("user", { userId: 1, role: "requestor", token: "expired-token" });
      await router.push("/");
      respondWith(401, { message: "Unauthorized! Session is invalid or expired." });

      await expect(apiClient.get("profile")).rejects.toMatchObject({
        response: { status: 401 },
      });
      await flushPromises();

      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
    });
  });
});
