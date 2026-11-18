<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Utils from "../config/utils.js";
import authServices from "../services/authServices.js";

const NAV_ITEMS = [
  { title: "Users", name: "users", roles: ["admin"] },
  { title: "Profile", name: "profile" },
];

const route = useRoute();
const router = useRouter();
const user = ref(Utils.getStore("user"));

const refreshUser = () => {
  user.value = Utils.getStore("user");
};

const navItems = computed(() =>
  user.value ? NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.value.role)) : []
);

watch(() => route.fullPath, refreshUser);
onMounted(() => window.addEventListener("user-changed", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-changed", refreshUser));

async function signOut() {
  try {
    await authServices.logoutUser();
  } catch {
    // The local session is cleared even if the server session is already gone.
  }
  window.google?.accounts?.id?.disableAutoSelect();
  Utils.removeItem("user");
  user.value = null;
  router.push({ name: "login" });
}
</script>

<template>
  <v-app-bar color="primary" flat>
    <v-app-bar-title>OC Vehicle Scheduling</v-app-bar-title>

    <template v-if="user">
      <v-btn
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        variant="text"
      >
        {{ item.title }}
      </v-btn>
      <span class="mx-4 text-body-2" data-test="user-name">
        {{ user.firstName }} {{ user.lastName }}
      </span>
      <v-btn variant="outlined" class="mr-2" @click="signOut">Sign out</v-btn>
    </template>
  </v-app-bar>
</template>
