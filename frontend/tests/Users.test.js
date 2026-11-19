/**
 * Feature 1 — Sign-in, Roles & User Management
 * Spec: features/feature-1-google-auth-user-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { h } from "vue";
import { flushPromises } from "@vue/test-utils";

vi.mock("../src/services/userServices.js", () => ({
  default: { getUsers: vi.fn(), updateUser: vi.fn() },
}));

import userServices from "../src/services/userServices.js";
import Utils from "../src/config/utils.js";
import Users from "../src/views/Users.vue";
import { mountWithPlugins } from "./testUtils.js";

const VDialogStub = {
  props: ["modelValue"],
  setup(props, { slots }) {
    return () => (props.modelValue ? h("div", { class: "dialog-stub" }, slots.default?.()) : null);
  },
};

const makeUser = (overrides) => ({
  email: "user@oc.edu",
  phone: null,
  role: "requestor",
  isApprovedDriver: false,
  licenseExpiration: null,
  isActive: true,
  ...overrides,
});

const ADMIN = makeUser({ id: 1, firstName: "Ada", lastName: "Admin", email: "admin@oc.edu", role: "admin" });
const CAL = makeUser({ id: 4, firstName: "Cal", lastName: "Adams", email: "cadams@oc.edu" });
const BOB = makeUser({ id: 2, firstName: "Bob", lastName: "Jones", email: "bjones@oc.edu" });
const ANN = makeUser({ id: 3, firstName: "Ann", lastName: "Smith", email: "asmith@oc.edu" });

async function mountUsers(list = [CAL, BOB, ANN]) {
  userServices.getUsers.mockResolvedValue({ data: list });
  const { wrapper } = await mountWithPlugins(Users, {
    global: { stubs: { VDialog: VDialogStub } },
  });
  await flushPromises();
  return wrapper;
}

const rows = (wrapper) => wrapper.findAll("[data-test='user-row']");
const rowFor = (wrapper, lastName) => rows(wrapper).find((row) => row.text().includes(lastName));

async function openEdit(wrapper, lastName) {
  await rowFor(wrapper, lastName).find("[aria-label='Edit user']").trigger("click");
  await flushPromises();
  return wrapper.find(".dialog-stub");
}

async function clickSave(wrapper) {
  await wrapper.find("[data-test='save-user']").trigger("click");
  await flushPromises();
}

function chooseRole(wrapper, role) {
  wrapper.findComponent({ name: "VSelect" }).vm.$emit("update:modelValue", role);
}

beforeEach(() => {
  localStorage.clear();
  Utils.setStore("user", { userId: ADMIN.id, role: "admin", token: "session-token" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Feature 1 — Sign-in, Roles & User Management", () => {
  describe("US-1.5 — View and search users", () => {
    it("Menu Selection", async () => {
      const wrapper = await mountUsers();

      expect(wrapper.find("h1").text()).toBe("Users");
      expect(userServices.getUsers).toHaveBeenCalledWith("");
    });

    it("Admin views all users", async () => {
      const wrapper = await mountUsers([
        CAL,
        BOB,
        makeUser({ ...ANN, isApprovedDriver: true, licenseExpiration: "2028-05-31", isActive: false }),
      ]);

      expect(rows(wrapper).map((row) => row.find("td").text())).toEqual([
        "Adams, Cal",
        "Jones, Bob",
        "Smith, Ann",
      ]);
      const ann = rowFor(wrapper, "Smith").findAll("td").map((cell) => cell.text());
      expect(ann.slice(0, 6)).toEqual([
        "Smith, Ann",
        "asmith@oc.edu",
        "Requestor",
        "Yes",
        "2028-05-31",
        "Inactive",
      ]);
      expect(wrapper.text()).not.toContain("New user");
    });

    it("Admin searches users by name or email", async () => {
      const wrapper = await mountUsers();
      userServices.getUsers.mockImplementation(async (search) => ({
        data: search === "SMI" ? [ANN] : [CAL, BOB, ANN],
      }));

      await wrapper.find("[data-test='user-search'] input").setValue("SMI");
      await flushPromises();

      expect(userServices.getUsers).toHaveBeenLastCalledWith("SMI");
      expect(rows(wrapper)).toHaveLength(1);
      expect(rows(wrapper)[0].text()).toContain("Smith, Ann");
    });

    it("Search with no matches shows empty copy", async () => {
      const wrapper = await mountUsers();
      userServices.getUsers.mockResolvedValue({ data: [] });

      await wrapper.find("[data-test='user-search'] input").setValue("zzzz");
      await flushPromises();

      expect(wrapper.find("[data-test='users-empty']").text()).toBe("No users match your search.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("shows an error alert when users fail to load", async () => {
      userServices.getUsers.mockRejectedValue({
        response: { status: 403, data: { message: "You do not have permission for this action." } },
      });
      const { wrapper } = await mountWithPlugins(Users, {
        global: { stubs: { VDialog: VDialogStub } },
      });
      await flushPromises();

      expect(wrapper.find(".v-alert").text()).toContain("You do not have permission for this action.");
    });
  });

  describe("US-1.6 — Change a user's role and deactivate a user", () => {
    it("Admin changes a user's role", async () => {
      const wrapper = await mountUsers();
      userServices.updateUser.mockResolvedValue({ data: { ...BOB, role: "area_admin" } });

      const dialog = await openEdit(wrapper, "Jones");
      expect(dialog.text()).toContain("Edit User");
      chooseRole(wrapper, "area_admin");
      await clickSave(wrapper);

      expect(userServices.updateUser).toHaveBeenCalledWith(BOB.id, {
        role: "area_admin",
        isApprovedDriver: false,
        licenseExpiration: null,
        isActive: true,
      });
      expect(wrapper.find(".dialog-stub").exists()).toBe(false);
      expect(rowFor(wrapper, "Jones").text()).toContain("Area Admin");
    });

    it("Admin deactivates a user", async () => {
      const wrapper = await mountUsers();
      userServices.updateUser.mockResolvedValue({ data: { ...BOB, isActive: false } });

      await openEdit(wrapper, "Jones");
      await wrapper.find("[data-test='active-switch'] input").setValue(false);
      await clickSave(wrapper);

      expect(userServices.updateUser).toHaveBeenCalledWith(
        BOB.id,
        expect.objectContaining({ isActive: false })
      );
      expect(rowFor(wrapper, "Jones").text()).toContain("Inactive");
    });

    it("Admin cancels editing a user", async () => {
      const wrapper = await mountUsers();

      await openEdit(wrapper, "Jones");
      chooseRole(wrapper, "admin");
      await wrapper.find("[data-test='cancel-edit']").trigger("click");
      await flushPromises();

      expect(userServices.updateUser).not.toHaveBeenCalled();
      expect(wrapper.find(".dialog-stub").exists()).toBe(false);
      expect(rowFor(wrapper, "Jones").text()).toContain("Requestor");
    });

    it("shows the server error inside the dialog and keeps it open", async () => {
      const wrapper = await mountUsers();
      userServices.updateUser.mockRejectedValue({
        response: { status: 400, data: { message: "Role must be admin, area_admin, or requestor." } },
      });

      await openEdit(wrapper, "Jones");
      await clickSave(wrapper);

      const dialog = wrapper.find(".dialog-stub");
      expect(dialog.exists()).toBe(true);
      expect(dialog.find(".v-alert").text()).toContain("Role must be admin, area_admin, or requestor.");
    });

    it("disables Role and Active when the admin edits their own row", async () => {
      const wrapper = await mountUsers([ADMIN, BOB]);

      await openEdit(wrapper, "Admin");

      expect(wrapper.findComponent({ name: "VSelect" }).props("disabled")).toBe(true);
      expect(wrapper.find("[data-test='active-switch'] input").attributes("disabled")).toBeDefined();
      expect(wrapper.find("[data-test='approved-driver'] input").attributes("disabled")).toBeUndefined();
    });
  });

  describe("US-1.7 — Mark approved drivers", () => {
    it("Admin marks a user as an approved driver", async () => {
      const wrapper = await mountUsers();
      userServices.updateUser.mockResolvedValue({
        data: { ...BOB, isApprovedDriver: true, licenseExpiration: "2028-05-31" },
      });

      await openEdit(wrapper, "Jones");
      await wrapper.find("[data-test='approved-driver'] input").setValue(true);
      await wrapper.find("[data-test='license-expiration'] input").setValue("2028-05-31");
      await clickSave(wrapper);

      expect(userServices.updateUser).toHaveBeenCalledWith(
        BOB.id,
        expect.objectContaining({ isApprovedDriver: true, licenseExpiration: "2028-05-31" })
      );
      const cells = rowFor(wrapper, "Jones").findAll("td").map((cell) => cell.text());
      expect(cells[3]).toBe("Yes");
      expect(cells[4]).toBe("2028-05-31");
    });

    it("Admin marks an approved driver without a license expiration", async () => {
      const wrapper = await mountUsers();

      await openEdit(wrapper, "Jones");
      await wrapper.find("[data-test='approved-driver'] input").setValue(true);
      await clickSave(wrapper);

      expect(userServices.updateUser).not.toHaveBeenCalled();
      expect(wrapper.find(".dialog-stub").text()).toContain(
        "License expiration is required for approved drivers."
      );
    });
  });
});
