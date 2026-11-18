<script setup>
import { onMounted, ref, watch } from "vue";
import Utils from "../config/utils.js";
import userServices from "../services/userServices.js";
import EditUserDialog from "../components/EditUserDialog.vue";
import { roleLabel } from "../utils/roles.js";

const currentUserId = Utils.getStore("user")?.userId;

const users = ref([]);
const loading = ref(false);
const error = ref("");
const search = ref("");
const dialogOpen = ref(false);
const editingUser = ref(null);

let latestRequest = 0;

async function loadUsers() {
  const requestId = ++latestRequest;
  loading.value = true;
  error.value = "";

  try {
    const res = await userServices.getUsers(search.value.trim());
    if (requestId === latestRequest) {
      users.value = res.data;
    }
  } catch (err) {
    if (requestId === latestRequest) {
      error.value = err.response?.data?.message || "Could not load users.";
    }
  } finally {
    if (requestId === latestRequest) {
      loading.value = false;
    }
  }
}

function openEdit(user) {
  editingUser.value = user;
  dialogOpen.value = true;
}

function onSaved(updated) {
  users.value = users.value.map((user) => (user.id === updated.id ? updated : user));
}

watch(search, loadUsers);
onMounted(loadUsers);
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">Users</h1>

    <v-text-field
      v-model="search"
      label="Search users"
      prepend-inner-icon="mdi-magnify"
      clearable
      data-test="user-search"
    />

    <v-progress-linear v-if="loading" indeterminate color="primary" data-test="users-loading" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <p v-if="!loading && !error && users.length === 0" data-test="users-empty">
      No users match your search.
    </p>

    <v-card v-else-if="users.length > 0" rounded="lg" elevation="2">
      <v-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Approved driver</th>
            <th>License expires</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" data-test="user-row">
            <td>{{ user.lastName }}, {{ user.firstName }}</td>
            <td>{{ user.email }}</td>
            <td>{{ roleLabel(user.role) }}</td>
            <td>{{ user.isApprovedDriver ? "Yes" : "No" }}</td>
            <td>{{ user.licenseExpiration || "—" }}</td>
            <td>{{ user.isActive ? "Active" : "Inactive" }}</td>
            <td class="text-right">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                aria-label="Edit user"
                @click="openEdit(user)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <EditUserDialog
      v-model="dialogOpen"
      :user="editingUser"
      :is-self="editingUser?.id === currentUserId"
      @saved="onSaved"
    />
  </v-container>
</template>
