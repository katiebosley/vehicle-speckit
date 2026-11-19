/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Spec: features/feature-2-areas-area-admins-deploy.md
 */
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyAreas from "../src/views/MyAreas.vue";
import areaServices from "../src/services/areaServices.js";
import { mountWithPlugins } from "./testUtils.js";

vi.mock("../src/services/areaServices.js", () => ({
  default: {
    getAreas: vi.fn(),
    getMyAreas: vi.fn(),
    createArea: vi.fn(),
    updateArea: vi.fn(),
    assignAdmin: vi.fn(),
    removeAdmin: vi.fn(),
  },
}));

describe("Feature 2 — Areas, Area Admins & Deployment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("US-2.4 — See the areas I manage", () => {
    it("Area admin opens My Areas", async () => {
      areaServices.getMyAreas.mockResolvedValue({ data: [] });
      const { wrapper } = await mountWithPlugins(MyAreas);
      await flushPromises();
      expect(wrapper.text()).toContain("My Areas");
      wrapper.unmount();
    });

    it("Area admin sees only the areas they manage", async () => {
      areaServices.getMyAreas.mockResolvedValue({
        data: [
          { id: 2, name: "Maintenance", description: "Trucks", isActive: true },
          { id: 3, name: "Support Central", description: "Carts", isActive: true },
        ],
      });
      const { wrapper } = await mountWithPlugins(MyAreas);
      await flushPromises();
      expect(wrapper.text()).toContain("Maintenance");
      expect(wrapper.text()).toContain("Support Central");
      expect(wrapper.text()).not.toContain("Athletics");
      wrapper.unmount();
    });

    it("Area admin with no areas sees empty copy", async () => {
      areaServices.getMyAreas.mockResolvedValue({ data: [] });
      const { wrapper } = await mountWithPlugins(MyAreas);
      await flushPromises();
      expect(wrapper.text()).toContain("You are not assigned to any areas yet.");
      wrapper.unmount();
    });
  });
});