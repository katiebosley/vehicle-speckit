/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginUser: vi.fn(), logoutUser: vi.fn() },
}));

import authServices from "../src/services/authServices.js";
import Utils from "../src/config/utils.js";
import Login from "../src/views/Login.vue";
import { mountWithPlugins, createTestRouter } from "./testUtils.js";

let googleCallback;

async function mountLogin() {
  const router = await createTestRouter("/login");
  const { wrapper } = await mountWithPlugins(Login, { router });
  await flushPromises();
  return { wrapper, router };
}

beforeEach(() => {
  localStorage.clear();
  googleCallback = undefined;
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn(({ callback }) => {
          googleCallback = callback;
        }),
        renderButton: vi.fn(),
        disableAutoSelect: vi.fn(),
      },
    },
  };
});

afterEach(() => {
  delete window.google;
  vi.clearAllMocks();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.1 — Sign in with Google", () => {
    it("User signs in with a valid OC Google account", async () => {
      const session = {
        userId: 7,
        email: "jdoe@oc.edu",
        firstName: "Jane",
        lastName: "Doe",
        role: "requestor",
        isApprovedDriver: false,
        token: "session-token",
      };
      authServices.loginUser.mockResolvedValue({ data: session });

      const { wrapper, router } = await mountLogin();

      expect(window.google.accounts.id.renderButton).toHaveBeenCalledWith(
        wrapper.find("[data-test='google-button']").element,
        expect.any(Object)
      );
      expect(wrapper.text()).toContain("OC Vehicle Scheduling");
      expect(wrapper.find("input[type='password']").exists()).toBe(false);

      await googleCallback({ credential: "google-id-token" });
      await flushPromises();

      expect(authServices.loginUser).toHaveBeenCalledWith("google-id-token");
      expect(Utils.getStore("user")).toEqual(session);
      expect(router.currentRoute.value.name).toBe("home");
    });

    it("User signs in with an invalid Google credential", async () => {
      authServices.loginUser.mockRejectedValue({
        response: { status: 401, data: { message: "Google sign-in failed." } },
      });

      const { wrapper, router } = await mountLogin();
      await googleCallback({ credential: "forged-token" });
      await flushPromises();

      const alert = wrapper.find(".v-alert");
      expect(alert.exists()).toBe(true);
      expect(alert.text()).toContain("Google sign-in failed.");
      expect(Utils.getStore("user")).toBeNull();
      expect(router.currentRoute.value.name).toBe("login");
    });

    it("shows the 403 message for a non-OC or deactivated account", async () => {
      authServices.loginUser.mockRejectedValue({
        response: { status: 403, data: { message: "Sign in with your OC Google account." } },
      });

      const { wrapper } = await mountLogin();
      await googleCallback({ credential: "gmail-token" });
      await flushPromises();

      expect(wrapper.find(".v-alert").text()).toContain("Sign in with your OC Google account.");
    });

    it("shows a progress indicator while sign-in is in flight", async () => {
      let finish;
      authServices.loginUser.mockReturnValue(new Promise((resolve) => (finish = resolve)));

      const { wrapper } = await mountLogin();
      googleCallback({ credential: "google-id-token" });
      await wrapper.vm.$nextTick();

      expect(wrapper.find("[data-test='login-loading']").exists()).toBe(true);

      finish({ data: { token: "t", role: "requestor" } });
      await flushPromises();
      expect(wrapper.find("[data-test='login-loading']").exists()).toBe(false);
    });

    it("sends no request and shows no error when the Google popup is closed", async () => {
      const { wrapper } = await mountLogin();

      await googleCallback({});
      await flushPromises();

      expect(authServices.loginUser).not.toHaveBeenCalled();
      expect(wrapper.find(".v-alert").exists()).toBe(false);
    });
  });
});
