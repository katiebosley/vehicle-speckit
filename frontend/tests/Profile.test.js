/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 * Feature 4 — Making and Tracking Requests (US-4.8)
 * Spec: features/feature-4-making-and-tracking-requests.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";

vi.mock("../src/services/profileServices.js", () => ({
  default: { getProfile: vi.fn(), updateProfile: vi.fn(), updateTestRole: vi.fn() },
}));

import profileServices from "../src/services/profileServices.js";
import Utils from "../src/config/utils.js";
import Profile from "../src/views/Profile.vue";
import { mountWithPlugins } from "./testUtils.js";

const PROFILE = {
  id: 7,
  email: "jdoe@oc.edu",
  firstName: "Jane",
  lastName: "Doe",
  phone: "405-555-0142",
  role: "requestor",
  isApprovedDriver: false,
  licenseExpiration: null,
  isActive: true,
};

async function mountProfile(profile = PROFILE) {
  profileServices.getProfile.mockResolvedValue({ data: profile });
  const { wrapper } = await mountWithPlugins(Profile);
  await flushPromises();
  return wrapper;
}

const input = (wrapper, name) => wrapper.find(`[data-test='${name}'] input`);

async function submit(wrapper) {
  await wrapper.find("form").trigger("submit");
  await flushPromises();
}

beforeEach(() => {
  localStorage.clear();
  Utils.setStore("user", {
    userId: 7,
    firstName: "Jane",
    lastName: "Doe",
    role: "requestor",
    token: "session-token",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.8 — View and edit my profile", () => {
    it("User opens their profile", async () => {
      const wrapper = await mountProfile();

      expect(wrapper.find("h1").text()).toBe("My Profile");
      expect(input(wrapper, "first-name").element.value).toBe("Jane");
      expect(input(wrapper, "last-name").element.value).toBe("Doe");
      expect(input(wrapper, "phone").element.value).toBe("405-555-0142");
      expect(input(wrapper, "email").element.value).toBe("jdoe@oc.edu");
      expect(input(wrapper, "role").element.value).toBe("Requestor");
      expect(input(wrapper, "email").attributes("readonly")).toBeDefined();
      expect(input(wrapper, "role").attributes("readonly")).toBeDefined();
      expect(input(wrapper, "first-name").attributes("readonly")).toBeUndefined();
      expect(wrapper.find("[data-test='admin-toggle']").exists()).toBe(true);
    });

    it("User updates their name and phone", async () => {
      const wrapper = await mountProfile();
      profileServices.updateProfile.mockResolvedValue({
        data: { ...PROFILE, firstName: "Janet", phone: "405-555-0199" },
      });
      const userChanged = vi.fn();
      window.addEventListener("user-changed", userChanged);

      await input(wrapper, "first-name").setValue("Janet");
      await input(wrapper, "phone").setValue("405-555-0199");
      await submit(wrapper);

      window.removeEventListener("user-changed", userChanged);
      expect(profileServices.updateProfile).toHaveBeenCalledWith({
        firstName: "Janet",
        lastName: "Doe",
        phone: "405-555-0199",
      });
      expect(Utils.getStore("user")).toMatchObject({ firstName: "Janet", token: "session-token" });
      expect(userChanged).toHaveBeenCalled();
      expect(wrapper.find(".v-alert").text()).toContain("Profile saved.");
    });

    it("User saves profile with a missing first name", async () => {
      const wrapper = await mountProfile();

      await input(wrapper, "first-name").setValue("   ");
      await submit(wrapper);

      expect(profileServices.updateProfile).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain("Required");
    });

    it("User saves profile with a phone that is too long", async () => {
      const wrapper = await mountProfile();

      await input(wrapper, "phone").setValue("1".repeat(21));
      await submit(wrapper);

      expect(profileServices.updateProfile).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain("Phone must be 20 characters or fewer.");
    });

    it("shows the server error when saving fails", async () => {
      const wrapper = await mountProfile();
      profileServices.updateProfile.mockRejectedValue({
        response: { status: 400, data: { message: "First name is required." } },
      });

      await submit(wrapper);

      expect(wrapper.find(".v-alert").text()).toContain("First name is required.");
      expect(Utils.getStore("user").firstName).toBe("Jane");
    });
  });
});

describe("Feature 4 — Making and Tracking Requests", () => {
  describe("US-4.8 — Toggle admin role for testing", () => {
    it("Requestor switches to admin via profile toggle", async () => {
      const wrapper = await mountProfile();
      profileServices.updateTestRole.mockResolvedValue({
        data: { ...PROFILE, role: "admin" },
      });
      const userChanged = vi.fn();
      window.addEventListener("user-changed", userChanged);

      await input(wrapper, "admin-toggle").setValue(true);
      await flushPromises();

      window.removeEventListener("user-changed", userChanged);
      expect(profileServices.updateTestRole).toHaveBeenCalledWith({ role: "admin" });
      expect(input(wrapper, "role").element.value).toBe("Admin");
      expect(Utils.getStore("user").role).toBe("admin");
      expect(userChanged).toHaveBeenCalled();
    });

    it("Admin switches to requestor via profile toggle", async () => {
      Utils.setStore("user", {
        userId: 7,
        firstName: "Jane",
        lastName: "Doe",
        role: "admin",
        token: "session-token",
      });
      const wrapper = await mountProfile({ ...PROFILE, role: "admin" });
      profileServices.updateTestRole.mockResolvedValue({
        data: { ...PROFILE, role: "requestor" },
      });

      await input(wrapper, "admin-toggle").setValue(false);
      await flushPromises();

      expect(profileServices.updateTestRole).toHaveBeenCalledWith({ role: "requestor" });
      expect(input(wrapper, "role").element.value).toBe("Requestor");
      expect(Utils.getStore("user").role).toBe("requestor");
    });
  });
});
