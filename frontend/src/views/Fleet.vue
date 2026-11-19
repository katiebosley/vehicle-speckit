<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Utils from "../config/utils.js";
import areaServices from "../services/areaServices.js";
import vehicleServices from "../services/vehicleServices.js";
import vehicleTypeServices from "../services/vehicleTypeServices.js";

const makes = ["Chevrolet", "Ford", "GMC", "Honda", "Toyota", "Club Car"];
const models = ["Camry", "Colorado", "F-150", "Odyssey", "Transit", "Onward"];
const months = [
  { title: "January", value: 1 },
  { title: "February", value: 2 },
  { title: "March", value: 3 },
  { title: "April", value: 4 },
  { title: "May", value: 5 },
  { title: "June", value: 6 },
  { title: "July", value: 7 },
  { title: "August", value: 8 },
  { title: "September", value: 9 },
  { title: "October", value: 10 },
  { title: "November", value: 11 },
  { title: "December", value: 12 },
];
const statuses = [
  { title: "Available", value: "available" },
  { title: "Maintenance", value: "maintenance" },
  { title: "Retired", value: "retired" },
];
const statusLabels = {
  available: "Available",
  maintenance: "Maintenance",
  retired: "Retired",
};

const user = Utils.getStore("user");
const vehicles = ref([]);
const areas = ref([]);
const types = ref([]);
const loading = ref(false);
const loadError = ref("");
const filters = ref({ areaId: null, vehicleTypeId: null, status: null });

const dialog = ref(false);
const editing = ref(null);
const saving = ref(false);
const formError = ref("");
const formRef = ref(null);
const retireConfirm = ref(false);

const blockDialog = ref(false);
const blockVehicle = ref(null);
const blockError = ref("");
const blockSaving = ref(false);
const blockForm = ref({ startsAt: "", endsAt: "", reason: "" });

const emptyForm = () => ({
  areaId: null,
  vehicleTypeId: null,
  name: "",
  make: "",
  model: "",
  year: "",
  vin: "",
  purchasedDate: "",
  color: "",
  capacity: "",
  licensePlate: "",
  licensePlateExpireMonth: null,
  currentMileage: "",
  status: "available",
});

const form = ref(emptyForm());

const required = (value) => {
  if (value === undefined || value === null) return "Required";
  if (typeof value === "string" && value.trim() === "") return "Required";
  return true;
};

const writableAreas = computed(() => {
  const active = areas.value.filter((area) => area.isActive);
  if (editing.value && !active.some((area) => area.id === editing.value.areaId)) {
    active.push({ id: editing.value.areaId, name: editing.value.areaName, isActive: true });
  }
  return active;
});

const typeOptions = computed(() => {
  const options = types.value.filter((type) => type.isActive !== false);
  if (editing.value && !options.some((type) => type.id === editing.value.vehicleTypeId)) {
    options.push({
      id: editing.value.vehicleTypeId,
      name: editing.value.vehicleTypeName,
      defaultPassengerCapacity: null,
    });
  }
  return options;
});

const filtersActive = computed(() => Boolean(filters.value.areaId || filters.value.vehicleTypeId || filters.value.status));

function payload() {
  const body = {
    areaId: form.value.areaId,
    vehicleTypeId: form.value.vehicleTypeId,
    name: form.value.name.trim() || null,
    make: String(form.value.make || "").trim(),
    model: String(form.value.model || "").trim(),
    year: Number(form.value.year),
    vin: form.value.vin.trim(),
    purchasedDate: form.value.purchasedDate,
    color: form.value.color.trim(),
    capacity: Number(form.value.capacity),
    licensePlate: form.value.licensePlate.trim(),
    licensePlateExpireMonth: form.value.licensePlateExpireMonth,
    currentMileage: Number(form.value.currentMileage),
  };
  if (editing.value) {
    body.status = form.value.status;
  }
  return body;
}

