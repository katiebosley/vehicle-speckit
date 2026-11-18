<script setup>
import { onMounted, reactive, ref } from "vue";
import Utils from "../config/utils.js";
import profileServices from "../services/profileServices.js";
import { roleLabel } from "../utils/roles.js";

const formRef = ref(null);
const profile = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const success = ref("");
const form = reactive({ firstName: "", lastName: "", phone: "" });

const nameRules = [
  (value) => !!value?.trim() || "Required",
  (value) => (value?.trim().length ?? 0) <= 100 || "Must be 100 characters or fewer.",
];
const phoneRules = [
  (value) => !value || value.trim().length <= 20 || "Phone must be 20 characters or fewer.",
];

function fillForm(data) {
  profile.value = data;
  form.firstName = data.firstName;
  form.lastName = data.lastName;
  form.phone = data.phone ?? "";
}

onMounted(async () => {
  loading.value = true;
  try {
    const res = await profileServices.getProfile();
    fillForm(res.data);
  } catch (err) {
    error.value = err.response?.data?.message || "Could not load profile.";
  } finally {
    loading.value = false;
  }
});

async function save() {
  const { valid } = await formRef.value.validate();
  if (!valid) {
    return;
  }

  saving.value = true;
  error.value = "";
  success.value = "";

  try {
    const res = await profileServices.updateProfile({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone?.trim() ?? "",
    });
    fillForm(res.data);
    Utils.setStore("user", {
      ...Utils.getStore("user"),
      firstName: res.data.firstName,
      lastName: res.data.lastName,
    });
    window.dispatchEvent(new CustomEvent("user-changed"));
    success.value = "Profile saved.";
  } catch (err) {
    error.value = err.response?.data?.message || "Could not save profile.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 mb-4">My Profile</h1>

    <v-progress-linear v-if="loading" indeterminate color="primary" />
    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
    <v-alert v-if="success" type="success" class="mb-4">{{ success }}</v-alert>

    <v-card v-if="profile" rounded="lg" elevation="2" class="pa-4">
      <v-form ref="formRef" @submit.prevent="save">
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.firstName"
              label="First Name"
              :rules="nameRules"
              data-test="first-name"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.lastName"
              label="Last Name"
              :rules="nameRules"
              data-test="last-name"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.phone" label="Phone" :rules="phoneRules" data-test="phone" />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field label="Email" :model-value="profile.email" readonly data-test="email" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              label="Role"
              :model-value="roleLabel(profile.role)"
              readonly
              data-test="role"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              label="Approved driver"
              :model-value="profile.isApprovedDriver ? 'Yes' : 'No'"
              readonly
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              label="License expires"
              :model-value="profile.licenseExpiration || '—'"
              readonly
            />
          </v-col>
        </v-row>

        <v-btn
          type="submit"
          color="primary"
          variant="elevated"
          class="oc-cta"
          :loading="saving"
          data-test="save-profile"
        >
          Save
        </v-btn>
      </v-form>
    </v-card>
  </v-container>
</template>
