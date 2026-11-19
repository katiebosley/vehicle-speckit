/**
 * Feature 5 — Vehicle Management
 * Spec: features/feature-5-vehicle-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, DOMWrapper } from "@vue/test-utils";
import ReviewQueue from "../src/views/ReviewQueue.vue";
import reviewServices from "../src/services/reviewServices.js";
import destinationServices from "../src/services/destinationServices.js";
import { mountWithPlugins } from "./testUtils.js";

vi.mock("../src/services/reviewServices.js", () => ({
  default: {
    list: vi.fn(),
    availableVehicles: vi.fn(),
    eligibleDrivers: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
    addAssignment: vi.fn(),
    updateAssignment: vi.fn(),
    removeAssignment: vi.fn(),
    complete: vi.fn(),
    updateTripLog: vi.fn(),
  },
}));

vi.mock("../src/services/destinationServices.js", () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const van12 = { id: 12, name: "Van 12", capacity: 15 };
const van7 = { id: 7, name: "Van 7", capacity: 15 };
const sam = { id: 4, name: "Sam Ortiz" };

function pendingRequest(overrides = {}) {
  return {
    id: 41,
    requester_name: "Jamie Lee",
    area_name: "Athletics",
    vehicle_type_name: "Van",
    vehicles_needed: 1,
    passenger_count: 12,
    purpose: "Away game",
    destination_name: "Campus",
    departure_at: "2026-12-01T14:00:00.000Z",
    return_at: "2026-12-01T22:00:00.000Z",
    status: "pending",
    assignments: [],
    ...overrides,
  };
}

let wrapper;

function bodyButton(text) {
  const button = [...document.body.querySelectorAll("button")].find((node) => node.textContent.trim() === text);
  return button ? new DOMWrapper(button) : null;
}

function field(test) {
  const root = document.querySelector(`[data-test="${test}"]`);
  const input = root?.querySelector("input, textarea");
  return new DOMWrapper(input || root);
}

async function clickLabel(label) {
  await new DOMWrapper(document.querySelector(`[aria-label="${label}"]`)).trigger("click");
  await flushPromises();
}

async function setSelect(test, value, index = 0) {
  const matches = wrapper
    .findAllComponents({ name: "VSelect" })
    .filter((select) => select.attributes("data-test") === test);
  await matches[index].setValue(value);
  await flushPromises();
}

async function mountQueue() {
  ({ wrapper } = await mountWithPlugins(ReviewQueue, { attachTo: document.body }));
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  reviewServices.list.mockResolvedValue({ data: [] });
  reviewServices.availableVehicles.mockResolvedValue({ data: [van12, van7] });
  reviewServices.eligibleDrivers.mockResolvedValue({ data: [sam] });
  destinationServices.list.mockResolvedValue({ data: [] });
});

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});

describe("Feature 5 — Vehicle Management", () => {
  describe("US-5.1 — Select to work with the review queue", () => {
    it("Menu Selection", async () => {
      await mountQueue();

      expect(wrapper.text()).toContain("Review Requests");
    });
  });

  describe("US-5.2 — View pending requests", () => {
    it("Area admin sees pending requests for their areas", async () => {
      reviewServices.list.mockResolvedValue({
        data: [
          pendingRequest({ id: 1, purpose: "Early", departure_at: "2026-11-20T14:00:00.000Z" }),
          pendingRequest({ id: 2, purpose: "Late", departure_at: "2026-12-02T14:00:00.000Z" }),
        ],
      });

      await mountQueue();
      const rows = wrapper.findAll("tbody tr").map((row) => row.text());

      expect(rows[0]).toContain("Early");
      expect(rows[1]).toContain("Late");
      expect(wrapper.text()).not.toContain("Music");
    });

    it("There are no requests to review", async () => {
      await mountQueue();

      expect(wrapper.text()).toContain("No requests to review.");
    });
  });

  describe("US-5.3 — Approve a request and assign vehicles", () => {
    it("Area admin approves a request with one vehicle", async () => {
      const trip = pendingRequest();
      reviewServices.list.mockResolvedValueOnce({ data: [trip] }).mockResolvedValue({ data: [] });
      reviewServices.approve.mockResolvedValue({ data: { status: "approved" } });
      await mountQueue();

      await clickLabel("Approve request");
      await setSelect("vehicle-select", van12.id);
      await bodyButton("Approve").trigger("click");
      await flushPromises();

      expect(reviewServices.approve).toHaveBeenCalledWith(trip.id, {
        review_notes: null,
        assignments: [{ vehicle_id: van12.id, driver_id: null }],
      });
      expect(document.body.textContent).not.toContain("Approve Request");
      expect(wrapper.text()).not.toContain("Jamie Lee");
    });

    it("Area admin approves with no vehicles", async () => {
      reviewServices.list.mockResolvedValue({ data: [pendingRequest()] });
      await mountQueue();

      await clickLabel("Approve request");
      await clickLabel("Remove vehicle");
      await bodyButton("Approve").trigger("click");
      await flushPromises();

      expect(reviewServices.approve).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("At least one vehicle is required.");
    });

    it("Area admin selects the same vehicle twice", async () => {
      reviewServices.list.mockResolvedValue({ data: [pendingRequest({ vehicles_needed: 2 })] });
      await mountQueue();

      await clickLabel("Approve request");
      await setSelect("vehicle-select", van12.id, 0);
      await setSelect("vehicle-select", van12.id, 1);
      await bodyButton("Approve").trigger("click");
      await flushPromises();

      expect(reviewServices.approve).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("A vehicle can only be assigned once per request.");
    });
  });

  describe("US-5.4 — Deny a request", () => {
    it("Area admin denies a request with a note", async () => {
      const trip = pendingRequest();
      reviewServices.list.mockResolvedValueOnce({ data: [trip] }).mockResolvedValue({ data: [] });
      reviewServices.deny.mockResolvedValue({ data: { status: "denied" } });
      await mountQueue();

      await clickLabel("Deny request");
      await field("deny-reason").setValue("No vans that weekend.");
      await bodyButton("Deny").trigger("click");
      await flushPromises();

      expect(reviewServices.deny).toHaveBeenCalledWith(trip.id, { review_notes: "No vans that weekend." });
      expect(document.body.textContent).not.toContain("Deny Request");
    });

    it("Area admin denies a request without a note", async () => {
      reviewServices.list.mockResolvedValue({ data: [pendingRequest()] });
      await mountQueue();

      await clickLabel("Deny request");
      await bodyButton("Deny").trigger("click");
      await flushPromises();

      expect(reviewServices.deny).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Required");
    });
  });

  describe("US-5.6 — Warn when a request is not fully covered", () => {
    it("Capacity warning is shown and saving is allowed", async () => {
      const trip = pendingRequest({ passenger_count: 20 });
      reviewServices.approve.mockResolvedValue({ data: { status: "approved" } });
      reviewServices.list.mockResolvedValue({ data: [trip] });
      await mountQueue();

      await clickLabel("Approve request");
      await setSelect("vehicle-select", van12.id);
      expect(document.body.textContent).toContain("Assigned seats (15) are fewer than passengers (20).");

      await bodyButton("Approve").trigger("click");
      await flushPromises();

      expect(reviewServices.approve).toHaveBeenCalled();
    });

    it("Vehicle count warning is shown and saving is allowed", async () => {
      const trip = pendingRequest({ vehicles_needed: 2 });
      reviewServices.approve.mockResolvedValue({ data: { status: "approved" } });
      reviewServices.list.mockResolvedValue({ data: [trip] });
      await mountQueue();

      await clickLabel("Approve request");
      await setSelect("vehicle-select", van12.id, 0);

      expect(document.body.textContent).toContain("1 of 2 requested vehicles assigned.");
      await bodyButton("Approve").trigger("click");
      await flushPromises();

      expect(reviewServices.approve).toHaveBeenCalled();
    });

    it("No warning when the request is covered", async () => {
      reviewServices.list.mockResolvedValue({ data: [pendingRequest()] });
      await mountQueue();

      await clickLabel("Approve request");
      await setSelect("vehicle-select", van12.id);

      expect(document.body.textContent).not.toContain("fewer than passengers");
      expect(document.body.textContent).not.toContain("requested vehicles assigned");
    });
  });

  describe("US-5.7 — Assign a driver to each vehicle", () => {
    it("Area admin assigns the same driver twice", async () => {
      reviewServices.list.mockResolvedValue({ data: [pendingRequest({ vehicles_needed: 2 })] });
      await mountQueue();

      await clickLabel("Approve request");
      await setSelect("vehicle-select", van12.id, 0);
      await setSelect("vehicle-select", van7.id, 1);
      await setSelect("driver-select", sam.id, 0);
      await setSelect("driver-select", sam.id, 1);
      await bodyButton("Approve").trigger("click");
      await flushPromises();

      expect(reviewServices.approve).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("A driver can only be assigned to one vehicle per request.");
    });
  });

  describe("US-5.8 — Change or remove an assignment", () => {
    it("Area admin changes a vehicle before the trip starts", async () => {
      const assignment = { id: 8, vehicle_id: van12.id, vehicle_name: "Van 12", driver_id: null, trip_log: null };
      const trip = pendingRequest({
        status: "approved",
        departure_at: "2099-01-01T14:00:00.000Z",
        return_at: "2099-01-01T22:00:00.000Z",
        assignments: [assignment],
      });
      reviewServices.list.mockImplementation(async (status) => ({ data: status === "approved" ? [trip] : [] }));
      reviewServices.updateAssignment.mockResolvedValue({ data: {} });
      await mountQueue();

      await wrapper.findAll(".v-tab").find((item) => item.text() === "Approved").trigger("click");
      await flushPromises();
      await clickLabel("Manage assignments");
      await setSelect("vehicle-select", van7.id);
      await bodyButton("Save").trigger("click");
      await flushPromises();

      expect(reviewServices.updateAssignment).toHaveBeenCalledWith(trip.id, assignment.id, {
        vehicle_id: van7.id,
        driver_id: null,
      });
      expect(document.body.textContent).not.toContain("Manage Assignments");
    });

    it("Area admin changes an assignment after the trip starts", async () => {
      const trip = pendingRequest({
        status: "approved",
        departure_at: "2020-01-01T14:00:00.000Z",
        return_at: "2099-01-01T22:00:00.000Z",
        assignments: [{ id: 8, vehicle_id: van12.id, vehicle_name: "Van 12", driver_id: null, trip_log: null }],
      });
      reviewServices.list.mockImplementation(async (status) => ({ data: status === "approved" ? [trip] : [] }));
      await mountQueue();

      await wrapper.findAll(".v-tab").find((item) => item.text() === "Approved").trigger("click");
      await flushPromises();
      await clickLabel("Manage assignments");

      expect(document.body.textContent).toContain("Assignments are locked once the trip starts.");
    });
  });

  describe("US-5.10 — Enter trip logs and complete a request", () => {
    const finished = pendingRequest({
      status: "approved",
      departure_at: "2020-01-01T14:00:00.000Z",
      return_at: "2020-01-01T22:00:00.000Z",
      assignments: [
        { id: 8, vehicle_id: van12.id, vehicle_name: "Van 12", driver_id: null, trip_log: null },
        { id: 9, vehicle_id: van7.id, vehicle_name: "Van 7", driver_id: null, trip_log: null },
      ],
    });

    async function openComplete() {
      reviewServices.list.mockImplementation(async (status) => ({ data: status === "approved" ? [finished] : [] }));
      await mountQueue();
      await wrapper.findAll(".v-tab").find((item) => item.text() === "Approved").trigger("click");
      await flushPromises();
      await clickLabel("Complete request");
    }

    async function fill(index, end = "20") {
      await field(`start-mileage-${index}`).setValue("10");
      await field(`end-mileage-${index}`).setValue(end);
      await field(`picked-up-${index}`).setValue("2020-01-01T13:00");
      await field(`returned-at-${index}`).setValue("2020-01-01T18:00");
    }

    it("Area admin completes a finished trip", async () => {
      reviewServices.complete.mockResolvedValue({ data: { status: "completed" } });
      await openComplete();
      await fill(0);
      await fill(1, "30");
      await bodyButton("Complete").trigger("click");
      await flushPromises();

      expect(reviewServices.complete).toHaveBeenCalled();
      expect(document.body.textContent).not.toContain("Complete Request");
    });

    it("Area admin completes with a missing field", async () => {
      await openComplete();
      await fill(0);
      await field("start-mileage-1").setValue("10");
      await field("picked-up-1").setValue("2020-01-01T13:00");
      await field("returned-at-1").setValue("2020-01-01T18:00");
      await bodyButton("Complete").trigger("click");
      await flushPromises();

      expect(reviewServices.complete).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Required");
    });
  });

  describe("US-5.11 — Edit a trip log", () => {
    const tripLog = {
      id: 3,
      start_mileage: 10,
      end_mileage: 20,
      fuel_added_gallons: null,
      picked_up_at: "2020-01-01T13:00:00.000Z",
      returned_at: "2020-01-01T18:00:00.000Z",
      issues_reported: null,
    };

    async function openEdit() {
      reviewServices.list.mockImplementation(async (status) => ({
        data:
          status === "completed"
            ? [
                pendingRequest({
                  status: "completed",
                  assignments: [{ id: 8, vehicle_id: van12.id, vehicle_name: "Van 12", driver_id: null, trip_log: tripLog }],
                }),
              ]
            : [],
      }));
      await mountQueue();
      await wrapper.findAll(".v-tab").find((item) => item.text() === "Completed").trigger("click");
      await flushPromises();
      await clickLabel("Edit trip log");
    }

    it("Area admin edits a trip log and saves", async () => {
      reviewServices.updateTripLog.mockResolvedValue({ data: { end_mileage: 40 } });
      await openEdit();
      await field("edit-end-mileage").setValue("40");
      await bodyButton("Save Trip Log").trigger("click");
      await flushPromises();

      expect(reviewServices.updateTripLog).toHaveBeenCalledWith(3, expect.objectContaining({ end_mileage: 40 }));
      expect(document.body.textContent).not.toContain("Edit Trip Log");
    });

    it("Area admin edits a trip log and cancels", async () => {
      await openEdit();
      await field("edit-end-mileage").setValue("40");
      await bodyButton("Cancel").trigger("click");
      await flushPromises();

      expect(reviewServices.updateTripLog).not.toHaveBeenCalled();
      expect(document.body.textContent).not.toContain("Edit Trip Log");
    });
  });

  describe("US-5.12 — Manage destinations", () => {
    it("Area admin creates a destination", async () => {
      destinationServices.list.mockResolvedValueOnce({ data: [] }).mockResolvedValue({
        data: [{ id: 5, name: "Tulsa – Union High School", is_active: true }],
      });
      destinationServices.create.mockResolvedValue({
        status: 201,
        data: { id: 5, name: "Tulsa – Union High School", is_active: true },
      });
      await mountQueue();

      await wrapper.findAll(".v-tab").find((item) => item.text() === "Destinations").trigger("click");
      await flushPromises();
      await bodyButton("+ New destination").trigger("click");
      await flushPromises();
      await field("destination-name").setValue("Tulsa – Union High School");
      await bodyButton("Create").trigger("click");
      await flushPromises();

      expect(destinationServices.create).toHaveBeenCalledWith({ name: "Tulsa – Union High School" });
      expect(wrapper.text()).toContain("Tulsa – Union High School");
      expect(document.body.textContent).not.toContain("Add Destination");
    });
  });
});
