<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import requestServices from "../services/requestServices.js";

const route = useRoute();
const props = defineProps({
  id: { type: [String, Number], default: "" },
});

const requestRow = ref(null);
const loading = ref(false);
const error = ref("");
const confirmOpen = ref(false);
const cancelling = ref(false);

const requestId = () => props.id || route.params.id;

function formatWhen(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

const cancellable = computed(() => {
  const row = requestRow.value;
  if (!row) {
    return false;
  }
  if (row.status === "pending") {
    return true;
  }
  return row.status === "approved" && new Date(row.departureAt).getTime() > Date.now();
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await requestServices.get(requestId());
    requestRow.value = res.data;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not load the request.";
  } finally {
    loading.value = false;
  }
}

async function cancelRequest() {
  cancelling.value = true;
  error.value = "";
  try {
    const res = await requestServices.cancel(requestId());
    requestRow.value = { ...requestRow.value, ...res.data, assignments: requestRow.value?.assignments ?? [] };
    confirmOpen.value = false;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not cancel the request.";
    confirmOpen.value = false;
  } finally {
    cancelling.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Request Detail</h1>
      <div v-if="requestRow">
        <v-btn
          v-if="requestRow.status === 'pending'"
          color="primary"
          variant="elevated"
          class="oc-cta"
          :to="{ name: 'request-edit', params: { id: requestRow.id } }"
        >
          Edit
        </v-btn>
        <v-btn
          v-if="cancellable"
          class="ml-2"
          color="secondary"
          variant="outlined"
          data-test="cancel-request"
          @click="confirmOpen = true"
        >
          Cancel request
        </v-btn>
      </div>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" data-test="detail-loading" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <v-card v-if="requestRow" rounded="lg" class="pa-4" elevation="2">
      <p><strong>Purpose:</strong> {{ requestRow.purpose }}</p>
      <p><strong>Destination:</strong> {{ requestRow.destination }}</p>
      <p><strong>Area:</strong> {{ requestRow.areaName }}</p>
      <p><strong>Departure:</strong> {{ formatWhen(requestRow.departureAt) }}</p>
      <p><strong>Return:</strong> {{ formatWhen(requestRow.returnAt) }}</p>
      <p><strong>Passengers:</strong> {{ requestRow.passengerCount }}</p>
      <p><strong>Vehicle type:</strong> {{ requestRow.vehicleTypeName }}</p>
      <p><strong>Vehicles needed:</strong> {{ requestRow.vehiclesNeeded }}</p>
      <p><strong>Status:</strong> {{ requestRow.status }}</p>

      <h2 class="text-h6 mt-6">Review</h2>
      <p v-if="requestRow.reviewNotes">{{ requestRow.reviewNotes }}</p>
      <p v-else>No review notes yet.</p>
      <p v-if="requestRow.reviewer">
        {{ requestRow.reviewer.firstName }} {{ requestRow.reviewer.lastName }}
      </p>
      <p v-if="requestRow.reviewedAt">{{ formatWhen(requestRow.reviewedAt) }}</p>

      <h2 class="text-h6 mt-6">Assignments</h2>
      <ul v-if="requestRow.assignments?.length">
        <li v-for="item in requestRow.assignments" :key="item.id">
          {{ item.vehicle?.name }}
          {{ item.vehicle?.licensePlate }}
          <span v-if="item.driver">{{ item.driver.firstName }} {{ item.driver.lastName }}</span>
        </li>
      </ul>
      <p v-else>No vehicles assigned yet.</p>
    </v-card>

    <v-dialog v-model="confirmOpen" max-width="480">
      <v-card rounded="lg">
        <v-card-title>Cancel this request?</v-card-title>
        <v-card-text>This request will be cancelled.</v-card-text>
        <v-card-actions>
          <v-btn color="primary" variant="elevated" class="oc-cta" :loading="cancelling" @click="cancelRequest">
            Cancel Request
          </v-btn>
          <v-btn color="secondary" variant="text" @click="confirmOpen = false">Keep request</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
