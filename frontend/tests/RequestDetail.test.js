/**
 * Feature 4 — Making and Tracking Requests
 * Spec: features/feature-4-making-and-tracking-requests.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";

vi.mock("../src/services/requestServices.js", () => ({
  default: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn() },
}));

import requestServices from "../src/services/requestServices.js";
import RequestDetail from "../src/views/RequestDetail.vue";
import { mountWithPlugins } from "./testUtils.js";

const PENDING = {
  id: 10,
  requesterId: 42,
  areaId: 1,
  areaName: "Athletics",
  vehicleTypeId: 2,
  vehicleTypeName: "Van",
  vehiclesNeeded: 1,
  passengerCount: 12,
  purpose: "Field trip to museum",
  destination: "Downtown Museum",
  departureAt: "2027-12-01T15:00:00.000Z",
  returnAt: "2027-12-01T21:00:00.000Z",
  status: "pending",
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: null,
  reviewer: null,
  assignments: [],
};

async function mountDetail() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/my-requests/:id", name: "request-detail", component: RequestDetail, props: true },
      { path: "/my-requests/:id/edit", name: "request-edit", component: { template: "<div />" } },
    ],
  });
  await router.push("/my-requests/10");
  await router.isReady();
  const { wrapper } = await mountWithPlugins(RequestDetail, {
    router,
    props: { id: "10" },
  });
  await flushPromises();
  return wrapper;
}

describe("Feature 4 — Making and Tracking Requests", () => {
  beforeEach(() => {
    requestServices.get.mockResolvedValue({ data: PENDING });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("US-4.4 — View request detail", () => {
    it("Requestor views request detail with no review or assignments yet", async () => {
      const wrapper = await mountDetail();

      expect(wrapper.text()).toContain("Field trip to museum");
      expect(wrapper.text()).toContain("Downtown Museum");
      expect(wrapper.text()).toContain("Athletics");
      expect(wrapper.text()).toContain("Vehicle type:");
      expect(wrapper.text()).toContain("Van");
      expect(wrapper.text()).toMatch(/Passengers:\s*12/);
      expect(wrapper.text()).toMatch(/Vehicles needed:\s*1/);
      expect(wrapper.text()).toContain("Status:");
      expect(wrapper.text()).toContain("pending");
      expect(wrapper.text()).toContain("No review notes yet.");
      expect(wrapper.text()).toContain("No vehicles assigned yet.");
      expect(requestServices.get).toHaveBeenCalledWith("10");
    });
  });
});
