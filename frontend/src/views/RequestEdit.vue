<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import areaServices from "../services/areaServices.js";
import requestServices from "../services/requestServices.js";
import vehicleTypeServices from "../services/vehicleTypeServices.js";
import RequestForm from "../components/RequestForm.vue";

const route = useRoute();
const router = useRouter();
const props = defineProps({
  id: { type: [String, Number], default: "" },
});

const areas = ref([]);
const vehicleTypes = ref([]);
const requestRow = ref(null);
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);
const error = ref("");

const requestId = () => props.id || route.params.id;

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [requestRes, areaRes, typeRes] = await Promise.all([
      requestServices.get(requestId()),
      areaServices.list(),
      vehicleTypeServices.list(),
    ]);
    requestRow.value = requestRes.data;
    areas.value = areaRes.data;
    vehicleTypes.value = typeRes.data;
  } catch (err) {
    loadError.value = err.response?.data?.message || "Could not load the request.";
  } finally {
    loading.value = false;
  }
}

async function submit(payload) {
  saving.value = true;
  error.value = "";
  try {
    const res = await requestServices.update(requestId(), payload);
    router.push({ name: "request-detail", params: { id: res.data.id } });
  } catch (err) {
    error.value = err.response?.data?.message || "Could not save the request.";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">Edit Request</h1>
    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-if="loadError" type="error">{{ loadError }}</v-alert>
    <v-alert
      v-else-if="requestRow && requestRow.status !== 'pending'"
      type="error"
      data-test="edit-blocked"
    >
      Only pending requests can be edited.
    </v-alert>
    <v-card v-else-if="requestRow" rounded="lg" class="pa-4" elevation="2">
      <RequestForm
        :areas="areas"
        :vehicle-types="vehicleTypes"
        :initial="requestRow"
        submit-label="Save Changes"
        :saving="saving"
        :error="error"
        @submit="submit"
        @cancel="router.push({ name: 'request-detail', params: { id: requestId() } })"
      />
    </v-card>
  </v-container>
</template>
