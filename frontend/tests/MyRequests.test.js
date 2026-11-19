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
import MyRequests from "../src/views/MyRequests.vue";
import { mountWithPlugins } from "./testUtils.js";

async function mountList() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/my-requests", name: "my-requests", component: MyRequests },
      { path: "/my-requests/new", name: "request-new", component: { template: "<div />" } },
      { path: "/my-requests/:id", name: "request-detail", component: { template: "<div />" } },
    ],
  });
  await router.push("/my-requests");
  await router.isReady();
  const { wrapper } = await mountWithPlugins(MyRequests, { router });
  await flushPromises();
  return wrapper;
}

describe("Feature 4 — Making and Tracking Requests", () => {
  beforeEach(() => {
    requestServices.list.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("US-4.3 — List my requests", () => {
    it("Empty my requests list", async () => {
      const wrapper = await mountList();

      expect(wrapper.find("h1").text()).toBe("My Requests");
      expect(wrapper.text()).toContain("No requests yet. Create your first request.");
      expect(requestServices.list).toHaveBeenCalledTimes(1);
    });
  });
});
