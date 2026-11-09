<script setup>
import { computed } from "vue";
import Utils from "../config/utils.js";

const user = computed(() => Utils.getStore("user"));
</script>

<template>
  <v-app-bar color="surface" flat border>
    <v-app-bar-title>OC Vehicle Scheduling</v-app-bar-title>
    <template v-if="user" #append>
      <span class="mr-4">{{ user.firstName }}</span>
      <v-btn v-if="user.role === 'admin'" to="/vehicle-types" variant="text">Vehicle Types</v-btn>
    </template>
  </v-app-bar>
</template>
