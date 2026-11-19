<script setup>
import { onMounted, ref } from "vue";
import Utils from "../config/utils.js";
import scheduleServices from "../services/scheduleServices.js";
import TripActions from "../components/TripActions.vue";

const user = Utils.getStore("user");
const dashboard = ref(null);
const loading = ref(false);
const error = ref("");

function canManage(trip) {
  return user?.role === "admin" || user?.userId === trip.driverId;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const response = await scheduleServices.dashboard();
    dashboard.value = response.data;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not load the dashboard.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 mb-4">Welcome, {{ user?.firstName }}</h1>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <template v-if="dashboard?.role === 'requestor'">
      <h2 class="text-h5 mb-2">Pending requests</h2>
      <p v-if="dashboard.pendingRequests.length === 0">No pending requests.</p>
      <v-list v-else class="mb-4">
        <v-list-item
          v-for="item in dashboard.pendingRequests"
          :key="item.id"
          :to="{ name: 'request-detail', params: { id: item.id } }"
          :title="item.purpose"
          :subtitle="item.departureAt"
        />
      </v-list>

      <h2 class="text-h5 mb-2">Upcoming trips</h2>
      <p v-if="dashboard.upcomingTrips.length === 0">No upcoming trips.</p>
      <v-card v-for="trip in dashboard.upcomingTrips" :key="trip.assignmentId" rounded="lg" class="pa-4 mb-3">
        <div>{{ trip.vehicleName }}</div>
        <div class="text-body-2">{{ trip.departureAt }}</div>
        <TripActions
          v-if="canManage(trip)"
          :assignment-id="trip.assignmentId"
          :picked-up-at="trip.pickedUpAt"
          :returned-at="trip.returnedAt"
          @saved="load"
        />
      </v-card>
      <v-btn color="primary" class="oc-cta mt-4" :to="{ name: 'request-new' }">New Request</v-btn>
    </template>

    <template v-else-if="dashboard?.role === 'area_admin'">
      <h2 class="text-h5 mb-2">Pending requests</h2>
      <p v-if="dashboard.pendingRequests.length === 0">No pending requests for your areas.</p>
      <v-list v-else class="mb-4">
        <v-list-item
          v-for="item in dashboard.pendingRequests"
          :key="item.id"
          :title="item.purpose"
          :subtitle="item.departureAt"
        />
      </v-list>
      <h2 class="text-h5 mb-2">Vehicles in maintenance</h2>
      <p v-if="dashboard.maintenanceVehicles.length === 0">No vehicles in maintenance.</p>
      <v-list v-else class="mb-4">
        <v-list-item v-for="vehicle in dashboard.maintenanceVehicles" :key="vehicle.id" :title="vehicle.name" />
      </v-list>
      <v-btn color="primary" class="oc-cta" :to="{ name: 'calendar' }">Calendar</v-btn>
    </template>

    <template v-else-if="dashboard?.role === 'admin'">
      <p class="mb-2">Pending requests: {{ dashboard.pendingRequestCount }}</p>
      <p class="mb-4">Vehicles in maintenance: {{ dashboard.maintenanceVehicleCount }}</p>
      <h2 class="text-h5 mb-2">Pending requests</h2>
      <p v-if="dashboard.pendingRequests.length === 0">No pending requests.</p>
      <v-list v-else class="mb-4">
        <v-list-item
          v-for="item in dashboard.pendingRequests"
          :key="item.id"
          :title="item.purpose"
          :subtitle="item.status"
        />
      </v-list>
      <v-btn color="primary" class="oc-cta" :to="{ name: 'calendar' }">Calendar</v-btn>
    </template>
  </v-container>
</template>
