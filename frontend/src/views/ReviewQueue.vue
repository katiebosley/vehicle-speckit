<script setup>
import { computed, onMounted, ref, watch } from "vue";
import destinationServices from "../services/destinationServices.js";
import reviewServices from "../services/reviewServices.js";

const tabs = [
  { title: "Pending", value: "pending" },
  { title: "Approved", value: "approved" },
  { title: "Denied", value: "denied" },
  { title: "Completed", value: "completed" },
  { title: "Destinations", value: "destinations" },
];

const tab = ref("pending");
const requests = ref([]);
const destinations = ref([]);
const loading = ref(false);
const error = ref("");

const dialog = ref("");
const activeRequest = ref(null);
const vehicles = ref([]);
const drivers = ref([]);
const rows = ref([]);
const notes = ref("");
const reason = ref("");
const logs = ref([]);
const editingLog = ref(null);
const viewingLogs = ref(null);
const destinationName = ref("");
const destinationActive = ref(true);
const editingDestination = ref(null);
const formError = ref("");
const saving = ref(false);

const showVehicles = computed(() => tab.value === "approved" || tab.value === "completed");
const locked = computed(
  () => activeRequest.value && new Date(activeRequest.value.departure_at).getTime() <= Date.now()
);

const assignedCapacity = computed(() =>
  rows.value.reduce((sum, row) => {
    const vehicle = vehicles.value.find((item) => item.id === row.vehicle_id);
    return sum + (vehicle?.capacity || 0);
  }, 0)
);

const warnings = computed(() => {
  const request = activeRequest.value;
  if (!request || (dialog.value !== "approve" && dialog.value !== "manage")) {
    return [];
  }
  const messages = [];
  const assigned = rows.value.filter((row) => row.vehicle_id).length;
  if (request.passenger_count != null && assignedCapacity.value > 0 && assignedCapacity.value < request.passenger_count) {
    messages.push(`Assigned seats (${assignedCapacity.value}) are fewer than passengers (${request.passenger_count}).`);
  }
  if (request.vehicles_needed && assigned > 0 && assigned < request.vehicles_needed) {
    messages.push(`${assigned} of ${request.vehicles_needed} requested vehicles assigned.`);
  }
  return messages;
});

function messageFrom(err, fallback) {
  return err.response?.data?.message || fallback;
}

async function loadRequests() {
  loading.value = true;
  error.value = "";
  try {
    const response = await reviewServices.list(tab.value);
    requests.value = response.data;
  } catch (err) {
    requests.value = [];
    error.value = messageFrom(err, "Could not load requests.");
  } finally {
    loading.value = false;
  }
}

async function loadDestinations() {
  loading.value = true;
  error.value = "";
  try {
    const response = await destinationServices.list();
    destinations.value = response.data;
  } catch (err) {
    destinations.value = [];
    error.value = messageFrom(err, "Could not load destinations.");
  } finally {
    loading.value = false;
  }
}

function loadTab() {
  if (tab.value === "destinations") {
    return loadDestinations();
  }
  return loadRequests();
}

watch(tab, loadTab);
onMounted(loadTab);

