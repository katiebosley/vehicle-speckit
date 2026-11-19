<script setup>
import { computed, ref } from "vue";
import scheduleServices from "../services/scheduleServices.js";

const props = defineProps({
  assignmentId: { type: Number, required: true },
  pickedUpAt: { type: String, default: null },
  returnedAt: { type: String, default: null },
});

const emit = defineEmits(["saved"]);

const startMileage = ref("");
const endMileage = ref("");
const fuelAddedGallons = ref("");
const issuesReported = ref("");
const saving = ref(false);
const error = ref("");

const open = computed(() => Boolean(props.pickedUpAt) && !props.returnedAt);
const finished = computed(() => Boolean(props.returnedAt));

async function checkOut() {
  if (startMileage.value === "" || startMileage.value === null) {
    error.value = "Start mileage is required.";
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await scheduleServices.checkout(props.assignmentId, { startMileage: Number(startMileage.value) });
    emit("saved");
  } catch (err) {
    error.value = err.response?.data?.message || "Could not check out the vehicle.";
  } finally {
    saving.value = false;
  }
}

async function checkIn() {
  if (endMileage.value === "" || endMileage.value === null) {
    error.value = "End mileage is required.";
    return;
  }
  saving.value = true;
  error.value = "";
  const fuel = fuelAddedGallons.value === "" ? null : Number(fuelAddedGallons.value);
  try {
    await scheduleServices.checkin(props.assignmentId, {
      endMileage: Number(endMileage.value),
      fuelAddedGallons: fuel,
      issuesReported: issuesReported.value.trim() || null,
    });
    emit("saved");
  } catch (err) {
    error.value = err.response?.data?.message || "Could not check in the vehicle.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="!finished" class="mt-2">
    <v-alert v-if="error" type="error" density="compact" class="mb-2">{{ error }}</v-alert>
    <template v-if="!open">
      <v-text-field v-model="startMileage" label="Start mileage" type="number" density="comfortable" />
      <v-btn color="primary" class="oc-cta" :loading="saving" @click="checkOut">Check Out</v-btn>
    </template>
    <template v-else>
      <v-text-field v-model="endMileage" label="End mileage" type="number" density="comfortable" />
      <v-text-field v-model="fuelAddedGallons" label="Fuel added (gallons)" type="number" density="comfortable" />
      <v-text-field v-model="issuesReported" label="Issues" density="comfortable" />
      <v-btn color="primary" class="oc-cta" :loading="saving" @click="checkIn">Check In</v-btn>
    </template>
  </div>
</template>
