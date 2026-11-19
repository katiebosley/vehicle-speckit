/**
 * Feature 6 — Schedule Calendar, Trip Logs & Dashboard
 * Spec: features/feature-6-schedule-calendar-trip-logs-dashboard.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import Home from "../src/views/Home.vue";
import scheduleServices from "../src/services/scheduleServices.js";
import Utils from "../src/config/utils.js";
import { mountWithPlugins } from "./testUtils.js";

vi.mock("../src/services/scheduleServices.js", () => ({
  default: { dashboard: vi.fn(), checkout: vi.fn(), checkin: vi.fn() },
}));

describe("Feature 6 — Schedule Calendar, Trip Logs & Dashboard", () => {
  let wrapper;

  beforeEach(() => {
    localStorage.clear();
    Utils.setStore("user", { userId: 4, firstName: "Riley", lastName: "Cole", role: "requestor", token: "t" });
    scheduleServices.dashboard.mockResolvedValue({
      data: { role: "requestor", pendingRequests: [], upcomingTrips: [] },
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("US-6.3 — Requestor home dashboard", () => {
    it("Requestor home empty states", async () => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: "/", name: "home", component: Home },
          { path: "/my-requests/new", name: "request-new", component: { template: "<div />" } },
          { path: "/my-requests/:id", name: "request-detail", component: { template: "<div />" } },
        ],
      });
      await router.push("/");
      await router.isReady();
      ({ wrapper } = await mountWithPlugins(Home, { router }));
      await flushPromises();

      expect(wrapper.text()).toContain("Welcome, Riley");
      expect(wrapper.text()).toContain("No pending requests.");
      expect(wrapper.text()).toContain("No upcoming trips.");
      expect(scheduleServices.dashboard).toHaveBeenCalledTimes(1);
    });
  });
});