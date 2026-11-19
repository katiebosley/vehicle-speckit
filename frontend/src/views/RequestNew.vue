<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import areaServices from "../services/areaServices.js";
import requestServices from "../services/requestServices.js";
import vehicleTypeServices from "../services/vehicleTypeServices.js";
import RequestForm from "../components/RequestForm.vue";
import AvailabilityPanel from "../components/AvailabilityPanel.vue";

const router = useRouter();
const areas = ref([]);
const vehicleTypes = ref([]);
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);
const error = ref("");

async function loadOptions() {
  loading.value = true;
  loadError.value = "";
  try {
    const [areaRes, typeRes] = await Promise.all([areaServices.list(), vehicleTypeServices.list()]);
    areas.value = areaRes.data;
    vehicleTypes.value = typeRes.data;
  } catch (err) {
    loadError.value = err.response?.data?.message || "Could not load the request form.";
  } finally {
    loading.value = false;
  }
}

async function submit(payload) {
  saving.value = true;
  error.value = "";
  try {
    const res = await requestServices.create(payload);
    router.push({ name: "request-detail", params: { id: res.data.id } });
  } catch (err) {
    error.value = err.response?.data?.message || "Could not submit the request.";
  } finally {
    saving.value = false;
  }
}

onMounted(loadOptions);
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">New Request</h1>
    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-if="loadError" type="error">{{ loadError }}</v-alert>
    <v-card v-else-if="!loading" rounded="lg" class="pa-4" elevation="2">
      <RequestForm
        :areas="areas"
        :vehicle-types="vehicleTypes"
        submit-label="Submit Request"
        :saving="saving"
        :error="error"
        @submit="submit"
        @cancel="router.push({ name: 'my-requests' })"
      />
    </v-card>
    <v-card v-if="!loading && !loadError" rounded="lg" class="pa-4 mt-4" elevation="2">
      <h2 class="text-h5 mb-4">Check availability</h2>
      <AvailabilityPanel />
    </v-card>
  </v-container>
</template>