async function loadVehicles() {
  loading.value = true;
  loadError.value = "";
  try {
    const params = {};
    if (filters.value.areaId) params.areaId = filters.value.areaId;
    if (filters.value.vehicleTypeId) params.vehicleTypeId = filters.value.vehicleTypeId;
    if (filters.value.status) params.status = filters.value.status;
    const response = await vehicleServices.list(params);
    vehicles.value = response.data;
  } catch (error) {
    loadError.value = error.response?.data?.message || "Unable to load vehicles.";
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const areaRequest = user?.role === "admin" ? areaServices.list() : areaServices.mine();
  const [areaResponse, typeResponse] = await Promise.all([areaRequest, vehicleTypeServices.list()]);
  areas.value = areaResponse.data;
  types.value = typeResponse.data;
}

function openCreate() {
  editing.value = null;
  form.value = emptyForm();
  formError.value = "";
  dialog.value = true;
}

function openEdit(vehicle) {
  editing.value = vehicle;
  form.value = {
    areaId: vehicle.areaId,
    vehicleTypeId: vehicle.vehicleTypeId,
    name: vehicle.name || "",
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vin: vehicle.vin,
    purchasedDate: vehicle.purchasedDate,
    color: vehicle.color,
    capacity: vehicle.capacity,
    licensePlate: vehicle.licensePlate,
    licensePlateExpireMonth: vehicle.licensePlateExpireMonth,
    currentMileage: vehicle.currentMileage,
    status: vehicle.status,
  };
  formError.value = "";
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
  retireConfirm.value = false;
}

async function save() {
  saving.value = true;
  formError.value = "";
  try {
    if (editing.value) {
      await vehicleServices.update(editing.value.id, payload());
    } else {
      await vehicleServices.create(payload());
    }
    dialog.value = false;
    await loadVehicles();
  } catch (error) {
    formError.value = error.response?.data?.message || "Unable to save vehicle.";
  } finally {
    saving.value = false;
  }
}

async function submit() {
  const result = await formRef.value?.validate();
  if (!result?.valid) {
    return;
  }
  if (editing.value && form.value.status === "retired" && editing.value.status !== "retired") {
    retireConfirm.value = true;
    return;
  }
  await save();
}

function cancelRetire() {
  retireConfirm.value = false;
  form.value.status = editing.value.status;
}

async function confirmRetire() {
  retireConfirm.value = false;
  await save();
}

async function openBlocks(vehicle) {
  blockError.value = "";
  blockForm.value = { startsAt: "", endsAt: "", reason: "" };
  try {
    const response = await vehicleServices.get(vehicle.id);
    blockVehicle.value = response.data;
    blockDialog.value = true;
  } catch (error) {
    loadError.value = error.response?.data?.message || "Unable to load vehicle.";
  }
}

async function addBlock() {
  blockSaving.value = true;
  blockError.value = "";
  try {
    await vehicleServices.addBlock(blockVehicle.value.id, {
      startsAt: new Date(blockForm.value.startsAt).toISOString(),
      endsAt: new Date(blockForm.value.endsAt).toISOString(),
      reason: blockForm.value.reason.trim(),
    });
    const response = await vehicleServices.get(blockVehicle.value.id);
    blockVehicle.value = response.data;
    blockForm.value = { startsAt: "", endsAt: "", reason: "" };
  } catch (error) {
    blockError.value = error.response?.data?.message || "Unable to block vehicle.";
  } finally {
    blockSaving.value = false;
  }
}

async function removeBlock(windowId) {
  blockError.value = "";
  try {
    await vehicleServices.removeBlock(blockVehicle.value.id, windowId);
    const response = await vehicleServices.get(blockVehicle.value.id);
    blockVehicle.value = response.data;
  } catch (error) {
    blockError.value = error.response?.data?.message || "Unable to remove block.";
  }
}

watch(
  () => form.value.vehicleTypeId,
  (typeId) => {
    const type = typeOptions.value.find((item) => item.id === typeId);
    if (!type || type.defaultPassengerCapacity == null) {
      return;
    }
    if (form.value.capacity === "" || form.value.capacity === null) {
      form.value.capacity = type.defaultPassengerCapacity;
    }
  }
);

watch(filters, loadVehicles, { deep: true });

onMounted(async () => {
  try {
    await loadOptions();
  } catch (error) {
    loadError.value = error.response?.data?.message || "Unable to load vehicles.";
  }
  await loadVehicles();
});
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Fleet</h1>
      <v-btn color="primary" class="oc-cta" @click="openCreate">+ New vehicle</v-btn>
    </div>

    <div class="d-flex flex-wrap ga-4 mb-4">
      <v-select
        v-model="filters.areaId"
        :items="areas"
        item-title="name"
        item-value="id"
        label="Area"
        clearable
        hide-details
        style="max-width: 220px"
      />
      <v-select
        v-model="filters.vehicleTypeId"
        :items="types"
        item-title="name"
        item-value="id"
        label="Type"
        clearable
        hide-details
        style="max-width: 220px"
      />
      <v-select
        v-model="filters.status"
        :items="[{ title: 'Any', value: null }, ...statuses]"
        label="Status"
        hide-details
        style="max-width: 220px"
      />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="loadError" type="error" class="mb-4">{{ loadError }}</v-alert>

    <p v-if="!loading && !loadError && vehicles.length === 0 && !filtersActive">
      No vehicles yet. Add your first vehicle.
    </p>
    <p v-else-if="!loading && !loadError && vehicles.length === 0">
      No vehicles match these filters.
    </p>

    <v-table v-else-if="!loading && vehicles.length > 0">
      <thead>
        <tr>
          <th>vehicle</th>
          <th>plate</th>
          <th>type</th>
          <th>area</th>
          <th>seats</th>
          <th>mileage</th>
          <th>status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="vehicle in vehicles" :key="vehicle.id">
          <td>{{ vehicle.displayName }}</td>
          <td>{{ vehicle.licensePlate }}</td>
          <td>{{ vehicle.vehicleTypeName }}</td>
          <td>{{ vehicle.areaName }}</td>
          <td>{{ vehicle.capacity }}</td>
          <td>{{ vehicle.currentMileage }}</td>
          <td>{{ statusLabels[vehicle.status] }}</td>
          <td>
            <v-btn icon size="small" aria-label="Edit vehicle" variant="text" @click="openEdit(vehicle)">
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
            <v-btn icon size="small" aria-label="Block dates" variant="text" @click="openBlocks(vehicle)">
              <v-icon>mdi-calendar-lock</v-icon>
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>{{ editing ? "Edit Vehicle" : "Add Vehicle" }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-form ref="formRef" @submit.prevent="submit">
            <v-select v-model="form.areaId" :items="writableAreas" item-title="name" item-value="id" label="Area" :rules="[required]" />
            <v-select v-model="form.vehicleTypeId" :items="typeOptions" item-title="name" item-value="id" label="Type" :rules="[required]" />
            <v-text-field v-model="form.name" label="Name" />
            <v-combobox v-model="form.make" :items="makes" label="Make" :rules="[required]" />
            <v-combobox v-model="form.model" :items="models" label="Model" :rules="[required]" />
            <v-text-field v-model="form.year" label="Year" type="number" :rules="[required]" />
            <v-text-field v-model="form.vin" label="VIN" :rules="[required]" />
            <v-text-field v-model="form.purchasedDate" label="Purchased date" type="date" :rules="[required]" />
            <v-text-field v-model="form.color" label="Color" :rules="[required]" />
            <v-text-field v-model="form.capacity" label="Capacity" type="number" :rules="[required]" />
            <v-text-field v-model="form.licensePlate" label="License plate" :rules="[required]" />
            <v-select v-model="form.licensePlateExpireMonth" :items="months" label="Plate expire month" :rules="[required]" />
            <v-text-field v-model="form.currentMileage" label="Current mileage" type="number" :rules="[required]" />
            <v-select v-if="editing" v-model="form.status" :items="statuses" label="Status" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submit">
            {{ editing ? "Save" : "Create" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="retireConfirm" max-width="480">
      <v-card>
        <v-card-text class="pt-6">
          Retire this vehicle? It stays on the fleet list and cannot be reserved for new trips.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelRetire">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" @click="confirmRetire">Retire</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="blockDialog" max-width="640">
      <v-card v-if="blockVehicle">
        <v-card-title>Block dates — {{ blockVehicle.displayName }}</v-card-title>
        <v-card-text>
          <v-alert v-if="blockError" type="error" class="mb-4">{{ blockError }}</v-alert>
          <div v-for="window in blockVehicle.unavailability || []" :key="window.id" class="d-flex align-center justify-space-between mb-2">
            <span>{{ window.startsAt }} — {{ window.endsAt }} — {{ window.reason }}</span>
            <v-btn variant="text" @click="removeBlock(window.id)">Remove block</v-btn>
          </div>
          <v-text-field v-model="blockForm.startsAt" label="Start" type="datetime-local" />
          <v-text-field v-model="blockForm.endsAt" label="End" type="datetime-local" />
          <v-text-field v-model="blockForm.reason" label="Reason" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="blockDialog = false">Close</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="blockSaving" @click="addBlock">Add block</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
