<script setup>
import { computed, onMounted, ref } from "vue";
import areaServices from "../services/areaServices.js";
import userServices from "../services/userServices.js";

const areas = ref([]);
const loading = ref(true);
const error = ref("");

const dialog = ref(false);
const editing = ref(null);
const formRef = ref(null);
const saving = ref(false);
const formError = ref("");
const form = ref({ name: "", description: "", isActive: true });

const adminDialog = ref(false);
const selectedArea = ref(null);
const users = ref([]);
const selectedUserId = ref(null);
const adminError = ref("");
const adminSaving = ref(false);

const nameRules = [
  (value) => !!value?.trim() || "Required",
  (value) => (value || "").trim().length <= 100 || "Area name must be 100 characters or fewer.",
];

const dialogTitle = computed(() => (editing.value ? "Edit Area" : "Add Area"));
const saveLabel = computed(() => (editing.value ? "Save" : "Create"));

const candidateAdmins = computed(() => {
  const assigned = new Set((selectedArea.value?.admins || []).map((admin) => admin.id));
  return users.value
    .filter((user) => user.role === "area_admin" && user.isActive && !assigned.has(user.id))
    .map((user) => ({ ...user, fullName: `${user.firstName} ${user.lastName}` }));
});

function requestFailed(err) {
  return err?.response?.data?.message || "Request failed.";
}

async function loadAreas() {
  loading.value = true;
  error.value = "";
  try {
    const response = await areaServices.getAreas();
    areas.value = response.data;
  } catch (err) {
    error.value = requestFailed(err);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  form.value = { name: "", description: "", isActive: true };
  formError.value = "";
  dialog.value = true;
}

function openEdit(area) {
  editing.value = area;
  form.value = {
    name: area.name,
    description: area.description || "",
    isActive: area.isActive,
  };
  formError.value = "";
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
  formError.value = "";
}

async function saveArea() {
  const result = await formRef.value?.validate();
  if (!result || result.valid === false) {
    return;
  }

  saving.value = true;
  formError.value = "";
  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
  };
  if (editing.value) {
    payload.isActive = form.value.isActive;
  }

  try {
    if (editing.value) {
      await areaServices.updateArea(editing.value.id, payload);
    } else {
      await areaServices.createArea(payload);
    }
    dialog.value = false;
    await loadAreas();
  } catch (err) {
    formError.value = requestFailed(err);
  } finally {
    saving.value = false;
  }
}

async function openAdmins(area) {
  selectedArea.value = area;
  selectedUserId.value = null;
  adminError.value = "";
  adminDialog.value = true;
  try {
    const response = await userServices.getUsers();
    users.value = response.data;
  } catch (err) {
    users.value = [];
    adminError.value = requestFailed(err);
  }
}

function replaceArea(updated) {
  areas.value = areas.value.map((area) => (area.id === updated.id ? updated : area));
  if (selectedArea.value?.id === updated.id) {
    selectedArea.value = updated;
  }
}

async function addAdmin() {
  if (!selectedUserId.value || !selectedArea.value) {
    return;
  }
  adminSaving.value = true;
  adminError.value = "";
  try {
    const response = await areaServices.assignAdmin(selectedArea.value.id, selectedUserId.value);
    replaceArea(response.data);
    selectedUserId.value = null;
  } catch (err) {
    adminError.value = requestFailed(err);
  } finally {
    adminSaving.value = false;
  }
}

async function removeAdmin(admin) {
  adminSaving.value = true;
  adminError.value = "";
  try {
    const response = await areaServices.removeAdmin(selectedArea.value.id, admin.id);
    replaceArea(response.data);
  } catch (err) {
    adminError.value = requestFailed(err);
  } finally {
    adminSaving.value = false;
  }
}

onMounted(loadAreas);
</script>

<template>
  <v-container class="py-8">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Areas</h1>
      <v-btn color="primary" class="oc-cta" @click="openCreate">+ New area</v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-else-if="error" type="error">{{ error }}</v-alert>
    <p v-else-if="areas.length === 0">No areas yet. Create your first area.</p>

    <v-card v-else rounded="lg" elevation="2">
      <v-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Admins</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="area in areas" :key="area.id">
            <td>{{ area.name }}</td>
            <td>{{ area.description }}</td>
            <td>
              <template v-if="area.admins.length === 0">No admins</template>
              <v-chip v-for="admin in area.admins" :key="admin.id" class="mr-1" size="small">
                {{ admin.firstName }} {{ admin.lastName }}
              </v-chip>
            </td>
            <td>{{ area.isActive ? "Active" : "Inactive" }}</td>
            <td class="text-right">
              <v-btn icon size="small" aria-label="Edit area" @click="openEdit(area)">
                <v-icon icon="mdi-pencil" />
              </v-btn>
              <v-btn icon size="small" aria-label="Manage admins" @click="openAdmins(area)">
                <v-icon icon="mdi-account-cog" />
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ dialogTitle }}</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" class="mb-4">{{ formError }}</v-alert>
          <v-form ref="formRef" @submit.prevent="saveArea">
            <v-text-field v-model="form.name" label="Area Name" :rules="nameRules" />
            <v-textarea v-model="form.description" label="Description" />
            <v-switch v-if="editing" v-model="form.isActive" label="Active" color="primary" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="secondary" variant="text" @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" class="oc-cta" :loading="saving" @click="saveArea">{{ saveLabel }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="adminDialog" max-width="520">
      <v-card v-if="selectedArea">
        <v-card-title>Manage Admins — {{ selectedArea.name }}</v-card-title>
        <v-card-text>
          <v-alert v-if="adminError" type="error" class="mb-4">{{ adminError }}</v-alert>
          <div
            v-for="admin in selectedArea.admins"
            :key="admin.id"
            class="d-flex align-center justify-space-between mb-2"
          >
            <span>{{ admin.firstName }} {{ admin.lastName }}</span>
            <v-btn icon size="small" aria-label="Remove admin" @click="removeAdmin(admin)">
              <v-icon icon="mdi-account-remove" />
            </v-btn>
          </div>
          <div class="d-flex align-center mt-4">
            <v-autocomplete
              v-model="selectedUserId"
              :items="candidateAdmins"
              item-title="fullName"
              item-value="id"
              label="Area admin"
              class="mr-2"
              clearable
            />
            <v-btn color="primary" class="oc-cta" :loading="adminSaving" @click="addAdmin">Add</v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="secondary" variant="text" @click="adminDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
