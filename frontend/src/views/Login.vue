<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import authServices from "../services/authServices.js";

const GOOGLE_IDENTITY_SRC = "https://accounts.google.com/gsi/client";

const router = useRouter();
const googleButton = ref(null);
const loading = ref(false);
const error = ref("");

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(script);
  });
}

async function handleCredential(response) {
  if (!response?.credential) {
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const res = await authServices.loginUser(response.credential);
    Utils.setStore("user", res.data);
    window.dispatchEvent(new CustomEvent("user-changed"));
    await router.push({ name: "home" });
  } catch (err) {
    error.value = err.response?.data?.message || "Google sign-in failed.";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const google = await loadGoogleIdentity();
    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleCredential,
    });
    google.accounts.id.renderButton(googleButton.value, {
      theme: "outline",
      size: "large",
      text: "signin_with",
    });
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col cols="12" md="6">
        <v-card rounded="lg" elevation="2" class="pa-6 text-center">
          <h1 class="text-h4 mb-6">OC Vehicle Scheduling</h1>

          <div ref="googleButton" class="d-flex justify-center" data-test="google-button" />

          <v-progress-linear
            v-if="loading"
            indeterminate
            color="primary"
            class="mt-6"
            data-test="login-loading"
          />

          <v-alert v-if="error" type="error" class="mt-6 text-left">{{ error }}</v-alert>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
