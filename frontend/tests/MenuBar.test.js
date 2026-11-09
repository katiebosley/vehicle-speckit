/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { VApp } from "vuetify/components";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginUser: vi.fn(), logoutUser: vi.fn() },
}));

import authServices from "../src/services/authServices.js";
import Utils from "../src/config/utils.js";
import MenuBar from "../src/components/MenuBar.vue";
import { vuetify } from "./testUtils.js";

const Blank = { render: () => null };

async function mountMenuBar(path = "/") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: Blank },
      { path: "/login", name: "login", component: Blank },
      { path: "/users", name: "users", component: Blank },
      { path: "/profile", name: "profile", component: Blank },
    ],
  });
  await router.push(path);
  await router.isReady();

  const wrapper = mount(
    { render: () => h(VApp, null, { default: () => h(MenuBar) }) },
    { global: { plugins: [vuetify, router] } }
  );
  await flushPromises();
  return { wrapper, router };
}

const labels = (wrapper) =>
  wrapper.findAll(".v-app-bar .v-btn").map((button) => button.text().trim());

const clickButton = async (wrapper, label) => {
  const button = wrapper.findAll(".v-app-bar .v-btn").find((b) => b.text().trim() === label);
  await button.trigger("click");
  await flushPromises();
};

function signInAs(role, overrides = {}) {
  Utils.setStore("user", {
    userId: 1,
    firstName: "Jane",
    lastName: "Doe",
    role,
    token: "session-token",
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
  window.google = { accounts: { id: { disableAutoSelect: vi.fn() } } };
});

afterEach(() => {
  delete window.google;
  vi.clearAllMocks();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.3 — Sign out", () => {
    it("User signs out", async () => {
      signInAs("requestor");
      authServices.logoutUser.mockResolvedValue({ data: {} });
      const { wrapper, router } = await mountMenuBar("/");

      await clickButton(wrapper, "Sign out");

      expect(authServices.logoutUser).toHaveBeenCalledTimes(1);
      expect(window.google.accounts.id.disableAutoSelect).toHaveBeenCalled();
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
      expect(wrapper.find(".v-app-bar").exists()).toBe(true);
      expect(labels(wrapper)).not.toContain("Sign out");
    });

    it("still clears the local session when the server logout fails", async () => {
      signInAs("requestor");
      authServices.logoutUser.mockRejectedValue(new Error("Network Error"));
      const { wrapper, router } = await mountMenuBar("/");

      await clickButton(wrapper, "Sign out");

      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
    });
  });

  describe("US-1.4 — Role-based menus and API access", () => {
    it("MenuBar is visible on the login page without nav items", async () => {
      const { wrapper } = await mountMenuBar("/login");

      expect(wrapper.find(".v-app-bar").exists()).toBe(true);
      expect(labels(wrapper)).toEqual([]);
      expect(wrapper.text()).not.toMatch(/Profile|Users|Sign out/);
    });

    it("Requestor does not see admin-only menu items", async () => {
      signInAs("requestor");
      const { wrapper } = await mountMenuBar("/");

      expect(labels(wrapper)).toEqual(["Profile", "Sign out"]);
      expect(wrapper.find("[data-test='user-name']").text()).toBe("Jane Doe");
    });

    it("area admin does not see Users either", async () => {
      signInAs("area_admin");
      const { wrapper } = await mountMenuBar("/");

      expect(labels(wrapper)).not.toContain("Users");
    });

    it("Admin sees Users in the menu", async () => {
      signInAs("admin");
      const { wrapper } = await mountMenuBar("/");

      expect(labels(wrapper)).toEqual(["Users", "Profile", "Sign out"]);
    });
  });

  describe("US-1.5 — View and search users", () => {
    it("Menu Selection", async () => {
      signInAs("admin");
      const { wrapper, router } = await mountMenuBar("/");

      await clickButton(wrapper, "Users");

      expect(router.currentRoute.value.name).toBe("users");
    });
  });

  describe("US-1.8 — View and edit my profile", () => {
    it("opens the profile view from the menu", async () => {
      signInAs("requestor");
      const { wrapper, router } = await mountMenuBar("/");

      await clickButton(wrapper, "Profile");

      expect(router.currentRoute.value.name).toBe("profile");
    });

    it("shows the new name after a profile save", async () => {
      signInAs("requestor");
      const { wrapper } = await mountMenuBar("/profile");

      signInAs("requestor", { firstName: "Janet" });
      window.dispatchEvent(new CustomEvent("user-changed"));
      await flushPromises();

      expect(wrapper.find("[data-test='user-name']").text()).toBe("Janet Doe");
    });
  });
});
