<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  areas: { type: Array, default: () => [] },
  vehicleTypes: { type: Array, default: () => [] },
  initial: { type: Object, default: null },
  submitLabel: { type: String, required: true },
  saving: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const emit = defineEmits(["submit", "cancel"]);

function toLocalInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const form = ref({
  areaId: null,
  purpose: "",
  destination: "",
  departureAt: "",
  returnAt: "",
  passengerCount: "",
  vehicleTypeId: null,
  vehiclesNeeded: 1,
});
const localError = ref("");

watch(
  () => props.initial,
  (value) => {
    if (!value) {
      return;
    }
    form.value = {
      areaId: value.areaId ?? null,
      purpose: value.purpose ?? "",
      destination: value.destination ?? "",
      departureAt: toLocalInput(value.departureAt),
      returnAt: toLocalInput(value.returnAt),
      passengerCount: value.passengerCount ?? "",
      vehicleTypeId: value.vehicleTypeId ?? null,
      vehiclesNeeded: value.vehiclesNeeded ?? 1,
    };
  },
  { immediate: true }
);

function vehiclesNeededValue() {
  const value = form.value.vehiclesNeeded;
  if (value === "" || value === null || value === undefined) {
    return 1;
  }
  return Number(value);
}

function validationMessage() {
  const purpose = String(form.value.purpose ?? "");
  const destination = String(form.value.destination ?? "");
  const passenger = form.value.passengerCount;

  if (
    !form.value.areaId ||
    !purpose.trim() ||
    !destination.trim() ||
    !form.value.departureAt ||
    !form.value.returnAt ||
    passenger === "" ||
    passenger === null ||
    passenger === undefined ||
    !form.value.vehicleTypeId
  ) {
    return "All required fields must be provided.";
  }

  const departure = new Date(form.value.departureAt);
  const returning = new Date(form.value.returnAt);
  if (Number.isNaN(departure.getTime()) || Number.isNaN(returning.getTime())) {
    return "All required fields must be provided.";
  }
  if (returning.getTime() <= departure.getTime()) {
    return "Return must be after departure.";
  }
  if (departure.getTime() <= Date.now()) {
    return "Departure must be in the future.";
  }

  const passengers = Number(passenger);
  const vehicles = vehiclesNeededValue();
  if (!Number.isInteger(passengers) || passengers < 1 || !Number.isInteger(vehicles) || vehicles < 1) {
    return "Passenger count and vehicles needed must be at least 1.";
  }
  return "";
}

function onSubmit() {
  localError.value = validationMessage();
  if (localError.value) {
    return;
  }

  emit("submit", {
    areaId: form.value.areaId,
    purpose: String(form.value.purpose).trim(),
    destination: String(form.value.destination).trim(),
    departureAt: new Date(form.value.departureAt).toISOString(),
    returnAt: new Date(form.value.returnAt).toISOString(),
    passengerCount: Number(form.value.passengerCount),
    vehicleTypeId: form.value.vehicleTypeId,
    vehiclesNeeded: vehiclesNeededValue(),
  });
}
</script>

<template>
  <v-form @submit.prevent="onSubmit">
    <v-alert v-if="localError || error" type="error" class="mb-4" data-test="form-error">
      {{ localError || error }}
    </v-alert>

    <v-row>
      <v-col cols="12" md="6">
        <v-select
          v-model="form.areaId"
          :items="areas"
          item-title="name"
          item-value="id"
          label="Area"
          density="comfortable"
          data-test="area"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="form.vehicleTypeId"
          :items="vehicleTypes"
          item-title="name"
          item-value="id"
          label="Vehicle type"
          density="comfortable"
          data-test="vehicle-type"
        />
      </v-col>
      <v-col cols="12">
        <v-text-field v-model="form.purpose" label="Purpose" density="comfortable" data-test="purpose" />
      </v-col>
      <v-col cols="12">
        <v-text-field v-model="form.destination" label="Destination" density="comfortable" data-test="destination" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.departureAt"
          label="Departure"
          type="datetime-local"
          density="comfortable"
          data-test="departure"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.returnAt"
          label="Return"
          type="datetime-local"
          density="comfortable"
          data-test="return"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.passengerCount"
          label="Passenger count"
          type="number"
          min="1"
          density="comfortable"
          data-test="passenger-count"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.vehiclesNeeded"
          label="Vehicles needed"
          type="number"
          min="1"
          density="comfortable"
          data-test="vehicles-needed"
        />
      </v-col>
    </v-row>

    <div class="d-flex mt-2">
      <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="saving">
        {{ submitLabel }}
      </v-btn>
      <v-btn class="ml-2" color="secondary" variant="text" type="button" @click="emit('cancel')">
        Cancel
      </v-btn>
    </div>
  </v-form>
</template>
