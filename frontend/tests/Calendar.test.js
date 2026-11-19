/**
 * Feature 6 — Schedule Calendar, Trip Logs & Dashboard
 * Spec: features/feature-6-schedule-calendar-trip-logs-dashboard.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import Calendar from "../src/views/Calendar.vue";
import scheduleServices from "../src/services/scheduleServices.js";
import areaServices from "../src/services/areaServices.js";
import vehicleServices from "../src/services/vehicleServices.js";
import Utils from "../src/config/utils.js";
import { mountWithPlugins } from "./testUtils.js";

vi.mock("../src/services/scheduleServices.js", () => ({
  default: { calendar: vi.fn(), checkout: vi.fn(), checkin: vi.fn() },
}));

vi.mock("../src/services/areaServices.js", () => ({
  default: { mine: vi.fn(), list: vi.fn() },
}));

vi.mock("../src/services/vehicleServices.js", () => ({
  default: { list: vi.fn() },
}));

const athletics = { assignmentId: 1, vehicleId: 5, vehicleName: "Van 2", driverId: 7, driverFirstName: "Alex", driverLastName: "Nguyen", departureAt: "2026-12-01T09:00:00.000Z", returnAt: "2026-12-01T15:00:00.000Z", areaId: 2 };
const maintenance = { assignmentId: 2, vehicleId: 8, vehicleName: "Bus 1", driverId: 9, driverFirstName: "Sam", driverLastName: "Lee", departureAt: "2026-12-02T09:00:00.000Z", returnAt: "2026-12-02T15:00:00.000Z", areaId: 3 };

describe("Feature 6 — Schedule Calendar, Trip Logs & Dashboard", () => {
  let wrapper;

  beforeEach(() => {
    localStorage.clear();
    Utils.setStore("user", { userId: 1, firstName: "Ada", lastName: "Admin", role: "admin", token: "t" });
    areaServices.mine.mockResolvedValue({
      data: [
        { id: 2, name: "Athletics" },
        { id: 3, name: "Maintenance" },
      ],
    });
    vehicleServices.list.mockResolvedValue({
      data: [
        { id: 5, name: "Van 2", areaId: 2 },
        { id: 8, name: "Bus 1", areaId: 3 },
      ],
    });
    scheduleServices.calendar.mockImplementation(async (params) => {
      if (Number(params.areaId) === 2 && Number(params.vehicleId) === 5) {
        return { data: [athletics] };
      }
      return { data: [athletics, maintenance] };
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("US-6.1 — Assignment calendar", () => {
    it("Admin filters calendar by area and vehicle", async () => {
      ({ wrapper } = await mountWithPlugins(Calendar));
      await flushPromises();

      expect(wrapper.text()).toContain("Van 2");
      expect(wrapper.text()).toContain("Bus 1");

      const selects = wrapper.findAllComponents({ name: "VSelect" });
      await selects[0].setValue(2);
      await flushPromises();
      await selects[1].setValue(5);
      await flushPromises();

      expect(scheduleServices.calendar).toHaveBeenCalledWith(expect.objectContaining({ areaId: 2, vehicleId: 5, view: "week" }));
      expect(wrapper.text()).toContain("Van 2");
      expect(wrapper.text()).toContain("Alex Nguyen");
      expect(wrapper.text()).not.toContain("Bus 1");
      expect(wrapper.text()).not.toContain("Sam Lee");
    });
  });
});
