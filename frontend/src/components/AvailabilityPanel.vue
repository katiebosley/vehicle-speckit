<script setup>
import { onMounted, ref } from "vue";
import scheduleServices from "../services/scheduleServices.js";
import vehicleTypeServices from "../services/vehicleTypeServices.js";

const types = ref([]);
const vehicleTypeId = ref(null);
const departureAt = ref("");
const returnAt = ref("");
const vehicles = ref(null);
const loading = ref(false);
const checking = ref(false);
const error = ref("");

function toIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadTypes() {
  loading.value = true;
  error.value = "";
  try {
    const response = await vehicleTypeServices.list();
    types.value = response.data;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not load vehicle types.";
  } finally {
    loading.value = false;
  }
}

async function check() {
  error.value = "";
  vehicles.value = null;
  const departure = toIso(departureAt.value);
  const ret = toIso(returnAt.value);
  if (!vehicleTypeId.value || !departure || !ret) {
    error.value = "Vehicle type, departure, and return are required.";
    return;
  }
  checking.value = true;
  try {
    const response = await scheduleServices.availability({
      vehicleTypeId: vehicleTypeId.value,
      departureAt: departure,
      returnAt: ret,
    });
    vehicles.value = response.data;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not check availability.";
  } finally {
    checking.value = false;
  }
}

onMounted(loadTypes);
</script>

<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <v-select
      v-model="vehicleTypeId"
      :items="types"
      item-title="name"
      item-value="id"
      label="Vehicle type"
      density="comfortable"
    />
    <v-text-field v-model="departureAt" label="Departure" type="datetime-local" density="comfortable" />
    <v-text-field v-model="returnAt" label="Return" type="datetime-local" density="comfortable" />
    <v-btn color="primary" class="oc-cta" :loading="checking" @click="check">Check availability</v-btn>
    <p v-if="vehicles && vehicles.length === 0" class="mt-4">No vehicles of this type are free for those dates.</p>
    <v-list v-else-if="vehicles?.length">
      <v-list-item v-for="vehicle in vehicles" :key="vehicle.id" :title="vehicle.name" :subtitle="vehicle.licensePlate" />
    </v-list>
  </div>
</template>
