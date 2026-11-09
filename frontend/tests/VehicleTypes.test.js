import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, DOMWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import VehicleTypes from "../src/views/VehicleTypes.vue";
import vehicleTypeServices from "../src/services/vehicleTypeServices.js";
import { mountWithPlugins } from "./testUtils.js";

vi.mock("../src/services/vehicleTypeServices.js", () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

async function mountTypes() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div>Home</div>" } },
      { path: "/vehicle-types", name: "vehicle-types", component: VehicleTypes },
    ],
  });
  await router.push("/vehicle-types");
  await router.isReady();
  return mountWithPlugins(VehicleTypes, { router, attachTo: document.body });
}

function bodyButton(text) {
  const button = [...document.body.querySelectorAll("button")].find((node) => node.textContent.trim() === text);
  return button ? new DOMWrapper(button) : null;
}

describe("Feature 3 — Fleet Management", () => {
  describe("US-3.1 — Add, edit, and deactivate vehicle types", () => {
    let wrapper;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      wrapper?.unmount();
      document.body.innerHTML = "";
    });

    it("Admin views all vehicle types", async () => {
      vehicleTypeServices.list.mockResolvedValue({
        data: [
          { id: 2, name: "Bus", description: null, defaultPassengerCapacity: null, isActive: false },
          { id: 1, name: "Van", description: "Passenger vans", defaultPassengerCapacity: 12, isActive: true },
        ],
      });

      ({ wrapper } = await mountTypes());
      await flushPromises();

      expect(wrapper.text()).toContain("Bus");
      expect(wrapper.text()).toContain("Van");
      expect(wrapper.text()).toContain("Inactive");
      expect(wrapper.text()).toContain("Active");
    });

    it("Admin has no vehicle types", async () => {
      vehicleTypeServices.list.mockResolvedValue({ data: [] });

      ({ wrapper } = await mountTypes());
      await flushPromises();

      expect(wrapper.text()).toContain("No vehicle types yet. Create your first type.");
    });

    it("Admin creates a vehicle type with a missing name", async () => {
      vehicleTypeServices.list.mockResolvedValue({ data: [] });
      ({ wrapper } = await mountTypes());
      await flushPromises();

      await wrapper.get("button").trigger("click");
      await flushPromises();
      const create = bodyButton("Create");
      await create.trigger("click");
      await flushPromises();

      expect(document.body.textContent).toContain("Required");
      expect(vehicleTypeServices.create).not.toHaveBeenCalled();
    });

    it("Admin creates a duplicate vehicle type", async () => {
      vehicleTypeServices.list.mockResolvedValue({ data: [] });
      vehicleTypeServices.create.mockRejectedValue({
        response: { data: { message: "Vehicle type name is already taken." } },
      });

      ({ wrapper } = await mountTypes());
      await flushPromises();

      await wrapper.get("button").trigger("click");
      await flushPromises();
      const name = new DOMWrapper(document.body.querySelector("input"));
      await name.setValue("van");
      const create = bodyButton("Create");
      await create.trigger("click");
      await flushPromises();

      expect(document.body.textContent).toContain("Vehicle type name is already taken.");
    });
  });
});
