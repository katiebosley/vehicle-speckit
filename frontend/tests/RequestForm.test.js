/**
 * Feature 4 — Making and Tracking Requests
 * Spec: features/feature-4-making-and-tracking-requests.md
 */
import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import RequestForm from "../src/components/RequestForm.vue";
import { mountWithPlugins } from "./testUtils.js";

const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const later = new Date(Date.now() + 54 * 60 * 60 * 1000).toISOString();

describe("Feature 4 — Making and Tracking Requests", () => {
  describe("US-4.2 — Validation errors on invalid request", () => {
    it("Requestor omits a required field", async () => {
      const { wrapper } = await mountWithPlugins(RequestForm, {
        props: {
          areas: [{ id: 1, name: "Athletics" }],
          vehicleTypes: [{ id: 2, name: "Van" }],
          submitLabel: "Submit Request",
          initial: {
            areaId: 1,
            purpose: "   ",
            destination: "Downtown Museum",
            departureAt: future,
            returnAt: later,
            passengerCount: 12,
            vehicleTypeId: 2,
            vehiclesNeeded: 1,
          },
        },
      });

      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(wrapper.text()).toContain("All required fields must be provided.");
      expect(wrapper.emitted("submit")).toBeUndefined();
    });
  });
});