function when(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function tripEnded(request) {
  return new Date(request.return_at).getTime() <= Date.now();
}

function toLocalInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

async function loadPickers(request) {
  const [vehicleResponse, driverResponse] = await Promise.all([
    reviewServices.availableVehicles(request.id),
    reviewServices.eligibleDrivers(request.id),
  ]);
  vehicles.value = vehicleResponse.data;
  drivers.value = driverResponse.data;
}

function closeDialog() {
  dialog.value = "";
  formError.value = "";
}

function onDialog(open) {
  if (!open) {
    closeDialog();
  }
}

function duplicateVehicles() {
  const ids = rows.value.map((row) => row.vehicle_id).filter((id) => id != null);
  return new Set(ids).size !== ids.length;
}

function duplicateDrivers() {
  const ids = rows.value.map((row) => row.driver_id).filter((id) => id != null);
  return new Set(ids).size !== ids.length;
}

async function openApprove(request) {
  activeRequest.value = request;
  notes.value = "";
  formError.value = "";
  dialog.value = "approve";
  const count = request.vehicles_needed > 0 ? request.vehicles_needed : 1;
  rows.value = Array.from({ length: count }, () => ({ vehicle_id: null, driver_id: null }));
  try {
    await loadPickers(request);
  } catch (err) {
    formError.value = messageFrom(err, "Could not load vehicles.");
  }
}

function addRow() {
  rows.value.push({ vehicle_id: null, driver_id: null });
}

function removeRow(index) {
  rows.value.splice(index, 1);
}

async function submitApprove() {
  const chosen = rows.value.filter((row) => row.vehicle_id);
  if (chosen.length === 0) {
    formError.value = "At least one vehicle is required.";
    return;
  }
  if (duplicateVehicles()) {
    formError.value = "A vehicle can only be assigned once per request.";
    return;
  }
  if (duplicateDrivers()) {
    formError.value = "A driver can only be assigned to one vehicle per request.";
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    await reviewServices.approve(activeRequest.value.id, {
      review_notes: notes.value.trim() || null,
      assignments: chosen.map((row) => ({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id || null,
      })),
    });
    closeDialog();
    await loadRequests();
  } catch (err) {
    formError.value = messageFrom(err, "Could not approve the request.");
    if (err.response?.status === 409) {
      await loadPickers(activeRequest.value);
    }
  } finally {
    saving.value = false;
  }
}

function openDeny(request) {
  activeRequest.value = request;
  reason.value = "";
  formError.value = "";
  dialog.value = "deny";
}

async function submitDeny() {
  if (!reason.value.trim()) {
    formError.value = "Required";
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    await reviewServices.deny(activeRequest.value.id, { review_notes: reason.value.trim() });
    closeDialog();
    await loadRequests();
  } catch (err) {
    formError.value = messageFrom(err, "Could not deny the request.");
  } finally {
    saving.value = false;
  }
}

async function openManage(request) {
  activeRequest.value = request;
  formError.value = "";
  dialog.value = "manage";
  rows.value = request.assignments.map((assignment) => ({
    assignment_id: assignment.id,
    vehicle_id: assignment.vehicle_id,
    driver_id: assignment.driver_id,
  }));
  try {
    await loadPickers(request);
  } catch (err) {
    formError.value = messageFrom(err, "Could not load vehicles.");
  }
}

async function submitManage() {
  if (locked.value) {
    return;
  }
  const chosen = rows.value.filter((row) => row.vehicle_id);
  if (chosen.length === 0) {
    formError.value = "An approved request must keep at least one vehicle.";
    return;
  }
  if (duplicateVehicles()) {
    formError.value = "A vehicle can only be assigned once per request.";
    return;
  }
  if (duplicateDrivers()) {
    formError.value = "A driver can only be assigned to one vehicle per request.";
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    for (const row of rows.value) {
      const body = { vehicle_id: row.vehicle_id, driver_id: row.driver_id || null };
      if (row.assignment_id) {
        await reviewServices.updateAssignment(activeRequest.value.id, row.assignment_id, body);
      } else {
        await reviewServices.addAssignment(activeRequest.value.id, body);
      }
    }
    closeDialog();
    await loadRequests();
  } catch (err) {
    formError.value = messageFrom(err, "Could not save assignments.");
    if (err.response?.status === 409) {
      await loadPickers(activeRequest.value);
    }
  } finally {
    saving.value = false;
  }
}

async function removeAssignment(row, index) {
  if (!row.assignment_id) {
    rows.value.splice(index, 1);
    return;
  }
  try {
    await reviewServices.removeAssignment(activeRequest.value.id, row.assignment_id);
    rows.value.splice(index, 1);
  } catch (err) {
    formError.value = messageFrom(err, "Could not remove the assignment.");
  }
}

function openComplete(request) {
  activeRequest.value = request;
  formError.value = "";
  logs.value = request.assignments.map((assignment) => ({
    assignment_id: assignment.id,
    vehicle_name: assignment.vehicle_name,
    start_mileage: "",
    end_mileage: "",
    picked_up_at: "",
    returned_at: "",
    fuel_added_gallons: "",
    issues_reported: "",
  }));
  dialog.value = "complete";
}

function logPayload(log) {
  return {
    assignment_id: log.assignment_id,
    start_mileage: Number(log.start_mileage),
    end_mileage: Number(log.end_mileage),
    picked_up_at: toIso(log.picked_up_at),
    returned_at: toIso(log.returned_at),
    fuel_added_gallons: log.fuel_added_gallons === "" ? null : Number(log.fuel_added_gallons),
    issues_reported: log.issues_reported.trim() || null,
  };
}

function invalidLog(log) {
  if (log.start_mileage === "" || log.end_mileage === "" || !log.picked_up_at || !log.returned_at) {
    return "Required";
  }
  if (Number(log.end_mileage) < Number(log.start_mileage)) {
    return "End mileage must be greater than or equal to start mileage.";
  }
  if (new Date(log.returned_at).getTime() < new Date(log.picked_up_at).getTime()) {
    return "Return time must be after pick-up time.";
  }
  if (log.fuel_added_gallons !== "" && Number(log.fuel_added_gallons) < 0) {
    return "Fuel added must be zero or greater.";
  }
  return "";
}

async function submitComplete() {
  const problem = logs.value.map(invalidLog).find(Boolean);
  if (problem) {
    formError.value = problem;
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    await reviewServices.complete(activeRequest.value.id, { trip_logs: logs.value.map(logPayload) });
    closeDialog();
    await loadRequests();
  } catch (err) {
    formError.value = messageFrom(err, "Could not complete the request.");
  } finally {
    saving.value = false;
  }
}

function openLogs(request) {
  viewingLogs.value = request;
  dialog.value = "logs";
}

function openTrip(assignment) {
  editingLog.value = {
    id: assignment.trip_log.id,
    vehicle_name: assignment.vehicle_name,
    start_mileage: assignment.trip_log.start_mileage,
    end_mileage: assignment.trip_log.end_mileage,
    picked_up_at: toLocalInput(assignment.trip_log.picked_up_at),
    returned_at: toLocalInput(assignment.trip_log.returned_at),
    fuel_added_gallons: assignment.trip_log.fuel_added_gallons ?? "",
    issues_reported: assignment.trip_log.issues_reported || "",
  };
  formError.value = "";
  dialog.value = "trip";
}

async function submitTrip() {
  const problem = invalidLog(editingLog.value);
  if (problem) {
    formError.value = problem;
    return;
  }
  saving.value = true;
  formError.value = "";
  const payload = logPayload(editingLog.value);
  delete payload.assignment_id;
  try {
    await reviewServices.updateTripLog(editingLog.value.id, payload);
    closeDialog();
    await loadRequests();
  } catch (err) {
    formError.value = messageFrom(err, "Could not update the trip log.");
  } finally {
    saving.value = false;
  }
}

function openDestination() {
  editingDestination.value = null;
  destinationName.value = "";
  destinationActive.value = true;
  formError.value = "";
  dialog.value = "destination";
}

function openEditDestination(destination) {
  editingDestination.value = destination;
  destinationName.value = destination.name;
  destinationActive.value = destination.is_active;
  formError.value = "";
  dialog.value = "destination";
}

async function submitDestination() {
  const name = destinationName.value.trim();
  if (!name) {
    formError.value = "Required";
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    if (editingDestination.value) {
      await destinationServices.update(editingDestination.value.id, {
        name,
        is_active: destinationActive.value,
      });
    } else {
      await destinationServices.create({ name });
    }
    closeDialog();
    await loadDestinations();
  } catch (err) {
    formError.value = messageFrom(err, "Could not save the destination.");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-container>
    <h1 class="text-h5 mb-4">Review Requests</h1>

    <v-tabs v-model="tab" class="mb-4">
      <v-tab v-for="item in tabs" :key="item.value" :value="item.value">{{ item.title }}</v-tab>
    </v-tabs>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <p v-if="!loading && tab !== 'destinations' && requests.length === 0">No requests to review.</p>
    <p v-if="!loading && tab === 'destinations' && destinations.length === 0">
      No destinations yet. Create your first destination.
    </p>

    <v-table v-if="tab !== 'destinations' && requests.length">
      <thead>
        <tr>
          <th>Departure</th>
          <th>Return</th>
          <th>Area</th>
          <th>Requestor</th>
          <th>Destination</th>
          <th>Purpose</th>
          <th>Vehicle type</th>
          <th>Passengers</th>
          <th v-if="showVehicles">Vehicles</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="request in requests" :key="request.id">
          <td>{{ when(request.departure_at) }}</td>
          <td>{{ when(request.return_at) }}</td>
          <td>{{ request.area_name }}</td>
          <td>{{ request.requester_name }}</td>
          <td>{{ request.destination_name }}</td>
          <td>{{ request.purpose }}</td>
          <td>{{ request.vehicle_type_name }} × {{ request.vehicles_needed }}</td>
          <td>{{ request.passenger_count }}</td>
          <td v-if="showVehicles">
            <div v-for="assignment in request.assignments" :key="assignment.id">
              {{ assignment.vehicle_name }}
              <v-btn
                v-if="tab === 'completed' && assignment.trip_log"
                icon
                size="small"
                aria-label="Edit trip log"
                variant="text"
                @click="openTrip(assignment)"
              >
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
            </div>
          </td>
          <td>
            <template v-if="tab === 'pending'">
              <v-btn icon size="small" aria-label="Approve request" variant="text" @click="openApprove(request)">
                <v-icon>mdi-check</v-icon>
              </v-btn>
              <v-btn icon size="small" aria-label="Deny request" variant="text" @click="openDeny(request)">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </template>
            <template v-else-if="tab === 'approved'">
              <v-btn icon size="small" aria-label="Manage assignments" variant="text" @click="openManage(request)">
                <v-icon>mdi-car</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                aria-label="Complete request"
                variant="text"
                :disabled="!tripEnded(request)"
                @click="openComplete(request)"
              >
                <v-icon>mdi-flag-checkered</v-icon>
              </v-btn>
            </template>
            <v-btn
              v-else-if="tab === 'completed'"
              icon
              size="small"
              aria-label="View trip logs"
              variant="text"
              @click="openLogs(request)"
            >
              <v-icon>mdi-notebook</v-icon>
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <div v-if="tab === 'destinations'">
      <v-btn color="primary" class="oc-cta mb-4" @click="openDestination">+ New destination</v-btn>
      <v-table v-if="destinations.length">
        <thead>
          <tr>
            <th>Name</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="destination in destinations" :key="destination.id">
            <td>{{ destination.name }}</td>
            <td>{{ destination.is_active ? "Yes" : "No" }}</td>
            <td>
              <v-btn icon size="small" aria-label="Edit destination" variant="text" @click="openEditDestination(destination)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <v-dialog v-if="dialog === 'approve'" model-value max-width="720" @update:model-value="onDialog">
      <v-card>
        <v-card-title>Approve Request</v-card-title>
        <v-card-text v-if="activeRequest">
          <p>{{ when(activeRequest.departure_at) }} – {{ when(activeRequest.return_at) }}</p>
          <p>{{ activeRequest.destination_name }}</p>
          <p>{{ activeRequest.purpose }}</p>
          <p>{{ activeRequest.vehicle_type_name }} × {{ activeRequest.vehicles_needed }}</p>
          <p>{{ activeRequest.passenger_count }} passengers</p>
          <v-alert v-for="warning in warnings" :key="warning" type="warning" class="my-2">{{ warning }}</v-alert>
          <v-alert v-if="formError" type="error" class="my-2">{{ formError }}</v-alert>
          <div v-for="(row, index) in rows" :key="index" class="d-flex align-center ga-2 mb-2">
            <v-select
              v-model="row.vehicle_id"
              data-test="vehicle-select"
              label="Vehicle"
              :items="vehicles"
              item-title="name"
              item-value="id"
            />
            <v-select
              v-model="row.driver_id"
              data-test="driver-select"
              label="Driver"
              :items="drivers"
              item-title="name"
              item-value="id"
              clearable
            />
            <v-btn icon size="small" aria-label="Remove vehicle" variant="text" @click="removeRow(index)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
          <v-btn variant="text" @click="addRow">+ Add vehicle</v-btn>
          <v-textarea v-model="notes" label="Notes" class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submitApprove">Approve</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-if="dialog === 'deny'" model-value max-width="560" @update:model-value="onDialog">
      <v-card>
        <v-card-title>Deny Request</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-2">{{ formError }}</v-alert>
          <v-textarea v-model="reason" label="Reason" data-test="deny-reason" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submitDeny">Deny</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-if="dialog === 'manage'" model-value max-width="720" @update:model-value="onDialog">
      <v-card>
        <v-card-title>Manage Assignments</v-card-title>
        <v-card-text>
          <v-alert v-if="locked" type="warning" class="mb-2">Assignments are locked once the trip starts.</v-alert>
          <v-alert v-for="warning in warnings" :key="warning" type="warning" class="my-2">{{ warning }}</v-alert>
          <v-alert v-if="formError" type="error" class="my-2">{{ formError }}</v-alert>
          <div v-for="(row, index) in rows" :key="row.assignment_id || `new-${index}`" class="d-flex align-center ga-2 mb-2">
            <v-select
              v-model="row.vehicle_id"
              data-test="vehicle-select"
              label="Vehicle"
              :items="vehicles"
              item-title="name"
              item-value="id"
              :disabled="locked"
            />
            <v-select
              v-model="row.driver_id"
              data-test="driver-select"
              label="Driver"
              :items="drivers"
              item-title="name"
              item-value="id"
              clearable
              :disabled="locked"
            />
            <v-btn
              icon
              size="small"
              aria-label="Remove assignment"
              variant="text"
              :disabled="locked"
              @click="removeAssignment(row, index)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
          <v-btn variant="text" :disabled="locked" @click="addRow">+ Add vehicle</v-btn>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="closeDialog">Close</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" :disabled="locked" @click="submitManage">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-if="dialog === 'complete'" model-value max-width="720" @update:model-value="onDialog">
      <v-card>
        <v-card-title>Complete Request</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-2">{{ formError }}</v-alert>
          <div v-for="(log, index) in logs" :key="log.assignment_id" class="mb-4">
            <p class="text-subtitle-1">{{ log.vehicle_name }}</p>
            <v-text-field v-model="log.start_mileage" :data-test="`start-mileage-${index}`" label="Start Mileage" type="number" />
            <v-text-field v-model="log.end_mileage" :data-test="`end-mileage-${index}`" label="End Mileage" type="number" />
            <v-text-field v-model="log.picked_up_at" :data-test="`picked-up-${index}`" label="Picked Up At" type="datetime-local" />
            <v-text-field v-model="log.returned_at" :data-test="`returned-at-${index}`" label="Returned At" type="datetime-local" />
            <v-text-field v-model="log.fuel_added_gallons" label="Fuel Added (gallons)" type="number" />
            <v-textarea v-model="log.issues_reported" label="Issues Reported" />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submitComplete">Complete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-if="dialog === 'logs'" model-value max-width="640" @update:model-value="onDialog">
      <v-card v-if="viewingLogs">
        <v-card-title>Trip logs</v-card-title>
        <v-card-text>
          <div v-for="assignment in viewingLogs.assignments" :key="assignment.id" class="mb-3">
            <p>{{ assignment.vehicle_name }}</p>
            <p v-if="assignment.trip_log">End mileage {{ assignment.trip_log.end_mileage }}</p>
            <v-btn
              v-if="assignment.trip_log"
              size="small"
              aria-label="Edit trip log"
              variant="text"
              @click="openTrip(assignment)"
            >
              Edit trip log
            </v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-if="dialog === 'trip'" model-value max-width="640" @update:model-value="onDialog">
      <v-card v-if="editingLog">
        <v-card-title>Edit Trip Log</v-card-title>
        <v-card-text>
          <p>{{ editingLog.vehicle_name }}</p>
          <v-alert v-if="formError" type="error" class="mb-2">{{ formError }}</v-alert>
          <v-text-field v-model="editingLog.start_mileage" data-test="edit-start-mileage" label="Start Mileage" type="number" />
          <v-text-field v-model="editingLog.end_mileage" data-test="edit-end-mileage" label="End Mileage" type="number" />
          <v-text-field v-model="editingLog.picked_up_at" data-test="edit-picked-up" label="Picked Up At" type="datetime-local" />
          <v-text-field v-model="editingLog.returned_at" data-test="edit-returned-at" label="Returned At" type="datetime-local" />
          <v-text-field v-model="editingLog.fuel_added_gallons" label="Fuel Added (gallons)" type="number" />
          <v-textarea v-model="editingLog.issues_reported" label="Issues Reported" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submitTrip">Save Trip Log</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-if="dialog === 'destination'" model-value max-width="480" @update:model-value="onDialog">
      <v-card>
        <v-card-title>{{ editingDestination ? "Edit Destination" : "Add Destination" }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-2">{{ formError }}</v-alert>
          <v-text-field v-model="destinationName" data-test="destination-name" label="Name" />
          <v-switch v-if="editingDestination" v-model="destinationActive" label="Active" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submitDestination">
            {{ editingDestination ? "Save Destination" : "Create" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
