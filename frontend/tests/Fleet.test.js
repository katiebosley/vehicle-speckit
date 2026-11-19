import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, DOMWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "../src/App.vue";
import Fleet from "../src/views/Fleet.vue";
import router from "../src/router.js";
import vehicleServices from "../src/services/vehicleServices.js";
import areaServices from "../src/services/areaServices.js";
import vehicleTypeServices from "../src/services/vehicleTypeServices.js";
import { mountWithPlugins } from "./testUtils.js";

vi.mock("../src/services/vehicleServices.js", () => ({
  default: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
  },
}));

vi.mock("../src/services/areaServices.js", () => ({
  default: {
    list: vi.fn(),
    mine: vi.fn(),
  },
}));

vi.mock("../src/services/vehicleTypeServices.js", () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

async function mountFleet() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: { template: "<div>Home</div>" } },
      { path: "/fleet", name: "fleet", component: Fleet },
    ],
  });
  await router.push("/fleet");
  await router.isReady();
  return mountWithPlugins(Fleet, { router, attachTo: document.body });
}

function bodyButton(text) {
  const button = [...document.body.querySelectorAll("button")].find((node) => node.textContent.trim() === text);
  return button ? new DOMWrapper(button) : null;
}

describe("Feature 3 — Fleet Management", () => {
  describe("US-3.3 — Add and edit vehicles in my areas", () => {
    let wrapper;

    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.setItem("user", JSON.stringify({ role: "admin", firstName: "Ada", token: "t" }));
      vehicleServices.list.mockResolvedValue({ data: [] });
      areaServices.list.mockResolvedValue({ data: [] });
      areaServices.mine.mockResolvedValue({ data: [] });
      vehicleTypeServices.list.mockResolvedValue({ data: [] });
    });

    afterEach(() => {
      wrapper?.unmount();
      document.body.innerHTML = "";
      localStorage.clear();
    });

    it("Create with a missing required field", async () => {
      ({ wrapper } = await mountFleet());
      await flushPromises();

      const open = wrapper.findAll("button").find((button) => button.text().includes("New vehicle"));
      await open.trigger("click");
      await flushPromises();
      await bodyButton("Create").trigger("click");
      await flushPromises();

      expect(document.body.textContent).toContain("Required");
      expect(vehicleServices.create).not.toHaveBeenCalled();
    });

    it("Cancel editing a vehicle", async () => {
      vehicleServices.list.mockResolvedValue({
        data: [
          {
            id: 10,
            areaId: 1,
            areaName: "Athletics",
            vehicleTypeId: 3,
            vehicleTypeName: "Van",
            name: null,
            displayName: "2022 Ford Transit",
            make: "Ford",
            model: "Transit",
            year: 2022,
            vin: "1FTBW2CM5NKA12345",
            purchasedDate: "2022-08-15",
            color: "White",
            capacity: 12,
            licensePlate: "ATH-101",
            licensePlateExpireMonth: 6,
            currentMileage: 18420,
            status: "available",
          },
        ],
      });

      ({ wrapper } = await mountFleet());
      await flushPromises();

      await wrapper.get("[aria-label='Edit vehicle']").trigger("click");
      await flushPromises();
      const color = [...document.body.querySelectorAll("input")].find((input) => input.closest(".v-input")?.textContent.includes("Color"));
      await new DOMWrapper(color).setValue("red");
      await bodyButton("Cancel").trigger("click");
      await flushPromises();

      expect(vehicleServices.update).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain("2022 Ford Transit");
    });
  });

  describe("US-3.4 — See only vehicles for my areas", () => {
    let wrapper;

    beforeEach(() => {
      vi.clearAllMocks();
      areaServices.list.mockResolvedValue({ data: [] });
      areaServices.mine.mockResolvedValue({ data: [{ id: 1, name: "Athletics", isActive: true }] });
      vehicleTypeServices.list.mockResolvedValue({ data: [] });
    });

    afterEach(() => {
      wrapper?.unmount();
      document.body.innerHTML = "";
      localStorage.clear();
    });

    it("Area admin sees only vehicles in managed areas", async () => {
      localStorage.setItem("user", JSON.stringify({ role: "area_admin", firstName: "Sam", token: "t" }));
      vehicleServices.list.mockResolvedValue({
        data: [
          {
            id: 1,
            displayName: "2022 Ford Transit",
            licensePlate: "ATH-101",
            vehicleTypeName: "Van",
            areaName: "Athletics",
            capacity: 12,
            currentMileage: 100,
            status: "available",
          },
        ],
      });

      ({ wrapper } = await mountFleet());
      await flushPromises();

      expect(wrapper.text()).toContain("Athletics");
      expect(wrapper.text()).not.toContain("Support Central");
    });

    it("Admin sees vehicles in every area", async () => {
      localStorage.setItem("user", JSON.stringify({ role: "admin", firstName: "Ada", token: "t" }));
      vehicleServices.list.mockResolvedValue({
        data: [
          {
            id: 1,
            displayName: "Athletics Van",
            licensePlate: "ATH-101",
            vehicleTypeName: "Van",
            areaName: "Athletics",
            capacity: 12,
            currentMileage: 100,
            status: "available",
          },
          {
            id: 2,
            displayName: "Support Truck",
            licensePlate: "SUP-101",
            vehicleTypeName: "Truck",
            areaName: "Support Central",
            capacity: 3,
            currentMileage: 50,
            status: "available",
          },
        ],
      });

      ({ wrapper } = await mountFleet());
      await flushPromises();

      expect(wrapper.text()).toContain("Athletics");
      expect(wrapper.text()).toContain("Support Central");
    });

    it("Requestor cannot list vehicles", async () => {
      localStorage.setItem("user", JSON.stringify({ role: "requestor", firstName: "Pat", token: "t" }));
      await router.push("/");
      ({ wrapper } = await mountWithPlugins(App, { router, attachTo: document.body }));
      await router.push("/fleet");
      await flushPromises();

      expect(wrapper.text()).not.toContain("Fleet");
      expect(router.currentRoute.value.name).toBe("home");
    });
  });
});
