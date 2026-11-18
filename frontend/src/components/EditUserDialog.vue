<script setup>
import { reactive, ref, watch } from "vue";
import userServices from "../services/userServices.js";
import { ROLE_OPTIONS } from "../utils/roles.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
  isSelf: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "saved"]);

const formRef = ref(null);
const saving = ref(false);
const error = ref("");
const form = reactive({
  role: "requestor",
  isApprovedDriver: false,
  licenseExpiration: "",
  isActive: true,
});

const licenseRules = [
  (value) =>
    !form.isApprovedDriver || !!value || "License expiration is required for approved drivers.",
];

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.user) {
      form.role = props.user.role;
      form.isApprovedDriver = props.user.isApprovedDriver;
      form.licenseExpiration = props.user.licenseExpiration ?? "";
      form.isActive = props.user.isActive;
      error.value = "";
    }
  },
  { immediate: true }
);

function close() {
  emit("update:modelValue", false);
}

async function save() {
  const { valid } = await formRef.value.validate();
  if (!valid) {
    return;
  }

  saving.value = true;
  error.value = "";

  try {
    const res = await userServices.updateUser(props.user.id, {
      role: form.role,
      isApprovedDriver: form.isApprovedDriver,
      licenseExpiration: form.licenseExpiration || null,
      isActive: form.isActive,
    });
    emit("saved", res.data);
    close();
  } catch (err) {
    error.value = err.response?.data?.message || "Could not update user.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="user" rounded="lg" elevation="4">
      <v-card-item>
        <v-card-title>Edit User</v-card-title>
      </v-card-item>

      <v-card-text>
        <v-form ref="formRef" @submit.prevent="save">
          <v-text-field label="Name" :model-value="`${user.firstName} ${user.lastName}`" readonly />
          <v-text-field label="Email" :model-value="user.email" readonly />
          <v-text-field label="Phone" :model-value="user.phone ?? ''" readonly />

          <v-select
            v-model="form.role"
            label="Role"
            :items="ROLE_OPTIONS"
            :disabled="isSelf"
            data-test="role-select"
          />
          <v-checkbox
            v-model="form.isApprovedDriver"
            label="Approved driver"
            data-test="approved-driver"
          />
          <v-text-field
            v-model="form.licenseExpiration"
            label="License expiration"
            type="date"
            :rules="licenseRules"
            data-test="license-expiration"
          />
          <v-switch
            v-model="form.isActive"
            label="Active"
            color="primary"
            :disabled="isSelf"
            data-test="active-switch"
          />

          <v-alert v-if="error" type="error">{{ error }}</v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="secondary" variant="text" data-test="cancel-edit" @click="close">
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          class="oc-cta"
          :loading="saving"
          data-test="save-user"
          @click="save"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
