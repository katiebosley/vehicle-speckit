/**
 * Feature 2 — Areas, Area Admins & Deployment
 * Spec: features/feature-2-areas-area-admins-deploy.md
 */
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Areas from "../src/views/Areas.vue";
import areaServices from "../src/services/areaServices.js";
import userServices from "../src/services/userServices.js";
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

vi.mock("../src/services/userServices.js", () => ({
  default: {
    getUsers: vi.fn(),
    updateUser: vi.fn(),
  },
}));

async function mountAreas() {
  const mounted = await mountWithPlugins(Areas, { attachTo: document.body });
  await flushPromises();
  return mounted.wrapper;
}

function clickLabel(text) {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent.includes(text));
  button.click();
}

describe("Feature 2 — Areas, Area Admins & Deployment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  describe("US-2.1 — Add, edit and deactivate areas", () => {
    it("Menu Selection", async () => {
      areaServices.getAreas.mockResolvedValue({ data: [] });
      const wrapper = await mountAreas();
      expect(wrapper.text()).toContain("Areas");
      wrapper.unmount();
    });

    it("Admin views all areas", async () => {
      areaServices.getAreas.mockResolvedValue({
        data: [
          { id: 1, name: "Athletics", description: "Vans", isActive: false, admins: [] },
          { id: 2, name: "Support Central", description: "Carts", isActive: true, admins: [] },
        ],
      });

      const wrapper = await mountAreas();
      const text = wrapper.text();
      expect(text.indexOf("Athletics")).toBeLessThan(text.indexOf("Support Central"));
      expect(text).toContain("Inactive");
      wrapper.unmount();
    });

    it("Admin has no areas", async () => {
      areaServices.getAreas.mockResolvedValue({ data: [] });
      const wrapper = await mountAreas();
      expect(wrapper.text()).toContain("No areas yet. Create your first area.");
      wrapper.unmount();
    });

    it("Admin creates an area", async () => {
      areaServices.getAreas
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [{ id: 4, name: "Athletics", description: "Team vans and buses", isActive: true, admins: [] }],
        });
      areaServices.createArea.mockResolvedValue({ data: { id: 4 } });

      const wrapper = await mountAreas();
      clickLabel("+ New area");
      await flushPromises();
      await wrapper.findComponent({ name: "VTextField" }).setValue("Athletics");
      await wrapper.findComponent({ name: "VTextarea" }).setValue("Team vans and buses");
      clickLabel("Create");
      await flushPromises();

      expect(areaServices.createArea).toHaveBeenCalledWith({
        name: "Athletics",
        description: "Team vans and buses",
      });
      expect(wrapper.text()).toContain("Athletics");
      expect(wrapper.text()).not.toContain("Add Area");
      wrapper.unmount();
    });

    it("Admin creates an area with a missing name", async () => {
      areaServices.getAreas.mockResolvedValue({ data: [] });
      const wrapper = await mountAreas();
      clickLabel("+ New area");
      await flushPromises();
      clickLabel("Create");
      await flushPromises();

      expect(areaServices.createArea).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Required");
      wrapper.unmount();
    });

    it("Admin creates an area with a name that is too long", async () => {
      areaServices.getAreas.mockResolvedValue({ data: [] });
      const wrapper = await mountAreas();
      clickLabel("+ New area");
      await flushPromises();
      await wrapper.findComponent({ name: "VTextField" }).setValue("a".repeat(101));
      clickLabel("Create");
      await flushPromises();

      expect(areaServices.createArea).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Area name must be 100 characters or fewer.");
      wrapper.unmount();
    });

    it("Admin edits an area", async () => {
      areaServices.getAreas
        .mockResolvedValueOnce({
          data: [{ id: 1, name: "Athletics", description: "Old", isActive: true, admins: [] }],
        })
        .mockResolvedValueOnce({
          data: [{ id: 1, name: "Athletics", description: "Vans, buses, and golf carts", isActive: true, admins: [] }],
        });
      areaServices.updateArea.mockResolvedValue({ data: {} });

      const wrapper = await mountAreas();
      document.querySelector('[aria-label="Edit area"]').click();
      await flushPromises();
      await wrapper.findComponent({ name: "VTextarea" }).setValue("Vans, buses, and golf carts");
      clickLabel("Save");
      await flushPromises();

      expect(areaServices.updateArea).toHaveBeenCalledWith(1, {
        name: "Athletics",
        description: "Vans, buses, and golf carts",
        isActive: true,
      });
      expect(wrapper.text()).toContain("Vans, buses, and golf carts");
      expect(wrapper.text()).not.toContain("Edit Area");
      wrapper.unmount();
    });

    it("Admin deactivates an area", async () => {
      areaServices.getAreas
        .mockResolvedValueOnce({
          data: [{ id: 1, name: "Athletics", description: "Vans", isActive: true, admins: [] }],
        })
        .mockResolvedValueOnce({
          data: [{ id: 1, name: "Athletics", description: "Vans", isActive: false, admins: [] }],
        });
      areaServices.updateArea.mockResolvedValue({ data: {} });

      const wrapper = await mountAreas();
      document.querySelector('[aria-label="Edit area"]').click();
      await flushPromises();
      await wrapper.findComponent({ name: "VSwitch" }).setValue(false);
      clickLabel("Save");
      await flushPromises();

      expect(areaServices.updateArea).toHaveBeenCalledWith(1, expect.objectContaining({ isActive: false }));
      expect(wrapper.text()).toContain("Inactive");
      wrapper.unmount();
    });

    it("Admin cancels editing an area", async () => {
      areaServices.getAreas.mockResolvedValue({
        data: [{ id: 1, name: "Athletics", description: "Old", isActive: true, admins: [] }],
      });

      const wrapper = await mountAreas();
      document.querySelector('[aria-label="Edit area"]').click();
      await flushPromises();
      await wrapper.findComponent({ name: "VTextarea" }).setValue("Changed");
      clickLabel("Cancel");
      await flushPromises();

      expect(areaServices.updateArea).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain("Old");
      expect(wrapper.text()).not.toContain("Changed");
      wrapper.unmount();
    });
  });

  describe("US-2.2 — Assign and remove area admins", () => {
    it("Admin assigns an area admin to an area", async () => {
      const athletics = { id: 1, name: "Athletics", description: "Vans", isActive: true, admins: [] };
      areaServices.getAreas.mockResolvedValue({ data: [athletics] });
      userServices.getUsers.mockResolvedValue({
        data: [{ id: 4, firstName: "Alex", lastName: "Reed", role: "area_admin", isActive: true, email: "areed@oc.edu" }],
      });
      areaServices.assignAdmin.mockResolvedValue({
        data: {
          ...athletics,
          admins: [{ id: 4, firstName: "Alex", lastName: "Reed", email: "areed@oc.edu" }],
        },
      });

      const wrapper = await mountAreas();
      document.querySelector('[aria-label="Manage admins"]').click();
      await flushPromises();
      await wrapper.findComponent({ name: "VAutocomplete" }).setValue(4);
      clickLabel("Add");
      await flushPromises();

      expect(areaServices.assignAdmin).toHaveBeenCalledWith(1, 4);
      expect(wrapper.text()).toContain("Alex Reed");
      wrapper.unmount();
    });

    it("Admin removes an area admin from an area", async () => {
      const athletics = {
        id: 1,
        name: "Athletics",
        description: "Vans",
        isActive: true,
        admins: [
          { id: 4, firstName: "Alex", lastName: "Reed", email: "areed@oc.edu" },
          { id: 5, firstName: "Sam", lastName: "Cole", email: "scole@oc.edu" },
        ],
      };
      areaServices.getAreas.mockResolvedValue({ data: [athletics] });
      userServices.getUsers.mockResolvedValue({ data: [] });
      areaServices.removeAdmin.mockResolvedValue({
        data: {
          ...athletics,
          admins: [{ id: 5, firstName: "Sam", lastName: "Cole", email: "scole@oc.edu" }],
        },
      });

      const wrapper = await mountAreas();
      document.querySelector('[aria-label="Manage admins"]').click();
      await flushPromises();
      document.querySelector('[aria-label="Remove admin"]').click();
      await flushPromises();

      expect(areaServices.removeAdmin).toHaveBeenCalledWith(1, 4);
      expect(wrapper.text()).toContain("Sam Cole");
      expect(wrapper.text()).not.toContain("Alex Reed");
      wrapper.unmount();
    });
  });

  describe("US-2.3 — See each area's admins at a glance", () => {
    it("Areas list shows each area's admins", async () => {
      areaServices.getAreas.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "Athletics",
            description: "Vans",
            isActive: true,
            admins: [{ id: 4, firstName: "Alex", lastName: "Reed", email: "areed@oc.edu" }],
          },
          { id: 2, name: "Maintenance", description: "Trucks", isActive: true, admins: [] },
        ],
      });

      const wrapper = await mountAreas();
      expect(wrapper.text()).toContain("Alex Reed");
      expect(wrapper.text()).toContain("No admins");
      wrapper.unmount();
    });
  });
});
