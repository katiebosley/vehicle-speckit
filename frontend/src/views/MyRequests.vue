<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import requestServices from "../services/requestServices.js";

const router = useRouter();
const requests = ref([]);
const loading = ref(false);
const error = ref("");

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

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await requestServices.list();
    requests.value = res.data;
  } catch (err) {
    error.value = err.response?.data?.message || "Could not load requests.";
  } finally {
    loading.value = false;
  }
}

function openRequest(row) {
  router.push({ name: "request-detail", params: { id: row.id } });
}

onMounted(load);
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">My Requests</h1>
      <v-btn color="primary" variant="elevated" class="oc-cta" :to="{ name: 'request-new' }">
        New Request
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" data-test="requests-loading" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <p v-if="!loading && !error && requests.length === 0" data-test="requests-empty">
      No requests yet. Create your first request.
    </p>

    <v-card v-else-if="requests.length > 0" rounded="lg" elevation="2">
      <v-table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Area</th>
            <th>Departure</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in requests"
            :key="row.id"
            data-test="request-row"
            @click="openRequest(row)"
          >
            <td>{{ row.purpose }}</td>
            <td>{{ row.areaName || "" }}</td>
            <td>{{ formatWhen(row.departureAt) }}</td>
            <td>{{ row.status }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>
