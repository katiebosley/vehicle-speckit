<script setup>
import { onMounted, ref } from "vue";
import vehicleTypeServices from "../services/vehicleTypeServices.js";

const types = ref([]);
const loading = ref(false);
const loadError = ref("");
const dialog = ref(false);
const editing = ref(null);
const saving = ref(false);
const formError = ref("");
const formRef = ref(null);

const form = ref({
  name: "",
  description: "",
  defaultPassengerCapacity: "",
  isActive: true,
});

const nameRules = [
  (value) => !!value?.trim() || "Required",
  (value) => !value || value.trim().length <= 50 || "Vehicle type name must be 50 characters or fewer.",
];

function resetForm() {
  form.value = {
    name: "",
    description: "",
    defaultPassengerCapacity: "",
    isActive: true,
  };
  formError.value = "";
  editing.value = null;
}

function openCreate() {
  resetForm();
  dialog.value = true;
}

function openEdit(type) {
  editing.value = type;
  form.value = {
    name: type.name,
    description: type.description || "",
    defaultPassengerCapacity: type.defaultPassengerCapacity ?? "",
    isActive: type.isActive,
  };
  formError.value = "";
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const response = await vehicleTypeServices.list();
    types.value = response.data;
  } catch (error) {
    loadError.value = error.response?.data?.message || "Unable to load vehicle types.";
  } finally {
    loading.value = false;
  }
}

function capacityPayload() {
  if (form.value.defaultPassengerCapacity === "" || form.value.defaultPassengerCapacity === null) {
    return null;
  }
  return Number(form.value.defaultPassengerCapacity);
}

async function submit() {
  const result = await formRef.value?.validate();
  if (!result?.valid) {
    return;
  }

  saving.value = true;
  formError.value = "";

  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || null,
    defaultPassengerCapacity: capacityPayload(),
  };

  try {
    if (editing.value) {
      payload.isActive = form.value.isActive;
      await vehicleTypeServices.update(editing.value.id, payload);
    } else {
      await vehicleTypeServices.create(payload);
    }
    dialog.value = false;
    await load();
  } catch (error) {
    formError.value = error.response?.data?.message || "Unable to save vehicle type.";
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Vehicle Types</h1>
      <v-btn color="primary" class="oc-cta" @click="openCreate">+ New type</v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="loadError" type="error" class="mb-4">{{ loadError }}</v-alert>

    <p v-if="!loading && !loadError && types.length === 0">
      No vehicle types yet. Create your first type.
    </p>

    <v-table v-else-if="!loading && types.length > 0">
      <thead>
        <tr>
          <th>name</th>
          <th>description</th>
          <th>default capacity</th>
          <th>status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="type in types" :key="type.id">
          <td>{{ type.name }}</td>
          <td>{{ type.description }}</td>
          <td>{{ type.defaultPassengerCapacity ?? "—" }}</td>
          <td>{{ type.isActive ? "Active" : "Inactive" }}</td>
          <td>
            <v-btn
              icon
              size="small"
              aria-label="Edit type"
              variant="text"
              @click="openEdit(type)"
            >
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ editing ? "Edit Vehicle Type" : "Add Vehicle Type" }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-form ref="formRef" @submit.prevent="submit">
            <v-text-field v-model="form.name" label="Name" :rules="nameRules" maxlength="50" />
            <v-textarea v-model="form.description" label="Description" rows="2" />
            <v-text-field
              v-model="form.defaultPassengerCapacity"
              label="Default passenger capacity"
              type="number"
              min="1"
              max="30"
            />
            <v-switch v-if="editing" v-model="form.isActive" label="Active" color="primary" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="submit">
            {{ editing ? "Save" : "Create" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
