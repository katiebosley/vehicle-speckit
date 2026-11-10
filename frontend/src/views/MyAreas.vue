<script setup>
import { onMounted, ref } from "vue";
import areaServices from "../services/areaServices.js";

const areas = ref([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    const response = await areaServices.getMyAreas();
    areas.value = response.data;
  } catch (err) {
    error.value = err?.response?.data?.message || "Request failed.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">My Areas</h1>

    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-else-if="error" type="error">{{ error }}</v-alert>
    <p v-else-if="areas.length === 0">You are not assigned to any areas yet.</p>

    <v-card v-else rounded="lg" elevation="2">
      <v-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="area in areas" :key="area.id">
            <td>
              {{ area.name }}
              <v-chip v-if="!area.isActive" size="small" class="ml-2">Inactive</v-chip>
            </td>
            <td>{{ area.description }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>
