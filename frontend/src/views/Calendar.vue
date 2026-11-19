<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Utils from "../config/utils.js";
import areaServices from "../services/areaServices.js";
import scheduleServices from "../services/scheduleServices.js";
import vehicleServices from "../services/vehicleServices.js";
import TripActions from "../components/TripActions.vue";

const user = Utils.getStore("user");
const view = ref("week");
const areas = ref([]);
const vehicles = ref([]);
const events = ref([]);
const areaId = ref(null);
const vehicleId = ref(null);
const loading = ref(false);
const error = ref("");

const vehicleOptions = computed(() => {
  if (!areaId.value) {
    return vehicles.value;
  }
  return vehicles.value.filter((vehicle) => vehicle.areaId === areaId.value);
});

function rangeFor(mode) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (mode === "month") {
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

function driverName(event) {
  return [event.driverFirstName, event.driverLastName].filter(Boolean).join(" ");
}

function canManage(event) {
  return user?.role === "admin" || user?.userId === event.driverId;
}

async function loadEvents() {
  loading.value = true;
  error.value = "";
  const range = rangeFor(view.value);
  const params = { ...range, view: view.value };
  if (areaId.value) {
    params.areaId = areaId.value;
  }
  if (vehicleId.value) {
    params.vehicleId = vehicleId.value;
  }
  try {
    const response = await scheduleServices.calendar(params);
    events.value = response.data;
  } catch (err) {
    events.value = [];
    error.value = err.response?.data?.message || "Could not load the calendar.";
  } finally {
    loading.value = false;
  }
}

async function loadFilters() {
  try {
    const [areaResponse, vehicleResponse] = await Promise.all([areaServices.mine(), vehicleServices.list()]);
    areas.value = areaResponse.data;
    vehicles.value = vehicleResponse.data;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not load calendar filters.";
  }
}

watch(areaId, () => {
  if (vehicleId.value && !vehicleOptions.value.some((vehicle) => vehicle.id === vehicleId.value)) {
    vehicleId.value = null;
  }
});

watch([view, areaId, vehicleId], loadEvents);

onMounted(async () => {
  await loadFilters();
  await loadEvents();
});
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">Calendar</h1>
    <div class="d-flex flex-wrap ga-4 mb-4">
      <v-btn-toggle v-model="view" mandatory color="primary" density="comfortable">
        <v-btn value="week">Week</v-btn>
        <v-btn value="month">Month</v-btn>
      </v-btn-toggle>
      <v-select
        v-model="areaId"
        :items="areas"
        item-title="name"
        item-value="id"
        label="Area"
        clearable
        hide-details
        style="max-width: 240px"
      />
      <v-select
        v-model="vehicleId"
        :items="vehicleOptions"
        item-title="name"
        item-value="id"
        label="Vehicle"
        clearable
        hide-details
        style="max-width: 240px"
      />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <p v-if="!loading && !error && events.length === 0">No assignments in this range.</p>

    <v-card v-for="event in events" :key="event.assignmentId" rounded="lg" class="pa-4 mb-3" elevation="1">
      <div>{{ event.vehicleName }} — {{ driverName(event) }}</div>
      <div class="text-body-2">{{ event.departureAt }} – {{ event.returnAt }}</div>
      <TripActions
        v-if="canManage(event)"
        :assignment-id="event.assignmentId"
        :picked-up-at="event.pickedUpAt"
        :returned-at="event.returnedAt"
        @saved="loadEvents"
      />
    </v-card>
  </v-container>
</template>
